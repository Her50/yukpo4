import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LocationSelector, { LocationObject } from '../components/LocationSelector';
import { NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Constantes POI ─────────────────────────────────────────────────────────
const POI_CATEGORIES: Record<string, { label: string; icon: string; color: string; types: string[] }> = {
    health: { label: 'Santé', icon: '🏥', color: '#EF4444', types: ['pharmacy'] },
    food: { label: 'Alimentation', icon: '🍞', color: '#F59E0B', types: ['bakery', 'supermarket', 'restaurant'] },
    fuel: { label: 'Carburant', icon: '⛽', color: '#3B82F6', types: ['gas_station'] },
    leisure: { label: 'Loisirs & Divers', icon: '🎭', color: '#8B5CF6', types: ['wine_shop', 'entertainment'] },
};

const POI_TYPE_LABELS: Record<string, string> = {
    pharmacy: 'Pharmacie',
    bakery: 'Boulangerie',
    gas_station: 'Station-service',
    supermarket: 'Supermarché',
    restaurant: 'Restaurant/Snack',
    wine_shop: 'Cave à vin',
    entertainment: 'Espace de loisir',
};

// ── Composant principal ────────────────────────────────────────────────────
const NavigationScreen: React.FC = () => {
    const { user } = useAuth();
    const { location: currentLocation } = useLocationSafe();

    // Destination
    const [destination, setDestination] = useState('');
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<LocationObject | null>(null);

    // Routes & POI
    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
    const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPOI, setLoadingPOI] = useState(false);

    // Stats
    const [showStats, setShowStats] = useState(false);
    const [stats, setStats] = useState<NavigationStats | null>(null);

    // Waypoints & préférences
    const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number; name: string }>>([]);
    const [avoidTolls, setAvoidTolls] = useState(false);
    const [avoidHighways, setAvoidHighways] = useState(false);
    const [avoidFerries, setAvoidFerries] = useState(false);

    // Favorites
    const [savedDestinations, setSavedDestinations] = useState<Array<{
        id: string; label: string; custom_label?: string; address: string; latitude: number; longitude: number;
    }>>([]);

    // UI état des blocs POI ouverts/fermés
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        health: true, food: false, fuel: false, leisure: false,
    });

    // ── POIs groupés par catégorie (mémorisé) ──
    const groupedPOIs = useMemo(() => {
        const groups: Record<string, PointOfInterest[]> = {};
        for (const [catKey, cat] of Object.entries(POI_CATEGORIES)) {
            groups[catKey] = pointsOfInterest.filter(poi => cat.types.includes(poi.type));
        }
        return groups;
    }, [pointsOfInterest]);

    // ── Helpers ────────────────────────────────────────────────────────────
    const getCurrentPosition = useCallback(async () => {
        try {
            if (currentLocation) {
                return { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude };
            }
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation');
                return null;
            }
            const location = await Location.getCurrentPositionAsync({});
            return { lat: location.coords.latitude, lng: location.coords.longitude };
        } catch (error) {
            console.error('Erreur localisation:', error);
            return null;
        }
    }, [currentLocation]);

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}` : `${minutes} min`;
    };

    const formatDistance = (meters: number) => {
        return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
    };

    const getTrafficColor = (level: string) => {
        switch (level) {
            case 'low': return '#10B981';
            case 'medium': return '#F59E0B';
            case 'high': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const getTrafficLabel = (level: string) => {
        switch (level) {
            case 'low': return 'Fluide';
            case 'medium': return 'Modéré';
            case 'high': return 'Dense';
            default: return '';
        }
    };

    // ── Destinations favorites ─────────────────────────────────────────────
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
        if (user) loadSavedDestinations();
    }, [user, loadSavedDestinations]);

    const resolveDestination = useCallback(async (dest: string): Promise<{ lat: number; lng: number; address: string } | null> => {
        const destLower = dest.toLowerCase().trim();
        if (destLower === 'domicile' || destLower === 'bureau') {
            try {
                const response = await apiGet(`/api/navigation/destinations/${destLower}`);
                if (response?.data) {
                    return { lat: response.data.latitude, lng: response.data.longitude, address: response.data.address };
                }
            } catch (error) {
                console.error('Erreur récupération destination favorite:', error);
            }
        }
        try {
            const response = await apiGet(`/api/navigation/geocode?address=${encodeURIComponent(dest)}`);
            if (response?.data?.location) {
                return { lat: response.data.location.lat, lng: response.data.location.lng, address: response.data.formatted_address || dest };
            }
        } catch (error) {
            console.error('Erreur géocodage:', error);
        }
        return null;
    }, []);

    const geocodeDestination = useCallback(async (address: string) => {
        const resolved = await resolveDestination(address);
        return resolved ? { lat: resolved.lat, lng: resolved.lng } : null;
    }, [resolveDestination]);

    // ── Recherche de routes ────────────────────────────────────────────────
    const searchRoutes = useCallback(async () => {
        let destCoords = destinationCoords;
        if (!destCoords && selectedLocation?.latitude && selectedLocation?.longitude) {
            destCoords = { lat: selectedLocation.latitude, lng: selectedLocation.longitude };
            setDestinationCoords(destCoords);
        }
        if (!destCoords && !destination.trim()) {
            Alert.alert('Destination requise', 'Veuillez sélectionner ou saisir une destination');
            return;
        }
        setLoading(true);
        try {
            const origin = await getCurrentPosition();
            if (!origin) { Alert.alert('Erreur', 'Impossible de déterminer votre position'); setLoading(false); return; }
            if (!destCoords) {
                destCoords = await geocodeDestination(destination);
                if (!destCoords) { Alert.alert('Erreur', 'Impossible de trouver cette destination'); setLoading(false); return; }
                setDestinationCoords(destCoords);
            }
            const avoidList: string[] = [];
            if (avoidTolls) avoidList.push('tolls');
            if (avoidHighways) avoidList.push('highways');
            if (avoidFerries) avoidList.push('ferries');

            const response = await apiPost('/api/navigation/routes', {
                origin: { lat: origin.lat, lng: origin.lng },
                destination: { lat: destCoords.lat, lng: destCoords.lng },
                alternatives: true,
                avoid: avoidList,
                traffic_model: 'best_guess',
                waypoints: waypoints.length > 0 ? waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })) : undefined,
            });
            if (response?.data?.routes) {
                setRoutes(response.data.routes);
                if (response.data.routes.length > 0) {
                    setSelectedRoute(response.data.routes[0]);
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
    }, [destination, destinationCoords, selectedLocation, getCurrentPosition, geocodeDestination, avoidTolls, avoidHighways, avoidFerries, waypoints]);

    // ── Points d'intérêt ────────────────────────────────────────────────
    const loadPointsOfInterest = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) { setPointsOfInterest([]); return; }
        setLoadingPOI(true);
        setPointsOfInterest([]);
        try {
            const origin = await getCurrentPosition();
            if (!origin) { setLoadingPOI(false); return; }
            const response = await apiGet(
                `/api/navigation/points-of-interest?route_id=${route.id}&origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}`
            );
            if (response?.data?.pois) {
                setPointsOfInterest(response.data.pois);
                // Ouvrir la première catégorie qui a des résultats
                const firstCatWithResults = Object.entries(POI_CATEGORIES).find(([key]) => {
                    const cat = POI_CATEGORIES[key];
                    return (response.data.pois as PointOfInterest[]).some((p: PointOfInterest) => cat.types.includes(p.type));
                });
                if (firstCatWithResults) {
                    setExpandedCategories(prev => {
                        const reset: Record<string, boolean> = {};
                        Object.keys(POI_CATEGORIES).forEach(k => reset[k] = false);
                        reset[firstCatWithResults[0]] = true;
                        return reset;
                    });
                }
            } else {
                setPointsOfInterest([]);
            }
        } catch (error) {
            console.error('Erreur chargement POI:', error);
            setPointsOfInterest([]);
        } finally {
            setLoadingPOI(false);
        }
    }, [destinationCoords, getCurrentPosition]);

    // ── Démarrer la navigation ────────────────────────────────────────────
    const startNavigation = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) return;
        try {
            const origin = await getCurrentPosition();
            if (!origin) return;
            await apiPost('/api/navigation/trips', {
                origin, destination: destinationCoords, route_id: route.id,
                distance_meters: route.distance_meters, duration_seconds: route.duration_seconds,
                waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
            });
            const waypointsStr = waypoints.length > 0
                ? `&waypoints=${waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')}` : '';
            const googleMapsUrl = Platform.select({
                ios: `maps://app?daddr=${destinationCoords.lat},${destinationCoords.lng}&dirflg=d${waypointsStr}`,
                android: `google.navigation:q=${destinationCoords.lat},${destinationCoords.lng}${waypointsStr}`,
                default: `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}${waypointsStr}`,
            });
            const canOpen = await Linking.canOpenURL(googleMapsUrl || '');
            if (canOpen) { await Linking.openURL(googleMapsUrl || ''); }
            else { await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}${waypointsStr}`); }
        } catch (error) {
            console.error('Erreur navigation:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir la navigation');
        }
    }, [destinationCoords, waypoints, getCurrentPosition]);

    // ── Stats ──────────────────────────────────────────────────────────────
    const loadStats = useCallback(async () => {
        try {
            const response = await apiGet('/api/navigation/stats');
            if (response?.data) setStats(response.data);
        } catch (error) { console.error('Erreur chargement stats:', error); }
    }, []);

    useEffect(() => { if (showStats) loadStats(); }, [showStats, loadStats]);

    // ── Enregistrer destination ────────────────────────────────────────────
    const saveDestination = useCallback(async (label: string, customLabel?: string) => {
        if (!destinationCoords) return;
        try {
            const response = await apiPost('/api/navigation/destinations', {
                label, custom_label: customLabel, address: destination,
                latitude: destinationCoords.lat, longitude: destinationCoords.lng, place_id: null,
            });
            if (response?.data) { Alert.alert('Succès', `Destination "${label}" enregistrée`); loadSavedDestinations(); }
        } catch (error: any) {
            console.error('Erreur sauvegarde destination:', error);
            Alert.alert('Erreur', error?.message || 'Impossible d\'enregistrer la destination');
        }
    }, [destinationCoords, destination, loadSavedDestinations]);

    // ── Ajouter un POI comme étape ────────────────────────────────────────
    const addWaypoint = useCallback((poi: PointOfInterest) => {
        if (waypoints.some(wp => wp.lat === poi.location.lat && wp.lng === poi.location.lng)) {
            Alert.alert('Déjà ajouté', 'Ce lieu est déjà dans vos étapes');
            return;
        }
        setWaypoints(prev => [...prev, { lat: poi.location.lat, lng: poi.location.lng, name: poi.name }]);
        Alert.alert('Étape ajoutée', `${poi.name} ajouté comme étape de votre trajet`);
    }, [waypoints]);

    const removeWaypoint = useCallback((index: number) => {
        setWaypoints(prev => prev.filter((_, i) => i !== index));
    }, []);

    const toggleCategory = useCallback((catKey: string) => {
        setExpandedCategories(prev => ({ ...prev, [catKey]: !prev[catKey] }));
    }, []);

    // ── Rendu ──────────────────────────────────────────────────────────────
    return (
        <SafeNativeView style={styles.container}>
            <KeyboardAwareScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                enableOnAndroid={true}
                enableAutomaticScroll={true}
                extraScrollHeight={100}
                keyboardShouldPersistTaps="handled"
            >
                {/* ━━ Header compact ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Navigation</Text>
                        <Text style={styles.subtitle}>Trouvez le meilleur itinéraire</Text>
                    </View>
                    <TouchableOpacity style={styles.statsButton} onPress={() => setShowStats(!showStats)}>
                        <SafeIcon name="BarChart2" size={22} color={showStats ? modernColors.primary : modernColors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* ━━ Statistiques (pliable) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {showStats && stats && (
                    <NativeCard style={styles.statsCard}>
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{stats.total_trips}</Text>
                                <Text style={styles.statLabel}>Trajets</Text>
                            </View>
                            <View style={[styles.statDivider]} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{stats.total_distance_km.toFixed(0)}</Text>
                                <Text style={styles.statLabel}>km parcourus</Text>
                            </View>
                            <View style={[styles.statDivider]} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{Math.round(stats.total_duration_minutes / 60)}h</Text>
                                <Text style={styles.statLabel}>en route</Text>
                            </View>
                        </View>
                    </NativeCard>
                )}

                {/* ━━ Destinations favorites (chips) ━━━━━━━━━━━━━━━━━━━━━━ */}
                {savedDestinations.length > 0 && !destination && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.favoritesScroll} contentContainerStyle={styles.favoritesContent}>
                        {savedDestinations.slice(0, 5).map((dest) => (
                            <TouchableOpacity
                                key={dest.id}
                                style={styles.favoriteChip}
                                onPress={() => {
                                    setDestination(dest.custom_label || dest.label);
                                    setDestinationCoords({ lat: dest.latitude, lng: dest.longitude });
                                    setTimeout(() => searchRoutes(), 100);
                                }}
                            >
                                <SafeIcon
                                    name={dest.label === 'domicile' ? 'Home' : dest.label === 'bureau' ? 'Briefcase' : 'MapPin'}
                                    size={14} color={modernColors.primary}
                                />
                                <Text style={styles.favoriteChipText} numberOfLines={1}>
                                    {dest.custom_label || (dest.label === 'domicile' ? 'Domicile' : dest.label === 'bureau' ? 'Bureau' : dest.label)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* ━━ Champ de destination ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                <NativeCard style={styles.searchCard}>
                    <View style={styles.originRow}>
                        <View style={styles.originDot} />
                        <Text style={styles.originText}>Ma position actuelle</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.destRow}>
                        <View style={styles.destDot} />
                        <View style={styles.destInputWrap}>
                            <LocationSelector
                                value={selectedLocation ? selectedLocation : (destination || '')}
                                onSelect={(location: LocationObject) => {
                                    setSelectedLocation(location);
                                    const locationText = location.raw || location.place_name || '';
                                    setDestination(locationText);
                                    if (location.latitude && location.longitude) {
                                        setDestinationCoords({ lat: location.latitude, lng: location.longitude });
                                        setTimeout(() => searchRoutes(), 150);
                                    } else {
                                        geocodeDestination(locationText).then((coords) => {
                                            if (coords) { setDestinationCoords(coords); setTimeout(() => searchRoutes(), 150); }
                                        });
                                    }
                                }}
                                placeholder="Où allez-vous ?"
                                scope="all"
                                style={styles.locationSelector}
                            />
                        </View>
                    </View>

                    {/* Bouton rechercher */}
                    <TouchableOpacity
                        style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                        onPress={searchRoutes}
                        disabled={loading || (!destination.trim() && !selectedLocation)}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <><ActivityIndicator color="white" size="small" /><Text style={styles.searchButtonText}> Recherche en cours...</Text></>
                        ) : (
                            <><SafeIcon name="Navigation" size={18} color="white" /><Text style={styles.searchButtonText}> Trouver mon itinéraire</Text></>
                        )}
                    </TouchableOpacity>

                    {/* Enregistrer cette destination */}
                    {destinationCoords && (
                        <TouchableOpacity style={styles.saveDestBtn} onPress={() => {
                            Alert.alert('Enregistrer destination', 'Choisissez un type', [
                                { text: 'Domicile', onPress: () => saveDestination('domicile') },
                                { text: 'Bureau', onPress: () => saveDestination('bureau') },
                                { text: 'Annuler', style: 'cancel' },
                            ]);
                        }}>
                            <SafeIcon name="Bookmark" size={14} color={modernColors.primary} />
                            <Text style={styles.saveDestText}>Enregistrer</Text>
                        </TouchableOpacity>
                    )}
                </NativeCard>

                {/* ━━ Préférences de route (chips toggle) ━━━━━━━━━━━━━━━━━━━━ */}
                {(routes.length > 0 || destination.trim().length > 0) && (
                    <View style={styles.prefsRow}>
                        <TouchableOpacity style={[styles.prefChip, avoidTolls && styles.prefChipActive]} onPress={() => setAvoidTolls(!avoidTolls)}>
                            <Text style={[styles.prefChipText, avoidTolls && styles.prefChipTextActive]}>⛔ Péages</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.prefChip, avoidHighways && styles.prefChipActive]} onPress={() => setAvoidHighways(!avoidHighways)}>
                            <Text style={[styles.prefChipText, avoidHighways && styles.prefChipTextActive]}>🛣️ Autoroutes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.prefChip, avoidFerries && styles.prefChipActive]} onPress={() => setAvoidFerries(!avoidFerries)}>
                            <Text style={[styles.prefChipText, avoidFerries && styles.prefChipTextActive]}>⛴️ Ferries</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ━━ Étapes (waypoints) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {waypoints.length > 0 && (
                    <NativeCard style={styles.waypointsCard}>
                        <Text style={styles.waypointsTitle}>Mes étapes ({waypoints.length})</Text>
                        {waypoints.map((wp, idx) => (
                            <View key={idx} style={styles.waypointRow}>
                                <View style={styles.waypointBadge}>
                                    <Text style={styles.waypointBadgeText}>{idx + 1}</Text>
                                </View>
                                <Text style={styles.waypointName} numberOfLines={1}>{wp.name}</Text>
                                <TouchableOpacity onPress={() => removeWaypoint(idx)} style={styles.waypointRemove}>
                                    <SafeIcon name="X" size={16} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.recalcButton} onPress={searchRoutes}>
                            <SafeIcon name="RefreshCw" size={14} color={modernColors.primary} />
                            <Text style={styles.recalcText}>Recalculer avec étapes</Text>
                        </TouchableOpacity>
                    </NativeCard>
                )}

                {/* ━━ Routes disponibles ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {routes.length > 0 && (
                    <View style={styles.routesSection}>
                        <Text style={styles.sectionTitle}>{routes.length} itinéraire{routes.length > 1 ? 's' : ''} trouvé{routes.length > 1 ? 's' : ''}</Text>
                        <FlatList
                            data={routes}
                            keyExtractor={(item) => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingRight: 16 }}
                            renderItem={({ item, index }) => {
                                const isSelected = selectedRoute?.id === item.id;
                                const trafficColor = getTrafficColor(item.traffic_level);
                                const duration = item.duration_in_traffic_seconds || item.duration_seconds;
                                const delay = (item.duration_in_traffic_seconds && item.duration_in_traffic_seconds > item.duration_seconds)
                                    ? item.duration_in_traffic_seconds - item.duration_seconds : 0;

                                return (
                                    <TouchableOpacity
                                        style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                                        onPress={() => { setSelectedRoute(item); loadPointsOfInterest(item); }}
                                        activeOpacity={0.7}
                                    >
                                        {/* Badge numéro + trafic */}
                                        <View style={styles.routeTopRow}>
                                            <View style={styles.routeNumberBadge}>
                                                <Text style={styles.routeNumber}>{index + 1}</Text>
                                            </View>
                                            <View style={[styles.trafficBadge, { backgroundColor: trafficColor + '20' }]}>
                                                <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
                                                <Text style={[styles.trafficText, { color: trafficColor }]}>{getTrafficLabel(item.traffic_level)}</Text>
                                            </View>
                                            {isSelected && <SafeIcon name="CheckCircle" size={18} color={modernColors.primary} />}
                                        </View>
                                        <Text style={styles.routeSummary} numberOfLines={1}>{item.summary || `Itinéraire ${index + 1}`}</Text>
                                        <View style={styles.routeMetrics}>
                                            <View style={styles.routeMetric}>
                                                <SafeIcon name="Clock" size={13} color={modernColors.textSecondary} />
                                                <Text style={styles.routeMetricValue}>{formatDuration(duration)}</Text>
                                            </View>
                                            <View style={styles.routeMetric}>
                                                <SafeIcon name="MapPin" size={13} color={modernColors.textSecondary} />
                                                <Text style={styles.routeMetricValue}>{formatDistance(item.distance_meters)}</Text>
                                            </View>
                                        </View>
                                        {delay > 0 && (
                                            <Text style={styles.trafficDelay}>+{formatDuration(delay)} (trafic)</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                )}

                {/* ━━ Points d'intérêt groupés par catégorie ━━━━━━━━━━━━━━━━━━━ */}
                {selectedRoute && (
                    <View style={styles.poiSection}>
                        <View style={styles.poiSectionHeader}>
                            <Text style={styles.sectionTitle}>Sur votre trajet</Text>
                            {loadingPOI && <ActivityIndicator size="small" color={modernColors.primary} />}
                        </View>

                        {loadingPOI && pointsOfInterest.length === 0 ? (
                            <NativeCard style={styles.poiLoadingCard}>
                                <ActivityIndicator size="small" color={modernColors.primary} />
                                <Text style={styles.poiLoadingText}>Recherche des lieux clés...</Text>
                            </NativeCard>
                        ) : pointsOfInterest.length === 0 && !loadingPOI ? (
                            <NativeCard style={styles.poiEmptyCard}>
                                <SafeIcon name="MapPin" size={24} color={modernColors.textSecondary} />
                                <Text style={styles.poiEmptyText}>Aucun lieu clé trouvé sur ce trajet</Text>
                            </NativeCard>
                        ) : (
                            Object.entries(POI_CATEGORIES).map(([catKey, cat]) => {
                                const pois = groupedPOIs[catKey] || [];
                                if (pois.length === 0) return null;
                                const isExpanded = expandedCategories[catKey];
                                return (
                                    <NativeCard key={catKey} style={styles.poiCategoryCard}>
                                        <TouchableOpacity style={styles.poiCategoryHeader} onPress={() => toggleCategory(catKey)} activeOpacity={0.7}>
                                            <View style={[styles.poiCategoryIcon, { backgroundColor: cat.color + '15' }]}>
                                                <Text style={styles.poiCategoryEmoji}>{cat.icon}</Text>
                                            </View>
                                            <View style={styles.poiCategoryInfo}>
                                                <Text style={styles.poiCategoryLabel}>{cat.label}</Text>
                                                <Text style={styles.poiCategoryCount}>{pois.length} lieu{pois.length > 1 ? 'x' : ''}</Text>
                                            </View>
                                            <SafeIcon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={20} color={modernColors.textSecondary} />
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.poiList}>
                                                {pois.slice(0, 5).map((poi) => (
                                                    <View key={poi.id} style={styles.poiItem}>
                                                        <View style={styles.poiItemInfo}>
                                                            <Text style={styles.poiName} numberOfLines={1}>{poi.name}</Text>
                                                            <View style={styles.poiMeta}>
                                                                <Text style={styles.poiDistance}>{formatDistance(poi.distance_from_route_meters)}</Text>
                                                                {poi.rating != null && poi.rating > 0 && (
                                                                    <View style={styles.poiRating}>
                                                                        <SafeIcon name="Star" size={11} color="#FBBF24" />
                                                                        <Text style={styles.poiRatingText}>{poi.rating.toFixed(1)}</Text>
                                                                    </View>
                                                                )}
                                                                {poi.is_open != null && (
                                                                    <View style={[styles.openBadge, { backgroundColor: poi.is_open ? '#DCFCE7' : '#FEE2E2' }]}>
                                                                        <Text style={[styles.openBadgeText, { color: poi.is_open ? '#16A34A' : '#DC2626' }]}>
                                                                            {poi.is_open ? 'Ouvert' : 'Fermé'}
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </View>
                                                        <TouchableOpacity style={styles.addWaypointBtn} onPress={() => addWaypoint(poi)}>
                                                            <SafeIcon name="Plus" size={16} color={modernColors.primary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                                {pois.length > 5 && (
                                                    <Text style={styles.poiMoreText}>+{pois.length - 5} autres lieux</Text>
                                                )}
                                            </View>
                                        )}
                                    </NativeCard>
                                );
                            })
                        )}
                    </View>
                )}

                {/* ━━ Bouton démarrer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                {selectedRoute && (
                    <TouchableOpacity style={styles.goButton} onPress={() => startNavigation(selectedRoute)} activeOpacity={0.85}>
                        <SafeIcon name="Navigation" size={22} color="white" />
                        <Text style={styles.goButtonText}>Démarrer la navigation</Text>
                    </TouchableOpacity>
                )}
            </KeyboardAwareScrollView>
        </SafeNativeView>
    );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: modernColors.background },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 100 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 26, fontWeight: '800', color: modernColors.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: modernColors.textSecondary, marginTop: 2 },
    statsButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: modernColors.surface, alignItems: 'center', justifyContent: 'center' },

    // Stats
    statsCard: { marginBottom: 16, padding: 16 },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 22, fontWeight: '800', color: modernColors.primary },
    statLabel: { fontSize: 11, color: modernColors.textSecondary, marginTop: 4, textAlign: 'center' },
    statDivider: { width: 1, height: 32, backgroundColor: modernColors.border },

    // Favorites
    favoritesScroll: { marginBottom: 12 },
    favoritesContent: { gap: 8, paddingRight: 16 },
    favoriteChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border },
    favoriteChipText: { fontSize: 13, color: modernColors.text, fontWeight: '500', maxWidth: 120 },

    // Search card
    searchCard: { marginBottom: 12, padding: 16 },
    originRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    originDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#D1FAE5' },
    originText: { fontSize: 13, color: modernColors.textSecondary },
    routeLine: { width: 2, height: 20, backgroundColor: modernColors.border, marginLeft: 4, marginVertical: 2 },
    destRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    destDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FEE2E2' },
    destInputWrap: { flex: 1 },
    locationSelector: { marginBottom: 0 },
    searchButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: 14, backgroundColor: modernColors.primary, borderRadius: 12, shadowColor: modernColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    searchButtonDisabled: { opacity: 0.5 },
    searchButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    saveDestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10 },
    saveDestText: { fontSize: 12, color: modernColors.primary, fontWeight: '600' },

    // Route preferences
    prefsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
    prefChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border },
    prefChipActive: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
    prefChipText: { fontSize: 12, color: modernColors.textSecondary, fontWeight: '500' },
    prefChipTextActive: { color: '#D97706' },

    // Waypoints
    waypointsCard: { marginBottom: 12, padding: 14 },
    waypointsTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text, marginBottom: 10 },
    waypointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    waypointBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: modernColors.primary, alignItems: 'center', justifyContent: 'center' },
    waypointBadgeText: { fontSize: 12, fontWeight: '700', color: 'white' },
    waypointName: { flex: 1, fontSize: 13, color: modernColors.text },
    waypointRemove: { padding: 4 },
    recalcButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: modernColors.primaryLight || '#EFF6FF' },
    recalcText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },

    // Routes section
    routesSection: { marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text, marginBottom: 10 },
    routeCard: { width: width * 0.68, backgroundColor: modernColors.surface, borderRadius: 14, padding: 14, marginRight: 10, borderWidth: 2, borderColor: modernColors.border },
    routeCardSelected: { borderColor: modernColors.primary, backgroundColor: (modernColors.primaryLight || '#EFF6FF') },
    routeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    routeNumberBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: modernColors.text, alignItems: 'center', justifyContent: 'center' },
    routeNumber: { fontSize: 12, fontWeight: '800', color: 'white' },
    trafficBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    trafficDot: { width: 6, height: 6, borderRadius: 3 },
    trafficText: { fontSize: 11, fontWeight: '600' },
    routeSummary: { fontSize: 13, fontWeight: '600', color: modernColors.text, marginBottom: 8 },
    routeMetrics: { flexDirection: 'row', gap: 16 },
    routeMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    routeMetricValue: { fontSize: 13, color: modernColors.textSecondary, fontWeight: '500' },
    trafficDelay: { fontSize: 11, color: '#EF4444', fontStyle: 'italic', marginTop: 6 },

    // POI section
    poiSection: { marginBottom: 16 },
    poiSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    poiLoadingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
    poiLoadingText: { fontSize: 14, color: modernColors.textSecondary },
    poiEmptyCard: { alignItems: 'center', padding: 24, gap: 8 },
    poiEmptyText: { fontSize: 14, color: modernColors.textSecondary },

    // POI category accordion
    poiCategoryCard: { marginBottom: 8, padding: 0, overflow: 'hidden' },
    poiCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    poiCategoryIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    poiCategoryEmoji: { fontSize: 20 },
    poiCategoryInfo: { flex: 1 },
    poiCategoryLabel: { fontSize: 15, fontWeight: '700', color: modernColors.text },
    poiCategoryCount: { fontSize: 12, color: modernColors.textSecondary, marginTop: 1 },
    poiList: { paddingHorizontal: 14, paddingBottom: 10 },
    poiItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: modernColors.border },
    poiItemInfo: { flex: 1 },
    poiName: { fontSize: 14, fontWeight: '600', color: modernColors.text },
    poiMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    poiDistance: { fontSize: 12, color: modernColors.textSecondary },
    poiRating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    poiRatingText: { fontSize: 12, color: modernColors.text, fontWeight: '600' },
    openBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    openBadgeText: { fontSize: 10, fontWeight: '600' },
    addWaypointBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: modernColors.primaryLight || '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    poiMoreText: { fontSize: 12, color: modernColors.textSecondary, textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' },

    // Go button
    goButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, backgroundColor: '#10B981', borderRadius: 14, marginTop: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    goButtonText: { fontSize: 17, fontWeight: '800', color: 'white' },
});

export default NavigationScreen;

