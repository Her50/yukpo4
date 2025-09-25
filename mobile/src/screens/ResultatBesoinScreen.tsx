import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Avatar, Badge, Button, Card, Paragraph, Title } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { apiPost } from '../services/api';
import { theme } from '../theme/theme';

// Types
interface SearchResult {
    service_id: string;
    score: number;
    semantic_score: number;
    interaction_score: number;
    gps: string;
    distance?: number;
    proximityScore?: number;
}

interface Service {
    id: string;
    titre: string;
    description: string;
    user_id: string;
    data?: any;
    score?: number;
    semantic_score?: number;
    interaction_score?: number;
    gps?: string;
    distance?: number;
    proximityScore?: number;
    [key: string]: any;
}

interface Prestataire {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    isOnline?: boolean;
    lastSeen?: string;
    [key: string]: any;
}

const ResultatBesoinScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();

    // États
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prestataires, setPrestataires] = useState<Map<string, Prestataire>>(new Map());
    const [prestatairesLoaded, setPrestatairesLoaded] = useState(false);

    // Récupérer les résultats depuis la navigation
    const routeParams = (route.params as any) || {};
    const initialResults = routeParams.results || [];

    // Fonction pour calculer la distance entre deux points GPS (formule de Haversine)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Fonction pour trier les résultats par pertinence et proximité
    const sortResultsByRelevanceAndProximity = async (results: SearchResult[]): Promise<SearchResult[]> => {
        try {
            if (!location) {
                // Si pas de géolocalisation, trier seulement par score
                console.log('📍 Géolocalisation non disponible, tri par score uniquement');
                return results.sort((a, b) => (b.score || 0) - (a.score || 0));
            }

            // Enrichir les résultats avec la distance calculée
            const enrichedResults = results.map((result) => {
                let distance = Infinity;

                if (result.gps && typeof result.gps === 'string' && result.gps.includes(',')) {
                    try {
                        const coords = result.gps.split(',');
                        if (coords.length >= 2) {
                            const lat = parseFloat(coords[0]);
                            const lon = parseFloat(coords[1]);
                            if (!isNaN(lat) && !isNaN(lon)) {
                                distance = calculateDistance(
                                    (location as any).coords.latitude,
                                    (location as any).coords.longitude,
                                    lat,
                                    lon
                                );
                            }
                        }
                    } catch (error) {
                        console.warn('Erreur parsing GPS:', error);
                    }
                }

                return {
                    ...result,
                    distance,
                    proximityScore: distance < 1 ? 1.0 : distance < 5 ? 0.8 : distance < 10 ? 0.6 : 0.4
                };
            });

            // Trier par score combiné (pertinence + proximité)
            return enrichedResults.sort((a, b) => {
                const scoreA = (a.score || 0) * 0.7 + (a.proximityScore || 0) * 0.3;
                const scoreB = (b.score || 0) * 0.7 + (b.proximityScore || 0) * 0.3;
                return scoreB - scoreA;
            });
        } catch (error) {
            console.error('❌ Erreur lors du tri des résultats:', error);
            // Fallback: tri par score uniquement
            return results.sort((a, b) => (b.score || 0) - (a.score || 0));
        }
    };

    // Fonction pour récupérer les détails des services
    const fetchServicesByIds = async (serviceIds: string[], originalResults: SearchResult[] = []) => {
        try {
            setLoading(true);
            setError(null);

            const servicePromises = serviceIds.map(async (serviceId, index) => {
                try {
                    const response = await apiPost(`/api/services/${serviceId}`, {});

                    if (response.data) {
                        const service = response.data as Service;

                        // Enrichir le service avec les données de recherche (score, etc.)
                        const enrichedService = {
                            ...service,
                            score: originalResults[index]?.score || 0,
                            semantic_score: originalResults[index]?.semantic_score || 0,
                            interaction_score: originalResults[index]?.interaction_score || 0,
                            gps: originalResults[index]?.gps || null,
                            distance: originalResults[index]?.distance,
                            proximityScore: originalResults[index]?.proximityScore
                        };

                        return enrichedService;
                    } else {
                        console.warn(`⚠️ Service ${serviceId} non trouvé`);
                        return null;
                    }
                } catch (error) {
                    console.error(`❌ Erreur pour le service ${serviceId}:`, error);
                    return null;
                }
            });

            const results = await Promise.all(servicePromises);
            const validServices = results.filter(service => service !== null);

            if (validServices.length === 0) {
                setError("Aucun service trouvé. Les services recherchés ne sont plus disponibles.");
                setServices([]);
            } else {
                setServices(validServices);

                // Récupérer les informations des prestataires
                const userIds = validServices.map(service => service.user_id).filter(id => id);
                if (userIds.length > 0) {
                    await fetchPrestatairesBatch(userIds);
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des services:', error);
            setError('Erreur lors de la récupération des services');
            setServices([]);
        } finally {
            setLoading(false);
        }
    };

    // Fonction pour récupérer les informations des prestataires
    const fetchPrestatairesBatch = async (userIds: string[]) => {
        try {
            const prestatairePromises = userIds.map(async (userId) => {
                try {
                    const response = await apiPost(`/api/users/profile/${userId}`, {});
                    if (response.data) {
                        return { userId, prestataire: response.data as Prestataire };
                    }
                    return null;
                } catch (error) {
                    console.error(`❌ Erreur prestataire ${userId}:`, error);
                    return null;
                }
            });

            const results = await Promise.all(prestatairePromises);
            const newPrestataires = new Map<string, Prestataire>();

            results.forEach(result => {
                if (result) {
                    newPrestataires.set(result.userId, result.prestataire);
                }
            });

            setPrestataires(newPrestataires);
            setPrestatairesLoaded(true);
        } catch (error) {
            console.error('❌ Erreur lors de la récupération des prestataires:', error);
            setPrestatairesLoaded(true); // Marquer comme chargé même en cas d'erreur
        }
    };

    // Traitement initial des résultats
    useEffect(() => {
        const processResults = async () => {
            if (initialResults && Array.isArray(initialResults) && initialResults.length > 0) {
                // Trier les résultats par score de pertinence et proximité
                const sortedResults = await sortResultsByRelevanceAndProximity(initialResults);

                const serviceIds = sortedResults
                    .map((result: any) => result.service_id)
                    .filter((id: any) => id && id !== 'undefined')
                    .map((id: any) => id.toString());

                if (serviceIds.length > 0) {
                    await fetchServicesByIds(serviceIds, sortedResults);
                } else {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };

        processResults();
    }, [initialResults]);

    // Gestionnaires d'événements
    const handleContact = (service: Service) => {
        if (!user) {
            Alert.alert(
                "Connexion requise",
                "Veuillez vous connecter pour contacter le prestataire",
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Se connecter", onPress: () => navigation.navigate('Login' as never) }
                ]
            );
            return;
        }

        // TODO: Ouvrir modal de contact
        Alert.alert("Contact", `Contacter le prestataire pour le service: ${service.titre}`);
    };

    const handleChat = (service: Service) => {
        if (!user) {
            Alert.alert(
                "Connexion requise",
                "Veuillez vous connecter pour chatter avec le prestataire",
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Se connecter", onPress: () => navigation.navigate('Login' as never) }
                ]
            );
            return;
        }

        // TODO: Ouvrir modal de chat
        Alert.alert("Chat", `Ouvrir le chat pour le service: ${service.titre}`);
    };

    const handleGallery = (service: Service) => {
        // TODO: Ouvrir galerie
        Alert.alert("Galerie", `Voir la galerie du service: ${service.titre}`);
    };

    const handleGeolocation = async () => {
        if (!location) {
            Alert.alert(
                "Géolocalisation non disponible",
                "Impossible de récupérer votre position pour le tri par proximité"
            );
            return;
        }

        Alert.alert(
            "Géolocalisation activée",
            `Position: ${(location as any).coords.latitude.toFixed(4)}, ${(location as any).coords.longitude.toFixed(4)}`
        );

        // Recharger les résultats avec le tri par proximité
        if (initialResults && Array.isArray(initialResults)) {
            const sortedResults = await sortResultsByRelevanceAndProximity(initialResults);
            const serviceIds = sortedResults
                .map((result: any) => result.service_id)
                .filter((id: any) => id && id !== 'undefined')
                .map((id: any) => id.toString());

            if (serviceIds.length > 0) {
                await fetchServicesByIds(serviceIds, sortedResults);
            }
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // Recharger les résultats
        if (initialResults && Array.isArray(initialResults)) {
            const sortedResults = await sortResultsByRelevanceAndProximity(initialResults);
            const serviceIds = sortedResults
                .map((result: any) => result.service_id)
                .filter((id: any) => id && id !== 'undefined')
                .map((id: any) => id.toString());

            if (serviceIds.length > 0) {
                await fetchServicesByIds(serviceIds, sortedResults);
            }
        }
        setRefreshing(false);
    }, [initialResults]);

    // Fonction utilitaire pour extraire la valeur d'un champ de service
    const getServiceFieldValue = (field: any): string => {
        if (!field) return 'Non spécifié';

        if (typeof field === 'string') return field;

        if (field && typeof field === 'object') {
            if (field.valeur !== undefined) {
                const value = field.valeur;
                if (typeof value === 'string') return value;
                if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
                if (typeof value === 'number') return value.toString();
                if (Array.isArray(value)) return value.join(', ');
                return String(value);
            }

            if (Object.keys(field).length > 0) {
                const possibleValues = ['value', 'content', 'text', 'data', 'info'];
                for (const key of possibleValues) {
                    if (field[key] !== undefined) {
                        const value = field[key];
                        if (typeof value === 'string') return value;
                        if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
                        if (typeof value === 'number') return value.toString();
                    }
                }
            }
        }

        if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
        if (typeof field === 'number') return field.toString();

        return String(field);
    };

    // Composant ServiceCard
    const ServiceCard = ({ service }: { service: Service }) => {
        const prestataire = prestataires.get(service.user_id);
        const isOnline = prestataire?.isOnline || false;

        return (
            <Card style={styles.serviceCard}>
                <Card.Content>
                    {/* Header avec avatar et statut */}
                    <View style={styles.serviceHeader}>
                        <View style={styles.avatarContainer}>
                            <Avatar.Text
                                size={40}
                                label={prestataire?.name?.charAt(0) || '?'}
                                style={[styles.avatar, isOnline && styles.avatarOnline]}
                            />
                            <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
                        </View>

                        <View style={styles.headerInfo}>
                            <Text style={styles.prestataireName}>{prestataire?.name || 'Prestataire'}</Text>
                            <Text style={styles.statusText}>
                                {isOnline ? 'En ligne' : 'Hors ligne'}
                            </Text>
                        </View>

                        <View style={styles.scoreContainer}>
                            <Badge style={styles.scoreBadge}>
                                {Math.round((service.score || 0) * 100)}%
                            </Badge>
                        </View>
                    </View>

                    {/* Titre et description */}
                    <Title style={styles.serviceTitle}>{service.titre}</Title>
                    <Paragraph style={styles.serviceDescription} numberOfLines={3}>
                        {service.description}
                    </Paragraph>

                    {/* Distance si disponible */}
                    {service.distance && (
                        <View style={styles.distanceContainer}>
                            <Ionicons name="location" size={16} color={theme.colors.primary} />
                            <Text style={styles.distanceText}>
                                {service.distance < 1
                                    ? `${Math.round(service.distance * 1000)}m`
                                    : `${service.distance.toFixed(1)}km`
                                }
                            </Text>
                        </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actionsContainer}>
                        <Button
                            mode="outlined"
                            onPress={() => handleContact(service)}
                            style={styles.actionButton}
                            labelStyle={styles.actionButtonLabel}
                        >
                            Contacter
                        </Button>

                        <Button
                            mode="contained"
                            onPress={() => handleChat(service)}
                            style={styles.actionButton}
                            labelStyle={styles.actionButtonLabel}
                        >
                            Chat
                        </Button>
                    </View>
                </Card.Content>
            </Card>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Recherche des services en cours...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header avec bouton retour */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
                    <Text style={styles.backText}>Retour</Text>
                </TouchableOpacity>
            </View>

            {/* Titre et statistiques */}
            <View style={styles.titleContainer}>
                <Title style={styles.mainTitle}>
                    Services correspondants à votre besoin
                </Title>

                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.statText}>
                            {services.length} service{services.length > 1 ? 's' : ''} trouvé{services.length > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="time" size={20} color={theme.colors.primary} />
                        <Text style={styles.statText}>Résultats en temps réel</Text>
                    </View>
                </View>

                {/* Bouton de géolocalisation */}
                <Button
                    mode="outlined"
                    onPress={handleGeolocation}
                    style={styles.geoButton}
                    icon="map"
                >
                    Trier par proximité
                </Button>
            </View>

            {/* Messages d'erreur */}
            {error && (
                <Card style={styles.errorCard}>
                    <Card.Content style={styles.errorContent}>
                        <Ionicons name="alert-circle" size={48} color="#F44336" />
                        <Title style={styles.errorTitle}>Erreur de chargement</Title>
                        <Paragraph style={styles.errorText}>{error}</Paragraph>
                        <Button
                            mode="contained"
                            onPress={() => navigation.goBack()}
                            style={styles.errorButton}
                        >
                            Retour
                        </Button>
                    </Card.Content>
                </Card>
            )}

            {/* Aucun service trouvé */}
            {!services || services.length === 0 ? (
                <Card style={styles.emptyCard}>
                    <Card.Content style={styles.emptyContent}>
                        <Ionicons name="search" size={48} color="#9E9E9E" />
                        <Title style={styles.emptyTitle}>Aucun service trouvé</Title>
                        <Paragraph style={styles.emptyText}>
                            Aucun prestataire ne correspond à vos critères pour le moment.
                        </Paragraph>
                        <Button
                            mode="contained"
                            onPress={() => navigation.goBack()}
                            style={styles.emptyButton}
                        >
                            Retour aux besoins
                        </Button>
                    </Card.Content>
                </Card>
            ) : !prestatairesLoaded ? (
                <Card style={styles.loadingCard}>
                    <Card.Content style={styles.loadingContent}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Title style={styles.loadingTitle}>Chargement des informations prestataire</Title>
                        <Paragraph style={styles.loadingSubtitle}>
                            Récupération des données GPS et des informations des prestataires...
                        </Paragraph>
                    </Card.Content>
                </Card>
            ) : (
                <>
                    {/* Liste des services */}
                    <View style={styles.servicesContainer}>
                        {services.map((service) => (
                            <ServiceCard key={service.id} service={service} />
                        ))}
                    </View>

                    {/* Footer informatif */}
                    <View style={styles.footerContainer}>
                        <Card style={styles.footerCard}>
                            <Card.Content>
                                <Title style={styles.footerTitle}>Comment procéder ?</Title>
                                <View style={styles.stepsContainer}>
                                    <View style={styles.stepItem}>
                                        <View style={styles.stepNumber}>
                                            <Text style={styles.stepNumberText}>1</Text>
                                        </View>
                                        <Text style={styles.stepText}>Choisissez le service qui vous convient</Text>
                                    </View>
                                    <View style={styles.stepItem}>
                                        <View style={styles.stepNumber}>
                                            <Text style={styles.stepNumberText}>2</Text>
                                        </View>
                                        <Text style={styles.stepText}>Contactez le prestataire via le bouton</Text>
                                    </View>
                                    <View style={styles.stepItem}>
                                        <View style={styles.stepNumber}>
                                            <Text style={styles.stepNumberText}>3</Text>
                                        </View>
                                        <Text style={styles.stepText}>Échangez et finalisez votre projet</Text>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    </View>
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: theme.colors.text,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        marginLeft: 8,
        fontSize: 16,
        color: theme.colors.primary,
    },
    titleContainer: {
        padding: 20,
        alignItems: 'center',
    },
    mainTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
        color: theme.colors.text,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
    },
    statText: {
        marginLeft: 8,
        fontSize: 14,
        color: theme.colors.text,
    },
    geoButton: {
        marginTop: 8,
    },
    errorCard: {
        margin: 16,
    },
    errorContent: {
        alignItems: 'center',
        padding: 20,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: '#F44336',
    },
    errorText: {
        textAlign: 'center',
        marginBottom: 20,
        color: theme.colors.text,
    },
    errorButton: {
        marginTop: 8,
    },
    emptyCard: {
        margin: 16,
    },
    emptyContent: {
        alignItems: 'center',
        padding: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: theme.colors.text,
    },
    emptyText: {
        textAlign: 'center',
        marginBottom: 20,
        color: theme.colors.text,
    },
    emptyButton: {
        marginTop: 8,
    },
    loadingCard: {
        margin: 16,
    },
    loadingContent: {
        alignItems: 'center',
        padding: 20,
    },
    loadingTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        color: theme.colors.text,
    },
    loadingSubtitle: {
        textAlign: 'center',
        color: theme.colors.text,
    },
    servicesContainer: {
        padding: 16,
    },
    serviceCard: {
        marginBottom: 16,
        elevation: 2,
    },
    serviceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        backgroundColor: theme.colors.primary,
    },
    avatarOnline: {
        backgroundColor: '#4CAF50',
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'white',
    },
    statusOnline: {
        backgroundColor: '#4CAF50',
    },
    statusOffline: {
        backgroundColor: '#9E9E9E',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    prestataireName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    statusText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreBadge: {
        backgroundColor: theme.colors.primary,
    },
    serviceTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: theme.colors.text,
    },
    serviceDescription: {
        fontSize: 14,
        color: theme.colors.text,
        marginBottom: 12,
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    distanceText: {
        marginLeft: 4,
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '500',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    actionButtonLabel: {
        fontSize: 12,
    },
    footerContainer: {
        padding: 16,
    },
    footerCard: {
        backgroundColor: '#E3F2FD',
        borderColor: theme.colors.primary,
        borderWidth: 1,
    },
    footerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
        color: theme.colors.primary,
    },
    stepsContainer: {
        flexDirection: 'column',
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    stepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    stepNumberText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    stepText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.primary,
    },
});

export default ResultatBesoinScreen;


