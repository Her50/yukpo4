import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    Button,
    Card,
    Chip,
    FAB,
    Paragraph,
    Searchbar,
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { serviceService } from '../services/api';

interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    price?: number;
    location?: string;
    rating?: number;
}

const HomeScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { location, getCurrentLocation } = useLocation();

    const [searchQuery, setSearchQuery] = useState('');
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const categories = [
        'Coiffure', 'Restaurant', 'Transport', 'Santé', 'Éducation', 'Technologie'
    ];

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        try {
            setLoading(true);
            const response = await serviceService.getServices({ limit: 10 });
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

    const handleCategoryPress = (category: string) => {
        navigation.navigate('Search' as never, { category } as never);
    };

    const handleServicePress = (serviceId: string) => {
        navigation.navigate('ServiceDetail' as never, { serviceId } as never);
    };

    const handleCreateService = () => {
        navigation.navigate('CreateService' as never);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <Title style={styles.greeting}>
                        Bonjour {user?.name || 'Utilisateur'} 👋
                    </Title>
                    <Paragraph style={styles.subtitle}>
                        Que recherchez-vous aujourd'hui ?
                    </Paragraph>
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

                {/* Location */}
                {location && (
                    <Card style={styles.locationCard}>
                        <Card.Content style={styles.locationContent}>
                            <Ionicons name="location" size={16} color="#2563eb" />
                            <Text style={styles.locationText}>
                                {location.city}, {location.country}
                            </Text>
                        </Card.Content>
                    </Card>
                )}

                {/* Categories */}
                <View style={styles.section}>
                    <Title style={styles.sectionTitle}>Catégories</Title>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.categoriesContainer}>
                            {categories.map((category, index) => (
                                <Chip
                                    key={index}
                                    mode="outlined"
                                    onPress={() => handleCategoryPress(category)}
                                    style={styles.categoryChip}
                                >
                                    {category}
                                </Chip>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                {/* Recent Services */}
                <View style={styles.section}>
                    <Title style={styles.sectionTitle}>Services récents</Title>
                    {services.map((service) => (
                        <Card
                            key={service.id}
                            style={styles.serviceCard}
                            onPress={() => handleServicePress(service.id)}
                        >
                            <Card.Content>
                                <Title style={styles.serviceTitle}>{service.name}</Title>
                                <Paragraph style={styles.serviceDescription}>
                                    {service.description}
                                </Paragraph>
                                <View style={styles.serviceFooter}>
                                    <Chip mode="outlined" compact>
                                        {service.category}
                                    </Chip>
                                    {service.price && (
                                        <Text style={styles.servicePrice}>
                                            {service.price} FCFA
                                        </Text>
                                    )}
                                </View>
                            </Card.Content>
                        </Card>
                    ))}
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Title style={styles.sectionTitle}>Actions rapides</Title>
                    <View style={styles.quickActions}>
                        <Button
                            mode="contained"
                            onPress={() => navigation.navigate('AIHub' as never)}
                            style={styles.quickActionButton}
                            icon="robot"
                        >
                            IA Hub
                        </Button>
                        <Button
                            mode="outlined"
                            onPress={() => navigation.navigate('MyServices' as never)}
                            style={styles.quickActionButton}
                            icon="briefcase"
                        >
                            Mes Services
                        </Button>
                    </View>
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <FAB
                style={styles.fab}
                icon="plus"
                onPress={handleCreateService}
                label="Créer"
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingBottom: 10,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    searchBar: {
        elevation: 2,
    },
    locationCard: {
        marginHorizontal: 20,
        marginBottom: 20,
    },
    locationContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        marginLeft: 8,
        color: '#2563eb',
        fontSize: 14,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
        paddingHorizontal: 20,
    },
    categoriesContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
    },
    categoryChip: {
        marginRight: 8,
    },
    serviceCard: {
        marginHorizontal: 20,
        marginBottom: 12,
        elevation: 2,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 8,
    },
    serviceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    quickActions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
    },
    quickActionButton: {
        flex: 1,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#2563eb',
    },
});

export default HomeScreen;

