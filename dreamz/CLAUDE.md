# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dreamz** is a mobile dream journal app that transforms dream entries into mystical "readings" with symbols, omens, and rituals. Target audience: wellness/witchy/astrology-adjacent users seeking quick, private, mystical interpretations.

**Core Loop:** Write dream → Get AI reading → Save to Grimoire → Notice patterns

## Tech Stack

- **Mobile:** Expo (React Native) + TypeScript
- **Backend:** Supabase (Auth, Postgres, RLS, Edge Functions)
- **AI:** OpenAI GPT-4 via Supabase Edge Function
- **State:** Zustand or React Context
- **Offline:** AsyncStorage for draft dreams

## Key Architecture Decisions

### AI Reading Structure (must be consistent)
Every reading must contain: title, tldr, symbols (3-7 with meaning/shadow/guidance), omen, ritual, journal_prompt, tags

### Data Privacy
- Dreams are private by default (RLS enforced)
- Minimal data collection (no location, no exact birthdate)
- User can export/delete all data
- Soft delete with 30-day recovery

### Tone Guidelines
- Mystical but accessible ("wise friend who reads tarot")
- Never clinical, never cringe
- No diagnosis, no literal predictions

## Database Tables

- `profiles` - User data, subscription tier, reading count
- `dreams` - Dream text, mood, emotions, reading (JSONB)
- `symbols` - Curated symbol dictionary

## Team Rules (Claude Agents)

### Mission
Build a mystical "dream dictionary" mobile app MVP that is:
- Private-first and trustworthy
- Fast, stable, and maintainable
- Consistent in UX tone (mystical, warm, not cringe)
- Strict about AI output format (JSON contract)

### Roles

**tech-lead** (`dream-dict-tech-lead`)
- Owns architecture decisions and the "Definition of Done"
- Performs refactor + optimization review on all changes
- Ensures QA checklist is satisfied before anything is marked complete

**frontend-dev** (`frontend-dev-dream`)
- Owns UI, navigation, state management, offline/draft behavior, and client integration
- Must implement clear loading/error/empty states and accessible UI
- Must verify flows end-to-end with QA steps after changes

**backend-dev** (`dream-backend-dev`)
- Owns schema, RLS security, API endpoints, AI reading endpoint, validation/retry/fallback
- Must document migrations and setup steps
- Must verify RLS + failure modes and align with QA checklist

**Specialist Agents**
- `product-spec-agent` - Product planning and specifications
- `mobile-architect` - Expo/React Native architecture decisions
- `dream-reading-prompt-engineer` - AI prompt engineering for readings
- `mystic-ux-copy` - In-app microcopy with mystical tone
- `dream-symbol-curator` - Symbol dictionary entries
- `dream-app-qa` - Testing and QA

### Working Agreement

**1) Small, mergeable increments**
- Prefer PR-sized steps: one feature slice at a time
- If a change touches many areas, split into stages:
  1. scaffolding (no behavior change)
  2. feature implementation
  3. refactor/cleanup

**2) Plan before code**
Before writing code, include:
- Goal (1–2 sentences)
- Assumptions (if any)
- Files to be changed
- How to test (manual steps + command if applicable)

**3) QA gate (mandatory)**
Nothing is "done" until it passes QA verification.
- Always consult the QA checklist/test plan
- Provide: commands run (lint/test/build), manual test steps performed, edge cases tested
- If tests do not exist, add them OR document why not and add a follow-up task

**4) Refactor + optimization review (mandatory)**
tech-lead must review for:
- Duplication, complexity, unclear naming
- Performance hot spots (unnecessary renders, large lists, repeated queries)
- Over-engineering (keep MVP simple)
- Type-safety and runtime safety
- Consistent patterns

### Coding Standards

**General**
- TypeScript everywhere
- No secrets in code. Use `.env` and `.env.example`
- No new libraries without justification and tech-lead approval
- Prefer boring, well-known patterns over clever ones

**Frontend**
- Keep screens thin; move logic into hooks/services
- Consistent UI components and spacing
- Include loading/error/empty states for every networked screen
- Don't show dream text in notifications by default

**Backend**
- Enforce strict RLS: users can only access their own rows
- Validate all inputs
- Avoid storing extra PII (no precise location; no full DOB)
- Return clear error codes/messages for client handling

### AI Reading Contract (non-negotiable)
- AI responses must be strict JSON matching the agreed schema
- Implement: JSON validation, retry (limited), safe fallback output (still valid JSON)
- Never ship model "freeform prose" responses to the client

### UX Tone Rules
- Voice: mystical, inviting, modern, slightly poetic—never cheesy
- Avoid medical/diagnostic language. No certainty claims like "this means you will…"
- Always frame as interpretation: "often suggests…", "may reflect…"

### Testing Expectations
Minimum coverage for MVP flows:
- Auth: sign up/in/out
- Create dream: submit entry
- Analyze: request → validate JSON → display reading
- Persistence: save + fetch history
- Delete: remove dream, confirm UI updates
- Export: user can export their data
- Failure modes: offline / model failure / invalid JSON / expired session

### Definition of Done
A task is done only if:
- Feature works end-to-end
- QA gate satisfied (tests and/or manual verification documented)
- No obvious security/privacy issues
- Code is readable and consistent
- Docs updated (if setup, schema, or env vars changed)

### Communication Format (commits/PR notes)
Always include:
- What changed
- Why it changed
- How to test
- Risks/edge cases
- Follow-ups (if any)

## Project Documentation

- `/docs/MVP-SPEC.md` - Complete MVP specification with screens, data models, milestones
- `/docs/QA.md` - QA checklist for every PR/feature (mandatory before "done")
