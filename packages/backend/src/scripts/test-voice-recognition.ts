#!/usr/bin/env npx tsx
/**
 * Test Voice Recognition End-to-End
 * Tests the complete voice → intent → calendar flow
 */

import { IntentClassificationService } from '../services/intent-classification-service';
import { CalendarService } from '../services/calendar-service';
import { LLMService } from '../services/llm-service';
import chalk from 'chalk';

async function testVoiceCommands() {
  console.log(chalk.blue('🎤 Testing Voice Recognition Pipeline\n'));
  
  const llmService = new LLMService();
  const intentService = new IntentClassificationService(llmService);
  const calendarService = new CalendarService(intentService);
  
  // Test commands that would come from voice recognition
  const testCommands = [
    "Schedule a team meeting tomorrow at 3 PM",
    "Book the conference room for Friday at 2",
    "Add dentist appointment next Monday at 10 AM",
    "Create a lunch meeting tomorrow at noon",
    "Remind me to call John at 5 PM today",
    "Set up a one-on-one with Sarah next Tuesday at 4",
  ];
  
  console.log(chalk.yellow('Testing with real voice command patterns:\n'));
  
  for (const command of testCommands) {
    console.log(chalk.cyan(`\n📝 Command: "${command}"`));
    
    try {
      // Test intent classification
      const intentResult = await intentService.classifyIntent(command);
      console.log(chalk.green(`✅ Intent: ${intentResult.intent} (confidence: ${intentResult.confidence.toFixed(2)})`));
      
      // Test calendar processing if it's a calendar command
      if (intentResult.intent === 'create_event') {
        const calendarResult = await calendarService.createEventFromText(command);
        
        if (calendarResult.success) {
          console.log(chalk.green(`✅ Calendar Event Created:`));
          console.log(`   Title: ${calendarResult.event?.title}`);
          console.log(`   Time: ${new Date(calendarResult.event?.start_time || '').toLocaleString()}`);
          console.log(`   Response: "${calendarResult.spokenResponse}"`);
          
          // Check confidence thresholds
          const confidence = calendarResult.confidence || 0;
          if (confidence >= 0.91) {
            console.log(chalk.green(`   ⚡ Auto-execute (confidence: ${confidence.toFixed(2)})`));
          } else if (confidence >= 0.81) {
            console.log(chalk.yellow(`   ⚠️ Light confirmation needed (confidence: ${confidence.toFixed(2)})`));
          } else {
            console.log(chalk.red(`   🛑 Requires confirmation (confidence: ${confidence.toFixed(2)})`));
          }
        } else {
          console.log(chalk.red(`❌ Failed: ${calendarResult.error}`));
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error}`));
    }
  }
  
  console.log(chalk.blue('\n\n📊 Test Complete!\n'));
  console.log(chalk.yellow('Next Steps:'));
  console.log('1. Run the mobile app with expo run:ios');
  console.log('2. Test with real voice input');
  console.log('3. Check if transcriptions match expected patterns');
  console.log('4. Verify calendar events are created correctly\n');
}

// Run the test
testVoiceCommands().catch(console.error);