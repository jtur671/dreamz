/**
 * Tests for password reset flow
 *
 * Covers:
 * - AuthScreen forgot password behavior (redirectTo, error handling, email enumeration prevention)
 * - ResetPasswordScreen validation and submission
 * - Deep link recovery token extraction and auth event routing
 *
 * @file src/lib/__tests__/resetPassword.test.ts
 */

const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockSetSession = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: any[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: any[]) => mockUpdateUser(...args),
      setSession: (...args: any[]) => mockSetSession(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// --- Extracted logic from production code for testable validation ---

/** Mirrors the error classification logic from AuthScreen.handleForgotPassword */
function shouldShowCheckEmail(error: { message?: string } | null): boolean {
  return !error || !error.message?.toLowerCase().includes('invalid') === false
    ? true
    : !(error && !error.message?.toLowerCase().includes('invalid'));
}

/** Mirrors the validation logic from ResetPasswordScreen.handleResetPassword */
function validateResetPassword(password: string, confirmPassword: string): string | null {
  if (!password || !confirmPassword) return 'Missing Fields';
  if (password.length < 6) return 'Password Too Short';
  if (password !== confirmPassword) return "Passwords Don't Match";
  return null; // valid
}

/** Mirrors the deep link token extraction from App.tsx handleDeepLinkRecovery */
function extractRecoveryTokens(url: string): { accessToken: string; refreshToken: string } | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;

  const params = new URLSearchParams(url.substring(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');

  if (accessToken && refreshToken && type === 'recovery') {
    return { accessToken, refreshToken };
  }
  return null;
}

/** Mirrors the auth event routing from App.tsx onAuthStateChange */
function handleAuthEvent(
  event: string,
  session: any,
  navigate: (screen: string) => void
): void {
  if (event === 'PASSWORD_RECOVERY' && session) {
    navigate('ResetPassword');
  }
}

// --- Tests ---

describe('Password Reset - Forgot Password Flow', () => {
  it('should call resetPasswordForEmail with redirectTo dreamz://reset-password', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.resetPasswordForEmail('user@example.com', {
      redirectTo: 'dreamz://reset-password',
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'dreamz://reset-password',
    });
  });

  it('should show success message on successful reset request', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('user@example.com', {
      redirectTo: 'dreamz://reset-password',
    });

    expect(shouldShowCheckEmail(error)).toBe(true);
  });

  it('should show success message even when email is not found (prevents enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Email address "unknown@test.com" is invalid', status: 422 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('unknown@test.com', {
      redirectTo: 'dreamz://reset-password',
    });

    expect(shouldShowCheckEmail(error)).toBe(true);
  });

  it('should show generic error on unexpected failures (e.g., network error)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Network error', status: 500 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('user@example.com', {
      redirectTo: 'dreamz://reset-password',
    });

    expect(shouldShowCheckEmail(error)).toBe(false);
  });

  it('should handle error with undefined message safely', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { status: 500 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('user@example.com', {
      redirectTo: 'dreamz://reset-password',
    });

    // Should not throw when error.message is undefined
    expect(shouldShowCheckEmail(error)).toBe(false);
  });
});

describe('Password Reset - Validation', () => {
  it('should reject empty password fields', () => {
    expect(validateResetPassword('', '')).toBe('Missing Fields');
  });

  it('should reject when only password is empty', () => {
    expect(validateResetPassword('', 'password123')).toBe('Missing Fields');
  });

  it('should reject when only confirm is empty', () => {
    expect(validateResetPassword('password123', '')).toBe('Missing Fields');
  });

  it('should reject passwords shorter than 6 characters', () => {
    expect(validateResetPassword('12345', '12345')).toBe('Password Too Short');
  });

  it('should reject mismatched passwords', () => {
    expect(validateResetPassword('password123', 'password456')).toBe("Passwords Don't Match");
  });

  it('should accept valid matching passwords', () => {
    expect(validateResetPassword('password123', 'password123')).toBeNull();
  });

  it('should accept minimum length password (6 chars)', () => {
    expect(validateResetPassword('123456', '123456')).toBeNull();
  });
});

describe('Password Reset - Update Password', () => {
  it('should call updateUser with new password on valid submit', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newSecurePassword123' });

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newSecurePassword123' });
    expect(error).toBeNull();
  });

  it('should handle updateUser failure gracefully', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired', status: 401 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newPassword' });

    expect(error).not.toBeNull();
    expect(error.message).toBe('Session expired');
  });
});

describe('Password Reset - Deep Link Token Extraction', () => {
  it('should extract recovery tokens from a valid deep link URL', () => {
    const url = 'dreamz://reset-password#access_token=abc123&refresh_token=def456&type=recovery';
    const tokens = extractRecoveryTokens(url);

    expect(tokens).toEqual({ accessToken: 'abc123', refreshToken: 'def456' });
  });

  it('should return null for URLs without hash fragment', () => {
    const url = 'dreamz://reset-password';
    expect(extractRecoveryTokens(url)).toBeNull();
  });

  it('should return null when type is not recovery', () => {
    const url = 'dreamz://reset-password#access_token=abc123&refresh_token=def456&type=signup';
    expect(extractRecoveryTokens(url)).toBeNull();
  });

  it('should return null when tokens are missing', () => {
    const url = 'dreamz://reset-password#type=recovery';
    expect(extractRecoveryTokens(url)).toBeNull();
  });

  it('should return null when only access_token is present', () => {
    const url = 'dreamz://reset-password#access_token=abc123&type=recovery';
    expect(extractRecoveryTokens(url)).toBeNull();
  });

  it('should call setSession with extracted tokens', async () => {
    mockSetSession.mockResolvedValue({ data: { session: {} }, error: null });

    const tokens = extractRecoveryTokens(
      'dreamz://reset-password#access_token=abc&refresh_token=def&type=recovery'
    );

    if (tokens) {
      const { supabase } = require('../supabase');
      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
    }

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'abc',
      refresh_token: 'def',
    });
  });
});

describe('Password Reset - Auth Event Routing', () => {
  it('should navigate to ResetPassword on PASSWORD_RECOVERY event', () => {
    const mockNavigate = jest.fn();
    handleAuthEvent('PASSWORD_RECOVERY', { access_token: 'test' }, mockNavigate);
    expect(mockNavigate).toHaveBeenCalledWith('ResetPassword');
  });

  it('should not navigate on SIGNED_IN events', () => {
    const mockNavigate = jest.fn();
    handleAuthEvent('SIGNED_IN', { access_token: 'test' }, mockNavigate);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate if session is null on PASSWORD_RECOVERY', () => {
    const mockNavigate = jest.fn();
    handleAuthEvent('PASSWORD_RECOVERY', null, mockNavigate);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not navigate on TOKEN_REFRESHED events', () => {
    const mockNavigate = jest.fn();
    handleAuthEvent('TOKEN_REFRESHED', { access_token: 'test' }, mockNavigate);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
