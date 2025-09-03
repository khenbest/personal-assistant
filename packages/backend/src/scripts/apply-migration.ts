#!/usr/bin/env node
/**
 * Apply Database Migration
 * Creates the enhanced logging tables for intent classification
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function applyMigration() {
  console.log('🚀 Applying database migration...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase configuration missing. Please check SUPABASE_URL and SUPABASE_KEY in .env');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Read migration file
  const migrationPath = path.join(__dirname, '../../../../supabase/migrations/20250903_intent_classification_enhanced.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split into individual statements (rough split by semicolon)
  const statements = migrationSQL
    .split(/;\s*$|;\s*\n/m)
    .filter(stmt => stmt.trim().length > 0)
    .map(stmt => stmt.trim() + ';');
  
  console.log(`📝 Found ${statements.length} SQL statements to execute`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip comments and empty statements
    if (!statement || statement.trim() === '' || statement.startsWith('--') || statement.trim() === ';') {
      continue;
    }
    
    // Get first 50 chars for logging
    const preview = statement.substring(0, 50).replace(/\n/g, ' ');
    
    try {
      console.log(`   Executing: ${preview}...`);
      
      // Use raw SQL execution
      const { error } = await supabase.rpc('exec_sql', { sql: statement }).single();
      
      if (error) {
        // Try alternative approach - direct query
        const { error: queryError } = await supabase.from('_sql').select(statement);
        
        if (queryError) {
          console.error(`   ❌ Failed: ${queryError.message}`);
          errorCount++;
        } else {
          console.log(`   ✅ Success`);
          successCount++;
        }
      } else {
        console.log(`   ✅ Success`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${errorCount}`);
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. This might be okay if tables already exist.');
    console.log('   You may need to apply the migration manually in Supabase SQL editor.');
  } else {
    console.log('\n🎉 Migration applied successfully!');
  }
}

// Run
applyMigration().catch(console.error);