// Tab "Réseau de garde" (Phase B1, 2026-05-15) — coordination des pharmacies
// du quartier. Affiche les pharmacies actives à ≤ 25 km, en mettant en avant
// celles de garde maintenant (is_on_duty_now=true). Permet d'appeler ou
// d'envoyer un WhatsApp pour échanger une garde ou demander un dépannage.

import { Loader2, MapPin, Phone, RefreshCw, ShieldCheck, Clock } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from '@/services/apiService';
import PharmacySurplusSection from './PharmacySurplusSection';

interface Neighbor {
  id: number;
  nom: string;
  ville: string | null;
  quartier: string | null;
  telephone: string | null;
  whatsapp: string | null;
  is_on_duty_now: boolean;
  jours_garde: string | null;
  permanent_24h: boolean;
  distance_km: number;
}

const buildWaUrl = (phone: string, message: string): string => {
  const clean = phone.replace(/[^0-9+]/g, '').replace(/^0/, '237');
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
};

const PharmacyDutyNetworkTab: React.FC = () => {
  const { t } = useTranslation();
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  // ✅ C2 (2026-05-15) : on garde aussi self.id pour pouvoir interroger le
  // backend de surplus B2B avec la pharmacy_id du pharmacien connecté.
  const [self, setSelf] = useState<{ id: number; ville: string | null; quartier: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet('/api/pharmacies/me/duty-network');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setNeighbors(Array.isArray(j?.neighbors) ? j.neighbors : []);
      setSelf(j?.self ?? null);
    } catch {
      setNeighbors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onDuty = useMemo(() => neighbors.filter(n => n.is_on_duty_now), [neighbors]);
  const offDuty = useMemo(() => neighbors.filter(n => !n.is_on_duty_now), [neighbors]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            {t('pharmaPartner.duty.title')}
          </h2>
          {self && (self.ville || self.quartier) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {[self.ville, self.quartier].filter(Boolean).join(' · ')} · 25 km
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          aria-label="Rafraîchir"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <p className="text-[11px] text-gray-500 leading-snug">
        {t('pharmaPartner.duty.notice')}
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
        </div>
      ) : neighbors.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">{t('pharmaPartner.duty.empty')}</p>
        </div>
      ) : (
        <>
          {/* On duty maintenant */}
          {onDuty.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Clock size={14} /> {t('pharmaPartner.duty.onDutyNow', { count: onDuty.length })}
              </h3>
              <ul className="space-y-2">
                {onDuty.map(n => <NeighborCard key={n.id} n={n} t={t} />)}
              </ul>
            </section>
          )}

          {/* Reste du réseau */}
          {offDuty.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">
                {t('pharmaPartner.duty.others', { count: offDuty.length })}
              </h3>
              <ul className="space-y-2">
                {offDuty.map(n => <NeighborCard key={n.id} n={n} t={t} />)}
              </ul>
            </section>
          )}
        </>
      )}

      {/* C2 — Surplus B2B entre pharmacies (proche péremption). Visible
          uniquement si le pharmacien a une pharmacie active. */}
      {self?.id && <PharmacySurplusSection pharmacyId={self.id} />}
    </div>
  );
};

const NeighborCard: React.FC<{ n: Neighbor; t: (k: string, opts?: any) => string }> = ({ n, t }) => {
  const swapMsg = t('pharmaPartner.duty.swapMessage', { name: n.nom });
  const helpMsg = t('pharmaPartner.duty.helpMessage', { name: n.nom });
  return (
    <li className="bg-white rounded-xl shadow-sm p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{n.nom}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {[n.ville, n.quartier].filter(Boolean).join(' · ') || '—'}
            {' · '}{n.distance_km.toFixed(1)} km
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {n.is_on_duty_now && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                {t('pharmaPartner.duty.badge.onDuty')}
              </span>
            )}
            {n.permanent_24h && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold">
                24h/24
              </span>
            )}
            {n.jours_garde && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium">
                {n.jours_garde}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {n.telephone && (
            <a
              href={`tel:${n.telephone}`}
              className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              aria-label="Appeler"
            >
              <Phone size={14} />
            </a>
          )}
          {n.whatsapp && (
            <a
              href={buildWaUrl(n.whatsapp, n.is_on_duty_now ? helpMsg : swapMsg)}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 rounded-lg bg-[#25D366] text-white text-[10px] font-semibold hover:opacity-90 text-center"
            >
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </li>
  );
};

export default PharmacyDutyNetworkTab;
