import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from '@/routes/AppRoutesRegistry';

type ApiRoute = {
  path: string;
  method: string;
  file: string;
};

type ApiRegistry = {
  backend_routes: ApiRoute[];
};

const ApiDashboardPage: React.FC = () => {
  const [routes, setRoutes] = useState<ApiRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchRegistry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/docs/api_registry.json');
      const data: ApiRegistry = await res.json();
      setRoutes(data.backend_routes);
    } catch (err) {
      console.error('Erreur chargement registry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistry();
  }, []);

  const filtered = routes.filter((r) =>
    r.path.toLowerCase().includes(filter.toLowerCase())
  );

  const routeProtected = (file: string, path: string) =>
    file.includes('protected') || path.includes('admin') || path.includes('save');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🧠 Audit des Routes API</h1>

      <div className="mb-4 flex space-x-4">
        <input
          type="text"
          className=""
          placeholder="Filtrer par path..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          onClick={fetchRegistry}
          className=""
          disabled={loading}
        >
          🔍 Rafraîchir
        </button>
      </div>

      <table className="w-full text-sm border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="">📍 Path</th>
            <th className="">⚙️ Méthode</th>
            <th className="">📂 Fichier</th>
            <th className="">🛡️ Protégé</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((route, i) => (
            <tr key={i} className="border-t">
              <td className="">{route.path}</td>
              <td className="">{route.method}</td>
              <td className="">{route.file.split('/').pop()}</td>
              <td className="">
                {routeProtected(route.file, route.path) ? '✅' : '⚠️'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className=""
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className=""
        >
          Contacter l'équipe Yukpomnang
        </a>
      </div>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </div>
  );
};

export default ApiDashboardPage;