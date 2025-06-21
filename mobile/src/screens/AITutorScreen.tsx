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
import { useChat } from '../hooks/useChat';
import { ChatMessage, ContextSource } from '../services/chatAPI';

interface AITutorScreenProps {
  navigation: any;
  route?: {
    params?: {
      noteTitle?: string;
      noteContext?: string;
      fromNote?: boolean;
      contentItemId?: string;
    };
  };
}

export const AITutorScreen: React.FC<AITutorScreenProps> = ({ navigation, route }) => {
  const { selectedNote, mode } = useNavigation();
  const isFromNote = route?.params?.fromNote || mode === 'note-detail';
  const noteTitle = selectedNote?.title || route?.params?.noteTitle || 'AI Tutor';
  const contentItemId = route?.params?.contentItemId || selectedNote?.id;
  
  const {
    currentSession,
    messages,
    loading,
    isTyping,
    error,
    createSession,
    sendMessage,
    usage,
    getUsage,
    generateEmbeddings
  } = useChat();

  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Initialize chat session when component mounts
    const initializeChat = async () => {
      try {
        const contextContentIds = contentItemId ? [contentItemId] : [];
        const sessionTitle = isFromNote ? `${noteTitle} - Chat` : 'AI Tutor Chat';
        
        // Generate embeddings for content first (if we have content)
        if (contextContentIds.length > 0) {
          console.log('🔍 Generating embeddings for content:', contextContentIds);
          try {
            const embeddingsSuccess = await generateEmbeddings(contextContentIds);
            if (embeddingsSuccess) {
              console.log('✅ Embeddings generated successfully');
            } else {
              console.warn('⚠️ Embeddings generation failed, but continuing with chat');
            }
          } catch (embeddingError) {
            console.error('❌ Embedding generation error:', embeddingError);
            // Continue with chat even if embeddings fail
          }
        }
        
        await createSession(sessionTitle, contextContentIds);
        
        // Refresh usage information
        await getUsage();
      } catch (error) {
        console.error('Failed to initialize chat session:', error);
        Alert.alert('Error', 'Failed to start chat session. Please try again.');
      }
    };

    initializeChat();
  }, [contentItemId, isFromNote, noteTitle]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentSession) return;

    // Check usage limit
    if (usage && usage.remaining <= 0) {
      Alert.alert(
        'Daily Limit Reached',
        `You've used all ${usage.dailyLimit} daily questions. Please upgrade your plan or try again tomorrow.`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setInputText('');
      await sendMessage(currentSession.id, inputText.trim());
      await getUsage(); // Update usage after sending message
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setInputText(inputText); // Restore input text on error
    }
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

  const renderContextSources = (sources?: ContextSource[]) => {
    if (!sources || sources.length === 0) return null;

    return (
      <View style={styles.sourcesContainer}>
        <Text style={styles.sourcesTitle}>Sources:</Text>
        {sources.map((source, index) => (
          <View key={index} style={styles.sourceItem}>
            <Text style={styles.sourceTitle}>{source.content_title}</Text>
            {source.section_title && (
              <Text style={styles.sourceSectionTitle}>{source.section_title}</Text>
            )}
            <Text style={styles.sourceChunk}>"{source.section_text?.substring(0, 100) || 'No content available'}..."</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderMessage = (message: ChatMessage) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.role === 'user' ? styles.userMessageContainer : styles.aiMessageContainer,
      ]}
    >
      {message.role === 'assistant' && (
        <View style={styles.aiAvatar}>
          <Ionicons name="chatbubbles" size={16} color={theme.colors.primary[600]} />
        </View>
      )}
      
      <View
        style={[
          styles.messageBubble,
          message.role === 'user' ? styles.userMessageBubble : styles.aiMessageBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            message.role === 'user' ? styles.userMessageText : styles.aiMessageText,
          ]}
        >
          {message.content}
        </Text>
        
        {message.role === 'assistant' && renderContextSources(message.context_sources)}
        
        <Text
          style={[
            styles.messageTime,
            message.role === 'user' ? styles.userMessageTime : styles.aiMessageTime,
          ]}
        >
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      
      {message.role === 'user' && (
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={16} color={theme.colors.white} />
        </View>
      )}
    </View>
  );

  // Show loading indicator while initializing
  if (loading && !currentSession) {
    return (
      <SafeAreaView style={styles.container}>
        <Header 
          title="AI Tutor"
          leftAction={{
            icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
            onPress: handleBackPress,
          }}
        />
        <View style={styles.loadingContainer}>
          <LoadingIndicator size="large" />
          <Text style={styles.loadingText}>Starting chat session...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          onPress: () => {
            const usageText = usage 
              ? `\n\nUsage: ${usage.questionsUsed}/${usage.dailyLimit} questions today`
              : '';
            
            Alert.alert(
              isFromNote ? 'Note Chat' : 'AI Tutor',
              isFromNote 
                ? `Chat about "${noteTitle}". Ask questions about this specific content and get detailed explanations.${usageText}`
                : `Your personal AI tutor is here to help explain concepts, answer questions, and provide additional practice problems based on your learning materials.${usageText}`
            );
          },
        }}
      />
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {usage && (
        <View style={styles.usageContainer}>
          <Text style={styles.usageText}>
            {usage.remaining} questions remaining today
          </Text>
        </View>
      )}
      
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

        {messages.length === 0 && !loading && (
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
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim() && !loading ? styles.sendButtonActive : styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || loading}
            >
              {loading ? (
                <LoadingIndicator size="small" color={theme.colors.white} />
              ) : (
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={inputText.trim() && !loading ? theme.colors.white : theme.colors.gray[400]} 
                />
              )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
  },
  errorContainer: {
    backgroundColor: theme.colors.error[100],
    borderColor: theme.colors.error[600],
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.base,
    margin: theme.spacing.base,
  },
  errorText: {
    color: theme.colors.error[700],
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  usageContainer: {
    backgroundColor: theme.colors.primary[50],
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  usageText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
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
  sourcesContainer: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  sourcesTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.xs,
  },
  sourceItem: {
    marginBottom: theme.spacing.xs,
  },
  sourceTitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  sourceSectionTitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
    marginTop: 2,
  },
  sourceChunk: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    marginTop: 2,
    fontStyle: 'italic',
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