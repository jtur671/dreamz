import { useEffect, useState } from 'react';

/**
 * Visible bootstrap diagnostic. Updated by App.tsx as the initial session
 * check progresses so a small footer on AuthScreen can surface "checking
 * session…" text if anything gets stuck.
 *
 * Lives outside the React tree because App.tsx kicks off `getSession()` at
 * module-load time (before any component mounts), and we want a single
 * global signal all screens can subscribe to without context plumbing.
 *
 * iOS 26 privacy redaction hides React Native `console.*` output from
 * `idevicesyslog`, so on-screen text is the only practical debug channel
 * we have in production.
 */
export type BootstrapStatus = 'pending' | 'ready' | 'failed';

let current: BootstrapStatus = 'pending';
const listeners = new Set<(s: BootstrapStatus) => void>();

export function setBootstrapStatus(next: BootstrapStatus) {
  current = next;
  listeners.forEach((l) => l(next));
}

export function getBootstrapStatus(): BootstrapStatus {
  return current;
}

export function useBootstrapStatus(): BootstrapStatus {
  const [value, setValue] = useState<BootstrapStatus>(current);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
