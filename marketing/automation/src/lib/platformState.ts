import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Platform } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(__dirname, '..', '..', 'content', 'platform-state.json');

export type PlatformState = Record<Platform, boolean>;

const DEFAULT_STATE: PlatformState = {
  pinterest: true,
  reddit: true,
  facebook: true,
  tiktok: true,
};

export function readPlatformState(): PlatformState {
  if (!existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writePlatformState(state: Partial<PlatformState>): PlatformState {
  const merged = { ...readPlatformState(), ...state };
  writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

export function isPlatformEnabled(name: Platform): boolean {
  return readPlatformState()[name] ?? true;
}
