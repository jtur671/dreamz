-- Create symbols table and seed with common dream symbols
-- These provide consistency in AI interpretations

-- Create symbols table if it doesn't exist
CREATE TABLE IF NOT EXISTS symbols (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  meaning text NOT NULL,
  shadow_meaning text,
  guidance text,
  category text,
  related_symbols text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and allow public read
ALTER TABLE symbols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read symbols" ON symbols;
CREATE POLICY "Anyone can read symbols"
  ON symbols FOR SELECT
  USING (TRUE);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_category ON symbols(category);

INSERT INTO symbols (name, meaning, shadow_meaning, guidance, category, related_symbols) VALUES
-- Nature symbols
('Water', 'Emotion, the unconscious mind, purification, and the flow of life', 'Feeling overwhelmed, drowning in emotions, fear of the depths within', 'Notice where emotions are flowing freely and where they feel dammed up', 'nature', ARRAY['ocean', 'river', 'rain', 'flood']),

('Ocean', 'The vast unconscious, collective emotions, infinite possibility, the unknown', 'Fear of depths, feeling lost in immensity, existential overwhelm', 'What vast feelings are you avoiding? The ocean holds treasures for those who dive', 'nature', ARRAY['water', 'waves', 'beach', 'drowning']),

('Fire', 'Passion, transformation, destruction that creates space for new growth, anger, desire', 'Destructive rage, burnout, consuming obsession, loss of control', 'What needs to burn away? What passion needs tending?', 'nature', ARRAY['smoke', 'ash', 'candle', 'sun']),

('Forest', 'The unconscious mind, getting lost in thought, natural wisdom, the wild self', 'Confusion, fear of the unknown, feeling lost without direction', 'Sometimes we must lose the path to find our own way', 'nature', ARRAY['trees', 'path', 'darkness', 'animals']),

('Moon', 'Intuition, cycles, the feminine, dreams within dreams, hidden knowledge', 'Illusion, deception, fear of the dark, lunacy', 'Trust what you sense but cannot yet see clearly', 'celestial', ARRAY['night', 'stars', 'darkness', 'tides']),

('Sun', 'Consciousness, vitality, clarity, success, the masculine, life force', 'Harsh exposure, burnout, ego inflation, blinding truth', 'What is being illuminated? What thrives in your light?', 'celestial', ARRAY['light', 'day', 'warmth', 'gold']),

-- Action symbols
('Flying', 'Freedom, transcendence, rising above problems, spiritual elevation, ambition', 'Escapism, fear of falling, disconnection from reality, hubris', 'What are you rising above? Remember to return to earth', 'action', ARRAY['falling', 'birds', 'sky', 'wings']),

('Falling', 'Loss of control, anxiety, letting go, surrender, failure fears', 'Feeling unsupported, fear of failure, loss of status or security', 'Sometimes falling is the only way to learn we can land', 'action', ARRAY['flying', 'cliff', 'ground', 'catching']),

('Chase', 'Avoidance, anxiety, something demanding attention, unresolved conflict', 'Running from yourself, exhaustion from avoidance, paranoia', 'Turn and face what pursues you—it often shrinks when seen', 'action', ARRAY['running', 'hiding', 'escape', 'predator']),

('Swimming', 'Navigating emotions, being immersed in feeling, going with the flow', 'Struggling to stay afloat, emotional exhaustion, drowning', 'Are you swimming with the current or against it?', 'action', ARRAY['water', 'ocean', 'drowning', 'floating']),

-- Body symbols
('Teeth', 'Confidence, self-image, communication, aggression, vitality', 'Insecurity about appearance, fear of aging, loss of power, words that bite', 'What do you need to say? What are you afraid to bite into?', 'body', ARRAY['mouth', 'smile', 'biting', 'falling']),

('Naked', 'Vulnerability, authenticity, exposure, truth, shame or freedom', 'Fear of judgment, feeling unprepared, exposed secrets', 'Where do you hide? What would freedom from masks feel like?', 'body', ARRAY['clothes', 'exposure', 'shame', 'freedom']),

('Hair', 'Identity, vitality, sexuality, thoughts, personal power', 'Loss of strength, vanity, overthinking, loss of identity', 'Hair carries our history—what story is yours telling?', 'body', ARRAY['cutting', 'growing', 'baldness', 'styling']),

-- Object symbols
('Door', 'Opportunity, transition, secrets, new beginnings, choices', 'Self-imposed barriers, fear of the unknown, locked potential', 'Every door is both an entrance and an exit. Which way are you facing?', 'object', ARRAY['key', 'lock', 'opening', 'threshold']),

('Mirror', 'Self-reflection, truth, identity, how others see you, vanity', 'Distorted self-image, fear of seeing truth, narcissism', 'The mirror shows what is, not what we wish to see', 'object', ARRAY['reflection', 'glass', 'face', 'double']),

('Car', 'Life direction, control over your path, ambition, status', 'Loss of control, wrong direction, accidents waiting to happen', 'Who is driving your life? Where are you headed?', 'object', ARRAY['driving', 'road', 'crash', 'passenger']),

('Bridge', 'Transition, connection, crossing over, commitment to change', 'Fear of commitment, burning bridges, unstable foundations', 'Bridges require trust—you cannot see the other side until you cross', 'object', ARRAY['crossing', 'water', 'gap', 'connection']),

('Stairs', 'Progress, levels of consciousness, ambition, spiritual ascent', 'Struggle, setbacks, fear of heights or depths, endless climbing', 'Each step is its own arrival. Are you ascending or descending?', 'object', ARRAY['climbing', 'falling', 'levels', 'elevator']),

('Key', 'Solution, access, secrets, power, unlocking potential', 'Lost opportunities, secrets better left locked, misuse of power', 'You already hold the key—where have you not thought to look?', 'object', ARRAY['door', 'lock', 'opening', 'treasure']),

-- Place symbols
('House', 'The self, psyche, different aspects of identity, security', 'Neglected parts of self, invasion of boundaries, instability', 'Which rooms do you avoid? They hold what needs attention', 'place', ARRAY['rooms', 'home', 'building', 'shelter']),

('School', 'Learning, testing, past experiences, feeling judged or evaluated', 'Fear of failure, unfinished lessons, feeling unprepared', 'Life''s classroom never closes. What lesson keeps repeating?', 'place', ARRAY['test', 'teacher', 'classroom', 'student']),

-- Person/Being symbols
('Baby', 'New beginnings, vulnerability, potential, innocence, responsibility', 'Neglected potential, fear of responsibility, vulnerability', 'What new thing in your life needs nurturing?', 'person', ARRAY['child', 'birth', 'pregnancy', 'innocence']),

('Death', 'Endings, transformation, rebirth, major life transitions', 'Fear of change, grief, ego death, resistance to transformation', 'What must end so something new can begin?', 'theme', ARRAY['ending', 'transformation', 'rebirth', 'loss']),

('Snake', 'Transformation, hidden knowledge, healing, primal energy, sexuality', 'Betrayal, fear, toxic influences, repressed desires', 'The snake sheds what no longer fits. What skin are you outgrowing?', 'animal', ARRAY['shedding', 'venom', 'coiling', 'garden']),

('Dog', 'Loyalty, friendship, protection, instincts, unconditional love', 'Aggression, feeling attacked, betrayal by trusted ones', 'Dogs mirror our emotional state. What is yours reflecting?', 'animal', ARRAY['pet', 'wolf', 'barking', 'protection']),

('Cat', 'Independence, intuition, mystery, feminine energy, sensuality', 'Aloofness, bad luck fears, hidden enemies, selfishness', 'Cats know the value of rest and boundaries. Do you?', 'animal', ARRAY['pet', 'hunting', 'night', 'independence']),

('Bird', 'Freedom, perspective, messages, the soul, aspirations', 'Flightiness, escape, feeling caged, unrealistic dreams', 'What message arrives on wings? What view do you need?', 'animal', ARRAY['flying', 'wings', 'nest', 'sky']),

-- Theme symbols
('Wedding', 'Union, commitment, integration of aspects of self, new partnership', 'Fear of commitment, forced unions, loss of independence', 'What parts of yourself are ready to unite?', 'theme', ARRAY['marriage', 'ring', 'ceremony', 'partner']),

('Exam', 'Self-evaluation, fear of judgment, life tests, performance anxiety', 'Imposter syndrome, fear of exposure, unpreparedness', 'You have studied longer than you know. Trust your preparation', 'theme', ARRAY['school', 'test', 'failure', 'preparation'])

ON CONFLICT (name) DO UPDATE SET
  meaning = EXCLUDED.meaning,
  shadow_meaning = EXCLUDED.shadow_meaning,
  guidance = EXCLUDED.guidance,
  category = EXCLUDED.category,
  related_symbols = EXCLUDED.related_symbols;
