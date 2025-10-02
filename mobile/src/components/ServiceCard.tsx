// Migration vers Lucide React Native pour un design moderne
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, Eye, Heart, Images, MapPin, MessageCircle, Phone, Play, Share } from 'lucide-react-native';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar, Card, Chip, Paragraph, Title } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';
import ProductPricing from './ProductPricing';

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
    showActions = true
}) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [isFavorited, setIsFavorited] = useState(false);

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
        onChat?.(service);
    };

    const handleGallery = () => {
        onGallery?.(service);
    };

    const handleFavorite = () => {
        setIsFavorited(!isFavorited);
        onFavorite?.(service);
    };

    const handleShare = () => {
        onShare?.(service);
    };

    const getStatusColor = () => {
        if (isOnline) return '#4CAF50';
        return '#9E9E9E';
    };

    const getStatusText = () => {
        if (isOnline) return 'En ligne';
        if (lastSeen) {
            const diffMinutes = Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60));
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
        <Card style={[styles.card, compact && styles.compactCard]}>
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
            <Card.Content style={styles.content}>
                {/* Titre et catégorie */}
                <View style={styles.titleContainer}>
                    <Title style={styles.title} numberOfLines={2}>
                        {getServiceFieldValue(service.data?.titre_service) || service.titre}
                    </Title>
                    {getServiceFieldValue(service.data?.category) !== 'Non spécifié' && (
                        <Chip style={styles.categoryChip} textStyle={styles.categoryText}>
                            {getServiceFieldValue(service.data?.category)}
                        </Chip>
                    )}
                </View>

                {/* Description */}
                <Paragraph style={styles.description} numberOfLines={compact ? 2 : 3}>
                    {getServiceFieldValue(service.data?.description) || service.description}
                </Paragraph>

                {/* Produits avec prix */}
                {(() => {
                    const produitsField = service.data?.produits;
                    if (produitsField) {
                        let produits = [];
                        if (Array.isArray(produitsField)) {
                            produits = produitsField;
                        } else if (produitsField.valeur && Array.isArray(produitsField.valeur)) {
                            produits = produitsField.valeur;
                        }

                        if (produits.length > 0) {
                            return (
                                <View style={styles.productPricingContainer}>
                                    <ProductPricing products={produits} compact={true} />
                                </View>
                            );
                        }
                    }
                    return null;
                })()}

                {/* Informations prestataire */}
                <View style={styles.prestataireContainer}>
                    <View style={styles.prestataireInfo}>
                        <Avatar.Text
                            size={32}
                            label={prestataire?.name?.charAt(0) || '?'}
                            style={[styles.avatar, isOnline && styles.avatarOnline]}
                        />
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

                {/* Localisation GPS complète */}
                <View style={styles.locationContainer}>
                    <View style={styles.locationHeader}>
                        <MapPin size={16} color={theme.colors.primary} />
                        <Text style={styles.locationTitle}>Localisation</Text>
                    </View>
                    <View style={styles.locationContent}>
                        {getServiceFieldValue(service.data?.gps_fixe) !== 'Non spécifié' ? (
                            <Text style={styles.locationText}>
                                {getServiceFieldValue(service.data?.gps_fixe)}
                            </Text>
                        ) : getServiceFieldValue(service.data?.adresse) !== 'Non spécifié' ? (
                            <Text style={styles.locationText}>
                                {getServiceFieldValue(service.data?.adresse)}
                            </Text>
                        ) : service.distance ? (
                            <View style={styles.distanceContainer}>
                                <Text style={styles.distanceText}>
                                    {service.distance < 1
                                        ? `${Math.round(service.distance * 1000)}m`
                                        : `${service.distance.toFixed(1)}km`
                                    }
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.locationUnavailable}>Localisation non disponible</Text>
                        )}
                    </View>
                </View>

                {/* Galerie média moderne avec défilement */}
                {(getServiceFieldValue(service.data?.images_realisations) !== 'Non spécifié' ||
                    getServiceFieldValue(service.data?.videos) !== 'Non spécifié') && (
                        <View style={styles.mediaGalleryContainer}>
                            <View style={styles.mediaGalleryHeader}>
                                <Images size={16} color={theme.colors.primary} />
                                <Text style={styles.mediaGalleryTitle}>Galerie</Text>
                                <TouchableOpacity onPress={handleGallery} style={styles.seeAllButton}>
                                    <Text style={styles.seeAllText}>Voir tout</Text>
                                    <ChevronRight size={14} color={theme.colors.primary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.mediaScrollView}
                                contentContainerStyle={styles.mediaScrollContent}
                            >
                                {/* Images */}
                                {getServiceFieldValue(service.data?.images_realisations) !== 'Non spécifié' &&
                                    (() => {
                                        const images = getServiceFieldValue(service.data?.images_realisations);
                                        const imageArray = Array.isArray(images) ? images : (images ? [images] : []);
                                        return (imageArray as string[]).slice(0, 10).map((image: string, index: number) => (
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
                                                {index === 9 && imageArray.length > 10 && (
                                                    <View style={styles.moreMediaOverlay}>
                                                        <Text style={styles.moreMediaText}>+{imageArray.length - 10}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        ));
                                    })()}

                                {/* Vidéos */}
                                {getServiceFieldValue(service.data?.videos) !== 'Non spécifié' &&
                                    (() => {
                                        const videos = getServiceFieldValue(service.data?.videos);
                                        const videoArray = Array.isArray(videos) ? videos : (videos ? [videos] : []);
                                        return (videoArray as string[]).slice(0, 2).map((video: string, index: number) => (
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
                                                    <Play size={24} color="rgba(255, 255, 255, 0.9)" />
                                                </View>
                                            </TouchableOpacity>
                                        ));
                                    })()}
                            </ScrollView>
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
                            <MessageCircle size={20} color="white" />
                            <Text style={styles.primaryButtonText}>Démarrer une conversation</Text>
                        </TouchableOpacity>

                        {/* Actions secondaires */}
                        <View style={styles.secondaryActions}>
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleContact}
                            >
                                <Phone size={16} color={theme.colors.primary} />
                                <Text style={styles.secondaryButtonText}>Contacter</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleGallery}
                            >
                                <Eye size={16} color={theme.colors.primary} />
                                <Text style={styles.secondaryButtonText}>Galerie</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleFavorite}
                            >
                                <Heart
                                    size={16}
                                    color={isFavorited ? "#F44336" : theme.colors.primary}
                                    fill={isFavorited ? "#F44336" : "transparent"}
                                />
                                <Text style={[styles.secondaryButtonText, isFavorited && styles.favoritedText]}>
                                    Favoris
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={handleShare}
                            >
                                <Share size={16} color={theme.colors.primary} />
                                <Text style={styles.secondaryButtonText}>Partager</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
        elevation: 3,
        borderRadius: 12,
        backgroundColor: 'white',
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
        backgroundColor: theme.colors.primary,
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
});

export default ServiceCard;
