// Wallet utilisateur — solde + recharge rapide + suivi consommation Yukpo
// Backend : GET /api/tokens/stats?days=N
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sparkles, Receipt, BarChart3, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { tokenStatsService, TokenStatsResponse, formatIntention } from '@/services/tokenStats';
import CreditBalance from '@/components/CreditBalance';

const PERIODS: Array<{ key: number; labelKey: string }> = [
  { key: 7,   labelKey: 'wallet.period.7d' },
  { key: 30,  labelKey: 'wallet.period.30d' },
  { key: 90,  labelKey: 'wallet.period.90d' },
  { key: 365, labelKey: 'wallet.period.1y' },
];

const WalletPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [days, setDays] = useState<number>(30);
  const [stats, setStats] = useState<TokenStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const data = await tokenStatsService.getStats(days);
    setStats(data);
    setLoading(false);
    setRefreshing(false);
  }, [days]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login?redirect=/wallet'); return; }
    load();
  }, [isAuthenticated, authLoading, load, navigate]);

  if (authLoading || loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Loader2 size={28} className="mx-auto animate-spin mb-2" />
        {t('wallet.loading')}
      </div>
    );
  }

  // Top 5 intentions (rubriques) par consommation tokens
  const topIntentions = Object.entries(stats?.by_intention ?? {})
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .slice(0, 8);
  const totalTokens = stats?.total_tokens_consumed ?? 0;

  const currency = user?.currency || 'XAF';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t('wallet.title')}</h1>
            <p className="text-blue-100 text-sm">{t('wallet.subtitle')}</p>
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

      <div className="max-w-screen-md mx-auto px-4 py-4 space-y-4">
        {/* Solde + bouton recharge — pointe directement sur /recharge depuis le wallet */}
        <CreditBalance variant="card" rechargeHref="/recharge" />

        {/* Sélecteur de période */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <BarChart3 size={16} />
            {t('wallet.consumptionTitle')}
          </h2>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {PERIODS.map(p => {
              const active = days === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setDays(p.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {t(p.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile label={t('wallet.totalRequests')} value={(stats?.total_requests ?? 0).toLocaleString()} accent="text-indigo-600" />
          <StatTile label={t('wallet.totalConsumed')} value={(stats?.total_tokens_consumed ?? 0).toLocaleString()} sub={t('common.xaf')} accent="text-blue-600" />
          <StatTile label={t('wallet.totalSpent')} value={`${(stats?.total_cost_xaf ?? 0).toLocaleString()}`} sub={currency} accent="text-emerald-600" />
        </div>

        {/* Breakdown par rubrique */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold">{t('wallet.byIntention')}</h3>
          </div>
          {topIntentions.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              {t('wallet.noConsumption')}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topIntentions.map(([intent, data]) => {
                const pct = totalTokens > 0 ? (data.tokens / totalTokens) * 100 : 0;
                return (
                  <li key={intent} className="px-4 py-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate flex-1">
                        {formatIntention(intent)}
                      </span>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                        {data.count.toLocaleString()} req · {data.tokens.toLocaleString()} crédits
                      </span>
                    </div>
                    {/* Bar de % */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 bg-indigo-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                      <span>{pct.toFixed(1)}%</span>
                      <span>{data.cost_xaf.toLocaleString()} {currency}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Lien historique paiements */}
        <Link
          to="/wallet/history"
          className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:bg-gray-50 transition"
        >
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-gray-500" />
            <span className="text-sm font-medium">{t('wallet.paymentHistory')}</span>
          </div>
          <span className="text-gray-400">›</span>
        </Link>

        <p className="text-[11px] text-gray-400 text-center mt-2">
          {t('wallet.disclaimer')}
        </p>
      </div>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: string | number; sub?: string; accent?: string }> = ({ label, value, sub, accent = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl shadow-sm p-3">
    <div className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{label}</div>
    <div className={`text-base font-bold ${accent}`}>{value}</div>
    {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
  </div>
);

export default WalletPage;
