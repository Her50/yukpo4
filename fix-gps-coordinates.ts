// fix-gps-coordinates.ts
// Corrections pour le problème GPS "R29M+8G Worumokato, Nigeria"

// Fonction pour détecter les coordonnées Nigeria par défaut
export const isNigeriaDefaultCoords = (lat: number, lng: number): boolean => {
    // Coordonnées exactes du Nigeria par défaut
    const nigeriaCoords = [
        { lat: 9.818276, lng: 4.033640 },
        { lat: 9.818119, lng: 4.033687 },
    ];

    // Vérifier avec une tolérance de 0.001
    const tolerance = 0.001;

    for (const coord of nigeriaCoords) {
        if (Math.abs(lat - coord.lat) < tolerance && Math.abs(lng - coord.lng) < tolerance) {
            return true;
        }
    }

    // Vérifier aussi si c'est dans la zone générale du Nigeria par défaut
    if (lat >= 9.5 && lat <= 10.5 && lng >= 3.5 && lng <= 4.5) {
        return true;
    }

    return false;
};

// Fonction convertGpsToLocation corrigée
export const convertGpsToLocationFixed = async (gpsString: string): Promise<string | null> => {
    if (!gpsString || !gpsString.includes(',')) return gpsString;

    try {
        const coords = gpsString.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length !== 2 || coords.some(isNaN)) return gpsString;

        // Détecter automatiquement le format: longitude,latitude ou latitude,longitude
        let lat, lng;
        if (coords[0] >= -90 && coords[0] <= 90) {
            // Premier nombre est latitude (valide)
            lat = coords[0];
            lng = coords[1];
        } else if (coords[1] >= -90 && coords[1] <= 90) {
            // Deuxième nombre est latitude (valide)
            lat = coords[1];
            lng = coords[0];
        } else {
            // Format inconnu, utiliser l'ordre original
            lat = coords[0];
            lng = coords[1];
        }

        // 🚨 CORRECTION: Détecter les coordonnées Nigeria par défaut
        if (isNigeriaDefaultCoords(lat, lng)) {
            console.log('🚫 [convertGpsToLocationFixed] Coordonnées Nigeria par défaut détectées, ignorées');
            return null; // Retourner null pour indiquer qu'il faut ignorer ces coordonnées
        }

        // Utiliser le service de géocodage automatique
        const locationName = await geocodingService.getLocationFromCoordinates(lat, lng);

        // Optimiser le nom du lieu pour l'affichage
        const optimizedName = optimizeLocationName(locationName);

        return optimizedName;

    } catch (error) {
        console.error('❌ [convertGpsToLocationFixed] Erreur:', error);
        // Fallback: coordonnées formatées
        const coords = gpsString.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length === 2) {
            const lat = coords[0];
            const lng = coords[1];
            const latFormatted = Math.abs(lat) < 10 ? lat.toFixed(3) : lat.toFixed(2);
            const lngFormatted = Math.abs(lng) < 10 ? lng.toFixed(3) : lng.toFixed(2);
            return `${latFormatted}, ${lngFormatted}`;
        }
        return gpsString;
    }
};

// Fonction formatLocation corrigée
export const formatLocationFixed = async (service: any, prestatairesMap: Map<number, any>, currentUser: any): Promise<string> => {
    console.log('🏠 [formatLocationFixed] Début avec service:', service?.id);

    // 1. Priorité: gps_fixe (lieu fixe du service) - AVEC DÉTECTION NIGERIA
    if (service?.data?.gps_fixe) {
        const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
        console.log(`📍 gps_fixe trouvé: ${gpsFixe}`);

        if (gpsFixe && gpsFixe !== 'Non spécifié') {
            if (typeof gpsFixe === 'string' && gpsFixe.includes(',')) {
                console.log('🔄 Géocodage des coordonnées gps_fixe...');
                const location = await convertGpsToLocationFixed(gpsFixe);

                // Si les coordonnées Nigeria sont détectées, ignorer et passer au suivant
                if (location === null) {
                    console.log('🚫 Coordonnées Nigeria ignorées, passage à l\'adresse');
                } else {
                    console.log(`✅ Localisation GPS: ${location}`);
                    return location;
                }
            } else {
                console.log(`✅ Localisation textuelle: ${gpsFixe}`);
                return gpsFixe;
            }
        }
    }

    // 2. Priorité: adresse textuelle
    if (service?.data?.adresse) {
        const adresse = getServiceFieldValue(service.data.adresse);
        console.log(`🏠 adresse trouvée: ${adresse}`);
        if (adresse && adresse !== 'Non spécifié') {
            console.log(`✅ Utilisation de l'adresse: ${adresse}`);
            return adresse;
        }
    }

    // 3. Priorité: gps du créateur du service
    if (service?.user_id && prestatairesMap.has(service.user_id)) {
        const prestataire = prestatairesMap.get(service.user_id);
        if (prestataire?.gps && prestataire.gps !== 'Non spécifié') {
            console.log(`👤 GPS du créateur: ${prestataire.gps}`);

            if (typeof prestataire.gps === 'string' && prestataire.gps.includes(',')) {
                const location = await convertGpsToLocationFixed(prestataire.gps);
                if (location !== null) {
                    console.log(`✅ Localisation créateur: ${location}`);
                    return location;
                }
            } else {
                console.log(`✅ Localisation créateur textuelle: ${prestataire.gps}`);
                return prestataire.gps;
            }
        }
    }

    // 4. Fallback
    console.log('⚠️ Aucune localisation valide trouvée');
    return 'Localisation non disponible';
};

// Fonction pour extraire la valeur d'un champ (inchangée)
const getServiceFieldValue = (field: any): string => {
    if (!field) return 'Non spécifié';

    if (typeof field === 'string') return field;

    if (field && typeof field === 'object' && field.valeur !== undefined) {
        const value = field.valeur;
        if (typeof value === 'string') return value;
        if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
        if (typeof value === 'number') return value.toString();
        if (Array.isArray(value)) return value.join(', ');
        return String(value);
    }

    return 'Non spécifié';
};

// Fonction pour optimiser le nom du lieu (inchangée)
const optimizeLocationName = (locationName: string): string => {
    if (!locationName) return locationName;

    // Supprimer les codes postaux et codes
    let optimized = locationName
        .replace(/^[A-Z0-9+]+/, '') // Supprimer les codes comme "R29M+8G"
        .replace(/^[\s,]+/, '') // Supprimer les espaces et virgules en début
        .trim();

    return optimized;
};

// Import nécessaire (à ajouter dans le fichier principal)
// import { geocodingService } from '@/services/geocodingService';









