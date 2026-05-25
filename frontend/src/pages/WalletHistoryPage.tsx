// Historique des recharges utilisateur — backend GET /api/payments/history
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Receipt, CheckCircle2, XCircle, Clock, Loader2,
  Smartphone, CreditCard, Plus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/services/apiService';

interface PaymentHistoryItem {
  id: number;
  amount_xaf: number;
  currency: string;
  payment_method: string;
  status: string;
  created_at: string;
  tokens_purchased: number;
}

const STATUS_META: Record<string, { labelKey: string; cls: string; Icon: any }> = {
  success:   { labelKey: 'walletHistory.status.success',   cls: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
  completed: { labelKey: 'walletHistory.status.success',   cls: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
  pending:   { labelKey: 'walletHistory.status.pending',   cls: 'bg-amber-100 text-amber-800',     Icon: Clock },
  initiated: { labelKey: 'walletHistory.status.pending',   cls: 'bg-amber-100 text-amber-800',     Icon: Clock },
  failed:    { labelKey: 'walletHistory.status.failed',    cls: 'bg-red-100 text-red-700',         Icon: XCircle },
  cancelled: { labelKey: 'walletHistory.status.cancelled', cls: 'bg-gray-100 text-gray-700',       Icon: XCircle },
};

const methodIcon = (m: string) => {
  if (m === 'visa' || m === 'card' || m === 'mastercard') return CreditCard;
  return Smartphone;
};

const methodLabel = (m: string, t: (k: string) => string): string => {
  if (m === 'mtn_momo' || m === 'mtn') return t('recharge.method.mtn');
  if (m === 'orange_money' || m === 'orange') return t('recharge.method.orange');
  if (m === 'visa' || m === 'card' || m === 'mastercard') return t('recharge.method.card');
  return m;
};

const WalletHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await apiGet('/api/payments/history?limit=50');
      const j = await r.json();
      setHistory(Array.isArray(j) ? j : (j?.data ?? []));
    } catch {
      setHistory([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login?redirect=/wallet/history'); return; }
    load();
  }, [isAuthenticated, authLoading, load, navigate]);

  if (authLoading || loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Loader2 size={28} className="mx-auto animate-spin mb-2" />
        {t('walletHistory.loading')}
      </div>
    );
  }

  // Total dépensé toutes recharges réussies confondues
  const totalRecharged = history
    .filter(p => p.status === 'success' || p.status === 'completed')
    .reduce((s, p) => s + p.amount_xaf, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t('walletHistory.title')}</h1>
            <p className="text-blue-100 text-sm">{t('walletHistory.subtitle')}</p>
          </div>
          <button
            onClick={load}
            disabled={refreshing}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
            aria-label={t('common.refresh')}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4 space-y-3">
        {/* Total */}
        {totalRecharged > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              {t('walletHistory.totalRecharged')}
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {totalRecharged.toLocaleString()} <span className="text-sm font-medium text-gray-500">XAF</span>
            </div>
          </div>
        )}

        {/* Liste paiements */}
        {history.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center">
            <Receipt size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-4">{t('walletHistory.empty')}</p>
            <Link
              to="/recharge"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              <Plus size={16} /> {t('balance.recharge')}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(p => {
              const meta = STATUS_META[p.status] || { labelKey: 'walletHistory.status.unknown', cls: 'bg-gray-100 text-gray-700', Icon: Clock };
              const StatusIcon = meta.Icon;
              const MethodIcon = methodIcon(p.payment_method);
              return (
                <div key={p.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                  <div className={`p-2 rounded-full ${meta.cls}`}>
                    <StatusIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                      <MethodIcon size={13} className="text-gray-500" />
                      {methodLabel(p.payment_method, t)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-gray-900">
                      {p.amount_xaf.toLocaleString()} <span className="text-xs font-medium text-gray-500">{p.currency}</span>
                    </div>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.cls}`}>
                      {t(meta.labelKey)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA recharger en bas si historique non vide */}
        {history.length > 0 && (
          <Link
            to="/recharge"
            className="flex items-center justify-center gap-1.5 w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 mt-2"
          >
            <Plus size={16} /> {t('walletHistory.newRecharge')}
          </Link>
        )}
      </div>
    </div>
  );
};

export default WalletHistoryPage;
