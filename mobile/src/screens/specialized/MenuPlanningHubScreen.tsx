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

const { width } = Dimensions.get('window');

interface MenuPlanningHubScreenProps { }

const MenuPlanningHubScreen: React.FC<MenuPlanningHubScreenProps> = () => {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState<FamilyProfile | null>(null);
    const [currentMenu, setCurrentMenu] = useState<WeeklyMenu | null>(null);
    const [hasProfile, setHasProfile] = useState(false);

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
        if (!hasProfile) {
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
            const response = await menuPlanningService.generateWeeklyMenu();

            if (response.success && response.data) {
                setCurrentMenu(response.data.menu);
                Alert.alert(
                    'Menu généré !',
                    'Votre menu hebdomadaire a été généré avec succès',
                    [
                        {
                            text: 'Voir le menu',
                            onPress: () => {
                                navigation.navigate('MenuWeekCalendar' as never, {
                                    menu: response.data.menu,
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
                                👥 {profile.total_members} personne{profile.total_members > 1 ? 's' : ''}
                            </Text>
                            {profile.allergies.length > 0 && (
                                <Text style={styles.profileText}>
                                    ⚠️ Allergies : {profile.allergies.join(', ')}
                                </Text>
                            )}
                            {profile.budget_monthly && (
                                <Text style={styles.profileText}>
                                    💰 Budget : {profile.budget_monthly.toLocaleString()} FCFA/mois
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
                            Générez votre menu hebdomadaire
                        </Text>
                        <Text style={styles.generateSubtitle}>
                            Notre IA vous propose un menu personnalisé selon vos préférences et votre budget
                        </Text>
                        <NativeButton
                            title="Générer le menu"
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
});

export default MenuPlanningHubScreen;

