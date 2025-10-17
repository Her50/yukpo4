import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme/theme';
import useServiceStats from '../hooks/useServiceStats';

interface ServiceStatsProps {
  serviceId: string;
  compact?: boolean;
}

interface ServiceStatsData {
  views: number;
  likes: number;
  shares: number;
  contacts: number;
  rating: number;
  reviews: number;
}

const ServiceStats: React.FC<ServiceStatsProps> = ({ serviceId, compact = false }) => {
  // Utiliser le hook pour récupérer les vraies statistiques
  const { stats: realStats, loading, error } = useServiceStats(serviceId);

  // Adapter les données du hook aux données attendues par le composant
  const stats: ServiceStatsData | null = realStats ? {
    views: realStats.views,
    likes: realStats.likes,
    shares: realStats.shares,
    contacts: realStats.contacts,
    rating: realStats.rating,
    reviews: realStats.totalRatings
  } : null;

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <Text style={styles.errorText}>Stats indisponibles</Text>
      </View>
    );
  }

  const renderStatItem = (icon: string, value: number, label: string) => (
    <View style={[styles.statItem, compact && styles.compactStatItem]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, compact && styles.compactStatValue]}>
        {value.toLocaleString('fr-FR')}
      </Text>
      {!compact && (
        <Text style={styles.statLabel}>{label}</Text>
      )}
    </View>
  );

  const renderRating = () => (
    <View style={[styles.ratingContainer, compact && styles.compactRatingContainer]}>
      <Text style={styles.ratingIcon}>⭐</Text>
      <Text style={[styles.ratingValue, compact && styles.compactRatingValue]}>
        {stats.rating.toFixed(1)}
      </Text>
      {!compact && (
        <Text style={styles.ratingLabel}>
          ({stats.reviews} avis)
        </Text>
      )}
    </View>
  );

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactStatsRow}>
          {renderStatItem('👁️', stats.views, 'Vues')}
          {renderStatItem('❤️', stats.likes, 'Likes')}
          {renderStatItem('📤', stats.shares, 'Partages')}
        </View>
        {renderRating()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Statistiques du service</Text>
      
      <View style={styles.statsGrid}>
        {renderStatItem('👁️', stats.views, 'Vues')}
        {renderStatItem('❤️', stats.likes, 'Likes')}
        {renderStatItem('📤', stats.shares, 'Partages')}
        {renderStatItem('📞', stats.contacts, 'Contacts')}
      </View>

      {renderRating()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  compactContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    marginVertical: 0,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error,
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    marginBottom: 8,
    minWidth: 60,
  },
  compactStatItem: {
    marginBottom: 0,
    minWidth: 40,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 2,
  },
  compactStatValue: {
    fontSize: 12,
    marginBottom: 0,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  compactRatingContainer: {
    borderTopWidth: 0,
    paddingTop: 4,
  },
  ratingIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginRight: 4,
  },
  compactRatingValue: {
    fontSize: 12,
  },
  ratingLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  compactStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
});

export default ServiceStats;

