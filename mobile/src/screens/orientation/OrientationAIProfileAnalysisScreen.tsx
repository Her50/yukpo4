// ✅ Écran Analyse Profil IA pour Orientation Scolaire (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { NativeBadge, NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { orientationScolaireApi } from '../../services/orientationScolaireApi';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const OrientationAIProfileAnalysisScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);

    const handleAnalyze = async () => {
        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté');
            return;
        }

        try {
            setLoading(true);
            // Récupérer le profil étudiant d'abord
            const profile = await orientationScolaireApi.getMyProfile();
            if (!profile) {
                Alert.alert(
                    'Profil requis',
                    t('orientationAIProfileAnalysisScreen.veuillezDabordCompleterVotreProfilEtudiant'),
                    [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                            text: t('orientationAIProfileAnalysis.creerProfil'),
                            onPress: () => navigation.navigate('ProfilEtudiant')
                        }
                    ]
                );
                return;
            }

            const response = await orientationScolaireApi.analyzeProfile(profile.id);

            setAnalysis(response);
        } catch (error: any) {
            console.error('[OrientationAIProfileAnalysis] Erreur:', error);
            Alert.alert('Erreur', 'Impossible d\'analyser le profil. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Analyse Profil IA</Text>
                <Text style={styles.subtitle}>
                    Obtenez une analyse détaillée de vos forces et intérêts
                </Text>
            </View>

            {!analysis ? (
                <NativeCard style={styles.card}>
                    <SafeIcon name="brain" size={48} color={modernColors.primary} type="lucide" />
                    <Text style={styles.cardTitle}>Analysez votre profil</Text>
                    <Text style={styles.cardDescription}>
                        L'IA analysera votre profil académique et vous donnera des recommandations personnalisées
                    </Text>
                    <NativeButton
                        title={loading ? 'Analyse en cours...' : 'Lancer l\'analyse'}
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
                                <Text style={styles.scoreLabel}>{t('orientationAIProfileAnalysis.academique')}</Text>
                                <Text style={styles.scoreValue}>
                                    {analysis.score_academique?.toFixed(1) || 'N/A'}%
                                </Text>
                            </View>
                            <View style={styles.scoreItem}>
                                <Text style={styles.scoreLabel}>{t('orientationAIProfileAnalysis.interets')}</Text>
                                <Text style={styles.scoreValue}>
                                    {analysis.score_interets?.toFixed(1) || 'N/A'}%
                                </Text>
                            </View>
                        </View>
                    </NativeCard>

                    {/* Points forts */}
                    {analysis.points_forts && analysis.points_forts.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('orientationAIProfileAnalysis.pointsForts')}</Text>
                            <View style={styles.badgesContainer}>
                                {analysis.points_forts.map((point: string, index: number) => (
                                    <NativeBadge
                                        key={index}
                                        text={point}
                                        variant="success"
                                        size="small"
                                    />
                                ))}
                            </View>
                        </NativeCard>
                    )}

                    {/* Points faibles */}
                    {analysis.points_faibles && analysis.points_faibles.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('orientationAIProfileAnalysis.pointsAAmeliorer')}</Text>
                            <View style={styles.badgesContainer}>
                                {analysis.points_faibles.map((point: string, index: number) => (
                                    <NativeBadge
                                        key={index}
                                        text={point}
                                        variant="warning"
                                        size="small"
                                    />
                                ))}
                            </View>
                        </NativeCard>
                    )}

                    {/* Filières suggérées */}
                    {analysis.filieres_suggestees && analysis.filieres_suggestees.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('orientationAIProfileAnalysis.filieresSuggerees')}</Text>
                            <View style={styles.badgesContainer}>
                                {analysis.filieres_suggestees.map((filiere: string, index: number) => (
                                    <NativeBadge
                                        key={index}
                                        text={filiere}
                                        variant="info"
                                        size="small"
                                    />
                                ))}
                            </View>
                        </NativeCard>
                    )}

                    {/* Recommandations */}
                    {analysis.recommendations && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Recommandations</Text>
                            <Text style={styles.recommendationsText}>{analysis.recommendations}</Text>
                        </NativeCard>
                    )}

                    {/* Reasoning */}
                    {analysis.reasoning && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('orientationAIProfileAnalysis.analyseDetaillee')}</Text>
                            <Text style={styles.reasoningText}>{analysis.reasoning}</Text>
                        </NativeCard>
                    )}

                    <View style={styles.actions}>
                        <NativeButton
                            title={t('orientationAIProfileAnalysisScreen.voirRecommandationsProgrammes')}
                            onPress={() => navigation.navigate('OrientationAIRecommendations')}
                            variant="primary"
                            style={styles.actionButton}
                        />
                        <NativeButton
                            title={t('orientationAIProfileAnalysis.nouvelleAnalyse')}
                            onPress={() => setAnalysis(null)}
                            variant="outline"
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
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    analyzeButton: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
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
    recommendationsText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    reasoningText: {
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

export default OrientationAIProfileAnalysisScreen;

