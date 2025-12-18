/**
 * 🧙 Composant de formulaire multi-étapes avec progress bar
 * Design moderne inspiré d'Instacart et Uber Eats
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton } from '../SafeNativeDesign';
import ProgressWizard from './ProgressWizard';

interface Step {
    id: string;
    label: string;
    icon?: string;
    component: React.ReactNode;
    validation?: () => boolean;
}

interface StepWizardFormProps {
    steps: Step[];
    onComplete: (data: any) => void;
    onCancel?: () => void;
    style?: any;
}

const StepWizardForm: React.FC<StepWizardFormProps> = ({
    steps,
    onComplete,
    onCancel,
    style,
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<Record<string, any>>({});

    const currentStepData = steps[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;

    const handleNext = () => {
        // Validation
        if (currentStepData.validation && !currentStepData.validation()) {
            return;
        }

        if (isLastStep) {
            onComplete(formData);
        } else {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevious = () => {
        if (!isFirstStep) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <View style={[styles.container, style]}>
            {/* Progress Wizard */}
            <ProgressWizard steps={steps} currentStep={currentStep} />

            {/* Step Content */}
            <View style={styles.content}>
                {currentStepData.component}
            </View>

            {/* Navigation */}
            <View style={styles.navigation}>
                {!isFirstStep && (
                    <NativeButton
                        title="Précédent"
                        variant="outline"
                        onPress={handlePrevious}
                        style={styles.navButton}
                    />
                )}
                <NativeButton
                    title={isLastStep ? 'Terminer' : 'Suivant'}
                    variant="primary"
                    onPress={handleNext}
                    style={[styles.navButton, styles.navButtonPrimary]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingVertical: 20,
    },
    navigation: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    navButton: {
        flex: 1,
    },
    navButtonPrimary: {
        flex: 1,
    },
});

export default StepWizardForm;

