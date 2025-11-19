import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DeliverySummary } from '@/types/delivery';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCircle, MapPin, Navigation2, Package, ShoppingCart, User } from 'lucide-react';
import React from 'react';

const statusConfig: Record<
    string,
    { label: string; color: string; icon: React.ReactNode; badgeClass?: string }
> = {
    pending: { label: 'En attente', color: 'text-amber-600', icon: <Package className="h-4 w-4" /> },
    awaiting_courier: {
        label: 'Recherche coursier',
        color: 'text-amber-600',
        icon: <Package className="h-4 w-4" />,
    },
    assigned: { label: 'Coursier assigné', color: 'text-sky-600', icon: <Package className="h-4 w-4" /> },
    en_route_pickup: {
        label: 'En route supermarché',
        color: 'text-sky-600',
        icon: <Navigation2 className="h-4 w-4" />,
    },
    shopping_pending: {
        label: 'Arrivé au supermarché',
        color: 'text-emerald-600',
        icon: <ShoppingCart className="h-4 w-4" />,
    },
    shopping_in_progress: {
        label: 'Courses en cours',
        color: 'text-emerald-600',
        icon: <ShoppingCart className="h-4 w-4" />,
    },
    shopping_completed: {
        label: 'Panier validé',
        color: 'text-emerald-600',
        icon: <ShoppingCart className="h-4 w-4" />,
    },
    en_route_delivery: {
        label: 'En route client',
        color: 'text-indigo-600',
        icon: <Navigation2 className="h-4 w-4" />,
    },
    delivered: {
        label: 'Livré',
        color: 'text-emerald-600',
        icon: <Navigation2 className="h-4 w-4" />,
    },
    cancelled: {
        label: 'Annulé',
        color: 'text-rose-600',
        icon: <Package className="h-4 w-4" />,
    },
};

interface ActiveDeliveryCardProps {
    delivery: DeliverySummary;
    onClick: (deliveryId: string) => void;
}

export const ActiveDeliveryCard: React.FC<ActiveDeliveryCardProps> = ({ delivery, onClick }) => {
    const status = statusConfig[delivery.status] ?? statusConfig.pending;
    const updatedAt =
        delivery.lastEventAt ??
        delivery.checkpoints[delivery.checkpoints.length - 1]?.timestamp ??
        null;

    const relativeTime = updatedAt
        ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: fr })
        : 'Jamais';

    // ✅ Phase 9 - Amélioration 30 : Vérifier si dropoff est pending
    const dropoffPending = delivery.metadata?.dropoff_pending === true;

    return (
        <Card className="flex flex-col gap-4 border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <Badge variant={delivery.kind === 'shopping' ? 'default' : 'outline'}>
                    {delivery.kind === 'shopping' ? 'Courses supermarché' : 'Livraison colis'}
                </Badge>
                <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', status.color)}>
                    {status.icon}
                    {status.label}
                </span>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                    <ShoppingCart className="mt-1 h-4 w-4 text-slate-400" />
                    <div>
                        <p className="font-medium text-slate-800">
                            {delivery.pickup?.label ?? 'Supermarché non précisé'}
                        </p>
                        <p className="text-slate-500">{delivery.pickup?.address ?? 'Adresse non renseignée'}</p>
                    </div>
                </div>

                <div className="flex items-start gap-2">
                    <MapPin className={cn("mt-1 h-4 w-4", dropoffPending ? "text-amber-500" : "text-slate-400")} />
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-slate-800">
                                {delivery.dropoff?.label ?? 'Destinataire'}
                            </p>
                            {/* ✅ Phase 9 - Amélioration 30 : Badge "Adresse à confirmer" si dropoff pending */}
                            {dropoffPending && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Adresse à confirmer
                                </Badge>
                            )}
                        </div>
                        <p className={cn("text-sm", dropoffPending ? "text-amber-600 italic" : "text-slate-500")}>
                            {delivery.dropoff?.address ?? 'Adresse non renseignée'}
                        </p>
                    </div>
                </div>

                {delivery.recipient?.name ? (
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <p className="text-slate-600">{delivery.recipient.name}</p>
                    </div>
                ) : null}
            </div>

            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <span>Dernière mise à jour</span>
                <span className="font-medium text-slate-700">{relativeTime}</span>
            </div>

            <div className="flex justify-between gap-2">
                {/* ✅ Phase 9 - Amélioration 30 : Bouton "Modifier l'adresse" toujours visible */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onClick(delivery.id)}
                    className="flex-1"
                >
                    <MapPin className="w-4 h-4 mr-1" />
                    Modifier l'adresse
                </Button>
                <Button variant="default" size="sm" onClick={() => onClick(delivery.id)}>
                    Suivre
                </Button>
            </div>
        </Card>
    );
};

export default ActiveDeliveryCard;


