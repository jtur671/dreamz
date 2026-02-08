/**
 * Integration tests for API endpoints
 * @file src/lib/__tests__/api.integration.test.ts
 *
 * These tests verify the Edge Function contracts and response formats.
 * Run with: npm run test:api
 *
 * Note: These tests mock the network layer but verify the full request/response
 * contract that the Edge Function must satisfy.
 */

import { supabase, getFreshAccessToken } from '../supabase';
import type { DreamReading } from '../../types';

// Get mocked supabase
const mockedSupabase = supabase as jest.Mocked<typeof supabase>;
const mockedGetFreshAccessToken = getFreshAccessToken as jest.MockedFunction<typeof getFreshAccessToken>;
const invokeMock = mockedSupabase.functions.invoke as unknown as jest.Mock;

// Valid reading that matches the AI Reading Contract
const VALID_READING: DreamReading = {
  title: 'The Wandering Moon',
  tldr: 'A journey through the subconscious reveals hidden truths',
  symbols: [
    {
      name: 'Moon',
      meaning: 'Intuition and inner wisdom',
      shadow: 'Hidden fears or denial',
      guidance: 'Trust your instincts in the coming days',
    },
    {
      name: 'Water',
      meaning: 'Emotions and the unconscious',
      shadow: 'Overwhelming feelings',
      guidance: 'Allow yourself to feel without judgment',
    },
    {
      name: 'Forest',
      meaning: 'The unknown path ahead',
      shadow: 'Fear of getting lost',
      guidance: 'Each step reveals the next',
    },
  ],
  omen: 'Change approaches like a tide - resist not, but flow with it',
  ritual: 'Light a white candle at dusk and write three wishes on paper',
  journal_prompt: 'What does the moon illuminate in your waking life?',
  tags: ['lunar', 'water', 'journey', 'intuition'],
};

