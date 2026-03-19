import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface RetargetingRule {
    id: string;
    type: 'viewed_product' | 'abandoned_cart' | 'visited_service' | 'searched' | 'custom';
    label: string;
    description: string;
    enabled: boolean;
    daysSince?: number;
}

interface RetargetingOptionsProps {
    rules: RetargetingRule[];
    onRulesChange: (rules: RetargetingRule[]) => void;
}

const DEFAULT_RULES: Omit<RetargetingRule, 'id' | 'enabled'>[] = [
    {
        type: 'viewed_product',
        label: 'A vu un produit',
        description: 'Cibler les utilisateurs ayant vu un produit',
    },
    {
        type: 'abandoned_cart',
        label: 'Panier abandonne',
        description: 'Cibler les utilisateurs ayant ajoute puis abandonne',
    },
    {
        type: 'visited_service',
        label: 'A visite un service',
        description: 'Cibler les utilisateurs ayant visite un service',
    },
    {
        type: 'searched',
        label: 'A recherche',
        description: 'Cibler les utilisateurs ayant effectue une recherche',
    },
];

export const RetargetingOptions: React.FC<RetargetingOptionsProps> = ({
    rules,
    onRulesChange,
}) => {
        const { t } = useLanguageSafe();
const [expanded, setExpanded] = useState(false);

    const toggleRule = (id: string) => {
        const updated = rules.map(r =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
        );
        onRulesChange(updated);
    };

    const updateRuleDays = (id: string, days: number) => {
        const updated = rules.map(r =>
            r.id === id ? { ...r, daysSince: days } : r
        );
        onRulesChange(updated);
    };

    const enabledCount = rules.filter(r => r.enabled).length;

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="refresh-cw" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    Retargeting ({enabledCount} règle{enabledCount > 1 ? 's' : ''} active{enabledCount > 1 ? 's' : ''})
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>🔄 Retargeting</Text>
                    <Text style={styles.subtitle}>
                        Ciblez les utilisateurs qui ont déjà interagi avec votre contenu
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={styles.rulesList}>
                {rules.map((rule) => (
                    <View key={rule.id} style={styles.ruleCard}>
                        <TouchableOpacity
                            style={styles.ruleHeader}
                            onPress={() => toggleRule(rule.id)}
                        >
                            <View style={styles.ruleInfo}>
                                <View
                                    style={[
                                        styles.checkbox,
                                        rule.enabled && styles.checkboxActive,
                                    ]}
                                >
                                    {rule.enabled && (
                                        <SafeIcon name="check" size={14} color="#fff" />
                                    )}
                                </View>
                                <View style={styles.ruleText}>
                                    <Text
                                        style={[
                                            styles.ruleTitle,
                                            rule.enabled && styles.ruleTitleActive,
                                        ]}
                                    >
                                        {rule.label}
                                    </Text>
                                    <Text style={styles.ruleDescription}>
                                        {rule.description}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {rule.enabled && (
                            <View style={styles.daysSection}>
                                <Text style={styles.daysLabel}>
                                    Dans les X derniers jours
                                </Text>
                                <View style={styles.daysButtons}>
                                    {[1, 7, 14, 30, 60].map((days) => (
                                        <TouchableOpacity
                                            key={days}
                                            style={[
                                                styles.daysButton,
                                                rule.daysSince === days && styles.daysButtonActive,
                                            ]}
                                            onPress={() => updateRuleDays(rule.id, days)}
                                        >
                                            <Text
                                                style={[
                                                    styles.daysButtonText,
                                                    rule.daysSince === days && styles.daysButtonTextActive,
                                                ]}
                                            >
                                                {days}j
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {enabledCount > 0 && (
                <View style={styles.infoBox}>
                    <SafeIcon name="info" size={16} color={modernColors.info} />
                    <Text style={styles.infoText}>
                        Les utilisateurs correspondant à ces règles verront votre publicité en priorité.
                        Le retargeting augmente généralement le taux de conversion de 2-3x.
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
    rulesList: {
        gap: 12,
    },
    ruleCard: {
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    ruleHeader: {
        marginBottom: 12,
    },
    ruleInfo: {
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
    ruleText: {
        flex: 1,
    },
    ruleTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    ruleTitleActive: {
        color: modernColors.text,
    },
    ruleDescription: {
        fontSize: 12,
        color: modernColors.textTertiary,
        lineHeight: 16,
    },
    daysSection: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    daysLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    daysButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    daysButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
    },
    daysButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    daysButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    daysButtonTextActive: {
        color: '#fff',
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

