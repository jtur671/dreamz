/**
 * Tests for Dream Service functions
 * @file src/lib/__tests__/dreamService.test.ts
 */

import { supabase } from '../supabase';

// Get the mocked supabase module
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

// Valid mock reading fixture for tests
const validReading = {
  title: 'The Wandering Moon',
  tldr: 'A journey of self-discovery awaits',
  symbols: [
    { name: 'Moon', meaning: 'Intuition', shadow: 'Confusion', guidance: 'Trust your instincts' },
  ],
  omen: 'Change approaches',
  ritual: 'Light a white candle at dusk',
  journal_prompt: 'What does the moon mean to you?',
  tags: ['lunar', 'journey'],
};

describe('Dream Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveDream functionality', () => {
    it('should require authentication to save a dream', async () => {
      // Import the service after mocks are set up
      const { saveDream } = require('../dreamService');

      // Mock unauthenticated user
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await saveDream('Test dream', undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
      }
    });

    it('should call supabase.from with dreams table', async () => {
      const { saveDream } = require('../dreamService');

      const mockUser = { id: 'test-user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'dream-123', dream_text: 'Test dream' },
          error: null,
        }),
      });

      await saveDream('Test dream', 'Peaceful');

      expect(mockFrom).toHaveBeenCalledWith('dreams');
    });

    it('should save dream successfully when authenticated', async () => {
      const { saveDream } = require('../dreamService');

      const mockUser = { id: 'test-user-123' };
      const mockDream = {
        id: 'dream-123',
        user_id: 'test-user-123',
        dream_text: 'A beautiful dream',
        mood: 'Peaceful',
      };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockDream,
          error: null,
        }),
      });

      const result = await saveDream('A beautiful dream', 'Peaceful');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.dream).toEqual(mockDream);
      }
    });

    it('should return error when database insert fails', async () => {
      const { saveDream } = require('../dreamService');

      const mockUser = { id: 'test-user-123' };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      });

      const result = await saveDream('Test dream', undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database connection failed');
      }
    });

    it('should handle unexpected exceptions gracefully', async () => {
      const { saveDream } = require('../dreamService');

      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await saveDream('Test dream', undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network error');
      }
    });

    it('should handle non-Error exceptions with fallback message', async () => {
      const { saveDream } = require('../dreamService');

      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        'String error thrown'
      );

      const result = await saveDream('Test dream', undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to save dream');
      }
    });
  });

  describe('analyzeDream functionality', () => {
    it('should require authentication to analyze a dream', async () => {
      const { analyzeDream } = require('../dreamService');

      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
      }
    });

    it('should call the analyze-dream edge function when authenticated', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const mockReading = {
        title: 'Test Reading',
        tldr: 'Test summary',
        symbols: [
          { name: 'Test', meaning: 'Test', shadow: 'Test', guidance: 'Test' },
          { name: 'Test2', meaning: 'Test', shadow: 'Test', guidance: 'Test' },
          { name: 'Test3', meaning: 'Test', shadow: 'Test', guidance: 'Test' },
        ],
        omen: 'Test omen',
        ritual: 'Test ritual',
        journal_prompt: 'Test prompt?',
        tags: ['test'],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true, data: mockReading }),
      });

      const result = await analyzeDream('Test dream', 'Happy', undefined);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('analyze-dream'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockSession.access_token}`,
          }),
        })
      );
    });

    it('should handle non-ok response with error message in body', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Dream text too short' }),
      });

      const result = await analyzeDream('Hi', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Dream text too short');
      }
    });

    it('should handle non-ok response when JSON parsing fails', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Analysis failed (500)');
      }
    });

    it('should use status code fallback when error field missing', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: jest.fn().mockResolvedValue({ message: 'Service unavailable' }),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Analysis failed (503)');
      }
    });

    it('should return reading when response is valid', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(validReading),
      });

      const result = await analyzeDream('Test dream', 'Peaceful', undefined);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reading).toEqual(validReading);
      }
    });

    it('should extract reading from nested response structure', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ reading: validReading }),
      });

      const result = await analyzeDream('Test dream', undefined, 'dream-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reading).toEqual(validReading);
      }
    });

    it('should reject invalid reading structure', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const invalidReading = {
        title: 'Missing fields',
        // missing tldr, symbols, omen, ritual, journal_prompt, tags
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(invalidReading),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should handle fetch network errors', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed')
      );

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network request failed');
      }
    });

    it('should handle non-Error exceptions with fallback', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      (global.fetch as jest.Mock).mockRejectedValueOnce('Connection refused');

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to analyze dream');
      }
    });

    it('should reject null reading by catching exception', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      // When response.json() returns null, accessing data.reading throws
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(null),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      // The null access throws an error that gets caught in the catch block
      if (!result.success) {
        expect(result.error).toContain('Cannot read properties of null');
      }
    });

    it('should reject undefined reading via isValidReading', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      // Return an object where both data.reading and data itself fail isValidReading
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ reading: undefined }),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with empty symbols array', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const readingWithEmptySymbols = {
        ...validReading,
        symbols: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(readingWithEmptySymbols),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with non-array symbols', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const readingWithInvalidSymbols = {
        ...validReading,
        symbols: 'not an array',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(readingWithInvalidSymbols),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with non-array tags', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const readingWithInvalidTags = {
        ...validReading,
        tags: 'not an array',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(readingWithInvalidTags),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with non-string title', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const readingWithInvalidTitle = {
        ...validReading,
        title: 123,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(readingWithInvalidTitle),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading when response is a non-object primitive', async () => {
      const { analyzeDream } = require('../dreamService');

      const mockSession = { access_token: 'test-token' };
      (mockedSupabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      // Return a string instead of an object - this tests line 140 (typeof reading !== 'object')
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue('just a string'),
      });

      const result = await analyzeDream('Test dream', undefined, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });
  });

  describe('updateDreamWithReading functionality', () => {
    it('should require authentication to update a dream', async () => {
      const { updateDreamWithReading } = require('../dreamService');

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const mockReading = {
        title: 'Test',
        tldr: 'Test',
        symbols: [],
        omen: 'Test',
        ritual: 'Test',
        journal_prompt: 'Test?',
        tags: [],
      };

      const result = await updateDreamWithReading('dream-123', mockReading);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
      }
    });

    it('should update dream with reading successfully', async () => {
      const { updateDreamWithReading } = require('../dreamService');

      const mockUser = { id: 'test-user-123' };
      const updatedDream = {
        id: 'dream-123',
        user_id: 'test-user-123',
        dream_text: 'Test dream',
        reading: validReading,
      };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: updatedDream,
          error: null,
        }),
      });

      const result = await updateDreamWithReading('dream-123', validReading);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.dream).toEqual(updatedDream);
      }
      expect(mockFrom).toHaveBeenCalledWith('dreams');
    });

    it('should return error when database update fails', async () => {
      const { updateDreamWithReading } = require('../dreamService');

      const mockUser = { id: 'test-user-123' };

      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Dream not found' },
        }),
      });

      const result = await updateDreamWithReading('dream-123', validReading);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Dream not found');
      }
    });

    it('should handle unexpected exceptions gracefully', async () => {
      const { updateDreamWithReading } = require('../dreamService');

      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      const result = await updateDreamWithReading('dream-123', validReading);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database connection lost');
      }
    });

    it('should handle non-Error exceptions with fallback', async () => {
      const { updateDreamWithReading } = require('../dreamService');

      (mockedSupabase.auth.getUser as jest.Mock).mockRejectedValueOnce(
        { code: 'UNKNOWN' }
      );

      const result = await updateDreamWithReading('dream-123', validReading);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to update dream');
      }
    });
  });
});
