// ✅ Écran Hub Planification Menus
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Keyboard,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useToaster } from '../../components/ToasterProvider';
import { useLocationSafe } from '../../contexts/LocationContext';
import { useAIWithFallback } from '../../hooks/useAIWithFallback';
import { FamilyProfile, GeneratedRecipe, menuPlanningService, WeeklyMenu } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';
import { generateAndDownloadRecipePDF, shareRecipePDF } from '../../utils/recipePdfGenerator';

// ✅ NOUVEAU: Helper pour extraire le nombre de servings
const getServingsNumber = (servings: any): number => {
    if (typeof servings === 'number') {
        return servings;
    }
    if (servings && typeof servings === 'object' && 'number' in servings) {
        return servings.number;
    }
    return 0;
};

const { width } = Dimensions.get('window');

interface MenuPlanningHubScreenProps { }

type MenuPeriod = '1_week' | '2_weeks' | '1_month';

const MenuPlanningHubScreen: React.FC<MenuPlanningHubScreenProps> = () => {
    const navigation = useNavigation();
    const { location, getCurrentLocation } = useLocationSafe();
    const { callWithFallback } = useAIWithFallback();
    const toaster = useToaster();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState<FamilyProfile | null>(null);
    const [currentMenu, setCurrentMenu] = useState<WeeklyMenu | null>(null);
    const [hasProfile, setHasProfile] = useState(false);
    const [menuPeriod, setMenuPeriod] = useState<MenuPeriod>('1_week');
    const [showPeriodSelector, setShowPeriodSelector] = useState(false);
    const [historyMenus, setHistoryMenus] = useState<any[]>([]);
    const [historyShoppingLists, setHistoryShoppingLists] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // ✅ NOUVEAU: États pour le modal de recette
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [showRecipeDetails, setShowRecipeDetails] = useState(false);
    const [recipeRequest, setRecipeRequest] = useState('');
    const [loadingRecipe, setLoadingRecipe] = useState(false);
    const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
    const [exportingRecipePDF, setExportingRecipePDF] = useState(false);

    // ✅ SUPPRIMÉ: Plus besoin de focus automatique qui cause des tremblements

    useFocusEffect(
        useCallback(() => {
            loadData();
            loadHistory();
        }, [])
    );

    const loadData = async () => {
        try {
            setLoading(true);

            // Charger profil famille
            const profileResponse = await menuPlanningService.getFamilyProfile();
            if (profileResponse.success && profileResponse.data?.profile) {
                setProfile(profileResponse.data.profile);
                setHasProfile(true);
            } else {
                setHasProfile(false);
            }

            // Charger menu de la semaine
            const menuResponse = await menuPlanningService.getMyWeekMenu();
            if (menuResponse.success && menuResponse.data?.menu_plan) {
                // Charger le menu complet si disponible
                // TODO: Charger le menu complet avec les repas
            }
        } catch (error) {
            console.error('[MenuPlanningHub] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await menuPlanningService.getHistory(10);
            if (response.success && response.data) {
                setHistoryMenus(response.data.menus || []);
                setHistoryShoppingLists(response.data.shopping_lists || []);
            }
        } catch (error) {
            console.error('[MenuPlanningHub] Erreur chargement historique:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    // ✅ REFONDU: Générer une recette via IA avec fallback 3 niveaux (ne plante plus jamais)
    const handleGenerateRecipe = async () => {
        if (!recipeRequest.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer le nom d\'un plat');
            return;
        }

        Keyboard.dismiss();
        setLoadingRecipe(true);

        const result = await callWithFallback(
            async () => {
                const response = await menuPlanningService.generateRecipe(recipeRequest.trim());
                let recipe: GeneratedRecipe | null = null;
                if (response) {
                    const rd: any = response.data;
                    recipe = rd?.recipe || (rd?.recipe_name ? rd as GeneratedRecipe : null) || (response as any).recipe || rd?.data?.recipe || null;
                }
                if (recipe && recipe.recipe_name) return recipe;
                return null;
            },
            'cuisine_recette',
            `Générer recette: ${recipeRequest.trim()}`,
            () => {
                const name = recipeRequest.trim();
                return {
                    recipe_name: name,
                    description: `Recette traditionnelle de ${name}. Recette générée localement — consultez un livre de cuisine pour les détails.`,
                    cuisine_style: 'camerounaise',
                    meal_type: ['dejeuner', 'diner'],
                    difficulty: 'moyen',
                    prep_time_minutes: 30,
                    cook_time_minutes: 45,
                    servings: { number: 4, size: 'portions' },
                    ingredients: [
                        { name: 'Ingrédient principal', quantity: 500, unit: 'g' },
                        { name: 'Huile', quantity: 3, unit: 'cuillères à soupe' },
                        { name: 'Oignon', quantity: 2, unit: 'pièces' },
                        { name: 'Sel et poivre', quantity: 1, unit: 'pincée' },
                    ],
                    instructions: [
                        'Préparer et laver tous les ingrédients.',
                        'Faire chauffer l\'huile dans une marmite.',
                        'Ajouter les oignons et faire revenir 5 min.',
                        'Ajouter l\'ingrédient principal et cuire à feu moyen.',
                        'Assaisonner et servir chaud.',
                    ],
                    nutrition_per_serving: { calories: 350, proteins: 25, carbs: 40, fats: 12, fiber: 5 },
                    tips: ['Servir avec du riz ou des plantains.'],
                    estimated_cost: 2500,
                } as GeneratedRecipe;
            }
        );

        if (result.success && result.data) {
            setGeneratedRecipe(result.data);
            setShowRecipeModal(false);
            setRecipeRequest('');
            setLoadingRecipe(false);
            if (result.source === 'local') {
                toaster?.show?.('Recette générée localement — résultats approximatifs', 'info');
            }
            setTimeout(() => setShowRecipeDetails(true), 200);
        } else {
            Alert.alert('Erreur', 'Impossible de générer la recette. Réessayez plus tard.');
            setLoadingRecipe(false);
        }
    };

    const handleGenerateMenu = async () => {
        if (!hasProfile || !profile) {
            Alert.alert(
                'Profil requis',
                'Veuillez d\'abord configurer votre profil famille',
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Configurer',
                        onPress: () => navigation.navigate('FamilyProfile' as never),
                    },
                ]
            );
            return;
        }

        try {
            setLoading(true);

            // ✅ NOUVEAU: Récupérer la localisation actuelle dynamiquement
            let currentGps: string | undefined;
            try {
                // Vérifier que getCurrentLocation est disponible
                if (getCurrentLocation && typeof getCurrentLocation === 'function') {
                    const currentLocation = location || await getCurrentLocation();
                    if (currentLocation?.coords) {
                        // Format: "lat,lng" pour le backend
                        currentGps = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
                        console.log('[MenuPlanningHub] Localisation actuelle envoyée:', currentGps);
                    }
                } else if (location?.coords) {
                    // Utiliser la location déjà disponible
                    currentGps = `${location.coords.latitude},${location.coords.longitude}`;
                    console.log('[MenuPlanningHub] Localisation disponible utilisée:', currentGps);
                }
            } catch (error) {
                console.warn('[MenuPlanningHub] Impossible de récupérer la localisation actuelle, utilisation du GPS stocké:', error);
                // Continue sans GPS actuel, le backend utilisera le GPS stocké
            }

            // Calculer la date de début selon la période choisie
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay() + 1); // Lundi de cette semaine

            // Générer le menu avec le profil utilisateur réel et la localisation actuelle
            const response = await menuPlanningService.generateWeeklyMenu(
                weekStart.toISOString().split('T')[0],
                {
                    ...profile,
                    // S'assurer que toutes les données du profil sont passées
                    total_members: profile.total_members,
                    allergies: profile.allergies || [],
                    preferences: profile.preferences || [],
                    budget_monthly: profile.budget_monthly,
                    dietary_restrictions: profile.dietary_restrictions || [],
                },
                currentGps // ✅ Envoi de la localisation actuelle pour contextualisation dynamique
            );

            if (response.success && response.data) {
                setCurrentMenu(response.data.menu);
                setShowPeriodSelector(false);
                Alert.alert(
                    'Menu généré !',
                    `Votre menu ${menuPeriod === '1_week' ? 'hebdomadaire' : menuPeriod === '2_weeks' ? 'bi-hebdomadaire (15 jours)' : 'mensuel'} a été généré avec succès`,
                    [
                        {
                            text: 'Voir le menu',
                            onPress: () => {
                                navigation.navigate('MenuWeekCalendar' as never, {
                                    menu: response.data.menu,
                                    period: menuPeriod,
                                } as never);
                            },
                        },
                    ]
                );
            }
        } catch (error: any) {
            console.error('[MenuPlanningHub] Erreur génération:', error);
            Alert.alert('Erreur', error.message || 'Erreur lors de la génération du menu');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !currentMenu) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => {
                    setRefreshing(true);
                    loadData();
                    loadHistory();
                }} />
            }
            showsVerticalScrollIndicator={false}
        >
            {/* Header avec gradient */}
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
                        <SafeIcon name="UtensilsCrossed" size={32} color="#fff" type="lucide" />
                        <Text style={styles.headerTitle}>Planification Menus</Text>
                    </View>
                    <Text style={styles.headerSubtitle}>
                        Organisez vos repas de la semaine
                    </Text>
                    {/* ✅ NOUVEAU: Bouton profil famille en haut à droite */}
                    <TouchableOpacity
                        onPress={() => navigation.navigate('FamilyProfile' as never)}
                        style={styles.headerProfileButton}
                    >
                        <SafeIcon name="UserPlus" size={20} color="#fff" type="lucide" />
                        {hasProfile && profile && typeof profile.total_members === 'number' && profile.total_members > 0 && (
                            <View style={styles.profileBadge}>
                                <Text style={styles.profileBadgeText}>{profile.total_members}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* ✅ RÉORGANISÉ: Section profil famille EN HAUT (priorité) - Version compacte */}
            <View style={[styles.section, styles.profileSectionTop]}>
                <NativeCard style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <View style={styles.profileHeaderLeft}>
                            <SafeIcon name="Users" size={18} color={modernColors.primary} type="lucide" />
                            <Text style={styles.profileSectionTitle}>Profil Famille</Text>
                        </View>
                        {/* ✅ NOUVEAU: Bouton miniaturisé en haut à droite */}
                        <TouchableOpacity
                            onPress={() => navigation.navigate('FamilyProfile' as never)}
                            style={styles.profileEditButton}
                        >
                            <SafeIcon
                                name={hasProfile ? "Edit" : "Plus"}
                                size={16}
                                color={modernColors.primary}
                                type="lucide"
                            />
                        </TouchableOpacity>
                    </View>

                    {hasProfile && profile ? (
                        <View style={styles.profileInfoCompact}>
                            {/* ✅ SIMPLIFIÉ: Afficher seulement le nombre total de personnes */}
                            {typeof profile.total_members === 'number' && profile.total_members > 0 ? (
                                <Text style={styles.profileTextCompact}>
                                    👥 {profile.total_members} personne{profile.total_members > 1 ? 's' : ''} dans la famille
                                </Text>
                            ) : (
                                <Text style={styles.profileTextCompact}>
                                    👥 Profil configuré
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.profileEmptyText}>
                            Aucun profil configuré
                        </Text>
                    )}
                </NativeCard>
            </View>

            {/* ✅ RÉORGANISÉ: Section génération menu (fonctionnalité principale) */}
            <View style={[styles.section, styles.menuSection]}>
                <Text style={styles.sectionTitle}>Menu de la Semaine</Text>

                {currentMenu ? (
                    <NativeCard style={styles.menuCard}>
                        <View style={styles.menuHeader}>
                            <Text style={styles.menuWeekText}>
                                Semaine du {new Date(currentMenu.week_start).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                })}
                            </Text>
                            {currentMenu.total_estimated_cost && (
                                <Text style={styles.menuCostText}>
                                    💰 {currentMenu.total_estimated_cost.toLocaleString()} FCFA
                                </Text>
                            )}
                        </View>

                        <View style={styles.menuActions}>
                            <NativeButton
                                title="Voir le calendrier"
                                onPress={() => {
                                    navigation.navigate('MenuWeekCalendar' as never, {
                                        menu: currentMenu,
                                    } as never);
                                }}
                                style={styles.menuActionButton}
                            />
                            <NativeButton
                                title="Liste de courses"
                                variant="outline"
                                onPress={() => {
                                    navigation.navigate('ShoppingList' as never, {
                                        weekStart: currentMenu.week_start,
                                    } as never);
                                }}
                                style={styles.menuActionButton}
                            />
                        </View>
                    </NativeCard>
                ) : (
                    <NativeCard style={styles.generateCard}>
                        <SafeIcon name="utensils-crossed" size={48} color={modernColors.primary} type="lucide" />
                        <Text style={styles.generateTitle}>
                            Générez votre menu personnalisé
                        </Text>
                        <Text style={styles.generateSubtitle}>
                            Notre IA vous propose un menu personnalisé selon vos préférences et votre budget
                        </Text>

                        {/* Sélecteur de période */}
                        <View style={styles.periodSelector}>
                            <Text style={styles.periodLabel}>Période du menu :</Text>
                            <View style={styles.periodButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.periodButton,
                                        menuPeriod === '1_week' && styles.periodButtonActive
                                    ]}
                                    onPress={() => setMenuPeriod('1_week')}
                                >
                                    <Text style={[
                                        styles.periodButtonText,
                                        menuPeriod === '1_week' && styles.periodButtonTextActive
                                    ]}>
                                        1 semaine
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.periodButton,
                                        menuPeriod === '2_weeks' && styles.periodButtonActive
                                    ]}
                                    onPress={() => setMenuPeriod('2_weeks')}
                                >
                                    <Text style={[
                                        styles.periodButtonText,
                                        menuPeriod === '2_weeks' && styles.periodButtonTextActive
                                    ]}>
                                        15 jours
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.periodButton,
                                        menuPeriod === '1_month' && styles.periodButtonActive
                                    ]}
                                    onPress={() => setMenuPeriod('1_month')}
                                >
                                    <Text style={[
                                        styles.periodButtonText,
                                        menuPeriod === '1_month' && styles.periodButtonTextActive
                                    ]}>
                                        1 mois
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <NativeButton
                            title={`Générer le menu (${menuPeriod === '1_week' ? '1 semaine' : menuPeriod === '2_weeks' ? '15 jours' : '1 mois'})`}
                            onPress={handleGenerateMenu}
                            loading={loading}
                            style={styles.generateButton}
                        />
                    </NativeCard>
                )}
            </View>

            {/* ✅ NOUVEAU: Section historique des menus et listes d'achats */}
            {(historyMenus.length > 0 || historyShoppingLists.length > 0) && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Historique</Text>

                    {/* Historique des menus */}
                    {historyMenus.length > 0 && (
                        <View style={styles.historySubsection}>
                            <View style={styles.historySubsectionHeader}>
                                <SafeIcon name="Calendar" size={20} color={modernColors.primary} type="lucide" />
                                <Text style={styles.historySubsectionTitle}>Menus générés</Text>
                            </View>
                            {historyMenus.slice(0, 5).map((menu) => (
                                <TouchableOpacity
                                    key={menu.id}
                                    style={styles.historyItem}
                                    onPress={() => {
                                        // Naviguer vers le menu de cette semaine
                                        const weekStart = new Date(menu.week_start);
                                        navigation.navigate('MenuWeekCalendar' as never, {
                                            weekStart: menu.week_start,
                                        } as never);
                                    }}
                                >
                                    <View style={styles.historyItemContent}>
                                        <Text style={styles.historyItemTitle}>
                                            Semaine du {new Date(menu.week_start).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                            })}
                                        </Text>
                                        <Text style={styles.historyItemSubtitle}>
                                            {menu.status === 'active' ? '✅ Actif' : '📋 Archivé'}
                                            {menu.total_budget && ` • ${menu.total_budget.toLocaleString()} FCFA`}
                                        </Text>
                                    </View>
                                    <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Historique des listes d'achats */}
                    {historyShoppingLists.length > 0 && (
                        <View style={styles.historySubsection}>
                            <View style={styles.historySubsectionHeader}>
                                <SafeIcon name="ShoppingCart" size={20} color={modernColors.success} type="lucide" />
                                <Text style={styles.historySubsectionTitle}>Listes d'achats</Text>
                            </View>
                            {historyShoppingLists.slice(0, 5).map((list) => (
                                <TouchableOpacity
                                    key={list.id}
                                    style={styles.historyItem}
                                    onPress={() => {
                                        navigation.navigate('ShoppingList' as never, {
                                            weekStart: list.week_start,
                                        } as never);
                                    }}
                                >
                                    <View style={styles.historyItemContent}>
                                        <Text style={styles.historyItemTitle}>
                                            Liste du {new Date(list.week_start).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                            })}
                                        </Text>
                                        <Text style={styles.historyItemSubtitle}>
                                            {list.items_count} article{list.items_count > 1 ? 's' : ''}
                                            {list.total_estimated_cost && ` • ${list.total_estimated_cost.toLocaleString()} FCFA`}
                                        </Text>
                                    </View>
                                    <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* Section actions rapides */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions Rapides</Text>

                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => setShowRecipeModal(true)}
                    >
                        <SafeIcon name="BookOpen" size={28} color="#3B82F6" type="lucide" />
                        <Text style={styles.quickActionText}>Recettes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => navigation.navigate('ShoppingList' as never)}
                    >
                        <SafeIcon name="ShoppingCart" size={28} color="#10B981" type="lucide" />
                        <Text style={styles.quickActionText}>Liste Courses</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => navigation.navigate('FamilyProfile' as never)}
                    >
                        <SafeIcon name="Settings" size={28} color="#8B5CF6" type="lucide" />
                        <Text style={styles.quickActionText}>Paramètres</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ✅ REFONDU: Modal pour demander une recette - SIMPLIFIÉ sans KeyboardAvoidingView */}
            <Modal
                visible={showRecipeModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    Keyboard.dismiss();
                    setShowRecipeModal(false);
                }}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalOverlayTouchable}
                        activeOpacity={1}
                        onPress={() => {
                            Keyboard.dismiss();
                            setShowRecipeModal(false);
                        }}
                    />
                    <View style={styles.modalContentRecipe}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Rechercher une recette</Text>
                            <TouchableOpacity onPress={() => {
                                Keyboard.dismiss();
                                setShowRecipeModal(false);
                            }}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalHint}>
                                Entrez le nom d'un plat pour générer sa recette complète.
                            </Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nom du plat *</Text>
                                <TextInput
                                    value={recipeRequest}
                                    onChangeText={setRecipeRequest}
                                    placeholder="Ex: Ndolé, Poulet DG, Riz au gras..."
                                    placeholderTextColor="#9CA3AF"
                                    onSubmitEditing={handleGenerateRecipe}
                                    returnKeyType="search"
                                    style={styles.recipeInput}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="default"
                                />
                            </View>
                        </View>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => {
                                    Keyboard.dismiss();
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
                            <ScrollView
                                style={styles.modalBody}
                                removeClippedSubviews={true} // ✅ CORRIGÉ: Optimise les performances
                                scrollEventThrottle={16} // ✅ CORRIGÉ: Limite la fréquence des événements de scroll
                                showsVerticalScrollIndicator={true}
                                nestedScrollEnabled={true}
                                bounces={true}
                                keyboardShouldPersistTaps="handled"
                            >
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
                                        <Text style={styles.recipeInfoText}>{getServingsNumber(generatedRecipe.servings)} portions</Text>
                                    </View>
                                </View>

                                {/* Ingrédients */}
                                {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 && (
                                    <View style={styles.recipeSection}>
                                        <Text style={styles.recipeSectionTitle}>Ingrédients</Text>
                                        {generatedRecipe.ingredients.map((ingredient, index) => (
                                            <View key={index} style={styles.ingredientItem}>
                                                <Text style={styles.ingredientText}>
                                                    • {ingredient.name}: {typeof ingredient.quantity === 'object' && ingredient.quantity !== null ? ingredient.quantity.number : ingredient.quantity} {ingredient.unit}
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
                                        console.error('[MenuPlanningHub] Erreur partage recette PDF:', error);
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
        </ScrollView>
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
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        padding: 20,
        paddingTop: 50,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerContent: {
        marginTop: 10,
        position: 'relative',
    },
    headerProfileButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    profileBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#fff',
    },
    profileBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
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
    section: {
        padding: 16,
        marginTop: 8,
    },
    profileSectionTop: {
        marginTop: 0, // ✅ NOUVEAU: Pas de marge en haut pour être collé au header
        paddingTop: 12, // ✅ RÉDUIT: De 20 à 12 pour gagner de l'espace
        paddingBottom: 8, // ✅ RÉDUIT: Réduire le padding en bas
    },
    menuSection: {
        marginTop: -8, // ✅ NOUVEAU: Marge négative pour remonter le bloc
        paddingTop: 0,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    profileCard: {
        padding: 10, // ✅ RÉDUIT: De 12 à 10 pour version encore plus compacte
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // ✅ NOUVEAU: Espace entre titre et bouton
        marginBottom: 6, // ✅ RÉDUIT: De 8 à 6
    },
    profileHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1, // ✅ NOUVEAU: Prendre l'espace disponible
    },
    profileSectionTitle: {
        fontSize: 15, // ✅ RÉDUIT: De 16 à 15 pour version compacte
        fontWeight: '700',
        color: '#111827',
    },
    profileEditButton: {
        width: 32, // ✅ NOUVEAU: Bouton miniaturisé
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E7FF',
    },
    profileInfo: {
        marginBottom: 12,
    },
    profileInfoCompact: {
        marginBottom: 0, // ✅ RÉDUIT: De 8 à 0 pour gagner encore plus d'espace
    },
    profileText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    profileTextCompact: {
        fontSize: 12, // ✅ RÉDUIT: De 14 à 12 pour version compacte
        color: modernColors.textSecondary,
        marginBottom: 2, // ✅ RÉDUIT: De 4 à 2
    },
    profileEmptyText: {
        fontSize: 12, // ✅ RÉDUIT: De 14 à 12
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        marginBottom: 0, // ✅ RÉDUIT: De 12 à 0
    },
    menuCard: {
        padding: 16,
    },
    menuHeader: {
        marginBottom: 16,
    },
    menuWeekText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    menuCostText: {
        fontSize: 16,
        color: modernColors.primary,
        fontWeight: '600',
    },
    menuActions: {
        flexDirection: 'row',
        gap: 12,
    },
    menuActionButton: {
        flex: 1,
    },
    generateCard: {
        padding: 24,
        alignItems: 'center',
    },
    generateTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    generateSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    generateButton: {
        minWidth: 200,
    },
    quickActions: {
        flexDirection: 'row',
        gap: 12,
    },
    quickActionCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quickActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        marginTop: 8,
    },
    periodSelector: {
        width: '100%',
        marginBottom: 20,
    },
    periodLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
        textAlign: 'center',
    },
    periodButtons: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    periodButtonActive: {
        borderColor: modernColors.primary,
        backgroundColor: '#EEF2FF',
    },
    periodButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    periodButtonTextActive: {
        color: modernColors.primary,
    },
    historySubsection: {
        marginBottom: 20,
    },
    historySubsectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    historySubsectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    historyItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    historyItemContent: {
        flex: 1,
    },
    historyItemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    historyItemSubtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    // ✅ REFONDU: Styles pour modals recette - SIMPLIFIÉ
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalOverlayTouchable: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        minHeight: 400,
        paddingBottom: 20,
    },
    modalContentRecipe: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '60%',
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    recipeInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#fff',
        fontSize: 16,
        color: '#111827',
        minHeight: 48,
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
        padding: 16, // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen qui fonctionne bien
        maxHeight: 500, // ✅ CORRIGÉ: Hauteur maximale pour éviter les changements de layout
        flexGrow: 1, // ✅ CORRIGÉ: Permet au contenu de grandir sans causer de tremblement
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
    modalHint: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    // ✅ NOUVEAU: Styles pour affichage recette
    recipeHeader: {
        marginBottom: 16, // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
    },
    recipeTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    recipeDescription: {
        fontSize: 14, // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
        color: '#6B7280', // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
        lineHeight: 20, // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
    },
    recipeInfoRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16, // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
        paddingBottom: 16, // ✅ CORRIGÉ: Ajouté pour correspondre au style qui fonctionne
        borderBottomWidth: 1, // ✅ CORRIGÉ: Ajouté pour correspondre au style qui fonctionne
        borderBottomColor: '#E5E7EB', // ✅ CORRIGÉ: Ajouté pour correspondre au style qui fonctionne
        flexWrap: 'wrap',
    },
    recipeInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        // ✅ CORRIGÉ: Retiré paddingHorizontal, paddingVertical, backgroundColor, borderRadius pour correspondre au style qui fonctionne
    },
    recipeInfoText: {
        fontSize: 12, // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
        color: '#6B7280', // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
        // ✅ CORRIGÉ: Retiré fontWeight pour correspondre au style qui fonctionne
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
        marginBottom: 8, // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
        padding: 12,
        backgroundColor: '#FFFBEB', // ✅ CORRIGÉ: Aligné avec MenuWeekCalendarScreen
        borderRadius: 8,
        borderWidth: 1, // ✅ CORRIGÉ: Ajouté pour correspondre au style qui fonctionne
        borderColor: '#FEF3C7', // ✅ CORRIGÉ: Ajouté pour correspondre au style qui fonctionne
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

export default MenuPlanningHubScreen;

