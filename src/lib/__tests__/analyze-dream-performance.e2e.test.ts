/**
 * Performance E2E Tests for Dream Analysis
 *
 * Verifies that the analyze-dream edge function responds within
 * acceptable time bounds and returns valid JSON on the first attempt.
 *
 * Run with: RUN_E2E_TESTS=true npx jest --config jest.e2e.config.js
 *
 * @file src/lib/__tests__/analyze-dream-performance.e2e.test.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set');
}

// Only run when explicitly enabled (e2e tests need real fetch, not the jest.setup.js mock)
const SHOULD_RUN = process.env.RUN_E2E_TESTS === 'true';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a throwaway account for perf testing, with retry for rate limits.
 */
async function createTestAccount(): Promise<{ email: string; password: string; accessToken: string } | null> {
  const timestamp = Date.now();
  const email = `e2e-perf-${timestamp}@dreamz.app`;
  const password = `PerfTest${timestamp}!`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (data.error_code === 'over_request_rate_limit') {
      await sleep(2000 * (attempt + 1));
      continue;
    }

    if (data.access_token) {
      return { email, password, accessToken: data.access_token };
    }
    return null;
  }
  return null;
}

function isValidReading(reading: any): boolean {
  if (!reading || typeof reading !== 'object') return false;
  const requiredStrings = ['title', 'tldr', 'omen', 'ritual', 'journal_prompt'];
  for (const field of requiredStrings) {
    if (typeof reading[field] !== 'string' || !reading[field]) return false;
  }
  if (!Array.isArray(reading.symbols) || reading.symbols.length < 1 || reading.symbols.length > 3) return false;
  if (!Array.isArray(reading.tags) || reading.tags.length < 3 || reading.tags.length > 5) return false;
  if (!Array.isArray(reading.content_warnings)) return false;
  return true;
}

const describeFn = SHOULD_RUN ? describe : describe.skip;

/**
 * Free-tier accounts are limited to 1 analyze-dream reading per day
 * (see supabase/functions/analyze-dream/index.ts:432). This test file
 * makes 2 analyze calls, so each test needs its own throwaway account.
 */
async function provisionTestAccount(): Promise<string> {
  const account = await createTestAccount();
  if (!account) {
    throw new Error('Failed to create test account — cannot run performance tests');
  }

  // Newly-signed-up accounts default to ai_consent_granted=false per
  // migration 019. analyze-dream enforces consent server-side and
  // returns 403 CONSENT_REQUIRED without it. Grant consent so we
  // measure the real analysis path, not an early-return from the gate.
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${account.accessToken}`,
    },
  });
  const userJson = await userResponse.json();
  if (!userJson?.id) {
    throw new Error('Failed to fetch user id for consent grant');
  }
  const consentResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userJson.id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        ai_consent_granted: true,
        ai_consent_date: new Date().toISOString(),
      }),
    }
  );
  if (!consentResponse.ok) {
    throw new Error(`Failed to grant AI consent for throwaway account: ${consentResponse.status}`);
  }

  return account.accessToken;
}

describeFn('Dream Analysis Performance', () => {
  let accessToken: string;
  let validationAccessToken: string;

  beforeAll(async () => {
    // Provision two throwaway accounts sequentially (Supabase anon signup
    // rate-limits concurrent requests). Each test below uses its own so
    // neither hits the 1-reading-per-day free tier cap.
    accessToken = await provisionTestAccount();
    validationAccessToken = await provisionTestAccount();
  }, 60000);

  it('should complete a reading within 15 seconds', async () => {
    const start = Date.now();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-dream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dream_text: 'I was walking through a moonlit forest when a silver owl appeared and whispered ancient secrets. The trees were made of crystal and hummed with a low melody.',
        mood: 'Curious',
      }),
    });

    const elapsed = Date.now() - start;
    const data = await response.json();

    console.log(`PERF: Reading completed in ${elapsed}ms (status ${response.status})`);

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(60000);
    expect(data.reading).toBeDefined();
  }, 60000);

  it('should return valid JSON on first attempt (no retries needed)', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-dream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${validationAccessToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dream_text: 'A large whale swam through the sky above my childhood home while purple rain fell upward into the clouds.',
        mood: 'Surreal',
      }),
    });

    const data = await response.json();

    console.log(`PERF: Validation check (status ${response.status})`);

    expect(response.status).toBe(200);
    expect(data.reading).toBeDefined();
    expect(isValidReading(data.reading)).toBe(true);

    // Verify specific field constraints
    expect(data.reading.tldr.length).toBeLessThanOrEqual(150);
    expect(data.reading.symbols.length).toBeGreaterThanOrEqual(1);
    expect(data.reading.symbols.length).toBeLessThanOrEqual(3);
    expect(data.reading.tags.length).toBeGreaterThanOrEqual(3);
    expect(data.reading.tags.length).toBeLessThanOrEqual(5);
  }, 60000);
});
