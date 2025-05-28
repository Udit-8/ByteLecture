import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Button, Card, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface AITutorScreenProps {
  navigation: any;
  route?: {
    params?: {
      noteTitle?: string;
      noteContext?: string;
      fromNote?: boolean;
    };
  };
}

export const AITutorScreen: React.FC<AITutorScreenProps> = ({ navigation, route }) => {
  const { selectedNote,mode } = useNavigation();
  const isFromNote = route?.params?.fromNote || mode === 'note-detail';
  const noteTitle = selectedNote?.title || 'Quantum Physics Basics';
  
  const getInitialMessage = () => {
    if (isFromNote) {
      return `Hi! I'm your AI tutor for "${noteTitle}". I can help you understand the concepts, answer questions, and provide additional explanations about this specific content. What would you like to know?`;
    }
    return "Hi! I'm your AI tutor. I'm here to help you understand your course materials better. What would you like to learn about today?";
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: getInitialMessage(),
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI response (in real app, this would call an AI API)
    setTimeout(() => {
      const contextualResponse = isFromNote 
        ? `Based on "${noteTitle}", let me help explain that concept. This is a simulated AI response that would analyze your specific note content and provide detailed explanations.`
        : "Thanks for your question! This is a simulated AI response. In the full version, I would provide detailed explanations based on your course materials and help you understand complex concepts step by step.";
        
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: contextualResponse,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
    inputRef.current?.focus();
  };

  const getQuickQuestions = () => {
    if (isFromNote) {
      return [
        "Explain this concept in simple terms",
        "Give me examples of this",
        "Create a practice question",
        "Summarize the key points",
      ];
    }
    return [
      "Can you explain this concept?",
      "Help me understand this formula",
      "Give me a practice problem",
      "Summarize the key points",
    ];
  };

  const quickQuestions = getQuickQuestions();

  const getHeaderTitle = () => {
    return isFromNote ? `${noteTitle} - Chat` : 'AI Tutor';
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const renderMessage = (message: Message) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.isUser ? styles.userMessageContainer : styles.aiMessageContainer,
      ]}
    >
      {!message.isUser && (
        <View style={styles.aiAvatar}>
          <Ionicons name="chatbubbles" size={16} color={theme.colors.primary[600]} />
        </View>
      )}
      
      <View
        style={[
          styles.messageBubble,
          message.isUser ? styles.userMessageBubble : styles.aiMessageBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            message.isUser ? styles.userMessageText : styles.aiMessageText,
          ]}
        >
          {message.text}
        </Text>
        <Text
          style={[
            styles.messageTime,
            message.isUser ? styles.userMessageTime : styles.aiMessageTime,
          ]}
        >
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      
      {message.isUser && (
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={16} color={theme.colors.white} />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={getHeaderTitle()}
        leftAction={{
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackPress,
        }}
        rightAction={{
          icon: <Ionicons name="information-circle-outline" size={24} color={theme.colors.gray[600]} />,
          onPress: () => Alert.alert(
            isFromNote ? 'Note Chat' : 'AI Tutor',
            isFromNote 
              ? `Chat about "${noteTitle}". Ask questions about this specific content and get detailed explanations.`
              : 'Your personal AI tutor is here to help explain concepts, answer questions, and provide additional practice problems based on your learning materials.'
          ),
        }}
      />
      
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(renderMessage)}
          
          {isTyping && (
            <View style={styles.typingContainer}>
              <View style={styles.aiAvatar}>
                <Ionicons name="chatbubbles" size={16} color={theme.colors.primary[600]} />
              </View>
              <View style={styles.typingBubble}>
                <LoadingIndicator size="small" />
                <Text style={styles.typingText}>AI is typing...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {messages.length === 1 && (
          <View style={styles.quickQuestionsContainer}>
            <Text style={styles.quickQuestionsTitle}>Quick Questions</Text>
            <View style={styles.quickQuestionsGrid}>
              {quickQuestions.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickQuestionButton}
                  onPress={() => handleQuickQuestion(question)}
                >
                  <Text style={styles.quickQuestionText}>{question}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isFromNote ? "Ask about this note..." : "Ask me anything..."}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim() ? styles.sendButtonActive : styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={inputText.trim() ? theme.colors.white : theme.colors.gray[400]} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.base,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
    flexShrink: 0,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    flexShrink: 0,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    ...theme.shadow.sm,
  },
  userMessageBubble: {
    backgroundColor: theme.colors.primary[600],
    borderBottomRightRadius: theme.borderRadius.sm,
  },
  aiMessageBubble: {
    backgroundColor: theme.colors.white,
    borderBottomLeftRadius: theme.borderRadius.sm,
  },
  messageText: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    marginBottom: theme.spacing.xs,
  },
  userMessageText: {
    color: theme.colors.white,
  },
  aiMessageText: {
    color: theme.colors.gray[900],
  },
  messageTime: {
    fontSize: theme.typography.fontSize.xs,
  },
  userMessageTime: {
    color: theme.colors.primary[200],
  },
  aiMessageTime: {
    color: theme.colors.gray[500],
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  typingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontStyle: 'italic',
  },
  quickQuestionsContainer: {
    padding: theme.spacing.base,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  quickQuestionsTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.md,
  },
  quickQuestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  quickQuestionButton: {
    backgroundColor: theme.colors.primary[100],
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
  },
  quickQuestionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  inputContainer: {
    padding: theme.spacing.base,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[900],
    maxHeight: 100,
    paddingVertical: theme.spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: theme.colors.primary[600],
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray[300],
  },
}); 