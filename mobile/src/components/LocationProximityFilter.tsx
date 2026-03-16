/**
 * LocationProximityFilter
 * Composant de filtrage par localisation et proximité GPS
 * 3 modes: Ma position / Près d'un lieu / Partout
 */

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useLocation } from '../contexts/LocationContext';
import { modernColors } from '../theme/modernTheme';
import { formatCoordinates, geocodeLocation } from '../utils/geocoding';
import LocationSelector from './LocationSelector';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export type LocationMode = 'current' | 'custom' | 'anywhere';

interface LocationProximityFilterProps {
    onLocationChange: (coords: { lat: number, lon: number } | null, radius: number | null) => void;
    initialMode?: LocationMode;
    initialRadius?: number | null;
}

export const LocationProximityFilter: React.FC<LocationProximityFilterProps> = ({
    onLocationChange,
    initialMode = 'current',
    initialRadius = 10
}) => {
    const { location, isLoading: locationLoading, calculateDistance } = useLocation();
        const { t } = useLanguageSafe();
const [mode, setMode] = useState<LocationMode>(initialMode);
    const [customLocation, setCustomLocation] = useState('');
    const [customCoords, setCustomCoords] = useState<{ lat: number, lon: number } | null>(null);
    const [radius, setRadius] = useState<number | null>(initialRadius);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [showLocationSelector, setShowLocationSelector] = useState(false);

    // Effet pour notifier le parent des changements
    useEffect(() => {
        let coords: { lat: number, lon: number } | null = null;

        if (mode === 'current' && location) {
            coords = {
                lat: location.coords.latitude,
                lon: location.coords.longitude
            };
        } else if (mode === 'custom' && customCoords) {
            coords = customCoords;
        }
        // mode 'anywhere' → coords reste null

        console.log('[LocationProximityFilter] Mode:', mode, 'Coords:', coords, 'Radius:', radius);
        onLocationChange(coords, mode === 'anywhere' ? null : radius);
    }, [mode, customCoords, radius, location]);

    const handleModeChange = (newMode: LocationMode) => {
        setMode(newMode);
        if (newMode === 'custom' && !customLocation) {
            setShowLocationSelector(true);
        }
    };

    const handleLocationSelect = async (locationName: string) => {
        setCustomLocation(locationName);
        setShowLocationSelector(false);
        setIsGeocoding(true);

        try {
            const result = await geocodeLocation(locationName);
            if (result) {
                setCustomCoords({ lat: result.lat, lon: result.lon });
                console.log('[LocationProximityFilter] ✅ Lieu géocodé:', locationName, result);
            } else {
                console.warn('[LocationProximityFilter] ⚠️ Géocodage échoué pour:', locationName);
                // Fallback: revenir au mode "current"
                setMode('current');
                setCustomLocation('');
            }
        } catch (error) {
            console.error('[LocationProximityFilter] Erreur géocodage:', error);
            setMode('current');
            setCustomLocation('');
        } finally {
            setIsGeocoding(false);
        }
    };

    const radiusOptions = [
        { value: 5, label: '5 km' },
        { value: 10, label: '10 km' },
        { value: 20, label: '20 km' },
        { value: 50, label: '50 km' },
        { value: null, label: t('locationProximityFilter.illimite') }
    ];

    return (
        <View style={styles.container}>
            {/* Titre de section */}
            <Text style={styles.sectionTitle}>{t('locationProximityFilter.localisationEtProximite')}</Text>
            <Text style={styles.sectionDescription}>
                Filtrez par zone géographique
            </Text>

            {/* Modes de localisation */}
            <View style={styles.modesContainer}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'current' && styles.modeButtonActive]}
                    onPress={() => handleModeChange('current')}
                >
                    <SafeIcon
                        name="navigation"
                        size={18}
                        color={mode === 'current' ? '#FFFFFF' : modernColors.primary}
                    />
                    <Text style={[styles.modeText, mode === 'current' && styles.modeTextActive]}>
                        Ma position
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.modeButton, mode === 'custom' && styles.modeButtonActive]}
                    onPress={() => handleModeChange('custom')}
                >
                    <SafeIcon
                        name="map-pin"
                        size={18}
                        color={mode === 'custom' ? '#FFFFFF' : modernColors.primary}
                    />
                    <Text style={[styles.modeText, mode === 'custom' && styles.modeTextActive]}>
                        Près d'un lieu
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.modeButton, mode === 'anywhere' && styles.modeButtonActive]}
                    onPress={() => handleModeChange('anywhere')}
                >
                    <SafeIcon
                        name="globe"
                        size={18}
                        color={mode === 'anywhere' ? '#FFFFFF' : modernColors.primary}
                    />
                    <Text style={[styles.modeText, mode === 'anywhere' && styles.modeTextActive]}>
                        Partout
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Sélection de lieu personnalisé */}
            {mode === 'custom' && (
                <View style={styles.customLocationContainer}>
                    <TouchableOpacity
                        style={styles.locationButton}
                        onPress={() => setShowLocationSelector(true)}
                    >
                        <SafeIcon name="search" size={16} color={modernColors.textSecondary} />
                        <Text style={[
                            styles.locationButtonText,
                            !customLocation && styles.placeholderText
                        ]}>
                            {customLocation || 'Rechercher un lieu...'}
                        </Text>
                        <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
                    </TouchableOpacity>

                    {isGeocoding && (
                        <View style={styles.geocodingIndicator}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.geocodingText}>{t('locationProximityFilter.geolocalisation')}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Rayon de recherche (sauf mode "Partout") */}
            {mode !== 'anywhere' && (
                <View style={styles.radiusContainer}>
                    <Text style={styles.radiusLabel}>Rayon de recherche</Text>
                    <View style={styles.radiusButtons}>
                        {radiusOptions.map((option) => (
                            <TouchableOpacity
                                key={option.label}
                                style={[
                                    styles.radiusButton,
                                    radius === option.value && styles.radiusButtonActive
                                ]}
                                onPress={() => setRadius(option.value)}
                            >
                                <Text style={[
                                    styles.radiusButtonText,
                                    radius === option.value && styles.radiusButtonTextActive
                                ]}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Informations sur la position actuelle */}
            {mode === 'current' && (
                <View style={styles.infoBox}>
                    {locationLoading ? (
                        <>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.infoText}>{t('locationProximityFilter.localisationEnCours')}</Text>
                        </>
                    ) : location ? (
                        <>
                            <SafeIcon name="info" size={16} color={modernColors.primary} />
                            <Text style={styles.infoText}>
                                Position: {formatCoordinates(location.coords.latitude, location.coords.longitude)}
                            </Text>
                        </>
                    ) : (
                        <>
                            <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                            <Text style={[styles.infoText, styles.errorText]}>
                                Position non disponible
                            </Text>
                        </>
                    )}
                </View>
            )}

            {/* Informations sur le lieu personnalisé */}
            {mode === 'custom' && customCoords && customLocation && (
                <View style={styles.infoBox}>
                    <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                    <View style={styles.infoTextContainer}>
                        <Text style={styles.infoText}>{customLocation}</Text>
                        <Text style={styles.infoSubtext}>
                            {formatCoordinates(customCoords.lat, customCoords.lon)}
                        </Text>
                    </View>
                </View>
            )}

            {/* Modal de sélection de lieu */}
            {showLocationSelector && (
                <Modal
                    visible={true}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={() => setShowLocationSelector(false)}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('locationProximityFilter.rechercherUnLieu')}</Text>
                            <TouchableOpacity
                                onPress={() => setShowLocationSelector(false)}
                                style={styles.modalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <LocationSelector
                            label={t('locationProximityFilter.villeOuQuartier')}
                            value={customLocation}
                            onSelect={handleLocationSelect as any}
                            placeholder={t('locationProximityFilter.rechercherUnLieuVilleQuartier')}
                            scope="all"
                        />
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 6,
    },
    sectionDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    modesContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: 'transparent',
        gap: 6,
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    modeText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    modeTextActive: {
        color: '#FFFFFF',
    },
    customLocationContainer: {
        marginBottom: 16,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 10,
    },
    locationButtonText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    placeholderText: {
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    geocodingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        paddingHorizontal: 14,
    },
    geocodingText: {
        fontSize: 13,
        color: modernColors.primary,
    },
    radiusContainer: {
        marginBottom: 16,
    },
    radiusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 10,
    },
    radiusButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    radiusButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    radiusButtonActive: {
        backgroundColor: '#E0E7FF',
        borderColor: modernColors.primary,
    },
    radiusButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    radiusButtonTextActive: {
        color: modernColors.primary,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F9FF',
        borderRadius: 10,
        padding: 12,
        gap: 10,
    },
    infoTextContainer: {
        flex: 1,
    },
    infoText: {
        fontSize: 13,
        color: modernColors.text,
        flex: 1,
    },
    infoSubtext: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    errorText: {
        color: modernColors.error,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    modalCloseButton: {
        padding: 4,
    },
});

export default LocationProximityFilter;

