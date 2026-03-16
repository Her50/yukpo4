import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { theme } from '../theme/theme';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    };
    statut?: 'actif' | 'inactif';
    status?: 'active' | 'inactive';
    date_creation?: string;
    created_at?: string;
    tags?: string[];
    score_relevance?: number;
    score?: number;
    data?: any;
    // Nouvelles propriétés pour les statistiques
    views?: number;
    likes?: number;
    comments?: number;
    isNew?: boolean;
}

interface ServiceResultCardProps {
    service: Service;
    onPress: (service: Service) => void;
    onContact: (prestataireId: string, type: 'message' | 'call') => void;
    onShare: (service: Service) => void;
    onFavorite?: (service: Service) => void;
    onGallery?: (service: Service) => void;
    onReview?: (service: Service) => void;
}

const ServiceResultCard: React.FC<ServiceResultCardProps> = ({
    service,
    onPress,
    onContact,
    onShare,
    onFavorite,
    onGallery,
    onReview,
}) => {
    // Normaliser les données du service
    const normalizedService: Service = {
        id: service.id?.toString() || '',
        titre: service.titre || service.title || t('serviceResultCard.serviceSansTitre'),
        description: service.description || t('serviceResultCard.aucuneDescription'),
        prix: service.prix || service.price || 0,
        devise: service.devise || service.currency || 'XAF',
        categorie: service.categorie || service.category || t('serviceResultCard.nonSpecifie'),
        localisation: service.localisation || service.location || t('serviceResultCard.nonSpecifie'),
        prestataire: service.prestataire || {
            id: service.prestataire?.id || '',
            nom: service.prestataire?.nom || service.prestataire?.name || 'Prestataire',
            email: service.prestataire?.email || ''
        },
        statut: (service.statut || service.status || 'inactif') as 'actif' | 'inactif',
        date_creation: service.date_creation || service.created_at || new Date().toISOString(),
        tags: service.tags || [],
        score_relevance: service.score_relevance || service.score || 0,
        views: service.views || 0,
        likes: service.likes || 0,
        comments: service.comments || 0,
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
        onContact(normalizedService.prestataire?.id || '', type);
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
        if (onReview) {
            onReview(normalizedService);
        }
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress}>
            {/* En-tête avec statistiques */}
            <View style={styles.header}>
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statIcon}>👁️</Text>
                        <Text style={styles.statValue}>{formatNumber(normalizedService.views || 0)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statIcon}>💬</Text>
                        <Text style={styles.statValue}>{formatNumber(normalizedService.comments || 0)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statIcon}>♡</Text>
                        <Text style={styles.statValue}>{formatNumber(normalizedService.likes || 0)}</Text>
                    </View>
                    {normalizedService.isNew && (
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{t('serviceResultCard.nouveau')}</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <Text style={styles.shareIcon}>📤</Text>
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

            {/* Informations du prestataire */}
            <View style={styles.prestataireContainer}>
                <View style={styles.prestataireInfo}>
                    <Text style={styles.prestataireName}>{normalizedService.prestataire?.nom}</Text>
                    <View style={styles.onlineIndicator}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>{t('serviceResultCard.enLigne')}</Text>
                    </View>
                </View>
            </View>

            {/* Localisation */}
            <View style={styles.locationContainer}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>{normalizedService.localisation}</Text>
                <TouchableOpacity style={styles.mapButton}>
                    <Text style={styles.mapButtonText}>Carte</Text>
                </TouchableOpacity>
            </View>

            {/* Actions principales */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => handleContact('message')}>
                    <Text style={styles.primaryButtonIcon}>💬</Text>
                    <Text style={styles.primaryButtonText}>{t('serviceResultCard.demarrerUneConversation')}</Text>
                </TouchableOpacity>
            </View>

            {/* Actions secondaires */}
            <View style={styles.secondaryActionsContainer}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleGallery}>
                    <Text style={styles.secondaryButtonText}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleFavorite}>
                    <Text style={styles.secondaryButtonText}>{t('serviceResultCard.favoris')}</Text>
                </TouchableOpacity>
            </View>

            {/* Action d'avis */}
            <TouchableOpacity style={styles.reviewButton} onPress={handleReview}>
                <Text style={styles.reviewButtonText}>Donner un avis</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statIcon: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    statValue: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    shareButton: {
        padding: 8,
    },
    shareIcon: {
        fontSize: 18,
        color: theme.colors.textSecondary,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 12,
        lineHeight: 26,
    },
    metaContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryBadge: {
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    categoryText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    dateText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    description: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
        marginBottom: 16,
    },
    prestataireContainer: {
        marginBottom: 12,
    },
    prestataireInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    prestataireName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
    },
    onlineText: {
        fontSize: 12,
        color: '#4CAF50',
        fontWeight: '500',
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    locationIcon: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    locationText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    mapButton: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    mapButtonText: {
        fontSize: 12,
        color: theme.colors.text,
        fontWeight: '500',
    },
    actionsContainer: {
        marginBottom: 12,
    },
    primaryButton: {
        backgroundColor: theme.colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 8,
    },
    primaryButtonIcon: {
        fontSize: 16,
        color: 'white',
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryActionsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    secondaryButtonText: {
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '500',
    },
    reviewButton: {
        backgroundColor: 'transparent',
        paddingVertical: 8,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 12,
    },
    reviewButtonText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
});

export default ServiceResultCard;