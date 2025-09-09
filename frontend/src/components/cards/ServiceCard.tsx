// @ts-check
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

interface Props {
  nom: string;
  description: string;
  categorie?: string;
  prix?: number;
  badge?: string;
  badgeColor?: string;
  note?: number;
  showNote?: boolean;
  onClick?: () => void;
  plan_requis?: 'free' | 'pro' | 'enterprise'; // ✅ Ajouté
}

const BusinessServiceCard: React.FC<Props> = ({
  nom,
  description,
  categorie,
  prix,
  badge,
  badgeColor = '#007bff',
  note = 3,
  showNote = false,
  onClick,
  plan_requis,
}) => {
  return (
    <div
      className="relative p-4 border rounded-xl shadow-md bg-white hover:shadow-lg transition"
      onClick={onClick}
    >
      {badge && (
        <div
          className="absolute top-2 right-2 text-xs px-2 py-1 text-white rounded-full font-bold"
          style={{ backgroundColor: badgeColor }}
        >
          {badge}
        </div>
      )}

      <h3 className="text-xl font-bold mb-1">{nom}</h3>
      <p className="text-sm text-gray-600 mb-2">{description}</p>

      {categorie && (
        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full inline-block mb-2">
          {categorie}
        </span>
      )}

      {prix !== undefined && (
        <p className="text-green-600 font-semibold">
          {prix.toLocaleString()} FCFA
        </p>
      )}

      {plan_requis && (
        <p className="text-xs mt-3 text-gray-500">
          Plan requis : <strong className="uppercase">{plan_requis}</strong>
        </p>
      )}

      {showNote && (
        <div className="mt-2">
          ⭐️ {note}/5
        </div>
      )}
    </div>
  );
};

export default BusinessServiceCard;
