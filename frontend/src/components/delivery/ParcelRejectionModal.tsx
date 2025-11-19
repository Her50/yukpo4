// ✅ Phase 9 - Amélioration : Modal pour sélectionner la raison de refus d'un colis
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { ParcelRejectionReason } from '@/types/delivery';
import { X } from 'lucide-react';
import React, { useState } from 'react';

interface ParcelRejectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    productName: string;
    onConfirm: (reason: ParcelRejectionReason) => Promise<void>;
}

const REJECTION_REASONS: Array<{ value: ParcelRejectionReason; label: string; icon: string }> = [
    { value: 'damaged', label: 'Produit endommagé', icon: '💔' },
    { value: 'wrong_item', label: 'Mauvais produit', icon: '❌' },
    { value: 'expired', label: 'Produit périmé', icon: '⏰' },
    { value: 'wrong_quantity', label: 'Mauvaise quantité', icon: '🔢' },
    { value: 'wrong_size', label: 'Mauvaise taille', icon: '📏' },
    { value: 'wrong_color', label: 'Mauvaise couleur', icon: '🎨' },
    { value: 'quality_issue', label: 'Problème de qualité', icon: '⚠️' },
    { value: 'not_ordered', label: 'Non commandé', icon: '🚫' },
    { value: 'duplicate', label: 'Doublon', icon: '📦' },
    { value: 'other', label: 'Autre raison', icon: '📝' },
];

const ParcelRejectionModal: React.FC<ParcelRejectionModalProps> = ({
    isOpen,
    onClose,
    productName,
    onConfirm,
}) => {
    const { toast } = useToast();
    const [selectedReason, setSelectedReason] = useState<ParcelRejectionReason | null>(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (!selectedReason) {
            toast({
                title: 'Erreur',
                description: 'Veuillez sélectionner une raison de refus',
            });
            return;
        }

        setLoading(true);
        try {
            await onConfirm(selectedReason);
            toast({
                title: '✅ Produit refusé',
                description: 'Le produit a été refusé avec succès',
            });
            onClose();
            setSelectedReason(null);
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de refuser le produit',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-900">Refuser le produit</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4">
                    <p className="mb-4 text-sm text-slate-600">
                        Sélectionnez la raison du refus pour <strong>{productName}</strong>
                    </p>

                    <div className="space-y-2">
                        {REJECTION_REASONS.map((reason) => (
                            <button
                                key={reason.value}
                                onClick={() => setSelectedReason(reason.value)}
                                className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${selectedReason === reason.value
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{reason.icon}</span>
                                    <span className="font-medium text-slate-900">{reason.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 p-4">
                    <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
                        Annuler
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        className="flex-1"
                        disabled={!selectedReason || loading}
                    >
                        {loading ? 'En cours...' : 'Confirmer le refus'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ParcelRejectionModal;

