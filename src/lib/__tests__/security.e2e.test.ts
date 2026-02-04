/**
 * E2E Security and RLS Tests
 *
 * Tests: SEC-RLS001 through SEC-AUTH003
 * Run with: npm run test:e2e
 *
 * @file src/lib/__tests__/security.e2e.test.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vjqvxraqeptgmbxnipqo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sfu54OCSyuVmdfM0YROStg_wtpG-RdQ';

const SHOULD_RUN_E2E = process.env.RUN_E2E_TESTS === 'true';

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestUser(suffix: string, retries = 3): Promise<TestUser> {
  const timestamp = Date.now();
  const email = `e2e-sec-${suffix}-${timestamp}@dreamz.app`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password: 'TestPassword123' }),
    });

    const data = await response.json();

    if (data.access_token && data.user?.id) {
      return {
        id: data.user.id,
        email,
        accessToken: data.access_token,
      };
    }

    // Rate limited - wait and retry
    if (data.error_code === 'over_request_rate_limit') {
      console.log(`Rate limited, waiting ${(attempt + 1) * 2}s before retry...`);
      await sleep((attempt + 1) * 2000);
      continue;
    }

    throw new Error(`Failed to create test user: ${JSON.stringify(data)}`);
  }

  throw new Error('Failed to create test user after retries');
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

async function createDream(user: TestUser, dreamText: string): Promise<{ id: string }> {
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
      dream_type: 'dream',
    }),
  });

  const data = await response.json();
  return data[0];
}

const describeE2E = SHOULD_RUN_E2E ? describe : describe.skip;

describeE2E('E2E: Row Level Security - Dreams', () => {
  jest.setTimeout(30000);

  let userA: TestUser;
  let userB: TestUser;
  let userADreamId: string;
  let userBDreamId: string;

  beforeAll(async () => {
    // Create two separate users
    userA = await createTestUser('userA');
    userB = await createTestUser('userB');

    // Each creates a dream
    const dreamA = await createDream(userA, 'User A private dream about mountains');
    const dreamB = await createDream(userB, 'User B private dream about oceans');

    userADreamId = dreamA.id;
    userBDreamId = dreamB.id;
  });

  afterAll(async () => {
    if (userA) await deleteTestUser(userA.accessToken);
    if (userB) await deleteTestUser(userB.accessToken);
  });

  // SEC-RLS001: User can only read own dreams
  it('SEC-RLS001: should only return own dreams', async () => {
    // User A queries dreams
    const responseA = await fetch(`${SUPABASE_URL}/rest/v1/dreams?select=id,user_id`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${userA.accessToken}`,
      },
    });
    const dreamsA = await responseA.json();

    // User A should only see their own dreams
    expect(dreamsA.length).toBe(1);
    expect(dreamsA[0].user_id).toBe(userA.id);
    expect(dreamsA.find((d: { id: string }) => d.id === userBDreamId)).toBeUndefined();

    console.log('SEC-RLS001: User can only read own dreams');
  });

  // SEC-RLS002: User can only read own profile
  it('SEC-RLS002: should only return own profile', async () => {
    // User A queries profiles
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${userA.accessToken}`,
      },
    });
    const profiles = await response.json();

    // Should only see own profile
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe(userA.id);

    console.log('SEC-RLS002: User can only read own profile');
  });

  // SEC-RLS003: Can insert dreams for self
  it('SEC-RLS003: should allow inserting own dream', async () => {
    const dream = await createDream(userA, 'Another dream for User A');

    expect(dream.id).toBeDefined();

    console.log('SEC-RLS003: Can insert own dream');
  });

  // SEC-RLS004: Cannot insert dream for other user
  it('SEC-RLS004: should reject inserting dream for other user', async () => {
    // User A tries to insert a dream with User B's user_id
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${userA.accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id: userB.id, // Trying to insert as User B
        dream_text: 'Malicious dream insertion attempt',
        dream_type: 'dream',
      }),
    });

    // Should fail with 403 or return empty (RLS blocks it)
    expect(response.ok).toBe(false);

    console.log('SEC-RLS004: Cannot insert dream for other user');
  });

  // SEC-RLS005: Can update own dream
  it('SEC-RLS005: should allow updating own dream', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams?id=eq.${userADreamId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${userA.accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        mood: 'Updated',
      }),
    });

    expect(response.ok).toBe(true);
    const updated = await response.json();
    expect(updated[0]?.mood).toBe('Updated');

    console.log('SEC-RLS005: Can update own dream');
  });

  // SEC-RLS006: Cannot update other's dream
  it('SEC-RLS006: should not update other users dream', async () => {
    // User A tries to update User B's dream
    const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams?id=eq.${userBDreamId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${userA.accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        mood: 'Hacked',
      }),
    });

    // Should return empty array (no rows affected) due to RLS
    const result = await response.json();
    expect(result.length).toBe(0);

    console.log('SEC-RLS006: Cannot update other users dream');
  });
});

describeE2E('E2E: Row Level Security - Symbols', () => {
  jest.setTimeout(30000);

  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser('symbols');
  });

  afterAll(async () => {
    if (testUser) await deleteTestUser(testUser.accessToken);
  });

  // SEC-RLS008: Any authenticated user can read symbols
  it('SEC-RLS008: should allow reading symbols', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/symbols?select=name,meaning&limit=5`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${testUser.accessToken}`,
      },
    });

    expect(response.ok).toBe(true);
    const symbols = await response.json();
    expect(symbols.length).toBeGreaterThan(0);

    console.log(`SEC-RLS008: Read ${symbols.length} symbols`);
  });

  // SEC-RLS009: Regular user cannot write symbols
  it('SEC-RLS009: should reject symbol insertion by regular user', async () => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/symbols`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${testUser.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'HackedSymbol',
        meaning: 'Should not be allowed',
      }),
    });

    expect(response.ok).toBe(false);

    console.log('SEC-RLS009: Symbol insertion blocked');
  });
});

describeE2E('E2E: Edge Function Authentication', () => {
  jest.setTimeout(30000);

  // SEC-AUTH001: Edge function rejects unauthenticated requests
  it('SEC-AUTH001: should reject request without auth header', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    // Function returns success: false or error when no auth
    expect(data.success).not.toBe(true);

    console.log('SEC-AUTH001: Unauthenticated request rejected');
  });

  // SEC-AUTH002: Edge function rejects invalid token
  it('SEC-AUTH002: should reject request with invalid token', async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-fake-token-12345',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    expect(data.success).not.toBe(true);

    console.log('SEC-AUTH002: Invalid token rejected');
  });

  // SEC-AUTH003: Edge function rejects expired token
  it('SEC-AUTH003: should reject request with malformed token', async () => {
    // A properly formatted but invalid JWT
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.fake';

    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${fakeJwt}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    expect(data.success).not.toBe(true);

    console.log('SEC-AUTH003: Malformed token rejected');
  });
});

describeE2E('E2E: Data Privacy - Export', () => {
  jest.setTimeout(30000);

  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser('export');
    await createDream(testUser, 'A private dream for export testing');
  });

  afterAll(async () => {
    if (testUser) await deleteTestUser(testUser.accessToken);
  });

  // SEC-PRIV002: Export has no internal identifiers
  it('SEC-PRIV002: should not expose internal IDs in dreams query', async () => {
    // Query dreams with limited fields (as export would)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/dreams?user_id=eq.${testUser.id}&select=dream_text,mood,dream_type,reading,created_at`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${testUser.accessToken}`,
        },
      }
    );

    const dreams = await response.json();

    // Verify no internal IDs in the response when we select specific fields
    expect(dreams[0].id).toBeUndefined();
    expect(dreams[0].user_id).toBeUndefined();
    expect(dreams[0].dream_text).toBeDefined();

    console.log('SEC-PRIV002: Export query excludes internal IDs');
  });
});
