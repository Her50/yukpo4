import DeliveryAvatar from '@/components/delivery/DeliveryAvatarBubble';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useDeliveryContext } from '@/context/DeliveryContext';
import { useShopping } from '@/context/ShoppingContext';
import formatCurrency from '@/utils/formatCurrency';
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SummaryLocationState {
    store?: {
        name?: string;
        address?: string;
        latitude: number;
        longitude: number;
    };
    dropoff?: {
        address?: string;
        latitude: number;
        longitude: number;
    };
}

const ShoppingSummaryPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { items, estimate, recipient, createOrder } = useShopping();
    const { setActiveDeliveryId, refreshActiveDeliveries } = useDeliveryContext();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const state = location.state as SummaryLocationState | undefined;

    const canConfirm = useMemo(() => {
        return Boolean(
            items.length &&
            state?.store?.latitude &&
            state?.store?.longitude &&
            state?.dropoff?.latitude &&
            state?.dropoff?.longitude,
        );
    }, [items.length, state]);

    const handleConfirm = async () => {
        if (!state?.store || !state?.dropoff) {
            toast({
                variant: 'destructive',
                title: 'Informations manquantes',
                description: 'Veuillez renseigner le point de retrait et de livraison.',
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const result = await createOrder({
                store: {
                    name: state.store.name,
                    address: state.store.address,
                    latitude: state.store.latitude,
                    longitude: state.store.longitude,
                },
                dropoff: {
                    address: state.dropoff.address ?? null,
                    latitude: state.dropoff.latitude,
                    longitude: state.dropoff.longitude,
                },
                deliveryPricing: {
                    basePriceCents: 0,
                    distancePriceCents: 0,
                    surchargeCents: 0,
                    discountCents: 0,
                },
                notes: recipient?.notes,
            });

            const deliveryId = (result.delivery as { id?: string })?.id;
            await refreshActiveDeliveries({ force: true });

            if (deliveryId) {
                setActiveDeliveryId(deliveryId);
                navigate(`/delivery/${deliveryId}/tracking`, { replace: true });
            } else {
                navigate('/delivery', { replace: true });
            }
            toast({
                title: 'Commande confirmée',
                description: 'Votre coursier est notifié et prendra en charge la commande.',
            });
        } catch (error) {
            console.error('[ShoppingSummaryPage] createOrder error', error);
            toast({
                variant: 'destructive',
                title: 'Impossible de confirmer la commande',
                description: error instanceof Error ? error.message : 'Merci de réessayer.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalEstimated = estimate?.estimated_total_cents
        ? formatCurrency(estimate.estimated_total_cents / 100, estimate.currency)
        : '—';

    return (
        <AppLayout>
            <div className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-6">
                <DeliveryAvatar
                    message="Vérifiez votre commande"
                    subtitle="Confirmez le panier et les points GPS pour notifier le coursier."
                />

                <Card className="space-y-3 border border-slate-200 p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Panier</h2>
                    <ul className="space-y-2 text-sm text-slate-600">
                        {items.map(item => (
                            <li key={item.id} className="flex justify-between">
                                <span>{item.productName} — {item.quantity} {item.unit}</span>
                                <span className="font-medium text-slate-800">
                                    {item.estimatedPriceCents ? formatCurrency(item.estimatedPriceCents / 100) : '—'}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">
                        <span>Total estimé</span>
                        <span>{totalEstimated}</span>
                    </div>
                </Card>

                <Card className="space-y-3 border border-slate-200 p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Points GPS</h2>
                    <div className="space-y-2 text-sm text-slate-600">
                        <div>
                            <div className="font-semibold text-slate-900">Retrait supermarché</div>
                            <p>{state?.store?.name ?? 'Non précisé'}</p>
                            <p className="text-xs text-slate-500">
                                {state?.store?.latitude}, {state?.store?.longitude} · {state?.store?.address ?? 'Adresse non renseignée'}
                            </p>
                        </div>
                        <div>
                            <div className="font-semibold text-slate-900">Livraison destinataire</div>
                            <p>{state?.dropoff?.address ?? 'Non précisée'}</p>
                            <p className="text-xs text-slate-500">
                                {state?.dropoff?.latitude}, {state?.dropoff?.longitude}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="space-y-2 border border-slate-200 p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Instructions coursier</h2>
                    <p className="text-sm text-slate-600">
                        {recipient?.notes ?? 'Aucune note particulière.'}
                    </p>
                </Card>

                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery/shopping/pickup-drop')}>
                        Retour
                    </Button>
                    <Button onClick={handleConfirm} disabled={!canConfirm} loading={isSubmitting}>
                        Confirmer la commande
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShoppingSummaryPage;


