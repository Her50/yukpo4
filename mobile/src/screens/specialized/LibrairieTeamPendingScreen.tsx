import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { bourseLivreV2Api } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';

type TeamLieu = { id: number; libelle: string; gps?: string; ville?: string; adresse?: string };
type TeamPackage = {
  id: number;
  reference: string;
  statut: string;
  succursale_label?: string;
  nombre_livres?: number;
  claimed_by_user_id?: number;
  claimed_at?: string;
  released_at?: string;
};
type TeamPurchase = {
  id: number;
  statut: string;
  succursale_label?: string;
  prix_achat?: number;
  devise?: string;
  claimed_by_user_id?: number;
  claimed_at?: string;
  released_at?: string;
};

const BASE_ACTIONS: Array<'en_preparation' | 'constitue' | 'pret'> = ['en_preparation', 'constitue', 'pret'];

const LibrairieTeamPendingScreen: React.FC = () => {
  const { t } = useLanguageSafe();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [packages, setPackages] = useState<TeamPackage[]>([]);
  const [purchases, setPurchases] = useState<TeamPurchase[]>([]);
  const [lieux, setLieux] = useState<TeamLieu[]>([]);
  const [selectedLieuId, setSelectedLieuId] = useState<number | null>(null);
  const [stockDisponible, setStockDisponible] = useState(false);
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  const selectedLieu = useMemo(
    () => lieux.find((l) => l.id === selectedLieuId) || null,
    [lieux, selectedLieuId]
  );

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const r = await bourseLivreV2Api.getTeamPendingPackages();
      const aConstituer = Array.isArray(r?.packages?.a_constituer) ? r.packages.a_constituer : [];
      const constitues = Array.isArray(r?.packages?.constitues) ? r.packages.constitues : [];
      const pendingPurchases = Array.isArray(r?.purchases_pending) ? r.purchases_pending : [];
      const lieuxData = Array.isArray(r?.lieux) ? r.lieux : [];
      setPackages([...aConstituer, ...constitues]);
      setPurchases(pendingPurchases);
      setLieux(lieuxData);
      if (!selectedLieuId && lieuxData.length > 0) setSelectedLieuId(lieuxData[0].id);
    } catch (e: any) {
      Alert.alert(t('message.error', 'Erreur'), e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLieuId, t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const labelAction = (action: 'en_preparation' | 'constitue' | 'pret') =>
    action === 'en_preparation'
      ? t('librairieTeamPending.actionEnPreparation', 'En préparation')
      : action === 'constitue'
      ? t('librairieTeamPending.actionConstituer', 'Constituer')
      : t('librairieTeamPending.actionPretCoursier', 'Prêt coursier');

  const isActionBlocked = (
    action: 'en_preparation' | 'constitue' | 'pret',
    claimedByUserId?: number
  ) => {
    if (claimedByUserId && claimedByUserId !== user?.id) return true;
    if (!selectedLieuId) return true;
    if ((action === 'constitue' || action === 'pret') && !stockDisponible) return true;
    return false;
  };

  const blockedReason = (
    action: 'en_preparation' | 'constitue' | 'pret',
    claimedByUserId?: number
  ) => {
    if (claimedByUserId && claimedByUserId !== user?.id) {
      return t(
        'librairieTeamPending.reasonLockedByOther',
        'Commande en cours de traitement par un autre libraire.'
      );
    }
    if (!selectedLieuId) {
      return t(
        'librairieTeamPending.reasonChooseBranch',
        'Choisir une succursale pour activer la validation.'
      );
    }
    if ((action === 'constitue' || action === 'pret') && !stockDisponible) {
      return t(
        'librairieTeamPending.reasonStockRequired',
        'Cocher "stock dispo" pour constituer ou marquer prêt coursier.'
      );
    }
    return null;
  };

  const validateItem = async (
    type: 'package' | 'purchase',
    id: number,
    action: 'en_preparation' | 'constitue' | 'pret'
  ) => {
    if (!selectedLieuId) {
      Alert.alert(
        t('librairieTeamPending.branchRequiredTitle', 'Succursale requise'),
        t(
          'librairieTeamPending.branchRequiredMessage',
          'Sélectionnez une succursale avant validation.'
        )
      );
      return;
    }
    if ((action === 'constitue' || action === 'pret') && !stockDisponible) {
      Alert.alert(
        t('librairieTeamPending.stockUnavailableTitle', 'Stock indisponible'),
        t(
          'librairieTeamPending.stockUnavailableMessage',
          "Ne validez pas cette commande si le stock n'est pas disponible sur cette succursale. Gardez en préparation ou changez de succursale."
        )
      );
      return;
    }
    const key = `${type}-${id}-${action}`;
    try {
      setProcessingKey(key);
      await bourseLivreV2Api.teamValidateOrder({
        package_id: type === 'package' ? id : undefined,
        purchase_id: type === 'purchase' ? id : undefined,
        action,
        librairie_lieu_id: selectedLieuId,
        stock_disponible_succursale: stockDisponible,
      });
      await loadData(true);
    } catch (e: any) {
      Alert.alert(t('message.error', 'Erreur'), e?.message || 'Validation refusée');
    } finally {
      setProcessingKey(null);
    }
  };

  const formatMiniTime = (iso?: string) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const getTimelineData = (item: any) => {
    const claimedAt = formatMiniTime(item.claimed_at);
    const releasedAt = formatMiniTime(item.released_at);
    const isValidated = item.__type === 'package' ? item.statut === 'constitue' : item.statut === 'en_livraison';
    return { claimedAt, releasedAt, isValidated };
  };

  const openDetail = async (packageId: number) => {
    try {
      const detail = await bourseLivreV2Api.teamGetPackageDetail(packageId);
      const p = detail?.package || {};
      const succ = p?.succursale_label
        ? `\n${t('librairieTeamPending.succursaleLabel', 'Succursale')}: ${p.succursale_label}`
        : `\n${t('librairieTeamPending.succursaleLabel', 'Succursale')}: ${t('librairieTeamPending.undefinedBranch', 'non définie')}`;
      Alert.alert(
        t('librairieTeamPending.detailTitle', { ref: p.reference || `#${packageId}` }),
        `${detail?.instructions || ''}${succ}`
      );
    } catch (e: any) {
      Alert.alert(t('message.error', 'Erreur'), e?.message || 'Détail indisponible');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={modernColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('librairieTeamPending.title', 'Equipe librairie - validations')}</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{t('librairieTeamPending.panelBranch', '1) Succursale concernée')}</Text>
        <View style={styles.chipsWrap}>
          {lieux.map((l) => (
            <TouchableOpacity
              key={l.id}
              style={[styles.chip, selectedLieuId === l.id && styles.chipActive]}
              onPress={() => setSelectedLieuId(l.id)}
            >
              <Text style={[styles.chipText, selectedLieuId === l.id && styles.chipTextActive]}>
                {l.libelle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!selectedLieu && (
          <Text style={styles.helpText}>
            {selectedLieu.ville ? `${selectedLieu.ville} - ` : ''}
            {selectedLieu.adresse || selectedLieu.gps || t('librairieTeamPending.noAddress', 'Sans adresse')}
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setStockDisponible((s) => !s)}>
        <SafeIcon name={stockDisponible ? 'check-square' : 'square'} size={18} color={modernColors.primary} />
        <Text style={styles.checkboxText}>
          {t('librairieTeamPending.stockCheckbox', 'Stock dispo sur cette succursale')}
        </Text>
      </TouchableOpacity>
      {!selectedLieuId || !stockDisponible ? (
        <View style={styles.guardInfo}>
          <SafeIcon name="shield-alert" size={14} color="#92400e" />
          <Text style={styles.guardInfoText}>
            {!selectedLieuId
              ? t(
                  'librairieTeamPending.guardChooseBranch',
                  'Validation verrouillée: choisissez d’abord une succursale.'
                )
              : t(
                  'librairieTeamPending.guardStockRequired',
                  'Validation "constitue/prêt" verrouillée: cochez le stock disponible.'
                )}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={[
          ...packages.map((p) => ({ ...p, __type: 'package' as const })),
          ...purchases.map((p) => ({ ...p, __type: 'purchase' as const })),
        ]}
        keyExtractor={(item: any) => `${item.__type}-${item.id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }: any) => (
          <View style={styles.card}>
            <Text style={styles.ref}>
              {item.__type === 'package'
                ? item.reference
                : t('librairieTeamPending.purchaseRef', { id: item.id })}
            </Text>
            <Text style={styles.meta}>
              {t('librairieTeamPending.statusLabel', 'Statut')}: {item.statut || 'n/a'}
            </Text>
            <Text style={styles.meta}>
              {t('librairieTeamPending.succursaleLabel', 'Succursale')}:{' '}
              {item.succursale_label ||
                t('librairieTeamPending.undefinedBranchSelect', 'non définie (à sélectionner)')}
            </Text>
            {item.claimed_by_user_id ? (
              <Text style={styles.meta}>
                {t('librairieTeamPending.claimLabel', 'Pris en charge par')} #{item.claimed_by_user_id}
              </Text>
            ) : null}
            {(() => {
              const tl = getTimelineData(item);
              return (
                <View style={styles.timelineWrap}>
                  <Text style={styles.timelineTitle}>
                    {t('librairieTeamPending.timelineTitle', 'Timeline statut')}
                  </Text>
                  <View style={styles.timelineRow}>
                    <View style={[styles.timelineDot, tl.claimedAt ? styles.timelineDotActive : null]} />
                    <Text style={styles.timelineText}>
                      {t('librairieTeamPending.timelineClaimed', 'Pris en charge')}
                      {tl.claimedAt ? ` (${tl.claimedAt})` : ' -'}
                    </Text>
                  </View>
                  <View style={styles.timelineRow}>
                    <View style={[styles.timelineDot, tl.releasedAt ? styles.timelineDotWarn : null]} />
                    <Text style={styles.timelineText}>
                      {t('librairieTeamPending.timelineReleased', 'Libéré')}
                      {tl.releasedAt ? ` (${tl.releasedAt})` : ' -'}
                    </Text>
                  </View>
                  <View style={styles.timelineRow}>
                    <View style={[styles.timelineDot, tl.isValidated ? styles.timelineDotSuccess : null]} />
                    <Text style={styles.timelineText}>
                      {t('librairieTeamPending.timelineValidated', 'Validé')}
                      {tl.isValidated ? '' : ' -'}
                    </Text>
                  </View>
                </View>
              );
            })()}
            {item.__type === 'package' ? (
              <TouchableOpacity style={styles.detailBtn} onPress={() => openDetail(item.id)}>
                <Text style={styles.detailBtnText}>
                  {t('librairieTeamPending.viewDetail', 'Voir détail')}
                </Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.actionsRow}>
              {BASE_ACTIONS.map((a) => {
                const k = `${item.__type}-${item.id}-${a}`;
                const blocked = isActionBlocked(a, item.claimed_by_user_id);
                const reason = blockedReason(a, item.claimed_by_user_id);
                return (
                  <View key={a} style={styles.actionWrap}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        blocked && styles.actionBtnDisabled,
                        processingKey === k && { opacity: 0.6 },
                      ]}
                      disabled={processingKey !== null || blocked}
                      onPress={() => validateItem(item.__type, item.id, a)}
                    >
                      <Text style={[styles.actionText, blocked && styles.actionTextDisabled]}>
                        {labelAction(a)}
                      </Text>
                    </TouchableOpacity>
                    {blocked && reason ? <Text style={styles.blockReason}>{reason}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 10 },
  panel: { backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 10 },
  panelTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8, color: '#374151' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db' },
  chipActive: { borderColor: modernColors.primary, backgroundColor: '#eef2ff' },
  chipText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: modernColors.primary },
  helpText: { marginTop: 8, color: '#6b7280', fontSize: 11 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  checkboxText: { fontSize: 13, color: '#111827', fontWeight: '600' },
  guardInfo: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guardInfoText: { fontSize: 12, color: '#92400e', fontWeight: '600', flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10 },
  ref: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  timelineWrap: {
    marginTop: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timelineTitle: { fontSize: 11, color: '#374151', fontWeight: '700', marginBottom: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d1d5db',
  },
  timelineDotActive: { backgroundColor: '#2563eb' },
  timelineDotWarn: { backgroundColor: '#f59e0b' },
  timelineDotSuccess: { backgroundColor: '#16a34a' },
  timelineText: { fontSize: 11, color: '#4b5563' },
  detailBtn: { marginTop: 8, alignSelf: 'flex-start' },
  detailBtnText: { color: modernColors.primary, fontWeight: '700', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionWrap: { maxWidth: '100%' },
  actionBtn: { backgroundColor: modernColors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  actionBtnDisabled: { backgroundColor: '#e5e7eb' },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actionTextDisabled: { color: '#6b7280' },
  blockReason: { fontSize: 10, color: '#92400e', marginTop: 4, maxWidth: 180 },
});

export default LibrairieTeamPendingScreen;
