import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

/**
 * ✅ COMPOSANT INTELLIGENT : Affichage de la localisation des hôtels
 * 
 * Ce composant gère l'affichage intelligent de la localisation d'un hôtel en :
 * 1. Priorisant les données GPS précises
 * 2. Utilisant le fallback zone + ville si GPS manquant
 * 3. Calculant la distance si localisation utilisateur disponible
 * 4. Permettant l'ouverture dans Google Maps
 */

interface HotelLocationDisplayProps {
    hotel: any;
    userLocation?: { latitude: number; longitude: number } | null;
    compact?: boolean;
    showDistance?: boolean;
    onNavigate?: () => void;
}

/**
 * Fonction utilitaire : Calculer la distance entre deux points GPS
 * Utilise la formule de Haversine
 */
const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371; // Rayon de la Terre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Arrondir à 1 décimale
};

/**
 * Fonction utilitaire : Parser les coordonnées GPS
 * Formats supportés :
 * - "3.848,11.502" (lat,lng)
 * - "3.848, 11.502" (avec espace)
 * - { latitude: 3.848, longitude: 11.502 }
 */
const parseGPS = (gps: any): { lat: number; lng: number } | null => {
    if (!gps) return null;

    // Si c'est déjà un objet
    if (typeof gps === 'object' && gps.latitude && gps.longitude) {
        return { lat: gps.latitude, lng: gps.longitude };
    }

    // Si c'est une chaîne
    if (typeof gps === 'string') {
        const parts = gps.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return { lat: parts[0], lng: parts[1] };
        }
    }

    return null;
};

/**
 * Fonction utilitaire : Détecter les coordonnées Nigeria par défaut (problème connu)
 */
const isNigeriaDefaultCoords = (lat: number, lng: number): boolean => {
    return (
        (Math.abs(lat - 9.818276) < 0.001 && Math.abs(lng - 4.033640) < 0.001) ||
        (Math.abs(lat - 9.818119) < 0.001 && Math.abs(lng - 4.033687) < 0.001)
    );
};

/**
 * Fonction utilitaire : Générer un nom de lieu lisible depuis les coordonnées
 * Utilise la détection de zones géographiques africaines
 */
