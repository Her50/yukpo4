import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { apiPost } from '../services/api';

interface LocationData {
    location: string;
    country: string;
    countryFlag: string; // Nouveau: drapeau du pays
    coordinates: { lat: number; lng: number } | null;
    source: 'service' | 'user' | 'creator';
    isRealTime: boolean;
}

interface UseLocationDisplayReturn {
    locationData: LocationData | null;
    loading: boolean;
    error: string | null;
}

export const useLocationDisplay = (service: any, serviceCreatorInfo?: any): UseLocationDisplayReturn => {
    const [locationData, setLocationData] = useState<LocationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getFieldValue = useCallback((field: any): string => {
        if (!field) return '';

        if (typeof field === 'object' && field.valeur !== undefined) {
            const value = field.valeur;
            if (typeof value === 'string') return value;
            if (typeof value === 'number') return value.toString();
            return String(value);
        }

        if (typeof field === 'string') return field;
        if (typeof field === 'number') return field.toString();

        return '';
    }, []);

    const convertGpsToLocation = useCallback(async (gpsString: string): Promise<string> => {
        try {
            console.log('\uD83D\uDD0D [useLocationDisplay] Conversion GPS:', gpsString);

            const [lat, lng] = gpsString.split(',').map(coord => parseFloat(coord.trim()));

            if (isNaN(lat) || isNaN(lng)) {
                console.warn('⚠️ [useLocationDisplay] Coordonnées invalides:', gpsString);
                return 'Position non valide';
            }

            console.log('\uD83D\uDCCD [useLocationDisplay] Coordonnées parsées:', { lat, lng });

            // ✅ CORRIGÉ: Essayer d'abord l'API interne avec apiPost
            try {
                const response = await apiPost('/api/geocoding/reverse', {
                    latitude: lat,
                    longitude: lng
                });

                console.log('\uD83D\uDD17 [useLocationDisplay] Statut API interne:', response.success);

                if (response.success && response.data) {
                    const data = response.data as any;
                    console.log('\uD83D\uDCCD [useLocationDisplay] Réponse API interne:', data);

                    // CORRECTION: Filtrer les Plus Codes (format: 2RH9+W2, XXXX+XX, etc.) de manière plus robuste
                    const isPlusCode = (str: string) => {
                        // Détecter les Plus Codes: format XXXX+XX ou XXXX+XXX
                        return /[A-Z0-9]{4}\+[A-Z0-9]{2,3}/i.test(str);
                    };

                    // Si formatted_address contient un Plus Code, le supprimer complètement
                    if (data.formatted_address && data.formatted_address !== 'Lieu inconnu') {
                        let cleanedAddress = data.formatted_address;

                        // Supprimer tous les Plus Codes de l'adresse
                        cleanedAddress = cleanedAddress.replace(/[A-Z0-9]{4}\+[A-Z0-9]{2,3}/gi, '');

                        // Nettoyer les virgules et espaces en trop
                        const addressParts = cleanedAddress
                            .split(',')
                            .map((p: string) => p.trim())
                            .filter((p: string) => p.length > 0);

                        // CORRECTION: Ne garder que quartier + ville (max 2 premiers éléments)
                        // Le pays est déjà représenté par le drapeau
                        const locationOnly = addressParts.slice(0, 2).join(', ');

                        if (locationOnly.length > 0) {
                            console.log('✅ [useLocationDisplay] Localisation nettoyée (quartier + ville uniquement):', locationOnly);
                            return locationOnly;
                        }
                    }

                    // Si pas de formatted_address valide, essayer d'extraire depuis les composants
                    if (data.address_components && Array.isArray(data.address_components)) {
                        return extractLocationFromGoogleData(data, lat, lng);
                    }
                } else {
                    console.warn('⚠️ [useLocationDisplay] API interne échouée (status:', response.status, ')');
                }
            } catch (apiError) {
                console.warn('⚠️ [useLocationDisplay] Erreur API interne:', apiError);
            }

            // Fallback : Utiliser Expo Location pour le géocodage inversé
            console.log('\uD83C\uDF0D [useLocationDisplay] Utilisation Expo Location');
            try {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: lat,
                    longitude: lng
                });

                if (reverseGeocode && reverseGeocode.length > 0) {
                    const address = reverseGeocode[0];
                    const locationParts = [];

                    // CORRECTION: Seulement quartier + ville (pas la région ni le pays)
                    if (address.district && address.district !== address.city) {
                        locationParts.push(address.district);
                    } else if (address.subregion && address.subregion !== address.city) {
                        locationParts.push(address.subregion);
                    }

                    if (address.city) {
                        locationParts.push(address.city);
                    }

                    const locationString = locationParts.join(', ');
                    console.log('✅ [useLocationDisplay] Localisation depuis Expo (quartier + ville):', locationString);
                    return locationString;
                }
            } catch (expoError) {
                console.warn('⚠️ [useLocationDisplay] Erreur Expo Location:', expoError);
            }

            // Dernier fallback : coordonnées brutes
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (error) {
            console.error('❌ [useLocationDisplay] Erreur conversion GPS:', error);
            return 'Position non disponible';
        }
    }, []);

    const extractLocationFromGoogleData = (data: any, lat: number, lng: number): string => {
        try {
            const components = data.address_components;
            if (!components || !Array.isArray(components)) {
                return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }

            const locationParts = [];

            // CORRECTION: Extraire seulement quartier + ville (pas région ni pays)
            const city = components.find((c: any) => c.types.includes('locality'));
            const district = components.find((c: any) => c.types.includes('sublocality'));
            const neighborhood = components.find((c: any) => c.types.includes('sublocality_level_1'));
            const sublocality2 = components.find((c: any) => c.types.includes('sublocality_level_2'));

            // Priorité : quartier le plus spécifique + ville
            if (sublocality2 && sublocality2.long_name !== city?.long_name) {
                locationParts.push(sublocality2.long_name);
            } else if (neighborhood && neighborhood.long_name !== city?.long_name) {
                locationParts.push(neighborhood.long_name);
            } else if (district && district.long_name !== city?.long_name) {
                locationParts.push(district.long_name);
            }

            // Ajouter la ville
            if (city) {
                locationParts.push(city.long_name);
            }

            // CORRECTION: Ne PAS ajouter région ni pays (représentés par le drapeau)

            return locationParts.length > 0 ? locationParts.join(', ') : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (error) {
            console.error('❌ [useLocationDisplay] Erreur extraction données Google:', error);
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    };

    const getCountryFlag = (country: string): string => {
        const countryLower = country.toLowerCase();

        // Drapeaux des pays africains et internationaux
        if (countryLower.includes('cameroun') || countryLower.includes('cameroon')) return '\uD83C\uDDE8\uD83C\uDDF2';
        if (countryLower.includes('nigeria')) return '\uD83C\uDDF3\uD83C\uDDEC';
        if (countryLower.includes('sénégal') || countryLower.includes('senegal')) return '\uD83C\uDDF8\uD83C\uDDF3';
        if (countryLower.includes('côte') || countryLower.includes('ivoire') || countryLower.includes('ivory')) return '\uD83C\uDDE8\uD83C\uDDEE';
        if (countryLower.includes('ghana')) return '\uD83C\uDDEC\uD83C\uDDED';
        if (countryLower.includes('france')) return '\uD83C\uDDEB\uD83C\uDDF7';
        if (countryLower.includes('togo')) return '\uD83C\uDDF9\uD83C\uDDEC';
        if (countryLower.includes('bénin') || countryLower.includes('benin')) return '\uD83C\uDDE7\uD83C\uDDEF';
        if (countryLower.includes('mali')) return '\uD83C\uDDF2\uD83C\uDDF1';
        if (countryLower.includes('burkina')) return '\uD83C\uDDE7\uD83C\uDDEB';
        if (countryLower.includes('niger')) return '\uD83C\uDDF3\uD83C\uDDEA';
        if (countryLower.includes('tchad') || countryLower.includes('chad')) return '\uD83C\uDDF9\uD83C\uDDE9';
        if (countryLower.includes('gabon')) return '\uD83C\uDDEC\uD83C\uDDE6';
        if (countryLower.includes('congo')) return '\uD83C\uDDE8\uD83C\uDDEC';

        return '\uD83C\uDF0D'; // Icône générique pour pays non reconnu
    };

    const extractCountryFromLocation = (location: string): string => {
        const locationLower = location.toLowerCase();

        if (locationLower.includes('cameroun') || locationLower.includes('douala') || locationLower.includes('yaoundé') || locationLower.includes('yaounde')) {
            return 'Cameroun';
        }
        if (locationLower.includes('nigeria') || locationLower.includes('lagos') || locationLower.includes('abuja')) {
            return 'Nigeria';
        }
        if (locationLower.includes('sénégal') || locationLower.includes('senegal') || locationLower.includes('dakar')) {
            return 'Sénégal';
        }
        if (locationLower.includes('côte d\'ivoire') || locationLower.includes('cote d\'ivoire') || locationLower.includes('abidjan')) {
            return 'Côte d\'Ivoire';
        }
        if (locationLower.includes('ghana') || locationLower.includes('accra')) {
            return 'Ghana';
        }
        if (locationLower.includes('france') || locationLower.includes('paris')) {
            return 'France';
        }
        if (locationLower.includes('togo') || locationLower.includes('lomé')) {
            return 'Togo';
        }
        if (locationLower.includes('bénin') || locationLower.includes('benin') || locationLower.includes('cotonou')) {
            return 'Bénin';
        }

        return 'International';
    };

    useEffect(() => {
        const processLocation = async () => {
            try {
                setLoading(true);

                let location: string | null = null;
                let coordinates: { lat: number; lng: number } | null = null;
                let source: 'service' | 'user' | 'creator' = 'service';
                let isRealTime = false;

                // PRIORITÉ 1: GPS fixe du service (coordonnées choisies par le prestataire)
                const gpsFixe = getFieldValue(service.data?.gps_fixe);
                console.log('\uD83D\uDCCD [useLocationDisplay] ==================');
                console.log('\uD83D\uDCCD [useLocationDisplay] ANALYSE GPS POUR SERVICE ID:', service.id);
                console.log('\uD83D\uDCCD [useLocationDisplay] GPS fixe brut:', service.data?.gps_fixe);
                console.log('\uD83D\uDCCD [useLocationDisplay] GPS fixe après getFieldValue:', gpsFixe);
                console.log('\uD83D\uDCCD [useLocationDisplay] Type:', typeof gpsFixe);

                if (gpsFixe && gpsFixe !== 'Non spécifié' && gpsFixe !== '' && gpsFixe.includes(',')) {
                    // Gérer aussi les zones (polygones avec |)
                    const firstPoint = gpsFixe.split('|')[0]; // Prendre le premier point si c'est une zone
                    const coords = firstPoint.split(',').map(coord => parseFloat(coord.trim()));
                    console.log('\uD83D\uDCCD [useLocationDisplay] Coordonnées parsées:', coords);

                    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                        coordinates = { lat: coords[0], lng: coords[1] };
                        console.log('✅ [useLocationDisplay] GPS FIXE UTILISÉ:', gpsFixe);
                        console.log('✅ [useLocationDisplay] Coordonnées:', coordinates);
                        location = await convertGpsToLocation(`${coords[0]},${coords[1]}`);
                        source = 'service';
                        isRealTime = false; // GPS fixe n'est pas en temps réel
                    } else {
                        console.warn('⚠️ [useLocationDisplay] GPS fixe invalide (NaN):', coords);
                    }
                } else {
                    console.warn('⚠️ [useLocationDisplay] GPS fixe non utilisable:', {
                        exists: !!gpsFixe,
                        value: gpsFixe,
                        hasComma: gpsFixe?.includes(',')
                    });
                }

                // PRIORITÉ 2: GPS du service lui-même (champ gps standard)
                if (!location && service.gps) {
                    const serviceGps = typeof service.gps === 'string' ? service.gps : getFieldValue(service.gps);
                    console.log('\uD83D\uDCCD [useLocationDisplay] GPS standard du service:', serviceGps);

                    if (serviceGps && serviceGps !== 'Non spécifié' && serviceGps.includes(',')) {
                        const firstPoint = serviceGps.split('|')[0];
                        const coords = firstPoint.split(',').map(coord => parseFloat(coord.trim()));
                        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                            coordinates = { lat: coords[0], lng: coords[1] };
                            console.log('✅ [useLocationDisplay] GPS standard valide:', serviceGps);
                            location = await convertGpsToLocation(`${coords[0]},${coords[1]}`);
                            source = 'service';
                            isRealTime = service.gps_realtime || false;
                        }
                    }
                }

                // PRIORITÉ 3: GPS EN TEMPS RÉEL du prestataire (toujours disponible en dernier recours)
                // CORRECTION: C'est le fallback principal avant "Localisation non disponible"
                if (!location && serviceCreatorInfo) {
                    const creatorGps = getFieldValue(serviceCreatorInfo.gps);
                    console.log('\uD83D\uDC64 [useLocationDisplay] GPS EN TEMPS RÉEL du prestataire:', creatorGps);

                    if (creatorGps && creatorGps !== 'Non spécifié' && creatorGps.includes(',')) {
                        const firstPoint = creatorGps.split('|')[0];
                        const coords = firstPoint.split(',').map(coord => parseFloat(coord.trim()));
                        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                            coordinates = { lat: coords[0], lng: coords[1] };
                            console.log('✅ [useLocationDisplay] GPS EN TEMPS RÉEL du prestataire valide:', creatorGps);
                            location = await convertGpsToLocation(`${coords[0]},${coords[1]}`);
                            source = 'creator';
                            isRealTime = true; // Position en temps réel du prestataire
                        }
                    } else {
                        console.warn('⚠️ [useLocationDisplay] GPS du prestataire invalide ou manquant:', creatorGps);
                    }
                }

                // Fallback final - Afficher uniquement si vraiment aucune donnée GPS disponible
                if (!location) {
                    // ⚠️ Ce n'est pas une erreur critique - certains services n'ont pas de GPS configuré
                    console.warn('⚠️ [useLocationDisplay] Aucune source GPS valide trouvée (normal si service sans localisation)');
                    console.warn('   - GPS fixe service:', getFieldValue(service.data?.gps_fixe) || '(vide)');
                    console.warn('   - GPS service:', service.gps || '(undefined)');
                    console.warn('   - GPS prestataire:', serviceCreatorInfo?.gps || '(null)');
                    location = 'Localisation non disponible';
                }

                const country = extractCountryFromLocation(location);
                const countryFlag = getCountryFlag(country);

                setLocationData({
                    location,
                    country,
                    countryFlag,
                    coordinates,
                    source,
                    isRealTime
                });

                console.log('✅ [useLocationDisplay] Localisation traitée:', {
                    location,
                    country,
                    countryFlag,
                    coordinates,
                    source,
                    isRealTime
                });

            } catch (error) {
                console.error('❌ [useLocationDisplay] Erreur traitement localisation:', error);
                setError('Erreur lors du traitement de la localisation');
                setLocationData({
                    location: 'Localisation non disponible',
                    country: 'Inconnu',
                    countryFlag: '\uD83C\uDF0D',
                    coordinates: null,
                    source: 'service',
                    isRealTime: false
                });
            } finally {
                setLoading(false);
            }
        };

        if (service) {
            // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
            processLocation().catch(error => {
                console.error('[useLocationDisplay] Erreur processLocation:', error);
            });
        }
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [service, serviceCreatorInfo, getFieldValue, convertGpsToLocation]);

    return { locationData, loading, error };
};
