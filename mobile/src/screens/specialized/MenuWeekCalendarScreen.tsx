// ✅ Écran Calendrier Semaine - Planification Menus (VERSION TABLEAU)
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect } from 'react';
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
import { DailyMeal, FamilyProfile, GeneratedRecipe, menuPlanningService, WeeklyMenu } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';
import { useShoppingContext } from '../../contexts/ShoppingContext';
import { generateAndDownloadMenuPDF, shareMenuPDF } from '../../utils/menuPdfGenerator';
import { generateAndDownloadShoppingListPDF, shareShoppingListPDF } from '../../utils/shoppingListPdfGenerator';
import { generateAndDownloadRecipePDF, shareRecipePDF } from '../../utils/recipePdfGenerator';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { deliveryApi, userApi } from '../../services/api';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface MenuWeekCalendarScreenProps { }

const MenuWeekCalendarScreen: React.FC<MenuWeekCalendarScreenProps> = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const menu: WeeklyMenu | undefined = route.params?.menu;
    const { currency } = useShoppingContext();

    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [recipeRequest, setRecipeRequest] = useState('');
    const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
    const [loadingRecipe, setLoadingRecipe] = useState(false);
    const [showRecipeDetails, setShowRecipeDetails] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'list'>('table'); // ✅ NOUVEAU: Mode d'affichage
    const [exportingPDF, setExportingPDF] = useState(false);
    const [exportingRecipePDF, setExportingRecipePDF] = useState(false);
    const { user } = useAuth();
    // ✅ NOUVEAU: États pour tableau intermédiaire achats externes
    const [showShoppingModal, setShowShoppingModal] = useState(false);
    const [mealItems, setMealItems] = useState<Array<{
        id: string;
        day: string;
        dayNumber: number;
        mealType: 'petit_dejeuner' | 'repas_du_jour';
        mealTypeLabel: string;
        recipeName: string;
        servings: number;
        estimatedCost: number;
        times: number; // Nombre de fois de consommation
    }>>([]);
    const [familyProfile, setFamilyProfile] = useState<{ total_members: number } | null>(null);
    
    // ✅ NOUVEAU: États pour commande coursier
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [selectedMarket, setSelectedMarket] = useState<any | null>(null);
    const [markets, setMarkets] = useState<any[]>([]);
    const [loadingMarkets, setLoadingMarkets] = useState(false);
    const [userBalance, setUserBalance] = useState<number>(0);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [creatingOrder, setCreatingOrder] = useState(false);
    const { location: userLocation } = useLocation();
    
    // ✅ NOUVEAU: États pour modal ajouter repas
    const [showAddMealModal, setShowAddMealModal] = useState(false);
    const [newMealDay, setNewMealDay] = useState<string>('Lundi');
    const [newMealDayNumber, setNewMealDayNumber] = useState<number>(1);
    const [newMealType, setNewMealType] = useState<'petit_dejeuner' | 'repas_du_jour'>('repas_du_jour');
    const [newMealName, setNewMealName] = useState('');
    const [newMealServings, setNewMealServings] = useState<string>('4');
    const [newMealCost, setNewMealCost] = useState<string>('');

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

    // ✅ NOUVEAU: Formater le prix selon la devise
    const formatPrice = (price?: number): string => {
        if (!price) return 'N/A';
        const currencySymbol = currency === 'XAF' || currency === 'FCFA' ? 'FCFA' : currency;
        return `${price.toLocaleString('fr-FR')} ${currencySymbol}`;
    };

    // ✅ CORRIGÉ: Calculer le coût total du menu avec repas_du_jour
    const calculateTotalCost = (): number => {
        if (!menu.meals) return 0;
        return menu.meals.reduce((total, meal) => {
            let dayTotal = 0;
            if (meal.petit_dejeuner?.estimated_cost) dayTotal += meal.petit_dejeuner.estimated_cost;
            // ✅ CORRIGÉ: repas_du_jour est le même repas pour midi et soir, le coût est déjà pour les 2 repas
            if (meal.repas_du_jour?.estimated_cost) dayTotal += meal.repas_du_jour.estimated_cost;
            if (meal.gouter?.estimated_cost) dayTotal += meal.gouter.estimated_cost;
            // ✅ Compatibilité: Si ancien format avec dejeuner/diner, les utiliser aussi (somme car ce sont 2 repas différents)
            if (meal.dejeuner?.estimated_cost) dayTotal += meal.dejeuner.estimated_cost;
            if (meal.diner?.estimated_cost) dayTotal += meal.diner.estimated_cost;
            return total + dayTotal;
        }, 0);
    };

    // ✅ CORRIGÉ: Initialiser le tableau intermédiaire depuis le menu avec repas_du_jour
    const initializeMealItems = () => {
        if (!menu) return;
        
        const items: Array<{
            id: string;
            day: string;
            dayNumber: number;
            mealType: 'petit_dejeuner' | 'repas_du_jour';
            mealTypeLabel: string;
            recipeName: string;
            servings: number;
            estimatedCost: number;
            times: number;
        }> = [];

        menu.meals.forEach((meal) => {
            if (meal.petit_dejeuner) {
                items.push({
                    id: `${meal.day}-petit_dejeuner`,
                    day: meal.day_name,
                    dayNumber: meal.day,
                    mealType: 'petit_dejeuner',
                    mealTypeLabel: 'Petit-déjeuner',
                    recipeName: meal.petit_dejeuner.recipe_name,
                    servings: meal.petit_dejeuner.servings,
                    estimatedCost: meal.petit_dejeuner.estimated_cost || 0,
                    times: 1, // Par défaut 1 fois
                });
            }
            // ✅ CORRIGÉ: Utiliser repas_du_jour au lieu de dejeuner/diner
            if (meal.repas_du_jour) {
                items.push({
                    id: `${meal.day}-repas_du_jour`,
                    day: meal.day_name,
                    dayNumber: meal.day,
                    mealType: 'repas_du_jour',
                    mealTypeLabel: 'Repas du jour',
                    recipeName: meal.repas_du_jour.recipe_name,
                    servings: meal.repas_du_jour.servings,
                    estimatedCost: meal.repas_du_jour.estimated_cost || 0,
                    times: 2, // ✅ CORRIGÉ: 2 fois car c'est pour midi ET soir
                });
            }
            // ✅ Compatibilité: Si ancien format avec dejeuner/diner, les convertir en repas_du_jour
            if (meal.dejeuner || meal.diner) {
                // Utiliser dejeuner en priorité, sinon diner
                const repas = meal.dejeuner || meal.diner;
                if (repas) {
                    items.push({
                        id: `${meal.day}-repas_du_jour`,
                        day: meal.day_name,
                        dayNumber: meal.day,
                        mealType: 'repas_du_jour',
                        mealTypeLabel: 'Repas du jour',
                        recipeName: repas.recipe_name,
                        servings: repas.servings,
                        estimatedCost: repas.estimated_cost || 0,
                        times: 2, // 2 fois car c'est pour midi ET soir
                    });
                }
            }
        });

        setMealItems(items);
    };

    // ✅ NOUVEAU: Charger le profil famille
    useEffect(() => {
        const loadFamilyProfile = async () => {
            try {
                const response = await menuPlanningService.getFamilyProfile();
                if (response.success && response.data?.profile) {
                    setFamilyProfile({
                        total_members: response.data.profile.total_members || 1,
                    });
                }
            } catch (error) {
                console.error('[MenuWeekCalendar] Erreur chargement profil:', error);
            }
        };
        loadFamilyProfile();
        if (menu) {
            initializeMealItems();
        }
    }, [menu]);

    // ✅ NOUVEAU: Calculer le coût total selon nombre de fois et taille famille
    const calculateItemCost = (item: typeof mealItems[0]): number => {
        const baseCost = item.estimatedCost;
        const familyMultiplier = familyProfile?.total_members || 1;
        return baseCost * item.times * familyMultiplier;
    };

    // ✅ NOUVEAU: Charger les marchés disponibles
    const loadMarkets = async () => {
        if (!generatedShoppingList) return;
        
        setLoadingMarkets(true);
        try {
            let userLat = 4.0511; // Douala par défaut
            let userLng = 9.7679;

            if (userLocation) {
                userLat = userLocation.coords.latitude;
                userLng = userLocation.coords.longitude;
            } else {
                try {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    userLat = location.coords.latitude;
                    userLng = location.coords.longitude;
                } catch (error) {
                    console.warn('Géolocalisation non disponible');
                }
            }

            const result = await deliveryApi.listSupermarkets(userLat, userLng, 10);
            if (result.supermarkets && result.supermarkets.length > 0) {
                setMarkets(result.supermarkets);
            } else {
                setMarkets([]);
                Alert.alert('Aucun marché trouvé', 'Aucun marché n\'a été trouvé près de votre position.');
            }
        } catch (error) {
            console.error('[MenuWeekCalendar] Erreur chargement marchés:', error);
            Alert.alert('Erreur', 'Impossible de charger la liste des marchés.');
            setMarkets([]);
        } finally {
            setLoadingMarkets(false);
        }
    };

    // ✅ NOUVEAU: Vérifier le solde utilisateur
    const checkUserBalance = async () => {
        setLoadingBalance(true);
        try {
            const response = await userApi.getTokensBalance();
            if (response.success && response.data) {
                const balance = (response.data as any).tokens_balance || 0;
                setUserBalance(balance);
                return balance;
            }
            return 0;
        } catch (error) {
            console.error('[MenuWeekCalendar] Erreur vérification solde:', error);
            return 0;
        } finally {
            setLoadingBalance(false);
        }
    };

    // ✅ NOUVEAU: Calculer les frais totaux (budget + 15% plafonné à 2000 + frais livraison moto)
    const calculateTotalFees = (): { shoppingCost: number; serviceFee: number; deliveryFee: number; total: number } => {
        if (!generatedShoppingList) {
            return { shoppingCost: 0, serviceFee: 0, deliveryFee: 0, total: 0 };
        }

        const shoppingCost = generatedShoppingList.total_estimated_cost;
        
        // Frais de service : 15% plafonné à 2000
        const serviceFeePercent = 0.15;
        const serviceFeeMax = 2000;
        const serviceFee = Math.min(shoppingCost * serviceFeePercent, serviceFeeMax);
        
        // Frais de livraison moto (estimation basée sur distance)
        // Pour l'instant, on utilise une estimation fixe de 500 FCFA pour les courses
        // TODO: Calculer dynamiquement selon la distance marché -> domicile
        const deliveryFee = 500;
        
        const total = shoppingCost + serviceFee + deliveryFee;
        
        return { shoppingCost, serviceFee, deliveryFee, total };
    };

    // ✅ NOUVEAU: Ouvrir le modal de commande
    const handleOpenOrderModal = async () => {
        if (!generatedShoppingList) {
            Alert.alert('Erreur', 'Aucune liste de courses disponible');
            return;
        }

        setShowOrderModal(true);
        
        // Charger les marchés et vérifier le solde en parallèle
        await Promise.all([
            loadMarkets(),
            checkUserBalance(),
        ]);
    };

    // ✅ NOUVEAU: Créer la commande de courses
    const handleCreateOrder = async () => {
        if (!generatedShoppingList || !selectedMarket) {
            Alert.alert('Erreur', 'Veuillez sélectionner un marché');
            return;
        }

        const fees = calculateTotalFees();
        
        // Vérifier le solde
        if (userBalance < fees.total) {
            Alert.alert(
                'Solde insuffisant',
                `Votre solde (${formatPrice(userBalance)}) est insuffisant pour cette commande (${formatPrice(fees.total)}). Veuillez recharger votre compte.`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    { 
                        text: 'Recharger', 
                        onPress: () => {
                            // TODO: Naviguer vers l'écran de recharge
                            navigation.navigate('RechargeTokens' as never);
                        }
                    }
                ]
            );
            return;
        }

        setCreatingOrder(true);
        try {
            // Obtenir l'adresse de livraison (domicile utilisateur)
            let dropoffLat = 4.0511;
            let dropoffLng = 9.7679;
            let dropoffAddress = 'Adresse non disponible';

            if (userLocation) {
                dropoffLat = userLocation.coords.latitude;
                dropoffLng = userLocation.coords.longitude;
                try {
                    const reverseGeocode = await Location.reverseGeocodeAsync({
                        latitude: dropoffLat,
                        longitude: dropoffLng,
                    });
                    if (reverseGeocode && reverseGeocode.length > 0) {
                        const addr = reverseGeocode[0];
                        dropoffAddress = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                    }
                } catch (error) {
                    console.warn('Géocodage inverse échoué:', error);
                }
            }

            // Créer la commande shopping
            const shoppingItems = generatedShoppingList.items.map((item: any) => ({
                label: item.ingredient_name,
                quantity: typeof item.quantity === 'object' && item.quantity !== null ? item.quantity.number : item.quantity,
                unit: item.unit,
                estimatedPrice: item.estimated_price,
                estimatedTotal: item.estimated_price,
            }));

            const orderPayload = {
                pickup: {
                    label: selectedMarket.name,
                    latitude: selectedMarket.latitude,
                    longitude: selectedMarket.longitude,
                    address: selectedMarket.address,
                },
                dropoff: {
                    label: 'Domicile',
                    latitude: dropoffLat,
                    longitude: dropoffLng,
                    address: dropoffAddress,
                },
                items: shoppingItems,
                budget: fees.total,
                currency: currency || 'FCFA',
                metadata: {
                    order_type: 'menu_shopping',
                    shopping_list_id: generatedShoppingList.items.map((i: any) => i.ingredient_name).join(', '),
                    family_members: familyProfile?.total_members,
                    estimated_subtotal: fees.shoppingCost,
                    estimated_service_fee: fees.serviceFee,
                    estimated_delivery_fee: fees.deliveryFee,
                },
            };

            const response = await deliveryApi.createOrder(orderPayload);

            if (response.success) {
                Alert.alert(
                    'Commande créée',
                    'Votre commande de courses a été créée avec succès. Un coursier spécialisé sera assigné.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setShowOrderModal(false);
                                setShowShoppingListModal(false);
                                // TODO: Naviguer vers l'écran de suivi de commande
                            }
                        }
                    ]
                );
            } else {
                throw new Error(response.error || 'Erreur lors de la création de la commande');
            }
        } catch (error: any) {
            console.error('[MenuWeekCalendar] Erreur création commande:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la commande. Veuillez réessayer.');
        } finally {
            setCreatingOrder(false);
        }
    };

    // ✅ NOUVEAU: Calculer le coût total de tous les items
    const calculateTotalShoppingCost = (): number => {
        return mealItems.reduce((total, item) => total + calculateItemCost(item), 0);
    };

    // ✅ NOUVEAU: Appliquer le même nombre de fois sur tous les repas
    const applyTimesToAll = (times: number) => {
        setMealItems(items => items.map(item => ({ ...item, times })));
    };

    // ✅ NOUVEAU: Mettre à jour le nombre de fois pour un item
    const updateItemTimes = (id: string, times: number) => {
        if (times < 1) return;
        setMealItems(items => items.map(item => 
            item.id === id ? { ...item, times } : item
        ));
    };

    // ✅ NOUVEAU: Supprimer un item
    const removeItem = (id: string) => {
        setMealItems(items => items.filter(item => item.id !== id));
    };

    // ✅ NOUVEAU: Ajouter un repas (ouvrir modal)
    const handleAddMeal = () => {
        setNewMealDay('Lundi');
        setNewMealDayNumber(1);
        setNewMealType('dejeuner');
        setNewMealName('');
        setNewMealServings('4');
        setNewMealCost('');
        setShowAddMealModal(true);
    };

    // ✅ NOUVEAU: Confirmer l'ajout d'un repas
    const handleConfirmAddMeal = () => {
        if (!newMealName.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer le nom du repas');
            return;
        }

        const servings = parseInt(newMealServings) || 4;
        const cost = parseFloat(newMealCost) || 0;

        const newItem = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            day: newMealDay,
            dayNumber: newMealDayNumber,
            mealType: newMealType,
            mealTypeLabel: newMealType === 'petit_dejeuner' ? 'Petit-déjeuner' : 'Repas du jour',
            recipeName: newMealName.trim(),
            servings,
            estimatedCost: cost,
            times: newMealType === 'repas_du_jour' ? 2 : 1, // ✅ CORRIGÉ: repas_du_jour est consommé 2 fois (midi et soir)
        };

        setMealItems(items => [...items, newItem]);
        setShowAddMealModal(false);
        
        // Réinitialiser les champs
        setNewMealDay('Lundi');
        setNewMealDayNumber(1);
        setNewMealType('repas_du_jour');
        setNewMealName('');
        setNewMealServings('4');
        setNewMealCost('');
    };

    // ✅ NOUVEAU: Générer liste de courses intelligente via IA
    const [generatingShoppingList, setGeneratingShoppingList] = useState(false);
    const [generatedShoppingList, setGeneratedShoppingList] = useState<any>(null);
    const [showShoppingListModal, setShowShoppingListModal] = useState(false);

    const handleGenerateShoppingList = async () => {
        if (mealItems.length === 0) {
            Alert.alert('Erreur', 'Veuillez sélectionner au moins un repas');
            return;
        }

        try {
            setGeneratingShoppingList(true);
            
            const mealItemsForAI = mealItems.map(item => ({
                recipeName: item.recipeName,
                times: item.times,
                servings: item.servings,
                day: item.day,
                mealType: item.mealType,
            }));

            const response = await menuPlanningService.generateIntelligentShoppingList(
                mealItemsForAI,
                familyProfile?.total_members || 1
            );

            if (response.success && response.data?.shopping_list) {
                setGeneratedShoppingList(response.data.shopping_list);
                setShowShoppingModal(false);
                setShowShoppingListModal(true);
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de générer la liste de courses');
            }
        } catch (error: any) {
            console.error('[MenuWeekCalendar] Erreur génération liste:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setGeneratingShoppingList(false);
        }
    };

    // ✅ NOUVEAU: Ouvrir le modal d'achat externe
    const handleOpenShoppingModal = () => {
        if (!menu) return;
        initializeMealItems();
        setShowShoppingModal(true);
    };

    // ✅ NOUVEAU: Exporter le menu en PDF
    const handleExportPDF = async () => {
        try {
            setExportingPDF(true);
            
            // Calculer les dates de fin
            const weekStartDate = new Date(menu.week_start);
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);

            const pdfUri = await generateAndDownloadMenuPDF({
                menu,
                weekStart: menu.week_start,
                weekEnd: weekEndDate.toISOString().split('T')[0],
                totalCost: calculateTotalCost(),
                currency: currency || 'FCFA',
            });

            // Partager vers WhatsApp
            await shareMenuPDF(pdfUri, `Semaine du ${weekStartDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`);

            Alert.alert('Succès', 'Menu exporté et partagé avec succès !');
        } catch (error: any) {
            console.error('[MenuWeekCalendar] Erreur export PDF:', error);
            Alert.alert(
                'Erreur',
                error.message || 'Impossible d\'exporter le menu. Veuillez installer expo-print: npm install expo-print'
            );
        } finally {
            setExportingPDF(false);
        }
    };

    // ✅ NOUVEAU: Rendre une cellule de repas dans le tableau
    const renderMealCell = (meal: any, mealType: string, day: number) => {
        if (!meal) {
            return (
                <View style={styles.tableCell}>
                    <Text style={styles.tableCellEmpty}>-</Text>
                </View>
            );
        }

        return (
            <TouchableOpacity
                style={styles.tableCell}
                onPress={() => {
                    setSelectedDay(day);
                    setSelectedMealType(mealType);
                    handleRequestRecipeFromMenu(meal.recipe_name);
                }}
                activeOpacity={0.7}
            >
                <Text style={styles.tableCellMealName} numberOfLines={2}>
                    {meal.recipe_name}
                </Text>
                {meal.estimated_cost && (
                    <Text style={styles.tableCellPrice}>
                        {formatPrice(meal.estimated_cost)}
                    </Text>
                )}
                {meal.calories && (
                    <Text style={styles.tableCellCalories}>
                        🔥 {Math.round(meal.calories)} cal
                    </Text>
                )}
                {meal.servings && (
                    <Text style={styles.tableCellServings}>
                        👥 {meal.servings} portion{meal.servings > 1 ? 's' : ''}
                    </Text>
                )}
                <TouchableOpacity
                    style={styles.tableCellRecipeButton}
                    onPress={() => handleRequestRecipeFromMenu(meal.recipe_name)}
                >
                    <SafeIcon name="ChefHat" size={12} color={modernColors.primary} type="lucide" />
                    <Text style={styles.tableCellRecipeText}>Recette</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
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

    // ✅ ANCIEN CODE: Conservé pour compatibilité mais non utilisé dans le nouveau design
    const renderMealItem = (meal: any, mealType: string, icon: string) => {
        if (!meal) return null;

        return (
            <TouchableOpacity
                key={mealType}
                style={styles.mealCard}
                onPress={() => {
                    handleRequestRecipeFromMenu(meal.recipe_name);
                }}
            >
                <View style={styles.mealHeader}>
                    <SafeIcon name={icon} size={20} color={modernColors.primary} type="lucide" />
                    <Text style={styles.mealTypeText}>
                        {mealType === 'petit_dejeuner' ? 'Petit-déj' :
                            mealType === 'repas_du_jour' ? 'Repas du jour' : 'Goûter'}
                    </Text>
                </View>
                <Text style={styles.mealName}>{meal.recipe_name}</Text>
                <View style={styles.mealInfo}>
                    {meal.prep_time_minutes && (
                        <Text style={styles.mealInfoText}>⏱ {meal.prep_time_minutes} min</Text>
                    )}
                    {meal.estimated_cost && (
                        <Text style={styles.mealInfoText}>💰 {formatPrice(meal.estimated_cost)}</Text>
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

            {/* ✅ NOUVEAU: En-tête avec coût total, sélecteur de vue et export PDF */}
            <View style={styles.headerActions}>
                <View style={styles.totalCostContainer}>
                    <Text style={styles.totalCostLabel}>Coût total estimé :</Text>
                    <Text style={styles.totalCostValue} numberOfLines={1} ellipsizeMode="tail">
                        {formatPrice(calculateTotalCost())}
                    </Text>
                </View>
                <View style={styles.headerActionsRight}>
                    <TouchableOpacity
                        style={styles.exportButton}
                        onPress={handleExportPDF}
                        disabled={exportingPDF}
                    >
                        {exportingPDF ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <SafeIcon name="Download" size={18} color="#fff" type="lucide" />
                        )}
                        <Text style={styles.exportButtonText}>
                            {exportingPDF ? 'Export...' : 'PDF'}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.viewModeSelector}>
                        <TouchableOpacity
                            style={[styles.viewModeButton, viewMode === 'table' && styles.viewModeButtonActive]}
                            onPress={() => setViewMode('table')}
                        >
                            <SafeIcon name="Table" size={18} color={viewMode === 'table' ? '#fff' : '#6B7280'} type="lucide" />
                            <Text style={[styles.viewModeText, viewMode === 'table' && styles.viewModeTextActive]}>
                                Tableau
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
                            onPress={() => setViewMode('list')}
                        >
                            <SafeIcon name="List" size={18} color={viewMode === 'list' ? '#fff' : '#6B7280'} type="lucide" />
                            <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>
                                Liste
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* ✅ NOUVEAU: Affichage en tableau */}
            {viewMode === 'table' ? (
                <>
                    <View style={styles.tableWrapper}>
                        {/* ✅ ScrollView horizontal pour scroller les colonnes */}
                        <ScrollView
                            horizontal={true}
                            showsHorizontalScrollIndicator={true}
                            bounces={true}
                            style={styles.tableHorizontalScroll}
                            contentContainerStyle={styles.tableHorizontalContent}
                            nestedScrollEnabled={true}
                            scrollEnabled={true}
                        >
                            {/* ✅ ScrollView vertical pour scroller les lignes */}
                            <ScrollView
                                showsVerticalScrollIndicator={true}
                                nestedScrollEnabled={true}
                                style={styles.tableVerticalScroll}
                                contentContainerStyle={styles.tableVerticalContent}
                                scrollEnabled={true}
                                bounces={true}
                            >
                                <View style={styles.table}>
                                {/* En-tête du tableau */}
                                <View style={styles.tableHeader}>
                                    <View style={[styles.tableHeaderCell, styles.tableHeaderCellDay]}>
                                        <Text style={styles.tableHeaderText}>Jour</Text>
                                    </View>
                                    <View style={styles.tableHeaderCell}>
                                        <SafeIcon name="Sunrise" size={14} color="#F59E0B" type="lucide" />
                                        <Text style={styles.tableHeaderText}>Petit-déj</Text>
                                    </View>
                                    <View style={styles.tableHeaderCell}>
                                        <SafeIcon name="UtensilsCrossed" size={14} color="#10B981" type="lucide" />
                                        <Text style={styles.tableHeaderText}>Repas du jour</Text>
                                    </View>
                                </View>

                                {/* Lignes du tableau */}
                                {DAYS.map((dayName, index) => {
                                    const dayNumber = index + 1;
                                    const dayMeal = getDayMeal(dayNumber);
                                    // ✅ CORRIGÉ: Utiliser repas_du_jour - le coût est déjà pour midi ET soir (pas de multiplication)
                                    const dayTotal = (dayMeal?.petit_dejeuner?.estimated_cost || 0) +
                                                   (dayMeal?.repas_du_jour?.estimated_cost || 0) + // Coût déjà pour les 2 repas (midi + soir)
                                                   (dayMeal?.gouter?.estimated_cost || 0);
                                    
                                    return (
                                        <View key={dayNumber} style={styles.tableRow}>
                                            <View style={[styles.tableCell, styles.tableCellDay]}>
                                                <Text style={styles.tableCellDayName}>{dayName}</Text>
                                                <Text style={styles.tableCellDayTotal}>
                                                    {formatPrice(dayTotal)}
                                                </Text>
                                            </View>
                                            {renderMealCell(dayMeal?.petit_dejeuner, 'petit_dejeuner', dayNumber)}
                                            {renderMealCell(dayMeal?.repas_du_jour, 'repas_du_jour', dayNumber)}
                                        </View>
                                    );
                                })}
                                
                                {/* ✅ NOUVEAU: Ligne de totaux par jour */}
                                <View style={[styles.tableRow, styles.tableRowTotal]}>
                                    <View style={[styles.tableCell, styles.tableCellDay, styles.tableCellTotal]}>
                                        <Text style={styles.tableCellTotalText}>Total</Text>
                                    </View>
                                    {DAYS.map((_, index) => {
                                        const dayNumber = index + 1;
                                        const dayMeal = getDayMeal(dayNumber);
                                        // ✅ CORRIGÉ: Utiliser repas_du_jour - le coût est déjà pour midi ET soir
                                        const dayTotal = (dayMeal?.petit_dejeuner?.estimated_cost || 0) +
                                                       (dayMeal?.repas_du_jour?.estimated_cost || 0) + // Coût déjà pour les 2 repas
                                                       (dayMeal?.gouter?.estimated_cost || 0);
                                        return (
                                            <View key={`total-${dayNumber}`} style={[styles.tableCell, styles.tableCellTotal]}>
                                                <Text style={styles.tableCellTotalValue}>
                                                    {formatPrice(dayTotal)}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                            </ScrollView>
                        </ScrollView>
                    </View>
                    
                    {/* ✅ NOUVEAU: Actions pour vue tableau */}
                    <View style={styles.tableActionsContainer}>
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
                        <TouchableOpacity
                            style={[styles.actionButton, styles.courierButton]}
                            onPress={handleOpenShoppingModal}
                        >
                            <SafeIcon name="Bike" size={20} color="#fff" type="lucide" />
                            <Text style={styles.actionButtonText}>Achat externe via coursier</Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                /* ✅ NOUVEAU: Affichage en liste */
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {menu.meals.map((dayMeal) => (
                        <NativeCard key={dayMeal.day} style={styles.listDayCard}>
                            <View style={styles.listDayHeader}>
                                <Text style={styles.listDayTitle}>{dayMeal.day_name}</Text>
                                <Text style={styles.listDayCost}>
                                    {formatPrice(
                                        (dayMeal.petit_dejeuner?.estimated_cost || 0) +
                                        (dayMeal.repas_du_jour ? (dayMeal.repas_du_jour.estimated_cost || 0) * 2 : 0) + // Multiplier par 2 car c'est pour midi ET soir
                                        (dayMeal.gouter?.estimated_cost || 0)
                                    )}
                                </Text>
                            </View>
                            
                            <View style={styles.listMealsContainer}>
                                {dayMeal.petit_dejeuner && (
                                    <View style={styles.listMealItem}>
                                        <View style={styles.listMealLeft}>
                                            <SafeIcon name="Sunrise" size={16} color="#F59E0B" type="lucide" />
                                            <Text style={styles.listMealType}>Petit-déjeuner</Text>
                                        </View>
                                        <View style={styles.listMealRight}>
                                            <Text style={styles.listMealName}>{dayMeal.petit_dejeuner.recipe_name}</Text>
                                            {dayMeal.petit_dejeuner.complements && dayMeal.petit_dejeuner.complements.length > 0 && (
                                                <Text style={styles.listMealComplements}>
                                                    Avec: {dayMeal.petit_dejeuner.complements.join(', ')}
                                                </Text>
                                            )}
                                            <Text style={styles.listMealInfo}>
                                                {formatPrice(dayMeal.petit_dejeuner.estimated_cost)} • 
                                                👥 {dayMeal.petit_dejeuner.servings} portion{dayMeal.petit_dejeuner.servings > 1 ? 's' : ''}
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.listRecipeButton}
                                                onPress={() => handleRequestRecipeFromMenu(dayMeal.petit_dejeuner!.recipe_name)}
                                            >
                                                <SafeIcon name="ChefHat" size={14} color={modernColors.primary} type="lucide" />
                                                <Text style={styles.listRecipeButtonText}>Voir recette</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                
                                {/* ✅ CORRIGÉ: Utiliser repas_du_jour au lieu de dejeuner/diner */}
                                {dayMeal.repas_du_jour && (
                                    <View style={styles.listMealItem}>
                                        <View style={styles.listMealLeft}>
                                            <SafeIcon name="UtensilsCrossed" size={16} color="#10B981" type="lucide" />
                                            <Text style={styles.listMealType}>Repas du jour</Text>
                                        </View>
                                        <View style={styles.listMealRight}>
                                            <Text style={styles.listMealName}>{dayMeal.repas_du_jour.recipe_name}</Text>
                                            {dayMeal.repas_du_jour.complements && dayMeal.repas_du_jour.complements.length > 0 && (
                                                <Text style={styles.listMealComplements}>
                                                    Avec: {dayMeal.repas_du_jour.complements.join(', ')}
                                                </Text>
                                            )}
                                            <Text style={styles.listMealInfo}>
                                                {formatPrice(dayMeal.repas_du_jour.estimated_cost || 0)} • 
                                                👥 {dayMeal.repas_du_jour.servings} portion{dayMeal.repas_du_jour.servings > 1 ? 's' : ''} (midi + soir)
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.listRecipeButton}
                                                onPress={() => handleRequestRecipeFromMenu(dayMeal.repas_du_jour!.recipe_name)}
                                            >
                                                <SafeIcon name="ChefHat" size={14} color={modernColors.primary} type="lucide" />
                                                <Text style={styles.listRecipeButtonText}>Voir recette</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                
                                {/* ✅ Compatibilité: Si ancien format avec dejeuner/diner, les afficher aussi */}
                                {!dayMeal.repas_du_jour && (dayMeal.dejeuner || dayMeal.diner) && (
                                    <>
                                        {dayMeal.dejeuner && (
                                            <View style={styles.listMealItem}>
                                                <View style={styles.listMealLeft}>
                                                    <SafeIcon name="UtensilsCrossed" size={16} color="#10B981" type="lucide" />
                                                    <Text style={styles.listMealType}>Repas du jour</Text>
                                                </View>
                                                <View style={styles.listMealRight}>
                                                    <Text style={styles.listMealName}>{dayMeal.dejeuner.recipe_name}</Text>
                                                    <Text style={styles.listMealInfo}>
                                                        {formatPrice(dayMeal.dejeuner.estimated_cost)} • 
                                                        👥 {dayMeal.dejeuner.servings} portion{dayMeal.dejeuner.servings > 1 ? 's' : ''}
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={styles.listRecipeButton}
                                                        onPress={() => handleRequestRecipeFromMenu(dayMeal.dejeuner!.recipe_name)}
                                                    >
                                                        <SafeIcon name="ChefHat" size={14} color={modernColors.primary} type="lucide" />
                                                        <Text style={styles.listRecipeButtonText}>Voir recette</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                        {dayMeal.diner && (
                                            <View style={styles.listMealItem}>
                                                <View style={styles.listMealLeft}>
                                                    <SafeIcon name="UtensilsCrossed" size={16} color="#10B981" type="lucide" />
                                                    <Text style={styles.listMealType}>Repas du jour</Text>
                                                </View>
                                                <View style={styles.listMealRight}>
                                                    <Text style={styles.listMealName}>{dayMeal.diner.recipe_name}</Text>
                                                    <Text style={styles.listMealInfo}>
                                                        {formatPrice(dayMeal.diner.estimated_cost)} • 
                                                        👥 {dayMeal.diner.servings} portion{dayMeal.diner.servings > 1 ? 's' : ''}
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={styles.listRecipeButton}
                                                        onPress={() => handleRequestRecipeFromMenu(dayMeal.diner!.recipe_name)}
                                                    >
                                                        <SafeIcon name="ChefHat" size={14} color={modernColors.primary} type="lucide" />
                                                        <Text style={styles.listRecipeButtonText}>Voir recette</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        </NativeCard>
                    ))}

                    {/* ✅ NOUVEAU: Résumé global */}
                    <NativeCard style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>Résumé du menu</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Coût total estimé :</Text>
                            <Text style={styles.summaryValue}>{formatPrice(calculateTotalCost())}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Période :</Text>
                            <Text style={styles.summaryValue}>
                                {new Date(menu.week_start).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                })} - {new Date(new Date(menu.week_start).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                })}
                            </Text>
                        </View>
                    </NativeCard>

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
            )}

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
                                            currency: currency === 'XAF' || currency === 'FCFA' ? 'FCFA' : currency,
                                        });
                                        
                                        await shareRecipePDF(pdfUri, generatedRecipe.recipe_name);
                                        Alert.alert('Succès', 'Recette partagée avec succès !');
                                    } catch (error: any) {
                                        console.error('[MenuWeekCalendar] Erreur partage recette PDF:', error);
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

            {/* ✅ NOUVEAU: Modal tableau intermédiaire pour achat externe */}
            <Modal
                visible={showShoppingModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowShoppingModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.shoppingModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Achat externe via coursier</Text>
                            <TouchableOpacity onPress={() => setShowShoppingModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Option appliquer même nombre de fois */}
                            <View style={styles.applyTimesContainer}>
                                <Text style={styles.applyTimesLabel}>
                                    Nombre de fois que chaque repas doit être consommé :
                                </Text>
                                <View style={styles.applyTimesInputContainer}>
                                    <TextInput
                                        style={styles.applyTimesInput}
                                        keyboardType="numeric"
                                        placeholder="1"
                                        defaultValue="1"
                                        onChangeText={(text) => {
                                            const times = parseInt(text) || 1;
                                            if (times > 0) {
                                                applyTimesToAll(times);
                                            }
                                        }}
                                    />
                                    <TouchableOpacity
                                        style={styles.applyButton}
                                        onPress={() => {
                                            const times = 1;
                                            applyTimesToAll(times);
                                        }}
                                    >
                                        <Text style={styles.applyButtonText}>Appliquer</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Tableau des repas */}
                            <View style={styles.shoppingTable}>
                                <View style={styles.shoppingTableHeader}>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1.2 }]}>Jour</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1.5 }]}>Type</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 2 }]}>Repas</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1 }]}>Fois</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1.5 }]}>Coût</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 0.8 }]}>Action</Text>
                                </View>
                                
                                {mealItems.map((item) => (
                                    <View key={item.id} style={styles.shoppingTableRow}>
                                        <Text style={[styles.shoppingTableCell, { flex: 1.2, fontWeight: '600' }]}>
                                            {item.day}
                                        </Text>
                                        <Text style={[styles.shoppingTableCell, { flex: 1.5, fontSize: 11 }]}>
                                            {item.mealTypeLabel}
                                        </Text>
                                        <Text style={[styles.shoppingTableCell, { flex: 2 }]} numberOfLines={2}>
                                            {item.recipeName}
                                        </Text>
                                        <View style={[styles.shoppingTableCell, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 }]}>
                                            <TouchableOpacity
                                                onPress={() => updateItemTimes(item.id, Math.max(1, item.times - 1))}
                                                style={styles.timesButton}
                                            >
                                                <Text style={styles.timesButtonText}>-</Text>
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.timesInput}
                                                value={String(item.times)}
                                                keyboardType="numeric"
                                                onChangeText={(text) => {
                                                    const times = parseInt(text) || 1;
                                                    updateItemTimes(item.id, Math.max(1, times));
                                                }}
                                            />
                                            <TouchableOpacity
                                                onPress={() => updateItemTimes(item.id, item.times + 1)}
                                                style={styles.timesButton}
                                            >
                                                <Text style={styles.timesButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={[styles.shoppingTableCell, { flex: 1.5, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }]}>
                                            <Text style={[styles.costCellText, { color: modernColors.primary, fontWeight: '700' }]}>
                                                {formatPrice(calculateItemCost(item))}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => removeItem(item.id)}
                                            style={[styles.shoppingTableCell, { flex: 0.8 }]}
                                        >
                                            <SafeIcon name="trash-2" size={16} color="#EF4444" type="lucide" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                            {/* Total */}
                            <View style={styles.shoppingTotalContainer}>
                                <Text style={styles.shoppingTotalLabel}>Total estimé :</Text>
                                <Text style={styles.shoppingTotalValue}>
                                    {formatPrice(calculateTotalShoppingCost())}
                                </Text>
                            </View>

                            {/* Bouton ajouter repas */}
                            <TouchableOpacity
                                style={styles.addMealButton}
                                onPress={handleAddMeal}
                            >
                                <SafeIcon name="plus" size={18} color={modernColors.primary} type="lucide" />
                                <Text style={styles.addMealButtonText}>Ajouter un repas</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => setShowShoppingModal(false)}
                                variant="outline"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={generatingShoppingList ? 'Génération...' : 'Générer liste de courses'}
                                onPress={handleGenerateShoppingList}
                                variant="primary"
                                style={styles.modalButton}
                                loading={generatingShoppingList}
                                disabled={generatingShoppingList || mealItems.length === 0}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal tableau intermédiaire pour achat externe */}
            <Modal
                visible={showShoppingModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowShoppingModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.shoppingModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Achat externe via coursier</Text>
                            <TouchableOpacity onPress={() => setShowShoppingModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Option appliquer même nombre de fois */}
                            <View style={styles.applyTimesContainer}>
                                <Text style={styles.applyTimesLabel}>
                                    Nombre de fois que chaque repas doit être consommé :
                                </Text>
                                <View style={styles.applyTimesInputContainer}>
                                    <TextInput
                                        style={styles.applyTimesInput}
                                        keyboardType="numeric"
                                        placeholder="1"
                                        defaultValue="1"
                                        onChangeText={(text) => {
                                            const times = parseInt(text) || 1;
                                            if (times > 0) {
                                                applyTimesToAll(times);
                                            }
                                        }}
                                    />
                                    <TouchableOpacity
                                        style={styles.applyButton}
                                        onPress={() => {
                                            const times = 1;
                                            applyTimesToAll(times);
                                        }}
                                    >
                                        <Text style={styles.applyButtonText}>Appliquer</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Tableau des repas */}
                            <View style={styles.shoppingTable}>
                                <View style={styles.shoppingTableHeader}>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1.2 }]}>Jour</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1.5 }]}>Type</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 2 }]}>Repas</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1 }]}>Fois</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 1.5 }]}>Coût</Text>
                                    <Text style={[styles.shoppingTableHeaderCell, { flex: 0.8 }]}>Action</Text>
                                </View>
                                
                                {mealItems.map((item) => (
                                    <View key={item.id} style={styles.shoppingTableRow}>
                                        <Text style={[styles.shoppingTableCell, { flex: 1.2, fontWeight: '600' }]}>
                                            {item.day}
                                        </Text>
                                        <Text style={[styles.shoppingTableCell, { flex: 1.5, fontSize: 11 }]}>
                                            {item.mealTypeLabel}
                                        </Text>
                                        <Text style={[styles.shoppingTableCell, { flex: 2 }]} numberOfLines={2}>
                                            {item.recipeName}
                                        </Text>
                                        <View style={[styles.shoppingTableCell, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 }]}>
                                            <TouchableOpacity
                                                onPress={() => updateItemTimes(item.id, Math.max(1, item.times - 1))}
                                                style={styles.timesButton}
                                            >
                                                <Text style={styles.timesButtonText}>-</Text>
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.timesInput}
                                                value={String(item.times)}
                                                keyboardType="numeric"
                                                onChangeText={(text) => {
                                                    const times = parseInt(text) || 1;
                                                    updateItemTimes(item.id, Math.max(1, times));
                                                }}
                                            />
                                            <TouchableOpacity
                                                onPress={() => updateItemTimes(item.id, item.times + 1)}
                                                style={styles.timesButton}
                                            >
                                                <Text style={styles.timesButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={[styles.shoppingTableCell, { flex: 1.5, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }]}>
                                            <Text style={[styles.costCellText, { color: modernColors.primary, fontWeight: '700' }]}>
                                                {formatPrice(calculateItemCost(item))}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => removeItem(item.id)}
                                            style={[styles.shoppingTableCell, { flex: 0.8 }]}
                                        >
                                            <SafeIcon name="trash-2" size={16} color="#EF4444" type="lucide" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                            {/* Total */}
                            <View style={styles.shoppingTotalContainer}>
                                <Text style={styles.shoppingTotalLabel}>Total estimé :</Text>
                                <Text style={styles.shoppingTotalValue}>
                                    {formatPrice(calculateTotalShoppingCost())}
                                </Text>
                            </View>

                            {/* Bouton ajouter repas */}
                            <TouchableOpacity
                                style={styles.addMealButton}
                                onPress={handleAddMeal}
                            >
                                <SafeIcon name="plus" size={18} color={modernColors.primary} type="lucide" />
                                <Text style={styles.addMealButtonText}>Ajouter un repas</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => setShowShoppingModal(false)}
                                variant="outline"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={generatingShoppingList ? 'Génération...' : 'Générer liste de courses'}
                                onPress={handleGenerateShoppingList}
                                variant="primary"
                                style={styles.modalButton}
                                loading={generatingShoppingList}
                                disabled={generatingShoppingList || mealItems.length === 0}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal liste de courses générée */}
            <Modal
                visible={showShoppingListModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowShoppingListModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.shoppingModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Liste de courses générée</Text>
                            <TouchableOpacity onPress={() => setShowShoppingListModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        {generatedShoppingList && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.shoppingListTable}>
                                    <View style={styles.shoppingListTableHeader}>
                                        <Text style={[styles.shoppingListTableHeaderCell, { flex: 2 }]}>Ingrédient</Text>
                                        <Text style={[styles.shoppingListTableHeaderCell, { flex: 1.5 }]}>Quantité</Text>
                                        <Text style={[styles.shoppingListTableHeaderCell, { flex: 1.5 }]}>Prix</Text>
                                        <Text style={[styles.shoppingListTableHeaderCell, { flex: 2 }]}>Repas</Text>
                                    </View>
                                    
                                    {generatedShoppingList.items.map((item: any, index: number) => (
                                        <View key={index} style={styles.shoppingListTableRow}>
                                            <Text style={[styles.shoppingListTableCell, { flex: 2, fontWeight: '600' }]}>
                                                {item.ingredient_name}
                                            </Text>
                                            <Text style={[styles.shoppingListTableCell, { flex: 1.5 }]}>
                                                {typeof item.quantity === 'object' && item.quantity !== null ? item.quantity.number : item.quantity} {item.unit}
                                            </Text>
                                            <Text style={[styles.shoppingListTableCell, { flex: 1.5, color: modernColors.primary, fontWeight: '700' }]}>
                                                {formatPrice(item.estimated_price)}
                                            </Text>
                                            <Text style={[styles.shoppingListTableCell, { flex: 2, fontSize: 10 }]} numberOfLines={2}>
                                                {item.associated_meals.join(', ')}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Total */}
                                <View style={styles.shoppingTotalContainer}>
                                    <Text style={styles.shoppingTotalLabel}>Total estimé :</Text>
                                    <Text style={styles.shoppingTotalValue}>
                                        {formatPrice(generatedShoppingList.total_estimated_cost)}
                                    </Text>
                                </View>
                            </ScrollView>
                        )}

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Partager WhatsApp"
                                onPress={async () => {
                                    try {
                                        if (!generatedShoppingList) return;
                                        
                                        const pdfUri = await generateAndDownloadShoppingListPDF({
                                            items: generatedShoppingList.items,
                                            total_estimated_cost: generatedShoppingList.total_estimated_cost,
                                            currency: currency || 'FCFA',
                                            family_members: familyProfile?.total_members,
                                        });

                                        await shareShoppingListPDF(pdfUri, 'Liste de courses');
                                        Alert.alert('Succès', 'Liste de courses partagée avec succès !');
                                    } catch (error: any) {
                                        console.error('[MenuWeekCalendar] Erreur partage liste:', error);
                                        Alert.alert('Erreur', error.message || 'Impossible de partager la liste de courses');
                                    }
                                }}
                                variant="outline"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title="Commander via coursier"
                                onPress={handleOpenOrderModal}
                                variant="primary"
                                style={styles.modalButton}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ NOUVEAU: Modal pour ajouter un repas */}
            <Modal
                visible={showAddMealModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddMealModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ajouter un repas</Text>
                            <TouchableOpacity onPress={() => setShowAddMealModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Jour *</Text>
                                <View style={styles.pickerContainer}>
                                    <View style={styles.pickerRow}>
                                        {DAYS.map((day, index) => (
                                            <TouchableOpacity
                                                key={day}
                                                style={[
                                                    styles.dayPickerButton,
                                                    newMealDay === day && styles.dayPickerButtonActive
                                                ]}
                                                onPress={() => {
                                                    setNewMealDay(day);
                                                    setNewMealDayNumber(index + 1);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.dayPickerButtonText,
                                                    newMealDay === day && styles.dayPickerButtonTextActive
                                                ]}>
                                                    {DAYS_SHORT[index]}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Type de repas *</Text>
                                <View style={styles.pickerContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.mealTypeButton,
                                            newMealType === 'petit_dejeuner' && styles.mealTypeButtonActive
                                        ]}
                                        onPress={() => setNewMealType('petit_dejeuner')}
                                    >
                                        <SafeIcon name="Sunrise" size={16} color={newMealType === 'petit_dejeuner' ? '#fff' : '#6B7280'} type="lucide" />
                                        <Text style={[
                                            styles.mealTypeButtonText,
                                            newMealType === 'petit_dejeuner' && styles.mealTypeButtonTextActive
                                        ]}>
                                            Petit-déjeuner
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.mealTypeButton,
                                            newMealType === 'repas_du_jour' && styles.mealTypeButtonActive
                                        ]}
                                        onPress={() => setNewMealType('repas_du_jour')}
                                    >
                                        <SafeIcon name="UtensilsCrossed" size={16} color={newMealType === 'repas_du_jour' ? '#fff' : '#6B7280'} type="lucide" />
                                        <Text style={[
                                            styles.mealTypeButtonText,
                                            newMealType === 'repas_du_jour' && styles.mealTypeButtonTextActive
                                        ]}>
                                            Repas du jour
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nom du repas *</Text>
                                <NativeInput
                                    value={newMealName}
                                    onChangeText={setNewMealName}
                                    placeholder="Ex: Ndolé, Poulet DG, Riz au gras..."
                                    autoFocus
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nombre de portions</Text>
                                <NativeInput
                                    value={newMealServings}
                                    onChangeText={setNewMealServings}
                                    placeholder="4"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Coût estimé ({currency === 'XAF' || currency === 'FCFA' ? 'FCFA' : currency})</Text>
                                <NativeInput
                                    value={newMealCost}
                                    onChangeText={setNewMealCost}
                                    placeholder="0"
                                    keyboardType="numeric"
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={() => setShowAddMealModal(false)}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title="Ajouter"
                                onPress={handleConfirmAddMeal}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={!newMealName.trim()}
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
    courierButton: {
        backgroundColor: '#10B981',
        marginTop: 12,
    },
    // ✅ NOUVEAU: Styles pour modal achat externe
    shoppingModalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        width: '100%',
    },
    // ✅ NOUVEAU: Styles pour modal ajouter repas
    pickerContainer: {
        marginTop: 8,
    },
    pickerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayPickerButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minWidth: 50,
        alignItems: 'center',
    },
    dayPickerButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dayPickerButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    dayPickerButtonTextActive: {
        color: '#fff',
    },
    mealTypeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    mealTypeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    mealTypeButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    mealTypeButtonTextActive: {
        color: '#fff',
    },
    applyTimesContainer: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        marginBottom: 16,
    },
    applyTimesLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    applyTimesInputContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    applyTimesInput: {
        flex: 1,
        padding: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 14,
    },
    applyButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        justifyContent: 'center',
    },
    applyButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    shoppingTable: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    shoppingTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 2,
        borderBottomColor: '#E5E7EB',
    },
    shoppingTableHeaderCell: {
        fontSize: 11,
        fontWeight: '700',
        color: '#111827',
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    shoppingTableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        alignItems: 'center',
    },
    shoppingTableCell: {
        fontSize: 12,
        color: '#374151',
        textAlign: 'center',
    },
    timesButton: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timesButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    timesInput: {
        width: 40,
        height: 28,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: '600',
        backgroundColor: '#fff',
    },
    costCellText: {
        fontSize: 13,
        textAlign: 'center',
    },
    shoppingTotalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        marginBottom: 16,
    },
    shoppingTotalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    shoppingTotalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10B981',
    },
    addMealButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderStyle: 'dashed',
        borderRadius: 12,
        marginBottom: 16,
    },
    addMealButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    // ✅ NOUVEAU: Styles pour liste de courses générée
    shoppingListTable: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    shoppingListTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 2,
        borderBottomColor: '#E5E7EB',
    },
    shoppingListTableHeaderCell: {
        fontSize: 11,
        fontWeight: '700',
        color: '#111827',
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    shoppingListTableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        alignItems: 'center',
    },
    shoppingListTableCell: {
        fontSize: 12,
        color: '#374151',
        textAlign: 'center',
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
    // ✅ NOUVEAU: Styles pour tableau
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    totalCostContainer: {
        flex: 1,
        minWidth: 0, // Permet au flex de fonctionner correctement
    },
    totalCostLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    totalCostValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        flexWrap: 'nowrap',
        flexShrink: 0,
    },
    headerActionsRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#10B981',
        borderRadius: 8,
    },
    exportButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    viewModeSelector: {
        flexDirection: 'row',
        gap: 8,
    },
    viewModeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    viewModeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    viewModeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    viewModeTextActive: {
        color: '#fff',
    },
    tableWrapper: {
        flex: 1,
        backgroundColor: '#fff',
    },
    tableHorizontalScroll: {
        flex: 1,
        width: '100%',
    },
    tableHorizontalContent: {
        padding: 16,
        minWidth: width - 32, // Largeur minimale basée sur l'écran
    },
    tableVerticalScroll: {
        flex: 1,
        // ✅ CORRIGÉ: Utiliser la hauteur calculée pour permettre le scroll vertical
        maxHeight: height * 0.65, // 65% de la hauteur d'écran pour permettre le scroll vertical
        minHeight: 400, // Hauteur minimale pour garantir le scroll
    },
    tableVerticalContent: {
        flexGrow: 1,
        paddingBottom: 20, // Espace en bas pour le scroll
    },
    table: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#fff',
        // Largeur fixe: 100 (jour) + 3 * 140 (repas) = 520px
        width: 520,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 2,
        borderBottomColor: '#E5E7EB',
    },
    tableHeaderCell: {
        width: 140, // Largeur fixe pour chaque colonne de repas
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
        flexShrink: 0, // Empêche la réduction de taille
    },
    tableHeaderCellDay: {
        width: 100, // Largeur fixe pour colonne jour
        backgroundColor: '#F3F4F6',
        flexShrink: 0,
    },
    tableHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tableCell: {
        width: 140, // Largeur fixe pour chaque colonne de repas
        padding: 12,
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
        backgroundColor: '#fff',
        flexShrink: 0, // Empêche la réduction de taille
    },
    tableCellDay: {
        width: 100, // Largeur fixe pour colonne jour
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        paddingVertical: 8,
    },
    tableCellDayName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    tableCellDayTotal: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
        marginTop: 4,
    },
    tableCellEmpty: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    tableCellMealName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 6,
    },
    tableCellPrice: {
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    tableCellCalories: {
        fontSize: 10,
        fontWeight: '600',
        color: '#F59E0B',
        marginBottom: 4,
    },
    tableCellServings: {
        fontSize: 11,
        color: '#6B7280',
        marginBottom: 6,
    },
    tableCellRecipeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    tableCellRecipeText: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.primary,
    },
    // ✅ NOUVEAU: Styles pour ligne de totaux
    tableRowTotal: {
        backgroundColor: '#F3F4F6',
        borderTopWidth: 2,
        borderTopColor: '#E5E7EB',
    },
    tableCellTotal: {
        backgroundColor: '#F3F4F6',
        paddingVertical: 12,
    },
    tableCellTotalText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#111827',
        textTransform: 'uppercase',
    },
    tableCellTotalValue: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
        textAlign: 'center',
    },
    tableActionsContainer: {
        padding: 16,
        gap: 12,
    },
    // ✅ NOUVEAU: Styles pour liste
    listDayCard: {
        padding: 16,
        marginBottom: 16,
    },
    listDayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    listDayTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    listDayCost: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    listMealsContainer: {
        gap: 12,
    },
    listMealItem: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    listMealLeft: {
        width: 100,
        alignItems: 'flex-start',
    },
    listMealType: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginTop: 4,
    },
    listMealRight: {
        flex: 1,
    },
    listMealName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    listMealComplements: {
        fontSize: 12,
        color: '#10B981',
        fontStyle: 'italic',
        marginBottom: 4,
    },
    listMealInfo: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    listRecipeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    listRecipeButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    summaryCard: {
        padding: 16,
        marginTop: 8,
        marginBottom: 16,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    // ✅ NOUVEAU: Styles pour modal commande
    feesSummary: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    feesTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    feesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    feesTotalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    feesLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    feesValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    feesTotalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    feesTotalValue: {
        fontSize: 18,
        fontWeight: '900',
        color: modernColors.primary,
    },
    insufficientBalanceText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 8,
        fontStyle: 'italic',
    },
    marketSelection: {
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    marketItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    marketItemSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EEF2FF',
    },
    marketItemContent: {
        flex: 1,
    },
    marketItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    marketItemAddress: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 4,
    },
    marketItemDistance: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '500',
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        padding: 20,
        fontStyle: 'italic',
    },
});

export default MenuWeekCalendarScreen;

