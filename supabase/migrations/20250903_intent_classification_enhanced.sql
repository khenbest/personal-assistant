-- Intent Classification Tables with Enhanced Logging
-- Tracks ACTUAL vs EXPECTED for easy bulk failure analysis

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Intent predictions table (tracks every classification attempt)
CREATE TABLE IF NOT EXISTS intent_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  model_version TEXT,
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Intent corrections table (tracks user corrections)
CREATE TABLE IF NOT EXISTS intent_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id UUID REFERENCES intent_predictions(id),
  user_id TEXT,
  original_text TEXT NOT NULL,
  predicted_intent TEXT,
  predicted_confidence FLOAT,
  predicted_slots JSONB,
  corrected_intent TEXT NOT NULL,
  corrected_slots JSONB,
  correction_type TEXT, -- 'manual', 'automatic', 'bulk'
  model_version TEXT,
  applied_immediately BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Classification logs table (tracks ACTUAL vs EXPECTED for training)
CREATE TABLE IF NOT EXISTS classification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_run_id TEXT, -- Groups related test runs
  input_text TEXT NOT NULL,
  expected_intent TEXT NOT NULL,
  actual_intent TEXT,
  confidence_score FLOAT,
  is_correct BOOLEAN GENERATED ALWAYS AS (expected_intent = actual_intent) STORED,
  expected_slots JSONB,
  actual_slots JSONB,
  slot_accuracy FLOAT, -- Percentage of correctly extracted slots
  response_time_ms INTEGER,
  model_version TEXT,
  error_message TEXT, -- If classification failed
  metadata JSONB, -- Additional context
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bulk failure patterns table (aggregates common failures)
CREATE TABLE IF NOT EXISTS failure_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_type TEXT NOT NULL, -- 'intent_confusion', 'slot_extraction', 'low_confidence'
  from_intent TEXT,
  to_intent TEXT,
  failure_count INTEGER DEFAULT 1,
  example_texts TEXT[], -- Array of example failures
  common_keywords TEXT[], -- Common words in failures
  avg_confidence FLOAT,
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pattern_type, from_intent, to_intent)
);

-- Intent confusion matrix (tracks misclassification patterns)
CREATE TABLE IF NOT EXISTS intent_confusion_matrix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expected_intent TEXT NOT NULL,
  predicted_intent TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  avg_confidence FLOAT,
  example_texts TEXT[], -- Keep last 10 examples
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(expected_intent, predicted_intent)
);

-- Training queue table (for bulk retraining)
CREATE TABLE IF NOT EXISTS training_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  correct_intent TEXT NOT NULL,
  correct_slots JSONB,
  source TEXT, -- 'test_failure', 'user_correction', 'manual_entry'
  priority INTEGER DEFAULT 5, -- 1-10, higher = more important
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Model performance metrics (track improvement over time)
CREATE TABLE IF NOT EXISTS model_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_version TEXT NOT NULL,
  test_date DATE DEFAULT CURRENT_DATE,
  total_tests INTEGER,
  correct_predictions INTEGER,
  accuracy_percentage FLOAT,
  avg_confidence FLOAT,
  avg_response_time_ms INTEGER,
  intent_metrics JSONB, -- Per-intent accuracy
  confusion_summary JSONB, -- Top confusion pairs
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_predictions_text ON intent_predictions(original_text);
CREATE INDEX idx_predictions_intent ON intent_predictions(predicted_intent);
CREATE INDEX idx_predictions_timestamp ON intent_predictions(timestamp DESC);

CREATE INDEX idx_corrections_intent ON intent_corrections(corrected_intent);
CREATE INDEX idx_corrections_text ON intent_corrections(original_text);
CREATE INDEX idx_corrections_prediction ON intent_corrections(prediction_id);

CREATE INDEX idx_logs_test_run ON classification_logs(test_run_id);
CREATE INDEX idx_logs_expected ON classification_logs(expected_intent);
CREATE INDEX idx_logs_actual ON classification_logs(actual_intent);
CREATE INDEX idx_logs_correct ON classification_logs(is_correct);
CREATE INDEX idx_logs_created ON classification_logs(created_at DESC);

CREATE INDEX idx_patterns_type ON failure_patterns(pattern_type);
CREATE INDEX idx_patterns_intents ON failure_patterns(from_intent, to_intent);

CREATE INDEX idx_queue_processed ON training_queue(processed);
CREATE INDEX idx_queue_priority ON training_queue(priority DESC);

-- Helper functions for analytics

-- Function to update confusion matrix
CREATE OR REPLACE FUNCTION update_confusion_matrix()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expected_intent != NEW.actual_intent THEN
    INSERT INTO intent_confusion_matrix (expected_intent, predicted_intent, count, avg_confidence, example_texts)
    VALUES (NEW.expected_intent, NEW.actual_intent, 1, NEW.confidence_score, ARRAY[NEW.input_text])
    ON CONFLICT (expected_intent, predicted_intent)
    DO UPDATE SET 
      count = intent_confusion_matrix.count + 1,
      avg_confidence = ((intent_confusion_matrix.avg_confidence * intent_confusion_matrix.count) + NEW.confidence_score) / (intent_confusion_matrix.count + 1),
      example_texts = CASE 
        WHEN array_length(intent_confusion_matrix.example_texts, 1) >= 10 
        THEN array_append(intent_confusion_matrix.example_texts[2:10], NEW.input_text)
        ELSE array_append(intent_confusion_matrix.example_texts, NEW.input_text)
      END,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update confusion matrix on new classification logs
CREATE TRIGGER update_confusion_on_log
AFTER INSERT ON classification_logs
FOR EACH ROW
WHEN (NEW.actual_intent IS NOT NULL)
EXECUTE FUNCTION update_confusion_matrix();

-- Function to identify failure patterns
CREATE OR REPLACE FUNCTION identify_failure_patterns()
RETURNS TABLE(
  pattern TEXT,
  occurrence_count BIGINT,
  example_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CONCAT(expected_intent, ' -> ', actual_intent) as pattern,
    COUNT(*) as occurrence_count,
    (array_agg(input_text ORDER BY created_at DESC))[1] as example_text
  FROM classification_logs
  WHERE is_correct = false
    AND created_at > NOW() - INTERVAL '7 days'
  GROUP BY expected_intent, actual_intent
  HAVING COUNT(*) > 2
  ORDER BY occurrence_count DESC;
END;
$$ LANGUAGE plpgsql;

-- View for quick accuracy metrics
CREATE OR REPLACE VIEW intent_accuracy_summary AS
SELECT 
  expected_intent,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE is_correct = true) as correct_predictions,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_correct = true) / COUNT(*), 2) as accuracy_percentage,
  AVG(confidence_score) as avg_confidence,
  AVG(response_time_ms) as avg_response_ms
FROM classification_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY expected_intent;

-- View for recent failures requiring attention
CREATE OR REPLACE VIEW recent_failures AS
SELECT 
  cl.input_text,
  cl.expected_intent,
  cl.actual_intent,
  cl.confidence_score,
  cl.created_at,
  fp.failure_count as pattern_frequency
FROM classification_logs cl
LEFT JOIN failure_patterns fp 
  ON fp.from_intent = cl.expected_intent 
  AND fp.to_intent = cl.actual_intent
WHERE cl.is_correct = false
  AND cl.created_at > NOW() - INTERVAL '1 hour'
ORDER BY cl.created_at DESC;

-- Grant permissions (adjust based on your Supabase auth setup)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;