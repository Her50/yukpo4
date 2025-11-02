import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';
import SelectModalitySelector from './SelectModalitySelector';

// ✅ Interface pour une option de contrat avec prime et franchise
export interface OptionPrime {
    id: string;
    option: string;           // Formule Basique, Standard, Premium...
    prime: string;            // Prime annuelle en FCFA
    franchise: string;        // Franchise en FCFA
    description?: string;     // Description courte de l'option
}

interface OptionsPrimesManagerProps {
    options: OptionPrime[];
    onChange: (options: OptionPrime[]) => void;
    readonly?: boolean;
}

const OptionsPrimesManager: React.FC<OptionsPrimesManagerProps> = ({
    options,
    onChange,
    readonly = false
}) => {
    const handleAddOption = () => {
        const newOption: OptionPrime = {
            id: `option-${Date.now()}`,
            option: '',
            prime: '',
            franchise: '',
            description: ''
        };
        onChange([...options, newOption]);
    };

    const handleUpdateOption = (optionId: string, field: keyof OptionPrime, value: string) => {
        const updatedOptions = options.map(opt =>
            opt.id === optionId ? { ...opt, [field]: value } : opt
        );
        onChange(updatedOptions);
    };

    const handleDeleteOption = (optionId: string) => {
        Alert.alert(
            'Supprimer l\'option',
            'Êtes-vous sûr de vouloir supprimer cette option de contrat ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => onChange(options.filter(opt => opt.id !== optionId))
                }
            ]
        );
    };

    const handleDuplicateOption = (optionId: string) => {
        const optionToDuplicate = options.find(opt => opt.id === optionId);
        if (optionToDuplicate) {
            const duplicated: OptionPrime = {
                ...optionToDuplicate,
                id: `option-${Date.now()}`,
                option: `${optionToDuplicate.option} (Copie)`
            };
            onChange([...options, duplicated]);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>💰 Options & Primes</Text>
                {!readonly && (
                    <TouchableOpacity style={styles.addButton} onPress={handleAddOption}>
                        <SafeIcon name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.addButtonText}>Ajouter</Text>
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.hint}>
                💡 Ajoutez les différentes formules disponibles avec leurs tarifs
            </Text>

            {/* Liste des options */}
            {options.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="file-text" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucune option ajoutée</Text>
                    <Text style={styles.emptyHint}>
                        Ajoutez les formules de votre contrat d'assurance
                    </Text>
                </View>
            ) : (
                <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                    {options.map((option, index) => (
                        <View key={option.id} style={styles.optionCard}>
                            {/* Header de l'option */}
                            <View style={styles.optionHeader}>
                                <View style={styles.optionNumber}>
                                    <Text style={styles.optionNumberText}>{index + 1}</Text>
                                </View>
                                <Text style={styles.optionTitle}>
                                    {option.option || `Option ${index + 1}`}
                                </Text>
                                {!readonly && (
                                    <View style={styles.optionActions}>
                                        <TouchableOpacity
                                            style={styles.actionButtonSmall}
                                            onPress={() => handleDuplicateOption(option.id)}
                                        >
                                            <SafeIcon name="copy" size={14} color={modernColors.success} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.actionButtonSmall}
                                            onPress={() => handleDeleteOption(option.id)}
                                        >
                                            <SafeIcon name="trash-2" size={14} color={modernColors.error} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Champs de l'option */}
                            <View style={styles.optionFields}>
                                {/* Ligne 1: Option/Formule */}
                                <SelectModalitySelector
                                    label="Formule"
                                    value={option.option}
                                    productType="assurance"
                                    fieldName="options_contrat"
                                    onSelect={(value) => handleUpdateOption(option.id, 'option', value)}
                                    required
                                    placeholder="Ex: Formule Premium"
                                />

                                {/* Ligne 2: Prime + Franchise */}
                                <View style={styles.fieldRow}>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Prime annuelle <Text style={styles.required}>*</Text></Text>
                                        <NativeInput
                                            placeholder="Ex: 150000"
                                            value={option.prime}
                                            onChangeText={(text) => handleUpdateOption(option.id, 'prime', text)}
                                            style={styles.fieldInput}
                                            keyboardType="numeric"
                                            editable={!readonly}
                                        />
                                    </View>
                                    <View style={[styles.fieldContainer, { flex: 1 }]}>
                                        <Text style={styles.fieldLabel}>Franchise</Text>
                                        <NativeInput
                                            placeholder="Ex: 50000"
                                            value={option.franchise}
                                            onChangeText={(text) => handleUpdateOption(option.id, 'franchise', text)}
                                            style={styles.fieldInput}
                                            keyboardType="numeric"
                                            editable={!readonly}
                                        />
                                    </View>
                                </View>

                                {/* Ligne 3: Description */}
                                <View style={styles.fieldContainer}>
                                    <Text style={styles.fieldLabel}>Description (opt.)</Text>
                                    <NativeInput
                                        placeholder="Ex: Couverture complète avec assistance"
                                        value={option.description || ''}
                                        onChangeText={(text) => handleUpdateOption(option.id, 'description', text)}
                                        style={styles.fieldInput}
                                        multiline
                                        editable={!readonly}
                                    />
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Résumé */}
            {options.length > 0 && (
                <View style={styles.summary}>
                    <SafeIcon name="info" size={16} color={modernColors.primary} />
                    <Text style={styles.summaryText}>
                        {options.length} option{options.length > 1 ? 's' : ''} •
                        Prime à partir de {Math.min(...options.filter(o => o.prime).map(o => parseFloat(o.prime) || Infinity)).toLocaleString()} FCFA
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    hint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
        fontStyle: 'italic',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: modernColors.border,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    emptyHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    optionsList: {
        maxHeight: 400,
    },
    optionCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    optionNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionNumberText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    optionTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    optionActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButtonSmall: {
        padding: 6,
        backgroundColor: modernColors.background,
        borderRadius: 6,
    },
    optionFields: {
        gap: 8,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 8,
    },
    fieldContainer: {
        marginBottom: 8,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    required: {
        color: modernColors.error,
    },
    fieldInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: modernColors.text,
    },
    summary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
    },
    summaryText: {
        fontSize: 13,
        fontWeight: '500',
        color: modernColors.primary,
        flex: 1,
    },
});

export default OptionsPrimesManager;











