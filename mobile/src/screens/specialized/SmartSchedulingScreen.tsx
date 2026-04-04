// SmartSchedulingScreen.tsx
// Créneaux de publication optimaux par plateforme, basés sur les analytics réelles
// Endpoint: GET /api/social-ai/schedule/optimal/:service_id

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchWithAuth } from '../../services/api';

interface TimeSlot {
  hour: number;
  day_of_week: number;
  platform: string;
  engagement_score: number;
  post_count: number;
  recommended: boolean;
}

interface ScheduleData {
  service_id: number;
  top_slots: TimeSlot[];
  by_platform: Record<string, TimeSlot[]>;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const PLATFORMS = ['instagram', 'facebook', 'whatsapp', 'tiktok'];
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  whatsapp: '#25D366',
  tiktok: '#000000',
};
const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
};

export default function SmartSchedulingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const serviceId: number = route.params?.service_id ?? 0;

  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('instagram');

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/social-ai/schedule/optimal/${serviceId}`
      );
      if (res.ok) setData(await res.json());
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

  const formatHour = (h: number) => {
    const suffix = h < 12 ? 'AM' : 'PM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}h${suffix}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#00C851';
    if (score >= 60) return '#FFBB33';
    return '#FF4444';
  };

  // Heatmap 7×24 simplifié : 7 jours × top heures
  const renderHeatmap = () => {
    if (!data) return null;
    const slots = data.by_platform[selectedPlatform] ?? data.top_slots ?? [];
    const slotMap: Record<string, number> = {};
    slots.forEach(s => {
      slotMap[`${s.day_of_week}-${s.hour}`] = s.engagement_score;
    });

    // Afficher grille 7 jours × 24h
    const peakHours = [7, 8, 9, 12, 13, 17, 18, 19, 20, 21, 22];

    return (
      <View style={styles.heatmapContainer}>
        {/* En-tête jours */}
        <View style={styles.heatmapRow}>
          <View style={styles.heatmapHourLabel} />
          {DAYS.map(d => (
            <Text key={d} style={styles.heatmapDayLabel}>{d}</Text>
          ))}
        </View>

        {peakHours.map(h => (
          <View key={h} style={styles.heatmapRow}>
            <Text style={styles.heatmapHourLabel}>{formatHour(h)}</Text>
            {[0, 1, 2, 3, 4, 5, 6].map(d => {
              const score = slotMap[`${d}-${h}`] ?? 0;
              const alpha = score > 0 ? Math.max(0.1, score / 100) : 0;
              const color = PLATFORM_COLORS[selectedPlatform] ?? '#6C5CE7';
              return (
                <View
                  key={d}
                  style={[
                    styles.heatmapCell,
                    score > 0 && {
                      backgroundColor: color + Math.round(alpha * 255).toString(16).padStart(2, '0'),
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // Top 5 créneaux recommandés
  const renderTopSlots = () => {
    if (!data) return null;
    const slots = (data.by_platform[selectedPlatform] ?? data.top_slots ?? [])
      .filter(s => s.recommended)
      .slice(0, 5);

    if (slots.length === 0) {
      return (
        <View style={styles.noSlots}>
          <Text style={styles.noSlotsText}>
            Pas encore assez de données pour {PLATFORM_LABELS[selectedPlatform]}.
            Publiez plus de contenu pour débloquer les créneaux optimaux.
          </Text>
        </View>
      );
    }

    return slots.map((s, i) => (
      <View key={i} style={styles.slotCard}>
        <View style={styles.slotRank}>
          <Text style={styles.slotRankText}>#{i + 1}</Text>
        </View>
        <View style={styles.slotInfo}>
          <Text style={styles.slotTime}>
            {DAYS[s.day_of_week]} à {formatHour(s.hour)}
          </Text>
          <Text style={styles.slotMeta}>
            Basé sur {s.post_count} publication{s.post_count > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.slotScoreContainer}>
          <Text style={[styles.slotScore, { color: getScoreColor(s.engagement_score) }]}>
            {s.engagement_score}
          </Text>
          <Text style={styles.slotScoreLabel}>score</Text>
        </View>
        <TouchableOpacity
          style={styles.slotBtn}
          onPress={() => navigation.navigate('SocialAIScreen', { service_id: serviceId })}
        >
          <Text style={styles.slotBtnText}>Publier →</Text>
        </TouchableOpacity>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Créneaux Optimaux</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Sélecteur plateforme */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformScroll}>
        {PLATFORMS.map(p => (
          <TouchableOpacity
            key={p}
            style={[
              styles.platformBtn,
              selectedPlatform === p && { borderColor: PLATFORM_COLORS[p] },
            ]}
            onPress={() => setSelectedPlatform(p)}
          >
            <View
              style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[p] }]}
            />
            <Text style={[
              styles.platformLabel,
              selectedPlatform === p && { color: PLATFORM_COLORS[p], fontWeight: '700' },
            ]}>
              {PLATFORM_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#6C5CE7" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Heatmap */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heatmap d'engagement</Text>
            <Text style={styles.sectionSubtitle}>
              Intensité = taux d'engagement moyen sur vos posts
            </Text>
            {renderHeatmap()}
          </View>

          {/* Top créneaux */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top 5 créneaux recommandés</Text>
            {renderTopSlots()}
          </View>

          {/* Conseil */}
          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>⚡</Text>
            <Text style={styles.tipTitle}>Conseil IA</Text>
            <Text style={styles.tipText}>
              Publiez régulièrement aux créneaux recommandés. L'algorithme s'affine avec chaque
              nouveau post. Combinez avec les tendances TrendPulse pour maximiser la portée.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const BG = '#0F0F1A';
const CARD = '#1E1E2E';
const CARD2 = '#2A2A3E';
const TEXT = '#FFFFFF';
const MUTED = '#888';
const PRIMARY = '#6C5CE7';

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

  platformScroll: { paddingLeft: 16, marginBottom: 8, maxHeight: 50 },
  platformBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  platformDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  platformLabel: { color: MUTED, fontSize: 13 },

  scroll: { flex: 1, paddingHorizontal: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { color: MUTED, fontSize: 12, marginBottom: 12 },

  // Heatmap
  heatmapContainer: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    overflow: 'hidden',
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  heatmapHourLabel: {
    width: 46,
    color: MUTED,
    fontSize: 9,
  },
  heatmapDayLabel: {
    flex: 1,
    color: MUTED,
    fontSize: 9,
    textAlign: 'center',
  },
  heatmapCell: {
    flex: 1,
    height: 18,
    borderRadius: 3,
    marginHorizontal: 1,
    backgroundColor: CARD2,
  },

  // Slots
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  slotRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PRIMARY + '33',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  slotRankText: { color: PRIMARY, fontSize: 13, fontWeight: '700' },
  slotInfo: { flex: 1 },
  slotTime: { color: TEXT, fontSize: 14, fontWeight: '600' },
  slotMeta: { color: MUTED, fontSize: 11, marginTop: 2 },
  slotScoreContainer: { alignItems: 'center', marginHorizontal: 10 },
  slotScore: { fontSize: 20, fontWeight: '900' },
  slotScoreLabel: { color: MUTED, fontSize: 9 },
  slotBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  slotBtnText: { color: TEXT, fontSize: 12, fontWeight: '600' },

  noSlots: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  noSlotsText: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  tipCard: {
    backgroundColor: PRIMARY + '22',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: PRIMARY,
    marginBottom: 12,
  },
  tipIcon: { fontSize: 20, marginBottom: 6 },
  tipTitle: { color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tipText: { color: TEXT, fontSize: 13, lineHeight: 18 },
});
