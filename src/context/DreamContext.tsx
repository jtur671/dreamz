import React, { createContext, useState, useCallback, useEffect } from 'react';
import { fetchUserDreams } from '../lib/dreamService';
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

  return (
    <DreamContext.Provider value={{ dreams, loading, error, refresh }}>
      {children}
    </DreamContext.Provider>
  );
}
