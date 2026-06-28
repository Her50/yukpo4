import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { assignCourier, listAvailableCouriers, AvailableCourier } from '@/services/deliveryApi';
import { Star, Clock, CheckCircle, X, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface CourierSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    deliveryId: string;
    onSuccess?: () => void;
}

const CourierSelectionModal: React.FC<CourierSelectionModalProps> = ({
    isOpen,
    onClose,
    deliveryId,
    onSuccess,
}) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [couriers, setCouriers] = useState<AvailableCourier[]>([]);
    const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
    const [loadingCouriers, setLoadingCouriers] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadCouriers();
        }
    }, [isOpen]);

    const loadCouriers = async () => {
        setLoadingCouriers(true);
        try {
            const response = await listAvailableCouriers();
            setCouriers(response.couriers);
        } catch (error) {
            console.error('[CourierSelectionModal] Erreur chargement coursiers:', error);
            toast({
                title: 'Erreur',
                description: 'Impossible de charger la liste des coursiers',
                type: 'error',
            });
        } finally {
            setLoadingCouriers(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedCourierId) {
            toast({
                title: 'Erreur',
                description: 'Veuillez sélectionner un coursier',
                type: 'error',
            });
            return;
        }

        setLoading(true);
        try {
            await assignCourier(deliveryId, { courier_id: selectedCourierId });
            toast({
                title: '✅ Coursier assigné',
                description: 'Le coursier a été assigné avec succès à cette livraison',
            });
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('[CourierSelectionModal] Erreur assignation:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible d\'assigner le coursier',
                type: 'error',
            });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-semibold text-slate-900">
                        Choisir un livreur
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loadingCouriers ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="ml-3 text-slate-600">Chargement des coursiers...</span>
                        </div>
                    ) : couriers.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <p>Aucun coursier disponible pour le moment</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {couriers.map((courier) => (
                                <div
                                    key={courier.id}
                                    onClick={() => setSelectedCourierId(courier.id)}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        selectedCourierId === courier.id
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="flex-shrink-0">
                                            {courier.avatar_url ? (
                                                <img
                                                    src={courier.avatar_url}
                                                    alt={courier.name || 'Coursier'}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                                    {(courier.name || courier.email)[0].toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-semibold text-slate-900 truncate">
                                                    {courier.name || courier.email}
                                                </h3>
                                                {selectedCourierId === courier.id && (
                                                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                                                )}
                                            </div>

                                            {courier.bio && (
                                                <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                                                    {courier.bio}
                                                </p>
                                            )}

                                            {/* Stats */}
                                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                                                {courier.rating_average !== null && (
                                                    <div className="flex items-center gap-1">
                                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                                        <span className="font-medium">
                                                            {courier.rating_average.toFixed(1)}
                                                        </span>
                                                        <span className="text-slate-400">
                                                            ({courier.rating_count})
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-1">
                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                    <span>
                                                        {courier.stats.completed_deliveries} livraisons
                                                    </span>
                                                </div>

                                                {courier.stats.avg_delivery_time_minutes && (
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4 text-blue-600" />
                                                        <span>
                                                            {Math.round(courier.stats.avg_delivery_time_minutes)} min
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="ml-auto">
                                                    <span className="font-medium text-green-600">
                                                        {courier.stats.success_rate}% de réussite
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-slate-50">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Annuler
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!selectedCourierId || loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Assignation...
                            </>
                        ) : (
                            'Assigner ce coursier'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CourierSelectionModal;

