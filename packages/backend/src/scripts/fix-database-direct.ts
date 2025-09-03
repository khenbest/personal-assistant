import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://epfclgvooboffhlxccmb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create admin client with service key (has full database access)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixDatabase() {
  console.log('Testing database connection...');
  
  try {
    // First, let's test the connection by checking if we can query the table
    const { error: queryError } = await supabase
      .from('calendar_events')
      .select('*')
      .limit(1);

    if (queryError) {
      console.error('Error querying calendar_events:', queryError);
      return;
    }

    console.log('✅ Connected to database successfully');

    // Try to insert a test event with duration_minutes to see if column exists
    const testEvent = {
      user_id: 'migration-test',
      title: 'Migration Test Event',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
      duration_minutes: 60
    };

    const { data: insertData, error: insertError } = await supabase
      .from('calendar_events')
      .insert(testEvent)
      .select();

    if (insertError) {
      if (insertError.message.includes('duration_minutes')) {
        console.error('❌ Column duration_minutes does not exist');
        console.log('\n📝 Please run this SQL in your Supabase Dashboard:');
        console.log('   https://supabase.com/dashboard/project/epfclgvooboffhlxccmb/sql/new\n');
        console.log('ALTER TABLE calendar_events');
        console.log('ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;\n');
      } else {
        console.error('Insert error:', insertError);
      }
    } else {
      console.log('✅ Column duration_minutes exists!');
      
      // Clean up test event
      if (insertData && insertData[0]) {
        const { error: deleteError } = await supabase
          .from('calendar_events')
          .delete()
          .eq('id', insertData[0].id);
        
        if (!deleteError) {
          console.log('✅ Cleaned up test event');
        }
      }
      
      console.log('\n🎉 Database is properly configured!');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixDatabase();