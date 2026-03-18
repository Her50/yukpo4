// ✅ REFONTE 2026-03-07: LaboratoireDetailsScreen → UX moderne
// Hero gradient teal, quick actions, examens, IA symptômes, chat, partage, pull-to-refresh
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
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet, apiPost } from '../../services/api';
import { ExaminationType, labService } from '../../services/labService';

interface LaboratoireDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    description?: string;
    type_laboratoire: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    is_verified?: boolean;
    note_moyenne?: number;
    nombre_avis?: number;
    analyses_disponibles?: string[];
    imagerie_disponible?: string[];
    specialites?: string[];
    rdv_requis: boolean;
    resultats_en_ligne: boolean;
    telephone?: string;
    whatsapp?: string;
    email?: string;
    site_web?: string;
    logo_url?: string;
}

const LaboratoireDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const params = route.params as any;

    const [laboratoire, setLaboratoire] = useState<LaboratoireDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [booking, setBooking] = useState(false);

    const [examinationTypes, setExaminationTypes] = useState<ExaminationType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [selectedExamination, setSelectedExamination] = useState<ExaminationType | null>(null);
    const [bookingNotes, setBookingNotes] = useState('');
    const [bookingExamination, setBookingExamination] = useState(false);

    const [showChat, setShowChat] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [prestataireInfo, setPrestataireInfo] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);

    const [symptomInput, setSymptomInput] = useState('');
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [pathologyResult, setPathologyResult] = useState<any>(null);
    const [searchingPathology, setSearchingPathology] = useState(false);

    useEffect(() => { loadLaboratoireDetails(); }, []);
    useEffect(() => { if (laboratoire) { loadExaminationTypes(); loadPrestataireInfo(); loadRatingStats(); } }, [laboratoire]);

    const loadLaboratoireDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/laboratoires/${params.laboratoryId}`);
            if (response.success && response.data) setLaboratoire(response.data as LaboratoireDetails);
            else { Alert.alert(t('message.error'), t('labDetails.cannotLoadDetails')); navigation.goBack(); }
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('labDetails.cannotLoadDetails')); navigation.goBack(); }
        finally { setLoading(false); }
    };

    const handleRefresh = useCallback(async () => { setRefreshing(true); await loadLaboratoireDetails(); setRefreshing(false); }, []);

    const handleCall = () => { if (laboratoire?.telephone) Linking.openURL(`tel:${laboratoire.telephone}`); };
    const handleWhatsApp = () => {
        const num = laboratoire?.whatsapp || laboratoire?.telephone;
        if (num) Linking.openURL(`https://wa.me/${num.replace(/[^0-9+]/g, '')}`);
    };
    const handleEmail = () => { if (laboratoire?.email) Linking.openURL(`mailto:${laboratoire.email}`); };
    const handleWebsite = () => {
        if (laboratoire?.site_web) { const url = laboratoire.site_web.startsWith('http') ? laboratoire.site_web : `https://${laboratoire.site_web}`; Linking.openURL(url); }
    };
    const handleShare = async () => {
        if (!laboratoire) return;
        try {
            await Share.share({
                message: `${laboratoire.nom} (${laboratoire.type_laboratoire})${laboratoire.adresse ? ' - ' + laboratoire.adresse : ''}${laboratoire.ville ? ', ' + laboratoire.ville : ''}${laboratoire.telephone ? '\nTel: ' + laboratoire.telephone : ''}${laboratoire.resultats_en_ligne ? '\nRésultats en ligne' : ''}\nVia Yukpo`,
                title: laboratoire.nom,
            });
        } catch { }
    };

    const handleBook = async () => {
        if (!user) { Alert.alert(t('labDetails.loginRequired'), t('labDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
        try {
            setBooking(true);
            const response = await apiPost(`/api/laboratoires/${params.laboratoryId}/book`, { notes: 'Réservation depuis l\'application mobile' });
            if (response.success) Alert.alert(t('labDetails.bookingCreated'), t('labDetails.bookingCreatedMsg'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
            else Alert.alert(t('message.error'), response.error || t('labDetails.cannotBook'));
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('labDetails.cannotBook')); }
        finally { setBooking(false); }
    };

    const loadExaminationTypes = async () => {
        try {
            setLoadingTypes(true);
            const response = await labService.getExaminationTypes(params.laboratoryId);
            if (response.success && response.data) setExaminationTypes(response.data.examination_types);
        } catch { } finally { setLoadingTypes(false); }
    };

    const handleBookExamination = (examinationType: ExaminationType) => {
        if (!user) { Alert.alert(t('labDetails.loginRequired'), t('labDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
        setSelectedExamination(examinationType);
        setShowBookingModal(true);
    };

    const handleConfirmBooking = async () => {
        if (!selectedExamination) return;
        try {
            setBookingExamination(true);
            const response = await labService.bookExamination(params.laboratoryId, { examination_type_id: selectedExamination.id, notes: bookingNotes.trim() || undefined });
            if (response.success && response.data) Alert.alert(t('labDetails.bookingSuccess'), `${t('labDetails.examBooked')} (ID: ${response.data.examination_id})`, [{ text: 'OK', onPress: () => { setShowBookingModal(false); setSelectedExamination(null); setBookingNotes(''); } }]);
            else Alert.alert(t('message.error'), response.error || t('labDetails.cannotBook'));
        } catch (error: any) { Alert.alert(t('message.error'), error.message || t('labDetails.cannotBook')); }
        finally { setBookingExamination(false); }
    };

    const loadPrestataireInfo = async () => {
        if (!laboratoire?.user_id) return;
        try { const r = await apiGet(`/api/users/${laboratoire.user_id}`); if (r.success && r.data) setPrestataireInfo(r.data); } catch { }
    };
    const loadRatingStats = async () => {
        if (!laboratoire?.service_id) return;
        try { const r = await apiGet(`/api/specialized-services/${laboratoire.service_id}/ratings/stats`); if (r.success && r.data) { const d = r.data as any; setRatingStats(d.stats || d); } } catch { }
    };

    const handleOpenChat = () => {
        if (!user) { Alert.alert(t('labDetails.loginRequired'), t('labDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
        setShowChat(true);
    };

    const handleSearchPathology = async () => {
        if (symptoms.length === 0) { Alert.alert(t('message.error'), t('labDetails.addAtLeastOneSymptom')); return; }
        try {
            setSearchingPathology(true);
            const response = await labService.searchPathology(symptoms);
            if (response.success) { const resData = (response as any).data?.data || (response as any).data; setPathologyResult(resData); }
            else Alert.alert(t('labDetails.aiUnavailable'), t('labDetails.symptomSearchUnavailable'));
        } catch { Alert.alert(t('message.error'), t('labDetails.cannotAnalyzeSymptoms')); }
        finally { setSearchingPathology(false); }
    };

    const addSymptom = () => { const s = symptomInput.trim(); if (s && !symptoms.includes(s)) { setSymptoms([...symptoms, s]); setSymptomInput(''); } };
    const removeSymptom = (sym: string) => { setSymptoms(symptoms.filter(s => s !== sym)); setPathologyResult(null); };

    const isOwner = user && laboratoire && String(user.id) === String(laboratoire.user_id);
    const rating = laboratoire?.note_moyenne || (ratingStats?.average_rating as number) || 0;
    const reviewCount = laboratoire?.nombre_avis || (ratingStats?.total_ratings as number) || 0;

    if (loading) return (<View style={st.center}><ActivityIndicator size="large" color="#0D9488" /><Text style={st.centerText}>Chargement...</Text></View>);
    if (!laboratoire) return (<View style={st.center}><SafeIcon name="alert-circle" size={48} color="#EF4444" /><Text style={st.centerText}>Laboratoire non trouvé</Text></View>);

    const isOpen = laboratoire.is_available_now;
    const starsFull = Math.floor(rating);
    const starsHalf = rating - starsFull >= 0.5;
    const analyses = laboratoire.analyses_disponibles || [];
    const imagerie = laboratoire.imagerie_disponible || [];

    return (
        <View style={st.container}>
            {/* Hero Gradient Header */}
            <LinearGradient colors={['#0F766E', '#0D9488', '#2DD4BF']} style={st.hero}>
                <View style={st.heroTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={st.heroBtn}><SafeIcon name="arrow-left" size={22} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleShare} style={st.heroBtn}><SafeIcon name="share" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <View style={st.heroContent}>
                    <View style={st.heroIconWrap}><SafeIcon name="microscope" size={28} color="#0D9488" /></View>
                    <Text style={st.heroTitle} numberOfLines={2}>{laboratoire.nom}</Text>
                    <Text style={st.heroType}>{laboratoire.type_laboratoire}</Text>
                    {laboratoire.description ? <Text style={st.heroDesc} numberOfLines={2}>{laboratoire.description}</Text> : null}
                    <View style={st.heroBadges}>
                        <View style={[st.badge, { backgroundColor: isOpen ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.3)' }]}>
                            <View style={[st.badgeDot, { backgroundColor: isOpen ? '#fff' : '#FCA5A5' }]} />
                            <Text style={st.badgeText}>{isOpen ? 'Ouvert' : 'Fermé'}</Text>
                        </View>
                        {laboratoire.rdv_requis && (
                            <View style={[st.badge, { backgroundColor: 'rgba(245,158,11,0.3)' }]}>
                                <SafeIcon name="calendar" size={12} color="#fff" />
                                <Text style={st.badgeText}>RDV requis</Text>
                            </View>
                        )}
                        {laboratoire.resultats_en_ligne && (
                            <View style={[st.badge, { backgroundColor: 'rgba(16,185,129,0.3)' }]}>
                                <SafeIcon name="wifi" size={12} color="#fff" />
                                <Text style={st.badgeText}>Résultats en ligne</Text>
                            </View>
                        )}
                        {laboratoire.is_verified && (
                            <View style={[st.badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                                <SafeIcon name="check-circle" size={12} color="#fff" />
                                <Text style={st.badgeText}>Vérifié</Text>
                            </View>
                        )}
                    </View>
                    <View style={st.ratingRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                            <SafeIcon key={i} name="star" size={16} color={i <= starsFull || (i === starsFull + 1 && starsHalf) ? '#FCD34D' : 'rgba(255,255,255,0.3)'} />
                        ))}
                        <Text style={st.ratingText}>{rating > 0 ? rating.toFixed(1) : '--'} ({reviewCount} avis)</Text>
                    </View>
                    {(laboratoire.adresse || laboratoire.quartier || laboratoire.ville) && (
                        <View style={st.heroLoc}><SafeIcon name="map-pin" size={14} color="rgba(255,255,255,0.8)" /><Text style={st.heroLocText} numberOfLines={1}>{[laboratoire.adresse, laboratoire.quartier, laboratoire.ville].filter(Boolean).join(', ')}</Text></View>
                    )}
                </View>
            </LinearGradient>

            <ScrollView style={st.scroll} contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0D9488']} />}>

                {/* Quick Actions */}
                <View style={st.quickRow}>
                    {[
                        laboratoire.telephone && { icon: 'phone', label: 'Appeler', color: '#0D9488', onPress: handleCall },
                        { icon: 'message-circle', label: 'WhatsApp', color: '#25D366', onPress: handleWhatsApp },
                        { icon: 'message-square', label: 'Chat', color: '#8B5CF6', onPress: handleOpenChat },
                        { icon: 'calendar', label: 'RDV', color: '#F59E0B', onPress: handleBook },
                        laboratoire.email && { icon: 'mail', label: 'Email', color: '#3B82F6', onPress: handleEmail },
                        laboratoire.site_web && { icon: 'globe', label: 'Site', color: '#6366F1', onPress: handleWebsite },
                    ].filter(Boolean).map((a: any, i) => (
                        <TouchableOpacity key={i} style={st.quickAction} onPress={a.onPress}>
                            <View style={[st.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon} size={20} color={a.color} /></View>
                            <Text style={st.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Analyses disponibles */}
                {analyses.length > 0 && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="test-tube" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>Analyses disponibles</Text></View>
                        <View style={st.chipWrap}>
                            {analyses.map((a, i) => (
                                <View key={i} style={[st.chip, { backgroundColor: '#F3E8FF' }]}><Text style={[st.chipText, { color: '#7C3AED' }]}>{a}</Text></View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Imagerie disponible */}
                {imagerie.length > 0 && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="scan" size={18} color="#3B82F6" /><Text style={st.sectionTitle}>Imagerie disponible</Text></View>
                        <View style={st.chipWrap}>
                            {imagerie.map((im, i) => (
                                <View key={i} style={[st.chip, { backgroundColor: '#DBEAFE' }]}><Text style={[st.chipText, { color: '#1E40AF' }]}>{im}</Text></View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Types d'examens */}
                {loadingTypes ? (
                    <View style={st.section}><ActivityIndicator size="small" color="#0D9488" /></View>
                ) : examinationTypes.length > 0 && (
                    <View style={st.section}>
                        <View style={st.sectionHeader}><SafeIcon name="flask-conical" size={18} color="#0D9488" /><Text style={st.sectionTitle}>Types d'examens</Text></View>
                        {examinationTypes.map((type) => (
                            <TouchableOpacity key={type.id} style={st.examRow} onPress={() => handleBookExamination(type)}>
                                <View style={{ flex: 1 }}>
                                    <Text style={st.examName}>{type.name}</Text>
                                    {type.category && <Text style={st.examCat}>{type.category}</Text>}
                                    {type.description && <Text style={st.examDesc} numberOfLines={2}>{type.description}</Text>}
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                                        {type.price && <Text style={st.examPrice}>{type.price} XAF</Text>}
                                        {type.duration_minutes && <Text style={st.examDur}>{type.duration_minutes} min</Text>}
                                    </View>
                                    {type.requires_fasting && <Text style={st.examFasting}>Jeûne requis</Text>}
                                </View>
                                <View style={st.examBookBtn}><SafeIcon name="calendar-plus" size={18} color="#0D9488" /></View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* IA Symptômes */}
                <View style={st.section}>
                    <View style={st.sectionHeader}><SafeIcon name="brain" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>IA - Examens par symptômes</Text></View>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 10 }}>Décrivez vos symptômes et l'IA suggérera les examens pertinents</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <TextInput style={[st.searchInput, { flex: 1 }]} placeholder="Ex: fatigue, douleur..." placeholderTextColor="#9CA3AF" value={symptomInput} onChangeText={setSymptomInput} onSubmitEditing={addSymptom} />
                        <TouchableOpacity style={[st.addBtn, !symptomInput.trim() && { opacity: 0.4 }]} disabled={!symptomInput.trim()} onPress={addSymptom}>
                            <SafeIcon name="plus" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    {symptoms.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {symptoms.map((s, i) => (
                                <TouchableOpacity key={i} style={st.symptomChip} onPress={() => removeSymptom(s)}>
                                    <Text style={{ fontSize: 13, color: '#0D9488', marginRight: 4 }}>{s}</Text>
                                    <SafeIcon name="x" size={12} color="#0D9488" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    <TouchableOpacity style={[st.analyzeBtn, (symptoms.length === 0 || searchingPathology) && { opacity: 0.5 }]} disabled={symptoms.length === 0 || searchingPathology} onPress={handleSearchPathology}>
                        {searchingPathology ? <ActivityIndicator size="small" color="#fff" /> : <><SafeIcon name="search" size={16} color="#fff" /><Text style={st.analyzeBtnText}>Analyser</Text></>}
                    </TouchableOpacity>

                    {pathologyResult && (
                        <View style={[st.resultCard, { borderLeftColor: '#7C3AED' }]}>
                            {pathologyResult.urgency_level && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <SafeIcon name="alert-circle" size={14} color={pathologyResult.urgency_level === 'critical' ? '#DC2626' : pathologyResult.urgency_level === 'high' ? '#F59E0B' : '#059669'} />
                                    <Text style={{ fontWeight: '600', color: '#111827', fontSize: 13 }}>Urgence: {pathologyResult.urgency_level}</Text>
                                </View>
                            )}
                            {pathologyResult.suggested_examinations?.length > 0 && (
                                <View style={{ marginBottom: 8 }}>
                                    <Text style={{ fontWeight: '600', color: '#111827', marginBottom: 4, fontSize: 13 }}>Examens suggérés:</Text>
                                    {pathologyResult.suggested_examinations.map((exam: string, idx: number) => (
                                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8, marginBottom: 2 }}>
                                            <SafeIcon name="check" size={12} color="#059669" /><Text style={{ fontSize: 13, color: '#374151' }}>{exam}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {pathologyResult.possible_pathologies?.length > 0 && (
                                <View style={{ marginBottom: 8 }}>
                                    <Text style={{ fontWeight: '600', color: '#111827', marginBottom: 4, fontSize: 13 }}>Pathologies possibles:</Text>
                                    {pathologyResult.possible_pathologies.map((p: string, idx: number) => (
                                        <Text key={idx} style={{ marginLeft: 8, fontSize: 13, color: '#374151' }}>• {p}</Text>
                                    ))}
                                </View>
                            )}
                            {pathologyResult.recommendations && (
                                <Text style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}>{pathologyResult.recommendations}</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Action buttons */}
                <View style={st.section}>
                    <TouchableOpacity style={[st.fullBtn, { backgroundColor: '#F0FDFA', borderLeftColor: '#0D9488', borderLeftWidth: 3 }]} onPress={handleBook} disabled={booking || !isOpen}>
                        <SafeIcon name="calendar" size={18} color="#0D9488" />
                        <Text style={[st.fullBtnText, { color: '#0F766E' }]}>{booking ? 'Réservation...' : 'Réserver un rendez-vous'}</Text>
                        <SafeIcon name="chevron-right" size={18} color="#5EEAD4" />
                    </TouchableOpacity>
                    <TouchableOpacity style={st.fullBtn} onPress={() => {
                        if (!user) { Alert.alert(t('labDetails.loginRequired'), t('labDetails.pleaseLogin')); navigation.navigate('Login' as never); return; }
                        navigation.navigate('MyLabExaminations' as never);
                    }}>
                        <SafeIcon name="clipboard-list" size={18} color="#0D9488" />
                        <Text style={st.fullBtnText}>Mes examens</Text>
                        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                    {isOwner && (
                        <TouchableOpacity style={st.fullBtn} onPress={() => navigation.navigate('LabAnalytics' as never, { laboratoryId: params.laboratoryId } as never)}>
                            <SafeIcon name="bar-chart-2" size={18} color="#F59E0B" />
                            <Text style={st.fullBtnText}>Analytics</Text>
                            <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Avis */}
                {laboratoire.service_id && (
                    <View style={st.section}>
                        <ProductCommentsSection serviceId={laboratoire.service_id} serviceTitle={laboratoire.nom} onOpenChat={handleOpenChat} mode="inline" />
                    </View>
                )}
            </ScrollView>

            {/* Chat */}
            {user && (
                <ChatModalMobile visible={showChat} onClose={() => setShowChat(false)}
                    service={{ id: laboratoire.service_id, nom: laboratoire.nom, type: 'laboratoire' }}
                    prestataireInfo={prestataireInfo || { id: laboratoire.user_id, nom: laboratoire.nom }}
                    user={user} conversationId={conversationId} />
            )}

            {/* Booking Modal */}
            <Modal animationType="slide" transparent visible={showBookingModal} onRequestClose={() => { setShowBookingModal(false); setSelectedExamination(null); setBookingNotes(''); }}>
                <View style={st.modalBg}>
                    <View style={st.modalCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Réserver un examen</Text>
                            <TouchableOpacity onPress={() => { setShowBookingModal(false); setSelectedExamination(null); setBookingNotes(''); }}>
                                <SafeIcon name="x" size={22} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        {selectedExamination && (
                            <View style={{ backgroundColor: '#F0FDFA', borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#0D9488' }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 }}>{selectedExamination.name}</Text>
                                {selectedExamination.category && <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>Catégorie: {selectedExamination.category}</Text>}
                                {selectedExamination.price && <Text style={{ fontSize: 15, fontWeight: '600', color: '#059669', marginBottom: 4 }}>{selectedExamination.price} XAF</Text>}
                                {selectedExamination.requires_fasting && <Text style={{ fontSize: 13, color: '#F59E0B', fontStyle: 'italic', marginTop: 4 }}>Jeûne requis avant l'examen</Text>}
                                {selectedExamination.preparation_instructions && (
                                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#D1FAE5' }}>
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4 }}>Instructions:</Text>
                                        <Text style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>{selectedExamination.preparation_instructions}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 6 }}>Notes (optionnel)</Text>
                        <TextInput style={[st.searchInput, { minHeight: 80, marginBottom: 16 }]} placeholder="Ajoutez des notes..." placeholderTextColor="#9CA3AF" value={bookingNotes} onChangeText={setBookingNotes} multiline />
                        <TouchableOpacity style={[st.analyzeBtn, { backgroundColor: '#0D9488' }, (bookingExamination || !selectedExamination) && { opacity: 0.5 }]} disabled={bookingExamination || !selectedExamination} onPress={handleConfirmBooking}>
                            {bookingExamination ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.analyzeBtnText}>Confirmer la réservation</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDFA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDFA' },
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
    // Chips
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    chipText: { fontSize: 13, fontWeight: '500' },
    // Examination rows
    examRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    examName: { fontSize: 15, fontWeight: '600', color: '#111827' },
    examCat: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    examDesc: { fontSize: 13, color: '#6B7280', marginTop: 2, lineHeight: 18 },
    examPrice: { fontSize: 14, fontWeight: '600', color: '#059669' },
    examDur: { fontSize: 13, color: '#6B7280' },
    examFasting: { fontSize: 12, color: '#F59E0B', fontStyle: 'italic', marginTop: 4 },
    examBookBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0FDFA', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    // Search / IA
    searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', minHeight: 44 },
    addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0D9488', justifyContent: 'center', alignItems: 'center' },
    symptomChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#99F6E4' },
    analyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 12, borderRadius: 12 },
    analyzeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    resultCard: { backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#0D9488', padding: 14, marginTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    // Full width buttons
    fullBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    fullBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
    // Modal
    modalBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalCard: { width: '90%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
});

export default LaboratoireDetailsScreen;

