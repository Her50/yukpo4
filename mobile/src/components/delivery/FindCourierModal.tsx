import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Location from 'expo-location';
import { deliveryApi } from '../../services/api';
import { mediaService } from '../../services/mediaService';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';
import ModernGPSModal from '../ModernGPSModal';

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

interface AvailableCourier {
    id: string;
    user_id: number;
    name: string | null;
    email: string;
    avatar_url: string | null;
    rating_average: number | null;
    rating_count: number;
    bio: string | null;
    transport_type?: string;
    distance_km?: number;
    estimated_time_minutes?: number;
    stats: {
        completed_deliveries: number;
        cancelled_deliveries: number;
        avg_delivery_time_minutes: number | null;
        success_rate: number;
    };
}

const FindCourierModal: React.FC<FindCourierModalProps> = ({
    visible,
    onClose,
    product,
    service,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const [loadingCouriers, setLoadingCouriers] = useState(false);
    const [couriers, setCouriers] = useState<AvailableCourier[]>([]);
    const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
    
    // Points de pickup et delivery
    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [deliveryLocation, setDeliveryLocation] = useState<LocationData | null>(null);
    const [showPickupGPSModal, setShowPickupGPSModal] = useState(false);
    const [showDeliveryGPSModal, setShowDeliveryGPSModal] = useState(false);
    
    // Type de transport
    const [transportType, setTransportType] = useState<string>('any'); // 'bike', 'car', 'motorcycle', 'any'
    
    // Notes de livraison
    const [deliveryNotes, setDeliveryNotes] = useState('');

    // Initialiser les points de pickup depuis le produit/service
    useEffect(() => {
        if (visible && product) {
            // Point de pickup : GPS du produit ou du service
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
            
            // Point de delivery : GPS de l'utilisateur actuel
            loadUserLocation();
        }
    }, [visible, product, service]);

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

            setDeliveryLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            // Récupérer l'adresse
            const [address] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (address) {
                setDeliveryLocation(prev => ({
                    ...prev!,
                    address: `${address.street || ''} ${address.name || ''}, ${address.city || ''}`.trim(),
                }));
            }
        } catch (error) {
            console.error('[FindCourierModal] Erreur récupération position:', error);
        }
    };

    const searchCouriers = async () => {
        if (!pickupLocation || !deliveryLocation) {
            Alert.alert('Erreur', 'Veuillez définir les points de pickup et de livraison');
            return;
        }

        setLoadingCouriers(true);
        try {
            // Récupérer le temps de préparation depuis la configuration du produit
            let preparationTimeMinutes: number | undefined;
            try {
                if (service?.id && (product?.index !== undefined || product?._serviceId)) {
                    const productIndex = product?.index ?? 0; // Utiliser l'index du produit ou 0 par défaut
                    const configResponse = await deliveryApi.getProductDeliveryConfig(service.id, productIndex);
                    // L'API retourne { config: { ... } } ou directement les données
                    const config = (configResponse as any)?.config || configResponse;
                    if (config?.preparation_time_minutes) {
                        preparationTimeMinutes = config.preparation_time_minutes;
                    }
                }
            } catch (error) {
                console.warn('[FindCourierModal] Impossible de récupérer le temps de préparation:', error);
                // Continuer sans temps de préparation si l'API échoue
            }

            // Appel API amélioré avec tous les paramètres
            const params = new URLSearchParams();
            if (pickupLocation) {
                params.append('pickup_latitude', pickupLocation.latitude.toString());
                params.append('pickup_longitude', pickupLocation.longitude.toString());
            }
            if (deliveryLocation) {
                params.append('delivery_latitude', deliveryLocation.latitude.toString());
                params.append('delivery_longitude', deliveryLocation.longitude.toString());
            }
            if (transportType && transportType !== 'any') {
                params.append('transport_type', transportType);
            }
            if (preparationTimeMinutes !== undefined) {
                params.append('preparation_time_minutes', preparationTimeMinutes.toString());
            }
            params.append('max_distance_km', '10'); // 10km par défaut

            const response = await deliveryApi.listAvailableCouriers(undefined, params.toString());
            
            if (response.couriers && Array.isArray(response.couriers)) {
                // Les coursiers sont déjà triés et filtrés par l'API backend
                // avec distance et temps estimé calculés
                setCouriers(response.couriers);
            } else {
                setCouriers([]);
            }
        } catch (error: any) {
            console.error('[FindCourierModal] Erreur recherche coursiers:', error);
            Alert.alert('Erreur', error.message || 'Impossible de rechercher les coursiers disponibles');
            setCouriers([]);
        } finally {
            setLoadingCouriers(false);
        }
    };

    const handleCreateDelivery = async () => {
        if (!selectedCourierId) {
            Alert.alert('Erreur', 'Veuillez sélectionner un coursier');
            return;
        }

        if (!pickupLocation || !deliveryLocation) {
            Alert.alert('Erreur', 'Veuillez définir les points de pickup et de livraison');
            return;
        }

        setLoading(true);
        try {
            // Créer la demande de livraison
            const deliveryData = {
                service_id: service?.id,
                product_index: product?.index || 0,
                pickup_latitude: pickupLocation.latitude,
                pickup_longitude: pickupLocation.longitude,
                pickup_address: pickupLocation.address || '',
                delivery_latitude: deliveryLocation.latitude,
                delivery_longitude: deliveryLocation.longitude,
                delivery_address: deliveryLocation.address || '',
                transport_type: transportType !== 'any' ? transportType : null,
                notes: deliveryNotes,
                preferred_courier_id: selectedCourierId,
            };

            // TODO: Utiliser la vraie API de création de livraison
            const response = await deliveryApi.createDeliveryRequest(deliveryData);
            
            if (response.delivery?.id) {
                Alert.alert('✅ Livraison créée', 'Votre demande de livraison a été créée avec succès');
                onSuccess?.(response.delivery.id);
                onClose();
            } else {
                throw new Error('Réponse invalide de l\'API');
            }
        } catch (error: any) {
            console.error('[FindCourierModal] Erreur création livraison:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la demande de livraison');
        } finally {
            setLoading(false);
        }
    };

    const renderCourier = ({ item }: { item: AvailableCourier }) => (
        <TouchableOpacity
            style={[
                styles.courierCard,
                selectedCourierId === item.id && styles.courierCardSelected,
            ]}
            onPress={() => setSelectedCourierId(item.id)}
        >
            <View style={styles.courierHeader}>
                {/* Avatar */}
                {item.avatar_url ? (
                    <Image 
                        source={{ uri: mediaService.getImageUrl(item.avatar_url) }} 
                        style={styles.avatar} 
                    />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                            {(item.name || item.email)[0].toUpperCase()}
                        </Text>
                    </View>
                )}

                {/* Info */}
                <View style={styles.courierInfo}>
                    <View style={styles.courierNameRow}>
                        <Text style={styles.courierName} numberOfLines={1}>
                            {item.name || item.email}
                        </Text>
                        {selectedCourierId === item.id && (
                            <SafeIcon name="check-circle" size={20} color={modernColors.primary} />
                        )}
                    </View>

                    {item.bio && (
                        <Text style={styles.courierBio} numberOfLines={2}>
                            {item.bio}
                        </Text>
                    )}

                    {/* Stats et Distance */}
                    <View style={styles.statsRow}>
                        {item.rating_average !== null && (
                            <View style={styles.statItem}>
                                <SafeIcon name="star" size={14} color="#FBBF24" />
                                <Text style={styles.statText}>
                                    {item.rating_average.toFixed(1)} ({item.rating_count})
                                </Text>
                            </View>
                        )}

                        <View style={styles.statItem}>
                            <SafeIcon name="check-circle" size={14} color={modernColors.success} />
                            <Text style={styles.statText}>
                                {item.stats.completed_deliveries} livraisons
                            </Text>
                        </View>

                        {item.distance_km && (
                            <View style={styles.statItem}>
                                <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                                <Text style={styles.statText}>
                                    {item.distance_km.toFixed(1)} km
                                </Text>
                            </View>
                        )}

                        {item.estimated_time_minutes && (
                            <View style={styles.statItem}>
                                <SafeIcon name="clock" size={14} color={modernColors.info} />
                                <Text style={styles.statText}>
                                    ~{item.estimated_time_minutes} min
                                </Text>
                            </View>
                        )}

                        <Text style={styles.successRate}>
                            {item.stats.success_rate}% réussite
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

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

                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Points de pickup et delivery */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Points de livraison</Text>
                            
                            {/* Point de pickup */}
                            <View style={styles.locationCard}>
                                <View style={styles.locationHeader}>
                                    <SafeIcon name="package" size={16} color={modernColors.primary} />
                                    <Text style={styles.locationLabel}>Point de récupération</Text>
                                </View>
                                {pickupLocation ? (
                                    <View style={styles.locationInfo}>
                                        <Text style={styles.locationText}>
                                            {pickupLocation.address || `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.locationButton}
                                            onPress={() => setShowPickupGPSModal(true)}
                                        >
                                            <Text style={styles.locationButtonText}>Modifier</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.locationButton}
                                        onPress={() => setShowPickupGPSModal(true)}
                                    >
                                        <Text style={styles.locationButtonText}>Définir le point de récupération</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Point de delivery */}
                            <View style={styles.locationCard}>
                                <View style={styles.locationHeader}>
                                    <SafeIcon name="map-pin" size={16} color={modernColors.success} />
                                    <Text style={styles.locationLabel}>Point de livraison</Text>
                                </View>
                                {deliveryLocation ? (
                                    <View style={styles.locationInfo}>
                                        <Text style={styles.locationText}>
                                            {deliveryLocation.address || `${deliveryLocation.latitude.toFixed(6)}, ${deliveryLocation.longitude.toFixed(6)}`}
                                        </Text>
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

                        {/* Type de transport */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Type de transport</Text>
                            <View style={styles.transportOptions}>
                                {[
                                    { value: 'any', label: 'Tous', icon: 'truck' },
                                    { value: 'bike', label: 'Vélo', icon: 'bike' },
                                    { value: 'motorcycle', label: 'Moto', icon: 'zap' },
                                    { value: 'car', label: 'Voiture', icon: 'car' },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.transportOption,
                                            transportType === option.value && styles.transportOptionSelected,
                                        ]}
                                        onPress={() => setTransportType(option.value)}
                                    >
                                        <SafeIcon 
                                            name={option.icon} 
                                            size={20} 
                                            color={transportType === option.value ? '#FFFFFF' : modernColors.primary} 
                                        />
                                        <Text
                                            style={[
                                                styles.transportOptionText,
                                                transportType === option.value && styles.transportOptionTextSelected,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

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

                        {/* Bouton de recherche */}
                        {pickupLocation && deliveryLocation && (
                            <TouchableOpacity
                                style={styles.searchButton}
                                onPress={searchCouriers}
                                disabled={loadingCouriers}
                            >
                                {loadingCouriers ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <SafeIcon name="search" size={18} color="#FFFFFF" />
                                        <Text style={styles.searchButtonText}>Rechercher des coursiers</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {/* Liste des coursiers */}
                        {couriers.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>
                                    Coursiers disponibles ({couriers.length})
                                </Text>
                                <FlatList
                                    data={couriers}
                                    renderItem={renderCourier}
                                    keyExtractor={(item) => item.id}
                                    scrollEnabled={false}
                                />
                            </View>
                        )}

                        {loadingCouriers && couriers.length === 0 && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={modernColors.primary} />
                                <Text style={styles.loadingText}>Recherche de coursiers...</Text>
                            </View>
                        )}

                        {!loadingCouriers && couriers.length === 0 && pickupLocation && deliveryLocation && (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>
                                    Aucun coursier disponible pour le moment
                                </Text>
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
                            title={loading ? 'Création...' : 'Créer la livraison'}
                            variant="primary"
                            onPress={handleCreateDelivery}
                            disabled={!selectedCourierId || !pickupLocation || !deliveryLocation || loading}
                        />
                    </View>
                </View>
            </View>

            {/* Modals GPS */}
            <ModernGPSModal
                visible={showPickupGPSModal}
                onClose={() => setShowPickupGPSModal(false)}
                onSelect={(coordinates) => {
                    try {
                        const [lat, lng] = coordinates.split(',').map(c => parseFloat(c.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                            setPickupLocation({ latitude: lat, longitude: lng });
                            setShowPickupGPSModal(false);
                        }
                    } catch (error) {
                        console.error('[FindCourierModal] Erreur parsing pickup GPS:', error);
                    }
                }}
                title="Point de récupération"
                currentLocation={pickupLocation ? { lat: pickupLocation.latitude, lng: pickupLocation.longitude } : null}
            />

            <ModernGPSModal
                visible={showDeliveryGPSModal}
                onClose={() => setShowDeliveryGPSModal(false)}
                onSelect={(coordinates) => {
                    try {
                        const [lat, lng] = coordinates.split(',').map(c => parseFloat(c.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                            setDeliveryLocation({ latitude: lat, longitude: lng });
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
        color: modernColors.textSecondary,
        marginRight: 8,
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
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 16,
    },
    searchButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    loadingContainer: {
        padding: 32,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    courierCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        marginBottom: 12,
        backgroundColor: 'white',
    },
    courierCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    courierHeader: {
        flexDirection: 'row',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.primary,
    },
    courierInfo: {
        flex: 1,
    },
    courierNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    courierName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    courierBio: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    successRate: {
        marginLeft: 'auto',
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.success,
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

