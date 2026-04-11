/**
 * Tests for Dream Prompt helpers (edge function shared code)
 * @file src/lib/__tests__/dreamPrompt.test.ts
 *
 * buildUserPrompt and validateReading are pure functions with no Deno deps.
 * We inline them here to run in Jest/Node.js without esm.sh imports.
 */

// ---------------------------------------------------------------------------
// Inline types (mirrors dream-prompt.ts)
// ---------------------------------------------------------------------------

interface DreamerContext {
  mood?: string;
  zodiacSign?: string;
  gender?: string;
  ageRange?: string;
}

interface MatchedSymbolForPrompt {
  name: string;
  meaning: string;
  shadow_meaning: string | null;
  guidance: string | null;
}

// ---------------------------------------------------------------------------
// Inline buildUserPrompt (mirrors dream-prompt.ts)
// ---------------------------------------------------------------------------

function buildUserPrompt(
  dreamText: string,
  context?: DreamerContext,
  matchedSymbols?: MatchedSymbolForPrompt[]
): string {
  const contextParts: string[] = [];

  if (context?.mood) {
    contextParts.push(`The dreamer woke feeling: ${context.mood}`);
  }

  if (context?.zodiacSign) {
    contextParts.push(`Zodiac sign: ${context.zodiacSign}. Let this subtly inform your interpretation — weave in relevant archetypal themes naturally without explicitly naming the sign.`);
  }

  if (context?.gender) {
    const genderDisplay = context.gender.replace(/-/g, ' ');
    contextParts.push(`Gender identity: ${genderDisplay}. Let this subtly shape your interpretation without explicitly mentioning it in the reading.`);
  }

  if (context?.ageRange) {
    contextParts.push(`Life stage: ${context.ageRange} years. Let this subtly inform the themes you emphasize without explicitly stating the dreamer's age or life stage in the reading.`);
  }

  const contextSection = contextParts.length > 0
    ? `\n\nDreamer context:\n${contextParts.map(p => `- ${p}`).join('\n')}`
    : "";

  const symbolSection = matchedSymbols && matchedSymbols.length > 0
    ? `\n\nRelevant symbols from the dream dictionary (prefer these when applicable):\n${matchedSymbols.map((s) => `- ${s.name}: meaning: "${s.meaning}"${s.shadow_meaning ? ` | shadow: "${s.shadow_meaning}"` : ""}${s.guidance ? ` | guidance: "${s.guidance}"` : ""}`).join("\n")}`
    : "";

  return `Please interpret the following dream and return a JSON reading:

---
${dreamText.trim()}
---${contextSection}${symbolSection}

Remember: Return ONLY valid JSON matching the schema. No markdown, no extra text.`;
}

// ---------------------------------------------------------------------------
// Inline validateReading (mirrors dream-prompt.ts)
// ---------------------------------------------------------------------------

function validateReading(reading: unknown): { isValid: boolean; error?: string } {
  if (!reading || typeof reading !== "object") {
    return { isValid: false, error: "Reading must be an object" };
  }

  const r = reading as Record<string, unknown>;

  const requiredStrings = ["title", "tldr", "plain_english", "omen", "ritual", "journal_prompt"];
  for (const field of requiredStrings) {
    if (typeof r[field] !== "string" || !r[field]) {
      return { isValid: false, error: `Missing or invalid field: ${field}` };
    }
  }

  if ((r.tldr as string).length > 150) {
    return { isValid: false, error: "tldr exceeds 150 characters" };
  }

  if (!Array.isArray(r.symbols)) {
    return { isValid: false, error: "symbols must be an array" };
  }
  if (r.symbols.length < 1 || r.symbols.length > 3) {
    return { isValid: false, error: "symbols must have 1-3 items" };
  }

  for (let i = 0; i < r.symbols.length; i++) {
    const symbol = r.symbols[i] as Record<string, unknown>;
    const symbolFields = ["name", "meaning", "shadow", "guidance"];
    for (const field of symbolFields) {
      if (typeof symbol[field] !== "string" || !symbol[field]) {
        return {
          isValid: false,
          error: `Symbol ${i + 1} missing or invalid field: ${field}`,
        };
      }
    }
  }

  if (!Array.isArray(r.tags)) {
    return { isValid: false, error: "tags must be an array" };
  }
  if (r.tags.length < 3 || r.tags.length > 5) {
    return { isValid: false, error: "tags must have 3-5 items" };
  }
  for (const tag of r.tags) {
    if (typeof tag !== "string") {
      return { isValid: false, error: "All tags must be strings" };
    }
  }

  if (!Array.isArray(r.content_warnings)) {
    return { isValid: false, error: "content_warnings must be an array" };
  }
  for (const warning of r.content_warnings) {
    if (typeof warning !== "string") {
      return { isValid: false, error: "All content_warnings must be strings" };
    }
  }

  return { isValid: true };
}

