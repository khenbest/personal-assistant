import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { GiftedChat, IMessage, Send, InputToolbar, Composer } from 'react-native-gifted-chat';
// import LottieView from 'lottie-react-native'; // TODO: Add animations later
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';

// Design system colors
const colors = {
  primary: '#212529',
  secondary: '#f5f6f7',
  background: '#ffffff',
  text: '#212529',
  lightText: '#6c757d',
  border: '#e9ecef',
};

export function ChatScreen() {
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    // Initialize with welcome message
    setMessages([
      {
        _id: 1,
        text: 'Hello! I\'m your AI assistant. How can I help you today?',
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'Assistant',
          avatar: '🤖',
        },
      },
    ]);

    // Request audio permissions
    Audio.requestPermissionsAsync();
  }, []);

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
    
    if (newMessages.length > 0) {
      const userMessage = newMessages[0].text;
      setIsLoading(true);

      try {
        // Send to backend
        const response = await apiService.sendCommand(userMessage);
        
        // Add AI response
        const aiMessage: IMessage = {
          _id: Math.random(),
          text: response.message || 'I processed your request.',
          createdAt: new Date(),
          user: {
            _id: 2,
            name: 'Assistant',
            avatar: '🤖',
          },
        };

        setMessages(previousMessages => GiftedChat.append(previousMessages, [aiMessage]));
        
        // Auto-play TTS for AI response
        speakMessage(aiMessage.text);
      } catch (error) {
        console.error('Error sending message:', error);
        const errorMessage: IMessage = {
          _id: Math.random(),
          text: 'Sorry, I encountered an error. Please try again.',
          createdAt: new Date(),
          user: {
            _id: 2,
            name: 'Assistant',
            avatar: '🤖',
          },
        };
        setMessages(previousMessages => GiftedChat.append(previousMessages, [errorMessage]));
      } finally {
        setIsLoading(false);
      }
    }
  }, []);

  const speakMessage = async (text: string) => {
    setIsSpeaking(true);
    await Speech.speak(text, {
      rate: 0.9,
      pitch: 1.0,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    // TODO: Send audio to speech-to-text service
    // For now, we'll use a placeholder
    const transcribedText = "This is a placeholder for speech-to-text";
    
    const userMessage: IMessage = {
      _id: Math.random(),
      text: transcribedText,
      createdAt: new Date(),
      user: {
        _id: 1,
      },
    };

    onSend([userMessage]);
  };

  const handleVoicePress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const renderInputToolbar = (props: any) => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={styles.inputPrimary}
    />
  );

  const renderComposer = (props: any) => (
    <Composer
      {...props}
      textInputStyle={styles.composer}
      placeholderTextColor={colors.lightText}
      placeholder="Type a message..."
    />
  );

  const renderSend = (props: any) => (
    <Send {...props} containerStyle={styles.sendContainer}>
      <Ionicons name="send" size={24} color={colors.primary} />
    </Send>
  );

  const renderAccessory = () => (
    <View style={styles.accessoryContainer}>
      <TouchableOpacity
        style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
        onPress={handleVoicePress}
        activeOpacity={0.7}
      >
        <Ionicons 
          name={isRecording ? "stop" : "mic"} 
          size={28} 
          color={colors.background} 
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        {isSpeaking && (
          <Text style={styles.speakingIndicator}>🔊</Text>
        )}
      </View>

      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{ _id: 1 }}
        renderInputToolbar={renderInputToolbar}
        renderComposer={renderComposer}
        renderSend={renderSend}
        renderAccessory={renderAccessory}
        isLoadingEarlier={isLoading}
        renderAvatar={null}
        showAvatarForEveryMessage={false}
        alwaysShowSend
        scrollToBottomStyle={styles.scrollToBottom}
        messagesContainerStyle={styles.messagesContainer}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
  },
  speakingIndicator: {
    fontSize: 20,
  },
  messagesContainer: {
    backgroundColor: colors.background,
  },
  inputToolbar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputPrimary: {
    alignItems: 'center',
  },
  composer: {
    backgroundColor: colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 16,
    color: colors.text,
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 5,
  },
  wrapperLeft: {
    marginRight: 60,
  },
  wrapperRight: {
    marginLeft: 60,
  },
  accessoryContainer: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  voiceButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  voiceButtonActive: {
    backgroundColor: '#dc3545',
  },
  scrollToBottom: {
    backgroundColor: colors.primary,
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
  },
  loadingText: {
    fontSize: 24,
    color: colors.primary,
  },
});