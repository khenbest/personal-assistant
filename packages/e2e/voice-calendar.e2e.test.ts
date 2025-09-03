/**
 * End-to-End Test: Voice Command to Calendar Event
 * Complete flow from voice input to calendar event creation
 */

describe('Voice to Calendar E2E', () => {
  beforeAll(async () => {
    // Start backend server
    await device.launchApp({
      newInstance: true,
      permissions: {
        microphone: 'YES',
        calendar: 'YES'
      }
    });
  });

  describe('Complete Voice Flow', () => {
    it('should create calendar event from voice command', async () => {
      // Navigate to main chat screen
      await element(by.id('tab-chat')).tap();

      // Hold voice button to record
      await element(by.id('voice-button')).longPress(2000);

      // Simulate voice input (in real test, would use actual audio)
      await element(by.id('voice-simulator-input')).typeText('Schedule team meeting tomorrow at 3pm');
      await element(by.id('voice-simulator-submit')).tap();

      // Wait for processing
      await waitFor(element(by.id('processing-indicator')))
        .toBeVisible()
        .withTimeout(2000);

      await waitFor(element(by.id('processing-indicator')))
        .not.toBeVisible()
        .withTimeout(5000);

      // Verify response
      await expect(element(by.text(/scheduled.*team meeting/i))).toBeVisible();

      // Navigate to calendar to verify event
      await element(by.id('tab-calendar')).tap();
      
      // Check tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateString = tomorrow.toLocaleDateString();
      
      await element(by.id('calendar-date-' + dateString)).tap();
      
      // Verify event appears
      await expect(element(by.text('team meeting'))).toBeVisible();
      await expect(element(by.text('3:00 PM'))).toBeVisible();
    });

    it('should handle voice command with multiple parameters', async () => {
      await element(by.id('tab-chat')).tap();
      
      // Record complex command
      await element(by.id('voice-button')).longPress(3000);
      await element(by.id('voice-simulator-input')).clearText();
      await element(by.id('voice-simulator-input')).typeText(
        'Book conference room A for project review tomorrow from 2 to 4pm with john@example.com'
      );
      await element(by.id('voice-simulator-submit')).tap();

      // Wait for confirmation
      await waitFor(element(by.text(/conference room A/i)))
        .toBeVisible()
        .withTimeout(5000);

      // Verify all details in response
      await expect(element(by.text(/2:00 PM.*4:00 PM/i))).toBeVisible();
      await expect(element(by.text(/john@example.com/i))).toBeVisible();
    });

    it('should provide voice feedback', async () => {
      await element(by.id('tab-chat')).tap();
      
      // Enable voice feedback
      await element(by.id('settings-button')).tap();
      await element(by.id('voice-feedback-toggle')).tap();
      await element(by.id('close-settings')).tap();

      // Record command
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).clearText();
      await element(by.id('voice-simulator-input')).typeText('Schedule lunch tomorrow at noon');
      await element(by.id('voice-simulator-submit')).tap();

      // Verify audio feedback indicator appears
      await waitFor(element(by.id('audio-playing-indicator')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid dates', async () => {
      await element(by.id('tab-chat')).tap();
      
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).clearText();
      await element(by.id('voice-simulator-input')).typeText('Schedule meeting yesterday');
      await element(by.id('voice-simulator-submit')).tap();

      await waitFor(element(by.text(/can't schedule.*past/i)))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should handle ambiguous commands', async () => {
      await element(by.id('tab-chat')).tap();
      
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).clearText();
      await element(by.id('voice-simulator-input')).typeText('Meeting sometime next week');
      await element(by.id('voice-simulator-submit')).tap();

      // Should show clarification options
      await waitFor(element(by.text(/Which day/i)))
        .toBeVisible()
        .withTimeout(3000);

      // Select an option
      await element(by.text('Monday')).tap();
      
      // Verify event created
      await expect(element(by.text(/scheduled.*Monday/i))).toBeVisible();
    });

    it('should handle network errors gracefully', async () => {
      // Disable network
      await device.setURLBlacklist(['.*']);

      await element(by.id('tab-chat')).tap();
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).clearText();
      await element(by.id('voice-simulator-input')).typeText('Schedule meeting tomorrow');
      await element(by.id('voice-simulator-submit')).tap();

      await waitFor(element(by.text(/connection error/i)))
        .toBeVisible()
        .withTimeout(3000);

      // Re-enable network
      await device.clearURLBlacklist();
    });
  });

  describe('Calendar Integration', () => {
    it('should sync with native iOS calendar', async () => {
      await element(by.id('tab-chat')).tap();
      
      // Create event via voice
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).clearText();
      await element(by.id('voice-simulator-input')).typeText('Dentist appointment next Monday at 10am');
      await element(by.id('voice-simulator-submit')).tap();

      await waitFor(element(by.text(/scheduled.*dentist/i)))
        .toBeVisible()
        .withTimeout(3000);

      // Open native calendar (would need special handling in real device)
      await element(by.id('open-native-calendar')).tap();
      
      // Verify event appears in native calendar
      // This would require native module testing
    });

    it('should handle calendar permissions', async () => {
      // Reset app with no calendar permission
      await device.launchApp({
        newInstance: true,
        permissions: {
          microphone: 'YES',
          calendar: 'NO'
        }
      });

      await element(by.id('tab-chat')).tap();
      
      // Try to create event
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).typeText('Schedule meeting tomorrow');
      await element(by.id('voice-simulator-submit')).tap();

      // Should prompt for calendar permission
      await waitFor(element(by.text(/Calendar permission required/i)))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.text('Grant Permission')).tap();
      
      // System permission dialog would appear here
      // After granting, event should be created
    });
  });

  describe('Learning System', () => {
    it('should improve with corrections', async () => {
      await element(by.id('tab-chat')).tap();
      
      // First attempt
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).typeText('Weekly standup tomorrow');
      await element(by.id('voice-simulator-submit')).tap();

      await waitFor(element(by.text(/scheduled/i)))
        .toBeVisible()
        .withTimeout(3000);

      // Correct the interpretation
      await element(by.id('message-options')).tap();
      await element(by.text('Correct')).tap();
      
      await element(by.id('correction-recurring')).tap();
      await element(by.text('Weekly - Every Tuesday')).tap();
      await element(by.id('save-correction')).tap();

      // Try same command again
      await element(by.id('voice-button')).longPress(2000);
      await element(by.id('voice-simulator-input')).clearText();
      await element(by.id('voice-simulator-input')).typeText('Weekly standup tomorrow');
      await element(by.id('voice-simulator-submit')).tap();

      // Should now include recurring
      await expect(element(by.text(/weekly.*Tuesday/i))).toBeVisible();
    });
  });
});