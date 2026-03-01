// ✅ Écran Analyse CV IA pour Offres d'Emploi (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeBadge, NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { offreEmploiService } from '../../services/offreEmploiService';
import { modernColors, modernStyles } from '../../theme/modernTheme';

const AnalyseCVScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [cvText, setCvText] = useState('');
    const [cvUrl, setCvUrl] = useState('');
    const [analysis, setAnalysis] = useState<any>(null);

    const handleAnalyze = async () => {
        if (!cvText.trim() && !cvUrl.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir le texte du CV ou une URL');
            return;
        }

        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté');
            return;
        }

        try {
            setLoading(true);
            const response = await offreEmploiService.analyzeCV(cvUrl || cvText);

            if (response.success) {
                setAnalysis(response.analysis || response.data?.analysis);
            } else {
                Alert.alert('Erreur', response.message || 'Impossible d\'analyser le CV');
            }
        } catch (error: any) {
            console.error('[AnalyseCV] Erreur:', error);
            Alert.alert('Erreur', 'Impossible d\'analyser le CV. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Analyse CV IA</Text>
                <Text style={styles.subtitle}>
                    Analysez votre CV avec l'IA pour obtenir des suggestions d'amélioration
                </Text>
            </View>

            {!analysis ? (
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Contenu du CV</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Texte du CV</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Collez ici le contenu de votre CV..."
                            value={cvText}
                            onChangeText={setCvText}
                            multiline
                            numberOfLines={10}
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>URL du CV (optionnel)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://..."
                            value={cvUrl}
                            onChangeText={setCvUrl}
                            keyboardType="url"
                            autoCapitalize="none"
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    <NativeButton
                        title={loading ? 'Analyse en cours...' : 'Analyser mon CV'}
                        onPress={handleAnalyze}
                        variant="primary"
                        disabled={loading}
                        style={styles.analyzeButton}
                    />
                </NativeCard>
            ) : (
                <View>
                    {/* Scores */}
                    <NativeCard style={styles.card}>
                        <Text style={styles.sectionTitle}>Scores d'analyse</Text>
                        <View style={styles.scoresContainer}>
                            <View style={styles.scoreItem}>
                                <Text style={styles.scoreLabel}>Complétude</Text>
                                <Text style={styles.scoreValue}>
                                    {analysis.score_completude?.toFixed(1) || 'N/A'}%
                                </Text>
                            </View>
                            <View style={styles.scoreItem}>
                                <Text style={styles.scoreLabel}>Qualité</Text>
                                <Text style={styles.scoreValue}>
                                    {analysis.score_qualite?.toFixed(1) || 'N/A'}%
                                </Text>
                            </View>
                            <View style={styles.scoreItem}>
                                <Text style={styles.scoreLabel}>Pertinence</Text>
                                <Text style={styles.scoreValue}>
                                    {analysis.score_pertinence?.toFixed(1) || 'N/A'}%
                                </Text>
                            </View>
                        </View>
                    </NativeCard>

                    {/* Compétences extraites */}
                    {analysis.competences_extracted && analysis.competences_extracted.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Compétences identifiées</Text>
                            <View style={styles.badgesContainer}>
                                {analysis.competences_extracted.map((comp: string, index: number) => (
                                    <NativeBadge
                                        key={index}
                                        text={comp}
                                        variant="info"
                                        size="small"
                                    />
                                ))}
                            </View>
                        </NativeCard>
                    )}

                    {/* Informations extraites */}
                    <NativeCard style={styles.card}>
                        <Text style={styles.sectionTitle}>Informations extraites</Text>
                        {analysis.experience_years_extracted !== undefined && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Expérience:</Text>
                                <Text style={styles.infoValue}>
                                    {analysis.experience_years_extracted} années
                                </Text>
                            </View>
                        )}
                        {analysis.niveau_etude_extracted && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Niveau d'étude:</Text>
                                <Text style={styles.infoValue}>
                                    {analysis.niveau_etude_extracted}
                                </Text>
                            </View>
                        )}
                    </NativeCard>

                    {/* Suggestions d'amélioration */}
                    {analysis.suggestions_amelioration && analysis.suggestions_amelioration.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Suggestions d'amélioration</Text>
                            {analysis.suggestions_amelioration.map((suggestion: string, index: number) => (
                                <View key={index} style={styles.suggestionItem}>
                                    <SafeIcon name="check-circle" size={16} color={modernColors.primary} />
                                    <Text style={styles.suggestionText}>{suggestion}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    {/* Compétences manquantes */}
                    {analysis.competences_manquantes && analysis.competences_manquantes.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Compétences manquantes</Text>
                            <View style={styles.badgesContainer}>
                                {analysis.competences_manquantes.map((comp: string, index: number) => (
                                    <NativeBadge
                                        key={index}
                                        text={comp}
                                        variant="warning"
                                        size="small"
                                    />
                                ))}
                            </View>
                        </NativeCard>
                    )}

                    <View style={styles.actions}>
                        <NativeButton
                            title="Nouvelle analyse"
                            onPress={() => {
                                setAnalysis(null);
                                setCvText('');
                                setCvUrl('');
                            }}
                            variant="outline"
                            style={styles.actionButton}
                        />
                        <NativeButton
                            title="Voir suggestions formations"
                            onPress={() => {
                                // TODO: Navigation vers suggestions formations
                                Alert.alert('À venir', 'Fonctionnalité à implémenter');
                            }}
                            variant="secondary"
                            style={styles.actionButton}
                        />
                    </View>
                </View>
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Analyse en cours...</Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollContent: {
        padding: 16,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    card: {
        marginBottom: 16,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    textArea: {
        minHeight: 150,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.md,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
        textAlignVertical: 'top',
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.md,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    analyzeButton: {
        marginTop: 8,
    },
    scoresContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 16,
    },
    scoreItem: {
        alignItems: 'center',
    },
    scoreLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    badgesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    infoValue: {
        fontSize: 14,
        color: modernColors.text,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 8,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    actions: {
        marginTop: 24,
        gap: 12,
    },
    actionButton: {
        marginBottom: 8,
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
        color: '#fff',
        fontSize: 16,
    },
});

export default AnalyseCVScreen;

