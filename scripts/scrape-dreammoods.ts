/**
 * DreamMoods Symbol Scraper
 *
 * Scrapes dream symbols from dreammoods.com dictionary
 * and outputs them in a format ready for database import.
 *
 * Usage: npx ts-node scripts/scrape-dreammoods.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ScrapedSymbol {
  name: string;
  meaning: string;
  category: string;
  source: 'dreammoods';
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const BASE_URL = 'https://www.dreammoods.com/dreamdictionary';

// Simple HTML parser to extract text between tags
function extractText(html: string, startTag: string, endTag: string): string[] {
  const results: string[] = [];
  let searchFrom = 0;

  while (true) {
    const startIdx = html.indexOf(startTag, searchFrom);
    if (startIdx === -1) break;

    const contentStart = startIdx + startTag.length;
    const endIdx = html.indexOf(endTag, contentStart);
    if (endIdx === -1) break;

    results.push(html.substring(contentStart, endIdx));
    searchFrom = endIdx + endTag.length;
  }

  return results;
}

// Clean HTML entities and tags
function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeLetter(letter: string): Promise<ScrapedSymbol[]> {
  const url = `${BASE_URL}/${letter}.htm`;
  console.log(`Scraping ${url}...`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DreamzBot/1.0; educational purposes)',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${letter}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const symbols: ScrapedSymbol[] = [];

    // DreamMoods uses <strong> for symbol names followed by <br> and meaning
    // Pattern: <strong>Symbol Name</strong><br>meaning text

    // Try to find definition sections
    // The site structure varies, so we'll try multiple approaches

    // Approach 1: Look for bold terms followed by definitions
    const strongMatches = html.match(/<strong[^>]*>([^<]+)<\/strong>/gi) || [];

    for (const match of strongMatches) {
      const nameMatch = match.match(/<strong[^>]*>([^<]+)<\/strong>/i);
      if (!nameMatch) continue;

      const name = cleanHtml(nameMatch[1]);

      // Skip navigation items, headers, etc.
      if (name.length < 2 || name.length > 50) continue;
      if (name.match(/^(top|back|home|next|previous|page)$/i)) continue;
      if (name.match(/^[A-Z]$/)) continue; // Single letters (navigation)

      // Find the meaning after this term
      const matchIdx = html.indexOf(match);
      const afterMatch = html.substring(matchIdx + match.length, matchIdx + match.length + 2000);

      // Look for text after <br> or in following paragraph
      let meaning = '';
      const brMatch = afterMatch.match(/^<br\s*\/?>\s*([^<]+)/i);
      if (brMatch) {
        meaning = cleanHtml(brMatch[1]);
      } else {
        // Try to get text until next <strong> or </p>
        const untilNext = afterMatch.match(/^[^<]*(?:<(?!strong|\/p)[^>]*>[^<]*)*([^<]+)/i);
        if (untilNext) {
          meaning = cleanHtml(untilNext[0]);
        }
      }

      // Clean and validate meaning
      meaning = meaning.replace(/^[\s\-:]+/, '').trim();

      if (meaning.length > 20 && meaning.length < 2000) {
        symbols.push({
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          meaning,
          category: letter.toUpperCase(),
          source: 'dreammoods',
        });
      }
    }

    // Deduplicate by name
    const uniqueSymbols = symbols.reduce((acc, symbol) => {
      if (!acc.find(s => s.name.toLowerCase() === symbol.name.toLowerCase())) {
        acc.push(symbol);
      }
      return acc;
    }, [] as ScrapedSymbol[]);

    console.log(`  Found ${uniqueSymbols.length} symbols for letter ${letter.toUpperCase()}`);
    return uniqueSymbols;
  } catch (error) {
    console.error(`Error scraping ${letter}:`, error);
    return [];
  }
}

async function main() {
  console.log('Starting DreamMoods symbol scrape...\n');

  const allSymbols: ScrapedSymbol[] = [];

  for (const letter of ALPHABET) {
    const symbols = await scrapeLetter(letter);
    allSymbols.push(...symbols);

    // Be respectful with rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\nTotal symbols scraped: ${allSymbols.length}`);

  // Write to JSON file
  const outputPath = path.join(__dirname, 'scraped-symbols.json');
  fs.writeFileSync(outputPath, JSON.stringify(allSymbols, null, 2));
  console.log(`Saved to: ${outputPath}`);

  // Generate SQL migration
  const sqlPath = path.join(__dirname, 'import-symbols.sql');
  let sql = `-- Scraped symbols from DreamMoods.com
-- Generated: ${new Date().toISOString()}
-- Total symbols: ${allSymbols.length}

INSERT INTO symbols (name, meaning, category, source) VALUES\n`;

  const values = allSymbols.map(s => {
    const escapedName = s.name.replace(/'/g, "''");
    const escapedMeaning = s.meaning.replace(/'/g, "''");
    return `  ('${escapedName}', '${escapedMeaning}', '${s.category}', '${s.source}')`;
  });

  sql += values.join(',\n');
  sql += '\nON CONFLICT (name) DO UPDATE SET meaning = EXCLUDED.meaning, source = EXCLUDED.source;\n';

  fs.writeFileSync(sqlPath, sql);
  console.log(`SQL migration saved to: ${sqlPath}`);
}

main().catch(console.error);
