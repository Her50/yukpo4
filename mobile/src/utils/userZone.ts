// ✅ NOUVEAU: Service pour récupérer la zone géographique de l'utilisateur
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import * as Location from 'expo-location';
import SafeStorage from './safeStorage';

// Mapping pays code ISO → emoji/drapeau
const COUNTRY_CODE_MAP: Record<string, string> = {
    'CM': '\uD83C\uDDE8\uD83C\uDDF2', // Cameroun
    'CI': '\uD83C\uDDE8\uD83C\uDDEE', // Côte d'Ivoire
    'SN': '\uD83C\uDDF8\uD83C\uDDF3', // Sénégal
    'BF': '\uD83C\uDDE7\uD83C\uDDEB', // Burkina Faso
    'ML': '\uD83C\uDDF2\uD83C\uDDF1', // Mali
    'TG': '\uD83C\uDDF9\uD83C\uDDEC', // Togo
    'BJ': '\uD83C\uDDE7\uD83C\uDDEF', // Bénin
    'NE': '\uD83C\uDDF3\uD83C\uDDEA', // Niger
    'CD': '\uD83C\uDDE8\uD83C\uDDE9', // République Démocratique du Congo
    'CG': '\uD83C\uDDE8\uD83C\uDDEC', // République du Congo
    'GA': '\uD83C\uDDEC\uD83C\uDDE6', // Gabon
    'TD': '\uD83C\uDDF9\uD83C\uDDE9', // Tchad
    'CF': '\uD83C\uDDE8\uD83C\uDDEB', // République centrafricaine
    'GQ': '\uD83C\uDDEC\uD83C\uDDF6', // Guinée équatoriale
    'MG': '\uD83C\uDDF2\uD83C\uDDEC', // Madagascar
};

// Pays francophones africains avec leurs coordonnées approximatives
const COUNTRY_BOUNDS: Record<string, { lat: [number, number], lng: [number, number] }> = {
    'CM': { lat: [1.65, 13.08], lng: [8.49, 16.20] }, // Cameroun
    'CI': { lat: [4.36, 10.74], lng: [-8.60, -2.49] }, // Côte d'Ivoire
    'SN': { lat: [12.30, 16.69], lng: [-17.54, -11.34] }, // Sénégal
    'BF': { lat: [9.40, 15.08], lng: [-5.51, 2.40] }, // Burkina Faso
    'ML': { lat: [10.15, 25.00], lng: [-12.24, 4.27] }, // Mali
    'TG': { lat: [6.14, 11.14], lng: [0.14, 1.81] }, // Togo
    'BJ': { lat: [6.23, 12.42], lng: [0.77, 3.84] }, // Bénin
    'NE': { lat: [11.69, 23.52], lng: [0.17, 15.99] }, // Niger
    'CD': { lat: [-13.45, 5.39], lng: [12.04, 31.31] }, // RDC
    'CG': { lat: [-5.04, 3.70], lng: [11.20, 18.65] }, // Congo
    'GA': { lat: [-3.98, 2.32], lng: [8.69, 14.50] }, // Gabon
    'TD': { lat: [7.44, 23.45], lng: [13.47, 24.00] }, // Tchad
    'CF': { lat: [2.26, 11.00], lng: [14.41, 27.45] }, // RCA
    'GQ': { lat: [-1.46, 3.79], lng: [5.63, 11.33] }, // Guinée équatoriale
    'MG': { lat: [-25.60, -11.95], lng: [43.25, 50.48] }, // Madagascar
};

/**
 * Détermine le code pays à partir des coordonnées GPS
 */
export const getCountryCodeFromGPS = (lat: number, lng: number): string | null => {
    for (const [code, bounds] of Object.entries(COUNTRY_BOUNDS)) {
        if (
            lat >= bounds.lat[0] && lat <= bounds.lat[1] &&
            lng >= bounds.lng[0] && lng <= bounds.lng[1]
        ) {
            return code;
        }
    }
    return null;
};

/**
 * Récupère la zone géographique de l'utilisateur
 * Priorité: GPS → Settings → Défaut (CM)
 */
