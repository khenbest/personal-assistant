/**
 * Database Setup Script
 * Creates tables for intent classification and learning system
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('🚀 Setting up Supabase tables for intent classification...');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'setup-intent-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Note: For production, you should run this SQL directly in Supabase Dashboard
    // or use Supabase migrations. This is for development convenience.
    
    console.log('📋 SQL script loaded. Please run the following SQL in your Supabase Dashboard:');
    console.log('Navigate to: SQL Editor → New Query');
    console.log('Then paste and run this SQL:\n');
    console.log('=====================================');
    console.log(sql);
    console.log('=====================================');
    
    // Test connection
    const { error } = await supabase
      .from('intent_predictions')
      .select('count')
      .limit(1);
    
    if (error && error.message.includes('relation "public.intent_predictions" does not exist')) {
      console.log('\n⚠️  Tables do not exist yet. Please run the SQL above in Supabase Dashboard.');
    } else if (error) {
      console.error('❌ Error testing connection:', error.message);
    } else {
      console.log('✅ Database connection successful!');
      console.log('✅ Tables are ready for use.');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase();