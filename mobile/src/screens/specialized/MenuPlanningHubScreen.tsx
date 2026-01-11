// ✅ Écran Hub Planification Menus
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { FamilyProfile, menuPlanningService, WeeklyMenu } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';
import { useLocationSafe } from '../../contexts/LocationContext';

const { width } = Dimensions.get('window');

interface MenuPlanningHubScreenProps { }

type MenuPeriod = '1_week' | '2_weeks' | '1_month';

const MenuPlanningHubScreen: React.FC<MenuPlanningHubScreenProps> = () => {
    const navigation = useNavigation();
    const { location, getCurrentLocation } = useLocationSafe();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState<FamilyProfile | null>(null);
    const [currentMenu, setCurrentMenu] = useState<WeeklyMenu | null>(null);
    const [hasProfile, setHasProfile] = useState(false);
    const [menuPeriod, setMenuPeriod] = useState<MenuPeriod>('1_week');
    const [showPeriodSelector, setShowPeriodSelector] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadData();
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
                </View>
            </LinearGradient>

            {/* Section profil famille */}
            <View style={styles.section}>
                <NativeCard style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <SafeIcon name="Users" size={24} color={modernColors.primary} type="lucide" />
                        <Text style={styles.sectionTitle}>Profil Famille</Text>
                    </View>

                    {hasProfile && profile ? (
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileText}>
                                👥 {profile.total_members || 1} personne{(profile.total_members || 1) > 1 ? 's' : ''}
                            </Text>
                            {profile.children_count !== undefined && profile.children_count > 0 && (
                                <Text style={styles.profileText}>
                                    👶 {profile.children_count} enfant{profile.children_count > 1 ? 's' : ''}
                                </Text>
                            )}
                            {profile.adults_count !== undefined && profile.adults_count > 0 && (
                                <Text style={styles.profileText}>
                                    👤 {profile.adults_count} adulte{profile.adults_count > 1 ? 's' : ''}
                                </Text>
                            )}
                            {profile.allergies && Array.isArray(profile.allergies) && profile.allergies.length > 0 && (
                                <Text style={styles.profileText}>
                                    ⚠️ Allergies : {profile.allergies.filter(a => a && a !== 'false' && a !== false).join(', ')}
                                </Text>
                            )}
                            {profile.budget_monthly && typeof profile.budget_monthly === 'number' && profile.budget_monthly > 0 && (
                                <Text style={styles.profileText}>
                                    💰 Budget : {profile.budget_monthly.toLocaleString()} FCFA/mois
                                </Text>
                            )}
                            {profile.preferences && Array.isArray(profile.preferences) && profile.preferences.length > 0 && (
                                <Text style={styles.profileText}>
                                    🍽️ Préférences : {profile.preferences.filter(p => p && p !== 'false' && p !== false).join(', ')}
                                </Text>
                            )}
                            {profile.dietary_restrictions && Array.isArray(profile.dietary_restrictions) && profile.dietary_restrictions.length > 0 && (
                                <Text style={styles.profileText}>
                                    🥗 Restrictions : {profile.dietary_restrictions.filter(r => r && r !== 'false' && r !== false).join(', ')}
                                </Text>
                            )}
                            {profile.cuisine_styles && Array.isArray(profile.cuisine_styles) && profile.cuisine_styles.length > 0 && (
                                <Text style={styles.profileText}>
                                    🍳 Styles de cuisine : {profile.cuisine_styles.filter(c => c && c !== 'false' && c !== false).join(', ')}
                                </Text>
                            )}
                            {profile.cooking_level && typeof profile.cooking_level === 'string' && profile.cooking_level !== 'false' && (
                                <Text style={styles.profileText}>
                                    👨‍🍳 Niveau : {profile.cooking_level}
                                </Text>
                            )}
                            {profile.time_available_hours && typeof profile.time_available_hours === 'number' && profile.time_available_hours > 0 && (
                                <Text style={styles.profileText}>
                                    ⏰ Temps disponible : {profile.time_available_hours}h/jour
                                </Text>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.profileEmptyText}>
                            Aucun profil configuré
                        </Text>
                    )}

                    <NativeButton
                        title={hasProfile ? "Modifier le profil" : "Créer un profil"}
                        variant="outline"
                        onPress={() => navigation.navigate('FamilyProfile' as never)}
                        style={styles.profileButton}
                    />
                </NativeCard>
            </View>

            {/* Section génération menu */}
            <View style={styles.section}>
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
                        <SafeIcon name="ChefHat" size={48} color={modernColors.primary} type="lucide" />
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

            {/* Section actions rapides */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions Rapides</Text>

                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => navigation.navigate('RecipeSearch' as never)}
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
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    profileCard: {
        padding: 16,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    profileInfo: {
        marginBottom: 12,
    },
    profileText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    profileEmptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        marginBottom: 12,
    },
    profileButton: {
        marginTop: 8,
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
});

export default MenuPlanningHubScreen;

