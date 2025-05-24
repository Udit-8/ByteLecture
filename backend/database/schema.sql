-- ByteLecture Database Schema
-- This file contains all the database tables and relationships for the ByteLecture app

-- Enable Row Level Security
-- Replace the JWT secret below with your actual JWT_SECRET from .env file
--ALTER DATABASE postgres SET "app.jwt_secret" TO 'GCdwHsHG8PDF0adze+G6QcLZTMeZtPnTb1TRlkS76f228li8069kFVpxiuv45XTiFPI0gNZzJF2ra3lFtIa78A==';

-- Create custom types
CREATE TYPE content_type AS ENUM ('pdf', 'youtube', 'lecture_recording');
CREATE TYPE plan_type AS ENUM ('free', 'premium', 'enterprise');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan_type plan_type DEFAULT 'free',
  plan_expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content items table
CREATE TABLE public.content_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type content_type NOT NULL,
  file_url TEXT, -- For PDFs and recordings
  youtube_url TEXT, -- For YouTube videos
  youtube_video_id TEXT, -- Extracted YouTube video ID
  file_size BIGINT, -- File size in bytes
  duration INTEGER, -- Duration in seconds (for videos/audio)
  processed BOOLEAN DEFAULT FALSE, -- Whether AI processing is complete
  summary TEXT, -- AI-generated summary
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flashcard sets table
CREATE TABLE public.flashcard_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual flashcards table
CREATE TABLE public.flashcards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flashcard_set_id UUID REFERENCES public.flashcard_sets(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE public.quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz questions table
CREATE TABLE public.quiz_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of answer options
  correct_answer INTEGER NOT NULL, -- Index of correct answer (0-based)
  explanation TEXT,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User quiz attempts table
CREATE TABLE public.quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_taken INTEGER, -- Time in seconds
  answers JSONB, -- User's answers
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User study sessions table
CREATE TABLE public.study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL, -- 'flashcards', 'quiz', 'reading'
  duration INTEGER, -- Duration in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_content_items_user_id ON public.content_items(user_id);
CREATE INDEX idx_content_items_type ON public.content_items(content_type);
CREATE INDEX idx_flashcard_sets_user_id ON public.flashcard_sets(user_id);
CREATE INDEX idx_flashcard_sets_content_item ON public.flashcard_sets(content_item_id);
CREATE INDEX idx_flashcards_set_id ON public.flashcards(flashcard_set_id);
CREATE INDEX idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX idx_quizzes_content_item ON public.quizzes(content_item_id);
CREATE INDEX idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX idx_study_sessions_user_id ON public.study_sessions(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can only access their own content
CREATE POLICY "Users can view own content" ON public.content_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content" ON public.content_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content" ON public.content_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own content" ON public.content_items
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for flashcard sets
CREATE POLICY "Users can view own flashcard sets" ON public.flashcard_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcard sets" ON public.flashcard_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcard sets" ON public.flashcard_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcard sets" ON public.flashcard_sets
  FOR DELETE USING (auth.uid() = user_id);

-- Flashcards policies (through flashcard_sets)
CREATE POLICY "Users can view own flashcards" ON public.flashcards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets 
      WHERE id = flashcard_set_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own flashcards" ON public.flashcards
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets 
      WHERE id = flashcard_set_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own flashcards" ON public.flashcards
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets 
      WHERE id = flashcard_set_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own flashcards" ON public.flashcards
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_sets 
      WHERE id = flashcard_set_id AND user_id = auth.uid()
    )
  );

-- Similar policies for quizzes
CREATE POLICY "Users can view own quizzes" ON public.quizzes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quizzes" ON public.quizzes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quizzes" ON public.quizzes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quizzes" ON public.quizzes
  FOR DELETE USING (auth.uid() = user_id);

-- Quiz questions policies (through quizzes)
CREATE POLICY "Users can view own quiz questions" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes 
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own quiz questions" ON public.quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes 
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own quiz questions" ON public.quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes 
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own quiz questions" ON public.quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes 
      WHERE id = quiz_id AND user_id = auth.uid()
    )
  );

-- Quiz attempts policies
CREATE POLICY "Users can view own quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Study sessions policies
CREATE POLICY "Users can view own study sessions" ON public.study_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study sessions" ON public.study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions

-- Function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_items_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_flashcard_sets_updated_at
  BEFORE UPDATE ON public.flashcard_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column(); 