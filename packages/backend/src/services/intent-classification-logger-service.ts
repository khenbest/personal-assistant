/**
 * Classification Logger Service
 * Tracks ACTUAL vs EXPECTED classifications for training and improvement
 */

import { supabase } from '../db/supabase';

export interface ClassificationLog {
  testRunId?: string;
  inputText: string;
  expectedIntent: string;
  actualIntent: string | null;
  confidenceScore: number;
  expectedSlots?: any;
  actualSlots?: any;
  slotAccuracy?: number;
  responseTimeMs: number;
  modelVersion: string;
  errorMessage?: string;
  metadata?: any;
}

export interface FailurePattern {
  patternType: 'intent_confusion' | 'slot_extraction' | 'low_confidence';
  fromIntent: string;
  toIntent: string;
  exampleTexts: string[];
  commonKeywords?: string[];
  avgConfidence: number;
}

export interface BulkTestResult {
  testRunId: string;
  totalTests: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  avgResponseTime: number;
  confusionMatrix: Map<string, Map<string, number>>;
  failurePatterns: FailurePattern[];
}

export class IntentClassificationLoggerService {
  private currentTestRunId: string | null = null;
  private modelVersion: string = 'v1.0.0';

  constructor(modelVersion?: string) {
    if (modelVersion) {
      this.modelVersion = modelVersion;
    }
  }

