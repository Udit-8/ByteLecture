import { supabase, supabaseAdmin } from '../config/supabase';
import { OpenAIService } from './openAIService';
import {
  ChatSession,
  ChatMessage,
  ContentEmbedding,
  ContextSource,
  SimilaritySearchResult,
  ChatPromptContext,
  CHAT_CONFIG,
} from '../types/chat';
import { createClient } from '@supabase/supabase-js';

export class ChatService {
  private openAIService: OpenAIService;

  constructor() {
    this.openAIService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
    });
  }

  /**
   * Create a user-authenticated Supabase client
   */
  private getUserAuthClient(userToken?: string) {
    if (!userToken) {
      return supabase; // Fallback to regular client
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    return userClient;
  }

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    title?: string,
    contextContentIds: string[] = [],
    userToken?: string
  ): Promise<ChatSession> {
    console.log('💬 ChatService: Creating session for user:', userId);
    console.log('💬 ChatService: Token provided:', !!userToken);
    console.log('💬 ChatService: Context content IDs:', contextContentIds);

    // Use service role key to bypass RLS temporarily for insert
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title: title || 'New Chat',
        context_content_ids: contextContentIds,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating chat session:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw new Error('Failed to create chat session');
    }

    console.log('✅ Chat session created successfully:', data.id);
    return data;
  }

  /**
   * Get user's chat sessions with pagination
   */
  async getUserSessions(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ sessions: ChatSession[]; total: number }> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching chat sessions:', error);
      throw new Error('Failed to fetch chat sessions');
    }

    return {
      sessions: data || [],
      total: count || 0,
    };
  }

  /**
   * Get messages for a chat session
   */
  async getSessionMessages(
    sessionId: string,
    userId: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: ChatMessage[]; total: number }> {
    // First verify the session belongs to the user
    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      throw new Error('Chat session not found or unauthorized');
    }

    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching chat messages:', error);
      throw new Error('Failed to fetch chat messages');
    }

    return {
      messages: data || [],
      total: count || 0,
    };
  }

  /**
   * Generate embeddings for content
   */
  async generateContentEmbeddings(
    contentItemId: string,
    forceRegenerate = false
  ): Promise<number> {
    console.log('🔍 Generating embeddings for content item:', contentItemId, {
      forceRegenerate,
    });

    // Check if embeddings already exist
    if (!forceRegenerate) {
      const { count } = await supabaseAdmin
        .from('content_embeddings')
        .select('id', { count: 'exact' })
        .eq('content_item_id', contentItemId);

      if (count && count > 0) {
        console.log('📚 Found existing embeddings:', count);
        return count;
      }
    }

    // Get the content item
    const { data: contentItem, error: contentError } = await supabaseAdmin
      .from('content_items')
      .select('*')
      .eq('id', contentItemId)
      .single();

    if (contentError || !contentItem) {
      console.error('❌ Content item not found:', contentError);
      throw new Error('Content item not found');
    }

    console.log('📄 Content item found:', {
      id: contentItem.id,
      title: contentItem.title,
      type: contentItem.content_type,
    });

    // Get the full content text (same logic as getFullProcessedContent)
    let fullText = '';

    if (contentItem.content_type === 'pdf') {
      // For PDFs, get processed text from processed_documents table
      const { data: pdfData, error: pdfError } = await supabaseAdmin
        .from('processed_documents')
        .select('extracted_text, cleaned_text, metadata')
        .eq('file_path', contentItem.file_url)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!pdfError && pdfData) {
        fullText = pdfData.cleaned_text || pdfData.extracted_text || '';
        console.log('📑 Retrieved PDF text, length:', fullText.length);
      } else {
        console.warn('⚠️ No processed PDF data found, falling back to summary');
        fullText = contentItem.summary || '';
      }
    } else if (contentItem.content_type === 'youtube') {
      // For YouTube videos, get transcript from processed_videos table
      const { data: youtubeData, error: youtubeError } = await supabaseAdmin
        .from('processed_videos')
        .select('transcript, video_metadata')
        .eq('video_id', contentItem.youtube_video_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!youtubeError && youtubeData) {
        fullText = youtubeData.transcript || '';
        console.log(
          '🎥 Retrieved YouTube transcript, length:',
          fullText.length
        );
      } else {
        console.warn(
          '⚠️ No processed YouTube data found, falling back to summary'
        );
        fullText = contentItem.summary || '';
      }
    } else if (contentItem.content_type === 'lecture_recording') {
      // For lecture recordings, get transcription from transcriptions table
      const { data: audioData, error: audioError } = await supabaseAdmin
        .from('transcriptions')
        .select('transcript, confidence, processing_metadata')
        .eq('file_url', contentItem.file_url)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!audioError && audioData) {
        fullText = audioData.transcript || '';
        console.log('🎤 Retrieved audio transcript, length:', fullText.length);
      } else {
        console.warn('⚠️ No transcription data found, falling back to summary');
        fullText = contentItem.summary || '';
      }
    }

    if (!fullText || fullText.trim().length === 0) {
      console.error('❌ No content available for embedding generation');
      throw new Error('No content available for embedding generation');
    }

    console.log('✅ Full text retrieved, length:', fullText.length);

    // Split content into chunks (approx 500 words per chunk)
    console.log('✂️ Splitting text into chunks...');
    const chunks = this.splitTextIntoChunks(fullText, 500);
    console.log(`📋 Generated ${chunks.length} chunks for processing`);

    // Clear existing embeddings if regenerating
    if (forceRegenerate) {
      console.log('🧹 Clearing existing embeddings...');
      await supabaseAdmin
        .from('content_embeddings')
        .delete()
        .eq('content_item_id', contentItemId);
    }

    // Generate embeddings for each chunk
    const embeddings: ContentEmbedding[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(
        `🔄 Processing chunk ${i + 1}/${chunks.length} (length: ${chunk.text.length})`
      );

      try {
        // Generate embedding using OpenAI
        console.log(`🧠 Generating embedding for chunk ${i + 1}...`);
        const embedding = await this.openAIService.generateEmbedding(
          chunk.text
        );

        const { data, error } = await supabaseAdmin
          .from('content_embeddings')
          .insert({
            content_item_id: contentItemId,
            section_title: chunk.title || `Section ${i + 1}`,
            section_text: chunk.text,
            section_index: i,
            embedding: embedding,
            metadata: {
              word_count: chunk.text.split(' ').length,
              chunk_index: i,
              total_chunks: chunks.length,
            },
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Error storing embedding:', error);
          continue; // Continue with next chunk
        }

        embeddings.push(data);
        console.log(`✅ Stored embedding ${i + 1}/${chunks.length}`);
      } catch (error) {
        console.error('❌ Error generating embedding for chunk:', error);
        continue; // Continue with next chunk
      }
    }

    console.log(
      `🎉 Embedding generation complete! Generated ${embeddings.length} embeddings`
    );
    return embeddings.length;
  }

  /**
   * Find similar content based on user query
   */
  async findSimilarContent(
    userQuery: string,
    userId: string,
    contextContentIds?: string[],
    limit = CHAT_CONFIG.MAX_CONTEXT_SOURCES
  ): Promise<SimilaritySearchResult[]> {
    // Generate embedding for the user query
    const queryEmbedding =
      await this.openAIService.generateEmbedding(userQuery);

    // Build the query with proper filters
    let query = supabaseAdmin.from('content_embeddings').select(`
        *,
        content_items!inner(id, title, content_type, user_id)
      `);

    // Filter by user's content
    query = query.eq('content_items.user_id', userId);

    // If specific content IDs provided, filter by them
    if (contextContentIds && contextContentIds.length > 0) {
      query = query.in('content_item_id', contextContentIds);
    }

    const { data: embeddings, error } = await query;

    if (error) {
      console.error('Error fetching embeddings:', error);
      throw new Error('Failed to search content');
    }

    if (!embeddings || embeddings.length === 0) {
      return [];
    }

    // Calculate cosine similarity and sort by relevance
    const results: SimilaritySearchResult[] = embeddings
      .map((embedding: any) => {
        // Debug the embedding format
        console.log('🔍 Query embedding length:', queryEmbedding.length);
        console.log(
          '🔍 Stored embedding type:',
          typeof embedding.embedding,
          'length:',
          embedding.embedding?.length
        );

        // Convert PostgreSQL vector to JavaScript array if needed
        let storedEmbedding = embedding.embedding;
        if (typeof storedEmbedding === 'string') {
          // If it's a string representation of vector, parse it
          storedEmbedding = JSON.parse(storedEmbedding);
        } else if (storedEmbedding && !Array.isArray(storedEmbedding)) {
          // If it's a PostgreSQL vector object, convert to array
          storedEmbedding = Array.from(storedEmbedding);
        }

        console.log('🔍 Converted embedding length:', storedEmbedding?.length);

        const similarity = this.calculateCosineSimilarity(
          queryEmbedding,
          storedEmbedding
        );

        return {
          content_embedding: embedding,
          similarity_score: similarity,
          content_item: {
            id: embedding.content_items.id,
            title: embedding.content_items.title,
            content_type: embedding.content_items.content_type,
          },
        };
      })
      .filter(
        (result) => result.similarity_score >= CHAT_CONFIG.SIMILARITY_THRESHOLD
      )
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    return results;
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    sessionId: string,
    userId: string,
    userMessage: string,
    contextContentIds?: string[]
  ): Promise<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    usageInfo: {
      remaining_questions: number;
      daily_limit: number;
      current_usage: number;
    };
  }> {
    console.log('💬 ChatService: sendMessage called:', {
      sessionId,
      userId,
      messageLength: userMessage.length,
    });

    // Check usage limits
    console.log('💬 Checking usage limits...');
    const { canProceed, usage } = await this.checkUsageLimit(userId);
    console.log('💬 Usage check result:', { canProceed, usage });

    if (!canProceed) {
      throw new Error(
        'Daily chat limit exceeded. Please upgrade your plan or try again tomorrow.'
      );
    }

    // Verify session belongs to user
    console.log('💬 ChatService: Verifying session access:', {
      sessionId,
      userId,
    });
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError) {
      console.error('❌ Session lookup error:', sessionError);
      throw new Error('Failed to verify session access');
    }

    if (!session) {
      console.error('❌ Session not found or unauthorized:', {
        sessionId,
        userId,
      });
      throw new Error('Chat session not found or unauthorized');
    }

    console.log('✅ Session verified successfully:', session.id);

    // Store user message
    console.log('💬 Storing user message...');
    const { data: userMsg, error: userMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
        context_sources: [],
      })
      .select()
      .single();

    if (userMsgError) {
      console.error('❌ Failed to store user message:', userMsgError);
      throw new Error('Failed to store user message');
    }
    console.log('✅ User message stored successfully:', userMsg.id);

    try {
      // Find relevant content
      const contentIds = contextContentIds || session.context_content_ids;
      console.log('💬 Finding similar content with IDs:', contentIds);
      const similarContent = await this.findSimilarContent(
        userMessage,
        userId,
        contentIds
      );
      console.log('✅ Found', similarContent.length, 'similar content pieces');

      // Get conversation history (last 10 messages for context)
      const { messages: recentMessages } = await this.getSessionMessages(
        sessionId,
        userId,
        1,
        10
      );

      // Build context for AI prompt
      const promptContext: ChatPromptContext = {
        user_question: userMessage,
        similar_content: similarContent,
        conversation_history: recentMessages.slice(-10), // Last 10 messages
        user_plan: 'free', // TODO: Get from user profile
      };

      // Generate AI response
      console.log('💬 Generating AI response...');
      const aiResponse = await this.generateAIResponse(promptContext);
      console.log(
        '✅ AI response generated, length:',
        aiResponse.content.length
      );

      // Store assistant message
      const contextSources: ContextSource[] = similarContent.map((result) => ({
        content_item_id: result.content_item.id,
        content_title: result.content_item.title,
        section_title: result.content_embedding.section_title || undefined,
        section_text: result.content_embedding.section_text,
        relevance_score: result.similarity_score,
      }));

      const { data: assistantMsg, error: assistantMsgError } =
        await supabaseAdmin
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            role: 'assistant',
            content: aiResponse.content,
            context_sources: contextSources,
            token_usage: aiResponse.token_usage,
          })
          .select()
          .single();

      if (assistantMsgError) {
        throw new Error('Failed to store assistant message');
      }

      // Increment usage count
      await this.incrementUsage(userId);

      // Update session timestamp
      await supabaseAdmin
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      return {
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        usageInfo: {
          remaining_questions: usage.remaining_questions - 1,
          daily_limit: usage.daily_limit,
          current_usage: usage.current_usage + 1,
        },
      };
    } catch (error) {
      console.error('Error generating AI response:', error);

      // Store error message
      const { data: errorMsg } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content:
            'I apologize, but I encountered an error while processing your question. Please try again.',
          context_sources: [],
          error_info: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        .select()
        .single();

      return {
        userMessage: userMsg,
        assistantMessage: errorMsg!,
        usageInfo: usage,
      };
    }
  }

  /**
   * Check if user can send more messages today
   */
  async checkUsageLimit(userId: string): Promise<{
    canProceed: boolean;
    usage: {
      remaining_questions: number;
      daily_limit: number;
      current_usage: number;
    };
  }> {
    // Get user's plan type
    const { data: user } = await supabase
      .from('users')
      .select('plan_type')
      .eq('id', userId)
      .single();

    const planType = user?.plan_type || 'free';
    const dailyLimit =
      planType === 'free'
        ? CHAT_CONFIG.FREE_TIER_DAILY_LIMIT
        : CHAT_CONFIG.PREMIUM_TIER_DAILY_LIMIT;

    // Get current usage
    const { data: usage } = await supabase.rpc('get_chat_usage', {
      p_user_id: userId,
    });

    const currentUsage = usage || 0;
    const remaining = Math.max(0, dailyLimit - currentUsage);

    return {
      canProceed: remaining > 0,
      usage: {
        remaining_questions: remaining,
        daily_limit: dailyLimit,
        current_usage: currentUsage,
      },
    };
  }

  /**
   * Increment user's daily chat usage
   */
  private async incrementUsage(userId: string): Promise<void> {
    await supabase.rpc('increment_chat_usage', { p_user_id: userId });
  }

  /**
   * Generate AI response using OpenAI with context
   */
  private async generateAIResponse(context: ChatPromptContext): Promise<{
    content: string;
    token_usage: any;
  }> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = context.user_question;

    const response = await this.openAIService.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      ...context.conversation_history.slice(-6).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userPrompt },
    ]);

    return {
      content: response.content,
      token_usage: response.usage,
    };
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(context: ChatPromptContext): string {
    let prompt = `You are an AI tutor for ByteLecture, helping students understand their uploaded learning materials. You should:

1. Be helpful, accurate, and educational
2. Base your responses on the provided context from the user's content
3. If the question can't be answered from the context, say so politely
4. Encourage further learning and exploration
5. Use clear, student-friendly language

`;

    if (context.similar_content.length > 0) {
      prompt += `\nRELEVANT CONTENT CONTEXT:\n`;
      context.similar_content.forEach((content, index) => {
        prompt += `\n${index + 1}. From "${content.content_item.title}":\n`;
        if (content.content_embedding.section_title) {
          prompt += `   Section: ${content.content_embedding.section_title}\n`;
        }
        prompt += `   Content: ${content.content_embedding.section_text.substring(0, 500)}...\n`;
      });

      prompt += `\nPlease base your response primarily on this context. If you reference specific information, you can mention which source it comes from.`;
    } else {
      prompt += `\nNo relevant content found in the user's materials for this question. Let them know that you can help them better if they have relevant content uploaded, or provide general educational guidance if appropriate.`;
    }

    return prompt;
  }

  /**
   * Split text into manageable chunks for embedding
   */
  private splitTextIntoChunks(
    text: string,
    wordsPerChunk = 500
  ): Array<{
    text: string;
    title?: string;
  }> {
    const words = text.split(/\s+/);
    const chunks: Array<{ text: string; title?: string }> = [];

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunkText = chunkWords.join(' ');

      // Try to extract a title from the first line or sentence
      const firstSentence = chunkText.split(/[.!?]/)[0];
      const title =
        firstSentence.length > 100 ? undefined : firstSentence.trim();

      chunks.push({
        text: chunkText,
        title,
      });
    }

    return chunks;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(
    vectorA: number[],
    vectorB: number[]
  ): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Delete a chat session and all its messages
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    // Verify session belongs to user
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      throw new Error('Chat session not found or unauthorized');
    }

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      throw new Error('Failed to delete chat session');
    }
  }

  /**
   * Update session title
   */
  async updateSessionTitle(
    sessionId: string,
    userId: string,
    title: string
  ): Promise<void> {
    if (title.length > CHAT_CONFIG.MAX_SESSION_TITLE_LENGTH) {
      throw new Error('Session title too long');
    }

    const { error } = await supabase
      .from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to update session title');
    }
  }
}

export const chatService = new ChatService();
