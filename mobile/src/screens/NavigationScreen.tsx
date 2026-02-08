import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import * as Location from 'expo-location';
import { SafeNativeView } from '../components/SafeNativeView';
import { NativeCard, NativeButton } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { modernColors, modernStyles } from '../theme/modernTheme';
import { apiGet, apiPost } from '../services/api';

const { width } = Dimensions.get('window');

interface RouteOption {
    id: string;
    distance_meters: number;
    duration_seconds: number;
    duration_in_traffic_seconds?: number;
    summary: string;
    overview_polyline: string;
    steps: RouteStep[];
    traffic_level: 'low' | 'medium' | 'high';
    waypoints?: Array<{ lat: number; lng: number; name?: string }>;
}

interface RouteStep {
    instructions: string;
    distance_meters: number;
    duration_seconds: number;
    location: { lat: number; lng: number };
}

interface PointOfInterest {
    id: string;
    name: string;
    type: 'pharmacy' | 'bakery' | 'gas_station' | 'supermarket' | 'restaurant' | 'wine_shop' | 'entertainment';
    location: { lat: number; lng: number };
    distance_from_route_meters: number;
    rating?: number;
    is_open?: boolean;
}

interface NavigationStats {
    total_trips: number;
    total_distance_km: number;
    total_duration_minutes: number;
    most_visited_places: Array<{ name: string; visit_count: number }>;
    favorite_poi_types: Array<{ type: string; count: number }>;
}

