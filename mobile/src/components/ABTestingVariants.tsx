import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard, NativeInput } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Variant {
    id: string;
    titre: string;
    description: string;
    thumbnail?: string;
    isActive: boolean;
    performance?: {
        views: number;
        clicks: number;
        ctr: number;
    };
}

interface ABTestingVariantsProps {
    variants: Variant[];
    onVariantsChange: (variants: Variant[]) => void;
    onAddVariant: () => void;
    onRemoveVariant: (id: string) => void;
}

export const ABTestingVariants: React.FC<ABTestingVariantsProps> = ({
    variants,
    onVariantsChange,
    onAddVariant,
    onRemoveVariant,
}) => {
    const [expanded, setExpanded] = useState(false);

    const updateVariant = (id: string, field: keyof Variant, value: any) => {
        const updated = variants.map(v =>
            v.id === id ? { ...v, [field]: value } : v
        );
        onVariantsChange(updated);
    };

    const toggleVariantActive = (id: string) => {
        const updated = variants.map(v =>
            v.id === id ? { ...v, isActive: !v.isActive } : v
        );
        onVariantsChange(updated);
    };

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="flask" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    A/B Testing ({variants.length} variante{variants.length > 1 ? 's' : ''})
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>🧪 A/B Testing</Text>
                    <Text style={styles.subtitle}>
                        Testez plusieurs variantes pour optimiser vos performances
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {variants.map((variant, index) => (
                <View key={variant.id} style={styles.variantCard}>
                    <View style={styles.variantHeader}>
                        <View style={styles.variantBadge}>
                            <Text style={styles.variantBadgeText}>Variante {index + 1}</Text>
                        </View>
                        <View style={styles.variantActions}>
                            <TouchableOpacity
                                style={[
                                    styles.toggleButton,
                                    variant.isActive && styles.toggleButtonActive,
                                ]}
                                onPress={() => toggleVariantActive(variant.id)}
                            >
                                <Text
                                    style={[
                                        styles.toggleText,
                                        variant.isActive && styles.toggleTextActive,
                                    ]}
                                >
                                    {variant.isActive ? 'Active' : 'Inactive'}
                                </Text>
                            </TouchableOpacity>
                            {variants.length > 1 && (
                                <TouchableOpacity
                                    style={styles.removeButton}
                                    onPress={() => {
                                        Alert.alert(
                                            'Supprimer la variante',
                                            'Êtes-vous sûr de vouloir supprimer cette variante ?',
                                            [
                                                { text: t('common.cancel'), style: 'cancel' },
                                                {
                                                    text: t('common.delete'),
                                                    style: 'destructive',
                                                    onPress: () => onRemoveVariant(variant.id),
                                                },
                                            ]
                                        );
                                    }}
                                >
                                    <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={styles.variantContent}>
                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Titre *</Text>
                            <NativeInput
                                placeholder="Titre de la variante"
                                value={variant.titre}
                                onChangeText={(text) => updateVariant(variant.id, 'titre', text)}
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.fieldContainer}>
                            <Text style={styles.fieldLabel}>Description</Text>
                            <NativeInput
                                placeholder="Description de la variante"
                                value={variant.description}
                                onChangeText={(text) => updateVariant(variant.id, 'description', text)}
                                style={styles.input}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {variant.performance && (
                            <View style={styles.performanceContainer}>
                                <Text style={styles.performanceTitle}>📊 Performances</Text>
                                <View style={styles.performanceRow}>
                                    <View style={styles.performanceMetric}>
                                        <Text style={styles.performanceValue}>
                                            {variant.performance.views.toLocaleString()}
                                        </Text>
                                        <Text style={styles.performanceLabel}>Vues</Text>
                                    </View>
                                    <View style={styles.performanceMetric}>
                                        <Text style={styles.performanceValue}>
                                            {variant.performance.clicks.toLocaleString()}
                                        </Text>
                                        <Text style={styles.performanceLabel}>Clics</Text>
                                    </View>
                                    <View style={styles.performanceMetric}>
                                        <Text style={styles.performanceValue}>
                                            {variant.performance.ctr.toFixed(2)}%
                                        </Text>
                                        <Text style={styles.performanceLabel}>CTR</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            ))}

            <TouchableOpacity
                style={styles.addButton}
                onPress={onAddVariant}
            >
                <SafeIcon name="plus" size={20} color={modernColors.primary} />
                <Text style={styles.addButtonText}>Ajouter une variante</Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
                <SafeIcon name="info" size={16} color={modernColors.info} />
                <Text style={styles.infoText}>
                    Les variantes actives seront testées automatiquement. La meilleure variante sera identifiée après 48h.
                </Text>
            </View>
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
    variantCard: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    variantHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    variantBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: modernColors.primary,
    },
    variantBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    variantActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    toggleButtonActive: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    toggleText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.text,
    },
    toggleTextActive: {
        color: '#fff',
    },
    removeButton: {
        padding: 6,
    },
    variantContent: {
        gap: 12,
    },
    fieldContainer: {
        marginBottom: 12,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    input: {
        width: '100%',
    },
    performanceContainer: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
    },
    performanceTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    performanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    performanceMetric: {
        alignItems: 'center',
    },
    performanceValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    performanceLabel: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: modernColors.primary,
        backgroundColor: modernColors.surfaceVariant,
        marginTop: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
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
        fontSize: 11,
        color: modernColors.textSecondary,
        lineHeight: 16,
    },
});

