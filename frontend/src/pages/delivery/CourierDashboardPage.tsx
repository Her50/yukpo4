import DeliveryLiveMap from '@/components/delivery/DeliveryLiveMap';
import DeliveryTimeline from '@/components/delivery/DeliveryTimeline';
import CourierLayout from '@/components/layout/CourierLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import useCourierShopping from '@/hooks/useCourierShopping';
import useDeliveryTracking from '@/hooks/useDeliveryTracking';
import { updateShoppingItem, updateShoppingStatus } from '@/services/shoppingApi';
import formatCurrency from '@/utils/formatCurrency';
import { Navigation2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';

const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    awaiting_courier: 'bg-amber-100 text-amber-700',
    assigned: 'bg-blue-100 text-blue-700',
    en_route_pickup: 'bg-sky-100 text-sky-700',
    shopping_pending: 'bg-emerald-100 text-emerald-700',
    shopping_in_progress: 'bg-emerald-100 text-emerald-700',
    shopping_completed: 'bg-emerald-100 text-emerald-700',
    en_route_delivery: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-emerald-200 text-emerald-800',
    cancelled: 'bg-rose-100 text-rose-700',
};

const shoppingStatusLabel: Record<string, string> = {
    pending: 'En attente',
    awaiting_purchase: 'Client doit valider',
    shopping_in_progress: 'Courses en cours',
    shopping_completed: 'Panier validé',
    checkout_submitted: 'Ticket soumis',
    cancelled: 'Annulée',
};

