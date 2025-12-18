// ✅ Écran recherche intelligente avec matching
// Date: 2025-01-29

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { CompatibilityScoreBadge } from '../../components/covoiturage/CompatibilityScoreBadge';
import { IntelligentMatchingFilters, MatchingFilters } from '../../components/covoiturage/IntelligentMatchingFilters';
import { apiPost } from '../../services/api';

export const CovoiturageIntelligentSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const [depart, setDepart] = useState('');
    const [destination, setDestination] = useState('');
    const [dateDepart, setDateDepart] = useState('');
    const [filters, setFilters] = useState<MatchingFilters | null>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const handleSearch = async () => {
        if (!depart || !destination || !dateDepart) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/covoiturages/intelligent-matching', {
                depart,
                destination,
                date_depart: dateDepart,
                ...filters,
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
                    <Text style={styles.matchRoute}>
                        {item.depart} → {item.destination}
                    </Text>
                    <Text style={styles.matchPrice}>{item.estimated_price} XAF</Text>
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
                onPress={() => navigation.navigate('CovoiturageDetails' as never, { id: item.covoiturage_id } as never)}
            >
                Voir détails
            </NativeButton>
        </NativeCard>
    );

    return (
        <ScrollView style={styles.container}>
            <View style={styles.searchSection}>
                <NativeInput
                    label="Ville de départ"
                    value={depart}
                    onChangeText={setDepart}
                    placeholder="Ex: Douala"
                />
                <NativeInput
                    label="Ville de destination"
                    value={destination}
                    onChangeText={setDestination}
                    placeholder="Ex: Yaoundé"
                />
                <NativeInput
                    label="Date de départ"
                    value={dateDepart}
                    onChangeText={setDateDepart}
                    placeholder="YYYY-MM-DD"
                />

                <NativeButton
                    variant="secondary"
                    onPress={() => setShowFilters(!showFilters)}
                    style={styles.filtersButton}
                >
                    {showFilters ? 'Masquer filtres' : 'Afficher filtres'}
                </NativeButton>

                {showFilters && (
                    <IntelligentMatchingFilters
                        onApply={(f) => {
                            setFilters(f);
                            setShowFilters(false);
                        }}
                        initialFilters={filters || undefined}
                    />
                )}

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
                        {matches.length} trajet(s) trouvé(s)
                    </Text>
                    <FlatList
                        data={matches}
                        renderItem={renderMatch}
                        keyExtractor={(item) => item.covoiturage_id.toString()}
                        scrollEnabled={false}
                    />
                </View>
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
    filtersButton: {
        marginVertical: 12,
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
    matchRoute: {
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

