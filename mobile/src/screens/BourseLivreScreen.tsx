// ✅ Écran Bourse du Livre avec IA (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeBadge, NativeButton } from '../components/SafeNativeDesign';
import SafeIcon from '../components/SafeIcon';
import { apiGet } from '../services/api';
import { BookRecommendationRequest, bourseLivreApi, PriceSuggestionRequest } from '../services/bourseLivreApi';
import { modernColors, modernStyles } from '../theme/modernTheme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 colonnes avec padding

// Types
interface LivreScolaire {
    id: number;
    titre: string;
    auteur?: string;
    editeur?: string;
    isbn?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    description_etat?: string;
    images_urls: string[];
    video_url?: string;
    gps?: string;
    ville?: string;
    quartier?: string;
    is_available: boolean;
    is_active: boolean;
    user_id: number;
    created_at: string;
    distance_km?: number;
}

interface FilterState {
    classe_actuelle?: string;
    classe_souhaitee?: string;
    matiere?: string;
    niveau?: string;
    etat_livre?: string;
    ville?: string;
    quartier?: string;
}

const BourseLivreScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [searchQuery, setSearchQuery] = useState('');
    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedLivre, setSelectedLivre] = useState<LivreScolaire | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [showPriceSuggestion, setShowPriceSuggestion] = useState(false);
    const [priceSuggestion, setPriceSuggestion] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any>(null);
    const [filters, setFilters] = useState<FilterState>({});
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Options de filtres
    const classes = ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'];
    const matieres = ['Mathématiques', 'Français', 'Anglais', 'Physique', 'Chimie', 'SVT', 'Histoire', 'Géographie', 'Philosophie'];
    const etats = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];
    const niveaux = ['Primaire', 'Collège', 'Lycée'];

    // Charger les livres
    const loadLivres = useCallback(async (reset = false) => {
        if (loading) return;

        try {
            setLoading(true);
            const currentPage = reset ? 1 : page;

            const params: any = {
                limit: 20,
                offset: (currentPage - 1) * 20,
            };

            // Ajouter les filtres
            if (filters.classe_actuelle) params.classe_actuelle = filters.classe_actuelle;
            if (filters.classe_souhaitee) params.classe_souhaitee = filters.classe_souhaitee;
            if (filters.matiere) params.matiere = filters.matiere;
            if (filters.niveau) params.niveau = filters.niveau;
            if (filters.etat_livre) params.etat_livre = filters.etat_livre;
            if (filters.ville) params.ville = filters.ville;
            if (filters.quartier) params.quartier = filters.quartier;
            if (searchQuery) {
                // Recherche par titre ou auteur
                params.search = searchQuery;
            }

            const response = await apiGet<{ livres: LivreScolaire[] }>(
                '/api/livres-scolaires/search',
                { params }
            );

            const newLivres = response.livres || response.data?.livres || [];

            if (reset) {
                setLivres(newLivres);
                setPage(2);
            } else {
                setLivres(prev => [...prev, ...newLivres]);
                setPage(prev => prev + 1);
            }

            setHasMore(newLivres.length === 20);
        } catch (error: any) {
            console.error('[BourseLivreScreen] Erreur chargement livres:', error);
            Alert.alert('Erreur', 'Impossible de charger les livres. Veuillez réessayer.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters, searchQuery, page, loading]);

    // Charger au montage et quand les filtres changent
    useEffect(() => {
        loadLivres(true);
    }, [filters]);

    // Recherche avec debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery !== undefined) {
                loadLivres(true);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Obtenir recommandations IA
    const handleGetRecommendations = async () => {
        try {
            setLoading(true);
            const request: BookRecommendationRequest = {
                classe_actuelle: filters.classe_actuelle || '6ème',
                classe_souhaitee: filters.classe_souhaitee || '5ème',
                matiere: filters.matiere || 'Mathématiques',
                niveau: filters.niveau,
                ville: filters.ville,
            };

            const result = await bourseLivreApi.getRecommendations(request);
            setRecommendations(result);
            setShowRecommendations(true);
        } catch (error: any) {
            console.error('[BourseLivreScreen] Erreur recommandations IA:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir les recommandations IA.');
        } finally {
            setLoading(false);
        }
    };

    // Obtenir suggestions prix IA
    const handleGetPriceSuggestion = async (livre: LivreScolaire) => {
        try {
            setLoading(true);
            const request: PriceSuggestionRequest = {
                livre_id: livre.id,
                titre: livre.titre,
                auteur: livre.auteur,
                editeur: livre.editeur,
                isbn: livre.isbn,
                classe: livre.classe_actuelle,
                matiere: livre.matiere,
                etat_livre: livre.etat_livre,
                ville: livre.ville,
            };

            const result = await bourseLivreApi.getPriceSuggestions(request);
            setPriceSuggestion(result);
            setShowPriceSuggestion(true);
        } catch (error: any) {
            console.error('[BourseLivreScreen] Erreur suggestion prix IA:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir la suggestion de prix.');
        } finally {
            setLoading(false);
        }
    };

    // Appliquer les filtres
    const applyFilters = (newFilters: FilterState) => {
        setFilters(newFilters);
        setPage(1);
    };

    // Réinitialiser les filtres
    const resetFilters = () => {
        setFilters({});
        setSearchQuery('');
        setPage(1);
    };

    // Rendre une card de livre
    const renderLivreCard = ({ item }: { item: LivreScolaire }) => {
        const firstImage = item.images_urls && item.images_urls.length > 0
            ? item.images_urls[0]
            : null;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => setSelectedLivre(item)}
                activeOpacity={0.8}
            >
                {firstImage ? (
                    <Image
                        source={{ uri: firstImage }}
                        style={styles.cardImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                        <Text style={styles.cardImagePlaceholderText}>📚</Text>
                    </View>
                )}

                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.titre}
                    </Text>
                    {item.auteur && (
                        <Text style={styles.cardAuthor} numberOfLines={1}>
                            {item.auteur}
                        </Text>
                    )}

                    <View style={styles.cardBadges}>
                        <NativeBadge
                            text={item.classe_actuelle}
                            variant="info"
                            size="small"
                        />
                        <NativeBadge
                            text={item.matiere}
                            variant="neutral"
                            size="small"
                        />
                        <NativeBadge
                            text={item.etat_livre}
                            variant="success"
                            size="small"
                        />
                    </View>

                    {item.ville && (
                        <View style={styles.cardLocation}>
                            <SafeIcon name="map-pin" size={12} color={modernColors.textSecondary} />
                            <Text style={styles.cardLocationText}>
                                {item.ville}{item.quartier ? `, ${item.quartier}` : ''}
                            </Text>
                        </View>
                    )}

                    {item.distance_km !== undefined && (
                        <Text style={styles.cardDistance}>
                            📍 {item.distance_km.toFixed(1)} km
                        </Text>
                    )}
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={styles.cardActionButton}
                        onPress={() => handleGetPriceSuggestion(item)}
                    >
                        <SafeIcon name="dollar-sign" size={16} color={modernColors.primary} />
                        <Text style={styles.cardActionText}>Prix IA</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header avec recherche */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Bourse du Livre</Text>
                <Text style={styles.headerSubtitle}>
                    Échangez vos livres scolaires facilement
                </Text>

                <View style={styles.searchContainer}>
                    <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher un livre..."
                        placeholderTextColor={modernColors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.filterButton, showFilters && styles.filterButtonActive]}
                        onPress={() => setShowFilters(!showFilters)}
                    >
                        <SafeIcon
                            name="filter"
                            size={18}
                            color={showFilters ? '#fff' : modernColors.primary}
                        />
                        <Text style={[
                            styles.filterButtonText,
                            showFilters && styles.filterButtonTextActive
                        ]}>
                            Filtres
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.aiButton}
                        onPress={handleGetRecommendations}
                    >
                        <SafeIcon name="sparkles" size={18} color="#fff" />
                        <Text style={styles.aiButtonText}>Recommandations IA</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filtres */}
            {showFilters && (
                <View style={styles.filtersPanel}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.filtersContent}>
                            {/* Classe actuelle */}
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterLabel}>Classe actuelle</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {classes.map(classe => (
                                        <TouchableOpacity
                                            key={classe}
                                            style={[
                                                styles.filterChip,
                                                filters.classe_actuelle === classe && styles.filterChipActive
                                            ]}
                                            onPress={() => applyFilters({
                                                ...filters,
                                                classe_actuelle: filters.classe_actuelle === classe ? undefined : classe
                                            })}
                                        >
                                            <Text style={[
                                                styles.filterChipText,
                                                filters.classe_actuelle === classe && styles.filterChipTextActive
                                            ]}>
                                                {classe}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Matière */}
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterLabel}>Matière</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {matieres.map(matiere => (
                                        <TouchableOpacity
                                            key={matiere}
                                            style={[
                                                styles.filterChip,
                                                filters.matiere === matiere && styles.filterChipActive
                                            ]}
                                            onPress={() => applyFilters({
                                                ...filters,
                                                matiere: filters.matiere === matiere ? undefined : matiere
                                            })}
                                        >
                                            <Text style={[
                                                styles.filterChipText,
                                                filters.matiere === matiere && styles.filterChipTextActive
                                            ]}>
                                                {matiere}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* État */}
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterLabel}>État</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {etats.map(etat => (
                                        <TouchableOpacity
                                            key={etat}
                                            style={[
                                                styles.filterChip,
                                                filters.etat_livre === etat && styles.filterChipActive
                                            ]}
                                            onPress={() => applyFilters({
                                                ...filters,
                                                etat_livre: filters.etat_livre === etat ? undefined : etat
                                            })}
                                        >
                                            <Text style={[
                                                styles.filterChipText,
                                                filters.etat_livre === etat && styles.filterChipTextActive
                                            ]}>
                                                {etat}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            <TouchableOpacity
                                style={styles.resetFiltersButton}
                                onPress={resetFilters}
                            >
                                <Text style={styles.resetFiltersText}>Réinitialiser</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Liste des livres */}
            <FlatList
                data={livres}
                renderItem={renderLivreCard}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2}
                contentContainerStyle={styles.listContent}
                onEndReached={() => {
                    if (hasMore && !loading) {
                        loadLivres(false);
                    }
                }}
                onEndReachedThreshold={0.5}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            loadLivres(true);
                        }}
                    />
                }
                ListFooterComponent={
                    loading && livres.length > 0 ? (
                        <View style={styles.loadingFooter}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>Aucun livre trouvé</Text>
                            <Text style={styles.emptySubtext}>
                                Essayez de modifier vos filtres ou votre recherche
                            </Text>
                        </View>
                    ) : null
                }
            />

            {/* Modal détails livre */}
            <Modal
                visible={selectedLivre !== null}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSelectedLivre(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            {selectedLivre && (
                                <>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>{selectedLivre.titre}</Text>
                                        <TouchableOpacity
                                            style={styles.modalCloseButton}
                                            onPress={() => setSelectedLivre(null)}
                                        >
                                            <SafeIcon name="x" size={24} color={modernColors.text} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Galerie d'images */}
                                    {selectedLivre.images_urls && selectedLivre.images_urls.length > 0 && (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageGallery}>
                                            {selectedLivre.images_urls.map((imageUrl, index) => (
                                                <Image
                                                    key={index}
                                                    source={{ uri: imageUrl }}
                                                    style={styles.modalImage}
                                                    resizeMode="cover"
                                                />
                                            ))}
                                        </ScrollView>
                                    )}

                                    <View style={styles.modalDetails}>
                                        {selectedLivre.auteur && (
                                            <View style={styles.modalDetailRow}>
                                                <Text style={styles.modalDetailLabel}>Auteur:</Text>
                                                <Text style={styles.modalDetailValue}>{selectedLivre.auteur}</Text>
                                            </View>
                                        )}
                                        <View style={styles.modalDetailRow}>
                                            <Text style={styles.modalDetailLabel}>Classe actuelle:</Text>
                                            <Text style={styles.modalDetailValue}>{selectedLivre.classe_actuelle}</Text>
                                        </View>
                                        <View style={styles.modalDetailRow}>
                                            <Text style={styles.modalDetailLabel}>Classe souhaitée:</Text>
                                            <Text style={styles.modalDetailValue}>{selectedLivre.classe_souhaitee}</Text>
                                        </View>
                                        <View style={styles.modalDetailRow}>
                                            <Text style={styles.modalDetailLabel}>Matière:</Text>
                                            <Text style={styles.modalDetailValue}>{selectedLivre.matiere}</Text>
                                        </View>
                                        <View style={styles.modalDetailRow}>
                                            <Text style={styles.modalDetailLabel}>État:</Text>
                                            <NativeBadge text={selectedLivre.etat_livre} variant="success" />
                                        </View>
                                        {selectedLivre.description_etat && (
                                            <View style={styles.modalDetailRow}>
                                                <Text style={styles.modalDetailLabel}>Description:</Text>
                                                <Text style={styles.modalDetailValue}>{selectedLivre.description_etat}</Text>
                                            </View>
                                        )}
                                        {selectedLivre.ville && (
                                            <View style={styles.modalDetailRow}>
                                                <Text style={styles.modalDetailLabel}>Localisation:</Text>
                                                <Text style={styles.modalDetailValue}>
                                                    {selectedLivre.ville}{selectedLivre.quartier ? `, ${selectedLivre.quartier}` : ''}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.modalActions}>
                                        <NativeButton
                                            title="Suggestion prix IA"
                                            onPress={() => {
                                                handleGetPriceSuggestion(selectedLivre);
                                                setSelectedLivre(null);
                                            }}
                                            variant="primary"
                                            style={styles.modalActionButton}
                                        />
                                        <NativeButton
                                            title="Contacter"
                                            onPress={() => {
                                                // TODO: Navigation vers chat/contact
                                                Alert.alert('Contact', 'Fonctionnalité de contact à implémenter');
                                            }}
                                            variant="outline"
                                            style={styles.modalActionButton}
                                        />
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal recommandations IA */}
            <Modal
                visible={showRecommendations}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowRecommendations(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Recommandations IA</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowRecommendations(false)}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        {recommendations && (
                            <ScrollView>
                                <View style={styles.recommendationContent}>
                                    <Text style={styles.recommendationScore}>
                                        Score: {recommendations.score_recommendation.toFixed(1)}/100
                                    </Text>
                                    <Text style={styles.recommendationReasoning}>
                                        {recommendations.reasoning}
                                    </Text>
                                    {recommendations.livre_ids && recommendations.livre_ids.length > 0 && (
                                        <View style={styles.recommendationBooks}>
                                            <Text style={styles.recommendationBooksTitle}>
                                                Livres recommandés:
                                            </Text>
                                            {recommendations.livre_ids.map((id: number) => (
                                                <Text key={id} style={styles.recommendationBookId}>
                                                    Livre ID: {id}
                                                </Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal suggestion prix IA */}
            <Modal
                visible={showPriceSuggestion}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowPriceSuggestion(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Suggestion Prix IA</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowPriceSuggestion(false)}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                        {priceSuggestion && (
                            <ScrollView>
                                <View style={styles.priceSuggestionContent}>
                                    <View style={styles.priceRange}>
                                        <Text style={styles.priceLabel}>Prix suggéré:</Text>
                                        <Text style={styles.priceValue}>
                                            {priceSuggestion.prix_suggere_min.toLocaleString()} - {priceSuggestion.prix_suggere_max.toLocaleString()} {priceSuggestion.devise}
                                        </Text>
                                        <Text style={styles.priceMedian}>
                                            Médian: {priceSuggestion.prix_suggere_median.toLocaleString()} {priceSuggestion.devise}
                                        </Text>
                                    </View>
                                    <Text style={styles.priceConfidence}>
                                        Confiance: {(priceSuggestion.confidence * 100).toFixed(0)}%
                                    </Text>
                                    <Text style={styles.priceComparison}>
                                        {priceSuggestion.comparaison_marche}
                                    </Text>
                                    {priceSuggestion.facteurs_influence && priceSuggestion.facteurs_influence.length > 0 && (
                                        <View style={styles.priceFactors}>
                                            <Text style={styles.priceFactorsTitle}>Facteurs d'influence:</Text>
                                            {priceSuggestion.facteurs_influence.map((factor: string, index: number) => (
                                                <Text key={index} style={styles.priceFactor}>
                                                    • {factor}
                                                </Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        backgroundColor: modernColors.surface,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.background,
        borderRadius: modernStyles.borderRadius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: modernColors.text,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    filterButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: modernStyles.borderRadius.md,
        borderWidth: 2,
        borderColor: modernColors.primary,
        backgroundColor: 'transparent',
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
    },
    filterButtonText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    filterButtonTextActive: {
        color: '#fff',
    },
    aiButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: modernStyles.borderRadius.md,
        backgroundColor: '#8B5CF6',
    },
    aiButtonText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    filtersPanel: {
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        maxHeight: 200,
    },
    filtersContent: {
        padding: 16,
    },
    filterGroup: {
        marginBottom: 12,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: modernStyles.borderRadius.full,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        color: modernColors.text,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    resetFiltersButton: {
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: modernStyles.borderRadius.md,
        backgroundColor: modernColors.error,
        alignSelf: 'flex-start',
    },
    resetFiltersText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    card: {
        width: CARD_WIDTH,
        backgroundColor: modernColors.surface,
        borderRadius: modernStyles.borderRadius.lg,
        marginBottom: 16,
        marginRight: 16,
        ...modernStyles.shadowMedium,
    },
    cardImage: {
        width: '100%',
        height: 120,
        borderTopLeftRadius: modernStyles.borderRadius.lg,
        borderTopRightRadius: modernStyles.borderRadius.lg,
    },
    cardImagePlaceholder: {
        backgroundColor: modernColors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardImagePlaceholderText: {
        fontSize: 48,
    },
    cardContent: {
        padding: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    cardAuthor: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    cardBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 8,
    },
    cardLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    cardLocationText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginLeft: 4,
    },
    cardDistance: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    cardActions: {
        padding: 12,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cardActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    cardActionText: {
        marginLeft: 6,
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    loadingFooter: {
        padding: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: 20,
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
        fontWeight: 'bold',
        color: modernColors.text,
        flex: 1,
    },
    modalCloseButton: {
        padding: 4,
    },
    imageGallery: {
        marginVertical: 16,
    },
    modalImage: {
        width: 300,
        height: 300,
        marginRight: 12,
        borderRadius: modernStyles.borderRadius.md,
    },
    modalDetails: {
        padding: 20,
    },
    modalDetailRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'center',
    },
    modalDetailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        width: 120,
    },
    modalDetailValue: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    modalActions: {
        padding: 20,
        gap: 12,
    },
    modalActionButton: {
        marginBottom: 8,
    },
    recommendationContent: {
        padding: 20,
    },
    recommendationScore: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.primary,
        marginBottom: 12,
    },
    recommendationReasoning: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
        marginBottom: 16,
    },
    recommendationBooks: {
        marginTop: 12,
    },
    recommendationBooksTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    recommendationBookId: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    priceSuggestionContent: {
        padding: 20,
    },
    priceRange: {
        marginBottom: 16,
    },
    priceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    priceValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.primary,
        marginBottom: 4,
    },
    priceMedian: {
        fontSize: 16,
        color: modernColors.text,
    },
    priceConfidence: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    priceComparison: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
        marginBottom: 16,
    },
    priceFactors: {
        marginTop: 12,
    },
    priceFactorsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    priceFactor: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
});

export default BourseLivreScreen;
