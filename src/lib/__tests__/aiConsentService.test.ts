/**
 * Tests for AI Consent Service
 * @file src/lib/__tests__/aiConsentService.test.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { getAIConsent, grantAIConsent, revokeAIConsent } from '../aiConsentService';

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const STORAGE_KEY = 'dreamz_ai_consent';

describe('AI Consent Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAIConsent', () => {
    it('should return cached AsyncStorage value when available', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ granted: true, date: '2026-04-09T00:00:00Z' })
      );

      const result = await getAIConsent();

      expect(result).toEqual({ granted: true, date: '2026-04-09T00:00:00Z' });
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should fall back to Supabase profile when AsyncStorage is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ai_consent_granted: true, ai_consent_date: '2026-04-09T00:00:00Z' },
          error: null,
        }),
      });

      const result = await getAIConsent();

      expect(result).toEqual({ granted: true, date: '2026-04-09T00:00:00Z' });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ granted: true, date: '2026-04-09T00:00:00Z' })
      );
    });

    it('should return false for new users with no consent record', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ai_consent_granted: false, ai_consent_date: null },
          error: null,
        }),
      });

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
    });

    it('should return false when not authenticated and no cache', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
    });
  });

  describe('grantAIConsent', () => {
    it('should write to both Supabase and AsyncStorage', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await grantAIConsent();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"granted":true')
      );
    });

    it('should still write AsyncStorage when Supabase fails', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: { message: 'Network error' } }),
      });

      await grantAIConsent();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"granted":true')
      );
    });
  });

  describe('revokeAIConsent', () => {
    it('should clear both Supabase and AsyncStorage', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await revokeAIConsent();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ granted: false, date: null })
      );
    });

    it('should still clear AsyncStorage when Supabase fails', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: { message: 'Network error' } }),
      });

      await revokeAIConsent();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ granted: false, date: null })
      );
    });
  });
});
