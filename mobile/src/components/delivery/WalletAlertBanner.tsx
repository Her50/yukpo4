import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useShoppingBasket } from '../../hooks/useShoppingBasket';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton, NativeCard } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';

interface WalletAlertBannerProps {
    onRecharge?: () => void;
}

const WalletAlertBanner: React.FC<WalletAlertBannerProps> = ({ onRecharge }) => {
    const { walletBalance, budget, estimate, currency, refreshWalletBalance } = useShoppingBasket();

    const { missing, canProceed, total } = useMemo(() => {
        const totalNeeded = estimate?.total ?? budget ?? 0;
        const balance = walletBalance?.balance ?? 0;
        const missingAmount = Math.max(0, totalNeeded - balance);
        return {
            total: totalNeeded,
            missing: missingAmount,
            canProceed: missingAmount === 0,
        };
    }, [estimate?.total, budget, walletBalance?.balance]);

    if (!walletBalance) {
        return (
            <NativeCard style={styles.card}>
                <View style={styles.row}>
                    <SafeIcon name="wallet" size={20} color={modernColors.primary} />
                    <View style={styles.content}>
                        <Text style={styles.title}>Solde indisponible</Text>
                        <Text style={styles.subtitle}>Actualise ton portefeuille pour vérifier ton budget.</Text>
                    </View>
                    <NativeButton title="Actualiser" variant="outline" onPress={refreshWalletBalance} />
                </View>
            </NativeCard>
        );
    }

    return (
        <NativeCard style={[styles.card, !canProceed && styles.warningCard]}>
            <View style={styles.row}>
                <SafeIcon
                    name="wallet"
                    size={20}
                    color={canProceed ? modernColors.success : modernColors.warning}
                />
                <View style={styles.content}>
                    <Text style={styles.title}>Solde Yukpo Wallet</Text>
                    <Text style={styles.balance}>
                        {walletBalance.balance.toFixed(0)} {walletBalance.currency ?? currency ?? 'XAF'}
                    </Text>
                    {total > 0 ? (
                        <Text style={styles.subtitle}>
                            Total estimé: {total.toFixed(0)} {currency ?? 'XAF'}
                        </Text>
                    ) : null}
                    {!canProceed ? (
                        <Text style={styles.warningText}>
                            Il manque {missing.toFixed(0)} {currency ?? 'XAF'} pour finaliser la commande.
                        </Text>
                    ) : (
                        <Text style={styles.successText}>Budget suffisant pour lancer la commande.</Text>
                    )}
                </View>
                {!canProceed && (
                    <NativeButton
                        title="Recharger"
                        variant="secondary"
                        onPress={onRecharge ?? (() => { })}
                    />
                )}
            </View>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    card: {
        gap: 12,
    },
    warningCard: {
        borderWidth: 1,
        borderColor: modernColors.warning,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    content: {
        flex: 1,
        gap: 4,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    balance: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    warningText: {
        fontSize: 12,
        color: modernColors.warning,
        fontWeight: '600',
    },
    successText: {
        fontSize: 12,
        color: modernColors.success,
        fontWeight: '600',
    },
});

export default WalletAlertBanner;
