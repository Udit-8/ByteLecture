import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card } from '../components';
import { theme } from '../constants/theme';
import { useNavigation, Note } from '../contexts/NavigationContext';

export const RecentNotesScreen: React.FC = () => {
  const { setNoteDetailMode } = useNavigation();

  // Mock data for recent notes
  const recentNotes: Note[] = [
    {
      id: '1',
      title: 'Introduction to Machine Learning',
      type: 'PDF',
      date: '2024-01-15',
      progress: 85,
      content: {
        totalPages: 45,
        currentPage: 38,
      },
    },
    {
      id: '2',
      title: 'Quantum Physics Lecture Series',
      type: 'YouTube',
      date: '2024-01-14',
      progress: 60,
      content: {
        duration: 3600,
        watchedTime: 2160,
      },
    },
    {
      id: '3',
      title: 'Psychology Fundamentals',
      type: 'Audio',
      date: '2024-01-13',
      progress: 30,
      content: {
        duration: 2700,
        playedTime: 810,
      },
    },
    {
      id: '4',
      title: 'Data Structures and Algorithms',
      type: 'Text',
      date: '2024-01-12',
      progress: 100,
      content: {
        wordCount: 5000,
        estimatedTime: 20,
      },
    },
  ];

  const handleNotePress = (note: Note) => {
    setNoteDetailMode(note);
  };

  const getTypeIcon = (type: Note['type']) => {
    switch (type) {
      case 'PDF':
        return 'document-text';
      case 'YouTube':
        return 'logo-youtube';
      case 'Audio':
        return 'headset';
      case 'Text':
        return 'reader';
      default:
        return 'document';
    }
  };

  const getTypeColor = (type: Note['type']) => {
    switch (type) {
      case 'PDF':
        return theme.colors.primary[600];
      case 'YouTube':
        return theme.colors.error[600];
      case 'Audio':
        return theme.colors.success[600];
      case 'Text':
        return theme.colors.warning[600];
      default:
        return theme.colors.gray[600];
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Recent Notes" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Your Learning Materials</Text>
          <Text style={styles.welcomeDescription}>
            Access your imported content and continue learning where you left off.
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{recentNotes.length}</Text>
            <Text style={styles.statLabel}>Total Notes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {Math.round(recentNotes.reduce((acc, note) => acc + note.progress, 0) / recentNotes.length)}%
            </Text>
            <Text style={styles.statLabel}>Avg Progress</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {recentNotes.filter(note => note.progress === 100).length}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.notesList}>
          {recentNotes.map((note) => (
            <TouchableOpacity
              key={note.id}
              onPress={() => handleNotePress(note)}
              activeOpacity={0.7}
            >
              <Card style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <View style={styles.noteIcon}>
                    <Ionicons 
                      name={getTypeIcon(note.type) as any} 
                      size={24} 
                      color={getTypeColor(note.type)} 
                    />
                  </View>
                  <View style={styles.noteInfo}>
                    <Text style={styles.noteTitle} numberOfLines={2}>
                      {note.title}
                    </Text>
                    <View style={styles.noteMeta}>
                      <View style={styles.typeTag}>
                        <Text style={[styles.typeText, { color: getTypeColor(note.type) }]}>
                          {note.type}
                        </Text>
                      </View>
                      <Text style={styles.dateText}>
                        {formatDate(note.date)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.progressSection}>
                    <Text style={styles.progressText}>{note.progress}%</Text>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            width: `${note.progress}%`,
                            backgroundColor: getTypeColor(note.type),
                          }
                        ]} 
                      />
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {recentNotes.length === 0 && (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <Ionicons name="folder-open-outline" size={48} color={theme.colors.gray[400]} />
              <Text style={styles.emptyTitle}>No Notes Yet</Text>
              <Text style={styles.emptyDescription}>
                Import some content from the Import tab to see your learning materials here.
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  content: {
    flex: 1,
    padding: theme.spacing.base,
  },
  welcomeSection: {
    marginBottom: theme.spacing.lg,
  },
  welcomeTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  welcomeDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  notesList: {
    gap: theme.spacing.md,
  },
  noteCard: {
    padding: theme.spacing.base,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  noteIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInfo: {
    flex: 1,
  },
  noteTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  typeTag: {
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  typeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  dateText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
  },
  progressSection: {
    alignItems: 'center',
    minWidth: 60,
  },
  progressText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.xs,
  },
  progressBar: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  emptyCard: {
    padding: theme.spacing['2xl'],
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  emptyDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
}); 