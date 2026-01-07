// ✅ Écran Offres d'Emploi MODERNE - Refonte complète avec UX professionnelle
// Focus sur la recherche d'emploi avec fonctionnalités IA avancées
// Création d'offre accessible via bouton (navigation vers CreateOffre)

import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLocation } from '../../contexts/LocationContext';
import { offreEmploiService, OffreEmploi, SearchOffresFilters, CVAnalysis, SalaryPrediction, FormationSuggestion } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const OffresEmploiHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [offres, setOffres] = useState<OffreEmploi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);

    // États pour fonctionnalités IA
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiMode, setAiMode] = useState<'cv' | 'salary' | 'formations' | null>(null);
    const [cvAnalysis, setCvAnalysis] = useState<CVAnalysis | null>(null);
    const [salaryPrediction, setSalaryPrediction] = useState<SalaryPrediction | null>(null);
    const [formations, setFormations] = useState<FormationSuggestion[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);

    // Charger les offres à l'ouverture (proximité)
    useEffect(() => {
        loadOffres(true);
    }, []);

    const loadOffres = useCallback(async (initialLoad: boolean = false) => {
        try {
            if (initialLoad) {
                setLoading(true);
                setError(null);
            }

            const filters: SearchOffresFilters = {
                limit: 20,
                page: 1,
            };

            // Ajouter GPS si disponible pour recherche de proximité
            if (location?.coords) {
                filters.lat = location.coords.latitude;
                filters.lng = location.coords.longitude;
                filters.rayon_km = 50;
            }

            // Ajouter recherche textuelle si présente
            if (searchQuery.trim()) {
                filters.query = searchQuery.trim();
            }

            const response = await offreEmploiService.searchOffres(filters);
            
            if (response.success && response.data?.data) {
                setOffres(response.data.data);
                setTotalResults(response.data.total || 0);
            } else {
                setError('Aucune offre trouvée');
                setOffres([]);
            }
        } catch (err: any) {
            console.error('[OffresEmploiHomeScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
            setOffres([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [searchQuery, location]);

    const handleSearch = () => {
        hapticPress();
        loadOffres(false);
    };

    // Fonctions IA améliorées
    const handleAnalyzeCV = async () => {
        hapticPress();
        setAiMode('cv');
        setLoadingAI(true);
        setShowAIModal(true);

        try {
            // Naviguer vers l'écran d'analyse CV IA
            (navigation as any).navigate('AICVAnalysis');
            setShowAIModal(false);
        } catch (err: any) {
            console.error('[OffresEmploiHomeScreen] Erreur navigation analyse CV:', err);
            Alert.alert(
                'Analyse CV',
                'Veuillez d\'abord uploader votre CV dans votre profil',
                [
                    { text: 'Annuler', onPress: () => setShowAIModal(false) },
                    { text: 'Aller au profil', onPress: () => navigation.navigate('ProfilCandidat' as never) },
                ]
            );
        } finally {
            setLoadingAI(false);
        }
    };

    const handlePredictSalary = async () => {
        hapticPress();
        // Naviguer vers l'écran de prédiction salaire IA
        (navigation as any).navigate('AISalaryPrediction');
    };

    const handleSuggestFormations = async () => {
        hapticPress();
        // Naviguer vers l'écran de suggestions formations IA
        (navigation as any).navigate('AISuggestFormations');
    };

    const formatSalary = (min?: number, max?: number, devise?: string) => {
        const currency = devise || 'FCFA';
        if (!min && !max) return 'Salaire non spécifié';
        if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} ${currency}`;
        if (min) return `À partir de ${min.toLocaleString()} ${currency}`;
        return `Jusqu'à ${max?.toLocaleString()} ${currency}`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec mode toggle */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>Recherche d'Emploi</Text>
                            {totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {totalResults} offre{totalResults > 1 ? 's' : ''} disponible{totalResults > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                        {/* ✅ Bouton pour créer une offre (comme Immobilier) */}
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                (navigation as any).navigate('CreateOffre');
                            }}
                            style={styles.createButton}
                        >
                            <SafeIcon name="plus" size={20} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Rechercher un emploi (titre, secteur, compétences)..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        handleSearch();
                                    }}
                                    style={styles.clearButton}
                                >
                                    <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Actions rapides IA et fonctionnalités */}
                    <View style={styles.quickActions}>
                        <TouchableOpacity
                            style={styles.quickActionButton}
                            onPress={() => {
                                hapticPress();
                                (navigation as any).navigate('ProfilCandidat');
                            }}
                        >
                            <SafeIcon name="user" size={16} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>Mon CV</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickActionButton}
                            onPress={handleAnalyzeCV}
                        >
                            <SafeIcon name="file-text" size={16} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>Analyser CV</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickActionButton}
                            onPress={handlePredictSalary}
                        >
                            <SafeIcon name="dollar-sign" size={16} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>Salaire IA</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickActionButton}
                            onPress={handleSuggestFormations}
                        >
                            <SafeIcon name="graduation-cap" size={16} color="#FFFFFF" type="lucide" />
                            <Text style={styles.quickActionText}>Formations</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ✅ NOUVEAU: Suggestions d'offres basées sur le profil */}
                    <TouchableOpacity
                        style={styles.suggestionsButton}
                        onPress={async () => {
                            hapticPress();
                            try {
                                const { apiGet } = require('../../services/api');
                                const response = await apiGet('/api/offres-emploi/matching/offres?min_score=60&limit=10');
                                if (response.success && response.data && response.data.length > 0) {
                                    (navigation as any).navigate('OffreList', {
                                        offres: response.data,
                                        title: 'Offres recommandées pour vous',
                                    });
                                } else {
                                    Alert.alert(
                                        'Aucune suggestion',
                                        'Créez votre profil candidat pour recevoir des suggestions personnalisées d\'offres.',
                                        [
                                            { text: 'Annuler' },
                                            { text: 'Créer mon profil', onPress: () => (navigation as any).navigate('ProfilCandidat') },
                                        ]
                                    );
                                }
                            } catch (err: any) {
                                console.error('[OffresEmploiHomeScreen] Erreur suggestions:', err);
                                Alert.alert(
                                    'Suggestions',
                                    'Créez votre profil candidat pour recevoir des suggestions personnalisées.',
                                    [
                                        { text: 'Annuler' },
                                        { text: 'Créer mon profil', onPress: () => (navigation as any).navigate('ProfilCandidat') },
                                    ]
                                );
                            }
                        }}
                    >
                        <SafeIcon name="sparkles" size={20} color="#6366F1" type="lucide" />
                        <Text style={styles.suggestionsButtonText}>Voir les offres recommandées</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>

            {/* Contenu : Liste des offres */}
            {loading && offres.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Recherche d'offres...</Text>
                    </View>
                ) : error && offres.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <SafeIcon name="briefcase" size={64} color="#9CA3AF" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => loadOffres(true)}
                        >
                            <Text style={styles.retryButtonText}>Réessayer</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={offres}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <OffreCard
                                offre={item}
                                onPress={() => navigation.navigate('OffreDetails' as never, { offreId: item.id } as never)}
                                onApply={() => {
                                    hapticPress();
                                    navigation.navigate('CreateCandidature' as never, { offreId: item.id } as never);
                                }}
                                formatSalary={formatSalary}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    loadOffres(false);
                                }}
                                colors={[modernColors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <SafeIcon name="briefcase" size={64} color="#9CA3AF" />
                                <Text style={styles.emptyText}>Aucune offre trouvée</Text>
                                <Text style={styles.emptySubtext}>
                                    Essayez de modifier vos critères de recherche
                                </Text>
                            </View>
                        }
                    />
                )}

            {/* Modal IA */}
            {showAIModal && (
                <AIModal
                    visible={showAIModal}
                    onClose={() => {
                        setShowAIModal(false);
                        setAiMode(null);
                        setCvAnalysis(null);
                        setSalaryPrediction(null);
                        setFormations([]);
                    }}
                    mode={aiMode}
                    cvAnalysis={cvAnalysis}
                    salaryPrediction={salaryPrediction}
                    formations={formations}
                    loading={loadingAI}
                />
            )}
        </SafeNativeView>
    );
};

