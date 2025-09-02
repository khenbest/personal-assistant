#!/usr/bin/env tsx
/**
 * Check if intent classification tables exist in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('🔍 Checking Supabase tables...\n');
  
  const tables = [
    'intent_predictions',
    'intent_corrections', 
    'intent_patterns',
    'intent_knn_index'
  ];
  
  let existingTables = 0;
  let missingTables = [];
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error && error.message.includes('does not exist')) {
        console.log(`❌ Table ${table} - NOT FOUND`);
        missingTables.push(table);
      } else if (error) {
        console.log(`⚠️  Table ${table} - ERROR: ${error.message}`);
        missingTables.push(table);
      } else {
        console.log(`✅ Table ${table} - EXISTS`);
        existingTables++;
      }
    } catch (e) {
      console.log(`❌ Table ${table} - CHECK FAILED`);
      missingTables.push(table);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Existing tables: ${existingTables}/${tables.length}`);
  console.log(`   ❌ Missing tables: ${missingTables.length}/${tables.length}`);
  
  if (missingTables.length > 0) {
    console.log('\n📝 To create missing tables:');
    console.log('\nOption 1: Use Supabase Dashboard');
    console.log('1. Go to: https://supabase.com/dashboard/project/epfclgvooboffhlxccmb/sql');
    console.log('2. Copy the SQL from: packages/backend/src/db/setup-intent-tables.sql');
    console.log('3. Run the SQL\n');
    
    console.log('Option 2: Use Supabase CLI (requires database password)');
    console.log('1. Get your database password from:');
    console.log('   https://supabase.com/dashboard/project/epfclgvooboffhlxccmb/settings/database');
    console.log('2. Run: supabase link --project-ref epfclgvooboffhlxccmb');
    console.log('3. Run: supabase db push\n');
    
    console.log('Option 3: Direct SQL connection');
    console.log('1. Get connection string from Supabase Dashboard → Settings → Database');
    console.log('2. Use psql or any PostgreSQL client to run the migration');
  } else {
    console.log('\n✨ All tables exist! The system is ready to use.');
  }
}

checkTables().catch(console.error);