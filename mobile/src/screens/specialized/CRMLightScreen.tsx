// CRMLightScreen.tsx
// CRM léger Yukpo — profils clients, historique conversations, segmentation, VIP, follow-up

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

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: number;
  external_id: string;
  platform: string;
  name: string | null;
  total_orders: number;
  total_spent_fcfa: number;
  sentiment: string | null;
  is_vip: boolean;
  last_seen_at: string | null;
  conversation_count: number;
  preferred_category: string | null;
  follow_up_needed: boolean;
  thread_status: string | null;
}

interface Stats {
  total_customers: number;
  vip_count: number;
  follow_up_count: number;
  total_revenue_fcfa: number;
}

const SEGMENTS = [
  { key: 'all', label: 'Tous' },
  { key: 'vip', label: '⭐ VIP' },
  { key: 'follow_up', label: '🔔 Follow-up' },
  { key: 'high_value', label: '💰 Haute valeur' },
  { key: 'active_7d', label: '🔥 Actifs 7j' },
];

const PLATFORM_ICONS: Record<string, string> = {
  whatsapp: '📱',
  messenger: '💬',
  instagram: '📸',
  instagram_dm: '📸',
  facebook_comment: '👥',
};

// ─── Composant principal ─────────────────────────────────────────────────────
export default function CRMLightScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const serviceId: number = route.params?.service_id ?? 0;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');

  // Modal profil
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editVip, setEditVip] = useState(false);
  const [editFollowUp, setEditFollowUp] = useState(false);
  const [followUpNote, setFollowUpNote] = useState('');

  const load = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `/api/social-ai/crm/customers/${serviceId}?segment=${segment}&limit=100`
      );
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
        setStats(data.stats ?? null);
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serviceId, segment]);

  useEffect(() => { load(); }, [load]);

  const loadProfile = async (c: Customer) => {
    setSelectedCustomer(c);
    setProfileLoading(true);
    setEditVip(c.is_vip);
    setEditFollowUp(c.follow_up_needed);
    setFollowUpNote('');
    try {
      const res = await fetchWithAuth(
        `/api/social-ai/crm/customer/${serviceId}/${encodeURIComponent(c.external_id)}`
      );
      if (res.ok) setProfileData(await res.json());
    } catch (_) {
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!selectedCustomer) return;
    await fetchWithAuth(
      `/api/social-ai/crm/customer/${serviceId}/${encodeURIComponent(selectedCustomer.external_id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_vip: editVip,
          follow_up_needed: editFollowUp,
          follow_up_note: followUpNote || undefined,
        }),
      }
    );
    setSelectedCustomer(null);
    setProfileData(null);
    load();
  };

  const filteredCustomers = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.name ?? '').toLowerCase().includes(q) ||
      c.external_id.toLowerCase().includes(q) ||
      (c.preferred_category ?? '').toLowerCase().includes(q)
    );
  });

  const formatAmount = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k FCFA` : `${n} FCFA`;

  const sentimentColor = (s: string | null) => {
    switch (s) {
      case 'positive': return '#00C851';
      case 'negative': return '#FF4444';
      default: return '#FFBB33';
    }
  };

  const timeAgo = (iso: string | null) => {
    if (!iso) return 'Jamais';
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Il y a moins d'1h";
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `Il y a ${d}j`;
    return `Il y a ${Math.floor(d / 30)} mois`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CRM Clients</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats rapides */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_customers}</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#FFD700' }]}>{stats.vip_count}</Text>
            <Text style={styles.statLabel}>VIP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#FF6B6B' }]}>{stats.follow_up_count}</Text>
            <Text style={styles.statLabel}>Follow-up</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#00C851', fontSize: 13 }]}>
              {formatAmount(stats.total_revenue_fcfa)}
            </Text>
            <Text style={styles.statLabel}>CA total</Text>
          </View>
        </View>
      )}

      {/* Filtres segments */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.segmentScroll}
      >
        {SEGMENTS.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.segmentBtn, segment === s.key && styles.segmentBtnActive]}
            onPress={() => setSegment(s.key)}
          >
            <Text style={[styles.segmentText, segment === s.key && styles.segmentTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recherche */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un client…"
          placeholderTextColor="#666"
        />
      </View>

      {/* Liste clients */}
      {loading ? (
        <ActivityIndicator color="#6C5CE7" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredCustomers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>Aucun client dans ce segment</Text>
            </View>
          ) : (
            filteredCustomers.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.customerCard}
                onPress={() => loadProfile(c)}
              >
                {/* Avatar initiales */}
                <View style={[styles.avatar, c.is_vip && styles.avatarVip]}>
                  <Text style={styles.avatarText}>
                    {(c.name ?? c.external_id).substring(0, 2).toUpperCase()}
                  </Text>
                  {c.is_vip && <Text style={styles.vipStar}>⭐</Text>}
                </View>

                <View style={styles.customerInfo}>
                  <View style={styles.customerNameRow}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {c.name ?? c.external_id}
                    </Text>
                    <Text style={styles.platformIcon}>
                      {PLATFORM_ICONS[c.platform] ?? '💬'}
                    </Text>
                  </View>
                  <Text style={styles.customerMeta}>
                    {c.total_orders} commande{c.total_orders > 1 ? 's' : ''} •{' '}
                    {formatAmount(c.total_spent_fcfa)} •{' '}
                    {timeAgo(c.last_seen_at)}
                  </Text>
                  {c.preferred_category && (
                    <Text style={styles.categoryTag}>{c.preferred_category}</Text>
                  )}
                </View>

                <View style={styles.customerRight}>
                  {c.follow_up_needed && (
                    <View style={styles.followUpBadge}>
                      <Text style={styles.followUpText}>🔔</Text>
                    </View>
                  )}
                  <View style={[styles.sentimentDot, { backgroundColor: sentimentColor(c.sentiment) }]} />
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Modal profil client */}
      <Modal
        visible={!!selectedCustomer}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedCustomer(null); setProfileData(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {profileLoading ? (
              <ActivityIndicator color="#6C5CE7" style={{ marginTop: 40 }} />
            ) : selectedCustomer && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* En-tête profil */}
                <View style={styles.profileHeader}>
                  <View style={[styles.avatarLarge, selectedCustomer.is_vip && styles.avatarVip]}>
                    <Text style={styles.avatarTextLarge}>
                      {(selectedCustomer.name ?? selectedCustomer.external_id).substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.profileName}>
                    {selectedCustomer.name ?? selectedCustomer.external_id}
                  </Text>
                  <Text style={styles.profilePlatform}>
                    {PLATFORM_ICONS[selectedCustomer.platform]} {selectedCustomer.platform}
                  </Text>
                </View>

                {/* Stats */}
                <View style={styles.profileStatsRow}>
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatValue}>{selectedCustomer.total_orders}</Text>
                    <Text style={styles.profileStatLabel}>Commandes</Text>
                  </View>
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatValue}>
                      {formatAmount(selectedCustomer.total_spent_fcfa)}
                    </Text>
                    <Text style={styles.profileStatLabel}>Dépensé</Text>
                  </View>
                  <View style={styles.profileStat}>
                    <Text style={styles.profileStatValue}>{selectedCustomer.conversation_count}</Text>
                    <Text style={styles.profileStatLabel}>Conversations</Text>
                  </View>
                </View>

                {/* Actions rapides */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, editVip && styles.actionBtnActive]}
                    onPress={() => setEditVip(v => !v)}
                  >
                    <Text style={styles.actionBtnText}>⭐ {editVip ? 'Retirer VIP' : 'Marquer VIP'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, editFollowUp && styles.actionBtnActive]}
                    onPress={() => setEditFollowUp(v => !v)}
                  >
                    <Text style={styles.actionBtnText}>🔔 {editFollowUp ? 'Annuler' : 'Follow-up'}</Text>
                  </TouchableOpacity>
                </View>

                {editFollowUp && (
                  <TextInput
                    style={styles.followUpInput}
                    value={followUpNote}
                    onChangeText={setFollowUpNote}
                    placeholder="Note de follow-up…"
                    placeholderTextColor="#666"
                    multiline
                  />
                )}

                {/* Derniers messages */}
                {profileData?.recent_messages?.length > 0 && (
                  <View style={styles.messagesSection}>
                    <Text style={styles.messagesSectionTitle}>Derniers messages</Text>
                    {profileData.recent_messages.slice(0, 5).map((m: any, i: number) => (
                      <View key={i} style={[
                        styles.messageBubble,
                        m.direction === 'inbound' ? styles.bubbleIn : styles.bubbleOut,
                      ]}>
                        <Text style={styles.messageText} numberOfLines={2}>{m.content}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Lien paiement */}
                <TouchableOpacity
                  style={styles.paymentLinkBtn}
                  onPress={() => navigation.navigate('SocialAIScreen', {
                    service_id: serviceId,
                    customer_phone: selectedCustomer.external_id,
                  })}
                >
                  <Text style={styles.paymentLinkText}>💳 Envoyer un lien de paiement</Text>
                </TouchableOpacity>

                {/* Sauvegarder */}
                <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                  <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => { setSelectedCustomer(null); setProfileData(null); }}
                >
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </TouchableOpacity>

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
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

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  statValue: { color: TEXT, fontSize: 16, fontWeight: '800' },
  statLabel: { color: MUTED, fontSize: 10, marginTop: 2 },

  segmentScroll: { paddingLeft: 16, marginBottom: 8, maxHeight: 44 },
  segmentBtn: {
    backgroundColor: CARD,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentBtnActive: { borderColor: PRIMARY },
  segmentText: { color: MUTED, fontSize: 13 },
  segmentTextActive: { color: TEXT, fontWeight: '600' },

  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 12,
    color: TEXT,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },

  list: { flex: 1, paddingHorizontal: 16 },

  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarVip: { borderWidth: 2, borderColor: '#FFD700' },
  avatarText: { color: TEXT, fontSize: 16, fontWeight: '700' },
  vipStar: { position: 'absolute', top: -4, right: -4, fontSize: 10 },
  customerInfo: { flex: 1 },
  customerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  customerName: { color: TEXT, fontSize: 14, fontWeight: '600', flex: 1 },
  platformIcon: { fontSize: 14 },
  customerMeta: { color: MUTED, fontSize: 11, lineHeight: 16 },
  categoryTag: {
    color: PRIMARY,
    fontSize: 10,
    marginTop: 3,
    backgroundColor: PRIMARY + '22',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  customerRight: { alignItems: 'center', gap: 4 },
  followUpBadge: {
    backgroundColor: '#FF6B6B22',
    borderRadius: 10,
    padding: 4,
  },
  followUpText: { fontSize: 12 },
  sentimentDot: { width: 8, height: 8, borderRadius: 4 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: MUTED, fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  avatarLarge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: PRIMARY + '44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarTextLarge: { color: TEXT, fontSize: 26, fontWeight: '700' },
  profileName: { color: TEXT, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  profilePlatform: { color: MUTED, fontSize: 13 },
  profileStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  profileStat: {
    flex: 1,
    backgroundColor: CARD2,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  profileStatValue: { color: TEXT, fontSize: 15, fontWeight: '700' },
  profileStatLabel: { color: MUTED, fontSize: 10, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: CARD2,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnActive: { borderColor: PRIMARY },
  actionBtnText: { color: TEXT, fontSize: 12, fontWeight: '600' },

  followUpInput: {
    backgroundColor: CARD2,
    borderRadius: 10,
    padding: 12,
    color: TEXT,
    fontSize: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
    minHeight: 60,
  },

  messagesSection: { marginBottom: 16 },
  messagesSectionTitle: { color: MUTED, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  messageBubble: { borderRadius: 10, padding: 10, marginBottom: 6, maxWidth: '80%' },
  bubbleIn: { backgroundColor: CARD2, alignSelf: 'flex-start' },
  bubbleOut: { backgroundColor: PRIMARY + '33', alignSelf: 'flex-end' },
  messageText: { color: TEXT, fontSize: 12 },

  paymentLinkBtn: {
    backgroundColor: '#25D36622',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#25D366',
  },
  paymentLinkText: { color: '#25D366', fontSize: 14, fontWeight: '600' },

  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  closeBtn: { padding: 14, alignItems: 'center' },
  closeBtnText: { color: MUTED, fontSize: 14 },
});
