/**
 * TikTok Content Posting API (v2) poster module.
 *
 * NOTE: TikTok's Content Posting API requires app review and approval before
 * your application can publish videos on behalf of users. You must apply at
 * https://developers.tiktok.com/ and have your app approved for the
 * "Content Posting" scope (video.publish) before this module will work.
 *
 * Flow:
 *   1. POST /v2/post/publish/video/init/  — initialize upload, get upload_url
 *   2. PUT the video file to the returned upload_url
 *   3. Poll /v2/post/publish/status/fetch/ until processing completes
 */

import { readFileSync, statSync } from 'fs';
import { cfg } from '../config.js';
import { log } from '../utils/logger.js';
import type { PlatformPoster, QueueItem } from '../types.js';

const TAG = 'tiktok';
const API_BASE = 'https://open.tiktokapis.com/v2';

/** Maximum number of times to poll for publish status. */
const MAX_POLL_ATTEMPTS = 30;
/** Delay between status polls in ms. */
const POLL_INTERVAL_MS = 5000;

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.tiktok.accessToken}`,
    'Content-Type': 'application/json',
  };
}

function buildDescription(text: string, hashtags?: string[]): string {
  if (!hashtags || hashtags.length === 0) return text;
  const tagString = hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  return `${text}\n\n${tagString}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialize a video upload via TikTok's Content Posting API.
 * Returns the upload_url and publish_id on success.
 */
async function initVideoUpload(
  description: string,
  videoSize: number,
): Promise<{ uploadUrl: string; publishId: string } | { error: string }> {
  const body = {
    post_info: {
      title: description.slice(0, 150), // TikTok title limit
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
    },
  };

  log.info(TAG, 'Initializing video upload...');

  const res = await fetch(`${API_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    log.err(TAG, `Init upload failed ${res.status}: ${errorBody}`);
    return { error: `TikTok init upload error ${res.status}: ${errorBody}` };
  }

  const data = (await res.json()) as {
    data?: { upload_url?: string; publish_id?: string };
    error?: { code?: string; message?: string };
  };

  if (data.error?.code && data.error.code !== 'ok') {
    const msg = data.error.message ?? data.error.code;
    log.err(TAG, `Init upload API error: ${msg}`);
    return { error: `TikTok init error: ${msg}` };
  }

  const uploadUrl = data.data?.upload_url;
  const publishId = data.data?.publish_id;

  if (!uploadUrl || !publishId) {
    return { error: 'TikTok init response missing upload_url or publish_id' };
  }

  return { uploadUrl, publishId };
}

/**
 * Upload the video file bytes to TikTok's upload URL via PUT.
 */
async function uploadVideoFile(
  uploadUrl: string,
  videoPath: string,
  videoSize: number,
): Promise<{ error?: string }> {
  log.info(TAG, `Uploading video file (${(videoSize / 1024 / 1024).toFixed(1)} MB)...`);

  let videoBuffer: Buffer;
  try {
    videoBuffer = readFileSync(videoPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Failed to read video file: ${msg}` };
  }

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      'Content-Length': String(videoSize),
    },
    body: new Uint8Array(videoBuffer),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    log.err(TAG, `Video upload failed ${res.status}: ${errorBody}`);
    return { error: `TikTok upload error ${res.status}: ${errorBody}` };
  }

  log.ok(TAG, 'Video file uploaded successfully');
  return {};
}

/**
 * Poll TikTok's publish status endpoint until the video finishes processing.
 * Returns the publish status or an error.
 */
async function pollPublishStatus(
  publishId: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  log.info(TAG, `Polling publish status for ${publishId}...`);

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${API_BASE}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ publish_id: publishId }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      log.warn(TAG, `Status poll attempt ${attempt} failed ${res.status}: ${errorBody}`);
      continue;
    }

    const data = (await res.json()) as {
      data?: { status?: string; publicaly_available_post_id?: string[] };
      error?: { code?: string; message?: string };
    };

    const status = data.data?.status;
    log.info(TAG, `Poll attempt ${attempt}/${MAX_POLL_ATTEMPTS}: status=${status ?? 'unknown'}`);

    if (status === 'PUBLISH_COMPLETE') {
      const postIds = data.data?.publicaly_available_post_id;
      const videoId = postIds?.[0];
      const url = videoId ? `https://www.tiktok.com/@me/video/${videoId}` : undefined;
      log.ok(TAG, `Video published${url ? `: ${url}` : ''}`);
      return { success: true, url };
    }

    if (status === 'FAILED') {
      const msg = data.error?.message ?? 'Video processing failed';
      log.err(TAG, msg);
      return { success: false, error: msg };
    }

    // PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SENDING_TO_USER_INBOX — keep polling
  }

  return { success: false, error: `Publish status polling timed out after ${MAX_POLL_ATTEMPTS} attempts` };
}

/**
 * Post a video to TikTok via the Content Posting API v2.
 */
async function postVideo(item: QueueItem): Promise<{ success: boolean; url?: string; error?: string }> {
  const { content } = item;

  if (!content.videoPath) {
    return { success: false, error: 'No video file provided' };
  }

  // Get file size for the upload init request
  let videoSize: number;
  try {
    const stats = statSync(content.videoPath);
    videoSize = stats.size;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Cannot stat video file: ${msg}` };
  }

  const description = buildDescription(content.text, content.hashtags);

  // Step 1: Initialize upload
  const initResult = await initVideoUpload(description, videoSize);
  if ('error' in initResult) {
    return { success: false, error: initResult.error };
  }

  // Step 2: Upload the video file
  const uploadResult = await uploadVideoFile(initResult.uploadUrl, content.videoPath, videoSize);
  if (uploadResult.error) {
    return { success: false, error: uploadResult.error };
  }

  // Step 3: Poll for publish completion
  return pollPublishStatus(initResult.publishId);
}

export const tiktok: PlatformPoster = {
  name: 'tiktok',
  get enabled() {
    return !!cfg.tiktok.accessToken;
  },
  post: postVideo,
};
