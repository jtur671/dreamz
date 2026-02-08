/**
 * Dream Analysis Edge Function
 *
 * Analyzes dream text using OpenAI GPT-4 and returns a structured mystical reading.
 * Implements retry logic, validation, and graceful fallback.
 *
 * Endpoint: POST /functions/v1/analyze-dream
 * Auth: Required (Supabase JWT in Authorization header)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  validateReading,
  FALLBACK_READING,
  type DreamReadingSchema,
  type DreamerContext,
} from "../_shared/dream-prompt.ts";

// ============================================================================
// Types
// ============================================================================

interface AnalyzeRequest {
  dream_text: string;
  mood?: string;
  dream_id?: string;
  zodiac_sign?: string;
  gender?: string;
  age_range?: string;
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  error?: {
    message: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_MODEL = "gpt-5-mini-2025-08-07";
const OPENAI_IMAGE_MODEL = "dall-e-3";
const MAX_RETRIES = 2; // Initial attempt + 1 retry
const REQUEST_TIMEOUT_MS = 30000;
const IMAGE_TIMEOUT_MS = 60000;
const MAX_DREAM_TEXT_LENGTH = 10000;
const MIN_DREAM_TEXT_LENGTH = 10;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calls the OpenAI API with the given messages
 */
async function callOpenAI(
  messages: OpenAIMessage[],
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data: OpenAIResponse = await response.json();

    if (data.error) {
      throw new Error(`OpenAI error: ${data.error.message}`);
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI");
    }

    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI request timed out");
    }
    throw error;
  }
}

/**
 * Generates a dreamy image based on the actual dream content
 */
async function generateDreamImage(
  dreamText: string,
  reading: DreamReadingSchema,
  apiKey: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    // Extract key visual elements from the dream text (first 200 chars for safety)
    const dreamSnippet = dreamText.slice(0, 200);
    const symbolName = reading.symbols[0]?.name || "mysterious vision";

    // Create an image prompt that closely matches the dream content
    const imagePrompt = `Surreal dreamscape painting: ${dreamSnippet}. Central focus on ${symbolName}. Style: ethereal digital art, soft glowing light, dreamy atmosphere, muted purples and blues, magical realism. Painterly, atmospheric, evocative. No text, no words, no letters.`;

    const response = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Image generation failed (${response.status}): ${errorBody}`);
      return null;
    }

    const data = await response.json();

    if (data.data && data.data[0] && data.data[0].url) {
      return data.data[0].url;
    }

    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Image generation error: ${error instanceof Error ? error.message : "Unknown"}`);
    return null;
  }
}

/**
 * Parses and validates the AI response, attempting to extract valid JSON
 */
function parseAIResponse(content: string): DreamReadingSchema | null {
  // Try to parse the content directly
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    // If direct parsing fails, try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim());
      } catch {
        return null;
      }
    } else {
      // Try to find JSON object in the content
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          parsed = JSON.parse(objectMatch[0]);
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }
  }

  // Validate the parsed content
  const validation = validateReading(parsed);
  if (!validation.isValid) {
    console.error(`Validation failed: ${validation.error}`);
    return null;
  }

  return parsed as DreamReadingSchema;
}

/**
 * Validates the request body
 */
function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: AnalyzeRequest;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.dream_text !== "string") {
    return { valid: false, error: "dream_text is required and must be a string" };
  }

  const dreamText = req.dream_text.trim();

  if (dreamText.length < MIN_DREAM_TEXT_LENGTH) {
    return {
      valid: false,
      error: `dream_text must be at least ${MIN_DREAM_TEXT_LENGTH} characters`,
    };
  }

  if (dreamText.length > MAX_DREAM_TEXT_LENGTH) {
    return {
      valid: false,
      error: `dream_text must not exceed ${MAX_DREAM_TEXT_LENGTH} characters`,
    };
  }

  if (req.mood !== undefined && typeof req.mood !== "string") {
    return { valid: false, error: "mood must be a string if provided" };
  }

  if (req.dream_id !== undefined && typeof req.dream_id !== "string") {
    return { valid: false, error: "dream_id must be a string if provided" };
  }

  if (req.zodiac_sign !== undefined && typeof req.zodiac_sign !== "string") {
    return { valid: false, error: "zodiac_sign must be a string if provided" };
  }

  if (req.gender !== undefined && typeof req.gender !== "string") {
    return { valid: false, error: "gender must be a string if provided" };
  }

  if (req.age_range !== undefined && typeof req.age_range !== "string") {
    return { valid: false, error: "age_range must be a string if provided" };
  }

  return {
    valid: true,
    data: {
      dream_text: dreamText,
      mood: req.mood as string | undefined,
      emotions: req.emotions as string[] | undefined,
      dream_id: req.dream_id as string | undefined,
      zodiac_sign: req.zodiac_sign as string | undefined,
      gender: req.gender as string | undefined,
      age_range: req.age_range as string | undefined,
    },
  };
}

