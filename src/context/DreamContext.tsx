import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';
import { fetchUserDreams, generateDreamImage } from '../lib/dreamService';
import type { Dream } from '../types';

interface DreamContextValue {
  dreams: Dream[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const DreamContext = createContext<DreamContextValue>({
  dreams: [],
  loading: true,
  error: null,
  refresh: async () => {},
});

export function DreamProvider({ children }: { children: React.ReactNode }) {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `loading` is true only for the initial fetch (full-screen spinner).
  // Subsequent refreshes (pull-to-refresh, tab focus) update silently
  // to avoid flashing the loading screen. Callers manage their own
  // refreshing indicators (e.g. GrimoireScreen's `refreshing` state).
  const refresh = useCallback(async () => {
    const result = await fetchUserDreams();
    if (result.success) {
      setDreams(result.dreams);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Background image backfill: after initial load, find dreams with readings
  // but no image and generate images one at a time without blocking the UI.
  const backfillRan = useRef(false);

  useEffect(() => {
    if (loading || backfillRan.current || dreams.length === 0) return;
    backfillRan.current = true;

    const dreamsNeedingImages = dreams.filter(
      (d) => d.reading && !d.reading.image_url && d.dream_text
    );

    if (dreamsNeedingImages.length === 0) return;

    (async () => {
      for (const dream of dreamsNeedingImages) {
        try {
          const symbolName = dream.reading?.symbols?.[0]?.name;
          const result = await generateDreamImage(dream.id, dream.dream_text, symbolName);
          if (result.success) {
            setDreams((prev) =>
              prev.map((d) =>
                d.id === dream.id && d.reading
                  ? { ...d, reading: { ...d.reading, image_url: result.image_url } }
                  : d
              )
            );
          }
        } catch {
          // Skip failures silently — content filter rejections, network errors, etc.
        }
      }
    })();
  }, [loading, dreams]);

  return (
    <DreamContext.Provider value={{ dreams, loading, error, refresh }}>
      {children}
    </DreamContext.Provider>
  );
}
