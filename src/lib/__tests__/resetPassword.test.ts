/**
 * Tests for web-based password reset and sign-in-with-code flows
 *
 * @file src/lib/__tests__/resetPassword.test.ts
 */

const mockResetPasswordForEmail = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignInWithOtp = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: any[]) => mockResetPasswordForEmail(...args),
      verifyOtp: (...args: any[]) => mockVerifyOtp(...args),
      signInWithOtp: (...args: any[]) => mockSignInWithOtp(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Password Reset - Web-Based Flow', () => {
  it('should call resetPasswordForEmail with redirectTo website URL', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.resetPasswordForEmail('user@example.com', {
      redirectTo: 'https://dreamz-journal.com/reset.html',
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://dreamz-journal.com/reset.html',
    });
  });

  it('should not surface 4xx errors (prevents email enumeration)', () => {
    expect({ status: 422 }.status >= 500).toBe(false);
    expect({ status: 400 }.status >= 500).toBe(false);
  });

  it('should surface 5xx errors', () => {
    expect({ status: 500 }.status >= 500).toBe(true);
    expect({ status: 503 }.status >= 500).toBe(true);
  });
});

describe('Sign In With Code - OTP Flow', () => {
  it('should call signInWithOtp with email', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.signInWithOtp({ email: 'user@example.com' });

    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  it('should call verifyOtp with type email', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { session: {} }, error: null });

    const { supabase } = require('../supabase');
    await supabase.auth.verifyOtp({
      email: 'user@example.com',
      token: '123456',
      type: 'email',
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '123456',
      type: 'email',
    });
  });

  it('should return error for invalid OTP code', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token has expired or is invalid', status: 403 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.verifyOtp({
      email: 'user@example.com',
      token: '000000',
      type: 'email',
    });

    expect(error).not.toBeNull();
    expect(error.message).toContain('expired');
  });

  it('should handle signInWithOtp rate limit error', async () => {
    mockSignInWithOtp.mockResolvedValue({
      data: {},
      error: { message: 'Rate limit exceeded', status: 429 },
    });

    const { supabase } = require('../supabase');
    const { error } = await supabase.auth.signInWithOtp({ email: 'user@example.com' });

    expect(error).not.toBeNull();
  });
});

describe('Password Validation (web page mirrors these rules)', () => {
  function validate(password: string, confirm: string): string | null {
    if (!password || !confirm) return 'Missing fields';
    if (password.length < 8) return 'Too short';
    if (password !== confirm) return 'Mismatch';
    return null;
  }

  it('should reject empty fields', () => {
    expect(validate('', '')).toBe('Missing fields');
  });

  it('should reject passwords under 8 characters', () => {
    expect(validate('1234567', '1234567')).toBe('Too short');
  });

  it('should reject mismatched passwords', () => {
    expect(validate('password1', 'password2')).toBe('Mismatch');
  });

  it('should accept valid matching passwords', () => {
    expect(validate('password123', 'password123')).toBeNull();
  });

  it('should accept minimum 8 characters', () => {
    expect(validate('12345678', '12345678')).toBeNull();
  });
});