  /**
   * Start a new test run for bulk testing
   */
  startTestRun(description?: string): string {
    this.currentTestRunId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📊 Starting test run: ${this.currentTestRunId}`);
    if (description) {
      console.log(`   Description: ${description}`);
    }
    return this.currentTestRunId;
  }

  /**
   * Log a single classification with actual vs expected
   */
  async logClassification(log: ClassificationLog): Promise<void> {
    // Remove unused startTime variable

    try {
      // Use current test run ID if available
      const testRunId = log.testRunId || this.currentTestRunId;

      // Calculate slot accuracy if both expected and actual slots provided
      let slotAccuracy = null;
      if (log.expectedSlots && log.actualSlots) {
        slotAccuracy = this.calculateSlotAccuracy(log.expectedSlots, log.actualSlots);
      }

      // Insert into classification_logs table
      const { error } = await supabase
        .from('classification_logs')
        .insert({
          test_run_id: testRunId,
          input_text: log.inputText,
          expected_intent: log.expectedIntent,
          actual_intent: log.actualIntent,
          confidence_score: log.confidenceScore,
          expected_slots: log.expectedSlots,
          actual_slots: log.actualSlots,
          slot_accuracy: slotAccuracy,
          response_time_ms: log.responseTimeMs,
          model_version: this.modelVersion,
          error_message: log.errorMessage,
          metadata: log.metadata
        });

      if (error) {
        console.error('❌ Failed to log classification:', error);
        // Fall back to console logging
        this.logToConsole(log);
      } else {
        // Log summary to console
        const isCorrect = log.expectedIntent === log.actualIntent;
        const symbol = isCorrect ? '✅' : '❌';
        const confidence = (log.confidenceScore * 100).toFixed(1);
        
        console.log(`${symbol} [${log.expectedIntent} → ${log.actualIntent}] (${confidence}%) "${log.inputText.substring(0, 50)}..."`);
        
        if (!isCorrect) {
          console.log(`   ⚠️  Expected: ${log.expectedIntent}, Got: ${log.actualIntent}`);
        }
      }

      // Track failure patterns if incorrect
      if (log.actualIntent && log.expectedIntent !== log.actualIntent) {
        await this.trackFailurePattern(log);
      }

    } catch (error) {
      console.error('❌ Error in classification logging:', error);
      this.logToConsole(log);
    }
  }

  /**
   * Log multiple classifications at once
   */
  async logBulkClassifications(logs: ClassificationLog[]): Promise<BulkTestResult> {
    const testRunId = this.startTestRun(`Bulk test of ${logs.length} samples`);
    
    let correctPredictions = 0;
    let totalConfidence = 0;
    let totalResponseTime = 0;
    const confusionMatrix = new Map<string, Map<string, number>>();
    const failureExamples: ClassificationLog[] = [];

    console.log('\n' + '='.repeat(80));
    console.log(`📊 BULK CLASSIFICATION TEST - ${logs.length} samples`);
    console.log('='.repeat(80) + '\n');

    for (const log of logs) {
      log.testRunId = testRunId;
      await this.logClassification(log);

      // Track metrics
      if (log.actualIntent === log.expectedIntent) {
        correctPredictions++;
      } else {
        failureExamples.push(log);
        
        // Update confusion matrix
        if (!confusionMatrix.has(log.expectedIntent)) {
          confusionMatrix.set(log.expectedIntent, new Map());
        }
        const intentMap = confusionMatrix.get(log.expectedIntent)!;
        intentMap.set(log.actualIntent || 'unknown', (intentMap.get(log.actualIntent || 'unknown') || 0) + 1);
      }

      totalConfidence += log.confidenceScore;
      totalResponseTime += log.responseTimeMs;
    }

    // Calculate final metrics
    const accuracy = (correctPredictions / logs.length) * 100;
    const avgConfidence = totalConfidence / logs.length;
    const avgResponseTime = totalResponseTime / logs.length;

    // Identify failure patterns
    const failurePatterns = await this.analyzeFailurePatterns(failureExamples);

    // Store summary metrics
    await this.storeModelMetrics({
      testRunId,
      totalTests: logs.length,
      correctPredictions,
      accuracy,
      avgConfidence,
      avgResponseTime,
      confusionMatrix
    });

    // Print summary report
    this.printTestReport({
      testRunId,
      totalTests: logs.length,
      correctPredictions,
      accuracy,
      avgConfidence,
      avgResponseTime,
      confusionMatrix,
      failurePatterns
    });

    return {
      testRunId,
      totalTests: logs.length,
      correctPredictions,
      accuracy,
      avgConfidence,
      avgResponseTime,
      confusionMatrix,
      failurePatterns
    };
  }

  /**
   * Calculate accuracy of slot extraction
   */
  private calculateSlotAccuracy(expected: any, actual: any): number {
    const expectedKeys = Object.keys(expected);
    // Remove unused actualKeys variable
    
    if (expectedKeys.length === 0) return 100;
    
    let correctSlots = 0;
    for (const key of expectedKeys) {
      if (actual[key] && this.slotsMatch(expected[key], actual[key])) {
        correctSlots++;
      }
    }
    
    return (correctSlots / expectedKeys.length) * 100;
  }

  /**
   * Check if two slot values match
   */
  private slotsMatch(expected: any, actual: any): boolean {
    if (typeof expected !== typeof actual) return false;
    
    if (typeof expected === 'object') {
      return JSON.stringify(expected) === JSON.stringify(actual);
    }
    
    return expected === actual;
  }

  /**
   * Track failure patterns for bulk analysis
   */
  private async trackFailurePattern(log: ClassificationLog): Promise<void> {
    try {
      const { data } = await supabase
        .from('failure_patterns')
        .select('*')
        .eq('pattern_type', 'intent_confusion')
        .eq('from_intent', log.expectedIntent)
        .eq('to_intent', log.actualIntent || 'unknown')
        .single();

      if (data) {
        // Update existing pattern
        await supabase
          .from('failure_patterns')
          .update({
            failure_count: data.failure_count + 1,
            example_texts: [...(data.example_texts || []).slice(-9), log.inputText],
            avg_confidence: ((data.avg_confidence * data.failure_count) + log.confidenceScore) / (data.failure_count + 1),
            last_seen: new Date().toISOString()
          })
          .eq('id', data.id);
      } else {
        // Create new pattern
        await supabase
          .from('failure_patterns')
          .insert({
            pattern_type: 'intent_confusion',
            from_intent: log.expectedIntent,
            to_intent: log.actualIntent || 'unknown',
            failure_count: 1,
            example_texts: [log.inputText],
            avg_confidence: log.confidenceScore
          });
      }
    } catch (error) {
      console.error('Failed to track failure pattern:', error);
    }
  }

  /**
   * Analyze failure patterns from a set of failures
   */
  private async analyzeFailurePatterns(failures: ClassificationLog[]): Promise<FailurePattern[]> {
    const patterns = new Map<string, FailurePattern>();

    for (const failure of failures) {
      const key = `${failure.expectedIntent}->${failure.actualIntent}`;
      
      if (!patterns.has(key)) {
        patterns.set(key, {
          patternType: 'intent_confusion',
          fromIntent: failure.expectedIntent,
          toIntent: failure.actualIntent || 'unknown',
          exampleTexts: [],
          avgConfidence: 0
        });
      }

      const pattern = patterns.get(key)!;
      pattern.exampleTexts.push(failure.inputText);
      pattern.avgConfidence = (pattern.avgConfidence * (pattern.exampleTexts.length - 1) + failure.confidenceScore) / pattern.exampleTexts.length;
    }

    // Extract common keywords for each pattern
    for (const pattern of patterns.values()) {
      pattern.commonKeywords = this.extractCommonKeywords(pattern.exampleTexts);
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.exampleTexts.length - a.exampleTexts.length);
  }

  /**
   * Extract common keywords from failure examples
   */
  private extractCommonKeywords(texts: string[]): string[] {
    const wordFreq = new Map<string, number>();
    
    for (const text of texts) {
      const words = text.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3) { // Skip short words
          wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }
      }
    }

    return Array.from(wordFreq.entries())
      .filter(([_, freq]) => freq >= texts.length * 0.3) // Word appears in 30% of texts
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Store model metrics in database
   */
  private async storeModelMetrics(metrics: any): Promise<void> {
    try {
      const intentMetrics: any = {};
      
      // Calculate per-intent metrics
      for (const [intent, confusions] of metrics.confusionMatrix.entries()) {
        const total = Array.from(confusions.values()).reduce((sum: number, count: any) => sum + (count as number), 0);
        intentMetrics[intent] = {
          total_failures: total,
          top_confusion: Array.from(confusions.entries())
            .sort((a: any, b: any) => b[1] - a[1])[0]
        };
      }

      await supabase
        .from('model_metrics')
        .insert({
          model_version: this.modelVersion,
          total_tests: metrics.totalTests,
          correct_predictions: metrics.correctPredictions,
          accuracy_percentage: metrics.accuracy,
          avg_confidence: metrics.avgConfidence,
          avg_response_time_ms: metrics.avgResponseTime,
          intent_metrics: intentMetrics,
          confusion_summary: Object.fromEntries(metrics.confusionMatrix)
        });
    } catch (error) {
      console.error('Failed to store model metrics:', error);
    }
  }

  /**
   * Print detailed test report to console
   */
  private printTestReport(result: BulkTestResult): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Overall Metrics:`);
    console.log(`   Total Tests: ${result.totalTests}`);
    console.log(`   Correct: ${result.correctPredictions}/${result.totalTests}`);
    console.log(`   Accuracy: ${result.accuracy.toFixed(2)}%`);
    console.log(`   Avg Confidence: ${(result.avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Avg Response Time: ${result.avgResponseTime.toFixed(0)}ms`);

