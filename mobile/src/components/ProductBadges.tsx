/**
 * ProductBadges - Badges promotionnels pour ProductCard
 * Niveau géant: Amazon/Instagram/TikTok badges
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SafeIcon from './SafeIcon';

interface ProductBadgesProps {
    product: any;
    service?: any;
}

export const ProductBadges: React.FC<ProductBadgesProps> = ({ product, service }) => {
    const badges: Array<{ type: string; label: string; icon: string; color: string; gradient?: string[] }> = [];

    // Badge Promo (rouge vif comme Amazon)
    if (product.is_promo || product.promo_price || product.prix_promo || service?.data?.promo?.valeur || service?.data?.promotion?.valeur) {
        badges.push({
            type: 'promo',
            label: 'PROMO',
            icon: 'tag',
            color: '#EF4444',
            gradient: ['#EF4444', '#DC2626'],
        });
    }

    // Badge Nouveau (vert comme Instagram)
    const createdAt = product.created_at || service?.created_at || product.date_creation || service?.date_creation;
    if (createdAt) {
        const daysSinceCreation = Math.floor(
            (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCreation <= 7) {
            badges.push({
                type: 'new',
                label: 'NOUVEAU',
                icon: 'sparkles',
                color: '#10B981',
                gradient: ['#10B981', '#059669'],
            });
        }
    }

    // Badge Stock faible (orange comme eBay)
    const stock = product.stock || product.quantity || product.stock_disponible || service?.data?.stock?.valeur || 0;
    if (stock > 0 && stock <= 5) {
        badges.push({
            type: 'low_stock',
            label: stock === 1 ? 'DERNIER' : 'Bientôt épuisé',
            icon: 'alert-circle',
            color: '#F59E0B',
            gradient: ['#F59E0B', '#D97706'],
        });
    }

    // Badge Premium/Verified (or comme Etsy)
    if (product.is_premium || product.verified || service?.data?.premium?.valeur || service?.data?.verifie?.valeur) {
        badges.push({
            type: 'premium',
            label: '⭐ PREMIUM',
            icon: 'star',
            color: '#F59E0B',
            gradient: ['#F59E0B', '#D97706'],
        });
    }

    // Badge Livraison rapide (bleu comme Amazon Prime)
    if (product.fast_delivery || product.livraison_rapide || service?.data?.livraison_rapide?.valeur || service?.data?.delivery_fast?.valeur) {
        badges.push({
            type: 'fast_delivery',
            label: '⚡ Rapide',
            icon: 'zap',
            color: '#6366F1',
            gradient: ['#6366F1', '#4F46E5'],
        });
    }

    // Badge Meilleur prix (vert comme Amazon)
    if (product.best_price || product.meilleur_prix || service?.data?.meilleur_prix?.valeur) {
        badges.push({
            type: 'best_price',
            label: '🎯 Meilleur prix',
            icon: 'target',
            color: '#10B981',
            gradient: ['#10B981', '#059669'],
        });
    }

    // Badge Tendance (rouge/orange comme TikTok)
    const usageCount = product.usage_count || product.vues || product.views || 0;
    if (usageCount >= 10) {
        badges.push({
            type: 'trending',
            label: '🔥 Tendance',
            icon: 'trending-up',
            color: '#EF4444',
            gradient: ['#EF4444', '#F59E0B'],
        });
    }

    // Badge Populaire (orange comme Instagram)
    if (usageCount >= 5 && usageCount < 10) {
        badges.push({
            type: 'popular',
            label: '⭐ Populaire',
            icon: 'star',
            color: '#F59E0B',
            gradient: ['#F59E0B', '#D97706'],
        });
    }

    if (badges.length === 0) return null;

    return (
        <View style={styles.container}>
            {badges.slice(0, 3).map((badge, index) => (
                badge.gradient ? (
                    <LinearGradient
                        key={badge.type}
                        colors={badge.gradient as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.badge}
                    >
                        <SafeIcon name={badge.icon as any} size={12} color="#FFFFFF" />
                        <Text style={styles.badgeTextWhite}>
                            {badge.label}
                        </Text>
                    </LinearGradient>
                ) : (
                    <LinearGradient
                        key={badge.type}
                        colors={[`${badge.color}15`, `${badge.color}08`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.badge, { borderColor: `${badge.color}40` }]}
                    >
                        <SafeIcon name={badge.icon as any} size={12} color={badge.color} />
                        <Text style={[styles.badgeText, { color: badge.color }]}>
                            {badge.label}
                        </Text>
                    </LinearGradient>
                )
            ))}
            {badges.length > 3 && (
                <View style={[styles.badge, styles.badgeMore]}>
                    <Text style={styles.badgeTextMore}>+{String(badges.length - 3)}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
        marginTop: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    badgeTextWhite: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        color: '#FFFFFF',
    },
    badgeMore: {
        backgroundColor: '#F3F4F6',
        borderColor: '#E5E7EB',
        paddingHorizontal: 8,
    },
    badgeTextMore: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
    },
});

export default ProductBadges;

