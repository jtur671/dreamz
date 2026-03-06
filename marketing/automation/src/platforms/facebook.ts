import { readFile } from 'fs/promises';
import { basename } from 'path';
import { cfg } from '../config.js';
import { log } from '../utils/logger.js';
import type { PlatformPoster, QueueItem } from '../types.js';

const TAG = 'facebook';
const GRAPH_API = 'https://graph.facebook.com/v21.0';

function buildMessage(item: QueueItem): string {
  const parts: string[] = [];

  parts.push(item.content.text);

  // Append app store / landing page link
  const link = item.content.link ?? cfg.links.appStore;
  parts.push(`\n${link}`);

  // Append hashtags
  if (item.content.hashtags?.length) {
    parts.push('\n' + item.content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' '));
  }

  return parts.join('\n');
}

async function postPhoto(
  pageId: string,
  token: string,
  item: QueueItem,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const imagePath = item.content.imagePath!;
  const imageBuffer = await readFile(imagePath);
  const fileName = basename(imagePath);

  const form = new FormData();
  form.append('source', new Blob([imageBuffer]), fileName);
  form.append('message', buildMessage(item));
  form.append('access_token', token);

  const res = await fetch(`${GRAPH_API}/${pageId}/photos`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data);
    return { success: false, error: `Graph API ${res.status}: ${errMsg}` };
  }

  // photos endpoint returns { id, post_id }
  const postId = data.post_id ?? data.id;
  const url = `https://www.facebook.com/${postId}`;
  return { success: true, url };
}

async function postFeed(
  pageId: string,
  token: string,
  item: QueueItem,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const message = buildMessage(item);
  const link = item.content.link ?? cfg.links.appStore;

  const body: Record<string, string> = {
    message,
    link,
    access_token: token,
  };

  const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data);
    return { success: false, error: `Graph API ${res.status}: ${errMsg}` };
  }

  // feed endpoint returns { id } in format "pageId_postId"
  const url = `https://www.facebook.com/${data.id}`;
  return { success: true, url };
}

export const facebook: PlatformPoster = {
  name: 'facebook',

  get enabled(): boolean {
    return !!cfg.facebook.pageAccessToken && !!cfg.facebook.pageId;
  },

  async post(item: QueueItem) {
    const token = cfg.facebook.pageAccessToken;
    const pageId = cfg.facebook.pageId;

    if (!token || !pageId) {
      return { success: false, error: 'FACEBOOK_PAGE_ACCESS_TOKEN or FACEBOOK_PAGE_ID not configured' };
    }

    log.info(TAG, `Posting to Facebook page ${pageId} (image: ${!!item.content.imagePath})`);

    try {
      const result = item.content.imagePath
        ? await postPhoto(pageId, token, item)
        : await postFeed(pageId, token, item);

      if (result.success) {
        log.ok(TAG, `Posted successfully: ${result.url}`);
      } else {
        log.err(TAG, `Post failed: ${result.error}`);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.err(TAG, `Unexpected error: ${message}`);
      return { success: false, error: message };
    }
  },
};
