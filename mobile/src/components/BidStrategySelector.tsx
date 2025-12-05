import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard, NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';

export type BidStrategyType = 'cpc' | 'cpm' | 'cpa' | 'auto';

interface BidStrategy {
    type: BidStrategyType;
    label: string;
    description: string;
    icon: string;
    bidAmount?: number;
}

interface BidStrategySelectorProps {
    strategy: BidStrategy;
    onStrategyChange: (strategy: BidStrategy) => void;
}

const STRATEGIES: Omit<BidStrategy, 'bidAmount'>[] = [
    {
        type: 'auto',
        label: 'Optimisation automatique',
        description: 'Le système optimise automatiquement pour le meilleur résultat',
        icon: 'zap',
    },
    {
        type: 'cpc',
        label: 'Coût par clic (CPC)',
        description: 'Vous payez uniquement quand quelqu\'un clique',
        icon: 'mouse-pointer',
    },
    {
        type: 'cpm',
        label: 'Coût par mille impressions (CPM)',
        description: 'Vous payez pour 1000 affichages',
        icon: 'eye',
    },
    {
        type: 'cpa',
        label: 'Coût par acquisition (CPA)',
        description: 'Vous payez uniquement pour les conversions',
        icon: 'target',
    },
];

export const BidStrategySelector: React.FC<BidStrategySelectorProps> = ({
    strategy,
    onStrategyChange,
}) => {
    const [expanded, setExpanded] = useState(false);

    const selectStrategy = (newStrategy: Omit<BidStrategy, 'bidAmount'>) => {
        onStrategyChange({
            ...newStrategy,
            bidAmount: strategy.type === newStrategy.type ? strategy.bidAmount : undefined,
        });
    };

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="trending-up" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    Stratégie d'enchères: {strategy.label}
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>💰 Stratégie d'enchères</Text>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.strategiesList}>
                {STRATEGIES.map((s) => {
                    const isSelected = strategy.type === s.type;
                    return (
                        <TouchableOpacity
                            key={s.type}
                            style={[
                                styles.strategyCard,
                                isSelected && styles.strategyCardActive,
                            ]}
                            onPress={() => selectStrategy(s)}
                        >
                            <View style={styles.strategyHeader}>
                                <View style={styles.strategyInfo}>
                                    <SafeIcon
                                        name={s.icon as any}
                                        size={20}
                                        color={isSelected ? modernColors.primary : modernColors.textSecondary}
                                    />
                                    <View style={styles.strategyText}>
                                        <Text
                                            style={[
                                                styles.strategyTitle,
                                                isSelected && styles.strategyTitleActive,
                                            ]}
                                        >
                                            {s.label}
                                        </Text>
                                        <Text style={styles.strategyDescription}>
                                            {s.description}
                                        </Text>
                                    </View>
                                </View>
                                <View
                                    style={[
                                        styles.radio,
                                        isSelected && styles.radioActive,
                                    ]}
                                >
                                    {isSelected && <View style={styles.radioInner} />}
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {strategy.type !== 'auto' && (
                <View style={styles.bidSection}>
                    <Text style={styles.bidLabel}>
                        Montant d'enchère maximum ({strategy.type.toUpperCase()})
                    </Text>
                    <NativeInput
                        placeholder="Ex: 100"
                        value={strategy.bidAmount?.toString() || ''}
                        onChangeText={(text) => {
                            const amount = parseFloat(text) || 0;
                            onStrategyChange({ ...strategy, bidAmount: amount });
                        }}
                        keyboardType="numeric"
                        style={styles.bidInput}
                    />
                    <Text style={styles.bidHint}>
                        Montant en FCFA. Le système utilisera ce montant comme plafond.
                    </Text>
                </View>
            )}

            {strategy.type === 'auto' && (
                <View style={styles.infoBox}>
                    <SafeIcon name="info" size={16} color={modernColors.info} />
                    <Text style={styles.infoText}>
                        L'optimisation automatique ajuste vos enchères en temps réel pour maximiser vos résultats selon votre objectif.
                    </Text>
                </View>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        marginBottom: 16,
    },
    expandText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    strategiesList: {
        gap: 12,
    },
    strategyCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    strategyCardActive: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.surfaceVariant,
    },
    strategyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    strategyInfo: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    strategyText: {
        flex: 1,
    },
    strategyTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    strategyTitleActive: {
        color: modernColors.text,
    },
    strategyDescription: {
        fontSize: 12,
        color: modernColors.textTertiary,
        lineHeight: 16,
    },
    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioActive: {
        borderColor: modernColors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: modernColors.primary,
    },
    bidSection: {
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
    },
    bidLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    bidInput: {
        width: '100%',
    },
    bidHint: {
        fontSize: 11,
        color: modernColors.textTertiary,
        marginTop: 8,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
});