// ---------------------------------------------------------------------------
// Valid reading fixture
// ---------------------------------------------------------------------------

const VALID_READING = {
  title: 'The Wandering Moon',
  tldr: 'A journey through the subconscious reveals hidden truths',
  plain_english: 'Your dream suggests you are seeking clarity in a confusing time.',
  symbols: [
    { name: 'Moon', meaning: 'Intuition', shadow: 'Hidden fears', guidance: 'Trust instincts' },
    { name: 'Water', meaning: 'Emotions', shadow: 'Overwhelm', guidance: 'Flow with it' },
  ],
  omen: 'Change approaches like a tide',
  ritual: 'Light a white candle at dusk',
  journal_prompt: 'What does the moon illuminate?',
  tags: ['lunar', 'water', 'journey'],
  content_warnings: [],
};

// ---------------------------------------------------------------------------
// buildUserPrompt tests
// ---------------------------------------------------------------------------

describe('buildUserPrompt', () => {
  it('builds basic prompt with dream text only', () => {
    const result = buildUserPrompt('I was flying over mountains');
    expect(result).toContain('I was flying over mountains');
    expect(result).toContain('Please interpret the following dream');
    expect(result).toContain('Return ONLY valid JSON');
    expect(result).not.toContain('Dreamer context');
  });

  it('includes mood when provided', () => {
    const result = buildUserPrompt('Test dream', { mood: 'Peaceful' });
    expect(result).toContain('The dreamer woke feeling: Peaceful');
    expect(result).toContain('Dreamer context');
  });

  it('includes zodiac context', () => {
    const result = buildUserPrompt('Test dream', { zodiacSign: 'Pisces' });
    expect(result).toContain('Zodiac sign: Pisces');
    expect(result).toContain('subtly inform');
  });

  it('includes gender context', () => {
    const result = buildUserPrompt('Test dream', { gender: 'non-binary' });
    expect(result).toContain('Gender identity: non binary');
    expect(result).toContain('subtly shape');
  });

  it('replaces hyphens in gender display', () => {
    const result = buildUserPrompt('Test dream', { gender: 'two-spirit' });
    expect(result).toContain('Gender identity: two spirit');
  });

  it('includes age range context', () => {
    const result = buildUserPrompt('Test dream', { ageRange: '25-34' });
    expect(result).toContain('Life stage: 25-34 years');
  });

  it('includes all context fields together', () => {
    const result = buildUserPrompt('Test dream', {
      mood: 'Curious',
      zodiacSign: 'Aries',
      gender: 'female',
      ageRange: '35-44',
    });
    expect(result).toContain('The dreamer woke feeling: Curious');
    expect(result).toContain('Zodiac sign: Aries');
    expect(result).toContain('Gender identity: female');
    expect(result).toContain('Life stage: 35-44 years');
  });

  it('appends matched symbols section when provided', () => {
    const symbols: MatchedSymbolForPrompt[] = [
      { name: 'Moon', meaning: 'Intuition and cycles', shadow_meaning: 'Hidden fears', guidance: 'Trust your instincts' },
    ];
    const result = buildUserPrompt('I saw the moon', undefined, symbols);
    expect(result).toContain('Relevant symbols from the dream dictionary');
    expect(result).toContain('Moon: meaning: "Intuition and cycles"');
    expect(result).toContain('shadow: "Hidden fears"');
    expect(result).toContain('guidance: "Trust your instincts"');
  });

  it('formats matched symbols with meaning/shadow/guidance', () => {
    const symbols: MatchedSymbolForPrompt[] = [
      { name: 'Cat', meaning: 'Independence', shadow_meaning: null, guidance: null },
    ];
    const result = buildUserPrompt('I saw a cat', undefined, symbols);
    expect(result).toContain('Cat: meaning: "Independence"');
    // null shadow/guidance should be omitted
    expect(result).not.toContain('shadow');
    expect(result).not.toContain('guidance');
  });

  it('omits symbol section when matchedSymbols is empty array', () => {
    const result = buildUserPrompt('Test dream', undefined, []);
    expect(result).not.toContain('Relevant symbols');
  });

  it('omits symbol section when matchedSymbols is undefined', () => {
    const result = buildUserPrompt('Test dream', undefined, undefined);
    expect(result).not.toContain('Relevant symbols');
  });

  it('trims dream text whitespace', () => {
    const result = buildUserPrompt('  I was flying  \n\n');
    expect(result).toContain('---\nI was flying\n---');
  });
});

// ---------------------------------------------------------------------------
// validateReading tests
// ---------------------------------------------------------------------------

