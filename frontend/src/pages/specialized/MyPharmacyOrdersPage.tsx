// Page "Mes commandes" — côté client pharmacie.
// Suivi temps réel + QR code de retrait pour les commandes prêtes.
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, ChevronRight, ShoppingBag, Clock, CheckCircle2, XCircle,
  QrCode, Loader2, Truck, Pill,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { pharmacyPartner, PharmacyOrder } from '@/services/pharmacyPartner';

const STATUS_META: Record<string, { labelKey: string; cls: string; icon: any }> = {
  pending:     { labelKey: 'clientOrders.status.pending',       cls: 'bg-amber-100 text-amber-800',     icon: Clock },
  confirmed:   { labelKey: 'clientOrders.status.confirmed',     cls: 'bg-blue-100 text-blue-800',       icon: CheckCircle2 },
  processing:  { labelKey: 'clientOrders.status.preparing',     cls: 'bg-violet-100 text-violet-800',   icon: Pill },
  ready:       { labelKey: 'clientOrders.status.readyToPickup', cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  in_delivery: { labelKey: 'clientOrders.status.in_delivery',   cls: 'bg-cyan-100 text-cyan-800',       icon: Truck },
  delivered:   { labelKey: 'clientOrders.status.delivered',     cls: 'bg-emerald-200 text-emerald-900', icon: CheckCircle2 },
  cancelled:   { labelKey: 'clientOrders.status.cancelled',     cls: 'bg-red-100 text-red-700',         icon: XCircle },
};

const MyPharmacyOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ orderId: string; code?: string; loading: boolean } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const r = await pharmacyPartner.getMyOrders(1, 30);
    setOrders(r.orders);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { navigate('/login?redirect=/commandes'); return; }
    load();
  }, [isAuthenticated, isLoading, load, navigate]);

  // Auto-refresh 30 s tant qu'au moins une commande est active
  useEffect(() => {
    const hasActive = orders.some(o => !['delivered', 'cancelled'].includes(o.status || ''));
    if (!hasActive) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [orders, load]);

  const handleShowQr = async (orderId: string) => {
    setQrModal({ orderId, loading: true });
    const data = await pharmacyPartner.getOrderQrForClient(orderId);
    setQrModal({ orderId, code: data?.qr_code, loading: false });
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
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('clientOrders.title')}</h1>
            <p className="text-emerald-100 text-sm">{t('clientOrders.subtitlePharma')}</p>
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
            <p className="text-gray-500 mb-4">{t('clientOrders.emptyPharma')}</p>
            <Link to="/" className="inline-block px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
              {t('clientOrders.findMed')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const meta = STATUS_META[o.status || ''];
              const stLabel = meta ? t(meta.labelKey) : (o.status || '—');
              const stCls = meta?.cls ?? 'bg-gray-100 text-gray-700';
              const Icon = meta?.icon ?? Clock;
              const isOpen = expanded === o.id;
              const canShowQr = o.status === 'ready' && o.delivery_method === 'pickup';

              return (
                <div key={o.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    className="w-full p-4 text-left flex items-center gap-3 hover:bg-gray-50"
                  >
                    <Icon size={22} className="text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{o.pharmacy_name || 'Pharmacie'}</div>
                      <div className="text-xs text-gray-500">
                        {t('clientOrders.orderNum', { id: o.id.slice(0, 8) })} · {new Date(o.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-emerald-700 whitespace-nowrap">
                        {Number(o.total_amount || 0).toLocaleString()} XAF
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
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div><span className="text-gray-400">{t('clientOrders.method')}</span> {o.delivery_method === 'delivery' ? t('clientOrders.delivery') : t('clientOrders.pickup')}</div>
                        {o.delivery_address && (
                          <div className="col-span-2"><span className="text-gray-400">{t('clientOrders.address')}</span> {o.delivery_address}</div>
                        )}
                      </div>

                      {canShowQr && (
                        <button
                          onClick={() => handleShowQr(o.id)}
                          className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700"
                        >
                          <QrCode size={16} /> {t('clientOrders.showQr')}
                        </button>
                      )}

                      {!['delivered', 'cancelled'].includes(o.status || '') && (
                        <p className="text-xs text-gray-500 text-center">
                          {t('clientOrders.autoRefreshPharma')}
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

      {/* Modal QR */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">{t('clientOrders.qrTitle')}</h3>
            {qrModal.loading ? (
              <Loader2 size={32} className="mx-auto animate-spin text-emerald-600 my-8" />
            ) : qrModal.code ? (
              <>
                <p className="text-sm text-gray-500 mb-3">{t('clientOrders.qrSubtitle')}</p>
                <div className="bg-emerald-50 rounded-lg p-6 mb-4">
                  <div className="font-mono text-2xl font-bold text-emerald-800 break-all">{qrModal.code}</div>
                </div>
                <p className="text-xs text-gray-500">{t('clientOrders.qrOrderNum', { id: qrModal.orderId.slice(0, 8) })}</p>
              </>
            ) : (
              <p className="text-red-600 my-6">{t('clientOrders.qrUnavailable')}</p>
            )}
            <button
              onClick={() => setQrModal(null)}
              className="mt-4 w-full py-2.5 rounded-lg border border-gray-300 font-semibold hover:bg-gray-50"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPharmacyOrdersPage;
