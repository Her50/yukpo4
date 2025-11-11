import React from 'react';

interface DeliveryMapPlaceholderProps {
    height?: number;
}

export const DeliveryMapPlaceholder: React.FC<DeliveryMapPlaceholderProps> = ({ height = 320 }) => {
    return (
        <div
            className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500"
            style={{ minHeight: height }}
        >
            Carte en cours d’intégration — les positions coursier/destinataire s’afficheront ici.
        </div>
    );
};

export default DeliveryMapPlaceholder;


