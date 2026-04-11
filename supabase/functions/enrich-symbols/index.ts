/**
 * Symbol Enrichment Edge Function
 *
 * Takes a batch of dream symbols (name + meaning) and uses OpenAI to generate
 * shadow_meaning, guidance, category, and related_symbols for each.
 *
 * Endpoint: POST /functions/v1/enrich-symbols
 * Auth: Required (service_role key)
 */

import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-5-nano";
const REQUEST_TIMEOUT_MS = 120000;
const MAX_BATCH_SIZE = 20;

interface SymbolInput {
  name: string;
  meaning: string;
}

interface EnrichedSymbol {
  name: string;
  shadow_meaning: string;
  guidance: string;
  category: string;
  related_symbols: string[];
}

const SYSTEM_PROMPT = `You are a dream symbol expert creating entries for a mystical dream dictionary app.

For each symbol, generate:
- shadow_meaning: The challenging, dark, or unconscious aspect (1-2 sentences, mystical tone)
- guidance: A reflective question or gentle direction for the dreamer (1 sentence, warm tone)
- category: One of: nature, celestial, animal, action, body, object, place, person, theme
- related_symbols: Array of 3-5 related dream symbol names (just the names, capitalized)

Rules:
- Keep shadow_meaning concise but evocative
- Guidance should be a question or gentle suggestion
- Category must be exactly one of the listed options
- related_symbols should be common dream symbols that thematically connect

Respond with a JSON array of objects matching this exact structure:
[{"name": "...", "shadow_meaning": "...", "guidance": "...", "category": "...", "related_symbols": ["...", "..."]}]

Return ONLY the JSON array, no markdown, no explanation.`;

async function callOpenAI(
  symbols: SymbolInput[],
  apiKey: string
): Promise<EnrichedSymbol[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const userPrompt = symbols
    .map((s) => `- ${s.name}: ${s.meaning.slice(0, 200)}`)
    .join("\n");

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Enrich these ${symbols.length} dream symbols:\n\n${userPrompt}`,
          },
        ],
        max_completion_tokens: 16000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      const finishReason = data.choices?.[0]?.finish_reason;
      throw new Error(
        finishReason === "length"
          ? "Response truncated (token limit exceeded)"
          : "No content in OpenAI response"
      );
    }

    // Parse JSON from response (handle markdown code blocks)
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse OpenAI response as JSON");
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    return parsed as EnrichedSymbol[];
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
  }

  try {
    // Restrict to admin (service_role key) only
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500);
    }

    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    // SHA-256 both sides so timingSafeEqual always compares fixed-length (32-byte)
    // buffers. This eliminates the length side-channel from an early byteLength check
    // and keeps the comparison constant-time regardless of input length.
    const encoder = new TextEncoder();
    const hashA = await crypto.subtle.digest("SHA-256", encoder.encode(authHeader || ""));
    const hashB = await crypto.subtle.digest("SHA-256", encoder.encode(serviceRoleKey));
    const isValid = crypto.subtle.timingSafeEqual(hashA, hashB);
    if (!isValid) {
      return errorResponse("FORBIDDEN", "Admin access required", 403);
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY not configured");
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
    }

    const { symbols } = body as { symbols?: SymbolInput[] };

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return errorResponse("VALIDATION_ERROR", "symbols array is required", 400);
    }

    if (symbols.length > MAX_BATCH_SIZE) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Maximum batch size is ${MAX_BATCH_SIZE}`,
        400
      );
    }

    const enriched = await callOpenAI(symbols, openaiApiKey);

    return jsonResponse({
      success: true,
      symbols: enriched,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Enrich error: ${message}`);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500, true);
  }
});
