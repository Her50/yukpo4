import ActiveDeliveryCard from '@/components/delivery/ActiveDeliveryCard';
import DeliveryAvatar from '@/components/delivery/DeliveryAvatarBubble';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { useFeatureFlags } from '@/context';
import { useDeliveryContext } from '@/context/DeliveryContext';
import { AlertCircle, PackagePlus, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
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
    const { isEnabled } = useFeatureFlags();
    const [refreshing, setRefreshing] = useState(false);
    const [navigating, setNavigating] = useState(false);

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

    // ✅ CORRIGÉ: Navigation robuste avec gestion d'erreur
    const handleStartShopping = useCallback(() => {
        if (navigating) return;

        console.log('[DeliveryHomePage] 🛒 Navigation vers /delivery/shopping/basket');
        setNavigating(true);

        try {
            navigate('/delivery/shopping/basket');
            console.log('[DeliveryHomePage] ✅ Navigation réussie');
        } catch (error: any) {
            console.error('[DeliveryHomePage] ❌ Erreur navigation:', error);
            toast.error('Impossible d\'ouvrir le flux de commande. Veuillez réessayer.');
            setNavigating(false);
        }
    }, [navigate, navigating]);

    const handleStartParcel = useCallback(() => {
        if (navigating) return;

        console.log('[DeliveryHomePage] 📦 Tentative d\'ouverture du flux colis');
        setNavigating(true);

        // Pour l'instant, rediriger vers le flux shopping (même logique)
        // TODO: Implémenter le flux colis web quand il sera prêt
        if (isEnabled('delivery_v2')) {
            // Utiliser le flux shopping en attendant
            handleStartShopping();
        } else {
            // Afficher un toast informatif et rediriger vers shopping
            toast(
                (t) => (
                    <div className="space-y-2">
                        <p className="font-semibold">Flux colis en préparation</p>
                        <p className="text-sm">
                            Le flux de livraison de colis est en cours de finalisation. Vous pouvez utiliser les courses supermarché pour tester le suivi en temps réel.
                        </p>
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    setNavigating(false);
                                    handleStartShopping();
                                }}
                                className="px-3 py-1 bg-primary text-white rounded text-sm font-medium"
                            >
                                Utiliser les courses
                            </button>
                            <button
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    setNavigating(false);
                                }}
                                className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                ),
                { duration: 5000 }
            );
        }
    }, [isEnabled, navigating, handleStartShopping]);

    const handleOpenDelivery = useCallback((deliveryId: string) => {
        if (navigating) return;

        console.log('[DeliveryHomePage] 📍 Ouverture livraison:', deliveryId);
        setNavigating(true);
        setActiveDeliveryId(deliveryId);

        try {
            navigate(`/delivery/${deliveryId}/tracking`);
            console.log('[DeliveryHomePage] ✅ Navigation réussie vers tracking');
        } catch (error: any) {
            console.error('[DeliveryHomePage] ❌ Erreur navigation:', error);
            toast.error('Impossible d\'ouvrir le suivi de livraison.');
            setNavigating(false);
        }
    }, [navigate, setActiveDeliveryId, navigating]);

    const handleRefresh = useCallback(async () => {
        if (refreshing || loading) return;

        setRefreshing(true);
        try {
            await refreshActiveDeliveries({ force: true });
            toast.success('Livraisons actualisées');
        } catch (error: any) {
            console.error('[DeliveryHomePage] Erreur actualisation:', error);
            toast.error('Erreur lors de l\'actualisation');
        } finally {
            setRefreshing(false);
        }
    }, [refreshActiveDeliveries, refreshing, loading]);

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
                            <Button
                                onClick={handleStartShopping}
                                disabled={navigating}
                                className="min-w-[200px]"
                            >
                                {navigating ? 'Chargement...' : 'Commander au supermarché'}
                            </Button>
                        </div>
                    </article>

                    {isEnabled('delivery_v2') ? (
                        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-emerald-900">Livraison de colis (beta)</h2>
                                    <p className="text-sm text-emerald-700">
                                        Expédie un colis ou un document avec le nouveau flux de livraison intelligente.
                                    </p>
                                </div>
                                <AlertCircle className="h-10 w-10 text-emerald-500" />
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button
                                    variant="outline"
                                    onClick={handleStartParcel}
                                    disabled={navigating}
                                    className="min-w-[200px]"
                                >
                                    {navigating ? 'Chargement...' : 'Tester le flux colis'}
                                </Button>
                            </div>
                        </article>
                    ) : (
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
                                <Button
                                    variant="outline"
                                    onClick={handleStartParcel}
                                    disabled={navigating}
                                    className="min-w-[200px]"
                                >
                                    {navigating ? 'Chargement...' : 'Bientôt disponible'}
                                </Button>
                            </div>
                        </article>
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-900">Vos livraisons actives</h2>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
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
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                                <PackagePlus className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="mb-2 text-base font-semibold text-slate-700">
                                Aucune livraison active
                            </h3>
                            <p className="mb-4 text-sm text-slate-500">
                                Lancez une commande supermarché pour suivre votre coursier en temps réel.
                            </p>
                            <Button
                                onClick={handleStartShopping}
                                disabled={navigating}
                                className="mx-auto"
                            >
                                {navigating ? 'Chargement...' : 'Nouvelle commande'}
                            </Button>
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


