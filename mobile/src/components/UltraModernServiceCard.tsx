import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Linking,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
// Code corrigé (remplace @ts-ignore)
import { useLocationDisplay } from '../hooks/useLocationDisplay';
import { useServiceReviews } from '../hooks/useServiceReviews';
import { useServiceStats } from '../hooks/useServiceStats';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
import SafeIcon from './SafeIcon';
import ServiceMediaGallery from './ServiceMediaGallery';
import ServiceRatingModal from './ServiceRatingModal';

interface Service {
    id: string;
    titre?: string;
    title?: string;
    description?: string;
    prix?: number;
    devise?: string;
    categorie?: string;
    category?: string;
    localisation?: string;
    location?: string;
    prestataire?: {
        id: string;
        nom?: string;
        name?: string;
        email?: string;
        isOnline?: boolean;
        lastSeen?: string;
    };
    statut?: string;
    status?: string;
    date_creation?: string;
    created_at?: string;
    tags?: string[];
    score_relevance?: number;
    score?: number;
    views?: number;
    likes?: number;
    comments?: number;
    isNew?: boolean;
    data?: any;
    gps?: string;
}

interface Review {
    id: number;
    user_id: number;
    user_name: string;
    rating: number;
    comment: string;
    helpful_count: number;
    created_at: string;
}

interface ServiceReviewsStats {
    average_rating: number;
    total_reviews: number;
    rating_distribution: { [key: number]: number };
    completion_rate: number;
    response_time: number;
}

interface ServiceStats {
    views: number;
    shares: number;
    likes: number;
    contacts: number;
    messages: number;
    rating: number;
    totalRatings: number;
    createdDaysAgo: number;
}

interface UltraModernServiceCardProps {
    service: Service;
    prestataireInfo?: any;
    user?: any;
    reviews?: Review[]; // ✅ NOUVEAU 2025-01-01: Reviews passées en props (batch)
    reviewsStats?: ServiceReviewsStats | null; // ✅ NOUVEAU 2025-01-01: Stats reviews passées en props (batch)
    serviceStats?: ServiceStats | null; // ✅ NOUVEAU 2025-01-01: Stats service passées en props (batch)
    onPress: (service: Service) => void;
    onContact: (prestataireId: string, type: 'message' | 'call') => void;
    onShare: (service: Service) => void;
    onFavorite?: (service: Service) => void;
    onGallery?: (service: Service) => void;
    onReview?: (service: Service) => void;
}

