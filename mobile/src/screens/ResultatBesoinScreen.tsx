import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Card, Paragraph, Title } from 'react-native-paper';
import ChatModal from '../components/ChatModal';
import ServiceCard from '../components/ServiceCard';
import ServiceGalleryModal from '../components/ServiceGalleryModal';
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
    const [showChatModal, setShowChatModal] = useState(false);
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedPrestataire, setSelectedPrestataire] = useState<Prestataire | null>(null);

    // États pour le filtre par prix
    const [priceFilter, setPriceFilter] = useState<{
        min: number | null;
        max: number | null;
        currency: string;
    }>({ min: null, max: null, currency: 'XAF' });
    const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'distance'>('relevance');
    const [showPriceFilter, setShowPriceFilter] = useState(false);

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

    // Fonction pour extraire le prix d'un service
    const getServicePrice = (service: Service): number | null => {
        // Chercher dans les produits
        const produitsField = service.data?.produits;
        if (produitsField) {
            let produits = [];
            if (Array.isArray(produitsField)) {
                produits = produitsField;
            } else if (produitsField.valeur && Array.isArray(produitsField.valeur)) {
                produits = produitsField.valeur;
            }

            if (produits.length > 0) {
                // Retourner le prix du premier produit
                const firstProduct = produits[0];
                if (firstProduct.price) {
                    return parseFloat(firstProduct.price);
                }
            }
        }

        // Chercher dans les champs de prix directs
        const priceField = service.data?.prix || service.data?.price;
        if (priceField) {
            if (typeof priceField === 'number') return priceField;
            if (typeof priceField === 'string') {
                const parsed = parseFloat(priceField);
                return isNaN(parsed) ? null : parsed;
            }
        }

        return null;
    };

    // Fonction pour filtrer et trier les services
    const filterAndSortServices = (servicesList: Service[]): Service[] => {
        let filteredServices = [...servicesList];

        // Appliquer le filtre par prix
        if (priceFilter.min !== null || priceFilter.max !== null) {
            filteredServices = filteredServices.filter(service => {
                const price = getServicePrice(service);
                if (price === null) return false;

                if (priceFilter.min !== null && price < priceFilter.min) return false;
                if (priceFilter.max !== null && price > priceFilter.max) return false;

                return true;
            });
        }

        // Appliquer le tri
        filteredServices.sort((a, b) => {
            switch (sortBy) {
                case 'price_asc': {
                    const priceA = getServicePrice(a) || Infinity;
                    const priceB = getServicePrice(b) || Infinity;
                    return priceA - priceB;
                }
                case 'price_desc': {
                    const priceA = getServicePrice(a) || 0;
                    const priceB = getServicePrice(b) || 0;
                    return priceB - priceA;
                }
                case 'distance': {
                    // Tri par distance (si disponible)
                    const distanceA = a.distance || Infinity;
                    const distanceB = b.distance || Infinity;
                    return distanceA - distanceB;
                }
                case 'relevance':
                default: {
                    // Tri par pertinence (score)
                    const scoreA = a.score || 0;
                    const scoreB = b.score || 0;
                    return scoreB - scoreA;
                }
            }
        });

        return filteredServices;
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
                        const enrichedService: Service = {
                            ...service,
                            score: originalResults[index]?.score || 0,
                            semantic_score: originalResults[index]?.semantic_score || 0,
                            interaction_score: originalResults[index]?.interaction_score || 0,
                            gps: originalResults[index]?.gps || undefined,
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
            const validServices = results.filter((service): service is Service => service !== null);

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

        const prestataire = prestataires.get(service.user_id);
        if (prestataire) {
            setSelectedService(service);
            setSelectedPrestataire(prestataire);
            setShowChatModal(true);
        } else {
            Alert.alert("Erreur", "Impossible de récupérer les informations du prestataire");
        }
    };

    const handleGallery = (service: Service) => {
        setSelectedService(service);
        setShowGalleryModal(true);
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

    // Composant ServiceCard amélioré
    const ServiceCardComponent = ({ service }: { service: Service }) => {
        const prestataire = prestataires.get(service.user_id);
        const isOnline = prestataire?.isOnline || false;
        const lastSeen = prestataire?.lastSeen ? new Date(prestataire.lastSeen) : null;

        return (
            <ServiceCard
                service={service}
                prestataire={prestataire}
                isOnline={isOnline}
                lastSeen={lastSeen}
                onContact={handleContact}
                onChat={handleChat}
                onGallery={handleGallery}
                onFavorite={(service) => {
                    Alert.alert('Favoris', `Service ${service.titre} ajouté aux favoris`);
                }}
                onShare={(service) => {
                    Alert.alert('Partage', `Partager le service: ${service.titre}`);
                }}
                showActions={true}
            />
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
                <TouchableOpacity
                    onPress={handleGeolocation}
                    style={styles.geoButton}
                >
                    <Ionicons name="map" size={16} color="#007AFF" />
                    <Text>Trier par proximité</Text>
                </TouchableOpacity>
            </View>

            {/* Messages d'erreur */}
            {error && (
                <Card style={styles.errorCard}>
                    <Card.Content style={styles.errorContent}>
                        <Ionicons name="alert-circle" size={48} color="#F44336" />
                        <Title style={styles.errorTitle}>Erreur de chargement</Title>
                        <Paragraph style={styles.errorText}>{error}</Paragraph>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.errorButton}
                        >
                            <Text>Retour</Text>
                        </TouchableOpacity>
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
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.emptyButton}
                        >
                            <Text>Retour aux besoins</Text>
                        </TouchableOpacity>
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
                    {/* Filtres et tri */}
                    <View style={styles.filtersContainer}>
                        <Card style={styles.filtersCard}>
                            <Card.Content>
                                <View style={styles.filtersHeader}>
                                    <Title style={styles.filtersTitle}>Filtres et tri</Title>
                                    <Text style={styles.resultsCount}>
                                        {(() => {
                                            const filteredServices = filterAndSortServices(services);
                                            return `${filteredServices.length} service${filteredServices.length > 1 ? 's' : ''}`;
                                        })()}
                                        {(() => {
                                            const filteredServices = filterAndSortServices(services);
                                            if (filteredServices.length !== services.length) {
                                                return ` (${services.length} au total)`;
                                            }
                                            return '';
                                        })()}
                                    </Text>
                                </View>

                                <View style={styles.filtersButtons}>
                                    <TouchableOpacity
                                        style={styles.filterButton}
                                        onPress={() => setShowPriceFilter(!showPriceFilter)}
                                    >
                                        <Ionicons name="cash" size={20} color={theme.colors.primary} />
                                        <Text style={styles.filterButtonText}>Prix</Text>
                                    </TouchableOpacity>

                                    <View style={styles.sortContainer}>
                                        <Text style={styles.sortLabel}>Trier par:</Text>
                                        <View style={styles.sortButtons}>
                                            <TouchableOpacity
                                                style={[styles.sortButton, sortBy === 'relevance' && styles.sortButtonActive]}
                                                onPress={() => setSortBy('relevance')}
                                            >
                                                <Text style={[styles.sortButtonText, sortBy === 'relevance' && styles.sortButtonTextActive]}>
                                                    Pertinence
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.sortButton, sortBy === 'price_asc' && styles.sortButtonActive]}
                                                onPress={() => setSortBy('price_asc')}
                                            >
                                                <Text style={[styles.sortButtonText, sortBy === 'price_asc' && styles.sortButtonTextActive]}>
                                                    Prix ↑
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.sortButton, sortBy === 'price_desc' && styles.sortButtonActive]}
                                                onPress={() => setSortBy('price_desc')}
                                            >
                                                <Text style={[styles.sortButtonText, sortBy === 'price_desc' && styles.sortButtonTextActive]}>
                                                    Prix ↓
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Filtre par prix */}
                                {showPriceFilter && (
                                    <View style={styles.priceFilterContainer}>
                                        <View style={styles.priceFilterRow}>
                                            <View style={styles.priceInputContainer}>
                                                <Text style={styles.priceLabel}>Prix min</Text>
                                                <TextInput
                                                    style={styles.priceInput}
                                                    value={priceFilter.min?.toString() || ''}
                                                    onChangeText={(text) => setPriceFilter(prev => ({
                                                        ...prev,
                                                        min: text ? parseFloat(text) : null
                                                    }))}
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                            <View style={styles.priceInputContainer}>
                                                <Text style={styles.priceLabel}>Prix max</Text>
                                                <TextInput
                                                    style={styles.priceInput}
                                                    value={priceFilter.max?.toString() || ''}
                                                    onChangeText={(text) => setPriceFilter(prev => ({
                                                        ...prev,
                                                        max: text ? parseFloat(text) : null
                                                    }))}
                                                    placeholder="100000"
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>
                                        <View style={styles.priceFilterActions}>
                                            <TouchableOpacity
                                                style={styles.priceFilterReset}
                                                onPress={() => setPriceFilter({ min: null, max: null, currency: 'XAF' })}
                                            >
                                                <Text style={styles.priceFilterResetText}>Réinitialiser</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.priceFilterApply}
                                                onPress={() => setShowPriceFilter(false)}
                                            >
                                                <Text style={styles.priceFilterApplyText}>Appliquer</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </Card.Content>
                        </Card>
                    </View>

                    {/* Liste des services */}
                    <View style={styles.servicesContainer}>
                        {filterAndSortServices(services).map((service) => (
                            <ServiceCardComponent key={service.id} service={service} />
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

            {/* Chat Modal */}
            <ChatModal
                visible={showChatModal}
                service={selectedService}
                prestataire={selectedPrestataire}
                onClose={() => {
                    setShowChatModal(false);
                    setSelectedService(null);
                    setSelectedPrestataire(null);
                }}
                onSendMessage={(message) => {
                    console.log('Message envoyé:', message);
                }}
            />

            {/* Gallery Modal */}
            <ServiceGalleryModal
                visible={showGalleryModal}
                service={selectedService}
                onClose={() => {
                    setShowGalleryModal(false);
                    setSelectedService(null);
                }}
            />
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
    // Styles pour les filtres
    filtersContainer: {
        padding: 16,
        paddingBottom: 8,
    },
    filtersCard: {
        elevation: 2,
    },
    filtersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    filtersTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    resultsCount: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    filtersButtons: {
        gap: 16,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    filterButtonText: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
        marginLeft: 8,
    },
    sortContainer: {
        gap: 8,
    },
    sortLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    sortButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    sortButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e9ecef',
        alignItems: 'center',
    },
    sortButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    sortButtonText: {
        fontSize: 12,
        color: theme.colors.text,
        fontWeight: '500',
    },
    sortButtonTextActive: {
        color: 'white',
    },
    priceFilterContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e9ecef',
        gap: 16,
    },
    priceFilterRow: {
        flexDirection: 'row',
        gap: 12,
    },
    priceInputContainer: {
        flex: 1,
    },
    priceLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 4,
    },
    priceInput: {
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: theme.colors.text,
        backgroundColor: 'white',
    },
    priceFilterActions: {
        flexDirection: 'row',
        gap: 12,
    },
    priceFilterReset: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e9ecef',
        alignItems: 'center',
    },
    priceFilterResetText: {
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '500',
    },
    priceFilterApply: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: theme.colors.primary,
        borderRadius: 6,
        alignItems: 'center',
    },
    priceFilterApplyText: {
        fontSize: 14,
        color: 'white',
        fontWeight: '600',
    },
});

export default ResultatBesoinScreen;






