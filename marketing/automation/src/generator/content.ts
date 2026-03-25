import Anthropic from '@anthropic-ai/sdk';
import { cfg } from '../config.js';
import { enqueue } from '../queue/store.js';
import { log } from '../utils/logger.js';
import type { Platform, PostContent, GeneratedContent } from '../types.js';

const TAG = 'content-gen';

const anthropic = new Anthropic({ apiKey: cfg.anthropic.apiKey });

// ── Dream symbols pool (rotated through for variety) ──────────────────────

const DREAM_SYMBOLS = [
  'falling', 'flying', 'teeth falling out', 'being chased', 'water',
  'snakes', 'spiders', 'death', 'fire', 'houses', 'doors', 'mirrors',
  'the moon', 'forests', 'bridges', 'storms', 'birds', 'cats', 'dogs',
  'babies', 'wedding', 'drowning', 'running but not moving', 'losing keys',
  'being naked in public', 'elevators', 'clocks', 'staircases', 'gardens',
  'shadows', 'ravens', 'crystals', 'eclipses', 'fog', 'roses', 'wolves',
  'oceans', 'caves', 'butterflies', 'candles',
];

const SUBREDDITS = ['Dreams', 'LucidDreaming', 'DreamInterpretation', 'Jung', 'witchcraft'];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Brand voice system prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a social media content writer for Dreamz — a mystical dream journal app for iOS.

BRAND VOICE:
- Mystical but accessible. Think "a wise friend who reads tarot."
- Modern, slightly poetic, never cheesy or cringe.
- No clinical or diagnostic language. No literal predictions.
- Frame interpretations as possibility: "often suggests…", "may reflect…", "could point to…"
- Dark, atmospheric aesthetic: deep purples, golds, midnight blues, celestial elements.
- Keywords to weave in naturally: mystical, private, divined, oracle, grimoire, veil, symbols.

PRODUCT CONTEXT:
- Dreamz transforms dream entries into AI-powered mystical "readings" with symbols, omens, rituals, and journal prompts.
- Core loop: Write/Record Dream → Get AI Reading → Save to Grimoire → Notice Patterns
- Free tier: Unlimited readings (with occasional ads). Premium: $5.99/mo or $35.99/yr for ad-free + deeper AI.
- 5,700+ symbol dictionary. Voice recording. Encrypted and private.
- Target audience: 18-35, spirituality/wellness-adjacent, mostly female, active on TikTok/Pinterest/Instagram.
- App Store: https://apps.apple.com/app/id6760150023
- Landing page: https://dreamz-journal.com/

RULES:
- Never promise medical advice or literal dream predictions.
- Reddit posts must feel authentic and educational — NO overt self-promotion or "download our app" language.
- Pinterest content should be SEO-rich with dream interpretation keywords.
- TikTok captions should be punchy, hook-first, with relevant hashtags.
- Facebook posts should be engaging and conversational with a link.
- Output strict JSON only. No markdown fences, no commentary outside the JSON.`;

// ── Platform-specific generation ──────────────────────────────────────────

interface PinterestResult {
  title: string;
  description: string;
  imagePrompt: string;
}

interface RedditResult {
  title: string;
  body: string;
  subreddit: string;
  flair: string;
}

interface FacebookResult {
  text: string;
  hashtags: string[];
}

interface TikTokResult {
  caption: string;
  hashtags: string[];
  videoConcept: string;
}

interface BatchResponse {
  pinterest: PinterestResult;
  reddit: RedditResult;
  facebook: FacebookResult;
  tiktok: TikTokResult;
}

async function callClaude(userPrompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== 'text') {
    throw new Error(`Unexpected response block type: ${block.type}`);
  }
  return block.text;
}

function parseJSON<T>(raw: string): T {
  // Strip markdown fences if the model added them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  return JSON.parse(cleaned) as T;
}

// ── Schedule helpers ──────────────────────────────────────────────────────

function scheduleTime(hoursFromNow: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

// ── Generate a batch of posts ─────────────────────────────────────────────

export async function generateBatch(count: number = 1): Promise<GeneratedContent[]> {
  const results: GeneratedContent[] = [];

  for (let i = 0; i < count; i++) {
    const symbol = pickRandom(DREAM_SYMBOLS);
    const subreddit = pickRandom(SUBREDDITS);

    log.info(TAG, `Generating batch ${i + 1}/${count} — symbol: "${symbol}", subreddit: r/${subreddit}`);

    const userPrompt = `Generate one social media post for each platform about the dream symbol "${symbol}".

Return a single JSON object with these exact keys:

