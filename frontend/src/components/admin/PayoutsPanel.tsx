// ✅ 2026-05-15 PR #4 — Panel admin pour traiter les demandes de payout cash.
//
// Affiche :
//   - Cartes "Treasury Summary" (revenu net distingué de la dette wallet)
//   - Tableau filtrable des demandes (pending → approved → paid | rejected)
//   - Actions par ligne : Approuver, Marquer payé (avec ref MoMo), Rejeter
//
// Convention auth : RequireAccess + middleware backend admin check.

import { Banknote, Check, Loader2, RefreshCw, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '../../services/apiService';

interface TreasurySummary {
  total_wallet_outstanding_xaf: number;
  total_payouts_pending_xaf: number;
  total_payouts_paid_xaf: number;
  total_referral_bonus_credited_xaf: number;
  pending_count: number;
}

interface PayoutRequest {
  id: number;
  user_id: number;
  amount_xaf: number;
  operator: 'orange_money' | 'mtn_momo' | string;
  phone_e164: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | string;
  admin_note?: string | null;
  payout_ref?: string | null;
  requested_at: string;
  paid_at?: string | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'rejected';

const PayoutsPanel: React.FC = () => {
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [items, setItems] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = filter === 'all' ? '' : `?status=${filter}`;
      const [sumRes, listRes] = await Promise.all([
        apiGet('/api/admin/wallet/treasury-summary'),
        apiGet(`/api/admin/wallet/payouts${params}`),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (listRes.ok) {
        const j = await listRes.json();
        setItems(j.items ?? []);
      }
    } catch {
      // silencieux
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onApprove = async (id: number) => {
    const note = window.prompt('Note interne (optionnelle, ex: "KYC vérifié"):', '') || undefined;
    try {
      const res = await apiPost(`/api/admin/wallet/payouts/${id}/approve`, { note });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erreur approve');
        return;
      }
      toast.success('Demande approuvée');
      void load();
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const onMarkPaid = async (id: number) => {
    const ref = window.prompt(
      'Référence transaction mobile money (ex: ABCD1234) — OBLIGATOIRE :',
      '',
    );
    if (!ref || !ref.trim()) {
      toast.error('Référence requise');
      return;
    }
    try {
      const res = await apiPost(`/api/admin/wallet/payouts/${id}/paid`, {
        payout_ref: ref.trim(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erreur paid');
        return;
      }
      toast.success('Marqué comme payé');
      void load();
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const onReject = async (id: number) => {
    const reason = window.prompt(
      'Motif de rejet — OBLIGATOIRE (sera visible par l\'utilisateur) :',
      '',
    );
    if (!reason || !reason.trim()) {
      toast.error('Motif requis');
      return;
    }
    if (!window.confirm(`Confirmer le rejet ?\nLe wallet du user sera recrédité automatiquement.`)) {
      return;
    }
    try {
      const res = await apiPost(`/api/admin/wallet/payouts/${id}/reject`, {
        reason: reason.trim(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Erreur reject');
        return;
      }
      toast.success('Refusé + refund effectué');
      void load();
    } catch {
      toast.error('Erreur réseau');
    }
  };

  if (loading) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6 col-span-full">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 col-span-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-gray-900">
            💸 Payouts cash (Mobile Money)
          </h2>
          {summary && summary.pending_count > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {summary.pending_count} à traiter
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="p-2 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Treasury Summary */}
      {summary && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-3 mb-4">
          <p className="text-[10px] uppercase font-bold text-amber-800 tracking-wider mb-2">
            🏦 Résumé trésorerie — Yukpo doit aux clients
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryTile
              label="Solde clients"
              value={summary.total_wallet_outstanding_xaf}
              hint="Dette wallet (à déduire du revenu brut)"
              warning
            />
            <SummaryTile
              label="Payouts en cours"
              value={summary.total_payouts_pending_xaf}
              hint="Pending + approved (provisionné)"
              warning
            />
            <SummaryTile
              label="Payouts payés"
              value={summary.total_payouts_paid_xaf}
              hint="Historique total"
            />
            <SummaryTile
              label="Bonus parrainage"
              value={summary.total_referral_bonus_credited_xaf}
              hint="Total crédité depuis le lancement"
            />
          </div>
          <p className="text-[10px] text-gray-600 mt-2 italic">
            ⚠️ Les soldes wallet appartiennent aux clients. Pour calculer le revenu NET de
            Yukpo, soustraire <b>Solde clients</b> + <b>Payouts en cours</b> des commissions brutes.
          </p>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-1 sm:gap-2 mb-3 flex-wrap">
        {(['pending', 'approved', 'paid', 'rejected', 'all'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Tout' : f}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6 italic">
          Aucune demande {filter !== 'all' ? `« ${filter} »` : ''}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-[10px] uppercase font-bold text-gray-600 tracking-wider">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2 text-right">Montant</th>
                <th className="px-2 py-2">Opérateur</th>
                <th className="px-2 py-2">Numéro</th>
                <th className="px-2 py-2">Statut</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <PayoutAdminRow
                  key={p.id}
                  payout={p}
                  onApprove={onApprove}
                  onMarkPaid={onMarkPaid}
                  onReject={onReject}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const SummaryTile: React.FC<{
  label: string;
  value: number;
  hint: string;
  warning?: boolean;
}> = ({ label, value, hint, warning }) => (
  <div
    className={`rounded-lg p-2 ${
      warning ? 'bg-white border border-amber-300' : 'bg-white border border-gray-200'
    }`}
  >
    <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">{label}</p>
    <p
      className={`text-base sm:text-lg font-bold tabular-nums leading-tight ${
        warning ? 'text-amber-700' : 'text-gray-900'
      }`}
    >
      {value.toLocaleString('fr-FR')}
    </p>
    <p className="text-[9px] text-gray-500 leading-tight">{hint}</p>
  </div>
);

const PayoutAdminRow: React.FC<{
  payout: PayoutRequest;
  onApprove: (id: number) => void;
  onMarkPaid: (id: number) => void;
  onReject: (id: number) => void;
}> = ({ payout, onApprove, onMarkPaid, onReject }) => {
  const opLabel =
    payout.operator === 'orange_money' ? 'Orange' : payout.operator === 'mtn_momo' ? 'MTN' : payout.operator;
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    approved: 'bg-blue-100 text-blue-800 border-blue-300',
    paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
  };
  const canApprove = payout.status === 'pending';
  const canMarkPaid = payout.status === 'pending' || payout.status === 'approved';
  const canReject = payout.status === 'pending' || payout.status === 'approved';
  return (
    <tr className="text-gray-800 hover:bg-gray-50">
      <td className="px-2 py-2 text-[11px] text-gray-500">
        {new Date(payout.requested_at).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="px-2 py-2 font-mono text-xs">#{payout.user_id}</td>
      <td className="px-2 py-2 text-right font-bold tabular-nums">
        {payout.amount_xaf.toLocaleString('fr-FR')}
      </td>
      <td className="px-2 py-2 text-xs">{opLabel}</td>
      <td className="px-2 py-2 font-mono text-[11px]">{payout.phone_e164}</td>
      <td className="px-2 py-2">
        <span
          className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            statusColors[payout.status] || 'bg-gray-100 text-gray-700 border-gray-300'
          }`}
        >
          {payout.status}
        </span>
        {payout.payout_ref && (
          <div className="text-[9px] text-emerald-700 font-mono mt-0.5">
            ref: {payout.payout_ref}
          </div>
        )}
        {payout.admin_note && payout.status === 'rejected' && (
          <div className="text-[9px] text-red-600 mt-0.5 max-w-[140px] truncate" title={payout.admin_note}>
            {payout.admin_note}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right whitespace-nowrap">
        {canApprove && (
          <button
            onClick={() => onApprove(payout.id)}
            className="inline-flex items-center gap-1 px-2 py-1 mr-1 rounded text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700"
            title="Approuver"
          >
            <Check className="w-3 h-3" /> OK
          </button>
        )}
        {canMarkPaid && (
          <button
            onClick={() => onMarkPaid(payout.id)}
            className="inline-flex items-center gap-1 px-2 py-1 mr-1 rounded text-[10px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
            title="Marquer payé"
          >
            💸 Payé
          </button>
        )}
        {canReject && (
          <button
            onClick={() => onReject(payout.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700"
            title="Refuser (refund auto)"
          >
            <X className="w-3 h-3" /> Refus
          </button>
        )}
      </td>
    </tr>
  );
};

export default PayoutsPanel;
