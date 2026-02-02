# Dreamz MVP Specification

> A mobile dream journal that transforms dream entries into mystical "readings" with symbols, omens, and rituals—preserved in a personal Grimoire.

---

## Executive Summary

**Product:** Dreamz
**Tagline:** Your dreams, divined.
**Platform:** iOS + Android (Expo/React Native), web Grimoire viewer (phase 2)
**Target Launch:** MVP in 3 weeks

### Core Loop
```
WRITE DREAM → GET READING → SAVE TO GRIMOIRE → NOTICE PATTERNS
```

### Success Criteria
1. User can log in, write a dream, get a reading, and see it saved in history
2. Readings are consistently structured and feel "mystical, warm, not cringe"
3. User can delete/export their dreams (trust feature)

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
1. Quickly capture a dream before it fades
2. Get an interesting interpretation that sparks reflection
3. Notice patterns over time (recurring symbols, themes)
4. Feel like dreams "mean something" without it being too serious

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | Expo (React Native) + TypeScript |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions) |
| AI | OpenAI GPT-4 via Supabase Edge Function |
| State | Zustand or React Context |
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

**Acceptance Criteria:**
- [ ] User can sign up/in with Apple
- [ ] User can sign up/in with Google
- [ ] User can sign up/in with email (magic link or password)
- [ ] New users get a profile created automatically
- [ ] Returning users go straight to Grimoire

---

### Screen 2: New Dream Entry

**Purpose:** Capture the dream quickly before it fades

**Elements:**
- Large text input (placeholder: "Describe your dream...")
- Mood picker (1-5 moons/stars)
- Emotion tags (optional multi-select: anxious, peaceful, confused, excited, sad, empowered)
- Vibes toggle (optional): Zodiac sign for personalization
- "Reveal Reading" button (primary CTA)
- "Save as Draft" (if offline or user wants to skip interpretation)

**Acceptance Criteria:**
- [ ] Dream text is required (min 10 characters)
- [ ] Mood defaults to 3 if not selected
- [ ] Emotions are optional (0 or more)
- [ ] Vibes/zodiac is optional
- [ ] Tapping "Reveal Reading" sends to AI and shows loading
- [ ] Drafts save locally if offline

**Data Captured:**
```typescript
interface DreamEntry {
  dream_text: string;       // required
  mood: 1 | 2 | 3 | 4 | 5;  // required, default 3
  emotions?: string[];      // optional tags
  vibes_sign?: string;      // optional zodiac
}
```

---

### Screen 3: Reading (Interpretation Result)

**Purpose:** Display the AI-generated mystical reading

**Loading State:**
- "Consulting the symbols..." with subtle animation
- Takes 3-8 seconds typically

