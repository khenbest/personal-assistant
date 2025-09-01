import { FastifyPluginAsync } from 'fastify';
// import FormData from 'form-data';
// import fetch from 'node-fetch';

const transcribeRoutes: FastifyPluginAsync = async (fastify) => {
  // Transcribe audio using OpenAI Whisper API (if you have OpenAI key)
  // Or use a free alternative like Assembly AI
  fastify.post('/api/transcribe', async (request, reply) => {
    try {
      const data = await (request as any).file();
      
      if (!data) {
        return reply.code(400).send({ error: 'No audio file provided' });
      }

      // For now, return a mock transcription
      // In production, you would send this to Whisper API or similar
      const mockTranscriptions = [
        "What's on my calendar today?",
        "Schedule a meeting for tomorrow at 3pm",
        "Create a task to review the project proposal",
        "Remind me to call the team at 5pm",
        "What's the weather like today?",
      ];

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        text: mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)],
        confidence: 0.95,
      };

      // Real Whisper implementation (requires OpenAI API key):
      /*
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const formData = new FormData();
      formData.append('file', data.file, data.filename);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      });

      const result = await response.json();
      return { text: result.text, confidence: 1.0 };
      */
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Failed to transcribe audio',
        text: "I couldn't understand that. Please try again.",
      });
    }
  });
};

export default transcribeRoutes;