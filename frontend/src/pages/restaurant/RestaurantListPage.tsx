import { CheckCircle, ChevronRight, Clock, Loader2, MapPin, Search, Star, UtensilsCrossed, X, Briefcase } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/services/apiService';

const VILLES = ['Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Bamenda', 'Maroua', 'Ngaoundéré', 'Bertoua', 'Ebolowa', 'Kribi'];

type SearchMode = 'restaurant' | 'plat';
type Tab = 'restaurants' | 'commandes';

interface Restaurant {
  id: number;
  service_id: number;
  nom?: string;
  name?: string;
  service_name?: string;
  ville?: string;
  city?: string;
  quartier?: string;
  image_url?: string;
  note_moyenne?: number;
  cuisine_type?: string;
  is_open?: boolean;
}

interface PlatResult {
  id: number;
  service_id: number;
  nom: string;
  description?: string | null;
  prix: number;
  categorie?: string | null;
  image_url?: string | null;
  restaurant_name: string;
  city?: string | null;
  accepts_delivery?: boolean;
  accepts_dine_in?: boolean;
}

interface Order {
  id: number;
  restaurant_name?: string;
  statut?: string;
  total_xaf?: number;
  created_at?: string;
  items?: Array<{ nom_plat?: string; quantite?: number; prix_unitaire?: number }>;
}

const ORDER_STATUT_LABEL: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  accepte: { label: 'Acceptée', color: 'bg-blue-100 text-blue-700' },
  en_preparation: { label: 'En préparation', color: 'bg-indigo-100 text-indigo-700' },
  pret: { label: 'Prête', color: 'bg-purple-100 text-purple-700' },
  livre: { label: 'Livrée', color: 'bg-green-100 text-green-700' },
  complete: { label: 'Complétée', color: 'bg-green-100 text-green-700' },
  annule: { label: 'Annulée', color: 'bg-red-100 text-red-700' },
};

const RestaurantListPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isPartner } = useAuth();

  const [tab, setTab] = useState<Tab>('restaurants');
  const [searchMode, setSearchMode] = useState<SearchMode>('restaurant');
  const [query, setQuery] = useState('');
  const [ville, setVille] = useState('');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [plats, setPlats] = useState<PlatResult[]>([]);
  const [resultMode, setResultMode] = useState<'restaurant' | 'plat'>('restaurant'); // type des résultats actuellement affichés
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => { fetchRestaurants('', ''); }, []);

  useEffect(() => {
    if (tab === 'commandes' && user && orders.length === 0) {
      fetchOrders();
    }
  }, [tab, user]);

  async function fetchRestaurants(q: string, v: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (v) params.set('ville', v);
      const useSearch = Boolean(q);
      const isPlatSearch = searchMode === 'plat' && useSearch;
      let endpoint: string;
      if (isPlatSearch) {
        // Backend attend `?type=menu` (cf. PublicSearchParams::search_type via #[serde(rename="type")])
        endpoint = `/api/restaurant/public/search?${params}&type=menu`;
      } else if (useSearch) {
        endpoint = `/api/restaurant/public/search?${params}`;
      } else {
        endpoint = `/api/restaurant/public/list?${params}`;
      }
      const res = await apiGet(endpoint, { isAuthenticated: false });
      const data = await res.json();

      // Réponse search : { success, type: "menu"|"restaurant", results: [...] }
      // Réponse list : { restaurants: [...] } ou similaire
      const items = Array.isArray(data) ? data : data.results || data.restaurants || data.data || [];

      if (isPlatSearch && data?.type === 'menu') {
        setPlats(items as PlatResult[]);
        setRestaurants([]);
        setResultMode('plat');
      } else {
        setRestaurants(items as Restaurant[]);
        setPlats([]);
        setResultMode('restaurant');
      }
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  async function fetchOrders() {
    setOrdersLoading(true);
    try {
      const res = await apiGet('/api/restaurant/public/orders/history');
      const data = await res.json();
      setOrders(data?.data?.orders || data?.orders || []);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setOrdersLoading(false); }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchRestaurants(query, ville);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-orange-400">
      <div className="px-5 pt-10 pb-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <UtensilsCrossed className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Restaurants</h1>
        </div>
        <p className="text-orange-100 text-sm">Commandez près de chez vous</p>

        {/* CTA partenaire restaurateur — visible si pas déjà partenaire */}
        {!isPartner && (
          <Link
            to="/partenaire/inscription"
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition border border-white/20"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Vous êtes restaurateur ? Devenez partenaire
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="bg-white rounded-t-3xl min-h-screen pb-24">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-4 mb-0">
          <button
            onClick={() => setTab('restaurants')}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'restaurants' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`}
          >
            Restaurants
          </button>
          <button
            onClick={() => { setTab('commandes'); if (user && orders.length === 0) fetchOrders(); }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === 'commandes' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'}`}
          >
            Mes commandes
          </button>
        </div>

        {tab === 'restaurants' && (
          <div className="px-4 pt-4">
            {/* Search mode toggle */}
            <div className="flex gap-2 mb-3">
              {(['restaurant', 'plat'] as SearchMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setSearchMode(mode)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${searchMode === mode ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-500 bg-white'}`}
                >
                  {mode === 'restaurant' ? 'Par restaurant' : 'Par plat / cuisine'}
                </button>
              ))}
            </div>

            {/* Search form */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                  placeholder={searchMode === 'restaurant' ? 'Nom du restaurant...' : 'Plat, cuisine (ex: Ndolé, Poulet...)'}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(''); fetchRestaurants('', ville); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <button type="submit" className="bg-orange-500 active:bg-orange-600 text-white px-4 py-3 rounded-xl font-medium text-sm">
                OK
              </button>
            </form>

            {/* City chips */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
              <button
                onClick={() => { setVille(''); fetchRestaurants(query, ''); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ville === '' ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 bg-white'}`}
              >
                Toutes les villes
              </button>
              {VILLES.map(v => (
                <button
                  key={v}
                  onClick={() => { setVille(v); fetchRestaurants(query, v); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ville === v ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 bg-white'}`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Results */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : resultMode === 'plat' ? (
              plats.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-gray-200 mb-3" />
                  <p className="text-gray-500 text-sm">Aucun plat trouvé</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2 px-1">{plats.length} plat{plats.length > 1 ? 's' : ''} trouvé{plats.length > 1 ? 's' : ''}</p>
                  <div className="space-y-3">
                    {plats.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:shadow-md cursor-pointer transition-shadow"
                        onClick={() => navigate(`/${p.service_id}/menu`)}
                      >
                        <div className="flex gap-3 p-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.nom} className="w-24 h-24 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-24 h-24 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                              <UtensilsCrossed className="w-8 h-8 text-orange-300" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1">{p.nom}</h3>
                              <span className="text-orange-600 font-bold text-sm whitespace-nowrap shrink-0">
                                {Number(p.prix).toLocaleString()} FCFA
                              </span>
                            </div>
                            {p.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                            )}
                            <div className="mt-auto pt-1 flex items-center gap-1.5 flex-wrap">
                              {p.categorie && (
                                <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                                  {p.categorie}
                                </span>
                              )}
                              <span className="text-xs text-gray-600 font-medium truncate">{p.restaurant_name}</span>
                              {p.city && (
                                <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {p.city}
                                </span>
                              )}
                              {p.accepts_delivery && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Livraison</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : restaurants.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <UtensilsCrossed className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-500 text-sm">Aucun restaurant trouvé</p>
              </div>
            ) : (
              <div className="space-y-3">
                {restaurants.map((r, i) => (
                  <div
                    key={r.id || r.service_id || i}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden active:shadow-md cursor-pointer transition-shadow"
                    onClick={() => navigate(`/${r.service_id || r.id}/menu`)}
                  >
                    {r.image_url && (
                      <img src={r.image_url} alt={r.nom || r.name || r.service_name} className="w-full h-44 object-cover" />
                    )}
                    <div className="px-4 py-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{r.nom || r.name || r.service_name}</h3>
                        {(r.quartier || r.ville || r.city) && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {[r.quartier, r.ville || r.city].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {r.cuisine_type && (
                          <span className="inline-block mt-1.5 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">{r.cuisine_type}</span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {r.note_moyenne ? (
                          <span className="flex items-center gap-0.5 text-yellow-500 text-sm font-semibold">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {parseFloat(String(r.note_moyenne)).toFixed(1)}
                          </span>
                        ) : null}
                        {r.is_open === false && <span className="text-xs text-red-400 block mt-0.5">Fermé</span>}
                        {r.is_open === true && <span className="text-xs text-green-500 block mt-0.5">Ouvert</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'commandes' && (
          <div className="px-4 pt-4">
            {!user ? (
              <div className="flex flex-col items-center py-16 text-center">
                <UtensilsCrossed className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-700 font-semibold mb-1">Connectez-vous pour voir vos commandes</p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-4 bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold"
                >
                  Se connecter
                </button>
              </div>
            ) : ordersLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <UtensilsCrossed className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-500 text-sm">Aucune commande pour l'instant</p>
                <button
                  onClick={() => setTab('restaurants')}
                  className="mt-4 bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold"
                >
                  Commander maintenant
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(order => {
                  const statut = ORDER_STATUT_LABEL[order.statut || ''] || { label: order.statut || '?', color: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{order.restaurant_name || 'Restaurant'}</p>
                          {order.created_at && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${statut.color}`}>
                          {statut.label}
                        </span>
                      </div>
                      {order.items && order.items.length > 0 && (
                        <div className="text-xs text-gray-500 mb-2 space-y-0.5">
                          {order.items.slice(0, 3).map((item, j) => (
                            <p key={j}>× {item.quantite || 1} {item.nom_plat}</p>
                          ))}
                          {order.items.length > 3 && <p className="text-gray-400">+{order.items.length - 3} autres</p>}
                        </div>
                      )}
                      {order.total_xaf && (
                        <p className="font-bold text-orange-600 text-sm">{Number(order.total_xaf).toLocaleString()} FCFA</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantListPage;
