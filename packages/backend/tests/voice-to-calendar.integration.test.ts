/**
 * Voice to Calendar Integration Test
 * End-to-end test for voice command to calendar event creation
 */

import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

describe('Voice to Calendar Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Voice Command Flow', () => {
    it('should process voice command through entire pipeline', async () => {
      const voiceCommand = {
        audio: null, // Would be audio buffer in real scenario
        text: "Schedule team meeting tomorrow at 2pm for one hour",
        userId: "demo-user"
      };

      // Step 1: Process voice command
      const response = await request(app.server)
        .post('/api/voice/command')
        .send(voiceCommand)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        intent: 'create_event',
        event: expect.objectContaining({
          id: expect.any(String),
          title: expect.stringContaining('team meeting'),
          start_time: expect.any(String),
          end_time: expect.any(String),
          user_id: 'demo-user'
        }),
        spokenResponse: expect.any(String)
      });

      // Step 2: Verify event was created
      const eventId = response.body.event.id;
      const getResponse = await request(app.server)
        .get(`/api/calendar/events/${eventId}`)
        .expect(200);

      expect(getResponse.body.event).toMatchObject({
        id: eventId,
        title: expect.stringContaining('team meeting')
      });
    });

    it('should handle voice command with natural language variations', async () => {
      const variations = [
        "Can you schedule a meeting tomorrow at 3?",
        "I need to book the conference room for 2pm tomorrow",
        "Add a dentist appointment to my calendar for next Monday at 10am",
        "Put lunch with Sarah on my calendar for tomorrow noon",
        "Block out 4 to 5pm today for project review"
      ];

      for (const text of variations) {
        const response = await request(app.server)
          .post('/api/voice/command')
          .send({ text, userId: "demo-user" })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.intent).toBe('create_event');
        expect(response.body.event).toBeDefined();
      }
    });

    it('should provide appropriate voice feedback for errors', async () => {
      const invalidCommand = {
        text: "Schedule meeting in the past yesterday at 3pm",
        userId: "demo-user"
      };

      const response = await request(app.server)
        .post('/api/voice/command')
        .send(invalidCommand)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('past'),
        spokenResponse: expect.stringMatching(/can't schedule.*past/i)
      });
    });
  });

  describe('Command Endpoint with Intent Classification', () => {
    it('should use intent service for command processing', async () => {
      const response = await request(app.server)
        .post('/api/command')
        .send({
          command: "Book meeting room for tomorrow 3pm",
          type: "auto"
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        intent: 'create_event',
        confidence: expect.any(Number),
        event: expect.objectContaining({
          title: expect.any(String),
          start_time: expect.any(String)
        })
      });
    });

    it('should handle ambiguous commands with confirmation', async () => {
      const response = await request(app.server)
        .post('/api/command')
        .send({
          command: "Meeting maybe Tuesday or Wednesday",
          type: "auto"
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        needsConfirmation: true,
        options: expect.arrayContaining([
          expect.objectContaining({ date: expect.any(String) })
        ])
      });
    });
  });

  describe('Mobile App Integration', () => {
    it('should handle chat-style voice commands', async () => {
      const chatMessage = {
        conversationId: "conv-123",
        message: {
          text: "Schedule standup tomorrow at 9am",
          isVoice: true,
          userId: "demo-user"
        }
      };

      const response = await request(app.server)
        .post('/api/chat/message')
        .send(chatMessage)
        .expect(200);

      expect(response.body).toMatchObject({
        reply: {
          text: expect.stringContaining('scheduled'),
          isVoice: true,
          audioUrl: expect.any(String) // TTS audio URL
        },
        action: {
          type: 'calendar_event_created',
          data: expect.objectContaining({
            eventId: expect.any(String)
          })
        }
      });
    });

    it('should maintain conversation context', async () => {
      const conversationId = "conv-456";

      // First message
      await request(app.server)
        .post('/api/chat/message')
        .send({
          conversationId,
          message: {
            text: "Schedule a meeting tomorrow",
            userId: "demo-user"
          }
        })
        .expect(200);

      // Follow-up with more details
      const response = await request(app.server)
        .post('/api/chat/message')
        .send({
          conversationId,
          message: {
            text: "Make it at 3pm for 2 hours",
            userId: "demo-user"
          }
        })
        .expect(200);

      expect(response.body.action.data).toMatchObject({
        eventUpdated: true,
        duration_minutes: 120
      });
    });
  });

  describe('Learning and Improvement', () => {
    it('should learn from corrections', async () => {
      // Initial command
      const response1 = await request(app.server)
        .post('/api/command')
        .send({
          command: "Weekly sync tomorrow",
          type: "auto"
        })
        .expect(200);

      const predictionId = response1.body.predictionId;

      // User correction
      await request(app.server)
        .post('/api/intent/correct')
        .send({
          predictionId,
          correctedIntent: 'create_event',
          correctedSlots: {
            title: 'Weekly Team Sync',
            recurring: 'weekly'
          }
        })
        .expect(200);

      // Same command should now work better
      const response2 = await request(app.server)
        .post('/api/command')
        .send({
          command: "Weekly sync tomorrow",
          type: "auto"
        })
        .expect(200);

      expect(response2.body.event.title).toBe('Weekly Team Sync');
      expect(response2.body.event.recurring).toBe('weekly');
    });
  });
});