/**
 * Dream Analysis Edge Function
 *
 * Analyzes dream text using OpenAI GPT-5.4 and returns a structured mystical reading.
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
import { lookupSymbols } from "../_shared/symbol-lookup.ts";

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
const MAX_RETRIES = 2; // Initial attempt + 1 retry
const MAX_DREAM_TEXT_LENGTH = 10000;
const MIN_DREAM_TEXT_LENGTH = 10;

// GPT-5.4 family: faster than gpt-5-mini (no reasoning overhead), JSON mode enabled.
// Free: gpt-5.4-nano (~$0.0016/reading) — fastest, 33% cheaper than old gpt-5-mini.
// Premium: gpt-5.4-mini (~$0.006/reading) — higher quality for paying users.
const MODEL_CONFIG = {
  free: { model: "gpt-5.4-nano", maxCompletionTokens: 2500, timeoutMs: 30000 },
  premium: { model: "gpt-5.4-mini", maxCompletionTokens: 4000, timeoutMs: 45000 },
} as const;

type SubscriptionTier = keyof typeof MODEL_CONFIG;


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calls the OpenAI API with the given messages using tier-appropriate model config
 */
interface OpenAIResult {
  content: string;
  finishReason: string;
}

async function callOpenAI(
  messages: OpenAIMessage[],
  apiKey: string,
  config: typeof MODEL_CONFIG[SubscriptionTier]
): Promise<OpenAIResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_completion_tokens: config.maxCompletionTokens,
        response_format: { type: "json_object" },
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

    return {
      content: data.choices[0].message.content,
      finishReason: data.choices[0].finish_reason || 'stop',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OpenAI request timed out");
    }
    throw error;
  }
}

/**
 * Attempts to close truncated JSON by counting open braces/brackets
 */
function attemptCloseJson(text: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of text) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }

  // If we're mid-string, close it
  if (inString) text += '"';

  // Close any open brackets/braces
  for (let i = 0; i < openBrackets; i++) text += ']';
  for (let i = 0; i < openBraces; i++) text += '}';

  return text;
}

/**
 * Parses and validates the AI response, attempting to extract valid JSON
 */
function parseAIResponse(content: string, finishReason: string): DreamReadingSchema | null {
  let textToParse = content;

  // If truncated (finish_reason === 'length'), try to close the JSON gracefully
  if (finishReason === 'length') {
    console.warn('Response truncated (finish_reason=length), attempting to close JSON');
    textToParse = attemptCloseJson(textToParse);
  }

  // Try to parse the content directly
  let parsed: unknown;

  try {
    parsed = JSON.parse(textToParse);
  } catch {
    // If direct parsing fails, try to extract JSON from markdown code blocks
    const jsonMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim());
      } catch {
        return null;
      }
    } else {
      // Try to find JSON object in the content
      const objectMatch = textToParse.match(/\{[\s\S]*\}/);
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`[${correlationId}] Supabase credentials not configured`);
      return errorResponse(
        "CONFIG_ERROR",
        "Service configuration error",
        500,
        true
      );
    }

    if (!supabaseServiceKey) {
      console.error(`[${correlationId}] SUPABASE_SERVICE_ROLE_KEY not configured`);
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500, true);
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

    const { dream_text, mood, dream_id, zodiac_sign, gender, age_range } = validation.data;

    // Reject 'forgot' dream type entries — they should not be analyzed
    const reqBody = body as Record<string, unknown>;
    if (reqBody.dream_type === 'forgot') {
      return errorResponse(
        "VALIDATION_ERROR",
        "Forgot-type dreams do not require analysis",
        400
      );
    }

    // Determine subscription tier for model selection
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, ai_consent_granted")
      .eq("id", user.id)
      .single();

    if (!profile?.ai_consent_granted) {
      return errorResponse("CONSENT_REQUIRED", "AI consent must be granted before dream analysis. Enable it in Settings.", 403);
    }

    const tier: SubscriptionTier = profile?.subscription_tier === "premium" ? "premium" : "free";
    const modelConfig = MODEL_CONFIG[tier];
    console.log(`[${correlationId}] Using model ${modelConfig.model} for ${tier} tier`);

    // Rate limiting via reading_log (tamper-proof — not affected by dream deletion)
    // Free: 1 reading per day | Premium: 30 readings per calendar month
    const adminClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
    );

    if (tier === "free") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayCount, error: countError } = await adminClient
        .from("reading_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString());

      if (!countError && (todayCount ?? 0) >= 1) {
        console.log(`[${correlationId}] Free tier daily limit reached`);
        return errorResponse(
          "RATE_LIMIT_EXCEEDED",
          "You've used your free reading for today. Upgrade to premium for up to 30 readings per month.",
          429
        );
      }
    } else {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count: monthCount, error: countError } = await adminClient
        .from("reading_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart.toISOString());

      if (!countError && (monthCount ?? 0) >= 30) {
        console.log(`[${correlationId}] Premium monthly limit reached`);
        return errorResponse(
          "RATE_LIMIT_EXCEEDED",
          "You've reached your 30 readings for this month. Your limit resets on the 1st.",
          429
        );
      }
    }

    // Build dreamer context for personalized interpretation
    const dreamerContext: DreamerContext = {
      mood,
      zodiacSign: zodiac_sign,
      gender,
      ageRange: age_range,
    };

    // Look up matching symbols from the curated dictionary
    const matchedSymbols = await lookupSymbols(supabase, dream_text);
    console.log(`[${correlationId}] Matched ${matchedSymbols.length} symbols from dictionary`);

    // Build messages for OpenAI
    const messages: OpenAIMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(dream_text, dreamerContext, matchedSymbols) },
    ];

    // Attempt to get reading with retry
    let reading: DreamReadingSchema | null = null;
    let lastError: string | null = null;
    let usedFallback = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`[${correlationId}] OpenAI attempt ${attempt + 1}/${MAX_RETRIES} (${modelConfig.model})`);
        const aiResponse = await callOpenAI(messages, openaiApiKey, modelConfig);
        reading = parseAIResponse(aiResponse.content, aiResponse.finishReason);

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

    // Update dream record if dream_id provided
    if (dream_id) {
      await updateDreamWithReading(supabase, dream_id, user.id, reading);
    }

    // Log the reading for rate limiting (uses service_role to bypass RLS)
    await adminClient.rpc("log_reading", { p_user_id: user.id });

    // Return reading immediately (image generated separately via generate-dream-image)
    return jsonResponse({
      success: true,
      reading: {
        ...reading,
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
