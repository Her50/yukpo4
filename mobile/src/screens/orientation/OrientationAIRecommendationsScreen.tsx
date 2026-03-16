// ✅ Écran Recommandations Programmes IA pour Orientation Scolaire (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { orientationScolaireApi } from '../../services/orientationScolaireApi';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const OrientationAIRecommendationsScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [recommendations, setRecommendations] = useState<any[]>([]);

    const handleGetRecommendations = async () => {
        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté');
            return;
        }

        try {
            setLoading(true);
            const profile = await orientationScolaireApi.getMyProfile();
            if (!profile) {
                Alert.alert(
                    'Profil requis',
                    'Veuillez d\t('orientationAIRecommendationsScreen.abordCompleterVotreProfilEtudiant'),
                    [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                            text: t('orientationAIRecommendations.creerProfil'),
                            onPress: () => navigation.navigate('ProfilEtudiant')
                        }
                    ]
                );
                return;
            }

            const response = await orientationScolaireApi.getRecommendations({
                student_profile_id: profile.id,
                etablissement_id: undefined,
                filiere: undefined,
                specialite: undefined,
                budget_max: profile.budget_max ? parseFloat(profile.budget_max.toString()) : undefined,
                preference_localisation: profile.preference_localisation || undefined,
            });

            // Le backend retourne un seul recommendation, pas un array
            if (response) {
                setRecommendations([response]);
            } else {
                Alert.alert('Erreur', 'Impossible d\'obtenir les recommandations');
            }
        } catch (error: any) {
            console.error('[OrientationAIRecommendations] Erreur:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir les recommandations. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Recommandations Programmes IA</Text>
                <Text style={styles.subtitle}>
                    Découvrez les programmes qui correspondent le mieux à votre profil
                </Text>
            </View>

            {recommendations.length === 0 ? (
                <NativeCard style={styles.card}>
                    <SafeIcon name="lightbulb" size={48} color={modernColors.secondary} type="lucide" />
                    <Text style={styles.cardTitle}>Obtenir des recommandations</Text>
                    <Text style={styles.cardDescription}>
                        L'IA analysera votre profil et vous proposera les meilleurs programmes
                    </Text>
                    <NativeButton
                        title={loading ? t('orientationAIRecommendationsScreen.generationEnCours') : t('orientationAIRecommendationsScreen.genererLesRecommandations')}
                        onPress={handleGetRecommendations}
                        variant="primary"
                        disabled={loading}
                        style={styles.button}
                    />
                </NativeCard>
            ) : (
                <View>
                    <Text style={styles.resultsTitle}>
                        {recommendations.length} programme{recommendations.length > 1 ? 's' : ''} recommandé{recommendations.length > 1 ? 's' : ''}
                    </Text>
                    {recommendations.map((rec, index) => (
                        <NativeCard key={index} style={styles.recommendationCard}>
                            <View style={styles.recommendationHeader}>
                                <View style={styles.scoreBadge}>
                                    <Text style={styles.scoreText}>
                                        {rec.score_total?.toFixed(0) || 'N/A'}%
                                    </Text>
                                </View>
                                <View style={styles.recommendationInfo}>
                                    <Text style={styles.etablissementName}>
                                        Établissement #{rec.etablissement_id}
                                    </Text>
                                    <Text style={styles.programmeName}>
                                        {rec.filiere || 'Programme'}
                                        {rec.specialite ? ` - ${rec.specialite}` : ''}
                                    </Text>
                                </View>
                            </View>
                            {rec.reasoning && (
                                <Text style={styles.reasoning}>{rec.reasoning}</Text>
                            )}
                            {rec.points_forts && rec.points_forts.length > 0 && (
                                <View style={styles.pointsSection}>
                                    <Text style={styles.pointsLabel}>{t('orientationAIRecommendations.pointsForts')}/Text>
                                    {rec.points_forts.map((point: string, idx: number) => (
                                        <Text key={idx} style={styles.pointText}>• {point}</Text>
                                    ))}
                                </View>
                            )}
                            {rec.points_faibles && rec.points_faibles.length > 0 && (
                                <View style={styles.pointsSection}>
                                    <Text style={styles.pointsLabel}>{t('orientationAIRecommendations.pointsAAmeliorer')}</Text>
                                    {rec.points_faibles.map((point: string, idx: number) => (
                                        <Text key={idx} style={styles.pointText}>• {point}</Text>
                                    ))}
                                </View>
                            )}
                            <TouchableOpacity
                                style={styles.detailsButton}
                                onPress={() => {
                                    if (rec.etablissement_id) {
                                        navigation.navigate('EtablissementDetails', { id: rec.etablissement_id });
                                    }
                                }}
                            >
                                <Text style={styles.detailsButtonText}>{t('orientationAIRecommendations.voirLesDetails')}</Text>
                                <SafeIcon name="chevron-right" size={16} color={modernColors.primary} />
                            </TouchableOpacity>
                        </NativeCard>
                    ))}
                    <NativeButton
                        title="Nouvelles recommandations"
                        onPress={() => {
                            setRecommendations([]);
                            handleGetRecommendations();
                        }}
                        variant="outline"
                        style={styles.button}
                    />
                </View>
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('orientationAIRecommendations.generationEnCours')}</Text>
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
    button: {
        marginTop: 8,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    recommendationCard: {
        marginBottom: 16,
        padding: 16,
    },
    recommendationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    scoreBadge: {
        backgroundColor: modernColors.primary,
        borderRadius: 20,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    recommendationInfo: {
        flex: 1,
    },
    etablissementName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    programmeName: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    reasoning: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
        marginBottom: 12,
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 8,
    },
    detailsButtonText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
        marginRight: 4,
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
    pointsSection: {
        marginTop: 12,
        marginBottom: 8,
    },
    pointsLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    pointText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginLeft: 8,
        marginBottom: 2,
    },
});

export default OrientationAIRecommendationsScreen;

