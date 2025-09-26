import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native';
import {
    Button,
    Card,
    Chip,
    FAB,
    IconButton,
    Menu,
    Paragraph,
    Text,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { serviceService } from '../../services/api';

interface Service {
    id: string;
    name: string;
    description: string;
    category: string;
    price?: number;
    status: 'active' | 'inactive' | 'pending';
    views: number;
    createdAt: string;
    updatedAt: string;
}

const MyServicesScreen = () => {
    const navigation = useNavigation();

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        try {
            setLoading(true);
            const response = await serviceService.getUserServices();
            setServices(response.data.services || []);
        } catch (error) {
            console.error('Erreur lors du chargement des services:', error);
            Alert.alert('Erreur', 'Impossible de charger vos services');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadServices();
        setRefreshing(false);
    };

    const handleServicePress = (service: Service) => {
        navigation.navigate('ServiceDetail' as never, { serviceId: service.id } as never);
    };

    const handleEditService = (service: Service) => {
        navigation.navigate('EditService' as never, { serviceId: service.id } as never);
    };

    const handleDeleteService = async (service: Service) => {
        Alert.alert(
            'Supprimer le service',
            `Êtes-vous sûr de vouloir supprimer "${service.name}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await serviceService.deleteService(service.id);
                            await loadServices();
                            Alert.alert('Succès', 'Service supprimé avec succès');
                        } catch (error) {
                            Alert.alert('Erreur', 'Impossible de supprimer le service');
                        }
                    },
                },
            ]
        );
    };

    const handleMenuPress = (service: Service) => {
        setSelectedService(service);
        setMenuVisible(true);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return '#10b981';
            case 'inactive':
                return '#f59e0b';
            case 'pending':
                return '#64748b';
            default:
                return '#64748b';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active':
                return 'Actif';
            case 'inactive':
                return 'Inactif';
            case 'pending':
                return 'En attente';
            default:
                return status;
        }
    };

    const renderService = ({ item }: { item: Service }) => (
        <Card style={styles.serviceCard}>
            <Card.Content>
                <View style={styles.serviceHeader}>
                    <View style={styles.serviceInfo}>
                        <Title style={styles.serviceTitle}>{item.name}</Title>
                        <Chip
                            mode="outlined"
                            style={[styles.statusChip, { borderColor: getStatusColor(item.status) }]}
                            textStyle={{ color: getStatusColor(item.status) }}
                        >
                            {getStatusText(item.status)}
                        </Chip>
                    </View>
                    <Menu
                        visible={menuVisible && selectedService?.id === item.id}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <IconButton
                                icon="dots-vertical"
                                onPress={() => handleMenuPress(item)}
                            />
                        }
                    >
                        <Menu.Item
                            onPress={() => {
                                setMenuVisible(false);
                                handleEditService(item);
                            }}
                            title="Modifier"
                            leadingIcon="pencil"
                        />
                        <Menu.Item
                            onPress={() => {
                                setMenuVisible(false);
                                handleDeleteService(item);
                            }}
                            title="Supprimer"
                            leadingIcon="delete"
                        />
                    </Menu>
                </View>

                <Paragraph style={styles.serviceDescription}>
                    {item.description}
                </Paragraph>

                <View style={styles.serviceFooter}>
                    <View style={styles.serviceStats}>
                        <View style={styles.statItem}>
                            <Ionicons name="eye" size={16} color="#64748b" />
                            <Text style={styles.statText}>{item.views} vues</Text>
                        </View>
                        {item.price && (
                            <View style={styles.statItem}>
                                <Ionicons name="cash" size={16} color="#2563eb" />
                                <Text style={styles.statText}>{item.price} FCFA</Text>
                            </View>
                        )}
                    </View>

                    <Chip mode="outlined" compact>
                        {item.category}
                    </Chip>
                </View>

                <View style={styles.serviceActions}>
                    <Button
                        mode="outlined"
                        onPress={() => handleServicePress(item)}
                        style={styles.actionButton}
                        compact
                    >
                        Voir
                    </Button>
                    <Button
                        mode="contained"
                        onPress={() => handleEditService(item)}
                        style={styles.actionButton}
                        compact
                    >
                        Modifier
                    </Button>
                </View>
            </Card.Content>
        </Card>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Title style={styles.title}>Mes services</Title>
                <Text style={styles.subtitle}>
                    {services.length} service{services.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {services.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="briefcase-outline" size={64} color="#cbd5e1" />
                    <Title style={styles.emptyTitle}>Aucun service</Title>
                    <Paragraph style={styles.emptyText}>
                        Créez votre premier service pour commencer à proposer vos services
                    </Paragraph>
                    <Button
                        mode="contained"
                        onPress={() => navigation.navigate('CreateService' as never)}
                        style={styles.createButton}
                        icon="plus"
                    >
                        Créer un service
                    </Button>
                </View>
            ) : (
                <FlatList
                    data={services}
                    renderItem={renderService}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.servicesList}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                />
            )}

            <FAB
                style={styles.fab}
                icon="plus"
                onPress={() => navigation.navigate('CreateService' as never)}
                label="Nouveau"
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
        padding: 20,
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
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
        marginBottom: 12,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    statusChip: {
        alignSelf: 'flex-start',
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
        marginBottom: 12,
    },
    serviceStats: {
        flexDirection: 'row',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 4,
    },
    serviceActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
    },
    createButton: {
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#2563eb',
    },
});

export default MyServicesScreen;