{
  "pinterest": {
    "title": "SEO-optimized pin title about dreaming of ${symbol} (max 100 chars)",
    "description": "Pin description with dream interpretation keywords, 2-3 sentences, SEO-rich (max 500 chars)",
    "imagePrompt": "A detailed image description for DALL-E to generate a mystical dream symbol pin image for '${symbol}'. Dark background, deep purples/golds/midnight blues, celestial elements, portrait orientation."
  },
  "reddit": {
    "title": "An engaging, educational post title about dreaming of ${symbol} for r/${subreddit}",
    "body": "A 150-250 word educational post about what dreaming of ${symbol} may symbolize. Reference Jungian archetypes or common dream analysis frameworks. Be informative and genuine — this should read like a knowledgeable community member sharing insight, NOT an ad. Do not mention any app or product.",
    "subreddit": "${subreddit}",
    "flair": "Discussion"
  },
  "facebook": {
    "text": "An engaging 2-4 sentence Facebook post about dreaming of ${symbol}. Ask a question to encourage engagement. Include a subtle mention of Dreamz app with the landing page link. Conversational and warm.",
    "hashtags": ["dreammeaning", "dreaminterpretation", "dreamjournal", "spirituality", "dreamz"]
  },
  "tiktok": {
    "caption": "A punchy TikTok caption (under 150 chars) with a hook about dreaming of ${symbol}.",
    "hashtags": ["dreamtok", "dreammeaning", "spiritualtiktok", "witchtok", "dreaminterpretation", "dreamjournal"],
    "videoConcept": "Brief description of a 15-30 second TikTok video concept about this dream symbol."
  }
}

Return ONLY the JSON object. No other text.`;

    try {
      const raw = await callClaude(userPrompt);
      const batch = parseJSON<BatchResponse>(raw);

      // ── Pinterest ────────────────────────────────────────────
      const pinterestContent: PostContent = {
        title: batch.pinterest.title,
        text: batch.pinterest.description,
        link: cfg.links.appStore,
        boardId: cfg.pinterest.boardId ?? undefined,
      };
      const pinterestItem: GeneratedContent = {
        platform: 'pinterest',
        content: pinterestContent,
        scheduledFor: scheduleTime(i * 6 + 1),
      };
      // Store the image prompt as metadata so images.ts can use it
      (pinterestContent as any)._imagePrompt = batch.pinterest.imagePrompt;
      (pinterestContent as any)._symbol = symbol;
      enqueue(pinterestItem);
      results.push(pinterestItem);
      log.ok(TAG, `Pinterest post queued: "${batch.pinterest.title}"`);

      // ── Reddit ───────────────────────────────────────────────
      const redditContent: PostContent = {
        title: batch.reddit.title,
        text: batch.reddit.body,
        subreddit: batch.reddit.subreddit,
        flair: batch.reddit.flair,
      };
      const redditItem: GeneratedContent = {
        platform: 'reddit',
        content: redditContent,
        scheduledFor: scheduleTime(i * 6 + 2),
      };
      enqueue(redditItem);
      results.push(redditItem);
      log.ok(TAG, `Reddit post queued: r/${batch.reddit.subreddit} — "${batch.reddit.title}"`);

      // ── Facebook ─────────────────────────────────────────────
      const fbText = batch.facebook.text.includes(cfg.links.landing)
        ? batch.facebook.text
        : `${batch.facebook.text}\n\n${cfg.links.landing}`;
      const facebookContent: PostContent = {
        text: fbText,
        link: cfg.links.landing,
        hashtags: batch.facebook.hashtags,
      };
      const facebookItem: GeneratedContent = {
        platform: 'facebook',
        content: facebookContent,
        scheduledFor: scheduleTime(i * 6 + 3),
      };
      enqueue(facebookItem);
      results.push(facebookItem);
      log.ok(TAG, `Facebook post queued`);

      // ── TikTok ───────────────────────────────────────────────
      const tiktokContent: PostContent = {
        text: batch.tiktok.caption,
        hashtags: batch.tiktok.hashtags,
      };
      // Store video concept as metadata for video generation pipeline
      (tiktokContent as any)._videoConcept = batch.tiktok.videoConcept;
      const tiktokItem: GeneratedContent = {
        platform: 'tiktok',
        content: tiktokContent,
        scheduledFor: scheduleTime(i * 6 + 4),
      };
      enqueue(tiktokItem);
      results.push(tiktokItem);
      log.ok(TAG, `TikTok post queued: "${batch.tiktok.caption.slice(0, 60)}..."`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.err(TAG, `Failed to generate batch ${i + 1}: ${msg}`);
    }
  }

  log.info(TAG, `Generation complete: ${results.length} posts queued across ${count} batch(es)`);
  return results;
}

// ── Standalone script ─────────────────────────────────────────────────────

const isMain = process.argv[1]?.includes('content');
if (isMain) {
  const count = parseInt(process.argv[2] ?? '1', 10);
  log.info(TAG, `Running standalone — generating ${count} batch(es)`);
  generateBatch(count)
    .then((items) => {
      log.ok(TAG, `Done. ${items.length} posts generated.`);
      process.exit(0);
    })
    .catch((err) => {
      log.err(TAG, `Fatal: ${err}`);
      process.exit(1);
    });
}
