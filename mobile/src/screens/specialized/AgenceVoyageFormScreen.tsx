// ✅ REFONTE TOTALE 2026-03-05: AgenceVoyageFormScreen → Dashboard pro + Formulaire
// Mode Dashboard (agence existante): 4 tabs (Accueil / Service / Horaires / Bus)
// Mode Création: Formulaire guidé avec header gradient
// Exploite endpoints: CRUD agence-voyage, schedules, bus-tickets, bus models
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
import BusModelForm, { BusModel } from '../../components/bus/BusModelForm';
import CompanySelector, { Company } from '../../components/CompanySelector';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import WeekDaysSelector from '../../components/WeekDaysSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiDelete, apiGet, apiPost, apiPut, servicesApi } from '../../services/api';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const STORAGE_KEY = '@agence_voyage_form';
type TabType = 'overview' | 'service' | 'schedules' | 'bus' | 'tickets';

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lundi', short: 'Lun' },
    { value: 2, label: 'Mardi', short: 'Mar' },
    { value: 3, label: 'Mercredi', short: 'Mer' },
    { value: 4, label: 'Jeudi', short: 'Jeu' },
    { value: 5, label: 'Vendredi', short: 'Ven' },
    { value: 6, label: 'Samedi', short: 'Sam' },
    { value: 7, label: 'Dimanche', short: 'Dim' },
];
const SERVICES_OPTIONS = ['Billetterie bus', 'Billetterie avion', 'Organisation voyages', 'Visa'];

const AgenceVoyageFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    // Dashboard state
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    // ✅ FIX: Partenaires voient TOUJOURS le dashboard (même vide), pas le formulaire de création
    const [isDashboardMode, setIsDashboardMode] = useState(user?.role === 'partenaire' && !mode);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [agencyData, setAgencyData] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState({
        nom_agence: '', adresse: '', quartier: null as LocationObject | null,
        services_voyage: [] as string[],
        compagnies_bus: [] as Company[], destinations: [] as LocationObject[],
        heures_ouverture: '08:00', heures_fermeture: '18:00',
        jours_ouverture: [] as number[],
        telephone: '', whatsapp: '', email: '', site_web: '',
        peut_emettre_tickets_bus: false,
        compagnies_affiliees: [] as Company[],
        devise: 'XAF',
    });

    const [loading, setLoading] = useState(false);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [selectedCompagnies, setSelectedCompagnies] = useState<Company[]>([]);
    const [selectedDestinations, setSelectedDestinations] = useState<LocationObject[]>([]);
    const [selectedAffiliees, setSelectedAffiliees] = useState<Company[]>([]);
    const [showWeekDaysModal, setShowWeekDaysModal] = useState(false);
    const [busModels, setBusModels] = useState<BusModel[]>([]);
    const [showBusModelForm, setShowBusModelForm] = useState(false);
    const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);

    // Schedules
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
    const [scheduleForm, setScheduleForm] = useState({ departure_city: '', arrival_city: '', departure_times: [] as string[], day_of_week: null as number | null, notes: '' });

    // Agency Tickets (sold tickets management)
    const [agencyTickets, setAgencyTickets] = useState<any[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [selectedBusProduct, setSelectedBusProduct] = useState<string | null>(null);
    const [boardingSummary, setBoardingSummary] = useState<any | null>(null);
    const [passengersList, setPassengersList] = useState<any[]>([]);

    // IA Suggestions
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);

    const handleAISuggest = async () => {
        setLoadingAI(true);
        try {
            const resp = await apiPost('/api/ai/chat', {
                message: `En tant qu'expert en gestion d'agences de voyage, analyse mon agence "${formData.nom_agence}" avec ${selectedDestinations.length} destinations, ${schedules.length} horaires et ${selectedCompagnies.length} compagnies. Destinations: ${selectedDestinations.map((d: any) => d.place_name || d.raw || d).join(', ')}. Services: ${selectedServices.join(', ')}. Donne-moi 3 recommandations concrètes et courtes pour augmenter mon chiffre d'affaires et améliorer la satisfaction client.`,
                context: 'travel_agency_partner_dashboard',
            });
            const d = (resp?.data || resp) as any;
            setAiSuggestion(d?.response || d?.message || d?.data?.response || 'Aucune suggestion disponible.');
        } catch {
            setAiSuggestion('Service IA temporairement indisponible. Réessayez plus tard.');
        } finally { setLoadingAI(false); }
    };

    const { partnerData } = usePartnerData(user?.role, 'agencevoyage');
    const { errors, validateField, validateForm, setError } = useFormValidation({
        nom_agence: { required: true, minLength: 3 },
        telephone: { required: true, pattern: /^\+?[0-9]{9,15}$/ },
        email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    });
    useFormAutoSave(STORAGE_KEY, formData, mode !== 'edit', 1000);

    // Currency detection
    useEffect(() => {
        if (formData.quartier) {
            const c = getCurrencyIntelligently(formData.quartier, location?.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : null);
            if (c) setFormData(p => ({ ...p, devise: c }));
        }
    }, [formData.quartier]);

    // ─── DATA LOADING ────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            if (user?.role === 'partenaire') {
                try {
                    const partnerResp = await apiGet('/api/partners/me');
                    if (partnerResp.success && partnerResp.data) {
                        const p = partnerResp.data as any;
                        setFormData(prev => ({
                            ...prev, nom_agence: p.name || prev.nom_agence,
                            adresse: p.address || p.location_address || prev.adresse,
                            telephone: p.contact_phone || prev.telephone, email: p.contact_email || prev.email,
                            quartier: p.city ? { raw: p.city, place_name: p.city, components: { ville: p.city, pays: p.country } } as any : prev.quartier,
                        }));
                    }
                    const agResp = await apiGet('/api/agences-voyage');
                    const resData = (agResp?.data || agResp) as any;
                    const agencies = Array.isArray(resData?.data) ? resData.data : Array.isArray(resData) ? resData : [];
                    if (agencies.length > 0) {
                        const myAgency = agencies[0];
                        setAgencyData(myAgency);
                        setIsDashboardMode(true);
                        if (!serviceId && myAgency.service_id) setServiceId(myAgency.service_id);
                        loadSchedules();
                        loadAgencyTickets();
                    }
                } catch (e) { console.log('[AgenceVoyage] Init:', e); }
            }
            if (mode === 'edit' && specializedServiceId) {
                try {
                    setLoading(true);
                    const resp = await apiGet(`/api/agences-voyage/${specializedServiceId}`);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        const compBus: Company[] = (d.compagnies_bus || []).map((n: string) => ({ id: String(Date.now()) + Math.random(), name: n, type: 'bus' as const }));
                        const dests: LocationObject[] = (d.destinations || []).map((n: string) => ({ raw: n, place_name: n }));
                        const compAff: Company[] = (d.compagnies_affiliees || []).map((n: string) => ({ id: String(Date.now()) + Math.random(), name: n, type: 'bus' as const }));
                        let jours: number[] = [];
                        if (d.jours_ouverture) {
                            if (typeof d.jours_ouverture === 'string') { try { const p = JSON.parse(d.jours_ouverture); jours = Array.isArray(p) ? p : Object.values(p).flat() as number[]; } catch { } }
                            else if (Array.isArray(d.jours_ouverture)) jours = d.jours_ouverture;
                        }
                        setFormData({
                            nom_agence: d.nom_agence || '', adresse: d.adresse || '',
                            quartier: d.quartier ? { raw: d.quartier, place_name: d.quartier } as any : null,
                            services_voyage: d.services_voyage || [], compagnies_bus: compBus, destinations: dests,
                            heures_ouverture: d.heures_ouverture || '08:00', heures_fermeture: d.heures_fermeture || '18:00',
                            jours_ouverture: jours, telephone: d.telephone || '', whatsapp: d.whatsapp || '',
                            email: d.email || '', site_web: d.site_web || '',
                            peut_emettre_tickets_bus: d.peut_emettre_tickets_bus || false,
                            compagnies_affiliees: compAff, devise: d.devise || 'XAF',
                        });
                        setSelectedServices(d.services_voyage || []);
                        setSelectedCompagnies(compBus); setSelectedDestinations(dests); setSelectedAffiliees(compAff);
                        if (d.gps) setSelectedGPS(d.gps);
                    }
                } catch (e) { console.error('[AgenceVoyage] Edit:', e); } finally { setLoading(false); }
            }
            setInitialLoading(false);
        };
        init();
    }, [user?.role]);

    useEffect(() => {
        if (!serviceId && user?.id && formData.nom_agence) {
            (async () => {
                try {
                    const resp = await servicesApi.createService({ titre_service: formData.nom_agence || 'Agence de Voyage', description: 'Agence de voyage', category: 'transport' });
                    if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) setServiceId((resp.data as any).id);
                } catch (e) { console.error('[AgenceVoyage] Service:', e); }
            })();
        }
    }, [formData.nom_agence, serviceId, user?.id]);

    const loadSchedules = async () => {
        try {
            setLoadingSchedules(true);
            const resp = await apiGet('/api/bus-tickets/agencies/schedules');
            const d = (resp?.data || resp) as any;
            setSchedules(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []);
        } catch (e) { console.log('[AgenceVoyage] Schedules:', e); } finally { setLoadingSchedules(false); }
    };

    const handleRefresh = async () => { setRefreshing(true); await loadSchedules(); await loadAgencyTickets(); setRefreshing(false); };

    const loadAgencyTickets = async () => {
        try {
            setLoadingTickets(true);
            const resp = await apiGet('/api/bus-tickets/agency/tickets');
            const d = (resp?.data || resp) as any;
            setAgencyTickets(Array.isArray(d?.tickets) ? d.tickets : []);
        } catch (e) { console.log('[AgenceVoyage] Tickets:', e); } finally { setLoadingTickets(false); }
    };

    const loadBoardingSummary = async (productId: string) => {
        try {
            const resp = await apiGet(`/api/bus-tickets/${productId}/boarding-summary`);
            const d = (resp?.data || resp) as any;
            if (d.success) setBoardingSummary(d.summary);
        } catch (e) { console.log('[AgenceVoyage] Boarding:', e); }
    };

    const loadPassengers = async (productId: string) => {
        try {
            const resp = await apiGet(`/api/bus-tickets/${productId}/passengers`);
            const d = (resp?.data || resp) as any;
            setPassengersList(Array.isArray(d?.passengers) ? d.passengers : []);
        } catch (e) { console.log('[AgenceVoyage] Passengers:', e); }
    };

    const handleManualValidation = async (reservationId: string) => {
        try {
            const resp = await apiPost('/api/bus-tickets/validate/manual', { reservation_id: reservationId });
            const d = (resp?.data || resp) as any;
            if (d.success) {
                Alert.alert('Succès', 'Passager validé manuellement');
                if (selectedBusProduct) { await loadPassengers(selectedBusProduct); await loadBoardingSummary(selectedBusProduct); }
            } else { Alert.alert('Erreur', d.error || 'Validation impossible'); }
        } catch (e) { Alert.alert('Erreur', 'Service indisponible'); }
    };

    const generateSeatMap = (model: BusModel): any[] => {
        const seatMap: any[] = [];
        const rows = model.rows || Math.ceil(model.total_seats / 4);
        const seatsPerRow = model.seatsPerRow || 4;
        const firstRowSeats = model.firstRowSeats || 2;
        let seatNumber = 1;
        for (let col = 1; col <= firstRowSeats; col++) { seatMap.push({ row: 1, col, seat_id: `1-${col}`, seat_number: seatNumber++, type: 'standard', available: true }); }
        for (let row = 2; row <= rows; row++) { for (let col = 1; col <= seatsPerRow; col++) { if (seatNumber <= model.total_seats) { seatMap.push({ row, col, seat_id: `${row}-${col}`, seat_number: seatNumber++, type: 'standard', available: true }); } } }
        return seatMap;
    };

    const handleCreateBusProduct = async (model: BusModel) => {
        if (!serviceId) { Alert.alert('Erreur', 'Service ID manquant'); return; }
        try {
            setLoading(true);
            const seatMap = generateSeatMap(model);
            const busConfig = { rows: model.rows || Math.ceil(model.total_seats / 4), seatsPerRow: model.seatsPerRow || 4, firstRowSeats: model.firstRowSeats || 2, classe: model.classe };
            const resp = await apiPost('/api/bus-tickets/products', {
                service_id: serviceId, name: model.nom_modele, type: 'ticket_voyage',
                total_seats: model.total_seats, bus_configuration: busConfig, seat_map: seatMap,
                price_cents: model.prix_base ? model.prix_base * 100 : null, currency: formData.devise || 'XAF',
            });
            const d = (resp?.data || resp) as any;
            if (d.success && d.id) {
                if (agencyData?.id) {
                    await apiPost('/api/bus-tickets/products/link-agency', {
                        agency_id: agencyData.id, product_id: d.id, nom_modele: model.nom_modele,
                        classe: model.classe, equipements: model.equipements,
                    });
                }
                Alert.alert('Succès', `Bus "${model.nom_modele}" créé et lié au backend !`);
            } else { Alert.alert('Erreur', d.error || 'Impossible de créer le produit'); }
        } catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur lors de la création'); } finally { setLoading(false); }
    };

    const handleSaveSchedule = async () => {
        if (!scheduleForm.departure_city.trim() || !scheduleForm.arrival_city.trim()) { Alert.alert('Erreur', 'Villes obligatoires'); return; }
        if (scheduleForm.departure_times.length === 0) { Alert.alert('Erreur', 'Au moins un horaire requis'); return; }
        try {
            setLoading(true);
            const payload = { departure_city: scheduleForm.departure_city.trim(), arrival_city: scheduleForm.arrival_city.trim(), departure_times: scheduleForm.departure_times, day_of_week: scheduleForm.day_of_week, notes: scheduleForm.notes.trim() || null };
            const resp = editingSchedule ? await apiPut(`/api/bus-tickets/agencies/schedules/${editingSchedule.id}`, payload) : await apiPost('/api/bus-tickets/agencies/schedules', payload);
            if (resp.success) { Alert.alert('Succès', editingSchedule ? 'Horaire modifié' : 'Horaire créé'); setShowScheduleModal(false); setEditingSchedule(null); await loadSchedules(); }
            else { Alert.alert('Erreur', (resp as any).error || 'Impossible d\'enregistrer'); }
        } catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur'); } finally { setLoading(false); }
    };

    const handleDeleteSchedule = async (id: number) => {
        Alert.alert('Confirmer', 'Supprimer cet horaire ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await apiDelete(`/api/bus-tickets/agencies/schedules/${id}`); await loadSchedules(); } catch (e) { Alert.alert('Erreur', 'Impossible de supprimer'); } } },
        ]);
    };

    const handleSubmit = async () => {
        const nom = formData.nom_agence;
        if (!nom.trim()) { Alert.alert('Erreur', 'Nom obligatoire'); return; }
        setLoading(true);
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                const resp = await servicesApi.createService({ titre_service: nom, description: 'Agence de voyage', category: 'transport' });
                if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) { finalServiceId = (resp.data as any).id; setServiceId(finalServiceId); }
            } catch (e) { Alert.alert('Erreur', 'Impossible de créer le service'); setLoading(false); return; }
        }
        if (!finalServiceId) { Alert.alert('Erreur', 'Service ID manquant'); setLoading(false); return; }
        try {
            const payload = {
                service_id: finalServiceId, nom_agence: nom, adresse: formData.adresse || null,
                quartier: typeof formData.quartier === 'string' ? formData.quartier : (formData.quartier?.raw || formData.quartier?.place_name || null),
                gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                services_voyage: selectedServices.length > 0 ? selectedServices : null,
                compagnies_bus: selectedCompagnies.filter(c => c.type === 'bus').map(c => c.name),
                destinations: selectedDestinations.map(d => d.raw || d.place_name || '').filter(Boolean),
                heures_ouverture: formData.heures_ouverture || null, heures_fermeture: formData.heures_fermeture || null,
                jours_ouverture: formData.jours_ouverture.length > 0 ? formData.jours_ouverture : null,
                telephone: formData.telephone || null, whatsapp: formData.whatsapp || null,
                email: formData.email || null, site_web: formData.site_web || null,
                peut_emettre_tickets_bus: formData.peut_emettre_tickets_bus,
                compagnies_affiliees: selectedAffiliees.map(c => c.name),
                devise: formData.devise,
            };
            const resp = await apiPost('/api/agences-voyage', payload);
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert('Succès', 'Agence enregistrée !', [{ text: 'OK', onPress: () => { setIsDashboardMode(true); setActiveTab('overview'); handleRefresh(); } }]);
            } else { Alert.alert('Erreur', (resp as any).error || 'Impossible d\'enregistrer'); }
        } catch (e: any) { Alert.alert('Erreur', e.message || 'Erreur'); } finally { setLoading(false); }
    };

    if (initialLoading) return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#2563EB" /><Text style={s.loadingText}>Chargement...</Text></View>;

    // ─── RENDER: Overview ────────────────────────────────────────────────
    const renderOverview = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={s.statsGrid}>
                {[
                    { label: 'Destinations', value: selectedDestinations.length, icon: 'map-pin', color: '#2563EB' },
                    { label: 'Compagnies', value: selectedCompagnies.length, icon: 'bus', color: '#F59E0B' },
                    { label: 'Horaires', value: schedules.length, icon: 'clock', color: '#10B981' },
                    { label: 'Tickets', value: agencyTickets.length, icon: 'ticket', color: '#EF4444' },
                ].map((st, i) => (
                    <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
                        <SafeIcon name={st.icon as any} size={18} color={st.color} />
                        <Text style={s.statValue}>{st.value}</Text>
                        <Text style={s.statLabel}>{st.label}</Text>
                    </View>
                ))}
            </View>

            {/* Quick Actions */}
            <View style={s.quickRow}>
                {[
                    { label: 'Ajouter horaire', icon: 'plus-circle', color: '#2563EB', onPress: () => { setEditingSchedule(null); setScheduleForm({ departure_city: '', arrival_city: '', departure_times: [], day_of_week: null, notes: '' }); setShowScheduleModal(true); } },
                    { label: 'Mon service', icon: 'settings', color: '#6B7280', onPress: () => setActiveTab('service') },
                    { label: 'Modèles bus', icon: 'truck', color: '#8B5CF6', onPress: () => setActiveTab('bus') },
                    { label: 'IA Conseils', icon: 'sparkles', color: '#7C3AED', onPress: handleAISuggest },
                ].map((a, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={a.onPress}>
                        <View style={[s.quickIcon, { backgroundColor: a.color + '15' }]}><SafeIcon name={a.icon as any} size={22} color={a.color} /></View>
                        <Text style={s.quickLabel}>{a.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Info */}
            <View style={s.infoCard}><SafeIcon name="clock" size={16} color="#6B7280" /><Text style={s.infoText}>{formData.heures_ouverture} — {formData.heures_fermeture}</Text></View>
            {formData.jours_ouverture.length > 0 && (
                <View style={s.infoCard}><SafeIcon name="calendar" size={16} color="#2563EB" /><Text style={s.infoText}>{formData.jours_ouverture.map(d => DAYS_OF_WEEK.find(w => w.value === d)?.short || '').join(', ')}</Text></View>
            )}
            {formData.peut_emettre_tickets_bus && <View style={s.infoCard}><SafeIcon name="ticket" size={16} color="#10B981" /><Text style={s.infoText}>Émission de tickets bus activée</Text></View>}

            {/* IA Suggestions Card */}
            {loadingAI && (
                <View style={[s.infoCard, { backgroundColor: '#FAF5FF', borderLeftColor: '#7C3AED', flexDirection: 'column', alignItems: 'center', paddingVertical: 16 }]}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text style={[s.infoText, { color: '#7C3AED', marginTop: 8 }]}>Analyse IA en cours...</Text>
                </View>
            )}
            {aiSuggestion && !loadingAI && (
                <View style={[s.infoCard, { backgroundColor: '#FAF5FF', borderLeftColor: '#7C3AED', flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <SafeIcon name="sparkles" size={16} color="#7C3AED" />
                        <Text style={{ fontWeight: '700', color: '#5B21B6', fontSize: 14 }}>Recommandations IA</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>{aiSuggestion}</Text>
                    <TouchableOpacity onPress={handleAISuggest} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                        <SafeIcon name="refresh-cw" size={13} color="#7C3AED" />
                        <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '600' }}>Actualiser</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Recent Schedules */}
            {schedules.length > 0 && (
                <>
                    <View style={s.sectionRow}><Text style={s.sectionTitle}>Horaires récents</Text><TouchableOpacity onPress={() => setActiveTab('schedules')}><Text style={s.seeAll}>Tout voir</Text></TouchableOpacity></View>
                    {schedules.slice(0, 3).map((sch: any, i: number) => (
                        <View key={i} style={s.scheduleCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.scheduleRoute}>{sch.departure_city} → {sch.arrival_city}</Text>
                                <Text style={s.scheduleTimes}>{(sch.departure_times || []).join(' · ')}</Text>
                            </View>
                            {sch.day_of_week && <View style={s.dayBadge}><Text style={s.dayBadgeText}>{DAYS_OF_WEEK.find(d => d.value === sch.day_of_week)?.short || ''}</Text></View>}
                        </View>
                    ))}
                </>
            )}
        </ScrollView>
    );

    // ─── RENDER: Service Form ────────────────────────────────────────────
    const renderServiceForm = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            {user?.role !== 'partenaire' && <View style={s.field}><NativeInput label="Nom *" value={formData.nom_agence} onChangeText={t => setFormData({ ...formData, nom_agence: t })} placeholder="Ex: Agence Voyages Express" /></View>}
            <View style={s.field}>
                <TouchableOpacity style={s.gpsBtn} onPress={() => setShowGPSModal(true)}>
                    <SafeIcon name="map-pin" size={20} color="#2563EB" />
                    <Text style={s.gpsBtnText}>{selectedGPS ? '✓ GPS sélectionné' : 'Position GPS'}</Text>
                    <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
            {user?.role !== 'partenaire' && <View style={s.field}><NativeInput label="Adresse" value={formData.adresse} onChangeText={t => setFormData({ ...formData, adresse: t })} placeholder="Adresse complète" /></View>}
            <View style={s.field}><LocationSelector label="Quartier" value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''} onSelect={(loc: LocationObject) => setFormData({ ...formData, quartier: loc })} placeholder="Rechercher..." scope="all" enrichWithBackend /></View>

            <Text style={s.label}>Services proposés</Text>
            <View style={s.chips}>{SERVICES_OPTIONS.map(svc => {
                const on = selectedServices.includes(svc);
                return <TouchableOpacity key={svc} style={[s.chip, on && s.chipOn]} onPress={() => setSelectedServices(on ? selectedServices.filter(x => x !== svc) : [...selectedServices, svc])}><Text style={[s.chipText, on && s.chipTextOn]}>{svc}</Text></TouchableOpacity>;
            })}</View>

            <View style={s.field}><CompanySelector label="Compagnies de bus" selected={selectedCompagnies} onSelectionChange={setSelectedCompagnies} /></View>
            <View style={s.field}>
                <Text style={s.label}>Destinations</Text>
                {selectedDestinations.map((d, i) => (
                    <View key={i} style={s.destItem}>
                        <Text style={s.destText}>{d.raw || d.place_name}</Text>
                        <TouchableOpacity onPress={() => setSelectedDestinations(selectedDestinations.filter((_, j) => j !== i))}><SafeIcon name="x" size={16} color="#EF4444" /></TouchableOpacity>
                    </View>
                ))}
                <LocationSelector label="" value="" onSelect={(loc: LocationObject) => setSelectedDestinations([...selectedDestinations, loc])} placeholder="Ajouter une destination..." scope="all" enrichWithBackend />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Ouverture" value={formData.heures_ouverture} onChangeText={t => setFormData({ ...formData, heures_ouverture: t })} placeholder="08:00" /></View>
                <View style={[s.field, { flex: 1 }]}><NativeInput label="Fermeture" value={formData.heures_fermeture} onChangeText={t => setFormData({ ...formData, heures_fermeture: t })} placeholder="18:00" /></View>
            </View>

            <TouchableOpacity style={s.gpsBtn} onPress={() => setShowWeekDaysModal(true)}>
                <SafeIcon name="calendar" size={20} color="#2563EB" />
                <Text style={s.gpsBtnText}>{formData.jours_ouverture.length > 0 ? formData.jours_ouverture.map(d => DAYS_OF_WEEK.find(w => w.value === d)?.short || '').join(', ') : 'Sélectionner jours'}</Text>
                <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={[s.switchRow, { marginTop: 16 }]}><View><Text style={s.switchLbl}>Émission tickets bus</Text><Text style={s.hint}>Peut émettre des tickets pour les compagnies</Text></View><Switch value={formData.peut_emettre_tickets_bus} onValueChange={v => setFormData({ ...formData, peut_emettre_tickets_bus: v })} trackColor={{ false: '#D1D5DB', true: '#2563EB' }} /></View>

            {formData.peut_emettre_tickets_bus && <View style={s.field}><CompanySelector label="Compagnies affiliées" selected={selectedAffiliees} onSelectionChange={setSelectedAffiliees} /></View>}

            {user?.role !== 'partenaire' && (
                <>
                    <View style={s.field}><NativeInput label="Téléphone *" value={formData.telephone} onChangeText={t => setFormData({ ...formData, telephone: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="WhatsApp" value={formData.whatsapp} onChangeText={t => setFormData({ ...formData, whatsapp: t })} placeholder="+237 6XX XX XX XX" keyboardType="phone-pad" /></View>
                    <View style={s.field}><NativeInput label="Email" value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} placeholder="agence@example.com" keyboardType="email-address" autoCapitalize="none" /></View>
                    <View style={s.field}><NativeInput label="Site web" value={formData.site_web} onChangeText={t => setFormData({ ...formData, site_web: t })} placeholder="https://..." autoCapitalize="none" /></View>
                </>
            )}
            <NativeButton title={loading ? 'Enregistrement...' : (isDashboardMode ? 'Mettre à jour' : 'Enregistrer l\'Agence')} onPress={handleSubmit} disabled={loading || !formData.nom_agence.trim()} variant="primary" size="large" style={{ marginTop: 24 }} />
        </ScrollView>
    );

    // ─── RENDER: Schedules Tab ───────────────────────────────────────────
    const renderSchedulesTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity style={s.addBtn} onPress={() => { setEditingSchedule(null); setScheduleForm({ departure_city: '', arrival_city: '', departure_times: [], day_of_week: null, notes: '' }); setShowScheduleModal(true); }}>
                    <SafeIcon name="plus" size={18} color="#fff" /><Text style={s.addBtnText}>Ajouter</Text>
                </TouchableOpacity>
            </View>
            {loadingSchedules ? <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 32 }} /> :
                schedules.length === 0 ? (
                    <View style={s.emptyDash}><SafeIcon name="clock" size={48} color="#9CA3AF" /><Text style={s.emptyTitle}>Aucun horaire</Text><Text style={s.emptyText}>Créez vos horaires de départ pour les rendre visibles</Text></View>
                ) : (
                    schedules.map((sch: any, i: number) => (
                        <View key={i} style={s.scheduleCardFull}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.scheduleRoute}>{sch.departure_city} → {sch.arrival_city}</Text>
                                <Text style={s.scheduleTimes}>{(sch.departure_times || []).join(' · ')}</Text>
                                {sch.day_of_week && <Text style={s.scheduleDay}>{DAYS_OF_WEEK.find(d => d.value === sch.day_of_week)?.label || ''}</Text>}
                                {sch.notes && <Text style={s.scheduleNotes}>{sch.notes}</Text>}
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => { setEditingSchedule(sch); setScheduleForm({ departure_city: sch.departure_city || '', arrival_city: sch.arrival_city || '', departure_times: sch.departure_times || [], day_of_week: sch.day_of_week || null, notes: sch.notes || '' }); setShowScheduleModal(true); }}><SafeIcon name="edit" size={18} color="#2563EB" /></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteSchedule(sch.id)}><SafeIcon name="trash-2" size={18} color="#EF4444" /></TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
        </ScrollView>
    );

    // ─── RENDER: Bus Models Tab ──────────────────────────────────────────
    const renderBusTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100, padding: 16 }}>
            <TouchableOpacity style={s.addBtn} onPress={() => { setEditingModelIndex(null); setShowBusModelForm(true); }}>
                <SafeIcon name="plus" size={18} color="#fff" /><Text style={s.addBtnText}>Ajouter un modèle</Text>
            </TouchableOpacity>
            {busModels.length === 0 ? (
                <View style={s.emptyDash}><SafeIcon name="truck" size={48} color="#9CA3AF" /><Text style={s.emptyTitle}>Aucun modèle</Text><Text style={s.emptyText}>Configurez vos modèles de bus pour la billetterie</Text></View>
            ) : busModels.map((model, i) => (
                <View key={i} style={s.busCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.busName}>{model.name || `Bus ${i + 1}`}</Text>
                        <Text style={s.busSub}>{model.total_seats} places · {model.rows || '?'} rangées</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => { setEditingModelIndex(i); setShowBusModelForm(true); }}><SafeIcon name="edit" size={18} color="#2563EB" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => setBusModels(busModels.filter((_, j) => j !== i))}><SafeIcon name="trash-2" size={18} color="#EF4444" /></TouchableOpacity>
                    </View>
                </View>
            ))}
        </ScrollView>
    );

    // ─── RENDER: Schedule Modal ──────────────────────────────────────────
    const renderScheduleModal = () => (
        <Modal visible={showScheduleModal} animationType="slide" transparent onRequestClose={() => setShowScheduleModal(false)}>
            <View style={s.modalOverlay}><View style={s.modalContent}>
                <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>{editingSchedule ? 'Modifier' : 'Nouvel horaire'}</Text>
                    <TouchableOpacity onPress={() => setShowScheduleModal(false)}><SafeIcon name="x" size={24} color="#6B7280" /></TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 16, maxHeight: 450 }}>
                    <View style={s.field}><NativeInput label="Ville départ *" value={scheduleForm.departure_city} onChangeText={t => setScheduleForm({ ...scheduleForm, departure_city: t })} placeholder="Ex: Douala" /></View>
                    <View style={s.field}><NativeInput label="Ville arrivée *" value={scheduleForm.arrival_city} onChangeText={t => setScheduleForm({ ...scheduleForm, arrival_city: t })} placeholder="Ex: Yaoundé" /></View>
                    <Text style={s.label}>Horaires de départ</Text>
                    {scheduleForm.departure_times.map((t, i) => (
                        <View key={i} style={s.timeRow}>
                            <NativeInput value={t} onChangeText={v => { const u = [...scheduleForm.departure_times]; u[i] = v; setScheduleForm({ ...scheduleForm, departure_times: u }); }} placeholder="08:00" style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => setScheduleForm({ ...scheduleForm, departure_times: scheduleForm.departure_times.filter((_, j) => j !== i) })}><SafeIcon name="x" size={18} color="#EF4444" /></TouchableOpacity>
                        </View>
                    ))}
                    <TouchableOpacity style={s.addTimeBtn} onPress={() => setScheduleForm({ ...scheduleForm, departure_times: [...scheduleForm.departure_times, '08:00'] })}>
                        <SafeIcon name="plus" size={16} color="#2563EB" /><Text style={s.addTimeBtnText}>Ajouter un horaire</Text>
                    </TouchableOpacity>
                    <Text style={[s.label, { marginTop: 16 }]}>Jour (optionnel)</Text>
                    <View style={s.daysRow}>{DAYS_OF_WEEK.map(d => (
                        <TouchableOpacity key={d.value} style={[s.dayBtn, scheduleForm.day_of_week === d.value && s.dayBtnOn]} onPress={() => setScheduleForm({ ...scheduleForm, day_of_week: scheduleForm.day_of_week === d.value ? null : d.value })}>
                            <Text style={[s.dayBtnText, scheduleForm.day_of_week === d.value && s.dayBtnTextOn]}>{d.short}</Text>
                        </TouchableOpacity>
                    ))}</View>
                    <View style={[s.field, { marginTop: 16 }]}><NativeInput label="Notes" value={scheduleForm.notes} onChangeText={t => setScheduleForm({ ...scheduleForm, notes: t })} placeholder="Notes..." multiline /></View>
                </ScrollView>
                <View style={s.modalFooter}>
                    <NativeButton title="Annuler" onPress={() => setShowScheduleModal(false)} variant="secondary" style={{ flex: 1 }} />
                    <NativeButton title={editingSchedule ? 'Modifier' : 'Créer'} onPress={handleSaveSchedule} variant="primary" style={{ flex: 1 }} disabled={loading || !scheduleForm.departure_city.trim() || !scheduleForm.arrival_city.trim() || scheduleForm.departure_times.length === 0} />
                </View>
            </View></View>
        </Modal>
    );

    // ─── RENDER: Tickets Tab (Partner sold tickets + boarding management) ─
    const renderTicketsTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadAgencyTickets(); setRefreshing(false); }} />}>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <TouchableOpacity style={[s.addBtn, { flex: 1, justifyContent: 'center' }]} onPress={() => loadAgencyTickets()}>
                    <SafeIcon name="refresh-cw" size={16} color="#fff" /><Text style={s.addBtnText}>Actualiser</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.addBtn, { flex: 1, justifyContent: 'center', backgroundColor: '#10B981' }]} onPress={() => {
                    (navigation as any).navigate('BusTicketQRScanner', {
                        onValidate: async (qrData: any) => {
                            try {
                                const resp = await apiPost('/api/bus-tickets/validate/qr', { qr_code_data: qrData, product_id: selectedBusProduct });
                                const d = (resp?.data || resp) as any;
                                if (d.success) { Alert.alert('Validé ✓', `Passager: ${d.passenger_name || 'Confirmé'}\nPlace: ${d.seat_number || '?'}`); }
                                else { Alert.alert('Erreur', d.error || 'Ticket invalide'); }
                            } catch (e) { Alert.alert('Erreur', 'Validation impossible'); }
                        }
                    });
                }}>
                    <SafeIcon name="scan" size={16} color="#fff" /><Text style={s.addBtnText}>Scanner QR</Text>
                </TouchableOpacity>
            </View>

            {/* Boarding Summary */}
            {boardingSummary && (
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#10B981' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Résumé embarquement</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <View style={{ flex: 1, minWidth: '45%', alignItems: 'center', padding: 8, backgroundColor: '#F0FDF4', borderRadius: 8 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#10B981' }}>{boardingSummary.boarded_passengers}</Text>
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>Embarqués</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: '45%', alignItems: 'center', padding: 8, backgroundColor: '#FEF3C7', borderRadius: 8 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#D97706' }}>{boardingSummary.pending_passengers}</Text>
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>En attente</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: '45%', alignItems: 'center', padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#EF4444' }}>{boardingSummary.no_show_passengers}</Text>
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>Absents</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: '45%', alignItems: 'center', padding: 8, backgroundColor: '#EFF6FF', borderRadius: 8 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: '#2563EB' }}>{Math.round(boardingSummary.completion_percentage || 0)}%</Text>
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>Complétion</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Passengers List */}
            {passengersList.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Passagers ({passengersList.length})</Text>
                    {passengersList.map((p: any, i: number) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 10, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: p.is_validated ? '#10B981' : '#F59E0B' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{p.passenger_name || `Passager #${p.seat_number}`}</Text>
                                <Text style={{ fontSize: 12, color: '#6B7280' }}>Place {p.seat_number} · {p.display_status === 'boarded' ? '✓ Embarqué' : p.display_status === 'no_show' ? '✗ Absent' : '⏳ En attente'}</Text>
                            </View>
                            {!p.is_validated && (
                                <TouchableOpacity style={{ backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                    onPress={() => handleManualValidation(p.reservation_id)}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Valider</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}

            {/* Sold Tickets */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Tickets vendus ({agencyTickets.length})</Text>
            {loadingTickets ? <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 32 }} /> :
                agencyTickets.length === 0 ? (
                    <View style={s.emptyDash}><SafeIcon name="ticket" size={48} color="#9CA3AF" /><Text style={s.emptyTitle}>Aucun ticket vendu</Text><Text style={s.emptyText}>Les tickets apparaîtront ici une fois que des clients réservent</Text></View>
                ) : (
                    agencyTickets.map((ticket: any, i: number) => (
                        <TouchableOpacity key={i} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: ticket.payment_status === 'completed' ? '#10B981' : '#F59E0B' }}
                            onPress={() => {
                                setSelectedBusProduct(ticket.product_id);
                                loadBoardingSummary(ticket.product_id);
                                loadPassengers(ticket.product_id);
                            }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{ticket.departure_city} → {ticket.arrival_city}</Text>
                                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{ticket.customer_name || 'Client'} · {ticket.number_of_tickets} place(s)</Text>
                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{ticket.departure_date} {ticket.departure_time}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{(ticket.total_amount || 0).toLocaleString()} {ticket.currency || 'XAF'}</Text>
                                    <View style={{ backgroundColor: ticket.payment_status === 'completed' ? '#D1FAE5' : '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                                        <Text style={{ fontSize: 10, color: ticket.payment_status === 'completed' ? '#059669' : '#D97706', fontWeight: '600' }}>{ticket.payment_status === 'completed' ? 'Payé' : 'En cours'}</Text>
                                    </View>
                                    {ticket.boarded_count !== undefined && (
                                        <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{ticket.boarded_count}/{ticket.number_of_tickets} embarqué(s)</Text>
                                    )}
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
        </ScrollView>
    );

    // ─── RENDER: Dashboard ───────────────────────────────────────────────
    if (isDashboardMode || (user?.role === 'partenaire' && serviceId)) {
        const tabs: { key: TabType; label: string; icon: string }[] = [
            { key: 'overview', label: 'Accueil', icon: 'layout-dashboard' },
            { key: 'service', label: 'Service', icon: 'settings' },
            { key: 'schedules', label: 'Horaires', icon: 'clock' },
            { key: 'bus', label: 'Bus', icon: 'truck' },
            { key: 'tickets', label: 'Tickets', icon: 'ticket' },
        ];
        return (
            <View style={s.container}>
                <LinearGradient colors={['#1E3A8A', '#2563EB']} style={s.dashHeader}>
                    <View style={s.dashHeaderRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={s.dashTitle}>{agencyData?.nom_agence || formData.nom_agence || 'Mon Agence'}</Text>
                            <Text style={s.dashSub}>{selectedDestinations.length} destination{selectedDestinations.length > 1 ? 's' : ''} · {schedules.length} horaire{schedules.length > 1 ? 's' : ''}</Text>
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
                    {activeTab === 'schedules' && renderSchedulesTab()}
                    {activeTab === 'bus' && renderBusTab()}
                    {activeTab === 'tickets' && renderTicketsTab()}
                </View>
                <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={(c: string) => { setSelectedGPS(c); setShowGPSModal(false); }} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
                {renderScheduleModal()}
                {showWeekDaysModal && <WeekDaysSelector visible={showWeekDaysModal} initialDays={formData.jours_ouverture} onSave={(days: number[]) => { setFormData({ ...formData, jours_ouverture: days }); setShowWeekDaysModal(false); }} onClose={() => setShowWeekDaysModal(false)} />}
                {showBusModelForm && <BusModelForm visible={showBusModelForm} initialModel={editingModelIndex !== null ? busModels[editingModelIndex] : undefined} onSave={(model: BusModel) => { if (editingModelIndex !== null) { const u = [...busModels]; u[editingModelIndex] = model; setBusModels(u); } else { setBusModels([...busModels, model]); handleCreateBusProduct(model); } setShowBusModelForm(false); }} onClose={() => setShowBusModelForm(false)} />}
            </View>
        );
    }

    // ─── RENDER: Creation ────────────────────────────────────────────────
    return (
        <View style={s.container}>
            <LinearGradient colors={['#1E3A8A', '#2563EB']} style={s.createHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                <Text style={s.createTitle}>Enregistrer une Agence</Text>
            </LinearGradient>
            {renderServiceForm()}
            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={(c: string) => { setSelectedGPS(c); setShowGPSModal(false); }} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title="Localisation" />
            {showWeekDaysModal && <WeekDaysSelector visible={showWeekDaysModal} initialDays={formData.jours_ouverture} onSave={(days: number[]) => { setFormData({ ...formData, jours_ouverture: days }); setShowWeekDaysModal(false); }} onClose={() => setShowWeekDaysModal(false)} />}
        </View>
    );
};

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
    seeAll: { fontSize: 13, color: '#2563EB', fontWeight: '600' },
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8 },
    infoText: { fontSize: 14, color: '#374151' },
    scheduleCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    scheduleCardFull: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#2563EB' },
    scheduleRoute: { fontSize: 15, fontWeight: '600', color: '#111827' },
    scheduleTimes: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    scheduleDay: { fontSize: 12, color: '#2563EB', fontWeight: '500', marginTop: 2 },
    scheduleNotes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },
    dayBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 6 },
    dayBadgeText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    emptyDash: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 12, marginTop: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    hint: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingVertical: 6 },
    switchLbl: { fontSize: 14, color: '#374151', fontWeight: '500' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    chipText: { fontSize: 13, color: '#374151' },
    chipTextOn: { color: '#fff', fontWeight: '600' },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, gap: 12, marginBottom: 16 },
    gpsBtnText: { flex: 1, fontSize: 14, color: '#111827' },
    destItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#EFF6FF', borderRadius: 8, marginBottom: 6 },
    destText: { fontSize: 14, color: '#1E3A8A', fontWeight: '500' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#2563EB', borderRadius: 8 },
    addBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    busCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 10, marginBottom: 8, marginTop: 12, borderLeftWidth: 3, borderLeftColor: '#8B5CF6' },
    busName: { fontSize: 15, fontWeight: '600', color: '#111827' },
    busSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    addTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    addTimeBtnText: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
    daysRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
    dayBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    dayBtnOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    dayBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
    dayBtnTextOn: { color: '#fff' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
    modalFooter: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
});

export default AgenceVoyageFormScreen;
