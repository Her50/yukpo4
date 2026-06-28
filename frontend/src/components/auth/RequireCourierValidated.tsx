// ✅ 2026-05-19 — Guard pour les pages réservées aux coursiers validés.
// Appelle `GET /api/courier/me` au montage et :
//   - laisse passer si `is_courier` est true ET `courier.status == 'Active'`
//     (l'admin a approuvé la candidature et créé une row dans `couriers`)
//   - redirige vers /courier/register sinon (candidat doit s'inscrire OU
//     attendre la validation admin)
//
// À utiliser pour /courier/my-deliveries, /courier/bourse-livre,
// /courier/dashboard/:id et toute page coursier sensible.

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiGet } from '@/services/apiService';

interface RequireCourierValidatedProps {
  children: React.ReactNode;
}

type CheckState =
  | { status: 'loading' }
  | { status: 'allowed' }
  | { status: 'unauthorized'; reason: string };

const RequireCourierValidated: React.FC<RequireCourierValidatedProps> = ({ children }) => {
  const location = useLocation();
  const [state, setState] = useState<CheckState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiGet('/courier/me');
        const data: any = await r.json();
        if (cancelled) return;
        if (data?.is_courier && data?.courier?.status?.toLowerCase() === 'active') {
          setState({ status: 'allowed' });
        } else if (data?.application?.status) {
          const appStatus = String(data.application.status).toLowerCase();
          setState({
            status: 'unauthorized',
            reason: `Candidature ${appStatus}`,
          });
        } else {
          setState({
            status: 'unauthorized',
            reason: 'Aucune candidature coursier',
          });
        }
      } catch (e: any) {
        if (cancelled) return;
        // En cas d'erreur réseau / 401, on traite comme unauthorized
        // pour rediriger plutôt que laisser un écran vide.
        setState({
          status: 'unauthorized',
          reason: e?.message ?? 'Erreur de vérification',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-slate-600 text-sm">Vérification compte coursier…</p>
      </div>
    );
  }

  if (state.status === 'unauthorized') {
    // 2026-06-28 — Route corrigée : la page d'inscription coursier vit à
    // `/become-courier` (pas `/courier/register` qui n'existe pas, ni dans
    // App.tsx ni dans AppBourse).
    const target = `/become-courier?from=${encodeURIComponent(
      location.pathname,
    )}&reason=${encodeURIComponent(state.reason)}`;
    return <Navigate to={target} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireCourierValidated;
