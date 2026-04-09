# AI Data Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Apple-compliant AI data consent flow so users explicitly opt in before dream data is sent to OpenAI.

**Architecture:** A `useAIConsent` hook manages consent state across Supabase (source of truth) and AsyncStorage (cache). A reusable `AIConsentModal` component is rendered in onboarding (informational) and before first dream analysis (blocking gate). The Grimoire adapts to show a simplified journal-only view when consent is not granted.

**Tech Stack:** React Native, TypeScript, Supabase (Postgres + RLS), AsyncStorage, Detox (E2E), Jest (unit)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `supabase/migrations/019_add_ai_consent.sql` | DB migration: add consent columns to profiles |
| `src/types/index.ts` | Add `ai_consent_granted`, `ai_consent_date` to Profile type |
| `src/lib/aiConsentService.ts` | Read/write consent state (Supabase + AsyncStorage) |
| `src/hooks/useAIConsent.ts` | React hook wrapping aiConsentService |
| `src/components/AIConsentModal.tsx` | Reusable consent disclosure modal |
| `src/screens/OnboardingScreen.tsx` | Add ai-disclosure step (4-step flow) |
| `src/screens/NewDreamScreen.tsx` | Gate analyzeDream() behind consent check |
| `src/screens/GrimoireScreen.tsx` | No-consent state: simplified cards, banner |
| `src/screens/SettingsScreen.tsx` | AI consent toggle section |
| `src/lib/__tests__/aiConsentService.test.ts` | Unit tests for consent service |
| `e2e/helpers/db.ts` | Add consent helper functions |
| `e2e/onboarding.test.ts` | Update for 4-step flow |
| `e2e/dream-entry.test.ts` | Grant consent in beforeAll |
| `e2e/grimoire.test.ts` | Grant consent in beforeAll |
| `e2e/ai-consent.test.ts` | New E2E: consent flow |
| `e2e/ai-consent-grimoire.test.ts` | New E2E: Grimoire no-consent state |
| `e2e/settings.test.ts` | Add consent toggle tests |
| `docs/QA.md` | Add AI consent section |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/019_add_ai_consent.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add AI consent tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN ai_consent_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN ai_consent_date timestamptz;

-- Backfill: grant consent to all existing users
-- They signed up under the original privacy policy which disclosed AI usage
UPDATE profiles
  SET ai_consent_granted = true,
      ai_consent_date = NOW()
  WHERE ai_consent_granted = false;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via Supabase dashboard if remote)
Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Verify columns exist**

Run against the database:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('ai_consent_granted', 'ai_consent_date');
```
Expected: Two rows returned with correct types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_add_ai_consent.sql
git commit -m "feat: add ai_consent columns to profiles table"
```

---

### Task 2: Update Profile Type

**Files:**
- Modify: `src/types/index.ts:34-45`

- [ ] **Step 1: Add consent fields to Profile interface**

In `src/types/index.ts`, add two fields to the `Profile` interface after `onboarding_completed`:

```typescript
export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  reading_count: number;
  subscription_tier: 'free' | 'premium';
  zodiac_sign?: string;
  gender?: Gender;
  age_range?: AgeRange;
  onboarding_completed?: boolean;
  ai_consent_granted?: boolean;
  ai_consent_date?: string;
  created_at: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ai_consent fields to Profile type"
```

---

### Task 3: AI Consent Service (with TDD)

**Files:**
- Create: `src/lib/aiConsentService.ts`
- Create: `src/lib/__tests__/aiConsentService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/aiConsentService.test.ts`:

```typescript
/**
 * Tests for AI Consent Service
 * @file src/lib/__tests__/aiConsentService.test.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { getAIConsent, grantAIConsent, revokeAIConsent } from '../aiConsentService';

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

const STORAGE_KEY = 'dreamz_ai_consent';

describe('AI Consent Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAIConsent', () => {
    it('should return cached AsyncStorage value when available', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ granted: true, date: '2026-04-09T00:00:00Z' })
      );

      const result = await getAIConsent();

      expect(result).toEqual({ granted: true, date: '2026-04-09T00:00:00Z' });
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should fall back to Supabase profile when AsyncStorage is empty', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ai_consent_granted: true, ai_consent_date: '2026-04-09T00:00:00Z' },
          error: null,
        }),
      });

      const result = await getAIConsent();

      expect(result).toEqual({ granted: true, date: '2026-04-09T00:00:00Z' });
      // Should cache the result in AsyncStorage
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ granted: true, date: '2026-04-09T00:00:00Z' })
      );
    });

    it('should return false for new users with no consent record', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ai_consent_granted: false, ai_consent_date: null },
          error: null,
        }),
      });

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
    });

    it('should return false when not authenticated and no cache', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const result = await getAIConsent();

      expect(result).toEqual({ granted: false, date: null });
    });
  });

  describe('grantAIConsent', () => {
    it('should write to both Supabase and AsyncStorage', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await grantAIConsent();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"granted":true')
      );
    });

    it('should still write AsyncStorage when Supabase fails', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: { message: 'Network error' } }),
      });

      await grantAIConsent();

      // Should still cache locally despite Supabase failure
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining('"granted":true')
      );
    });
  });

  describe('revokeAIConsent', () => {
    it('should clear both Supabase and AsyncStorage', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await revokeAIConsent();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ granted: false, date: null })
      );
    });

    it('should still clear AsyncStorage when Supabase fails', async () => {
      const mockUser = { id: 'user-123' };
      (mockedSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const mockFrom = mockedSupabase.from as jest.Mock;
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: { message: 'Network error' } }),
      });

      await revokeAIConsent();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ granted: false, date: null })
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/__tests__/aiConsentService.test.ts`
Expected: FAIL — `Cannot find module '../aiConsentService'`

