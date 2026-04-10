/**
 * Tests for Draft Service functions
 * @file src/lib/__tests__/draftService.test.ts
 */

// Mock expo-secure-store - must be before imports due to jest.mock hoisting
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}), { virtual: true });

import * as SecureStore from 'expo-secure-store';
import { saveDraft, loadDraft, clearDraft, hasDraft, DreamDraft } from '../draftService';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

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
    it('should save draft with timestamp to SecureStore', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await saveDraft({
        dreamText: 'I was flying over mountains',
        mood: 'peaceful',
        dreamType: 'dream',
      });

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
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
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await saveDraft({
        dreamText: 'Being chased through dark halls',
        mood: 'anxious',
        dreamType: 'nightmare',
      });

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'dreamz_draft',
        expect.stringContaining('"dreamType":"nightmare"')
      );
    });

    it('should silently fail on storage error', async () => {
      mockSecureStore.setItemAsync.mockRejectedValueOnce(new Error('Storage full'));

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
      mockSecureStore.getItemAsync.mockResolvedValue(null);

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
      mockSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(savedDraft));

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
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'dreamz_draft') return JSON.stringify(oldDraft);
        return null;
      });
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      const result = await loadDraft();

      expect(result).toBeNull();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('dreamz_draft');
    });

    it('should keep drafts exactly 7 days old', async () => {
      const sevenDayOldDraft: DreamDraft = {
        dreamText: 'Week old dream',
        mood: 'neutral',
        dreamType: 'dream',
        savedAt: '2025-01-08T10:00:00.000Z', // exactly 7 days ago
      };
      mockSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(sevenDayOldDraft));

      const result = await loadDraft();

      expect(result).toEqual(sevenDayOldDraft);
      expect(mockSecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });

    it('should return null on JSON parse error', async () => {
      mockSecureStore.getItemAsync.mockResolvedValueOnce('invalid json {{{');

      const result = await loadDraft();

      expect(result).toBeNull();
    });

    it('should return null on storage read error', async () => {
      mockSecureStore.getItemAsync.mockRejectedValueOnce(new Error('Read failed'));

      const result = await loadDraft();

      expect(result).toBeNull();
    });
  });

  describe('clearDraft', () => {
    it('should remove draft from SecureStore', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      await clearDraft();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('dreamz_draft');
    });

    it('should silently fail on storage error', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValueOnce(new Error('Remove failed'));

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
      mockSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(draft));

      const result = await hasDraft();

      expect(result).toBe(true);
    });

    it('should return false when no draft exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

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
      mockSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(emptyDraft));

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
      mockSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(whitespaceDraft));

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
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'dreamz_draft') return JSON.stringify(expiredDraft);
        return null;
      });
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      const result = await hasDraft();

      expect(result).toBe(false);
    });
  });
});
