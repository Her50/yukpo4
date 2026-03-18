import { useNavigation } from '@react-navigation/native';
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
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { isAdminUser } from '../../utils/roleHelpers';

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

interface CommissionEntry {
    id: string;
    delivery_id: string;
    date: string;
    product_commission_cents: number;
    delivery_commission_cents: number;
    total_commission_cents: number;
    merchant_name: string;
    courier_name: string;
    status: string;
}

interface CommissionStats {
    total_commissions_cents: number;
    total_deliveries: number;
    avg_commission_cents: number;
    product_commission_rate: number;
    delivery_commission_rate: number;
}

const PAGE_SIZE = 20;

const DeliveryCommissionsAdminScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [period, setPeriod] = useState<PeriodFilter>('month');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [stats, setStats] = useState<CommissionStats>({
        total_commissions_cents: 0,
        total_deliveries: 0,
        avg_commission_cents: 0,
        product_commission_rate: 5,
        delivery_commission_rate: 20,
    });
    const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        if (!user || !isAdminUser(user)) {
            Alert.alert(
                t('deliveryCommissionsAdmin.accessDenied'),
                t('deliveryCommissionsAdmin.adminOnly'),
                [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
            return;
        }
        loadData(true);
    }, [user, period]);

    const loadData = async (reset = false) => {
        try {
            if (reset) {
                setLoading(true);
                setPage(1);
                setHasMore(true);
            }

            const currentPage = reset ? 1 : page;

            const [commissionsRes, statsRes] = await Promise.all([
                apiGet(`/api/admin/delivery-commissions?period=${period}&page=${currentPage}&limit=${PAGE_SIZE}`),
                apiGet(`/api/delivery/courier/stats?period=${period}`),
            ]);

            const commData = commissionsRes?.data || commissionsRes;
            const list: CommissionEntry[] = commData?.commissions || commData?.data || [];

            if (reset) {
                setCommissions(list);
            } else {
                setCommissions(prev => [...prev, ...list]);
            }
            setHasMore(list.length >= PAGE_SIZE);

            const sData = statsRes?.data || statsRes;
            setStats({
                total_commissions_cents: sData?.total_commissions_cents ?? 0,
                total_deliveries: sData?.total_deliveries ?? 0,
                avg_commission_cents: sData?.avg_commission_cents ?? 0,
                product_commission_rate: sData?.product_commission_rate ?? 5,
                delivery_commission_rate: sData?.delivery_commission_rate ?? 20,
            });
        } catch (error: any) {
            console.error('[DeliveryCommissionsAdmin] Load error:', error);
            Alert.alert(t('message.error'), error?.message || t('deliveryCommissionsAdmin.loadError'));
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData(true);
    }, [period]);

    const loadMore = useCallback(() => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        setPage(nextPage);
        loadData(false);
    }, [loadingMore, hasMore, page, period]);

    const formatCents = (cents: number): string => {
        return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const truncateId = (id: string): string => {
        if (!id) return '—';
        return id.length > 10 ? `${id.slice(0, 4)}...${id.slice(-4)}` : id;
    };

    const formatDate = (dateStr: string): string => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status?.toLowerCase()) {
            case 'completed': case 'delivered': return modernColors.success;
            case 'pending': return modernColors.warning;
            case 'cancelled': case 'failed': return modernColors.error;
            default: return modernColors.textSecondary;
        }
    };

    const periods: { key: PeriodFilter; label: string }[] = [
        { key: 'today', label: t('deliveryCommissionsAdmin.today') },
        { key: 'week', label: t('deliveryCommissionsAdmin.thisWeek') },
        { key: 'month', label: t('deliveryCommissionsAdmin.thisMonth') },
        { key: 'all', label: t('deliveryCommissionsAdmin.allTime') },
    ];

    const renderHeader = () => (
        <View>
            {/* Period filter */}
            <View style={styles.periodRow}>
                {periods.map(p => (
                    <TouchableOpacity
                        key={p.key}
                        style={[styles.periodChip, period === p.key && styles.periodChipActive]}
                        onPress={() => setPeriod(p.key)}
                    >
                        <Text style={[styles.periodChipText, period === p.key && styles.periodChipTextActive]}>
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Summary cards */}
            <View style={styles.cardsRow}>
                <NativeCard style={styles.summaryCard}>
                    <SafeIcon name="cash-outline" size={24} color={modernColors.success} />
                    <Text style={styles.cardValue}>{formatCents(stats.total_commissions_cents)} FCFA</Text>
                    <Text style={styles.cardLabel}>{t('deliveryCommissionsAdmin.totalCommissions')}</Text>
                </NativeCard>
                <NativeCard style={styles.summaryCard}>
                    <SafeIcon name="bicycle-outline" size={24} color={modernColors.primary} />
                    <Text style={styles.cardValue}>{stats.total_deliveries}</Text>
                    <Text style={styles.cardLabel}>{t('deliveryCommissionsAdmin.totalDeliveries')}</Text>
                </NativeCard>
            </View>
            <View style={styles.cardsRow}>
                <NativeCard style={styles.summaryCard}>
                    <SafeIcon name="analytics-outline" size={24} color={modernColors.warning} />
                    <Text style={styles.cardValue}>{formatCents(stats.avg_commission_cents)} FCFA</Text>
                    <Text style={styles.cardLabel}>{t('deliveryCommissionsAdmin.avgCommission')}</Text>
                </NativeCard>
                <NativeCard style={styles.summaryCard}>
                    <SafeIcon name="pricetag-outline" size={24} color={modernColors.info || '#3498db'} />
                    <Text style={styles.cardValue}>
                        {stats.product_commission_rate}% / {stats.delivery_commission_rate}%
                    </Text>
                    <Text style={styles.cardLabel}>{t('deliveryCommissionsAdmin.commissionRates')}</Text>
                </NativeCard>
            </View>

            {/* Section title */}
            <Text style={styles.sectionTitle}>{t('deliveryCommissionsAdmin.commissionsDetail')}</Text>
        </View>
    );

    const renderCommissionItem = ({ item }: { item: CommissionEntry }) => (
        <NativeCard style={styles.entryCard}>
            <View style={styles.entryHeader}>
                <Text style={styles.entryId}>{truncateId(item.delivery_id)}</Text>
                <Text style={[styles.entryStatus, { color: getStatusColor(item.status) }]}>
                    {item.status}
                </Text>
            </View>
            <Text style={styles.entryDate}>{formatDate(item.date)}</Text>

            <View style={styles.entryRow}>
                <View style={styles.entryCol}>
                    <Text style={styles.entryLabel}>{t('deliveryCommissionsAdmin.merchant')}</Text>
                    <Text style={styles.entryValue} numberOfLines={1}>{item.merchant_name || '—'}</Text>
                </View>
                <View style={styles.entryCol}>
                    <Text style={styles.entryLabel}>{t('deliveryCommissionsAdmin.courier')}</Text>
                    <Text style={styles.entryValue} numberOfLines={1}>{item.courier_name || '—'}</Text>
                </View>
            </View>

            <View style={styles.commissionBreakdown}>
                <View style={styles.commissionLine}>
                    <Text style={styles.commissionLabel}>{t('deliveryCommissionsAdmin.productCommission')}</Text>
                    <Text style={styles.commissionAmount}>{formatCents(item.product_commission_cents)} F</Text>
                </View>
                <View style={styles.commissionLine}>
                    <Text style={styles.commissionLabel}>{t('deliveryCommissionsAdmin.deliveryCommission')}</Text>
                    <Text style={styles.commissionAmount}>{formatCents(item.delivery_commission_cents)} F</Text>
                </View>
                <View style={[styles.commissionLine, styles.totalLine]}>
                    <Text style={styles.totalLabel}>{t('deliveryCommissionsAdmin.total')}</Text>
                    <Text style={styles.totalAmount}>{formatCents(item.total_commission_cents)} FCFA</Text>
                </View>
            </View>
        </NativeCard>
    );

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={modernColors.primary} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <SafeIcon name="receipt-outline" size={48} color={modernColors.textSecondary} />
                <Text style={styles.emptyText}>{t('deliveryCommissionsAdmin.noCommissions')}</Text>
            </View>
        );
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header bar */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-back" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('deliveryCommissionsAdmin.title')}</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                    <SafeIcon name="refresh-outline" size={22} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('deliveryCommissionsAdmin.loading')}</Text>
                </View>
            ) : (
                <FlatList
                    data={commissions}
                    keyExtractor={(item, idx) => item.id || `${item.delivery_id}-${idx}`}
                    renderItem={renderCommissionItem}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmpty}
                    ListFooterComponent={renderFooter}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.3}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[modernColors.primary]}
                            tintColor={modernColors.primary}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backBtn: {
        padding: 4,
        marginRight: 12,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    refreshBtn: {
        padding: 4,
    },
    periodRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    periodChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    periodChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    periodChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    periodChipTextActive: {
        color: '#FFFFFF',
    },
    cardsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 10,
        marginBottom: 10,
    },
    summaryCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
        gap: 6,
    },
    cardValue: {
        fontSize: 16,
        fontWeight: '800',
        color: modernColors.text,
        textAlign: 'center',
    },
    cardLabel: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 6,
    },
    listContent: {
        paddingBottom: 40,
    },
    entryCard: {
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 14,
    },
    entryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    entryId: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
        fontFamily: 'monospace',
    },
    entryStatus: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    entryDate: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    entryRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
    },
    entryCol: {
        flex: 1,
    },
    entryLabel: {
        fontSize: 10,
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
        fontWeight: '600',
        marginBottom: 2,
    },
    entryValue: {
        fontSize: 13,
        color: modernColors.text,
        fontWeight: '500',
    },
    commissionBreakdown: {
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingTop: 8,
        gap: 4,
    },
    commissionLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    commissionLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    commissionAmount: {
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '500',
    },
    totalLine: {
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingTop: 6,
    },
    totalLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.text,
    },
    totalAmount: {
        fontSize: 14,
        fontWeight: '800',
        color: modernColors.success,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    footerLoader: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default DeliveryCommissionsAdminScreen;
