import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeNativeView } from '../components/SafeNativeView';
import {
    fetchGlobalPromoCatalog,
    type GlobalPromoCatalogItem,
} from '../services/globalPromoService';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300?text=Produit';

const getSnapshotImage = (snapshot: any): string | undefined => {
    if (!snapshot) return undefined;
    const images = snapshot.images;
    if (Array.isArray(images) && images.length > 0) {
        if (typeof images[0] === 'string') {
            return images[0];
        }
        if (typeof images[0]?.url === 'string') {
            return images[0].url;
        }
    }
    if (typeof snapshot.cover === 'string') {
        return snapshot.cover;
    }
    return undefined;
};

const GlobalPromoCatalogScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();

    // formatPrice doit être déclaré DANS le composant pour accéder à t()
    const formatPrice = (value?: number | null) =>
        value ? `${value.toLocaleString('fr-FR')} CFA` : t('globalPromoCatalogScreen.prixCommuniqueLorsDuLive');
    const [pageData, setPageData] = useState<GlobalPromoCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [availability, setAvailability] = useState<'all' | 'online' | 'live' | 'both'>('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);

    const loadCatalog = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
        try {
            if (reset) {
                setLoading(true);
            }
            const data = await fetchGlobalPromoCatalog({
                page: pageNum,
                pageSize: 24,
                availability: availability === 'all' ? undefined : availability,
                search: keyword || undefined,
                sort: 'ending_soon',
            });

            if (reset) {
                setPageData(data.items);
            } else {
                setPageData((prev) => [...prev, ...data.items]);
            }
            setHasMore(data.hasMore || false);
            setTotal(data.total || 0);
        } catch (error: any) {
            console.error('[GlobalPromoCatalogScreen] Erreur chargement catalogue:', error);
            // ✅ CORRIGÉ: Gestion d'erreur robuste avec message clair
            const errorMessage = error?.message || error?.toString() || 'Impossible de charger le catalogue';
            if (reset) {
                // Seulement afficher l'alerte si c'est le chargement initial
                Alert.alert('Erreur', errorMessage);
            }
            // En cas d'erreur, garder les données existantes (pas de reset)
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [keyword, availability]);

    useEffect(() => {
        loadCatalog(1, true);
    }, [keyword, availability]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setPage(1);
        loadCatalog(1, true);
    }, [loadCatalog]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadCatalog(nextPage, false);
        }
    }, [page, hasMore, loading, loadCatalog]);

    const handleItemPress = (item: GlobalPromoCatalogItem) => {
        navigation.navigate('ServiceDetail' as never, { serviceId: item.entry.serviceId } as never);
    };

    if (loading && pageData.length === 0) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('globalPromoCatalog.chargementDuCatalogue')}</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{t('globalPromoCatalog.retour')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>🛍️ Black Friday</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.headerBanner}>
                <Text style={styles.bannerTitle}>{t('globalPromoCatalog.blackFridayFedereYukpo')}</Text>
                <Text style={styles.bannerSubtext}>
                    Toutes les promotions validées par Yukpo regroupées ici
                </Text>
            </View>

            <View style={styles.filtersContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder={t('globalPromoCatalog.rechercher')}
                    placeholderTextColor={modernColors.textSecondary}
                    value={keyword}
                    onChangeText={setKeyword}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    <TouchableOpacity
                        style={[styles.filterChip, availability === 'all' && styles.filterChipActive]}
                        onPress={() => setAvailability('all')}
                    >
                        <Text style={[styles.filterChipText, availability === 'all' && styles.filterChipTextActive]}>
                            Tous
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, availability === 'online' && styles.filterChipActive]}
                        onPress={() => setAvailability('online')}
                    >
                        <Text style={[styles.filterChipText, availability === 'online' && styles.filterChipTextActive]}>
                            En ligne
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, availability === 'live' && styles.filterChipActive]}
                        onPress={() => setAvailability('live')}
                    >
                        <Text style={[styles.filterChipText, availability === 'live' && styles.filterChipTextActive]}>
                            Live
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, availability === 'both' && styles.filterChipActive]}
                        onPress={() => setAvailability('both')}
                    >
                        <Text style={[styles.filterChipText, availability === 'both' && styles.filterChipTextActive]}>
                            Les deux
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                onScroll={({ nativeEvent }) => {
                    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                    const paddingToBottom = 20;
                    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
                        loadMore();
                    }
                }}
                scrollEventThrottle={400}
            >
                {pageData.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>{t('globalPromoCatalog.aucunResultat')}</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Essayez un autre mot-clé ou modifiez les filtres
                        </Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.resultsHeader}>
                            <Text style={styles.resultsCount}>
                                {total} {total === 1 ? 'résultat' : t('globalPromoCatalogScreen.resultats')}
                            </Text>
                        </View>
                        {pageData.map((item) => {
                            const snapshot = item.product?.snapshot ?? {};
                            const image = getSnapshotImage(snapshot);
                            const title =
                                snapshot.title ||
                                snapshot.nom_service ||
                                item.entry.metadata?.title ||
                                `Service #${item.entry.serviceId}`;
                            const description =
                                snapshot.description ||
                                snapshot.short_description ||
                                item.entry.metadata?.description ||
                                t('globalPromoCatalogScreen.offreSpecialeBlackFridayValideePar');

                            return (
                                <TouchableOpacity
                                    key={item.entry.id}
                                    style={styles.itemCard}
                                    onPress={() => handleItemPress(item)}
                                >
                                    {image && (
                                        <Image source={{ uri: image }} style={styles.itemImage} resizeMode="cover" />
                                    )}
                                    <View style={styles.itemContent}>
                                        <View style={styles.badgesContainer}>
                                            <View style={styles.badge}>
                                                <Text style={styles.badgeText}>{item.event.displayName}</Text>
                                            </View>
                                            {item.badges?.eventIsLive && (
                                                <View style={[styles.badge, styles.badgeLive]}>
                                                    <Text style={styles.badgeText}>En live</Text>
                                                </View>
                                            )}
                                            <View style={styles.badgeAvailability}>
                                                <Text style={styles.badgeText}>{item.entry.availability}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.itemTitle} numberOfLines={2}>
                                            {String(title)}
                                        </Text>
                                        <Text style={styles.itemDescription} numberOfLines={3}>
                                            {String(description)}
                                        </Text>
                                        <View style={styles.itemFooter}>
                                            <Text style={styles.itemPrice}>
                                                {formatPrice(item.entry.promoPriceCfa)}
                                            </Text>
                                            {item.entry.discountPercentage && (
                                                <View style={styles.discountBadge}>
                                                    <Text style={styles.discountText}>
                                                        -{item.entry.discountPercentage}%
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        {item.product?.highlighted && (
                                            <Text style={styles.highlightedLabel}>{t('globalPromoCatalog.coupDeCurYukpo')}</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        {hasMore && (
                            <View style={styles.loadMoreContainer}>
                                <ActivityIndicator size="small" color={modernColors.primary} />
                                <Text style={styles.loadMoreText}>{t('globalPromoCatalog.chargement')}</Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e5e5',
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        fontSize: 16,
        color: modernColors.primary,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    placeholder: {
        width: 60,
    },
    headerBanner: {
        backgroundColor: modernColors.primary,
        padding: 20,
        alignItems: 'center',
    },
    bannerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    bannerSubtext: {
        fontSize: 14,
        color: '#fff',
        opacity: 0.9,
        textAlign: 'center',
    },
    filtersContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e5e5',
    },
    searchInput: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 12,
        color: modernColors.text,
    },
    filterScroll: {
        flexDirection: 'row',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    resultsHeader: {
        marginBottom: 16,
    },
    resultsCount: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    itemImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#e5e5e5',
    },
    itemContent: {
        padding: 16,
    },
    badgesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
        gap: 8,
    },
    badge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeLive: {
        backgroundColor: '#10b981',
    },
    badgeAvailability: {
        backgroundColor: '#e5e5e5',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    itemDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 20,
    },
    itemFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    discountBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    discountText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    highlightedLabel: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
        marginTop: 4,
    },
    loadMoreContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    loadMoreText: {
        marginLeft: 8,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

export default GlobalPromoCatalogScreen;

