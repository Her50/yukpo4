// @ts-nocheck
/**
 * Écran de gestion des produits
 * Affiche tous les produits de l'utilisateur avec options de management
 */
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPatch } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

interface Product {
    id: string;
    serviceId: string;
    productIndex: number;
    nom: string;
    type: string;
    prix: string;
    devise: string;
    description?: string;
    images?: string[];
    isActive: boolean;
    createdAt: string;
    promotionActive?: boolean;
    promotionValeur?: string;
    [key: string]: any;
}

const MesProduitsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // Récupérer tous les services de l'utilisateur
            const response = await apiGet('/api/prestataire/services');

            if (response.ok) {
                const services = await response.json();

                // Extraire tous les produits de tous les services
                const allProducts: Product[] = [];

                services.forEach((service: any) => {
                    if (service.data?.produits && Array.isArray(service.data.produits)) {
                        service.data.produits.forEach((product: any, index: number) => {
                            allProducts.push({
                                ...product,
                                id: `${service.id}_${index}`,
                                serviceId: service.id,
                                productIndex: index,
                                isActive: true, // TODO: Récupérer de products_lifecycle
                                createdAt: service.created_at
                            });
                        });
                    }
                });

                // Trier par date de création (plus récent en premier)
                allProducts.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                setProducts(allProducts);
            } else {
                console.error('Erreur API:', response.status);
                setProducts([]);
            }
        } catch (error) {
            console.error('Erreur chargement produits:', error);
            Alert.alert('Erreur', 'Impossible de charger vos produits');
            setProducts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        loadProducts(true);
    };

    const getTypeInfo = (type: string) => {
        const types = {
            immobilier_batiment: { icon: '🏢', label: 'Bâtiment', color: '#3B82F6' },
            immobilier_terrain: { icon: '🏞️', label: 'Terrain', color: '#10B981' },
            automobile: { icon: '🚗', label: 'Auto', color: '#F59E0B' },
            ticket_voyage: { icon: '🚌', label: 'Voyage', color: '#8B5CF6' },
            covoiturage: { icon: '🚕', label: 'Covoiturage', color: '#EC4899' },
            vetement: { icon: '👔', label: 'Vêtement', color: '#EF4444' },
            chaussure: { icon: '👟', label: 'Chaussure', color: '#F97316' },
            electromenager: { icon: '📱', label: 'Électro', color: '#06B6D4' },
            mobilier: { icon: '🪑', label: 'Mobilier', color: '#84CC16' },
            aliments: { icon: '🍕', label: 'Aliment', color: '#F59E0B' },
            livres_fournitures: { icon: '📚', label: 'Livre', color: '#6366F1' },
            quincaillerie: { icon: '🔧', label: 'Quincaillerie', color: '#64748B' },
            pharmacie: { icon: '💊', label: 'Pharmacie', color: '#059669' },
            hopital_clinique: { icon: '🏥', label: 'Hôpital', color: '#DC2626' },
            prestation_service: { icon: '💼', label: 'Service', color: '#8B5CF6' },
            autre: { icon: '📦', label: 'Produit', color: '#6B7280' }
        };
        return types[type] || types.autre;
    };

    const handleViewProduct = (product: Product) => {
        navigation.navigate('FormulaireYukpoIntelligent', {
            mode: 'view',
            serviceId: product.serviceId,
            focusProductIndex: product.productIndex
        });
    };

    const handleEditProduct = (product: Product) => {
        navigation.navigate('FormulaireYukpoIntelligent', {
            mode: 'edit',
            serviceId: product.serviceId,
            focusProductIndex: product.productIndex
        });
    };

    const handleDeleteProduct = (product: Product) => {
        Alert.alert(
            'Supprimer le produit',
            `Êtes-vous sûr de vouloir supprimer "${product.nom}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Récupérer le service complet
                            const serviceResponse = await apiGet(`/api/services/${product.serviceId}`);
                            if (!serviceResponse.ok) throw new Error('Service non trouvé');

                            const service = await serviceResponse.json();

                            // Supprimer le produit du tableau
                            const updatedProducts = [...(service.data.produits || [])];
                            updatedProducts.splice(product.productIndex, 1);

                            // Mettre à jour le service
                            const updateResponse = await apiPatch(`/api/services/${product.serviceId}`, {
                                data: {
                                    ...service.data,
                                    produits: updatedProducts
                                }
                            });

                            if (updateResponse.ok) {
                                Alert.alert('Succès', 'Produit supprimé avec succès');
                                loadProducts();
                            } else {
                                throw new Error('Échec de la suppression');
                            }
                        } catch (error) {
                            console.error('Erreur suppression:', error);
                            Alert.alert('Erreur', 'Impossible de supprimer le produit');
                        }
                    }
                }
            ]
        );
    };

    const handleToggleActivation = async (product: Product) => {
        try {
            const endpoint = product.isActive
                ? `/api/products/${product.serviceId}/${product.productIndex}/deactivate`
                : `/api/products/${product.serviceId}/${product.productIndex}/activate`;

            const response = await apiPatch(endpoint, {});

            if (response.ok) {
                Alert.alert(
                    'Succès',
                    product.isActive ? 'Produit désactivé' : 'Produit activé'
                );
                loadProducts();
            } else {
                throw new Error('Échec de l\'opération');
            }
        } catch (error) {
            console.error('Erreur activation/désactivation:', error);
            Alert.alert('Erreur', 'Impossible de modifier le statut du produit');
        }
    };

    const handleShareProduct = async (product: Product) => {
        try {
            const message = `🔥 Découvrez mon produit !\n\n${getTypeInfo(product.type).icon} ${product.nom}\n\n${product.description || ''}\n\n💰 Prix: ${product.prix} ${product.devise}\n\n📱 Yukpomnang - Votre marketplace locale`;

            await Share.share({
                message,
                title: product.nom
            });
        } catch (error) {
            console.error('Erreur partage:', error);
        }
    };

    const filteredProducts = products.filter(product => {
        if (filter === 'actif') return product.isActive;
        if (filter === 'inactif') return !product.isActive;
        return true;
    });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement de vos produits...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={modernColors.primaryGradient}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>📦 Mes Produits</Text>
                <Text style={styles.headerSubtitle}>
                    {products.length} produit{products.length > 1 ? 's' : ''}
                </Text>
            </LinearGradient>

            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['tous', 'actif', 'inactif'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[
                                styles.filterButton,
                                filter === f && styles.filterButtonActive
                            ]}
                            onPress={() => setFilter(f as any)}
                        >
                            <Text style={[
                                styles.filterButtonText,
                                filter === f && styles.filterButtonTextActive
                            ]}>
                                {f === 'tous' ? '📋 Tous' : f === 'actif' ? '✅ Actifs' : '❌ Inactifs'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Liste des produits */}
            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filteredProducts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📦</Text>
                        <Text style={styles.emptyTitle}>Aucun produit</Text>
                        <Text style={styles.emptyText}>
                            {filter === 'actif' ? 'Vous n\'avez pas de produits actifs' :
                                filter === 'inactif' ? 'Vous n\'avez pas de produits inactifs' :
                                    'Créez votre premier produit pour commencer'}
                        </Text>
                        <NativeButton
                            title="➕ Créer un produit"
                            onPress={() => navigation.navigate('FormulaireYukpoIntelligent')}
                            variant="primary"
                            style={{ marginTop: 20 }}
                        />
                    </View>
                ) : (
                    filteredProducts.map((product) => {
                        const typeInfo = getTypeInfo(product.type);
                        return (
                            <View key={product.id} style={styles.productCard}>
                                {/* Image */}
                                {product.images && product.images.length > 0 && (
                                    <Image
                                        source={{ uri: product.images[0] }}
                                        style={styles.productImage}
                                        resizeMode="cover"
                                    />
                                )}

                                <View style={styles.productContent}>
                                    {/* Header */}
                                    <View style={styles.productHeader}>
                                        <View style={{ flex: 1 }}>
                                            <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
                                                <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                                                    {typeInfo.icon} {typeInfo.label}
                                                </Text>
                                            </View>
                                            <Text style={styles.productName}>{product.nom}</Text>
                                            {product.description && (
                                                <Text style={styles.productDescription} numberOfLines={2}>
                                                    {product.description}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: product.isActive ? '#10B981' : '#9E9E9E' }
                                        ]}>
                                            <Text style={styles.statusText}>
                                                {product.isActive ? 'Actif' : 'Inactif'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Prix */}
                                    <View style={styles.priceContainer}>
                                        <Text style={styles.priceLabel}>💰 Prix:</Text>
                                        <Text style={styles.priceValue}>
                                            {product.prix} {product.devise}
                                        </Text>
                                    </View>

                                    {/* Promotion */}
                                    {product.promotionActive && (
                                        <View style={styles.promotionBadge}>
                                            <SafeIcon name="tag" size={14} color="#EF4444" />
                                            <Text style={styles.promotionText}>
                                                🎁 {product.promotionValeur}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Actions */}
                                    <View style={styles.actionsContainer}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleViewProduct(product)}
                                        >
                                            <SafeIcon name="eye" size={18} color={modernColors.primary} />
                                            <Text style={styles.actionText}>Voir</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleEditProduct(product)}
                                        >
                                            <SafeIcon name="edit-2" size={18} color={modernColors.warning} />
                                            <Text style={styles.actionText}>Modifier</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleShareProduct(product)}
                                        >
                                            <SafeIcon name="share-2" size={18} color={modernColors.success} />
                                            <Text style={styles.actionText}>Partager</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleToggleActivation(product)}
                                        >
                                            <SafeIcon
                                                name={product.isActive ? "toggle-right" : "toggle-left"}
                                                size={18}
                                                color={product.isActive ? modernColors.success : modernColors.textSecondary}
                                            />
                                            <Text style={styles.actionText}>
                                                {product.isActive ? 'Désactiver' : 'Activer'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => handleDeleteProduct(product)}
                                        >
                                            <SafeIcon name="trash-2" size={18} color={modernColors.error} />
                                            <Text style={[styles.actionText, styles.deleteText]}>Supprimer</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bouton Créer */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('FormulaireYukpoIntelligent')}
            >
                <LinearGradient
                    colors={modernColors.primaryGradient}
                    style={styles.fabGradient}
                >
                    <SafeIcon name="plus" size={24} color="#FFFFFF" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5'
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary
    },
    header: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#FFFFFF',
        opacity: 0.9
    },
    filtersContainer: {
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF'
    },
    filterButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 12
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary
    },
    filterButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary
    },
    filterButtonTextActive: {
        color: '#FFFFFF'
    },
    content: {
        flex: 1,
        paddingHorizontal: 16
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 32
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginTop: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    productImage: {
        width: '100%',
        height: 200
    },
    productContent: {
        padding: 16
    },
    productHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginBottom: 8
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '600'
    },
    productName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 4
    },
    productDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF'
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12
    },
    priceLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginRight: 8
    },
    priceValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.primary
    },
    promotionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 12
    },
    promotionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
        marginLeft: 4
    },
    actionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        gap: 6
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text
    },
    deleteButton: {
        backgroundColor: '#FEE2E2'
    },
    deleteText: {
        color: modernColors.error
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8
    },
    fabGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default MesProduitsScreen;