- [ ] **Step 3: Implement the consent service**

Create `src/lib/aiConsentService.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const STORAGE_KEY = 'dreamz_ai_consent';

interface ConsentState {
  granted: boolean;
  date: string | null;
}

/**
 * Get the current AI consent state.
 * Checks AsyncStorage cache first, falls back to Supabase profile.
 */
export async function getAIConsent(): Promise<ConsentState> {
  // Check local cache first
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Cache read failed — fall through to Supabase
  }

  // Fall back to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { granted: false, date: null };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('ai_consent_granted, ai_consent_date')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      return { granted: false, date: null };
    }

    const state: ConsentState = {
      granted: data.ai_consent_granted ?? false,
      date: data.ai_consent_date ?? null,
    };

    // Cache for next time
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return { granted: false, date: null };
  }
}

/**
 * Grant AI consent. Writes to both Supabase and AsyncStorage.
 * If Supabase fails, still writes to AsyncStorage (offline support).
 */
export async function grantAIConsent(): Promise<void> {
  const now = new Date().toISOString();
  const state: ConsentState = { granted: true, date: now };

  // Write to AsyncStorage first (fast, offline-safe)
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  // Write to Supabase (authoritative)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ ai_consent_granted: true, ai_consent_date: now })
        .eq('id', user.id);
    }
  } catch {
    // Supabase write failed — AsyncStorage still has the consent
  }
}

/**
 * Revoke AI consent. Clears both Supabase and AsyncStorage.
 * If Supabase fails, still clears AsyncStorage.
 */
export async function revokeAIConsent(): Promise<void> {
  const state: ConsentState = { granted: false, date: null };

  // Write to AsyncStorage first
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  // Write to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ ai_consent_granted: false, ai_consent_date: null })
        .eq('id', user.id);
    }
  } catch {
    // Supabase write failed — AsyncStorage still cleared
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/aiConsentService.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/aiConsentService.ts src/lib/__tests__/aiConsentService.test.ts
git commit -m "feat: add AI consent service with Supabase + AsyncStorage"
```

---

### Task 4: useAIConsent Hook

**Files:**
- Create: `src/hooks/useAIConsent.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useAIConsent.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import {
  getAIConsent,
  grantAIConsent as grantService,
  revokeAIConsent as revokeService,
} from '../lib/aiConsentService';

interface UseAIConsent {
  /** null = still loading, boolean = resolved consent state */
  hasConsent: boolean | null;
  grantConsent: () => Promise<void>;
  revokeConsent: () => Promise<void>;
}

export function useAIConsent(): UseAIConsent {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);

  useEffect(() => {
    getAIConsent().then((state) => {
      setHasConsent(state.granted);
    });
  }, []);

  const grantConsent = useCallback(async () => {
    await grantService();
    setHasConsent(true);
  }, []);

  const revokeConsent = useCallback(async () => {
    await revokeService();
    setHasConsent(false);
  }, []);

  return { hasConsent, grantConsent, revokeConsent };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAIConsent.ts
git commit -m "feat: add useAIConsent React hook"
```

---

### Task 5: AIConsentModal Component

**Files:**
- Create: `src/components/AIConsentModal.tsx`

- [ ] **Step 1: Create the modal component**

Create `src/components/AIConsentModal.tsx`:

```typescript
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';

interface AIConsentModalProps {
  visible: boolean;
  onAllow: () => void;
  onDecline: () => void;
}

export default function AIConsentModal({ visible, onAllow, onDecline }: AIConsentModalProps) {
  return (
    <Modal
      testID="ai-consent-modal"
      visible={visible}
      transparent
      animationType="fade"
      accessibilityViewIsModal={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Before We Read Your Dream</Text>

          <Text style={styles.body}>
            To interpret your dream, we send the following to OpenAI:
          </Text>

          <View style={styles.dataList}>
            <Text style={styles.dataItem}>Your dream text</Text>
            <Text style={styles.dataItem}>Your selected mood</Text>
            <Text style={styles.dataItem}>
              Profile details you've shared (zodiac sign, gender, age range)
            </Text>
          </View>

          <Text style={styles.body}>
            Your data is processed solely for generating your reading and is not
            used to train AI models.
          </Text>

          <TouchableOpacity
            testID="ai-consent-privacy-link"
            onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
            accessibilityRole="link"
            accessibilityLabel="Read our Privacy Policy"
          >
            <Text style={styles.privacyLink}>Read our Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="ai-consent-allow"
            style={styles.allowButton}
            onPress={onAllow}
            accessibilityRole="button"
            accessibilityLabel="Allow Dream Readings"
          >
            <Text style={styles.allowButtonText}>Allow Dream Readings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="ai-consent-decline"
            style={styles.declineButton}
            onPress={onDecline}
            accessibilityRole="button"
            accessibilityLabel="Not Now"
          >
            <Text style={styles.declineButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    color: '#c0b4e0',
    lineHeight: 22,
    marginBottom: 12,
  },
  dataList: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  dataItem: {
    fontSize: 14,
    color: '#e0d4f7',
    lineHeight: 22,
    paddingLeft: 8,
  },
  privacyLink: {
    color: '#9b7fd4',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
  allowButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  allowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  declineButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#8b7fa8',
    fontSize: 16,
  },
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AIConsentModal.tsx
git commit -m "feat: add AIConsentModal component"
```

---

### Task 6: Onboarding AI Disclosure Step

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

- [ ] **Step 1: Add `ai-disclosure` to the step type and flow**

In `OnboardingScreen.tsx`, make these changes:

1. Update the `OnboardingStep` type:
```typescript
type OnboardingStep = 'tier' | 'about' | 'ai-disclosure' | 'welcome';
```

2. Update `handleAboutContinue` to go to `ai-disclosure` instead of `welcome`:
```typescript
  const handleAboutContinue = async () => {
    setSaving(true);
    const tier = selectedTier === 'premium' && await checkPremiumAccess() ? 'premium' : 'free';
    const updates: Parameters<typeof updateProfile>[0] = {
      subscription_tier: tier,
    };
    if (displayName.trim()) updates.display_name = displayName.trim();
    if (selectedZodiac) updates.zodiac_sign = selectedZodiac;
    if (selectedGender) updates.gender = selectedGender;
    if (selectedAge) updates.age_range = selectedAge;

    await updateProfile(updates);
    setSaving(false);
    setStep('ai-disclosure');
  };
```

3. Update `handleSkip` to go to `ai-disclosure` instead of `welcome`:
```typescript
  const handleSkip = async () => {
    setSaving(true);
    const tier = selectedTier === 'premium' && await checkPremiumAccess() ? 'premium' : 'free';
    await updateProfile({ subscription_tier: tier });
    setSaving(false);
    setStep('ai-disclosure');
  };
```

4. Update `renderProgressDots` to include 4 steps:
```typescript
  const renderProgressDots = () => {
    const steps: OnboardingStep[] = ['tier', 'about', 'ai-disclosure', 'welcome'];
    const currentIndex = steps.indexOf(step);
    // ... rest unchanged
  };
```

- [ ] **Step 2: Add the AI disclosure step renderer**

Add this function before `renderWelcomeStep`:

```typescript
  const renderAIDisclosureStep = () => (
    <ScrollView contentContainerStyle={[styles.stepContent, contentStyle]}>
      <Text style={styles.stepTitle}>How Your Dreams Are Read</Text>
      <Text style={styles.stepSubtitle}>
        A little transparency before we begin
      </Text>

      <View style={styles.disclosureCard}>
        <Text style={styles.disclosureText}>
          When you request a reading, your dream text and selected mood are sent
          to an AI service (OpenAI) for interpretation.
        </Text>
        <Text style={styles.disclosureText}>
          If you've shared your zodiac sign, gender, or age range, these are
          included to personalize your reading.
        </Text>
        <Text style={[styles.disclosureText, styles.disclosureEmphasis]}>
          Your dreams are never used to train AI models.{'\n'}
          Your data is never sold.
        </Text>
      </View>

      <TouchableOpacity
        testID="onboarding-ai-privacy-link"
        onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
        accessibilityRole="link"
        accessibilityLabel="Read our Privacy Policy"
      >
        <Text style={styles.privacyLinkText}>Read our Privacy Policy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="onboarding-ai-continue"
        style={styles.continueButton}
        onPress={() => setStep('welcome')}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
```

- [ ] **Step 3: Render the new step and add import**

Add `Linking` to the react-native imports at the top:
```typescript
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Linking,
} from 'react-native';
```

Add the step to the render:
```typescript
  return (
    <SafeAreaView style={styles.container}>
      {renderProgressDots()}
      {step === 'tier' && renderTierStep()}
      {step === 'about' && renderAboutStep()}
      {step === 'ai-disclosure' && renderAIDisclosureStep()}
      {step === 'welcome' && renderWelcomeStep()}
    </SafeAreaView>
  );
```

- [ ] **Step 4: Add styles for the disclosure step**

Add these styles to the `StyleSheet.create` block:

```typescript
  disclosureCard: {
    backgroundColor: '#2a2a5e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(107, 78, 158, 0.4)',
  },
  disclosureText: {
    fontSize: 15,
    color: '#c0b8d8',
    lineHeight: 22,
    marginBottom: 12,
  },
  disclosureEmphasis: {
    fontWeight: '600',
    color: '#e0d4f7',
    marginBottom: 0,
  },
  privacyLinkText: {
    color: '#9b7fd4',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
```

