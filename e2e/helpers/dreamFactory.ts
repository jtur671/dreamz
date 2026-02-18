/** Standard dream text for happy-path tests (~100 chars). */
export const TEST_DREAM_TEXT =
  'I was walking through a moonlit forest when a silver owl appeared and whispered ancient secrets to me';

/** Long dream text for edge-case testing (5000+ chars). */
export const LONG_DREAM_TEXT =
  'I dreamed I was standing in an enormous library that stretched infinitely in all directions. '.repeat(60);

/** Short dream text below minimum threshold. */
export const SHORT_DREAM_TEXT = 'hi';

/** XSS payload for security testing. */
export const XSS_DREAM_TEXT = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

/** Emoji-heavy dream text for unicode handling. */
export const EMOJI_DREAM_TEXT =
  'I saw a huge dragon in the sky and a castle made of crystals and rainbows everywhere around me';

/** SQL wildcard characters for injection testing. */
export const SQL_WILDCARD_TEXT = '%_\\';

/** Generate a unique email for sign-up tests. */
export function randomTestEmail(): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `detox-${id}@test.dreamz.app`;
}
