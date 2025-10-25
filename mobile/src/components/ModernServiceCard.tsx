import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useLocationDisplay } from '../hooks/useLocationDisplay';
import { useServiceReviews } from '../hooks/useServiceReviews';
import { useServiceStats } from '../hooks/useServiceStats';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface Service {
    id: string;
    titre?: string;
    title?: string;
    description?: string;
    prix?: number;
    price?: number;
    devise?: string;
    currency?: string;
    categorie?: string;
    category?: string;
    localisation?: string;
    location?: string;
    prestataire?: {
        id: string;
        nom?: string;
        name?: string;
        email?: string;
        avatar?: string;
        isOnline?: boolean;
        lastSeen?: string;
    };
    statut?: 'actif' | 'inactif';
    status?: 'active' | 'inactive';
    date_creation?: string;
    created_at?: string;
    tags?: string[];
    score_relevance?: number;
    score?: number;
    data?: any;
    views?: number;
    likes?: number;
    comments?: number;
    isNew?: boolean;
}

interface ModernServiceCardProps {
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

const ModernServiceCard: React.FC<ModernServiceCardProps> = ({
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

    // Utiliser les hooks pour les données réelles
    const { stats, loading: statsLoading } = useServiceStats(parseInt(service.id), service.date_creation);
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
        prix: service.data?.prix?.valeur || service.prix || service.price || 0,
        devise: service.data?.devise?.valeur || service.devise || service.currency || 'XAF',
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
                month: 'long',
                year: 'numeric'
            });
        } catch (error) {
            return 'Date inconnue';
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
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

    const handleShare = () => {
        onShare(normalizedService);
    };

    const handleFavorite = () => {
        if (onFavorite) {
            onFavorite(normalizedService);
        }
    };

    const handleGallery = () => {
        if (onGallery) {
            onGallery(normalizedService);
        }
    };

    const handleReview = () => {
        setShowRatingModal(true);
    };

    const handleRatingSubmit = async (rating: number, comment: string): Promise<boolean> => {
        return await submitReview(rating, comment);
    };

    return (
        <View style={styles.card}>
            {/* En-tête avec statistiques - Style frontend */}
            <View style={styles.header}>
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <SafeIcon name="eye" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.statValue}>{formatNumber(normalizedService.views || 0)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <SafeIcon name="share-2" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.statValue}>{formatNumber(normalizedService.likes || 0)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <SafeIcon name="heart" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.statValue}>{formatNumber(normalizedService.comments || 0)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <SafeIcon name="user" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.statValue}>{formatNumber(normalizedService.comments || 0)}</Text>
                    </View>
                    {normalizedService.isNew && (
                        <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>Nouveau</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <SafeIcon name="share-2" size={16} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Titre du service */}
            <Text style={styles.title} numberOfLines={2}>
                {normalizedService.titre}
            </Text>

            {/* Catégorie et date */}
            <View style={styles.metaContainer}>
                <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{normalizedService.categorie}</Text>
                </View>
                <Text style={styles.dateText}>{formatDate(normalizedService.date_creation)}</Text>
            </View>

            {/* Description */}
            <Text style={styles.description} numberOfLines={3}>
                {normalizedService.description}
            </Text>

            {/* Informations du prestataire - Style frontend */}
            <View style={styles.prestataireContainer}>
                <View style={styles.prestataireHeader}>
                    <Text style={styles.prestataireName}>{normalizedService.prestataire?.nom}</Text>
                    <View style={styles.onlineIndicator}>
                        <View style={[
                            styles.onlineDot,
                            { backgroundColor: normalizedService.prestataire?.isOnline ? modernColors.success : modernColors.textSecondary }
                        ]} />
                        <Text style={[
                            styles.onlineText,
                            { color: normalizedService.prestataire?.isOnline ? modernColors.success : modernColors.textSecondary }
                        ]}>
                            {normalizedService.prestataire?.isOnline ? 'En ligne' : 'Hors ligne'}
                        </Text>
                    </View>
                </View>

                {/* Localisation avec GPS */}
                <View style={styles.locationContainer}>
                    <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                    <Text style={styles.locationText}>{normalizedService.localisation}</Text>
                    <TouchableOpacity style={styles.mapButton}>
                        <SafeIcon name="external-link" size={12} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Coordonnées GPS si disponibles */}
                {service.gps && (
                    <View style={styles.gpsContainer}>
                        <SafeIcon name="navigation" size={12} color={modernColors.info} />
                        <Text style={styles.gpsText}>GPS: {service.gps}</Text>
                    </View>
                )}

                {/* Informations de contact */}
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
            </View>

            {/* Bouton principal - Style frontend */}
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
            </View>

            {/* Bouton d'avis */}
            <TouchableOpacity style={styles.reviewButton} onPress={handleReview}>
                <SafeIcon name="star" size={16} color={modernColors.warning} />
                <Text style={styles.reviewButtonText}>Donner un avis</Text>
            </TouchableOpacity>
        </View>
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
        backgroundColor: '#E0E7FF', // Bleu clair pour le badge catégorie
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
        backgroundColor: '#D1FAE5', // Vert clair pour le container prestataire
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
    },
    mapButton: {
        padding: 4,
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
        marginBottom: 12,
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
    reviewButton: {
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
    reviewButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.text,
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
});

export default ModernServiceCard;
