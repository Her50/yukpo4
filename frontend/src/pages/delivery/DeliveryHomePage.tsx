import ActiveDeliveryCard from '@/components/delivery/ActiveDeliveryCard';
import DeliveryAvatar from '@/components/delivery/DeliveryAvatarBubble';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { useDeliveryContext } from '@/context/DeliveryContext';
import { AlertCircle, PackagePlus } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const DeliveryHomePage: React.FC = () => {
    const navigate = useNavigate();
    const {
        deliveries,
        refreshActiveDeliveries,
        setActiveDeliveryId,
        loading,
        error,
    } = useDeliveryContext();

    useEffect(() => {
        refreshActiveDeliveries({ force: true });
    }, [refreshActiveDeliveries]);

    const activeDeliveries = useMemo(
        () =>
            Object.values(deliveries).sort((a, b) => {
                const aTime = a.lastEventAt ?? a.checkpoints.slice(-1)[0]?.timestamp ?? '';
                const bTime = b.lastEventAt ?? b.checkpoints.slice(-1)[0]?.timestamp ?? '';
                return bTime.localeCompare(aTime);
            }),
        [deliveries],
    );

    const handleStartShopping = () => navigate('/delivery/shopping/basket');

    const handleStartParcel = () => {
        alert(
            "Le parcours colis web arrive bientôt. Utilisez l'option courses supermarché pour tester le suivi en temps réel.",
        );
    };

    const handleOpenDelivery = (deliveryId: string) => {
        setActiveDeliveryId(deliveryId);
        navigate(`/delivery/${deliveryId}/tracking`);
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-6">
                <DeliveryAvatar />

                <section className="grid gap-4 md:grid-cols-2">
                    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Courses supermarché</h2>
                                <p className="text-sm text-slate-600">
                                    Composez votre panier, Yukpo avance l’achat et vous suivez le coursier en direct.
                                </p>
                            </div>
                            <PackagePlus className="h-10 w-10 text-primary" />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleStartShopping}>Commander au supermarché</Button>
                        </div>
                    </article>

                    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Livraison de colis</h2>
                                <p className="text-sm text-slate-600">
                                    Envoie de colis avec suivi temps réel — fonctionnalité en cours de finalisation web.
                                </p>
                            </div>
                            <AlertCircle className="h-10 w-10 text-amber-500" />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button variant="outline" onClick={handleStartParcel}>
                                Bientôt disponible
                            </Button>
                        </div>
                    </article>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-900">Vos livraisons actives</h2>
                        <Button size="sm" variant="ghost" onClick={() => refreshActiveDeliveries({ force: true })}>
                            Actualiser
                        </Button>
                    </div>

                    {error ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                            {error}
                        </div>
                    ) : null}

                    {loading && !activeDeliveries.length ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                            Chargement des livraisons en cours…
                        </div>
                    ) : null}

                    {!loading && activeDeliveries.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                            Aucune livraison active pour le moment. Lancez une commande supermarché pour démarrer.
                        </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                        {activeDeliveries.map(delivery => (
                            <ActiveDeliveryCard
                                key={delivery.id}
                                delivery={delivery}
                                onClick={handleOpenDelivery}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </AppLayout>
    );
};

export default DeliveryHomePage;


