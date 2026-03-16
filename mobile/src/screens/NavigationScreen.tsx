import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, BackHandler,
    Dimensions, Keyboard, KeyboardAvoidingView, Linking,
    Platform, ScrollView, Share, StyleSheet, Text, ToastAndroid,
    TouchableOpacity, View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import CheckpointCommentsSection from '../components/CheckpointCommentsSection';
import InternalShareButton from '../components/InternalShareButton';
import LocationSelector, { LocationObject } from '../components/LocationSelector';
import { NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { apiGet, apiPost } from '../services/api';
import { PassiveActivityTracker } from '../services/PassiveActivityTracker';
import { socialSharing } from '../services/socialSharing';
import { modernColors } from '../theme/modernTheme';

const { width, height } = Dimensions.get('window');
const MAP_HEIGHT = height * 0.35;
const KEYBOARD_OFFSET = Platform.OS === 'ios' ? 0 : 20;

// ── Polyline decoder ─────────────────────────────────────────────────────
const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    if (!encoded || typeof encoded !== 'string') return [];
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0, lat = 0, lng = 0;
    try {
        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do { b = encoded.charCodeAt(index++) - 63; if (b < -63 || b > 95) throw new Error('Invalid'); result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);
            shift = 0; result = 0;
            do { b = encoded.charCodeAt(index++) - 63; if (b < -63 || b > 95) throw new Error('Invalid'); result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);
            const dLat = lat / 1e5, dLng = lng / 1e5;
            if (validateCoords(dLat, dLng)) points.push({ latitude: dLat, longitude: dLng });
        }
    } catch { return []; }
    return points;
};
const validateCoords = (lat: number, lng: number): boolean =>
    typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && isFinite(lat) && isFinite(lng);

// ── Types ────────────────────────────────────────────────────────────────
interface RouteOption {
    id: string; distance_meters: number; duration_seconds: number; duration_in_traffic_seconds?: number;
    summary: string; overview_polyline: string; steps: RouteStep[]; traffic_level: 'low' | 'medium' | 'high';
    waypoints?: Array<{ lat: number; lng: number; name?: string }>;
    arrival_time?: string; departure_time?: string; start_address?: string; end_address?: string;
    warnings?: string[]; fare?: { currency: string; value: number; text: string }; mode?: string;
}
interface RouteStep {
    instructions: string; distance_meters: number; duration_seconds: number;
    location: { lat: number; lng: number }; start_location?: { lat: number; lng: number };
}
interface PointOfInterest {
    id: string; name: string; type: string;
    latitude?: number; longitude?: number; location?: { lat: number; lng: number };
    distance_from_route_meters: number; rating?: number; is_open?: boolean;
    address?: string; phone?: string; price_level?: number; total_ratings?: number;
}
const getPoiLat = (poi: PointOfInterest): number => poi.latitude ?? poi.location?.lat ?? 0;
const getPoiLng = (poi: PointOfInterest): number => poi.longitude ?? poi.location?.lng ?? 0;

// ── Constants ────────────────────────────────────────────────────────────
const POI_CATEGORIES: Record<string, { label: string; icon: string; color: string; types: string[] }> = {
    health: { label: t('navigation.sante'), icon: '🏥', color: '#EF4444', types: ['pharmacy', 'hospital'] },
    food: { label: 'Alimentation', icon: '🍞', color: '#F59E0B', types: ['bakery', 'supermarket', 'restaurant'] },
    fuel: { label: 'Carburant', icon: '⛽', color: '#3B82F6', types: ['gas_station'] },
    finance: { label: 'Banque & DAB', icon: '🏧', color: '#6366F1', types: ['atm'] },
    auto: { label: 'Auto & Parking', icon: '🚗', color: '#0EA5E9', types: ['parking', 'car_wash', 'car_repair'] },
    religion: { label: 'Lieux de culte', icon: '🕌', color: '#A855F7', types: ['mosque', 'church'] },
    accommodation: { label: t('navigation.hebergement'), icon: '🏨', color: '#EC4899', types: ['hotel'] },
    security: { label: t('navigation.securite'), icon: '🚔', color: '#14B8A6', types: ['police'] },
};
const TRAVEL_MODES = [
    { key: 'driving', label: 'Voiture', emoji: '🚗', color: '#3B82F6' },
    { key: 'walking', label: t('navigation.aPied'), emoji: '🚶', color: '#10B981' },
    { key: 'transit', label: 'Transport', emoji: '🚌', color: '#8B5CF6' },
    { key: 'bicycling', label: t('navigation.velo'), emoji: '🚲', color: '#F59E0B' },
];
const CHECKPOINT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    radar: { label: 'Radar', icon: '📸', color: '#EF4444' },
    road_check: { label: t('navigation.controle'), icon: '🚧', color: '#D97706' },
    transport_control: { label: 'Mintransport', icon: '🛂', color: '#0D9488' },
    police: { label: 'Police / Gendarmerie', icon: '👮', color: '#3B82F6' },
    accident: { label: 'Accident', icon: '🚨', color: '#F59E0B' },
    danger: { label: 'Danger', icon: '⚠️', color: '#EF4444' },
    road_works: { label: 'Travaux', icon: '🚧', color: '#F97316' },
    speed_bump: { label: 'Ralentisseur', icon: '🔶', color: '#8B5CF6' },
};
// Distance d'alerte par type (en mètres) — radar/police/transports à 10km, autres à 2km
const CHECKPOINT_ALERT_DISTANCE: Record<string, number> = {
    radar: 10000,
    police: 10000,
    transport_control: 10000,
    road_check: 10000,
    accident: 3000,
    danger: 2000,
    road_works: 2000,
    speed_bump: 500,
};
// Seuils d'alerte progressifs (en mètres) — re-alerte quand on franchit un seuil plus proche
const CHECKPOINT_ALERT_THRESHOLDS: Record<string, number[]> = {
    radar: [10000, 5000, 2000, 500],
    police: [10000, 5000, 2000, 500],
    transport_control: [10000, 5000, 2000, 500],
    road_check: [10000, 5000, 2000, 500],
    accident: [3000, 1000, 300],
    danger: [2000, 800, 200],
    road_works: [2000, 800, 200],
    speed_bump: [500, 200],
};
const REPORT_TYPES = [
    { type: 'radar', icon: '📸', short: 'Radar', label: 'Radar', bg: '#FEE2E2', color: '#DC2626' },
    { type: 'road_check', icon: '🚧', short: 'Contrôle', label: t('navigation.controleRoutier'), bg: '#FEF9C3', color: '#D97706' },
    { type: 'transport_control', icon: '🛂', short: 'Mintransp.', label: 'Mintransport', bg: '#CCFBF1', color: '#0D9488' },
    { type: 'police', icon: '👮', short: 'Police', label: 'Police / Gendarmerie', bg: '#DBEAFE', color: '#2563EB' },
    { type: 'accident', icon: '🚨', short: 'Accident', label: 'Accident', bg: '#FEF3C7', color: '#EA580C' },
    { type: 'danger', icon: '⚠️', short: 'Danger', label: 'Danger', bg: '#FEE2E2', color: '#DC2626' },
    { type: 'road_works', icon: '🔧', short: 'Travaux', label: 'Travaux', bg: '#FEF3C7', color: '#F97316' },
    { type: 'speed_bump', icon: '🔶', short: 'Dos-d\'âne', label: 'Dos-d\'âne', bg: '#F3F4F6', color: '#7C3AED' },
];

// ══════════════════════════════════════════════════════════════════════════
// ── Helpers globaux ─────────────────────────────────────────────────────
const showToast = (msg: string) => {
    if (Platform.OS === 'android') { ToastAndroid.show(msg, ToastAndroid.LONG); }
    else { Alert.alert('', msg); }
};
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (results?.[0]) {
            const r = results[0];
            const parts = [r.street, r.name, r.district, r.subregion, r.city].filter(Boolean);
            return parts.length > 0 ? parts.slice(0, 3).join(', ') : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    } catch { }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};
// ✅ AMÉLIORÉ 2026-03-11: Messages vocaux contextuels par type d'alerte
const CHECKPOINT_VOICE_MESSAGES: Record<string, (distText: string, speedLimit?: number) => string> = {
    radar: (d, sl) => sl ? t('navigationScreen.attentionRadarALimiteDeVitesse', { d: d, sl: sl }) : `Attention, radar détecté à ${d}. Respectez les panneaux de circulation.`,
    police: (d) => t('navigationScreen.controlePoliceOuGendarmerieSignaleA', { d: d }),
    transport_control: (d) => t('navigationScreen.controleMintransportSignaleAPreparezVos', { d: d }),
    road_check: (d) => t('navigationScreen.controleRoutierSignaleARalentissezEt', { d: d }),
    accident: (d) => t('navigationScreen.accidentSignaleARedoublezDePrudence', { d: d }),
    danger: (d) => t('navigationScreen.zoneDangereuseASoyezVigilantEt', { d: d }),
    road_works: (d) => t('navigationScreen.travauxEnCoursARalentissezEt', { d: d }),
    speed_bump: (d) => t('navigationScreen.ralentisseurAReduisezVotreVitesse', { d: d }),
};

// Sons d'alerte différenciés par urgence
const CHECKPOINT_SOUND_URLS: Record<string, string> = {
    radar: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    police: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    transport_control: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    road_check: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    accident: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    danger: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    road_works: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
    speed_bump: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
};

const formatDistanceText = (meters: number): string => {
    if (meters >= 1000) return t('navigationScreen.kilometres', { (meters / 1000)_toFixed(1): (meters / 1000).toFixed(1) });
return t('navigationScreen.metres', { Math_round(meters): Math.round(meters) });
};

// ✅ AMÉLIORÉ 2026-03-11: Alerte contextuelle avec TTS + son + haptic
const playContextualAlert = async (checkpointType: string, distanceMeters: number, speedLimit?: number) => {
    // 1. Haptic immédiat
    try { const h = await import('expo-haptics'); await h.notificationAsync(h.NotificationFeedbackType.Warning); } catch { }
    // 2. Son d'alerte (bref, avant la voix)
    try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
        const soundUrl = CHECKPOINT_SOUND_URLS[checkpointType] || CHECKPOINT_SOUND_URLS.danger;
        const { sound } = await Audio.Sound.createAsync(
            { uri: soundUrl },
            { shouldPlay: true, volume: 1.0 }
        );
        sound.setOnPlaybackStatusUpdate((status) => {
            if ('didJustFinish' in status && status.didJustFinish) { sound.unloadAsync(); }
        });
    } catch { }
    // 3. Message vocal contextuel (TTS)
    try {
        const distText = formatDistanceText(distanceMeters);
        const msgFn = CHECKPOINT_VOICE_MESSAGES[checkpointType];
        const message = msgFn ? msgFn(distText, speedLimit) : t('navigationScreen.attentionAlerteASoyezPrudent', { distText: distText });
        // Arrêter un éventuel message en cours
        Speech.stop();
        Speech.speak(message, {
            language: 'fr-FR',
            rate: 0.95,
            pitch: 1.0,
            onError: (e) => console.warn('[NavigationScreen] TTS error:', e),
        });
        console.log(`[NavigationScreen] 🔊 TTS: ${message}`);
    } catch (e) { console.warn('[NavigationScreen] TTS fallback error:', e); }
};

const SHARE_BASE_URL = 'https://yukpomnang.com';

const NavigationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location: currentLocation } = useLocationSafe();
    const [destination, setDestination] = useState('');
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<LocationObject | null>(null);
    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
    const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPOI, setLoadingPOI] = useState(false);
    const [travelMode, setTravelMode] = useState<string>('driving');
    const [waypoints, setWaypoints] = useState<Array<{ lat: number; lng: number; name: string }>>([]);
    const [avoidTolls, setAvoidTolls] = useState(false);
    const [avoidHighways, setAvoidHighways] = useState(false);
    const [avoidFerries, setAvoidFerries] = useState(false);
    const [showPrefs, setShowPrefs] = useState(false);
    const [showMap, setShowMap] = useState(true);
    const [showReportHelp, setShowReportHelp] = useState(false);
    const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);
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
    const [nearbyCheckpoint, setNearbyCheckpoint] = useState<{ id: string; checkpoint_type: string; distance: number; speed_limit?: number } | null>(null);
    const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
    const checkpointsRef = useRef(checkpoints);
    checkpointsRef.current = checkpoints;
    const checkpointRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const trackingUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const trackingStartTimeRef = useRef<string | null>(null);
    const speedSamplesRef = useRef<number[]>([]);
    const maxSpeedRef = useRef<number>(0);
    const distanceTraveledRef = useRef<number>(0);
    const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    const checkpointsReportedRef = useRef<number>(0);
    const checkpointsEncounteredRef = useRef<number>(0);
    const wasOffRouteRef = useRef<boolean>(false);
    const encounteredCheckpointIdsRef = useRef<Map<string, number>>(new Map());
    const [isFreeWalking, setIsFreeWalking] = useState(false);
    const [freeWalkTick, setFreeWalkTick] = useState(0);
    const [passiveTrackingActive, setPassiveTrackingActive] = useState(false);
    const [showActivityStats, setShowActivityStats] = useState(false);
    const [activityPeriod, setActivityPeriod] = useState<'week' | 'month' | 'year'>('week');
    const [activitySummary, setActivitySummary] = useState<any>(null);
    const [activityHistory, setActivityHistory] = useState<any[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [aiInsights, setAiInsights] = useState<any>(null);
    const [checkpointAiAnalysis, setCheckpointAiAnalysis] = useState<any>(null);
    const [savedDestinations, setSavedDestinations] = useState<Array<{ id: string; label: string; custom_label?: string; address: string; latitude: number; longitude: number }>>([]);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ health: false, food: false, fuel: false, finance: false, auto: false, religion: false, accommodation: false, security: false });
    const [poiShowAll, setPoiShowAll] = useState<Record<string, boolean>>({});
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [isLocationSelectorFocused, setIsLocationSelectorFocused] = useState(false);
    const [isHorizontalScrolling, setIsHorizontalScrolling] = useState(false);
    const [showReportBar, setShowReportBar] = useState(false);
    const [showAlertHistory, setShowAlertHistory] = useState(false);
    const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
    const [alertHistoryData, setAlertHistoryData] = useState<Array<{
        id: string; checkpoint_type: string; lat: number; lng: number;
        locationName: string; distance: number; count: number;
        description?: string; speed_limit?: number; created_at?: string;
    }>>([]);
    const [loadingAlertHistory, setLoadingAlertHistory] = useState(false);
    const [alertToast, setAlertToast] = useState<{ visible: boolean; message: string; icon: string; color: string }>({ visible: false, message: '', icon: '', color: '' });
    const alertToastAnim = useRef(new Animated.Value(0)).current;
    const routeCardWidth = width * 0.72 + 10;
    const mapRef = useRef<MapView>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const searchRoutesRef = useRef<() => void>(() => { });

    // ── Mémos ──
    const groupedPOIs = useMemo(() => {
        const groups: Record<string, PointOfInterest[]> = {};
        for (const [catKey, cat] of Object.entries(POI_CATEGORIES)) groups[catKey] = pointsOfInterest.filter(poi => cat.types.includes(poi.type));
        return groups;
    }, [pointsOfInterest]);
    const routePolylineCoords = useMemo(() => {
        if (!selectedRoute?.overview_polyline) { console.log('[Navigation] 🗺️ routePolylineCoords: no polyline'); return []; }
        try {
            const coords = decodePolyline(selectedRoute.overview_polyline);
            console.log('[Navigation] 🗺️ routePolylineCoords: decoded', coords.length, 'points from polyline of', selectedRoute.overview_polyline.length, 'chars');
            return coords;
        } catch (e) { console.error('[Navigation] 🗺️ routePolylineCoords: decode error', e); return []; }
    }, [selectedRoute?.overview_polyline]);
    const mapRegion = useMemo((): Region | undefined => {
        if (routePolylineCoords.length > 0) {
            const lats = routePolylineCoords.map(p => p.latitude), lngs = routePolylineCoords.map(p => p.longitude);
            const region = { latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2, latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * 1.4, 0.01), longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.4, 0.01) };
            console.log('[Navigation] 🗺️ mapRegion: from polyline', region);
            return region;
        }
        if (destinationCoords) return { latitude: destinationCoords.lat, longitude: destinationCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        if (currentLocation?.coords) return { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        return { latitude: 4.05, longitude: 9.7, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    }, [routePolylineCoords, destinationCoords, currentLocation]);

    // ✅ Debug: log quand routes changent
    useEffect(() => { console.log('[Navigation] 📊 routes state changed:', routes.length, 'routes, selectedRoute:', selectedRoute?.id, 'showMap:', showMap); }, [routes, selectedRoute, showMap]);

    useEffect(() => { if (routePolylineCoords.length > 1 && mapRef.current) mapRef.current.fitToCoordinates(routePolylineCoords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }); }, [routePolylineCoords]);

    // ── Helpers ──
    const getCurrentPosition = useCallback(async () => {
        try {
            if (currentLocation) return { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude };
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { Alert.alert(t('navigation.permissionRequired'), t('navigation.allowLocation')); return null; }
            const loc = await Location.getCurrentPositionAsync({});
            return { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch { return null; }
    }, [currentLocation]);
    const AnyMapView = MapView as any;
    const formatDuration = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m} min`; };
    const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
    const getTrafficColor = (l: string) => l === 'low' ? '#10B981' : l === 'medium' ? '#F59E0B' : l === 'high' ? '#EF4444' : '#6B7280';
    const getTrafficLabel = (l: string) => l === 'low' ? 'Fluide' : l === 'medium' ? t('navigationScreen.modere') : l === 'high' ? 'Dense' : '';
    const haversineDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371000, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }, []);

    // ── API callbacks ──
    const loadSavedDestinations = useCallback(async () => { try { const r = await apiGet('/api/navigation/destinations') as any; if (r?.data?.destinations) setSavedDestinations(r.data.destinations); } catch { } }, []);
    useEffect(() => {
        if (user) {
            loadSavedDestinations();
            // ✅ Auto-charger TOUTES les stats d'activité au montage (pas juste les insights)
            // L'utilisateur voit immédiatement ses données de marche/déplacement
            loadActivityStats(activityPeriod);
        }
    }, [user, loadSavedDestinations]);
    // ── Réception deep link: pré-remplir destination depuis lien partagé ──
    useEffect(() => {
        const params = route.params as any;
        if (params?.dest_lat && params?.dest_lng) {
            const lat = parseFloat(params.dest_lat);
            const lng = parseFloat(params.dest_lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                const name = params.dest_name ? decodeURIComponent(params.dest_name) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                setDestination(name);
                setDestinationCoords({ lat, lng });
                if (params.mode) setTravelMode(params.mode);
                showToast(`📍 ${t('navigation.destination', { name })}`);
                // Lancer la recherche d'itinéraires après un court délai
                setTimeout(() => searchRoutesRef.current(), 500);
            }
        }
        if (params?.tab === 'stats') {
            setShowActivityStats(true);
            loadActivityStats(activityPeriod);
        }
    }, [route.params]);
    useEffect(() => {
        const s1 = Keyboard.addListener('keyboardDidShow', (e) => { setKeyboardHeight(e.endCoordinates.height); setIsKeyboardVisible(true); });
        const s2 = Keyboard.addListener('keyboardDidHide', () => { setKeyboardHeight(0); setIsKeyboardVisible(false); });
        return () => { s1.remove(); s2.remove(); };
    }, []);
    // Vérifier l'état du tracking passif au montage
    useEffect(() => {
        PassiveActivityTracker.isRunning().then(setPassiveTrackingActive);
    }, []);
    const resolveDestination = useCallback(async (dest: string) => {
        const dl = dest.toLowerCase().trim();
        if (dl === 'domicile' || dl === 'bureau') { try { const r = await apiGet(`/api/navigation/destinations/by-label/${dl}`) as any; if (r?.data) return { lat: r.data.latitude, lng: r.data.longitude, address: r.data.address }; } catch { } }
        try { const r = await apiGet(`/api/navigation/geocode?address=${encodeURIComponent(dest)}`) as any; if (r?.data?.location) return { lat: r.data.location.lat, lng: r.data.location.lng, address: r.data.formatted_address || dest }; } catch { }
        return null;
    }, []);
    const geocodeDestination = useCallback(async (addr: string) => { const r = await resolveDestination(addr); return r ? { lat: r.lat, lng: r.lng } : null; }, [resolveDestination]);

    const searchRoutes = useCallback(async () => {
        let destCoords = destinationCoords;
        if (!destCoords && (selectedLocation as any)?.latitude && (selectedLocation as any)?.longitude) { destCoords = { lat: (selectedLocation as any).latitude, lng: (selectedLocation as any).longitude }; setDestinationCoords(destCoords); }
        if (!destCoords && !destination.trim()) { Alert.alert(t('navigation.destinationRequired'), t('navigation.selectDestination')); return; }
        setLoading(true);
        console.log('[Navigation] 🔍 searchRoutes START — dest:', destination, 'coords:', destCoords, 'mode:', travelMode);
        const modeLabel = travelMode === 'walking' ? t('navigation.walking') : travelMode === 'bicycling' ? t('navigation.bicycling') : travelMode === 'transit' ? t('navigation.transit') : t('navigation.car');
        try {
            const origin = await getCurrentPosition();
            console.log('[Navigation] 📍 Origin:', origin);
            if (!origin) { Alert.alert(t('message.error'), t('navigation.positionUnavailable')); setLoading(false); return; }
            if (!destCoords) { destCoords = await geocodeDestination(destination); if (!destCoords) { Alert.alert(t('message.error'), t('navigation.destinationNotFound')); setLoading(false); return; } setDestinationCoords(destCoords); }
            const avoidList: string[] = []; if (avoidTolls) avoidList.push('tolls'); if (avoidHighways) avoidList.push('highways'); if (avoidFerries) avoidList.push('ferries');
            console.log('[Navigation] 📡 Calling API: origin=', origin, 'dest=', destCoords, 'mode=', travelMode);
            const response = await apiPost('/api/navigation/routes', { origin, destination: destCoords, alternatives: true, avoid: avoidList, traffic_model: 'best_guess', mode: travelMode, waypoints: waypoints.length > 0 ? waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })) : undefined }) as any;
            console.log('[Navigation] 📨 API Response — success:', response?.success, 'hasData:', !!response?.data, 'routesCount:', response?.data?.routes?.length, 'error:', response?.error);
            if (response?.data?.routes) {
                console.log('[Navigation] 📋 Routes raw:', response.data.routes.map((r: any, i: number) => `[${i}] polyline=${!!r?.overview_polyline}(${(r?.overview_polyline || '').length}chars) dist=${r?.distance_meters} dur=${r?.duration_seconds} steps=${Array.isArray(r?.steps) ? r.steps.length : 'N/A'}`));
            }
            if (response?.success === false) {
                const errMsg = response?.error || response?.message || '';
                console.warn('[Navigation] ❌ API error:', errMsg);
                if (errMsg.toLowerCase().includes('mode') || errMsg.toLowerCase().includes('non disponible') || errMsg.toLowerCase().includes('zero_results')) {
                    Alert.alert(t('navigation.modeUnavailable', { mode: modeLabel }), t('navigation.modeUnavailableMsg', { mode: modeLabel }), [
                        { text: `🚗 ${t('navigation.car')}`, onPress: () => { setTravelMode('driving'); setTimeout(() => searchRoutesRef.current(), 200); } },
                        { text: `🚶 ${t('navigation.walking')}`, onPress: () => { setTravelMode('walking'); setTimeout(() => searchRoutesRef.current(), 200); } },
                        { text: 'OK' }
                    ]);
                } else { Alert.alert(t('message.error'), errMsg || t('navigation.serverError')); }
            }
            else if (response?.data?.routes?.length > 0) {
                const valid = response.data.routes.filter((r: any) => r?.overview_polyline && r.distance_meters > 0 && r.duration_seconds > 0 && Array.isArray(r.steps));
                console.log('[Navigation] ✅ Valid routes after filter:', valid.length, '/', response.data.routes.length);
                if (!valid.length) {
                    console.warn('[Navigation] ⚠️ All routes filtered out! Raw routes:', JSON.stringify(response.data.routes.map((r: any) => ({ polyline: (r?.overview_polyline || '').substring(0, 20), dist: r?.distance_meters, dur: r?.duration_seconds, stepsType: typeof r?.steps }))));
                    Alert.alert(t('navigation.noRoute'), t('navigation.noRouteFound')); setLoading(false); return;
                }
                setRoutes(valid); setSelectedRoute(valid[0]);
                showToast(`🛣️ ${valid.length} itinéraire${valid.length > 1 ? 's' : ''} trouvé${valid.length > 1 ? 's' : ''} !`);
                // ✅ Auto-scroll vers les résultats après un court délai pour que le state se mette à jour
                setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 400, animated: true }); }, 300);
                try { await loadPointsOfInterestSafely(valid[0]); setTimeout(() => loadCheckpointsSafely(), 800); } catch { }
            } else {
                console.warn('[Navigation] ⚠️ No routes in response. Full response keys:', response?.data ? Object.keys(response.data) : 'no data');
                Alert.alert(t('navigation.noRoute'), t('navigation.noRouteForMode', { mode: modeLabel }));
            }
        } catch (e: any) {
            console.error('[Navigation] 💥 searchRoutes exception:', e?.message || e, 'data:', e?.data);
            const errMsg = e?.data?.message || e?.data?.error || e?.message || e?.error || '';
            const errLower = errMsg.toLowerCase();
            if (errLower.includes('mode') || errLower.includes('non disponible') || errLower.includes('zero_results') || errLower.includes('aucun itin')) {
                Alert.alert(t('navigation.modeUnavailable', { mode: modeLabel }), t('navigation.modeUnavailableMsg', { mode: modeLabel }), [
                    { text: `🚗 ${t('navigation.car')}`, onPress: () => { setTravelMode('driving'); setTimeout(() => searchRoutesRef.current(), 200); } },
                    { text: `🚶 ${t('navigation.walking')}`, onPress: () => { setTravelMode('walking'); setTimeout(() => searchRoutesRef.current(), 200); } },
                    { text: 'OK' }
                ]);
            } else { Alert.alert(t('message.error'), errMsg || t('navigation.networkError')); }
        } finally { setLoading(false); }
    }, [destination, destinationCoords, selectedLocation, getCurrentPosition, geocodeDestination, avoidTolls, avoidHighways, avoidFerries, waypoints, travelMode]);
    useEffect(() => { searchRoutesRef.current = searchRoutes; }, [searchRoutes]);

    const loadPointsOfInterestSafely = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) { setPointsOfInterest([]); return; }
        setLoadingPOI(true); setPointsOfInterest([]);
        try {
            const origin = await getCurrentPosition(); if (!origin) { setLoadingPOI(false); return; }
            if (!route.id || !route.steps?.length) { setLoadingPOI(false); return; }
            const stepsP = route.steps.length > 0 ? `&route_steps=${encodeURIComponent(JSON.stringify(route.steps.map(s => ({ lat: s.location?.lat || 0, lng: s.location?.lng || 0 }))))}` : '';
            const r = await apiGet(`/api/navigation/points-of-interest?route_id=${route.id}&origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}${stepsP}`) as any;
            console.log('[Navigation] POI Response:', JSON.stringify(r, null, 2));
            if (r?.data?.pois && Array.isArray(r.data.pois)) {
                console.log('[Navigation] Raw POIs:', r.data.pois);
                const vp = r.data.pois.filter((p: any) => {
                    console.log('[Navigation] Processing POI:', p);
                    // Extract name properly - handle object or string
                    const name = typeof p?.name === 'string' ? p.name :
                        typeof p?.name === 'object' ? p.name?.name || JSON.stringify(p.name) :
                            'Nom inconnu';
                    console.log('[Navigation] Extracted name:', name, 'type:', typeof p?.name);
                    // Update the POI object with the extracted name
                    if (p && name !== 'Nom inconnu') {
                        p.name = name;
                    }
                    const coords = validateCoords(p.location?.lat ?? p.latitude ?? 0, p.location?.lng ?? p.longitude ?? 0);
                    console.log('[Navigation] POI coords valid:', coords, 'name:', p.name);
                    return p?.name && coords;
                });
                console.log('[Navigation] Validated POIs:', vp);
                setPointsOfInterest(vp);
                // Toutes les catégories restent fermées — l'utilisateur clique pour ouvrir
                const reset: Record<string, boolean> = {};
                Object.keys(POI_CATEGORIES).forEach(k => reset[k] = false);
                setExpandedCategories(reset);
                setPoiShowAll({});
            }
        } catch { setPointsOfInterest([]); } finally { setLoadingPOI(false); }
    }, [destinationCoords, getCurrentPosition]);

    const loadCheckpointsSafely = useCallback(async () => {
        if (!selectedRoute || !destinationCoords) return;
        setLoadingCheckpoints(true);
        const origin = await getCurrentPosition(); if (!origin) { setLoadingCheckpoints(false); return; }
        try {
            const r = await apiGet(`/api/navigation/checkpoints/along-route?origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}`);
            console.log('[Navigation] Checkpoints raw response:', JSON.stringify(r, null, 2));
            // ✅ CORRIGÉ: apiGet wraps response → r.data contains backend JSON
            const backendResp = r.data as any;
            console.log('[Navigation] Backend response:', JSON.stringify(backendResp, null, 2));
            const checkpointsArray = Array.isArray(backendResp?.data?.checkpoints)
                ? backendResp.data.checkpoints
                : Array.isArray(backendResp?.checkpoints)
                    ? backendResp.checkpoints
                    : [];
            console.log('[Navigation] Extracted checkpoints array:', JSON.stringify(checkpointsArray, null, 2));
            if (checkpointsArray.length > 0) {
                const filtered = checkpointsArray.filter((c: any) => c && validateCoords(c.latitude, c.longitude));
                console.log('[Navigation] Filtered checkpoints:', JSON.stringify(filtered, null, 2));
                setCheckpoints(filtered);
            } else {
                console.log('[Navigation] No checkpoints found in array');
                setCheckpoints([]);
            }
        } catch (error) {
            console.error('[Navigation] Error loading checkpoints:', error);
            setCheckpoints([]);
        } finally {
            setLoadingCheckpoints(false);
        }
    }, [selectedRoute, destinationCoords, getCurrentPosition]);

    const startNavigation = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) return;
        try {
            const origin = await getCurrentPosition(); if (!origin) return;
            await apiPost('/api/navigation/trips', { origin, destination: destinationCoords, route_id: route.id, distance_meters: route.distance_meters, duration_seconds: route.duration_seconds, waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })) });
            if (waypoints.length > 0) { await Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destinationCoords.lat},${destinationCoords.lng}&waypoints=${waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')}&travelmode=driving`); }
            else {
                const url = Platform.select({ ios: `maps://app?daddr=${destinationCoords.lat},${destinationCoords.lng}&dirflg=d`, android: `google.navigation:q=${destinationCoords.lat},${destinationCoords.lng}`, default: `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}&travelmode=driving` });
                const can = await Linking.canOpenURL(url || ''); if (can) await Linking.openURL(url || ''); else await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destinationCoords.lat},${destinationCoords.lng}&travelmode=driving`);
            }
        } catch { Alert.alert(t('message.error'), t('navigation.cannotOpenNav')); }
    }, [destinationCoords, waypoints, getCurrentPosition]);

    const saveDestination = useCallback(async (label: string, customLabel?: string) => {
        if (!destinationCoords) return;
        try { const r = await apiPost('/api/navigation/destinations', { label, custom_label: customLabel, address: destination, latitude: destinationCoords.lat, longitude: destinationCoords.lng, place_id: null }); if (r?.data) { Alert.alert(t('message.success'), t('navigation.destinationSaved')); loadSavedDestinations(); } } catch (e: any) { Alert.alert(t('message.error'), e?.message || t('message.error')); }
    }, [destinationCoords, destination, loadSavedDestinations]);

    const addWaypoint = useCallback((poi: PointOfInterest) => {
        const lat = getPoiLat(poi), lng = getPoiLng(poi);
        if (waypoints.some(wp => wp.lat === lat && wp.lng === lng)) { Alert.alert(t('navigation.alreadyAdded')); return; }
        const safeName = typeof poi.name === 'string' ? poi.name : (typeof poi.name === 'object' && poi.name !== null ? (poi.name as any).name || (poi.name as any).text || JSON.stringify(poi.name) : 'Nom inconnu');
        setWaypoints(prev => [...prev, { lat, lng, name: safeName }]);
        Alert.alert(t('navigation.stepAdded'), t('navigation.stepAddedMsg', { name: safeName }));
    }, [waypoints]);
    const removeWaypoint = useCallback((i: number) => { setWaypoints(prev => prev.filter((_, idx) => idx !== i)); }, []);
    const toggleCategory = useCallback((k: string) => { setExpandedCategories(prev => ({ ...prev, [k]: !prev[k] })); }, []);
    const navigateToPOI = useCallback((poi: PointOfInterest) => {
        const lat = getPoiLat(poi), lng = getPoiLng(poi);
        const url = Platform.select({ ios: `maps://app?daddr=${lat},${lng}&dirflg=d`, android: `google.navigation:q=${lat},${lng}`, default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` });
        Linking.openURL(url || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }, []);
    const shareRoute = useCallback(async () => {
        if (!selectedRoute || !destinationCoords) return;
        const origin = await getCurrentPosition(); if (!origin) return;
        const originName = await reverseGeocode(origin.lat, origin.lng);
        const destName = destination || await reverseGeocode(destinationCoords.lat, destinationCoords.lng);
        const dist = formatDistance(selectedRoute.distance_meters);
        const dur = formatDuration(selectedRoute.duration_in_traffic_seconds || selectedRoute.duration_seconds);
        const shareUrl = `${SHARE_BASE_URL}/navigation/share/route?dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}&dest_name=${encodeURIComponent(destName)}&distance=${encodeURIComponent(dist)}&duration=${encodeURIComponent(dur)}&mode=${travelMode}&origin_name=${encodeURIComponent(originName)}`;
        const modeEmoji = travelMode === 'walking' ? '🚶' : travelMode === 'bicycling' ? '🚲' : travelMode === 'transit' ? '🚌' : '🚗';
        await Share.share({
            message: `${modeEmoji} Itinéraire Yukpo\n📍 ${originName} → 🏁 ${destName}\n📊 ${dist} · ⏱ ${dur}\n\n${shareUrl}`,
            title: t('navigationScreen.itineraireVers', { destName: destName }),
        });
    }, [selectedRoute, destinationCoords, getCurrentPosition, travelMode, destination]);
    const shareAlert = useCallback(async (alert: { checkpoint_type: string; lat: number; lng: number; locationName?: string; speed_limit?: number }) => {
        const info = CHECKPOINT_LABELS[alert.checkpoint_type] || { label: alert.checkpoint_type, icon: '⚠️', color: '#6B7280' };
        const locName = alert.locationName || await reverseGeocode(alert.lat, alert.lng);
        const msg = t('navigationScreen.signaleAAlertspeedlimit', { info_icon: info.icon, info_label: info.label, locName: locName })(${ alert.speed_limit } km / h)` : ''}\n\n⚠️ Signalement communautaire via Yukpo Navigation\n${SHARE_BASE_URL}/navigation/share/route?dest_lat=${alert.lat}&dest_lng=${alert.lng}&dest_name=${encodeURIComponent(locName)}&mode=driving`;
        await Share.share({ message: msg, title: `${info.icon} ${info.label} - Yukpo` });
    }, []);
    const sharePOI = useCallback(async (poi: PointOfInterest) => {
        const lat = poi.location?.lat ?? (poi as any).latitude ?? 0;
        const lng = poi.location?.lng ?? (poi as any).longitude ?? 0;
        const catEntry = Object.entries(POI_CATEGORIES).find(([, c]) => c.types.includes(poi.type));
        const catIcon = catEntry ? catEntry[1].icon : '📍';
        const safeName = typeof poi.name === 'string' ? poi.name : (typeof poi.name === 'object' && poi.name !== null ? (poi.name as any).name || (poi.name as any).text || JSON.stringify(poi.name) : 'Nom inconnu');
        const lines = [`${catIcon} ${safeName}`];
        if (poi.address) lines.push(`📍 ${poi.address}`);
        if (poi.rating) lines.push(`⭐ ${poi.rating}${poi.total_ratings ? ` (${poi.total_ratings} avis)` : ''}`);
        if (poi.is_open != null) lines.push(poi.is_open ? '✅ Ouvert' : t('navigationScreen.ferme'));
        lines.push('');
        lines.push(`Ouvrir dans Yukpo 🚀`);
        lines.push(`${SHARE_BASE_URL}/navigation/share/route?dest_lat=${lat}&dest_lng=${lng}&dest_name=${encodeURIComponent(safeName)}&mode=driving`);
        await Share.share({ message: lines.join('\n'), title: `${catIcon} ${safeName}` });
    }, []);
    const sharePerformance = useCallback(async () => {
        if (!aiInsights) return;
        const hs = aiInsights.health_score || {}, co2 = aiInsights.co2_impact || {}, gam = aiInsights.gamification || {};
        await socialSharing.shareNavigationPerformance({ period: activityPeriod, distanceKm: (aiInsights.summary?.total_distance_meters || 0) / 1000, sessions: aiInsights.summary?.total_sessions || 0, calories: aiInsights.summary?.total_calories || 0, healthScore: hs.score || 0, healthLabel: hs.label || '', co2SavedKg: (co2.saved_grams || 0) / 1000, vo2max: aiInsights.fitness?.vo2max || 0, fitnessLevel: aiInsights.fitness?.level || '', streak: gam.streak?.current || 0, badgeCount: gam.badges?.length || 0, points: Number(gam.points) || 0, userId: user?.id as any });
    }, [aiInsights, activityPeriod, user]);

    const loadActivityStats = useCallback(async (period: string = 'week') => {
        setLoadingActivity(true);
        try {
            console.log('[Navigation] Loading activity stats for period:', period);
            const [sr, hr, ar] = await Promise.all([
                apiGet(`/api/navigation/activity/summary?period=${period}`),
                apiGet(`/api/navigation/activity/history?limit=10`),
                apiGet(`/api/navigation/activity/ai-insights?period=${period}`)
            ]) as any[];

            console.log('[Navigation] Activity summary response:', sr?.data);
            console.log('[Navigation] Activity history response:', hr?.data);
            console.log('[Navigation] AI insights response:', ar?.data);

            if (sr?.data) {
                console.log('[Navigation] Setting activity summary:', sr.data);
                const summary = sr.data.summary || {};
                setActivitySummary({
                    ...summary,
                    by_mode: sr.data.by_mode || [],
                    best_session: sr.data.best_session || null,
                    daily_trend: sr.data.daily_trend || [],
                    most_visited_places: (sr.data.top_destinations || []).map((d: any) => ({ name: d.address || 'Lieu inconnu', visit_count: d.visits || 0 })),
                    favorite_poi_types: (sr.data.by_mode || []).map((m: any) => ({ poi_type: m.mode, count: m.count || 0 })),
                });
            }
            if (hr?.data?.activities) {
                console.log('[Navigation] Setting activity history:', hr.data.activities);
                setActivityHistory(hr.data.activities);
            }
            if (ar?.data?.success) {
                console.log('[Navigation] Setting AI insights:', ar.data);
                setAiInsights(ar.data);
            } else {
                console.log('[Navigation] AI insights not successful or missing');
            }
        } catch (e) {
            console.error('[Navigation] Error loading activity stats:', e);
        } finally {
            setLoadingActivity(false);
        }
    }, []);
    const estimateCalories = useCallback((dKm: number, dMin: number, mode: string, spd: number) => {
        let met = mode === 'walking' ? (spd < 4 ? 2.5 : spd < 5.5 ? 3.5 : spd < 7 ? 4.5 : 6.0) : mode === 'bicycling' ? (spd < 16 ? 4.0 : spd < 20 ? 6.8 : spd < 25 ? 8.0 : 10.0) : mode === 'transit' ? 1.3 : 1.5;
        return (met * 70 * dMin) / 60;
    }, []);
    const computeQualityScore = useCallback((sp: number[], dKm: number, dMin: number, mode: string, off: boolean) => {
        if (sp.length < 3 || dMin < 1) return 50;
        const avg = sp.reduce((a, b) => a + b, 0) / sp.length;
        const con = Math.max(0, 100 - Math.sqrt(sp.reduce((s, v) => s + (v - avg) ** 2, 0) / sp.length) * 5);
        return Math.min(100, Math.max(0, Math.round(con * 0.5 + Math.min(20, dKm * 4) + Math.min(15, dMin * 0.5) + (mode === 'walking' ? 10 : mode === 'bicycling' ? 8 : 0) - (off ? 15 : 0))));
    }, []);
    // ── Toast animé de confirmation d'alerte ──
    const showAlertToast = useCallback((message: string, icon: string, color: string) => {
        setAlertToast({ visible: true, message, icon, color });
        Animated.sequence([
            Animated.timing(alertToastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(3000),
            Animated.timing(alertToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setAlertToast(prev => ({ ...prev, visible: false })));
    }, [alertToastAnim]);

    // ── Toast de confirmation de signalement ──
    const showConfirmationToast = useCallback((message: string, icon: string) => {
        setAlertToast({ visible: true, message, icon, color: '#10B981' }); // Vert pour confirmation
        Animated.sequence([
            Animated.timing(alertToastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(4000), // Plus long pour confirmation
            Animated.timing(alertToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setAlertToast(prev => ({ ...prev, visible: false })));
    }, [alertToastAnim]);

    const reportCheckpoint = useCallback(async (type: string) => {
        const typeLabel = CHECKPOINT_LABELS[type]?.label || type;
        const typeIcon = CHECKPOINT_LABELS[type]?.icon || '⚠️';
        // Demander confirmation AVANT d'envoyer le signalement
        Alert.alert(
            `${typeIcon} ${t('message.confirm')}`,
            `${typeLabel} ?`,
            [
                { text: t('message.cancel'), style: 'cancel' },
                {
                    text: t('message.confirm'),
                    style: 'default',
                    onPress: async () => {
                        let pos = livePosition; if (!pos) pos = await getCurrentPosition(); if (!pos) { Alert.alert(t('message.error'), t('navigation.positionUnavailable')); return; }
                        try {
                            await apiPost('/api/navigation/checkpoints', { checkpoint_type: type, latitude: pos.lat, longitude: pos.lng, is_permanent: type === 'speed_bump' });
                            checkpointsReportedRef.current += 1;
                            showConfirmationToast(`✅ ${t('navigation.checkpointAdded')}`, '✅');
                            loadCheckpointsSafely();
                        } catch { Alert.alert(t('message.error'), t('navigation.errorAddCheckpoint')); }
                    }
                }
            ]
        );
    }, [livePosition, getCurrentPosition, loadCheckpointsSafely, showConfirmationToast]);

    // ── Test alert creation (development only) ──
    const createTestAlerts = useCallback(async () => {
        try {
            const pos = await getCurrentPosition();
            if (!pos) return;

            console.log('[Navigation] Creating test alerts...');

            // Créer quelques alertes de test autour de la position
            const testAlerts = [
                { checkpoint_type: 'radar', latitude: pos.lat + 0.001, longitude: pos.lng + 0.001, description: 'Radar mobile fixe', speed_limit: 50 },
                { checkpoint_type: 'police', latitude: pos.lat - 0.001, longitude: pos.lng - 0.001, description: t('navigation.controlePolice'), speed_limit: null },
                { checkpoint_type: 'accident', latitude: pos.lat + 0.002, longitude: pos.lng - 0.001, description: t('navigation.accidentSurLaChaussee'), speed_limit: null },
            ];

            for (const alert of testAlerts) {
                try {
                    await apiPost('/api/navigation/checkpoints', alert);
                    console.log('[Navigation] Test alert created:', alert.checkpoint_type);
                } catch (e) {
                    console.error('[Navigation] Failed to create test alert:', e);
                }
            }

            // Recharger l'historique
            setTimeout(() => {
                loadAlertHistory();
                showConfirmationToast('🧪 3 alertes de test créées avec succès !', '🧪');
            }, 1000);

        } catch (e) {
            console.error('[Navigation] Error creating test alerts:', e);
        }
    }, [getCurrentPosition, showConfirmationToast]);

    // ── Historique des alertes avec clustering et noms de lieux ──
    const loadAlertHistory = useCallback(async () => {
        setLoadingAlertHistory(true);
        try {
            const pos = await getCurrentPosition();
            if (!pos) {
                setAlertHistoryData([]);
                setLoadingAlertHistory(false);
                return;
            }

            console.log('[Navigation] Loading alert history for position:', pos);

            // Récupérer les checkpoints dans un rayon autour de la position actuelle
            // Utiliser une bounding box de 0.1° (~11km) pour avoir un bon rayon de recherche
            const r = await apiGet(`/api/navigation/checkpoints/along-route?origin_lat=${pos.lat - 0.05}&origin_lng=${pos.lng - 0.05}&dest_lat=${pos.lat + 0.05}&dest_lng=${pos.lng + 0.05}`) as any;

            console.log('[Navigation] Alert history API response:', r);

            // ✅ CORRIGÉ: Utiliser le même pattern robuste que loadCheckpointsSafely
            const backendResp = r?.data as any;
            const checkpointsArr = Array.isArray(backendResp?.data?.checkpoints)
                ? backendResp.data.checkpoints
                : Array.isArray(backendResp?.checkpoints)
                    ? backendResp.checkpoints
                    : [];
            let rawCps = [];
            if (checkpointsArr.length > 0) {
                rawCps = checkpointsArr.filter((c: any) => c && validateCoords(c.latitude, c.longitude));
                console.log('[Navigation] Filtered checkpoints:', rawCps);
            }

            if (rawCps.length === 0) {
                console.log('[Navigation] No checkpoints found');
                setAlertHistoryData([]);
                setLoadingAlertHistory(false);
                return;
            }

            // Clustering : regrouper les alertes à moins de 200m
            const clusters: Array<{ items: any[]; centerLat: number; centerLng: number }> = [];
            for (const cp of rawCps) {
                let added = false;
                for (const cl of clusters) {
                    if (haversineDistance(cl.centerLat, cl.centerLng, cp.latitude, cp.longitude) < 200) {
                        cl.items.push(cp);
                        cl.centerLat = cl.items.reduce((s: number, c: any) => s + c.latitude, 0) / cl.items.length;
                        cl.centerLng = cl.items.reduce((s: number, c: any) => s + c.longitude, 0) / cl.items.length;
                        added = true; break;
                    }
                }
                if (!added) clusters.push({ items: [cp], centerLat: cp.latitude, centerLng: cp.longitude });
            }

            console.log('[Navigation] Clusters created:', clusters);

            // Résolution des noms de lieux + calcul des distances
            const data = await Promise.all(clusters.map(async (cl) => {
                const main = cl.items[0];
                const locName = await reverseGeocode(cl.centerLat, cl.centerLng);
                const dist = pos ? haversineDistance(pos.lat, pos.lng, cl.centerLat, cl.centerLng) : 0;
                // Calculer le temps écoulé depuis la création
                return {
                    id: main.id, checkpoint_type: main.checkpoint_type,
                    lat: cl.centerLat, lng: cl.centerLng, locationName: locName,
                    distance: dist, count: cl.items.length,
                    description: main.description, speed_limit: main.speed_limit,
                    created_at: main.created_at,
                };
            }));

            data.sort((a, b) => a.distance - b.distance);
            console.log('[Navigation] Final alert history data:', data);
            setAlertHistoryData(data);
        } catch (e) {
            console.warn('[NavigationScreen] Erreur historique alertes:', e);
            setAlertHistoryData([]);
        }
        finally { setLoadingAlertHistory(false); }
    }, [getCurrentPosition, haversineDistance]);

    // ── Vote/confirm a checkpoint (upvote = confirmer, downvote = infirmer) ──
    const voteCheckpoint = useCallback(async (checkpointId: string, vote: 'up' | 'down') => {
        try {
            await apiPost(`/api/navigation/checkpoints/${checkpointId}/vote`, { vote });
            const isUp = vote === 'up';
            showConfirmationToast(isUp ? t('navigationScreen.alerteConfirmee') : t('navigationScreen.alerteInfirmee'), isUp ? '👍' : '👎');
            // Recharger l'historique pour refléter les nouveaux votes
            setTimeout(() => loadAlertHistory(), 500);
        } catch {
            Alert.alert(t('message.error'), t('navigation.voteFailed'));
        }
    }, [showConfirmationToast, loadAlertHistory]);

    const startTracking = useCallback(async () => {
        if (!selectedRoute || isTracking) return;
        if (!selectedRoute.distance_meters || !selectedRoute.duration_seconds) { Alert.alert(t('message.error'), t('navigation.invalidRoute')); return; }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert(t('navigation.permissionRequired')); return; }
        trackingStartTimeRef.current = new Date().toISOString(); speedSamplesRef.current = []; maxSpeedRef.current = 0; distanceTraveledRef.current = 0; lastPositionRef.current = null; checkpointsReportedRef.current = 0; checkpointsEncounteredRef.current = 0; wasOffRouteRef.current = false; encounteredCheckpointIdsRef.current = new Map();
        setIsTracking(true); setNextStepIndex(0); setDistanceRemaining(selectedRoute.distance_meters || 1000); setDurationRemaining(selectedRoute.duration_in_traffic_seconds || selectedRoute.duration_seconds || 300);
        loadCheckpointsSafely();
        (async () => { try { const p = await getCurrentPosition(); if (p && destinationCoords) { const r = await apiGet(`/api/navigation/checkpoints/ai-analysis?origin_lat=${p.lat}&origin_lng=${p.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}`) as any; if (r?.data?.success) setCheckpointAiAnalysis(r.data.analysis); } } catch { } })();
        checkpointRefreshRef.current = setInterval(() => { loadCheckpointsSafely(); }, 60000);
        const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 }, (loc) => {
            const { latitude, longitude, speed, heading } = loc.coords;
            const pos = { lat: latitude, lng: longitude }; const spd = Math.max(0, (speed || 0) * 3.6);
            setLivePosition(pos); setCurrentSpeed(spd); if (heading != null) setCurrentHeading(heading);
            speedSamplesRef.current.push(spd); if (spd > maxSpeedRef.current) maxSpeedRef.current = spd;
            if (lastPositionRef.current) { const d = haversineDistance(lastPositionRef.current.lat, lastPositionRef.current.lng, latitude, longitude); if (d < 500) distanceTraveledRef.current += d; }
            lastPositionRef.current = pos;
            if (!selectedRoute?.steps?.length) return;
            let minD = Infinity, ci = 0;
            for (let i = 0; i < selectedRoute.steps.length; i++) { const d = haversineDistance(latitude, longitude, selectedRoute.steps[i].location.lat, selectedRoute.steps[i].location.lng); if (d < minD) { minD = d; ci = i; } }
            setNextStepIndex(Math.min(ci + 1, selectedRoute.steps.length - 1));
            let rd = 0, rt = 0; for (let i = ci; i < selectedRoute.steps.length; i++) { rd += selectedRoute.steps[i].distance_meters; rt += selectedRoute.steps[i].duration_seconds; }
            setDistanceRemaining(rd); setDurationRemaining(rt);
            const eta = new Date(Date.now() + rt * 1000); setLiveETA(`${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`);
            setIsOffRoute(minD > 200); if (minD > 200) wasOffRouteRef.current = true;
            // ✅ Clustering temps réel + alertes progressives par seuils de distance
            const cps = checkpointsRef.current;
            // 1. Clustering: regrouper les checkpoints du même type à <200m
            const rtClusters: Array<{ id: string; checkpoint_type: string; lat: number; lng: number; speed_limit?: number; items: string[] }> = [];
            for (const cp of cps) {
                let added = false;
                for (const cl of rtClusters) {
                    if (cl.checkpoint_type === cp.checkpoint_type && haversineDistance(cl.lat, cl.lng, cp.latitude, cp.longitude) < 200) {
                        cl.items.push(cp.id);
                        cl.lat = (cl.lat * (cl.items.length - 1) + cp.latitude) / cl.items.length;
                        cl.lng = (cl.lng * (cl.items.length - 1) + cp.longitude) / cl.items.length;
                        if (cp.speed_limit && !cl.speed_limit) cl.speed_limit = cp.speed_limit;
                        added = true; break;
                    }
                }
                if (!added) rtClusters.push({ id: cp.id, checkpoint_type: cp.checkpoint_type, lat: cp.latitude, lng: cp.longitude, speed_limit: cp.speed_limit, items: [cp.id] });
            }
            // 2. Trouver le cluster le plus proche dans le rayon d'alerte
            let near: typeof nearbyCheckpoint = null;
            for (const cl of rtClusters) {
                const cd = haversineDistance(latitude, longitude, cl.lat, cl.lng);
                const alertDist = CHECKPOINT_ALERT_DISTANCE[cl.checkpoint_type] || 2000;
                if (cd < alertDist && (!near || cd < near.distance)) near = { id: cl.id, checkpoint_type: cl.checkpoint_type, distance: Math.round(cd), speed_limit: cl.speed_limit };
            }
            // 3. Alertes progressives par seuils — re-alerte quand on franchit un seuil plus proche
            if (near) {
                const thresholds = CHECKPOINT_ALERT_THRESHOLDS[near.checkpoint_type] || [2000, 500];
                const lastIdx = encounteredCheckpointIdsRef.current.get(near.id) ?? -1;
                let newIdx = -1;
                for (let t = 0; t < thresholds.length; t++) { if (near.distance < thresholds[t]) newIdx = t; }
                if (newIdx > lastIdx) {
                    encounteredCheckpointIdsRef.current.set(near.id, newIdx);
                    if (lastIdx === -1) checkpointsEncounteredRef.current += 1;
                    playContextualAlert(near.checkpoint_type, near.distance, near.speed_limit);
                }
            }
            setNearbyCheckpoint(near);
        });
        locationSubscriptionRef.current = sub;
    }, [selectedRoute, isTracking, haversineDistance, loadCheckpointsSafely, getCurrentPosition, destinationCoords]);

    // ── MARCHE LIBRE : tracker l'activité SANS itinéraire prédéfini ──
    const startFreeWalking = useCallback(async () => {
        if (isTracking || isFreeWalking) return;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { Alert.alert(t('navigation.permissionRequired'), t('navigation.allowLocationWalking')); return; }
        trackingStartTimeRef.current = new Date().toISOString();
        speedSamplesRef.current = []; maxSpeedRef.current = 0; distanceTraveledRef.current = 0;
        lastPositionRef.current = null; checkpointsReportedRef.current = 0;
        checkpointsEncounteredRef.current = 0; wasOffRouteRef.current = false;
        encounteredCheckpointIdsRef.current = new Map();
        setIsFreeWalking(true); setIsTracking(true); setTravelMode('walking');
        showToast('🚶 Marche libre démarrée !');
        // Charger les alertes communautaires autour de la position
        loadCheckpointsSafely();
        checkpointRefreshRef.current = setInterval(() => { loadCheckpointsSafely(); }, 60000);
        const sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
            (loc) => {
                const { latitude, longitude, speed, heading } = loc.coords;
                const pos = { lat: latitude, lng: longitude };
                const spd = Math.max(0, (speed || 0) * 3.6);
                setLivePosition(pos); setCurrentSpeed(spd);
                if (heading != null) setCurrentHeading(heading);
                speedSamplesRef.current.push(spd);
                if (spd > maxSpeedRef.current) maxSpeedRef.current = spd;
                if (lastPositionRef.current) {
                    const d = haversineDistance(lastPositionRef.current.lat, lastPositionRef.current.lng, latitude, longitude);
                    if (d < 500) distanceTraveledRef.current += d;
                }
                lastPositionRef.current = pos;
                // Détection des alertes communautaires (même logique que tracking guidé)
                const cps = checkpointsRef.current;
                const rtClusters: Array<{ id: string; checkpoint_type: string; lat: number; lng: number; speed_limit?: number; items: string[] }> = [];
                for (const cp of cps) {
                    let added = false;
                    for (const cl of rtClusters) {
                        if (cl.checkpoint_type === cp.checkpoint_type && haversineDistance(cl.lat, cl.lng, cp.latitude, cp.longitude) < 200) {
                            cl.items.push(cp.id);
                            cl.lat = (cl.lat * (cl.items.length - 1) + cp.latitude) / cl.items.length;
                            cl.lng = (cl.lng * (cl.items.length - 1) + cp.longitude) / cl.items.length;
                            if (cp.speed_limit && !cl.speed_limit) cl.speed_limit = cp.speed_limit;
                            added = true; break;
                        }
                    }
                    if (!added) rtClusters.push({ id: cp.id, checkpoint_type: cp.checkpoint_type, lat: cp.latitude, lng: cp.longitude, speed_limit: cp.speed_limit, items: [cp.id] });
                }
                let near: typeof nearbyCheckpoint = null;
                for (const cl of rtClusters) {
                    const cd = haversineDistance(latitude, longitude, cl.lat, cl.lng);
                    const alertDist = CHECKPOINT_ALERT_DISTANCE[cl.checkpoint_type] || 2000;
                    if (cd < alertDist && (!near || cd < near.distance)) near = { id: cl.id, checkpoint_type: cl.checkpoint_type, distance: Math.round(cd), speed_limit: cl.speed_limit };
                }
                if (near) {
                    const thresholds = CHECKPOINT_ALERT_THRESHOLDS[near.checkpoint_type] || [2000, 500];
                    const lastIdx = encounteredCheckpointIdsRef.current.get(near.id) ?? -1;
                    let newIdx = -1;
                    for (let t = 0; t < thresholds.length; t++) { if (near.distance < thresholds[t]) newIdx = t; }
                    if (newIdx > lastIdx) {
                        encounteredCheckpointIdsRef.current.set(near.id, newIdx);
                        if (lastIdx === -1) checkpointsEncounteredRef.current += 1;
                        playContextualAlert(near.checkpoint_type, near.distance, near.speed_limit);
                    }
                }
                setNearbyCheckpoint(near);
            }
        );
        locationSubscriptionRef.current = sub;
    }, [isTracking, isFreeWalking, haversineDistance, loadCheckpointsSafely]);

    const stopFreeWalking = useCallback(async () => {
        if (locationSubscriptionRef.current) { locationSubscriptionRef.current.remove(); locationSubscriptionRef.current = null; }
        if (checkpointRefreshRef.current) { clearInterval(checkpointRefreshRef.current); checkpointRefreshRef.current = null; }
        try { Speech.stop(); } catch { }
        const st = trackingStartTimeRef.current, sp = speedSamplesRef.current;
        const dM = distanceTraveledRef.current, dKm = dM / 1000;
        const dSec = st ? Math.round((Date.now() - new Date(st).getTime()) / 1000) : 0, dMin = dSec / 60;
        const avg = sp.length > 0 ? sp.reduce((a, b) => a + b, 0) / sp.length : 0;
        const cal = estimateCalories(dKm, dMin, 'walking', avg);
        const qual = computeQualityScore(sp, dKm, dMin, 'walking', false);
        const variance = sp.length > 0 ? sp.reduce((s, v) => s + (v - avg) ** 2, 0) / sp.length : 0;
        const consistency = Math.max(0, 100 - Math.sqrt(variance) * 5);
        const pacePerKm = dKm > 0.01 ? dSec / dKm : 0;
        if (dSec > 30 && dM > 10) {
            try {
                await apiPost('/api/navigation/activity/log', {
                    travel_mode: 'walking',
                    origin_address: 'Marche libre',
                    destination_address: 'Marche libre',
                    origin_lat: lastPositionRef.current?.lat,
                    origin_lng: lastPositionRef.current?.lng,
                    dest_lat: livePosition?.lat,
                    dest_lng: livePosition?.lng,
                    distance_meters: dM,
                    duration_seconds: dSec,
                    avg_speed_kmh: Math.round(avg * 10) / 10,
                    max_speed_kmh: Math.round(maxSpeedRef.current * 10) / 10,
                    calories_burned: Math.round(cal),
                    quality_score: qual,
                    speed_consistency: Math.round(consistency * 10) / 10,
                    pace_per_km_seconds: Math.round(pacePerKm),
                    checkpoints_reported: checkpointsReportedRef.current,
                    checkpoints_encountered: checkpointsEncounteredRef.current,
                    was_off_route: false,
                    started_at: st || new Date().toISOString(),
                });
                Alert.alert(
                    t('navigationScreen.marcheTerminee'),
                    `📏 ${dKm.toFixed(1)} km · ⏱ ${Math.floor(dMin)} min · 🔥 ${Math.round(cal)} cal · ⭐ ${qual}/100`,
                    [
                        { text: t('navigationScreen.voirStats'), onPress: () => { setShowActivityStats(true); loadActivityStats(activityPeriod); } },
                        { text: 'OK' }
                    ]
                );
            } catch (e) { console.warn('[Navigation] Erreur log marche libre:', e); }
        } else {
            showToast('🚶 Marche trop courte pour être enregistrée (min 30s / 10m)');
        }
        setIsFreeWalking(false); setIsTracking(false); setNearbyCheckpoint(null); setLivePosition(null);
    }, [livePosition, estimateCalories, computeQualityScore, activityPeriod, loadActivityStats]);

    const stopTracking = useCallback(async () => {
        if (locationSubscriptionRef.current) { locationSubscriptionRef.current.remove(); locationSubscriptionRef.current = null; }
        if (checkpointRefreshRef.current) { clearInterval(checkpointRefreshRef.current); checkpointRefreshRef.current = null; }
        // ✅ Arrêter le TTS en cours lors de l'arrêt du tracking
        try { Speech.stop(); } catch { }
        const st = trackingStartTimeRef.current, sp = speedSamplesRef.current, dM = distanceTraveledRef.current, dKm = dM / 1000;
        const dSec = st ? Math.round((Date.now() - new Date(st).getTime()) / 1000) : 0, dMin = dSec / 60;
        const avg = sp.length > 0 ? sp.reduce((a, b) => a + b, 0) / sp.length : 0;
        const cal = estimateCalories(dKm, dMin, travelMode, avg), qual = computeQualityScore(sp, dKm, dMin, travelMode, wasOffRouteRef.current);
        const variance = sp.length > 0 ? sp.reduce((s, v) => s + (v - avg) ** 2, 0) / sp.length : 0;
        const consistency = Math.max(0, 100 - Math.sqrt(variance) * 5);
        const pacePerKm = dKm > 0.01 ? dSec / dKm : 0;
        if (dSec > 30 && dM > 10) { try { await apiPost('/api/navigation/activity/log', { travel_mode: travelMode, origin_address: selectedRoute?.start_address, destination_address: destination || selectedRoute?.end_address, origin_lat: livePosition?.lat || lastPositionRef.current?.lat, origin_lng: livePosition?.lng || lastPositionRef.current?.lng, dest_lat: destinationCoords?.lat, dest_lng: destinationCoords?.lng, distance_meters: dM, duration_seconds: dSec, avg_speed_kmh: Math.round(avg * 10) / 10, max_speed_kmh: Math.round(maxSpeedRef.current * 10) / 10, calories_burned: Math.round(cal), quality_score: qual, speed_consistency: Math.round(consistency * 10) / 10, pace_per_km_seconds: Math.round(pacePerKm), checkpoints_reported: checkpointsReportedRef.current, checkpoints_encountered: checkpointsEncounteredRef.current, was_off_route: wasOffRouteRef.current, started_at: st || new Date().toISOString() }); Alert.alert('🏁 Session terminée', `📏 ${dKm.toFixed(1)} km · ⏱ ${Math.floor(dMin)} min · 🔥 ${Math.round(cal)} cal · ⭐ ${qual}/100`, [{ text: 'Stats', onPress: () => { setShowActivityStats(true); loadActivityStats(activityPeriod); } }, { text: 'OK' }]); } catch { } }
        setIsTracking(false); setNearbyCheckpoint(null); setIsOffRoute(false); setLivePosition(null);
    }, [travelMode, destination, livePosition, destinationCoords, selectedRoute, estimateCalories, computeQualityScore, activityPeriod, loadActivityStats]);

    useEffect(() => {
        return () => {
            if (locationSubscriptionRef.current) { try { locationSubscriptionRef.current.remove(); } catch { } } if (checkpointRefreshRef.current) { try { clearInterval(checkpointRefreshRef.current); } catch { } } if (trackingUpdateIntervalRef.current) { try { clearInterval(trackingUpdateIntervalRef.current); } catch { } }
        };
    }, []);

    // Timer pour rafraîchir le dashboard marche libre toutes les 5s
    useEffect(() => {
        if (!isFreeWalking) return;
        const timer = setInterval(() => setFreeWalkTick(t => t + 1), 5000);
        return () => clearInterval(timer);
    }, [isFreeWalking]);

    const dynamicStyles = useMemo(() => ({
        scrollContent: { padding: 16, paddingBottom: isKeyboardVisible && isLocationSelectorFocused ? Math.max(100, keyboardHeight + 100) : 100 },
        locationSelectorDynamic: { maxHeight: isKeyboardVisible && isLocationSelectorFocused ? Math.min(300, height - keyboardHeight - 200) : undefined, zIndex: isKeyboardVisible && isLocationSelectorFocused ? 1000 : 1 }
    }), [isKeyboardVisible, keyboardHeight, isLocationSelectorFocused]);

    // ── Gestion du bouton retour matériel ──
    useEffect(() => {
        const backAction = () => {
            // Si en marche libre, demander confirmation avant d'arrêter
            if (isFreeWalking) {
                Alert.alert(t('navigation.stopWalking'), t('navigation.activityWillBeSaved'), [
                    { text: t('navigation.continueWalking'), style: 'cancel' },
                    { text: t('navigation.stop'), style: 'destructive', onPress: () => stopFreeWalking() }
                ]);
                return true;
            }
            // Si on est dans un sous-écran (stats/alertes), revenir à l'écran principal
            if (showActivityStats || showAlertHistory) {
                setShowActivityStats(false);
                setShowAlertHistory(false);
                return true;
            }
            // Sinon, laisser le comportement par défaut (navigation.goBack())
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

        return () => backHandler.remove();
    }, [showActivityStats, showAlertHistory, isFreeWalking, stopFreeWalking]);

    // ══════════════════════════════════════════════════════════════════════
    // ── RENDU ────────────────────────────────────────────────────────────
    // ══════════════════════════════════════════════════════════════════════
    return (
        <SafeNativeView style={st.container}>
            <KeyboardAvoidingView style={st.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={KEYBOARD_OFFSET}>
                <ScrollView ref={scrollViewRef} style={st.flex1} contentContainerStyle={dynamicStyles.scrollContent}
                    nestedScrollEnabled showsVerticalScrollIndicator={false} scrollEnabled={!isHorizontalScrolling} keyboardShouldPersistTaps="handled">

                    {/* ━━ HEADER ━━ */}
                    <View style={st.header}>
                        <View style={st.headerLeft}>
                            <TouchableOpacity onPress={() => {
                                if (isFreeWalking) {
                                    Alert.alert(t('navigation.stopWalking'), t('navigation.activityWillBeSaved'), [
                                        { text: t('navigation.continueWalking'), style: 'cancel' },
                                        { text: t('navigation.stop'), style: 'destructive', onPress: () => stopFreeWalking() }
                                    ]);
                                } else if (showActivityStats || showAlertHistory) {
                                    setShowActivityStats(false);
                                    setShowAlertHistory(false);
                                } else {
                                    navigation.goBack();
                                }
                            }} style={st.backBtn}>
                                <SafeIcon name={isFreeWalking || showActivityStats || showAlertHistory ? "X" : "Home"} size={18} color={modernColors.text} />
                            </TouchableOpacity>
                            <View style={st.headerIcon}><Text style={{ fontSize: 22 }}>🧭</Text></View>
                            <View>
                                <Text style={st.headerTitle}>Navigation</Text>
                                <Text style={st.headerSub}>
                                    {isFreeWalking ? '🚶 Marche libre en cours' :
                                        isTracking ? '📡 Suivi en cours' :
                                            showActivityStats ? '📊 Stats & Coach IA' :
                                                showAlertHistory ? '🚨 Alertes' :
                                                    t('navigationScreen.itinerairesIntelligents')}
                                </Text>
                            </View>
                        </View>
                        <View style={st.headerRight}>
                            {/* Bouton Alertes Communautaires */}
                            <TouchableOpacity
                                style={[st.headerBtn, showAlertHistory && st.headerBtnAlertActive]}
                                onPress={() => {
                                    const n = !showAlertHistory;
                                    setShowAlertHistory(n);
                                    setShowActivityStats(false); // Fermer les stats si ouvertes
                                    if (n) loadAlertHistory();
                                }}
                            >
                                <SafeIcon name="AlertTriangle" size={18} color={showAlertHistory ? '#fff' : modernColors.text} />
                                {checkpoints.length > 0 && (
                                    <View style={st.alertBadge}>
                                        <Text style={st.alertBadgeText}>{checkpoints.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            {/* Bouton Statistiques */}
                            <TouchableOpacity
                                style={[st.headerBtn, showActivityStats && st.headerBtnActive]}
                                onPress={() => {
                                    const n = !showActivityStats;
                                    setShowActivityStats(n);
                                    setShowAlertHistory(false); // Fermer les alertes si ouvertes
                                    if (n) loadActivityStats(activityPeriod);
                                }}
                            >
                                <SafeIcon name={showActivityStats ? 'Compass' : 'BarChart3'} size={18} color={showActivityStats ? '#fff' : modernColors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ━━ HISTORIQUE DES ALERTES (toggle via icône header) ━━ */}
                    {showAlertHistory && (
                        <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#EF4444', marginBottom: 8 }]}>
                            <View style={st.alertHistHdr}>
                                <Text style={{ fontSize: 18 }}>🚨</Text>
                                <View style={st.flex1}>
                                    <Text style={st.alertHistTitle}>Alertes communautaires</Text>
                                    <Text style={st.alertHistSub}>{checkpoints.length > 0 ? `${checkpoints.length} alerte${checkpoints.length > 1 ? 's' : ''} active${checkpoints.length > 1 ? 's' : ''}` : 'Aucune alerte active'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowAlertHistory(false)}>
                                    <SafeIcon name="X" size={16} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <View style={{ marginTop: 10 }}>
                                {__DEV__ && (
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#F3F4F6', padding: 8, borderRadius: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                                        onPress={createTestAlerts}
                                    >
                                        <Text style={{ fontSize: 12, color: '#6B7280', marginRight: 4 }}>🧪</Text>
                                        <Text style={{ fontSize: 12, color: '#6B7280' }}>{t('navigation.creerAlertesDeTest')}</Text>
                                    </TouchableOpacity>
                                )}
                                {loadingAlertHistory ? (
                                    <View style={st.loadCard}><ActivityIndicator color="#EF4444" /><Text style={st.loadText}>{t('navigation.chargementDesAlertes')}</Text></View>
                                ) : alertHistoryData.length === 0 ? (
                                    <View style={{ alignItems: 'center' as any, padding: 16 }}><Text style={{ fontSize: 32 }}>✅</Text><Text style={st.emptyText}>{t('navigation.aucuneAlerteSignaleeDansCette')}</Text></View>
                                ) : (
                                    alertHistoryData.map((alert, idx) => {
                                        const info = CHECKPOINT_LABELS[alert.checkpoint_type] || { label: alert.checkpoint_type, icon: '⚠️', color: '#6B7280' };
                                        const timeAgo = alert.created_at ? (() => {
                                            const diff = Date.now() - new Date(alert.created_at).getTime();
                                            if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
                                            if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)}h`;
                                            return `il y a ${Math.floor(diff / 86400000)}j`;
                                        })() : '';
                                        return (
                                            <View key={alert.id || idx} style={[st.alertHistItem, { borderLeftColor: info.color }]}>
                                                <Text style={{ fontSize: 20 }}>{info.icon}</Text>
                                                <View style={st.flex1}>
                                                    <View style={st.alertHistItemTop}>
                                                        <Text style={[st.alertHistLabel, { color: info.color }]}>{info.label}</Text>
                                                        {alert.count > 1 && <View style={[st.alertHistCountBadge, { backgroundColor: info.color + '20' }]}><Text style={[st.alertHistCountTxt, { color: info.color }]}>×{alert.count}</Text></View>}
                                                    </View>
                                                    <Text style={st.alertHistLoc} numberOfLines={1}>📍 {alert.locationName}</Text>
                                                    <View style={st.alertHistMeta}>
                                                        <Text style={st.alertHistDist}>{formatDistance(alert.distance)}</Text>
                                                        {timeAgo ? <Text style={st.alertHistTime}>🕒 {timeAgo}</Text> : null}
                                                        {alert.speed_limit ? <Text style={st.alertHistSpd}>🚦 {alert.speed_limit} km/h</Text> : null}
                                                    </View>
                                                    {/* ✅ Boutons confirmer / infirmer l'alerte */}
                                                    <View style={st.voteRow}>
                                                        <TouchableOpacity style={st.voteBtn} onPress={() => voteCheckpoint(alert.id, 'up')} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 14 }}>👍</Text>
                                                            <Text style={st.voteBtnTxt}>{t('navigationScreen.confirmer')}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={[st.voteBtn, st.voteBtnDown]} onPress={() => voteCheckpoint(alert.id, 'down')} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 14 }}>👎</Text>
                                                            <Text style={[st.voteBtnTxt, { color: '#EF4444' }]}>Infirmer</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[st.voteBtn, expandedCommentsId === alert.id && { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' }]}
                                                            onPress={() => setExpandedCommentsId(prev => prev === alert.id ? null : alert.id)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="message-circle" size={14} color={expandedCommentsId === alert.id ? '#2563EB' : '#6B7280'} />
                                                            <Text style={[st.voteBtnTxt, { color: expandedCommentsId === alert.id ? '#2563EB' : '#6B7280' }]}>Commenter</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    {/* ✅ Section commentaires (expandable) */}
                                                    <CheckpointCommentsSection
                                                        checkpointId={alert.id}
                                                        visible={expandedCommentsId === alert.id}
                                                    />
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        </NativeCard>
                    )}

                    {/* ━━ BARRE D'ALERTES COMMUNAUTAIRES (compacte, toggle) ━━ */}
                    <TouchableOpacity style={st.alertToggle} onPress={() => setShowReportBar(!showReportBar)} activeOpacity={0.7}>
                        <SafeIcon name="AlertTriangle" size={14} color={modernColors.textSecondary} />
                        <Text style={st.alertToggleText}>Signaler une alerte</Text>
                        {checkpoints.length > 0 && <View style={st.alertCountBadge}><Text style={st.alertCountText}>{checkpoints.length}</Text></View>}
                        <SafeIcon name={showReportBar ? 'ChevronUp' : 'ChevronDown'} size={14} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                    {showReportBar && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.alertChipScroll} contentContainerStyle={st.alertChipContent}>
                            {REPORT_TYPES.map(r => (
                                <TouchableOpacity
                                    key={r.type}
                                    style={[st.alertChip, { backgroundColor: r.bg, borderColor: r.color + '30' }]}
                                    onPress={() => { reportCheckpoint(r.type); setShowReportBar(false); }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={st.alertChipIcon}>{r.icon}</Text>
                                    <Text style={[st.alertChipLabel, { color: r.color }]}>{r.short}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* ━━━━━━ MODE: MARCHE LIBRE ━━━━━━ */}
                    {isFreeWalking ? (
                        <>
                            {/* freeWalkTick force le re-render du dashboard */}
                            <NativeCard key={`fw-${freeWalkTick}`} style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#10B98120', alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ fontSize: 28 }}>🚶</Text>
                                    </View>
                                    <View style={st.flex1}>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: modernColors.text }}>Marche libre en cours</Text>
                                        <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>{t('navigation.suiviGpsActif')}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 }}>
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14 }}>📏</Text>
                                        <Text style={{ fontSize: 22, fontWeight: '900', color: modernColors.text }}>{(distanceTraveledRef.current / 1000).toFixed(2)}</Text>
                                        <Text style={{ fontSize: 10, color: modernColors.textSecondary }}>km</Text>
                                    </View>
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14 }}>⏱</Text>
                                        <Text style={{ fontSize: 22, fontWeight: '900', color: modernColors.text }}>{trackingStartTimeRef.current ? Math.floor((Date.now() - new Date(trackingStartTimeRef.current).getTime()) / 60000) : 0}</Text>
                                        <Text style={{ fontSize: 10, color: modernColors.textSecondary }}>min</Text>
                                    </View>
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14 }}>🏃</Text>
                                        <Text style={{ fontSize: 22, fontWeight: '900', color: modernColors.text }}>{Math.round(currentSpeed)}</Text>
                                        <Text style={{ fontSize: 10, color: modernColors.textSecondary }}>km/h</Text>
                                    </View>
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14 }}>🔥</Text>
                                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#EF4444' }}>{Math.round(estimateCalories(distanceTraveledRef.current / 1000, trackingStartTimeRef.current ? (Date.now() - new Date(trackingStartTimeRef.current).getTime()) / 60000 : 0, 'walking', currentSpeed))}</Text>
                                        <Text style={{ fontSize: 10, color: modernColors.textSecondary }}>cal</Text>
                                    </View>
                                </View>
                            </NativeCard>
                            {/* Nearby checkpoint en marche libre */}
                            {nearbyCheckpoint && (
                                <View style={[st.cpAlert, { backgroundColor: (CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color || '#EF4444') + '15' }]}>
                                    <Text style={{ fontSize: 28 }}>{CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.icon || '⚠️'}</Text>
                                    <View style={st.flex1}>
                                        <Text style={[st.cpTitle, { color: CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color }]}>{CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.label} dans {nearbyCheckpoint.distance >= 1000 ? `${(nearbyCheckpoint.distance / 1000).toFixed(1)} km` : `${nearbyCheckpoint.distance} m`}</Text>
                                    </View>
                                </View>
                            )}
                            <TouchableOpacity style={st.stopBtn} onPress={stopFreeWalking}>
                                <Text style={{ fontSize: 16 }}>⏹</Text>
                                <Text style={st.stopText}>{t('navigation.arreterLaMarche')}</Text>
                            </TouchableOpacity>
                        </>

                    ) : isTracking && selectedRoute ? (
                        <>
                            {/* AI Risk */}
                            {checkpointAiAnalysis && (
                                <View style={[st.riskBanner, { borderLeftColor: (checkpointAiAnalysis.risk_level || 0) >= 7 ? '#EF4444' : (checkpointAiAnalysis.risk_level || 0) >= 4 ? '#F59E0B' : '#10B981' }]}>
                                    <View style={st.row8}>
                                        <Text style={{ fontSize: 18 }}>{(checkpointAiAnalysis.risk_level || 0) >= 7 ? '🚨' : (checkpointAiAnalysis.risk_level || 0) >= 4 ? '⚠️' : '✅'}</Text>
                                        <Text style={[st.riskTitle, { color: (checkpointAiAnalysis.risk_level || 0) >= 7 ? '#EF4444' : '#F59E0B' }]}>Risque {checkpointAiAnalysis.risk_label || ''} ({checkpointAiAnalysis.risk_level}/10)</Text>
                                    </View>
                                    {checkpointAiAnalysis.driving_tip && <Text style={st.riskTip}>{checkpointAiAnalysis.driving_tip}</Text>}
                                    {checkpointAiAnalysis.alerts?.map((a: any, i: number) => (
                                        <View key={i} style={[st.riskAlertRow, { borderLeftColor: a.severity === 'critical' ? '#EF4444' : '#F59E0B' }]}><Text style={st.riskAlertMsg}>{a.message}</Text></View>
                                    ))}
                                </View>
                            )}
                            {/* Nearby checkpoint */}
                            {nearbyCheckpoint && (
                                <View style={[st.cpAlert, { backgroundColor: (CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color || '#EF4444') + '15' }]}>
                                    <Text style={{ fontSize: 28 }}>{CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.icon || '⚠️'}</Text>
                                    <View style={st.flex1}>
                                        <Text style={[st.cpTitle, { color: CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color }]}>{CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.label} dans {nearbyCheckpoint.distance >= 1000 ? `${(nearbyCheckpoint.distance / 1000).toFixed(1)} km` : `${nearbyCheckpoint.distance} m`}</Text>
                                        {nearbyCheckpoint.speed_limit && <Text style={st.cpSpeed}>Limite: {nearbyCheckpoint.speed_limit} km/h</Text>}
                                    </View>
                                </View>
                            )}
                            {/* Deviation */}
                            {isOffRoute && (
                                <TouchableOpacity style={st.deviationAlert} onPress={() => { stopTracking(); searchRoutesRef.current(); }}>
                                    <Text style={{ fontSize: 16 }}>⚠️</Text><Text style={st.deviationText}>{t('navigation.horsItineraireAppuyezPourRecalculer')}</Text>
                                </TouchableOpacity>
                            )}
                            {/* Speed dashboard */}
                            <NativeCard style={st.trackingCard}>
                                <View style={st.trackRow}>
                                    <View style={st.speedGauge}><Text style={st.speedVal}>{Math.round(currentSpeed)}</Text><Text style={st.speedUnit}>km/h</Text></View>
                                    <View style={st.trackMetrics}>
                                        <View style={st.trackMetric}><Text style={{ fontSize: 14 }}>📍</Text><Text style={st.mVal}>{formatDistance(distanceRemaining)}</Text><Text style={st.mLbl}>restant</Text></View>
                                        <View style={st.trackMetric}><Text style={{ fontSize: 14 }}>⏱</Text><Text style={st.mVal}>{formatDuration(durationRemaining)}</Text><Text style={st.mLbl}>{t('navigation.duree')}</Text></View>
                                        <View style={st.trackMetric}><Text style={{ fontSize: 14 }}>🏁</Text><Text style={[st.mVal, { color: '#10B981' }]}>{liveETA || '--:--'}</Text><Text style={st.mLbl}>{t('navigation.arrivee')}</Text></View>
                                    </View>
                                </View>
                                {selectedRoute.steps?.[nextStepIndex] && (
                                    <View style={st.nextStep}><Text style={{ fontSize: 18 }}>↪️</Text>
                                        <View style={st.flex1}><Text style={st.nextText} numberOfLines={2}>{selectedRoute.steps[nextStepIndex].instructions}</Text><Text style={st.nextDist}>dans {formatDistance(selectedRoute.steps[nextStepIndex].distance_meters)}</Text></View>
                                    </View>
                                )}
                                <View style={st.progressBg}><View style={[st.progressFill, { width: `${Math.max(2, Math.min(100, ((selectedRoute.distance_meters - distanceRemaining) / selectedRoute.distance_meters) * 100))}%` as any }]} /></View>
                            </NativeCard>
                            {/* Map tracking */}
                            {showMap && mapRegion && (
                                <View style={st.mapWrap}>
                                    <AnyMapView ref={mapRef} style={st.mapView} provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined} initialRegion={mapRegion} showsUserLocation showsTraffic showsCompass loadingEnabled onMapReady={() => console.log('[NavigationScreen] ✅ Map ready (tracking)')} onError={(e: any) => console.error('[NavigationScreen] ❌ Map error (tracking):', e.nativeEvent || e)}>
                                        {routePolylineCoords.length > 1 && <Polyline coordinates={routePolylineCoords} strokeColor={modernColors.primary} strokeWidth={4} />}
                                        {destinationCoords && <Marker coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }} title="Destination" pinColor="#EF4444" tracksViewChanges={false} />}
                                        {livePosition && <Marker coordinate={{ latitude: livePosition.lat, longitude: livePosition.lng }} title={t('navigation.maPosition')} pinColor="#3B82F6" />}
                                        {checkpoints.slice(0, 10).map(cp => <Marker key={cp.id} coordinate={{ latitude: cp.latitude, longitude: cp.longitude }} title={`${CHECKPOINT_LABELS[cp.checkpoint_type]?.icon || '⚠️'} ${CHECKPOINT_LABELS[cp.checkpoint_type]?.label || cp.checkpoint_type}`} pinColor={CHECKPOINT_LABELS[cp.checkpoint_type]?.color || '#6B7280'} tracksViewChanges={false} />)}
                                    </AnyMapView>
                                    <TouchableOpacity style={st.mapBtnLabeled} onPress={() => { if (livePosition && mapRef.current) mapRef.current.animateToRegion({ latitude: livePosition.lat, longitude: livePosition.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500); }}>
                                        <SafeIcon name="Locate" size={14} color={modernColors.primary} />
                                        <Text style={st.mapBtnLabelTxt}>{t('navigation.maPosition')}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <TouchableOpacity style={st.stopBtn} onPress={stopTracking}><Text style={{ fontSize: 16 }}>⏹</Text><Text style={st.stopText}>{t('navigation.arreterLeSuivi')}</Text></TouchableOpacity>
                        </>

                    ) : showActivityStats ? (
                        /* ━━━━━━ MODE: STATISTIQUES ━━━━━━ */
                        <>
                            <View style={st.periodRow}>
                                {(['week', 'month', 'year'] as const).map(p => (
                                    <TouchableOpacity key={p} style={[st.periodBtn, activityPeriod === p && st.periodBtnActive]} onPress={() => { setActivityPeriod(p); loadActivityStats(p); }}>
                                        <Text style={[st.periodText, activityPeriod === p && st.periodTextActive]}>{p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : t('navigationScreen.annee')}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {loadingActivity ? (
                                <NativeCard style={st.loadCard}><ActivityIndicator color={modernColors.primary} /><Text style={st.loadText}>{t('navigation.chargement')}</Text></NativeCard>
                            ) : activitySummary ? (
                                <>
                                    {/* Summary */}
                                    <NativeCard style={st.summCard}>
                                        <View style={st.statsGrid}>
                                            {[{ e: '📏', v: (activitySummary.total_distance_km || 0).toFixed(1), l: 'km' }, { e: '🏃', v: activitySummary.total_sessions || 0, l: 'sessions' }, { e: '🔥', v: Math.round(activitySummary.total_calories || 0), l: 'cal' }, { e: '⏱', v: Math.round(activitySummary.total_duration_minutes || 0), l: 'min' }].map((s, i) => (
                                                <React.Fragment key={i}>{i > 0 && <View style={st.statDiv} />}<View style={st.statItem}><Text style={{ fontSize: 20 }}>{s.e}</Text><Text style={st.statVal}>{s.v}</Text><Text style={st.statLbl}>{s.l}</Text></View></React.Fragment>
                                            ))}
                                        </View>
                                    </NativeCard>
                                    {/* ━━ PARTAGE EXTERNE DES STATS ━━ */}
                                    <TouchableOpacity
                                        style={st.shareStatsBtn}
                                        activeOpacity={0.8}
                                        onPress={async () => {
                                            const periodLabel = activityPeriod === 'week' ? 'cette semaine' : activityPeriod === 'month' ? 'ce mois' : t('navigationScreen.cetteAnnee');
                                            const dist = (activitySummary.total_distance_km || 0).toFixed(1);
                                            const sess = activitySummary.total_sessions || 0;
                                            const cal = Math.round(activitySummary.total_calories || 0);
                                            const dur = Math.round(activitySummary.total_duration_minutes || 0);
                                            const best = activitySummary.best_session;
                                            const hs = aiInsights?.health_score;
                                            let msg = `🏃‍♂️ Mes stats navigation Yukpo (${periodLabel}) :\n\n` +
                                                `📏 ${dist} km parcourus\n` +
                                                t('navigationScreen.caloriesBruleesn', { cal: cal }) +
                                                t('navigationScreen.minutesDactiviten', { dur: dur }) +
                                                `🎯 ${sess} session${sess > 1 ? 's' : ''}`;
                                            if (hs?.score) msg += t('navigationScreen.nScoreSante100', { hs_score: hs.score, hs_label || '': hs.label || '' });
                                    if (best) msg += `\n🏅 Record : ${best.distance_km?.toFixed(1)} km en ${Math.round(best.duration_minutes || 0)} min`;
                                    msg += `\n\n💪 Rejoins-moi sur Yukpo et suis tes performances ! 🚀\n`;
                                    msg += Platform.OS === 'ios'
                                    ? 'https://apps.apple.com/app/yukpomnang'
                                    : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                    try {await Share.share({ message: msg, title: t('navigation.mesStatsYukpoNavigation') }); } catch { }
                                        }}
                                    >
                                    <SafeIcon name="share" size={18} color="#fff" />
                                    <View>
                                        <Text style={st.shareStatsTxt}>{t('navigationScreen.partagerMesStatistiques')}</Text>
                                        <Text style={st.shareStatsSub}>{t('navigation.inviteTesAmisARejoindre')}</Text>
                                    </View>
                                </TouchableOpacity>
                            {/* ✅ NOUVEAU 2026-03-14: Partage interne des stats navigation */}
                            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
                                <InternalShareButton
                                    payload={{
                                        contentType: 'navigation_stats',
                                        title: t('navigation.mesStatistiquesDeNavigation'),
                                        description: `${(activitySummary.total_distance_km || 0).toFixed(1)} km · ${activitySummary.total_sessions || 0} sessions · ${Math.round(activitySummary.total_calories || 0)} cal`,
                                        extraData: {
                                            total_distance_km: activitySummary.total_distance_km,
                                            total_sessions: activitySummary.total_sessions,
                                            total_calories: activitySummary.total_calories,
                                            total_duration_minutes: activitySummary.total_duration_minutes,
                                            health_score: aiInsights?.health_score?.score,
                                            period: activityPeriod,
                                        },
                                    }}
                                    iconSize={16}
                                    iconColor="#6366F1"
                                    showLabel
                                    label={t('navigation.envoyerAUnAmi')}
                                    style={{ backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
                                />
                            </View>
                            {/* Best session */}
                            {activitySummary.best_session && (
                                <NativeCard style={[st.secCard, { backgroundColor: '#FFFBEB' }]}>
                                    <Text style={st.secTitle}>🏅 Meilleure session</Text>
                                    <View style={st.bestRow}>
                                        <Text style={st.bestStat}>{activitySummary.best_session.distance_km?.toFixed(1)} km</Text>
                                        <Text style={st.bestStat}>{Math.round(activitySummary.best_session.duration_minutes || 0)} min</Text>
                                        <Text style={st.bestStat}>⭐ {Math.round(activitySummary.best_session.quality_score)}/100</Text>
                                    </View>
                                </NativeCard>
                            )}
                            {/* By mode */}
                            {activitySummary.by_mode?.length > 0 && (
                                <NativeCard style={st.secCard}>
                                    <Text style={st.secTitle}>🚀 Par mode</Text>
                                    {activitySummary.by_mode.map((m: any, i: number) => {
                                        // Validation et extraction sécurisée des données
                                        const mode = typeof m?.mode === 'string' ? m.mode : 'unknown';
                                        const count = typeof m?.count === 'number' ? m.count : 0;
                                        const distance = typeof m?.distance_km === 'number' ? m.distance_km : 0;

                                        return (
                                            <View key={i} style={st.modeRow}>
                                                <Text style={{ fontSize: 20, width: 28, textAlign: 'center' as any }}>
                                                    {mode === 'walking' ? '🚶' : mode === 'bicycling' ? '🚲' : mode === 'transit' ? '🚌' : '🚗'}
                                                </Text>
                                                <Text style={st.modeNm}>
                                                    {mode === 'walking' ? 'Marche' : mode === 'bicycling' ? 'Vélo' : mode === 'transit' ? 'Transport' : mode === 'driving' ? 'Voiture' : 'Inconnu'}
                                                </Text>
                                                <Text style={st.modeBdg}>{count}x</Text>
                                                <Text style={st.modeDst}>{distance.toFixed(1)} km</Text>
                                            </View>
                                        );
                                    })}
                                </NativeCard>
                            )}
                            {/* ━━ LIEUX VISITÉS ━━ */}
                            {activitySummary.most_visited_places?.length > 0 && (
                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#8B5CF6' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <Text style={st.secTitle}>{t('navigation.lieuxVisites')}</Text>
                                        <Text style={{ fontSize: 11, color: modernColors.textSecondary }}>{activityPeriod === 'week' ? 'Cette semaine' : activityPeriod === 'month' ? 'Ce mois' : t('navigationScreen.cetteAnnee')}</Text>
                                    </View>
                                    {activitySummary.most_visited_places.map((place: any, i: number) => {
                                        const name = typeof place?.name === 'string' ? place.name : t('navigationScreen.lieuInconnu');
                                        const count = typeof place?.visit_count === 'number' ? place.visit_count : 0;
                                        const isTop = i === 0;
                                        return (
                                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: modernColors.border }}>
                                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isTop ? '#8B5CF620' : modernColors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ fontSize: isTop ? 16 : 14 }}>{isTop ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : '📌'}</Text>
                                                </View>
                                                <View style={st.flex1}>
                                                    <Text style={{ fontSize: 13, fontWeight: '600', color: modernColors.text }} numberOfLines={1}>{name}</Text>
                                                </View>
                                                <View style={{ backgroundColor: '#8B5CF615', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#8B5CF6' }}>{count} visite{count > 1 ? 's' : ''}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </NativeCard>
                            )}

                            {/* ━━ TYPES DE LIEUX FAVORIS ━━ */}
                            {activitySummary.favorite_poi_types?.length > 0 && (
                                <NativeCard style={st.secCard}>
                                    <Text style={st.secTitle}>⭐ Types de lieux favoris</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                        {activitySummary.favorite_poi_types.map((poi: any, i: number) => {
                                            const poiType = typeof poi?.poi_type === 'string' ? poi.poi_type : 'autre';
                                            const count = typeof poi?.count === 'number' ? poi.count : 0;
                                            const poiIcons: Record<string, string> = { restaurant: '🍽️', pharmacy: '💊', hospital: '🏥', bank: '🏦', gas_station: '⛽', supermarket: '🛒', school: '🎓', mosque: '🕌', church: '⛪', hotel: '🏨', bar: '🍺', cafe: '☕', police: '👮', post_office: '📮', parking: '🅿️' };
                                            return (
                                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: modernColors.surfaceVariant, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: modernColors.border }}>
                                                    <Text style={{ fontSize: 14 }}>{poiIcons[poiType] || '📍'}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: modernColors.text }}>{poiType}</Text>
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: modernColors.primary, marginLeft: 2 }}>×{count}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </NativeCard>
                            )}

                            {/* Recent history */}
                            {activityHistory.length > 0 && (
                                <NativeCard style={st.secCard}>
                                    <Text style={st.secTitle}>{t('navigation.activitesRecentes')}</Text>
                                    {activityHistory.slice(0, 5).map((a: any, i: number) => {
                                        // Validation et extraction sécurisée des données
                                        const travelMode = typeof a?.travel_mode === 'string' ? a.travel_mode : 'unknown';
                                        const destination = typeof a?.destination === 'string' ? a.destination : 'Trajet inconnu';
                                        const distance = typeof a?.distance_km === 'number' ? a.distance_km : 0;
                                        const duration = typeof a?.duration_minutes === 'number' ? a.duration_minutes : 0;
                                        const quality = typeof a?.quality_score === 'number' ? a.quality_score : 0;

                                        return (
                                            <View key={i} style={st.histRow}>
                                                <Text style={{ fontSize: 20, width: 28, textAlign: 'center' as any }}>
                                                    {travelMode === 'walking' ? '🚶' : travelMode === 'bicycling' ? '🚲' : travelMode === 'driving' ? '🚗' : '🚗'}
                                                </Text>
                                                <View style={st.flex1}>
                                                    <Text style={st.histDest} numberOfLines={1}>{destination}</Text>
                                                    <Text style={st.histMeta}>{distance.toFixed(1)} km · {Math.round(duration)} min</Text>
                                                </View>
                                                <Text style={[st.histScore, { color: quality >= 70 ? '#10B981' : '#F59E0B' }]}>
                                                    {Math.round(quality)}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </NativeCard>
                            )}
                            {/* AI Coach */}
                            {aiInsights ? (
                                <>
                                    <View style={st.coachHdr}><Text style={st.coachTitle}>🤖 Coach IA</Text><TouchableOpacity onPress={sharePerformance} style={st.shareBtn}><SafeIcon name="share" size={14} color="#fff" /><Text style={st.shareTxt}>{t('navigationScreen.partager')}</Text></TouchableOpacity></View>
                                    {/* Health score */}
                                    {aiInsights.health_score && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={st.secTitle}>{t('navigation.scoreSante')}</Text>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: (aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B') + '15' }}
                                                            onPress={async () => {
                                                                const hs = aiInsights.health_score;
                                                                const bk = hs.breakdown;
                                                                const comment = hs.score >= 80 ? '🎉 Excellent ! Mon mode de vie actif porte ses fruits.'
                                                                    : hs.score >{t('navigationScreen.60BonDebutJeContinueMes')}
                                                                        : t('navigationScreen.jeDemarreMonParcoursSanteAvec');
                                                                let msg = t('navigationScreen.monScoreSanteYukpo100Nn', { hs_score: hs.score, hs_label: hs.label });
                                                                if (bk) msg += `🏃 Activité: ${bk.activity || 0}/30\n⭐ Qualité: ${bk.quality || 0}/20\n🔥 Série: ${bk.streak || 0}/15\n🌍 Éco: ${bk.eco || 0}/10\n\n`;
                                                                msg += `💬 ${comment}\n\n🤖 Analyse par le Coach IA Yukpo\n`;
                                                                msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                                                try { await Share.share({ message: msg, title: t('navigation.monScoreSanteYukpo') }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="share" size={12} color={aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B'} />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }}>{t('navigationScreen.partager')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={{ alignItems: 'center' as any, marginVertical: 12 }}>
                                                        <View style={[st.scoreCircle, { borderColor: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}><Text style={[st.scoreVal, { color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>{aiInsights.health_score.score}</Text><Text style={st.scoreMax}>/100</Text></View>
                                                        <Text style={[st.scoreLbl, { color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>{aiInsights.health_score.label}</Text>
                                                    </View>
                                                    {aiInsights.health_score.breakdown && <View style={{ gap: 6 }}>
                                        {[
                                            { l: t('navigationScreen.activite'), p: aiInsights.health_score.breakdown.activity || 0, m: 30, e: '🏃', tip: 'Points gagnés grâce à vos sessions de navigation. Plus vous vous déplacez régulièrement, plus vous gagnez de points !' },
                                            { l: t('navigationScreen.qualite'), p: aiInsights.health_score.breakdown.quality || 0, m: 20, e: '⭐', tip: 'Basé sur la qualité de vos trajets : respect des limites de vitesse, fluidité de conduite, temps de trajet optimal.' },
                                            { l: t('navigationScreen.serie'), p: aiInsights.health_score.breakdown.streak || 0, m: 15, e: '🔥', tip: 'Bonus pour votre régularité ! Utilisez Yukpo Navigation chaque jour pour maximiser ce score.' },
                                            { l: t('navigationScreen.eco'), p: aiInsights.health_score.breakdown.eco || 0, m: 10, e: '🌍', tip: 'Points pour vos choix écologiques : marche, vélo, transports en commun. Chaque mode vert rapporte plus !' },
                                        ].map((b, i) => (
                                            <TouchableOpacity key={i} style={st.brkRow} onPress={() => Alert.alert(`${b.e} ${b.l} — ${b.p}/${b.m} pts`, `${b.tip}\n\n${b.p >= b.m * 0.7 ? '✅ Bon niveau ! Continuez ainsi.' : `💡 Vous pouvez encore gagner ${b.m - b.p} points dans cette catégorie.`}`)} activeOpacity={0.7}>
                                                <Text style={{ fontSize: 14 }}>{b.e}</Text><View style={st.brkBarBg}><View style={[st.brkBarFill, { width: `${(b.p / b.m) * 100}%` as any, backgroundColor: b.p >= b.m * 0.7 ? '#10B981' : '#F59E0B' }]} /></View><Text style={st.brkPts}>{b.p}/{b.m}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>}
                                    {/* ✅ NOUVEAU 2026-03-14: Partage interne score santé */}
                                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                                        <InternalShareButton
                                            payload={{
                                                contentType: 'health_stats',
                                                title: t('navigationScreen.scoreSante100', { aiInsights_health_score_score: aiInsights.health_score.score }),
                                                description: aiInsights.health_score.label || '',
                                                extraData: {
                                                    score: aiInsights.health_score.score,
                                                    label: aiInsights.health_score.label,
                                                    breakdown: aiInsights.health_score.breakdown,
                                                },
                                            }}
                                            iconSize={14}
                                            iconColor={aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B'}
                                            showLabel
                                            label={t('navigation.envoyerAUnAmi')}
                                            style={{ backgroundColor: (aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B') + '15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
                                        />
                                    </View>
                                </NativeCard>
                                            )}
                            {/* Tips */}
                            {aiInsights.ai_tips?.length > 0 && (
                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#8B5CF6' }]}>
                                    <Text style={st.secTitle}>💡 Conseils</Text>
                                    {aiInsights.ai_tips.map((t: any, i: number) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={[st.tipCard, { borderLeftColor: t.priority === 'critical' ? '#EF4444' : '#10B981' }]}
                                            onPress={() => {
                                                if (t.action_url) {
                                                    Linking.openURL(t.action_url).catch(() => {
                                                        Alert.alert('Info', t.message);
                                                    });
                                                } else {
                                                    Alert.alert(t.title, t.message);
                                                }
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                                            <View style={st.flex1}>
                                                <Text style={st.tipTitle}>{t.title}</Text>
                                                <Text style={st.tipMsg}>{t.message}</Text>
                                            </View>
                                            <SafeIcon name="ChevronRight" size={16} color="#666" />
                                        </TouchableOpacity>
                                    ))}
                                </NativeCard>
                            )}
                            {/* Gamification */}
                            {aiInsights.gamification && (
                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={st.secTitle}>🎮 Gamification</Text>
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F59E0B15' }}
                                            onPress={sharePerformance}
                                            activeOpacity={0.7}
                                        >
                                            <SafeIcon name="share" size={12} color="#F59E0B" />
                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#F59E0B' }}>{t('navigationScreen.partager')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={st.streakRow}>
                                        <TouchableOpacity style={st.streakItem} onPress={() => Alert.alert('🔥 Série en cours', `Vous êtes actif depuis ${aiInsights.gamification.current_streak} jour${aiInsights.gamification.current_streak > 1 ? 's' : ''} consécutifs !\n\n${aiInsights.gamification.current_streak >= 7 ? '🎉 Bravo ! Continuez pour maintenir votre série !' : '💪 Continuez chaque jour pour augmenter votre série !'}`, [{ text: 'OK' }])} activeOpacity={0.7}>
                                            <Text style={{ fontSize: 24 }}>🔥</Text><Text style={st.streakVal}>{aiInsights.gamification.current_streak}</Text><Text style={st.streakLbl}>jours</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={st.streakItem} onPress={() => Alert.alert('🏆 Record de série', `Votre meilleur record est de ${aiInsights.gamification.max_streak} jour${aiInsights.gamification.max_streak > 1 ? 's' : ''} consécutifs.\n\n${aiInsights.gamification.current_streak >= aiInsights.gamification.max_streak ? '🔥 Vous êtes en train de battre votre record !' : `🎯 Plus que ${aiInsights.gamification.max_streak - aiInsights.gamification.current_streak} jour(s) pour battre votre record !`}`, [{ text: 'OK' }])} activeOpacity={0.7}>
                                            <Text style={{ fontSize: 24 }}>🏆</Text><Text style={st.streakVal}>{aiInsights.gamification.max_streak}</Text><Text style={st.streakLbl}>record</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={st.streakItem} onPress={() => Alert.alert('⭐ Points', `Vous avez accumulé ${aiInsights.gamification.total_points} points !\n\n📊 Comment gagner des points :\n• Chaque trajet : +10 pts\n• Série quotidienne : +5 pts/jour\n• Défi terminé : +20 pts\n• Mode écologique : +15 pts`, [{ text: 'OK' }])} activeOpacity={0.7}>
                                            <Text style={{ fontSize: 24 }}>⭐</Text><Text style={st.streakVal}>{aiInsights.gamification.total_points}</Text><Text style={st.streakLbl}>points</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {aiInsights.gamification.badges?.length > 0 && <View style={st.badgesWrap}>{aiInsights.gamification.badges.map((b: any, i: number) => (
                                        <TouchableOpacity key={i} style={st.badge} onPress={() => Alert.alert(`${b.emoji} ${b.label}`, b.description || `Badge débloqué ! ${b.label}`, [{ text: t('common.share'), onPress: sharePerformance }, { text: 'OK' }])} activeOpacity={0.7}>
                                            <Text style={{ fontSize: 20 }}>{b.emoji}</Text><Text style={st.badgeLbl} numberOfLines={1}>{b.label}</Text>
                                        </TouchableOpacity>
                                    ))}</View>}
                                </NativeCard>
                            )}
                            {/* CO2 */}
                            {aiInsights.co2_impact && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                        <Text style={st.secTitle}>🌍 Impact Environnemental</Text>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#10B98115' }}
                                                            onPress={async () => {
                                                                const co2 = aiInsights.co2_impact;
                                                                const curr = co2?.currency_symbol || aiInsights.geo_context?.currency_symbol || 'FCFA';
                                                                const msg = `🌍 Mon impact environnemental (Yukpo Navigation)\n\n` +
                                                                    t('navigationScreen.kgDeCo2Emisn', { ((co2?_emitted_grams || 0) / 1000)_toFixed(1): ((co2?.emitted_grams || 0) / 1000).toFixed(1) }) +
                                                                    t('navigationScreen.kgDeCo2Economisesn', { ((co2?_saved_grams || 0) / 1000)_toFixed(1): ((co2?.saved_grams || 0) / 1000).toFixed(1) }) +
                                                                    t('navigationScreen.arbresEquivalentsn', { (co2?_trees_equivalent || 0)_toFixed(1): (co2?.trees_equivalent || 0).toFixed(1) }) +
                                                                    t('navigationScreen.economisesnn', { Math_round(co2?_fuel_cost_saved || co2?_fuel_cost_saved_fcfa || 0): Math.round(co2?.fuel_cost_saved || co2?.fuel_cost_saved_fcfa || 0), curr: curr }) +
                                                                    `♻️ Rejoins-moi sur Yukpo pour réduire ton empreinte carbone ! 🚀`;
                                                                try { await Share.share({ message: msg, title: t('navigation.monImpactYukpo') }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="share" size={12} color="#10B981" />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981' }}>{t('navigationScreen.partager')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={st.co2Grid}>
                                                        <TouchableOpacity style={st.co2Item} onPress={() => Alert.alert('💨 CO2 Émis', `Vous avez émis ${((aiInsights.co2_impact.emitted_grams || 0) / 1000).toFixed(1)} kg de CO2.\n\nAstuce : Privilégiez la marche ou les transports en commun pour réduire vos émissions !`)} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 22 }}>💨</Text><Text style={st.co2Val}>{((aiInsights.co2_impact.emitted_grams || 0) / 1000).toFixed(1)}</Text><Text style={st.co2Lbl}>{t('navigation.kgEmis')}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={st.co2Item} onPress={() => Alert.alert('🌱 CO2 Économisé', `Vous avez économisé ${((aiInsights.co2_impact.saved_grams || 0) / 1000).toFixed(1)} kg de CO2 en choisissant des modes de transport écologiques.\n\nBravo ! Continuez ainsi ! 🎉`)} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 22 }}>🌱</Text><Text style={[st.co2Val, { color: '#10B981' }]}>{((aiInsights.co2_impact.saved_grams || 0) / 1000).toFixed(1)}</Text><Text style={st.co2Lbl}>{t('navigation.kgEco')}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={st.co2Item} onPress={() => Alert.alert('🌳 Arbres Équivalents', `Vos économies de CO2 équivalent à l'absorption de ${(aiInsights.co2_impact.trees_equivalent || 0).toFixed(1)} arbre${(aiInsights.co2_impact.trees_equivalent || 0) > 1 ? 's' : ''} sur un an.\n\nChaque trajet écologique compte !`)} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 22 }}>🌳</Text><Text style={st.co2Val}>{(aiInsights.co2_impact.trees_equivalent || 0).toFixed(1)}</Text><Text style={st.co2Lbl}>arbres</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={st.co2Item} onPress={() => Alert.alert('💰 Économies', `Vous avez économisé environ ${Math.round(aiInsights.co2_impact.fuel_cost_saved || aiInsights.co2_impact.fuel_cost_saved_fcfa || 0)} ${aiInsights.co2_impact.currency_symbol || aiInsights.geo_context?.currency_symbol || 'FCFA'} en carburant.\n\nCes économies se cumulent au fil du temps !`)} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 22 }}>💰</Text><Text style={[st.co2Val, { color: '#10B981' }]}>{Math.round(aiInsights.co2_impact.fuel_cost_saved || aiInsights.co2_impact.fuel_cost_saved_fcfa || 0)}</Text><Text style={st.co2Lbl}>{aiInsights.co2_impact.currency_symbol || aiInsights.geo_context?.currency_symbol || 'FCFA'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </NativeCard>
                                            )}
                    {/* Fitness */}
                    {aiInsights.fitness?.vo2max_estimate > 0 && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#EF4444' }]}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={st.secTitle}>❤️ Condition Physique</Text>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EF444415' }}
                                                            onPress={async () => {
                                                                const vo2 = aiInsights.fitness.vo2max_estimate;
                                                                const level = aiInsights.fitness.level || t('navigation.nonEvalue');
                                                                const comment = vo2 >{t('navigationScreen.50NiveauAthletiqueMonVo2maxEst')}
                                                                    : vo2 >= 40 ? '💪 Bonne forme ! En route vers l\'excellence.'
                                                                        : vo2 >= 30 ? '🏃 Je progresse ! Chaque trajet me rapproche de mes objectifs.'
                                                                            : t('navigationScreen.jeDemarreMonParcoursFitnessAvec');
                                                                const msg = `❤️ Ma Condition Physique - Coach IA Yukpo\n\n` +
                                                                    `💪 VO2max : ${vo2} ml/kg/min\n` +
                                                                    `📊 Niveau : ${level}\n\n` +
                                                                    `💬 ${comment}\n\n` +
                                                                    `🤖 Analyse par le Coach IA Yukpo Navigation\n` +
                                                                    (Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang');
                                                                try { await Share.share({ message: msg, title: t('navigation.maConditionPhysiqueYukpo') }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="share" size={12} color="#EF4444" />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#EF4444' }}>{t('navigationScreen.partager')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={{ alignItems: 'center' as any, marginVertical: 8 }}
                                                        onPress={() => {
                                                            const vo2 = aiInsights.fitness.vo2max_estimate;
                                                            const level = aiInsights.fitness.level || t('navigation.nonEvalue');
                                                            const advice = vo2 >{t('navigationScreen.50ExcellentMaintenezCetteCadenceAvec')}
                                                                : vo2 >{t('navigationScreen.40BonNiveauEssayezDaugmenterLa')}
                                                                    : vo2 >= 30 ? 'Niveau moyen. Commencez par 30 min de marche rapide 3x/semaine.'
                    : 'Débutant. Commencez doucement avec 15 min de marche par jour.';
                    Alert.alert(
                    `❤️ VO2max : ${vo2} ml/kg/min`,
                    t('navigationScreen.niveauNnQuestceQueLeVo2max', {level: level, advice: advice }),
                    [
                    {text: 'Planifier une marche', onPress: () => {setShowActivityStats(false); } },
                    {text: 'OK' }
                    ]
                    );
                                                        }}
                    activeOpacity={0.7}
                                                    >
                    <Text style={st.vo2Val}>{aiInsights.fitness.vo2max_estimate}</Text><Text style={st.vo2Unit}>VO2max (ml/kg/min)</Text>
                    <View style={[st.fitLevel, { backgroundColor: aiInsights.fitness.level === 'Excellent' ? '#10B98120' : '#F59E0B20' }]}><Text style={[st.fitLevelTxt, { color: aiInsights.fitness.level === 'Excellent' ? '#10B981' : '#F59E0B' }]}>{aiInsights.fitness.level}</Text></View>
                    <Text style={{ fontSize: 11, color: modernColors.textSecondary, marginTop: 6 }}>{t('navigation.appuyezPourEnSavoirPlus')}</Text>
                </TouchableOpacity>
            </NativeCard>
                                            )}
            {/* Challenges */}
            {aiInsights.challenges?.length > 0 && (
                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={st.secTitle}>{t('navigation.defis')}</Text>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#3B82F615' }}
                            onPress={async () => {
                                const completed = aiInsights.challenges.filter((c: any) => c.completed).length;
                                const total = aiInsights.challenges.length;
                                const comment = completed === total ? t('navigationScreen.tousMesDefisSontTerminesPret')
                                    : completed > 0 ? t('navigationScreen.defisTerminesJeContinue', { completed: completed, total: total })
                                        : '🎯 J\'ai des défis à relever, motivé(e) !';
                                let msg = `🎯 Mes Défis Coach IA Yukpo\n\n`;
                                aiInsights.challenges.forEach((c: any) => { msg += `${c.emoji || '🎯'} ${c.label} — ${Math.round(c.progress)}% ${c.completed ? '✅' : ''}\n`; });
                                msg += t('navigationScreen.nNnGenereParLeCoach', { comment: comment });
                                msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                try { await Share.share({ message: msg, title: t('navigation.mesDefisYukpo') }); } catch { }
                            }}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="Redo2" size={12} color="#3B82F6" />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#3B82F6' }}>{t('navigationScreen.partager')}</Text>
                        </TouchableOpacity>
                    </View>
                    {aiInsights.challenges.map((c: any, i: number) => (
                        <TouchableOpacity
                            key={i}
                            style={{ marginBottom: 12 }}
                            onPress={() => {
                                Alert.alert(
                                    c.label,
                                    `Progression: ${Math.round(c.progress)}%\n${c.completed ? t('navigationScreen.defiTermine') : '🎯 Continuez vos efforts !'}`,
                                    [
                                        { text: 'OK', style: 'default' },
                                        ...(c.action_url ? [{ text: t('common.viewDetails'), onPress: () => Linking.openURL(c.action_url) }] : [])
                                    ]
                                );
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={st.row8}>
                                <Text>{c.emoji}</Text>
                                <Text style={st.chLabel} numberOfLines={1}>{c.label}</Text>
                                {c.completed && <Text>✅</Text>}
                                <SafeIcon name="ChevronRight" size={16} color="#666" />
                            </View>
                            <View style={st.chBarBg}>
                                <View style={[st.chBarFill, { width: `${c.progress}%` as any, backgroundColor: c.completed ? '#10B981' : '#3B82F6' }]} />
                            </View>
                            <Text style={st.chProg}>{Math.round(c.progress)}%</Text>
                        </TouchableOpacity>
                    ))}
                </NativeCard>
            )}
            {/* Records */}
            {aiInsights.personal_records && (
                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#FFD700' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={st.secTitle}>🏅 Records</Text>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FFD70020' }}
                            onPress={async () => {
                                const pr = aiInsights.personal_records;
                                let msg = `🏅 Mes Records Personnels - Coach IA Yukpo\n\n`;
                                if (pr.longest_session_km) msg += `📏 Plus longue distance : ${pr.longest_session_km} km\n`;
                                if (pr.fastest_speed_kmh) msg += `⚡ Vitesse max : ${pr.fastest_speed_kmh} km/h\n`;
                                if (pr.most_calories) msg += `🔥 Max calories : ${pr.most_calories} cal\n`;
                                const recordCount = [pr.longest_session_km, pr.fastest_speed_kmh, pr.most_calories].filter(Boolean).length;
                                const comment = recordCount > { t('navigationScreen.3ImpressionnantMesRecordsParlentDeuxmemes') }
                                                                    : recordCount >= 1 ? '💪 En route pour battre encore plus de records !'
                        : t('navigationScreen.lesPremiersRecordsArriventBientot');
                        msg += `\n💬 ${comment}\n\n🤖 Suivi par le Coach IA Yukpo\n`;
                        msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                        try {await Share.share({ message: msg, title: t('navigation.mesRecordsYukpo') }); } catch { }
                                                            }}
                        activeOpacity={0.7}
                                                        >
                        <SafeIcon name="Redo2" size={12} color="#D4A017" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#D4A017' }}>{t('navigationScreen.partager')}</Text>
                    </TouchableOpacity>
                </View>
                                                    {[
                aiInsights.personal_records.longest_session_km && { e: '📏', t: 'Plus longue', v: `${aiInsights.personal_records.longest_session_km} km` },
                aiInsights.personal_records.fastest_speed_kmh && { e: '⚡', t: 'Vitesse max', v: `${aiInsights.personal_records.fastest_speed_kmh} km/h` },
                aiInsights.personal_records.most_calories && { e: '🔥', t: 'Max calories', v: `${aiInsights.personal_records.most_calories} cal` },
            ].filter(Boolean).map((r: any, i: number) => (
                <TouchableOpacity
                    key={i}
                    style={st.recRow}
                    onPress={() => {
                        Alert.alert(
                            r.t,
                            t('navigationScreen.recordPersonnelNfelicitationsPourCettePerformance', { r_v: r.v }),
                            [
                                { text: t('common.share'), onPress: () => sharePerformance() },
                                { text: 'OK', style: 'default' }
                            ]
                        );
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={{ fontSize: 20, width: 28 }}>{r.e}</Text>
                    <View style={st.flex1}>
                        <Text style={st.recTitle}>{r.t}</Text>
                        <Text style={st.recVal}>{r.v}</Text>
                    </View>
                    <SafeIcon name="ChevronRight" size={16} color="#666" />
                </TouchableOpacity>
            ))}
        </NativeCard>
    )
}
{/* Commute */ }
{
    aiInsights.commute_insights?.frequent_routes?.length > 0 && (
        <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#6366F1' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={st.secTitle}>🏠 Trajets Habituels</Text>
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#6366F115' }}
                    onPress={async () => {
                        const routes = aiInsights.commute_insights.frequent_routes;
                        const peaks = aiInsights.commute_insights.peak_departure_hours;
                        let msg = `🏠 Mes Trajets Habituels - Coach IA Yukpo\n\n`;
                        routes.slice(0, 3).forEach((r: any) => { msg += `📍 ${r.from} → ${r.to} (${r.count}x)\n`; });
                        if (peaks?.length > 0) {
                            msg += `\n🕐 Heures de pointe : ${peaks.slice(0, 3).map((h: any) => typeof h === 'number' ? `${h}h` : `${h.hour}h`).join(', ')}\n`;
                        }
                        const comment = routes.length > { t('navigationScreen.3LeCoachIaConnaitBien') }
                                                                    : t('navigationScreen.mesPremiersTrajetsFrequentsSontIdentifies');
                msg += `\n💬 ${comment}\n\n🤖 Analyse par le Coach IA Yukpo\n`;
                msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                try {await Share.share({ message: msg, title: t('navigation.mesTrajetsYukpo') }); } catch { }
                                                            }}
                activeOpacity={0.7}
                                                        >
                <SafeIcon name="Redo2" size={12} color="#6366F1" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#6366F1' }}>{t('navigationScreen.partager')}</Text>
            </TouchableOpacity>
        </View>
                                                    {
        aiInsights.commute_insights.frequent_routes.map((r: any, i: number) => (
            <TouchableOpacity
                key={i}
                style={st.comRow}
                onPress={() => {
                    Alert.alert(
                        t('navigationScreen.trajetFrequent'),
                        t('navigationScreen.nFrequenceFoisnHeuresDePointe', { r_from: r.from, r_to: r.to, r_count: r.count })${ h }h` : `${ h.hour }h`).join(', ') || 'N/A'}`,
                        [
                            {
                                text: t('navigation.demarrerLaNavigation'), onPress: () => {
                                    setShowActivityStats(false);
                                    if (r.to) setDestination(r.to);
                                }
                            },
                            {
                                text: t('common.viewDetails'), onPress: () => {
                                    Alert.alert('Détails', `Distance moyenne: ${r.avg_distance_km || 'N/A'} km\nDurée moyenne: ${r.avg_duration_min || 'N/A'} min`);
                                }
                            },
                            { text: t('common.cancel'), style: 'cancel' }
                        ]
                    );
                }}
                activeOpacity={0.7}
            >
                <Text style={st.comFrom} numberOfLines={1}>{r.from}</Text>
                <Text style={st.comArrow}>→</Text>
                <Text style={st.comTo} numberOfLines={1}>{r.to}</Text>
                <Text style={st.comMeta}>{r.count}x</Text>
                <SafeIcon name="ChevronRight" size={16} color="#666" />
            </TouchableOpacity>
        ))
    }
    {
        aiInsights.commute_insights.peak_departure_hours?.length > 0 && (
            <View style={{ marginTop: 10 }}><Text style={st.peakTitle}>🕐 Heures de pointe</Text>
                <View style={st.peakRow}>{aiInsights.commute_insights.peak_departure_hours.slice(0, 4).map((h: any, i: number) => <View key={i} style={st.peakBdg}><Text style={st.peakHr}>{typeof h === 'number' ? `${h}h` : `${h.hour}h`}</Text></View>)}</View>
            </View>
        )
    }
                                                </NativeCard >
                                            )
}
                                        </>
                                    ) : (
    /* AI Features Preview — interactif */
    <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#7C3AED', paddingBottom: 6 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#7C3AED15', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🤖</Text>
            </View>
            <View style={st.flex1}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: modernColors.text }}>Coach IA</Text>
                <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>Commencez un trajet pour activer l'analyse</Text>
            </View>
        </View>
        {[
            { emoji: '🌍', title: 'Impact Environnemental', desc: 'CO2 économisé, arbres équivalents', color: '#10B981', action: () => Alert.alert('🌍 Impact Environnemental', t('navigation.effectuezVotrePremierTrajetPour'), [{ text: 'Commencer un trajet', onPress: () => { setShowActivityStats(false); } }, { text: 'OK' }]) },
            { emoji: '❤️', title: 'Condition Physique', desc: 'VO2max, calories, niveau fitness', color: '#EF4444', action: () => Alert.alert('❤️ Condition Physique', 'Le Coach IA estime votre VO2max à partir de :\n\n🏃 Vitesse de marche moyenne\n⏱ Durée des sessions\n📏 Distance parcourue\n\nPlus vous marchez, plus l\'estimation sera précise !', [{ text: 'Planifier une marche', onPress: () => { setShowActivityStats(false); } }, { text: 'OK' }]) },
            { emoji: '🎯', title: t('navigation.defisPersonnalises'), desc: 'Objectifs adaptés à votre niveau', color: '#3B82F6', action: () => Alert.alert('🎯 Défis Personnalisés', t('navigation.apresVosPremiersTrajetsLe'), [{ text: 'OK' }]) },
            { emoji: '🏅', title: 'Records & Badges', desc: 'Performances et récompenses', color: '#FFD700', action: () => Alert.alert('🏅 Records & Badges', t('navigation.leCoachIaSuitAutomatiquement'), [{ text: 'OK' }]) },
            { emoji: '🏠', title: 'Trajets Habituels', desc: 'Routes fréquentes, heures de pointe', color: '#6366F1', action: () => Alert.alert('🏠 Trajets Habituels', t('navigation.apresPlusieursTrajetsLeCoach'), [{ text: 'OK' }]) },
        ].map((feat, i) => (
            <TouchableOpacity
                key={i}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, marginBottom: 2, borderRadius: 10, backgroundColor: feat.color + '08' }}
                onPress={feat.action}
                activeOpacity={0.6}
            >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: feat.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>{feat.emoji}</Text>
                </View>
                <View style={st.flex1}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: modernColors.text }}>{feat.title}</Text>
                    <Text style={{ fontSize: 11, color: modernColors.textSecondary, marginTop: 1 }}>{feat.desc}</Text>
                </View>
                <SafeIcon name="ChevronRight" size={16} color={feat.color} />
            </TouchableOpacity>
        ))}
        <TouchableOpacity
            style={[st.aiActivateBtn, { marginTop: 12 }]}
            onPress={() => loadActivityStats(activityPeriod)}
            disabled={loadingActivity}
        >
            {loadingActivity ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    <SafeIcon name="Zap" size={16} color="#fff" />
                    <Text style={st.aiActivateBtnText}>{t('navigation.chargerMesDonnees')}</Text>
                </>
            )}
        </TouchableOpacity>
    </NativeCard>
)}
                                </>
                            ) : null}
                        </>
                    ) : (
    /* ━━━━━━ MODE: NAVIGATION (planification) ━━━━━━ */
    <>
        {/* Search */}
        <NativeCard style={st.searchCard}>
            <View style={st.originRow}>
                <View style={st.originDot} />
                <Text style={st.originText}>{t('navigation.maPositionActuelle')}</Text>
            </View>
            <View style={st.routeLine} />
            <View style={st.destRow}>
                <View style={st.destDot} />
                <View style={st.flex1}>
                    <LocationSelector
                        value={selectedLocation ? selectedLocation : (destination || '')}
                        onSelect={(loc: any) => {
                            setSelectedLocation(loc);
                            const t = loc.raw || loc.place_name || '';
                            setDestination(t);
                            if ((loc as any).latitude && (loc as any).longitude) {
                                setDestinationCoords({ lat: (loc as any).latitude, lng: (loc as any).longitude });
                                setTimeout(() => searchRoutesRef.current(), 200);
                            }
                            else {
                                geocodeDestination(t).then(c => {
                                    if (c) {
                                        setDestinationCoords(c);
                                        setTimeout(() => searchRoutesRef.current(), 200);
                                    }
                                });
                            }
                        }}
                        placeholder={t('navigation.ouAllezvous')}
                        scope="all"
                        style={dynamicStyles.locationSelectorDynamic}
                        onFocusChange={(focused: boolean) => setIsLocationSelectorFocused(focused)}
                    />
                </View>
            </View>
            <TouchableOpacity style={[st.searchBtn, loading && { opacity: 0.6 }]} onPress={searchRoutes} disabled={loading || (!destination.trim() && !selectedLocation)}>
                {loading ?
                    <><ActivityIndicator color="white" size="small" /><Text style={st.searchBtnTxt}> Recherche...</Text></>
                    :
                    <><Text style={{ fontSize: 16 }}>🔍</Text><Text style={st.searchBtnTxt}>{t('navigation.trouverMonItineraire')}</Text></>
                }
            </TouchableOpacity>
            {destinationCoords && (
                <View style={st.destActions}>
                    <TouchableOpacity style={st.actChip} onPress={() => Alert.alert(t('navigation.destinationSaved'), '', [{ text: '🏠 Domicile', onPress: () => saveDestination('domicile') }, { text: '💼 Bureau', onPress: () => saveDestination('bureau') }, { text: '⭐ Favori', onPress: () => saveDestination('autre', destination.substring(0, 30) || 'Favori') }, { text: t('message.cancel'), style: 'cancel' }])}>
                        <Text style={{ fontSize: 12 }}>🔖</Text>
                        <Text style={st.actChipTxt}>{t('navigationScreen.enregistrer')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.actChip} onPress={() => setShowPrefs(!showPrefs)}>
                        <Text style={{ fontSize: 12 }}>🎚️</Text>
                        <Text style={st.actChipTxt}>Options</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={st.actChip} onPress={async () => {
                        const p = await getCurrentPosition();
                        if (p) {
                            setWaypoints([...waypoints, { lat: p.lat, lng: p.lng, name: t('navigation.myPosition') }]);
                            Alert.alert(t('navigation.stepAdded'));
                        }
                    }}>
                        <Text style={{ fontSize: 12 }}>➕</Text>
                        <Text style={st.actChipTxt}>{t('navigation.etape')}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </NativeCard>

        {/* ━━ INDICATEUR TRACKING PASSIF ━━ */}
        {passiveTrackingActive && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 10, borderRadius: 10, backgroundColor: '#10B98112', borderWidth: 1, borderColor: '#10B98130' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                <Text style={{ flex: 1, fontSize: 12, color: '#059669', fontWeight: '600' }}>{t('navigation.suiviAutomatiqueActifVosDeplacements')}</Text>
                <TouchableOpacity onPress={async () => { await PassiveActivityTracker.stop(); setPassiveTrackingActive(false); showToast('OK'); }}>
                    <Text style={{ fontSize: 11, color: modernColors.textSecondary, textDecorationLine: 'underline' }}>{t('navigation.desactiver')}</Text>
                </TouchableOpacity>
            </View>
        )}
        {!passiveTrackingActive && (
            <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 10, borderRadius: 10, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' }}
                onPress={async () => { const ok = await PassiveActivityTracker.start(); setPassiveTrackingActive(ok); if (ok) showToast('✅ OK'); else Alert.alert(t('navigation.permissionRequired'), t('navigation.allowLocation')); }}
            >
                <Text style={{ fontSize: 14 }}>⚠️</Text>
                <Text style={{ flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600' }}>{t('navigation.suiviAutomatiqueInactifAppuyezPour')}</Text>
                <SafeIcon name="ChevronRight" size={14} color="#92400E" />
            </TouchableOpacity>
        )}

        {/* ━━ BOUTONS RAPIDES : Dashboard en direct + Stats ━━ */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }}
                onPress={startFreeWalking}
                activeOpacity={0.8}
            >
                <Text style={{ fontSize: 20 }}>📡</Text>
                <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Stats en direct</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>Voir ma marche live</Text>
                </View>
            </TouchableOpacity>
            <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#7C3AED', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }}
                onPress={() => { setShowActivityStats(true); loadActivityStats(activityPeriod); }}
                activeOpacity={0.8}
            >
                <Text style={{ fontSize: 20 }}>📊</Text>
                <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Stats & Coach IA</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{t('navigation.co2SanteDefis')}</Text>
                </View>
            </TouchableOpacity>
        </View>

        {/* Travel modes */}
        <View style={st.modeSelector}>
            {TRAVEL_MODES.map(m => (
                <TouchableOpacity key={m.key} style={[st.modeBtn, travelMode === m.key && { backgroundColor: m.color + '15', borderColor: m.color }]}
                    onPress={() => { setTravelMode(m.key); if (routes.length > 0) setTimeout(() => searchRoutesRef.current(), 100); }}>
                    <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                    <Text style={[st.modeBtnLbl, travelMode === m.key && { color: m.color, fontWeight: '700' as any }]} numberOfLines={1}>{m.label}</Text>
                </TouchableOpacity>
            ))}
        </View>

        {/* Favorites */}
        {savedDestinations.length > 0 && !destination && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                {savedDestinations.map(fav => (
                    <TouchableOpacity key={fav.id} style={st.favChip} onPress={() => {
                        setDestination(fav.address); setDestinationCoords({ lat: fav.latitude, lng: fav.longitude });
                        setTimeout(() => searchRoutesRef.current(), 200);
                    }}>
                        <Text style={{ fontSize: 14 }}>{fav.label === 'domicile' ? '🏠' : fav.label === 'bureau' ? '💼' : '⭐'}</Text>
                        <Text style={st.favLabel} numberOfLines={1}>{fav.custom_label || fav.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        )}

        {/* Route preferences */}
        {showPrefs && (
            <NativeCard style={st.prefsCard}>
                <Text style={st.secTitle}>{t('navigation.preferences')}</Text>
                <View style={st.prefsRow}>
                    {[{ k: 'tolls', l: 'Péages', v: avoidTolls, s: setAvoidTolls }, { k: 'highways', l: 'Autoroutes', v: avoidHighways, s: setAvoidHighways }, { k: 'ferries', l: 'Ferries', v: avoidFerries, s: setAvoidFerries }].map(p => (
                        <TouchableOpacity key={p.k} style={[st.prefChip, p.v && st.prefChipActive]} onPress={() => p.s(!p.v)}>
                            <Text style={[st.prefText, p.v && { color: '#EF4444' }]}>{t('navigationScreen.avoid')} {p.l.toLowerCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </NativeCard>
        )}

        {/* Waypoints */}
        {waypoints.length > 0 && (
            <NativeCard style={st.wpCard}>
                <View style={st.row8}><Text style={{ fontSize: 16 }}>📍</Text><Text style={st.wpTitle}>{t('navigationScreen.steps')} ({waypoints.length})</Text>
                    <TouchableOpacity onPress={() => { setWaypoints([]); if (routes.length > 0) setTimeout(() => searchRoutesRef.current(), 100); }}><SafeIcon name="Trash2" size={16} color="#EF4444" /></TouchableOpacity>
                </View>
                {waypoints.map((wp, i) => (
                    <View key={i} style={st.wpItem}>
                        <View style={st.wpIdx}><Text style={st.wpIdxTxt}>{i + 1}</Text></View>
                        <View style={st.flex1}><Text style={st.wpName} numberOfLines={1}>{wp.name}</Text><Text style={st.wpCoord}>{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</Text></View>
                        <TouchableOpacity onPress={() => removeWaypoint(i)}><SafeIcon name="X" size={16} color="#EF4444" /></TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity style={st.wpRecalc} onPress={() => searchRoutesRef.current()}><SafeIcon name="RefreshCw" size={14} color={modernColors.primary} /><Text style={st.wpRecalcTxt}>Recalculer</Text></TouchableOpacity>
            </NativeCard>
        )}

        {/* Routes */}
        {routes.length > 0 && (
            <View style={{ marginBottom: 12 }}>
                <View style={st.row8}><Text style={{ fontSize: 16 }}>🛣️</Text><Text style={st.secTitle}>{routes.length} itinéraire{routes.length > 1 ? 's' : ''} trouvé{routes.length > 1 ? 's' : ''}</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled pagingEnabled={false} decelerationRate="fast" snapToInterval={routeCardWidth} contentContainerStyle={{ gap: 10, paddingRight: 16, paddingTop: 8 }}
                    onScrollBeginDrag={() => setIsHorizontalScrolling(true)} onScrollEndDrag={() => setIsHorizontalScrolling(false)} onMomentumScrollEnd={() => setIsHorizontalScrolling(false)}>
                    {routes.map((route, idx) => {
                        const sel = selectedRoute?.id === route.id;
                        const dur = route.duration_in_traffic_seconds || route.duration_seconds;
                        return (
                            <TouchableOpacity key={route.id || idx} style={[st.routeCard, sel && st.routeCardSel, { width: routeCardWidth - 10 }]}
                                onPress={() => { setSelectedRoute(route); loadPointsOfInterestSafely(route); }} activeOpacity={0.8}>
                                <View style={st.routeCardTop}>
                                    <View style={st.row8}>
                                        <View style={[st.trafficDot, { backgroundColor: getTrafficColor(route.traffic_level) }]} />
                                        <Text style={[st.trafficLbl, { color: getTrafficColor(route.traffic_level) }]}>{getTrafficLabel(route.traffic_level)}</Text>
                                    </View>
                                    {idx === 0 && <View style={st.recBadge}><Text style={st.recText}>{t('navigation.recommande')}</Text></View>}
                                </View>
                                <Text style={st.routeSummary} numberOfLines={1}>{route.summary}</Text>
                                <View style={st.routeMetrics}>
                                    <Text style={st.routeMetric}>📏 {formatDistance(route.distance_meters)}</Text>
                                    <Text style={st.routeMetric}>⏱ {formatDuration(dur)}</Text>
                                    {route.arrival_time && <Text style={st.routeMetric}>🏁 {route.arrival_time}</Text>}
                                </View>
                                {route.fare && <View style={st.fareBadge}><Text style={st.fareText}>{route.fare.text}</Text></View>}
                                {route.warnings?.slice(0, 1).map((w, wi) => <Text key={wi} style={st.warnText} numberOfLines={1}>⚠️ {w}</Text>)}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        )}

        {/* Map */}
        {(selectedRoute || destinationCoords) && showMap && mapRegion && (
            <View style={st.mapWrap}>
                <AnyMapView ref={mapRef} style={st.mapView} provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined} initialRegion={mapRegion} showsUserLocation showsTraffic showsCompass loadingEnabled loadingIndicatorColor={modernColors.primary} onMapReady={() => console.log('[NavigationScreen] ✅ Map ready (navigation)')} onError={(e: any) => console.error('[NavigationScreen] ❌ Map error (navigation):', e.nativeEvent || e)}>
                    {routePolylineCoords.length > 1 && <Polyline coordinates={routePolylineCoords} strokeColor={modernColors.primary} strokeWidth={4} />}
                    {destinationCoords && <Marker coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }} title={destination || 'Destination'} pinColor="#EF4444" tracksViewChanges={false} />}
                    {livePosition && <Marker coordinate={{ latitude: livePosition.lat, longitude: livePosition.lng }} title={t('navigation.maPosition')} pinColor="#3B82F6" />}
                    {checkpoints.slice(0, 10).map(cp => <Marker key={cp.id} coordinate={{ latitude: cp.latitude, longitude: cp.longitude }} title={`${CHECKPOINT_LABELS[cp.checkpoint_type]?.icon || '⚠️'} ${CHECKPOINT_LABELS[cp.checkpoint_type]?.label || cp.checkpoint_type}`} pinColor={CHECKPOINT_LABELS[cp.checkpoint_type]?.color} tracksViewChanges={false} />)}
                    {pointsOfInterest.slice(0, 5).map(poi => <Marker key={poi.id} coordinate={{ latitude: getPoiLat(poi), longitude: getPoiLng(poi) }} title={typeof poi.name === 'string' ? poi.name : t('navigationScreen.nomInconnu')} description={poi.address} pinColor="#10B981" tracksViewChanges={false} />)}
                </AnyMapView>
                <TouchableOpacity style={st.mapBtnLabeled} onPress={() => { if (mapRef.current && routePolylineCoords.length > 1) mapRef.current.fitToCoordinates(routePolylineCoords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }); }}>
                    <SafeIcon name="Maximize2" size={14} color={modernColors.primary} />
                    <Text style={st.mapBtnLabelTxt}>Recentrer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.mapBtnLabeled, { top: 46 }]} onPress={() => setShowMap(false)}>
                    <SafeIcon name="EyeOff" size={14} color={modernColors.textSecondary} />
                    <Text style={[st.mapBtnLabelTxt, { color: modernColors.textSecondary }]}>{t('navigationScreen.masquer')}</Text>
                </TouchableOpacity>
            </View>
        )}
        {(selectedRoute || destinationCoords) && !showMap && (
            <TouchableOpacity style={st.showMapBtn} onPress={() => setShowMap(true)}><Text style={{ fontSize: 14 }}>🗺️</Text><Text style={st.showMapText}>{t('navigation.afficherLaCarte')}/Text></TouchableOpacity>
        )}

        {/* Traffic alerts */}
        {selectedRoute?.warnings && selectedRoute.warnings.length > 0 && (
            <NativeCard style={[st.secCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1 }]}>
                <Text style={st.secTitle}>⚠️ Alertes trafic</Text>
                {selectedRoute.warnings.map((w, i) => <Text key={i} style={st.alertText}>• {w}</Text>)}
            </NativeCard>
        )}

        {/* Checkpoints */}
        {selectedRoute && checkpoints.length > 0 && (
            <NativeCard style={st.secCard}>
                <Text style={st.secTitle}>🚨 Signalements sur le trajet</Text>
                {checkpoints.slice(0, 5).map(cp => {
                    const info = CHECKPOINT_LABELS[cp.checkpoint_type] || { label: cp.checkpoint_type, icon: '⚠️', color: '#6B7280' };
                    return (
                        <View key={cp.id} style={st.cpItem}>
                            <Text style={{ fontSize: 18 }}>{info.icon}</Text>
                            <View style={st.flex1}><Text style={st.cpItemLabel}>{info.label}</Text>{cp.description && <Text style={st.cpItemDesc}>{cp.description}</Text>}</View>
                            {cp.speed_limit && <Text style={st.cpItemSpd}>{cp.speed_limit} km/h</Text>}
                            <TouchableOpacity onPress={() => shareAlert({ checkpoint_type: cp.checkpoint_type, lat: cp.latitude, lng: cp.longitude, speed_limit: cp.speed_limit })} style={st.cpShareBtn}>
                                <SafeIcon name="Redo2" size={12} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </NativeCard>
        )}

        {/* POIs */}
        {selectedRoute && (
            <View style={{ marginBottom: 12 }}>
                <Text style={st.secTitle}>{t('navigation.pointsDinteretAProximite')}</Text>
                {loadingPOI ? (
                    <NativeCard style={st.loadCard}><ActivityIndicator color={modernColors.primary} /><Text style={st.loadText}>{t('navigation.rechercheDesPoi')}</Text></NativeCard>
                ) : pointsOfInterest.length === 0 ? (
                    <NativeCard style={st.emptyCard}><Text style={st.emptyText}>{t('navigation.aucunPoiTrouve')}</Text></NativeCard>
                ) : (
                    Object.entries(POI_CATEGORIES).map(([catKey, cat]) => {
                        const pois = groupedPOIs[catKey] || [];
                        if (pois.length === 0) return null;
                        const expanded = expandedCategories[catKey];
                        const showAll = poiShowAll[catKey] || false;
                        const visiblePois = showAll ? pois : pois.slice(0, 5);
                        return (
                            <NativeCard key={catKey} style={[st.poiCatCard, { borderLeftWidth: 3, borderLeftColor: cat.color }]}>
                                <TouchableOpacity style={st.poiCatHdr} onPress={() => toggleCategory(catKey)} activeOpacity={0.7}>
                                    <View style={[st.poiCatIcon, { backgroundColor: cat.color + '15' }]}><Text style={{ fontSize: 20 }}>{cat.icon}</Text></View>
                                    <View style={st.flex1}>
                                        <Text style={st.poiCatLabel}>{cat.label}</Text>
                                        <Text style={st.poiCatCount}>{pois.length} lieu{pois.length > 1 ? 'x' : ''} trouvé{pois.length > 1 ? 's' : ''} sur le trajet</Text>
                                    </View>
                                    <View style={[st.poiExpandBadge, { backgroundColor: expanded ? cat.color + '20' : modernColors.surfaceVariant }]}>
                                        <SafeIcon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={16} color={expanded ? cat.color : modernColors.textSecondary} />
                                    </View>
                                </TouchableOpacity>
                                {expanded && visiblePois.map((poi, idx) => {
                                    const displayName = typeof poi.name === 'string' ? poi.name : (typeof poi.name === 'object' && poi.name !== null ? (poi.name as any).name || (poi.name as any).text || JSON.stringify(poi.name) : 'Nom inconnu');
                                    return (
                                        <View key={poi.id || `poi-${catKey}-${idx}`} style={st.poiItem}>
                                            <View style={st.flex1}>
                                                <Text style={st.poiName}>{displayName}</Text>
                                                {poi.address && <Text style={st.poiAddr} numberOfLines={1}>{poi.address}</Text>}
                                                <View style={st.poiMeta}>
                                                    <Text style={st.poiDist}>{formatDistance(poi.distance_from_route_meters)}</Text>
                                                    {poi.rating != null && poi.rating > 0 && <Text style={st.poiRating}>⭐ {poi.rating}{poi.total_ratings ? ` (${poi.total_ratings})` : ''}</Text>}
                                                    {poi.price_level != null && poi.price_level > 0 && <Text style={st.poiPrice}>{'💰'.repeat(poi.price_level)}</Text>}
                                                    {poi.is_open != null && <View style={[st.openBadge, { backgroundColor: poi.is_open ? '#DCFCE7' : '#FEE2E2' }]}><Text style={[st.openText, { color: poi.is_open ? '#16A34A' : '#EF4444' }]}>{poi.is_open ? 'Ouvert' : t('navigationScreen.ferme')}</Text></View>}
                                                </View>
                                            </View>
                                            <View style={{ gap: 6 }}>
                                                <TouchableOpacity style={st.poiNavBtn} onPress={() => navigateToPOI(poi)}><SafeIcon name="Navigation" size={14} color="#10B981" /></TouchableOpacity>
                                                <TouchableOpacity style={st.poiAddBtn} onPress={() => addWaypoint(poi)}><SafeIcon name="Plus" size={14} color={modernColors.primary} /></TouchableOpacity>
                                                <TouchableOpacity style={st.poiShareBtn} onPress={() => sharePOI(poi)}><SafeIcon name="Redo2" size={12} color={modernColors.textSecondary} /></TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                                {expanded && !showAll && pois.length > 5 && (
                                    <TouchableOpacity style={st.poiShowMoreBtn} onPress={() => setPoiShowAll(prev => ({ ...prev, [catKey]: true }))} activeOpacity={0.7}>
                                        <Text style={[st.poiShowMoreTxt, { color: cat.color }]}>Voir les {pois.length - 5} autres lieux</Text>
                                        <SafeIcon name="ChevronDown" size={14} color={cat.color} />
                                    </TouchableOpacity>
                                )}
                                {expanded && showAll && pois.length > 5 && (
                                    <TouchableOpacity style={st.poiShowMoreBtn} onPress={() => setPoiShowAll(prev => ({ ...prev, [catKey]: false }))} activeOpacity={0.7}>
                                        <Text style={[st.poiShowMoreTxt, { color: cat.color }]}>{t('navigation.reduire')}</Text>
                                        <SafeIcon name="ChevronUp" size={14} color={cat.color} />
                                    </TouchableOpacity>
                                )}
                            </NativeCard>
                        );
                    })
                )}
            </View>
        )}

        {/* Go buttons */}
        {selectedRoute && (
            <View style={st.goSection}>
                <TouchableOpacity style={st.shareRouteBtn} onPress={shareRoute} activeOpacity={0.7}>
                    <SafeIcon name="Redo2" size={16} color={modernColors.primary} /><Text style={st.shareRouteTxt}>{t('navigation.partagerLitineraire')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.goBtn} onPress={startTracking} activeOpacity={0.8}>
                    <Text style={{ fontSize: 20 }}>📡</Text>
                    <View><Text style={st.goBtnText}>{t('navigation.suiviEnTempsReel')}</Text><Text style={st.goBtnSub}>Vitesse, radars, progression</Text></View>
                </TouchableOpacity>
                <TouchableOpacity style={st.extBtn} onPress={() => startNavigation(selectedRoute)} activeOpacity={0.8}>
                    <Text style={{ fontSize: 16 }}>🗺️</Text>
                    <Text style={st.extBtnText}>Ouvrir dans Google Maps</Text>
                    <Text style={st.extBtnEta}>{selectedRoute.arrival_time || formatDuration(selectedRoute.duration_in_traffic_seconds || selectedRoute.duration_seconds)}</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* ━━ APERÇU SANTÉ & COACH IA ━━ */}
        {user && !isTracking && aiInsights && (
            <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#7C3AED' }]}>
                <TouchableOpacity style={st.healthPreviewRow} onPress={() => { setShowActivityStats(true); loadActivityStats(activityPeriod); }} activeOpacity={0.7}>
                    <View style={st.healthPreviewIcon}><Text style={{ fontSize: 24 }}>🫀</Text></View>
                    <View style={st.flex1}>
                        <Text style={st.healthPreviewTitle}>{t('navigation.scoreSanteCoachIa')}</Text>
                        <View style={st.healthPreviewStats}>
                            {aiInsights.health_score && <Text style={[st.healthPreviewStat, { color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>❤️ {aiInsights.health_score.score}/100</Text>}
                            {aiInsights.gamification && <Text style={st.healthPreviewStat}>🔥 {aiInsights.gamification.current_streak}j</Text>}
                            {aiInsights.co2_impact && <Text style={st.healthPreviewStat}>🌿 {((aiInsights.co2_impact.saved_grams || 0) / 1000).toFixed(1)} kg</Text>}
                        </View>
                    </View>
                    <SafeIcon name="ChevronRight" size={20} color="#7C3AED" />
                </TouchableOpacity>
            </NativeCard>
        )}
        {user && !isTracking && !aiInsights && (
            <TouchableOpacity style={st.healthPreviewEmpty} onPress={() => { setShowActivityStats(true); loadActivityStats(activityPeriod); }} activeOpacity={0.7}>
                <Text style={{ fontSize: 20 }}>📊</Text>
                <View style={st.flex1}>
                    <Text style={st.healthPreviewTitle}>{t('navigation.statistiquesCoachIa')}</Text>
                        <Text style={st.healthPreviewSub}>{t('navigation.vo2maxDefisCo2BadgesConseils')}</Text>
                </View>
                <SafeIcon name="ChevronRight" size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>
        )}
    </>
)}
                </ScrollView >
{
    alertToast.visible && (
        <Animated.View style={[st.alertToastWrap, { opacity: alertToastAnim, transform: [{ translateY: alertToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }]}>
            <View style={[st.alertToastInner, { borderLeftColor: alertToast.color }]}>
                <Text style={{ fontSize: 22 }}>{alertToast.icon}</Text>
                <Text style={st.alertToastMsg}>{alertToast.message}</Text>
                <Text style={{ fontSize: 14 }}>✅</Text>
            </View>
        </Animated.View>
    )
}
            </KeyboardAvoidingView >
        </SafeNativeView >
    );
};

// ══════════════════════════════════════════════════════════════════════════
// ── STYLES ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: modernColors.background },
    flex1: { flex: 1 },
    row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, marginBottom: 4 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center', justifyContent: 'center' },
    headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: modernColors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: modernColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: modernColors.text },
    headerSub: { fontSize: 13, color: modernColors.textSecondary, marginTop: 1 },
    headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    headerBtnActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    headerBtnAlertActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    alertBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
    alertBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF', lineHeight: 10 },

    // Barre d'alertes compacte (toggle + chips labellés)
    alertToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 4, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border },
    alertToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: modernColors.textSecondary },
    alertCountBadge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
    alertCountText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
    alertChipScroll: { marginBottom: 12, maxHeight: 44 },
    alertChipContent: { flexDirection: 'row', gap: 8, paddingHorizontal: 2, paddingVertical: 4 },
    alertChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    alertChipIcon: { fontSize: 14 },
    alertChipLabel: { fontSize: 12, fontWeight: '700' },

    // Search
    searchCard: { marginBottom: 12, padding: 16, zIndex: 100, elevation: 100, overflow: 'visible' as any },
    originRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    originDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#DCFCE7' },
    originText: { fontSize: 14, color: modernColors.textSecondary, fontWeight: '500' },
    routeLine: { width: 2, height: 20, backgroundColor: modernColors.border, marginLeft: 5, marginVertical: 2 },
    destRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, zIndex: 100, overflow: 'visible' as any },
    destDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FEE2E2', marginTop: 12 },
    searchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, backgroundColor: modernColors.primary, borderRadius: 12 },
    searchBtnTxt: { fontSize: 15, fontWeight: '700', color: 'white' },
    destActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    actChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: modernColors.surfaceVariant, borderWidth: 1, borderColor: modernColors.border },
    actChipTxt: { fontSize: 12, fontWeight: '600', color: modernColors.textSecondary },

    // Travel modes
    modeSelector: { flexDirection: 'row', gap: 8, marginBottom: 12, zIndex: 1 },
    modeBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, overflow: 'hidden' },
    modeBtnLbl: { fontSize: 11, fontWeight: '600', color: modernColors.textSecondary, textAlign: 'center' },

    // Favorites
    favChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border },
    favLabel: { fontSize: 13, fontWeight: '600', color: modernColors.text, maxWidth: 100 },

    // Preferences
    prefsCard: { marginBottom: 12, padding: 14 },
    prefsRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
    prefChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: modernColors.surfaceVariant, borderWidth: 1, borderColor: modernColors.border },
    prefChipActive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
    prefText: { fontSize: 12, fontWeight: '600', color: modernColors.textSecondary },

    // Waypoints
    wpCard: { marginBottom: 12, padding: 14 },
    wpTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: modernColors.text },
    wpItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    wpIdx: { width: 24, height: 24, borderRadius: 12, backgroundColor: modernColors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    wpIdxTxt: { fontSize: 12, fontWeight: '700', color: 'white' },
    wpName: { fontSize: 14, fontWeight: '600', color: modernColors.text },
    wpCoord: { fontSize: 11, color: modernColors.textSecondary, marginTop: 2 },
    wpRecalc: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8 },
    wpRecalcTxt: { fontSize: 13, fontWeight: '600', color: modernColors.primary },

    // Routes
    routeCard: { padding: 14, borderRadius: 14, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border },
    routeCardSel: { borderColor: modernColors.primary, backgroundColor: modernColors.primary + '08' },
    routeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    trafficDot: { width: 8, height: 8, borderRadius: 4 },
    trafficLbl: { fontSize: 11, fontWeight: '700' },
    recBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    recText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
    routeSummary: { fontSize: 13, fontWeight: '600', color: modernColors.text, marginBottom: 8 },
    routeMetrics: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    routeMetric: { fontSize: 13, color: modernColors.textSecondary, fontWeight: '500' },
    fareBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: 'flex-start' },
    fareText: { fontSize: 12, fontWeight: '700', color: modernColors.primary },
    warnText: { fontSize: 11, color: '#D97706', marginTop: 4 },

    // Map
    mapWrap: { marginBottom: 12, borderRadius: 16, overflow: 'hidden', height: MAP_HEIGHT },
    mapView: { width: '100%', height: '100%' },
    mapBtn: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
    mapBtnLabeled: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
    mapBtnLabelTxt: { fontSize: 11, fontWeight: '600', color: modernColors.primary },
    showMapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, marginBottom: 12, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1, borderColor: modernColors.border },
    showMapText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },

    // Section
    secCard: { marginBottom: 12, padding: 14 },
    secTitle: { fontSize: 15, fontWeight: '700', color: modernColors.text, marginBottom: 10 },
    alertText: { fontSize: 13, color: '#92400E', marginBottom: 4, lineHeight: 18 },

    // AI Features Preview
    aiFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
    aiFeatureTitle: { fontSize: 14, fontWeight: '600', color: modernColors.text, marginBottom: 2 },
    aiFeatureDesc: { fontSize: 12, color: modernColors.textSecondary, lineHeight: 16, flex: 1 },
    aiActivateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#7C3AED', borderRadius: 12 },
    aiActivateBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

    // Alert Toast
    alertToastWrap: { position: 'absolute', top: 60, left: 16, right: 16, zIndex: 9999 },
    alertToastInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
    alertToastMsg: { flex: 1, fontSize: 14, fontWeight: '700', color: modernColors.text },

    // Alert History
    alertHistHdr: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    alertHistTitle: { fontSize: 15, fontWeight: '700', color: modernColors.text },
    alertHistSub: { fontSize: 12, color: modernColors.textSecondary, marginTop: 1 },
    alertHistItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingLeft: 10, marginTop: 6, borderLeftWidth: 3, borderRadius: 8, backgroundColor: modernColors.surfaceVariant },
    alertHistItemTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    alertHistLabel: { fontSize: 14, fontWeight: '700' },
    alertHistCountBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
    alertHistCountTxt: { fontSize: 11, fontWeight: '800' },
    alertHistLoc: { fontSize: 12, color: modernColors.text, marginTop: 3 },
    alertHistMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' },
    alertHistDist: { fontSize: 11, fontWeight: '600', color: modernColors.primary },
    alertHistTime: { fontSize: 11, color: modernColors.textSecondary },
    alertHistSpd: { fontSize: 11, fontWeight: '600', color: '#EF4444' },

    // Health Preview
    healthPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    healthPreviewIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#7C3AED15', alignItems: 'center', justifyContent: 'center' },
    healthPreviewTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text },
    healthPreviewStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
    healthPreviewStat: { fontSize: 12, fontWeight: '600', color: modernColors.textSecondary },
    healthPreviewSub: { fontSize: 12, color: modernColors.textSecondary, marginTop: 2 },
    healthPreviewEmpty: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12, borderRadius: 14, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border },

    // Checkpoints
    cpItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: modernColors.border },
    cpItemLabel: { fontSize: 13, fontWeight: '600', color: modernColors.text },
    cpItemDesc: { fontSize: 11, color: modernColors.textSecondary },
    cpItemSpd: { fontSize: 13, fontWeight: '700', color: '#EF4444', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    cpShareBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: modernColors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

    // POI
    poiCatCard: { marginBottom: 8, padding: 0, overflow: 'hidden' },
    poiCatHdr: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    poiCatIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    poiCatLabel: { fontSize: 15, fontWeight: '700', color: modernColors.text },
    poiCatCount: { fontSize: 12, color: modernColors.textSecondary, marginTop: 2 },
    poiExpandBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    poiShowMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: modernColors.border },
    poiShowMoreTxt: { fontSize: 13, fontWeight: '600' },
    poiItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: modernColors.border },
    poiName: { fontSize: 14, fontWeight: '600', color: modernColors.text },
    poiAddr: { fontSize: 11, color: modernColors.textSecondary, marginTop: 2 },
    poiMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
    poiDist: { fontSize: 12, color: modernColors.textSecondary },
    poiRating: { fontSize: 12, color: modernColors.text, fontWeight: '600' },
    poiPrice: { fontSize: 12 },
    openBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    openText: { fontSize: 10, fontWeight: '600' },
    poiNavBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
    poiAddBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    poiShareBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: modernColors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },

    // Go buttons
    shareRouteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: modernColors.border, backgroundColor: modernColors.surface },
    shareRouteTxt: { fontSize: 14, fontWeight: '600', color: modernColors.primary },
    goSection: { marginTop: 8, marginBottom: 16, gap: 10 },
    goBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, backgroundColor: '#10B981', borderRadius: 14, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    goBtnText: { fontSize: 17, fontWeight: '800', color: 'white' },
    goBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    extBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: modernColors.primary, backgroundColor: modernColors.surface },
    extBtnText: { fontSize: 14, fontWeight: '600', color: modernColors.primary },
    extBtnEta: { fontSize: 12, color: modernColors.textSecondary },

    // Tracking
    trackingCard: { padding: 16, marginBottom: 12 },
    trackRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    speedGauge: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: modernColors.primary, alignItems: 'center', justifyContent: 'center' },
    speedVal: { fontSize: 28, fontWeight: '900', color: modernColors.text },
    speedUnit: { fontSize: 10, color: modernColors.textSecondary, marginTop: -2 },
    trackMetrics: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    trackMetric: { alignItems: 'center', gap: 2 },
    mVal: { fontSize: 16, fontWeight: '800', color: modernColors.text },
    mLbl: { fontSize: 10, color: modernColors.textSecondary },
    nextStep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: modernColors.border },
    nextText: { fontSize: 14, fontWeight: '600', color: modernColors.text, lineHeight: 20 },
    nextDist: { fontSize: 12, color: modernColors.primary, fontWeight: '600', marginTop: 2 },
    progressBg: { height: 6, backgroundColor: modernColors.border, borderRadius: 3, marginTop: 14, overflow: 'hidden' },
    progressFill: { height: 6, backgroundColor: '#10B981', borderRadius: 3 },

    // Alerts
    riskBanner: { backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 4 },
    riskTitle: { fontSize: 15, fontWeight: '800' },
    riskTip: { fontSize: 13, color: modernColors.textSecondary, marginTop: 8, lineHeight: 18 },
    riskAlertRow: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginTop: 4 },
    riskAlertMsg: { fontSize: 12, color: modernColors.text, lineHeight: 17 },
    cpAlert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 10 },
    cpTitle: { fontSize: 16, fontWeight: '800' },
    cpSpeed: { fontSize: 13, color: modernColors.textSecondary, marginTop: 2 },
    deviationAlert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#FEE2E2', marginBottom: 10 },
    deviationText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#DC2626' },

    // Report
    reportCard: { marginBottom: 12, padding: 14 },
    reportTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: modernColors.text },
    reportHelp: { fontSize: 12, color: modernColors.textSecondary, marginBottom: 8, lineHeight: 18 },
    reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
    reportBtnTxt: { fontSize: 12, fontWeight: '600', color: modernColors.text },
    stopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#EF4444', backgroundColor: '#FEF2F2', marginBottom: 16 },
    stopText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

    // Stats
    periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center' },
    periodBtnActive: { backgroundColor: modernColors.primary + '15', borderColor: modernColors.primary },
    periodText: { fontSize: 13, fontWeight: '600', color: modernColors.textSecondary },
    periodTextActive: { color: modernColors.primary, fontWeight: '700' },
    summCard: { marginBottom: 8, padding: 16 },
    shareStatsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, backgroundColor: '#7C3AED', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    shareStatsTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
    shareStatsSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    statItem: { alignItems: 'center', gap: 2 },
    statVal: { fontSize: 20, fontWeight: '900', color: modernColors.text },
    statLbl: { fontSize: 11, color: modernColors.textSecondary },
    statDiv: { width: 1, height: 40, backgroundColor: modernColors.border },
    bestRow: { flexDirection: 'row', justifyContent: 'space-around' },
    bestStat: { fontSize: 14, fontWeight: '700', color: '#78350F' },
    modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: modernColors.border },
    modeNm: { flex: 1, fontSize: 14, fontWeight: '600', color: modernColors.text },
    modeBdg: { fontSize: 13, fontWeight: '700', color: modernColors.primary, backgroundColor: modernColors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    modeDst: { fontSize: 13, color: modernColors.textSecondary, width: 60, textAlign: 'right' },
    histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: modernColors.border },
    histDest: { fontSize: 13, fontWeight: '600', color: modernColors.text },
    histMeta: { fontSize: 11, color: modernColors.textSecondary, marginTop: 2 },
    histScore: { fontSize: 18, fontWeight: '900' },

    // Loading & Empty
    loadCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
    loadText: { fontSize: 14, color: modernColors.textSecondary },
    emptyCard: { alignItems: 'center', padding: 24, gap: 8, marginBottom: 12 },
    emptyText: { fontSize: 14, color: modernColors.textSecondary, fontWeight: '600' },
    emptySubText: { fontSize: 12, color: modernColors.textSecondary, textAlign: 'center' },

    // Coach
    coachHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
    coachTitle: { fontSize: 18, fontWeight: '800', color: modernColors.text },
    shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: modernColors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    shareTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
    scoreCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
    scoreVal: { fontSize: 28, fontWeight: '900' },
    scoreMax: { fontSize: 12, color: modernColors.textSecondary, marginTop: -4 },
    scoreLbl: { fontSize: 16, fontWeight: '800', marginTop: 4 },
    brkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brkBarBg: { flex: 1, height: 6, backgroundColor: modernColors.border, borderRadius: 3, overflow: 'hidden' },
    brkBarFill: { height: 6, borderRadius: 3 },
    brkPts: { fontSize: 11, fontWeight: '700', color: modernColors.textSecondary, width: 36, textAlign: 'right' },
    tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 10, marginBottom: 10, backgroundColor: modernColors.surfaceVariant, borderRadius: 8 },
    tipTitle: { fontSize: 14, fontWeight: '700', color: modernColors.text },
    tipMsg: { fontSize: 12, color: modernColors.textSecondary, lineHeight: 18, marginTop: 2 },
    streakRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 },
    streakItem: { alignItems: 'center', gap: 2 },
    streakVal: { fontSize: 22, fontWeight: '900', color: modernColors.text },
    streakLbl: { fontSize: 11, color: modernColors.textSecondary },
    badgesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    badge: { alignItems: 'center', backgroundColor: modernColors.surfaceVariant, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: modernColors.border },
    badgeLbl: { fontSize: 10, fontWeight: '600', color: modernColors.textSecondary, marginTop: 2, maxWidth: 80, textAlign: 'center' },
    co2Grid: { flexDirection: 'row', justifyContent: 'space-around' },
    co2Item: { alignItems: 'center', gap: 2 },
    co2Val: { fontSize: 18, fontWeight: '900', color: modernColors.text },
    co2Lbl: { fontSize: 11, color: modernColors.textSecondary },
    vo2Val: { fontSize: 36, fontWeight: '900', color: '#EF4444' },
    vo2Unit: { fontSize: 12, color: modernColors.textSecondary, marginTop: -2 },
    fitLevel: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12, marginTop: 6 },
    fitLevelTxt: { fontSize: 14, fontWeight: '800' },
    chLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: modernColors.text },
    chBarBg: { height: 10, backgroundColor: modernColors.border, borderRadius: 5, overflow: 'hidden', marginTop: 4 },
    chBarFill: { height: 10, borderRadius: 5 },
    chProg: { fontSize: 11, color: modernColors.textSecondary, marginTop: 2, textAlign: 'right' },
    recRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    recTitle: { fontSize: 12, fontWeight: '600', color: modernColors.textSecondary },
    recVal: { fontSize: 15, fontWeight: '800', color: modernColors.text },
    comRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: modernColors.border, flexWrap: 'wrap' },
    comFrom: { fontSize: 12, fontWeight: '600', color: modernColors.text, maxWidth: '30%' as any },
    comArrow: { fontSize: 14, color: modernColors.primary, fontWeight: '700' },
    comTo: { fontSize: 12, fontWeight: '600', color: modernColors.text, flex: 1, maxWidth: '30%' as any },
    comMeta: { fontSize: 11, color: modernColors.textSecondary, fontWeight: '700' },
    peakTitle: { fontSize: 13, fontWeight: '700', color: modernColors.text, marginBottom: 8 },
    peakRow: { flexDirection: 'row', gap: 10 },
    peakBdg: { alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
    peakHr: { fontSize: 15, fontWeight: '800', color: '#6366F1' },

    // Vote buttons (alert history)
    voteRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0' },
    voteBtnDown: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
    voteBtnTxt: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

    // LocationSelector override
    locationSelector: { marginTop: 4 },
});

export default NavigationScreen;
