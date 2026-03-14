// ✅ REFONTE 2026-03-07: LivreScolaireDetailsScreen → UX moderne
// Hero gradient orange, galerie photos, échange visuel, état du livre, partage, pull-to-refresh
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
import { apiGet, apiPatch, apiPost } from '../../services/api';

interface LivreScolaire {
    id: number;
    service_id?: number;
    user_id: number;
    titre: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    description_etat?: string;
    images_urls?: string[];
    video_url?: string;
    gps?: string;
    ville?: string;
    quartier?: string;
    is_available: boolean;
    is_active: boolean;
    created_at: string;
}

const getEtatColor = (etat: string): string => {
    switch (etat) {
        case 'Neuf': return '#10B981';
        case 'Très bon': return '#059669';
        case 'Bon': return '#F59E0B';
        case 'Acceptable': return '#EF4444';
        default: return '#6B7280';
    }
};

const LivreScolaireDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [livre, setLivre] = useState<LivreScolaire | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { loadLivreDetails(); }, []);

    const loadLivreDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/bourse-livre/${params.livreId}`);
            const r = response.data as any;
            if (response.success && r) setLivre(r.livre);
            else { Alert.alert('Erreur', 'Impossible de charger les détails'); navigation.goBack(); }
        } catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur de chargement'); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadLivreDetails(); setRefreshing(false); }, []);

    const handleFindMatching = async () => {
        if (!livre) return;
        try {
            const response = await apiPost('/api/troc-livres/match', { livre_id: livre.id, include_chaines: true, max_participants: 5 });
            const r = response.data as any;
            if (response.success && r) navigation.navigate('TrocMatching' as never, { livreId: livre.id, matchings: r.matchings } as never);
        } catch { Alert.alert('Erreur', 'Impossible de trouver des matchings'); }
    };

    const handleShare = async () => {
        if (!livre) return;
        try {
            await Share.share({
                message: `${livre.titre}${livre.auteur ? ' — ' + livre.auteur : ''}\nMatière: ${livre.matiere}\nÉchange: ${livre.classe_actuelle} → ${livre.classe_souhaitee}\nÉtat: ${livre.etat_livre}${livre.ville ? '\n' + livre.ville : ''}\nVia Yukpo`,
                title: livre.titre,
            });
        } catch { }
    };

    const isOwner = (user?.id as any) === livre?.user_id;

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#EA580C" /><Text style={st.centerText}>Chargement...</Text></View>);
    if (!livre) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#EA580C" /><Text style={st.centerText}>Livre non trouvé</Text></View>);

    return (
        <View style={st.container}>
            {/* Hero */}
            <LinearGradient colors={['#7C2D12', '#EA580C', '#FB923C']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    <View style={st.heroIconWrap}><SafeIcon name="book-open" size={28} color="#EA580C" /></View>
                    <Text style={st.heroTitle} numberOfLines={2}>{livre.titre}</Text>
                    {livre.auteur && <Text style={st.heroSub}>par {livre.auteur}</Text>}
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: livre.is_available ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)' }]}>
                            <View style={[st.badgeDot, { backgroundColor: livre.is_available ? '#34D399' : '#FCA5A5' }]} />
                            <Text style={st.badgeText}>{livre.is_available ? 'Disponible' : 'Indisponible'}</Text>
                        </View>
                        <View style={[st.badge, { backgroundColor: getEtatColor(livre.etat_livre) + '40' }]}><Text style={st.badgeText}>{livre.etat_livre}</Text></View>
                    </View>
                    {/* Exchange visualization */}
                    <View style={st.exchangeViz}>
                        <View style={st.exchangeEnd}><Text style={st.exchangeLabel}>Classe</Text><Text style={st.exchangeVal}>{livre.classe_actuelle}</Text></View>
                        <SafeIcon name="arrow-right" size={18} color="rgba(255,255,255,0.7)" />
                        <View style={st.exchangeEnd}><Text style={st.exchangeLabel}>Souhaitée</Text><Text style={st.exchangeVal}>{livre.classe_souhaitee}</Text></View>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#EA580C']} />}>

                {/* Photo gallery */}
                {livre.images_urls && livre.images_urls.length > 0 && (
                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ maxHeight: 260, paddingHorizontal: 16, marginTop: 12 }}>
                        {livre.images_urls.map((url, i) => (
                            <Image key={i} source={{ uri: url }} style={{ width: 200, height: 250, borderRadius: 12, marginRight: 10 }} resizeMode="cover" />
                        ))}
                    </ScrollView>
                )}

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        { icon: 'share-2', label: 'Partager', color: '#8B5CF6', onPress: handleShare },
                        !isOwner && livre.is_available && { icon: 'refresh-cw', label: 'Troquer', color: '#EA580C', onPress: handleFindMatching },
                    ].filter(Boolean).map((a: any, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Book Info */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="book" size={18} color="#EA580C" /><Text style={st.cardTitle}>Informations</Text></View>
                    <View style={st.infoRow}><Text style={st.infoLabel}>Matière</Text><Text style={st.infoValue}>{livre.matiere}</Text></View>
                    {livre.niveau && <View style={st.infoRow}><Text style={st.infoLabel}>Niveau</Text><Text style={st.infoValue}>{livre.niveau}</Text></View>}
                    {livre.editeur && <View style={st.infoRow}><Text style={st.infoLabel}>Éditeur</Text><Text style={st.infoValue}>{livre.editeur}</Text></View>}
                    {livre.isbn && <View style={st.infoRow}><Text style={st.infoLabel}>ISBN</Text><Text style={st.infoValue}>{livre.isbn}</Text></View>}
                </View>

                {/* Condition */}
                <View style={st.card}>
                    <View style={st.cardHeader}><SafeIcon name="check-circle" size={18} color={getEtatColor(livre.etat_livre)} /><Text style={st.cardTitle}>État du livre</Text></View>
                    <View style={[st.etatBadge, { backgroundColor: getEtatColor(livre.etat_livre) + '20' }]}>
                        <Text style={[st.etatText, { color: getEtatColor(livre.etat_livre) }]}>{livre.etat_livre}</Text>
                    </View>
                    {livre.description_etat && <Text style={st.descText}>{livre.description_etat}</Text>}
                </View>

                {/* Location */}
                {(livre.ville || livre.quartier) && (
                    <View style={st.card}>
                        <View style={st.cardHeader}><SafeIcon name="map-pin" size={18} color="#EA580C" /><Text style={st.cardTitle}>Localisation</Text></View>
                        {livre.ville && <View style={st.infoRow}><Text style={st.infoLabel}>Ville</Text><Text style={st.infoValue}>{livre.ville}</Text></View>}
                        {livre.quartier && <View style={st.infoRow}><Text style={st.infoLabel}>Quartier</Text><Text style={st.infoValue}>{livre.quartier}</Text></View>}
                    </View>
                )}

                {/* Video */}
                {livre.video_url && (
                    <View style={st.card}>
                        <View style={st.cardHeader}><SafeIcon name="video" size={18} color="#EA580C" /><Text style={st.cardTitle}>Vidéo</Text></View>
                        <Text style={{ fontSize: 13, color: '#6B7280' }}>Vidéo d'appréciation disponible</Text>
                    </View>
                )}

                {/* Actions */}
                <View style={{ paddingHorizontal: 16, gap: 10 }}>
                    {!isOwner && livre.is_available && (
                        <TouchableOpacity style={st.primaryBtn} onPress={handleFindMatching}>
                            <SafeIcon name="refresh-cw" size={20} color="#fff" />
                            <Text style={st.primaryBtnText}>Trouver un troc</Text>
                        </TouchableOpacity>
                    )}
                    {isOwner && (
                        <>
                            <TouchableOpacity style={st.actionBtn} onPress={() => navigation.navigate('LivreScolaireForm' as never, { livreId: livre.id, mode: 'edit' } as never)}>
                                <SafeIcon name="edit-2" size={18} color="#EA580C" />
                                <Text style={st.actionBtnText}>Modifier</Text>
                                <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[st.actionBtn, { borderLeftWidth: 3, borderLeftColor: livre.is_available ? '#EF4444' : '#10B981' }]}
                                onPress={async () => {
                                    try { await apiPatch(`/api/bourse-livre/${livre.id}/availability`, { is_available: !livre.is_available }); loadLivreDetails(); Alert.alert('Succès', 'Disponibilité mise à jour'); }
                                    catch { Alert.alert('Erreur', 'Impossible de mettre à jour'); }
                                }}
                            >
                                <SafeIcon name={livre.is_available ? 'x-circle' : 'check-circle'} size={18} color={livre.is_available ? '#EF4444' : '#10B981'} />
                                <Text style={[st.actionBtnText, { color: livre.is_available ? '#DC2626' : '#059669' }]}>
                                    {livre.is_available ? 'Marquer indisponible' : 'Marquer disponible'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF7ED' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF7ED' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeDot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    // Exchange viz
    exchangeViz: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, width: '100%' },
    exchangeEnd: { flex: 1, alignItems: 'center' },
    exchangeLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
    exchangeVal: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 2 },
    // Quick actions
    quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 14 },
    quickAction: { alignItems: 'center', width: 64 },
    quickIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    quickLabel: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '500' },
    // Card
    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
    // Info
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    infoLabel: { fontSize: 13, color: '#6B7280' },
    infoValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
    // Condition
    etatBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 8 },
    etatText: { fontSize: 14, fontWeight: '600' },
    descText: { fontSize: 14, color: '#374151', lineHeight: 20 },
    // Buttons
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#EA580C', padding: 16, borderRadius: 14, shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    actionBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
});

export default LivreScolaireDetailsScreen;