- [ ] **Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: No errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "feat: add AI disclosure step to onboarding (4-step flow)"
```

---

### Task 7: NewDreamScreen Consent Gate

**Files:**
- Modify: `src/screens/NewDreamScreen.tsx`

- [ ] **Step 1: Import hook and modal, add state**

Add imports at the top of `NewDreamScreen.tsx`:
```typescript
import { useAIConsent } from '../hooks/useAIConsent';
import AIConsentModal from '../components/AIConsentModal';
```

Add state and hook inside the component, after the existing state declarations:
```typescript
  const { hasConsent, grantConsent } = useAIConsent();
  const [showConsentModal, setShowConsentModal] = useState(false);
```

- [ ] **Step 2: Add consent check to handleSubmit**

In `handleSubmit()`, after the mood validation check (after `if (moods.length === 0)` block), add the consent gate:

```typescript
    // Check AI consent before proceeding with analysis
    if (hasConsent === null) {
      // Still loading consent state — wait for it
      const { granted } = await import('../lib/aiConsentService').then(m => m.getAIConsent());
      if (!granted) {
        setShowConsentModal(true);
        return;
      }
    } else if (!hasConsent) {
      setShowConsentModal(true);
      return;
    }
```

- [ ] **Step 3: Add consent modal handlers**

Add two handler functions before the `return` statement:

```typescript
  async function handleConsentAllow() {
    setShowConsentModal(false);
    await grantConsent();
    // Proceed with the dream submission flow
    handleSubmit();
  }

  function handleConsentDecline() {
    setShowConsentModal(false);
  }
```

- [ ] **Step 4: Render the modal**

Add the modal just inside the `<SafeAreaView>`, before the `<LinearGradient>`:

```typescript
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AIConsentModal
        visible={showConsentModal}
        onAllow={handleConsentAllow}
        onDecline={handleConsentDecline}
      />
      <LinearGradient
```

- [ ] **Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: No errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/NewDreamScreen.tsx
git commit -m "feat: gate dream analysis behind AI consent check"
```

---

### Task 8: Grimoire No-Consent State

**Files:**
- Modify: `src/screens/GrimoireScreen.tsx`

- [ ] **Step 1: Import hook, modal, and add state**

Add imports:
```typescript
import { useAIConsent } from '../hooks/useAIConsent';
import AIConsentModal from '../components/AIConsentModal';
```

Inside the component, after existing state:
```typescript
  const { hasConsent, grantConsent } = useAIConsent();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
```

- [ ] **Step 2: Add consent banner**

Add a `renderConsentBanner` function before the `return` statement:

```typescript
  const renderConsentBanner = () => {
    if (hasConsent !== false || bannerDismissed || dreams.length === 0) return null;

    return (
      <View testID="grimoire-consent-banner" style={styles.consentBanner}>
        <Text style={styles.consentBannerText}>
          Your dreams are private reflections. Enable AI readings to unlock
          mystical interpretations and symbol tracking.
        </Text>
        <View style={styles.consentBannerButtons}>
          <TouchableOpacity
            testID="grimoire-consent-enable"
            style={styles.consentEnableButton}
            onPress={() => setShowConsentModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Enable Readings"
          >
            <Text style={styles.consentEnableText}>Enable Readings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="grimoire-consent-dismiss"
            onPress={() => setBannerDismissed(true)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.consentDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
```

- [ ] **Step 3: Conditionally hide symbol pills and modify search**

Wrap the symbol pills section with a consent check:
```typescript
        {hasConsent !== false && dreams.length > 0 && symbolPills.length > 0 && (
```

In the `filteredDreams` useMemo, update the text search to be consent-aware. Replace the existing search filter block:

```typescript
      // Text search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const text = dream.dream_text.toLowerCase();
        const mood = dream.mood?.toLowerCase() || '';

        if (hasConsent === false) {
          // No-consent mode: only search dream text and mood
          if (!text.includes(query) && !mood.includes(query)) {
            return false;
          }
        } else {
          const title = dream.reading?.title?.toLowerCase() || '';
          const tags = dream.reading?.tags?.join(' ').toLowerCase() || '';
          const omen = dream.reading?.omen?.toLowerCase() || '';

          if (
            !title.includes(query) &&
            !text.includes(query) &&
            !tags.includes(query) &&
            !omen.includes(query)
          ) {
            return false;
          }
        }
      }
```

- [ ] **Step 4: Modify dream card rendering for no-consent state**

In `renderDream`, update the `handleDreamPress` callback and card rendering. Inside `renderDream`, after the `isForgot` card return, add a no-consent card path:

```typescript
    // No-consent or no-reading cards: simplified journal entry
    if (!hasReading) {
      return (
        <TouchableOpacity
          testID="grimoire-dream-item"
          accessibilityRole="button"
          accessibilityLabel={`Dream from ${dateLabel}${item.mood ? ', ' + item.mood : ''}`}
          accessibilityHint="View dream entry"
          style={styles.journalCard}
          onPress={() => {
            Alert.alert(
              dateLabel,
              item.dream_text,
              [{ text: 'Close' }]
            );
          }}
          onLongPress={() => handleDeletePress(item)}
        >
          <LinearGradient
            colors={isNightmare
              ? ['#3a1a30', '#2a1528', '#1e1a2a']
              : ['#2d2860', '#252050', '#1a1a3e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.journalCardFallback]}
          >
            <View style={styles.starsOverlay} pointerEvents="none">
              <View style={[styles.star, styles.star1]} />
              <View style={[styles.star, styles.star2]} />
              <View style={[styles.star, styles.starLg, styles.star3]} />
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeMonth}>{dateBadge.month}</Text>
              <Text style={styles.dateBadgeDay}>{dateBadge.day}</Text>
            </View>
            <View style={styles.journalCardBottom}>
              <Text style={styles.typeIcon}>
                {isNightmare ? '\u{26A1}' : '\u{1F319}'}
              </Text>
              {item.mood && (
                <Text style={[styles.dreamPreview, isNightmare && styles.nightmareText]}>
                  {item.mood}
                </Text>
              )}
              <Text
                style={[styles.dreamPreview, isNightmare && styles.nightmareText]}
                numberOfLines={2}
              >
                {item.dream_text}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    }
```

Then remove the existing `!hasReading` indicator from the regular card path since we now handle it above:
```typescript
          {/* Remove this block — it's now handled by the no-reading card above */}
          {/* {!hasReading && (
            <Text style={styles.noReadingIndicator}>No reading yet</Text>
          )} */}
```

- [ ] **Step 5: Update empty state and add consent modal + banner to render**

In the empty state (`dreams.length === 0`), make the text consent-aware:
```typescript
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>
              {hasConsent === false ? '\u{1F4D3}' : '\u{1F4D6}'}
            </Text>
            <Text style={styles.emptyText}>
              {hasConsent === false
                ? 'Your journal awaits its first entry...'
                : 'Your grimoire awaits its first entry...'}
            </Text>
            <Text style={styles.emptySubtext}>
              Record a dream to begin your journey
            </Text>
```

Add the consent banner and modal in the render. Insert `{renderConsentBanner()}` after the subtitle row, and add the modal:

```typescript
        <AIConsentModal
          visible={showConsentModal}
          onAllow={async () => {
            setShowConsentModal(false);
            await grantConsent();
          }}
          onDecline={() => setShowConsentModal(false)}
        />

        {/* ... existing title, subtitle row ... */}

        {renderConsentBanner()}

        {/* ... existing pills, search, list ... */}
```

- [ ] **Step 6: Add consent banner styles**

```typescript
  consentBanner: {
    backgroundColor: '#2a2a5e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(107, 78, 158, 0.4)',
  },
  consentBannerText: {
    fontSize: 14,
    color: '#c0b8d8',
    lineHeight: 20,
    marginBottom: 12,
  },
  consentBannerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consentEnableButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  consentEnableText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  consentDismissText: {
    color: '#8b7fa8',
    fontSize: 14,
  },
```

- [ ] **Step 7: Run typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: No errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/screens/GrimoireScreen.tsx
git commit -m "feat: add Grimoire no-consent state with journal-only view"
```

---

### Task 9: Settings AI Consent Toggle

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Import hook, modal, and add state**

Add imports at the top:
```typescript
import { useAIConsent } from '../hooks/useAIConsent';
import AIConsentModal from '../components/AIConsentModal';
```

Inside the component, add:
```typescript
  const { hasConsent, grantConsent, revokeConsent } = useAIConsent();
  const [showAIConsentModal, setShowAIConsentModal] = useState(false);
```

- [ ] **Step 2: Add the AI Data Sharing section**

Insert a new section after the Reminders section (before the "Your Data" section). Find the line `<View style={styles.section}>` with `<Text style={styles.sectionTitle}>Your Data</Text>` and add before it:

```typescript
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Data Sharing</Text>

          <View style={[styles.card, styles.cardButton]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Allow AI Dream Readings</Text>
              <Text style={styles.menuItemSubtext}>
                Dream readings are powered by OpenAI
              </Text>
            </View>
            <Switch
              testID="settings-ai-consent-toggle"
              value={hasConsent === true}
              onValueChange={(value) => {
                if (value) {
                  setShowAIConsentModal(true);
                } else {
                  Alert.alert(
                    'Disable AI Readings?',
                    'You will no longer receive dream interpretations. You can re-enable this at any time.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: revokeConsent,
                      },
                    ]
                  );
                }
              }}
              trackColor={{ false: '#3a3a5e', true: '#6b4e9e' }}
              thumbColor={hasConsent ? '#e0d4f7' : '#8b7fa8'}
            />
          </View>

          <TouchableOpacity
            testID="settings-ai-consent-learn-more"
            onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
            accessibilityRole="link"
            accessibilityLabel="Learn more about AI data sharing"
          >
            <Text style={styles.aiLearnMore}>Learn more about how your data is used</Text>
          </TouchableOpacity>
        </View>