const CourierDashboardPage: React.FC = () => {
    const { deliveryId } = useParams<{ deliveryId: string }>();
    const navigate = useNavigate();
    const [workingItem, setWorkingItem] = useState<string | null>(null);
    const [submittingStatus, setSubmittingStatus] = useState(false);

    const {
        delivery,
        timeline,
        events,
        refresh,
        loading,
    } = useDeliveryTracking(deliveryId ?? null);

    const courierFeed = useCourierShopping(deliveryId ?? null);

    useEffect(() => {
        if (deliveryId) {
            refresh({ force: true }).catch(console.error);
        }
    }, [deliveryId, refresh]);

    const shoppingItems = delivery?.shopping?.items ?? [];
    const currency = delivery?.pricing?.currency ?? delivery?.shopping?.currency ?? 'XAF';

    const handleUpdateItem = async (itemId: string, status: string) => {
        if (!delivery?.orderId) {
            toast.error('Commande supermarché introuvable pour cette livraison.');
            return;
        }
        setWorkingItem(itemId);
        try {
            await updateShoppingItem(delivery.orderId, itemId, { status });
            toast.success('Article mis à jour.');
            await refresh({ force: true });
        } catch (error) {
            console.error('[CourierDashboardPage] updateShoppingItem', error);
            toast.error('Impossible de mettre à jour cet article.');
        } finally {
            setWorkingItem(null);
        }
    };

    const handleCompleteShopping = async () => {
        if (!delivery?.orderId) {
            toast.error('Commande supermarché introuvable.');
            return;
        }
        setSubmittingStatus(true);
        try {
            await updateShoppingStatus(delivery.orderId, { status: 'shopping_completed' });
            toast.success('Statut panier mis à jour.');
            await refresh({ force: true });
        } catch (error) {
            console.error('[CourierDashboardPage] updateShoppingStatus', error);
            toast.error('Impossible de mettre à jour le statut panier.');
        } finally {
            setSubmittingStatus(false);
        }
    };

    const statusBadge = useMemo(() => {
        const status = delivery?.status ?? 'pending';
        const color = statusColors[status] ?? 'bg-slate-200 text-slate-700';
        return <Badge className={color}>{status.replace(/_/g, ' ')}</Badge>;
    }, [delivery?.status]);

    if (!deliveryId) {
        return (
            <CourierLayout pageTitle="Tableau de bord" showBack={false}>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                    <p className="text-sm text-slate-500">Aucun identifiant de livraison fourni.</p>
                    <Button className="mt-4" onClick={() => navigate('/delivery')}>
                        Retour à la livraison
                    </Button>
                </div>
            </CourierLayout>
        );
    }

    if (!delivery && loading) {
        return (
            <CourierLayout pageTitle="Tableau de bord" showBack={false}>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">
                    Chargement du tableau de bord coursier…
                </div>
            </CourierLayout>
        );
    }

    if (!delivery) {
        return (
            <CourierLayout pageTitle="Tableau de bord" showBack={false}>
                <div className="mx-auto max-w-3xl px-4 py-16 text-center">
                    <p className="text-sm text-slate-500">Impossible de trouver cette livraison.</p>
                    <Button className="mt-4" onClick={() => navigate('/delivery')}>
                        Retour à la livraison
                    </Button>
                </div>
            </CourierLayout>
        );
    }

    return (
        <CourierLayout pageTitle="Tableau de bord" showBack={false}>
            <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 pt-6">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm text-slate-500">Livraison #{delivery.id.slice(-6)}</p>
                        <h1 className="text-2xl font-semibold text-slate-900">
                            Tableau de bord coursier
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {statusBadge}
                            <span>
                                Statut shopping:{' '}
                                {shoppingStatusLabel[
                                    courierFeed.shoppingStatus?.toLowerCase() ?? ''
                                ] ?? '—'}
                            </span>
                            <span>
                                Connexion temps réel :{' '}
                                <strong>{courierFeed.connectionState.toUpperCase()}</strong>
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* ✅ NOUVEAU : Bouton navigation pour le coursier */}
                        <Button
                            variant="primary"
                            onClick={async () => {
                                try {
                                    const { getCourierNavigation } = await import('@/services/deliveryApi');
                                    const navigation = await getCourierNavigation(delivery.id);

                                    // Ouvrir Google Maps avec les directions
                                    const origin = `${navigation.origin.latitude},${navigation.origin.longitude}`;
                                    const destination = `${navigation.destination.latitude},${navigation.destination.longitude}`;
                                    const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;
                                    window.open(googleMapsUrl, '_blank');
                                } catch (error: any) {
                                    console.error('[CourierDashboardPage] Erreur navigation:', error);
                                    toast.error('Impossible d\'ouvrir la navigation');
                                }
                            }}
                        >
                            <Navigation2 className="w-4 h-4 mr-2" />
                            Navigation GPS
                        </Button>
                        <Button variant="outline" onClick={() => refresh({ force: true })}>
                            Rafraîchir
                        </Button>
                        <Link to={`/delivery/${delivery.id}/tracking`}>
                            <Button variant="ghost">Vue client</Button>
                        </Link>
                    </div>
                </header>

                <section className="grid gap-4 lg:grid-cols-2">
                    <DeliveryLiveMap delivery={delivery} events={events} height={360} />
                    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">Informations clés</h2>
                        <div className="grid gap-3 text-sm text-slate-600">
                            <p>
                                <strong>Client :</strong>{' '}
                                {delivery.recipient?.name ?? delivery.dropoff.label ?? 'Client Yukpo'}
                            </p>
                            <p>
                                <strong>Retrait :</strong> {delivery.pickup.label ?? 'Supermarché'}{' '}
                                {delivery.pickup.address ? `— ${delivery.pickup.address}` : ''}
                            </p>
                            <p>
                                <strong>Livraison :</strong>{' '}
                                {delivery.dropoff.label ?? delivery.recipient?.name ?? 'Non précisé'}{' '}
                                {delivery.dropoff.address ? `— ${delivery.dropoff.address}` : ''}
                            </p>
                            <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
                                <span>
                                    Dernière position coursier :{' '}
                                    {courierFeed.lastLocation
                                        ? `${courierFeed.lastLocation.latitude.toFixed(5)}, ${courierFeed.lastLocation.longitude.toFixed(5)}`
                                        : 'Aucune position reçue'}
                                </span>
                                <span>
                                    Dernier événement :{' '}
                                    {courierFeed.events[0]?.timestamp
                                        ? new Date(
                                            courierFeed.events[0].timestamp ?? '',
                                        ).toLocaleTimeString('fr-FR')
                                        : '—'}
                                </span>
                            </div>
                            {courierFeed.pricing ? (
                                <div className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                                    <p className="font-semibold">
                                        Estimation livraison:{' '}
                                        {formatCurrency(
                                            courierFeed.pricing.base_price_cents / 100 +
                                            courierFeed.pricing.distance_price_cents / 100,
                                            courierFeed.pricing.currency ?? 'XAF',
                                        )}
                                    </p>
                                    <p>
                                        Avance courses :{' '}
                                        {formatCurrency(
                                            (courierFeed.pricing.shopping_cost_cents ?? 0) / 100,
                                            courierFeed.pricing.currency ?? 'XAF',
                                        )}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-slate-900">Checklist panier</h2>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>
                                Articles validés :{' '}
                                <strong>
                                    {shoppingItems.filter(item => item.status === 'purchased').length}/
                                    {shoppingItems.length}
                                </strong>
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCompleteShopping}
                                disabled={submittingStatus}
                            >
                                Panier complété
                            </Button>
                        </div>
                    </div>

                    {shoppingItems.length === 0 ? (
                        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
                            Aucun article dans le panier pour cette livraison.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Article</th>
                                        <th className="px-4 py-3">Quantité</th>
                                        <th className="px-4 py-3">Prix estimé</th>
                                        <th className="px-4 py-3">Statut</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                    {shoppingItems.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{item.productName}</div>
                                                {item.note ? (
                                                    <div className="text-xs text-slate-500">
                                                        Note client : {item.note}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.quantity} {item.unit}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.estimatedPriceCents
                                                    ? formatCurrency(item.estimatedPriceCents / 100, currency)
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    className={
                                                        item.status === 'purchased'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : item.status === 'missing'
                                                                ? 'bg-rose-100 text-rose-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                    }
                                                >
                                                    {(item.status ?? 'pending').replace(/_/g, ' ')}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        disabled={workingItem === item.id}
                                                        onClick={() => handleUpdateItem(item.id, 'purchased')}
                                                    >
                                                        Acheté
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        disabled={workingItem === item.id}
                                                        onClick={() => handleUpdateItem(item.id, 'missing')}
                                                    >
                                                        Manquant
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="xs"
                                                        disabled={workingItem === item.id}
                                                        onClick={() => handleUpdateItem(item.id, 'replaced')}
                                                    >
                                                        Remplacé
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
                        <span className="text-xs text-slate-500">{timeline.length} événements</span>
                    </div>
                    <div className="mt-4 max-h-96 overflow-y-auto pr-2">
                        <DeliveryTimeline checkpoints={timeline} />
                    </div>
                </section>

            </div>
        </CourierLayout>
    );
};

export default CourierDashboardPage;

