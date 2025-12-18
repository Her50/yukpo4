// ✅ NOUVEAU: Panel pour ajuster les paramètres d'un effet

import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Effect } from '../services/effectLibraryService';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard, NativeInput } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';
// Note: Pour le slider, on utilisera un composant natif ou une alternative
// Slider peut être remplacé par un composant personnalisé si nécessaire

interface EffectParameterPanelProps {
    effect: Effect;
    initialParameters?: Record<string, any>;
    onParametersChanged?: (parameters: Record<string, any>) => void;
    onApply?: (parameters: Record<string, any>) => void;
    onCancel?: () => void;
}

interface ParameterControlProps {
    name: string;
    value: any;
    type: string;
    min?: number;
    max?: number;
    default: any;
    description?: string;
    onChange: (value: any) => void;
}

const ParameterControl: React.FC<ParameterControlProps> = ({
    name,
    value,
    type,
    min,
    max,
    default: defaultValue,
    description,
    onChange,
}) => {
    if (type === 'float' || type === 'int') {
        const numValue = typeof value === 'number' ? value : defaultValue;
        const numMin = min ?? 0;
        const numMax = max ?? 100;

        return (
            <View style={styles.parameterControl}>
                <View style={styles.parameterHeader}>
                    <Text style={styles.parameterName}>{name}</Text>
                    <Text style={styles.parameterValue}>{numValue.toFixed(2)}</Text>
                </View>
                {description && (
                    <Text style={styles.parameterDescription}>{description}</Text>
                )}
                {/* Slider personnalisé - TODO: Implémenter avec react-native-reanimated ou composant natif */}
                <View style={styles.sliderContainer}>
                    <TouchableOpacity
                        style={styles.sliderTrack}
                        onLayout={(e) => {
                            // TODO: Implémenter logique de slider interactif
                        }}
                    >
                        <View
                            style={[
                                styles.sliderFill,
                                { width: `${((numValue - numMin) / (numMax - numMin)) * 100}%` },
                            ]}
                        />
                        <View
                            style={[
                                styles.sliderThumb,
                                { left: `${((numValue - numMin) / (numMax - numMin)) * 100}%` },
                            ]}
                        />
                    </TouchableOpacity>
                </View>
                <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabel}>{numMin}</Text>
                    <Text style={styles.sliderLabel}>{numMax}</Text>
                </View>
            </View>
        );
    }

    if (type === 'bool') {
        const boolValue = typeof value === 'boolean' ? value : defaultValue;

        return (
            <View style={styles.parameterControl}>
                <View style={styles.parameterHeader}>
                    <Text style={styles.parameterName}>{name}</Text>
                    <TouchableOpacity
                        style={[styles.toggleButton, boolValue && styles.toggleButtonActive]}
                        onPress={() => onChange(!boolValue)}
                    >
                        <Text style={[styles.toggleButtonText, boolValue && styles.toggleButtonTextActive]}>
                            {boolValue ? 'Oui' : 'Non'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {description && (
                    <Text style={styles.parameterDescription}>{description}</Text>
                )}
            </View>
        );
    }

    if (type === 'string') {
        const stringValue = typeof value === 'string' ? value : String(defaultValue || '');

        return (
            <View style={styles.parameterControl}>
                <Text style={styles.parameterName}>{name}</Text>
                {description && (
                    <Text style={styles.parameterDescription}>{description}</Text>
                )}
                <NativeInput
                    value={stringValue}
                    onChangeText={onChange}
                    placeholder={`Entrer ${name.toLowerCase()}...`}
                    style={styles.stringInput}
                />
            </View>
        );
    }

    // Type inconnu ou non supporté
    return (
        <View style={styles.parameterControl}>
            <Text style={styles.parameterName}>{name}</Text>
            <Text style={styles.parameterDescription}>
                Type de paramètre non supporté: {type}
            </Text>
        </View>
    );
};

