import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import BusModelForm, { BusModel } from '../../components/bus/BusModelForm';
import CompanySelector, { Company } from '../../components/CompanySelector';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
// ✅ SUPPRIMÉ: PartnerSelector - Les données partenaire sont chargées automatiquement depuis /api/partners/me
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import WeekDaysSelector from '../../components/WeekDaysSelector';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
// ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé)
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiDelete, apiGet, apiPost, apiPut, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

// ✅ SUPPRIMÉ : ScheduleDay interface (planning hebdomadaire supprimé)

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lundi', short: 'Lun' },
    { value: 2, label: 'Mardi', short: 'Mar' },
    { value: 3, label: 'Mercredi', short: 'Mer' },
    { value: 4, label: 'Jeudi', short: 'Jeu' },
    { value: 5, label: 'Vendredi', short: 'Ven' },
    { value: 6, label: 'Samedi', short: 'Sam' },
    { value: 7, label: 'Dimanche', short: 'Dim' },
];

const AgenceVoyageFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        nom_agence: '', // ✅ Sera rempli automatiquement depuis /api/partners/me
        adresse: '',
        quartier: null as LocationObject | null,
        // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
        services_voyage: [] as string[],
        compagnies_bus: [] as Company[], // ✅ AMÉLIORÉ : Utiliser Company[] au lieu de string[]
        destinations: [] as LocationObject[], // ✅ AMÉLIORÉ : Utiliser LocationObject[] pour utiliser quartier
        heures_ouverture: '08:00',
        heures_fermeture: '18:00',
        jours_ouverture: [] as number[], // ✅ SIMPLIFIÉ : Jours de la semaine uniquement [1,2,3,4,5]
        telephone: '',
        whatsapp: '',
        email: '',
        site_web: '',
        peut_emettre_tickets_bus: false,
        compagnies_affiliees: [] as Company[], // ✅ AMÉLIORÉ : Utiliser Company[] au lieu de string[]
        devise: 'XAF', // ✅ NOUVEAU : Devise récupérée intelligemment depuis quartier
    });

    const [loading, setLoading] = useState(false);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [selectedCompagnies, setSelectedCompagnies] = useState<Company[]>([]);
    const [selectedDestinations, setSelectedDestinations] = useState<LocationObject[]>([]);
    const [selectedAffiliees, setSelectedAffiliees] = useState<Company[]>([]);
    const [showWeekDaysModal, setShowWeekDaysModal] = useState(false);

    // Gestion des modèles de bus
    const [busModels, setBusModels] = useState<BusModel[]>([]);
    const [showBusModelForm, setShowBusModelForm] = useState(false);
    const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    // ✅ SUPPRIMÉ : showScheduleModal et schedule (planning hebdomadaire supprimé)

    // ✅ NOUVEAU: États pour la gestion des horaires de départ
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
    // ✅ NOUVEAU: Données du partenaire pour affichage dans l'en-tête
    const [partnerData, setPartnerData] = useState<any>(null);
    const [showPartnerProfileModal, setShowPartnerProfileModal] = useState(false);
    const [partnerProfileForm, setPartnerProfileForm] = useState({
        name: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        website: '',
    });
    const [scheduleFormData, setScheduleFormData] = useState({
        departure_city: '',
        arrival_city: '',
        departure_times: [] as string[],
        day_of_week: null as number | null,
        notes: '',
    });

    const servicesOptions = ['Billetterie bus', 'Billetterie avion', 'Organisation voyages', 'Visa'];
    // ✅ SUPPRIMÉ : compagniesOptions hardcodées (utiliser CompanySelector dynamique)
    // ✅ SUPPRIMÉ : destinationsOptions hardcodées (utiliser LocationSelector)
    // ✅ SUPPRIMÉ : compagniesAffilieesOptions hardcodées (utiliser CompanySelector dynamique)

    // ✅ NOUVEAU: Charger automatiquement les données partenaire depuis /api/partners/me
    useEffect(() => {
        const loadPartnerData = async () => {
            if (user?.role === 'partenaire' && user?.partner_type === 'agence de voyage') {
                try {
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet('/api/partners/me');
                    if (response.success && response.data) {
                        const partner = response.data;
                        setPartnerData(partner); // ✅ Stocker pour affichage dans l'en-tête
                        // ✅ Pré-remplir silencieusement les champs pour l'envoi au backend (mais ne pas les afficher)
                        setFormData(prev => ({
                            ...prev,
                            nom_agence: partner.name || prev.nom_agence,
                            adresse: partner.address || partner.location_address || prev.adresse,
                            telephone: partner.contact_phone || prev.telephone,
                            email: partner.contact_email || prev.email,
                            quartier: partner.city ? {
                                raw: partner.city,
                                place_name: partner.city,
                                components: {
                                    ville: partner.city,
                                    pays: partner.country,
                                }
                            } : prev.quartier,
                        }));
                    }
                } catch (error) {
                    console.error('[AgenceVoyageFormScreen] Erreur chargement partenaire:', error);
                }
            }
        };
        loadPartnerData();
    }, [user?.role, user?.partner_type]);

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.nom_agence) {
                try {
                    const serviceData = {
                        titre_service: formData.nom_agence || 'Agence de Voyage',
                        description: 'Agence de voyage',
                        category: 'transport',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[AgenceVoyageFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.nom_agence) {
            createServiceIfNeeded();
        }
    }, [formData.nom_agence, serviceId, user?.id]);

    // ✅ NOUVEAU : Charger les données existantes si mode='edit' et specializedServiceId fourni
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && specializedServiceId && serviceId) {
                try {
                    setLoading(true);
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet(`/api/agences-voyage/${specializedServiceId}`);

                    if (response.success && response.data) {
                        const data = response.data;

                        // Convertir compagnies_bus string[] en Company[]
                        const compagniesBus: Company[] = (data.compagnies_bus || []).map((name: string) => ({
                            id: Date.now().toString() + Math.random(),
                            name,
                            type: 'bus' as const
                        }));

                        // Convertir destinations string[] en LocationObject[]
                        const destinations: LocationObject[] = (data.destinations || []).map((dest: string) => ({
                            raw: dest,
                            place_name: dest
                        }));

                        // Convertir compagnies_affiliees string[] en Company[]
                        const compagniesAffiliees: Company[] = (data.compagnies_affiliees || []).map((name: string) => ({
                            id: Date.now().toString() + Math.random(),
                            name,
                            type: 'bus' as const
                        }));

                        // Parser jours_ouverture (peut être string JSON ou array)
                        let joursOuverture: number[] = [];
                        if (data.jours_ouverture) {
                            if (typeof data.jours_ouverture === 'string') {
                                try {
                                    const parsed = JSON.parse(data.jours_ouverture);
                                    // Si c'est un objet (ancien format), extraire tous les jours
                                    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                                        joursOuverture = Array.from(new Set(Object.values(parsed).flat() as number[]));
                                    } else if (Array.isArray(parsed)) {
                                        joursOuverture = parsed;
                                    }
                                } catch {
                                    joursOuverture = [];
                                }
                            } else if (Array.isArray(data.jours_ouverture)) {
                                joursOuverture = data.jours_ouverture;
                            }
                        }

                        setFormData({
                            nom_agence: data.nom_agence || '',
                            partner: null, // ✅ TODO: Charger le partenaire depuis partner_id si disponible
                            adresse: data.adresse || '',
                            quartier: data.quartier ? { raw: data.quartier, place_name: data.quartier } : null,
                            services_voyage: data.services_voyage || [],
                            compagnies_bus: compagniesBus,
                            destinations: destinations,
                            heures_ouverture: data.heures_ouverture || '08:00',
                            heures_fermeture: data.heures_fermeture || '18:00',
                            jours_ouverture: joursOuverture,
                            telephone: data.telephone || '',
                            whatsapp: data.whatsapp || '',
                            email: data.email || '',
                            site_web: data.site_web || '',
                            peut_emettre_tickets_bus: data.peut_emettre_tickets_bus || false,
                            compagnies_affiliees: compagniesAffiliees,
                            devise: data.devise || 'XAF',
                        });

                        setSelectedServices(data.services_voyage || []);
                        setSelectedCompagnies(compagniesBus);
                        setSelectedDestinations(destinations);
                        setSelectedAffiliees(compagniesAffiliees);

                        if (data.gps) {
                            setSelectedGPS(data.gps);
                        }
                    }
                } catch (error: any) {
                    console.error('[AgenceVoyageFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, specializedServiceId, serviceId]);

    // ✅ NOUVEAU: Charger les horaires de départ si agence existe
    useEffect(() => {
        const loadSchedules = async () => {
            if (specializedServiceId && user?.id) {
                try {
                    setLoadingSchedules(true);
                    const response = await apiGet('/api/bus-tickets/agencies/schedules');
                    if (response.success && response.data) {
                        setSchedules(Array.isArray(response.data) ? response.data : []);
                    }
                } catch (error: any) {
                    console.error('[AgenceVoyageFormScreen] Erreur chargement horaires:', error);
                } finally {
                    setLoadingSchedules(false);
                }
            }
        };

        if (specializedServiceId) {
            loadSchedules();
        }
    }, [specializedServiceId, user?.id]);

    const toggleService = (service: string) => {
        setSelectedServices((prev) =>
            prev.includes(service)
                ? prev.filter((s) => s !== service)
                : [...prev, service]
        );
    };

    // ✅ SUPPRIMÉ : toggleCompagnie, toggleDestination, toggleAffiliee (remplacés par CompanySelector et LocationSelector)

    // ✅ NOUVEAU : Récupération automatique de la devise depuis le quartier
    useEffect(() => {
        if (formData.quartier) {
            const currency = getCurrencyIntelligently(
                formData.quartier,
                location?.coords ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                } : null
            );
            if (currency) {
                setFormData(prev => ({ ...prev, devise: currency }));
            }
        }
    }, [formData.quartier]);

    // Fonction pour générer le seat_map automatiquement
    const generateSeatMap = (model: BusModel): any[] => {
        const seatMap: any[] = [];
        const rows = model.rows || Math.ceil(model.total_seats / 4);
        const seatsPerRow = model.seatsPerRow || 4;
        const firstRowSeats = model.firstRowSeats || 2;
        let seatNumber = 1;

        // Première rangée (nombre de places différent)
        for (let col = 1; col <= firstRowSeats; col++) {
            seatMap.push({
                row: 1,
                col: col,
                seat_id: `1-${col}`,
                seat_number: seatNumber++,
                type: 'standard',
                available: true,
            });
        }

        // Rangées suivantes
        for (let row = 2; row <= rows; row++) {
            for (let col = 1; col <= seatsPerRow; col++) {
                if (seatNumber <= model.total_seats) {
                    seatMap.push({
                        row: row,
                        col: col,
                        seat_id: `${row}-${col}`,
                        seat_number: seatNumber++,
                        type: 'standard',
                        available: true,
                    });
                }
            }
        }

        return seatMap;
    };

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleWeekDaysSave = (days: number[]) => {
        setFormData({ ...formData, jours_ouverture: days });
        setShowWeekDaysModal(false);
    };

    // ✅ NOUVEAU: Gestion des horaires de départ
    const handleSaveSchedule = async () => {
        if (!scheduleFormData.departure_city.trim() || !scheduleFormData.arrival_city.trim()) {
            Alert.alert('Erreur', 'Les villes de départ et d\'arrivée sont obligatoires');
            return;
        }

        if (scheduleFormData.departure_times.length === 0) {
            Alert.alert('Erreur', 'Au moins un horaire de départ est requis');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                departure_city: scheduleFormData.departure_city.trim(),
                arrival_city: scheduleFormData.arrival_city.trim(),
                departure_times: scheduleFormData.departure_times,
                day_of_week: scheduleFormData.day_of_week,
                notes: scheduleFormData.notes.trim() || null,
            };

            let response;
            if (editingSchedule) {
                response = await apiPut(`/api/bus-tickets/agencies/schedules/${editingSchedule.id}`, payload);
            } else {
                response = await apiPost('/api/bus-tickets/agencies/schedules', payload);
            }

            if (response.success) {
                Alert.alert('Succès', editingSchedule ? 'Horaire modifié' : 'Horaire créé');
                setShowScheduleModal(false);
                setEditingSchedule(null);
                // Recharger les horaires
                const schedulesResponse = await apiGet('/api/bus-tickets/agencies/schedules');
                if (schedulesResponse.success && schedulesResponse.data) {
                    setSchedules(Array.isArray(schedulesResponse.data) ? schedulesResponse.data : []);
                }
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer l\'horaire');
            }
        } catch (error: any) {
            console.error('Erreur sauvegarde horaire:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const addTime = () => {
        const time = '08:00';
        if (!scheduleFormData.departure_times.includes(time)) {
            setScheduleFormData({
                ...scheduleFormData,
                departure_times: [...scheduleFormData.departure_times, time],
            });
        }
    };

    const removeTime = (index: number) => {
        setScheduleFormData({
            ...scheduleFormData,
            departure_times: scheduleFormData.departure_times.filter((_, i) => i !== index),
        });
    };

    const updateTime = (index: number, newTime: string) => {
        const updated = [...scheduleFormData.departure_times];
        updated[index] = newTime;
        setScheduleFormData({ ...scheduleFormData, departure_times: updated });
    };

    const handleSubmit = async () => {
        // ✅ Créer le service si nécessaire
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                setLoading(true);
                const serviceData = {
                    titre_service: formData.nom_agence || 'Agence de Voyage',
                    description: 'Agence de voyage',
                    category: 'transport',
                };

                const response = await servicesApi.createService(serviceData);
                if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                    finalServiceId = (response.data as any).id;
                    setServiceId(finalServiceId);
                } else {
                    Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                    setLoading(false);
                    return;
                }
            } catch (error: any) {
                console.error('[AgenceVoyageFormScreen] Erreur création service:', error);
                Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                setLoading(false);
                return;
            }
        }

        if (!finalServiceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            setLoading(false);
            return;
        }

        const nom = formData.partner?.name || formData.nom_agence;
        if (!nom.trim()) {
            Alert.alert('Erreur', 'Veuillez sélectionner un partenaire ou saisir le nom de l\'agence');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // ✅ SUPPRIMÉ : planning_hebdomadaire (pas d'utilité selon demande)

            // ✅ Convertir Company[] en string[] pour le backend
            const compagniesBusNames = selectedCompagnies
                .filter(c => c.type === 'bus')
                .map(c => c.name);
            const compagniesAffilieesNames = selectedAffiliees.map(c => c.name);

            // ✅ Convertir LocationObject[] en string[] pour les destinations
            const destinationsNames = selectedDestinations.map(d =>
                d.raw || d.place_name || ''
            ).filter(Boolean);

            const nom = formData.partner?.name || formData.nom_agence;
            const payload = {
                service_id: finalServiceId,
                nom_agence: nom,
                partner_id: formData.partner?.id || null, // ✅ NOUVEAU: ID du partenaire depuis delivery_partners
                adresse: formData.adresse || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                services_voyage: selectedServices.length > 0 ? selectedServices : null,
                compagnies_bus: compagniesBusNames.length > 0 ? compagniesBusNames : null,
                destinations: destinationsNames.length > 0 ? destinationsNames : null,
                heures_ouverture: formData.heures_ouverture || null,
                heures_fermeture: formData.heures_fermeture || null,
                jours_ouverture: formData.jours_ouverture.length > 0
                    ? formData.jours_ouverture
                    : null, // ✅ Format array simple pour jours_ouverture
                telephone: formData.telephone || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
                site_web: formData.site_web || null,
                peut_emettre_tickets_bus: formData.peut_emettre_tickets_bus,
                compagnies_affiliees: compagniesAffilieesNames.length > 0 ? compagniesAffilieesNames : null,
                devise: formData.devise, // ✅ NOUVEAU : Devise récupérée intelligemment
            };

            const response = await apiPost('/api/agences-voyage', payload);

            if (response.success) {
                const agencyId = response.data && typeof response.data === 'object' && 'id' in response.data
                    ? (response.data as any).id
                    : null;

                // Si l'agence peut émettre des tickets bus et qu'il y a des modèles
                if (formData.peut_emettre_tickets_bus && busModels.length > 0 && agencyId) {
                    let successCount = 0;
                    let errorCount = 0;

                    // Créer un produit pour chaque modèle de bus
                    for (const model of busModels) {
                        try {
                            // Générer le seat_map
                            const seatMap = generateSeatMap(model);

                            // Créer le produit
                            const productPayload = {
                                service_id: serviceId,
                                name: model.nom_modele,
                                type: 'ticket_voyage',
                                total_seats: model.total_seats,
                                bus_configuration: {
                                    rows: model.rows || Math.ceil(model.total_seats / 4),
                                    seatsPerRow: model.seatsPerRow || 4,
                                    firstRowSeats: model.firstRowSeats || 2,
                                    allSeatsAvailable: true,
                                },
                                seat_map: seatMap,
                                price_cents: model.prix_base * 100, // Convertir en centimes
                                currency: 'XAF',
                            };

                            const productResponse = await apiPost('/api/bus-tickets/create-product', productPayload);

                            if (productResponse.success && productResponse.data && typeof productResponse.data === 'object' && 'id' in productResponse.data) {
                                const productId = (productResponse.data as any).id;

                                // Lier le produit à l'agence
                            const linkResponse = await apiPost('/api/bus-tickets/link', {
                                agency_id: agencyId,
                                product_id: productId,
                                nom_modele: model.nom_modele,
                                classe: model.classe,
                                equipements: model.equipements,
                            });

                            if (linkResponse.success) {
                                successCount++;
                            } else {
                                errorCount++;
                                console.error('Erreur liaison produit:', linkResponse.error);
                            }
                        } else {
                            errorCount++;
                            console.error('Erreur création produit:', productResponse.error);
                        }
                    } catch (error: any) {
                        errorCount++;
                        console.error('Erreur traitement modèle:', error);
                    }
                }

                // ✅ NOUVEAU: Créer les horaires de départ si des destinations sont configurées
                if (selectedDestinations.length > 0 && formData.peut_emettre_tickets_bus) {
                    // Note: Les horaires peuvent être créés après, via la section dédiée
                    // Ici on ne fait que notifier l'utilisateur
                }

                // Afficher le résultat
                if (successCount > 0) {
                    const message = errorCount > 0
                        ? `Agence créée avec succès !\n${successCount} modèle(s) de bus créé(s).\n${errorCount} erreur(s) lors de la création.`
                        : `Agence créée avec succès !\n${successCount} modèle(s) de bus créé(s) et lié(s).`;

                    Alert.alert('Succès', message, [
                        { text: 'OK', onPress: () => navigation.goBack() }
                    ]);
                } else {
                    Alert.alert(
                        'Agence créée',
                        'L\'agence a été créée, mais aucun modèle de bus n\'a pu être créé.',
                        [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                }
            } else {
                // Pas de modèles de bus, juste confirmer la création de l'agence
                Alert.alert(
                    'Succès',
                    'Agence de voyage enregistrée avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            }
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer l\'agence');
            }
        } catch (error: any) {
            console.error('Erreur création agence:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <KeyboardAwareScreen style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Enregistrer une Agence de Voyage</Text>
                        {/* ✅ NOUVEAU: Afficher le nom du partenaire dans l'en-tête avec bouton de modification */}
                        {user?.role === 'partenaire' && partnerData && (
                            <TouchableOpacity 
                                style={styles.partnerHeader}
                                onPress={() => {
                                    setPartnerProfileForm({
                                        name: partnerData.name || '',
                                        contact_email: partnerData.contact_email || '',
                                        contact_phone: partnerData.contact_phone || '',
                                        address: partnerData.address || partnerData.location_address || '',
                                        website: partnerData.website || '',
                                    });
                                    setShowPartnerProfileModal(true);
                                }}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="building" size={16} color={modernColors.primary} />
                                <Text style={styles.partnerName}>{partnerData.name}</Text>
                                <SafeIcon name="edit-2" size={14} color={modernColors.primary} type="lucide" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.form}>
                    {/* ✅ Masquer les champs redondants pour les partenaires */}
                    {user?.role !== 'partenaire' && (
                        <View style={styles.inputGroup}>
                            <NativeInput
                                label="Nom de l'agence *"
                                value={formData.nom_agence}
                                onChangeText={(text) => setFormData({ ...formData, nom_agence: text })}
                                placeholder="Ex: Agence Centrale"
                            />
                        </View>
                    )}

                    {/* ✅ Localisation avec Google Maps */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Localisation GPS</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPS ? 'Localisation sélectionnée' : 'Sélectionner sur la carte'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        {selectedGPS && (
                            <Text style={styles.gpsText}>{selectedGPS}</Text>
                        )}
                    </View>

                    {/* ✅ Masquer l'adresse pour les partenaires (chargée automatiquement) */}
                    {user?.role !== 'partenaire' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Adresse</Text>
                            <NativeInput
                                value={formData.adresse}
                                onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                                placeholder="Adresse complète"
                                multiline
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier"
                            value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRECTION: Extraire la valeur à stocker (string ou LocationObject selon besoin)
                                const quartierValue = location.raw || location.place_name || '';
                                setFormData({ 
                                    ...formData, 
                                    quartier: quartierValue,
                                    // ✅ NOUVEAU: Extraire automatiquement ville et pays si disponibles
                                    ville: location.components?.ville || formData.ville,
                                    pays: location.components?.pays || formData.pays,
                                });
                            }}
                            placeholder="Rechercher un quartier (inclut ville et pays)..."
                            scope="neighborhood"
                            enrichWithBackend
                        />
                        <Text style={styles.hintText}>
                            Le quartier permet de récupérer automatiquement la ville, le pays et la devise
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Services offerts</Text>
                        <View style={styles.chipsContainer}>
                            {servicesOptions.map((service) => (
                                <TouchableOpacity
                                    key={service}
                                    style={[
                                        styles.chip,
                                        selectedServices.includes(service) && styles.chipSelected,
                                    ]}
                                    onPress={() => toggleService(service)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            selectedServices.includes(service) && styles.chipTextSelected,
                                        ]}
                                    >
                                        {service}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* ✅ AMÉLIORÉ : Compagnies avec distinction bus/vols et ajout dynamique */}
                    <View style={styles.inputGroup}>
                        <CompanySelector
                            label="Compagnies de transport"
                            selected={selectedCompagnies}
                            onSelectionChange={setSelectedCompagnies}
                            placeholder="Ex: Voyages Express, Camair-Co..."
                            hint="Distinguer les compagnies de bus des compagnies aériennes"
                        />
                    </View>

                    {/* ✅ AMÉLIORÉ : Destinations utilisant LocationSelector (comme quartier) */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Destinations</Text>
                        <LocationSelector
                            label="Destination"
                            value={selectedDestinations.length > 0 ? selectedDestinations.map(d => d.place_name || d.raw).join(', ') : ''}
                            onSelect={(value) => {
                                if (value && !selectedDestinations.some(d =>
                                    (d.raw || d.place_name) === (value.raw || value.place_name)
                                )) {
                                    setSelectedDestinations([...selectedDestinations, value]);
                                }
                            }}
                            placeholder="Rechercher une destination (quartier, ville, pays)..."
                            scope="all" // ✅ EXPLICITE: Recherche universelle pour destinations (quartier, ville, pays)
                            enrichWithBackend
                        />
                        {selectedDestinations.length > 0 && (
                            <View style={styles.destinationsList}>
                                {selectedDestinations.map((dest, idx) => (
                                    <View key={idx} style={styles.destinationChip}>
                                        <Text style={styles.destinationText}>
                                            {dest.place_name || dest.raw}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => setSelectedDestinations(
                                                selectedDestinations.filter((_, i) => i !== idx)
                                            )}
                                        >
                                            <SafeIcon name="x" size={16} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ✅ SUPPRIMÉ : Planning hebdomadaire (pas d'utilité) */}

                    {/* ✅ Heures d'ouverture et fermeture */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Heure d'ouverture</Text>
                            <NativeInput
                                value={formData.heures_ouverture}
                                onChangeText={(text) => setFormData({ ...formData, heures_ouverture: text })}
                                placeholder="08:00"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Heure de fermeture</Text>
                            <NativeInput
                                value={formData.heures_fermeture}
                                onChangeText={(text) => setFormData({ ...formData, heures_fermeture: text })}
                                placeholder="18:00"
                            />
                        </View>
                    </View>

                    {/* ✅ SIMPLIFIÉ : Jours d'ouverture (semaine uniquement) */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Jours d'ouverture</Text>
                        <TouchableOpacity
                            style={styles.planningButton}
                            onPress={() => setShowWeekDaysModal(true)}
                        >
                            <SafeIcon name="calendar" size={18} color="#fff" />
                            <Text style={styles.planningButtonText}>
                                {formData.jours_ouverture.length > 0
                                    ? `${formData.jours_ouverture.length} jour(s) sélectionné(s)`
                                    : 'Sélectionner les jours'}
                            </Text>
                        </TouchableOpacity>
                        {formData.jours_ouverture.length > 0 && (
                            <View style={styles.selectedDaysContainer}>
                                {formData.jours_ouverture.map(day => {
                                    const dayLabel = DAYS_OF_WEEK.find(d => d.value === day)?.short || '';
                                    return (
                                        <View key={day} style={styles.selectedDayChip}>
                                            <Text style={styles.selectedDayText}>{dayLabel}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Peut émettre tickets bus</Text>
                        <Switch
                            value={formData.peut_emettre_tickets_bus}
                            onValueChange={(value) => setFormData({ ...formData, peut_emettre_tickets_bus: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    {formData.peut_emettre_tickets_bus && (
                        <View style={styles.inputGroup}>
                            <View style={styles.busModelsHeader}>
                                <Text style={styles.label}>Modèles de bus</Text>
                                <TouchableOpacity
                                    style={styles.addModelButton}
                                    onPress={() => {
                                        setEditingModelIndex(null);
                                        setShowBusModelForm(true);
                                    }}
                                >
                                    <SafeIcon name="plus" size={20} color="#fff" />
                                    <Text style={styles.addModelButtonText}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>

                            {busModels.length === 0 ? (
                                <View style={styles.emptyModelsContainer}>
                                    <Text style={styles.emptyModelsText}>
                                        Aucun modèle de bus configuré
                                    </Text>
                                    <Text style={styles.emptyModelsHint}>
                                        Ajoutez un modèle pour permettre la vente de tickets
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.modelsList}>
                                    {busModels.map((model, index) => (
                                        <View key={index} style={styles.modelCard}>
                                            <View style={styles.modelCardHeader}>
                                                <View>
                                                    <Text style={styles.modelName}>{model.nom_modele}</Text>
                                                    <Text style={styles.modelDetails}>
                                                        {model.classe} • {model.total_seats} places • {model.prix_base.toLocaleString()} FCFA
                                                    </Text>
                                                </View>
                                                <View style={styles.modelActions}>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setEditingModelIndex(index);
                                                            setShowBusModelForm(true);
                                                        }}
                                                        style={styles.editButton}
                                                    >
                                                        <SafeIcon name="edit" size={18} color={modernColors.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            Alert.alert(
                                                                'Supprimer',
                                                                `Voulez-vous supprimer le modèle "${model.nom_modele}" ?`,
                                                                [
                                                                    { text: 'Annuler', style: 'cancel' },
                                                                    {
                                                                        text: 'Supprimer',
                                                                        style: 'destructive',
                                                                        onPress: () => {
                                                                            setBusModels(busModels.filter((_, i) => i !== index));
                                                                        },
                                                                    },
                                                                ]
                                                            );
                                                        }}
                                                        style={styles.deleteButton}
                                                    >
                                                        <SafeIcon name="trash" size={18} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            {model.equipements.length > 0 && (
                                                <View style={styles.equipementsContainer}>
                                                    {model.equipements.map((eq, eqIndex) => (
                                                        <View key={eqIndex} style={styles.equipementChip}>
                                                            <Text style={styles.equipementText}>{eq}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* ✅ AMÉLIORÉ : Compagnies affiliées avec CompanySelector */}
                    <View style={styles.inputGroup}>
                        <CompanySelector
                            label="Compagnies affiliées"
                            selected={selectedAffiliees}
                            onSelectionChange={setSelectedAffiliees}
                            placeholder="Ex: Voyages Express, Amour Mezam..."
                            hint="Compagnies avec lesquelles vous travaillez en partenariat"
                        />
                    </View>

                    {/* ✅ NOUVEAU: Section Gestion des horaires de départ */}
                    {serviceId && specializedServiceId && formData.peut_emettre_tickets_bus && (
                        <View style={styles.schedulesSection}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionTitleContainer}>
                                    <SafeIcon name="clock" size={20} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.sectionTitle}>Horaires de départ</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={() => {
                                        setEditingSchedule(null);
                                        setScheduleFormData({
                                            departure_city: '',
                                            arrival_city: '',
                                            departure_times: [],
                                            day_of_week: null,
                                            notes: '',
                                        });
                                        setShowScheduleModal(true);
                                    }}
                                >
                                    <SafeIcon name="plus" size={18} color="#fff" type="lucide" />
                                    <Text style={styles.addButtonText}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Statistiques */}
                            {schedules.length > 0 && (
                                <View style={styles.statsContainer}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{schedules.length}</Text>
                                        <Text style={styles.statLabel}>Horaires</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>
                                            {new Set(schedules.map((s: any) => `${s.departure_city}-${s.arrival_city}`)).size}
                                        </Text>
                                        <Text style={styles.statLabel}>Routes</Text>
                                    </View>
                                </View>
                            )}

                            {loadingSchedules ? (
                                <Text style={styles.loadingText}>Chargement des horaires...</Text>
                            ) : schedules.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <SafeIcon name="clock" size={48} color="#9CA3AF" type="lucide" />
                                    <Text style={styles.emptyText}>Aucun horaire configuré</Text>
                                    <Text style={styles.emptyHint}>
                                        Ajoutez les horaires de départ pour chaque trajet
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.schedulesList}>
                                    {schedules.map((schedule: any, index: number) => (
                                        <View key={schedule.id || index} style={styles.scheduleCard}>
                                            <View style={styles.scheduleInfo}>
                                                <View style={styles.scheduleHeader}>
                                                    <Text style={styles.scheduleRoute}>
                                                        {schedule.departure_city} → {schedule.arrival_city}
                                                    </Text>
                                                    {schedule.day_of_week !== null && (
                                                        <View style={styles.dayBadge}>
                                                            <Text style={styles.dayText}>
                                                                {DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week)?.label || 'Tous'}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.timesContainer}>
                                                    {schedule.departure_times?.map((time: string, idx: number) => (
                                                        <View key={idx} style={styles.timeChip}>
                                                            <Text style={styles.timeText}>{time}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                                {schedule.notes && (
                                                    <Text style={styles.scheduleNotes}>{schedule.notes}</Text>
                                                )}
                                            </View>
                                            <View style={styles.scheduleActions}>
                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={() => {
                                                        setEditingSchedule(schedule);
                                                        setScheduleFormData({
                                                            departure_city: schedule.departure_city,
                                                            arrival_city: schedule.arrival_city,
                                                            departure_times: schedule.departure_times || [],
                                                            day_of_week: schedule.day_of_week,
                                                            notes: schedule.notes || '',
                                                        });
                                                        setShowScheduleModal(true);
                                                    }}
                                                >
                                                    <SafeIcon name="edit" size={18} color={modernColors.primary} type="lucide" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.actionButton, styles.deleteButton]}
                                                    onPress={() => {
                                                        Alert.alert(
                                                            'Supprimer',
                                                            `Voulez-vous supprimer l'horaire ${schedule.departure_city} → ${schedule.arrival_city} ?`,
                                                            [
                                                                { text: 'Annuler', style: 'cancel' },
                                                                {
                                                                    text: 'Supprimer',
                                                                    style: 'destructive',
                                                                    onPress: async () => {
                                                                        try {
                                                                            setLoading(true);
                                                                            const response = await apiDelete(`/api/bus-tickets/agencies/schedules/${schedule.id}`);
                                                                            if (response.success) {
                                                                                setSchedules(schedules.filter((s: any) => s.id !== schedule.id));
                                                                                Alert.alert('Succès', 'Horaire supprimé');
                                                                            } else {
                                                                                Alert.alert('Erreur', response.error || 'Impossible de supprimer l\'horaire');
                                                                            }
                                                                        } catch (error: any) {
                                                                            console.error('Erreur suppression horaire:', error);
                                                                            Alert.alert('Erreur', 'Impossible de supprimer l\'horaire');
                                                                        } finally {
                                                                            setLoading(false);
                                                                        }
                                                                    },
                                                                },
                                                            ]
                                                        );
                                                    }}
                                                >
                                                    <SafeIcon name="trash-2" size={18} color="#DC2626" type="lucide" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Téléphone</Text>
                        <NativeInput
                            value={formData.telephone}
                            onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                            placeholder="+237 6XX XX XX XX"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>WhatsApp</Text>
                        <NativeInput
                            value={formData.whatsapp}
                            onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                            placeholder="+237 6XX XX XX XX"
                            keyboardType="phone-pad"
                        />
                    </View>

                    {/* ✅ Masquer Email et Site web pour les partenaires (chargés automatiquement) */}
                    {user?.role !== 'partenaire' && (
                        <>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <NativeInput
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                    placeholder="agence@example.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Site web</Text>
                                <NativeInput
                                    value={formData.site_web}
                                    onChangeText={(text) => setFormData({ ...formData, site_web: text })}
                                    placeholder="https://..."
                                    keyboardType="url"
                                    autoCapitalize="none"
                                />
                            </View>
                        </>
                    )}

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Enregistrement...' : 'Enregistrer l\'Agence'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.nom_agence.trim()}
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>

                <BusModelForm
                    visible={showBusModelForm}
                    onClose={() => {
                        setShowBusModelForm(false);
                        setEditingModelIndex(null);
                    }}
                    onSave={(model) => {
                        if (editingModelIndex !== null) {
                            // Modifier modèle existant
                            const updated = [...busModels];
                            updated[editingModelIndex] = model;
                            setBusModels(updated);
                        } else {
                            // Ajouter nouveau modèle
                            setBusModels([...busModels, { ...model, id: Date.now().toString() }]);
                        }
                        setShowBusModelForm(false);
                        setEditingModelIndex(null);
                    }}
                    initialModel={editingModelIndex !== null ? busModels[editingModelIndex] : undefined}
                />
            </KeyboardAwareScreen>

            {/* Modals */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner la localisation"
            />

            {/* ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé) */}

            {/* ✅ SIMPLIFIÉ : WeekDaysSelector pour jours d'ouverture (semaine uniquement) */}
            <WeekDaysSelector
                visible={showWeekDaysModal}
                onClose={() => setShowWeekDaysModal(false)}
                onSave={handleWeekDaysSave}
                initialDays={formData.jours_ouverture}
                title="Sélectionner les jours d'ouverture"
            />

            {/* ✅ NOUVEAU: Modal pour créer/modifier un horaire */}
            <Modal
                visible={showScheduleModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowScheduleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingSchedule ? 'Modifier l\'horaire' : 'Ajouter un horaire'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Ville de départ *</Text>
                                <LocationSelector
                                    label="Ville de départ"
                                    value={scheduleFormData.departure_city ? { raw: scheduleFormData.departure_city, place_name: scheduleFormData.departure_city } : ''}
                                    onSelect={(location: LocationObject) => {
                                        setScheduleFormData({
                                            ...scheduleFormData,
                                            departure_city: location.raw || location.place_name || '',
                                        });
                                    }}
                                    placeholder="Rechercher une ville de départ..."
                                    scope="city"
                                    enrichWithBackend={true}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Ville d'arrivée *</Text>
                                <LocationSelector
                                    label="Ville d'arrivée"
                                    value={scheduleFormData.arrival_city ? { raw: scheduleFormData.arrival_city, place_name: scheduleFormData.arrival_city } : ''}
                                    onSelect={(location: LocationObject) => {
                                        setScheduleFormData({
                                            ...scheduleFormData,
                                            arrival_city: location.raw || location.place_name || '',
                                        });
                                    }}
                                    placeholder="Rechercher une ville d'arrivée..."
                                    scope="city"
                                    enrichWithBackend={true}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Jour de la semaine (optionnel)</Text>
                                <View style={styles.chipsContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.chip,
                                            scheduleFormData.day_of_week === null && styles.chipSelected,
                                        ]}
                                        onPress={() => setScheduleFormData({ ...scheduleFormData, day_of_week: null })}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                scheduleFormData.day_of_week === null && styles.chipTextSelected,
                                            ]}
                                        >
                                            Tous les jours
                                        </Text>
                                    </TouchableOpacity>
                                    {DAYS_OF_WEEK.map((day) => (
                                        <TouchableOpacity
                                            key={day.value}
                                            style={[
                                                styles.chip,
                                                scheduleFormData.day_of_week === day.value && styles.chipSelected,
                                            ]}
                                            onPress={() => setScheduleFormData({ ...scheduleFormData, day_of_week: day.value })}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    scheduleFormData.day_of_week === day.value && styles.chipTextSelected,
                                                ]}
                                            >
                                                {day.short}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.timesHeader}>
                                    <Text style={styles.label}>Horaires de départ *</Text>
                                    <TouchableOpacity style={styles.addTimeButton} onPress={addTime}>
                                        <SafeIcon name="plus" size={16} color="#fff" type="lucide" />
                                        <Text style={styles.addTimeButtonText}>Ajouter</Text>
                                    </TouchableOpacity>
                                </View>
                                {scheduleFormData.departure_times.map((time, index) => (
                                    <View key={index} style={styles.timeInputRow}>
                                        <TextInput
                                            style={styles.timeInput}
                                            value={time}
                                            onChangeText={(text) => updateTime(index, text)}
                                            placeholder="08:00"
                                            keyboardType="numeric"
                                        />
                                        <TouchableOpacity
                                            style={styles.removeTimeButton}
                                            onPress={() => removeTime(index)}
                                        >
                                            <SafeIcon name="x" size={18} color="#DC2626" type="lucide" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {scheduleFormData.departure_times.length === 0 && (
                                    <Text style={styles.hintText}>Aucun horaire. Cliquez sur "Ajouter" pour en créer un.</Text>
                                )}
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Notes (optionnel)</Text>
                                <NativeInput
                                    value={scheduleFormData.notes}
                                    onChangeText={(text) => setScheduleFormData({ ...scheduleFormData, notes: text })}
                                    placeholder="Ex: Départ depuis la gare routière principale"
                                    multiline
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => {
                                    setShowScheduleModal(false);
                                    setEditingSchedule(null);
                                }}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={editingSchedule ? 'Modifier' : 'Ajouter'}
                                onPress={handleSaveSchedule}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={!scheduleFormData.departure_city.trim() || !scheduleFormData.arrival_city.trim() || scheduleFormData.departure_times.length === 0}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal pour modifier le profil partenaire */}
            <Modal
                visible={showPartnerProfileModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowPartnerProfileModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Modifier le profil partenaire</Text>
                            <TouchableOpacity onPress={() => setShowPartnerProfileModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nom de l'agence *</Text>
                                <NativeInput
                                    value={partnerProfileForm.name}
                                    onChangeText={(text) => setPartnerProfileForm({ ...partnerProfileForm, name: text })}
                                    placeholder="Nom de l'agence"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email de contact</Text>
                                <NativeInput
                                    value={partnerProfileForm.contact_email}
                                    onChangeText={(text) => setPartnerProfileForm({ ...partnerProfileForm, contact_email: text })}
                                    placeholder="contact@agence.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Téléphone de contact</Text>
                                <NativeInput
                                    value={partnerProfileForm.contact_phone}
                                    onChangeText={(text) => setPartnerProfileForm({ ...partnerProfileForm, contact_phone: text })}
                                    placeholder="+237 6XX XX XX XX"
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Adresse</Text>
                                <NativeInput
                                    value={partnerProfileForm.address}
                                    onChangeText={(text) => setPartnerProfileForm({ ...partnerProfileForm, address: text })}
                                    placeholder="Adresse complète"
                                    multiline
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Site web</Text>
                                <NativeInput
                                    value={partnerProfileForm.website}
                                    onChangeText={(text) => setPartnerProfileForm({ ...partnerProfileForm, website: text })}
                                    placeholder="https://..."
                                    keyboardType="url"
                                    autoCapitalize="none"
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => setShowPartnerProfileModal(false)}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title="Enregistrer"
                                onPress={async () => {
                                    if (!partnerProfileForm.name.trim()) {
                                        Alert.alert('Erreur', 'Le nom de l\'agence est obligatoire');
                                        return;
                                    }

                                    try {
                                        setLoading(true);
                                        const response = await apiPut('/api/partners/me', {
                                            name: partnerProfileForm.name.trim(),
                                            contact_email: partnerProfileForm.contact_email.trim() || null,
                                            contact_phone: partnerProfileForm.contact_phone.trim() || null,
                                            address: partnerProfileForm.address.trim() || null,
                                            website: partnerProfileForm.website.trim() || null,
                                        });

                                        if (response.success) {
                                            Alert.alert('Succès', 'Profil partenaire mis à jour avec succès');
                                            // Recharger les données du partenaire
                                            const refreshResponse = await apiGet('/api/partners/me');
                                            if (refreshResponse.success && refreshResponse.data) {
                                                setPartnerData(refreshResponse.data);
                                                // Mettre à jour aussi formData
                                                setFormData(prev => ({
                                                    ...prev,
                                                    nom_agence: refreshResponse.data.name || prev.nom_agence,
                                                    telephone: refreshResponse.data.contact_phone || prev.telephone,
                                                    email: refreshResponse.data.contact_email || prev.email,
                                                    adresse: refreshResponse.data.address || refreshResponse.data.location_address || prev.adresse,
                                                }));
                                            }
                                            setShowPartnerProfileModal(false);
                                        } else {
                                            Alert.alert('Erreur', response.error || 'Impossible de mettre à jour le profil');
                                        }
                                    } catch (error: any) {
                                        console.error('Erreur mise à jour profil partenaire:', error);
                                        Alert.alert('Erreur', error.message || 'Une erreur est survenue');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={loading || !partnerProfileForm.name.trim()}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    partnerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    partnerName: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
        flex: 1,
    },
    form: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
    },
    chipTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    gpsText: {
        marginTop: 8,
        fontSize: 12,
        color: '#6B7280',
    },
    planningButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        marginTop: 8,
    },
    planningButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    selectedDaysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    selectedDayChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: `${modernColors.primary}15`,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    selectedDayText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    scheduleSummary: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    destinationsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    destinationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    destinationText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    submitButton: {
        marginTop: 24,
    },
    busModelsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    addModelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    addModelButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyModelsContainer: {
        padding: 20,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyModelsText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    emptyModelsHint: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    modelsList: {
        gap: 12,
    },
    modelCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modelCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    modelName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    modelDetails: {
        fontSize: 13,
        color: '#6B7280',
    },
    modelActions: {
        flexDirection: 'row',
        gap: 12,
    },
    editButton: {
        padding: 8,
    },
    deleteButton: {
        padding: 8,
    },
    equipementsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    equipementChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
    },
    equipementText: {
        fontSize: 11,
        color: '#1E40AF',
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Styles pour la section horaires
    schedulesSection: {
        marginTop: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        padding: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    schedulesList: {
        gap: 12,
    },
    scheduleCard: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    scheduleInfo: {
        flex: 1,
    },
    scheduleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    scheduleRoute: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    dayBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 4,
    },
    dayText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.primary,
    },
    timesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    timeChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    timeText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    scheduleNotes: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
        marginTop: 4,
    },
    scheduleActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    actionButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
    },
    // ✅ NOUVEAU: Styles pour le modal horaires
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalBody: {
        padding: 16,
        maxHeight: 500,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    modalButton: {
        flex: 1,
    },
    timesHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    addTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: modernColors.primary,
        borderRadius: 6,
    },
    addTimeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    timeInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    timeInput: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 14,
        color: '#111827',
    },
    removeTimeButton: {
        padding: 8,
    },
});

export default AgenceVoyageFormScreen;

