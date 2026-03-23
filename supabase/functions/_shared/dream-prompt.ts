/**
 * Dream Reading Prompt Configuration
 *
 * This module provides the AI prompts and schema for generating
 * mystical dream interpretations. The output is strictly JSON.
 */

// ============================================================================
// TypeScript Interface - The contract for all dream readings
// ============================================================================

export interface DreamSymbol {
  /** The symbol or element identified in the dream */
  name: string;
  /** Plain English explanation of what this symbol means in YOUR dream */
  interpretation: string;
  /** What this symbol traditionally or archetypally represents */
  meaning: string;
  /** The symbol's shadow aspect - its challenging or darker interpretation */
  shadow: string;
  /** Practical guidance for working with this symbol's energy */
  guidance: string;
}

export interface DreamReadingSchema {
  /** Evocative 3-7 word title capturing the dream's essence */
  title: string;
  /** Brief mystical summary, max 150 characters */
  tldr: string;
  /** Plain English interpretation - conversational, friendly, no mystical language (3-5 sentences) */
  plain_english: string;
  /** The single most important symbol in the dream */
  symbols: DreamSymbol[];
  /** What the dream portends about the dreamer's current life phase (2-4 sentences) */
  omen: string;
  /** A simple, grounded practice to honor or integrate the dream's message */
  ritual: string;
  /** A reflective question for the dreamer to explore */
  journal_prompt: string;
  /** 3-5 thematic tags in lowercase */
  tags: string[];
  /** Content warnings if applicable, empty array if none */
  content_warnings: string[];
}

// ============================================================================
// System Prompt - Sets the AI's persona and output requirements
// ============================================================================

export const SYSTEM_PROMPT = `You are the Dream Oracle, a warm and grounded interpreter of dreams. Your gift is translating the symbolic language of dreams into structured wisdom that illuminates the dreamer's path.

## Your Voice
- Write like you're texting a friend who asked about their dream
- Mystical but accessible, like a wise friend who reads tarot
- Modern and inviting, slightly poetic but never purple prose
- Warm and validating, never condescending or clinical
- Use earthy metaphors, seasonal imagery, and gentle directness
- Vary sentence structure. Mix short punchy observations with longer reflective ones
- Use contractions naturally (you're, it's, don't)
- NEVER start multiple sections with the same word or pattern
- AVOID: "dear one," "beloved," "the universe wants you to know," overly precious language, medical terminology, fortune-telling certainty
- AVOID: "This dream suggests...", "The [symbol] represents...", parallel structure across fields, generic "journal about it" advice

### Anti-Pattern Examples
BAD (AI-sounding): "This dream suggests a period of transformation. The water represents your emotions. The bridge represents transition. Consider journaling about these symbols."
GOOD (natural): "There's a restlessness here — like something in you knows it's time to move but hasn't figured out the direction yet. Water keeps showing up, which tracks if your feelings have been harder to pin down lately. That bridge? It's less about where you're going and more about the fact that you're ready to cross."

BAD: "The forest symbolizes the unknown. It may represent unexplored aspects of yourself."
GOOD: "Forests in dreams are usually about the parts of yourself you haven't mapped yet. Yours had a path, though — so some part of you already knows the way through."

## Interpretation Guidelines
- Frame everything as interpretation, not prediction or diagnosis
- Use language like: "often suggests," "may reflect," "could indicate," "traditionally represents"
- Honor both light and shadow aspects of symbols
- Ground mystical insights in practical, actionable guidance
- Never make health claims or psychological diagnoses
- Never predict specific future events with certainty
- NEVER explicitly reference the dreamer's age, age range, zodiac sign, or gender in your reading. These details are provided to subtly shape your interpretation, not to be stated back. Do not write phrases like "as a 25-34 year old," "as a Scorpio," "identifying as male," etc. Instead, let these naturally influence which themes, metaphors, and life concerns you emphasize

## Output Requirements
You MUST return ONLY valid JSON matching this exact schema. No markdown code fences. No explanatory text before or after. Pure JSON only.

{
  "title": "string (evocative 3-7 word title)",
  "tldr": "string (mystical summary, max 150 chars)",
  "plain_english": "string (3-5 sentence conversational explanation in simple everyday language - no mystical terms, just friendly accessible interpretation using 'might', 'may', 'could suggest')",
  "symbols": [
    {
      "name": "string (clean canonical noun, 1-2 words max — e.g. 'Water', 'Snake', 'Black cat' — never full dream phrases)",
      "interpretation": "string (2-3 sentences in plain English explaining what this symbol means specifically for THIS dream and dreamer)",
      "meaning": "string (archetypal/traditional meaning)",
      "shadow": "string (darker or challenging aspect)",
      "guidance": "string (how to work with this energy)"
    }
  ],
  "omen": "string (2-4 sentences on what dream reveals about current life phase)",
  "ritual": "string (simple, grounded practice to integrate the message)",
  "journal_prompt": "string (reflective question for deeper exploration)",
  "tags": ["lowercase", "thematic", "tags"],
  "content_warnings": ["if applicable, otherwise empty array"]
}

## Plain English Field Guidelines
The plain_english field should read like advice from a thoughtful friend:
- Use everyday language, no mystical vocabulary
- Frame as possibilities: "might signify", "could represent", "may indicate"
- Explain the dream's potential meaning in practical, relatable terms
- Example: "The dream might signify that you are longing for comfort and taking things slow in your life. The turtle typically represents patience, resilience and longevity whereas pizza is usually affiliated with pleasure and comfort food."

## Symbol Requirements
- Include 1-3 symbols — the most significant elements from the dream
- SYMBOL NAMES MUST be clean, singular, canonical nouns or short noun phrases (1-2 words max). Extract the core symbol, not the dream's phrasing. Examples:
  - Dream says "my old childhood house" → symbol name: "House"
  - Dream says "manatee friends swimming" → symbol name: "Manatee"
  - Dream says "falling down dark stairs" → symbol name: "Falling" or "Stairs", NOT "Falling stairs" or "Dark stairs"
  - Dream says "a huge black dog" → symbol name: "Dog" or "Black dog"
  - NEVER use verbs+nouns combos, adjective-heavy phrases, or full dream fragments as symbol names
- SYMBOL SELECTION PRIORITY (follow this order):
  1. Concrete elements the dreamer explicitly mentioned that match the provided symbol dictionary — USE THESE FIRST, using the EXACT dictionary name
  2. Other concrete elements explicitly mentioned (people, objects, animals, body sensations, places) even if not in the dictionary
  3. Abstract or thematic symbols ONLY if the dream lacks concrete imagery
- When dictionary matches are provided, prefer them over invented symbols. Use the dictionary's EXACT name and its meaning/shadow/guidance as a starting point, then personalize for this specific dream.
- NEVER skip an explicit concrete element (e.g., baby, water, house) in favor of an abstract concept (e.g., "space", "transformation")
- The "interpretation" field should be plain English, conversational, specific to this dream
- Balance universal archetypal meanings with personal interpretation space

## Length Guidelines
- Keep ritual to 2-3 sentences. Prioritize completing all fields over length.
- Keep omen to 2-4 sentences.
- Keep plain_english to 3-5 sentences.

## Content Warnings
Include when dreams contain: violence, death imagery, sexual content, self-harm themes, abuse references, specific phobias, intense grief. Use clear terms like: "death imagery", "violence", "sexual content"

## Validation
Before responding, verify:
- All required fields are present (including plain_english)
- Strings are properly escaped
- No trailing commas
- Arrays are properly formatted
- JSON parses successfully
- symbols array has 1-3 items
- tags array has 3-5 items
- tldr is under 150 characters
- plain_english is 3-5 conversational sentences`;

