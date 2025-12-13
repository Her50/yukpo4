import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface Step {
    id: string;
    label: string;
    icon: string;
}

interface AdCreationStepperProps {
    currentStep: number;
    steps: Step[];
    onStepPress?: (stepIndex: number) => void;
}

export const AdCreationStepper: React.FC<AdCreationStepperProps> = ({ currentStep, steps, onStepPress }) => {
    return (
        <View style={styles.container}>
            {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                const isUpcoming = index > currentStep;

                return (
                    <React.Fragment key={step.id}>
                        <TouchableOpacity
                            style={styles.stepContainer}
                            onPress={() => onStepPress?.(index)}
                            activeOpacity={0.7}
                            disabled={!onStepPress}
                        >
                            <View
                                style={[
                                    styles.stepCircle,
                                    isActive && styles.stepCircleActive,
                                    isCompleted && styles.stepCircleCompleted,
                                    isUpcoming && styles.stepCircleUpcoming,
                                ]}
                            >
                                {isCompleted ? (
                                    <SafeIcon name="check" size={16} color="#fff" />
                                ) : (
                                    <SafeIcon
                                        name={step.icon}
                                        size={16}
                                        color={
                                            isActive
                                                ? '#fff'
                                                : isCompleted
                                                    ? '#fff'
                                                    : modernColors.textSecondary
                                        }
                                    />
                                )}
                            </View>
                            <Text
                                style={[
                                    styles.stepLabel,
                                    isActive && styles.stepLabelActive,
                                    isCompleted && styles.stepLabelCompleted,
                                    isUpcoming && styles.stepLabelUpcoming,
                                ]}
                                numberOfLines={1}
                            >
                                {step.label}
                            </Text>
                        </TouchableOpacity>
                        {index < steps.length - 1 && (
                            <View
                                style={[
                                    styles.connector,
                                    isCompleted && styles.connectorCompleted,
                                ]}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    stepContainer: {
        alignItems: 'center',
        flex: 1,
    },
    stepCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    stepCircleActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
        transform: [{ scale: 1.1 }],
    },
    stepCircleCompleted: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    stepCircleUpcoming: {
        backgroundColor: modernColors.surfaceVariant,
        borderColor: modernColors.border,
    },
    stepLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
        maxWidth: 80,
    },
    stepLabelActive: {
        color: modernColors.primary,
        fontWeight: '700',
    },
    stepLabelCompleted: {
        color: modernColors.success,
    },
    stepLabelUpcoming: {
        color: modernColors.textTertiary,
    },
    connector: {
        flex: 1,
        height: 2,
        backgroundColor: modernColors.border,
        marginHorizontal: 4,
        marginBottom: 28,
    },
    connectorCompleted: {
        backgroundColor: modernColors.success,
    },
});

