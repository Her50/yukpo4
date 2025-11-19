import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MapModal from '@/components/ui/MapModal';
import { useToast } from '@/components/ui/use-toast';
import { listStorageLocations, type MerchantStorageLocation } from '@/services/deliveryApi';
import { MapPin, Truck, Warehouse, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ProductDeliveryConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceId: number;
    productIndex: number; // -1 pour mode transversal (tous les produits)
    productName: string;
    onSuccess?: () => void;
    allProducts?: Array<{ index: number; name: string }>; // Liste des produits pour mode transversal
}

interface ParcelType {
    id: number;
    name: string;
    description?: string;
}

interface DeliveryConfig {
    pickup_address: string;
    pickup_latitude: number;
    pickup_longitude: number;
    storage_location_id?: number; // ✅ Phase 9 - Amélioration 32
    required_vehicle_type_id: number;
    weight_kg?: number;
    volume_cm3?: number;
    requires_isothermal: boolean;
    requires_fragile_handling: boolean;
    pickup_availability_schedule: {
        monday?: { start: string; end: string }[];
        tuesday?: { start: string; end: string }[];
        wednesday?: { start: string; end: string }[];
        thursday?: { start: string; end: string }[];
        friday?: { start: string; end: string }[];
        saturday?: { start: string; end: string }[];
        sunday?: { start: string; end: string }[];
    };
    pickup_instructions?: string;
    billing_mode: string;
    billing_partner_label?: string;
}

