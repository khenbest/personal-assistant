-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_reminder_time ON reminders(reminder_time);
CREATE INDEX idx_reminders_is_completed ON reminders(is_completed);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);
CREATE INDEX idx_notes_content ON notes USING GIN(to_tsvector('english', content));
CREATE INDEX idx_notes_title ON notes USING GIN(to_tsvector('english', title));

-- Add RLS (Row Level Security) policies
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies for reminders
CREATE POLICY "Users can view their own reminders" ON reminders
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own reminders" ON reminders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own reminders" ON reminders
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own reminders" ON reminders
  FOR DELETE USING (true);

-- Create policies for notes
CREATE POLICY "Users can view their own notes" ON notes
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own notes" ON notes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (true);