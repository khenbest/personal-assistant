-- Intent Classification System Tables
-- Creates all necessary tables for NLP intent classification and learning

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Intent predictions table for tracking all classifications
CREATE TABLE IF NOT EXISTS public.intent_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  model_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intent corrections table for learning from user feedback
CREATE TABLE IF NOT EXISTS public.intent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  corrected_intent TEXT,
  corrected_slots JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intent patterns table for discovered patterns
CREATE TABLE IF NOT EXISTS public.intent_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent TEXT NOT NULL,
  pattern TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  confidence FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- kNN index for similar text lookup (simplified without vector type for now)
CREATE TABLE IF NOT EXISTS public.intent_knn_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  intent TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON public.intent_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_timestamp ON public.intent_corrections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corrections_user ON public.intent_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_intent ON public.intent_patterns(intent);
CREATE INDEX IF NOT EXISTS idx_knn_intent ON public.intent_knn_index(intent);

-- Enable Row Level Security (RLS)
ALTER TABLE public.intent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_knn_index ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (for development)
-- In production, you'd want more restrictive policies

-- Predictions policies
CREATE POLICY "Allow anonymous insert on predictions" ON public.intent_predictions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous select on predictions" ON public.intent_predictions
  FOR SELECT TO anon USING (true);

-- Corrections policies
CREATE POLICY "Allow anonymous insert on corrections" ON public.intent_corrections
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous select on corrections" ON public.intent_corrections
  FOR SELECT TO anon USING (true);

-- Patterns policies
CREATE POLICY "Allow anonymous all on patterns" ON public.intent_patterns
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- kNN index policies
CREATE POLICY "Allow anonymous all on knn_index" ON public.intent_knn_index
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Add comment for documentation
COMMENT ON TABLE public.intent_predictions IS 'Stores all intent classification predictions for monitoring and analysis';
COMMENT ON TABLE public.intent_corrections IS 'Stores user corrections for continuous learning and improvement';
COMMENT ON TABLE public.intent_patterns IS 'Stores discovered patterns from corrections for pattern-based matching';
COMMENT ON TABLE public.intent_knn_index IS 'Stores text examples for k-nearest neighbor similarity matching';