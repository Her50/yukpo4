import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { walletApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const MIN_WITHDRAWAL = 1000;

type PaymentMethod = 'mtn_money' | 'orange_money';

interface WithdrawalRecord {
    id: string;
    amount: number;
    payment_method: string;
    phone_number: string;
    status: string;
    created_at: string;
}

function formatXAF(amount: number): string {
    return `${Math.round(amount).toLocaleString('fr-FR')} XAF`;
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

const paymentMethods: { key: PaymentMethod; label: string; icon: string; color: string }[] = [
    { key: 'mtn_money', label: 'MTN Money', icon: 'smartphone', color: '#FFCC00' },
    { key: 'orange_money', label: 'Orange Money', icon: 'smartphone', color: '#FF6600' },
];

const withdrawalStatusColors: Record<string, string> = {
    pending: modernColors.warning,
    processing: modernColors.info,
    completed: modernColors.success,
    failed: modernColors.error,
};

const CourierWithdrawalScreen: React.FC = () => {
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [amount, setAmount] = useState('');
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('mtn_money');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);

    const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);

    const loadData = useCallback(async () => {
        try {
            const [financialRes, histRes] = await Promise.all([
                walletApi.getFinancialSummary(),
                walletApi.getWithdrawalHistory(),
            ]);

            const finData = (financialRes.data || financialRes) as any;
            setBalance(finData?.balance ?? finData?.available ?? 0);

            const histData = (histRes.data || histRes) as any;
            setWithdrawals(Array.isArray(histData) ? histData : histData?.withdrawals || []);
        } catch (err) {
            console.error('[CourierWithdrawal] load error:', err);
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

    const parsedAmount = parseInt(amount, 10) || 0;

    const canSubmit =
        parsedAmount >= MIN_WITHDRAWAL &&
        parsedAmount <= balance &&
        phoneNumber.trim().length >= 9 &&
        !submitting;

    const handleSubmit = () => {
        if (!canSubmit) return;
        setConfirmVisible(true);
    };

    const confirmWithdraw = async () => {
        setConfirmVisible(false);
        setSubmitting(true);
        try {
            const res = await walletApi.withdraw({
                amount: parsedAmount,
                payment_method: selectedMethod,
                phone_number: phoneNumber.trim(),
            });

            if (res.success || (res as any).data) {
                Alert.alert(
                    t('wallet.withdrawSuccess') || 'Retrait initié',
                    t('wallet.withdrawSuccessMsg') || 'Votre retrait a été envoyé avec succès.',
                );
                setAmount('');
                setPhoneNumber('');
                loadData();
            } else {
                Alert.alert(
                    t('errors.error') || 'Erreur',
                    res.message || t('errors.unknown') || 'Une erreur est survenue',
                );
            }
        } catch (err) {
            Alert.alert(t('errors.error') || 'Erreur', t('errors.network') || 'Erreur réseau');
        } finally {
            setSubmitting(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const renderWithdrawal = ({ item }: { item: WithdrawalRecord }) => {
        const color = withdrawalStatusColors[item.status] || modernColors.textSecondary;
        return (
            <View style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.historyAmount}>{formatXAF(item.amount)}</Text>
                    <Text style={styles.historyMeta}>
                        {item.payment_method} • {item.phone_number}
                    </Text>
                    <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                </View>
                <View style={[styles.historyBadge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.historyBadgeText, { color }]}>{item.status}</Text>
                </View>
            </View>
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
            <FlatList
                data={withdrawals}
                keyExtractor={(item) => item.id}
                renderItem={renderWithdrawal}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[modernColors.primary]} />}
                contentContainerStyle={styles.scrollContent}
                ListHeaderComponent={
                    <>
                        <View style={styles.header}>
                            <SafeIcon name="wallet" size={22} color={modernColors.primary} type="lucide" />
                            <Text style={styles.title}>{t('wallet.withdrawal') || 'Retrait'}</Text>
                        </View>

                        <NativeCard style={styles.balanceCard}>
                            <Text style={styles.balanceLabel}>{t('wallet.availableBalance') || 'Solde disponible'}</Text>
                            <Text style={styles.balanceValue}>{formatXAF(balance)}</Text>
                        </NativeCard>

                        <NativeCard style={styles.formCard}>
                            <Text style={styles.formTitle}>{t('wallet.newWithdrawal') || 'Nouveau retrait'}</Text>

                            <Text style={styles.inputLabel}>{t('wallet.amount') || 'Montant (XAF)'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={`Min. ${formatXAF(MIN_WITHDRAWAL)}`}
                                placeholderTextColor={modernColors.textTertiary}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />
                            {parsedAmount > 0 && parsedAmount < MIN_WITHDRAWAL && (
                                <Text style={styles.errorHint}>
                                    {t('wallet.minWithdrawal') || `Minimum: ${formatXAF(MIN_WITHDRAWAL)}`}
                                </Text>
                            )}
                            {parsedAmount > balance && (
                                <Text style={styles.errorHint}>
                                    {t('wallet.insufficientFunds') || 'Solde insuffisant'}
                                </Text>
                            )}

                            <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                                {t('wallet.paymentMethod') || 'Méthode de paiement'}
                            </Text>
                            <View style={styles.methodRow}>
                                {paymentMethods.map((m) => (
                                    <TouchableOpacity
                                        key={m.key}
                                        style={[
                                            styles.methodBtn,
                                            selectedMethod === m.key && { borderColor: m.color, borderWidth: 2 },
                                        ]}
                                        onPress={() => setSelectedMethod(m.key)}
                                    >
                                        <SafeIcon name={m.icon} size={18} color={m.color} type="lucide" />
                                        <Text style={styles.methodLabel}>{m.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={[styles.inputLabel, { marginTop: 16 }]}>
                                {t('wallet.phoneNumber') || 'Numéro de téléphone'}
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="6XXXXXXXX"
                                placeholderTextColor={modernColors.textTertiary}
                                keyboardType="phone-pad"
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                            />

                            <NativeButton
                                title={submitting
                                    ? (t('message.loading') || 'Chargement...')
                                    : (t('wallet.submitWithdrawal') || 'Demander le retrait')}
                                onPress={handleSubmit}
                                disabled={!canSubmit}
                                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                            />
                        </NativeCard>

                        {withdrawals.length > 0 && (
                            <Text style={styles.sectionTitle}>
                                {t('wallet.withdrawalHistory') || 'Historique des retraits'}
                            </Text>
                        )}
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="inbox" size={36} color={modernColors.textTertiary} type="lucide" />
                        <Text style={styles.emptyText}>
                            {t('wallet.noWithdrawals') || 'Aucun retrait effectué'}
                        </Text>
                    </View>
                }
            />

            <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
                <View style={styles.modalOverlay}>
                    <NativeCard style={styles.modalCard}>
                        <SafeIcon name="alert-circle" size={40} color={modernColors.warning} type="lucide" />
                        <Text style={styles.modalTitle}>
                            {t('wallet.confirmWithdrawal') || 'Confirmer le retrait'}
                        </Text>
                        <Text style={styles.modalText}>
                            {t('wallet.confirmWithdrawalMsg') || 'Vous allez retirer'}{' '}
                            <Text style={{ fontWeight: '700' }}>{formatXAF(parsedAmount)}</Text>
                            {' '}{t('wallet.via') || 'via'}{' '}
                            {paymentMethods.find((m) => m.key === selectedMethod)?.label}
                            {' '}{t('wallet.toNumber') || 'au'} {phoneNumber}
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setConfirmVisible(false)}
                            >
                                <Text style={styles.modalCancelText}>{t('actions.cancel') || 'Annuler'}</Text>
                            </TouchableOpacity>
                            <NativeButton
                                title={t('actions.confirm') || 'Confirmer'}
                                onPress={confirmWithdraw}
                                style={styles.modalConfirmBtn}
                            />
                        </View>
                    </NativeCard>
                </View>
            </Modal>
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
    },
    scrollContent: {
        paddingBottom: 40,
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
    balanceCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: modernColors.primary + '10',
    },
    balanceLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    balanceValue: {
        fontSize: 28,
        fontWeight: '800',
        color: modernColors.primary,
    },
    formCard: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 20,
        borderRadius: 16,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 6,
    },
    input: {
        backgroundColor: modernColors.inputBackground,
        borderWidth: 1,
        borderColor: modernColors.inputBorder,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: modernColors.text,
    },
    errorHint: {
        fontSize: 12,
        color: modernColors.error,
        marginTop: 4,
    },
    methodRow: {
        flexDirection: 'row',
        gap: 12,
    },
    methodBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    methodLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    submitBtn: {
        marginTop: 20,
        borderRadius: 12,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.border,
    },
    historyAmount: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    historyMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    historyDate: {
        fontSize: 11,
        color: modernColors.textTertiary,
        marginTop: 2,
    },
    historyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    historyBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textTertiary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: modernColors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        padding: 28,
        borderRadius: 20,
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    modalText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
        width: '100%',
    },
    modalCancelBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    modalConfirmBtn: {
        flex: 1,
        borderRadius: 12,
    },
});

export default CourierWithdrawalScreen;
