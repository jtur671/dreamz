/**
 * Tests for Draft Service functions
 * @file src/lib/__tests__/draftService.test.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveDraft, loadDraft, clearDraft, hasDraft, DreamDraft } from '../draftService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('Draft Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('saveDraft', () => {
    it('should save draft with timestamp to AsyncStorage', async () => {
      mockedAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await saveDraft({
        dreamText: 'I was flying over mountains',
        mood: 'peaceful',
        dreamType: 'dream',
      });

      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        'dreamz_draft',
        JSON.stringify({
          dreamText: 'I was flying over mountains',
          mood: 'peaceful',
          dreamType: 'dream',
          savedAt: '2025-01-15T10:00:00.000Z',
        })
      );
    });

    it('should save nightmare draft', async () => {
      mockedAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await saveDraft({
        dreamText: 'Being chased through dark halls',
        mood: 'anxious',
        dreamType: 'nightmare',
      });

      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        'dreamz_draft',
        expect.stringContaining('"dreamType":"nightmare"')
      );
    });

    it('should silently fail on storage error', async () => {
      mockedAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));

      // Should not throw
      await expect(
        saveDraft({
          dreamText: 'Test dream',
          mood: 'neutral',
          dreamType: 'dream',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('loadDraft', () => {
    it('should return null when no draft exists', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await loadDraft();

      expect(result).toBeNull();
    });

    it('should return draft when one exists', async () => {
      const savedDraft: DreamDraft = {
        dreamText: 'A mystical journey',
        mood: 'curious',
        dreamType: 'dream',
        savedAt: '2025-01-15T09:00:00.000Z',
      };
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(savedDraft));

      const result = await loadDraft();

      expect(result).toEqual(savedDraft);
    });

    it('should clear and return null for drafts older than 7 days', async () => {
      const oldDraft: DreamDraft = {
        dreamText: 'Old forgotten dream',
        mood: 'vague',
        dreamType: 'dream',
        savedAt: '2025-01-01T10:00:00.000Z', // 14 days ago
      };
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(oldDraft));
      mockedAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      const result = await loadDraft();

      expect(result).toBeNull();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith('dreamz_draft');
    });

    it('should keep drafts exactly 7 days old', async () => {
      const sevenDayOldDraft: DreamDraft = {
        dreamText: 'Week old dream',
        mood: 'neutral',
        dreamType: 'dream',
        savedAt: '2025-01-08T10:00:00.000Z', // exactly 7 days ago
      };
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(sevenDayOldDraft));

      const result = await loadDraft();

      expect(result).toEqual(sevenDayOldDraft);
      expect(mockedAsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should return null on JSON parse error', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce('invalid json {{{');

      const result = await loadDraft();

      expect(result).toBeNull();
    });

    it('should return null on storage read error', async () => {
      mockedAsyncStorage.getItem.mockRejectedValueOnce(new Error('Read failed'));

      const result = await loadDraft();

      expect(result).toBeNull();
    });
  });

  describe('clearDraft', () => {
    it('should remove draft from AsyncStorage', async () => {
      mockedAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      await clearDraft();

      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith('dreamz_draft');
    });

    it('should silently fail on storage error', async () => {
      mockedAsyncStorage.removeItem.mockRejectedValueOnce(new Error('Remove failed'));

      // Should not throw
      await expect(clearDraft()).resolves.toBeUndefined();
    });
  });

  describe('hasDraft', () => {
    it('should return true when draft with content exists', async () => {
      const draft: DreamDraft = {
        dreamText: 'Some dream content',
        mood: 'happy',
        dreamType: 'dream',
        savedAt: '2025-01-15T09:00:00.000Z',
      };
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(draft));

      const result = await hasDraft();

      expect(result).toBe(true);
    });

    it('should return false when no draft exists', async () => {
      mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await hasDraft();

      expect(result).toBe(false);
    });

    it('should return false when draft text is empty', async () => {
      const emptyDraft: DreamDraft = {
        dreamText: '',
        mood: '',
        dreamType: 'dream',
        savedAt: '2025-01-15T09:00:00.000Z',
      };
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(emptyDraft));

      const result = await hasDraft();

      expect(result).toBe(false);
    });

    it('should return false when draft text is only whitespace', async () => {
      const whitespaceDraft: DreamDraft = {
        dreamText: '   \n\t  ',
        mood: 'confused',
        dreamType: 'dream',
        savedAt: '2025-01-15T09:00:00.000Z',
      };
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(whitespaceDraft));

      const result = await hasDraft();

      expect(result).toBe(false);
    });

    it('should return false for expired draft', async () => {
      const expiredDraft: DreamDraft = {
        dreamText: 'Old dream with content',
        mood: 'nostalgic',
        dreamType: 'dream',
        savedAt: '2025-01-01T10:00:00.000Z', // expired
      };
      mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(expiredDraft));
      mockedAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      const result = await hasDraft();

      expect(result).toBe(false);
    });
  });
});
