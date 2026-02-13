/**
 * Generate Dream Image Edge Function
 *
 * Generates a DALL-E image for a dream and updates the dream record.
 * Called asynchronously after the reading is displayed.
 *
 * Endpoint: POST /functions/v1/generate-dream-image
 * Auth: Required (Supabase JWT)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_MODEL = "dall-e-3";
const IMAGE_TIMEOUT_MS = 60000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500, true);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500, true);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("UNAUTHORIZED", "Missing authorization header", 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse("UNAUTHORIZED", "Invalid or expired token", 401);
    }

    let body: { dream_id: string; dream_text: string; symbol_name?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
    }

    if (!body.dream_id || !body.dream_text) {
      return errorResponse("VALIDATION_ERROR", "dream_id and dream_text are required", 400);
    }

    // Generate image
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

    const dreamSnippet = body.dream_text.slice(0, 200);
    const symbolName = body.symbol_name || "mysterious vision";
    const imagePrompt = `Surreal dreamscape painting: ${dreamSnippet}. Central focus on ${symbolName}. Style: ethereal digital art, soft glowing light, dreamy atmosphere, muted purples and blues, magical realism. Painterly, atmospheric, evocative. No text, no words, no letters.`;

    const response = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
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
      console.error(`Image generation failed: ${errorBody}`);
      return errorResponse("IMAGE_ERROR", "Image generation failed", 500, true);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      return errorResponse("IMAGE_ERROR", "No image URL in response", 500, true);
    }

    // Download the image and persist to Supabase Storage
    let permanentUrl = imageUrl; // fallback to temporary URL
    try {
      const imgResponse = await fetch(imageUrl);
      if (imgResponse.ok) {
        const imgBuffer = await imgResponse.arrayBuffer();
        const storagePath = `${user.id}/${body.dream_id}.png`;

        const { error: uploadError } = await supabase.storage
          .from("dream-images")
          .upload(storagePath, imgBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("dream-images")
            .getPublicUrl(storagePath);
          permanentUrl = publicUrlData.publicUrl;
        } else {
          console.error("Storage upload failed:", uploadError.message);
        }
      }
    } catch (storageErr) {
      console.error("Image persistence failed, using temporary URL");
    }

    // Update the dream record with the permanent image URL
    const { data: dream } = await supabase
      .from("dreams")
      .select("reading")
      .eq("id", body.dream_id)
      .eq("user_id", user.id)
      .single();

    if (dream?.reading) {
      await supabase
        .from("dreams")
        .update({
          reading: { ...dream.reading, image_url: permanentUrl },
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.dream_id)
        .eq("user_id", user.id);
    }

    return jsonResponse({ success: true, image_url: permanentUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Image generation error: ${message}`);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500, true);
  }
});