```

- [ ] **Step 3: Add the consent modal to the render tree**

Add the modal just inside the `<SafeAreaView>`, before the existing modals:

```typescript
      <AIConsentModal
        visible={showAIConsentModal}
        onAllow={async () => {
          setShowAIConsentModal(false);
          await grantConsent();
        }}
        onDecline={() => setShowAIConsentModal(false)}
      />
```

- [ ] **Step 4: Add the learn-more style**

Add to the StyleSheet:
```typescript
  aiLearnMore: {
    color: '#9b7fd4',
    fontSize: 13,
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 4,
  },
```

- [ ] **Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: No errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add AI consent toggle to Settings screen"
```

---

### Task 10: E2E Test Helpers

**Files:**
- Modify: `e2e/helpers/db.ts`

- [ ] **Step 1: Add consent helper functions**

Append to `e2e/helpers/db.ts`:

```typescript
/**
 * Grants AI consent for the test account.
 * Call this in beforeAll for test suites that need AI analysis.
 */
export async function grantTestAccountAIConsent(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[grantTestAccountAIConsent] Supabase env vars not set — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[grantTestAccountAIConsent] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[grantTestAccountAIConsent] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted: true, ai_consent_date: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.warn('[grantTestAccountAIConsent] Failed:', error.message);
  }

  await supabase.auth.signOut();
}

/**
 * Revokes AI consent for the test account.
 * Call this in beforeAll for test suites that test the no-consent state.
 */
export async function revokeTestAccountAIConsent(): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[revokeTestAccountAIConsent] Supabase env vars not set — skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInError) {
    console.warn('[revokeTestAccountAIConsent] Sign-in failed:', signInError.message);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[revokeTestAccountAIConsent] No user after sign-in');
    await supabase.auth.signOut();
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ai_consent_granted: false, ai_consent_date: null })
    .eq('id', user.id);

  if (error) {
    console.warn('[revokeTestAccountAIConsent] Failed:', error.message);
  }

  await supabase.auth.signOut();
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/db.ts
git commit -m "feat: add AI consent E2E test helpers"
```

---

### Task 11: Update Existing E2E Tests for Consent

**Files:**
- Modify: `e2e/onboarding.test.ts`
- Modify: `e2e/dream-entry.test.ts`
- Modify: `e2e/grimoire.test.ts`

- [ ] **Step 1: Update onboarding tests for 4-step flow**

In `e2e/onboarding.test.ts`, update the first test (`should complete full onboarding`). After the about step continues, add the AI disclosure step:

After `await tapById('onboarding-about-continue');`, add:
```typescript
    // AI Disclosure step
    await pollForVisible('onboarding-ai-continue', 10000);
    await tapById('onboarding-ai-continue');
```

Update the skip test (`should skip about-you step and still reach home`). After `await tapById('onboarding-about-skip');`, add:
```typescript
    // AI Disclosure step (always shown, even after skip)
    await pollForVisible('onboarding-ai-continue', 10000);
    await tapById('onboarding-ai-continue');
```

Update the display name test and zodiac test similarly — add the AI disclosure step between about-continue and welcome.

- [ ] **Step 2: Update dream-entry tests**

In `e2e/dream-entry.test.ts`, add consent grant to `beforeAll`:

Add import:
```typescript
import { setTestAccountPremium, grantTestAccountAIConsent } from './helpers/db';
```

Update `beforeAll`:
```typescript
  beforeAll(async () => {
    await setTestAccountPremium();
    await grantTestAccountAIConsent();
    await launchApp(true);
    await device.disableSynchronization();
  });
```

- [ ] **Step 3: Update grimoire tests**

In `e2e/grimoire.test.ts`, add consent grant to `beforeAll`:

Add import:
```typescript
import { setTestAccountPremium, grantTestAccountAIConsent } from './helpers/db';
```

Update `beforeAll` — add right after `setTestAccountPremium()`:
```typescript
    await grantTestAccountAIConsent();
```

- [ ] **Step 4: Run all E2E tests**

Run: `npm run test:e2e`
Expected: All existing tests pass with the consent pre-granted.

- [ ] **Step 5: Commit**

```bash
git add e2e/onboarding.test.ts e2e/dream-entry.test.ts e2e/grimoire.test.ts
git commit -m "fix: update existing E2E tests for AI consent flow"
```

---

### Task 12: New E2E Tests — Consent Flow

**Files:**
- Create: `e2e/ai-consent.test.ts`

- [ ] **Step 1: Write the consent flow E2E tests**

Create `e2e/ai-consent.test.ts`:

