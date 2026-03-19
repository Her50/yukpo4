import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export type PlacementType = 'feed' | 'stories' | 'carousel' | 'search' | 'reels' | 'sidebar';

interface Placement {
    type: PlacementType;
    label: string;
    icon: string;
    description: string;
    enabled: boolean;
    budget?: number;
}

interface PlacementSelectorProps {
    placements: Placement[];
    onPlacementsChange: (placements: Placement[]) => void;
    totalBudget: number;
}

export const PlacementSelector: React.FC<PlacementSelectorProps> = ({
    placements,
    onPlacementsChange,
    totalBudget,
}) => {
    const { t } = useLanguageSafe();
    const [expanded, setExpanded] = useState(false);
    const placementOptions: Omit<Placement, 'enabled' | 'budget'>[] = [
        {
            type: 'feed',
            label: 'Feed Principal',
            icon: 'grid',
            description: t('placementSelector.apparaitDansLeFilDactualite'),
        },
        {
            type: 'stories',
            label: 'Stories',
            icon: 'circle',
            description: t('placementSelector.formatVerticalPleinEcran'),
        },
        {
            type: 'carousel',
            label: 'Carousel',
            icon: 'layers',
            description: t('placementSelector.plusieursImagesvideosDefilantes'),
        },
        {
            type: 'search',
            label: t('placementSelector.resultatsDeRecherche'),
            icon: 'search',
            description: t('placementSelector.affichageDansLesResultats'),
        },
        {
            type: 'reels',
            label: 'Reels',
            icon: 'video',
            description: t('placementSelector.formatVideoCourtVertical'),
        },
        {
            type: 'sidebar',
            label: t('placementSelector.barreLaterale'),
            icon: 'sidebar',
            description: t('placementSelector.espacePublicitaireLateral'),
        },
    ];

    const togglePlacement = (type: PlacementType) => {
        const updated = placements.map(p =>
            p.type === type ? { ...p, enabled: !p.enabled } : p
        );
        onPlacementsChange(updated);
    };

    const updatePlacementBudget = (type: PlacementType, budget: number) => {
        const updated = placements.map(p =>
            p.type === type ? { ...p, budget } : p
        );
        onPlacementsChange(updated);
    };

    const enabledCount = placements.filter(p => p.enabled).length;
    const totalAllocated = placements
        .filter(p => p.enabled)
        .reduce((sum, p) => sum + (p.budget || 0), 0);

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="layout" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    Placements ({enabledCount} sélectionné{enabledCount > 1 ? 's' : ''})
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>📍 Placements</Text>
                    <Text style={styles.subtitle}>
                        Choisissez où afficher votre publicité
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.placementsList}>
                {placementOptions.map((option) => {
                    const placement = placements.find(p => p.type === option.type);
                    const isEnabled = placement?.enabled || false;

                    return (
                        <View key={option.type} style={styles.placementCard}>
                            <TouchableOpacity
                                style={styles.placementHeader}
                                onPress={() => togglePlacement(option.type)}
                            >
                                <View style={styles.placementInfo}>
                                    <View
                                        style={[
                                            styles.checkbox,
                                            isEnabled && styles.checkboxActive,
                                        ]}
                                    >
                                        {isEnabled && (
                                            <SafeIcon name="check" size={14} color="#fff" />
                                        )}
                                    </View>
                                    <View style={styles.placementDetails}>
                                        <View style={styles.placementTitleRow}>
                                            <SafeIcon
                                                name={option.icon as any}
                                                size={18}
                                                color={isEnabled ? modernColors.primary : modernColors.textSecondary}
                                            />
                                            <Text
                                                style={[
                                                    styles.placementTitle,
                                                    isEnabled && styles.placementTitleActive,
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </View>
                                        <Text style={styles.placementDescription}>
                                            {option.description}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {isEnabled && (
                                <View style={styles.budgetSection}>
                                    <Text style={styles.budgetLabel}>
                                        Budget pour ce placement (%)
                                    </Text>
                                    <View style={styles.budgetInputs}>
                                        {[25, 50, 75, 100].map((percent) => {
                                            const budget = Math.round((totalBudget * percent) / 100);
                                            const isSelected = placement?.budget === budget;
                                            return (
                                                <TouchableOpacity
                                                    key={percent}
                                                    style={[
                                                        styles.budgetButton,
                                                        isSelected && styles.budgetButtonActive,
                                                    ]}
                                                    onPress={() => updatePlacementBudget(option.type, budget)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.budgetButtonText,
                                                            isSelected && styles.budgetButtonTextActive,
                                                        ]}
                                                    >
                                                        {percent}%
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}
                        </View>
                    );
                })}
            </View>

            {enabledCount > 0 && (
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryTitle}>{t('placementSelector.resumeDesBudgets')}</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('placementSelector.totalAlloue')}</Text>
                        <Text style={styles.summaryValue}>
                            {totalAllocated.toLocaleString()} FCFA
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Budget total:</Text>
                        <Text style={styles.summaryValue}>
                            {totalBudget.toLocaleString()} FCFA
                        </Text>
                    </View>
                    {totalAllocated !== totalBudget && (
                        <Text style={styles.warningText}>
                            ⚠️ Le budget alloué ({totalAllocated.toLocaleString()} FCFA) ne correspond pas au budget total ({totalBudget.toLocaleString()} FCFA)
                        </Text>
                    )}
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
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    placementsList: {
        gap: 12,
    },
    placementCard: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    placementHeader: {
        marginBottom: 12,
    },
    placementInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    placementDetails: {
        flex: 1,
    },
    placementTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    placementTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.textSecondary,
    },
    placementTitleActive: {
        color: modernColors.text,
    },
    placementDescription: {
        fontSize: 12,
        color: modernColors.textTertiary,
        lineHeight: 16,
    },
    budgetSection: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    budgetLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    budgetInputs: {
        flexDirection: 'row',
        gap: 8,
    },
    budgetButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
    },
    budgetButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    budgetButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    budgetButtonTextActive: {
        color: '#fff',
    },
    summaryBox: {
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    summaryValue: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.text,
    },
    warningText: {
        fontSize: 11,
        color: modernColors.warning,
        marginTop: 8,
        fontStyle: 'italic',
    },
});

