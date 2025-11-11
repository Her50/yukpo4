import { DeliveryCheckpoint } from '@/types/delivery';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Circle, Dot } from 'lucide-react';
import React from 'react';

interface DeliveryTimelineProps {
    checkpoints: DeliveryCheckpoint[];
}

const statusLabel: Record<string, string> = {
    pending: 'Commande créée',
    awaiting_courier: 'Recherche coursier',
    assigned: 'Coursier assigné',
    en_route_pickup: 'En route supermarché',
    shopping_pending: 'Arrivé au supermarché',
    shopping_in_progress: 'Courses en cours',
    shopping_completed: 'Panier validé',
    en_route_delivery: 'En route client',
    delivered: 'Livraison terminée',
    cancelled: 'Commande annulée',
};

export const DeliveryTimeline: React.FC<DeliveryTimelineProps> = ({ checkpoints }) => {
    const sorted = [...checkpoints].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return (
        <div className="space-y-4">
            {sorted.map((step, index) => {
                const isLast = index === sorted.length - 1;
                return (
                    <div key={`${step.status}-${step.timestamp}`} className="flex gap-4">
                        <div className="relative flex flex-col items-center">
                            {index === 0 ? <Circle className="h-4 w-4 text-primary" /> : <Dot className="h-4 w-4 text-primary" />}
                            {!isLast && <span className="mx-auto h-full w-px bg-slate-200" />}
                        </div>
                        <div className="pb-4">
                            <p className="font-medium text-slate-800">
                                {statusLabel[step.status] ?? step.status}
                            </p>
                            <p className="text-xs text-slate-500">
                                {format(new Date(step.timestamp), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                            </p>
                            {step.note ? (
                                <p className="mt-1 text-sm text-slate-600">
                                    {step.note}
                                </p>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DeliveryTimeline;


