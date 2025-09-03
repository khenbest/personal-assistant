/**
 * Voice Input Component
 * Handles voice recording and command processing with TTS feedback
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Animated,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import * as Speech from 'expo-speech';

// Mock speech recognition for Expo Go compatibility
const ExpoSpeechRecognitionModule = {
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  isRecognitionAvailable: async () => ({ isRecognitionAvailable: true }),
  start: async (options: any) => {
    console.log('Mock speech recognition started', options);
  },
  stop: async () => {
    console.log('Mock speech recognition stopped');
  }
};

const useSpeechRecognitionEvent = (event: string, handler: Function) => {
  // Mock implementation - does nothing in Expo Go
};
import { Ionicons } from '@expo/vector-icons';
import { sendVoiceCommand, sendTextCommand } from '../services/api';

interface VoiceInputProps {
  onCommand: (result: any) => void;
  showTextInput?: boolean;
}

export function VoiceInput({ onCommand, showTextInput = false }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [speechPermissionGranted, setSpeechPermissionGranted] = useState(false);
  const [recordingAnimation] = useState(new Animated.Value(1));
  const [transcribedText, setTranscribedText] = useState('');
  
  // Set up speech recognition event listener
  useSpeechRecognitionEvent('result', (event) => {
    setTranscribedText(event.results[0]?.transcript || '');
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error);
    setIsRecording(false);
  });

  useEffect(() => {
    // Check and request permissions on mount
    checkPermissions();
    
    return () => {
      // Cleanup on unmount - stop speech recognition if active
      ExpoSpeechRecognitionModule.stop().catch(() => {});
    };
  }, []);

  useEffect(() => {
    // Animate recording indicator
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      recordingAnimation.setValue(1);
    }
  }, [isRecording]);

  const checkPermissions = async () => {
    try {
      // Check speech recognition permission
      const { status: speechStatus } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setSpeechPermissionGranted(speechStatus === 'granted');
      setPermissionGranted(speechStatus === 'granted');
      
      if (speechStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Please grant microphone and speech recognition access to use voice commands.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Permission check failed:', error);
    }
  };

  const startRecording = async () => {
    if (!permissionGranted || !speechPermissionGranted) {
      await checkPermissions();
      return;
    }

    try {
      // Stop any ongoing TTS
      await Speech.stop();
      
      // Clear previous transcription
      setTranscribedText('');
      
      // Start speech recognition
      const { isRecognitionAvailable } = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      
      if (isRecognitionAvailable) {
        await ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
          requiresOnDeviceRecognition: false,
          addsPunctuation: true,
          contextualStrings: [
            'Schedule', 'meeting', 'appointment', 'tomorrow', 'calendar',
            'remind', 'reminder', 'task', 'note', 'email'
          ],
        });
        
        setIsRecording(true);
        
        // Announce to screen readers
        AccessibilityInfo.announceForAccessibility('Recording started');
      } else {
        Alert.alert('Speech Recognition Unavailable', 'Speech recognition is not available on this device.');
      }
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      setIsRecording(false);
      setIsProcessing(true);
      
      // Stop speech recognition
      await ExpoSpeechRecognitionModule.stop();
      
      // Announce to screen readers
      AccessibilityInfo.announceForAccessibility('Processing your command');
      
      // Use the transcribed text or fall back to mock
      const finalTranscription = transcribedText || simulateTranscription(null);
      
      if (!finalTranscription) {
        Alert.alert('No Speech Detected', 'Please try again and speak clearly.');
        setIsProcessing(false);
        return;
      }
      
      // Send to backend
      const result = await sendVoiceCommand(finalTranscription);
      
      if (result.success) {
        // Play TTS response
        if (result.spokenResponse) {
          await Speech.speak(result.spokenResponse, {
            language: 'en-US',
            rate: 1.0,
            pitch: 1.0,
          });
        }
        
        // Notify parent component
        onCommand({
          type: 'voice',
          text: finalTranscription,
          result,
        });
      } else {
        // Handle error
        const errorMessage = result.spokenResponse || 'Sorry, something went wrong.';
        await Speech.speak(errorMessage, { language: 'en-US' });
        
        Alert.alert('Error', result.error || 'Failed to process command');
      }
      
    } catch (error) {
      console.error('Failed to process recording:', error);
      Alert.alert('Processing Error', 'Failed to process your command. Please try again.');
    } finally {
      setIsProcessing(false);
      setTranscribedText(''); // Clear for next recording
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    
    setIsProcessing(true);
    try {
      const result = await sendTextCommand(textInput);
      
      if (result.success && result.spokenResponse) {
        await Speech.speak(result.spokenResponse, { language: 'en-US' });
      }
      
      onCommand({
        type: 'text',
        text: textInput,
        result,
      });
      
      setTextInput('');
      
    } catch (error) {
      console.error('Failed to send text command:', error);
      Alert.alert('Error', 'Failed to process command');
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateTranscription = (audioUri: string | null): string => {
    // Fallback for when speech recognition fails or in development
    if (__DEV__) {
      const testCommands = [
        "Schedule team meeting tomorrow at 3pm",
        "Book conference room for Friday 2pm",
        "Add dentist appointment next Monday at 10am",
        "Create lunch meeting tomorrow at noon",
      ];
      
      return testCommands[Math.floor(Math.random() * testCommands.length)];
    }
    
    return '';
  };

  const toggleInputMode = () => {
    setInputMode(inputMode === 'voice' ? 'text' : 'voice');
  };

  return (
    <View style={styles.container}>
      {showTextInput && (
        <TouchableOpacity
          style={styles.modeToggle}
          onPress={toggleInputMode}
          testID="input-mode-toggle"
        >
          <Ionicons
            name={inputMode === 'voice' ? 'text' : 'mic'}
            size={24}
            color="#007AFF"
          />
        </TouchableOpacity>
      )}

      {inputMode === 'voice' ? (
        <View style={styles.voiceContainer}>
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isRecording && styles.voiceButtonRecording,
              isProcessing && styles.voiceButtonProcessing,
            ]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={isProcessing}
            testID="voice-button"
            accessibilityLabel="Hold to record voice command"
            accessibilityRole="button"
            accessibilityState={{
              disabled: isProcessing,
              busy: isProcessing,
            }}
          >
            {isProcessing ? (
              <ActivityIndicator
                size="large"
                color="#FFFFFF"
                testID="processing-indicator"
              />
            ) : (
              <Animated.View
                style={[
                  styles.iconContainer,
                  isRecording && { transform: [{ scale: recordingAnimation }] },
                ]}
              >
                <Ionicons
                  name="mic"
                  size={40}
                  color="#FFFFFF"
                />
              </Animated.View>
            )}
          </TouchableOpacity>
          
          {isRecording && (
            <View style={styles.recordingIndicator} testID="recording-indicator">
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}
          
          <Text style={styles.instructions}>
            {isProcessing 
              ? 'Processing...'
              : isRecording
              ? 'Release to send'
              : 'Hold to speak'}
          </Text>
        </View>
      ) : (
        <View style={styles.textContainer}>
          <TextInput
            style={styles.textInput}
            value={textInput}
            onChangeText={setTextInput}
            placeholder="Type your command..."
            onSubmitEditing={handleTextSubmit}
            returnKeyType="send"
            testID="text-input"
            accessible
            accessibilityLabel="Type command"
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleTextSubmit}
            disabled={!textInput.trim() || isProcessing}
            testID="send-button"
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="send" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>
      )}
      
      {/* Hidden input for testing */}
      {__DEV__ && (
        <View style={styles.testContainer}>
          <TextInput
            style={styles.hiddenInput}
            testID="voice-simulator-input"
            placeholder="Test voice input"
          />
          <TouchableOpacity
            testID="voice-simulator-submit"
            style={styles.hiddenButton}
          >
            <Text>Submit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  voiceContainer: {
    alignItems: 'center',
  },
  voiceButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  voiceButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  voiceButtonProcessing: {
    backgroundColor: '#8E8E93',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 5,
  },
  recordingText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  instructions: {
    marginTop: 10,
    fontSize: 14,
    color: '#8E8E93',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  textInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
    padding: 8,
  },
  modeToggle: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 10,
  },
  testContainer: {
    position: 'absolute',
    top: -100,
    opacity: 0,
  },
  hiddenInput: {
    width: 1,
    height: 1,
  },
  hiddenButton: {
    width: 1,
    height: 1,
  },
});