const TEST_EMAIL = process.env.DETOX_TEST_EMAIL || 'detox-test@dreamz.app';
const TEST_PASSWORD = process.env.DETOX_TEST_PASSWORD || 'detox-test-password';

export function getTestLaunchArgs() {
  return {
    detoxTestEmail: TEST_EMAIL,
    detoxTestPassword: TEST_PASSWORD,
  };
}
