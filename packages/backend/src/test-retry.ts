/**
 * Test script for retry logic with LLM providers
 */

import 'dotenv/config';
import { UnifiedLLMService } from './services/unified-llm-service';

// Create a new instance after loading env variables
const unifiedLLMService = new UnifiedLLMService();

async function testRetryLogic() {
  console.log('🧪 Testing LLM retry logic...\n');

  // Test 1: Simple request that should work
  console.log('Test 1: Normal request');
  try {
    const response1 = await unifiedLLMService.generateCompletion({
      prompt: 'What is 2+2?',
      maxTokens: 100,
      complexity: 'low'
    });
    console.log('✅ Response:', response1.content.substring(0, 50) + '...');
    console.log('   Provider:', response1.provider);
    console.log('   Model:', response1.model);
    console.log('');
  } catch (error) {
    console.error('❌ Test 1 failed:', error instanceof Error ? error.message : String(error));
  }

  // Test 2: Multiple rapid requests to trigger rate limiting
  console.log('Test 2: Rapid requests (may trigger rate limiting)');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      unifiedLLMService.generateCompletion({
        prompt: `Calculate ${i} + ${i}`,
        maxTokens: 50,
        complexity: 'low'
      }).then(res => ({
        success: true,
        provider: res.provider,
        cached: res.cached
      })).catch(err => ({
        success: false,
        error: err.message
      }))
    );
  }

  const results = await Promise.all(promises);
  results.forEach((result, i) => {
    if (result.success) {
      console.log(`   Request ${i + 1}: ✅ Provider: ${'provider' in result ? result.provider : 'unknown'}, Cached: ${'cached' in result ? result.cached : false}`);
    } else {
      console.log(`   Request ${i + 1}: ❌ Error: ${'error' in result ? result.error : 'unknown error'}`);
    }
  });
  console.log('');

  // Test 3: Complex request with DeepSeek formatting
  console.log('Test 3: Testing DeepSeek <think> tag removal');
  try {
    const response3 = await unifiedLLMService.generateCompletion({
      prompt: 'Explain why the sky is blue in one sentence.',
      maxTokens: 200,
      complexity: 'medium'
    });
    console.log('✅ Response clean (no <think> tags):', !response3.content.includes('<think>'));
    console.log('   Provider:', response3.provider);
    console.log('   Content:', response3.content.substring(0, 100) + '...');
    console.log('');
  } catch (error) {
    console.error('❌ Test 3 failed:', error instanceof Error ? error.message : String(error));
  }

  // Test 4: Check provider health and stats
  console.log('Test 4: Provider statistics');
  const stats = unifiedLLMService.getProviderStats();
  stats.forEach(stat => {
    console.log(`   ${stat.name}:`);
    console.log(`     - Healthy: ${stat.healthy}`);
    console.log(`     - Model: ${stat.model}`);
    console.log(`     - Available: ${stat.available}`);
  });

  console.log('\n✅ All tests completed!');
}

// Run tests
testRetryLogic().catch(console.error);