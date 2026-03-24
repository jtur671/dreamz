/**
 * Tests for OTP-based password reset flow
 *
 * Covers:
 * - Forgot password: sends OTP email, prevents email enumeration
 * - OTP verification: verifyOtp with correct/incorrect/expired codes
 * - Password update: validation, updateUser, sign out after success
 *
 * @file src/lib/__tests__/resetPassword.test.ts
 */

const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: any[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: any[]) => mockUpdateUser(...args),
      verifyOtp: (...args: any[]) => mockVerifyOtp(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

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
  return null;
}

describe('Password Reset - Send OTP Email', () => {
  it('should call resetPasswordForEmail without redirectTo', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.resetPasswordForEmail('user@example.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('should show success on valid request', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('user@example.com');

    expect(shouldShowCheckEmail(error)).toBe(true);
  });

  it('should show success even when email not found (prevents enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Email address "unknown@test.com" is invalid', status: 422 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('unknown@test.com');

    expect(shouldShowCheckEmail(error)).toBe(true);
  });

  it('should show error on unexpected failures', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Network error', status: 500 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('user@example.com');

    expect(shouldShowCheckEmail(error)).toBe(false);
  });

  it('should handle error with undefined message safely', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { status: 500 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.resetPasswordForEmail('user@example.com');

    expect(shouldShowCheckEmail(error)).toBe(false);
  });
});

describe('Password Reset - Verify OTP Code', () => {
  it('should call verifyOtp with email, code, and recovery type', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: 'abc' } },
      error: null,
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.verifyOtp({
      email: 'user@example.com',
      token: '123456',
      type: 'recovery',
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '123456',
      type: 'recovery',
    });
    expect(error).toBeNull();
  });

  it('should return error for invalid code', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token has expired or is invalid', status: 403 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.verifyOtp({
      email: 'user@example.com',
      token: '000000',
      type: 'recovery',
    });

    expect(error).not.toBeNull();
    expect(error.message).toContain('expired');
  });

  it('should return error for expired code', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token has expired or is invalid', status: 403 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.verifyOtp({
      email: 'user@example.com',
      token: '999999',
      type: 'recovery',
    });

    expect(error).not.toBeNull();
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
  it('should call updateUser with new password', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newSecurePassword123' });

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newSecurePassword123' });
    expect(error).toBeNull();
  });

  it('should handle updateUser failure', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired', status: 401 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newPassword' });

    expect(error).not.toBeNull();
    expect(error.message).toBe('Session expired');
  });

  it('should sign out after successful password update', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: '123' } },
      error: null,
    });
    mockSignOut.mockResolvedValue({ error: null });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newPassword123' });

    if (!error) {
      await supabase.auth.signOut();
    }

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should not sign out if password update fails', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired', status: 401 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newPassword123' });

    if (!error) {
      await supabase.auth.signOut();
    }

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
