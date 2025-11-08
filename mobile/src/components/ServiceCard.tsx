import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import useFavorites from '../hooks/useFavorites';
import useOnlineStatus from '../hooks/useOnlineStatus';
import useServiceMedia from '../hooks/useServiceMedia';
import { useServiceStats } from '../hooks/useServiceStats';
import useWebSocket from '../hooks/useWebSocket';
import { theme } from '../theme/theme';
import { normalizeServiceProducts } from '../utils/productNormalizer';
import ChatModalAdvanced from './ChatModalAdvanced';
import LocationDisplayModern from './LocationDisplayModern';
import ProductPricing from './ProductPricing';
import ServiceMediaGallery from './ServiceMediaGallery';
import ServiceRating from './ServiceRating';
import ServiceStats from './ServiceStats';

const { width } = Dimensions.get('window');

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
    created_at?: string;
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

interface ServiceCardProps {
    service: Service;
    prestataire?: Prestataire;
    isOnline?: boolean;
    lastSeen?: Date | null;
    onContact?: (service: Service) => void;
    onChat?: (service: Service) => void;
    onGallery?: (service: Service) => void;
    onFavorite?: (service: Service) => void;
    onShare?: (service: Service) => void;
    compact?: boolean;
    showActions?: boolean;
    // Nouvelles props pour la parité avec le frontend
    prestataires?: Map<number, any>;
    user?: any;
    wsConnected?: boolean;
    userStatus?: any;
}

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

    return 'Non spécifié';
};

// Fonction pour formater la date
const formatDate = (dateString: string): string => {
    if (!dateString) return 'Date non disponible';
    try {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();

        const monthNames = [
            'janv', 'fév', 'mars', 'avr', 'mai', 'juin',
            'juil', 'août', 'sept', 'oct', 'nov', 'déc'
        ];

        return `${day} ${monthNames[month]} ${year}`;
    } catch {
        return 'Date invalide';
    }
};

