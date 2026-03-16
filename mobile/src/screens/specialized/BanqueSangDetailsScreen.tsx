// ✅ REFONTE 2026-03-07: BanqueSangDetailsScreen → UX moderne
// Hero gradient rouge, quick actions, stocks sanguins, chat, partage, pull-to-refresh
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface BanqueSangDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    description?: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    is_verified?: boolean;
    note_moyenne?: number;
    nombre_avis?: number;
    logo_url?: string;
    stocks?: Record<string, number>;
    stocks_groupes_sanguins?: Record<string, any>;
    accepte_dons?: boolean;
    accepte_demandes?: boolean;
    urgence_24h?: boolean;
    telephone?: string;
    telephone_urgence?: string;
    whatsapp?: string;
    email?: string;
    site_web?: string;
}

const BanqueSangDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [banque, setBanque] = useState<BanqueSangDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    useEffect(() => { loadBanqueDetails(); }, []);
    useEffect(() => { if (banque) { loadPrestataireInfo(); loadRatingStats(); } }, [banque]);

    const loadBanqueDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/banques-sang/${params.banqueId}`);
            if (response.success && response.data) setBanque(response.data as BanqueSangDetails);
            else { Alert.alert('Erreur', 'Impossible de charger les détails'); navigation.goBack(); }
        } catch (error: any) { Alert.alert('Erreur', error.message || 'Impossible de charger'); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadBanqueDetails(); setRefreshing(false); }, []);

    const handleCall = () => { if (banque?.telephone) Linking.openURL(`tel:${banque.telephone}`); };
    const handleCallUrgence = () => { if (banque?.telephone_urgence) Linking.openURL(`tel:${banque.telephone_urgence}`); };
    const handleWhatsApp = () => {
        const num = banque?.whatsapp || banque?.telephone;
        if (num) Linking.openURL(`https://wa.me/${num.replace(/[^0-9+]/g, '')}`);
    };
    const handleEmail = () => { if (banque?.email) Linking.openURL(`mailto:${banque.email}`); };
    const handleShare = async () => {
        if (!banque) return;
        try {
            await Share.share({
                message: `${banque.nom}${banque.adresse ? ' - ' + banque.adresse : ''}${banque.ville ? ', ' + banque.ville : ''}${banque.telephone ? '\nTel: ' + banque.telephone : ''}${banque.urgence_24h ? '\nUrgence 24h' : ''}\nVia Yukpo`,
                title: banque.nom,
            });
        } catch { }
    };

    const handleRequestDonation = () => {
        if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); navigation.navigate('Login' as never); return; }
        navigation.navigate('BloodDonation' as never);
    };

    const loadPrestataireInfo = async () => {
        if (!banque?.user_id) return;
        try { const r = await apiGet(`/api/users/${banque.user_id}`); if (r.success && r.data) setPrestataireInfo(r.data); } catch { }
    };
    const loadRatingStats = async () => {
        if (!banque?.service_id) return;
        try { const r = await apiGet(`/api/specialized-services/${banque.service_id}/ratings/stats`); if (r.success && r.data) { const d = r.data as any; setRatingStats(d.stats || d); } } catch { }
    };

    const handleOpenChat = () => {
        if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); navigation.navigate('Login' as never); return; }
        setShowChat(true);
    };

    const rating = banque?.note_moyenne || (ratingStats?.average_rating as number) || 0;
    const reviewCount = banque?.nombre_avis || (ratingStats?.total_ratings as number) || 0;

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#DC2626" /><Text style={st.centerText}>{t('banqueSangDetails.chargement')}</Text></View>);
    if (!banque) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#EF4444" /><Text style={st.centerText}>{t('banqueSangDetails.banqueDeSangNonTrouvee')}</Text></View>);

    const isOpen = banque.is_available_now;
    const starsFull = Math.floor(rating);
    const starsHalf = rating - starsFull >= 0.5;

    // Parse stocks - handle both formats
    const stockEntries: [string, number][] = [];
    if (banque.stocks_groupes_sanguins) {
        Object.entries(banque.stocks_groupes_sanguins).forEach(([g, v]) => {
            const qty = typeof v === 'object' ? v?.quantite || 0 : (typeof v === 'number' ? v : 0);
            stockEntries.push([g, qty]);
        });
    } else if (banque.stocks) {
        Object.entries(banque.stocks).forEach(([g, q]) => stockEntries.push([g, q]));
    }

    return (
        <View style={st.container}>
            {/* Hero Gradient Header */}
            <LinearGradient colors={['#991B1B', '#DC2626', '#F87171']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    <View style={st.heroIconWrap}><SafeIcon name="droplet" size={28} color="#DC2626" /></View>
                    <Text style={st.heroTitle} numberOfLines={2}>{banque.nom}</Text>
                    {banque.description ? <Text style={st.heroDesc} numberOfLines={2}>{banque.description}</Text> : null}
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: isOpen ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' }]}>
                            <View style={[st.badgeDot, { backgroundColor: isOpen ? '#fff' : '#FCA5A5' }]} />
                            <Text style={st.badgeText}>{isOpen ? 'Ouvert' : t('banqueSangDetailsScreen.ferme')}</Text>
                        </View>
                        {banque.urgence_24h && (
                            <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                <SafeIcon name="clock" size={12} color="#fff" />
                                <Text style={st.badgeText}>Urgence 24h</Text>
                            </View>
                        )}
                        {banque.accepte_dons && (
                            <View style={[st.badge, { backgroundColor: 'rgba(16,185,129,0.35)' }]}>
                                <SafeIcon name="heart" size={12} color="#fff" />
                                <Text style={st.badgeText}>{t('banqueSangDetails.donsAcceptes')}</Text>
                            </View>
                        )}
                        {banque.is_verified && (
                            <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                <SafeIcon name="check-circle" size={12} color="#fff" />
                                <Text style={st.badgeText}>{t('banqueSangDetails.verifie')}</Text>
                            </View>
                        )}
                    </View>
                    <View style={st.ratingRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <SafeIcon key={i} name="star" size={16} color={i <= starsFull || (i === starsFull + 1 && starsHalf) ? '#FCD34D' : 'rgba(255,255,255,0.3)'} />
                        ))}
                        <Text style={st.ratingText}>{rating > 0 ? rating.toFixed(1) : '--'} ({reviewCount} avis)</Text>
                    </View>
                    {(banque.adresse || banque.quartier || banque.ville) && (
                        <View style={st.heroLoc}><SafeIcon name="map-pin" size={14} color="rgba(255,255,255,0.8)" /><Text style={st.heroLocText} numberOfLines={1}>{[banque.adresse, banque.quartier, banque.ville].filter(Boolean).join(', ')}</Text></View>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={st.scroll} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#DC2626']} />}>

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        banque.telephone && { icon: 'phone', label: 'Appeler', color: '#DC2626', onPress: handleCall },
                        { icon: 'message-circle', label: 'WhatsApp', color: '#25D366', onPress: handleWhatsApp },
                        { icon: 'message-square', label: 'Chat', color: '#8B5CF6', onPress: handleOpenChat },
                        { icon: 'heart', label: 'Don', color: '#EC4899', onPress: handleRequestDonation },
                        banque.email && { icon: 'mail', label: 'Email', color: '#3B82F6', onPress: handleEmail },
                        banque.telephone_urgence && { icon: 'phone-call', label: 'Urgence', color: '#F59E0B', onPress: handleCallUrgence },
                    ].filter(Boolean).map((a: any, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Stocks sanguins */}
                {stockEntries.length > 0 && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="droplet" size={18} color="#DC2626" /><Text style={st.sectionTitle}>{t('banqueSangDetails.stocksDisponibles')}</Text></View>
                        <View style={st.stocksGrid}>
                            {stockEntries.map(([groupe, qty]) => {
                                const level = qty > 20 ? 'high' : qty > 5 ? 'medium' : 'low';
                                const colors = { high: { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' }, medium: { bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' }, low: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' } };
                                const c = colors[level];
                                return (
                                    <View key={groupe} style={[st.stockCard, { backgroundColor: c.bg, borderColor: c.border }]}>
                                        <Text style={[st.stockGroupe, { color: c.text }]}>{groupe}</Text>
                                        <Text style={[st.stockQty, { color: c.text }]}>{qty}</Text>
                                        <Text style={[st.stockUnit, { color: c.text }]}>{t('banqueSangDetails.unites')}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Action buttons */}
                <View style={st.section}>
                    <TouchableOpacity style={[st.fullBtn, { backgroundColor: '#FEF2F2', borderLeftColor: '#DC2626', borderLeftWidth: 3 }]} onPress={handleRequestDonation}>
                        <SafeIcon name="heart" size={18} color="#DC2626" />
                        <Text style={[st.fullBtnText, { color: '#991B1B' }]}>Faire une demande de don</Text>
                        <SafeIcon name="chevron-right" size={18} color="#FCA5A5" />
                    </TouchableOpacity>
                    {banque.accepte_dons && (
                        <TouchableOpacity style={st.fullBtn} onPress={() => {
                            if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); navigation.navigate('Login' as never); return; }
                            navigation.navigate('BloodDonation' as never);
                        }}>
                            <SafeIcon name="droplet" size={18} color="#DC2626" />
                            <Text style={st.fullBtnText}>{t('banqueSangDetails.devenirDonneur')}</Text>
                            <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Avis */}
                {banque.service_id && (
                    <View style={st.section}>
                        <ProductCommentsSection serviceId={banque.service_id} serviceTitle={banque.nom} onOpenChat={handleOpenChat} mode="inline" />
                    </View>
                )}
            </ScrollView>

            {/* Chat */}
            {user && (
                <ChatModalMobile visible={showChat} onClose={() => setShowChat(false)}
                    service={{ id: banque.service_id, nom: banque.nom, type: 'banque_sang' }}
                    prestataireInfo={prestataireInfo || { id: banque.user_id, nom: banque.nom }}
                    user={user} conversationId={conversationId} />
            )}
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FEF2F2' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEF2F2' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
    heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4 },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeDot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 12, color: '#fff', fontWeight: '600' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    ratingText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginLeft: 4 },
    heroLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    heroLocText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    // Scroll
    scroll: { flex: 1 },
    // Quick actions
    quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 16, flexWrap: 'wrap' },
    quickAction: { alignItems: 'center', width: 64 },
    quickIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    quickLabel: { fontSize: 11, color: '#374151', textAlign: 'center', fontWeight: '500' },
    // Sections
    section: { paddingHorizontal: 16, marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    // Stocks grid
    stocksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    stockCard: { width: '22%', minWidth: 72, padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
    stockGroupe: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    stockQty: { fontSize: 20, fontWeight: '800' },
    stockUnit: { fontSize: 10 },
    // Full width buttons
    fullBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    fullBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
});

export default BanqueSangDetailsScreen;

