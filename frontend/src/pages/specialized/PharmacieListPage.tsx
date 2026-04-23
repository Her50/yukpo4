import { ArrowLeft, MapPin, Phone, Pill, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '../../services/apiService';

interface Pharmacie {
  id: number;
  service_id: number;
  nom: string;
  ville?: string;
  quartier?: string;
  is_available_now: boolean;
  is_on_duty: boolean;
  telephone?: string;
  distance_km?: number;
  nom_produit?: string;
  prix?: number;
}

const PharmacieListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const filters = (location.state as any)?.filters || {};

  const [pharmacies, setPharmacies] = useState<Pharmacie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { loadPharmacies(); }, []);

  const loadPharmacies = async (isRefresh = false) => {
    try {
      if (isRefresh) { setRefreshing(true); setPage(1); } else { setLoading(true); }
      const currentPage = isRefresh ? 1 : page;
      const qp = new URLSearchParams();
      if (filters.ville) qp.append('ville', filters.ville);
      if (filters.quartier) qp.append('quartier', filters.quartier);
      if (filters.lat) qp.append('lat', filters.lat.toString());
      if (filters.lng) qp.append('lng', filters.lng.toString());
      if (filters.max_distance_km) qp.append('max_distance_km', filters.max_distance_km.toString());
      if (filters.on_duty_only) qp.append('on_duty_only', 'true');
      if (filters.available_only) qp.append('available_only', 'true');
      qp.append('page', currentPage.toString());
      qp.append('limit', '20');

      const hasProductSearch = Boolean(filters.product_search);
      const response = hasProductSearch
        ? await apiGet(`/api/medicines/nearby?q=${encodeURIComponent(filters.product_search)}${filters.lat ? `&lat=${filters.lat}` : ''}${filters.lng ? `&lng=${filters.lng}` : ''}${filters.max_distance_km ? `&radius_km=${filters.max_distance_km}` : ''}${filters.on_duty_only ? '&on_duty_only=true' : ''}&limit=20`)
        : await apiGet(`/api/pharmacies/search?${qp.toString()}`);
      const data = await response.json();

      if (data.success) {
        const newPharmacies = hasProductSearch
          ? (data.items || []).map((item: any) => ({
              id: item.pharmacy_id || item.id,
              service_id: item.pharmacy_service_id || item.service_id,
              nom: item.pharmacy_nom || 'Pharmacie',
              ville: item.ville, quartier: item.quartier,
              is_available_now: true, is_on_duty: !!item.is_on_duty_now,
              telephone: item.telephone, distance_km: item.distance_km,
              nom_produit: item.nom_produit, prix: item.prix,
            }))
          : (data.data?.data || []);
        if (isRefresh || currentPage === 1) setPharmacies(newPharmacies);
        else setPharmacies(prev => [...prev, ...newPharmacies]);
        setHasMore(newPharmacies.length === 20);
      } else {
        toast({ title: 'Aucun résultat', description: 'Aucune pharmacie trouvée pour ces critères', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erreur de chargement', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading && pharmacies.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-10">
          <button onClick={() => navigate(-1)} className="p-1 text-gray-500"><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-semibold text-gray-800">Pharmacies</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
            <p className="text-gray-500 text-sm">Chargement des pharmacies...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 text-gray-500 active:text-gray-800"><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-semibold text-gray-800">
            {loading ? 'Chargement...' : `${pharmacies.length} pharmacie${pharmacies.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        <button
          onClick={() => loadPharmacies(true)}
          disabled={refreshing}
          className="p-2 text-blue-600 active:text-blue-800"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {pharmacies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Pill className="w-14 h-14 text-gray-300 mb-4" />
          <p className="font-semibold text-gray-700 mb-1">Aucune pharmacie trouvée</p>
          <p className="text-gray-400 text-sm mb-6">Modifiez vos critères de recherche</p>
          <button
            onClick={() => navigate('/search')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium text-sm"
          >
            Nouvelle recherche
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {pharmacies.map((p) => (
            <div
              key={p.id}
              className="bg-white px-4 py-4 flex items-start gap-3 active:bg-gray-50 cursor-pointer"
              onClick={() => navigate(`/${p.id}`)}
            >
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${p.is_available_now ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{p.nom}</p>
                  {p.is_on_duty && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0 font-medium">Garde</span>
                  )}
                </div>
                {(p.ville || p.quartier) && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[p.quartier, p.ville].filter(Boolean).join(', ')}
                    {p.distance_km !== undefined && ` · ${p.distance_km.toFixed(1)} km`}
                  </p>
                )}
                {p.nom_produit && (
                  <p className="text-xs text-indigo-600 mt-0.5">
                    {p.nom_produit}{p.prix ? ` · ${Number(p.prix).toLocaleString()} FCFA` : ''}
                  </p>
                )}
                {p.telephone && (
                  <a
                    href={`tel:${p.telephone}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-blue-600 flex items-center gap-1 mt-1 w-fit"
                  >
                    <Phone className="w-3 h-3" /> {p.telephone}
                  </a>
                )}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="py-4 text-center">
              <button
                onClick={() => { setPage(p => p + 1); loadPharmacies(); }}
                disabled={loading}
                className="text-blue-600 text-sm font-medium px-6 py-2 border border-blue-200 rounded-xl"
              >
                {loading ? 'Chargement...' : 'Voir plus'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PharmacieListPage;
