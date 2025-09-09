// src/components/services/ServiceTemplateCard.tsx
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

interface Props {
  title: string;
  variations: string[];
}

const ServiceTemplateCard: React.FC<Props> = ({ title, variations }) => (
  <div className="p-4 border rounded shadow bg-white">
    <h3 className="text-lg font-bold">{title}</h3>
    <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
      {variations.map((v, i) => (
        <li key={i}>{v}</li>
      ))}
    </ul>

    {/* 🚀 CONTEXTUAL BUTTONS */}
    <div className="mt-6 flex flex-wrap gap-4 justify-center">
      <a
        href={ROUTES.SERVICES}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
      >
        découvrir d'autres services
      </a>
      <a
        href={ROUTES.PLANS}
        className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
      >
        Voir les formules
      </a>
      <a
        href={ROUTES.CONTACT}
        className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
      >
        contacter l'équipe yukpomnang
      </a>
    </div>
  </div>
);

export default ServiceTemplateCard;
