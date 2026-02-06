/**
 * Seed Test Data Script
 *
 * Creates a demo user with 10 mixed dreams (dreams + nightmares)
 * including AI-generated readings for manual testing.
 *
 * Run with: npx ts-node scripts/seed-test-data.ts
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vjqvxraqeptgmbxnipqo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sfu54OCSyuVmdfM0YROStg_wtpG-RdQ';

const TEST_USER = {
  email: 'demo@dreamz.app',
  password: 'DreamzDemo123',
};

interface DreamSymbol {
  name: string;
  meaning: string;
  shadow: string;
  guidance: string;
}

interface DreamReading {
  title: string;
  tldr: string;
  symbols: DreamSymbol[];
  omen: string;
  ritual: string;
  journal_prompt: string;
  tags: string[];
  content_warnings: string[];
}

interface DreamEntry {
  dream_text: string;
  mood: string;
  dream_type: 'dream' | 'nightmare';
  reading: DreamReading;
}

// 10 diverse dreams with pre-generated readings
const DREAMS: DreamEntry[] = [
  // 1. Flying over mountains (dream)
  {
    dream_text: "I was soaring high above snow-capped mountains, the wind rushing past my face. Golden eagles flew beside me, and I felt completely free. The sun was setting, painting the sky in shades of pink and orange. I could see rivers winding through valleys below like silver ribbons.",
    mood: "Peaceful",
    dream_type: "dream",
    reading: {
      title: "Wings of the Mountain Spirit",
      tldr: "Your soul seeks liberation from earthly constraints; trust the currents lifting you higher.",
      symbols: [
        {
          name: "Flight",
          meaning: "Transcendence, freedom from limitations, spiritual elevation",
          shadow: "Escapism, avoidance of grounded responsibilities",
          guidance: "Notice where you feel most free in waking life and nurture those spaces"
        },
        {
          name: "Mountains",
          meaning: "Spiritual achievement, life goals, obstacles overcome",
          shadow: "Isolation, unreachable standards, cold ambition",
          guidance: "Celebrate the peaks you've already climbed"
        },
        {
          name: "Eagle",
          meaning: "Vision, power, divine messenger between worlds",
          shadow: "Pride, detachment from community",
          guidance: "Use your heightened perspective to serve, not just to observe"
        }
      ],
      omen: "A period of expansion is upon you. The eagles flying beside you suggest spiritual allies are near. This dream arrives to remind you that the freedom you seek is already within your grasp.",
      ritual: "Tomorrow at sunrise, step outside and take three deep breaths while facing the light. Whisper your intention for the day to the wind.",
      journal_prompt: "Where in your life are you ready to spread your wings?",
      tags: ["freedom", "transcendence", "nature", "spiritual-allies"],
      content_warnings: []
    }
  },

  // 2. Being chased (nightmare)
  {
    dream_text: "Something dark and shapeless was chasing me through endless corridors. No matter how fast I ran, I could hear it getting closer. The hallways twisted and turned, doors leading nowhere. My legs felt heavy like wading through honey. I woke up just before it caught me.",
    mood: "Anxious",
    dream_type: "nightmare",
    reading: {
      title: "The Shadow at Your Heels",
      tldr: "What you flee grows stronger; turn to face what seeks your attention.",
      symbols: [
        {
          name: "Chase",
          meaning: "Avoidance of a pressing issue, running from aspects of self",
          shadow: "Denial, exhaustion from constant flight",
          guidance: "Consider what you've been avoiding—it wants integration, not destruction"
        },
        {
          name: "Corridors",
          meaning: "Life transitions, choices, passages between states of being",
          shadow: "Feeling trapped, limited options, no escape",
          guidance: "Every corridor has an end; keep moving with intention"
        },
        {
          name: "Shapeless Pursuer",
          meaning: "Unacknowledged fear, repressed emotion, shadow self",
          shadow: "The unknown made monstrous by avoidance",
          guidance: "Name what you fear—naming reduces its power"
        }
      ],
      omen: "Your psyche is calling for a confrontation with something you've been avoiding. This is not a punishment but an invitation. The pursuer loses power the moment you stop running.",
      ritual: "Before bed tonight, write down one thing you've been avoiding. Fold the paper and place it under your pillow, asking your dreams for guidance.",
      journal_prompt: "If the shadow could speak, what would it say it needs from you?",
      tags: ["shadow-work", "avoidance", "fear", "integration"],
      content_warnings: []
    }
  },

  // 3. Underwater exploration (dream)
  {
    dream_text: "I discovered I could breathe underwater. I swam through crystal-clear ocean depths, past coral reefs glowing with bioluminescent colors. Schools of silver fish parted around me. I found an ancient temple on the ocean floor, its doors covered in symbols I somehow understood.",
    mood: "Curious",
    dream_type: "dream",
    reading: {
      title: "Temples in the Deep",
      tldr: "Your unconscious holds ancient wisdom; dive deeper into your emotional depths.",
      symbols: [
        {
          name: "Ocean",
          meaning: "The unconscious mind, emotional depths, collective memory",
          shadow: "Overwhelm, drowning in feelings, losing oneself",
          guidance: "Trust that you can navigate these waters—you've been given gills"
        },
        {
          name: "Breathing Underwater",
          meaning: "Adaptation, thriving in emotional realms, spiritual gifts",
          shadow: "Denial of human limitations, spiritual bypassing",
          guidance: "This gift is earned through emotional courage"
        },
        {
          name: "Ancient Temple",
          meaning: "Sacred knowledge, ancestral wisdom, spiritual inheritance",
          shadow: "Worship of the past, resistance to new understanding",
          guidance: "The symbols you understand are waking up within you"
        }
      ],
      omen: "You are being initiated into deeper mysteries. The fact that you could read the symbols suggests you're ready for teachings that have been waiting for you. Pay attention to synchronicities in the coming days.",
      ritual: "Fill a bowl with water and gaze into it by candlelight for five minutes. Let images arise without forcing meaning.",
      journal_prompt: "What ancient knowing lives in your bones that you've never spoken aloud?",
      tags: ["unconscious", "wisdom", "initiation", "ancestral"],
      content_warnings: []
    }
  },

  // 4. Teeth falling out (nightmare)
  {
    dream_text: "I was at an important meeting when I felt my teeth becoming loose. One by one, they started falling into my hands. I tried to hold them in but more kept coming out. Everyone was staring at me. I felt completely exposed and helpless.",
    mood: "Fearful",
    dream_type: "nightmare",
    reading: {
      title: "The Crumbling Mask",
      tldr: "Fears of losing face reveal deeper anxieties about power and self-image.",
      symbols: [
        {
          name: "Teeth",
          meaning: "Personal power, self-image, ability to 'bite' into life",
          shadow: "Vanity, aggression, fear of aging or weakness",
          guidance: "True power doesn't depend on appearances"
        },
        {
          name: "Falling/Loss",
          meaning: "Surrender, transformation, letting go of the old",
          shadow: "Loss of control, powerlessness, decay",
          guidance: "What falls away makes room for what's emerging"
        },
        {
          name: "Public Exposure",
          meaning: "Authenticity, vulnerability, fear of judgment",
          shadow: "Shame, performance anxiety, imposter feelings",
          guidance: "Those who matter don't mind; those who mind don't matter"
        }
      ],
      omen: "Something in your life is asking you to release your grip on how others perceive you. This dream often arrives during transitions when old identities are shedding. It's uncomfortable but necessary.",
      ritual: "Stand before a mirror and tell yourself three things you're proud of that have nothing to do with appearance or achievement.",
      journal_prompt: "What would remain if you lost everything you use to define yourself?",
      tags: ["identity", "vulnerability", "transformation", "fear"],
      content_warnings: []
    }
  },

  // 5. Reunion with loved one (dream)
  {
    dream_text: "My grandmother who passed away five years ago appeared in my kitchen. She was making her famous apple pie, the whole house smelled like cinnamon. She hugged me and said 'I'm always with you, mijita.' I woke up crying but feeling strangely at peace.",
    mood: "Joyful",
    dream_type: "dream",
    reading: {
      title: "Kitchen of the Ancestors",
      tldr: "The beloved dead return with gifts of comfort; receive their blessing.",
      symbols: [
        {
          name: "Grandmother",
          meaning: "Ancestral wisdom, unconditional love, feminine lineage",
          shadow: "Grief, loss, longing for the past",
          guidance: "She lives on in your hands, your recipes, your way of loving"
        },
        {
          name: "Kitchen",
          meaning: "Nourishment, transformation, heart of the home",
          shadow: "Domestic burden, old family patterns",
          guidance: "The kitchen is where love becomes tangible"
        },
        {
          name: "Apple Pie",
          meaning: "Comfort, tradition, sweetness of memory",
          shadow: "Nostalgia that prevents moving forward",
          guidance: "Make something with your hands to honor this connection"
        }
      ],
      omen: "This was a visitation dream, not merely a memory. Your grandmother chose this moment to remind you of her continued presence. The tears upon waking are a blessing—they mean the channel between worlds is open.",
      ritual: "Make or buy something sweet this week. Before eating, set aside a small portion as an offering to your grandmother. Speak her name aloud.",
      journal_prompt: "What wisdom did she embody that you're now called to carry forward?",
      tags: ["ancestors", "grief", "love", "visitation"],
      content_warnings: []
    }
  },

  // 6. Lost in a maze (dream)
  {
    dream_text: "I was wandering through a massive hedge maze under a purple twilight sky. Every path looked the same. I kept finding objects I'd lost years ago—my childhood watch, a letter I never sent, photographs I'd forgotten existed. I wasn't scared, just searching.",
    mood: "Confused",
    dream_type: "dream",
    reading: {
      title: "The Labyrinth of Lost Things",
      tldr: "The winding path returns you to yourself; what's lost is finding you.",
      symbols: [
        {
          name: "Maze",
          meaning: "Life's journey, the search for meaning, spiritual pilgrimage",
          shadow: "Confusion, going in circles, feeling trapped",
          guidance: "The maze isn't trying to lose you—it's leading you somewhere"
        },
        {
          name: "Lost Objects",
          meaning: "Forgotten aspects of self, memories seeking integration",
          shadow: "Living in the past, inability to let go",
          guidance: "These objects found you because you're ready to reclaim them"
        },
        {
          name: "Twilight",
          meaning: "Liminal time, threshold between states, magical thinking",
          shadow: "Uncertainty, neither here nor there",
          guidance: "Twilight is when the veil is thinnest—pay attention"
        }
      ],
      omen: "You are in a period of recovery and reclamation. Parts of yourself that were lost or forgotten are making their way back. Don't rush the process—the maze knows its own timing.",
      ritual: "Look through old boxes or photos this week. When something sparks a memory, hold it and breathe three times before moving on.",
      journal_prompt: "What part of your younger self are you ready to welcome home?",
      tags: ["journey", "memory", "reclamation", "liminal"],
      content_warnings: []
    }
  },

  // 7. Falling endlessly (nightmare)
  {
    dream_text: "I was falling through an endless void. No ground, no sky, just black emptiness rushing past. I tried to scream but no sound came out. The fall seemed to last forever. My stomach lurched with each moment of the descent.",
    mood: "Terrified",
    dream_type: "nightmare",
    reading: {
      title: "The Void Beneath",
      tldr: "Surrender to the fall—the ground you fear may be a new beginning.",
      symbols: [
        {
          name: "Falling",
          meaning: "Loss of control, surrender, descent into the unknown",
          shadow: "Failure, abandonment, loss of status",
          guidance: "Sometimes falling is just flying in a direction we didn't choose"
        },
        {
          name: "Void",
          meaning: "The unknown, potential, primordial space before creation",
          shadow: "Nihilism, depression, meaninglessness",
          guidance: "The void is full of possibility—it's only dark until you adjust"
        },
        {
          name: "Silence",
          meaning: "The voice within, words that cannot be spoken",
          shadow: "Powerlessness, being unheard, suppression",
          guidance: "Sometimes the soul speaks loudest in silence"
        }
      ],
      omen: "You may be experiencing or anticipating a significant loss of control in waking life. This dream comes not to frighten but to remind you: you have survived every fall so far. The landing will come.",
      ritual: "Lie on the floor in a dark room for five minutes. Feel the solid ground beneath you. Whisper: 'I am held.'",
      journal_prompt: "What would you do if you knew you couldn't fail?",
      tags: ["surrender", "fear", "control", "unknown"],
      content_warnings: []
    }
  },

  // 8. Walking through forest (dream)
  {
    dream_text: "I walked barefoot through an ancient forest where the trees seemed to whisper secrets. Sunlight filtered through the canopy in golden shafts. I came upon a clear spring and when I looked into it, I saw not my reflection but a wolf looking back at me with knowing eyes.",
    mood: "Serene",
    dream_type: "dream",
    reading: {
      title: "The Wolf in the Water",
      tldr: "Your wild self awaits recognition; the forest remembers who you were before.",
      symbols: [
        {
          name: "Forest",
          meaning: "The unconscious, natural wisdom, the wild self",
          shadow: "Getting lost, fear of one's own depth",
          guidance: "The forest is not against you—it's your original home"
        },
        {
          name: "Spring Water",
          meaning: "Source, clarity, emotional truth, renewal",
          shadow: "Depths that seem deceptively shallow",
          guidance: "Drink deeply from sources that nourish your soul"
        },
        {
          name: "Wolf",
          meaning: "Instinct, loyalty, the untamed self, spiritual guide",
          shadow: "Predatory nature, loneliness, fear of one's power",
          guidance: "The wolf is not separate from you—it IS you"
        }
      ],
      omen: "Your instinctual self is calling for integration. The wolf's knowing eyes suggest a part of you that has been waiting patiently to be acknowledged. This is an invitation to trust your animal wisdom.",
      ritual: "Spend time barefoot on earth this week. Let your feet remember what your mind has forgotten.",
      journal_prompt: "What do you know in your body that your mind tries to argue with?",
      tags: ["instinct", "wild-self", "nature", "integration"],
      content_warnings: []
    }
  },

  // 9. Can't find classroom (nightmare)
  {
    dream_text: "I was back in high school but I couldn't find my classroom. The hallways kept shifting. I realized I had a final exam but hadn't attended class all semester. I didn't even know what subject it was for. Everyone else seemed to know exactly where to go.",
    mood: "Uneasy",
    dream_type: "nightmare",
    reading: {
      title: "The Eternal Exam",
      tldr: "Life's tests aren't about the right answers—they're about showing up.",
      symbols: [
        {
          name: "School",
          meaning: "Life lessons, self-evaluation, growth through challenge",
          shadow: "Judgment, comparison, fear of failure",
          guidance: "You graduated from that school; you're not a student there anymore"
        },
        {
          name: "Exam",
          meaning: "Testing, evaluation, proving one's worth",
          shadow: "Imposter syndrome, performance anxiety, never feeling ready",
          guidance: "The exam you fear has already been passed in waking life"
        },
        {
          name: "Lost/Unprepared",
          meaning: "Feeling inadequate, fear of being exposed as incompetent",
          shadow: "Self-sabotage, avoidance of success",
          guidance: "Preparation is different from perfection"
        }
      ],
      omen: "This classic anxiety dream often surfaces when you're facing new challenges or transitions. It's not a prediction of failure—it's your psyche processing the stress of growth. You know more than you think.",
      ritual: "Write down three things you've accomplished that you once thought impossible. Read them aloud before bed.",
      journal_prompt: "In what area of life do you still feel like you're 'faking it'?",
      tags: ["anxiety", "imposter-syndrome", "growth", "validation"],
      content_warnings: []
    }
  },

  // 10. Childhood home (dream)
  {
    dream_text: "I returned to my childhood home but it was different—rooms I didn't remember, a garden that went on forever. In my old bedroom, I found a box of letters addressed to my future self, written in my own handwriting. The house felt alive, like it remembered me too.",
    mood: "Nostalgic",
    dream_type: "dream",
    reading: {
      title: "Letters from Yesterday",
      tldr: "Your past self sends messages to your future; the house of memory holds your medicine.",
      symbols: [
        {
          name: "Childhood Home",
          meaning: "Foundational self, origin story, psychological roots",
          shadow: "Stuck in the past, unhealed childhood wounds",
          guidance: "You can visit without having to stay"
        },
        {
          name: "Hidden Rooms",
          meaning: "Undiscovered aspects of self, potential not yet explored",
          shadow: "Secrets, denial, parts of self kept in shadow",
          guidance: "Each new room is an invitation to expand"
        },
        {
          name: "Letters to Self",
          meaning: "Inner wisdom, continuity of self, messages across time",
          shadow: "Regret, roads not taken, conversations with who you might have been",
          guidance: "You are the future self those letters were written for"
        }
      ],
      omen: "Your inner child is reaching out across time with messages you're now ready to receive. The infinite garden suggests unlimited potential still waiting to bloom. Return to this dream in meditation.",
      ritual: "Write a letter to your past self—the one who wrote you those dream letters. Tell them what they couldn't yet know.",
      journal_prompt: "What promises did you make to yourself as a child that you've kept? Which ones need revisiting?",
      tags: ["inner-child", "memory", "time", "wisdom"],
      content_warnings: []
    }
  }
];

async function createUser(): Promise<{ id: string; accessToken: string } | null> {
  console.log(`\nCreating test user: ${TEST_USER.email}`);

  // Try to sign in first (user might already exist)
  const signInResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });

  const signInData = await signInResponse.json();

  if (signInData.access_token) {
    console.log('User already exists, signed in successfully');
    return { id: signInData.user.id, accessToken: signInData.access_token };
  }

  // Create new user
  const signUpResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });

  const signUpData = await signUpResponse.json();

  if (signUpData.access_token) {
    console.log('Created new user successfully');
    return { id: signUpData.user.id, accessToken: signUpData.access_token };
  }

  console.error('Failed to create user:', signUpData);
  return null;
}

async function clearExistingDreams(userId: string, accessToken: string): Promise<void> {
  console.log('Clearing existing dreams for user...');

  // Hard delete existing dreams
  const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (response.ok) {
    console.log('Cleared existing dreams');
  }
}

async function insertDreams(userId: string, accessToken: string): Promise<void> {
  console.log(`\nInserting ${DREAMS.length} dreams...`);

  // Spread dreams over past 30 days for realistic history
  const now = new Date();

  for (let i = 0; i < DREAMS.length; i++) {
    const dream = DREAMS[i];
    const daysAgo = Math.floor((DREAMS.length - i) * 3); // Space them ~3 days apart
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/dreams`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        dream_text: dream.dream_text,
        mood: dream.mood,
        dream_type: dream.dream_type,
        reading: dream.reading,
        created_at: createdAt.toISOString(),
      }),
    });

    const data = await response.json();

    if (response.ok) {
      const icon = dream.dream_type === 'nightmare' ? '🌑' : '🌙';
      console.log(`  ${icon} ${i + 1}. "${dream.reading.title}" (${dream.dream_type})`);
    } else {
      console.error(`  ❌ Failed to insert dream ${i + 1}:`, data);
    }
  }
}

async function main() {
  console.log('═'.repeat(50));
  console.log('    DREAMZ TEST DATA SEEDER');
  console.log('═'.repeat(50));

  const user = await createUser();

  if (!user) {
    console.error('\n❌ Failed to create/sign in user. Exiting.');
    process.exit(1);
  }

  await clearExistingDreams(user.id, user.accessToken);
  await insertDreams(user.id, user.accessToken);

  console.log('\n' + '═'.repeat(50));
  console.log('    TEST DATA CREATED SUCCESSFULLY');
  console.log('═'.repeat(50));
  console.log('\n📱 Login credentials:');
  console.log(`   Email:    ${TEST_USER.email}`);
  console.log(`   Password: ${TEST_USER.password}`);
  console.log('\n🌙 Dreams created:');
  console.log(`   • ${DREAMS.filter(d => d.dream_type === 'dream').length} dreams`);
  console.log(`   • ${DREAMS.filter(d => d.dream_type === 'nightmare').length} nightmares`);
  console.log('   • All with AI readings\n');
}

main().catch(console.error);
