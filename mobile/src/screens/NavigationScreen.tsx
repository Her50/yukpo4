import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
// ✅ FIX 2026-03-06: Remplacé KeyboardAwareScrollView par ScrollView simple + nestedScrollEnabled
// KeyboardAwareScrollView bloquait le scroll horizontal des cartes de routes
import LocationSelector, { LocationObject } from '../components/LocationSelector';
import { NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { apiGet, apiPost } from '../services/api';
import { socialSharing } from '../services/socialSharing';
import { modernColors } from '../theme/modernTheme';

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.35;
const KEYBOARD_OFFSET = Platform.OS === 'ios' ? 0 : 20;

// ── Décodeur polyline Google ─────────────────────────────────────────────
const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    if (!encoded || typeof encoded !== 'string') return [];

    const points: { latitude: number; longitude: number }[] = [];
    let index = 0, lat = 0, lng = 0;

    try {
        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                if (b < -63 || b > 95) throw new Error('Invalid polyline encoding');
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                if (b < -63 || b > 95) throw new Error('Invalid polyline encoding');
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);

            // ✅ VALIDATION: Vérifier les coordonnées avant d'ajouter
            const decodedLat = lat / 1e5;
            const decodedLng = lng / 1e5;

            if (validateCoords(decodedLat, decodedLng)) {
                points.push({ latitude: decodedLat, longitude: decodedLng });
            } else {
                console.warn('[Navigation] Coordonnées invalides ignorées:', decodedLat, decodedLng);
            }
        }
    } catch (error) {
        console.error('[Navigation] Erreur décodage polyline:', error);
        return [];
    }

    return points;
};

// ✅ VALIDATION: Coordonnées géographiques
const validateCoords = (lat: number, lng: number): boolean => {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        isFinite(lat) &&
        isFinite(lng)
    );
};

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
    arrival_time?: string;
    departure_time?: string;
    start_address?: string;
    end_address?: string;
    warnings?: string[];
    fare?: { currency: string; value: number; text: string };
    mode?: string;
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
    type: string;
    location: { lat: number; lng: number };
    distance_from_route_meters: number;
    rating?: number;
    is_open?: boolean;
    address?: string;
    phone?: string;
    price_level?: number;
    total_ratings?: number;
}

// ── Constantes POI ─────────────────────────────────────────────────────────
const POI_CATEGORIES: Record<string, { label: string; icon: string; color: string; types: string[] }> = {
    health: { label: 'Santé', icon: '🏥', color: '#EF4444', types: ['pharmacy', 'hospital'] },
    food: { label: 'Alimentation', icon: '🍞', color: '#F59E0B', types: ['bakery', 'supermarket', 'restaurant'] },
    fuel: { label: 'Carburant', icon: '⛽', color: '#3B82F6', types: ['gas_station'] },
    finance: { label: 'Banque & DAB', icon: '🏧', color: '#6366F1', types: ['atm'] },
    auto: { label: 'Auto & Parking', icon: '🚗', color: '#0EA5E9', types: ['parking', 'car_wash', 'car_repair'] },
    religion: { label: 'Lieux de culte', icon: '🕌', color: '#A855F7', types: ['mosque', 'church'] },
    accommodation: { label: 'Hébergement', icon: '🏨', color: '#EC4899', types: ['hotel'] },
    security: { label: 'Sécurité', icon: '🚔', color: '#14B8A6', types: ['police'] },
};

const POI_TYPE_LABELS: Record<string, string> = {
    pharmacy: 'Pharmacie',
    hospital: 'Hôpital/Clinique',
    bakery: 'Boulangerie',
    gas_station: 'Station-service',
    supermarket: 'Supermarché',
    restaurant: 'Restaurant/Snack',
    atm: 'Distributeur/DAB',
    parking: 'Parking',
    car_wash: 'Lavage auto',
    car_repair: 'Garage/Mécanicien',
    mosque: 'Mosquée',
    church: 'Église',
    hotel: 'Hôtel',
    police: 'Commissariat',
};