const generateReadableLocation = (lat: number, lng: number): string => {
    // Vérifier Nigeria par défaut (erreur)
    if (isNigeriaDefaultCoords(lat, lng)) {
        return 'Localisation non disponible';
    }

    // ════════════════════════════════════════════════════════════
    // 📍 ZONES GÉOGRAPHIQUES DU CAMEROUN (focus principal)
    // ════════════════════════════════════════════════════════════
    if (lat >= 3.5 && lat <= 13 && lng >= 8 && lng <= 16) {
        // Douala (Littoral)
        if (lat >= 3.9 && lat <= 4.1 && lng >= 9.6 && lng <= 9.8) {
            return 'Douala, Littoral, Cameroun';
        }
        // Yaoundé (Centre)
        if (lat >= 3.8 && lat <= 3.9 && lng >= 11.4 && lng <= 11.6) {
            return t('hotelLocationDisplay.yaoundeCentreCameroun');
        }
        // Bafoussam (Ouest)
        if (lat >= 5.4 && lat <= 5.5 && lng >= 10.4 && lng <= 10.5) {
            return 'Bafoussam, Ouest, Cameroun';
        }
        // Garoua (Nord)
        if (lat >= 9.2 && lat <= 9.4 && lng >= 13.3 && lng <= 13.5) {
            return 'Garoua, Nord, Cameroun';
        }
        // Maroua (Extrême-Nord)
        if (lat >= 10.5 && lat <= 10.7 && lng >= 14.2 && lng <= 14.4) {
            return t('hotelLocationDisplay.marouaExtremenordCameroun');
        }
        // Bamenda (Nord-Ouest)
        if (lat >= 5.9 && lat <= 6.0 && lng >= 10.1 && lng <= 10.2) {
            return 'Bamenda, Nord-Ouest, Cameroun';
        }
        // Buea (Sud-Ouest)
        if (lat >= 4.1 && lat <= 4.2 && lng >= 9.2 && lng <= 9.3) {
            return 'Buea, Sud-Ouest, Cameroun';
        }
        // Kribi (Sud)
        if (lat >= 2.9 && lat <= 3.0 && lng >= 9.8 && lng <= 10.0) {
            return 'Kribi, Sud, Cameroun';
        }
        // Limbe (Sud-Ouest)
        if (lat >= 4.0 && lat <= 4.1 && lng >= 9.1 && lng <= 9.3) {
            return 'Limbe, Sud-Ouest, Cameroun';
        }

        // Régions génériques
        if (lat >= 10 && lng >{t('hotelLocationDisplay.13ReturnExtremenordCameroun')}
        if (lat >= 8.5 && lng >= 13) return 'Nord, Cameroun';
        if (lat >= 6.5 && lng >= 11) return 'Adamaoua, Cameroun';
        if (lat >= 5.5 && lng >= 10) return 'Centre, Cameroun';
        if (lat >= 4 && lng >= 9.5) return 'Sud, Cameroun';
        if (lat >= 4.5 && lng <= 10) return 'Littoral, Cameroun';
        if (lat >= 5 && lng <= 11) return 'Ouest, Cameroun';
        if (lat >= 6 && lng <= 12) return 'Nord-Ouest, Cameroun';
        if (lat >= 5.5 && lng <= 12.5) return 'Sud-Ouest, Cameroun';
        if (lat >= 3.5 && lng >= 11) return 'Est, Cameroun';

        return 'Cameroun';
    }

    // ════════════════════════════════════════════════════════════
    // 📍 AUTRES PAYS D'AFRIQUE FRANCOPHONE
    // ════════════════════════════════════════════════════════════

    // Côte d'Ivoire
    if (lat >= 5.0 && lat <= 10.5 && lng >= -8.5 && lng <= -2.5) {
        if (lat >= 5.2 && lat <= 5.4 && lng >= -4.1 && lng <= -3.9) return t('hotelLocationDisplay.abidjanCoteDivoire');
        if (lat >= 7.6 && lat <= 7.8 && lng >= -5.1 && lng <= -4.9) return t('hotelLocationDisplay.yamoussoukroCoteDivoire');
        return t('hotelLocationDisplay.coteD')Ivoire';
    }

    // Sénégal
    if (lat >= 12.0 && lat <= 16.5 && lng >= -17.5 && lng <= -11.5) {
        if (lat >= 14.6 && lat <= 14.8 && lng >= -17.5 && lng <= -17.3) return t('hotelLocationDisplay.dakarSenegal');
        return t('hotelLocationDisplay.senegal');
    }

    // Mali
    if (lat >= 10.0 && lat <= 25.0 && lng >= -12.5 && lng <= 4.5) {
        if (lat >= 12.6 && lat <= 12.7 && lng >= -8.1 && lng <= -7.9) return 'Bamako, Mali';
        return 'Mali';
    }

    // Gabon
    if (lat >= -4.0 && lat <= 2.5 && lng >= 8.5 && lng <= 14.5) {
        if (lat >= 0.3 && lat <= 0.5 && lng >= 9.3 && lng <= 9.5) return 'Libreville, Gabon';
        return 'Gabon';
    }

    // Congo (Brazzaville)
    if (lat >= -5.0 && lat <= 4.0 && lng >= 11.0 && lng <= 19.0) {
        if (lat >= -4.3 && lat <= -4.2 && lng >= 15.2 && lng <= 15.3) return 'Brazzaville, Congo';
        return 'Congo';
    }

    // RDC (Kinshasa)
    if (lat >= -13.5 && lat <= 5.5 && lng >= 12.0 && lng <= 31.5) {
        if (lat >= -4.4 && lat <= -4.3 && lng >= 15.2 && lng <= 15.4) return 'Kinshasa, RDC';
        return t('hotelLocationDisplay.republiqueDemocratiqueDuCongo');
    }

    // ════════════════════════════════════════════════════════════
    // 📍 ZONES GÉOGRAPHIQUES GÉNÉRALES
    // ════════════════════════════════════════════════════════════

    // Afrique Centrale
    if (lat >= -5 && lat <= 5 && lng >= -5 && lng <= 20) {
        return 'Afrique Centrale';
    }

    // Afrique de l'Ouest
    if (lat >= 5 && lat <= 20 && lng >= -18 && lng <= 5) {
        return 'Afrique de l\'Ouest';
    }

    // Europe
    if (lat >= 40 && lat <= 60 && lng >= -10 && lng <= 30) {
        return 'Europe';
    }

    // Fallback : coordonnées brutes
    return `Position ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
};

const HotelLocationDisplay: React.FC<HotelLocationDisplayProps> = ({
    hotel,
    userLocation,
    compact = false,
    showDistance = true,
    onNavigate
}) => {
    // ════════════════════════════════════════════════════════════
    // 1️⃣ DÉTERMINER LA LOCALISATION À AFFICHER
    // ════════════════════════════════════════════════════════════

    // Priorité 1 : GPS de l'hôtel (gpsHotel ou gps)
    const hotelGPS = parseGPS(hotel.gpsHotel || hotel.gps);

    // Priorité 2 : Zone + Ville (fallback)
    const fallbackLocation = hotel.zoneHotel && hotel.villeHotel
        ? `${hotel.zoneHotel}, ${hotel.villeHotel}`
        : hotel.villeHotel || hotel.adresseHotel || t('hotelLocationDisplay.localisationNonPrecisee');

    // Générer le nom de lieu lisible
    const displayLocation = hotelGPS
        ? generateReadableLocation(hotelGPS.lat, hotelGPS.lng)
        : fallbackLocation;

    // ════════════════════════════════════════════════════════════
    // 2️⃣ CALCULER LA DISTANCE SI LOCALISATION UTILISATEUR DISPONIBLE
    // ════════════════════════════════════════════════════════════

    let distance: number | null = null;
    if (showDistance && hotelGPS && userLocation) {
        distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            hotelGPS.lat,
            hotelGPS.lng
        );
    }

    // ════════════════════════════════════════════════════════════
    // 3️⃣ OUVRIR DANS GOOGLE MAPS
    // ════════════════════════════════════════════════════════════

    const handleNavigate = () => {
        if (onNavigate) {
            onNavigate();
        } else if (hotelGPS) {
            // Ouvrir Google Maps par défaut
            const url = `https://www.google.com/maps/search/?api=1&query=${hotelGPS.lat},${hotelGPS.lng}`;
            // Linking.openURL(url); // À décommenter si besoin
            console.log('📍 Navigation vers:', url);
        }
    };

    // ════════════════════════════════════════════════════════════
    // 4️⃣ AFFICHAGE
    // ════════════════════════════════════════════════════════════

    if (compact) {
        return (
            <View style={styles.compactContainer}>
                <SafeIcon name="map-pin" size={14} color="#EC4899" />
                <Text style={styles.compactText} numberOfLines={1}>
                    {displayLocation}
                </Text>
                {distance !== null && (
                    <Text style={styles.compactDistance}>• {distance} km</Text>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.locationRow}>
                <SafeIcon name="map-pin" size={16} color="#EC4899" />
                <View style={styles.locationInfo}>
                    <Text style={styles.locationText}>{displayLocation}</Text>
                    {hotel.adresseHotel && displayLocation !== hotel.adresseHotel && (
                        <Text style={styles.addressText}>{hotel.adresseHotel}</Text>
                    )}
                </View>
            </View>

            {(distance !== null || hotelGPS) && (
                <View style={styles.actionsRow}>
                    {distance !== null && (
                        <View style={styles.distanceBadge}>
                            <SafeIcon name="navigation" size={12} color="#059669" />
                            <Text style={styles.distanceText}>{distance} km</Text>
                        </View>
                    )}

                    {hotelGPS && (
                        <TouchableOpacity
                            style={styles.navigateButton}
                            onPress={handleNavigate}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="map" size={12} color="#EC4899" />
                            <Text style={styles.navigateText}>{t('hotelLocationDisplay.itineraire')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    // Mode normal
    container: {
        gap: 8,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    locationInfo: {
        flex: 1,
        gap: 2,
    },
    locationText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
        lineHeight: 18,
    },
    addressText: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
        lineHeight: 16,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 24, // Aligné avec le texte
    },
    distanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    distanceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    navigateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#FCE7F3',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#EC4899',
    },
    navigateText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#EC4899',
    },

    // Mode compact
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    compactText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#4B5563',
        flex: 1,
    },
    compactDistance: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
});

export default HotelLocationDisplay;

