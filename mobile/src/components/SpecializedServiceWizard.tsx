// ✅ NOUVEAU: Wizard en 3 étapes pour création assistée de services spécialisés
// Étape 1: Type & Nom
// Étape 2: Configuration contextuelle
// Étape 3: Vérification & Publication

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface WizardStep {
    id: number;
    title: string;
    description: string;
    icon: string;
}

interface WizardData {
    type: string;
    nom: string;
    // Configuration contextuelle (sera étendue selon le type)
    [key: string]: any;
}

interface Props {
    onComplete: (data: WizardData) => void;
    onCancel: () => void;
    initialData?: Partial<WizardData>;
}

const SpecializedServiceWizard: React.FC<Props> = ({ onComplete, onCancel, initialData }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [wizardData, setWizardData] = useState<WizardData>({
        type: initialData?.type || '',
        nom: initialData?.nom || '',
        ...initialData,
    });

    const steps: WizardStep[] = [
        {
            id: 1,
            title: 'Type & Nom',
            description: 'Choisissez le type de service et son nom',
            icon: 'tag',
        },
        {
            id: 2,
            title: 'Configuration',
            description: 'Configurez les détails du service',
            icon: 'settings',
        },
        {
            id: 3,
            title: 'Vérification',
            description: 'Vérifiez et publiez votre service',
            icon: 'check-circle',
        },
    ];

    const serviceTypes = [
        { id: 'pharmacie', name: 'Pharmacie', icon: 'Pill', color: '#10B981' },
        { id: 'hopital', name: 'Hôpital/Clinique', icon: 'Hospital', color: '#EF4444' },
        { id: 'laboratoire', name: 'Laboratoire', icon: 'Microscope', color: '#3B82F6' },
        { id: 'banque_sang', name: 'Banque de Sang', icon: 'Droplet', color: '#DC2626' },
        { id: 'agence_voyage', name: 'Agence de Voyage', icon: 'Bus', color: '#F59E0B' },
        { id: 'covoiturage', name: 'Covoiturage', icon: 'Users', color: '#8B5CF6' },
        { id: 'taxi', name: 'Taxi', icon: 'Car', color: '#F97316' },
    ];

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            await onComplete(wizardData);
        } finally {
            setLoading(false);
        }
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return wizardData.type && wizardData.nom.trim().length > 0;
            case 2:
                return true; // Validation contextuelle selon le type
            case 3:
                return true;
            default:
                return false;
        }
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Choisissez le type de service</Text>
            <Text style={styles.stepDescription}>
                Sélectionnez le type de service spécialisé que vous souhaitez créer
            </Text>

            <View style={styles.typesGrid}>
                {serviceTypes.map((type) => (
                    <TouchableOpacity
                        key={type.id}
                        style={[
                            styles.typeCard,
                            wizardData.type === type.id && styles.typeCardSelected,
                            { borderColor: type.color },
                        ]}
                        onPress={() => setWizardData({ ...wizardData, type: type.id })}
                    >
                        <View
                            style={[
                                styles.typeIconContainer,
                                { backgroundColor: type.color + '15' },
                            ]}
                        >
                            <SafeIcon name={type.icon} size={24} color={type.color} type="lucide" />
                        </View>
                        <Text style={styles.typeName}>{type.name}</Text>
                        {wizardData.type === type.id && (
                            <View style={[styles.checkBadge, { backgroundColor: type.color }]}>
                                <SafeIcon name="check" size={16} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {wizardData.type && (
                <View style={styles.nomInputContainer}>
                    <Text style={styles.inputLabel}>Nom du service *</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder={`Ex: ${serviceTypes.find((t) => t.id === wizardData.type)?.name}...`}
                            placeholderTextColor={modernColors.textSecondary}
                            value={wizardData.nom}
                            onChangeText={(text) => setWizardData({ ...wizardData, nom: text })}
                        />
                    </View>
                </View>
            )}
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Configuration</Text>
            <Text style={styles.stepDescription}>
                Configurez les détails spécifiques à votre type de service
            </Text>

            <NativeCard style={styles.configCard}>
                <Text style={styles.configPlaceholder}>
                    Configuration contextuelle pour {wizardData.type}
                </Text>
                <Text style={styles.configNote}>
                    Les champs de configuration seront adaptés selon le type de service sélectionné
                </Text>
            </NativeCard>
        </View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Vérification</Text>
            <Text style={styles.stepDescription}>
                Vérifiez les informations avant de publier votre service
            </Text>

            <NativeCard style={styles.reviewCard}>
                <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>Type de service</Text>
                    <View style={styles.reviewValueContainer}>
                        <SafeIcon
                            name={serviceTypes.find((t) => t.id === wizardData.type)?.icon || 'circle'}
                            size={20}
                            color={serviceTypes.find((t) => t.id === wizardData.type)?.color || modernColors.primary}
                            type="lucide"
                        />
                        <Text style={styles.reviewValue}>
                            {serviceTypes.find((t) => t.id === wizardData.type)?.name}
                        </Text>
                    </View>
                </View>

                <View style={styles.reviewSection}>
                    <Text style={styles.reviewLabel}>Nom</Text>
                    <Text style={styles.reviewValue}>{wizardData.nom}</Text>
                </View>

                <View style={styles.checklistContainer}>
                    <Text style={styles.checklistTitle}>Checklist de complétude</Text>
                    <View style={styles.checklistItem}>
                        <SafeIcon name="check" size={16} color={modernColors.success} />
                        <Text style={styles.checklistText}>Type et nom renseignés</Text>
                    </View>
                    <View style={styles.checklistItem}>
                        <SafeIcon name="check" size={16} color={modernColors.success} />
                        <Text style={styles.checklistText}>Configuration de base complétée</Text>
                    </View>
                </View>
            </NativeCard>
        </View>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 1:
                return renderStep1();
            case 2:
                return renderStep2();
            case 3:
                return renderStep3();
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Header avec barre de progression */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                    <SafeIcon name="x" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Créer un service</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Barre de progression */}
            <View style={styles.progressContainer}>
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <View style={styles.progressStep}>
                            <View
                                style={[
                                    styles.progressCircle,
                                    currentStep >= step.id && styles.progressCircleActive,
                                ]}
                            >
                                {currentStep > step.id ? (
                                    <SafeIcon name="check" size={16} color="#fff" />
                                ) : (
                                    <Text style={styles.progressNumber}>{step.id}</Text>
                                )}
                            </View>
                            <Text
                                style={[
                                    styles.progressLabel,
                                    currentStep >= step.id && styles.progressLabelActive,
                                ]}
                                numberOfLines={1}
                            >
                                {step.title}
                            </Text>
                        </View>
                        {index < steps.length - 1 && (
                            <View
                                style={[
                                    styles.progressLine,
                                    currentStep > step.id && styles.progressLineActive,
                                ]}
                            />
                        )}
                    </React.Fragment>
                ))}
            </View>

            {/* Contenu de l'étape */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {renderCurrentStep()}
            </ScrollView>

            {/* Footer avec boutons */}
            <View style={styles.footer}>
                {currentStep > 1 && (
                    <NativeButton
                        title="Précédent"
                        variant="outline"
                        onPress={handleBack}
                        style={styles.footerButton}
                    />
                )}
                <View style={styles.footerSpacer} />
                <NativeButton
                    title={currentStep === 3 ? 'Publier' : 'Suivant'}
                    variant="primary"
                    onPress={handleNext}
                    disabled={!canProceed() || loading}
                    style={styles.footerButton}
                />
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Publication en cours...</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingTop: 40,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    cancelButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    placeholder: {
        width: 32,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    progressStep: {
        alignItems: 'center',
        flex: 1,
    },
    progressCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    progressCircleActive: {
        backgroundColor: modernColors.primary,
    },
    progressNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
    },
    progressLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 4,
        marginBottom: 18,
    },
    progressLineActive: {
        backgroundColor: modernColors.primary,
    },
    progressLabel: {
        fontSize: 10,
        color: '#6B7280',
        textAlign: 'center',
    },
    progressLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    stepContainer: {
        padding: 20,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    stepDescription: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginBottom: 24,
    },
    typesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    typeCard: {
        width: (width - 64) / 2,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        position: 'relative',
    },
    typeCardSelected: {
        borderWidth: 2,
    },
    typeIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    typeName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        textAlign: 'center',
    },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nomInputContainer: {
        marginTop: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    inputContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    input: {
        fontSize: 16,
        color: '#111827',
    },
    configCard: {
        padding: 20,
    },
    configPlaceholder: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    configNote: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    reviewCard: {
        padding: 20,
    },
    reviewSection: {
        marginBottom: 20,
    },
    reviewLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    reviewValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    reviewValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checklistContainer: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    checklistTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    checklistText: {
        fontSize: 14,
        color: '#111827',
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    footerButton: {
        flex: 1,
    },
    footerSpacer: {
        width: 12,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#fff',
    },
});

export default SpecializedServiceWizard;

