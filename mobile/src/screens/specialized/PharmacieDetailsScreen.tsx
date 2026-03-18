// ✅ REFONTE 2026-03-07: PharmacieDetailsScreen → UX moderne niveau DocMorris/1001Pharmacies
// Hero gradient, quick actions, recherche médicament, IA interactions, chat, partage, avis
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
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
import { NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet, apiPost } from '../../services/api';
import {
    MedicationAvailability,
    MedicationInteraction,
    pharmacyService,
} from '../../services/pharmacyService';

interface PharmacieDetails {
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
    is_on_duty: boolean;
    is_verified?: boolean;
    note_moyenne?: number;
    nombre_avis?: number;
    telephone?: string;
    telephone_urgence?: string;
    whatsapp?: string;
    email?: string;
    site_web?: string;
    services?: string[];
    specialites?: string[];
    heures_ouverture?: string;
    heures_fermeture?: string;
    permanent_24h?: boolean;
    logo_url?: string;
}

const PharmacieDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const params = route.params as any;

    const [pharmacie, setPharmacie] = useState<PharmacieDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Recherche médicament
    const [searchMedication, setSearchMedication] = useState('');
    const [medicationAvailability, setMedicationAvailability] = useState<MedicationAvailability | null>(null);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);

    // Interactions IA
    const [showInteractionsModal, setShowInteractionsModal] = useState(false);
    const [medicationsForInteraction, setMedicationsForInteraction] = useState<string[]>([]);
    const [medicationInput, setMedicationInput] = useState('');
    const [checkingInteractions, setCheckingInteractions] = useState(false);
    const [interactionResult, setInteractionResult] = useState<MedicationInteraction | null>(null);

    // Chat et Avis
    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    // IA Suggestions santé
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);

    useEffect(() => { loadPharmacieDetails(); }, []);
    useEffect(() => { if (pharmacie) { loadPrestataireInfo(); loadRatingStats(); } }, [pharmacie]);

    const loadPharmacieDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/pharmacies/${params.pharmacieId}`);
            if (response.success && response.data) {
                setPharmacie(response.data as PharmacieDetails);
            } else {
                Alert.alert(t('message.error'), t('pharmacieDetails.cannotLoadDetails'));
                navigation.goBack();
            }
        } catch (error: any) {
            Alert.alert(t('message.error'), error.message || t('pharmacieDetails.cannotLoadDetails'));
            navigation.goBack();
        } finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadPharmacieDetails();
        setRefreshing(false);
    }, []);

    const handleCall = () => { if (pharmacie?.telephone) Linking.openURL(`tel:${pharmacie.telephone}`); };
    const handleWhatsApp = () => {
        const num = pharmacie?.whatsapp || pharmacie?.telephone;
        if (num) Linking.openURL(`https://wa.me/${num.replace(/[^0-9+]/g, '')}`);
    };
    const handleEmail = () => { if (pharmacie?.email) Linking.openURL(`mailto:${pharmacie.email}`); };
    const handleWebsite = () => {
        if (pharmacie?.site_web) {
            const url = pharmacie.site_web.startsWith('http') ? pharmacie.site_web : `https://${pharmacie.site_web}`;
            Linking.openURL(url);
        }
    };

    const handleShare = async () => {
        if (!pharmacie) return;
        try {
            await Share.share({
                message: `${pharmacie.nom}${pharmacie.adresse ? ' - ' + pharmacie.adresse : ''}${pharmacie.ville ? ', ' + pharmacie.ville : ''}${pharmacie.telephone ? '\nTel: ' + pharmacie.telephone : ''}\nVia Yukpo`,
                title: pharmacie.nom,
            });
        } catch { }
    };

    const handleAISuggest = async () => {
        if (!pharmacie) return;
        setLoadingAI(true);
        try {
            const resp = await apiPost('/api/ai/chat', {
                message: `En tant que pharmacien conseil, la pharmacie "${pharmacie.nom}" propose ces services: ${(pharmacie.services || []).join(', ')}. ${pharmacie.is_on_duty ? 'Elle est actuellement de garde.' : ''} Donne 3 conseils santé pratiques et courts pour les clients de cette pharmacie, en lien avec la saison et la région ${pharmacie.ville || 'Cameroun'}.`,
                context: 'pharmacy_health_tips',
            });
            const d = (resp?.data || resp) as any;
            setAiSuggestion(d?.response || d?.message || d?.data?.response || t('pharmacieDetails.aucunConseilDisponible'));
        } catch {
            setAiSuggestion('Service IA temporairement indisponible.');
        } finally { setLoadingAI(false); }
    };

    const handleCheckAvailability = async () => {
        if (!searchMedication.trim()) { Alert.alert(t('message.error'), t('pharmacieDetails.enterMedicationName')); return; }
        if (!user) { Alert.alert(t('pharmacieDetails.loginRequired'), t('pharmacieDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
        setCheckingAvailability(true);
        try {
            const response = await pharmacyService.checkAvailability(params.pharmacieId, searchMedication.trim());
            if (response.success && response.data) { setMedicationAvailability(response.data); setShowSearchModal(false); }
            else Alert.alert(t('message.error'), response.error || t('pharmacieDetails.cannotCheck'));
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('pharmacieDetails.cannotCheck')); }
        finally { setCheckingAvailability(false); }
    };

    const handleReserveMedication = async () => {
        if (!medicationAvailability?.available || !user) { Alert.alert(t('message.error'), t('pharmacieDetails.medicationUnavailable')); return; }
        try {
            const response = await pharmacyService.reserveMedication(params.pharmacieId, medicationAvailability.medication.name, medicationAvailability.requested_quantity || 1);
            if (response.success && response.data) {
                Alert.alert(t('pharmacieDetails.reservationSuccess'), `ID: ${response.data.reservation_id} — ${t('pharmacieDetails.expiresAt')} ${new Date(response.data.expiry_time).toLocaleString()}`);
                setMedicationAvailability(null); setSearchMedication('');
            } else Alert.alert(t('message.error'), response.error || t('pharmacieDetails.cannotReserve'));
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('pharmacieDetails.cannotReserve')); }
    };

    const handleCheckInteractions = async () => {
        if (medicationsForInteraction.length === 0) { Alert.alert(t('message.error'), t('pharmacieDetails.addAtLeastOneMedication')); return; }
        if (!user) { Alert.alert(t('pharmacieDetails.loginRequired'), t('pharmacieDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
        setCheckingInteractions(true);
        try {
            const response = await pharmacyService.checkInteractions(medicationsForInteraction);
            if (response.success && response.data) setInteractionResult(response.data.interaction);
            else Alert.alert(t('message.error'), response.error || t('pharmacieDetails.cannotCheck'));
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('pharmacieDetails.cannotCheck')); }
        finally { setCheckingInteractions(false); }
    };

    const addMedicationForInteraction = () => {
        if (medicationInput.trim() && !medicationsForInteraction.includes(medicationInput.trim())) {
            setMedicationsForInteraction([...medicationsForInteraction, medicationInput.trim()]);
            setMedicationInput('');
        }
    };
    const removeMedicationForInteraction = (medication: string) => {
        setMedicationsForInteraction(medicationsForInteraction.filter(m => m !== medication));
    };

    const loadPrestataireInfo = async () => {
        if (!pharmacie?.user_id) return;
        try {
            const response = await apiGet(`/api/users/${pharmacie.user_id}`);
            if (response.success && response.data) setPrestataireInfo(response.data);
        } catch { }
    };

    const loadRatingStats = async () => {
        if (!pharmacie?.service_id) return;
        try {
            const response = await apiGet(`/api/specialized-services/${pharmacie.service_id}/ratings/stats`);
            if (response.success && response.data) { const d = response.data as any; setRatingStats(d.stats || d); }
        } catch { }
    };

    const handleOpenChat = () => {
        if (!user) { Alert.alert(t('pharmacieDetails.loginRequired'), t('pharmacieDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
        setShowChat(true);
    };

    const isOwner = user && pharmacie && String(user.id) === String(pharmacie.user_id);
    const rating = pharmacie?.note_moyenne || (ratingStats?.average_rating as number) || 0;
    const reviewCount = pharmacie?.nombre_avis || (ratingStats?.total_ratings as number) || 0;

    // ─── Rendering ──────────────────────────────────────────────────────
    if (loading) {
        return (<View style={st.center}><ActivityIndicator size="large" color="#10B981" /><Text style={st.centerText}>{t('pharmacieDetails.chargement')}</Text></View>);
    }
    if (!pharmacie) {
        return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#EF4444" /><Text style={st.centerText}>{t('pharmacieDetails.pharmacieNonTrouvee')}</Text></View>);
    }

    const isOpen = pharmacie.is_available_now;
    const isGuard = pharmacie.is_on_duty;
    const services = pharmacie.services || [];
    const starsFull = Math.floor(rating);
    const starsHalf = rating - starsFull >= 0.5;

    return (
        <View style={st.container}>
            {/* Hero Gradient Header */}
            <LinearGradient colors={['#059669', '#10B981', '#34D399']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    <View style={st.heroIconWrap}><SafeIcon name="pill" size={30} color="#10B981" /></View>
                    <Text style={st.heroTitle} numberOfLines={2}>{pharmacie.nom}</Text>
                    {pharmacie.description ? <Text style={st.heroDesc} numberOfLines={2}>{pharmacie.description}</Text> : null}
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: isOpen ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.3)' }]}>
                            <View style={[st.badgeDot, { backgroundColor: isOpen ? '#fff' : '#FCA5A5' }]} />
                            <Text style={st.badgeText}>{isOpen ? (t('pharmacieDetailsScreen.ouvert') || 'Ouvert') : t('pharmacieDetailsScreen.ferme')}</Text>
                        </View>
                        {isGuard && (
                            <View style={[st.badge, { backgroundColor: 'rgba(59,130,246,0.3)' }]}>
                                <SafeIcon name="shield-check" size={12} color="#fff" />
                                <Text style={st.badgeText}>{t('pharmacieDetailsScreen.deGarde') || 'De garde'}</Text>
                            </View>
                        )}
                        {pharmacie.is_verified && (
                            <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                <SafeIcon name="check-circle" size={12} color="#fff" />
                                <Text style={st.badgeText}>{t('pharmacieDetails.verifiee')}</Text>
                            </View>
                        )}
                        {pharmacie.permanent_24h && (
                            <View style={[st.badge, { backgroundColor: 'rgba(245,158,11,0.35)' }]}>
                                <Text style={st.badgeText}>24h/24</Text>
                            </View>
                        )}
                    </View>
                    {/* Rating */}
                    <View style={st.ratingRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <SafeIcon key={i} name={i <= starsFull ? 'star' : (i === starsFull + 1 && starsHalf ? 'star' : 'star')} size={16} color={i <= starsFull || (i === starsFull + 1 && starsHalf) ? '#FCD34D' : 'rgba(255,255,255,0.3)'} />
                        ))}
                        <Text style={st.ratingText}>{rating > 0 ? rating.toFixed(1) : '--'} ({reviewCount} avis)</Text>
                    </View>
                    {/* Location */}
                    {(pharmacie.adresse || pharmacie.quartier || pharmacie.ville) && (
                        <View style={st.heroLoc}>
                            <SafeIcon name="map-pin" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={st.heroLocText} numberOfLines={1}>{[pharmacie.adresse, pharmacie.quartier, pharmacie.ville].filter(Boolean).join(', ')}</Text>
                        </View>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={st.scroll} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#10B981']} />}>

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        pharmacie.telephone && { icon: 'phone', label: 'Appeler', color: '#10B981', onPress: handleCall },
                        { icon: 'message-circle', label: 'WhatsApp', color: '#25D366', onPress: handleWhatsApp },
                        { icon: 'message-square', label: 'Chat', color: '#3B82F6', onPress: handleOpenChat },
                        pharmacie.email && { icon: 'mail', label: 'Email', color: '#8B5CF6', onPress: handleEmail },
                        pharmacie.site_web && { icon: 'globe', label: 'Site', color: '#F59E0B', onPress: handleWebsite },
                    ].filter(Boolean).map((a: any, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Horaires */}
                <View style={st.section}>
                    <View style={st.sectionHeader}><SafeIcon name="clock" size={18} color="#10B981" /><Text style={st.sectionTitle}>{t('pharmacieDetails.horaires')}</Text></View>
                    {pharmacie.permanent_24h ? (
                        <View style={st.infoCard}><SafeIcon name="clock" size={16} color="#F59E0B" /><Text style={st.infoCardText}>Ouvert 24h/24 - 7j/7</Text></View>
                    ) : (
                        <View style={st.infoCard}><SafeIcon name="clock" size={16} color="#6B7280" /><Text style={st.infoCardText}>{pharmacie.heures_ouverture || '08:00'} — {pharmacie.heures_fermeture || '20:00'}</Text></View>
                    )}
                    {isGuard && (
                        <View style={[st.infoCard, { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' }]}><SafeIcon name="shield-check" size={16} color="#3B82F6" /><Text style={[st.infoCardText, { color: '#1E40AF' }]}>Pharmacie de garde aujourd'hui</Text></View>
                    )}
                </View>

                {/* Urgences */}
                {pharmacie.telephone_urgence && (
                    <TouchableOpacity style={[st.infoCard, { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444', marginHorizontal: 16, marginBottom: 8 }]} onPress={() => Linking.openURL(`tel:${pharmacie.telephone_urgence}`)}>
                        <SafeIcon name="phone" size={16} color="#EF4444" />
                        <Text style={[st.infoCardText, { color: '#DC2626', fontWeight: '700' }]}>Urgences: {pharmacie.telephone_urgence}</Text>
                    </TouchableOpacity>
                )}

                {/* Services */}
                {services.length > 0 && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="activity" size={18} color="#10B981" /><Text style={st.sectionTitle}>Services</Text></View>
                        <View style={st.chipWrap}>
                            {services.map((s, i) => (
                                <View key={i} style={st.chip}><Text style={st.chipText}>{s}</Text></View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Recherche médicament */}
                <View style={st.section}>
                    <View style={st.sectionHeader}><SafeIcon name="search" size={18} color="#10B981" /><Text style={st.sectionTitle}>{t('pharmacieDetails.rechercherUnMedicament')}</Text></View>
                    <View style={st.searchRow}>
                        <TextInput style={st.searchInput} placeholder={t('pharmacieDetails.nomDuMedicamentOuDci')} placeholderTextColor="#9CA3AF" value={searchMedication} onChangeText={setSearchMedication} />
                        <TouchableOpacity style={[st.searchBtn, !searchMedication.trim() && { opacity: 0.5 }]} disabled={!searchMedication.trim()} onPress={() => setShowSearchModal(true)}>
                            <SafeIcon name="search" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {medicationAvailability && (
                        <View style={[st.resultCard, { borderLeftColor: medicationAvailability.available ? '#10B981' : '#EF4444' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <SafeIcon name={medicationAvailability.available ? 'check-circle' : 'x-circle'} size={20} color={medicationAvailability.available ? '#10B981' : '#EF4444'} />
                                <Text style={{ fontSize: 15, fontWeight: '700', color: medicationAvailability.available ? '#059669' : '#DC2626' }}>
                                    {medicationAvailability.available ? 'Disponible' : 'Indisponible'}
                                </Text>
                            </View>
                            {medicationAvailability.available && (
                                <>
                                    <Text style={st.resultLine}><Text style={st.resultLabel}>Nom: </Text>{medicationAvailability.medication.name}</Text>
                                    {medicationAvailability.medication.dci && <Text style={st.resultLine}><Text style={st.resultLabel}>DCI: </Text>{medicationAvailability.medication.dci}</Text>}
                                    <Text style={st.resultLine}><Text style={st.resultLabel}>{t('pharmacieDetailsScreen.stock')}: </Text>{medicationAvailability.medication.stock_quantity} unité(s)</Text>
                                    {medicationAvailability.medication.price && <Text style={st.resultLine}><Text style={st.resultLabel}>Prix: </Text>{medicationAvailability.medication.price} FCFA</Text>}
                                    {medicationAvailability.medication.requires_prescription && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                            <SafeIcon name="alert-triangle" size={14} color="#F59E0B" />
                                            <Text style={{ fontSize: 13, color: '#F59E0B', fontStyle: 'italic' }}>{t('pharmacieDetails.prescriptionMedicaleRequise')}</Text>
                                        </View>
                                    )}
                                    <TouchableOpacity style={st.reserveBtn} onPress={handleReserveMedication}>
                                        <SafeIcon name="shopping-bag" size={16} color="#fff" />
                                        <Text style={st.reserveBtnText}>{t('pharmacieDetails.reserverCeMedicament')}</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                </View>

                {/* IA Interactions + Conseils */}
                <View style={st.section}>
                    <View style={st.sectionHeader}><SafeIcon name="brain" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>{t('pharmacieDetails.assistantIaSante')}</Text></View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={[st.iaBtn, { flex: 1 }]} onPress={() => setShowInteractionsModal(true)}>
                            <SafeIcon name="alert-triangle" size={18} color="#EF4444" />
                            <Text style={st.iaBtnText}>Interactions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[st.iaBtn, { flex: 1, borderColor: '#7C3AED' }]} onPress={handleAISuggest}>
                            <SafeIcon name="sparkles" size={18} color="#7C3AED" />
                            <Text style={[st.iaBtnText, { color: '#7C3AED' }]}>{t('pharmacieDetails.conseilsSante')}</Text>
                        </TouchableOpacity>
                    </View>
                    {loadingAI && (
                        <View style={[st.resultCard, { borderLeftColor: '#7C3AED', alignItems: 'center' as any }]}>
                            <ActivityIndicator size="small" color="#7C3AED" />
                            <Text style={{ color: '#7C3AED', marginTop: 6, fontSize: 13 }}>Analyse IA en cours...</Text>
                        </View>
                    )}
                    {aiSuggestion && !loadingAI && (
                        <View style={[st.resultCard, { borderLeftColor: '#7C3AED' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <SafeIcon name="sparkles" size={16} color="#7C3AED" />
                                <Text style={{ fontWeight: '700', color: '#5B21B6', fontSize: 14 }}>Conseils IA</Text>
                            </View>
                            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>{aiSuggestion}</Text>
                            <TouchableOpacity onPress={handleAISuggest} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                                <SafeIcon name="refresh-cw" size={13} color="#7C3AED" />
                                <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '600' }}>{t('pharmacieDetails.actualiser')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Boutons supplémentaires */}
                <View style={st.section}>
                    <TouchableOpacity style={st.fullBtn} onPress={() => {
                        if (!user) { Alert.alert(t('pharmacieDetails.loginRequired'), t('pharmacieDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
                        navigation.navigate('MyPharmacyOrders' as never);
                    }}>
                        <SafeIcon name="clipboard-list" size={18} color="#3B82F6" />
                        <Text style={st.fullBtnText}>{t('pharmacieDetails.mesCommandes')}</Text>
                        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity style={st.fullBtn} onPress={() => navigation.navigate('PharmacyAnalytics' as never, { pharmacyId: params.pharmacieId } as never)}>
                            <SafeIcon name="bar-chart-2" size={18} color="#F59E0B" />
                            <Text style={st.fullBtnText}>Analytics</Text>
                            <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Avis et commentaires */}
                {pharmacie.service_id && (
                    <View style={st.section}>
                        <ProductCommentsSection serviceId={pharmacie.service_id} serviceTitle={pharmacie.nom} onOpenChat={handleOpenChat} mode="inline" />
                    </View>
                )}
            </ScrollView>

            {/* Chat Modal */}
            {user && (
                <ChatModalMobile visible={showChat} onClose={() => setShowChat(false)}
                    service={{ id: pharmacie.service_id, nom: pharmacie.nom, type: 'pharmacie' }}
                    prestataireInfo={prestataireInfo || { id: pharmacie.user_id, nom: pharmacie.nom }}
                    user={user} conversationId={conversationId} />
            )}

            {/* Modal recherche médicament */}
            <Modal animationType="slide" transparent visible={showSearchModal} onRequestClose={() => setShowSearchModal(false)}>
                <View style={st.modalBg}>
                    <View style={st.modal}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={st.modalTitle}>{t('pharmacieDetails.rechercherUnMedicament')}</Text>
                            <TouchableOpacity onPress={() => { setShowSearchModal(false); setSearchMedication(''); }}><SafeIcon name="x" size={22} color="#6B7280" /></TouchableOpacity>
                        </View>
                        <NativeInput placeholder={t('pharmacieDetails.nomDuMedicamentOuDci')} value={searchMedication} onChangeText={setSearchMedication} />
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                            <TouchableOpacity style={[st.modalBtn, { backgroundColor: '#F3F4F6' }]} onPress={() => { setShowSearchModal(false); setSearchMedication(''); }}>
                                <Text style={{ color: '#6B7280', fontWeight: '600' }}>{t('pharmacieDetailsScreen.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[st.modalBtn, { backgroundColor: '#10B981', flex: 2, opacity: checkingAvailability || !searchMedication.trim() ? 0.5 : 1 }]} disabled={checkingAvailability || !searchMedication.trim()} onPress={handleCheckAvailability}>
                                {checkingAvailability ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>{t('pharmacieDetails.verifier')}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal interactions */}
            <Modal animationType="slide" transparent visible={showInteractionsModal} onRequestClose={() => setShowInteractionsModal(false)}>
                <View style={st.modalBg}>
                    <View style={[st.modal, { maxHeight: '85%' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={st.modalTitle}>{t('pharmacieDetails.interactionsMedicamenteuses')}</Text>
                            <TouchableOpacity onPress={() => { setShowInteractionsModal(false); setMedicationsForInteraction([]); setInteractionResult(null); }}><SafeIcon name="x" size={22} color="#6B7280" /></TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            <TextInput style={[st.searchInput, { flex: 1 }]} placeholder={t('pharmacieDetails.nomDuMedicament')} placeholderTextColor="#9CA3AF" value={medicationInput} onChangeText={setMedicationInput} />
                            <TouchableOpacity style={[st.searchBtn, !medicationInput.trim() && { opacity: 0.5 }]} disabled={!medicationInput.trim()} onPress={addMedicationForInteraction}>
                                <SafeIcon name="plus" size={18} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        {medicationsForInteraction.length > 0 && (
                            <View style={{ marginBottom: 12 }}>
                                {medicationsForInteraction.map((med, idx) => (
                                    <View key={idx} style={st.medTag}>
                                        <Text style={st.medTagText}>{med}</Text>
                                        <TouchableOpacity onPress={() => removeMedicationForInteraction(med)}><SafeIcon name="x" size={14} color="#EF4444" /></TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                        {interactionResult && (
                            <ScrollView style={{ maxHeight: 250 }}>
                                <View style={[st.resultCard, { borderLeftColor: interactionResult.severity === 'contraindicated' ? '#EF4444' : interactionResult.severity === 'major' ? '#F59E0B' : '#3B82F6' }]}>
                                    <View style={[st.severityBadge, {
                                        backgroundColor: interactionResult.severity === 'contraindicated' ? '#FEE2E2' : interactionResult.severity === 'major' ? '#FEF3C7' : interactionResult.severity === 'moderate' ? '#DBEAFE' : '#F0FDF4',
                                    }]}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                                            {interactionResult.severity === 'contraindicated' ? t('pharmacieDetailsScreen.contreindique') : interactionResult.severity === 'major' ? 'Majeure' : interactionResult.severity === 'moderate' ? t('pharmacieDetailsScreen.moderee') : interactionResult.severity === 'minor' ? 'Mineure' : 'Aucune'}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 8 }}>{interactionResult.description}</Text>
                                    <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600', lineHeight: 20 }}>{interactionResult.recommendation}</Text>
                                    {interactionResult.alternative_suggestions?.length > 0 && (
                                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 6 }}>Alternatives:</Text>
                                            {interactionResult.alternative_suggestions.map((alt, idx) => (
                                                <Text key={idx} style={{ fontSize: 13, color: '#6B7280', marginBottom: 2 }}>• {alt}</Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        )}
                        <TouchableOpacity style={[st.modalBtn, { backgroundColor: '#EF4444', marginTop: 12, opacity: checkingInteractions || medicationsForInteraction.length === 0 ? 0.5 : 1 }]} disabled={checkingInteractions || medicationsForInteraction.length === 0} onPress={handleCheckInteractions}>
                            {checkingInteractions ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>{t('pharmacieDetails.verifierLesInteractions')}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDF4' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF4' },
    centerText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
    // Hero
    hero: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 28, paddingHorizontal: 20 },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    heroBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    heroContent: { alignItems: 'center' },
    heroIconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
    heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
    heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4 },
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
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#10B981', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    infoCardText: { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
    // Chips
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    chipText: { fontSize: 13, color: '#065F46', fontWeight: '500' },
    // Search
    searchRow: { flexDirection: 'row', gap: 8 },
    searchInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827' },
    searchBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
    // Result card
    resultCard: { backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#10B981', padding: 14, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    resultLine: { fontSize: 13, color: '#374151', marginBottom: 4 },
    resultLabel: { fontWeight: '600', color: '#111827' },
    reserveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 10, marginTop: 12 },
    reserveBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    // IA buttons
    iaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#EF4444', backgroundColor: '#fff' },
    iaBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
    // Full width buttons
    fullBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    fullBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
    // Modal
    modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    // Medication tag
    medTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 6 },
    medTagText: { fontSize: 14, color: '#4338CA', fontWeight: '500' },
    // Severity
    severityBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
});

export default PharmacieDetailsScreen;

