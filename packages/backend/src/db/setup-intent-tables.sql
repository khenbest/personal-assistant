-- Intent predictions table for tracking all classifications
CREATE TABLE IF NOT EXISTS intent_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  model_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intent corrections table for learning from user feedback
CREATE TABLE IF NOT EXISTS intent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  corrected_intent TEXT,
  corrected_slots JSONB,
  embedding VECTOR(384),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intent patterns table for discovered patterns
CREATE TABLE IF NOT EXISTS intent_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent TEXT NOT NULL,
  pattern TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  confidence FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- kNN index for similar text lookup
CREATE TABLE IF NOT EXISTS intent_knn_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  intent TEXT NOT NULL,
  embedding VECTOR(384),
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON intent_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_timestamp ON intent_corrections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_user ON intent_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_intent ON intent_patterns(intent);
CREATE INDEX IF NOT EXISTS idx_knn_intent ON intent_knn_index(intent);

-- Enable Row Level Security (RLS)
ALTER TABLE intent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE intent_knn_index ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (for development)
CREATE POLICY "Allow anonymous insert on predictions" ON intent_predictions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous select on predictions" ON intent_predictions
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert on corrections" ON intent_corrections
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous select on corrections" ON intent_corrections
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous all on patterns" ON intent_patterns
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous all on knn_index" ON intent_knn_index
  FOR ALL TO anon USING (true) WITH CHECK (true);