describe('validateReading', () => {
  it('accepts valid complete reading', () => {
    expect(validateReading(VALID_READING)).toEqual({ isValid: true });
  });

  it('rejects null', () => {
    expect(validateReading(null).isValid).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateReading(undefined).isValid).toBe(false);
  });

  it('rejects non-object', () => {
    expect(validateReading('string').isValid).toBe(false);
  });

  it('rejects missing title', () => {
    const reading = { ...VALID_READING, title: '' };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('title');
  });

  it('rejects missing tldr', () => {
    const { tldr, ...noTldr } = VALID_READING;
    const result = validateReading(noTldr);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('tldr');
  });

  it('rejects tldr > 150 chars', () => {
    const reading = { ...VALID_READING, tldr: 'x'.repeat(151) };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('tldr exceeds 150');
  });

  it('accepts tldr exactly 150 chars', () => {
    const reading = { ...VALID_READING, tldr: 'x'.repeat(150) };
    expect(validateReading(reading).isValid).toBe(true);
  });

  it('rejects empty symbols array', () => {
    const reading = { ...VALID_READING, symbols: [] };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('symbols must have 1-3');
  });

  it('rejects symbols > 3', () => {
    const reading = {
      ...VALID_READING,
      symbols: [
        { name: 'A', meaning: 'm', shadow: 's', guidance: 'g' },
        { name: 'B', meaning: 'm', shadow: 's', guidance: 'g' },
        { name: 'C', meaning: 'm', shadow: 's', guidance: 'g' },
        { name: 'D', meaning: 'm', shadow: 's', guidance: 'g' },
      ],
    };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('symbols must have 1-3');
  });

  it('rejects symbol missing name', () => {
    const reading = {
      ...VALID_READING,
      symbols: [{ name: '', meaning: 'm', shadow: 's', guidance: 'g' }],
    };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Symbol 1');
    expect(result.error).toContain('name');
  });

  it('rejects symbol missing meaning', () => {
    const reading = {
      ...VALID_READING,
      symbols: [{ name: 'Moon', meaning: '', shadow: 's', guidance: 'g' }],
    };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('meaning');
  });

  it('rejects tags < 3', () => {
    const reading = { ...VALID_READING, tags: ['a', 'b'] };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('tags must have 3-5');
  });

  it('rejects tags > 5', () => {
    const reading = { ...VALID_READING, tags: ['a', 'b', 'c', 'd', 'e', 'f'] };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('tags must have 3-5');
  });

  it('rejects non-string tags', () => {
    const reading = { ...VALID_READING, tags: ['a', 'b', 123 as any] };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('All tags must be strings');
  });

  it('rejects non-array content_warnings', () => {
    const reading = { ...VALID_READING, content_warnings: 'string' as any };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('content_warnings must be an array');
  });

  it('rejects non-string content_warnings entries', () => {
    const reading = { ...VALID_READING, content_warnings: [42 as any] };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('All content_warnings must be strings');
  });

  it('accepts valid reading with plain_english', () => {
    expect(validateReading(VALID_READING).isValid).toBe(true);
  });

  it('rejects reading without plain_english (required by JSON contract)', () => {
    const { plain_english, ...noPE } = VALID_READING;
    const result = validateReading(noPE);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('plain_english');
  });

  it('rejects empty plain_english', () => {
    const reading = { ...VALID_READING, plain_english: '' };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('plain_english');
  });

  it('rejects non-string plain_english', () => {
    const reading = { ...VALID_READING, plain_english: 123 as any };
    const result = validateReading(reading);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('plain_english');
  });

  it('accepts reading with exactly 1 symbol', () => {
    const reading = {
      ...VALID_READING,
      symbols: [{ name: 'Moon', meaning: 'm', shadow: 's', guidance: 'g' }],
    };
    expect(validateReading(reading).isValid).toBe(true);
  });

  it('accepts reading with exactly 3 symbols', () => {
    const reading = {
      ...VALID_READING,
      symbols: [
        { name: 'A', meaning: 'm', shadow: 's', guidance: 'g' },
        { name: 'B', meaning: 'm', shadow: 's', guidance: 'g' },
        { name: 'C', meaning: 'm', shadow: 's', guidance: 'g' },
      ],
    };
    expect(validateReading(reading).isValid).toBe(true);
  });

  it('rejects missing omen', () => {
    const { omen, ...noOmen } = VALID_READING;
    const result = validateReading(noOmen);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('omen');
  });

  it('rejects missing ritual', () => {
    const { ritual, ...noRitual } = VALID_READING;
    const result = validateReading(noRitual);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('ritual');
  });

  it('rejects missing journal_prompt', () => {
    const { journal_prompt, ...noJP } = VALID_READING;
    const result = validateReading(noJP);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('journal_prompt');
  });
});
