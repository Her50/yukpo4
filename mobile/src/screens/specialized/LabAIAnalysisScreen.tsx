// ✅ Phase 3: Écran analyse IA des résultats d'examens de laboratoire
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { ExaminationResults, LabAnalysisResult, labService } from '../../services/labService';
import { modernColors } from '../../theme/modernTheme';

interface LabAIAnalysisScreenParams {
    examinationId: string;
    patientAge?: number;
    patientSex?: string;
}

const LabAIAnalysisScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as LabAIAnalysisScreenParams;

    const [examinationResults, setExaminationResults] = useState<ExaminationResults | null>(null);
    const [analysisResult, setAnalysisResult] = useState<LabAnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        if (params?.examinationId) {
            loadExaminationResults();
        }
    }, [params]);

    const loadExaminationResults = async () => {
        try {
            setLoading(true);
            const response = await labService.getExaminationResults(params.examinationId);

            if (response.success && response.data) {
                setExaminationResults(response.data.examination);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de charger les résultats');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[LabAIAnalysisScreen] Erreur chargement résultats:', error);
            Alert.alert('Erreur', 'Impossible de charger les résultats');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeWithAI = async () => {
        if (!examinationResults) return;

        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour analyser les résultats');
            navigation.navigate('Login' as never);
            return;
        }

        setAnalyzing(true);
        try {
            const response = await labService.analyzeExamination(
                params.examinationId,
                params.patientAge,
                params.patientSex
            );

            if (response.success && response.data) {
                setAnalysisResult(response.data.analysis);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'effectuer l\'analyse IA');
            }
        } catch (error: any) {
            console.error('[LabAIAnalysisScreen] Erreur analyse IA:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'effectuer l\'analyse IA');
        } finally {
            setAnalyzing(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Non spécifié';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity.toLowerCase()) {
            case 'critical':
            case 'critique':
                return modernColors.error;
            case 'high':
            case 'élevée':
                return '#DC2626';
            case 'moderate':
            case 'modérée':
                return modernColors.warning;
            case 'low':
            case 'faible':
                return modernColors.info;
            default:
                return modernColors.textSecondary;
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement des résultats...</Text>
            </View>
        );
    }

    if (!examinationResults) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Résultats non disponibles</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Analyse IA des résultats</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Informations de l'examen */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Informations de l'examen</Text>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Type d'examen:</Text>
                        <Text style={styles.infoValue}>
                            {examinationResults.examination_type_name || 'Non spécifié'}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Laboratoire:</Text>
                        <Text style={styles.infoValue}>
                            {examinationResults.laboratory_name || 'Non spécifié'}
                        </Text>
                    </View>

                    {examinationResults.completed_at && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Date de complétion:</Text>
                            <Text style={styles.infoValue}>
                                {formatDate(examinationResults.completed_at)}
                            </Text>
                        </View>
                    )}
                </NativeCard>

                {/* Résultats bruts */}
                {examinationResults.results && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>Résultats bruts</Text>
                        <View style={styles.resultsContainer}>
                            <Text style={styles.resultsText}>
                                {typeof examinationResults.results === 'string'
                                    ? examinationResults.results
                                    : JSON.stringify(examinationResults.results, null, 2)}
                            </Text>
                        </View>
                    </NativeCard>
                )}

                {/* Interprétation existante */}
                {examinationResults.interpretation && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>Interprétation</Text>
                        <Text style={styles.interpretationText}>
                            {examinationResults.interpretation}
                        </Text>
                    </NativeCard>
                )}

                {/* Bouton d'analyse IA */}
                {!analysisResult && (
                    <NativeCard style={styles.card}>
                        <View style={styles.aiPromptContainer}>
                            <SafeIcon name="sparkles" size={48} color={modernColors.primary} />
                            <Text style={styles.aiPromptTitle}>Analyse IA avancée</Text>
                            <Text style={styles.aiPromptText}>
                                Obtenez une analyse détaillée de vos résultats avec détection d'anomalies et recommandations personnalisées
                            </Text>
                            <NativeButton
                                title="🤖 Analyser avec IA"
                                onPress={handleAnalyzeWithAI}
                                disabled={analyzing}
                                variant="primary"
                                style={styles.analyzeButton}
                            />
                        </View>
                    </NativeCard>
                )}

                {/* Résultats de l'analyse IA */}
                {analysisResult && (
                    <>
                        <NativeCard style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon
                                    name={analysisResult.is_normal ? 'check-circle' : 'alert-circle'}
                                    size={32}
                                    color={analysisResult.is_normal ? modernColors.success : modernColors.warning}
                                />
                                <Text style={styles.cardTitle}>
                                    {analysisResult.is_normal ? 'Résultats normaux' : 'Anomalies détectées'}
                                </Text>
                            </View>

                            {analysisResult.interpretation && (
                                <View style={styles.interpretationContainer}>
                                    <Text style={styles.interpretationTitle}>Interprétation:</Text>
                                    <Text style={styles.interpretationText}>
                                        {analysisResult.interpretation}
                                    </Text>
                                </View>
                            )}

                            {analysisResult.confidence && (
                                <View style={styles.confidenceContainer}>
                                    <Text style={styles.confidenceLabel}>Confiance de l'analyse:</Text>
                                    <View style={styles.confidenceBar}>
                                        <View
                                            style={[
                                                styles.confidenceBarFill,
                                                {
                                                    width: `${analysisResult.confidence * 100}%`,
                                                    backgroundColor: analysisResult.confidence > 0.8
                                                        ? modernColors.success
                                                        : analysisResult.confidence > 0.6
                                                            ? modernColors.warning
                                                            : modernColors.error,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.confidenceValue}>
                                        {Math.round(analysisResult.confidence * 100)}%
                                    </Text>
                                </View>
                            )}
                        </NativeCard>

                        {/* Anomalies détectées */}
                        {analysisResult.anomalies_detected &&
                            analysisResult.anomalies_detected.length > 0 && (
                                <NativeCard style={styles.card}>
                                    <Text style={styles.cardTitle}>Anomalies détectées</Text>
                                    {analysisResult.anomalies_detected.map((anomaly, idx) => (
                                        <View key={idx} style={styles.anomalyContainer}>
                                            <View style={styles.anomalyHeader}>
                                                <SafeIcon
                                                    name="alert-triangle"
                                                    size={20}
                                                    color={getSeverityColor(anomaly.severity)}
                                                />
                                                <Text style={styles.anomalyParameter}>
                                                    {anomaly.parameter}
                                                </Text>
                                                <View
                                                    style={[
                                                        styles.severityBadge,
                                                        {
                                                            backgroundColor: `${getSeverityColor(anomaly.severity)}20`,
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.severityText,
                                                            { color: getSeverityColor(anomaly.severity) },
                                                        ]}
                                                    >
                                                        {anomaly.severity}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.anomalyDetails}>
                                                <Text style={styles.anomalyValue}>Valeur: {anomaly.value}</Text>
                                                <Text style={styles.anomalyRange}>
                                                    Normal: {anomaly.normal_range}
                                                </Text>
                                            </View>
                                            {anomaly.description && (
                                                <Text style={styles.anomalyDescription}>
                                                    {anomaly.description}
                                                </Text>
                                            )}
                                        </View>
                                    ))}
                                </NativeCard>
                            )}

                        {/* Recommandations */}
                        {analysisResult.recommendations &&
                            analysisResult.recommendations.length > 0 && (
                                <NativeCard style={styles.card}>
                                    <Text style={styles.cardTitle}>Recommandations</Text>
                                    {analysisResult.recommendations.map((rec, idx) => (
                                        <View key={idx} style={styles.recommendationItem}>
                                            <SafeIcon name="check" size={16} color={modernColors.success} />
                                            <Text style={styles.recommendationText}>{rec}</Text>
                                        </View>
                                    ))}
                                </NativeCard>
                            )}

                        {/* Examens complémentaires suggérés */}
                        {analysisResult.follow_up_exams &&
                            analysisResult.follow_up_exams.length > 0 && (
                                <NativeCard style={styles.card}>
                                    <Text style={styles.cardTitle}>Examens complémentaires suggérés</Text>
                                    {analysisResult.follow_up_exams.map((exam, idx) => (
                                        <View key={idx} style={styles.examItem}>
                                            <SafeIcon name="flask" size={16} color={modernColors.primary} />
                                            <Text style={styles.examText}>{exam}</Text>
                                        </View>
                                    ))}
                                </NativeCard>
                            )}
                    </>
                )}

                {analyzing && (
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
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    infoLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    resultsContainer: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 8,
    },
    resultsText: {
        fontSize: 13,
        color: modernColors.text,
        fontFamily: 'monospace',
    },
    interpretationContainer: {
        marginTop: 8,
    },
    interpretationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    interpretationText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 22,
    },
    aiPromptContainer: {
        alignItems: 'center',
        padding: 20,
    },
    aiPromptTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    aiPromptText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    analyzeButton: {
        marginTop: 8,
    },
    confidenceContainer: {
        marginTop: 16,
    },
    confidenceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    confidenceBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    confidenceBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    confidenceValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'right',
    },
    anomalyContainer: {
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.error,
    },
    anomalyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    anomalyParameter: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    severityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    severityText: {
        fontSize: 12,
        fontWeight: '600',
    },
    anomalyDetails: {
        marginBottom: 8,
    },
    anomalyValue: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
        marginBottom: 4,
    },
    anomalyRange: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    anomalyDescription: {
        fontSize: 13,
        color: modernColors.text,
        lineHeight: 18,
        marginTop: 8,
    },
    recommendationItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
        gap: 12,
    },
    recommendationText: {
        flex: 1,
        fontSize: 14,
        color: '#065F46',
        lineHeight: 20,
    },
    examItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: '#E0E7FF',
        borderRadius: 8,
        gap: 12,
    },
    examText: {
        flex: 1,
        fontSize: 14,
        color: '#1E40AF',
        lineHeight: 20,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
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
});

export default LabAIAnalysisScreen;

