import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as React from "react";
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Card, Paragraph, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { servicesApi } from '../../services/api';
import { theme } from '../../theme/theme';

interface Service {
    id: string;
    title: string;
    description: string;
    status: 'active' | 'inactive' | 'pending';
    createdAt: string;
    views: number;
    interactions: number;
}

const MesServicesScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        try {
            setLoading(true);
            console.log('[MesServices] Chargement des services...');

            // Charger les vraies données depuis l'API
            const response = await servicesApi.getUserServices();

            console.log('[MesServices] Réponse API:', response);

            if (response.success && response.data) {
                const servicesData = Array.isArray(response.data) ? response.data : [];

                // Convertir au format Service
                const formattedServices: Service[] = servicesData.map((service: any) => ({
                    id: service.id?.toString() || '',
                    title: service.titre || service.title || 'Sans titre',
                    description: service.description || '',
                    status: service.is_active ? 'active' : 'inactive',
                    createdAt: service.created_at || new Date().toISOString(),
                    views: service.views || 0,
                    interactions: service.interactions || 0,
                }));

                console.log('[MesServices] Services formatés:', formattedServices.length);
                setServices(formattedServices);
            } else {
                console.warn('[MesServices] Aucun service trouvé');
                setServices([]);
            }
        } catch (error: any) {
            console.error('[MesServices] Erreur chargement services:', error);
            console.error('[MesServices] Détails:', error.message);
            setServices([]);
            // Ne pas afficher d'alerte pour ne pas bloquer l'utilisateur
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#4CAF50';
            case 'inactive': return '#9E9E9E';
            case 'pending': return '#FF9800';
            default: return '#9E9E9E';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return 'Actif';
            case 'inactive': return 'Inactif';
            case 'pending': return 'En attente';
            default: return 'Inconnu';
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.loadingText}>Chargement de vos services...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Title style={styles.title}>Mes Services</Title>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('CreateService' as never)}
                    >
                        <Ionicons name="add" size={24} color="white" />
                        <Text style={styles.addButtonText}>Nouveau</Text>
                    </TouchableOpacity>
                </View>

                {services.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="briefcase-outline" size={64} color="#9E9E9E" />
                        <Text style={styles.emptyTitle}>Aucun service</Text>
                        <Text style={styles.emptyText}>
                            Vous n'avez pas encore créé de service. Créez votre premier service pour commencer.
                        </Text>
                        <TouchableOpacity
                            mode="contained"
                            onPress={() => navigation.navigate('CreateService' as never)}
                            style={styles.createButton}
                        >
                            Créer un service
                        </TouchableOpacity>
                    </View>
                ) : (
                    services.map((service) => (
                        <Card key={service.id} style={styles.serviceCard}>
                            <Card.Content>
                                <View style={styles.serviceHeader}>
                                    <Title style={styles.serviceTitle}>{service.title}</Title>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(service.status) }]}>
                                        <Text style={styles.statusText}>{getStatusText(service.status)}</Text>
                                    </View>
                                </View>

                                <Paragraph style={styles.serviceDescription}>
                                    {service.description}
                                </Paragraph>

                                <View style={styles.serviceStats}>
                                    <View style={styles.statItem}>
                                        <Ionicons name="eye" size={16} color={theme.colors.primary} />
                                        <Text style={styles.statText}>{service.views} vues</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Ionicons name="chatbubbles" size={16} color={theme.colors.primary} />
                                        <Text style={styles.statText}>{service.interactions} interactions</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Ionicons name="calendar" size={16} color={theme.colors.primary} />
                                        <Text style={styles.statText}>{new Date(service.createdAt).toLocaleDateString()}</Text>
                                    </View>
                                </View>

                                <View style={styles.serviceActions}>
                                    <TouchableOpacity
                                        mode="outlined"
                                        onPress={() => navigation.navigate('ServiceDetail' as never, { serviceId: service.id })}
                                        style={styles.actionButton}
                                    >
                                        Voir
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        mode="outlined"
                                        onPress={() => {
                                            // TODO: Implémenter l'édition
                                            Alert.alert('Édition', 'Fonctionnalité d\'édition à implémenter');
                                        }}
                                        style={styles.actionButton}
                                    >
                                        Modifier
                                    </TouchableOpacity>
                                </View>
                            </Card.Content>
                        </Card>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: theme.colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    addButtonText: {
        color: 'white',
        marginLeft: 8,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    createButton: {
        backgroundColor: theme.colors.primary,
    },
    serviceCard: {
        marginBottom: 16,
        elevation: 2,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    serviceDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 12,
    },
    serviceStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statText: {
        marginLeft: 4,
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    serviceActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        marginHorizontal: 4,
    },
});

export default MesServicesScreen;






