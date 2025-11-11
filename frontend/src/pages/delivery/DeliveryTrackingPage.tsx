import DeliveryChatPanel from '@/components/delivery/DeliveryChatPanel';
import DeliveryLiveMap from '@/components/delivery/DeliveryLiveMap';
import DeliveryTimeline from '@/components/delivery/DeliveryTimeline';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import useDeliveryTracking from '@/hooks/useDeliveryTracking';
import formatCurrency from '@/utils/formatCurrency';
import { Navigation2 } from 'lucide-react';
import React, { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const DeliveryTrackingPage: React.FC = () => {
    const { deliveryId } = useParams<{ deliveryId: string }>();
    const navigate = useNavigate();
    const { delivery, events, timeline, refresh, loading } = useDeliveryTracking(deliveryId ?? null);

    useEffect(() => {
        if (deliveryId) {
            refresh({ force: true }).catch(console.error);
        }
    }, [deliveryId, refresh]);

    if (!deliveryId) {
        return (
            <AppLayout>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                    <p className="text-sm text-slate-500">
                        Aucun identifiant de livraison fourni.
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/delivery')}>
                        Retour à la livraison
                    </Button>
                </div>
            </AppLayout>
        );
    }

    if (!delivery && loading) {
        return (
            <AppLayout>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">
                    Chargement du suivi en cours…
                </div>
            </AppLayout>
        );
    }

    if (!delivery) {
        return (
            <AppLayout>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                    <p className="text-sm text-slate-500">
                        Impossible de trouver cette livraison.
                    </p>
                    <Button className="mt-4" onClick={() => navigate('/delivery')}>
                        Retour à la livraison
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-slate-500">Livraison #{delivery.id.slice(-6)}</p>
                        <h1 className="text-2xl font-semibold text-slate-900">
                            Suivi en temps réel
                        </h1>
                    </div>
                    <Button variant="ghost" onClick={() => refresh({ force: true })}>
                        Rafraîchir
                    </Button>
                </header>

                <section className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">Résumé livraison</h2>
                        <p className="text-sm text-slate-600">Statut actuel : <span className="font-semibold text-slate-900">{delivery.status}</span></p>
                        <p className="text-sm text-slate-600">
                            Point de retrait : {delivery.pickup.label ?? 'Non précisé'}
                        </p>
                        <p className="text-sm text-slate-600">
                            Destinataire : {delivery.dropoff.label ?? delivery.recipient?.name ?? 'Non précisé'}
                        </p>
                        {delivery.pricing?.finalTotal ?? delivery.pricing?.estimatedTotal ? (
                            <p className="text-sm text-slate-600">
                                Montant :{' '}
                                {formatCurrency(
                                    (delivery.pricing.finalTotal ?? delivery.pricing.estimatedTotal ?? 0),
                                    delivery.pricing.currency ?? 'XAF',
                                )}
                            </p>
                        ) : null}
                        <Link
                            to="/chat/support"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                            <Navigation2 className="h-4 w-4" />
                            Contacter le support
                        </Link>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
                        <div className="mt-4 max-h-80 overflow-y-auto pr-2">
                            <DeliveryTimeline checkpoints={timeline} />
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                    <DeliveryLiveMap delivery={delivery} events={events} />
                    <DeliveryChatPanel
                        deliveryId={delivery.id}
                        courierName={delivery.courier?.name}
                        recipientName={delivery.recipient?.name}
                    />
                </section>

                <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => navigate('/delivery')}>
                        Retour
                    </Button>
                    <Button variant="outline" onClick={() => refresh({ force: true })}>
                        Actualiser
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default DeliveryTrackingPage;


