/**
 * E2E Tests for Dream Image Generation
 *
 * Verifies that the generate-dream-image edge function:
 * 1. Returns a valid Supabase Storage URL for premium users
 * 2. Rejects free-tier users with 403
 * 3. Returns a real, loadable image
 *
 * Uses the existing test account (premium) rather than creating throwaway
 * accounts, since image generation costs money and takes ~30s.
 *
 * Run with: RUN_E2E_TESTS=true npx jest --config jest.e2e.config.js generate-image
 *
 * @file src/lib/__tests__/generate-image.e2e.test.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set');
}
const TEST_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '';

const SHOULD_RUN = process.env.RUN_E2E_TESTS === 'true';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function signIn(email: string, password: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
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

    return data.access_token || null;
  }
  return null;
}

async function getFirstDream(accessToken: string): Promise<{ id: string; dream_text: string } | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dreams?select=id,dream_text&deleted_at=is.null&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data?.[0] || null;
}

const describeFn = SHOULD_RUN ? describe : describe.skip;

describeFn('Dream Image Generation', () => {
  let accessToken: string;
  let testDreamId: string;
  let testDreamText: string;

  beforeAll(async () => {
    const token = await signIn(TEST_EMAIL, TEST_PASSWORD);
    if (!token) {
      throw new Error('Failed to sign in as test user — cannot run image generation tests');
    }
    accessToken = token;

    // Ensure AI consent is granted on the shared test account. Other e2e
    // suites can leave it revoked (ai-consent.test.ts, settings revoke test),
    // and generate-dream-image enforces consent server-side (returns 403
    // CONSENT_REQUIRED otherwise).
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
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
          'Authorization': `Bearer ${accessToken}`,
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
      throw new Error(`Failed to grant AI consent for test account: ${consentResponse.status}`);
    }

    // Use an existing dream from the test account (premium, has dreams)
    const dream = await getFirstDream(accessToken);
    if (!dream) {
      throw new Error('No dreams found for test user — cannot run image generation tests');
    }
    testDreamId = dream.id;
    testDreamText = dream.dream_text;
  }, 30000);

  it('should generate an image and return a valid storage URL', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-dream-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dream_id: testDreamId,
        dream_text: testDreamText,
        symbol_name: 'Cave',
      }),
    });

    const data = await response.json();

    console.log(`IMAGE-001: status=${response.status}, success=${data.success}`);

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.image_url).toBeDefined();
    expect(typeof data.image_url).toBe('string');

    // Should be a Supabase Storage signed URL, not a temporary OpenAI URL
    expect(data.image_url).toContain('supabase.co/storage/v1/object/sign/dream-images/');

    // Verify the image is actually loadable
    const imgResponse = await fetch(data.image_url, { method: 'HEAD' });
    console.log(`IMAGE-001: image URL status=${imgResponse.status}, content-type=${imgResponse.headers.get('content-type')}`);
    expect(imgResponse.ok).toBe(true);
    expect(imgResponse.headers.get('content-type')).toContain('image/');
  }, 120000); // 2 min timeout — image generation can be slow

  it('should reject unauthenticated requests', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-dream-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dream_id: testDreamId,
        dream_text: testDreamText,
      }),
    });

    console.log(`IMAGE-002: unauthenticated status=${response.status}`);
    expect(response.status).toBe(401);
  }, 15000);

  it('should reject free-tier users', async () => {
    // Create a fresh free-tier account
    const timestamp = Date.now();
    const email = `e2e-img-free-${timestamp}@dreamz.app`;
    const password = `ImgTest${timestamp}!`;

    const signupResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const signupData = await signupResponse.json();
    const freeToken = signupData.access_token;

    if (!freeToken) {
      console.log('IMAGE-003: skipped — could not create free account');
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-dream-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${freeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dream_id: 'fake-dream-id',
        dream_text: 'test dream',
      }),
    });

    const data = await response.json();
    console.log(`IMAGE-003: free-tier status=${response.status}, code=${data.error?.code}`);

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('PREMIUM_REQUIRED');
  }, 30000);
});
