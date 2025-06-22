import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  mindMapAPI,
  MindMap,
  CreateMindMapRequest,
  MindMapExportOptions,
} from '../services/mindMapAPI';
import { paymentService } from '../services/paymentService';

export const useMindMap = () => {
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [currentMindMap, setCurrentMindMap] = useState<MindMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Premium status state
  const [isPremium, setIsPremium] = useState(false);
  const [nodeLimit, setNodeLimit] = useState(20); // Default free limit

  // Check premium status
  const checkPremiumStatus = useCallback(async () => {
    try {
      const status = await paymentService.getSubscriptionStatus();
      const premium = status.isActive;
      setIsPremium(premium);
      setNodeLimit(premium ? 100 : 20);
      return premium;
    } catch (error) {
      console.error('Failed to check premium status:', error);
      setIsPremium(false);
      setNodeLimit(20);
      return false;
    }
  }, []);

  // Load mind maps with premium status check
  const loadMindMaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check premium status first
      await checkPremiumStatus();

      const data = await mindMapAPI.getMindMaps();
      setMindMaps(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load mind maps';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [checkPremiumStatus]);

  // Load specific mind map
  const loadMindMap = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await mindMapAPI.getMindMap(id);
      setCurrentMindMap(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load mind map';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate mind map with premium gating
  const generateMindMap = useCallback(
    async (request: CreateMindMapRequest) => {
      setGenerating(true);
      setError(null);
      try {
        // Check premium status before generation
        const premium = await checkPremiumStatus();

        // Show premium gating message if user requests more nodes than allowed
        const requestedNodes = parseInt(request.max_nodes?.toString() || '20');
        const limit = premium ? 100 : 20;

        if (requestedNodes > limit) {
          Alert.alert(
            'Node Limit Exceeded',
            `${premium ? 'Premium' : 'Free'} plan allows up to ${limit} nodes. Your request for ${requestedNodes} nodes exceeds this limit.${
              !premium ? '\n\nUpgrade to Premium for up to 100 nodes!' : ''
            }`,
            [
              { text: 'OK', style: 'cancel' },
              ...(!premium
                ? [
                    {
                      text: 'Upgrade',
                      onPress: () => {
                        // Navigate to subscription screen
                        // This will be handled by the calling component
                      },
                    },
                  ]
                : []),
            ]
          );
          return null;
        }

        const data = await mindMapAPI.generateMindMap(request);

        // Add to mind maps list
        setMindMaps((prev) => [data, ...prev]);

        Alert.alert(
          'Mind Map Generated!',
          `Successfully created "${data.title}" with ${data.mind_map_data.total_nodes || 'multiple'} nodes.${
            data.mind_map_data.total_nodes > limit * 0.8
              ? `\n\nYou're approaching your ${premium ? 'Premium' : 'Free'} plan limit of ${limit} nodes.`
              : ''
          }`
        );

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate mind map';
        setError(errorMessage);

        // Check if error is related to node limits
        if (
          errorMessage.includes('node limit') ||
          errorMessage.includes('premium')
        ) {
          Alert.alert(
            'Premium Feature Required',
            'This mind map requires more nodes than your current plan allows. Upgrade to Premium for up to 100 nodes per mind map!',
            [
              { text: 'Maybe Later', style: 'cancel' },
              {
                text: 'Upgrade Now',
                onPress: () => {
                  // Navigate to subscription screen
                  // This will be handled by the calling component
                },
              },
            ]
          );
        } else {
          Alert.alert('Error', errorMessage);
        }

        return null;
      } finally {
        setGenerating(false);
      }
    },
    [checkPremiumStatus]
  );

  // Delete mind map
  const deleteMindMap = useCallback(
    async (id: string) => {
      try {
        await mindMapAPI.deleteMindMap(id);
        setMindMaps((prev) => prev.filter((map) => map.id !== id));

        // Clear current mind map if it was deleted
        if (currentMindMap?.id === id) {
          setCurrentMindMap(null);
        }

        Alert.alert('Success', 'Mind map deleted successfully');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to delete mind map';
        setError(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    },
    [currentMindMap]
  );

  // Export mind map
  const exportMindMap = useCallback(
    async (id: string, options: MindMapExportOptions) => {
      try {
        await mindMapAPI.exportMindMap(id, options);
        Alert.alert(
          'Success',
          `Mind map exported as ${options.format.toUpperCase()}`
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to export mind map';
        setError(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    },
    []
  );

  // Clear current mind map
  const clearCurrentMindMap = useCallback(() => {
    setCurrentMindMap(null);
  }, []);

  return {
    // Data
    mindMaps,
    currentMindMap,

    // Status
    loading,
    generating,
    error,

    // Premium status
    isPremium,
    nodeLimit,

    // Actions
    loadMindMaps,
    loadMindMap,
    generateMindMap,
    deleteMindMap,
    exportMindMap,
    clearCurrentMindMap,
    checkPremiumStatus,
  };
};
