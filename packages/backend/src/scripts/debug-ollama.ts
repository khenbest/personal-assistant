import { ollamaService } from '../services/ollama-service';

(async () => {
  console.log('Testing Ollama connection...\n');
  
  // Test raw API
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json() as { models: Array<{ name: string }> };
    console.log('✅ Raw API works!');
    console.log('Available models:', data.models.map((m) => m.name).join(', '));
  } catch (error) {
    console.error('❌ Raw API failed:', error);
  }
  
  console.log('\nTesting OllamaService...');
  
  // Test our service
  const health = await ollamaService.checkHealth();
  console.log('Health check result:', health);
  console.log('Status:', ollamaService.getStatus());
  
  if (health) {
    console.log('\n✅ OllamaService is healthy! Testing generation...');
    
    try {
      const response = await ollamaService.generateOllamaCompletion({
        prompt: 'Say "hello" and nothing else.',
        maxTokens: 10,
        temperature: 0.1
      });
      
      console.log('Generation successful!');
      console.log('Model used:', response.model);
      console.log('Response:', response.content);
      console.log('Time:', response.responseTime, 'ms');
    } catch (error) {
      console.error('Generation failed:', error);
    }
  }
})();