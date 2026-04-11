/**
 * Tests for AI Consent Service
 * @file src/lib/__tests__/aiConsentService.test.ts
 */

import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';
import {
  getAIConsent,
  grantAIConsent,
  revokeAIConsent,
  refreshAIConsent,
} from '../aiConsentService';

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const USER_ID = 'user-123';
const USER_CACHE_KEY = `dreamz_ai_consent:${USER_ID}`;

function mockAuthUser(userId: string | null) {
  (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });
}

function mockProfileSelect(result: { data: any; error: any }) {
  (mockedSupabase.from as jest.Mock).mockReturnValueOnce({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  });
}

function mockProfileUpdate(result: { error: any }) {
  const eqMock = jest.fn().mockResolvedValue(result);
  (mockedSupabase.from as jest.Mock).mockReturnValueOnce({
    update: jest.fn().mockReturnThis(),
    eq: eqMock,
  });
  return eqMock;
}

describe('AI Consent Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAIConsent', () => {
    it('reads from Supabase first (authoritative), not from cache', async () => {
      // Cache says granted: true — should be ignored in favor of server state.
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
        JSON.stringify({ granted: true, date: '2026-01-01T00:00:00Z' })
      );
      mockAuthUser(USER_ID);
      mockProfileSelect({
        data: { ai_consent_granted: false, ai_consent_date: null },
        error: null,
      });

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
      expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
      // Cache gets refreshed with the authoritative value.
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        USER_CACHE_KEY,
        JSON.stringify({ granted: false, date: null })
      );
    });

    it('uses a user-scoped cache key (prevents cross-account leaks)', async () => {
      mockAuthUser(USER_ID);
      mockProfileSelect({
        data: { ai_consent_granted: true, ai_consent_date: '2026-04-09T00:00:00Z' },
        error: null,
      });

      await getAIConsent();

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        USER_CACHE_KEY,
        expect.stringContaining('"granted":true')
      );
      // Must NOT write to the legacy unscoped key.
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        'dreamz_ai_consent',
        expect.anything()
      );
    });

    it('falls back to per-user cache when Supabase errors (offline)', async () => {
      mockAuthUser(USER_ID);
      mockProfileSelect({ data: null, error: { message: 'Network error' } });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ granted: true, date: '2026-04-09T00:00:00Z' })
      );

      const result = await getAIConsent();

      expect(result).toEqual({ granted: true, date: '2026-04-09T00:00:00Z' });
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(USER_CACHE_KEY);
    });

    it('returns not-granted when offline and no cache exists', async () => {
      mockAuthUser(USER_ID);
      mockProfileSelect({ data: null, error: { message: 'Network error' } });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
    });

    it('returns not-granted when not authenticated', async () => {
      mockAuthUser(null);

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
      // Must not touch Supabase profiles when no user.
      expect(mockedSupabase.from).not.toHaveBeenCalled();
    });

    it('tolerates SecureStore native module missing on fallback', async () => {
      mockAuthUser(USER_ID);
      mockProfileSelect({ data: null, error: { message: 'Network error' } });
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error("Cannot find native module 'ExpoSecureStore'")
      );

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
    });
  });

  describe('refreshAIConsent', () => {
    it('deletes the cached entry and re-reads from Supabase', async () => {
      mockAuthUser(USER_ID);
      mockAuthUser(USER_ID); // called again inside getAIConsent
      mockProfileSelect({
        data: { ai_consent_granted: false, ai_consent_date: null },
        error: null,
      });

      const result = await refreshAIConsent();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(USER_CACHE_KEY);
      expect(result).toEqual({ granted: false, date: null });
    });
  });

  describe('grantAIConsent', () => {
    it('writes to both Supabase and the user-scoped cache on success', async () => {
      mockAuthUser(USER_ID);
      mockProfileUpdate({ error: null });

      await grantAIConsent();

      expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        USER_CACHE_KEY,
        expect.stringContaining('"granted":true')
      );
    });

    it('succeeds when SecureStore write throws (native module missing)', async () => {
      mockAuthUser(USER_ID);
      const eqMock = mockProfileUpdate({ error: null });
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error("Cannot find native module 'ExpoSecureStore'")
      );

      await expect(grantAIConsent()).resolves.toBeUndefined();
      expect(eqMock).toHaveBeenCalled();
    });

    it('throws when Supabase write fails, and does NOT poison the cache', async () => {
      mockAuthUser(USER_ID);
      mockProfileUpdate({ error: { message: 'Network error' } });

      await expect(grantAIConsent()).rejects.toThrow(/Network error/);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('throws when not authenticated', async () => {
      mockAuthUser(null);
      await expect(grantAIConsent()).rejects.toThrow(/Not authenticated/);
    });
  });

  describe('revokeAIConsent', () => {
    it('writes revoked state to both Supabase and the user-scoped cache', async () => {
      mockAuthUser(USER_ID);
      mockProfileUpdate({ error: null });

      await revokeAIConsent();

      expect(mockedSupabase.from).toHaveBeenCalledWith('profiles');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        USER_CACHE_KEY,
        JSON.stringify({ granted: false, date: null })
      );
    });

    it('succeeds when SecureStore write throws (native module missing)', async () => {
      mockAuthUser(USER_ID);
      const eqMock = mockProfileUpdate({ error: null });
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(
        new Error("Cannot find native module 'ExpoSecureStore'")
      );

      await expect(revokeAIConsent()).resolves.toBeUndefined();
      expect(eqMock).toHaveBeenCalled();
    });

    it('throws when Supabase write fails, and does NOT poison the cache', async () => {
      mockAuthUser(USER_ID);
      mockProfileUpdate({ error: { message: 'Network error' } });

      await expect(revokeAIConsent()).rejects.toThrow(/Network error/);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('throws when not authenticated', async () => {
      mockAuthUser(null);
      await expect(revokeAIConsent()).rejects.toThrow(/Not authenticated/);
    });
  });
});
