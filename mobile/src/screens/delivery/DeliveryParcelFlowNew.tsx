/**
 * 📦 NOUVEAU: Flux de livraison de colis amélioré avec progress bar
 * Design moderne niveau Uber Eats / DoorDash
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
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
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { CreateDeliveryRequestPayload, deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useScreenEnter } from '../../utils/animations';

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
    const [parcelType, setParcelType] = useState<'document' | 'package' | 'moving' | 'cake' | 'other'>('package');
    const [transportMode, setTransportMode] = useState<string>('');
    const [weight, setWeight] = useState<string>('');
    const [volume, setVolume] = useState<string>('');
    const [declaredValue, setDeclaredValue] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);

    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
    const [showPickupGPS, setShowPickupGPS] = useState(false);
    const [showDropoffGPS, setShowDropoffGPS] = useState(false);

    const [preferredDeliveryDate, setPreferredDeliveryDate] = useState<string>('');
    const [preferredDeliveryTimeStart, setPreferredDeliveryTimeStart] = useState<string>('');
    const [preferredDeliveryTimeEnd, setPreferredDeliveryTimeEnd] = useState<string>('');

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
        // Validation
        if (!pickupLocation) {
            Alert.alert('Erreur', 'Veuillez sélectionner une adresse de collecte');
            return;
        }

        if (!dropoffLocation) {
            Alert.alert('Erreur', 'Veuillez sélectionner une adresse de livraison');
            return;
        }

        setLoading(true);
        try {
            const payload: CreateDeliveryRequestPayload = {
                preferred_vehicle_type: transportMode || undefined,
                parcel: {
                    type_id: getParcelTypeId(parcelType),
                    notes: notes || `Colis: ${parcelType}`,
                    photos: photos,
                    constraints: {
                        weight: weight ? parseFloat(weight) : undefined,
                        volume: volume ? parseFloat(volume) : undefined,
                        declared_value: declaredValue ? parseFloat(declaredValue) : undefined,
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

    const getParcelTypeId = (type: string): number => {
        const typeMap: Record<string, number> = {
            document: 1,
            package: 2,
            moving: 3,
            cake: 4,
            other: 5,
        };
        return typeMap[type] || 2;
    };

    // Composants d'étapes
    const ParcelInfoStep = (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Informations du colis</Text>
            <Text style={styles.stepSubtitle}>Décrivez votre colis pour une meilleure estimation</Text>

            <View style={styles.typeSelector}>
                <Text style={styles.label}>Type de colis</Text>
                <View style={styles.typeButtons}>
                    {[
                        { id: 'document', label: '📄 Document', icon: 'file-text' },
                        { id: 'package', label: '📦 Colis', icon: 'package' },
                        { id: 'moving', label: '🚚 Déménagement', icon: 'truck' },
                        { id: 'cake', label: '🎂 Gâteau', icon: 'cake' },
                        { id: 'other', label: '📋 Autre', icon: 'box' },
                    ].map((type) => (
                        <HapticTouchable
                            key={type.id}
                            hapticType="light"
                            onPress={() => setParcelType(type.id as any)}
                            style={[
                                styles.typeButton,
                                parcelType === type.id && styles.typeButtonActive,
                            ]}
                        >
                            <SafeIcon
                                name={type.icon}
                                size={20}
                                color={parcelType === type.id ? '#FFFFFF' : modernColors.text}
                            />
                            <Text
                                style={[
                                    styles.typeButtonText,
                                    parcelType === type.id && styles.typeButtonTextActive,
                                ]}
                            >
                                {type.label.split(' ')[1]}
                            </Text>
                        </HapticTouchable>
                    ))}
                </View>
            </View>

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

    const PickupAddressStep = (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Adresse de collecte</Text>
            <Text style={styles.stepSubtitle}>Où se trouve le colis actuellement ?</Text>

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

    const DropoffAddressStep = (
        <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepTitle}>Adresse de livraison</Text>
            <Text style={styles.stepSubtitle}>Où souhaitez-vous que le colis soit livré ?</Text>

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
                        title="Changer l'adresse"
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
});

export default DeliveryParcelFlowNew;


