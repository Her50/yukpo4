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
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import ModernGPSModal from '../ModernGPSModal';
import SafeIcon from '../SafeIcon';
import { NativeButton } from '../SafeNativeDesign';

interface FindCourierModalProps {
    visible: boolean;
    onClose: () => void;
    product: any;
    service: any;
    onSuccess?: (deliveryId: string) => void;
}

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}


const FindCourierModal: React.FC<FindCourierModalProps> = ({
    visible,
    onClose,
    product,
    service,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);

    // Points de pickup et delivery
    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
    const [showDeliveryGPSModal, setShowDeliveryGPSModal] = useState(false);

    // ✅ NOUVEAU: Configuration de livraison du produit
    const [deliveryConfig, setDeliveryConfig] = useState<{
        pickup_address?: string;
        pickup_latitude?: number;
        pickup_longitude?: number;
        required_vehicle_type_id?: number;
        preparation_time_minutes?: number;
    } | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(false);

    // Type de transport (récupéré depuis la configuration)
    const [transportType, setTransportType] = useState<string>('any'); // 'bike', 'car', 'motorcycle', 'any'

    // Notes de livraison
    const [deliveryNotes, setDeliveryNotes] = useState('');

    // ✅ NOUVEAU: Informations de disponibilité et délai
    const [availabilityInfo, setAvailabilityInfo] = useState<{
        is_available: boolean;
        preparation_time_minutes?: number;
        estimated_ready_time?: Date;
    } | null>(null);

    // ✅ RÉÉCRIT COMPLÈTEMENT: Charger la configuration de livraison du produit
    useEffect(() => {
        const loadDeliveryConfig = async () => {
            if (!visible || !product || !service) return;

            const serviceId = service?.id || service?.service_id;
            let productIndex: number | undefined =
                typeof product.product_index === 'number'
                    ? product.product_index
                    : (typeof product.index === 'number' ? product.index : undefined);

            // Si l'index n'est pas disponible, essayer de le calculer depuis le service
            if (productIndex === undefined && service?.data?.produits && Array.isArray(service.data.produits)) {
                const produitIndex = service.data.produits.findIndex((p: any) =>
                    p.nom === product?.nom ||
                    p.id === product?.id ||
                    JSON.stringify(p) === JSON.stringify(product)
                );
                if (produitIndex >= 0) {
                    productIndex = produitIndex;
                }
            }

            if (!serviceId || productIndex === undefined) {
                console.warn('[FindCourierModal] Service ID ou Product Index manquant');
                return;
            }

            setLoadingConfig(true);
            try {
                // ✅ Charger la configuration de livraison du produit
                const configResponse = await deliveryApi.getProductDeliveryConfig(serviceId, productIndex);
                const configData = (configResponse as any)?.config || configResponse?.data || configResponse;

                if (configData) {
                    setDeliveryConfig({
                        pickup_address: configData.pickup_address || '',
                        pickup_latitude: configData.pickup_latitude,
                        pickup_longitude: configData.pickup_longitude,
                        required_vehicle_type_id: configData.required_vehicle_type_id,
                        preparation_time_minutes: configData.preparation_time_minutes,
                    });

                    // ✅ Utiliser le point de pickup de la configuration
                    if (configData.pickup_latitude && configData.pickup_longitude) {
                        setPickupLocation({
                            latitude: configData.pickup_latitude,
                            longitude: configData.pickup_longitude,
                            address: configData.pickup_address || '',
                        });
                    }

                    // ✅ Utiliser le type de transport de la configuration
                    if (configData.required_vehicle_type_id) {
                        // Mapper l'ID vers le type de transport
                        // Les IDs correspondent généralement : 1=bike, 2=motorcycle, 3=car, etc.
                        const vehicleTypeMap: { [key: number]: string } = {
                            1: 'bike',
                            2: 'motorcycle',
                            3: 'car',
                            4: 'pickup',
                            5: 'van',
                            6: 'truck',
                        };
                        const mappedType = vehicleTypeMap[configData.required_vehicle_type_id] || 'any';
                        setTransportType(mappedType);
                    }
                }

                // ✅ Charger les informations de disponibilité
                try {
                    const availabilityResponse = await deliveryApi.checkProductAvailability(serviceId, productIndex);
                    if (availabilityResponse.success && availabilityResponse.availability) {
                        const availability = availabilityResponse.availability;
                        let estimatedReadyTime: Date | undefined;

                        if (availability.preparation_time_minutes && availability.preparation_time_minutes > 0) {
                            estimatedReadyTime = new Date();
                            estimatedReadyTime.setMinutes(estimatedReadyTime.getMinutes() + availability.preparation_time_minutes);
                        }

                        setAvailabilityInfo({
                            is_available: availability.is_available || false,
                            preparation_time_minutes: availability.preparation_time_minutes,
                            estimated_ready_time: estimatedReadyTime,
                        });
                    }
                } catch (error) {
                    console.error('[FindCourierModal] Erreur chargement disponibilité:', error);
                }
            } catch (error) {
                console.error('[FindCourierModal] Erreur chargement configuration livraison:', error);
                // Fallback : utiliser le GPS du produit/service si la configuration n'existe pas
                const productGPS = product.gps || product.gpsFixe;
                const serviceGPS = service?.data?.gps_fixe?.valeur || service?.data?.gps_fixe || service?.gps;
                const pickupGPS = productGPS || serviceGPS;

                if (pickupGPS && typeof pickupGPS === 'string' && pickupGPS.includes(',')) {
                    try {
                        const [lat, lng] = pickupGPS.split(',').map(c => parseFloat(c.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                            setPickupLocation({ latitude: lat, longitude: lng });
                        }
                    } catch (error) {
                        console.error('[FindCourierModal] Erreur parsing pickup GPS:', error);
                    }
                }
            } finally {
                setLoadingConfig(false);
            }

            // Point de delivery : GPS de l'utilisateur actuel
            loadUserLocation();
        };

        loadDeliveryConfig();
    }, [visible, product, service]);

    // ✅ AMÉLIORÉ: Charger la position de l'utilisateur avec reverse geocoding enrichi
    const loadUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation pour définir votre adresse de livraison');
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            // ✅ Récupérer l'adresse complète avec reverse geocoding
            const [address] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (address) {
                const addr = address as any;
                // ✅ Construire une adresse complète avec nom du lieu
                const addressParts: string[] = [];

                // Nom du lieu (street, name, ou subThoroughfare)
                if (addr.street) addressParts.push(addr.street);
                else if (addr.name) addressParts.push(addr.name);
                else if (addr.subThoroughfare) addressParts.push(addr.subThoroughfare);

                // Ville
                if (addr.city) addressParts.push(addr.city);
                else if (addr.subAdministrativeArea) addressParts.push(addr.subAdministrativeArea);

                // Région/Pays
                if (addr.region) addressParts.push(addr.region);
                if (addr.country) addressParts.push(addr.country);

                const fullAddress = addressParts.length > 0
                    ? addressParts.join(', ')
                    : `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;

                // ✅ Construire le nom du lieu (première partie de l'adresse)
                const placeName = addr.street || addr.name || addr.subThoroughfare || 'Localisation';

                setDeliveryLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    address: `${placeName} - ${fullAddress}`, // Nom du lieu + adresse complète
                });
            } else {
                // Si pas d'adresse, utiliser les coordonnées
                setDeliveryLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            }
        } catch (error) {
            console.error('[FindCourierModal] Erreur récupération position:', error);
        }
    };

    // ✅ RÉÉCRIT COMPLÈTEMENT: Créer directement la livraison avec matching intelligent automatique
    const handleCreateDelivery = async () => {
        if (!pickupLocation || !deliveryLocation) {
            Alert.alert('Erreur', 'Veuillez définir le point de livraison');
            return;
        }

        if (!service?.id && !service?.service_id) {
            Alert.alert('Erreur', 'Service non trouvé');
            return;
        }

        setLoading(true);
        try {
            // ✅ Extraire l'index du produit
            let productIndex: number | undefined =
                typeof product.product_index === 'number'
                    ? product.product_index
                    : (typeof product.index === 'number' ? product.index : undefined);

            // Si l'index n'est pas disponible, essayer de le calculer depuis le service
            if (productIndex === undefined && service?.data?.produits && Array.isArray(service.data.produits)) {
                const produitIndex = service.data.produits.findIndex((p: any) =>
                    p.nom === product?.nom ||
                    p.id === product?.id ||
                    JSON.stringify(p) === JSON.stringify(product)
                );
                if (produitIndex >= 0) {
                    productIndex = produitIndex;
                }
            }

            const serviceId = service?.id || service?.service_id;

            // ✅ Créer la commande client directe - Le backend gère automatiquement :
            // - Récupération de la configuration de livraison
            // - Vérification de disponibilité
            // - Matching intelligent en arrière-plan
            // - Notifications automatiques
            const response = await deliveryApi.createClientOrder({
                service_id: serviceId,
                product_index: productIndex,
                dropoff: {
                    latitude: deliveryLocation.latitude,
                    longitude: deliveryLocation.longitude,
                    address: deliveryLocation.address || undefined,
                },
                notes: deliveryNotes || undefined,
                metadata: {
                    source: 'mobile_app',
                    preparation_time_minutes: availabilityInfo?.preparation_time_minutes,
                },
            });

            if (response.success !== false && (response.delivery?.id || response.id)) {
                const deliveryId = response.delivery?.id || response.id;

                Alert.alert(
                    '✅ Commande créée',
                    'Votre commande a été créée avec succès. Le matching intelligent est en cours. Vous recevrez une notification dès qu\'un coursier sera assigné.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onSuccess?.(deliveryId);
                                onClose();
                            },
                        },
                    ]
                );
            } else if (response.success === false && response.available === false) {
                // Produit non disponible
                Alert.alert(
                    'Produit indisponible',
                    response.reason || 'Ce produit n\'est pas disponible actuellement.',
                    [{ text: 'OK' }]
                );
            } else {
                throw new Error(response.message || 'Réponse invalide de l\'API');
            }
        } catch (error: any) {
            console.error('[FindCourierModal] Erreur création livraison:', error);
            Alert.alert(
                'Erreur',
                error.message || error.error || 'Impossible de créer la commande. Veuillez réessayer.'
            );
        } finally {
            setLoading(false);
        }
    };


    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Trouver un coursier</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* ✅ NOUVEAU: Affichage des informations de disponibilité et délai */}
                    {availabilityInfo && availabilityInfo.preparation_time_minutes && availabilityInfo.preparation_time_minutes > 0 && (
                        <View style={styles.preparationInfoBanner}>
                            <View style={styles.preparationInfoRow}>
                                <SafeIcon name="clock" size={16} color={modernColors.primary} />
                                <View style={styles.preparationInfoText}>
                                    <Text style={styles.preparationInfoTitle}>
                                        Temps de préparation : {availabilityInfo.preparation_time_minutes} minutes
                                    </Text>
                                    {availabilityInfo.estimated_ready_time && (
                                        <Text style={styles.preparationInfoSubtitle}>
                                            Disponible vers {availabilityInfo.estimated_ready_time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}

                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Points de pickup et delivery */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Points de livraison</Text>

                            {/* ✅ Point de pickup - Récupéré depuis la configuration (non modifiable) */}
                            {loadingConfig ? (
                                <View style={styles.locationCard}>
                                    <View style={styles.locationHeader}>
                                        <SafeIcon name="package" size={16} color={modernColors.primary} />
                                        <Text style={styles.locationLabel}>Point de récupération</Text>
                                    </View>
                                    <View style={styles.loadingLocation}>
                                        <ActivityIndicator size="small" color={modernColors.primary} />
                                        <Text style={styles.loadingLocationText}>Chargement de la configuration...</Text>
                                    </View>
                                </View>
                            ) : pickupLocation ? (
                                <View style={styles.locationCard}>
                                    <View style={styles.locationHeader}>
                                        <SafeIcon name="package" size={16} color={modernColors.primary} />
                                        <Text style={styles.locationLabel}>Point de récupération</Text>
                                        <View style={styles.configBadge}>
                                            <SafeIcon name="check-circle" size={12} color={modernColors.success} />
                                            <Text style={styles.configBadgeText}>Configuré</Text>
                                        </View>
                                    </View>
                                    <View style={styles.locationInfo}>
                                        <Text style={styles.locationText}>
                                            {pickupLocation.address || `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                                        </Text>
                                        <Text style={styles.locationCoordinates}>
                                            {pickupLocation.latitude.toFixed(6)}, {pickupLocation.longitude.toFixed(6)}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.locationCard}>
                                    <View style={styles.locationHeader}>
                                        <SafeIcon name="package" size={16} color={modernColors.warning} />
                                        <Text style={styles.locationLabel}>Point de récupération</Text>
                                    </View>
                                    <Text style={styles.locationErrorText}>
                                        ⚠️ Aucune configuration de livraison trouvée pour ce produit
                                    </Text>
                                </View>
                            )}

                            {/* ✅ Point de delivery - Affiche le nom du lieu + coordonnées */}
                            <View style={styles.locationCard}>
                                <View style={styles.locationHeader}>
                                    <SafeIcon name="map-pin" size={16} color={modernColors.success} />
                                    <Text style={styles.locationLabel}>Point de livraison</Text>
                                </View>
                                {deliveryLocation ? (
                                    <View style={styles.locationInfo}>
                                        <Text style={styles.locationText}>
                                            {deliveryLocation.address || `Localisation: ${deliveryLocation.latitude.toFixed(6)}, ${deliveryLocation.longitude.toFixed(6)}`}
                                        </Text>
                                        {deliveryLocation.address && (
                                            <Text style={styles.locationCoordinates}>
                                                {deliveryLocation.latitude.toFixed(6)}, {deliveryLocation.longitude.toFixed(6)}
                                            </Text>
                                        )}
                                        <TouchableOpacity
                                            style={styles.locationButton}
                                            onPress={() => setShowDeliveryGPSModal(true)}
                                        >
                                            <Text style={styles.locationButtonText}>Modifier</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.locationButton}
                                        onPress={() => setShowDeliveryGPSModal(true)}
                                    >
                                        <Text style={styles.locationButtonText}>Définir votre adresse de livraison</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* ✅ Type de transport - Affiche celui configuré (non modifiable) */}
                        {deliveryConfig?.required_vehicle_type_id && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Type de transport</Text>
                                <View style={styles.transportInfoCard}>
                                    <View style={styles.transportInfoHeader}>
                                        <SafeIcon
                                            name={transportType === 'bike' ? 'bike' : transportType === 'motorcycle' ? 'zap' : transportType === 'car' ? 'car' : 'truck'}
                                            size={20}
                                            color={modernColors.primary}
                                        />
                                        <Text style={styles.transportInfoLabel}>
                                            {transportType === 'bike' ? 'Vélo' :
                                                transportType === 'motorcycle' ? 'Moto' :
                                                    transportType === 'car' ? 'Voiture' :
                                                        transportType === 'pickup' ? 'Pick-up' :
                                                            transportType === 'van' ? 'Fourgonnette' :
                                                                transportType === 'truck' ? 'Camion' : 'Tous types'}
                                        </Text>
                                        <View style={styles.configBadge}>
                                            <SafeIcon name="check-circle" size={12} color={modernColors.success} />
                                            <Text style={styles.configBadgeText}>Configuré</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.transportInfoText}>
                                        Le type de transport est défini par le prestataire dans la configuration du produit
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Notes */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Notes (optionnel)</Text>
                            <TextInput
                                style={styles.notesInput}
                                placeholder="Instructions spéciales pour le coursier..."
                                value={deliveryNotes}
                                onChangeText={setDeliveryNotes}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* ✅ NOUVEAU: Information sur le matching intelligent */}
                        {pickupLocation && deliveryLocation && (
                            <View style={styles.matchingInfoCard}>
                                <View style={styles.matchingInfoHeader}>
                                    <SafeIcon name="zap" size={20} color={modernColors.primary} />
                                    <Text style={styles.matchingInfoTitle}>Matching intelligent</Text>
                                </View>
                                <Text style={styles.matchingInfoText}>
                                    Le système trouvera automatiquement le meilleur coursier disponible. Vous recevrez une notification dès qu'un coursier sera assigné à votre commande.
                                </Text>
                                {availabilityInfo?.preparation_time_minutes && availabilityInfo.preparation_time_minutes > 0 && (
                                    <Text style={styles.matchingInfoSubtext}>
                                        ⏱️ Le matching prendra en compte le temps de préparation de {availabilityInfo.preparation_time_minutes} minutes.
                                    </Text>
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <NativeButton
                            title="Annuler"
                            variant="outline"
                            onPress={onClose}
                            disabled={loading}
                        />
                        <NativeButton
                            title={loading ? 'Création en cours...' : 'Créer la commande'}
                            variant="primary"
                            onPress={handleCreateDelivery}
                            disabled={!pickupLocation || !deliveryLocation || loading}
                        />
                    </View>
                </View>
            </View>

            {/* Modal GPS pour le point de livraison uniquement */}
            <ModernGPSModal
                visible={showDeliveryGPSModal}
                onClose={() => setShowDeliveryGPSModal(false)}
                onSelect={async (coordinates) => {
                    try {
                        const [lat, lng] = coordinates.split(',').map(c => parseFloat(c.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                            // ✅ Récupérer l'adresse avec reverse geocoding
                            try {
                                const [address] = await Location.reverseGeocodeAsync({
                                    latitude: lat,
                                    longitude: lng,
                                });

                                if (address) {
                                    const addr2 = address as any;
                                    const addressParts: string[] = [];

                                    if (addr2.street) addressParts.push(addr2.street);
                                    else if (addr2.name) addressParts.push(addr2.name);
                                    else if (addr2.subThoroughfare) addressParts.push(addr2.subThoroughfare);

                                    if (addr2.city) addressParts.push(addr2.city);
                                    else if (addr2.subAdministrativeArea) addressParts.push(addr2.subAdministrativeArea);

                                    if (addr2.region) addressParts.push(addr2.region);
                                    if (addr2.country) addressParts.push(addr2.country);

                                    const fullAddress = addressParts.length > 0
                                        ? addressParts.join(', ')
                                        : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

                                    const placeName = addr2.street || addr2.name || addr2.subThoroughfare || 'Localisation';

                                    setDeliveryLocation({
                                        latitude: lat,
                                        longitude: lng,
                                        address: `${placeName} - ${fullAddress}`,
                                    });
                                } else {
                                    setDeliveryLocation({ latitude: lat, longitude: lng });
                                }
                            } catch (geocodeError) {
                                console.error('[FindCourierModal] Erreur reverse geocoding:', geocodeError);
                                setDeliveryLocation({ latitude: lat, longitude: lng });
                            }

                            setShowDeliveryGPSModal(false);
                        }
                    } catch (error) {
                        console.error('[FindCourierModal] Erreur parsing delivery GPS:', error);
                    }
                }}
                title="Point de livraison"
                currentLocation={deliveryLocation ? { lat: deliveryLocation.latitude, lng: deliveryLocation.longitude } : null}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    // ✅ NOUVEAU: Styles pour l'affichage des informations de préparation
    preparationInfoBanner: {
        backgroundColor: '#EFF6FF',
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
        padding: 12,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 8,
    },
    preparationInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    preparationInfoText: {
        flex: 1,
    },
    preparationInfoTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 2,
    },
    preparationInfoSubtitle: {
        fontSize: 11,
        color: '#6B7280',
    },
    scrollContent: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    locationCard: {
        backgroundColor: modernColors.background,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    locationLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    locationText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.text,
        marginRight: 8,
        fontWeight: '500',
    },
    locationCoordinates: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontFamily: 'monospace',
    },
    loadingLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    loadingLocationText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    locationErrorText: {
        fontSize: 12,
        color: modernColors.warning,
        fontStyle: 'italic',
    },
    configBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: modernColors.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginLeft: 'auto',
    },
    configBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.success,
    },
    transportInfoCard: {
        backgroundColor: modernColors.background,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    transportInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    transportInfoLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    transportInfoText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    locationButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    locationButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    transportOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    transportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: 'white',
    },
    transportOptionSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    transportOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    transportOptionTextSelected: {
        color: '#FFFFFF',
    },
    notesInput: {
        backgroundColor: modernColors.background,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    matchingInfoCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
    },
    matchingInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    matchingInfoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    matchingInfoText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
        marginBottom: 8,
    },
    matchingInfoSubtext: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.background,
    },
});

export default FindCourierModal;

