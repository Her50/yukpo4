import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Linking,
    Modal,
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

    // ✅ NOUVEAU: Autocomplete avec destinations favorites et Google Places
    const handleAutocomplete = useCallback(async (query: string) => {
        if (query.length < 2) {
            setAutocompleteResults([]);
            setShowAutocomplete(false);
            return;
        }

        const results: Array<{
            description: string;
            address?: string;
            latitude?: number;
            longitude?: number;
            is_saved?: boolean;
            label?: string;
            place_id?: string;
        }> = [];

        // 1. Vérifier les destinations favorites (domicile, bureau)
        const destLower = query.toLowerCase().trim();
        if (destLower.includes('domicile') || destLower.includes('maison') || destLower.includes('home')) {
            const saved = savedDestinations.find(d => d.label === 'domicile');
            if (saved) {
                results.push({
                    description: saved.custom_label || 'Domicile',
                    address: saved.address,
                    latitude: saved.latitude,
                    longitude: saved.longitude,
                    is_saved: true,
                    label: 'domicile'
                });
            }
        }
        if (destLower.includes('bureau') || destLower.includes('office') || destLower.includes('travail')) {
            const saved = savedDestinations.find(d => d.label === 'bureau');
            if (saved) {
                results.push({
                    description: saved.custom_label || 'Bureau',
                    address: saved.address,
                    latitude: saved.latitude,
                    longitude: saved.longitude,
                    is_saved: true,
                    label: 'bureau'
                });
            }
        }

        // 2. Appeler l'API backend pour Google Places Autocomplete
        try {
            const origin = await getCurrentPosition();
            let url = `/api/navigation/autocomplete?query=${encodeURIComponent(query)}`;
            if (origin) {
                url += `&lat=${origin.lat}&lng=${origin.lng}`;
            }
            
            const response = await apiGet(url);
            if (response?.data?.results) {
                // Ajouter les résultats Google Places
                const googleResults = response.data.results.map((r: any) => ({
                    description: r.description || r.formatted_address || '',
                    address: r.formatted_address,
                    place_id: r.place_id,
                    latitude: r.location?.lat,
                    longitude: r.location?.lng,
                    is_saved: false
                }));
                results.push(...googleResults);
            }
        } catch (error) {
            console.error('Erreur autocomplete Google Places:', error);
            // Fallback: utiliser l'endpoint places standard
            try {
                const response = await apiGet(`/api/places/autocomplete?query=${encodeURIComponent(query)}`);
                if (response?.data?.results) {
                    const placesResults = response.data.results.map((r: any) => ({
                        description: r.description || '',
                        place_id: r.place_id,
                        is_saved: false
                    }));
                    results.push(...placesResults);
                }
            } catch (fallbackError) {
                console.error('Erreur autocomplete fallback:', fallbackError);
            }
        }

        setAutocompleteResults(results);
        setShowAutocomplete(results.length > 0);
    }, [savedDestinations, getCurrentPosition]);

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

                {/* ✅ NOUVEAU: Suggestions rapides */}
                {savedDestinations.length > 0 && destination.length === 0 && (
                    <NativeCard style={styles.quickSuggestionsCard}>
                        <Text style={styles.quickSuggestionsTitle}>📍 Destinations favorites</Text>
                        <View style={styles.quickSuggestionsRow}>
                            {savedDestinations.slice(0, 3).map((dest) => (
                                <TouchableOpacity
                                    key={dest.id}
                                    style={styles.quickSuggestionButton}
                                    onPress={() => {
                                        setDestination(dest.custom_label || dest.label);
                                        setDestinationCoords({
                                            lat: dest.latitude,
                                            lng: dest.longitude
                                        });
                                    }}
                                >
                                    <SafeIcon 
                                        name={dest.label === 'domicile' ? 'Home' : dest.label === 'bureau' ? 'Briefcase' : 'MapPin'} 
                                        size={16} 
                                        color={modernColors.primary} 
                                    />
                                    <Text style={styles.quickSuggestionText} numberOfLines={1}>
                                        {dest.custom_label || (dest.label === 'domicile' ? 'Domicile' : dest.label === 'bureau' ? 'Bureau' : dest.label)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </NativeCard>
                )}

                {/* Saisie destination avec autocomplete amélioré */}
                <NativeCard style={styles.searchCard}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>🔍 Recherche intelligente</Text>
                        {autocompleteResults.length > 0 && (
                            <Text style={styles.autocompleteHint}>
                                {autocompleteResults.filter(r => !r.is_saved).length > 0 && '🔍 Google Places'}
                            </Text>
                        )}
                    </View>
                    <View style={styles.searchRow}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Tapez une adresse, lieu, ou destination..."
                                value={destination}
                                onChangeText={(text) => {
                                    setDestination(text);
                                    if (text.length >= 2) {
                                        handleAutocomplete(text);
                                    } else {
                                        setShowAutocomplete(false);
                                        setAutocompleteResults([]);
                                    }
                                }}
                                onFocus={() => {
                                    if (destination.length >= 2) {
                                        handleAutocomplete(destination);
                                    } else if (savedDestinations.length > 0) {
                                        // Afficher les destinations favorites si le champ est vide
                                        const savedResults = savedDestinations.map(dest => ({
                                            description: dest.custom_label || (dest.label === 'domicile' ? '🏠 Domicile' : dest.label === 'bureau' ? '💼 Bureau' : `📍 ${dest.label}`),
                                            address: dest.address,
                                            latitude: dest.latitude,
                                            longitude: dest.longitude,
                                            is_saved: true,
                                            label: dest.label
                                        }));
                                        setAutocompleteResults(savedResults);
                                        setShowAutocomplete(savedResults.length > 0);
                                    }
                                }}
                                onBlur={() => {
                                    // Délai pour permettre le clic sur un résultat
                                    setTimeout(() => {
                                        setShowAutocomplete(false);
                                    }, 200);
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
                                                onPress={async () => {
                                                    if (item.is_saved && item.latitude && item.longitude) {
                                                        // Destination favorite
                                                        setDestination(item.description.replace(/^[🏠💼📍]\s*/, ''));
                                                        setDestinationCoords({
                                                            lat: item.latitude,
                                                            lng: item.longitude
                                                        });
                                                        setShowAutocomplete(false);
                                                        // Rechercher automatiquement les routes
                                                        setTimeout(() => {
                                                            searchRoutes();
                                                        }, 100);
                                                    } else if (item.place_id) {
                                                        // Résultat Google Places - récupérer les coordonnées
                                                        try {
                                                            const response = await apiGet(`/api/navigation/place-details?place_id=${encodeURIComponent(item.place_id)}`);
                                                            if (response?.data?.location) {
                                                                setDestination(item.description);
                                                                setDestinationCoords({
                                                                    lat: response.data.location.lat,
                                                                    lng: response.data.location.lng
                                                                });
                                                                setShowAutocomplete(false);
                                                                // Rechercher automatiquement les routes
                                                                setTimeout(() => {
                                                                    searchRoutes();
                                                                }, 100);
                                                            } else {
                                                                // Fallback: utiliser la description et géocoder
                                                                setDestination(item.description);
                                                                setShowAutocomplete(false);
                                                            }
                                                        } catch (error) {
                                                            console.error('Erreur récupération place details:', error);
                                                            // Fallback: utiliser la description et géocoder
                                                            setDestination(item.description);
                                                            setShowAutocomplete(false);
                                                        }
                                                    } else {
                                                        // Pas de place_id, utiliser la description
                                                        setDestination(item.description);
                                                        setShowAutocomplete(false);
                                                    }
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.autocompleteItemContent}>
                                                    {item.is_saved && (
                                                        <SafeIcon name="Star" size={16} color="#FBBF24" />
                                                    )}
                                                    {!item.is_saved && (
                                                        <SafeIcon name="MapPin" size={16} color={modernColors.primary} />
                                                    )}
                                                    <View style={styles.autocompleteTextContainer}>
                                                        <Text style={styles.autocompleteText} numberOfLines={2}>
                                                            {item.description}
                                                        </Text>
                                                        {item.address && item.address !== item.description && (
                                                            <Text style={styles.autocompleteAddress} numberOfLines={1}>
                                                                {item.address}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                        style={styles.autocompleteList}
                                        keyboardShouldPersistTaps="handled"
                                    />
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.searchButton,
                                loading && styles.searchButtonDisabled
                            ]}
                            onPress={searchRoutes}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <>
                                    <ActivityIndicator color="white" size="small" />
                                    <Text style={styles.searchButtonText}>Recherche...</Text>
                                </>
                            ) : (
                                <>
                                    <SafeIcon name="Search" size={20} color="white" />
                                    <Text style={styles.searchButtonText}>Rechercher</Text>
                                </>
                            )}
                        </TouchableOpacity>
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
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: modernStyles.spacing.sm,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    autocompleteHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    quickSuggestionsCard: {
        marginBottom: modernStyles.spacing.md,
        padding: modernStyles.spacing.md,
    },
    quickSuggestionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: modernStyles.spacing.sm,
    },
    quickSuggestionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: modernStyles.spacing.sm,
    },
    quickSuggestionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: modernStyles.spacing.md,
        paddingVertical: modernStyles.spacing.sm,
        borderRadius: modernStyles.borderRadius.medium,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        flex: 1,
        minWidth: 100,
    },
    quickSuggestionText: {
        fontSize: 13,
        color: modernColors.text,
        fontWeight: '500',
        flex: 1,
    },
    searchRow: {
        flexDirection: 'row',
        gap: modernStyles.spacing.sm,
    },
    inputContainer: {
        flex: 1,
        position: 'relative',
        zIndex: 1,
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
        maxHeight: 250,
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    autocompleteList: {
        maxHeight: 250,
    },
    autocompleteItem: {
        paddingHorizontal: modernStyles.spacing.md,
        paddingVertical: modernStyles.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    autocompleteItemContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: modernStyles.spacing.sm,
    },
    autocompleteTextContainer: {
        flex: 1,
    },
    autocompleteText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    autocompleteAddress: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: modernStyles.spacing.sm,
        paddingHorizontal: modernStyles.spacing.lg,
        paddingVertical: modernStyles.spacing.md,
        minWidth: 120,
        backgroundColor: modernColors.primary,
        borderRadius: modernStyles.borderRadius.medium,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    searchButtonDisabled: {
        opacity: 0.6,
    },
    searchButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
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

