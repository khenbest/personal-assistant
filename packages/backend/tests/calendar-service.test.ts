/**
 * Calendar Service Test Suite
 * Tests for calendar event creation from voice commands
 */

import { CalendarService } from '../src/services/calendar-service';
import { IntentService } from '../src/services/intent-service';
import { UnifiedLLMService } from '../src/services/unified-llm-service';
import { supabase } from '../src/db/supabase';

// Mock Supabase
jest.mock('../src/db/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn()
            }))
          }))
        }))
      }))
    }))
  }
}));

describe('CalendarService', () => {
  let calendarService: CalendarService;
  let intentService: IntentService;
  let llmService: UnifiedLLMService;

  beforeEach(() => {
    llmService = new UnifiedLLMService();
    intentService = new IntentService(llmService);
    calendarService = new CalendarService(intentService);
    jest.clearAllMocks();
  });

  describe('Voice Command Processing', () => {
    it('should create event from simple voice command', async () => {
      const voiceCommand = "Schedule a meeting tomorrow at 3pm";
      
      const result = await calendarService.processVoiceCommand(voiceCommand);
      
      expect(result).toMatchObject({
        success: true,
        event: expect.objectContaining({
          title: expect.stringContaining('meeting'),
          start_time: expect.any(String),
          end_time: expect.any(String)
        }),
        message: expect.stringContaining('scheduled')
      });
    });

    it('should handle voice command with duration', async () => {
      const voiceCommand = "Book conference room for 2 hours tomorrow at 2pm";
      
      const result = await calendarService.processVoiceCommand(voiceCommand);
      
      expect(result.event).toMatchObject({
        title: expect.stringContaining('conference room'),
        duration_minutes: 120
      });
      
      // Verify end time is 2 hours after start
      const start = new Date(result.event!.start_time);
      const end = new Date(result.event!.end_time);
      expect(end.getTime() - start.getTime()).toBe(2 * 60 * 60 * 1000);
    });

    it('should extract location from voice command', async () => {
      const voiceCommand = "Schedule lunch at Cafe Milano tomorrow at noon";
      
      const result = await calendarService.processVoiceCommand(voiceCommand);
      
      expect(result.event).toMatchObject({
        title: expect.stringContaining('lunch'),
        location: 'Cafe Milano'
      });
    });

    it('should handle recurring events', async () => {
      const voiceCommand = "Schedule weekly team standup every Monday at 9am";
      
      const result = await calendarService.processVoiceCommand(voiceCommand);
      
      expect(result.event).toMatchObject({
        title: expect.stringContaining('team standup'),
        recurring: 'weekly:monday'
      });
    });

    it('should handle attendees in voice command', async () => {
      const voiceCommand = "Schedule meeting with john@example.com and sarah@example.com tomorrow at 4pm";
      
      const result = await calendarService.processVoiceCommand(voiceCommand);
      
      expect(result.event!.attendees).toEqual(
        expect.arrayContaining(['john@example.com', 'sarah@example.com'])
      );
    });
  });

  describe('Intent Classification Integration', () => {
    it('should correctly classify calendar creation intent', async () => {
      const commands = [
        "Schedule a meeting tomorrow",
        "Book an appointment next Friday",
        "Add calendar event for lunch",
        "Create a meeting at 3pm"
      ];

      for (const command of commands) {
        const intent = await intentService.classifyIntent(command);
        expect(intent.intent).toBe('create_event');
        expect(intent.confidence).toBeGreaterThan(0.6);
      }
    });

    it('should reject non-calendar intents', async () => {
      const command = "Send email to john about the project";
      
      const result = await calendarService.processVoiceCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a calendar command');
    });
  });

  describe('Slot Extraction', () => {
    it('should extract all relevant slots from complex command', async () => {
      const command = "Schedule project review meeting tomorrow from 2pm to 4pm at Conference Room A with the engineering team";
      
      const slots = await calendarService.extractEventSlots(command);
      
      expect(slots).toMatchObject({
        title: 'project review meeting',
        datetime_range: {
          start: expect.any(String),
          end: expect.any(String)
        },
        location: 'Conference Room A',
        attendees: expect.arrayContaining(['engineering team'])
      });
    });

    it('should apply smart defaults for missing slots', async () => {
      const command = "Schedule dentist appointment tomorrow";
      
      const slots = await calendarService.extractEventSlots(command);
      
      expect(slots).toMatchObject({
        title: 'dentist appointment',
        duration_min: 60, // Default duration
        datetime_point: expect.any(String)
      });
    });
  });

  describe('Database Integration', () => {
    it('should save event to Supabase', async () => {
      const mockInsert = jest.fn().mockResolvedValue({
        data: { id: 'event-123', title: 'Test Event' },
        error: null
      });
      
      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert
      });

      const command = "Schedule test meeting tomorrow at 3pm";
      await calendarService.processVoiceCommand(command);
      
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'demo-user',
          title: expect.stringContaining('meeting')
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const command = "Schedule meeting tomorrow";
      const result = await calendarService.processVoiceCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save event');
    });
  });

  describe('Response Generation', () => {
    it('should generate friendly confirmation message', async () => {
      const command = "Schedule team lunch tomorrow at noon";
      const result = await calendarService.processVoiceCommand(command);
      
      expect(result.message).toMatch(/scheduled|created|added/i);
      expect(result.message).toContain('team lunch');
      expect(result.spokenResponse).toBeTruthy();
    });

    it('should provide voice-optimized response', async () => {
      const command = "Schedule meeting tomorrow at 3:30pm";
      const result = await calendarService.processVoiceCommand(command);
      
      // Voice response should be natural and concise
      expect(result.spokenResponse).toMatch(/I've scheduled your meeting/i);
      expect(result.spokenResponse.length).toBeLessThan(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle ambiguous dates', async () => {
      const command = "Schedule meeting next Tuesday or Wednesday";
      const result = await calendarService.processVoiceCommand(command);
      
      expect(result.needsConfirmation).toBe(true);
      expect(result.clarification).toContain('Which day');
    });

    it('should handle past dates', async () => {
      const command = "Schedule meeting yesterday at 3pm";
      const result = await calendarService.processVoiceCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('past date');
    });

    it('should handle very long event titles', async () => {
      const longTitle = "Schedule " + "very ".repeat(50) + "important meeting tomorrow";
      const result = await calendarService.processVoiceCommand(longTitle);
      
      expect(result.event!.title.length).toBeLessThanOrEqual(255);
    });
  });
});