import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { VEHICLE_TRANSPORT_OPTIONS } from '../../config/deliveryConfig';
import { useLocation } from '../../contexts/LocationContext';
import { CreateDeliveryRequestPayload, deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface DeliveryShoppingFlowProps {
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
    website?: string; // URL du site e-commerce du supermarché
}

interface BasketItem {
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    estimatedPrice?: number;
}

const DeliveryShoppingFlow: React.FC<DeliveryShoppingFlowProps> = ({
    visible,
    onClose,
    onSuccess,
}) => {
    const { location: userLocation } = useLocation();
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);

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

    // État supermarché
    const [selectedSupermarket, setSelectedSupermarket] = useState<Supermarket | null>(null);
    const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
    const [loadingSupermarkets, setLoadingSupermarkets] = useState(false);
    const [showSupermarketList, setShowSupermarketList] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');

    // État panier
    const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('1');
    const [newItemUnit, setNewItemUnit] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [showAddItem, setShowAddItem] = useState(false);

    // État locations
    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
    const [showDropoffGPS, setShowDropoffGPS] = useState(false);

    // Notes
    const [notes, setNotes] = useState('');

    // ✅ NOUVEAU : Type de véhicule préféré
    const [preferredVehicleType, setPreferredVehicleType] = useState<string | null>(null);

    // Charger GPS utilisateur et supermarchés au montage
    useEffect(() => {
        if (visible) {
            loadSupermarkets();
            if (userLocation) {
                const coords: LocationData = {
                    latitude: userLocation.coords.latitude,
                    longitude: userLocation.coords.longitude,
                    address: '',
                };
                setDropoffLocation(coords);
            }
        }
    }, [visible, userLocation]);

    // Réinitialiser le formulaire à la fermeture
    useEffect(() => {
        if (!visible) {
            setSelectedSupermarket(null);
            setBasketItems([]);
            setPickupLocation(null);
            setDropoffLocation(null);
            setNotes('');
            setNewItemName('');
            setNewItemQuantity('1');
            setNewItemUnit('');
            setNewItemPrice('');
            setShowAddItem(false);
            setShowSupermarketList(false);
        }
    }, [visible]);

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

    // Filtrer et trier les supermarchés
    const filteredAndSortedSupermarkets = React.useMemo(() => {
        let filtered = supermarkets;

        // Filtrer par recherche
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (sm) =>
                    sm.name.toLowerCase().includes(query) ||
                    sm.address.toLowerCase().includes(query)
            );
        }

        // Trier
        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'distance') {
                const distA = a.distance_km ?? Infinity;
                const distB = b.distance_km ?? Infinity;
                return distA - distB;
            } else {
                return a.name.localeCompare(b.name);
            }
        });

        return sorted;
    }, [supermarkets, searchQuery, sortBy]);

    const loadSupermarkets = async () => {
        setLoadingSupermarkets(true);
        try {
            // Obtenir la position de l'utilisateur
            let userLat = 4.0511; // Douala par défaut
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
                    console.warn('Géolocalisation non disponible, utilisation des coordonnées par défaut');
                }
            }

            // Appeler l'API avec cache
            const result = await deliveryApi.listSupermarkets(userLat, userLng, 10);

            if (result.supermarkets && result.supermarkets.length > 0) {
                // ✅ Amélioré : Calculer les distances pour chaque supermarché
                const supermarketsWithDistance = result.supermarkets.map((sm: any) => {
                    if (!sm.distance_km && sm.latitude && sm.longitude) {
                        const distance = calculateDistance(userLat, userLng, sm.latitude, sm.longitude);
                        return { ...sm, distance_km: Math.round(distance * 10) / 10 };
                    }
                    return sm;
                });
                setSupermarkets(supermarketsWithDistance);
            } else {
                // ✅ Amélioré : Aucun supermarché trouvé - message informatif
                console.warn('[DeliveryShoppingFlow] Aucun supermarché trouvé dans la base de données');
                setSupermarkets([]);
                Alert.alert(
                    'Aucun supermarché trouvé',
                    'Aucun supermarché n\'a été trouvé près de votre position. Veuillez essayer d\'élargir votre recherche ou vérifier votre connexion.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Erreur chargement supermarchés:', error);
            Alert.alert(
                'Erreur',
                'Impossible de charger la liste des supermarchés. Vérifiez votre connexion internet.',
                [{ text: 'OK' }]
            );
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

            setDropoffLocation(coords);
            setErrors(prev => ({ ...prev, dropoff: '' }));
        } catch (error) {
            console.error('Erreur géolocalisation:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir votre position. Vérifiez que le GPS est activé.');
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

        // Géocodage inverse pour obtenir l'adresse
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

    const addBasketItem = () => {
        const newErrors: Record<string, string> = {};

        if (!newItemName.trim()) {
            newErrors.itemName = 'Le nom du produit est requis';
        }

        if (newItemQuantity && (parseInt(newItemQuantity) <= 0 || isNaN(parseInt(newItemQuantity)))) {
            newErrors.itemQuantity = 'La quantité doit être supérieure à 0';
        }

        if (newItemPrice && (parseFloat(newItemPrice) < 0 || isNaN(parseFloat(newItemPrice)))) {
            newErrors.itemPrice = 'Le prix ne peut pas être négatif';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(prev => ({ ...prev, ...newErrors }));
            return;
        }

        const item: BasketItem = {
            id: Date.now().toString(),
            name: newItemName.trim(),
            quantity: parseInt(newItemQuantity) || 1,
            unit: newItemUnit.trim() || undefined,
            estimatedPrice: newItemPrice ? parseFloat(newItemPrice) : undefined,
        };

        setBasketItems([...basketItems, item]);
        setNewItemName('');
        setNewItemQuantity('1');
        setNewItemUnit('');
        setNewItemPrice('');
        setShowAddItem(false);
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.itemName;
            delete newErrors.itemQuantity;
            delete newErrors.itemPrice;
            return newErrors;
        });
    };

    const removeBasketItem = (id: string) => {
        setBasketItems(basketItems.filter((item) => item.id !== id));
    };

    const calculateBasketTotal = () => {
        return basketItems.reduce((total, item) => {
            return total + (item.estimatedPrice || 0) * item.quantity;
        }, 0);
    };

    const handleSubmit = async () => {
        // Validation complète
        const newErrors: Record<string, string> = {};

        if (!selectedSupermarket) {
            newErrors.supermarket = 'Veuillez sélectionner un supermarché';
        }

        if (basketItems.length === 0) {
            newErrors.basket = 'Veuillez ajouter au moins un article au panier';
        }

        if (!dropoffLocation) {
            newErrors.dropoff = 'Veuillez sélectionner une adresse de livraison';
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
            const basketTotal = calculateBasketTotal();

            // Construire le payload
            const payload: CreateDeliveryRequestPayload = {
                preferred_vehicle_type: preferredVehicleType || undefined,
                parcel: {
                    type_id: 1, // Type shopping
                    notes: notes || `Courses supermarché: ${selectedSupermarket.name}`,
                    // ✅ CORRIGÉ : photos et constraints doivent être présents (même vides)
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
                // ✅ CORRIGÉ : Ajouter initial_event_payload par défaut
                initial_event_payload: {},
            };

            const result = await deliveryApi.createDeliveryRequest(payload);

            if (result.success && result.data?.id) {
                Alert.alert(
                    'Commande créée',
                    'Votre commande de courses a été créée avec succès. Le matching des coursiers est en cours.',
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
            Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de la création de la commande');
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

                    {/* Content */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Sélection supermarché */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="store" size={18} color={modernColors.success} />
                                <Text style={styles.sectionTitle}>Sélectionner un supermarché *</Text>
                                {supermarkets.length > 0 && (
                                    <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>
                                        {filteredAndSortedSupermarkets.length} résultat(s)
                                    </Text>
                                )}
                            </View>

                            {/* Filtres et recherche */}
                            {supermarkets.length > 0 && (
                                <View style={{ marginBottom: 12, gap: 8 }}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Rechercher un supermarché..."
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholderTextColor={modernColors.textSecondary}
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            style={[
                                                styles.filterButton,
                                                sortBy === 'distance' && styles.filterButtonActive
                                            ]}
                                            onPress={() => setSortBy('distance')}
                                        >
                                            <Text style={[
                                                styles.filterButtonText,
                                                sortBy === 'distance' && styles.filterButtonTextActive
                                            ]}>
                                                Par distance
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.filterButton,
                                                sortBy === 'name' && styles.filterButtonActive
                                            ]}
                                            onPress={() => setSortBy('name')}
                                        >
                                            <Text style={[
                                                styles.filterButtonText,
                                                sortBy === 'name' && styles.filterButtonTextActive
                                            ]}>
                                                Par nom
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                            {selectedSupermarket ? (
                                <View style={[styles.locationCard, errors.supermarket && styles.locationCardError]}>
                                    <Text style={styles.supermarketName}>{selectedSupermarket.name}</Text>
                                    <Text style={styles.locationText}>{selectedSupermarket.address}</Text>
                                    {selectedSupermarket.distance_km && (
                                        <Text style={styles.distanceText}>
                                            À {selectedSupermarket.distance_km.toFixed(1)} km
                                        </Text>
                                    )}
                                    {selectedSupermarket.website && (
                                        <TouchableOpacity
                                            style={styles.websiteButton}
                                            onPress={async () => {
                                                try {
                                                    const url = selectedSupermarket.website!.startsWith('http')
                                                        ? selectedSupermarket.website!
                                                        : `https://${selectedSupermarket.website}`;
                                                    const supported = await Linking.canOpenURL(url);
                                                    if (supported) {
                                                        await Linking.openURL(url);
                                                        Alert.alert(
                                                            'Redirection',
                                                            'Vous allez être redirigé vers la plateforme du supermarché. Une fois votre commande finalisée, revenez ici pour activer la livraison Yukpo.',
                                                            [{ text: 'OK' }]
                                                        );
                                                    } else {
                                                        Alert.alert('Erreur', 'Impossible d\'ouvrir ce lien');
                                                    }
                                                } catch (error) {
                                                    console.error('Erreur ouverture URL:', error);
                                                    Alert.alert('Erreur', 'Impossible d\'ouvrir le site web du supermarché');
                                                }
                                            }}
                                        >
                                            <SafeIcon name="external-link" size={16} color={modernColors.primary} />
                                            <Text style={styles.websiteButtonText}>Acheter sur le site du supermarché</Text>
                                        </TouchableOpacity>
                                    )}
                                    <View style={styles.supermarketActions}>
                                        <TouchableOpacity
                                            style={[styles.modifyButton, { flex: 1 }]}
                                            onPress={() => {
                                                setSelectedSupermarket(null);
                                                setPickupLocation(null);
                                                setErrors(prev => ({ ...prev, supermarket: '' }));
                                            }}
                                        >
                                            <Text style={styles.modifyButtonText}>Changer</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    {loadingSupermarkets ? (
                                        <View style={styles.loadingContainer}>
                                            <Text style={styles.loadingText}>Chargement des supermarchés...</Text>
                                        </View>
                                    ) : (
                                        <View>
                                            {filteredAndSortedSupermarkets.length === 0 ? (
                                                <View style={styles.emptyContainer}>
                                                    <Text style={styles.emptyText}>
                                                        {searchQuery ? 'Aucun supermarché trouvé pour votre recherche' : 'Aucun supermarché disponible'}
                                                    </Text>
                                                </View>
                                            ) : (
                                                filteredAndSortedSupermarkets.map((supermarket) => (
                                                    <TouchableOpacity
                                                        key={supermarket.id}
                                                        style={styles.supermarketCard}
                                                        onPress={() => setSelectedSupermarket(supermarket)}
                                                    >
                                                        <View style={styles.supermarketInfo}>
                                                            <Text style={styles.supermarketName}>{supermarket.name}</Text>
                                                            <Text style={styles.locationText}>{supermarket.address}</Text>
                                                            {supermarket.distance_km && (
                                                                <Text style={styles.distanceText}>
                                                                    À {supermarket.distance_km.toFixed(1)} km
                                                                </Text>
                                                            )}
                                                            {supermarket.website && (
                                                                <View style={styles.websiteBadge}>
                                                                    <SafeIcon name="globe" size={12} color={modernColors.success} />
                                                                    <Text style={styles.websiteBadgeText}>Site e-commerce disponible</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                            {errors.supermarket ? (
                                <Text style={styles.errorText}>{errors.supermarket}</Text>
                            ) : null}
                        </View>

                        {/* Panier */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="shopping-bag" size={18} color={modernColors.primary} />
                                <Text style={styles.sectionTitle}>Panier *</Text>
                                {!showAddItem && (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => setShowAddItem(true)}
                                    >
                                        <SafeIcon name="plus" size={16} color={modernColors.primary} />
                                        <Text style={styles.addButtonText}>Ajouter</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {selectedSupermarket && selectedSupermarket.website && basketItems.length === 0 && (
                                <View style={styles.infoBox}>
                                    <SafeIcon name="info" size={16} color={modernColors.accent} />
                                    <Text style={styles.infoText}>
                                        Vous pouvez acheter directement sur le site du supermarché (bouton ci-dessus), puis revenir ici pour activer la livraison Yukpo. Vous pouvez aussi ajouter manuellement vos articles ci-dessous.
                                    </Text>
                                </View>
                            )}

                            {showAddItem ? (
                                <View style={styles.addItemForm}>
                                    <View>
                                        <TextInput
                                            style={[styles.input, errors.itemName && styles.inputError]}
                                            placeholder="Nom du produit *"
                                            value={newItemName}
                                            onChangeText={(text) => {
                                                setNewItemName(text);
                                                setErrors(prev => ({ ...prev, itemName: text.trim() ? '' : 'Le nom est requis' }));
                                            }}
                                        />
                                        {errors.itemName ? (
                                            <Text style={styles.errorText}>{errors.itemName}</Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.formGrid}>
                                        <View style={styles.formItem}>
                                            <TextInput
                                                style={[styles.input, errors.itemQuantity && styles.inputError]}
                                                placeholder="Quantité"
                                                value={newItemQuantity}
                                                onChangeText={(text) => {
                                                    setNewItemQuantity(text);
                                                    if (text && (parseInt(text) <= 0 || isNaN(parseInt(text)))) {
                                                        setErrors(prev => ({ ...prev, itemQuantity: 'Quantité invalide' }));
                                                    } else {
                                                        setErrors(prev => ({ ...prev, itemQuantity: '' }));
                                                    }
                                                }}
                                                keyboardType="numeric"
                                            />
                                            {errors.itemQuantity ? (
                                                <Text style={styles.errorText}>{errors.itemQuantity}</Text>
                                            ) : null}
                                        </View>
                                        <View style={styles.formItem}>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Unité (kg, L, etc.)"
                                                value={newItemUnit}
                                                onChangeText={setNewItemUnit}
                                            />
                                        </View>
                                    </View>
                                    <View>
                                        <TextInput
                                            style={[styles.input, errors.itemPrice && styles.inputError]}
                                            placeholder="Prix estimé (FCFA)"
                                            value={newItemPrice}
                                            onChangeText={(text) => {
                                                setNewItemPrice(text);
                                                if (text && (parseFloat(text) < 0 || isNaN(parseFloat(text)))) {
                                                    setErrors(prev => ({ ...prev, itemPrice: 'Prix invalide' }));
                                                } else {
                                                    setErrors(prev => ({ ...prev, itemPrice: '' }));
                                                }
                                            }}
                                            keyboardType="numeric"
                                        />
                                        {errors.itemPrice ? (
                                            <Text style={styles.errorText}>{errors.itemPrice}</Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.addItemActions}>
                                        <TouchableOpacity
                                            style={[styles.button, styles.cancelButton]}
                                            onPress={() => {
                                                setShowAddItem(false);
                                                setNewItemName('');
                                                setNewItemQuantity('1');
                                                setNewItemUnit('');
                                                setNewItemPrice('');
                                            }}
                                        >
                                            <Text style={styles.cancelButtonText}>Annuler</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.button, styles.addItemButton]}
                                            onPress={addBasketItem}
                                        >
                                            <Text style={styles.addItemButtonText}>Ajouter</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}

                            {errors.basket ? (
                                <Text style={styles.errorText}>{errors.basket}</Text>
                            ) : null}
                            {basketItems.length === 0 ? (
                                <View style={styles.emptyBasket}>
                                    <SafeIcon name="shopping-bag" size={48} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyBasketText}>
                                        Votre panier est vide. Ajoutez des articles pour continuer.
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.basketList}>
                                    {basketItems.map((item) => (
                                        <View key={item.id} style={styles.basketItem}>
                                            <View style={styles.basketItemInfo}>
                                                <Text style={styles.basketItemName}>{item.name}</Text>
                                                <Text style={styles.basketItemDetails}>
                                                    {item.quantity} {item.unit || 'unité(s)'}
                                                    {item.estimatedPrice && ` • ${item.estimatedPrice.toLocaleString('fr-FR')} FCFA`}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.removeButton}
                                                onPress={() => removeBasketItem(item.id)}
                                            >
                                                <SafeIcon name="x" size={16} color="#DC2626" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <View style={styles.basketTotal}>
                                        <Text style={styles.basketTotalLabel}>Total estimé</Text>
                                        <Text style={styles.basketTotalValue}>
                                            {calculateBasketTotal().toLocaleString('fr-FR')} FCFA
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Point de collecte (automatique depuis supermarché) */}
                        {pickupLocation && (
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <SafeIcon name="map-pin" size={18} color={modernColors.success} />
                                    <Text style={styles.sectionTitle}>Point de collecte</Text>
                                </View>
                                <View style={styles.locationCard}>
                                    <Text style={styles.locationText}>
                                        {pickupLocation.address || selectedSupermarket?.address}
                                    </Text>
                                </View>
                            </View>
                        )}

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
                                        onPress={handleUseCurrentLocation}
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

                        {/* ✅ NOUVEAU : Type de véhicule préféré */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Type de transport souhaité (optionnel)</Text>
                            <Text style={styles.sectionSubtitle}>
                                Choisissez le type de véhicule pour votre livraison
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleTypeScroll}>
                                {VEHICLE_TRANSPORT_OPTIONS.map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        style={[
                                            styles.vehicleTypeOption,
                                            preferredVehicleType === type.value && styles.vehicleTypeOptionSelected,
                                        ]}
                                        onPress={() => setPreferredVehicleType(
                                            preferredVehicleType === type.value ? null : type.value
                                        )}
                                    >
                                        <Text style={styles.vehicleTypeIcon}>{type.icon}</Text>
                                        <Text
                                            style={[
                                                styles.vehicleTypeLabel,
                                                preferredVehicleType === type.value && styles.vehicleTypeLabelSelected,
                                            ]}
                                        >
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Notes */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Instructions (optionnel)</Text>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Ex: Produits frais uniquement, vérifier les dates..."
                                style={styles.notesInput}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />
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
                                (!selectedSupermarket || basketItems.length === 0 || !dropoffLocation || loading) &&
                                styles.submitButtonDisabled,
                            ]}
                            onPress={handleSubmit}
                            disabled={loading || !selectedSupermarket || basketItems.length === 0 || !dropoffLocation}
                        >
                            <Text style={styles.submitButtonText}>
                                {loading ? 'Création...' : 'Créer la commande'}
                            </Text>
                        </TouchableOpacity>
                    </View>
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
        flex: 1,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.primary,
    },
    locationCard: {
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
    },
    supermarketCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        marginBottom: 12,
    },
    supermarketInfo: {
        flex: 1,
    },
    supermarketName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 4,
    },
    distanceText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    modifyButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    modifyButtonText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '500',
    },
    supermarketActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    websiteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        marginTop: 8,
    },
    websiteButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.primary,
    },
    websiteBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    websiteBadgeText: {
        fontSize: 11,
        color: modernColors.success,
        fontWeight: '500',
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    addItemForm: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        marginBottom: 12,
    },
    formGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    formItem: {
        flex: 1,
    },
    input: {
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 12,
    },
    addItemActions: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    addItemButton: {
        backgroundColor: modernColors.primary,
    },
    addItemButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    emptyBasket: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    emptyBasketText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 12,
    },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterButtonText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    // ✅ NOUVEAU : Styles pour sélection type de véhicule
    vehicleTypeScroll: {
        marginTop: 12,
    },
    vehicleTypeOption: {
        alignItems: 'center',
        padding: 12,
        marginRight: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        minWidth: 80,
    },
    vehicleTypeOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '20',
    },
    vehicleTypeIcon: {
        fontSize: 32,
        marginBottom: 4,
    },
    vehicleTypeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    vehicleTypeLabelSelected: {
        color: modernColors.primary,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        marginBottom: 8,
    },
    basketList: {
        gap: 12,
    },
    basketItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    basketItemInfo: {
        flex: 1,
    },
    basketItemName: {
        fontSize: 16,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 4,
    },
    basketItemDetails: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    removeButton: {
        padding: 8,
    },
    basketTotal: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 12,
        marginTop: 8,
    },
    basketTotalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    basketTotalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.primary,
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
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    submitButton: {
        backgroundColor: modernColors.success,
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
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        marginBottom: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.text,
        lineHeight: 18,
    },
});

export default DeliveryShoppingFlow;

