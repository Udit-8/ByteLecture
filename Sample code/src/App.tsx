import React, { useState } from 'react';
import { HomePage } from './pages/HomePage';
import { ImportPage } from './pages/ImportPage';
import { SummaryPage } from './pages/SummaryPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { QuizPage } from './pages/QuizPage';
import { AudioPage } from './pages/AudioPage';
import { TutorPage } from './pages/TutorPage';
import { LandingPage } from './pages/LandingPage';
import { BottomNavigation } from './components/BottomNavigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
const AppContent: React.FC = () => {
  const {
    isAuthenticated
  } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  if (!isAuthenticated) {
    return <LandingPage />;
  }
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} />;
      case 'import':
        return <ImportPage />;
      case 'summary':
        return <SummaryPage />;
      case 'flashcards':
        return <FlashcardsPage />;
      case 'quiz':
        return <QuizPage />;
      case 'audio':
        return <AudioPage />;
      case 'tutor':
        return <TutorPage />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };
  return <div className="flex flex-col w-full h-screen bg-gray-50">
      {renderPage()}
      <BottomNavigation currentPage={currentPage} setCurrentPage={setCurrentPage} />
    </div>;
};
export function App() {
  return <AuthProvider>
      <AppContent />
    </AuthProvider>;
}