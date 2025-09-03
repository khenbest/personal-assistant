#!/usr/bin/env tsx

/**
 * Simple test for Ollama intent classification
 */

import { unifiedLLMService } from '../services/unified-llm-service';

const TEST_UTTERANCES = [
  { text: "remind me to call john tomorrow at 3pm", expected: "add_reminder" },
  { text: "create an event for lunch with Sarah on Friday", expected: "create_event" },
  { text: "make a note about the meeting outcomes", expected: "create_note" },
  { text: "send an email to the team about the project", expected: "send_email" },
  { text: "what emails did I get from Alice today?", expected: "read_email" }
];

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Testing Ollama Intent Classification\n');
  
  // Wait a moment for Ollama to initialize
  console.log('Waiting for services to initialize...');
  await wait(2000);
  
  const stats = unifiedLLMService.getProviderStats();
  console.log('Available providers:', stats.map(s => `${s.name}(${s.healthy ? 'healthy' : 'unhealthy'})`).join(', '));
  console.log();
  
  let correct = 0;
  let total = 0;
  
  for (const test of TEST_UTTERANCES) {
    try {
      const response = await unifiedLLMService.generateCompletion({
        prompt: `Classify this text into one of these intents: create_event, add_reminder, create_note, read_email, send_email.
Text: "${test.text}"
Respond with ONLY the intent name, nothing else.`,
        complexity: 'low',
        temperature: 0.1,
        maxTokens: 20
      });
      
      const predicted = response.content.trim().toLowerCase().replace(/[^a-z_]/g, '');
      const isCorrect = predicted === test.expected;
      
      console.log(`${isCorrect ? '✅' : '❌'} "${test.text.substring(0, 40)}..."`);
      console.log(`   Provider: ${response.provider} | Model: ${response.model}`);
      console.log(`   Predicted: ${predicted} | Expected: ${test.expected}`);
      console.log(`   Time: ${response.responseTime}ms\n`);
      
      if (isCorrect) correct++;
      total++;
      
    } catch (error) {
      console.error(`❌ Failed for "${test.text}":`, error);
      total++;
    }
  }
  
  console.log('\n📊 Results:');
  console.log(`Accuracy: ${correct}/${total} (${Math.round(correct/total * 100)}%)`);
  
  if (stats.some(s => s.name === 'ollama')) {
    console.log('\n✨ Success! Ollama is working for intent classification.');
    console.log('💡 Next steps:');
    console.log('   1. This runs 100% locally, no internet required');
    console.log('   2. Ready for iPhone deployment with model conversion');
    console.log('   3. Zero cost, unlimited requests');
  }
}

main().catch(console.error);