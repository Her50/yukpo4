import React, { useEffect, useState } from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry';

interface Suggestion {
  nom: string;
  plan: string;
}

interface Props {
  serviceId: number;
}

const SuggestionsContextuelles: React.FC<Props> = ({ serviceId }) => {
  const [related, setRelated] = useState<Suggestion[]>([]);

  useEffect(() => {
    fetch(`/api/services/${serviceId}/related`)
      .then((res) => res.json())
      .then((data) => setRelated(data))
      .catch((err) => console.error("Erreur chargement suggestions :", err));
  }, [serviceId]);

  if (!related.length) return null;

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="text-sm font-semibold mb-2">🔗 Autres services utiles :</h3>
      <ul className="list-disc ml-4 text-sm text-gray-600">
        {related.map((s, idx) => (
          <li key={idx}>
            {s.nom} <span className="text-gray-400">({s.plan})</span>
          </li>
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
};

export default SuggestionsContextuelles;
