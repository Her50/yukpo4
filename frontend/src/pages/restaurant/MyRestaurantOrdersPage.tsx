// Page "Mes commandes" — côté client restaurant.
// Liste les commandes du client connecté avec statut, total, items, suivi temps-réel.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, ChevronRight, ShoppingBag, Clock, CheckCircle2, XCircle,
  Star, Loader2, Footprints,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { restaurantManagement, RestaurantOrder } from '@/services/restaurantManagement';

const STATUS_META: Record<string, { labelKey: string; cls: string; icon: any }> = {
  pending:   { labelKey: 'clientOrders.status.pending',    cls: 'bg-amber-100 text-amber-800',     icon: Clock },
  accepted:  { labelKey: 'clientOrders.status.accepted',   cls: 'bg-blue-100 text-blue-800',       icon: CheckCircle2 },
  preparing: { labelKey: 'clientOrders.status.preparing',  cls: 'bg-violet-100 text-violet-800',   icon: Clock },
  ready:     { labelKey: 'clientOrders.status.ready',      cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  completed: { labelKey: 'clientOrders.status.completed',  cls: 'bg-gray-100 text-gray-700',       icon: CheckCircle2 },
  cancelled: { labelKey: 'clientOrders.status.cancelled',  cls: 'bg-red-100 text-red-700',         icon: XCircle },
};

const MyRestaurantOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rating, setRating] = useState<{ orderId: number; value: number; comment: string } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const data = await restaurantManagement.clientOrderHistory();
    setOrders(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { navigate('/login?redirect=/commandes'); return; }
    load();
  }, [isAuthenticated, isLoading, load, navigate]);

  // Auto-refresh toutes les 30 s pour les commandes en cours
  useEffect(() => {
    const hasActive = orders.some(o => !['completed', 'cancelled'].includes(o.status));
    if (!hasActive) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [orders, load]);

  const handleSubmitRating = async () => {
    if (!rating) return;
    await restaurantManagement.rateOrder(rating.orderId, rating.value, rating.comment);
    setRating(null);
    load();
  };

  if (isLoading || loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Loader2 size={28} className="mx-auto animate-spin mb-2" />
        {t('clientOrders.loading')}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('clientOrders.title')}</h1>
            <p className="text-red-100 text-sm">{t('clientOrders.subtitleResto')}</p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
            aria-label={t('common.refresh')}
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center">
            <ShoppingBag size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-4">{t('clientOrders.empty')}</p>
            <Link to="/" className="inline-block px-5 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">
              {t('clientOrders.discoverResto')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const meta = STATUS_META[o.status];
              const stLabel = meta ? t(meta.labelKey) : o.status;
              const stCls = meta?.cls ?? 'bg-gray-100 text-gray-700';
              const Icon = meta?.icon ?? Clock;
              const isOpen = expanded === o.id;
              const restaurantName = (o as any).restaurant_name || (o as any).service_name || 'Restaurant';
              const isFinished = ['completed', 'cancelled'].includes(o.status);

              return (
                <div key={o.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    className="w-full p-4 text-left flex items-center gap-3 hover:bg-gray-50"
                  >
                    <Icon size={22} className="text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{restaurantName}</div>
                      <div className="text-xs text-gray-500">
                        {t('clientOrders.orderNum', { id: o.id })} · {new Date(o.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-red-700 whitespace-nowrap">
                        {Number(o.total_amount).toLocaleString()} {t('common.xaf')}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${stCls}`}>
                        {stLabel}
                      </span>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                      {/* Items */}
                      <div className="space-y-1">
                        {o.items?.length ? o.items.map((it, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              {it.quantity}× {it.item_name}
                              {it.notes && <span className="block text-xs text-gray-500 italic">↳ {it.notes}</span>}
                            </span>
                            <span className="text-gray-600 whitespace-nowrap ml-2">
                              {(Number(it.item_price) * it.quantity).toLocaleString()} XAF
                            </span>
                          </div>
                        )) : <p className="text-sm text-gray-500">Aucun détail disponible</p>}
                      </div>

                      {/* Infos complémentaires */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 border-t pt-2">
                        <div><span className="text-gray-400">{t('clientOrders.type')}</span> {o.order_type || '—'}</div>
                        {o.estimated_ready_at && (
                          <div><span className="text-gray-400">{t('clientOrders.ready')}</span> {new Date(o.estimated_ready_at).toLocaleTimeString()}</div>
                        )}
                        {o.notes && (
                          <div className="col-span-2"><span className="text-gray-400">{t('clientOrders.note')}</span> {o.notes}</div>
                        )}
                      </div>

                      {/* Phase A — Bouton "Je suis en route" : visible entre T-30 et T-5 min */}
                      {(() => {
                        if (!o.requested_arrival_time) return null;
                        if (['ready', 'completed', 'cancelled'].includes(o.status)) return null;
                        if (o.arrival_confirmed_at) {
                          return (
                            <div className="w-full py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold text-sm flex items-center justify-center gap-1.5">
                              <CheckCircle2 size={16} /> {t('clientOrders.youConfirmed')}
                            </div>
                          );
                        }
                        const arrivalMs = new Date(o.requested_arrival_time).getTime();
                        const minLeft = (arrivalMs - Date.now()) / 60000;
                        // Visible dans la fenêtre [-5min ; +30min] avant l'arrivée prévue
                        if (minLeft > 30 || minLeft < -5) return null;
                        return (
                          <button
                            onClick={async () => {
                              const ok = await restaurantManagement.confirmArrival(o.id);
                              if (ok) load();
                            }}
                            className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-blue-700 shadow-sm"
                          >
                            <Footprints size={18} /> {t('clientOrders.iAmOnRoute')}
                          </button>
                        );
                      })()}

                      {/* Actions */}
                      {o.status === 'completed' && !(o as any).rated && (
                        <button
                          onClick={() => setRating({ orderId: o.id, value: 5, comment: '' })}
                          className="w-full py-2 rounded-lg border border-amber-300 text-amber-800 bg-amber-50 font-semibold text-sm flex items-center justify-center gap-1 hover:bg-amber-100"
                        >
                          <Star size={16} /> {t('clientOrders.rate')}
                        </button>
                      )}
                      {!isFinished && (
                        <p className="text-xs text-gray-500 text-center">
                          {t('clientOrders.autoRefresh')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal notation */}
      {rating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setRating(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{t('clientOrders.ratingTitle')}</h3>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v}
                  onClick={() => setRating({ ...rating, value: v })}
                  className="p-1"
                  aria-label={`${v} étoiles`}
                >
                  <Star
                    size={32}
                    className={v <= rating.value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={rating.comment}
              onChange={e => setRating({ ...rating, comment: e.target.value })}
              placeholder={t('clientOrders.ratingPlaceholder')}
              rows={3}
              className="w-full p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 mb-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRating(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 font-semibold hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmitRating}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                {t('clientOrders.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyRestaurantOrdersPage;