export const getUserZone = async (): Promise<string> => {
    try {
        // 1. Essayer de récupérer depuis AsyncStorage (settings)
        const savedZone = await SafeStorage.getItem('userCountryCode');
        if (savedZone) {
            console.log('[UserZone] Zone depuis settings:', savedZone);
            return savedZone;
        }

        // 2. Essayer de récupérer depuis GPS
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const locationPromise = Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('GPS timeout')), 5000)
                );

                const location = await Promise.race([locationPromise, timeoutPromise]) as any;
                const { latitude, longitude } = location.coords;

                const countryCode = getCountryCodeFromGPS(latitude, longitude);
                if (countryCode) {
                    // Sauvegarder pour usage futur
                    await SafeStorage.setItem('userCountryCode', countryCode);
                    console.log('[UserZone] Zone détectée depuis GPS:', countryCode);
                    return countryCode;
                }

                // Géocodage inverse pour obtenir le pays
                try {
                    const reverseGeocode = await Location.reverseGeocodeAsync({
                        latitude,
                        longitude,
                    });

                    if (reverseGeocode && reverseGeocode.length > 0) {
                        const country = reverseGeocode[0].isoCountryCode;
                        if (country && COUNTRY_CODE_MAP[country]) {
                            await SafeStorage.setItem('userCountryCode', country);
                            console.log('[UserZone] Zone depuis géocodage:', country);
                            return country;
                        }
                    }
                } catch (geoError) {
                    console.warn('[UserZone] Erreur géocodage inverse:', geoError);
                }
            }
        } catch (gpsError) {
            console.warn('[UserZone] Erreur GPS:', gpsError);
        }

        // 3. Défaut: Cameroun
        console.log('[UserZone] Utilisation zone par défaut: CM');
        return 'CM';
    } catch (error) {
        console.error('[UserZone] Erreur récupération zone:', error);
        return 'CM';
    }
};

/**
 * Obtient l'emoji pour un code pays
 */
export const getCountryEmoji = (code: string): string => {
    return COUNTRY_CODE_MAP[code] || '\uD83C\uDF0D';
};

/**
 * Trie les options en mettant celles de la zone utilisateur en premier
 */
export const sortOptionsByZone = (options: string[], userZone: string): string[] => {
    const userZoneEmoji = getCountryEmoji(userZone);

    // Séparer les options par zone
    const userZoneOptions: string[] = [];
    const otherZoneOptions: string[] = [];
    const separatorOptions: string[] = [];
    const newOptions: string[] = [];

    options.forEach(option => {
        // Détecter le séparateur
        if (option.includes('───────') || option.includes('────────')) {
            separatorOptions.push(option);
        }
        // Détecter les options avec emoji de la zone utilisateur
        else if (option.includes(userZoneEmoji)) {
            userZoneOptions.push(option);
        }
        // Détecter les options sans emoji (neutres)
        else if (!/^[\uD83C\uDDE8\uD83C\uDDF2\uD83C\uDDE8\uD83C\uDDEE\uD83C\uDDF8\uD83C\uDDF3\uD83C\uDDE7\uD83C\uDDEB\uD83C\uDDF2\uD83C\uDDF1\uD83C\uDDF9\uD83C\uDDEC\uD83C\uDDE7\uD83C\uDDEF\uD83C\uDDF3\uD83C\uDDEA\uD83C\uDDE8\uD83C\uDDE9\uD83C\uDDE8\uD83C\uDDEC\uD83C\uDDEC\uD83C\uDDE6\uD83C\uDDF9\uD83C\uDDE9\uD83C\uDDE8\uD83C\uDDEB\uD83C\uDDEC\uD83C\uDDF6\uD83C\uDDF2\uD83C\uDDEC]/.test(option)) {
            userZoneOptions.push(option); // Options neutres en premier aussi
        }
        // Autres zones
        else {
            otherZoneOptions.push(option);
        }
    });

    // Ordre final: Options zone utilisateur → Séparateur (si existe) → Autres zones
    const sorted = [
        ...userZoneOptions.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
        ...separatorOptions,
        ...otherZoneOptions.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
        ...newOptions,
    ];

    return sorted;
};

