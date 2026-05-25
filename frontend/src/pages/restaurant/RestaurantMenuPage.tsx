import { ArrowLeft, Bike, CheckCircle2, Clock, Loader2, MapPin, Package, ShoppingCart, Utensils } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost } from '@/services/apiService';

interface MenuItem {
  id: number;
  nom: string;
  description?: string;
  prix: number;
  categorie: string;
  is_disponible: boolean;
  image_url?: string;
  availability_days?: number[]; // 0=Dim … 6=Sam ; vide = tous les jours
}

/** True si le plat est disponible aujourd'hui (pas de jours définis = dispo tous les jours). */
const isAvailableToday = (days?: number[]): boolean => {
  if (!days || days.length === 0) return true;
  return days.includes(new Date().getDay());
};

const RestaurantMenuPage: React.FC = () => {
  const { t } = useTranslation();
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [panier, setPanier] = useState<Record<number, number>>({});
  const [ordering, setOrdering] = useState(false);
  const [orderDone, setOrderDone] = useState<{
    id: string;
    items: Array<{ nom: string; qty: number; total: number }>;
    total: number;
    mode: string;
    arrivalLabel: string;
    deliveryAddress?: string;
  } | null>(null);

  // ─── Mode de commande + heure d'arrivée ───
  type OrderMode = 'dine_in' | 'takeaway' | 'delivery';
  type ArrivalChoice = 'now' | '30' | '60' | 'custom';
  const [orderMode, setOrderMode] = useState<OrderMode>('dine_in');
  const [arrival, setArrival] = useState<ArrivalChoice>('30');
  const [customTime, setCustomTime] = useState(''); // "HH:MM"
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => {
    if (serviceId) loadMenu();
  }, [serviceId]);

  async function loadMenu() {
    setLoading(true);
    try {
      const res = await apiGet(`/api/restaurant/public/${serviceId}/menu`, { isAuthenticated: false });
      const data = await res.json();
      setMenu(Array.isArray(data) ? data : data.items || data.menu || []);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  function add(item: MenuItem) { setPanier(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 })); }
  function remove(item: MenuItem) {
    setPanier(p => {
      const n = { ...p };
      if (n[item.id] > 1) n[item.id]--;
      else delete n[item.id];
      return n;
    });
  }

  const panierItems = menu.filter(i => panier[i.id] > 0);
  const total = panierItems.reduce((s, i) => s + i.prix * panier[i.id], 0);

  // Filtre dur : un plat indisponible aujourd'hui n'apparaît jamais (côté UX,
  // le backend reste source de vérité ; on n'altère ni le panier ni les commandes existantes).
  const visibleMenu = useMemo(
    () => menu.filter(i => isAvailableToday(i.availability_days)),
    [menu],
  );
  const categories = [...new Set(visibleMenu.map(i => i.categorie || 'Menu'))];

  /** Calcule l'heure d'arrivée prévue selon le choix UI. Retourne null si "Maintenant". */
  const computeArrivalTime = (): Date | null => {
    if (arrival === 'now') return null;
    if (arrival === '30') return new Date(Date.now() + 30 * 60_000);
    if (arrival === '60') return new Date(Date.now() + 60 * 60_000);
    if (arrival === 'custom' && customTime) {
      const [h, m] = customTime.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      const d = new Date();
      d.setHours(h, m, 0, 0);
      // si l'heure est déjà passée aujourd'hui → demain
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d;
    }
    return null;
  };

  /** Format "HH:MM" lisible. */
  const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;

  const arrivalDate = computeArrivalTime();
  const modeLabel = ((): string => {
    if (orderMode === 'dine_in') return t('restoMenuPage.cart.modeDineIn');
    if (orderMode === 'takeaway') return t('restoMenuPage.cart.modeTakeaway');
    return t('restoMenuPage.cart.modeDelivery');
  })();

  async function commander() {
    if (!user) { navigate('/login'); return; }
    if (!panierItems.length) return;
    if (orderMode === 'delivery' && !deliveryAddress.trim()) {
      toast({ title: t('restoMenuPage.addressRequired'), description: t('restoMenuPage.addressRequiredDesc'), variant: 'destructive' });
      return;
    }
    if (arrival === 'custom' && !customTime) {
      toast({ title: t('restoMenuPage.timeRequired'), description: t('restoMenuPage.timeRequiredDesc'), variant: 'destructive' });
      return;
    }
    setOrdering(true);
    try {
      const items = panierItems.map(i => ({
        menu_item_id: i.id,
        item_name: i.nom,
        item_price: i.prix,
        quantity: panier[i.id],
      }));

      const payload: any = {
        items,
        order_type: orderMode,
        // Champ structuré (backend ≥ migration 20260508_001). Anciens backends ignorent.
        requested_arrival_time: arrivalDate ? arrivalDate.toISOString() : null,
        // Notes utilisateur en clair (sans préfixe technique). Le backend stocke tel quel.
        notes: orderNotes.trim() || null,
      };
      if (orderMode === 'delivery') payload.delivery_address = deliveryAddress.trim();
      if (clientPhone.trim()) payload.client_phone = clientPhone.trim();

      const res = await apiPost(`/api/restaurant/public/${serviceId}/order`, payload);
      const data = await res.json();
      const orderId = String(data.id || data.order_id || data?.data?.order_id || 'OK');
      setOrderDone({
        id: orderId,
        items: panierItems.map(i => ({ nom: i.nom, qty: panier[i.id], total: i.prix * panier[i.id] })),
        total,
        mode: modeLabel,
        arrivalLabel: arrivalDate ? fmtTime(arrivalDate) : t('restoMenuPage.cart.arrivalNow'),
        deliveryAddress: orderMode === 'delivery' ? deliveryAddress : undefined,
      });
      setPanier({});
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setOrdering(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-32">
      <div className="sticky top-0 bg-white border-b z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-bold text-gray-800 flex-1">Menu</h1>
        {panierItems.length > 0 && (
          <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {panierItems.length}
          </span>
        )}
      </div>

      {orderDone && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4" onClick={() => setOrderDone(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Bandeau succès */}
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('restoMenuPage.orderConfirmed')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('restoMenuPage.orderConfirmedSub')}</p>
            </div>

            {/* Numéro de commande — gros, lisible, à présenter en cas de retrait */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 mb-4 text-center">
              <div className="text-xs text-orange-700 uppercase tracking-wide font-semibold mb-1">{t('restoMenuPage.orderNumber')}</div>
              <div className="text-2xl font-mono font-bold text-orange-700">#{orderDone.id}</div>
              <p className="text-[11px] text-orange-700/80 mt-1.5">{t('restoMenuPage.keepNumber')}</p>
            </div>

            {/* Récap mode + heure */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{t('restoMenuPage.mode')}</div>
                <div className="font-semibold text-gray-800">{orderDone.mode}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{orderDone.deliveryAddress ? t('restoMenuPage.deliveryTo') : t('restoMenuPage.arrival')}</div>
                <div className="font-semibold text-gray-800">{orderDone.arrivalLabel}</div>
              </div>
            </div>

            {orderDone.deliveryAddress && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{t('restoMenuPage.addressLabel')}</div>
                <div className="text-gray-800">{orderDone.deliveryAddress}</div>
              </div>
            )}

            {/* Récap items */}
            <div className="border-t border-gray-100 pt-3 space-y-1.5 mb-3">
              {orderDone.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">{it.qty}× {it.nom}</span>
                  <span className="font-medium text-gray-900">{it.total.toLocaleString()} {t('common.fcfa')}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center border-t pt-3 mb-4">
              <span className="font-bold text-gray-900">{t('restoMenuPage.total')}</span>
              <span className="font-bold text-orange-600 text-lg">{orderDone.total.toLocaleString()} {t('common.fcfa')}</span>
            </div>

            {/* Info préparation */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-900">
              {t('restoMenuPage.preparingInfo', {
                when: orderDone.arrivalLabel !== t('restoMenuPage.cart.arrivalNow')
                  ? t('restoMenuPage.preparingFor', { time: orderDone.arrivalLabel })
                  : t('restoMenuPage.preparingNow'),
              })}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setOrderDone(null)}
                variant="outline"
                className="flex-1"
              >
                {t('common.close')}
              </Button>
              <Button
                onClick={() => navigate('/commandes')}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {t('restoMenuPage.viewMyOrders')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {menu.length === 0 && (
        <p className="text-center text-gray-400 py-12">{t('restoMenuPage.menuUnavailable')}</p>
      )}

      {menu.length > 0 && visibleMenu.length === 0 && (
        <p className="text-center text-gray-500 py-12 px-4 text-sm">
          {t('restoMenuPage.noToday')}
        </p>
      )}

      {categories.map(cat => {
        const items = visibleMenu.filter(i => (i.categorie || 'Menu') === cat);
        return (
          <div key={cat}>
            <h2 className="font-semibold text-gray-600 px-4 py-2 bg-gray-50 text-sm uppercase tracking-wide">{cat}</h2>
            <div className="divide-y divide-gray-50">
              {items.map(item => {
                const qty = panier[item.id] || 0;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.nom} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{item.nom}</p>
                      {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>}
                      <p className="text-orange-500 font-semibold text-sm mt-1">{item.prix?.toLocaleString()} FCFA</p>
                    </div>
                    {item.is_disponible !== false ? (
                      <div className="flex items-center gap-1 shrink-0">
                        {qty > 0 && (
                          <>
                            <button onClick={() => remove(item)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold">−</button>
                            <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                          </>
                        )}
                        <button onClick={() => add(item)} className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-lg font-bold">+</button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 shrink-0">{t('restoMenuPage.indispo')}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {panierItems.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 z-20">
          <Card className="shadow-lg border-orange-200">
            <CardContent className="p-3 space-y-3">
              {/* Récap items */}
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {panierItems.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate">{i.nom} × {panier[i.id]}</span>
                    <span className="font-medium whitespace-nowrap ml-2">{(i.prix * panier[i.id]).toLocaleString()} FCFA</span>
                  </div>
                ))}
              </div>

              {/* Mode de commande */}
              <div className="flex gap-1">
                {([
                  { v: 'dine_in',  l: t('restoMenuPage.cart.modeDineIn'),   I: Utensils },
                  { v: 'takeaway', l: t('restoMenuPage.cart.modeTakeaway'), I: Package },
                  { v: 'delivery', l: t('restoMenuPage.cart.modeDelivery'), I: Bike },
                ] as const).map(o => {
                  const Icon = o.I;
                  const active = orderMode === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setOrderMode(o.v)}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] font-medium border transition ${
                        active ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 bg-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {o.l}
                    </button>
                  );
                })}
              </div>

              {/* Heure d'arrivée / souhaitée */}
              <div>
                <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" />
                  {t('restoMenuPage.cart.arrivalLabel', { mode: orderMode === 'delivery' ? t('restoMenuPage.cart.modeDelivery') : t('restoMenuPage.arrival') })}
                </label>
                <div className="flex gap-1">
                  {([
                    { v: 'now',    l: t('restoMenuPage.cart.arrivalNow') },
                    { v: '30',     l: t('restoMenuPage.cart.arrivalIn30') },
                    { v: '60',     l: t('restoMenuPage.cart.arrivalIn60') },
                    { v: 'custom', l: t('restoMenuPage.cart.arrivalCustom') },
                  ] as const).map(o => {
                    const active = arrival === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setArrival(o.v)}
                        className={`flex-1 px-1 py-1.5 rounded-md text-[11px] font-medium border transition ${
                          active ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 bg-white'
                        }`}
                      >
                        {o.l}
                      </button>
                    );
                  })}
                </div>
                {arrival === 'custom' && (
                  <input
                    type="time"
                    value={customTime}
                    onChange={e => setCustomTime(e.target.value)}
                    className="mt-1.5 w-full p-2 rounded-md border border-orange-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                )}
                {arrivalDate && (
                  <p className="text-[10px] text-emerald-700 mt-1">
                    {t('restoMenuPage.cart.arrivalConfirm', { time: fmtTime(arrivalDate) })}
                  </p>
                )}
              </div>

              {/* Adresse de livraison (si delivery) */}
              {orderMode === 'delivery' && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder={t('restoMenuPage.cart.addressPlaceholder')}
                    className="w-full p-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder={t('restoMenuPage.cart.phonePlaceholder')}
                    className="w-full p-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              )}

              {/* Notes optionnelles */}
              <input
                type="text"
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder={t('restoMenuPage.cart.notesPlaceholder')}
                className="w-full p-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
              />

              {/* Total + bouton */}
              <div className="flex justify-between items-center border-t pt-2">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">{modeLabel}{arrivalDate ? ` · ${fmtTime(arrivalDate)}` : ''}</div>
                  <div className="font-bold text-orange-500 text-base">{total.toLocaleString()} {t('common.fcfa')}</div>
                </div>
                <Button onClick={commander} disabled={ordering} className="bg-orange-500 hover:bg-orange-600 text-white px-5">
                  <ShoppingCart className="h-4 w-4 mr-1.5" />
                  {ordering ? t('restoMenuPage.cart.ordering') : user ? t('restoMenuPage.cart.order') : t('restoMenuPage.cart.loginToOrder')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RestaurantMenuPage;
