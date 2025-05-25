import React, { createContext, useContext, useState } from 'react';

export type NavigationMode = 'main' | 'note-detail';

export interface Note {
  id: string;
  title: string;
  type: 'PDF' | 'YouTube' | 'Audio' | 'Text';
  date: string;
  progress: number;
  content?: any; // Additional content data
}

interface NavigationContextType {
  mode: NavigationMode;
  selectedNote: Note | null;
  setMainMode: () => void;
  setNoteDetailMode: (note: Note) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<NavigationMode>('main');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const setMainMode = () => {
    setMode('main');
    setSelectedNote(null);
  };

  const setNoteDetailMode = (note: Note) => {
    setMode('note-detail');
    setSelectedNote(note);
  };

  const value: NavigationContextType = {
    mode,
    selectedNote,
    setMainMode,
    setNoteDetailMode,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}; 