const ProductDeliveryConfigModal: React.FC<ProductDeliveryConfigModalProps> = ({
    isOpen,
    onClose,
    serviceId,
    productIndex,
    productName,
    onSuccess,
    allProducts = []
}) => {
    const isTransversalMode = productIndex === -1;
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [parcelTypes, setParcelTypes] = useState<ParcelType[]>([]);
    const [showMapModal, setShowMapModal] = useState(false);
    // ✅ Phase 9 - Amélioration 32 : Gestion des lieux de stock
    const [storageLocations, setStorageLocations] = useState<MerchantStorageLocation[]>([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [config, setConfig] = useState<DeliveryConfig>({
        pickup_address: '',
        pickup_latitude: 0,
        pickup_longitude: 0,
        storage_location_id: undefined, // ✅ Phase 9 - Amélioration 32
        required_vehicle_type_id: 0,
        weight_kg: undefined,
        volume_cm3: undefined,
        requires_isothermal: false,
        requires_fragile_handling: false,
        pickup_availability_schedule: {},
        pickup_instructions: '',
        billing_mode: 'standard',
        billing_partner_label: ''
    });

    // Charger les types de colis
    useEffect(() => {
        if (isOpen) {
            loadParcelTypes();
            loadStorageLocations(); // ✅ Phase 9 - Amélioration 32
            if (!isTransversalMode) {
                loadExistingConfig();
            }
        }
    }, [isOpen, serviceId, productIndex]);

    // ✅ Phase 9 - Amélioration 32 : Charger les lieux de stock
    const loadStorageLocations = async () => {
        setLoadingLocations(true);
        try {
            const response = await listStorageLocations();
            setStorageLocations(response.locations || []);
        } catch (error) {
            console.error('Erreur chargement lieux de stock:', error);
        } finally {
            setLoadingLocations(false);
        }
    };

    // ✅ Phase 9 - Amélioration 32 : Mettre à jour les coordonnées quand un lieu de stock est sélectionné
    useEffect(() => {
        if (config.storage_location_id && storageLocations.length > 0) {
            const selectedLocation = storageLocations.find(loc => loc.id === config.storage_location_id);
            if (selectedLocation) {
                setConfig(prev => ({
                    ...prev,
                    pickup_address: selectedLocation.address,
                    pickup_latitude: selectedLocation.latitude,
                    pickup_longitude: selectedLocation.longitude,
                }));
            }
        }
    }, [config.storage_location_id, storageLocations]);

    const loadParcelTypes = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/delivery/parcel-types', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setParcelTypes(data.parcel_types || []);
            }
        } catch (error) {
            console.error('Erreur chargement types de colis:', error);
        }
    };

    const loadExistingConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/delivery/product-config/${serviceId}/${productIndex}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.config) {
                    setConfig({
                        pickup_address: data.config.pickup_address || '',
                        pickup_latitude: data.config.pickup_latitude || 0,
                        pickup_longitude: data.config.pickup_longitude || 0,
                        storage_location_id: data.config.storage_location_id || undefined, // ✅ Phase 9 - Amélioration 32
                        required_vehicle_type_id: data.config.required_vehicle_type_id || 0,
                        weight_kg: data.config.weight_kg,
                        volume_cm3: data.config.volume_cm3,
                        requires_isothermal: data.config.requires_isothermal || false,
                        requires_fragile_handling: data.config.requires_fragile_handling || false,
                        pickup_availability_schedule: data.config.pickup_availability_schedule || {},
                        pickup_instructions: data.config.pickup_instructions || '',
                        billing_mode: data.config.billing_mode || 'standard',
                        billing_partner_label: data.config.billing_partner_label || ''
                    });

                    // Note: Les coordonnées du lieu de stock seront mises à jour via useEffect
                }
            }
        } catch (error) {
            console.error('Erreur chargement configuration:', error);
        }
    };

    const handleSave = async () => {
        // Validation
        if (!config.pickup_address.trim()) {
            toast({
                title: "Erreur",
                description: "L'adresse de départ est obligatoire",
            });
            return;
        }
        if (!config.required_vehicle_type_id) {
            toast({
                title: "Erreur",
                description: "Le type de véhicule est obligatoire",
            });
            return;
        }
        if (Object.keys(config.pickup_availability_schedule).length === 0) {
            toast({
                title: "Erreur",
                description: "Veuillez définir au moins une plage horaire de récupération",
            });
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');

            // Mode transversal : appliquer à tous les produits
            if (isTransversalMode && allProducts.length > 0) {
                let successCount = 0;
                let errorCount = 0;

                for (const product of allProducts) {
                    try {
                        const response = await fetch('/api/delivery/product-config', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                service_id: serviceId,
                                product_index: product.index,
                                pickup_address: config.pickup_address,
                                pickup_latitude: config.pickup_latitude,
                                pickup_longitude: config.pickup_longitude,
                                storage_location_id: config.storage_location_id || null, // ✅ Phase 9 - Amélioration 32
                                required_vehicle_type_id: config.required_vehicle_type_id,
                                weight_kg: config.weight_kg,
                                volume_cm3: config.volume_cm3,
                                requires_isothermal: config.requires_isothermal,
                                requires_fragile_handling: config.requires_fragile_handling,
                                pickup_availability_schedule: config.pickup_availability_schedule,
                                pickup_instructions: config.pickup_instructions,
                                billing_mode: config.billing_mode,
                                billing_partner_label: config.billing_partner_label
                            })
                        });

                        if (response.ok) {
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (error) {
                        console.error(`Erreur pour produit ${product.index}:`, error);
                        errorCount++;
                    }
                }

                if (errorCount === 0) {
                    toast({
                        title: "Succès",
                        description: `Configuration appliquée à ${successCount} produit(s) avec succès`,
                    });
                    onSuccess?.();
                    onClose();
                } else {
                    toast({
                        title: "Partiellement réussi",
                        description: `${successCount} produit(s) configuré(s), ${errorCount} erreur(s)`,
                    });
                }
            } else {
                // Mode normal : un seul produit
                const response = await fetch('/api/delivery/product-config', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        service_id: serviceId,
                        product_index: productIndex,
                        pickup_address: config.pickup_address,
                        pickup_latitude: config.pickup_latitude,
                        pickup_longitude: config.pickup_longitude,
                        storage_location_id: config.storage_location_id || null, // ✅ Phase 9 - Amélioration 32
                        required_vehicle_type_id: config.required_vehicle_type_id,
                        weight_kg: config.weight_kg,
                        volume_cm3: config.volume_cm3,
                        requires_isothermal: config.requires_isothermal,
                        requires_fragile_handling: config.requires_fragile_handling,
                        pickup_availability_schedule: config.pickup_availability_schedule,
                        pickup_instructions: config.pickup_instructions,
                        billing_mode: config.billing_mode,
                        billing_partner_label: config.billing_partner_label
                    })
                });

                if (response.ok) {
                    toast({
                        title: "Succès",
                        description: "Configuration de livraison sauvegardée avec succès",
                    });
                    onSuccess?.();
                    onClose();
                } else {
                    const error = await response.json();
                    toast({
                        title: "Erreur",
                        description: error.message || "Erreur lors de la sauvegarde",
                    });
                }
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            toast({
                title: "Erreur",
                description: "Erreur lors de la sauvegarde de la configuration",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleMapSelect = (coordinatesString: string) => {
        const parts = coordinatesString.split(',');
        if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
                setConfig(prev => ({
                    ...prev,
                    pickup_latitude: lat,
                    pickup_longitude: lng
                }));
            }
        }
        setShowMapModal(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="w-5 h-5" />
                            {isTransversalMode
                                ? `Configuration de livraison - Tous les produits (${allProducts.length})`
                                : `Configuration de livraison - ${productName}`
                            }
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* ✅ Phase 9 - Amélioration 32 : Sélection du lieu de stock */}
                        <div>
                            <Label className="flex items-center gap-2">
                                <Warehouse className="w-4 h-4" />
                                Lieu de stock (optionnel)
                            </Label>
                            <select
                                className="w-full p-2 border rounded"
                                value={config.storage_location_id || ''}
                                onChange={(e) => {
                                    const locationId = e.target.value ? parseInt(e.target.value) : undefined;
                                    const selectedLocation = locationId ? storageLocations.find(loc => loc.id === locationId) : null;
                                    setConfig(prev => ({
                                        ...prev,
                                        storage_location_id: locationId,
                                        pickup_address: selectedLocation ? selectedLocation.address : prev.pickup_address,
                                        pickup_latitude: selectedLocation ? selectedLocation.latitude : prev.pickup_latitude,
                                        pickup_longitude: selectedLocation ? selectedLocation.longitude : prev.pickup_longitude,
                                    }));
                                }}
                            >
                                <option value="">Aucun (utiliser adresse manuelle)</option>
                                {storageLocations
                                    .filter(loc => loc.is_active)
                                    .map(location => (
                                        <option key={location.id} value={location.id}>
                                            {location.name} - {location.address}
                                        </option>
                                    ))}
                            </select>
                            {loadingLocations && (
                                <p className="text-xs text-gray-500 mt-1">Chargement des lieux de stock...</p>
                            )}
                        </div>

                        {/* Adresse de départ */}
                        <div>
                            <Label>Adresse de départ *</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={config.pickup_address}
                                    onChange={(e) => setConfig(prev => ({ ...prev, pickup_address: e.target.value }))}
                                    placeholder="Adresse complète"
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => setShowMapModal(true)}
                                >
                                    <MapPin className="w-4 h-4" />
                                </Button>
                            </div>
                            {config.pickup_latitude && config.pickup_longitude && (
                                <p className="text-xs text-gray-500 mt-1">
                                    GPS: {config.pickup_latitude.toFixed(6)}, {config.pickup_longitude.toFixed(6)}
                                </p>
                            )}
                        </div>

                        {/* Type de véhicule */}
                        <div>
                            <Label>Type de véhicule requis *</Label>
                            <select
                                className="w-full p-2 border rounded"
                                value={config.required_vehicle_type_id}
                                onChange={(e) => setConfig(prev => ({ ...prev, required_vehicle_type_id: parseInt(e.target.value) }))}
                            >
                                <option value={0}>Sélectionner...</option>
                                {parcelTypes.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.name} {type.description ? `- ${type.description}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Poids et volume */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Poids (kg)</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={config.weight_kg || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, weight_kg: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                    placeholder="Optionnel"
                                />
                            </div>
                            <div>
                                <Label>Volume (cm³)</Label>
                                <Input
                                    type="number"
                                    step="1"
                                    value={config.volume_cm3 || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, volume_cm3: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                    placeholder="Optionnel"
                                />
                            </div>
                        </div>

                        {/* Options spéciales */}
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.requires_isothermal}
                                    onChange={(e) => setConfig(prev => ({ ...prev, requires_isothermal: e.target.checked }))}
                                />
                                <span className="text-sm">Isotherme requis</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={config.requires_fragile_handling}
                                    onChange={(e) => setConfig(prev => ({ ...prev, requires_fragile_handling: e.target.checked }))}
                                />
                                <span className="text-sm">Manipulation fragile</span>
                            </label>
                        </div>

                        {/* Plages horaires - Version simplifiée */}
                        <div>
                            <Label>Plages horaires de départ *</Label>
                            <p className="text-xs text-gray-500 mb-2">
                                Format: {'{"lundi": [{"start": "08:00", "end": "18:00"}]}'}
                            </p>
                            <textarea
                                className="w-full p-2 border rounded min-h-[100px] font-mono text-xs"
                                value={JSON.stringify(config.pickup_availability_schedule, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        setConfig(prev => ({ ...prev, pickup_availability_schedule: parsed }));
                                    } catch {
                                        // Ignore invalid JSON while typing
                                    }
                                }}
                                placeholder='{"monday": [{"start": "08:00", "end": "18:00"}]}'
                            />
                        </div>

                        {/* Instructions */}
                        <div>
                            <Label>Instructions de départ</Label>
                            <textarea
                                className="w-full p-2 border rounded"
                                value={config.pickup_instructions || ''}
                                onChange={(e) => setConfig(prev => ({ ...prev, pickup_instructions: e.target.value }))}
                                placeholder="Instructions spéciales pour le coursier"
                                rows={3}
                            />
                        </div>

                        {/* Mode de facturation */}
                        <div>
                            <Label>Mode de facturation</Label>
                            <select
                                className="w-full p-2 border rounded"
                                value={config.billing_mode}
                                onChange={(e) => setConfig(prev => ({ ...prev, billing_mode: e.target.value }))}
                            >
                                <option value="standard">Standard</option>
                                <option value="partner">Partenaire</option>
                            </select>
                        </div>

                        {config.billing_mode === 'partner' && (
                            <div>
                                <Label>Label partenaire</Label>
                                <Input
                                    value={config.billing_partner_label || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, billing_partner_label: e.target.value }))}
                                    placeholder="Nom du partenaire"
                                />
                            </div>
                        )}

                        {/* Avertissement mode transversal */}
                        {isTransversalMode && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <p className="text-xs text-yellow-800">
                                    ⚠️ <strong>Attention :</strong> Cette configuration sera appliquée à tous vos produits (sauf les prestations de service).
                                    Les configurations existantes seront remplacées.
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button variant="outline" onClick={onClose}>
                                Annuler
                            </Button>
                            <Button onClick={handleSave} disabled={loading}>
                                {loading
                                    ? (isTransversalMode ? 'Application en cours...' : 'Enregistrement...')
                                    : (isTransversalMode ? `Appliquer à ${allProducts.length} produit(s)` : 'Enregistrer')
                                }
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {showMapModal && (
                <MapModal
                    onClose={() => setShowMapModal(false)}
                    onSelect={handleMapSelect}
                />
            )}
        </>
    );
};

export default ProductDeliveryConfigModal;