export const EffectParameterPanel: React.FC<EffectParameterPanelProps> = ({
    effect,
    initialParameters = {},
    onParametersChanged,
    onApply,
    onCancel,
}) => {
    const [parameters, setParameters] = useState<Record<string, any>>(() => {
        // Initialiser avec les valeurs par défaut de l'effet ou les valeurs initiales
        const defaults = effect.parameters || {};
        return { ...defaults, ...initialParameters };
    });

    const handleParameterChange = (paramName: string, value: any) => {
        const newParameters = { ...parameters, [paramName]: value };
        setParameters(newParameters);
        onParametersChanged?.(newParameters);
    };

    const handleReset = () => {
        const defaults = effect.parameters || {};
        setParameters(defaults);
        onParametersChanged?.(defaults);
    };

    const handleApply = () => {
        onApply?.(parameters);
    };

    // Parser les paramètres depuis JSON si nécessaire
    const parsedParameters = typeof effect.parameters === 'object'
        ? effect.parameters
        : (typeof effect.parameters === 'string' ? JSON.parse(effect.parameters) : {});

    // Extraire les contrôles de paramètres (pour l'instant, on utilise les valeurs brutes)
    const parameterEntries = Object.entries(parsedParameters);

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <SafeIcon name="settings" size={20} color={modernColors.primary} />
                    <View>
                        <Text style={styles.effectName}>{effect.name}</Text>
                        <Text style={styles.effectDescription} numberOfLines={1}>
                            {effect.description}
                        </Text>
                    </View>
                </View>
                {onCancel && (
                    <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                        <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {parameterEntries.length === 0 ? (
                <View style={styles.noParametersContainer}>
                    <SafeIcon name="info" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.noParametersText}>
                        Cet effet n'a pas de paramètres ajustables
                    </Text>
                </View>
            ) : (
                <ScrollView style={styles.parametersList} showsVerticalScrollIndicator={false}>
                    {parameterEntries.map(([paramName, paramValue]) => {
                        // Essayer de déterminer le type depuis la valeur
                        let paramType = 'string';
                        let paramMin: number | undefined;
                        let paramMax: number | undefined;

                        if (typeof paramValue === 'number') {
                            paramType = Number.isInteger(paramValue) ? 'int' : 'float';
                            // Valeurs par défaut pour min/max
                            paramMin = paramType === 'float' ? 0 : 0;
                            paramMax = paramType === 'float' ? 1 : 100;
                        } else if (typeof paramValue === 'boolean') {
                            paramType = 'bool';
                        }

                        return (
                            <ParameterControl
                                key={paramName}
                                name={paramName}
                                value={parameters[paramName] ?? paramValue}
                                type={paramType}
                                min={paramMin}
                                max={paramMax}
                                default={paramValue}
                                description={`Paramètre ${paramName}`}
                                onChange={(value) => handleParameterChange(paramName, value)}
                            />
                        );
                    })}
                </ScrollView>
            )}

            <View style={styles.footer}>
                <NativeButton
                    variant="secondary"
                    label="Réinitialiser"
                    onPress={handleReset}
                    style={styles.resetButton}
                />
                {onApply && (
                    <NativeButton
                        variant="primary"
                        label="Appliquer"
                        onPress={handleApply}
                        style={styles.applyButton}
                    />
                )}
            </View>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        maxHeight: 600,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    effectName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    effectDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    closeButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    parametersList: {
        maxHeight: 400,
        marginBottom: 16,
    },
    parameterControl: {
        marginBottom: 20,
    },
    parameterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    parameterName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        textTransform: 'capitalize',
    },
    parameterValue: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.primary,
    },
    parameterDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    sliderContainer: {
        width: '100%',
        height: 40,
        justifyContent: 'center',
    },
    sliderTrack: {
        width: '100%',
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        position: 'relative',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    sliderThumb: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: modernColors.primary,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        marginLeft: -10,
        top: -8,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    sliderLabel: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    toggleButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    toggleButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.text,
    },
    toggleButtonTextActive: {
        color: '#FFFFFF',
    },
    stringInput: {
        marginTop: 8,
    },
    noParametersContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    noParametersText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    resetButton: {
        flex: 1,
    },
    applyButton: {
        flex: 1,
    },
});

