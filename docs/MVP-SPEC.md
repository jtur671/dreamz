# Dreamz MVP Specification

> A mobile dream journal that transforms dream entries into mystical "readings" with symbols, omens, and rituals—preserved in a personal Grimoire.

---

## Executive Summary

**Product:** Dreamz
**Tagline:** Your dreams, divined.
**Platform:** iOS + Android (Expo/React Native)
**Status:** MVP Complete, Phase 2 In Progress

### Core Loop
```
WRITE/RECORD DREAM → GET READING → SAVE TO GRIMOIRE → NOTICE PATTERNS
```

### Success Criteria
1. User can log in, write a dream, get a reading, and see it saved in history
2. Readings are consistently structured and feel "mystical, warm, not cringe"
3. User can delete/export their dreams (trust feature)
4. Readings include plain English interpretation alongside mystical elements

---

## User Persona

**Name:** Luna, 28
**Archetype:** The Curious Mystic

- Wakes up with vivid dreams 2-3x/week
- Interested in astrology, tarot, wellness content
- Uses Co-Star, Headspace, or similar apps
- Wants meaning without clinical analysis
- Values privacy—won't share raw dream text publicly
- Appreciates beautiful, atmospheric UI

**Jobs to be Done:**
1. Quickly capture a dream before it fades (text OR voice)
2. Get an interesting interpretation that sparks reflection
3. Notice patterns over time (recurring symbols, themes)
4. Feel like dreams "mean something" without it being too serious

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | Expo (React Native) + TypeScript |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions) |
| AI | OpenAI GPT-4o via Supabase Edge Function |
| Image Gen | OpenAI DALL-E 3 for dream imagery |
| Voice | OpenAI Whisper API for transcription |
| State | React Context |
| Storage | AsyncStorage (offline drafts) |

---

## MVP Screens

### Screen 1: Welcome + Auth

**Purpose:** Onboard new users, authenticate returning users

**Elements:**
- App logo + tagline ("Your dreams, divined.")
- "Continue with Apple" button
- "Continue with Google" button
- "Continue with Email" link (secondary)
- Privacy note: "Your dreams are private. Always."

**Status:** COMPLETE

**Acceptance Criteria:**
- [x] User can sign up/in with Apple
- [x] User can sign up/in with Google
- [x] User can sign up/in with email/password
- [x] New users get a profile created automatically
- [x] New users go through onboarding flow
- [x] Returning users go straight to Grimoire

---

### Screen 2: Onboarding (New Users)

**Purpose:** Collect user preferences for personalized readings

**3-Step Flow:**

1. **Tier Selection**
   - Free tier (3 readings/month) - fully functional
   - Premium tier - "Coming Soon" (UI only)

2. **About You (Optional)**
   - Zodiac sign picker
   - Gender selection (Female, Male, Non-binary, Genderfluid, Genderqueer, Agender, Two-spirit, Prefer not to say)
   - Age range (18-24, 25-34, 35-44, 45-54, 55-64, 65+)
   - Skip button available

3. **Welcome Screen**
   - Confirmation message
   - "Begin Your Journey" CTA

**Status:** COMPLETE

**Acceptance Criteria:**
- [x] Free tier saves to profile
- [x] All fields optional with skip
- [x] Data used in AI readings for personalization
- [x] Existing users not forced into onboarding

---

### Screen 3: New Dream Entry

**Purpose:** Capture the dream quickly before it fades

**Elements:**
- Dream type toggle: Dream / Nightmare
- Large text input (placeholder: "I was walking through a forest when...")
- **Voice recording button** (mic icon) - transcribes to text
- Emotion tags (optional multi-select): anxious, peaceful, confused, excited, sad, empowered, etc.
- "Interpret Dream" button (primary CTA)
- Draft auto-saves after 1 second of inactivity
- Draft recovery banner if previous draft exists

**Status:** COMPLETE

