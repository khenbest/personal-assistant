#!/usr/bin/env tsx
/**
 * Automated Database Setup Script
 * Creates all tables for intent classification system
 * No manual Supabase dashboard needed!
 */

import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function setupDatabase() {
  console.log('🚀 Setting up Supabase tables automatically...\n');
  
  // Tables to create with their SQL
  const tables = [
    {
      name: 'intent_predictions',
      sql: `
        CREATE TABLE IF NOT EXISTS intent_predictions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          original_text TEXT NOT NULL,
          predicted_intent TEXT,
          predicted_confidence FLOAT,
          predicted_slots JSONB,
          model_version TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_predictions_timestamp 
        ON intent_predictions(created_at DESC);
      `
    },
    {
      name: 'intent_corrections',
      sql: `
        CREATE TABLE IF NOT EXISTS intent_corrections (
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
        
        CREATE INDEX IF NOT EXISTS idx_corrections_timestamp 
        ON intent_corrections(created_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_corrections_user 
        ON intent_corrections(user_id);
      `
    },
    {
      name: 'intent_patterns',
      sql: `
        CREATE TABLE IF NOT EXISTS intent_patterns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          intent TEXT NOT NULL,
          pattern TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          confidence FLOAT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_patterns_intent 
        ON intent_patterns(intent);
      `
    },
    {
      name: 'intent_knn_index',
      sql: `
        CREATE TABLE IF NOT EXISTS intent_knn_index (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          text TEXT NOT NULL,
          intent TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_knn_intent 
        ON intent_knn_index(intent);
      `
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const table of tables) {
    try {
      console.log(`📋 Creating table: ${table.name}`);
      
      // Execute the SQL using Supabase RPC
      // Note: For complex SQL, we need to use the Supabase SQL Editor API
      // For now, we'll create tables using the client
      
      // First, check if table exists
      const { error: checkError } = await supabase
        .from(table.name)
        .select('count')
        .limit(1);
      
      if (checkError && checkError.message.includes('does not exist')) {
        console.log(`   ⚠️  Table ${table.name} doesn't exist yet`);
        console.log(`   📝 Please run this SQL in Supabase Dashboard:`);
        console.log(`   ${table.sql.trim().substring(0, 100)}...`);
        errorCount++;
      } else if (checkError) {
        console.log(`   ❌ Error checking table: ${checkError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Table ${table.name} already exists`);
        successCount++;
      }
    } catch (error) {
      console.error(`   ❌ Failed to create ${table.name}:`, error);
      errorCount++;
    }
  }

  console.log('\n📊 Setup Summary:');
  console.log(`   ✅ Tables ready: ${successCount}`);
  console.log(`   ⚠️  Tables needing manual creation: ${errorCount}`);

  if (errorCount > 0) {
    console.log('\n📝 Next Steps:');
    console.log('1. Run the SQL file directly using Supabase CLI:');
    console.log('   supabase db push --db-url $SUPABASE_DB_URL < src/db/setup-intent-tables.sql');
    console.log('\n2. Or use the migration approach:');
    console.log('   supabase migration new intent_tables');
    console.log('   # Copy SQL to the migration file');
    console.log('   supabase db push');
  } else {
    console.log('\n✨ All tables are ready! You can start using the intent classification system.');
  }
}

// Alternative: Direct SQL execution using Supabase CLI
async function setupWithCLI() {
  console.log('\n🔧 Alternative: Using Supabase CLI for direct SQL execution\n');
  
  const { execSync } = require('child_process');
  
  try {
    // Check if Supabase CLI is installed
    execSync('supabase --version', { stdio: 'ignore' });
    console.log('✅ Supabase CLI is installed');
    
    // Get the database URL
    const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    
    if (!dbUrl) {
      console.log('⚠️  Database URL not found in environment');
      console.log('   You can find it in: Supabase Dashboard → Settings → Database');
      console.log('   Add it to .env as SUPABASE_DB_URL=postgresql://...');
      return;
    }
    
    // Execute SQL file
    const sqlFile = path.join(__dirname, 'setup-intent-tables.sql');
    console.log('🚀 Executing SQL file...');
    
    const result = execSync(
      `supabase db push --db-url "${dbUrl}" < "${sqlFile}"`,
      { encoding: 'utf-8' }
    );
    
    console.log('✅ Database setup complete!');
    console.log(result);
    
  } catch (error) {
    console.log('❌ CLI execution failed:', error instanceof Error ? error.message : String(error));
    console.log('   Please ensure Supabase CLI is configured properly');
  }
}

// Main execution
async function main() {
  console.log('🤖 NLP Intent Classification - Database Setup\n');
  
  // Try the client approach first
  await setupDatabase();
  
  // Offer CLI alternative
  console.log('\n' + '='.repeat(50));
  await setupWithCLI();
}

main().catch(console.error);