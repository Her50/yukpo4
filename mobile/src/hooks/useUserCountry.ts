// ✅ HOOK POUR DÉTECTER LE PAYS DE L'UTILISATEUR
// Détecte via : 1) Profil utilisateur, 2) GPS, 3) Sélection manuelle, 4) Défaut Cameroun

// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useEffect, useState } from 'react';
import SafeStorage from '../utils/safeStorage';

export interface UserCountryInfo {
    code: string; // Code ISO (CM, CI, SN, etc.)
    emoji: string; // 🇨🇲, 🇨🇮, etc.
    nom: string;
    detected: boolean; // Si détecté automatiquement ou manuel
}

// Mapping des coordonnées GPS vers pays (approximatif)
const detectCountryFromGPS = (latitude: number, longitude: number): string => {
    // 🇨🇲 CAMEROUN: 2°N-13°N, 8°E-16°E
    if (latitude >= 2 && latitude <= 13 && longitude >= 8 && longitude <= 16) {
        return 'CM';
    }

    // 🇨🇩 RDC: 5°S-5°N, 12°E-31°E
    if (latitude >= -5 && latitude <= 5 && longitude >= 12 && longitude <= 31) {
        return 'CD';
    }

    // 🇨🇮 CÔTE D'IVOIRE: 4°N-11°N, 8°W-3°W
    if (latitude >= 4 && latitude <= 11 && longitude >= -8 && longitude <= -3) {
        return 'CI';
    }

    // 🇸🇳 SÉNÉGAL: 12°N-17°N, 17°W-12°W
    if (latitude >= 12 && latitude <= 17 && longitude >= -17 && longitude <= -12) {
        return 'SN';
    }

    // 🇲🇱 MALI: 10°N-25°N, 12°W-4°E
    if (latitude >= 10 && latitude <= 25 && longitude >= -12 && longitude <= 4) {
        return 'ML';
    }

    // 🇬🇦 GABON: 4°S-2°N, 8°E-15°E
    if (latitude >= -4 && latitude <= 2 && longitude >= 8 && longitude <= 15) {
        return 'GA';
    }

    // 🇨🇬 CONGO-BRAZZAVILLE: 5°S-4°N, 11°E-19°E
    if (latitude >= -5 && latitude <= 4 && longitude >= 11 && longitude <= 19) {
        return 'CG';
    }

    // 🇧🇯 BÉNIN: 6°N-13°N, 0°E-4°E
    if (latitude >= 6 && latitude <= 13 && longitude >= 0 && longitude <= 4) {
        return 'BJ';
    }

    // 🇹🇬 TOGO: 6°N-11°N, 0°E-2°E
    if (latitude >= 6 && latitude <= 11 && longitude >= 0 && longitude <= 2) {
        return 'TG';
    }

    // 🇧🇫 BURKINA FASO: 10°N-15°N, 5°W-2°E
    if (latitude >= 10 && latitude <= 15 && longitude >= -5 && longitude <= 2) {
        return 'BF';
    }

    // 🇳🇪 NIGER: 11°N-24°N, 0°E-16°E
    if (latitude >= 11 && latitude <= 24 && longitude >= 0 && longitude <= 16) {
        return 'NE';
    }

    // 🇹🇩 TCHAD: 7°N-24°N, 13°E-24°E
    if (latitude >= 7 && latitude <= 24 && longitude >= 13 && longitude <= 24) {
        return 'TD';
    }

    // 🇬🇳 GUINÉE: 7°N-13°N, 15°W-7°W
    if (latitude >= 7 && latitude <= 13 && longitude >= -15 && longitude <= -7) {
        return 'GN';
    }

    // 🇲🇬 MADAGASCAR: 26°S-12°S, 43°E-51°E
    if (latitude >= -26 && latitude <= -12 && longitude >= 43 && longitude <= 51) {
        return 'MG';
    }

    // Par défaut : Cameroun
    return 'CM';
};

const useUserCountry = (): {
    countryCode: string;
    setCountryCode: (code: string) => void;
    isLoading: boolean;
} => {
    const [countryCode, setCountryCode] = useState<string>('CM'); // Défaut: Cameroun
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        detectUserCountry();
    }, []);

    const detectUserCountry = async () => {
        try {
            // 1️⃣ Vérifier si déjà stocké localement (choix manuel de l'utilisateur)
            const stored = await SafeStorage.getItem('user_country_code');
            if (stored) {
                console.log('[useUserCountry] Pays récupéré du stockage:', stored);
                setCountryCode(stored);
                setIsLoading(false);
                return;
            }

            // 2️⃣ Essayer de détecter via profil utilisateur (si connecté)
            const userProfile = await SafeStorage.getItem('user_profile');
            if (userProfile) {
                try {
                    const profile = JSON.parse(userProfile);
                    if (profile.country_code) {
                        console.log('[useUserCountry] Pays détecté depuis profil:', profile.country_code);
                        setCountryCode(profile.country_code);
                        await SafeStorage.setItem('user_country_code', profile.country_code);
                        setIsLoading(false);
                        return;
                    }
                } catch (e) {
                    console.log('[useUserCountry] Erreur parse profil:', e);
                }
            }

            // 3️⃣ Essayer de détecter via GPS (si disponible)
            const gpsData = await SafeStorage.getItem('user_gps_location');
            if (gpsData) {
                try {
                    const gps = JSON.parse(gpsData);
                    if (gps.latitude && gps.longitude) {
                        const detected = detectCountryFromGPS(gps.latitude, gps.longitude);
                        console.log('[useUserCountry] Pays détecté via GPS:', detected);
                        setCountryCode(detected);
                        await SafeStorage.setItem('user_country_code', detected);
                        setIsLoading(false);
                        return;
                    }
                } catch (e) {
                    console.log('[useUserCountry] Erreur parse GPS:', e);
                }
            }

            // 4️⃣ Par défaut: Cameroun
            console.log('[useUserCountry] Utilisation du pays par défaut: CM (Cameroun)');
            setCountryCode('CM');
            setIsLoading(false);

        } catch (error) {
            console.error('[useUserCountry] Erreur détection pays:', error);
            setCountryCode('CM');
            setIsLoading(false);
        }
    };

    // Fonction pour changer manuellement le pays
    const updateCountryCode = async (code: string) => {
        try {
            await SafeStorage.setItem('user_country_code', code);
            setCountryCode(code);
            console.log('[useUserCountry] Pays mis à jour:', code);
        } catch (error) {
            console.error('[useUserCountry] Erreur sauvegarde pays:', error);
        }
    };

    return {
        countryCode,
        setCountryCode: updateCountryCode,
        isLoading
    };
};

export default useUserCountry;


