/**
 * 📦 NOUVEAU: Flux de livraison de colis amélioré avec progress bar
 * Design moderne niveau Uber Eats / DoorDash
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    Alert,
    Animated,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import HapticTouchable from '../../components/delivery/HapticTouchable';
import StepWizardForm from '../../components/delivery/StepWizardForm';
import MediaUploadManager from '../../components/MediaUploadManager';
import ModernGPSModal from '../../components/ModernGPSModal';
import { SavedAddressSelector } from '../../components/delivery/SavedAddressSelector';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { CreateDeliveryRequestPayload, deliveryApi, userApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useScreenEnter } from '../../utils/animations';
import { LocationObject } from '../../components/LocationSelector';
import { UserSavedAddress } from '../../hooks/useSavedAddresses';
import { VEHICLE_TRANSPORT_OPTIONS } from '../../config/deliveryConfig';
import { useNavigation } from '@react-navigation/native';
import SafeStorage from '../../utils/safeStorage';

interface DeliveryParcelFlowNewProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: (deliveryId: string) => void;
}

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

const DeliveryParcelFlowNew: React.FC<DeliveryParcelFlowNewProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const { location: userLocation } = useLocation();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    // ✅ États pour coûts et assurance
    const [deliveryCost, setDeliveryCost] = useState<number | null>(null);
    const [insuranceCost, setInsuranceCost] = useState<number>(0);
    const [userBalance, setUserBalance] = useState<number>(0);
    const [loadingCosts, setLoadingCosts] = useState(false);
    const [pendingDeliveryData, setPendingDeliveryData] = useState<any>(null); // Pour reprise après recharge

    // États
    const [parcelType, setParcelType] = useState<'document' | 'package' | 'moving' | 'cake'>('package');
    // ✅ Par défaut: "motorcycle" sera utilisé par le backend si vide
    const [transportMode, setTransportMode] = useState<string>('');
    const [weight, setWeight] = useState<string>('');
    const [volume, setVolume] = useState<string>('');
    const [declaredValue, setDeclaredValue] = useState<string>('');
    const [numberOfItems, setNumberOfItems] = useState<string>(''); // Nombre d'éléments à transporter
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    
    // États pour formulaire adaptatif (conservés pour compatibilité mais non utilisés dans l'UI)
    const [numberOfPages, setNumberOfPages] = useState<string>(''); // Document
    const [numberOfBoxes, setNumberOfBoxes] = useState<string>(''); // Déménagement
    const [movingFurniture, setMovingFurniture] = useState<string>(''); // Déménagement
    const [movingAccess, setMovingAccess] = useState<string>(''); // Déménagement
    const [cakeSize, setCakeSize] = useState<string>(''); // Gâteau
    const [cakeLayers, setCakeLayers] = useState<string>(''); // Gâteau

    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
    const [showPickupGPS, setShowPickupGPS] = useState(false);
    const [showDropoffGPS, setShowDropoffGPS] = useState(false);
    
    // ✅ États pour aller-retour
    const [isRoundTrip, setIsRoundTrip] = useState<boolean>(false);
    const [returnPickupLocation, setReturnPickupLocation] = useState<LocationData | null>(null);
    const [returnDropoffLocation, setReturnDropoffLocation] = useState<LocationData | null>(null);
    const [showReturnPickupGPS, setShowReturnPickupGPS] = useState(false);
    const [showReturnDropoffGPS, setShowReturnDropoffGPS] = useState(false);
    const [returnDistance, setReturnDistance] = useState<number | null>(null);

    const [preferredDeliveryDate, setPreferredDeliveryDate] = useState<string>('');
    const [preferredDeliveryTimeStart, setPreferredDeliveryTimeStart] = useState<string>('');
    const [preferredDeliveryTimeEnd, setPreferredDeliveryTimeEnd] = useState<string>('');
    
    // ✅ Planification
    const [isScheduled, setIsScheduled] = useState<boolean>(false);
    const [scheduledDateTime, setScheduledDateTime] = useState<Date>(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(14, 0, 0, 0);
        return tomorrow;
    });
    const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
    const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
    // ✅ Par défaut : matching instantané si planification sélectionnée
    const [matchingMode, setMatchingMode] = useState<'immediate' | 'scheduled'>('immediate');

    // États pour le destinataire
    const [recipientName, setRecipientName] = useState<string>('');
    const [recipientPhone, setRecipientPhone] = useState<string>('');
    const [recipientCountryCode, setRecipientCountryCode] = useState<string>('+237');
    const [recipientConsentGranted, setRecipientConsentGranted] = useState<boolean>(false);
    const [recipientInstructions, setRecipientInstructions] = useState<string>('');
    const [recipientAllowTracking, setRecipientAllowTracking] = useState<boolean>(false);

    // Animation d'entrée
    const screenEnterStyle = useScreenEnter();

    // ✅ Fonction de calcul d'assurance avec tranches
    const calculateInsurance = (declaredValue: number): number => {
        // Tranches d'assurance basées sur la valeur déclarée
        const insuranceRates = [
            { min: 0, max: 10000, rate: 0.02 },      // 2% pour 0-10k FCFA
            { min: 10001, max: 50000, rate: 0.015 }, // 1.5% pour 10k-50k FCFA
            { min: 50001, max: 100000, rate: 0.01 }, // 1% pour 50k-100k FCFA
            { min: 100001, max: 500000, rate: 0.008 }, // 0.8% pour 100k-500k FCFA
            { min: 500001, max: Infinity, rate: 0.005 }, // 0.5% pour >500k FCFA
        ];

        for (const tier of insuranceRates) {
            if (declaredValue >= tier.min && declaredValue <= tier.max) {
                return Math.ceil(declaredValue * tier.rate);
            }
        }
        return 0;
    };

    // ✅ Obtenir les tranches d'assurance pour affichage
    const getInsuranceTiers = () => {
        return [
            { range: '0 - 10 000 FCFA', rate: '2%', example: 'Ex: 10 000 FCFA → 200 FCFA' },
            { range: '10 001 - 50 000 FCFA', rate: '1.5%', example: 'Ex: 50 000 FCFA → 750 FCFA' },
            { range: '50 001 - 100 000 FCFA', rate: '1%', example: 'Ex: 100 000 FCFA → 1 000 FCFA' },
            { range: '100 001 - 500 000 FCFA', rate: '0.8%', example: 'Ex: 500 000 FCFA → 4 000 FCFA' },
            { range: '> 500 000 FCFA', rate: '0.5%', example: 'Ex: 1 000 000 FCFA → 5 000 FCFA' },
        ];
    };

    // ✅ Calculer l'assurance quand la valeur déclarée change
    useEffect(() => {
        if (declaredValue && !isNaN(parseFloat(declaredValue))) {
            const value = parseFloat(declaredValue);
            const insurance = calculateInsurance(value);
            setInsuranceCost(insurance);
        } else {
            setInsuranceCost(0);
        }
    }, [declaredValue]);

    // ✅ Charger le solde utilisateur
    useEffect(() => {
        const loadBalance = async () => {
            try {
                const response = await userApi.getTokensBalance() as any;
                if (response.success && response.data) {
                    setUserBalance(response.data.tokens_balance || 0);
                }
            } catch (error) {
                console.error('Erreur chargement solde:', error);
            }
        };
        if (visible) {
            loadBalance();
        }
    }, [visible]);

    // ✅ Vérifier si une commande est en attente après recharge
    useEffect(() => {
        const checkPendingDelivery = async () => {
            try {
                const pendingData = await SafeStorage.getItem('pending_delivery');
                if (pendingData) {
                    const data = JSON.parse(pendingData);
                    const balanceResponse = await userApi.getTokensBalance() as any;
                    const currentBalance = balanceResponse?.data?.tokens_balance || 0;
                    
                    // Calculer les coûts pour cette commande en attente
                    const declaredValueNum = parseFloat(data.declaredValue || '0');
                    const insurance = calculateInsurance(declaredValueNum);
                    // Estimation basique du coût de livraison (sera recalculé si nécessaire)
                    const estimatedDeliveryCost = estimatedDistance ? Math.max(1000, Math.ceil(estimatedDistance * 500)) : 0;
                    const totalCost = estimatedDeliveryCost + insurance;
                    
                    if (currentBalance >= totalCost) {
                        // Solde suffisant, restaurer les données et permettre la création
                        setPendingDeliveryData(data);
                        // Restaurer les états
                        setParcelType(data.parcelType);
                        setTransportMode(data.transportMode || '');
                        setWeight(data.weight || '');
                        setVolume(data.volume || '');
                        setDeclaredValue(data.declaredValue || '');
                        setNumberOfItems(data.numberOfItems || '');
                        setNotes(data.notes || '');
                        setPhotos(data.photos || []);
                        setIsRoundTrip(data.isRoundTrip || false);
                        setReturnPickupLocation(data.returnPickupLocation || null);
                        setReturnDropoffLocation(data.returnDropoffLocation || null);
                        setIsScheduled(data.isScheduled || false);
                        if (data.scheduledDateTime) {
                            setScheduledDateTime(new Date(data.scheduledDateTime));
                        }
                        setMatchingMode(data.matchingMode || 'immediate');
                        setRecipientName(data.recipientName || '');
                        setRecipientPhone(data.recipientPhone || '');
                        setRecipientCountryCode(data.recipientCountryCode || '+237');
                        setRecipientConsentGranted(data.recipientConsentGranted || false);
                        setRecipientInstructions(data.recipientInstructions || '');
                        setRecipientAllowTracking(data.recipientAllowTracking || false);
                        setPickupLocation(data.pickupLocation);
                        setDropoffLocation(data.dropoffLocation);
                        
                        // Afficher une notification
                        Alert.alert(
                            'Commande en attente',
                            'Votre solde est maintenant suffisant. Vous pouvez finaliser votre commande.',
                            [{ text: 'OK' }]
                        );
                    }
                }
            } catch (error) {
                console.error('Erreur vérification commande en attente:', error);
            }
        };
        
        if (visible) {
            checkPendingDelivery();
        }
    }, [visible, estimatedDistance]);

    // Calculer distance
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);

    useEffect(() => {
        if (pickupLocation && dropoffLocation) {
            const distance = calculateDistance(
                pickupLocation.latitude,
                pickupLocation.longitude,
                dropoffLocation.latitude,
                dropoffLocation.longitude
            );
            setEstimatedDistance(distance);
        } else {
            setEstimatedDistance(null);
        }
    }, [pickupLocation, dropoffLocation]);

    // ✅ Calculer distance retour
    useEffect(() => {
        if (isRoundTrip && returnPickupLocation && returnDropoffLocation) {
            const distance = calculateDistance(
                returnPickupLocation.latitude,
                returnPickupLocation.longitude,
                returnDropoffLocation.latitude,
                returnDropoffLocation.longitude
            );
            setReturnDistance(distance);
        } else {
            setReturnDistance(null);
        }
    }, [isRoundTrip, returnPickupLocation, returnDropoffLocation]);

    // ✅ Auto-remplir les points de retour depuis les points aller si activé
    useEffect(() => {
        if (isRoundTrip && pickupLocation && dropoffLocation) {
            // Point de collecte retour = point de livraison aller
            if (!returnPickupLocation) {
                setReturnPickupLocation({
                    latitude: dropoffLocation.latitude,
                    longitude: dropoffLocation.longitude,
                    address: dropoffLocation.address,
                });
            }
            // Point de livraison retour = point de collecte aller
            if (!returnDropoffLocation) {
                setReturnDropoffLocation({
                    latitude: pickupLocation.latitude,
                    longitude: pickupLocation.longitude,
                    address: pickupLocation.address,
                });
            }
        }
    }, [isRoundTrip, pickupLocation, dropoffLocation]);

    useEffect(() => {
        if (visible && userLocation) {
            setDropoffLocation({
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
                address: '',
            });
        }
    }, [visible, userLocation]);

    const handleUseCurrentLocation = async (isPickup: boolean) => {
        setLoadingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'L\'accès à la localisation est nécessaire.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const coords: LocationData = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            try {
                const reverseGeocode = await Location.reverseGeocodeAsync(coords);
                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    coords.address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                }
            } catch (geocodeError) {
                console.warn('Géocodage inverse échoué:', geocodeError);
            }

            if (isPickup) {
                setPickupLocation(coords);
            } else {
                setDropoffLocation(coords);
            }
            setErrors(prev => ({ ...prev, [isPickup ? 'pickup' : 'dropoff']: '' }));
        } catch (error) {
            console.error('Erreur géolocalisation:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleGPSSelect = (coordinates: string, isPickup: boolean) => {
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        const location: LocationData = {
            latitude: lat,
            longitude: lng,
        };

        Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
            .then((reverseGeocode) => {
                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    location.address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                }
                if (isPickup) {
                    setPickupLocation(location);
                } else {
                    setDropoffLocation(location);
                }
            })
            .catch((error) => {
                console.warn('Géocodage inverse échoué:', error);
                if (isPickup) {
                    setPickupLocation(location);
                } else {
                    setDropoffLocation(location);
                }
            });

        if (isPickup) {
            setShowPickupGPS(false);
        } else {
            setShowDropoffGPS(false);
        }
    };

    // ✅ Estimer les coûts de livraison
    const estimateDeliveryCosts = async () => {
        if (!pickupLocation || !dropoffLocation) {
            return;
        }

        setLoadingCosts(true);
        try {
            // TODO: Appeler l'API d'estimation de coûts si disponible
            // Pour l'instant, estimation basique basée sur la distance
            if (estimatedDistance) {
                // Estimation: 500 FCFA par km minimum + 1000 FCFA de base
                const estimatedCost = Math.max(1000, Math.ceil(estimatedDistance * 500));
                setDeliveryCost(estimatedCost);
            }
        } catch (error) {
            console.error('Erreur estimation coûts:', error);
        } finally {
            setLoadingCosts(false);
        }
    };

    // ✅ Calculer les coûts quand les adresses sont définies
    useEffect(() => {
        if (pickupLocation && dropoffLocation) {
            estimateDeliveryCosts();
        }
    }, [pickupLocation, dropoffLocation, estimatedDistance]);

    const handleComplete = async (data: any) => {
        console.log('[DeliveryParcelFlowNew] handleComplete appelé avec data:', data);
        console.log('[DeliveryParcelFlowNew] États actuels:', {
            pickupLocation: !!pickupLocation,
            dropoffLocation: !!dropoffLocation,
            recipientName: !!recipientName,
            recipientPhone: !!recipientPhone,
            recipientConsentGranted,
            declaredValue: !!declaredValue,
        });

        // Validation
        if (!pickupLocation) {
            console.log('[DeliveryParcelFlowNew] ❌ Erreur: pas d\'adresse de collecte');
            Alert.alert('Erreur', 'Veuillez sélectionner une adresse de collecte');
            return;
        }

        if (!dropoffLocation) {
            console.log('[DeliveryParcelFlowNew] ❌ Erreur: pas d\'adresse de livraison');
            Alert.alert('Erreur', 'Veuillez sélectionner une adresse de livraison');
            return;
        }

        if (!recipientName || !recipientPhone || !recipientConsentGranted) {
            console.log('[DeliveryParcelFlowNew] ❌ Erreur: informations destinataire incomplètes');
            Alert.alert('Erreur', 'Veuillez renseigner toutes les informations obligatoires du destinataire');
            return;
        }

        // ✅ Validation valeur déclarée obligatoire
        if (!declaredValue || isNaN(parseFloat(declaredValue)) || parseFloat(declaredValue) <= 0) {
            console.log('[DeliveryParcelFlowNew] ❌ Erreur: valeur déclarée manquante ou invalide');
            Alert.alert('Erreur', 'La valeur déclarée est obligatoire et doit être supérieure à 0');
            return;
        }

        console.log('[DeliveryParcelFlowNew] ✅ Validation passée, vérification du solde...');

        // ✅ Vérifier le solde utilisateur
        const totalCost = (deliveryCost || 0) + insuranceCost;
        const balanceResponse = await userApi.getTokensBalance() as any;
        const currentBalance = balanceResponse?.data?.tokens_balance || 0;

        if (currentBalance < totalCost) {
            // Solde insuffisant - sauvegarder la commande et rediriger vers recharge
            const deliveryData = {
                pickupLocation,
                dropoffLocation,
                parcelType,
                transportMode,
                weight,
                volume,
                declaredValue,
                numberOfItems,
                notes,
                photos,
                isRoundTrip,
                returnPickupLocation,
                returnDropoffLocation,
                isScheduled,
                scheduledDateTime,
                matchingMode,
                recipientName,
                recipientPhone,
                recipientCountryCode,
                recipientConsentGranted,
                recipientInstructions,
                recipientAllowTracking,
                preferredDeliveryDate,
                preferredDeliveryTimeStart,
                preferredDeliveryTimeEnd,
            };

            await SafeStorage.setItem('pending_delivery', JSON.stringify(deliveryData));
            setPendingDeliveryData(deliveryData);

            Alert.alert(
                'Solde insuffisant',
                `Votre solde actuel (${currentBalance.toLocaleString('fr-FR')} FCFA) est insuffisant pour couvrir le coût total (${totalCost.toLocaleString('fr-FR')} FCFA).\n\nVeuillez recharger votre compte pour continuer.`,
                [
                    {
                        text: 'Annuler',
                        style: 'cancel',
                        onPress: () => {
                            SafeStorage.removeItem('pending_delivery');
                        },
                    },
                    {
                        text: 'Recharger',
                        onPress: () => {
                            onClose();
                            (navigation as any).navigate('RechargeTokens');
                        },
                    },
                ]
            );
            return;
        }

        console.log('[DeliveryParcelFlowNew] ✅ Solde suffisant, création de la livraison...');

        // ✅ Si une commande était en attente, utiliser ses données
        const deliveryDataToUse = pendingDeliveryData || {
            pickupLocation,
            dropoffLocation,
            parcelType,
            transportMode,
            weight,
            volume,
            declaredValue,
            numberOfItems,
            notes,
            photos,
            isRoundTrip,
            returnPickupLocation,
            returnDropoffLocation,
            isScheduled,
            scheduledDateTime,
            matchingMode,
            recipientName,
            recipientPhone,
            recipientCountryCode,
            recipientConsentGranted,
            recipientInstructions,
            recipientAllowTracking,
            preferredDeliveryDate,
            preferredDeliveryTimeStart,
            preferredDeliveryTimeEnd,
        };

        // ✅ Utiliser les données en attente si disponibles
        const deliveryData = deliveryDataToUse;
        
        // ✅ Validation aller-retour
        if (deliveryData.isRoundTrip && (!deliveryData.returnPickupLocation || !deliveryData.returnDropoffLocation)) {
            Alert.alert('Erreur', 'Veuillez sélectionner les points de collecte et de livraison pour le retour');
            return;
        }

        setLoading(true);
        try {
            // ✅ Par défaut: "motorcycle" si aucun type spécifié (sera géré par le backend)
        const payload: CreateDeliveryRequestPayload = {
                preferred_vehicle_type: deliveryData.transportMode || undefined, // Backend utilisera "motorcycle" par défaut
                is_round_trip: deliveryData.isRoundTrip || undefined,
                // ✅ Planification
                scheduled_delivery_at: deliveryData.isScheduled && deliveryData.scheduledDateTime
                    ? new Date(deliveryData.scheduledDateTime).toISOString()
                    : undefined,
                matching_mode: deliveryData.isScheduled ? deliveryData.matchingMode : undefined,
                ...(deliveryData.isRoundTrip && deliveryData.returnPickupLocation && deliveryData.returnDropoffLocation && {
                    return_pickup: {
                        latitude: deliveryData.returnPickupLocation.latitude,
                        longitude: deliveryData.returnPickupLocation.longitude,
                        address: deliveryData.returnPickupLocation.address,
                    },
                    return_dropoff: {
                        latitude: deliveryData.returnDropoffLocation.latitude,
                        longitude: deliveryData.returnDropoffLocation.longitude,
                        address: deliveryData.returnDropoffLocation.address,
                    },
                    round_trip_discount_percent: 10, // 10% de réduction par défaut pour aller-retour
                }),
                parcel: {
                    type_id: getParcelTypeId(deliveryData.parcelType),
                    notes: deliveryData.notes || `Colis: ${deliveryData.parcelType}`,
                    photos: deliveryData.photos || [],
                    constraints: {
                        weight: deliveryData.weight ? parseFloat(deliveryData.weight) : undefined,
                        volume: deliveryData.volume ? parseFloat(deliveryData.volume) : undefined,
                        declared_value: deliveryData.declaredValue ? parseFloat(deliveryData.declaredValue) : undefined,
                        number_of_items: deliveryData.numberOfItems ? parseInt(deliveryData.numberOfItems) : undefined,
                    },
                },
                pickup: {
                    latitude: deliveryData.pickupLocation.latitude,
                    longitude: deliveryData.pickupLocation.longitude,
                    address: deliveryData.pickupLocation.address,
                },
                dropoff: {
                    latitude: deliveryData.dropoffLocation.latitude,
                    longitude: deliveryData.dropoffLocation.longitude,
                    address: deliveryData.dropoffLocation.address,
                },
                recipient: {
                    contact_name: deliveryData.recipientName,
                    contact_phone: deliveryData.recipientPhone,
                    country_code: deliveryData.recipientCountryCode || undefined,
                    consent_granted: deliveryData.recipientConsentGranted,
                    notes: deliveryData.recipientInstructions || undefined,
                    allow_tracking: deliveryData.recipientAllowTracking || undefined,
                },
                metadata: {
                    kind: 'parcel',
                    parcel_type: deliveryData.parcelType,
                },
                initial_event_payload: {},
            };

            const result = await deliveryApi.createDeliveryRequest(payload);

            if (result.success && result.data?.id) {
                // ✅ Nettoyer la commande en attente si elle existait
                await SafeStorage.removeItem('pending_delivery');
                setPendingDeliveryData(null);
                
                Alert.alert(
                    'Livraison créée',
                    'Votre demande de livraison a été créée avec succès. Le matching d\'un coursier est en cours.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (onSuccess) {
                                    onSuccess(result.data.id);
                                }
                                onClose();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', result.error || 'Impossible de créer la livraison');
            }
        } catch (error: any) {
            console.error('Erreur création livraison:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const getParcelTypeId = (type: string): number | undefined => {
        // ✅ CORRECTION: Ne plus utiliser d'IDs codés en dur
        // Le backend utilisera un type par défaut ou déduira depuis preferred_vehicle_type
        // Retourner undefined pour laisser le backend gérer le type automatiquement
        return undefined;
    };

    // Composants d'étapes
    const ParcelInfoStep = (
        <KeyboardAwareScreen style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Informations du colis</Text>
            <Text style={styles.stepSubtitle}>Décrivez votre colis pour une meilleure estimation</Text>

            <View style={styles.typeSelector}>
                <Text style={styles.label}>Type de colis</Text>
                <View style={styles.typeButtonsGrid}>
                    {[
                        { id: 'document', label: 'Document', icon: 'file-text' },
                        { id: 'package', label: 'Paquet/Sac', icon: 'package' },
                        { id: 'moving', label: 'Déménagement', icon: 'truck' },
                        { id: 'cake', label: 'Gâteau', icon: 'cake' },
                    ].map((type) => (
                        <HapticTouchable
                            key={type.id}
                            hapticType="light"
                            onPress={() => setParcelType(type.id as any)}
                            style={[
                                styles.typeButtonGrid,
                                parcelType === type.id && styles.typeButtonActive,
                            ]}
                        >
                            <SafeIcon
                                name={type.icon}
                                size={16}
                                color={parcelType === type.id ? '#FFFFFF' : modernColors.text}
                            />
                            <Text
                                style={[
                                    styles.typeButtonTextGrid,
                                    parcelType === type.id && styles.typeButtonTextActive,
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {type.label}
                            </Text>
                        </HapticTouchable>
                    ))}
                </View>
            </View>

            {/* Champ Nombre */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre</Text>
                <NativeInput
                    placeholder="Nombre d'éléments à transporter"
                    value={numberOfItems}
                    onChangeText={setNumberOfItems}
                    keyboardType="numeric"
                />
            </View>

            {/* Champ Valeur déclarée - OBLIGATOIRE */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Valeur déclarée (FCFA) *</Text>
                <NativeInput
                    placeholder="Ex: 50000"
                    value={declaredValue}
                    onChangeText={setDeclaredValue}
                    keyboardType="numeric"
                />
                {!declaredValue && (
                    <Text style={styles.errorText}>Ce champ est obligatoire</Text>
                )}
                {declaredValue && !isNaN(parseFloat(declaredValue)) && insuranceCost > 0 && (() => {
                    const value = parseFloat(declaredValue);
                    let rate = 'N/A';
                    if (value >= 0 && value <= 10000) rate = '2%';
                    else if (value >= 10001 && value <= 50000) rate = '1.5%';
                    else if (value >= 50001 && value <= 100000) rate = '1%';
                    else if (value >= 100001 && value <= 500000) rate = '0.8%';
                    else if (value > 500000) rate = '0.5%';
                    return (
                        <Text style={styles.helperText}>
                            Assurance: {insuranceCost.toLocaleString('fr-FR')} FCFA (taux: {rate})
                        </Text>
                    );
                })()}
            </View>

            {/* Tableau des tranches d'assurance */}
            {declaredValue && !isNaN(parseFloat(declaredValue)) && (
                <View style={styles.insuranceTableContainer}>
                    <Text style={styles.insuranceTableTitle}>Tranches d'assurance</Text>
                    <View style={styles.insuranceTable}>
                        {getInsuranceTiers().map((tier, index) => (
                            <View key={index} style={styles.insuranceTableRow}>
                                <Text style={styles.insuranceTableRange}>{tier.range}</Text>
                                <Text style={styles.insuranceTableRate}>{tier.rate}</Text>
                                <Text style={styles.insuranceTableExample}>{tier.example}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Notes (optionnel)</Text>
                <NativeInput
                    placeholder="Instructions spéciales..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    minLines={3}
                />
            </View>

            {/* Type de transport remonté avant les photos */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Type de transport souhaité</Text>
                <View style={styles.vehicleGridContainer}>
                    {VEHICLE_TRANSPORT_OPTIONS.map((type) => (
                        <TouchableOpacity
                            key={type.value}
                            style={[
                                styles.vehicleOptionGrid,
                                transportMode === type.value && styles.vehicleOptionSelected,
                            ]}
                            onPress={() => setTransportMode(transportMode === type.value ? '' : type.value)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.vehicleIconGrid}>{type.icon}</Text>
                            <Text
                                style={[
                                    styles.vehicleLabelGrid,
                                    transportMode === type.value && styles.vehicleLabelSelected,
                                ]}
                                numberOfLines={2}
                            >
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* ✅ Option Aller-retour */}
            <View style={styles.inputGroup}>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setIsRoundTrip(!isRoundTrip)}
                    >
                        <View style={[styles.checkbox, isRoundTrip && styles.checkboxChecked]}>
                            {isRoundTrip && (
                                <SafeIcon name="check" size={16} color="#FFFFFF" />
                            )}
                        </View>
                        <Text style={styles.checkboxLabel}>
                            Aller-retour (réduction 10%)
                        </Text>
                    </TouchableOpacity>
                </View>
                {isRoundTrip && (
                    <>
                        <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>
                            Point de collecte retour (même que point de livraison aller)
                        </Text>
                        {returnPickupLocation ? (
                            <NativeCard style={styles.locationCard}>
                                <Text style={styles.locationText}>
                                    {returnPickupLocation.address ||
                                        `${returnPickupLocation.latitude.toFixed(6)}, ${returnPickupLocation.longitude.toFixed(6)}`}
                                </Text>
                                <NativeButton
                                    title="Modifier"
                                    variant="outline"
                                    size="small"
                                    onPress={() => setShowReturnPickupGPS(true)}
                                    style={styles.changeButton}
                                />
                            </NativeCard>
                        ) : (
                            <NativeButton
                                title="Sélectionner le point de collecte retour"
                                variant="outline"
                                onPress={() => setShowReturnPickupGPS(true)}
                            />
                        )}
                        <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>
                            Point de livraison retour (même que point de collecte aller)
                        </Text>
                        {returnDropoffLocation ? (
                            <NativeCard style={styles.locationCard}>
                                <Text style={styles.locationText}>
                                    {returnDropoffLocation.address ||
                                        `${returnDropoffLocation.latitude.toFixed(6)}, ${returnDropoffLocation.longitude.toFixed(6)}`}
                                </Text>
                                {returnDistance !== null && (
                                    <Text style={styles.distance}>
                                        Distance retour : {returnDistance.toFixed(1)} km
                                    </Text>
                                )}
                                <NativeButton
                                    title="Modifier"
                                    variant="outline"
                                    size="small"
                                    onPress={() => setShowReturnDropoffGPS(true)}
                                    style={styles.changeButton}
                                />
                            </NativeCard>
                        ) : (
                            <NativeButton
                                title="Sélectionner le point de livraison retour"
                                variant="outline"
                                onPress={() => setShowReturnDropoffGPS(true)}
                            />
                        )}
                    </>
                )}
            </View>

            {/* ✅ Section Planification */}
            <View style={styles.inputGroup}>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => {
                            setIsScheduled(!isScheduled);
                            if (!isScheduled) {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                tomorrow.setHours(14, 0, 0, 0);
                                setScheduledDateTime(tomorrow);
                            }
                        }}
                    >
                        <View style={[styles.checkbox, isScheduled && styles.checkboxChecked]}>
                            {isScheduled && <SafeIcon name="check" size={16} color="#FFFFFF" />}
                        </View>
                        <Text style={styles.checkboxLabel}>Planifier cette livraison</Text>
                    </TouchableOpacity>
                </View>
                {isScheduled && (
                    <>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Date de livraison *</Text>
                            <TouchableOpacity
                                onPress={() => setShowDatePicker(true)}
                                style={styles.dateTimeButton}
                            >
                                <Text style={styles.dateTimeText}>
                                    {scheduledDateTime.toLocaleDateString('fr-FR', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </Text>
                                <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={scheduledDateTime}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event, date) => {
                                        setShowDatePicker(false);
                                        if (date) {
                                            // Préserver l'heure existante
                                            date.setHours(
                                                scheduledDateTime.getHours(),
                                                scheduledDateTime.getMinutes(),
                                                0,
                                                0
                                            );
                                            setScheduledDateTime(date);
                                        }
                                    }}
                                />
                            )}
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Heure de livraison *</Text>
                            <TouchableOpacity
                                onPress={() => setShowTimePicker(true)}
                                style={styles.dateTimeButton}
                            >
                                <Text style={styles.dateTimeText}>
                                    {scheduledDateTime.toLocaleTimeString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </Text>
                                <SafeIcon name="clock" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            {showTimePicker && (
                                <DateTimePicker
                                    value={scheduledDateTime}
                                    mode="time"
                                    display="default"
                                    is24Hour={true}
                                    onChange={(event, date) => {
                                        setShowTimePicker(false);
                                        if (date) {
                                            // Préserver la date existante
                                            const newDateTime = new Date(scheduledDateTime);
                                            newDateTime.setHours(date.getHours(), date.getMinutes(), 0, 0);
                                            setScheduledDateTime(newDateTime);
                                        }
                                    }}
                                />
                            )}
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Quand matcher le coursier ?</Text>
                            <View style={styles.radioGroup}>
                                <TouchableOpacity
                                    style={styles.radioOption}
                                    onPress={() => setMatchingMode('immediate')}
                                >
                                    <View style={[styles.radio, matchingMode === 'immediate' && styles.radioChecked]}>
                                        {matchingMode === 'immediate' && <View style={styles.radioInner} />}
                                    </View>
                                    <View style={styles.radioLabelContainer}>
                                        <Text style={styles.radioLabel}>Maintenant (par défaut - contact à l'avance)</Text>
                                        <Text style={styles.radioDescription}>
                                            ✅ Le coursier sera assigné maintenant. Vous pourrez le contacter et préparer la livraison. Il devra déclencher la livraison au moment planifié.
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.radioOption}
                                    onPress={() => setMatchingMode('scheduled')}
                                >
                                    <View style={[styles.radio, matchingMode === 'scheduled' && styles.radioChecked]}>
                                        {matchingMode === 'scheduled' && <View style={styles.radioInner} />}
                                    </View>
                                    <View style={styles.radioLabelContainer}>
                                        <Text style={styles.radioLabel}>Au moment planifié</Text>
                                        <Text style={styles.radioDescription}>
                                            Le coursier sera recherché automatiquement à la date et heure planifiée.
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                )}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Photos du colis</Text>
                <MediaUploadManager
                    mediaUris={photos}
                    onMediaChange={setPhotos}
                    maxMedia={5}
                    allowVideo={false}
                />
            </View>
        </KeyboardAwareScreen>
    );

    // ✅ NOUVEAU : Handler pour sélection d'adresse de collecte sauvegardée ou GPS
    const handlePickupAddressSelect = (address: UserSavedAddress | LocationObject) => {
        if ('id' in address && 'latitude' in address) {
            // C'est un UserSavedAddress
            const savedAddr = address as UserSavedAddress;
            setPickupLocation({
                latitude: savedAddr.latitude,
                longitude: savedAddr.longitude,
                address: savedAddr.address,
            });
        } else {
            // C'est un LocationObject
            const loc = address as LocationObject;
            const coords = loc.coordinates;
            if (coords?.lat && coords?.lng) {
                setPickupLocation({
                    latitude: coords.lat,
                    longitude: coords.lng,
                    address: loc.raw || loc.place_name || '',
                });
            }
        }
    };

    const PickupAddressStep = (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Adresse de collecte</Text>
            <Text style={styles.stepSubtitle}>Où se trouve le colis actuellement ?</Text>

            {/* ✅ NOUVEAU : Sélecteur d'adresse sauvegardée */}
            <SavedAddressSelector
                addressType="pickup"
                value={pickupLocation ? {
                    raw: pickupLocation.address || '',
                    place_name: pickupLocation.address || '',
                    coordinates: { lat: pickupLocation.latitude, lng: pickupLocation.longitude },
                    components: {},
                } : undefined}
                onSelect={handlePickupAddressSelect}
                allowNew={true}
            />

            {pickupLocation ? (
                <NativeCard style={styles.locationCard}>
                    <View style={styles.locationHeader}>
                        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                        <Text style={styles.locationLabel}>Adresse sélectionnée</Text>
                    </View>
                    <Text style={styles.locationText}>
                        {pickupLocation.address ||
                            `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                    </Text>
                    <NativeButton
                        title="Changer l'adresse"
                        variant="outline"
                        size="small"
                        onPress={() => setShowPickupGPS(true)}
                        style={styles.changeButton}
                    />
                </NativeCard>
            ) : (
                <View style={styles.locationActions}>
                    <NativeButton
                        title={loadingLocation ? 'Localisation...' : 'Utiliser ma position actuelle'}
                        variant="primary"
                        onPress={() => handleUseCurrentLocation(true)}
                        disabled={loadingLocation}
                        style={styles.locationButton}
                    />
                    <NativeButton
                        title="Sélectionner sur la carte"
                        variant="outline"
                        onPress={() => setShowPickupGPS(true)}
                        style={styles.locationButton}
                    />
                </View>
            )}
        </ScrollView>
    );

    // ✅ NOUVEAU : Handler pour sélection d'adresse de livraison sauvegardée ou GPS
    const handleDropoffAddressSelect = (address: UserSavedAddress | LocationObject) => {
        if ('id' in address && 'latitude' in address) {
            // C'est un UserSavedAddress
            const savedAddr = address as UserSavedAddress;
            setDropoffLocation({
                latitude: savedAddr.latitude,
                longitude: savedAddr.longitude,
                address: savedAddr.address,
            });
        } else {
            // C'est un LocationObject
            const loc = address as LocationObject;
            const coords = loc.coordinates;
            if (coords?.lat && coords?.lng) {
                setDropoffLocation({
                    latitude: coords.lat,
                    longitude: coords.lng,
                    address: loc.raw || loc.place_name || '',
                });
            }
        }
    };

    const DropoffAddressStep = (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Adresse de livraison</Text>
            <Text style={styles.stepSubtitle}>Où souhaitez-vous que le colis soit livré ?</Text>

            {/* ✅ NOUVEAU : Sélecteur d'adresse sauvegardée */}
            <SavedAddressSelector
                addressType="dropoff"
                value={dropoffLocation ? {
                    raw: dropoffLocation.address || '',
                    place_name: dropoffLocation.address || '',
                    coordinates: { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude },
                    components: {},
                } : undefined}
                onSelect={handleDropoffAddressSelect}
                allowNew={true}
            />

            {dropoffLocation ? (
                <NativeCard style={styles.locationCard}>
                    <View style={styles.locationHeader}>
                        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                        <Text style={styles.locationLabel}>Adresse sélectionnée</Text>
                    </View>
                    <Text style={styles.locationText}>
                        {dropoffLocation.address ||
                            `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}`}
                    </Text>
                    {estimatedDistance !== null && (
                        <Text style={styles.distance}>
                            Distance : {estimatedDistance.toFixed(1)} km
                        </Text>
                    )}
                    <NativeButton
                        title="Sélectionner sur la carte (nouveau)"
                        variant="outline"
                        size="small"
                        onPress={() => setShowDropoffGPS(true)}
                        style={styles.changeButton}
                    />
                </NativeCard>
            ) : (
                <View style={styles.locationActions}>
                    <NativeButton
                        title={loadingLocation ? 'Localisation...' : 'Utiliser ma position actuelle'}
                        variant="primary"
                        onPress={() => handleUseCurrentLocation(false)}
                        disabled={loadingLocation}
                        style={styles.locationButton}
                    />
                    <NativeButton
                        title="Sélectionner sur la carte"
                        variant="outline"
                        onPress={() => setShowDropoffGPS(true)}
                        style={styles.locationButton}
                    />
                </View>
            )}
        </ScrollView>
    );

    const RecipientInfoStep = (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Informations du destinataire</Text>
            <Text style={styles.stepSubtitle}>Qui va recevoir le colis ?</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom du destinataire *</Text>
                <NativeInput
                    placeholder="Ex: Jean Dupont"
                    value={recipientName}
                    onChangeText={setRecipientName}
                    autoCapitalize="words"
                />
                {!recipientName && (
                    <Text style={styles.errorText}>Ce champ est obligatoire</Text>
                )}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Téléphone *</Text>
                <View style={styles.phoneInputContainer}>
                    <NativeInput
                        placeholder="+237"
                        value={recipientCountryCode}
                        onChangeText={setRecipientCountryCode}
                        keyboardType="phone-pad"
                        style={styles.countryCodeInput}
                    />
                    <NativeInput
                        placeholder="6XX XXX XXX"
                        value={recipientPhone}
                        onChangeText={setRecipientPhone}
                        keyboardType="phone-pad"
                        style={styles.phoneInput}
                    />
                </View>
                {!recipientPhone && (
                    <Text style={styles.errorText}>Ce champ est obligatoire</Text>
                )}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Instructions de livraison (optionnel)</Text>
                <NativeInput
                    placeholder="Ex: Sonner 2 fois, laisser devant la porte..."
                    value={recipientInstructions}
                    onChangeText={setRecipientInstructions}
                    multiline
                    minLines={3}
                />
            </View>

            <View style={styles.checkboxGroup}>
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setRecipientConsentGranted(!recipientConsentGranted)}
                >
                    <View style={[styles.checkbox, recipientConsentGranted && styles.checkboxChecked]}>
                        {recipientConsentGranted && (
                            <SafeIcon name="check" size={16} color="#FFFFFF" />
                        )}
                    </View>
                    <Text style={styles.checkboxLabel}>
                        Le destinataire consent à recevoir le colis et à être contacté *
                    </Text>
                </TouchableOpacity>
                {!recipientConsentGranted && (
                    <Text style={styles.errorText}>Ce consentement est obligatoire</Text>
                )}
            </View>

            <View style={styles.checkboxGroup}>
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setRecipientAllowTracking(!recipientAllowTracking)}
                >
                    <View style={[styles.checkbox, recipientAllowTracking && styles.checkboxChecked]}>
                        {recipientAllowTracking && (
                            <SafeIcon name="check" size={16} color="#FFFFFF" />
                        )}
                    </View>
                    <Text style={styles.checkboxLabel}>
                        Autoriser le suivi de position du destinataire (optionnel)
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    const SummaryStep = (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Récapitulatif</Text>
            <Text style={styles.stepSubtitle}>Vérifiez les informations avant de confirmer</Text>

            {/* Informations du colis */}
            <NativeCard style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Informations du colis</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Type</Text>
                    <Text style={styles.summaryValue}>
                        {parcelType === 'document' ? 'Document' :
                         parcelType === 'package' ? 'Paquet/Sac' :
                         parcelType === 'moving' ? 'Déménagement' :
                         parcelType === 'cake' ? 'Gâteau' : parcelType}
                    </Text>
                </View>
                {numberOfItems && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Nombre</Text>
                        <Text style={styles.summaryValue}>{numberOfItems}</Text>
                    </View>
                )}
                {weight && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Poids</Text>
                        <Text style={styles.summaryValue}>{weight} kg</Text>
                    </View>
                )}
                {volume && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Volume</Text>
                        <Text style={styles.summaryValue}>{volume} L</Text>
                    </View>
                )}
                {declaredValue && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Valeur déclarée</Text>
                        <Text style={styles.summaryValue}>{parseFloat(declaredValue).toLocaleString('fr-FR')} FCFA</Text>
                    </View>
                )}
                {transportMode && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Transport</Text>
                        <Text style={styles.summaryValue}>
                            {VEHICLE_TRANSPORT_OPTIONS.find(t => t.value === transportMode)?.label || transportMode}
                        </Text>
                    </View>
                )}
                {isRoundTrip && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Aller-retour</Text>
                        <Text style={styles.summaryValue}>Oui (réduction 10%)</Text>
                    </View>
                )}
                {notes && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Notes</Text>
                        <Text style={styles.summaryValue}>{notes}</Text>
                    </View>
                )}
            </NativeCard>

            {/* Adresses */}
            <NativeCard style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Adresses</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Collecte</Text>
                    <Text style={[styles.summaryValue, { flex: 2 }]}>
                        {pickupLocation?.address || 
                         (pickupLocation ? `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}` : 'Non défini')}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Livraison</Text>
                    <Text style={[styles.summaryValue, { flex: 2 }]}>
                        {dropoffLocation?.address || 
                         (dropoffLocation ? `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}` : 'Non défini')}
                    </Text>
                </View>
                {estimatedDistance !== null && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Distance</Text>
                        <Text style={styles.summaryValue}>{estimatedDistance.toFixed(1)} km</Text>
                    </View>
                )}
                {isRoundTrip && returnPickupLocation && returnDropoffLocation && (
                    <>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Collecte retour</Text>
                            <Text style={[styles.summaryValue, { flex: 2 }]}>
                                {returnPickupLocation.address || 
                                 `${returnPickupLocation.latitude.toFixed(6)}, ${returnPickupLocation.longitude.toFixed(6)}`}
                            </Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Livraison retour</Text>
                            <Text style={[styles.summaryValue, { flex: 2 }]}>
                                {returnDropoffLocation.address || 
                                 `${returnDropoffLocation.latitude.toFixed(6)}, ${returnDropoffLocation.longitude.toFixed(6)}`}
                            </Text>
                        </View>
                        {returnDistance !== null && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Distance retour</Text>
                                <Text style={styles.summaryValue}>{returnDistance.toFixed(1)} km</Text>
                            </View>
                        )}
                    </>
                )}
            </NativeCard>

            {/* Planification */}
            {isScheduled && (
                <NativeCard style={styles.summaryCard}>
                    <Text style={styles.summaryCardTitle}>Planification</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Date</Text>
                        <Text style={styles.summaryValue}>
                            {scheduledDateTime.toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Heure</Text>
                        <Text style={styles.summaryValue}>
                            {scheduledDateTime.toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Matching</Text>
                        <Text style={styles.summaryValue}>
                            {matchingMode === 'immediate' ? 'Maintenant' : 'Au moment planifié'}
                        </Text>
                    </View>
                </NativeCard>
            )}

            {/* Informations destinataire */}
            <NativeCard style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Destinataire</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Nom</Text>
                    <Text style={styles.summaryValue}>{recipientName}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Téléphone</Text>
                    <Text style={styles.summaryValue}>{recipientCountryCode} {recipientPhone}</Text>
                </View>
                {recipientInstructions && (
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Instructions</Text>
                        <Text style={[styles.summaryValue, { flex: 2 }]}>{recipientInstructions}</Text>
                    </View>
                )}
            </NativeCard>

            {/* Coûts */}
            <NativeCard style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Coûts</Text>
                {loadingCosts ? (
                    <Text style={styles.loadingText}>Calcul des coûts...</Text>
                ) : (
                    <>
                        {deliveryCost !== null && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Livraison</Text>
                                <Text style={styles.summaryValue}>{deliveryCost.toLocaleString('fr-FR')} FCFA</Text>
                            </View>
                        )}
                        {insuranceCost > 0 && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Assurance</Text>
                                <Text style={styles.summaryValue}>{insuranceCost.toLocaleString('fr-FR')} FCFA</Text>
                            </View>
                        )}
                        <View style={[styles.summaryRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={[styles.totalValue, userBalance < (deliveryCost || 0) + insuranceCost && styles.insufficientBalance]}>
                                {((deliveryCost || 0) + insuranceCost).toLocaleString('fr-FR')} FCFA
                            </Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Solde disponible</Text>
                            <Text style={[styles.summaryValue, userBalance < (deliveryCost || 0) + insuranceCost && styles.insufficientBalance]}>
                                {userBalance.toLocaleString('fr-FR')} FCFA
                            </Text>
                        </View>
                        {userBalance < (deliveryCost || 0) + insuranceCost && (
                            <Text style={styles.warningText}>
                                ⚠️ Votre solde est insuffisant. Vous serez redirigé vers la page de recharge.
                            </Text>
                        )}
                    </>
                )}
            </NativeCard>
        </ScrollView>
    );

    const steps = [
        {
            id: 'parcel',
            label: 'Colis',
            icon: 'package',
            component: ParcelInfoStep,
            validation: () => !!parcelType && !!declaredValue && !isNaN(parseFloat(declaredValue)) && parseFloat(declaredValue) > 0,
        },
        {
            id: 'pickup',
            label: 'Collecte',
            icon: 'map-pin',
            component: PickupAddressStep,
            validation: () => !!pickupLocation,
        },
        {
            id: 'dropoff',
            label: 'Livraison',
            icon: 'navigation',
            component: DropoffAddressStep,
            validation: () => !!dropoffLocation,
        },
        {
            id: 'recipient',
            label: 'Destinataire',
            icon: 'user',
            component: RecipientInfoStep,
            validation: () => !!recipientName && !!recipientPhone && recipientConsentGranted,
        },
        {
            id: 'summary',
            label: 'Récapitulatif',
            icon: 'check-circle',
            component: SummaryStep,
            validation: () => true, // Toujours valide, la validation se fait dans handleComplete
        },
    ];

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <View style={styles.container}>
                    {/* Header amélioré */}
                    <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <SafeIcon name="package" size={24} color="#FFFFFF" />
                            <View style={styles.headerText}>
                                <Text style={styles.headerTitle}>Livraison de colis</Text>
                                <Text style={styles.headerSubtitle}>Expédiez votre colis en toute sécurité</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.closeButton}
                            disabled={loading}
                        >
                            <SafeIcon name="x" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Content avec animation */}
                    <Animated.View style={[styles.content, screenEnterStyle.style as any]}>
                        <StepWizardForm
                            steps={steps}
                            onComplete={handleComplete}
                            onCancel={onClose}
                        />
                    </Animated.View>
                </View>
            </Modal>

            {/* Modals GPS */}
            <ModernGPSModal
                visible={showPickupGPS}
                onClose={() => setShowPickupGPS(false)}
                onSelect={(coords) => handleGPSSelect(coords, true)}
                currentLocation={
                    pickupLocation
                        ? { lat: pickupLocation.latitude, lng: pickupLocation.longitude }
                        : userLocation
                            ? { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude }
                            : null
                }
                title="Sélectionner le point de collecte"
                allowZoneSelection={false}
            />

            <ModernGPSModal
                visible={showDropoffGPS}
                onClose={() => setShowDropoffGPS(false)}
                onSelect={(coords) => handleGPSSelect(coords, false)}
                currentLocation={
                    dropoffLocation
                        ? { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude }
                        : userLocation
                            ? { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude }
                            : null
                }
                title="Sélectionner le point de livraison"
                allowZoneSelection={false}
            />

            {/* ✅ Modals GPS pour retour */}
            <ModernGPSModal
                visible={showReturnPickupGPS}
                onClose={() => setShowReturnPickupGPS(false)}
                onSelect={(coords) => {
                    const [lat, lng] = coords.split(',').map(parseFloat);
                    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
                        .then((reverseGeocode) => {
                            let address = '';
                            if (reverseGeocode && reverseGeocode.length > 0) {
                                const addr = reverseGeocode[0];
                                address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                            }
                            setReturnPickupLocation({ latitude: lat, longitude: lng, address });
                            setShowReturnPickupGPS(false);
                        })
                        .catch(() => {
                            setReturnPickupLocation({ latitude: lat, longitude: lng, address: '' });
                            setShowReturnPickupGPS(false);
                        });
                }}
                currentLocation={
                    returnPickupLocation
                        ? { lat: returnPickupLocation.latitude, lng: returnPickupLocation.longitude }
                        : dropoffLocation
                            ? { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude }
                            : userLocation
                                ? { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude }
                                : null
                }
                title="Sélectionner le point de collecte retour"
                allowZoneSelection={false}
            />

            <ModernGPSModal
                visible={showReturnDropoffGPS}
                onClose={() => setShowReturnDropoffGPS(false)}
                onSelect={(coords) => {
                    const [lat, lng] = coords.split(',').map(parseFloat);
                    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
                        .then((reverseGeocode) => {
                            let address = '';
                            if (reverseGeocode && reverseGeocode.length > 0) {
                                const addr = reverseGeocode[0];
                                address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                            }
                            setReturnDropoffLocation({ latitude: lat, longitude: lng, address });
                            setShowReturnDropoffGPS(false);
                        })
                        .catch(() => {
                            setReturnDropoffLocation({ latitude: lat, longitude: lng, address: '' });
                            setShowReturnDropoffGPS(false);
                        });
                }}
                currentLocation={
                    returnDropoffLocation
                        ? { lat: returnDropoffLocation.latitude, lng: returnDropoffLocation.longitude }
                        : pickupLocation
                            ? { lat: pickupLocation.latitude, lng: pickupLocation.longitude }
                            : userLocation
                                ? { lat: userLocation.coords.latitude, lng: userLocation.coords.longitude }
                                : null
                }
                title="Sélectionner le point de livraison retour"
                allowZoneSelection={false}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#E0E7FF',
        marginTop: 2,
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
    stepContent: {
        flex: 1,
        padding: 20,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 24,
    },
    typeSelector: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    typeButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    typeButtonsGrid: {
        flexDirection: 'row',
        gap: 6,
        width: '100%',
    },
    typeButtonGrid: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 2,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: modernColors.border,
        minHeight: 60,
    },
    typeButton: {
        flex: 1,
        minWidth: '30%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
    },
    typeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    typeButtonTextGrid: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    typeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    typeButtonTextActive: {
        color: '#FFFFFF',
    },
    inputGroup: {
        marginBottom: 16,
    },
    locationCard: {
        marginTop: 16,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    locationLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    locationText: {
        fontSize: 16,
        color: modernColors.text,
        marginBottom: 8,
    },
    distance: {
        fontSize: 12,
        color: modernColors.primary,
        marginTop: 4,
    },
    locationActions: {
        gap: 12,
        marginTop: 16,
    },
    locationButton: {
        marginBottom: 0,
    },
    changeButton: {
        marginTop: 12,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    countryCodeInput: {
        flex: 0.3,
    },
    phoneInput: {
        flex: 0.7,
    },
    checkboxGroup: {
        marginBottom: 16,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
    },
    vehicleScrollContainer: {
        marginTop: 8,
        marginBottom: 8,
        height: 110,
        width: '100%',
    },
    vehicleScroll: {
        flexGrow: 0,
        flexShrink: 0,
        height: 110,
    },
    vehicleScrollContent: {
        paddingRight: 16,
        paddingLeft: 4,
        alignItems: 'center',
        flexGrow: 0,
    },
    vehicleGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    vehicleOptionGrid: {
        width: '23%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surfaceVariant,
        minHeight: 80,
    },
    vehicleOption: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        marginRight: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surfaceVariant,
        width: 90,
        height: 90,
        flexShrink: 0,
    },
    vehicleOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '20',
    },
    vehicleIconGrid: {
        fontSize: 24,
        marginBottom: 4,
    },
    vehicleIcon: {
        fontSize: 32,
        marginBottom: 4,
    },
    vehicleLabelGrid: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    vehicleLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    vehicleLabelSelected: {
        color: modernColors.primary,
    },
    // ✅ Styles pour planification
    radioGroup: {
        marginTop: 8,
        gap: 12,
    },
    radioOption: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
        gap: 12,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    radioChecked: {
        borderColor: modernColors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: modernColors.primary,
    },
    radioLabelContainer: {
        flex: 1,
    },
    radioLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    radioDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
    helperText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    // ✅ Styles pour tableau d'assurance
    insuranceTableContainer: {
        marginTop: 16,
        marginBottom: 16,
    },
    insuranceTableTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    insuranceTable: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    insuranceTableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    insuranceTableRange: {
        flex: 1,
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '500',
    },
    insuranceTableRate: {
        flex: 0.5,
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
        textAlign: 'center',
    },
    insuranceTableExample: {
        flex: 1.5,
        fontSize: 10,
        color: modernColors.textSecondary,
        textAlign: 'right',
        fontStyle: 'italic',
    },
    // ✅ Styles pour récapitulatif
    summaryCard: {
        marginBottom: 16,
        padding: 16,
    },
    summaryCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        flex: 1,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
        textAlign: 'right',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 2,
        borderTopColor: modernColors.primary,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    insufficientBalance: {
        color: '#EF4444',
    },
    warningText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 8,
        fontStyle: 'italic',
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        padding: 16,
    },
    dateTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        marginTop: 8,
    },
    dateTimeText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
});

export default DeliveryParcelFlowNew;


