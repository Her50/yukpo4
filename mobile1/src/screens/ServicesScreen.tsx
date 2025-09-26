import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import {
    Button,
    Card,
    Chip,
    Divider,
    Menu,
    Paragraph,
    Searchbar,
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { serviceService } from '../services/api';

interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    price?: number;
    location?: string;
    rating?: number;
    image?: string;
    provider: {
        name: string;
        rating: number;
    };
}

const ServicesScreen = () => {
    const navigation = useNavigation();

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'price'>('recent');
    const [menuVisible, setMenuVisible] = useState(false);

    const categories = [
        'Tous', 'Coiffure', 'Restaurant', 'Transport', 'Santé', 'Éducation', 'Technologie'
    ];

    useEffect(() => {
        loadServices();
    }, [selectedCategory, sortBy]);

    const loadServices = async () => {
        try {
            setLoading(true);
            const params: any = {
                limit: 20,
                sort: sortBy,
            };

            if (selectedCategory && selectedCategory !== 'Tous') {
                params.category = selectedCategory;
            }

            const response = await serviceService.getServices(params);
            setServices(response.data.services || []);
        } catch (error) {
            console.error('Erreur lors du chargement des services:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadServices();
        setRefreshing(false);
    };

    const handleSearch = () => {
        if (searchQuery.trim()) {
            navigation.navigate('Search' as never, { query: searchQuery } as never);
        }
    };

    const handleServicePress = (serviceId: string) => {
        navigation.navigate('ServiceDetail' as never, { serviceId } as never);
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
                    <View style={styles.serviceInfo}>
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
                </View>
            </Card.Content>
        </Card>
    );

    const renderCategory = (category: string) => (
        <Chip
            key={category}
            mode={selectedCategory === category ? 'flat' : 'outlined'}
            selected={selectedCategory === category}
            onPress={() => setSelectedCategory(category === 'Tous' ? null : category)}
            style={styles.categoryChip}
        >
            {category}
        </Chip>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Title style={styles.title}>Services</Title>
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={
                        <Button
                            mode="outlined"
                            onPress={() => setMenuVisible(true)}
                            icon="sort"
                        >
                            Trier
                        </Button>
                    }
                >
                    <Menu.Item
                        onPress={() => {
                            setSortBy('recent');
                            setMenuVisible(false);
                        }}
                        title="Plus récents"
                        leadingIcon="clock"
                    />
                    <Menu.Item
                        onPress={() => {
                            setSortBy('rating');
                            setMenuVisible(false);
                        }}
                        title="Mieux notés"
                        leadingIcon="star"
                    />
                    <Menu.Item
                        onPress={() => {
                            setSortBy('price');
                            setMenuVisible(false);
                        }}
                        title="Prix"
                        leadingIcon="currency-usd"
                    />
                </Menu>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Searchbar
                    placeholder="Rechercher un service..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    onSubmitEditing={handleSearch}
                    style={styles.searchBar}
                />
            </View>

            {/* Categories */}
            <View style={styles.categoriesContainer}>
                <FlatList
                    data={categories}
                    renderItem={({ item }) => renderCategory(item)}
                    keyExtractor={(item) => item}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesList}
                />
            </View>

            <Divider />

            {/* Services List */}
            <FlatList
                data={services}
                renderItem={renderService}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.servicesList}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            Aucun service trouvé
                        </Text>
                        <Button
                            mode="contained"
                            onPress={loadServices}
                            style={styles.retryButton}
                        >
                            Réessayer
                        </Button>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    categoriesContainer: {
        marginBottom: 16,
    },
    categoriesList: {
        paddingHorizontal: 20,
    },
    categoryChip: {
        marginRight: 8,
    },
    servicesList: {
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
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceInfo: {
        flex: 1,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    locationText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 4,
    },
    providerInfo: {
        alignItems: 'flex-end',
    },
    providerName: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 2,
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
    emptyText: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 16,
    },
    retryButton: {
        marginTop: 8,
    },
});

export default ServicesScreen;

