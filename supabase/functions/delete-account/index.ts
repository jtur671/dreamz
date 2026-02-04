/**
 * Delete Account Edge Function
 *
 * Permanently deletes a user account including:
 * - All dreams
 * - Profile data
 * - Auth user (requires service role key)
 *
 * Endpoint: POST /functions/v1/delete-account
 * Auth: Required (Supabase JWT in Authorization header)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from "../_shared/cors.ts";

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req: Request) => {
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
    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(`[${correlationId}] Supabase credentials not configured`);
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500, true);
    }

    if (!supabaseServiceKey) {
      console.error(`[${correlationId}] Service role key not configured`);
      return errorResponse("CONFIG_ERROR", "Service configuration error", 500, true);
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("UNAUTHORIZED", "Missing authorization header", 401);
    }

    // Create client with user's JWT to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error(`[${correlationId}] Auth error: ${authError?.message || "No user"}`);
      return errorResponse("UNAUTHORIZED", "Invalid or expired token", 401);
    }

    const userId = user.id;
    const userEmail = user.email;
    console.log(`[${correlationId}] Processing account deletion for user: ${userId}`);

    // Create admin client with service role key for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Step 1: Delete all user's dreams
    const { error: dreamsError } = await adminClient
      .from("dreams")
      .delete()
      .eq("user_id", userId);

    if (dreamsError) {
      console.error(`[${correlationId}] Failed to delete dreams: ${dreamsError.message}`);
      return errorResponse(
        "DELETE_DREAMS_FAILED",
        "Failed to delete dreams. Please try again.",
        500,
        true
      );
    }
    console.log(`[${correlationId}] Dreams deleted`);

    // Step 2: Delete user profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      console.error(`[${correlationId}] Failed to delete profile: ${profileError.message}`);
      return errorResponse(
        "DELETE_PROFILE_FAILED",
        "Failed to delete profile. Please try again.",
        500,
        true
      );
    }
    console.log(`[${correlationId}] Profile deleted`);

    // Step 3: Delete auth user (requires admin privileges)
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error(`[${correlationId}] Failed to delete auth user: ${authDeleteError.message}`);
      return errorResponse(
        "DELETE_AUTH_FAILED",
        "Failed to delete account. Please contact support.",
        500,
        true
      );
    }
    console.log(`[${correlationId}] Auth user deleted`);

    console.log(`[${correlationId}] Account fully deleted: ${userEmail}`);

    return jsonResponse({
      success: true,
      message: "Account permanently deleted",
    });
  } catch (error) {
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
