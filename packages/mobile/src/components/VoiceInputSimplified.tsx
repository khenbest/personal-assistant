/**
 * Simplified Voice Input Component
 * A thin presentation layer that delegates ALL intelligence to the backend
 * NO hard-coded thresholds, NO business logic, just UI
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
  Modal,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { Ionicons } from '@expo/vector-icons';
import { processVoiceCommand, handleVoiceCorrection } from '../services/api';
import { v4 as uuidv4 } from 'uuid';

interface VoiceInputProps {
  onCommand: (result: any) => void;
  showTextInput?: boolean;
}

export function VoiceInputSimplified({ onCommand, showTextInput = false }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recordingAnimation] = useState(new Animated.Value(1));
  const [transcribedText, setTranscribedText] = useState('');
  const [sessionId] = useState(() => uuidv4()); // Generate session ID once
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  
  // Set up speech recognition event listeners
  useSpeechRecognitionEvent('result', (event: any) => {
    const results = event.results?.[0];
    if (results) {
      const transcript = results.transcript || '';
      setTranscribedText(transcript);
      console.log('Speech recognition result:', transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    console.error('Speech recognition error:', event.error);
    setIsRecording(false);
    setIsProcessing(false);
    Alert.alert(
      'Speech Recognition Error',
      event.error?.message || 'Failed to recognize speech. Please try again.'
    );
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('Speech recognition ended');
    if (isRecording && transcribedText) {
      stopRecording();
    }
  });

  useEffect(() => {
    checkPermissions();
    
    return () => {
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
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setPermissionGranted(status === 'granted');
      
      if (status !== 'granted') {
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
    if (!permissionGranted) {
      await checkPermissions();
      return;
    }

    try {
      await Speech.stop();
      setTranscribedText('');
      
      const { isRecognitionAvailable } = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      
      if (isRecognitionAvailable) {
        await ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          maxAlternatives: 1,
          continuous: false,
          requiresOnDeviceRecognition: false,
          addsPunctuation: true,
        });
        
        setIsRecording(true);
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
      
      await ExpoSpeechRecognitionModule.stop();
      AccessibilityInfo.announceForAccessibility('Processing your command');
      
      const finalTranscription = transcribedText;
      
      if (!finalTranscription || finalTranscription.trim() === '') {
        Alert.alert('No Speech Detected', 'Please try again and speak clearly.');
        setIsProcessing(false);
        return;
      }
      
      // Send to the NEW intelligent backend endpoint
      // The backend decides EVERYTHING - no thresholds here!
      const result = await processVoiceCommand(
        finalTranscription,
        sessionId
      );
      
      // The backend tells us exactly what to do
      await handleBackendResponse(result, finalTranscription);
      
    } catch (error) {
      console.error('Failed to process recording:', error);
      Alert.alert('Processing Error', 'Failed to process your command. Please try again.');
    } finally {
      setIsProcessing(false);
      setTranscribedText('');
    }
  };

  /**
   * Handle the response from the intelligent backend
   * The backend decides the action, we just render it
   */
  const handleBackendResponse = async (result: any, originalText: string) => {
    if (!result.success) {
      await Speech.speak(result.response?.speak || 'Something went wrong', { language: 'en-US' });
      return;
    }

    // The backend tells us what action to take
    switch (result.action) {
      case 'execute':
        // Backend says execute - we execute
        await Speech.speak(result.response.speak, { language: 'en-US' });
        onCommand({
          type: 'voice',
          text: originalText,
          result,
        });
        break;

      case 'confirm':
        // Backend wants confirmation - show modal
        setConfirmationData({
          originalText,
          result,
          options: result.response.options || ['Yes', 'No'],
        });
        setShowConfirmModal(true);
        await Speech.speak(result.response.speak, { language: 'en-US' });
        break;

      case 'clarify':
        // Backend needs clarification - speak and wait
        await Speech.speak(result.response.speak, { language: 'en-US' });
        // Could trigger another recording or show input
        break;

      case 'learn':
        // Backend is learning from patterns
        await Speech.speak(result.response.speak, { language: 'en-US' });
        onCommand({
          type: 'voice',
          text: originalText,
          result,
        });
        break;

      case 'error':
        // Backend reported an error
        await Speech.speak(
          result.response.speak || "I'm sorry, something went wrong",
          { language: 'en-US' }
        );
        break;

      default:
        console.warn('Unknown action from backend:', result.action);
    }
  };

  /**
   * Handle confirmation response
   * Again, just pass to backend, no local logic
   */
  const handleConfirmation = async (confirmed: boolean) => {
    setShowConfirmModal(false);
    
    if (!confirmationData) return;
    
    if (confirmed) {
      // User confirmed - execute the action
      onCommand({
        type: 'voice',
        text: confirmationData.originalText,
        result: confirmationData.result,
      });
      await Speech.speak('Great! Executing your command.', { language: 'en-US' });
    } else {
      // User rejected - could offer correction
      await Speech.speak('Ok, cancelled. Please try again.', { language: 'en-US' });
    }
    
    setConfirmationData(null);
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    
    setIsProcessing(true);
    try {
      const result = await processVoiceCommand(textInput, sessionId);
      await handleBackendResponse(result, textInput);
      setTextInput('');
    } catch (error) {
      console.error('Failed to send text command:', error);
      Alert.alert('Error', 'Failed to process command');
    } finally {
      setIsProcessing(false);
    }
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
                <Ionicons name="mic" size={40} color="#FFFFFF" />
              </Animated.View>
            )}
          </TouchableOpacity>
          
          {isRecording && (
            <View style={styles.recordingIndicator} testID="recording-indicator">
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}
          
          {(isRecording || transcribedText) && (
            <View style={styles.transcriptionContainer}>
              <Text style={styles.transcriptionText}>
                {transcribedText || 'Listening...'}
              </Text>
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

      {/* Simple Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
              {confirmationData?.result?.response?.speak}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => handleConfirmation(true)}
              >
                <Text style={styles.buttonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => handleConfirmation(false)}
              >
                <Text style={styles.buttonText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  transcriptionContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    minWidth: 200,
    maxWidth: '90%',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});