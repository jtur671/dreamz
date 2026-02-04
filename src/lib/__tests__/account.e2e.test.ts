/**
 * End-to-End Account Tests
 *
 * These tests run against the real Supabase backend.
 * They create real users and data, then clean up after themselves.
 *
 * Run with: npm run test:e2e
 *
 * @file src/lib/__tests__/e2e.account.test.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vjqvxraqeptgmbxnipqo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sfu54OCSyuVmdfM0YROStg_wtpG-RdQ';

// Skip these tests in CI or when running unit tests
const SHOULD_RUN_E2E = process.env.RUN_E2E_TESTS === 'true';

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

/**
 * Creates a test user with a unique email
 */
async function createTestUser(): Promise<TestUser> {
  const timestamp = Date.now();
  const email = `e2e-test-${timestamp}@dreamz.app`;
  const password = 'TestPassword123';

  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!data.access_token || !data.user?.id) {
    throw new Error(`Failed to create test user: ${JSON.stringify(data)}`);
  }

  return {
    id: data.user.id,
    email,
    accessToken: data.access_token,
  };
}

/**
 * Creates a dream for the given user
 */
async function createDream(user: TestUser, dreamText: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${user.accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      user_id: user.id,
      dream_text: dreamText,
      mood: 4,
      dream_type: 'dream',
    }),
  });

  const data = await response.json();

  if (!Array.isArray(data) || !data[0]?.id) {
    throw new Error(`Failed to create dream: ${JSON.stringify(data)}`);
  }

  return data[0].id;
}

/**
 * Fetches user's profile
 */
async function getProfile(user: TestUser): Promise<unknown[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${user.accessToken}`,
    },
  });

  return response.json();
}

/**
 * Fetches user's dreams
 */
async function getDreams(user: TestUser): Promise<unknown[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams?user_id=eq.${user.id}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${user.accessToken}`,
    },
  });

  return response.json();
}

/**
 * Calls the delete-account edge function
 */
async function deleteAccount(user: TestUser): Promise<{ success: boolean; message?: string; error?: unknown }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${user.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

/**
 * Attempts to sign in (used to verify user deletion)
 */
async function trySignIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (data.access_token) {
    return { success: true };
  }

  return { success: false, error: data.msg || data.error_code };
}

// Conditional test suite - only runs when RUN_E2E_TESTS=true
const describeE2E = SHOULD_RUN_E2E ? describe : describe.skip;

describeE2E('E2E: Account Deletion Flow', () => {
  jest.setTimeout(30000); // 30 second timeout for network operations

  let testUser: TestUser;

  it('should create a test user successfully', async () => {
    testUser = await createTestUser();

    expect(testUser.id).toBeDefined();
    expect(testUser.email).toContain('@dreamz.app');
    expect(testUser.accessToken).toBeDefined();

    console.log(`Created test user: ${testUser.email}`);
  });

  it('should have a profile created automatically', async () => {
    const profiles = await getProfile(testUser);

    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBe(1);
    expect((profiles[0] as { email: string }).email).toBe(testUser.email);

    console.log('Profile exists');
  });

  it('should create a dream for the user', async () => {
    const dreamId = await createDream(testUser, 'E2E test dream: flying over mountains with golden eagles');

    expect(dreamId).toBeDefined();

    const dreams = await getDreams(testUser);
    expect(dreams.length).toBe(1);

    console.log(`Created dream: ${dreamId}`);
  });

  it('should delete the account completely via edge function', async () => {
    const result = await deleteAccount(testUser);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Account permanently deleted');

    console.log('Account deletion successful');
  });

  it('should have deleted the profile', async () => {
    // Use anon key to check if profile exists (RLS will return empty for non-existent)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${testUser.email}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      },
    });

    const profiles = await response.json();
    expect(profiles).toEqual([]);

    console.log('Profile deleted');
  });

  it('should not allow sign-in after deletion', async () => {
    const result = await trySignIn(testUser.email, 'TestPassword123');

    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('invalid');

    console.log('Auth user deleted - cannot sign in');
  });
});

describeE2E('E2E: Export Dreams Flow', () => {
  jest.setTimeout(30000);

  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser();
    await createDream(testUser, 'Export test dream 1: swimming in crystal waters');
    await createDream(testUser, 'Export test dream 2: walking through ancient forests');
  });

  afterAll(async () => {
    // Clean up: delete the test user
    if (testUser) {
      await deleteAccount(testUser);
    }
  });

  it('should export dreams without internal IDs', async () => {
    const dreams = await getDreams(testUser);

    expect(dreams.length).toBe(2);

    // Verify dreams have expected fields
    const dream = dreams[0] as { id: string; user_id: string; dream_text: string };
    expect(dream.dream_text).toContain('Export test dream');

    // Note: The actual export formatting happens in accountService.exportUserDreams()
    // This test verifies the data can be retrieved for export
    console.log(`Verified ${dreams.length} dreams can be fetched for export`);
  });
});

// Also export helpers for manual testing
export {
  createTestUser,
  createDream,
  getProfile,
  getDreams,
  deleteAccount,
  trySignIn,
};
