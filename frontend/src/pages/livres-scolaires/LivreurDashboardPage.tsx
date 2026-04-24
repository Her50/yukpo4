import { ArrowLeft, CheckCircle, Clock, Package, RefreshCw, TrendingUp, Truck, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiGet } from '../../services/apiService';

interface Delivery {
  id: string | number;
  statut?: string;
  status?: string;
  from_address?: string;
  to_address?: string;
  package_name?: string;
  service_type?: string;
  created_at?: string;
  updated_at?: string;
  estimated_distance_km?: number;
  earning_xaf?: number;
}

interface CourierStats {
  totalDeliveries?: number;
  completedDeliveries?: number;
  totalEarnings?: number;
  currentMonthEarnings?: number;
  avgDeliveryTime?: number;
  successRate?: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  accepted: { label: 'Acceptée', color: 'bg-blue-100 text-blue-700', icon: Truck },
  accepte: { label: 'Acceptée', color: 'bg-blue-100 text-blue-700', icon: Truck },
  in_transit: { label: 'En cours', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  en_route: { label: 'En route', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
  delivered: { label: 'Livré', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  livre: { label: 'Livré', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700', icon: XCircle },
  annule: { label: 'Annulé', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const LivreurDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState<CourierStats>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [delivRes, statsRes] = await Promise.allSettled([
        apiGet('/api/deliveries/active').then(r => r.json()),
        apiGet('/api/delivery/courier/stats').then(r => r.json()),
      ]);

      if (delivRes.status === 'fulfilled') {
        const d = delivRes.value;
        setDeliveries(d?.data?.deliveries || d?.deliveries || (Array.isArray(d) ? d : []));
      }
      if (statsRes.status === 'fulfilled') {
        const s = statsRes.value;
        setStats(s?.data || s || {});
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5">
        <Truck className="w-14 h-14 text-gray-200 mb-4" />
        <p className="font-semibold text-gray-700 mb-1">Espace livreur</p>
        <p className="text-gray-400 text-sm mb-6 text-center">Connectez-vous pour accéder à votre tableau de bord</p>
        <button onClick={() => navigate('/login')} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold text-sm">
          Se connecter
        </button>
      </div>
    );
  }

  const safeStats = {
    totalDeliveries: stats.totalDeliveries ?? 0,
    completedDeliveries: stats.completedDeliveries ?? 0,
    totalEarnings: stats.totalEarnings ?? 0,
    currentMonthEarnings: stats.currentMonthEarnings ?? 0,
    successRate: stats.successRate ?? 0,
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 text-gray-500 active:text-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Tableau de bord livreur</p>
            <p className="text-xs text-gray-400">Livraisons actives et performances</p>
          </div>
        </div>
        <button onClick={() => { setRefreshing(true); loadData(); }} disabled={refreshing}>
          <RefreshCw className={`w-5 h-5 text-amber-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          {/* Stats grid */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Performances</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-amber-600">{safeStats.completedDeliveries}</p>
                <p className="text-xs text-gray-500 mt-0.5">Livraisons complétées</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-green-600">{Number(safeStats.currentMonthEarnings).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Gains ce mois (FCFA)</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-blue-600">{safeStats.successRate}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Taux de succès</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-2xl font-bold text-purple-600">{Number(safeStats.totalEarnings).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">Gains totaux (FCFA)</p>
              </div>
            </div>
          </div>

          {/* Bourse du livre quick actions */}
          <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4">
            <p className="font-semibold text-teal-800 text-sm mb-1">Parcours livres scolaires</p>
            <p className="text-xs text-teal-600 mb-3">Paquets, historique et suivi au même endroit.</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Paquets livres', icon: Package, route: '/livres-scolaires' },
                { label: 'Historique', icon: TrendingUp, route: '/livres-scolaires' },
                { label: 'Retrait', icon: CheckCircle, route: '/livres-scolaires' },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={() => navigate(btn.route)}
                  className="flex flex-col items-center gap-1.5 py-3 bg-white border border-teal-200 rounded-xl text-xs font-medium text-teal-700 active:bg-teal-50"
                >
                  <btn.icon className="w-4 h-4" />
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active deliveries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Livraisons actives
                {deliveries.length > 0 && (
                  <span className="ml-2 bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full font-normal">{deliveries.length}</span>
                )}
              </p>
            </div>

            {deliveries.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-10 flex flex-col items-center text-center">
                <Truck className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-sm text-gray-500">Aucune livraison active</p>
                <p className="text-xs text-gray-400 mt-1">Les nouvelles demandes apparaissent ici</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveries.map(d => {
                  const rawStatut = d.statut || d.status || 'pending';
                  const statInfo = STATUS_MAP[rawStatut] || { label: rawStatut, color: 'bg-gray-100 text-gray-600', icon: Clock };
                  return (
                    <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{d.package_name || `Livraison #${d.id}`}</p>
                          {d.service_type && <p className="text-xs text-gray-400">{d.service_type}</p>}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${statInfo.color}`}>
                          {statInfo.label}
                        </span>
                      </div>
                      {d.from_address && (
                        <p className="text-xs text-gray-500 mb-0.5">
                          <span className="font-medium text-gray-700">De :</span> {d.from_address}
                        </p>
                      )}
                      {d.to_address && (
                        <p className="text-xs text-gray-500 mb-1">
                          <span className="font-medium text-gray-700">Vers :</span> {d.to_address}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        {d.estimated_distance_km !== undefined && (
                          <p className="text-xs text-gray-400">{d.estimated_distance_km.toFixed(1)} km</p>
                        )}
                        {d.earning_xaf && (
                          <p className="text-xs font-bold text-green-600">{Number(d.earning_xaf).toLocaleString()} FCFA</p>
                        )}
                        {d.created_at && (
                          <p className="text-xs text-gray-400">
                            {new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LivreurDashboardPage;
