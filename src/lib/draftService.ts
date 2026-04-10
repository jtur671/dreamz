import * as SecureStore from 'expo-secure-store';

const DRAFT_KEY = 'dreamz_draft';
const CHUNK_SIZE = 2048;

/**
 * A SecureStore-backed storage helper that handles values larger than
 * expo-secure-store's 2048-byte limit by transparently chunking.
 */
const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;
    const chunks: string[] = [];
    let i = 0;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (!chunk) break;
      chunks.push(chunk);
      i++;
    }
    return chunks.length > 0 ? chunks.join('') : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      let i = 0;
      while (true) {
        const existing = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (!existing) break;
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        i++;
      }
      return;
    }
    const chunks = value.match(/.{1,2048}/g) || [];
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
    }
    await SecureStore.deleteItemAsync(key);
    let j = chunks.length;
    while (true) {
      const existing = await SecureStore.getItemAsync(`${key}_chunk_${j}`);
      if (!existing) break;
      await SecureStore.deleteItemAsync(`${key}_chunk_${j}`);
      j++;
    }
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
    let i = 0;
    while (true) {
      const existing = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (!existing) break;
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      i++;
    }
  },
};

export interface DreamDraft {
  dreamText: string;
  mood?: string;
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
    await LargeSecureStore.setItem(DRAFT_KEY, JSON.stringify(draftWithTimestamp));
  } catch {
    // Silently fail - drafts are convenience, not critical
  }
}

/**
 * Loads a saved dream draft from local storage
 */
export async function loadDraft(): Promise<DreamDraft | null> {
  try {
    const data = await LargeSecureStore.getItem(DRAFT_KEY);
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
    await LargeSecureStore.removeItem(DRAFT_KEY);
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
