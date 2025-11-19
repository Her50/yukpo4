import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { apiGet, apiPost } from '@/services/apiService';
import { Calendar, Clock, MapPin, Package, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface OrderDeliveryModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceId: number;
    productIndex?: number;
    productName?: string;
    onSuccess?: (deliveryId: string) => void;
    // ✅ NOUVEAU : Pour prix négociés
    conversationId?: number;
    clientUserId?: number;
}

interface Location {
    latitude: number;
    longitude: number;
    address?: string;
}

const OrderDeliveryModal: React.FC<OrderDeliveryModalProps> = ({
    isOpen,
    onClose,
    serviceId,
    productIndex,
    productName,
    onSuccess,
    conversationId, // ✅ NOUVEAU
    clientUserId, // ✅ NOUVEAU
}) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
    const [notes, setNotes] = useState('');
    const [userGPS, setUserGPS] = useState<Location | null>(null);

    // ✅ Phase 3 - Amélioration 7 : Préférences de livraison
    const [preferredDeliveryDate, setPreferredDeliveryDate] = useState<string>('');
    const [preferredDeliveryTimeStart, setPreferredDeliveryTimeStart] = useState<string>('');
    const [preferredDeliveryTimeEnd, setPreferredDeliveryTimeEnd] = useState<string>('');
    const [isFlexible, setIsFlexible] = useState<boolean>(true);
    const [flexibilityWindowDays, setFlexibilityWindowDays] = useState<number>(3);
    const [urgencyLevel, setUrgencyLevel] = useState<'standard' | 'urgent' | 'scheduled'>('standard');

    // ✅ Phase 7 - Amélioration 23 : Coûts de livraison
    const [productPrice, setProductPrice] = useState<number | null>(null);
    const [deliveryCost, setDeliveryCost] = useState<number | null>(null);
    const [isDeliveryFree, setIsDeliveryFree] = useState<boolean>(false);
    const [loadingCosts, setLoadingCosts] = useState(false);

    // ✅ Phase 8 - Amélioration 26 : Sélection multi-produits
    const [selectedProducts, setSelectedProducts] = useState<number[]>(() =>
        productIndex !== undefined ? [productIndex] : []
    );
    const [availableProducts, setAvailableProducts] = useState<Array<{ index: number, name: string, price: number }>>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [showProductSelector, setShowProductSelector] = useState(false);

    // Charger GPS utilisateur au montage et récupérer les coûts
    useEffect(() => {
        if (isOpen) {
            loadUserGPS();
            loadAvailableProducts();
            if (productIndex !== undefined) {
                setSelectedProducts([productIndex]);
            }
        }
    }, [isOpen, serviceId, productIndex]);

    // Recalculer les coûts quand les produits sélectionnés ou dropoff changent
    useEffect(() => {
        if (isOpen && selectedProducts.length > 0 && dropoffLocation) {
            loadCosts();
        }
    }, [isOpen, selectedProducts, dropoffLocation]);

    const loadUserGPS = async () => {
        try {
            const response = await apiGet('/api/user/me');
            if (response.ok) {
                const user = await response.json();
                if (user.gps) {
                    const [lng, lat] = user.gps.split(',').map(parseFloat);
                    setUserGPS({ latitude: lat, longitude: lng });
                    // Auto-remplir dropoff avec GPS utilisateur
                    setDropoffLocation({ latitude: lat, longitude: lng });
                }
            }
        } catch (error) {
            console.error('Erreur chargement GPS utilisateur:', error);
        }
    };

    // ✅ Phase 8 - Amélioration 26 : Charger les produits disponibles du service
    const loadAvailableProducts = async () => {
        if (!serviceId) return;

        setLoadingProducts(true);
        try {
            const response = await apiGet(`/api/services/${serviceId}`);
            if (response.ok) {
                const service = await response.json();
                const products = service.data?.produits?.valeur || service.data?.produits || [];

                // ✅ Fonction helper pour obtenir le prix réel avec promotions
                const getRealPrice = (product: any): number => {
                    // 1. Vérifier promotion produit active
                    if (product.promotionActive) {
                        const now = new Date();
                        const endDate = product.promotionDateFin ? new Date(product.promotionDateFin) : null;

                        if (!endDate || now <= endDate) {
                            const valeur = product.promotionValeur;
                            if (valeur) {
                                const valeurStr = String(valeur).trim();
                                const basePrice = product.price || 0;

                                // Pourcentage
                                if (valeurStr.endsWith('%')) {
                                    const pct = parseFloat(valeurStr.replace('%', ''));
                                    if (!isNaN(pct)) return basePrice * (1 - pct / 100);
                                }
                                // Réduction fixe
                                if (valeurStr.startsWith('-')) {
                                    const reduction = parseFloat(valeurStr.replace('-', '').split(' ')[0]);
                                    if (!isNaN(reduction)) return Math.max(0, basePrice - reduction);
                                }
                                // Prix fixe
                                const fixedPrice = parseFloat(valeurStr.split(' ')[0]);
                                if (!isNaN(fixedPrice) && fixedPrice < basePrice) return fixedPrice;
                            }
                        }
                    }

                    // 2. Vérifier prix réduit/discounted
                    if (product.discounted_price && product.discounted_price < (product.price || 0)) {
                        return product.discounted_price;
                    }

                    // 3. Prix de base
                    return product.price || 0;
                };

                const productList = products
                    .map((p: any, index: number) => {
                        const basePrice = p.price || 0;
                        const realPrice = getRealPrice(p);
                        const hasPromotion = realPrice < basePrice && basePrice > 0;

                        return {
                            index,
                            name: p.nom || p.name || p.title || `Produit ${index + 1}`,
                            price: realPrice,
                            originalPrice: basePrice,
                            hasPromotion,
                            promotionType: p.promotionType,
                            promotionValeur: p.promotionValeur,
                        };
                    })
                    .filter((p: any) => p.name && p.price > 0); // Filtrer les produits valides

                setAvailableProducts(productList);
            }
        } catch (error) {
            console.error('Erreur chargement produits:', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    // ✅ Phase 7 - Amélioration 23 : Charger les coûts estimés (adapté pour multi-produits)
    // ✅ IMPORTANT : Le coût de livraison est indépendant du nombre de produits
    const loadCosts = async () => {
        if (!serviceId || selectedProducts.length === 0 || !dropoffLocation) {
            return;
        }

        setLoadingCosts(true);
        try {
            // ✅ Calculer le prix total de tous les produits sélectionnés (indépendant de la livraison)
            let totalProductPrice = 0;
            selectedProducts.forEach((idx) => {
                const product = availableProducts.find(p => p.index === idx);
                if (product) {
                    totalProductPrice += product.price;
                }
            });
            setProductPrice(totalProductPrice);

            // ✅ Le coût de livraison est calculé UNE SEULE FOIS, indépendamment du nombre de produits
            // On utilise le premier produit uniquement pour obtenir la configuration de livraison (pickup, billing_mode)
            const firstProductIndex = selectedProducts[0];

            const payload = {
                service_id: serviceId,
                product_index: firstProductIndex,
                dropoff: dropoffLocation,
                // ✅ NOUVEAU : Pour prix négociés
                conversation_id: conversationId,
                client_user_id: clientUserId,
            };

            const response = await apiPost('/api/delivery/estimate-costs', payload);
            const data = await response.json();

            // ✅ Le coût de livraison ne change PAS selon le nombre de produits
            // Il est basé uniquement sur la distance pickup -> dropoff
            if (data.delivery_cost_cents !== undefined) {
                setDeliveryCost(data.delivery_cost_cents / 100); // Convertir centimes en FCFA
            }
            if (data.is_delivery_free !== undefined) {
                setIsDeliveryFree(data.is_delivery_free);
            }
        } catch (error) {
            console.error('Erreur chargement coûts:', error);
            // Ne pas bloquer l'utilisateur si les coûts ne peuvent pas être chargés
        } finally {
            setLoadingCosts(false);
        }
    };

    // ✅ Phase 8 - Amélioration 26 : Toggle sélection produit
    const toggleProductSelection = (productIdx: number) => {
        setSelectedProducts(prev => {
            if (prev.includes(productIdx)) {
                // Désélectionner (mais garder au moins un produit)
                if (prev.length > 1) {
                    return prev.filter(idx => idx !== productIdx);
                }
                return prev;
            } else {
                // Sélectionner
                return [...prev, productIdx];
            }
        });
    };

    const handleSubmit = async () => {
        if (!dropoffLocation) {
            toast({
                title: 'Adresse requise',
                description: 'Veuillez fournir une adresse de livraison',
                variant: 'destructive',
            });
            return;
        }

        if (selectedProducts.length === 0) {
            toast({
                title: 'Produit requis',
                description: 'Veuillez sélectionner au moins un produit',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            // ✅ Phase 8 - Amélioration 26 : Si plusieurs produits, utiliser create_shopping_order
            if (selectedProducts.length > 1) {
                // Créer une commande shopping avec plusieurs produits
                const shoppingItems = selectedProducts.map(idx => ({
                    product_index: idx,
                    quantity: 1, // Par défaut 1, peut être étendu plus tard
                }));

                const payload = {
                    service_id: serviceId,
                    items: shoppingItems,
                    dropoff: dropoffLocation,
                    notes: notes || undefined,
                };

                // TODO: Utiliser endpoint create_shopping_order si disponible
                // Pour l'instant, on crée une commande par produit
                // (le backend peut être étendu pour supporter plusieurs produits dans client-order)
                const responses = await Promise.all(
                    selectedProducts.map(idx =>
                        apiPost('/api/delivery/client-order', {
                            service_id: serviceId,
                            product_index: idx,
                            dropoff: dropoffLocation,
                            notes: notes || undefined,
                            // ✅ NOUVEAU : Pour prix négociés
                            conversation_id: conversationId,
                        })
                    )
                );

                const firstResponse = await responses[0].json();

                // Sauvegarder les préférences pour la première livraison
                if (firstResponse.delivery?.id && (preferredDeliveryDate || preferredDeliveryTimeStart)) {
                    try {
                        const preferencesPayload = {
                            delivery_id: firstResponse.delivery.id,
                            preferred_delivery_date: preferredDeliveryDate || undefined,
                            preferred_delivery_time_start: preferredDeliveryTimeStart || undefined,
                            preferred_delivery_time_end: preferredDeliveryTimeEnd || undefined,
                            is_flexible: isFlexible,
                            flexibility_window_days: flexibilityWindowDays,
                            urgency_level: urgencyLevel,
                        };
                        await apiPost('/api/delivery/preferences', preferencesPayload);
                    } catch (prefError) {
                        console.error('Erreur sauvegarde préférences:', prefError);
                    }
                }

                toast({
                    title: 'Commandes créées',
                    description: `${selectedProducts.length} commande(s) créée(s) avec succès. Le matching des coursiers est en cours.`,
                });

                if (firstResponse.delivery?.id && onSuccess) {
                    onSuccess(firstResponse.delivery.id);
                }
            } else {
                // Un seul produit : utiliser le flux normal
                const payload = {
                    service_id: serviceId,
                    product_index: selectedProducts[0],
                    dropoff: dropoffLocation,
                    notes: notes || undefined,
                    // ✅ NOUVEAU : Pour prix négociés
                    conversation_id: conversationId,
                };

                const response = await apiPost('/api/delivery/client-order', payload);
                const data = await response.json();

                // ✅ Phase 3 - Amélioration 7 : Sauvegarder les préférences de livraison si fournies
                if (data.delivery?.id && (preferredDeliveryDate || preferredDeliveryTimeStart)) {
                    try {
                        const preferencesPayload = {
                            delivery_id: data.delivery.id,
                            preferred_delivery_date: preferredDeliveryDate || undefined,
                            preferred_delivery_time_start: preferredDeliveryTimeStart || undefined,
                            preferred_delivery_time_end: preferredDeliveryTimeEnd || undefined,
                            is_flexible: isFlexible,
                            flexibility_window_days: flexibilityWindowDays,
                            urgency_level: urgencyLevel,
                        };
                        await apiPost('/api/delivery/preferences', preferencesPayload);
                    } catch (prefError) {
                        console.error('Erreur sauvegarde préférences:', prefError);
                        // Ne pas bloquer la commande si les préférences échouent
                    }
                }

                toast({
                    title: 'Commande créée',
                    description: 'Votre commande a été créée avec succès. Le matching des coursiers est en cours.',
                });

                if (onSuccess && data.delivery?.id) {
                    onSuccess(data.delivery.id);
                }
            }

            onClose();
        } catch (error: any) {
            console.error('Erreur création commande:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Une erreur est survenue',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUseCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                    setDropoffLocation(location);
                    setUserGPS(location);
                },
                (error) => {
                    console.error('Erreur géolocalisation:', error);
                    toast({
                        title: 'Erreur GPS',
                        description: 'Impossible d\'obtenir votre position',
                        variant: 'destructive',
                    });
                }
            );
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Commander la livraison</h2>
                            {productName && (
                                <p className="text-sm text-gray-500 mt-1">{productName}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* ✅ Phase 8 - Amélioration 26 : Sélection multi-produits */}
                    {availableProducts.length > 1 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-purple-600" />
                                    Produits à commander
                                </label>
                                {!showProductSelector && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowProductSelector(true)}
                                    >
                                        Ajouter d'autres produits
                                    </Button>
                                )}
                            </div>

                            {showProductSelector ? (
                                <div className="space-y-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            Sélectionnez les produits ({selectedProducts.length} sélectionné{selectedProducts.length > 1 ? 's' : ''})
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowProductSelector(false)}
                                        >
                                            Fermer
                                        </Button>
                                    </div>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {availableProducts.map((product) => (
                                            <label
                                                key={product.index}
                                                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProducts.includes(product.index)}
                                                    onChange={() => toggleProductSelection(product.index)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                                        {product.hasPromotion && (
                                                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">
                                                                PROMO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {product.hasPromotion && product.originalPrice && (
                                                            <span className="text-xs text-gray-400 line-through">
                                                                {product.originalPrice.toLocaleString('fr-FR')} FCFA
                                                            </span>
                                                        )}
                                                        <p className={`text-xs ${product.hasPromotion ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>
                                                            {product.price.toLocaleString('fr-FR')} FCFA
                                                        </p>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedProducts.map((idx) => {
                                        const product = availableProducts.find(p => p.index === idx);
                                        return product ? (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                                    <p className="text-xs text-gray-500">{product.price.toLocaleString('fr-FR')} FCFA</p>
                                                </div>
                                                {selectedProducts.length > 1 && (
                                                    <button
                                                        onClick={() => toggleProductSelection(idx)}
                                                        className="text-red-600 hover:text-red-700 text-sm"
                                                    >
                                                        Retirer
                                                    </button>
                                                )}
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Point de départ - Auto-rempli depuis config */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-green-600" />
                            Point de départ
                        </label>
                        {pickupLocation ? (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-gray-700">
                                    {pickupLocation.address || `${pickupLocation.latitude.toFixed(6)}, ${pickupLocation.longitude.toFixed(6)}`}
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-sm text-gray-500 italic">
                                    Adresse de collecte automatique (depuis la configuration du produit)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Point de livraison */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            Adresse de livraison *
                        </label>

                        {dropoffLocation ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-gray-700 mb-2">
                                    {dropoffLocation.address || `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}`}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDropoffLocation(null)}
                                    className="w-full"
                                >
                                    Modifier l'adresse
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Button
                                    variant="outline"
                                    onClick={handleUseCurrentLocation}
                                    className="w-full"
                                >
                                    <MapPin className="w-4 h-4 mr-2" />
                                    Utiliser ma position actuelle
                                </Button>
                                <p className="text-xs text-gray-500 text-center">
                                    Ou sélectionnez une adresse sur la carte
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">
                            Instructions de livraison (optionnel)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ex: Sonner deux fois, laisser devant la porte..."
                            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={3}
                        />
                    </div>

                    {/* ✅ Phase 3 - Amélioration 7 : Préférences de livraison */}
                    <div className="border-t pt-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-purple-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Préférences de livraison (optionnel)</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Date de livraison souhaitée */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Date de livraison
                                </Label>
                                <Input
                                    type="date"
                                    value={preferredDeliveryDate}
                                    onChange={(e) => setPreferredDeliveryDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full"
                                />
                            </div>

                            {/* Niveau d'urgence */}
                            <div className="space-y-2">
                                <Label>Niveau d'urgence</Label>
                                <select
                                    value={urgencyLevel}
                                    onChange={(e) => setUrgencyLevel(e.target.value as 'standard' | 'urgent' | 'scheduled')}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="scheduled">Programmé</option>
                                </select>
                            </div>
                        </div>

                        {/* Heures de livraison */}
                        {preferredDeliveryDate && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Heure de début</Label>
                                    <Input
                                        type="time"
                                        value={preferredDeliveryTimeStart}
                                        onChange={(e) => setPreferredDeliveryTimeStart(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Heure de fin</Label>
                                    <Input
                                        type="time"
                                        value={preferredDeliveryTimeEnd}
                                        onChange={(e) => setPreferredDeliveryTimeEnd(e.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Flexibilité */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isFlexible"
                                    checked={isFlexible}
                                    onChange={(e) => setIsFlexible(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <Label htmlFor="isFlexible" className="cursor-pointer">
                                    Accepter d'autres créneaux si indisponible
                                </Label>
                            </div>

                            {isFlexible && (
                                <div className="ml-6 space-y-2">
                                    <Label>Fenêtre de flexibilité (jours)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="7"
                                        value={flexibilityWindowDays}
                                        onChange={(e) => setFlexibilityWindowDays(parseInt(e.target.value) || 3)}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Rechercher un créneau disponible dans les {flexibilityWindowDays} prochains jours
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ✅ Phase 7 - Amélioration 23 : Affichage coûts (produit + livraison séparés) */}
                    {(productPrice !== null || deliveryCost !== null) && (
                        <div className="border-t pt-6 space-y-3">
                            <h3 className="text-lg font-semibold text-gray-900">Récapitulatif des coûts</h3>
                            <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                                {/* ✅ Phase 8 - Amélioration 26 : Détail par produit si plusieurs */}
                                {selectedProducts.length > 1 ? (
                                    <div className="space-y-2 mb-3">
                                        {selectedProducts.map((idx) => {
                                            const product = availableProducts.find(p => p.index === idx);
                                            return product ? (
                                                <div key={idx} className="flex justify-between items-center text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-700">{product.name}</span>
                                                        {product.hasPromotion && (
                                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">
                                                                PROMO
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {product.hasPromotion && product.originalPrice && (
                                                            <span className="text-xs text-gray-400 line-through">
                                                                {product.originalPrice.toLocaleString('fr-FR')}
                                                            </span>
                                                        )}
                                                        <span className={`font-semibold ${product.hasPromotion ? 'text-green-600' : 'text-gray-900'}`}>
                                                            {product.price.toLocaleString('fr-FR')} FCFA
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })}
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                                            <span className="text-sm font-medium text-gray-700">Sous-total produits</span>
                                            <span className="text-sm font-semibold text-gray-900">{productPrice?.toLocaleString('fr-FR')} FCFA</span>
                                        </div>
                                    </div>
                                ) : (
                                    /* Prix produit(s) - Affichage simple si un seul produit */
                                    productPrice !== null && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-700">Produit(s)</span>
                                            <span className="text-sm font-semibold text-gray-900">{productPrice.toLocaleString('fr-FR')} FCFA</span>
                                        </div>
                                    )
                                )}

                                {/* Coût livraison */}
                                {deliveryCost !== null && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-700 flex items-center gap-2">
                                            Livraison
                                            {isDeliveryFree && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">
                                                    Gratuite
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {isDeliveryFree ? '0' : deliveryCost.toLocaleString('fr-FR')} FCFA
                                        </span>
                                    </div>
                                )}

                                {/* Total */}
                                {(productPrice !== null || deliveryCost !== null) && (
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-300">
                                        <span className="text-base font-semibold text-gray-900">Total</span>
                                        <span className="text-lg font-bold text-blue-600">
                                            {((productPrice || 0) + (isDeliveryFree ? 0 : (deliveryCost || 0))).toLocaleString('fr-FR')} FCFA
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !dropoffLocation}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {loading ? 'Création...' : 'Confirmer la commande'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default OrderDeliveryModal;

