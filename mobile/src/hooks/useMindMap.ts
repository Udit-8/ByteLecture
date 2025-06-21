import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { 
  mindMapAPI, 
  MindMap, 
  CreateMindMapRequest, 
  UpdateMindMapRequest,
  MindMapExportOptions 
} from '../services/mindMapAPI';

interface UseMindMapResult {
  // State
  mindMaps: MindMap[];
  currentMindMap: MindMap | null;
  loading: boolean;
  error: string | null;
  generating: boolean;
  
  // Actions
  loadMindMaps: () => Promise<void>;
  loadMindMap: (id: string) => Promise<void>;
  generateMindMap: (request: CreateMindMapRequest) => Promise<MindMap | null>;
  updateMindMap: (id: string, updates: UpdateMindMapRequest) => Promise<void>;
  deleteMindMap: (id: string) => Promise<void>;
  exportMindMap: (id: string, options: MindMapExportOptions) => Promise<string | null>;
  clearError: () => void;
  clearCurrentMindMap: () => void;
}

export const useMindMap = (): UseMindMapResult => {
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [currentMindMap, setCurrentMindMap] = useState<MindMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearCurrentMindMap = useCallback(() => {
    setCurrentMindMap(null);
  }, []);

  /**
   * Load all mind maps for the user
   */
  const loadMindMaps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const maps = await mindMapAPI.getMindMaps();
      setMindMaps(maps);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load mind maps';
      setError(errorMessage);
      console.error('Error loading mind maps:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load a specific mind map
   */
  const loadMindMap = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const mindMap = await mindMapAPI.getMindMap(id);
      setCurrentMindMap(mindMap);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load mind map';
      setError(errorMessage);
      console.error('Error loading mind map:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Generate a new mind map
   */
  const generateMindMap = useCallback(async (request: CreateMindMapRequest): Promise<MindMap | null> => {
    try {
      setGenerating(true);
      setError(null);
      
      const mindMap = await mindMapAPI.generateMindMap(request);
      
      // Add to the list of mind maps
      setMindMaps(prev => [mindMap, ...prev]);
      setCurrentMindMap(mindMap);
      
      return mindMap;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate mind map';
      setError(errorMessage);
      console.error('Error generating mind map:', err);
      
      // Show user-friendly error
      Alert.alert(
        'Generation Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
      
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  /**
   * Update a mind map
   */
  const updateMindMap = useCallback(async (id: string, updates: UpdateMindMapRequest) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedMindMap = await mindMapAPI.updateMindMap(id, updates);
      
      // Update in the list
      setMindMaps(prev => 
        prev.map(map => map.id === id ? updatedMindMap : map)
      );
      
      // Update current if it's the same one
      if (currentMindMap?.id === id) {
        setCurrentMindMap(updatedMindMap);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update mind map';
      setError(errorMessage);
      console.error('Error updating mind map:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMindMap?.id]);

  /**
   * Delete a mind map
   */
  const deleteMindMap = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await mindMapAPI.deleteMindMap(id);
      
      // Remove from the list
      setMindMaps(prev => prev.filter(map => map.id !== id));
      
      // Clear current if it's the same one
      if (currentMindMap?.id === id) {
        setCurrentMindMap(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete mind map';
      setError(errorMessage);
      console.error('Error deleting mind map:', err);
    } finally {
      setLoading(false);
    }
  }, [currentMindMap?.id]);

  /**
   * Export a mind map
   */
  const exportMindMap = useCallback(async (id: string, options: MindMapExportOptions): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const exportData = await mindMapAPI.exportMindMap(id, options);
      return exportData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export mind map';
      setError(errorMessage);
      console.error('Error exporting mind map:', err);
      
      Alert.alert(
        'Export Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
      
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    mindMaps,
    currentMindMap,
    loading,
    error,
    generating,
    
    // Actions
    loadMindMaps,
    loadMindMap,
    generateMindMap,
    updateMindMap,
    deleteMindMap,
    exportMindMap,
    clearError,
    clearCurrentMindMap,
  };
}; 