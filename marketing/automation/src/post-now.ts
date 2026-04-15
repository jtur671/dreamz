/**
 * Manual post trigger — posts all due items immediately.
 * Usage: npm run post
 */
import { getDue, markPosted, markFailed, getStats } from './queue/store.js';
import { isPlatformEnabled } from './lib/platformState.js';
import { log } from './utils/logger.js';
import type { PlatformPoster } from './types.js';

async function main() {
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
      if (poster?.enabled) posters.push(poster);
    }
  }

  const due = getDue();
  if (due.length === 0) {
    log.info('post-now', 'Nothing in queue. Run `npm run generate` first.');
    const stats = getStats();
    log.info('post-now', `Queue: ${stats.pending} pending, ${stats.posted} posted, ${stats.failed} failed`);
    return;
  }

  log.info('post-now', `Posting ${due.length} items across ${posters.length} platforms...`);

  const results = await Promise.all(
    due.map(async (item) => {
      if (!isPlatformEnabled(item.platform)) {
        log.warn('post-now', `${item.platform} disabled via dashboard, skipping ${item.id}`);
        return;
      }
      const poster = posters.find(p => p.name === item.platform);
      if (!poster) {
        log.warn('post-now', `No poster for ${item.platform}, skipping`);
        return;
      }
      try {
        const result = await poster.post(item);
        if (result.success) {
          markPosted(item.id, result.url);
          log.ok(item.platform, `${item.id} -> ${result.url ?? 'posted'}`);
        } else {
          markFailed(item.id, result.error ?? 'Unknown error');
          log.err(item.platform, `${item.id}: ${result.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        markFailed(item.id, msg);
        log.err(item.platform, `${item.id}: ${msg}`);
      }
    })
  );

  const stats = getStats();
  log.info('post-now', `Done. Queue: ${stats.pending} pending, ${stats.posted} posted, ${stats.failed} failed`);
}

main();