**Result Layout:**
```
┌─────────────────────────────────────┐
│  ✧ THE RIVER & THE LOCKED DOOR ✧   │  ← Title
├─────────────────────────────────────┤
│  Your dream speaks of transition    │  ← TL;DR
│  and things left unresolved...      │
├─────────────────────────────────────┤
│  ◈ SYMBOLS REVEALED                 │
│  ───────────────────                │
│  🌊 River                           │
│  Flow, emotion, the passage of time │
│  Shadow: Feeling swept away         │
│  Guidance: What are you resisting?  │
│                                     │
│  🚪 Locked Door                     │
│  Hidden knowledge, opportunity      │
│  Shadow: Self-imposed barriers      │
│  Guidance: The key is already yours │
│  ...                                │
├─────────────────────────────────────┤
│  ☽ OMEN                             │
│  "Change flows toward you—          │
│   unlock yourself to receive it."   │
├─────────────────────────────────────┤
│  ✦ RITUAL                           │
│  Write down one door you've been    │
│  afraid to open. Burn the paper.    │
├─────────────────────────────────────┤
│  ? REFLECT                          │
│  What would you do if the door      │
│  was already unlocked?              │
├─────────────────────────────────────┤
│  #water #doors #transition #fear    │  ← Tags
├─────────────────────────────────────┤
│  [ Save to Grimoire ]  [ Share ]    │
└─────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Loading state shows for duration of API call
- [ ] All 7 sections render (title, tldr, symbols, omen, ritual, prompt, tags)
- [ ] Symbols show: name, meaning, shadow meaning, guidance
- [ ] 3-7 symbols per reading
- [ ] "Save to Grimoire" persists to database
- [ ] "Share" creates a shareable card (reading only, no dream text)
- [ ] Error state if AI fails (with retry option)

---

### Screen 4: Grimoire (Dream History)

**Purpose:** Browse and search past dreams and readings

**Elements:**
- Search bar (searches dream text, titles, tags)
- List of dreams, newest first
- Each item shows: Title, date, omen snippet, mood icon
- Tap to expand full reading
- Pull to refresh

**List Item:**
```
┌─────────────────────────────────────┐
│  ✧ The River & The Locked Door      │
│  Jan 29, 2026 · ☽☽☽☽○              │
│  "Change flows toward you..."       │
└─────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Dreams load paginated (20 at a time)
- [ ] Search filters results in real-time
- [ ] Tap opens full reading view
- [ ] Empty state: "Your Grimoire awaits its first dream..."
- [ ] Deleted dreams don't appear (soft delete)

---

### Screen 5: Settings

**Purpose:** Account management, data control, trust features

**Elements:**
- Profile section (email, display name, zodiac if set)
- "Export My Dreams" → downloads JSON or PDF
- "Delete a Dream" → opens list to select
- "Delete My Account" → confirmation flow
- "Privacy" → toggle sync on/off (future: local-only mode)
- App version + credits

**Acceptance Criteria:**
- [ ] Export generates downloadable file with all dreams + readings
- [ ] Delete dream soft-deletes (recoverable for 30 days)
- [ ] Delete account hard-deletes all data
- [ ] Confirmation required for destructive actions

---

## Data Models

### Database Schema (Supabase/Postgres)

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  birth_month INTEGER,           -- 1-12, optional
  zodiac_sign TEXT,              -- optional
  subscription_tier TEXT DEFAULT 'free',  -- 'free' | 'premium'
  readings_used_this_period INTEGER DEFAULT 0,
  period_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dreams and their readings
CREATE TABLE dreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  dream_text TEXT NOT NULL,
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  emotions TEXT[],               -- array of emotion tags
  vibes_sign TEXT,               -- zodiac sign used for this reading
  reading JSONB,                 -- full AI reading result
  tags TEXT[],                   -- extracted from reading for search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Symbol dictionary (curated, grows over time)
CREATE TABLE symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,     -- e.g., "river", "door", "snake"
  meaning TEXT NOT NULL,
  shadow_meaning TEXT,
  guidance TEXT,
  category TEXT,                 -- e.g., "nature", "objects", "animals"
  related_symbols TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_dreams_created_at ON dreams(created_at DESC);
CREATE INDEX idx_dreams_tags ON dreams USING GIN(tags);
CREATE INDEX idx_symbols_name ON symbols(name);
```

### Row Level Security (RLS)

```sql
-- Profiles: users can only see/edit their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Dreams: users can only access their own
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dreams"
  ON dreams FOR SELECT
  USING (auth.uid() = user_id AND is_deleted = FALSE);

CREATE POLICY "Users can insert own dreams"
  ON dreams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dreams"
  ON dreams FOR UPDATE
  USING (auth.uid() = user_id);

-- Symbols: public read, admin write
ALTER TABLE symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read symbols"
  ON symbols FOR SELECT
  USING (TRUE);
```

### TypeScript Interfaces

```typescript
interface Profile {
  id: string;
  email: string;
  display_name?: string;
  birth_month?: number;
  zodiac_sign?: string;
  subscription_tier: 'free' | 'premium';
  readings_used_this_period: number;
  period_reset_at?: string;
  created_at: string;
  updated_at: string;
}

