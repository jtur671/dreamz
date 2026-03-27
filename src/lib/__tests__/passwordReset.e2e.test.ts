/**
 * E2E Password Reset Tests
 *
 * Tests the full web-based password reset flow using Supabase admin API
 * to generate recovery tokens (since we can't read emails in tests).
 *
 * Tests: RESET-001 through RESET-005
 * Run with: npm run test:e2e
 *
 * @file src/lib/__tests__/passwordReset.e2e.test.ts
 */

import { execFileSync } from 'child_process';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vjqvxraqeptgmbxnipqo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sfu54OCSyuVmdfM0YROStg_wtpG-RdQ';

const SHOULD_RUN_E2E = process.env.RUN_E2E_TESTS === 'true';

let SERVICE_ROLE_KEY = '';

function getServiceRoleKey(): string {
  const output = execFileSync(
    'npx',
    ['supabase', 'projects', 'api-keys', '--project-ref', 'vjqvxraqeptgmbxnipqo'],
    { encoding: 'utf-8', timeout: 15000 }
  );
  const match = output.match(/service_role\s+\|\s+(\S+)/);
  if (!match) throw new Error('Could not find service_role key');
  return match[1];
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function signUp(email: string, password: string): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

async function signIn(email: string, password: string): Promise<{ status: number; data: any }> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return { status: response.status, data: await response.json() };
}

async function deleteUser(userId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
}

async function generateRecoveryLink(email: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'recovery',
      email,
    }),
  });
  const data = await response.json();

  // action_link can be at top level or in properties depending on Supabase version
  const actionLink = data.action_link || data.properties?.action_link;
  if (actionLink) {
    return actionLink;
  }

  throw new Error(`Failed to generate recovery link: ${JSON.stringify(data).substring(0, 200)}`);
}

async function followRecoveryLink(actionLink: string): Promise<string> {
  // Follow the Supabase verify endpoint redirect to get the code
  const response = await fetch(actionLink, { redirect: 'manual' });
  const location = response.headers.get('location') || '';

  // Extract access_token from hash fragment
  const hashIndex = location.indexOf('#');
  if (hashIndex !== -1) {
    const params = new URLSearchParams(location.substring(hashIndex + 1));
    const accessToken = params.get('access_token');
    if (accessToken) return accessToken;
  }

  throw new Error(`No access_token in redirect: ${location}`);
}

async function updatePassword(accessToken: string, newPassword: string): Promise<{ status: number; data: any }> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: newPassword }),
  });
  return { status: response.status, data: await response.json() };
}

const describeE2E = SHOULD_RUN_E2E ? describe : describe.skip;

describeE2E('Password Reset E2E', () => {
  const testEmail = `e2e-reset-${Date.now()}@dreamz.app`;
  const originalPassword = 'OriginalPass123!';
  const newPassword = 'NewSecurePass456!';
  let userId: string;

  beforeAll(async () => {
    SERVICE_ROLE_KEY = getServiceRoleKey();

    // Create test user
    const signUpData = await signUp(testEmail, originalPassword);
    userId = signUpData.id;
    console.log(`RESET: Created test user ${testEmail} (${userId})`);
  }, 30000);

  afterAll(async () => {
    if (userId) {
      await deleteUser(userId);
      console.log(`RESET: Deleted test user ${userId}`);
    }
  }, 15000);

  it('RESET-001: should sign in with original password', async () => {
    const { status } = await signIn(testEmail, originalPassword);
    expect(status).toBe(200);
    console.log('RESET-001: Original password works');
  }, 15000);

  it('RESET-002: should generate a recovery link via admin API', async () => {
    const link = await generateRecoveryLink(testEmail);
    expect(link).toBeDefined();
    expect(link).toContain('supabase.co/auth/v1/verify');
    console.log('RESET-002: Recovery link generated');
  }, 15000);

  it('RESET-003: should exchange recovery token and update password', async () => {
    const link = await generateRecoveryLink(testEmail);
    const accessToken = await followRecoveryLink(link);
    expect(accessToken).toBeDefined();
    expect(accessToken.length).toBeGreaterThan(0);

    const { status } = await updatePassword(accessToken, newPassword);
    expect(status).toBe(200);
    console.log('RESET-003: Password updated via recovery flow');
  }, 30000);

  it('RESET-004: should sign in with new password', async () => {
    await sleep(1000);
    const { status } = await signIn(testEmail, newPassword);
    expect(status).toBe(200);
    console.log('RESET-004: New password works');
  }, 15000);

  it('RESET-005: should reject old password after reset', async () => {
    const { status } = await signIn(testEmail, originalPassword);
    expect(status).toBe(400);
    console.log('RESET-005: Old password rejected');
  }, 15000);
});
