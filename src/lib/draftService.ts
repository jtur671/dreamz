import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_KEY = 'dreamz_draft';

export interface DreamDraft {
  dreamText: string;
  mood?: string;  // Optional - kept for backwards compatibility with old drafts
  dreamType: 'dream' | 'nightmare';
  savedAt: string;
}

/**
 * Saves a dream draft to local storage
 */
export async function saveDraft(draft: Omit<DreamDraft, 'savedAt'>): Promise<void> {
  try {
    const draftWithTimestamp: DreamDraft = {
      ...draft,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draftWithTimestamp));
  } catch {
    // Silently fail - drafts are convenience, not critical
  }
}

/**
 * Loads a saved dream draft from local storage
 */
export async function loadDraft(): Promise<DreamDraft | null> {
  try {
    const data = await AsyncStorage.getItem(DRAFT_KEY);
    if (!data) return null;

    const draft = JSON.parse(data) as DreamDraft;

    // Check if draft is older than 7 days - clear stale drafts
    const savedAt = new Date(draft.savedAt);
    const now = new Date();
    const daysDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      await clearDraft();
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

/**
 * Clears the saved dream draft
 */
export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Checks if a draft exists and has content
 */
export async function hasDraft(): Promise<boolean> {
  const draft = await loadDraft();
  return draft !== null && draft.dreamText.trim().length > 0;
}
