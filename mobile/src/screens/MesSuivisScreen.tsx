// @ts-nocheck
import { useIsFocused, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../services/api';
import { useLanguageSafe } from '../contexts/LanguageContext';

type FollowedSeller = {
    followed_id: number;
    seller_name: string;
    service_id: number | null;
    service_title: string | null;
    service_description: string | null;
    category: string | null;
    followers_count: number;
    followed_at: string;
};

const MesSuivisScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const isFocused = useIsFocused();
    const [following, setFollowing] = useState<FollowedSeller[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unfollowingId, setUnfollowingId] = useState<number | null>(null);

    const fetchFollowing = useCallback(async (isRefresh = false) => {
        if (!user?.id) return;
        if (!isRefresh) setLoading(true);
        try {
            const res = await apiGet('/api/users/me/following');
            const data = res?.data as any;
            if (data?.success && Array.isArray(data.following)) {
                setFollowing(data.following);
            }
        } catch (e) {
            console.error('[MesSuivisScreen] Erreur chargement:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (isFocused) fetchFollowing();
    }, [isFocused, fetchFollowing]);

    const handleUnfollow = useCallback(async (seller: FollowedSeller) => {
        Alert.alert(
            'Ne plus suivre',
            `Voulez-vous ne plus suivre ${seller.seller_name || 'ce vendeur'} ?`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Ne plus suivre',
                    style: 'destructive',
                    onPress: async () => {
                        setUnfollowingId(seller.followed_id);
                        try {
                            if (seller.service_id) {
                                await apiPost(`/api/services/${seller.service_id}/follow`, {});
                            } else {
                                await apiPost(`/api/users/${seller.followed_id}/follow`, {});
                            }
                            setFollowing((prev) => prev.filter((f) => f.followed_id !== seller.followed_id));
                        } catch {
                            Alert.alert('Erreur', t('mesSuivisScreen.impossibleDeSeDesabonner'));
                        } finally {
                            setUnfollowingId(null);
                        }
                    },
                },
            ],
        );
    }, []);

    const handleViewService = useCallback((seller: FollowedSeller) => {
        if (seller.service_id) {
            (navigation as any).navigate('ServiceDetailShared', { serviceId: seller.service_id });
        }
    }, [navigation]);

    const getInitial = (name: string) => (name || 'Y')[0].toUpperCase();

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return '';
        }
    };

    const renderItem = useCallback(({ item }: { item: FollowedSeller }) => {
        const isUnfollowing = unfollowingId === item.followed_id;
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => handleViewService(item)}
                activeOpacity={0.7}
                disabled={!item.service_id}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitial(item.seller_name)}</Text>
                </View>
                <View style={styles.cardContent}>
                    <Text style={styles.sellerName} numberOfLines={1}>
                        {item.seller_name || 'Vendeur'}
                    </Text>
                    {item.service_title && (
                        <Text style={styles.serviceTitle} numberOfLines={1}>
                            {item.service_title}
                        </Text>
                    )}
                    <View style={styles.metaRow}>
                        {item.category && (
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{item.category}</Text>
                            </View>
                        )}
                        <Text style={styles.followersText}>
                            {item.followers_count} abonné{item.followers_count !== 1 ? 's' : ''}
                        </Text>
                        <Text style={styles.dateText}>
                            {formatDate(item.followed_at)}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.unfollowButton}
                    onPress={() => handleUnfollow(item)}
                    disabled={isUnfollowing}
                    activeOpacity={0.7}
                >
                    {isUnfollowing ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                        <SafeIcon name="user-minus" size={18} color="#EF4444" type="lucide" />
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        );
    }, [unfollowingId, handleViewService, handleUnfollow]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#FF2D55" />
                <Text style={styles.loadingText}>{t('mesSuivis.chargementDeVosSuivis')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => (navigation as any).goBack()}
                >
                    <SafeIcon name="arrow-left" size={22} color="#111" type="lucide" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('mesSuivis.mesSuivis')}</Text>
                <View style={styles.headerRight}>
                    <Text style={styles.countBadge}>{following.length}</Text>
                </View>
            </View>

            {following.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="users" size={56} color="#D1D5DB" type="lucide" />
                    <Text style={styles.emptyTitle}>{t('mesSuivis.aucunSuivi')}</Text>
                    <Text style={styles.emptySubtitle}>
                        Suivez des vendeurs depuis le feed vidéo pour retrouver leurs produits ici.
                    </Text>
                    <TouchableOpacity
                        style={styles.exploreButton}
                        onPress={() => (navigation as any).navigate('VideoFeed')}
                    >
                        <SafeIcon name="play" size={16} color="#fff" type="lucide" />
                        <Text style={styles.exploreText}>{t('mesSuivis.explorerLesVideos')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={following}
                    keyExtractor={(item) => String(item.followed_id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchFollowing(true);
                            }}
                            tintColor="#FF2D55"
                            colors={['#FF2D55']}
                        />
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        gap: 12,
    },
    loadingText: {
        color: '#6B7280',
        fontSize: 15,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: '#111',
        marginLeft: 12,
    },
    headerRight: {
        alignItems: 'center',
    },
    countBadge: {
        backgroundColor: '#FF2D55',
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        overflow: 'hidden',
    },
    listContent: {
        padding: 16,
        gap: 10,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FF2D55',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
    },
    cardContent: {
        flex: 1,
        marginLeft: 12,
        gap: 2,
    },
    sellerName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    serviceTitle: {
        fontSize: 13,
        color: '#6B7280',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    categoryBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3B82F6',
    },
    followersText: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    dateText: {
        fontSize: 11,
        color: '#D1D5DB',
    },
    unfollowButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#374151',
        marginTop: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
    },
    exploreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FF2D55',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 50,
        marginTop: 8,
    },
    exploreText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
});

export default MesSuivisScreen;
