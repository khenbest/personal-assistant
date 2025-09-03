/**
 * Voice Input Component Test
 * Tests for voice recording and command processing in mobile app
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { VoiceInput } from '../src/components/VoiceInput';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// Mock expo modules
jest.mock('expo-speech');
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: jest.fn(() => ({
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      getURI: jest.fn(() => 'mock-audio-uri')
    }))
  }
}));

// Mock API service
jest.mock('../src/services/api', () => ({
  sendVoiceCommand: jest.fn(),
  sendTextCommand: jest.fn()
}));

import { sendVoiceCommand, sendTextCommand } from '../src/services/api';

describe('VoiceInput Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  });

  describe('Voice Recording', () => {
    it('should request microphone permission on first use', async () => {
      const { getByTestId } = render(<VoiceInput onCommand={jest.fn()} />);
      
      const voiceButton = getByTestId('voice-button');
      fireEvent.press(voiceButton);

      await waitFor(() => {
        expect(Audio.requestPermissionsAsync).toHaveBeenCalled();
      });
    });

    it('should start recording when button is pressed', async () => {
      const { getByTestId } = render(<VoiceInput onCommand={jest.fn()} />);
      
      const voiceButton = getByTestId('voice-button');
      fireEvent.press(voiceButton);

      await waitFor(() => {
        expect(getByTestId('recording-indicator')).toBeTruthy();
      });
    });

    it('should stop recording and process command on release', async () => {
      const onCommand = jest.fn();
      (sendVoiceCommand as jest.Mock).mockResolvedValue({
        success: true,
        event: { id: 'event-123', title: 'Test Meeting' },
        spokenResponse: "I've scheduled your meeting"
      });

      const { getByTestId } = render(<VoiceInput onCommand={onCommand} />);
      
      const voiceButton = getByTestId('voice-button');
      
      // Start recording
      fireEvent.pressIn(voiceButton);
      
      // Stop recording
      fireEvent.pressOut(voiceButton);

      await waitFor(() => {
        expect(sendVoiceCommand).toHaveBeenCalled();
        expect(onCommand).toHaveBeenCalledWith({
          type: 'voice',
          text: expect.any(String),
          result: expect.objectContaining({
            success: true,
            event: expect.any(Object)
          })
        });
      });
    });

    it('should handle recording errors gracefully', async () => {
      (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      
      const { getByTestId, getByText } = render(<VoiceInput onCommand={jest.fn()} />);
      
      const voiceButton = getByTestId('voice-button');
      fireEvent.press(voiceButton);

      await waitFor(() => {
        expect(getByText(/microphone permission required/i)).toBeTruthy();
      });
    });
  });

  describe('Voice Feedback', () => {
    it('should play TTS response after successful command', async () => {
      (sendVoiceCommand as jest.Mock).mockResolvedValue({
        success: true,
        spokenResponse: "Your meeting has been scheduled for tomorrow at 3pm"
      });

      const { getByTestId } = render(<VoiceInput onCommand={jest.fn()} />);
      
      const voiceButton = getByTestId('voice-button');
      fireEvent.pressIn(voiceButton);
      fireEvent.pressOut(voiceButton);

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          "Your meeting has been scheduled for tomorrow at 3pm",
          expect.objectContaining({
            language: 'en-US',
            rate: 1.0
          })
        );
      });
    });

    it('should show visual feedback during processing', async () => {
      (sendVoiceCommand as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const { getByTestId, queryByTestId } = render(<VoiceInput onCommand={jest.fn()} />);
      
      const voiceButton = getByTestId('voice-button');
      fireEvent.pressIn(voiceButton);
      fireEvent.pressOut(voiceButton);

      // Should show processing indicator
      expect(getByTestId('processing-indicator')).toBeTruthy();

      await waitFor(() => {
        // Processing indicator should disappear
        expect(queryByTestId('processing-indicator')).toBeFalsy();
      });
    });

    it('should handle TTS interruption', async () => {
      const { getByTestId } = render(<VoiceInput onCommand={jest.fn()} />);
      
      // Start first command
      fireEvent.pressIn(getByTestId('voice-button'));
      fireEvent.pressOut(getByTestId('voice-button'));

      // Start second command before first completes
      fireEvent.pressIn(getByTestId('voice-button'));

      expect(Speech.stop).toHaveBeenCalled();
    });
  });

  describe('Text Fallback', () => {
    it('should allow text input when voice is unavailable', async () => {
      const onCommand = jest.fn();
      (sendTextCommand as jest.Mock).mockResolvedValue({
        success: true,
        event: { id: 'event-123', title: 'Test Meeting' }
      });

      const { getByTestId } = render(<VoiceInput onCommand={onCommand} showTextInput />);
      
      const textInput = getByTestId('text-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(textInput, 'Schedule meeting tomorrow at 3pm');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(sendTextCommand).toHaveBeenCalledWith('Schedule meeting tomorrow at 3pm');
        expect(onCommand).toHaveBeenCalled();
      });
    });

    it('should switch between voice and text modes', () => {
      const { getByTestId, queryByTestId } = render(
        <VoiceInput onCommand={jest.fn()} showTextInput />
      );
      
      // Should show voice button by default
      expect(getByTestId('voice-button')).toBeTruthy();
      expect(queryByTestId('text-input')).toBeFalsy();

      // Switch to text mode
      fireEvent.press(getByTestId('input-mode-toggle'));
      
      expect(queryByTestId('voice-button')).toBeFalsy();
      expect(getByTestId('text-input')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(<VoiceInput onCommand={jest.fn()} />);
      
      expect(getByLabelText('Hold to record voice command')).toBeTruthy();
    });

    it('should announce state changes', async () => {
      const { getByTestId } = render(<VoiceInput onCommand={jest.fn()} />);
      
      const voiceButton = getByTestId('voice-button');
      fireEvent.pressIn(voiceButton);

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith('Recording started', expect.any(Object));
      });
    });
  });
});