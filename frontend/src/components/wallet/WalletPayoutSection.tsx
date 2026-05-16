// ✅ 2026-05-15 — PR #3 : Section "Retirer mon solde" dans le dashboard.
//
// Affiche un formulaire de demande de payout cash (Orange Money / MTN MoMo)
// et l'historique des demandes précédentes. Visible UNIQUEMENT si le user
// a un solde wallet_credit_bourse ≥ seuil minimum (par défaut 2000 FCFA).
//
// Le solde est lu depuis /api/bourse-livre/wallet/balance (déjà existant).

import { Banknote, Check, Clock, Loader2, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '../../services/apiService';

const PAYOUT_MIN_XAF = 2000;

interface WalletBalanceResponse {
  credit: number;
  debt: number;
  net: number;
}

interface PayoutRequest {
  id: number;
  amount_xaf: number;
  operator: 'orange_money' | 'mtn_momo' | string;
  phone_e164: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | string;
  admin_note?: string | null;
  payout_ref?: string | null;
  requested_at: string;
  paid_at?: string | null;
}

const WalletPayoutSection: React.FC = () => {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<number>(0);
  const [items, setItems] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [operator, setOperator] = useState<'orange_money' | 'mtn_momo'>('mtn_momo');
  const [phone, setPhone] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [balRes, listRes] = await Promise.all([
        apiGet('/api/bourse-livre/wallet/balance'),
        apiGet('/api/wallet/payout/me'),
      ]);
      if (balRes.ok) {
        const bal = (await balRes.json()) as WalletBalanceResponse;
        setBalance(Number(bal.credit ?? 0));
      }
      if (listRes.ok) {
        const list = await listRes.json();
        setItems(list.items ?? []);
      }
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(amount, 10);
    if (!Number.isFinite(amountNum) || amountNum < PAYOUT_MIN_XAF) {
      toast.error(
        t('payout.error_amount_min', {
          defaultValue: 'Montant minimum : {{min}} FCFA',
          min: PAYOUT_MIN_XAF.toLocaleString('fr-FR'),
        }),
      );
      return;
    }
    if (amountNum > balance) {
      toast.error(
        t('payout.error_balance', {
          defaultValue: 'Solde insuffisant ({{balance}} FCFA disponibles)',
          balance: balance.toLocaleString('fr-FR'),
        }),
      );
      return;
    }
    const phoneTrim = phone.trim();
    if (!phoneTrim.startsWith('+') || phoneTrim.replace(/\D/g, '').length < 8) {
      toast.error(
        t('payout.error_phone', {
          defaultValue: 'Numéro invalide. Format : +237 6XX XXX XXX',
        }),
      );
      return;
    }
    setSubmitting(true);
    // ✅ 2026-05-16 — Idempotency-Key (RFC 7240) : protège contre les retries
    // (double-clic, perte réseau, navigation rapide). Le backend dédoublera
    // la demande via UNIQUE INDEX `uniq_wallet_payout_requests_idem`.
    const idemKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const res = await apiPost(
        '/api/wallet/payout/request',
        {
          amount_xaf: amountNum,
          operator,
          phone_e164: phoneTrim,
        },
        { headers: { 'Idempotency-Key': idemKey } },
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody.message || errBody.error || 'Erreur';
        toast.error(msg);
        return;
      }
      toast.success(
        t('payout.success', {
          defaultValue: 'Demande envoyée. L’admin vous contactera sous peu.',
        }),
      );
      setShowForm(false);
      setAmount('');
      setPhone('');
      void load();
    } catch (err) {
      toast.error(t('payout.error_network', { defaultValue: 'Erreur réseau' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return null; // section silencieuse pendant le load (déjà loaders ailleurs)
  }

  // Si solde < seuil ET aucun historique → ne rien afficher (pollution UI)
  if (balance < PAYOUT_MIN_XAF && items.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl border-2 border-emerald-200 p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
          <h2 className="font-bold text-sm sm:text-base text-gray-900">
            {t('payout.title', { defaultValue: 'Retirer en cash' })}
          </h2>
        </div>
        {balance >= PAYOUT_MIN_XAF && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shrink-0"
          >
            {t('payout.cta_new', { defaultValue: 'Nouvelle demande' })}
          </button>
        )}
      </div>

      <p className="text-[11px] sm:text-xs text-gray-600 mb-3">
        {t('payout.subtitle', {
          defaultValue:
            'Votre solde Yukpo peut être retiré en mobile money. Minimum {{min}} FCFA par demande.',
          min: PAYOUT_MIN_XAF.toLocaleString('fr-FR'),
        })}
      </p>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 space-y-2">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1">
              {t('payout.field_amount', { defaultValue: 'Montant (FCFA)' })}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={PAYOUT_MIN_XAF}
              max={balance}
              step={500}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder={`Min ${PAYOUT_MIN_XAF.toLocaleString('fr-FR')}, max ${balance.toLocaleString('fr-FR')}`}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1">
              {t('payout.field_operator', { defaultValue: 'Opérateur' })}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOperator('mtn_momo')}
                className={`px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${
                  operator === 'mtn_momo'
                    ? 'bg-yellow-400 text-gray-900 border-yellow-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                MTN MoMo
              </button>
              <button
                type="button"
                onClick={() => setOperator('orange_money')}
                className={`px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${
                  operator === 'orange_money'
                    ? 'bg-orange-500 text-white border-orange-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Orange Money
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-600 tracking-wider mb-1">
              {t('payout.field_phone', { defaultValue: 'Numéro (format +237...)' })}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+237 6XX XXX XXX"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-3 py-2 rounded-md bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('payout.submit', { defaultValue: 'Envoyer la demande' })}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={submitting}
              className="px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
            >
              {t('common.cancel', { defaultValue: 'Annuler' })}
            </button>
          </div>
        </form>
      )}

      {/* Historique */}
      {items.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">
            {t('payout.history', { defaultValue: 'Historique' })}
          </p>
          <ul className="space-y-1.5">
            {items.slice(0, 5).map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const PayoutRow: React.FC<{ payout: PayoutRequest }> = ({ payout }) => {
  const { t } = useTranslation();
  const StatusBadge: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: {
      color: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: <Clock className="w-3 h-3" />,
      label: t('payout.status.pending', { defaultValue: 'En attente' }),
    },
    approved: {
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <Clock className="w-3 h-3" />,
      label: t('payout.status.approved', { defaultValue: 'Validée' }),
    },
    paid: {
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: <Check className="w-3 h-3" />,
      label: t('payout.status.paid', { defaultValue: 'Versée' }),
    },
    rejected: {
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: <X className="w-3 h-3" />,
      label: t('payout.status.rejected', { defaultValue: 'Refusée' }),
    },
  };
  const s = StatusBadge[payout.status] || StatusBadge.pending;
  const opLabel = payout.operator === 'orange_money' ? 'Orange' : payout.operator === 'mtn_momo' ? 'MTN' : payout.operator;
  return (
    <li className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 rounded-md border border-gray-100 text-[11px] sm:text-xs">
      <div className="min-w-0 flex-1">
        <p className="font-semibold tabular-nums text-gray-900">
          {payout.amount_xaf.toLocaleString('fr-FR')} XAF
          <span className="text-gray-500 font-normal"> · {opLabel}</span>
        </p>
        <p className="text-[10px] text-gray-500 truncate">
          {new Date(payout.requested_at).toLocaleDateString('fr-FR')} · {payout.phone_e164}
          {payout.admin_note && payout.status === 'rejected' && (
            <span className="text-red-600"> · {payout.admin_note}</span>
          )}
        </p>
      </div>
      <span
        className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-semibold ${s.color}`}
      >
        {s.icon}
        {s.label}
      </span>
    </li>
  );
};

export default WalletPayoutSection;
