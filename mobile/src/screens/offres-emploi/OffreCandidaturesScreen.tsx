// ✅ Écran de gestion des candidatures pour une offre d'emploi
// Permet de voir les postulants, analyser les CV via IA, et gérer les candidatures

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { offreEmploiService } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

interface Candidature {
    id: number;
    user_id: number;
    offre_id: number;
    statut: 'pending' | 'reviewed' | 'accepted' | 'rejected';
    score_matching?: number;
    created_at: string;
    candidat_nom?: string;
    candidat_email?: string;
    candidat_cv_url?: string;
    cv_analysis?: any;
}

const OffreCandidaturesScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as any;
    const offreId = params?.offreId;

    const [candidatures, setCandidatures] = useState<Candidature[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState<number | null>(null);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [selectedCandidature, setSelectedCandidature] = useState<Candidature | null>(null);
    const [matchingCandidats, setMatchingCandidats] = useState<any[]>([]);
    const [loadingMatching, setLoadingMatching] = useState(false);

    useEffect(() => {
        if (offreId) {
            loadCandidatures();
            loadMatchingCandidats();
        }
    }, [offreId]);

    const loadCandidatures = async () => {
        try {
            setLoading(true);
            const response = await offreEmploiService.listCandidaturesOffre(offreId);
            const backendData = (response?.data as any);
            const candidaturesData = backendData?.data || backendData;
            if (response.success && Array.isArray(candidaturesData)) {
                setCandidatures(candidaturesData);
            }
        } catch (error: any) {
            console.error('[OffreCandidaturesScreen] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger les candidatures');
        } finally {
            setLoading(false);
        }
    };

    const loadMatchingCandidats = async () => {
        try {
            setLoadingMatching(true);
            const response = await offreEmploiService.findMatchingCandidats(offreId);
            const matchBackend = (response?.data as any);
            const matchData = matchBackend?.data || matchBackend;
            if (response.success && Array.isArray(matchData)) {
                setMatchingCandidats(matchData);
            }
        } catch (error: any) {
            console.error('[OffreCandidaturesScreen] Erreur matching:', error);
        } finally {
            setLoadingMatching(false);
        }
    };

    const handleAnalyzeCV = async (candidature: Candidature) => {
        if (!candidature.candidat_cv_url) {
            Alert.alert('Erreur', 'Aucun CV disponible pour ce candidat');
            return;
        }

        try {
            setAnalyzing(candidature.id);
            const response = await offreEmploiService.analyzeCV(candidature.user_id, '', candidature.candidat_cv_url!);

            if (response.success && response.data) {
                setSelectedCandidature({
                    ...candidature,
                    cv_analysis: response.data,
                });
                setShowAnalysisModal(true);
            } else {
                Alert.alert('Erreur', 'Impossible d\'analyser le CV');
            }
        } catch (error: any) {
            console.error('[OffreCandidaturesScreen] Erreur analyse:', error);
            Alert.alert('Erreur', 'Erreur lors de l\'analyse du CV');
        } finally {
            setAnalyzing(null);
        }
    };

    const handleUpdateStatut = async (candidatureId: number, statut: string) => {
        try {
            const response = await offreEmploiService.updateStatutCandidature(candidatureId, statut);
            if (response.success) {
                Alert.alert('Succès', 'Statut mis à jour');
                loadCandidatures();
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de la mise à jour');
            }
        } catch (error: any) {
            console.error('[OffreCandidaturesScreen] Erreur:', error);
            Alert.alert('Erreur', 'Erreur lors de la mise à jour');
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Candidatures</Text>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* ✅ NOUVEAU: Section Matching intelligent */}
                {matchingCandidats.length > 0 && (
                    <NativeCard style={styles.matchingCard}>
                        <View style={styles.matchingHeader}>
                            <SafeIcon name="target" size={24} color={modernColors.primary} type="lucide" />
                            <View style={styles.matchingHeaderText}>
                                <Text style={styles.matchingTitle}>Candidats recommandés (IA)</Text>
                                <Text style={styles.matchingSubtitle}>
                                    {matchingCandidats.length} profil{matchingCandidats.length > 1 ? 's' : ''} correspondant{matchingCandidats.length > 1 ? 's' : ''} à votre offre
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.matchingButton}
                            onPress={() => {
                                hapticPress();
                                // Naviguer vers la liste des matchings
                                Alert.alert('Matching IA', 'Fonctionnalité à venir : voir les candidats recommandés');
                            }}
                        >
                            <Text style={styles.matchingButtonText}>Voir les matchings</Text>
                            <SafeIcon name="arrow-right" size={20} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </NativeCard>
                )}

                {/* Liste des candidatures */}
                <Text style={styles.sectionTitle}>
                    {candidatures.length} candidature{candidatures.length > 1 ? 's' : ''}
                </Text>

                {candidatures.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="users" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>Aucune candidature pour le moment</Text>
                        <Text style={styles.emptySubtext}>
                            Les candidatures apparaîtront ici une fois que des candidats auront postulé
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={candidatures}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <CandidatureCard
                                candidature={item}
                                onAnalyze={() => handleAnalyzeCV(item)}
                                onUpdateStatut={handleUpdateStatut}
                                analyzing={analyzing === item.id}
                            />
                        )}
                        scrollEnabled={false}
                    />
                )}
            </ScrollView>

            {/* Modal d'analyse CV */}
            {showAnalysisModal && selectedCandidature && (
                <CVAnalysisModal
                    visible={showAnalysisModal}
                    candidature={selectedCandidature}
                    onClose={() => {
                        setShowAnalysisModal(false);
                        setSelectedCandidature(null);
                    }}
                />
            )}
        </View>
    );
};

