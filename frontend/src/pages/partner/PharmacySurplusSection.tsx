// Phase C2 (2026-05-15) — Surplus B2B entre pharmacies.
//
// Section embarquée dans le tab "Garde" du dashboard pharmacien. Permet de :
//   - Proposer un surplus de stock proche péremption à un confrère voisin
//   - Voir les surplus déjà proposés par d'autres pharmacies du rayon (50 km)
//   - Réclamer un surplus → la pharmacie source est notifiée (out-of-app)
//
// Pas de paiement plateforme : Yukpo se contente d'être marketplace, les deux
// pharmacies s'arrangent ensuite (légalement OK entre confrères au CM).

import {
  AlertCircle, ArrowRightLeft, Clock, Loader2, Package, Plus, Trash2, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost, apiDelete } from '@/services/apiService';
import { useToast } from '@/hooks/use-toast';

interface SurplusItem {
  id: number;
  pharmacy_id: number;
  pharmacy_name: string;
  pharmacy_phone?: string | null;
  medication_name: string;
  dosage?: string | null;
  quantity: number;
  quantity_unit: string;
  batch_number?: string | null;
  expiry_date: string; // YYYY-MM-DD
  unit_price_xaf?: number | null;
  note?: string | null;
  status: 'open' | 'claimed' | 'sold' | 'expired';
  claimed_by_pharmacy_id?: number | null;
  claimed_by_name?: string | null;
  claimed_at?: string | null;
  distance_km?: number;
}

interface Props {
  pharmacyId: number;
}

