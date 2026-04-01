import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

interface Plan {
    id: string;
    nom: string;
    prix_mensuel: number;
    trajets_inclus: number | 'illimite';
    description: string;
    avantages: string[];
    populaire?: boolean;
    couleur: string;
}

const PLANS: Plan[] = [
    {
        id: 'starter',
        nom: 'Starter',
        prix_mensuel: 5000,
        trajets_inclus: 8,
        description: 'Idéal pour les déplacements occasionnels',
        avantages: ['8 trajets/mois', 'Réservation prioritaire', 'SMS de confirmation'],
        couleur: '#6B7280',
    },
    {
        id: 'standard',
        nom: 'Standard',
        prix_mensuel: 12000,
        trajets_inclus: 20,
        description: 'Pour les navetteurs réguliers',
        avantages: ['20 trajets/mois', 'Réservation prioritaire', '10% de réduction', 'Assurance voyage incluse', 'Support client dédié'],
        populaire: true,
        couleur: modernColors.primary,
    },
    {
        id: 'premium',
        nom: 'Premium',
        prix_mensuel: 22000,
        trajets_inclus: 'illimite',
        description: 'Voyagez sans compter',
        avantages: ['Trajets illimités', 'Sièges premium réservés', '20% de réduction supplémentaire', 'Assurance tous risques', 'Conciergerie VIP', 'Accès salles d\'attente'],
        couleur: '#7C3AED',
    },
];

const AbonnementBusScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { agenceId, agenceNom } = route.params || {};

    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [currentSub, setCurrentSub] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);

    useEffect(() => { loadCurrentSub(); }, []);

    const loadCurrentSub = async () => {
        try {
            const res = await apiGet(`/api/bus-subscriptions/my?agence_id=${agenceId}`);
            setCurrentSub(res?.data || null);
        } catch { setCurrentSub(null); }
        finally { setLoading(false); }
    };

    const handleSubscribe = async () => {
        if (!selectedPlan) { Alert.alert('Sélection requise', 'Veuillez choisir un abonnement.'); return; }

        Alert.alert(
            'Confirmer l\'abonnement',
            `${selectedPlan.nom} — ${selectedPlan.prix_mensuel.toLocaleString()} FCFA/mois\n\nLe paiement sera débité mensuellement de votre Mobile Money.`,
            [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Souscrire', onPress: async () => {
                    setSubscribing(true);
                    try {
                        await apiPost('/api/bus-subscriptions', { plan_id: selectedPlan.id, agence_id: agenceId });
                        Alert.alert(
                            'Abonnement activé !',
                            `Votre abonnement ${selectedPlan.nom} est maintenant actif. Profitez de vos ${selectedPlan.trajets_inclus === 'illimite' ? 'trajets illimités' : `${selectedPlan.trajets_inclus} trajets`} dès aujourd'hui.`,
                            [{ text: 'Parfait', onPress: () => navigation.goBack() }]
                        );
                    } catch {
                        Alert.alert('Erreur', 'Impossible de souscrire. Vérifiez votre solde Mobile Money.');
                    } finally { setSubscribing(false); }
                }},
            ]
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.headerCard}>
                <SafeIcon name="star" size={20} color={modernColors.primary} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Abonnements mensuels</Text>
                    {agenceNom && <Text style={styles.headerSub}>{agenceNom}</Text>}
                </View>
            </View>

            {/* Current subscription */}
            {currentSub && (
                <View style={styles.currentSubCard}>
                    <View style={styles.currentSubHeader}>
                        <SafeIcon name="check-circle" size={18} color="#059669" />
                        <Text style={styles.currentSubTitle}>Abonnement actuel : {currentSub.plan_nom}</Text>
                    </View>
                    <Text style={styles.currentSubExpiry}>Renouvellement : {new Date(currentSub.date_fin).toLocaleDateString('fr-FR')}</Text>
                    <Text style={styles.currentSubUsage}>{currentSub.trajets_utilises}/{currentSub.trajets_inclus === 'illimite' ? '∞' : currentSub.trajets_inclus} trajets utilisés ce mois</Text>
                </View>
            )}

            {/* Plans */}
            <Text style={styles.sectionTitle}>Choisissez votre forfait</Text>
            {PLANS.map(plan => (
                <TouchableOpacity
                    key={plan.id}
                    style={[styles.planCard, selectedPlan?.id === plan.id && styles.planCardSelected, { borderColor: selectedPlan?.id === plan.id ? plan.couleur : '#E5E7EB' }]}
                    onPress={() => setSelectedPlan(plan)}
                >
                    {plan.populaire && (
                        <View style={[styles.popularBadge, { backgroundColor: plan.couleur }]}>
                            <Text style={styles.popularBadgeText}>⭐ Populaire</Text>
                        </View>
                    )}
                    <View style={styles.planHeader}>
                        <View>
                            <Text style={[styles.planNom, { color: plan.couleur }]}>{plan.nom}</Text>
                            <Text style={styles.planDescription}>{plan.description}</Text>
                        </View>
                        <View style={styles.planPrix}>
                            <Text style={[styles.planPrixVal, { color: plan.couleur }]}>{(plan.prix_mensuel / 1000).toFixed(0)}K</Text>
                            <Text style={styles.planPrixUnit}>FCFA/mois</Text>
                        </View>
                    </View>

                    <View style={[styles.trajetsChip, { backgroundColor: `${plan.couleur}15` }]}>
                        <SafeIcon name="bus" size={14} color={plan.couleur} />
                        <Text style={[styles.trajetsChipText, { color: plan.couleur }]}>
                            {plan.trajets_inclus === 'illimite' ? 'Trajets illimités' : `${plan.trajets_inclus} trajets/mois`}
                        </Text>
                    </View>

                    <View style={styles.avantagesList}>
                        {plan.avantages.map((av, i) => (
                            <View key={i} style={styles.avantageRow}>
                                <SafeIcon name="check" size={14} color={plan.couleur} />
                                <Text style={styles.avantageText}>{av}</Text>
                            </View>
                        ))}
                    </View>

                    {selectedPlan?.id === plan.id && (
                        <View style={[styles.selectedIndicator, { backgroundColor: plan.couleur }]}>
                            <SafeIcon name="check" size={14} color="#fff" />
                            <Text style={styles.selectedIndicatorText}>Sélectionné</Text>
                        </View>
                    )}
                </TouchableOpacity>
            ))}

            {/* Savings calculator */}
            {selectedPlan && selectedPlan.trajets_inclus !== 'illimite' && (
                <View style={styles.savingsCard}>
                    <Text style={styles.savingsTitle}>Économie estimée</Text>
                    <Text style={styles.savingsText}>
                        Au tarif normal ({Math.round(selectedPlan.prix_mensuel * 1.3 / (selectedPlan.trajets_inclus as number)).toLocaleString()} FCFA/trajet), {selectedPlan.trajets_inclus} trajets coûteraient {Math.round(selectedPlan.prix_mensuel * 1.3).toLocaleString()} FCFA.
                        Vous économisez <Text style={{ fontWeight: '800', color: '#059669' }}>{Math.round(selectedPlan.prix_mensuel * 0.3).toLocaleString()} FCFA/mois</Text>.
                    </Text>
                </View>
            )}

            {/* Guarantees */}
            <View style={styles.guaranteesRow}>
                <View style={styles.guaranteeItem}>
                    <SafeIcon name="shield" size={16} color="#059669" />
                    <Text style={styles.guaranteeText}>Résiliable à tout moment</Text>
                </View>
                <View style={styles.guaranteeItem}>
                    <SafeIcon name="refresh-cw" size={16} color="#059669" />
                    <Text style={styles.guaranteeText}>Renouvellement automatique</Text>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.subscribeBtn, (!selectedPlan || subscribing) && styles.subscribeBtnDisabled, selectedPlan && { backgroundColor: selectedPlan.couleur }]}
                onPress={handleSubscribe}
                disabled={!selectedPlan || subscribing}
            >
                <Text style={styles.subscribeBtnText}>
                    {subscribing ? 'Traitement...' : selectedPlan ? `Souscrire au ${selectedPlan.nom}` : 'Choisissez un forfait'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.footNote}>Paiement sécurisé via Mobile Money (MTN, Orange). Sans engagement minimum.</Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerCard: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    currentSubCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0' },
    currentSubHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 6 },
    currentSubTitle: { fontSize: 14, fontWeight: '700', color: '#065F46' },
    currentSubExpiry: { fontSize: 12, color: '#059669' },
    currentSubUsage: { fontSize: 13, color: '#374151', marginTop: 4, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    planCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 2, position: 'relative', overflow: 'hidden' },
    planCardSelected: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
    popularBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    popularBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    planNom: { fontSize: 20, fontWeight: '800' },
    planDescription: { fontSize: 12, color: '#6B7280', marginTop: 3 },
    planPrix: { alignItems: 'flex-end' },
    planPrixVal: { fontSize: 26, fontWeight: '900' },
    planPrixUnit: { fontSize: 11, color: '#9CA3AF', marginTop: -4 },
    trajetsChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
    trajetsChipText: { fontSize: 13, fontWeight: '700' },
    avantagesList: { gap: 6 },
    avantageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avantageText: { fontSize: 13, color: '#374151' },
    selectedIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
    selectedIndicatorText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    savingsCard: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#A7F3D0' },
    savingsTitle: { fontSize: 14, fontWeight: '700', color: '#065F46', marginBottom: 6 },
    savingsText: { fontSize: 13, color: '#374151', lineHeight: 20 },
    guaranteesRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    guaranteeItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    guaranteeText: { fontSize: 12, color: '#6B7280', flex: 1 },
    subscribeBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
    subscribeBtnDisabled: { backgroundColor: '#D1D5DB' },
    subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    footNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});

export default AbonnementBusScreen;
