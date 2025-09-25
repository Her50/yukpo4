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
    <View style="p-6">
      <h1 style="text-2xl font-bold mb-4">🧠 Audit des Routes API</h1>

      <View style="mb-4 flex space-x-4">
        <TextInput
          type="text"
          style=""
          placeholder="Filtrer par path..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <TouchableOpacity
          onClick={fetchRegistry}
          style=""
          disabled={loading}
        >
          🔍 Rafraîchir
        </TouchableOpacity>
      </View>

      <table style="w-full text-sm border border-gray-300">
        <thead style="bg-gray-100">
          <tr>
            <th style="">📍 Path</th>
            <th style="">⚙️ Méthode</th>
            <th style="">📂 Fichier</th>
            <th style="">🛡️ Protégé</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((route, i) => (
            <tr key={i} style="border-t">
              <td style="">{route.path}</td>
              <td style="">{route.method}</td>
              <td style="">{route.file.split('Home').pop()}</td>
              <td style="">
                {routeProtected(route.file, route.path) ? '✅' : '⚠️'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <View style="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          style=""
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          style=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          style=""
        >
          Contacter l'équipe Yukpomnang
        </a>
      </View>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </View>
  );
};

export default ApiDashboardPage;
