// TrendPulseDashboardScreen — Yukpo
// Dashboard complet des tendances personnalisées
// Accessible depuis : AIHub, notification proactive, FAB long press

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import TrendCard, { TrendItemData, TrendRecommendedAction } from '../components/TrendCard';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import {
  trendService,
  SectorTrend,
  TrendForMeResponse,
  TrendPulseResponse,
  UserCommercialContextResponse,
} from '../services/trendService';
import { modernColors } from '../theme/modernTheme';

const REGION_CODES = ['CM', 'SN', 'CI', 'NG'] as const;
const PERIOD_CODES = ['24h', '7d', '30d'] as const;

type TabType = 'for-me' | 'global' | 'sectors';

const TrendPulseDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguageSafe();
  const { user } = useAuth();

  // Régions et périodes localisées
  const REGIONS = [
    { code: 'CM', label: t('trendPulse.regionCM') || 'Cameroun' },
    { code: 'SN', label: t('trendPulse.regionSN') || 'Sénégal' },
    { code: 'CI', label: t('trendPulse.regionCI') || "Côte d'Ivoire" },
    { code: 'NG', label: t('trendPulse.regionNG') || 'Nigeria' },
  ];
  const PERIODS = [
    { code: '24h', label: t('trendPulse.period24h') || '24h' },
    { code: '7d', label: t('trendPulse.period7d') || '7 jours' },
    { code: '30d', label: t('trendPulse.period30d') || '30 jours' },
  ];

  const [tab, setTab] = useState<TabType>('for-me');
  const [region, setRegion] = useState('CM');
  const [period, setPeriod] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [globalData, setGlobalData] = useState<TrendPulseResponse | null>(null);
  const [personalData, setPersonalData] = useState<TrendForMeResponse | null>(null);
  const [userCtx, setUserCtx] = useState<UserCommercialContextResponse | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [global, personal, ctx] = await Promise.all([
        trendService.getGlobalTrends(region, period),
        user ? trendService.getTrendsForMe(region, period) : Promise.resolve(null),
        user ? trendService.getUserContext() : Promise.resolve(null),
      ]);
      setGlobalData(global);
      setPersonalData(personal);
      setUserCtx(ctx);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [region, period, user]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    trendService.clearCache();
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleActionPress = useCallback(
    (action: TrendRecommendedAction) => {
      if (action.route) {
        (navigation as any).navigate(action.route, action.route_params || {});
      }
    },
    [navigation],
  );

  // ─── Rendu header profil commercial ──────────────────────────────────────────

  const renderProfileBanner = () => {
    if (!userCtx || !userCtx.is_provider) return null;
    return (
      <View style={styles.profileBanner}>
        <View style={styles.profileBannerLeft}>
          <SafeIcon name="store" size={18} color="#6366f1" type="lucide" />
          <View>
            <Text style={styles.profileBannerTitle}>
              {t('trendPulse.profileTitle') || 'Ton profil commercial'}
            </Text>
            <Text style={styles.profileBannerSub}>
              {(t('trendPulse.profileSummary') || '{{products}} produits · {{sectors}} · {{cities}}')
                .replace('{{products}}', String(userCtx.total_products))
                .replace('{{sectors}}', userCtx.sectors.slice(0, 2).join(', '))
                .replace('{{cities}}', userCtx.cities.slice(0, 2).join(', '))}
            </Text>
          </View>
        </View>
        {personalData && personalData.high_opportunity_count > 0 && (
          <View style={styles.opportunityBadge}>
            <Text style={styles.opportunityBadgeText}>
              {personalData.high_opportunity_count > 1
                ? (t('trendPulse.opportunitiesPlural') || '{{count}} opportunités').replace('{{count}}', String(personalData.high_opportunity_count))
                : (t('trendPulse.opportunities') || '{{count}} opportunité').replace('{{count}}', String(personalData.high_opportunity_count))}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ─── Rendu filtres ────────────────────────────────────────────────────────────

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {REGIONS.map(r => (
          <TouchableOpacity
            key={r.code}
            style={[styles.filterChip, region === r.code && styles.filterChipActive]}
            onPress={() => setRegion(r.code)}
          >
            <Text style={[styles.filterChipText, region === r.code && styles.filterChipTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.code}
            style={[styles.filterChip, period === p.code && styles.filterChipActive]}
            onPress={() => setPeriod(p.code)}
          >
            <Text style={[styles.filterChipText, period === p.code && styles.filterChipTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ─── Rendu onglet Secteurs ────────────────────────────────────────────────────

  const renderSectors = () => {
    const sectors: SectorTrend[] =
      (personalData?.top_sectors.length ? personalData.top_sectors : globalData?.top_sectors) ?? [];

    if (sectors.length === 0) {
      return (
        <View style={styles.emptyState}>
          <SafeIcon name="bar-chart-2" size={36} color="#cbd5e1" type="lucide" />
          <Text style={styles.emptyText}>{t('trendPulse.emptySectors') || 'Données sectorielles indisponibles'}</Text>
        </View>
      );
    }

    return (
      <View style={styles.sectorsGrid}>
        {sectors.map((s, i) => (
          <View key={i} style={styles.sectorCard}>
            <Text style={styles.sectorName}>{s.sector}</Text>
            <Text style={styles.sectorGrowth}>
              {(t('trendPulse.sectorGrowth') || '+{{pct}}%').replace('{{pct}}', String(Math.round(s.growth_pct)))}
            </Text>
            <Text style={styles.sectorTopic} numberOfLines={2}>{s.top_topic}</Text>
            <Text style={styles.sectorRegion}>{s.regions.slice(0, 2).join(' · ')}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ─── Rendu principal ──────────────────────────────────────────────────────────

  const currentTrends: TrendItemData[] =
    tab === 'for-me'
      ? personalData?.personalized_trends ?? []
      : globalData?.trends ?? [];

  const isEmpty = !loading && currentTrends.length === 0 && tab !== 'sectors';

  return (
    <SafeNativeView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <SafeIcon name="arrow-left" size={20} color="#1e293b" type="lucide" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('trendPulse.screenTitle') || 'TrendPulse'}</Text>
          <View style={styles.liveDot} />
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
          <SafeIcon name="refresh-cw" size={18} color="#6366f1" type="lucide" />
        </TouchableOpacity>
      </View>

      {/* Profil commercial banner */}
      {renderProfileBanner()}

      {/* Filtres région + période */}
      {renderFilters()}

      {/* Onglets */}
      <View style={styles.tabBar}>
        {user && (
          <TouchableOpacity
            style={[styles.tab, tab === 'for-me' && styles.tabActive]}
            onPress={() => setTab('for-me')}
          >
            <SafeIcon
              name="target"
              size={13}
              color={tab === 'for-me' ? '#6366f1' : '#94a3b8'}
              type="lucide"
            />
            <Text style={[styles.tabText, tab === 'for-me' && styles.tabTextActive]}>
              {t('trendPulse.tabForMe') || 'Pour moi'}
            </Text>
            {personalData && personalData.high_opportunity_count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{personalData.high_opportunity_count}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tab, tab === 'global' && styles.tabActive]}
          onPress={() => setTab('global')}
        >
          <SafeIcon
            name="globe"
            size={13}
            color={tab === 'global' ? '#6366f1' : '#94a3b8'}
            type="lucide"
          />
          <Text style={[styles.tabText, tab === 'global' && styles.tabTextActive]}>
            {t('trendPulse.tabGlobal') || 'Global'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sectors' && styles.tabActive]}
          onPress={() => setTab('sectors')}
        >
          <SafeIcon
            name="bar-chart-2"
            size={13}
            color={tab === 'sectors' ? '#6366f1' : '#94a3b8'}
            type="lucide"
          />
          <Text style={[styles.tabText, tab === 'sectors' && styles.tabTextActive]}>
            {t('trendPulse.tabSectors') || 'Secteurs'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loaderText}>{t('trendPulse.loading') || 'Analyse des tendances...'}</Text>
        </View>
      ) : tab === 'sectors' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />
          }
        >
          {renderSectors()}
        </ScrollView>
      ) : isEmpty ? (
        <View style={styles.emptyState}>
          <SafeIcon name="search" size={36} color="#cbd5e1" type="lucide" />
          <Text style={styles.emptyText}>
            {tab === 'for-me'
              ? t('trendPulse.emptyForMe') || 'Aucune tendance ne correspond à tes produits actuellement.'
              : t('trendPulse.emptyGlobal') || 'Aucune tendance disponible pour cette région.'}
          </Text>
          {tab === 'for-me' && !userCtx?.is_provider && (
            <TouchableOpacity
              style={styles.emptyAction}
              onPress={() => (navigation as any).navigate('MesProduits')}
            >
              <Text style={styles.emptyActionText}>
                {t('trendPulse.emptyAddProducts') || 'Ajouter des produits'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={currentTrends}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />
          }
          ListHeaderComponent={
            tab === 'for-me' && personalData ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {personalData.personalized_trends.length > 1
                    ? (t('trendPulse.trendsCountPlural') || '{{count}} tendances liées à ton catalogue')
                        .replace('{{count}}', String(personalData.personalized_trends.length))
                    : (t('trendPulse.trendsCount') || '{{count}} tendance liée à ton catalogue')
                        .replace('{{count}}', String(personalData.personalized_trends.length))}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TrendCard
              trend={item}
              onActionPress={handleActionPress}
            />
          )}
        />
      )}
    </SafeNativeView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  refreshBtn: {
    padding: 6,
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  profileBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  profileBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca',
  },
  profileBannerSub: {
    fontSize: 11,
    color: '#6366f1',
    marginTop: 1,
  },
  opportunityBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  opportunityBadgeText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterRow: {
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
  },
  filterChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#6366f1',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '800',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: '#64748b',
  },
  listContent: {
    padding: 14,
  },
  scrollContent: {
    padding: 14,
  },
  listHeader: {
    marginBottom: 8,
  },
  listHeaderText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAction: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyActionText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  sectorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectorCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  sectorGrowth: {
    fontSize: 20,
    fontWeight: '800',
    color: '#22c55e',
    marginBottom: 4,
  },
  sectorTopic: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
    marginBottom: 4,
  },
  sectorRegion: {
    fontSize: 10,
    color: '#94a3b8',
  },
});

export default TrendPulseDashboardScreen;
