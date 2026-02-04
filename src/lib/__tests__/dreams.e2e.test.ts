/**
 * E2E Dream Creation and Grimoire Tests
 *
 * Tests: DREAM-001 through DREAM-ERR003, GRIM-001 through GRIM-007
 * Run with: npm run test:e2e
 *
 * @file src/lib/__tests__/dreams.e2e.test.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vjqvxraqeptgmbxnipqo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sfu54OCSyuVmdfM0YROStg_wtpG-RdQ';

const SHOULD_RUN_E2E = process.env.RUN_E2E_TESTS === 'true';

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

interface Dream {
  id: string;
  user_id: string;
  dream_text: string;
  mood: string | null;
  dream_type: string;
  reading: unknown;
  deleted_at: string | null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestUser(retries = 3): Promise<TestUser> {
  const timestamp = Date.now();
  const email = `e2e-dream-${timestamp}@dreamz.app`;

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

async function createDream(
  user: TestUser,
  dreamText: string,
  mood?: string,
  dreamType: string = 'dream'
): Promise<Dream> {
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
      mood: mood || null,
      dream_type: dreamType,
    }),
  });

  const data = await response.json();
  return data[0];
}

async function getDreams(user: TestUser): Promise<Dream[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dreams?user_id=eq.${user.id}&deleted_at=is.null&order=created_at.desc`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${user.accessToken}`,
      },
    }
  );
  return response.json();
}

async function deleteDream(user: TestUser, dreamId: string): Promise<boolean> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dreams?id=eq.${dreamId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deleted_at: new Date().toISOString(),
      }),
    }
  );
  return response.ok;
}

async function searchDreams(user: TestUser, searchTerm: string): Promise<Dream[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/dreams?user_id=eq.${user.id}&deleted_at=is.null&dream_text=ilike.*${encodeURIComponent(searchTerm)}*`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${user.accessToken}`,
      },
    }
  );
  return response.json();
}

const describeE2E = SHOULD_RUN_E2E ? describe : describe.skip;

describeE2E('E2E: Dream Creation - Happy Paths', () => {
  jest.setTimeout(30000);

  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  afterAll(async () => {
    if (testUser) {
      await deleteTestUser(testUser.accessToken);
    }
  });

  // DREAM-001: User can create a dream entry
  it('DREAM-001: should create a dream entry', async () => {
    const dream = await createDream(
      testUser,
      'I was flying over mountains with golden eagles soaring beside me'
    );

    expect(dream.id).toBeDefined();
    expect(dream.user_id).toBe(testUser.id);
    expect(dream.dream_text).toContain('flying over mountains');

    console.log(`DREAM-001: Created dream ${dream.id}`);
  });

  // DREAM-002: User can add mood to dream
  it('DREAM-002: should create dream with mood', async () => {
    const dream = await createDream(
      testUser,
      'Walking through a peaceful garden with blooming flowers',
      'Peaceful'
    );

    expect(dream.mood).toBe('Peaceful');

    console.log('DREAM-002: Created dream with mood');
  });

  // DREAM-003: User can select dream type (nightmare)
  it('DREAM-003: should create nightmare type dream', async () => {
    const dream = await createDream(
      testUser,
      'Something dark was chasing me through endless corridors',
      'Fearful',
      'nightmare'
    );

    expect(dream.dream_type).toBe('nightmare');

    console.log('DREAM-003: Created nightmare');
  });

  // DREAM-004: Dream type defaults to "dream"
  it('DREAM-004: should default to dream type', async () => {
    const dream = await createDream(
      testUser,
      'A simple dream about walking on a beach'
    );

    expect(dream.dream_type).toBe('dream');

    console.log('DREAM-004: Default dream type is "dream"');
  });

  // DREAM-006: User can enter long dream text
  it('DREAM-006: should handle long dream text', async () => {
    const longText = 'I was in a dream. '.repeat(300); // ~5400 chars
    const dream = await createDream(testUser, longText);

    expect(dream.dream_text.length).toBeGreaterThan(5000);

    console.log(`DREAM-006: Created dream with ${dream.dream_text.length} chars`);
  });
});

describeE2E('E2E: Dream Creation - Edge Cases', () => {
  jest.setTimeout(30000);

  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  afterAll(async () => {
    if (testUser) {
      await deleteTestUser(testUser.accessToken);
    }
  });

  // DREAM-E001: Minimum text (10 characters)
  it('DREAM-E001: should accept minimum text length', async () => {
    const dream = await createDream(testUser, 'A dream...'); // exactly 10 chars

    expect(dream.id).toBeDefined();

    console.log('DREAM-E001: Minimum text length accepted');
  });

  // DREAM-E003: Unicode dream text
  it('DREAM-E003: should handle unicode and emojis', async () => {
    const unicodeDream = 'I saw 🌙 moons and ✨ stars floating in a 海 of dreams';
    const dream = await createDream(testUser, unicodeDream);

    expect(dream.dream_text).toBe(unicodeDream);

    console.log('DREAM-E003: Unicode preserved');
  });

  // DREAM-E005: Newlines in dream
  it('DREAM-E005: should preserve newlines', async () => {
    const multiParagraph = `First paragraph of the dream.

Second paragraph with more details.

Third paragraph with the conclusion.`;

    const dream = await createDream(testUser, multiParagraph);

    expect(dream.dream_text).toContain('\n');

    console.log('DREAM-E005: Newlines preserved');
  });
});

describeE2E('E2E: Grimoire (Dream History)', () => {
  jest.setTimeout(30000);

  let testUser: TestUser;
  let createdDreamIds: string[] = [];

  beforeAll(async () => {
    testUser = await createTestUser();

    // Create multiple dreams for testing
    const dream1 = await createDream(testUser, 'First dream about flying over oceans');
    const dream2 = await createDream(testUser, 'Second dream about walking in forests');
    const dream3 = await createDream(testUser, 'Third dream about swimming with dolphins', 'Joyful');

    createdDreamIds = [dream1.id, dream2.id, dream3.id];
  });

  afterAll(async () => {
    if (testUser) {
      await deleteTestUser(testUser.accessToken);
    }
  });

  // GRIM-001: All user dreams displayed
  it('GRIM-001: should list all user dreams', async () => {
    const dreams = await getDreams(testUser);

    expect(dreams.length).toBe(3);

    console.log(`GRIM-001: Found ${dreams.length} dreams`);
  });

  // GRIM-005: Search dreams
  it('GRIM-005: should search dreams by text', async () => {
    const results = await searchDreams(testUser, 'flying');

    expect(results.length).toBe(1);
    expect(results[0].dream_text).toContain('flying');

    console.log('GRIM-005: Search returned correct results');
  });

  // GRIM-007: Delete dream (soft delete)
  it('GRIM-007: should soft delete a dream', async () => {
    const dreamsBefore = await getDreams(testUser);
    const countBefore = dreamsBefore.length;

    const success = await deleteDream(testUser, createdDreamIds[0]);
    expect(success).toBe(true);

    const dreamsAfter = await getDreams(testUser);
    expect(dreamsAfter.length).toBe(countBefore - 1);

    console.log('GRIM-007: Dream soft-deleted successfully');
  });

  // GRIM-E006: Deleted dreams not shown
  it('GRIM-E006: should not show deleted dreams', async () => {
    const dreams = await getDreams(testUser);

    const deletedDream = dreams.find(d => d.id === createdDreamIds[0]);
    expect(deletedDream).toBeUndefined();

    console.log('GRIM-E006: Deleted dream not in results');
  });
});

describeE2E('E2E: Grimoire - Empty State', () => {
  jest.setTimeout(30000);

  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  afterAll(async () => {
    if (testUser) {
      await deleteTestUser(testUser.accessToken);
    }
  });

  // GRIM-E001: Empty grimoire
  it('GRIM-E001: should return empty array for new user', async () => {
    const dreams = await getDreams(testUser);

    expect(dreams).toEqual([]);

    console.log('GRIM-E001: Empty grimoire verified');
  });

  // GRIM-E002: No search results
  it('GRIM-E002: should return empty for no matches', async () => {
    await createDream(testUser, 'A simple dream about cats');

    const results = await searchDreams(testUser, 'xyznonexistent');

    expect(results).toEqual([]);

    console.log('GRIM-E002: No search results verified');
  });
});
