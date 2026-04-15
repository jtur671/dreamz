import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '..', '..', '.env');

/**
 * Parse a .env file into an ordered list of entries.
 * Preserves comments, blank lines, and the relative order of keys.
 */
interface EnvLine {
  kind: 'kv' | 'raw';
  key?: string;
  raw: string;
}

function parse(content: string): EnvLine[] {
  const lines = content.split(/\r?\n/);
  return lines.map((line): EnvLine => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return { kind: 'raw', raw: line };
    }
    const eq = line.indexOf('=');
    if (eq === -1) return { kind: 'raw', raw: line };
    const key = line.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/i.test(key)) return { kind: 'raw', raw: line };
    return { kind: 'kv', key, raw: line };
  });
}

function serialize(lines: EnvLine[]): string {
  return lines.map((l) => l.raw).join('\n');
}

function escapeValue(value: string): string {
  // Wrap in double quotes if the value contains whitespace or special chars.
  if (/[\s"'$`\\]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Read the current .env, merge in `updates`, write atomically.
 * Keys not listed in `updates` are preserved untouched.
 * Returns the list of keys that were actually written (for logging).
 * Never logs or returns values.
 */
export function mergeEnv(updates: Record<string, string>): string[] {
  const current = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf-8') : '';
  const lines = parse(current);

  const touchedKeys = new Set<string>();
  const remaining = new Set(Object.keys(updates));

  for (const line of lines) {
    if (line.kind === 'kv' && line.key && remaining.has(line.key)) {
      line.raw = `${line.key}=${escapeValue(updates[line.key])}`;
      touchedKeys.add(line.key);
      remaining.delete(line.key);
    }
  }

  // Append any keys that weren't already in the file.
  for (const key of remaining) {
    lines.push({ kind: 'kv', key, raw: `${key}=${escapeValue(updates[key])}` });
    touchedKeys.add(key);
  }

  const serialized = serialize(lines);
  const tmpPath = `${ENV_PATH}.tmp`;
  writeFileSync(tmpPath, serialized.endsWith('\n') ? serialized : serialized + '\n');
  renameSync(tmpPath, ENV_PATH);

  return Array.from(touchedKeys);
}

/**
 * Return the set of keys currently defined in .env (values omitted).
 */
export function readEnvKeys(): string[] {
  if (!existsSync(ENV_PATH)) return [];
  const lines = parse(readFileSync(ENV_PATH, 'utf-8'));
  return lines.filter((l) => l.kind === 'kv' && l.key).map((l) => l.key!);
}
