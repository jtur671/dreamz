# Dreamz

A mystical dream journal that transforms your dreams into readings with symbols, omens, and rituals.

## Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy environment variables
   ```bash
   cp .env.example .env
   ```

3. Add your Supabase credentials to `.env`

4. Start development
   ```bash
   npx expo start
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

## Tech Stack

- Expo (React Native) + TypeScript
- Supabase (Auth, Database, Edge Functions)
- OpenAI GPT-4 (via Supabase Edge Function)
