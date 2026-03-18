/**
 * Symbol Lookup Helpers
 *
 * Extracts keywords from dream text and looks up matching symbols
 * from the curated dictionary to ground AI interpretations.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MatchedSymbol {
  name: string;
  meaning: string;
  shadow_meaning: string | null;
  guidance: string | null;
}

// Common words to skip during keyword extraction
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "must",
  "it", "its", "my", "your", "his", "her", "our", "their", "this",
  "that", "these", "those", "i", "me", "we", "us", "you", "he", "she",
  "they", "them", "who", "what", "which", "when", "where", "how", "why",
  "not", "no", "nor", "so", "if", "then", "than", "too", "very", "just",
  "about", "up", "out", "into", "over", "after", "before", "between",
  "under", "again", "there", "here", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "only", "own", "same",
  "also", "back", "even", "still", "way", "well", "new", "now", "like",
  "felt", "feeling", "really", "started", "went", "got", "see", "saw",
  "looked", "seemed", "came", "going", "get", "make", "made", "know",
  "knew", "think", "thought", "said", "told", "around", "through",
  "something", "everything", "nothing", "someone", "everyone", "time",
  "suddenly", "dream", "dreamed", "dreaming", "woke",
]);

/**
 * Extracts meaningful keywords from dream text.
 * Returns unique lowercased words (3+ chars) that aren't stop words,
 * plus 2-word phrases for compound symbols.
 */
export function extractKeywords(dreamText: string): string[] {
  const text = dreamText.toLowerCase();
  // Split on non-alpha characters, keep only 3+ char words
  const words = text
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const unique = [...new Set(words)];

  // Also extract 2-word phrases for compound symbols (e.g., "black cat")
  const wordArray = text.split(/[^a-z]+/).filter((w) => w.length >= 2);
  const phrases: string[] = [];
  for (let i = 0; i < wordArray.length - 1; i++) {
    const a = wordArray[i];
    const b = wordArray[i + 1];
    if (!STOP_WORDS.has(a) && !STOP_WORDS.has(b)) {
      phrases.push(`${a} ${b}`);
    }
  }

  return [...new Set([...phrases, ...unique])];
}

/**
 * Looks up matching symbols from the curated dictionary.
 * Queries the symbols table using ilike matching on name column.
 * Returns up to 10 matches with their meaning/shadow/guidance.
 */
export async function lookupSymbols(
  supabase: ReturnType<typeof createClient>,
  dreamText: string
): Promise<MatchedSymbol[]> {
  const keywords = extractKeywords(dreamText);
  if (keywords.length === 0) return [];

  // Query for exact name matches first (most relevant)
  const { data, error } = await supabase
    .from("symbols")
    .select("name, meaning, shadow_meaning, guidance")
    .or(keywords.map((kw) => `name.ilike.${kw}`).join(","))
    .limit(10);

  if (error) {
    console.error(`Symbol lookup error: ${error.message}`);
    return [];
  }

  if (data && data.length > 0) return data as MatchedSymbol[];

  // Fallback: try partial matches for shorter keyword list (top 15 keywords)
  const topKeywords = keywords.slice(0, 15);
  const { data: partialData, error: partialError } = await supabase
    .from("symbols")
    .select("name, meaning, shadow_meaning, guidance")
    .or(topKeywords.map((kw) => `name.ilike.%${kw}%`).join(","))
    .limit(10);

  if (partialError) {
    console.error(`Symbol partial lookup error: ${partialError.message}`);
    return [];
  }

  return (partialData || []) as MatchedSymbol[];
}
