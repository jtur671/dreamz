/**
 * Tests for Profile Service functions
 * @file src/lib/__tests__/profileService.test.ts
 */

import { supabase } from '../supabase';
import { getProfile, updateZodiacSign } from '../profileService';

// Get the mocked supabase module
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Profile Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return null when user is not authenticated', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await getProfile();

      expect(result).toBeNull();
    });

    it('should return profile when user is authenticated', async () => {
      const mockUser = { id: 'user-123' };
      const mockProfile = {
        id: 'user-123',
        email: 'dreamer@example.com',
        display_name: 'Mystic Dreamer',
        reading_count: 5,
        subscription_tier: 'free',
        zodiac_sign: 'Scorpio',
        created_at: '2025-01-01T00:00:00Z',
      };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      });

      const result = await getProfile();

      expect(result).toEqual(mockProfile);
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('should return null when profile fetch fails', async () => {
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
          data: null,
          error: { message: 'Profile not found' },
        }),
      });

      const result = await getProfile();

      expect(result).toBeNull();
    });

    it('should return null when data is null without error', async () => {
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
          data: null,
          error: null,
        }),
      });

      const result = await getProfile();

      expect(result).toBeNull();
    });

    it('should return null on unexpected exception', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await getProfile();

      expect(result).toBeNull();
    });
  });

  describe('updateZodiacSign', () => {
    it('should return false when user is not authenticated', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await updateZodiacSign('Aries');

      expect(result).toBe(false);
    });

    it('should return true when zodiac sign is updated successfully', async () => {
      const mockUser = { id: 'user-123' };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const result = await updateZodiacSign('Pisces');

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('should return false when update fails', async () => {
      const mockUser = { id: 'user-123' };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      });

      const result = await updateZodiacSign('Leo');

      expect(result).toBe(false);
    });

    it('should return false on unexpected exception', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        new Error('Connection lost')
      );

      const result = await updateZodiacSign('Gemini');

      expect(result).toBe(false);
    });

    it('should update with correct zodiac sign value', async () => {
      const mockUser = { id: 'user-123' };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({ error: null });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: mockUpdate,
        eq: mockEq,
      });

      await updateZodiacSign('Capricorn');

      expect(mockUpdate).toHaveBeenCalledWith({ zodiac_sign: 'Capricorn' });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });
  });
});
