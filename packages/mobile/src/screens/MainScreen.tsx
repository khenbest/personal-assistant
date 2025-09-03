import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { processVoiceCommand } from '../services/api';
import { VoiceInputSimplified } from '../components/VoiceInputSimplified';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function MainScreen() {
  const navigation = useNavigation();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send to new intelligent backend
      const response = await processVoiceCommand(input, sessionId);
      
      let assistantContent = '';
      
      if (response.success) {
        assistantContent = response.response?.speak || response.response?.display || 'Command processed.';
        
        // Speak the response
        if (response.response?.speak) {
          Speech.speak(response.response.speak, {
            language: 'en-US',
            rate: Platform.OS === 'ios' ? 0.95 : 1.0,
          });
        }
      } else {
        assistantContent = response.error || 'Sorry, I encountered an error.';
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  };

  const handleVoiceCommand = (result: any) => {
    if (result.type === 'voice' && result.result?.success) {
      // Add the voice command to messages
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: result.text,
        timestamp: new Date(),
      };

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.result.response?.speak || 'Command processed.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  };

  const renderMessage = (message: Message) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
        ]}
      >
        {message.content}
      </Text>
      <Text style={styles.timestamp}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kenny Assistant</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings' as never)}
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>
                Start a conversation by typing or using voice
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          )}
        </ScrollView>

        {showVoiceInput ? (
          <View style={styles.voiceInputContainer}>
            <VoiceInputSimplified 
              onCommand={handleVoiceCommand}
              showTextInput={false}
            />
            <TouchableOpacity
              onPress={() => setShowVoiceInput(false)}
              style={styles.closeVoiceButton}
            >
              <Text style={styles.closeVoiceText}>Use Keyboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.textInput, { maxHeight: 100 }]}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              onPress={() => setShowVoiceInput(true)}
              style={styles.voiceButton}
            >
              <Ionicons 
                name="mic" 
                size={24} 
                color="#007AFF" 
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
              disabled={!input.trim() || isLoading}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={input.trim() ? '#007AFF' : '#ccc'} 
              />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  assistantMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  loadingContainer: {
    alignSelf: 'flex-start',
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 16,
    marginRight: 8,
  },
  voiceButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  voiceInputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 20,
  },
  closeVoiceButton: {
    alignSelf: 'center',
    marginTop: 10,
    padding: 10,
  },
  closeVoiceText: {
    color: '#007AFF',
    fontSize: 16,
  },
});