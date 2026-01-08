/**
 * 🛒 NOUVEAU: Flux de commande shopping amélioré avec progress bar
 * Design moderne niveau Instacart / Uber Eats
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    BasketCompositionStep,
    DeliveryAddressStep,
    SupermarketSelectionStep,
} from '../../components/delivery/DeliveryShoppingFlowSteps';
import StepWizardForm from '../../components/delivery/StepWizardForm';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { CreateDeliveryRequestPayload, deliveryApi } from '../../services/api';
import { useScreenEnter } from '../../utils/animations';
import { LocationObject } from '../../components/LocationSelector';
import { UserSavedAddress } from '../../hooks/useSavedAddresses';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';

interface DeliveryShoppingFlowNewProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: (deliveryId: string) => void;
}

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

interface Supermarket {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance_km?: number;
    phone?: string;
    website?: string;
}

interface BasketItem {
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    estimatedPrice?: number;
}

const DeliveryShoppingFlowNew: React.FC<DeliveryShoppingFlowNewProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const { location: userLocation } = useLocation();
    // ✅ NOUVEAU: Détection automatique de devise depuis GPS/localisation
    const detectedCurrency = useCurrencyDetection(
        dropoffLocation ? { 
            latitude: dropoffLocation.latitude, 
            longitude: dropoffLocation.longitude 
        } : undefined
    );
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);

    // États
    const [selectedSupermarket, setSelectedSupermarket] = useState<Supermarket | null>(null);
    const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
    const [loadingSupermarkets, setLoadingSupermarkets] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');

    const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('1');
    const [newItemUnit, setNewItemUnit] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [showAddItem, setShowAddItem] = useState(false);

    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
    const [showDropoffGPS, setShowDropoffGPS] = useState(false);

    const [notes, setNotes] = useState('');
    const [preferredVehicleType, setPreferredVehicleType] = useState<string | null>(null);

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

    // Charger supermarchés
    useEffect(() => {
        if (visible) {
            loadSupermarkets();
            if (userLocation) {
                setDropoffLocation({
                    latitude: userLocation.coords.latitude,
                    longitude: userLocation.coords.longitude,
                    address: '',
                });
            }
        }
    }, [visible, userLocation]);

    // Mettre à jour pickupLocation quand supermarché sélectionné
    useEffect(() => {
        if (selectedSupermarket) {
            setPickupLocation({
                latitude: selectedSupermarket.latitude,
                longitude: selectedSupermarket.longitude,
                address: selectedSupermarket.address,
            });
        }
    }, [selectedSupermarket]);

    const loadSupermarkets = async () => {
        setLoadingSupermarkets(true);
        try {
            let userLat = 4.0511;
            let userLng = 9.7679;

            if (userLocation) {
                userLat = userLocation.coords.latitude;
                userLng = userLocation.coords.longitude;
            } else {
                try {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    userLat = location.coords.latitude;
                    userLng = location.coords.longitude;
                } catch (error) {
                    console.warn('Géolocalisation non disponible');
                }
            }

            const result = await deliveryApi.listSupermarkets(userLat, userLng, 10);

            if (result.supermarkets && result.supermarkets.length > 0) {
                const supermarketsWithDistance = result.supermarkets.map((sm: any) => {
                    if (!sm.distance_km && sm.latitude && sm.longitude) {
                        const distance = calculateDistance(userLat, userLng, sm.latitude, sm.longitude);
                        return { ...sm, distance_km: Math.round(distance * 10) / 10 };
                    }
                    return sm;
                });
                setSupermarkets(supermarketsWithDistance);
            } else {
                setSupermarkets([]);
            }
        } catch (error) {
            console.error('Erreur chargement supermarchés:', error);
            setSupermarkets([]);
        } finally {
            setLoadingSupermarkets(false);
        }
    };

    const handleUseCurrentLocation = async () => {
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

            setDropoffLocation(coords);
            setErrors(prev => ({ ...prev, dropoff: '' }));
        } catch (error) {
            console.error('Erreur géolocalisation:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position.');
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleGPSSelect = (coordinates: string) => {
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
                setDropoffLocation(location);
            })
            .catch((error) => {
                console.warn('Géocodage inverse échoué:', error);
                setDropoffLocation(location);
            });

        setShowDropoffGPS(false);
    };

    // ✅ NOUVEAU : Handler pour sélection d'adresse sauvegardée
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

    const addBasketItem = (item: BasketItem) => {
        setBasketItems([...basketItems, item]);
        setNewItemName('');
        setNewItemQuantity('1');
        setNewItemUnit('');
        setNewItemPrice('');
        setShowAddItem(false);
    };

    const removeBasketItem = (id: string) => {
        setBasketItems(basketItems.filter((item) => item.id !== id));
    };

    const handleComplete = async (data: any) => {
        console.log('[DeliveryShoppingFlowNew] handleComplete appelé avec data:', data);
        console.log('[DeliveryShoppingFlowNew] États actuels:', {
            selectedSupermarket: !!selectedSupermarket,
            basketItemsCount: basketItems.length,
            dropoffLocation: !!dropoffLocation,
        });

        // Validation
        if (!selectedSupermarket) {
            console.log('[DeliveryShoppingFlowNew] ❌ Erreur: pas de supermarché sélectionné');
            Alert.alert('Erreur', 'Veuillez sélectionner un supermarché');
            return;
        }

        if (basketItems.length === 0) {
            console.log('[DeliveryShoppingFlowNew] ❌ Erreur: panier vide');
            Alert.alert('Erreur', 'Veuillez ajouter au moins un article au panier');
            return;
        }

        if (!dropoffLocation) {
            console.log('[DeliveryShoppingFlowNew] ❌ Erreur: pas d\'adresse de livraison');
            Alert.alert('Erreur', 'Veuillez sélectionner une adresse de livraison');
            return;
        }

        console.log('[DeliveryShoppingFlowNew] ✅ Validation passée, création de la commande...');

        setLoading(true);
        try {
            const basketTotal = basketItems.reduce((total, item) => {
                return total + (item.estimatedPrice || 0) * item.quantity;
            }, 0);

            const payload: CreateDeliveryRequestPayload = {
                preferred_vehicle_type: preferredVehicleType || undefined,
                parcel: {
                    type_id: undefined, // ✅ CORRECTION: Le backend utilisera un type par défaut
                    notes: notes || `Courses supermarché: ${selectedSupermarket.name}`,
                    photos: [],
                    constraints: {},
                },
                pickup: {
                    latitude: pickupLocation!.latitude,
                    longitude: pickupLocation!.longitude,
                    address: pickupLocation!.address || selectedSupermarket.address,
                },
                dropoff: {
                    latitude: dropoffLocation.latitude,
                    longitude: dropoffLocation.longitude,
                    address: dropoffLocation.address,
                },
                metadata: {
                    kind: 'shopping',
                    supermarket_id: selectedSupermarket.id,
                    supermarket_name: selectedSupermarket.name,
                    basket_items: basketItems.map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        estimated_price: item.estimatedPrice,
                    })),
                    basket_total: basketTotal,
                },
                initial_event_payload: {},
            };

            const result = await deliveryApi.createDeliveryRequest(payload);

            if (result.success && result.data?.id) {
                Alert.alert(
                    'Commande créée',
                    'Votre commande de courses a été créée avec succès.',
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
                Alert.alert('Erreur', result.error || 'Impossible de créer la commande');
            }
        } catch (error: any) {
            console.error('Erreur création commande:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        {
            id: 'supermarket',
            label: 'Supermarché',
            icon: 'store',
            component: (
                <SupermarketSelectionStep
                    supermarkets={supermarkets}
                    selectedSupermarket={selectedSupermarket}
                    onSelect={setSelectedSupermarket}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    loading={loadingSupermarkets}
                    error={errors.supermarket}
                    onViewProducts={(supermarket) => {
                        const navigation = require('@react-navigation/native').useNavigation();
                        (navigation as any).navigate('SupermarketHome', { supermarketId: supermarket.id });
                    }}
                />
            ),
            validation: () => !!selectedSupermarket,
        },
        {
            id: 'basket',
            label: 'Panier',
            icon: 'shopping-bag',
            component: (
                <BasketCompositionStep
                    basketItems={basketItems}
                    onAddItem={addBasketItem}
                    onRemoveItem={removeBasketItem}
                    newItemName={newItemName}
                    onNewItemNameChange={setNewItemName}
                    newItemQuantity={newItemQuantity}
                    onNewItemQuantityChange={setNewItemQuantity}
                    newItemUnit={newItemUnit}
                    onNewItemUnitChange={setNewItemUnit}
                    newItemPrice={newItemPrice}
                    onNewItemPriceChange={setNewItemPrice}
                    showAddForm={showAddItem}
                    onToggleAddForm={() => setShowAddItem(!showAddItem)}
                    error={errors.basket}
                    detectedCurrency={detectedCurrency}
                />
            ),
            validation: () => basketItems.length > 0,
        },
        {
            id: 'address',
            label: 'Adresse',
            icon: 'map-pin',
            component: (
                <DeliveryAddressStep
                    dropoffLocation={dropoffLocation}
                    onSelectLocation={() => setShowDropoffGPS(true)}
                    onSelectSavedAddress={handleDropoffAddressSelect}
                    onUseCurrentLocation={handleUseCurrentLocation}
                    loadingLocation={loadingLocation}
                    estimatedDistance={estimatedDistance}
                    error={errors.dropoff}
                />
            ),
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
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <SafeIcon name="shopping-cart" size={24} color="#FFFFFF" />
                            <View style={styles.headerText}>
                                <Text style={styles.headerTitle}>Courses supermarché</Text>
                                <Text style={styles.headerSubtitle}>Composez votre panier et suivez votre coursier</Text>
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

            {/* Modal GPS */}
            <ModernGPSModal
                visible={showDropoffGPS}
                onClose={() => setShowDropoffGPS(false)}
                onSelect={handleGPSSelect}
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
        color: '#D1FAE5',
        marginTop: 2,
    },
    closeButton: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
});

export default DeliveryShoppingFlowNew;