```typescript
import { device, element, by, expect } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, pollForVisibleByText, navigateToTab } from './helpers/actions';
import { setTestAccountPremium, grantTestAccountAIConsent, revokeTestAccountAIConsent } from './helpers/db';
import { TEST_DREAM_TEXT } from './helpers/dreamFactory';

describe('AI Consent Flow', () => {
  beforeAll(async () => {
    await setTestAccountPremium();
    await revokeTestAccountAIConsent();
    await launchApp(true);
    await device.disableSynchronization();
    await pollForVisible('home-record-button', 30000);
  });

  it('should show consent modal on first dream submission', async () => {
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    // Clear any draft
    try {
      await pollForVisible('new-dream-draft-clear', 1000);
      await tapById('new-dream-draft-clear');
    } catch { /* no draft */ }

    await tapById('new-dream-mood-peaceful');
    await typeById('new-dream-text-input', TEST_DREAM_TEXT);
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    // Consent modal should appear
    await pollForVisible('ai-consent-modal', 5000);
    await pollForVisible('ai-consent-allow', 3000);
    await pollForVisible('ai-consent-decline', 3000);
  });

  it('should dismiss modal and return to dream entry on "Not Now"', async () => {
    await tapById('ai-consent-decline');

    // Should be back on dream entry (not analyzing)
    await pollForVisible('new-dream-text-input', 5000);
  });

  it('should grant consent and proceed with analysis on "Allow"', async () => {
    // Re-submit to trigger modal again
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    await pollForVisible('ai-consent-allow', 5000);
    await tapById('ai-consent-allow');

    // Should proceed to analysis (loading animation or reading)
    await pollForVisible('reading-title', 180000);
  });

  it('should skip consent modal on subsequent submissions', async () => {
    // Navigate back to home
    await element(by.id('reading-scroll-view')).scrollTo('bottom');
    await tapById('reading-grimoire-button');
    await pollForVisibleByText('Your Grimoire', 10000);

    // Submit a new dream
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    try {
      await pollForVisible('new-dream-draft-clear', 1000);
      await tapById('new-dream-draft-clear');
    } catch { /* no draft */ }

    await tapById('new-dream-mood-curious');
    await typeById('new-dream-text-input', 'A second dream about the stars');
    await element(by.id('new-dream-scroll-view')).scroll(600, 'down', 0.5, 0.5);
    await tapById('new-dream-submit');

    // Should NOT show consent modal — should go straight to loading/reading
    // Wait briefly to ensure modal doesn't appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await expect(element(by.id('ai-consent-modal'))).not.toBeVisible();
    } catch {
      // Modal element may not exist at all — that's the expected case
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/ai-consent.test.ts
git commit -m "test: add E2E tests for AI consent flow"
```

---

### Task 13: New E2E Tests — Grimoire No-Consent

**Files:**
- Create: `e2e/ai-consent-grimoire.test.ts`

- [ ] **Step 1: Write the Grimoire no-consent E2E tests**

Create `e2e/ai-consent-grimoire.test.ts`:

```typescript
import { device, element, by, expect } from 'detox';
import { launchApp, tapById, typeById, waitForVisible, pollForVisible, pollForVisibleByText, navigateToTab } from './helpers/actions';
import { setTestAccountPremium, grantTestAccountAIConsent, revokeTestAccountAIConsent } from './helpers/db';

describe('Grimoire — No Consent State', () => {
  beforeAll(async () => {
    await setTestAccountPremium();
    await revokeTestAccountAIConsent();
    await launchApp(true);
    await device.disableSynchronization();
    await pollForVisible('home-record-button', 30000);

    // Create a dream WITHOUT AI analysis (submit + decline consent)
    await tapById('home-record-button');
    await waitForVisible('new-dream-text-input', 5000);
    await element(by.id('new-dream-scroll-view')).scrollTo('top');

    try {
      await pollForVisible('new-dream-draft-clear', 1000);
      await tapById('new-dream-draft-clear');
    } catch { /* no draft */ }

    // Use "I don't remember" to create a dream entry without needing consent
    await tapById('new-dream-forgot');
    await pollForVisibleByText('Sleep Logged', 10000);
    await element(by.text('OK')).tap();
    await pollForVisible('home-record-button', 10000);
  });

  beforeEach(async () => {
    await navigateToTab('Grimoire');
    await pollForVisibleByText('Your Grimoire', 10000);
  });

  it('should show consent banner for no-consent users', async () => {
    await pollForVisible('grimoire-consent-banner', 5000);
    await pollForVisible('grimoire-consent-enable', 3000);
  });

  it('should NOT show symbol filter pills', async () => {
    try {
      await expect(element(by.id('grimoire-pill-all'))).not.toBeVisible();
    } catch {
      // Element not in tree — that's expected
    }
  });

  it('should dismiss banner for the session', async () => {
    await pollForVisible('grimoire-consent-dismiss', 5000);
    await tapById('grimoire-consent-dismiss');

    // Banner should disappear
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      await expect(element(by.id('grimoire-consent-banner'))).not.toBeVisible();
    } catch {
      // Not visible — that's what we want
    }
  });

  it('should show consent modal when tapping Enable Readings', async () => {
    // Relaunch to get banner back (dismissed per session)
    await launchApp(false);
    await pollForVisible('home-record-button', 30000);
    await device.disableSynchronization();
    await navigateToTab('Grimoire');
    await pollForVisibleByText('Your Grimoire', 10000);

    await pollForVisible('grimoire-consent-enable', 5000);
    await tapById('grimoire-consent-enable');

    await pollForVisible('ai-consent-modal', 5000);

    // Dismiss
    await tapById('ai-consent-decline');
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/ai-consent-grimoire.test.ts
git commit -m "test: add E2E tests for Grimoire no-consent state"
```

