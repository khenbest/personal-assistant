import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addDurationColumn() {
  try {
    // Check if column exists first
    const { error: checkError } = await supabase.rpc('get_table_columns', {
      table_name: 'calendar_events'
    }).single();

    if (checkError) {
      console.log('Column might not exist, attempting to add...');
    }

    // Try to add the column
    const { error } = await supabase.rpc('execute_sql', {
      query: 'ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;'
    });

    if (error) {
      // If RPC doesn't exist, try another approach
      console.log('Direct SQL approach not available, column may already exist or require dashboard access');
      
      // Test if we can insert with duration_minutes
      const testEvent = {
        user_id: 'test-migration',
        title: 'Test Event',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString(),
        duration_minutes: 60
      };

      const { error: insertError } = await supabase
        .from('calendar_events')
        .insert(testEvent);

      if (insertError && insertError.message.includes('duration_minutes')) {
        console.error('Column does not exist and cannot be added via API');
        console.log('Please add the column manually via Supabase dashboard:');
        console.log('ALTER TABLE calendar_events ADD COLUMN duration_minutes INTEGER DEFAULT 60;');
      } else if (!insertError) {
        console.log('✅ Column exists or was added successfully!');
        // Clean up test event
        await supabase
          .from('calendar_events')
          .delete()
          .eq('user_id', 'test-migration');
      }
    } else {
      console.log('✅ Column added successfully!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

addDurationColumn();