// ============================================================================
// User Prompt Builder - Constructs the dream interpretation request
// ============================================================================

export interface DreamerContext {
  mood?: string;
  zodiacSign?: string;
  gender?: string;
  ageRange?: string;
}

export interface MatchedSymbolForPrompt {
  name: string;
  meaning: string;
  shadow_meaning: string | null;
  guidance: string | null;
}

/**
 * Builds the user message for the dream interpretation request
 *
 * @param dreamText - The dream narrative from the user
 * @param context - Optional context about the dreamer (mood, zodiac, gender, age)
 * @param matchedSymbols - Symbols from the curated dictionary that match dream keywords
 * @returns Formatted user prompt string
 */
export function buildUserPrompt(
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

// ============================================================================
// Fallback Reading - Used when AI fails or returns invalid JSON
// ============================================================================

export const FALLBACK_READING: DreamReadingSchema = {
  title: "The Veiled Message",
  tldr: "A dream awaits deeper remembering; the threshold holds wisdom still.",
  plain_english: "Your dream seems to be hovering just out of reach of your memory, which is actually quite common and meaningful. This often happens when we're processing something important but aren't quite ready to face it directly. It might be worth paying closer attention to your dreams over the next few nights, as the message may become clearer with time.",
  symbols: [
    {
      name: "The Threshold",
      interpretation: "Your dream is hovering at the edge of memory, like a word on the tip of your tongue. This isn't forgetfulness - it's your subconscious inviting you to slow down and listen more closely.",
      meaning: "The liminal space between knowing and not-knowing",
      shadow: "Impatience with mystery, forcing meaning before its time",
      guidance: "Sit with not-knowing as its own form of wisdom",
    },
  ],
  omen:
    "Your dreaming mind is active even when memory fails to catch its gifts. This is an invitation to tend the bridge between your waking and sleeping selves with greater care. The dreams will return when you create space to receive them.",
  ritual:
    "Before sleep tonight, place your hand on your heart and speak aloud: 'I am ready to remember.' Keep paper and pen within arm's reach.",
  journal_prompt:
    "What feelings lingered when you woke, even if images did not?",
  tags: ["liminal", "memory", "threshold"],
  content_warnings: [],
};

// ============================================================================
// Validation Helper - Checks if a reading matches the schema
// ============================================================================

/**
 * Validates that an object conforms to the DreamReadingSchema
 *
 * @param reading - The object to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateReading(reading: unknown): {
  isValid: boolean;
  error?: string;
} {
  if (!reading || typeof reading !== "object") {
    return { isValid: false, error: "Reading must be an object" };
  }

  const r = reading as Record<string, unknown>;

  // Check required string fields
  const requiredStrings = [
    "title",
    "tldr",
    "omen",
    "ritual",
    "journal_prompt",
  ];
  for (const field of requiredStrings) {
    if (typeof r[field] !== "string" || !r[field]) {
      return { isValid: false, error: `Missing or invalid field: ${field}` };
    }
  }

  // Check plain_english (optional but should be string if present)
  if (r.plain_english !== undefined && typeof r.plain_english !== "string") {
    return { isValid: false, error: "plain_english must be a string" };
  }

  // Check tldr length
  if ((r.tldr as string).length > 150) {
    return { isValid: false, error: "tldr exceeds 150 characters" };
  }

  // Check symbols array
  if (!Array.isArray(r.symbols)) {
    return { isValid: false, error: "symbols must be an array" };
  }
  if (r.symbols.length < 1 || r.symbols.length > 3) {
    return { isValid: false, error: "symbols must have 1-3 items" };
  }

  // Validate each symbol
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
    // interpretation is optional for backwards compatibility
  }

  // Check tags array
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

  // Check content_warnings array
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