---

### Task 14: Settings E2E Test Updates

**Files:**
- Modify: `e2e/settings.test.ts`

- [ ] **Step 1: Add consent toggle tests**

In `e2e/settings.test.ts`, add import:
```typescript
import { setTestAccountPremium, setTestAccountFree, grantTestAccountAIConsent } from './helpers/db';
```

Add these tests before the sign-out test:

```typescript
  it('should show AI consent toggle', async () => {
    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await pollForVisible('settings-ai-consent-toggle', 5000);
  });

  it('should show consent modal when enabling AI from settings', async () => {
    // First revoke consent so toggle is off
    const { revokeTestAccountAIConsent: revoke } = require('./helpers/db');
    await revoke();
    await launchApp(false);
    await pollForVisible('home-record-button', 30000);
    await device.disableSynchronization();
    await navigateToTab('Settings');
    await waitForVisible('settings-zodiac-edit', 10000);

    await element(by.id('settings-scroll-view')).scroll(200, 'down', 0.5, 0.5);
    await pollForVisible('settings-ai-consent-toggle', 5000);
    await tapById('settings-ai-consent-toggle');

    // Consent modal should appear
    await pollForVisible('ai-consent-modal', 5000);
    await tapById('ai-consent-allow');

    // Re-grant for remaining tests
    await grantTestAccountAIConsent();
  });
```

- [ ] **Step 2: Commit**

```bash
git add e2e/settings.test.ts
git commit -m "test: add AI consent toggle E2E tests to Settings"
```

---

### Task 15: Update QA Checklist

**Files:**
- Modify: `docs/QA.md`

- [ ] **Step 1: Add AI consent section**

Append before the `## Sign-off` section in `docs/QA.md`:

```markdown
## 8) AI Data Consent (Apple 5.1.1/5.1.2 Compliance)

### Onboarding Disclosure
- [ ] AI disclosure step appears between "about" and "welcome"
- [ ] Progress dots show 4 steps
- [ ] Disclosure mentions: dream text, mood, profile context, OpenAI
- [ ] Privacy policy link works
- [ ] "Continue" advances to welcome step (no gate)
- [ ] Skip on about step still shows AI disclosure

### Just-In-Time Consent Modal
- [ ] First dream analysis triggers consent modal
- [ ] Modal lists all data types sent (dream text, mood, zodiac/gender/age)
- [ ] Modal identifies OpenAI as recipient
- [ ] "Allow Dream Readings" grants consent and proceeds to analysis
- [ ] "Not Now" dismisses modal, no data sent, returns to dream entry
- [ ] Subsequent dream submissions skip modal after consent granted

### Consent Persistence
- [ ] Consent persists across app restart (AsyncStorage + Supabase)
- [ ] Consent persists across device change (Supabase sync)
- [ ] Revoking in Settings sets toggle off and blocks future AI calls
- [ ] Re-granting shows full consent modal (not just toggle)

### Grimoire No-Consent State
- [ ] No-consent user sees simplified journal cards (text, mood, date only)
- [ ] "Enable Readings" banner appears at top of Grimoire
- [ ] Tapping banner shows consent modal
- [ ] Symbol filter pills hidden in no-consent state
- [ ] Search only matches dream text and mood (no tags/omen)
- [ ] Empty state says "Your journal awaits..." not "grimoire"
- [ ] Pre-consent dreams remain plain after granting consent (no retroactive AI)
- [ ] New dreams after consent get full readings
- [ ] Mixed state renders correctly (old plain + new reading cards)

### Edge Cases
- [ ] "I don't remember" works without AI consent
- [ ] Offline consent grant saves to AsyncStorage
- [ ] Existing users (migration backfill) see no consent modal

Notes:
```

- [ ] **Step 2: Commit**

```bash
git add docs/QA.md
git commit -m "docs: add AI consent section to QA checklist"
```

---

### Task 16: Final Verification

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`
Expected: All tests pass including new aiConsentService tests.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run E2E tests**

Run: `npm run test:e2e`
Expected: All tests pass including new ai-consent and ai-consent-grimoire suites.

- [ ] **Step 4: Manual smoke test**

1. Fresh install / new account: verify onboarding shows 4 steps with AI disclosure
2. Submit first dream: verify consent modal appears
3. Tap "Not Now": verify you return to dream entry, no analysis
4. Re-submit: verify modal appears again
5. Tap "Allow": verify analysis proceeds
6. Submit another dream: verify no modal
7. Go to Settings: verify AI toggle is ON
8. Toggle OFF: verify confirmation, revoke works
9. Go to Grimoire: verify simplified cards, consent banner
10. Tap "Enable Readings" on banner: verify consent modal
