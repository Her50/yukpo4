// BenchmarkAnalyticsScreen.tsx
// Dashboard d'analytics comparatif — votre performance vs la moyenne du secteur
// Endpoint: GET /api/social-ai/analytics/benchmark/:service_id

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchWithAuth } from '../../services/api';

const { width } = Dimensions.get('window');

interface Metric {
  label: string;
  your_value: number;
  sector_avg: number;
  sector_p75: number;
  unit: string;
  higher_is_better: boolean;
}

interface BenchmarkData {
  service_id: number;
  period_days: number;
  metrics: Metric[];
  global_score: number;
  rank_label: string;
}

const PERIOD_OPTIONS = [
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
];

export default function BenchmarkAnalyticsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const serviceId: number = route.params?.service_id ?? 0;

  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(30);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/social-ai/analytics/benchmark/${serviceId}?days=${period}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serviceId, period]);

  useEffect(() => { load(); }, [load]);

  const getStatus = (m: Metric) => {
    const ratio = m.your_value / Math.max(m.sector_avg, 1);
    if (m.higher_is_better) {
      if (ratio >= 1.2) return 'excellent';
      if (ratio >= 0.9) return 'good';
      if (ratio >= 0.6) return 'average';
      return 'below';
    } else {
      if (ratio <= 0.8) return 'excellent';
      if (ratio <= 1.1) return 'good';
      if (ratio <= 1.5) return 'average';
      return 'below';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'excellent': return '#00C851';
      case 'good': return '#33B5E5';
      case 'average': return '#FFBB33';
      default: return '#FF4444';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Bon';
      case 'average': return 'Dans la moyenne';
      default: return 'À améliorer';
    }
  };

  // Barre de comparaison visuelle
  const renderBar = (m: Metric) => {
    const max = Math.max(m.your_value, m.sector_p75, m.sector_avg, 1);
    const yourPct = Math.min((m.your_value / max) * 100, 100);
    const avgPct = Math.min((m.sector_avg / max) * 100, 100);
    const status = getStatus(m);
    const color = statusColor(status);

    return (
      <View key={m.label} style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>{m.label}</Text>
          <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.statusText, { color }]}>{statusLabel(status)}</Text>
          </View>
        </View>

        {/* Barre votre valeur */}
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>Vous</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${yourPct}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.barValue}>
            {m.your_value.toLocaleString()} {m.unit}
          </Text>
        </View>

        {/* Barre moyenne secteur */}
        <View style={styles.barRow}>
          <Text style={[styles.barLabel, { color: '#888' }]}>Secteur</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${avgPct}%`, backgroundColor: '#555' }]} />
          </View>
          <Text style={[styles.barValue, { color: '#888' }]}>
            {m.sector_avg.toLocaleString()} {m.unit}
          </Text>
        </View>

        {/* P75 */}
        <Text style={styles.p75Text}>
          Top 25%: {m.sector_p75.toLocaleString()} {m.unit}
        </Text>
      </View>
    );
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return '#00C851';
    if (score >= 60) return '#33B5E5';
    if (score >= 40) return '#FFBB33';
    return '#FF4444';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Benchmark Sectoriel</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Sélecteur période */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map(p => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.periodText, period === p.value && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? (
          <ActivityIndicator color="#6C5CE7" size="large" style={{ marginTop: 60 }} />
        ) : data ? (
          <>
            {/* Score global */}
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Score Global</Text>
              <View style={[styles.scoreCircle, { borderColor: scoreColor(data.global_score) }]}>
                <Text style={[styles.scoreValue, { color: scoreColor(data.global_score) }]}>
                  {data.global_score}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <Text style={[styles.rankLabel, { color: scoreColor(data.global_score) }]}>
                {data.rank_label}
              </Text>
              <Text style={styles.scoreSub}>
                Comparé aux partenaires du même secteur sur {data.period_days} jours
              </Text>
            </View>

            {/* Métriques */}
            <Text style={styles.sectionTitle}>Détail par métrique</Text>
            {(data.metrics ?? []).map(m => renderBar(m))}

            {/* Conseil IA */}
            <View style={styles.tipCard}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipTitle}>Comment progresser ?</Text>
              <Text style={styles.tipText}>
                Concentrez-vous sur les métriques marquées "À améliorer". Publiez aux créneaux
                optimaux (voir Smart Scheduling) et injectez les tendances TrendPulse dans vos posts.
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>Données insuffisantes pour le benchmark</Text>
            <Text style={styles.emptySubText}>Publiez du contenu pour commencer à être comparé</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const PRIMARY = '#6C5CE7';
const BG = '#0F0F1A';
const CARD = '#1E1E2E';
const CARD2 = '#2A2A3E';
const TEXT = '#FFFFFF';
const MUTED = '#888';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  backText: { color: TEXT, fontSize: 22 },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },

  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  periodBtn: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodBtnActive: { borderColor: PRIMARY },
  periodText: { color: MUTED, fontSize: 13 },
  periodTextActive: { color: TEXT, fontWeight: '600' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  // Score global
  scoreCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreLabel: { color: MUTED, fontSize: 13, marginBottom: 12 },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    flexDirection: 'row',
  },
  scoreValue: { fontSize: 36, fontWeight: '900' },
  scoreMax: { color: MUTED, fontSize: 14, marginTop: 12 },
  rankLabel: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  scoreSub: { color: MUTED, fontSize: 12, textAlign: 'center' },

  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 12 },

  // Carte métrique
  metricCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: { color: TEXT, fontSize: 14, fontWeight: '600', flex: 1 },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { color: TEXT, fontSize: 11, width: 50 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: CARD2,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { color: TEXT, fontSize: 11, width: 70, textAlign: 'right' },
  p75Text: { color: MUTED, fontSize: 10, marginTop: 4 },

  // Tip
  tipCard: {
    backgroundColor: PRIMARY + '22',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  tipIcon: { fontSize: 24, marginBottom: 8 },
  tipTitle: { color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  tipText: { color: TEXT, fontSize: 13, lineHeight: 18 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: TEXT, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptySubText: { color: MUTED, fontSize: 13, textAlign: 'center' },
});
