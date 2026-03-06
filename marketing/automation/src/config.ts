import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function optEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

export const cfg = {
  anthropic: { apiKey: env('ANTHROPIC_API_KEY') },
  openai: { apiKey: env('OPENAI_API_KEY') },

  pinterest: {
    accessToken: optEnv('PINTEREST_ACCESS_TOKEN'),
    boardId: optEnv('PINTEREST_BOARD_ID'),
  },

  reddit: {
    clientId: optEnv('REDDIT_CLIENT_ID'),
    clientSecret: optEnv('REDDIT_CLIENT_SECRET'),
    username: optEnv('REDDIT_USERNAME'),
    password: optEnv('REDDIT_PASSWORD'),
    userAgent: env('REDDIT_USER_AGENT', 'dreamz-bot/1.0'),
  },

  facebook: {
    pageAccessToken: optEnv('FACEBOOK_PAGE_ACCESS_TOKEN'),
    pageId: optEnv('FACEBOOK_PAGE_ID'),
  },

  tiktok: {
    accessToken: optEnv('TIKTOK_ACCESS_TOKEN'),
  },

  links: {
    appStore: env('APP_STORE_URL', 'https://apps.apple.com/app/id6760150023'),
    landing: env('LANDING_PAGE_URL', 'https://jtur671.github.io/dreamz/'),
  },

  paths: {
    content: resolve(__dirname, '..', 'content'),
    queue: resolve(__dirname, '..', 'content', 'queue.json'),
  },
};
