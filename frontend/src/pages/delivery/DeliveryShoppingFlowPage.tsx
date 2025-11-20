import AppLayout from '@/components/layout/AppLayout';
import AdvancedGPSModal from '@/components/ui/AdvancedGPSModal';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDeliveryRequest, listSupermarkets, type CreateDeliveryRequestPayload } from '@/services/deliveryApi';
import { MapPin, Package, Plus, Search, ShoppingBag, Store, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

interface Supermarket {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distance_km?: number;
}

interface BasketItem {
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    estimatedPrice?: number;
}

const DeliveryShoppingFlowPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);

    // État supermarché
    const [selectedSupermarket, setSelectedSupermarket] = useState<Supermarket | null>(null);
    const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
    const [loadingSupermarkets, setLoadingSupermarkets] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'distance' | 'name'>('distance');

    // État panier
    const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('1');
    const [newItemUnit, setNewItemUnit] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [showAddItem, setShowAddItem] = useState(false);

    // État locations
    const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
    const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
    const [showDropoffGPS, setShowDropoffGPS] = useState(false);

    // Notes
    const [notes, setNotes] = useState('');

    // Calculer la distance entre pickup et dropoff
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Rayon de la Terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Calculer la distance quand les deux points sont disponibles
    useEffect(() => {
        if (pickupLocation && dropoffLocation) {
            const distance = calculateDistance(
                pickupLocation.latitude,
                pickupLocation.longitude,
                dropoffLocation.latitude,
                dropoffLocation.longitude
            );
            setEstimatedDistance(distance);
        } else {
            setEstimatedDistance(null);
        }
    }, [pickupLocation, dropoffLocation]);

    // Charger supermarchés au montage
    useEffect(() => {
        loadSupermarkets();
    }, []);

    // Mettre à jour pickupLocation quand supermarché sélectionné
    useEffect(() => {
        if (selectedSupermarket) {
            setPickupLocation({
                latitude: selectedSupermarket.latitude,
                longitude: selectedSupermarket.longitude,
                address: selectedSupermarket.address,
            });
        }
    }, [selectedSupermarket]);

    // Filtrer et trier les supermarchés
    const filteredAndSortedSupermarkets = useMemo(() => {
        let filtered = supermarkets;

        // Filtrer par recherche
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (sm) =>
                    sm.name.toLowerCase().includes(query) ||
                    sm.address.toLowerCase().includes(query)
            );
        }

        // Trier
        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'distance') {
                const distA = a.distance_km ?? Infinity;
                const distB = b.distance_km ?? Infinity;
                return distA - distB;
            } else {
                return a.name.localeCompare(b.name);
            }
        });

        return sorted;
    }, [supermarkets, searchQuery, sortBy]);

    const loadSupermarkets = async () => {
        setLoadingSupermarkets(true);
        try {
            // Obtenir la position de l'utilisateur pour chercher les supermarchés à proximité
            let userLat = 4.0511; // Douala par défaut
            let userLng = 9.7679;

            if (navigator.geolocation) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    userLat = position.coords.latitude;
                    userLng = position.coords.longitude;
                } catch (error) {
                    console.warn('Géolocalisation non disponible, utilisation des coordonnées par défaut');
                }
            }

            // Appeler l'API pour récupérer les supermarchés
            const result = await listSupermarkets(userLat, userLng, 10);

            if (result.supermarkets.length > 0) {
                setSupermarkets(result.supermarkets);
            } else {
                // Fallback : liste mockée si aucun supermarché trouvé
                const mockSupermarkets: Supermarket[] = [
                    {
                        id: '1',
                        name: 'Carrefour Market',
                        address: '123 Avenue de la République, Douala',
                        latitude: 4.0511,
                        longitude: 9.7679,
                        distance_km: 2.5,
                    },
                    {
                        id: '2',
                        name: 'Super U',
                        address: '456 Boulevard de la Liberté, Douala',
                        latitude: 4.0522,
                        longitude: 9.7680,
                        distance_km: 3.2,
                    },
                    {
                        id: '3',
                        name: 'Casino',
                        address: '789 Rue du Commerce, Douala',
                        latitude: 4.0533,
                        longitude: 9.7681,
                        distance_km: 4.1,
                    },
                ];
                setSupermarkets(mockSupermarkets);
                toast('Aucun supermarché trouvé à proximité. Liste d\'exemple affichée.', { icon: 'ℹ️' });
            }
        } catch (error) {
            console.error('Erreur chargement supermarchés:', error);
            toast.error('Impossible de charger la liste des supermarchés');
            // Fallback : liste mockée en cas d'erreur
            const mockSupermarkets: Supermarket[] = [
                {
                    id: '1',
                    name: 'Carrefour Market',
                    address: '123 Avenue de la République, Douala',
                    latitude: 4.0511,
                    longitude: 9.7679,
                    distance_km: 2.5,
                },
            ];
            setSupermarkets(mockSupermarkets);
        } finally {
            setLoadingSupermarkets(false);
        }
    };

    const handleGPSSelect = (
        path: { lat: number; lng: number }[],
        previewUrl: string,
        metadata: any,
    ) => {
        if (!path || path.length === 0) return;

        const firstPoint = path[0];
        const coords: LocationData = {
            latitude: firstPoint.lat,
            longitude: firstPoint.lng,
            address: metadata?.address || metadata?.formatted_address || undefined,
        };

        setDropoffLocation(coords);
        setErrors(prev => ({ ...prev, dropoff: '' }));
        setShowDropoffGPS(false);
    };

    const addBasketItem = () => {
        const newErrors: Record<string, string> = {};

        if (!newItemName.trim()) {
            newErrors.itemName = 'Le nom du produit est requis';
        }

        if (newItemQuantity && (parseInt(newItemQuantity) <= 0 || isNaN(parseInt(newItemQuantity)))) {
            newErrors.itemQuantity = 'La quantité doit être supérieure à 0';
        }

        if (newItemPrice && (parseFloat(newItemPrice) < 0 || isNaN(parseFloat(newItemPrice)))) {
            newErrors.itemPrice = 'Le prix ne peut pas être négatif';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(prev => ({ ...prev, ...newErrors }));
            return;
        }

        const item: BasketItem = {
            id: Date.now().toString(),
            name: newItemName.trim(),
            quantity: parseInt(newItemQuantity) || 1,
            unit: newItemUnit.trim() || undefined,
            estimatedPrice: newItemPrice ? parseFloat(newItemPrice) : undefined,
        };

        setBasketItems([...basketItems, item]);
        setNewItemName('');
        setNewItemQuantity('1');
        setNewItemUnit('');
        setNewItemPrice('');
        setShowAddItem(false);
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.itemName;
            delete newErrors.itemQuantity;
            delete newErrors.itemPrice;
            return newErrors;
        });
    };

    const removeBasketItem = (id: string) => {
        setBasketItems(basketItems.filter((item) => item.id !== id));
    };

    const calculateBasketTotal = () => {
        return basketItems.reduce((total, item) => {
            return total + (item.estimatedPrice || 0) * item.quantity;
        }, 0);
    };

    const handleSubmit = async () => {
        // Validation complète
        const newErrors: Record<string, string> = {};

        if (!selectedSupermarket) {
            newErrors.supermarket = 'Veuillez sélectionner un supermarché';
        }

        if (basketItems.length === 0) {
            newErrors.basket = 'Veuillez ajouter au moins un article au panier';
        }

        if (!dropoffLocation) {
            newErrors.dropoff = 'Veuillez sélectionner une adresse de livraison';
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            toast.error('Veuillez corriger les erreurs avant de continuer.');
            return;
        }

        setLoading(true);
        try {
            const basketTotal = calculateBasketTotal();

            // Construire le payload
            const payload: CreateDeliveryRequestPayload = {
                parcel: {
                    type_id: 1, // Type shopping
                    notes: notes || `Courses supermarché: ${selectedSupermarket!.name}`,
                    // ✅ CORRIGÉ : photos et constraints doivent être présents (même vides)
                    photos: [],
                    constraints: {},
                },
                pickup: {
                    latitude: pickupLocation!.latitude,
                    longitude: pickupLocation!.longitude,
                    address: pickupLocation!.address || selectedSupermarket!.address,
                },
                dropoff: {
                    latitude: dropoffLocation.latitude,
                    longitude: dropoffLocation.longitude,
                    address: dropoffLocation.address,
                },
                metadata: {
                    kind: 'shopping',
                    supermarket_id: selectedSupermarket!.id,
                    supermarket_name: selectedSupermarket!.name,
                    basket_items: basketItems.map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        estimated_price: item.estimatedPrice,
                    })),
                    basket_total: basketTotal,
                },
                // ✅ CORRIGÉ : Ajouter initial_event_payload par défaut
                initial_event_payload: {},
            };

            const result = await createDeliveryRequest(payload);

            if (result.id) {
                toast.success('Commande créée avec succès !');
                navigate(`/delivery/${result.id}/tracking`);
            } else {
                toast.error('Impossible de créer la commande');
            }
        } catch (error: any) {
            console.error('Erreur création commande:', error);
            toast.error(error.message || 'Une erreur est survenue lors de la création de la commande');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Courses supermarché</h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Composez votre panier et suivez votre coursier en direct
                    </p>
                </div>

                {/* Sélection supermarché */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-success" />
                            <h2 className="text-lg font-semibold text-slate-900">Sélectionner un supermarché *</h2>
                        </div>
                        {supermarkets.length > 0 && (
                            <div className="text-sm text-slate-500">
                                {filteredAndSortedSupermarkets.length} résultat(s)
                            </div>
                        )}
                    </div>

                    {/* Filtres et recherche */}
                    {supermarkets.length > 0 && (
                        <div className="mb-4 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Rechercher un supermarché..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant={sortBy === 'distance' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSortBy('distance')}
                                >
                                    Par distance
                                </Button>
                                <Button
                                    variant={sortBy === 'name' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSortBy('name')}
                                >
                                    Par nom
                                </Button>
                            </div>
                        </div>
                    )}
                    {selectedSupermarket ? (
                        <div className={`rounded-lg border p-4 ${errors.supermarket ? 'border-red-500' : 'border-slate-200 bg-slate-50'}`}>
                            <h3 className="font-semibold text-slate-900">{selectedSupermarket.name}</h3>
                            <p className="text-sm text-slate-600">{selectedSupermarket.address}</p>
                            {selectedSupermarket.distance_km && (
                                <p className="mt-1 text-xs text-slate-500">
                                    À {selectedSupermarket.distance_km.toFixed(1)} km
                                </p>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedSupermarket(null);
                                    setPickupLocation(null);
                                    setErrors(prev => ({ ...prev, supermarket: '' }));
                                }}
                                className="mt-2"
                            >
                                Changer
                            </Button>
                        </div>
                    ) : (
                        <div>
                            {loadingSupermarkets ? (
                                <div className="py-8 text-center text-slate-500">
                                    Chargement des supermarchés...
                                </div>
                            ) : filteredAndSortedSupermarkets.length === 0 ? (
                                <div className="py-8 text-center text-slate-500">
                                    {searchQuery ? 'Aucun supermarché trouvé pour votre recherche' : 'Aucun supermarché disponible'}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredAndSortedSupermarkets.map((supermarket) => (
                                        <button
                                            key={supermarket.id}
                                            type="button"
                                            onClick={() => setSelectedSupermarket(supermarket)}
                                            className="w-full rounded-lg border border-slate-200 p-4 text-left transition-all hover:border-primary hover:bg-slate-50"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-slate-900">{supermarket.name}</h3>
                                                    <p className="text-sm text-slate-600">{supermarket.address}</p>
                                                    {supermarket.distance_km && (
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            À {supermarket.distance_km.toFixed(1)} km
                                                        </p>
                                                    )}
                                                </div>
                                                <Package className="h-5 w-5 text-slate-400" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {errors.supermarket && (
                        <p className="mt-2 text-sm text-red-600">{errors.supermarket}</p>
                    )}
                </section>

                {/* Panier */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold text-slate-900">Panier *</h2>
                        </div>
                        {!showAddItem && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAddItem(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter
                            </Button>
                        )}
                    </div>

                    {showAddItem && (
                        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="newItemName">Nom du produit *</Label>
                                    <Input
                                        id="newItemName"
                                        placeholder="Ex: Riz, Tomates, Pain..."
                                        value={newItemName}
                                        onChange={(e) => {
                                            setNewItemName(e.target.value);
                                            setErrors(prev => ({ ...prev, itemName: e.target.value.trim() ? '' : 'Le nom est requis' }));
                                        }}
                                        className={errors.itemName ? 'border-red-500' : ''}
                                    />
                                    {errors.itemName && (
                                        <p className="text-sm text-red-600">{errors.itemName}</p>
                                    )}
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="newItemQuantity">Quantité</Label>
                                        <Input
                                            id="newItemQuantity"
                                            type="number"
                                            placeholder="1"
                                            value={newItemQuantity}
                                            onChange={(e) => {
                                                setNewItemQuantity(e.target.value);
                                                if (e.target.value && (parseInt(e.target.value) <= 0 || isNaN(parseInt(e.target.value)))) {
                                                    setErrors(prev => ({ ...prev, itemQuantity: 'Quantité invalide' }));
                                                } else {
                                                    setErrors(prev => ({ ...prev, itemQuantity: '' }));
                                                }
                                            }}
                                            className={errors.itemQuantity ? 'border-red-500' : ''}
                                        />
                                        {errors.itemQuantity && (
                                            <p className="text-sm text-red-600">{errors.itemQuantity}</p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="newItemUnit">Unité (kg, L, etc.)</Label>
                                        <Input
                                            id="newItemUnit"
                                            placeholder="kg, L, unité..."
                                            value={newItemUnit}
                                            onChange={(e) => setNewItemUnit(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="newItemPrice">Prix estimé (FCFA)</Label>
                                    <Input
                                        id="newItemPrice"
                                        type="number"
                                        placeholder="Ex: 5000"
                                        value={newItemPrice}
                                        onChange={(e) => {
                                            setNewItemPrice(e.target.value);
                                            if (e.target.value && (parseFloat(e.target.value) < 0 || isNaN(parseFloat(e.target.value)))) {
                                                setErrors(prev => ({ ...prev, itemPrice: 'Prix invalide' }));
                                            } else {
                                                setErrors(prev => ({ ...prev, itemPrice: '' }));
                                            }
                                        }}
                                        className={errors.itemPrice ? 'border-red-500' : ''}
                                    />
                                    {errors.itemPrice && (
                                        <p className="text-sm text-red-600">{errors.itemPrice}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setShowAddItem(false);
                                            setNewItemName('');
                                            setNewItemQuantity('1');
                                            setNewItemUnit('');
                                            setNewItemPrice('');
                                        }}
                                    >
                                        Annuler
                                    </Button>
                                    <Button onClick={addBasketItem}>
                                        Ajouter
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {errors.basket && (
                        <p className="mb-4 text-sm text-red-600">{errors.basket}</p>
                    )}

                    {basketItems.length === 0 ? (
                        <div className="py-12 text-center">
                            <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" />
                            <p className="mt-4 text-sm text-slate-500">
                                Votre panier est vide. Ajoutez des articles pour continuer.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {basketItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
                                >
                                    <div className="flex-1">
                                        <h3 className="font-medium text-slate-900">{item.name}</h3>
                                        <p className="text-sm text-slate-600">
                                            {item.quantity} {item.unit || 'unité(s)'}
                                            {item.estimatedPrice && ` • ${item.estimatedPrice.toLocaleString('fr-FR')} FCFA`}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeBasketItem(item.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                </div>
                            ))}
                            <div className="mt-4 flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-4">
                                <span className="font-semibold text-slate-900">Total estimé</span>
                                <span className="text-lg font-bold text-primary">
                                    {calculateBasketTotal().toLocaleString('fr-FR')} FCFA
                                </span>
                            </div>
                        </div>
                    )}
                </section>

                {/* Point de collecte (automatique depuis supermarché) */}
                {pickupLocation && (
                    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-success" />
                            <h2 className="text-lg font-semibold text-slate-900">Point de collecte</h2>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm text-slate-700">
                                {pickupLocation.address || selectedSupermarket?.address}
                            </p>
                        </div>
                    </section>
                )}

                {/* Point de livraison */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-slate-900">Point de livraison *</h2>
                    </div>
                    {dropoffLocation ? (
                        <div className={`rounded-lg border p-4 ${errors.dropoff ? 'border-red-500' : 'border-slate-200 bg-slate-50'}`}>
                            <p className="text-sm text-slate-700">
                                {dropoffLocation.address ||
                                    `${dropoffLocation.latitude.toFixed(6)}, ${dropoffLocation.longitude.toFixed(6)}`}
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setDropoffLocation(null);
                                    setErrors(prev => ({ ...prev, dropoff: '' }));
                                }}
                                className="mt-2"
                            >
                                Modifier
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => setShowDropoffGPS(true)}
                            className="w-full"
                        >
                            <MapPin className="mr-2 h-4 w-4" />
                            Sélectionner le point de livraison
                        </Button>
                    )}
                    {errors.dropoff && (
                        <p className="mt-2 text-sm text-red-600">{errors.dropoff}</p>
                    )}
                    {estimatedDistance !== null && pickupLocation && dropoffLocation && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3">
                            <MapPin className="h-4 w-4 text-accent" />
                            <span className="text-sm font-medium text-slate-700">
                                Distance estimée : {estimatedDistance.toFixed(1)} km
                            </span>
                        </div>
                    )}
                </section>

                {/* Notes */}
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <Label htmlFor="notes">Instructions (optionnel)</Label>
                    <textarea
                        id="notes"
                        className="mt-2 min-h-[100px] w-full rounded-lg border border-slate-300 p-3 text-sm"
                        placeholder="Ex: Produits frais uniquement, vérifier les dates..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </section>

                {/* Actions */}
                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery')}>
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !selectedSupermarket || basketItems.length === 0 || !dropoffLocation}
                    >
                        {loading ? 'Création...' : 'Créer la commande'}
                    </Button>
                </div>
            </div>

            {/* Modal GPS */}
            {showDropoffGPS && (
                <div className="fixed inset-0 z-50">
                    <AdvancedGPSModal
                        onClose={() => setShowDropoffGPS(false)}
                        onSelect={(path, previewUrl, metadata) => handleGPSSelect(path, previewUrl, metadata)}
                        initialLocation={
                            dropoffLocation
                                ? { lat: dropoffLocation.latitude, lng: dropoffLocation.longitude }
                                : undefined
                        }
                    />
                </div>
            )}
        </AppLayout>
    );
};

export default DeliveryShoppingFlowPage;

