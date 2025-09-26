import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Button,
    Card,
    Chip,
    Paragraph,
    Searchbar,
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiService, serviceService } from '../services/api';

interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    price?: number;
    location?: string;
    rating?: number;
    provider: {
        name: string;
        rating: number;
    };
}

const SearchScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [showAiSuggestions, setShowAiSuggestions] = useState(false);

    // Récupérer les paramètres de navigation
    const initialQuery = route.params?.query || '';
    const initialCategory = route.params?.category || '';

    useEffect(() => {
        if (initialQuery) {
            setSearchQuery(initialQuery);
            handleSearch(initialQuery);
        } else if (initialCategory) {
            setSearchQuery(initialCategory);
            handleCategorySearch(initialCategory);
        }
    }, [initialQuery, initialCategory]);

    const handleSearch = async (query: string) => {
        if (!query.trim()) return;

        try {
            setLoading(true);
            setShowAiSuggestions(false);

            // Recherche traditionnelle
            const response = await serviceService.searchServices(query);
            setServices(response.data.services || []);

            // Si peu de résultats, essayer l'IA
            if (response.data.services?.length < 3) {
                await getAISuggestions(query);
            }
        } catch (error) {
            console.error('Erreur lors de la recherche:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCategorySearch = async (category: string) => {
        try {
            setLoading(true);
            const response = await serviceService.getServices({ category });
            setServices(response.data.services || []);
        } catch (error) {
            console.error('Erreur lors de la recherche par catégorie:', error);
        } finally {
            setLoading(false);
        }
    };

    const getAISuggestions = async (query: string) => {
        try {
            const response = await aiService.generateSuggestions(query);
            setAiSuggestions(response.data.suggestions || []);
            setShowAiSuggestions(true);
        } catch (error) {
            console.error('Erreur lors de la génération de suggestions IA:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        if (searchQuery) {
            await handleSearch(searchQuery);
        }
        setRefreshing(false);
    };

    const handleServicePress = (serviceId: string) => {
        navigation.navigate('ServiceDetail' as never, { serviceId } as never);
    };

    const handleSuggestionPress = (suggestion: string) => {
        setSearchQuery(suggestion);
        handleSearch(suggestion);
        setShowAiSuggestions(false);
    };

    const renderService = ({ item }: { item: Service }) => (
        <Card
            style={styles.serviceCard}
            onPress={() => handleServicePress(item.id)}
        >
            <Card.Content>
                <View style={styles.serviceHeader}>
                    <Title style={styles.serviceTitle}>{item.name}</Title>
                    {item.price && (
                        <Text style={styles.servicePrice}>{item.price} FCFA</Text>
                    )}
                </View>

                <Paragraph style={styles.serviceDescription}>
                    {item.description}
                </Paragraph>

                <View style={styles.serviceFooter}>
                    <Chip mode="outlined" compact style={styles.categoryChip}>
                        {item.category}
                    </Chip>

                    {item.location && (
                        <View style={styles.locationInfo}>
                            <Ionicons name="location-outline" size={14} color="#64748b" />
                            <Text style={styles.locationText}>{item.location}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{item.provider.name}</Text>
                    {item.provider.rating && (
                        <View style={styles.ratingContainer}>
                            <Ionicons name="star" size={14} color="#fbbf24" />
                            <Text style={styles.ratingText}>{item.provider.rating}</Text>
                        </View>
                    )}
                </View>
            </Card.Content>
        </Card>
    );

    const renderAISuggestion = (suggestion: string, index: number) => (
        <Chip
            key={index}
            mode="outlined"
            onPress={() => handleSuggestionPress(suggestion)}
            style={styles.suggestionChip}
            icon="lightbulb"
        >
            {suggestion}
        </Chip>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Title style={styles.title}>Recherche</Title>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Rechercher un service..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    onSubmitEditing={() => handleSearch(searchQuery)}
                    style={styles.searchBar}
                />
            </View>

            {/* AI Suggestions */}
            {showAiSuggestions && aiSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>
                        Suggestions IA pour "{searchQuery}"
                    </Text>
                    <View style={styles.suggestionsList}>
                        {aiSuggestions.map(renderAISuggestion)}
                    </View>
                </View>
            )}

            {/* Results */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={styles.loadingText}>Recherche en cours...</Text>
                </View>
            ) : (
                <FlatList
                    data={services}
                    renderItem={renderService}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.resultsList}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={64} color="#cbd5e1" />
                            <Text style={styles.emptyTitle}>Aucun résultat</Text>
                            <Text style={styles.emptyText}>
                                Essayez avec d'autres mots-clés ou utilisez nos suggestions IA
                            </Text>
                            <Button
                                mode="contained"
                                onPress={() => setShowAiSuggestions(true)}
                                style={styles.suggestionsButton}
                                icon="lightbulb"
                            >
                                Voir les suggestions IA
                            </Button>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchBar: {
        elevation: 2,
    },
    suggestionsContainer: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    suggestionsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
    },
    suggestionsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    suggestionChip: {
        marginBottom: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
    resultsList: {
        padding: 20,
    },
    serviceCard: {
        marginBottom: 16,
        elevation: 2,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    serviceDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 12,
    },
    serviceFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryChip: {
        marginRight: 12,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 4,
    },
    providerInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    providerName: {
        fontSize: 12,
        color: '#64748b',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    suggestionsButton: {
        marginTop: 8,
    },
});

export default SearchScreen;

