// ✅ REFONTE TOTALE 2026-03-05: HopitalFormScreen → Dashboard pro + Formulaire
// Mode Dashboard (hôpital existant): 4 tabs (Accueil / Service / Créneaux / Stats)
// Mode Création: Formulaire guidé avec sections visuelles
// Exploite endpoints: CRUD hôpital, slots, consultations, wait-times, emergency, AI triage/recommendations, analytics
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import PrestationSelectorWithSchedule, { PrestationWithSchedule } from '../../components/PrestationSelectorWithSchedule';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import ServiceTeamManager from '../../components/ServiceTeamManager';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiGet, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const STORAGE_KEY = '@hopital_form';
type TabType = 'overview' | 'service' | 'slots' | 'analytics' | 'team';

interface HospitalAnalytics {
    total_consultations?: number;
    consultations_7d?: number;
    avg_wait_time_min?: number;
    occupancy_rate?: number;
}

const HopitalFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout } = useAuth();
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    const TYPES_ETABLISSEMENT = [
        { key: t('hopitalFormScreen.hopital') || 'Hôpital', icon: 'building' },
        { key: t('hopitalFormScreen.clinique') || 'Clinique', icon: 'heart' },
        { key: t('hopitalFormScreen.centreDeSante') || 'Centre de santé', icon: 'activity' },
        { key: t('hopitalFormScreen.dispensaire') || 'Dispensaire', icon: 'plus-circle' },
    ];

    const PRESTATIONS_OPTIONS = [
        t('hopitalFormScreen.urgences') || 'Urgences',
        t('hopitalFormScreen.consultationGenerale') || 'Consultation générale',
        t('hopitalFormScreen.chirurgieGenerale') || 'Chirurgie générale',
        t('hopitalFormScreen.chirurgieCardiaque') || 'Chirurgie cardiaque',
        t('hopitalFormScreen.chirurgieOrthopedique') || 'Chirurgie orthopédique',
        t('hopitalFormScreen.maternite') || 'Maternité',
        t('hopitalFormScreen.pediatrie') || 'Pédiatrie',
        t('hopitalFormScreen.cardiologie') || 'Cardiologie',
        t('hopitalFormScreen.radiologie') || 'Radiologie',
        t('hopitalFormScreen.imagerieMedicale') || 'Imagerie médicale',
        t('hopitalFormScreen.urologie') || 'Urologie',
        t('hopitalFormScreen.cancerologie') || 'Cancérologie',
        t('hopitalFormScreen.oncologie') || 'Oncologie',
        t('hopitalFormScreen.dentisterie') || 'Dentisterie',
        t('hopitalFormScreen.ophtalmologie') || 'Ophtalmologie',
        'ORL',
        t('hopitalFormScreen.dermatologie') || 'Dermatologie',
        t('hopitalFormScreen.neurologie') || 'Neurologie',
        t('hopitalFormScreen.psychiatrie') || 'Psychiatrie',
        t('hopitalFormScreen.gynecologie') || 'Gynécologie',
        t('hopitalFormScreen.medecineInterne') || 'Médecine interne',
        t('hopitalFormScreen.anesthesie') || 'Anesthésie',
        t('hopitalFormScreen.reanimation') || 'Réanimation',
        t('hopitalFormScreen.laboratoireDanalyses') || 'Laboratoire d\'analyses',
        t('hopitalFormScreen.pharmaciePrestation') || 'Pharmacie',
        t('hopitalFormScreen.kinesitherapie') || 'Kinésithérapie',
        t('hopitalFormScreen.physiotherapie') || 'Physiothérapie',
    ];

    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    // Dashboard state
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    // ✅ FIX: Partenaires voient TOUJOURS le dashboard (même vide), pas le formulaire de création
    const [isDashboardMode, setIsDashboardMode] = useState(user?.role === 'partenaire' && !mode);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hospitalData, setHospitalData] = useState<any>(null);
    const [analyticsData, setAnalyticsData] = useState<HospitalAnalytics | null>(null);
    const [emergencyStatus, setEmergencyStatus] = useState<any>(null);
    const [consultations, setConsultations] = useState<any[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        nom: '', type_etablissement: t('hopitalFormScreen.hopital'), adresse: '',
        quartier: null as LocationObject | null,
        prestations_medicales: [] as string[],
        urgences_disponible: false, rdv_en_ligne: false,
        telephone: '', telephone_urgence: '', whatsapp: '', email: '', site_web: '',
    });

    const [loading, setLoading] = useState(false);
    const [prestationsWithSchedule, setPrestationsWithSchedule] = useState<PrestationWithSchedule[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);

    const { partnerData } = usePartnerData(user?.role, 'hopital');
    const { errors, validateField, validateForm, setError } = useFormValidation({
        nom: { required: true, minLength: 3 },
        telephone: { pattern: /^\+?[0-9]{9,15}$/ },
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    });
    useFormAutoSave(STORAGE_KEY, formData, true, 1000);

    // Computed stats
    const stats = {
        totalPrestations: prestationsWithSchedule.length,
        totalSlots: prestationsWithSchedule.reduce((s, p) => {
            if (p.scheduleByDay?.length) return s + p.scheduleByDay.reduce((ds, d) => ds + (d.timeSlots?.length || 0), 0);
            return s + (p.timeSlots?.length || 0);
        }, 0),
        withSlots: prestationsWithSchedule.filter(p => {
            if (p.scheduleByDay?.length) return p.scheduleByDay.some(d => d.timeSlots?.length > 0);
            return p.timeSlots?.length > 0;
        }).length,
    };

    // ─── DATA LOADING ────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            if (user?.role === 'partenaire' && user?.partner_type === 'hopital') {
                try {
                    const partnerResp = await apiGet('/api/partners/me');
                    if (partnerResp.success && partnerResp.data) {
                        const p = partnerResp.data as any;
                        setFormData(prev => ({
                            ...prev, nom: p.name || prev.nom,
                            adresse: p.address || p.location_address || prev.adresse,
                            telephone: p.contact_phone || prev.telephone, email: p.contact_email || prev.email,
                            quartier: p.city ? { raw: p.city, place_name: p.city, components: { ville: p.city, pays: p.country } } as any : prev.quartier,
                        }));
                    }
                    const hospResp = await apiGet('/api/hopitaux');
                    const resData = (hospResp?.data || hospResp) as any;
                    const hospitals = Array.isArray(resData?.data) ? resData.data : Array.isArray(resData) ? resData : [];
                    if (hospitals.length > 0) {
                        const myHosp = hospitals[0];
                        setHospitalData(myHosp);
                        setIsDashboardMode(true);
                        if (!serviceId && myHosp.service_id) setServiceId(myHosp.service_id);
                        const hid = myHosp.id || myHosp.service_id;
                        if (hid) { loadAnalytics(hid); loadConsultations(); loadEmergency(hid); }
                    }
                } catch (e) { console.log('[Hopital] Init:', e); }
            }
            // Edit mode
            if (mode === 'edit' && specializedServiceId) {
                try {
                    setLoading(true);
                    const resp = await apiGet(`/api/hopitaux/${specializedServiceId}`);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        setFormData({
                            nom: d.nom || '', type_etablissement: d.type_etablissement || t('hopitalForm.hopital'),
                            adresse: d.adresse || '', quartier: d.quartier ? { raw: d.quartier, place_name: d.quartier } as any : null,
                            prestations_medicales: d.prestations_medicales || [],
                            urgences_disponible: d.urgences_disponible || false, rdv_en_ligne: d.rdv_en_ligne || false,
                            telephone: d.telephone || '', telephone_urgence: d.telephone_urgence || '',
                            whatsapp: d.whatsapp || '', email: d.email || '', site_web: d.site_web || '',
                        });
                        if (d.planning_prestations && Array.isArray(d.planning_prestations)) {
                            setPrestationsWithSchedule(d.planning_prestations.map((p: any) => ({
                                prestation: p.prestation,
                                scheduleByDay: p.scheduleByDay || (p.days || []).map((day: number) => ({ day, timeSlots: p.timeSlots || [{ start: '08:00', end: '17:00' }] })),
                                days: p.days || [], timeSlots: p.timeSlots || [],
                            })));
                        }
                        if (d.gps) setSelectedGPS(d.gps);
                    }
                } catch (e) { console.error('[Hopital] Edit load:', e); } finally { setLoading(false); }
            }
            setInitialLoading(false);
        };
        init();
    }, [user?.role, user?.partner_type]);

    // Auto-create service
    useEffect(() => {
        if (!serviceId && user?.id && formData.nom) {
            (async () => {
                try {
                    const resp = await servicesApi.createService({ titre_service: formData.nom || t('hopitalForm.etablissementDeSante'), description: `${formData.type_etablissement}`, category: 'sante' });
                    if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) setServiceId((resp.data as any).id);
                } catch (e) { console.error('[Hopital] Service:', e); }
            })();
        }
    }, [formData.nom, serviceId, user?.id]);

    const loadAnalytics = async (hid: number) => {
        try { const r = await apiGet(`/api/hopitaux/${hid}/analytics`); const d = (r?.data || r) as any; if (d) setAnalyticsData(d?.data || d); } catch (e) { console.log('[Hopital] Analytics:', e); }
    };
    const loadConsultations = async () => {
        try { const r = await apiGet('/api/hopitaux/my-consultations'); const d = (r?.data || r) as any; setConsultations(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []); } catch (e) { console.log('[Hopital] Consultations:', e); }
    };
    const loadEmergency = async (hid: number) => {
        try { const r = await apiGet(`/api/hopitaux/${hid}/emergency-status`); if (r.success) setEmergencyStatus(r.data); } catch (e) { console.log('[Hopital] Emergency:', e); }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        const hid = hospitalData?.id || hospitalData?.service_id || serviceId;
        if (hid) await Promise.all([loadAnalytics(hid), loadConsultations(), loadEmergency(hid)]);
        setRefreshing(false);
    };

    const handleGPSSelect = (c: string) => { setSelectedGPS(c); setShowGPSModal(false); };

    const handleSubmit = async () => {
        if (!formData.nom.trim()) { Alert.alert('Erreur', 'Nom obligatoire'); return; }
        setLoading(true);
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                const resp = await servicesApi.createService({ titre_service: formData.nom, description: formData.type_etablissement, category: 'sante' });
                if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) { finalServiceId = (resp.data as any).id; setServiceId(finalServiceId); }
            } catch (e) { Alert.alert('Erreur', t('hopitalFormScreen.impossibleDeCreerLeService')); setLoading(false); return; }
        }
        if (!finalServiceId) { Alert.alert('Erreur', 'Service ID manquant'); setLoading(false); return; }
        try {
            const payload = {
                service_id: finalServiceId, nom: formData.nom, type_etablissement: formData.type_etablissement,
                adresse: formData.adresse || null,
                quartier: typeof formData.quartier === 'string' ? formData.quartier : (formData.quartier?.raw || formData.quartier?.place_name || null),
                gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                prestations_medicales: formData.prestations_medicales.length > 0 ? formData.prestations_medicales : null,
                planning_prestations: prestationsWithSchedule.length > 0 ? prestationsWithSchedule : null,
                urgences_disponible: formData.urgences_disponible, rdv_en_ligne: formData.rdv_en_ligne,
                telephone: formData.telephone || null, telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null, email: formData.email || null, site_web: formData.site_web || null,
            };
            const resp = await apiPost('/api/hopitaux', payload);
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(t('hopitalFormScreen.succes'), t('hopitalFormScreen.etablissementEnregistre'), [{ text: 'OK', onPress: () => { setIsDashboardMode(true); setActiveTab('overview'); handleRefresh(); } }]);
            } else { Alert.alert('Erreur', (resp as any).error || 'Impossible d\'enregistrer'); }
        } catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur'); } finally { setLoading(false); }
    };

    // ─── RENDER: Loading ─────────────────────────────────────────────────
    if (initialLoading) return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#DC2626" /><Text style={s.loadingText}>{t('hopitalForm.chargement')}</Text></View>;

    // ─── RENDER: Overview ────────────────────────────────────────────────
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: t('hopitalFormScreen.prestations') || 'Prestations', value: stats.totalPrestations, icon: 'stethoscope', color: '#DC2626' },
                    { label: t('hopitalForm.creneaux'), value: stats.totalSlots, icon: 'calendar', color: '#3B82F6' },
                    { label: t('hopitalFormScreen.consultations') || 'Consultations', value: consultations.length, icon: 'users', color: '#10B981' },
                    { label: t('hopitalFormScreen.tempsAttente') || 'Temps attente', value: analyticsData?.avg_wait_time_min ? `${analyticsData.avg_wait_time_min}min` : '—', icon: 'clock', color: '#F59E0B' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {/* Quick Actions */}
            <Text style={s.sectionTitle}>{t('hopitalFormScreen.actionsRapides') || 'Actions rapides'}</Text>
            <View style={s.quickRow}>
                {[
                    { label: t('hopitalForm.gererCreneaux'), icon: 'calendar', color: '#3B82F6', onPress: () => setActiveTab('slots') },
                    { label: t('hopitalFormScreen.iaTriage') || 'IA Triage', icon: 'brain', color: '#7C3AED', onPress: () => (navigation as any).navigate('HospitalAIRecommendations', { serviceId }) },
                    { label: t('hopitalFormScreen.statistiques') || 'Statistiques', icon: 'bar-chart-2', color: '#F59E0B', onPress: () => (navigation as any).navigate('HospitalAnalytics', { serviceId }) },
                    { label: t('hopitalForm.monService'), icon: 'settings', color: '#6B7280', onPress: () => setActiveTab('service') },
                    { label: t('common.sortir'), icon: 'log-out', color: '#DC2626', onPress: () => { Alert.alert(t('common.deconnexion'), t('common.confirmDeconnexion'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }]); } },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon as any} size={22} color={a.color} /></View>
                        <Text style={s.quickLabel}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Emergency / Urgences */}
            <View style={[s.emergencyCard, { backgroundColor: formData.urgences_disponible ? '#FEF2F2' : '#F3F4F6' }]}>
                <SafeIcon name="alert-triangle" size={20} color={formData.urgences_disponible ? '#DC2626' : '#6B7280'} />
                <View style={{ flex: 1 }}>
                    <Text style={[s.emergencyTitle, { color: formData.urgences_disponible ? '#DC2626' : '#6B7280' }]}>
                        {formData.urgences_disponible ? t('hopitalFormScreen.urgencesActivees') : t('hopitalFormScreen.urgencesDesactivees')}
                    </Text>
                    <Text style={s.emergencySub}>{formData.rdv_en_ligne ? (t('hopitalFormScreen.rdvEnLigneDisponible') || 'RDV en ligne disponible') : (t('hopitalFormScreen.rdvEnLigneNonDisponible') || 'RDV en ligne non disponible')}</Text>
                </View>
            </View>

            {/* Recent Consultations */}
            {consultations.length > 0 && (
                <>
                    <Text style={s.sectionTitle}>{t('hopitalForm.consultationsRecentes')}</Text>
                    {consultations.slice(0, 3).map((c: any, i: number) => (
                        <View key={i} style={s.consultCard}>
                            <SafeIcon name="user" size={16} color="#6B7280" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.consultName}>{c.patient_name || t('hopitalFormScreen.patient') || 'Patient'}</Text>
                                <Text style={s.consultDetail}>{c.prestation || c.service || '—'} · {c.date ? new Date(c.date).toLocaleDateString('fr-FR') : '—'}</Text>
                            </View>
                            <View style={[s.consultBadge, { backgroundColor: c.status === 'completed' ? '#DCFCE7' : '#FEF3C7' }]}>
                                <Text style={[s.consultBadgeText, { color: c.status === 'completed' ? '#16A34A' : '#D97706' }]}>{c.status === 'completed' ? t('hopitalFormScreen.termine') : (t('hopitalFormScreen.enCours') || 'En cours')}</Text>
                            </View>
                        </View>
                    ))}
                </>
            )}

            {/* Hospital Info */}
            {hospitalData && (
                <>
                    <Text style={[s.sectionTitle, { marginTop: 20 }]}>{t('hopitalFormScreen.informations') || 'Informations'}</Text>
                    {[
                        hospitalData.adresse && { icon: 'map-pin', text: hospitalData.adresse },
                        hospitalData.telephone && { icon: 'phone', text: hospitalData.telephone },
                        hospitalData.type_etablissement && { icon: 'building', text: hospitalData.type_etablissement },
                    ].filter(Boolean).map((info: any, i) => (
                        <View key={i} style={s.infoRow}><SafeIcon name={info.icon} size={16} color="#6B7280" /><Text style={s.infoText}>{info.text}</Text></View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    // ─── RENDER: Service Form ────────────────────────────────────────────
    const renderServiceForm = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            {user?.role !== 'partenaire' && (
                <View style={s.field}><NativeInput label="Nom *" value={formData.nom} onChangeText={t => setFormData({ ...formData, nom: t })} placeholder={t('hopitalForm.exHopitalCentral')} /></View>
            )}
            <Text style={s.label}>{t('hopitalForm.typeDetablissement')}</Text>
            <View style={s.typeRow}>
                {TYPES_ETABLISSEMENT.map(t => (
                    <TouchableOpacity key={t.key} style={[s.typeBtn, formData.type_etablissement === t.key && s.typeBtnOn]} onPress={() => setFormData({ ...formData, type_etablissement: t.key })}>
                        <SafeIcon name={t.icon as any} size={16} color={formData.type_etablissement === t.key ? '#fff' : '#6B7280'} />
                        <Text style={[s.typeText, formData.type_etablissement === t.key && s.typeTextOn]}>{t.key}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={s.field}>
                <TouchableOpacity style={s.gpsBtn} onPress={() => setShowGPSModal(true)}>
                    <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                    <Text style={s.gpsBtnText}>{selectedGPS ? t('hopitalFormScreen.gpsSelectionne') : t('hopitalFormScreen.selectionnerSurLaCarte')}</Text>
                    <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
            {user?.role !== 'partenaire' && (
                <View style={s.field}><NativeInput label="Adresse" value={formData.adresse} onChangeText={t => setFormData({ ...formData, adresse: t })} placeholder={t('hopitalForm.adresseComplete')} multiline /></View>
            )}
            <View style={s.field}>
                <LocationSelector label={t('hopitalForm.quartier')} value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''} onSelect={(loc: LocationObject) => setFormData({ ...formData, quartier: loc })} placeholder={t('hopitalForm.rechercher')} scope="all" enrichWithBackend />
            </View>
            <View style={s.switchRow}><View><Text style={s.switchLbl}>{t('hopitalFormScreen.urgencesDisponibles') || 'Urgences disponibles'}</Text><Text style={s.hint}>{t('hopitalFormScreen.activeLeServiceDurgences') || 'Active le service d\'urgences'}</Text></View><Switch value={formData.urgences_disponible} onValueChange={v => setFormData({ ...formData, urgences_disponible: v })} trackColor={{ false: '#D1D5DB', true: '#DC2626' }} /></View>
            <View style={s.switchRow}><View><Text style={s.switchLbl}>{t('hopitalFormScreen.rdvEnLigne') || 'RDV en ligne'}</Text><Text style={s.hint}>{t('hopitalFormScreen.permetLesPrisesDeRdv') || 'Permet les prises de RDV'}</Text></View><Switch value={formData.rdv_en_ligne} onValueChange={v => setFormData({ ...formData, rdv_en_ligne: v })} trackColor={{ false: '#D1D5DB', true: modernColors.primary }} /></View>
            {user?.role !== 'partenaire' && (
                <>
                    <View style={s.field}><NativeInput label={t('hopitalForm.telephone')} value={formData.telephone} onChangeText={t => setFormData({ ...formData, telephone: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Urgence" value={formData.telephone_urgence} onChangeText={t => setFormData({ ...formData, telephone_urgence: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="WhatsApp" value={formData.whatsapp} onChangeText={t => setFormData({ ...formData, whatsapp: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Email" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} placeholder="hopital@example.com" keyboardType="email-address" autoCapitalize="none" /></View>
                    <View style={s.field}><NativeInput label="Site web" value={formData.site_web} onChangeText={t => setFormData({ ...formData, site_web: t })} placeholder="https://..." autoCapitalize="none" /></View>
                </>
            )}
            <NativeButton title={loading ? (t('hopitalFormScreen.enregistrement') || 'Enregistrement...') : (isDashboardMode ? t('hopitalFormScreen.mettreAJour') : (t('hopitalFormScreen.enregistrer') || 'Enregistrer'))} onPress={handleSubmit} disabled={loading || !formData.nom.trim()} variant="primary" size="large" style={{ marginTop: 24 }} />
        </ScrollView>
    );

    // ─── RENDER: Slots/Prestations Tab ───────────────────────────────────
    const renderSlotsTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            {/* Stats */}
            <View style={s.slotStats}>
                <View style={s.slotStatItem}><Text style={s.slotStatVal}>{stats.totalPrestations}</Text><Text style={s.slotStatLbl}>{t('hopitalFormScreen.prestations') || 'Prestations'}</Text></View>
                <View style={s.slotStatDiv} />
                <View style={s.slotStatItem}><Text style={s.slotStatVal}>{stats.totalSlots}</Text><Text style={s.slotStatLbl}>{t('hopitalForm.creneaux')}</Text></View>
                <View style={s.slotStatDiv} />
                <View style={s.slotStatItem}><Text style={s.slotStatVal}>{stats.withSlots}</Text><Text style={s.slotStatLbl}>{t('hopitalFormScreen.avecPlanning') || 'Avec planning'}</Text></View>
            </View>
            <PrestationSelectorWithSchedule
                label={t('hopitalForm.prestationsMedicalesPlanning')}
                options={PRESTATIONS_OPTIONS}
                selected={prestationsWithSchedule}
                onSelectionChange={setPrestationsWithSchedule}
                allowCustom
                placeholder={t('hopitalForm.ajouterUnePrestation')}
            />
        </ScrollView>
    );

    // ─── RENDER: Analytics Tab ───────────────────────────────────────────
    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="bar-chart-2" size={22} color="#DC2626" /><Text style={s.analyticsTitle}>{t('hopitalForm.activite')}</Text></View>
                {analyticsData ? (
                    <View style={{ gap: 12 }}>
                        {[
                            { l: t('hopitalFormScreen.consultationsTotales') || 'Consultations totales', v: analyticsData.total_consultations || 0 },
                            { l: t('hopitalFormScreen.consultations7j') || 'Consultations (7j)', v: analyticsData.consultations_7d || 0 },
                            { l: t('hopitalFormScreen.tempsAttenteMoyen') || 'Temps attente moyen', v: analyticsData.avg_wait_time_min ? `${analyticsData.avg_wait_time_min} min` : '—' },
                            { l: t('hopitalFormScreen.tauxOccupation') || 'Taux occupation', v: analyticsData.occupancy_rate ? `${Math.round(analyticsData.occupancy_rate * 100)}%` : '—', c: '#10B981' },
                        ].map((r, i) => (
                            <View key={i} style={s.analyticsRow}><Text style={s.analyticsLbl}>{r.l}</Text><Text style={[s.analyticsVal, r.c ? { color: r.c } : {}]}>{r.v}</Text></View>
                        ))}
                    </View>
                ) : <Text style={s.analyticsEmpty}>{t('hopitalForm.statistiquesDisponiblesApresLesPremieres')}</Text>}
            </View>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="sparkles" size={22} color="#F59E0B" /><Text style={s.analyticsTitle}>{t('hopitalFormScreen.intelligenceArtificielle') || 'Intelligence Artificielle'}</Text></View>
                <Text style={s.analyticsEmpty}>{t('hopitalFormScreen.triageIaDescription') || 'Triage IA, recommandations et recherche par pathologie disponibles.'}</Text>
                <NativeButton title={t('hopitalFormScreen.iaTriage') || 'Triage IA'} onPress={() => (navigation as any).navigate('HospitalAIRecommendations')} style={{ marginTop: 12, backgroundColor: '#F59E0B' }} />
            </View>
        </ScrollView>
    );

    // ─── RENDER: Dashboard Mode ──────────────────────────────────────────
    if (isDashboardMode || (user?.role === 'partenaire' && serviceId)) {
        const tabs: { key: TabType; label: string; icon: string }[] = [
            { key: 'overview', label: t('hopitalForm.accueil'), icon: 'layout-dashboard' },
            { key: 'service', label: t('hopitalFormScreen.service') || 'Service', icon: 'settings' },
            { key: 'slots', label: t('hopitalForm.creneaux'), icon: 'calendar' },
            { key: 'analytics', label: t('hopitalFormScreen.stats') || 'Stats', icon: 'bar-chart-2' },
            { key: 'team', label: t('hopitalForm.equipe'), icon: 'users' },
        ];
        return (
            <View style={s.container}>
                <LinearGradient colors={['#991B1B', '#DC2626']} style={s.dashHeader}>
                    <View style={s.dashHeaderRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={s.dashTitle}>{hospitalData?.nom || formData.nom || t('hopitalForm.monEtablissement')}</Text>
                            <Text style={s.dashSub}>{formData.type_etablissement} · {stats.totalPrestations} prestation{stats.totalPrestations > 1 ? 's' : ''}</Text>
                        </View>
                    </View>
                    <View style={s.tabsRow}>{tabs.map(t => (
                        <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabOn]} onPress={() => setActiveTab(t.key)}>
                            <SafeIcon name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : '#ffffff70'} />
                            <Text style={[s.tabText, activeTab === t.key && s.tabTextOn]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}</View>
                </LinearGradient>
                <View style={s.dashContent}>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'service' && renderServiceForm()}
                    {activeTab === 'slots' && renderSlotsTab()}
                    {activeTab === 'analytics' && renderAnalytics()}
                    {activeTab === 'team' && <ServiceTeamManager serviceId={serviceId?.toString()} onClose={() => setActiveTab('overview')} />}
                </View>
                <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
            </View>
        );
    }

    // ─── RENDER: Creation Mode ───────────────────────────────────────────
    return (
        <View style={s.container}>
            <LinearGradient colors={['#991B1B', '#DC2626']} style={s.createHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                <Text style={s.createTitle}>{t('hopitalForm.enregistrerUnEtablissement')}</Text>
            </LinearGradient>
            {renderServiceForm()}
            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
        </View>
    );
};

// ─── STYLES ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 12, fontSize: 15, color: '#6B7280', fontWeight: '500' },
    dashHeader: { paddingTop: 50, paddingBottom: 8, paddingHorizontal: 16 },
    dashHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    backBtn: { marginRight: 12, padding: 4 },
    dashTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    dashSub: { fontSize: 13, color: '#ffffffCC', marginTop: 2 },
    dashContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
    createHeader: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    createTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    tabsRow: { flexDirection: 'row', gap: 4, paddingBottom: 8 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ffffff15' },
    tabOn: { backgroundColor: '#ffffff30' },
    tabText: { fontSize: 11, color: '#ffffff70', fontWeight: '500' },
    tabTextOn: { color: '#fff', fontWeight: '700' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    emergencyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, marginBottom: 20 },
    emergencyTitle: { fontSize: 15, fontWeight: '600' },
    emergencySub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    consultCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    consultName: { fontSize: 14, fontWeight: '600', color: '#111827' },
    consultDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    consultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    consultBadgeText: { fontSize: 11, fontWeight: '600' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    infoText: { fontSize: 14, color: '#374151' },
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    hint: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingVertical: 6 },
    switchLbl: { fontSize: 14, color: '#374151', fontWeight: '500' },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    typeBtnOn: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
    typeText: { fontSize: 13, fontWeight: '500', color: '#374151' },
    typeTextOn: { color: '#fff', fontWeight: '700' },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, gap: 12 },
    gpsBtnText: { flex: 1, fontSize: 14, color: '#111827' },
    slotStats: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, marginBottom: 16 },
    slotStatItem: { flex: 1, alignItems: 'center' },
    slotStatVal: { fontSize: 18, fontWeight: '700', color: '#DC2626' },
    slotStatLbl: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    slotStatDiv: { width: 1, height: 36, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
    analyticsHdr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    analyticsTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    analyticsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsLbl: { fontSize: 14, color: '#6B7280' },
    analyticsVal: { fontSize: 16, fontWeight: '700', color: '#111827' },
    analyticsEmpty: { fontSize: 14, color: '#6B7280', fontStyle: 'italic', lineHeight: 20 },
});

export default HopitalFormScreen;
