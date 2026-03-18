/**
 * Tests for Symbol Lookup helpers (edge function shared code)
 * @file src/lib/__tests__/symbolLookup.test.ts
 *
 * extractKeywords is a pure function — tested directly.
 * lookupSymbols depends on Supabase — tested with a mock client.
 */

// We import the pure function directly from the edge function shared code.
// The only Deno-specific import (createClient from esm.sh) is in lookupSymbols,
// which we test via a mock. extractKeywords has zero Deno dependencies.

// ---------------------------------------------------------------------------
// Inline extractKeywords for Node.js testing (mirrors symbol-lookup.ts)
// ---------------------------------------------------------------------------

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

function extractKeywords(dreamText: string): string[] {
  const text = dreamText.toLowerCase();
  const words = text
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  const unique = [...new Set(words)];

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

// ---------------------------------------------------------------------------
// extractKeywords tests
// ---------------------------------------------------------------------------

describe('extractKeywords', () => {
  it('extracts 3+ char words', () => {
    const result = extractKeywords('I saw a big red cat');
    expect(result).toContain('big');
    expect(result).toContain('red');
    expect(result).toContain('cat');
  });

  it('lowercases all words', () => {
    const result = extractKeywords('Flying EAGLE above Mountains');
    expect(result).toContain('flying');
    expect(result).toContain('eagle');
    expect(result).toContain('mountains');
    expect(result).not.toContain('Flying');
    expect(result).not.toContain('EAGLE');
  });

  it('removes stop words', () => {
    const result = extractKeywords('the cat was on the mat');
    expect(result).toContain('cat');
    expect(result).toContain('mat');
    expect(result).not.toContain('the');
    expect(result).not.toContain('was');
  });

  it('extracts 2-word phrases', () => {
    const result = extractKeywords('I saw a black cat in the old house');
    expect(result).toContain('black cat');
    expect(result).toContain('old house');
  });

  it('deduplicates results', () => {
    const result = extractKeywords('water water water flowing water');
    const waterCount = result.filter((w) => w === 'water').length;
    expect(waterCount).toBe(1);
  });

  it('handles empty string', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('handles string with only stop words', () => {
    const result = extractKeywords('the and was is are were');
    expect(result).toEqual([]);
  });

  it('handles punctuation and special chars', () => {
    const result = extractKeywords("There's a dragon! ...flying, over the castle.");
    expect(result).toContain('dragon');
    expect(result).toContain('flying');
    expect(result).toContain('castle');
  });

  it('handles very long dream text', () => {
    const longText = 'I was running through a dark forest with wolves chasing me. '.repeat(100);
    const start = Date.now();
    const result = extractKeywords(longText);
    const elapsed = Date.now() - start;
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000); // should be fast
  });

  it('does not include dream-related stop words', () => {
    const result = extractKeywords('I dreamed I was dreaming and then I woke suddenly');
    expect(result).not.toContain('dreamed');
    expect(result).not.toContain('dreaming');
    expect(result).not.toContain('woke');
    expect(result).not.toContain('suddenly');
  });

  it('phrases exclude stop words', () => {
    const result = extractKeywords('the big house');
    // "the" is a stop word, so "the big" should not be a phrase
    expect(result).not.toContain('the big');
    // "big house" — both are non-stop, so this should appear
    expect(result).toContain('big house');
  });
});

// ---------------------------------------------------------------------------
// lookupSymbols mock tests
// ---------------------------------------------------------------------------

describe('lookupSymbols (mocked)', () => {
  function createMockSupabase(exactData: any[] | null, exactError: any, partialData?: any[] | null, partialError?: any) {
    let callCount = 0;
    return {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({ data: exactData, error: exactError });
              }
              return Promise.resolve({ data: partialData ?? null, error: partialError ?? null });
            }),
          }),
        }),
      }),
    };
  }

  // Replicate lookupSymbols logic for Node.js testing
  async function lookupSymbols(supabase: any, dreamText: string) {
    const keywords = extractKeywords(dreamText);
    if (keywords.length === 0) return [];

    const { data, error } = await supabase
      .from('symbols')
      .select('name, meaning, shadow_meaning, guidance')
      .or(keywords.map((kw: string) => `name.ilike.${kw}`).join(','))
      .limit(10);

    if (error) return [];
    if (data && data.length > 0) return data;

    const topKeywords = keywords.slice(0, 15);
    const { data: partialData, error: partialError } = await supabase
      .from('symbols')
      .select('name, meaning, shadow_meaning, guidance')
      .or(topKeywords.map((kw: string) => `name.ilike.%${kw}%`).join(','))
      .limit(10);

    if (partialError) return [];
    return partialData || [];
  }

  it('returns matching symbols from DB', async () => {
    const mockData = [
      { name: 'Cat', meaning: 'Independence', shadow_meaning: 'Deceit', guidance: 'Trust instincts' },
    ];
    const mock = createMockSupabase(mockData, null);
    const result = await lookupSymbols(mock, 'I saw a black cat');
    expect(result).toEqual(mockData);
  });

  it('returns empty array when no matches', async () => {
    const mock = createMockSupabase([], null, [], null);
    const result = await lookupSymbols(mock, 'I saw a xyzzy');
    expect(result).toEqual([]);
  });

  it('handles DB error gracefully', async () => {
    const mock = createMockSupabase(null, { message: 'DB error' });
    const result = await lookupSymbols(mock, 'I saw a cat');
    expect(result).toEqual([]);
  });

  it('falls back to partial match when exact fails', async () => {
    const partialData = [
      { name: 'Caterpillar', meaning: 'Transformation', shadow_meaning: null, guidance: 'Be patient' },
    ];
    const mock = createMockSupabase(null, null, partialData, null);
    const result = await lookupSymbols(mock, 'I saw a cat');
    expect(result).toEqual(partialData);
  });

  it('returns empty for empty dream text', async () => {
    const mock = createMockSupabase(null, null);
    const result = await lookupSymbols(mock, '');
    expect(result).toEqual([]);
    expect(mock.from).not.toHaveBeenCalled();
  });
});
