#!/usr/bin/env node
/**
 * Get RAW LLM output to see EXACTLY what we need to parse
 */

import { UnifiedLLMService } from '../services/unified-llm-service';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function getRawOutput() {
  const llmService = new UnifiedLLMService();
  
  const systemPrompt = `You are an intent classifier for a personal assistant.
    Classify the user's request into one of these intents:
    - create_event: scheduling calendar events, meetings, appointments
    - add_reminder: setting reminders, alerts, notifications
    - create_note: taking notes, saving thoughts, documenting
    - read_email: checking, reading, searching emails
    - send_email: composing, sending, replying to emails
    - none: anything else
    
    Also extract relevant slots:
    - title: event/reminder/note title
    - datetime_point: specific date/time (ISO-8601)
    - datetime_range: start and end times
    - duration_min: duration in minutes
    - email_to: recipient emails
    - email_subject: email subject
    - email_body: email content
    - note_body: note content
    - reminder_text: what to be reminded about
    
    Respond in JSON format:
    {
      "intent": "string",
      "confidence": 0.0-1.0,
      "slots": {}
    }`;

  const testInputs = [
    "Schedule a meeting with John tomorrow at 3pm",
    "Remind me to call mom in 2 hours"
  ];

  for (const input of testInputs) {
    console.log('\n' + '='.repeat(80));
    console.log(`INPUT: "${input}"`);
    console.log('='.repeat(80));
    
    try {
      const response = await llmService.generateCompletion({
        prompt: `Classify this request: "${input}"`,
        systemPrompt,
        responseFormat: 'json',
        complexity: 'low',
        maxTokens: 200
      });
      
      console.log('\nPROVIDER:', response.provider);
      console.log('\nRAW CONTENT (exact string):');
      console.log('---START---');
      console.log(response.content);
      console.log('---END---');
      
      console.log('\nRAW CONTENT (with escape chars visible):');
      console.log(JSON.stringify(response.content));
      
      console.log('\nCONTENT LENGTH:', response.content.length);
      console.log('CONTENT TYPE:', typeof response.content);
      
    } catch (error: any) {
      console.error('ERROR:', error.message);
    }
  }
}

getRawOutput().catch(console.error);