// ✅ REFONTE 2026-03-07: TrocDetailsScreen → UX moderne
// Hero gradient violet, échange visuel, validations, actions, partage, pull-to-refresh
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';

interface TrocDetails {
    troc: {
        id: number;
        type_troc: string;
        statut: string;
        livre_offert_id: number;
        livre_souhaite_id: number;
        participant_id?: number;
        initiateur_id: number;
        chaine_troc_id?: number;
        distance_km?: number;
        validation_initiateur: boolean;
        validation_participant: boolean;
        created_at: string;
    };
    livre_offert?: any;
    livre_souhaite?: any;
    initiateur?: any;
    participant?: any;
    chaine?: any;
}

const getStatutColor = (s: string) => {
    switch (s) { case 'en_attente': return '#F59E0B'; case 'accepte': return '#10B981'; case 'refuse': return '#EF4444'; case 'complete': return '#8B5CF6'; case 'annule': return '#6B7280'; default: return '#6B7280'; }
};
const getStatutLabel = (s: string) => {
    switch (s) { case 'en_attente': return 'En attente'; case 'accepte': return 'Accepté'; case 'refuse': return 'Refusé'; case 'complete': return 'Complété'; case 'annule': return 'Annulé'; default: return s; }
};

const TrocDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;
    const trocId = params?.trocId as number;
    const typeTroc = params?.typeTroc as string;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [troc, setTroc] = useState<TrocDetails | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => { loadTrocDetails(); }, [trocId, typeTroc]);

    const loadTrocDetails = async () => {
        try {
            setLoading(true);
            const endpoint = typeTroc === 'chaine' && params?.chaineId ? `/api/troc-livres/chaines/${params.chaineId}` : `/api/troc-livres/${trocId}`;
            const response = await apiGet(endpoint);
            const r = response.data as any;
            if (response.success && r) setTroc(r);
            else { Alert.alert('Erreur', 'Impossible de charger les détails'); navigation.goBack(); }
        } catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur de chargement'); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadTrocDetails(); setRefreshing(false); }, [trocId, typeTroc]);

    const handleAccept = async () => {
        try { setActionLoading(true); const r = await apiPost(`/api/troc-livres/${trocId}/accept`, {}); if (r.success) { Alert.alert('Succès', 'Troc accepté !'); loadTrocDetails(); } else Alert.alert('Erreur', (r as any).error || 'Impossible d\'accepter'); }
        catch (e: any) { Alert.alert('Erreur', e.message || 'Une erreur est survenue'); } finally { setActionLoading(false); }
    };

    const handleRefuse = () => {
        Alert.alert('Refuser le troc', 'Êtes-vous sûr ?', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Refuser', style: 'destructive', onPress: async () => {
                    try { setActionLoading(true); const r = await apiPost(`/api/troc-livres/${trocId}/refuse`, {}); if (r.success) { Alert.alert('Succès', 'Troc refusé'); navigation.goBack(); } else Alert.alert('Erreur', (r as any).error || 'Impossible de refuser'); }
                    catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur'); } finally { setActionLoading(false); }
                }
            },
        ]);
    };

    const handleComplete = () => {
        Alert.alert('Finaliser le troc', 'Confirmez-vous que l\'échange a été effectué ?', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Confirmer', onPress: async () => {
                    try { setActionLoading(true); const r = await apiPost(`/api/troc-livres/${trocId}/complete`, {}); if (r.success) { Alert.alert('Succès', 'Troc finalisé !'); loadTrocDetails(); } else Alert.alert('Erreur', (r as any).error || 'Impossible de finaliser'); }
                    catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur'); } finally { setActionLoading(false); }
                }
            },
        ]);
    };

    const handleShare = async () => {
        if (!troc) return;
        try {
            await Share.share({
                message: `Troc de livres scolaires\n${troc.livre_offert?.titre || 'Livre offert'} ↔ ${troc.livre_souhaite?.titre || 'Livre souhaité'}\nStatut: ${getStatutLabel(troc.troc.statut)}\nVia Yukpo`,
                title: 'Troc de livres',
            });
        } catch { }
    };

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#7C3AED" /><Text style={st.centerText}>Chargement...</Text></View>);
    if (!troc) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#7C3AED" /><Text style={st.centerText}>Troc non trouvé</Text></View>);

    const isInitiateur = user?.id === troc.troc.initiateur_id;
    const canAccept = !isInitiateur && troc.troc.statut === 'en_attente';
    const canRefuse = troc.troc.statut === 'en_attente';
    const canComplete = troc.troc.statut === 'accepte';
    const statutColor = getStatutColor(troc.troc.statut);

    return (
        <View style={st.container}>
            {/* Hero */}
            <LinearGradient colors={['#4C1D95', '#7C3AED', '#A78BFA']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share-2" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    <View style={st.heroIconWrap}><SafeIcon name="repeat" size={28} color="#7C3AED" /></View>
                    <Text style={st.heroTitle}>Troc de livres</Text>
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: statutColor + '50' }]}><Text style={st.badgeText}>{getStatutLabel(troc.troc.statut)}</Text></View>
                        {troc.troc.type_troc === 'chaine' && (<View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><SafeIcon name="link" size={12} color="#fff" /><Text style={st.badgeText}>Chaîne</Text></View>)}
                    </View>
                    {/* Exchange preview */}
                    <View style={st.exchangeViz}>
                        <View style={st.exchangeEnd}><Text style={st.exchangeLabel}>{isInitiateur ? 'Vous offrez' : 'Vous recevez'}</Text><Text style={st.exchangeVal} numberOfLines={1}>{troc.livre_offert?.titre || 'Livre offert'}</Text></View>
                        <SafeIcon name="repeat" size={18} color="rgba(255,255,255,0.7)" />
                        <View style={st.exchangeEnd}><Text style={st.exchangeLabel}>{isInitiateur ? 'Vous recevez' : 'Vous offrez'}</Text><Text style={st.exchangeVal} numberOfLines={1}>{troc.livre_souhaite?.titre || 'Livre souhaité'}</Text></View>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#7C3AED']} />}>

                {/* Exchange Details */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="book-open" size={18} color="#7C3AED" /><Text style={st.cardTitle}>Détails de l'échange</Text></View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={st.livreCard}>
                            <Text style={st.livreLabel}>{isInitiateur ? 'Vous offrez' : 'Vous recevez'}</Text>
                            <Text style={st.livreTitle}>{troc.livre_offert?.titre || 'Livre offert'}</Text>
                            {troc.livre_offert && <Text style={st.livreMeta}>{troc.livre_offert.classe_actuelle} → {troc.livre_offert.classe_souhaitee}</Text>}
                        </View>
                        <View style={{ justifyContent: 'center' }}><SafeIcon name="arrow-right" size={20} color="#7C3AED" /></View>
                        <View style={st.livreCard}>
                            <Text style={st.livreLabel}>{isInitiateur ? 'Vous recevez' : 'Vous offrez'}</Text>
                            <Text style={st.livreTitle}>{troc.livre_souhaite?.titre || 'Livre souhaité'}</Text>
                            {troc.livre_souhaite && <Text style={st.livreMeta}>{troc.livre_souhaite.classe_actuelle} → {troc.livre_souhaite.classe_souhaitee}</Text>}
                        </View>
                    </View>
                </View>

                {/* Info */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="info" size={18} color="#7C3AED" /><Text style={st.cardTitle}>Informations</Text></View>
                    {troc.troc.distance_km != null && (<View style={st.infoRow}><Text style={st.infoLabel}>Distance</Text><Text style={st.infoValue}>{troc.troc.distance_km.toFixed(1)} km</Text></View>)}
                    <View style={st.infoRow}><Text style={st.infoLabel}>Créé le</Text><Text style={st.infoValue}>{new Date(troc.troc.created_at).toLocaleDateString('fr-FR')}</Text></View>
                </View>

                {/* Validations */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="check-square" size={18} color="#7C3AED" /><Text style={st.cardTitle}>Validations</Text></View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[st.validBadge, troc.troc.validation_initiateur && st.validBadgeOk]}>
                            <SafeIcon name={troc.troc.validation_initiateur ? 'check-circle' : 'circle'} size={20} color={troc.troc.validation_initiateur ? '#10B981' : '#9CA3AF'} />
                            <Text style={[st.validText, troc.troc.validation_initiateur && st.validTextOk]}>Initiateur</Text>
                        </View>
                        <View style={[st.validBadge, troc.troc.validation_participant && st.validBadgeOk]}>
                            <SafeIcon name={troc.troc.validation_participant ? 'check-circle' : 'circle'} size={20} color={troc.troc.validation_participant ? '#10B981' : '#9CA3AF'} />
                            <Text style={[st.validText, troc.troc.validation_participant && st.validTextOk]}>Participant</Text>
                        </View>
                    </View>
                </View>

                {/* Actions */}
                {(canAccept || canRefuse || canComplete) && (
                    <View style={{ paddingHorizontal: 16, gap: 10 }}>
                        {canAccept && (
                            <TouchableOpacity style={[st.primaryBtn, actionLoading && { opacity: 0.5 }]} onPress={handleAccept} disabled={actionLoading}>
                                {actionLoading ? <ActivityIndicator color="#fff" /> : <SafeIcon name="check" size={20} color="#fff" />}
                                <Text style={st.primaryBtnText}>Accepter le troc</Text>
                            </TouchableOpacity>
                        )}
                        {canComplete && (
                            <TouchableOpacity style={[st.primaryBtn, { backgroundColor: '#059669' }, actionLoading && { opacity: 0.5 }]} onPress={handleComplete} disabled={actionLoading}>
                                {actionLoading ? <ActivityIndicator color="#fff" /> : <SafeIcon name="check-circle" size={20} color="#fff" />}
                                <Text style={st.primaryBtnText}>Finaliser l'échange</Text>
                            </TouchableOpacity>
                        )}
                        {canRefuse && (
                            <TouchableOpacity style={[st.actionBtn, { borderLeftWidth: 3, borderLeftColor: '#EF4444' }]} onPress={handleRefuse} disabled={actionLoading}>
                                <SafeIcon name="x-circle" size={18} color="#EF4444" />
                                <Text style={[st.actionBtnText, { color: '#DC2626' }]}>Refuser le troc</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F3FF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3FF' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    // Exchange viz
    exchangeViz: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, width: '100%' },
    exchangeEnd: { flex: 1, alignItems: 'center' },
    exchangeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
    exchangeVal: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 2, textAlign: 'center' },
    // Card
    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
    // Book cards
    livreCard: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F5F3FF', gap: 4 },
    livreLabel: { fontSize: 11, color: '#6B7280' },
    livreTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
    livreMeta: { fontSize: 11, color: '#7C3AED' },
    // Info
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    infoLabel: { fontSize: 13, color: '#6B7280' },
    infoValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
    // Validation
    validBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    validBadgeOk: { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' },
    validText: { fontSize: 13, color: '#6B7280' },
    validTextOk: { color: '#059669', fontWeight: '600' },
    // Buttons
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7C3AED', padding: 16, borderRadius: 14, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    actionBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
});

export default TrocDetailsScreen;

