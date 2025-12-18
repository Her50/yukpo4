// ✅ Écran Calendrier Semaine - Planification Menus
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { DailyMeal, WeeklyMenu } from '../../services/menuPlanningService';
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

    const renderMealItem = (meal: any, mealType: string, icon: string) => {
        if (!meal) return null;

        return (
            <TouchableOpacity
                key={mealType}
                style={styles.mealCard}
                onPress={() => {
                    if (meal.recipe_id) {
                        navigation.navigate('RecipeDetails' as never, { recipeId: meal.recipe_id } as never);
                    }
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
});

export default MenuWeekCalendarScreen;

