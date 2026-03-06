/**
 * Reddit Platform Poster
 *
 * Uses the snoowrap npm package to submit posts to Reddit via the API.
 *
 * IMPORTANT — Reddit Content Policy:
 *   Reddit strictly prohibits spam and self-promotion that does not add genuine
 *   value.  Before enabling this poster, make sure every post provides real,
 *   helpful content to the target subreddit (dream interpretation tips, personal
 *   stories, thoughtful discussion starters, etc.).  A good rule of thumb is the
 *   90/10 guideline — 90 % of your participation should be organic community
 *   engagement; at most 10 % may reference your own product.  Violating this
 *   will get the account shadowbanned quickly.
 *
 * Rate Limiting:
 *   Reddit recommends no more than 1 request every 2 seconds for OAuth clients.
 *   This module enforces that with a simple timestamp gate before each post call.
 */

import Snoowrap from 'snoowrap';
import { cfg } from '../config.js';
import { log } from '../utils/logger.js';
import type { PlatformPoster, QueueItem } from '../types.js';

const TAG = 'reddit';
const DEFAULT_SUBREDDIT = 'Dreams';

// ---------------------------------------------------------------------------
// Rate limiter — enforce min 2 000 ms between API calls
// ---------------------------------------------------------------------------
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 2_000;

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    const waitMs = MIN_INTERVAL_MS - elapsed;
    log.info(TAG, `Rate-limiting: waiting ${waitMs}ms before next request`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Snoowrap client (lazy singleton)
// ---------------------------------------------------------------------------
let client: Snoowrap | null = null;

function getClient(): Snoowrap {
  if (client) return client;

  const { clientId, clientSecret, username, password, userAgent } = cfg.reddit;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Reddit credentials are not fully configured');
  }

  client = new Snoowrap({
    userAgent,
    clientId,
    clientSecret,
    username,
    password,
  });

  // snoowrap has its own internal rate-limiter but we layer ours on top
  // to stay well within Reddit's guidelines.
  client.config({
    requestDelay: MIN_INTERVAL_MS,
    continueAfterRatelimitError: true,
    warnings: false,
  });

  return client;
}

// ---------------------------------------------------------------------------
// Post helpers
// ---------------------------------------------------------------------------

interface SubmitOptions {
  subredditName: string;
  title: string;
  text?: string;
  imagePath?: string;
  flair?: string;
}

async function submitTextPost(
  r: Snoowrap,
  opts: SubmitOptions,
): Promise<string> {
  const submission = await (r as any).submitSelfpost({
    subredditName: opts.subredditName,
    title: opts.title,
    text: opts.text ?? '',
    ...(opts.flair ? { flairId: opts.flair } : {}),
  });
  // snoowrap returns a Submission proxy; .name is the fullname (t3_xxx)
  return `https://www.reddit.com${(submission as any).permalink ?? `/r/${opts.subredditName}/comments/${(submission as any).id}`}`;
}

async function submitImagePost(
  r: Snoowrap,
  opts: SubmitOptions,
): Promise<string> {
  const submission = await (r as any).submitLink({
    subredditName: opts.subredditName,
    title: opts.title,
    url: opts.imagePath!,
    ...(opts.flair ? { flairId: opts.flair } : {}),
  });
  return `https://www.reddit.com${(submission as any).permalink ?? `/r/${opts.subredditName}/comments/${(submission as any).id}`}`;
}

// ---------------------------------------------------------------------------
// PlatformPoster export
// ---------------------------------------------------------------------------

export const reddit: PlatformPoster = {
  name: 'reddit',

  get enabled(): boolean {
    return !!cfg.reddit.clientId;
  },

  async post(
    item: QueueItem,
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'Reddit is not configured (missing REDDIT_CLIENT_ID)' };
    }

    const { content } = item;
    const subredditName = content.subreddit ?? DEFAULT_SUBREDDIT;
    const title = content.title ?? content.text.slice(0, 120);

    log.info(TAG, `Posting to r/${subredditName}: "${title.slice(0, 60)}..."`);

    try {
      const r = getClient();
      await enforceRateLimit();

      let url: string;

      if (content.imagePath) {
        // Image post
        url = await submitImagePost(r, {
          subredditName,
          title,
          imagePath: content.imagePath,
          flair: content.flair,
        });
      } else {
        // Self / text post — append the landing page link naturally
        let body = content.text;
        if (cfg.links.landing) {
          body += `\n\n---\n\nIf you want to explore what your dreams might be telling you, check out [Dreamz](${cfg.links.landing}) — a private dream journal that turns your dreams into mystical readings.`;
        }
        url = await submitTextPost(r, {
          subredditName,
          title,
          text: body,
          flair: content.flair,
        });
      }

      log.ok(TAG, `Posted successfully: ${url}`);
      return { success: true, url };
    } catch (err: any) {
      const message = err?.message ?? String(err);
      log.err(TAG, `Failed to post to r/${subredditName}: ${message}`);
      return { success: false, error: message };
    }
  },
};
