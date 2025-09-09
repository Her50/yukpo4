import React from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry'; // ✅ Import des routes ajouté

export function MesServicesList() {
  const services = [
    {
      id: 1,
      nom: 'Publication Immobilier',
      statut: 'actif',
      renouvelable: true,
    },
    {
      id: 2,
      nom: 'Analyse Marché',
      statut: 'expiré',
      renouvelable: true,
    },
  ];

  return (
    <div className="space-y-4">
      {services.map((s) => (
        <div key={s.id} className="p-4 rounded-md border shadow-sm">
          <div className="font-medium">{s.nom}</div>
          <div className="text-sm text-gray-500">
            Statut : {s.statut}
          </div>
          {s.renouvelable && (
            <button className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
              Renouveler
            </button>
          )}
        </div>
      ))}

      {/* 🚀 CONTEXTUAL BUTTONS intégrés correctement */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center border-t pt-6">
        <a
          href={ROUTES.SERVICES}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
        >
          Découvrir d'autres services
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
          Contacter l'équipe Yukpomnang
        </a>
      </div>
    </div>
  );
}

export default MesServicesList;
