-- Context Management Tables for Claude Memory

-- Conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_conversation_session (session_id),
  INDEX idx_conversation_created (created_at DESC),
  INDEX idx_conversation_user (user_id)
);

-- Context summaries table
CREATE TABLE IF NOT EXISTS context_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points TEXT[],
  action_items TEXT[],
  decisions TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_summary_session (session_id),
  INDEX idx_summary_created (created_at DESC),
  INDEX idx_summary_user (user_id)
);

-- Working memory table
CREATE TABLE IF NOT EXISTS working_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_task TEXT,
  project_context TEXT,
  recent_topics TEXT[],
  important_facts TEXT[],
  pending_actions TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_memory_session (session_id),
  INDEX idx_memory_updated (updated_at DESC),
  INDEX idx_memory_user (user_id)
);

-- Add RLS policies
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_memory ENABLE ROW LEVEL SECURITY;

-- Policies for conversation_history
CREATE POLICY "Users can read own conversation history"
  ON conversation_history FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own conversation history"
  ON conversation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policies for context_summaries
CREATE POLICY "Users can read own summaries"
  ON context_summaries FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own summaries"
  ON context_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policies for working_memory
CREATE POLICY "Users can manage own working memory"
  ON working_memory FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Function to clean old conversation history (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_history
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM context_summaries
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up old data (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-conversations', '0 0 * * *', 'SELECT cleanup_old_conversations();');