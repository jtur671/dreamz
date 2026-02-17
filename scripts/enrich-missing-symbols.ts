#!/usr/bin/env npx tsx
/**
 * Enrich symbols that are missing shadow_meaning, guidance, category, or related_symbols.
 *
 * Unlike enrich-dreammoods-symbols.ts which reads from CSV, this script
 * fetches unenriched symbols directly from the remote Supabase database
 * and sends them through the enrich-symbols edge function.
 *
 * Usage:
 *   npx tsx scripts/enrich-missing-symbols.ts
 *
 * Requires: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/enrich-symbols`;

const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "010_enrich_missing_symbols.sql"
);
const PROGRESS_PATH = path.join(__dirname, "..", ".enrich-missing-progress.json");

const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 1500;
const PAGE_SIZE = 1000;

interface SymbolRow {
  name: string;
  meaning: string;
}

interface EnrichedSymbol {
  name: string;
  shadow_meaning: string;
  guidance: string;
  category: string;
  related_symbols: string[];
}

interface Progress {
  completedBatches: number;
  results: EnrichedSymbol[];
  totalSymbols: number;
}

// ── Fetch unenriched symbols from Supabase REST API ─────────────────────────

async function fetchUnenrichedSymbols(): Promise<SymbolRow[]> {
  const allSymbols: SymbolRow[] = [];
  let offset = 0;

  console.log("Fetching unenriched symbols from remote database...");

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/symbols?select=name,meaning&shadow_meaning=is.null&order=name.asc&offset=${offset}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch symbols: ${res.status} ${await res.text()}`);
    }

    const rows: SymbolRow[] = await res.json();
    if (rows.length === 0) break;

    allSymbols.push(...rows);
    console.log(`  Fetched ${allSymbols.length} symbols so far...`);
    offset += PAGE_SIZE;

    if (rows.length < PAGE_SIZE) break;
  }

  return allSymbols;
}

// ── Edge Function Call ──────────────────────────────────────────────────────

async function enrichBatch(symbols: SymbolRow[]): Promise<EnrichedSymbol[]> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ symbols }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Edge function error (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.success || !Array.isArray(data.symbols)) {
    throw new Error(`Invalid response: ${JSON.stringify(data)}`);
  }

  return data.symbols;
}

// ── Progress Tracking ───────────────────────────────────────────────────────

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
  }
  return { completedBatches: 0, results: [], totalSymbols: 0 };
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress), "utf-8");
}

// ── SQL Generation ──────────────────────────────────────────────────────────

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

function generateMigration(results: EnrichedSymbol[]): void {
  let sql = `-- Missing Symbol Enrichment
-- Generated: ${new Date().toISOString()}
-- Total enriched symbols: ${results.length}
--
-- Adds shadow_meaning, guidance, category, and related_symbols
-- to symbols that were missed by the initial enrichment (migration 009).

`;

  for (const sym of results) {
    if (!sym.name) continue;
    const name = escapeSql(sym.name);
    const shadow = escapeSql(sym.shadow_meaning || "");
    const guidance = escapeSql(sym.guidance || "");
    const category = escapeSql(sym.category || "");
    const related = sym.related_symbols?.length
      ? `ARRAY[${sym.related_symbols.map((r) => `'${escapeSql(r)}'`).join(", ")}]`
      : "NULL";

    sql += `UPDATE symbols SET shadow_meaning = '${shadow}', guidance = '${guidance}', category = '${category}', related_symbols = ${related} WHERE name = '${name}' AND shadow_meaning IS NULL;\n`;
  }

  fs.writeFileSync(OUTPUT_PATH, sql, "utf-8");
  console.log(`\nMigration written to: ${OUTPUT_PATH}`);
  console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function run() {
  // Load progress first to see if we're resuming
  let progress = loadProgress();

  let symbols: SymbolRow[];

  if (progress.completedBatches > 0 && progress.totalSymbols > 0) {
    // Resuming - re-fetch to get the same list
    console.log(`\nResuming from batch ${progress.completedBatches + 1} (${progress.results.length} already enriched)`);
    symbols = await fetchUnenrichedSymbols();
    // If the DB count changed since last run (some got enriched), we need the original order
    // So we re-fetch all still-missing ones. The completed batches might overlap but
    // the SQL uses WHERE shadow_meaning IS NULL so duplicates are harmless.
    if (symbols.length !== progress.totalSymbols - progress.results.length) {
      console.log(`Note: DB has ${symbols.length} unenriched (was ${progress.totalSymbols} originally). Adjusting.`);
    }
  } else {
    symbols = await fetchUnenrichedSymbols();
    progress.totalSymbols = symbols.length;
  }

  console.log(`${symbols.length} symbols to enrich`);

  const totalBatches = Math.ceil(symbols.length / BATCH_SIZE);
  console.log(`${totalBatches} batches of ${BATCH_SIZE}\n`);

  if (symbols.length === 0) {
    console.log("All symbols are already enriched!");
    return;
  }

  let failures = 0;
  const MAX_FAILURES = 5;

  for (let i = progress.completedBatches; i < totalBatches; i++) {
    const batch = symbols.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const pct = ((i / totalBatches) * 100).toFixed(1);
    process.stdout.write(
      `[${pct}%] Batch ${i + 1}/${totalBatches} (${batch.map((s) => s.name).join(", ")})... `
    );

    try {
      const enriched = await enrichBatch(batch);
      progress.results.push(...enriched);
      progress.completedBatches = i + 1;
      saveProgress(progress);
      console.log(`OK (${enriched.length} enriched)`);
      failures = 0;
    } catch (err) {
      failures++;
      console.log(`FAILED: ${err instanceof Error ? err.message : err}`);

      if (failures >= MAX_FAILURES) {
        console.error(
          `\n${MAX_FAILURES} consecutive failures. Saving progress and stopping.`
        );
        console.log(
          `Run the script again to resume from batch ${progress.completedBatches + 1}.`
        );
        break;
      }

      await new Promise((r) => setTimeout(r, 5000));
      i--; // Retry same batch
      continue;
    }

    if (i < totalBatches - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`\n${progress.results.length} symbols enriched total.`);
  generateMigration(progress.results);

  if (progress.completedBatches === totalBatches) {
    fs.unlinkSync(PROGRESS_PATH);
    console.log("Progress file cleaned up.");
  }
}

run().catch(console.error);
