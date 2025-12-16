/**
 * 🧙 Progress Wizard pour formulaires multi-étapes
 * Design moderne avec animations fluides
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { SafeIcon } from '../SafeIcon';

interface Step {
    id: string;
    label: string;
    icon?: string;
}

interface ProgressWizardProps {
    steps: Step[];
    currentStep: number;
    style?: any;
}

const ProgressWizard: React.FC<ProgressWizardProps> = ({ steps, currentStep, style }) => {
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        try {
            const progress = currentStep / (steps.length - 1);
            // ✅ CORRIGÉ: Utiliser Easing importé directement depuis react-native
            // Vérifier que Easing.bezier existe avant de l'utiliser
            const easingFunction = Easing && typeof Easing.bezier === 'function'
                ? Easing.bezier(0.42, 0, 0.58, 1)
                : undefined;

            Animated.timing(progressAnim, {
                toValue: progress,
                duration: 400,
                easing: easingFunction, // ✅ CORRIGÉ: Utiliser Easing.bezier sécurisé
                useNativeDriver: false,
            }).start();
        } catch (error) {
            console.warn('[ProgressWizard] Erreur animation:', error);
            // En cas d'erreur, définir directement la valeur finale
            const progress = currentStep / (steps.length - 1);
            progressAnim.setValue(progress);
        }
    }, [currentStep, steps.length, progressAnim]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[styles.container, style]}>
            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground} />
                <Animated.View
                    style={[
                        styles.progressBarFill,
                        {
                            width: progressWidth,
                        },
                    ]}
                />
            </View>

            {/* Steps */}
            <View style={styles.stepsContainer}>
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const isPending = index > currentStep;

                    return (
                        <View key={step.id} style={styles.step}>
                            <View
                                style={[
                                    styles.stepCircle,
                                    isCompleted && styles.stepCircleCompleted,
                                    isCurrent && styles.stepCircleCurrent,
                                    isPending && styles.stepCirclePending,
                                ]}
                            >
                                {isCompleted ? (
                                    <SafeIcon name="check" size={16} color="#FFFFFF" />
                                ) : step.icon ? (
                                    <SafeIcon
                                        name={step.icon}
                                        size={16}
                                        color={isCurrent ? modernColors.primary : modernColors.textSecondary}
                                    />
                                ) : (
                                    <Text
                                        style={[
                                            styles.stepNumber,
                                            isCurrent && styles.stepNumberCurrent,
                                        ]}
                                    >
                                        {index + 1}
                                    </Text>
                                )}
                            </View>
                            <Text
                                style={[
                                    styles.stepLabel,
                                    isCurrent && styles.stepLabelCurrent,
                                    isPending && styles.stepLabelPending,
                                ]}
                                numberOfLines={1}
                            >
                                {step.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
        paddingHorizontal: 4,
    },
    progressBarContainer: {
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
    },
    progressBarBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: modernColors.border,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 2,
    },
    stepsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    step: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    stepCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 2,
        borderColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepCircleCompleted: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    stepCircleCurrent: {
        backgroundColor: modernColors.primary + '20',
        borderColor: modernColors.primary,
        borderWidth: 3,
    },
    stepCirclePending: {
        backgroundColor: modernColors.surfaceVariant,
        borderColor: modernColors.border,
    },
    stepNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    stepNumberCurrent: {
        color: modernColors.primary,
    },
    stepLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    stepLabelCurrent: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    stepLabelPending: {
        color: modernColors.textSecondary,
    },
});

export default ProgressWizard;


