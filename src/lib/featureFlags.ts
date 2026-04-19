/**
 * Runtime feature flags. Change values in this file and ship via
 * `eas update --channel production` to enable/disable features in
 * production without a new binary or Apple review.
 *
 * Intended for emergency mitigations — not a long-term config system.
 */
export const featureFlags = {
  /** Apple Sign-In button on AuthScreen. Flip off if the Apple-specific path is broken. */
  appleSignInEnabled: true,

  /** Google Sign-In button on AuthScreen. Flip off if the Google-specific path is broken. */
  googleSignInEnabled: true,

  /**
   * Fetch the user's profile during App.tsx cold-start (to decide Onboarding vs MainTabs).
   * Flip off if profile fetches are hanging for many users — the app will default to
   * MainTabs, and onboarding-state will be reconciled lazily on next interaction.
   */
  bootstrapProfileFetchEnabled: true,
} as const;
