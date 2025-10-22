import React, { useState } from 'react';
import {
    Alert,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// Code corrigé (remplace @ts-ignore)
import SafeIcon from './SafeIcon'
import { useLocationDisplay } from '../hooks/useLocationDisplay';
import { useServiceReviews } from '../hooks/useServiceReviews';
import { useServiceStats } from '../hooks/useServiceStats';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ChatModalMobile from './ChatModalMobile';
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

interface UltraModernServiceCardProps {
    service: Service;
    prestataireInfo?: any;
    user?: any;
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

    // Utiliser les hooks pour les données réelles
    const { stats, loading: statsLoading } = useServiceStats(parseInt(service.id), service.date_creation || service.created_at || new Date().toISOString());
    const { reviews, stats: reviewsStats, submitReview } = useServiceReviews(parseInt(service.id));
    const { locationData, loading: locationLoading } = useLocationDisplay(service, prestataireInfo);

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
            nom: prestataireInfo?.nom_complet || prestataireInfo?.nom || service.prestataire?.nom || service.prestataire?.name || 'Prestataire',
            email: prestataireInfo?.email || service.prestataire?.email || '',
            isOnline: prestataireInfo?.isOnline || service.prestataire?.isOnline || false,
            lastSeen: prestataireInfo?.lastSeen || service.prestataire?.lastSeen || ''
        },
        statut: service.statut || service.status || 'inactif',
        date_creation: service.date_creation || service.created_at || new Date().toISOString(),
        tags: service.tags || [],
        score_relevance: service.score_relevance || service.score || 0,
        // Utiliser les vraies statistiques depuis l'API
        views: stats?.views || 0,
        likes: stats?.likes || 0,
        comments: stats?.contacts || 0,
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
            // ✅ CORRIGÉ: Utilise variable d'environnement pour URL de partage
            const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpomnang.com';
            const serviceUrl = `${SHARE_BASE_URL}/service/${service.id}`;
            const shareText = `🌟 Découvrez ce service sur Yukpomnang :\n\n${normalizedService.titre}\n\n${normalizedService.description}\n\n💰 Prix: ${normalizedService.prix} ${normalizedService.devise}\n📍 Localisation: ${locationData?.location || 'Non spécifiée'}\n\n🔗 ${serviceUrl}`;

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

                    {/* Coordonnées GPS si disponibles */}
                    {service.gps && (
                        <View style={styles.gpsContainer}>
                            <SafeIcon name="navigation" size={12} color={modernColors.info} />
                            <Text style={styles.gpsText}>GPS: {service.gps}</Text>
                        </View>
                    )}

                    {/* Informations de contact réelles */}
                    <View style={styles.contactInfoContainer}>
                        {service.data?.whatsapp?.valeur && (
                            <View style={styles.contactItem}>
                                <SafeIcon name="message-circle" size={12} color={modernColors.success} />
                                <Text style={styles.contactText}>WhatsApp: {service.data.whatsapp.valeur}</Text>
                            </View>
                        )}
                        {service.data?.telephone?.valeur && (
                            <View style={styles.contactItem}>
                                <SafeIcon name="phone" size={12} color={modernColors.info} />
                                <Text style={styles.contactText}>Tél: {service.data.telephone.valeur}</Text>
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
        gap: 4,
        marginTop: 6,
    },
    gpsText: {
        fontSize: 10,
        color: modernColors.info,
        fontFamily: 'monospace',
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

export default UltraModernServiceCard;