    if (result.confusionMatrix.size > 0) {
      console.log(`\n❌ Confusion Matrix (Failures):`);
      for (const [expected, confusions] of result.confusionMatrix.entries()) {
        for (const [actual, count] of confusions.entries()) {
          console.log(`   ${expected} → ${actual}: ${count} times`);
        }
      }
    }

    if (result.failurePatterns.length > 0) {
      console.log(`\n🔍 Top Failure Patterns:`);
      for (const pattern of result.failurePatterns.slice(0, 5)) {
        console.log(`   ${pattern.fromIntent} → ${pattern.toIntent} (${pattern.exampleTexts.length} failures)`);
        if (pattern.commonKeywords && pattern.commonKeywords.length > 0) {
          console.log(`      Common words: ${pattern.commonKeywords.join(', ')}`);
        }
        console.log(`      Example: "${pattern.exampleTexts?.[0]?.substring(0, 60) || 'N/A'}..."`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`Test Run ID: ${result.testRunId}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Fallback console logging when database is unavailable
   */
  private logToConsole(log: ClassificationLog): void {
    const isCorrect = log.expectedIntent === log.actualIntent;
    const symbol = isCorrect ? '✅' : '❌';
    
    console.log(`[CONSOLE LOG] ${symbol} Classification:`);
    console.log(`  Input: "${log.inputText}"`);
    console.log(`  Expected: ${log.expectedIntent}`);
    console.log(`  Actual: ${log.actualIntent}`);
    console.log(`  Confidence: ${(log.confidenceScore * 100).toFixed(1)}%`);
    console.log(`  Response Time: ${log.responseTimeMs}ms`);
    
    if (log.errorMessage) {
      console.log(`  Error: ${log.errorMessage}`);
    }
  }

  /**
   * Get failure analysis for retraining
   */
  async getFailuresForRetraining(limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('classification_logs')
        .select('*')
        .eq('is_correct', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Add to training queue
      if (data && data.length > 0) {
        const trainingData = data.map((log: any) => ({
          text: log.input_text,
          correct_intent: log.expected_intent,
          correct_slots: log.expected_slots,
          source: 'test_failure',
          priority: log.confidence_score < 0.5 ? 8 : 5
        }));

        await supabase
          .from('training_queue')
          .insert(trainingData);

        console.log(`📚 Added ${data.length} failures to training queue`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get failures for retraining:', error);
      return [];
    }
  }
}

export default ClassificationLogger;