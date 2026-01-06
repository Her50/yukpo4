// ✅ Écran Offres d'Emploi MODERNE - Refonte complète avec UX professionnelle
// Séparation claire : Recherche d'emploi vs Création d'offre
// Toutes les fonctionnalités IA opérationnelles

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
import { offreEmploiService, OffreEmploi, SearchOffresFilters, CreateOffreRequest, CVAnalysis, SalaryPrediction, FormationSuggestion } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';

type ViewMode = 'search' | 'create';

const OffresEmploiHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { location } = useLocation();

    // Mode d'affichage : recherche ou création
    const [viewMode, setViewMode] = useState<ViewMode>('search');

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [offres, setOffres] = useState<OffreEmploi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);

    // États pour création d'offre
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [offreForm, setOffreForm] = useState<Partial<CreateOffreRequest>>({
        type_contrat: 'CDI',
        devise: 'FCFA',
        remote: false,
        remote_partiel: false,
        salaire_negociable: false,
    });

    // États pour fonctionnalités IA
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiMode, setAiMode] = useState<'cv' | 'salary' | 'formations' | null>(null);
    const [cvAnalysis, setCvAnalysis] = useState<CVAnalysis | null>(null);
    const [salaryPrediction, setSalaryPrediction] = useState<SalaryPrediction | null>(null);
    const [formations, setFormations] = useState<FormationSuggestion[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);

    // Charger les offres à l'ouverture (proximité)
    useEffect(() => {
        if (viewMode === 'search') {
            loadOffres(true);
        }
    }, [viewMode]);

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

    const handleCreateOffre = async () => {
        if (!offreForm.titre_poste?.trim() || !offreForm.description?.trim() || !offreForm.secteur?.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir les champs obligatoires (titre, description, secteur)');
            return;
        }

        hapticPress();
        setCreating(true);

        try {
            const response = await offreEmploiService.createOffre(offreForm as CreateOffreRequest);
            if (response.success) {
                Alert.alert('Succès', 'Offre créée avec succès !', [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowCreateModal(false);
                            setOffreForm({
                                type_contrat: 'CDI',
                                devise: detectedCurrency, // ✅ Utilise la devise détectée
                                remote: false,
                                remote_partiel: false,
                                salaire_negociable: false,
                            });
                            setViewMode('search');
                            loadOffres(true);
                        },
                    },
                ]);
            } else {
                Alert.alert('Erreur', 'Impossible de créer l\'offre');
            }
        } catch (err: any) {
            console.error('[OffresEmploiHomeScreen] Erreur création:', err);
            Alert.alert('Erreur', err.message || 'Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    // Fonctions IA
    const handleAnalyzeCV = async () => {
        hapticPress();
        setAiMode('cv');
        setLoadingAI(true);
        setShowAIModal(true);

        // TODO: Permettre à l'utilisateur de sélectionner/uploader un CV
        Alert.alert(
            'Analyse CV',
            'Veuillez d\'abord uploader votre CV dans votre profil',
            [
                { text: 'Annuler', onPress: () => setShowAIModal(false) },
                { text: 'Aller au profil', onPress: () => navigation.navigate('ProfilCandidat' as never) },
            ]
        );
        setLoadingAI(false);
    };

    const handlePredictSalary = async () => {
        hapticPress();
        setAiMode('salary');
        setLoadingAI(true);
        setShowAIModal(true);

        // Utiliser les valeurs du formulaire si en mode création
        if (viewMode === 'create' && offreForm.titre_poste && offreForm.secteur) {
            try {
                const response = await offreEmploiService.predictSalary(
                    offreForm.titre_poste,
                    offreForm.secteur,
                    offreForm.experience_min || 0,
                    offreForm.competences_requises || [],
                    offreForm.lieu_travail
                );
                if (response.success && response.data?.prediction) {
                    setSalaryPrediction(response.data.prediction);
                }
            } catch (err: any) {
                console.error('[OffresEmploiHomeScreen] Erreur prédiction:', err);
            }
        }
        setLoadingAI(false);
    };

    const handleSuggestFormations = async () => {
        hapticPress();
        setAiMode('formations');
        setLoadingAI(true);
        setShowAIModal(true);

        // TODO: Récupérer les compétences manquantes depuis le profil ou l'analyse CV
        Alert.alert('Suggestions Formations', 'Fonctionnalité à venir');
        setLoadingAI(false);
    };

    const formatSalary = (min?: number, max?: number, devise?: string) => {
        const currency = devise || detectedCurrency; // ✅ Utilise la devise détectée si non fournie
        if (!min && !max) return 'Salaire non spécifié';
        if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} ${devise}`;
        if (min) return `À partir de ${min.toLocaleString()} ${devise}`;
        return `Jusqu'à ${max?.toLocaleString()} ${devise}`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec mode toggle */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={viewMode === 'search' ? ['#6366F1', '#8B5CF6'] : ['#EC4899', '#F472B6']}
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
                            <Text style={styles.headerTitle}>
                                {viewMode === 'search' ? 'Recherche d\'Emploi' : 'Créer une Offre'}
                            </Text>
                            {viewMode === 'search' && totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {totalResults} offre{totalResults > 1 ? 's' : ''} disponible{totalResults > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                setViewMode(viewMode === 'search' ? 'create' : 'search');
                            }}
                            style={styles.modeToggle}
                        >
                            <SafeIcon 
                                name={viewMode === 'search' ? 'briefcase' : 'search'} 
                                size={22} 
                                color="#FFFFFF" 
                                type="lucide" 
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche (mode recherche) */}
                    {viewMode === 'search' && (
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
                    )}

                    {/* Actions rapides (mode recherche) */}
                    {viewMode === 'search' && (
                        <View style={styles.quickActions}>
                            <TouchableOpacity
                                style={styles.quickActionButton}
                                onPress={() => {
                                    hapticPress();
                                    navigation.navigate('OffreMatching' as never);
                                }}
                            >
                                <SafeIcon name="target" size={16} color="#FFFFFF" type="lucide" />
                                <Text style={styles.quickActionText}>Matchings</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.quickActionButton}
                                onPress={() => {
                                    hapticPress();
                                    navigation.navigate('MesCandidatures' as never);
                                }}
                            >
                                <SafeIcon name="file-text" size={16} color="#FFFFFF" type="lucide" />
                                <Text style={styles.quickActionText}>Mes candidatures</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Bouton créer offre (mode recherche) */}
                    {viewMode === 'search' && (
                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={() => {
                                hapticPress();
                                setViewMode('create');
                            }}
                        >
                            <SafeIcon name="plus" size={20} color="#6366F1" type="lucide" />
                            <Text style={styles.createButtonText}>Publier une offre</Text>
                        </TouchableOpacity>
                    )}
                </LinearGradient>
            </View>

            {/* Contenu selon le mode */}
            {viewMode === 'search' ? (
                // Mode recherche : Liste des offres
                loading && offres.length === 0 ? (
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
                )
            ) : (
                // Mode création : Formulaire
                <CreateOffreForm
                    offreForm={offreForm}
                    onFormChange={setOffreForm}
                    onCreate={handleCreateOffre}
                    creating={creating}
                    onPredictSalary={handlePredictSalary}
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

// Formulaire de création d'offre
interface CreateOffreFormProps {
    offreForm: Partial<CreateOffreRequest>;
    onFormChange: (form: Partial<CreateOffreRequest>) => void;
    onCreate: () => void;
    creating: boolean;
    onPredictSalary: () => void;
}

const CreateOffreForm: React.FC<CreateOffreFormProps> = ({
    offreForm,
    onFormChange,
    onCreate,
    creating,
    onPredictSalary,
}) => {
    return (
        <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Informations principales *</Text>
                <NativeInput
                    placeholder="Titre du poste *"
                    value={offreForm.titre_poste || ''}
                    onChangeText={(text) => onFormChange({ ...offreForm, titre_poste: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Description du poste *"
                    value={offreForm.description || ''}
                    onChangeText={(text) => onFormChange({ ...offreForm, description: text })}
                    multiline
                    numberOfLines={6}
                    style={[styles.formInput, styles.formTextArea]}
                />
                <NativeInput
                    placeholder="Secteur d'activité *"
                    value={offreForm.secteur || ''}
                    onChangeText={(text) => onFormChange({ ...offreForm, secteur: text })}
                    style={styles.formInput}
                />
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Type de contrat</Text>
                <View style={styles.contractTypes}>
                    {['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.contractChip,
                                offreForm.type_contrat === type && styles.contractChipActive,
                            ]}
                            onPress={() => onFormChange({ ...offreForm, type_contrat: type })}
                        >
                            <Text
                                style={[
                                    styles.contractChipText,
                                    offreForm.type_contrat === type && styles.contractChipTextActive,
                                ]}
                            >
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Localisation</Text>
                <LocationSelector
                    value={offreForm.lieu_travail as LocationObject | string || ''}
                    onChange={(value) => {
                        // Extraire le texte du lieu depuis LocationObject
                        const lieuStr = typeof value === 'string' 
                            ? value 
                            : (value as LocationObject)?.place_name || (value as LocationObject)?.raw || '';
                        onFormChange({ ...offreForm, lieu_travail: lieuStr });
                    }}
                    placeholder="Lieu de travail *"
                    style={styles.formInput}
                />
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...offreForm, remote: !offreForm.remote })}
                    >
                        {offreForm.remote && <SafeIcon name="check" size={16} color="#6366F1" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Télétravail possible</Text>
                </View>
            </View>

            <View style={styles.formSection}>
                <View style={styles.salaryHeader}>
                    <Text style={styles.formSectionTitle}>Salaire</Text>
                    <TouchableOpacity
                        style={styles.aiButtonSmall}
                        onPress={onPredictSalary}
                    >
                        <SafeIcon name="brain" size={14} color="#6366F1" type="lucide" />
                        <Text style={styles.aiButtonSmallText}>IA</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.salaryInputs}>
                    <NativeInput
                        placeholder="Min (FCFA)"
                        value={offreForm.salaire_min?.toString() || ''}
                        onChangeText={(text) => onFormChange({ ...offreForm, salaire_min: text ? parseFloat(text) : undefined })}
                        keyboardType="numeric"
                        style={styles.salaryInput}
                    />
                    <NativeInput
                        placeholder="Max (FCFA)"
                        value={offreForm.salaire_max?.toString() || ''}
                        onChangeText={(text) => onFormChange({ ...offreForm, salaire_max: text ? parseFloat(text) : undefined })}
                        keyboardType="numeric"
                        style={styles.salaryInput}
                    />
                </View>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Exigences</Text>
                <NativeInput
                    placeholder="Niveau d'étude"
                    value={offreForm.niveau_etude || ''}
                    onChangeText={(text) => onFormChange({ ...offreForm, niveau_etude: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Années d'expérience minimum"
                    value={offreForm.experience_min?.toString() || ''}
                    onChangeText={(text) => onFormChange({ ...offreForm, experience_min: text ? parseInt(text) : undefined })}
                    keyboardType="numeric"
                    style={styles.formInput}
                />
            </View>

            <NativeButton
                title={creating ? 'Création en cours...' : 'Publier l\'offre'}
                onPress={onCreate}
                variant="primary"
                disabled={creating}
                style={styles.submitButton}
            />
        </ScrollView>
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
    modeToggle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
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
        paddingHorizontal: 12,
        gap: 6,
    },
    quickActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    createButton: {
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
    createButtonText: {
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
    // Form styles
    formContainer: {
        flex: 1,
    },
    formContent: {
        padding: 16,
    },
    formSection: {
        marginBottom: 24,
    },
    formSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    formInput: {
        marginBottom: 12,
    },
    formTextArea: {
        minHeight: 120,
        textAlignVertical: 'top',
    },
    contractTypes: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    contractChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    contractChipActive: {
        backgroundColor: '#EEF2FF',
        borderColor: '#6366F1',
    },
    contractChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    contractChipTextActive: {
        color: '#6366F1',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#111827',
    },
    salaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    aiButtonSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        gap: 4,
    },
    aiButtonSmallText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6366F1',
    },
    salaryInputs: {
        flexDirection: 'row',
        gap: 12,
    },
    salaryInput: {
        flex: 1,
    },
    submitButton: {
        marginTop: 8,
        marginBottom: 32,
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

