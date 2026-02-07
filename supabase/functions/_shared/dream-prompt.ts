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
  "plain_english": "string (3-5 sentence conversational explanation in simple everyday language - no mystical terms, just friendly accessible interpretation using 'might', 'may', 'could suggest')",
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

## Plain English Field Guidelines
The plain_english field should read like advice from a thoughtful friend:
- Use everyday language, no mystical vocabulary
- Frame as possibilities: "might signify", "could represent", "may indicate"
- Explain the dream's potential meaning in practical, relatable terms
- Example: "The dream might signify that you are longing for comfort and taking things slow in your life. The turtle typically represents patience, resilience and longevity whereas pizza is usually affiliated with pleasure and comfort food."

## Symbol Requirements
- Include exactly ONE symbol - the most significant element from the dream
- The "interpretation" field should be plain English, conversational, specific to this dream
- Identify the most powerful symbol: could be concrete (water, house, animal) or abstract (falling, being chased)
- Balance universal archetypal meanings with personal interpretation space

## Content Warnings
Include when dreams contain: violence, death imagery, sexual content, self-harm themes, abuse references, specific phobias, intense grief. Use clear terms like: "death imagery", "violence", "sexual content"

## Validation
Before responding, verify:
- All required fields are present (including plain_english)
- Strings are properly escaped
- No trailing commas
- Arrays are properly formatted
- JSON parses successfully
- symbols array has exactly 1 item
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

/**
 * Builds the user message for the dream interpretation request
 *
 * @param dreamText - The dream narrative from the user
 * @param context - Optional context about the dreamer (mood, zodiac, gender, age)
 * @returns Formatted user prompt string
 */
export function buildUserPrompt(dreamText: string, context?: DreamerContext): string {
  const contextParts: string[] = [];

  if (context?.mood) {
    contextParts.push(`The dreamer woke feeling: ${context.mood}`);
  }

  if (context?.zodiacSign) {
    contextParts.push(`Zodiac sign: ${context.zodiacSign}. Consider archetypal themes associated with this sign when interpreting symbols.`);
  }

  if (context?.gender) {
    const genderDisplay = context.gender.replace(/-/g, ' ');
    contextParts.push(`Gender identity: ${genderDisplay}. Be mindful of how symbols may resonate differently based on gender experience.`);
  }

  if (context?.ageRange) {
    contextParts.push(`Life stage: ${context.ageRange} years. Consider how this life phase may inform the dream's themes and symbols.`);
  }

  const contextSection = contextParts.length > 0
    ? `\n\nDreamer context:\n${contextParts.map(p => `- ${p}`).join('\n')}`
    : "";

  return `Please interpret the following dream and return a JSON reading:

---
${dreamText.trim()}
---${contextSection}

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
