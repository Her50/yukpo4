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
    const [historyMenus, setHistoryMenus] = useState<any[]>([]);
    const [historyShoppingLists, setHistoryShoppingLists] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

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
});

export default MenuPlanningHubScreen;

