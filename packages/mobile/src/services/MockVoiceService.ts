// Mock Voice Service for Fast Development Testing
export class MockVoiceService {
  private testCommands = [
    "Schedule a meeting tomorrow at 3pm",
    "Take a photo",
    "Turn on flashlight",
    "Remind me to call mom",
    "Open settings"
  ];

  private commandIndex = 0;

  async startListening(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const command = this.testCommands[this.commandIndex];
    this.commandIndex = (this.commandIndex + 1) % this.testCommands.length;
    console.log(`Mock Voice: "${command}"`);
    return command;
  }

  async stopListening(): Promise<void> {
    console.log("Mock Voice: Stopped");
  }
}