interface Dream {
  id: string;
  user_id: string;
  dream_text: string;
  mood: 1 | 2 | 3 | 4 | 5;
  emotions?: string[];
  vibes_sign?: string;
  reading?: DreamReading;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

interface DreamReading {
  title: string;
  tldr: string;
  symbols: SymbolInterpretation[];
  omen: string;
  ritual: string;
  journal_prompt: string;
  tags: string[];
}

interface SymbolInterpretation {
  name: string;
  emoji?: string;
  meaning: string;
  shadow_meaning: string;
  guidance: string;
}

interface Symbol {
  id: string;
  name: string;
  meaning: string;
  shadow_meaning?: string;
  guidance?: string;
  category?: string;
  related_symbols?: string[];
}
```

---

## AI Integration

### Reading Generation (Supabase Edge Function)

**Endpoint:** `POST /functions/v1/generate-reading`

**Request:**
```typescript
{
  dream_text: string;
  mood?: number;
  emotions?: string[];
  zodiac_sign?: string;
  symbol_library?: Symbol[];  // inject curated symbols for consistency
}
```

**Response:**
```typescript
{
  success: boolean;
  reading?: DreamReading;
  error?: string;
}
```

### OpenAI Prompt Structure

```
SYSTEM:
You are a mystical dream interpreter—warm, poetic, and insightful.
You speak like a wise friend who reads tarot, not a therapist or scientist.
Your interpretations feel personal and meaningful, never generic.

Always respond with this exact JSON structure:
{
  "title": "Evocative 3-6 word title",
  "tldr": "2-3 sentence meaning summary",
  "symbols": [
    {
      "name": "symbol name",
      "emoji": "single emoji",
      "meaning": "what this symbol typically represents",
      "shadow_meaning": "the challenging or unconscious aspect",
      "guidance": "a question or gentle direction"
    }
  ],
  "omen": "One mystical sentence—the core message",
  "ritual": "One small, doable action",
  "journal_prompt": "One reflective question",
  "tags": ["3-7 lowercase tags for search"]
}

Guidelines:
- Extract 3-7 meaningful symbols from the dream
- Reference the provided symbol library when available
- Keep the tone mystical but accessible (not cringe, not clinical)
- Omen should feel like a fortune cookie from a wise friend
- Ritual should be completable in under 5 minutes
- Never diagnose, predict literal futures, or give medical advice

USER:
Dream: {dream_text}
Mood on waking: {mood}/5
Emotions felt: {emotions}
{zodiac_sign ? `Zodiac: ${zodiac_sign}` : ''}

Symbols to reference (if relevant): {symbol_library}
```

---

## Monetization

### Free Tier
- 5 readings per month
- Full journal/history access
- Basic search
- Export (JSON only)

### Premium Tier ($4.99/month)
- Unlimited readings
- Deeper symbol breakdowns (more symbols, richer guidance)
- Pattern insights ("You've dreamed of water 8 times this month")
- PDF export with beautiful formatting
- Priority support

### Implementation
- Track `readings_used_this_period` in profiles table
- Reset count on 1st of each month (cron job or check on read)
- Show upgrade prompt when limit reached
- Use RevenueCat or similar for IAP

---

## Milestones

### Week 1: Foundation
- [ ] Initialize Expo project with TypeScript
- [ ] Set up Supabase project (auth, database, RLS)
- [ ] Implement auth flow (Apple, Google, Email)
- [ ] Create navigation structure (tab bar: New Dream, Grimoire, Settings)
- [ ] Build empty states for all screens
- [ ] Set up basic theming (dark mode, mystical palette)

### Week 2: Core Loop
- [ ] Build New Dream entry screen
- [ ] Create Edge Function for AI reading generation
- [ ] Build Reading display screen
- [ ] Implement save to database
- [ ] Build Grimoire list view
- [ ] Implement dream detail view (tap to expand)
- [ ] Basic search functionality

### Week 3: Polish + Trust
- [ ] Settings screen (export, delete)
- [ ] Export functionality (JSON download)
- [ ] Delete dream flow
- [ ] Delete account flow
- [ ] Error handling + retry logic
- [ ] Loading states + animations
- [ ] UI polish pass
- [ ] Seed initial symbol library (20-30 common symbols)

### Post-MVP (Phase 2)
- [ ] Voice-to-text dream entry
- [ ] Share card generation
- [ ] Pattern insights ("recurring symbols" view)
- [ ] Web Grimoire viewer
- [ ] Lucid dreaming exercises
- [ ] Push notification reminders
- [ ] Premium tier + payments

---

## Design Direction

### Atmosphere
- **Mood:** Mystical grimoire, moonlit, intimate
- **Not:** Clinical, bright, corporate, gamified

### Color Palette (Dark Mode First)
```
Background:    #0D0D12 (deep night)
Surface:       #1A1A24 (card background)
Primary:       #9D8CFF (soft violet)
Secondary:     #FFD700 (gold accents)
Text Primary:  #F5F5F7 (soft white)
Text Muted:    #8E8E93 (gray)
Accent:        #FF6B9D (rose, for mood/emotion)
```

### Typography
- **Headers:** Serif or decorative (mystical feel)
- **Body:** Clean sans-serif (readability)
- **Reading titles:** Special treatment (centered, ornamental)

### Iconography
- Moon phases for mood (☽○)
- Stars and celestial elements
- Subtle sparkle animations on interactions

---

## Risk Considerations

| Risk | Mitigation |
|------|------------|
| AI output inconsistency | Strong system prompt + output validation + retry |
| AI latency (slow readings) | Show engaging loading state, cache symbol library |
| User privacy concerns | Transparent privacy note, easy delete, no analytics creep |
| Content moderation | AI won't diagnose; add disclaimer in onboarding |
| Rate limiting costs | Freemium model caps free usage |
| Offline failures | Queue dreams locally, sync when online |

---

## Out of Scope (MVP)

- Social features / following / public profiles
- Lucid dreaming exercises
- Sleep tracking / alarm integration
- Push notifications
- Multiple languages
- Apple Watch / widgets
- Web app (except phase 2 viewer)
- Therapist/expert consultations
- Literal prediction claims

---

## Non-Goals

- **Not a mental health tool:** We don't diagnose or treat
- **Not a prediction engine:** Omens are inspirational, not literal
- **Not a social network:** Private-first, sharing optional
- **Not a sleep tracker:** Focus is on meaning, not metrics

---

## Appendix: Initial Symbol Library (Seed)

Start with 25-30 common dream symbols:

| Symbol | Category | Meaning |
|--------|----------|---------|
| Water | Nature | Emotion, the unconscious, purification |
| Flying | Action | Freedom, transcendence, escape |
| Falling | Action | Loss of control, anxiety, letting go |
| Teeth | Body | Confidence, self-image, communication |
| Snake | Animal | Transformation, fear, hidden knowledge |
| House | Place | Self, psyche, different rooms = aspects |
| Door | Object | Opportunity, transition, secrets |
| Mirror | Object | Self-reflection, truth, identity |
| Death | Theme | Endings, transformation, rebirth |
| Baby | Person | New beginnings, vulnerability, potential |
| Chase | Action | Avoidance, anxiety, confrontation needed |
| Naked | State | Vulnerability, authenticity, exposure |
| Car | Object | Life direction, control, journey |
| Ocean | Nature | Vast unconscious, emotions, the unknown |
| Fire | Nature | Passion, destruction, transformation |
| Forest | Place | The unconscious, getting lost, discovery |
| Moon | Celestial | Intuition, cycles, the feminine |
| Sun | Celestial | Consciousness, vitality, clarity |
| Bridge | Object | Transition, connection, crossing over |
| Stairs | Object | Progress, ascent/descent, levels of consciousness |

---

*Last updated: January 30, 2026*
