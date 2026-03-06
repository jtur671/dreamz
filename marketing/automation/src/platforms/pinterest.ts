import { readFileSync } from 'fs';
import { basename } from 'path';
import { cfg } from '../config.js';
import { log } from '../utils/logger.js';
import type { PlatformPoster, QueueItem } from '../types.js';

const TAG = 'pinterest';
const API_BASE = 'https://api.pinterest.com/v5';

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.pinterest.accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Upload an image to Pinterest's media endpoint and return the media id.
 * Pinterest v5 supports base64-encoded image uploads via the /media endpoint,
 * but the simpler path is to use the inline `image_base64` field on POST /pins.
 */
function readImageAsBase64(imagePath: string): string {
  const buffer = readFileSync(imagePath);
  return buffer.toString('base64');
}

function buildDescription(text: string, hashtags?: string[]): string {
  if (!hashtags || hashtags.length === 0) return text;
  const tagString = hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return `${text}\n\n${tagString}`;
}

async function createPin(item: QueueItem): Promise<{ success: boolean; url?: string; error?: string }> {
  const { content } = item;
  const boardId = content.boardId ?? cfg.pinterest.boardId;

  if (!boardId) {
    return { success: false, error: 'No board_id: set PINTEREST_BOARD_ID or provide item.content.boardId' };
  }

  if (!content.imagePath) {
    return { success: false, error: 'No imagePath provided — Pinterest pins require an image' };
  }

  let imageBase64: string;
  try {
    imageBase64 = readImageAsBase64(content.imagePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to read image file: ${msg}` };
  }

  const description = buildDescription(content.text, content.hashtags);
  const link = content.link ?? cfg.links.appStore;

  const body: Record<string, unknown> = {
    board_id: boardId,
    media_source: {
      source_type: 'image_base64',
      content_type: `image/${inferMimeSubtype(content.imagePath)}`,
      data: imageBase64,
      filename: basename(content.imagePath),
    },
    description,
    link,
  };

  if (content.title) {
    body.title = content.title;
  }

  log.info(TAG, `Creating pin on board ${boardId}...`);

  const res = await fetch(`${API_BASE}/pins`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    log.err(TAG, `Pinterest API ${res.status}: ${errorBody}`);
    return { success: false, error: `Pinterest API error ${res.status}: ${errorBody}` };
  }

  const data = (await res.json()) as { id?: string };
  const pinUrl = data.id ? `https://www.pinterest.com/pin/${data.id}/` : undefined;

  log.ok(TAG, `Pin created${pinUrl ? `: ${pinUrl}` : ''}`);
  return { success: true, url: pinUrl };
}

/**
 * Infer MIME subtype from file extension. Pinterest accepts jpeg, png, gif, webp.
 */
function inferMimeSubtype(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    png: 'png',
    gif: 'gif',
    webp: 'webp',
  };
  return map[ext] ?? 'png';
}

export const pinterest: PlatformPoster = {
  name: 'pinterest',
  get enabled() {
    return !!cfg.pinterest.accessToken;
  },
  post: createPin,
};
