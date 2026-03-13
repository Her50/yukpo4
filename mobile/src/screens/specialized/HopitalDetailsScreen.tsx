// ✅ REFONTE 2026-03-07: HopitalDetailsScreen → UX moderne niveau Doctolib/Practo
// Hero gradient, quick actions, temps d'attente, urgences, IA pathologie, chat, partage, avis
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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import ProductCommentsSection from '../../components/ProductCommentsSection';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { EmergencyStatus, hospitalService, WaitTime } from '../../services/hospitalService';

interface HopitalDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    description?: string;
    type_etablissement: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    is_verified?: boolean;
    note_moyenne?: number;
    nombre_avis?: number;
    urgences_disponible: boolean;
    banque_sang: boolean;
    rdv_en_ligne: boolean;
    prestations_medicales?: string[];
    specialites?: string[];
    telephone?: string;
    telephone_urgence?: string;
    whatsapp?: string;
    email?: string;
    site_web?: string;
    logo_url?: string;
    heures_ouverture?: string;
    heures_fermeture?: string;
}

const HopitalDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [hopital, setHopital] = useState<HopitalDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [booking, setBooking] = useState(false);

    // Temps d'attente & urgences
    const [waitTimes, setWaitTimes] = useState<WaitTime[] | null>(null);
    const [emergencyStatus, setEmergencyStatus] = useState<EmergencyStatus | null>(null);

    // Chat et Avis
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    // IA: Recherche pathologie
    const [pathologyQuery, setPathologyQuery] = useState('');
    const [pathologyResult, setPathologyResult] = useState<any>(null);
    const [searchingPathology, setSearchingPathology] = useState(false);

    useEffect(() => { loadHopitalDetails(); }, []);
    useEffect(() => { if (hopital?.urgences_disponible) { loadEmergencyStatus(); loadWaitTimes(); } }, [hopital]);
    useEffect(() => { if (hopital) { loadPrestataireInfo(); loadRatingStats(); } }, [hopital]);

    const loadHopitalDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/hopitaux/${params.hospitalId}`);
            if (response.success && response.data) setHopital(response.data as HopitalDetails);
            else { Alert.alert('Erreur', 'Impossible de charger les détails'); navigation.goBack(); }
        } catch (error: any) { Alert.alert('Erreur', error.message || 'Impossible de charger'); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadHopitalDetails(); setRefreshing(false); }, []);

    const handleCall = () => { if (hopital?.telephone) Linking.openURL(`tel:${hopital.telephone}`); };
    const handleCallUrgence = () => { if (hopital?.telephone_urgence) Linking.openURL(`tel:${hopital.telephone_urgence}`); };
    const handleWhatsApp = () => {
        const num = hopital?.whatsapp || hopital?.telephone;
        if (num) Linking.openURL(`https://wa.me/${num.replace(/[^0-9+]/g, '')}`);
    };
    const handleEmail = () => { if (hopital?.email) Linking.openURL(`mailto:${hopital.email}`); };
    const handleWebsite = () => {
        if (hopital?.site_web) { const url = hopital.site_web.startsWith('http') ? hopital.site_web : `https://${hopital.site_web}`; Linking.openURL(url); }
    };
    const handleShare = async () => {
        if (!hopital) return;
        try {
            await Share.share({
                message: `${hopital.nom} (${hopital.type_etablissement})${hopital.adresse ? ' - ' + hopital.adresse : ''}${hopital.ville ? ', ' + hopital.ville : ''}${hopital.telephone ? '\nTel: ' + hopital.telephone : ''}${hopital.urgences_disponible ? '\nUrgences disponibles' : ''}\nVia Yukpo`,
                title: hopital.nom,
            });
        } catch { }
    };

    const handleBook = async () => {
        if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); navigation.navigate('Login' as never); return; }
        try {
            setBooking(true);
            const response = await apiPost(`/api/hopitaux/${params.hospitalId}/book`, { notes: 'Réservation depuis l\'application mobile' });
            if (response.success) Alert.alert('Réservation créée', 'Votre demande de rendez-vous a été envoyée.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
            else Alert.alert('Erreur', response.error || 'Impossible de réserver');
        } catch (error: any) { Alert.alert('Erreur', error.message || 'Impossible de réserver'); }
        finally { setBooking(false); }
    };

    const loadWaitTimes = async () => {
        try {
            const response = await hospitalService.getWaitTimes(params.hospitalId);
            if (response.success && response.data) setWaitTimes(response.data.wait_times);
        } catch { }
    };
    const loadEmergencyStatus = async () => {
        try {
            const response = await hospitalService.getEmergencyStatus(params.hospitalId);
            if (response.success && response.data) setEmergencyStatus(response.data);
        } catch { }
    };
    const loadPrestataireInfo = async () => {
        if (!hopital?.user_id) return;
        try { const r = await apiGet(`/api/users/${hopital.user_id}`); if (r.success && r.data) setPrestataireInfo(r.data); } catch { }
    };
    const loadRatingStats = async () => {
        if (!hopital?.service_id) return;
        try { const r = await apiGet(`/api/specialized-services/${hopital.service_id}/ratings/stats`); if (r.success && r.data) { const d = r.data as any; setRatingStats(d.stats || d); } } catch { }
    };

    const handleOpenChat = () => {
        if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); navigation.navigate('Login' as never); return; }
        setShowChat(true);
    };

    const handleSearchPathology = async () => {
        if (!pathologyQuery.trim()) { Alert.alert('Erreur', 'Décrivez vos symptômes'); return; }
        try {
            setSearchingPathology(true);
            const response = await hospitalService.searchPathology(pathologyQuery.trim(), undefined, undefined);
            if (response.success && response.results && response.results.length > 0) setPathologyResult(response.results[0]);
            else Alert.alert('Aucun résultat', (response as any).message || 'Aucun résultat trouvé.');
        } catch { Alert.alert('IA non disponible', 'La recherche IA n\'est pas encore opérationnelle.'); }
        finally { setSearchingPathology(false); }
    };

    const isOwner = user && hopital && String(user.id) === String(hopital.user_id);
    const rating = hopital?.note_moyenne || (ratingStats?.average_rating as number) || 0;
    const reviewCount = hopital?.nombre_avis || (ratingStats?.total_ratings as number) || 0;

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#3B82F6" /><Text style={st.centerText}>Chargement...</Text></View>);
    if (!hopital) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#EF4444" /><Text style={st.centerText}>Hôpital non trouvé</Text></View>);

    const isOpen = hopital.is_available_now;
    const starsFull = Math.floor(rating);
    const starsHalf = rating - starsFull >= 0.5;
    const prestations = hopital.prestations_medicales || [];

    const emergencyColor = emergencyStatus?.status === 'saturated' ? '#DC2626' : emergencyStatus?.status === 'busy' ? '#F59E0B' : '#059669';
    const emergencyLabel = emergencyStatus?.status === 'available' ? 'Disponible' : emergencyStatus?.status === 'busy' ? 'Occupé' : 'Saturé';

    return (
        <View style={st.container}>
            {/* Hero Gradient Header */}
            <LinearGradient colors={['#1E40AF', '#3B82F6', '#60A5FA']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    <View style={st.heroIconWrap}><SafeIcon name="building-2" size={28} color="#3B82F6" /></View>
                    <Text style={st.heroTitle} numberOfLines={2}>{hopital.nom}</Text>
                    <Text style={st.heroType}>{hopital.type_etablissement}</Text>
                    {hopital.description ? <Text style={st.heroDesc} numberOfLines={2}>{hopital.description}</Text> : null}
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: isOpen ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.3)' }]}>
                            <View style={[st.badgeDot, { backgroundColor: isOpen ? '#fff' : '#FCA5A5' }]} />
                            <Text style={st.badgeText}>{isOpen ? 'Ouvert' : 'Fermé'}</Text>
                        </View>
                        {hopital.urgences_disponible && (
                            <View style={[st.badge, { backgroundColor: 'rgba(239,68,68,0.3)' }]}>
                                <SafeIcon name="alert-circle" size={12} color="#fff" />
                                <Text style={st.badgeText}>Urgences</Text>
                            </View>
                        )}
                        {hopital.banque_sang && (
                            <View style={[st.badge, { backgroundColor: 'rgba(219,39,119,0.3)' }]}>
                                <SafeIcon name="heart" size={12} color="#fff" />
                                <Text style={st.badgeText}>Banque sang</Text>
                            </View>
                        )}
                        {hopital.rdv_en_ligne && (
                            <View style={[st.badge, { backgroundColor: 'rgba(16,185,129,0.3)' }]}>
                                <SafeIcon name="calendar" size={12} color="#fff" />
                                <Text style={st.badgeText}>RDV en ligne</Text>
                            </View>
                        )}
                        {hopital.is_verified && (
                            <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                <SafeIcon name="check-circle" size={12} color="#fff" />
                                <Text style={st.badgeText}>Vérifié</Text>
                            </View>
                        )}
                    </View>
                    {/* Rating */}
                    <View style={st.ratingRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <SafeIcon key={i} name="star" size={16} color={i <= starsFull || (i === starsFull + 1 && starsHalf) ? '#FCD34D' : 'rgba(255,255,255,0.3)'} />
                        ))}
                        <Text style={st.ratingText}>{rating > 0 ? rating.toFixed(1) : '--'} ({reviewCount} avis)</Text>
                    </View>
                    {(hopital.adresse || hopital.quartier || hopital.ville) && (
                        <View style={st.heroLoc}><SafeIcon name="map-pin" size={14} color="rgba(255,255,255,0.8)" /><Text style={st.heroLocText} numberOfLines={1}>{[hopital.adresse, hopital.quartier, hopital.ville].filter(Boolean).join(', ')}</Text></View>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={st.scroll} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#3B82F6']} />}>

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        hopital.telephone && { icon: 'phone', label: 'Appeler', color: '#3B82F6', onPress: handleCall },
                        { icon: 'message-circle', label: 'WhatsApp', color: '#25D366', onPress: handleWhatsApp },
                        { icon: 'message-square', label: 'Chat', color: '#8B5CF6', onPress: handleOpenChat },
                        hopital.rdv_en_ligne && { icon: 'calendar', label: 'RDV', color: '#10B981', onPress: handleBook },
                        hopital.email && { icon: 'mail', label: 'Email', color: '#F59E0B', onPress: handleEmail },
                        hopital.site_web && { icon: 'globe', label: 'Site', color: '#6366F1', onPress: handleWebsite },
                    ].filter(Boolean).map((a: any, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Urgences status */}
                {hopital.urgences_disponible && (
                    <View style={st.section}>
                        {hopital.telephone_urgence && (
                            <TouchableOpacity style={[st.infoCard, { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' }]} onPress={handleCallUrgence}>
                                <SafeIcon name="phone" size={16} color="#EF4444" />
                                <Text style={[st.infoCardText, { color: '#DC2626', fontWeight: '700' }]}>Urgences: {hopital.telephone_urgence}</Text>
                                <SafeIcon name="chevron-right" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                        {emergencyStatus && (
                            <View style={[st.infoCard, { borderLeftColor: emergencyColor }]}>
                                <SafeIcon name="alert-circle" size={16} color={emergencyColor} />
                                <Text style={[st.infoCardText, { color: emergencyColor, fontWeight: '700' }]}>Urgences: {emergencyLabel}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Emergency stats */}
                {emergencyStatus && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="activity" size={18} color="#EF4444" /><Text style={st.sectionTitle}>Statut urgences</Text></View>
                        <View style={st.statsRow}>
                            {[
                                { label: 'Critiques', value: emergencyStatus.critical_count, color: '#EF4444' },
                                { label: 'Temps moyen', value: emergencyStatus.avg_wait_time_minutes ? `${Math.round(emergencyStatus.avg_wait_time_minutes)}m` : 'N/A', color: '#F59E0B' },
                                { label: 'Total patients', value: emergencyStatus.total_patients, color: '#3B82F6' },
                            ].map((s, i) => (
                                <View key={i} style={st.statCard}>
                                    <Text style={[st.statValue, { color: s.color }]}>{s.value}</Text>
                                    <Text style={st.statLabel}>{s.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Wait times */}
                {waitTimes && waitTimes.length > 0 && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="clock" size={18} color="#3B82F6" /><Text style={st.sectionTitle}>Temps d'attente</Text></View>
                        {waitTimes.map((wt, idx) => (
                            <View key={idx} style={st.waitRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={st.waitSpec}>{wt.specialty || 'Général'}</Text>
                                    <Text style={st.waitSub}>{wt.consultation_count} consultation(s)</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={st.waitMin}>{wt.avg_wait_time_minutes ? `${Math.round(wt.avg_wait_time_minutes)} min` : 'N/A'}</Text>
                                    {wt.max_wait_time_minutes && <Text style={st.waitMax}>Max: {Math.round(wt.max_wait_time_minutes)} min</Text>}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Prestations */}
                {prestations.length > 0 && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="stethoscope" size={18} color="#3B82F6" /><Text style={st.sectionTitle}>Prestations médicales</Text></View>
                        <View style={st.chipWrap}>
                            {prestations.map((p, i) => (
                                <View key={i} style={st.chip}><Text style={st.chipText}>{p}</Text></View>
                            ))}
                        </View>
                    </View>
                )}

                {/* IA Pathologie */}
                <View style={st.section}>
                    <View style={st.sectionHeader}><SafeIcon name="brain" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>Recherche IA par symptômes</Text></View>
                    <TextInput style={st.searchInput} placeholder="Décrivez vos symptômes (fièvre, toux, douleur...)" placeholderTextColor="#9CA3AF" value={pathologyQuery} onChangeText={setPathologyQuery} multiline />
                    <TouchableOpacity style={[st.analyzeBtn, (!pathologyQuery.trim() || searchingPathology) && { opacity: 0.5 }]} disabled={!pathologyQuery.trim() || searchingPathology} onPress={handleSearchPathology}>
                        {searchingPathology ? <ActivityIndicator size="small" color="#fff" /> : <><SafeIcon name="search" size={16} color="#fff" /><Text style={st.analyzeBtnText}>Analyser</Text></>}
                    </TouchableOpacity>

                    {pathologyResult && (
                        <View style={[st.resultCard, { borderLeftColor: '#7C3AED' }]}>
                            <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827', marginBottom: 6 }}>{pathologyResult.pathology_name || 'Résultat'}</Text>
                            {pathologyResult.description && <Text style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 20 }}>{pathologyResult.description}</Text>}
                            {pathologyResult.urgency_level && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <SafeIcon name="alert-circle" size={14} color={pathologyResult.urgency_level === 'critical' ? '#DC2626' : pathologyResult.urgency_level === 'high' ? '#F59E0B' : '#059669'} />
                                    <Text style={{ fontWeight: '600', color: '#111827', fontSize: 13 }}>Urgence: {pathologyResult.urgency_level}</Text>
                                </View>
                            )}
                            {pathologyResult.recommended_services?.length > 0 && (
                                <View style={{ marginBottom: 8 }}>
                                    <Text style={{ fontWeight: '600', color: '#111827', marginBottom: 4, fontSize: 13 }}>Services recommandés:</Text>
                                    {pathologyResult.recommended_services.map((svc: string, idx: number) => (
                                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8, marginBottom: 2 }}>
                                            <SafeIcon name="check" size={12} color="#059669" /><Text style={{ fontSize: 13, color: '#374151' }}>{svc}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {pathologyResult.recommended_examinations?.length > 0 && (
                                <View style={{ marginBottom: 8 }}>
                                    <Text style={{ fontWeight: '600', color: '#111827', marginBottom: 4, fontSize: 13 }}>Examens recommandés:</Text>
                                    {pathologyResult.recommended_examinations.map((e: string, idx: number) => (
                                        <Text key={idx} style={{ marginLeft: 8, fontSize: 13, color: '#374151' }}>• {e}</Text>
                                    ))}
                                </View>
                            )}
                            {pathologyResult.recommendations?.length > 0 && (
                                <View style={{ marginTop: 4 }}>{pathologyResult.recommendations.map((r: string, idx: number) => (
                                    <Text key={idx} style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}>• {r}</Text>
                                ))}</View>
                            )}
                        </View>
                    )}
                </View>

                {/* Action buttons */}
                <View style={st.section}>
                    {hopital.rdv_en_ligne && (
                        <TouchableOpacity style={[st.fullBtn, { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6', borderLeftWidth: 3 }]} onPress={handleBook} disabled={booking || !isOpen}>
                            <SafeIcon name="calendar" size={18} color="#3B82F6" />
                            <Text style={[st.fullBtnText, { color: '#1E40AF' }]}>{booking ? 'Réservation...' : 'Réserver un rendez-vous'}</Text>
                            <SafeIcon name="chevron-right" size={18} color="#93C5FD" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={st.fullBtn} onPress={() => navigation.navigate('HospitalAIRecommendations' as never, { hospitalId: params.hospitalId } as never)}>
                        <SafeIcon name="sparkles" size={18} color="#7C3AED" />
                        <Text style={st.fullBtnText}>Recommandations IA</Text>
                        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={st.fullBtn} onPress={() => {
                        if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); navigation.navigate('Login' as never); return; }
                        navigation.navigate('MyConsultations' as never);
                    }}>
                        <SafeIcon name="clipboard-list" size={18} color="#3B82F6" />
                        <Text style={st.fullBtnText}>Mes consultations</Text>
                        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity style={st.fullBtn} onPress={() => navigation.navigate('HospitalAnalytics' as never, { hospitalId: params.hospitalId } as never)}>
                            <SafeIcon name="bar-chart-2" size={18} color="#F59E0B" />
                            <Text style={st.fullBtnText}>Analytics</Text>
                            <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Avis */}
                {hopital.service_id && (
                    <View style={st.section}>
                        <ProductCommentsSection serviceId={hopital.service_id} serviceTitle={hopital.nom} onOpenChat={handleOpenChat} mode="inline" />
                    </View>
                )}
            </ScrollView>

            {/* Chat */}
            {user && (
                <ChatModalMobile visible={showChat} onClose={() => setShowChat(false)}
                    service={{ id: hopital.service_id, nom: hopital.nom, type: 'hopital_clinique' }}
                    prestataireInfo={prestataireInfo || { id: hopital.user_id, nom: hopital.nom }}
                    user={user} conversationId={conversationId} />
            )}
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#EFF6FF' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EFF6FF' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
    heroType: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
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
    // Info card
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#3B82F6', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    infoCardText: { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
    // Stats
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
    statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },
    // Wait times
    waitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    waitSpec: { fontSize: 14, fontWeight: '600', color: '#111827' },
    waitSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    waitMin: { fontSize: 18, fontWeight: '700', color: '#3B82F6' },
    waitMax: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    // Chips
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    chipText: { fontSize: 13, color: '#1E40AF', fontWeight: '500' },
    // Search
    searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', minHeight: 48, marginBottom: 10 },
    analyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 12, borderRadius: 12 },
    analyzeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    // Result card
    resultCard: { backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#3B82F6', padding: 14, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    // Full width buttons
    fullBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    fullBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
});

export default HopitalDetailsScreen;

