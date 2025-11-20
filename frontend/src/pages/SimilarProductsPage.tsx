/**
 * SimilarProductsPage - Page pour afficher les produits similaires
 * Utilisée quand un produit n'est pas disponible ou a été rejeté
 */

import AppLayout from '@/components/layout/AppLayout';
import { ProductCard } from '@/components/products/ProductCard';
import { Button } from '@/components/ui/buttons/Button';
import { apiService } from '@/services/apiService';
import { ArrowLeft, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface SimilarProduct {
    service_id: number;
    product_index: number;
    product_id: string;
    product_name?: string;
    product_description?: string;
    category?: string;
    price?: string;
    pickup_address?: string;
    is_immediately_available?: boolean;
    preparation_time_minutes?: number;
    availability_days?: number[];
    similarity_score: number;
}

const SimilarProductsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');
    const serviceId = searchParams.get('serviceId');
    const productIndex = searchParams.get('productIndex');

    const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [productsData, setProductsData] = useState<any[]>([]);

    useEffect(() => {
        const loadSimilarProducts = async () => {
            try {
                setLoading(true);
                setError(null);

                let products: SimilarProduct[] = [];

                if (orderId) {
                    // Récupérer depuis orderId
                    const response = await apiService(`/api/delivery/orders/${orderId}/similar`, {
                        method: 'GET',
                    });
                    if (response.ok) {
                        const data = await response.json();
                        products = data.similar_products || [];
                    }
                } else if (serviceId && productIndex) {
                    // Récupérer depuis serviceId et productIndex
                    const response = await apiService(
                        `/api/delivery/products/${serviceId}/${productIndex}/similar`,
                        { method: 'GET' }
                    );
                    if (response.ok) {
                        const data = await response.json();
                        products = data.similar_products || [];
                    }
                }

                setSimilarProducts(products);

                // Charger les données complètes des produits
                if (products.length > 0) {
                    const productsPromises = products.map(async (product) => {
                        try {
                            const serviceResponse = await apiService(`/api/services/${product.service_id}`, {
                                method: 'GET',
                            });
                            if (serviceResponse.ok) {
                                const serviceData = await serviceResponse.json();
                                return {
                                    ...product,
                                    service: serviceData,
                                    product: serviceData.data?.produits?.[product.product_index] || {},
                                };
                            }
                        } catch (err) {
                            console.error(`Erreur chargement service ${product.service_id}:`, err);
                        }
                        return null;
                    });

                    const loadedProducts = await Promise.all(productsPromises);
                    setProductsData(loadedProducts.filter((p) => p !== null));
                }
            } catch (err: any) {
                console.error('[SimilarProductsPage] Erreur:', err);
                setError(err.message || 'Erreur lors du chargement des produits similaires');
            } finally {
                setLoading(false);
            }
        };

        loadSimilarProducts();
    }, [orderId, serviceId, productIndex]);

    return (
        <AppLayout>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(-1)}
                        className="mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour
                    </Button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Produits similaires disponibles
                    </h1>
                    <p className="text-gray-600">
                        Voici des alternatives qui pourraient vous intéresser
                    </p>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Chargement des produits similaires...</p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {/* Products Grid */}
                {!loading && !error && (
                    <>
                        {productsData.length === 0 ? (
                            <div className="text-center py-12">
                                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 text-lg">
                                    Aucun produit similaire trouvé
                                </p>
                                <Button
                                    onClick={() => navigate('/recherche')}
                                    className="mt-4"
                                >
                                    Faire une nouvelle recherche
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {productsData.map((item, index) => (
                                    <ProductCard
                                        key={`${item.service_id}_${item.product_index}_${index}`}
                                        product={item.product}
                                        service={item.service}
                                        prestataire={item.service?.user}
                                        onChatPress={() => {
                                            navigate(`/chat?serviceId=${item.service_id}`);
                                        }}
                                        onCallPress={() => {
                                            navigate(`/call?serviceId=${item.service_id}`);
                                        }}
                                        onGalleryPress={() => {
                                            navigate(`/service/${item.service_id}`);
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
};

export default SimilarProductsPage;

