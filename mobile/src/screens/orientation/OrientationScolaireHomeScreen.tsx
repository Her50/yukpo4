// ✅ Écran Orientation Scolaire MODERNE - Refonte complète avec UX intuitive
// Structure claire avec onglets : Établissements, Programmes, Concours, Conférences, Fournitures
// Toutes les fonctionnalités IA opérationnelles

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useToaster } from '../../components/ToasterProvider';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useAIWithFallback } from '../../hooks/useAIWithFallback';
import { ConcoursEntree, ConferenceLive, EtablissementScolaire, FournituresScolaires, orientationScolaireService, ProgrammeScolaire, ProgramRecommendation, StudentProfileAnalysis } from '../../services/orientationScolaireService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

type TabType = 'etablissements' | 'programmes' | 'concours' | 'conferences' | 'fournitures';

const OrientationScolaireHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const { callWithFallback } = useAIWithFallback();
    const toaster = useToaster();

    // Onglet actif
    const [activeTab, setActiveTab] = useState<TabType>('etablissements');

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // États pour établissements
    const [etablissements, setEtablissements] = useState<EtablissementScolaire[]>([]);
    const [totalEtablissements, setTotalEtablissements] = useState(0);
    const [selectedType, setSelectedType] = useState<string>('');

    // États pour programmes
    const [programmes, setProgrammes] = useState<ProgrammeScolaire[]>([]);

    // États pour concours
    const [concours, setConcours] = useState<ConcoursEntree[]>([]);

    // États pour conférences
    const [conferences, setConferences] = useState<ConferenceLive[]>([]);

    // États pour fournitures
    const [fournitures, setFournitures] = useState<FournituresScolaires[]>([]);

    // États IA
    const [showAIModal, setShowAIModal] = useState(false);
    const [aiMode, setAiMode] = useState<'analyze' | 'recommendations' | 'compare' | 'academic' | null>(null);
    const [profileAnalysis, setProfileAnalysis] = useState<StudentProfileAnalysis | null>(null);
    const [recommendations, setRecommendations] = useState<ProgramRecommendation[]>([]);
    const [loadingAI, setLoadingAI] = useState(false);
    const [hasProfile, setHasProfile] = useState(false);
    const [profileId, setProfileId] = useState<number | null>(null);
    // ✅ NOUVEAU: États pour recherche académique IA
    const [academicQuery, setAcademicQuery] = useState('');
    const [academicResponse, setAcademicResponse] = useState<string | null>(null);

    // Charger les données selon l'onglet actif
    useEffect(() => {
        loadDataForTab(activeTab, true);
        checkProfile();
    }, [activeTab]);

    const checkProfile = async () => {
        try {
            const response = await orientationScolaireService.getMyProfile();
            if (response.success && response.data?.profile) {
                setHasProfile(true);
                setProfileId(response.data.profile.id);
            }
        } catch (err) {
            setHasProfile(false);
        }
    };

    const loadDataForTab = useCallback(async (tab: TabType, initialLoad: boolean = false) => {
        try {
            if (initialLoad) {
                setLoading(true);
                setError(null);
            }

            switch (tab) {
                case 'etablissements':
                    await loadEtablissements();
                    break;
                case 'programmes':
                    await loadProgrammes();
                    break;
                case 'concours':
                    await loadConcours();
                    break;
                case 'conferences':
                    await loadConferences();
                    break;
                case 'fournitures':
                    await loadFournitures();
                    break;
            }
        } catch (err: any) {
            console.error('[OrientationScolaireHomeScreen] Erreur:', err);
            setError(err.message || 'Erreur lors du chargement');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [location, searchQuery, selectedType]);

    const loadEtablissements = async () => {
        const filters: any = {
            limit: 20,
            page: 1,
        };

        if (selectedType) filters.type_etablissement = selectedType;
        // ✅ NOUVEAU: Recherche par nom d'établissement ou formation spécifique
        if (searchQuery.trim()) {
            filters.search = searchQuery.trim();
        }
        if (location?.coords) {
            filters.gps_lat = location.coords.latitude;
            filters.gps_lon = location.coords.longitude;
            filters.rayon_km = 50;
        }

        // ✅ NOUVEAU: Rechercher uniquement dans les partenaires établissementscolaire
        filters.partner_type = 'etablissementscolaire';

        const response = await orientationScolaireService.searchEtablissements(filters);
        if (response.success && response.data?.data) {
            setEtablissements(response.data.data);
            setTotalEtablissements(response.data.pagination?.total || 0);
        }
    };

    const loadProgrammes = async () => {
        const response = await orientationScolaireService.searchProgrammes(undefined, undefined, undefined, undefined, undefined, 1, 20);
        if (response.success && response.data?.data) {
            setProgrammes(response.data.data);
        }
    };

    const loadConcours = async () => {
        const response = await orientationScolaireService.listConcoursActifs();
        if (response.success && response.data?.data) {
            setConcours(response.data.data);
        }
    };

    const loadConferences = async () => {
        const response = await orientationScolaireService.listConferencesProgrammees();
        if (response.success && response.data?.data) {
            setConferences(response.data.data);
        }
    };

    const loadFournitures = async () => {
        const response = await orientationScolaireService.searchFournitures(undefined, undefined, undefined, undefined, undefined, 1, 20);
        if (response.success && response.data?.data) {
            setFournitures(response.data.data);
        }
    };

    const handleSearch = () => {
        hapticPress();
        loadDataForTab(activeTab, false);
    };

    // Fonctions IA
    const handleAnalyzeProfile = async () => {
        if (!hasProfile || !profileId) {
            Alert.alert(t('orientation.profileRequired'), t('orientation.createProfileFirst'), [
                { text: t('message.cancel') },
                { text: t('orientation.createMyProfile'), onPress: () => navigation.navigate('ProfilEtudiant' as never) },
            ]);
            return;
        }

        setLoadingAI(true);
        try {
            const response = await orientationScolaireService.analyzeProfile(profileId);
            if (response.success && response.data?.analysis) {
                setProfileAnalysis(response.data.analysis);
            } else {
                Alert.alert(t('message.error'), t('orientation.cannotAnalyzeProfile'));
            }
        } catch (err: any) {
            console.error('[OrientationScolaireHomeScreen] Erreur analyse:', err);
            Alert.alert(t('message.error'), err.message || t('orientation.analysisError'));
        } finally {
            setLoadingAI(false);
        }
    };

    const handleGetRecommendations = async () => {
        if (!hasProfile || !profileId) {
            Alert.alert(t('orientation.profileRequired'), t('orientation.createProfileFirst'), [
                { text: t('message.cancel') },
                { text: t('orientation.createMyProfile'), onPress: () => navigation.navigate('ProfilEtudiant' as never) },
            ]);
            return;
        }

        setLoadingAI(true);
        try {
            const response = await orientationScolaireService.getRecommendations(
                profileId,
                selectedType || 'superieur',
                undefined,
                undefined,
                undefined,
                undefined
            );
            if (response.success) {
                // Le service convertit déjà le single recommendation en array
                const recs = (response.data as any)?.recommendations || [];
                setRecommendations(recs);
            } else {
                Alert.alert(t('message.error'), t('orientation.cannotGetRecommendations'));
            }
        } catch (err: any) {
            console.error('[OrientationScolaireHomeScreen] Erreur recommandations:', err);
            Alert.alert(t('message.error'), err.message || t('orientation.searchError'));
        } finally {
            setLoadingAI(false);
        }
    };

    // ✅ REFONDU: Recherche académique IA avec fallback 3 niveaux
    const handleAcademicSearch = async () => {
        if (!academicQuery.trim()) {
            Alert.alert(t('message.error'), t('orientation.enterQuestion'));
            return;
        }

        hapticPress();
        setLoadingAI(true);

        const result = await callWithFallback(
            async () => {
                const { apiPost } = require('../../services/api');
                const response = await apiPost('/api/orientation/ai/academic-search', {
                    query: academicQuery.trim(),
                    context: { service: 'orientation_scolaire', domain: 'education' },
                });
                if (response?.success) {
                    return response.response || response.data?.response || response.data?.message || null;
                }
                return null;
            },
            'orientation_academic',
            `Recherche académique: ${academicQuery.trim()}`,
            () => {
                const q = academicQuery.trim().toLowerCase();
                if (q.includes('bourse') || q.includes('scholarship')) {
                    return 'Les bourses disponibles au Cameroun incluent: Bourses d\'excellence du MINESUP, Bourses de la coopération française (Campus France), Bourses DAAD (Allemagne), Bourses Commonwealth. Consultez votre établissement pour les détails.';
                }
                if (q.includes('concours') || q.includes('admission')) {
                    return 'Les principaux concours au Cameroun: ENAM, ENSP, ENS, École Polytechnique, FMSB, IUT. Les inscriptions ouvrent généralement entre mars et juin. Vérifiez les dates sur le site du MINESUP.';
                }
                if (q.includes('université') || q.includes('faculté')) {
                    return 'Le Cameroun compte 8 universités d\'\u00c9tat (Yaoundé I & II, Douala, Dschang, Buea, Bamenda, Maroua, Ngaoundéré) et de nombreuses universités privées. Choisissez en fonction de la filière souhaitée.';
                }
                return 'Pour des conseils personnalisés en orientation scolaire, créez votre profil étudiant et consultez les recommandations IA. Vous pouvez aussi contacter un conseiller d\'orientation.';
            }
        );

        if (result.success && result.data) {
            setAcademicResponse(result.data);
            if (result.source === 'local') {
                toaster?.show?.(t('orientationScolaire.responseLocalData'), 'info');
            }
        } else {
            setAcademicResponse('Consultez un conseiller d\'orientation pour des conseils personnalisés.');
            toaster?.show?.(t('orientationScolaire.aiTemporarilyUnavailable'), 'error');
        }
        setLoadingAI(false);
    };

    const formatDistance = (distance?: number) => {
        if (!distance) return '';
        if (distance < 1) return `${Math.round(distance * 1000)}m`;
        return `${distance.toFixed(1)} km`;
    };

    const tabs: Array<{ id: TabType; label: string; icon: string }> = [
        { id: 'etablissements', label: 'Établissements', icon: 'school' },
        { id: 'programmes', label: 'Programmes', icon: 'book-open' },
        { id: 'concours', label: 'Concours', icon: 'trophy' },
        { id: 'conferences', label: 'Conférences', icon: 'video' },
        { id: 'fournitures', label: 'Fournitures', icon: 'shopping-bag' },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#8B5CF6', '#A78BFA']}
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
                            <Text style={styles.headerTitle}>Orientation Scolaire</Text>
                            <Text style={styles.headerSubtitle}>
                                {activeTab === 'etablissements' && totalEtablissements > 0 && (
                                    `${totalEtablissements} établissement${totalEtablissements > 1 ? 's' : ''}`
                                )}
                            </Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                onPress={() => {
                                    hapticPress();
                                    if (hasProfile) {
                                        handleGetRecommendations();
                                    } else {
                                        Alert.alert(t('orientation.profileRequired'), t('orientation.createProfileForAI'), [
                                            { text: t('message.cancel') },
                                            { text: t('orientation.createMyProfile'), onPress: () => navigation.navigate('ProfilEtudiant' as never) },
                                        ]);
                                    }
                                }}
                                style={styles.aiButton}
                            >
                                <SafeIcon name="sparkles" size={22} color="#FFFFFF" type="lucide" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Barre de recherche */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={`Rechercher ${activeTab === 'etablissements' ? 'un établissement' : activeTab === 'programmes' ? 'un programme' : activeTab === 'concours' ? 'un concours' : activeTab === 'conferences' ? 'une conférence' : 'des fournitures'}...`}
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
                            {/* ✅ CORRIGÉ: Bouton de recherche à droite */}
                            <TouchableOpacity
                                style={styles.searchButton}
                                onPress={handleSearch}
                                disabled={loading}
                                activeOpacity={0.7}
                            >
                                <SafeIcon
                                    name="search"
                                    size={18}
                                    color={loading ? "#9CA3AF" : "#8B5CF6"}
                                    type="lucide"
                                />
                            </TouchableOpacity>
                        </View>
                        {/* ✅ NOUVEAU: Bouton recherche académique IA */}
                        <TouchableOpacity
                            style={[
                                styles.aiSearchButton,
                                loading && styles.aiSearchButtonDisabled
                            ]}
                            onPress={() => {
                                hapticPress();
                                setShowAIModal(true);
                                setAiMode('academic');
                                setAcademicQuery('');
                                setAcademicResponse(null);
                            }}
                            disabled={loading}
                            activeOpacity={0.7}
                        >
                            <SafeIcon
                                name="brain"
                                size={18}
                                color={loading ? "#9CA3AF" : "#8B5CF6"}
                                type="lucide"
                            />
                            <Text style={[
                                styles.aiSearchButtonText,
                                loading && styles.aiSearchButtonTextDisabled
                            ]}>
                                Recherche académique IA
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Filtres rapides (établissements) */}
                    {activeTab === 'etablissements' && (
                        <View style={styles.quickFilters}>
                            {['primaire', 'secondaire', 'superieur'].map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.filterChip,
                                        selectedType === type && styles.filterChipActive,
                                    ]}
                                    onPress={() => {
                                        hapticPress();
                                        setSelectedType(selectedType === type ? '' : type);
                                        loadEtablissements();
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            selectedType === type && styles.filterChipTextActive,
                                        ]}
                                    >
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </LinearGradient>
            </View>

            {/* Onglets */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[
                                styles.tab,
                                activeTab === tab.id && styles.tabActive,
                            ]}
                            onPress={() => {
                                hapticPress();
                                setActiveTab(tab.id);
                            }}
                        >
                            <SafeIcon
                                name={tab.icon}
                                size={18}
                                color={activeTab === tab.id ? '#8B5CF6' : '#6B7280'}
                                type="lucide"
                            />
                            <Text
                                style={[
                                    styles.tabLabel,
                                    activeTab === tab.id && styles.tabLabelActive,
                                ]}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Contenu selon l'onglet */}
            {loading && (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            )}

            {!loading && activeTab === 'etablissements' && (
                <FlatList
                    data={etablissements}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <EtablissementCard
                            etablissement={item}
                            onPress={() => navigation.navigate('EtablissementDetails' as never, { etablissementId: item.id } as never)}
                            formatDistance={formatDistance}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadDataForTab(activeTab, false);
                            }}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="school" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucun établissement trouvé</Text>
                        </View>
                    }
                />
            )}

            {!loading && activeTab === 'programmes' && (
                <FlatList
                    data={programmes}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <ProgrammeCard
                            programme={item}
                            onPress={() => navigation.navigate('ProgrammesList' as never)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadDataForTab(activeTab, false);
                            }}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="book-open" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucun programme trouvé</Text>
                        </View>
                    }
                />
            )}

            {!loading && activeTab === 'concours' && (
                <FlatList
                    data={concours}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <ConcoursCard
                            concours={item}
                            onPress={() => navigation.navigate('ConcoursList' as never)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadDataForTab(activeTab, false);
                            }}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="trophy" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucun concours actif</Text>
                        </View>
                    }
                />
            )}

            {!loading && activeTab === 'conferences' && (
                <FlatList
                    data={conferences}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <ConferenceCard
                            conference={item}
                            onPress={() => navigation.navigate('ConferencesList' as never)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadDataForTab(activeTab, false);
                            }}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="video" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucune conférence programmée</Text>
                        </View>
                    }
                />
            )}

            {!loading && activeTab === 'fournitures' && (
                <FlatList
                    data={fournitures}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <FournituresCard
                            fournitures={item}
                            onPress={() => navigation.navigate('FournituresList' as never)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadDataForTab(activeTab, false);
                            }}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="shopping-bag" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>Aucune fourniture trouvée</Text>
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
                        setProfileAnalysis(null);
                        setRecommendations([]);
                        setAcademicQuery('');
                        setAcademicResponse(null);
                    }}
                    mode={aiMode}
                    profileAnalysis={profileAnalysis}
                    recommendations={recommendations}
                    loading={loadingAI}
                    hasProfile={hasProfile}
                    onCreateProfile={() => navigation.navigate('ProfilEtudiant' as never)}
                    // ✅ NOUVEAU: Props pour recherche académique
                    academicQuery={academicQuery}
                    academicResponse={academicResponse}
                    onAcademicQueryChange={setAcademicQuery}
                    onAcademicSearch={handleAcademicSearch}
                />
            )}
        </SafeNativeView>
    );
};

