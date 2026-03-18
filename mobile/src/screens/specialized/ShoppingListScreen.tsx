// ✅ Écran Liste de Courses - Planification Menus
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useLocation } from '../../contexts/LocationContext';
import { deliveryApi } from '../../services/api';
import { menuPlanningService, ShoppingList, ShoppingListItem } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const { width } = Dimensions.get('window');

interface ShoppingListScreenProps { }

const ShoppingListScreen: React.FC<ShoppingListScreenProps> = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const weekStart: string | undefined = route.params?.weekStart;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
    const [organizedByStore, setOrganizedByStore] = useState(false);
    const [organizedByAisle, setOrganizedByAisle] = useState(false);
    const [supermarkets, setSupermarkets] = useState<any[]>([]);
    const [loadingSupermarkets, setLoadingSupermarkets] = useState(false);
    const { location } = useLocation();
    const { t } = useLanguageSafe();

    useFocusEffect(
        useCallback(() => {
            loadShoppingList();
        }, [weekStart])
    );

    const loadShoppingList = async () => {
        try {
            setLoading(true);
            const response = await menuPlanningService.getShoppingList(weekStart);

            if (response.success && response.data?.shopping_list) {
                setShoppingList(response.data.shopping_list);
                setOrganizedByStore(response.data.shopping_list.organized_by_store || false);
                setOrganizedByAisle(response.data.shopping_list.organized_by_aisle || false);
            } else {
                // Générer la liste si elle n'existe pas
                await generateShoppingList();
            }
        } catch (error) {
            console.error('[ShoppingList] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const generateShoppingList = async () => {
        try {
            setLoading(true);
            const response = await menuPlanningService.generateShoppingList(weekStart);

            if (response.success && response.data?.shopping_list) {
                setShoppingList(response.data.shopping_list);
            }
        } catch (error: any) {
            console.error('[ShoppingList] Erreur génération:', error);
            Alert.alert(t('message.error'), error.message || t('shoppingListScreen.erreurLorsDeLaGenerationDe'));
        } finally {
            setLoading(false);
        }
    };

    const toggleItemChecked = async (itemId: number, isChecked: boolean) => {
        // TODO: Implémenter mise à jour item via API
        if (shoppingList) {
            const updatedItems = shoppingList.items.map(item =>
                item.id === itemId ? { ...item, is_checked: !isChecked } : item
            );
            setShoppingList({ ...shoppingList, items: updatedItems });
        }
    };

    const organizeByStore = () => {
        setOrganizedByStore(!organizedByStore);
        // TODO: Réorganiser items par magasin
    };

    const organizeByAisle = () => {
        setOrganizedByAisle(!organizedByAisle);
        // TODO: Réorganiser items par rayon
    };

    const renderShoppingItem = (item: ShoppingListItem) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={[
                    styles.itemCard,
                    item.is_checked && styles.itemCardChecked,
                ]}
                onPress={() => toggleItemChecked(item.id, item.is_checked)}
            >
                <View style={styles.itemContent}>
                    <View style={styles.itemLeft}>
                        <View
                            style={[
                                styles.checkbox,
                                item.is_checked && styles.checkboxChecked,
                            ]}
                        >
                            {item.is_checked && (
                                <SafeIcon name="check" size={16} color="#fff" type="lucide" />
                            )}
                        </View>
                        <View style={styles.itemInfo}>
                            <Text
                                style={[
                                    styles.itemName,
                                    item.is_checked && styles.itemNameChecked,
                                ]}
                            >
                                {item.ingredient_name}
                            </Text>
                            <Text style={styles.itemQuantity}>
                                {item.quantity} {item.unit}
                                {item.category && ` • ${item.category}`}
                            </Text>
                        </View>
                    </View>
                    {item.actual_price && (
                        <Text style={styles.itemPrice}>
                            {item.actual_price.toLocaleString()} FCFA
                        </Text>
                    )}
                </View>
                {item.store_section && (
                    <Text style={styles.itemSection}>
                        \uD83D\uDCCD {item.store_section}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    if (loading && !shoppingList) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('shoppingList.chargementDeLaListe')}</Text>
            </View>
        );
    }

    const checkedCount = shoppingList?.items.filter(item => item.is_checked).length || 0;
    const totalItems = shoppingList?.items.length || 0;

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
                        <SafeIcon name="ShoppingCart" size={32} color="#fff" type="lucide" />
                        <Text style={styles.headerTitle}>{t('shoppingList.listeDeCourses')}</Text>
                    </View>
                    {shoppingList && (
                        <Text style={styles.headerSubtitle}>
                            {t('shoppingList.checkedSummary', { checked: checkedCount, total: totalItems })}
                        </Text>
                    )}
                </View>
            </LinearGradient>

            {/* Options d'organisation */}
            {shoppingList && shoppingList.items.length > 0 && (
                <View style={styles.optionsBar}>
                    <View style={styles.optionRow}>
                        <Text style={styles.optionLabel}>{t('shoppingList.organizeByStore')}</Text>
                        <Switch
                            value={organizedByStore}
                            onValueChange={organizeByStore}
                            trackColor={{ false: '#E5E7EB', true: modernColors.primary }}
                        />
                    </View>
                    <View style={styles.optionRow}>
                        <Text style={styles.optionLabel}>{t('shoppingList.organizeByAisle')}</Text>
                        <Switch
                            value={organizedByAisle}
                            onValueChange={organizeByAisle}
                            trackColor={{ false: '#E5E7EB', true: modernColors.primary }}
                        />
                    </View>
                </View>
            )}

            {/* Liste */}
            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            loadShoppingList();
                        }}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {shoppingList && shoppingList.items.length > 0 ? (
                    <View style={styles.itemsContainer}>
                        {shoppingList.items.map((item) => renderShoppingItem(item))}

                        {/* Total estimé */}
                        {shoppingList.total_estimated_cost && (
                            <NativeCard style={styles.totalCard}>
                                <View style={styles.totalRow}>
                                    <Text style={styles.totalLabel}>{t('shoppingList.totalEstime')}</Text>
                                    <Text style={styles.totalValue}>
                                        {shoppingList.total_estimated_cost.toLocaleString()} FCFA
                                    </Text>
                                </View>
                            </NativeCard>
                        )}
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="ShoppingCart" size={64} color={modernColors.textSecondary} type="lucide" />
                        <Text style={styles.emptyText}>
                            Aucun article dans la liste
                        </Text>
                        <Text style={styles.emptySubtext}>
                            La liste sera générée automatiquement depuis votre menu
                        </Text>
                        <NativeButton
                            title={t('shoppingList.genererLaListe')}
                            onPress={generateShoppingList}
                            loading={loading}
                            style={styles.generateButton}
                        />
                    </View>
                )}

                {/* Actions */}
                {shoppingList && shoppingList.items.length > 0 && (
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={async () => {
                                try {
                                    setLoadingSupermarkets(true);

                                    // Charger les supermarchés à proximité
                                    if (location?.coords) {
                                        const result = await deliveryApi.listSupermarkets(
                                            location.coords.latitude,
                                            location.coords.longitude,
                                            10 // 10 km
                                        );

                                        if (result.supermarkets && result.supermarkets.length > 0) {
                                            setSupermarkets(result.supermarkets);
                                            // Naviguer vers la sélection de supermarché pour commander
                                            navigation.navigate('DeliveryShoppingFlow' as never, {
                                                basketItems: shoppingList.items.map(item => ({
                                                    id: item.id.toString(),
                                                    name: item.ingredient_name,
                                                    quantity: item.quantity,
                                                    unit: item.unit,
                                                })),
                                            } as never);
                                        } else {
                                            Alert.alert(
                                                t('shoppingListScreen.aucunMarche'),
                                                t('shoppingListScreen.aucunMarcheTrouveAProximiteVous'),
                                                [{ text: 'OK' }]
                                            );
                                        }
                                    } else {
                                        Alert.alert(
                                            'Localisation requise',
                                            t('shoppingListScreen.veuillezActiverLaLocalisationPourTrouver'),
                                            [{ text: 'OK' }]
                                        );
                                    }
                                } catch (error: any) {
                                    console.error('[ShoppingList] Erreur marchés:', error);
                                    Alert.alert('Erreur', t('shoppingListScreen.impossibleDeChargerLesMarches'));
                                } finally {
                                    setLoadingSupermarkets(false);
                                }
                            }}
                            disabled={loadingSupermarkets}
                        >
                            {loadingSupermarkets ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <SafeIcon name="ShoppingBag" size={20} color="#fff" type="lucide" />
                                    <Text style={styles.actionButtonText}>
                                        Passer une commande marché
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
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
    optionsBar: {
        backgroundColor: '#fff',
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    itemsContainer: {
        gap: 12,
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    itemCardChecked: {
        backgroundColor: '#F0FDF4',
        borderColor: modernColors.success,
        opacity: 0.7,
    },
    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    itemNameChecked: {
        textDecorationLine: 'line-through',
        color: modernColors.textSecondary,
    },
    itemQuantity: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    itemSection: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
        fontStyle: 'italic',
    },
    totalCard: {
        padding: 16,
        marginTop: 8,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        marginBottom: 24,
    },
    generateButton: {
        minWidth: 200,
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

export default ShoppingListScreen;

