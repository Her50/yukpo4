// ✅ Écran Calendrier Semaine - Planification Menus
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { DailyMeal, GeneratedRecipe, menuPlanningService, WeeklyMenu } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';

const { width } = Dimensions.get('window');

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface MenuWeekCalendarScreenProps { }

const MenuWeekCalendarScreen: React.FC<MenuWeekCalendarScreenProps> = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const menu: WeeklyMenu | undefined = route.params?.menu;

    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() === 0 ? 7 : new Date().getDay());
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [recipeRequest, setRecipeRequest] = useState('');
    const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
    const [loadingRecipe, setLoadingRecipe] = useState(false);
    const [showRecipeDetails, setShowRecipeDetails] = useState(false);

    if (!menu) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement du menu...</Text>
            </View>
        );
    }

    const getDayMeal = (day: number): DailyMeal | undefined => {
        return menu.meals.find((m) => m.day === day);
    };

    // ✅ NOUVEAU: Générer une recette via IA
    const handleGenerateRecipe = async () => {
        if (!recipeRequest.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer le nom d\'un plat');
            return;
        }

        try {
            setLoadingRecipe(true);
            const response = await menuPlanningService.generateRecipe(recipeRequest.trim());
            
            if (response.success && response.data?.recipe) {
                setGeneratedRecipe(response.data.recipe);
                setShowRecipeModal(false);
                setShowRecipeDetails(true);
                setRecipeRequest('');
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de générer la recette');
            }
        } catch (error: any) {
            console.error('[MenuWeekCalendar] Erreur génération recette:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoadingRecipe(false);
        }
    };

    // ✅ NOUVEAU: Demander recette d'un plat du menu
    const handleRequestRecipeFromMenu = (recipeName: string) => {
        setRecipeRequest(recipeName);
        setShowRecipeModal(true);
    };

    const renderMealItem = (meal: any, mealType: string, icon: string) => {
        if (!meal) return null;

        return (
            <TouchableOpacity
                key={mealType}
                style={styles.mealCard}
                onPress={() => {
                    // ✅ NOUVEAU: Demander la recette via IA
                    handleRequestRecipeFromMenu(meal.recipe_name);
                }}
            >
                <View style={styles.mealHeader}>
                    <SafeIcon name={icon} size={20} color={modernColors.primary} type="lucide" />
                    <Text style={styles.mealTypeText}>
                        {mealType === 'petit_dejeuner' ? 'Petit-déj' :
                            mealType === 'dejeuner' ? 'Déjeuner' :
                                mealType === 'diner' ? 'Dîner' : 'Goûter'}
                    </Text>
                </View>
                <Text style={styles.mealName}>{meal.recipe_name}</Text>
                <View style={styles.mealInfo}>
                    {meal.prep_time_minutes && (
                        <Text style={styles.mealInfoText}>⏱ {meal.prep_time_minutes} min</Text>
                    )}
                    {meal.estimated_cost && (
                        <Text style={styles.mealInfoText}>💰 {meal.estimated_cost.toLocaleString()} FCFA</Text>
                    )}
                    <Text style={styles.mealInfoText}>👥 {meal.servings} portions</Text>
                </View>
                <View style={styles.recipeButtonContainer}>
                    <TouchableOpacity
                        style={styles.recipeButton}
                        onPress={() => handleRequestRecipeFromMenu(meal.recipe_name)}
                    >
                        <SafeIcon name="ChefHat" size={16} color={modernColors.primary} type="lucide" />
                        <Text style={styles.recipeButtonText}>Voir la recette</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const selectedMeal = getDayMeal(selectedDay);

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#F59E0B', '#F97316']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Menu de la Semaine</Text>
                        <Text style={styles.headerSubtitle}>
                            {new Date(menu.week_start).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                            })}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Sélecteur de jours */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.daysSelector}
                contentContainerStyle={styles.daysSelectorContent}
            >
                {DAYS.map((day, index) => {
                    const dayNumber = index + 1;
                    const isSelected = selectedDay === dayNumber;
                    const hasMeal = getDayMeal(dayNumber);

                    return (
                        <TouchableOpacity
                            key={dayNumber}
                            style={[
                                styles.dayButton,
                                isSelected && styles.dayButtonSelected,
                            ]}
                            onPress={() => setSelectedDay(dayNumber)}
                        >
                            <Text
                                style={[
                                    styles.dayButtonText,
                                    isSelected && styles.dayButtonTextSelected,
                                ]}
                            >
                                {DAYS_SHORT[index]}
                            </Text>
                            {hasMeal && (
                                <View style={styles.dayIndicator} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Repas du jour sélectionné */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {selectedMeal ? (
                    <View style={styles.mealsContainer}>
                        <Text style={styles.dayTitle}>{selectedMeal.day_name}</Text>

                        {renderMealItem(selectedMeal.petit_dejeuner, 'petit_dejeuner', 'Sunrise')}
                        {renderMealItem(selectedMeal.dejeuner, 'dejeuner', 'Sun')}
                        {renderMealItem(selectedMeal.diner, 'diner', 'Moon')}
                        {renderMealItem(selectedMeal.gouter, 'gouter', 'Coffee')}

                        {/* Statistiques du jour */}
                        <NativeCard style={styles.statsCard}>
                            <Text style={styles.statsTitle}>Statistiques du jour</Text>
                            <View style={styles.statsRow}>
                                {selectedMeal.petit_dejeuner?.calories && (
                                    <View style={styles.statItem}>
                                        <Text style={styles.statLabel}>Calories</Text>
                                        <Text style={styles.statValue}>
                                            {selectedMeal.petit_dejeuner.calories}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </NativeCard>
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="Calendar" size={48} color={modernColors.textSecondary} type="lucide" />
                        <Text style={styles.emptyText}>
                            Aucun repas planifié pour ce jour
                        </Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                            navigation.navigate('ShoppingList' as never, {
                                weekStart: menu.week_start,
                            } as never);
                        }}
                    >
                        <SafeIcon name="ShoppingCart" size={20} color="#fff" type="lucide" />
                        <Text style={styles.actionButtonText}>Liste de courses</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* ✅ NOUVEAU: Modal pour demander une recette */}
            <Modal
                visible={showRecipeModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowRecipeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Demander une recette</Text>
                            <TouchableOpacity onPress={() => setShowRecipeModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.modalHint}>
                                Entrez le nom d'un plat pour générer sa recette complète. 
                                Vous pouvez demander un plat de votre menu ou un autre plat.
                            </Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nom du plat *</Text>
                                <NativeInput
                                    value={recipeRequest}
                                    onChangeText={setRecipeRequest}
                                    placeholder="Ex: Ndolé, Poulet DG, Riz au gras..."
                                    autoFocus
                                />
                            </View>

                            {/* Suggestions de plats du menu */}
                            {menu && (
                                <View style={styles.suggestionsContainer}>
                                    <Text style={styles.suggestionsTitle}>Plats de votre menu</Text>
                                    <View style={styles.suggestionsList}>
                                        {Array.from(new Set(
                                            menu.meals.flatMap(m => [
                                                m.petit_dejeuner?.recipe_name,
                                                m.dejeuner?.recipe_name,
                                                m.diner?.recipe_name,
                                                m.gouter?.recipe_name,
                                            ].filter(Boolean))
                                        )).map((recipeName, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.suggestionChip}
                                                onPress={() => {
                                                    setRecipeRequest(recipeName as string);
                                                }}
                                            >
                                                <Text style={styles.suggestionText}>{recipeName}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => {
                                    setShowRecipeModal(false);
                                    setRecipeRequest('');
                                }}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={loadingRecipe ? 'Génération...' : 'Générer la recette'}
                                onPress={handleGenerateRecipe}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={!recipeRequest.trim() || loadingRecipe}
                                loading={loadingRecipe}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal pour afficher la recette générée */}
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
    header: {
        padding: 20,
        paddingTop: 50,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerContent: {
        marginTop: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitleContainer: {
        marginTop: 8,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 4,
    },
    daysSelector: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    daysSelectorContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    dayButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        minWidth: 60,
        alignItems: 'center',
        position: 'relative',
    },
    dayButtonSelected: {
        backgroundColor: modernColors.primary,
    },
    dayButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    dayButtonTextSelected: {
        color: '#fff',
    },
    dayIndicator: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: modernColors.success,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    mealsContainer: {
        gap: 12,
    },
    dayTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    mealCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    mealHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    mealTypeText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    mealName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    mealInfo: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
    },
    mealInfoText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    statsCard: {
        padding: 16,
        marginTop: 8,
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginTop: 16,
        textAlign: 'center',
    },
    actionsContainer: {
        marginTop: 24,
        gap: 12,
    },
    actionButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    recipeActionButton: {
        backgroundColor: '#8B5CF6',
    },
    recipeButtonContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    recipeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
    },
    recipeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    // ✅ NOUVEAU: Styles pour modals recette
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalBody: {
        padding: 16,
        maxHeight: 500,
    },
    modalHint: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    suggestionsContainer: {
        marginTop: 16,
    },
    suggestionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    suggestionsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    suggestionChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionText: {
        fontSize: 12,
        color: '#374151',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    modalButton: {
        flex: 1,
    },
    // ✅ NOUVEAU: Styles pour affichage recette
    recipeHeader: {
        marginBottom: 16,
    },
    recipeTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    recipeDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    recipeInfoRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    recipeInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    recipeInfoText: {
        fontSize: 12,
        color: '#6B7280',
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
        marginBottom: 12,
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
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    instructionText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
        padding: 12,
        backgroundColor: '#FFFBEB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FEF3C7',
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
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        alignItems: 'center',
    },
    nutritionLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    nutritionValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    costText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
});

export default MenuWeekCalendarScreen;

