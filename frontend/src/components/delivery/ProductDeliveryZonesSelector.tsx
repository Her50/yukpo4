// ✅ Phase 9 - Amélioration : Composant pour associer des zones de livraison aux produits
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { listDeliveryZones, type DeliveryZone } from '@/services/deliveryApi';
import { Check, MapPin, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ProductDeliveryZonesSelectorProps {
    serviceId: number;
    productIndex: number;
    selectedZoneIds?: string[];
    onChange?: (zoneIds: string[]) => void;
    readonly?: boolean;
}

const ProductDeliveryZonesSelector: React.FC<ProductDeliveryZonesSelectorProps> = ({
    serviceId,
    productIndex,
    selectedZoneIds = [],
    onChange,
    readonly = false,
}) => {
    const { toast } = useToast();
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<string[]>(selectedZoneIds);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadZones();
        loadProductZones();
    }, [serviceId, productIndex]);

    useEffect(() => {
        setSelected(selectedZoneIds);
    }, [selectedZoneIds]);

    const loadZones = async () => {
        setLoading(true);
        try {
            const zonesList = await listDeliveryZones();
            setZones(zonesList.filter(z => z.is_active));
        } catch (error: any) {
            console.error('Erreur chargement zones:', error);
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les zones de livraison',
            });
        } finally {
            setLoading(false);
        }
    };

    const loadProductZones = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/products/${serviceId}/${productIndex}/zones`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setSelected(data.zone_ids || []);
            }
        } catch (error: any) {
            console.error('Erreur chargement zones produit:', error);
        }
    };

    const handleToggleZone = (zoneId: string) => {
        if (readonly) return;

        const newSelected = selected.includes(zoneId)
            ? selected.filter(id => id !== zoneId)
            : [...selected, zoneId];

        setSelected(newSelected);
        onChange?.(newSelected);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/products/${serviceId}/${productIndex}/zones`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ zone_ids: selected }),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la sauvegarde');
            }

            toast({
                title: '✅ Zones sauvegardées',
                description: 'Les zones de livraison ont été associées au produit avec succès',
            });
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de sauvegarder les zones',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">Chargement des zones...</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-900">
                        Zones de livraison disponibles
                    </h3>
                </div>
                {!readonly && (
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? 'Sauvegarde...' : 'Enregistrer'}
                    </Button>
                )}
            </div>

            {zones.length === 0 ? (
                <p className="text-sm text-slate-500">
                    Aucune zone de livraison disponible
                </p>
            ) : (
                <div className="space-y-2">
                    {zones.map((zone) => {
                        const isSelected = selected.includes(zone.id);
                        return (
                            <button
                                key={zone.id}
                                type="button"
                                onClick={() => handleToggleZone(zone.id)}
                                disabled={readonly}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${isSelected
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 hover:border-slate-300'
                                    } ${readonly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
                                                ? 'border-primary bg-primary'
                                                : 'border-slate-300'
                                            }`}
                                    >
                                        {isSelected && (
                                            <Check className="w-3 h-3 text-white" />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-slate-900">
                                            {zone.name}
                                        </p>
                                        {zone.description && (
                                            <p className="text-xs text-slate-500">
                                                {zone.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {isSelected && !readonly && (
                                    <X className="w-4 h-4 text-slate-400" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {selected.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-600 mb-2">
                        {selected.length} zone{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ProductDeliveryZonesSelector;

