import React, { createContext, useState, useCallback, useEffect } from 'react';
import { fetchUserDreams } from '../lib/dreamService';
import type { Dream } from '../types';

interface DreamContextValue {
  dreams: Dream[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export const DreamContext = createContext<DreamContextValue>({
  dreams: [],
  loading: true,
  refresh: async () => {},
});

export function DreamProvider({ children }: { children: React.ReactNode }) {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await fetchUserDreams();
    if (result.success) {
      setDreams(result.dreams);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <DreamContext.Provider value={{ dreams, loading, refresh }}>
      {children}
    </DreamContext.Provider>
  );
}
