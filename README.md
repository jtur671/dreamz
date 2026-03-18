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
| `SUPABASE_DB_PASSWORD` | Your database password |
| `DB_ENCRYPTION_KEY` | 32+ byte random key (base64) for pgcrypto encryption |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` | RevenueCat iOS SDK key |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` | RevenueCat Android SDK key |
| `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` | Apple Sign In service ID |
| `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` | Apple Sign In private key |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Google OAuth client secret |
| `GEMINI_API_KEY` | Gemini API key (MCP image server for store assets) |

See `.env.example` for the full template.

## Tech Stack

- Expo (React Native) + TypeScript
- Supabase (Auth, Database, Edge Functions)
- OpenAI GPT-5.4 family (via Supabase Edge Function)
