// 🔍 Page de recherche intermédiaire pour services spécialisés
// Permet de saisir les critères de recherche (texte, GPS, moment/planning) 
// avant de lancer la recherche dans les tables spécialisées

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../components/ModernGPSModal';
import { NativeButton } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { useLocation } from '../contexts/LocationContext';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

interface SpecializedSearchScreenParams {
    specializedType: string;
    serviceName: string;
    serviceIcon?: string;
}

const SpecializedSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { location: userLocation } = useLocation();

    const params = route.params as SpecializedSearchScreenParams;
    const { specializedType, serviceName, serviceIcon } = params || {};

    const [searchQuery, setSearchQuery] = useState('');
    const [gpsString, setGpsString] = useState<string>('');
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number; address?: string } | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [searchRadius, setSearchRadius] = useState(50); // km
    const [searchMoment, setSearchMoment] = useState<'now' | 'later' | 'specific'>('now');
    const [loading, setLoading] = useState(false);

    // Initialiser le GPS avec la position actuelle si disponible
    useEffect(() => {
        if (userLocation?.coords) {
            const lat = userLocation.coords.latitude;
            const lng = userLocation.coords.longitude;
            setGpsString(`${lat},${lng}`);
            setGpsData({ lat, lng });
        }
    }, [userLocation]);

    const handleGPSSelect = (coordinates: string) => {
        setGpsString(coordinates);
        const [lat, lng] = coordinates.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
            setGpsData({ lat, lng });
        }
        setShowGPSModal(false);
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Recherche vide', 'Veuillez saisir un terme de recherche');
            return;
        }

        setLoading(true);
        try {
            // Construire le payload de recherche spécialisée
            const payload: any = {
                texte: searchQuery.trim(),
                specialized_type: specializedType, // ✅ Force la recherche dans la table spécialisée
            };

            // Ajouter GPS si disponible
            if (gpsData) {
                payload.gps_mobile = `${gpsData.lat},${gpsData.lng}`;
            }

            // Ajouter rayon de recherche
            if (searchRadius) {
                payload.search_radius_km = searchRadius;
            }

            // Ajouter moment/planning si spécifié (pour recherche avec planning)
            if (searchMoment === 'now') {
                // Utiliser le moment actuel (défaut du backend)
            } else if (searchMoment === 'later') {
                // TODO: Permettre de sélectionner une date/heure future
                // Pour l'instant, on utilise le moment actuel
            }

            console.log('[SpecializedSearchScreen] 🔍 Recherche spécialisée:', {
                specializedType,
                searchQuery,
                hasGPS: !!gpsData,
                radius: searchRadius,
                moment: searchMoment,
            });

            // Lancer la recherche via /api/search/direct qui détecte automatiquement specialized_type
            const response = await apiPost('/api/search/direct', payload);

            if (response?.success === false) {
                Alert.alert('Erreur', response.error || 'Erreur lors de la recherche');
                return;
            }

            // Extraire les résultats
            const results = response?.resultats?.resultats || response?.resultats || response?.data || [];

            // Naviguer vers ResultatBesoin avec les résultats
            (navigation as any).navigate('ResultatBesoin', {
                results: results,
                searchQuery: searchQuery.trim(),
                specializedType: specializedType,
                fromSpecializedSearch: true,
            });
        } catch (error: any) {
            console.error('[SpecializedSearchScreen] ❌ Erreur recherche:', error);
            Alert.alert('Erreur', error.message || 'Erreur lors de la recherche spécialisée');
        } finally {
            setLoading(false);
        }
    };

    if (!specializedType || !serviceName) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Paramètres manquants</Text>
                <NativeButton
                    title="Retour"
                    onPress={() => navigation.goBack()}
                    variant="primary"
                />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        {serviceIcon && (
                            <Text style={styles.serviceIcon}>{serviceIcon}</Text>
                        )}
                        <Text style={styles.serviceTitle}>{serviceName}</Text>
                        <Text style={styles.serviceSubtitle}>Recherche spécialisée</Text>
                    </View>
                </View>

                {/* Formulaire de recherche */}
                <View style={styles.formContainer}>
                    {/* Champ de recherche texte */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Que recherchez-vous ?</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Ex: urologue disponible, pharmacie de garde..."
                            placeholderTextColor={modernColors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            multiline
                            numberOfLines={3}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Localisation (optionnel)</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {gpsData
                                    ? `${gpsData.lat.toFixed(4)}, ${gpsData.lng.toFixed(4)}`
                                    : 'Sélectionner une position GPS'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Rayon de recherche */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Rayon de recherche : {searchRadius} km</Text>
                        <View style={styles.radiusSelector}>
                            {[10, 25, 50, 100].map((radius) => (
                                <TouchableOpacity
                                    key={radius}
                                    style={[
                                        styles.radiusButton,
                                        searchRadius === radius && styles.radiusButtonActive,
                                    ]}
                                    onPress={() => setSearchRadius(radius)}
                                >
                                    <Text
                                        style={[
                                            styles.radiusButtonText,
                                            searchRadius === radius && styles.radiusButtonTextActive,
                                        ]}
                                    >
                                        {radius} km
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Moment/Planning */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Quand ?</Text>
                        <View style={styles.momentSelector}>
                            <TouchableOpacity
                                style={[
                                    styles.momentButton,
                                    searchMoment === 'now' && styles.momentButtonActive,
                                ]}
                                onPress={() => setSearchMoment('now')}
                            >
                                <SafeIcon
                                    name="clock"
                                    size={20}
                                    color={searchMoment === 'now' ? '#fff' : modernColors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.momentButtonText,
                                        searchMoment === 'now' && styles.momentButtonTextActive,
                                    ]}
                                >
                                    Maintenant
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.momentButton,
                                    searchMoment === 'later' && styles.momentButtonActive,
                                ]}
                                onPress={() => setSearchMoment('later')}
                            >
                                <SafeIcon
                                    name="calendar"
                                    size={20}
                                    color={searchMoment === 'later' ? '#fff' : modernColors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.momentButtonText,
                                        searchMoment === 'later' && styles.momentButtonTextActive,
                                    ]}
                                >
                                    Plus tard
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bouton de recherche */}
                    <NativeButton
                        title="Rechercher"
                        onPress={handleSearch}
                        variant="primary"
                        loading={loading}
                        style={styles.searchButton}
                    />
                </View>
            </ScrollView>

            {/* Modal GPS */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={gpsData || undefined}
                title="Sélectionner la position GPS"
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        marginRight: 16,
        padding: 8,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    serviceIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    serviceSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    formContainer: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: '#F9FAFB',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#F9FAFB',
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    radiusSelector: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    radiusButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    radiusButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    radiusButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    radiusButtonTextActive: {
        color: '#FFFFFF',
    },
    momentSelector: {
        flexDirection: 'row',
        gap: 12,
    },
    momentButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        gap: 8,
    },
    momentButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    momentButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    momentButtonTextActive: {
        color: '#FFFFFF',
    },
    searchButton: {
        marginTop: 8,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
        textAlign: 'center',
        margin: 20,
    },
});

export default SpecializedSearchScreen;