// Composant Card pour une candidature
interface CandidatureCardProps {
    candidature: Candidature;
    onAnalyze: () => void;
    onUpdateStatut: (id: number, statut: string) => void;
    analyzing: boolean;
}

const CandidatureCard: React.FC<CandidatureCardProps> = ({
    candidature,
    onAnalyze,
    onUpdateStatut,
    analyzing,
}) => {
    const getStatutColor = (statut: string) => {
        switch (statut) {
            case 'accepted':
                return '#10B981';
            case 'rejected':
                return '#EF4444';
            case 'reviewed':
                return '#3B82F6';
            default:
                return '#9CA3AF';
        }
    };

    const getStatutLabel = (statut: string) => {
        switch (statut) {
            case 'accepted':
                return 'Accepté';
            case 'rejected':
                return 'Rejeté';
            case 'reviewed':
                return 'En cours';
            default:
                return 'En attente';
        }
    };

    return (
        <NativeCard style={styles.candidatureCard}>
            <View style={styles.candidatureHeader}>
                <View style={styles.candidatureInfo}>
                    <Text style={styles.candidatureName}>
                        {candidature.candidat_nom || 'Candidat anonyme'}
                    </Text>
                    <Text style={styles.candidatureEmail}>{candidature.candidat_email}</Text>
                </View>
                <View
                    style={[
                        styles.statutBadge,
                        { backgroundColor: getStatutColor(candidature.statut) + '20' },
                    ]}
                >
                    <Text
                        style={[
                            styles.statutText,
                            { color: getStatutColor(candidature.statut) },
                        ]}
                    >
                        {getStatutLabel(candidature.statut)}
                    </Text>
                </View>
            </View>

            {candidature.score_matching && (
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreLabel}>Score de matching:</Text>
                    <Text style={styles.scoreValue}>{candidature.score_matching.toFixed(0)}%</Text>
                </View>
            )}

            <View style={styles.candidatureActions}>
                {candidature.candidat_cv_url && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onAnalyze}
                        disabled={analyzing}
                    >
                        <SafeIcon
                            name="brain"
                            size={18}
                            color={modernColors.primary}
                            type="lucide"
                        />
                        <Text style={styles.actionButtonText}>
                            {analyzing ? 'Analyse...' : 'Analyser CV (IA)'}
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={styles.statutActions}>
                    {candidature.statut === 'pending' && (
                        <>
                            <TouchableOpacity
                                style={[styles.statutButton, styles.acceptButton]}
                                onPress={() => onUpdateStatut(candidature.id, 'accepted')}
                            >
                                <Text style={styles.statutButtonText}>Accepter</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.statutButton, styles.rejectButton]}
                                onPress={() => onUpdateStatut(candidature.id, 'rejected')}
                            >
                                <Text style={styles.statutButtonText}>Rejeter</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </NativeCard>
    );
};

// Modal d'analyse CV
interface CVAnalysisModalProps {
    visible: boolean;
    candidature: Candidature;
    onClose: () => void;
}

const CVAnalysisModal: React.FC<CVAnalysisModalProps> = ({ visible, candidature, onClose }) => {
    const analysis = candidature.cv_analysis;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Analyse CV IA</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {analysis ? (
                            <View>
                                {analysis.score_global && (
                                    <View style={styles.analysisScore}>
                                        <Text style={styles.analysisScoreLabel}>Score global</Text>
                                        <Text style={styles.analysisScoreValue}>
                                            {analysis.score_global}/100
                                        </Text>
                                    </View>
                                )}
                                {analysis.points_forts && analysis.points_forts.length > 0 && (
                                    <View style={styles.analysisSection}>
                                        <Text style={styles.analysisSectionTitle}>Points forts</Text>
                                        {analysis.points_forts.map((point: string, i: number) => (
                                            <Text key={i} style={styles.analysisPoint}>
                                                • {point}
                                            </Text>
                                        ))}
                                    </View>
                                )}
                                {analysis.suggestions_amelioration &&
                                    analysis.suggestions_amelioration.length > 0 && (
                                        <View style={styles.analysisSection}>
                                            <Text style={styles.analysisSectionTitle}>
                                                Suggestions d'amélioration
                                            </Text>
                                            {analysis.suggestions_amelioration.map(
                                                (suggestion: string, i: number) => (
                                                    <Text key={i} style={styles.analysisPoint}>
                                                        • {suggestion}
                                                    </Text>
                                                )
                                            )}
                                        </View>
                                    )}
                            </View>
                        ) : (
                            <Text style={styles.placeholderText}>Aucune analyse disponible</Text>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
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
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#EEF2FF',
    },
    matchingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    matchingHeaderText: {
        flex: 1,
    },
    matchingTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    matchingSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    matchingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    matchingButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 300,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    candidatureCard: {
        marginBottom: 16,
        padding: 16,
    },
    candidatureHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    candidatureInfo: {
        flex: 1,
    },
    candidatureName: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    candidatureEmail: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statutBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statutText: {
        fontSize: 12,
        fontWeight: '600',
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    scoreLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    scoreValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    candidatureActions: {
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 8,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    statutActions: {
        flexDirection: 'row',
        gap: 8,
    },
    statutButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#10B981',
    },
    rejectButton: {
        backgroundColor: '#EF4444',
    },
    statutButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    modalCloseButton: {
        padding: 4,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        padding: 20,
    },
    analysisScore: {
        alignItems: 'center',
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
    },
    analysisScoreLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    analysisScoreValue: {
        fontSize: 32,
        fontWeight: '700',
        color: modernColors.primary,
    },
    analysisSection: {
        marginBottom: 20,
    },
    analysisSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    analysisPoint: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 20,
    },
    placeholderText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        padding: 32,
    },
});

export default OffreCandidaturesScreen;

