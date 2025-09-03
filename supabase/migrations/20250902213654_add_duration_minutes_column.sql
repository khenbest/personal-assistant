-- Add duration_minutes column to calendar_events table
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;