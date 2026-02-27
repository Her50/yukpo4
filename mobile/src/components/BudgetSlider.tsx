import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface BudgetSliderProps {
    value: number;
    min: number;
    max: number;
    step: number;
    currency: string;
    onValueChange: (value: number) => void;
    estimatedReach?: number;
    estimatedImpressions?: number;
}

export const BudgetSlider: React.FC<BudgetSliderProps> = ({
    value,
    min,
    max,
    step,
    currency,
    onValueChange,
    estimatedReach,
    estimatedImpressions,
}) => {
    const formatNumber = useCallback((num: number) => {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        }
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    }, []);

    const percentage = ((value - min) / (max - min)) * 100;

    // Calculer les valeurs de presets
    const presetValues = [
        min,
        Math.round(min + (max - min) * 0.25),
        Math.round(min + (max - min) * 0.5),
        Math.round(min + (max - min) * 0.75),
        max,
    ];

    const handlePresetSelect = useCallback((presetValue: number) => {
        onValueChange(presetValue);
    }, [onValueChange]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>Budget</Text>
                <Text style={styles.value}>
                    {value.toLocaleString()} {currency}
                </Text>
            </View>

            {/* Slider personnalisé avec presets */}
            <View style={styles.sliderContainer}>
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${percentage}%` },
                        ]}
                    />
                </View>
                <View style={styles.presetsRow}>
                    {presetValues.map((presetValue, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.presetButton,
                                Math.abs(value - presetValue) < step && styles.presetButtonActive,
                            ]}
                            onPress={() => handlePresetSelect(presetValue)}
                        >
                            <Text
                                style={[
                                    styles.presetText,
                                    Math.abs(value - presetValue) < step && styles.presetTextActive,
                                ]}
                            >
                                {presetValue >= 1000
                                    ? `${(presetValue / 1000).toFixed(0)}K`
                                    : presetValue.toString()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.rangeLabels}>
                <Text style={styles.rangeLabel}>{min.toLocaleString()}</Text>
                <Text style={styles.rangeLabel}>{max.toLocaleString()}</Text>
            </View>

            {!!(estimatedReach || estimatedImpressions) && (
                <View style={styles.estimates}>
                    {!!estimatedReach && (
                        <View style={styles.estimateItem}>
                            <SafeIcon name="users" size={14} color={modernColors.primary} />
                            <Text style={styles.estimateLabel}>Portée estimée:</Text>
                            <Text style={styles.estimateValue}>
                                {formatNumber(estimatedReach)} personnes
                            </Text>
                        </View>
                    )}
                    {!!estimatedImpressions && (
                        <View style={styles.estimateItem}>
                            <SafeIcon name="eye" size={14} color={modernColors.primary} />
                            <Text style={styles.estimateLabel}>Impressions:</Text>
                            <Text style={styles.estimateValue}>
                                {formatNumber(estimatedImpressions)}
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    value: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    sliderContainer: {
        width: '100%',
        marginVertical: 12,
    },
    progressBar: {
        height: 8,
        backgroundColor: modernColors.border,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 16,
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 4,
    },
    presetsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    presetButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    presetButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    presetText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    presetTextActive: {
        color: '#fff',
    },
    rangeLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    rangeLabel: {
        fontSize: 11,
        color: modernColors.textTertiary,
    },
    estimates: {
        marginTop: 16,
        gap: 8,
        padding: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
    },
    estimateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    estimateLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        flex: 1,
    },
    estimateValue: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
    },
    progressBar: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        marginTop: 12,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
});

