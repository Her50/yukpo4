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
    const [parcelType, setParcelType] = useState<'document' | 'package' | 'moving'>('package');
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
            setPreferredDeliveryDate('');
            setPreferredDeliveryTimeStart('');
            setPreferredDeliveryTimeEnd('');
            setIsFlexible(true);
            setFlexibilityWindowDays(3);
            setUrgencyLevel('standard');
        }
    }, [visible]);

    // Mettre à jour isMoving quand le type change
    useEffect(() => {
        setIsMoving(parcelType === 'moving');
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
            // Construire le payload
            const payload: CreateDeliveryRequestPayload = {
                parcel: {
                    type_id: parcelType === 'document' ? 1 : parcelType === 'package' ? 2 : 3,
                    weight_kg: weight ? parseFloat(weight) : undefined,
                    volume_cm3: volume ? parseFloat(volume) : undefined,
                    declared_value: declaredValue ? parseFloat(declaredValue) : undefined,
                    notes: notes || undefined,
                    // ✅ CORRIGÉ : Toujours envoyer un tableau (même vide) pour photos
                    photos: photos.length > 0 ? photos : [],
                    // ✅ CORRIGÉ : Toujours envoyer un objet (même vide) pour constraints
                    constraints: isMoving ? {
                        is_moving: true,
                        boxes: movingBoxes || undefined,
                        furniture: movingFurniture || undefined,
                        access: movingAccess || undefined,
                    } : {},
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
                    is_moving: isMoving,
                    preferred_delivery_date: preferredDeliveryDate
                        ? preferredDeliveryDate.split('/').reverse().join('-')
                        : undefined,
                    preferred_delivery_time_start: preferredDeliveryTimeStart || undefined,
                    preferred_delivery_time_end: preferredDeliveryTimeEnd || undefined,
                    is_flexible: isFlexible,
                    flexibility_window_days: flexibilityWindowDays,
                    urgency_level: urgencyLevel,
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
                Alert.alert('Erreur', result.error || 'Impossible de créer la livraison');
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
                            <View style={styles.typeSelector}>
                                {(['document', 'package', 'moving'] as const).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[
                                            styles.typeButton,
                                            parcelType === type && styles.typeButtonActive,
                                        ]}
                                        onPress={() => setParcelType(type)}
                                    >
                                        <SafeIcon
                                            name={
                                                type === 'document'
                                                    ? 'file-text'
                                                    : type === 'package'
                                                        ? 'package'
                                                        : 'truck'
                                            }
                                            size={20}
                                            color={parcelType === type ? '#FFFFFF' : modernColors.primary}
                                        />
                                        <Text
                                            style={[
                                                styles.typeButtonText,
                                                parcelType === type && styles.typeButtonTextActive,
                                            ]}
                                        >
                                            {type === 'document'
                                                ? 'Document'
                                                : type === 'package'
                                                    ? 'Paquet'
                                                    : 'Déménagement'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Informations colis */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="info" size={18} color={modernColors.accent} />
                                <Text style={styles.sectionTitle}>Informations du colis</Text>
                            </View>
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
                        </View>

                        {/* Photos du colis */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Photos du colis (optionnel)</Text>
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
                                maxImages={5}
                            />
                            {/* Afficher les stats de compression */}
                            {Object.keys(photoCompression).length > 0 && (
                                <View style={{ marginTop: 8, padding: 8, backgroundColor: modernColors.success + '20', borderRadius: 8 }}>
                                    {Object.entries(photoCompression).map(([index, result]) => {
                                        if (result.compressionRatio > 10) {
                                            return (
                                                <Text key={index} style={{ fontSize: 12, color: modernColors.success }}>
                                                    Photo {parseInt(index) + 1}: {result.compressionRatio.toFixed(1)}% de réduction
                                                </Text>
                                            );
                                        }
                                        return null;
                                    })}
                                </View>
                            )}
                        </View>

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
});

export default DeliveryParcelFlow;

