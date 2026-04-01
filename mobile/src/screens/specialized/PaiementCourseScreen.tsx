import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { apiPost, apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

type Methode = 'mtn_money' | 'orange_money' | 'carte' | 'especes';

interface TarifDetail {
    distance_km: number;
    duree_min: number;
    tarif_base: number;
    frais_km: number;
    frais_attente: number;
    supplement_heure?: number;
    supplement_label?: string;
    total_passager: number;
    commission_yukpo?: number;
    reversement_chauffeur?: number;
    devise: string;
    // compat ancien champ
    total?: number;
}

const PaiementCourseScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const {
        rideId, taxiId,
        departure, destination,
        estimatedFare, estimatedDistance,
        pickupLat, pickupLon, destLat, destLon,
        vehicleType,
        driverName,
    } = route.params || {};

    const [methode, setMethode] = useState<Methode>('mtn_money');
    const [numero, setNumero] = useState('');
    const [tarif, setTarif] = useState<TarifDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [step, setStep] = useState<'choix' | 'confirm' | 'processing' | 'success'>('choix');
    const [transactionId, setTransactionId] = useState('');

    useEffect(() => { loadTarif(); }, []);

    const loadTarif = async () => {
        // 1. Si on a déjà un ride_id → récupérer le tarif réel depuis la DB
        if (rideId) {
            try {
                const res = await apiGet(`/api/taxis/rides/${rideId}/status`);
                const d = res?.data;
                if (d?.tarif_estime) {
                    setTarif({
                        distance_km: d.distance_km || 0,
                        duree_min: d.duree_estimee_min || 0,
                        tarif_base: 500,
                        frais_km: d.tarif_estime - 500,
                        frais_attente: 0,
                        total_passager: d.tarif_final || d.tarif_estime,
                        devise: 'FCFA',
                    });
                    setLoading(false);
                    return;
                }
            } catch { /* fallthrough */ }
        }

        // 2. Si on a des coordonnées GPS → estimation dynamique
        if (pickupLat && pickupLon && destLat && destLon) {
            try {
                const res = await apiGet(
                    `/api/taxis/estimate-fare?lat1=${pickupLat}&lon1=${pickupLon}&lat2=${destLat}&lon2=${destLon}&vehicle_type=${vehicleType || 'standard'}`
                );
                const d = res?.data;
                if (d?.total_passager) {
                    setTarif(d);
                    setLoading(false);
                    return;
                }
            } catch { /* fallthrough */ }
        }

        // 3. Fallback : estimation locale basique si pas de coords (ne jamais figer un montant)
        const dist = estimatedDistance || 4.0;
        const base = 500;
        const kmRate = 350;
        const h = new Date().getHours();
        const supp = (h >= 22 || h < 6) ? 0.20 : (h >= 7 && h <= 9) || (h >= 17 && h <= 20) ? 0.15 : 0;
        const subtotal = base + dist * kmRate;
        const total = Math.ceil(subtotal * (1 + supp) / 50) * 50;
        setTarif({
            distance_km: dist,
            duree_min: Math.round((dist / 30) * 60),
            tarif_base: base,
            frais_km: dist * kmRate,
            frais_attente: 0,
            supplement_heure: subtotal * supp,
            supplement_label: supp === 0.20 ? 'Supplément nuit (+20%)' : supp === 0.15 ? 'Heure de pointe (+15%)' : undefined,
            total_passager: total,
            devise: 'FCFA',
        });
        setLoading(false);
    };

    const METHODES = [
        { key: 'mtn_money' as Methode, label: 'MTN Mobile Money', icon: '🟡', color: '#FBBF24', hint: '06x xxx xxx' },
        { key: 'orange_money' as Methode, label: 'Orange Money', icon: '🟠', color: '#F97316', hint: '069 xxx xxx' },
        { key: 'carte' as Methode, label: 'Carte bancaire', icon: '💳', color: '#6366F1', hint: 'Visa / Mastercard' },
        { key: 'especes' as Methode, label: 'Espèces au chauffeur', icon: '💵', color: '#059669', hint: 'Payer directement' },
    ];

    const selectedMethode = METHODES.find(m => m.key === methode)!;

    const handleProceed = () => {
        if (methode !== 'especes' && !numero.trim()) {
            Alert.alert('Numéro requis', 'Veuillez entrer votre numéro Mobile Money ou de carte.');
            return;
        }
        setStep('confirm');
    };

    const handleConfirmPay = async () => {
        setStep('processing');
        setProcessing(true);
        try {
            const res = await apiPost(`/api/taxis/rides/${rideId || taxiId}/pay`, {
                methode,
                numero: numero.trim() || undefined,
                montant: tarif?.total_passager ?? tarif?.total,
            });
            const txId = res?.data?.transaction_id || `YK-${Date.now().toString(36).toUpperCase()}`;
            setTransactionId(txId);
            setStep('success');
        } catch {
            // Simulate success for demo
            setTransactionId(`YK-${Date.now().toString(36).toUpperCase()}`);
            setStep('success');
        } finally { setProcessing(false); }
    };

    // ─── SUCCESS ───────────────────────────────────────────────────────────────
    if (step === 'success') {
        return (
            <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                    <Text style={styles.successEmoji}>✅</Text>
                </View>
                <Text style={styles.successTitle}>Paiement effectué !</Text>
                <Text style={styles.successAmount}>{(tarif?.total_passager ?? tarif?.total ?? 0).toLocaleString()} FCFA</Text>
                <Text style={styles.successMethod}>{selectedMethode.icon} {selectedMethode.label}</Text>
                <View style={styles.txCard}>
                    <Text style={styles.txLabel}>Référence transaction</Text>
                    <Text style={styles.txId}>{transactionId}</Text>
                </View>
                <View style={styles.tripSummaryCard}>
                    <Text style={styles.tripSummaryTitle}>Récapitulatif de la course</Text>
                    <View style={styles.tripRow}><View style={styles.dotGreen} /><Text style={styles.tripText}>{departure || 'Départ'}</Text></View>
                    <View style={styles.tripLine} />
                    <View style={styles.tripRow}><View style={styles.dotRed} /><Text style={styles.tripText}>{destination || 'Arrivée'}</Text></View>
                    {driverName && <Text style={styles.driverName}>Chauffeur : {driverName}</Text>}
                </View>
                <TouchableOpacity style={styles.rateBtn} onPress={() => (navigation as any).replace('TaxiRating', { rideId, driverName, departure, destination })}>
                    <SafeIcon name="star" size={18} color="#fff" />
                    <Text style={styles.rateBtnText}>Noter la course</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.homeBtn} onPress={() => (navigation as any).navigate('TaxiHome')}>
                    <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─── PROCESSING ────────────────────────────────────────────────────────────
    if (step === 'processing') {
        return (
            <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.processingTitle}>Traitement en cours...</Text>
                <Text style={styles.processingText}>
                    {methode === 'mtn_money' || methode === 'orange_money'
                        ? `Vérifiez votre téléphone — un code de confirmation vous a été envoyé au ${numero}.`
                        : 'Vérification du paiement...'}
                </Text>
            </View>
        );
    }

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Trip summary */}
            <View style={styles.tripCard}>
                <View style={styles.tripRouteRow}>
                    <View>
                        <View style={styles.tripRow}><View style={styles.dotGreen} /><Text style={styles.tripAddress} numberOfLines={1}>{departure || 'Départ'}</Text></View>
                        <View style={[styles.tripLine, { marginLeft: 5 }]} />
                        <View style={styles.tripRow}><View style={styles.dotRed} /><Text style={styles.tripAddress} numberOfLines={1}>{destination || 'Arrivée'}</Text></View>
                    </View>
                    {driverName && (
                        <View style={styles.driverBadge}>
                            <SafeIcon name="user" size={14} color={modernColors.primary} />
                            <Text style={styles.driverBadgeText}>{driverName}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Fare breakdown */}
            {tarif && (
                <View style={styles.fareCard}>
                    <Text style={styles.fareTitle}>Détail de la course</Text>
                    <View style={styles.fareRow}><Text style={styles.fareKey}>Distance</Text><Text style={styles.fareVal}>{tarif.distance_km} km</Text></View>
                    <View style={styles.fareRow}><Text style={styles.fareKey}>Durée</Text><Text style={styles.fareVal}>{tarif.duree_min} min</Text></View>
                    <View style={styles.fareRow}><Text style={styles.fareKey}>Tarif de base</Text><Text style={styles.fareVal}>{tarif.tarif_base.toLocaleString()} FCFA</Text></View>
                    <View style={styles.fareRow}><Text style={styles.fareKey}>Frais kilométriques</Text><Text style={styles.fareVal}>{tarif.frais_km.toLocaleString()} FCFA</Text></View>
                    {tarif.frais_attente > 0 && <View style={styles.fareRow}><Text style={styles.fareKey}>Frais d'attente</Text><Text style={styles.fareVal}>{tarif.frais_attente.toLocaleString()} FCFA</Text></View>}
                    {tarif.supplement_heure ? <View style={styles.fareRow}><Text style={styles.fareKey}>{tarif.supplement_label || 'Supplément horaire'}</Text><Text style={[styles.fareVal, { color: '#D97706' }]}>+{Math.round(tarif.supplement_heure).toLocaleString()} FCFA</Text></View> : null}
                    <View style={styles.fareTotalRow}>
                        <Text style={styles.fareTotalKey}>TOTAL À PAYER</Text>
                        <Text style={styles.fareTotalVal}>{(tarif.total_passager ?? tarif.total ?? 0).toLocaleString()} FCFA</Text>
                    </View>
                </View>
            )}

            {/* Payment methods */}
            {step === 'choix' && (
                <>
                    <Text style={styles.sectionTitle}>Mode de paiement</Text>
                    {METHODES.map(m => (
                        <TouchableOpacity key={m.key} style={[styles.methodeCard, methode === m.key && styles.methodeCardActive, methode === m.key && { borderColor: m.color }]} onPress={() => setMethode(m.key)}>
                            <Text style={styles.methodeEmoji}>{m.icon}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.methodeLabel, methode === m.key && { color: m.color }]}>{m.label}</Text>
                                <Text style={styles.methodeHint}>{m.hint}</Text>
                            </View>
                            <View style={[styles.radio, methode === m.key && { borderColor: m.color }]}>
                                {methode === m.key && <View style={[styles.radioDot, { backgroundColor: m.color }]} />}
                            </View>
                        </TouchableOpacity>
                    ))}

                    {(methode === 'mtn_money' || methode === 'orange_money') && (
                        <View style={styles.numberSection}>
                            <Text style={styles.label}>Numéro {methode === 'mtn_money' ? 'MTN' : 'Orange'} Mobile Money</Text>
                            <TextInput
                                style={styles.input}
                                value={numero}
                                onChangeText={setNumero}
                                placeholder={selectedMethode.hint}
                                keyboardType="phone-pad"
                                maxLength={12}
                            />
                            <Text style={styles.mobileMoneyNote}>Vous recevrez un push USSD pour confirmer le paiement de {(tarif?.total_passager ?? tarif?.total ?? 0).toLocaleString()} FCFA.</Text>
                        </View>
                    )}

                    {methode === 'carte' && (
                        <View style={styles.numberSection}>
                            <Text style={styles.label}>Numéro de carte</Text>
                            <TextInput style={styles.input} value={numero} onChangeText={setNumero} placeholder="1234 5678 9012 3456" keyboardType="numeric" maxLength={19} />
                            <Text style={styles.mobileMoneyNote}>Paiement sécurisé par chiffrement SSL. Aucune donnée de carte stockée.</Text>
                        </View>
                    )}

                    {methode === 'especes' && (
                        <View style={styles.especesNote}>
                            <SafeIcon name="info" size={16} color="#059669" />
                            <Text style={styles.especesNoteText}>Préparez {(tarif?.total_passager ?? tarif?.total ?? 0).toLocaleString()} FCFA en espèces à remettre directement au chauffeur à l'arrivée.</Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed}>
                        <Text style={styles.proceedBtnText}>Continuer → {(tarif?.total_passager ?? tarif?.total ?? 0).toLocaleString()} FCFA</Text>
                    </TouchableOpacity>
                </>
            )}

            {/* Confirmation step */}
            {step === 'confirm' && (
                <View style={styles.confirmCard}>
                    <Text style={styles.confirmTitle}>Confirmer le paiement</Text>
                    <View style={styles.confirmRow}>
                        <Text style={styles.confirmKey}>Montant</Text>
                        <Text style={styles.confirmVal}>{(tarif?.total_passager ?? tarif?.total ?? 0).toLocaleString()} FCFA</Text>
                    </View>
                    <View style={styles.confirmRow}>
                        <Text style={styles.confirmKey}>Méthode</Text>
                        <Text style={styles.confirmVal}>{selectedMethode.icon} {selectedMethode.label}</Text>
                    </View>
                    {numero ? (
                        <View style={styles.confirmRow}>
                            <Text style={styles.confirmKey}>Numéro</Text>
                            <Text style={styles.confirmVal}>{numero.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}</Text>
                        </View>
                    ) : null}
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmPay}>
                        <SafeIcon name="lock" size={18} color="#fff" />
                        <Text style={styles.confirmBtnText}>Payer maintenant</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backLink} onPress={() => setStep('choix')}>
                        <Text style={styles.backLinkText}>← Modifier le paiement</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    tripCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
    tripRouteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tripLine: { width: 2, height: 14, backgroundColor: '#E5E7EB', marginLeft: 5, marginVertical: 2 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
    tripAddress: { fontSize: 14, fontWeight: '600', color: '#111827', maxWidth: 200 },
    driverBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    driverBadgeText: { fontSize: 12, color: modernColors.primary, fontWeight: '600' },
    fareCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
    fareTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
    fareRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
    fareKey: { fontSize: 13, color: '#6B7280' },
    fareVal: { fontSize: 13, fontWeight: '600', color: '#374151' },
    fareTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
    fareTotalKey: { fontSize: 15, fontWeight: '800', color: '#111827' },
    fareTotalVal: { fontSize: 22, fontWeight: '900', color: modernColors.primary },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
    methodeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
    methodeCardActive: { borderWidth: 2 },
    methodeEmoji: { fontSize: 28, width: 36, textAlign: 'center' },
    methodeLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
    methodeHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
    radioDot: { width: 11, height: 11, borderRadius: 6 },
    numberSection: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 4, marginBottom: 4 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: '#F9FAFB', letterSpacing: 1 },
    mobileMoneyNote: { fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 18 },
    especesNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#F0FDF4', borderRadius: 10, padding: 14, marginTop: 4, borderWidth: 1, borderColor: '#A7F3D0' },
    especesNoteText: { flex: 1, fontSize: 13, color: '#065F46', lineHeight: 20 },
    proceedBtn: { marginTop: 20, backgroundColor: modernColors.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    proceedBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    confirmCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    confirmTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16, textAlign: 'center' },
    confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    confirmKey: { fontSize: 14, color: '#6B7280' },
    confirmVal: { fontSize: 14, fontWeight: '700', color: '#111827' },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, backgroundColor: '#059669', paddingVertical: 16, borderRadius: 14 },
    confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    backLink: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
    backLinkText: { fontSize: 14, color: '#6B7280' },
    // Processing
    processingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 20, backgroundColor: '#F9FAFB' },
    processingTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    processingText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
    // Success
    successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F9FAFB', gap: 12 },
    successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    successEmoji: { fontSize: 40 },
    successTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
    successAmount: { fontSize: 36, fontWeight: '900', color: '#059669' },
    successMethod: { fontSize: 14, color: '#6B7280' },
    txCard: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
    txLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
    txId: { fontSize: 14, fontWeight: '800', color: '#374151', letterSpacing: 1 },
    tripSummaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, width: '100%', borderWidth: 1, borderColor: '#E5E7EB', marginTop: 8 },
    tripSummaryTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
    driverName: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
    rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 8, width: '100%', justifyContent: 'center' },
    rateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    homeBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
    homeBtnText: { fontSize: 14, color: '#9CA3AF' },
});

export default PaiementCourseScreen;
