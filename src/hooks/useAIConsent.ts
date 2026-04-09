import { useState, useEffect, useCallback } from 'react';
import {
  getAIConsent,
  grantAIConsent as grantService,
  revokeAIConsent as revokeService,
} from '../lib/aiConsentService';

interface UseAIConsent {
  /** null = still loading, boolean = resolved consent state */
  hasConsent: boolean | null;
  grantConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
}

export function useAIConsent(): UseAIConsent {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);

  useEffect(() => {
    getAIConsent().then((state) => {
      setHasConsent(state.granted);
    });
  }, []);

  const grantConsent = useCallback(async () => {
    await grantService();
    setHasConsent(true);
  }, []);

  const revokeConsent = useCallback(async () => {
    await revokeService();
    setHasConsent(false);
  }, []);

  return { hasConsent, grantConsent, revokeConsent };
}
