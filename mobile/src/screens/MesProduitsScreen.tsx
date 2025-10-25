// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch } from '../services/api';
import { modernColors, modernStyles } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

interface Product {
    id: string;
    nom: string;
    type: string;
    prix: number | string;
    devise?: string;
    description?: string;
    is_active?: boolean;
    serviceId: string;
    serviceTitre: string;
    images?: string[];
    [key: string]: any;
}

const MesProduitsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
    const [categoryFilter, setCategoryFilter] = useState<string>('tous');

    // Charger tous les produits de tous les services du prestataire
    const loadProducts = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // Charger tous les services du prestataire
            const servicesResponse = await apiGet('/api/prestataire/services');

            if (servicesResponse.success && servicesResponse.data) {
                const services = servicesResponse.data;
                console.log('[MesProduitsScreen] 📦 Services reçus:', services.length);

                // Extraire tous les produits de tous les services
                const allProducts: Product[] = [];
                
                services.forEach((service: any) => {
                    const serviceId = service.id.toString();
                    const serviceTitre = service.data?.titre_service?.valeur || service.titre || 'Service sans titre';
                    const produits = service.data?.produits?.valeur;

                    if (produits && Array.isArray(produits)) {
                        produits.forEach((product: any) => {
                            allProducts.push({
                                ...product,
                                id: product.id || `${serviceId}_${product.nom}`,
                                serviceId,
                                serviceTitre,
                                is_active: product.is_active !== undefined ? product.is_active : true
                            });
                        });
                    }
                });

                console.log('[MesProduitsScreen] 📦 Total produits extraits:', allProducts.length);
                setProducts(allProducts);
            } else {
                console.error('[MesProduitsScreen] Erreur chargement services:', servicesResponse.error);
                setProducts([]);
            }
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de charger vos produits');
            setProducts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadProducts();
        }, [])
    );

    const onRefresh = () => {
        loadProducts(true);
    };

    // Activer/Désactiver un produit spécifique
    const handleToggleProduct = async (product: Product) => {
        try {
            const newStatus = !product.is_active;
            
            // Si RÉACTIVATION (inactif → actif)
            if (newStatus) {
                // 🚌 SPÉCIAL: Bloquer réactivation tickets de voyage expirés
                if (product.type === 'ticket_voyage' && product.dateDepart) {
                    try {
                        const [day, month, year] = product.dateDepart.split('/');
                        const departureDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        const now = new Date();
                        
                        if (departureDate < now) {
                            Alert.alert(
                                '⚠️ Réactivation impossible',
                                `Ce ticket de voyage est expiré.\n\nDépart prévu: ${product.dateDepart}\nDate actuelle: ${now.toLocaleDateString('fr-FR')}\n\n🚫 Les tickets expirés ne peuvent pas être réactivés.\n\n✅ Créez un nouveau ticket avec une date future.`,
                                [{ text: 'Compris' }]
                            );
                            return;
                        }
                    } catch (dateError) {
                        console.warn('Erreur parsing date:', dateError);
                        // Continuer si erreur de parsing
                    }
                }
                
                // Vérifier le solde et facturer 1000 FCFA
                const activationCost = 1000;
                const balanceResponse = await apiGet('/api/users/balance');
                
                if (!balanceResponse.success || !balanceResponse.data) {
                    Alert.alert('Erreur', 'Impossible de vérifier votre solde');
                    return;
                }
                
                const currentBalance = balanceResponse.data.tokens_balance || 0;
                
                if (currentBalance < activationCost) {
                    Alert.alert(
                        '💰 Solde insuffisant',
                        `Coût de réactivation: ${activationCost.toLocaleString()} FCFA\nVotre solde: ${currentBalance.toLocaleString()} FCFA\n\nVeuillez recharger votre compte.`
                    );
                    return;
                }
                
                Alert.alert(
                    '✅ Réactiver le produit',
                    `"${product.nom}"\n\n💰 Coût: ${activationCost.toLocaleString()} FCFA\nSolde après: ${(currentBalance - activationCost).toLocaleString()} FCFA`,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Confirmer',
                            onPress: async () => {
                                try {
                                    // Déduire le coût
                                    const deductResponse = await apiPost('/api/users/deduct-balance', {
                                        amount: activationCost,
                                        reason: 'product_reactivation'
                                    });
                                    
                                    if (!deductResponse.success) {
                                        Alert.alert('Erreur', 'Impossible de déduire le montant');
                                        return;
                                    }
                                    
                                    // Toggle le produit
                                    const response = await apiPatch(`/api/products/${product.id}/toggle-status`, {
                                        is_active: newStatus
                                    });

                                    if (response.success) {
                                        setProducts(prevProducts =>
                                            prevProducts.map(p =>
                                                p.id === product.id ? { ...p, is_active: newStatus } : p
                                            )
                                        );
                                        
                                        Alert.alert(
                                            '✅ Produit réactivé',
                                            `${activationCost.toLocaleString()} FCFA débités\nNouveau solde: ${(currentBalance - activationCost).toLocaleString()} FCFA`
                                        );
                                    } else {
                                        Alert.alert('Erreur', response.error || 'Impossible de réactiver');
                                    }
                                } catch (error: any) {
                                    console.error('[MesProduitsScreen] Erreur réactivation:', error);
                                    Alert.alert('Erreur', error.message || 'Impossible de réactiver');
                                }
                            }
                        }
                    ]
                );
            } else {
                // DÉSACTIVATION (actif → inactif) = GRATUIT
                Alert.alert(
                    '⏸️ Désactiver le produit',
                    `"${product.nom}"\n\n✅ Désactivation gratuite\n\nLe produit ne sera plus visible dans les recherches.`,
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Désactiver',
                            onPress: async () => {
                                try {
                                    const response = await apiPatch(`/api/products/${product.id}/toggle-status`, {
                                        is_active: newStatus
                                    });

                                    if (response.success) {
                                        setProducts(prevProducts =>
                                            prevProducts.map(p =>
                                                p.id === product.id ? { ...p, is_active: newStatus } : p
                                            )
                                        );
                                        
                                        Alert.alert('✅ Succès', 'Produit désactivé avec succès');
                                    } else {
                                        Alert.alert('Erreur', response.error || 'Impossible de désactiver');
                                    }
                                } catch (error: any) {
                                    console.error('[MesProduitsScreen] Erreur désactivation:', error);
                                    Alert.alert('Erreur', error.message || 'Impossible de désactiver');
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur toggle product:', error);
        }
    };

    // Supprimer un produit
    const handleDeleteProduct = async (product: Product) => {
        Alert.alert(
            'Supprimer le produit',
            `Êtes-vous sûr de vouloir supprimer "${product.nom}" ?\n\nCette action est irréversible.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiDelete(`/api/products/${product.id}`);
                            
                            if (response.success) {
                                setProducts(prevProducts => prevProducts.filter(p => p.id !== product.id));
                                Alert.alert('✅ Succès', 'Produit supprimé avec succès');
                            } else {
                                Alert.alert('Erreur', response.error || 'Impossible de supprimer le produit');
                            }
                        } catch (error: any) {
                            console.error('[MesProduitsScreen] Erreur suppression:', error);
                            Alert.alert('Erreur', error.message || 'Impossible de supprimer le produit');
                        }
                    }
                }
            ]
        );
    };

    // Modifier un produit (naviguer vers le service parent en mode édition)
    const handleEditProduct = (product: Product) => {
        Alert.alert(
            'Modifier le produit',
            `Pour modifier "${product.nom}", vous serez redirigé vers le service "${product.serviceTitre}".\n\nVous pourrez y modifier tous les produits.`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Continuer',
                    onPress: () => {
                        navigation.navigate('MesServices' as never);
                        // L'utilisateur devra ensuite cliquer sur "Modifier" dans le service
                    }
                }
            ]
        );
    };

    // Partager un produit
    const handleShareProduct = async (product: Product) => {
        try {
            const shareMessage = `🛍️ ${product.nom}\n\n` +
                `💰 Prix: ${typeof product.prix === 'string' ? product.prix : product.prix.toLocaleString()} ${product.devise || 'FCFA'}\n\n` +
                `${product.description || ''}\n\n` +
                `📱 Disponible sur Yukpomnang!\n` +
                `Service: ${product.serviceTitre}`;

            await Share.share({
                message: shareMessage,
                title: `Partagez ${product.nom}`,
            });
            
            console.log('✅ Produit partagé:', product.nom);
        } catch (error) {
            console.error('Erreur partage produit:', error);
        }
    };

    // Dupliquer un produit
    const handleDuplicateProduct = async (product: Product) => {
        try {
            const duplicationCost = 1000; // 1000 FCFA comme pour réactivation
            
            // Vérifier le solde
            const balanceResponse = await apiGet('/api/users/balance');
            
            if (!balanceResponse.success || !balanceResponse.data) {
                Alert.alert('Erreur', 'Impossible de vérifier votre solde');
                return;
            }
            
            const currentBalance = balanceResponse.data.tokens_balance || 0;
            
            if (currentBalance < duplicationCost) {
                Alert.alert(
                    '💰 Solde insuffisant',
                    `Coût de duplication: ${duplicationCost.toLocaleString()} FCFA\nVotre solde: ${currentBalance.toLocaleString()} FCFA\n\nVeuillez recharger votre compte.`
                );
                return;
            }
            
            Alert.alert(
                '📋 Dupliquer le produit',
                `"${product.nom}"\n\nLa copie sera ajoutée au service "${product.serviceTitre}"\n\n💰 Coût: ${duplicationCost.toLocaleString()} FCFA\nSolde après: ${(currentBalance - duplicationCost).toLocaleString()} FCFA`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Confirmer',
                        onPress: async () => {
                            try {
                                // Déduire le coût
                                const deductResponse = await apiPost('/api/users/deduct-balance', {
                                    amount: duplicationCost,
                                    reason: 'product_duplication'
                                });
                                
                                if (!deductResponse.success) {
                                    Alert.alert('Erreur', 'Impossible de déduire le montant');
                                    return;
                                }
                                
                                // Créer une copie du produit
                                const duplicatedProduct = {
                                    ...product,
                                    id: `duplicate_${Date.now()}`,
                                    nom: `${product.nom} (Copie)`,
                                    images: [],
                                    videos: [],
                                    is_active: true, // Nouveau produit actif par défaut
                                };

                                // Appel API pour ajouter le produit dupliqué au service
                                const response = await apiPatch(`/api/services/${product.serviceId}/add-product`, {
                                    product: duplicatedProduct
                                });

                                if (response.success) {
                                    Alert.alert(
                                        '✅ Produit dupliqué',
                                        `Coût: ${duplicationCost.toLocaleString()} FCFA\nNouveau solde: ${(currentBalance - duplicationCost).toLocaleString()} FCFA\n\nLe produit a été dupliqué avec succès.`,
                                        [
                                            {
                                                text: 'Voir mes produits',
                                                onPress: () => loadProducts(true)
                                            }
                                        ]
                                    );
                                } else {
                                    // Si l'endpoint n'existe pas, proposer alternative
                                    Alert.alert(
                                        '⚠️ Fonctionnalité en développement',
                                        'La duplication de produit nécessite de modifier le service parent.\n\nPour dupliquer ce produit:\n1. Allez dans "Boutique | Services"\n2. Modifiez le service\n3. Utilisez le bouton "Dupliquer" dans le bloc produits',
                                        [{ text: 'Compris' }]
                                    );
                                }
                            } catch (error: any) {
                                console.error('[MesProduitsScreen] Erreur duplication:', error);
                                Alert.alert('Erreur', error.message || 'Impossible de dupliquer le produit');
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur duplication:', error);
        }
    };

    // Promouvoir un produit
    const handlePromoteProduct = (product: Product) => {
        Alert.alert(
            '🎉 Promouvoir le produit',
            `Booster "${product.nom}" pour augmenter sa visibilité ?\n\n✨ Votre produit apparaîtra en tête des résultats de recherche.\n\n💰 Coût: À définir`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Créer une publicité',
                    onPress: () => {
                        navigation.navigate('CreatePublicite' as never, {
                            productId: product.id,
                            productName: product.nom,
                            serviceId: product.serviceId
                        });
                    }
                }
            ]
        );
    };

    // Voir les statistiques d'un produit
    const handleViewStats = (product: Product) => {
        const stats = `📊 Statistiques de "${product.nom}"\n\n` +
            `👁️ Vues: ${product.views || 0}\n` +
            `💬 Interactions: ${product.interactions || 0}\n` +
            `📅 Créé le: ${product.createdAt ? new Date(product.createdAt).toLocaleDateString('fr-FR') : 'N/A'}\n` +
            `✅ Statut: ${product.is_active ? 'Actif' : 'Inactif'}\n` +
            `🏷️ Catégorie: ${getProductTypeLabel(product.type)}`;

        Alert.alert('📊 Statistiques', stats, [{ text: 'OK' }]);
    };

    // Filtrer les produits
    const filteredProducts = products.filter(product => {
        // Filtre par statut
        if (filter === 'actif' && !product.is_active) return false;
        if (filter === 'inactif' && product.is_active) return false;

        // Filtre par catégorie
        if (categoryFilter !== 'tous' && product.type !== categoryFilter) return false;

        return true;
    });

    // Récupérer les catégories uniques
    const categories = ['tous', ...new Set(products.map(p => p.type).filter(Boolean))];

    const getProductTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'ticket_voyage': '🚌 Ticket de voyage',
            'covoiturage': '🚗 Covoiturage',
            'immobilier_batiment': '🏢 Immobilier',
            'automobile': '🚙 Automobile',
            'prestation_service': '💼 Prestation',
            // ... ajouter d'autres types selon besoin
        };
        return labels[type] || type;
    };

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
            {/* Header avec gradient */}
            <LinearGradient
                colors={[modernColors.primary, '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Mes Produits</Text>
                        <Text style={styles.headerSubtitle}>
                            {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <View style={styles.headerStats}>
                        <View style={styles.statBadge}>
                            <Text style={styles.statNumber}>{products.filter(p => p.is_active).length}</Text>
                            <Text style={styles.statLabel}>actifs</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            {/* Filtres */}
            <View style={styles.filtersContainer}>
                {/* Filtre par statut */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                    {['tous', 'actif', 'inactif'].map((filterOption) => (
                        <TouchableOpacity
                            key={filterOption}
                            style={[
                                styles.filterChip,
                                filter === filterOption && styles.filterChipActive
                            ]}
                            onPress={() => setFilter(filterOption as any)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                filter === filterOption && styles.filterChipTextActive
                            ]}>
                                {filterOption === 'tous' ? '📦 Tous' : 
                                 filterOption === 'actif' ? '✅ Actifs' : '⏸️ Inactifs'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Filtre par catégorie */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                    {categories.map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryChip,
                                categoryFilter === cat && styles.categoryChipActive
                            ]}
                            onPress={() => setCategoryFilter(cat)}
                        >
                            <Text style={[
                                styles.categoryChipText,
                                categoryFilter === cat && styles.categoryChipTextActive
                            ]}>
                                {cat === 'tous' ? '🏷️ Toutes catégories' : getProductTypeLabel(cat)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Liste des produits */}
            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {filteredProducts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <SafeIcon name="package" size={64} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>Aucun produit</Text>
                        <Text style={styles.emptySubtitle}>
                            {filter !== 'tous' 
                                ? `Aucun produit ${filter}` 
                                : 'Créez un service avec des produits'}
                        </Text>
                        <NativeButton
                            title="➕ Créer un service"
                            onPress={() => navigation.navigate('FormulaireYukpoIntelligent' as never)}
                            variant="primary"
                            size="medium"
                            style={{ marginTop: 20 }}
                        />
                    </View>
                ) : (
                    <View style={styles.productsList}>
                        {filteredProducts.map((product) => (
                            <NativeCard key={product.id} style={styles.productCard}>
                                {/* Header produit */}
                                <View style={styles.productHeader}>
                                    <View style={styles.productTitleContainer}>
                                        <Text style={styles.productName} numberOfLines={2}>
                                            {product.nom || 'Produit sans nom'}
                                        </Text>
                                        <View style={[
                                            styles.productStatusBadge,
                                            { backgroundColor: product.is_active ? '#10B981' : '#9CA3AF' }
                                        ]}>
                                            <Text style={styles.productStatusText}>
                                                {product.is_active ? 'Actif' : 'Inactif'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Infos produit */}
                                <View style={styles.productInfo}>
                                    <View style={styles.productInfoRow}>
                                        <SafeIcon name="folder" size={14} color="#6B7280" />
                                        <Text style={styles.productServiceName} numberOfLines={1}>
                                            {product.serviceTitre}
                                        </Text>
                                    </View>
                                    
                                    {product.type && (
                                        <View style={styles.productInfoRow}>
                                            <SafeIcon name="tag" size={14} color="#6366F1" />
                                            <Text style={styles.productType}>
                                                {getProductTypeLabel(product.type)}
                                            </Text>
                                        </View>
                                    )}

                                    {product.prix && (
                                        <View style={styles.productInfoRow}>
                                            <SafeIcon name="dollar-sign" size={14} color="#10B981" />
                                            <Text style={styles.productPrix}>
                                                {typeof product.prix === 'string' ? product.prix : product.prix.toLocaleString()} {product.devise || 'FCFA'}
                                            </Text>
                                        </View>
                                    )}

                                    {product.description && (
                                        <Text style={styles.productDescription} numberOfLines={2}>
                                            {product.description}
                                        </Text>
                                    )}
                                </View>

                                {/* Actions principales */}
                                <View style={styles.productActions}>
                                    {/* Activer/Désactiver */}
                                    {product.type === 'ticket_voyage' ? (
                                        // 🚌 TICKET DE VOYAGE: Gestion automatique (grisé)
                                        <View style={[styles.actionButton, styles.actionButtonDisabled]}>
                                            <SafeIcon name="clock" size={18} color="#9CA3AF" />
                                            <Text style={styles.actionButtonTextDisabled}>
                                                Gestion auto
                                            </Text>
                                        </View>
                                    ) : (
                                        // Autres produits: Toggle normal
                                        <TouchableOpacity
                                            style={[
                                                styles.actionButton,
                                                product.is_active ? styles.deactivateButton : styles.activateButton
                                            ]}
                                            onPress={() => handleToggleProduct(product)}
                                        >
                                            <SafeIcon 
                                                name={product.is_active ? 'pause-circle' : 'play-circle'} 
                                                size={18} 
                                                color="#FFFFFF" 
                                            />
                                            <Text style={styles.actionButtonText}>
                                                {product.is_active ? 'Désactiver' : 'Activer'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Modifier */}
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.editButton]}
                                        onPress={() => handleEditProduct(product)}
                                    >
                                        <SafeIcon name="edit" size={18} color="#FFFFFF" />
                                        <Text style={styles.actionButtonText}>Modifier</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Actions secondaires */}
                                <View style={styles.secondaryActions}>
                                    {/* Partager */}
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => handleShareProduct(product)}
                                    >
                                        <SafeIcon name="share-2" size={20} color="#3B82F6" />
                                    </TouchableOpacity>

                                    {/* Dupliquer */}
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => handleDuplicateProduct(product)}
                                    >
                                        <SafeIcon name="copy" size={20} color="#8B5CF6" />
                                    </TouchableOpacity>

                                    {/* Statistiques */}
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => handleViewStats(product)}
                                    >
                                        <SafeIcon name="bar-chart-2" size={20} color="#10B981" />
                                    </TouchableOpacity>

                                    {/* Promouvoir */}
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => handlePromoteProduct(product)}
                                    >
                                        <SafeIcon name="trending-up" size={20} color="#F59E0B" />
                                    </TouchableOpacity>

                                    {/* Supprimer */}
                                    <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => handleDeleteProduct(product)}
                                    >
                                        <SafeIcon name="trash-2" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </NativeCard>
                        ))}
                    </View>
                )}

                {/* Bouton créer nouveau service */}
                {filteredProducts.length > 0 && (
                    <View style={styles.footerContainer}>
                        <NativeButton
                            title="➕ Créer un nouveau service"
                            onPress={() => navigation.navigate('FormulaireYukpoIntelligent' as never)}
                            variant="outline"
                            size="large"
                            style={styles.createButton}
                        />
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
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextContainer: {
        flex: 1,
        marginLeft: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#E0E7FF',
        marginTop: 4,
    },
    headerStats: {
        flexDirection: 'row',
        gap: 12,
    },
    statBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    statLabel: {
        fontSize: 11,
        color: '#E0E7FF',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    filtersContainer: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterRow: {
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#FFFFFF',
    },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    categoryChipActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    categoryChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366F1',
    },
    categoryChipTextActive: {
        color: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    productsList: {
        padding: 16,
    },
    productCard: {
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    productHeader: {
        marginBottom: 12,
    },
    productTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    productName: {
        fontSize: 17,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
        marginRight: 8,
    },
    productStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    productStatusText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    productInfo: {
        gap: 8,
        marginBottom: 16,
    },
    productInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    productServiceName: {
        fontSize: 13,
        color: '#6B7280',
        flex: 1,
    },
    productType: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366F1',
    },
    productPrix: {
        fontSize: 14,
        fontWeight: '700',
        color: '#10B981',
    },
    productDescription: {
        fontSize: 13,
        color: '#9CA3AF',
        lineHeight: 18,
        marginTop: 4,
    },
    productActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    activateButton: {
        backgroundColor: '#10B981',
    },
    deactivateButton: {
        backgroundColor: '#F59E0B',
    },
    editButton: {
        backgroundColor: '#6366F1',
    },
    deleteButton: {
        backgroundColor: '#EF4444',
        flex: 0,
        paddingHorizontal: 14,
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    actionButtonDisabled: {
        backgroundColor: '#E5E7EB',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        opacity: 0.7,
    },
    actionButtonTextDisabled: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    secondaryActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    footerContainer: {
        padding: 16,
    },
    createButton: {
        marginBottom: 20,
    },
});

export default MesProduitsScreen;
