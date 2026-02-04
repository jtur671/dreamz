/**
 * Tests for Account Service functions (Export & Delete)
 * @file src/lib/__tests__/accountService.test.ts
 */

import { supabase } from '../supabase';
import { exportUserDreams, deleteUserAccount } from '../accountService';

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Account Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportUserDreams', () => {
    it('should return error when user is not authenticated', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
      }
    });

    it('should return error when database fetch fails', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database error');
      }
    });

    it('should export dreams with privacy-safe format', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockDreams = [
        {
          dream_text: 'I was flying over mountains',
          mood: 4,
          emotions: ['peaceful', 'excited'],
          dream_type: 'dream',
          reading: {
            title: 'The Soaring Spirit',
            tldr: 'Freedom awaits',
            symbols: [{ name: 'Mountain', meaning: 'Challenge' }],
            omen: 'Rise above',
            ritual: 'Look at the sky',
            journal_prompt: 'What holds you back?',
            tags: ['flying', 'freedom'],
          },
          created_at: '2026-02-01T10:00:00Z',
        },
      ];

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockDreams,
          error: null,
        }),
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app).toBe('Dreamz');
        expect(result.data.total_dreams).toBe(1);
        expect(result.data.dreams[0].entry_number).toBe(1);
        expect(result.data.dreams[0].dream_text).toBe('I was flying over mountains');
        expect(result.data.dreams[0].reading?.summary).toBe('Freedom awaits');
        expect(result.data.dreams[0].reading?.reflection).toBe('What holds you back?');
        // Verify no internal IDs
        expect(result.data.dreams[0]).not.toHaveProperty('id');
        expect(result.data.dreams[0]).not.toHaveProperty('user_id');
      }
    });

    it('should handle dreams without readings', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockDreams = [
        {
          dream_text: 'A simple dream',
          mood: 3,
          emotions: null,
          dream_type: 'nightmare',
          reading: null,
          created_at: '2026-02-01T10:00:00Z',
        },
      ];

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockDreams,
          error: null,
        }),
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dreams[0].reading).toBeNull();
        expect(result.data.dreams[0].type).toBe('nightmare');
      }
    });

    it('should return empty array when user has no dreams', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_dreams).toBe(0);
        expect(result.data.dreams).toEqual([]);
      }
    });

    it('should handle unexpected exceptions', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await exportUserDreams();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network error');
      }
    });

    it('should handle non-Error exceptions with fallback message', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce('Unknown error');

      const result = await exportUserDreams();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to export dreams');
      }
    });
  });

  describe('deleteUserAccount', () => {
    it('should return error when user is not authenticated', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
      }
    });

    it('should delete dreams, profile, and sign out successfully', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockDelete = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockResolvedValue({ error: null });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        delete: mockDelete,
        eq: mockEq,
      });

      (mockedSupabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
        error: null,
      });

      const result = await deleteUserAccount();

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('dreams');
      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should return error when dreams deletion fails', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Foreign key violation' },
        }),
      });

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to delete dreams');
      }
    });

    it('should return error when profile deletion fails', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      let callCount = 0;
      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockImplementation(() => ({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Dreams delete succeeds
            return Promise.resolve({ error: null });
          } else {
            // Profile delete fails
            return Promise.resolve({ error: { message: 'Profile not found' } });
          }
        }),
      }));

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to delete profile');
      }
    });

    it('should handle unexpected exceptions', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        new Error('Connection lost')
      );

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Connection lost');
      }
    });

    it('should handle non-Error exceptions with fallback message', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce({ code: 500 });

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to delete account');
      }
    });
  });
});
