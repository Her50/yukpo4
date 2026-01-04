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
import HapticTouchable from '../../components/delivery/HapticTouchable';
import StepWizardForm from '../../components/delivery/StepWizardForm';
import MediaUploadManager from '../../components/MediaUploadManager';
import ModernGPSModal from '../../components/ModernGPSModal';
import { SavedAddressSelector } from '../../components/delivery/SavedAddressSelector';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { CreateDeliveryRequestPayload, deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useScreenEnter } from '../../utils/animations';
import { LocationObject } from '../../components/LocationSelector';
import { UserSavedAddress } from '../../hooks/useSavedAddresses';
import { VEHICLE_TRANSPORT_OPTIONS } from '../../config/deliveryConfig';

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
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // États
    const [parcelType, setParcelType] = useState<'document' | 'package' | 'moving' | 'cake'>('package');
    // ✅ Par défaut: "motorcycle" sera utilisé par le backend si vide
    const [transportMode, setTransportMode] = useState<string>('');
    const [weight, setWeight] = useState<string>('');
    const [volume, setVolume] = useState<string>('');
    const [declaredValue, setDeclaredValue] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    
    // États pour formulaire adaptatif
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

    const handleComplete = async (data: any) => {
        console.log('[DeliveryParcelFlowNew] handleComplete appelé avec data:', data);
        console.log('[DeliveryParcelFlowNew] États actuels:', {
            pickupLocation: !!pickupLocation,
            dropoffLocation: !!dropoffLocation,
            recipientName: !!recipientName,
            recipientPhone: !!recipientPhone,
            recipientConsentGranted,
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

        console.log('[DeliveryParcelFlowNew] ✅ Validation passée, création de la livraison...');

        // ✅ Validation aller-retour
        if (isRoundTrip && (!returnPickupLocation || !returnDropoffLocation)) {
            Alert.alert('Erreur', 'Veuillez sélectionner les points de collecte et de livraison pour le retour');
            return;
        }

        setLoading(true);
        try {
            // ✅ Par défaut: "motorcycle" si aucun type spécifié (sera géré par le backend)
        const payload: CreateDeliveryRequestPayload = {
                preferred_vehicle_type: transportMode || undefined, // Backend utilisera "motorcycle" par défaut
                is_round_trip: isRoundTrip || undefined,
                // ✅ Planification
                scheduled_delivery_at: isScheduled
                    ? scheduledDateTime.toISOString()
                    : undefined,
                matching_mode: isScheduled ? matchingMode : undefined,
                ...(isRoundTrip && returnPickupLocation && returnDropoffLocation && {
                    return_pickup: {
                        latitude: returnPickupLocation.latitude,
                        longitude: returnPickupLocation.longitude,
                        address: returnPickupLocation.address,
                    },
                    return_dropoff: {
                        latitude: returnDropoffLocation.latitude,
                        longitude: returnDropoffLocation.longitude,
                        address: returnDropoffLocation.address,
                    },
                    round_trip_discount_percent: 10, // 10% de réduction par défaut pour aller-retour
                }),
                parcel: {
                    type_id: getParcelTypeId(parcelType),
                    notes: notes || `Colis: ${parcelType}`,
                    photos: photos,
                    constraints: {
                        weight: weight ? parseFloat(weight) : undefined,
                        volume: volume ? parseFloat(volume) : undefined,
                        declared_value: declaredValue ? parseFloat(declaredValue) : undefined,
                        // Champs spécifiques selon le type
                        ...(parcelType === 'document' && {
                            number_of_pages: numberOfPages ? parseInt(numberOfPages) : undefined,
                        }),
                        ...(parcelType === 'moving' && {
                            number_of_boxes: numberOfBoxes ? parseInt(numberOfBoxes) : undefined,
                            furniture: movingFurniture || undefined,
                            access: movingAccess || undefined,
                        }),
                        ...(parcelType === 'cake' && {
                            cake_size: cakeSize || undefined,
                            cake_layers: cakeLayers ? parseInt(cakeLayers) : undefined,
                        }),
                    },
                },
                pickup: {
                    latitude: pickupLocation.latitude,
                    longitude: pickupLocation.longitude,
                    address: pickupLocation.address,
                },
                dropoff: {
                    latitude: dropoffLocation.latitude,
                    longitude: dropoffLocation.longitude,
                    address: dropoffLocation.address,
                },
                recipient: {
                    contact_name: recipientName,
                    contact_phone: recipientPhone,
                    country_code: recipientCountryCode || undefined,
                    consent_granted: recipientConsentGranted,
                    notes: recipientInstructions || undefined,
                    allow_tracking: recipientAllowTracking || undefined,
                },
                metadata: {
                    kind: 'parcel',
                    parcel_type: parcelType,
                },
                initial_event_payload: {},
            };

            const result = await deliveryApi.createDeliveryRequest(payload);

            if (result.success && result.data?.id) {
                Alert.alert(
                    'Livraison créée',
                    'Votre demande de livraison a été créée avec succès.',
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
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Informations du colis</Text>
            <Text style={styles.stepSubtitle}>Décrivez votre colis pour une meilleure estimation</Text>

            <View style={styles.typeSelector}>
                <Text style={styles.label}>Type de colis</Text>
                <View style={styles.typeButtonsGrid}>
                    {[
                        { id: 'document', label: 'Document', icon: 'file-text' },
                        { id: 'package', label: 'Colis', icon: 'package' },
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

            {/* Formulaire adaptatif selon le type de colis */}
            {parcelType === 'document' && (
                <>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre de pages (optionnel)</Text>
                        <NativeInput
                            placeholder="Ex: 10"
                            value={numberOfPages}
                            onChangeText={setNumberOfPages}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Valeur déclarée (FCFA)</Text>
                        <NativeInput
                            placeholder="Ex: 5000"
                            value={declaredValue}
                            onChangeText={setDeclaredValue}
                            keyboardType="numeric"
                        />
                    </View>
                </>
            )}

            {parcelType === 'package' && (
                <>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Poids (kg)</Text>
                        <NativeInput
                            placeholder="Ex: 2.5"
                            value={weight}
                            onChangeText={setWeight}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Volume (L)</Text>
                        <NativeInput
                            placeholder="Ex: 10"
                            value={volume}
                            onChangeText={setVolume}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Valeur déclarée (FCFA)</Text>
                        <NativeInput
                            placeholder="Ex: 50000"
                            value={declaredValue}
                            onChangeText={setDeclaredValue}
                            keyboardType="numeric"
                        />
                    </View>
                </>
            )}

            {parcelType === 'moving' && (
                <>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre de cartons</Text>
                        <NativeInput
                            placeholder="Ex: 20"
                            value={numberOfBoxes}
                            onChangeText={setNumberOfBoxes}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Meubles à transporter (optionnel)</Text>
                        <NativeInput
                            placeholder="Ex: Canapé, Table, Armoire"
                            value={movingFurniture}
                            onChangeText={setMovingFurniture}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Accès (étage, ascenseur, etc.)</Text>
                        <NativeInput
                            placeholder="Ex: 3ème étage, ascenseur disponible"
                            value={movingAccess}
                            onChangeText={setMovingAccess}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Volume estimé (m³)</Text>
                        <NativeInput
                            placeholder="Ex: 20"
                            value={volume}
                            onChangeText={setVolume}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Valeur déclarée (FCFA)</Text>
                        <NativeInput
                            placeholder="Ex: 500000"
                            value={declaredValue}
                            onChangeText={setDeclaredValue}
                            keyboardType="numeric"
                        />
                    </View>
                </>
            )}

            {parcelType === 'cake' && (
                <>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Taille du gâteau</Text>
                        <NativeInput
                            placeholder="Ex: 20cm, 30cm"
                            value={cakeSize}
                            onChangeText={setCakeSize}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre d'étages</Text>
                        <NativeInput
                            placeholder="Ex: 2"
                            value={cakeLayers}
                            onChangeText={setCakeLayers}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Poids (kg)</Text>
                        <NativeInput
                            placeholder="Ex: 2"
                            value={weight}
                            onChangeText={setWeight}
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Valeur déclarée (FCFA)</Text>
                        <NativeInput
                            placeholder="Ex: 30000"
                            value={declaredValue}
                            onChangeText={setDeclaredValue}
                            keyboardType="numeric"
                        />
                    </View>
                </>
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
        </ScrollView>
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

    const steps = [
        {
            id: 'parcel',
            label: 'Colis',
            icon: 'package',
            component: ParcelInfoStep,
            validation: () => !!parcelType,
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
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
    },
    typeButtonGrid: {
        width: '48%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 8,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: modernColors.border,
        minHeight: 55,
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
        fontSize: 11,
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


