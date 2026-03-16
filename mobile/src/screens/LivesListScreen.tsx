import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeIcon from '../components/SafeIcon';
import { LiveSessionRecord, liveStreamingService } from '../services/liveStreamingService';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: screenWidth } = Dimensions.get('window');

type LiveSessionWithStatus = LiveSessionRecord & {
  isLiveNow: boolean;
  timeUntilStart?: string;
};

export default function LivesListScreen() {
  const navigation = useNavigation();
    const { t } = useLanguageSafe();

  const [upcomingLives, setUpcomingLives] = useState<LiveSessionWithStatus[]>([]);
  const [liveNow, setLiveNow] = useState<LiveSessionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming'>('live');

  const loadLives = useCallback(async () => {
    try {
      const response = await liveStreamingService.getUpcomingLives(20);

      const backendResp = response.data as any;
      const sessionsArray = backendResp?.data || backendResp;

      if (Array.isArray(sessionsArray)) {
        const now = new Date();
        const lives = (sessionsArray as LiveSessionRecord[]).map((live: LiveSessionRecord) => ({
          ...live,
          isLiveNow: new Date(live.start_at) <= now && (!live.end_at || new Date(live.end_at) > now),
          timeUntilStart: getTimeUntilStart(live.start_at),
        }));

        const liveSessions = lives.filter(l => l.isLiveNow);
        const upcomingSessions = lives.filter(l => !l.isLiveNow);

        setLiveNow(liveSessions);
        setUpcomingLives(upcomingSessions);
      }
    } catch (error) {
      console.error('[LivesListScreen] Erreur chargement lives:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLives();
  }, [loadLives]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLives();
  }, [loadLives]);

  const getTimeUntilStart = (startTime: string): string => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = start.getTime() - now.getTime();

    if (diffMs <= 0) return 'Commence maintenant';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `Dans ${diffHours}h${diffMinutes > 0 ? ` ${diffMinutes}min` : ''}`;
    }
    return `Dans ${diffMinutes} min`;
  };

  const renderLiveItem = ({ item }: { item: LiveSessionWithStatus }) => (
    <TouchableOpacity
      style={styles.liveItem}
      onPress={() => {
        navigation.navigate('LiveViewerScreen' as any, { sessionId: item.id });
      }}
    >
      <View style={styles.liveItemHeader}>
        <View style={styles.liveIndicator}>
          <SafeIcon name="radio" size={8} color="#FFFFFF" />
          <Text style={styles.liveIndicatorText}>
            {item.isLiveNow ? 'LIVE' : 'À VENIR'}
          </Text>
        </View>
        <View style={styles.viewerCount}>
          <SafeIcon name="users" size={12} color="#6B7280" />
          <Text style={styles.viewerCountText}>
            {item.current_viewers || 0}
          </Text>
        </View>
      </View>

      <Text style={styles.liveTitle} numberOfLines={2}>
        {item.title}
      </Text>

      {item.description && (
        <Text style={styles.liveDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.liveFooter}>
        <View style={styles.hostInfo}>
          <SafeIcon name="user" size={12} color="#6B7280" />
          <Text style={styles.hostText}>
            {(item as any).host_name || (item as any).metadata?.host_name || `Hôte #${item.host_user_id}`}
          </Text>
        </View>

        {!item.isLiveNow && item.timeUntilStart && (
          <Text style={styles.startTime}>{item.timeUntilStart}</Text>
        )}
      </View>

      {item.isLiveNow && (
        <View style={styles.liveOverlay}>
          <SafeIcon name="play" size={16} color="#FFFFFF" />
          <Text style={styles.watchNowText}>Regarder</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <SafeIcon name="video-off" size={48} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>
        {activeTab === 'live' ? 'Aucun live en cours' : t('livesListScreen.aucunLiveProgramme')}
      </Text>
      <Text style={styles.emptyStateDescription}>
        {activeTab === 'live'
          ? 'Revenez plus tard pour voir les lives en cours'
          : t('livesListScreen.lesLivesProgrammesApparaitrontIci')
        }
      </Text>
    </View>
  );

  const renderTabButton = (tab: 'live' | 'upcoming', title: string, count: number) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && styles.tabButtonActive,
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tab && styles.tabButtonTextActive,
      ]}>
        {title}
      </Text>
      {count > 0 && (
        <View style={[
          styles.tabBadge,
          activeTab === tab && styles.tabBadgeActive,
        ]}>
          <Text style={[
            styles.tabBadgeText,
            activeTab === tab && styles.tabBadgeTextActive,
          ]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Lives</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>{t('livesList.chargementDesLives')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lives</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('StartLive' as any)}
        >
          <SafeIcon name="plus" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {renderTabButton('live', 'En direct', liveNow.length)}
        {renderTabButton('upcoming', 'À venir', upcomingLives.length)}
      </View>

      <FlatList
        data={activeTab === 'live' ? liveNow : upcomingLives}
        renderItem={renderLiveItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#DC2626',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: '#DC2626',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: '#DC2626',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  liveItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  liveItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  liveIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewerCountText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 22,
  },
  liveDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  liveFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hostText: {
    fontSize: 12,
    color: '#6B7280',
  },
  startTime: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  liveOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  watchNowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
