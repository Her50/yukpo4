// ✅ Écran Analyse CV IA pour Offres d'Emploi (Mobile)
// Récupère le CV depuis le profil candidat et l'analyse

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
// apiGet/apiPost remplacés par offreEmploiService
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { CVAnalysis, offreEmploiService } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';

const AICVAnalysisScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingCV, setLoadingCV] = useState(true);
    const [analysis, setAnalysis] = useState<CVAnalysis | null>(null);
    const [cvUrl, setCvUrl] = useState<string | null>(null);
    const [hasCV, setHasCV] = useState(false);

    // ✅ NOUVEAU: Charger le CV depuis le profil candidat
    useEffect(() => {
        loadCVFromProfile();
    }, []);

    const loadCVFromProfile = async () => {
        try {
            setLoadingCV(true);
            const response = await offreEmploiService.getProfil();

            const backendData = (response?.data as any);
            const profil = backendData?.data || backendData;
            if (response.success && profil) {
                if (profil.cv_url && profil.cv_url.trim()) {
                    setCvUrl(profil.cv_url);
                    setHasCV(true);
                } else {
                    setHasCV(false);
                }
            } else {
                setHasCV(false);
            }
        } catch (error: any) {
            console.error('[AICVAnalysisScreen] Erreur chargement profil:', error);
            setHasCV(false);
        } finally {
            setLoadingCV(false);
        }
    };

    const handleAnalyze = async () => {
        if (!cvUrl) {
            Alert.alert(
                'CV requis',
                t('aICVAnalysisScreen.vousDevezDabordTelechargerVotreCvDansVotre'),
                [
                    { text: t('common.cancel') },
                    {
                        text: 'Aller au profil',
                        onPress: () => {
                            navigation.navigate('ProfilCandidat');
                        },
                    },
                ]
            );
            return;
        }

        try {
            setLoading(true);
            const response = await offreEmploiService.analyzeCV((user?.id || 0) as number, '', cvUrl);
            const resData = (response?.data as any);
            const analysisResult = resData?.analysis || resData?.data?.analysis || (response as any)?.analysis;

            if (response.success && analysisResult) {
                setAnalysis(analysisResult);
            } else {
                Alert.alert('Erreur', response.message || t('aICVAnalysisScreen.estPeutetrePasEncoreOperationnelle'));
            }
        } catch (error: any) {
            console.error('[AICVAnalysisScreen] Erreur analyse:', error);
            Alert.alert(
                'Erreur',
                t('aICVAnalysisScreen.impossibleDanalyserLeCvLiaDanalyseNestPeutetre')
            );
        } finally {
            setLoading(false);
        }
    };

    if (loadingCV) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('aICVAnalysis.chargementDuProfil')}</Text>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Analyse CV IA</Text>
            </View>

            {!hasCV ? (
                <NativeCard style={styles.card}>
                    <View style={styles.noCVContainer}>
                        <SafeIcon name="file-text" size={64} color={modernColors.textSecondary} />
                        <Text style={styles.noCVTitle}>{t('aICVAnalysis.aucunCvTrouve')}</Text>
                        <Text style={styles.noCVText}>
                            Vous devez d'abord télécharger votre CV dans votre profil candidat.'
                        </Text>
                        <NativeButton
                            title={t('aICVAnalysis.allerAMonProfil')}
                            onPress={() => navigation.navigate('ProfilCandidat')}
                            variant="primary"
                            style={styles.button}
                        />
                    </View>
                </NativeCard>
            ) : !analysis ? (
                <NativeCard style={styles.card}>
                    <View style={styles.infoContainer}>
                        <SafeIcon name="file-check" size={48} color={modernColors.primary} />
                        <Text style={styles.infoTitle}>{t('aICVAnalysis.cvTrouve')}</Text>
                        <Text style={styles.infoText}>
                            Votre CV a été trouvé dans votre profil. Cliquez sur le bouton ci-dessous pour l"analyser avec l'IA."
                        </Text>
                        <NativeButton
                            title={loading ? 'Analyse en cours...' : 'Analyser mon CV'}
                            onPress={handleAnalyze}
                            variant="primary"
                            disabled={loading}
                            style={styles.button}
                        />
                    </View>
                </NativeCard>
            ) : (
                <View>
                    <NativeCard style={styles.analysisCard}>
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreLabel}>{t('aICVAnalysis.scoreGlobal')}</Text>
                            <Text style={styles.scoreValue}>{analysis.score_global}/100</Text>
                        </View>
                    </NativeCard>

                    {analysis.points_forts && analysis.points_forts.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('aICVAnalysis.pointsForts')}</Text>
                            {analysis.points_forts.map((point, i) => (
                                <View key={i} style={styles.pointItem}>
                                    <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                                    <Text style={styles.pointText}>{point}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    {analysis.points_faibles && analysis.points_faibles.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('aICVAnalysis.pointsAAmeliorer')}</Text>
                            {analysis.points_faibles.map((point, i) => (
                                <View key={i} style={styles.pointItem}>
                                    <SafeIcon name="alert-circle" size={16} color={modernColors.warning} />
                                    <Text style={styles.pointText}>{point}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    {analysis.suggestions_amelioration && analysis.suggestions_amelioration.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('aICVAnalysis.suggestionsDamelioration')}</Text>
                            {analysis.suggestions_amelioration.map((suggestion, i) => (
                                <View key={i} style={styles.suggestionItem}>
                                    <SafeIcon name="lightbulb" size={16} color={modernColors.primary} />
                                    <Text style={styles.suggestionText}>{suggestion}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    {analysis.competences_identifiees && analysis.competences_identifiees.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('aICVAnalysis.competencesIdentifiees')}</Text>
                            <View style={styles.tagsContainer}>
                                {analysis.competences_identifiees.map((comp, i) => (
                                    <View key={i} style={styles.tag}>
                                        <Text style={styles.tagText}>{comp}</Text>
                                    </View>
                                ))}
                            </View>
                        </NativeCard>
                    )}

                    {analysis.competences_manquantes && analysis.competences_manquantes.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>{t('aICVAnalysis.competencesManquantes')}</Text>
                            <View style={styles.tagsContainer}>
                                {analysis.competences_manquantes.map((comp, i) => (
                                    <View key={i} style={[styles.tag, styles.tagMissing]}>
                                        <Text style={[styles.tagText, styles.tagTextMissing]}>{comp}</Text>
                                    </View>
                                ))}
                            </View>
                        </NativeCard>
                    )}

                    {analysis.recommandations && analysis.recommandations.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Recommandations</Text>
                            {analysis.recommandations.map((reco, i) => (
                                <View key={i} style={styles.recoItem}>
                                    <SafeIcon name="star" size={16} color={modernColors.primary} />
                                    <Text style={styles.recoText}>{reco}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    <View style={styles.actions}>
                        <NativeButton
                            title={t('aICVAnalysis.nouvelleAnalyse')}
                            onPress={() => {
                                setAnalysis(null);
                                loadCVFromProfile();
                            }}
                            variant="outline"
                            style={styles.button}
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
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    card: {
        marginBottom: 16,
        padding: 20,
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
    noCVContainer: {
        alignItems: 'center',
        padding: 20,
    },
    noCVTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    noCVText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    infoContainer: {
        alignItems: 'center',
        padding: 20,
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        marginTop: 8,
    },
    analysisCard: {
        marginBottom: 16,
        padding: 20,
        backgroundColor: modernColors.primary + '10',
    },
    scoreContainer: {
        alignItems: 'center',
    },
    scoreLabel: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    scoreValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    pointItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 8,
    },
    pointText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
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
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: modernColors.primary + '20',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    tagMissing: {
        backgroundColor: modernColors.error + '20',
    },
    tagText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    tagTextMissing: {
        color: modernColors.error,
    },
    recoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 8,
    },
    recoText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    actions: {
        marginTop: 24,
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
});

export default AICVAnalysisScreen;



