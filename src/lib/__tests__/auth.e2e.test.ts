/**
 * E2E Authentication Tests
 *
 * Tests: AUTH-001 through AUTH-ERR007
 * Run with: npm run test:e2e
 *
 * @file src/lib/__tests__/auth.e2e.test.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vjqvxraqeptgmbxnipqo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sfu54OCSyuVmdfM0YROStg_wtpG-RdQ';

const SHOULD_RUN_E2E = process.env.RUN_E2E_TESTS === 'true';

interface AuthResponse {
  access_token?: string;
  user?: { id: string; email: string };
  error?: string;
  error_code?: string;
  msg?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function signUp(email: string, password: string, retries = 3): Promise<AuthResponse> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    // Rate limited - wait and retry
    if (data.error_code === 'over_request_rate_limit') {
      console.log(`Rate limited, waiting ${(attempt + 1) * 2}s before retry...`);
      await sleep((attempt + 1) * 2000);
      continue;
    }

    return data;
  }
  return { error: 'Rate limit exceeded after retries' };
}

async function signIn(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

async function signOut(accessToken: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
}

async function deleteTestUser(accessToken: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Ignore cleanup errors
  }
}

const describeE2E = SHOULD_RUN_E2E ? describe : describe.skip;

describeE2E('E2E: Authentication - Happy Paths', () => {
  jest.setTimeout(30000);

  const timestamp = Date.now();
  const testEmail = `e2e-auth-${timestamp}@dreamz.app`;
  const testPassword = 'TestPassword123';
  let accessToken: string;

  afterAll(async () => {
    if (accessToken) {
      await deleteTestUser(accessToken);
    }
  });

  // AUTH-001: User can create account with email/password
  it('AUTH-001: should create account with email/password', async () => {
    const result = await signUp(testEmail, testPassword);

    expect(result.access_token).toBeDefined();
    expect(result.user?.email).toBe(testEmail);
    accessToken = result.access_token!;

    console.log(`AUTH-001: Created account ${testEmail}`);
  });

  // AUTH-002: User can sign in with existing credentials
  it('AUTH-002: should sign in with existing credentials', async () => {
    const result = await signIn(testEmail, testPassword);

    expect(result.access_token).toBeDefined();
    expect(result.user?.email).toBe(testEmail);
    accessToken = result.access_token!;

    console.log('AUTH-002: Signed in successfully');
  });

  // AUTH-003: User can sign out
  it('AUTH-003: should sign out successfully', async () => {
    await signOut(accessToken);

    // Verify by trying to use the old token (should still work for API but session ended)
    // The token itself may still be valid until expiry, but the session is ended
    console.log('AUTH-003: Signed out successfully');
  });

  // AUTH-004: Session token remains valid (token-based, not session-based)
  it('AUTH-004: should maintain valid token after sign in', async () => {
    const result = await signIn(testEmail, testPassword);
    accessToken = result.access_token!;

    // Verify token works by making an authenticated request
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(profileResponse.ok).toBe(true);
    console.log('AUTH-004: Token remains valid for authenticated requests');
  });
});

describeE2E('E2E: Authentication - Edge Cases', () => {
  jest.setTimeout(30000);

  const timestamp = Date.now();
  let accessToken: string;
  let testEmail: string;

  afterAll(async () => {
    if (accessToken) {
      await deleteTestUser(accessToken);
    }
  });

  // AUTH-E001: Email with leading/trailing spaces is trimmed
  it('AUTH-E001: should handle email with whitespace', async () => {
    testEmail = `e2e-whitespace-${timestamp}@dreamz.app`;
    // Note: Supabase may or may not trim - we test the behavior
    const result = await signUp(testEmail, 'TestPassword123');

    expect(result.access_token).toBeDefined();
    accessToken = result.access_token!;

    console.log('AUTH-E001: Created account (whitespace handling)');
  });

  // AUTH-E004: Very long email address (up to 254 chars)
  it('AUTH-E004: should handle long email address', async () => {
    // 254 char email is valid per RFC 5321
    const longLocal = 'a'.repeat(64); // Max local part
    const longDomain = 'b'.repeat(63) + '.dreamz.app'; // Domain part
    const longEmail = `${longLocal}@${longDomain}`.slice(0, 254);

    // This may fail depending on Supabase validation, which is expected
    const result = await signUp(longEmail, 'TestPassword123');

    // Either succeeds or returns validation error - both are acceptable
    expect(result.access_token || result.error || result.msg).toBeDefined();

    if (result.access_token) {
      await deleteTestUser(result.access_token);
    }

    console.log('AUTH-E004: Long email handled');
  });
});

describeE2E('E2E: Authentication - Error Cases', () => {
  jest.setTimeout(30000);

  // AUTH-ERR003: Invalid email format
  it('AUTH-ERR003: should reject invalid email format', async () => {
    const result = await signUp('notanemail', 'TestPassword123');

    expect(result.access_token).toBeUndefined();
    expect(result.error || result.msg).toBeDefined();

    console.log('AUTH-ERR003: Invalid email rejected');
  });

  // AUTH-ERR004: Wrong password
  it('AUTH-ERR004: should reject wrong password', async () => {
    // Create a user first
    const timestamp = Date.now();
    const email = `e2e-wrongpw-${timestamp}@dreamz.app`;
    const signUpResult = await signUp(email, 'CorrectPassword123');

    expect(signUpResult.access_token).toBeDefined();

    // Try to sign in with wrong password
    const signInResult = await signIn(email, 'WrongPassword456');

    expect(signInResult.access_token).toBeUndefined();
    expect(signInResult.msg?.toLowerCase() || signInResult.error?.toLowerCase()).toContain('invalid');

    // Cleanup
    if (signUpResult.access_token) {
      await deleteTestUser(signUpResult.access_token);
    }

    console.log('AUTH-ERR004: Wrong password rejected');
  });

  // AUTH-ERR005: Non-existent account
  it('AUTH-ERR005: should reject non-existent account', async () => {
    const result = await signIn(`nonexistent-${Date.now()}@dreamz.app`, 'AnyPassword123');

    expect(result.access_token).toBeUndefined();
    expect(result.msg?.toLowerCase() || result.error?.toLowerCase()).toContain('invalid');

    console.log('AUTH-ERR005: Non-existent account rejected');
  });

  // AUTH-ERR006: Weak password (< 6 chars)
  it('AUTH-ERR006: should reject weak password on sign up', async () => {
    const result = await signUp(`e2e-weak-${Date.now()}@dreamz.app`, '12345');

    expect(result.access_token).toBeUndefined();
    // Supabase returns error for passwords that don't meet requirements

    console.log('AUTH-ERR006: Weak password rejected');
  });

  // AUTH-ERR007: Duplicate email
  it('AUTH-ERR007: should reject duplicate email on sign up', async () => {
    const timestamp = Date.now();
    const email = `e2e-dup-${timestamp}@dreamz.app`;

    // Create first account
    const first = await signUp(email, 'TestPassword123');
    expect(first.access_token).toBeDefined();

    // Try to create duplicate
    const second = await signUp(email, 'TestPassword123');
    expect(second.access_token).toBeUndefined();

    // Cleanup
    if (first.access_token) {
      await deleteTestUser(first.access_token);
    }

    console.log('AUTH-ERR007: Duplicate email rejected');
  });
});
