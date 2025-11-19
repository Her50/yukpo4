import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MapModal from '@/components/ui/MapModal';
import { useToast } from '@/components/ui/use-toast';
import {
    createStorageLocation,
    deleteStorageLocation,
    listDeliveryZones,
    listStorageLocations,
    updateStorageLocation,
    type DeliveryZone,
    type MerchantStorageLocation,
    type MerchantStorageLocationInput,
} from '@/services/deliveryApi';
import { MapPin, Plus, Trash2, Warehouse, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

const StorageLocationsPage: React.FC = () => {
    const { toast } = useToast();
    const [locations, setLocations] = useState<MerchantStorageLocation[]>([]);
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingZones, setLoadingZones] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState<MerchantStorageLocation | null>(null);
    const [showMapModal, setShowMapModal] = useState(false);
    const [formData, setFormData] = useState<MerchantStorageLocationInput>({
        name: '',
        address: '',
        latitude: 0,
        longitude: 0,
        zone_id: null,
        is_active: true,
    });

    useEffect(() => {
        loadLocations();
        loadZones();
    }, []);

    const loadZones = async () => {
        setLoadingZones(true);
        try {
            const zonesList = await listDeliveryZones();
            setZones(zonesList.filter(z => z.is_active));
        } catch (error: any) {
            console.error('Erreur chargement zones:', error);
            // Ne pas afficher d'erreur si les zones ne sont pas disponibles
        } finally {
            setLoadingZones(false);
        }
    };

    const loadLocations = async () => {
        setLoading(true);
        try {
            const response = await listStorageLocations();
            setLocations(response.locations || []);
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les lieux de stock',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingLocation(null);
        setFormData({
            name: '',
            address: '',
            latitude: 0,
            longitude: 0,
            zone_id: null,
            is_active: true,
        });
        setShowCreateModal(true);
    };

    const handleEdit = (location: MerchantStorageLocation) => {
        setEditingLocation(location);
        setFormData({
            name: location.name,
            address: location.address,
            latitude: location.latitude,
            longitude: location.longitude,
            zone_id: location.zone_id || null,
            is_active: location.is_active,
        });
        setShowCreateModal(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce lieu de stock ?')) {
            return;
        }

        try {
            await deleteStorageLocation(id);
            toast({
                title: 'Succès',
                description: 'Lieu de stock supprimé avec succès',
            });
            loadLocations();
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de supprimer le lieu de stock',
            });
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast({
                title: 'Erreur',
                description: 'Le nom est obligatoire',
            });
            return;
        }
        if (!formData.address.trim()) {
            toast({
                title: 'Erreur',
                description: 'L\'adresse est obligatoire',
            });
            return;
        }
        if (!formData.latitude || !formData.longitude) {
            toast({
                title: 'Erreur',
                description: 'Veuillez sélectionner une position sur la carte',
            });
            return;
        }

        try {
            if (editingLocation) {
                await updateStorageLocation(editingLocation.id, formData);
                toast({
                    title: 'Succès',
                    description: 'Lieu de stock mis à jour avec succès',
                });
            } else {
                await createStorageLocation(formData);
                toast({
                    title: 'Succès',
                    description: 'Lieu de stock créé avec succès',
                });
            }
            setShowCreateModal(false);
            loadLocations();
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de sauvegarder le lieu de stock',
            });
        }
    };

    const handleMapSelect = (coordinatesString: string) => {
        const parts = coordinatesString.split(',');
        if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
                setFormData(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                }));
            }
        }
        setShowMapModal(false);
    };

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Warehouse className="w-8 h-8" />
                        Lieux de stock
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Gérez vos différents points de stock pour optimiser vos livraisons
                    </p>
                </div>
                <Button onClick={handleCreate} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Ajouter un lieu de stock
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">Chargement...</p>
                </div>
            ) : locations.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Warehouse className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Aucun lieu de stock</h3>
                        <p className="text-gray-600 mb-4">
                            Créez votre premier lieu de stock pour optimiser vos livraisons
                        </p>
                        <Button onClick={handleCreate}>
                            <Plus className="w-4 h-4 mr-2" />
                            Créer un lieu de stock
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {locations.map((location) => (
                        <Card key={location.id} className={!location.is_active ? 'opacity-60' : ''}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="flex items-center gap-2">
                                            <Warehouse className="w-5 h-5" />
                                            {location.name}
                                        </CardTitle>
                                        {!location.is_active && (
                                            <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                                                Inactif
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEdit(location)}
                                        >
                                            Modifier
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(location.id)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                                        <div>
                                            <p className="text-sm text-gray-700">{location.address}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                            </p>
                                            {location.zone_id && (
                                                <p className="text-xs text-blue-600 mt-1">
                                                    Zone: {zones.find(z => z.id === location.zone_id)?.name || location.zone_id}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Modal de création/édition */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>
                                {editingLocation ? 'Modifier le lieu de stock' : 'Nouveau lieu de stock'}
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Nom du lieu de stock *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ex: Entrepôt principal, Magasin centre-ville..."
                                />
                            </div>

                            <div>
                                <Label>Adresse *</Label>
                                <Input
                                    value={formData.address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder="Adresse complète"
                                />
                            </div>

                            <div>
                                <Label>Position GPS *</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        step="0.000001"
                                        value={formData.latitude || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                                        placeholder="Latitude"
                                    />
                                    <Input
                                        type="number"
                                        step="0.000001"
                                        value={formData.longitude || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                                        placeholder="Longitude"
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowMapModal(true)}
                                    >
                                        <MapPin className="w-4 h-4" />
                                    </Button>
                                </div>
                                {formData.latitude && formData.longitude && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        GPS: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                                    </p>
                                )}
                            </div>

                            {/* ✅ Phase 9 - Amélioration : Sélection de la zone géographique */}
                            <div>
                                <Label>Zone de livraison (optionnel)</Label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={formData.zone_id || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, zone_id: e.target.value || null }))}
                                >
                                    <option value="">Aucune zone</option>
                                    {zones.map((zone) => (
                                        <option key={zone.id} value={zone.id}>
                                            {zone.name} {zone.description ? `- ${zone.description}` : ''}
                                        </option>
                                    ))}
                                </select>
                                {loadingZones && (
                                    <p className="text-xs text-gray-500 mt-1">Chargement des zones...</p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active ?? true}
                                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <Label htmlFor="is_active">Lieu de stock actif</Label>
                            </div>

                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                                    Annuler
                                </Button>
                                <Button onClick={handleSave}>
                                    {editingLocation ? 'Mettre à jour' : 'Créer'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal de carte */}
            {showMapModal && (
                <MapModal
                    onClose={() => setShowMapModal(false)}
                    onSelect={handleMapSelect}
                />
            )}
        </div>
    );
};

export default StorageLocationsPage;

