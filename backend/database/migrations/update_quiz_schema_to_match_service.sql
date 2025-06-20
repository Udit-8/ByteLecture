-- Migration: Update quiz schema to match QuizService expectations
-- This migration updates the existing quiz tables to align with the QuizService interface

-- First, rename the quizzes table to quiz_sets to match service expectations
ALTER TABLE public.quizzes RENAME TO quiz_sets;

-- Add missing columns to quiz_sets table
ALTER TABLE public.quiz_sets 
ADD COLUMN total_questions INTEGER DEFAULT 0,
ADD COLUMN estimated_duration INTEGER DEFAULT 0, -- in minutes
ADD COLUMN difficulty TEXT DEFAULT 'medium',
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Update the quiz_questions table to match QuizService expectations
ALTER TABLE public.quiz_questions 
ADD COLUMN question_type TEXT DEFAULT 'multiple_choice',
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN source_section TEXT;

-- Rename the foreign key column to match the new table name
ALTER TABLE public.quiz_questions RENAME COLUMN quiz_id TO quiz_set_id;

-- Add the missing quiz_set_id foreign key constraint
ALTER TABLE public.quiz_questions 
DROP CONSTRAINT IF EXISTS quiz_questions_quiz_id_fkey,
ADD CONSTRAINT quiz_questions_quiz_set_id_fkey 
FOREIGN KEY (quiz_set_id) REFERENCES public.quiz_sets(id) ON DELETE CASCADE;

-- Update quiz_attempts table
ALTER TABLE public.quiz_attempts 
RENAME COLUMN quiz_id TO quiz_set_id;

-- Add missing time_spent column and update existing data
ALTER TABLE public.quiz_attempts 
ADD COLUMN time_spent INTEGER; -- in seconds

-- Update existing records to use time_spent instead of time_taken
UPDATE public.quiz_attempts 
SET time_spent = time_taken 
WHERE time_taken IS NOT NULL;

-- Drop the old time_taken column after data migration
ALTER TABLE public.quiz_attempts 
DROP COLUMN IF EXISTS time_taken;

-- Update the foreign key constraint
ALTER TABLE public.quiz_attempts 
DROP CONSTRAINT IF EXISTS quiz_attempts_quiz_id_fkey,
ADD CONSTRAINT quiz_attempts_quiz_set_id_fkey 
FOREIGN KEY (quiz_set_id) REFERENCES public.quiz_sets(id) ON DELETE CASCADE;

-- Update indexes to reflect the new column names
DROP INDEX IF EXISTS idx_quizzes_user_id;
DROP INDEX IF EXISTS idx_quizzes_content_item;
DROP INDEX IF EXISTS idx_quiz_questions_quiz_id;
DROP INDEX IF EXISTS idx_quiz_attempts_quiz_id;

-- Create new indexes with correct names
CREATE INDEX idx_quiz_sets_user_id ON public.quiz_sets(user_id);
CREATE INDEX idx_quiz_sets_content_item ON public.quiz_sets(content_item_id);
CREATE INDEX idx_quiz_questions_quiz_set_id ON public.quiz_questions(quiz_set_id);
CREATE INDEX idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_set_id ON public.quiz_attempts(quiz_set_id);

-- Update RLS policies to use the new table name
DROP POLICY IF EXISTS "Users can view own quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can insert own quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can update own quizzes" ON public.quiz_sets;
DROP POLICY IF EXISTS "Users can delete own quizzes" ON public.quiz_sets;

-- Recreate RLS policies for quiz_sets
CREATE POLICY "Users can view own quiz sets" ON public.quiz_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz sets" ON public.quiz_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz sets" ON public.quiz_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quiz sets" ON public.quiz_sets
  FOR DELETE USING (auth.uid() = user_id);

-- Update quiz_questions policies to reference the correct table
DROP POLICY IF EXISTS "Users can view own quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Users can insert own quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Users can update own quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Users can delete own quiz questions" ON public.quiz_questions;

-- Recreate quiz_questions policies with correct references
CREATE POLICY "Users can view own quiz questions" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sets 
      WHERE id = quiz_set_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own quiz questions" ON public.quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_sets 
      WHERE id = quiz_set_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own quiz questions" ON public.quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sets 
      WHERE id = quiz_set_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own quiz questions" ON public.quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sets 
      WHERE id = quiz_set_id AND user_id = auth.uid()
    )
  );

-- Update quiz_attempts policies to reference the correct table
DROP POLICY IF EXISTS "Users can view own quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can insert own quiz attempts" ON public.quiz_attempts;

-- Recreate quiz_attempts policies with correct references
CREATE POLICY "Users can view own quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update the updated_at trigger
DROP TRIGGER IF EXISTS update_quizzes_updated_at ON public.quiz_sets;
CREATE TRIGGER update_quiz_sets_updated_at
  BEFORE UPDATE ON public.quiz_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comment for documentation
COMMENT ON TABLE public.quiz_sets IS 'Stores AI-generated quiz sets linked to content items';
COMMENT ON TABLE public.quiz_questions IS 'Individual questions within quiz sets with multiple choice options';
COMMENT ON TABLE public.quiz_attempts IS 'User attempts at completing quizzes with scores and timing';

COMMENT ON COLUMN public.quiz_sets.total_questions IS 'Total number of questions in this quiz set';
COMMENT ON COLUMN public.quiz_sets.estimated_duration IS 'Estimated time to complete quiz in minutes';
COMMENT ON COLUMN public.quiz_sets.difficulty IS 'Overall difficulty level: easy, medium, hard, or mixed';
COMMENT ON COLUMN public.quiz_sets.metadata IS 'Additional quiz metadata including averageDifficulty, questionTypes, focusArea';

COMMENT ON COLUMN public.quiz_questions.question_type IS 'Type of question: multiple_choice, true_false, fill_blank';
COMMENT ON COLUMN public.quiz_questions.tags IS 'Array of topic tags for categorization';
COMMENT ON COLUMN public.quiz_questions.source_section IS 'Section of source content this question was derived from';

COMMENT ON COLUMN public.quiz_attempts.time_spent IS 'Time spent completing the quiz in seconds'; 