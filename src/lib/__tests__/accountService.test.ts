/**
 * Tests for Account Service functions (Export & Delete)
 * @file src/lib/__tests__/accountService.test.ts
 */

import { supabase } from '../supabase';
import { exportUserDreams, deleteUserAccount } from '../accountService';

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

interface TableMocks {
  dreams?: { data: unknown; error: { message: string } | null };
  profiles?: { data: unknown; error: { message: string } | null };
}

/**
 * Builds a from() mock that routes by table name, so tests can set up
 * independent responses for the parallel dreams + profiles queries used
 * by the GDPR-complete export.
 */
function mockFromByTable(tables: TableMocks) {
  (mockedSupabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(
          tables.profiles ?? { data: null, error: null }
        ),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue(
        tables.dreams ?? { data: [], error: null }
      ),
    };
  });
}

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
        data: { user: { id: 'user-123', email: 'dreamer@example.com' } },
        error: null,
      });

      mockFromByTable({
        dreams: { data: null, error: { message: 'Database error' } },
        profiles: { data: null, error: null },
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database error');
      }
    });

    it('should export dreams with privacy-safe format including profile', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'dreamer@example.com' } },
        error: null,
      });

      const mockDreams = [
        {
          dream_text: 'I was flying over mountains',
          mood: 4,
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

      const mockProfile = {
        display_name: 'Moon Walker',
        subscription_tier: 'premium',
        zodiac_sign: 'pisces',
        gender: 'non-binary',
        age_range: '25-34',
        reading_count: 12,
        created_at: '2025-11-01T08:00:00Z',
        ai_consent_granted: true,
        ai_consent_date: '2025-12-01T08:00:00Z',
      };

      mockFromByTable({
        dreams: { data: mockDreams, error: null },
        profiles: { data: mockProfile, error: null },
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.app).toBe('Dreamz');
        expect(result.data.format_version).toBe(2);
        expect(result.data.total_dreams).toBe(1);
        expect(result.data.dreams[0].entry_number).toBe(1);
        expect(result.data.dreams[0].dream_text).toBe('I was flying over mountains');
        expect(result.data.dreams[0].reading?.summary).toBe('Freedom awaits');
        expect(result.data.dreams[0].reading?.reflection).toBe('What holds you back?');
        // Verify no internal IDs
        expect(result.data.dreams[0]).not.toHaveProperty('id');
        expect(result.data.dreams[0]).not.toHaveProperty('user_id');
        // GDPR Art. 15/20 — verify profile + consent history are exported
        expect(result.data.profile.email).toBe('dreamer@example.com');
        expect(result.data.profile.display_name).toBe('Moon Walker');
        expect(result.data.profile.subscription_tier).toBe('premium');
        expect(result.data.profile.zodiac_sign).toBe('pisces');
        expect(result.data.profile.gender).toBe('non-binary');
        expect(result.data.profile.age_range).toBe('25-34');
        expect(result.data.profile.reading_count).toBe(12);
        expect(result.data.profile.ai_consent_granted).toBe(true);
        expect(result.data.profile.ai_consent_date).toBe('2025-12-01T08:00:00Z');
      }
    });

    it('should fall back to safe defaults when profile row is missing', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'lost@example.com' } },
        error: null,
      });

      mockFromByTable({
        dreams: { data: [], error: null },
        profiles: { data: null, error: null },
      });

      const result = await exportUserDreams();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.profile.email).toBe('lost@example.com');
        expect(result.data.profile.subscription_tier).toBe('free');
        expect(result.data.profile.ai_consent_granted).toBe(false);
        expect(result.data.profile.ai_consent_date).toBeNull();
        expect(result.data.profile.zodiac_sign).toBeNull();
      }
    });

    it('should handle dreams without readings', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'dreamer@example.com' } },
        error: null,
      });

      const mockDreams = [
        {
          dream_text: 'A simple dream',
          mood: 3,
          dream_type: 'nightmare',
          reading: null,
          created_at: '2026-02-01T10:00:00Z',
        },
      ];

      mockFromByTable({
        dreams: { data: mockDreams, error: null },
        profiles: {
          data: {
            subscription_tier: 'free',
            reading_count: 0,
            ai_consent_granted: false,
          },
          error: null,
        },
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
        data: { user: { id: 'user-123', email: 'dreamer@example.com' } },
        error: null,
      });

      mockFromByTable({
        dreams: { data: [], error: null },
        profiles: {
          data: {
            subscription_tier: 'free',
            reading_count: 0,
            ai_consent_granted: false,
          },
          error: null,
        },
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

    it('should call edge function and sign out on success', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      (mockedSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      (mockedSupabase.auth.signOut as jest.Mock).mockResolvedValueOnce({
        error: null,
      });

      const result = await deleteUserAccount();

      expect(result.success).toBe(true);
      expect(mockedSupabase.functions.invoke).toHaveBeenCalledWith(
        'delete-account',
        expect.objectContaining({ body: {} })
      );
      expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should return error when edge function returns error', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      (mockedSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to delete dreams' },
      });

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to delete dreams');
      }
    });

    it('should return error when response has no success flag', async () => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      (mockedSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: false },
        error: null,
      });

      const result = await deleteUserAccount();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to delete account');
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