// Composant Card pour une offre
interface OffreCardProps {
    offre: OffreEmploi;
    onPress: () => void;
    onApply: () => void;
    formatSalary: (min?: number, max?: number, devise?: string) => string;
}

const OffreCard: React.FC<OffreCardProps> = ({ offre, onPress, onApply, formatSalary }) => {
    return (
        <TouchableOpacity style={styles.offreCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.offreHeader}>
                <View style={styles.offreHeaderLeft}>
                    <View style={styles.offreIconContainer}>
                        <SafeIcon name="briefcase" size={24} color="#6366F1" type="lucide" />
                    </View>
                    <View style={styles.offreInfo}>
                        <Text style={styles.offreTitle} numberOfLines={2}>
                            {offre.titre_poste}
                        </Text>
                        <Text style={styles.offreSecteur}>{offre.secteur}</Text>
                    </View>
                </View>
                {offre.is_verified && (
                    <View style={styles.verifiedBadge}>
                        <SafeIcon name="check-circle" size={16} color="#10B981" type="lucide" />
                    </View>
                )}
            </View>

            <Text style={styles.offreDescription} numberOfLines={3}>
                {offre.description}
            </Text>

            <View style={styles.offreMeta}>
                <View style={styles.offreMetaItem}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.offreMetaText}>{offre.lieu_travail}</Text>
                </View>
                <View style={styles.offreMetaItem}>
                    <SafeIcon name="file-text" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.offreMetaText}>{offre.type_contrat}</Text>
                </View>
                {offre.remote && (
                    <View style={styles.offreMetaItem}>
                        <SafeIcon name="wifi" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.offreMetaText}>Télétravail</Text>
                    </View>
                )}
            </View>

            <View style={styles.offreFooter}>
                <View style={styles.offreSalary}>
                    <Text style={styles.offreSalaryText}>
                        {formatSalary(offre.salaire_min as number, offre.salaire_max as number, offre.devise)}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.applyButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onApply();
                    }}
                >
                    <Text style={styles.applyButtonText}>Postuler</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

