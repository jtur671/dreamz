import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { cfg } from '../config.js';
import { log } from '../utils/logger.js';
import type { QueueItem, GeneratedContent } from '../types.js';

function load(): QueueItem[] {
  if (!existsSync(cfg.paths.queue)) return [];
  return JSON.parse(readFileSync(cfg.paths.queue, 'utf-8'));
}

function save(items: QueueItem[]) {
  writeFileSync(cfg.paths.queue, JSON.stringify(items, null, 2));
}

export function enqueue(generated: GeneratedContent): QueueItem {
  const items = load();
  const item: QueueItem = {
    id: randomUUID(),
    platform: generated.platform,
    status: 'pending',
    content: generated.content,
    scheduledFor: generated.scheduledFor ?? new Date().toISOString(),
    retries: 0,
  };
  items.push(item);
  save(items);
  log.info('queue', `Enqueued ${item.platform} post ${item.id}`);
  return item;
}

export function getDue(): QueueItem[] {
  const now = new Date().toISOString();
  return load().filter(i => i.status === 'pending' && i.scheduledFor <= now);
}

export function markPosted(id: string, url?: string) {
  const items = load();
  const item = items.find(i => i.id === id);
  if (item) {
    item.status = 'posted';
    item.postedAt = new Date().toISOString();
    if (url) (item as any).postedUrl = url;
    save(items);
  }
}

export function markFailed(id: string, error: string) {
  const items = load();
  const item = items.find(i => i.id === id);
  if (item) {
    item.retries++;
    if (item.retries >= 3) {
      item.status = 'failed';
    }
    item.error = error;
    save(items);
  }
}

export function getStats() {
  const items = load();
  return {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    posted: items.filter(i => i.status === 'posted').length,
    failed: items.filter(i => i.status === 'failed').length,
  };
}
