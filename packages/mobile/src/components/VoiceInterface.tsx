import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import voiceService from '../services/voiceService';

interface Message {
  id: string;
  text: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export default function VoiceInterface() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Welcome message
    const welcomeMessage: Message = {
      id: 'welcome',
      text: 'Hello! I\'m your AI assistant. Tap the microphone to start talking.',
      role: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    voiceService.speak(welcomeMessage.text);
  }, []);

  const handleMicrophonePress = async () => {
    setError(null);

    if (isRecording) {
      // Stop recording and process
      try {
        setIsRecording(false);
        setIsProcessing(true);

        const transcription = await voiceService.stopRecording();
        
        // Add user message
        const userMessage: Message = {
          id: `user_${Date.now()}`,
          text: transcription,
          role: 'user',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        // Get AI response
        const response = await voiceService.processMessage(transcription);
        
        // Add assistant message
        const assistantMessage: Message = {
          id: `assistant_${Date.now()}`,
          text: response,
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Speak the response
        await voiceService.speak(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error processing voice:', err);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Start recording
      try {
        await voiceService.startRecording();
        setIsRecording(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start recording');
        console.error('Error starting recording:', err);
      }
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Assistant</Text>
        <Text style={styles.subtitle}>Voice-Powered Personal Helper</Text>
      </View>

      <ScrollView style={styles.messagesContainer}>
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text style={message.role === 'user' ? styles.userMessageText : styles.messageText}>
              {message.text}
            </Text>
            <Text style={message.role === 'user' ? styles.userTimestamp : styles.timestamp}>
              {formatTime(message.timestamp)}
            </Text>
          </View>
        ))}
      </ScrollView>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.controls}>
        {isProcessing && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.micButton,
            isRecording && styles.micButtonRecording,
            isProcessing && styles.micButtonDisabled,
          ]}
          onPress={handleMicrophonePress}
          disabled={isProcessing}
        >
          <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
          <Text style={styles.micText}>
            {isRecording ? 'Stop' : isProcessing ? 'Processing...' : 'Tap to Speak'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  userMessageText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  userTimestamp: {
    fontSize: 12,
    color: '#E5E5EA',
    marginTop: 4,
  },
  controls: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  micButton: {
    backgroundColor: '#007AFF',
    borderRadius: 100,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  micIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  micText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  processingText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
});