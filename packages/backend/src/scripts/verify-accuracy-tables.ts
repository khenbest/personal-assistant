#!/usr/bin/env npx tsx
/**
 * Verify Accuracy Tracking Tables in Supabase
 * Checks if the migration has been applied
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import chalk from 'chalk';

async function verifyAccuracyTables() {
  console.log(chalk.blue('🔍 Verifying Accuracy Tracking Tables in Database\n'));
  
  // Initialize Supabase client
  const supabaseUrl = config.supabase.url || 'https://epfclgvooboffhlxccmb.supabase.co';
  const supabaseAnonKey = config.supabase.anonKey || '';
  
  if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
    console.log(chalk.red('❌ Supabase not configured. Cannot verify tables.'));
    console.log(chalk.yellow('Please set SUPABASE_ANON_KEY in .env'));
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Tables to check
  const requiredTables = [
    'intent_predictions',
    'intent_corrections', 
    'classification_logs',
    'failure_patterns',
    'intent_confusion_matrix',
    'training_queue',
    'model_metrics'
  ];
  
  console.log(chalk.yellow('Checking for accuracy tracking tables:\n'));
  
  let allTablesExist = true;
  
  for (const tableName of requiredTables) {
    try {
      // Try to query each table (limit 1 to be fast)
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log(chalk.red(`❌ Table '${tableName}' does not exist`));
          allTablesExist = false;
        } else if (error.code === 'PGRST200' || !error.message.includes('does not exist')) {
          // Table exists but might be empty or have permission issues
          console.log(chalk.green(`✅ Table '${tableName}' exists`));
        } else {
          console.log(chalk.yellow(`⚠️  Table '${tableName}' status unclear: ${error.message}`));
        }
      } else {
        console.log(chalk.green(`✅ Table '${tableName}' exists (${data?.length || 0} rows)`));
      }
    } catch (err) {
      console.log(chalk.red(`❌ Error checking '${tableName}': ${err}`));
      allTablesExist = false;
    }
  }
  
  console.log('\n' + chalk.blue('Summary:'));
  
  if (allTablesExist) {
    console.log(chalk.green('✅ All accuracy tracking tables exist!'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log('1. Create AccuracyTrackingService to log predictions');
    console.log('2. Add TypeScript interfaces for these tables');
    console.log('3. Implement correction UI\n');
  } else {
    console.log(chalk.red('❌ Some tables are missing!'));
    console.log(chalk.yellow('\nTo apply the migration:'));
    console.log('1. Run: npx supabase migration up');
    console.log('2. Or manually run the SQL file:');
    console.log('   supabase/migrations/20250903_intent_classification_enhanced.sql\n');
    
    // Show the migration command
    console.log(chalk.cyan('Migration command:'));
    console.log(chalk.white('npx supabase db push --password YOUR_DB_PASSWORD\n'));
  }
  
  // Test if we can insert a test record
  console.log(chalk.blue('\n🧪 Testing write access:'));
  try {
    const testPrediction = {
      original_text: 'TEST: Schedule meeting tomorrow at 3pm',
      predicted_intent: 'create_event',
      predicted_confidence: 0.95,
      predicted_slots: { title: 'meeting', time: 'tomorrow 3pm' },
      model_version: 'test-v1'
      // Note: response_time_ms column exists but may not be in schema cache
    };
    
    const { data, error } = await supabase
      .from('intent_predictions')
      .insert(testPrediction)
      .select()
      .single();
    
    if (error) {
      console.log(chalk.red(`❌ Cannot write to intent_predictions: ${error.message}`));
    } else {
      console.log(chalk.green(`✅ Successfully wrote test prediction (id: ${data.id})`));
      
      // Clean up test record
      await supabase
        .from('intent_predictions')
        .delete()
        .eq('id', data.id);
    }
  } catch (err) {
    console.log(chalk.red(`❌ Write test failed: ${err}`));
  }
}

// Run verification
verifyAccuracyTables().catch(console.error);