const daysUntilExpiry = (date: string): number => {
  try {
    const target = new Date(date).getTime();
    const now = Date.now();
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

const PharmacySurplusSection: React.FC<Props> = ({ pharmacyId }) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [mine, setMine] = useState<SurplusItem[]>([]);
  const [nearby, setNearby] = useState<SurplusItem[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [fMed, setFMed] = useState('');
  const [fDosage, setFDosage] = useState('');
  const [fQty, setFQty] = useState(1);
  const [fUnit, setFUnit] = useState('boite');
  const [fBatch, setFBatch] = useState('');
  const [fExpiry, setFExpiry] = useState('');
  const [fPrice, setFPrice] = useState<string>('');
  const [fNote, setFNote] = useState('');

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const r = await apiGet('/api/pharmacies/me/surplus');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMine(Array.isArray(j?.items) ? j.items : []);
    } catch {
      setMine([]);
    } finally {
      setLoadingMine(false);
    }
  }, []);

  const loadNearby = useCallback(async () => {
    if (!pharmacyId) return;
    setLoadingNearby(true);
    try {
      const r = await apiGet(
        `/api/pharmacies/me/surplus/nearby?pharmacy_id=${pharmacyId}&radius_km=50`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setNearby(Array.isArray(j?.items) ? j.items : []);
    } catch {
      setNearby([]);
    } finally {
      setLoadingNearby(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    loadMine();
    loadNearby();
  }, [loadMine, loadNearby]);

  const resetForm = () => {
    setFMed('');
    setFDosage('');
    setFQty(1);
    setFUnit('boite');
    setFBatch('');
    setFExpiry('');
    setFPrice('');
    setFNote('');
  };

  const handleSubmit = async () => {
    if (!fMed.trim() || !fExpiry || fQty < 1) {
      toast({
        title: t('pharmaPartner.surplus.errMissing'),
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiPost('/api/pharmacies/me/surplus', {
        pharmacy_id: pharmacyId,
        medication_name: fMed.trim(),
        dosage: fDosage.trim() || null,
        quantity: fQty,
        quantity_unit: fUnit,
        batch_number: fBatch.trim() || null,
        expiry_date: fExpiry,
        unit_price_xaf: fPrice ? parseFloat(fPrice) : null,
        note: fNote.trim() || null,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast({ title: t('pharmaPartner.surplus.created') });
      setSheetOpen(false);
      resetForm();
      await loadMine();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('pharmaPartner.surplus.confirmDelete'))) return;
    try {
      const r = await apiDelete(`/api/pharmacies/me/surplus/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setMine(prev => prev.filter(x => x.id !== id));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const handleClaim = async (id: number) => {
    try {
      const r = await apiPost(`/api/pharmacies/me/surplus/${id}/claim`, {
        pharmacy_id: pharmacyId,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        throw new Error(j?.error || `HTTP ${r.status}`);
      }
      toast({ title: t('pharmaPartner.surplus.claimed') });
      await loadNearby();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const myActive = useMemo(() => mine.filter(x => x.status !== 'sold'), [mine]);

  return (
    <section className="space-y-4 mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800 inline-flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-blue-600" />
          {t('pharmaPartner.surplus.title')}
        </h2>
        <button
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('pharmaPartner.surplus.propose')}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">
        {t('pharmaPartner.surplus.notice')}
      </p>

      {/* MES surplus (annonces que j'ai postées) */}
      {!loadingMine && myActive.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('pharmaPartner.surplus.myOffers')} ({myActive.length})
          </h3>
          <ul className="space-y-2">
            {myActive.map(s => {
              const d = daysUntilExpiry(s.expiry_date);
              return (
                <li key={s.id} className="bg-white rounded-xl shadow-sm p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {s.medication_name} {s.dosage ? `· ${s.dosage}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.quantity} {s.quantity_unit}
                        {s.unit_price_xaf ? ` · ${s.unit_price_xaf} FCFA/u` : ''}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] mt-1">
                        <Clock className="w-3 h-3" />
                        <span className={d < 30 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {t('pharmaPartner.surplus.expiresIn', { days: d })}
                        </span>
                      </div>
                      {s.status === 'claimed' && s.claimed_by_name && (
                        <div className="text-[11px] text-amber-700 font-semibold mt-1">
                          🟠 {t('pharmaPartner.surplus.claimedBy', { name: s.claimed_by_name })}
                        </div>
                      )}
                    </div>
                    {s.status === 'open' && (
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 shrink-0"
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Surplus VOISINS (offres d'autres pharmacies, je peux réclamer) */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('pharmaPartner.surplus.nearbyOffers')} ({nearby.length})
        </h3>
        {loadingNearby ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          </div>
        ) : nearby.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
            <p className="text-xs">{t('pharmaPartner.surplus.emptyNearby')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {nearby.map(s => {
              const d = daysUntilExpiry(s.expiry_date);
              return (
                <li key={s.id} className="bg-white rounded-xl shadow-sm p-3 border border-blue-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {s.medication_name} {s.dosage ? `· ${s.dosage}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.pharmacy_name}
                        {s.distance_km !== undefined ? ` · ${s.distance_km.toFixed(1)} km` : ''}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {s.quantity} {s.quantity_unit}
                        {s.unit_price_xaf ? ` · ${s.unit_price_xaf} FCFA/u` : ''}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] mt-1">
                        <Clock className="w-3 h-3" />
                        <span className={d < 30 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                          {t('pharmaPartner.surplus.expiresIn', { days: d })}
                        </span>
                      </div>
                      {s.note && (
                        <p className="text-[11px] text-gray-600 italic mt-1">« {s.note} »</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleClaim(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shrink-0"
                    >
                      {t('pharmaPartner.surplus.claim')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Sheet création */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex sm:items-center items-end justify-center"
          onClick={() => !submitting && setSheetOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-bold text-gray-800">
                {t('pharmaPartner.surplus.newTitle')}
              </h3>
              <button onClick={() => setSheetOpen(false)} aria-label={t('common.close')}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  {t('pharmaPartner.surplus.medName')} *
                </label>
                <input
                  value={fMed}
                  onChange={e => setFMed(e.target.value)}
                  placeholder="Amoxicilline"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    {t('pharmaPartner.surplus.dosage')}
                  </label>
                  <input
                    value={fDosage}
                    onChange={e => setFDosage(e.target.value)}
                    placeholder="500mg"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    {t('pharmaPartner.surplus.batch')}
                  </label>
                  <input
                    value={fBatch}
                    onChange={e => setFBatch(e.target.value)}
                    placeholder="LOT123"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    {t('pharmaPartner.surplus.quantity')} *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={fQty}
                    onChange={e => setFQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    {t('pharmaPartner.surplus.unit')}
                  </label>
                  <select
                    value={fUnit}
                    onChange={e => setFUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="boite">Boîte</option>
                    <option value="flacon">Flacon</option>
                    <option value="comprime">Comprimé</option>
                    <option value="sachet">Sachet</option>
                    <option value="ampoule">Ampoule</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">
                    {t('pharmaPartner.surplus.priceXaf')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={fPrice}
                    onChange={e => setFPrice(e.target.value)}
                    placeholder="1200"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  {t('pharmaPartner.surplus.expiry')} *
                </label>
                <input
                  type="date"
                  value={fExpiry}
                  onChange={e => setFExpiry(e.target.value)}
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  {t('pharmaPartner.surplus.note')} ({t('common.optional')})
                </label>
                <textarea
                  value={fNote}
                  onChange={e => setFNote(e.target.value)}
                  rows={2}
                  placeholder={t('pharmaPartner.surplus.notePlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm resize-none"
                />
              </div>
              <div className="bg-amber-50 rounded-lg px-3 py-2 text-[11px] text-amber-800 inline-flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{t('pharmaPartner.surplus.legalDisclaimer')}</span>
              </div>
            </div>
            <div className="px-4 py-3 border-t bg-gray-50 flex gap-2">
              <button
                onClick={() => setSheetOpen(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PharmacySurplusSection;
