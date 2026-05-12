// Recharge — page autonome pour /recharge dans les apps standalone (pharmacie/restaurant).
// Backend : POST /api/payments/initiate { amount_xaf, payment_method, currency, phone_number? }
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Smartphone, CreditCard, ShieldCheck, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiPost } from '@/services/apiService';

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

type PayMethod = 'mtn_momo' | 'orange_money' | 'visa';

const RechargePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [amount, setAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [method, setMethod] = useState<PayMethod>('mtn_momo');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; instructions?: string; error?: string } | null>(null);

  const currency = user?.currency || 'XAF';
  const finalAmount = customAmount ? parseInt(customAmount, 10) || 0 : amount;
  // Bonus 5% au-delà de 10 000 XAF
  const bonus = finalAmount >= 10000 ? Math.floor(finalAmount * 0.05) : 0;
  const credits = finalAmount + bonus;

  if (!isAuthenticated) {
    navigate('/login?redirect=/recharge');
    return null;
  }

  const methodLabel = method === 'mtn_momo' ? t('recharge.method.mtn')
                     : method === 'orange_money' ? t('recharge.method.orange')
                     : t('recharge.method.card');

  const handleSubmit = async () => {
    if (finalAmount < 1000) {
      setResult({ ok: false, error: 'Montant minimum : 1000 XAF' });
      return;
    }
    if (method !== 'visa' && !phone.trim()) {
      setResult({ ok: false, error: 'Numéro de téléphone requis pour Mobile Money' });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const r = await apiPost('/api/payments/initiate', {
        amount_xaf: finalAmount,
        payment_method: method,
        currency,
        phone_number: method !== 'visa' ? phone.trim() : undefined,
      });
      const j = await r.json();
      if (r.ok) {
        setResult({ ok: true, instructions: j.instructions || j.data?.instructions });
        if (j.payment_url || j.data?.payment_url) {
          // Pour Visa : redirige vers la page de paiement
          window.location.href = j.payment_url || j.data.payment_url;
        }
      } else {
        setResult({ ok: false, error: j.message || j.error || 'Échec du paiement' });
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || 'Erreur réseau' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t('recharge.title')}</h1>
            <p className="text-blue-100 text-sm">{t('recharge.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4 space-y-4">
        {/* Sélecteur de montant */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            {t('recharge.amountLabel')}
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PRESET_AMOUNTS.map(a => {
              const active = !customAmount && amount === a;
              return (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustomAmount(''); }}
                  className={`py-3 rounded-lg text-sm font-bold border transition ${
                    active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {a.toLocaleString()} {currency}
                </button>
              );
            })}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">{t('recharge.amountCustom')}</label>
            <input
              type="number"
              min={1000}
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              placeholder={t('recharge.amountPlaceholder')}
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {finalAmount >= 1000 && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <Sparkles size={14} />
                {t('recharge.summary', { credits: credits.toLocaleString() })}
              </div>
              {bonus > 0 && (
                <div className="text-xs text-emerald-700 mt-1">
                  {t('recharge.summaryBonus', { bonus: bonus.toLocaleString() })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Moyen de paiement */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            {t('recharge.methodLabel')}
          </label>
          <div className="space-y-2">
            {([
              { v: 'mtn_momo',     label: t('recharge.method.mtn'),    Icon: Smartphone, color: 'text-yellow-700 bg-yellow-50 border-yellow-300' },
              { v: 'orange_money', label: t('recharge.method.orange'), Icon: Smartphone, color: 'text-orange-700 bg-orange-50 border-orange-300' },
              { v: 'visa',         label: t('recharge.method.card'),   Icon: CreditCard, color: 'text-blue-700 bg-blue-50 border-blue-300' },
            ] as const).map(m => {
              const active = method === m.v;
              const Icon = m.Icon;
              return (
                <button
                  key={m.v}
                  onClick={() => setMethod(m.v as PayMethod)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                    active ? m.color : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium text-sm">{m.label}</span>
                  {active && <CheckCircle2 size={16} className="ml-auto" />}
                </button>
              );
            })}
          </div>

          {method !== 'visa' && (
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-600">
                {t('recharge.phoneLabel', { method: methodLabel })}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder={t('recharge.phonePlaceholder')}
                className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Résultat */}
        {result && (
          <div className={`rounded-xl p-4 border ${result.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`flex items-center gap-1.5 font-semibold ${result.ok ? 'text-emerald-800' : 'text-red-800'}`}>
              {result.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {result.ok ? t('recharge.successTitle') : t('recharge.errorTitle')}
            </div>
            <div className={`text-sm mt-1 ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {result.ok ? (result.instructions || t('recharge.successMsg')) : (result.error || t('recharge.errorMsg'))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={submitting || finalAmount < 1000}
          className="w-full py-3.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-bold text-base hover:from-indigo-700 hover:to-blue-800 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t('recharge.submitting')}
            </>
          ) : (
            t('recharge.submit', { amount: finalAmount.toLocaleString(), currency })
          )}
        </button>

        <p className="text-[11px] text-gray-500 text-center flex items-center justify-center gap-1">
          <ShieldCheck size={12} className="text-emerald-600" />
          {t('recharge.noteSecure')}
        </p>
      </div>
    </div>
  );
};

export default RechargePage;
