/**
 * Audio Transcription Edge Function
 *
 * Transcribes audio recordings to text using OpenAI Whisper API.
 *
 * Endpoint: POST /functions/v1/transcribe-audio
 * Auth: Required (Supabase JWT in Authorization header)
 * Body: FormData with 'audio' file, or JSON { audio: base64, mimeType, filename }
 *
 * ---
 * PRIVACY NOTICE — Third-party data retention
 *
 * Audio is transmitted to OpenAI's Whisper API (api.openai.com/v1/audio/transcriptions).
 * Per OpenAI's API data usage policy (as of 2026-04):
 *   • Audio submitted to the Whisper API is NOT used to train models.
 *   • Audio may be retained by OpenAI for up to 30 days for abuse monitoring,
 *     then deleted.
 *   • Zero Data Retention (ZDR) is available only via enterprise contract and
 *     is NOT enabled on this project. Whisper has no per-request retention flag.
 *
 * This behavior MUST be disclosed in the app's privacy policy under "Third-party
 * sub-processors" / "Voice input". Dreamz does not store raw audio on its own
 * servers — only the returned transcript is persisted into the dream record.
 * ---
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

// ============================================================================
// Configuration
// ============================================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)
const ALLOWED_TYPES = [
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
];

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST method is allowed", 405);
  }

  try {
    // Verify OpenAI API key is configured
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500, true);
    }

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("UNAUTHORIZED", "Missing authorization header", 401);
    }

    // Verify user with Supabase
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse("UNAUTHORIZED", "Invalid or expired token", 401);
    }

    // Parse request body (JSON with base64 audio)
    const contentType = req.headers.get("Content-Type") || "";
    let audioBlob: Blob;
    let filename = "recording.m4a";

    if (contentType.includes("application/json")) {
      // Handle base64 JSON payload from React Native
      const body = await req.json();

      if (!body.audio) {
        return errorResponse("VALIDATION_ERROR", "Missing audio data", 400);
      }

      // Decode base64 to binary
      const binaryString = atob(body.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const mimeType = body.mimeType || "audio/m4a";
      filename = body.filename || "recording.m4a";
      audioBlob = new Blob([bytes], { type: mimeType });

      console.log(`Received base64 audio: ${filename}, type: ${mimeType}, size: ${audioBlob.size}`);
    } else {
      // Handle FormData (web uploads)
      const formData = await req.formData();
      const audioFile = formData.get("audio");

      if (!audioFile || !(audioFile instanceof File)) {
        return errorResponse("VALIDATION_ERROR", "Missing audio file", 400);
      }

      audioBlob = audioFile;
      filename = audioFile.name || "recording.m4a";
      console.log(`Received form audio: ${filename}, type: ${audioFile.type}, size: ${audioFile.size}`);
    }

    // Validate file size
    if (audioBlob.size > MAX_FILE_SIZE) {
      return errorResponse("VALIDATION_ERROR", "File too large. Maximum size is 25MB.", 400);
    }

    // Validate MIME type
    const blobType = audioBlob.type?.toLowerCase() || "";
    if (blobType && !ALLOWED_TYPES.includes(blobType)) {
      return errorResponse("VALIDATION_ERROR", "Unsupported audio format", 400);
    }

    // Prepare request to OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioBlob, filename);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "en");
    whisperFormData.append("response_format", "json");

    // Call Whisper API
    console.log("Calling Whisper API...");
    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: whisperFormData,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", whisperResponse.status, errorText);
      return errorResponse(
        "TRANSCRIPTION_ERROR",
        "Transcription failed. Please try again.",
        500,
        true
      );
    }

    const whisperData = await whisperResponse.json();
    console.log("Transcription successful, length:", whisperData.text?.length);

    if (!whisperData.text) {
      return errorResponse("TRANSCRIPTION_ERROR", "No transcription returned", 500, true);
    }

    return jsonResponse({
      success: true,
      text: whisperData.text,
    });
  } catch (error) {
    console.error("Transcription error:", error instanceof Error ? error.message : error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again.",
      500,
      true
    );
  }
});
