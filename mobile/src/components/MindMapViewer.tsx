import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import Svg, {
  G,
  Circle,
  Text as SvgText,
  Line,
  Rect,
} from 'react-native-svg';
import { MindMapNode, MindMapData, MindMapStyle } from '../services/mindMapAPI';
import { theme } from '../constants/theme';

interface MindMapViewerProps {
  mindMapData: MindMapData;
  onNodePress?: (node: MindMapNode) => void;
  onNodeLongPress?: (node: MindMapNode) => void;
  editable?: boolean;
  style?: any;
}

interface LayoutNode extends MindMapNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const MindMapViewer: React.FC<MindMapViewerProps> = ({
  mindMapData,
  onNodePress,
  onNodeLongPress,
  editable = false,
  style,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

  // Calculate layout based on mind map style
  const layoutNodes = useMemo(() => {
    const nodes: LayoutNode[] = [];
    const nodeWidth = 120;
    const nodeHeight = 60;
    const horizontalSpacing = 160;
    const verticalSpacing = 80;

    const calculateLayout = (
      node: MindMapNode,
      x: number,
      y: number,
      level: number,
      angle?: number
    ): LayoutNode => {
      const layoutNode: LayoutNode = {
        ...node,
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
      };

      nodes.push(layoutNode);

      if (node.children && expandedNodes.has(node.id)) {
        const childCount = node.children.length;

        if (mindMapData.style === 'radial') {
          // Radial layout
          const radius = 100 + level * 80;
          const angleStep = (2 * Math.PI) / Math.max(childCount, 1);
          const startAngle = angle !== undefined ? angle - angleStep * (childCount - 1) / 2 : 0;

          node.children.forEach((child, index) => {
            const childAngle = startAngle + angleStep * index;
            const childX = x + Math.cos(childAngle) * radius;
            const childY = y + Math.sin(childAngle) * radius;
            calculateLayout(child, childX, childY, level + 1, childAngle);
          });
        } else {
          // Hierarchical layout (default)
          const totalHeight = (childCount - 1) * verticalSpacing;
          const startY = y - totalHeight / 2;

          node.children.forEach((child, index) => {
            const childX = x + horizontalSpacing;
            const childY = startY + index * verticalSpacing;
            calculateLayout(child, childX, childY, level + 1);
          });
        }
      }

      return layoutNode;
    };

    // Start layout from center
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    calculateLayout(mindMapData.root, centerX, centerY, 0);

    return nodes;
  }, [mindMapData, expandedNodes, screenWidth, screenHeight]);

  // Find connections between nodes
  const connections = useMemo(() => {
    const lines: Array<{ from: LayoutNode; to: LayoutNode }> = [];

    const findConnections = (node: MindMapNode) => {
      if (node.children && expandedNodes.has(node.id)) {
        const parentNode = layoutNodes.find(n => n.id === node.id);
        if (parentNode) {
          node.children.forEach(child => {
            const childNode = layoutNodes.find(n => n.id === child.id);
            if (childNode) {
              lines.push({ from: parentNode, to: childNode });
              findConnections(child);
            }
          });
        }
      }
    };

    findConnections(mindMapData.root);
    return lines;
  }, [layoutNodes, expandedNodes, mindMapData.root]);

  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleNodePress = (node: LayoutNode) => {
    if (node.children && node.children.length > 0) {
      toggleNodeExpansion(node.id);
    }
    onNodePress?.(node);
  };

  const handleNodeLongPress = (node: LayoutNode) => {
    if (editable) {
      Alert.alert(
        'Edit Node',
        `Edit "${node.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit', onPress: () => onNodeLongPress?.(node) },
        ]
      );
    }
  };

  // Calculate SVG dimensions to fit all nodes
  const svgBounds = useMemo(() => {
    if (layoutNodes.length === 0) {
      return { width: screenWidth, height: screenHeight, minX: 0, minY: 0 };
    }

    const minX = Math.min(...layoutNodes.map(n => n.x - n.width / 2)) - 50;
    const maxX = Math.max(...layoutNodes.map(n => n.x + n.width / 2)) + 50;
    const minY = Math.min(...layoutNodes.map(n => n.y - n.height / 2)) - 50;
    const maxY = Math.max(...layoutNodes.map(n => n.y + n.height / 2)) + 50;

    return {
      width: Math.max(maxX - minX, screenWidth),
      height: Math.max(maxY - minY, screenHeight),
      minX,
      minY,
    };
  }, [layoutNodes, screenWidth, screenHeight]);

  const getNodeColor = (node: LayoutNode) => {
    if (node.color) return node.color;
    
    // Default colors based on level
    const colors = [
      theme.colors.primary[500],
      theme.colors.secondary,
      '#4CAF50',
      '#FF9800',
      '#9C27B0',
      '#F44336',
    ];
    return colors[node.level % colors.length];
  };

  const renderNode = (node: LayoutNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const nodeColor = getNodeColor(node);
    
    // Adjust position relative to SVG bounds
    const x = node.x - svgBounds.minX;
    const y = node.y - svgBounds.minY;

    return (
      <G key={node.id}>
        {/* Node background */}
        <Rect
          x={x - node.width / 2}
          y={y - node.height / 2}
          width={node.width}
          height={node.height}
          rx={8}
          fill={nodeColor}
          stroke={theme.colors.border}
          strokeWidth={2}
          opacity={0.9}
          onPress={() => handleNodePress(node)}
          onLongPress={() => handleNodeLongPress(node)}
        />
        
        {/* Node title */}
        <SvgText
          x={x}
          y={y - 5}
          fontSize={12}
          fontWeight="bold"
          fill="white"
          textAnchor="middle"
          onPress={() => handleNodePress(node)}
        >
          {node.title.length > 15 ? `${node.title.substring(0, 12)}...` : node.title}
        </SvgText>
        
        {/* Expansion indicator */}
        {hasChildren && (
          <Circle
            cx={x + node.width / 2 - 10}
            cy={y - node.height / 2 + 10}
            r={6}
            fill={isExpanded ? '#4CAF50' : '#FF9800'}
            stroke="white"
            strokeWidth={1}
            onPress={() => toggleNodeExpansion(node.id)}
          />
        )}
        
        {/* Child count indicator */}
        {hasChildren && (
          <SvgText
            x={x + node.width / 2 - 10}
            y={y - node.height / 2 + 14}
            fontSize={8}
            fill="white"
            textAnchor="middle"
            fontWeight="bold"
          >
            {node.children?.length}
          </SvgText>
        )}
      </G>
    );
  };

  const renderConnection = (connection: { from: LayoutNode; to: LayoutNode }, index: number) => {
    // Adjust positions relative to SVG bounds
    const fromX = connection.from.x - svgBounds.minX;
    const fromY = connection.from.y - svgBounds.minY;
    const toX = connection.to.x - svgBounds.minX;
    const toY = connection.to.y - svgBounds.minY;

    return (
      <Line
        key={`connection-${index}`}
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={theme.colors.border}
        strokeWidth={2}
        opacity={0.6}
      />
    );
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        maximumZoomScale={3}
        minimumZoomScale={0.5}
        bouncesZoom
      >
        <ScrollView
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Svg
            width={svgBounds.width}
            height={svgBounds.height}
            style={styles.svg}
          >
            {/* Render connections first (behind nodes) */}
            {connections.map(renderConnection)}
            
            {/* Render nodes */}
            {layoutNodes.map(renderNode)}
          </Svg>
        </ScrollView>
      </ScrollView>
      
      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setExpandedNodes(new Set([mindMapData.root.id]))}
        >
          <Text style={styles.controlButtonText}>Collapse All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            const allNodeIds = new Set<string>();
            const collectIds = (node: MindMapNode) => {
              allNodeIds.add(node.id);
              node.children?.forEach(collectIds);
            };
            collectIds(mindMapData.root);
            setExpandedNodes(allNodeIds);
          }}
        >
          <Text style={styles.controlButtonText}>Expand All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  svg: {
    backgroundColor: 'transparent',
  },
  controls: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 