import OpenAI from 'openai';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { cfg } from '../config.js';
import { log } from '../utils/logger.js';

const TAG = 'image-gen';

const openai = new OpenAI({ apiKey: cfg.openai.apiKey });

const IMAGES_DIR = resolve(cfg.paths.content, 'images');

function ensureImagesDir(): void {
  if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true });
    log.info(TAG, `Created images directory: ${IMAGES_DIR}`);
  }
}

// ── Core image generation ─────────────────────────────────────────────────

/**
 * Generate an image with DALL-E 3 and save it to the content/images directory.
 * Returns the absolute path to the saved file.
 */
export async function generateImage(prompt: string, filename: string): Promise<string> {
  ensureImagesDir();

  const outputPath = resolve(IMAGES_DIR, filename);

  log.info(TAG, `Generating image: "${prompt.slice(0, 80)}..." → ${filename}`);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1792',
    quality: 'standard',
    response_format: 'b64_json',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('No image data returned from DALL-E');
  }

  const buffer = Buffer.from(b64, 'base64');
  writeFileSync(outputPath, buffer);

  log.ok(TAG, `Image saved: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  return outputPath;
}

// ── Dream symbol pin image ────────────────────────────────────────────────

const DREAMZ_STYLE = [
  'Dark mystical theme with deep purples, golds, and midnight blues.',
  'Celestial elements: stars, moons, constellations subtly woven in.',
  'Atmospheric and ethereal, with soft glowing light and shadow.',
  'Portrait orientation, suitable for a Pinterest pin.',
  'No text or letters in the image.',
  'Rich, detailed, slightly surreal digital art style.',
].join(' ');

/**
 * Generate a Pinterest-ready pin image for a dream symbol.
 * Builds a curated DALL-E prompt with the Dreamz visual aesthetic.
 */
export async function generatePinImage(symbol: string): Promise<string> {
  const prompt = [
    `A mystical, atmospheric illustration representing the dream symbol "${symbol}".`,
    `The image should evoke the feeling of a dream — liminal, symbolic, and otherworldly.`,
    `Show the symbol "${symbol}" in a way that feels personal and archetypal, as if seen through a veil between waking and sleeping.`,
    DREAMZ_STYLE,
  ].join(' ');

  const sanitized = symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const timestamp = Date.now();
  const filename = `pin-${sanitized}-${timestamp}.png`;

  return generateImage(prompt, filename);
}

// ── Standalone script ─────────────────────────────────────────────────────

const isMain = process.argv[1]?.includes('images');
if (isMain) {
  const symbol = process.argv[2] ?? 'falling';
  log.info(TAG, `Running standalone — generating pin image for "${symbol}"`);
  generatePinImage(symbol)
    .then((path) => {
      log.ok(TAG, `Done. Image at: ${path}`);
      process.exit(0);
    })
    .catch((err) => {
      log.err(TAG, `Fatal: ${err}`);
      process.exit(1);
    });
}
