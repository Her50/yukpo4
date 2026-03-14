// @ts-nocheck
// ✨ MES INTERACTIONS - Dashboard client + Favoris + Historique
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { NativeButton, NativeCard } from '../components/SafeNativeDesign';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

interface Interaction {
  id: string;
  serviceId: string;
  serviceTitle: string;
  providerName: string;
  category: string;
  type: 'message' | 'like' | 'share' | 'review' | 'favorite' | 'view';
  timestamp: string;
  metadata?: any;
}

interface CategoryInteraction {
  name: string;
  count: number;
  lastInteraction: string;
  types: { [key: string]: number };
  icon: string;
  color: string;
}

const MesInteractionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguageSafe();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'favorites' | 'messages' | 'reviews'>('all');

  // États Dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryInteraction[]>([]);

  useEffect(() => {
    loadInteractionsData();
  }, [selectedPeriod]);

  const loadInteractionsData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // ✅ Charger les interactions réelles depuis l'API
      const [interactionsRes, favoritesRes] = await Promise.all([
        apiGet(`/api/users/interactions?period=${selectedPeriod}`),
        apiGet('/api/users/favorites')
      ]);

      if (interactionsRes.success && interactionsRes.data) {
        const interactionsData = Array.isArray(interactionsRes.data) ? interactionsRes.data : [];
        setInteractions(interactionsData);
        calculateDashboardData(interactionsData);
        calculateCategoryStats(interactionsData);
      } else {
        setInteractions([]);
        setDashboardData(null);
        setCategoryStats([]);
      }

      if (favoritesRes.success && favoritesRes.data) {
        setFavorites(Array.isArray(favoritesRes.data) ? favoritesRes.data : []);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Erreur chargement interactions:', error);
      setInteractions([]);
      setFavorites([]);
      setDashboardData(null);
      setCategoryStats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateDashboardData = (interactionsData: Interaction[]) => {
    // ✅ UNIQUEMENT DONNÉES RÉELLES
    const messageCount = interactionsData.filter(i => i.type === 'message').length;
    const likeCount = interactionsData.filter(i => i.type === 'like').length;
    const shareCount = interactionsData.filter(i => i.type === 'share').length;
    const reviewCount = interactionsData.filter(i => i.type === 'review').length;
    const viewCount = interactionsData.filter(i => i.type === 'view').length;

    const uniqueServices = new Set(interactionsData.map(i => i.serviceId)).size;
    const uniqueProviders = new Set(interactionsData.map(i => i.providerName)).size;

    setDashboardData({
      totalInteractions: interactionsData.length,
      messageCount,
      likeCount,
      shareCount,
      reviewCount,
      viewCount,
      uniqueServices,
      uniqueProviders,
      favoriteCount: favorites.length
    });
  };

  const calculateCategoryStats = (interactionsData: Interaction[]) => {
    const categoryMap = new Map<string, CategoryInteraction>();

    const categoryIcons: { [key: string]: { icon: string; color: string } } = {
      'immobilier': { icon: 'home', color: '#3B82F6' },
      'automobile': { icon: 'car', color: '#EF4444' },
      'electromenager': { icon: 'zap', color: '#14B8A6' },
      'telephone': { icon: 'smartphone', color: '#FF9800' },
      'ordinateur': { icon: 'monitor', color: '#00BCD4' },
      'mobilier': { icon: 'package', color: '#F97316' },
      'vetement': { icon: 'shirt', color: '#EC4899' },
      'chaussure': { icon: 'shoe', color: '#6366F1' },
      'prestation_service': { icon: 'briefcase', color: '#8B5CF6' },
      'hopital_clinique': { icon: 'heart', color: '#DC2626' },
      'pharmacie': { icon: 'shopping-bag', color: '#059669' },
      'demenagement': { icon: 'truck', color: '#F97316' },
      'assurance': { icon: 'shield', color: '#0891B2' },
      'quincaillerie': { icon: 'hammer', color: '#F59E0B' },
      'decoration': { icon: 'palette', color: '#E91E63' },
      'autre': { icon: 'grid', color: '#6B7280' }
    };

    interactionsData.forEach(interaction => {
      const category = interaction.category || 'autre';
      const cleanCategory = category.replace(/[_-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const categoryKey = category.replace(/\s+/g, '_').toLowerCase();

      if (!categoryMap.has(cleanCategory)) {
        const categoryInfo = categoryIcons[categoryKey] || categoryIcons['autre'];

        categoryMap.set(cleanCategory, {
          name: cleanCategory,
          count: 0,
          lastInteraction: interaction.timestamp,
          types: {},
          icon: categoryInfo.icon,
          color: categoryInfo.color
        });
      }

      const stat = categoryMap.get(cleanCategory)!;
      stat.count++;

      // Compter les types d'interactions
      if (!stat.types[interaction.type]) {
        stat.types[interaction.type] = 0;
      }
      stat.types[interaction.type]++;

      // Mettre à jour la dernière interaction
      if (new Date(interaction.timestamp) > new Date(stat.lastInteraction)) {
        stat.lastInteraction = interaction.timestamp;
      }
    });

    const stats = Array.from(categoryMap.values())
      .filter(stat => stat.count > 0)
      .sort((a, b) => b.count - a.count);

    setCategoryStats(stats);
  };

  const getFilteredInteractions = () => {
    switch (selectedFilter) {
      case 'favorites':
        return interactions.filter(i => i.type === 'favorite' || i.type === 'like');
      case 'messages':
        return interactions.filter(i => i.type === 'message');
      case 'reviews':
        return interactions.filter(i => i.type === 'review');
      default:
        return interactions;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return t('interactions.minutesAgo', { count: minutes });
    if (hours < 24) return t('interactions.hoursAgo', { count: hours });
    return t('interactions.daysAgo', { count: days });
  };

  const getInteractionIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      'message': 'message-circle',
      'like': 'heart',
      'share': 'share-2',
      'review': 'star',
      'favorite': 'bookmark',
      'view': 'eye'
    };
    return icons[type] || 'activity';
  };

  const getInteractionColor = (type: string) => {
    const colors: { [key: string]: string } = {
      'message': '#3B82F6',
      'like': '#EF4444',
      'share': '#10B981',
      'review': '#F59E0B',
      'favorite': '#EC4899',
      'view': '#6B7280'
    };
    return colors[type] || modernColors.textSecondary;
  };

  const getInteractionLabel = (type: string) => {
    const labelKeys: { [key: string]: string } = {
      'message': 'interactions.typeMessage',
      'like': 'interactions.typeLike',
      'share': 'interactions.typeShare',
      'review': 'interactions.typeReview',
      'favorite': 'interactions.typeFavorite',
      'view': 'interactions.typeView'
    };
    return labelKeys[type] ? t(labelKeys[type]) : type;
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>{t('interactions.loading')}</Text>
      </LinearGradient>
    );
  }

  const filteredInteractions = getFilteredInteractions();

  return (
    <View style={styles.container}>
      {/* Header avec gradient */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIcon}>
              <SafeIcon name="message-circle" size={28} color="#fff" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{t('interactions.title')}</Text>
              <Text style={styles.headerSubtitle}>
                {String(interactions.length)} interaction{interactions.length > 1 ? 's' : ''} • {String(favorites.length)} favori{favorites.length > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Sélecteur de période */}
          <View style={styles.periodSelector}>
            {['7d', '30d', '90d'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && styles.periodButtonActive
                ]}
                onPress={() => setSelectedPeriod(period as any)}
              >
                <Text style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive
                ]}>
                  {period === '7d' ? '7j' : period === '30d' ? '30j' : '90j'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadInteractionsData(true)} tintColor={modernColors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Dashboard Stats - ✅ UNIQUEMENT DONNÉES RÉELLES */}
        {dashboardData && (
          <View style={styles.dashboardSection}>
            <Text style={styles.sectionTitle}>{t('interactions.overview')}</Text>
            <View style={styles.statsGrid}>
              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#3B82F620' }]}>
                  <SafeIcon name="activity" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.statValue}>
                  {dashboardData.totalInteractions ? dashboardData.totalInteractions.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>{t('interactions.total')}</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#10B98120' }]}>
                  <SafeIcon name="message-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.statValue}>
                  {dashboardData.messageCount ? dashboardData.messageCount.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>{t('interactions.messages')}</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#EF444420' }]}>
                  <SafeIcon name="heart" size={20} color="#EF4444" />
                </View>
                <Text style={styles.statValue}>
                  {dashboardData.likeCount ? dashboardData.likeCount.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>{t('interactions.likes')}</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#F5990620' }]}>
                  <SafeIcon name="star" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>
                  {dashboardData.reviewCount ? dashboardData.reviewCount.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>{t('interactions.reviews')}</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#8B5CF620' }]}>
                  <SafeIcon name="Redo2" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.statValue}>
                  {dashboardData.shareCount ? dashboardData.shareCount.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>{t('interactions.shares')}</Text>
              </NativeCard>

              <NativeCard style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#EC489920' }]}>
                  <SafeIcon name="bookmark" size={20} color="#EC4899" />
                </View>
                <Text style={styles.statValue}>
                  {favorites.length ? favorites.length.toLocaleString('fr-FR') : '0'}
                </Text>
                <Text style={styles.statLabel}>{t('interactions.favorites')}</Text>
              </NativeCard>
            </View>

            {/* Stats supplémentaires */}
            <View style={styles.additionalStats}>
              <View style={styles.additionalStatItem}>
                <SafeIcon name="briefcase" size={16} color={modernColors.primary} />
                <Text style={styles.additionalStatText}>
                  {t('interactions.servicesConsulted', { count: dashboardData.uniqueServices || 0 })}
                </Text>
              </View>
              <View style={styles.additionalStatItem}>
                <SafeIcon name="users" size={16} color={modernColors.primary} />
                <Text style={styles.additionalStatText}>
                  {t('interactions.providers', { count: dashboardData.uniqueProviders || 0 })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats par catégorie */}
        {categoryStats.length > 0 && (
          <View style={styles.categorySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('interactions.byCategory')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categoryStats.map((category, index) => (
                <NativeCard key={index} style={[styles.categoryCard, { borderLeftColor: category.color }]}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: category.color + '20' }]}>
                    <SafeIcon name={category.icon} size={24} color={category.color} />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryCount}>{String(category.count)} interaction{category.count > 1 ? 's' : ''}</Text>

                  {/* Types d'interactions */}
                  <View style={styles.categoryInteractionTypes}>
                    {Object.entries(category.types).slice(0, 3).map(([type, count]) => (
                      <View key={type} style={styles.interactionTypeChip}>
                        <SafeIcon name={getInteractionIcon(type)} size={10} color={category.color} />
                        <Text style={styles.interactionTypeText}>{count}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.categoryLastInteraction}>
                    {formatTimeAgo(category.lastInteraction)}
                  </Text>
                </NativeCard>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Filtres */}
        <View style={styles.filtersSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'all', label: t('interactions.filterAll'), icon: 'grid' },
              { key: 'favorites', label: t('interactions.filterFavorites'), icon: 'heart' },
              { key: 'messages', label: t('interactions.filterMessages'), icon: 'message-circle' },
              { key: 'reviews', label: t('interactions.filterReviews'), icon: 'star' },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterChip,
                  selectedFilter === filter.key && styles.filterChipActive
                ]}
                onPress={() => setSelectedFilter(filter.key as any)}
              >
                <SafeIcon
                  name={filter.icon}
                  size={16}
                  color={selectedFilter === filter.key ? '#fff' : modernColors.textSecondary}
                />
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === filter.key && styles.filterChipTextActive
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Liste des interactions */}
        <View style={styles.interactionsSection}>
          <Text style={styles.sectionTitle}>
            {selectedFilter === 'all' ? t('interactions.allInteractions') :
              selectedFilter === 'favorites' ? t('interactions.myFavorites') :
                selectedFilter === 'messages' ? t('interactions.myMessages') :
                  selectedFilter === 'reviews' ? t('interactions.myReviews') : ''}
          </Text>

          {filteredInteractions.length === 0 ? (
            <NativeCard style={styles.emptyCard}>
              <SafeIcon name="inbox" size={48} color={modernColors.textSecondary} />
              <Text style={styles.emptyTitle}>{t('interactions.noInteraction')}</Text>
              <Text style={styles.emptyText}>
                {selectedFilter === 'all'
                  ? t('interactions.startInteracting')
                  : t('interactions.noItemsIn', { section: selectedFilter === 'favorites' ? t('interactions.myFavorites') : selectedFilter === 'messages' ? t('interactions.myMessages') : t('interactions.myReviews') })}
              </Text>
            </NativeCard>
          ) : (
            filteredInteractions.map((interaction) => (
              <TouchableOpacity
                key={interaction.id}
                style={styles.interactionCard}
                onPress={() => {
                  // Navigation vers le détail du service
                  (navigation as any).navigate('ResultatBesoin', {
                    services: [{ id: interaction.serviceId }],
                    highlightServiceId: interaction.serviceId
                  });
                }}
              >
                <View style={[styles.interactionIconBadge, { backgroundColor: getInteractionColor(interaction.type) + '20' }]}>
                  <SafeIcon name={getInteractionIcon(interaction.type)} size={20} color={getInteractionColor(interaction.type)} />
                </View>

                <View style={styles.interactionContent}>
                  <Text style={styles.interactionTitle}>{interaction.serviceTitle}</Text>
                  <Text style={styles.interactionProvider}>{t('interactions.by')} {interaction.providerName}</Text>
                  <View style={styles.interactionMeta}>
                    <View style={styles.interactionCategoryBadge}>
                      <Text style={styles.interactionCategoryText}>{interaction.category}</Text>
                    </View>
                    <Text style={styles.interactionTime}>{formatTimeAgo(interaction.timestamp)}</Text>
                  </View>
                </View>

                <View style={styles.interactionTypeBadge}>
                  <Text style={[styles.interactionTypeLabel, { color: getInteractionColor(interaction.type) }]}>
                    {getInteractionLabel(interaction.type)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ✅ Bouton Dashboard Client/Utilisateur */}
        <View style={styles.dashboardSection}>
          <NativeButton
            title={`📊 ${t('interactions.dashboardFull')}`}
            onPress={() => (navigation as any).navigate('Dashboard')}
            variant="primary"
            size="large"
            style={styles.dashboardButton}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    gap: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#fff',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  periodButtonTextActive: {
    color: modernColors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  dashboardSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 52) / 2,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.text,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: modernColors.textSecondary,
    textAlign: 'center',
  },
  additionalStats: {
    marginTop: 12,
    gap: 8,
  },
  additionalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  additionalStatText: {
    fontSize: 14,
    color: modernColors.textSecondary,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryCard: {
    width: 160,
    padding: 16,
    marginRight: 12,
    borderLeftWidth: 3,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: modernColors.textSecondary,
    marginBottom: 12,
  },
  categoryInteractionTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  interactionTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: modernColors.background,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  interactionTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: modernColors.text,
  },
  categoryLastInteraction: {
    fontSize: 11,
    color: modernColors.textTertiary,
    fontStyle: 'italic',
  },
  filtersSection: {
    marginBottom: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: modernColors.surface,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: modernColors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  interactionsSection: {
    marginBottom: 24,
  },
  interactionCard: {
    flexDirection: 'row',
    backgroundColor: modernColors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  interactionIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interactionContent: {
    flex: 1,
  },
  interactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: 4,
  },
  interactionProvider: {
    fontSize: 13,
    color: modernColors.textSecondary,
    marginBottom: 8,
  },
  interactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  interactionCategoryBadge: {
    backgroundColor: modernColors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  interactionCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  interactionTime: {
    fontSize: 11,
    color: modernColors.textTertiary,
  },
  interactionTypeBadge: {
    alignSelf: 'flex-start',
  },
  interactionTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
  },
  emptyText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dashboardButton: {
    alignSelf: 'stretch',
  },
});

export default MesInteractionsScreen;


