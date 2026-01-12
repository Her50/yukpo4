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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { GeneratedRecipe, menuPlanningService } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';

const RecipeSearchScreen: React.FC = () => {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
    const [showRecipeDetails, setShowRecipeDetails] = useState(false);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir un nom de recette');
            return;
        }

        try {
            setLoading(true);

            // ✅ AMÉLIORÉ: Ajouter un timeout explicite pour éviter les chargements infinis
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('La génération de la recette prend trop de temps. Veuillez réessayer.')), 95000); // 95s (légèrement inférieur au timeout API)
            });

            // Générer une recette avec l'IA
            const responsePromise = menuPlanningService.generateRecipe(searchQuery.trim());
            const response = await Promise.race([responsePromise, timeoutPromise]) as any;

            if (response && response.success && response.data?.recipe) {
                // ✅ CORRIGÉ: Afficher la recette dans un modal au lieu de naviguer
                setGeneratedRecipe(response.data.recipe);
                setShowRecipeDetails(true);
                setSearchQuery(''); // Réinitialiser le champ de recherche
            } else if (response && !response.success) {
                Alert.alert('Erreur', response.error || 'Impossible de générer la recette');
            } else {
                Alert.alert('Erreur', 'Réponse invalide du serveur');
            }
        } catch (error: any) {
            console.error('[RecipeSearch] Erreur:', error);

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
            if (errorMessage.includes('temps') || errorMessage.includes('timeout') || error.code === 'ABORT_ERR') {
                errorMessage = 'La génération prend trop de temps. Veuillez réessayer avec un nom de recette plus simple.';
            }

            Alert.alert('Erreur', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSearch = (recipeName: string) => {
        setSearchQuery(recipeName);
        // Déclencher la recherche automatiquement
        setTimeout(() => {
            handleSearch();
        }, 100);
    };

    const quickRecipes = [
        'Poulet DG',
        'Ndolé',
        'Sauce arachide',
        'Riz sauté',
        'Poulet braisé',
        'Poisson braisé',
        'Okok',
        'Eru',
    ];

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
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Ex: Poulet DG, Ndolé, Riz sauté..."
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                        <NativeButton
                            title="Rechercher"
                            onPress={handleSearch}
                            loading={loading}
                            variant="primary"
                            size="small"
                            style={styles.searchButton}
                        />
                    </View>
                </NativeCard>

                <NativeCard style={styles.quickCard}>
                    <Text style={styles.label}>⚡ Recettes populaires</Text>
                    <View style={styles.quickRecipesContainer}>
                        {quickRecipes.map((recipe) => (
                            <TouchableOpacity
                                key={recipe}
                                style={styles.quickRecipeChip}
                                onPress={() => handleQuickSearch(recipe)}
                            >
                                <SafeIcon name="ChefHat" size={16} color={modernColors.primary} type="lucide" />
                                <Text style={styles.quickRecipeText}>{recipe}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </NativeCard>

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Génération de la recette en cours...</Text>
                        <Text style={styles.loadingSubtext}>Cela peut prendre jusqu'à 90 secondes</Text>
                    </View>
                )}

                <NativeCard style={styles.infoCard}>
                    <SafeIcon name="Info" size={24} color={modernColors.primary} type="lucide" />
                    <Text style={styles.infoText}>
                        Notre IA génère des recettes complètes et détaillées selon vos préférences et votre profil famille.
                    </Text>
                </NativeCard>
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

                        {generatedRecipe && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.recipeHeader}>
                                    <Text style={styles.recipeTitle}>{generatedRecipe.recipe_name}</Text>
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
                                {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 && (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Ingrédients</Text>
                                        {generatedRecipe.ingredients.map((ingredient, index) => (
                                            <View key={index} style={styles.ingredientItem}>
                                                <Text style={styles.ingredientText}>
                                                    • {ingredient.name}: {ingredient.quantity} {ingredient.unit}
                                                    {ingredient.notes && ` (${ingredient.notes})`}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Instructions */}
                                {generatedRecipe.instructions && generatedRecipe.instructions.length > 0 && (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Instructions</Text>
                                        {generatedRecipe.instructions.map((instruction, index) => (
                                            <View key={index} style={styles.instructionItem}>
                                                <View style={styles.instructionNumber}>
                                                    <Text style={styles.instructionNumberText}>{index + 1}</Text>
                                                </View>
                                                <Text style={styles.instructionText}>{instruction}</Text>
                                            </View>
                                        ))}
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
                        )}

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Fermer"
                                onPress={() => {
                                    setShowRecipeDetails(false);
                                    setGeneratedRecipe(null);
                                }}
                                variant="primary"
                                style={styles.modalButton}
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
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 16,
    },
    searchButton: {
        minWidth: 100,
    },
    quickCard: {
        marginBottom: 16,
        padding: 16,
    },
    quickRecipesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickRecipeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quickRecipeText: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
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
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#1E40AF',
        lineHeight: 20,
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
    },
    modalButton: {
        width: '100%',
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
});

export default RecipeSearchScreen;

