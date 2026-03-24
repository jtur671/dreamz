// Shared state for password reset flow.
// Extracted to its own module to avoid circular import issues between
// App.tsx and screen components that import from '../../App'.
let pendingPasswordReset = false;

export function setPendingPasswordReset(value: boolean) {
  pendingPasswordReset = value;
}

export function getPendingPasswordReset(): boolean {
  return pendingPasswordReset;
}
