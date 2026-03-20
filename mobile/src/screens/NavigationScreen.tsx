import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Animated, BackHandler,
    Dimensions, Keyboard, KeyboardAvoidingView, Linking,
    Platform, ScrollView, Share, StyleSheet, Text, ToastAndroid,
    TouchableOpacity, View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import CheckpointCommentsSection from '../components/CheckpointCommentsSection';
import IntelligentChat from '../components/IntelligentChat';
import IntelligentChatFab from '../components/IntelligentChatFab';
import InternalShareButton from '../components/InternalShareButton';
import LocationSelector, { LocationObject } from '../components/LocationSelector';
import { NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { useLocationSafe } from '../contexts/LocationContext';
import { useNavigationPayment } from '../hooks/useNavigationPayment';
import { apiGet, apiPost } from '../services/api';
import { FreeWalkSessionService } from '../services/FreeWalkSessionService';
import { PassiveActivityTracker } from '../services/PassiveActivityTracker';
import { coachingNotificationService } from '../services/coachingNotificationService';
import { socialSharing } from '../services/socialSharing';
import { communityAlertSoundService } from '../services/communityAlertSoundService';
import { modernColors } from '../theme/modernTheme';
import SafeStorage from '../utils/safeStorage';

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
type I18nLabel = { labelKey: string; fallback: string };
const POI_CATEGORIES: Record<string, { label: I18nLabel; icon: string; color: string; types: string[] }> = {
    health: { label: { labelKey: 'navigation.poiCategoryHealth', fallback: 'Santé' }, icon: '🏥', color: '#EF4444', types: ['pharmacy', 'hospital'] },
    food: { label: { labelKey: 'navigation.poiCategoryFood', fallback: 'Alimentation' }, icon: '🍞', color: '#F59E0B', types: ['bakery', 'supermarket', 'restaurant'] },
    fuel: { label: { labelKey: 'navigation.poiCategoryFuel', fallback: 'Carburant' }, icon: '⛽', color: '#3B82F6', types: ['gas_station'] },
    finance: { label: { labelKey: 'navigation.poiCategoryFinance', fallback: 'Banque & DAB' }, icon: '🏧', color: '#6366F1', types: ['atm'] },
    auto: { label: { labelKey: 'navigation.poiCategoryAuto', fallback: 'Auto & Parking' }, icon: '🚗', color: '#0EA5E9', types: ['parking', 'car_wash', 'car_repair'] },
    religion: { label: { labelKey: 'navigation.poiCategoryReligion', fallback: 'Lieux de culte' }, icon: '🕌', color: '#A855F7', types: ['mosque', 'church'] },
    accommodation: { label: { labelKey: 'navigation.poiCategoryAccommodation', fallback: 'Hébergement' }, icon: '🏨', color: '#EC4899', types: ['hotel'] },
    security: { label: { labelKey: 'navigation.poiCategorySecurity', fallback: 'Sécurité' }, icon: '🚔', color: '#14B8A6', types: ['police'] },
};
const POI_TYPE_ALIASES: Record<string, string> = {
    // Fuel
    gasstation: 'gas_station',
    petrolstation: 'gas_station',
    stationservice: 'gas_station',
    fuel: 'gas_station',
    // Finance
    bank: 'atm',
    banque: 'atm',
    cashmachine: 'atm',
    // Food
    grocery: 'supermarket',
    groceries: 'supermarket',
    market: 'supermarket',
    // Auto
    repair: 'car_repair',
    garage: 'car_repair',
    carrepairshop: 'car_repair',
    carwash: 'car_wash',
    parkinglot: 'parking',
    // Religion
    placeofworship: 'church',
    // Accommodation / security / health
    lodging: 'hotel',
    policestation: 'police',
    clinic: 'hospital',
};
const normalizePoiType = (rawType?: string | null): string => {
    const normalizedKey = String(rawType || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    if (!normalizedKey) return '';
    const compact = normalizedKey.replace(/_/g, '');
    return POI_TYPE_ALIASES[normalizedKey] || POI_TYPE_ALIASES[compact] || normalizedKey;
};
const TRAVEL_MODES = [
    { key: 'driving', label: { labelKey: 'navigation.travelModeDriving', fallback: 'Voiture' }, emoji: '🚗', color: '#3B82F6' },
    { key: 'walking', label: { labelKey: 'navigation.travelModeWalking', fallback: 'À pied' }, emoji: '🚶', color: '#10B981' },
    { key: 'transit', label: { labelKey: 'navigation.travelModeTransit', fallback: 'Transport' }, emoji: '🚌', color: '#8B5CF6' },
    { key: 'bicycling', label: { labelKey: 'navigation.travelModeBicycling', fallback: 'Vélo' }, emoji: '🚲', color: '#F59E0B' },
] as const;
const CHECKPOINT_LABELS: Record<string, { label: I18nLabel; icon: string; color: string }> = {
    radar: { label: { labelKey: 'navigation.checkpointRadar', fallback: 'Radar' }, icon: '📸', color: '#EF4444' },
    road_check: { label: { labelKey: 'navigation.checkpointRoadCheck', fallback: 'Contrôle' }, icon: '🚧', color: '#D97706' },
    transport_control: { label: { labelKey: 'navigation.checkpointTransportControl', fallback: 'Mintransport' }, icon: '🛂', color: '#0D9488' },
    police: { label: { labelKey: 'navigation.checkpointPolice', fallback: 'Police / Gendarmerie' }, icon: '👮', color: '#3B82F6' },
    accident: { label: { labelKey: 'navigation.checkpointAccident', fallback: 'Accident' }, icon: '🚨', color: '#F59E0B' },
    danger: { label: { labelKey: 'navigation.checkpointDanger', fallback: 'Danger' }, icon: '⚠️', color: '#EF4444' },
    road_works: { label: { labelKey: 'navigation.checkpointRoadWorks', fallback: 'Travaux' }, icon: '🚧', color: '#F97316' },
    speed_bump: { label: { labelKey: 'navigation.checkpointSpeedBump', fallback: 'Ralentisseur' }, icon: '🔶', color: '#8B5CF6' },
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
    { type: 'radar', icon: '📸', short: 'Radar', label: { labelKey: 'navigation.checkpointRadar', fallback: 'Radar' }, bg: '#FEE2E2', color: '#DC2626' },
    { type: 'road_check', icon: '🚧', short: 'Contrôle', label: { labelKey: 'navigation.checkpointRoadCheck', fallback: 'Contrôle routier' }, bg: '#FEF9C3', color: '#D97706' },
    { type: 'transport_control', icon: '🛂', short: 'Mintransp.', label: { labelKey: 'navigation.checkpointTransportControl', fallback: 'Mintransport' }, bg: '#CCFBF1', color: '#0D9488' },
    { type: 'police', icon: '👮', short: 'Police', label: { labelKey: 'navigation.checkpointPolice', fallback: 'Police / Gendarmerie' }, bg: '#DBEAFE', color: '#2563EB' },
    { type: 'accident', icon: '🚨', short: 'Accident', label: { labelKey: 'navigation.checkpointAccident', fallback: 'Accident' }, bg: '#FEF3C7', color: '#EA580C' },
    { type: 'danger', icon: '⚠️', short: 'Danger', label: { labelKey: 'navigation.checkpointDanger', fallback: 'Danger' }, bg: '#FEE2E2', color: '#DC2626' },
    { type: 'road_works', icon: '🔧', short: 'Travaux', label: { labelKey: 'navigation.checkpointRoadWorks', fallback: 'Travaux' }, bg: '#FEF3C7', color: '#F97316' },
    { type: 'speed_bump', icon: '🔶', short: 'Dos-d\'âne', label: { labelKey: 'navigation.checkpointSpeedBump', fallback: 'Dos-d\'âne' }, bg: '#F3F4F6', color: '#7C3AED' },
] as const;

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
    radar: (d, sl) => sl ? `Attention, radar à ${d}. Limite de vitesse: ${sl} kilomètres heure. Respectez la signalisation.` : `Attention, radar détecté à ${d}. Respectez les panneaux de circulation.`,
    police: (d) => `Contrôle police ou gendarmerie signalé à ${d}. Préparez vos documents et ralentissez.`,
    transport_control: (d) => `Contrôle Mintransport signalé à ${d}. Préparez vos documents de transport, carte grise et assurance.`,
    road_check: (d) => `Contrôle routier signalé à ${d}. Ralentissez et préparez permis de conduire, carte grise et assurance.`,
    accident: (d) => `Accident signalé à ${d}. Redoublez de prudence et réduisez votre vitesse.`,
    danger: (d) => `Zone dangereuse à ${d}. Soyez vigilant et adaptez votre conduite.`,
    road_works: (d) => `Travaux en cours à ${d}. Ralentissez et suivez la signalisation temporaire.`,
    speed_bump: (d) => `Ralentisseur à ${d}. Réduisez votre vitesse.`,
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

const formatDistanceText = (meters: number, t?: (key: string, opts?: any) => string): string => {
    if (meters >= 1000) return t ? t('navigation.voiceKilometers', { val: (meters / 1000).toFixed(1) }) : `${(meters / 1000).toFixed(1)} kilomètres`;
    return t ? t('navigation.voiceMeters', { val: Math.round(meters) }) : `${Math.round(meters)} mètres`;
};

// Backend (navigation/activity/ai-insights) renvoie CO2 en kg: emitted_kg / saved_kg.
// Certaines versions frontend attendaient des grams: emitted_grams / saved_grams.
const co2KgFromImpact = (co2Impact: any, kind: 'emitted' | 'saved'): number => {
    const kg = kind === 'emitted' ? co2Impact?.emitted_kg : co2Impact?.saved_kg;
    if (typeof kg === 'number') return kg;
    const grams = kind === 'emitted' ? co2Impact?.emitted_grams : co2Impact?.saved_grams;
    if (typeof grams === 'number') return grams / 1000;
    return 0;
};

// Correspondance entre nos checkpoint_type (radar/police/accident/...) et les types de notifications communautaires.
const checkpointTypeToCommunityAlert = (checkpointType: string): Parameters<typeof communityAlertSoundService.sendAlertSound>[0] | null => {
    const k = String(checkpointType || '').toLowerCase();
    switch (k) {
        case 'radar':
        case 'speed_bump':
            return 'speed_alert';
        case 'police':
        case 'transport_control':
            return 'police_control';
        case 'accident':
            return 'accident_report';
        case 'danger':
            return 'danger_zone';
        case 'road_check':
        case 'road_works':
            return 'road_work';
        default:
            return 'new_checkpoint';
    }
};

let communityNotificationPermissionEnsured = false;

// ✅ AMÉLIORÉ 2026-03-18: Alerte contextuelle son + TTS + haptic (toujours audio)
const playContextualAlert = async (
    checkpointType: string, distanceMeters: number, speedLimit?: number,
    options?: { alertMode?: 'sound' | 'visual'; lang?: string; t?: (key: string, opts?: any) => string }
) => {
    const mode: 'sound' = 'sound';
    const lang = options?.lang || 'fr';
    const tFn = options?.t;

    // 1. Haptic/vibration immédiat (TOUJOURS, quel que soit le mode)
    try {
        const { Vibration } = require('react-native');
        Vibration.vibrate([0, 300, 100, 300]);
    } catch { }

    // 1.5 Notifications locales (expo-notifications) — pour fiabiliser en arrière-plan
    try {
        const alertType = checkpointTypeToCommunityAlert(checkpointType);
        if (alertType) {
            if (!communityNotificationPermissionEnsured) {
                communityNotificationPermissionEnsured = true;
                const perm = await Notifications.getPermissionsAsync();
                if (perm.status !== 'granted') {
                    await Notifications.requestPermissionsAsync();
                }
            }
            const distanceForTemplate = Math.max(0, Math.round(distanceMeters));
            const extraData: Record<string, any> = {
                distance: distanceForTemplate,
                limit: speedLimit ?? '',
                description: '',
            };
            // On n'ajoute pas de facturation ici: le micro-feature de l'écran navigation reste la source de la logique payante.
            // On évite aussi la double vibration: playContextualAlert gère déjà le haptique.
            void communityAlertSoundService
                .sendFreeAlertSound(alertType, extraData, { sound: mode === 'sound', vibrate: false })
                .catch(() => { });
        }
    } catch { }
    try { const h = await import('expo-haptics'); await h.notificationAsync(h.NotificationFeedbackType.Warning); } catch { }

    // 2. Son d'alerte + TTS (UNIQUEMENT en mode 'sound')
    if (mode === 'sound') {
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
        // TTS multilingue
        try {
            const distText = formatDistanceText(distanceMeters, tFn);
            // Construire le message vocal dans la langue de l'utilisateur via i18n
            const typeKey = `navigation.voice_${checkpointType}`;
            let message = tFn ? tFn(typeKey, { distance: distText, speedLimit }) : '';
            // Fallback si clé i18n manquante (retourne la clé elle-même)
            if (!message || message === typeKey) {
                const msgFn = CHECKPOINT_VOICE_MESSAGES[checkpointType];
                message = msgFn ? msgFn(distText, speedLimit) : `Attention, alerte à ${distText}. Soyez prudent.`;
            }
            Speech.stop();
            // Mapper la langue i18n vers un code BCP-47 pour le TTS
            const ttsLangMap: Record<string, string> = {
                fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', pt: 'pt-BR',
                ar: 'ar-SA', sw: 'sw-KE', ha: 'ha-NG', wo: 'wo-SN', yo: 'yo-NG',
                ig: 'ig-NG', am: 'am-ET', zu: 'zu-ZA', rw: 'rw-RW', mg: 'mg-MG',
                zh: 'zh-CN', hi: 'hi-IN', ja: 'ja-JP', ko: 'ko-KR', ru: 'ru-RU',
                it: 'it-IT', nl: 'nl-NL', tr: 'tr-TR', pl: 'pl-PL', uk: 'uk-UA',
            };
            const ttsLang = ttsLangMap[lang] || `${lang}-${lang.toUpperCase()}`;
            Speech.speak(message, {
                language: ttsLang,
                rate: 0.95,
                pitch: 1.0,
                onError: (e) => console.warn('[NavigationScreen] TTS error:', e),
            });
            console.log(`[NavigationScreen] 🔊 TTS (${ttsLang}): ${message}`);
        } catch (e) { console.warn('[NavigationScreen] TTS fallback error:', e); }
    } else {
        console.log(`[NavigationScreen] 📳 Visual-only alert: ${checkpointType} at ${distanceMeters}m (vibration sent)`);
    }
};

const SHARE_BASE_URL = 'https://yukpomnang.com';

const NavigationScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location: currentLocation } = useLocationSafe();
    const {
        payForPoi, payMicroFeature, payForAlerts,
        isSuspended, unpaidCount, unpaidDebt, maxUnpaidUses,
        currentBalance, formatPriceInCurrency: fmtPrice, userCurrency,
        isCoachingActive, isCoachingTrial, coachingExpiresAt,
        activateCoachingSubscription, checkCoachingExpiry,
        isAlertsSuspended, redirectToRecharge,
        isNavigationFreePeriod, navigationFreeUntilLabel,
    } = useNavigationPayment();

    // Toasts discrets pour infos paiement (au lieu de bannières permanentes)
    useFocusEffect(
        useCallback(() => {
            paymentToastShownRef.current = false;
            return () => { paymentToastShownRef.current = true; };
        }, [])
    );
    useEffect(() => {
        if (!user || paymentToastShownRef.current) return;
        const timer = setTimeout(() => {
            if (paymentToastShownRef.current) return;
            if (isNavigationFreePeriod) {
                showToast(`🎉 ${t('navPayment.freeUntilDate').replace('{{date}}', navigationFreeUntilLabel)}`);
                paymentToastShownRef.current = true;
            } else if (isSuspended) {
                showToast(`⛔ ${t('navPayment.suspended')} · ${t('navPayment.recharge')}`);
                paymentToastShownRef.current = true;
            } else if (unpaidDebt > 0) {
                showToast(`⚠️ ${t('navPayment.debtAmount')}: ${fmtPrice(unpaidDebt, userCurrency)} · ${t('navPayment.recharge')}`);
                paymentToastShownRef.current = true;
            } else if (isCoachingTrial) {
                showToast(`🎁 ${t('navPayment.trialActive')}`);
                paymentToastShownRef.current = true;
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [user, isNavigationFreePeriod, navigationFreeUntilLabel, isSuspended, unpaidDebt, isCoachingTrial, fmtPrice, userCurrency, t]);

    const [destination, setDestination] = useState('');
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<LocationObject | null>(null);
    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
    const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPOI, setLoadingPOI] = useState(false);
    const [poiRequested, setPoiRequested] = useState(false);
    const [poiSelectedCategories, setPoiSelectedCategories] = useState<string[]>([]);
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
    const [showNavChat, setShowNavChat] = useState(false);
    const [showActivityStats, setShowActivityStats] = useState(false);
    const [activityPeriod, setActivityPeriod] = useState<'week' | 'month' | 'year'>('week');
    const [activitySummary, setActivitySummary] = useState<any>(null);
    const [activityHistory, setActivityHistory] = useState<any[]>([]);
    const [walkingHistory, setWalkingHistory] = useState<any[]>([]);
    const [freeWalkFilterRange, setFreeWalkFilterRange] = useState<{ start: string; end: string } | null>(null);
    const [freeWalkCompareMode, setFreeWalkCompareMode] = useState<'last' | 'last2' | 'month'>('last');
    const [statsScope, setStatsScope] = useState<'general' | 'freewalk'>('general');
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [aiInsights, setAiInsights] = useState<any>(null);
    const [coachingNotifHistory, setCoachingNotifHistory] = useState<Array<{
        id: string;
        title: string;
        body: string;
        timestamp: number;
        read: boolean;
    }>>([]);
    const [loadingCoachingHistory, setLoadingCoachingHistory] = useState(false);
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
    const paymentToastShownRef = useRef(false);
    const routeCardWidth = width * 0.72 + 10;
    const mapRef = useRef<MapView>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const searchRoutesRef = useRef<() => void>(() => { });

    // ── Mémos ──
    const groupedPOIs = useMemo(() => {
        const groups: Record<string, PointOfInterest[]> = {};
        for (const [catKey, cat] of Object.entries(POI_CATEGORIES)) {
            groups[catKey] = pointsOfInterest.filter(poi => cat.types.includes(normalizePoiType(poi.type)));
        }
        return groups;
    }, [pointsOfInterest]);
    const freeWalkHistoryScoped = useMemo(() => {
        if (!freeWalkFilterRange) return activityHistory;
        const startMs = new Date(freeWalkFilterRange.start).getTime();
        const endMs = new Date(freeWalkFilterRange.end).getTime();
        return activityHistory.filter((a: any) => {
            const ts = new Date(a?.date || '').getTime();
            return Number.isFinite(ts) && ts >= startMs && ts <= endMs;
        });
    }, [activityHistory, freeWalkFilterRange]);
    const freeWalkScopedSummary = useMemo(() => {
        if (!freeWalkFilterRange) return null;
        const list = freeWalkHistoryScoped;
        const totalDistanceKm = list.reduce((s: number, a: any) => s + (Number(a?.distance_km) || 0), 0);
        const totalMinutes = list.reduce((s: number, a: any) => s + (Number(a?.duration_minutes) || 0), 0);
        const totalCalories = list.reduce((s: number, a: any) => s + (Number(a?.calories) || 0), 0);
        const qualitySamples = list.map((a: any) => Number(a?.quality_score) || 0).filter((n: number) => n > 0);
        const avgQuality = qualitySamples.length > 0 ? (qualitySamples.reduce((a: number, b: number) => a + b, 0) / qualitySamples.length) : 0;
        return {
            total_distance_km: totalDistanceKm,
            total_duration_minutes: totalMinutes,
            total_calories: totalCalories,
            total_sessions: list.length,
            avg_quality_score: avgQuality,
        };
    }, [freeWalkFilterRange, freeWalkHistoryScoped]);
    const freeWalkComparisons = useMemo(() => {
        if (!freeWalkFilterRange) return null;
        const startMs = new Date(freeWalkFilterRange.start).getTime();
        const current = freeWalkScopedSummary || {
            total_distance_km: 0,
            total_duration_minutes: 0,
            total_calories: 0,
            total_sessions: 0,
            avg_quality_score: 0,
        };
        const previous = [...walkingHistory]
            .filter((a: any) => {
                const ts = new Date(a?.date || '').getTime();
                return Number.isFinite(ts) && ts < startMs;
            })
            .sort((a: any, b: any) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime());
        const byAvg = (list: any[]) => {
            if (list.length === 0) return null;
            const sum = list.reduce((acc: any, a: any) => ({
                distance: acc.distance + (Number(a?.distance_km) || 0),
                duration: acc.duration + (Number(a?.duration_minutes) || 0),
                calories: acc.calories + (Number(a?.calories) || 0),
                quality: acc.quality + (Number(a?.quality_score) || 0),
            }), { distance: 0, duration: 0, calories: 0, quality: 0 });
            return {
                total_distance_km: sum.distance / list.length,
                total_duration_minutes: sum.duration / list.length,
                total_calories: sum.calories / list.length,
                avg_quality_score: sum.quality / list.length,
                total_sessions: list.length,
            };
        };
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthList = previous.filter((a: any) => {
            const ts = new Date(a?.date || '').getTime();
            return Number.isFinite(ts) && ts >= monthStart.getTime();
        });
        const baseline =
            freeWalkCompareMode === 'last'
                ? byAvg(previous.slice(0, 1))
                : freeWalkCompareMode === 'last2'
                    ? byAvg(previous.slice(0, 2))
                    : byAvg(monthList);
        return { current, baseline };
    }, [freeWalkFilterRange, freeWalkScopedSummary, walkingHistory, freeWalkCompareMode]);
    const activitySummaryForDisplay = useMemo(
        () => (freeWalkFilterRange ? { ...(activitySummary || {}), ...(freeWalkScopedSummary || {}) } : activitySummary),
        [activitySummary, freeWalkFilterRange, freeWalkScopedSummary]
    );
    const activityHistoryForDisplay = useMemo(
        () => (freeWalkFilterRange ? freeWalkHistoryScoped : activityHistory),
        [activityHistory, freeWalkFilterRange, freeWalkHistoryScoped]
    );
    const passiveHistory = useMemo(
        () => activityHistory.filter((a: any) => String(a?.origin || '').toLowerCase().includes('détection automatique')),
        [activityHistory]
    );
    const passiveSummary = useMemo(() => {
        const totalDistance = passiveHistory.reduce((s: number, a: any) => s + (Number(a?.distance_km) || 0), 0);
        const totalCalories = passiveHistory.reduce((s: number, a: any) => s + (Number(a?.calories) || 0), 0);
        const totalMinutes = passiveHistory.reduce((s: number, a: any) => s + (Number(a?.duration_minutes) || 0), 0);
        return { sessions: passiveHistory.length, distanceKm: totalDistance, calories: totalCalories, minutes: totalMinutes };
    }, [passiveHistory]);
    const trendVsPrevious = useMemo(() => {
        const trend = Array.isArray(activitySummaryForDisplay?.daily_trend) ? activitySummaryForDisplay.daily_trend : [];
        if (trend.length < 4) return null;
        const mid = Math.floor(trend.length / 2);
        const prev = trend.slice(0, mid);
        const curr = trend.slice(mid);
        const sumDist = (arr: any[]) => arr.reduce((s: number, d: any) => s + (Number(d?.distance_meters) || 0), 0) / 1000;
        const prevDist = sumDist(prev);
        const currDist = sumDist(curr);
        const delta = prevDist > 0 ? ((currDist - prevDist) / prevDist) * 100 : 0;
        return { prevDist, currDist, delta };
    }, [activitySummaryForDisplay]);
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

    // POI: ne pas afficher automatiquement après sélection d'itinéraire.
    useEffect(() => {
        if (!selectedRoute?.id) return;
        setPoiRequested(false);
        setPoiSelectedCategories([]);
        setPointsOfInterest([]);
        setExpandedCategories({});
        setPoiShowAll({});
    }, [selectedRoute?.id]);

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
    const tr = useCallback((key: string, fallback: string) => {
        const v = t(key);
        return v && v !== key ? v : fallback;
    }, [t]);
    const getRouteEtaLabel = useCallback((route: RouteOption) => {
        const durSeconds = route.duration_in_traffic_seconds || route.duration_seconds;
        if (durSeconds && durSeconds > 0) {
            const eta = new Date(Date.now() + durSeconds * 1000);
            return `${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`;
        }
        const raw = route.arrival_time;
        if (!raw) return null;
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return `${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`;
        }
        return raw;
    }, []);
    const getTrafficColor = (l: string) => l === 'low' ? '#10B981' : l === 'medium' ? '#F59E0B' : l === 'high' ? '#EF4444' : '#6B7280';
    const getTrafficLabel = (l: string) => l === 'low' ? (t('navigation.trafficLow') || 'Fluide') : l === 'medium' ? (t('navigation.trafficMedium') || 'Modéré') : l === 'high' ? (t('navigation.trafficHigh') || 'Dense') : '';
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
            // Précharger les insights IA pour l'aperçu santé
            apiGet('/api/navigation/activity/ai-insights?period=week')
                .then((r: any) => { if (r?.data?.success) setAiInsights(r.data); })
                .catch(() => { });
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
    // Vérifier puis auto-activer le tracking passif au montage
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const running = await PassiveActivityTracker.isRunning();
                if (running) {
                    if (!cancelled) setPassiveTrackingActive(true);
                    return;
                }
                const started = await PassiveActivityTracker.start();
                if (!cancelled) setPassiveTrackingActive(!!started);
            } catch {
                if (!cancelled) setPassiveTrackingActive(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (showActivityStats) {
            loadCoachingNotificationHistory();
        }
    }, [showActivityStats, loadCoachingNotificationHistory]);
    // Détecter la langue active pour le TTS
    const activeLang = useMemo(() => {
        try { const i18n = require('i18next').default; return i18n.language?.split('-')[0] || 'fr'; } catch { return 'fr'; }
    }, []);
    const loadCoachingNotificationHistory = useCallback(async () => {
        setLoadingCoachingHistory(true);
        try {
            const history = await coachingNotificationService.getHistory();
            setCoachingNotifHistory(Array.isArray(history) ? history.slice(0, 20) : []);
        } catch {
            setCoachingNotifHistory([]);
        } finally {
            setLoadingCoachingHistory(false);
        }
    }, []);
    const resolveDestination = useCallback(async (dest: string) => {
        const dl = dest.toLowerCase().trim();
        if (dl === 'domicile' || dl === 'bureau') { try { const r = await apiGet(`/api/navigation/destinations/by-label/${dl}`) as any; if (r?.data) return { lat: r.data.latitude, lng: r.data.longitude, address: r.data.address }; } catch { } }
        try {
            const r = await apiGet(`/api/navigation/geocode?address=${encodeURIComponent(dest)}&lang=${encodeURIComponent(activeLang)}`) as any;
            if (r?.data?.location) return { lat: r.data.location.lat, lng: r.data.location.lng, address: r.data.formatted_address || dest };
        } catch { }
        return null;
    }, [activeLang]);
    const geocodeDestination = useCallback(async (addr: string) => { const r = await resolveDestination(addr); return r ? { lat: r.lat, lng: r.lng } : null; }, [resolveDestination]);

    const searchRoutes = useCallback(async () => {
        let destCoords = destinationCoords;
        if (!destCoords && (selectedLocation as any)?.latitude && (selectedLocation as any)?.longitude) { destCoords = { lat: (selectedLocation as any).latitude, lng: (selectedLocation as any).longitude }; setDestinationCoords(destCoords); }
        if (!destCoords && !destination.trim()) { Alert.alert(t('navigation.destinationRequired'), t('navigation.selectDestination')); return; }

        // ✅ PAIEMENT: Gate recherche itinéraire via payMicroFeature('route_search')
        let paymentOk = false;
        await payMicroFeature('route_search', () => { paymentOk = true; });
        if (!paymentOk) { return; }

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
            const response = await apiPost('/api/navigation/routes', {
                origin,
                destination: destCoords,
                alternatives: true,
                avoid: avoidList,
                traffic_model: 'best_guess',
                mode: travelMode,
                language_hint: activeLang,
                waypoints: waypoints.length > 0 ? waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })) : undefined
            }) as any;
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
                showToast(`🛣️ ${t('navigation.routesFound', { count: valid.length }) || `${valid.length} itinéraire(s) trouvé(s) !`}`);
                // ✅ Auto-scroll vers les résultats après un court délai pour que le state se mette à jour
                setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 400, animated: true }); }, 300);
                // POI: on ne charge pas automatiquement. L'utilisateur déclenche via le sélecteur de catégories.
                setTimeout(() => loadCheckpointsSafely(), 800);
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
    }, [destination, destinationCoords, selectedLocation, getCurrentPosition, geocodeDestination, avoidTolls, avoidHighways, avoidFerries, waypoints, travelMode, payMicroFeature]);
    useEffect(() => { searchRoutesRef.current = searchRoutes; }, [searchRoutes]);

    // ── POI interne (sans gate de paiement) ──
    const _loadPOIInternal = useCallback(async (route: RouteOption) => {
        if (!route || !destinationCoords) { setPointsOfInterest([]); return; }
        setLoadingPOI(true); setPointsOfInterest([]);
        try {
            const origin = await getCurrentPosition(); if (!origin) { setLoadingPOI(false); return; }
            if (!route.id || !route.steps?.length) { setLoadingPOI(false); return; }
            const stepsP = route.steps.length > 0 ? `&route_steps=${encodeURIComponent(JSON.stringify(route.steps.map(s => ({ lat: s.location?.lat || 0, lng: s.location?.lng || 0 }))))}` : '';
            const r = await apiGet(`/api/navigation/points-of-interest?route_id=${route.id}&origin_lat=${origin.lat}&origin_lng=${origin.lng}&dest_lat=${destinationCoords.lat}&dest_lng=${destinationCoords.lng}${stepsP}&lang=${encodeURIComponent(activeLang)}`) as any;
            console.log('[Navigation] POI Response:', JSON.stringify(r, null, 2));
            if (r?.data?.pois && Array.isArray(r.data.pois)) {
                console.log('[Navigation] Raw POIs:', r.data.pois);
                const vp = r.data.pois.filter((p: any) => {
                    console.log('[Navigation] Processing POI:', p);
                    // Extract name properly - handle object or string
                    const _unkn = t('navigation.unknownName') || (t('navigation.unknownName') || 'Nom inconnu');
                    const name = typeof p?.name === 'string' ? p.name :
                        typeof p?.name === 'object' ? p.name?.name || JSON.stringify(p.name) :
                            _unkn;
                    console.log('[Navigation] Extracted name:', name, 'type:', typeof p?.name);
                    if (p && name !== _unkn) {
                        p.name = name;
                    }
                    p.type = normalizePoiType(p?.type);
                    const coords = validateCoords(p.location?.lat ?? p.latitude ?? 0, p.location?.lng ?? p.longitude ?? 0);
                    console.log('[Navigation] POI coords valid:', coords, 'name:', p.name);
                    return p?.name && coords && Object.values(POI_CATEGORIES).some(cat => cat.types.includes(p.type));
                });
                console.log('[Navigation] Validated POIs:', vp);
                setPointsOfInterest(vp);
                // Catégories fermées par défaut: ouverture uniquement manuelle.
                const reset: Record<string, boolean> = {};
                Object.keys(POI_CATEGORIES).forEach(k => reset[k] = false);
                setExpandedCategories(reset);
                setPoiShowAll({});
            }
        } catch { setPointsOfInterest([]); } finally { setLoadingPOI(false); }
    }, [destinationCoords, getCurrentPosition]);

    // ✅ POI avec gate de paiement — à la demande de l'utilisateur
    const loadPointsOfInterestSafely = useCallback(async (route: RouteOption, selectedCategories: string[] = []) => {
        if (!route || !destinationCoords) { setPointsOfInterest([]); return; }

        const categories = selectedCategories.length > 0 ? selectedCategories : Object.keys(POI_CATEGORIES);

        // Construire les labels des catégories pour l'écran de confirmation
        const catLabels: Record<string, string> = {};
        categories.forEach(k => {
            const cat = POI_CATEGORIES[k];
            if (!cat) return;
            catLabels[k] = cat.label?.labelKey ? (t(cat.label.labelKey) || cat.label.fallback) : (cat.label?.fallback || k);
        });

        setPoiRequested(false);
        // Gate via payForPoi — confirmation + débit automatique
        await payForPoi(
            categories,
            catLabels,
            () => {
                setPoiRequested(true);
                _loadPOIInternal(route);
            },
            () => {
                setPoiRequested(false);
                console.log('[Navigation] POI payment cancelled');
            }
        );
    }, [destinationCoords, _loadPOIInternal, payForPoi, t]);

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
        const safeName = typeof poi.name === 'string' ? poi.name : (typeof poi.name === 'object' && poi.name !== null ? (poi.name as any).name || (poi.name as any).text || JSON.stringify(poi.name) : (t('navigation.unknownName') || 'Nom inconnu'));
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
            message: `${modeEmoji} ${t('navigation.shareRouteTitle') || 'Itinéraire Yukpo'}\n📍 ${originName} → 🏁 ${destName}\n📊 ${dist} · ⏱ ${dur}\n\n${shareUrl}`,
            title: t('navigation.shareRouteTo', { dest: destName }) || `Itinéraire vers ${destName}`,
        });
    }, [selectedRoute, destinationCoords, getCurrentPosition, travelMode, destination]);
    const shareAlert = useCallback(async (alert: { checkpoint_type: string; lat: number; lng: number; locationName?: string; speed_limit?: number }) => {
        const info = CHECKPOINT_LABELS[alert.checkpoint_type] || { label: { labelKey: '', fallback: alert.checkpoint_type }, icon: '⚠️', color: '#6B7280' };
        const locName = alert.locationName || await reverseGeocode(alert.lat, alert.lng);
        const label = info.label?.labelKey ? (t(info.label.labelKey) || info.label.fallback) : (info.label?.fallback || alert.checkpoint_type);
        const msg = `${info.icon} ${label} — ${locName}${alert.speed_limit ? ` (${alert.speed_limit} km/h)` : ''}\n\n⚠️ ${t('navigation.shareTitle') || 'Yukpo Navigation'}\n${SHARE_BASE_URL}/navigation/share/route?dest_lat=${alert.lat}&dest_lng=${alert.lng}&dest_name=${encodeURIComponent(locName)}&mode=driving`;
        await Share.share({ message: msg, title: `${info.icon} ${label} - Yukpo` });
    }, []);
    const sharePOI = useCallback(async (poi: PointOfInterest) => {
        const lat = poi.location?.lat ?? (poi as any).latitude ?? 0;
        const lng = poi.location?.lng ?? (poi as any).longitude ?? 0;
        const catEntry = Object.entries(POI_CATEGORIES).find(([, c]) => c.types.includes(normalizePoiType(poi.type)));
        const catIcon = catEntry ? catEntry[1].icon : '📍';
        const safeName = typeof poi.name === 'string' ? poi.name : (typeof poi.name === 'object' && poi.name !== null ? (poi.name as any).name || (poi.name as any).text || JSON.stringify(poi.name) : (t('navigation.unknownName') || 'Nom inconnu'));
        const lines = [`${catIcon} ${safeName}`];
        if (poi.address) lines.push(`📍 ${poi.address}`);
        if (poi.rating) lines.push(`⭐ ${poi.rating}${poi.total_ratings ? ` (${poi.total_ratings} ${t('navigation.reviews') || 'avis'})` : ''}`);
        if (poi.is_open != null) lines.push(poi.is_open ? `✅ ${t('navigation.poiOpen') || 'Ouvert'}` : `❌ ${t('navigation.poiClosed') || 'Fermé'}`);
        lines.push('');
        lines.push(`${t('navigation.openInYukpo') || 'Ouvrir dans Yukpo'} 🚀`);
        lines.push(`${SHARE_BASE_URL}/navigation/share/route?dest_lat=${lat}&dest_lng=${lng}&dest_name=${encodeURIComponent(safeName)}&mode=driving`);
        await Share.share({ message: lines.join('\n'), title: `${catIcon} ${safeName}` });
    }, []);
    const sharePerformance = useCallback(async () => {
        if (!aiInsights) return;
        const hs = aiInsights.health_score || {}, co2 = aiInsights.co2_impact || {}, gam = aiInsights.gamification || {};
        await socialSharing.shareNavigationPerformance({
            period: activityPeriod,
            distanceKm: activitySummary?.total_distance_km || 0,
            sessions: activitySummary?.total_sessions || 0,
            calories: activitySummary?.total_calories || 0,
            healthScore: hs.score || 0,
            healthLabel: hs.label || '',
            co2SavedKg: co2KgFromImpact(co2, 'saved'),
            vo2max: aiInsights.fitness?.vo2max_estimate || 0,
            fitnessLevel: aiInsights.fitness?.level || '',
            streak: gam.current_streak || 0,
            badgeCount: gam.badges?.length || 0,
            points: Number(gam.total_points) || 0,
            userId: user?.id as any,
        });
    }, [aiInsights, activityPeriod, user, activitySummary]);

    const loadActivityStats = useCallback(async (period: string = 'week') => {
        setLoadingActivity(true);
        try {
            console.log('[Navigation] Loading activity stats for period:', period);
            setAiInsights(null);
            // ✅ Summary + History = GRATUIT
            const [sr, hr, wr] = await Promise.all([
                apiGet(`/api/navigation/activity/summary?period=${period}`),
                apiGet(`/api/navigation/activity/history?limit=50`),
                apiGet(`/api/navigation/activity/history?limit=50&mode=walking`),
            ]) as any[];

            console.log('[Navigation] Activity summary response:', sr?.data);
            console.log('[Navigation] Activity history response:', hr?.data);

            if (sr?.data) {
                console.log('[Navigation] Setting activity summary:', sr.data);
                const summary = sr.data.summary || {};
                setActivitySummary({
                    ...summary,
                    by_mode: sr.data.by_mode || [],
                    best_session: sr.data.best_session || null,
                    daily_trend: sr.data.daily_trend || [],
                    most_visited_places: (sr.data.top_destinations || []).map((d: any) => ({ name: d.address || (t('navigation.unknownPlace') || 'Lieu inconnu'), visit_count: d.visits || 0 })),
                    favorite_poi_types: (sr.data.by_mode || []).map((m: any) => ({ poi_type: m.mode, count: m.count || 0 })),
                });
            }
            if (hr?.data?.activities) {
                console.log('[Navigation] Setting activity history:', hr.data.activities);
                setActivityHistory(hr.data.activities);
            }
            if (wr?.data?.activities) {
                setWalkingHistory(wr.data.activities);
            }

            // ✅ PAIEMENT: AI Coach Insights = payMicroFeature('ai_coach')
            await payMicroFeature(
                'ai_coach',
                async () => {
                try {
                    const ar = await apiGet(`/api/navigation/activity/ai-insights?period=${period}`) as any;
                    console.log('[Navigation] AI insights response:', ar?.data);
                    if (ar?.data?.success) {
                        console.log('[Navigation] Setting AI insights:', ar.data);
                        setAiInsights(ar.data);
                    } else {
                        console.log('[Navigation] AI insights not successful or missing');
                    }
                } catch (e) {
                    console.error('[Navigation] Error loading AI insights:', e);
                }
                },
                () => redirectToRecharge('Navigation')
            );
            await loadCoachingNotificationHistory();
        } catch (e) {
            console.error('[Navigation] Error loading activity stats:', e);
        } finally {
            setLoadingActivity(false);
        }
    }, [payMicroFeature, redirectToRecharge, loadCoachingNotificationHistory]);
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
        const labelOrObj = CHECKPOINT_LABELS[type]?.label || type;
        const typeLabelStr = typeof labelOrObj === 'object' && labelOrObj !== null && 'labelKey' in labelOrObj
            ? (t((labelOrObj as I18nLabel).labelKey) || (labelOrObj as I18nLabel).fallback)
            : String(labelOrObj);
        const typeIcon = CHECKPOINT_LABELS[type]?.icon || '⚠️';
        // Demander confirmation AVANT d'envoyer le signalement
        Alert.alert(
            `${typeIcon} ${t('message.confirm')}`,
            `${typeLabelStr} ?`,
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
                            showConfirmationToast(t('navigation.checkpointAdded'), '✅');
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
                { checkpoint_type: 'police', latitude: pos.lat - 0.001, longitude: pos.lng - 0.001, description: 'Contrôle police', speed_limit: null },
                { checkpoint_type: 'accident', latitude: pos.lat + 0.002, longitude: pos.lng - 0.001, description: 'Accident sur la chaussée', speed_limit: null },
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

            // Clustering historique: regrouper seulement les doublons proches
            // du MEME type et dans une fenêtre temporelle proche.
            const clusters: Array<{ items: any[]; centerLat: number; centerLng: number }> = [];
            const CLUSTER_DISTANCE_M = 200;
            const RADAR_CLUSTER_DISTANCE_M = 1000;
            const CLUSTER_TIME_WINDOW_MS = 30 * 60 * 1000; // 30 min
            const getCreatedAtMs = (cp: any) => {
                const ms = cp?.created_at ? new Date(cp.created_at).getTime() : 0;
                return Number.isFinite(ms) ? ms : 0;
            };
            for (const cp of rawCps) {
                let added = false;
                for (const cl of clusters) {
                    const main = cl.items[0];
                    const sameType = String(main?.checkpoint_type || '') === String(cp?.checkpoint_type || '');
                    const clusterDistanceLimit = String(cp?.checkpoint_type || '').toLowerCase() === 'radar'
                        ? RADAR_CLUSTER_DISTANCE_M
                        : CLUSTER_DISTANCE_M;
                    const distOk = haversineDistance(cl.centerLat, cl.centerLng, cp.latitude, cp.longitude) < clusterDistanceLimit;
                    const timeOk = Math.abs(getCreatedAtMs(main) - getCreatedAtMs(cp)) <= CLUSTER_TIME_WINDOW_MS;
                    if (sameType && distOk && timeOk) {
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
                const sortedItems = [...cl.items].sort((a: any, b: any) => getCreatedAtMs(b) - getCreatedAtMs(a));
                const main = sortedItems[0];
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

            data.sort((a, b) => {
                const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                if (ta !== tb) return tb - ta;
                return a.distance - b.distance;
            });
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
            showConfirmationToast(isUp ? `✅ ${t('navigation.alertConfirmed') || 'Alerte confirmée !'}` : `❌ ${t('navigation.alertDenied') || 'Alerte infirmée'}`, isUp ? '👍' : '👎');
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

        // ✅ Priorité: ouvrir Google Maps navigation (plus convivial)
        // On le déclenche au moment où l'utilisateur clique "Suivi en temps réel".
        try {
            const dest = destinationCoords;
            if (dest) {
                const origin = await getCurrentPosition();
                const url = Platform.select({
                    ios: origin
                        ? `maps://app?daddr=${dest.lat},${dest.lng}&saddr=${origin.lat},${origin.lng}&dirflg=d`
                        : `maps://app?daddr=${dest.lat},${dest.lng}&dirflg=d`,
                    android: `google.navigation:q=${dest.lat},${dest.lng}`,
                    default: origin
                        ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`
                        : `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`,
                });
                if (url) {
                    const canOpen = await Linking.canOpenURL(url);
                    if (canOpen) {
                        // Ne pas bloquer le démarrage du tracking
                        Linking.openURL(url).catch(() => { });
                    }
                }
            }
        } catch (e) {
            console.warn('[Navigation] Failed to open Google Maps navigation:', e);
        }

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
            // ✅ PAIEMENT: Facturation par checkpoint UNIQUE rencontré (1ère détection = payMicroFeature)
            if (near) {
                const thresholds = CHECKPOINT_ALERT_THRESHOLDS[near.checkpoint_type] || [2000, 500];
                const lastIdx = encounteredCheckpointIdsRef.current.get(near.id) ?? -1;
                let newIdx = -1;
                for (let t = 0; t < thresholds.length; t++) { if (near.distance < thresholds[t]) newIdx = t; }
                if (newIdx > lastIdx) {
                    encounteredCheckpointIdsRef.current.set(near.id, newIdx);
                    if (lastIdx === -1) {
                        // Première détection de ce checkpoint → facturer
                        checkpointsEncounteredRef.current += 1;
                        payMicroFeature('community_alerts',
                            () => playContextualAlert(near!.checkpoint_type, near!.distance, near!.speed_limit, { alertMode: 'sound', lang: activeLang, t }),
                        );
                    } else {
                        // Re-alerte progressive (seuil plus proche) → gratuit
                        playContextualAlert(near.checkpoint_type, near.distance, near.speed_limit, { alertMode: 'sound', lang: activeLang, t });
                    }
                }
            }
            setNearbyCheckpoint(near);
        });
        locationSubscriptionRef.current = sub;
    }, [selectedRoute, isTracking, haversineDistance, loadCheckpointsSafely, getCurrentPosition, destinationCoords, activeLang, payMicroFeature]);

    // ── MARCHE LIBRE : session persistante en arrière-plan ──
    const startFreeWalking = useCallback(async () => {
        if (isTracking || isFreeWalking) return;
        const ok = await FreeWalkSessionService.start();
        if (!ok) { Alert.alert(t('navigation.permissionRequired'), t('navigation.allowLocationWalking')); return; }
        const snap = await FreeWalkSessionService.getSessionSnapshot();
        trackingStartTimeRef.current = new Date().toISOString();
        if (snap?.startedAt) trackingStartTimeRef.current = snap.startedAt;
        speedSamplesRef.current = []; maxSpeedRef.current = 0; distanceTraveledRef.current = 0;
        lastPositionRef.current = null; checkpointsReportedRef.current = 0;
        checkpointsEncounteredRef.current = 0; wasOffRouteRef.current = false;
        encounteredCheckpointIdsRef.current = new Map();
        setIsFreeWalking(true); setIsTracking(true); setTravelMode('walking');
        showToast(`🚶 ${t('navigation.freeWalkStarted') || 'Marche libre démarrée !'} `);
        // Charger les alertes communautaires autour de la position
        loadCheckpointsSafely();
        checkpointRefreshRef.current = setInterval(() => { loadCheckpointsSafely(); }, 60000);
    }, [isTracking, isFreeWalking, loadCheckpointsSafely]);

    const stopFreeWalking = useCallback(async () => {
        if (checkpointRefreshRef.current) { clearInterval(checkpointRefreshRef.current); checkpointRefreshRef.current = null; }
        try { Speech.stop(); } catch { }
        const session = await FreeWalkSessionService.stop();
        const st = session?.startedAt || trackingStartTimeRef.current;
        const endedAtIso = session?.endedAt || new Date().toISOString();
        const dM = session?.distanceMeters || distanceTraveledRef.current;
        const dKm = dM / 1000;
        const dSec = session?.durationSeconds || (st ? Math.round((Date.now() - new Date(st).getTime()) / 1000) : 0);
        const dMin = dSec / 60;
        const avg = session?.avgSpeedKmh || 0;
        const cal = session?.calories || estimateCalories(dKm, dMin, 'walking', avg);
        const qual = computeQualityScore(speedSamplesRef.current, dKm, dMin, 'walking', false);
        const consistency = 100;
        const pacePerKm = dKm > 0.01 ? dSec / dKm : 0;
        if (dSec > 30 && dM > 10) {
            try {
                await apiPost('/api/navigation/activity/log', {
                    travel_mode: 'walking',
                    origin_address: t('navigation.freeWalkOrigin') || 'Marche libre',
                    destination_address: t('navigation.freeWalkOrigin') || 'Marche libre',
                    origin_lat: session?.lastLat || lastPositionRef.current?.lat,
                    origin_lng: session?.lastLng || lastPositionRef.current?.lng,
                    dest_lat: session?.lastLat || livePosition?.lat,
                    dest_lng: session?.lastLng || livePosition?.lng,
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
                setFreeWalkFilterRange({ start: st || endedAtIso, end: endedAtIso });
                setFreeWalkCompareMode('last');
                setStatsScope('freewalk');
                setShowActivityStats(true);
                setShowAlertHistory(false);
                await loadActivityStats(activityPeriod);
                showToast(`🚶 ${t('navigation.walkingDone') || 'Marche terminée'} · ${dKm.toFixed(1)} km`);
            } catch (e) { console.warn('[Navigation] Erreur log marche libre:', e); }
        } else {
            showToast(`🚶 ${t('navigation.walkTooShort') || 'Marche trop courte pour être enregistrée (min 30s / 10m)'}`);
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
        if (dSec > 30 && dM > 10) { try { await apiPost('/api/navigation/activity/log', { travel_mode: travelMode, origin_address: selectedRoute?.start_address, destination_address: destination || selectedRoute?.end_address, origin_lat: livePosition?.lat || lastPositionRef.current?.lat, origin_lng: livePosition?.lng || lastPositionRef.current?.lng, dest_lat: destinationCoords?.lat, dest_lng: destinationCoords?.lng, distance_meters: dM, duration_seconds: dSec, avg_speed_kmh: Math.round(avg * 10) / 10, max_speed_kmh: Math.round(maxSpeedRef.current * 10) / 10, calories_burned: Math.round(cal), quality_score: qual, speed_consistency: Math.round(consistency * 10) / 10, pace_per_km_seconds: Math.round(pacePerKm), checkpoints_reported: checkpointsReportedRef.current, checkpoints_encountered: checkpointsEncounteredRef.current, was_off_route: wasOffRouteRef.current, started_at: st || new Date().toISOString() }); Alert.alert(`🏁 ${t('navigation.sessionDone') || 'Session terminée'}`, `📏 ${dKm.toFixed(1)} km · ⏱ ${Math.floor(dMin)} min · 🔥 ${Math.round(cal)} cal · ⭐ ${qual}/100`, [{ text: t('navigation.viewStats') || 'Stats', onPress: () => { setShowActivityStats(true); loadActivityStats(activityPeriod); } }, { text: 'OK' }]); } catch { } }
        setIsTracking(false); setNearbyCheckpoint(null); setIsOffRoute(false); setLivePosition(null);
    }, [travelMode, destination, livePosition, destinationCoords, selectedRoute, estimateCalories, computeQualityScore, activityPeriod, loadActivityStats]);

    useEffect(() => {
        return () => {
            if (locationSubscriptionRef.current) { try { locationSubscriptionRef.current.remove(); } catch { } } if (checkpointRefreshRef.current) { try { clearInterval(checkpointRefreshRef.current); } catch { } } if (trackingUpdateIntervalRef.current) { try { clearInterval(trackingUpdateIntervalRef.current); } catch { } }
        };
    }, []);

    // Timer pour rafraîchir le dashboard marche libre depuis le service persistant
    useEffect(() => {
        if (!isFreeWalking) return;
        const sync = async () => {
            const snap = await FreeWalkSessionService.getSessionSnapshot();
            if (!snap) return;
            trackingStartTimeRef.current = snap.startedAt;
            distanceTraveledRef.current = snap.totalDistance;
            maxSpeedRef.current = snap.maxSpeedKmh;
            setCurrentSpeed(snap.currentSpeedKmh || 0);
            const pos = { lat: snap.lastLat, lng: snap.lastLng };
            setLivePosition(pos);
            lastPositionRef.current = pos;
            setFreeWalkTick(t => t + 1);
        };
        sync();
        const timer = setInterval(sync, 3000);
        return () => clearInterval(timer);
    }, [isFreeWalking]);

    // Réattacher la session marche libre si active (retour écran / app relancée)
    useEffect(() => {
        (async () => {
            const running = await FreeWalkSessionService.isRunning();
            if (!running) return;
            setIsFreeWalking(true);
            setIsTracking(true);
            setTravelMode('walking');
            const snap = await FreeWalkSessionService.getSessionSnapshot();
            if (snap?.startedAt) trackingStartTimeRef.current = snap.startedAt;
        })();
    }, []);

    const dynamicStyles = useMemo(() => ({
        scrollContent: { padding: 16, paddingBottom: isKeyboardVisible && isLocationSelectorFocused ? Math.max(100, keyboardHeight + 100) : 100 },
        locationSelectorDynamic: { maxHeight: isKeyboardVisible && isLocationSelectorFocused ? Math.min(300, height - keyboardHeight - 200) : undefined, zIndex: isKeyboardVisible && isLocationSelectorFocused ? 1000 : 1 }
    }), [isKeyboardVisible, keyboardHeight, isLocationSelectorFocused]);

    // ── Gestion du bouton retour matériel ──
    useEffect(() => {
        const backAction = () => {
            // Si en marche libre, quitter l'écran sans arrêter la session
            if (isFreeWalking) {
                navigation.goBack();
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
                            <TouchableOpacity
                                onPress={() => {
                                    if (isFreeWalking) { navigation.goBack(); return; }
                                    if (showActivityStats || showAlertHistory) {
                                        setShowActivityStats(false);
                                        setShowAlertHistory(false);
                                        return;
                                    }
                                    navigation.goBack();
                                }}
                                style={st.headerIcon}
                                activeOpacity={0.8}
                            >
                                <Text style={{ fontSize: 22 }}>🧭</Text>
                            </TouchableOpacity>
                            <View>
                                <Text style={st.headerTitle}>Navigation</Text>
                                <Text style={st.headerSub}>
                                    {isFreeWalking ? `🚶 ${t('navigation.freeWalkInProgress') || 'Marche libre en cours'}` :
                                        isTracking ? `📡 ${t('navigation.trackingInProgress') || 'Suivi en cours'}` :
                                            showActivityStats ? `📊 ${t('navigation.statsCoachIA') || 'Stats & Coach IA'}` :
                                                showAlertHistory ? `🚨 ${t('navigation.alerts') || 'Alertes'}` :
                                                    (t('navigation.smartRoutes') || 'Itinéraires intelligents')}
                                </Text>
                            </View>
                        </View>
                        <View style={st.headerRight}>
                            {/* Bouton Marche Libre (première position) */}
                            <TouchableOpacity
                                style={[st.headerBtnSmall, isFreeWalking && st.headerBtnWalkActive]}
                                onPress={async () => {
                                    if (isFreeWalking) {
                                        await stopFreeWalking();
                                        return;
                                    }
                                    setFreeWalkFilterRange(null);
                                    setShowActivityStats(false);
                                    setShowAlertHistory(false);
                                    await startFreeWalking();
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={{ fontSize: 14 }}>{isFreeWalking ? '🏃' : '🚶'}</Text>
                                {isFreeWalking && <View style={st.walkLiveDot} />}
                            </TouchableOpacity>
                            {/* Bouton Alertes Communautaires */}
                            <TouchableOpacity
                                style={[st.headerBtnSmall, showAlertHistory && st.headerBtnAlertActive]}
                                onPress={() => {
                                    if (showAlertHistory) {
                                        setShowAlertHistory(false);
                                        return;
                                    }
                                    // Gate l'ouverture avec payForAlerts
                                    payForAlerts(
                                        () => {
                                            setShowAlertHistory(true);
                                            setShowActivityStats(false);
                                            loadAlertHistory();
                                        },
                                        () => { /* suspendu — le hook affiche déjà l'alerte */ }
                                    );
                                }}
                            >
                                <SafeIcon name="AlertTriangle" size={14} color={showAlertHistory ? '#fff' : modernColors.text} />
                                {checkpoints.length > 0 && (
                                    <View style={st.alertBadgeSmall}>
                                        <Text style={st.alertBadgeText}>{checkpoints.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            {/* Bouton Statistiques */}
                            <TouchableOpacity
                                style={[st.headerBtnSmall, showActivityStats && st.headerBtnActive]}
                                onPress={() => {
                                    setFreeWalkFilterRange(null);
                                    setStatsScope('general');
                                    const n = !showActivityStats;
                                    setShowActivityStats(n);
                                    setShowAlertHistory(false);
                                    if (n) loadActivityStats(activityPeriod);
                                }}
                            >
                                <SafeIcon name={showActivityStats ? 'Compass' : 'BarChart3'} size={14} color={showActivityStats ? '#fff' : modernColors.text} />
                            </TouchableOpacity>
                            {/* Bouton Covoiturage */}
                            <TouchableOpacity
                                style={st.headerBtnSmall}
                                onPress={() => (navigation as any).navigate('CovoiturageHome')}
                            >
                                <Text style={{ fontSize: 14 }}>🚗👥</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Solde minimal (une seule pastille, le reste en toasts) */}
                    {user && (
                        <TouchableOpacity
                            style={{
                                alignSelf: 'flex-start',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                marginBottom: 8,
                                borderRadius: 10,
                                backgroundColor: isNavigationFreePeriod ? '#ECFDF5' : (currentBalance > 0 ? '#DCFCE7' : '#FEF3C7'),
                                borderWidth: 1.5,
                                borderColor: isNavigationFreePeriod ? '#34D399' : (currentBalance > 0 ? '#BBF7D0' : '#FDE68A')
                            }}
                            onPress={() => redirectToRecharge('Navigation')}
                            activeOpacity={0.7}
                        >
                            <Text style={{ fontSize: 12 }}>{isNavigationFreePeriod ? '🎉' : (currentBalance > 0 ? '💰' : '⚠️')}</Text>
                            <View>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: isNavigationFreePeriod ? '#047857' : (currentBalance > 0 ? '#16A34A' : '#92400E') }}>
                                    {isNavigationFreePeriod ? `Navigation offerte jusqu'au ${navigationFreeUntilLabel}` : `Solde: ${fmtPrice(currentBalance, userCurrency)}`}
                                </Text>
                                <Text style={{ fontSize: 10, color: isNavigationFreePeriod ? '#059669' : modernColors.textSecondary }}>
                                    Appuyez pour recharger des tokens
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* ━━ HISTORIQUE DES ALERTES (toggle via icône header) ━━ */}
                    {showAlertHistory && (
                        <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#EF4444', marginBottom: 8 }]}>
                            <View style={st.alertHistHdr}>
                                <Text style={{ fontSize: 18 }}>🚨</Text>
                                <View style={st.flex1}>
                                    <Text style={st.alertHistTitle}>{t('navigation.communityAlerts') || 'Alertes communautaires'}</Text>
                                    <Text style={st.alertHistSub}>{checkpoints.length > 0 ? (t('navigation.activeAlerts', { count: checkpoints.length }) || `${checkpoints.length} alerte(s) active(s)`) : (t('navigation.noActiveAlerts') || 'Aucune alerte active')}</Text>
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
                                        <Text style={{ fontSize: 12, color: '#6B7280' }}>{t('navigation.createTestAlerts') || 'Créer alertes de test'}</Text>
                                    </TouchableOpacity>
                                )}
                                {loadingAlertHistory ? (
                                    <View style={st.loadCard}><ActivityIndicator color="#EF4444" /><Text style={st.loadText}>{t('navigation.loadingAlerts') || 'Chargement des alertes...'}</Text></View>
                                ) : alertHistoryData.length === 0 ? (
                                    <View style={{ alignItems: 'center' as any, padding: 16 }}><Text style={{ fontSize: 32 }}>✅</Text><Text style={st.emptyText}>{t('navigation.noAlertInZone') || 'Aucune alerte signalée dans cette zone'}</Text></View>
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
                                                        <Text style={[st.alertHistLabel, { color: info.color }]}>
                                                            {info.label?.labelKey ? (t(info.label.labelKey) || info.label.fallback) : (info.label?.fallback || '')}
                                                        </Text>
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
                                                            <Text style={st.voteBtnTxt}>{t('message.confirm') || 'Confirmer'}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={[st.voteBtn, st.voteBtnDown]} onPress={() => voteCheckpoint(alert.id, 'down')} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 14 }}>👎</Text>
                                                            <Text style={[st.voteBtnTxt, { color: '#EF4444' }]}>{t('navigation.dispute') || 'Infirmer'}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[st.voteBtn, expandedCommentsId === alert.id && { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' }]}
                                                            onPress={() => setExpandedCommentsId(prev => prev === alert.id ? null : alert.id)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="message-circle" size={14} color={expandedCommentsId === alert.id ? '#2563EB' : '#6B7280'} />
                                                            <Text style={[st.voteBtnTxt, { color: expandedCommentsId === alert.id ? '#2563EB' : '#6B7280' }]}>
                                                                {t('navigation.comment') || 'Commenter'}
                                                            </Text>
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
                                        <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>📡 Suivi GPS actif</Text>
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
                                        <Text style={[st.cpTitle, { color: CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color }]}>
                                            {(() => {
                                                const entry = CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type];
                                                const labelObj = entry?.label;
                                                if (!labelObj) return nearbyCheckpoint.checkpoint_type;
                                                return labelObj.labelKey ? (t(labelObj.labelKey) || labelObj.fallback) : labelObj.fallback;
                                            })()} dans {nearbyCheckpoint.distance >= 1000 ? `${(nearbyCheckpoint.distance / 1000).toFixed(1)} km` : `${nearbyCheckpoint.distance} m`}
                                        </Text>
                                    </View>
                                </View>
                            )}
                            <TouchableOpacity style={st.stopBtn} onPress={stopFreeWalking}>
                                <Text style={{ fontSize: 16 }}>⏹</Text>
                                <Text style={st.stopText}>{t('navigation.stopWalking') || 'Arrêter la marche'}</Text>
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
                                        <Text style={[st.cpTitle, { color: CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type]?.color }]}>
                                            {(() => {
                                                const entry = CHECKPOINT_LABELS[nearbyCheckpoint.checkpoint_type];
                                                const labelObj = entry?.label;
                                                if (!labelObj) return nearbyCheckpoint.checkpoint_type;
                                                return labelObj.labelKey ? (t(labelObj.labelKey) || labelObj.fallback) : labelObj.fallback;
                                            })()} dans {nearbyCheckpoint.distance >= 1000 ? `${(nearbyCheckpoint.distance / 1000).toFixed(1)} km` : `${nearbyCheckpoint.distance} m`}
                                        </Text>
                                        {nearbyCheckpoint.speed_limit && <Text style={st.cpSpeed}>Limite: {nearbyCheckpoint.speed_limit} km/h</Text>}
                                    </View>
                                </View>
                            )}
                            {/* Deviation */}
                            {isOffRoute && (
                                <TouchableOpacity style={st.deviationAlert} onPress={() => { stopTracking(); searchRoutesRef.current(); }}>
                                    <Text style={{ fontSize: 16 }}>⚠️</Text><Text style={st.deviationText}>{t('navigation.offRoute') || 'Hors itinéraire — Appuyez pour recalculer'}</Text>
                                </TouchableOpacity>
                            )}
                            {/* Speed dashboard */}
                            <NativeCard style={st.trackingCard}>
                                <View style={st.trackRow}>
                                    <View style={st.speedGauge}><Text style={st.speedVal}>{Math.round(currentSpeed)}</Text><Text style={st.speedUnit}>km/h</Text></View>
                                    <View style={st.trackMetrics}>
                                        <View style={st.trackMetric}><Text style={{ fontSize: 14 }}>📍</Text><Text style={st.mVal}>{formatDistance(distanceRemaining)}</Text><Text style={st.mLbl}>{t('navigation.remaining') || 'restant'}</Text></View>
                                        <View style={st.trackMetric}><Text style={{ fontSize: 14 }}>⏱</Text><Text style={st.mVal}>{formatDuration(durationRemaining)}</Text><Text style={st.mLbl}>{t('navigation.duration') || 'durée'}</Text></View>
                                        <View style={st.trackMetric}><Text style={{ fontSize: 14 }}>🏁</Text><Text style={[st.mVal, { color: '#10B981' }]}>{liveETA || '--:--'}</Text><Text style={st.mLbl}>{t('navigation.arrival') || 'arrivée'}</Text></View>
                                    </View>
                                </View>
                                {selectedRoute.steps?.[nextStepIndex] && (
                                    <View style={st.nextStep}><Text style={{ fontSize: 18 }}>↪️</Text>
                                        <View style={st.flex1}><Text style={st.nextText} numberOfLines={2}>{selectedRoute.steps[nextStepIndex].instructions}</Text><Text style={st.nextDist}>{t('navigation.inDistance', { dist: formatDistance(selectedRoute.steps[nextStepIndex].distance_meters) }) || `dans ${formatDistance(selectedRoute.steps[nextStepIndex].distance_meters)}`}</Text></View>
                                    </View>
                                )}
                                <View style={st.progressBg}><View style={[st.progressFill, { width: `${Math.max(2, Math.min(100, ((selectedRoute.distance_meters - distanceRemaining) / selectedRoute.distance_meters) * 100))}%` as any }]} /></View>
                            </NativeCard>
                            {/* Map tracking */}
                            {showMap && mapRegion && (
                                <View style={st.mapWrap}>
                                    <AnyMapView ref={mapRef} style={st.mapView} provider={Platform.OS === 'ios' ? PROVIDER_GOOGLE : undefined} initialRegion={mapRegion} showsUserLocation showsTraffic showsCompass loadingEnabled onMapReady={() => console.log('[NavigationScreen] ✅ Map ready (tracking)')} onError={(e: any) => console.error('[NavigationScreen] ❌ Map error (tracking):', e.nativeEvent || e)}>
                                        {routePolylineCoords.length > 1 && <Polyline coordinates={routePolylineCoords} strokeColor={modernColors.primary} strokeWidth={4} />}
                                        {destinationCoords && <Marker coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }} title={t('navigation.destination_marker') || "Destination"} pinColor="#EF4444" tracksViewChanges={false} />}
                                        {livePosition && <Marker coordinate={{ latitude: livePosition.lat, longitude: livePosition.lng }} title={t('navigation.myPositionMarker') || "Ma position"} pinColor="#3B82F6" />}
                                        {checkpoints.slice(0, 10).map(cp => <Marker key={cp.id} coordinate={{ latitude: cp.latitude, longitude: cp.longitude }} title={`${CHECKPOINT_LABELS[cp.checkpoint_type]?.icon || '⚠️'} ${CHECKPOINT_LABELS[cp.checkpoint_type]?.label || cp.checkpoint_type}`} pinColor={CHECKPOINT_LABELS[cp.checkpoint_type]?.color || '#6B7280'} tracksViewChanges={false} />)}
                                    </AnyMapView>
                                    <TouchableOpacity style={st.mapBtnLabeled} onPress={() => { if (livePosition && mapRef.current) mapRef.current.animateToRegion({ latitude: livePosition.lat, longitude: livePosition.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500); }}>
                                        <SafeIcon name="Locate" size={14} color={modernColors.primary} />
                                        <Text style={st.mapBtnLabelTxt}>{t('navigation.myPositionMarker') || 'Ma position'}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <TouchableOpacity style={st.stopBtn} onPress={stopTracking}><Text style={{ fontSize: 16 }}>⏹</Text><Text style={st.stopText}>{t('navigation.stopTracking') || 'Arrêter le suivi'}</Text></TouchableOpacity>
                        </>

                    ) : showActivityStats ? (
                        /* ━━━━━━ MODE: STATISTIQUES ━━━━━━ */
                        <>
                            <View style={st.periodRow}>
                                {(['week', 'month', 'year'] as const).map(p => (
                                    <TouchableOpacity key={p} style={[st.periodBtn, activityPeriod === p && st.periodBtnActive]} onPress={() => { setActivityPeriod(p); loadActivityStats(p); }}>
                                        <Text style={[st.periodText, activityPeriod === p && st.periodTextActive]}>{p === 'week' ? (t('navigation.periodWeek') || 'Semaine') : p === 'month' ? (t('navigation.periodMonth') || 'Mois') : (t('navigation.periodYear') || 'Année')}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={[st.periodRow, { marginTop: -4 }]}>
                                <TouchableOpacity style={[st.periodBtn, statsScope === 'general' && st.periodBtnActive]} onPress={() => setStatsScope('general')}>
                                    <Text style={[st.periodText, statsScope === 'general' && st.periodTextActive]}>{tr('navigation.statsScopeGeneral', 'Général')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[st.periodBtn, statsScope === 'freewalk' && st.periodBtnActive]} onPress={() => setStatsScope('freewalk')}>
                                    <Text style={[st.periodText, statsScope === 'freewalk' && st.periodTextActive]}>{tr('navigation.statsScopeFreeWalk', 'Marches libres')}</Text>
                                </TouchableOpacity>
                                {!freeWalkFilterRange && (
                                    <TouchableOpacity
                                        style={st.periodBtn}
                                        onPress={() => {
                                            const places = (activitySummaryForDisplay?.most_visited_places || []) as any[];
                                            if (places.length === 0) {
                                                Alert.alert(tr('navigation.visitedPlaces', 'Lieux visités'), tr('navigation.noVisitedPlaceForPeriod', 'Aucun lieu visité sur cette période'));
                                                return;
                                            }
                                            const text = places.slice(0, 8).map((p: any, i: number) => `${i + 1}. ${p.name} (${p.visit_count})`).join('\n');
                                            Alert.alert(tr('navigation.mostVisitedPlaces', 'Lieux les plus visités'), text);
                                        }}
                                    >
                                        <Text style={st.periodText}>{tr('navigation.visitedPlaces', 'Lieux visités')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {freeWalkFilterRange && (
                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#10B981', marginBottom: 10 }]}>
                                    <Text style={st.secTitle}>🚶 {tr('navigation.filteredFreeWalkSession', 'Session marche libre filtrée')}</Text>
                                    <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>
                                        {tr('navigation.fromTimeToTime', 'Du {{start}} au {{end}}')
                                            .replace('{{start}}', new Date(freeWalkFilterRange.start).toLocaleTimeString())
                                            .replace('{{end}}', new Date(freeWalkFilterRange.end).toLocaleTimeString())}
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                                        <TouchableOpacity style={[st.prefChip, freeWalkCompareMode === 'last' && st.prefChipActive]} onPress={() => setFreeWalkCompareMode('last')}>
                                            <Text style={st.prefText}>{tr('navigation.compareVsLast', 'vs dernière')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[st.prefChip, freeWalkCompareMode === 'last2' && st.prefChipActive]} onPress={() => setFreeWalkCompareMode('last2')}>
                                            <Text style={st.prefText}>{tr('navigation.compareVsLast2', 'vs 2 dernières')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[st.prefChip, freeWalkCompareMode === 'month' && st.prefChipActive]} onPress={() => setFreeWalkCompareMode('month')}>
                                            <Text style={st.prefText}>{tr('navigation.compareVsMonth', 'vs ce mois')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {freeWalkComparisons?.baseline && (
                                        <View style={{ marginTop: 10, gap: 4 }}>
                                            {[
                                                { l: tr('navigation.metricDistance', 'Distance'), c: freeWalkComparisons.current.total_distance_km || 0, b: freeWalkComparisons.baseline.total_distance_km || 0, u: ' km' },
                                                { l: tr('navigation.metricDuration', 'Durée'), c: freeWalkComparisons.current.total_duration_minutes || 0, b: freeWalkComparisons.baseline.total_duration_minutes || 0, u: ' min' },
                                                { l: tr('navigation.metricCalories', 'Calories'), c: freeWalkComparisons.current.total_calories || 0, b: freeWalkComparisons.baseline.total_calories || 0, u: ' cal' },
                                            ].map((r, i) => {
                                                const delta = r.b > 0 ? ((r.c - r.b) / r.b) * 100 : 0;
                                                const trend = delta > 1 ? '↑' : delta < -1 ? '↓' : '→';
                                                const color = delta > 1 ? '#10B981' : delta < -1 ? '#EF4444' : modernColors.textSecondary;
                                                return (
                                                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>{r.l}</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color }}>{trend} {Math.abs(delta).toFixed(0)}%</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </NativeCard>
                            )}
                            {loadingActivity ? (
                                <NativeCard style={st.loadCard}><ActivityIndicator color={modernColors.primary} /><Text style={st.loadText}>Chargement...</Text></NativeCard>
                            ) : activitySummaryForDisplay ? (
                                <>
                                    {/* Summary */}
                                    <NativeCard style={st.summCard}>
                                        <View style={st.statsGrid}>
                                            {[{ e: '📏', v: (activitySummaryForDisplay.total_distance_km || 0).toFixed(1), l: 'km' }, { e: '🏃', v: activitySummaryForDisplay.total_sessions || 0, l: 'sessions' }, { e: '🔥', v: Math.round(activitySummaryForDisplay.total_calories || 0), l: 'cal' }, { e: '⏱', v: Math.round(activitySummaryForDisplay.total_duration_minutes || 0), l: 'min' }].map((s, i) => (
                                                <React.Fragment key={i}>{i > 0 && <View style={st.statDiv} />}<View style={st.statItem}><Text style={{ fontSize: 20 }}>{s.e}</Text><Text style={st.statVal}>{s.v}</Text><Text style={st.statLbl}>{s.l}</Text></View></React.Fragment>
                                            ))}
                                        </View>
                                    </NativeCard>
                                    {/* ━━ PARTAGE EXTERNE DES STATS ━━ */}
                                    <TouchableOpacity
                                        style={st.shareStatsBtn}
                                        activeOpacity={0.8}
                                        onPress={async () => {
                                            const periodLabel = activityPeriod === 'week' ? (t('navigation.thisWeek') || 'cette semaine') : activityPeriod === 'month' ? (t('navigation.thisMonth') || 'ce mois') : (t('navigation.thisYear') || 'cette année');
                                            const dist = (activitySummaryForDisplay.total_distance_km || 0).toFixed(1);
                                            const sess = activitySummaryForDisplay.total_sessions || 0;
                                            const cal = Math.round(activitySummaryForDisplay.total_calories || 0);
                                            const dur = Math.round(activitySummaryForDisplay.total_duration_minutes || 0);
                                            const best = activitySummaryForDisplay.best_session;
                                            const hs = aiInsights?.health_score;
                                            const freeWalkLabel = freeWalkFilterRange
                                                ? `🚶 ${t('navigation.freeWalkShareTitle') || 'Ma session de marche libre'}`
                                                : `🏃‍♂️ ${t('navigation.myNavStats') || 'Mes stats Yukpo Navigation'} (${periodLabel})`;
                                            let msg = `${freeWalkLabel} :\n\n` +
                                                `📏 ${dist} km\n` +
                                                `🔥 ${cal} ${t('navigation.caloriesBurned') || 'calories brûlées'}\n` +
                                                `⏱ ${dur} ${t('navigation.minutesOfActivity') || "minutes d'activité"}\n` +
                                                `🎯 ${sess} session${sess > 1 ? 's' : ''}`;
                                            if (freeWalkFilterRange) {
                                                msg += `\n🕒 ${t('navigation.sessionWindow') || 'Période'}: ${new Date(freeWalkFilterRange.start).toLocaleTimeString()} → ${new Date(freeWalkFilterRange.end).toLocaleTimeString()}`;
                                            }
                                            if (hs?.score) msg += `\n🫀 ${t('navigation.healthScoreLabel') || 'Score santé'} : ${hs.score}/100 (${hs.label || ''})`;
                                            if (best) msg += `\n🏅 Record : ${best.distance_km?.toFixed(1)} km / ${Math.round(best.duration_minutes || 0)} min`;
                                            msg += `\n\n${t('navigation.installPrompt') || 'Télécharge Yukpo pour suivre tes marches et stats intelligentes :'}\n`;
                                            msg += Platform.OS === 'ios'
                                                ? 'https://apps.apple.com/app/yukpomnang'
                                                : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                            try { await Share.share({ message: msg, title: t('navigation.myNavStats') || 'Mes stats Yukpo Navigation' }); } catch { }
                                        }}
                                    >
                                        <SafeIcon name="share" size={18} color="#fff" />
                                        <View>
                                            <Text style={st.shareStatsTxt}>{freeWalkFilterRange ? (t('navigation.shareFreeWalk') || 'Partager ma marche libre') : (t('navigation.shareMyStats') || 'Partager mes statistiques')}</Text>
                                            <Text style={st.shareStatsSub}>{t('navigation.inviteFriends') || 'Invite tes amis à rejoindre Yukpo !'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    {/* Best session */}
                                    {statsScope === 'general' && !freeWalkFilterRange && activitySummaryForDisplay.best_session && (
                                        <NativeCard style={[st.secCard, { backgroundColor: '#FFFBEB' }]}>
                                            <Text style={st.secTitle}>🏅 {t('navigation.bestSession') || 'Meilleure session'}</Text>
                                            <View style={st.bestRow}>
                                                <Text style={st.bestStat}>{activitySummaryForDisplay.best_session.distance_km?.toFixed(1)} km</Text>
                                                <Text style={st.bestStat}>{Math.round(activitySummaryForDisplay.best_session.duration_minutes || 0)} min</Text>
                                                <Text style={st.bestStat}>⭐ {Math.round(activitySummaryForDisplay.best_session.quality_score)}/100</Text>
                                            </View>
                                        </NativeCard>
                                    )}
                                    {/* By mode */}
                                    {statsScope === 'general' && !freeWalkFilterRange && activitySummaryForDisplay.by_mode?.length > 0 && (
                                        <NativeCard style={st.secCard}>
                                            <Text style={st.secTitle}>🚀 Par mode</Text>
                                            {activitySummaryForDisplay.by_mode.map((m: any, i: number) => {
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
                                                            {mode === 'walking' ? (t('navigation.modeWalking') || 'Marche') : mode === 'bicycling' ? (t('navigation.modeBicycling') || 'Vélo') : mode === 'transit' ? (t('navigation.modeTransit') || 'Transport') : mode === 'driving' ? (t('navigation.modeDriving') || 'Voiture') : (t('navigation.modeUnknown') || 'Inconnu')}
                                                        </Text>
                                                        <Text style={st.modeBdg}>{count}x</Text>
                                                        <Text style={st.modeDst}>{distance.toFixed(1)} km</Text>
                                                    </View>
                                                );
                                            })}
                                        </NativeCard>
                                    )}
                                    {/* ━━ LIEUX VISITÉS ━━ */}
                                    {statsScope === 'general' && !freeWalkFilterRange && activitySummaryForDisplay.most_visited_places?.length > 0 && (
                                        <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#8B5CF6' }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                <Text style={st.secTitle}>📍 {t('navigation.visitedPlaces') || 'Lieux visités'}</Text>
                                                <Text style={{ fontSize: 11, color: modernColors.textSecondary }}>{activityPeriod === 'week' ? (t('navigation.thisWeek') || 'Cette semaine') : activityPeriod === 'month' ? (t('navigation.thisMonth') || 'Ce mois') : (t('navigation.thisYear') || 'Cette année')}</Text>
                                            </View>
                                            {activitySummaryForDisplay.most_visited_places.map((place: any, i: number) => {
                                                const name = typeof place?.name === 'string' ? place.name : (t('navigation.unknownPlace') || 'Lieu inconnu');
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
                                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#8B5CF6' }}>{count} {t('navigation.visits') || 'visite(s)'}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </NativeCard>
                                    )}

                                    {/* ━━ TYPES DE LIEUX FAVORIS ━━ */}
                                    {statsScope === 'general' && !freeWalkFilterRange && activitySummaryForDisplay.favorite_poi_types?.length > 0 && (
                                        <NativeCard style={st.secCard}>
                                            <Text style={st.secTitle}>⭐ Types de lieux favoris</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                                {activitySummaryForDisplay.favorite_poi_types.map((poi: any, i: number) => {
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
                                    {statsScope === 'freewalk' && activityHistoryForDisplay.length > 0 && (
                                        <NativeCard style={st.secCard}>
                                            <Text style={st.secTitle}>📋 {t('navigation.recentActivities') || 'Activités récentes'}</Text>
                                            {activityHistoryForDisplay.slice(0, 5).map((a: any, i: number) => {
                                                // Validation et extraction sécurisée des données
                                                const travelMode = typeof a?.travel_mode === 'string' ? a.travel_mode : 'unknown';
                                                const destination = typeof a?.destination === 'string' ? a.destination : (t('navigation.unknownTrip') || 'Trajet inconnu');
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
                                    {statsScope === 'general' && (
                                        <>
                                            <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
                                                <Text style={st.secTitle}>🌿 {tr('navigation.performanceProgression', 'Performance & progression')}</Text>
                                                {trendVsPrevious ? (
                                                    <Text style={{ fontSize: 13, color: modernColors.textSecondary }}>
                                                        {tr('navigation.recentDistanceVsPrevious', 'Distance récente: {{current}} km vs {{previous}} km')
                                                            .replace('{{current}}', trendVsPrevious.currDist.toFixed(1))
                                                            .replace('{{previous}}', trendVsPrevious.prevDist.toFixed(1))}
                                                        {'  '}
                                                        <Text style={{ color: trendVsPrevious.delta >= 0 ? '#10B981' : '#EF4444', fontWeight: '700' }}>
                                                            {trendVsPrevious.delta >= 0 ? '↑' : '↓'} {Math.abs(trendVsPrevious.delta).toFixed(0)}%
                                                        </Text>
                                                    </Text>
                                                ) : (
                                                    <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>{tr('navigation.notEnoughHistoryForComparison', 'Pas assez d’historique pour la comparaison.')}</Text>
                                                )}
                                                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                                                    <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>{tr('navigation.estimatedCo2Saved', 'CO2 estimé économisé')}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>
                                                        {(((activitySummaryForDisplay?.by_mode || []).reduce((s: number, m: any) => s + ((m?.mode === 'walking' || m?.mode === 'bicycling') ? (Number(m?.distance_km) || 0) : 0), 0)) * 0.12).toFixed(1)} kg
                                                    </Text>
                                                </View>
                                            </NativeCard>
                                            <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#8B5CF6' }]}>
                                                <Text style={st.secTitle}>🎮 {tr('navigation.passiveAutoStats', 'Statistiques passives (détection auto)')}</Text>
                                                <View style={st.statsGrid}>
                                                    {[{ e: '🏃', v: passiveSummary.sessions, l: 'sessions' }, { e: '📏', v: passiveSummary.distanceKm.toFixed(1), l: 'km' }, { e: '🔥', v: Math.round(passiveSummary.calories), l: 'cal' }, { e: '⏱', v: Math.round(passiveSummary.minutes), l: 'min' }].map((s, i) => (
                                                        <React.Fragment key={i}><View style={st.statItem}><Text style={{ fontSize: 18 }}>{s.e}</Text><Text style={st.statVal}>{s.v}</Text><Text style={st.statLbl}>{s.l}</Text></View></React.Fragment>
                                                    ))}
                                                </View>
                                            </NativeCard>
                                        </>
                                    )}
                                    {/* AI Coach */}
                                    {statsScope === 'general' && !freeWalkFilterRange && aiInsights ? (
                                        <>
                                            <View style={st.coachHdr}><Text style={st.coachTitle}>🤖 Coach IA</Text><TouchableOpacity onPress={sharePerformance} style={st.shareBtn}><SafeIcon name="share" size={14} color="#fff" /><Text style={st.shareTxt}>{t('common.share') || 'Partager'}</Text></TouchableOpacity></View>
                                            {/* Health score */}
                                            {aiInsights.health_score && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={st.secTitle}>🫀 {t('navigation.healthScoreLabel') || 'Score Santé'}</Text>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: (aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B') + '15' }}
                                                            onPress={async () => {
                                                                const hs = aiInsights.health_score;
                                                                const bk = hs.breakdown;
                                                                const comment = hs.score >= 80 ? '🎉 Excellent ! Mon mode de vie actif porte ses fruits.'
                                                                    : hs.score >= 60 ? '💪 Bon début ! Je continue mes efforts pour m\'améliorer.'
                                                                        : '🚀 Je démarre mon parcours santé avec le Coach IA Yukpo !';
                                                                let msg = `🫀 ${t('navigation.myHealthScoreYukpo', { score: hs.score, label: hs.label }) || `Mon Score Santé Yukpo : ${hs.score}/100 (${hs.label})`}\n\n`;
                                                                if (bk) msg += `🏃 ${t('navigation.activityLabel') || 'Activité'}: ${bk.activity || 0}/30\n⭐ ${t('navigation.qualityLabel') || 'Qualité'}: ${bk.quality || 0}/20\n🔥 ${t('navigation.streakLabel') || 'Série'}: ${bk.streak || 0}/15\n🌍 ${t('navigation.ecoLabel') || 'Éco'}: ${bk.eco || 0}/10\n\n`;
                                                                msg += `💬 ${comment}\n\n🤖 Coach IA Yukpo\n`;
                                                                msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                                                try { await Share.share({ message: msg, title: '🫀 Mon Score Santé - Yukpo' }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="share" size={12} color={aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B'} />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }}>{t('common.share') || 'Partager'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={{ alignItems: 'center' as any, marginVertical: 12 }}>
                                                        <View style={[st.scoreCircle, { borderColor: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}><Text style={[st.scoreVal, { color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>{aiInsights.health_score.score}</Text><Text style={st.scoreMax}>/100</Text></View>
                                                        <Text style={[st.scoreLbl, { color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>{aiInsights.health_score.label}</Text>
                                                    </View>
                                                    {aiInsights.health_score.breakdown && <View style={{ gap: 6 }}>
                                                        {[
                                                            { l: t('navigation.activityLabel') || 'Activité', p: aiInsights.health_score.breakdown.activity || 0, m: 30, e: '🏃', tip: t('navigation.activityTip') || 'Points gagnés grâce à vos sessions de navigation.' },
                                                            { l: t('navigation.qualityLabel') || 'Qualité', p: aiInsights.health_score.breakdown.quality || 0, m: 20, e: '⭐', tip: t('navigation.qualityTip') || 'Basé sur la qualité de vos trajets.' },
                                                            { l: t('navigation.streakLabel') || 'Série', p: aiInsights.health_score.breakdown.streak || 0, m: 15, e: '🔥', tip: t('navigation.streakTip') || 'Bonus pour votre régularité !' },
                                                            { l: t('navigation.ecoLabel') || 'Éco', p: aiInsights.health_score.breakdown.eco || 0, m: 10, e: '🌍', tip: t('navigation.ecoTip') || 'Points pour vos choix écologiques.' },
                                                        ].map((b, i) => (
                                                            <TouchableOpacity key={i} style={st.brkRow} onPress={() => Alert.alert(`${b.e} ${b.l} — ${b.p}/${b.m} pts`, `${b.tip}\n\n${b.p >= b.m * 0.7 ? `✅ ${t('navigation.goodLevel') || 'Bon niveau ! Continuez ainsi.'}` : `💡 ${t('navigation.pointsRemaining', { count: b.m - b.p }) || `Vous pouvez encore gagner ${b.m - b.p} points.`}`}`)} activeOpacity={0.7}>
                                                                <Text style={{ fontSize: 14 }}>{b.e}</Text><View style={st.brkBarBg}><View style={[st.brkBarFill, { width: `${(b.p / b.m) * 100}%` as any, backgroundColor: b.p >= b.m * 0.7 ? '#10B981' : '#F59E0B' }]} /></View><Text style={st.brkPts}>{b.p}/{b.m}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>}
                                                    {/* ✅ NOUVEAU 2026-03-14: Partage interne score santé */}
                                                    <View style={{ alignItems: 'center', marginTop: 10 }}>
                                                        <InternalShareButton
                                                            payload={{
                                                                contentType: 'health_stats',
                                                                title: t('navigation.healthScoreTitle', { score: aiInsights.health_score.score }) || `Score Santé : ${aiInsights.health_score.score}/100`,
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
                                                            label={t('navigation.sendToFriend') || "Envoyer à un ami"}
                                                            style={{ backgroundColor: (aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B') + '15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
                                                        />
                                                    </View>
                                                </NativeCard>
                                            )}
                                            {/* Tips */}
                                            {aiInsights.ai_tips?.length > 0 && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#8B5CF6' }]}>
                                                    <Text style={st.secTitle}>💡 {t('navigation.tips') || 'Conseils'}</Text>
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
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#F59E0B' }}>{t('common.share') || 'Partager'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={st.streakRow}>
                                                        <TouchableOpacity style={st.streakItem} onPress={() => Alert.alert(`🔥 ${t('navigation.streakInProgress') || 'Série en cours'}`, `${t('navigation.streakMsg', { count: aiInsights.gamification.current_streak }) || `Vous êtes actif depuis ${aiInsights.gamification.current_streak} jour(s) consécutifs !`}\n\n${aiInsights.gamification.current_streak >= 7 ? `🎉 ${t('navigation.streakBravo') || 'Bravo ! Continuez !'}` : `💪 ${t('navigation.streakKeepGoing') || 'Continuez chaque jour !'}`}`, [{ text: 'OK' }])} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 24 }}>🔥</Text><Text style={st.streakVal}>{aiInsights.gamification.current_streak}</Text><Text style={st.streakLbl}>{t('navigation.days') || 'jours'}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={st.streakItem} onPress={() => Alert.alert(`🏆 ${t('navigation.streakRecord') || 'Record'}`, t('navigation.streakRecordMsg', { max: aiInsights.gamification.max_streak, remaining: aiInsights.gamification.max_streak - aiInsights.gamification.current_streak }) || `Record: ${aiInsights.gamification.max_streak} jours`, [{ text: 'OK' }])} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 24 }}>🏆</Text><Text style={st.streakVal}>{aiInsights.gamification.max_streak}</Text><Text style={st.streakLbl}>record</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={st.streakItem} onPress={() => Alert.alert(`⭐ ${t('navigation.pointsTitle') || 'Points'}`, t('navigation.pointsMsg', { total: aiInsights.gamification.total_points }) || `${aiInsights.gamification.total_points} points`, [{ text: 'OK' }])} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 24 }}>⭐</Text><Text style={st.streakVal}>{aiInsights.gamification.total_points}</Text><Text style={st.streakLbl}>points</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    {aiInsights.gamification.badges?.length > 0 && <View style={st.badgesWrap}>{aiInsights.gamification.badges.map((b: any, i: number) => (
                                                        <TouchableOpacity key={i} style={st.badge} onPress={() => Alert.alert(`${b.emoji} ${b.label}`, b.description || `${t('navigation.badgeUnlocked') || 'Badge débloqué !'} ${b.label}`, [{ text: t('common.share'), onPress: sharePerformance }, { text: 'OK' }])} activeOpacity={0.7}>
                                                            <Text style={{ fontSize: 20 }}>{b.emoji}</Text><Text style={st.badgeLbl} numberOfLines={1}>{b.label}</Text>
                                                        </TouchableOpacity>
                                                    ))}</View>}
                                                </NativeCard>
                                            )}
                                            {/* CO2 */}
                                            {aiInsights.co2_impact && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                        <Text style={st.secTitle}>🌍 {t('navigation.environmentalImpact') || 'Impact Environnemental'}</Text>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#10B98115' }}
                                                        onPress={async () => {
                                                                const co2 = aiInsights.co2_impact;
                                                                const curr = co2?.currency_symbol || aiInsights.geo_context?.currency_symbol || 'FCFA';
                                                                const emittedKg = co2KgFromImpact(co2, 'emitted');
                                                                const savedKg = co2KgFromImpact(co2, 'saved');
                                                                const msg = `🌍 Mon impact environnemental (Yukpo Navigation)\n\n` +
                                                                    `💨 ${emittedKg.toFixed(1)} kg de CO2 émis\n` +
                                                                    `🌱 ${savedKg.toFixed(1)} kg de CO2 économisés\n` +
                                                                    `🌳 ${(co2?.trees_equivalent || 0).toFixed(1)} arbres équivalents\n` +
                                                                    `💰 ${Math.round(co2?.fuel_cost_saved || co2?.fuel_cost_saved_fcfa || 0)} ${curr} économisés\n\n` +
                                                                    `♻️ Rejoins-moi sur Yukpo pour réduire ton empreinte carbone ! 🚀`;
                                                                try { await Share.share({ message: msg, title: '🌍 Mon impact - Yukpo' }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="share" size={12} color="#10B981" />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#10B981' }}>{t('common.share') || 'Partager'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={st.co2Grid}>
                                                        <TouchableOpacity
                                                            style={st.co2Item}
                                                            onPress={() => {
                                                                const emittedKg = co2KgFromImpact(aiInsights.co2_impact, 'emitted');
                                                                Alert.alert('💨 CO2 Émis', `Vous avez émis ${emittedKg.toFixed(1)} kg de CO2.\n\nAstuce : Privilégiez la marche ou les transports en commun pour réduire vos émissions !`);
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Text style={{ fontSize: 22 }}>💨</Text>
                                                            <Text style={st.co2Val}>{co2KgFromImpact(aiInsights.co2_impact, 'emitted').toFixed(1)}</Text>
                                                            <Text style={st.co2Lbl}>kg émis</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={st.co2Item}
                                                            onPress={() => {
                                                                const savedKg = co2KgFromImpact(aiInsights.co2_impact, 'saved');
                                                                Alert.alert('🌱 CO2 Économisé', `Vous avez économisé ${savedKg.toFixed(1)} kg de CO2 en choisissant des modes de transport écologiques.\n\nBravo ! Continuez ainsi ! 🎉`);
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Text style={{ fontSize: 22 }}>🌱</Text>
                                                            <Text style={[st.co2Val, { color: '#10B981' }]}>{co2KgFromImpact(aiInsights.co2_impact, 'saved').toFixed(1)}</Text>
                                                            <Text style={st.co2Lbl}>kg éco.</Text>
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
                                                        <Text style={st.secTitle}>❤️ {t('navigation.fitnessCondition') || 'Condition Physique'}</Text>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EF444415' }}
                                                            onPress={async () => {
                                                                const vo2 = aiInsights.fitness.vo2max_estimate;
                                                                const level = aiInsights.fitness.level || (t('navigation.notRated') || 'Non évalué');
                                                                const comment = vo2 >= 50 ? '🏅 Niveau athlétique ! Mon VO2max est au top.'
                                                                    : vo2 >= 40 ? '💪 Bonne forme ! En route vers l\'excellence.'
                                                                        : vo2 >= 30 ? '🏃 Je progresse ! Chaque trajet me rapproche de mes objectifs.'
                                                                            : '🚀 Je démarre mon parcours fitness avec Yukpo !';
                                                                const msg = `❤️ Ma Condition Physique - Coach IA Yukpo\n\n` +
                                                                    `💪 VO2max : ${vo2} ml/kg/min\n` +
                                                                    `📊 Niveau : ${level}\n\n` +
                                                                    `💬 ${comment}\n\n` +
                                                                    `🤖 Analyse par le Coach IA Yukpo Navigation\n` +
                                                                    (Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang');
                                                                try { await Share.share({ message: msg, title: '❤️ Ma Condition Physique - Yukpo' }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="share" size={12} color="#EF4444" />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#EF4444' }}>{t('common.share') || 'Partager'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={{ alignItems: 'center' as any, marginVertical: 8 }}
                                                        onPress={() => {
                                                            const vo2 = aiInsights.fitness.vo2max_estimate;
                                                            const level = aiInsights.fitness.level || (t('navigation.notRated') || 'Non évalué');
                                                            const advice = vo2 >= 50 ? 'Excellent ! Maintenez cette cadence avec des sessions régulières.'
                                                                : vo2 >= 40 ? 'Bon niveau ! Essayez d\'augmenter la fréquence de vos marches.'
                                                                    : vo2 >= 30 ? 'Niveau moyen. Commencez par 30 min de marche rapide 3x/semaine.'
                                                                        : 'Débutant. Commencez doucement avec 15 min de marche par jour.';
                                                            Alert.alert(
                                                                `❤️ VO2max : ${vo2} ml/kg/min`,
                                                                `Niveau : ${level}\n\n📊 Qu'est-ce que le VO2max ?\nC'est la quantité maximale d'oxygène que votre corps peut utiliser pendant l'effort. Plus il est élevé, meilleure est votre endurance.\n\n💡 Conseil :\n${advice}\n\n📈 Barème :\n• < 30 : Débutant\n• 30-40 : Moyen\n• 40-50 : Bon\n• > 50 : Excellent`,
                                                                [
                                                                    { text: t('navigation.planWalk') || 'Planifier une marche', onPress: () => { setShowActivityStats(false); } },
                                                                    { text: 'OK' }
                                                                ]
                                                            );
                                                        }}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={st.vo2Val}>{aiInsights.fitness.vo2max_estimate}</Text><Text style={st.vo2Unit}>VO2max (ml/kg/min)</Text>
                                                        <View style={[st.fitLevel, { backgroundColor: aiInsights.fitness.level === 'Excellent' ? '#10B98120' : '#F59E0B20' }]}><Text style={[st.fitLevelTxt, { color: aiInsights.fitness.level === 'Excellent' ? '#10B981' : '#F59E0B' }]}>{aiInsights.fitness.level}</Text></View>
                                                        <Text style={{ fontSize: 11, color: modernColors.textSecondary, marginTop: 6 }}>Appuyez pour en savoir plus</Text>
                                                    </TouchableOpacity>
                                                </NativeCard>
                                            )}
                                            {/* Challenges */}
                                            {aiInsights.challenges?.length > 0 && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={st.secTitle}>🎯 {t('navigation.challenges') || 'Défis'}</Text>
                                                        <TouchableOpacity
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#3B82F615' }}
                                                            onPress={async () => {
                                                                const completed = aiInsights.challenges.filter((c: any) => c.completed).length;
                                                                const total = aiInsights.challenges.length;
                                                                const comment = completed === total ? '🏆 Tous mes défis sont terminés ! Prêt pour la suite.'
                                                                    : completed > 0 ? `💪 ${completed}/${total} défis terminés, je continue !`
                                                                        : '🎯 J\'ai des défis à relever, motivé(e) !';
                                                                let msg = `🎯 Mes Défis Coach IA Yukpo\n\n`;
                                                                aiInsights.challenges.forEach((c: any) => { msg += `${c.emoji || '🎯'} ${c.label} — ${Math.round(c.progress)}% ${c.completed ? '✅' : ''}\n`; });
                                                                msg += `\n💬 ${comment}\n\n🤖 Généré par le Coach IA Yukpo\n`;
                                                                msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                                                try { await Share.share({ message: msg, title: '🎯 Mes Défis - Yukpo' }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="Redo2" size={12} color="#3B82F6" />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#3B82F6' }}>{t('common.share') || 'Partager'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    {aiInsights.challenges.map((c: any, i: number) => (
                                                        <TouchableOpacity
                                                            key={i}
                                                            style={{ marginBottom: 12 }}
                                                            onPress={() => {
                                                                Alert.alert(
                                                                    c.label,
                                                                    `Progression: ${Math.round(c.progress)}%\n${c.completed ? '✅ Défi terminé !' : '🎯 Continuez vos efforts !'}`,
                                                                    [
                                                                        { text: 'OK', style: 'default' },
                                                                        ...(c.action_url ? [{ text: 'Voir les détails', onPress: () => Linking.openURL(c.action_url) }] : [])
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
                                                                const comment = recordCount >= 3 ? '🔥 Impressionnant ! Mes records parlent d\'eux-mêmes.'
                                                                    : recordCount >= 1 ? '💪 En route pour battre encore plus de records !'
                                                                        : '🚀 Les premiers records arrivent bientôt !';
                                                                msg += `\n💬 ${comment}\n\n🤖 Suivi par le Coach IA Yukpo\n`;
                                                                msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                                                try { await Share.share({ message: msg, title: '🏅 Mes Records - Yukpo' }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="Redo2" size={12} color="#D4A017" />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#D4A017' }}>{t('common.share') || 'Partager'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    {[
                                                        aiInsights.personal_records.longest_session_km && { e: '📏', t: t('navigation.recordLongest') || 'Plus longue', v: `${aiInsights.personal_records.longest_session_km} km` },
                                                        aiInsights.personal_records.fastest_speed_kmh && { e: '⚡', t: t('navigation.recordFastest') || 'Vitesse max', v: `${aiInsights.personal_records.fastest_speed_kmh} km/h` },
                                                        aiInsights.personal_records.most_calories && { e: '🔥', t: t('navigation.recordCalories') || 'Max calories', v: `${aiInsights.personal_records.most_calories} cal` },
                                                    ].filter(Boolean).map((r: any, i: number) => (
                                                        <TouchableOpacity
                                                            key={i}
                                                            style={st.recRow}
                                                            onPress={() => {
                                                                Alert.alert(
                                                                    r.t,
                                                                    `🏅 Record personnel : ${r.v}\nFélicitations pour cette performance !`,
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
                                            )}
                                            {/* Commute */}
                                            {aiInsights.commute_insights?.frequent_routes?.length > 0 && (
                                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#6366F1' }]}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={st.secTitle}>🏠 {t('navigation.frequentTrips') || 'Trajets Habituels'}</Text>
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
                                                                const comment = routes.length >= 3 ? '🗺️ Le Coach IA connaît bien mes habitudes de déplacement !'
                                                                    : '📊 Mes premiers trajets fréquents sont identifiés.';
                                                                msg += `\n💬 ${comment}\n\n🤖 Analyse par le Coach IA Yukpo\n`;
                                                                msg += Platform.OS === 'ios' ? 'https://apps.apple.com/app/yukpomnang' : 'https://play.google.com/store/apps/details?id=com.yukpomnang';
                                                                try { await Share.share({ message: msg, title: '🏠 Mes Trajets - Yukpo' }); } catch { }
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SafeIcon name="Redo2" size={12} color="#6366F1" />
                                                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#6366F1' }}>{t('common.share') || 'Partager'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    {aiInsights.commute_insights.frequent_routes.map((r: any, i: number) => (
                                                        <TouchableOpacity
                                                            key={i}
                                                            style={st.comRow}
                                                            onPress={() => {
                                                                Alert.alert(
                                                                    t('navigation.frequentTrip') || 'Trajet fréquent',
                                                                    `📍 ${r.from} → ${r.to}\n🔄 Fréquence: ${r.count} fois\n🕐 Heures de pointe: ${aiInsights.commute_insights.peak_departure_hours?.slice(0, 2).map((h: any) => typeof h === 'number' ? `${h}h` : `${h.hour}h`).join(', ') || 'N/A'}`,
                                                                    [
                                                                        {
                                                                            text: t('navigation.startNavigation') || 'Démarrer la navigation', onPress: () => {
                                                                                setShowActivityStats(false);
                                                                                if (r.to) setDestination(r.to);
                                                                            }
                                                                        },
                                                                        {
                                                                            text: t('navigation.viewDetails') || 'Voir les détails', onPress: () => {
                                                                                Alert.alert(t('navigation.details') || 'Détails', `${t('navigation.avgDistance') || 'Distance moyenne'}: ${r.avg_distance_km || 'N/A'} km\n${t('navigation.avgDuration') || 'Durée moyenne'}: ${r.avg_duration_min || 'N/A'} min`);
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
                                                    ))}
                                                    {aiInsights.commute_insights.peak_departure_hours?.length > 0 && (
                                                        <View style={{ marginTop: 10 }}><Text style={st.peakTitle}>🕐 Heures de pointe</Text>
                                                            <View style={st.peakRow}>{aiInsights.commute_insights.peak_departure_hours.slice(0, 4).map((h: any, i: number) => <View key={i} style={st.peakBdg}><Text style={st.peakHr}>{typeof h === 'number' ? `${h}h` : `${h.hour}h`}</Text></View>)}</View>
                                                        </View>
                                                    )}
                                                </NativeCard>
                                            )}
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
                                                    <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>{t('navigation.startTripToActivate') || "Commencez un trajet pour activer l'analyse"}</Text>
                                                </View>
                                            </View>
                                            {[
                                                { emoji: '🌍', title: t('navigation.environmentalImpact') || 'Impact Environnemental', desc: t('navigation.envImpactDesc') || 'CO2 économisé, arbres équivalents', color: '#10B981', action: () => Alert.alert(`🌍 ${t('navigation.environmentalImpact') || 'Impact Environnemental'}`, t('navigation.envImpactInfo') || 'Effectuez votre premier trajet pour commencer à mesurer votre empreinte carbone.', [{ text: t('navigation.startTrip') || 'Commencer un trajet', onPress: () => { setShowActivityStats(false); } }, { text: 'OK' }]) },
                                                { emoji: '❤️', title: t('navigation.fitnessCondition') || 'Condition Physique', desc: t('navigation.fitnessDesc') || 'VO2max, calories, niveau fitness', color: '#EF4444', action: () => Alert.alert(`❤️ ${t('navigation.fitnessCondition') || 'Condition Physique'}`, t('navigation.fitnessInfo') || 'Le Coach IA estime votre VO2max.', [{ text: t('navigation.planWalk') || 'Planifier une marche', onPress: () => { setShowActivityStats(false); } }, { text: 'OK' }]) },
                                                { emoji: '🎯', title: t('navigation.personalizedChallenges') || 'Défis Personnalisés', desc: t('navigation.challengesDesc') || 'Objectifs adaptés à votre niveau', color: '#3B82F6', action: () => Alert.alert(`🎯 ${t('navigation.personalizedChallenges') || 'Défis Personnalisés'}`, t('navigation.challengesInfo') || 'Le Coach IA crée des défis sur mesure.', [{ text: 'OK' }]) },
                                                { emoji: '🏅', title: 'Records & Badges', desc: t('navigation.recordsDesc') || 'Performances et récompenses', color: '#FFD700', action: () => Alert.alert('🏅 Records & Badges', t('navigation.recordsInfo') || 'Le Coach IA suit vos records automatiquement.', [{ text: 'OK' }]) },
                                                { emoji: '🏠', title: t('navigation.frequentTrips') || 'Trajets Habituels', desc: t('navigation.frequentTripsDesc') || 'Routes fréquentes, heures de pointe', color: '#6366F1', action: () => Alert.alert(`🏠 ${t('navigation.frequentTrips') || 'Trajets Habituels'}`, t('navigation.frequentTripsInfo') || 'Le Coach IA identifie vos routes fréquentes.', [{ text: 'OK' }]) },
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
                                                        <Text style={st.aiActivateBtnText}>Charger mes données</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </NativeCard>
                                    )}
                                    <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#7C3AED' }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Text style={st.secTitle}>📝 Historique Coach IA</Text>
                                            {coachingNotifHistory.some(n => !n.read) && (
                                                <TouchableOpacity
                                                    onPress={async () => {
                                                        await coachingNotificationService.markAllAsRead();
                                                        await loadCoachingNotificationHistory();
                                                    }}
                                                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#7C3AED15' }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>Tout lu</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        {loadingCoachingHistory ? (
                                            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                                                <ActivityIndicator color={modernColors.primary} />
                                                <Text style={{ marginTop: 6, fontSize: 12, color: modernColors.textSecondary }}>Chargement historique...</Text>
                                            </View>
                                        ) : coachingNotifHistory.length === 0 ? (
                                            <Text style={{ fontSize: 12, color: modernColors.textSecondary }}>
                                                Aucune notification Coach IA enregistrée pour le moment.
                                            </Text>
                                        ) : (
                                            coachingNotifHistory.slice(0, 8).map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={{ paddingVertical: 9, borderTopWidth: 1, borderTopColor: modernColors.border }}
                                                    activeOpacity={0.7}
                                                    onPress={async () => {
                                                        await coachingNotificationService.markAsRead(item.id);
                                                        await loadCoachingNotificationHistory();
                                                    }}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' }} />}
                                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: item.read ? '600' : '800', color: modernColors.text }} numberOfLines={1}>
                                                            {item.title}
                                                        </Text>
                                                        <Text style={{ fontSize: 10, color: modernColors.textSecondary }}>
                                                            {new Date(item.timestamp).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                    <Text style={{ marginTop: 3, marginLeft: item.read ? 0 : 16, fontSize: 12, color: modernColors.textSecondary }} numberOfLines={2}>
                                                        {item.body}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))
                                        )}
                                    </NativeCard>
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
                                            placeholder="Où allez-vous ?"
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
                                        <><Text style={{ fontSize: 16 }}>🔍</Text><Text style={st.searchBtnTxt}> Trouver mon itinéraire</Text></>
                                    }
                                </TouchableOpacity>
                                {destinationCoords && (
                                    <View style={st.destActions}>
                                        <TouchableOpacity style={st.actChip} onPress={() => Alert.alert(t('navigation.destinationSaved'), '', [{ text: '🏠 Domicile', onPress: () => saveDestination('domicile') }, { text: '💼 Bureau', onPress: () => saveDestination('bureau') }, { text: '⭐ Favori', onPress: () => saveDestination('autre', destination.substring(0, 30) || 'Favori') }, { text: t('message.cancel'), style: 'cancel' }])}>
                                            <Text style={{ fontSize: 12 }}>🔖</Text>
                                            <Text style={st.actChipTxt}>Enregistrer</Text>
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
                                            <Text style={st.actChipTxt}>Étape</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </NativeCard>

                            {/* ━━ INDICATEUR TRACKING PASSIF (discret) ━━ */}
                            {passiveTrackingActive && (
                                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 8, borderRadius: 999, backgroundColor: '#10B98112', borderWidth: 1, borderColor: '#10B98130' }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                                    <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700' }}>Suivi automatique actif</Text>
                                </View>
                            )}

                            {/* Travel modes */}
                            <View style={st.modeSelector}>
                                {TRAVEL_MODES.map(m => (
                                    <TouchableOpacity key={m.key} style={[st.modeBtn, travelMode === m.key && { backgroundColor: m.color + '15', borderColor: m.color }]}
                                        onPress={() => { setTravelMode(m.key); if (routes.length > 0) setTimeout(() => searchRoutesRef.current(), 100); }}>
                                        <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                                        <Text style={[st.modeBtnLbl, travelMode === m.key && { color: m.color, fontWeight: '700' as any }]} numberOfLines={1}>
                                            {m.label?.labelKey ? (t(m.label.labelKey) || m.label.fallback) : (m.label?.fallback || '')}
                                        </Text>
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
                                    <Text style={st.secTitle}>🎚️ {t('navigation.preferences') || 'Préférences'}</Text>
                                    <View style={st.prefsRow}>
                                        {[{ k: 'tolls', l: t('navigation.avoidTolls') || 'Péages', v: avoidTolls, s: setAvoidTolls }, { k: 'highways', l: t('navigation.avoidHighways') || 'Autoroutes', v: avoidHighways, s: setAvoidHighways }, { k: 'ferries', l: t('navigation.avoidFerries') || 'Ferries', v: avoidFerries, s: setAvoidFerries }].map(p => (
                                            <TouchableOpacity key={p.k} style={[st.prefChip, p.v && st.prefChipActive]} onPress={() => p.s(!p.v)}>
                                                <Text style={[st.prefText, p.v && { color: '#EF4444' }]}>{t('navigation.avoid') || 'Éviter'} {p.l.toLowerCase()}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </NativeCard>
                            )}

                            {/* Waypoints */}
                            {waypoints.length > 0 && (
                                <NativeCard style={st.wpCard}>
                                    <View style={st.row8}><Text style={{ fontSize: 16 }}>📍</Text><Text style={st.wpTitle}>Étapes ({waypoints.length})</Text>
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
                                                    onPress={() => { setSelectedRoute(route); }} activeOpacity={0.8}>
                                                    <View style={st.routeCardTop}>
                                                        <View style={st.row8}>
                                                            <View style={[st.trafficDot, { backgroundColor: getTrafficColor(route.traffic_level) }]} />
                                                            <Text style={[st.trafficLbl, { color: getTrafficColor(route.traffic_level) }]}>{getTrafficLabel(route.traffic_level)}</Text>
                                                        </View>
                                                        {idx === 0 && <View style={st.recBadge}><Text style={st.recText}>Recommandé</Text></View>}
                                                    </View>
                                                    <Text style={st.routeSummary} numberOfLines={1}>{route.summary}</Text>
                                                    <View style={st.routeMetrics}>
                                                        <Text style={st.routeMetric}>📏 {formatDistance(route.distance_meters)}</Text>
                                                        <Text style={st.routeMetric}>⏱ {formatDuration(dur)}</Text>
                                                        {getRouteEtaLabel(route) && <Text style={st.routeMetric}>🏁 {getRouteEtaLabel(route)}</Text>}
                                                    </View>
                                                    {route.fare && <View style={st.fareBadge}><Text style={st.fareText}>{route.fare.text}</Text></View>}
                                                    {route.warnings?.slice(0, 1).map((w, wi) => <Text key={wi} style={st.warnText} numberOfLines={1}>⚠️ {w}</Text>)}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Map preview supprimée : afficher seulement via "Suivi en temps réel" */}

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
                                    <Text style={st.secTitle}>🚨 {t('navigation.reportsOnRoute') || 'Signalements sur le trajet'}</Text>
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
                                    {!poiRequested ? (
                                        <NativeCard style={st.secCard}>
                                            <Text style={st.secTitle}>{tr('navigation.selectPoiCategories', 'Choisissez vos points d\'intérêt')}</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                                {Object.entries(POI_CATEGORIES).map(([catKey, cat]) => {
                                                    const selected = poiSelectedCategories.includes(catKey);
                                                    const label = cat.label?.labelKey ? (t(cat.label.labelKey) || cat.label.fallback) : (cat.label?.fallback || catKey);
                                                    return (
                                                        <TouchableOpacity
                                                            key={catKey}
                                                            style={[
                                                                st.actChip,
                                                                selected && { backgroundColor: cat.color + '20', borderColor: cat.color, borderWidth: 1 },
                                                            ]}
                                                            activeOpacity={0.7}
                                                            onPress={() => {
                                                                setPoiSelectedCategories(prev => selected ? prev.filter(k => k !== catKey) : [...prev, catKey]);
                                                            }}
                                                        >
                                                            <Text style={[st.actChipTxt, selected && { color: cat.color }]} numberOfLines={1}>
                                                                {selected ? '✓ ' : ''}{label}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>

                                            <TouchableOpacity
                                                style={[
                                                    st.shareRouteBtn,
                                                    {
                                                        backgroundColor: poiSelectedCategories.length > 0 ? modernColors.primary : modernColors.surfaceVariant,
                                                        borderColor: poiSelectedCategories.length > 0 ? modernColors.primary : modernColors.border,
                                                        opacity: poiSelectedCategories.length > 0 ? 1 : 0.7,
                                                    },
                                                ]}
                                                disabled={poiSelectedCategories.length === 0}
                                                onPress={() => loadPointsOfInterestSafely(selectedRoute, poiSelectedCategories)}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: '600',
                                                        color: poiSelectedCategories.length > 0 ? '#FFFFFF' : modernColors.primary,
                                                    }}
                                                >
                                                    {loadingPOI ? tr('navigation.searchingPOI', 'Recherche des POI...') : tr('navigation.showPOI', 'Afficher les POI')}
                                                </Text>
                                            </TouchableOpacity>
                                        </NativeCard>
                                    ) : (
                                        <>
                                            <Text style={st.secTitle}>{tr('navigation.poiNearby', 'Points d\'intérêt à proximité')}</Text>
                                            {loadingPOI ? (
                                                <NativeCard style={st.loadCard}>
                                                    <ActivityIndicator color={modernColors.primary} />
                                                    <Text style={st.loadText}>{t('navigation.searchingPOI') || 'Recherche des POI...'}</Text>
                                                </NativeCard>
                                            ) : pointsOfInterest.length === 0 ? (
                                                <NativeCard style={st.emptyCard}><Text style={st.emptyText}>{t('navigation.noPOIFound') || 'Aucun POI trouvé'}</Text></NativeCard>
                                            ) : (
                                                Object.entries(POI_CATEGORIES)
                                                    .filter(([catKey]) => poiSelectedCategories.length === 0 ? true : poiSelectedCategories.includes(catKey))
                                                    .map(([catKey, cat]) => {
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
                                                                        <Text style={st.poiCatLabel}>
                                                                            {cat.label?.labelKey ? (t(cat.label.labelKey) || cat.label.fallback) : (cat.label?.fallback || '')}
                                                                        </Text>
                                                                        <Text style={st.poiCatCount}>{pois.length} lieu{pois.length > 1 ? 'x' : ''} trouvé{pois.length > 1 ? 's' : ''} sur le trajet</Text>
                                                                    </View>
                                                                    <View style={[st.poiExpandBadge, { backgroundColor: expanded ? cat.color + '20' : modernColors.surfaceVariant }]}>
                                                                        <SafeIcon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={16} color={expanded ? cat.color : modernColors.textSecondary} />
                                                                    </View>
                                                                </TouchableOpacity>
                                                                {expanded && visiblePois.map((poi, idx) => {
                                                                    const displayName = typeof poi.name === 'string' ? poi.name : (typeof poi.name === 'object' && poi.name !== null ? (poi.name as any).name || (poi.name as any).text || JSON.stringify(poi.name) : (t('navigation.unknownName') || 'Nom inconnu'));
                                                                    return (
                                                                        <View key={poi.id || `poi-${catKey}-${idx}`} style={st.poiItem}>
                                                                            <View style={st.flex1}>
                                                                                <Text style={st.poiName}>{displayName}</Text>
                                                                                {poi.address && <Text style={st.poiAddr} numberOfLines={1}>{poi.address}</Text>}
                                                                                <View style={st.poiMeta}>
                                                                                    <Text style={st.poiDist}>{formatDistance(poi.distance_from_route_meters)}</Text>
                                                                                    {poi.rating != null && poi.rating > 0 && <Text style={st.poiRating}>⭐ {poi.rating}{poi.total_ratings ? ` (${poi.total_ratings})` : ''}</Text>}
                                                                                    {poi.price_level != null && poi.price_level > 0 && <Text style={st.poiPrice}>{'💰'.repeat(poi.price_level)}</Text>}
                                                                                    {poi.is_open != null && <View style={[st.openBadge, { backgroundColor: poi.is_open ? '#DCFCE7' : '#FEE2E2' }]}><Text style={[st.openText, { color: poi.is_open ? '#16A34A' : '#EF4444' }]}>{poi.is_open ? (t('navigation.poiOpen') || 'Ouvert') : (t('navigation.poiClosed') || 'Fermé')}</Text></View>}
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
                                                                        <Text style={[st.poiShowMoreTxt, { color: cat.color }]}>Réduire</Text>
                                                                        <SafeIcon name="ChevronUp" size={14} color={cat.color} />
                                                                    </TouchableOpacity>
                                                                )}
                                                            </NativeCard>
                                                        );
                                                    })
                                            )}
                                        </>
                                    )}
                                </View>
                            )}

                            {/* Go buttons */}
                            {selectedRoute && (
                                <View style={st.goSection}>
                                    <TouchableOpacity style={st.shareRouteBtn} onPress={shareRoute} activeOpacity={0.7}>
                                        <SafeIcon name="share" size={16} color={modernColors.primary} /><Text style={st.shareRouteTxt}>{tr('navigation.shareRoute', 'Partager l\'itinéraire')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={st.goBtn} onPress={startTracking} activeOpacity={0.8}>
                                        <Text style={{ fontSize: 20 }}>📡</Text>
                                        <View><Text style={st.goBtnText}>Suivi en temps réel</Text><Text style={st.goBtnSub}>Vitesse, radars, progression</Text></View>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* ━━ APERÇU SANTÉ & COACH IA ━━ */}
                            {user && !isTracking && aiInsights && (
                                <NativeCard style={[st.secCard, { borderLeftWidth: 4, borderLeftColor: '#7C3AED' }]}>
                                    <TouchableOpacity style={st.healthPreviewRow} onPress={() => { setShowActivityStats(true); loadActivityStats(activityPeriod); }} activeOpacity={0.7}>
                                        <View style={st.healthPreviewIcon}><Text style={{ fontSize: 24 }}>🫀</Text></View>
                                        <View style={st.flex1}>
                                            <Text style={st.healthPreviewTitle}>Score Santé & Coach IA</Text>
                                            <View style={st.healthPreviewStats}>
                                                {aiInsights.health_score && <Text style={[st.healthPreviewStat, { color: aiInsights.health_score.score >= 80 ? '#10B981' : '#F59E0B' }]}>❤️ {aiInsights.health_score.score}/100</Text>}
                                                {aiInsights.gamification && <Text style={st.healthPreviewStat}>🔥 {aiInsights.gamification.current_streak}j</Text>}
                                {aiInsights.co2_impact && <Text style={st.healthPreviewStat}>🌿 {co2KgFromImpact(aiInsights.co2_impact, 'saved').toFixed(1)} kg</Text>}
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
                                        <Text style={st.healthPreviewTitle}>Statistiques & Coach IA</Text>
                                        <Text style={st.healthPreviewSub}>VO2max, défis, CO2, badges, conseils...</Text>
                                    </View>
                                    <SafeIcon name="ChevronRight" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </ScrollView>
                {alertToast.visible && (
                    <Animated.View style={[st.alertToastWrap, { opacity: alertToastAnim, transform: [{ translateY: alertToastAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }]}>
                        <View style={[st.alertToastInner, { borderLeftColor: alertToast.color }]}>
                            <Text style={{ fontSize: 22 }}>{alertToast.icon}</Text>
                            <Text style={st.alertToastMsg}>{alertToast.message}</Text>
                            <Text style={{ fontSize: 14 }}>✅</Text>
                        </View>
                    </Animated.View>
                )}
            </KeyboardAvoidingView>
            <IntelligentChatFab
                onPress={() => setShowNavChat(true)}
                visible={!showNavChat && !showActivityStats && !showAlertHistory}
                screenName="Navigation"
            />
            <IntelligentChat
                visible={showNavChat}
                onClose={() => setShowNavChat(false)}
                screenContext={{
                    screenName: 'Navigation',
                    screenType: 'specialized',
                    guideText: t('intelligentChat.navigation.screenGuide') || 'Navigation intelligente : itinéraires, alertes, POI, stats, Coach IA.',
                    availableActions: [
                        {
                            id: 'coach-notif-settings',
                            label: t('intelligentChat.navigation.openNotifSettings') || 'Notifications (réglages)',
                            icon: 'settings',
                            route: 'Settings',
                            params: { initialSection: 'notifications' },
                            category: 'navigation',
                            description: '',
                        },
                    ],
                }}
            />
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
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center', justifyContent: 'center' },
    headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: modernColors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: modernColors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: modernColors.text },
    headerSub: { fontSize: 13, color: modernColors.textSecondary, marginTop: 1 },
    headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    headerBtnSmall: { width: 32, height: 32, borderRadius: 10, backgroundColor: modernColors.surface, borderWidth: 1.5, borderColor: modernColors.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    headerBtnActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    headerBtnWalkActive: { backgroundColor: '#10B98115', borderColor: '#10B981' },
    headerBtnAlertActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
    walkLiveDot: { position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
    alertBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
    alertBadgeSmall: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
    alertBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF', lineHeight: 10 },

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
    originRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    originDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#DCFCE7' },
    routeLine: { width: 2, height: 14, backgroundColor: modernColors.border, marginLeft: 5, marginVertical: 2 },
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
