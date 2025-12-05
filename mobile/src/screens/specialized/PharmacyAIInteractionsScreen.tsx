// ✅ Phase 3: Écran analyse d'interactions médicamenteuses IA
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { MedicationInteraction, pharmacyService } from '../../services/pharmacyService';
import { modernColors } from '../../theme/modernTheme';

const PharmacyAIInteractionsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [medications, setMedications] = useState<string[]>([]);
    const [medicationInput, setMedicationInput] = useState('');
    const [age, setAge] = useState('');
    const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
    const [conditionInput, setConditionInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [interactionResult, setInteractionResult] = useState<MedicationInteraction | null>(null);

    const addMedication = () => {
        if (medicationInput.trim() && !medications.includes(medicationInput.trim())) {
            setMedications([...medications, medicationInput.trim()]);
            setMedicationInput('');
        }
    };

    const removeMedication = (medication: string) => {
        setMedications(medications.filter(m => m !== medication));
    };

    const addCondition = () => {
        if (conditionInput.trim() && !medicalConditions.includes(conditionInput.trim())) {
            setMedicalConditions([...medicalConditions, conditionInput.trim()]);
            setConditionInput('');
        }
    };

    const removeCondition = (condition: string) => {
        setMedicalConditions(medicalConditions.filter(c => c !== condition));
    };

    const handleCheckInteractions = async () => {
        if (medications.length === 0) {
            Alert.alert('Erreur', 'Veuillez ajouter au moins un médicament');
            return;
        }

        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour vérifier les interactions');
            navigation.navigate('Login' as never);
            return;
        }

        setLoading(true);
        try {
            const response = await pharmacyService.checkInteractions(
                medications,
                age ? parseInt(age, 10) : undefined,
                medicalConditions.length > 0 ? medicalConditions : undefined
            );

            if (response.success && response.data) {
                setInteractionResult(response.data.interaction);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de vérifier les interactions');
            }
        } catch (error: any) {
            console.error('[PharmacyAIInteractionsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de vérifier les interactions');
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'contraindicated':
                return modernColors.error;
            case 'major':
                return '#DC2626';
            case 'moderate':
                return modernColors.warning;
            case 'minor':
                return modernColors.info;
            case 'none':
                return modernColors.success;
            default:
                return modernColors.textSecondary;
        }
    };

    const getSeverityLabel = (severity: string) => {
        switch (severity) {
            case 'contraindicated':
                return 'Contre-indiqué';
            case 'major':
                return 'Majeure';
            case 'moderate':
                return 'Modérée';
            case 'minor':
                return 'Mineure';
            case 'none':
                return 'Aucune interaction';
            default:
                return severity;
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'contraindicated':
            case 'major':
                return 'alert-circle';
            case 'moderate':
                return 'alert-triangle';
            case 'minor':
                return 'info';
            case 'none':
                return 'check-circle';
            default:
                return 'help-circle';
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Vérification Interactions IA</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {!interactionResult ? (
                    <>
                        <NativeCard style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="shield-check" size={32} color={modernColors.primary} />
                                <Text style={styles.cardTitle}>Vérifier les interactions médicamenteuses</Text>
                                <Text style={styles.cardSubtitle}>
                                    Ajoutez les médicaments que vous prenez pour vérifier d'éventuelles interactions
                                </Text>
                            </View>

                            <View style={styles.formContainer}>
                                <Text style={styles.label}>Médicaments *</Text>
                                <View style={styles.inputRow}>
                                    <NativeInput
                                        placeholder="Nom du médicament ou DCI"
                                        value={medicationInput}
                                        onChangeText={setMedicationInput}
                                        style={styles.medicationInput}
                                    />
                                    <NativeButton
                                        title="Ajouter"
                                        onPress={addMedication}
                                        disabled={!medicationInput.trim()}
                                        variant="primary"
                                        size="small"
                                    />
                                </View>

                                {medications.length > 0 && (
                                    <View style={styles.medicationsList}>
                                        {medications.map((med, idx) => (
                                            <View key={idx} style={styles.medicationTag}>
                                                <Text style={styles.medicationTagText}>{med}</Text>
                                                <TouchableOpacity onPress={() => removeMedication(med)}>
                                                    <SafeIcon name="x" size={16} color={modernColors.error} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <Text style={styles.label}>Âge (optionnel)</Text>
                                <NativeInput
                                    placeholder="Ex: 45"
                                    value={age}
                                    onChangeText={setAge}
                                    keyboardType="numeric"
                                    style={styles.ageInput}
                                />

                                <Text style={styles.label}>Conditions médicales (optionnel)</Text>
                                <View style={styles.inputRow}>
                                    <NativeInput
                                        placeholder="Ex: Diabète, Hypertension..."
                                        value={conditionInput}
                                        onChangeText={setConditionInput}
                                        style={styles.conditionInput}
                                    />
                                    <NativeButton
                                        title="Ajouter"
                                        onPress={addCondition}
                                        disabled={!conditionInput.trim()}
                                        variant="outline"
                                        size="small"
                                    />
                                </View>

                                {medicalConditions.length > 0 && (
                                    <View style={styles.conditionsList}>
                                        {medicalConditions.map((condition, idx) => (
                                            <View key={idx} style={styles.conditionTag}>
                                                <Text style={styles.conditionTagText}>{condition}</Text>
                                                <TouchableOpacity onPress={() => removeCondition(condition)}>
                                                    <SafeIcon name="x" size={16} color={modernColors.error} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <NativeButton
                                    title="🔍 Vérifier les interactions"
                                    onPress={handleCheckInteractions}
                                    disabled={loading || medications.length === 0}
                                    variant="primary"
                                    style={styles.submitButton}
                                />
                            </View>
                        </NativeCard>
                    </>
                ) : (
                    <>
                        {/* Résultats de l'analyse */}
                        <NativeCard style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon
                                    name={getSeverityIcon(interactionResult.severity)}
                                    size={32}
                                    color={getSeverityColor(interactionResult.severity)}
                                />
                                <Text style={styles.cardTitle}>Résultat de l'analyse</Text>
                            </View>

                            <View style={[
                                styles.severityBadge,
                                { backgroundColor: `${getSeverityColor(interactionResult.severity)}20` }
                            ]}>
                                <Text style={[
                                    styles.severityText,
                                    { color: getSeverityColor(interactionResult.severity) }
                                ]}>
                                    Sévérité: {getSeverityLabel(interactionResult.severity)}
                                </Text>
                            </View>

                            {interactionResult.description && (
                                <View style={styles.descriptionContainer}>
                                    <Text style={styles.descriptionTitle}>Description:</Text>
                                    <Text style={styles.descriptionText}>
                                        {interactionResult.description}
                                    </Text>
                                </View>
                            )}

                            {interactionResult.recommendation && (
                                <View style={styles.recommendationContainer}>
                                    <Text style={styles.recommendationTitle}>Recommandation:</Text>
                                    <Text style={styles.recommendationText}>
                                        {interactionResult.recommendation}
                                    </Text>
                                </View>
                            )}

                            {interactionResult.alternative_suggestions &&
                                interactionResult.alternative_suggestions.length > 0 && (
                                    <View style={styles.alternativesContainer}>
                                        <Text style={styles.alternativesTitle}>Alternatives suggérées:</Text>
                                        {interactionResult.alternative_suggestions.map((alt, idx) => (
                                            <View key={idx} style={styles.alternativeItem}>
                                                <SafeIcon name="check" size={16} color={modernColors.success} />
                                                <Text style={styles.alternativeText}>{alt}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                        </NativeCard>

                        <NativeButton
                            title="🔄 Nouvelle vérification"
                            onPress={() => {
                                setInteractionResult(null);
                                setMedications([]);
                                setAge('');
                                setMedicalConditions([]);
                                setMedicationInput('');
                                setConditionInput('');
                            }}
                            variant="outline"
                            style={styles.resetButton}
                        />
                    </>
                )}

                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Analyse en cours...</Text>
                    </View>
                )}
            </ScrollView>
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
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    card: {
        marginBottom: 16,
        padding: 20,
    },
    cardHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 12,
        textAlign: 'center',
    },
    cardSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    formContainer: {
        marginTop: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
        marginTop: 16,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    medicationInput: {
        flex: 1,
    },
    medicationTag: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginBottom: 8,
    },
    medicationTagText: {
        fontSize: 14,
        color: '#1E40AF',
        fontWeight: '500',
    },
    medicationsList: {
        marginBottom: 16,
    },
    ageInput: {
        marginBottom: 12,
    },
    conditionInput: {
        flex: 1,
    },
    conditionTag: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginBottom: 8,
    },
    conditionTagText: {
        fontSize: 14,
        color: '#D97706',
        fontWeight: '500',
    },
    conditionsList: {
        marginBottom: 16,
    },
    submitButton: {
        marginTop: 8,
    },
    severityBadge: {
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
        alignItems: 'center',
    },
    severityText: {
        fontSize: 16,
        fontWeight: '600',
    },
    descriptionContainer: {
        marginBottom: 20,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    descriptionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    descriptionText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 22,
    },
    recommendationContainer: {
        marginBottom: 20,
        padding: 16,
        backgroundColor: '#E0F2FE',
        borderRadius: 8,
    },
    recommendationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    recommendationText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 22,
    },
    alternativesContainer: {
        marginBottom: 20,
    },
    alternativesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    alternativeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
        gap: 12,
    },
    alternativeText: {
        fontSize: 14,
        color: '#065F46',
        flex: 1,
    },
    resetButton: {
        marginTop: 8,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
});

export default PharmacyAIInteractionsScreen;

