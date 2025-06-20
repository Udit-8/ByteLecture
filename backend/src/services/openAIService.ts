import OpenAI from 'openai';
import { ChatCompletionCreateParams } from 'openai/resources';

// Types for our OpenAI service
export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface SummarizationOptions {
  length?: 'short' | 'medium' | 'long';
  focusArea?: 'concepts' | 'examples' | 'applications' | 'general';
  contentType?: 'pdf' | 'youtube' | 'audio' | 'text';
  maxTokens?: number;
  temperature?: number;
}

export interface SummarizationResult {
  summary: string;
  tokensUsed: number;
  model: string;
  processingTime: number;
  metadata: {
    originalLength: number;
    compressionRatio: number;
    focusArea: string;
    length: string;
  };
}

export interface ChunkResult {
  chunks: string[];
  totalTokens: number;
  chunkCount: number;
}

export class OpenAIService {
  private client: OpenAI;
  private config: Required<OpenAIConfig>;
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second initial delay

  constructor(config: OpenAIConfig) {
    // Validate API key
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Set default configuration
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-3.5-turbo',
      maxTokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.3,
      timeout: config.timeout || 60000, // 60 seconds
    };

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
    });

    console.log(`🤖 OpenAI Service initialized with model: ${this.config.model}`);
  }

  /**
   * Estimate token count for text (approximate)
   */
  public estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Split content into chunks that fit within token limits
   */
  public chunkContent(content: string, maxTokensPerChunk: number = 3000): ChunkResult {
    const sentences = content.match(/[^\.!?]+[\.!?]+/g) || [content];
    const chunks: string[] = [];
    let currentChunk = '';
    let totalTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);
      const currentChunkTokens = this.estimateTokens(currentChunk);

      // If adding this sentence would exceed the limit, start a new chunk
      if (currentChunkTokens + sentenceTokens > maxTokensPerChunk && currentChunk) {
        chunks.push(currentChunk.trim());
        totalTokens += currentChunkTokens;
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    // Add the last chunk if not empty
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      totalTokens += this.estimateTokens(currentChunk);
    }

    return {
      chunks,
      totalTokens,
      chunkCount: chunks.length,
    };
  }

  /**
   * Generate a summary prompt based on content type and options
   */
  private generatePrompt(content: string, options: SummarizationOptions): string {
    const { length = 'medium', focusArea = 'general', contentType = 'text' } = options;

    // Base prompt templates for different content types
    const contentTypePrompts = {
      pdf: 'You are analyzing an academic or professional document.',
      youtube: 'You are analyzing a YouTube video transcript.',
      audio: 'You are analyzing an audio transcript from a lecture or recording.',
      text: 'You are analyzing text content.',
    };

    // Length specifications
    const lengthSpecs = {
      short: 'Create a concise summary in 2-3 sentences (50-100 words).',
      medium: 'Create a comprehensive summary in 1-2 paragraphs (150-300 words).',
      long: 'Create a detailed summary in 3-4 paragraphs (400-600 words).',
    };

    // Focus area specifications
    const focusSpecs = {
      concepts: 'Focus on key concepts, theories, and main ideas.',
      examples: 'Focus on examples, case studies, and practical applications.',
      applications: 'Focus on how the information can be applied practically.',
      general: 'Provide a balanced overview covering main points and supporting details.',
    };

    return `${contentTypePrompts[contentType]}

${lengthSpecs[length]}

${focusSpecs[focusArea]}

Guidelines:
- Use clear, professional language
- Maintain the original meaning and context
- Highlight the most important information
- Structure the summary logically
- Avoid unnecessary jargon unless essential

Content to summarize:
${content}

Summary:`;
  }

  /**
   * Make API call with retry logic
   */
  private async makeAPICallWithRetry(
    params: ChatCompletionCreateParams,
    attempt: number = 1
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      console.log(`🔄 OpenAI API call attempt ${attempt}/${this.retryAttempts}`);
      const response = await this.client.chat.completions.create({
        ...params,
        stream: false, // Ensure we get a non-streaming response
      });
      console.log(`✅ OpenAI API call successful on attempt ${attempt}`);
      return response;
    } catch (error: any) {
      console.error(`❌ OpenAI API call failed on attempt ${attempt}:`, error.message);

      if (attempt >= this.retryAttempts) {
        throw new Error(`OpenAI API failed after ${this.retryAttempts} attempts: ${error.message}`);
      }

      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.makeAPICallWithRetry(params, attempt + 1);
    }
  }

  /**
   * Generate summary for a single chunk of content
   */
  private async summarizeChunk(
    content: string,
    options: SummarizationOptions
  ): Promise<{ summary: string; tokensUsed: number }> {
    const prompt = this.generatePrompt(content, options);
    const startTime = Date.now();

    const params: ChatCompletionCreateParams = {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature || this.config.temperature,
    };

    const response = await this.makeAPICallWithRetry(params);
    const endTime = Date.now();

    console.log(`⏱️ OpenAI API call completed in ${endTime - startTime}ms`);

    const summary = response.choices[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    return { summary, tokensUsed };
  }

  /**
   * Generate summary for content (handles chunking automatically)
   */
  public async generateSummary(
    content: string,
    options: SummarizationOptions = {}
  ): Promise<SummarizationResult> {
    const startTime = Date.now();
    const originalLength = content.length;

    console.log(`📝 Starting summarization for ${originalLength} characters`);

    try {
      // Determine max tokens per chunk based on model and options
      const maxTokensPerChunk = 3000; // Safe limit for most models
      const { chunks, totalTokens } = this.chunkContent(content, maxTokensPerChunk);

      console.log(`📊 Content split into ${chunks.length} chunks, estimated ${totalTokens} tokens`);

      let finalSummary: string;
      let totalTokensUsed = 0;

      if (chunks.length === 1) {
        // Single chunk - direct summarization
        const result = await this.summarizeChunk(chunks[0], options);
        finalSummary = result.summary;
        totalTokensUsed = result.tokensUsed;
      } else {
        // Multiple chunks - summarize each then combine
        console.log(`🔄 Processing ${chunks.length} chunks...`);
        
        const chunkSummaries: string[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
          console.log(`📄 Processing chunk ${i + 1}/${chunks.length}`);
          const result = await this.summarizeChunk(chunks[i], {
            ...options,
            length: 'short', // Keep chunk summaries short
          });
          
          chunkSummaries.push(result.summary);
          totalTokensUsed += result.tokensUsed;
        }

        // Combine chunk summaries into final summary
        const combinedSummaries = chunkSummaries.join('\n\n');
        console.log(`🔗 Combining ${chunkSummaries.length} chunk summaries`);
        
        const finalResult = await this.summarizeChunk(combinedSummaries, options);
        finalSummary = finalResult.summary;
        totalTokensUsed += finalResult.tokensUsed;
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      const compressionRatio = originalLength / finalSummary.length;

      console.log(`✅ Summarization completed in ${processingTime}ms`);
      console.log(`📈 Compression ratio: ${compressionRatio.toFixed(2)}:1`);
      console.log(`🎯 Tokens used: ${totalTokensUsed}`);

      return {
        summary: finalSummary,
        tokensUsed: totalTokensUsed,
        model: this.config.model,
        processingTime,
        metadata: {
          originalLength,
          compressionRatio,
          focusArea: options.focusArea || 'general',
          length: options.length || 'medium',
        },
      };
    } catch (error: any) {
      console.error(`❌ Summarization failed:`, error.message);
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  /**
   * Test the OpenAI connection and configuration
   */
  public async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing OpenAI connection...');
      
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: 'Hello! Please respond with "Connection successful" to test the API.',
          },
        ],
        max_tokens: 10,
        temperature: 0,
        stream: false, // Ensure we get a non-streaming response
      });

      const message = response.choices[0]?.message?.content || '';
      const success = message.toLowerCase().includes('connection') || message.toLowerCase().includes('successful');
      
      console.log(success ? '✅ OpenAI connection test successful' : '⚠️ OpenAI connection test uncertain');
      return success;
    } catch (error: any) {
      console.error('❌ OpenAI connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<OpenAIConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<OpenAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Re-initialize client if API key changed
    if (newConfig.apiKey) {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        timeout: this.config.timeout,
      });
    }
    
    console.log('🔄 OpenAI configuration updated');
  }

  /**
   * Make a general chat completion API call (public method for external use)
   */
  public async createChatCompletion(
    params: ChatCompletionCreateParams
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.makeAPICallWithRetry(params);
  }
} 