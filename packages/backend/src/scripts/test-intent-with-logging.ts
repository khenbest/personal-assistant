#!/usr/bin/env node
/**
 * Test Intent Classification with Comprehensive Logging
 * Tracks ACTUAL vs EXPECTED for training improvement
 */

import { IntentService } from '../services/intent-service';
import { LLMService } from '../services/llm-service';
import { IntentClassificationLoggerService } from '../services/classification-logger';
import { TestDataGenerator, TestCase } from './generate-test-data';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

class IntentTestRunner {
  private intentService: IntentClassificationService;
  private logger: IntentClassificationLoggerService;
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService();
    this.intentService = new IntentService(this.llmService);
    this.logger = new ClassificationLogger('v1.0.0');
  }

  /**
   * Run single test with logging
   */
  async runSingleTest(testCase: TestCase): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Classify intent
      const result = await this.intentService.classifyIntent(testCase.text);
      const responseTime = Date.now() - startTime;

      // Log classification with actual vs expected
      await this.logger.logClassification({
        inputText: testCase.text,
        expectedIntent: testCase.expectedIntent,
        actualIntent: result.intent,
        confidenceScore: result.confidence,
        expectedSlots: testCase.expectedSlots,
        actualSlots: result.slots,
        responseTimeMs: responseTime,
        modelVersion: 'v1.0.0',
        metadata: {
          category: testCase.category,
          llmProvider: result.metadata?.provider
        }
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Log error case
      await this.logger.logClassification({
        inputText: testCase.text,
        expectedIntent: testCase.expectedIntent,
        actualIntent: null,
        confidenceScore: 0,
        responseTimeMs: responseTime,
        modelVersion: 'v1.0.0',
        errorMessage: error.message
      });
    }
  }

  /**
   * Run all tests with comprehensive logging
   */
  async runAllTests(testCases?: TestCase[]): Promise<void> {
    // Use provided test cases or generate new ones
    const tests = testCases || TestDataGenerator.generateTestData();
    
    console.log('\n🚀 Starting Intent Classification Test Suite');
    console.log(`   Testing ${tests.length} cases...`);
    console.log('   ' + '─'.repeat(60));

    // Start test run
    const testRunId = this.logger.startTestRun('Comprehensive Intent Classification Test');

    // Run tests and collect results
    const results = await this.logger.logBulkClassifications(
      await Promise.all(tests.map(async (testCase) => {
        const startTime = Date.now();
        
        try {
          // Pass expected intent to enable logging
          const result = await this.intentService.classifyIntent(testCase.text, testCase.expectedIntent);
          const responseTime = result.metadata?.responseTime || (Date.now() - startTime);

          return {
            testRunId,
            inputText: testCase.text,
            expectedIntent: testCase.expectedIntent,
            actualIntent: result.intent,
            confidenceScore: result.confidence,
            expectedSlots: testCase.expectedSlots,
            actualSlots: result.slots,
            responseTimeMs: responseTime,
            modelVersion: 'v1.0.0',
            metadata: {
              category: testCase.category,
              llmProvider: result.metadata?.provider
            }
          };
        } catch (error: any) {
          return {
            testRunId,
            inputText: testCase.text,
            expectedIntent: testCase.expectedIntent,
            actualIntent: null,
            confidenceScore: 0,
            expectedSlots: testCase.expectedSlots,
            actualSlots: null,
            responseTimeMs: Date.now() - startTime,
            modelVersion: 'v1.0.0',
            errorMessage: error.message
          };
        }
      }))
    );

    // Analyze results for improvement opportunities
    await this.analyzeResults(results);
  }

  /**
   * Run quick smoke test
   */
  async runQuickTest(): Promise<void> {
    console.log('\n🔥 Running Quick Smoke Test...\n');

    const quickTests: TestCase[] = [
      {
        text: "Schedule a meeting with John tomorrow at 3pm",
        expectedIntent: "create_event",
        expectedSlots: { title: "meeting with John", date: "tomorrow", time: "3pm" }
      },
      {
        text: "Remind me to call mom in 2 hours",
        expectedIntent: "add_reminder",
        expectedSlots: { task: "call mom", duration: "2 hours" }
      },
      {
        text: "Make a note about the new feature idea",
        expectedIntent: "create_note",
        expectedSlots: { content: "new feature idea" }
      },
      {
        text: "Check my emails from Sarah",
        expectedIntent: "read_email",
        expectedSlots: { sender: "Sarah" }
      },
      {
        text: "Send an email to the team about the deadline",
        expectedIntent: "send_email",
        expectedSlots: { recipient: "team", subject: "deadline" }
      }
    ];

    for (const test of quickTests) {
      await this.runSingleTest(test);
    }

    console.log('\n✅ Quick test complete!\n');
  }

  /**
   * Test specific intent category
   */
  async testByCategory(category: string): Promise<void> {
    const allTests = TestDataGenerator.generateTestData();
    const categoryTests = allTests.filter(t => t.category === category);
    
    console.log(`\n🎯 Testing ${category} cases (${categoryTests.length} tests)...\n`);
    
    await this.runAllTests(categoryTests);
  }

  /**
   * Test specific intent
   */
  async testByIntent(intent: string): Promise<void> {
    const allTests = TestDataGenerator.generateTestData();
    const intentTests = allTests.filter(t => t.expectedIntent === intent);
    
    console.log(`\n🎯 Testing ${intent} intent (${intentTests.length} tests)...\n`);
    
    await this.runAllTests(intentTests);
  }

  /**
   * Analyze results and suggest improvements
   */
  private async analyzeResults(results: any): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('💡 IMPROVEMENT RECOMMENDATIONS');
    console.log('='.repeat(80));

    // Check if we met 85% target
    if (results.accuracy < 85) {
      console.log(`\n⚠️  Accuracy (${results.accuracy.toFixed(1)}%) is below 85% target\n`);
      console.log('   Recommended Actions:');
      console.log('   1. Review and improve LLM prompts');
      console.log('   2. Add more training examples for failing patterns');
      console.log('   3. Implement fallback rules for common confusions');
    } else {
      console.log(`\n✅ Accuracy (${results.accuracy.toFixed(1)}%) meets target!\n`);
    }

    // Suggest improvements for top failure patterns
    if (results.failurePatterns.length > 0) {
      console.log('\n📝 Top Patterns Needing Attention:');
      
      for (const pattern of results.failurePatterns.slice(0, 3)) {
        console.log(`\n   ${pattern.fromIntent} → ${pattern.toIntent}:`);
        console.log(`   - Occurrences: ${pattern.exampleTexts.length}`);
        console.log(`   - Avg Confidence: ${(pattern.avgConfidence * 100).toFixed(1)}%`);
        
        if (pattern.commonKeywords && pattern.commonKeywords.length > 0) {
          console.log(`   - Keywords causing confusion: ${pattern.commonKeywords.join(', ')}`);
        }
        
        // Suggest specific improvements
        this.suggestImprovements(pattern);
      }
    }

    // Get failures for retraining
    const failures = await this.logger.getFailuresForRetraining(50);
    if (failures.length > 0) {
      console.log(`\n📚 ${failures.length} failures added to training queue for improvement`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Suggest specific improvements for failure patterns
   */
  private suggestImprovements(pattern: any): void {
    console.log('   💡 Suggestions:');
    
    // Intent-specific suggestions
    if (pattern.fromIntent === 'create_event' && pattern.toIntent === 'add_reminder') {
      console.log('      - Add explicit time/date keywords to prompt');
      console.log('      - Look for "schedule", "meeting", "appointment" keywords');
    } else if (pattern.fromIntent === 'add_reminder' && pattern.toIntent === 'create_event') {
      console.log('      - Check for "remind", "alert", "ping" keywords');
      console.log('      - Differentiate tasks vs scheduled events');
    } else if (pattern.avgConfidence < 0.5) {
      console.log('      - Low confidence suggests ambiguous input');
      console.log('      - Consider adding clarification step');
    }
    
    console.log('      - Add pattern-specific training examples');
    console.log('      - Implement rule-based override for this pattern');
  }
}

// Main execution
async function main() {
  const runner = new IntentTestRunner();
  const args = process.argv.slice(2);

  try {
    if (args.length === 0 || args[0] === 'all') {
      // Run all tests
      await runner.runAllTests();
    } else if (args[0] === 'quick') {
      // Run quick smoke test
      await runner.runQuickTest();
    } else if (args[0] === 'category' && args[1]) {
      // Test specific category
      await runner.testByCategory(args[1]);
    } else if (args[0] === 'intent' && args[1]) {
      // Test specific intent
      await runner.testByIntent(args[1]);
    } else if (args[0] === 'generate') {
      // Just generate test data
      const tests = TestDataGenerator.generateTestData();
      TestDataGenerator.saveToFile(tests, 'test_cases_with_expected.json');
    } else {
      console.log('Usage:');
      console.log('  npm run test:intent         # Run all tests');
      console.log('  npm run test:intent quick   # Run quick smoke test');
      console.log('  npm run test:intent category <category>  # Test specific category');
      console.log('  npm run test:intent intent <intent>      # Test specific intent');
      console.log('  npm run test:intent generate # Generate test data');
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { IntentTestRunner };