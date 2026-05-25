// Page de progression d'une alerte de demande de disponibilité (RFQ).
//
// L'utilisateur a émis une alerte avec une liste de médicaments. Le backend
// a broadcast aux pharmacies du rayon (5 km par défaut). Cette page :
//   - Affiche le countdown des 5 min
//   - Polle GET /api/medication-alerts/:id toutes les 5 s
//   - Liste les pharmacies au fur et à mesure qu'elles répondent
//   - Trie par taux de complétude desc (5/5 > 3/5 > 1/5)
//   - À expiration, si aucune n'a 100 % → affiche option "élargir le rayon"

import { AlertTriangle, ArrowLeft, ArrowRightLeft, Check, Clock, Loader2, MapPin, Package, Phone, Pill, Sparkles, X } from 'lucide-react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/services/apiService';
import { useGpsWithFallback } from '@/hooks/useGpsWithFallback';
import PersonalInteractionsBanner from '@/components/pharmacie/PersonalInteractionsBanner';

interface SubstituteAlt {
  brand: string;
  dosage_form?: string | null;
  notes?: string | null;
}

interface SubstituteResult {
  dci: string | null;
  alternatives: SubstituteAlt[];
}

const SubstitutesBanner: React.FC<{ unavailableNames: string[] }> = ({ unavailableNames }) => {
  const [data, setData] = useState<Record<string, SubstituteResult> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSubs = useCallback(async () => {
    if (unavailableNames.length === 0) return;
    setLoading(true);
    try {
      const r = await apiPost('/api/medications/substitutes', { names: unavailableNames });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j?.results || {});
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  }, [unavailableNames]);

  if (unavailableNames.length === 0) return null;

  // Filtrer les résultats qui ont des alternatives
  const withAlts = data
    ? Object.entries(data).filter(([_, r]) => r.alternatives.length > 0)
    : [];

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 px-4 py-3">
      <div className="flex items-start gap-3 mb-2">
        <ArrowRightLeft className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">
            Équivalents génériques disponibles
          </p>
          <p className="text-xs text-purple-900 mt-0.5 leading-snug">
            {unavailableNames.length} médicament(s) indisponible(s) — Yukpo peut chercher des
            génériques équivalents (même DCI) dans les pharmacies voisines.
          </p>
        </div>
      </div>

      {data === null && (
        <button
          onClick={fetchSubs}
          disabled={loading}
          className="w-full mt-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
          Chercher des équivalents
        </button>
      )}

      {data !== null && withAlts.length === 0 && (
        <p className="text-[11px] text-purple-700/80 italic mt-1">
          Aucun équivalent générique connu dans notre base. Demandez conseil à votre pharmacien.
        </p>
      )}

      {withAlts.length > 0 && (
        <div className="mt-3 space-y-2">
          {withAlts.map(([name, r]) => (
            <div key={name} className="bg-white rounded-xl p-2.5 border border-purple-100">
              <div className="text-xs font-semibold text-gray-800">
                {name}
                {r.dci && (
                  <span className="ml-1.5 text-[10px] text-purple-700 font-normal">
                    ({r.dci})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {r.alternatives.slice(0, 6).map((a, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-medium"
                  >
                    {a.brand}
                  </span>
                ))}
                {r.alternatives.length > 6 && (
                  <span className="text-[10px] text-purple-600 italic self-center">
                    +{r.alternatives.length - 6}
                  </span>
                )}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-purple-700/70 italic mt-1">
            Une marque générique = même DCI = effet thérapeutique équivalent. Confirmez avec votre pharmacien
            l'équivalence exacte de dosage avant substitution.
          </p>
        </div>
      )}
    </div>
  );
};

interface ItemStatus {
  name: string;
  available: boolean;
  price?: number;
  note?: string;
}

interface Alternative {
  original: string;
  alt: string;
  note?: string;
}

interface MatchPharmacy {
  pharmacy_id: number;
  response_id?: number;
  name: string;
  ville?: string;
  quartier?: string;
  telephone?: string;
  whatsapp?: string;
  found_count: number;
  total_count: number;
  items_status: ItemStatus[];
  alternatives?: Alternative[];
  distance_km?: number;
  responded_at: string;
  /** B2.1 — workflow click & collect */
  prepared_at?: string | null;
  picked_up_at?: string | null;
  pickup_qr_code?: string | null;
}

interface FallbackInfo {
  reason: string;
  suggestion: string;
  max_completeness: number;
}

interface AlertData {
  alert_id: number;
  status: 'open' | 'closed' | 'expired' | 'cancelled' | string;
  total_items: number;
  notified_pharmacies_count: number;
  expires_at: string;
  radius_km: number;
  matches: MatchPharmacy[];
  fallback?: FallbackInfo;
}

const POLL_INTERVAL_MS = 5_000;

const MedicationAlertPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { gps } = useGpsWithFallback();

  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const [widening, setWidening] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiGet(`/api/medication-alerts/${id}`, { isAuthenticated: false });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData({
        alert_id: json.alert_id,
        status: json.status,
        total_items: json.total_items,
        notified_pharmacies_count: json.notified_pharmacies_count,
        expires_at: json.expires_at,
        radius_km: json.radius_km,
        matches: Array.isArray(json.matches) ? json.matches : [],
        fallback: json.fallback || undefined,
      });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const handle = setInterval(load, POLL_INTERVAL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(handle);
      clearInterval(tick);
    };
  }, [load]);

  const countdown = useMemo(() => {
    if (!data) return 0;
    const exp = new Date(data.expires_at).getTime();
    return Math.max(0, Math.floor((exp - now) / 1000));
  }, [data, now]);

  const isOpen = data?.status === 'open' && countdown > 0;

  const handleWidenRadius = async () => {
    if (!data || !gps) return;
    setWidening(true);
    try {
      // On ré-émet une nouvelle alerte avec un rayon plus large (×2 jusqu'à
      // 50 km max). Défaut 10 km → 20 → 40 → 50 (3 élargissements possibles).
      const newRadius = Math.min(50, data.radius_km * 2);
      const items = data.matches[0]?.items_status?.map(s => ({ name: s.name }))
        ?? Array(data.total_items).fill(0).map((_, i) => ({ name: `Médicament ${i + 1}` }));
      const res = await apiPost('/api/medication-alerts', {
        query_items: items,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        radius_km: newRadius,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      navigate(`/alerts/${j.alert_id}`);
    } catch {
      setWidening(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-500 flex items-center justify-center p-5">
        <div className="bg-white rounded-2xl p-6 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-gray-700">{error || 'Alerte introuvable'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl font-semibold"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const fullMatches = data.matches.filter(m => m.found_count === m.total_count);
  const partialMatches = data.matches.filter(m => m.found_count < m.total_count);

  // ✅ Phase C3 (2026-05-15) — Substitution générique. Pour chaque médicament
  // demandé, on vérifie s'il est disponible chez au moins une pharmacie qui a
  // répondu. Sinon, on propose à l'utilisateur de chercher un équivalent
  // générique via la table dci_equivalents.
  const unavailableMedications: string[] = (() => {
    if (data.matches.length === 0) return [];
    // Set des noms (lowercase) disponibles quelque part
    const availableNames = new Set<string>();
    for (const m of data.matches) {
      for (const it of m.items_status) {
        if (it.available) availableNames.add(it.name.trim().toLowerCase());
      }
    }
    // On déduit les "demandés" depuis items_status de la 1ère pharmacie
    const allNames = data.matches[0]?.items_status?.map(s => s.name) || [];
    return allNames.filter(n => !availableNames.has(n.trim().toLowerCase()));
  })();

  // ✅ Budget total de l'ordonnance (prix harmonisés au CM → identique entre
  // pharmacies). On prend la 1ère pharmacie 100% si disponible, sinon le
  // meilleur match partiel + indique que c'est partiel.
  const computeBudget = (match: MatchPharmacy | undefined): number => {
    if (!match) return 0;
    return match.items_status
      .filter(s => s.available && typeof s.price === 'number')
      .reduce((s, i) => s + (i.price as number), 0);
  };
  const referenceMatch = fullMatches[0] ?? partialMatches[0];
  const referenceBudget = computeBudget(referenceMatch);
  const isPartialReference =
    !!referenceMatch && referenceMatch.found_count < referenceMatch.total_count;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-500">
      {/* Hero compact */}
      <div className="px-5 pt-6 pb-5 text-white max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-blue-100 text-xs mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Accueil
        </button>
        <h1 className="text-lg font-bold leading-tight">Demande aux pharmacies</h1>
        <p className="text-xs text-blue-100 mt-0.5">
          {data.notified_pharmacies_count} pharmacie(s) notifiée(s) dans un rayon de{' '}
          {data.radius_km.toFixed(0)} km
        </p>

        {/* Countdown + statut */}
        <div className="mt-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3 inline-flex items-center gap-3">
          <Clock className={`w-5 h-5 ${isOpen ? 'text-white' : 'text-amber-200'}`} />
          <div className="flex-1 min-w-0">
            {isOpen ? (
              <>
                <p className="text-xs text-blue-100">Temps restant</p>
                <p className="text-lg font-bold text-white tabular-nums">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-amber-100">Période de demande terminée</p>
                <p className="text-sm font-semibold text-white">
                  {data.matches.length} réponse(s) reçue(s)
                </p>
              </>
            )}
          </div>
          {data.matches.length > 0 && (
            <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-semibold text-white">
              {data.matches.length} réponses
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-white rounded-t-3xl min-h-screen pb-28">
        <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
          {/* Phase B1 : bandeau interactions personnelles — croise les
              médicaments de l'ordonnance avec le carnet santé du patient
              connecté. Invisible si non connecté ou aucune interaction. */}
          {data.matches.length > 0 && data.matches[0].items_status?.length > 0 && (
            <PersonalInteractionsBanner
              medications={data.matches[0].items_status.map(s => s.name)}
            />
          )}

          {/* Phase B2.1 : cartes "Prêt à retirer". Une pharmacie a marqué
              les médicaments comme préparés → on affiche le QR à présenter
              en pharmacie pour le retrait. Pas affichée si déjà picked_up. */}
          {data.matches
            .filter(m => m.prepared_at && !m.picked_up_at && m.pickup_qr_code)
            .map(m => (
              <PickupReadyCard key={`pickup-${m.pharmacy_id}`} match={m} />
            ))}

          {/* Phase C3 : substitution générique. Visible si au moins un
              médicament demandé n'est dispo chez AUCUNE pharmacie ayant
              répondu — propose les équivalents (même DCI) dans une autre
              pharmacie. */}
          {unavailableMedications.length > 0 && (
            <SubstitutesBanner unavailableNames={unavailableMedications} />
          )}

          {/* Budget total de l'ordonnance — visible en haut. Les prix des
              médicaments sont harmonisés au Cameroun (régulation MINSANTE)
              donc cette valeur est valide quelle que soit la pharmacie
              choisie pour les médicaments effectivement disponibles. */}
          {referenceBudget > 0 && (
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                    Budget estimé pour votre ordonnance
                  </p>
                  <p className="text-2xl font-bold text-blue-900 mt-0.5 tabular-nums">
                    {referenceBudget.toLocaleString()} <span className="text-base font-semibold">FCFA</span>
                  </p>
                  <p className="text-[11px] text-blue-700/80 mt-0.5 leading-snug">
                    {isPartialReference
                      ? `⚠ Total partiel : ${referenceMatch.found_count}/${referenceMatch.total_count} médicaments disponibles dans la meilleure pharmacie pour l'instant.`
                      : 'Prix harmonisés au Cameroun : identique dans toutes les pharmacies qui ont l\'ordonnance complète.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section pharmacies complètes (100% match) */}
          {fullMatches.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-emerald-700 inline-flex items-center gap-1.5 mb-2">
                <Check className="w-4 h-4" />
                Tous vos médicaments disponibles ({fullMatches.length})
              </h2>
              <div className="space-y-2">
                {fullMatches.map(p => (
                  <PharmacyMatchCard key={p.pharmacy_id} match={p} highlight />
                ))}
              </div>
            </section>
          )}

          {/* Section pharmacies partielles */}
          {partialMatches.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-700 inline-flex items-center gap-1.5 mb-2">
                <Pill className="w-4 h-4 text-amber-600" />
                Disponibilité partielle ({partialMatches.length})
              </h2>
              <div className="space-y-2">
                {partialMatches.map(p => (
                  <PharmacyMatchCard key={p.pharmacy_id} match={p} />
                ))}
              </div>
            </section>
          )}

          {/* État vide pendant l'attente */}
          {isOpen && data.matches.length === 0 && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-3">
                <Sparkles className="w-7 h-7 text-blue-600 animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-gray-800">En attente des pharmacies…</p>
              <p className="text-xs text-gray-500 mt-1">
                Les réponses arriveront ici en temps réel. Vous pouvez fermer l'app et revenir
                plus tard, vous serez notifié.
              </p>
            </div>
          )}

          {/* Fallback : si expiré sans 100% match, proposer d'élargir */}
          {!isOpen && data.fallback && fullMatches.length === 0 && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm font-bold text-amber-900">
                Aucune pharmacie n'a tous vos médicaments
              </p>
              <p className="text-xs text-amber-800 mt-1 leading-snug">
                Meilleur taux atteint : {data.fallback.max_completeness}/{data.total_items} médicaments.
                {data.fallback.suggestion}
              </p>
              {data.radius_km < 50 && (
                <button
                  onClick={handleWidenRadius}
                  disabled={widening || !gps}
                  className="mt-3 w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white py-2.5 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:bg-amber-400"
                >
                  {widening ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      Élargir à {Math.min(50, data.radius_km * 2).toFixed(0)} km
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {!isOpen && data.matches.length === 0 && !data.fallback && (
            <div className="text-center py-10">
              <X className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Aucune pharmacie n'a répondu à temps.</p>
              <button
                onClick={() => navigate('/')}
                className="mt-3 text-sm text-blue-600 font-semibold"
              >
                Faire une nouvelle demande
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PharmacyMatchCard: React.FC<{ match: MatchPharmacy; highlight?: boolean }> = ({
  match,
  highlight = false,
}) => {
  const budgetSum = match.items_status
    .filter(s => s.available && typeof s.price === 'number')
    .reduce((s, i) => s + (i.price as number), 0);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        highlight ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-100 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{match.name}</p>
          {(match.quartier || match.ville) && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {[match.quartier, match.ville].filter(Boolean).join(', ')}
            </p>
          )}
          <p
            className={`text-xs font-semibold mt-1 inline-flex items-center gap-1 ${
              highlight ? 'text-emerald-700' : 'text-blue-600'
            }`}
          >
            <Pill className="w-3 h-3" />
            {match.found_count}/{match.total_count} médicaments
          </p>
        </div>
        <div className="text-right shrink-0">
          {match.distance_km !== undefined && (
            <p className="text-xs text-gray-400">{match.distance_km.toFixed(1)} km</p>
          )}
          {budgetSum > 0 && (
            <div className="mt-1">
              <p className="text-[10px] uppercase text-gray-500 leading-none tracking-wide">
                Total estimé
              </p>
              <p className="text-sm font-bold text-blue-700">{budgetSum.toLocaleString()} FCFA</p>
            </div>
          )}
        </div>
      </div>

      {/* Items détaillés */}
      <div className="mt-3 space-y-1 border-t border-dashed border-gray-100 pt-2">
        {match.items_status.map((it, i) => (
          <div key={`${it.name}-${i}`} className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                it.available ? 'bg-emerald-500' : 'bg-red-400'
              }`}
            />
            <span
              className={`flex-1 min-w-0 truncate ${
                it.available ? 'text-gray-800' : 'text-gray-400 line-through'
              }`}
            >
              {it.name}
            </span>
            {it.available && typeof it.price === 'number' ? (
              <span className="text-blue-700 font-semibold shrink-0">
                {it.price.toLocaleString()} FCFA
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Alternatives proposées par le pharmacien */}
      {match.alternatives && match.alternatives.length > 0 && (
        <div className="mt-2 border-t border-dashed border-amber-100 pt-2">
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
            Alternatives proposées par le pharmacien
          </p>
          {match.alternatives.map((a, i) => (
            <p key={i} className="text-xs text-amber-900">
              <span className="text-gray-500 line-through">{a.original}</span>
              <span className="mx-1">→</span>
              <span className="font-medium">{a.alt}</span>
            </p>
          ))}
        </div>
      )}

      {/* CTA appel + WhatsApp */}
      {(match.telephone || match.whatsapp) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {match.telephone && (
            <a
              href={`tel:${match.telephone}`}
              className="inline-flex items-center gap-1 text-xs text-emerald-600 active:text-emerald-800"
            >
              <Phone className="w-3 h-3" />
              {match.telephone}
            </a>
          )}
          {match.whatsapp && (
            <a
              href={`https://wa.me/${match.whatsapp.replace(/[^0-9+]/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-700"
            >
              WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Phase B2.1 — Carte "Prêt à retirer" affichée quand le pharmacien a marqué
// les médicaments comme préparés. Le patient présente le QR au comptoir.
// ============================================================================

const PickupReadyCard: React.FC<{ match: MatchPharmacy }> = ({ match }) => {
  const [showQr, setShowQr] = useState(true); // ouvert par défaut

  const preparedAgo = useMemo(() => {
    if (!match.prepared_at) return '';
    const diff = Date.now() - new Date(match.prepared_at).getTime();
    const mins = Math.max(1, Math.floor(diff / 60_000));
    if (mins < 60) return `il y a ${mins} min`;
    const h = Math.floor(mins / 60);
    return `il y a ${h} h`;
  }, [match.prepared_at]);

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-600 p-2 shrink-0">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
            Prêt à retirer
          </p>
          <p className="font-bold text-emerald-900 text-base mt-0.5 leading-tight">
            {match.name}
          </p>
          <p className="text-xs text-emerald-800/80 mt-0.5">
            {[match.quartier, match.ville].filter(Boolean).join(', ')}
            {preparedAgo && ` · préparé ${preparedAgo}`}
          </p>
          {match.telephone && (
            <a
              href={`tel:${match.telephone}`}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold"
            >
              <Phone className="w-3 h-3" />
              {match.telephone}
            </a>
          )}
        </div>
      </div>

      {showQr && match.pickup_qr_code && (
        <div className="mt-3 bg-white rounded-xl p-4 flex flex-col items-center">
          <QRCode value={match.pickup_qr_code} size={180} level="M" />
          <p className="text-[10px] font-mono text-gray-500 mt-2 break-all">
            {match.pickup_qr_code.slice(0, 8)}…{match.pickup_qr_code.slice(-4)}
          </p>
          <p className="text-xs text-gray-700 text-center mt-2 leading-snug">
            Présentez ce QR au pharmacien pour valider votre retrait.
            <br />
            <span className="text-[10px] text-gray-500">
              ⚠ Code à usage unique — ne le partagez pas.
            </span>
          </p>
        </div>
      )}

      <button
        onClick={() => setShowQr(s => !s)}
        className="mt-2 w-full text-xs font-semibold text-emerald-700 underline"
      >
        {showQr ? 'Masquer le QR' : 'Afficher le QR de retrait'}
      </button>
    </div>
  );
};

export default MedicationAlertPage;