**Acceptance Criteria:**
- [x] Dream text is required (min 10 characters)
- [x] Dream type defaults to "dream"
- [x] Emotions are optional (0 or more)
- [x] Tapping "Interpret Dream" sends to AI and shows loading
- [x] Drafts auto-save locally
- [x] Draft recovery on return
- [x] Moon mood picker removed (emotion tags only)
- [x] Voice recording transcribes to text field
- [x] Voice recording shows waveform/progress

**Data Captured:**
```typescript
interface DreamEntry {
  dream_text: string;       // required (typed or transcribed)
  dream_type: 'dream' | 'nightmare';
  emotions?: string[];      // optional tags
}
```

---

### Screen 4: Reading (Interpretation Result)

**Purpose:** Display the AI-generated mystical reading

**Loading State:**
- Rotating mystical messages ("Consulting the dream oracle...", "Reading the symbols...", etc.)
- Atmospheric subtext
- Takes 5-15 seconds typically (includes image generation)

**Result Layout:**
```
┌─────────────────────────────────────┐
│  [AI-Generated Dream Image]         │  ← DALL-E 3 image
├─────────────────────────────────────┤
│  ✧ THE RIVER & THE LOCKED DOOR ✧   │  ← Title
├─────────────────────────────────────┤
│  [▼ View Your Dream]                │  ← Expandable (collapsed default)
│  ┌─────────────────────────────────┐│
│  │ Your original dream text here...││  ← Only when expanded
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  PLAIN ENGLISH                      │  ← NEW: Conversational interpretation
│  The dream might signify that you   │
│  are longing for comfort and taking │
│  things slow in your life...        │
├─────────────────────────────────────┤
│  THE VISION                         │
│  Your dream speaks of transition    │  ← TL;DR (mystical)
│  and things left unresolved...      │
├─────────────────────────────────────┤
│  SYMBOLS REVEALED                   │
│  ───────────────────                │
│  🌊 River                           │
│  Meaning: Flow, emotion, passage    │
│  Shadow: Feeling swept away         │
│  Guidance: What are you resisting?  │
│                                     │
│  🚪 Door                            │
│  Meaning: Opportunity, transition   │
│  Shadow: Fear of the unknown        │
│  Guidance: What waits on the other  │
│            side?                    │
│  ... (3-7 symbols total)            │
├─────────────────────────────────────┤
│  ☽ THE OMEN                         │
│  "Change flows toward you—          │
│   unlock yourself to receive it."   │
├─────────────────────────────────────┤
│  ✦ SUGGESTED RITUAL                 │
│  Write down one door you've been    │
│  afraid to open. Burn the paper.    │
├─────────────────────────────────────┤
│  FOR YOUR JOURNAL                   │
│  What would you do if the door      │
│  was already unlocked?              │
├─────────────────────────────────────┤
│  THEMES                             │
│  #water #doors #transition #fear    │  ← Tags
├─────────────────────────────────────┤
│  [ View in Grimoire ]               │
│  [ Share Reading ]                  │  ← Opens share card modal
│  [ Back to Grimoire ]               │
└─────────────────────────────────────┘
```

**Status:** COMPLETE

**Acceptance Criteria:**
- [x] Loading state shows for duration of API call
- [x] AI-generated dream image displays at top
- [x] All sections render (title, tldr, symbols, omen, ritual, prompt, tags)
- [x] 3-7 symbols with name, meaning, shadow, guidance
- [x] Dream auto-saves to database
- [x] Share opens modal with shareable card preview
- [x] Share captures card as image via ViewShot
- [x] Fallback to text share if capture fails
- [x] Error state if AI fails (with retry option)
- [x] Expandable dream text section (collapsed by default)
- [x] Plain English interpretation section

---

### Screen 5: Grimoire (Dream History)

**Purpose:** Browse and search past dreams and readings

**Elements:**
- Search bar (searches dream text, titles, tags)
- Filter tabs: All / Dreams / Nightmares
- List of dreams, newest first
- Each item shows: Title, date, mood indicator, omen snippet
- Tap to view full reading
- Pull to refresh