const ServiceCard: React.FC<ServiceCardProps> = ({
    service,
    prestataire,
    isOnline = false,
    lastSeen = null,
    onContact,
    onChat,
    onGallery,
    onFavorite,
    onShare,
    compact = false,
    showActions = true,
    // Nouvelles props
    prestataires,
    user: propUser,
    wsConnected = false,
    userStatus
}) => {
    const navigation = useNavigation();
    const { user: authUser } = useAuth();
    const user = propUser || authUser;
    const [isFavoritedLocal, setIsFavoritedLocal] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [showChat, setShowChat] = useState(false);

    // Utiliser les hooks pour la parité avec le frontend
    const serviceMedia = useServiceMedia(service.id);
    const { isOnline: realTimeOnline, lastSeen: realTimeLastSeen } = useOnlineStatus(
        service.user_id,
        wsConnected,
        userStatus,
        service.created_at
    );
    const { isFavorited, toggleFavorite } = useFavorites(user?.id);
    const { stats: serviceStats } = useServiceStats(parseInt(service.id), service.created_at || new Date().toISOString());

    // Gérer la connexion WebSocket pour les mises à jour en temps réel
    const { isConnected: wsIsConnected, sendUserStatus } = useWebSocket(user?.id, {
        onUserStatusUpdate: (update) => {
            console.log('📡 [ServiceCard] Mise à jour statut utilisateur:', update.data);
        },
        onConnectionChange: (connected) => {
            console.log('📡 [ServiceCard] WebSocket:', connected ? 'connecté' : 'déconnecté');
        }
    });

    // Utiliser le statut en temps réel si disponible, sinon fallback sur les props
    const finalIsOnline = wsIsConnected ? realTimeOnline : isOnline;
    const finalLastSeen = wsIsConnected ? realTimeLastSeen : lastSeen;

    const handleContact = () => {
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
        onContact?.(service);
    };

    const handleChat = () => {
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
        setShowChat(true);
    };

    const handleGallery = () => {
        setShowGallery(true);
        onGallery?.(service);
    };

    const handleFavorite = async () => {
        if (!user) {
            Alert.alert(
                "Connexion requise",
                "Veuillez vous connecter pour ajouter aux favoris",
                [
                    { text: "Annuler", style: "cancel" },
                    { text: "Se connecter", onPress: () => navigation.navigate('Login' as never) }
                ]
            );
            return;
        }

        try {
            const success = await toggleFavorite(service.id);
            if (success) {
                setIsFavoritedLocal(!isFavoritedLocal);
                Alert.alert(
                    'Succès',
                    isFavorited(service.id) ? 'Service ajouté aux favoris !' : 'Service retiré des favoris !'
                );
            } else {
                Alert.alert('Erreur', 'Impossible de modifier les favoris');
            }
        } catch (error) {
            console.error('Erreur favori:', error);
            Alert.alert('Erreur', 'Impossible de modifier les favoris');
        }

        onFavorite?.(service);
    };

    const handleShare = async () => {
        try {
            // Générer le lien de partage externe avec redirection intelligente
            const shareUrl = `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/shared-service?serviceId=${service.id}`;

            // En React Native, nous utiliserions react-native-share
            // Pour l'instant, on copie le lien et on affiche une alerte
            console.log('Partage service:', shareUrl);
            Alert.alert(
                'Lien copié !',
                'Le lien a été copié. Les personnes non connectées seront redirigées vers l\'inscription.'
            );
        } catch (error) {
            console.error('Erreur lors du partage:', error);
            Alert.alert('Erreur', 'Impossible de partager le service');
        }

        onShare?.(service);
    };

    const getStatusColor = () => {
        if (finalIsOnline) return '#4CAF50';
        return '#9E9E9E';
    };

    const getStatusText = () => {
        if (finalIsOnline) return 'En ligne';
        if (finalLastSeen) {
            const diffMinutes = Math.floor((Date.now() - finalLastSeen.getTime()) / (1000 * 60));
            if (diffMinutes < 60) return `Il y a ${diffMinutes}min`;
            const diffHours = Math.floor(diffMinutes / 60);
            if (diffHours < 24) return `Il y a ${diffHours}h`;
            return 'Hors ligne';
        }
        return 'Hors ligne';
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return '#4CAF50';
        if (score >= 6) return '#FF9800';
        return '#F44336';
    };

    const getScoreText = (score: number) => {
        if (score >= 8) return 'Excellent';
        if (score >= 6) return 'Bon';
        return 'Moyen';
    };

    return (
        <View style={[styles.card, compact && styles.compactCard]}>
            {/* Header avec logo et badge de score */}
            <View style={styles.header}>
                {/* Logo du service si disponible */}
                {getServiceFieldValue(service.data?.logo) !== 'Non spécifié' && (
                    <View style={styles.logoContainer}>
                        <Image
                            source={{ uri: getServiceFieldValue(service.data?.logo) }}
                            style={styles.logo}
                            resizeMode="cover"
                        />
                    </View>
                )}

                {/* Badge de score */}
                {service.score && (
                    <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(service.score) }]}>
                        <Text style={styles.scoreText}>{Math.round(service.score * 10)}%</Text>
                        <Text style={styles.scoreLabel}>{getScoreText(service.score)}</Text>
                    </View>
                )}
            </View>

            {/* Contenu principal */}
            <View style={[styles.cardContent, styles.content]}>
                {/* Titre et catégorie */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title} numberOfLines={2}>
                        {getServiceFieldValue(service.data?.titre_service) || service.titre}
                    </Text>
                    {getServiceFieldValue(service.data?.category) !== 'Non spécifié' && (
                        <View style={styles.categoryChip}>
                            <Text style={styles.categoryText}>
                                {getServiceFieldValue(service.data?.category)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Description */}
                <Text style={styles.description} numberOfLines={compact ? 2 : 3}>
                    {getServiceFieldValue(service.data?.description) || service.description}
                </Text>

                {/* Produits avec prix */}
                {(() => {
                    // ✅ CORRECTION: Normaliser les produits pour extraire toutes les valeurs
                    const normalizedProducts = normalizeServiceProducts(service.data?.produits);

                    if (normalizedProducts.length > 0) {
                        return (
                            <View style={styles.productPricingContainer}>
                                <ProductPricing products={normalizedProducts} compact={true} />
                            </View>
                        );
                    }
                    return null;
                })()}

                {/* Informations prestataire */}
                <View style={styles.prestataireContainer}>
                    <View style={styles.prestataireInfo}>
                        <View style={[styles.avatar, finalIsOnline && styles.avatarOnline]}>
                            <Text style={styles.avatarText}>
                                {prestataire?.name?.charAt(0) || '?'}
                            </Text>
                        </View>
                        <View style={styles.prestataireDetails}>
                            <Text style={styles.prestataireName}>
                                {prestataire?.name || getServiceFieldValue(service.data?.nom_prestataire) || `Créateur #${service.user_id}`}
                            </Text>
                            <View style={styles.statusContainer}>
                                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                                <Text style={styles.statusText}>{getStatusText()}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Date de création */}
                    {service.created_at && (
                        <Text style={styles.dateText}>
                            {formatDate(service.created_at)}
                        </Text>
                    )}
                </View>

                {/* Localisation GPS moderne */}
                <LocationDisplayModern
                    service={service}
                    serviceCreatorInfo={prestataire ? {
                        id: prestataire.id,
                        name: prestataire.name,
                        location: prestataire.location,
                        coordinates: prestataire.coordinates
                    } : undefined}
                    compact={compact}
                />

                {/* Galerie média avec médias réels */}
                {(() => {
                    // Utiliser les médias réels de l'API si disponibles, sinon fallback sur les données du service
                    const displayImagesRaw = serviceMedia.loading ? [] :
                        (serviceMedia.error ?
                            (getServiceFieldValue(service.data?.images_realisations) !== 'Non spécifié' ?
                                (Array.isArray(getServiceFieldValue(service.data?.images_realisations)) ?
                                    getServiceFieldValue(service.data?.images_realisations) :
                                    [getServiceFieldValue(service.data?.images_realisations)]) : []) :
                            serviceMedia.images);

                    const displayImages: string[] = Array.isArray(displayImagesRaw) ? displayImagesRaw : [];

                    const displayVideosRaw = serviceMedia.loading ? [] :
                        (serviceMedia.error ?
                            (getServiceFieldValue(service.data?.videos) !== 'Non spécifié' ?
                                (Array.isArray(getServiceFieldValue(service.data?.videos)) ?
                                    getServiceFieldValue(service.data?.videos) :
                                    [getServiceFieldValue(service.data?.videos)]) : []) :
                            serviceMedia.videos);

                    const displayVideos: string[] = Array.isArray(displayVideosRaw) ? displayVideosRaw : [];

                    const hasMedia = displayImages.length > 0 || displayVideos.length > 0;

                    if (!hasMedia) return null;

                    return (
                        <View style={styles.mediaGalleryContainer}>
                            <View style={styles.mediaGalleryHeader}>
                                <Text style={styles.mediaIcon}>🖼️</Text>
                                <Text style={styles.mediaGalleryTitle}>Galerie</Text>
                                <TouchableOpacity onPress={handleGallery} style={styles.seeAllButton}>
                                    <Text style={styles.seeAllText}>Voir tout</Text>
                                    <Text style={styles.arrowIcon}>→</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.mediaScrollView}
                                contentContainerStyle={styles.mediaScrollContent}
                            >
                                {/* Images réelles */}
                                {displayImages.slice(0, 10).map((image: string, index: number) => (
                                    <TouchableOpacity
                                        key={`img-${index}`}
                                        style={styles.mediaThumbnail}
                                        onPress={handleGallery}
                                    >
                                        <Image
                                            source={{ uri: image }}
                                            style={styles.mediaThumbnailImage}
                                            resizeMode="cover"
                                        />
                                        {index === 9 && displayImages.length > 10 && (
                                            <View style={styles.moreMediaOverlay}>
                                                <Text style={styles.moreMediaText}>+{displayImages.length - 10}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}

                                {/* Vidéos réelles */}
                                {displayVideos.slice(0, 2).map((video: string, index: number) => (
                                    <TouchableOpacity
                                        key={`vid-${index}`}
                                        style={styles.mediaThumbnail}
                                        onPress={handleGallery}
                                    >
                                        <Image
                                            source={{ uri: video }}
                                            style={styles.mediaThumbnailImage}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.videoPlayOverlay}>
                                            <Text style={styles.playIcon}>▶️</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    );
                })()}

                {/* Actions de management (propriétaire uniquement) */}
                {user && user.id === service.user_id && (
                    <View style={styles.managementContainer}>
                        <Text style={styles.managementTitle}>🛠️ Gestion du service</Text>
                        <View style={styles.managementActions}>
                            <TouchableOpacity
                                style={styles.managementButton}
                                onPress={() => {
                                    navigation.navigate('ProductManagement' as never, { serviceId: service.id } as never);
                                }}
                            >
                                <Text style={styles.managementIcon}>📦</Text>
                                <Text style={styles.managementButtonText}>Produits</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.managementButton}
                                onPress={() => {
                                    navigation.navigate('MemberManagement' as never, { serviceId: service.id } as never);
                                }}
                            >
                                <Text style={styles.managementIcon}>👥</Text>
                                <Text style={styles.managementButtonText}>Membres</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.managementButton}
                                onPress={() => {
                                    navigation.navigate('AdCreation' as never, { serviceId: service.id } as never);
                                }}
                            >
                                <Text style={styles.managementIcon}>📢</Text>
                                <Text style={styles.managementButtonText}>Publicité</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Actions */}
                {showActions && (
                    <View style={styles.actionsContainer}>
                        {/* Bouton principal - Chat */}
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleChat}
                        >
                            <Text style={styles.chatIcon}>💬</Text>
                            <Text style={styles.primaryButtonText}>Démarrer une conversation</Text>
                        </TouchableOpacity>

                        {/* Actions secondaires */}
                        <View style={styles.secondaryActions}>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleContact}
                            >
                                <Text style={styles.actionIcon}>📞</Text>
                                <Text style={styles.secondaryButtonText}>Contacter</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleGallery}
                            >
                                <Text style={styles.actionIcon}>👁️</Text>
                                <Text style={styles.secondaryButtonText}>Galerie</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleFavorite}
                            >
                                <Text style={styles.actionIcon}>{isFavorited(service.id) ? '❤️' : '🤍'}</Text>
                                <Text style={[styles.secondaryButtonText, isFavorited(service.id) && styles.favoritedText]}>
                                    Favoris
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleShare}
                            >
                                <Text style={styles.actionIcon}>📤</Text>
                                <Text style={styles.secondaryButtonText}>Partager</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Statistiques du service */}
                <ServiceStats serviceId={service.id} compact={true} />

                {/* Section notation et avis */}
                <View style={styles.ratingSection}>
                    <ServiceRating
                        service={service}
                        onRatingSubmit={async (rating, comment, mentions) => {
                            try {
                                const response = await fetch(`/api/services/${service.id}/reviews`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${user?.token || ''}`
                                    },
                                    body: JSON.stringify({ rating, comment, mentions })
                                });

                                if (!response.ok) {
                                    throw new Error('Erreur lors de l\'envoi');
                                }
                            } catch (error) {
                                console.error('Erreur envoi avis:', error);
                                throw error;
                            }
                        }}
                        onReviewHelpful={async (reviewId) => {
                            try {
                                await fetch(`/api/reviews/${reviewId}/helpful`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${user?.token || ''}`
                                    }
                                });
                            } catch (error) {
                                console.error('Erreur marquer utile:', error);
                            }
                        }}
                    />
                </View>
            </View>

            {/* Galerie média */}
            <ServiceMediaGallery
                service={service}
                visible={showGallery}
                onClose={() => setShowGallery(false)}
            />

            {/* Chat avancé */}
            <ChatModalAdvanced
                visible={showChat}
                onClose={() => setShowChat(false)}
                service={service}
                prestataire={service.prestataire || {
                    id: service.user_id || 'unknown',
                    name: service.prestataireName || 'Prestataire',
                    email: service.prestataireEmail || '',
                    avatar: service.prestataireAvatar
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 20,
        elevation: 6,
        borderRadius: 20,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    compactCard: {
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    logoContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f5f5f5',
    },
    logo: {
        width: '100%',
        height: '100%',
    },
    scoreBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignItems: 'center',
    },
    scoreText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    scoreLabel: {
        color: 'white',
        fontSize: 10,
    },
    content: {
        paddingTop: 8,
    },
    titleContainer: {
        marginBottom: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    categoryChip: {
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    categoryText: {
        color: 'white',
        fontSize: 12,
    },
    description: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
        marginBottom: 12,
    },
    productPricingContainer: {
        marginBottom: 12,
    },
    prestataireContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    prestataireInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarOnline: {
        backgroundColor: '#4CAF50',
    },
    prestataireDetails: {
        marginLeft: 12,
        flex: 1,
    },
    prestataireName: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    statusText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    dateText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    locationContainer: {
        marginBottom: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f0f8ff',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.primary,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    // Styles pour les icônes Lucide (ajustements d'espacement)
    locationTitle: {
        marginLeft: 4,
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    locationContent: {
        marginLeft: 20,
    },
    locationText: {
        fontSize: 12,
        color: theme.colors.text,
        lineHeight: 16,
    },
    locationUnavailable: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontStyle: 'italic',
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '500',
    },
    mediaGalleryContainer: {
        marginBottom: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    mediaGalleryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    mediaGalleryTitle: {
        marginLeft: 6,
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '600',
        flex: 1,
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: theme.colors.primary + '10',
        borderRadius: 12,
    },
    seeAllText: {
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '500',
        marginRight: 2,
    },
    mediaScrollView: {
        maxHeight: 80,
    },
    mediaScrollContent: {
        paddingRight: 8,
    },
    mediaThumbnail: {
        width: 60,
        height: 60,
        marginRight: 8,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#e9ecef',
    },
    mediaThumbnailImage: {
        width: '100%',
        height: '100%',
    },
    moreMediaOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreMediaText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    videoPlayOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    actionsContainer: {
        marginTop: 8,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    secondaryActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    secondaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        marginHorizontal: 2,
    },
    secondaryButtonText: {
        marginLeft: 4,
        fontSize: 12,
        color: theme.colors.primary,
        fontWeight: '500',
    },
    favoritedText: {
        color: '#F44336',
    },
    ratingSection: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        paddingTop: 16,
    },
    // Styles pour les nouveaux composants natifs
    cardContent: {
        padding: 16,
    },
    mediaIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    arrowIcon: {
        fontSize: 14,
        color: theme.colors.primary,
        marginLeft: 4,
    },
    playIcon: {
        fontSize: 24,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    chatIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    actionIcon: {
        fontSize: 16,
        marginRight: 4,
    },
    avatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    managementContainer: {
        marginBottom: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: '#FFF8E1',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFD54F',
    },
    managementTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#F57C00',
        marginBottom: 8,
    },
    managementActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: 8,
    },
    managementButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFD54F',
        minHeight: 60,
    },
    managementIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    managementButtonText: {
        fontSize: 11,
        color: '#F57C00',
        fontWeight: '500',
        textAlign: 'center',
    },
});

export default ServiceCard;
