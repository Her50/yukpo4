// src/components/services/CardService.tsx
import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

interface CardServiceProps {
  icon: string;
  title: string;
  description: string;
}

const CardService: React.FC<CardServiceProps> = ({ icon, title, description }) => (
  <div className="bg-white shadow-md rounded-lg p-5 text-center w-full max-w-xs">
    <div className="text-3xl mb-2">{icon}</div>
    <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
    <p className="text-sm text-gray-600">{description}</p>

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

export default CardService;
