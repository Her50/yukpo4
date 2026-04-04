// EmailCampaignScreen.tsx
// Création et gestion de campagnes email marketing générées par GPT-4o
// Endpoint: POST /api/social-ai/email/campaigns + GET /api/social-ai/email/campaigns/:id

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

interface Campaign {
  id: number;
  name: string;
  subject: string;
  status: string;
  segment: string;
  recipient_count: number;
  sent_count: number;
  open_rate: number;
  click_rate: number;
  created_at: string | null;
  sent_at: string | null;
}

const SEGMENTS = [
  { key: 'all', label: 'Tous les clients' },
  { key: 'vip', label: 'VIP uniquement' },
  { key: 'active_7d', label: 'Actifs 7 derniers jours' },
  { key: 'active_30d', label: 'Actifs 30 derniers jours' },
  { key: 'high_value', label: 'Haute valeur (>10k FCFA)' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: '#888',
  scheduled: '#FFBB33',
  sending: '#33B5E5',
  sent: '#00C851',
  failed: '#FF4444',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmée',
  sending: 'En cours',
  sent: 'Envoyée',
  failed: 'Échec',
};

export default function EmailCampaignScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const serviceId: number = route.params?.service_id ?? 0;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Création
  const [campaignName, setCampaignName] = useState('');
  const [topic, setTopic] = useState('');
  const [segment, setSegment] = useState('all');
  const [creating, setCreating] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<any>(null);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/social-ai/email/campaigns/${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns ?? []);
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serviceId]);

  useEffect(() => { load(); }, [load]);

  const createCampaign = async () => {
    if (!topic.trim()) return;
    setCreating(true);
    try {
      const res = await fetchWithAuth('/api/social-ai/email/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          name: campaignName || topic.slice(0, 40),
          topic,
          target_segment: segment,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewCampaign(data);
        setCampaignName('');
        setTopic('');
        setSegment('all');
      }
    } catch (_) {
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Email Marketing</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreate(true)}
        >
          <Text style={styles.createBtnText}>+ Créer</Text>
        </TouchableOpacity>
      </View>

      {/* Liste campagnes */}
      {loading && campaigns.length === 0 ? (
        <ActivityIndicator color="#6C5CE7" size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {campaigns.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📧</Text>
              <Text style={styles.emptyTitle}>Aucune campagne</Text>
              <Text style={styles.emptyText}>
                Créez votre première campagne email générée par IA
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.emptyBtnText}>Créer une campagne</Text>
              </TouchableOpacity>
            </View>
          ) : (
            campaigns.map(c => (
              <View key={c.id} style={styles.campaignCard}>
                <View style={styles.campaignHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.campaignSubject} numberOfLines={1}>
                      {c.subject}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[c.status] + '22', borderColor: STATUS_COLORS[c.status] }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[c.status] }]}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.campaignStats}>
                  <View style={styles.campaignStat}>
                    <Text style={styles.statVal}>{c.recipient_count}</Text>
                    <Text style={styles.statLbl}>Destinataires</Text>
                  </View>
                  <View style={styles.campaignStat}>
                    <Text style={styles.statVal}>{c.open_rate}%</Text>
                    <Text style={styles.statLbl}>Taux ouverture</Text>
                  </View>
                  <View style={styles.campaignStat}>
                    <Text style={styles.statVal}>{c.click_rate}%</Text>
                    <Text style={styles.statLbl}>Taux clic</Text>
                  </View>
                  <View style={styles.campaignStat}>
                    <Text style={styles.statVal}>{c.segment}</Text>
                    <Text style={styles.statLbl}>Segment</Text>
                  </View>
                </View>

                <Text style={styles.campaignDate}>
                  {c.sent_at ? `Envoyée le ${formatDate(c.sent_at)}` : `Créée le ${formatDate(c.created_at)}`}
                </Text>
              </View>
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Modal création */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowCreate(false); setPreviewCampaign(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {previewCampaign ? (
              // Aperçu de la campagne générée
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.previewTitle}>Campagne générée ✅</Text>

                <View style={styles.previewField}>
                  <Text style={styles.previewLabel}>Objet</Text>
                  <Text style={styles.previewValue}>{previewCampaign.subject}</Text>
                </View>

                <View style={styles.previewField}>
                  <Text style={styles.previewLabel}>Destinataires</Text>
                  <Text style={styles.previewValue}>{previewCampaign.recipient_count} clients</Text>
                </View>

                <View style={styles.previewField}>
                  <Text style={styles.previewLabel}>Contenu</Text>
                  <ScrollView style={styles.previewContent}>
                    <Text style={styles.previewContentText}>{previewCampaign.content_text}</Text>
                  </ScrollView>
                </View>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => {
                    setPreviewCampaign(null);
                    setShowCreate(false);
                    load();
                  }}
                >
                  <Text style={styles.btnPrimaryText}>Enregistrer le brouillon</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => setPreviewCampaign(null)}
                >
                  <Text style={styles.btnSecondaryText}>Regénérer</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              // Formulaire création
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Nouvelle campagne email</Text>

                <Text style={styles.fieldLabel}>Nom de la campagne</Text>
                <TextInput
                  style={styles.input}
                  value={campaignName}
                  onChangeText={setCampaignName}
                  placeholder="Ex: Promo Pâques, Nouveautés…"
                  placeholderTextColor="#666"
                />

                <Text style={styles.fieldLabel}>Sujet / Thème</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  value={topic}
                  onChangeText={setTopic}
                  placeholder="Décrivez le sujet de la campagne. L'IA génère le contenu complet."
                  placeholderTextColor="#666"
                  multiline
                />

                <Text style={styles.fieldLabel}>Segment cible</Text>
                {SEGMENTS.map(s => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.segmentOption, segment === s.key && styles.segmentOptionActive]}
                    onPress={() => setSegment(s.key)}
                  >
                    <View style={[styles.segmentRadio, segment === s.key && styles.segmentRadioActive]} />
                    <Text style={styles.segmentOptionText}>{s.label}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[styles.btnPrimary, (!topic.trim() || creating) && styles.btnDisabled]}
                  onPress={createCampaign}
                  disabled={!topic.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Générer avec l'IA</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnClose}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={styles.btnCloseText}>Annuler</Text>
                </TouchableOpacity>

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  createBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  createBtnText: { color: TEXT, fontSize: 14, fontWeight: '700' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  // Campagne card
  campaignCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  campaignName: { color: TEXT, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  campaignSubject: { color: MUTED, fontSize: 12 },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    marginLeft: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  campaignStats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  campaignStat: {
    flex: 1,
    backgroundColor: CARD2,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statVal: { color: TEXT, fontSize: 13, fontWeight: '700' },
  statLbl: { color: MUTED, fontSize: 9, marginTop: 2 },
  campaignDate: { color: MUTED, fontSize: 11 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: TEXT, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: MUTED, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  emptyBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: TEXT, fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#444',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 20 },
  fieldLabel: { color: TEXT, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: CARD2,
    borderRadius: 10,
    padding: 12,
    color: TEXT,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  segmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentOptionActive: { borderColor: PRIMARY },
  segmentRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: MUTED,
    marginRight: 10,
  },
  segmentRadioActive: { borderColor: PRIMARY, backgroundColor: PRIMARY },
  segmentOptionText: { color: TEXT, fontSize: 14 },

  previewTitle: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  previewField: { marginBottom: 14 },
  previewLabel: { color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  previewValue: { color: TEXT, fontSize: 14 },
  previewContent: {
    backgroundColor: CARD2,
    borderRadius: 10,
    padding: 12,
    maxHeight: 160,
  },
  previewContentText: { color: TEXT, fontSize: 13, lineHeight: 20 },

  btnPrimary: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  btnPrimaryText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondaryText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
  btnClose: { padding: 14, alignItems: 'center' },
  btnCloseText: { color: MUTED, fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
});
