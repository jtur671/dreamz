export const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.DETOX_TEST_EMAIL || 'test@test.com';
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.DETOX_TEST_PASSWORD || 'Test123';

export function getTestLaunchArgs() {
  return {
    detoxTestEmail: TEST_EMAIL,
    detoxTestPassword: TEST_PASSWORD,
  };
}
