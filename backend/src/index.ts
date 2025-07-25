import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// -------------------------------------------------------------
// Global error handlers – keep the server alive during dev 🛡️
// -------------------------------------------------------------

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  // Prevent hard crash in development; in production you might want to exit(1)
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  // Prevent hard crash in development
});

// Import routes
import authRoutes from './routes/auth';
import pdfRoutes from './routes/pdfRoutes';
import youtubeRoutes from './routes/youtube';
import audioRoutes from './routes/audioRoutes';
import paymentRoutes from './routes/paymentRoutes';
import summaryRoutes from './routes/summaryRoutes';
import flashcardRoutes from './routes/flashcardRoutes';
import quizRoutes from './routes/quizRoutes';
import contentRoutes from './routes/contentRoutes';
import chatRoutes from './routes/chatRoutes';
import mindMapRoutes from './routes/mindMapRoutes';
import syncRoutes from './routes/syncRoutes';
import cronRoutes from './routes/cronRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for mobile app
app.use(morgan('combined')); // Logging
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies

// Request timeout middleware
app.use((req, res, next) => {
  // Set timeout for all requests (5 minutes for AI operations)
  const timeout = req.path.includes('/summaries/generate') || 
                 req.path.includes('/flashcards/generate') || 
                 req.path.includes('/quizzes/generate') ||
                 req.path.includes('/youtube/process') ||
                 req.path.includes('/audio/transcribe') ? 300000 : 30000;
  
  req.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  next();
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ByteLecture API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/mindmaps', mindMapRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/cron', cronRoutes);

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'ByteLecture API is running!',
    version: '1.0.0',
    endpoints: ['/api/health', '/api/auth', '/api/pdf', '/api/youtube'],
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('❌ Unhandled server error:', err.stack);
    
    // Ensure we always send JSON responses
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    message: `The requested endpoint ${req.originalUrl} does not exist.`,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 ByteLecture Backend running on port ${PORT}`);
  console.log(`📱 Ready to serve the mobile app!`);
});
