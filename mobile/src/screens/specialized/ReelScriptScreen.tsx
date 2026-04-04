// ReelScriptScreen.tsx
// Génération de scripts Reels IA depuis une tendance ou un sujet libre
// GPT-4o → structure: hook / scènes / CTA / hashtags / musique / conseils

import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchWithAuth } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReelScene {
  duration_sec: number;
  visual: string;
  text_overlay: string;
  action: string;
}

interface ReelScript {
  hook: string;
  scenes: ReelScene[];
  cta: string;
  hashtags: string[];
  music_vibe: string;
  tips: string[];
  estimated_duration_sec: number;
}

// ─── Composant ────────────────────────────────────────────────────────────────
export default function ReelScriptScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const serviceId: number = route.params?.service_id ?? 0;
  const prefillTrend: string = route.params?.trend ?? '';

  const [topic, setTopic] = useState(prefillTrend);
  const [platform, setPlatform] = useState<'instagram' | 'tiktok'>('instagram');
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<ReelScript | null>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithAuth('/api/social-ai/content/reel-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          topic: topic.trim(),
          platform,
        }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      const data = await res.json();
      // Le backend renvoie { script: {...} } ou directement l'objet
      setScript(data.script ?? data);
    } catch (e: any) {
      setError('Impossible de générer le script. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const goToSocialAI = () => {
    navigation.navigate('SocialAIScreen', {
      service_id: serviceId,
      inject_trend: topic,
    });
  };

  // ── Rendu du script ────────────────────────────────────────────────────────
  const renderScript = () => {
    if (!script) return null;
    return (
      <ScrollView style={styles.scriptContainer} showsVerticalScrollIndicator={false}>
        {/* Hook */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⚡</Text>
            <Text style={styles.sectionTitle}>Hook (Accroche)</Text>
          </View>
          <Text style={styles.hookText}>{script.hook}</Text>
        </View>

        {/* Durée estimée */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            ⏱ {script.estimated_duration_sec}s estimées
          </Text>
        </View>

        {/* Scènes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎬</Text>
            <Text style={styles.sectionTitle}>Scènes ({script.scenes?.length ?? 0})</Text>
          </View>
          {(script.scenes ?? []).map((scene, i) => (
            <View key={i} style={styles.sceneCard}>
              <View style={styles.sceneHeader}>
                <Text style={styles.sceneNum}>Scène {i + 1}</Text>
                <Text style={styles.sceneDuration}>{scene.duration_sec}s</Text>
              </View>
              <Text style={styles.sceneField}>
                <Text style={styles.fieldKey}>Visuel: </Text>{scene.visual}
              </Text>
              {scene.text_overlay ? (
                <Text style={styles.sceneField}>
                  <Text style={styles.fieldKey}>Texte écran: </Text>"{scene.text_overlay}"
                </Text>
              ) : null}
              <Text style={styles.sceneField}>
                <Text style={styles.fieldKey}>Action: </Text>{scene.action}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎯</Text>
            <Text style={styles.sectionTitle}>Call to Action</Text>
          </View>
          <View style={styles.ctaBox}>
            <Text style={styles.ctaText}>{script.cta}</Text>
          </View>
        </View>

        {/* Hashtags */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>#</Text>
            <Text style={styles.sectionTitle}>Hashtags</Text>
          </View>
          <View style={styles.hashtagsWrap}>
            {(script.hashtags ?? []).map((tag, i) => (
              <View key={i} style={styles.hashtagChip}>
                <Text style={styles.hashtagText}>
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Ambiance musicale */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎵</Text>
            <Text style={styles.sectionTitle}>Ambiance musicale</Text>
          </View>
          <Text style={styles.musicText}>{script.music_vibe}</Text>
        </View>

        {/* Conseils */}
        {(script.tips ?? []).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>💡</Text>
              <Text style={styles.sectionTitle}>Conseils de tournage</Text>
            </View>
            {script.tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <TouchableOpacity style={styles.btnSecondary} onPress={goToSocialAI}>
          <Text style={styles.btnSecondaryText}>Générer le post associé →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnOutline} onPress={generate}>
          <Text style={styles.btnOutlineText}>Regénérer le script</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Script Reels IA</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.formLabel}>Sujet ou tendance</Text>
        <TextInput
          style={styles.input}
          value={topic}
          onChangeText={setTopic}
          placeholder="Ex: FIFA2026, Soldes été, Recette rapide…"
          placeholderTextColor="#666"
          multiline={false}
          returnKeyType="done"
        />

        {/* Sélecteur plateforme */}
        <View style={styles.platformRow}>
          {(['instagram', 'tiktok'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.platformBtn, platform === p && styles.platformBtnActive]}
              onPress={() => setPlatform(p)}
            >
              <Text style={[styles.platformBtnText, platform === p && styles.platformBtnTextActive]}>
                {p === 'instagram' ? '📸 Instagram' : '🎵 TikTok'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btnGenerate, (!topic.trim() || loading) && styles.btnDisabled]}
          onPress={generate}
          disabled={!topic.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnGenerateText}>
              {script ? 'Regénérer' : '✨ Générer le script'}
            </Text>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {/* Script généré */}
      {!script && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={styles.emptyTitle}>Script Reels IA</Text>
          <Text style={styles.emptyDesc}>
            Entrez un sujet ou une tendance pour que l'IA crée un script Reels complet :
            accroche, scènes, CTA, hashtags et ambiance musicale.
          </Text>
        </View>
      )}

      {script && renderScript()}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const PRIMARY = '#FF6B6B';
const SURFACE = '#0F0F1A';
const CARD = '#1E1E2E';
const CARD2 = '#2A2A3E';
const TEXT = '#FFFFFF';
const MUTED = '#888';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: CARD2,
  },
  backBtn: { padding: 8 },
  backText: { color: TEXT, fontSize: 22 },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },

  form: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: CARD2,
  },
  formLabel: { color: TEXT, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    color: TEXT,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  platformRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  platformBtn: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  platformBtnActive: { borderColor: PRIMARY },
  platformBtnText: { color: MUTED, fontSize: 14, fontWeight: '600' },
  platformBtnTextActive: { color: TEXT },
  btnGenerate: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  btnGenerateText: { color: TEXT, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  errorText: { color: '#FF6B6B', fontSize: 13, marginTop: 8, textAlign: 'center' },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: TEXT, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { color: MUTED, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Script
  scriptContainer: { flex: 1, padding: 16 },
  durationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF6B6B22',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  durationText: { color: PRIMARY, fontSize: 12, fontWeight: '700' },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionIcon: { fontSize: 18, marginRight: 6 },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '700' },

  hookText: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: CARD2,
    borderRadius: 12,
    padding: 16,
    lineHeight: 26,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },

  sceneCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  sceneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sceneNum: { color: PRIMARY, fontSize: 13, fontWeight: '700' },
  sceneDuration: { color: MUTED, fontSize: 13 },
  sceneField: { color: TEXT, fontSize: 13, marginBottom: 4, lineHeight: 18 },
  fieldKey: { color: MUTED, fontWeight: '600' },

  ctaBox: {
    backgroundColor: '#FF6B6B22',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  ctaText: { color: TEXT, fontSize: 15, fontWeight: '600', textAlign: 'center' },

  hashtagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hashtagChip: {
    backgroundColor: CARD2,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hashtagText: { color: PRIMARY, fontSize: 13, fontWeight: '600' },

  musicText: {
    color: TEXT,
    fontSize: 14,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 14,
    fontStyle: 'italic',
  },

  tipRow: { flexDirection: 'row', marginBottom: 6 },
  tipBullet: { color: PRIMARY, fontSize: 16, marginRight: 8, lineHeight: 20 },
  tipText: { color: TEXT, fontSize: 13, flex: 1, lineHeight: 20 },

  btnSecondary: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  btnSecondaryText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnOutlineText: { color: MUTED, fontSize: 14 },
});
