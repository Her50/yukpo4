// @ts-nocheck
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { modernColors } from '../theme/modernTheme';

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
    const handleEditProduct = async (product: Product) => {
        try {
            console.log('[MesProduitsScreen] 📝 Modification produit:', {
                productId: product.id,
                productName: product.nom,
                serviceId: product.serviceId,
                serviceName: product.serviceTitre
            });

            // Charger les données complètes du service
            const serviceResponse = await apiGet(`/api/services/${product.serviceId}`);

            if (!serviceResponse.success || !serviceResponse.data) {
                Alert.alert('Erreur', 'Impossible de charger les données du service');
                return;
            }

            const serviceData = serviceResponse.data;

            // Navigation vers le formulaire avec focus sur le bloc produits
            navigation.navigate('FormulaireYukpoIntelligent' as never, {
                mode: 'edit',
                serviceId: product.serviceId,
                serviceData: serviceData.data || {},
                suggestion: {
                    data: serviceData.data || {},
                    intention: 'modification_service',
                    confidence: 1.0
                },
                type: 'modification_service',
                editMode: true,
                // ✅ NOUVEAU: Focus sur le bloc produits avec le produit spécifique
                focusBlock: 'produits',
                focusProductId: product.id,
                fromMesProduits: true
            } as never);
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur navigation édition:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir la modification du produit');
        }
    };

    // Partager un produit
    const handleShareProduct = async (product: Product) => {
        try {
            // Générer le lien deep link pour ouvrir l'app directement sur ce produit
            const deepLink = `yukpomnang://product/${product.id}?serviceId=${product.serviceId}`;
            const webLink = `https://yukpomnang.com/product/${product.id}`;

            const shareMessage = `🛍️ ${product.nom}\n\n` +
                `💰 Prix: ${typeof product.prix === 'string' ? product.prix : product.prix.toLocaleString()} ${product.devise || 'FCFA'}\n\n` +
                `${product.description || ''}\n\n` +
                `📦 Service: ${product.serviceTitre}\n\n` +
                `📱 Voir dans l'app: ${deepLink}\n` +
                `🌐 Voir en ligne: ${webLink}`;

            const result = await Share.share({
                message: shareMessage,
                title: `Découvrez: ${product.nom}`,
                url: webLink, // URL pour partage sur réseaux sociaux
            });

            if (result.action === Share.sharedAction) {
                console.log('✅ Produit partagé:', product.nom, 'via', result.activityType || 'partage natif');
            } else if (result.action === Share.dismissedAction) {
                console.log('⚠️ Partage annulé');
            }
        } catch (error) {
            console.error('Erreur partage produit:', error);
            Alert.alert('Erreur', 'Impossible de partager ce produit');
        }
    };

    // Dupliquer un produit
    const handleDuplicateProduct = async (product: Product) => {
        try {
            console.log('[MesProduitsScreen] 📋 Duplication produit:', {
                productId: product.id,
                productName: product.nom,
                serviceId: product.serviceId
            });

            // Charger les données complètes du service
            const serviceResponse = await apiGet(`/api/services/${product.serviceId}`);

            if (!serviceResponse.success || !serviceResponse.data) {
                Alert.alert('Erreur', 'Impossible de charger les données du service');
                return;
            }

            const serviceData = serviceResponse.data;

            // Créer une copie du produit pour la duplication
            const duplicatedProduct = {
                ...product,
                id: undefined, // Le nouveau produit aura un nouvel ID
                nom: `${product.nom} (Copie)`,
                is_active: true,
            };

            // Navigation vers le formulaire avec le produit dupliqué
            navigation.navigate('FormulaireYukpoIntelligent' as never, {
                mode: 'edit',
                serviceId: product.serviceId,
                serviceData: serviceData.data || {},
                suggestion: {
                    data: serviceData.data || {},
                    intention: 'modification_service',
                    confidence: 1.0
                },
                type: 'modification_service',
                editMode: true,
                // ✅ NOUVEAU: Focus sur le bloc produits avec duplication automatique
                focusBlock: 'produits',
                duplicateProduct: duplicatedProduct, // Produit à dupliquer
                fromMesProduits: true
            } as never);
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur duplication:', error);
            Alert.alert('Erreur', 'Impossible de dupliquer le produit');
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

    // ✅ NOUVEAU: Créer un nouveau produit (choisir un service puis ouvrir le formulaire)
    const handleCreateNewProduct = async () => {
        try {
            // Charger tous les services du prestataire
            const servicesResponse = await apiGet('/api/prestataire/services');

            if (!servicesResponse.success || !servicesResponse.data || servicesResponse.data.length === 0) {
                Alert.alert(
                    'Aucun service',
                    'Vous devez d\'abord créer un service avant de pouvoir ajouter des produits.\n\nVoulez-vous créer un service maintenant ?',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Créer un service',
                            onPress: () => navigation.navigate('FormulaireYukpoIntelligent' as never)
                        }
                    ]
                );
                return;
            }

            const services = servicesResponse.data;

            // Si un seul service, l'ouvrir directement
            if (services.length === 1) {
                const service = services[0];
                const serviceData = service.data || {};

                navigation.navigate('FormulaireYukpoIntelligent' as never, {
                    mode: 'edit',
                    serviceId: service.id,
                    serviceData: serviceData,
                    suggestion: {
                        data: serviceData,
                        intention: 'modification_service',
                        confidence: 1.0
                    },
                    type: 'modification_service',
                    editMode: true,
                    focusBlock: 'products', // ✅ Ouvrir directement sur le bloc produits
                    fromMesProduits: true
                } as never);
            } else {
                // Plusieurs services : proposer de choisir
                const serviceOptions = services.map((service: any) => ({
                    text: service.data?.titre_service?.valeur || service.titre || `Service ${service.id}`,
                    onPress: () => {
                        const serviceData = service.data || {};
                        navigation.navigate('FormulaireYukpoIntelligent' as never, {
                            mode: 'edit',
                            serviceId: service.id,
                            serviceData: serviceData,
                            suggestion: {
                                data: serviceData,
                                intention: 'modification_service',
                                confidence: 1.0
                            },
                            type: 'modification_service',
                            editMode: true,
                            focusBlock: 'products', // ✅ Ouvrir directement sur le bloc produits
                            fromMesProduits: true
                        } as never);
                    }
                }));

                Alert.alert(
                    '📦 Choisir un service',
                    'Dans quel service voulez-vous ajouter un nouveau produit ?',
                    [
                        ...serviceOptions.slice(0, 5), // Limiter à 5 services pour éviter un menu trop long
                        { text: 'Annuler', style: 'cancel' }
                    ]
                );
            }
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur création produit:', error);
            Alert.alert('Erreur', 'Impossible de charger vos services');
        }
    };

    // ✅ NOUVEAU 2025-11-06: Éditer les informations générales du service
    const handleEditServiceInfo = async () => {
        try {
            // Charger le premier service du prestataire
            const servicesResponse = await apiGet('/api/prestataire/services');

            if (!servicesResponse.success || !servicesResponse.data || servicesResponse.data.length === 0) {
                Alert.alert(
                    'Aucun service',
                    'Vous n\'avez pas encore de service à éditer.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const service = servicesResponse.data[0]; // Premier service
            const serviceData = service.data || {};

            console.log('[MesProduitsScreen] 📝 Édition service', service.id);

            // Naviguer vers le formulaire en mode edit_service_info
            (navigation as any).navigate('FormulaireYukpoIntelligent', {
                mode: 'edit_service_info', // ✅ NOUVEAU mode
                serviceId: service.id,
                serviceData: serviceData,
                suggestion: {
                    data: serviceData,
                    intention: 'modification_service_info',
                    confidence: 1.0
                },
                type: 'modification_service_info',
                fromMesProduits: true
            });
        } catch (error) {
            console.error('[MesProduitsScreen] Erreur édition service:', error);
            Alert.alert('Erreur', 'Impossible de charger les données du service');
        }
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
                        activeOpacity={0.7}
                    >
                        <SafeIcon name="arrow-left" size={28} color="#FFFFFF" />
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

            {/* ✅ NOUVEAU 2025-11-06: Actions rapides de gestion */}
            <View style={styles.quickActionsContainer}>
                <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={handleEditServiceInfo}
                >
                    <SafeIcon name="settings" size={20} color={modernColors.primary} />
                    <Text style={styles.quickActionText}>Éditer service</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => {
                        // Naviguer vers gestion des membres
                        Alert.alert('👥 Membres', 'Gestion des droits d\'administration bientôt disponible');
                    }}
                >
                    <SafeIcon name="users" size={20} color={modernColors.primary} />
                    <Text style={styles.quickActionText}>Membres</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => {
                        // Naviguer vers création publicité
                        (navigation as any).navigate('CreatePublicite');
                    }}
                >
                    <SafeIcon name="megaphone" size={20} color={modernColors.primary} />
                    <Text style={styles.quickActionText}>Publicité</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.quickActionButton, styles.quickActionButtonPrimary]}
                    onPress={handleCreateNewProduct}
                >
                    <SafeIcon name="plus" size={20} color="#FFFFFF" />
                    <Text style={[styles.quickActionText, { color: '#FFFFFF' }]}>Nouveau</Text>
                </TouchableOpacity>
            </View>

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
                                : 'Ajoutez des produits à vos services'}
                        </Text>
                        <NativeButton
                            title="➕ Créer un nouveau produit"
                            onPress={handleCreateNewProduct}
                            variant="primary"
                            size="medium"
                            style={{ marginTop: 20 }}
                        />
                    </View>
                ) : categoryFilter === 'tous' ? (
                    // ✅ NOUVEAU 2025-11-06: Affichage groupé par catégorie
                    <View style={styles.productsList}>
                        {categories.filter(cat => cat !== 'tous').map((category) => {
                            const categoryProducts = filteredProducts.filter(p => p.type === category);
                            if (categoryProducts.length === 0) return null;
                            
                            return (
                                <View key={category} style={styles.categoryGroup}>
                                    {/* Header de catégorie */}
                                    <View style={styles.categoryHeader}>
                                        <Text style={styles.categoryTitle}>
                                            {getProductTypeLabel(category)}
                                        </Text>
                                        <View style={styles.categoryCountBadge}>
                                            <Text style={styles.categoryCountText}>
                                                {categoryProducts.length}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    {/* Produits de cette catégorie */}
                                    {categoryProducts.map((product) => (
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

                                                {product.description && (
                                                    <Text style={styles.productDescription} numberOfLines={2}>
                                                        {product.description}
                                                    </Text>
                                                )}

                                                {product.prix && (
                                                    <View style={styles.productInfoRow}>
                                                        <SafeIcon name="dollar-sign" size={14} color="#10B981" />
                                                        <Text style={styles.productPrix}>
                                                            {typeof product.prix === 'string' ? product.prix : product.prix.toLocaleString()} {product.devise || 'FCFA'}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Actions produit */}
                                            <View style={styles.productActions}>
                                                <TouchableOpacity
                                                    style={[styles.actionButton, styles.actionButtonPrimary]}
                                                    onPress={() => handleToggleProduct(product)}
                                                >
                                                    <SafeIcon
                                                        name={product.is_active ? 'pause' : 'play'}
                                                        size={16}
                                                        color="#FFFFFF"
                                                    />
                                                    <Text style={styles.actionButtonText}>
                                                        {product.is_active ? 'Pause' : 'Activer'}
                                                    </Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={() => handleShareProduct(product)}
                                                >
                                                    <SafeIcon name="share-2" size={16} color={modernColors.primary} />
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={() => handleDeleteProduct(product)}
                                                >
                                                    <SafeIcon name="trash-2" size={16} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </NativeCard>
                                    ))}
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    // Affichage simple (filtre catégorie unique sélectionnée)
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

                {/* Bouton créer nouveau produit */}
                {filteredProducts.length > 0 && (
                    <View style={styles.footerContainer}>
                        <NativeButton
                            title="➕ Créer un nouveau produit"
                            onPress={handleCreateNewProduct}
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
        paddingHorizontal: 16, // ✅ Réduire légèrement pour mieux positionner les éléments
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4, // ✅ Améliorer le positionnement
    },
    backButton: {
        width: 48, // ✅ Augmenter la taille
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.35)', // ✅ Plus opaque pour meilleure visibilité
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5, // ✅ Ombre Android
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)', // ✅ Bordure subtile
    },
    headerTextContainer: {
        flex: 1,
        marginLeft: 12, // ✅ Réduire l'espacement
        marginRight: 12,
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
        alignItems: 'center',
    },
    statBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)', // ✅ Plus opaque pour meilleure visibilité
        paddingHorizontal: 14, // ✅ Plus de padding
        paddingVertical: 8,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5, // ✅ Ombre Android
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.5)', // ✅ Bordure plus visible
        minWidth: 60, // ✅ Largeur minimale pour éviter la compression
    },
    statNumber: {
        fontSize: 20, // ✅ Taille augmentée
        fontWeight: '800', // ✅ Plus gras
        color: '#FFFFFF',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600', // ✅ Plus gras
        color: '#FFFFFF',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
        marginTop: 1,
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
    // ✅ NOUVEAU 2025-11-06: Actions rapides de gestion
    quickActionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 10,
    },
    quickActionButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 6,
    },
    quickActionButtonPrimary: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    quickActionText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
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
    // ✅ NOUVEAU 2025-11-06: Styles pour regroupement par catégorie
    categoryGroup: {
        marginBottom: 24,
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginBottom: 12,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    categoryCountBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 28,
        alignItems: 'center',
    },
    categoryCountText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
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
