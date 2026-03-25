// Shared navigation ref for password reset flow.
// Set by App.tsx, used by VerifyResetCodeScreen to navigate after OTP login.
import type { NavigationContainerRef } from '@react-navigation/native';

let navRef: NavigationContainerRef<any> | null = null;

export function setNavRef(ref: NavigationContainerRef<any> | null) {
  navRef = ref;
}

/**
 * After OTP login in reset mode, poll until the authenticated navigator
 * has mounted (session set → ResetPassword screen available), then navigate.
 */
export function navigateToResetPasswordWhenReady() {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (navRef?.isReady()) {
      try {
        (navRef as any).navigate('ResetPassword');
        clearInterval(interval);
      } catch {
        // Screen not registered yet, keep trying
      }
    }
    if (attempts > 30) clearInterval(interval); // Give up after 15s
  }, 500);
}
