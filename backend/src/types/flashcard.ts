export interface FlashcardGenerationOptions {
  contentType?: 'pdf' | 'youtube' | 'lecture_recording' | 'text';
  numberOfCards?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  focusArea?:
    | 'concepts'
    | 'definitions'
    | 'examples'
    | 'applications'
    | 'facts'
    | 'general';
  questionTypes?: (
    | 'definition'
    | 'concept'
    | 'example'
    | 'application'
    | 'factual'
  )[];
  maxTokens?: number;
  temperature?: number;
}

export interface Flashcard {
  question: string;
  answer: string;
  difficulty_level: number; // 1-5 scale
  explanation?: string;
  tags?: string[];
  source_section?: string;
}

export interface FlashcardSet {
  title: string;
  description?: string;
  flashcards: Flashcard[];
  metadata: {
    totalCards: number;
    averageDifficulty: number;
    contentType: string;
    focusArea: string;
    generatedAt: string;
  };
}

export interface FlashcardGenerationResult {
  flashcardSet: FlashcardSet;
  tokensUsed: number;
  model: string;
  processingTime: number;
  metadata: {
    originalContentLength: number;
    cardsGenerated: number;
    averageDifficulty: number;
    focusArea: string;
    questionTypes: string[];
  };
}

export interface DatabaseFlashcardSet {
  id: string;
  user_id: string;
  content_item_id?: string;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseFlashcard {
  id: string;
  flashcard_set_id: string;
  question: string;
  answer: string;
  difficulty_level: number;
  created_at: string;
}

export interface FlashcardValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
