// ✅ Écran Détails Recette - Planification Menus
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { modernColors } from '../../theme/modernTheme';

const { width } = Dimensions.get('window');

interface Recipe {
    id: number;
    name: string;
    description?: string;
    cuisine_style?: string;
    meal_type: string[];
    difficulty?: string;
    prep_time_minutes?: number;
    cook_time_minutes?: number;
    servings: number;
    ingredients: Array<{
        name: string;
        quantity: number;
        unit: string;
    }>;
    instructions: string[];
    nutrition_per_serving?: {
        calories?: number;
        proteins?: number;
        carbs?: number;
        fats?: number;
        fiber?: number;
    };
    tags?: string[];
    image_url?: string;
    video_url?: string;
    is_premium?: boolean;
}

interface RecipeDetailsScreenProps { }

const RecipeDetailsScreen: React.FC<RecipeDetailsScreenProps> = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const recipeId: number | undefined = route.params?.recipeId;

    const [loading, setLoading] = useState(true);
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [servings, setServings] = useState(1);

    useEffect(() => {
        if (recipeId) {
            loadRecipe();
        }
    }, [recipeId]);

    const loadRecipe = async () => {
        try {
            setLoading(true);
            // TODO: Implémenter endpoint GET /api/menus/recipes/:id
            // Pour l'instant, on simule avec des données
            const mockRecipe: Recipe = {
                id: recipeId || 1,
                name: 'Ndolé',
                description: 'Plat traditionnel camerounais à base de feuilles amères',
                cuisine_style: 'camerounaise',
                meal_type: ['dejeuner', 'diner'],
                difficulty: 'moyen',
                prep_time_minutes: 30,
                cook_time_minutes: 60,
                servings: 4,
                ingredients: [
                    { name: 'Feuilles de ndolé', quantity: 500, unit: 'g' },
                    { name: 'Viande de bœuf', quantity: 500, unit: 'g' },
                    { name: 'Arachides', quantity: 200, unit: 'g' },
                    { name: 'Oignons', quantity: 2, unit: 'pièces' },
                    { name: 'Huile de palme', quantity: 50, unit: 'ml' },
                ],
                instructions: [
                    'Laver et ébouillanter les feuilles de ndolé',
                    'Faire cuire la viande avec les épices',
                    'Mixer les arachides et les oignons',
                    'Ajouter les feuilles de ndolé à la viande',
                    'Laisser mijoter 30 minutes',
                ],
                nutrition_per_serving: {
                    calories: 450,
                    proteins: 25,
                    carbs: 30,
                    fats: 20,
                    fiber: 8,
                },
                tags: ['traditionnel', 'camerounais', 'sain'],
            };
            setRecipe(mockRecipe);
            setServings(mockRecipe.servings);
        } catch (error) {
            console.error('[RecipeDetails] Erreur chargement:', error);
            Alert.alert('Erreur', 'Impossible de charger la recette');
        } finally {
            setLoading(false);
        }
    };

    const adjustServings = (newServings: number) => {
        if (newServings < 1) return;
        setServings(newServings);
    };

    const calculateAdjustedQuantity = (quantity: number): number => {
        if (!recipe) return quantity;
        const ratio = servings / recipe.servings;
        return Math.round(quantity * ratio * 10) / 10;
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de la recette...</Text>
            </View>
        );
    }

    if (!recipe) {
        return (
            <View style={styles.centerContainer}>
                <SafeIcon name="AlertCircle" size={64} color={modernColors.textSecondary} type="lucide" />
                <Text style={styles.errorText}>Recette non trouvée</Text>
                <NativeButton
                    title="Retour"
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                />
            </View>
        );
    }

    const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

    return (
        <View style={styles.container}>
            {/* Header avec image */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Image recette */}
                {recipe.image_url ? (
                    <Image source={{ uri: recipe.image_url }} style={styles.recipeImage} />
                ) : (
                    <View style={styles.recipeImagePlaceholder}>
                        <SafeIcon name="ChefHat" size={64} color={modernColors.textSecondary} type="lucide" />
                    </View>
                )}

                {/* Header info */}
                <LinearGradient
                    colors={['#F59E0B', '#F97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButtonHeader}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.headerInfo}>
                            <Text style={styles.recipeName}>{recipe.name}</Text>
                            {recipe.cuisine_style && (
                                <Text style={styles.cuisineStyle}>{recipe.cuisine_style}</Text>
                            )}
                        </View>
                    </View>
                </LinearGradient>

                {/* Info cards */}
                <View style={styles.infoCards}>
                    <NativeCard style={styles.infoCard}>
                        <SafeIcon name="Clock" size={24} color={modernColors.primary} type="lucide" />
                        <Text style={styles.infoValue}>{totalTime} min</Text>
                        <Text style={styles.infoLabel}>Total</Text>
                    </NativeCard>
                    <NativeCard style={styles.infoCard}>
                        <SafeIcon name="Users" size={24} color={modernColors.primary} type="lucide" />
                        <Text style={styles.infoValue}>{servings}</Text>
                        <Text style={styles.infoLabel}>Portions</Text>
                    </NativeCard>
                    <NativeCard style={styles.infoCard}>
                        <SafeIcon name="ChefHat" size={24} color={modernColors.primary} type="lucide" />
                        <Text style={styles.infoValue}>
                            {recipe.difficulty === 'facile' ? 'Facile' :
                                recipe.difficulty === 'moyen' ? 'Moyen' : 'Difficile'}
                        </Text>
                        <Text style={styles.infoLabel}>Difficulté</Text>
                    </NativeCard>
                </View>

                {/* Description */}
                {recipe.description && (
                    <NativeCard style={styles.descriptionCard}>
                        <Text style={styles.descriptionText}>{recipe.description}</Text>
                    </NativeCard>
                )}

                {/* Ajuster portions */}
                <NativeCard style={styles.servingsCard}>
                    <Text style={styles.sectionTitle}>Nombre de portions</Text>
                    <View style={styles.servingsControls}>
                        <TouchableOpacity
                            style={styles.servingsButton}
                            onPress={() => adjustServings(servings - 1)}
                        >
                            <SafeIcon name="minus" size={20} color={modernColors.primary} type="lucide" />
                        </TouchableOpacity>
                        <Text style={styles.servingsValue}>{servings}</Text>
                        <TouchableOpacity
                            style={styles.servingsButton}
                            onPress={() => adjustServings(servings + 1)}
                        >
                            <SafeIcon name="plus" size={20} color={modernColors.primary} type="lucide" />
                        </TouchableOpacity>
                    </View>
                </NativeCard>

                {/* Ingrédients */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ingrédients</Text>
                    <NativeCard style={styles.ingredientsCard}>
                        {recipe.ingredients.map((ingredient, index) => (
                            <View key={index} style={styles.ingredientRow}>
                                <View style={styles.ingredientDot} />
                                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                                <Text style={styles.ingredientQuantity}>
                                    {calculateAdjustedQuantity(ingredient.quantity)} {ingredient.unit}
                                </Text>
                            </View>
                        ))}
                    </NativeCard>
                </View>

                {/* Instructions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Instructions</Text>
                    <NativeCard style={styles.instructionsCard}>
                        {recipe.instructions.map((instruction, index) => (
                            <View key={index} style={styles.instructionStep}>
                                <View style={styles.stepNumber}>
                                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                                </View>
                                <Text style={styles.instructionText}>{instruction}</Text>
                            </View>
                        ))}
                    </NativeCard>
                </View>

                {/* Nutrition */}
                {recipe.nutrition_per_serving && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Valeurs nutritionnelles (par portion)</Text>
                        <NativeCard style={styles.nutritionCard}>
                            <View style={styles.nutritionRow}>
                                <View style={styles.nutritionItem}>
                                    <Text style={styles.nutritionLabel}>Calories</Text>
                                    <Text style={styles.nutritionValue}>
                                        {recipe.nutrition_per_serving.calories} kcal
                                    </Text>
                                </View>
                                <View style={styles.nutritionItem}>
                                    <Text style={styles.nutritionLabel}>Protéines</Text>
                                    <Text style={styles.nutritionValue}>
                                        {recipe.nutrition_per_serving.proteins} g
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.nutritionRow}>
                                <View style={styles.nutritionItem}>
                                    <Text style={styles.nutritionLabel}>Glucides</Text>
                                    <Text style={styles.nutritionValue}>
                                        {recipe.nutrition_per_serving.carbs} g
                                    </Text>
                                </View>
                                <View style={styles.nutritionItem}>
                                    <Text style={styles.nutritionLabel}>Lipides</Text>
                                    <Text style={styles.nutritionValue}>
                                        {recipe.nutrition_per_serving.fats} g
                                    </Text>
                                </View>
                            </View>
                        </NativeCard>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                    <NativeButton
                        title="Ajouter à la liste de courses"
                        onPress={() => {
                            navigation.navigate('ShoppingList' as never, {
                                recipeId: recipe.id,
                            } as never);
                        }}
                        style={styles.actionButton}
                    />
                    {recipe.video_url && (
                        <TouchableOpacity
                            style={styles.videoButton}
                            onPress={() => {
                                Linking.openURL(recipe.video_url!);
                            }}
                        >
                            <SafeIcon name="Play" size={20} color={modernColors.primary} type="lucide" />
                            <Text style={styles.videoButtonText}>Voir la vidéo</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 16,
        marginBottom: 24,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    recipeImage: {
        width: width,
        height: 250,
        resizeMode: 'cover',
    },
    recipeImagePlaceholder: {
        width: width,
        height: 250,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerGradient: {
        padding: 20,
        paddingTop: 50,
    },
    headerContent: {
        marginTop: 10,
    },
    backButtonHeader: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerInfo: {
        marginTop: 8,
    },
    recipeName: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 4,
    },
    cuisineStyle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    infoCards: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        marginTop: -40,
    },
    infoCard: {
        flex: 1,
        padding: 16,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    infoValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginTop: 8,
    },
    infoLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    descriptionCard: {
        padding: 16,
        marginHorizontal: 16,
        marginTop: 8,
    },
    descriptionText: {
        fontSize: 16,
        color: '#111827',
        lineHeight: 24,
    },
    servingsCard: {
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
    },
    servingsControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        marginTop: 12,
    },
    servingsButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    servingsValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        minWidth: 40,
        textAlign: 'center',
    },
    section: {
        padding: 16,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    ingredientsCard: {
        padding: 16,
    },
    ingredientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    ingredientDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.primary,
    },
    ingredientName: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    ingredientQuantity: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    instructionsCard: {
        padding: 16,
    },
    instructionStep: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    stepNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    stepNumberText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    instructionText: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
        lineHeight: 24,
    },
    nutritionCard: {
        padding: 16,
    },
    nutritionRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    nutritionItem: {
        flex: 1,
    },
    nutritionLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    nutritionValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    actionsContainer: {
        padding: 16,
        gap: 12,
    },
    actionButton: {
        marginTop: 8,
    },
    videoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    videoButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    backButton: {
        marginTop: 24,
    },
});

export default RecipeDetailsScreen;

