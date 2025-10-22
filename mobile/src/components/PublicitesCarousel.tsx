import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_MARGIN = 12;

interface PublicitesCarouselProps {
    userId?: string;
    userBehavior?: string[]; // Catégories préférées de l'utilisateur
}

const PublicitesCarousel: React.FC<PublicitesCarouselProps> = ({ userId, userBehavior = [] }) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const scrollViewRef = useRef<ScrollView>(null);
    const [publicites, setPublicites] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPublicites();
    }, [userId, userBehavior]);

    // Auto-scroll toutes les 5 secondes
    useEffect(() => {
        if (publicites.length <= 1) return;

        const interval = setInterval(() => {
            const nextIndex = (currentIndex + 1) % publicites.length;
            setCurrentIndex(nextIndex);

            scrollViewRef.current?.scrollTo({
                x: nextIndex * (CARD_WIDTH + CARD_MARGIN),
                animated: true,
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [currentIndex, publicites.length]);

    const loadPublicites = async () => {
        try {
            setLoading(true);

            // Construire les paramètres de requête avec comportement utilisateur
            const params = new URLSearchParams();
            if (userBehavior.length > 0) {
                params.append('categories', userBehavior.join(','));
            }
            if (userId) {
                params.append('user_id', userId);
            }

            const response = await apiGet(`/api/publicites/actives?${params.toString()}`);

            if (response.success && response.data) {
                // ✅ Trier par pertinence si comportement fourni
                let pubs = Array.isArray(response.data) ? response.data : [];

                if (userBehavior.length > 0 && pubs.length > 0) {
                    pubs = pubs.sort((a: any, b: any) => {
                        // Calculer score de pertinence
                        const scoreA = a.produits?.filter((p: any) =>
                            userBehavior.includes(p.type)
                        ).length || 0;
                        const scoreB = b.produits?.filter((p: any) =>
                            userBehavior.includes(p.type)
                        ).length || 0;
                        return scoreB - scoreA;
                    });
                }

                setPublicites(pubs);
            } else {
                // En cas d'erreur ou pas de données, définir un tableau vide
                setPublicites([]);
            }

            setLoading(false);
        } catch (error) {
            console.error('[PublicitesCarousel] Erreur chargement:', error);
            // Ne plus continuer à essayer en boucle si l'endpoint n'existe pas
            setPublicites([]);
            setLoading(false);
        }
    };

    // ✅ Enregistrer clic et naviguer vers le produit
    const handlePubliciteClick = async (pub: any) => {
        try {
            // Enregistrer le clic pour les analytics
            await apiPost('/api/publicites/track-click', {
                publicite_id: pub.id,
                user_id: userId
            });

            // Naviguer vers le détail du premier produit ou du service
            if (pub.produits && pub.produits.length > 0) {
                const firstProduct = pub.produits[0];

                // Si on a le serviceId, on peut naviguer vers le détail du service
                if (firstProduct.serviceId) {
                    (navigation as any).navigate('ChatModal', {
                        serviceId: firstProduct.serviceId,
                        productId: firstProduct.id
                    });
                }
            }
        } catch (error) {
            console.error('[PublicitesCarousel] Erreur tracking clic:', error);
        }
    };

    if (loading || publicites.length === 0) {
        return null; // Ne rien afficher si pas de publicités
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>✨ {t('publicite.promotions')}</Text>
                <Text style={styles.headerSubtitle}>
                    {userBehavior.length > 0 ? t('publicite.selected_for_you') : t('publicite.discover_offers')}
                </Text>
            </View>

            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled={false}
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + CARD_MARGIN}
                snapToAlignment="start"
                contentContainerStyle={styles.scrollContent}
                onMomentumScrollEnd={(event) => {
                    const newIndex = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_MARGIN));
                    setCurrentIndex(newIndex);
                }}
            >
                {(publicites || []).map((pub, index) => (
                    <TouchableOpacity
                        key={pub.id}
                        style={[styles.card, { width: CARD_WIDTH, marginRight: CARD_MARGIN }]}
                        activeOpacity={0.9}
                        onPress={() => handlePubliciteClick(pub)}
                    >
                        <LinearGradient
                            colors={['#6366F1', '#8B5CF6', '#EC4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.cardGradient}
                        >
                            {/* Vidéo ou Image */}
                            {pub.videos && pub.videos.length > 0 ? (
                                <View style={styles.mediaContainer}>
                                    <Image
                                        source={{ uri: `data:image/jpeg;base64,${pub.thumbnails[0]}` }}
                                        style={styles.media}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.playOverlay}>
                                        <SafeIcon name="play" size={32} color="#fff" />
                                    </View>
                                </View>
                            ) : pub.produits?.[0]?.images?.[0] ? (
                                <Image
                                    source={{ uri: `data:image/jpeg;base64,${pub.produits[0].images[0]}` }}
                                    style={styles.media}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.media, styles.placeholderMedia]}>
                                    <SafeIcon name="image" size={48} color="#fff" />
                                </View>
                            )}

                            {/* Contenu */}
                            <View style={styles.cardContent}>
                                <Text style={styles.cardTitle} numberOfLines={2}>
                                    {pub.titre}
                                </Text>
                                {pub.description && (
                                    <Text style={styles.cardDescription} numberOfLines={2}>
                                        {pub.description}
                                    </Text>
                                )}
                                <View style={styles.cardFooter}>
                                    <View style={styles.productsCount}>
                                        <SafeIcon name="package" size={14} color="#fff" />
                                        <Text style={styles.productsCountText}>
                                            {pub.produits?.length || 0} produit{(pub.produits?.length || 0) > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                    {pub.produits?.[0]?.prix && (
                                        <Text style={styles.cardPrice}>
                                            À partir de {pub.produits[0].prix} FCFA
                                        </Text>
                                    )}
                                </View>

                                {/* ✅ Bouton "Voir le produit" */}
                                <View style={styles.ctaButton}>
                                    <SafeIcon name="arrow-right" size={16} color="#fff" />
                                    <Text style={styles.ctaText}>Voir le produit</Text>
                                </View>
                            </View>

                            {/* Badge catégorie */}
                            {pub.produits?.[0]?.type && (
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryText}>
                                        {getCategoryIcon(pub.produits[0].type)}
                                    </Text>
                                </View>
                            )}

                            {/* Badge zone géographique */}
                            {pub.zone_geographique && (
                                <View style={styles.zoneBadge}>
                                    <SafeIcon
                                        name={pub.zone_geographique === 'local' ? 'map-pin' : 'globe'}
                                        size={12}
                                        color="#fff"
                                    />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Indicateurs de pagination */}
            {(publicites || []).length > 1 && (
                <View style={styles.pagination}>
                    {(publicites || []).map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.paginationDot,
                                index === currentIndex && styles.paginationDotActive
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

// Fonction helper pour les icônes
const getCategoryIcon = (type: string): string => {
    const icons: Record<string, string> = {
        'immobilier_batiment': '🏠',
        'immobilier_terrain': '🏞️',
        'hotellerie': '🏨',
        'automobile': '🚗',
        'ticket_voyage': '🎫',
        'telephone': '📱',
        'ordinateur': '💻',
        'vetement': '👔',
        'electromenager': '🔌',
        'mobilier': '🪑',
        'pharmacie': '💊',
        'default': '📦'
    };
    return icons[type] || icons.default;
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    card: {
        height: 220,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    cardGradient: {
        flex: 1,
        flexDirection: 'row',
    },
    mediaContainer: {
        width: '45%',
        position: 'relative',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    placeholderMedia: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    cardContent: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        lineHeight: 18,
    },
    cardFooter: {
        gap: 8,
    },
    productsCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    productsCountText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },
    cardPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        marginTop: 8,
    },
    ctaText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    categoryBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    categoryText: {
        fontSize: 20,
    },
    zoneBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.border,
    },
    paginationDotActive: {
        backgroundColor: modernColors.primary,
        width: 24,
    },
});

export default PublicitesCarousel;
