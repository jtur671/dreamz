/**
 * Tests for Dream Service functions
 * @file src/lib/__tests__/dreamService.test.ts
 */

import { supabase, getFreshAccessToken } from '../supabase';

// Get the mocked supabase module
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;
const mockedGetFreshAccessToken = getFreshAccessToken as jest.MockedFunction<typeof getFreshAccessToken>;

// Valid mock reading fixture for tests (must have 3-7 symbols and 3-7 tags)
const validReading = {
  title: 'The Wandering Moon',
  tldr: 'A journey of self-discovery awaits',
  symbols: [
    { name: 'Moon', meaning: 'Intuition', shadow: 'Confusion', guidance: 'Trust your instincts' },
    { name: 'Path', meaning: 'Direction', shadow: 'Uncertainty', guidance: 'Keep walking' },
    { name: 'Stars', meaning: 'Hope', shadow: 'Distance', guidance: 'Look up' },
  ],
  omen: 'Change approaches',
  ritual: 'Light a white candle at dusk',
  journal_prompt: 'What does the moon mean to you?',
  tags: ['lunar', 'journey', 'transformation'],
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
    const invokeMock = mockedSupabase.functions.invoke as unknown as jest.Mock;

    beforeEach(() => {
      invokeMock.mockReset();
    });
    it('should require authentication to analyze a dream', async () => {
      const { analyzeDream } = require('../dreamService');

      // getFreshAccessToken returns null when not authenticated
      mockedGetFreshAccessToken.mockResolvedValueOnce(null);

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
      }

      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('should call the analyze-dream edge function when authenticated', async () => {
      const { analyzeDream } = require('../dreamService');

      // Mock authenticated state
      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      const mockReading = validReading;

      invokeMock.mockResolvedValueOnce({
        data: { reading: mockReading },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream', { mood: 'Happy' });

      // No explicit Authorization header — the Supabase client sets it
      // automatically via the session. We only verify body contents.
      expect(invokeMock).toHaveBeenCalledWith(
        'analyze-dream',
        expect.objectContaining({
          body: expect.objectContaining({
            dream_text: 'Test dream',
            mood: 'Happy',
          }),
        })
      );

      expect(result.success).toBe(true);
    });

    it('should handle error with FunctionsHttpError context', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      // Simulate FunctionsHttpError: context is a Response with .json()
      invokeMock.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            json: jest.fn().mockResolvedValue({
              error: { code: 'VALIDATION_ERROR', message: 'Dream text too short' },
            }),
          },
        },
      });

      const result = await analyzeDream('Hi');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Dream text too short');
      }
    });

    it('should fallback to error.message when no context', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'Some plain error' },
      });

      const result = await analyzeDream('Hi');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Some plain error');
      }
    });

    it('should handle FunctionsHttpError when context.json() fails', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
          },
        },
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        // Falls back to error.message when context.json() fails
        expect(result.error).toBe('Edge Function returned a non-2xx status code');
      }
    });

    it('should return reading when response is valid', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      invokeMock.mockResolvedValueOnce({
        data: validReading,
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream', { mood: 'Peaceful' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reading).toEqual(validReading);
      }
    });

    it('should extract reading from nested response structure', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      invokeMock.mockResolvedValueOnce({
        data: { reading: validReading },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream', { dreamId: 'dream-123' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reading).toEqual(validReading);
      }
    });

    it('should reject invalid reading structure', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      const invalidReading = {
        title: 'Missing fields',
        // missing tldr, symbols, omen, ritual, journal_prompt, tags
      };

      invokeMock.mockResolvedValueOnce({
        data: invalidReading,
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should handle fetch network errors', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      invokeMock.mockRejectedValueOnce(new Error('Network request failed'));

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network request failed');
      }
    });

    it('should handle non-Error exceptions with fallback', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      invokeMock.mockRejectedValueOnce('Connection refused');

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to analyze dream');
      }
    });

    it('should reject null reading by catching exception', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject undefined reading via isValidReading', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      // Return an object where both data.reading and data itself fail isValidReading
      invokeMock.mockResolvedValueOnce({
        data: { reading: undefined },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with empty symbols array', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      const readingWithEmptySymbols = {
        ...validReading,
        symbols: [],
      };

      invokeMock.mockResolvedValueOnce({
        data: readingWithEmptySymbols,
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with non-array symbols', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      const readingWithInvalidSymbols = {
        ...validReading,
        symbols: 'not an array',
      };

      invokeMock.mockResolvedValueOnce({
        data: readingWithInvalidSymbols,
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with non-array tags', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      const readingWithInvalidTags = {
        ...validReading,
        tags: 'not an array',
      };

      invokeMock.mockResolvedValueOnce({
        data: readingWithInvalidTags,
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading with non-string title', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      const readingWithInvalidTitle = {
        ...validReading,
        title: 123,
      };

      invokeMock.mockResolvedValueOnce({
        data: readingWithInvalidTitle,
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid reading format received');
      }
    });

    it('should reject reading when response is a non-object primitive', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce('test-token');

      // Return a string instead of an object - this tests line 140 (typeof reading !== 'object')
      invokeMock.mockResolvedValueOnce({
        data: 'just a string',
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

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
