/**
 * CORS Configuration for Supabase Edge Functions
 *
 * Provides standard CORS headers for cross-origin requests from the mobile app.
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

/**
 * Creates a CORS preflight response for OPTIONS requests
 *
 * @returns Response with CORS headers and 204 status
 */
export function handleCorsPreflightRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Creates a JSON response with CORS headers
 *
 * @param data - The data to serialize as JSON
 * @param status - HTTP status code (default 200)
 * @returns Response with JSON body and CORS headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Creates an error response with CORS headers
 *
 * @param code - Error code for client handling
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param retryable - Whether the client should retry the request
 * @returns Response with error JSON and CORS headers
 */
export function errorResponse(
  code: string,
  message: string,
  status: number,
  retryable: boolean = false
): Response {
  return jsonResponse(
    {
      success: false,
      error: {
        code,
        message,
        retryable,
      },
    },
    status
  );
}
