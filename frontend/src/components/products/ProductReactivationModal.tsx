import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertTriangle,
    CheckCircle,
    CheckSquare,
    Clock,
    Square,
    Wallet,
    X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ProductReactivationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const ProductReactivationModal: React.FC<ProductReactivationModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [inactiveProducts, setInactiveProducts] = useState<any[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [userBalance, setUserBalance] = useState<number>(0);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            loadInactiveProducts();
            loadUserBalance();
        }
    }, [isOpen]);

    const loadInactiveProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/products/inactive', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setInactiveProducts(data.products || []);
            }
        } catch (error) {
            console.error('Erreur chargement produits inactifs:', error);
            toast({
                title: "Erreur",
                description: "Impossible de charger les produits désactivés",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const loadUserBalance = async () => {
        try {
            const response = await fetch('/api/users/balance', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUserBalance(data.tokens_balance || 0);
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
        const allKeys = inactiveProducts.map(p => `${p.service_id}-${p.product_index}`);
        setSelectedProducts(new Set(allKeys));
    };

    const deselectAll = () => {
        setSelectedProducts(new Set());
    };

    const calculateTotalCost = () => {
        return selectedProducts.size * 1000;
    };

    const canAffordReactivation = () => {
        return userBalance >= calculateTotalCost();
    };

    const handleReactivate = async () => {
        if (selectedProducts.size === 0) {
            toast({
                title: "Attention",
                description: "Veuillez sélectionner au moins un produit à réactiver",
                type: "warning"
            });
            return;
        }

        const totalCost = calculateTotalCost();

        if (!canAffordReactivation()) {
            toast({
                title: "Solde insuffisant",
                description: `Coût total : ${totalCost.toLocaleString()} FCFA. Votre solde : ${userBalance.toLocaleString()} FCFA`,
                type: "error"
            });
            return;
        }

        // Grouper les produits par service_id
        const productsByService = new Map<number, number[]>();
        selectedProducts.forEach(key => {
            const [serviceId, productIndex] = key.split('-').map(Number);
            if (!productsByService.has(serviceId)) {
                productsByService.set(serviceId, []);
            }
            productsByService.get(serviceId)!.push(productIndex);
        });

        try {
            setLoading(true);

            // Réactiver service par service
            const promises = Array.from(productsByService.entries()).map(([serviceId, indices]) => {
                const endpoint = indices.length === 1
                    ? '/api/products/reactivate'
                    : '/api/products/reactivate-multiple';

                const payload = indices.length === 1
                    ? { service_id: serviceId, product_index: indices[0] }
                    : { service_id: serviceId, product_indices: indices };

                return fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload)
                });
            });

            const results = await Promise.all(promises);
            const allSuccess = await Promise.all(results.map(r => r.ok));

            if (allSuccess.every(s => s)) {
                toast({
                    title: "Réactivation réussie",
                    description: `${selectedProducts.size} produit(s) réactivé(s) avec succès !`,
                    type: "success"
                });

                setSelectedProducts(new Set());
                loadInactiveProducts();
                loadUserBalance();
                if (onSuccess) onSuccess();
            } else {
                toast({
                    title: "Erreur partielle",
                    description: "Certains produits n'ont pas pu être réactivés",
                    type: "error"
                });
            }
        } catch (error) {
            console.error('Erreur réactivation:', error);
            toast({
                title: "Erreur",
                description: "Erreur lors de la réactivation des produits",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const getProductTypeIcon = (type: string) => {
        const icons: Record<string, string> = {
            'immobilier_batiment': '🏢',
            'immobilier_terrain': '🏞️',
            'automobile': '🚗',
            'vetement': '👔',
            'chaussure': '👟',
            'electromenager': '📱',
            'mobilier': '🪑',
            'aliments': '🍕',
            'livres_fournitures': '📚',
            'quincaillerie': '🔧',
            'prestation_service': '💼',
            'autre': '📦'
        };
        return icons[type] || '📦';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <CardTitle className="text-2xl font-bold">Produits Désactivés</CardTitle>
                    <p className="text-sm text-white text-opacity-90 mt-1">
                        Réactivez vos produits pour 1000 FCFA chacun
                    </p>
                </CardHeader>

                <CardContent className="flex-1 overflow-auto p-6">
                    {/* Solde utilisateur */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-blue-600" />
                            <span className="text-sm font-medium text-gray-700">Votre solde</span>
                        </div>
                        <span className="text-xl font-bold text-blue-600">
                            {userBalance.toLocaleString()} FCFA
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            <p className="mt-4 text-gray-600">Chargement...</p>
                        </div>
                    ) : inactiveProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <CheckCircle className="w-16 h-16 text-green-500" />
                            <h3 className="text-xl font-semibold text-gray-900 mt-4">
                                Tous vos produits sont actifs !
                            </h3>
                            <p className="text-gray-600 mt-2">
                                Aucun produit désactivé pour le moment
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Actions rapides */}
                            <div className="flex gap-3 mb-4">
                                <Button
                                    onClick={selectAll}
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Tout sélectionner
                                </Button>
                                <Button
                                    onClick={deselectAll}
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <Square className="w-4 h-4" />
                                    Tout désélectionner
                                </Button>
                            </div>

                            {/* Liste des produits */}
                            <div className="space-y-3">
                                {inactiveProducts.map((product) => {
                                    const productKey = `${product.service_id}-${product.product_index}`;
                                    const isSelected = selectedProducts.has(productKey);

                                    return (
                                        <div
                                            key={productKey}
                                            onClick={() => toggleProductSelection(productKey)}
                                            className={`
                        border-2 rounded-lg p-4 cursor-pointer transition-all
                        ${isSelected
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 bg-white hover:border-blue-300'
                                                }
                      `}
                                        >
                                            <div className="flex items-center gap-4">
                                                {/* Checkbox */}
                                                <div className={`
                          w-6 h-6 rounded border-2 flex items-center justify-center transition-all
                          ${isSelected
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'border-gray-300'
                                                    }
                        `}>
                                                    {isSelected && (
                                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>

                                                {/* Icône type */}
                                                <span className="text-3xl">{getProductTypeIcon(product.product_type)}</span>

                                                {/* Infos produit */}
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900">{product.product_nom}</h4>
                                                    <div className="flex items-center gap-2 mt-1 text-sm text-red-600">
                                                        <Clock className="w-4 h-4" />
                                                        <span>
                                                            Désactivé le {new Date(product.auto_deactivate_at).toLocaleDateString('fr-FR')}
                                                        </span>
                                                    </div>
                                                    {product.deactivation_count > 1 && (
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Désactivé {product.deactivation_count} fois
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Coût */}
                                                <Badge className="bg-blue-600 text-white px-3 py-1">
                                                    1000 FCFA
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>

                {/* Footer */}
                {inactiveProducts.length > 0 && (
                    <div className="border-t p-6 bg-gray-50">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-gray-600">
                                    {selectedProducts.size} produit(s) sélectionné(s)
                                </p>
                                <p className="text-xl font-bold text-gray-900">
                                    Total : {calculateTotalCost().toLocaleString()} FCFA
                                </p>
                            </div>
                            {!canAffordReactivation() && selectedProducts.size > 0 && (
                                <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span className="text-sm font-semibold">Solde insuffisant</span>
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={handleReactivate}
                            disabled={loading || selectedProducts.size === 0 || !canAffordReactivation()}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? "Réactivation en cours..." : `Réactiver pour ${calculateTotalCost().toLocaleString()} FCFA`}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ProductReactivationModal;

