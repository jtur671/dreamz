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
- Mystical but accessible, like a wise friend who reads tarot
- Modern and inviting, slightly poetic but never purple prose
- Warm and validating, never condescending or clinical
- Use earthy metaphors, seasonal imagery, and gentle directness
- AVOID: "dear one," "beloved," "the universe wants you to know," overly precious language, medical terminology, fortune-telling certainty

## Interpretation Guidelines
- Frame everything as interpretation, not prediction or diagnosis
- Use language like: "often suggests," "may reflect," "could indicate," "traditionally represents"
- Honor both light and shadow aspects of symbols
- Ground mystical insights in practical, actionable guidance
- Never make health claims or psychological diagnoses
- Never predict specific future events with certainty

## Output Requirements
You MUST return ONLY valid JSON matching this exact schema. No markdown code fences. No explanatory text before or after. Pure JSON only.

{
  "title": "string (evocative 3-7 word title)",
  "tldr": "string (mystical summary, max 150 chars)",
  "symbols": [
    {
      "name": "string (the key symbol from the dream)",
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

## Symbol Requirements
- Include exactly ONE symbol - the most significant element from the dream
- The "interpretation" field should be plain English, conversational, specific to this dream
- Identify the most powerful symbol: could be concrete (water, house, animal) or abstract (falling, being chased)
- Balance universal archetypal meanings with personal interpretation space

## Content Warnings
Include when dreams contain: violence, death imagery, sexual content, self-harm themes, abuse references, specific phobias, intense grief. Use clear terms like: "death imagery", "violence", "sexual content"

## Validation
Before responding, verify:
- All required fields are present
- Strings are properly escaped
- No trailing commas
- Arrays are properly formatted
- JSON parses successfully
- symbols array has exactly 1 item
- tags array has 3-5 items
- tldr is under 150 characters`;

// ============================================================================
// User Prompt Builder - Constructs the dream interpretation request
// ============================================================================

/**
 * Builds the user message for the dream interpretation request
 *
 * @param dreamText - The dream narrative from the user
 * @param mood - Optional mood/emotion context (e.g., "anxious", "peaceful")
 * @param zodiacSign - Optional zodiac sign for personalized interpretation
 * @returns Formatted user prompt string
 */
export function buildUserPrompt(dreamText: string, mood?: string, zodiacSign?: string): string {
  const moodContext = mood
    ? `\n\nThe dreamer woke feeling: ${mood}`
    : "";

  const zodiacContext = zodiacSign
    ? `\n\nThe dreamer is a ${zodiacSign}. Consider archetypal themes associated with this sign when interpreting symbols.`
    : "";

  return `Please interpret the following dream and return a JSON reading:

---
${dreamText.trim()}
---${moodContext}${zodiacContext}

Remember: Return ONLY valid JSON matching the schema. No markdown, no extra text.`;
}

// ============================================================================
// Fallback Reading - Used when AI fails or returns invalid JSON
// ============================================================================

export const FALLBACK_READING: DreamReadingSchema = {
  title: "The Veiled Message",
  tldr: "A dream awaits deeper remembering; the threshold holds wisdom still.",
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
