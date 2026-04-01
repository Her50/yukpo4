// ✅ REFONTE COMPLÈTE 2026-03-07: AgenceVoyageDetailsScreen → Écran professionnel mondial
// Inspiré: Omio, FlixBus, Rome2rio — header gradient, horaires bus, actions rapides, IA, avis
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Linking,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet, apiPost } from '../../services/api';

const { width } = Dimensions.get('window');

interface AgenceVoyageDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom_agence: string;
    description?: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    pays?: string;
    gps?: string;
    logo_url?: string;
    is_available_now: boolean;
    is_verified?: boolean;
    note_moyenne?: number;
    nombre_avis?: number;
    services_voyage?: string[];
    compagnies_bus?: string[];
    destinations?: string[];
    specialites?: string[];
    heures_ouverture?: string;
    heures_fermeture?: string;
    jours_ouverture?: number[] | string;
    telephone?: string;
    whatsapp?: string;
    email?: string;
    site_web?: string;
    peut_emettre_tickets_bus?: boolean;
    devise?: string;
}

interface Schedule {
    id: number;
    departure_city: string;
    arrival_city: string;
    departure_times: string[];
    day_of_week?: number;
    notes?: string;
}

// Days are resolved via t() inside the component for multilingual support

const SERVICE_ICONS: Record<string, string> = {
    'Billetterie bus': 'ticket',
    'Billetterie avion': 'plane',
    'Organisation voyages': 'globe',
    'Visa': 'file-text',
};

const AgenceVoyageDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t, language: activeLang } = useLanguageSafe();
    const DAYS = ['', t('agenceVoyageForm.jourLun'), t('agenceVoyageForm.jourMar'), t('agenceVoyageForm.jourMer'), t('agenceVoyageForm.jourJeu'), t('agenceVoyageForm.jourVen'), t('agenceVoyageForm.jourSam'), t('agenceVoyageForm.jourDim')];
    const DAYS_FULL = ['', t('agenceVoyageForm.jourLundi'), t('agenceVoyageForm.jourMardi'), t('agenceVoyageForm.jourMercredi'), t('agenceVoyageForm.jourJeudi'), t('agenceVoyageForm.jourVendredi'), t('agenceVoyageForm.jourSamedi'), t('agenceVoyageForm.jourDimanche')];
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;

    const [agence, setAgence] = useState<AgenceVoyageDetails | null>(null);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        await Promise.all([loadAgenceDetails(), loadSchedules()]);
    };

    const loadAgenceDetails = async () => {
        try {
            setLoading(true);
            const agenceId = params.agenceId || params.id || params.specializedServiceId;
            const response = await apiGet(`/api/agences-voyage/${agenceId}`);
            const d = (response?.data || response) as any;
            if (d && (d.nom_agence || d.data?.nom_agence)) {
                setAgence(d.data || d);
            } else if (response.success && response.data) {
                setAgence(response.data as any);
            } else {
                Alert.alert('Erreur', t('agenceVoyageDetailsScreen.agenceNonTrouvee'));
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[AgenceVoyageDetails] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger');
            navigation.goBack();
        } finally { setLoading(false); }
    };

    const loadSchedules = async () => {
        try {
            const agenceId = params.agenceId || params.id || params.specializedServiceId;
            const resp = await apiGet(`/api/bus-tickets/agencies/${agenceId}/schedules`);
            const d = (resp?.data || resp) as any;
            setSchedules(Array.isArray(d?.data) ? d.data : Array.isArray(d?.schedules) ? d.schedules : Array.isArray(d) ? d : []);
        } catch { setSchedules([]); }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    }, []);

    const handleCall = () => { if (agence?.telephone) Linking.openURL(`tel:${agence.telephone.replace(/[^\d+]/g, '')}`); };
    const handleWhatsApp = () => { if (agence?.whatsapp) Linking.openURL(`https://wa.me/${agence.whatsapp.replace(/[^0-9+]/g, '')}`); };
    const handleEmail = () => { if (agence?.email) Linking.openURL(`mailto:${agence.email}`); };
    const handleWebsite = () => { if (agence?.site_web) Linking.openURL(agence.site_web.startsWith('http') ? agence.site_web : `https://${agence.site_web}`); };

    const handleBookTicket = () => {
        (navigation as any).navigate('BusTicketSearch', {
            defaultDeparture: agence?.ville || agence?.quartier || '',
        });
    };

    const handleSearchRoute = (dep: string, arr: string) => {
        (navigation as any).navigate('BusTicketSearch', {
            defaultDeparture: dep,
            defaultArrival: arr,
        });
    };

    const handleShare = async () => {
        if (!agence) return;
        try {
            await Share.share({
                title: agence.nom_agence,
                message: `${agence.nom_agence} — ${(agence.destinations || []).slice(0, 3).join(', ')}${agence.telephone ? t('agenceVoyageDetailsScreen.ntel') + agence.telephone : ''}\nVia Yukpo`,
            });
        } catch { }
    };

    const handleAISuggest = async () => {
        if (!agence) return;
        setLoadingAI(true);
        try {
            const resp = await apiPost('/ai/chat', {
                message: `As an expert travel assistant, recommend the best routes and tips for a traveler using the agency "${agence.nom_agence}" based in ${agence.ville || agence.quartier || 'Cameroon'}. Available destinations: ${(agence.destinations || []).join(', ')}. Services: ${(agence.services_voyage || []).join(', ')}. Give 3 short and practical suggestions. Respond in the user's language.`,
                context: 'travel_agency_recommendation',
                language: activeLang,
            });
            const d = (resp?.data || resp) as any;
            setAiSuggestion(d?.response || d?.message || d?.data?.response || t('agenceVoyageDetails.aucuneSuggestionDisponiblePourLe'));
        } catch {
            setAiSuggestion(t('agenceVoyageDetailsScreen.serviceIaTemporairementIndisponibleReessayezPlus'));
        } finally { setLoadingAI(false); }
    };

    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <SafeIcon key={i} name={i <= Math.round(rating) ? 'star' : 'star'} size={14}
                    color={i <= Math.round(rating) ? '#F59E0B' : '#D1D5DB'} />
            );
        }
        return stars;
    };

    if (loading) {
        return (
            <View style={st.loadingContainer}>
                <LinearGradient colors={['#1E3A8A', '#2563EB']} style={st.loadingGradient}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={st.loadingText}>{t('agenceVoyageDetails.chargementDeLagence')}</Text>
                </LinearGradient>
            </View>
        );
    }

    if (!agence) {
        return (
            <View style={st.loadingContainer}>
                <SafeIcon name="alert-circle" size={48} color="#9CA3AF" />
                <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 16 }}>{t('agenceVoyageDetails.agenceNonTrouvee')}</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                    <Text style={{ color: '#2563EB', fontWeight: '600' }}>{t('agenceVoyageDetails.retour')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isOpen = agence.is_available_now;

    return (
        <View style={st.container}>
            {/* ─── HERO HEADER ─── */}
            <LinearGradient colors={['#1E3A8A', '#2563EB', '#3B82F6']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBackBtn}>
                        <SafeIcon name="arrow-left" size={22} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity onPress={handleShare} style={st.heroActionBtn}>
                            <SafeIcon name="share" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={st.heroContent}>
                    <View style={st.heroIconBox}>
                        <SafeIcon name="bus" size={28} color="#2563EB" />
                    </View>
                    <Text style={st.heroTitle}>{agence.nom_agence}</Text>
                    {agence.description && <Text style={st.heroDesc} numberOfLines={2}>{agence.description}</Text>}

                    <View style={st.heroBadges}>
                        <View style={[st.heroBadge, isOpen ? st.heroBadgeOpen : st.heroBadgeClosed]}>
                            <View style={[st.statusDot, { backgroundColor: isOpen ? '#10B981' : '#EF4444' }]} />
                            <Text style={[st.heroBadgeText, { color: isOpen ? '#D1FAE5' : '#FECACA' }]}>
                                {isOpen ? t('agenceVoyageDetails.ouvert') : t('agenceVoyageDetailsScreen.ferme')}
                            </Text>
                        </View>
                        {agence.is_verified && (
                            <View style={[st.heroBadge, { backgroundColor: '#10B98130' }]}>
                                <SafeIcon name="check-circle" size={12} color="#10B981" />
                                <Text style={[st.heroBadgeText, { color: '#D1FAE5' }]}>{t('agenceVoyageDetails.verifie')}</Text>
                            </View>
                        )}
                        {(agence.note_moyenne || 0) > 0 && (
                            <View style={[st.heroBadge, { backgroundColor: '#F59E0B30' }]}>
                                <SafeIcon name="star" size={12} color="#F59E0B" />
                                <Text style={[st.heroBadgeText, { color: '#FEF3C7' }]}>{(agence.note_moyenne || 0).toFixed(1)} ({agence.nombre_avis || 0})</Text>
                            </View>
                        )}
                    </View>

                    <View style={st.heroLocation}>
                        <SafeIcon name="map-pin" size={14} color="#93C5FD" />
                        <Text style={st.heroLocationText}>
                            {[agence.adresse, agence.quartier, agence.ville].filter(Boolean).join(', ') || t('agenceVoyageDetails.localisationNonRenseignee')}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={st.body} contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}>

                {/* ─── QUICK ACTIONS ─── */}
                <View style={st.quickActions}>
                    <TouchableOpacity style={st.quickBtn} onPress={handleBookTicket}>
                        <View style={[st.quickIcon, { backgroundColor: '#EFF6FF' }]}>
                            <SafeIcon name="ticket" size={20} color="#2563EB" />
                        </View>
                        <Text style={st.quickLabel}>{t('agenceVoyageDetails.reserver')}</Text>
                    </TouchableOpacity>
                    {agence.telephone && (
                        <TouchableOpacity style={st.quickBtn} onPress={handleCall}>
                            <View style={[st.quickIcon, { backgroundColor: '#F0FDF4' }]}>
                                <SafeIcon name="phone" size={20} color="#10B981" />
                            </View>
                            <Text style={st.quickLabel}>{t('agenceVoyageDetails.appeler')}</Text>
                        </TouchableOpacity>
                    )}
                    {agence.whatsapp && (
                        <TouchableOpacity style={st.quickBtn} onPress={handleWhatsApp}>
                            <View style={[st.quickIcon, { backgroundColor: '#F0FDF4' }]}>
                                <SafeIcon name="message-circle" size={20} color="#22C55E" />
                            </View>
                            <Text style={st.quickLabel}>WhatsApp</Text>
                        </TouchableOpacity>
                    )}
                    {agence.site_web && (
                        <TouchableOpacity style={st.quickBtn} onPress={handleWebsite}>
                            <View style={[st.quickIcon, { backgroundColor: '#F5F3FF' }]}>
                                <SafeIcon name="globe" size={20} color="#7C3AED" />
                            </View>
                            <Text style={st.quickLabel}>{t('agenceVoyageDetails.siteWeb')}</Text>
                        </TouchableOpacity>
                    )}
                    {agence.email && !agence.whatsapp && !agence.site_web && (
                        <TouchableOpacity style={st.quickBtn} onPress={handleEmail}>
                            <View style={[st.quickIcon, { backgroundColor: '#FEF3C7' }]}>
                                <SafeIcon name="mail" size={20} color="#D97706" />
                            </View>
                            <Text style={st.quickLabel}>Email</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ─── HORAIRES ─── */}
                {(agence.heures_ouverture || agence.heures_fermeture) && (
                    <View style={st.card}>
                        <View style={st.cardHeader}>
                            <SafeIcon name="clock" size={18} color="#2563EB" />
                            <Text style={st.cardTitle}>{t('agenceVoyageDetails.horairesDouverture')}</Text>
                        </View>
                        <View style={st.hoursRow}>
                            <View style={st.hoursBadge}>
                                <Text style={st.hoursTime}>{agence.heures_ouverture || '—'}</Text>
                                <Text style={st.hoursLabel}>{t('agenceVoyageDetails.ouverture')}</Text>
                            </View>
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <SafeIcon name="arrow-right" size={16} color="#9CA3AF" />
                            </View>
                            <View style={st.hoursBadge}>
                                <Text style={st.hoursTime}>{agence.heures_fermeture || '—'}</Text>
                                <Text style={st.hoursLabel}>{t('agenceVoyageDetails.fermeture')}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* ─── SERVICES ─── */}
                {agence.services_voyage && agence.services_voyage.length > 0 && (
                    <View style={st.card}>
                        <View style={st.cardHeader}>
                            <SafeIcon name="briefcase" size={18} color="#8B5CF6" />
                            <Text style={st.cardTitle}>{t('agenceVoyageDetails.servicesProposes')}</Text>
                        </View>
                        <View style={st.servicesGrid}>
                            {agence.services_voyage.map((svc, i) => (
                                <View key={i} style={st.serviceChip}>
                                    <SafeIcon name={(SERVICE_ICONS[svc] || 'check') as any} size={16} color="#6366F1" />
                                    <Text style={st.serviceChipText}>{svc}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* ─── DESTINATIONS ─── */}
                {agence.destinations && agence.destinations.length > 0 && (
                    <View style={st.card}>
                        <View style={st.cardHeader}>
                            <SafeIcon name="map" size={18} color="#10B981" />
                            <Text style={st.cardTitle}>{t('agenceVoyageDetails.destinations')} ({agence.destinations.length})</Text>
                        </View>
                        <View style={st.destGrid}>
                            {agence.destinations.map((dest, i) => (
                                <TouchableOpacity key={i} style={st.destChip}
                                    onPress={() => handleSearchRoute(agence.ville || agence.quartier || '', dest)}>
                                    <SafeIcon name="map-pin" size={14} color="#059669" />
                                    <Text style={st.destText}>{dest}</Text>
                                    <SafeIcon name="chevron-right" size={14} color="#9CA3AF" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ─── HORAIRES DE DÉPART (schedules) ─── */}
                {schedules.length > 0 && (
                    <View style={st.card}>
                        <View style={st.cardHeader}>
                            <SafeIcon name="calendar" size={18} color="#F59E0B" />
                            <Text style={st.cardTitle}>{t('agenceVoyageDetails.horairesDeDepart')}</Text>
                        </View>
                        {schedules.slice(0, 5).map((sch, i) => (
                            <TouchableOpacity key={i} style={st.scheduleRow}
                                onPress={() => handleSearchRoute(sch.departure_city, sch.arrival_city)}>
                                <View style={st.scheduleRoute}>
                                    <Text style={st.scheduleDep}>{sch.departure_city}</Text>
                                    <SafeIcon name="arrow-right" size={14} color="#9CA3AF" />
                                    <Text style={st.scheduleArr}>{sch.arrival_city}</Text>
                                </View>
                                <View style={st.scheduleTimes}>
                                    {(sch.departure_times || []).map((t, j) => (
                                        <View key={j} style={st.timeBadge}>
                                            <Text style={st.timeText}>{t}</Text>
                                        </View>
                                    ))}
                                </View>
                                {sch.day_of_week && (
                                    <Text style={st.scheduleDay}>{DAYS_FULL[sch.day_of_week] || ''}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                        {schedules.length > 5 && (
                            <Text style={st.seeMore}>+{schedules.length - 5} {t('agenceVoyageDetails.autresHoraires')}</Text>
                        )}
                    </View>
                )}

                {/* ─── COMPAGNIES ─── */}
                {agence.compagnies_bus && agence.compagnies_bus.length > 0 && (
                    <View style={st.card}>
                        <View style={st.cardHeader}>
                            <SafeIcon name="truck" size={18} color="#F97316" />
                            <Text style={st.cardTitle}>{t('agenceVoyageDetails.compagniesDeBus')}</Text>
                        </View>
                        <View style={st.compGrid}>
                            {agence.compagnies_bus.map((comp, i) => (
                                <View key={i} style={st.compChip}>
                                    <SafeIcon name="bus" size={14} color="#EA580C" />
                                    <Text style={st.compText}>{comp}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* ─── IA SUGGESTIONS ─── */}
                <View style={st.card}>
                    <View style={st.cardHeader}>
                        <SafeIcon name="sparkles" size={18} color="#8B5CF6" />
                        <Text style={st.cardTitle}>{t('agenceVoyageDetails.assistantVoyageIa')}</Text>
                    </View>
                    {aiSuggestion ? (
                        <View style={st.aiResult}>
                            <Text style={st.aiText}>{aiSuggestion}</Text>
                            <TouchableOpacity onPress={handleAISuggest} style={st.aiRetry}>
                                <SafeIcon name="refresh-cw" size={14} color="#7C3AED" />
                                <Text style={st.aiRetryText}>{t('agenceVoyageDetails.nouvellesSuggestions')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={st.aiBtn} onPress={handleAISuggest} disabled={loadingAI}>
                            {loadingAI ? (
                                <ActivityIndicator size="small" color="#7C3AED" />
                            ) : (
                                <SafeIcon name="sparkles" size={18} color="#7C3AED" />
                            )}
                            <Text style={st.aiBtnText}>
                                {loadingAI ? t('agenceVoyageDetails.analyseEnCours') : t('agenceVoyageDetails.obtenirSuggestions')}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ─── CTA PRINCIPAL ─── */}
                {agence.peut_emettre_tickets_bus && (
                    <View style={st.ctaSection}>
                        <NativeButton
                            title={t('agenceVoyageDetails.rechercherUnTicketDeBus')}
                            onPress={handleBookTicket}
                            variant="primary"
                            size="large"
                            style={{ backgroundColor: '#2563EB' }}
                        />
                    </View>
                )}

                {/* ─── CONTACT COMPLET ─── */}
                <View style={st.card}>
                    <View style={st.cardHeader}>
                        <SafeIcon name="phone" size={18} color="#6B7280" />
                        <Text style={st.cardTitle}>{t('agenceVoyageDetails.contact')}</Text>
                    </View>
                    {agence.telephone && (
                        <TouchableOpacity style={st.contactRow} onPress={handleCall}>
                            <SafeIcon name="phone" size={16} color="#2563EB" />
                            <Text style={st.contactText}>{agence.telephone}</Text>
                            <SafeIcon name="external-link" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                    {agence.whatsapp && (
                        <TouchableOpacity style={st.contactRow} onPress={handleWhatsApp}>
                            <SafeIcon name="message-circle" size={16} color="#22C55E" />
                            <Text style={st.contactText}>{agence.whatsapp}</Text>
                            <SafeIcon name="external-link" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                    {agence.email && (
                        <TouchableOpacity style={st.contactRow} onPress={handleEmail}>
                            <SafeIcon name="mail" size={16} color="#D97706" />
                            <Text style={st.contactText}>{agence.email}</Text>
                            <SafeIcon name="external-link" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                    {agence.site_web && (
                        <TouchableOpacity style={st.contactRow} onPress={handleWebsite}>
                            <SafeIcon name="globe" size={16} color="#7C3AED" />
                            <Text style={st.contactText}>{agence.site_web}</Text>
                            <SafeIcon name="external-link" size={14} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
    loadingGradient: { width: '100%', flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#fff', fontSize: 15, marginTop: 16, fontWeight: '500' },
    // Hero
    hero: { paddingTop: 48, paddingBottom: 24, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    heroBackBtn: { padding: 6, backgroundColor: '#ffffff20', borderRadius: 10 },
    heroActionBtn: { padding: 8, backgroundColor: '#ffffff20', borderRadius: 10 },
    heroContent: { alignItems: 'flex-start' },
    heroIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
    heroDesc: { fontSize: 14, color: '#BFDBFE', marginBottom: 12, lineHeight: 20 },
    heroBadges: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
    heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#ffffff20' },
    heroBadgeOpen: { backgroundColor: '#10B98130' },
    heroBadgeClosed: { backgroundColor: '#EF444430' },
    heroBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    heroLocation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heroLocationText: { fontSize: 13, color: '#93C5FD', flex: 1 },
    // Body
    body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    // Quick Actions
    quickActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    quickBtn: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    quickLabel: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
    // Cards
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 14, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
    // Hours
    hoursRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
    hoursBadge: { alignItems: 'center', padding: 14, backgroundColor: '#EFF6FF', borderRadius: 12, minWidth: 100 },
    hoursTime: { fontSize: 20, fontWeight: '700', color: '#1E3A8A' },
    hoursLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: '500' },
    // Services
    servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    serviceChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F5F3FF', borderRadius: 10, borderWidth: 1, borderColor: '#E9D5FF' },
    serviceChipText: { fontSize: 13, fontWeight: '600', color: '#5B21B6' },
    // Destinations
    destGrid: { gap: 6 },
    destChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#F0FDF4', borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' },
    destText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#166534' },
    // Schedules
    scheduleRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    scheduleRoute: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    scheduleDep: { fontSize: 14, fontWeight: '700', color: '#111827' },
    scheduleArr: { fontSize: 14, fontWeight: '700', color: '#111827' },
    scheduleTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    timeBadge: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FEF3C7', borderRadius: 6 },
    timeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
    scheduleDay: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
    seeMore: { textAlign: 'center', color: '#2563EB', fontWeight: '600', fontSize: 13, marginTop: 12 },
    // Companies
    compGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    compChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFF7ED', borderRadius: 10, borderWidth: 1, borderColor: '#FED7AA' },
    compText: { fontSize: 13, fontWeight: '600', color: '#9A3412' },
    // AI
    aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#C4B5FD', borderStyle: 'dashed', backgroundColor: '#FAF5FF' },
    aiBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
    aiResult: { backgroundColor: '#FAF5FF', borderRadius: 12, padding: 14 },
    aiText: { fontSize: 13, color: '#374151', lineHeight: 20 },
    aiRetry: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    aiRetryText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
    // CTA
    ctaSection: { marginBottom: 14 },
    // Contact
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    contactText: { flex: 1, fontSize: 14, color: '#374151' },
});

export default AgenceVoyageDetailsScreen;

