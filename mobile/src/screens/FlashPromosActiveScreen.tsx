import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ProductCard from '../components/ProductCard';
import SafeIcon from '../components/SafeIcon';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300?text=Produit';

interface FlashPromo {
    id: string;
    service_id: number;
    service_title: string;
    service_owner_id?: number;
    title: string;
    display_title?: string; // ✅ NOUVEAU: Titre intelligent (nom produit si 1 seul, sinon titre service)
    description?: string;
    discount_type: string;
    discount_value?: number;
    starts_at: string;
    ends_at: string;
    availability: string;
    products: any[]; // ✅ Les produits incluent maintenant delivery_availability
    product_indexes?: number[];
    product_count?: number;
    stock_cap?: number;
}

const formatTimeRemaining = (endsAt: string): string => {
    const end = new Date(endsAt);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Terminé';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}j restant${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

const FlashPromosActiveScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [flashPromos, setFlashPromos] = useState<FlashPromo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());

    // BUG-7 fix: live countdown timer
    useEffect(() => {
        const interval = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const loadFlashPromos = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/flash-promos/active');
            if (response.success && Array.isArray(response.data)) {
                setFlashPromos(response.data);
            } else {
                setFlashPromos([]);
            }
        } catch (error: any) {
            console.error('[FlashPromosActiveScreen] Erreur chargement:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les flash promotionnels');
            setFlashPromos([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadFlashPromos().catch(() => undefined);
    }, [loadFlashPromos]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadFlashPromos();
    }, [loadFlashPromos]);

    const handlePromoPress = useCallback(
        (promo: FlashPromo) => {
            (navigation as any).navigate('ServiceDetail', {
                serviceId: promo.service_id,
                highlightPromo: promo.id,
            });
        },
        [navigation]
    );

    const handleSharePromo = useCallback(async (promo: FlashPromo) => {
        try {
            const discount = promo.discount_type === 'percentage' && promo.discount_value
                ? `-${promo.discount_value}%`
                : promo.discount_type === 'free' ? 'GRATUIT' : 'Promotion';
            await Share.share({
                message: `${discount} sur ${promo.display_title || promo.title} ! Offre flash disponible maintenant sur Yukpo.`,
            });
        } catch (_e) { /* user cancelled */ }
    }, []);

    const formatDiscount = (promo: FlashPromo): string => {
        if (promo.discount_type === 'percentage' && promo.discount_value) {
            return `-${promo.discount_value}%`;
        }
        if (promo.discount_type === 'fixed' && promo.discount_value) {
            return `-${promo.discount_value.toLocaleString('fr-FR')} CFA`;
        }
        if (promo.discount_type === 'free') {
            return 'GRATUIT';
        }
        return 'Promotion';
    };

    if (loading && flashPromos.length === 0) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement des promotions...</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="chevron-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>⚡ Flash Promotionnels</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {flashPromos.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateIcon}>⚡</Text>
                        <Text style={styles.emptyStateText}>Aucun flash promotionnel actif</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Les promotions limitées apparaîtront ici lorsqu'elles seront disponibles
                        </Text>
                    </View>
                ) : (
                    flashPromos.map((promo) => {
                        const products = promo.products || [];
                        const timeRemaining = formatTimeRemaining(promo.ends_at);
                        const endsAtMs = new Date(promo.ends_at).getTime();
                        const isEnded = nowMs >= endsAtMs;
                        const isUrgent = !isEnded && (endsAtMs - nowMs) < 30 * 60 * 1000;

                        return (
                            <View key={promo.id} style={styles.promoSection}>
                                {/* En-tête de la promo */}
                                <View style={styles.promoHeader}>
                                    <View style={styles.promoHeaderContent}>
                                        <Text style={styles.promoTitle}>{promo.title || promo.display_title}</Text>
                                        {promo.description && (
                                            <Text style={styles.promoDescription} numberOfLines={2}>
                                                {promo.description}
                                            </Text>
                                        )}
                                        <View style={styles.promoHeaderFooter}>
                                            <View style={styles.timeContainer}>
                                                <SafeIcon name="clock" size={14} color={isUrgent ? '#DC2626' : modernColors.textSecondary} />
                                                <Text style={[styles.timeText, isUrgent && styles.urgentTimeText]}>
                                                    {isEnded ? 'Terminé' : timeRemaining}
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleSharePromo(promo)} style={styles.shareButton}>
                                                <SafeIcon name="Redo2" size={16} color={modernColors.primary} />
                                            </TouchableOpacity>
                                            <View style={styles.discountBadgeInline}>
                                                <Text style={styles.discountBadgeTextInline}>{formatDiscount(promo)}</Text>
                                            </View>
                                            {promo.availability === 'live' || promo.availability === 'both' ? (
                                                <View style={styles.liveBadgeInline}>
                                                    <Text style={styles.liveBadgeTextInline}>📺 LIVE</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                </View>

                                {/* Produits avec ProductCard (inclut bouton "Me livrer") */}
                                {products.length > 0 ? (
                                    products.map((product: any, index: number) => {
                                        // Construire le service minimal pour ProductCard
                                        const service = {
                                            id: promo.service_id,
                                            data: {
                                                produits: {
                                                    valeur: [product]
                                                },
                                                titre_service: {
                                                    valeur: promo.service_title
                                                }
                                            }
                                        };

                                        return (
                                            <View key={`${promo.id}-product-${index}`} style={styles.productCardContainer}>
                                                <ProductCard
                                                    product={{
                                                        ...product,
                                                        product_index: product._product_index || index,
                                                        service_id: promo.service_id,
                                                    }}
                                                    service={service}
                                                    prestataire={{
                                                        user_id: promo.service_owner_id,
                                                        nom: promo.service_title,
                                                    }}
                                                />
                                            </View>
                                        );
                                    })
                                ) : (
                                    <TouchableOpacity
                                        style={styles.promoCard}
                                        onPress={() => handlePromoPress(promo)}
                                    >
                                        <View style={styles.promoContent}>
                                            <Text style={styles.emptyProductsText}>
                                                Aucun produit disponible
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: modernColors.background,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
        textAlign: 'center',
    },
    placeholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyStateIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyStateText: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    promoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    promoImageContainer: {
        position: 'relative',
        width: '100%',
        height: 200,
    },
    promoImage: {
        width: '100%',
        height: '100%',
    },
    discountBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#DC2626',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    discountBadgeText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    liveBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    promoContent: {
        padding: 16,
    },
    promoTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    promoDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    serviceTitle: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
        marginBottom: 12,
    },
    promoFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timeText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    urgentTimeText: {
        color: '#DC2626',
        fontWeight: '700',
    },
    shareButton: {
        padding: 4,
    },
    stockContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    stockText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    promoSection: {
        marginBottom: 24,
    },
    promoHeader: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    promoHeaderContent: {
        gap: 8,
    },
    promoHeaderFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    discountBadgeInline: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    discountBadgeTextInline: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    liveBadgeInline: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveBadgeTextInline: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    productCardContainer: {
        marginBottom: 12,
    },
    emptyProductsText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        padding: 16,
    },
});

export default FlashPromosActiveScreen;

