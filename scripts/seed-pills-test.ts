/**
 * Seed script: creates ~25 dreams for <redacted-email> with overlapping symbols
 * to generate 15-20 recurring symbol pills on the Grimoire screen.
 *
 * Usage: npx tsx scripts/seed-pills-test.ts
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vjqvxraqeptgmbxnipqo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sfu54OCSyuVmdfM0YROStg_wtpG-RdQ';
const EMAIL = '<redacted-email>';
const PASSWORD = '***REMOVED***';

// 20 symbol keywords — each will appear in 3-5 dreams
const SYMBOLS = [
  'water', 'moon', 'snake', 'mirror', 'fire',
  'forest', 'bridge', 'crow', 'tower', 'key',
  'wolf', 'storm', 'clock', 'door', 'rose',
  'spider', 'whale', 'cave', 'sword', 'feather',
];

function makeSymbol(name: string) {
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    meaning: `The ${name} reflects hidden truths`,
    shadow: `Unexamined ${name} energy`,
    guidance: `Sit with the ${name} in stillness`,
  };
}

function makeReading(symbols: string[], index: number) {
  return {
    title: `Dream Vision ${index + 1}`,
    tldr: `A dream featuring ${symbols.join(', ')}`,
    plain_english: `You encountered ${symbols.join(' and ')} in your dreamscape.`,
    symbols: symbols.map(makeSymbol),
    omen: 'A shift approaches',
    ritual: 'Light a candle and reflect',
    journal_prompt: 'What did the symbols mean to you?',
    tags: symbols,
    content_warnings: [],
  };
}

// Each dream gets 2-4 symbols, distributed so every symbol appears 3-5 times
const DREAM_CONFIGS: string[][] = [
  ['water', 'moon', 'snake'],
  ['mirror', 'fire', 'forest'],
  ['bridge', 'crow', 'tower'],
  ['key', 'wolf', 'storm'],
  ['clock', 'door', 'rose'],
  ['spider', 'whale', 'cave'],
  ['sword', 'feather', 'water'],
  ['moon', 'snake', 'mirror'],
  ['fire', 'forest', 'bridge'],
  ['crow', 'tower', 'key'],
  ['wolf', 'storm', 'clock'],
  ['door', 'rose', 'spider'],
  ['whale', 'cave', 'sword'],
  ['feather', 'water', 'moon'],
  ['snake', 'mirror', 'fire'],
  ['forest', 'bridge', 'crow'],
  ['tower', 'key', 'wolf'],
  ['storm', 'clock', 'door'],
  ['rose', 'spider', 'whale'],
  ['cave', 'sword', 'feather'],
  ['water', 'fire', 'wolf', 'rose'],
  ['moon', 'bridge', 'storm', 'whale'],
  ['snake', 'crow', 'clock', 'cave'],
  ['mirror', 'tower', 'door', 'sword'],
  ['forest', 'key', 'spider', 'feather'],
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (signInError) {
    console.error('Sign-in failed:', signInError.message);
    process.exit(1);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('No user after sign-in');
    process.exit(1);
  }
  console.log(`Signed in as ${EMAIL} (${user.id})`);

  // Build dream rows spread across the last 25 days
  const dreams = DREAM_CONFIGS.map((symbols, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return {
      user_id: user.id,
      dream_text: `I dreamed of ${symbols.join(', ')}. The vision was vivid and strange, swirling with symbols that felt deeply personal. Dream entry number ${i + 1}.`,
      mood: ['mystified', 'anxious', 'peaceful', 'excited', 'curious'][i % 5],
      dream_type: i % 7 === 0 ? 'nightmare' : 'dream',
      reading: makeReading(symbols, i),
      created_at: date.toISOString(),
    };
  });

  // Insert
  const { data, error } = await supabase
    .from('dreams')
    .insert(dreams)
    .select('id');

  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }

  console.log(`Inserted ${data.length} dreams`);

  // Verify symbol distribution
  const counts = new Map<string, number>();
  for (const config of DREAM_CONFIGS) {
    for (const s of config) {
      counts.set(s, (counts.get(s) || 0) + 1);
    }
  }
  console.log('\nSymbol counts (all should be >= 3):');
  for (const [name, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }
  console.log(`\nTotal distinct symbols: ${counts.size}`);
  console.log(`Symbols with 3+: ${[...counts.values()].filter(c => c >= 3).length} → these become pills`);

  await supabase.auth.signOut();
}

main();
