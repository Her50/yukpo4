// WhatsAppBroadcastScreen.tsx
// Envoi de messages en masse à tous les clients WhatsApp du service
// + Suivi des broadcasts précédents + Abandoned cart recovery

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchWithAuth } from '../../services/api';

interface Broadcast {
  id: number;
  name: string;
  message_preview: string;
  status: string;
  segment: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivery_rate: number;
  created_at: string | null;
  sent_at: string | null;
}

const SEGMENTS = [
  { key: 'all', label: '👥 Tous les clients' },
  { key: 'vip', label: '⭐ VIP uniquement' },
  { key: 'high_value', label: '💰 Haute valeur' },
  { key: 'active_7d', label: '🔥 Actifs 7 jours' },
  { key: 'active_30d', label: '📅 Actifs 30 jours' },
];

const MESSAGE_TEMPLATES = [
  { label: '🛍️ Promo flash', text: 'PROMO FLASH ⚡ -20% sur tous nos produits aujourd\'hui seulement ! Tapez "voir les promos" pour en profiter 🎉' },
  { label: '📦 Nouveautés', text: 'De nouveaux produits viennent d\'arriver en stock ! Tapez "nouveautés" pour les découvrir 🆕✨' },
  { label: '🎁 Cadeau', text: 'Offre spéciale pour nos clients fidèles 🎁 Tapez "cadeau" pour découvrir votre surprise !' },
  { label: '📢 Annonce', text: 'Bonjour ! Nous avons une annonce importante pour vous. Tapez "info" pour en savoir plus 📢' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#888',
  sending: '#33B5E5',
  sent: '#00C851',
  failed: '#FF4444',
};

export default function WhatsAppBroadcastScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const serviceId: number = route.params?.service_id ?? 0;

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'send' | 'history' | 'recovery'>('send');

  // Formulaire broadcast
  const [broadcastName, setBroadcastName] = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState('all');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  // Abandoned cart
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<any>(null);

  const loadBroadcasts = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/social-ai/whatsapp/broadcasts/${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.broadcasts ?? []);
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serviceId]);

  useEffect(() => {
    if (activeTab === 'history') loadBroadcasts();
  }, [activeTab, loadBroadcasts]);

  const sendBroadcast = async () => {
    if (!message.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetchWithAuth('/api/social-ai/whatsapp/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          name: broadcastName || `Broadcast ${new Date().toLocaleDateString()}`,
          message_text: message,
          target_segment: segment,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSendResult(data);
        setBroadcastName('');
        setMessage('');
      }
    } catch (_) {
    } finally {
      setSending(false);
    }
  };

  const detectAbandonedCarts = async () => {
    setDetecting(true);
    setDetectionResult(null);
    try {
      const res = await fetchWithAuth('/api/social-ai/crm/abandoned-cart/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId, delay_hours: 24 }),
      });
      if (res.ok) setDetectionResult(await res.json());
    } catch (_) {
    } finally {
      setDetecting(false);
    }
  };

  const processAbandonedCarts = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetchWithAuth('/api/social-ai/crm/abandoned-cart/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) setProcessResult(await res.json());
    } catch (_) {
    } finally {
      setProcessing(false);
    }
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Il y a moins d'1h";
    if (h < 24) return `Il y a ${h}h`;
    return `Il y a ${Math.floor(h / 24)}j`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WhatsApp Broadcast</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'send', label: '📤 Envoyer' },
          { key: 'history', label: '📋 Historique' },
          { key: 'recovery', label: '🔄 Recovery' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key as any)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          activeTab === 'history'
            ? <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBroadcasts(); }} />
            : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Tab Envoyer ── */}
        {activeTab === 'send' && (
          <View>
            {sendResult ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultIcon}>
                  {sendResult.mode === 'simulation' ? '🎭' : '✅'}
                </Text>
                <Text style={styles.resultTitle}>
                  {sendResult.mode === 'simulation' ? 'Mode simulation' : 'Broadcast envoyé !'}
                </Text>
                <Text style={styles.resultText}>
                  {sendResult.sent ?? sendResult.total_recipients} destinataires atteints
                </Text>
                {sendResult.note && (
                  <Text style={styles.resultNote}>{sendResult.note}</Text>
                )}
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => setSendResult(null)}
                >
                  <Text style={styles.btnSecondaryText}>Nouveau broadcast</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Nom du broadcast</Text>
                <TextInput
                  style={styles.input}
                  value={broadcastName}
                  onChangeText={setBroadcastName}
                  placeholder="Ex: Promo Pâques 2026"
                  placeholderTextColor="#666"
                />

                {/* Templates */}
                <Text style={styles.fieldLabel}>Templates rapides</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
                  {MESSAGE_TEMPLATES.map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.templateChip}
                      onPress={() => setMessage(t.text)}
                    >
                      <Text style={styles.templateChipText}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Message</Text>
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Votre message WhatsApp…"
                  placeholderTextColor="#666"
                  multiline
                />
                <Text style={styles.charCount}>{message.length} / 1024 caractères</Text>

                <Text style={styles.fieldLabel}>Cible</Text>
                {SEGMENTS.map(s => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.segmentOption, segment === s.key && styles.segmentOptionActive]}
                    onPress={() => setSegment(s.key)}
                  >
                    <View style={[styles.segmentRadio, segment === s.key && styles.segmentRadioActive]} />
                    <Text style={[styles.segmentOptionText, segment === s.key && styles.segmentOptionTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>
                    ⚠️ Envoi limité aux clients WhatsApp connectés à ce service.
                    Respectez les règles WhatsApp Business : max 1 broadcast/jour par client.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, (!message.trim() || sending) && styles.btnDisabled]}
                  onPress={sendBroadcast}
                  disabled={!message.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>📤 Envoyer le broadcast</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Tab Historique ── */}
        {activeTab === 'history' && (
          <View>
            {loading ? (
              <ActivityIndicator color="#6C5CE7" style={{ marginTop: 40 }} />
            ) : broadcasts.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>Aucun broadcast envoyé</Text>
              </View>
            ) : (
              broadcasts.map(b => (
                <View key={b.id} style={styles.broadcastCard}>
                  <View style={styles.broadcastHeader}>
                    <Text style={styles.broadcastName} numberOfLines={1}>{b.name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[b.status] + '22', borderColor: STATUS_COLORS[b.status] }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] }]}>{b.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.broadcastPreview} numberOfLines={2}>{b.message_preview}</Text>
                  <View style={styles.broadcastStats}>
                    <Text style={styles.broadcastStat}>👥 {b.total_recipients} destinataires</Text>
                    <Text style={styles.broadcastStat}>✅ {b.delivery_rate}% livrés</Text>
                    <Text style={styles.broadcastStat}>{timeAgo(b.sent_at ?? b.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Tab Recovery ── */}
        {activeTab === 'recovery' && (
          <View>
            <View style={styles.recoveryHeader}>
              <Text style={styles.recoveryTitle}>Abandoned Cart Recovery</Text>
              <Text style={styles.recoveryDesc}>
                Détecte les clients qui ont montré un intent d'achat mais n'ont pas commandé,
                et programme une relance WhatsApp automatique 24h après.
              </Text>
            </View>

            {/* Détecter */}
            <TouchableOpacity
              style={[styles.recoveryBtn, detecting && styles.btnDisabled]}
              onPress={detectAbandonedCarts}
              disabled={detecting}
            >
              {detecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.recoveryBtnIcon}>🔍</Text>
                  <View>
                    <Text style={styles.recoveryBtnTitle}>Détecter les paniers abandonnés</Text>
                    <Text style={styles.recoveryBtnDesc}>Analyse les conversations des 48 dernières heures</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {detectionResult && (
              <View style={styles.resultBox}>
                <Text style={styles.resultBoxTitle}>
                  🛒 {detectionResult.abandoned_carts_detected} paniers détectés
                </Text>
                <Text style={styles.resultBoxText}>
                  {detectionResult.recovery_jobs_created} relances programmées dans {detectionResult.scheduled_in_hours}h
                </Text>
              </View>
            )}

            {/* Traiter les relances */}
            <TouchableOpacity
              style={[styles.recoveryBtn, { backgroundColor: '#25D36622', borderColor: '#25D366' }, processing && styles.btnDisabled]}
              onPress={processAbandonedCarts}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#25D366" />
              ) : (
                <>
                  <Text style={styles.recoveryBtnIcon}>📤</Text>
                  <View>
                    <Text style={[styles.recoveryBtnTitle, { color: '#25D366' }]}>Envoyer les relances prêtes</Text>
                    <Text style={styles.recoveryBtnDesc}>Traite les jobs dont l'heure est passée</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {processResult && (
              <View style={[styles.resultBox, { borderColor: '#25D366' }]}>
                <Text style={styles.resultBoxTitle}>
                  ✅ {processResult.sent} relances envoyées
                </Text>
                {processResult.failed > 0 && (
                  <Text style={[styles.resultBoxText, { color: '#FF4444' }]}>
                    {processResult.failed} échecs
                  </Text>
                )}
              </View>
            )}

            <View style={styles.recoveryInfo}>
              <Text style={styles.recoveryInfoTitle}>Comment ça marche ?</Text>
              <Text style={styles.recoveryInfoText}>
                1️⃣ L'IA détecte les clients ayant posé des questions sur des produits (intent achat){'\n'}
                2️⃣ Si pas de commande dans les 2h, un job est programmé pour 24h plus tard{'\n'}
                3️⃣ Un message de relance personnalisé est envoyé automatiquement{'\n'}
                4️⃣ Les résultats sont trackés dans le CRM
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const BG = '#0F0F1A';
const CARD = '#1E1E2E';
const CARD2 = '#2A2A3E';
const TEXT = '#FFFFFF';
const MUTED = '#888';
const PRIMARY = '#25D366'; // WhatsApp green

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

  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 12 },
  tab: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: PRIMARY },
  tabText: { color: MUTED, fontSize: 12 },
  tabTextActive: { color: TEXT, fontWeight: '700' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  fieldLabel: { color: TEXT, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 12,
    color: TEXT,
    fontSize: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  messageInput: { height: 120, textAlignVertical: 'top' },
  charCount: { color: MUTED, fontSize: 11, textAlign: 'right', marginBottom: 12 },

  templatesScroll: { marginBottom: 12, maxHeight: 44 },
  templateChip: {
    backgroundColor: PRIMARY + '22',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  templateChipText: { color: PRIMARY, fontSize: 12, fontWeight: '600' },

  segmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentOptionActive: { borderColor: PRIMARY },
  segmentRadio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: MUTED, marginRight: 10,
  },
  segmentRadioActive: { borderColor: PRIMARY, backgroundColor: PRIMARY },
  segmentOptionText: { color: MUTED, fontSize: 14 },
  segmentOptionTextActive: { color: TEXT },

  warnBox: {
    backgroundColor: '#FFBB3322',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFBB33',
  },
  warnText: { color: '#FFBB33', fontSize: 12, lineHeight: 18 },

  btnPrimary: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnPrimaryText: { color: '#000', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  btnSecondaryText: { color: PRIMARY, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },

  // Résultat
  resultCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultIcon: { fontSize: 48, marginBottom: 12 },
  resultTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  resultText: { color: TEXT, fontSize: 15, marginBottom: 8 },
  resultNote: { color: MUTED, fontSize: 12, textAlign: 'center', marginBottom: 12 },

  // Historique
  broadcastCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  broadcastHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  broadcastName: { color: TEXT, fontSize: 14, fontWeight: '700', flex: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  broadcastPreview: { color: MUTED, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  broadcastStats: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  broadcastStat: { color: MUTED, fontSize: 11 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: MUTED, fontSize: 15 },

  // Recovery
  recoveryHeader: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 16 },
  recoveryTitle: { color: TEXT, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  recoveryDesc: { color: MUTED, fontSize: 13, lineHeight: 18 },
  recoveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE722',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#6C5CE7',
    gap: 12,
  },
  recoveryBtnIcon: { fontSize: 28 },
  recoveryBtnTitle: { color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  recoveryBtnDesc: { color: MUTED, fontSize: 12 },
  resultBox: {
    backgroundColor: '#6C5CE722',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  resultBoxTitle: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  resultBoxText: { color: MUTED, fontSize: 13 },
  recoveryInfo: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  recoveryInfoTitle: { color: TEXT, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  recoveryInfoText: { color: MUTED, fontSize: 13, lineHeight: 22 },
});