const NavigationScreen: React.FC = () => {
    const { user } = useAuth();
    const { location: currentLocation } = useLocationSafe();
    
    const [destination, setDestination] = useState('');
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
    const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPOI, setLoadingPOI] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState<NavigationStats | null>(null);
    const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number; name: string }>>([]);
    
    // ✅ NOUVEAU: États pour autocomplete et destinations favorites
    const [autocompleteResults, setAutocompleteResults] = useState<Array<{
        description: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        is_saved?: boolean;
        label?: string;
        place_id?: string;
    }>>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [savedDestinations, setSavedDestinations] = useState<Array<{
        id: string;
        label: string;
        custom_label?: string;
        address: string;
        latitude: number;
        longitude: number;
    }>>([]);

    // Obtenir la position actuelle
    const getCurrentPosition = useCallback(async () => {
        try {
            if (currentLocation) {
                return {
                    lat: currentLocation.coords.latitude,
                    lng: currentLocation.coords.longitude
                };
            }
            
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation');
                return null;
            }

            const location = await Location.getCurrentPositionAsync({});
            return {
                lat: location.coords.latitude,
                lng: location.coords.longitude
            };
        } catch (error) {
            console.error('Erreur localisation:', error);
            return null;
        }
    }, [currentLocation]);

    // ✅ NOUVEAU: Charger les destinations favorites
    const loadSavedDestinations = useCallback(async () => {
        try {
            const response = await apiGet('/api/navigation/destinations');
            if (response?.data?.destinations) {
                setSavedDestinations(response.data.destinations);
            }
        } catch (error) {
            console.error('Erreur chargement destinations:', error);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadSavedDestinations();
        }
    }, [user, loadSavedDestinations]);

    // ✅ NOUVEAU: Autocomplete avec destinations favorites
    const handleAutocomplete = useCallback(async (query: string) => {
        if (query.length < 2) {
            setAutocompleteResults([]);
            setShowAutocomplete(false);
            return;
        }

        try {
            const response = await apiGet(`/api/navigation/autocomplete?query=${encodeURIComponent(query)}`);
            if (response?.data?.results) {
                setAutocompleteResults(response.data.results);
                setShowAutocomplete(true);
            }
        } catch (error) {
            console.error('Erreur autocomplete:', error);
        }
    }, []);

    // ✅ NOUVEAU: Vérifier si la destination est une destination favorite (domicile, bureau, etc.)
    const resolveDestination = useCallback(async (dest: string): Promise<{ lat: number; lng: number; address: string } | null> => {
        const destLower = dest.toLowerCase().trim();
        
        // Vérifier si c'est une destination favorite
        if (destLower === 'domicile' || destLower === 'bureau') {
            try {
                const response = await apiGet(`/api/navigation/destinations/${destLower}`);
                if (response?.data) {
                    return {
                        lat: response.data.latitude,
                        lng: response.data.longitude,
                        address: response.data.address
                    };
                }
            } catch (error) {
                console.error('Erreur récupération destination favorite:', error);
            }
        }

        // Sinon, géocoder normalement
        try {
            const response = await apiGet(`/api/navigation/geocode?address=${encodeURIComponent(dest)}`);
            if (response?.data?.location) {
                return {
                    lat: response.data.location.lat,
                    lng: response.data.location.lng,
                    address: response.data.formatted_address || dest
                };
            }
        } catch (error) {
            console.error('Erreur géocodage:', error);
        }
        
        return null;
    }, []);

    // Géocoder la destination (version améliorée)
    const geocodeDestination = useCallback(async (address: string) => {
        const resolved = await resolveDestination(address);
        if (resolved) {
            return { lat: resolved.lat, lng: resolved.lng };
        }
        return null;
    }, [resolveDestination]);

    // Rechercher les routes
    const searchRoutes = useCallback(async () => {
        if (!destination.trim()) {
            Alert.alert('Destination requise', 'Veuillez saisir une destination');
            return;
        }

        setLoading(true);
        try {
            const origin = await getCurrentPosition();
            if (!origin) {
                Alert.alert('Erreur', 'Impossible de déterminer votre position');
                setLoading(false);
                return;
            }

            // Géocoder la destination
            const destCoords = await geocodeDestination(destination);
            if (!destCoords) {
                Alert.alert('Erreur', 'Impossible de trouver cette destination');
                setLoading(false);
                return;
            }

            setDestinationCoords(destCoords);

            // Appeler l'API pour obtenir les routes multiples
            const response = await apiPost('/api/navigation/routes', {
                origin: { lat: origin.lat, lng: origin.lng },
                destination: { lat: destCoords.lat, lng: destCoords.lng },
                alternatives: true,
                avoid: [],
                traffic_model: 'best_guess'
            });

            if (response?.data?.routes) {
                setRoutes(response.data.routes);
                if (response.data.routes.length > 0) {
                    setSelectedRoute(response.data.routes[0]);
                    // Charger les points d'intérêt pour la première route
                    loadPointsOfInterest(response.data.routes[0]);
                }
            } else {
                Alert.alert('Erreur', 'Aucune route trouvée');
            }
        } catch (error: any) {
            console.error('Erreur recherche routes:', error);
            Alert.alert('Erreur', error?.message || 'Impossible de trouver des routes');
        } finally {
            setLoading(false);
        }
    }, [destination, getCurrentPosition, geocodeDestination]);

    // Charger les points d'intérêt le long d'une route (automatiquement via Google Places API)
    const loadPointsOfInterest = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) {
            setPointsOfInterest([]);
            return;
        }

        setLoadingPOI(true);
        setPointsOfInterest([]); // Réinitialiser pendant le chargement
        
        try {
            const origin = await getCurrentPosition();
            if (!origin) {
                setLoadingPOI(false);
                return;
            }

            // ✅ Appel automatique à l'API backend qui utilise Google Places Nearby Search
            const response = await apiGet(
                `/api/navigation/points-of-interest?route_id=${route.id}&origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}`
            );

            if (response?.data?.pois) {
                setPointsOfInterest(response.data.pois);
            } else {
                setPointsOfInterest([]);
            }
        } catch (error) {
            console.error('Erreur chargement POI:', error);
            // ✅ Ne pas afficher d'erreur à l'utilisateur, simplement ne pas afficher de POI
            setPointsOfInterest([]);
        } finally {
            setLoadingPOI(false);
        }
    }, [destinationCoords, getCurrentPosition]);

    // Démarrer la navigation
    const startNavigation = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) return;

        try {
            const origin = await getCurrentPosition();
            if (!origin) return;

            // Enregistrer le trajet pour les statistiques
            await apiPost('/api/navigation/trips', {
                origin,
                destination: destinationCoords,
                route_id: route.id,
                distance_meters: route.distance_meters,
                duration_seconds: route.duration_seconds,
                waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng }))
            });

            // Ouvrir Google Maps avec la navigation
            const waypointsStr = waypoints.length > 0
                ? `&waypoints=${waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')}`
                : '';
            
            const googleMapsUrl = Platform.select({
                ios: `maps://app?daddr=${destinationCoords.lat},${destinationCoords.lng}&dirflg=d${waypointsStr}`,
                android: `google.navigation:q=${destinationCoords.lat},${destinationCoords.lng}${waypointsStr}`,
                default: `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}${waypointsStr}`
            });

            const canOpen = await Linking.canOpenURL(googleMapsUrl || '');
            if (canOpen) {
                await Linking.openURL(googleMapsUrl || '');
            } else {
                // Fallback vers URL web
                const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}${waypointsStr}`;
                await Linking.openURL(webUrl);
            }
        } catch (error) {
            console.error('Erreur navigation:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir la navigation');
        }
    }, [destinationCoords, waypoints, getCurrentPosition]);

    // Charger les statistiques
    const loadStats = useCallback(async () => {
        try {
        const response = await apiGet('/api/navigation/stats');
        if (response?.data) {
            setStats(response.data);
        }
    } catch (error) {
        console.error('Erreur chargement stats:', error);
    }
    }, []);

    useEffect(() => {
        if (showStats) {
            loadStats();
        }
    }, [showStats, loadStats]);

    // Formater la durée
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}min`;
        }
        return `${minutes}min`;
    };

    // Formater la distance
    const formatDistance = (meters: number) => {
        if (meters >= 1000) {
            return `${(meters / 1000).toFixed(1)} km`;
        }
        return `${Math.round(meters)} m`;
    };

    // Obtenir l'icône du type de POI
    const getPOIIcon = (type: string) => {
        const icons: Record<string, string> = {
            pharmacy: '💊',
            bakery: '🥖',
            gas_station: '⛽',
            supermarket: '🛒',
            restaurant: '🍽️',
            wine_shop: '🍷',
            entertainment: '🎮'
        };
        return icons[type] || '📍';
    };

    // ✅ NOUVEAU: Enregistrer une destination favorite
    const saveDestination = useCallback(async (label: string, customLabel?: string) => {
        if (!destinationCoords) return;

        try {
            const response = await apiPost('/api/navigation/destinations', {
                label,
                custom_label: customLabel,
                address: destination,
                latitude: destinationCoords.lat,
                longitude: destinationCoords.lng,
                place_id: null
            });

            if (response?.data) {
                Alert.alert('Succès', `Destination "${label}" enregistrée"`);
                loadSavedDestinations();
            }
        } catch (error: any) {
            console.error('Erreur sauvegarde destination:', error);
            Alert.alert('Erreur', error?.message || 'Impossible d\'enregistrer la destination');
        }
    }, [destinationCoords, destination, loadSavedDestinations]);

    // Obtenir le nom du type de POI
    const getPOIName = (type: string) => {
        const names: Record<string, string> = {
            pharmacy: 'Pharmacie',
            bakery: 'Boulangerie',
            gas_station: 'Station-service',
            supermarket: 'Supermarché',
            restaurant: 'Restaurant/Snack',
            wine_shop: 'Cave à vin',
            entertainment: 'Espace de loisir'
        };
        return names[type] || type;
    };

    // Obtenir la couleur du niveau de trafic
    const getTrafficColor = (level: string) => {
        switch (level) {
            case 'low':
                return '#10B981'; // Vert
            case 'medium':
                return '#F59E0B'; // Orange
            case 'high':
                return '#EF4444'; // Rouge
            default:
                return '#6B7280'; // Gris
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>🧭 Navigation Intelligente</Text>
                    <TouchableOpacity
                        style={styles.statsButton}
                        onPress={() => setShowStats(!showStats)}
                    >
                        <SafeIcon name="BarChart" size={20} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Statistiques */}
                {showStats && stats && (
                    <NativeCard style={styles.statsCard}>
                        <Text style={styles.statsTitle}>📊 Vos Statistiques</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{stats.total_trips}</Text>
                                <Text style={styles.statLabel}>Trajets</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{stats.total_distance_km.toFixed(1)} km</Text>
                                <Text style={styles.statLabel}>Distance totale</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{Math.round(stats.total_duration_minutes / 60)}h</Text>
                                <Text style={styles.statLabel}>Temps total</Text>
                            </View>
                        </View>
                        {stats.most_visited_places.length > 0 && (
                            <View style={styles.statsSection}>
                                <Text style={styles.statsSubtitle}>Lieux les plus visités</Text>
                                {stats.most_visited_places.slice(0, 3).map((place, idx) => (
                                    <Text key={idx} style={styles.statsText}>
                                        {idx + 1}. {place.name} ({place.visit_count}x)
                                    </Text>
                                ))}
                            </View>
                        )}
                    </NativeCard>
                )}

                {/* Saisie destination avec autocomplete */}
                <NativeCard style={styles.searchCard}>
                    <Text style={styles.label}>Destination</Text>
                    <View style={styles.searchRow}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Domicile, Bureau, ou adresse..."
                                value={destination}
                                onChangeText={(text) => {
                                    setDestination(text);
                                    handleAutocomplete(text);
                                }}
                                onFocus={() => {
                                    if (destination.length >= 2) {
                                        handleAutocomplete(destination);
                                    }
                                }}
                                onSubmitEditing={searchRoutes}
                            />
                            {/* ✅ Autocomplete dropdown */}
                            {showAutocomplete && autocompleteResults.length > 0 && (
                                <View style={styles.autocompleteContainer}>
                                    <FlatList
                                        data={autocompleteResults}
                                        keyExtractor={(item, index) => `${item.description}-${index}`}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={styles.autocompleteItem}
                                                onPress={() => {
                                                    if (item.is_saved && item.latitude && item.longitude) {
                                                        // Destination favorite
                                                        setDestination(item.description);
                                                        setDestinationCoords({
                                                            lat: item.latitude,
                                                            lng: item.longitude
                                                        });
                                                    } else {
                                                        // Résultat Google Places
                                                        setDestination(item.description);
                                                    }
                                                    setShowAutocomplete(false);
                                                }}
                                            >
                                                <Text style={styles.autocompleteText}>
                                                    {item.description}
                                                </Text>
                                                {item.is_saved && (
                                                    <SafeIcon name="Star" size={14} color="#FBBF24" />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                        style={styles.autocompleteList}
                                    />
                                </View>
                            )}
                        </View>
                        <NativeButton
                            variant="primary"
                            onPress={searchRoutes}
                            disabled={loading}
                            style={styles.searchButton}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <SafeIcon name="Search" size={20} color="white" />
                            )}
                        </NativeButton>
                    </View>
                    {/* ✅ Bouton pour enregistrer destination */}
                    {destinationCoords && (
                        <TouchableOpacity
                            style={styles.saveDestinationButton}
                            onPress={async () => {
                                // Ouvrir modal pour choisir le label (domicile, bureau, autre)
                                Alert.alert(
                                    'Enregistrer destination',
                                    'Choisissez un type',
                                    [
                                        { text: 'Domicile', onPress: () => saveDestination('domicile') },
                                        { text: 'Bureau', onPress: () => saveDestination('bureau') },
                                        { text: 'Autre', onPress: () => {
                                            // Utiliser un TextInput dans une Alert personnalisée
                                            // Pour simplifier, on demande juste le nom
                                            Alert.alert(
                                                'Autre destination',
                                                'Cette fonctionnalité sera disponible prochainement. Utilisez "domicile" ou "bureau" pour l\'instant.',
                                                [{ text: 'OK' }]
                                            );
                                        }},
                                        { text: 'Annuler', style: 'cancel' }
                                    ]
                                );
                            }}
                        >
                            <SafeIcon name="Bookmark" size={16} color={modernColors.primary} />
                            <Text style={styles.saveDestinationText}>Enregistrer cette destination</Text>
                        </TouchableOpacity>
                    )}
                </NativeCard>

                {/* Routes disponibles */}
                {routes.length > 0 && (
                    <View style={styles.routesSection}>
                        <Text style={styles.sectionTitle}>Routes disponibles</Text>
                        <FlatList
                            data={routes}
                            keyExtractor={(item) => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isSelected = selectedRoute?.id === item.id;
                                const trafficColor = getTrafficColor(item.traffic_level);
                                
                                return (
                                    <TouchableOpacity
                                        style={[
                                            styles.routeCard,
                                            isSelected && styles.routeCardSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedRoute(item);
                                            // ✅ Chargement automatique des POI via Google Places API
                                            loadPointsOfInterest(item);
                                        }}
                                    >
                                        <View style={styles.routeHeader}>
                                            <View style={[styles.trafficIndicator, { backgroundColor: trafficColor }]} />
                                            <Text style={styles.routeSummary} numberOfLines={1}>
                                                {item.summary}
                                            </Text>
                                        </View>
                                        <View style={styles.routeInfo}>
                                            <View style={styles.routeInfoItem}>
                                                <SafeIcon name="MapPin" size={14} color={modernColors.textSecondary} />
                                                <Text style={styles.routeInfoText}>
                                                    {formatDistance(item.distance_meters)}
                                                </Text>
                                            </View>
                                            <View style={styles.routeInfoItem}>
                                                <SafeIcon name="Clock" size={14} color={modernColors.textSecondary} />
                                                <Text style={styles.routeInfoText}>
                                                    {formatDuration(item.duration_in_traffic_seconds || item.duration_seconds)}
                                                </Text>
                                            </View>
                                        </View>
                                        {item.duration_in_traffic_seconds && item.duration_in_traffic_seconds > item.duration_seconds && (
                                            <Text style={styles.trafficWarning}>
                                                +{formatDuration(item.duration_in_traffic_seconds - item.duration_seconds)} à cause du trafic
                                            </Text>
                                        )}
                                        {isSelected && (
                                            <View style={styles.selectedBadge}>
                                                <Text style={styles.selectedBadgeText}>✓ Sélectionné</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                )}

                {/* Points d'intérêt - Chargés automatiquement via Google Places API */}
                {selectedRoute && (
                    <NativeCard style={styles.poiCard}>
                        <View style={styles.poiHeader}>
                            <Text style={styles.sectionTitle}>Points d'intérêt sur le trajet</Text>
                            {loadingPOI && (
                                <ActivityIndicator size="small" color={modernColors.primary} />
                            )}
                        </View>
                        {loadingPOI && pointsOfInterest.length === 0 ? (
                            <View style={styles.poiLoading}>
                                <Text style={styles.poiLoadingText}>
                                    Recherche des points d'intérêt...
                                </Text>
                            </View>
                        ) : pointsOfInterest.length > 0 ? (
                            <FlatList
                                data={pointsOfInterest}
                                keyExtractor={(item) => item.id}
                                scrollEnabled={false}
                                renderItem={({ item }) => (
                                <View style={styles.poiItem}>
                                    <Text style={styles.poiIcon}>{getPOIIcon(item.type)}</Text>
                                    <View style={styles.poiInfo}>
                                        <Text style={styles.poiName}>{item.name}</Text>
                                        <Text style={styles.poiType}>{getPOIName(item.type)}</Text>
                                        <Text style={styles.poiDistance}>
                                            {formatDistance(item.distance_from_route_meters)} du trajet
                                        </Text>
                                    </View>
                                    {item.rating && (
                                        <View style={styles.poiRating}>
                                            <SafeIcon name="Star" size={14} color="#FBBF24" />
                                            <Text style={styles.poiRatingText}>{item.rating.toFixed(1)}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        />
                        ) : (
                            <View style={styles.poiEmpty}>
                                <Text style={styles.poiEmptyText}>
                                    Aucun point d'intérêt trouvé sur ce trajet
                                </Text>
                            </View>
                        )}
                    </NativeCard>
                )}

                {/* Bouton démarrer navigation */}
                {selectedRoute && (
                    <NativeButton
                        variant="primary"
                        onPress={() => startNavigation(selectedRoute)}
                        style={styles.navigateButton}
                    >
                        <SafeIcon name="Navigation" size={20} color="white" />
                        <Text style={styles.navigateButtonText}>Démarrer la navigation</Text>
                    </NativeButton>
                )}
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: modernStyles.spacing.lg,
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: modernStyles.spacing.lg,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    statsButton: {
        padding: 8,
    },
    statsCard: {
        marginBottom: modernStyles.spacing.lg,
    },
    statsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: modernStyles.spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: modernStyles.spacing.md,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    statsSection: {
        marginTop: modernStyles.spacing.md,
        paddingTop: modernStyles.spacing.md,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    statsSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: modernStyles.spacing.sm,
    },
    statsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    searchCard: {
        marginBottom: modernStyles.spacing.lg,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: modernStyles.spacing.sm,
    },
    searchRow: {
        flexDirection: 'row',
        gap: modernStyles.spacing.sm,
    },
    inputContainer: {
        flex: 1,
        position: 'relative',
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.medium,
        paddingHorizontal: modernStyles.spacing.md,
        paddingVertical: modernStyles.spacing.sm,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    autocompleteContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: 'white',
        borderRadius: modernStyles.borderRadius.medium,
        borderWidth: 1,
        borderColor: modernColors.border,
        maxHeight: 200,
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    autocompleteList: {
        maxHeight: 200,
    },
    autocompleteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: modernStyles.spacing.md,
        paddingVertical: modernStyles.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    autocompleteText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    saveDestinationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: modernStyles.spacing.xs,
        marginTop: modernStyles.spacing.sm,
        paddingVertical: modernStyles.spacing.xs,
    },
    saveDestinationText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    searchButton: {
        paddingHorizontal: modernStyles.spacing.md,
        minWidth: 50,
    },
    routesSection: {
        marginBottom: modernStyles.spacing.lg,
    },
    sectionHeader: {
        marginBottom: modernStyles.spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    routeCard: {
        width: width * 0.75,
        backgroundColor: modernColors.surface,
        borderRadius: modernStyles.borderRadius.medium,
        padding: modernStyles.spacing.md,
        marginRight: modernStyles.spacing.md,
        borderWidth: 2,
        borderColor: modernColors.border,
    },
    routeCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primaryLight || modernColors.surface,
    },
    routeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: modernStyles.spacing.sm,
    },
    trafficIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: modernStyles.spacing.sm,
    },
    routeSummary: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    routeInfo: {
        flexDirection: 'row',
        gap: modernStyles.spacing.md,
        marginBottom: modernStyles.spacing.xs,
    },
    routeInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    routeInfoText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    trafficWarning: {
        fontSize: 11,
        color: '#EF4444',
        fontStyle: 'italic',
        marginTop: 4,
    },
    selectedBadge: {
        marginTop: modernStyles.spacing.sm,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: modernColors.primary,
        borderRadius: modernStyles.borderRadius.small,
        alignSelf: 'flex-start',
    },
    selectedBadgeText: {
        fontSize: 11,
        color: 'white',
        fontWeight: '600',
    },
    poiCard: {
        marginBottom: modernStyles.spacing.lg,
    },
    poiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: modernStyles.spacing.md,
    },
    poiLoading: {
        padding: modernStyles.spacing.lg,
        alignItems: 'center',
    },
    poiLoadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    poiEmpty: {
        padding: modernStyles.spacing.lg,
        alignItems: 'center',
    },
    poiEmptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    poiItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: modernStyles.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    poiIcon: {
        fontSize: 24,
        marginRight: modernStyles.spacing.md,
    },
    poiInfo: {
        flex: 1,
    },
    poiName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    poiType: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    poiDistance: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    poiRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    poiRatingText: {
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '600',
    },
    navigateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: modernStyles.spacing.sm,
        paddingVertical: modernStyles.spacing.md,
        marginTop: modernStyles.spacing.lg,
    },
    navigateButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
});

export default NavigationScreen;

