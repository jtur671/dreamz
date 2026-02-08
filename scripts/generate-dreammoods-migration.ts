#!/usr/bin/env npx ts-node
/**
 * Parse dreammoods_symbols.csv and generate a SQL migration
 * to import symbols into the symbols table.
 *
 * Usage: npx ts-node scripts/generate-dreammoods-migration.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.join(__dirname, '..', 'dreammoods_symbols.csv');
const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '008_import_dreammoods_symbols.sql'
);

interface RawSymbol {
  name: string;
  meaning: string;
  category: string;
}

function parseCSV(content: string): RawSymbol[] {
  const lines = content.split('\n');
  const results: RawSymbol[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with quoted fields
    const fields = parseCSVLine(line);
    if (fields.length < 4) continue;

    const [name, meaning, _sourceType, letterOrCategory] = fields;
    results.push({
      name: name.trim(),
      meaning: meaning.trim(),
      category: letterOrCategory.trim(),
    });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function isValidSymbol(sym: RawSymbol): boolean {
  // Skip empty
  if (!sym.name || !sym.meaning) return false;

  // Skip cross-references ("*Please See ...")
  if (sym.meaning.match(/^\*?Please\s+See\s/i)) return false;
  if (sym.meaning.match(/^\w+\s+\*Please\s+See\s/i)) return false;

  // Skip very short meanings (likely junk)
  if (sym.meaning.length < 20) return false;

  // Skip the junk last row
  if (sym.name === 'ABCs') return false;

  // Skip names that start with a dash (malformed CSV parse like "-Girlfriend")
  if (sym.name.startsWith('-')) return false;

  // Skip site metadata entries (not real symbols)
  if (sym.meaning.includes('Dream Mooders')) return false;

  return true;
}

function cleanName(name: string): string {
  // Remove leading/trailing whitespace and normalize
  return name.replace(/\s+/g, ' ').trim();
}

function cleanMeaning(meaning: string): string {
  // Strip DreamMoods footer/nav junk that got scraped into some entries
  return meaning
    .replace(/\s*Tweet\s+Dream\s+Themes.*$/s, '')
    .replace(/\s*Tweet\s+Dream\s+Dictionary.*$/s, '')
    .replace(/\s*Page\s+\d+\s+\S+\s+to\s+\S+\s+Page\s+\d+.*$/s, '')
    .replace(/\s*Page\s+\d+\s+\S+\s+to\s+\S+\s+View\s+All.*$/s, '')
    .replace(/\s*Page\s+\d+\s+\S+\s+to\s+.+$/s, '')
    .replace(/\s*This\s+web\s+site\s+designed\s+and\s+maintained.*$/s, '')
    .replace(/\s*Tweet\s*$/, '')
    .replace(/\s*A\s+B\s+C\s+D\s+E\s+F\s+G\s+H.*$/s, '')
    .trim();
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

function mapCategory(raw: string): string | null {
  // letter_or_category is either a letter like "A" or a theme like "wedding-dream-symbols"
  const lower = raw.toLowerCase();

  if (lower.length === 1) return null; // Just a letter, no meaningful category

  // Map known DreamMoods theme categories
  const categoryMap: Record<string, string> = {
    'animal-dream-symbols': 'animal',
    'body-dream-symbols': 'body',
    'bug-dream-symbols': 'animal',
    'character-dream-symbols': 'person',
    'color-dream-symbols': 'theme',
    'feeling-dream-symbols': 'theme',
    'food-dream-symbols': 'object',
    'house-dream-symbols': 'place',
    'nature-dream-symbols': 'nature',
    'number-dream-symbols': 'theme',
    'place-dream-symbols': 'place',
    'sex-dream-symbols': 'theme',
    'wedding-dream-symbols': 'theme',
    'vehicle-dream-symbols': 'object',
  };

  return categoryMap[lower] || null;
}

function run() {
  console.log('Reading CSV...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const rawSymbols = parseCSV(csvContent);
  console.log(`Parsed ${rawSymbols.length} raw entries`);

  // Filter valid symbols
  const valid = rawSymbols.filter(isValidSymbol);
  console.log(`${valid.length} valid entries (after filtering cross-refs and junk)`);

  // Deduplicate by name (keep the entry with the longest meaning)
  const byName = new Map<string, RawSymbol>();
  for (const sym of valid) {
    const key = cleanName(sym.name).toLowerCase();
    const cleaned = cleanMeaning(sym.meaning);
    if (cleaned.length < 20) continue; // Re-check after cleaning

    const existing = byName.get(key);
    if (!existing || cleaned.length > existing.meaning.length) {
      byName.set(key, {
        name: cleanName(sym.name),
        meaning: cleaned,
        category: mapCategory(sym.category) || existing?.category || '',
      });
    } else if (!existing.category && mapCategory(sym.category)) {
      // Keep the longer meaning but grab category if we found one
      existing.category = mapCategory(sym.category) || '';
    }
  }

  const deduped = Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  console.log(`${deduped.length} unique symbols after deduplication`);

  // Generate SQL
  const BATCH_SIZE = 50;
  let sql = `-- DreamMoods Symbol Import
-- Generated: ${new Date().toISOString()}
-- Total unique symbols: ${deduped.length}
-- Source: dreammoods_symbols.csv (scraped from dreammoods.com)
--
-- Uses ON CONFLICT (name) DO NOTHING to preserve curated symbols.
-- Only imports name, meaning, source, and category (when available).
-- Curated symbols retain their richer shadow_meaning, guidance, etc.

`;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    sql += 'INSERT INTO symbols (name, meaning, source, category) VALUES\n';

    const values = batch.map((sym) => {
      const name = escapeSql(sym.name);
      const meaning = escapeSql(sym.meaning);
      const cat = sym.category ? `'${escapeSql(sym.category)}'` : 'NULL';
      return `  ('${name}', '${meaning}', 'dreammoods', ${cat})`;
    });

    sql += values.join(',\n');
    sql += '\nON CONFLICT (name) DO NOTHING;\n\n';
  }

  fs.writeFileSync(OUTPUT_PATH, sql, 'utf-8');
  console.log(`\nMigration written to: ${OUTPUT_PATH}`);
  console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
}

run();
