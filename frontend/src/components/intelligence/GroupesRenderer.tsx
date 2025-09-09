import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Groupe {
  nom: string;
  ordre: number;
  champs: string[];
  arret_apres: boolean;
}

export const GroupesRenderer: React.FC = () => {
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroupes = async () => {
      try {
        const res = await axios.post('/api/yukpo/input-context', {
          // Optionnel : re-déclenchement avec contexte statique ou vide
        });
        if (res.data.groupes) {
          setGroupes(res.data.groupes);
        } else {
          setError("Aucun groupe généré.");
        }
      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement des groupes.");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupes();
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Chargement des groupes IA...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      {groupes.map((groupe, index) => (
        <div key={index} className="p-4 border rounded-xl bg-white shadow-sm dark:bg-gray-800">
          <h2 className="font-semibold text-lg text-blue-600">
            🧠 {groupe.nom} (Ordre {groupe.ordre})
          </h2>
          <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300">
            {groupe.champs.map((champ, idx) => (
              <li key={idx}>📌 {champ}</li>
            ))}
          </ul>
          {groupe.arret_apres && (
            <p className="text-red-500 text-sm mt-2">⛔ Arrêt après ce groupe</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default GroupesRenderer;
