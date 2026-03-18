# Dreamz App Test Cases

This document contains comprehensive test cases for the Dreamz mobile dream journal app. Test cases are organized by feature area and include happy paths, edge cases, error cases, and security tests.

**Last Updated:** 2026-03-18

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Dream Creation](#2-dream-creation)
3. [Dream Analysis (AI Reading)](#3-dream-analysis-ai-reading)
4. [Draft Saving and Recovery](#4-draft-saving-and-recovery)
5. [Grimoire (Dream History)](#5-grimoire-dream-history)
6. [Settings and Profile](#6-settings-and-profile)
7. [Data Export](#7-data-export)
8. [Account Deletion](#8-account-deletion)
9. [Security and RLS](#9-security-and-rls)
10. [Offline and Network](#10-offline-and-network)

---

## Priority Definitions

- **P0**: Critical - App is unusable without this working
- **P1**: High - Core functionality, must work for MVP
- **P2**: Medium - Important feature, should work but has workarounds
- **P3**: Low - Nice to have, can be deferred

---

## 1. Authentication

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| AUTH-001 | Sign Up | User can create account with email/password | App installed, no existing account | 1. Launch app<br>2. Tap "Sign Up" toggle<br>3. Enter valid email<br>4. Enter password (8+ chars)<br>5. Tap "Create Account" | Account created, zodiac picker shown, confirmation email sent | P0 | Yes |
| AUTH-002 | Sign In | User can sign in with existing credentials | Account exists with email/password | 1. Launch app<br>2. Enter email<br>3. Enter password<br>4. Tap "Sign In" | User authenticated, navigates to Home screen | P0 | Yes |
| AUTH-003 | Sign Out | User can sign out from Settings | User is authenticated | 1. Navigate to Settings<br>2. Tap "Step Away from the Grimoire"<br>3. Confirm sign out | Session ended, returns to Auth screen | P0 | Yes |
| AUTH-004 | Session Persistence | Session persists across app restart | User is authenticated | 1. Close app completely<br>2. Reopen app | User remains authenticated, lands on Home screen | P0 | Yes |
| AUTH-005 | Apple Sign In | User can sign in with Apple | iOS device, Apple ID configured | 1. Tap "Sign in with Apple"<br>2. Complete Apple authentication | User authenticated, zodiac picker shown for new users | P1 | No |
| AUTH-006 | Google Sign In | User can sign in with Google | Google account available | 1. Tap "Continue with Google"<br>2. Complete Google OAuth flow | User authenticated, zodiac picker shown for new users | P1 | No |
| AUTH-007 | Toggle Auth Mode | User can switch between Sign In and Sign Up | On Auth screen | 1. Tap "Don't have an account? Sign Up"<br>2. Tap "Already have an account? Sign In" | UI toggles between modes, button text updates | P2 | Yes |
| AUTH-008 | Password Visibility Toggle | User can show/hide password | On Auth screen with password entered | 1. Enter password<br>2. Tap eye icon | Password visibility toggles | P3 | Yes |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| AUTH-E001 | Whitespace Email | Email with leading/trailing spaces is trimmed | On Auth screen | 1. Enter "  test@example.com  "<br>2. Enter valid password<br>3. Submit | Email trimmed, auth proceeds normally | P1 | Yes |
| AUTH-E002 | Whitespace Password | Password with leading/trailing spaces is trimmed | On Auth screen | 1. Enter email<br>2. Enter "  password123  "<br>3. Submit | Password trimmed, auth proceeds normally | P1 | Yes |
| AUTH-E003 | Skip Zodiac | New user can skip zodiac selection | Just completed sign up | 1. Complete sign up<br>2. Tap "Skip for now" on zodiac picker | Zodiac modal closes, no zodiac saved | P2 | Yes |
| AUTH-E004 | Long Email | Very long email address | On Auth screen | 1. Enter 254-character valid email<br>2. Enter password<br>3. Submit | Auth succeeds (email spec max is 254 chars) | P3 | Yes |
| AUTH-E005 | Unicode Email | Email with valid unicode characters | On Auth screen | 1. Enter email with unicode local part<br>2. Submit | Handled according to Supabase email validation | P3 | Yes |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| AUTH-ERR001 | Empty Email | Submit with empty email | On Auth screen | 1. Leave email empty<br>2. Enter password<br>3. Tap Sign In | Alert: "Please enter email and password" | P0 | Yes |
| AUTH-ERR002 | Empty Password | Submit with empty password | On Auth screen | 1. Enter email<br>2. Leave password empty<br>3. Tap Sign In | Alert: "Please enter email and password" | P0 | Yes |
| AUTH-ERR003 | Invalid Email Format | Submit with invalid email | On Auth screen | 1. Enter "notanemail"<br>2. Enter password<br>3. Submit | Alert with validation error from Supabase | P1 | Yes |
| AUTH-ERR004 | Wrong Password | Sign in with incorrect password | Account exists | 1. Enter correct email<br>2. Enter wrong password<br>3. Tap Sign In | Alert: "Invalid login credentials" | P0 | Yes |
| AUTH-ERR005 | Non-existent Account | Sign in with non-existent email | Email not registered | 1. Enter unregistered email<br>2. Enter any password<br>3. Tap Sign In | Alert: "Invalid login credentials" | P1 | Yes |
| AUTH-ERR006 | Weak Password Sign Up | Sign up with password < 6 chars | On Auth screen in Sign Up mode | 1. Enter email<br>2. Enter "12345"<br>3. Tap Create Account | Alert with password requirements error | P1 | Yes |
| AUTH-ERR007 | Duplicate Email | Sign up with existing email | Email already registered | 1. Enter existing email<br>2. Enter password<br>3. Tap Create Account | Alert: "User already registered" | P1 | Yes |
| AUTH-ERR008 | Network Error Auth | Auth attempt with no network | Device offline | 1. Disable network<br>2. Attempt sign in | Alert with network error message | P1 | Yes |

---

## 2. Dream Creation

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DREAM-001 | Create Dream | User can create a dream entry | Authenticated | 1. Tap "New Dream" on Home<br>2. Enter dream text (10+ chars)<br>3. Tap "Interpret Dream" | Dream saved, analysis begins | P0 | Yes |
| DREAM-002 | Dream with Mood | User can add mood to dream | On New Dream screen | 1. Enter dream text<br>2. Tap a mood chip (e.g., "Peaceful")<br>3. Submit | Dream saved with mood | P1 | Yes |
| DREAM-003 | Dream Type Selection | User can select dream type | On New Dream screen | 1. Tap "Nightmare" button<br>2. Enter dream text<br>3. Submit | Dream saved with type "nightmare" | P1 | Yes |
| DREAM-004 | Default Dream Type | Dream type defaults to "dream" | On New Dream screen | 1. Enter dream text<br>2. Submit without changing type | Dream saved with type "dream" | P2 | Yes |
| DREAM-005 | Deselect Mood | User can deselect a mood | Mood already selected | 1. Tap selected mood chip | Mood deselected, no mood will be saved | P2 | Yes |
| DREAM-006 | Long Dream Text | User can enter long dream text | On New Dream screen | 1. Enter 5000+ character dream<br>2. Submit | Dream saved successfully | P2 | Yes |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DREAM-E001 | Minimum Text | Dream with exactly 10 characters | On New Dream screen | 1. Enter "1234567890"<br>2. Submit | Dream saved, analysis proceeds | P1 | Yes |
| DREAM-E002 | Max Dream Text | Dream at 10000 character limit | On New Dream screen | 1. Enter 10000 character text<br>2. Submit | Dream saved, analysis proceeds | P2 | Yes |
| DREAM-E003 | Unicode Dream Text | Dream with emojis and special chars | On New Dream screen | 1. Enter dream with emojis<br>2. Submit | Dream saved with unicode intact | P2 | Yes |
| DREAM-E004 | Whitespace Only After Trim | Dream text that becomes empty after trim | On New Dream screen | 1. Enter "     "<br>2. Submit | Alert: "Please describe your dream" | P1 | Yes |
| DREAM-E005 | Newlines in Dream | Dream text with multiple paragraphs | On New Dream screen | 1. Enter multi-paragraph dream<br>2. Submit | Newlines preserved in saved dream | P2 | Yes |
| DREAM-E006 | Toggle Dream Type Multiple Times | Rapidly toggle between dream/nightmare | On New Dream screen | 1. Tap Dream<br>2. Tap Nightmare<br>3. Tap Dream<br>4. Submit | Final selection (dream) is saved | P3 | Yes |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DREAM-ERR001 | Empty Dream Text | Submit with empty dream | On New Dream screen | 1. Leave dream text empty<br>2. Tap "Interpret Dream" | Alert: "Please describe your dream" | P0 | Yes |
| DREAM-ERR002 | Dream Too Short | Submit with < 10 characters | On New Dream screen | 1. Enter "short"<br>2. Submit | Error from edge function: text too short | P1 | Yes |
| DREAM-ERR003 | Session Expired | Submit dream with expired session | Session expired | 1. Wait for session to expire<br>2. Submit dream | Error: "Not authenticated", redirect to auth | P1 | Yes |
| DREAM-ERR004 | Database Error | Database insert fails | Authenticated, DB unavailable | 1. Enter dream text<br>2. Submit | Error displayed, dream not saved | P1 | Yes |

---

## 3. Dream Analysis (AI Reading)

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| ANALYSIS-001 | Get Reading | Valid reading returned and displayed | Dream submitted | 1. Submit dream<br>2. Wait for loading | Reading screen shows title, tldr, symbols, omen, ritual, prompt, tags | P0 | Yes |
| ANALYSIS-002 | Reading Saved | Reading auto-saved to dream record | Dream submitted with ID | 1. Submit dream<br>2. Complete analysis<br>3. Check Grimoire | Dream in Grimoire has reading attached | P0 | Yes |
| ANALYSIS-003 | Zodiac Personalization | Reading includes zodiac context | User has zodiac set | 1. Set zodiac in settings<br>2. Submit new dream | Reading interpretation considers zodiac sign | P1 | Partial |
| ANALYSIS-004 | Loading States | Appropriate loading messages shown | Submitting dream | 1. Submit dream<br>2. Observe loading screen | Shows "Recording your dream..." then "Consulting the dream oracle..." | P2 | Yes |
| ANALYSIS-005 | All Reading Sections | All sections render | Reading returned | 1. View completed reading | Title, TL;DR, Plain English, Symbols (1-3), Omen, Ritual, Journal Prompt, Tags all visible | P0 | Yes |
| ANALYSIS-006 | Symbol Structure | Each symbol has required fields | Reading returned | 1. View reading<br>2. Check each symbol card | Each symbol shows: name, interpretation, meaning, shadow, guidance | P1 | Yes |
| ANALYSIS-007 | Share Reading | User can share reading | On Reading screen | 1. Tap "Share Reading"<br>2. Complete share action | Share sheet opens with reading content (no dream text) | P2 | No |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| ANALYSIS-E001 | Fallback Reading | Fallback used when AI fails | AI unavailable | 1. Submit dream when AI down | Fallback reading displayed with generic content | P1 | Yes |
| ANALYSIS-E002 | JSON in Markdown | AI returns JSON in code blocks | Edge function receives wrapped JSON | 1. Submit dream | JSON extracted from markdown, reading displayed | P2 | Yes |
| ANALYSIS-E003 | Partial JSON Response | AI response truncated | Response exceeds token limit | 1. Submit complex dream | Graceful error or fallback | P2 | Yes |
| ANALYSIS-E004 | Content Warnings | Reading with content warnings | Dream contains sensitive content | 1. Submit dream with violence/death themes | Content warnings array populated and displayed | P2 | Partial |
| ANALYSIS-E005 | Image Generation | Dream image generated | Reading successful | 1. Submit dream<br>2. View reading | Optional image_url displayed if generated | P2 | Yes |
| ANALYSIS-E006 | No Image Generated | Image generation fails gracefully | DALL-E unavailable | 1. Submit dream | Reading displayed without image, no error shown | P2 | Yes |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| ANALYSIS-ERR001 | Network Timeout | Analysis times out | Slow network | 1. Submit dream<br>2. Wait 30+ seconds | Error displayed, retry option offered | P1 | Yes |
| ANALYSIS-ERR002 | Invalid JSON Response | AI returns invalid JSON | AI misbehaves | 1. Submit dream | Retry attempted, then fallback used | P1 | Yes |
| ANALYSIS-ERR003 | Missing Fields | Reading missing required fields | AI omits fields | 1. Submit dream | Validation fails, retry or fallback | P1 | Yes |
| ANALYSIS-ERR004 | Retry Limit Exceeded | All retries fail | AI completely down | 1. Submit dream<br>2. All 2 retries fail | Fallback reading shown with fallback flag | P1 | Yes |
| ANALYSIS-ERR005 | Validation - Too Few Symbols | Reading has 0 symbols | AI returns empty array | 1. Submit dream | Validation fails, retry attempted | P2 | Yes |
| ANALYSIS-ERR006 | Validation - Too Many Tags | Reading has 6+ tags | AI returns excessive tags | 1. Submit dream | Validation fails (3-5 tags required) | P2 | Yes |
| ANALYSIS-ERR007 | Dream Saved but Analysis Fails | Save succeeds, analysis fails | Mixed success | 1. Submit dream<br>2. Analysis fails | Alert offers "Return Home" or "Try Again" | P1 | Yes |
| ANALYSIS-ERR008 | Retry Analysis | User retries failed analysis | Analysis failed, dream saved | 1. Tap "Try Again" on error | Analysis retried for existing dream | P1 | Yes |

---

## 4. Draft Saving and Recovery

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DRAFT-001 | Auto-Save Draft | Draft auto-saved while typing | On New Dream screen | 1. Enter dream text<br>2. Wait 1+ second | Draft saved to AsyncStorage | P1 | Yes |
| DRAFT-002 | Recover Draft | Draft recovered on screen open | Draft exists | 1. Close New Dream screen without submitting<br>2. Reopen New Dream screen | "Draft recovered" banner shows, text restored | P1 | Yes |
| DRAFT-003 | Clear Draft | User can clear recovered draft | Draft recovered | 1. Open New Dream with draft<br>2. Tap "Clear" on banner | Draft cleared, form reset | P2 | Yes |
| DRAFT-004 | Draft Includes Mood | Mood saved and restored | Draft with mood | 1. Enter text, select mood<br>2. Close and reopen | Both text and mood restored | P2 | Yes |
| DRAFT-005 | Draft Includes Type | Dream type saved and restored | Draft with nightmare type | 1. Select nightmare, enter text<br>2. Close and reopen | Dream type restored as nightmare | P2 | Yes |
| DRAFT-006 | Draft Cleared on Submit | Draft cleared after successful submit | Draft exists | 1. Recover draft<br>2. Submit dream successfully | Draft cleared, subsequent opens show empty form | P1 | Yes |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DRAFT-E001 | Draft Expiration | Draft older than 7 days cleared | Old draft exists | 1. Create draft<br>2. Wait 7+ days<br>3. Open New Dream | No draft recovered, starts fresh | P2 | Partial |
| DRAFT-E002 | Empty Draft Not Saved | Whitespace-only not saved as draft | On New Dream screen | 1. Enter only spaces<br>2. Leave screen | No draft saved | P3 | Yes |
| DRAFT-E003 | Rapid Typing Debounce | Draft saves after typing stops | Typing quickly | 1. Type continuously for 3 seconds<br>2. Stop typing | Draft saves 1 second after typing stops | P3 | Yes |
| DRAFT-E004 | AsyncStorage Full | Storage write fails gracefully | Storage nearly full | 1. Fill device storage<br>2. Try to save draft | Fails silently, no error shown to user | P3 | No |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DRAFT-ERR001 | Corrupted Draft | Draft JSON corrupted | Malformed data in storage | 1. Corrupt AsyncStorage manually<br>2. Open New Dream | Returns null, starts with empty form | P2 | Yes |
| DRAFT-ERR002 | Storage Read Failure | AsyncStorage read fails | Storage error | 1. Open New Dream screen | Silently fails, shows empty form | P3 | No |

---

## 5. Grimoire (Dream History)

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| GRIM-001 | View Dreams | All user dreams displayed | Has saved dreams | 1. Navigate to Grimoire tab | List of dreams shown, newest first | P0 | Yes |
| GRIM-002 | Dream Card Content | Card shows correct info | Dreams with readings | 1. View Grimoire list | Each card shows: type icon, title, date, dream text preview | P1 | Yes |
| GRIM-003 | Open Reading | Tap dream to view reading | Dream has reading | 1. Tap dream card | Reading screen opens with full reading | P0 | Yes |
| GRIM-004 | Pull to Refresh | User can refresh dream list | On Grimoire screen | 1. Pull down on list | List refreshes, shows updated data | P2 | Yes |
| GRIM-005 | Search Dreams | User can search dreams | Has multiple dreams | 1. Enter search term<br>2. View filtered results | Dreams filtered by text, title, tags, omen | P1 | Yes |
| GRIM-006 | Clear Search | User can clear search | Search active | 1. Tap "Clear" button | Search cleared, all dreams shown | P2 | Yes |
| GRIM-007 | Delete Dream | User can delete a dream | Has saved dreams | 1. Tap X button on dream card<br>2. Confirm deletion | Dream soft-deleted, removed from list | P1 | Yes |
| GRIM-008 | Delete via Long Press | User can delete via long press | Has saved dreams | 1. Long press dream card<br>2. Confirm deletion | Same as delete button | P2 | Yes |
| GRIM-009 | Nightmare Styling | Nightmare dreams styled differently | Has nightmare dream | 1. View Grimoire with nightmare | Nightmare card has different colors/icon | P2 | Yes |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| GRIM-E001 | Empty Grimoire | No dreams to display | New user, no dreams | 1. Navigate to Grimoire | Empty state: "Your grimoire awaits..." with CTA | P1 | Yes |
| GRIM-E002 | No Search Results | Search returns no matches | Search term has no matches | 1. Search for nonsense term | Empty state: "No dreams match your search" | P2 | Yes |
| GRIM-E003 | Dream Without Reading | Card for unanalyzed dream | Dream saved but analysis failed | 1. View Grimoire | Card shows "No reading yet", tap disabled | P2 | Yes |
| GRIM-E004 | Many Dreams | Large dream list performance | 100+ dreams | 1. Scroll through list | FlatList renders smoothly, no lag | P2 | Partial |
| GRIM-E005 | Search Special Characters | Search with regex-like chars | On Grimoire | 1. Search for "[test]"<br>2. Search for "dream.*" | Search handles literally, no regex errors | P3 | Yes |
| GRIM-E006 | Deleted Dream Not Shown | Soft-deleted dreams hidden | Dream was soft-deleted | 1. View Grimoire | Deleted dreams don't appear (is_deleted filter) | P1 | Yes |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| GRIM-ERR001 | Load Failed | Dreams fail to load | Database error | 1. Navigate to Grimoire | Error handled gracefully, empty list or error state | P1 | Yes |
| GRIM-ERR002 | Delete Failed | Delete operation fails | Database error | 1. Try to delete dream | Alert: "Failed to delete dream. Please try again." | P1 | Yes |
| GRIM-ERR003 | Unauthenticated | User not authenticated | Session expired | 1. Navigate to Grimoire | Empty list, no crash | P1 | Yes |

---

## 6. Settings and Profile

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| SETTINGS-001 | View Email | User email displayed | Authenticated | 1. Navigate to Settings | Email address shown in Account section | P1 | Yes |
| SETTINGS-002 | View Zodiac | Current zodiac shown | Zodiac set | 1. Navigate to Settings | Zodiac sign displayed, or "Not set" | P1 | Yes |
| SETTINGS-003 | Change Zodiac | User can change zodiac sign | On Settings | 1. Tap zodiac row<br>2. Select new sign | Zodiac picker opens, selection saved | P1 | Yes |
| SETTINGS-004 | All 12 Signs Available | All zodiac signs listed | Zodiac picker open | 1. Open zodiac picker<br>2. Scroll through list | All 12 signs visible and selectable | P2 | Yes |
| SETTINGS-005 | Cancel Zodiac Change | User can cancel without changing | Zodiac picker open | 1. Open picker<br>2. Tap "Cancel" | Picker closes, no change saved | P2 | Yes |
| SETTINGS-006 | Zodiac Persists | Zodiac sign persists after restart | Zodiac changed | 1. Change zodiac<br>2. Close and reopen app | Same zodiac sign displayed | P1 | Yes |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| SETTINGS-E001 | No Zodiac Set | Display when zodiac not set | New user, no zodiac | 1. View Settings | Shows "Not set" for zodiac | P2 | Yes |
| SETTINGS-E002 | Change Zodiac Multiple Times | Repeatedly change zodiac | On Settings | 1. Change zodiac 5 times | Only final selection persisted | P3 | Yes |
| SETTINGS-E003 | Selected Sign Highlighted | Current sign highlighted in picker | Has zodiac set | 1. Open zodiac picker | Current sign has selected styling | P3 | Yes |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| SETTINGS-ERR001 | Zodiac Update Fails | Database update fails | Network error | 1. Try to change zodiac | Fails silently, picker closes, old value remains | P2 | Yes |
| SETTINGS-ERR002 | Profile Load Fails | Can't load profile | Database error | 1. Navigate to Settings | Email shows "Loading...", zodiac shows nothing | P2 | Yes |

---

## 7. Data Export

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| EXPORT-001 | Export Dreams | User can export all dreams | Has saved dreams | 1. Navigate to Settings<br>2. Tap "Gather Your Dreams"<br>3. Complete share action | JSON export with all dreams shared | P1 | Partial |
| EXPORT-002 | Export Format | Export contains correct structure | Has dreams with readings | 1. Export dreams<br>2. Inspect JSON | Contains: exported_at, app, total_dreams, dreams array | P1 | Yes |
| EXPORT-003 | Dream Export Fields | Each dream has correct fields | Has dreams | 1. Export dreams | Each dream has: entry_number, date, dream_text, mood, emotions, type, reading | P1 | Yes |
| EXPORT-004 | Reading Export Fields | Reading mapped correctly | Dreams have readings | 1. Export dreams | Reading has: title, summary, symbols, omen, ritual, reflection, themes | P1 | Yes |
| EXPORT-005 | Privacy Safe | No internal IDs in export | Has dreams | 1. Export dreams<br>2. Check JSON | No user_id, dream id, or internal identifiers | P1 | Yes |
| EXPORT-006 | Deleted Not Exported | Soft-deleted dreams excluded | Has deleted dreams | 1. Delete a dream<br>2. Export | Deleted dream not in export | P1 | Yes |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| EXPORT-E001 | Empty Export | Export with no dreams | New user | 1. Export dreams | JSON with total_dreams: 0, empty dreams array | P2 | Yes |
| EXPORT-E002 | Dreams Without Readings | Export includes unanalyzed dreams | Dream has no reading | 1. Export dreams | Dream included with reading: null | P2 | Yes |
| EXPORT-E003 | Large Export | Export 100+ dreams | Many dreams | 1. Export dreams | Export completes, JSON valid | P2 | Partial |
| EXPORT-E004 | Date Formatting | Dates formatted nicely | Has dreams | 1. Export<br>2. Check date field | Date like "February 4, 2026", not ISO string | P3 | Yes |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| EXPORT-ERR001 | Export Fails | Database query fails | Network error | 1. Tap export | Alert: "Export Error" with message | P1 | Yes |
| EXPORT-ERR002 | Not Authenticated | Session expired | Invalid session | 1. Tap export | Alert: "Not authenticated" | P1 | Yes |
| EXPORT-ERR003 | Share Cancelled | User cancels share sheet | Share sheet open | 1. Export<br>2. Cancel share | No error, returns to Settings | P3 | No |

---

## 8. Account Deletion

### Happy Paths

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DELETE-001 | Delete Account Flow | Complete account deletion | Authenticated with data | 1. Tap "Close the Grimoire Forever"<br>2. Confirm first dialog<br>3. Confirm second dialog | Account deleted, signed out, farewell message shown | P1 | Partial |
| DELETE-002 | Two-Step Confirmation | Requires double confirmation | On Settings | 1. Tap delete<br>2. Confirm first | Second confirmation dialog appears | P1 | Yes |
| DELETE-003 | All Data Deleted | Dreams, profile, auth user removed | Account deleted | 1. Delete account<br>2. Try to sign in with same credentials | Sign in fails, account doesn't exist | P0 | Yes |

### Edge Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DELETE-E001 | Cancel First Dialog | User cancels at first confirmation | On Settings | 1. Tap delete<br>2. Tap "Cancel" | Dialog closes, no deletion | P1 | Yes |
| DELETE-E002 | Cancel Second Dialog | User cancels at final confirmation | First confirmed | 1. Tap delete<br>2. Confirm first<br>3. Tap "Cancel" | Dialog closes, no deletion | P1 | Yes |
| DELETE-E003 | Delete Empty Account | Delete account with no dreams | New account | 1. Delete account | Account deleted successfully | P2 | Yes |

### Error Cases

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| DELETE-ERR001 | Deletion Fails | Edge function returns error | Server error | 1. Attempt delete | Alert: "Deletion Error" with message | P1 | Yes |
| DELETE-ERR002 | Network Error | No network during delete | Offline | 1. Attempt delete | Alert with network error | P1 | Yes |
| DELETE-ERR003 | Session Invalid | Session expired during delete | Expired session | 1. Attempt delete | Alert: "Not authenticated" | P1 | Yes |

---

## 9. Security and RLS

### Row Level Security Tests

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| SEC-RLS001 | Own Dreams Only | User can only read own dreams | User A and B with dreams | 1. Query dreams as User A | Only User A's dreams returned | P0 | Yes |
| SEC-RLS002 | Own Profile Only | User can only read own profile | User A and B exist | 1. Query profiles as User A | Only User A's profile returned | P0 | Yes |
| SEC-RLS003 | Insert Own Dream | Can only insert dreams for self | Authenticated as User A | 1. Insert dream with user_id = A | Insert succeeds | P0 | Yes |
| SEC-RLS004 | Cannot Insert Other's Dream | Cannot insert dream for other user | User A authenticated | 1. Try insert with user_id = B | Insert fails (RLS violation) | P0 | Yes |
| SEC-RLS005 | Update Own Dream | Can update own dreams | User A with dream | 1. Update own dream | Update succeeds | P0 | Yes |
| SEC-RLS006 | Cannot Update Other's Dream | Cannot update other's dream | User A authenticated, User B dream exists | 1. Try to update User B's dream | Update fails or affects 0 rows | P0 | Yes |
| SEC-RLS007 | Deleted Dreams Hidden | is_deleted dreams not returned | Dream soft-deleted | 1. Query dreams | Deleted dreams excluded by RLS | P0 | Yes |
| SEC-RLS008 | Symbols Public Read | Any authenticated user can read symbols | Authenticated | 1. Query symbols table | Symbols returned | P1 | Yes |
| SEC-RLS009 | Cannot Write Symbols | Regular user cannot insert symbols | Authenticated as regular user | 1. Try to insert symbol | Insert fails (no write policy) | P1 | Yes |

### Authentication Security

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| SEC-AUTH001 | Edge Function Auth Required | Edge function rejects unauthenticated | No auth header | 1. Call analyze-dream without auth | 401 Unauthorized | P0 | Yes |
| SEC-AUTH002 | Invalid Token Rejected | Edge function rejects bad token | Invalid JWT | 1. Call with fake Bearer token | 401 Unauthorized | P0 | Yes |
| SEC-AUTH003 | Expired Token Rejected | Edge function rejects expired token | Expired JWT | 1. Call with expired token | 401 Unauthorized | P0 | Yes |

### Data Privacy

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| SEC-PRIV001 | Share Excludes Dream Text | Share reading never includes dream text | On Reading screen | 1. Share reading<br>2. Inspect shared content | Only reading content, no dream_text | P0 | Partial |
| SEC-PRIV002 | Export Excludes Internal IDs | Export has no internal identifiers | Export generated | 1. Export dreams<br>2. Search for user_id, dream id | No internal IDs present | P0 | Yes |
| SEC-PRIV003 | No Sensitive Logs | Dream text not in console logs | N/A | 1. Review Edge Function code | Dream content never logged | P0 | Manual |

---

## 10. Offline and Network

### Offline Behavior

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| OFFLINE-001 | Draft Saves Offline | Draft saving works offline | Device offline | 1. Go offline<br>2. Enter dream text | Draft saved to AsyncStorage | P1 | Partial |
| OFFLINE-002 | Graceful Network Error | Network errors handled gracefully | Device offline | 1. Go offline<br>2. Try to submit dream | Error shown, no crash | P1 | Partial |
| OFFLINE-003 | View Cached Data | Previously loaded data viewable | Data cached | 1. Load Grimoire<br>2. Go offline<br>3. Navigate away and back | Cached dreams still visible (if implemented) | P2 | Partial |

### Network Error Handling

| ID | Category | Description | Preconditions | Steps | Expected Result | Priority | Automatable |
|----|----------|-------------|---------------|-------|-----------------|----------|-------------|
| NET-001 | Timeout Handling | Long requests timeout gracefully | Slow network | 1. Submit dream on slow connection | Timeout after 30s, error shown | P1 | Yes |
| NET-002 | Retry on Failure | Analysis retries on transient failure | First attempt fails | 1. Submit dream<br>2. First OpenAI call fails | Automatic retry with exponential backoff | P1 | Yes |
| NET-003 | Connection Restored | App recovers when connection restored | Was offline | 1. Go offline<br>2. Go online<br>3. Submit dream | Dream submits successfully | P2 | Partial |

---

## Test Data Requirements

### User Accounts
- **Test User A**: test-user-a@dreamz.test / TestPassword123!
- **Test User B**: test-user-b@dreamz.test / TestPassword123!
- **Premium User**: premium@dreamz.test / TestPassword123!

### Dream Fixtures
```json
{
  "minimal_dream": {
    "dream_text": "I was walking through a forest",
    "mood": null,
    "dream_type": "dream"
  },
  "full_dream": {
    "dream_text": "I was walking through a mysterious forest when I encountered a glowing door. Behind it, I could hear whispers calling my name...",
    "mood": "Anxious",
    "dream_type": "dream"
  },
  "nightmare": {
    "dream_text": "Something was chasing me through dark corridors. I couldn't see what it was but I knew I had to run...",
    "mood": "Fearful",
    "dream_type": "nightmare"
  },
  "long_dream": {
    "dream_text": "[5000+ character dream text]",
    "mood": "Confused",
    "dream_type": "dream"
  }
}
```

### Mock Reading Fixture
```json
{
  "title": "The Wandering Moon",
  "tldr": "A journey of self-discovery awaits in the depths of your dreaming mind.",
  "symbols": [
    {
      "name": "Forest",
      "meaning": "The unconscious mind, unexplored territory",
      "shadow": "Fear of the unknown, feeling lost",
      "guidance": "Trust the path even when you cannot see ahead"
    }
  ],
  "omen": "Change approaches on quiet feet. What seems lost may simply be transforming.",
  "ritual": "Light a white candle at dusk and write one fear you're ready to release.",
  "journal_prompt": "What door have you been afraid to open?",
  "tags": ["transformation", "journey", "mystery"],
  "content_warnings": []
}
```

---

## Automation Notes

### E2E Test Framework Recommendations
- **Detox** for React Native E2E testing
- **Jest** for unit and integration tests
- Direct Supabase API calls for backend/RLS testing

### Tests Requiring Manual Verification
- Apple Sign In (AUTH-005)
- Google Sign In (AUTH-006)
- Share functionality (ANALYSIS-007, SEC-PRIV001)
- Device storage full scenarios (DRAFT-E004)
- Network condition manipulation (OFFLINE-*)

### Environment Requirements
- Supabase project with test data
- Test user accounts created
- OpenAI API key configured for Edge Functions
- iOS Simulator and/or Android Emulator

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-04 | 1.0.0 | Initial comprehensive test cases document |
| 2026-03-18 | 1.1.0 | Updated symbol count (1-3), tag count (3-5), added interpretation field to symbols |