/**
 * Updates the dream record with the reading
 */
async function updateDreamWithReading(
  supabase: ReturnType<typeof createClient>,
  dreamId: string,
  userId: string,
  reading: DreamReadingSchema
): Promise<void> {
  const { error } = await supabase
    .from("dreams")
    .update({
      reading,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dreamId)
    .eq("user_id", userId);

  if (error) {
    // Log error but don't fail the request - the reading was still generated
    console.error(`Failed to update dream record: ${error.message}`);
  }
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  // Generate correlation ID for request tracing (never log dream content)
  const correlationId = crypto.randomUUID();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // Only accept POST
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
  }

  try {
    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error(`[${correlationId}] OPENAI_API_KEY not configured`);
      return errorResponse(
        "CONFIG_ERROR",
        "Service configuration error",
        500,
        true
      );
    }

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`[${correlationId}] Supabase credentials not configured`);
      return errorResponse(
        "CONFIG_ERROR",
        "Service configuration error",
        500,
        true
      );
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("UNAUTHORIZED", "Missing authorization header", 401);
    }

    // Create Supabase client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error(`[${correlationId}] Auth error: ${authError?.message || "No user"}`);
      return errorResponse("UNAUTHORIZED", "Invalid or expired token", 401);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
    }

    const validation = validateRequest(body);
    if (!validation.valid || !validation.data) {
      return errorResponse("VALIDATION_ERROR", validation.error!, 400);
    }

    const { dream_text, mood, emotions, dream_id, zodiac_sign, gender, age_range } = validation.data;

    // Build dreamer context for personalized interpretation
    const dreamerContext: DreamerContext = {
      mood,
      emotions,
      zodiacSign: zodiac_sign,
      gender,
      ageRange: age_range,
    };

    // Build messages for OpenAI
    const messages: OpenAIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(dream_text, dreamerContext) },
    ];

    // Attempt to get reading with retry
    let reading: DreamReadingSchema | null = null;
    let lastError: string | null = null;
    let usedFallback = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`[${correlationId}] OpenAI attempt ${attempt + 1}/${MAX_RETRIES}`);
        const aiResponse = await callOpenAI(messages, openaiApiKey);
        reading = parseAIResponse(aiResponse);

        if (reading) {
          console.log(`[${correlationId}] Successfully parsed reading on attempt ${attempt + 1}`);
          break;
        } else {
          lastError = "Failed to parse AI response as valid reading";
          console.error(`[${correlationId}] ${lastError}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
        console.error(`[${correlationId}] OpenAI attempt ${attempt + 1} failed: ${lastError}`);
      }

      // Brief delay before retry (exponential backoff: 1s, 2s)
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Use fallback if all attempts failed
    if (!reading) {
      console.error(
        `[${correlationId}] All attempts failed, using fallback reading. Last error: ${lastError}`
      );
      reading = FALLBACK_READING;
      usedFallback = true;
    }

    // Generate a dreamy image based on the actual dream content
    console.log(`[${correlationId}] Generating dream image...`);
    const imageUrl = await generateDreamImage(dream_text, reading, openaiApiKey);
    if (imageUrl) {
      console.log(`[${correlationId}] Image generated successfully`);
    } else {
      console.log(`[${correlationId}] Image generation skipped or failed`);
    }

    // Build final reading with image
    const finalReading = {
      ...reading,
      ...(imageUrl && { image_url: imageUrl }),
    };

    // Update dream record if dream_id provided
    if (dream_id) {
      await updateDreamWithReading(supabase, dream_id, user.id, finalReading);
    }

    // Return successful response
    return jsonResponse({
      success: true,
      reading: {
        ...finalReading,
        timestamp: new Date().toISOString(),
        ...(usedFallback && { fallback: true }),
      },
    });
  } catch (error) {
    // Catch-all error handler
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${correlationId}] Unexpected error: ${message}`);

    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again.",
      500,
      true
    );
  }
});
