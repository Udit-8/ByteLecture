import React, { createContext, useContext, useState, useRef } from 'react';

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
  notifyTabSwitch: (targetTab: string) => void;
}

interface ContentRefreshContextType {
  refreshContent: () => Promise<void>;
  setRefreshHandler: (handler: () => Promise<void>) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined
);
const ContentRefreshContext = createContext<
  ContentRefreshContextType | undefined
>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setMode] = useState<NavigationMode>('main');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const refreshHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const setMainMode = () => {
    setMode('main');
    setSelectedNote(null);
  };

  const setNoteDetailMode = (note: Note) => {
    setMode('note-detail');
    setSelectedNote(note);
  };

  const notifyTabSwitch = (targetTab: string) => {
    console.log(`Tab switch to: ${targetTab}`);
    // Handle tab switch logic here
  };

  const setRefreshHandler = (handler: () => Promise<void>) => {
    refreshHandlerRef.current = handler;
  };

  const refreshContent = async () => {
    if (refreshHandlerRef.current) {
      console.log('🔄 Triggering global content refresh...');
      await refreshHandlerRef.current();
    } else {
      console.warn('⚠️ No refresh handler registered');
    }
  };

  const navigationValue: NavigationContextType = {
    mode,
    selectedNote,
    setMainMode,
    setNoteDetailMode,
    notifyTabSwitch,
  };

  const contentRefreshValue: ContentRefreshContextType = {
    refreshContent,
    setRefreshHandler,
  };

  return (
    <NavigationContext.Provider value={navigationValue}>
      <ContentRefreshContext.Provider value={contentRefreshValue}>
        {children}
      </ContentRefreshContext.Provider>
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

export const useContentRefresh = () => {
  const context = useContext(ContentRefreshContext);
  if (context === undefined) {
    throw new Error(
      'useContentRefresh must be used within a NavigationProvider'
    );
  }
  return context;
};
