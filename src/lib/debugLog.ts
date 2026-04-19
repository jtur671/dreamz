import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * In-app debug logger. iOS 26 hides React Native `console.*` output from
 * `idevicesyslog`, so on-device log collection is the only way to see
 * what's happening in a production cold launch. Keeps the last N entries
 * in memory + persists to AsyncStorage so logs survive a force-quit.
 *
 * View the buffer via the long-press handler on the Dreamz title in
 * AuthScreen, which dumps the ring buffer into an Alert.
 */
const KEY = 'dreamz:debug:boot-log';
const MAX_ENTRIES = 200;

type Entry = { ts: string; tag: string; msg: string };

const buffer: Entry[] = [];
let loaded = false;

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(buffer.slice(-MAX_ENTRIES)));
  } catch {
    // ignore — can't break the app because of logging
  }
}

export async function loadDebugLog(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Entry[];
      if (Array.isArray(parsed)) buffer.push(...parsed);
    }
  } catch {
    // ignore
  }
}

export function debugLog(tag: string, msg: string): void {
  const entry: Entry = { ts: new Date().toISOString(), tag, msg };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  console.warn(`[${tag}] ${msg}`);
  // fire-and-forget persist
  void persist();
}

export function getDebugLog(): Entry[] {
  return buffer.slice();
}

export function formatDebugLog(): string {
  if (buffer.length === 0) return '(empty)';
  return buffer
    .map((e) => `${e.ts.slice(11, 23)} [${e.tag}] ${e.msg}`)
    .join('\n');
}

export async function clearDebugLog(): Promise<void> {
  buffer.length = 0;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
