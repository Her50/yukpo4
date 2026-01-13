// ✅ Écran de recherche de recettes
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { GeneratedRecipe, menuPlanningService } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';
import { generateAndDownloadRecipePDF, shareRecipePDF } from '../../utils/recipePdfGenerator';

const RecipeSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
    const [showRecipeDetails, setShowRecipeDetails] = useState(false);
    const [exportingRecipePDF, setExportingRecipePDF] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir un nom de recette');
            return;
        }

        try {
            setLoading(true);
            setGeneratedRecipe(null); // Réinitialiser la recette précédente
            setShowRecipeDetails(false); // Fermer le modal précédent

            console.log('[RecipeSearch] Début génération recette:', searchQuery.trim());

            // ✅ AMÉLIORÉ: Ajouter un timeout explicite pour éviter les chargements infinis
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('La génération de la recette prend trop de temps. Veuillez réessayer.')), 95000); // 95s (légèrement inférieur au timeout API)
            });

            // Générer une recette avec l'IA
            const responsePromise = menuPlanningService.generateRecipe(searchQuery.trim());
            const response = await Promise.race([responsePromise, timeoutPromise]) as any;

            console.log('[RecipeSearch] Réponse reçue:', {
                success: response?.success,
                hasData: !!response?.data,
                hasRecipe: !!response?.data?.recipe,
                dataKeys: response?.data ? Object.keys(response.data) : [],
                recipeKeys: response?.data?.recipe ? Object.keys(response.data.recipe) : [],
            });

            // ✅ CORRIGÉ: Gérer différentes structures de réponse possibles
            let recipe: GeneratedRecipe | null = null;
            
            if (response && response.success) {
                // Structure 1: response.data.recipe (structure normale)
                if (response.data?.recipe) {
                    recipe = response.data.recipe;
                }
                // Structure 2: response.data directement est la recette (fallback)
                else if (response.data && response.data.recipe_name) {
                    recipe = response.data as GeneratedRecipe;
                }
                // Structure 3: response.recipe (si le backend retourne directement)
                else if (response.recipe) {
                    recipe = response.recipe;
                }
            }

            if (recipe) {
                console.log('[RecipeSearch] ✅ Recette générée avec succès:', recipe.recipe_name);
                setGeneratedRecipe(recipe);
                setShowRecipeDetails(true);
                setSearchQuery(''); // Réinitialiser le champ de recherche
            } else if (response && !response.success) {
                const errorMsg = response.error || response.message || 'Impossible de générer la recette';
                console.error('[RecipeSearch] ❌ Erreur dans la réponse:', errorMsg);
                Alert.alert('Erreur', errorMsg);
            } else {
                console.error('[RecipeSearch] ❌ Réponse invalide:', response);
                Alert.alert('Erreur', 'Réponse invalide du serveur. Veuillez réessayer.');
            }
        } catch (error: any) {
            console.error('[RecipeSearch] ❌ Erreur exception:', error);

            // ✅ AMÉLIORÉ: Messages d'erreur plus spécifiques
            let errorMessage = 'Une erreur est survenue';
            if (error.message) {
                errorMessage = error.message;
            } else if (error.error) {
                errorMessage = error.error;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            // Vérifier si c'est un timeout
            if (errorMessage.includes('temps') || errorMessage.includes('timeout') || error.code === 'ABORT_ERR' || error.name === 'AbortError') {
                errorMessage = 'La génération prend trop de temps. Veuillez réessayer avec un nom de recette plus simple.';
            }

            Alert.alert('Erreur', errorMessage);
        } finally {
            setLoading(false);
        }
    };


    return (
        <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Recherche de Recettes</Text>
            </View>

            <View style={styles.form}>
                <NativeCard style={styles.searchCard}>
                    <Text style={styles.label}>🔍 Rechercher une recette</Text>
                    <View style={styles.searchContainer}>
                        <NativeInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Ex: Poulet DG, Ndolé, Riz sauté..."
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                            style={styles.searchInput}
                        />
                        <NativeButton
                            title="Rechercher"
                            onPress={handleSearch}
                            loading={loading}
                            variant="primary"
                            size="small"
                            style={styles.searchButton}
                            disabled={!searchQuery.trim() || loading}
                        />
                    </View>
                </NativeCard>

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Génération de la recette en cours...</Text>
                        <Text style={styles.loadingSubtext}>Cela peut prendre jusqu'à 90 secondes</Text>
                    </View>
                )}
            </View>

            {/* ✅ NOUVEAU: Modal pour afficher la recette générée (comme dans MenuWeekCalendarScreen) */}
            <Modal
                visible={showRecipeDetails}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowRecipeDetails(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Recette générée</Text>
                            <TouchableOpacity onPress={() => setShowRecipeDetails(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        {generatedRecipe ? (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
                                <View style={styles.recipeHeader}>
                                    <Text style={styles.recipeTitle}>{generatedRecipe.recipe_name || 'Recette sans nom'}</Text>
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
                                        <Text style={styles.recipeInfoText}>{generatedRecipe.servings} portions</Text>
                                    </View>
                                </View>

                                {/* Ingrédients */}
                                {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 ? (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Ingrédients</Text>
                                        {generatedRecipe.ingredients.map((ingredient, index) => (
                                            <View key={index} style={styles.ingredientItem}>
                                                <Text style={styles.ingredientText}>
                                                    • {ingredient.name || 'Ingrédient'}: {ingredient.quantity || 0} {ingredient.unit || ''}
                                                    {ingredient.notes && ` (${ingredient.notes})`}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Ingrédients</Text>
                                        <Text style={styles.emptyText}>Aucun ingrédient disponible</Text>
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
                                                <Text style={styles.instructionText}>{instruction || 'Étape sans description'}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Instructions</Text>
                                        <Text style={styles.emptyText}>Aucune instruction disponible</Text>
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
                                                <Text style={styles.nutritionLabel}>Protéines</Text>
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
                                        <Text style={styles.recipeSectionTitle}>Coût estimé</Text>
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
                                    <Text style={styles.errorText}>Aucune recette à afficher</Text>
                                    <Text style={styles.errorSubtext}>La recette générée est invalide ou incomplète</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Fermer"
                                onPress={() => {
                                    setShowRecipeDetails(false);
                                    setGeneratedRecipe(null);
                                }}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={exportingRecipePDF ? 'Génération...' : 'Partager en PDF'}
                                onPress={async () => {
                                    if (!generatedRecipe) return;

                                    try {
                                        setExportingRecipePDF(true);
                                        const pdfUri = await generateAndDownloadRecipePDF({
                                            recipe: generatedRecipe,
                                            currency: 'FCFA',
                                        });

                                        await shareRecipePDF(pdfUri, generatedRecipe.recipe_name);
                                        Alert.alert('Succès', 'Recette partagée avec succès !');
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
        </KeyboardAwareScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
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
    },
    searchButton: {
        minWidth: 100,
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 24,
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
    // ✅ NOUVEAU: Styles pour le modal de recette
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
        paddingBottom: 20,
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
        padding: 20,
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
    // ✅ NOUVEAU: Styles pour affichage d'erreur dans le modal
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

