// @generated
import React from 'react';
import { useServiceVariation } from '@/hooks/useServiceVariation';

interface ServiceVariation {
  price: number;
  availability: boolean;
  new?: boolean;
}

interface VariationAlertProps {
  serviceId: number;
}

const VariationAlert: React.FC<VariationAlertProps> = ({ serviceId }) => {
  const variation = useServiceVariation(serviceId) as { data?: ServiceVariation };

  if (!variation?.data) return <p>Chargement...</p>;

  const { price, availability, new: isNew } = variation.data;

  return (
    <div className="p-4 border rounded-md bg-yellow-50 text-yellow-800">
      <h3 className="font-semibold mb-2">🔔 Alerte sur la variation du service</h3>
      <p>
        💰 <strong>Prix :</strong> {price.toLocaleString()} FCFA
      </p>
      <p>
        📦 <strong>Disponibilité :</strong>{' '}
        {availability ? 'Disponible' : 'Indisponible'}
      </p>
      {isNew && <p>🆕 Ce service est tout nouveau !</p>}
    </div>
  );
};

export default VariationAlert;