// Composants Cards
interface EtablissementCardProps {
    etablissement: EtablissementScolaire;
    onPress: () => void;
    formatDistance: (distance?: number) => string;
}

const EtablissementCard: React.FC<EtablissementCardProps> = ({ etablissement, onPress, formatDistance }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                    <SafeIcon name="school" size={24} color="#8B5CF6" type="lucide" />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {etablissement.nom_etablissement}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                        {etablissement.type_etablissement.charAt(0).toUpperCase() + etablissement.type_etablissement.slice(1)}
                    </Text>
                </View>
                {etablissement.is_verified && (
                    <View style={styles.verifiedBadge}>
                        <SafeIcon name="check-circle" size={16} color="#10B981" type="lucide" />
                    </View>
                )}
            </View>
            <View style={styles.cardMeta}>
                <View style={styles.cardMetaItem}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.cardMetaText}>
                        {etablissement.quartier && `${etablissement.quartier}, `}
                        {etablissement.ville}
                    </Text>
                </View>
                {etablissement.distance_km && (
                    <Text style={styles.cardDistance}>
                        {formatDistance(etablissement.distance_km)}
                    </Text>
                )}
            </View>
            {etablissement.filieres.length > 0 && (
                <View style={styles.filieresContainer}>
                    {etablissement.filieres.slice(0, 3).map((filiere, i) => (
                        <View key={i} style={styles.filiereChip}>
                            <Text style={styles.filiereChipText}>{filiere}</Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
};

interface ProgrammeCardProps {
    programme: ProgrammeScolaire;
    onPress: () => void;
}

const ProgrammeCard: React.FC<ProgrammeCardProps> = ({ programme, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                    <SafeIcon name="book-open" size={24} color="#3B82F6" type="lucide" />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {programme.titre}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                        {programme.niveau} {programme.classe && `- ${programme.classe}`}
                    </Text>
                </View>
            </View>
            {programme.filiere && (
                <View style={styles.cardMeta}>
                    <Text style={styles.cardMetaText}>{programme.filiere}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

interface ConcoursCardProps {
    concours: ConcoursEntree;
    onPress: () => void;
}

const ConcoursCard: React.FC<ConcoursCardProps> = ({ concours, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                    <SafeIcon name="trophy" size={24} color="#F59E0B" type="lucide" />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {concours.titre}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                        {new Date(concours.date_concours).toLocaleDateString('fr-FR')}
                    </Text>
                </View>
            </View>
            {concours.lieu && (
                <View style={styles.cardMeta}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.cardMetaText}>{concours.lieu}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

interface ConferenceCardProps {
    conference: ConferenceLive;
    onPress: () => void;
}

const ConferenceCard: React.FC<ConferenceCardProps> = ({ conference, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                    <SafeIcon name="video" size={24} color="#EC4899" type="lucide" />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {conference.titre}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                        {new Date(conference.date_debut).toLocaleDateString('fr-FR')}
                    </Text>
                </View>
            </View>
            {conference.nombre_participants > 0 && (
                <View style={styles.cardMeta}>
                    <SafeIcon name="users" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.cardMetaText}>
                        {conference.nombre_participants} participant{conference.nombre_participants > 1 ? 's' : ''}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

interface FournituresCardProps {
    fournitures: FournituresScolaires;
    onPress: () => void;
}

const FournituresCard: React.FC<FournituresCardProps> = ({ fournitures, onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                    <SafeIcon name="shopping-bag" size={24} color="#10B981" type="lucide" />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        Fournitures {fournitures.niveau}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                        {fournitures.classe && `${fournitures.classe} - `}
                        {fournitures.annee_scolaire}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// Modal IA
interface AIModalProps {
    visible: boolean;
    onClose: () => void;
    mode: 'analyze' | 'recommendations' | 'compare' | 'academic' | null;
    profileAnalysis: StudentProfileAnalysis | null;
    recommendations: ProgramRecommendation[];
    loading: boolean;
    hasProfile: boolean;
    onCreateProfile: () => void;
    // ✅ NOUVEAU: Props pour recherche académique
    academicQuery?: string;
    academicResponse?: string | null;
    onAcademicQueryChange?: (query: string) => void;
    onAcademicSearch?: () => void;
}

const AIModal: React.FC<AIModalProps> = ({
    visible,
    onClose,
    mode,
    profileAnalysis,
    recommendations,
    loading,
    hasProfile,
    onCreateProfile,
    academicQuery = '',
    academicResponse = null,
    onAcademicQueryChange,
    onAcademicSearch,
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
                            {mode === 'analyze' ? 'Analyse de Profil IA' : mode === 'recommendations' ? 'Recommandations IA' : 'Comparaison IA'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {/* ✅ NOUVEAU: Mode recherche académique */}
                        {mode === 'academic' ? (
                            <View style={styles.academicContainer}>
                                <Text style={styles.academicTitle}>Recherche Académique IA</Text>
                                <Text style={styles.academicSubtitle}>
                                    Posez vos questions sur les cours, programmes, examens, etc.
                                </Text>
                                <TextInput
                                    style={styles.academicInput}
                                    placeholder="Ex: Comment réussir l'examen de mathématiques en terminale ?"
                                    placeholderTextColor="#9CA3AF"
                                    value={academicQuery}
                                    onChangeText={onAcademicQueryChange}
                                    multiline
                                    numberOfLines={4}
                                />
                                <TouchableOpacity
                                    style={styles.academicSearchButton}
                                    onPress={onAcademicSearch}
                                    disabled={loading || !academicQuery.trim()}
                                >
                                    <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                                    <Text style={styles.academicSearchButtonText}>
                                        {loading ? 'Recherche...' : 'Rechercher'}
                                    </Text>
                                </TouchableOpacity>
                                {academicResponse && (
                                    <View style={styles.academicResponseContainer}>
                                        <Text style={styles.academicResponseTitle}>Réponse IA :</Text>
                                        <Text style={styles.academicResponseText}>{academicResponse}</Text>
                                    </View>
                                )}
                            </View>
                        ) : !hasProfile ? (
                            <View style={styles.noProfileContainer}>
                                <SafeIcon name="user" size={64} color="#9CA3AF" />
                                <Text style={styles.noProfileText}>
                                    Créez votre profil étudiant pour utiliser les fonctionnalités IA
                                </Text>
                                <TouchableOpacity
                                    style={styles.createProfileButton}
                                    onPress={onCreateProfile}
                                >
                                    <Text style={styles.createProfileButtonText}>Créer mon profil</Text>
                                </TouchableOpacity>
                            </View>
                        ) : loading ? (
                            <View style={styles.aiLoadingContainer}>
                                <ActivityIndicator size="large" color="#8B5CF6" />
                                <Text style={styles.aiLoadingText}>Analyse en cours...</Text>
                            </View>
                        ) : mode === 'analyze' && profileAnalysis ? (
                            <View style={styles.analysisContainer}>
                                <View style={styles.scoreContainer}>
                                    <View style={styles.scoreItem}>
                                        <Text style={styles.scoreLabel}>Score académique</Text>
                                        <Text style={styles.scoreValue}>{profileAnalysis.score_academique.toFixed(1)}/100</Text>
                                    </View>
                                    <View style={styles.scoreItem}>
                                        <Text style={styles.scoreLabel}>Score intérêts</Text>
                                        <Text style={styles.scoreValue}>{profileAnalysis.score_interets.toFixed(1)}/100</Text>
                                    </View>
                                </View>
                                {profileAnalysis.points_forts.length > 0 && (
                                    <View style={styles.pointsContainer}>
                                        <Text style={styles.pointsTitle}>Points forts:</Text>
                                        {profileAnalysis.points_forts.map((point, i) => (
                                            <Text key={i} style={styles.pointText}>• {point}</Text>
                                        ))}
                                    </View>
                                )}
                                {profileAnalysis.filieres_suggestees.length > 0 && (
                                    <View style={styles.suggestionsContainer}>
                                        <Text style={styles.suggestionsTitle}>Filières suggérées:</Text>
                                        {profileAnalysis.filieres_suggestees.map((filiere, i) => (
                                            <Text key={i} style={styles.suggestionText}>• {filiere}</Text>
                                        ))}
                                    </View>
                                )}
                                <View style={styles.recommendationsContainer}>
                                    <Text style={styles.recommendationsTitle}>Recommandations:</Text>
                                    <Text style={styles.recommendationsText}>{profileAnalysis.recommendations}</Text>
                                </View>
                            </View>
                        ) : mode === 'recommendations' && recommendations.length > 0 ? (
                            <View style={styles.recommendationsListContainer}>
                                {recommendations.map((rec, i) => (
                                    <View key={i} style={styles.recommendationCard}>
                                        <Text style={styles.recommendationTitle}>{rec.filiere}</Text>
                                        <Text style={styles.recommendationScore}>
                                            Score: {rec.score_total.toFixed(1)}/100
                                        </Text>
                                        <Text style={styles.recommendationReasoning}>{rec.reasoning}</Text>
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
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    createButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiSearchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginTop: 8,
        gap: 8,
    },
    aiSearchButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B5CF6',
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
    searchButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiSearchButtonDisabled: {
        opacity: 0.5,
    },
    aiSearchButtonTextDisabled: {
        color: '#9CA3AF',
    },
    quickFilters: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    filterChipActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    filterChipTextActive: {
        color: '#8B5CF6',
    },
    tabsContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabsScroll: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
        gap: 6,
    },
    tabActive: {
        backgroundColor: '#EEF2FF',
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabLabelActive: {
        color: '#8B5CF6',
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
    // Card styles
    card: {
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
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    cardIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardInfo: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    verifiedBadge: {
        padding: 4,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    cardMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardMetaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    cardDistance: {
        fontSize: 12,
        color: '#9CA3AF',
        marginLeft: 'auto',
    },
    filieresContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    filiereChip: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    filiereChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
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
    noProfileContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noProfileText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    createProfileButton: {
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    createProfileButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
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
        gap: 20,
    },
    scoreContainer: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    scoreItem: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    scoreLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#8B5CF6',
    },
    pointsContainer: {
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        padding: 16,
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
    recommendationsContainer: {
        backgroundColor: '#E0E7FF',
        borderRadius: 12,
        padding: 16,
    },
    recommendationsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4F46E5',
        marginBottom: 8,
    },
    recommendationsText: {
        fontSize: 14,
        color: '#4F46E5',
        lineHeight: 20,
    },
    recommendationsListContainer: {
        gap: 12,
    },
    recommendationCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
    },
    recommendationTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    recommendationScore: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B5CF6',
        marginBottom: 8,
    },
    recommendationReasoning: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    placeholderText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        padding: 32,
    },
    // ✅ NOUVEAU: Styles recherche académique
    academicContainer: {
        gap: 16,
    },
    academicTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    academicSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
    },
    academicInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#111827',
        backgroundColor: '#F9FAFB',
        minHeight: 100,
        textAlignVertical: 'top',
    },
    academicSearchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        gap: 8,
    },
    academicSearchButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    academicResponseContainer: {
        backgroundColor: '#EEF2FF',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
    },
    academicResponseTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4F46E5',
        marginBottom: 12,
    },
    academicResponseText: {
        fontSize: 14,
        color: '#111827',
        lineHeight: 22,
    },
});

export default OrientationScolaireHomeScreen;

