-- PDF Processing Tables
-- Tables for storing processed PDF documents and their extracted content

-- Table for storing processed documents
CREATE TABLE IF NOT EXISTS processed_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE, -- Path in Supabase Storage
    public_url TEXT NOT NULL,
    extracted_text TEXT, -- Raw extracted text from PDF
    cleaned_text TEXT, -- Cleaned and preprocessed text
    metadata JSONB, -- PDF metadata (title, author, page count, etc.)
    thumbnail_url TEXT, -- URL to thumbnail image if generated
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT, -- Error message if processing failed
    file_size BIGINT, -- File size in bytes
    page_count INTEGER, -- Number of pages in PDF
    word_count INTEGER, -- Approximate word count of extracted text
    processing_time_ms INTEGER, -- Time taken to process in milliseconds
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Who uploaded the document
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing document sections (chapters, headings, etc.)
CREATE TABLE IF NOT EXISTS document_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES processed_documents(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL, -- Internal section identifier
    title TEXT, -- Section title/heading
    content TEXT NOT NULL, -- Section content
    page_number INTEGER NOT NULL,
    start_position INTEGER NOT NULL, -- Character position in full text
    end_position INTEGER NOT NULL, -- Character position in full text
    section_type TEXT NOT NULL CHECK (section_type IN ('header', 'paragraph', 'list', 'table', 'footer', 'title', 'subtitle')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing document processing queue (for batch processing)
CREATE TABLE IF NOT EXISTS processing_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_path TEXT NOT NULL,
    processing_options JSONB, -- PDFProcessingOptions as JSON
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_processed_documents_file_path ON processed_documents(file_path);
CREATE INDEX IF NOT EXISTS idx_processed_documents_status ON processed_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_processed_documents_user_id ON processed_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_documents_created_at ON processed_documents(created_at);

CREATE INDEX IF NOT EXISTS idx_document_sections_document_id ON document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_page_number ON document_sections(page_number);
CREATE INDEX IF NOT EXISTS idx_document_sections_section_type ON document_sections(section_type);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON processing_queue(priority);
CREATE INDEX IF NOT EXISTS idx_processing_queue_scheduled_at ON processing_queue(scheduled_at);

-- Create full-text search indexes for content
CREATE INDEX IF NOT EXISTS idx_processed_documents_search_text 
ON processed_documents USING gin(to_tsvector('english', cleaned_text));

CREATE INDEX IF NOT EXISTS idx_document_sections_search_content 
ON document_sections USING gin(to_tsvector('english', content));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_processed_documents_updated_at 
    BEFORE UPDATE ON processed_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at 
    BEFORE UPDATE ON processing_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate word count from text
CREATE OR REPLACE FUNCTION calculate_word_count(input_text TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF input_text IS NULL OR input_text = '' THEN
        RETURN 0;
    END IF;
    
    -- Simple word count using space separation
    RETURN array_length(string_to_array(trim(input_text), ' '), 1);
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update word count when text changes
CREATE OR REPLACE FUNCTION update_word_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = calculate_word_count(NEW.cleaned_text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update word count
CREATE TRIGGER update_processed_documents_word_count 
    BEFORE INSERT OR UPDATE OF cleaned_text ON processed_documents 
    FOR EACH ROW EXECUTE FUNCTION update_word_count();

-- Views for common queries

-- View for documents with processing summary
CREATE OR REPLACE VIEW documents_summary AS
SELECT 
    id,
    original_file_name,
    file_path,
    processing_status,
    page_count,
    word_count,
    file_size,
    processing_time_ms,
    user_id,
    created_at,
    updated_at
FROM processed_documents
ORDER BY created_at DESC;

-- View for failed processing attempts
CREATE OR REPLACE VIEW failed_documents AS
SELECT 
    id,
    original_file_name,
    file_path,
    processing_error,
    created_at,
    updated_at
FROM processed_documents
WHERE processing_status = 'failed'
ORDER BY updated_at DESC;

-- View for document sections with document info
CREATE OR REPLACE VIEW document_sections_with_info AS
SELECT 
    ds.id,
    ds.section_id,
    ds.title,
    ds.content,
    ds.page_number,
    ds.section_type,
    pd.original_file_name,
    pd.file_path,
    pd.user_id,
    ds.created_at
FROM document_sections ds
JOIN processed_documents pd ON ds.document_id = pd.id
ORDER BY pd.created_at DESC, ds.page_number ASC, ds.start_position ASC;

-- Grant necessary permissions (adjust based on your RLS policies)
ALTER TABLE processed_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - users can only see their own documents)
CREATE POLICY "Users can view their own documents" ON processed_documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents" ON processed_documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON processed_documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON processed_documents
    FOR DELETE USING (auth.uid() = user_id);

-- Allow service role to access all documents for processing
CREATE POLICY "Service role can access all documents" ON processed_documents
    FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Similar policies for document_sections
CREATE POLICY "Users can view sections of their documents" ON document_sections
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM processed_documents pd 
        WHERE pd.id = document_sections.document_id 
        AND pd.user_id = auth.uid()
    ));

CREATE POLICY "Service role can access all sections" ON document_sections
    FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Processing queue policies (service role only)
CREATE POLICY "Service role can manage processing queue" ON processing_queue
    FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Comments for documentation
COMMENT ON TABLE processed_documents IS 'Stores processed PDF documents with extracted text and metadata';
COMMENT ON TABLE document_sections IS 'Stores extracted sections from PDF documents for structured content access';
COMMENT ON TABLE processing_queue IS 'Queue system for batch processing of PDF documents';

COMMENT ON COLUMN processed_documents.file_path IS 'Path to the file in Supabase Storage (unique identifier)';
COMMENT ON COLUMN processed_documents.extracted_text IS 'Raw text extracted from the PDF using PDF.js';
COMMENT ON COLUMN processed_documents.cleaned_text IS 'Preprocessed text with headers/footers removed and formatting cleaned';
COMMENT ON COLUMN processed_documents.metadata IS 'JSON object containing PDF metadata (title, author, creation date, etc.)';
COMMENT ON COLUMN processed_documents.processing_status IS 'Current processing status: pending, processing, completed, or failed';

COMMENT ON COLUMN document_sections.section_type IS 'Type of content: header, paragraph, list, table, footer, title, or subtitle';
COMMENT ON COLUMN document_sections.start_position IS 'Character position where this section starts in the full document text';
COMMENT ON COLUMN document_sections.end_position IS 'Character position where this section ends in the full document text'; 