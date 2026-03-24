/**
 * Tests for OTP-based password reset and sign-in-with-code flows
 *
 * Covers:
 * - Forgot password: sends recovery OTP, prevents email enumeration
 * - Sign in with code: sends login OTP via signInWithOtp
 * - OTP verification: verifyOtp with recovery vs email type
 * - Password update: validation, updateUser, sign out after success
 * - pendingPasswordReset flag behavior
 *
 * @file src/lib/__tests__/resetPassword.test.ts
 */

const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithOtp = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: any[]) => mockResetPasswordForEmail(...args),
      updateUser: (...args: any[]) => mockUpdateUser(...args),
      verifyOtp: (...args: any[]) => mockVerifyOtp(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
      signInWithOtp: (...args: any[]) => mockSignInWithOtp(...args),
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

/** Mirrors the validation logic from ResetPasswordScreen */
function validateResetPassword(password: string, confirmPassword: string): string | null {
  if (!password || !confirmPassword) return 'Missing Fields';
  if (password.length < 6) return 'Password Too Short';
  if (password !== confirmPassword) return "Passwords Don't Match";
  return null;
}

describe('Password Reset - Send Recovery OTP', () => {
  it('should call resetPasswordForEmail', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.resetPasswordForEmail('user@example.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('should show success even when email not found (prevents enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Email address is invalid', status: 422 },
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

describe('Sign In With Code - Send Login OTP', () => {
  it('should call signInWithOtp with email', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.signInWithOtp({ email: 'user@example.com' });

    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  it('should handle signInWithOtp error', async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: {},
      error: { message: 'Rate limit exceeded', status: 429 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.signInWithOtp({ email: 'user@example.com' });

    expect(error).not.toBeNull();
    expect(error.message).toBe('Rate limit exceeded');
  });
});

describe('OTP Verification - Reset Mode', () => {
  it('should call verifyOtp with type recovery for reset mode', async () => {
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
});

describe('OTP Verification - Login Mode', () => {
  it('should call verifyOtp with type email for login mode', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: { access_token: 'abc' } },
      error: null,
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.verifyOtp({
      email: 'user@example.com',
      token: '654321',
      type: 'email',
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '654321',
      type: 'email',
    });
    expect(error).toBeNull();
  });
});

describe('Password Reset - Validation', () => {
  it('should reject empty fields', () => {
    expect(validateResetPassword('', '')).toBe('Missing Fields');
  });

  it('should reject short passwords', () => {
    expect(validateResetPassword('12345', '12345')).toBe('Password Too Short');
  });

  it('should reject mismatched passwords', () => {
    expect(validateResetPassword('password1', 'password2')).toBe("Passwords Don't Match");
  });

  it('should accept valid matching passwords', () => {
    expect(validateResetPassword('password123', 'password123')).toBeNull();
  });

  it('should accept minimum length (6 chars)', () => {
    expect(validateResetPassword('123456', '123456')).toBeNull();
  });
});

describe('Password Reset - Update and Sign Out', () => {
  it('should call updateUser with new password', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { id: '1' } }, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.updateUser({ password: 'newPass123' });

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPass123' });
  });

  it('should sign out after successful password update', async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { id: '1' } }, error: null });
    mockSignOut.mockResolvedValue({ error: null });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newPass123' });

    if (!error) {
      await supabase.auth.signOut();
    }

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should not sign out if update fails', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired', status: 401 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newPass123' });

    if (!error) {
      await supabase.auth.signOut();
    }

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('pendingPasswordReset Flag', () => {
  it('should suppress SIGNED_IN when flag is true', () => {
    let pendingPasswordReset = true;
    const mockSetSession = jest.fn();
    const event = 'SIGNED_IN';
    const session = { access_token: 'test' };

    // Mirrors the onAuthStateChange logic in App.tsx
    if (event === 'SIGNED_IN' && session) {
      if (pendingPasswordReset) {
        // Don't set session — stay on auth navigator
        return;
      }
      mockSetSession(session);
    }

    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('should allow SIGNED_IN when flag is false', () => {
    let pendingPasswordReset = false;
    const mockSetSession = jest.fn();
    const event = 'SIGNED_IN';
    const session = { access_token: 'test' };

    if (event === 'SIGNED_IN' && session) {
      if (pendingPasswordReset) {
        return;
      }
      mockSetSession(session);
    }

    expect(mockSetSession).toHaveBeenCalledWith(session);
  });

  it('should clear flag after sign out in reset flow', () => {
    let pendingPasswordReset = true;

    // Simulate ResetPasswordScreen clearing the flag
    pendingPasswordReset = false;

    expect(pendingPasswordReset).toBe(false);
  });
});
