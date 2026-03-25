// Shared callback for password reset flow.
// Set by App.tsx, called by VerifyResetCodeScreen when OTP succeeds in reset mode.
// Uses a callback pattern to avoid circular imports between App.tsx and screens.
let onPasswordResetLogin: (() => void) | null = null;

export function setOnPasswordResetLogin(callback: (() => void) | null) {
  onPasswordResetLogin = callback;
}

export function triggerPasswordResetLogin() {
  onPasswordResetLogin?.();
}
