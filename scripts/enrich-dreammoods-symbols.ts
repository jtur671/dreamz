#!/usr/bin/env npx tsx
/**
 * Batch-enrich DreamMoods symbols via the enrich-symbols edge function.
 *
 * Reads symbols from the CSV, sends batches to the edge function,
 * and generates a SQL migration with UPDATE statements.
 *
 * Usage:
 *   npx tsx scripts/enrich-dreammoods-symbols.ts
 *
 * Requires: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 * Also requires a valid Supabase auth session (email/password from env or args).
 *
 * Environment variables:
 *   TEST_USER_EMAIL - Supabase user email for auth
 *   TEST_USER_PASSWORD - Supabase user password for auth
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/enrich-symbols`;

const CSV_PATH = path.join(__dirname, "..", "dreammoods_symbols.csv");
const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "009_enrich_dreammoods_symbols.sql"
);
const PROGRESS_PATH = path.join(__dirname, "..", ".enrich-progress.json");

const BATCH_SIZE = 15;
const DELAY_BETWEEN_BATCHES_MS = 1500; // Rate limit friendly

interface RawSymbol {
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

// ─── CSV Parsing (reused from generate script) ───────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function cleanMeaning(meaning: string): string {
  return meaning
    .replace(/\s*Tweet\s+Dream\s+Themes.*$/s, "")
    .replace(/\s*Tweet\s+Dream\s+Dictionary.*$/s, "")
    .replace(/\s*Page\s+\d+\s+\S+\s+to\s+\S+\s+Page\s+\d+.*$/s, "")
    .replace(/\s*Page\s+\d+\s+\S+\s+to\s+\S+\s+View\s+All.*$/s, "")
    .replace(/\s*Page\s+\d+\s+\S+\s+to\s+.+$/s, "")
    .replace(/\s*This\s+web\s+site\s+designed\s+and\s+maintained.*$/s, "")
    .replace(/\s*Tweet\s*$/, "")
    .replace(/\s*A\s+B\s+C\s+D\s+E\s+F\s+G\s+H.*$/s, "")
    .trim();
}

function loadSymbols(): RawSymbol[] {
  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = content.split("\n");
  const byName = new Map<string, RawSymbol>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 4) continue;

    const name = fields[0].trim().replace(/\s+/g, " ");
    let meaning = cleanMeaning(fields[1].trim());

    if (!name || !meaning) continue;
    if (meaning.match(/^\*?Please\s+See\s/i)) continue;
    if (meaning.match(/^\w+\s+\*Please\s+See\s/i)) continue;
    if (meaning.length < 20) continue;
    if (name === "ABCs" || name.startsWith("-")) continue;
    if (meaning.includes("Dream Mooders")) continue;

    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || meaning.length > existing.meaning.length) {
      byName.set(key, { name, meaning });
    }
  }

  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.error(
      "Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env or environment"
    );
    process.exit(1);
  }

  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Auth failed: ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  return data.access_token;
}

// ─── Edge Function Call ──────────────────────────────────────────────────────

async function enrichBatch(
  symbols: RawSymbol[]
): Promise<EnrichedSymbol[]> {
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

// ─── Progress Tracking ───────────────────────────────────────────────────────

interface Progress {
  completedBatches: number;
  results: EnrichedSymbol[];
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8"));
  }
  return { completedBatches: 0, results: [] };
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress), "utf-8");
}

// ─── SQL Generation ──────────────────────────────────────────────────────────

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

function generateMigration(results: EnrichedSymbol[]): void {
  let sql = `-- DreamMoods Symbol Enrichment
-- Generated: ${new Date().toISOString()}
-- Total enriched symbols: ${results.length}
--
-- Adds shadow_meaning, guidance, category, and related_symbols
-- to DreamMoods symbols. Only updates rows with source='dreammoods'.

`;

  for (const sym of results) {
    const name = escapeSql(sym.name);
    const shadow = escapeSql(sym.shadow_meaning || "");
    const guidance = escapeSql(sym.guidance || "");
    const category = escapeSql(sym.category || "");
    const related = sym.related_symbols?.length
      ? `ARRAY[${sym.related_symbols.map((r) => `'${escapeSql(r)}'`).join(", ")}]`
      : "NULL";

    sql += `UPDATE symbols SET shadow_meaning = '${shadow}', guidance = '${guidance}', category = '${category}', related_symbols = ${related} WHERE name = '${name}' AND source = 'dreammoods';\n`;
  }

  fs.writeFileSync(OUTPUT_PATH, sql, "utf-8");
  console.log(`\nMigration written to: ${OUTPUT_PATH}`);
  console.log(
    `File size: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log("Loading symbols from CSV...");
  const symbols = loadSymbols();
  console.log(`${symbols.length} symbols to enrich`);

  const totalBatches = Math.ceil(symbols.length / BATCH_SIZE);
  console.log(`${totalBatches} batches of ${BATCH_SIZE}`);

  // Load progress (resume support)
  const progress = loadProgress();
  if (progress.completedBatches > 0) {
    console.log(
      `\nResuming from batch ${progress.completedBatches + 1}/${totalBatches} (${progress.results.length} symbols already enriched)`
    );
  }

  let failures = 0;
  const MAX_FAILURES = 5;

  for (let i = progress.completedBatches; i < totalBatches; i++) {
    const batch = symbols.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const pct = ((i / totalBatches) * 100).toFixed(1);
    process.stdout.write(
      `[${pct}%] Batch ${i + 1}/${totalBatches} (${batch.length} symbols)... `
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
      console.log(
        `FAILED: ${err instanceof Error ? err.message : err}`
      );

      if (failures >= MAX_FAILURES) {
        console.error(
          `\n${MAX_FAILURES} consecutive failures. Saving progress and stopping.`
        );
        console.log(
          `Run the script again to resume from batch ${progress.completedBatches + 1}.`
        );
        break;
      }

      // Wait longer after failure
      await new Promise((r) => setTimeout(r, 5000));
      // Retry the same batch
      i--;
      continue;
    }

    // Rate limit delay
    if (i < totalBatches - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`\n${progress.results.length} symbols enriched total.`);
  generateMigration(progress.results);

  // Clean up progress file
  if (progress.completedBatches === totalBatches) {
    fs.unlinkSync(PROGRESS_PATH);
    console.log("Progress file cleaned up.");
  }
}

run().catch(console.error);
