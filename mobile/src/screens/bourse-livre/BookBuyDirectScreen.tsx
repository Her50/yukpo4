import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import PaymentMethodPrompt from '../../components/PaymentMethodPrompt';
import { usePaymentMethodCheck } from '../../hooks/usePaymentMethodCheck';
import { BookPurchase, bourseLivreV2Api, PurchaseBreakdown } from '../../services/bourseLivreV2Api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface BookBuyDirectScreenProps {
  navigation: any;
  route: {
    params: {
      livre: {
        id: number;
        titre: string;
        auteur?: string;
        classe_actuelle: string;
        matiere: string;
        etat_classification?: string;
        valeur_calculee?: number;
        prix_detecte?: number;
        image_recto_url?: string;
      };
    };
  };
}

export default function BookBuyDirectScreen({ navigation, route }: BookBuyDirectScreenProps) {
  const { t } = useLanguageSafe();
  const { livre } = route.params;
  const prix = livre.valeur_calculee || livre.prix_detecte || 0;

  const PAIEMENT_METHODES = [
    { label: 'Mobile Money', value: 'mobile_money', icon: 'phone-portrait' },
    { label: t('bourseLivreV2.buyDirect.especes'), value: 'cash', icon: 'cash' },
    { label: t('bourseLivreV2.buyDirect.carte'), value: 'carte', icon: 'card' },
  ];
  const [adresseLivraison, setAdresseLivraison] = useState('');
  const [gpsLivraison, setGpsLivraison] = useState('');
  const [modeLivraison, setModeLivraison] = useState('depot_seulement');
  const [paiementMethode, setPaiementMethode] = useState('mobile_money');
  const [loading, setLoading] = useState(false);
  const [purchase, setPurchase] = useState<BookPurchase | null>(null);
  const [breakdown, setBreakdown] = useState<PurchaseBreakdown | null>(null);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const paymentCheck = usePaymentMethodCheck();

  // Auto-match programme scolaire
  useEffect(() => {
    const doMatch = async () => {
      setMatchLoading(true);
      try {
        const res = await bourseLivreV2Api.matchLivreProgramme(livre.id);
        setMatchResult(res.matching);
      } catch {
        // Silently fail
      } finally {
        setMatchLoading(false);
      }
    };
    doMatch();
  }, [livre.id]);

  const handleBuy = useCallback(async () => {
    if (!adresseLivraison.trim()) {
      Alert.alert('Erreur', t('bourseLivreV2.buyDirect.errorAdresse'));
      return;
    }

    // ✅ Vérifier les moyens de paiement si mobile_money sélectionné
    if (paiementMethode === 'mobile_money') {
      const needsPayment = await paymentCheck.checkAndPrompt();
      if (needsPayment) {
        setShowPaymentPrompt(true);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await bourseLivreV2Api.createPurchase({
        livre_id: livre.id,
        adresse_livraison: adresseLivraison,
        gps_livraison: gpsLivraison || undefined,
        mode_livraison: modeLivraison,
        paiement_methode: paiementMethode,
      });
      setPurchase(res.purchase);
      setBreakdown(res.breakdown);

      const rawRes = res as any;
      const payStatus = rawRes.paiement_statut || 'paye';

      if (payStatus === 'en_attente_paiement') {
        Alert.alert(
          t('bourseLivreV2.buyDirect.paiementRequis'),
          t('bourseLivreV2.buyDirect.paiementRequisDesc', {
            total: res.breakdown.montant_total,
            devise: res.breakdown.devise,
          }),
          [
            {
              text: t('bourseLivreV2.buyDirect.payerMaintenant'),
              onPress: () => navigation.navigate('RechargeTokens' as never),
            },
            { text: t('bourseLivreV2.buyDirect.payerPlusTard'), style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          t('bourseLivreV2.buyDirect.achatConfirme'),
          t('bourseLivreV2.buyDirect.commandeCreee', { id: res.purchase.id, total: res.breakdown.montant_total, devise: res.breakdown.devise }),
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err: any) {
      Alert.alert(t('message.error'), err?.message || t('bourseLivreV2.buyDirect.errorAchat'));
    } finally {
      setLoading(false);
    }
  }, [livre.id, adresseLivraison, gpsLivraison, modeLivraison, paiementMethode, navigation]);

  const commission = prix * 0.05; // 5% commission app (aligné avec TAUX_COMMISSION_APP backend)
  const fraisLivraison = breakdown?.frais_livraison ?? null; // Calculé dynamiquement par le backend (haversine GPS)
  const total = breakdown?.montant_total ?? (prix + commission);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Livre info */}
      <View style={styles.livreCard}>
        <View style={styles.livreHeader}>
          <Ionicons name="book" size={28} color="#4A90D9" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.livreTitre}>{livre.titre}</Text>
            {livre.auteur && <Text style={styles.livreAuteur}>{livre.auteur}</Text>}
            <Text style={styles.livreDetail}>
              {livre.classe_actuelle} · {livre.matiere}
            </Text>
          </View>
        </View>
        <View style={styles.etatBadge}>
          <Ionicons
            name={
              livre.etat_classification === 'bon'
                ? 'checkmark-circle'
                : livre.etat_classification === 'acceptable'
                  ? 'alert-circle'
                  : 'close-circle'
            }
            size={16}
            color={
              livre.etat_classification === 'bon'
                ? '#4CAF50'
                : livre.etat_classification === 'acceptable'
                  ? '#FF9800'
                  : '#F44336'
            }
          />
          <Text style={styles.etatText}>
            {t('bourseLivreV2.buyDirect.etat', { etat: livre.etat_classification || t('bourseLivreV2.buyDirect.etatNonEvalue') })}
          </Text>
        </View>

        {/* Programme match */}
        {matchLoading ? (
          <View style={styles.matchRow}>
            <ActivityIndicator size="small" color="#4A90D9" />
            <Text style={styles.matchText}>{t('bourseLivreV2.buyDirect.checkingProgramme')}</Text>
          </View>
        ) : matchResult?.matched ? (
          <View style={[styles.matchRow, styles.matchSuccess]}>
            <Ionicons name="school" size={16} color="#2E7D32" />
            <Text style={styles.matchSuccessText}>
              {t('bourseLivreV2.buyDirect.programmeOfficiel', { percent: (matchResult.score_match * 100).toFixed(0) })}
              {matchResult.prix_officiel ? ` · ${t('bourseLivreV2.buyDirect.prixOfficiel', { prix: matchResult.prix_officiel })}` : ''}
            </Text>
          </View>
        ) : matchResult ? (
          <View style={[styles.matchRow, styles.matchWarning]}>
            <Ionicons name="information-circle" size={16} color="#FF9800" />
            <Text style={styles.matchWarningText}>{t('bourseLivreV2.buyDirect.horsProgramme')}</Text>
          </View>
        ) : null}
      </View>

      {/* Prix breakdown */}
      <View style={styles.priceCard}>
        <Text style={styles.priceTitle}>{t('bourseLivreV2.buyDirect.prixDetail')}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{t('bourseLivreV2.buyDirect.prixLivre')}</Text>
          <Text style={styles.priceValue}>{prix.toLocaleString()} XAF</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{t('bourseLivreV2.buyDirect.commission')}</Text>
          <Text style={styles.priceValue}>{commission.toLocaleString()} XAF</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>{t('bourseLivreV2.buyDirect.fraisLivraison')}</Text>
          <Text style={styles.priceValue}>
            {fraisLivraison != null ? `${Math.round(fraisLivraison).toLocaleString()} XAF` : t('bourseLivreV2.buyDirect.aCalculer', t('bookBuyDirectScreen.aCalculerGps'))}
          </Text>
        </View>
        <View style={[styles.priceRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>{t('bourseLivreV2.buyDirect.total')}</Text>
          <Text style={styles.totalValue}>{Math.round(total).toLocaleString()} XAF</Text>
        </View>
      </View>

      {/* Adresse de livraison */}
      <Text style={styles.sectionTitle}>{t('bourseLivreV2.buyDirect.adresseLivraison')}</Text>
      <TextInput
        style={styles.input}
        value={adresseLivraison}
        onChangeText={setAdresseLivraison}
        placeholder={t('bourseLivreV2.buyDirect.adressePlaceholder')}
        placeholderTextColor="#999"
        multiline
      />

      {/* Mode de livraison */}
      <Text style={styles.sectionTitle}>{t('bourseLivreV2.buyDirect.modeLivraison')}</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.modeChip, modeLivraison === 'depot_seulement' && styles.modeChipActive]}
          onPress={() => setModeLivraison('depot_seulement')}
        >
          <Ionicons name="cube" size={18} color={modeLivraison === 'depot_seulement' ? '#fff' : '#666'} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.modeLabel, modeLivraison === 'depot_seulement' && styles.modeLabelActive]}>
              {t('bourseLivreV2.buyDirect.depotSeulement')}
            </Text>
            <Text style={[styles.modeDesc, modeLivraison === 'depot_seulement' && styles.modeDescActive]}>
              {t('bourseLivreV2.buyDirect.depotDesc')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeChip, modeLivraison === 'depot_et_recuperation' && styles.modeChipActive]}
          onPress={() => setModeLivraison('depot_et_recuperation')}
        >
          <Ionicons name="swap-horizontal" size={18} color={modeLivraison === 'depot_et_recuperation' ? '#fff' : '#666'} />
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.modeLabel, modeLivraison === 'depot_et_recuperation' && styles.modeLabelActive]}>
              {t('bourseLivreV2.buyDirect.depotRecuperation')}
            </Text>
            <Text style={[styles.modeDesc, modeLivraison === 'depot_et_recuperation' && styles.modeDescActive]}>
              {t('bourseLivreV2.buyDirect.depotRecuperationDesc')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Méthode de paiement */}
      <Text style={styles.sectionTitle}>{t('bourseLivreV2.buyDirect.paiement')}</Text>
      <View style={styles.chipRow}>
        {PAIEMENT_METHODES.map((pm) => (
          <TouchableOpacity
            key={pm.value}
            style={[styles.chip, paiementMethode === pm.value && styles.chipActive]}
            onPress={() => setPaiementMethode(pm.value)}
          >
            <Ionicons
              name={pm.icon as any}
              size={16}
              color={paiementMethode === pm.value ? '#fff' : '#666'}
            />
            <Text style={[styles.chipText, paiementMethode === pm.value && styles.chipTextActive, { marginLeft: 6 }]}>
              {pm.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bouton acheter */}
      <TouchableOpacity
        style={[styles.buyBtn, loading && styles.buyBtnDisabled]}
        onPress={handleBuy}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.buyBtnText}>
              {t('bourseLivreV2.buyDirect.acheterBtn', { total: total.toLocaleString() })}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      <PaymentMethodPrompt
        visible={showPaymentPrompt}
        onClose={() => setShowPaymentPrompt(false)}
        onSaved={() => {
          paymentCheck.refresh();
          handleBuy();
        }}
        context="payment"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 20 },
  livreCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  livreHeader: { flexDirection: 'row', alignItems: 'center' },
  livreTitre: { fontSize: 17, fontWeight: '700', color: '#1A1A2E' },
  livreAuteur: { fontSize: 14, color: '#666', marginTop: 2 },
  livreDetail: { fontSize: 13, color: '#888', marginTop: 2 },
  etatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  etatText: { fontSize: 13, color: '#666' },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  matchText: { fontSize: 13, color: '#666' },
  matchSuccess: { backgroundColor: '#E8F5E9' },
  matchSuccessText: { fontSize: 13, color: '#2E7D32', flex: 1 },
  matchWarning: { backgroundColor: '#FFF3E0' },
  matchWarningText: { fontSize: 13, color: '#E65100' },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  priceTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 12 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 6,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#4A90D9' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 14,
  },
  modeChipActive: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  modeLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  modeLabelActive: { color: '#fff' },
  modeDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  modeDescActive: { color: 'rgba(255,255,255,0.8)' },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
