import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card, TextInput } from 'react-native-paper';
import { theme } from '../theme/theme';

const TestSearchScreen: React.FC = () => {
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);

    const mockResults = [
        {
            id: '1',
            title: 'Coiffure à domicile',
            category: 'Beauté',
            price: '5000 XAF',
            location: 'Douala, Cameroun',
            rating: 4.5,
        },
        {
            id: '2',
            title: 'Réparation smartphone',
            category: 'Réparation',
            price: '15000 XAF',
            location: 'Yaoundé, Cameroun',
            rating: 4.8,
        },
        {
            id: '3',
            title: 'Cours de mathématiques',
            category: 'Éducation',
            price: '8000 XAF',
            location: 'Douala, Cameroun',
            rating: 4.2,
        },
    ];

    const handleSearch = () => {
        if (!searchText.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir votre recherche');
            return;
        }

        setLoading(true);

        // Simulation d'une recherche
        setTimeout(() => {
            setResults(mockResults.filter(item =>
                item.title.toLowerCase().includes(searchText.toLowerCase()) ||
                item.category.toLowerCase().includes(searchText.toLowerCase())
            ));
            setLoading(false);
        }, 1000);
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🔍 Recherche de Services</Text>
                <Text style={styles.subtitle}>Test de la fonctionnalité de recherche</Text>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Que recherchez-vous ?"
                        mode="outlined"
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity
                        style={styles.searchButton}
                        onPress={handleSearch}
                        disabled={loading}
                    >
                        <Text style={styles.searchButtonText}>
                            {loading ? '⏳' : '🔍'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.resultsSection}>
                {loading && (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Recherche en cours...</Text>
                    </View>
                )}

                {!loading && results.length > 0 && (
                    <>
                        <Text style={styles.resultsTitle}>
                            {results.length} résultat(s) trouvé(s)
                        </Text>
                        {results.map((item) => (
                            <Card key={item.id} style={styles.resultCard}>
                                <Card.Content>
                                    <Text style={styles.resultTitle}>{item.title}</Text>
                                    <Text style={styles.resultCategory}>{item.category}</Text>
                                    <Text style={styles.resultPrice}>{item.price}</Text>
                                    <Text style={styles.resultLocation}>📍 {item.location}</Text>
                                    <Text style={styles.resultRating}>⭐ {item.rating}/5</Text>
                                </Card.Content>
                            </Card>
                        ))}
                    </>
                )}

                {!loading && results.length === 0 && searchText && (
                    <View style={styles.noResultsContainer}>
                        <Text style={styles.noResultsText}>Aucun résultat trouvé</Text>
                        <Text style={styles.noResultsSubtext}>
                            Essayez avec d'autres mots-clés
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        backgroundColor: theme.colors.primary,
        padding: 20,
        paddingTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    searchSection: {
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInput: {
        flex: 1,
        backgroundColor: 'white',
    },
    searchButton: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
    },
    searchButtonText: {
        color: 'white',
        fontSize: 18,
    },
    resultsSection: {
        padding: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
    },
    resultCard: {
        marginBottom: 12,
        backgroundColor: 'white',
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    resultCategory: {
        fontSize: 14,
        color: theme.colors.primary,
        marginBottom: 4,
    },
    resultPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: '#10B981',
        marginBottom: 4,
    },
    resultLocation: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 4,
    },
    resultRating: {
        fontSize: 14,
        color: '#F59E0B',
    },
    noResultsContainer: {
        alignItems: 'center',
        padding: 40,
    },
    noResultsText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    noResultsSubtext: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
});

export default TestSearchScreen;









