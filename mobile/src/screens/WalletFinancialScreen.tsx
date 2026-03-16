// @ts-nocheck
// ✅ Écran de suivi financier complet pour prestataires, partenaires et coursiers
// Dashboard avec: solde, historique transactions, analytics périodiques, graphiques revenus
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { NativeCard } from '../components/SafeNativeDesign';
import { SafeNativeView } from '../components/SafeNativeView';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WalletTransaction {
    id: number;
    transaction_type: string;
    amount_cents: number;
    balance_before_cents: number;
    balance_after_cents: number;
    currency: string;
    reference_type: string | null;
    reference_id: string | null;
    delivery_id: string | null;
    description: string | null;
    created_at: string;
}

interface FinancialSummary {
    total_credits_cents: number;
    total_debits_cents: number;
    total_refunds_cents: number;
    net_income_cents: number;
    transaction_count: number;
    growth_percent: number;
}

interface DailyRevenue {
    date: string;
    amount_cents: number;
}

interface DisbursementSummary {
    count: number;
    total_completed_cents: number;
}

type PeriodDays = 7 | 30 | 90;
type TransactionFilter = 'all' | 'credit' | 'debit' | 'refund';

const WalletFinancialScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodDays>(30);
    const [selectedFilter, setSelectedFilter] = useState<TransactionFilter>('all');
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');

    // Data
    const [balanceCents, setBalanceCents] = useState(0);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
    const [disbursements, setDisbursements] = useState<DisbursementSummary | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadAllData();
        }, [selectedPeriod, selectedFilter])
    );

    const loadAllData = async () => {
        if (!loading) setLoading(true);
        try {
            await Promise.all([loadFinancialSummary(), loadTransactions()]);
        } catch (error) {
            console.error('[WalletFinancial] Error loading data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadFinancialSummary = async () => {
        try {
            const response = await apiGet<any>(`/shopping/wallet/financial-summary`, {
                params: { days: selectedPeriod },
            });
            const data = response.data as any;
            if (data?.success) {
                setBalanceCents(data.balance_cents || 0);
                setSummary(data.summary || null);
                setDailyRevenue(data.daily_revenue || []);
                setDisbursements(data.disbursements || null);
            }
        } catch (err) {
            console.warn('[WalletFinancial] Summary error:', err);
        }
    };

    const loadTransactions = async () => {
        try {
            const params: any = { limit: 100, offset: 0 };
            if (selectedFilter !== 'all') {
                params.type = selectedFilter === 'credit'
                    ? 'credit_payout'
                    : selectedFilter === 'debit'
                        ? 'debit_delivery'
                        : 'refund_delivery';
            }
            const response = await apiGet<any>(`/shopping/wallet/transactions`, { params });
            const data = response.data as any;
            if (data?.success) {
                setTransactions(data.transactions || []);
                if (data.balance_cents !== undefined) {
                    setBalanceCents(data.balance_cents);
                }
            }
        } catch (err) {
            console.warn('[WalletFinancial] Transactions error:', err);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadAllData();
    };

    const formatCurrency = (cents: number) => {
        const amount = Math.abs(cents) / 100;
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount) + ' FCFA';
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getTransactionIcon = (type: string) => {
        if (type.startsWith('credit')) return { icon: 'arrow-down-left', color: modernColors.success };
        if (type.startsWith('debit')) return { icon: 'arrow-up-right', color: modernColors.error };
        if (type.startsWith('refund')) return { icon: 'rotate-ccw', color: modernColors.info };
        return { icon: 'activity', color: modernColors.textSecondary };
    };

    const getTransactionLabel = (type: string) => {
        switch (type) {
            case 'credit_payout': return t('payment.payout.completed') || t('walletFinancial.reversementRecu');
            case 'credit_delivery': return 'Crédit livraison';
            case 'debit_delivery': return 'Débit livraison';
            case 'refund_delivery': return t('payment.refund.completed') || 'Remboursement';
            default:
                if (type.startsWith('credit')) return 'Crédit';
                if (type.startsWith('debit')) return 'Débit';
                if (type.startsWith('refund')) return 'Remboursement';
                return type;
        }
    };

    // ===== Mini bar chart for daily revenue =====
    const renderMiniChart = () => {
        if (dailyRevenue.length === 0) {
            return (
                <View style={styles.chartEmpty}>
                    <Text style={styles.chartEmptyText}>{t('walletFinancial.aucuneDonneePourCettePeriode')}</Text>
                </View>
            );
        }
        const maxAmount = Math.max(...dailyRevenue.map(d => d.amount_cents), 1);
        const barWidth = Math.max(4, (SCREEN_WIDTH - 80) / Math.max(dailyRevenue.length, 1) - 2);

        return (
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>{t('walletFinancial.revenusQuotidiens')}/Text>
                <View style={styles.chartBars}>
                    {dailyRevenue.map((day, index) => {
                        const height = Math.max(4, (day.amount_cents / maxAmount) * 100);
                        return (
                            <View key={index} style={styles.chartBarWrapper}>
                                <View
                                    style={[
                                        styles.chartBar,
                                        {
                                            height,
                                            width: barWidth,
                                            backgroundColor: day.amount_cents > 0
                                                ? modernColors.primary
                                                : modernColors.border,
                                        },
                                    ]}
                                />
                            </View>
                        );
                    })}
                </View>
                <View style={styles.chartLabels}>
                    <Text style={styles.chartLabel}>
                        {dailyRevenue.length > 0
                            ? new Date(dailyRevenue[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                            : ''}
                    </Text>
                    <Text style={styles.chartLabel}>
                        {dailyRevenue.length > 0
                            ? new Date(dailyRevenue[dailyRevenue.length - 1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                            : ''}
                    </Text>
                </View>
            </View>
        );
    };

    // ===== KPI Cards =====
    const renderKPIs = () => {
        if (!summary) return null;
        const growthColor = summary.growth_percent >= 0 ? modernColors.success : modernColors.error;
        const growthIcon = summary.growth_percent >= 0 ? 'trending-up' : 'trending-down';

        return (
            <View style={styles.kpiGrid}>
                <NativeCard style={[styles.kpiCard, styles.kpiCardLarge]}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="wallet" size={18} color={modernColors.primary} />
                        <Text style={styles.kpiLabel}>{t('payment.wallet.balance') || 'Solde disponible'}</Text>
                    </View>
                    <Text style={styles.kpiValueLarge}>{formatCurrency(balanceCents)}</Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="arrow-down-left" size={16} color={modernColors.success} />
                        <Text style={styles.kpiLabel}>Revenus</Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: modernColors.success }]}>
                        +{formatCurrency(summary.total_credits_cents)}
                    </Text>
                    <View style={styles.growthRow}>
                        <SafeIcon name={growthIcon} size={12} color={growthColor} />
                        <Text style={[styles.growthText, { color: growthColor }]}>
                            {summary.growth_percent >= 0 ? '+' : ''}{summary.growth_percent}%
                        </Text>
                    </View>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="arrow-up-right" size={16} color={modernColors.error} />
                        <Text style={styles.kpiLabel}>{t('walletFinancial.debits')}</Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: modernColors.error }]}>
                        -{formatCurrency(summary.total_debits_cents)}
                    </Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="rotate-ccw" size={16} color={modernColors.info} />
                        <Text style={styles.kpiLabel}>Remboursements</Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: modernColors.info }]}>
                        {formatCurrency(summary.total_refunds_cents)}
                    </Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="bar-chart-3" size={16} color={modernColors.primary} />
                        <Text style={styles.kpiLabel}>{t('walletFinancial.revenuNet')}/Text>
                    </View>
                    <Text style={[styles.kpiValue, {
                        color: summary.net_income_cents >= 0 ? modernColors.success : modernColors.error
                    }]}>
                        {summary.net_income_cents >= 0 ? '+' : ''}{formatCurrency(summary.net_income_cents)}
                    </Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="hash" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.kpiLabel}>Transactions</Text>
                    </View>
                    <Text style={styles.kpiValue}>{summary.transaction_count}</Text>
                </NativeCard>
            </View>
        );
    };

    // ===== Disbursement summary =====
    const renderDisbursements = () => {
        if (!disbursements || (disbursements.count === 0 && disbursements.total_completed_cents === 0)) return null;
        return (
            <NativeCard style={styles.disbursementCard}>
                <View style={styles.disbursementHeader}>
                    <SafeIcon name="send" size={18} color={modernColors.accent} />
                    <Text style={styles.disbursementTitle}>Transferts Mobile Money</Text>
                </View>
                <View style={styles.disbursementRow}>
                    <Text style={styles.disbursementLabel}>{t('walletFinancial.transfertsEffectues')}</Text>
                    <Text style={styles.disbursementValue}>{disbursements.count}</Text>
                </View>
                <View style={styles.disbursementRow}>
                    <Text style={styles.disbursementLabel}>{t('walletFinancial.montantTotalTransfere')}</Text>
                    <Text style={[styles.disbursementValue, { color: modernColors.success }]}>
                        {formatCurrency(disbursements.total_completed_cents)}
                    </Text>
                </View>
            </NativeCard>
        );
    };

    // ===== Transaction item =====
    const renderTransaction = ({ item }: { item: WalletTransaction }) => {
        const { icon, color } = getTransactionIcon(item.transaction_type);
        const isCredit = item.transaction_type.startsWith('credit') || item.transaction_type.startsWith('refund');

        return (
            <View style={styles.txnItem}>
                <View style={[styles.txnIconContainer, { backgroundColor: color + '15' }]}>
                    <SafeIcon name={icon} size={18} color={color} />
                </View>
                <View style={styles.txnContent}>
                    <Text style={styles.txnType}>{getTransactionLabel(item.transaction_type)}</Text>
                    <Text style={styles.txnDesc} numberOfLines={1}>
                        {item.description || item.reference_type || '—'}
                    </Text>
                    <Text style={styles.txnDate}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={styles.txnAmountContainer}>
                    <Text style={[styles.txnAmount, { color: isCredit ? modernColors.success : modernColors.error }]}>
                        {isCredit ? '+' : '-'}{formatCurrency(item.amount_cents)}
                    </Text>
                    <Text style={styles.txnBalance}>
                        Solde: {formatCurrency(item.balance_after_cents)}
                    </Text>
                </View>
            </View>
        );
    };

    // ===== Period selector =====
    const renderPeriodSelector = () => (
        <View style={styles.periodSelector}>
            {([7, 30, 90] as PeriodDays[]).map((days) => (
                <TouchableOpacity
                    key={days}
                    style={[styles.periodBtn, selectedPeriod === days && styles.periodBtnActive]}
                    onPress={() => setSelectedPeriod(days)}
                >
                    <Text style={[styles.periodBtnText, selectedPeriod === days && styles.periodBtnTextActive]}>
                        {days}j
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    // ===== Tab selector =====
    const renderTabSelector = () => (
        <View style={styles.tabSelector}>
            <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
                onPress={() => setActiveTab('overview')}
            >
                <SafeIcon name="bar-chart-3" size={16} color={activeTab === 'overview' ? '#fff' : modernColors.textSecondary} />
                <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.tabBtnTextActive]}>
                    Vue d'ensemble
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'transactions' && styles.tabBtnActive]}
                onPress={() => setActiveTab('transactions')}
            >
                <SafeIcon name="list" size={16} color={activeTab === 'transactions' ? '#fff' : modernColors.textSecondary} />
                <Text style={[styles.tabBtnText, activeTab === 'transactions' && styles.tabBtnTextActive]}>
                    Transactions
                </Text>
            </TouchableOpacity>
        </View>
    );

    // ===== Transaction filter =====
    const renderTransactionFilter = () => (
        <View style={styles.filterRow}>
            {(['all', 'credit', 'debit', 'refund'] as TransactionFilter[]).map((filter) => {
                const labels: Record<TransactionFilter, string> = {
                    all: 'Tout',
                    credit: t('walletFinancialScreen.credits'),
                    debit: t('walletFinancialScreen.debits'),
                    refund: 'Remb.',
                };
                return (
                    <TouchableOpacity
                        key={filter}
                        style={[styles.filterBtn, selectedFilter === filter && styles.filterBtnActive]}
                        onPress={() => setSelectedFilter(filter)}
                    >
                        <Text style={[styles.filterBtnText, selectedFilter === filter && styles.filterBtnTextActive]}>
                            {labels[filter]}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    if (loading && !refreshing) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('walletFinancial.chargementDesDonneesFinancieres')}</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView
                style={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <SafeIcon name="arrow-left" size={22} color={modernColors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>{t('payment.wallet.title') || t('walletFinancial.monPortefeuille')}</Text>
                        <Text style={styles.headerSubtitle}>{t('walletFinancial.suiviFinancierDetaille')}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('RechargeTokens')}
                        style={styles.topUpBtn}
                    >
                        <SafeIcon name="plus" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Balance card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>{t('payment.wallet.balance') || 'Solde disponible'}</Text>
                    <Text style={styles.balanceValue}>{formatCurrency(balanceCents)}</Text>
                    <View style={styles.balanceActions}>
                        <TouchableOpacity
                            style={styles.balanceActionBtn}
                            onPress={() => (navigation as any).navigate('RechargeTokens')}
                        >
                            <SafeIcon name="plus-circle" size={18} color="#fff" />
                            <Text style={styles.balanceActionText}>{t('payment.wallet.topUp') || 'Recharger'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Period selector */}
                {renderPeriodSelector()}

                {/* Tab selector */}
                {renderTabSelector()}

                {/* Tab content */}
                {activeTab === 'overview' ? (
                    <>
                        {renderKPIs()}
                        {renderMiniChart()}
                        {renderDisbursements()}

                        {/* Recent transactions preview */}
                        <View style={styles.recentSection}>
                            <View style={styles.recentHeader}>
                                <Text style={styles.recentTitle}>{t('walletFinancial.transactionsRecentes')}</Text>
                                <TouchableOpacity onPress={() => setActiveTab('transactions')}>
                                    <Text style={styles.recentSeeAll}>{t('walletFinancial.voirTout')}</Text>
                                </TouchableOpacity>
                            </View>
                            {transactions.slice(0, 5).map((txn) => (
                                <View key={txn.id}>{renderTransaction({ item: txn })}</View>
                            ))}
                            {transactions.length === 0 && (
                                <View style={styles.emptyTxn}>
                                    <SafeIcon name="inbox" size={40} color={modernColors.textTertiary} />
                                    <Text style={styles.emptyTxnText}>
                                        {t('payment.wallet.noTransactions') || t('walletFinancial.aucuneTransaction')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    <>
                        {renderTransactionFilter()}
                        <View style={styles.transactionsList}>
                            {transactions.length > 0 ? (
                                transactions.map((txn) => (
                                    <View key={txn.id}>{renderTransaction({ item: txn })}</View>
                                ))
                            ) : (
                                <View style={styles.emptyTxn}>
                                    <SafeIcon name="inbox" size={40} color={modernColors.textTertiary} />
                                    <Text style={styles.emptyTxnText}>
                                        {t('payment.wallet.noTransactions') || t('walletFinancial.aucuneTransaction')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: modernColors.background },
    scroll: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
    loadingText: { marginTop: 12, fontSize: 14, color: modernColors.textSecondary },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: 12, paddingBottom: 8,
    },
    backBtn: { padding: 8 },
    headerCenter: { flex: 1, marginLeft: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: modernColors.text },
    headerSubtitle: { fontSize: 12, color: modernColors.textSecondary, marginTop: 2 },
    topUpBtn: {
        backgroundColor: modernColors.primary, borderRadius: 20,
        width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    },

    // Balance card
    balanceCard: {
        marginHorizontal: 16, marginTop: 16, borderRadius: 16,
        backgroundColor: modernColors.primary, padding: 24, alignItems: 'center',
        shadowColor: modernColors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
    balanceValue: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 4 },
    balanceActions: { flexDirection: 'row', marginTop: 16, gap: 12 },
    balanceActionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 8,
    },
    balanceActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Period selector
    periodSelector: {
        flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
        backgroundColor: modernColors.surfaceVariant, borderRadius: 12, padding: 4,
    },
    periodBtn: {
        flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    },
    periodBtnActive: { backgroundColor: modernColors.primary },
    periodBtnText: { fontSize: 13, fontWeight: '600', color: modernColors.textSecondary },
    periodBtnTextActive: { color: '#fff' },

    // Tab selector
    tabSelector: {
        flexDirection: 'row', marginHorizontal: 16, marginTop: 12,
        backgroundColor: modernColors.surfaceVariant, borderRadius: 12, padding: 4,
    },
    tabBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 10, borderRadius: 10,
    },
    tabBtnActive: { backgroundColor: modernColors.primary },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: modernColors.textSecondary },
    tabBtnTextActive: { color: '#fff' },

    // KPI Grid
    kpiGrid: {
        flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12,
        marginTop: 16, gap: 8,
    },
    kpiCard: {
        width: (SCREEN_WIDTH - 40) / 2, padding: 14, borderRadius: 12,
    },
    kpiCardLarge: { width: SCREEN_WIDTH - 32, marginBottom: 4 },
    kpiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    kpiLabel: { fontSize: 12, color: modernColors.textSecondary, fontWeight: '500' },
    kpiValue: { fontSize: 16, fontWeight: '700', color: modernColors.text },
    kpiValueLarge: { fontSize: 26, fontWeight: '800', color: modernColors.primary, marginTop: 2 },
    growthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    growthText: { fontSize: 11, fontWeight: '600' },

    // Chart
    chartContainer: {
        marginHorizontal: 16, marginTop: 16, backgroundColor: modernColors.surface,
        borderRadius: 14, padding: 16, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    chartTitle: { fontSize: 14, fontWeight: '600', color: modernColors.text, marginBottom: 12 },
    chartBars: {
        flexDirection: 'row', alignItems: 'flex-end', height: 110,
        gap: 2, paddingHorizontal: 4,
    },
    chartBarWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    chartBar: { borderRadius: 3, minHeight: 4 },
    chartLabels: {
        flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
    },
    chartLabel: { fontSize: 10, color: modernColors.textTertiary },
    chartEmpty: { paddingVertical: 30, alignItems: 'center' },
    chartEmptyText: { fontSize: 13, color: modernColors.textTertiary },

    // Disbursement card
    disbursementCard: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 14 },
    disbursementHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    disbursementTitle: { fontSize: 15, fontWeight: '600', color: modernColors.text },
    disbursementRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 6,
    },
    disbursementLabel: { fontSize: 13, color: modernColors.textSecondary },
    disbursementValue: { fontSize: 14, fontWeight: '700', color: modernColors.text },

    // Recent section
    recentSection: { marginHorizontal: 16, marginTop: 16 },
    recentHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
    },
    recentTitle: { fontSize: 16, fontWeight: '600', color: modernColors.text },
    recentSeeAll: { fontSize: 13, color: modernColors.primary, fontWeight: '500' },

    // Transaction filter
    filterRow: {
        flexDirection: 'row', marginHorizontal: 16, marginTop: 12,
        gap: 8, marginBottom: 8,
    },
    filterBtn: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
    },
    filterBtnActive: { backgroundColor: modernColors.primary },
    filterBtnText: { fontSize: 12, fontWeight: '600', color: modernColors.textSecondary },
    filterBtnTextActive: { color: '#fff' },

    // Transactions list
    transactionsList: { marginHorizontal: 16, marginTop: 4 },

    // Transaction item
    txnItem: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: modernColors.borderLight,
    },
    txnIconContainer: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    txnContent: { flex: 1, marginLeft: 12 },
    txnType: { fontSize: 14, fontWeight: '600', color: modernColors.text },
    txnDesc: { fontSize: 12, color: modernColors.textSecondary, marginTop: 2 },
    txnDate: { fontSize: 11, color: modernColors.textTertiary, marginTop: 2 },
    txnAmountContainer: { alignItems: 'flex-end' },
    txnAmount: { fontSize: 14, fontWeight: '700' },
    txnBalance: { fontSize: 10, color: modernColors.textTertiary, marginTop: 2 },

    // Empty state
    emptyTxn: { paddingVertical: 40, alignItems: 'center' },
    emptyTxnText: { fontSize: 14, color: modernColors.textTertiary, marginTop: 8 },
});

export default WalletFinancialScreen;
