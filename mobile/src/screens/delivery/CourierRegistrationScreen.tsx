import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import PaymentMethodSelector from '../../components/PaymentMethodSelector';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useToaster } from '../../components/ToasterProvider';
import TimeSlotPicker from '../../components/delivery/TimeSlotPicker';
import { VEHICLE_TRANSPORT_OPTIONS, type VehicleType } from '../../config/deliveryConfig';
import { useAuth } from '../../contexts/AuthContext';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface DocumentFile {
    uri: string;
    name: string;
    type: string;
    size?: number;
}

// ✅ REFONDU: Liste des types de coursiers disponibles avec labels optimisés
const COURIER_TYPES = [
    { value: 'classic', label: 'Coursier', icon: '📦' },
    { value: 'market_shopping', label: 'Courses Marché', icon: '🛒' },
    { value: 'taxi', label: 'Chauffeur Taxi', icon: '🚕' },
    { value: 'carpooling', label: 'Covoiturage', icon: '🚗' },
    { value: 'moving', label: 'Déménagement', icon: '🚚' },
] as const;

const CourierRegistrationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const toaster = useToaster(); // ✅ NOUVEAU: Pour afficher les toasts de confirmation
    const applicationType = (route.params as any)?.applicationType as 'courier' | 'driver' | undefined; // ✅ NOUVEAU: Type d'application (coursier ou chauffeur)
    const isDriverApplication = applicationType === 'driver'; // ✅ NOUVEAU: Indique si c'est une candidature de chauffeur
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [applicationStatus, setApplicationStatus] = useState<'none' | 'draft' | 'submitted' | 'approved' | 'rejected'>('none');

    // Informations personnelles
    const getCleanName = (name: string | undefined): string => {
        if (!name) return '';
        const cleaned = name.trim().replace(/\s+/g, ' ');
        const parts = cleaned.split(' ');
        if (parts.length >= 4) {
            const firstHalf = parts.slice(0, Math.floor(parts.length / 2)).join(' ');
            const secondHalf = parts.slice(Math.floor(parts.length / 2)).join(' ');
            if (firstHalf === secondHalf) {
                return firstHalf;
            }
        }
        return cleaned;
    };
    const [fullName, setFullName] = useState(getCleanName(user?.name));
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [cityLocation, setCityLocation] = useState<LocationObject | null>(null); // ✅ NOUVEAU: Stocker l'objet LocationObject complet
    const [country, setCountry] = useState('');
    const [countryLocation, setCountryLocation] = useState<LocationObject | null>(null); // ✅ NOUVEAU: Stocker l'objet LocationObject complet
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [idNumber, setIdNumber] = useState('');

    // Transport
    const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
    const [vehicleBrand, setVehicleBrand] = useState('');
    const [vehicleModel, setVehicleModel] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const [vehicleImage, setVehicleImage] = useState<DocumentFile | null>(null); // ✅ NOUVEAU 2026-01-04: Image du moyen de transport
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null); // ✅ NOUVEAU 2026-01-04: Partenaire sélectionné
    const [partners, setPartners] = useState<Array<{ id: number; name: string; is_active: boolean }>>([]); // ✅ NOUVEAU 2026-01-04: Liste des partenaires

    // Documents
    const [idDocument, setIdDocument] = useState<DocumentFile | null>(null);
    const [driverLicense, setDriverLicense] = useState<DocumentFile | null>(null);
    const [vehicleRegistration, setVehicleRegistration] = useState<DocumentFile | null>(null);
    const [insuranceDocument, setInsuranceDocument] = useState<DocumentFile | null>(null);
    const [locationPlan, setLocationPlan] = useState<DocumentFile | null>(null); // ✅ NOUVEAU: Plan de localisation (obligatoire)

    // Disponibilités - ✅ REFONTE: Utiliser TimeSlotPicker avec schedule JSON
    const [availabilitySchedule, setAvailabilitySchedule] = useState<string>('{}');

    // Autres
    const [bio, setBio] = useState('');
    const [experience, setExperience] = useState('');

    // ✅ NOUVEAU: Type de coursier (obligatoire, en haut du formulaire)
    const [courierType, setCourierType] = useState<string>(''); // 'classic' | 'market_shopping' | 'taxi' | 'carpooling' | 'moving'

    // Comptes de paiement
    const [paymentMethod, setPaymentMethod] = useState<any>(null);

    // ✅ NOUVEAU: Ref pour le scroll view (gestion clavier améliorée)
    const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

    useEffect(() => {
        // ✅ OPTIMISÉ: Charger d'abord les données critiques, puis les partenaires en arrière-plan
        checkApplicationStatus();
        loadUserPhoneFromServices();
    }, [user]);

    // ✅ NOUVEAU: Recharger les partenaires quand le type de coursier change
    useEffect(() => {
        if (courierType) {
            loadPartners();
        } else {
            setPartners([]);
            setSelectedPartnerId(null);
        }
    }, [courierType]);

    // ✅ AMÉLIORÉ 2026-01-12: Charger la liste des partenaires actifs selon le type de coursier sélectionné
    const loadPartners = async () => {
        if (!courierType) {
            // Si aucun type de coursier n'est sélectionné, ne pas charger les partenaires
            return;
        }
        try {
            const { apiGet } = require('../../services/api');
            // ✅ NOUVEAU: Filtrer les partenaires selon le type de coursier sélectionné
            let partnerTypesToLoad: string[] = [];
            switch (courierType) {
                case 'classic':
                    partnerTypesToLoad = ['livraison'];
                    break;
                case 'market_shopping':
                    partnerTypesToLoad = ['livraison_courses_marche'];
                    break;
                case 'taxi':
                case 'carpooling':
                    partnerTypesToLoad = ['chauffeur'];
                    break;
                case 'moving':
                    partnerTypesToLoad = ['demenagement'];
                    break;
                default:
                    partnerTypesToLoad = ['livraison', 'livraison_courses_marche', 'demenagement', 'chauffeur'];
            }

            let response;
            try {
                // ✅ CORRIGÉ 2026-01-14: Utiliser l'endpoint public pour les coursiers
                // Charger les partenaires selon les types correspondants
                let partnersList: any[] = [];
                for (const partnerType of partnerTypesToLoad) {
                    try {
                        const responseType = await apiGet(`/api/delivery/partners/public?type=${partnerType}`);
                        const typePartners = responseType.partners || responseType.data?.partners || [];
                        partnersList = [...partnersList, ...typePartners];
                    } catch (err: any) {
                        console.error(`[CourierRegistrationScreen] Erreur chargement partenaires type ${partnerType}:`, err);
                        // ✅ AMÉLIORÉ: Feedback utilisateur pour erreur 403
                        if (err.response?.status === 403) {
                            console.warn(`[CourierRegistrationScreen] Accès refusé pour type ${partnerType} - utilisateur non autorisé`);
                        }
                    }
                }

                // Si toujours aucun, charger tous les partenaires actifs et filtrer côté client
                if (partnersList.length === 0) {
                    try {
                        const responseAll = await apiGet('/api/delivery/partners/public');
                        const allPartners = responseAll.partners || responseAll.data?.partners || [];
                        // Filtrer uniquement les partenaires actifs de type "livraison", "livraison_courses_marche", "demenagement" ou "chauffeur"
                        partnersList = allPartners.filter((p: any) => {
                            const isActive = p.is_active !== false;
                            const partnerType = (p.partner_type || p.partnerType || '').toLowerCase();
                            const validTypes = ['livraison', 'livraison_courses_marche', 'demenagement', 'chauffeur'];
                            return isActive && validTypes.includes(partnerType);
                        });
                    } catch (err: any) {
                        console.error('[CourierRegistrationScreen] Erreur chargement tous les partenaires:', err);
                        if (err.response?.status === 403) {
                            Alert.alert(
                                t('courierRegistration.accessDenied'),
                                t('courierRegistration.accessDeniedMsg')
                            );
                        }
                    }
                }

                // ✅ NOUVEAU: Créer le partenaire "Yukpo" par défaut et le placer en premier
                const yukpoPartner = {
                    id: -1, // ID spécial pour Yukpo (virtuel)
                    name: 'Yukpo',
                    is_active: true,
                    partner_type: 'yukpo', // Type spécial pour Yukpo
                };

                // Vérifier si Yukpo existe déjà dans la liste
                const yukpoExists = partnersList.some((p: any) => p.name?.toLowerCase() === 'yukpo');
                if (!yukpoExists) {
                    // Placer Yukpo en premier
                    partnersList = [yukpoPartner, ...partnersList];
                } else {
                    // Si Yukpo existe, le déplacer en premier
                    const yukpoIndex = partnersList.findIndex((p: any) => p.name?.toLowerCase() === 'yukpo');
                    if (yukpoIndex > 0) {
                        const yukpo = partnersList.splice(yukpoIndex, 1)[0];
                        partnersList = [yukpo, ...partnersList];
                    }
                }

                setPartners(partnersList);

                // ✅ NOUVEAU: Sélectionner Yukpo par défaut s'il n'y a pas de partenaire sélectionné
                if (!selectedPartnerId && partnersList.length > 0) {
                    const yukpoPartner = partnersList.find((p: any) => p.name?.toLowerCase() === 'yukpo');
                    if (yukpoPartner) {
                        setSelectedPartnerId(yukpoPartner.id);
                        console.log('[CourierRegistrationScreen] ✅ Partenaire Yukpo sélectionné par défaut');
                    } else {
                        // Si Yukpo n'existe pas, sélectionner le premier partenaire
                        setSelectedPartnerId(partnersList[0].id);
                        console.log('[CourierRegistrationScreen] ✅ Premier partenaire sélectionné par défaut:', partnersList[0].name);
                    }
                }

                console.log('[CourierRegistrationScreen] ✅ Partenaires chargés:', partnersList.length);
            } catch (apiError: any) {
                // ✅ AMÉLIORÉ 2026-01-14: Gestion d'erreur avec feedback utilisateur
                console.error('[CourierRegistrationScreen] ⚠️ Erreur avec filtres, chargement sans filtre:', apiError);

                // Feedback utilisateur selon le type d'erreur
                if (apiError.response?.status === 403) {
                    Alert.alert(
                        t('courierRegistration.accessDenied'),
                        t('courierRegistration.accessDeniedMsg')
                    );
                    return; // Ne pas continuer si accès refusé
                } else if (apiError.response?.status >= 500) {
                    Alert.alert(
                        t('courierRegistration.serverError'),
                        t('courierRegistration.serverErrorMsg')
                    );
                }

                // Fallback: charger tous les partenaires sans filtre
                try {
                    response = await apiGet('/api/delivery/partners/public');
                    const allPartners = response.partners || response.data?.partners || [];
                    // Filtrer côté client les partenaires actifs
                    const activePartners = allPartners.filter((p: any) => {
                        const isActive = p.is_active !== false;
                        const partnerType = (p.partner_type || p.partnerType || '').toLowerCase();
                        const validTypes = ['livraison', 'livraison_courses_marche', 'demenagement', 'chauffeur'];
                        return isActive && validTypes.includes(partnerType);
                    });

                    // ✅ NOUVEAU: Créer le partenaire "Yukpo" par défaut et le placer en premier
                    const yukpoPartner = {
                        id: -1, // ID spécial pour Yukpo (virtuel)
                        name: 'Yukpo',
                        is_active: true,
                        partner_type: 'yukpo', // Type spécial pour Yukpo
                    };

                    // Vérifier si Yukpo existe déjà dans la liste
                    const yukpoExists = activePartners.some((p: any) => p.name?.toLowerCase() === 'yukpo');
                    if (!yukpoExists) {
                        // Placer Yukpo en premier
                        activePartners.unshift(yukpoPartner);
                    } else {
                        // Si Yukpo existe, le déplacer en premier
                        const yukpoIndex = activePartners.findIndex((p: any) => p.name?.toLowerCase() === 'yukpo');
                        if (yukpoIndex > 0) {
                            const yukpo = activePartners.splice(yukpoIndex, 1)[0];
                            activePartners.unshift(yukpo);
                        }
                    }

                    setPartners(activePartners);

                    // ✅ NOUVEAU: Sélectionner Yukpo par défaut s'il n'y a pas de partenaire sélectionné
                    if (!selectedPartnerId && activePartners.length > 0) {
                        const yukpoPartner = activePartners.find((p: any) => p.name?.toLowerCase() === 'yukpo');
                        if (yukpoPartner) {
                            setSelectedPartnerId(yukpoPartner.id);
                            console.log('[CourierRegistrationScreen] ✅ Partenaire Yukpo sélectionné par défaut (fallback)');
                        } else {
                            // Si Yukpo n'existe pas, sélectionner le premier partenaire
                            setSelectedPartnerId(activePartners[0].id);
                            console.log('[CourierRegistrationScreen] ✅ Premier partenaire sélectionné par défaut (fallback):', activePartners[0].name);
                        }
                    }

                    console.log('[CourierRegistrationScreen] ✅ Partenaires chargés (fallback):', activePartners.length);
                } catch (fallbackError: any) {
                    console.error('[CourierRegistrationScreen] ❌ Erreur lors du fallback:', fallbackError);
                    Alert.alert(
                        t('message.error'),
                        t('courierRegistration.cannotLoadPartners')
                    );
                }
            }
        } catch (error: any) {
            console.error('[CourierRegistrationScreen] ❌ Erreur chargement partenaires:', error);
            // ✅ AMÉLIORÉ 2026-01-14: Feedback utilisateur selon le type d'erreur
            if (error.response?.status === 403) {
                Alert.alert(
                    t('courierRegistration.accessDenied'),
                    t('courierRegistration.accessDeniedMsg')
                );
            } else if (!error.response) {
                // Erreur réseau
                Alert.alert(
                    t('courierRegistration.connectionError'),
                    t('courierRegistration.connectionErrorMsg')
                );
            }
            // En cas d'erreur, créer quand même le partenaire Yukpo par défaut
            const yukpoPartner = {
                id: -1,
                name: 'Yukpo',
                is_active: true,
                partner_type: 'yukpo',
            };
            setPartners([yukpoPartner]);
            if (!selectedPartnerId) {
                setSelectedPartnerId(yukpoPartner.id);
            }
        }
    };

    const hasInitializedNameRef = React.useRef(false);
    useEffect(() => {
        if (user?.name && !hasInitializedNameRef.current) {
            const cleanedName = getCleanName(user.name);
            setFullName(cleanedName);
            hasInitializedNameRef.current = true;
        }
    }, [user?.name]);

    const loadUserPhoneFromServices = async () => {
        if (!user?.id || phone) return;

        try {
            const { apiGet } = require('../../services/api');
            const response = await apiGet('/api/prestataire/services');
            const services = response.data || response;

            if (Array.isArray(services) && services.length > 0) {
                for (const service of services) {
                    const serviceData = service.data || service;
                    const whatsapp = serviceData.whatsapp ||
                        serviceData.whatsapp_contact?.valeur ||
                        serviceData.contact?.whatsapp ||
                        serviceData.contact_whatsapp?.valeur ||
                        serviceData.telephone_whatsapp?.valeur;

                    if (whatsapp && typeof whatsapp === 'string' && whatsapp.trim().length > 0) {
                        setPhone(whatsapp.trim());
                        return;
                    }
                }
            }
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur chargement téléphone depuis services:', error);
        }
    };

    const checkApplicationStatus = async () => {
        if (!user?.id) {
            setCheckingStatus(false);
            return;
        }

        try {
            const { apiGet } = require('../../services/api');
            const response = await apiGet('/api/courier/me');
            const data = response.data || response;

            if (data.application) {
                const status = data.application.status?.toLowerCase() || '';
                if (status.includes('approved')) {
                    setApplicationStatus('approved');
                } else if (status.includes('rejected')) {
                    setApplicationStatus('rejected');
                } else if (status.includes('submitted')) {
                    setApplicationStatus('submitted');
                } else if (status.includes('draft')) {
                    setApplicationStatus('draft');
                    // ✅ NOUVEAU: Charger les données du brouillon si elles existent
                    await loadDraftData(data.application);
                }
            }
            if (data.is_courier && data.courier) {
                setApplicationStatus('approved');
            }
            setCheckingStatus(false);
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur vérification statut:', error);
            setCheckingStatus(false);
        }
    };

    // ✅ NOUVEAU: Charger les données du brouillon dans le formulaire
    const loadDraftData = async (application: any) => {
        try {
            // Les données complètes sont déjà dans application (retournées par /api/courier/me pour les brouillons)
            if (application.profile_data) {
                const profile = application.profile_data;

                // Charger les informations personnelles
                if (profile.personal) {
                    const personal = profile.personal;
                    if (personal.fullName) setFullName(personal.fullName);
                    if (personal.phone) setPhone(personal.phone);
                    if (personal.address) setAddress(personal.address);
                    if (personal.city) {
                        setCity(personal.city);
                        // Créer un LocationObject minimal pour la ville
                        setCityLocation({
                            raw: personal.city,
                            place_name: personal.city,
                            components: { ville: personal.city },
                        });
                    }
                    if (personal.country) {
                        setCountry(personal.country);
                        setCountryLocation({
                            raw: personal.country,
                            place_name: personal.country,
                            components: { pays: personal.country },
                        });
                    }
                    if (personal.dateOfBirth) setDateOfBirth(personal.dateOfBirth);
                    if (personal.idNumber) setIdNumber(personal.idNumber);
                }

                // Charger les informations de transport
                if (profile.transport) {
                    const transport = profile.transport;
                    if (transport.vehicleType) setVehicleType(transport.vehicleType);
                    if (transport.vehicleBrand) setVehicleBrand(transport.vehicleBrand);
                    if (transport.vehicleModel) setVehicleModel(transport.vehicleModel);
                    if (transport.licensePlate) setLicensePlate(transport.licensePlate);
                }

                // Charger le type de coursier
                if (profile.courier_type) {
                    setCourierType(profile.courier_type);
                }

                // Charger les disponibilités - ✅ REFONTE: Convertir ancien format vers nouveau schedule JSON
                if (profile.availability) {
                    if (profile.availability.schedule) {
                        // Nouveau format: schedule JSON direct
                        setAvailabilitySchedule(typeof profile.availability.schedule === 'string'
                            ? profile.availability.schedule
                            : JSON.stringify(profile.availability.schedule, null, 2));
                    } else if (profile.availability.days && Array.isArray(profile.availability.days)) {
                        // Ancien format: days[] + hours.start/end -> convertir en schedule JSON
                        const dayMapping: Record<string, string> = {
                            'monday': 'lundi', 'tuesday': 'mardi', 'wednesday': 'mercredi',
                            'thursday': 'jeudi', 'friday': 'vendredi', 'saturday': 'samedi', 'sunday': 'dimanche'
                        };
                        const start = profile.availability.hours?.start || '08:00';
                        const end = profile.availability.hours?.end || '18:00';
                        const schedule: Record<string, Array<{ start: string; end: string }>> = {};
                        profile.availability.days.forEach((day: string) => {
                            const frenchDay = dayMapping[day] || day;
                            schedule[frenchDay] = [{ start, end }];
                        });
                        setAvailabilitySchedule(JSON.stringify(schedule, null, 2));
                    }
                }

                // Charger bio et expérience
                if (profile.bio) setBio(profile.bio);
                if (profile.experience) setExperience(profile.experience);

                // Charger le partenaire
                if (profile.partner_id) setSelectedPartnerId(profile.partner_id);

                // Charger le mode de paiement
                if (profile.paymentMethod) setPaymentMethod(profile.paymentMethod);

                console.log('[CourierRegistrationScreen] ✅ Données du brouillon chargées');
                toaster.info('📝 Brouillon chargé. Vous pouvez continuer à compléter votre candidature.');
            }
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur chargement brouillon:', error);
            // Ne pas bloquer l'utilisateur si le chargement du brouillon échoue
        }
    };

    const pickDocument = async (type: 'id' | 'license' | 'registration' | 'insurance' | 'vehicle' | 'location') => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                const file = result.assets[0];
                const document: DocumentFile = {
                    uri: file.uri,
                    name: file.name || 'document',
                    type: file.mimeType || 'application/octet-stream',
                    size: file.size,
                };

                switch (type) {
                    case 'id':
                        setIdDocument(document);
                        break;
                    case 'license':
                        setDriverLicense(document);
                        break;
                    case 'registration':
                        setVehicleRegistration(document);
                        break;
                    case 'insurance':
                        setInsuranceDocument(document);
                        break;
                    case 'vehicle':
                        setVehicleImage(document);
                        break;
                    case 'location':
                        setLocationPlan(document);
                        break;
                }
            }
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur sélection document:', error);
            Alert.alert(t('message.error'), t('courierRegistration.cannotSelectDoc'));
        }
    };

    const pickImage = async (type: 'id' | 'license' | 'registration' | 'insurance' | 'vehicle' | 'location') => {
        try {
            // ✅ CORRIGÉ 2026-01-14: Demander les permissions correctement
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert(
                    t('courierRegistration.permissionRequired'),
                    t('courierRegistration.permissionRequiredMsg')
                );
                return;
            }

            // ✅ CORRIGÉ: Utiliser 'images' as any pour compatibilité avec toutes les versions d'expo-image-picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any,
                allowsEditing: true,
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                const document: DocumentFile = {
                    uri: asset.uri,
                    name: `photo_${type}_${Date.now()}.jpg`,
                    type: asset.mimeType || 'image/jpeg',
                    size: asset.fileSize || 0,
                };

                switch (type) {
                    case 'id':
                        setIdDocument(document);
                        break;
                    case 'license':
                        setDriverLicense(document);
                        break;
                    case 'registration':
                        setVehicleRegistration(document);
                        break;
                    case 'insurance':
                        setInsuranceDocument(document);
                        break;
                    case 'vehicle':
                        setVehicleImage(document);
                        break;
                    case 'location':
                        setLocationPlan(document);
                        break;
                }
            }
        } catch (error: any) {
            console.error('[CourierRegistrationScreen] Erreur sélection image:', error);
            Alert.alert(
                t('message.error'),
                error.message || t('courierRegistration.cannotSelectImage')
            );
        }
    };


    const convertFileToBase64 = async (file: DocumentFile): Promise<string> => {
        try {
            const response = await fetch(file.uri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('[CourierRegistrationScreen] Erreur conversion base64:', error);
            throw error;
        }
    };

    const validateForm = (): boolean => {
        if (!courierType) {
            Alert.alert(t('message.error'), t('courierRegistration.selectActivityType'));
            return false;
        }
        if (!fullName.trim()) {
            Alert.alert(t('message.error'), t('courierRegistration.fullNameRequired'));
            return false;
        }
        if (!phone.trim()) {
            Alert.alert(t('message.error'), t('courierRegistration.phoneRequired'));
            return false;
        }
        if (!address.trim()) {
            Alert.alert(t('message.error'), t('courierRegistration.addressRequired'));
            return false;
        }
        if (!city.trim()) {
            Alert.alert(t('message.error'), t('courierRegistration.cityRequired'));
            return false;
        }
        if (!idNumber.trim()) {
            Alert.alert(t('message.error'), t('courierRegistration.idNumberRequired'));
            return false;
        }
        if (!idDocument) {
            Alert.alert(t('message.error'), t('courierRegistration.idDocRequired'));
            return false;
        }
        if (vehicleType !== 'walking' && !driverLicense) {
            Alert.alert(t('message.error'), t('courierRegistration.licenseRequired'));
            return false;
        }
        if (!locationPlan) {
            Alert.alert(t('message.error'), t('courierRegistration.locationPlanRequired'));
            return false;
        }
        // ✅ REFONTE: Vérifier le schedule JSON au lieu de availabilityDays
        try {
            const parsedSchedule = JSON.parse(availabilitySchedule || '{}');
            if (Object.keys(parsedSchedule).length === 0) {
                Alert.alert(t('message.error'), t('courierRegistration.selectAvailability'));
                return false;
            }
        } catch {
            Alert.alert(t('message.error'), t('courierRegistration.selectAvailability'));
            return false;
        }
        // ✅ NOUVEAU 2026-01-04: Vérifier que le partenaire est sélectionné
        if (!selectedPartnerId) {
            Alert.alert(t('message.error'), t('courierRegistration.selectPartner'));
            return false;
        }
        return true;
    };

    const handleSubmit = async (submit: boolean = false) => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const documents: Record<string, any> = {};
            if (idDocument) {
                documents.id_document = {
                    name: idDocument.name,
                    data: await convertFileToBase64(idDocument),
                    type: idDocument.type,
                };
            }
            if (driverLicense) {
                documents.driver_license = {
                    name: driverLicense.name,
                    data: await convertFileToBase64(driverLicense),
                    type: driverLicense.type,
                };
            }
            if (vehicleRegistration) {
                documents.vehicle_registration = {
                    name: vehicleRegistration.name,
                    data: await convertFileToBase64(vehicleRegistration),
                    type: vehicleRegistration.type,
                };
            }
            if (insuranceDocument) {
                documents.insurance = {
                    name: insuranceDocument.name,
                    data: await convertFileToBase64(insuranceDocument),
                    type: insuranceDocument.type,
                };
            }
            // ✅ NOUVEAU 2026-01-04: Ajouter l'image du moyen de transport
            if (vehicleImage) {
                documents.vehicle_image = {
                    name: vehicleImage.name,
                    data: await convertFileToBase64(vehicleImage),
                    type: vehicleImage.type,
                };
            }
            // ✅ NOUVEAU: Ajouter le plan de localisation (obligatoire)
            if (locationPlan) {
                documents.location_plan = {
                    name: locationPlan.name,
                    data: await convertFileToBase64(locationPlan),
                    type: locationPlan.type,
                };
            }

            const profileData = {
                personal: {
                    fullName,
                    phone,
                    email: user?.email,
                    address,
                    city,
                    country,
                    dateOfBirth,
                    idNumber,
                },
                transport: {
                    vehicleType,
                    vehicleBrand,
                    vehicleModel,
                    licensePlate,
                },
                availability: (() => {
                    // ✅ REFONTE: Convertir schedule JSON vers le format API (days[] + hours + schedule)
                    const dayMapping: Record<string, string> = {
                        'lundi': 'monday', 'mardi': 'tuesday', 'mercredi': 'wednesday',
                        'jeudi': 'thursday', 'vendredi': 'friday', 'samedi': 'saturday', 'dimanche': 'sunday'
                    };
                    try {
                        const parsed = JSON.parse(availabilitySchedule || '{}');
                        const days = Object.keys(parsed)
                            .filter(k => parsed[k] && parsed[k].length > 0)
                            .map(k => dayMapping[k] || k);
                        // Utiliser la première plage horaire comme hours général (compatibilité)
                        const allSlots = Object.values(parsed).flat() as Array<{ start: string; end: string }>;
                        const firstSlot = allSlots[0] || { start: '08:00', end: '18:00' };
                        return {
                            days,
                            hours: { start: firstSlot.start, end: firstSlot.end },
                            schedule: parsed, // ✅ NOUVEAU: Envoyer aussi le schedule détaillé
                        };
                    } catch {
                        return { days: [], hours: { start: '08:00', end: '18:00' } };
                    }
                })(),
                bio,
                experience,
                courier_type: courierType, // ✅ NOUVEAU: Type de coursier (obligatoire)
                paymentMethod: paymentMethod ? {
                    type: paymentMethod.type,
                    phoneNumber: paymentMethod.phoneNumber,
                    cardNumber: paymentMethod.cardNumber,
                    cardExpiry: paymentMethod.cardExpiry,
                    cardCVV: paymentMethod.cardCVV,
                    cardHolder: paymentMethod.cardHolder,
                    taxId: paymentMethod.taxId,
                } : null,
                partner_id: selectedPartnerId, // ✅ NOUVEAU 2026-01-04: ID du partenaire sélectionné
            };

            // ✅ CORRIGÉ: Convertir -1 (Yukpo virtuel) en null pour éviter les erreurs de contrainte de clé étrangère
            const validPartnerId = selectedPartnerId && selectedPartnerId > 0 ? selectedPartnerId : null;

            console.log('[CourierRegistrationScreen] 🔍 Soumission avec partner_id:', {
                selectedPartnerId,
                validPartnerId,
                'est Yukpo virtuel': selectedPartnerId === -1,
            });

            const response = await deliveryApi.submitCourierApplication({
                profile_data: profileData,
                documents,
                submitted: submit,
                partner_id: validPartnerId, // ✅ CORRIGÉ: Utiliser validPartnerId (null si -1 ou invalide)
            });

            // ✅ DEBUG: Log complet de la réponse pour diagnostic
            console.log('[CourierRegistrationScreen] 🔍 Réponse complète API:', JSON.stringify(response, null, 2));
            console.log('[CourierRegistrationScreen] 🔍 Détails réponse:', {
                'response.success': response.success,
                'response.error': response.error,
                'response.status': response.status,
                'response.data': response.data,
                'response.data?.success': (response.data as any)?.success,
                'response.data?.application': !!(response.data as any)?.application,
                'response.data?.application?.id': (response.data as any)?.application?.id,
                'response.data?.application?.status': (response.data as any)?.application?.status,
            });

            // ✅ CORRIGÉ: Vérifier la réponse avec plus de flexibilité
            // Le backend retourne {success: true, application: {...}}
            // apiCall retourne {success: true, data: {success: true, application: {...}}}
            const rd: any = response.data;
            const isSuccess = response.success === true ||
                (rd && (rd.application || rd.success === true)) ||
                (!response.error && !response.status);

            if (isSuccess) {
                setApplicationStatus(submit ? 'submitted' : 'draft');

                // ✅ CORRIGÉ: Afficher le toast de confirmation immédiatement
                const toastMessage = submit
                    ? '✅ Candidature soumise avec succès ! Votre formulaire est en attente de validation.'
                    : '💾 Brouillon enregistré ! Vous pouvez compléter et soumettre plus tard.';

                console.log('[CourierRegistrationScreen] ✅ Réponse succès, affichage toast:', toastMessage);
                console.log('[CourierRegistrationScreen] Structure réponse:', {
                    success: response.success,
                    hasData: !!response.data,
                    hasError: !!response.error,
                    status: response.status,
                });

                // ✅ CORRIGÉ: Afficher le toast immédiatement
                try {
                    toaster.success(toastMessage);
                    console.log('[CourierRegistrationScreen] ✅ Toast affiché avec succès');
                } catch (toastError) {
                    console.error('[CourierRegistrationScreen] ❌ Erreur affichage toast:', toastError);
                }

                // ✅ CORRIGÉ: Afficher l'Alert APRÈS un délai pour que le toast soit visible d'abord
                // Le toast reste visible pendant 5 secondes, on affiche l'Alert après 1.5 secondes
                // pour que le toast soit bien visible avant que l'Alert n'apparaisse
                setTimeout(() => {
                    console.log('[CourierRegistrationScreen] Affichage Alert après toast (1.5s)');
                    // ✅ AMÉLIORÉ: Alert avec message plus clair
                    Alert.alert(
                        submit ? t('courierRegistration.applicationSubmitted') : t('courierRegistration.draftSaved'),
                        submit
                            ? t('courierRegistration.applicationSubmittedMsg')
                            : t('courierRegistration.draftSavedMsg'),
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    // ✅ NOUVEAU: Réafficher le toast après la fermeture de l'Alert pour confirmation
                                    // Cela garantit que l'utilisateur voit bien le message de confirmation
                                    try {
                                        toaster.success(toastMessage);
                                        console.log('[CourierRegistrationScreen] ✅ Toast réaffiché après fermeture Alert');
                                    } catch (toastError2) {
                                        console.error('[CourierRegistrationScreen] ❌ Erreur réaffichage toast:', toastError2);
                                    }

                                    if (submit) {
                                        // Petit délai avant navigation pour laisser le toast s'afficher
                                        setTimeout(() => {
                                            navigation.goBack();
                                        }, 500);
                                    }
                                },
                            },
                        ]
                    );
                }, 1500); // ✅ Délai de 1500ms (1.5 secondes) - le toast reste visible 5s donc il sera encore visible
            } else {
                // ✅ NOUVEAU: Gérer le cas où la réponse n'est pas un succès
                console.error('[CourierRegistrationScreen] ❌ Réponse non-succès:', {
                    success: response.success,
                    error: response.error,
                    status: response.status,
                    data: response.data,
                });
                Alert.alert(
                    t('message.error'),
                    response.error || t('courierRegistration.cannotSubmit')
                );
            }
        } catch (error: any) {
            console.error('[CourierRegistrationScreen] Erreur soumission:', error);
            Alert.alert(t('message.error'), error.message || t('courierRegistration.cannotSubmitShort'));
        } finally {
            setLoading(false);
        }
    };

    // ✅ CRITIQUE 2025-12-24: Déplacer TOUS les hooks AVANT les early returns
    // pour éviter l'erreur "Rendered more hooks than during the previous render"
    // ✅ CONSTANTE: VEHICLE_TRANSPORT_OPTIONS est une constante importée, pas besoin de useMemo
    const selectedVehicle = VEHICLE_TRANSPORT_OPTIONS.find(v => v.value === vehicleType);
    const requiresLicense = selectedVehicle?.requiresLicense ?? false;

    // ✅ SIMPLIFIÉ: Pas besoin de useCallback pour une fonction simple
    const handleVehicleSelect = (vehicle: VehicleType) => {
        setVehicleType(vehicle);
    };

    // ✅ CRITIQUE 2025-12-24: Early returns APRÈS tous les hooks
    if (checkingStatus) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Vérification du statut...</Text>
                </View>
            </SafeNativeView>
        );
    }

    if (applicationStatus === 'approved') {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.statusContainer}>
                    <SafeIcon name="check-circle" size={64} color={modernColors.success} />
                    <Text style={styles.statusTitle}>Candidature approuvée !</Text>
                    <Text style={styles.statusText}>
                        Félicitations ! Votre candidature de coursier a été approuvée. Vous pouvez maintenant recevoir des livraisons.
                    </Text>
                    <NativeButton
                        title="Voir mes livraisons"
                        variant="primary"
                        onPress={() => navigation.navigate('Delivery' as never)}
                    />
                </View>
            </SafeNativeView>
        );
    }

    if (applicationStatus === 'submitted') {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.statusContainer}>
                    <SafeIcon name="clock" size={64} color={modernColors.warning} />
                    <Text style={styles.statusTitle}>Candidature en cours d'examen</Text>
                    <Text style={styles.statusText}>
                        Votre candidature a été soumise avec succès. Notre équipe l'examinera sous peu. Vous recevrez une notification une fois la décision prise.
                    </Text>
                    <NativeButton
                        title="Retour"
                        variant="outline"
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </SafeNativeView>
        );
    }

    if (applicationStatus === 'rejected') {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.statusContainer}>
                    <SafeIcon name="x-circle" size={64} color={modernColors.error} />
                    <Text style={styles.statusTitle}>Candidature refusée</Text>
                    <Text style={styles.statusText}>
                        Votre candidature n'a pas été approuvée. Veuillez contacter le support pour plus d'informations.
                    </Text>
                    <NativeButton
                        title="Retour"
                        variant="outline"
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <KeyboardAwareScrollView
                ref={scrollViewRef}
                style={styles.scroll}
                // ✅ CORRECTION CRITIQUE: Configuration optimale pour éviter que le clavier masque les champs
                enableOnAndroid={true}
                enableAutomaticScroll={true}
                // ✅ AUGMENTÉ: Valeurs significativement augmentées pour éviter que le clavier masque les éléments
                extraHeight={Platform.OS === 'android' ? 350 : 0}
                extraScrollHeight={Platform.OS === 'ios' ? 300 : 0}
                enableResetScrollToCoords={false}
                keyboardOpeningTime={0}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={true}
                scrollEnabled={true}
                bounces={true}
                contentInsetAdjustmentBehavior="never"
                // ✅ CORRECTION CRITIQUE: Padding supplémentaire augmenté en bas pour éviter que le clavier masque les boutons
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'android' ? 400 : 350 }]}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Devenir coursier Yukpo</Text>
                    <Text style={styles.subtitle}>
                        Complétez ce formulaire pour devenir coursier. Toutes les informations seront vérifiées avant validation.
                    </Text>
                </View>

                {/* ✅ REFONDU: Nature de l'activité (obligatoire) - Disposition améliorée pour éviter les retours à la ligne */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Nature de l'activité *</Text>
                    <Text style={styles.helperText}>
                        Sélectionnez le type de service que vous souhaitez offrir.
                    </Text>
                    <View style={styles.activityTypeGrid}>
                        {COURIER_TYPES.map((type) => {
                            const isSelected = courierType === type.value;
                            return (
                                <TouchableOpacity
                                    key={type.value}
                                    style={[
                                        styles.activityTypeGridItem,
                                        isSelected && styles.activityTypeGridItemSelected,
                                    ]}
                                    onPress={() => {
                                        try {
                                            hapticPress();
                                            setCourierType(type.value);
                                        } catch (error) {
                                            console.error('[CourierRegistrationScreen] Erreur lors de la sélection:', error);
                                            Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
                                        }
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.activityTypeGridIcon}>{type.icon}</Text>
                                    <Text
                                        style={[
                                            styles.activityTypeGridLabel,
                                            isSelected && styles.activityTypeGridLabelSelected,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {type.label}
                                    </Text>
                                    {isSelected && (
                                        <View style={styles.activityTypeGridCheck}>
                                            <SafeIcon name="check" size={12} color={modernColors.surface} type="lucide" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {!courierType && (
                        <Text style={styles.errorText}>Ce champ est obligatoire</Text>
                    )}
                </NativeCard>

                {/* Informations personnelles */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Informations personnelles</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Nom complet *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre nom complet"
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Téléphone *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre numéro de téléphone"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={user?.email || ''}
                            editable={false}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Date de naissance</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="YYYY-MM-DD"
                            value={dateOfBirth}
                            onChangeText={setDateOfBirth}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Numéro de pièce d'identité *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Entrez votre numéro de pièce d'identité"
                            value={idNumber}
                            onChangeText={setIdNumber}
                        />
                    </View>
                </NativeCard>

                {/* Adresse */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Adresse de résidence</Text>
                    <View style={styles.inputContainer}>
                        <LocationSelector
                            label="Adresse complète *"
                            value={address || ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRIGÉ 2026-03-01: Utiliser LocationSelector avec autocomplete intelligent
                                // au lieu d'un simple TextInput pour permettre la sélection de lieux précis
                                const fullAddress = location.raw || location.place_name || '';
                                setAddress(fullAddress);
                                // Extraire automatiquement ville et pays depuis les composants
                                if (location.components?.ville && !city) {
                                    setCity(location.components.ville);
                                    setCityLocation({
                                        raw: location.components.ville,
                                        place_name: location.components.ville,
                                        components: { ville: location.components.ville },
                                    });
                                }
                                if (location.components?.pays && !country) {
                                    setCountry(location.components.pays);
                                    setCountryLocation({
                                        raw: location.components.pays,
                                        place_name: location.components.pays,
                                        components: { pays: location.components.pays },
                                    });
                                }
                            }}
                            placeholder="Restaurant, pharmacie, rue, quartier..."
                            scope="all"
                            required={true}
                            enrichWithBackend={true}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <LocationSelector
                            label="Ville *"
                            value={cityLocation || ''}
                            onSelect={(location: LocationObject) => {
                                console.log('[CourierRegistrationScreen] onSelect ville appelé avec:', location);
                                setCityLocation(location);
                                const ville = location.components?.ville || location.place_name || location.raw || '';
                                setCity(ville);
                                if (location.components?.pays && !country) {
                                    const pays = location.components.pays;
                                    setCountry(pays);
                                    setCountryLocation({
                                        raw: pays,
                                        place_name: pays,
                                        components: { pays },
                                    });
                                }
                            }}
                            placeholder="Rechercher une ville..."
                            scope="city"
                            required={true}
                            enrichWithBackend={true}
                        />
                    </View>
                    <View style={styles.inputContainer}>
                        <LocationSelector
                            label="Pays"
                            value={countryLocation || ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRIGÉ: Stocker l'objet LocationObject complet pour l'affichage
                                setCountryLocation(location);
                                // Extraire le pays pour la soumission du formulaire
                                const pays = location.components?.pays || location.place_name || location.raw || '';
                                setCountry(pays);
                            }}
                            placeholder="Rechercher un pays..."
                            scope="all"
                            enrichWithBackend={true}
                        />
                    </View>
                </NativeCard>

                {/* Transport */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Moyen de transport</Text>
                    {/* Grille des options de transport en 3 colonnes */}
                    <View style={styles.vehicleGrid}>
                        {VEHICLE_TRANSPORT_OPTIONS.map((vehicle) => {
                            const isSelected = vehicleType === vehicle.value;
                            return (
                                <TouchableOpacity
                                    key={vehicle.value}
                                    style={[
                                        styles.vehicleGridItem,
                                        isSelected && styles.vehicleGridItemSelected,
                                    ]}
                                    onPress={() => handleVehicleSelect(vehicle.value)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.vehicleGridIcon}>{vehicle.icon}</Text>
                                    <Text
                                        style={[
                                            styles.vehicleGridLabel,
                                            isSelected && styles.vehicleGridLabelSelected,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {vehicle.label}
                                    </Text>
                                    {vehicle.requiresLicense && (
                                        <Text style={styles.vehicleGridHint} numberOfLines={1}>
                                            Permis requis
                                        </Text>
                                    )}
                                    {isSelected && (
                                        <View style={styles.vehicleGridCheck}>
                                            <SafeIcon name="check" size={16} color={modernColors.surface} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {vehicleType !== 'walking' && (
                        <>
                            <TextInput
                                style={styles.input}
                                placeholder="Marque"
                                value={vehicleBrand}
                                onChangeText={setVehicleBrand}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Modèle"
                                value={vehicleModel}
                                onChangeText={setVehicleModel}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Plaque d'immatriculation"
                                value={licensePlate}
                                onChangeText={setLicensePlate}
                            />
                            {/* ✅ NOUVEAU 2026-01-04: Champ pour télécharger l'image du moyen de transport */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Photo du moyen de transport</Text>
                                <View style={styles.documentRow}>
                                    <View style={styles.documentInfo}>
                                        {vehicleImage && <Text style={styles.documentName}>{vehicleImage.name}</Text>}
                                        {!vehicleImage && <Text style={styles.documentHint}>Aucune image sélectionnée</Text>}
                                    </View>
                                    <View style={styles.documentButtons}>
                                        <NativeButton
                                            title="📷 Photo"
                                            variant="outline"
                                            size="small"
                                            onPress={() => pickImage('vehicle')}
                                        />
                                        <NativeButton
                                            title="📄 Fichier"
                                            variant="outline"
                                            size="small"
                                            onPress={() => pickDocument('vehicle')}
                                        />
                                    </View>
                                </View>
                            </View>
                        </>
                    )}
                    {/* ✅ AMÉLIORÉ 2026-01-12: Champ partenaire (obligatoire) - Rendu opérationnel */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Partenaire de livraison *</Text>
                        <Text style={styles.helperText}>
                            Sélectionnez le partenaire de logistique auquel vous appartenez. Ce champ permet de gérer les coursiers qui feront les achats pour l'utilisateur au marché.
                        </Text>
                        {partners.length === 0 ? (
                            <View style={styles.noPartnersContainer}>
                                <SafeIcon name="alert-circle" size={24} color={modernColors.warning || '#F59E0B'} type="lucide" />
                                <Text style={styles.errorText}>
                                    Aucun partenaire de livraison disponible.
                                </Text>
                                <Text style={styles.helperText}>
                                    Veuillez contacter l'administrateur pour créer un partenaire de livraison ou réessayez plus tard.
                                </Text>
                                <TouchableOpacity
                                    style={styles.refreshButton}
                                    onPress={loadPartners}
                                >
                                    <SafeIcon name="refresh-cw" size={16} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.refreshButtonText}>Actualiser</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.pickerContainer}>
                                {partners.map((partner) => (
                                    <TouchableOpacity
                                        key={partner.id}
                                        style={[
                                            styles.partnerOption,
                                            selectedPartnerId === partner.id && styles.partnerOptionSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedPartnerId(partner.id);
                                            console.log('[CourierRegistrationScreen] ✅ Partenaire sélectionné:', partner.id, partner.name);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.partnerOptionContent}>
                                            <SafeIcon
                                                name="building"
                                                size={18}
                                                color={selectedPartnerId === partner.id ? modernColors.surface : modernColors.primary}
                                                type="lucide"
                                            />
                                            <Text style={[
                                                styles.partnerOptionText,
                                                selectedPartnerId === partner.id && styles.partnerOptionTextSelected
                                            ]}>
                                                {partner.name}
                                            </Text>
                                        </View>
                                        {selectedPartnerId === partner.id && (
                                            <SafeIcon name="check-circle" size={20} color={modernColors.surface} type="lucide" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        {selectedPartnerId && (
                            <View style={styles.selectedPartnerInfo}>
                                <SafeIcon name="info" size={14} color={modernColors.primary} type="lucide" />
                                <Text style={styles.selectedPartnerInfoText}>
                                    Partenaire sélectionné : {partners.find(p => p.id === selectedPartnerId)?.name || 'Inconnu'}
                                </Text>
                            </View>
                        )}
                    </View>
                </NativeCard>

                {/* Documents */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Documents</Text>
                    <View style={styles.documentRow}>
                        <View style={styles.documentInfo}>
                            <Text style={styles.documentLabel}>Pièce d'identité *</Text>
                            {idDocument && <Text style={styles.documentName}>{idDocument.name}</Text>}
                        </View>
                        <View style={styles.documentButtons}>
                            <NativeButton
                                title="📷 Photo"
                                variant="outline"
                                size="small"
                                onPress={() => pickImage('id')}
                            />
                            <NativeButton
                                title="📄 Fichier"
                                variant="outline"
                                size="small"
                                onPress={() => pickDocument('id')}
                            />
                        </View>
                    </View>
                    {requiresLicense && (
                        <View style={styles.documentRow}>
                            <View style={styles.documentInfo}>
                                <Text style={styles.documentLabel}>Permis de conduire *</Text>
                                {driverLicense && <Text style={styles.documentName}>{driverLicense.name}</Text>}
                            </View>
                            <View style={styles.documentButtons}>
                                <NativeButton
                                    title="📷 Photo"
                                    variant="outline"
                                    size="small"
                                    onPress={() => pickImage('license')}
                                />
                                <NativeButton
                                    title="📄 Fichier"
                                    variant="outline"
                                    size="small"
                                    onPress={() => pickDocument('license')}
                                />
                            </View>
                        </View>
                    )}
                    {vehicleType !== 'walking' && (
                        <>
                            <View style={styles.documentRow}>
                                <View style={styles.documentInfo}>
                                    <Text style={styles.documentLabel}>Carte grise</Text>
                                    {vehicleRegistration && (
                                        <Text style={styles.documentName}>{vehicleRegistration.name}</Text>
                                    )}
                                </View>
                                <View style={styles.documentButtons}>
                                    <NativeButton
                                        title="📷 Photo"
                                        variant="outline"
                                        size="small"
                                        onPress={() => pickImage('registration')}
                                    />
                                    <NativeButton
                                        title="📄 Fichier"
                                        variant="outline"
                                        size="small"
                                        onPress={() => pickDocument('registration')}
                                    />
                                </View>
                            </View>
                            {(vehicleType === 'car' || vehicleType === 'pickup' || vehicleType === 'van' || vehicleType === 'truck') && (
                                <View style={styles.documentRow}>
                                    <View style={styles.documentInfo}>
                                        <Text style={styles.documentLabel}>Assurance</Text>
                                        {insuranceDocument && (
                                            <Text style={styles.documentName}>{insuranceDocument.name}</Text>
                                        )}
                                    </View>
                                    <View style={styles.documentButtons}>
                                        <NativeButton
                                            title="📷 Photo"
                                            variant="outline"
                                            size="small"
                                            onPress={() => pickImage('insurance')}
                                        />
                                        <NativeButton
                                            title="📄 Fichier"
                                            variant="outline"
                                            size="small"
                                            onPress={() => pickDocument('insurance')}
                                        />
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                    {/* ✅ NOUVEAU: Plan de localisation (obligatoire) */}
                    <View style={styles.documentRow}>
                        <View style={styles.documentInfo}>
                            <Text style={styles.documentLabel}>Plan de localisation *</Text>
                            <Text style={styles.helperText}>
                                Indiquez votre zone d'intervention principale sur une carte
                            </Text>
                            {locationPlan && <Text style={styles.documentName}>{locationPlan.name}</Text>}
                        </View>
                        <View style={styles.documentButtons}>
                            <NativeButton
                                title="📷 Photo"
                                variant="outline"
                                size="small"
                                onPress={() => pickImage('location')}
                            />
                            <NativeButton
                                title="📄 Fichier"
                                variant="outline"
                                size="small"
                                onPress={() => pickDocument('location')}
                            />
                        </View>
                    </View>
                </NativeCard>

                {/* Disponibilités */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Disponibilités</Text>
                    <Text style={styles.helperText}>
                        Sélectionnez vos jours et plages horaires de travail. Vous pouvez configurer des horaires différents pour chaque jour.
                    </Text>
                    <TimeSlotPicker
                        value={availabilitySchedule}
                        onChange={setAvailabilitySchedule}
                    />
                </NativeCard>

                {/* Bio et expérience */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Informations complémentaires</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Bio (optionnel)"
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        numberOfLines={3}
                    />
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Expérience (optionnel)"
                        value={experience}
                        onChangeText={setExperience}
                        multiline
                        numberOfLines={3}
                    />
                </NativeCard>

                {/* Comptes de paiement */}
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Comptes de paiement</Text>
                    <Text style={styles.helperText}>
                        Renseignez votre compte pour recevoir vos paiements de livraison. L'argent transite toujours dans le compte de l'application avant reversement.
                    </Text>
                    <PaymentMethodSelector
                        onPaymentChange={setPaymentMethod}
                        readonly={false}
                    />
                </NativeCard>

                {/* Actions */}
                <View style={styles.actions}>
                    <View style={styles.actionButtonContainer}>
                        <NativeButton
                            title="Enregistrer en brouillon"
                            variant="outline"
                            onPress={() => handleSubmit(false)}
                            disabled={loading}
                        />
                        <Text style={styles.actionHelperText}>
                            💾 Sauvegardez votre progression sans soumettre. Vous pourrez compléter et soumettre plus tard.
                        </Text>
                    </View>
                    <View style={styles.actionButtonContainer}>
                        <NativeButton
                            title={loading ? 'Envoi en cours...' : 'Soumettre la candidature'}
                            variant="primary"
                            onPress={() => handleSubmit(true)}
                            disabled={loading}
                        />
                        <Text style={styles.actionHelperText}>
                            ✅ Soumettez votre candidature pour validation. Elle sera examinée par les administrateurs.
                        </Text>
                    </View>
                </View>
            </KeyboardAwareScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 250, // ✅ AUGMENTÉ: Plus d'espace en bas pour éviter que le clavier masque les boutons
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    helperText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 18,
    },
    card: {
        marginBottom: 16,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    inputContainer: {
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    vehicleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    vehicleGridItem: {
        width: '23%', // ✅ CORRIGÉ: 4 colonnes avec espacement (23% × 4 = 92%, reste 8% pour les gaps)
        aspectRatio: 1,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        padding: 8, // ✅ RÉDUIT: De 12 à 8 pour accommoder 4 colonnes
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: 80, // ✅ RÉDUIT: De 100 à 80 pour accommoder 4 colonnes
        marginBottom: 12,
    },
    vehicleGridItemSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary,
    },
    vehicleGridIcon: {
        fontSize: 24, // ✅ RÉDUIT: De 32 à 24 pour que les 4 icônes soient tous visibles à l'écran
        marginBottom: 6, // ✅ RÉDUIT: De 8 à 6 pour optimiser l'espace
    },
    vehicleGridLabel: {
        fontSize: 11, // ✅ RÉDUIT: De 13 à 11 pour accommoder 4 colonnes
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
        marginBottom: 2, // ✅ RÉDUIT: De 4 à 2 pour optimiser l'espace
    },
    vehicleGridLabelSelected: {
        color: modernColors.surface,
    },
    vehicleGridHint: {
        fontSize: 9, // ✅ RÉDUIT: De 10 à 9 pour accommoder 4 colonnes
        color: modernColors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    vehicleGridCheck: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    documentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    documentInfo: {
        flex: 1,
        marginRight: 12,
    },
    documentLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    documentName: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    documentButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    dayButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    dayButtonSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary,
    },
    dayButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    dayButtonTextSelected: {
        color: modernColors.surface,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    timeInput: {
        flex: 1,
        marginBottom: 0,
    },
    timeSeparator: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    actions: {
        gap: 16,
        marginTop: 8,
    },
    actionButtonContainer: {
        gap: 6,
    },
    actionHelperText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        paddingHorizontal: 4,
        lineHeight: 16,
    },
    statusContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    statusTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 24,
        marginBottom: 12,
        textAlign: 'center',
    },
    statusText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
    },
    // ✅ NOUVEAU 2026-01-04: Styles pour le champ partenaire
    pickerContainer: {
        marginTop: 8,
    },
    partnerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    partnerOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary,
    },
    partnerOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    partnerOptionTextSelected: {
        color: modernColors.surface,
        fontWeight: '600',
    },
    // ✅ NOUVEAU: Styles pour spécialisations
    specializationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    specializationButtonSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EEF2FF',
    },
    specializationButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#374151',
        flex: 1,
    },
    specializationButtonTextSelected: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    // ✅ REFONDU: Styles pour le champ "Nature de l'activité" - Grille 2 colonnes optimisée pour réduire l'espace
    activityTypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        marginTop: 12,
        gap: 8, // ✅ RÉDUIT: De 10 à 8 pour réduire l'espace entre les boutons
    },
    activityTypeGridItem: {
        width: '47%', // ✅ 2 colonnes avec gap de 8px (47% * 2 + 8px gap = ~100%)
        minHeight: 70, // ✅ RÉDUIT: De 100 à 70 pour réduire la hauteur
        borderRadius: 8, // ✅ RÉDUIT: De 10 à 8 pour un look plus compact
        borderWidth: 1.5,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        padding: 8, // ✅ RÉDUIT: De 12 à 8 pour réduire le padding interne
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    activityTypeGridItemSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary,
        shadowColor: modernColors.primary,
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    activityTypeGridIcon: {
        fontSize: 20, // ✅ RÉDUIT: De 26 à 20 pour réduire la taille de l'icône
        marginBottom: 4, // ✅ RÉDUIT: De 6 à 4 pour optimiser l'espace
    },
    activityTypeGridLabel: {
        fontSize: 12, // ✅ RÉDUIT: De 13 à 12 pour réduire légèrement la taille du texte
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
        lineHeight: 14, // ✅ RÉDUIT: De 16 à 14 pour un espacement plus compact
        width: '100%',
        marginTop: 2, // ✅ RÉDUIT: De 4 à 2 pour optimiser l'espace
    },
    activityTypeGridLabelSelected: {
        color: modernColors.surface,
    },
    activityTypeGridCheck: {
        position: 'absolute',
        top: 4, // ✅ RÉDUIT: De 6 à 4 pour optimiser l'espace
        right: 4, // ✅ RÉDUIT: De 6 à 4 pour optimiser l'espace
        width: 18, // ✅ RÉDUIT: De 20 à 18 pour réduire la taille du check
        height: 18, // ✅ RÉDUIT: De 20 à 18 pour réduire la taille du check
        borderRadius: 9, // ✅ RÉDUIT: De 10 à 9 pour correspondre à la nouvelle taille
        backgroundColor: modernColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    errorText: {
        fontSize: 12,
        color: modernColors.error || '#EF4444',
        marginTop: 4,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    documentHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    // ✅ AMÉLIORÉ 2026-01-12: Styles pour le champ partenaire amélioré
    noPartnersContainer: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FCD34D',
        marginTop: 8,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    refreshButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    partnerOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    selectedPartnerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        padding: 10,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    selectedPartnerInfoText: {
        fontSize: 13,
        fontWeight: '500',
        color: modernColors.primary,
        flex: 1,
    },
});

export default CourierRegistrationScreen;