**List Item:**
```
┌─────────────────────────────────────┐
│  ✧ The River & The Locked Door      │
│  Jan 29, 2026 · 🌙 Dream            │
│  "Change flows toward you..."       │
└─────────────────────────────────────┘
```

**Status:** COMPLETE

**Acceptance Criteria:**
- [x] Dreams load paginated (20 at a time)
- [x] Search filters results in real-time
- [x] Filter by dream type works
- [x] Tap opens full reading view
- [x] Empty state: "Your Grimoire awaits..."
- [x] Deleted dreams don't appear (soft delete)

---

### Screen 6: Settings

**Purpose:** Account management, data control, trust features

**Elements:**
- **Account Section**
  - Email display
  - Zodiac sign (tap to edit)
- **Your Data Section**
  - "Gather Your Dreams" → Export all dreams as JSON
  - "Release a Dream" → Opens picker to delete individual dreams
- **Danger Zone**
  - "Close the Grimoire Forever" → Delete account (double confirmation)
- **Sign Out**
- App version + privacy footer

**Status:** COMPLETE

**Acceptance Criteria:**
- [x] Export generates shareable JSON with all dreams + readings
- [x] Delete individual dream via picker modal
- [x] Delete dream soft-deletes (recoverable for 30 days)
- [x] Delete account hard-deletes all data
- [x] Double confirmation for account deletion
- [x] Sign out with confirmation

---

## Data Models

### Database Schema (Supabase/Postgres)

```sql
-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  zodiac_sign TEXT,
  gender TEXT,                    -- female, male, non-binary, etc.
  age_range TEXT,                 -- 18-24, 25-34, etc.
  subscription_tier TEXT DEFAULT 'free',
  reading_count INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dreams and their readings
CREATE TABLE dreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  dream_text TEXT NOT NULL,
  dream_type TEXT DEFAULT 'dream',  -- 'dream' | 'nightmare'
  mood TEXT,                        -- emotion label
  reading JSONB,                    -- full AI reading result
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ            -- soft delete timestamp
);

-- Symbol dictionary (curated + scraped)
CREATE TABLE symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  meaning TEXT NOT NULL,
  shadow TEXT,
  guidance TEXT,
  category TEXT,
  keywords TEXT[],
  related_symbols TEXT[],
  source TEXT,                      -- 'curated' | 'dreammoods' | etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_dreams_created_at ON dreams(created_at DESC);
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_keywords ON symbols USING GIN(keywords);
```

### TypeScript Interfaces

```typescript
interface Profile {
  id: string;
  email: string;
  display_name?: string;
  zodiac_sign?: string;
  gender?: Gender;
  age_range?: AgeRange;
  subscription_tier: 'free' | 'premium';
  reading_count: number;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at: string;
}

interface Dream {
  id: string;
  user_id: string;
  dream_text: string;
  dream_type: 'dream' | 'nightmare';
  mood?: string;
  reading?: DreamReading;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface DreamReading {
  title: string;
  tldr: string;
  plain_english: string;           // NEW: conversational interpretation
  symbols: DreamSymbol[];          // 3-7 symbols
  omen: string;
  ritual: string;
  journal_prompt: string;
  tags: string[];
  image_url?: string;              // DALL-E generated image
}

interface DreamSymbol {
  name: string;
  meaning: string;
  shadow: string;
  guidance: string;
}

interface Symbol {
  id: string;
  name: string;
  meaning: string;
  shadow?: string;
  guidance?: string;
  category?: string;
  keywords?: string[];
  related_symbols?: string[];
  source?: string;
}
```

---

## AI Integration

### Reading Generation (Edge Function)

**Endpoint:** `POST /functions/v1/analyze-dream`

**Request:**
```typescript
{
  dream_text: string;
  mood?: string;
  dream_id?: string;           // for auto-save
  zodiac_sign?: string;
  gender?: string;
  age_range?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  reading?: DreamReading;      // includes image_url
  error?: string;
}
```

### Reading Schema (AI Output Contract)

The AI must return this exact JSON structure:

