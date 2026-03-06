/**
 * Page de gestion des produits
 * Affiche tous les produits de l'utilisateur avec options de management
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/hooks/useUser';
import { ROUTES } from '@/routes/AppRoutesRegistry';
import { productsService } from '@/services/productsService';
import {
    Edit2,
    Eye,
    Filter,
    Plus,
    RefreshCw,
    Share2,
    Tag,
    ToggleLeft,
    ToggleRight,
    Trash2
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Product {
    id: string;
    serviceId: number;
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

const MesProduits: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');

    useEffect(() => {
        if (user?.id) {
            loadProducts();
        }
    }, [user?.id]);

    const loadProducts = async () => {
        if (!user?.id) {
            console.warn('[MesProduits] ⚠️ Utilisateur non connecté');
            setProducts([]);
            return;
        }

        try {
            setLoading(true);

            // ✅ PHASE 5: Charger les produits depuis l'API (plus de fallback JSONB)
            const allProducts: Product[] = [];

            // Utiliser l'endpoint API pour récupérer tous les produits de l'utilisateur
            const products = await productsService.getProductsByUser(user.id);

            products.forEach((product) => {
                allProducts.push({
                    ...product.product_data,
                    id: `${product.service_id}_${product.product_index}`,
                    serviceId: product.service_id,
                    productIndex: product.product_index,
                    isActive: product.is_active,
                    createdAt: product.created_at
                });
            });

            console.log('[MesProduits] ✅ Produits chargés depuis API:', allProducts.length);

            // Trier par date
            allProducts.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setProducts(allProducts);
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Impossible de charger vos produits');
        } finally {
            setLoading(false);
        }
    };

    const getTypeInfo = (type: string) => {
        const types: Record<string, { icon: string; label: string; color: string }> = {
            immobilier_batiment: { icon: '🏢', label: 'Bâtiment', color: 'bg-blue-100 text-blue-700' },
            immobilier_terrain: { icon: '🏞️', label: 'Terrain', color: 'bg-green-100 text-green-700' },
            automobile: { icon: '🚗', label: 'Auto', color: 'bg-amber-100 text-amber-700' },
            ticket_voyage: { icon: '🚌', label: 'Voyage', color: 'bg-purple-100 text-purple-700' },
            covoiturage: { icon: '🚕', label: 'Covoiturage', color: 'bg-pink-100 text-pink-700' },
            vetement: { icon: '👔', label: 'Vêtement', color: 'bg-red-100 text-red-700' },
            chaussure: { icon: '👟', label: 'Chaussure', color: 'bg-orange-100 text-orange-700' },
            electromenager: { icon: '📱', label: 'Électro', color: 'bg-cyan-100 text-cyan-700' },
            mobilier: { icon: '🪑', label: 'Mobilier', color: 'bg-lime-100 text-lime-700' },
            aliments: { icon: '🍕', label: 'Aliment', color: 'bg-yellow-100 text-yellow-700' },
            livres_fournitures: { icon: '📚', label: 'Livre', color: 'bg-indigo-100 text-indigo-700' },
            quincaillerie: { icon: '🔧', label: 'Quincaillerie', color: 'bg-slate-100 text-slate-700' },
            pharmacie: { icon: '💊', label: 'Pharmacie', color: 'bg-emerald-100 text-emerald-700' },
            hopital_clinique: { icon: '🏥', label: 'Hôpital', color: 'bg-red-100 text-red-700' },
            prestation_service: { icon: '💼', label: 'Service', color: 'bg-violet-100 text-violet-700' },
            autre: { icon: '📦', label: 'Produit', color: 'bg-gray-100 text-gray-700' }
        };
        return types[type] || types.autre;
    };

    const handleView = (product: Product) => {
        navigate('/formulaire-yukpo-intelligent', {
            state: {
                mode: 'view',
                serviceId: product.serviceId,
                focusProductIndex: product.productIndex
            }
        });
    };

    const handleEdit = (product: Product) => {
        navigate('/formulaire-yukpo-intelligent', {
            state: {
                mode: 'edit',
                serviceId: product.serviceId,
                focusProductIndex: product.productIndex
            }
        });
    };

    const handleDelete = async (product: Product) => {
        if (!confirm(`Supprimer "${product.nom}" ?`)) return;

        try {
            // ✅ PHASE 4: Utiliser l'endpoint API service_products au lieu de JSONB
            const response = await fetch(`/api/services/${product.serviceId}/products/${product.productIndex}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Échec suppression');
            }

            toast.success('Produit supprimé');
            loadProducts();
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Impossible de supprimer le produit');
        }
    };

    const handleToggleActivation = async (product: Product) => {
        try {
            const endpoint = product.isActive
                ? `/api/products/${product.serviceId}/${product.productIndex}/deactivate`
                : `/api/products/${product.serviceId}/${product.productIndex}/activate`;

            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Échec');

            toast.success(product.isActive ? 'Produit désactivé' : 'Produit activé');
            loadProducts();
        } catch (error) {
            console.error('Erreur:', error);
            toast.error('Impossible de modifier le statut');
        }
    };

    const handleShare = async (product: Product) => {
        const message = `🔥 Découvrez mon produit !\n\n${getTypeInfo(product.type).icon} ${product.nom}\n\n${product.description || ''}\n\n💰 Prix: ${product.prix} ${product.devise}\n\n📱 Yukpo - Votre marketplace locale`;

        if (navigator.share) {
            try {
                await navigator.share({ title: product.nom, text: message });
            } catch (error) {
                console.log('Partage annulé');
            }
        } else {
            await navigator.clipboard.writeText(message);
            toast.success('Lien copié dans le presse-papier');
        }
    };

    const filteredProducts = products.filter(product => {
        if (filter === 'actif') return product.isActive;
        if (filter === 'inactif') return !product.isActive;
        return true;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Chargement de vos produits...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                📦 Mes Produits
                            </h1>
                            <p className="mt-2 text-blue-100">
                                {products.length} produit{products.length > 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => navigate(ROUTES.MES_SERVICES)}
                                variant="outline"
                                className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                            >
                                🧰 Mes Services
                            </Button>
                            <Button
                                onClick={() => navigate('/formulaire-yukpo-intelligent')}
                                className="bg-white text-blue-600 hover:bg-blue-50"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Nouveau produit
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtres */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <div className="flex gap-2">
                            {['tous', 'actif', 'inactif'].map((f) => (
                                <Button
                                    key={f}
                                    onClick={() => setFilter(f as any)}
                                    variant={filter === f ? 'default' : 'outline'}
                                    size="sm"
                                >
                                    {f === 'tous' ? '📋 Tous' : f === 'actif' ? '✅ Actifs' : '❌ Inactifs'}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Liste */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {filteredProducts.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <div className="text-6xl mb-4">📦</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Aucun produit
                            </h3>
                            <p className="text-gray-600 text-center mb-6 max-w-md">
                                {filter === 'actif' ? 'Vous n\'avez pas de produits actifs' :
                                    filter === 'inactif' ? 'Vous n\'avez pas de produits inactifs' :
                                        'Créez votre premier produit pour commencer'}
                            </p>
                            <Button onClick={() => navigate('/formulaire-yukpo-intelligent')}>
                                <Plus className="w-5 h-5 mr-2" />
                                Créer un produit
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProducts.map((product) => {
                            const typeInfo = getTypeInfo(product.type);
                            return (
                                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                    {/* Image */}
                                    {product.images && product.images.length > 0 && (
                                        <img
                                            src={product.images[0]}
                                            alt={product.nom}
                                            className="w-full h-48 object-cover"
                                        />
                                    )}

                                    <CardContent className="p-4">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <Badge className={typeInfo.color}>
                                                {typeInfo.icon} {typeInfo.label}
                                            </Badge>
                                            <Badge variant={product.isActive ? 'default' : 'secondary'}>
                                                {product.isActive ? 'Actif' : 'Inactif'}
                                            </Badge>
                                        </div>

                                        {/* Nom */}
                                        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                                            {product.nom}
                                        </h3>

                                        {/* Description */}
                                        {product.description && (
                                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                                {product.description}
                                            </p>
                                        )}

                                        {/* Prix */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-sm text-gray-500">💰 Prix:</span>
                                            <span className="text-lg font-bold text-blue-600">
                                                {product.prix} {product.devise}
                                            </span>
                                        </div>

                                        {/* Promotion */}
                                        {product.promotionActive && (
                                            <div className="flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-semibold mb-3 w-fit">
                                                <Tag className="w-3 h-3" />
                                                🎁 {product.promotionValeur}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleView(product)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                Voir
                                            </Button>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEdit(product)}
                                            >
                                                <Edit2 className="w-4 h-4 mr-1" />
                                                Modifier
                                            </Button>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleShare(product)}
                                            >
                                                <Share2 className="w-4 h-4 mr-1" />
                                                Partager
                                            </Button>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleActivation(product)}
                                            >
                                                {product.isActive ? (
                                                    <ToggleRight className="w-4 h-4 mr-1" />
                                                ) : (
                                                    <ToggleLeft className="w-4 h-4 mr-1" />
                                                )}
                                                {product.isActive ? 'Désactiver' : 'Activer'}
                                            </Button>

                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(product)}
                                                className="col-span-2"
                                            >
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                Supprimer
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MesProduits;

