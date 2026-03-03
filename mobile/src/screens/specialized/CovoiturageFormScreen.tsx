// ✅ Écran de création/édition de trajets de covoiturage (accessible à tous les utilisateurs)
// Permet à n'importe quel utilisateur d'intégrer son véhicule pour le covoiturage

import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ConfirmationSection } from '../../components/FormConfirmationModal';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const COVOITURAGE_FORM_STORAGE_KEY = '@covoiturage_last_form_data';

const CovoiturageFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    // ✅ NOUVEAU: Détection automatique de devise
    const detectedCurrency = useCurrencyDetection(formData.depart || formData.destination || null);

    const [formData, setFormData] = useState({
        depart: null as LocationObject | null,
        destination: null as LocationObject | null,
        date_depart: new Date(),
        heure_depart: '08:00',
        type_vehicule: '',
        marque_modele: '',
        places_disponibles: '3', // ✅ Valeur par défaut 3
        prix_par_place: '',
        devise: 'XAF', // ✅ Sera récupéré automatiquement depuis depart/destination
        bagages_autorises: true,
        animaux_autorises: false,
        fumeur_autorise: false,
        climatisation: false,
        image_vehicule: null as string | null, // ✅ NOUVEAU : Image du véhicule
        // ✅ NOUVEAU 2025-01-29: Trajets récurrents
        is_recurring: false,
        recurrence_type: null as 'daily' | 'weekly' | 'monthly' | null,
        recurrence_days: [] as number[], // Jours de la semaine (1=lundi, 7=dimanche)
        recurrence_end_date: null as Date | null,
    });

    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const { partnerData } = usePartnerData(user?.role);
    const { errors, validateField, validateForm, setError } = useFormValidation({
        depart: { required: true },
        destination: { required: true },
        places_disponibles: {
            required: true,
            custom: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > 50) {
                    return 'Entre 1 et 50 places';
                }
                return null;
            }
        },
        prix_par_place: { required: true },
    });

    useFormAutoSave(COVOITURAGE_FORM_STORAGE_KEY, formData, mode !== 'edit', 1000);

    // ✅ AMÉLIORÉ: Fonction pour sélectionner une image du véhicule (galerie ou caméra)
    const pickVehicleImage = async (source: 'gallery' | 'camera') => {
        try {
            if (source === 'camera') {
                const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
                if (!permissionResult.granted) {
                    Alert.alert('Permission refusée', 'Permission d\'accès à la caméra refusée');
                    return;
                }
            } else {
                const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!permissionResult.granted) {
                    Alert.alert('Permission refusée', 'Permission d\'accès à la galerie refusée');
                    return;
                }
            }

            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({
                    allowsEditing: true,
                    quality: 0.8,
                    base64: true,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: 'images' as any,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: true,
                });

            if (!result.canceled && result.assets[0]) {
                const base64 = result.assets[0].base64;
                const imageUri = result.assets[0].uri;
                if (base64) {
                    setFormData({ ...formData, image_vehicule: `data:image/jpeg;base64,${base64}` });
                } else {
                    setFormData({ ...formData, image_vehicule: imageUri });
                }
            }
        } catch (error) {
            console.error('[CovoiturageFormScreen] Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    // ✅ NOUVEAU : Mise à jour automatique de la devise depuis détection intelligente
    useEffect(() => {
        if (detectedCurrency && detectedCurrency !== formData.devise) {
            setFormData(prev => ({ ...prev, devise: detectedCurrency }));
        }
    }, [detectedCurrency]);

    // ✅ NOUVEAU : Charger les données sauvegardées au montage
    useEffect(() => {
        const loadSavedFormData = async () => {
            try {
                const savedData = await AsyncStorage.getItem(COVOITURAGE_FORM_STORAGE_KEY);
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    // Restaurer les données sauf si on est en mode edit
                    if (mode !== 'edit') {
                        setFormData(prev => ({
                            ...prev,
                            type_vehicule: parsed.type_vehicule || prev.type_vehicule,
                            marque_modele: parsed.marque_modele || prev.marque_modele,
                            places_disponibles: parsed.places_disponibles || prev.places_disponibles,
                            prix_par_place: parsed.prix_par_place || prev.prix_par_place,
                            bagages_autorises: parsed.bagages_autorises !== undefined ? parsed.bagages_autorises : prev.bagages_autorises,
                            animaux_autorises: parsed.animaux_autorises !== undefined ? parsed.animaux_autorises : prev.animaux_autorises,
                            fumeur_autorise: parsed.fumeur_autorise !== undefined ? parsed.fumeur_autorise : prev.fumeur_autorise,
                            climatisation: parsed.climatisation !== undefined ? parsed.climatisation : prev.climatisation,
                        }));
                    }
                }
            } catch (error) {
                console.error('[CovoiturageFormScreen] Erreur chargement données sauvegardées:', error);
            }
        };
        loadSavedFormData();
    }, [mode]);

    // ✅ NOUVEAU : Sauvegarder les données du formulaire à chaque modification
    useEffect(() => {
        const saveFormData = async () => {
            try {
                const dataToSave = {
                    type_vehicule: formData.type_vehicule,
                    marque_modele: formData.marque_modele,
                    places_disponibles: formData.places_disponibles,
                    prix_par_place: formData.prix_par_place,
                    bagages_autorises: formData.bagages_autorises,
                    animaux_autorises: formData.animaux_autorises,
                    fumeur_autorise: formData.fumeur_autorise,
                    climatisation: formData.climatisation,
                };
                await AsyncStorage.setItem(COVOITURAGE_FORM_STORAGE_KEY, JSON.stringify(dataToSave));
            } catch (error) {
                console.error('[CovoiturageFormScreen] Erreur sauvegarde données:', error);
            }
        };
        // Sauvegarder seulement si on n'est pas en mode edit
        if (mode !== 'edit') {
            saveFormData();
        }
    }, [formData.type_vehicule, formData.marque_modele, formData.places_disponibles, formData.prix_par_place, formData.bagages_autorises, formData.animaux_autorises, formData.fumeur_autorise, formData.climatisation, mode]);
    const [showGPSModalDepart, setShowGPSModalDepart] = useState(false);
    const [showGPSModalDestination, setShowGPSModalDestination] = useState(false);
    const [selectedGPSDepart, setSelectedGPSDepart] = useState<string | null>(null);
    const [selectedGPSDestination, setSelectedGPSDestination] = useState<string | null>(null);

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.depart && formData.destination) {
                try {
                    const departStr = formData.depart.raw || formData.depart.place_name || '';
                    const destStr = formData.destination.raw || formData.destination.place_name || '';
                    const serviceData = {
                        titre_service: `Covoiturage ${departStr} → ${destStr}`,
                        description: 'Trajet de covoiturage',
                        category: 'transport',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[CovoiturageFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.depart && formData.destination) {
            createServiceIfNeeded();
        }
    }, [formData.depart, formData.destination, serviceId, user?.id]);

    // ✅ NOUVEAU : Charger les données existantes si mode='edit' et specializedServiceId fourni
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && specializedServiceId && serviceId) {
                try {
                    setLoading(true);
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet(`/api/covoiturages/${specializedServiceId}`);

                    if (response.success && response.data) {
                        const data = response.data;

                        // Parser date_depart si c'est une string
                        let dateDepart = new Date();
                        if (data.date_depart) {
                            if (typeof data.date_depart === 'string') {
                                dateDepart = new Date(data.date_depart);
                            } else {
                                dateDepart = new Date(data.date_depart);
                            }
                        }

                        // Parser recurrence_end_date si présent
                        let recurrenceEndDate = null as Date | null;
                        if (data.recurrence_end_date) {
                            if (typeof data.recurrence_end_date === 'string') {
                                recurrenceEndDate = new Date(data.recurrence_end_date);
                            } else {
                                recurrenceEndDate = new Date(data.recurrence_end_date);
                            }
                        }

                        setFormData({
                            depart: data.depart ? { raw: data.depart, place_name: data.depart } : null,
                            destination: data.destination ? { raw: data.destination, place_name: data.destination } : null,
                            date_depart: dateDepart,
                            heure_depart: data.heure_depart || '08:00',
                            type_vehicule: data.type_vehicule || '',
                            marque_modele: data.marque_modele || '',
                            image_vehicule: data.image_vehicule || null,
                            places_disponibles: data.places_disponibles ? String(data.places_disponibles) : '3',
                            prix_par_place: data.prix_par_place ? String(data.prix_par_place) : '',
                            devise: data.devise || 'XAF',
                            bagages_autorises: data.bagages_autorises !== undefined ? data.bagages_autorises : true,
                            animaux_autorises: data.animaux_autorises || false,
                            fumeur_autorise: data.fumeur_autorise || false,
                            climatisation: data.climatisation || false,
                            // ✅ NOUVEAU 2025-01-29: Trajets récurrents
                            is_recurring: data.is_recurring || false,
                            recurrence_type: data.recurrence_type || null,
                            recurrence_days: data.recurrence_days ? data.recurrence_days.map((d: number) => Number(d)) : [],
                            recurrence_end_date: recurrenceEndDate,
                        });

                        if (data.gps_depart) {
                            setSelectedGPSDepart(data.gps_depart);
                        }
                        if (data.gps_destination) {
                            setSelectedGPSDestination(data.gps_destination);
                        }
                    }
                } catch (error: any) {
                    console.error('[CovoiturageFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, specializedServiceId, serviceId]);

    const handleGPSSelectDepart = (coordinates: string) => {
        setSelectedGPSDepart(coordinates);
        setShowGPSModalDepart(false);
    };

    const handleGPSSelectDestination = (coordinates: string) => {
        setSelectedGPSDestination(coordinates);
        setShowGPSModalDestination(false);
    };

    const handleFieldChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
        const error = validateField(field, value);
        if (error) {
            setError(field, error);
        }
    };

    const confirmationSections: ConfirmationSection[] = [
        {
            title: 'Trajet',
            icon: 'map-pin',
            fields: [
                { label: 'Départ', value: formData.depart?.place_name || '' },
                { label: 'Destination', value: formData.destination?.place_name || '' },
                { label: 'Date', value: formData.date_depart.toLocaleDateString('fr-FR') },
                { label: 'Heure', value: formData.heure_depart },
            ],
        },
        {
            title: 'Véhicule',
            icon: 'car',
            fields: [
                { label: 'Type', value: formData.type_vehicule },
                { label: 'Marque/Modèle', value: formData.marque_modele },
                { label: 'Places disponibles', value: formData.places_disponibles, type: 'number' as const },
            ],
        },
        {
            title: 'Tarif',
            icon: 'dollar-sign',
            fields: [
                { label: 'Prix par place', value: `${formData.prix_par_place} ${formData.devise}` },
            ],
        },
        {
            title: 'Options',
            icon: 'check-circle',
            fields: [
                { label: 'Bagages autorisés', value: formData.bagages_autorises, type: 'boolean' as const },
                { label: 'Animaux autorisés', value: formData.animaux_autorises, type: 'boolean' as const },
                { label: 'Fumeur autorisé', value: formData.fumeur_autorise, type: 'boolean' as const },
                { label: 'Climatisation', value: formData.climatisation, type: 'boolean' as const },
                { label: 'Trajet récurrent', value: formData.is_recurring, type: 'boolean' as const },
            ],
        },
    ];

    const handleSubmit = () => {
        if (!validateForm(formData)) {
            Alert.alert('Erreur', 'Veuillez corriger les erreurs du formulaire');
            return;
        }
        setShowConfirmation(true);
    };

    const handleFinalSubmit = async () => {
        // ✅ Créer le service si nécessaire
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                setLoading(true);
                const departStr = formData.depart?.raw || formData.depart?.place_name || '';
                const destStr = formData.destination?.raw || formData.destination?.place_name || '';
                const serviceData = {
                    titre_service: `Covoiturage ${departStr} → ${destStr}`,
                    description: 'Trajet de covoiturage',
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
                console.error('[CovoiturageFormScreen] Erreur création service:', error);
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

        if (!formData.depart || !formData.destination) {
            Alert.alert('Erreur', 'Le point de départ et la destination sont obligatoires');
            setLoading(false);
            return;
        }

        if (!formData.prix_par_place.trim()) {
            Alert.alert('Erreur', 'Le prix par place est obligatoire');
            setLoading(false);
            return;
        }

        // ✅ NOUVEAU: Validation date de départ (pas dans le passé)
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const departDate = new Date(formData.date_depart);
        departDate.setHours(0, 0, 0, 0);
        if (departDate < now) {
            Alert.alert('Validation', 'La date de départ ne peut pas être dans le passé');
            setLoading(false);
            return;
        }

        // ✅ NOUVEAU: Validation places disponibles
        const places = parseInt(formData.places_disponibles);
        if (isNaN(places) || places < 1 || places > 50) {
            Alert.alert('Validation', 'Le nombre de places doit être entre 1 et 50');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Formater la date au format ISO 8601
            const dateStr = formData.date_depart.toISOString();

            const payload = {
                service_id: finalServiceId,
                depart: formData.depart.raw || formData.depart.place_name || '',
                destination: formData.destination.raw || formData.destination.place_name || '',
                gps_depart: selectedGPSDepart || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                gps_destination: selectedGPSDestination || null, // À enrichir avec géocodage si nécessaire
                date_depart: dateStr,
                heure_depart: formData.heure_depart,
                type_vehicule: formData.type_vehicule || null,
                marque_modele: formData.marque_modele || null,
                places_disponibles: parseInt(formData.places_disponibles) || 3,
                prix_par_place: parseInt(formData.prix_par_place) || 0,
                devise: formData.devise,
                bagages_autorises: formData.bagages_autorises,
                animaux_autorises: formData.animaux_autorises,
                fumeur_autorise: formData.fumeur_autorise,
                climatisation: formData.climatisation,
                image_vehicule: formData.image_vehicule || null, // ✅ NOUVEAU : Image du véhicule
                // ✅ NOUVEAU 2025-01-29: Trajets récurrents
                is_recurring: formData.is_recurring,
                recurrence_type: formData.recurrence_type || null,
                recurrence_days: formData.recurrence_days.length > 0 ? formData.recurrence_days.map(d => Number(d)) : null,
                recurrence_end_date: formData.recurrence_end_date ? formData.recurrence_end_date.toISOString().split('T')[0] : null, // Format YYYY-MM-DD
            };

            const response = await apiPost('/api/covoiturages', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Trajet de covoiturage créé avec succès !',
                    [
                        {
                            text: 'Voir mes trajets',
                            onPress: () => navigation.navigate('MyTrips' as never)
                        },
                        {
                            text: 'OK',
                            style: 'cancel',
                            onPress: () => navigation.goBack()
                        }
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer le trajet');
            }
        } catch (error: any) {
            console.error('Erreur création covoiturage:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
            setShowConfirmation(false);
        }
    };

    return (
        <>
            <KeyboardAwareScreen style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Proposer un Covoiturage</Text>
                </View>

                <View style={styles.form}>
                    {/* ✅ AMÉLIORÉ: Champs départ et destination compacts côte à côte */}
                    <View style={styles.routeContainer}>
                        <View style={styles.routeRow}>
                            {/* Départ */}
                            <View style={styles.routeInputContainer}>
                                <Text style={styles.routeLabel}>
                                    <SafeIcon name="map-pin" size={12} color={modernColors.primary} type="lucide" /> Départ *
                                </Text>
                                <LocationSelector
                                    label=""
                                    value={formData.depart ? (typeof formData.depart === 'string' ? { raw: formData.depart, place_name: formData.depart } : formData.depart) : ''}
                                    onSelect={(location: LocationObject) => {
                                        setFormData({ ...formData, depart: location });
                                    }}
                                    placeholder="Lieu de départ (ville, quartier, adresse...)"
                                    scope="all"
                                    enrichWithBackend
                                    required
                                />
                            </View>

                            {/* Bouton d'échange */}
                            <TouchableOpacity
                                style={styles.swapButton}
                                onPress={() => {
                                    const temp = formData.depart;
                                    const tempGPS = selectedGPSDepart;
                                    setFormData({ ...formData, depart: formData.destination, destination: temp });
                                    setSelectedGPSDepart(selectedGPSDestination);
                                    setSelectedGPSDestination(tempGPS);
                                }}
                            >
                                <SafeIcon name="arrow-up-down" size={18} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>

                            {/* Destination */}
                            <View style={styles.routeInputContainer}>
                                <Text style={styles.routeLabel}>
                                    <SafeIcon name="navigation" size={12} color={modernColors.primary} type="lucide" /> Arrivée *
                                </Text>
                                <LocationSelector
                                    label=""
                                    value={formData.destination ? (typeof formData.destination === 'string' ? { raw: formData.destination, place_name: formData.destination } : formData.destination) : ''}
                                    onSelect={(location: LocationObject) => {
                                        setFormData({ ...formData, destination: location });
                                    }}
                                    placeholder="Lieu d'arrivée (ville, quartier, adresse...)"
                                    scope="all"
                                    enrichWithBackend
                                    required
                                />
                            </View>
                        </View>

                        {/* GPS (optionnel, plus compact) */}
                        <View style={styles.gpsRow}>
                            <TouchableOpacity
                                style={styles.gpsButtonCompact}
                                onPress={() => setShowGPSModalDepart(true)}
                            >
                                <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                                <Text style={styles.gpsButtonTextCompact}>
                                    {selectedGPSDepart ? 'GPS départ' : 'GPS départ'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.gpsButtonCompact}
                                onPress={() => setShowGPSModalDestination(true)}
                            >
                                <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                                <Text style={styles.gpsButtonTextCompact}>
                                    {selectedGPSDestination ? 'GPS arrivée' : 'GPS arrivée'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>


                    {/* ✅ AMÉLIORÉ: Date et heure côte à côte */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Date de départ *</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.dateButtonText}>
                                    {formData.date_depart.toLocaleDateString('fr-FR')}
                                </Text>
                                <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={formData.date_depart}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) {
                                            setFormData({ ...formData, date_depart: selectedDate });
                                        }
                                    }}
                                />
                            )}
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Heure de départ *</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Text style={styles.dateButtonText}>
                                    {formData.heure_depart || '08:00'}
                                </Text>
                                <SafeIcon name="clock" size={20} color={modernColors.primary} type="lucide" />
                            </TouchableOpacity>
                            {showTimePicker && (
                                <DateTimePicker
                                    value={new Date(`2000-01-01T${formData.heure_depart || '08:00'}`)}
                                    mode="time"
                                    display="default"
                                    onChange={(event, selectedTime) => {
                                        setShowTimePicker(false);
                                        if (selectedTime) {
                                            const hours = String(selectedTime.getHours()).padStart(2, '0');
                                            const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                                            setFormData({ ...formData, heure_depart: `${hours}:${minutes}` });
                                        }
                                    }}
                                />
                            )}
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Type de véhicule</Text>
                            <NativeInput
                                value={formData.type_vehicule}
                                onChangeText={(text) => setFormData({ ...formData, type_vehicule: text })}
                                placeholder="Ex: Berline"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Marque/Modèle</Text>
                            <NativeInput
                                value={formData.marque_modele}
                                onChangeText={(text) => setFormData({ ...formData, marque_modele: text })}
                                placeholder="Ex: Toyota Corolla"
                            />
                        </View>
                    </View>

                    {/* ✅ AMÉLIORÉ : Image du véhicule (galerie ou caméra) */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Photo du véhicule</Text>
                        {formData.image_vehicule ? (
                            <View style={styles.imageContainer}>
                                <Image
                                    source={{ uri: formData.image_vehicule }}
                                    style={styles.imagePreview}
                                />
                                <TouchableOpacity
                                    style={styles.removeImageButton}
                                    onPress={() => setFormData({ ...formData, image_vehicule: null })}
                                >
                                    <SafeIcon name="x" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.imagePickerContainer}>
                                <TouchableOpacity
                                    style={styles.imagePickerButton}
                                    onPress={() => pickVehicleImage('camera')}
                                >
                                    <SafeIcon name="camera" size={24} color={modernColors.primary} />
                                    <Text style={styles.imagePickerText}>Prendre une photo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.imagePickerButton}
                                    onPress={() => pickVehicleImage('gallery')}
                                >
                                    <SafeIcon name="image" size={24} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.imagePickerText}>Choisir depuis la galerie</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* ✅ AMÉLIORÉ: Places disponibles et Prix sur deux colonnes avec devise intelligente */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Places disponibles *</Text>
                            <NativeInput
                                value={formData.places_disponibles}
                                onChangeText={(text) => {
                                    // ✅ Permettre la saisie d'une seule place
                                    const numValue = text.replace(/[^0-9]/g, '');
                                    if (numValue === '' || (parseInt(numValue) >= 1 && parseInt(numValue) <= 20)) {
                                        setFormData({ ...formData, places_disponibles: numValue });
                                    }
                                }}
                                placeholder="3"
                                keyboardType="numeric"
                                editable={true}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Prix par place *</Text>
                            <View style={styles.priceInputContainer}>
                                <NativeInput
                                    value={formData.prix_par_place}
                                    onChangeText={(text) => {
                                        const numValue = text.replace(/[^0-9]/g, '');
                                        setFormData({ ...formData, prix_par_place: numValue });
                                    }}
                                    placeholder="5000"
                                    keyboardType="numeric"
                                    style={styles.priceInput}
                                />
                                <View style={styles.currencyBadge}>
                                    <Text style={styles.currencyText}>{formData.devise || detectedCurrency}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Bagages autorisés</Text>
                        <Switch
                            value={formData.bagages_autorises}
                            onValueChange={(value) => setFormData({ ...formData, bagages_autorises: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Animaux autorisés</Text>
                        <Switch
                            value={formData.animaux_autorises}
                            onValueChange={(value) => setFormData({ ...formData, animaux_autorises: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Fumeur autorisé</Text>
                        <Switch
                            value={formData.fumeur_autorise}
                            onValueChange={(value) => setFormData({ ...formData, fumeur_autorise: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Climatisation</Text>
                        <Switch
                            value={formData.climatisation}
                            onValueChange={(value) => setFormData({ ...formData, climatisation: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    {/* ✅ NOUVEAU: Section Statistiques (si service existe) */}
                    {serviceId && specializedServiceId && (
                        <View style={styles.statsSection}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="bar-chart" size={20} color={modernColors.primary} type="lucide" />
                                <Text style={styles.sectionTitle}>Statistiques</Text>
                            </View>
                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>
                                        {parseInt(formData.places_disponibles) || 0}
                                    </Text>
                                    <Text style={styles.statLabel}>Places disponibles</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>
                                        {formData.is_recurring ? 'Oui' : 'Non'}
                                    </Text>
                                    <Text style={styles.statLabel}>Récurrent</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>
                                        {formData.prix_par_place ? parseInt(formData.prix_par_place) : 0}
                                    </Text>
                                    <Text style={styles.statLabel}>Prix/place ({formData.devise})</Text>
                                </View>
                            </View>
                            {formData.is_recurring && formData.recurrence_type && (
                                <View style={styles.recurrenceInfo}>
                                    <SafeIcon name="repeat" size={16} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.recurrenceInfoText}>
                                        {formData.recurrence_type === 'daily' ? 'Quotidien' :
                                            formData.recurrence_type === 'weekly' ? 'Hebdomadaire' :
                                                'Mensuel'}
                                        {formData.recurrence_end_date && ` jusqu'au ${formData.recurrence_end_date.toLocaleDateString('fr-FR')}`}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* ✅ NOUVEAU 2025-01-29: Section Trajets Récurrents */}
                    <View style={styles.sectionDivider}>
                        <Text style={styles.sectionTitle}>Trajet Récurrent</Text>
                    </View>

                    <View style={styles.switchGroup}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Trajet récurrent</Text>
                            <Text style={styles.hint}>Créez ce trajet de manière répétée</Text>
                        </View>
                        <Switch
                            value={formData.is_recurring}
                            onValueChange={(value) => setFormData({ ...formData, is_recurring: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    {formData.is_recurring && (
                        <>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Type de récurrence *</Text>
                                <View style={styles.recurrenceTypeContainer}>
                                    {(['daily', 'weekly', 'monthly'] as const).map((type) => {
                                        const labels = {
                                            daily: 'Quotidien',
                                            weekly: 'Hebdomadaire',
                                            monthly: 'Mensuel',
                                        };
                                        const icons = {
                                            daily: 'calendar',
                                            weekly: 'calendar-days',
                                            monthly: 'calendar-range',
                                        };
                                        return (
                                            <TouchableOpacity
                                                key={type}
                                                style={[
                                                    styles.recurrenceTypeButton,
                                                    formData.recurrence_type === type && styles.recurrenceTypeButtonActive,
                                                ]}
                                                onPress={() => setFormData({ ...formData, recurrence_type: type })}
                                            >
                                                <SafeIcon
                                                    name={icons[type]}
                                                    size={20}
                                                    color={formData.recurrence_type === type ? '#fff' : modernColors.primary}
                                                />
                                                <Text
                                                    style={[
                                                        styles.recurrenceTypeText,
                                                        formData.recurrence_type === type && styles.recurrenceTypeTextActive,
                                                    ]}
                                                >
                                                    {labels[type]}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {formData.recurrence_type === 'weekly' && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Jours de la semaine *</Text>
                                    <View style={styles.daysContainer}>
                                        {[
                                            { value: 1, label: 'L' },
                                            { value: 2, label: 'M' },
                                            { value: 3, label: 'M' },
                                            { value: 4, label: 'J' },
                                            { value: 5, label: 'V' },
                                            { value: 6, label: 'S' },
                                            { value: 7, label: 'D' },
                                        ].map((day) => {
                                            const isSelected = formData.recurrence_days.includes(day.value);
                                            return (
                                                <TouchableOpacity
                                                    key={day.value}
                                                    style={[
                                                        styles.dayButton,
                                                        isSelected && styles.dayButtonActive,
                                                    ]}
                                                    onPress={() => {
                                                        const newDays = isSelected
                                                            ? formData.recurrence_days.filter((d) => d !== day.value)
                                                            : [...formData.recurrence_days, day.value].sort();
                                                        setFormData({ ...formData, recurrence_days: newDays });
                                                    }}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.dayButtonText,
                                                            isSelected && styles.dayButtonTextActive,
                                                        ]}
                                                    >
                                                        {day.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Date de fin (optionnelle)</Text>
                                <TouchableOpacity
                                    style={styles.dateButton}
                                    onPress={() => setShowRecurrenceEndDatePicker(true)}
                                >
                                    <Text style={styles.dateButtonText}>
                                        {formData.recurrence_end_date
                                            ? formData.recurrence_end_date.toLocaleDateString('fr-FR')
                                            : 'Sans date de fin'}
                                    </Text>
                                    <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                                </TouchableOpacity>
                                {showRecurrenceEndDatePicker && (
                                    <DateTimePicker
                                        value={formData.recurrence_end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                                        mode="date"
                                        display="default"
                                        minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
                                        onChange={(event, selectedDate) => {
                                            setShowRecurrenceEndDatePicker(false);
                                            if (selectedDate) {
                                                setFormData({ ...formData, recurrence_end_date: selectedDate });
                                            }
                                        }}
                                    />
                                )}
                                {formData.recurrence_end_date && (
                                    <TouchableOpacity
                                        style={styles.clearDateButton}
                                        onPress={() => setFormData({ ...formData, recurrence_end_date: null })}
                                    >
                                        <Text style={styles.clearDateText}>Supprimer la date de fin</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    )}

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Création...' : 'Créer le Trajet'}
                        onPress={handleSubmit}
                        disabled={
                            loading ||
                            !formData.depart ||
                            !formData.destination ||
                            !formData.heure_depart ||
                            !formData.prix_par_place.trim() ||
                            !formData.places_disponibles ||
                            parseInt(formData.places_disponibles) < 1 ||
                            (formData.is_recurring && (!formData.recurrence_type || (formData.recurrence_type === 'weekly' && formData.recurrence_days.length === 0)))
                        }
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>
            </KeyboardAwareScreen>

            {/* Modals */}
            <ModernGPSModal
                visible={showGPSModalDepart}
                onClose={() => setShowGPSModalDepart(false)}
                onSelect={handleGPSSelectDepart}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner GPS départ"
            />

            <ModernGPSModal
                visible={showGPSModalDestination}
                onClose={() => setShowGPSModalDestination(false)}
                onSelect={handleGPSSelectDestination}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner GPS destination"
            />
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
        // ✅ Pas de bouton "créer un service" - header simple
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
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
    dateButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dateButtonText: {
        fontSize: 16,
        color: '#111827',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 12,
        color: '#111827',
    },
    gpsText: {
        marginTop: 4,
        fontSize: 11,
        color: '#6B7280',
    },
    submitButton: {
        marginTop: 24,
    },
    imageContainer: {
        position: 'relative',
        marginTop: 8,
    },
    imagePreview: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    removeImageButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#DC2626',
        borderRadius: 20,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePickerContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    imagePickerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    imagePickerText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    sectionDivider: {
        marginTop: 24,
        marginBottom: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    hint: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    recurrenceTypeContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    recurrenceTypeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    recurrenceTypeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    recurrenceTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    recurrenceTypeTextActive: {
        color: '#fff',
    },
    daysContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        flexWrap: 'wrap',
    },
    dayButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dayButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    dayButtonTextActive: {
        color: '#fff',
    },
    clearDateButton: {
        marginTop: 8,
        padding: 8,
    },
    clearDateText: {
        fontSize: 12,
        color: '#DC2626',
        fontWeight: '600',
    },
    // ✅ NOUVEAU: Styles pour champs route compacts
    routeContainer: {
        marginBottom: 16,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    routeInputContainer: {
        flex: 1,
    },
    routeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    swapButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    gpsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    gpsButtonCompact: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 10,
    },
    gpsButtonTextCompact: {
        fontSize: 11,
        color: '#6B7280',
    },
    // ✅ NOUVEAU: Styles pour prix avec devise
    priceInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    priceInput: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        minWidth: 0, // ✅ Permet de réduire la taille
    },
    currencyBadge: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 12,
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
        minWidth: 50, // ✅ Taille minimale pour la devise
    },
    currencyText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
});

export default CovoiturageFormScreen;

