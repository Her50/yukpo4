/**
 * Composant DeliveryBadge - Affiche les indicateurs de disponibilité et livraison
 * Utilisé dans ProductCard pour afficher les badges de disponibilité
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { productDeliveryService } from '@/services/productDeliveryService';
import { AlertTriangle, Calendar, CheckCircle, Clock, Zap } from 'lucide-react';
import React from 'react';

interface DeliveryBadgeProps {
    deliveryConfig?: {
        is_immediately_available?: boolean;
        preparation_time_minutes?: number;
        availability_days?: number[];
        cancellation_rate?: number;
    };
    serviceId?: number;
    productIndex?: number;
}

export const DeliveryBadge: React.FC<DeliveryBadgeProps> = ({
    deliveryConfig,
    serviceId,
    productIndex,
}) => {
    if (!deliveryConfig && (!serviceId || productIndex === undefined)) {
        return null;
    }

    const badges: React.ReactNode[] = [];

    // Badge "⚡ Livraison rapide" si is_immediately_available = TRUE
    if (deliveryConfig?.is_immediately_available) {
        badges.push(
            <TooltipProvider key="immediate">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 border-green-300 hover:bg-green-200 transition-colors"
                        >
                            <Zap className="w-3 h-3 mr-1" />
                            Livraison rapide
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Disponible immédiatement - Livraison en moins de 30 min</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Badge "⏱️ Prêt en X min" si preparation_time_minutes > 0
    if (deliveryConfig?.preparation_time_minutes && deliveryConfig.preparation_time_minutes > 0) {
        const timeFormatted = productDeliveryService.formatPreparationTime(
            deliveryConfig.preparation_time_minutes
        );
        badges.push(
            <TooltipProvider key="preparation">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200 transition-colors"
                        >
                            <Clock className="w-3 h-3 mr-1" />
                            Prêt en {timeFormatted}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Temps de préparation estimé : {timeFormatted}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Badge "📅 Disponible [jours]" si availability_days est défini
    if (deliveryConfig?.availability_days && deliveryConfig.availability_days.length > 0) {
        const daysFormatted = productDeliveryService.formatAvailabilityDays(
            deliveryConfig.availability_days
        );
        badges.push(
            <TooltipProvider key="availability">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="secondary"
                            className="bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200 transition-colors"
                        >
                            <Calendar className="w-3 h-3 mr-1" />
                            Disponible {daysFormatted}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Disponible : {productDeliveryService.formatAvailabilityDaysFull(deliveryConfig.availability_days)}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Badge "⚠️ Taux d'annulation" (en haut à gauche)
    if (deliveryConfig?.cancellation_rate !== undefined) {
        const cancellationBadge = productDeliveryService.getCancellationBadge(
            deliveryConfig.cancellation_rate
        );
        if (cancellationBadge.show) {
            badges.push(
                <TooltipProvider key="cancellation">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge
                                variant="outline"
                                className={`${cancellationBadge.color} border-2 hover:opacity-80 transition-opacity`}
                            >
                                {deliveryConfig.cancellation_rate >= 30 ? (
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                ) : deliveryConfig.cancellation_rate < 5 ? (
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                ) : (
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                )}
                                {cancellationBadge.label}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Taux d'annulation basé sur les commandes récentes</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }
    }

    if (badges.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {badges}
        </div>
    );
};

// Badge de taux d'annulation positionné en haut à gauche (position absolue)
export const CancellationBadgeAbsolute: React.FC<{ cancellationRate?: number }> = ({
    cancellationRate,
}) => {
    if (cancellationRate === undefined) {
        return null;
    }

    const badge = productDeliveryService.getCancellationBadge(cancellationRate);
    if (!badge.show) {
        return null;
    }

    return (
        <div className="absolute top-2 left-2 z-10">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="outline"
                            className={`${badge.color} border-2 hover:opacity-80 transition-opacity shadow-md`}
                        >
                            {cancellationRate >= 30 ? (
                                <AlertTriangle className="w-3 h-3 mr-1" />
                            ) : cancellationRate < 5 ? (
                                <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                                <AlertTriangle className="w-3 h-3 mr-1" />
                            )}
                            {badge.label}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Taux d'annulation basé sur les commandes récentes</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};

