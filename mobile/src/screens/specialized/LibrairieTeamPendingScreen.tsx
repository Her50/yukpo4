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
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { bourseLivreV2Api } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';

type TeamLieu = { id: number; libelle: string; gps?: string; ville?: string; adresse?: string };
type TeamPackage = { id: number; reference: string; statut: string; succursale_label?: string; nombre_livres?: number };
type TeamPurchase = { id: number; statut: string; succursale_label?: string; prix_achat?: number; devise?: string };

const ACTIONS: Array<'en_preparation' | 'constitue' | 'pret'> = ['en_preparation', 'constitue', 'pret'];

const LibrairieTeamPendingScreen: React.FC = () => {
  const { t } = useLanguageSafe();
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
    action === 'en_preparation' ? 'En préparation' : action === 'constitue' ? 'Constituer' : 'Prêt coursier';

  const validateItem = async (
    type: 'package' | 'purchase',
    id: number,
    action: 'en_preparation' | 'constitue' | 'pret'
  ) => {
    if (!selectedLieuId) {
      Alert.alert('Succursale requise', 'Sélectionnez une succursale avant validation.');
      return;
    }
    if ((action === 'constitue' || action === 'pret') && !stockDisponible) {
      Alert.alert(
        'Stock indisponible',
        "Ne validez pas cette commande si le stock n'est pas disponible sur cette succursale. Gardez en préparation ou changez de succursale."
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

  const openDetail = async (packageId: number) => {
    try {
      const detail = await bourseLivreV2Api.teamGetPackageDetail(packageId);
      const p = detail?.package || {};
      const succ = p?.succursale_label ? `\nSuccursale: ${p.succursale_label}` : '\nSuccursale: non définie';
      Alert.alert(`Détail ${p.reference || `#${packageId}`}`, `${detail?.instructions || ''}${succ}`);
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
      <Text style={styles.title}>Equipe librairie - validations</Text>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>1) Succursale concernee</Text>
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
            {selectedLieu.adresse || selectedLieu.gps || 'Sans adresse'}
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setStockDisponible((s) => !s)}>
        <SafeIcon name={stockDisponible ? 'check-square' : 'square'} size={18} color={modernColors.primary} />
        <Text style={styles.checkboxText}>Stock dispo sur cette succursale</Text>
      </TouchableOpacity>

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
            <Text style={styles.ref}>{item.__type === 'package' ? item.reference : `Achat #${item.id}`}</Text>
            <Text style={styles.meta}>Statut: {item.statut || 'n/a'}</Text>
            <Text style={styles.meta}>
              Succursale: {item.succursale_label || 'non définie (à sélectionner)'}
            </Text>
            {item.__type === 'package' ? (
              <TouchableOpacity style={styles.detailBtn} onPress={() => openDetail(item.id)}>
                <Text style={styles.detailBtnText}>Voir détail</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.actionsRow}>
              {ACTIONS.map((a) => {
                const k = `${item.__type}-${item.id}-${a}`;
                return (
                  <TouchableOpacity
                    key={a}
                    style={[styles.actionBtn, processingKey === k && { opacity: 0.6 }]}
                    disabled={processingKey !== null}
                    onPress={() => validateItem(item.__type, item.id, a)}
                  >
                    <Text style={styles.actionText}>{labelAction(a)}</Text>
                  </TouchableOpacity>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10 },
  ref: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  detailBtn: { marginTop: 8, alignSelf: 'flex-start' },
  detailBtnText: { color: modernColors.primary, fontWeight: '700', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: modernColors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

export default LibrairieTeamPendingScreen;
