// ✅ Écran recherche intelligente taxi avec matching proximité
// Date: 2025-01-29

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { CompatibilityScoreBadge } from '../../components/covoiturage/CompatibilityScoreBadge';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

export const TaxiIntelligentSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();
    const [lat, setLat] = useState<number | null>(location?.coords?.latitude || null);
    const [lng, setLng] = useState<number | null>(location?.coords?.longitude || null);
    const [destinationLat, setDestinationLat] = useState<number | null>(null);
    const [destinationLng, setDestinationLng] = useState<number | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showDestinationModal, setShowDestinationModal] = useState(false);
    const [climatisation, setClimatisation] = useState(false);
    const [wifi, setWifi] = useState(false);
    const [paiementCarte, setPaiementCarte] = useState(false);
    const [prixMax, setPrixMax] = useState<string>('');
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!lat || !lng) {
            alert('Veuillez sélectionner votre position');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/taxis/intelligent-matching', {
                lat,
                lng,
                destination_lat: destinationLat,
                destination_lng: destinationLng,
                climatisation_preferee: climatisation,
                wifi_prefere: wifi,
                paiement_carte: paiementCarte,
                prix_max: prixMax ? parseInt(prixMax) : null,
            });

            if (response && response.matches) {
                setMatches(response.matches);
            }
        } catch (error: any) {
            alert('Erreur: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderMatch = ({ item }: { item: any }) => (
        <NativeCard style={styles.matchCard}>
            <View style={styles.matchHeader}>
                <CompatibilityScoreBadge score={item.compatibility_score} />
                <View style={styles.matchInfo}>
                    <Text style={styles.matchDistance}>
                        {item.distance_km.toFixed(1)} km • {item.estimated_arrival_minutes} min
                    </Text>
                    <Text style={styles.matchPrice}>
                        {item.estimated_price.toLocaleString('fr-FR')} XAF
                    </Text>
                </View>
            </View>

            {item.match_reasons && item.match_reasons.length > 0 && (
                <View style={styles.reasonsContainer}>
                    <Text style={styles.reasonsTitle}>Points positifs:</Text>
                    {item.match_reasons.map((reason: string, index: number) => (
                        <Text key={index} style={styles.reason}>✓ {reason}</Text>
                    ))}
                </View>
            )}

            <NativeButton
                variant="primary"
                onPress={() => navigation.navigate('TaxiDetails' as never, { taxiId: item.taxi_id } as never)}
            >
                Voir détails
            </NativeButton>
        </NativeCard>
    );

    return (
        <ScrollView style={styles.container}>
            <View style={styles.searchSection}>
                <Text style={styles.title}>Recherche intelligente de taxi</Text>

                {/* Position actuelle */}
                <View style={styles.gpsSection}>
                    <Text style={styles.label}>Votre position *</Text>
                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => setShowGPSModal(true)}
                    >
                        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                        <Text style={styles.gpsText}>
                            {lat && lng ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Sélectionner position'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Destination (optionnelle) */}
                <View style={styles.gpsSection}>
                    <Text style={styles.label}>Destination (optionnel)</Text>
                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => setShowDestinationModal(true)}
                    >
                        <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                        <Text style={styles.gpsText}>
                            {destinationLat && destinationLng
                                ? `${destinationLat.toFixed(4)}, ${destinationLng.toFixed(4)}`
                                : 'Sélectionner destination'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Préférences */}
                <View style={styles.preferencesSection}>
                    <Text style={styles.sectionTitle}>Préférences</Text>

                    <View style={styles.preferenceRow}>
                        <Text style={styles.preferenceLabel}>Climatisation</Text>
                        <Switch
                            value={climatisation}
                            onValueChange={setClimatisation}
                        />
                    </View>

                    <View style={styles.preferenceRow}>
                        <Text style={styles.preferenceLabel}>WiFi</Text>
                        <Switch
                            value={wifi}
                            onValueChange={setWifi}
                        />
                    </View>

                    <View style={styles.preferenceRow}>
                        <Text style={styles.preferenceLabel}>Paiement par carte</Text>
                        <Switch
                            value={paiementCarte}
                            onValueChange={setPaiementCarte}
                        />
                    </View>

                    <NativeInput
                        label="Prix maximum (XAF)"
                        value={prixMax}
                        onChangeText={setPrixMax}
                        placeholder="Ex: 5000"
                        keyboardType="numeric"
                    />
                </View>

                <NativeButton
                    variant="primary"
                    onPress={handleSearch}
                    loading={loading}
                    style={styles.searchButton}
                >
                    Rechercher avec matching intelligent
                </NativeButton>
            </View>

            {matches.length > 0 && (
                <View style={styles.resultsSection}>
                    <Text style={styles.resultsTitle}>
                        {matches.length} taxi(s) trouvé(s)
                    </Text>
                    <FlatList
                        data={matches}
                        renderItem={renderMatch}
                        keyExtractor={(item) => item.taxi_id.toString()}
                        scrollEnabled={false}
                    />
                </View>
            )}

            {showGPSModal && (
                <ModernGPSModal
                    visible={showGPSModal}
                    onClose={() => setShowGPSModal(false)}
                    onSelect={(coordinates) => {
                        const [latVal, lngVal] = coordinates.split(',').map(parseFloat);
                        setLat(latVal);
                        setLng(lngVal);
                        setShowGPSModal(false);
                    }}
                />
            )}

            {showDestinationModal && (
                <ModernGPSModal
                    visible={showDestinationModal}
                    onClose={() => setShowDestinationModal(false)}
                    onSelect={(coordinates) => {
                        const [latVal, lngVal] = coordinates.split(',').map(parseFloat);
                        setDestinationLat(latVal);
                        setDestinationLng(lngVal);
                        setShowDestinationModal(false);
                    }}
                />
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    searchSection: {
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    gpsSection: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#374151',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    gpsText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 8,
        flex: 1,
    },
    preferencesSection: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    preferenceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    preferenceLabel: {
        fontSize: 16,
        flex: 1,
    },
    searchButton: {
        marginTop: 16,
    },
    resultsSection: {
        padding: 16,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    matchCard: {
        marginBottom: 16,
        padding: 16,
    },
    matchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    matchInfo: {
        flex: 1,
        marginLeft: 16,
    },
    matchDistance: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    matchPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#10B981',
    },
    reasonsContainer: {
        marginTop: 12,
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
    },
    reasonsTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#10B981',
    },
    reason: {
        fontSize: 14,
        color: '#065F46',
        marginBottom: 4,
    },
});

