import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SafeIcon from '../SafeIcon';
import { NativeCard } from '../SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { modernColors } from '../../theme/modernTheme';
import type { DeliverySummary } from '../../types/delivery';

type PeriodFilter = 'all' | 'week' | 'month';

interface CourierEarningsBreakdownProps {
    deliveries: DeliverySummary[];
    period: PeriodFilter;
}

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

function formatXAF(amount: number): string {
    return `${Math.round(amount).toLocaleString('fr-FR')} XAF`;
}

function formatShortDate(iso: string | undefined | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch {
        return '—';
    }
}

const CourierEarningsBreakdown: React.FC<CourierEarningsBreakdownProps> = ({ deliveries, period }) => {
    const { t } = useLanguageSafe();

    const filtered = useMemo(() => {
        if (period === 'all') return deliveries;
        const cutoff = period === 'week' ? getStartOfWeek() : getStartOfMonth();
        return deliveries.filter((d) => {
            const ts = d.lastEventAt || d.checkpoints?.[d.checkpoints.length - 1]?.timestamp;
            return ts ? new Date(ts) >= cutoff : false;
        });
    }, [deliveries, period]);

    const stats = useMemo(() => {
        let totalGross = 0;
        let totalCommission = 0;

        const rows = filtered.map((d) => {
            const gross = d.pricing?.finalTotal ?? d.pricing?.estimated ?? 0;
            const commission = gross * COMMISSION_RATE;
            const net = gross - commission;
            totalGross += gross;
            totalCommission += commission;

            const date = d.lastEventAt || d.checkpoints?.[d.checkpoints.length - 1]?.timestamp;
            const paymentMethod = (d.metadata?.payment_method as string) || 'wallet';

            return { id: d.id, date, gross, commission, net, paymentMethod };
        });

        return {
            rows,
            totalGross,
            totalCommission,
            totalNet: totalGross - totalCommission,
            count: filtered.length,
        };
    }, [filtered]);

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <NativeCard style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>
                    {t('courier.earningsSummary') || 'Résumé des gains'}
                </Text>

                <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                        <SafeIcon name="truck" size={20} color={modernColors.primary} type="lucide" />
                        <Text style={styles.summaryValue}>{stats.count}</Text>
                        <Text style={styles.summaryLabel}>{t('courier.deliveries') || 'Courses'}</Text>
                    </View>

                    <View style={styles.summaryItem}>
                        <SafeIcon name="banknote" size={20} color={modernColors.info} type="lucide" />
                        <Text style={styles.summaryValue}>{formatXAF(stats.totalGross)}</Text>
                        <Text style={styles.summaryLabel}>{t('courier.totalGross') || 'Total brut'}</Text>
                    </View>

                    <View style={styles.summaryItem}>
                        <SafeIcon name="percent" size={20} color={modernColors.error} type="lucide" />
                        <Text style={[styles.summaryValue, { color: modernColors.error }]}>
                            -{formatXAF(stats.totalCommission)}
                        </Text>
                        <Text style={styles.summaryLabel}>{t('courier.commissionTotal') || 'Commission (20%)'}</Text>
                    </View>

                    <View style={styles.summaryItem}>
                        <SafeIcon name="wallet" size={20} color={modernColors.success} type="lucide" />
                        <Text style={[styles.summaryValue, { color: modernColors.success }]}>
                            {formatXAF(stats.totalNet)}
                        </Text>
                        <Text style={styles.summaryLabel}>{t('courier.netPayout') || 'Net à percevoir'}</Text>
                    </View>
                </View>
            </NativeCard>

            {stats.rows.length > 0 && (
                <NativeCard style={styles.tableCard}>
                    <Text style={styles.tableTitle}>
                        {t('courier.breakdownTitle') || 'Détail par course'}
                    </Text>

                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('courier.gross') || 'Brut'}</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Comm.</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Net</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Paiement</Text>
                    </View>

                    {stats.rows.map((row) => (
                        <View key={row.id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 1.2 }]}>{formatShortDate(row.date)}</Text>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{formatXAF(row.gross)}</Text>
                            <Text style={[styles.tableCell, { flex: 1, color: modernColors.error }]}>
                                -{formatXAF(row.commission)}
                            </Text>
                            <Text style={[styles.tableCell, { flex: 1, color: modernColors.success, fontWeight: '600' }]}>
                                {formatXAF(row.net)}
                            </Text>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{row.paymentMethod}</Text>
                        </View>
                    ))}
                </NativeCard>
            )}

            {stats.rows.length === 0 && (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="inbox" size={40} color={modernColors.textTertiary} type="lucide" />
                    <Text style={styles.emptyText}>
                        {t('courier.noEarnings') || 'Aucun gain pour cette période'}
                    </Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    summaryCard: {
        margin: 16,
        padding: 20,
        borderRadius: 16,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    summaryItem: {
        width: '47%',
        alignItems: 'center',
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        gap: 4,
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    summaryLabel: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    tableCard: {
        marginHorizontal: 16,
        marginBottom: 24,
        padding: 16,
        borderRadius: 16,
    },
    tableTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    tableHeaderCell: {
        fontSize: 11,
        fontWeight: '700',
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.borderLight,
    },
    tableCell: {
        fontSize: 12,
        color: modernColors.text,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textTertiary,
    },
});

export default CourierEarningsBreakdown;
