// ✅ Phase 9 - Amélioration : Liste des items de shopping avec possibilité de refus
import ParcelRejectionModal from '@/components/delivery/ParcelRejectionModal';
import { Button } from '@/components/ui/buttons/Button';
import { useToast } from '@/components/ui/use-toast';
import { rejectShoppingItem } from '@/services/deliveryApi';
import { ParcelRejectionReason, ShoppingBasketItem } from '@/types/delivery';
import formatCurrency from '@/utils/formatCurrency';
import { Check, X } from 'lucide-react';
import React, { useState } from 'react';

interface ShoppingItemsListProps {
    items: ShoppingBasketItem[];
    orderId: string;
    currency?: string;
    onItemUpdated?: () => void;
    canReject?: boolean; // Si l'utilisateur peut rejeter les items
}

const ShoppingItemsList: React.FC<ShoppingItemsListProps> = ({
    items,
    orderId,
    currency = 'XAF',
    onItemUpdated,
    canReject = true,
}) => {
    const { toast } = useToast();
    const [rejectingItem, setRejectingItem] = useState<ShoppingBasketItem | null>(null);

    const handleReject = async (reason: ParcelRejectionReason) => {
        if (!rejectingItem) return;

        try {
            await rejectShoppingItem(orderId, rejectingItem.id, reason);
            toast({
                title: '✅ Produit refusé',
                description: `${rejectingItem.productName} a été refusé avec succès`,
            });
            setRejectingItem(null);
            onItemUpdated?.();
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de refuser le produit',
            });
        }
    };

    if (items.length === 0) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Aucun produit dans cette commande</p>
            </div>
        );
    }

    return (
        <>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Produits commandés</h2>
                <div className="space-y-3">
                    {items.map((item) => {
                        const isRejected = item.status === 'rejected';
                        const canRejectItem = canReject && !isRejected && item.status !== 'accepted';

                        return (
                            <div
                                key={item.id}
                                className={`rounded-lg border p-4 ${isRejected
                                        ? 'border-red-200 bg-red-50'
                                        : 'border-slate-200 bg-slate-50'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium text-slate-900">
                                                {item.productName}
                                            </h3>
                                            {isRejected && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                                    <X className="h-3 w-3" />
                                                    Refusé
                                                </span>
                                            )}
                                            {item.status === 'accepted' && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                    <Check className="h-3 w-3" />
                                                    Accepté
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Quantité : {item.quantity} {item.unit || 'unité(s)'}
                                        </p>
                                        {item.estimatedPriceCents && (
                                            <p className="mt-1 text-sm font-medium text-slate-900">
                                                {formatCurrency(item.estimatedPriceCents, currency)}
                                            </p>
                                        )}
                                        {isRejected && item.rejection_reason && (
                                            <p className="mt-2 text-xs text-red-600">
                                                Raison : {getRejectionReasonLabel(item.rejection_reason)}
                                            </p>
                                        )}
                                    </div>
                                    {canRejectItem && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setRejectingItem(item)}
                                            className="ml-4"
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Refuser
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {rejectingItem && (
                <ParcelRejectionModal
                    isOpen={!!rejectingItem}
                    onClose={() => setRejectingItem(null)}
                    productName={rejectingItem.productName}
                    onConfirm={handleReject}
                />
            )}
        </>
    );
};

// Fonction helper pour obtenir le label d'une raison de refus
function getRejectionReasonLabel(reason: ParcelRejectionReason): string {
    const labels: Record<ParcelRejectionReason, string> = {
        damaged: 'Produit endommagé',
        wrong_item: 'Mauvais produit',
        expired: 'Produit périmé',
        wrong_quantity: 'Mauvaise quantité',
        wrong_size: 'Mauvaise taille',
        wrong_color: 'Mauvaise couleur',
        quality_issue: 'Problème de qualité',
        not_ordered: 'Non commandé',
        duplicate: 'Doublon',
        other: 'Autre raison',
    };
    return labels[reason] || reason;
}

export default ShoppingItemsList;

