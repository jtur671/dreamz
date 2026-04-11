import { useState, useEffect, useCallback } from 'react';
import {
  getAIConsent,
  grantAIConsent as grantService,
  revokeAIConsent as revokeService,
  refreshAIConsent as refreshService,
} from '../lib/aiConsentService';

interface UseAIConsent {
  /** null = still loading, boolean = resolved consent state */
  hasConsent: boolean | null;
  grantConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
  /** Force a fresh read from Supabase, bypassing the local cache. */
  refreshConsent: () => Promise<boolean>;
}

export function useAIConsent(): UseAIConsent {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAIConsent()
      .then((state) => {
        if (!cancelled) setHasConsent(state.granted);
      })
      .catch((err) => {
        console.warn('[useAIConsent] failed to load consent state', err);
        if (!cancelled) setHasConsent(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grantConsent = useCallback(async () => {
    await grantService();
    setHasConsent(true);
  }, []);

  const revokeConsent = useCallback(async () => {
    await revokeService();
    setHasConsent(false);
  }, []);

  const refreshConsent = useCallback(async () => {
    const state = await refreshService();
    setHasConsent(state.granted);
    return state.granted;
  }, []);

  return { hasConsent, grantConsent, revokeConsent, refreshConsent };
}
