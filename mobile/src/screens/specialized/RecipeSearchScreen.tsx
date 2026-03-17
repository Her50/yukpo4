// ✅ Écran de recherche de recettes - VERSION REFONDUE (sans tremblements)
import { useNavigation } from '@react-navigation/native';
import React, { useState, useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Keyboard,
    Platform,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { GeneratedRecipe, menuPlanningService } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';
import { generateAndDownloadRecipePDF, shareRecipePDF } from '../../utils/recipePdfGenerator';
import { useLanguageSafe } from '../../contexts/LanguageContext';

// Fonction utilitaire pour extraire le nombre de portions
const getServingsNumber = (servings: number | { number: number; size: string } | undefined): number => {
    if (!servings) return 0;
    if (typeof servings === 'number') return servings;
    return servings.number;
};

const RecipeSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
    const [showRecipeDetails, setShowRecipeDetails] = useState(false);
    const [exportingRecipePDF, setExportingRecipePDF] = useState(false);

    // ✅ SIMPLIFIÉ: Handler de recherche sans complexité inutile
    const handleSearch = useCallback(async () => {
        const queryToUse = searchQuery.trim();
        
        if (!queryToUse) {
            Alert.alert('Erreur', 'Veuillez saisir un nom de recette');
            return;
        }

        // Fermer le clavier immédiatement
        Keyboard.dismiss();
        
        // Mettre à jour l'état de manière simple
        setLoading(true);
        setGeneratedRecipe(null);
        setShowRecipeDetails(false);

        try {
            console.log('[RecipeSearch] Début génération recette:', queryToUse);

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(t('recipeSearchScreen.laGenerationDeLaRecettePrend'))), 95000);
            });

            const responsePromise = menuPlanningService.generateRecipe(queryToUse);
            const response = await Promise.race([responsePromise, timeoutPromise]) as any;

            console.log('[RecipeSearch] Réponse reçue:', response?.success);

            // Extraire la recette de différentes structures possibles
            let recipe: GeneratedRecipe | null = null;
            
            if (response) {
                if (response.data?.recipe) {
                    recipe = response.data.recipe;
                } else if (response.data && response.data.recipe_name) {
                    recipe = response.data as GeneratedRecipe;
                } else if (response.recipe) {
                    recipe = response.recipe;
                } else if (response.data?.data?.recipe) {
                    recipe = response.data.data.recipe;
                }
                
                if (!response.success && !recipe) {
                    const errorMsg = response.error || response.message || response.data?.error || response.data?.message || t('recipeSearch.impossibleDeGenererLaRecette');
                    Alert.alert('Erreur', errorMsg);
                    setLoading(false);
                    return;
                }
            }

            if (recipe && recipe.recipe_name) {
                console.log('[RecipeSearch] ✅ Recette générée:', recipe.recipe_name);
                setGeneratedRecipe(recipe);
                setSearchQuery('');
                // Petit délai pour permettre la fermeture du clavier avant d'ouvrir le modal
                setTimeout(() => {
                    setShowRecipeDetails(true);
                    setLoading(false);
                }, 200);
            } else {
                Alert.alert('Erreur', 'Impossible d\t('recipeSearchScreen.extraireLaRecetteDeLaReponse'));
                setLoading(false);
            }
        } catch (error: any) {
            console.error('[RecipeSearch] ❌ Erreur:', error);
            
            let errorMessage = 'Une erreur est survenue';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.error) {
                errorMessage = error.error;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            if (errorMessage.includes('temps') || errorMessage.includes('timeout') || error.code === 'ABORT_ERR' || error.name === 'AbortError') {
                errorMessage = t('recipeSearchScreen.laGenerationPrendTropDeTemps');
            }

            Alert.alert('Erreur', errorMessage);
            setLoading(false);
        }
    }, [searchQuery]);

    // ✅ MÉMORISÉ: Composant de chargement pour éviter les re-renders
    const loadingView = useMemo(() => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={modernColors.primary} animating={loading} />
            <Text style={styles.loadingText}>{t('recipeSearch.generationDeLaRecetteEn')}</Text>
            <Text style={styles.loadingSubtext}>{t('recipeSearch.celaPeutPrendreJusqua90')}</Text>
        </View>
    ), [loading]);

    return (
        <View style={styles.container}>
            {/* Header fixe */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('recipeSearch.rechercheDeRecettes')}</Text>
            </View>

            {/* Contenu scrollable */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
            >
                <View style={styles.form}>
                    <NativeCard style={styles.searchCard}>
                        <Text style={styles.label}>{t('recipeSearch.rechercherUneRecette')}</Text>
                        <View style={styles.searchContainer}>
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder={t('recipeSearch.exPouletDgNdoleRiz')}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                                style={styles.searchInput}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <NativeButton
                                title={t('recipeSearch.rechercher')}
                                onPress={handleSearch}
                                loading={loading}
                                variant="primary"
                                size="small"
                                style={styles.searchButton}
                                disabled={!searchQuery.trim() || loading}
                            />
                        </View>
                    </NativeCard>

                    {/* Indicateur de chargement avec hauteur fixe pour éviter les changements de layout */}
                    {loading && loadingView}
                </View>
            </ScrollView>

            {/* Modal de recette générée - SIMPLIFIÉ sans KeyboardAvoidingView */}
            <Modal
                visible={showRecipeDetails && !!generatedRecipe}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowRecipeDetails(false);
                    setGeneratedRecipe(null);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('recipeSearch.recetteGeneree')}</Text>
                            <TouchableOpacity onPress={() => {
                                setShowRecipeDetails(false);
                                setGeneratedRecipe(null);
                            }}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        {generatedRecipe ? (
                            <ScrollView 
                                style={styles.modalBody} 
                                contentContainerStyle={styles.modalBodyContent}
                                showsVerticalScrollIndicator={true}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                            >
                                <View style={styles.recipeHeader}>
                                    <Text style={styles.recipeTitle}>{generatedRecipe.recipe_name || t('recipeSearch.recetteSansNom')}</Text>
                                    {generatedRecipe.description && (
                                        <Text style={styles.recipeDescription}>{generatedRecipe.description}</Text>
                                    )}
                                </View>

                                {/* Informations rapides */}
                                <View style={styles.recipeInfoRow}>
                                    {generatedRecipe.prep_time_minutes && (
                                        <View style={styles.recipeInfoItem}>
                                            <SafeIcon name="clock" size={16} color={modernColors.primary} type="lucide" />
                                            <Text style={styles.recipeInfoText}>{generatedRecipe.prep_time_minutes} min</Text>
                                        </View>
                                    )}
                                    {generatedRecipe.difficulty && (
                                        <View style={styles.recipeInfoItem}>
                                            <SafeIcon name="star" size={16} color={modernColors.primary} type="lucide" />
                                            <Text style={styles.recipeInfoText}>{generatedRecipe.difficulty}</Text>
                                        </View>
                                    )}
                                    <View style={styles.recipeInfoItem}>
                                        <SafeIcon name="users" size={16} color={modernColors.primary} type="lucide" />
                                        <Text style={styles.recipeInfoText}>{getServingsNumber(generatedRecipe.servings)} portions</Text>
                                    </View>
                                </View>

                                {/* Ingrédients */}
                                {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 ? (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>{t('recipeSearch.ingredients')}</Text>
                                        {generatedRecipe.ingredients.map((ingredient, index) => (
                                            <View key={index} style={styles.ingredientItem}>
                                                <Text style={styles.ingredientText}>
                                                    • {ingredient.name || t('recipeSearch.ingredient')}: {ingredient.quantity || 0} {ingredient.unit || ''}
                                                    {ingredient.notes && ` (${ingredient.notes})`}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>{t('recipeSearch.ingredients')}</Text>
                                        <Text style={styles.emptyText}>{t('recipeSearch.aucunIngredientDisponible')}</Text>
                                    </View>
                                )}

                                {/* Instructions */}
                                {generatedRecipe.instructions && generatedRecipe.instructions.length > 0 ? (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Instructions</Text>
                                        {generatedRecipe.instructions.map((instruction, index) => (
                                            <View key={index} style={styles.instructionItem}>
                                                <View style={styles.instructionNumber}>
                                                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                                                </View>
                                                <Text style={styles.instructionText}>{instruction || t('recipeSearch.etapeSansDescription')}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Instructions</Text>
                                        <Text style={styles.emptyText}>{t('recipeSearch.aucuneInstructionDisponible')}</Text>
                                    </View>
                                )}

                                {/* Astuces */}
                                {generatedRecipe.tips && generatedRecipe.tips.length > 0 && (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Astuces</Text>
                                        {generatedRecipe.tips.map((tip, index) => (
                                            <View key={index} style={styles.tipItem}>
                                                <SafeIcon name="lightbulb" size={16} color="#F59E0B" type="lucide" />
                                                <Text style={styles.tipText}>{tip}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Nutrition */}
                                {generatedRecipe.nutrition && (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Valeurs nutritionnelles (par portion)</Text>
                                        <View style={styles.nutritionGrid}>
                                            <View style={styles.nutritionItem}>
                                                <Text style={styles.nutritionLabel}>Calories</Text>
                                                <Text style={styles.nutritionValue}>
                                                    {generatedRecipe.calories_per_serving?.toFixed(0) || 'N/A'}
                                                </Text>
                                            </View>
                                            <View style={styles.nutritionItem}>
                                                <Text style={styles.nutritionLabel}>{t('recipeSearch.proteines')}</Text>
                                                <Text style={styles.nutritionValue}>
                                                    {generatedRecipe.nutrition.proteins.toFixed(1)}g
                                                </Text>
                                            </View>
                                            <View style={styles.nutritionItem}>
                                                <Text style={styles.nutritionLabel}>Glucides</Text>
                                                <Text style={styles.nutritionValue}>
                                                    {generatedRecipe.nutrition.carbs.toFixed(1)}g
                                                </Text>
                                            </View>
                                            <View style={styles.nutritionItem}>
                                                <Text style={styles.nutritionLabel}>Lipides</Text>
                                                <Text style={styles.nutritionValue}>
                                                    {generatedRecipe.nutrition.fats.toFixed(1)}g
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Coût estimé */}
                                {generatedRecipe.estimated_cost && (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>{t('recipeSearch.coutEstime')}</Text>
                                        <Text style={styles.costText}>
                                            {generatedRecipe.estimated_cost.toLocaleString()} FCFA
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        ) : (
                            <View style={styles.modalBody}>
                                <View style={styles.errorContainer}>
                                    <SafeIcon name="AlertCircle" size={48} color={modernColors.error || '#EF4444'} type="lucide" />
                                    <Text style={styles.errorText}>{t('recipeSearch.aucuneRecetteAAfficher')}</Text>
                                    <Text style={styles.errorSubtext}>{t('recipeSearch.laRecetteGenereeEstInvalide')}</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title={t('recipeSearchScreen.fermer')}
                                onPress={() => {
                                    setShowRecipeDetails(false);
                                    setGeneratedRecipe(null);
                                }}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={exportingRecipePDF ? t('recipeSearchScreen.generation') : 'Partager en PDF'}
                                onPress={async () => {
                                    if (!generatedRecipe) return;

                                    try {
                                        setExportingRecipePDF(true);
                                        const pdfUri = await generateAndDownloadRecipePDF({
                                            recipe: generatedRecipe,
                                            currency: 'FCFA',
                                        });

                                        await shareRecipePDF(pdfUri, generatedRecipe.recipe_name);
                                        Alert.alert(t('recipeSearchScreen.succes'), t('recipeSearchScreen.recettePartageeAvecSucces'));
                                    } catch (error: any) {
                                        console.error('[RecipeSearch] Erreur partage recette PDF:', error);
                                        Alert.alert('Erreur', error.message || 'Impossible de partager la recette en PDF');
                                    } finally {
                                        setExportingRecipePDF(false);
                                    }
                                }}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={exportingRecipePDF}
                                loading={exportingRecipePDF}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    form: {
        padding: 16,
    },
    searchCard: {
        marginBottom: 16,
        padding: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#fff',
        fontSize: 16,
        color: '#111827',
    },
    searchButton: {
        minWidth: 100,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 24,
        minHeight: 120,
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '600',
    },
    loadingSubtext: {
        marginTop: 4,
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
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
        flexDirection: 'column',
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
    modalBody: {
        flex: 1,
    },
    modalBodyContent: {
        padding: 20,
        paddingBottom: 100,
    },
    modalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
    },
    recipeHeader: {
        marginBottom: 20,
    },
    recipeTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    recipeDescription: {
        fontSize: 16,
        color: modernColors.textSecondary,
        lineHeight: 24,
    },
    recipeInfoRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap',
    },
    recipeInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    recipeInfoText: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    recipeSection: {
        marginBottom: 24,
    },
    recipeSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    ingredientItem: {
        marginBottom: 8,
    },
    ingredientText: {
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    instructionItem: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    instructionNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    instructionNumberText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    instructionText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        lineHeight: 22,
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
    },
    tipText: {
        flex: 1,
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
    },
    nutritionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    nutritionItem: {
        flex: 1,
        minWidth: '45%',
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        alignItems: 'center',
    },
    nutritionLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    nutritionValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    costText: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        minHeight: 200,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
        textAlign: 'center',
    },
    errorSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 12,
    },
});

export default RecipeSearchScreen;
