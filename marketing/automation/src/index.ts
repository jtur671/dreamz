import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { getDue, markPosted, markFailed, getStats } from './queue/store.js';
import { isPlatformEnabled } from './lib/platformState.js';
import { log } from './utils/logger.js';
import type { PlatformPoster, QueueItem } from './types.js';

// Dynamic imports so missing credentials don't crash the scheduler
export async function loadPosters(): Promise<PlatformPoster[]> {
  const modules = await Promise.allSettled([
    import('./platforms/pinterest.js'),
    import('./platforms/reddit.js'),
    import('./platforms/facebook.js'),
    import('./platforms/tiktok.js'),
  ]);

  const posterKeys = ['pinterest', 'reddit', 'facebook', 'tiktok'] as const;
  const posters: PlatformPoster[] = [];
  for (let i = 0; i < modules.length; i++) {
    const result = modules[i];
    if (result.status === 'fulfilled') {
      const mod = result.value as Record<string, any>;
      const poster = mod[posterKeys[i]] as PlatformPoster | undefined;
      if (poster?.enabled) {
        posters.push(poster);
        log.ok('scheduler', `${poster.name} poster loaded`);
      } else if (poster) {
        log.warn('scheduler', `${poster.name} poster disabled (missing credentials)`);
      }
    }
  }
  return posters;
}

export async function processDueItems(posters: PlatformPoster[]) {
  const due = getDue();
  if (due.length === 0) return;

  log.info('scheduler', `Processing ${due.length} due items`);

  // Group by platform and post in parallel across platforms
  const byPlatform = new Map<string, QueueItem[]>();
  for (const item of due) {
    const list = byPlatform.get(item.platform) ?? [];
    list.push(item);
    byPlatform.set(item.platform, list);
  }

  const tasks = Array.from(byPlatform.entries()).map(async ([platform, items]) => {
    // Runtime kill switch — checked per tick so dashboard toggles take effect
    // without a restart. Getter-level changes would not cover this case.
    if (!isPlatformEnabled(platform as any)) {
      log.warn('scheduler', `${platform} disabled via dashboard, skipping ${items.length} items`);
      return;
    }

    const poster = posters.find(p => p.name === platform);
    if (!poster) {
      log.warn('scheduler', `No poster for ${platform}, skipping ${items.length} items`);
      return;
    }

    // Post sequentially within a platform (rate limits), parallel across platforms
    for (const item of items) {
      try {
        log.info(platform, `Posting ${item.id}...`);
        const result = await poster.post(item);
        if (result.success) {
          markPosted(item.id, result.url);
          log.ok(platform, `Posted ${item.id} -> ${result.url ?? 'ok'}`);
        } else {
          markFailed(item.id, result.error ?? 'Unknown error');
          log.err(platform, `Failed ${item.id}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        markFailed(item.id, msg);
        log.err(platform, `Crashed on ${item.id}: ${msg}`);
      }
    }
  });

  await Promise.all(tasks);
}

async function main() {
  log.info('scheduler', 'Starting Dreamz marketing automation');

  const posters = await loadPosters();
  if (posters.length === 0) {
    log.err('scheduler', 'No platform posters enabled. Check your .env file.');
    process.exit(1);
  }

  const stats = getStats();
  log.info('scheduler', `Queue: ${stats.pending} pending, ${stats.posted} posted, ${stats.failed} failed`);

  // Check for due posts every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    processDueItems(posters).catch(err => {
      log.err('scheduler', `Process error: ${err}`);
    });
  });

  // Run immediately on start
  await processDueItems(posters);

  log.info('scheduler', 'Scheduler running. Checking every 5 minutes. Ctrl+C to stop.');
}

// Run only when invoked as a script, not when imported (e.g. by dashboard.ts).
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(err => {
    log.err('scheduler', `Fatal: ${err}`);
    process.exit(1);
  });
}
