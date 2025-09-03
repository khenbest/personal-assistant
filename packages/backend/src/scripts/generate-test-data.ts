/**
 * Generate Test Data with Expected Classifications
 * Creates comprehensive test cases with expected intents for validation
 */

import fs from 'fs';
import path from 'path';

export interface TestCase {
  text: string;
  expectedIntent: string;
  expectedSlots?: any;
  category?: string; // 'standard', 'edge_case', 'ambiguous'
}

export class TestDataGenerator {
  
  /**
   * Generate comprehensive test data for all intents
   */
  static generateTestData(): TestCase[] {
    const testCases: TestCase[] = [];

    // Create Event Test Cases
    testCases.push(...this.generateEventTests());
    
    // Add Reminder Test Cases
    testCases.push(...this.generateReminderTests());
    
    // Create Note Test Cases
    testCases.push(...this.generateNoteTests());
    
    // Read Email Test Cases
    testCases.push(...this.generateReadEmailTests());
    
    // Send Email Test Cases
    testCases.push(...this.generateSendEmailTests());
    
    // Edge Cases and Ambiguous Examples
    testCases.push(...this.generateEdgeCases());

    return testCases;
  }

  /**
   * Generate test cases for create_event intent
   */
  private static generateEventTests(): TestCase[] {
    return [
      // Standard cases
      {
        text: "Schedule a meeting with John tomorrow at 3pm",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "meeting with John",
          date: "tomorrow",
          time: "3pm",
          attendees: ["John"]
        },
        category: "standard"
      },
      {
        text: "Add team standup to my calendar for Monday at 10am",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "team standup",
          date: "Monday",
          time: "10am"
        },
        category: "standard"
      },
      {
        text: "Book conference room for project review next Friday 2-4pm",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "project review",
          date: "next Friday",
          time: "2-4pm",
          location: "conference room"
        },
        category: "standard"
      },
      {
        text: "Set up a call with Sarah at 11:30 tomorrow morning",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "call with Sarah",
          date: "tomorrow",
          time: "11:30 morning",
          attendees: ["Sarah"]
        },
        category: "standard"
      },
      {
        text: "Create an appointment for dentist on March 15th at 2:30",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "dentist appointment",
          date: "March 15th",
          time: "2:30"
        },
        category: "standard"
      },
      // Complex cases
      {
        text: "Schedule recurring weekly team sync every Tuesday at 9am starting next week",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "team sync",
          recurring: "weekly",
          day: "Tuesday",
          time: "9am",
          startDate: "next week"
        },
        category: "complex"
      },
      {
        text: "Plan lunch with Mike and Jessica at Italian restaurant downtown tomorrow noon",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "lunch with Mike and Jessica",
          date: "tomorrow",
          time: "noon",
          location: "Italian restaurant downtown",
          attendees: ["Mike", "Jessica"]
        },
        category: "complex"
      }
    ];
  }

  /**
   * Generate test cases for add_reminder intent
   */
  private static generateReminderTests(): TestCase[] {
    return [
      // Standard cases
      {
        text: "Remind me to call mom in 2 hours",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "call mom",
          duration: "2 hours"
        },
        category: "standard"
      },
      {
        text: "Set a reminder to take medicine at 8pm",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "take medicine",
          time: "8pm"
        },
        category: "standard"
      },
      {
        text: "Alert me to submit the report by Friday",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "submit the report",
          deadline: "Friday"
        },
        category: "standard"
      },
      {
        text: "Don't let me forget to buy milk on the way home",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "buy milk",
          when: "on the way home"
        },
        category: "standard"
      },
      {
        text: "Ping me about the deadline tomorrow morning",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "deadline",
          date: "tomorrow",
          time: "morning"
        },
        category: "standard"
      },
      // Complex cases
      {
        text: "Remind me every day at 9am to check emails",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "check emails",
          recurring: "daily",
          time: "9am"
        },
        category: "complex"
      }
    ];
  }

  /**
   * Generate test cases for create_note intent
   */
  private static generateNoteTests(): TestCase[] {
    return [
      // Standard cases
      {
        text: "Make a note about the new product idea",
        expectedIntent: "create_note",
        expectedSlots: {
          content: "new product idea"
        },
        category: "standard"
      },
      {
        text: "Write down that the wifi password is abc123",
        expectedIntent: "create_note",
        expectedSlots: {
          content: "wifi password is abc123"
        },
        category: "standard"
      },
      {
        text: "Save this thought: need to refactor the authentication module",
        expectedIntent: "create_note",
        expectedSlots: {
          content: "need to refactor the authentication module"
        },
        category: "standard"
      },
      {
        text: "Jot down meeting notes from today's standup",
        expectedIntent: "create_note",
        expectedSlots: {
          title: "meeting notes",
          context: "today's standup"
        },
        category: "standard"
      },
      {
        text: "Record that client wants blue color scheme",
        expectedIntent: "create_note",
        expectedSlots: {
          content: "client wants blue color scheme"
        },
        category: "standard"
      }
    ];
  }

  /**
   * Generate test cases for read_email intent
   */
  private static generateReadEmailTests(): TestCase[] {
    return [
      // Standard cases
      {
        text: "Check my emails from Alice",
        expectedIntent: "read_email",
        expectedSlots: {
          sender: "Alice"
        },
        category: "standard"
      },
      {
        text: "Show me unread messages",
        expectedIntent: "read_email",
        expectedSlots: {
          filter: "unread"
        },
        category: "standard"
      },
      {
        text: "Do I have any emails from the boss?",
        expectedIntent: "read_email",
        expectedSlots: {
          sender: "boss"
        },
        category: "standard"
      },
      {
        text: "Read emails about the project update",
        expectedIntent: "read_email",
        expectedSlots: {
          subject: "project update"
        },
        category: "standard"
      },
      {
        text: "What emails came in today?",
        expectedIntent: "read_email",
        expectedSlots: {
          timeframe: "today"
        },
        category: "standard"
      }
    ];
  }

  /**
   * Generate test cases for send_email intent
   */
  private static generateSendEmailTests(): TestCase[] {
    return [
      // Standard cases
      {
        text: "Send an email to the team about the launch",
        expectedIntent: "send_email",
        expectedSlots: {
          recipient: "team",
          subject: "launch"
        },
        category: "standard"
      },
      {
        text: "Email John saying I'll be late to the meeting",
        expectedIntent: "send_email",
        expectedSlots: {
          recipient: "John",
          content: "I'll be late to the meeting"
        },
        category: "standard"
      },
      {
        text: "Reply to Sarah's message with approval",
        expectedIntent: "send_email",
        expectedSlots: {
          recipient: "Sarah",
          action: "reply",
          content: "approval"
        },
        category: "standard"
      },
      {
        text: "Forward the report to management",
        expectedIntent: "send_email",
        expectedSlots: {
          action: "forward",
          content: "report",
          recipient: "management"
        },
        category: "standard"
      },
      {
        text: "Compose a message to HR about vacation request",
        expectedIntent: "send_email",
        expectedSlots: {
          recipient: "HR",
          subject: "vacation request"
        },
        category: "standard"
      }
    ];
  }

  /**
   * Generate edge cases and ambiguous examples
   */
  private static generateEdgeCases(): TestCase[] {
    return [
      // Ambiguous between event and reminder
      {
        text: "Meeting tomorrow at 3",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "Meeting",
          date: "tomorrow",
          time: "3"
        },
        category: "ambiguous"
      },
      {
        text: "Don't forget the presentation next week",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "presentation",
          date: "next week"
        },
        category: "ambiguous"
      },
      // Typos and variations
      {
        text: "Schdule a meting with Jon tomorow",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "meting with Jon",
          date: "tomorow"
        },
        category: "edge_case"
      },
      {
        text: "remnd me 2 call",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "call"
        },
        category: "edge_case"
      },
      // Very short inputs
      {
        text: "meeting 3pm",
        expectedIntent: "create_event",
        expectedSlots: {
          title: "meeting",
          time: "3pm"
        },
        category: "edge_case"
      },
      {
        text: "note: important",
        expectedIntent: "create_note",
        expectedSlots: {
          content: "important"
        },
        category: "edge_case"
      },
      // Complex natural language
      {
        text: "I need to remember to schedule a meeting with the team about the project but first check if John sent that email",
        expectedIntent: "add_reminder",
        expectedSlots: {
          task: "schedule a meeting with the team about the project"
        },
        category: "complex"
      },
      // No clear intent
      {
        text: "What's the weather like?",
        expectedIntent: "unknown",
        category: "edge_case"
      },
      {
        text: "Hello there",
        expectedIntent: "unknown",
        category: "edge_case"
      }
    ];
  }

  /**
   * Save test data to file
   */
  static saveToFile(testCases: TestCase[], filename: string): void {
    const dataDir = path.join(__dirname, '../../../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filepath = path.join(dataDir, filename);
    
    // Save as JSON
    fs.writeFileSync(filepath, JSON.stringify(testCases, null, 2));
    console.log(`✅ Saved ${testCases.length} test cases to ${filepath}`);

    // Also save as CSV for easy viewing
    const csvPath = filepath.replace('.json', '.csv');
    const csv = this.convertToCSV(testCases);
    fs.writeFileSync(csvPath, csv);
    console.log(`✅ Saved CSV version to ${csvPath}`);
  }

  /**
   * Convert test cases to CSV format
   */
  private static convertToCSV(testCases: TestCase[]): string {
    const headers = ['text', 'expected_intent', 'category', 'expected_slots'];
    const rows = testCases.map(tc => [
      `"${tc.text.replace(/"/g, '""')}"`,
      tc.expectedIntent,
      tc.category || 'standard',
      tc.expectedSlots ? `"${JSON.stringify(tc.expectedSlots).replace(/"/g, '""')}"` : ''
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Load test data from file
   */
  static loadFromFile(filename: string): TestCase[] {
    const filepath = path.join(__dirname, '../../../../data', filename);
    const data = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(data);
  }
}

// Generate and save test data if run directly
if (require.main === module) {
  const testCases = TestDataGenerator.generateTestData();
  TestDataGenerator.saveToFile(testCases, 'test_cases_with_expected.json');
  
  console.log('\n📊 Test Data Summary:');
  const intentCounts = testCases.reduce((acc, tc) => {
    acc[tc.expectedIntent] = (acc[tc.expectedIntent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(intentCounts).forEach(([intent, count]) => {
    console.log(`   ${intent}: ${count} cases`);
  });
  
  console.log(`\n   Total: ${testCases.length} test cases`);
}