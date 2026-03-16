// Composant de barre de progression pour la génération de combinaisons
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { CombinationProgress, formatRemainingTime, formatCombinationCount } from '../hooks/useCombinationProgress';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface CombinationProgressBarProps {
  progress: CombinationProgress | null;
  compact?: boolean;
}

export function CombinationProgressBar({ progress, compact = false }: CombinationProgressBarProps) {
  const [progressAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (progress?.percentage) {
      Animated.timing(progressAnim, {
        toValue: progress.percentage,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [progress?.percentage]);

  if (!progress || progress.status === 'not_found' || progress.status === 'error') {
    return null;
  }

  if (progress.status === 'completed') {
    return compact ? null : (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successText}>
            {formatCombinationCount(progress.total)} combinaisons disponibles
          </Text>
        </View>
      </View>
    );
  }

  if (progress.status === 'in_progress') {
    const percentage = progress.percentage || 0;
    
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        {!compact && (
          <View style={styles.header}>
            <Text style={styles.title}>{t('combinationProgressBar.generationDesCombinaisons')}</Text>
            <Text style={styles.percentage}>{percentage.toFixed(1)}%</Text>
          </View>
        )}

        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {!compact && (
          <View style={styles.details}>
            <Text style={styles.detailText}>
              {formatCombinationCount(progress.current)} / {formatCombinationCount(progress.total)}
            </Text>
            {progress.estimatedRemainingSeconds !== undefined && progress.estimatedRemainingSeconds > 0 && (
              <Text style={styles.detailText}>
                ⏱️ {formatRemainingTime(progress.estimatedRemainingSeconds)}
              </Text>
            )}
          </View>
        )}

        {compact && (
          <Text style={styles.compactText}>
            {percentage.toFixed(0)}% • {formatCombinationCount(progress.current)} / {formatCombinationCount(progress.total)}
          </Text>
        )}

        <Text style={styles.hint}>
          💡 Vous pouvez déjà commencer à remplir le formulaire. Plus de suggestions arrivent...
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  containerCompact: {
    padding: 8,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  percentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  compactText: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#95A5A6',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  successIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27AE60',
  },
});

