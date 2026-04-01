// ✅ REFONTE TOTALE 2026-03-05: CovoiturageFormScreen → Dashboard pro + Formulaire
// Mode Dashboard (trajets existants): 3 tabs (Mes trajets / Nouveau trajet / Stats)
// Mode Création (premier trajet): Formulaire guidé step-by-step avec header gradient
// Exploite endpoints: CRUD covoiturage, my-trips, booking, search, reviews, driver verification
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { useTransportDriverAccess } from '../../hooks/useTransportDriverAccess';
import { apiGet, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { enrichLocationWithBackend } from '../../utils/locationBackendEnrich';

const STORAGE_KEY = '@covoiturage_last_form_data';
type TabType = 'trips' | 'create' | 'stats';

interface Trip {
    id: number;
    depart: string;
    destination: string;
    date_depart: string;
    heure_depart: string;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    type_vehicule?: string;
    marque_modele?: string;
    is_recurring?: boolean;
    recurrence_type?: string;
    bookings_count?: number;
    status?: string;
}

const CovoiturageFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;
    const devise = getCurrencyIntelligently() || 'XAF';
    const tr = (key: string, fallback: string) => {
        const translated = t(key) as unknown as string;
        return translated && translated !== key ? translated : fallback;
    };

    // Dashboard state
    // ✅ FIX: Partenaires arrivent sur l'onglet "Mes trajets" par défaut, pas "Créer"
    const [activeTab, setActiveTab] = useState<TabType>(user?.role === 'partenaire' && !mode ? 'trips' : 'create');
    // ✅ FIX: Partenaires voient TOUJOURS les tabs dashboard (même sans trajets)
    const [hasPreviousTrips, setHasPreviousTrips] = useState(user?.role === 'partenaire' && !mode);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [myTrips, setMyTrips] = useState<Trip[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        depart: null as LocationObject | null,
        destination: null as LocationObject | null,
        date_depart: new Date(),
        heure_depart: '08:00',
        type_vehicule: '',
        marque_modele: '',
        places_disponibles: '3',
        prix_par_place: '',
        devise: 'XAF',
        bagages_autorises: true,
        animaux_autorises: false,
        fumeur_autorise: false,
        climatisation: false,
        image_vehicule: null as string | null,
        is_recurring: false,
        recurrence_type: null as 'daily' | 'weekly' | 'monthly' | null,
        recurrence_days: [] as number[],
        recurrence_end_date: null as Date | null,
    });

    const detectedCurrency = useCurrencyDetection(formData.depart || formData.destination || null);

    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);
    const [showGPSModalDepart, setShowGPSModalDepart] = useState(false);
    const [showGPSModalDestination, setShowGPSModalDestination] = useState(false);
    const [selectedGPSDepart, setSelectedGPSDepart] = useState<string | null>(null);
    const [selectedGPSDestination, setSelectedGPSDestination] = useState<string | null>(null);

    const { partnerData } = usePartnerData(user?.role);
    const { validated: isDriverValidated } = useTransportDriverAccess(
        user as Record<string, unknown> | null | undefined
    );
    const { errors, validateField, validateForm, setError } = useFormValidation({
        depart: { required: true },
        destination: { required: true },
        places_disponibles: { required: true, custom: v => { const n = parseInt(v); return (isNaN(n) || n < 1 || n > 50) ? t('covoiturageForm.entre1et50') : null; } },
        prix_par_place: { required: true },
    });

    useFormAutoSave(STORAGE_KEY, formData, mode !== 'edit', 1000);

    const normalizeSelectedLocation = (loc: LocationObject): LocationObject => {
        const fromDisplay =
            typeof loc?.raw === 'string' && loc.raw.trim()
                ? loc.raw.trim()
                : typeof loc?.place_name === 'string' && loc.place_name.trim()
                    ? loc.place_name.trim()
                    : '';
        return {
            ...loc,
            raw: fromDisplay,
            place_name: (loc?.place_name && String(loc.place_name).trim()) || fromDisplay,
        };
    };

    // Auto-detect currency
    useEffect(() => {
        if (detectedCurrency && detectedCurrency !== formData.devise) setFormData(p => ({ ...p, devise: detectedCurrency }));
    }, [detectedCurrency]);

    // ─── DATA LOADING ────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const resp = await apiGet('/api/covoiturages/my-trips');
                const d = (resp?.data || resp) as any;
                const trips = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
                if (trips.length > 0) {
                    setMyTrips(trips);
                    setHasPreviousTrips(true);
                    setActiveTab('trips');
                }
            } catch (e) { console.log('[Covoiturage] No previous trips'); }

            // Edit mode
            if (mode === 'edit' && specializedServiceId) {
                try {
                    const resp = await apiGet(`/api/covoiturages/${specializedServiceId}`);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        setFormData({
                            depart: d.depart ? { raw: d.depart, place_name: d.depart } as any : null,
                            destination: d.destination ? { raw: d.destination, place_name: d.destination } as any : null,
                            date_depart: d.date_depart ? new Date(d.date_depart) : new Date(),
                            heure_depart: d.heure_depart || '08:00',
                            type_vehicule: d.type_vehicule || '', marque_modele: d.marque_modele || '',
                            places_disponibles: d.places_disponibles ? String(d.places_disponibles) : '3',
                            prix_par_place: d.prix_par_place ? String(d.prix_par_place) : '',
                            devise: d.devise || 'XAF',
                            bagages_autorises: d.bagages_autorises ?? true, animaux_autorises: d.animaux_autorises || false,
                            fumeur_autorise: d.fumeur_autorise || false, climatisation: d.climatisation || false,
                            image_vehicule: d.image_vehicule || null,
                            is_recurring: d.is_recurring || false, recurrence_type: d.recurrence_type || null,
                            recurrence_days: d.recurrence_days ? d.recurrence_days.map(Number) : [],
                            recurrence_end_date: d.recurrence_end_date ? new Date(d.recurrence_end_date) : null,
                        });
                        if (d.gps_depart) setSelectedGPSDepart(d.gps_depart);
                        if (d.gps_destination) setSelectedGPSDestination(d.gps_destination);
                        setActiveTab('create');
                    }
                } catch (e) { console.error('[Covoiturage] Edit load:', e); }
            }
            setInitialLoading(false);
        };
        init();
    }, []);

    const loadTrips = async () => {
        try {
            const resp = await apiGet('/api/covoiturages/my-trips');
            const d = (resp?.data || resp) as any;
            const trips = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
            setMyTrips(trips);
        } catch (e) { console.log('[Covoiturage] Load trips:', e); }
    };

    const handleRefresh = async () => { setRefreshing(true); await loadTrips(); setRefreshing(false); };

    // ─── IMAGE PICKER ────────────────────────────────────────────────────
    const pickVehicleImage = async (source: 'gallery' | 'camera') => {
        try {
            const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert(t('covoiturage.permissionDenied')); return; }
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8, base64: true })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images' as any, allowsEditing: true, quality: 0.8, base64: true });
            if (!result.canceled && result.assets[0]) {
                const b64 = result.assets[0].base64;
                setFormData({ ...formData, image_vehicule: b64 ? `data:image/jpeg;base64,${b64}` : result.assets[0].uri });
            }
        } catch (e) { Alert.alert(t('message.error'), t('covoiturage.cannotSelectImage')); }
    };

    // ─── SUBMIT ──────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!isDriverValidated) {
            Alert.alert(
                t('covoiturageHome.driverRegistrationRequired'),
                t('covoiturage.createServiceFirst'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('covoiturageHome.devenirChauffeur'),
                        onPress: () =>
                            (navigation as any).navigate('CourierRegistration', { applicationType: 'driver' }),
                    },
                ]
            );
            return;
        }
        if (!formData.depart || !formData.destination) { Alert.alert(t('message.error'), t('covoiturage.departDestRequired')); return; }
        if (!formData.prix_par_place.trim()) { Alert.alert(t('message.error'), t('covoiturage.priceRequired')); return; }
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const dep = new Date(formData.date_depart); dep.setHours(0, 0, 0, 0);
        if (dep < now) { Alert.alert(t('covoiturage.validation'), t('covoiturage.dateInPast')); return; }

        setLoading(true);
        const [depEnriched, destEnriched] = await Promise.all([
            enrichLocationWithBackend(formData.depart!),
            enrichLocationWithBackend(formData.destination!),
        ]);
        const departLabel = depEnriched.raw || depEnriched.place_name || '';
        const destLabel = destEnriched.raw || destEnriched.place_name || '';

        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                const dStr = departLabel;
                const aStr = destLabel;
                const resp = await servicesApi.createService({ titre_service: `Covoiturage ${dStr} → ${aStr}`, description: 'Trajet covoiturage', category: 'transport' });
                if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) { finalServiceId = (resp.data as any).id; setServiceId(finalServiceId); }
            } catch (e) { Alert.alert(t('message.error'), t('covoiturage.cannotCreateService')); setLoading(false); return; }
        }
        if (!finalServiceId) { Alert.alert(t('message.error'), t('covoiturage.serviceIdMissing')); setLoading(false); return; }

        try {
            const payload = {
                service_id: finalServiceId,
                depart: departLabel,
                destination: destLabel,
                gps_depart: selectedGPSDepart || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                gps_destination: selectedGPSDestination || null,
                date_depart: formData.date_depart.toISOString(),
                heure_depart: formData.heure_depart,
                type_vehicule: formData.type_vehicule || null, marque_modele: formData.marque_modele || null,
                nombre_places: parseInt(formData.places_disponibles) || 3,
                places_disponibles: parseInt(formData.places_disponibles) || 3,
                prix_par_place: parseInt(formData.prix_par_place) || 0,
                devise: formData.devise,
                bagages_autorises: formData.bagages_autorises, animaux_autorises: formData.animaux_autorises,
                fumeur_autorise: formData.fumeur_autorise, climatisation: formData.climatisation,
                image_vehicule: formData.image_vehicule || null,
                is_recurring: formData.is_recurring, recurrence_type: formData.recurrence_type || null,
                recurrence_days: formData.recurrence_days.length > 0 ? formData.recurrence_days : null,
                recurrence_end_date: formData.recurrence_end_date ? formData.recurrence_end_date.toISOString().split('T')[0] : null,
            };
            const resp = await apiPost('/api/covoiturages', payload);
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                setFormData(prev => ({
                    ...prev,
                    depart: normalizeSelectedLocation(depEnriched as LocationObject),
                    destination: normalizeSelectedLocation(destEnriched as LocationObject),
                }));
                Alert.alert(t('message.success'), t('covoiturage.tripCreated'), [
                    { text: t('covoiturageForm.mesTrajets'), onPress: () => { setActiveTab('trips'); loadTrips(); setHasPreviousTrips(true); } },
                    { text: 'OK', style: 'cancel', onPress: () => navigation.goBack() },
                ]);
            } else { Alert.alert(t('message.error'), (resp as any).error || t('covoiturage.cannotCreateTrip')); }
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('covoiturage.genericError')); } finally { setLoading(false); }
    };

    // ─── RENDER: Loading ─────────────────────────────────────────────────
    if (initialLoading) {
        return <View style={s.loadingScreen}><ActivityIndicator size="large" color="#6366F1" /><Text style={s.loadingText}>{t('covoiturageForm.chargement')}</Text></View>;
    }

    // ─── RENDER: My Trips Tab ────────────────────────────────────────────
    const renderTripsTab = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
            {/* Stats */}
            <View style={s.statsGrid}>
                {[
                    { label: t('covoiturageForm.trajetsCrees'), value: myTrips.length, icon: 'map', color: '#6366F1' },
                    { label: t('covoiturageForm.placesOffertes'), value: myTrips.reduce((s, t) => s + (t.places_disponibles || 0), 0), icon: 'users', color: '#3B82F6' },
                    { label: t('covoiturageForm.recurrents'), value: myTrips.filter(t => t.is_recurring).length, icon: 'repeat', color: '#10B981' },
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
                <TouchableOpacity style={s.quickAction} onPress={() => setActiveTab('create')}>
                    <View style={[s.quickIcon, { backgroundColor: '#6366F115' }]}><SafeIcon name="plus-circle" size={22} color="#6366F1" /></View>
                    <Text style={s.quickLabel}>{t('covoiturageForm.nouveauTrajet')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickAction} onPress={() => setActiveTab('stats')}>
                    <View style={[s.quickIcon, { backgroundColor: '#F59E0B15' }]}><SafeIcon name="bar-chart-2" size={22} color="#F59E0B" /></View>
                    <Text style={s.quickLabel}>{t('covoiturageForm.statistiques')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickAction} onPress={() => (navigation as any).navigate('WalletFinancial')}>
                    <View style={[s.quickIcon, { backgroundColor: '#8B5CF615' }]}><SafeIcon name="wallet" size={22} color="#8B5CF6" /></View>
                    <Text style={s.quickLabel}>{t('financialTracking.wallet') || 'Portefeuille'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickAction} onPress={() => (navigation as any).navigate('VerificationConduite', { service: 'covoiturage' })}>
                    <View style={[s.quickIcon, { backgroundColor: '#05966915' }]}><SafeIcon name="shield" size={22} color="#059669" /></View>
                    <Text style={s.quickLabel}>Vérification</Text>
                </TouchableOpacity>
            </View>

            {/* Trips List */}
            <Text style={s.sectionTitle}>{t('covoiturageForm.mesTrajets')} ({myTrips.length})</Text>
            {myTrips.length === 0 ? (
                <View style={s.emptyDash}>
                    <SafeIcon name="map" size={48} color="#9CA3AF" />
                    <Text style={s.emptyTitle}>{t('covoiturageForm.aucunTrajet')}</Text>
                    <Text style={s.emptyText}>{t('covoiturageForm.creezVotrePremierTrajetDe')}</Text>
                    <NativeButton title={t('covoiturageForm.creerUnTrajet')} onPress={() => setActiveTab('create')} style={{ marginTop: 16 }} />
                </View>
            ) : (
                myTrips.map(trip => {
                    const tripDate = trip.date_depart ? new Date(trip.date_depart) : null;
                    const isPast = tripDate && tripDate < new Date();
                    return (
                        <View key={trip.id} style={[s.tripCard, isPast && { opacity: 0.6 }]}>
                            <View style={s.tripRoute}>
                                <View style={s.tripDot} />
                                <View style={s.tripLine} />
                                <View style={[s.tripDot, { backgroundColor: '#EF4444' }]} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={s.tripFrom}>{trip.depart}</Text>
                                <Text style={s.tripTo}>{trip.destination}</Text>
                                <View style={s.tripMeta}>
                                    <Text style={s.tripDate}>{tripDate ? tripDate.toLocaleDateString('fr-FR') : '—'} · {trip.heure_depart || '—'}</Text>
                                    <Text style={s.tripPrice}>{trip.prix_par_place?.toLocaleString()} {trip.devise || devise}/place</Text>
                                </View>
                                <View style={s.tripBadges}>
                                    <View style={s.tripBadge}><Text style={s.tripBadgeText}>{`${trip.places_disponibles} ${t('covoiturageForm.placesUnit')}`}</Text></View>
                                    {trip.is_recurring && <View style={[s.tripBadge, { backgroundColor: '#DCFCE7' }]}><Text style={[s.tripBadgeText, { color: '#16A34A' }]}>{t('covoiturageForm.recurrent')}</Text></View>}
                                    {isPast && <View style={[s.tripBadge, { backgroundColor: '#FEE2E2' }]}><Text style={[s.tripBadgeText, { color: '#DC2626' }]}>{t('covoiturageForm.passe')}</Text></View>}
                                </View>
                                {!isPast && trip.status !== 'en_cours' && (
                                    <TouchableOpacity
                                        style={{ marginTop: 8, backgroundColor: '#059669', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}
                                        onPress={() => {
                                            Alert.alert(
                                                t('covoiturageForm.confirmerDepart') || 'Confirmer le départ',
                                                t('covoiturageForm.confirmerDepartMsg') || 'Le reversement sera effectué automatiquement. Confirmer ?',
                                                [
                                                    { text: t('common.annuler') || 'Annuler', style: 'cancel' },
                                                    {
                                                        text: t('common.confirmer') || 'Confirmer',
                                                        onPress: async () => {
                                                            try {
                                                                const resp = await apiPost(`/api/covoiturages/${trip.id}/confirm-departure`, {});
                                                                if (resp.success) {
                                                                    Alert.alert(
                                                                        t('covoiturageForm.departConfirme') || 'Départ confirmé !',
                                                                        `${(resp as any).reservations_count || 0} ${t('covoiturageForm.reservations')} — ${t('covoiturageForm.reversement')}: ${((resp as any).total_payout || 0).toLocaleString()} ${devise}`
                                                                    );
                                                                    // Refresh trips list
                                                                    const r = await apiGet('/api/covoiturages/my-trips');
                                                                    const d = (r?.data || r) as any;
                                                                    const trips = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
                                                                    setMyTrips(trips);
                                                                } else {
                                                                    Alert.alert(t('message.error'), (resp as any).error || t('message.error'));
                                                                }
                                                            } catch (err: any) {
                                                                Alert.alert(t('message.error'), err.message || t('message.error'));
                                                            }
                                                        },
                                                    },
                                                ]
                                            );
                                        }}
                                    >
                                        <SafeIcon name="check-circle" size={16} color="#fff" />
                                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 6 }}>{t('covoiturageForm.confirmerDepart') || 'Confirmer le départ'}</Text>
                                    </TouchableOpacity>
                                )}
                                {trip.status === 'en_cours' && (
                                    <View style={{ marginTop: 8, backgroundColor: '#DCFCE7', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
                                        <SafeIcon name="check" size={14} color="#16A34A" />
                                        <Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 13, marginLeft: 6 }}>{t('covoiturageForm.enCours') || 'En cours'}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })
            )}
        </ScrollView>
    );

    // ─── RENDER: Create Form Tab ─────────────────────────────────────────
    const renderCreateForm = () => (
        <KeyboardAwareScreen
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 100, padding: 16 }}
        >
            {/* Route Section */}
            <View style={s.routeCard}>
                <Text style={s.routeCardTitle}>{t('covoiturageForm.itineraire')}</Text>
                <View style={s.routeInputs}>
                    <View style={{ width: '100%' }}>
                        <Text style={s.routeLabel}>{tr('covoiturageForm.depart', 'Depart *')}</Text>
                        <LocationSelector
                            label={undefined}
                            value={formData.depart ?? ''}
                            onSelect={(loc: LocationObject) => setFormData(prev => ({ ...prev, depart: normalizeSelectedLocation(loc) }))}
                            placeholder={tr('covoiturageForm.lieuDeDepart', 'Lieu de depart...')}
                            scope="all"
                            enrichWithBackend={true}
                            required={true}
                        />
                    </View>
                    <TouchableOpacity style={s.swapBtn} onPress={() => { const t = formData.depart; const tg = selectedGPSDepart; setFormData({ ...formData, depart: formData.destination, destination: t }); setSelectedGPSDepart(selectedGPSDestination); setSelectedGPSDestination(tg); }}>
                        <SafeIcon name="arrow-up-down" size={18} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ width: '100%' }}>
                        <Text style={s.routeLabel}>{tr('covoiturageForm.arrivee', 'Arrivee *')}</Text>
                        <LocationSelector
                            label={undefined}
                            value={formData.destination ?? ''}
                            onSelect={(loc: LocationObject) => setFormData(prev => ({ ...prev, destination: normalizeSelectedLocation(loc) }))}
                            placeholder={tr('covoiturageFormScreen.lieuDArrivee', 'Lieu d\'arrivee...')}
                            scope="all"
                            enrichWithBackend={true}
                            required={true}
                        />
                    </View>
                </View>
                <Text style={s.gpsSectionLabel}>{tr('covoiturageFormScreen.coordonneesGpsOptionnelles', 'Coordonnees GPS (optionnel)')}</Text>
                <View style={s.gpsRow}>
                    <TouchableOpacity style={s.gpsMini} onPress={() => setShowGPSModalDepart(true)} activeOpacity={0.8}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                        <Text style={s.gpsMiniText}>
                            {selectedGPSDepart
                                ? tr('covoiturageFormScreen.gpsDepartDefini', 'GPS depart defini')
                                : tr('covoiturageFormScreen.ajouterGpsDepart', 'Ajouter GPS depart')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.gpsMini} onPress={() => setShowGPSModalDestination(true)} activeOpacity={0.8}>
                        <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                        <Text style={s.gpsMiniText}>
                            {selectedGPSDestination
                                ? tr('covoiturageFormScreen.gpsArriveeDefini', 'GPS arrivee definie')
                                : tr('covoiturageFormScreen.ajouterGpsArrivee', 'Ajouter GPS arrivee')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Date & Time */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>{t('covoiturageForm.dateLabel')}</Text>
                    <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                        <Text style={s.dateBtnText}>{formData.date_depart.toLocaleDateString('fr-FR')}</Text>
                        <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                    {showDatePicker && <DateTimePicker value={formData.date_depart} mode="date" display="default" minimumDate={new Date()} onChange={(_, d) => { setShowDatePicker(false); if (d) setFormData({ ...formData, date_depart: d }); }} />}
                </View>
                <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>{t('covoiturageForm.heureLabel')}</Text>
                    <TouchableOpacity style={s.dateBtn} onPress={() => setShowTimePicker(true)}>
                        <Text style={s.dateBtnText}>{formData.heure_depart}</Text>
                        <SafeIcon name="clock" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                    {showTimePicker && <DateTimePicker value={new Date(`2000-01-01T${formData.heure_depart}`)} mode="time" display="default" onChange={(_, d) => { setShowTimePicker(false); if (d) setFormData({ ...formData, heure_depart: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }); }} />}
                </View>
            </View>

            {/* Vehicle */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>{tr('covoiturageForm.typeVehicule', 'Type de vehicule')}</Text>
                    <TextInput
                        style={s.input}
                        value={formData.type_vehicule}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, type_vehicule: v }))}
                        placeholder={tr('covoiturageForm.exBerline', 'Ex: Berline')}
                    />
                </View>
                <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>{tr('covoiturageForm.marquemodele', 'Marque / modele')}</Text>
                    <TextInput
                        style={s.input}
                        value={formData.marque_modele}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, marque_modele: v }))}
                        placeholder={tr('covoiturageForm.exToyotaCorolla', 'Ex: Toyota Corolla')}
                    />
                </View>
            </View>

            {/* Photo */}
            <View style={s.field}>
                <Text style={s.label}>{t('covoiturageForm.photoDuVehicule')}</Text>
                {formData.image_vehicule ? (
                    <View style={s.imgContainer}>
                        <Image source={{ uri: formData.image_vehicule }} style={s.imgPreview} />
                        <TouchableOpacity style={s.imgRemove} onPress={() => setFormData({ ...formData, image_vehicule: null })}><SafeIcon name="x" size={18} color="#fff" /></TouchableOpacity>
                    </View>
                ) : (
                    <View style={s.imgPickers}>
                        <TouchableOpacity style={s.imgPickerBtn} onPress={() => pickVehicleImage('camera')}><SafeIcon name="camera" size={22} color={modernColors.primary} /><Text style={s.imgPickerText}>{t('covoiturageForm.photo')}</Text></TouchableOpacity>
                        <TouchableOpacity style={s.imgPickerBtn} onPress={() => pickVehicleImage('gallery')}><SafeIcon name="image" size={22} color={modernColors.primary} /><Text style={s.imgPickerText}>{t('covoiturageForm.galerie')}</Text></TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Places & Price */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>{tr('covoiturageForm.placesLabel', 'Places disponibles *')}</Text>
                    <TextInput
                        style={s.input}
                        value={formData.places_disponibles}
                        onChangeText={(value) => {
                            const n = value.replace(/\D/g, '');
                            if (!n || (parseInt(n) >= 1 && parseInt(n) <= 20)) setFormData(prev => ({ ...prev, places_disponibles: n }));
                        }}
                        placeholder="3"
                        keyboardType="numeric"
                    />
                </View>
                <View style={[s.field, { flex: 1 }]}>
                    <Text style={s.label}>{`${tr('covoiturageFormScreen.pricePerSeat', 'Prix par place')} (${formData.devise}) *`}</Text>
                    <TextInput
                        style={s.input}
                        value={formData.prix_par_place}
                        onChangeText={(value) => setFormData(prev => ({ ...prev, prix_par_place: value.replace(/\D/g, '') }))}
                        placeholder="5000"
                        keyboardType="numeric"
                    />
                </View>
            </View>

            {/* Options */}
            <Text style={[s.sectionTitle, { marginTop: 8 }]}>{t('covoiturageForm.options')}</Text>
            {[
                { label: t('covoiturageForm.bagagesAutorises'), key: 'bagages_autorises', icon: 'briefcase' },
                { label: t('covoiturageForm.animauxAutorises'), key: 'animaux_autorises', icon: 'heart' },
                { label: t('covoiturageForm.fumeurAutorise'), key: 'fumeur_autorise', icon: 'wind' },
                { label: t('covoiturageForm.climatisation'), key: 'climatisation', icon: 'thermometer' },
            ].map(opt => (
                <View key={opt.key} style={s.switchRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <SafeIcon name={opt.icon as any} size={16} color="#6B7280" />
                        <Text style={s.switchLabel}>{opt.label}</Text>
                    </View>
                    <Switch value={(formData as any)[opt.key]} onValueChange={v => setFormData({ ...formData, [opt.key]: v })} trackColor={{ false: '#D1D5DB', true: '#6366F1' }} />
                </View>
            ))}

            {/* Recurring */}
            <Text style={[s.sectionTitle, { marginTop: 16 }]}>{t('covoiturageForm.recurrence')}</Text>
            <View style={s.switchRow}>
                <View><Text style={s.switchLabel}>{t('covoiturageForm.trajetRecurrent')}</Text><Text style={s.hint}>{t('covoiturageForm.repeterAutomatiquementCeTrajet')}</Text></View>
                <Switch value={formData.is_recurring} onValueChange={v => setFormData({ ...formData, is_recurring: v })} trackColor={{ false: '#D1D5DB', true: '#6366F1' }} />
            </View>

            {formData.is_recurring && (
                <>
                    <View style={s.field}>
                        <Text style={s.label}>{t('covoiturageForm.type')}</Text>
                        <View style={s.recRow}>
                            {(['daily', 'weekly', 'monthly'] as const).map(recType => (
                                <TouchableOpacity key={recType} style={[s.recBtn, formData.recurrence_type === recType && s.recBtnOn]} onPress={() => setFormData({ ...formData, recurrence_type: recType })}>
                                    <Text style={[s.recBtnText, formData.recurrence_type === recType && s.recBtnTextOn]}>{{ daily: t('covoiturageForm.quotidien'), weekly: t('covoiturageForm.hebdo'), monthly: t('covoiturageForm.mensuel') }[recType]}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    {formData.recurrence_type === 'weekly' && (
                        <View style={s.field}>
                            <Text style={s.label}>{t('covoiturageForm.jours')}</Text>
                            <View style={s.daysRow}>
                                {[{ v: 1, l: t('covoiturageForm.dayMon') || 'L' }, { v: 2, l: t('covoiturageForm.dayTue') || 'M' }, { v: 3, l: t('covoiturageForm.dayWed') || 'M' }, { v: 4, l: t('covoiturageForm.dayThu') || 'J' }, { v: 5, l: t('covoiturageForm.dayFri') || 'V' }, { v: 6, l: t('covoiturageForm.daySat') || 'S' }, { v: 7, l: t('covoiturageForm.daySun') || 'D' }].map(d => {
                                    const on = formData.recurrence_days.includes(d.v);
                                    return <TouchableOpacity key={d.v} style={[s.dayBtn, on && s.dayBtnOn]} onPress={() => setFormData({ ...formData, recurrence_days: on ? formData.recurrence_days.filter(x => x !== d.v) : [...formData.recurrence_days, d.v].sort() })}><Text style={[s.dayBtnText, on && s.dayBtnTextOn]}>{d.l}</Text></TouchableOpacity>;
                                })}
                            </View>
                        </View>
                    )}
                    <View style={s.field}>
                        <Text style={s.label}>{t('covoiturageForm.dateDeFin')}</Text>
                        <TouchableOpacity style={s.dateBtn} onPress={() => setShowRecurrenceEndDatePicker(true)}>
                            <Text style={s.dateBtnText}>{formData.recurrence_end_date ? formData.recurrence_end_date.toLocaleDateString('fr-FR') : t('covoiturageForm.sansFin')}</Text>
                            <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                        </TouchableOpacity>
                        {showRecurrenceEndDatePicker && <DateTimePicker value={formData.recurrence_end_date || new Date(Date.now() + 30 * 86400000)} mode="date" display="default" minimumDate={new Date(Date.now() + 86400000)} onChange={(_, d) => { setShowRecurrenceEndDatePicker(false); if (d) setFormData({ ...formData, recurrence_end_date: d }); }} />}
                    </View>
                </>
            )}

            <NativeButton
                title={loading ? t('covoiturageFormScreen.creation') : (mode === 'edit' ? t('covoiturageFormScreen.mettreAJour') : t('covoiturageFormScreen.creerLeTrajet'))}
                onPress={handleSubmit}
                disabled={loading}
                variant="primary" size="large" style={{ marginTop: 24 }}
            />
        </KeyboardAwareScreen>
    );

    // ─── RENDER: Stats Tab ───────────────────────────────────────────────
    const renderStatsTab = () => {
        const totalPlaces = myTrips.reduce((s, t) => s + (t.places_disponibles || 0), 0);
        const totalRevenuePotential = myTrips.reduce((s, t) => s + ((t.prix_par_place || 0) * (t.places_disponibles || 0)), 0);
        const recurringCount = myTrips.filter(t => t.is_recurring).length;
        const upcomingCount = myTrips.filter(t => t.date_depart && new Date(t.date_depart) >= new Date()).length;
        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <View style={s.analyticsCard}>
                    <View style={s.analyticsHdr}><SafeIcon name="bar-chart-2" size={22} color="#6366F1" /><Text style={s.analyticsTitle}>{t('covoiturageForm.vueDensemble')}</Text></View>
                    {[
                        { l: t('covoiturageForm.trajetsTotaux'), v: myTrips.length },
                        { l: t('covoiturageFormScreen.trajetsAVenir'), v: upcomingCount },
                        { l: t('covoiturageFormScreen.trajetsRecurrents'), v: recurringCount },
                        { l: t('covoiturageForm.placesOffertes'), v: totalPlaces },
                        { l: t('covoiturageForm.revenuPotentiel'), v: `${totalRevenuePotential.toLocaleString()} ${devise}`, c: '#10B981' },
                    ].map((r, i) => (
                        <View key={i} style={s.analyticsRow}><Text style={s.analyticsLbl}>{r.l}</Text><Text style={[s.analyticsVal, r.c ? { color: r.c } : {}]}>{r.v}</Text></View>
                    ))}
                </View>
            </ScrollView>
        );
    };

    // ─── RENDER: Dashboard Layout ────────────────────────────────────────
    const tabs: { key: TabType; label: string; icon: string }[] = [
        { key: 'trips', label: t('covoiturageForm.mesTrajets'), icon: 'map' },
        { key: 'create', label: t('covoiturageFormScreen.nouveau'), icon: 'plus-circle' },
        { key: 'stats', label: t('covoiturageForm.stats'), icon: 'bar-chart-2' },
    ];

    return (
        <View style={s.container}>
            <LinearGradient colors={['#4338CA', '#6366F1']} style={s.dashHeader}>
                <View style={s.dashHeaderRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><SafeIcon name="arrow-left" size={24} color="#fff" /></TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.dashTitle}>{hasPreviousTrips ? t('covoiturageForm.mesCovoiturages') : t('covoiturageForm.proposerCovoiturage')}</Text>
                        <Text style={s.dashSub}>{myTrips.length > 0 ? `${myTrips.length} ${t('covoiturageFormScreen.tripCreated')}${myTrips.length > 1 ? 's' : ''}` : t('covoiturageFormScreen.shareYourTrips')}</Text>
                    </View>
                </View>
                {hasPreviousTrips && (
                    <View style={s.tabsRow}>
                        {tabs.map(t => (
                            <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabOn]} onPress={() => setActiveTab(t.key)}>
                                <SafeIcon name={t.icon as any} size={14} color={activeTab === t.key ? '#fff' : '#ffffff70'} />
                                <Text style={[s.tabText, activeTab === t.key && s.tabTextOn]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </LinearGradient>
            <View style={s.dashContent}>
                {activeTab === 'trips' && renderTripsTab()}
                {activeTab === 'create' && renderCreateForm()}
                {activeTab === 'stats' && renderStatsTab()}
            </View>
            <ModernGPSModal visible={showGPSModalDepart} onClose={() => setShowGPSModalDepart(false)} onSelect={(c: string) => { setSelectedGPSDepart(c); setShowGPSModalDepart(false); }} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title={t('covoiturageForm.gpsDepart')} />
            <ModernGPSModal visible={showGPSModalDestination} onClose={() => setShowGPSModalDestination(false)} onSelect={(c: string) => { setSelectedGPSDestination(c); setShowGPSModalDestination(false); }} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title={t('covoiturageForm.gpsArrivee')} />
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

    tabsRow: { flexDirection: 'row', gap: 4, paddingBottom: 8 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ffffff15' },
    tabOn: { backgroundColor: '#ffffff30' },
    tabText: { fontSize: 11, color: '#ffffff70', fontWeight: '500' },
    tabTextOn: { color: '#fff', fontWeight: '700' },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    statCard: { flex: 1, minWidth: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
    statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
    statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },

    quickRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: { flex: 1, alignItems: 'center', gap: 6 },
    quickIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: 11, color: '#374151', fontWeight: '500', textAlign: 'center' },

    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },

    emptyDash: { alignItems: 'center', padding: 32, backgroundColor: '#fff', borderRadius: 12, marginTop: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 },
    emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // Trip Card
    tripCard: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    tripRoute: { alignItems: 'center', width: 16, paddingTop: 4 },
    tripDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
    tripLine: { width: 2, height: 20, backgroundColor: '#D1D5DB', marginVertical: 2 },
    tripFrom: { fontSize: 15, fontWeight: '600', color: '#111827' },
    tripTo: { fontSize: 14, color: '#6B7280', marginTop: 2 },
    tripMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
    tripDate: { fontSize: 12, color: '#6B7280' },
    tripPrice: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
    tripBadges: { flexDirection: 'row', gap: 6, marginTop: 6 },
    tripBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#EEF2FF', borderRadius: 6 },
    tripBadgeText: { fontSize: 11, fontWeight: '600', color: '#6366F1' },

    // Form
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
        fontSize: 16,
        color: '#111827',
    },
    hint: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingVertical: 6 },
    switchLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },

    // Route Card
    routeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    routeCardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    routeInputs: { gap: 8 },
    routeLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
    swapBtn: { alignSelf: 'center', width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
    gpsSectionLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 4, marginBottom: 8 },
    gpsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    gpsMini: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
    gpsMiniText: { fontSize: 12, color: '#374151', fontWeight: '500' },

    // Date
    dateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8 },
    dateBtnText: { fontSize: 15, fontWeight: '500', color: '#111827' },

    // Image
    imgContainer: { position: 'relative' },
    imgPreview: { width: '100%', height: 160, borderRadius: 12 },
    imgRemove: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    imgPickers: { flexDirection: 'row', gap: 12 },
    imgPickerBtn: { flex: 1, alignItems: 'center', gap: 8, padding: 20, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, borderStyle: 'dashed' },
    imgPickerText: { fontSize: 13, color: modernColors.primary, fontWeight: '500' },

    // Recurrence
    recRow: { flexDirection: 'row', gap: 8 },
    recBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    recBtnOn: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    recBtnText: { fontSize: 13, fontWeight: '500', color: '#374151' },
    recBtnTextOn: { color: '#fff', fontWeight: '700' },
    daysRow: { flexDirection: 'row', gap: 6 },
    dayBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    dayBtnOn: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    dayBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
    dayBtnTextOn: { color: '#fff' },

    // Analytics
    analyticsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
    analyticsHdr: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    analyticsTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    analyticsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    analyticsLbl: { fontSize: 14, color: '#6B7280' },
    analyticsVal: { fontSize: 16, fontWeight: '700', color: '#111827' },
});

export default CovoiturageFormScreen;
