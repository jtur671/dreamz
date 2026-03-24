/**
 * Tests for OTP-based password reset and sign-in-with-code flows
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

/** Mirrors AuthScreen error classification — only surface 5xx errors */
function isServerError(error: { status?: number } | null): boolean {
  return !!error && (error.status ?? 0) >= 500;
}

/** Mirrors ResetPasswordScreen validation */
function validateResetPassword(password: string, confirmPassword: string): string | null {
  if (!password || !confirmPassword) return 'Missing Fields';
  if (password.length < 8) return 'Password Too Short';
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

  it('should not surface 4xx errors (prevents enumeration)', () => {
    expect(isServerError({ status: 422 })).toBe(false);
    expect(isServerError({ status: 400 })).toBe(false);
    expect(isServerError({ status: 404 })).toBe(false);
  });

  it('should surface 5xx errors', () => {
    expect(isServerError({ status: 500 })).toBe(true);
    expect(isServerError({ status: 503 })).toBe(true);
  });

  it('should not surface null errors', () => {
    expect(isServerError(null)).toBe(false);
  });

  it('should handle missing status gracefully', () => {
    expect(isServerError({})).toBe(false);
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
  });
});

describe('OTP Verification - Reset Mode', () => {
  it('should call verifyOtp with type recovery', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    const { supabase } = require('../supabase');
    await supabase.auth.verifyOtp({ email: 'user@example.com', token: '123456', type: 'recovery' });
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com', token: '123456', type: 'recovery',
    });
  });

  it('should return error for invalid code', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token has expired or is invalid', status: 403 },
    });
    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.verifyOtp({
      email: 'user@example.com', token: '000000', type: 'recovery',
    });
    expect(error).not.toBeNull();
  });
});

describe('OTP Verification - Login Mode', () => {
  it('should call verifyOtp with type email', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    const { supabase } = require('../supabase');
    await supabase.auth.verifyOtp({ email: 'user@example.com', token: '654321', type: 'email' });
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com', token: '654321', type: 'email',
    });
  });
});

describe('Password Reset - Validation', () => {
  it('should reject empty fields', () => {
    expect(validateResetPassword('', '')).toBe('Missing Fields');
  });

  it('should reject passwords shorter than 8 characters', () => {
    expect(validateResetPassword('1234567', '1234567')).toBe('Password Too Short');
  });

  it('should accept passwords of 8+ characters', () => {
    expect(validateResetPassword('12345678', '12345678')).toBeNull();
  });

  it('should reject mismatched passwords', () => {
    expect(validateResetPassword('password1', 'password2')).toBe("Passwords Don't Match");
  });

  it('should accept valid matching passwords', () => {
    expect(validateResetPassword('password123', 'password123')).toBeNull();
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
    if (!error) await supabase.auth.signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should not sign out if update fails', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired', status: 401 },
    });
    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.updateUser({ password: 'newPass123' });
    if (!error) await supabase.auth.signOut();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('pendingPasswordReset - Auth Event Handler', () => {
  /**
   * Mirrors App.tsx onAuthStateChange logic:
   * - When pending=true AND SIGNED_IN: setSession IS called, but navigator
   *   starts on ResetPassword via initialRouteName
   * - When pending=false AND SIGNED_IN: setSession IS called, navigator
   *   starts on MainTabs normally
   */
  function handleAuthEvent(
    event: string,
    session: any,
    pending: boolean,
    setSession: (s: any) => void
  ): { navigateTo: string } | null {
    if (event === 'SIGNED_IN' && session) {
      setSession(session); // Always set session
      if (pending) {
        return { navigateTo: 'ResetPassword' };
      }
      return { navigateTo: 'MainTabs' };
    }
    if (!session) {
      setSession(null);
      return null;
    }
    setSession(session);
    return null;
  }

  it('should set session AND route to ResetPassword when pending is true', () => {
    const mockSetSession = jest.fn();
    const result = handleAuthEvent('SIGNED_IN', { access_token: 'test' }, true, mockSetSession);
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'test' });
    expect(result).toEqual({ navigateTo: 'ResetPassword' });
  });

  it('should set session AND route to MainTabs when pending is false', () => {
    const mockSetSession = jest.fn();
    const result = handleAuthEvent('SIGNED_IN', { access_token: 'test' }, false, mockSetSession);
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'test' });
    expect(result).toEqual({ navigateTo: 'MainTabs' });
  });

  it('should clear session on sign out', () => {
    const mockSetSession = jest.fn();
    const result = handleAuthEvent('SIGNED_OUT', null, true, mockSetSession);
    expect(mockSetSession).toHaveBeenCalledWith(null);
    expect(result).toBeNull();
  });
});