```json
{
  "title": "Evocative 3-6 word title",
  "tldr": "2-3 sentence mystical summary",
  "plain_english": "3-5 sentence conversational explanation in simple terms",
  "symbols": [
    {
      "name": "Symbol Name",
      "meaning": "What this typically represents",
      "shadow": "The challenging or unconscious aspect",
      "guidance": "A question or gentle direction"
    }
  ],
  "omen": "One mystical sentence—the core message",
  "ritual": "One small, doable action (under 5 minutes)",
  "journal_prompt": "One reflective question",
  "tags": ["3-7 lowercase tags"]
}
```

**Validation Rules:**
- All fields required
- `symbols` array: 3-7 items
- `tags` array: 3-7 items
- Retry on invalid JSON (max 2 retries)

### Voice Transcription (Edge Function)

**Endpoint:** `POST /functions/v1/transcribe-audio`

**Request:** Multipart form with audio file (m4a/webm)

**Response:**
```typescript
{
  success: boolean;
  text?: string;
  error?: string;
}
```

Uses OpenAI Whisper API for transcription.

---

## Features In Progress

### 1. Remove Moon Mood Picker
**Status:** COMPLETE
**Description:** Removed the 1-5 moon scale, keeping only emotional tags for mood selection.

---

### 2. Expandable Dream Text
**Status:** COMPLETE
**Description:** Added collapsible section on Reading screen to re-read original dream text. Collapsed by default with "View Your Dream" toggle.

---

### 3. Plain English Interpretation
**Status:** COMPLETE
**Description:** Added conversational interpretation section to readings. Uses hedging language ("might", "may", "could suggest"). Renders between title and mystical TL;DR on Reading screen.

---

### 4. Voice Recording for Dreams
**Status:** COMPLETE
**Description:** Allow users to speak their dreams instead of typing.

**Flow:**
1. User taps mic button
2. Permission request (first time)
3. Recording starts, waveform/timer shown
4. User taps stop
5. Audio sent to transcription API
6. Text populates dream input field
7. User can edit before submitting

**Dependencies:**
- `expo-av` for recording
- New Edge Function for Whisper API

**Files to create/modify:**
- `src/components/VoiceRecorder.tsx` - New recording component
- `supabase/functions/transcribe-audio/index.ts` - New Edge Function
- `src/screens/NewDreamScreen.tsx` - Integrate VoiceRecorder

---

### 5. Symbol Dictionary Expansion
**Status:** COMPLETE
**Description:** Imported 5,707 symbols from DreamMoods.com into the symbols table.

**What was done:**
1. Scraped dreammoods.com into `dreammoods_symbols.csv` (8,587 raw entries)
2. Built `scripts/generate-dreammoods-migration.ts` to parse, clean, deduplicate, and generate SQL
3. Cleaned data: filtered 518 cross-references, removed footer/nav junk, deduplicated across categories
4. Generated `supabase/migrations/008_import_dreammoods_symbols.sql` (5,707 unique symbols)
5. Uses `ON CONFLICT (name) DO NOTHING` to preserve 45 curated symbols with richer data
6. Added `source` column to distinguish 'curated' vs 'dreammoods' symbols (migration 007)

**Files:**
- `dreammoods_symbols.csv` - Raw scraped data
- `scripts/scrape-dreammoods.ts` - Web scraper
- `scripts/generate-dreammoods-migration.ts` - CSV parser and SQL generator
- `supabase/migrations/007_add_source_to_symbols.sql` - Add source column
- `supabase/migrations/008_import_dreammoods_symbols.sql` - Import 5,707 symbols

---

### 6. Symbol Dictionary Enrichment
**Status:** COMPLETE (deployed to remote Feb 11, 2026)
**Description:** Enriched 5,455 DreamMoods symbols with shadow meanings, guidance, categories, and related symbols using GPT-5-nano via the enrich-symbols edge function.

**What was done:**
1. Built `scripts/enrich-dreammoods-symbols.ts` to batch-enrich symbols (5 per batch, 742 batches)
2. Each symbol got: `shadow_meaning`, `guidance`, `category`, `related_symbols`
3. Generated `supabase/migrations/009_enrich_dreammoods_symbols.sql` (5,454 UPDATE statements, 2.1MB)
4. Pushed migrations 007, 008, 009 to remote Supabase