const UltraModernServiceCard: React.FC<UltraModernServiceCardProps> = ({
    service,
    prestataireInfo,
    user,
    reviews: reviewsFromProps,
    reviewsStats: reviewsStatsFromProps,
    serviceStats: serviceStatsFromProps,
    onPress,
    onContact,
    onShare,
    onFavorite,
    onGallery,
    onReview,
}) => {
    const [showChatModal, setShowChatModal] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showMediaGallery, setShowMediaGallery] = useState(false);

    // ✅ CORRIGÉ 2025-12-30: Utiliser une valeur stable pour createdAt pour éviter les re-renders en boucle
    // Mémoïser createdAt pour qu'il ne change pas à chaque rendu
    // Utiliser une valeur par défaut stable au lieu de new Date() qui change à chaque rendu
    const stableCreatedAt = useMemo(() => {
        const fallbackDate = '2025-01-01T00:00:00.000Z'; // Valeur stable par défaut
        return service.date_creation || service.created_at || service.data?.date_creation || fallbackDate;
    }, [service.date_creation, service.created_at, service.data?.date_creation]);

    // ✅ NOUVEAU 2025-01-01: Utiliser les données passées en props si disponibles, sinon charger individuellement (fallback)
    // Ne charger que si les props ne sont pas fournies
    const hasProps = reviewsFromProps !== undefined || reviewsStatsFromProps !== undefined || serviceStatsFromProps !== undefined;
    const serviceIdForHook = hasProps ? 0 : parseInt(service.id); // Passer 0 si on a les props pour éviter le chargement

    const { stats: statsFromHook, loading: statsLoading } = useServiceStats(
        serviceIdForHook,
        stableCreatedAt
    );
    const { reviews: reviewsFromHook, stats: reviewsStatsFromHook, submitReview } = useServiceReviews(
        serviceIdForHook
    );
    const { locationData, loading: locationLoading } = useLocationDisplay(service, prestataireInfo);

    // ✅ NOUVEAU 2025-01-01: Utiliser les props si disponibles, sinon les hooks (fallback)
    const reviews = reviewsFromProps !== undefined ? reviewsFromProps : (hasProps ? [] : reviewsFromHook);
    const reviewsStats = reviewsStatsFromProps !== undefined ? reviewsStatsFromProps : (hasProps ? null : reviewsStatsFromHook);
    const serviceStats = serviceStatsFromProps !== undefined ? serviceStatsFromProps : (hasProps ? null : statsFromHook);

    // Fonction pour extraire la valeur d'un champ de service (comme le frontend)
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
        }
        if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
        if (typeof field === 'number') return field.toString();
        return 'Non spécifié';
    };

    // Normaliser les données du service avec extraction des vraies données
    const normalizedService: Service = {
        id: service.id?.toString() || '',
        titre: getServiceFieldValue(service.data?.titre_service) || service.titre || service.title || 'Service sans titre',
        description: getServiceFieldValue(service.data?.description) || service.description || 'Aucune description',
        prix: service.data?.prix?.valeur || service.prix || 0,
        devise: service.data?.devise?.valeur || service.devise || 'XAF',
        categorie: getServiceFieldValue(service.data?.category) || service.categorie || service.category || 'Non spécifié',
        localisation: locationData?.location || getServiceFieldValue(service.data?.localisation) || service.localisation || service.location || 'Non spécifié',
        prestataire: prestataireInfo || service.prestataire || {
            id: service.prestataire?.id || '',
            nom: prestataireInfo?.nom_complet || prestataireInfo?.nom || prestataireInfo?.name || service.prestataire?.nom || service.prestataire?.name || 'Prestataire',
            email: prestataireInfo?.email || service.prestataire?.email || '',
            isOnline: prestataireInfo?.isOnline || service.prestataire?.isOnline || false,
            lastSeen: prestataireInfo?.lastSeen || service.prestataire?.lastSeen || ''
        },
        statut: service.statut || service.status || 'inactif',
        date_creation: service.date_creation || service.created_at || new Date().toISOString(),
        tags: service.tags || [],
        score_relevance: service.score_relevance || service.score || 0,
        // ✅ CORRIGÉ 2025-01-01: Utiliser les vraies statistiques depuis les props ou l'API
        views: serviceStats?.views || 0,
        likes: serviceStats?.likes || 0,
        comments: serviceStats?.contacts || 0,
        isNew: service.isNew || false,
        data: service.data
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch (error) {
            return 'Date inconnue';
        }
    };

    // Obtenir l'icône selon la catégorie
    const getCategoryIcon = (category: string): string => {
        const categoryLower = category?.toLowerCase() || '';

        // Immobilier
        if (categoryLower.includes('immo') || categoryLower.includes('logement') || categoryLower.includes('habitation')) {
            return 'home';
        }
        // Transport
        if (categoryLower.includes('voyage') || categoryLower.includes('transport') || categoryLower.includes('covoiturage')) {
            return 'map';
        }
        // Automobile
        if (categoryLower.includes('auto') || categoryLower.includes('véhicule') || categoryLower.includes('voiture')) {
            return 'car';
        }
        // Livraison
        if (categoryLower.includes('livraison') || categoryLower.includes('colis') || categoryLower.includes('fret')) {
            return 'truck';
        }
        // Commerce
        if (categoryLower.includes('commerce') || categoryLower.includes('bayam') || categoryLower.includes('vente')) {
            return 'trending-down';
        }
        // Santé
        if (categoryLower.includes('santé') || categoryLower.includes('sante') || categoryLower.includes('médical') || categoryLower.includes('pharmacie') || categoryLower.includes('hôpital')) {
            return 'heart';
        }
        // Éducation
        if (categoryLower.includes('éducation') || categoryLower.includes('education') || categoryLower.includes('étude') || categoryLower.includes('formation') || categoryLower.includes('scolaire')) {
            return 'book-open';
        }
        // Assurance
        if (categoryLower.includes('assurance') || categoryLower.includes('protection')) {
            return 'shield';
        }
        // Électronique/Tech
        if (categoryLower.includes('électro') || categoryLower.includes('tech') || categoryLower.includes('informatique')) {
            return 'smartphone';
        }
        // Alimentation
        if (categoryLower.includes('aliment') || categoryLower.includes('restaurant') || categoryLower.includes('cuisine')) {
            return 'coffee';
        }
        // Construction
        if (categoryLower.includes('construction') || categoryLower.includes('bâtiment') || categoryLower.includes('travaux')) {
            return 'tool';
        }
        // Beauté/Bien-être
        if (categoryLower.includes('beauté') || categoryLower.includes('coiffure') || categoryLower.includes('esthétique')) {
            return 'scissors';
        }
        // Défaut
        return 'package';
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const handlePress = () => {
        onPress(normalizedService);
    };

    const handleContact = (type: 'message' | 'call') => {
        if (type === 'message') {
            setShowChatModal(true);
        } else {
            onContact(normalizedService.prestataire?.id || '', type);
        }
    };

    const handleShare = async () => {
        try {
            // ✅ CORRIGÉ: Utiliser l'URL du backend Cloud Run qui sert la route /service/:id
            const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpo-backend-376093909298.europe-west1.run.app';
            const serviceUrl = `${SHARE_BASE_URL}/service/${service.id}`;
            const shareText = `🌟 Découvrez ce service sur Yukpo :\n\n${normalizedService.titre}\n\n${normalizedService.description}\n\n💰 Prix: ${normalizedService.prix} ${normalizedService.devise}\n📍 Localisation: ${locationData?.location || 'Non spécifiée'}\n\n🔗 ${serviceUrl}`;

            const result = await Share.share({
                message: shareText,
                title: normalizedService.titre,
                url: serviceUrl,
            });

            if (result.action === Share.sharedAction) {
                console.log('✅ Service partagé avec succès');

                // ✅ CORRIGÉ: Créer une interaction "share" avec apiPost
                if (user?.id) {
                    try {
                        await apiPost(`/api/services/${service.id}/interact`, {
                            type_interaction: 'share',
                            user_id: user.id
                        });
                    } catch (error) {
                        console.error('Erreur enregistrement interaction share:', error);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors du partage:', error);
            Alert.alert('Erreur', 'Impossible de partager le service');
        }

        onShare(normalizedService);
    };

    const handleFavorite = () => {
        onFavorite?.(normalizedService);
    };

    const handleGallery = () => {
        setShowMediaGallery(true);
        onGallery?.(normalizedService);
    };

    const handleReview = () => {
        setShowRatingModal(true);
    };

    const handleRatingSubmit = async (rating: number, comment: string): Promise<boolean> => {
        return await submitReview(rating, comment);
    };

    return (
        <>
            <View style={styles.card}>
                {/* En-tête avec statistiques réelles */}
                <View style={styles.header}>
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <SafeIcon name="eye" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.statValue}>{formatNumber(normalizedService.views || 0)}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="message-square" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.statValue}>{formatNumber(normalizedService.comments || 0)}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="heart" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.statValue}>{formatNumber(normalizedService.likes || 0)}</Text>
                        </View>
                        {normalizedService.isNew && (
                            <View style={styles.newBadge}>
                                <Text style={styles.newBadgeText}>Nouveau</Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                        <SafeIcon name="Share2" size={18} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Titre du service */}
                <Text style={styles.title} numberOfLines={2}>
                    {normalizedService.titre}
                </Text>

                {/* Catégorie et date */}
                <View style={styles.metaContainer}>
                    <View style={styles.categoryBadge}>
                        <SafeIcon name={getCategoryIcon(normalizedService.categorie)} size={12} color="#4F46E5" />
                        <Text style={styles.categoryText}>{normalizedService.categorie}</Text>
                    </View>
                    <Text style={styles.dateText}>{formatDate(normalizedService.date_creation)}</Text>
                </View>

                {/* Description */}
                <Text style={styles.description} numberOfLines={3}>
                    {normalizedService.description}
                </Text>

                {/* Informations du prestataire avec données réelles */}
                <View style={styles.prestataireContainer}>
                    <View style={styles.prestataireHeader}>
                        <Text style={styles.prestataireName}>{normalizedService.prestataire?.nom}</Text>
                        {/* CORRECTION: Mention en ligne/hors ligne supprimée de la carte */}
                    </View>

                    {/* Localisation avec quartier, ville et drapeau */}
                    {locationData && !locationLoading && (
                        <View style={styles.locationContainer}>
                            <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                            <Text style={styles.locationText}>
                                {locationData.location}
                            </Text>
                            <Text style={styles.countryFlag}>{locationData.countryFlag}</Text>
                            <TouchableOpacity style={styles.mapButton}>
                                <SafeIcon name="external-link" size={12} color={modernColors.primary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Bouton de navigation GPS si disponibles */}
                    {service.gps && (() => {
                        const handleNavigation = async () => {
                            try {
                                // Parser les coordonnées GPS
                                const gpsString = service.gps || '';
                                const coords = gpsString.split(',').map(c => parseFloat(c.trim()));

                                if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                                    const [lat, lng] = coords;

                                    // Essayer d'ouvrir Google Maps d'abord, puis Apple Maps, puis l'app par défaut
                                    const googleMapsUrl = `google.navigation:q=${lat},${lng}`;
                                    const appleMapsUrl = `maps://?q=${lat},${lng}`;
                                    const geoUrl = `geo:${lat},${lng}`;

                                    // Essayer Google Maps
                                    const canOpenGoogle = await Linking.canOpenURL(googleMapsUrl);
                                    if (canOpenGoogle) {
                                        await Linking.openURL(googleMapsUrl);
                                        return;
                                    }

                                    // Essayer Apple Maps
                                    const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
                                    if (canOpenApple) {
                                        await Linking.openURL(appleMapsUrl);
                                        return;
                                    }

                                    // Essayer l'URL géographique générique
                                    const canOpenGeo = await Linking.canOpenURL(geoUrl);
                                    if (canOpenGeo) {
                                        await Linking.openURL(geoUrl);
                                        return;
                                    }

                                    // Fallback : afficher les coordonnées
                                    Alert.alert(
                                        'Navigation',
                                        `Coordonnées: ${lat}, ${lng}\n\nAucune application de cartes n'est disponible sur cet appareil.`,
                                        [{ text: 'OK' }]
                                    );
                                } else {
                                    Alert.alert('Erreur', 'Coordonnées GPS invalides');
                                }
                            } catch (error) {
                                console.error('Erreur ouverture navigation:', error);
                                Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de navigation');
                            }
                        };

                        return (
                            <TouchableOpacity
                                style={styles.gpsContainer}
                                onPress={handleNavigation}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                                <Text style={styles.gpsText}>Naviguer vers le prestataire</Text>
                                <SafeIcon name="external-link" size={12} color={modernColors.primary} />
                            </TouchableOpacity>
                        );
                    })()}

                    {/* Informations de contact réelles */}
                    <View style={styles.contactInfoContainer}>
                        {service.data?.whatsapp && getServiceFieldValue(service.data.whatsapp) !== 'Non spécifié' && (
                            <View style={styles.contactItem}>
                                <SafeIcon name="message-circle" size={12} color={modernColors.success} />
                                <Text style={styles.contactText}>WhatsApp: {getServiceFieldValue(service.data.whatsapp)}</Text>
                            </View>
                        )}
                        {service.data?.telephone && getServiceFieldValue(service.data.telephone) !== 'Non spécifié' && (
                            <View style={styles.contactItem}>
                                <SafeIcon name="phone" size={12} color={modernColors.info} />
                                <Text style={styles.contactText}>Tél: {getServiceFieldValue(service.data.telephone)}</Text>
                            </View>
                        )}
                    </View>

                    {/* Avis et notation réels */}
                    {reviewsStats && reviewsStats.total_reviews > 0 && (
                        <TouchableOpacity
                            style={styles.ratingContainer}
                            onPress={() => onReview?.(normalizedService)}
                        >
                            <View style={styles.ratingStars}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Text key={star} style={[
                                        styles.ratingStar,
                                        star <= Math.round(reviewsStats.average_rating) && styles.ratingStarActive
                                    ]}>
                                        ⭐
                                    </Text>
                                ))}
                            </View>
                            <Text style={styles.ratingText}>
                                {reviewsStats.average_rating.toFixed(1)} ({reviewsStats.total_reviews} avis)
                            </Text>
                            <SafeIcon name="chevron-right" size={12} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bouton principal - Contact avec conversation réelle */}
                <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => handleContact('message')}
                >
                    <LinearGradient
                        colors={modernColors.primaryGradient}
                        style={styles.contactButtonGradient}
                    >
                        <SafeIcon name="message-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.contactButtonText}>Démarrer une conversation</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Boutons secondaires */}
                <View style={styles.secondaryButtons}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={handleGallery}>
                        <SafeIcon name="eye" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.secondaryButtonText}>Galerie</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={handleFavorite}>
                        <SafeIcon name="heart" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.secondaryButtonText}>Favoris</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={handleReview}>
                        <SafeIcon name="star" size={16} color={modernColors.warning} />
                        <Text style={styles.secondaryButtonText}>Avis</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modal de conversation avec WebSocket */}
            <ChatModalMobile
                visible={showChatModal}
                onClose={() => setShowChatModal(false)}
                service={service}
                prestataireInfo={prestataireInfo}
                user={user}
            />

            {/* Modal de notation */}
            <ServiceRatingModal
                visible={showRatingModal}
                onClose={() => setShowRatingModal(false)}
                onSubmit={handleRatingSubmit}
                serviceTitle={normalizedService.titre}
            />
            {/* Modal de galerie média du prestataire */}
            <ServiceMediaGallery
                visible={showMediaGallery}
                onClose={() => setShowMediaGallery(false)}
                service={service}
                prestataireInfo={prestataireInfo}
            />
        </>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginHorizontal: 16,
        marginVertical: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 20,
        paddingHorizontal: 4,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
    },
    statValue: {
        fontSize: 13,
        color: modernColors.text,
        fontWeight: '600',
    },
    newBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    newBadgeText: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    shareButton: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    categoryText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    dateText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    description: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
        marginBottom: 16,
    },
    prestataireContainer: {
        backgroundColor: '#D1FAE5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    prestataireHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    prestataireName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    onlineText: {
        fontSize: 12,
        fontWeight: '500',
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '500',
    },
    countryFlag: {
        fontSize: 14,
        marginLeft: 4,
    },
    mapButton: {
        padding: 4,
    },
    gpsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.primary + '15',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary + '30',
    },
    gpsText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    contactInfoContainer: {
        marginTop: 8,
        gap: 4,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    contactText: {
        fontSize: 11,
        color: modernColors.text,
        fontWeight: '500',
    },
    ratingContainer: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ratingStars: {
        flexDirection: 'row',
        gap: 2,
    },
    ratingStar: {
        fontSize: 12,
        color: modernColors.border,
    },
    ratingStarActive: {
        color: '#FCD34D',
    },
    ratingText: {
        fontSize: 11,
        color: modernColors.text,
        fontWeight: '500',
    },
    contactButton: {
        marginBottom: 12,
    },
    contactButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    contactButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    secondaryButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        gap: 6,
    },
    secondaryButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
});

// ✅ CORRIGÉ 2025-12-30: Mémoriser le composant pour éviter les re-renders inutiles
export default React.memo(UltraModernServiceCard, (prevProps, nextProps) => {
    // Comparaison personnalisée pour éviter les re-renders inutiles
    return (
        prevProps.service.id === nextProps.service.id &&
        prevProps.service.data === nextProps.service.data &&
        prevProps.prestataireInfo === nextProps.prestataireInfo &&
        prevProps.user?.id === nextProps.user?.id &&
        prevProps.reviews === nextProps.reviews &&
        prevProps.reviewsStats === nextProps.reviewsStats &&
        prevProps.serviceStats === nextProps.serviceStats
    );
});
