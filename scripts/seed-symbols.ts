/**
 * Dream Symbol Seed Data
 *
 * Curated collection of common dream symbols with meanings,
 * shadow interpretations, and guidance.
 *
 * Usage: npx tsx scripts/seed-symbols.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface DreamSymbol {
  name: string;
  meaning: string;
  shadow: string;
  guidance: string;
  category: string;
  keywords: string[];
  related_symbols: string[];
  source: 'curated';
}

const SYMBOLS: DreamSymbol[] = [
  // NATURE
  {
    name: "Water",
    meaning: "Emotions, the unconscious mind, purification, and the flow of life. Water's state reflects emotional states - calm water suggests peace, turbulent water indicates emotional turmoil.",
    shadow: "Overwhelming emotions, fear of drowning in feelings, emotional repression",
    guidance: "What emotions are you currently navigating? Are you going with the flow or fighting against the current?",
    category: "Nature",
    keywords: ["emotion", "feelings", "unconscious", "flow", "cleansing"],
    related_symbols: ["Ocean", "River", "Rain", "Flood"],
    source: 'curated'
  },
  {
    name: "Ocean",
    meaning: "The vast unconscious, collective emotions, the unknown depths of the psyche. Represents both infinite possibility and the mysteries we haven't explored.",
    shadow: "Fear of the unknown, feeling lost in overwhelming emotions, isolation",
    guidance: "What undiscovered territories of your inner life are calling to be explored?",
    category: "Nature",
    keywords: ["depth", "vastness", "unconscious", "mystery", "emotion"],
    related_symbols: ["Water", "Waves", "Beach", "Fish"],
    source: 'curated'
  },
  {
    name: "Fire",
    meaning: "Transformation, passion, destruction and renewal, anger, enlightenment. Fire consumes the old to make way for the new.",
    shadow: "Destructive anger, burnout, consuming passions that harm",
    guidance: "What in your life needs to be transformed? What passion needs healthy expression?",
    category: "Nature",
    keywords: ["transformation", "passion", "anger", "destruction", "renewal"],
    related_symbols: ["Sun", "Candle", "Smoke", "Ash"],
    source: 'curated'
  },
  {
    name: "Forest",
    meaning: "The unconscious mind, getting lost in thought, discovery, the unknown path. Forests represent the wild, untamed aspects of the psyche.",
    shadow: "Feeling lost, fear of the unknown, being unable to see the way forward",
    guidance: "What undiscovered parts of yourself are waiting to be found in the wilderness of your mind?",
    category: "Nature",
    keywords: ["unconscious", "lost", "discovery", "nature", "wild"],
    related_symbols: ["Trees", "Path", "Animals", "Darkness"],
    source: 'curated'
  },
  {
    name: "Mountain",
    meaning: "Obstacles, achievements, spiritual ascent, higher perspective. Mountains represent challenges that lead to growth and expanded views.",
    shadow: "Insurmountable challenges, isolation at the top, exhaustion from climbing",
    guidance: "What summit are you working toward? Is the climb worth the view?",
    category: "Nature",
    keywords: ["challenge", "achievement", "perspective", "obstacle", "height"],
    related_symbols: ["Climbing", "Peak", "Valley", "Snow"],
    source: 'curated'
  },
  {
    name: "Sun",
    meaning: "Consciousness, vitality, clarity, masculine energy, success. The sun illuminates truth and brings warmth to cold situations.",
    shadow: "Harsh scrutiny, overexposure, ego inflation, burnout",
    guidance: "What needs to be brought into the light? Where do you need more warmth and vitality?",
    category: "Nature",
    keywords: ["consciousness", "clarity", "energy", "success", "light"],
    related_symbols: ["Light", "Day", "Fire", "Gold"],
    source: 'curated'
  },
  {
    name: "Moon",
    meaning: "Intuition, the feminine, cycles, the unconscious, dreams within dreams. The moon reflects hidden emotions and inner knowing.",
    shadow: "Illusion, deception, lunacy, being ruled by emotions",
    guidance: "What does your intuition whisper when you quiet your mind? What cycle are you in?",
    category: "Nature",
    keywords: ["intuition", "feminine", "cycles", "unconscious", "reflection"],
    related_symbols: ["Night", "Stars", "Tides", "Silver"],
    source: 'curated'
  },
  {
    name: "Rain",
    meaning: "Cleansing, renewal, sadness, fertility, release of emotions. Rain washes away the old and nourishes new growth.",
    shadow: "Depression, feeling drowned by circumstances, gloom that won't lift",
    guidance: "What needs to be washed away? What seeds are being nourished by this difficult season?",
    category: "Nature",
    keywords: ["cleansing", "tears", "renewal", "sadness", "growth"],
    related_symbols: ["Water", "Storm", "Clouds", "Umbrella"],
    source: 'curated'
  },
  {
    name: "Storm",
    meaning: "Emotional upheaval, conflict, powerful change, clearing the air. Storms represent the release of built-up tension.",
    shadow: "Destructive emotions, chaos, feeling out of control",
    guidance: "What tension has been building that needs release? How can you find shelter while the storm passes?",
    category: "Nature",
    keywords: ["conflict", "change", "chaos", "release", "power"],
    related_symbols: ["Lightning", "Thunder", "Rain", "Wind"],
    source: 'curated'
  },
  {
    name: "River",
    meaning: "The flow of life, time passing, journey, emotional currents. Rivers carry us forward whether we resist or surrender.",
    shadow: "Being swept away, unable to change direction, stagnation when blocked",
    guidance: "Are you flowing with life or fighting against its current?",
    category: "Nature",
    keywords: ["flow", "journey", "time", "movement", "current"],
    related_symbols: ["Water", "Bridge", "Boat", "Fish"],
    source: 'curated'
  },

  // ANIMALS
  {
    name: "Snake",
    meaning: "Transformation, healing, hidden fears, wisdom, kundalini energy. Snakes shed their skin, representing renewal and change.",
    shadow: "Betrayal, hidden threats, toxic situations or people, sexual fears",
    guidance: "What old skin are you ready to shed? What healing transformation awaits?",
    category: "Animals",
    keywords: ["transformation", "healing", "fear", "wisdom", "renewal"],
    related_symbols: ["Venom", "Shedding", "Garden", "Reptile"],
    source: 'curated'
  },
  {
    name: "Dog",
    meaning: "Loyalty, friendship, protection, unconditional love, instincts. Dogs represent our faithful companions and our own loyal nature.",
    shadow: "Aggression, feeling attacked, loyalty to the wrong things, domestication",
    guidance: "Who or what deserves your loyalty? Are you being true to yourself?",
    category: "Animals",
    keywords: ["loyalty", "friendship", "protection", "instinct", "companion"],
    related_symbols: ["Wolf", "Pet", "Pack", "Guard"],
    source: 'curated'
  },
  {
    name: "Cat",
    meaning: "Independence, intuition, feminine power, mystery, sensuality. Cats move between worlds and see in the dark.",
    shadow: "Aloofness, selfishness, bad luck superstitions, hidden aggression",
    guidance: "Where do you need more independence? What does your intuition tell you?",
    category: "Animals",
    keywords: ["independence", "intuition", "mystery", "feminine", "grace"],
    related_symbols: ["Tiger", "Lion", "Night", "Eyes"],
    source: 'curated'
  },
  {
    name: "Bird",
    meaning: "Freedom, perspective, the soul, messages, transcendence. Birds rise above earthly concerns and see the bigger picture.",
    shadow: "Flightiness, being scattered, inability to stay grounded",
    guidance: "What higher perspective do you need? What message is trying to reach you?",
    category: "Animals",
    keywords: ["freedom", "flight", "soul", "message", "perspective"],
    related_symbols: ["Wings", "Feathers", "Sky", "Nest"],
    source: 'curated'
  },
  {
    name: "Horse",
    meaning: "Power, freedom, nobility, passion, drive. Horses represent the vital force that carries us forward in life.",
    shadow: "Unbridled passions, loss of control, being ridden by others' demands",
    guidance: "What is driving you forward? Are you in control of your own power?",
    category: "Animals",
    keywords: ["power", "freedom", "drive", "nobility", "energy"],
    related_symbols: ["Rider", "Saddle", "Running", "Wild"],
    source: 'curated'
  },
  {
    name: "Spider",
    meaning: "Creativity, patience, fate, the web of life, feminine power. Spiders weave intricate webs connecting all things.",
    shadow: "Feeling trapped, manipulation, fear of the feminine, being caught",
    guidance: "What are you weaving in your life? Are you the spider or caught in someone's web?",
    category: "Animals",
    keywords: ["creativity", "patience", "fate", "web", "weaving"],
    related_symbols: ["Web", "Insect", "Trap", "Thread"],
    source: 'curated'
  },
  {
    name: "Wolf",
    meaning: "Instincts, intelligence, freedom, social connections, the wild self. Wolves balance independence with pack loyalty.",
    shadow: "Predatory behavior, isolation from the pack, being hunted",
    guidance: "How do you balance your wild nature with your social bonds?",
    category: "Animals",
    keywords: ["instinct", "wild", "pack", "hunter", "loyalty"],
    related_symbols: ["Dog", "Moon", "Forest", "Howl"],
    source: 'curated'
  },
  {
    name: "Fish",
    meaning: "The unconscious, fertility, Christianity, abundance, emotions swimming beneath the surface.",
    shadow: "Slippery situations, cold emotions, being out of your element",
    guidance: "What swims beneath the surface of your awareness?",
    category: "Animals",
    keywords: ["unconscious", "fertility", "abundance", "depth", "swimming"],
    related_symbols: ["Water", "Ocean", "Fishing", "Scale"],
    source: 'curated'
  },
  {
    name: "Bear",
    meaning: "Strength, introspection, the mother, hibernation and renewal, standing your ground.",
    shadow: "Aggression, overbearing behavior, withdrawing too much",
    guidance: "What requires your strength? Is it time to retreat and restore?",
    category: "Animals",
    keywords: ["strength", "mother", "hibernation", "power", "protection"],
    related_symbols: ["Cave", "Forest", "Cubs", "Honey"],
    source: 'curated'
  },

  // PLACES
  {
    name: "House",
    meaning: "The self, the psyche, different rooms represent different aspects of personality. Your inner home and sense of self.",
    shadow: "Neglected parts of self, hidden rooms, structural instability in identity",
    guidance: "Which rooms of your inner house need attention? What have you been avoiding?",
    category: "Places",
    keywords: ["self", "psyche", "home", "rooms", "shelter"],
    related_symbols: ["Room", "Door", "Attic", "Basement"],
    source: 'curated'
  },
  {
    name: "School",
    meaning: "Learning life lessons, feeling tested, personal growth, past experiences that shaped you.",
    shadow: "Anxiety about performance, feeling judged, unfinished business from the past",
    guidance: "What lesson is life teaching you now? What old patterns need to be unlearned?",
    category: "Places",
    keywords: ["learning", "lesson", "test", "growth", "past"],
    related_symbols: ["Teacher", "Test", "Classroom", "Books"],
    source: 'curated'
  },
  {
    name: "Hospital",
    meaning: "Healing, need for care, health concerns, emotional wounds being tended.",
    shadow: "Fear of illness, feeling broken, being unable to heal yourself",
    guidance: "What part of you needs healing? Are you allowing yourself to receive care?",
    category: "Places",
    keywords: ["healing", "health", "care", "wound", "recovery"],
    related_symbols: ["Doctor", "Medicine", "Bed", "Surgery"],
    source: 'curated'
  },
  {
    name: "Church",
    meaning: "Spirituality, seeking meaning, moral questions, community, the sacred within.",
    shadow: "Guilt, judgment, rigid beliefs, spiritual bypassing",
    guidance: "What do you hold sacred? How do you connect with something greater than yourself?",
    category: "Places",
    keywords: ["spirituality", "sacred", "religion", "meaning", "community"],
    related_symbols: ["Prayer", "Altar", "Priest", "Ceremony"],
    source: 'curated'
  },
  {
    name: "Road",
    meaning: "Life path, journey, direction in life, choices about which way to go.",
    shadow: "Being lost, dead ends, dangerous paths, going in circles",
    guidance: "What path are you on? Is it time to choose a new direction?",
    category: "Places",
    keywords: ["path", "journey", "direction", "choice", "travel"],
    related_symbols: ["Car", "Walking", "Crossroads", "Map"],
    source: 'curated'
  },

  // OBJECTS
  {
    name: "Door",
    meaning: "Opportunity, transition, new beginnings, access to hidden parts of self.",
    shadow: "Closed opportunities, secrets, fear of what lies beyond",
    guidance: "What doors are opening or closing in your life? Which ones are you afraid to open?",
    category: "Objects",
    keywords: ["opportunity", "transition", "opening", "threshold", "choice"],
    related_symbols: ["Key", "House", "Lock", "Entrance"],
    source: 'curated'
  },
  {
    name: "Key",
    meaning: "Solutions, access, secrets revealed, power to unlock, knowledge.",
    shadow: "Locked out, missing piece, secrets that should stay hidden",
    guidance: "What do you hold the key to? What remains locked away?",
    category: "Objects",
    keywords: ["solution", "access", "secret", "unlock", "power"],
    related_symbols: ["Door", "Lock", "Treasure", "Mystery"],
    source: 'curated'
  },
  {
    name: "Mirror",
    meaning: "Self-reflection, truth, vanity, seeing yourself clearly, the soul.",
    shadow: "Distorted self-image, being unable to face yourself, illusions",
    guidance: "What do you see when you truly look at yourself? What are you avoiding?",
    category: "Objects",
    keywords: ["reflection", "truth", "self", "image", "identity"],
    related_symbols: ["Face", "Glass", "Double", "Vanity"],
    source: 'curated'
  },
  {
    name: "Car",
    meaning: "Control over life direction, how you move through the world, personal drive and ambition.",
    shadow: "Loss of control, accidents, being driven by someone else",
    guidance: "Are you in the driver's seat of your life? Where are you heading?",
    category: "Objects",
    keywords: ["control", "direction", "drive", "journey", "movement"],
    related_symbols: ["Road", "Driver", "Crash", "Speed"],
    source: 'curated'
  },
  {
    name: "Phone",
    meaning: "Communication, connection, messages trying to reach you, intuition calling.",
    shadow: "Missed connections, inability to communicate, being unreachable",
    guidance: "Who or what is trying to reach you? What message are you not receiving?",
    category: "Objects",
    keywords: ["communication", "connection", "message", "call", "contact"],
    related_symbols: ["Voice", "Number", "Ring", "Text"],
    source: 'curated'
  },
  {
    name: "Money",
    meaning: "Self-worth, power, resources, energy exchange, values.",
    shadow: "Greed, poverty consciousness, measuring worth by wealth",
    guidance: "What do you truly value? How do you measure your own worth?",
    category: "Objects",
    keywords: ["worth", "value", "power", "resources", "exchange"],
    related_symbols: ["Gold", "Wallet", "Bank", "Coins"],
    source: 'curated'
  },
  {
    name: "Book",
    meaning: "Knowledge, life story, wisdom, learning, the record of your experiences.",
    shadow: "Living by the book, closed chapters you can't access, information overload",
    guidance: "What chapter of your life are you writing now? What wisdom do you seek?",
    category: "Objects",
    keywords: ["knowledge", "story", "wisdom", "learning", "chapter"],
    related_symbols: ["Library", "Pages", "Writing", "Reading"],
    source: 'curated'
  },
  {
    name: "Clothes",
    meaning: "Identity, how you present yourself, roles you play, persona.",
    shadow: "False identity, being exposed, wearing masks",
    guidance: "Who are you when no one is watching? Are you wearing the right clothes for this chapter?",
    category: "Objects",
    keywords: ["identity", "persona", "appearance", "role", "covering"],
    related_symbols: ["Naked", "Dress", "Shoes", "Uniform"],
    source: 'curated'
  },

  // ACTIONS/STATES
  {
    name: "Flying",
    meaning: "Freedom, transcendence, rising above problems, spiritual elevation, ambition achieved.",
    shadow: "Escaping reality, fear of falling, being untethered from ground",
    guidance: "What do you need to rise above? Are you flying toward something or away from something?",
    category: "Actions",
    keywords: ["freedom", "transcendence", "elevation", "escape", "soaring"],
    related_symbols: ["Bird", "Wings", "Sky", "Falling"],
    source: 'curated'
  },
  {
    name: "Falling",
    meaning: "Loss of control, anxiety, letting go, failure fears, surrender.",
    shadow: "Feeling unsupported, actual danger, inability to trust",
    guidance: "What are you afraid of losing? Can you trust the fall?",
    category: "Actions",
    keywords: ["control", "anxiety", "surrender", "fear", "release"],
    related_symbols: ["Flying", "Cliff", "Depth", "Ground"],
    source: 'curated'
  },
  {
    name: "Being Chased",
    meaning: "Avoidance, running from problems, anxiety, something requiring attention.",
    shadow: "Paranoia, actual threats, exhaustion from running",
    guidance: "What are you running from? What would happen if you turned to face it?",
    category: "Actions",
    keywords: ["avoidance", "fear", "pursuit", "escape", "anxiety"],
    related_symbols: ["Running", "Monster", "Shadow", "Escape"],
    source: 'curated'
  },
  {
    name: "Teeth Falling Out",
    meaning: "Anxiety about appearance, communication issues, loss of power, transition.",
    shadow: "Aging fears, loss of control, inability to express yourself",
    guidance: "What are you afraid to say? What power do you feel you're losing?",
    category: "Actions",
    keywords: ["anxiety", "appearance", "communication", "power", "loss"],
    related_symbols: ["Mouth", "Speaking", "Eating", "Smile"],
    source: 'curated'
  },
  {
    name: "Being Naked",
    meaning: "Vulnerability, authenticity, fear of exposure, nothing to hide, freedom from pretense.",
    shadow: "Shame, feeling judged, inappropriate exposure",
    guidance: "Where in your life do you feel exposed? Can you embrace your vulnerability?",
    category: "Actions",
    keywords: ["vulnerability", "exposure", "shame", "authenticity", "truth"],
    related_symbols: ["Clothes", "Public", "Body", "Hiding"],
    source: 'curated'
  },
  {
    name: "Death",
    meaning: "Endings, transformation, major life changes, letting go of the old self.",
    shadow: "Fear of change, grief, resistance to necessary endings",
    guidance: "What part of your life or self is ready to die so something new can be born?",
    category: "Actions",
    keywords: ["ending", "transformation", "change", "rebirth", "letting go"],
    related_symbols: ["Funeral", "Grave", "Ghost", "Rebirth"],
    source: 'curated'
  },
  {
    name: "Pregnancy",
    meaning: "New beginnings, creativity, projects gestating, potential, nurturing something new.",
    shadow: "Unwanted responsibilities, fear of what you're creating, long wait",
    guidance: "What are you birthing into the world? What needs more time to develop?",
    category: "Actions",
    keywords: ["creation", "potential", "development", "nurturing", "birth"],
    related_symbols: ["Baby", "Birth", "Mother", "Growth"],
    source: 'curated'
  },
  {
    name: "Baby",
    meaning: "New beginnings, innocence, vulnerability, your inner child, fresh starts.",
    shadow: "Helplessness, neediness, neglected parts of self",
    guidance: "What new beginning needs your nurturing? How is your inner child?",
    category: "Actions",
    keywords: ["innocence", "new", "vulnerable", "potential", "nurture"],
    related_symbols: ["Pregnancy", "Child", "Mother", "Birth"],
    source: 'curated'
  },

  // PEOPLE
  {
    name: "Mother",
    meaning: "Nurturing, the feminine, unconditional love, origin, protection, the Great Mother archetype.",
    shadow: "Smothering, abandonment issues, the devouring mother",
    guidance: "How do you nurture yourself and others? What is your relationship with the feminine?",
    category: "People",
    keywords: ["nurturing", "feminine", "love", "origin", "protection"],
    related_symbols: ["Baby", "Home", "Earth", "Womb"],
    source: 'curated'
  },
  {
    name: "Father",
    meaning: "Authority, protection, the masculine, structure, guidance, the Great Father archetype.",
    shadow: "Tyranny, absent father, judgment, rigid control",
    guidance: "What is your relationship with authority and structure? How do you express the masculine?",
    category: "People",
    keywords: ["authority", "masculine", "protection", "guidance", "structure"],
    related_symbols: ["King", "Boss", "Sky", "Law"],
    source: 'curated'
  },
  {
    name: "Child",
    meaning: "Innocence, playfulness, your younger self, new beginnings, spontaneity.",
    shadow: "Immaturity, neglected inner child, childish behavior",
    guidance: "What does your inner child need? Where do you need more play?",
    category: "People",
    keywords: ["innocence", "play", "youth", "spontaneous", "wonder"],
    related_symbols: ["Baby", "Toy", "School", "Game"],
    source: 'curated'
  },
  {
    name: "Stranger",
    meaning: "Unknown aspects of self, the shadow, new possibilities, the unfamiliar.",
    shadow: "Fear of the unknown, projection, danger from outside",
    guidance: "What unknown part of yourself is this stranger representing?",
    category: "People",
    keywords: ["unknown", "shadow", "mystery", "other", "unfamiliar"],
    related_symbols: ["Shadow", "Face", "Crowd", "Meeting"],
    source: 'curated'
  },
  {
    name: "Shadow Figure",
    meaning: "The rejected self, repressed qualities, what you deny, the Jungian shadow.",
    shadow: "Integration needed, dangerous denial, confrontation with self",
    guidance: "What qualities have you rejected that this shadow embodies?",
    category: "People",
    keywords: ["shadow", "repressed", "denied", "dark", "unconscious"],
    related_symbols: ["Dark", "Stranger", "Monster", "Chase"],
    source: 'curated'
  },
];

async function main() {
  console.log(`Preparing ${SYMBOLS.length} curated dream symbols...\n`);

  // Write to JSON file
  const jsonPath = path.join(__dirname, 'curated-symbols.json');
  fs.writeFileSync(jsonPath, JSON.stringify(SYMBOLS, null, 2));
  console.log(`Saved JSON to: ${jsonPath}`);

  // Generate SQL migration
  const sqlPath = path.join(__dirname, 'import-curated-symbols.sql');
  let sql = `-- Curated Dream Symbol Library
-- Generated: ${new Date().toISOString()}
-- Total symbols: ${SYMBOLS.length}

-- First, clear existing curated symbols
DELETE FROM symbols WHERE source = 'curated';

-- Insert curated symbols
INSERT INTO symbols (name, meaning, shadow, guidance, category, keywords, related_symbols, source) VALUES\n`;

  const values = SYMBOLS.map(s => {
    const escape = (str: string) => str.replace(/'/g, "''");
    const keywords = `ARRAY[${s.keywords.map(k => `'${escape(k)}'`).join(', ')}]`;
    const related = `ARRAY[${s.related_symbols.map(r => `'${escape(r)}'`).join(', ')}]`;
    return `  ('${escape(s.name)}', '${escape(s.meaning)}', '${escape(s.shadow)}', '${escape(s.guidance)}', '${escape(s.category)}', ${keywords}, ${related}, '${s.source}')`;
  });

  sql += values.join(',\n');
  sql += '\nON CONFLICT (name) DO UPDATE SET\n';
  sql += '  meaning = EXCLUDED.meaning,\n';
  sql += '  shadow = EXCLUDED.shadow,\n';
  sql += '  guidance = EXCLUDED.guidance,\n';
  sql += '  category = EXCLUDED.category,\n';
  sql += '  keywords = EXCLUDED.keywords,\n';
  sql += '  related_symbols = EXCLUDED.related_symbols,\n';
  sql += '  source = EXCLUDED.source;\n';

  fs.writeFileSync(sqlPath, sql);
  console.log(`Saved SQL to: ${sqlPath}`);
  console.log(`\nTo import, run this in Supabase SQL Editor or via migration.`);
}

main().catch(console.error);