**Files:**
- `scripts/enrich-dreammoods-symbols.ts` - Batch enrichment script
- `.enrich-progress.json` - Progress/results from enrichment run (5,455 results)
- `supabase/migrations/009_enrich_dreammoods_symbols.sql` - Enrichment migration

**Result:** Symbol library now has 45 curated + 5,707 DreamMoods symbols, with 5,455 of those fully enriched with shadow meanings, guidance, categories, and related symbols.

---

## Completed Features

| Feature | Status | Date |
|---------|--------|------|
| Auth (Apple, Google, Email) | COMPLETE | Jan 2026 |
| Dream entry screen | COMPLETE | Jan 2026 |
| AI reading generation | COMPLETE | Jan 2026 |
| Reading display | COMPLETE | Jan 2026 |
| Grimoire/history | COMPLETE | Jan 2026 |
| Search & filter | COMPLETE | Jan 2026 |
| Settings screen | COMPLETE | Jan 2026 |
| Export dreams | COMPLETE | Jan 2026 |
| Delete account | COMPLETE | Feb 2026 |
| Onboarding flow | COMPLETE | Feb 2026 |
| Profile in AI context | COMPLETE | Feb 2026 |
| AI dream images (DALL-E) | COMPLETE | Feb 2026 |
| Shareable reading card | COMPLETE | Feb 2026 |
| Delete individual dreams | COMPLETE | Feb 2026 |
| Draft auto-save | COMPLETE | Feb 2026 |
| Moon mood picker removed | COMPLETE | Feb 2026 |
| Expandable dream text | COMPLETE | Feb 2026 |
| Plain English interpretation | COMPLETE | Feb 2026 |
| Symbol dictionary (5,707 symbols) | COMPLETE | Feb 2026 |
| Symbol enrichment (5,455 enriched) | COMPLETE | Feb 2026 |
| Voice recording (transcription) | COMPLETE | Feb 2026 |

---

## Monetization

### Free Tier
- 3 readings per month
- Full journal/history access
- Basic search
- Export (JSON)

### Premium Tier ($4.99/month) - via RevenueCat
- Unlimited readings
- Deeper symbol breakdowns
- Pattern insights ("You've dreamed of water 8 times")
- Voice recording (longer recordings)
- Priority support

---

## Design Direction

### Atmosphere
- **Mood:** Mystical grimoire, moonlit, intimate
- **Not:** Clinical, bright, corporate, gamified

### Color Palette
```
Background:    #1a1a2e (deep night)
Surface:       #252542 (card background)
Primary:       #6b4e9e (soft violet)
Secondary:     #9b7fd4 (light purple)
Text Primary:  #e0d4f7 (soft white)
Text Muted:    #8b7fa8 (gray)
Accent:        #c4b8e8 (lavender)
Danger:        #e07a7a (soft red)
```

### Typography
- **Headers:** Bold, slightly larger
- **Body:** Clean, readable
- **Reading titles:** Centered, mystical feel

### Tone Guidelines
- Mystical but accessible ("wise friend who reads tarot")
- Never clinical, never cringe
- No diagnosis, no literal predictions
- Plain English section: conversational, friendly, uses hedging language

---

## Out of Scope (MVP)

- Social features / following / public profiles
- Lucid dreaming exercises
- Sleep tracking / alarm integration
- Push notifications
- Multiple languages
- Apple Watch / widgets
- Web app
- Therapist/expert consultations
- Literal prediction claims
- ~~Payment integration~~ (implemented via RevenueCat)

---

## Non-Goals

- **Not a mental health tool:** We don't diagnose or treat
- **Not a prediction engine:** Omens are inspirational, not literal
- **Not a social network:** Private-first, sharing optional
- **Not a sleep tracker:** Focus is on meaning, not metrics

---

*Last updated: February 6, 2026*
