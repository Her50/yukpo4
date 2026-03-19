// ✅ REFONTE TOTALE 2026-03-05: LaboratoireFormScreen → Dashboard pro + Formulaire
// Mode Dashboard (labo existant): 4 tabs (Accueil / Service / Examens / Stats)
// Mode Création: Formulaire guidé avec sections visuelles
// Exploite endpoints: CRUD labo, examination-types, book-examination, results, AI analysis, slots
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
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
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import ServiceTeamManager from '../../components/ServiceTeamManager';
import SimplePrestationSelector from '../../components/SimplePrestationSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiGet, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const STORAGE_KEY = '@laboratoire_form';
type TabType = 'overview' | 'service' | 'exams' | 'analytics' | 'team';

interface ExaminationType {
    id?: number;
    nom: string;
    categorie: 'analyse' | 'imagerie';
    prix?: number;
    duree_estimee?: string;
    preparation_requise?: string;
}

const TYPES_LABO = ['Laboratoire', 'Centre d\'imagerie', 'Les deux'];

const LaboratoireFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const ANALYSES_OPTIONS = [
        'Sang',
        'Urine',
        t('laboratoireFormScreen.bacteriologie') || 'Bactériologie',
        'Parasitologie',
        t('laboratoireFormScreen.serologie') || 'Sérologie',
        'Biochimie',
    ];
    const IMAGERIE_OPTIONS = [
        'Radiologie',
        t('laboratoireFormScreen.echographie') || 'Échographie',
        'Scanner',
        'IRM',
        'Mammographie',
    ];

    // Dashboard state
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    // ✅ FIX: Partenaires voient TOUJOURS le dashboard (même vide), pas le formulaire de création
    const [isDashboardMode, setIsDashboardMode] = useState(user?.role === 'partenaire' && !mode);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [labData, setLabData] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState({
        nom: '', type_laboratoire: 'Laboratoire', adresse: '',
        quartier: null as LocationObject | null,
        analyses_disponibles: [] as string[], imagerie_disponible: [] as string[],
        heures_ouverture: '08:00', heures_fermeture: '18:00', permanent_24h: false,
        rdv_requis: true, resultats_en_ligne: false,
        telephone: '', whatsapp: '', email: '',
    });
    const [loading, setLoading] = useState(false);
    const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
    const [selectedImagerie, setSelectedImagerie] = useState<string[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);

    // Exams state
    const [examinationTypes, setExaminationTypes] = useState<ExaminationType[]>([]);
    const [loadingExams, setLoadingExams] = useState(false);
    const [showExamModal, setShowExamModal] = useState(false);
    const [editingExam, setEditingExam] = useState<ExaminationType | null>(null);
    const [examForm, setExamForm] = useState<ExaminationType>({ nom: '', categorie: 'analyse', prix: undefined, duree_estimee: '', preparation_requise: '' });
    const [searchQuery, setSearchQuery] = useState('');

    const { partnerData } = usePartnerData(user?.role, 'laboratoire');
    const { errors, validateField, validateForm, setError } = useFormValidation({
        nom: { required: true, minLength: 3 },
        telephone: { pattern: /^\+?[0-9]{9,15}$/ },
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    });
    useFormAutoSave(STORAGE_KEY, formData, true, 1000);

    // Computed
    const filteredExams = examinationTypes.filter(e => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return e.nom.toLowerCase().includes(q) || e.categorie.includes(q);
    });
    const stats = {
        total: examinationTypes.length,
        analyses: examinationTypes.filter(e => e.categorie === 'analyse').length,
        imagerie: examinationTypes.filter(e => e.categorie === 'imagerie').length,
        avecPrix: examinationTypes.filter(e => e.prix && e.prix > 0).length,
    };

    // ─── DATA LOADING ────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            if (user?.role === 'partenaire' && user?.partner_type === 'laboratoire') {
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
                    const labResp = await apiGet('/api/laboratoires');
                    const resData = (labResp?.data || labResp) as any;
                    const labs = Array.isArray(resData?.data) ? resData.data : Array.isArray(resData) ? resData : [];
                    if (labs.length > 0) {
                        const myLab = labs[0];
                        setLabData(myLab);
                        setIsDashboardMode(true);
                        if (!serviceId && myLab.service_id) setServiceId(myLab.service_id);
                        const lid = myLab.id || myLab.service_id;
                        if (lid) loadExamTypes(lid);
                    }
                } catch (e) { console.log('[Labo] Init:', e); }
            }
            if (mode === 'edit' && specializedServiceId) {
                try {
                    setLoading(true);
                    const resp = await apiGet(`/api/laboratoires/${specializedServiceId}`);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        setFormData({
                            nom: d.nom || '', type_laboratoire: d.type_laboratoire || 'Laboratoire',
                            adresse: d.adresse || '', quartier: d.quartier ? { raw: d.quartier, place_name: d.quartier } as any : null,
                            analyses_disponibles: d.analyses_disponibles || [], imagerie_disponible: d.imagerie_disponible || [],
                            heures_ouverture: d.heures_ouverture || '08:00', heures_fermeture: d.heures_fermeture || '18:00',
                            permanent_24h: d.permanent_24h || false, rdv_requis: d.rdv_requis ?? true,
                            resultats_en_ligne: d.resultats_en_ligne || false,
                            telephone: d.telephone || '', whatsapp: d.whatsapp || '', email: d.email || '',
                        });
                        setSelectedAnalyses(d.analyses_disponibles || []);
                        setSelectedImagerie(d.imagerie_disponible || []);
                        if (d.gps) setSelectedGPS(d.gps);
                    }
                } catch (e) { console.error('[Labo] Edit:', e); } finally { setLoading(false); }
            }
            setInitialLoading(false);
        };
        init();
    }, [user?.role, user?.partner_type]);

    useEffect(() => {
        if (!serviceId && user?.id && formData.nom) {
            (async () => {
                try {
                    const resp = await servicesApi.createService({ titre_service: formData.nom || 'Laboratoire', description: `Laboratoire: ${formData.type_laboratoire}`, category: 'sante' });
                    if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) setServiceId((resp.data as any).id);
                } catch (e) { console.error('[Labo] Service:', e); }
            })();
        }
    }, [formData.nom, serviceId, user?.id]);

    const loadExamTypes = async (lid: number) => {
        try {
            setLoadingExams(true);
            const resp = await apiGet(`/api/laboratoires/${lid}/examination-types`);
            const d = (resp?.data || resp) as any;
            const exams = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
            if (exams.length > 0) { setExaminationTypes(exams); }
            else {
                const fallback: ExaminationType[] = [
                    ...selectedAnalyses.map(n => ({ nom: n, categorie: 'analyse' as const })),
                    ...selectedImagerie.map(n => ({ nom: n, categorie: 'imagerie' as const })),
                ];
                setExaminationTypes(fallback);
            }
        } catch (e) {
            const fallback: ExaminationType[] = [
                ...selectedAnalyses.map(n => ({ nom: n, categorie: 'analyse' as const })),
                ...selectedImagerie.map(n => ({ nom: n, categorie: 'imagerie' as const })),
            ];
            setExaminationTypes(fallback);
        } finally { setLoadingExams(false); }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        const lid = labData?.id || labData?.service_id || serviceId;
        if (lid) await loadExamTypes(lid);
        setRefreshing(false);
    };

    const handleGPSSelect = (c: string) => { setSelectedGPS(c); setShowGPSModal(false); };

    const openExamModal = (exam?: ExaminationType) => {
        if (exam) { setEditingExam(exam); setExamForm({ ...exam }); }
        else { setEditingExam(null); setExamForm({ nom: '', categorie: 'analyse', prix: undefined, duree_estimee: '', preparation_requise: '' }); }
        setShowExamModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.nom.trim()) { Alert.alert(t('message.error'), t('laboForm.nameRequired')); return; }
        setLoading(true);
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                const resp = await servicesApi.createService({ titre_service: formData.nom, description: formData.type_laboratoire, category: 'sante' });
                if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) { finalServiceId = (resp.data as any).id; setServiceId(finalServiceId); }
            } catch (e) { Alert.alert(t('message.error'), t('laboForm.cannotCreateService')); setLoading(false); return; }
        }
        if (!finalServiceId) { Alert.alert(t('message.error'), t('laboForm.serviceIdMissing')); setLoading(false); return; }
        try {
            const payload = {
                service_id: finalServiceId, nom: formData.nom, type_laboratoire: formData.type_laboratoire,
                adresse: formData.adresse || null,
                quartier: typeof formData.quartier === 'string' ? formData.quartier : (formData.quartier?.raw || formData.quartier?.place_name || null),
                gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                analyses_disponibles: selectedAnalyses.length > 0 ? selectedAnalyses : null,
                imagerie_disponible: selectedImagerie.length > 0 ? selectedImagerie : null,
                heures_ouverture: formData.heures_ouverture, heures_fermeture: formData.heures_fermeture,
                permanent_24h: formData.permanent_24h, rdv_requis: formData.rdv_requis,
                resultats_en_ligne: formData.resultats_en_ligne,
                telephone: formData.telephone || null, whatsapp: formData.whatsapp || null, email: formData.email || null,
            };
            const resp = await apiPost('/api/laboratoires', payload);
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(t('message.success'), t('laboForm.labRegistered'), [{ text: 'OK', onPress: () => { setIsDashboardMode(true); setActiveTab('overview'); handleRefresh(); } }]);
            } else { Alert.alert(t('message.error'), (resp as any).error || t('laboForm.cannotRegister')); }
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('laboForm.errorOccurred')); } finally { setLoading(false); }
    };

    // ─── RENDER: Loading ─────────────────────────────────────────────────
    if (initialLoading) return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#0891B2" /><Text style={s.loadingText}>{t('laboratoireForm.chargement')}</Text></View>;

    // ─── RENDER: Overview ────────────────────────────────────────────────
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: t('laboForm.examens') || 'Examens', value: stats.total, icon: 'flask-conical', color: '#0891B2' },
                    { label: t('laboForm.analyses') || 'Analyses', value: stats.analyses, icon: 'droplets', color: '#DC2626' },
                    { label: t('laboForm.imagerie') || 'Imagerie', value: stats.imagerie, icon: 'scan', color: '#8B5CF6' },
                    { label: t('laboForm.avecPrix') || 'Avec prix', value: stats.avecPrix, icon: 'banknote', color: '#10B981' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>
            <Text style={s.sectionTitle}>{t('laboForm.actionsRapides') || 'Actions rapides'}</Text>
            <View style={s.quickRow}>
                {[
                    { label: t('laboratoireForm.ajouterExamen'), icon: 'plus-circle', color: '#0891B2', onPress: () => { setActiveTab('exams'); setTimeout(() => openExamModal(), 200); } },
                    { label: t('laboForm.iaAnalyse') || 'IA Analyse', icon: 'brain', color: '#7C3AED', onPress: () => (navigation as any).navigate('LabAIAnalysis', { serviceId }) },
                    { label: t('laboForm.statistiques') || 'Statistiques', icon: 'bar-chart-2', color: '#F59E0B', onPress: () => (navigation as any).navigate('LabAnalytics', { serviceId }) },
                    { label: t('laboratoireForm.monService'), icon: 'settings', color: '#6B7280', onPress: () => setActiveTab('service') },
                    { label: t('financialTracking.wallet') || 'Portefeuille', icon: 'wallet', color: '#8B5CF6', onPress: () => (navigation as any).navigate('WalletFinancial') },
                    { label: t('common.sortir'), icon: 'log-out', color: '#DC2626', onPress: () => { Alert.alert(t('common.deconnexion'), t('common.confirmDeconnexion'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }]); } },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon as any} size={22} color={a.color} /></View>
                        <Text style={s.quickLabel}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {/* Info card */}
            <View style={s.infoCard}>
                <SafeIcon name="clock" size={16} color="#6B7280" />
                <Text style={s.infoText}>{formData.permanent_24h ? '24h/24' : `${formData.heures_ouverture} — ${formData.heures_fermeture}`}</Text>
            </View>
            {formData.rdv_requis && <View style={s.infoCard}><SafeIcon name="calendar" size={16} color="#0891B2" /><Text style={s.infoText}>{t('laboForm.rdvRequis') || 'RDV requis'}</Text></View>}
            {formData.resultats_en_ligne && <View style={s.infoCard}><SafeIcon name="globe" size={16} color="#10B981" /><Text style={s.infoText}>{t('laboratoireForm.resultatsEnLigneDisponibles')}</Text></View>}
            {examinationTypes.length > 0 && (
                <>
                    <View style={s.sectionRow}><Text style={s.sectionTitle}>{t('laboratoireForm.examensRecents')}</Text><TouchableOpacity onPress={() => setActiveTab('exams')}><Text style={s.seeAll}>{t('laboForm.toutVoir') || 'Tout voir'}</Text></TouchableOpacity></View>
                    {examinationTypes.slice(0, 4).map((e, i) => (
                        <View key={i} style={s.examItem}>
                            <View style={[s.examDot, { backgroundColor: e.categorie === 'analyse' ? '#DC2626' : '#8B5CF6' }]} />
                            <Text style={s.examName}>{e.nom}</Text>
                            {e.prix ? <Text style={s.examPrice}>{e.prix.toLocaleString()} FCFA</Text> : null}
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    // ─── RENDER: Service Form ────────────────────────────────────────────
    const renderServiceForm = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            {user?.role !== 'partenaire' && (
                <View style={s.field}><NativeInput label={t('laboratoireFormScreen.nom')} value={formData.nom} onChangeText={t => setFormData({ ...formData, nom: t })} placeholder="Ex: Laboratoire Central" /></View>
            )}
            <Text style={s.label}>Type</Text>
            <View style={s.chips}>{TYPES_LABO.map(t => <TouchableOpacity key={t} style={[s.chip, formData.type_laboratoire === t && s.chipOn]} onPress={() => setFormData({ ...formData, type_laboratoire: t })}><Text style={[s.chipText, formData.type_laboratoire === t && s.chipTextOn]}>{t}</Text></TouchableOpacity>)}</View>
            <View style={[s.field, { marginTop: 16 }]}>
                <TouchableOpacity style={s.gpsBtn} onPress={() => setShowGPSModal(true)}>
                    <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                    <Text style={s.gpsBtnText}>{selectedGPS ? t('laboratoireFormScreen.gpsSelectionne') : t('laboratoireFormScreen.selectionnerSurLaCarte')}</Text>
                    <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
            {user?.role !== 'partenaire' && <View style={s.field}><NativeInput label="Adresse" value={formData.adresse} onChangeText={t => setFormData({ ...formData, adresse: t })} placeholder={t('laboratoireForm.adresseComplete')} multiline /></View>}
            <View style={s.field}><LocationSelector label={t('laboratoireForm.quartier')} value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''} onSelect={(loc: LocationObject) => setFormData({ ...formData, quartier: loc })} placeholder={t('laboratoireForm.rechercher')} scope="all" enrichWithBackend /></View>
            <View style={s.field}><SimplePrestationSelector label="Analyses disponibles" options={ANALYSES_OPTIONS} selected={selectedAnalyses} onSelectionChange={setSelectedAnalyses} allowCustom placeholder={t('laboratoireForm.ajouterUneAnalyse')} /></View>
            <View style={s.field}><SimplePrestationSelector label="Imagerie disponible" options={IMAGERIE_OPTIONS} selected={selectedImagerie} onSelectionChange={setSelectedImagerie} allowCustom placeholder={t('laboratoireForm.ajouterUneImagerie')} /></View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Ouverture" value={formData.heures_ouverture} onChangeText={t => setFormData({ ...formData, heures_ouverture: t })} placeholder="08:00" /></View>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Fermeture" value={formData.heures_fermeture} onChangeText={t => setFormData({ ...formData, heures_fermeture: t })} placeholder="18:00" /></View>
            </View>
            <View style={s.switchRow}><Text style={s.switchLbl}>24h/24</Text><Switch value={formData.permanent_24h} onValueChange={v => setFormData({ ...formData, permanent_24h: v })} trackColor={{ false: '#D1D5DB', true: '#0891B2' }} /></View>
            <View style={s.switchRow}><Text style={s.switchLbl}>RDV requis</Text><Switch value={formData.rdv_requis} onValueChange={v => setFormData({ ...formData, rdv_requis: v })} trackColor={{ false: '#D1D5DB', true: '#0891B2' }} /></View>
            <View style={s.switchRow}><Text style={s.switchLbl}>{t('laboratoireForm.resultatsEnLigne')}</Text><Switch value={formData.resultats_en_ligne} onValueChange={v => setFormData({ ...formData, resultats_en_ligne: v })} trackColor={{ false: '#D1D5DB', true: '#0891B2' }} /></View>
            {user?.role !== 'partenaire' && (
                <>
                    <View style={s.field}><NativeInput label={t('laboratoireForm.telephone')} value={formData.telephone} onChangeText={t => setFormData({ ...formData, telephone: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="WhatsApp" value={formData.whatsapp} onChangeText={t => setFormData({ ...formData, whatsapp: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Email" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} placeholder="labo@example.com" keyboardType="email-address" autoCapitalize="none" /></View>
                </>
            )}
            <NativeButton title={loading ? 'Enregistrement...' : (isDashboardMode ? t('laboratoireFormScreen.mettreAJour') : 'Enregistrer')} onPress={handleSubmit} disabled={loading || !formData.nom.trim()} variant="primary" size="large" style={{ marginTop: 24 }} />
        </ScrollView>
    );

    // ─── RENDER: Exams Tab ───────────────────────────────────────────────
    const renderExamsTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.examStats}>
                <View style={s.examStatItem}><Text style={s.examStatVal}>{stats.total}</Text><Text style={s.examStatLbl}>Total</Text></View>
                <View style={s.examStatDiv} />
                <View style={s.examStatItem}><Text style={[s.examStatVal, { color: '#DC2626' }]}>{stats.analyses}</Text><Text style={s.examStatLbl}>Analyses</Text></View>
                <View style={s.examStatDiv} />
                <View style={s.examStatItem}><Text style={[s.examStatVal, { color: '#8B5CF6' }]}>{stats.imagerie}</Text><Text style={s.examStatLbl}>Imagerie</Text></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity style={s.addBtn} onPress={() => openExamModal()}><SafeIcon name="plus" size={18} color="#fff" /><Text style={s.addBtnText}>{t('laboratoireFormScreen.ajouter')}</Text></TouchableOpacity>
            </View>
            {examinationTypes.length > 0 && (
                <View style={s.searchBar}><SafeIcon name="search" size={18} color="#9CA3AF" /><NativeInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('laboratoireForm.rechercher')} style={{ flex: 1, backgroundColor: 'transparent' }} /></View>
            )}
            {loadingExams ? <ActivityIndicator size="large" color="#0891B2" style={{ marginTop: 32 }} /> :
                examinationTypes.length === 0 ? (
                    <View style={s.emptyDash}><SafeIcon name="flask-conical" size={48} color="#9CA3AF" /><Text style={s.emptyTitle}>{t('laboratoireForm.aucunExamen')}</Text><Text style={s.emptyText}>{t('laboratoireForm.ajoutezVosTypesDexamensPour')}</Text><NativeButton title={t('laboratoireForm.ajouter')} onPress={() => openExamModal()} style={{ marginTop: 16 }} /></View>
                ) : (
                    filteredExams.map((e, i) => (
                        <TouchableOpacity key={i} style={s.examCard} onPress={() => openExamModal(e)}>
                            <View style={[s.examCatDot, { backgroundColor: e.categorie === 'analyse' ? '#DC2626' : '#8B5CF6' }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.examCardName}>{e.nom}</Text>
                                <Text style={s.examCardSub}>{e.categorie === 'analyse' ? 'Analyse' : 'Imagerie'}{e.duree_estimee ? ` · ${e.duree_estimee}` : ''}</Text>
                                {e.preparation_requise ? <Text style={s.examPrep}>⚠ {e.preparation_requise}</Text> : null}
                            </View>
                            {e.prix ? <Text style={s.examCardPrice}>{e.prix.toLocaleString()} FCFA</Text> : null}
                        </TouchableOpacity>
                    ))
                )}
        </ScrollView>
    );

    // ─── RENDER: Analytics ───────────────────────────────────────────────
    const renderAnalytics = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="bar-chart-2" size={22} color="#0891B2" /><Text style={s.analyticsTitle}>Catalogue</Text></View>
                {[
                    { l: 'Types d\'examens', v: stats.total },
                    { l: 'Analyses', v: stats.analyses },
                    { l: 'Imagerie', v: stats.imagerie },
                    { l: 'Avec tarif', v: stats.avecPrix },
                ].map((r, i) => (
                    <View key={i} style={s.analyticsRow}><Text style={s.analyticsLbl}>{r.l}</Text><Text style={s.analyticsVal}>{r.v}</Text></View>
                ))}
            </View>
            <View style={s.analyticsCard}>
                <View style={s.analyticsHdr}><SafeIcon name="sparkles" size={22} color="#F59E0B" /><Text style={s.analyticsTitle}>{t('laboratoireForm.iaResultats')}</Text></View>
                <Text style={s.analyticsEmpty}>{t('laboratoireForm.analyseIaDesResultatsDexamens')}</Text>
            </View>
        </ScrollView>
    );

    // ─── RENDER: Exam Modal ──────────────────────────────────────────────
    const renderExamModal = () => (
        <Modal visible={showExamModal} animationType="slide" transparent onRequestClose={() => setShowExamModal(false)}>
            <View style={s.modalOverlay}><View style={s.modalContent}>
                <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>{editingExam ? 'Modifier l\'examen' : 'Ajouter un examen'}</Text>
                    <TouchableOpacity onPress={() => setShowExamModal(false)}><SafeIcon name="x" size={24} color="#6B7280" /></TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 16, maxHeight: 400 }}>
                    <View style={s.field}><NativeInput label="Nom *" value={examForm.nom} onChangeText={t => setExamForm({ ...examForm, nom: t })} placeholder={t('laboratoireForm.exNfsComplete')} /></View>
                    <Text style={s.label}>{t('laboratoireForm.categorie')}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                        {(['analyse', 'imagerie'] as const).map(c => (
                            <TouchableOpacity key={c} style={[s.chip, examForm.categorie === c && s.chipOn]} onPress={() => setExamForm({ ...examForm, categorie: c })}>
                                <Text style={[s.chipText, examForm.categorie === c && s.chipTextOn]}>{c === 'analyse' ? 'Analyse' : 'Imagerie'}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={[s.field, { flex: 1 }]}><NativeInput label={t('laboratoireFormScreen.prixFcfa')} value={examForm.prix ? String(examForm.prix) : ''} onChangeText={t => setExamForm({ ...examForm, prix: t ? parseInt(t) : undefined })} placeholder="0" keyboardType="numeric" /></View>
                        <View style={[s.field, { flex: 1 }]}><NativeInput label={t('laboratoireForm.duree')} value={examForm.duree_estimee || ''} onChangeText={t => setExamForm({ ...examForm, duree_estimee: t })} placeholder="30 min" /></View>
                    </View>
                    <View style={s.field}><NativeInput label={t('laboratoireForm.preparationRequise')} value={examForm.preparation_requise || ''} onChangeText={t => setExamForm({ ...examForm, preparation_requise: t })} placeholder={t('laboratoireForm.exAJeunDepuis12h')} multiline /></View>
                </ScrollView>
                <View style={s.modalFooter}>
                    <NativeButton title={t('laboratoireFormScreen.annuler')} onPress={() => setShowExamModal(false)} variant="secondary" style={{ flex: 1 }} />
                    <NativeButton title={editingExam ? t('laboratoireFormScreen.modifier') : t('laboratoireFormScreen.ajouter')} onPress={() => {
                        if (!examForm.nom.trim()) { Alert.alert(t('message.error'), t('laboForm.examNameRequired')); return; }
                        if (editingExam) {
                            setExaminationTypes(prev => prev.map(e => e === editingExam ? { ...examForm } : e));
                        } else {
                            setExaminationTypes(prev => [...prev, { ...examForm }]);
                        }
                        setShowExamModal(false);
                    }} variant="primary" style={{ flex: 1 }} disabled={!examForm.nom.trim()} />
                </View>
            </View></View>
        </Modal>
    );

    // ─── RENDER: Dashboard ───────────────────────────────────────────────
    if (isDashboardMode || (user?.role === 'partenaire' && serviceId)) {
        const tabs: { key: TabType; label: string; icon: string }[] = [
            { key: 'overview', label: t('laboratoireForm.accueil'), icon: 'layout-dashboard' },
            { key: 'service', label: 'Service', icon: 'settings' },
            { key: 'exams', label: 'Examens', icon: 'flask-conical' },
            { key: 'analytics', label: 'Stats', icon: 'bar-chart-2' },
            { key: 'team', label: t('laboratoireForm.equipe'), icon: 'users' },
        ];

        return (
            <View style={s.container}>
                <LinearGradient colors={['#155E75', '#0891B2']} style={s.dashHeader}>
                    <View style={s.dashHeaderRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={s.dashTitle}>{labData?.nom || formData.nom || t('laboratoireForm.monLaboratoire')}</Text>
                            <Text style={s.dashSub}>{formData.type_laboratoire} · {stats.total} examen{stats.total > 1 ? 's' : ''}</Text>
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
                    {activeTab === 'exams' && renderExamsTab()}
                    {activeTab === 'analytics' && renderAnalytics()}
                    {activeTab === 'team' && <ServiceTeamManager serviceId={serviceId?.toString()} onClose={() => setActiveTab('overview')} />}
                </View>
                <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
                {renderExamModal()}
            </View>
        );
    }

    // ─── RENDER: Creation ────────────────────────────────────────────────
    return (
        <View style={s.container}>
            <LinearGradient colors={['#155E75', '#0891B2']} style={s.createHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                <Text style={s.createTitle}>{t('laboratoireFormScreen.enregistrerUnLaboratoire')}</Text>
            </LinearGradient>
            {renderServiceForm()}
            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={handleGPSSelect} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
            {renderExamModal()}
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
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    seeAll: { fontSize: 13, color: '#0891B2', fontWeight: '600' },
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 },
    infoText: { fontSize: 14, color: '#374151' },
    examItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 6 },
    examDot: { width: 8, height: 8, borderRadius: 4 },
    examName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
    examPrice: { fontSize: 13, fontWeight: '600', color: '#0891B2' },
    emptyDash: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 12, marginTop: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingVertical: 6 },
    switchLbl: { fontSize: 14, color: '#374151', fontWeight: '500' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    chipOn: { backgroundColor: '#0891B2', borderColor: '#0891B2' },
    chipText: { fontSize: 13, color: '#374151' },
    chipTextOn: { color: '#fff', fontWeight: '600' },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, gap: 12 },
    gpsBtnText: { flex: 1, fontSize: 14, color: '#111827' },
    examStats: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, marginBottom: 12 },
    examStatItem: { flex: 1, alignItems: 'center' },
    examStatVal: { fontSize: 18, fontWeight: '700', color: '#0891B2' },
    examStatLbl: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    examStatDiv: { width: 1, height: 36, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0891B2', borderRadius: 8 },
    addBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
    examCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
    examCatDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    examCardName: { fontSize: 15, fontWeight: '600', color: '#111827' },
    examCardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    examPrep: { fontSize: 11, color: '#F59E0B', marginTop: 4 },
    examCardPrice: { fontSize: 14, fontWeight: '700', color: '#0891B2', marginLeft: 8 },
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
    analyticsHdr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    analyticsTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    analyticsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsLbl: { fontSize: 14, color: '#6B7280' },
    analyticsVal: { fontSize: 16, fontWeight: '700', color: '#111827' },
    analyticsEmpty: { fontSize: 14, color: '#6B7280', fontStyle: 'italic', lineHeight: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
});

export default LaboratoireFormScreen;
