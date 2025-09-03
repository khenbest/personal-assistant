#!/usr/bin/env node
/**
 * Generate Training Data using LLM
 * Creates 500+ diverse examples for intent classification
 */

import { UnifiedLLMService } from '../services/unified-llm-service';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface TrainingExample {
  text: string;
  intent: string;
  category?: string;
}

class LLMTrainingDataGenerator {
  private llmService: UnifiedLLMService;
  private intents = ['create_event', 'add_reminder', 'create_note', 'read_email', 'send_email'];
  
  constructor() {
    this.llmService = new UnifiedLLMService();
  }

  /**
   * Generate diverse examples for a specific intent
   */
  async generateIntentExamples(intent: string, count: number = 100): Promise<string[]> {
    console.log(`\n🤖 Generating ${count} examples for ${intent}...`);
    
    const intentDescriptions: { [key: string]: string } = {
      'create_event': 'scheduling meetings, appointments, calendar events, bookings, reservations',
      'add_reminder': 'setting reminders, alerts, notifications, pings, don\'t forget tasks',
      'create_note': 'taking notes, writing down thoughts, recording information, saving ideas',
      'read_email': 'checking emails, reading messages, viewing inbox, email queries',
      'send_email': 'sending emails, composing messages, replying, forwarding, email communication'
    };

    const prompt = `Generate ${count} diverse user commands for the intent "${intent}".
    This intent is about: ${intentDescriptions[intent]}
    
    Include a variety of:
    - Casual and formal language
    - Short and long commands
    - Different phrasings and synonyms
    - Common misspellings (10% of examples)
    - Time references (tomorrow, next week, in 2 hours, etc.)
    - Different contexts (business, personal, medical, etc.)
    
    Return ONLY a JSON array of strings, no explanation.
    Example format: ["command 1", "command 2", ...]`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt,
        responseFormat: 'json',
        maxTokens: 4000,
        complexity: 'medium'
      });

      let examples: string[];
      
      // Handle different response formats
      if (typeof response.content === 'string') {
        try {
          examples = JSON.parse(response.content);
        } catch {
          // If parsing fails, try to extract array from the response
          const match = response.content.match(/\[[\s\S]*\]/);
          if (match) {
            examples = JSON.parse(match[0]);
          } else {
            console.error('Failed to parse LLM response');
            return [];
          }
        }
      } else if (Array.isArray(response.content)) {
        examples = response.content;
      } else {
        examples = [];
      }

      console.log(`   ✅ Generated ${examples.length} examples`);
      return examples.slice(0, count); // Ensure we don't exceed requested count
      
    } catch (error) {
      console.error(`   ❌ Error generating examples for ${intent}:`, error);
      return [];
    }
  }

  /**
   * Generate ambiguous examples that could be multiple intents
   */
  async generateAmbiguousExamples(count: number = 50): Promise<TrainingExample[]> {
    console.log(`\n🤔 Generating ${count} ambiguous examples...`);
    
    const prompt = `Generate ${count} ambiguous user commands that could be interpreted as either:
    - create_event (scheduling) OR add_reminder (alerts)
    - create_note (saving info) OR send_email (communication)
    
    These should be genuinely ambiguous where context would be needed.
    
    Return as JSON array with format:
    [
      {"text": "command", "primary_intent": "most_likely_intent", "secondary_intent": "alternative_intent"},
      ...
    ]`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt,
        responseFormat: 'json',
        maxTokens: 3000,
        complexity: 'medium'
      });

      let ambiguousData: any[];
      if (typeof response.content === 'string') {
        ambiguousData = JSON.parse(response.content);
      } else {
        ambiguousData = response.content;
      }

      // Convert to training examples (using primary intent as the "correct" one)
      const examples: TrainingExample[] = ambiguousData.map(item => ({
        text: item.text,
        intent: item.primary_intent,
        category: 'ambiguous'
      }));

      console.log(`   ✅ Generated ${examples.length} ambiguous examples`);
      return examples.slice(0, count);
      
    } catch (error) {
      console.error('   ❌ Error generating ambiguous examples:', error);
      return [];
    }
  }

  /**
   * Generate edge cases and difficult examples
   */
  async generateEdgeCases(count: number = 50): Promise<TrainingExample[]> {
    console.log(`\n🔧 Generating ${count} edge cases...`);
    
    const prompt = `Generate ${count} edge case commands for intent classification including:
    - Very short commands (2-3 words)
    - Commands with typos and misspellings
    - Mixed intent commands (do multiple things)
    - Incomplete commands
    - Commands with unusual phrasing
    
    Return as JSON array with format:
    [
      {"text": "command", "intent": "correct_intent", "edge_type": "type_of_edge_case"},
      ...
    ]
    
    Use these intents: create_event, add_reminder, create_note, read_email, send_email`;

    try {
      const response = await this.llmService.generateCompletion({
        prompt,
        responseFormat: 'json',
        maxTokens: 3000,
        complexity: 'medium'
      });

      let edgeCaseData: any[];
      if (typeof response.content === 'string') {
        edgeCaseData = JSON.parse(response.content);
      } else {
        edgeCaseData = response.content;
      }

      const examples: TrainingExample[] = edgeCaseData.map(item => ({
        text: item.text,
        intent: item.intent,
        category: 'edge_case'
      }));

      console.log(`   ✅ Generated ${examples.length} edge cases`);
      return examples.slice(0, count);
      
    } catch (error) {
      console.error('   ❌ Error generating edge cases:', error);
      return [];
    }
  }

  /**
   * Generate all training data
   */
  async generateAllTrainingData(): Promise<TrainingExample[]> {
    const allExamples: TrainingExample[] = [];
    
    console.log('🚀 Starting LLM Training Data Generation');
    console.log('=' .repeat(50));

    // Generate 100 examples for each intent
    for (const intent of this.intents) {
      const examples = await this.generateIntentExamples(intent, 100);
      examples.forEach(text => {
        allExamples.push({ text, intent, category: 'standard' });
      });
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate ambiguous examples
    const ambiguousExamples = await this.generateAmbiguousExamples(50);
    allExamples.push(...ambiguousExamples);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate edge cases
    const edgeCases = await this.generateEdgeCases(50);
    allExamples.push(...edgeCases);

    return allExamples;
  }

  /**
   * Save training data to files
   */
  saveTrainingData(examples: TrainingExample[], baseFilename: string): void {
    const dataDir = path.join(__dirname, '../../../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save as JSON
    const jsonPath = path.join(dataDir, `${baseFilename}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(examples, null, 2));
    console.log(`\n✅ Saved JSON: ${jsonPath}`);

    // Save as CSV
    const csvPath = path.join(dataDir, `${baseFilename}.csv`);
    const csvContent = this.convertToCSV(examples);
    fs.writeFileSync(csvPath, csvContent);
    console.log(`✅ Saved CSV: ${csvPath}`);

    // Save a separate file with just text and intent for easy training
    const simpleCsvPath = path.join(dataDir, `${baseFilename}_simple.csv`);
    const simpleCsv = ['text,intent', ...examples.map(e => 
      `"${e.text.replace(/"/g, '""')}",${e.intent}`
    )].join('\n');
    fs.writeFileSync(simpleCsvPath, simpleCsv);
    console.log(`✅ Saved Simple CSV: ${simpleCsvPath}`);
  }

  /**
   * Convert to CSV format
   */
  private convertToCSV(examples: TrainingExample[]): string {
    const headers = ['text', 'intent', 'category'];
    const rows = examples.map(e => [
      `"${e.text.replace(/"/g, '""')}"`,
      e.intent,
      e.category || 'standard'
    ]);
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Print summary statistics
   */
  printSummary(examples: TrainingExample[]): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Training Data Generation Summary');
    console.log('='.repeat(50));
    
    // Count by intent
    const intentCounts: { [key: string]: number } = {};
    const categoryCounts: { [key: string]: number } = {};
    
    examples.forEach(e => {
      intentCounts[e.intent] = (intentCounts[e.intent] || 0) + 1;
      categoryCounts[e.category || 'standard'] = (categoryCounts[e.category || 'standard'] || 0) + 1;
    });

    console.log('\n📈 By Intent:');
    Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([intent, count]) => {
        const percentage = ((count / examples.length) * 100).toFixed(1);
        console.log(`   ${intent}: ${count} (${percentage}%)`);
      });

    console.log('\n📂 By Category:');
    Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const percentage = ((count / examples.length) * 100).toFixed(1);
        console.log(`   ${category}: ${count} (${percentage}%)`);
      });

    console.log(`\n✨ Total Examples: ${examples.length}`);
    console.log('='.repeat(50));
  }
}

// Main execution
async function main() {
  const generator = new LLMTrainingDataGenerator();
  
  try {
    // Generate all training data
    const trainingExamples = await generator.generateAllTrainingData();
    
    if (trainingExamples.length === 0) {
      console.error('❌ No training examples generated. Check LLM service configuration.');
      process.exit(1);
    }

    // Save to files
    const timestamp = new Date().toISOString().split('T')[0];
    generator.saveTrainingData(trainingExamples, `llm_training_data_${timestamp}`);
    
    // Print summary
    generator.printSummary(trainingExamples);
    
    console.log('\n🎉 Training data generation complete!');
    console.log('   Use the generated files to train and test your intent classifier.');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { LLMTrainingDataGenerator };