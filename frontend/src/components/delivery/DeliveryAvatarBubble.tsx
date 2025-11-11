import React from 'react';

export interface DeliveryAvatarBubbleProps {
    message?: string;
    subtitle?: string;
}

export const DeliveryAvatarBubble: React.FC<DeliveryAvatarBubbleProps> = ({
    message = 'Livraison intelligente Yukpo',
    subtitle = 'Suivi temps réel, notifications destinataire, gestion complète du coursier.',
}) => {
    return (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white text-xl">
                🚚
            </div>
            <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">{message}</p>
                <p className="text-sm text-slate-600">{subtitle}</p>
            </div>
        </div>
    );
};

export default DeliveryAvatarBubble;


