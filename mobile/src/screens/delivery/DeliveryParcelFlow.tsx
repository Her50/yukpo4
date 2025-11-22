import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MediaUploadManager from '../../components/MediaUploadManager';
import ModernGPSModal from '../../components/ModernGPSModal';
import NativeDatePicker from '../../components/NativeDatePicker';
import NativeTimePicker from '../../components/NativeTimePicker';
import SafeIcon from '../../components/SafeIcon';
import { VEHICLE_TRANSPORT_OPTIONS, VEHICLE_TRANSPORT_OPTIONS_FOR_ALERT } from '../../config/deliveryConfig';
import { useLocation } from '../../contexts/LocationContext';
import { CreateDeliveryRequestPayload, deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { compressImageFromUri, type CompressionResult } from '../../utils/imageCompressionMobile';

interface DeliveryParcelFlowProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: (deliveryId: string) => void;
}

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

const DeliveryParcelFlow: React.FC<DeliveryParcelFlowProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const { location: userLocation } = useLocation();
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);

    // État informations colis
    const [parcelType, setParcelType] = useState<'document' | 'package' | 'moving' | 'cake' | 'other'>('package');
    const [transportMode, setTransportMode] = useState<string>(''); // Mode de transport souhaité
    const [showTransportModal, setShowTransportModal] = useState(false); // Modal de sélection du transport
    const [weight, setWeight] = useState<string>('');
    const [volume, setVolume] = useState<string>('');
    const [declaredValue, setDeclaredValue] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [photoCompression, setPhotoCompression] = useState<Record<number, CompressionResult>>({});
    const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});

    // État locations
    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
    const [showPickupGPS, setShowPickupGPS] = useState(false);
    const [showDropoffGPS, setShowDropoffGPS] = useState(false);

    // État déménagement
    const [isMoving, setIsMoving] = useState(false);
    const [movingBoxes, setMovingBoxes] = useState<string>('');
    const [movingFurniture, setMovingFurniture] = useState<string>('');
    const [movingAccess, setMovingAccess] = useState<string>('');

    // État gâteau
    const [isCake, setIsCake] = useState(false);
    const [cakeTemperature, setCakeTemperature] = useState<string>(''); // Ex: "Tempéré", "Froid", "Chaud"
    const [cakeFragility, setCakeFragility] = useState<string>(''); // Ex: "Fragile", "Très fragile"
    const [cakeInstructions, setCakeInstructions] = useState<string>('');

    // Préférences de livraison
    const [preferredDeliveryDate, setPreferredDeliveryDate] = useState<string>('');
    const [preferredDeliveryTimeStart, setPreferredDeliveryTimeStart] = useState<string>('');
    const [preferredDeliveryTimeEnd, setPreferredDeliveryTimeEnd] = useState<string>('');
    const [isFlexible, setIsFlexible] = useState<boolean>(true);
    const [flexibilityWindowDays, setFlexibilityWindowDays] = useState<number>(3);
    const [urgencyLevel, setUrgencyLevel] = useState<'standard' | 'urgent' | 'scheduled'>('standard');

    // Calculer la distance entre pickup et dropoff
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Calculer la distance quand les deux points sont disponibles
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

    // Validation en temps réel
    const validateField = (field: string, value: any): string => {
        switch (field) {
            case 'weight':
                if (value && parseFloat(value) <= 0) {
                    return 'Le poids doit être supérieur à 0';
                }
                if (value && parseFloat(value) > 1000) {
                    return 'Le poids ne peut pas dépasser 1000 kg';
                }
                return '';
            case 'volume':
                if (value && parseFloat(value) <= 0) {
                    return 'Le volume doit être supérieur à 0';
                }
                return '';
            case 'declaredValue':
                if (value && parseFloat(value) < 0) {
                    return 'La valeur déclarée ne peut pas être négative';
                }
                return '';
            case 'preferredDeliveryDate':
                if (value) {
                    const date = new Date(value.split('/').reverse().join('-'));
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date < today) {
                        return 'La date ne peut pas être dans le passé';
                    }
                }
                return '';
            case 'preferredDeliveryTimeStart':
                if (value && preferredDeliveryTimeEnd) {
                    const [startH, startM] = value.split(':').map(Number);
                    const [endH, endM] = preferredDeliveryTimeEnd.split(':').map(Number);
                    if (startH > endH || (startH === endH && startM >= endM)) {
                        return 'L\'heure de début doit être avant l\'heure de fin';
                    }
                }
                return '';
            default:
                return '';
        }
    };

    // Charger GPS utilisateur au montage
    useEffect(() => {
        if (visible && userLocation) {
            const coords: LocationData = {
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
                address: '', // Sera rempli par geocoding inverse si nécessaire
            };
            setDropoffLocation(coords);
        }
    }, [visible, userLocation]);

    // Réinitialiser le formulaire à la fermeture
    useEffect(() => {
        if (!visible) {
            setParcelType('package');
            setWeight('');
            setVolume('');
            setDeclaredValue('');
            setNotes('');
            setPhotos([]);
            setPickupLocation(null);
            setDropoffLocation(null);
            setIsMoving(false);
            setMovingBoxes('');
            setMovingFurniture('');
            setMovingAccess('');
            setIsCake(false);
            setCakeTemperature('');
            setCakeFragility('');
            setCakeInstructions('');
            setPreferredDeliveryDate('');
            setPreferredDeliveryTimeStart('');
            setPreferredDeliveryTimeEnd('');
            setIsFlexible(true);
            setFlexibilityWindowDays(3);
            setUrgencyLevel('standard');
            setTransportMode('');
        }
    }, [visible]);

    // Mettre à jour isMoving et isCake quand le type change
    useEffect(() => {
        setIsMoving(parcelType === 'moving');
        setIsCake(parcelType === 'cake');
    }, [parcelType]);

    const handleUseCurrentLocation = async (type: 'pickup' | 'dropoff') => {
        setLoadingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission requise',
                    'L\'accès à la localisation est nécessaire pour utiliser votre position actuelle.'
                );
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const coords: LocationData = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            // Géocodage inverse pour obtenir l'adresse
            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                });
                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    coords.address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                }
            } catch (geocodeError) {
                console.warn('Géocodage inverse échoué:', geocodeError);
            }

            if (type === 'pickup') {
                setPickupLocation(coords);
                setErrors(prev => ({ ...prev, pickup: '' }));
            } else {
                setDropoffLocation(coords);
                setErrors(prev => ({ ...prev, dropoff: '' }));
            }
        } catch (error) {
            console.error('Erreur géolocalisation:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position. Vérifiez que le GPS est activé.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleGPSSelect = (coordinates: string, type: 'pickup' | 'dropoff') => {
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        const location: LocationData = {
            latitude: lat,
            longitude: lng,
        };

        // Géocodage inverse pour obtenir l'adresse
        Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
            .then((reverseGeocode) => {
                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    location.address = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                }
                if (type === 'pickup') {
                    setPickupLocation(location);
                } else {
                    setDropoffLocation(location);
                }
            })
            .catch((error) => {
                console.warn('Géocodage inverse échoué:', error);
                if (type === 'pickup') {
                    setPickupLocation(location);
                } else {
                    setDropoffLocation(location);
                }
            });

        if (type === 'pickup') {
            setShowPickupGPS(false);
        } else {
            setShowDropoffGPS(false);
        }
    };

    const handleSubmit = async () => {
        // Validation complète
        const newErrors: Record<string, string> = {};

        if (!pickupLocation) {
            newErrors.pickup = 'Le point de collecte est requis';
        }
        if (!dropoffLocation) {
            newErrors.dropoff = 'Le point de livraison est requis';
        }

        // Validation des champs numériques
        if (weight) {
            const weightError = validateField('weight', weight);
            if (weightError) newErrors.weight = weightError;
        }
        if (volume) {
            const volumeError = validateField('volume', volume);
            if (volumeError) newErrors.volume = volumeError;
        }
        if (declaredValue) {
            const valueError = validateField('declaredValue', declaredValue);
            if (valueError) newErrors.declaredValue = valueError;
        }

        // Validation des dates/heures
        if (preferredDeliveryDate) {
            const dateError = validateField('preferredDeliveryDate', preferredDeliveryDate);
            if (dateError) newErrors.preferredDeliveryDate = dateError;
        }
        if (preferredDeliveryTimeStart && preferredDeliveryTimeEnd) {
            const timeError = validateField('preferredDeliveryTimeStart', preferredDeliveryTimeStart);
            if (timeError) newErrors.preferredDeliveryTimeStart = timeError;
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            Alert.alert(
                'Formulaire incomplet',
                'Veuillez corriger les erreurs avant de continuer.',
                [{ text: 'OK' }]
            );
            return;
        }

        setLoading(true);
        try {
            // ✅ Mapping des types de colis vers type_id backend
            // 1 = document, 2 = package, 3 = moving, 4 = cake, 5 = other (ou 2 pour autre si non défini)
            const typeIdMapping: Record<string, number> = {
                'document': 1,
                'package': 2,
                'moving': 3,
                'cake': 4, // À ajuster selon le backend
                'other': 2, // Utilise package comme fallback
            };

            // Construire les contraintes selon le type
            const constraints: Record<string, any> = {};
            if (isMoving) {
                constraints.is_moving = true;
                if (movingBoxes) constraints.boxes = movingBoxes;
                if (movingFurniture) constraints.furniture = movingFurniture;
                if (movingAccess) constraints.access = movingAccess;
            } else if (isCake) {
                constraints.is_cake = true;
                if (cakeTemperature) constraints.temperature = cakeTemperature;
                if (cakeFragility) constraints.fragility = cakeFragility;
                if (cakeInstructions) constraints.instructions = cakeInstructions;
            } else if (parcelType === 'other') {
                constraints.type = 'other';
                if (notes) constraints.description = notes;
            }

            // Construire le payload
            const payload: CreateDeliveryRequestPayload = {
                // ✅ NOUVEAU : Mode de transport souhaité
                preferred_vehicle_type: transportMode || undefined,
                parcel: {
                    type_id: typeIdMapping[parcelType] || 2,
                    weight_kg: weight ? parseFloat(weight) : undefined,
                    volume_cm3: volume ? parseFloat(volume) : undefined,
                    declared_value: declaredValue ? parseFloat(declaredValue) : undefined,
                    notes: notes || undefined,
                    // ✅ CORRIGÉ : Toujours envoyer un tableau (même vide) pour photos
                    photos: photos.length > 0 ? photos : [],
                    // ✅ Contraintes selon le type de colis
                    constraints: Object.keys(constraints).length > 0 ? constraints : {},
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
                metadata: {
                    kind: 'parcel',
                    parcel_type: parcelType,
                    is_moving: isMoving,
                    is_cake: isCake,
                    preferred_delivery_date: preferredDeliveryDate
                        ? preferredDeliveryDate.split('/').reverse().join('-')
                        : undefined,
                    preferred_delivery_time_start: preferredDeliveryTimeStart || undefined,
                    preferred_delivery_time_end: preferredDeliveryTimeEnd || undefined,
                    is_flexible: isFlexible,
                    flexibility_window_days: flexibilityWindowDays,
                    urgency_level: urgencyLevel,
                    // ✅ NOUVEAU : Mode de transport dans metadata aussi
                    preferred_vehicle_type: transportMode || undefined,
                },
                // ✅ CORRIGÉ : Ajouter initial_event_payload par défaut
                initial_event_payload: {},
            };

            const result = await deliveryApi.createDeliveryRequest(payload);

            if (result.success && result.data?.id) {
                Alert.alert(
                    'Livraison créée',
                    'Votre demande de livraison a été créée avec succès. Le matching des coursiers est en cours.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (onSuccess) {
                                    // ✅ CORRIGÉ : result.data.id est maintenant correctement extrait
                                    onSuccess(result.data.id);
                                }
                                onClose();
                            },
                        },
                    ]
                );
            } else {
                const errorMessage = (result as any).error || (result as any).message || 'Impossible de créer la livraison';
                Alert.alert('Erreur', errorMessage);
            }
        } catch (error: any) {
            console.error('Erreur création livraison:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de la création de la livraison');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <LinearGradient
                        colors={['#3B82F6', '#2563EB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <SafeIcon name="package" size={24} color="#FFFFFF" />
                            <View style={styles.headerText}>
                                <Text style={styles.headerTitle}>Livraison de colis</Text>
                                <Text style={styles.headerSubtitle}>Expédiez un colis ou un document</Text>
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

                    {/* Content */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Type de colis */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="package" size={18} color={modernColors.primary} />
                                <Text style={styles.sectionTitle}>Type de colis *</Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelectorScroll}>
                                <View style={styles.typeSelector}>
                                    {([
                                        { key: 'document', label: 'Document', icon: 'file-text' },
                                        { key: 'package', label: 'Paquet', icon: 'package' },
                                        { key: 'moving', label: 'Déménagement', icon: 'truck' },
                                        { key: 'cake', label: 'Gâteau', icon: 'gift' },
                                        { key: 'other', label: 'Autres', icon: 'box' },
                                    ] as const).map(({ key, label, icon }) => (
                                        <TouchableOpacity
                                            key={key}
                                            style={[
                                                styles.typeButton,
                                                parcelType === key && styles.typeButtonActive,
                                            ]}
                                            onPress={() => setParcelType(key as any)}
                                        >
                                            <SafeIcon
                                                name={icon}
                                                size={18}
                                                color={parcelType === key ? '#FFFFFF' : modernColors.primary}
                                            />
                                            <Text
                                                style={[
                                                    styles.typeButtonText,
                                                    parcelType === key && styles.typeButtonTextActive,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        {/* Informations colis - Conditionnel selon le type */}
                        {parcelType !== 'other' && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <SafeIcon name="info" size={18} color={modernColors.accent} />
                                    <Text style={styles.sectionTitle}>Informations du colis</Text>
                                </View>
                                {/* Poids et volume uniquement pour document, paquet et gâteau */}
                                {(parcelType === 'document' || parcelType === 'package' || parcelType === 'cake') && (
                                    <View style={styles.formGrid}>
                                        <View style={styles.formItem}>
                                            <Text style={styles.label}>Poids (kg)</Text>
                                            <TextInput
                                                style={[styles.input, errors.weight && styles.inputError]}
                                                placeholder="Ex: 2.5"
                                                value={weight}
                                                onChangeText={(text) => {
                                                    setWeight(text);
                                                    const error = validateField('weight', text);
                                                    setErrors(prev => ({ ...prev, weight: error }));
                                                }}
                                                keyboardType="decimal-pad"
                                            />
                                            {errors.weight ? (
                                                <Text style={styles.errorText}>{errors.weight}</Text>
                                            ) : null}
                                        </View>
                                        <View style={styles.formItem}>
                                            <Text style={styles.label}>Volume (cm³)</Text>
                                            <TextInput
                                                style={[styles.input, errors.volume && styles.inputError]}
                                                placeholder="Ex: 5000"
                                                value={volume}
                                                onChangeText={(text) => {
                                                    setVolume(text);
                                                    const error = validateField('volume', text);
                                                    setErrors(prev => ({ ...prev, volume: error }));
                                                }}
                                                keyboardType="numeric"
                                            />
                                            {errors.volume ? (
                                                <Text style={styles.errorText}>{errors.volume}</Text>
                                            ) : null}
                                        </View>
                                    </View>
                                )}
                                {/* Valeur déclarée pour tous sauf autres */}
                                {parcelType !== 'moving' && (
                                    <View style={styles.formItem}>
                                        <Text style={styles.label}>Valeur déclarée (FCFA)</Text>
                                        <TextInput
                                            style={[styles.input, errors.declaredValue && styles.inputError]}
                                            placeholder="Ex: 50000"
                                            value={declaredValue}
                                            onChangeText={(text) => {
                                                setDeclaredValue(text);
                                                const error = validateField('declaredValue', text);
                                                setErrors(prev => ({ ...prev, declaredValue: error }));
                                            }}
                                            keyboardType="numeric"
                                        />
                                        {errors.declaredValue ? (
                                            <Text style={styles.errorText}>{errors.declaredValue}</Text>
                                        ) : null}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Formulaire générique pour type "Autres" */}
                        {parcelType === 'other' && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <SafeIcon name="info" size={18} color={modernColors.accent} />
                                    <Text style={styles.sectionTitle}>Description du colis</Text>
                                </View>
                                <View style={styles.formItem}>
                                    <Text style={styles.label}>Description *</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        placeholder="Décrivez votre colis (nature, taille approximative, poids, etc.)"
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                    />
                                </View>
                                <View style={styles.formGrid}>
                                    <View style={styles.formItem}>
                                        <Text style={styles.label}>Poids estimé (kg)</Text>
                                        <TextInput
                                            style={[styles.input, errors.weight && styles.inputError]}
                                            placeholder="Ex: 5"
                                            value={weight}
                                            onChangeText={(text) => {
                                                setWeight(text);
                                                const error = validateField('weight', text);
                                                setErrors(prev => ({ ...prev, weight: error }));
                                            }}
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                    <View style={styles.formItem}>
                                        <Text style={styles.label}>Valeur estimée (FCFA)</Text>
                                        <TextInput
                                            style={[styles.input, errors.declaredValue && styles.inputError]}
                                            placeholder="Ex: 30000"
                                            value={declaredValue}
                                            onChangeText={(text) => {
                                                setDeclaredValue(text);
                                                const error = validateField('declaredValue', text);
                                                setErrors(prev => ({ ...prev, declaredValue: error }));
                                            }}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Mode de transport souhaité */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="truck" size={18} color={modernColors.accent} />
                                <Text style={styles.sectionTitle}>Mode de transport souhaité (optionnel)</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => {
                                    // ✅ NOUVEAU : Utiliser un modal personnalisé pour afficher toutes les options
                                    setShowTransportModal(true);
                                }}
                            >
                                <Text style={styles.pickerText}>
                                    {transportMode
                                        ? VEHICLE_TRANSPORT_OPTIONS_FOR_ALERT.find(opt => opt.value === transportMode)?.label || 'Sélectionner...'
                                        : 'Aucune préférence'}
                                </Text>
                                <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Photos du colis - Version compacte */}
                        <View style={[styles.section, styles.sectionCompact]}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="camera" size={16} color={modernColors.accent} />
                                <Text style={[styles.sectionTitle, styles.sectionTitleCompact]}>Photos du colis (optionnel)</Text>
                                <Text style={styles.sectionSubtitleCompact}>{photos.length}/5</Text>
                            </View>
                            <View style={styles.mediaUploadWrapper}>
                                <MediaUploadManager
                                    images={photos}
                                    videos={[]}
                                    onImagesChange={async (images) => {
                                        const imageUris = images.map((img: any) => img.uri || img.base64 || img);

                                        // Compresser les nouvelles images avec progression
                                        const newPhotos: string[] = [];
                                        const newCompression: Record<number, CompressionResult> = {};
                                        const newProgress: Record<number, number> = {};

                                        for (let i = 0; i < imageUris.length; i++) {
                                            const uri = imageUris[i];
                                            const photoIndex = photos.length + i;

                                            try {
                                                newProgress[photoIndex] = 10;
                                                setUploadProgress(prev => ({ ...prev, ...newProgress }));

                                                newProgress[photoIndex] = 50;
                                                setUploadProgress(prev => ({ ...prev, ...newProgress }));

                                                const compressionResult = await compressImageFromUri(uri);
                                                newPhotos.push(compressionResult.compressedBase64);
                                                newCompression[photoIndex] = compressionResult;

                                                newProgress[photoIndex] = 100;
                                                setUploadProgress(prev => ({ ...prev, ...newProgress }));
                                            } catch (error) {
                                                console.error(`Erreur compression photo ${i}:`, error);
                                                // Ajouter l'original en cas d'erreur
                                                newPhotos.push(uri);
                                                newProgress[photoIndex] = 100;
                                                setUploadProgress(prev => ({ ...prev, ...newProgress }));
                                            }
                                        }

                                        setPhotos([...photos, ...newPhotos]);
                                        setPhotoCompression(prev => ({ ...prev, ...newCompression }));
                                    }}
                                    onVideosChange={() => { }} // Pas de vidéos pour les colis
                                    maxImages={5}
                                />
                            </View>
                        </View>

                        {/* Gâteau - Champs spécifiques */}
                        {isCake && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <SafeIcon name="gift" size={18} color={modernColors.warning} />
                                    <Text style={styles.sectionTitle}>Détails du gâteau</Text>
                                </View>
                                <View style={styles.formGrid}>
                                    <View style={styles.formItem}>
                                        <Text style={styles.label}>Température</Text>
                                        <TouchableOpacity
                                            style={styles.pickerButton}
                                            onPress={() => {
                                                Alert.alert(
                                                    'Température',
                                                    'Quelle température requise pour le gâteau ?',
                                                    [
                                                        { text: 'Tempéré', onPress: () => setCakeTemperature('tempéré') },
                                                        { text: 'Froid', onPress: () => setCakeTemperature('froid') },
                                                        { text: 'Chaud', onPress: () => setCakeTemperature('chaud') },
                                                        { text: 'Annuler', style: 'cancel' },
                                                    ]
                                                );
                                            }}
                                        >
                                            <Text style={styles.pickerText}>
                                                {cakeTemperature || 'Sélectionner...'}
                                            </Text>
                                            <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.formItem}>
                                        <Text style={styles.label}>Niveau de fragilité</Text>
                                        <TouchableOpacity
                                            style={styles.pickerButton}
                                            onPress={() => {
                                                Alert.alert(
                                                    'Fragilité',
                                                    'Quel est le niveau de fragilité ?',
                                                    [
                                                        { text: 'Standard', onPress: () => setCakeFragility('standard') },
                                                        { text: 'Fragile', onPress: () => setCakeFragility('fragile') },
                                                        { text: 'Très fragile', onPress: () => setCakeFragility('très fragile') },
                                                        { text: 'Annuler', style: 'cancel' },
                                                    ]
                                                );
                                            }}
                                        >
                                            <Text style={styles.pickerText}>
                                                {cakeFragility || 'Sélectionner...'}
                                            </Text>
                                            <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={styles.formItem}>
                                    <Text style={styles.label}>Instructions spéciales (optionnel)</Text>
                                    <TextInput
                                        style={[styles.input, styles.textAreaCompact]}
                                        placeholder="Ex: Manipuler avec précaution, maintenir droit..."
                                        value={cakeInstructions}
                                        onChangeText={setCakeInstructions}
                                        multiline
                                        numberOfLines={2}
                                        textAlignVertical="top"
                                    />
                                </View>
                            </View>
                        )}

                        {/* Déménagement - Champs supplémentaires */}
                        {isMoving && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <SafeIcon name="truck" size={18} color={modernColors.warning} />
                                    <Text style={styles.sectionTitle}>Détails déménagement</Text>
                                </View>
                                <View style={styles.formItem}>
                                    <Text style={styles.label}>Nombre de cartons</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: 10"
                                        value={movingBoxes}
                                        onChangeText={setMovingBoxes}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.formItem}>
                                    <Text style={styles.label}>Meubles à transporter</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: Canapé, Table, Armoire"
                                        value={movingFurniture}
                                        onChangeText={setMovingFurniture}
                                        multiline
                                    />
                                </View>
                                <View style={styles.formItem}>
                                    <Text style={styles.label}>Accès (étage, ascenseur, etc.)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: 3ème étage, ascenseur disponible"
                                        value={movingAccess}
                                        onChangeText={setMovingAccess}
                                        multiline
                                    />
                                </View>
                            </View>
                        )}

                        {/* Point de collecte */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="map-pin" size={18} color={modernColors.success} />
                                <Text style={styles.sectionTitle}>Point de collecte *</Text>
                            </View>
                            {pickupLocation ? (
                                <View style={[styles.locationCard, errors.pickup && styles.locationCardError]}>
                                    <Text style={styles.locationText}>
                                        {pickupLocation.address ||
                                            `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.modifyButton}
                                        onPress={() => {
                                            setPickupLocation(null);
                                            setErrors(prev => ({ ...prev, pickup: '' }));
                                        }}
                                    >
                                        <Text style={styles.modifyButtonText}>Modifier</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.locationActions}>
                                    <TouchableOpacity
                                        style={[styles.locationButton, loadingLocation && styles.locationButtonDisabled]}
                                        onPress={() => handleUseCurrentLocation('pickup')}
                                        disabled={loadingLocation}
                                    >
                                        {loadingLocation ? (
                                            <ActivityIndicator size="small" color={modernColors.primary} />
                                        ) : (
                                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                                        )}
                                        <Text style={styles.locationButtonText}>
                                            {loadingLocation ? 'Localisation...' : 'Utiliser ma position actuelle'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.locationButton}
                                        onPress={() => setShowPickupGPS(true)}
                                    >
                                        <SafeIcon name="map" size={20} color={modernColors.primary} />
                                        <Text style={styles.locationButtonText}>
                                            Sélectionner sur la carte
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {errors.pickup ? (
                                <Text style={styles.errorText}>{errors.pickup}</Text>
                            ) : null}
                        </View>

                        {/* Point de livraison */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="map-pin" size={18} color={modernColors.primary} />
                                <Text style={styles.sectionTitle}>Point de livraison *</Text>
                            </View>
                            {dropoffLocation ? (
                                <View style={[styles.locationCard, errors.dropoff && styles.locationCardError]}>
                                    <Text style={styles.locationText}>
                                        {dropoffLocation.address ||
                                            `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}`}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.modifyButton}
                                        onPress={() => {
                                            setDropoffLocation(null);
                                            setErrors(prev => ({ ...prev, dropoff: '' }));
                                        }}
                                    >
                                        <Text style={styles.modifyButtonText}>Modifier</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.locationActions}>
                                    <TouchableOpacity
                                        style={[styles.locationButton, loadingLocation && styles.locationButtonDisabled]}
                                        onPress={() => handleUseCurrentLocation('dropoff')}
                                        disabled={loadingLocation}
                                    >
                                        {loadingLocation ? (
                                            <ActivityIndicator size="small" color={modernColors.primary} />
                                        ) : (
                                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                                        )}
                                        <Text style={styles.locationButtonText}>
                                            {loadingLocation ? 'Localisation...' : 'Utiliser ma position actuelle'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.locationButton}
                                        onPress={() => setShowDropoffGPS(true)}
                                    >
                                        <SafeIcon name="map" size={20} color={modernColors.primary} />
                                        <Text style={styles.locationButtonText}>
                                            Sélectionner sur la carte
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {errors.dropoff ? (
                                <Text style={styles.errorText}>{errors.dropoff}</Text>
                            ) : null}
                            {estimatedDistance !== null && pickupLocation && dropoffLocation && (
                                <View style={styles.distanceInfo}>
                                    <SafeIcon name="navigation" size={16} color={modernColors.accent} />
                                    <Text style={styles.distanceText}>
                                        Distance estimée : {estimatedDistance.toFixed(1)} km
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Notes */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Instructions de livraison (optionnel)</Text>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Ex: Sonner deux fois, laisser devant la porte..."
                                style={styles.notesInput}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Préférences de livraison */}
                        <View style={[styles.section, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 24 }]}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="clock" size={18} color={modernColors.accent} />
                                <Text style={styles.sectionTitle}>Préférences de livraison (optionnel)</Text>
                            </View>

                            <View style={styles.preferencesGrid}>
                                <View style={styles.preferenceItem}>
                                    <NativeDatePicker
                                        label="Date de livraison"
                                        value={preferredDeliveryDate}
                                        onChange={(date) => {
                                            setPreferredDeliveryDate(date);
                                            const error = validateField('preferredDeliveryDate', date);
                                            setErrors(prev => ({ ...prev, preferredDeliveryDate: error }));
                                        }}
                                        placeholder="Sélectionner une date"
                                        minimumDate={new Date()}
                                    />
                                    {errors.preferredDeliveryDate ? (
                                        <Text style={styles.errorText}>{errors.preferredDeliveryDate}</Text>
                                    ) : null}
                                </View>

                                <View style={styles.preferenceItem}>
                                    <Text style={styles.preferenceLabel}>Niveau d'urgence</Text>
                                    <TouchableOpacity
                                        style={styles.pickerButton}
                                        onPress={() => {
                                            Alert.alert(
                                                'Niveau d\'urgence',
                                                'Choisissez le niveau d\'urgence',
                                                [
                                                    { text: 'Standard', onPress: () => setUrgencyLevel('standard') },
                                                    { text: 'Urgent', onPress: () => setUrgencyLevel('urgent') },
                                                    { text: 'Programmé', onPress: () => setUrgencyLevel('scheduled') },
                                                ]
                                            );
                                        }}
                                    >
                                        <Text style={styles.pickerText}>
                                            {urgencyLevel === 'standard'
                                                ? 'Standard'
                                                : urgencyLevel === 'urgent'
                                                    ? 'Urgent'
                                                    : 'Programmé'}
                                        </Text>
                                        <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {preferredDeliveryDate && (
                                <View style={styles.preferencesGrid}>
                                    <View style={styles.preferenceItem}>
                                        <NativeTimePicker
                                            label="Heure de début"
                                            value={preferredDeliveryTimeStart}
                                            onChange={(time) => {
                                                setPreferredDeliveryTimeStart(time);
                                                const error = validateField('preferredDeliveryTimeStart', time);
                                                setErrors(prev => ({ ...prev, preferredDeliveryTimeStart: error }));
                                            }}
                                            placeholder="Sélectionner l'heure"
                                        />
                                        {errors.preferredDeliveryTimeStart ? (
                                            <Text style={styles.errorText}>{errors.preferredDeliveryTimeStart}</Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.preferenceItem}>
                                        <NativeTimePicker
                                            label="Heure de fin"
                                            value={preferredDeliveryTimeEnd}
                                            onChange={(time) => {
                                                setPreferredDeliveryTimeEnd(time);
                                                const error = validateField('preferredDeliveryTimeStart', preferredDeliveryTimeStart);
                                                setErrors(prev => ({ ...prev, preferredDeliveryTimeStart: error }));
                                            }}
                                            placeholder="Sélectionner l'heure"
                                        />
                                    </View>
                                </View>
                            )}

                            <View style={styles.flexibilitySection}>
                                <TouchableOpacity
                                    style={styles.checkboxRow}
                                    onPress={() => setIsFlexible(!isFlexible)}
                                >
                                    <View style={[styles.checkbox, isFlexible && styles.checkboxChecked]}>
                                        {isFlexible && <SafeIcon name="check" size={14} color="#FFFFFF" />}
                                    </View>
                                    <Text style={styles.checkboxLabel}>
                                        Accepter d'autres créneaux si indisponible
                                    </Text>
                                </TouchableOpacity>

                                {isFlexible && (
                                    <View style={styles.flexibilityInput}>
                                        <Text style={styles.preferenceLabel}>Fenêtre de flexibilité (jours)</Text>
                                        <TextInput
                                            style={styles.preferenceInput}
                                            keyboardType="numeric"
                                            value={flexibilityWindowDays.toString()}
                                            onChangeText={(text) => setFlexibilityWindowDays(parseInt(text) || 3)}
                                        />
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onClose}
                            disabled={loading}
                        >
                            <Text style={styles.cancelButtonText}>Annuler</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.submitButton,
                                (!pickupLocation || !dropoffLocation || loading) && styles.submitButtonDisabled,
                            ]}
                            onPress={handleSubmit}
                            disabled={loading || !pickupLocation || !dropoffLocation}
                        >
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Création...' : 'Créer la livraison'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modals GPS */}
            <ModernGPSModal
                visible={showPickupGPS}
                onClose={() => setShowPickupGPS(false)}
                onSelect={(coords) => handleGPSSelect(coords, 'pickup')}
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
                onSelect={(coords) => handleGPSSelect(coords, 'dropoff')}
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

            {/* ✅ NOUVEAU : Modal de sélection du mode de transport avec toutes les options */}
            <Modal
                visible={showTransportModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTransportModal(false)}
            >
                <View style={styles.transportModalOverlay}>
                    <View style={styles.transportModalContent}>
                        <View style={styles.transportModalHeader}>
                            <Text style={styles.transportModalTitle}>Mode de transport</Text>
                            <TouchableOpacity
                                onPress={() => setShowTransportModal(false)}
                                style={styles.transportModalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.transportModalSubtitle}>
                            Choisissez le mode de transport souhaité pour cette livraison
                        </Text>
                        <ScrollView style={styles.transportModalScroll} showsVerticalScrollIndicator={true}>
                            {VEHICLE_TRANSPORT_OPTIONS.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[
                                        styles.transportOption,
                                        transportMode === option.value && styles.transportOptionSelected,
                                    ]}
                                    onPress={() => {
                                        setTransportMode(option.value);
                                        setShowTransportModal(false);
                                    }}
                                >
                                    <Text style={styles.transportOptionIcon}>{option.icon}</Text>
                                    <Text
                                        style={[
                                            styles.transportOptionLabel,
                                            transportMode === option.value && styles.transportOptionLabelSelected,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    {transportMode === option.value && (
                                        <SafeIcon name="check" size={20} color={modernColors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[
                                    styles.transportOption,
                                    transportMode === '' && styles.transportOptionSelected,
                                ]}
                                onPress={() => {
                                    setTransportMode('');
                                    setShowTransportModal(false);
                                }}
                            >
                                <Text style={styles.transportOptionIcon}>🚫</Text>
                                <Text
                                    style={[
                                        styles.transportOptionLabel,
                                        transportMode === '' && styles.transportOptionLabelSelected,
                                    ]}
                                >
                                    Aucune préférence
                                </Text>
                                {transportMode === '' && (
                                    <SafeIcon name="check" size={20} color={modernColors.primary} />
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 12,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    typeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.primary,
    },
    typeButtonTextActive: {
        color: '#FFFFFF',
    },
    formGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    formItem: {
        flex: 1,
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 8,
    },
    input: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 14,
        color: modernColors.text,
    },
    locationCard: {
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 8,
    },
    modifyButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    modifyButtonText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '500',
    },
    locationActions: {
        gap: 12,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    locationButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: modernColors.primary,
    },
    notesInput: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 80,
    },
    preferencesGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    preferenceItem: {
        flex: 1,
    },
    preferenceLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 8,
    },
    preferenceInput: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 14,
        color: modernColors.text,
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
    },
    pickerText: {
        fontSize: 14,
        color: modernColors.text,
    },
    flexibilitySection: {
        marginTop: 8,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    flexibilityInput: {
        marginLeft: 32,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    submitButton: {
        backgroundColor: modernColors.primary,
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    inputError: {
        borderColor: modernColors.error,
        borderWidth: 2,
    },
    errorText: {
        fontSize: 12,
        color: modernColors.error,
        marginTop: 4,
        marginLeft: 4,
    },
    locationCardError: {
        borderColor: modernColors.error,
        borderWidth: 2,
    },
    locationButtonDisabled: {
        opacity: 0.6,
    },
    distanceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    typeSelectorScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    sectionCompact: {
        marginBottom: 16,
    },
    sectionTitleCompact: {
        fontSize: 15,
        flex: 1,
    },
    sectionSubtitleCompact: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontWeight: '500',
        marginLeft: 'auto',
    },
    mediaUploadWrapper: {
        // Réduction de l'espace pour MediaUploadManager
        transform: [{ scale: 0.95 }],
        marginHorizontal: -4,
    },
    // ✅ NOUVEAU : Styles pour le modal de sélection du transport
    transportModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    transportModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    transportModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    transportModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    transportModalCloseButton: {
        padding: 4,
    },
    transportModalSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
    },
    transportModalScroll: {
        maxHeight: 400,
    },
    transportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 20,
        marginVertical: 4,
        borderRadius: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    transportOptionSelected: {
        backgroundColor: '#EFF6FF',
        borderColor: modernColors.primary,
    },
    transportOptionIcon: {
        fontSize: 28,
        marginRight: 12,
    },
    transportOptionLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: modernColors.text,
    },
    transportOptionLabelSelected: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    textArea: {
        minHeight: 100,
        paddingVertical: 12,
    },
    textAreaCompact: {
        minHeight: 70,
        paddingVertical: 10,
    },
});

export default DeliveryParcelFlow;

