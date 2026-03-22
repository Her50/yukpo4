import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { deliveryApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import type { DeliverySummary } from '../../types/delivery';

type FilterPeriod = 'all' | 'week' | 'month';

const COMMISSION_RATE = 0.2;

function getStartOfWeek(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const d = new Date(now);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getStartOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatDate(iso: string | undefined | null): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return iso;
    }
}

function formatXAF(amount: number): string {
    return `${Math.round(amount).toLocaleString('fr-FR')} XAF`;
}

const statusColors: Record<string, string> = {
    completed: modernColors.success,
    delivered: modernColors.success,
    cancelled: modernColors.error,
    refunded: modernColors.warning,
};

const CourierHistoryScreen: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const [deliveries, setDeliveries] = useState<DeliverySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterPeriod>('all');

    const loadData = useCallback(async () => {
        try {
            const [activeRes, historyRes] = await Promise.all([
                deliveryApi.listActiveDeliveries(),
                deliveryApi.getCourierHistory(),
            ]);

            const ar = activeRes as any;
            const hr = historyRes as any;
            const active: DeliverySummary[] = (ar?.data?.deliveries || ar?.data || []) as DeliverySummary[];
            const history: DeliverySummary[] = (hr?.data?.deliveries || hr?.data || []) as DeliverySummary[];

            const completedStatuses = new Set(['completed', 'delivered', 'cancelled', 'refunded']);
            const completed = active.filter((d) => completedStatuses.has(d.status));

            const merged = [...history];
            const existingIds = new Set(merged.map((d) => d.id));
            for (const d of completed) {
                if (!existingIds.has(d.id)) merged.push(d);
            }

            merged.sort((a, b) => {
                const dateA = a.lastEventAt || a.checkpoints?.[a.checkpoints.length - 1]?.timestamp || '';
                const dateB = b.lastEventAt || b.checkpoints?.[b.checkpoints.length - 1]?.timestamp || '';
                return dateB.localeCompare(dateA);
            });

            setDeliveries(merged);
        } catch (err) {
            console.error('[CourierHistory] load error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData]),
    );

    const filteredDeliveries = useMemo(() => {
        if (filter === 'all') return deliveries;
        const cutoff = filter === 'week' ? getStartOfWeek() : getStartOfMonth();
        return deliveries.filter((d) => {
            const ts = d.lastEventAt || d.checkpoints?.[d.checkpoints.length - 1]?.timestamp;
            if (!ts) return false;
            return new Date(ts) >= cutoff;
        });
    }, [deliveries, filter]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const renderFilterTab = (period: FilterPeriod, label: string) => (
        <TouchableOpacity
            style={[styles.filterTab, filter === period && styles.filterTabActive]}
            onPress={() => setFilter(period)}
        >
            <Text style={[styles.filterTabText, filter === period && styles.filterTabTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const renderDeliveryItem = ({ item }: { item: DeliverySummary }) => {
        const gross = item.pricing?.finalTotal ?? item.pricing?.estimated ?? 0;
        const commission = gross * COMMISSION_RATE;
        const net = gross - commission;
        const date = item.lastEventAt || item.checkpoints?.[item.checkpoints.length - 1]?.timestamp;
        const rating = item.courier?.rating;
        const badgeColor = statusColors[item.status] || modernColors.textSecondary;

        return (
            <NativeCard style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badgeColor + '20' }]}>
                        <Text style={[styles.statusText, { color: badgeColor }]}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.addressRow}>
                    <SafeIcon name="map-pin" size={14} color={modernColors.success} type="lucide" />
                    <Text style={styles.addressText} numberOfLines={1}>
                        {item.pickup?.address || t('delivery.unknownAddress') || 'Adresse inconnue'}
                    </Text>
                </View>
                <View style={styles.arrowRow}>
                    <SafeIcon name="arrow-down" size={12} color={modernColors.textTertiary} type="lucide" />
                </View>
                <View style={styles.addressRow}>
                    <SafeIcon name="map-pin" size={14} color={modernColors.error} type="lucide" />
                    <Text style={styles.addressText} numberOfLines={1}>
                        {item.dropoff?.address || t('delivery.unknownAddress') || 'Adresse inconnue'}
                    </Text>
                </View>

                <View style={styles.earningsRow}>
                    <View style={styles.earningItem}>
                        <Text style={styles.earningLabel}>{t('courier.gross') || 'Brut'}</Text>
                        <Text style={styles.earningValue}>{formatXAF(gross)}</Text>
                    </View>
                    <View style={styles.earningItem}>
                        <Text style={styles.earningLabel}>{t('courier.commission') || 'Commission'}</Text>
                        <Text style={[styles.earningValue, { color: modernColors.error }]}>-{formatXAF(commission)}</Text>
                    </View>
                    <View style={styles.earningItem}>
                        <Text style={styles.earningLabel}>{t('courier.net') || 'Net'}</Text>
                        <Text style={[styles.earningValue, { color: modernColors.success, fontWeight: '700' }]}>
                            {formatXAF(net)}
                        </Text>
                    </View>
                </View>

                {rating != null && rating > 0 && (
                    <View style={styles.ratingRow}>
                        <SafeIcon name="star" size={14} color="#F59E0B" type="lucide" />
                        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                    </View>
                )}
            </NativeCard>
        );
    };

    if (loading) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="clock" size={22} color={modernColors.primary} type="lucide" />
                <Text style={styles.title}>{t('courier.history') || 'Historique des courses'}</Text>
            </View>

            <View style={styles.filterRow}>
                {renderFilterTab('all', t('courier.filterAll') || 'Tout')}
                {renderFilterTab('week', t('courier.filterWeek') || 'Cette semaine')}
                {renderFilterTab('month', t('courier.filterMonth') || 'Ce mois')}
            </View>

            <FlatList
                data={filteredDeliveries}
                keyExtractor={(item) => item.id}
                renderItem={renderDeliveryItem}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[modernColors.primary]} />}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.center}>
                        <SafeIcon name="inbox" size={48} color={modernColors.textTertiary} type="lucide" />
                        <Text style={styles.emptyText}>{t('courier.noHistory') || 'Aucune course terminée'}</Text>
                    </View>
                }
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 8,
        marginBottom: 12,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
    },
    filterTabActive: {
        backgroundColor: modernColors.primary,
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    filterTabTextActive: {
        color: '#fff',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    card: {
        marginBottom: 12,
        padding: 16,
        borderRadius: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dateText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    arrowRow: {
        paddingLeft: 3,
        paddingVertical: 2,
    },
    addressText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.text,
    },
    earningsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    earningItem: {
        alignItems: 'center',
    },
    earningLabel: {
        fontSize: 11,
        color: modernColors.textTertiary,
        marginBottom: 2,
    },
    earningValue: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#F59E0B',
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textTertiary,
    },
});

export default CourierHistoryScreen;