// Mock session for authenticated requests
const MOCK_SESSION = {
  access_token: 'test-access-token-12345',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'user-123',
    email: 'test@dreamz.app',
  },
};

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invokeMock.mockReset();
  });

  describe('analyze-dream Edge Function Contract', () => {
    it('should accept valid request with dream_text only', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce(MOCK_SESSION.access_token);

      invokeMock.mockResolvedValueOnce({
        data: { reading: VALID_READING },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('I dreamed of walking through a moonlit forest');

      // No explicit Authorization header — the Supabase client sets it
      // automatically via the session. We only verify body contents.
      expect(invokeMock).toHaveBeenCalledWith(
        'analyze-dream',
        expect.objectContaining({
          body: expect.objectContaining({ dream_text: 'I dreamed of walking through a moonlit forest' }),
        }),
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reading).toEqual(VALID_READING);
      }
    });

    it('should accept valid request with dream_text and mood', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce(MOCK_SESSION.access_token);

      invokeMock.mockResolvedValueOnce({
        data: { reading: VALID_READING },
        error: null,
        status: 200,
      });

      await analyzeDream('I dreamed of flying', { mood: 'Peaceful' });

      const request = invokeMock.mock.calls[0][1];
      const requestBody = request.body;

      expect(requestBody.dream_text).toEqual('I dreamed of flying');
      expect(requestBody.mood).toEqual('Peaceful');
    });

    it('should accept valid request with dream_text, mood, and dream_id', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce(MOCK_SESSION.access_token);

      invokeMock.mockResolvedValueOnce({
        data: { reading: VALID_READING },
        error: null,
        status: 200,
      });

      await analyzeDream('I dreamed of flying', { mood: 'Peaceful', dreamId: 'dream-uuid-123' });

      const request = invokeMock.mock.calls[0][1];
      const requestBody = request.body;

      expect(requestBody.dream_text).toEqual('I dreamed of flying');
      expect(requestBody.mood).toEqual('Peaceful');
      expect(requestBody.dream_id).toEqual('dream-uuid-123');
    });

    it('should pass all profile context to the edge function', async () => {
      const { analyzeDream } = require('../dreamService');

      mockedGetFreshAccessToken.mockResolvedValueOnce(MOCK_SESSION.access_token);

      invokeMock.mockResolvedValueOnce({
        data: { reading: VALID_READING },
        error: null,
        status: 200,
      });

      await analyzeDream('I dreamed of flying', {
        mood: 'Peaceful',
        dreamId: 'dream-uuid-123',
        zodiacSign: 'Pisces',
        gender: 'non-binary',
        ageRange: '25-34',
      });

      const request = invokeMock.mock.calls[0][1];
      const requestBody = request.body;

      expect(requestBody.dream_text).toEqual('I dreamed of flying');
      expect(requestBody.mood).toEqual('Peaceful');
      expect(requestBody.dream_id).toEqual('dream-uuid-123');
      expect(requestBody.zodiac_sign).toEqual('Pisces');
      expect(requestBody.gender).toEqual('non-binary');
      expect(requestBody.age_range).toEqual('25-34');
    });

    it('should require Authorization header', async () => {
      const { analyzeDream } = require('../dreamService');

      // getFreshAccessToken returns null when not authenticated
      mockedGetFreshAccessToken.mockResolvedValueOnce(null);

      const result = await analyzeDream('Test dream');

      expect(invokeMock).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Not authenticated');
      }
    });
  });

  describe('analyze-dream Response Contract', () => {
    beforeEach(() => {
      // Mock authenticated state for all tests in this block
      mockedGetFreshAccessToken.mockResolvedValue(MOCK_SESSION.access_token);
    });

    it('should return valid DreamReading with all required fields', async () => {
      const { analyzeDream } = require('../dreamService');

      invokeMock.mockResolvedValueOnce({
        data: { reading: VALID_READING },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify all required fields exist
        expect(result.reading).toHaveProperty('title');
        expect(result.reading).toHaveProperty('tldr');
        expect(result.reading).toHaveProperty('symbols');
        expect(result.reading).toHaveProperty('omen');
        expect(result.reading).toHaveProperty('ritual');
        expect(result.reading).toHaveProperty('journal_prompt');
        expect(result.reading).toHaveProperty('tags');

        // Verify types
        expect(typeof result.reading.title).toBe('string');
        expect(typeof result.reading.tldr).toBe('string');
        expect(Array.isArray(result.reading.symbols)).toBe(true);
        expect(typeof result.reading.omen).toBe('string');
        expect(typeof result.reading.ritual).toBe('string');
        expect(typeof result.reading.journal_prompt).toBe('string');
        expect(Array.isArray(result.reading.tags)).toBe(true);
      }
    });

    it('should have symbols with required structure', async () => {
      const { analyzeDream } = require('../dreamService');

      invokeMock.mockResolvedValueOnce({
        data: { reading: VALID_READING },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reading.symbols.length).toBeGreaterThanOrEqual(1);

        result.reading.symbols.forEach((symbol: { name: string; meaning: string; shadow: string; guidance: string }) => {
          expect(symbol).toHaveProperty('name');
          expect(symbol).toHaveProperty('meaning');
          expect(symbol).toHaveProperty('shadow');
          expect(symbol).toHaveProperty('guidance');
          expect(typeof symbol.name).toBe('string');
          expect(typeof symbol.meaning).toBe('string');
          expect(typeof symbol.shadow).toBe('string');
          expect(typeof symbol.guidance).toBe('string');
        });
      }
    });

    it('should have 3-7 symbols per reading (MVP spec)', async () => {
      const { analyzeDream } = require('../dreamService');

      invokeMock.mockResolvedValueOnce({
        data: { reading: VALID_READING },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.reading.symbols.length).toBeGreaterThanOrEqual(3);
        expect(result.reading.symbols.length).toBeLessThanOrEqual(7);
      }
    });

    it('should handle 401 Unauthorized response', async () => {
      const { analyzeDream } = require('../dreamService');

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid or expired token' },
        status: 401,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid or expired token');
      }
    });

    it('should handle 429 Rate Limit response', async () => {
      const { analyzeDream } = require('../dreamService');

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded' },
        status: 429,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Rate limit');
      }
    });

    it('should handle 500 Internal Server Error response', async () => {
      const { analyzeDream } = require('../dreamService');

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'Internal server error' },
        status: 500,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Internal server error');
      }
    });

    it('should handle malformed JSON response gracefully', async () => {
      const { analyzeDream } = require('../dreamService');

      invokeMock.mockRejectedValueOnce(new Error('Invalid JSON'));

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
    });

    it('should reject reading missing title field', async () => {
      const { analyzeDream } = require('../dreamService');

      const invalidReading = { ...VALID_READING };
      delete (invalidReading as any).title;

      invokeMock.mockResolvedValueOnce({
        data: { reading: invalidReading },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid reading format');
      }
    });

    it('should reject reading with empty symbols array', async () => {
      const { analyzeDream } = require('../dreamService');

      const invalidReading = { ...VALID_READING, symbols: [] };

      invokeMock.mockResolvedValueOnce({
        data: { reading: invalidReading },
        error: null,
        status: 200,
      });

      const result = await analyzeDream('Test dream');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid reading format');
      }
    });
  });

  describe('Dreams CRUD API Contract', () => {
    const mockUser = { id: 'user-123', email: 'test@dreamz.app' };
    const mockDream = {
      id: 'dream-uuid-456',
      user_id: 'user-123',
      dream_text: 'I dreamed of flying',
      mood: 'Peaceful',
      reading: null,
      created_at: '2026-02-02T10:00:00Z',
      updated_at: '2026-02-02T10:00:00Z',
    };

    beforeEach(() => {
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it('should create dream with required fields', async () => {
      const { saveDream } = require('../dreamService');

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockDream,
          error: null,
        }),
      });

      const result = await saveDream('I dreamed of flying', 'Peaceful');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.dream).toHaveProperty('id');
        expect(result.dream).toHaveProperty('user_id');
        expect(result.dream).toHaveProperty('dream_text');
        expect(result.dream).toHaveProperty('created_at');
      }

      // Verify the insert was called with correct structure
      expect(mockFrom).toHaveBeenCalledWith('dreams');
    });

    it('should update dream with reading', async () => {
      const { updateDreamWithReading } = require('../dreamService');

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockDream, reading: VALID_READING },
          error: null,
        }),
      });

      const result = await updateDreamWithReading('dream-uuid-456', VALID_READING);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.dream.reading).toEqual(VALID_READING);
      }
    });

    it('should enforce user ownership on update (RLS)', async () => {
      const { updateDreamWithReading } = require('../dreamService');

      const mockFrom = mockedSupabase.from as jest.Mock;
      const mockEq = jest.fn().mockReturnThis();

      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: mockEq,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockDream, reading: VALID_READING },
          error: null,
        }),
      });

      await updateDreamWithReading('dream-uuid-456', VALID_READING);

      // Verify that eq was called with user_id for RLS
      expect(mockEq).toHaveBeenCalledWith('id', 'dream-uuid-456');
      expect(mockEq).toHaveBeenCalledWith('user_id', mockUser.id);
    });
  });
});
