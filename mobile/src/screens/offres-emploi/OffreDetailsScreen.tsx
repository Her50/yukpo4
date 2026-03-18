// ✅ Détails d'une offre d'emploi avec score de matching (Mobile)
import { useNavigation, useRoute } from '@react-navigation/native';
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
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { offreEmploiService } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';

interface OffreEmploi {
    id: number;
    entreprise_id: number;
    titre_poste: string;
    description: string;
    type_contrat: string;
    lieu_travail: string;
    remote: boolean;
    remote_partiel: boolean;
    salaire_min?: number;
    salaire_max?: number;
    devise: string;
    salaire_negociable: boolean;
    niveau_etude?: string;
    experience_min?: number;
    competences_requises?: string[];
    secteur: string;
    date_publication: string;
    date_limite_candidature?: string;
    nombre_candidatures: number;
    nombre_vues: number;
}

interface MatchingScore {
    score_total: number;
    score_competences?: number;
    score_experience?: number;
    score_localisation?: number;
    score_salaire?: number;
    competences_match?: string[];
    competences_manquantes?: string[];
}

const OffreDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const params = route.params as any;

    const [offre, setOffre] = useState<OffreEmploi | null>(null);
    const [matchingScore, setMatchingScore] = useState<MatchingScore | null>(null);
    const [loading, setLoading] = useState(true);
    const [postulating, setPostulating] = useState(false);

    useEffect(() => {
        if (params.offreId) {
            loadOffre();
            if (user) {
                loadMatchingScore();
            }
        }
    }, [params.offreId, user]);

    const loadOffre = async () => {
        try {
            setLoading(true);
            const response = await offreEmploiService.getOffreDetails(params.offreId);
            const backendData = (response?.data as any);
            const offreData = backendData?.data || backendData;
            if (response.success && offreData) {
                setOffre(offreData);
            } else {
                Alert.alert(t('message.error'), t('offreDetails.cannotLoadOffer'));
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[OffreDetailsScreen] Erreur:', error);
            Alert.alert(t('message.error'), error.message || t('offreDetails.cannotLoadOffer'));
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const loadMatchingScore = async () => {
        try {
            const response = await offreEmploiService.getMatchingOffres(0, 100);
            const matchBackend = (response?.data as any);
            const matchList = matchBackend?.data || matchBackend;
            if (response.success && Array.isArray(matchList)) {
                const match = matchList.find((m: any) => m.offre_id === params.offreId);
                if (match) {
                    setMatchingScore({
                        score_total: parseFloat(match.score_total) || 0,
                        score_competences: match.score_competences ? parseFloat(match.score_competences) : undefined,
                        score_experience: match.score_experience ? parseFloat(match.score_experience) : undefined,
                        score_localisation: match.score_localisation ? parseFloat(match.score_localisation) : undefined,
                        score_salaire: match.score_salaire ? parseFloat(match.score_salaire) : undefined,
                        competences_match: match.competences_match,
                        competences_manquantes: match.competences_manquantes,
                    });
                }
            }
        } catch (error) {
            console.error('[OffreDetailsScreen] Erreur matching:', error);
        }
    };

    const handlePostuler = async () => {
        if (!user) {
            Alert.alert(t('offreDetails.loginRequired'), t('offreDetails.loginToApply'));
            (navigation as any).navigate('Login');
            return;
        }

        // ✅ NOUVEAU: Vérifier si l'utilisateur a un profil candidat
        try {
            const profilResponse = await offreEmploiService.getProfil();
            const profilBackend = (profilResponse?.data as any);
            const profilData = profilBackend?.data || profilBackend;
            const hasProfil = profilResponse.success && profilData;
            const hasCV = hasProfil && profilData?.cv_url;

            if (!hasProfil || !hasCV) {
                Alert.alert(
                    t('offreDetails.profileRequired'),
                    t('offreDetails.createProfileAndCV'),
                    [
                        { text: t('common.cancel') },
                        {
                            text: 'Créer mon profil',
                            onPress: () => (navigation as any).navigate('ProfilCandidat'),
                        },
                    ]
                );
                return;
            }
        } catch (err) {
            console.error('[OffreDetailsScreen] Erreur vérification profil:', err);
        }

        try {
            setPostulating(true);
            const response = await offreEmploiService.createCandidature(params.offreId);
            if (response.success) {
                Alert.alert(t('message.success'), t('offreDetails.applicationSent'), [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert(t('message.error'), response.message || t('offreDetails.applicationError'));
            }
        } catch (error: any) {
            console.error('[OffreDetailsScreen] Erreur candidature:', error);
            Alert.alert(t('message.error'), t('offreDetails.applicationError'));
        } finally {
            setPostulating(false);
        }
    };

    const formatSalaire = () => {
        if (!offre) return t('offresEmploiHome.salaireNonRenseigne');
        if (!offre.salaire_min && !offre.salaire_max) return t('offresEmploiHome.salaireNonRenseigne');
        if (offre.salaire_min && offre.salaire_max) {
            return `${offre.salaire_min.toLocaleString()} - ${offre.salaire_max.toLocaleString()} ${offre.devise}`;
        }
        if (offre.salaire_min) return `${t('offresEmploiHome.aPartirDe')} ${offre.salaire_min.toLocaleString()} ${offre.devise}`;
        return `${t('offresEmploiHome.jusqua')} ${offre.salaire_max?.toLocaleString()} ${offre.devise}`;
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('offresEmploiHome.chargement')}</Text>
            </View>
        );
    }

    if (!offre) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>{t('offresEmploiHome.offreNonTrouvee')}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('offreDetails.details') || 'Détails'}</Text>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Score de matching */}
                {matchingScore && (
                    <NativeCard style={[styles.matchingCard, matchingScore.score_total >= 70 ? styles.matchingCardGood : styles.matchingCardLow]}>
                        <View style={styles.matchingHeader}>
                            <View>
                                <Text style={styles.matchingLabel}>{t('offreDetails.votreScoreDeCorrespondance') || 'Votre score de correspondance'}</Text>
                                <Text style={styles.matchingScore}>{matchingScore.score_total.toFixed(0)}%</Text>
                            </View>
                            <SafeIcon
                                name={matchingScore.score_total >= 70 ? 'check-circle' : 'alert-circle'}
                                size={32}
                                color={matchingScore.score_total >= 70 ? '#10B981' : '#F59E0B'}
                                type="lucide"
                            />
                        </View>
                        {matchingScore.competences_manquantes && matchingScore.competences_manquantes.length > 0 && (
                            <View style={styles.competencesMissing}>
                                <Text style={styles.competencesMissingTitle}>{t('offreDetails.competencesManquantes') || 'Compétences manquantes :'}</Text>
                                <View style={styles.competencesTags}>
                                    {matchingScore.competences_manquantes.map((comp, idx) => (
                                        <View key={idx} style={styles.competenceTag}>
                                            <Text style={styles.competenceTagText}>{comp}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </NativeCard>
                )}

                {/* Détails de l'offre */}
                <NativeCard style={styles.detailsCard}>
                    <Text style={styles.offreTitle}>{offre.titre_poste}</Text>
                    <View style={styles.offreMeta}>
                        <View style={styles.metaItem}>
                            <SafeIcon name="map-pin" size={16} color={modernColors.textSecondary} type="lucide" />
                            <Text style={styles.metaText}>
                                {offre.lieu_travail}
                                {offre.remote && <Text style={styles.remoteText}> ({t('offresEmploiHome.teletravail')})</Text>}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <SafeIcon name="briefcase" size={16} color={modernColors.textSecondary} type="lucide" />
                            <Text style={styles.metaText}>{offre.type_contrat}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <SafeIcon name="dollar-sign" size={16} color={modernColors.textSecondary} type="lucide" />
                            <Text style={styles.metaText}>{formatSalaire()}</Text>
                            {offre.salaire_negociable && (
                                <Text style={styles.negotiableText}> ({t('createOffre.salaireNegociable')})</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('createOffre.description')}</Text>
                        <Text style={styles.sectionContent}>{offre.description}</Text>
                    </View>

                    {offre.competences_requises && offre.competences_requises.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('createOffre.competencesRequises')}</Text>
                            <View style={styles.competencesTags}>
                                {offre.competences_requises.map((comp, idx) => (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.competenceTag,
                                            matchingScore?.competences_match?.includes(comp) && styles.competenceTagMatch,
                                        ]}
                                    >
                                        <Text style={styles.competenceTagText}>{comp}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {offre.date_limite_candidature && (
                        <View style={styles.alertBox}>
                            <SafeIcon name="clock" size={20} color="#F59E0B" type="lucide" />
                            <Text style={styles.alertText}>
                                {t('offreDetails.dateLimite') || 'Date limite'} : {new Date(offre.date_limite_candidature).toLocaleDateString()}
                            </Text>
                        </View>
                    )}

                    <View style={styles.stats}>
                        <Text style={styles.statsText}>{offre.nombre_vues} {t('offreDetails.vues') || 'vues'}</Text>
                        <Text style={styles.statsText}>{offre.nombre_candidatures} {t('offreDetails.candidatures') || 'candidatures'}</Text>
                    </View>
                </NativeCard>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
                <NativeButton
                    title={postulating ? (t('offreDetails.envoi') || 'Envoi...') : (t('offreDetails.postulerMaintenant') || 'Postuler maintenant')}
                    onPress={handlePostuler}
                    disabled={postulating}
                    style={styles.postulerButton}
                />
                {/* ✅ NOUVEAU: Lien rapide vers le profil candidat */}
                <TouchableOpacity
                    style={styles.profilLink}
                    onPress={() => {
                        (navigation as any).navigate('ProfilCandidat');
                    }}
                >
                    <SafeIcon name="edit" size={16} color={modernColors.primary} type="lucide" />
                    <Text style={styles.profilLinkText}>{t('offreDetails.mettreAJourMonCv') || 'Mettre à jour mon CV'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    matchingCard: {
        marginBottom: 16,
        padding: 16,
    },
    matchingCardGood: {
        backgroundColor: '#10B981' + '20',
    },
    matchingCardLow: {
        backgroundColor: '#F59E0B' + '20',
    },
    matchingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    matchingLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    matchingScore: {
        fontSize: 32,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    competencesMissing: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    competencesMissingTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    detailsCard: {
        padding: 16,
    },
    offreTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 16,
    },
    offreMeta: {
        marginBottom: 16,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    metaText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    remoteText: {
        color: '#10B981',
        fontWeight: '600',
    },
    negotiableText: {
        color: '#10B981',
        fontSize: 12,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    sectionContent: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    competencesTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    competenceTag: {
        backgroundColor: modernColors.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    competenceTagMatch: {
        backgroundColor: '#10B981' + '20',
        borderColor: '#10B981',
    },
    competenceTagText: {
        fontSize: 12,
        color: modernColors.text,
    },
    alertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F59E0B' + '20',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    alertText: {
        flex: 1,
        fontSize: 14,
        color: '#92400E',
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    statsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    actions: {
        padding: 16,
        backgroundColor: modernColors.surface,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    postulerButton: {
        width: '100%',
    },
    profilLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        paddingVertical: 12,
        gap: 8,
    },
    profilLinkText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
});

export default OffreDetailsScreen;

