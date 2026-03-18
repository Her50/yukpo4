import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeButton } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ProductReactivationModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    userId: number;
}

const ProductReactivationModal: React.FC<ProductReactivationModalProps> = ({
    visible,
    onClose,
    onSuccess,
    userId
}) => {
    const [loading, setLoading] = useState(false);
    const [inactiveProducts, setInactiveProducts] = useState<any[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [userBalance, setUserBalance] = useState<number>(0);

    // Charger les produits désactivés
    useEffect(() => {
        if (visible) {
            loadInactiveProducts();
            loadUserBalance();
        }
    }, [visible]);

    const loadInactiveProducts = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/products/inactive');

            if (response.success && response.data) {
                setInactiveProducts((response.data as any).products || []);
            }
        } catch (error) {
            console.error('Erreur chargement produits inactifs:', error);
            Alert.alert('Erreur', 'Impossible de charger les produits désactivés');
        } finally {
            setLoading(false);
        }
    };

    const loadUserBalance = async () => {
        try {
            const response = await apiGet('/api/users/balance');
            if (response.success && response.data) {
                setUserBalance((response.data as any).tokens_balance || 0);
            }
        } catch (error) {
            console.error('Erreur chargement solde:', error);
        }
    };

    const toggleProductSelection = (productKey: string) => {
        const newSelection = new Set(selectedProducts);
        if (newSelection.has(productKey)) {
            newSelection.delete(productKey);
        } else {
            newSelection.add(productKey);
        }
        setSelectedProducts(newSelection);
    };

    const selectAll = () => {
        const allKeys = inactiveProducts.map((p, idx) => `${p.service_id}-${p.product_index}`);
        setSelectedProducts(new Set(allKeys));
    };

    const deselectAll = () => {
        setSelectedProducts(new Set());
    };

    const calculateTotalCost = () => {
        return selectedProducts.size * 1000; // 1000 FCFA par produit
    };

    const canAffordReactivation = () => {
        return userBalance >= calculateTotalCost();
    };

    const handleReactivate = async () => {
        if (selectedProducts.size === 0) {
            Alert.alert('Attention', 'Veuillez sélectionner au moins un produit à réactiver');
            return;
        }

        const totalCost = calculateTotalCost();

        if (!canAffordReactivation()) {
            Alert.alert(
                '\uD83D\uDCB8 Solde insuffisant',
                `Coût total : ${totalCost.toLocaleString()} FCFA\nVotre solde : ${userBalance.toLocaleString()} FCFA\n\nVeuillez recharger votre compte.`,
                [{ text: 'OK' }]
            );
            return;
        }

        // Confirmation
        Alert.alert(
            'Confirmer la réactivation',
            `Réactiver ${selectedProducts.size} produit(s) pour ${totalCost.toLocaleString()} FCFA ?\n\nNouveau solde : ${(userBalance - totalCost).toLocaleString()} FCFA`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.confirm'), onPress: performReactivation }
            ]
        );
    };

    const performReactivation = async () => {
        try {
            setLoading(true);

            // Grouper les produits par service_id
            const productsByService = new Map<number, number[]>();
            selectedProducts.forEach(key => {
                const [serviceId, productIndex] = key.split('-').map(Number);
                if (!productsByService.has(serviceId)) {
                    productsByService.set(serviceId, []);
                }
                productsByService.get(serviceId)!.push(productIndex);
            });

            console.log('[ProductReactivation] Produits à réactiver:', productsByService);

            // Réactiver service par service
            const promises = Array.from(productsByService.entries()).map(([serviceId, indices]) => {
                if (indices.length === 1) {
                    // Réactivation simple
                    console.log('[ProductReactivation] Réactivation simple - Service:', serviceId, 'Index:', indices[0]);
                    return apiPost('/api/products/reactivate', {
                        service_id: serviceId,
                        product_index: indices[0]
                    });
                } else {
                    // Réactivation multiple
                    console.log('[ProductReactivation] Réactivation multiple - Service:', serviceId, 'Indices:', indices);
                    return apiPost('/api/products/reactivate-multiple', {
                        service_id: serviceId,
                        product_indices: indices
                    });
                }
            });

            const results = await Promise.all(promises);

            console.log('[ProductReactivation] Résultats:', results);

            // Vérifier les résultats
            const allSuccess = results.every((r: any) => r.success || r.data?.success);

            if (allSuccess) {
                Alert.alert(
                    '✅ Réactivation réussie',
                    `${selectedProducts.size} produit(s) réactivé(s) avec succès !\n\nIls seront actifs pendant 30 jours.`,
                    [{
                        text: 'OK', onPress: () => {
                            setSelectedProducts(new Set());
                            loadInactiveProducts();
                            loadUserBalance();
                            if (onSuccess) onSuccess();
                        }
                    }]
                );
            } else {
                console.error('[ProductReactivation] Erreurs détaillées:', results);
                const errorMessages = results
                    .filter((r: any) => !r.success && !r.data?.success)
                    .map((r: any) => r.error || r.data?.error || 'Erreur inconnue')
                    .join('\n');

                Alert.alert(
                    '❌ Erreur de réactivation',
                    `Certains produits n'ont pas pu être réactivés :\n\n${errorMessages}`
                );
            }
        } catch (error) {
            console.error('[ProductReactivation] Erreur réactivation:', error);
            Alert.alert(
                '❌ Erreur',
                `Erreur lors de la réactivation des produits :\n\n${error.message || error}`
            );
        } finally {
            setLoading(false);
        }
    };

    const getProductTypeIcon = (type: string) => {
        const icons: Record<string, string> = {
            'immobilier_batiment': '\uD83C\uDFE2',
            'immobilier_terrain': '\uD83C\uDFDE️',
            'automobile': '\uD83D\uDE97',
            'vetement': '\uD83D\uDC54',
            'chaussure': '\uD83D\uDC5F',
            'electromenager': '\uD83D\uDCF1',
            'mobilier': '\uD83E\uDE91',
            'aliments': '\uD83C\uDF55',
            'livres_fournitures': '\uD83D\uDCDA',
            'quincaillerie': '\uD83D\uDD27',
            'bien_etre_spa': '\uD83E\uDDD8',
            'prestation_service': '\uD83D\uDCBC',
            'autre': '\uD83D\uDCE6'
        };
        return icons[type] || '\uD83D\uDCE6';
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.header}
                >
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Produits Désactivés</Text>
                        <Text style={styles.headerSubtitle}>
                            Réactivez vos produits pour 1000 FCFA chacun
                        </Text>
                    </View>
                </LinearGradient>

                {/* Solde utilisateur */}
                <View style={styles.balanceCard}>
                    <View style={styles.balanceInfo}>
                        <SafeIcon name="wallet" size={20} color={modernColors.primary} />
                        <Text style={styles.balanceLabel}>Votre solde</Text>
                    </View>
                    <Text style={styles.balanceAmount}>
                        {userBalance.toLocaleString()} FCFA
                    </Text>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement...</Text>
                    </View>
                ) : inactiveProducts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <SafeIcon name="check-circle" size={64} color="#10B981" />
                        <Text style={styles.emptyTitle}>Tous vos produits sont actifs !</Text>
                        <Text style={styles.emptyText}>
                            Aucun produit désactivé pour le moment
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Actions rapides */}
                        <View style={styles.quickActions}>
                            <TouchableOpacity style={styles.quickButton} onPress={selectAll}>
                                <SafeIcon name="check-square" size={18} color={modernColors.primary} />
                                <Text style={styles.quickButtonText}>Tout sélectionner</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickButton} onPress={deselectAll}>
                                <SafeIcon name="square" size={18} color="#6B7280" />
                                <Text style={styles.quickButtonText}>Tout désélectionner</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Liste des produits */}
                        <ScrollView style={styles.productsList}>
                            {inactiveProducts.map((product, index) => {
                                const productKey = `${product.service_id}-${product.product_index}`;
                                const isSelected = selectedProducts.has(productKey);

                                return (
                                    <TouchableOpacity
                                        key={productKey}
                                        style={[styles.productCard, isSelected && styles.productCardSelected]}
                                        onPress={() => toggleProductSelection(productKey)}
                                    >
                                        <View style={styles.productContent}>
                                            {/* Checkbox */}
                                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                                {isSelected && (
                                                    <SafeIcon name="check" size={16} color="#FFFFFF" />
                                                )}
                                            </View>

                                            {/* Icône type */}
                                            <Text style={styles.productIcon}>
                                                {getProductTypeIcon(product.product_type)}
                                            </Text>

                                            {/* Infos produit */}
                                            <View style={styles.productInfo}>
                                                <Text style={styles.productName} numberOfLines={1}>
                                                    {product.product_nom}
                                                </Text>
                                                <View style={styles.productMeta}>
                                                    <SafeIcon name="clock" size={12} color="#EF4444" />
                                                    <Text style={styles.metaText}>
                                                        Désactivé le {new Date(product.auto_deactivate_at).toLocaleDateString('fr-FR')}
                                                    </Text>
                                                </View>
                                                {product.deactivation_count > 1 && (
                                                    <Text style={styles.deactivationCount}>
                                                        Désactivé {product.deactivation_count} fois
                                                    </Text>
                                                )}
                                            </View>

                                            {/* Coût */}
                                            <View style={styles.costBadge}>
                                                <Text style={styles.costText}>1000</Text>
                                                <Text style={styles.costCurrency}>FCFA</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Footer avec total et bouton de réactivation */}
                        <View style={styles.footer}>
                            <View style={styles.totalContainer}>
                                <View>
                                    <Text style={styles.totalLabel}>
                                        {selectedProducts.size} produit(s) sélectionné(s)
                                    </Text>
                                    <Text style={styles.totalAmount}>
                                        Total : {calculateTotalCost().toLocaleString()} FCFA
                                    </Text>
                                </View>
                                {!canAffordReactivation() && selectedProducts.size > 0 && (
                                    <View style={styles.insufficientBadge}>
                                        <SafeIcon name="alert-triangle" size={16} color="#EF4444" />
                                        <Text style={styles.insufficientText}>Solde insuffisant</Text>
                                    </View>
                                )}
                            </View>

                            <NativeButton
                                title={loading ? "Réactivation..." : `Réactiver (${calculateTotalCost().toLocaleString()} FCFA)`}
                                onPress={handleReactivate}
                                variant="primary"
                                size="large"
                                disabled={loading || selectedProducts.size === 0 || !canAffordReactivation()}
                                style={styles.reactivateButton}
                            />
                        </View>
                    </>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    closeButton: {
        alignSelf: 'flex-start',
        padding: 8,
    },
    headerContent: {
        marginTop: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    balanceCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: -20,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    balanceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    balanceAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    quickActions: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    quickButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quickButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: modernColors.text,
    },
    productsList: {
        flex: 1,
        paddingHorizontal: 16,
    },
    productCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    productCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    productContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
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
    checkboxSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    productIcon: {
        fontSize: 28,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    productMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 11,
        color: '#EF4444',
    },
    deactivationCount: {
        fontSize: 10,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    costBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center',
    },
    costText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    costCurrency: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    footer: {
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    totalLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    insufficientBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    insufficientText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
    },
    reactivateButton: {
        marginTop: 8,
    },
});

export default ProductReactivationModal;

