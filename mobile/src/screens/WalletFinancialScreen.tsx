// ✅ Comprehensive Financial Tracking Screen for ALL users
// Shows: balance, detailed transaction history, periodic summaries, full traceability
// Supports: regular users, partners, couriers, providers
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
import { useLanguageSafe } from '../contexts/LanguageContext';
import useUserCountry from '../hooks/useUserCountry';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const currencySymbolForCountry = (code: string): string => {
    const map: Record<string, string> = {
        CM: 'FCFA', GA: 'FCFA', CG: 'FCFA', CF: 'FCFA', TD: 'FCFA', GQ: 'FCFA',
        SN: 'FCFA', CI: 'FCFA', ML: 'FCFA', BF: 'FCFA', NE: 'FCFA', TG: 'FCFA', BJ: 'FCFA', GW: 'FCFA',
        NG: '₦', GH: 'GH₵', KE: 'KSh', TZ: 'TSh', UG: 'USh', RW: 'FRw',
        ZA: 'R', CD: 'FC', ET: 'Br', MG: 'Ar', MA: 'DH', DZ: 'DA', TN: 'DT', EG: 'E£',
    };
    return map[code?.toUpperCase()] || 'FCFA';
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UnifiedTransaction {
    id: number;
    type: 'credit' | 'debit' | 'refund';
    amount_cents: number;
    balance_before_cents?: number;
    balance_after_cents?: number;
    currency: string;
    category: 'payment' | 'consumption' | 'delivery' | 'service' | 'refund' | 'payout' | 'other';
    reference_type?: string | null;
    reference_id?: string | null;
    description: string | null;
    location?: string | null;
    created_at: string;
    trace_id?: string; // For full traceability
}

interface FinancialSummary {
    total_credits_cents: number;
    total_debits_cents: number;
    total_refunds_cents: number;
    net_income_cents: number;
    transaction_count: number;
    growth_percent?: number;
    period_start: string;
    period_end: string;
}

interface PeriodSummary {
    date: string;
    credits_cents: number;
    debits_cents: number;
    net_cents: number;
    transaction_count: number;
}

type PeriodDays = 7 | 30 | 90;
type TransactionFilter = 'all' | 'credit' | 'debit' | 'refund';

const WalletFinancialScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { countryCode } = useUserCountry();
    const currSymbol = currencySymbolForCountry(countryCode);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodDays>(30);
    const [selectedFilter, setSelectedFilter] = useState<TransactionFilter>('all');
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');

    // Unified data
    const [balanceCents, setBalanceCents] = useState(0);
    const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [periodSummaries, setPeriodSummaries] = useState<PeriodSummary[]>([]);
    const [error, setError] = useState<string | null>(null);

    // ✅ Partner financial summary
    const isPartner = user?.role === 'partenaire' || user?.role === 'partner';
    const [partnerSummary, setPartnerSummary] = useState<any>(null);

    useFocusEffect(
        useCallback(() => {
            loadAllData();
        }, [selectedPeriod, selectedFilter])
    );

    // Recompute financial summary whenever transactions change (avoids stale state)
    useEffect(() => {
        if (transactions.length > 0 || !loading) {
            loadFinancialSummary();
        }
    }, [transactions, selectedFilter]);

    const loadAllData = async () => {
        if (!loading) setLoading(true);
        setError(null);
        try {
            // Load balance and transactions first, then compute summary from fresh data
            const promises: Promise<any>[] = [
                loadUnifiedBalance(),
                loadUnifiedTransactions(),
            ];
            // ✅ Partner: charger la synthèse financière prestataire
            if (isPartner) {
                promises.push(loadPartnerSummary());
            }
            await Promise.all(promises);
            // Summary is computed in a useEffect after transactions state updates
        } catch (error) {
            console.error('[WalletFinancial] Error loading data:', error);
            setError(t('financialTracking.errorLoadingData'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ✅ Charger la synthèse financière prestataire
    const loadPartnerSummary = async () => {
        try {
            const r = await apiGet<any>(`/api/users/partner-financial-summary?period=${selectedPeriod}d`);
            if (r?.data?.success) {
                setPartnerSummary(r.data);
            }
        } catch (err) {
            console.warn('[WalletFinancial] Partner summary error:', err);
        }
    };

    const loadUnifiedBalance = async () => {
        try {
            // Try wallet API first (for partners/couriers)
            const walletResponse = await apiGet<any>('/shopping/wallet/balance');
            if (walletResponse?.data?.success) {
                setBalanceCents(walletResponse.data.balance_cents || 0);
                return;
            }
        } catch (err) {
            // Fallback to user credits API
        }

        try {
            // Fallback: user credits API
            const creditsResponse = await apiGet<any>('/api/users/credits');
            if (creditsResponse?.data?.success) {
                setBalanceCents(creditsResponse.data.credits_cents || 0);
            }
        } catch (err) {
            console.warn('[WalletFinancial] Balance error:', err);
        }
    };

    const loadUnifiedTransactions = async () => {
        const allTransactions: UnifiedTransaction[] = [];

        try {
            // 1. Wallet transactions (for partners/couriers)
            const walletResponse = await apiGet<any>('/shopping/wallet/transactions', {
                params: { limit: 100, offset: 0 }
            });
            if (walletResponse?.data?.success) {
                const walletTxns = (walletResponse.data.transactions || []).map((txn: any) => ({
                    id: txn.id,
                    type: txn.transaction_type?.startsWith('credit') ? 'credit' :
                        txn.transaction_type?.startsWith('debit') ? 'debit' : 'refund',
                    amount_cents: txn.amount_cents,
                    balance_before_cents: txn.balance_before_cents,
                    balance_after_cents: txn.balance_after_cents,
                    currency: txn.currency || 'XAF',
                    category: mapTransactionCategory(txn.transaction_type),
                    reference_type: txn.reference_type,
                    reference_id: txn.reference_id,
                    description: txn.description,
                    location: extractLocation(txn),
                    created_at: txn.created_at,
                    trace_id: `wallet_${txn.id}`
                }));
                allTransactions.push(...walletTxns);
            }
        } catch (err) {
            console.warn('[WalletFinancial] Wallet transactions error:', err);
        }

        try {
            // 2. User credit history (for regular users)
            const creditsResponse = await apiGet<any>(`/api/users/consumption-history?period=${selectedPeriod}d`);
            if (creditsResponse?.data?.success) {
                const creditTxns = (creditsResponse.data.history || []).map((txn: any) => ({
                    id: txn.id || `credit_${Date.now()}_${Math.random()}`,
                    type: 'debit',
                    amount_cents: txn.amount_cents || 0,
                    balance_before_cents: txn.balance_before_cents,
                    balance_after_cents: txn.balance_after_cents,
                    currency: txn.currency || 'XAF',
                    category: 'consumption',
                    reference_type: txn.service_type,
                    reference_id: txn.service_id?.toString(),
                    description: txn.description || t('financialTracking.serviceUsage'),
                    location: txn.location,
                    created_at: txn.created_at,
                    trace_id: `credit_${txn.id || Math.random()}`
                }));
                allTransactions.push(...creditTxns);
            }
        } catch (err) {
            console.warn('[WalletFinancial] Credit history error:', err);
        }

        try {
            // 3. Payment history (recharges)
            const paymentsResponse = await apiGet<any>(`/api/users/payment-history?period=${selectedPeriod}d`);
            if (paymentsResponse?.data?.success) {
                const paymentTxns = (paymentsResponse.data.history || []).map((txn: any) => ({
                    id: txn.id || `payment_${Date.now()}_${Math.random()}`,
                    type: 'credit',
                    amount_cents: txn.amount_cents || 0,
                    balance_before_cents: txn.balance_before_cents,
                    balance_after_cents: txn.balance_after_cents,
                    currency: txn.currency || 'XAF',
                    category: 'payment',
                    reference_type: txn.payment_method,
                    reference_id: txn.payment_id?.toString(),
                    description: txn.description || t('financialTracking.accountRecharge'),
                    location: txn.location,
                    created_at: txn.created_at,
                    trace_id: `payment_${txn.id || Math.random()}`
                }));
                allTransactions.push(...paymentTxns);
            }
        } catch (err) {
            console.warn('[WalletFinancial] Payment history error:', err);
        }

        // Sort all transactions by date (newest first)
        allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Apply filter
        const filteredTransactions = selectedFilter === 'all'
            ? allTransactions
            : allTransactions.filter(txn => txn.type === selectedFilter);

        setTransactions(filteredTransactions);
    };

    const loadFinancialSummary = async () => {
        try {
            // Calculate summary from transactions
            const filteredTxns = selectedFilter === 'all' ? transactions : transactions.filter(t => t.type === selectedFilter);
            const credits = filteredTxns.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount_cents, 0);
            const debits = filteredTxns.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount_cents, 0);
            const refunds = filteredTxns.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount_cents, 0);

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - selectedPeriod);

            setSummary({
                total_credits_cents: credits,
                total_debits_cents: debits,
                total_refunds_cents: refunds,
                net_income_cents: credits - debits + refunds,
                transaction_count: filteredTxns.length,
                period_start: startDate.toISOString(),
                period_end: endDate.toISOString()
            });

            // Generate period summaries (daily)
            const dailyMap = new Map<string, PeriodSummary>();
            filteredTxns.forEach(txn => {
                const date = new Date(txn.created_at).toISOString().split('T')[0];
                const existing = dailyMap.get(date) || {
                    date,
                    credits_cents: 0,
                    debits_cents: 0,
                    net_cents: 0,
                    transaction_count: 0
                };

                if (txn.type === 'credit') existing.credits_cents += txn.amount_cents;
                else if (txn.type === 'debit') existing.debits_cents += txn.amount_cents;
                else if (txn.type === 'refund') existing.credits_cents += txn.amount_cents;

                existing.transaction_count++;
                existing.net_cents = existing.credits_cents - existing.debits_cents;
                dailyMap.set(date, existing);
            });

            setPeriodSummaries(Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
        } catch (err) {
            console.warn('[WalletFinancial] Summary error:', err);
        }
    };

    // Helper functions
    const mapTransactionCategory = (type: string): UnifiedTransaction['category'] => {
        if (type.includes('delivery')) return 'delivery';
        if (type.includes('payout')) return 'payout';
        if (type.includes('refund')) return 'refund';
        if (type.includes('payment')) return 'payment';
        return 'other';
    };

    const extractLocation = (txn: any): string | null => {
        return txn.delivery_location || txn.pickup_location || txn.location || null;
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadAllData();
    };

    const formatCurrency = (amountOrCents: number) => {
        // Backend stores amounts in XAF (whole units), not cents.
        const amount = Math.abs(amountOrCents);
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount) + ' ' + currSymbol;
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

    const getTransactionLabel = (txn: UnifiedTransaction) => {
        const { type, category, description } = txn;

        // Use description if available
        if (description) return description;

        // Fallback to category-based labels
        switch (category) {
            case 'payment': return t('financialTracking.accountRecharge');
            case 'consumption': return t('financialTracking.serviceUsage');
            case 'delivery': return type === 'credit'
                ? t('financialTracking.deliveryEarning')
                : t('financialTracking.deliveryCost');
            case 'service': return t('financialTracking.servicePayment');
            case 'refund': return t('financialTracking.refund');
            case 'payout': return t('financialTracking.payout');
            default:
                if (type === 'credit') return t('financialTracking.credit');
                if (type === 'debit') return t('financialTracking.debit');
                if (type === 'refund') return t('financialTracking.refund');
                return t('financialTracking.transaction');
        }
    };

    // ===== Partner Revenue Section =====
    const renderPartnerRevenue = () => {
        if (!isPartner || !partnerSummary?.summary) return null;
        const s = partnerSummary.summary;
        const bd = partnerSummary.breakdown || {};
        const fmtXAF = (cents: number) => {
            const xaf = Math.round(cents / 100);
            return new Intl.NumberFormat('fr-FR').format(xaf) + ' ' + currSymbol;
        };

        return (
            <View style={{ marginHorizontal: 16, marginTop: 16 }}>
                {/* Revenue card */}
                <NativeCard style={{ padding: 16, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: '#10B981' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#10B98115', alignItems: 'center', justifyContent: 'center' }}>
                            <SafeIcon name="trending-up" size={18} color="#10B981" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: modernColors.text }}>{t('financialTracking.partnerRevenue') || 'Revenus Prestataire'}</Text>
                            <Text style={{ fontSize: 11, color: modernColors.textSecondary }}>{selectedPeriod}{t('financialTracking.lastDays') || ' derniers jours'}</Text>
                        </View>
                    </View>

                    {/* KPI row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 11, color: modernColors.textSecondary }}>{t('financialTracking.grossRevenue') || 'Brut'}</Text>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#10B981' }}>{fmtXAF(s.total_gross_revenue_cents || 0)}</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: modernColors.borderLight }} />
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 11, color: modernColors.textSecondary }}>{t('financialTracking.yukpoCommission') || 'Commission'}</Text>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#EF4444' }}>-{fmtXAF(s.total_commissions_yukpo_cents || 0)}</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: modernColors.borderLight }} />
                        <View style={{ alignItems: 'center', flex: 1 }}>
                            <Text style={{ fontSize: 11, color: modernColors.textSecondary }}>{t('financialTracking.netRevenue') || 'Net'}</Text>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: modernColors.primary }}>{fmtXAF(s.net_revenue_cents || 0)}</Text>
                        </View>
                    </View>

                    {/* Orders count */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, backgroundColor: modernColors.surfaceVariant, borderRadius: 8, marginBottom: 12 }}>
                        <SafeIcon name="shopping-bag" size={14} color={modernColors.textSecondary} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: modernColors.textSecondary }}>
                            {s.total_orders || 0} {t('financialTracking.orders') || 'commandes'} · {t('financialTracking.payoutsReceived') || 'Reversements'}: {fmtXAF(s.total_payouts_received_cents || 0)}
                        </Text>
                    </View>

                    {/* Breakdown by source */}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: modernColors.text, marginBottom: 8 }}>{t('financialTracking.revenueBreakdown') || 'Détail par source'}</Text>
                    {(bd.delivery?.order_count > 0 || bd.reservations?.count > 0 || bd.bus_tickets?.count > 0) ? (
                        <View style={{ gap: 6 }}>
                            {bd.delivery?.order_count > 0 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: modernColors.borderLight }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontSize: 14 }}>📦</Text>
                                        <Text style={{ fontSize: 13, color: modernColors.text }}>{t('financialTracking.deliveryRevenue') || 'Livraisons'}</Text>
                                        <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#16A34A' }}>{bd.delivery.order_count}x</Text>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: modernColors.text }}>{fmtXAF(bd.delivery.gross_revenue_cents || 0)}</Text>
                                </View>
                            )}
                            {bd.reservations?.count > 0 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: modernColors.borderLight }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontSize: 14 }}>🎫</Text>
                                        <Text style={{ fontSize: 13, color: modernColors.text }}>{t('financialTracking.reservationRevenue') || 'Réservations'}</Text>
                                        <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#6366F1' }}>{bd.reservations.count}x</Text>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: modernColors.text }}>{fmtXAF(bd.reservations.revenue_cents || 0)}</Text>
                                </View>
                            )}
                            {bd.bus_tickets?.count > 0 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontSize: 14 }}>🚌</Text>
                                        <Text style={{ fontSize: 13, color: modernColors.text }}>{t('financialTracking.busTicketRevenue') || 'Tickets bus'}</Text>
                                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706' }}>{bd.bus_tickets.count}x</Text>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: modernColors.text }}>{fmtXAF(bd.bus_tickets.revenue_cents || 0)}</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <Text style={{ fontSize: 12, color: modernColors.textTertiary, textAlign: 'center', paddingVertical: 10 }}>
                            {t('financialTracking.noRevenueYet') || 'Aucun revenu sur cette période'}
                        </Text>
                    )}
                </NativeCard>
            </View>
        );
    };

    // ===== Mini bar chart for daily summaries =====
    const renderMiniChart = () => {
        if (periodSummaries.length === 0) {
            return (
                <View style={styles.chartEmpty}>
                    <Text style={styles.chartEmptyText}>{t('financialTracking.noDataForPeriod')}</Text>
                </View>
            );
        }
        const maxAmount = Math.max(...periodSummaries.map(d => Math.abs(d.net_cents)), 1);
        const barWidth = Math.max(4, (SCREEN_WIDTH - 80) / Math.max(periodSummaries.length, 1) - 2);

        return (
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>{t('financialTracking.dailySummaries')}</Text>
                <View style={styles.chartBars}>
                    {periodSummaries.map((day, index) => {
                        const height = Math.max(4, (Math.abs(day.net_cents) / maxAmount) * 100);
                        return (
                            <View key={index} style={styles.chartBarWrapper}>
                                <View
                                    style={[
                                        styles.chartBar,
                                        {
                                            height,
                                            width: barWidth,
                                            backgroundColor: day.net_cents > 0
                                                ? modernColors.success
                                                : modernColors.error,
                                        },
                                    ]}
                                />
                            </View>
                        );
                    })}
                </View>
                <View style={styles.chartLabels}>
                    <Text style={styles.chartLabel}>
                        {periodSummaries.length > 0
                            ? new Date(periodSummaries[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                            : ''}
                    </Text>
                    <Text style={styles.chartLabel}>
                        {periodSummaries.length > 0
                            ? new Date(periodSummaries[periodSummaries.length - 1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                            : ''}
                    </Text>
                </View>
            </View>
        );
    };

    // ===== KPI Cards =====
    const renderKPIs = () => {
        if (!summary) return null;

        return (
            <View style={styles.kpiGrid}>
                <NativeCard style={[styles.kpiCard, styles.kpiCardLarge]}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="wallet" size={18} color={modernColors.primary} />
                        <Text style={styles.kpiLabel}>{t('financialTracking.currentBalance')}</Text>
                    </View>
                    <Text style={styles.kpiValueLarge}>{formatCurrency(balanceCents)}</Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="arrow-down-left" size={16} color={modernColors.success} />
                        <Text style={styles.kpiLabel}>{t('financialTracking.credits')}</Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: modernColors.success }]}>
                        +{formatCurrency(summary.total_credits_cents)}
                    </Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="arrow-up-right" size={16} color={modernColors.error} />
                        <Text style={styles.kpiLabel}>{t('financialTracking.debits')}</Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: modernColors.error }]}>
                        -{formatCurrency(summary.total_debits_cents)}
                    </Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="rotate-ccw" size={16} color={modernColors.info} />
                        <Text style={styles.kpiLabel}>{t('financialTracking.refunds')}</Text>
                    </View>
                    <Text style={[styles.kpiValue, { color: modernColors.info }]}>
                        {formatCurrency(summary.total_refunds_cents)}
                    </Text>
                </NativeCard>

                <NativeCard style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                        <SafeIcon name="bar-chart-3" size={16} color={modernColors.primary} />
                        <Text style={styles.kpiLabel}>{t('financialTracking.netIncome')}</Text>
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
                        <Text style={styles.kpiLabel}>{t('financialTracking.transactions')}</Text>
                    </View>
                    <Text style={styles.kpiValue}>{summary.transaction_count}</Text>
                </NativeCard>
            </View>
        );
    };

    // ===== Transaction item =====
    const renderTransaction = ({ item }: { item: UnifiedTransaction }) => {
        const { icon, color } = getTransactionIcon(item.type);
        const isCredit = item.type === 'credit' || item.type === 'refund';

        return (
            <View style={styles.txnItem}>
                <View style={[styles.txnIconContainer, { backgroundColor: color + '15' }]}>
                    <SafeIcon name={icon} size={18} color={color} />
                </View>
                <View style={styles.txnContent}>
                    <Text style={styles.txnType}>{getTransactionLabel(item)}</Text>
                    <Text style={styles.txnDesc} numberOfLines={1}>
                        {item.description || item.reference_type || '—'}
                    </Text>
                    {item.location && (
                        <Text style={styles.txnLocation}>📍 {item.location}</Text>
                    )}
                    <Text style={styles.txnDate}>{formatDate(item.created_at)}</Text>
                    {item.trace_id && (
                        <Text style={styles.txnTrace}>ID: {item.trace_id}</Text>
                    )}
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
                    {t('financialTracking.overview')}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'transactions' && styles.tabBtnActive]}
                onPress={() => setActiveTab('transactions')}
            >
                <SafeIcon name="list" size={16} color={activeTab === 'transactions' ? '#fff' : modernColors.textSecondary} />
                <Text style={[styles.tabBtnText, activeTab === 'transactions' && styles.tabBtnTextActive]}>
                    {t('financialTracking.transactions')}
                </Text>
            </TouchableOpacity>
        </View>
    );

    // ===== Transaction filter =====
    const renderTransactionFilter = () => (
        <View style={styles.filterRow}>
            {(['all', 'credit', 'debit', 'refund'] as TransactionFilter[]).map((filter) => {
                const labels: Record<TransactionFilter, string> = {
                    all: t('financialTracking.all'),
                    credit: t('financialTracking.credits'),
                    debit: t('financialTracking.debits'),
                    refund: t('financialTracking.refunds'),
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
                    <Text style={styles.loadingText}>{t('financialTracking.loadingFinancialData')}</Text>
                </View>
            </SafeNativeView>
        );
    }

    if (error) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.errorContainer}>
                    <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
                    <Text style={styles.errorTitle}>{t('financialTracking.errorTitle')}</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() => loadAllData()}
                    >
                        <Text style={styles.retryBtnText}>{t('financialTracking.retry')}</Text>
                    </TouchableOpacity>
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
                        <Text style={styles.headerTitle}>{t('financialTracking.financialTracking')}</Text>
                        <Text style={styles.headerSubtitle}>{t('financialTracking.detailedFinancialOverview')}</Text>
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
                    <Text style={styles.balanceLabel}>{t('financialTracking.currentBalance')}</Text>
                    <Text style={styles.balanceValue}>{formatCurrency(balanceCents)}</Text>
                    <View style={styles.balanceActions}>
                        <TouchableOpacity
                            style={styles.balanceActionBtn}
                            onPress={() => (navigation as any).navigate('RechargeTokens')}
                        >
                            <SafeIcon name="plus-circle" size={18} color="#fff" />
                            <Text style={styles.balanceActionText}>{t('financialTracking.recharge')}</Text>
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
                        {renderPartnerRevenue()}
                        {renderKPIs()}
                        {renderMiniChart()}

                        {/* Recent transactions preview */}
                        <View style={styles.recentSection}>
                            <View style={styles.recentHeader}>
                                <Text style={styles.recentTitle}>{t('financialTracking.recentTransactions')}</Text>
                                <TouchableOpacity onPress={() => setActiveTab('transactions')}>
                                    <Text style={styles.recentSeeAll}>{t('financialTracking.seeAll')}</Text>
                                </TouchableOpacity>
                            </View>
                            {transactions.slice(0, 5).map((txn) => (
                                <View key={txn.id}>{renderTransaction({ item: txn })}</View>
                            ))}
                            {transactions.length === 0 && (
                                <View style={styles.emptyTxn}>
                                    <SafeIcon name="inbox" size={40} color={modernColors.textTertiary} />
                                    <Text style={styles.emptyTxnText}>
                                        {t('financialTracking.noTransactions')}
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
                                        {t('financialTracking.noTransactions')}
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

    // Error state
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: 100 },
    errorTitle: { fontSize: 18, fontWeight: '600', color: modernColors.text, marginTop: 16, textAlign: 'center' },
    errorText: { fontSize: 14, color: modernColors.textSecondary, marginTop: 8, textAlign: 'center' },
    retryBtn: {
        marginTop: 24,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

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
    txnLocation: { fontSize: 11, color: modernColors.primary, marginTop: 2, fontStyle: 'italic' },
    txnDate: { fontSize: 11, color: modernColors.textTertiary, marginTop: 2 },
    txnTrace: { fontSize: 10, color: modernColors.textTertiary, marginTop: 1, fontFamily: 'monospace' },
    txnAmountContainer: { alignItems: 'flex-end' },
    txnAmount: { fontSize: 14, fontWeight: '700' },
    txnBalance: { fontSize: 10, color: modernColors.textTertiary, marginTop: 2 },

    // Empty state
    emptyTxn: { paddingVertical: 40, alignItems: 'center' },
    emptyTxnText: { fontSize: 14, color: modernColors.textTertiary, marginTop: 8 },
});

export default WalletFinancialScreen;