// Modal IA
interface AIModalProps {
    visible: boolean;
    onClose: () => void;
    mode: 'cv' | 'salary' | 'formations' | null;
    cvAnalysis: CVAnalysis | null;
    salaryPrediction: SalaryPrediction | null;
    formations: FormationSuggestion[];
    loading: boolean;
}

const AIModal: React.FC<AIModalProps> = ({
    visible,
    onClose,
    mode,
    cvAnalysis,
    salaryPrediction,
    formations,
    loading,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {mode === 'cv' ? 'Analyse CV IA' : mode === 'salary' ? 'Prédiction Salaire IA' : 'Suggestions Formations IA'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {loading ? (
                            <View style={styles.aiLoadingContainer}>
                                <ActivityIndicator size="large" color="#6366F1" />
                                <Text style={styles.aiLoadingText}>Analyse en cours...</Text>
                            </View>
                        ) : mode === 'cv' && cvAnalysis ? (
                            <View style={styles.analysisContainer}>
                                <Text style={styles.analysisTitle}>Score global: {cvAnalysis.score_global}/100</Text>
                                {cvAnalysis.points_forts.length > 0 && (
                                    <View style={styles.pointsContainer}>
                                        <Text style={styles.pointsTitle}>Points forts:</Text>
                                        {cvAnalysis.points_forts.map((point, i) => (
                                            <Text key={i} style={styles.pointText}>• {point}</Text>
                                        ))}
                                    </View>
                                )}
                                {cvAnalysis.suggestions_amelioration.length > 0 && (
                                    <View style={styles.suggestionsContainer}>
                                        <Text style={styles.suggestionsTitle}>Suggestions d'amélioration:</Text>
                                        {cvAnalysis.suggestions_amelioration.map((suggestion, i) => (
                                            <Text key={i} style={styles.suggestionText}>• {suggestion}</Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ) : mode === 'salary' && salaryPrediction ? (
                            <View style={styles.salaryContainer}>
                                <Text style={styles.salaryTitle}>Salaire estimé</Text>
                                <Text style={styles.salaryValue}>
                                    {salaryPrediction.salaire_estime_min.toLocaleString()} - {salaryPrediction.salaire_estime_max.toLocaleString()} {salaryPrediction.devise}
                                </Text>
                                <Text style={styles.salaryMedian}>
                                    Médiane: {salaryPrediction.salaire_estime_median.toLocaleString()} {salaryPrediction.devise}
                                </Text>
                                <Text style={styles.salaryConfidence}>
                                    Confiance: {Math.round(salaryPrediction.confidence * 100)}%
                                </Text>
                                {salaryPrediction.facteurs_influence.length > 0 && (
                                    <View style={styles.factorsContainer}>
                                        <Text style={styles.factorsTitle}>Facteurs d'influence:</Text>
                                        {salaryPrediction.facteurs_influence.map((factor, i) => (
                                            <Text key={i} style={styles.factorText}>• {factor}</Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ) : mode === 'formations' && formations.length > 0 ? (
                            <View style={styles.formationsContainer}>
                                {formations.map((formation, i) => (
                                    <View key={i} style={styles.formationCard}>
                                        <Text style={styles.formationName}>{formation.formation}</Text>
                                        <Text style={styles.formationReason}>{formation.raison}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.placeholderText}>Aucune donnée disponible</Text>
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
        backgroundColor: '#F9FAFB',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 2,
    },
    createButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    searchContainer: {
        marginTop: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearButton: {
        padding: 4,
    },
    quickActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    quickActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 8,
        gap: 4,
    },
    quickActionText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    suggestionsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginTop: 12,
        gap: 8,
    },
    suggestionsButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6366F1',
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
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#6366F1',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    // Offre Card styles
    offreCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    offreHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    offreHeaderLeft: {
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    offreIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    offreInfo: {
        flex: 1,
    },
    offreTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    offreSecteur: {
        fontSize: 14,
        color: '#6B7280',
    },
    verifiedBadge: {
        padding: 4,
    },
    offreDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 12,
    },
    offreMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
    },
    offreMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    offreMetaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    offreFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    offreSalary: {
        flex: 1,
    },
    offreSalaryText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#10B981',
    },
    applyButton: {
        backgroundColor: '#6366F1',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    applyButtonText: {
        fontSize: 14,
        fontWeight: '700',
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
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
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
    aiLoadingContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiLoadingText: {
        marginTop: 16,
        fontSize: 14,
        color: '#6B7280',
    },
    analysisContainer: {
        gap: 16,
    },
    analysisTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    pointsContainer: {
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    pointsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#065F46',
        marginBottom: 8,
    },
    pointText: {
        fontSize: 14,
        color: '#065F46',
        marginBottom: 4,
    },
    suggestionsContainer: {
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 16,
    },
    suggestionsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 8,
    },
    suggestionText: {
        fontSize: 14,
        color: '#92400E',
        marginBottom: 4,
    },
    salaryContainer: {
        gap: 16,
    },
    salaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    salaryValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#10B981',
    },
    salaryMedian: {
        fontSize: 16,
        color: '#6B7280',
    },
    salaryConfidence: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    factorsContainer: {
        marginTop: 16,
    },
    factorsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    factorText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    formationsContainer: {
        gap: 12,
    },
    formationCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
    },
    formationName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    formationReason: {
        fontSize: 14,
        color: '#6B7280',
    },
    placeholderText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        padding: 32,
    },
});

export default OffresEmploiHomeScreen;

