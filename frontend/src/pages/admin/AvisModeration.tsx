import React, { useEffect, useState } from 'react';
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from 'axios';

type Avis = {
  id: number;
  user_id: number;
  note: number;
  commentaire: string;
};

const AvisModeration: React.FC = () => {
  const [avis, setAvis] = useState<Avis[]>([]);

  useEffect(() => {
    axios
      .get('/api/notations/en-attente')
      .then((res) => setAvis(res.data))
      .catch((err) => console.error("Erreur chargement avis :", err));
  }, []);

  const updateAvis = (id: number, action: 'approuver' | 'rejeter') => {
    axios
      .get(`/api/notations/${id}/${action}`)
      .then(() => setAvis((prev) => prev.filter((a) => a.id !== id)))
      .catch((err) => console.error(`Erreur lors de l'action ${action} :`, err));
  };

  return (
    <ResponsiveContainer className="py-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        📝 Modération des avis clients
      </h2>

      {avis.map((a) => (
        <div key={a.id} className="border p-4 mb-4 rounded shadow-sm bg-white">
          <p className="text-yellow-600 font-semibold">Note : {a.note} ★</p>
          <p className="text-gray-700 mb-4 italic">"{a.commentaire}"</p>
          <div className="flex gap-4">
            <button
              onClick={() => updateAvis(a.id, 'approuver')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              ✅ Approuver
            </button>
            <button
              onClick={() => updateAvis(a.id, 'rejeter')}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              ❌ Rejeter
            </button>
          </div>
        </div>
      ))}

      {avis.length === 0 && (
        <p className="text-gray-500 text-center italic">Aucun avis en attente de modération.</p>
      )}
    </ResponsiveContainer>
  );
};

export default AvisModeration;