const TRAVEL_MODES = [
    { key: 'driving', label: 'Voiture', icon: 'Car' as const, color: '#3B82F6' },
    { key: 'walking', label: 'À pied', icon: 'Footprints' as const, color: '#10B981' },
    { key: 'transit', label: 'Transport', icon: 'Bus' as const, color: '#8B5CF6' },
    { key: 'bicycling', label: 'Vélo', icon: 'Bike' as const, color: '#F59E0B' },
];

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

    // Travel mode & préférences
    const [travelMode, setTravelMode] = useState<string>('driving');
    const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number; name: string }>>([]);
    const [avoidTolls, setAvoidTolls] = useState(false);
    const [avoidHighways, setAvoidHighways] = useState(false);
    const [avoidFerries, setAvoidFerries] = useState(false);

    // Route steps & UI
    const [showSteps, setShowSteps] = useState(false);
    const [showPrefs, setShowPrefs] = useState(false);

    // ── Mode navigation dynamique (suivi en temps réel) ──
    const [isTracking, setIsTracking] = useState(false);
    const [currentSpeed, setCurrentSpeed] = useState<number>(0);
    const [currentHeading, setCurrentHeading] = useState<number>(0);
    const [livePosition, setLivePosition] = useState<{ lat: number; lng: number } | null>(null);
    const [nextStepIndex, setNextStepIndex] = useState(0);
    const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
    const [durationRemaining, setDurationRemaining] = useState<number>(0);
    const [liveETA, setLiveETA] = useState<string>('');
    const [isOffRoute, setIsOffRoute] = useState(false);
    const [checkpoints, setCheckpoints] = useState<Array<{
        id: string; checkpoint_type: string; latitude: number; longitude: number;
        description?: string; speed_limit?: number; confidence: number; distance_from_route_meters?: number;
    }>>([]);
    const [nearbyCheckpoint, setNearbyCheckpoint] = useState<{
        id: string; checkpoint_type: string; distance: number; speed_limit?: number;
    } | null>(null);
    const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
    const checkpointsRef = useRef(checkpoints);
    checkpointsRef.current = checkpoints;
    const checkpointRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const checkpointRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const trackingUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Métriques d'activité (collectées pendant le suivi) ──
    const trackingStartTimeRef = useRef<string | null>(null);
    const speedSamplesRef = useRef<number[]>([]);
    const maxSpeedRef = useRef<number>(0);
    const distanceTraveledRef = useRef<number>(0);
    const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    const checkpointsReportedRef = useRef<number>(0);
    const checkpointsEncounteredRef = useRef<number>(0);
    const wasOffRouteRef = useRef<boolean>(false);
    const encounteredCheckpointIdsRef = useRef<Set<string>>(new Set());

    // ── Statistiques intelligentes ──
    const [showActivityStats, setShowActivityStats] = useState(false);
    const [activityPeriod, setActivityPeriod] = useState<'week' | 'month' | 'year'>('week');
    const [activitySummary, setActivitySummary] = useState<any>(null);
    const [activityHistory, setActivityHistory] = useState<any[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [aiInsights, setAiInsights] = useState<any>(null);
    const [checkpointAiAnalysis, setCheckpointAiAnalysis] = useState<any>(null);

    // Favorites
    const [savedDestinations, setSavedDestinations] = useState<Array<{
        id: string; label: string; custom_label?: string; address: string; latitude: number; longitude: number;
    }>>([]);

    // UI état des blocs POI ouverts/fermés
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        health: true, food: false, fuel: false, finance: false, auto: false, religion: false, accommodation: false, security: false,
    });

    // ✅ FIX 2026-03-03: Contrôle du scroll parent pour éviter le conflit avec les FlatList horizontaux
    const [parentScrollEnabled, setParentScrollEnabled] = useState(true);
    const routeCardWidth = width * 0.72 + 10; // card width + marginRight

    // ── Gestion du clavier ─────────────────────────────────────
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [isLocationSelectorFocused, setIsLocationSelectorFocused] = useState(false);

    // ── Carte interactive ──
    const [showMap, setShowMap] = useState(true);
    const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);
    const [showAllSteps, setShowAllSteps] = useState(false);
    const [showReportHelp, setShowReportHelp] = useState(false);
    const mapRef = useRef<MapView>(null);

    // ✅ FIX 2026-03-06: Refs pour la gestion du scroll imbriqué
    const scrollViewRef = useRef<ScrollView>(null);
    const horizontalScrollRef = useRef<ScrollView>(null);
    const [isHorizontalScrolling, setIsHorizontalScrolling] = useState(false);

    // ✅ FIX 2026-03-03: Ref pour éviter les closures obsolètes dans les callbacks asynchrones
    const searchRoutesRef = useRef<() => void>(() => { });

    // ── POIs groupés par catégorie (mémorisé) ──
    const groupedPOIs = useMemo(() => {
        const groups: Record<string, PointOfInterest[]> = {};
        for (const [catKey, cat] of Object.entries(POI_CATEGORIES)) {
            groups[catKey] = pointsOfInterest.filter(poi => cat.types.includes(poi.type));
        }
        return groups;
    }, [pointsOfInterest]);

    // ── Polyline décodée pour la carte ──
    const routePolylineCoords = useMemo(() => {
        if (!selectedRoute?.overview_polyline) return [];
        try { return decodePolyline(selectedRoute.overview_polyline); }
        catch { return []; }
    }, [selectedRoute?.overview_polyline]);

    // ── Région carte calculée à partir de la route ──
    const mapRegion = useMemo((): Region | undefined => {
        if (routePolylineCoords.length > 0) {
            const lats = routePolylineCoords.map(p => p.latitude);
            const lngs = routePolylineCoords.map(p => p.longitude);
            const minLat = Math.min(...lats), maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
            return {
                latitude: (minLat + maxLat) / 2,
                longitude: (minLng + maxLng) / 2,
                latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.01),
                longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.01),
            };
        }
        if (destinationCoords) {
            return { latitude: destinationCoords.lat, longitude: destinationCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        }
        if (currentLocation?.coords) {
            return { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        }
        return { latitude: 4.05, longitude: 9.7, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    }, [routePolylineCoords, destinationCoords, currentLocation]);

    // ── Adapter la carte quand la route change ──
    useEffect(() => {
        if (routePolylineCoords.length > 1 && mapRef.current) {
            mapRef.current.fitToCoordinates(routePolylineCoords, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        }
    }, [routePolylineCoords]);

    // ── Helpers ──────────────────────────────────────────────────────────────
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

    // ── Gestion du clavier ─────────────────────────────────────
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
            setIsKeyboardVisible(true);
        });

        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardHeight(0);
            setIsKeyboardVisible(false);
        });

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    const resolveDestination = useCallback(async (dest: string): Promise<{ lat: number; lng: number; address: string } | null> => {
        const destLower = dest.toLowerCase().trim();
        if (destLower === 'domicile' || destLower === 'bureau') {
            try {
                const response = await apiGet(`/api/navigation/destinations/by-label/${destLower}`);
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

            console.log('[NavigationScreen] searchRoutes → origin:', origin, 'dest:', destCoords, 'avoid:', avoidList);
            const response = await apiPost('/api/navigation/routes', {
                origin: { lat: origin.lat, lng: origin.lng },
                destination: { lat: destCoords.lat, lng: destCoords.lng },
                alternatives: true,
                avoid: avoidList,
                traffic_model: 'best_guess',
                mode: travelMode,
                waypoints: waypoints.length > 0 ? waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })) : undefined,
            });
            console.log('[NavigationScreen] searchRoutes → response.success:', response?.success, 'hasRoutes:', !!response?.data?.routes, 'routeCount:', response?.data?.routes?.length, 'error:', response?.error);

            // ✅ FIX 2026-03-06: Validation robuste des données API pour prévenir les crashes
            if (response?.success === false) {
                // Erreur API (500, timeout, réseau...) → afficher le vrai message d'erreur
                const errorMsg = response?.error || response?.data?.error || response?.data?.message || 'Erreur serveur';
                console.error('[NavigationScreen] Erreur API routes:', errorMsg);
                Alert.alert('Erreur', `Impossible de calculer l'itinéraire: ${errorMsg}`);
            } else if (response?.data?.routes && Array.isArray(response.data.routes) && response.data.routes.length > 0) {
                // ✅ VALIDATION: Filtrer les routes invalides pour éviter les crashes
                const validRoutes = response.data.routes.filter((route: any) =>
                    route &&
                    typeof route === 'object' &&
                    route.overview_polyline &&
                    typeof route.distance_meters === 'number' && route.distance_meters > 0 &&
                    typeof route.duration_seconds === 'number' && route.duration_seconds > 0 &&
                    Array.isArray(route.steps)
                );

                if (validRoutes.length === 0) {
                    console.warn('[NavigationScreen] Aucune route valide trouvée après filtrage');
                    Alert.alert('Aucun itinéraire', 'Aucun itinéraire valide trouvé. Essayez une destination différente.');
                    setLoading(false);
                    return;
                }

                console.log(`[NavigationScreen] ${validRoutes.length} routes valides trouvées`);
                setRoutes(validRoutes);
                setSelectedRoute(validRoutes[0]);

                // ✅ CHARGEMENT SÉQUENTIEL SÉCURISÉ: Éviter les appels API simultanés
                try {
                    await loadPointsOfInterestSafely(validRoutes[0]);
                    // Charger les signalements avec délai pour ne pas surcharger
                    setTimeout(() => loadCheckpointsSafely(), 800);
                } catch (poiError) {
                    console.warn('[NavigationScreen] Erreur chargement POI (non critique):', poiError);
                    // Continuer même si les POI échouent
                }
            } else {
                Alert.alert('Aucun itinéraire', 'Aucune route trouvée entre ces deux points. Essayez une destination différente.');
            }
        } catch (error: any) {
            console.error('[NavigationScreen] Erreur recherche routes:', error);
            Alert.alert('Erreur', error?.message || 'Impossible de trouver des routes');
        } finally {
            setLoading(false);
        }
    }, [destination, destinationCoords, selectedLocation, getCurrentPosition, geocodeDestination, avoidTolls, avoidHighways, avoidFerries, waypoints, travelMode]);

    // ✅ FIX 2026-03-03: Garder la ref à jour pour éviter les closures obsolètes
    useEffect(() => { searchRoutesRef.current = searchRoutes; }, [searchRoutes]);

    // ✅ FONCTION SÉCURISÉE: Charger les POI avec validation
    const loadPointsOfInterestSafely = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) {
            setPointsOfInterest([]);
            return;
        }

        setLoadingPOI(true);
        setPointsOfInterest([]);

        try {
            const origin = await getCurrentPosition();
            if (!origin) {
                setLoadingPOI(false);
                return;
            }

            // ✅ VALIDATION: S'assurer que la route est valide
            if (!route.id || !route.steps || route.steps.length === 0) {
                console.warn('[Navigation] Route invalide pour POI, utilisation fallback');
                setLoadingPOI(false);
                return;
            }

            // ✅ FIX 2026-03-04: Envoyer les vrais steps du trajet pour que le backend
            // cherche les POI le long du VRAI parcours (pas une ligne droite)
            const stepsParam = route.steps && route.steps.length > 0
                ? `&route_steps=${encodeURIComponent(JSON.stringify(route.steps.map(s => ({
                    lat: s.location?.lat || s.start_location?.lat || 0,
                    lng: s.location?.lng || s.start_location?.lng || 0
                }))))}`
                : '';

            const response = await apiGet(
                `/api/navigation/points-of-interest?route_id=${route.id}&origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}${stepsParam}`
            );

            // ✅ VALIDATION: Vérifier la réponse POI
            if (response?.data?.pois && Array.isArray(response.data.pois)) {
                const validPois = response.data.pois.filter((poi: any) =>
                    poi &&
                    poi.name &&
                    validateCoords(poi.latitude || poi.lat, poi.longitude || poi.lng)
                );

                setPointsOfInterest(validPois);
                console.log(`[Navigation] ${validPois.length} POI valides chargés`);

                // Ouvrir la première catégorie qui a des résultats
                const firstCatWithResults = Object.entries(POI_CATEGORIES).find(([key]) => {
                    const cat = POI_CATEGORIES[key];
                    return validPois.some((p: PointOfInterest) => cat.types.includes(p.type));
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

    // ✅ FONCTION SÉCURISÉE: Charger les checkpoints avec validation
    const loadCheckpointsSafely = useCallback(async () => {
        if (!selectedRoute || !destinationCoords) return;

        setLoadingCheckpoints(true);
        const origin = await getCurrentPosition();
        if (!origin) {
            setLoadingCheckpoints(false);
            return;
        }

        try {
            const response = await apiGet(`/api/navigation/checkpoints/along-route?origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}`);
            const data = response?.data as any;

            // ✅ VALIDATION: Vérifier les checkpoints
            if (data?.checkpoints && Array.isArray(data.checkpoints)) {
                const validCheckpoints = data.checkpoints.filter((checkpoint: any) =>
                    checkpoint &&
                    checkpoint.type &&
                    validateCoords(checkpoint.latitude || checkpoint.lat, checkpoint.longitude || checkpoint.lng)
                );

                setCheckpoints(validCheckpoints);
                console.log(`[Navigation] ${validCheckpoints.length} checkpoints valides chargés`);
            } else {
                setCheckpoints([]);
            }
        } catch (e) {
            console.error('[Navigation] Erreur chargement checkpoints:', e);
            setCheckpoints([]);
        } finally {
            setLoadingCheckpoints(false);
        }
    }, [selectedRoute, destinationCoords, getCurrentPosition]);

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
            // ✅ FIX 2026-03-04: Utiliser Google Maps URL universelle qui supporte les waypoints
            // maps:// (iOS) et google.navigation: (Android) ne supportent PAS les waypoints
            const waypointsStr = waypoints.length > 0
                ? `&waypoints=${waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')}` : '';
            if (waypoints.length > 0) {
                // Avec waypoints → toujours utiliser l'URL web Google Maps (seule qui supporte les étapes)
                const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}${waypointsStr}&travelmode=driving`;
                await Linking.openURL(webUrl);
            } else {
                // Sans waypoints → utiliser l'app native si disponible
                const nativeUrl = Platform.select({
                    ios: `maps://app?daddr=${destinationCoords.lat},${destinationCoords.lng}&dirflg=d`,
                    android: `google.navigation:q=${destinationCoords.lat},${destinationCoords.lng}`,
                    default: `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}&travelmode=driving`,
                });
                const canOpen = await Linking.canOpenURL(nativeUrl || '');
                if (canOpen) { await Linking.openURL(nativeUrl || ''); }
                else { await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}&travelmode=driving`); }
            }
        } catch (error) {
            console.error('Erreur navigation:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir la navigation');
        }
    }, [destinationCoords, waypoints, getCurrentPosition]);

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

    // ── Naviguer vers un POI ────────────────────────────────────────────────
    const navigateToPOI = useCallback((poi: PointOfInterest) => {
        const url = Platform.select({
            ios: `maps://app?daddr=${poi.location.lat},${poi.location.lng}&dirflg=d`,
            android: `google.navigation:q=${poi.location.lat},${poi.location.lng}`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${poi.location.lat},${poi.location.lng}&travelmode=driving`,
        });
        Linking.openURL(url || `https://www.google.com/maps/dir/?api=1&destination=${poi.location.lat},${poi.location.lng}`);
    }, []);

    // ── Partager l'itinéraire ────────────────────────────────────────────────
    const shareRoute = useCallback(async () => {
        if (!selectedRoute || !destinationCoords) return;
        const origin = await getCurrentPosition();
        if (!origin) return;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&travelmode=${travelMode}`;
        const duration = selectedRoute.duration_in_traffic_seconds || selectedRoute.duration_seconds;
        await Share.share({
            message: `Itinéraire: ${formatDistance(selectedRoute.distance_meters)} · ${formatDuration(duration)} · Arrivée ${selectedRoute.arrival_time || '~'}\n${url}`,
            title: 'Mon itinéraire Yukpo',
        });
    }, [selectedRoute, destinationCoords, getCurrentPosition, travelMode]);

    // ── Partager ses performances navigation ────────────────────────────────
    const sharePerformance = useCallback(async () => {
        if (!aiInsights) return;
        const hs = aiInsights.health_score || {};
        const co2 = aiInsights.co2_impact || {};
        const fit = aiInsights.fitness || {};
        const gam = aiInsights.gamification || {};
        const rec = aiInsights.personal_records || {};
        await socialSharing.shareNavigationPerformance({
            period: activityPeriod,
            distanceKm: (aiInsights.summary?.total_distance_meters || 0) / 1000,
            sessions: aiInsights.summary?.total_sessions || 0,
            calories: aiInsights.summary?.total_calories || 0,
            healthScore: hs.score || 0,
            healthLabel: hs.label || '',
            co2SavedKg: (co2.saved_grams || 0) / 1000,
            vo2max: fit.vo2max || 0,
            fitnessLevel: fit.level || '',
            streak: gam.streak?.current || 0,
            badgeCount: gam.badges?.length || 0,
            points: gam.points || 0,
            bestDistanceKm: rec.longest_session_km,
            bestSpeedKmh: rec.fastest_speed_kmh,
        });
    }, [aiInsights, activityPeriod]);

    // ── Prix indicatif (POI) ────────────────────────────────────────────────
    const getPriceLevelText = (level?: number) => {
        if (level == null) return '';
        return '💰'.repeat(level) || '💰';
    };

    // ── Haversine (distance en mètres) ──────────────────────────────────────
    const haversineDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371000;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }, []);

    // ── Charger les checkpoints (radars/contrôles) le long du trajet ─────
    const loadCheckpoints = useCallback(async () => {
        if (!selectedRoute || !destinationCoords) return;
        setLoadingCheckpoints(true);
        const origin = await getCurrentPosition();
        if (!origin) { setLoadingCheckpoints(false); return; }
        try {
            const response = await apiGet(`/api/navigation/checkpoints/along-route?origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}`);
            const data = response?.data as any;
            if (data?.checkpoints) {
                setCheckpoints(data.checkpoints);
                console.log(`[Navigation] ${data.checkpoints.length} checkpoints détectés sur le trajet`);
            }
        } catch (e) { console.error('[Navigation] Erreur chargement checkpoints:', e); }
        setLoadingCheckpoints(false);
    }, [selectedRoute, destinationCoords, getCurrentPosition]);

    // ── Signaler un checkpoint ──────────────────────────────────────────────
    // ── Charger les statistiques d'activité ──────────────────────────────
    const loadActivityStats = useCallback(async (period: string = 'week') => {
        setLoadingActivity(true);
        try {
            const [summaryRes, historyRes, aiRes] = await Promise.all([
                apiGet(`/api/navigation/activity/summary?period=${period}`),
                apiGet(`/api/navigation/activity/history?limit=10`),
                apiGet(`/api/navigation/activity/ai-insights?period=${period}`),
            ]);
            const summaryData = summaryRes?.data as any;
            const historyData = historyRes?.data as any;
            const aiData = aiRes?.data as any;
            if (summaryData) setActivitySummary(summaryData);
            if (historyData?.activities) setActivityHistory(historyData.activities);
            if (aiData?.success) setAiInsights(aiData);
        } catch (e) { console.error('[Navigation] Erreur chargement stats activité:', e); }
        setLoadingActivity(false);
    }, []);

    // ── Calculer les calories brûlées ─────────────────────────────────────
    const estimateCalories = useCallback((distanceKm: number, durationMinutes: number, mode: string, avgSpeedKmh: number) => {
        // MET (Metabolic Equivalent of Task) basé sur le mode et la vitesse
        let met = 1.0;
        if (mode === 'walking') {
            met = avgSpeedKmh < 4 ? 2.5 : avgSpeedKmh < 5.5 ? 3.5 : avgSpeedKmh < 7 ? 4.5 : 6.0;
        } else if (mode === 'bicycling') {
            met = avgSpeedKmh < 16 ? 4.0 : avgSpeedKmh < 20 ? 6.8 : avgSpeedKmh < 25 ? 8.0 : 10.0;
        } else if (mode === 'transit') {
            met = 1.3; // debout dans le bus/métro
        } else {
            met = 1.5; // conduite
        }
        const weightKg = 70; // poids moyen estimé
        return (met * weightKg * durationMinutes) / 60;
    }, []);

    // ── Calculer le score de qualité de la marche/trajet ──────────────────
    const computeQualityScore = useCallback((speedSamples: number[], distanceKm: number, durationMin: number, mode: string, wasOff: boolean) => {
        if (speedSamples.length < 3 || durationMin < 1) return 50;
        // Régularité de la vitesse (écart-type faible = bonne qualité)
        const avg = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
        const variance = speedSamples.reduce((sum, s) => sum + (s - avg) ** 2, 0) / speedSamples.length;
        const stdDev = Math.sqrt(variance);
        const consistency = Math.max(0, 100 - stdDev * 5); // Plus c'est constant, mieux c'est

        // Bonus distance (effort)
        const distanceBonus = Math.min(20, distanceKm * 4);

        // Bonus durée (endurance)
        const durationBonus = Math.min(15, durationMin * 0.5);

        // Pénalité déviation
        const deviationPenalty = wasOff ? 15 : 0;

        // Bonus mode actif
        const modeBonus = mode === 'walking' ? 10 : mode === 'bicycling' ? 8 : 0;

        return Math.min(100, Math.max(0, Math.round(
            consistency * 0.5 + distanceBonus + durationBonus + modeBonus - deviationPenalty
        )));
    }, []);

    const reportCheckpoint = useCallback(async (type: string) => {
        let pos = livePosition;
        if (!pos) {
            pos = await getCurrentPosition();
        }
        if (!pos) { Alert.alert('Erreur', 'Position GPS non disponible'); return; }
        try {
            await apiPost('/api/navigation/checkpoints', {
                checkpoint_type: type,
                latitude: pos.lat,
                longitude: pos.lng,
                is_permanent: type === 'speed_bump',
            });
            checkpointsReportedRef.current += 1;
            Alert.alert('Signalement enregistré', 'Visible par tous les utilisateurs sur ce trajet. Merci !');
            loadCheckpoints();
        } catch (e) {
            console.error('[Navigation] Erreur signalement:', e);
            Alert.alert('Erreur', 'Impossible d\'enregistrer le signalement');
        }
    }, [livePosition, getCurrentPosition, loadCheckpoints]);

    // ── Démarrer le suivi en temps réel ─────────────────────────────────────
    const startTracking = useCallback(async () => {
        if (!selectedRoute || isTracking) return;

        // ✅ VALIDATION: Vérifier que la route est valide
        if (!selectedRoute.distance_meters || !selectedRoute.duration_seconds) {
            Alert.alert('Erreur', 'Itinéraire invalide pour le suivi');
            return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'La localisation est nécessaire pour le suivi en temps réel');
            return;
        }

        // Initialiser les métriques d'activité
        trackingStartTimeRef.current = new Date().toISOString();
        speedSamplesRef.current = [];
        maxSpeedRef.current = 0;
        distanceTraveledRef.current = 0;
        lastPositionRef.current = null;
        checkpointsReportedRef.current = 0;
        checkpointsEncounteredRef.current = 0;
        wasOffRouteRef.current = false;
        encounteredCheckpointIdsRef.current = new Set();

        // ✅ VALIDATION: Mises à jour d'état sécurisées
        setIsTracking(true);
        setNextStepIndex(0);

        // Validation des valeurs avant mise à jour
        const distance = typeof selectedRoute.distance_meters === 'number' && selectedRoute.distance_meters > 0
            ? selectedRoute.distance_meters
            : 1000; // fallback

        const duration = typeof selectedRoute.duration_in_traffic_seconds === 'number' && selectedRoute.duration_in_traffic_seconds > 0
            ? selectedRoute.duration_in_traffic_seconds
            : (typeof selectedRoute.duration_seconds === 'number' && selectedRoute.duration_seconds > 0
                ? selectedRoute.duration_seconds
                : 300); // fallback 5 minutes

        setDistanceRemaining(distance);
        setDurationRemaining(duration);
        loadCheckpoints();

        // Analyse IA des checkpoints pour alertes contextuelles
        (async () => {
            try {
                const pos = await getCurrentPosition();
                if (pos && destinationCoords) {
                    const res = await apiGet(`/api/navigation/checkpoints/ai-analysis?origin_lat=${pos.lat}&origin_lng=${pos.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}`);
                    const data = res?.data as any;
                    if (data?.success) setCheckpointAiAnalysis(data.analysis);
                }
            } catch (e) { console.log('[Navigation] Checkpoint AI analysis non disponible:', e); }
        })();

        // Auto-refresh des checkpoints toutes les 60s (voit les signalements des autres utilisateurs)
        checkpointRefreshRef.current = setInterval(() => { loadCheckpoints(); }, 60000);

        const subscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
            (location) => {
                const { latitude, longitude, speed, heading } = location.coords;
                const pos = { lat: latitude, lng: longitude };
                const speedKmh = Math.max(0, (speed || 0) * 3.6);
                setLivePosition(pos);
                setCurrentSpeed(speedKmh);
                if (heading != null) setCurrentHeading(heading);

                // Collecter les métriques d'activité
                speedSamplesRef.current.push(speedKmh);
                if (speedKmh > maxSpeedRef.current) maxSpeedRef.current = speedKmh;
                if (lastPositionRef.current) {
                    const segDist = haversineDistance(lastPositionRef.current.lat, lastPositionRef.current.lng, latitude, longitude);
                    if (segDist < 500) distanceTraveledRef.current += segDist; // ignorer les sauts GPS
                }
                lastPositionRef.current = pos;

                if (!selectedRoute?.steps?.length) return;

                // Trouver l'étape la plus proche
                let minDist = Infinity;
                let closestIdx = 0;
                for (let i = 0; i < selectedRoute.steps.length; i++) {
                    const step = selectedRoute.steps[i];
                    const d = haversineDistance(latitude, longitude, step.location.lat, step.location.lng);
                    if (d < minDist) { minDist = d; closestIdx = i; }
                }
                setNextStepIndex(Math.min(closestIdx + 1, selectedRoute.steps.length - 1));

                // Distance et durée restantes
                let remainDist = 0;
                let remainDur = 0;
                for (let i = closestIdx; i < selectedRoute.steps.length; i++) {
                    remainDist += selectedRoute.steps[i].distance_meters;
                    remainDur += selectedRoute.steps[i].duration_seconds;
                }
                setDistanceRemaining(remainDist);
                setDurationRemaining(remainDur);

                // ETA en temps réel
                const now = new Date();
                const eta = new Date(now.getTime() + remainDur * 1000);
                setLiveETA(`${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`);

                // Détection de déviation (> 200m de l'étape la plus proche)
                const offRoute = minDist > 200;
                setIsOffRoute(offRoute);
                if (offRoute) wasOffRouteRef.current = true;

                // Alerte checkpoint proche (< 300m) — utilise ref pour données fraîches
                const currentCheckpoints = checkpointsRef.current;
                let nearest: { id: string; checkpoint_type: string; distance: number; speed_limit?: number } | null = null;
                for (const cp of currentCheckpoints) {
                    const cpDist = haversineDistance(latitude, longitude, cp.latitude, cp.longitude);
                    if (cpDist < 300 && (!nearest || cpDist < nearest.distance)) {
                        nearest = { id: cp.id, checkpoint_type: cp.checkpoint_type, distance: Math.round(cpDist), speed_limit: cp.speed_limit };
                    }
                }
                if (nearest && !encounteredCheckpointIdsRef.current.has(nearest.id)) {
                    encounteredCheckpointIdsRef.current.add(nearest.id);
                    checkpointsEncounteredRef.current += 1;
                }
                setNearbyCheckpoint(nearest);
            }
        );

        locationSubscriptionRef.current = subscription;
    }, [selectedRoute, isTracking, haversineDistance, loadCheckpoints]);

    // ── Arrêter le suivi & sauvegarder l'activité ──────────────────────────
    const stopTracking = useCallback(async () => {
        if (locationSubscriptionRef.current) {
            locationSubscriptionRef.current.remove();
            locationSubscriptionRef.current = null;
        }
        if (checkpointRefreshRef.current) {
            clearInterval(checkpointRefreshRef.current);
            checkpointRefreshRef.current = null;
        }

        // Calculer et sauvegarder les métriques d'activité
        const startTime = trackingStartTimeRef.current;
        const speeds = speedSamplesRef.current;
        const distM = distanceTraveledRef.current;
        const distKm = distM / 1000;
        const durationSec = startTime ? Math.round((Date.now() - new Date(startTime).getTime()) / 1000) : 0;
        const durationMin = durationSec / 60;
        const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
        const maxSpd = maxSpeedRef.current;
        const calories = estimateCalories(distKm, durationMin, travelMode, avgSpeed);
        const quality = computeQualityScore(speeds, distKm, durationMin, travelMode, wasOffRouteRef.current);

        // Régularité vitesse
        const avgS = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
        const variance = speeds.length > 0 ? speeds.reduce((s, v) => s + (v - avgS) ** 2, 0) / speeds.length : 0;
        const consistency = Math.max(0, 100 - Math.sqrt(variance) * 5);

        // Allure (pace) en secondes par km
        const pacePerKm = distKm > 0.01 ? durationSec / distKm : 0;

        if (durationSec > 30 && distM > 10) {
            try {
                await apiPost('/api/navigation/activity/log', {
                    travel_mode: travelMode,
                    origin_address: selectedRoute?.start_address || undefined,
                    destination_address: destination || selectedRoute?.end_address || undefined,
                    origin_lat: livePosition?.lat || lastPositionRef.current?.lat || undefined,
                    origin_lng: livePosition?.lng || lastPositionRef.current?.lng || undefined,
                    dest_lat: destinationCoords?.lat || undefined,
                    dest_lng: destinationCoords?.lng || undefined,
                    distance_meters: distM,
                    duration_seconds: durationSec,
                    avg_speed_kmh: Math.round(avgSpeed * 10) / 10,
                    max_speed_kmh: Math.round(maxSpd * 10) / 10,
                    calories_burned: Math.round(calories),
                    quality_score: quality,
                    speed_consistency: Math.round(consistency * 10) / 10,
                    pace_per_km_seconds: Math.round(pacePerKm),
                    checkpoints_reported: checkpointsReportedRef.current,
                    checkpoints_encountered: checkpointsEncounteredRef.current,
                    was_off_route: wasOffRouteRef.current,
                    started_at: startTime || new Date().toISOString(),
                });
                console.log(`[Navigation] Activité sauvegardée: ${distKm.toFixed(1)}km, ${durationMin.toFixed(0)}min, qualité=${quality}, calories=${Math.round(calories)}`);

                // Afficher le résumé de la session
                Alert.alert(
                    '🏁 Session terminée',
                    `📏 ${distKm.toFixed(1)} km parcourus\n⏱ ${Math.floor(durationMin)} min ${Math.round(durationSec % 60)} sec\n🔥 ${Math.round(calories)} calories brûlées\n⚡ Vitesse moy: ${avgSpeed.toFixed(1)} km/h\n⭐ Qualité: ${quality}/100`,
                    [{ text: 'Voir mes stats', onPress: () => { setShowActivityStats(true); loadActivityStats(activityPeriod); } }, { text: 'OK' }]
                );
            } catch (e) {
                console.error('[Navigation] Erreur sauvegarde activité:', e);
            }
        }

        setIsTracking(false);
        setNearbyCheckpoint(null);
        setIsOffRoute(false);
        setLivePosition(null);
    }, [travelMode, destination, livePosition, destinationCoords, selectedRoute, estimateCalories, computeQualityScore, activityPeriod, loadActivityStats]);

    // ── Cleanup au démontage ────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            // ✅ CLEANUP COMPLET: Éviter les memory leaks
            console.log('[Navigation] Cleanup ressources');

            // Nettoyer l'abonnement location
            if (locationSubscriptionRef.current) {
                try {
                    locationSubscriptionRef.current.remove();
                    console.log('[Navigation] Location subscription nettoyée');
                } catch (error) {
                    console.warn('[Navigation] Erreur cleanup location subscription:', error);
                }
                locationSubscriptionRef.current = null;
            }

            // Nettoyer l'intervalle de checkpoints
            if (checkpointRefreshIntervalRef.current) {
                try {
                    clearInterval(checkpointRefreshIntervalRef.current);
                    console.log('[Navigation] Checkpoint interval nettoyé');
                } catch (error) {
                    console.warn('[Navigation] Erreur cleanup checkpoint interval:', error);
                }
                checkpointRefreshIntervalRef.current = null;
            }

            // Nettoyer l'intervalle de tracking
            if (trackingUpdateIntervalRef.current) {
                try {
                    clearInterval(trackingUpdateIntervalRef.current);
                    console.log('[Navigation] Tracking interval nettoyé');
                } catch (error) {
                    console.warn('[Navigation] Erreur cleanup tracking interval:', error);
                }
                trackingUpdateIntervalRef.current = null;
            }

            // Réinitialiser les refs
            trackingStartTimeRef.current = null;
            lastPositionRef.current = null;
            speedSamplesRef.current = [];
            encounteredCheckpointIdsRef.current.clear();
        };
    }, []);

    // ── Labels checkpoint ──────────────────────────────────────────────────
    const CHECKPOINT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
        radar: { label: 'Radar', icon: '📸', color: '#EF4444' },
        police: { label: 'Contrôle police', icon: '👮', color: '#3B82F6' },
        accident: { label: 'Accident', icon: '🚨', color: '#F59E0B' },
        danger: { label: 'Danger', icon: '⚠️', color: '#EF4444' },
        road_works: { label: 'Travaux', icon: '🚧', color: '#F97316' },
        speed_bump: { label: 'Ralentisseur', icon: '🔶', color: '#8B5CF6' },
    };

    // ── Styles calculés pour le clavier ─────────────────────────────────────
    const dynamicStyles = useMemo(() => ({
        scrollContent: {
            padding: 16,
            paddingBottom: isKeyboardVisible && isLocationSelectorFocused ? Math.max(100, keyboardHeight + 100) : 100
        },
        locationSelectorDynamic: {
            ...styles.locationSelector,
            maxHeight: isKeyboardVisible && isLocationSelectorFocused ? Math.min(300, height - keyboardHeight - 200) : undefined,
            zIndex: isKeyboardVisible && isLocationSelectorFocused ? 1000 : 1,
            backgroundColor: isKeyboardVisible && isLocationSelectorFocused ? modernColors.surface : 'transparent',
            borderRadius: isKeyboardVisible && isLocationSelectorFocused ? 12 : 0,
            borderWidth: isKeyboardVisible && isLocationSelectorFocused ? 1 : 0,
            borderColor: modernColors.border,
            shadowColor: isKeyboardVisible && isLocationSelectorFocused ? '#000' : 'transparent',
            shadowOffset: isKeyboardVisible && isLocationSelectorFocused ? { width: 0, height: 2 } : { width: 0, height: 0 },
            shadowOpacity: isKeyboardVisible && isLocationSelectorFocused ? 0.1 : 0,
            shadowRadius: isKeyboardVisible && isLocationSelectorFocused ? 4 : 0,
            elevation: isKeyboardVisible && isLocationSelectorFocused ? 4 : 0
        }
    }), [isKeyboardVisible, keyboardHeight]);

    // ── Rendu ──────────────────────────────────────────────────────────────
    return (
        <SafeNativeView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={KEYBOARD_OFFSET}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={dynamicStyles.scrollContent}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    scrollEnabled={!isHorizontalScrolling}
                    keyboardShouldPersistTaps="handled"
                >
                            {/* ━━ Header avec icône ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                            <View style={styles.header}>
                                <View style={styles.headerLeft}>
                                    <View style={styles.headerIconWrap}>
                                        <SafeIcon name="Navigation" size={20} color="#FFFFFF" />
                                    </View>
                                    <View>
                                        <Text style={styles.title}>Navigation intelligente</Text>
                                        <Text style={styles.subtitle}>Itinéraires optimisés en temps réel</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.statsButton}
                                    onPress={() => setShowActivityDashboard(!showActivityDashboard)}
                                >
                                    <SafeIcon name={showActivityDashboard ? "X" : "Activity"} size={18} color={modernColors.text} />
                                </TouchableOpacity>
                            </View>

                            {/* ━━ Statistiques intelligentes (pliable) ━━━━━━━━━━━━━━━━━━ */}
                            {showActivityStats && (
                                <View style={styles.activityDashboard}>
                                    {/* Sélecteur de période */}
                                    <View style={styles.periodRow}>
                                        {(['week', 'month', 'year'] as const).map((p) => (
                                            <TouchableOpacity key={p} style={[styles.periodBtn, activityPeriod === p && styles.periodBtnActive]}
                                                onPress={() => { setActivityPeriod(p); loadActivityStats(p); }}>
                                                <Text style={[styles.periodBtnText, activityPeriod === p && styles.periodBtnTextActive]}>
                                                    {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {loadingActivity ? (
                            <NativeCard style={styles.statsCard}><ActivityIndicator size="small" color={modernColors.primary} /></NativeCard>
                        ) : activitySummary?.summary ? (
                            <>
                                {/* Métriques principales */}
                                <NativeCard style={styles.statsCard}>
                                    <View style={styles.statsRow}>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statValue}>{activitySummary.summary.total_sessions}</Text>
                                            <Text style={styles.statLabel}>Sessions</Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <Text style={styles.statValue}>{activitySummary.summary.total_distance_km?.toFixed(1)}</Text>
                                            <Text style={styles.statLabel}>km</Text>
                                        </View>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <Text style={styles.statValue}>{Math.round(activitySummary.summary.total_duration_minutes || 0)}</Text>
                                            <Text style={styles.statLabel}>minutes</Text>
                                        </View>
                                    </View>
                                </NativeCard>

                                {/* Santé & Calories */}
                                <NativeCard style={styles.healthCard}>
                                    <View style={styles.healthHeader}>
                                        <SafeIcon name="Heart" size={18} color="#EF4444" />
                                        <Text style={styles.healthTitle}>Santé & Performance</Text>
                                    </View>
                                    <View style={styles.healthGrid}>
                                        <View style={styles.healthItem}>
                                            <Text style={styles.healthEmoji}>🔥</Text>
                                            <Text style={styles.healthValue}>{Math.round(activitySummary.summary.total_calories || 0)}</Text>
                                            <Text style={styles.healthLabel}>calories</Text>
                                        </View>
                                        <View style={styles.healthItem}>
                                            <Text style={styles.healthEmoji}>⚡</Text>
                                            <Text style={styles.healthValue}>{(activitySummary.summary.avg_speed_kmh || 0).toFixed(1)}</Text>
                                            <Text style={styles.healthLabel}>km/h moy</Text>
                                        </View>
                                        <View style={styles.healthItem}>
                                            <Text style={styles.healthEmoji}>🏆</Text>
                                            <Text style={styles.healthValue}>{(activitySummary.summary.max_speed_kmh || 0).toFixed(0)}</Text>
                                            <Text style={styles.healthLabel}>km/h max</Text>
                                        </View>
                                        <View style={styles.healthItem}>
                                            <Text style={styles.healthEmoji}>⭐</Text>
                                            <Text style={styles.healthValue}>{Math.round(activitySummary.summary.avg_quality_score || 0)}</Text>
                                            <Text style={styles.healthLabel}>qualité /100</Text>
                                        </View>
                                    </View>
                                    {/* Indicateurs de santé */}
                                    <View style={styles.healthIndicators}>
                                        {(() => {
                                            const cal = activitySummary.summary.total_calories || 0;
                                            const dist = activitySummary.summary.total_distance_km || 0;
                                            const dur = activitySummary.summary.total_duration_minutes || 0;
                                            const quality = activitySummary.summary.avg_quality_score || 0;
                                            const indicators: { label: string; value: string; color: string; icon: string }[] = [];
                                            // Objectif calories hebdo (2000 kcal/semaine = référence OMS activité modérée)
                                            const calTarget = activityPeriod === 'week' ? 2000 : activityPeriod === 'month' ? 8000 : 100000;
                                            const calPct = Math.min(100, (cal / calTarget) * 100);
                                            indicators.push({ label: 'Objectif calories', value: `${Math.round(calPct)}%`, color: calPct >= 80 ? '#10B981' : calPct >= 50 ? '#F59E0B' : '#EF4444', icon: calPct >= 80 ? '💪' : '🎯' });
                                            // Activité physique (OMS: 150min/semaine d'activité modérée)
                                            const durTarget = activityPeriod === 'week' ? 150 : activityPeriod === 'month' ? 600 : 7800;
                                            const durPct = Math.min(100, (dur / durTarget) * 100);
                                            indicators.push({ label: 'Activité physique', value: `${Math.round(durPct)}%`, color: durPct >= 80 ? '#10B981' : durPct >= 50 ? '#F59E0B' : '#EF4444', icon: durPct >= 80 ? '🏃' : '🚶' });
                                            // Score qualité
                                            indicators.push({ label: 'Régularité', value: quality >= 70 ? 'Excellent' : quality >= 50 ? 'Bon' : 'À améliorer', color: quality >= 70 ? '#10B981' : quality >= 50 ? '#F59E0B' : '#EF4444', icon: quality >= 70 ? '🌟' : '📊' });
                                            return indicators.map((ind, i) => (
                                                <View key={i} style={styles.healthIndicatorRow}>
                                                    <Text style={styles.healthIndicatorIcon}>{ind.icon}</Text>
                                                    <Text style={styles.healthIndicatorLabel}>{ind.label}</Text>
                                                    <View style={styles.healthBarBg}>
                                                        <View style={[styles.healthBarFill, { width: `${isNaN(parseInt(ind.value)) ? 50 : parseInt(ind.value)}%` as any, backgroundColor: ind.color }]} />
                                                    </View>
                                                    <Text style={[styles.healthIndicatorValue, { color: ind.color }]}>{ind.value}</Text>
                                                </View>
                                            ));
                                        })()}
                                    </View>
                                </NativeCard>

                                {/* Meilleure session */}
                                {activitySummary.best_session && (
                                    <NativeCard style={styles.bestSessionCard}>
                                        <View style={styles.bestSessionHeader}>
                                            <Text style={styles.bestSessionEmoji}>🏅</Text>
                                            <Text style={styles.bestSessionTitle}>Meilleure session</Text>
                                        </View>
                                        <View style={styles.bestSessionRow}>
                                            <Text style={styles.bestSessionStat}>{activitySummary.best_session.distance_km?.toFixed(1)} km</Text>
                                            <Text style={styles.bestSessionStat}>{Math.round(activitySummary.best_session.duration_minutes || 0)} min</Text>
                                            <Text style={styles.bestSessionStat}>⭐ {Math.round(activitySummary.best_session.quality_score)}/100</Text>
                                        </View>
                                        <Text style={styles.bestSessionDate}>{activitySummary.best_session.date}</Text>
                                    </NativeCard>
                                )}

                                {/* Par mode de transport */}
                                {activitySummary.by_mode && activitySummary.by_mode.length > 0 && (
                                    <NativeCard style={styles.modeCard}>
                                        <Text style={styles.modeCardTitle}>Par mode de transport</Text>
                                        {activitySummary.by_mode.map((m: any, i: number) => (
                                            <View key={i} style={styles.modeRow}>
                                                <Text style={styles.modeIcon}>
                                                    {m.mode === 'walking' ? '🚶' : m.mode === 'bicycling' ? '🚲' : m.mode === 'transit' ? '🚌' : '🚗'}
                                                </Text>
                                                <Text style={styles.modeName}>
                                                    {m.mode === 'walking' ? 'Marche' : m.mode === 'bicycling' ? 'Vélo' : m.mode === 'transit' ? 'Transport' : 'Voiture'}
                                                </Text>
                                                <Text style={styles.modeCount}>{m.count}x</Text>
                                                <Text style={styles.modeDist}>{m.distance_km?.toFixed(1)} km</Text>
                                            </View>
                                        ))}
                                    </NativeCard>
                                )}

                                {/* Destinations les plus visitées */}
                                {activitySummary.top_destinations && activitySummary.top_destinations.length > 0 && (
                                    <NativeCard style={styles.destCard}>
                                        <View style={styles.destCardHeader}>
                                            <SafeIcon name="MapPin" size={16} color={modernColors.primary} />
                                            <Text style={styles.destCardTitle}>Lieux les plus visités</Text>
                                        </View>
                                        {activitySummary.top_destinations.slice(0, 5).map((d: any, i: number) => (
                                            <View key={i} style={styles.destRow}>
                                                <View style={styles.destRank}><Text style={styles.destRankText}>{i + 1}</Text></View>
                                                <Text style={styles.destName} numberOfLines={1}>{d.address}</Text>
                                                <Text style={styles.destVisits}>{d.visits}x</Text>
                                            </View>
                                        ))}
                                    </NativeCard>
                                )}

                                {/* Historique récent */}
                                {activityHistory.length > 0 && (
                                    <NativeCard style={styles.historyCard}>
                                        <Text style={styles.historyTitle}>Activités récentes</Text>
                                        {activityHistory.slice(0, 5).map((a: any, i: number) => (
                                            <View key={i} style={styles.historyRow}>
                                                <Text style={styles.historyIcon}>
                                                    {a.travel_mode === 'walking' ? '🚶' : a.travel_mode === 'bicycling' ? '🚲' : a.travel_mode === 'transit' ? '🚌' : '🚗'}
                                                </Text>
                                                <View style={styles.historyInfo}>
                                                    <Text style={styles.historyDest} numberOfLines={1}>{a.destination || 'Trajet'}</Text>
                                                    <Text style={styles.historyMeta}>
                                                        {a.distance_km?.toFixed(1)} km · {Math.round(a.duration_minutes || 0)} min · 🔥 {Math.round(a.calories || 0)} cal
                                                    </Text>
                                                </View>
                                                <View style={styles.historyQuality}>
                                                    <Text style={[styles.historyScore, { color: (a.quality_score || 0) >= 70 ? '#10B981' : (a.quality_score || 0) >= 50 ? '#F59E0B' : '#EF4444' }]}>
                                                        {Math.round(a.quality_score || 0)}
                                                    </Text>
                                                    <Text style={styles.historyScoreLabel}>/100</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </NativeCard>
                                )}

                                {/* ━━━━━━ COACH IA & ANALYSE AVANCÉE ━━━━━━ */}
                                {aiInsights && (
                                    <>
                                        {/* Bouton partage performances */}
                                        <View style={styles.sharePerformanceRow}>
                                            <Text style={styles.coachTitle}>🤖 Coach IA</Text>
                                            <TouchableOpacity onPress={sharePerformance} style={styles.sharePerformanceBtn}>
                                                <SafeIcon name="Share2" size={14} color="#fff" />
                                                <Text style={styles.sharePerformanceTxt}>Partager</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Score de santé global */}
                                        {aiInsights.health_score && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: aiInsights.health_score.score >= 80 ? '#10B981' : aiInsights.health_score.score >= 60 ? '#F59E0B' : aiInsights.health_score.score >= 40 ? '#FF6B35' : '#EF4444' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>🫀</Text>
                                                    <Text style={styles.healthTitle}>Score de Santé Global</Text>
                                                </View>
                                                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                                                    <View style={[styles.aiScoreCircle, { borderColor: aiInsights.health_score.score >= 80 ? '#10B981' : aiInsights.health_score.score >= 60 ? '#F59E0B' : '#EF4444' }]}>
                                                        <Text style={[styles.aiScoreValue, { color: aiInsights.health_score.score >= 80 ? '#10B981' : aiInsights.health_score.score >= 60 ? '#F59E0B' : '#EF4444' }]}>
                                                            {aiInsights.health_score.score}
                                                        </Text>
                                                        <Text style={styles.aiScoreMax}>/100</Text>
                                                    </View>
                                                    <Text style={[styles.aiScoreLabel, { color: aiInsights.health_score.score >= 80 ? '#10B981' : aiInsights.health_score.score >= 60 ? '#F59E0B' : '#EF4444' }]}>
                                                        {aiInsights.health_score.label}
                                                    </Text>
                                                </View>
                                                <View style={styles.aiBreakdownGrid}>
                                                    {[
                                                        { label: 'Activité', pts: aiInsights.health_score.breakdown?.activity || 0, max: 30, emoji: '🏃' },
                                                        { label: 'Qualité', pts: aiInsights.health_score.breakdown?.quality || 0, max: 20, emoji: '⭐' },
                                                        { label: 'Série', pts: aiInsights.health_score.breakdown?.streak || 0, max: 15, emoji: '🔥' },
                                                        { label: 'Éco', pts: aiInsights.health_score.breakdown?.eco || 0, max: 10, emoji: '🌍' },
                                                        { label: 'Fitness', pts: aiInsights.health_score.breakdown?.fitness || 0, max: 15, emoji: '❤️' },
                                                        { label: 'Diversité', pts: aiInsights.health_score.breakdown?.diversity || 0, max: 10, emoji: '🎯' },
                                                    ].map((item, i) => (
                                                        <View key={i} style={styles.aiBreakdownItem}>
                                                            <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                                                            <View style={styles.aiBreakdownBar}>
                                                                <View style={[styles.aiBreakdownFill, { width: `${(item.pts / item.max * 100)}%` as any, backgroundColor: item.pts >= item.max * 0.7 ? '#10B981' : '#F59E0B' }]} />
                                                            </View>
                                                            <Text style={styles.aiBreakdownPts}>{item.pts}/{item.max}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </NativeCard>
                                        )}

                                        {/* Recommandations IA personnalisées */}
                                        {aiInsights.ai_tips && aiInsights.ai_tips.length > 0 && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: '#8B5CF6' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>🤖</Text>
                                                    <Text style={[styles.healthTitle, { color: '#8B5CF6' }]}>Coach IA Yukpo</Text>
                                                </View>
                                                {aiInsights.ai_tips.map((tip: any, i: number) => (
                                                    <View key={i} style={[styles.aiTipCard, { borderLeftColor: tip.priority === 'critical' ? '#EF4444' : tip.priority === 'high' ? '#F59E0B' : tip.priority === 'positive' ? '#10B981' : '#6B7280' }]}>
                                                        <View style={styles.aiTipHeader}>
                                                            <Text style={{ fontSize: 18 }}>{tip.emoji}</Text>
                                                            <Text style={styles.aiTipTitle}>{tip.title}</Text>
                                                        </View>
                                                        <Text style={styles.aiTipMessage}>{tip.message}</Text>
                                                    </View>
                                                ))}
                                            </NativeCard>
                                        )}

                                        {/* Streak & Gamification */}
                                        {aiInsights.gamification && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>🎮</Text>
                                                    <Text style={styles.healthTitle}>Gamification</Text>
                                                </View>
                                                <View style={styles.aiStreakRow}>
                                                    <View style={styles.aiStreakItem}>
                                                        <Text style={styles.aiStreakEmoji}>🔥</Text>
                                                        <Text style={styles.aiStreakValue}>{aiInsights.gamification.current_streak}</Text>
                                                        <Text style={styles.aiStreakLabel}>jours d'affilée</Text>
                                                    </View>
                                                    <View style={styles.aiStreakItem}>
                                                        <Text style={styles.aiStreakEmoji}>🏆</Text>
                                                        <Text style={styles.aiStreakValue}>{aiInsights.gamification.max_streak}</Text>
                                                        <Text style={styles.aiStreakLabel}>record</Text>
                                                    </View>
                                                    <View style={styles.aiStreakItem}>
                                                        <Text style={styles.aiStreakEmoji}>⭐</Text>
                                                        <Text style={styles.aiStreakValue}>{aiInsights.gamification.total_points}</Text>
                                                        <Text style={styles.aiStreakLabel}>points</Text>
                                                    </View>
                                                </View>
                                                {aiInsights.gamification.badges && aiInsights.gamification.badges.length > 0 && (
                                                    <View style={styles.aiBadgesWrap}>
                                                        {aiInsights.gamification.badges.map((b: any, i: number) => (
                                                            <View key={i} style={styles.aiBadge}>
                                                                <Text style={{ fontSize: 20 }}>{b.emoji}</Text>
                                                                <Text style={styles.aiBadgeLabel} numberOfLines={1}>{b.label}</Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                                {aiInsights.gamification.new_badges && aiInsights.gamification.new_badges.length > 0 && (
                                                    <View style={[styles.aiNewBadgeBanner]}>
                                                        <Text style={styles.aiNewBadgeTitle}>🎉 Nouveaux badges !</Text>
                                                        {aiInsights.gamification.new_badges.map((b: any, i: number) => (
                                                            <Text key={i} style={styles.aiNewBadgeText}>{b.emoji} {b.label}</Text>
                                                        ))}
                                                    </View>
                                                )}
                                            </NativeCard>
                                        )}

                                        {/* Défis hebdomadaires */}
                                        {aiInsights.challenges && aiInsights.challenges.length > 0 && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>🎯</Text>
                                                    <Text style={styles.healthTitle}>Défis de la semaine</Text>
                                                </View>
                                                {aiInsights.challenges.map((c: any, i: number) => (
                                                    <View key={i} style={styles.aiChallengeRow}>
                                                        <View style={styles.aiChallengeHeader}>
                                                            <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
                                                            <Text style={styles.aiChallengeLabel} numberOfLines={1}>{c.label}</Text>
                                                            {c.completed && <Text style={styles.aiChallengeCheck}>✅</Text>}
                                                        </View>
                                                        <View style={styles.aiChallengeBarBg}>
                                                            <View style={[styles.aiChallengeBarFill, { width: `${c.progress}%` as any, backgroundColor: c.completed ? '#10B981' : '#3B82F6' }]} />
                                                        </View>
                                                        <Text style={styles.aiChallengeProgress}>
                                                            {c.type === 'sessions' ? `${Math.round(c.current)}/${Math.round(c.target)}` : `${c.current?.toFixed(1)}/${c.target?.toFixed(0)}`} — {Math.round(c.progress)}%
                                                        </Text>
                                                    </View>
                                                ))}
                                            </NativeCard>
                                        )}

                                        {/* Impact CO2 & Économies */}
                                        {aiInsights.co2_impact && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>🌍</Text>
                                                    <Text style={styles.healthTitle}>Impact Environnemental</Text>
                                                </View>
                                                <View style={styles.healthGrid}>
                                                    <View style={styles.healthItem}>
                                                        <Text style={styles.healthEmoji}>💨</Text>
                                                        <Text style={styles.healthValue}>{aiInsights.co2_impact.emitted_kg?.toFixed(1)}</Text>
                                                        <Text style={styles.healthLabel}>kg CO2 émis</Text>
                                                    </View>
                                                    <View style={styles.healthItem}>
                                                        <Text style={styles.healthEmoji}>🌱</Text>
                                                        <Text style={[styles.healthValue, { color: '#10B981' }]}>{aiInsights.co2_impact.saved_kg?.toFixed(1)}</Text>
                                                        <Text style={styles.healthLabel}>kg CO2 économisé</Text>
                                                    </View>
                                                    <View style={styles.healthItem}>
                                                        <Text style={styles.healthEmoji}>🌳</Text>
                                                        <Text style={styles.healthValue}>{aiInsights.co2_impact.trees_equivalent?.toFixed(1)}</Text>
                                                        <Text style={styles.healthLabel}>arbres plantés</Text>
                                                    </View>
                                                    <View style={styles.healthItem}>
                                                        <Text style={styles.healthEmoji}>💰</Text>
                                                        <Text style={[styles.healthValue, { color: '#10B981' }]}>{Math.round(aiInsights.co2_impact.fuel_cost_saved || aiInsights.co2_impact.fuel_cost_saved_fcfa || 0)}</Text>
                                                        <Text style={styles.healthLabel}>{aiInsights.co2_impact.currency_symbol || aiInsights.geo_context?.currency_symbol || 'FCFA'} économisés</Text>
                                                    </View>
                                                </View>
                                            </NativeCard>
                                        )}

                                        {/* Niveau de fitness (VO2max) */}
                                        {aiInsights.fitness && aiInsights.fitness.vo2max_estimate > 0 && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: '#EF4444' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>❤️</Text>
                                                    <Text style={styles.healthTitle}>Condition Physique</Text>
                                                </View>
                                                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                                                    <Text style={styles.aiFitnessVO2}>{aiInsights.fitness.vo2max_estimate}</Text>
                                                    <Text style={styles.aiFitnessUnit}>VO2max (ml/kg/min)</Text>
                                                    <View style={[styles.aiFitnessLevel, { backgroundColor: aiInsights.fitness.level === 'Excellent' ? '#10B98120' : aiInsights.fitness.level === 'Très bon' ? '#3B82F620' : '#F59E0B20' }]}>
                                                        <Text style={[styles.aiFitnessLevelText, { color: aiInsights.fitness.level === 'Excellent' ? '#10B981' : aiInsights.fitness.level === 'Très bon' ? '#3B82F6' : '#F59E0B' }]}>
                                                            {aiInsights.fitness.level}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={styles.healthIndicators}>
                                                    <View style={styles.healthIndicatorRow}>
                                                        <Text style={styles.healthIndicatorIcon}>🏃</Text>
                                                        <Text style={styles.healthIndicatorLabel}>Objectif OMS (150 min/sem)</Text>
                                                        <View style={styles.healthBarBg}>
                                                            <View style={[styles.healthBarFill, { width: `${aiInsights.fitness.oms_progress_pct}%` as any, backgroundColor: aiInsights.fitness.oms_progress_pct >= 100 ? '#10B981' : '#F59E0B' }]} />
                                                        </View>
                                                        <Text style={[styles.healthIndicatorValue, { color: aiInsights.fitness.oms_progress_pct >= 100 ? '#10B981' : '#F59E0B' }]}>
                                                            {aiInsights.fitness.oms_progress_pct}%
                                                        </Text>
                                                    </View>
                                                </View>
                                            </NativeCard>
                                        )}

                                        {/* Records personnels */}
                                        {aiInsights.records && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: '#FFD700' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>🏅</Text>
                                                    <Text style={styles.healthTitle}>Records Personnels</Text>
                                                </View>
                                                <View style={styles.aiRecordsList}>
                                                    {aiInsights.records.longest_session && (
                                                        <View style={styles.aiRecordRow}>
                                                            <Text style={styles.aiRecordEmoji}>📏</Text>
                                                            <View style={styles.aiRecordInfo}>
                                                                <Text style={styles.aiRecordTitle}>Plus longue session</Text>
                                                                <Text style={styles.aiRecordValue}>
                                                                    {aiInsights.records.longest_session.distance_km?.toFixed(1)} km · {Math.round(aiInsights.records.longest_session.duration_minutes)} min
                                                                </Text>
                                                            </View>
                                                            <Text style={styles.aiRecordDate}>{aiInsights.records.longest_session.date}</Text>
                                                        </View>
                                                    )}
                                                    {aiInsights.records.fastest_km && (
                                                        <View style={styles.aiRecordRow}>
                                                            <Text style={styles.aiRecordEmoji}>⚡</Text>
                                                            <View style={styles.aiRecordInfo}>
                                                                <Text style={styles.aiRecordTitle}>Meilleur km</Text>
                                                                <Text style={styles.aiRecordValue}>{aiInsights.records.fastest_km.pace_display}</Text>
                                                            </View>
                                                            <Text style={styles.aiRecordDate}>{aiInsights.records.fastest_km.date}</Text>
                                                        </View>
                                                    )}
                                                    {aiInsights.records.best_quality && (
                                                        <View style={styles.aiRecordRow}>
                                                            <Text style={styles.aiRecordEmoji}>⭐</Text>
                                                            <View style={styles.aiRecordInfo}>
                                                                <Text style={styles.aiRecordTitle}>Meilleure qualité</Text>
                                                                <Text style={styles.aiRecordValue}>{Math.round(aiInsights.records.best_quality.score)}/100</Text>
                                                            </View>
                                                            <Text style={styles.aiRecordDate}>{aiInsights.records.best_quality.date}</Text>
                                                        </View>
                                                    )}
                                                    {aiInsights.records.most_calories && (
                                                        <View style={styles.aiRecordRow}>
                                                            <Text style={styles.aiRecordEmoji}>🔥</Text>
                                                            <View style={styles.aiRecordInfo}>
                                                                <Text style={styles.aiRecordTitle}>Max calories</Text>
                                                                <Text style={styles.aiRecordValue}>{Math.round(aiInsights.records.most_calories.calories)} cal</Text>
                                                            </View>
                                                            <Text style={styles.aiRecordDate}>{aiInsights.records.most_calories.date}</Text>
                                                        </View>
                                                    )}
                                                    {aiInsights.records.max_speed && (
                                                        <View style={styles.aiRecordRow}>
                                                            <Text style={styles.aiRecordEmoji}>🚀</Text>
                                                            <View style={styles.aiRecordInfo}>
                                                                <Text style={styles.aiRecordTitle}>Vitesse max</Text>
                                                                <Text style={styles.aiRecordValue}>{aiInsights.records.max_speed.speed_kmh?.toFixed(1)} km/h</Text>
                                                            </View>
                                                            <Text style={styles.aiRecordDate}>{aiInsights.records.max_speed.date}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.aiRecordsTotals}>
                                                    <Text style={styles.aiRecordTotal}>Total: {aiInsights.records.total_km?.toFixed(0)} km · {aiInsights.records.total_sessions} sessions · {Math.round(aiInsights.records.total_calories || 0)} cal</Text>
                                                </View>
                                            </NativeCard>
                                        )}

                                        {/* Commute Insights */}
                                        {aiInsights.commute?.frequent_routes && aiInsights.commute.frequent_routes.length > 0 && (
                                            <NativeCard style={[styles.healthCard, { borderLeftWidth: 4, borderLeftColor: '#6366F1' }]}>
                                                <View style={styles.healthHeader}>
                                                    <Text style={{ fontSize: 22 }}>🏠</Text>
                                                    <Text style={styles.healthTitle}>Trajets Habituels</Text>
                                                </View>
                                                {aiInsights.commute.frequent_routes.map((r: any, i: number) => (
                                                    <View key={i} style={styles.aiCommuteRow}>
                                                        <Text style={styles.aiCommuteFrom} numberOfLines={1}>{r.from}</Text>
                                                        <Text style={styles.aiCommuteArrow}>→</Text>
                                                        <Text style={styles.aiCommuteTo} numberOfLines={1}>{r.to}</Text>
                                                        <Text style={styles.aiCommuteMeta}>{r.trips}x · {Math.round(r.avg_duration_minutes)} min</Text>
                                                    </View>
                                                ))}
                                                {aiInsights.commute.peak_hours && aiInsights.commute.peak_hours.length > 0 && (
                                                    <View style={styles.aiPeakHours}>
                                                        <Text style={styles.aiPeakTitle}>🕐 Heures de départ fréquentes</Text>
                                                        <View style={styles.aiPeakRow}>
                                                            {aiInsights.commute.peak_hours.slice(0, 4).map((h: any, i: number) => (
                                                                <View key={i} style={styles.aiPeakBadge}>
                                                                    <Text style={styles.aiPeakHour}>{h.hour}h</Text>
                                                                    <Text style={styles.aiPeakCount}>{h.trips}x</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    </View>
                                                )}
                                            </NativeCard>
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <NativeCard style={styles.statsCard}>
                                <Text style={{ textAlign: 'center', color: modernColors.textSecondary, fontSize: 14, padding: 20 }}>
                                    Aucune activité enregistrée. Démarrez un suivi pour voir vos statistiques !
                                </Text>
                            </NativeCard>
                        )}
                )}

                        {/* ━━ Mode de transport ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        <View style={styles.travelModeRow}>
                            {TRAVEL_MODES.map((mode) => {
                                const isActive = travelMode === mode.key;
                                return (
                                    <TouchableOpacity
                                        key={mode.key}
                                        style={[styles.travelModeBtn, isActive && { backgroundColor: mode.color + '15', borderColor: mode.color }]}
                                        onPress={() => { setTravelMode(mode.key); if (routes.length > 0) setTimeout(() => searchRoutesRef.current(), 100); }}
                                        activeOpacity={0.7}
                                    >
                                        <SafeIcon name={mode.icon} size={18} color={isActive ? mode.color : modernColors.textSecondary} />
                                        <Text style={[styles.travelModeLabel, isActive && { color: mode.color, fontWeight: '700' }]}>{mode.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* ━━ Destinations favorites (chips) ━━━━━━━━━━━━━━━━━━━━━━ */}
                        {savedDestinations.length > 0 && !destination && (
                            <ScrollView
                                horizontal showsHorizontalScrollIndicator={false}
                                style={styles.favoritesScroll} contentContainerStyle={styles.favoritesContent}
                                nestedScrollEnabled={true}
                                onScrollBeginDrag={() => {
                                    setIsHorizontalScrolling(true);
                                    if (scrollViewRef.current) {
                                        scrollViewRef.current.setNativeProps({ scrollEnabled: false });
                                    }
                                }}
                                onScrollEndDrag={() => {
                                    setIsHorizontalScrolling(false);
                                    if (scrollViewRef.current) {
                                        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
                                    }
                                }}
                                onMomentumScrollBegin={() => {
                                    setIsHorizontalScrolling(true);
                                    if (scrollViewRef.current) {
                                        scrollViewRef.current.setNativeProps({ scrollEnabled: false });
                                    }
                                }}
                                onMomentumScrollEnd={() => {
                                    setIsHorizontalScrolling(false);
                                    if (scrollViewRef.current) {
                                        scrollViewRef.current.setNativeProps({ scrollEnabled: true });
                                    }
                                }}
                            >
                                {savedDestinations.slice(0, 5).map((dest) => (
                                    <TouchableOpacity key={dest.id} style={styles.favoriteChip}
                                        onPress={() => {
                                            setDestination(dest.custom_label || dest.label);
                                            setDestinationCoords({ lat: dest.latitude, lng: dest.longitude });
                                            setTimeout(() => searchRoutesRef.current(), 200);
                                        }}>
                                        <SafeIcon name={dest.label === 'domicile' ? 'Home' : dest.label === 'bureau' ? 'Briefcase' : 'MapPin'} size={14} color={modernColors.primary} />
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
                                                setTimeout(() => searchRoutesRef.current(), 200);
                                            } else {
                                                geocodeDestination(locationText).then((coords) => {
                                                    if (coords) { setDestinationCoords(coords); setTimeout(() => searchRoutesRef.current(), 200); }
                                                });
                                            }
                                        }}
                                    }}
                                    placeholder="Où allez-vous ?"
                                    scope="all"
                                    style={dynamicStyles.locationSelectorDynamic}
                                    onFocus={() => setIsLocationSelectorFocused(true)}
                                    onBlur={() => setIsLocationSelectorFocused(false)}
                                />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                                onPress={searchRoutes}
                                disabled={loading || (!destination.trim() && !selectedLocation)}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <><ActivityIndicator color="white" size="small" /><Text style={styles.searchButtonText}> Recherche en cours...</Text></>
                                ) : (
                                    <><SafeIcon name="Search" size={18} color="white" /><Text style={styles.searchButtonText}> Trouver mon itinéraire</Text></>
                                )}
                            </TouchableOpacity>

                            {/* Actions sous le bouton rechercher */}
                            {destinationCoords && (
                                <View style={styles.destActionsRow}>
                                    <TouchableOpacity style={styles.saveDestBtn} onPress={() => {
                                        Alert.alert('Enregistrer destination', 'Choisissez un type', [
                                            { text: 'Domicile', onPress: () => saveDestination('domicile') },
                                            { text: 'Bureau', onPress: () => saveDestination('bureau') },
                                            {
                                                text: 'Personnalisé', onPress: () => {
                                                    if (Platform.OS === 'ios' && Alert.prompt) {
                                                        Alert.prompt('Nom personnalisé', 'Donnez un nom à cette destination', (name: string) => {
                                                            if (name?.trim()) saveDestination('autre', name.trim());
                                                        });
                                                    } else {
                                                        const customName = destination?.trim() ? destination.trim().substring(0, 30) : 'Favori';
                                                        saveDestination('autre', customName);
                                                    }
                                                }
                                            },
                                            { text: 'Annuler', style: 'cancel' },
                                        ]);
                                    }}>
                                        <SafeIcon name="Bookmark" size={14} color={modernColors.primary} />
                                        <Text style={styles.saveDestText}>Enregistrer</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.saveDestBtn} onPress={() => setShowPrefs(!showPrefs)}>
                                        <SafeIcon name="Sliders" size={14} color={modernColors.textSecondary} />
                                        <Text style={[styles.saveDestText, { color: modernColors.textSecondary }]}>Options</Text>
                                    </TouchableOpacity>
                                    {/* ✅ NOUVEAU: Ajouter un waypoint */}
                                    <TouchableOpacity style={styles.saveDestBtn} onPress={() => {
                                        Alert.alert('Ajouter une étape', 'Voulez-vous ajouter un point intermédiaire à votre itinéraire ?', [
                                            {
                                                text: 'Ajouter ma position actuelle',
                                                onPress: async () => {
                                                    const currentPos = await getCurrentPosition();
                                                    if (currentPos) {
                                                        const newWaypoint = {
                                                            lat: currentPos.lat,
                                                            lng: currentPos.lng,
                                                            name: 'Position actuelle'
                                                        };
                                                        setWaypoints([...waypoints, newWaypoint]);
                                                        Alert.alert('Étape ajoutée', 'Position actuelle ajoutée comme étape intermédiaire');
                                                    }
                                                }
                                            },
                                            {
                                                text: 'Choisir une adresse',
                                                onPress: () => {
                                                    // TODO: Ouvrir un écran de sélection d'adresse
                                                    Alert.alert('Bientôt disponible', 'La sélection d\'adresse personnalisée arrive bientôt!');
                                                }
                                            },
                                            { text: 'Annuler', style: 'cancel' }
                                        ]);
                                    }}>
                                        <SafeIcon name="Plus" size={14} color={modernColors.primary} />
                                        <Text style={styles.saveDestText}>Ajouter étape</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </NativeCard>

                        {/* ━━ Préférences de route (pliable) ━━━━━━━━━━━━━━━━━━━━━━ */}
                        {showPrefs && (
                            <View style={styles.prefsRow}>
                                <TouchableOpacity style={[styles.prefChip, avoidTolls && styles.prefChipActive]} onPress={() => { setAvoidTolls(!avoidTolls); if (routes.length > 0) setTimeout(() => searchRoutesRef.current(), 200); }}>
                                    <Text style={[styles.prefChipText, avoidTolls && styles.prefChipTextActive]}>Éviter péages</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.prefChip, avoidHighways && styles.prefChipActive]} onPress={() => { setAvoidHighways(!avoidHighways); if (routes.length > 0) setTimeout(() => searchRoutesRef.current(), 200); }}>
                                    <Text style={[styles.prefChipText, avoidHighways && styles.prefChipTextActive]}>Éviter autoroutes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.prefChip, avoidFerries && styles.prefChipActive]} onPress={() => { setAvoidFerries(!avoidFerries); if (routes.length > 0) setTimeout(() => searchRoutesRef.current(), 200); }}>
                                    <Text style={[styles.prefChipText, avoidFerries && styles.prefChipTextActive]}>Éviter ferries</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ━━ Étapes (waypoints) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {waypoints.length > 0 && (
                            <NativeCard style={styles.waypointsCard}>
                                <Text style={styles.waypointsTitle}>Mes étapes ({waypoints.length})</Text>
                                {waypoints.map((wp, idx) => (
                                    <View key={idx} style={styles.waypointRow}>
                                        <View style={styles.waypointBadge}><Text style={styles.waypointBadgeText}>{idx + 1}</Text></View>
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

                        {/* ✅ NOUVEAU: Waypoints (étapes intermédiaires) */}
                        {waypoints.length > 0 && (
                            <NativeCard style={styles.waypointsCard}>
                                <View style={styles.waypointsHeader}>
                                    <SafeIcon name="MapPin" size={16} color={modernColors.primary} />
                                    <Text style={styles.waypointsTitle}>Étapes intermédiaires ({waypoints.length})</Text>
                                    <TouchableOpacity
                                        style={styles.clearWaypointsBtn}
                                        onPress={() => {
                                            setWaypoints([]);
                                            Alert.alert('Étapes supprimées', 'Toutes les étapes intermédiaires ont été supprimées');
                                        }}
                                    >
                                        <SafeIcon name="X" size={14} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                {waypoints.map((waypoint, index) => (
                                    <View key={index} style={styles.waypointItem}>
                                        <View style={styles.waypointIndex}>
                                            <Text style={styles.waypointIndexText}>{index + 1}</Text>
                                        </View>
                                        <View style={styles.waypointInfo}>
                                            <Text style={styles.waypointName}>{waypoint.name}</Text>
                                            <Text style={styles.waypointCoords}>{waypoint.lat.toFixed(6)}, {waypoint.lng.toFixed(6)}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.removeWaypointBtn}
                                            onPress={() => {
                                                const newWaypoints = waypoints.filter((_, i) => i !== index);
                                                setWaypoints(newWaypoints);
                                                Alert.alert('Étape supprimée', `L'étape "${waypoint.name}" a été supprimée`);
                                            }}
                                        >
                                            <SafeIcon name="Trash2" size={14} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </NativeCard>
                        )}

                        {/* ━━ Routes disponibles (enrichies) ━━━━━━━━━━━━━━━━━━━━━━ */}
                        {routes.length > 0 && (
                            <View style={styles.routesSection}>
                                <View style={styles.routesSectionHeader}>
                                    <Text style={styles.sectionTitle}>{routes.length} itinéraire{routes.length > 1 ? 's' : ''}</Text>
                                    {selectedRoute && (
                                        <TouchableOpacity onPress={shareRoute} style={styles.shareBtn}>
                                            <SafeIcon name="Share2" size={16} color={modernColors.primary} />
                                            <Text style={styles.shareBtnText}>Partager</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <ScrollView
                                    ref={horizontalScrollRef}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    nestedScrollEnabled={true}
                                    contentContainerStyle={{ paddingRight: 16 }}
                                    snapToInterval={routeCardWidth}
                                    snapToAlignment="start"
                                    decelerationRate="fast"
                                    onScrollBeginDrag={() => {
                                        setIsHorizontalScrolling(true);
                                        // Désactiver temporairement le scroll vertical du parent
                                        if (scrollViewRef.current) {
                                            scrollViewRef.current.setNativeProps({ scrollEnabled: false });
                                        }
                                    }}
                                    onScrollEndDrag={() => {
                                        setIsHorizontalScrolling(false);
                                        // Réactiver le scroll vertical du parent
                                        if (scrollViewRef.current) {
                                            scrollViewRef.current.setNativeProps({ scrollEnabled: true });
                                        }
                                    }}
                                    onMomentumScrollBegin={() => {
                                        setIsHorizontalScrolling(true);
                                        if (scrollViewRef.current) {
                                            scrollViewRef.current.setNativeProps({ scrollEnabled: false });
                                        }
                                    }}
                                    onMomentumScrollEnd={() => {
                                        setIsHorizontalScrolling(false);
                                        if (scrollViewRef.current) {
                                            scrollViewRef.current.setNativeProps({ scrollEnabled: true });
                                        }
                                    }}
                                >
                                    {routes.map((item, index) => {
                                        const isSelected = selectedRoute?.id === item.id;
                                        const trafficColor = getTrafficColor(item.traffic_level);
                                        const duration = item.duration_in_traffic_seconds || item.duration_seconds;
                                        const delay = (item.duration_in_traffic_seconds && item.duration_in_traffic_seconds > item.duration_seconds)
                                            ? item.duration_in_traffic_seconds - item.duration_seconds : 0;

                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={[styles.routeCard, isSelected && styles.routeCardSelected]}
                                                onPress={() => { setSelectedRoute(item); loadPointsOfInterest(item); }}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.routeTopRow}>
                                                    <View style={[styles.routeNumberBadge, isSelected && { backgroundColor: modernColors.primary }]}>
                                                        <Text style={styles.routeNumber}>{index + 1}</Text>
                                                    </View>
                                                    <View style={[styles.trafficBadge, { backgroundColor: trafficColor + '20' }]}>
                                                        <View style={[styles.trafficDot, { backgroundColor: trafficColor }]} />
                                                        <Text style={[styles.trafficText, { color: trafficColor }]}>{getTrafficLabel(item.traffic_level)}</Text>
                                                    </View>
                                                    {index === 0 && <View style={styles.fastestBadge}><Text style={styles.fastestText}>Recommandé</Text></View>}
                                                </View>
                                                <Text style={styles.routeSummary} numberOfLines={1}>{item.summary || `Via ${item.end_address?.split(',')[0] || `Itinéraire ${index + 1}`}`}</Text>
                                                {/* Métriques principales */}
                                                <View style={styles.routeMetrics}>
                                                    <View style={styles.routeMetric}>
                                                        <SafeIcon name="Clock" size={13} color={modernColors.textSecondary} />
                                                        <Text style={styles.routeMetricValue}>{formatDuration(duration)}</Text>
                                                    </View>
                                                    <View style={styles.routeMetric}>
                                                        <SafeIcon name="MapPin" size={13} color={modernColors.textSecondary} />
                                                        <Text style={styles.routeMetricValue}>{formatDistance(item.distance_meters)}</Text>
                                                    </View>
                                                    {item.arrival_time && (
                                                        <View style={styles.routeMetric}>
                                                            <SafeIcon name="Flag" size={13} color={modernColors.primary} />
                                                            <Text style={[styles.routeMetricValue, { color: modernColors.primary, fontWeight: '700' }]}>{item.arrival_time}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {/* Délai trafic */}
                                                {delay > 0 && (
                                                    <Text style={styles.trafficDelay}>+{formatDuration(delay)} (embouteillage)</Text>
                                                )}
                                                {/* Tarif transit */}
                                                {item.fare && (
                                                    <View style={styles.fareBadge}>
                                                        <Text style={styles.fareText}>{item.fare.text}</Text>
                                                    </View>
                                                )}
                                                {/* Avertissements */}
                                                {item.warnings && item.warnings.length > 0 && (
                                                    <Text style={styles.warningText} numberOfLines={1}>{item.warnings[0]}</Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Alertes trafic */}
                        {selectedRoute?.warnings && selectedRoute.warnings.length > 0 && (
                            <NativeCard style={styles.trafficAlertsCard}>
                                <View style={styles.trafficAlertsHeader}>
                                    <SafeIcon name="AlertTriangle" size={16} color="#F59E0B" />
                                    <Text style={styles.trafficAlertsTitle}>Informations trafic ({selectedRoute.warnings.length})</Text>
                                </View>
                                {selectedRoute.warnings.map((warning: string, index: number) => (
                                    <View key={index} style={styles.trafficAlertItem}>
                                        <SafeIcon name="Info" size={14} color="#F59E0B" />
                                        <Text style={styles.trafficAlertText}>{warning}</Text>
                                    </View>
                                ))}
                            </NativeCard>
                        )}

                        {/* ✅ NOUVEAU: Étapes détaillées */}
                        {selectedRoute && (
                            <NativeCard style={styles.stepsCard}>
                                <TouchableOpacity
                                    style={styles.stepsHeader}
                                    onPress={() => setShowSteps(!showSteps)}
                                >
                                    <View style={styles.stepsHeaderLeft}>
                                        <SafeIcon name="List" size={16} color={modernColors.primary} />
                                        <Text style={styles.stepsTitle}>Étapes détaillées</Text>
                                        <Text style={styles.stepsCount}>{selectedRoute.steps?.length || 0} étapes</Text>
                                    </View>
                                    <SafeIcon
                                        name={showSteps ? "ChevronUp" : "ChevronDown"}
                                        size={16}
                                        color={modernColors.textSecondary}
                                    />
                                </TouchableOpacity>

                                {showSteps && selectedRoute.steps && (
                                    <View style={styles.stepsList}>
                                        {selectedRoute.steps.map((step: any, index: number) => (
                                            <View key={index} style={styles.stepItem}>
                                                <View style={styles.stepIndex}>
                                                    <Text style={styles.stepIndexText}>{index + 1}</Text>
                                                </View>
                                                <View style={styles.stepInfo}>
                                                    <Text style={styles.stepInstruction}>{step.instructions || 'Continuer'}</Text>
                                                    <View style={styles.stepDetails}>
                                                        <Text style={styles.stepDistance}>{(step.distance?.text || `${Math.round(step.distance || 0)}m`)}</Text>
                                                        <Text style={styles.stepDuration}>{(step.duration?.text || `${Math.round((step.duration || 0) / 60)}min`)}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </NativeCard>
                        )}

                        {/* ━━ Carte interactive ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {(selectedRoute || destinationCoords) && showMap && mapRegion && (
                            <View style={styles.mapContainer}>
                                <View style={styles.mapHeader}>
                                    <View style={styles.mapHeaderLeft}>
                                        <SafeIcon name="Map" size={16} color={modernColors.primary} />
                                        <Text style={styles.mapHeaderTitle}>Carte du trajet</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setShowMap(false)} style={styles.mapToggleBtn}>
                                        <SafeIcon name="Minimize2" size={16} color={modernColors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                <MapView
                                    ref={mapRef}
                                    style={styles.mapView}
                                    provider={PROVIDER_GOOGLE}
                                    initialRegion={mapRegion}
                                    showsUserLocation={true}
                                    showsMyLocationButton={false}
                                    showsTraffic={true}
                                    showsCompass={true}
                                    showsScale={true}
                                    loadingEnabled={true}
                                    loadingIndicatorColor={modernColors.primary}
                                >
                                    {/* Polyline de la route */}
                                    {routePolylineCoords.length > 1 && (
                                        <Polyline
                                            coordinates={routePolylineCoords}
                                            strokeColor={modernColors.primary}
                                            strokeWidth={4}
                                        />
                                    )}

                                    {/* Marqueur destination */}
                                    {destinationCoords && (
                                        <Marker
                                            coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}
                                            title={destination || 'Destination'}
                                            pinColor="#EF4444"
                                            tracksViewChanges={false}
                                        />
                                    )}

                                    {/* Marqueur position live (tracking) */}
                                    {isTracking && livePosition && (
                                        <Marker
                                            coordinate={{ latitude: livePosition.lat, longitude: livePosition.lng }}
                                            title="Ma position"
                                            pinColor="#3B82F6"
                                            tracksViewChanges={true}
                                        />
                                    )}

                                    {/* Marqueurs checkpoints */}
                                    {checkpoints.slice(0, 10).map((cp) => {
                                        const cpInfo = CHECKPOINT_LABELS[cp.checkpoint_type] || { label: cp.checkpoint_type, icon: '⚠️', color: '#6B7280' };
                                        return (
                                            <Marker
                                                key={cp.id}
                                                coordinate={{ latitude: cp.latitude, longitude: cp.longitude }}
                                                title={`${cpInfo.icon} ${cpInfo.label}`}
                                                description={cp.description || (cp.speed_limit ? `Limite: ${cp.speed_limit} km/h` : undefined)}
                                                pinColor={cpInfo.color}
                                                tracksViewChanges={false}
                                            />
                                        );
                                    })}

                                    {/* Marqueurs POI (top 5 visibles) */}
                                    {pointsOfInterest.slice(0, 5).map((poi) => (
                                        <Marker
                                            key={poi.id}
                                            coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
                                            title={poi.name}
                                            description={poi.address || `${formatDistance(poi.distance_from_route_meters)} de détour`}
                                            pinColor="#10B981"
                                            tracksViewChanges={false}
                                        />
                                    ))}
                                </MapView>

                                {/* Bouton recentrer */}
                                <TouchableOpacity
                                    style={styles.mapRecenterBtn}
                                    onPress={() => {
                                        if (routePolylineCoords.length > 1 && mapRef.current) {
                                            mapRef.current.fitToCoordinates(routePolylineCoords, {
                                                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                                                animated: true,
                                            });
                                        } else if (livePosition && mapRef.current) {
                                            mapRef.current.animateToRegion({
                                                latitude: livePosition.lat, longitude: livePosition.lng,
                                                latitudeDelta: 0.01, longitudeDelta: 0.01,
                                            }, 500);
                                        }
                                    }}
                                >
                                    <SafeIcon name="Crosshair" size={18} color={modernColors.primary} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Bouton ouvrir carte si masquée */}
                        {(selectedRoute || destinationCoords) && !showMap && (
                            <TouchableOpacity style={styles.showMapBtn} onPress={() => setShowMap(true)}>
                                <SafeIcon name="Map" size={16} color={modernColors.primary} />
                                <Text style={styles.showMapBtnText}>Afficher la carte</Text>
                            </TouchableOpacity>
                        )}

                        {/* ━━ Tableau de bord navigation en temps réel ━━━━━━━━━━━━━ */}
                        {isTracking && selectedRoute && (
                            <View style={styles.trackingSection}>
                                {/* Analyse IA risque trajet */}
                                {checkpointAiAnalysis && (
                                    <View style={[styles.aiRiskBanner, { borderLeftColor: (checkpointAiAnalysis.risk_level || 0) >= 7 ? '#EF4444' : (checkpointAiAnalysis.risk_level || 0) >= 4 ? '#F59E0B' : '#10B981' }]}>
                                        <View style={styles.aiRiskHeader}>
                                            <Text style={{ fontSize: 18 }}>{(checkpointAiAnalysis.risk_level || 0) >= 7 ? '🚨' : (checkpointAiAnalysis.risk_level || 0) >= 4 ? '⚠️' : '✅'}</Text>
                                            <Text style={[styles.aiRiskTitle, { color: (checkpointAiAnalysis.risk_level || 0) >= 7 ? '#EF4444' : (checkpointAiAnalysis.risk_level || 0) >= 4 ? '#F59E0B' : '#10B981' }]}>
                                                Risque {checkpointAiAnalysis.risk_label || 'Inconnu'} ({checkpointAiAnalysis.risk_level}/10)
                                            </Text>
                                        </View>
                                        {checkpointAiAnalysis.driving_tip && <Text style={styles.aiRiskTip}>{checkpointAiAnalysis.driving_tip}</Text>}
                                        {checkpointAiAnalysis.alerts?.map((a: any, i: number) => (
                                            <View key={i} style={[styles.aiRiskAlertRow, { borderLeftColor: a.severity === 'critical' ? '#EF4444' : a.severity === 'warning' ? '#F59E0B' : '#6B7280' }]}>
                                                <Text style={styles.aiRiskAlertMsg}>{a.message}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Alerte checkpoint proche */}
                                {nearbyCheckpoint && (
                                    <View style={[styles.checkpointAlert, { backgroundColor: (CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color || '#EF4444') + '15' }]}>
                                        <Text style={styles.checkpointAlertIcon}>{CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.icon || '⚠️'}</Text>
                                        <View style={styles.checkpointAlertInfo}>
                                            <Text style={[styles.checkpointAlertTitle, { color: CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color || '#EF4444' }]}>
                                                {CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.label || 'Attention'} dans {nearbyCheckpoint.distance}m
                                            </Text>
                                            {nearbyCheckpoint.speed_limit && (
                                                <Text style={styles.checkpointAlertSpeed}>Vitesse limitée : {nearbyCheckpoint.speed_limit} km/h</Text>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Alerte déviation */}
                                {isOffRoute && (
                                    <TouchableOpacity style={styles.deviationAlert} onPress={() => { stopTracking(); searchRoutesRef.current(); }}>
                                        <SafeIcon name="AlertTriangle" size={18} color="#EF4444" />
                                        <Text style={styles.deviationText}>Vous avez quitté l'itinéraire — Appuyez pour recalculer</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Dashboard vitesse + progression */}
                                <NativeCard style={styles.trackingCard}>
                                    <View style={styles.trackingTopRow}>
                                        {/* Vitesse actuelle */}
                                        <View style={styles.speedGauge}>
                                            <Text style={styles.speedValue}>{Math.round(currentSpeed)}</Text>
                                            <Text style={styles.speedUnit}>km/h</Text>
                                        </View>
                                        {/* Métriques restantes */}
                                        <View style={styles.trackingMetrics}>
                                            <View style={styles.trackingMetric}>
                                                <SafeIcon name="MapPin" size={14} color={modernColors.primary} />
                                                <Text style={styles.trackingMetricValue}>{formatDistance(distanceRemaining)}</Text>
                                                <Text style={styles.trackingMetricLabel}>restant</Text>
                                            </View>
                                            <View style={styles.trackingMetric}>
                                                <SafeIcon name="Clock" size={14} color={modernColors.primary} />
                                                <Text style={styles.trackingMetricValue}>{formatDuration(durationRemaining)}</Text>
                                                <Text style={styles.trackingMetricLabel}>restant</Text>
                                            </View>
                                            <View style={styles.trackingMetric}>
                                                <SafeIcon name="Flag" size={14} color="#10B981" />
                                                <Text style={[styles.trackingMetricValue, { color: '#10B981' }]}>{liveETA || '--:--'}</Text>
                                                <Text style={styles.trackingMetricLabel}>arrivée</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Prochaine instruction */}
                                    {selectedRoute.steps && selectedRoute.steps[nextStepIndex] && (
                                        <View style={styles.nextStepBanner}>
                                            <SafeIcon name="CornerUpRight" size={18} color={modernColors.primary} />
                                            <View style={styles.nextStepInfo}>
                                                <Text style={styles.nextStepText} numberOfLines={2}>
                                                    {selectedRoute.steps[nextStepIndex].instructions}
                                                </Text>
                                                <Text style={styles.nextStepDistance}>
                                                    dans {formatDistance(selectedRoute.steps[nextStepIndex].distance_meters)}
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {/* Barre de progression */}
                                    <View style={styles.progressBarContainer}>
                                        <View style={[styles.progressBar, { width: `${Math.max(2, Math.min(100, ((selectedRoute.distance_meters - distanceRemaining) / selectedRoute.distance_meters) * 100))}%` as any }]} />
                                    </View>
                                </NativeCard>

                                {/* ✅ AMÉLIORÉ: Section signalement communautaire plus visible */}
                                <NativeCard style={styles.reportSectionCard}>
                                    <View style={styles.reportSectionHeader}>
                                        <SafeIcon name="AlertTriangle" size={16} color="#F59E0B" />
                                        <Text style={styles.reportSectionTitle}>Signalement communautaire</Text>
                                        <TouchableOpacity
                                            onPress={() => setShowReportHelp(!showReportHelp)}
                                            style={styles.reportHelpBtn}
                                        >
                                            <SafeIcon name={showReportHelp ? "ChevronUp" : "Info"} size={14} color={modernColors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>

                                    {showReportHelp && (
                                        <View style={styles.reportHelpContent}>
                                            <Text style={styles.reportHelpText}>
                                                Signalez les radars, accidents, travaux et autres dangers pour aider la communauté à conduire plus en sécurité.
                                            </Text>
                                            <Text style={styles.reportHelpSubtext}>
                                                Vos signalements sont visibles par tous les utilisateurs sur ce trajet.
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.reportRow}>
                                        <Text style={styles.reportLabel}>Signaler un danger:</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={styles.reportBtnsContainer}
                                            nestedScrollEnabled={true}
                                        >
                                            <TouchableOpacity style={[styles.reportBtn, { backgroundColor: '#EF444420' }]} onPress={() => reportCheckpoint('radar')}>
                                                <Text style={styles.reportBtnIcon}>🚓</Text>
                                                <Text style={styles.reportBtnText}>Radar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.reportBtn, { backgroundColor: '#3B82F620' }]} onPress={() => reportCheckpoint('police')}>
                                                <Text style={styles.reportBtnIcon}>👮</Text>
                                                <Text style={styles.reportBtnText}>Police</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.reportBtn, { backgroundColor: '#F59E0B20' }]} onPress={() => reportCheckpoint('accident')}>
                                                <Text style={styles.reportBtnIcon}>🚗</Text>
                                                <Text style={styles.reportBtnText}>Accident</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.reportBtn, { backgroundColor: '#EF444420' }]} onPress={() => reportCheckpoint('danger')}>
                                                <Text style={styles.reportBtnIcon}>⚠️</Text>
                                                <Text style={styles.reportBtnText}>Danger</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.reportBtn, { backgroundColor: '#F59E0B20' }]} onPress={() => reportCheckpoint('road_works')}>
                                                <Text style={styles.reportBtnIcon}>🚧</Text>
                                                <Text style={styles.reportBtnText}>Travaux</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.reportBtn, { backgroundColor: '#6B728020' }]} onPress={() => reportCheckpoint('speed_bump')}>
                                                <Text style={styles.reportBtnIcon}>🔺</Text>
                                                <Text style={styles.reportBtnText}>Ralentisseur</Text>
                                            </TouchableOpacity>
                                        </ScrollView>
                                    </View>
                                </NativeCard>

                                {/* Bouton arrêter le suivi */}
                                <TouchableOpacity style={styles.stopTrackingBtn} onPress={stopTracking}>
                                    <SafeIcon name="Square" size={16} color="#EF4444" />
                                    <Text style={styles.stopTrackingText}>Arrêter le suivi</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ━━ Checkpoints sur le trajet (mode planification) ━━━━━━━ */}
                        {!isTracking && selectedRoute && (checkpoints.length > 0 || loadingCheckpoints) && (
                            <NativeCard style={styles.checkpointsCard}>
                                <View style={styles.checkpointsHeader}>
                                    <SafeIcon name="AlertTriangle" size={16} color="#F59E0B" />
                                    <Text style={styles.checkpointsTitle}>
                                        {loadingCheckpoints ? 'Recherche de signalements...' : `${checkpoints.length} signalement${checkpoints.length > 1 ? 's' : ''} sur votre trajet`}
                                    </Text>
                                    {loadingCheckpoints && <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 8 }} />}
                                </View>
                                {checkpoints.slice(0, 5).map((cp) => {
                                    const cpInfo = CHECKPOINT_LABELS[cp.checkpoint_type] || { label: cp.checkpoint_type, icon: '⚠️', color: '#6B7280' };
                                    return (
                                        <View key={cp.id} style={styles.checkpointItem}>
                                            <Text style={styles.checkpointItemIcon}>{cpInfo.icon}</Text>
                                            <View style={styles.checkpointItemInfo}>
                                                <Text style={styles.checkpointItemLabel}>{cpInfo.label}</Text>
                                                {cp.description && <Text style={styles.checkpointItemDesc} numberOfLines={1}>{cp.description}</Text>}
                                            </View>
                                            {cp.speed_limit && <Text style={styles.checkpointItemSpeed}>{cp.speed_limit} km/h</Text>}
                                        </View>
                                    );
                                })}
                            </NativeCard>
                        )}

                        {/* ━━ Détails du trajet sélectionné (étapes) ━━━━━━━━━━━━━━ */}
                        {selectedRoute && selectedRoute.steps && selectedRoute.steps.length > 0 && (
                            <NativeCard style={styles.stepsCard}>
                                <TouchableOpacity style={styles.stepsHeader} onPress={() => setShowSteps(!showSteps)} activeOpacity={0.7}>
                                    <SafeIcon name="List" size={18} color={modernColors.primary} />
                                    <Text style={styles.stepsTitle}>Détails du trajet ({selectedRoute.steps.length} étapes)</Text>
                                    <SafeIcon name={showSteps ? 'ChevronUp' : 'ChevronDown'} size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                                {showSteps && (
                                    <View style={styles.stepsList}>
                                        {(showAllSteps ? selectedRoute.steps : selectedRoute.steps.slice(0, 15)).map((step, idx) => (
                                            <View key={idx} style={styles.stepItem}>
                                                <View style={styles.stepNumberCol}>
                                                    <View style={styles.stepDot} />
                                                    {idx < selectedRoute.steps.length - 1 && <View style={styles.stepLine} />}
                                                </View>
                                                <View style={styles.stepContent}>
                                                    <Text style={styles.stepInstruction} numberOfLines={2}>{step.instructions}</Text>
                                                    <View style={styles.stepMeta}>
                                                        <Text style={styles.stepDistance}>{formatDistance(step.distance_meters)}</Text>
                                                        <Text style={styles.stepDuration}>{formatDuration(step.duration_seconds)}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                        {selectedRoute.steps.length > 15 && !showAllSteps && (
                                            <TouchableOpacity style={styles.showAllStepsBtn} onPress={() => setShowAllSteps(true)}>
                                                <SafeIcon name="ChevronDown" size={16} color={modernColors.primary} />
                                                <Text style={styles.showAllStepsBtnText}>Voir les {selectedRoute.steps.length - 15} étapes restantes</Text>
                                            </TouchableOpacity>
                                        )}
                                        {showAllSteps && selectedRoute.steps.length > 15 && (
                                            <TouchableOpacity style={styles.showAllStepsBtn} onPress={() => setShowAllSteps(false)}>
                                                <SafeIcon name="ChevronUp" size={16} color={modernColors.primary} />
                                                <Text style={styles.showAllStepsBtnText}>Réduire</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </NativeCard>
                        )}

                        {/* ━━ Points d'intérêt groupés par catégorie (enrichis) ━━━ */}
                        {selectedRoute && (
                            <View style={styles.poiSection}>
                                <View style={styles.poiSectionHeader}>
                                    <Text style={styles.sectionTitle}>Lieux utiles sur le trajet</Text>
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
                                                        {pois.slice(0, 8).map((poi) => (
                                                            <View key={poi.id} style={styles.poiItem}>
                                                                <View style={styles.poiItemInfo}>
                                                                    <Text style={styles.poiName} numberOfLines={1}>{poi.name}</Text>
                                                                    {poi.address && <Text style={styles.poiAddress} numberOfLines={1}>{poi.address}</Text>}
                                                                    <View style={styles.poiMeta}>
                                                                        <Text style={styles.poiDistance}>{formatDistance(poi.distance_from_route_meters)} de détour</Text>
                                                                        {poi.rating != null && poi.rating > 0 && (
                                                                            <View style={styles.poiRating}>
                                                                                <SafeIcon name="Star" size={11} color="#FBBF24" />
                                                                                <Text style={styles.poiRatingText}>{poi.rating.toFixed(1)}{poi.total_ratings ? ` (${poi.total_ratings})` : ''}</Text>
                                                                            </View>
                                                                        )}
                                                                        {poi.price_level != null && poi.price_level > 0 && (
                                                                            <Text style={styles.poiPriceLevel}>{getPriceLevelText(poi.price_level)}</Text>
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
                                                                {/* Actions POI */}
                                                                <View style={styles.poiActions}>
                                                                    <TouchableOpacity style={styles.poiActionBtn} onPress={() => navigateToPOI(poi)}>
                                                                        <SafeIcon name="Navigation" size={14} color="#10B981" />
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity style={styles.addWaypointBtn} onPress={() => addWaypoint(poi)}>
                                                                        <SafeIcon name="Plus" size={14} color={modernColors.primary} />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        ))}
                                                        {pois.length > 8 && (
                                                            <Text style={styles.poiMoreText}>+{pois.length - 8} autres lieux</Text>
                                                        )}
                                                    </View>
                                                )}
                                            </NativeCard>
                                        );
                                    })
                                )}
                            </View>
                        )}

                        {/* ━━ Boutons démarrer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                        {selectedRoute && !isTracking && (
                            <View style={styles.goSection}>
                                {/* Bouton principal : suivi en temps réel in-app */}
                                <TouchableOpacity style={styles.goButton} onPress={() => { startTracking(); loadCheckpoints(); }} activeOpacity={0.85}>
                                    <SafeIcon name="Radio" size={22} color="white" />
                                    <View>
                                        <Text style={styles.goButtonText}>Suivi en temps réel</Text>
                                        <Text style={styles.goButtonETA}>Vitesse, radars, progression en direct</Text>
                                    </View>
                                </TouchableOpacity>
                                {/* Bouton secondaire : ouvrir Google Maps */}
                                <TouchableOpacity style={styles.externalNavButton} onPress={() => startNavigation(selectedRoute)} activeOpacity={0.8}>
                                    <SafeIcon name="ExternalLink" size={16} color={modernColors.primary} />
                                    <Text style={styles.externalNavText}>Ouvrir dans Google Maps</Text>
                                    {selectedRoute.arrival_time && (
                                        <Text style={styles.externalNavETA}>ETA {selectedRoute.arrival_time}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
            </KeyboardAvoidingView >
        </SafeNativeView >
    );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: modernColors.background },
    keyboardContainer: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 100 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: modernColors.primary, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: modernColors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 12, color: modernColors.textSecondary, marginTop: 1 },
    statsButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: modernColors.surface, alignItems: 'center', justifyContent: 'center' },

    // Stats
    statsCard: { marginBottom: 16, padding: 16 },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 22, fontWeight: '800', color: modernColors.primary },
    statLabel: { fontSize: 11, color: modernColors.textSecondary, marginTop: 4, textAlign: 'center' },
    statDivider: { width: 1, height: 32, backgroundColor: modernColors.border },

    // Travel mode
    travelModeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    travelModeBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border },
    travelModeLabel: { fontSize: 11, color: modernColors.textSecondary, fontWeight: '500' },

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
    destActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10 },
    saveDestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
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
    recalcButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EFF6FF' },
    recalcText: { fontSize: 13, color: modernColors.primary, fontWeight: '600' },

    // Map
    mapContainer: { marginBottom: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: modernColors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
    mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: modernColors.surface, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    mapHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mapHeaderTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text },
    mapToggleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: modernColors.background, alignItems: 'center', justifyContent: 'center' },
    mapView: { width: '100%', height: MAP_HEIGHT },
    mapRecenterBtn: { position: 'absolute', bottom: 16, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
    showMapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginBottom: 12, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border },
    showMapBtnText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },

    // Routes section
    routesSection: { marginBottom: 16 },
    routesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: modernColors.surface },
    shareBtnText: { fontSize: 12, color: modernColors.primary, fontWeight: '600' },
    routeCard: { width: width * 0.72, backgroundColor: modernColors.surface, borderRadius: 14, padding: 14, marginRight: 10, borderWidth: 2, borderColor: modernColors.border },
    routeCardSelected: { borderColor: modernColors.primary, backgroundColor: '#EFF6FF' },
    routeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    routeNumberBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: modernColors.text, alignItems: 'center', justifyContent: 'center' },
    routeNumber: { fontSize: 12, fontWeight: '800', color: 'white' },
    trafficBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    trafficDot: { width: 6, height: 6, borderRadius: 3 },
    trafficText: { fontSize: 11, fontWeight: '600' },
    fastestBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    fastestText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
    routeSummary: { fontSize: 13, fontWeight: '600', color: modernColors.text, marginBottom: 8 },
    routeMetrics: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    routeMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    routeMetricValue: { fontSize: 13, color: modernColors.textSecondary, fontWeight: '500' },
    trafficDelay: { fontSize: 11, color: '#EF4444', fontStyle: 'italic', marginTop: 6 },
    fareBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: 'flex-start' },
    fareText: { fontSize: 12, fontWeight: '700', color: modernColors.primary },
    warningText: { fontSize: 11, color: '#D97706', marginTop: 4 },

    // Route steps
    stepsCard: { marginBottom: 12, padding: 0, overflow: 'hidden' },
    stepsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    stepsTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: modernColors.text },
    stepsList: { paddingHorizontal: 14, paddingBottom: 12 },
    stepItem: { flexDirection: 'row', minHeight: 44 },
    stepNumberCol: { width: 24, alignItems: 'center' },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: modernColors.primary, marginTop: 4 },
    stepLine: { width: 2, flex: 1, backgroundColor: modernColors.border, marginTop: 2 },
    stepContent: { flex: 1, paddingLeft: 10, paddingBottom: 12 },
    stepInstruction: { fontSize: 13, color: modernColors.text, lineHeight: 18 },
    stepMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
    stepDistance: { fontSize: 11, color: modernColors.textSecondary },
    stepDuration: { fontSize: 11, color: modernColors.textSecondary },
    showAllStepsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: modernColors.border },
    showAllStepsBtnText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },

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
    poiAddress: { fontSize: 11, color: modernColors.textSecondary, marginTop: 2 },
    poiMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
    poiDistance: { fontSize: 12, color: modernColors.textSecondary },
    poiRating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    poiRatingText: { fontSize: 12, color: modernColors.text, fontWeight: '600' },
    poiPriceLevel: { fontSize: 12 },
    openBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    openBadgeText: { fontSize: 10, fontWeight: '600' },
    poiActions: { flexDirection: 'column', gap: 6, marginLeft: 8 },
    poiActionBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
    addWaypointBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    poiMoreText: { fontSize: 12, color: modernColors.textSecondary, textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' },

    // Go button
    goSection: { marginTop: 8, marginBottom: 16, gap: 10 },
    goButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, backgroundColor: '#10B981', borderRadius: 14, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    goButtonText: { fontSize: 17, fontWeight: '800', color: 'white' },
    goButtonETA: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    externalNavButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: modernColors.primary, backgroundColor: modernColors.surface },
    externalNavText: { fontSize: 14, fontWeight: '600', color: modernColors.primary },
    externalNavETA: { fontSize: 12, color: modernColors.textSecondary, marginLeft: 4 },

    // ── Live tracking dashboard ──
    trackingSection: { marginBottom: 16 },
    trackingCard: { padding: 16, marginBottom: 10 },
    trackingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    speedGauge: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: modernColors.primary, alignItems: 'center', justifyContent: 'center' },
    speedValue: { fontSize: 28, fontWeight: '900', color: modernColors.text },
    speedUnit: { fontSize: 10, color: modernColors.textSecondary, marginTop: -2 },
    trackingMetrics: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    trackingMetric: { alignItems: 'center', gap: 2 },
    trackingMetricValue: { fontSize: 16, fontWeight: '800', color: modernColors.text },
    trackingMetricLabel: { fontSize: 10, color: modernColors.textSecondary },
    nextStepBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: modernColors.border },
    nextStepInfo: { flex: 1 },
    nextStepText: { fontSize: 14, fontWeight: '600', color: modernColors.text, lineHeight: 20 },
    nextStepDistance: { fontSize: 12, color: modernColors.primary, fontWeight: '600', marginTop: 2 },
    progressBarContainer: { height: 6, backgroundColor: modernColors.border, borderRadius: 3, marginTop: 14, overflow: 'hidden' },
    progressBar: { height: 6, backgroundColor: '#10B981', borderRadius: 3 },

    // Checkpoint alert
    checkpointAlert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 10 },
    checkpointAlertIcon: { fontSize: 28 },
    checkpointAlertInfo: { flex: 1 },
    checkpointAlertTitle: { fontSize: 16, fontWeight: '800' },
    checkpointAlertSpeed: { fontSize: 13, color: modernColors.textSecondary, marginTop: 2 },

    // Deviation alert
    deviationAlert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#FEE2E2', marginBottom: 10 },
    deviationText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#DC2626' },

    // Report buttons
    reportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    reportLabel: { fontSize: 12, fontWeight: '600', color: modernColors.textSecondary },
    reportBtnsContainer: { gap: 6, paddingRight: 8 },
    reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
    reportBtnIcon: { fontSize: 14 },
    reportBtnText: { fontSize: 11, fontWeight: '600' },

    // ✅ NOUVEAUX: Styles section signalement améliorée
    reportSectionCard: { marginBottom: 16, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' },
    reportSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    reportSectionTitle: { fontSize: 16, fontWeight: '700', color: '#92400E', marginLeft: 8 },
    reportHelpBtn: { padding: 4, borderRadius: 4 },
    reportHelpContent: { marginBottom: 12, padding: 12, backgroundColor: '#FFF7ED', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
    reportHelpText: { fontSize: 13, color: '#92400E', lineHeight: 18, marginBottom: 4 },
    reportHelpSubtext: { fontSize: 11, color: '#A16207', fontStyle: 'italic' },

    // Stop tracking
    stopTrackingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
    stopTrackingText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },

    // Checkpoints list (planning mode)
    checkpointsCard: { marginBottom: 12, padding: 14 },
    checkpointsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    checkpointsTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text },
    checkpointItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: modernColors.border },
    checkpointItemIcon: { fontSize: 18 },
    checkpointItemInfo: { flex: 1 },
    checkpointItemLabel: { fontSize: 13, fontWeight: '600', color: modernColors.text },
    checkpointItemDesc: { fontSize: 11, color: modernColors.textSecondary, marginTop: 1 },
    checkpointItemSpeed: { fontSize: 13, fontWeight: '700', color: '#EF4444', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

    // ── Activity dashboard ──
    activityDashboard: { marginBottom: 16 },
    periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center' },
    periodBtnActive: { backgroundColor: modernColors.primary + '15', borderColor: modernColors.primary },
    periodBtnText: { fontSize: 13, fontWeight: '600', color: modernColors.textSecondary },
    periodBtnTextActive: { color: modernColors.primary, fontWeight: '700' },

    // Health card
    healthCard: { marginBottom: 10, padding: 16 },
    healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    healthTitle: { fontSize: 16, fontWeight: '800', color: modernColors.text },
    healthGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
    healthItem: { alignItems: 'center', gap: 2 },
    healthEmoji: { fontSize: 24 },
    healthValue: { fontSize: 20, fontWeight: '900', color: modernColors.text },
    healthLabel: { fontSize: 11, color: modernColors.textSecondary },
    healthIndicators: { gap: 10, marginTop: 4 },
    healthIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    healthIndicatorIcon: { fontSize: 16, width: 22, textAlign: 'center' },
    healthIndicatorLabel: { fontSize: 12, color: modernColors.text, fontWeight: '500', width: 110 },
    healthBarBg: { flex: 1, height: 8, backgroundColor: modernColors.border, borderRadius: 4, overflow: 'hidden' },
    healthBarFill: { height: 8, borderRadius: 4, minWidth: 4 },
    healthIndicatorValue: { fontSize: 12, fontWeight: '700', width: 55, textAlign: 'right' },

    // Best session
    bestSessionCard: { marginBottom: 10, padding: 14, backgroundColor: '#FFFBEB' },
    bestSessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    bestSessionEmoji: { fontSize: 22 },
    bestSessionTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
    bestSessionRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
    bestSessionStat: { fontSize: 14, fontWeight: '700', color: '#78350F' },
    bestSessionDate: { fontSize: 12, color: '#A16207', textAlign: 'center' },

    // Mode card
    modeCard: { marginBottom: 10, padding: 14 },
    modeCardTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text, marginBottom: 10 },
    modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: modernColors.border },
    modeIcon: { fontSize: 20, width: 28, textAlign: 'center' },
    modeName: { flex: 1, fontSize: 14, fontWeight: '600', color: modernColors.text },
    modeCount: { fontSize: 13, fontWeight: '700', color: modernColors.primary, backgroundColor: modernColors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    modeDist: { fontSize: 13, color: modernColors.textSecondary, width: 60, textAlign: 'right' },

    // Destinations card
    destCard: { marginBottom: 10, padding: 14 },
    destCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    destCardTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text },
    destRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: modernColors.border },
    destRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: modernColors.primary + '15', alignItems: 'center', justifyContent: 'center' },
    destRankText: { fontSize: 12, fontWeight: '800', color: modernColors.primary },
    destName: { flex: 1, fontSize: 13, color: modernColors.text },
    destVisits: { fontSize: 13, fontWeight: '700', color: modernColors.textSecondary },

    // History card
    historyCard: { marginBottom: 10, padding: 14 },
    historyTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text, marginBottom: 10 },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: modernColors.border },
    historyIcon: { fontSize: 20, width: 28, textAlign: 'center' },
    historyInfo: { flex: 1 },
    historyDest: { fontSize: 13, fontWeight: '600', color: modernColors.text },
    historyMeta: { fontSize: 11, color: modernColors.textSecondary, marginTop: 2 },
    historyQuality: { alignItems: 'center' },
    historyScore: { fontSize: 18, fontWeight: '900' },
    historyScoreLabel: { fontSize: 10, color: modernColors.textSecondary },

    // ━━ AI Coach Dashboard Styles ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Health score circle
    aiScoreCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    aiScoreValue: { fontSize: 28, fontWeight: '900' },
    aiScoreMax: { fontSize: 12, color: modernColors.textSecondary, marginTop: -4 },
    aiScoreLabel: { fontSize: 16, fontWeight: '800', marginTop: 4 },
    // Breakdown grid
    aiBreakdownGrid: { gap: 6, marginTop: 8 },
    aiBreakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    aiBreakdownBar: { flex: 1, height: 6, backgroundColor: modernColors.border, borderRadius: 3, overflow: 'hidden' },
    aiBreakdownFill: { height: 6, borderRadius: 3 },
    aiBreakdownPts: { fontSize: 11, fontWeight: '700', color: modernColors.textSecondary, width: 36, textAlign: 'right' },
    // AI tips
    aiTipCard: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: modernColors.surface, borderRadius: 8 },
    aiTipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    aiTipTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text, flex: 1 },
    aiTipMessage: { fontSize: 12, color: modernColors.textSecondary, lineHeight: 18 },
    // Streak & gamification
    aiStreakRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 },
    aiStreakItem: { alignItems: 'center', gap: 2 },
    aiStreakEmoji: { fontSize: 24 },
    aiStreakValue: { fontSize: 22, fontWeight: '900', color: modernColors.text },
    aiStreakLabel: { fontSize: 11, color: modernColors.textSecondary },
    // Badges
    aiBadgesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    aiBadge: { alignItems: 'center', backgroundColor: modernColors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: modernColors.border },
    aiBadgeLabel: { fontSize: 10, fontWeight: '600', color: modernColors.textSecondary, marginTop: 2, maxWidth: 80, textAlign: 'center' },

    // ✅ NOUVEAUX: Waypoints Styles
    waypointsCard: { marginBottom: 16, padding: 16, backgroundColor: modernColors.surface, borderRadius: 12, borderWidth: 1, borderColor: modernColors.border },
    waypointsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    waypointsTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text, marginLeft: 8 },
    clearWaypointsBtn: { padding: 4, borderRadius: 4 },
    waypointItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    waypointIndex: { width: 24, height: 24, borderRadius: 12, backgroundColor: modernColors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    waypointIndexText: { fontSize: 12, fontWeight: '700', color: 'white' },
    waypointInfo: { flex: 1 },
    waypointName: { fontSize: 14, fontWeight: '600', color: modernColors.text },
    waypointCoords: { fontSize: 11, color: modernColors.textSecondary, marginTop: 2 },
    removeWaypointBtn: { padding: 6, borderRadius: 4 },

    // ✅ NOUVEAUX: Traffic Alerts Styles
    trafficAlertsCard: { marginBottom: 16, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' },
    trafficAlertsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    trafficAlertsTitle: { fontSize: 16, fontWeight: '700', color: '#92400E', marginLeft: 8 },
    trafficAlertItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
    trafficAlertText: { flex: 1, fontSize: 13, color: '#92400E', marginLeft: 8, lineHeight: 18 },

    // ✅ NOUVEAUX: Steps Styles
    stepsCard: { marginBottom: 16, backgroundColor: modernColors.surface, borderRadius: 12, borderWidth: 1, borderColor: modernColors.border },
    stepsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    stepsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepsTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text },
    stepsCount: { fontSize: 12, color: modernColors.textSecondary, backgroundColor: modernColors.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    stepsList: { paddingHorizontal: 16, paddingBottom: 16 },
    stepItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    stepIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: modernColors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
    stepIndexText: { fontSize: 12, fontWeight: '700', color: 'white' },
    stepInfo: { flex: 1 },
    stepInstruction: { fontSize: 14, color: modernColors.text, lineHeight: 20, marginBottom: 4 },
    stepDetails: { flexDirection: 'row', gap: 16 },
    stepDistance: { fontSize: 12, color: modernColors.textSecondary },
    stepDuration: { fontSize: 12, color: modernColors.textSecondary },
    aiNewBadgeBanner: { marginTop: 10, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, alignItems: 'center' },
    aiNewBadgeTitle: { fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 4 },
    aiNewBadgeText: { fontSize: 13, color: '#78350F', fontWeight: '600' },
    // Challenges
    aiChallengeRow: { marginBottom: 14 },
    aiChallengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    aiChallengeLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: modernColors.text },
    aiChallengeCheck: { fontSize: 16 },
    aiChallengeBarBg: { height: 10, backgroundColor: modernColors.border, borderRadius: 5, overflow: 'hidden' },
    aiChallengeBarFill: { height: 10, borderRadius: 5 },
    aiChallengeProgress: { fontSize: 11, color: modernColors.textSecondary, marginTop: 4, textAlign: 'right' },
    // Fitness VO2max
    aiFitnessVO2: { fontSize: 36, fontWeight: '900', color: '#EF4444' },
    aiFitnessUnit: { fontSize: 12, color: modernColors.textSecondary, marginTop: -2 },
    aiFitnessLevel: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
    aiFitnessLevelText: { fontSize: 14, fontWeight: '800' },
    // Records
    aiRecordsList: { gap: 2 },
    aiRecordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    aiRecordEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
    aiRecordInfo: { flex: 1 },
    aiRecordTitle: { fontSize: 12, fontWeight: '600', color: modernColors.textSecondary },
    aiRecordValue: { fontSize: 15, fontWeight: '800', color: modernColors.text },
    aiRecordDate: { fontSize: 11, color: modernColors.textSecondary },
    aiRecordsTotals: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: modernColors.border },
    aiRecordTotal: { fontSize: 12, fontWeight: '700', color: modernColors.primary, textAlign: 'center' },
    // Commute insights
    aiCommuteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: modernColors.border, flexWrap: 'wrap' },
    aiCommuteFrom: { fontSize: 12, fontWeight: '600', color: modernColors.text, maxWidth: '30%' as any },
    aiCommuteArrow: { fontSize: 14, color: modernColors.primary, fontWeight: '700' },
    aiCommuteTo: { fontSize: 12, fontWeight: '600', color: modernColors.text, flex: 1, maxWidth: '30%' as any },
    aiCommuteMeta: { fontSize: 11, color: modernColors.textSecondary, fontWeight: '700' },
    aiPeakHours: { marginTop: 12 },
    aiPeakTitle: { fontSize: 13, fontWeight: '700', color: modernColors.text, marginBottom: 8 },
    aiPeakRow: { flexDirection: 'row', gap: 10 },
    aiPeakBadge: { alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
    aiPeakHour: { fontSize: 15, fontWeight: '800', color: '#6366F1' },
    aiPeakCount: { fontSize: 10, color: '#6366F1', fontWeight: '600' },
    // Partage performances
    sharePerformanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
    coachTitle: { fontSize: 18, fontWeight: '800', color: modernColors.text },
    sharePerformanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: modernColors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    sharePerformanceTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
    // AI Risk banner (checkpoint analysis)
    aiRiskBanner: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 4 },
    aiRiskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    aiRiskTitle: { fontSize: 15, fontWeight: '800' },
    aiRiskTip: { fontSize: 13, color: modernColors.textSecondary, marginBottom: 8, lineHeight: 18 },
    aiRiskAlertRow: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginBottom: 4 },
    aiRiskAlertMsg: { fontSize: 12, color: modernColors.text, lineHeight: 17 },
});

export default NavigationScreen;

