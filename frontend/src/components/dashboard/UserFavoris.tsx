import React, { useEffect, useState } from 'react';
import { ROUTES } from '@/routes/AppRoutesRegistry'; // ✅ Import ajouté

type Favori = {
  id: number;
  user_id: number;
  service_id: number;
  created_at: string;
};

interface UserFavorisProps {
  userId: number;
}

const UserFavoris: React.FC<UserFavorisProps> = ({ userId }) => {
  const [favoris, setFavoris] = useState<Favori[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/favoris/${userId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Erreur réseau lors du chargement des favoris.');
        }
        return res.json();
      })
      .then((data) => {
        setFavoris(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold mb-4">💖 Vos services favoris</h2>

      {loading && <p>Chargement des favoris...</p>}
      {error && <p className="text-red-500">⚠️ {error}</p>}

      {!loading && !error && favoris.length === 0 && (
        <p className="text-gray-500">Aucun favori encore.</p>
      )}

      {!loading && !error && favoris.length > 0 && (
        <ul className="space-y-2">
          {favoris.map((fav) => (
            <li key={fav.id} className="p-2 rounded border border-gray-200">
              Service ID : {fav.service_id}
            </li>
          ))}
        </ul>
      )}

      {/* 🚀 CONTEXTUAL BUTTONS intégrés */}
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
};

export default UserFavoris;
