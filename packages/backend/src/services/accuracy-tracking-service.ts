/**
 * Accuracy Tracking Service
 * Logs predictions, corrections, and calculates accuracy metrics
 */

import { supabase } from '../db/supabase';

export interface IntentPrediction {
  id?: string;
  original_text: string;
  predicted_intent: string;
  predicted_confidence: number;
  predicted_slots?: any;
  model_version?: string;
  response_time_ms?: number;
  timestamp?: string;
}

export interface IntentCorrection {
  id?: string;
  prediction_id?: string;
  user_id?: string;
  original_text: string;
  predicted_intent?: string;
  predicted_confidence?: number;
  predicted_slots?: any;
  corrected_intent: string;
  corrected_slots?: any;
  correction_type?: string;
  model_version?: string;
  applied_immediately?: boolean;
}

export interface ClassificationLog {
  id?: string;
  test_run_id?: string;
  input_text: string;
  expected_intent: string;
  actual_intent?: string;
  confidence_score?: number;
  expected_slots?: any;
  actual_slots?: any;
  slot_accuracy?: number;
  response_time_ms?: number;
  model_version?: string;
  error_message?: string;
  metadata?: any;
}

export class AccuracyTrackingService {
  private isEnabled: boolean;

  constructor() {
    // Only enable if Supabase is configured
    this.isEnabled = !!supabase;
    if (!this.isEnabled) {
      console.warn('⚠️ AccuracyTrackingService: Supabase not configured, tracking disabled');
    }
  }

  /**
   * Log a prediction made by the intent classifier
   */
  async logPrediction(prediction: IntentPrediction): Promise<string | null> {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await supabase
        .from('intent_predictions')
        .insert({
          original_text: prediction.original_text,
          predicted_intent: prediction.predicted_intent,
          predicted_confidence: prediction.predicted_confidence,
          predicted_slots: prediction.predicted_slots,
          model_version: prediction.model_version || 'v1',
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to log prediction:', error);
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Error logging prediction:', error);
      return null;
    }
  }

  /**
   * Log a user correction to a prediction
   */
  async logCorrection(correction: IntentCorrection): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const { error } = await supabase
        .from('intent_corrections')
        .insert({
          prediction_id: correction.prediction_id,
          user_id: correction.user_id || 'anonymous',
          original_text: correction.original_text,
          predicted_intent: correction.predicted_intent,
          predicted_confidence: correction.predicted_confidence,
          predicted_slots: correction.predicted_slots,
          corrected_intent: correction.corrected_intent,
          corrected_slots: correction.corrected_slots,
          correction_type: correction.correction_type || 'manual',
          model_version: correction.model_version || 'v1',
          applied_immediately: correction.applied_immediately || false,
        });

      if (error) {
        console.error('Failed to log correction:', error);
        return false;
      }

      // Also add to training queue for future improvements
      await this.addToTrainingQueue(
        correction.original_text,
        correction.corrected_intent,
        correction.corrected_slots
      );

      return true;
    } catch (error) {
      console.error('Error logging correction:', error);
      return false;
    }
  }

  /**
   * Log a classification for testing/evaluation
   */
  async logClassification(log: ClassificationLog): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const { error } = await supabase
        .from('classification_logs')
        .insert({
          test_run_id: log.test_run_id,
          input_text: log.input_text,
          expected_intent: log.expected_intent,
          actual_intent: log.actual_intent,
          confidence_score: log.confidence_score,
          expected_slots: log.expected_slots,
          actual_slots: log.actual_slots,
          slot_accuracy: log.slot_accuracy,
          response_time_ms: log.response_time_ms,
          model_version: log.model_version || 'v1',
          error_message: log.error_message,
          metadata: log.metadata,
        });

      if (error) {
        console.error('Failed to log classification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error logging classification:', error);
      return false;
    }
  }

  /**
   * Add a training example to the queue
   */
  async addToTrainingQueue(
    text: string,
    correctIntent: string,
    correctSlots?: any,
    priority: number = 5
  ): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const { error } = await supabase
        .from('training_queue')
        .insert({
          text,
          correct_intent: correctIntent,
          correct_slots: correctSlots,
          source: 'user_correction',
          priority,
          processed: false,
        });

      if (error) {
        console.error('Failed to add to training queue:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding to training queue:', error);
      return false;
    }
  }

  /**
   * Get accuracy metrics for a specific time period
   */
  async getAccuracyMetrics(hours: number = 24): Promise<any> {
    if (!this.isEnabled) return null;

    try {
      // Query recent classification logs
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('classification_logs')
        .select('*')
        .gte('created_at', since);

      if (error) {
        console.error('Failed to get metrics:', error);
        return null;
      }

      // Calculate metrics
      const total = data.length;
      const correct = data.filter(d => d.expected_intent === d.actual_intent).length;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;

      // Group by intent
      const byIntent: { [key: string]: { total: number; correct: number } } = {};
      data.forEach(log => {
        const intent = log.expected_intent;
        if (!byIntent[intent]) {
          byIntent[intent] = { total: 0, correct: 0 };
        }
        byIntent[intent].total++;
        if (log.expected_intent === log.actual_intent) {
          byIntent[intent].correct++;
        }
      });

      // Calculate per-intent accuracy
      const intentAccuracy: { [key: string]: number } = {};
      Object.keys(byIntent).forEach(intent => {
        intentAccuracy[intent] = (byIntent[intent].correct / byIntent[intent].total) * 100;
      });

      return {
        total_predictions: total,
        correct_predictions: correct,
        overall_accuracy: accuracy.toFixed(2),
        intent_accuracy: intentAccuracy,
        time_period_hours: hours,
        calculated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting accuracy metrics:', error);
      return null;
    }
  }

  /**
   * Get recent failures for analysis
   */
  async getRecentFailures(limit: number = 10): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('classification_logs')
        .select('*')
        .neq('expected_intent', 'actual_intent')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get failures:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting failures:', error);
      return [];
    }
  }

  /**
   * Get confusion matrix data
   */
  async getConfusionMatrix(): Promise<any[]> {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from('intent_confusion_matrix')
        .select('*')
        .order('count', { ascending: false });

      if (error) {
        console.error('Failed to get confusion matrix:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting confusion matrix:', error);
      return [];
    }
  }
}

// Export singleton instance
export const accuracyTracker = new AccuracyTrackingService();