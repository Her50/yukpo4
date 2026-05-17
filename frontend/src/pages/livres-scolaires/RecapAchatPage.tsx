import {
  AlertTriangle, ArrowLeft, BookOpen, Camera, Check, ChevronRight,
  Loader2, MapPin, Minus, Package, Pencil, Phone, Plus, Repeat,
  School, ShoppingCart, ShoppingBag, Trash2, X
} from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcherBourse from '../../components/LanguageSwitcherBourse';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { Choix, PanierItem, TypeItem, useParentShop } from '../../hooks/useParentShop';
import { apiGet, apiPost } from '../../services/apiService';

// Picker GPS minimaliste (Google Maps + Places) — chargé à la demande pour
// ne pas alourdir le bundle initial.
const DeliveryMapPicker = lazy(() => import('../../components/livres-scolaires/DeliveryMapPicker'));
// ✅ 2026-05-16 — Autocomplete d'ajout manuel d'un manuel scolaire,
// figé sur la classe en cours (cf prop `classe`).
import ManualAddInline from '../../components/livres-scolaires/ManualAddInline';
import type { ManualAddItem } from '../../components/livres-scolaires/ManualAddInline';

const TYPE_LABELS: Record<TypeItem, string> = {
  livre: 'Livres',
  cahier: 'Cahiers',
  fourniture: 'Fournitures',
  autre: 'Autres',
};

const TYPE_ICONS: Record<TypeItem, React.ReactNode> = {
  livre: <BookOpen className="w-4 h-4" />,
  cahier: <Package className="w-4 h-4" />,
  fourniture: <Package className="w-4 h-4" />,
  autre: <Package className="w-4 h-4" />,
};

const TYPE_COLORS: Record<TypeItem, { bg: string; text: string; border: string }> = {
  livre: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  cahier: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  fourniture: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  autre: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

const CHOIX_LABELS: Record<Choix, string> = {
  neuf: 'Neuf',
  occasion: 'Occasion',
  indifferent: 'Peu importe',
};

const CHOIX_COLORS: Record<Choix, string> = {
  neuf: 'bg-green-100 text-green-700',
  occasion: 'bg-orange-100 text-orange-700',
  indifferent: 'bg-gray-100 text-gray-600',
};

/* ─── Sélecteur neuf/occasion inline ─── */
function ChoixBadge({ item, onUpdate }: { item: PanierItem; onUpdate: (id: string, choix: Choix) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHOIX_COLORS[item.choix]}`}
      >
        {CHOIX_LABELS[item.choix]} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden min-w-[130px]">
          {(['neuf', 'occasion', 'indifferent'] as Choix[]).map(c => (
            <button
              key={c}
              onClick={() => { onUpdate(item.id, c); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-gray-50 ${item.choix === c ? 'text-amber-700 font-bold' : 'text-gray-700'}`}
            >
              {CHOIX_LABELS[c]}
              {item.choix === c && ' ✓'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Gamme switcher pour accessoires ───
 * ✅ 2026-05-16 — Refonte UX : afficher Standard et Premium côte à côte AVEC
 * leur prix calculé, pour que l'user voie immédiatement la différence et
 * comprenne que c'est un choix. Avant : 3 pilules subtiles, beaucoup
 * d'utilisateurs ne réalisaient pas qu'on pouvait basculer.
 * On retire la gamme "Entrée" qui n'est plus pertinente (les vrais bas
 * de gamme ne sont pas dans le référentiel didactique).
 */
type Gamme = 'entree' | 'standard' | 'premium';
const GAMME_LABELS: Record<Gamme, string> = { entree: 'Entrée', standard: 'Standard', premium: 'Premium' };
const GAMME_RATIOS: Record<Gamme, number> = { entree: 0.6, standard: 1.0, premium: 1.5 };

function GammeSwitcher({ item, onUpdate }: { item: PanierItem; onUpdate: (id: string, g: Gamme) => void }) {
  const current: Gamme = item.gamme ?? 'standard';
  const base = item.prixNeuf ?? 0;
  const fmt = (g: Gamme) => Math.round(base * GAMME_RATIOS[g]).toLocaleString('fr-FR');
  return (
    <div className="inline-flex gap-1.5 mt-0.5">
      {(['standard', 'premium'] as Gamme[]).map((g) => {
        const isActive = current === g;
        const isPremium = g === 'premium';
        return (
          <button
            key={g}
            type="button"
            onClick={() => onUpdate(item.id, g)}
            className={`flex flex-col items-center px-2 py-1 rounded-md border-[1.5px] transition-all min-w-[56px] ${
              isActive
                ? isPremium
                  ? 'bg-gradient-to-br from-amber-500 to-yellow-500 border-amber-600 text-white shadow'
                  : 'bg-emerald-500 border-emerald-600 text-white shadow'
                : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
            }`}
            aria-pressed={isActive}
          >
            <span className="text-[9px] font-bold uppercase tracking-wide leading-none">
              {isPremium ? '✨ Haut gamme' : 'Standard'}
            </span>
            {base > 0 && (
              <span className={`text-[10px] font-bold tabular-nums mt-0.5 ${
                isActive ? '' : isPremium ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {fmt(g)} F
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Ligne compacte d'un item du panier (style aligné avec ScanProgrammePage) ─── */
function ItemCard({
  item,
  onRemove,
  onUpdateChoix,
  onUpdateQuantite,
  onUpdateGamme,
  onSetTrocIntent,
}: {
  item: PanierItem;
  onRemove: () => void;
  onUpdateChoix: (id: string, choix: Choix) => void;
  onUpdateQuantite: (id: string, q: number) => void;
  onUpdateGamme: (id: string, g: Gamme) => void;
  /** ✅ 2026-05-16 — Permet le toggle 3-état Neuf/Occasion/Échange.
   *  Échange = occasion + troc_intent=true. */
  onSetTrocIntent?: (id: string, intent: boolean) => void;
  onDuplicate?: (newQ: number) => void;
}) {
  const { t } = useTranslation();
  const quantite = item.quantite ?? 1;
  // Normaliser : workbook/livret comptent comme livres pour l'UI (toggle Neuf/Occasion).
  const rawType = String(item.type ?? '');
  const isLivre = rawType === 'livre' || rawType === 'workbook' || rawType === 'livret';
  const isGammeable = rawType === 'cahier' || rawType === 'fourniture' || rawType === 'autre';
  // Prix effectif selon choix neuf/occasion ou gamme
  const RATIOS: Record<Gamme, number> = { entree: 0.6, standard: 1.0, premium: 1.5 };
  const prixEff = (() => {
    if (item.choix === 'occasion' && item.prixOccasion && item.prixOccasion > 0) return item.prixOccasion;
    const base = item.prixNeuf ?? 0;
    if (isGammeable && base > 0) return Math.round(base * RATIOS[item.gamme || 'standard']);
    return base;
  })();

  /**
   * ✅ 2026-05-16 — Affichage prix transparent selon le choix actif.
   * Pour les livres (occasion / échange), un seul prix fixe ne reflète pas
   * la réalité : la valeur dépend de l'état du livre. On affiche donc :
   *   - Neuf       : prix officiel (montant fixe)
   *   - Occasion   : intervalle min-max selon état acceptable (45%) à bon (70%)
   *   - Échange    : intervalle crédit que l'user reçoit en donnant un livre
   *                  (= prix × ratio_etat × 0.70, marge app 30%)
   * Référence ratios : backend/src/models/livre_scolaire.rs ligne 494-499.
   */
  const RATIO_OCC_MIN = 0.45; // état "acceptable"
  const RATIO_OCC_MAX = 0.70; // état "bon"
  const RATIO_CREDIT = 0.70; // part user sur le livre donné (l'app prend 30%)
  const priceDisplay: { text: string; subtext?: string } = (() => {
    if (isLivre) {
      const base = item.prixNeuf ?? 0;
      if (base <= 0) return { text: '—' };
      if (item.choix === 'occasion' && item.troc_intent) {
        // ✅ Échange — Affichage du GAP à payer (plus motivant que le crédit).
        // Hypothèse de calcul (livre donné ≈ même prix que livre acheté,
        // typique pour des manuels d'une classe à la suivante) :
        //   prix_occ_N+1 ∈ [45% × prix, 70% × prix]      (livre acheté)
        //   crédit_N     ∈ [45% × prix × 0.70, 70% × prix × 0.70]
        //                ∈ [31.5% × prix, 49% × prix]    (livre donné)
        // Gap MIN (livre acheté pas cher × livre donné cher) ≈ -4% → clampé à 0
        // Gap MAX (livre acheté cher × livre donné pas cher) ≈ 38.5%
        const gapMin = Math.max(
          0,
          Math.round(base * (RATIO_OCC_MIN - RATIO_OCC_MAX * RATIO_CREDIT)),
        );
        const gapMax = Math.round(base * (RATIO_OCC_MAX - RATIO_OCC_MIN * RATIO_CREDIT));
        return {
          text:
            gapMin > 0
              ? `${gapMin.toLocaleString('fr-FR')} – ${gapMax.toLocaleString('fr-FR')} F`
              : `≤ ${gapMax.toLocaleString('fr-FR')} F`,
          subtext: t('bourse.recap.price_gap_hint', {
            defaultValue: 'reste après échange',
          }),
        };
      }
      if (item.choix === 'occasion') {
        // Achat occasion : intervalle prix d'achat selon état
        const min = Math.round(base * RATIO_OCC_MIN);
        const max = Math.round(base * RATIO_OCC_MAX);
        return {
          text: `${min.toLocaleString('fr-FR')} – ${max.toLocaleString('fr-FR')} F`,
          subtext: t('bourse.recap.price_used_hint', {
            defaultValue: 'selon état',
          }),
        };
      }
      // Neuf : montant fixe (cas par défaut)
      return { text: `${base.toLocaleString('fr-FR')} F` };
    }
    // Fournitures : prix unique (gamme déjà appliquée via prixEff)
    return { text: prixEff > 0 ? `${prixEff.toLocaleString('fr-FR')} F` : '—' };
  })();
  return (
    <div className="px-3 py-3 border-b border-gray-100 last:border-b-0 bg-white">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px] leading-tight text-gray-900" title={item.titre} dir="auto">
            {item.titre}
          </p>
          {(item.auteur || item.editeur) && (
            <p className="text-xs text-gray-500 mt-1 truncate" dir="auto">
              {[item.auteur, item.editeur].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Quantité — stepper aéré */}
        <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-lg shrink-0 overflow-hidden">
          <button
            onClick={() => onUpdateQuantite(item.id, Math.max(1, quantite - 1))}
            disabled={quantite <= 1}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-base leading-none"
            aria-label={t('bourse.recap.decrease')}>−</button>
          <span className="text-xs font-bold text-gray-800 w-6 text-center tabular-nums leading-none">{quantite}</span>
          <button
            onClick={() => onUpdateQuantite(item.id, quantite + 1)}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-base leading-none"
            aria-label={t('bourse.recap.increase')}>+</button>
        </div>

        {/* Prix unitaire — affichage adapté au choix Neuf/Occasion/Échange. */}
        <div className="flex flex-col items-end shrink-0 min-w-[86px] leading-tight">
          <span
            className={`text-right text-sm font-bold tabular-nums whitespace-nowrap ${
              priceDisplay.text === '—' ? 'text-gray-300' : 'text-amber-700'
            }`}
            title={priceDisplay.text === '—' ? t('bourse.recap.price_unavailable') : undefined}
          >
            {priceDisplay.text}
          </span>
          {priceDisplay.subtext && (
            <span className="text-[9px] text-gray-500 italic leading-none mt-0.5">
              {priceDisplay.subtext}
            </span>
          )}
        </div>

        {/* Supprimer */}
        <button onClick={onRemove}
          className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 shrink-0"
          title={t('bourse.recap.remove_item')} aria-label={t('bourse.recap.remove_aria')}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Toggle Neuf/Occasion/Échange (livres) ou Gamme (fournitures) sous-ligne.
          ✅ 2026-05-16 — Le toggle livres passe à 3 états :
            - Neuf      : choix='neuf', troc_intent=false
            - Occasion  : choix='occasion', troc_intent=false (achat d'occasion sans donner de livre)
            - Échange   : choix='occasion', troc_intent=true (l'utilisateur va proposer un livre en troc)
          La distinction Occasion vs Échange permet d'orienter l'user vers
          /rentree pour la capture photo (cf bouton "troc pending"). */}
      {(isLivre || (isGammeable && item.prixNeuf && item.prixNeuf > 0)) && (
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isLivre && (
            <div className="inline-flex bg-gray-100 rounded p-[1px] gap-[1px] items-center">
              <button
                onClick={() => {
                  onUpdateChoix(item.id, 'neuf');
                  onSetTrocIntent?.(item.id, false);
                }}
                className={`px-1.5 py-px rounded text-[9px] font-bold transition-colors ${
                  item.choix === 'neuf' ? 'bg-emerald-500 text-white' : 'text-gray-500'
                }`}>{t('bourse.recap.new')}</button>
              <button
                onClick={() => {
                  onUpdateChoix(item.id, 'occasion');
                  onSetTrocIntent?.(item.id, false);
                }}
                className={`px-1.5 py-px rounded text-[9px] font-bold transition-colors ${
                  item.choix === 'occasion' && !item.troc_intent ? 'bg-orange-500 text-white' : 'text-gray-500'
                }`}>{t('bourse.recap.used')}</button>
              <button
                onClick={() => {
                  onUpdateChoix(item.id, 'occasion');
                  onSetTrocIntent?.(item.id, true);
                }}
                className={`px-1.5 py-px rounded text-[9px] font-bold transition-colors ${
                  item.choix === 'occasion' && item.troc_intent ? 'bg-amber-500 text-white' : 'text-gray-500'
                }`}
                title={t('bourse.recap.exchange_hint', { defaultValue: 'Je propose un livre en échange' })}
              >{t('bourse.recap.exchange', { defaultValue: 'Échange' })}</button>
            </div>
          )}
          {isGammeable && item.prixNeuf && item.prixNeuf > 0 && (
            <GammeSwitcher item={item} onUpdate={onUpdateGamme} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Modale de livraison ─── */
interface DeliveryInfo {
  adresse: string;
  telephone: string;
  note: string;
  gps?: { lat: number; lon: number };
}

function DeliveryModal({
  defaultPhone,
  defaultAddress,
  defaultGps,
  onConfirm,
  onClose,
}: {
  defaultPhone?: string;
  /** ✅ 2026-05-16 — Pré-remplit l'adresse si l'utilisateur a déjà fait
   *  l'onboarding livraison (DeliveryLocationOnboardingPage).
   *  L'utilisateur peut quand même modifier avant de valider. */
  defaultAddress?: string;
  defaultGps?: { lat: number; lon: number } | null;
  onConfirm: (info: DeliveryInfo) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [adresse, setAdresse] = useState(defaultAddress ?? '');
  const [telephone, setTelephone] = useState(defaultPhone ?? '');
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(defaultGps ?? null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  /** ✅ 2026-05-16 — Position GPS courante du navigateur pour biaiser
   *  l'autocomplete. Priorité décroissante pour le biais :
   *    1. coords du lieu déjà choisi par l'user
   *    2. position GPS courante (browserGps)
   *    3. fallback Douala côté backend si rien
   *  La géoloc est demandée silencieusement au mount — l'user voit le
   *  popup natif du navigateur, peut refuser sans casser le flow. */
  const [browserGps, setBrowserGps] = useState<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBrowserGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        // permission refusée ou erreur — pas bloquant
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);
  const biasGps = coords ?? browserGps;

  // ✅ 2026-05-16 — Autocomplete via /api/places/autocomplete (Google Places
  // côté backend, fallback Photon si pas de clé OU si Google échoue/bloqué).
  // Bien plus précis que Nominatim OSM : rues, écoles, points d'intérêt,
  // et pas juste les quartiers. Le backend a déjà la clé serveur Google +
  // restrictions de quota, ET un fallback Photon automatique si quota dépassé
  // ou compte GCP suspendu (le frontend voit la même struct dans les 2 cas).
  type Suggestion = {
    description: string;
    place_id?: string | null;
    // Présents en mode fallback Photon (évite le 2e fetch).
    lat?: number | null;
    lng?: number | null;
  };
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const handleAdresseChange = (val: string) => {
    setAdresse(val);
    setShowSuggestions(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (val.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams();
        params.set('query', val);
        // ✅ Biais GPS prioritaire (cf. biasGps : lieu déjà choisi > géoloc
        // navigateur > Douala par défaut côté backend).
        if (biasGps) {
          params.set('lat', String(biasGps.lat));
          params.set('lng', String(biasGps.lon));
          params.set('radius', '25000');
        }
        const r = await apiGet(`/api/places/autocomplete?${params}`);
        const d = await r.json();
        const items = (d?.results || []) as Suggestion[];
        setSuggestions(items);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 350);
  };

  /** ✅ 2026-05-16 — Capture position courante au clic.
   *  Demande géoloc haute précision (utilise le GPS du téléphone si dispo),
   *  puis POST /api/geocoding/reverse pour récupérer l'adresse texte
   *  correspondante (Google reverse côté backend, fallback Mapbox/offline). */
  const [capturingPosition, setCapturingPosition] = useState(false);
  const captureCurrentPosition = async () => {
    if (!navigator.geolocation) {
      toast({
        title: t('bourse.recap.gps_unsupported', {
          defaultValue: 'Géolocalisation non supportée par ce navigateur',
        }),
        variant: 'destructive',
      });
      return;
    }
    setCapturingPosition(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lon: longitude });
      // Reverse geocoding via backend
      const r = await apiPost('/api/geocoding/reverse', { latitude, longitude });
      const d = await r.json().catch(() => ({}));
      const formatted =
        d?.formatted_address || d?.address || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setAdresse(formatted);
      toast({
        title: t('bourse.recap.gps_captured', { defaultValue: 'Position captée' }),
        description: formatted,
      });
    } catch (err: any) {
      const code = err?.code;
      const msg =
        code === 1
          ? t('bourse.recap.gps_denied', {
              defaultValue: 'Permission refusée. Autorisez la géolocalisation dans votre navigateur.',
            })
          : code === 3
            ? t('bourse.recap.gps_timeout', {
                defaultValue: 'Temps écoulé. Réessayez à l\'extérieur ou près d\'une fenêtre.',
              })
            : t('bourse.recap.gps_error', {
                defaultValue: 'Impossible de capter votre position. Réessayez.',
              });
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setCapturingPosition(false);
    }
  };

  /** Au pick :
   *   1. Si la suggestion a déjà lat/lng (fallback Photon) → utiliser direct
   *   2. Sinon si place_id Google → 2e fetch /api/places/google-business-details
   *   3. Sinon → adresse texte sans coords, l'user peut rectifier via map picker */
  const pickSuggestion = async (s: Suggestion) => {
    setAdresse(s.description);
    setShowSuggestions(false);
    setSuggestions([]);
    // Cas Photon : coords déjà dans la suggestion
    if (typeof s.lat === 'number' && typeof s.lng === 'number') {
      setCoords({ lat: s.lat, lon: s.lng });
      return;
    }
    // Cas Google : 2e fetch via place_id
    if (!s.place_id) return;
    try {
      const r = await apiGet(
        `/api/places/google-business-details?place_id=${encodeURIComponent(s.place_id)}`,
      );
      const d = await r.json().catch(() => ({}));
      const loc = d?.data?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        setCoords({ lat: loc.lat, lon: loc.lng });
      }
    } catch {
      // silent — l'user peut rectifier via map picker
    }
  };

  // Validation WhatsApp : 8 chiffres min (numéros internationaux 8-15 chiffres)
  const phoneDigits = telephone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 8 && phoneDigits.length <= 15;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 pb-10 sm:pb-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-base">{t('bourse.recap.delivery_title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Adresse de livraison — autocomplete via backend /api/places */}
        <div className="mb-4 relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t('bourse.recap.delivery_address_required')} <span className="text-red-500">*</span>
            </label>
            {/* ✅ 2026-05-16 — Bouton "Capter ma position courante".
                Demande géoloc haute précision + reverse geocoding via backend. */}
            <button
              type="button"
              onClick={captureCurrentPosition}
              disabled={capturingPosition}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 disabled:opacity-50"
              title={t('bourse.recap.gps_button_hint', {
                defaultValue: 'Utiliser ma position GPS actuelle',
              })}
            >
              {capturingPosition ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MapPin className="w-3.5 h-3.5" />
              )}
              {t('bourse.recap.gps_button', { defaultValue: 'Ma position' })}
            </button>
          </div>
          <div className="relative">
            <input
              value={adresse}
              onChange={e => handleAdresseChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={t('bourse.recap.delivery_address_placeholder')}
              autoComplete="off"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 pr-9 outline-none focus:border-amber-400"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => pickSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 border-b border-gray-100 last:border-b-0 flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-tight">{s.description}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-500 mt-1">
            {t('bourse.recap.address_help')}
          </p>
        </div>

        {/* Localisation cartographique — bouton qui ouvre la carte interactive
            (Google Maps + IA déjà implémentée dans l'app), au lieu d'une auto-
            capture. Le parent place lui-même le marqueur où la livraison doit
            se faire — beaucoup plus fiable qu'un GPS qui hésite. */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('bourse.recap.location_precise')}
          </label>
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className={`w-full flex items-center gap-2.5 border rounded-xl px-3 py-2.5 text-sm transition-colors ${
              coords
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <MapPin className={`w-4 h-4 shrink-0 ${coords ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span className="flex-1 text-left font-medium">
              {coords
                ? `${t('bourse.recap.position_set')} · ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
                : t('bourse.recap.choose_on_map')}
            </span>
            {coords && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
          <p className="text-[11px] text-gray-500 mt-1">
            {t('bourse.recap.location_help')}
          </p>
        </div>

        {/* WhatsApp — utilisé pour notifier le statut commande + livraison */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('bourse.recap.whatsapp_number')} <span className="text-red-500">*</span>
          </label>
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 ${
            telephone && !phoneValid
              ? 'border-red-300 bg-red-50'
              : phoneValid
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-gray-200'
          }`}>
            <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
            <input
              value={telephone}
              onChange={e => setTelephone(e.target.value)}
              placeholder={t('bourse.recap.whatsapp_placeholder')}
              type="tel"
              inputMode="tel"
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {phoneValid && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </div>
          {telephone && !phoneValid ? (
            <p className="text-[11px] text-red-600 mt-1">
              {t('bourse.recap.phone_invalid')}
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1">
              {t('bourse.recap.whatsapp_help')}
            </p>
          )}
        </div>

        {/* Note */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('bourse.recap.note_label')}
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t('bourse.recap.note_placeholder')}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-amber-400 resize-none"
          />
        </div>

        <button
          disabled={!adresse.trim() || !phoneValid}
          onClick={() => onConfirm({ adresse, telephone, note, gps: coords ?? undefined })}
          className="w-full bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-2xl text-sm"
        >
          {t('bourse.recap.confirm_order')}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">
          {!adresse.trim()
            ? t('bourse.recap.addr_required')
            : !phoneValid
              ? t('bourse.recap.phone_required')
              : !coords
                ? t('bourse.recap.no_gps_help')
                : t('bourse.recap.find_closest')}
        </p>
      </div>

      {/* Picker GPS — chargé uniquement quand l'utilisateur la demande */}
      {showMapPicker && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
          <DeliveryMapPicker
            onClose={() => setShowMapPicker(false)}
            initialLocation={coords ? { lat: coords.lat, lng: coords.lon } : undefined}
            onConfirm={({ lat, lng, address: addr }) => {
              setCoords({ lat, lon: lng });
              if (addr && !adresse.trim()) setAdresse(addr);
              setShowMapPicker(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ─── Modale de décision pour les livres marqués "occasion" ───
 *  S'affiche au premier passage sur le récap si le panier contient des items
 *  avec choix='occasion'. Trois actions :
 *   • Aller au troc (l'utilisateur a des livres à échanger)
 *   • Basculer en neuf (l'utilisateur n'a rien à échanger, prend du neuf)
 *   • Continuer en occasion sans troc (achat direct chez un libraire/vendeur)
 */
function OccasionDecisionModal({
  occasionCount,
  onWantTroc,
  onSwitchToNeuf,
  onKeepOccasion,
}: {
  occasionCount: number;
  onWantTroc: () => void;
  onSwitchToNeuf: () => void;
  onKeepOccasion: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 pb-8 sm:pb-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
            <Repeat className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight">
              {t(occasionCount > 1 ? 'bourse.recap.decision_title_other' : 'bourse.recap.decision_title_one', { count: occasionCount })}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('bourse.recap.decision_subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <button
            onClick={onWantTroc}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-amber-300 bg-amber-50 text-left active:bg-amber-100"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <Repeat className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-900">{t('bourse.recap.decision_troc_title')}</p>
              <p className="text-[11px] text-amber-700">{t('bourse.recap.decision_troc_desc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
          </button>

          <button
            onClick={onSwitchToNeuf}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white text-left hover:bg-gray-50"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t('bourse.recap.decision_neuf_title')}</p>
              <p className="text-[11px] text-gray-500">{t('bourse.recap.decision_neuf_desc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>

          <button
            onClick={onKeepOccasion}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white text-left hover:bg-gray-50"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t('bourse.recap.decision_occasion_title')}</p>
              <p className="text-[11px] text-gray-500">{t('bourse.recap.decision_occasion_desc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          {t('bourse.recap.decision_help')}
        </p>
      </div>
    </div>
  );
}

const TROC_DECISION_KEY = 'yukpo_recap_troc_choice';

/* ─── Page principale ─── */
const RecapAchatPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { enfants, panier, removeItem, updateChoix, updateQuantite, updateGamme, getItemsForEnfant, countByEnfant, clearPanierForEnfant, clearPanier, addItems, setTrocIntent } = useParentShop();

  // ✅ 2026-05-17 — Diagnostique panier vide en prod : log au mount ce que
  // useParentShop nous a donné + ce qu'il y a dans localStorage. Permet de
  // distinguer un bug de timing (lS plein mais hook vide) d'un bug de
  // persistance (lS vide alors qu'on vient d'ajouter).
  useEffect(() => {
    try {
      const snap = localStorage.getItem('yukpo_parent_shop_v4');
      console.log('[Recap] mount — hook: enfants=', enfants.length, 'panier=', panier.length, 'localStorage=', snap);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [activeEnfantId, setActiveEnfantId] = useState(
    enfants.find(e => countByEnfant(e.id) > 0)?.id || enfants[0]?.id || ''
  );
  // ✅ 2026-05-17 — Auto-correction si activeEnfantId devient stale :
  // si enfants se peuple APRÈS le mount (ex. race avec localStorage write
  // depuis la page précédente), on sélectionne le premier enfant qui a
  // des items dans le panier. Sans ce useEffect, activeEnfantId restait
  // à '' et la liste paraissait vide alors que le panier était plein.
  useEffect(() => {
    if (activeEnfantId && enfants.some(e => e.id === activeEnfantId)) return;
    const next =
      enfants.find(e => countByEnfant(e.id) > 0)?.id ||
      enfants[0]?.id ||
      '';
    if (next && next !== activeEnfantId) setActiveEnfantId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enfants.length, panier.length]);
  /** 'classe' = vue par enfant (onglets de classes) ; 'rubrique' = vue agrégée
   *  toutes classes confondues (cumul des quantités d'un même article + gamme). */
  const [viewMode, setViewMode] = useState<'classe' | 'rubrique'>('classe');
  const [showDelivery, setShowDelivery] = useState(false);
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  /* ─── ✅ 2026-05-17 — Filtres MULTI Livres + Fournitures ───
   *  Refonte UX : au lieu d'onglets exclusifs (un seul visible à la fois),
   *  on a 2 chips de FILTRE indépendants — tous les deux activés par défaut.
   *  L'utilisateur voit tout son panier en une seule liste, et peut masquer
   *  un type s'il veut focus sur l'autre. Un seul bouton "Commander" au
   *  bas valide TOUT le panier (mix) en un appel.
   */
  const LIVRE_TYPES = new Set(['livre', 'workbook', 'livret', 'manuel', 'textbook', 'book']);
  const isLivreItem = (it: PanierItem) => LIVRE_TYPES.has(String(it.type ?? '').toLowerCase());
  // Deux flags indépendants : par défaut on affiche tout.
  const [showLivres, setShowLivres] = useState(true);
  const [showFournitures, setShowFournitures] = useState(true);
  // État dédié au sélecteur de la section "ManualAddInline" (ajouter un
  // article manquant). Indépendant des filtres d'affichage.
  const [manualAddType, setManualAddType] = useState<'livres' | 'fournitures'>('livres');
  const countLivres = panier.filter(isLivreItem).length;
  const countFournitures = panier.filter((p) => !isLivreItem(p)).length;
  // Garantie qu'au moins un filtre reste actif si les 2 ont du contenu —
  // si l'utilisateur désactive le dernier filtre actif, on réactive l'autre.
  useEffect(() => {
    if (!showLivres && !showFournitures) {
      if (countLivres > 0) setShowLivres(true);
      else if (countFournitures > 0) setShowFournitures(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLivres, showFournitures]);

  /* ─── Infos de livraison persistées (DeliveryLocationOnboardingPage) ───
   *  ✅ 2026-05-16 — Si l'utilisateur a déjà rempli son adresse + GPS lors de
   *  l'onboarding, on les pré-remplit dans la DeliveryModal pour éviter de
   *  redemander à chaque commande. L'user peut toujours modifier ponctuellement. */
  const [savedDelivery, setSavedDelivery] = useState<{
    address?: string;
    gps?: { lat: number; lon: number } | null;
    phone?: string;
  }>({});
  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/api/users/me/delivery-info');
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!data?.success) return;
        const gps =
          typeof data.delivery_location_lat === 'number' &&
          typeof data.delivery_location_lng === 'number'
            ? { lat: data.delivery_location_lat, lon: data.delivery_location_lng }
            : null;
        setSavedDelivery({
          address: data.delivery_location_text || undefined,
          gps,
          phone: data.whatsapp_number_primary || undefined,
        });
      } catch {
        // silent — onboarding pas encore fait, comportement par défaut
      }
    })();
  }, []);

  /* ─── Crédit Bourse prévisionnel issu du troc ───
   *  À chaque changement du total commande, on appelle match-all-pending
   *  pour calculer combien de XAF de crédit le parent peut appliquer
   *  immédiatement sur sa commande. Le crédit n'est PAS encore engagé en
   *  base — il l'est seulement à la finalisation (POST /commandes).
   */
  const [pendingCredit, setPendingCredit] = useState<{
    available: number;        // crédit total prévisionnel (livres avec match)
    engageable: number;       // capé par % de la commande + cap absolu
    matchedCount: number;     // nb de livres qui ont déjà un match potentiel
  }>({ available: 0, engageable: 0, matchedCount: 0 });

  // ✅ Dette troc (rollback chain après usage du crédit). Récupérée à cette
  // commande en l'ajoutant au total à payer. 0 si pas de dette.
  const [bourseDebtXaf, setBourseDebtXaf] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/api/bourse-livre/wallet/balance');
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.success) {
          setBourseDebtXaf(Number(data.bourse_debt_xaf ?? 0));
        }
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ─── Décision troc/occasion ───
   *  Au montage : si le panier contient des livres marqués "occasion" et que
   *  l'utilisateur n'a pas encore pris de décision, on affiche la modale.
   */
  const occasionItemsInPanier = panier.filter(p => p.choix === 'occasion');
  useEffect(() => {
    const decision = sessionStorage.getItem(TROC_DECISION_KEY);
    if (!decision && occasionItemsInPanier.length > 0) {
      setShowOccasionModal(true);
    }
    // Si le panier ne contient plus aucun item occasion, on réinitialise la décision
    if (occasionItemsInPanier.length === 0 && decision) {
      sessionStorage.removeItem(TROC_DECISION_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panier.length]);

  const handleWantTroc = () => {
    // ✅ 2026-05-10 : le troc se fait désormais article-par-article depuis
    // /rentree (Centre de Rentrée), pas via une page dédiée.
    sessionStorage.setItem(TROC_DECISION_KEY, 'troc');
    setShowOccasionModal(false);
    navigate('/rentree');
  };
  const handleSwitchToNeuf = () => {
    occasionItemsInPanier.forEach(it => updateChoix(it.id, 'neuf'));
    sessionStorage.setItem(TROC_DECISION_KEY, 'neuf');
    setShowOccasionModal(false);
    toast({ title: `${occasionItemsInPanier.length} article(s) basculé(s) en neuf` });
  };
  const handleKeepOccasion = () => {
    sessionStorage.setItem(TROC_DECISION_KEY, 'occasion-direct');
    setShowOccasionModal(false);
  };
  /** Permet à l'utilisateur de réouvrir la modale s'il change d'avis. */
  const reopenOccasionModal = () => {
    sessionStorage.removeItem(TROC_DECISION_KEY);
    setShowOccasionModal(true);
  };

  const activeEnfant = enfants.find(e => e.id === activeEnfantId);
  const activeItems = activeEnfant ? getItemsForEnfant(activeEnfant.id) : [];

  /* Grouper par type — toutes les variantes "manuel-like" et "fourniture-like"
   *  sont ramenées à la catégorie principale pour que la section "Manuels &
   *  workbooks" apparaisse toujours EN PREMIER (avant cahiers et fournitures). */
  const normalizeType = (t: any): TypeItem => {
    const raw = String(t ?? '').toLowerCase();
    // Tout ce qui ressemble à un livre/manuel scolaire → 'livre'
    if (['livre', 'workbook', 'livret', 'manuel', 'textbook', 'book'].includes(raw)) return 'livre';
    if (raw === 'cahier') return 'cahier';
    // 'accessoire' (règle, calculatrice, etc.) = fourniture côté UX
    if (['fourniture', 'accessoire', 'supply'].includes(raw)) return 'fourniture';
    if (raw === 'autre') return 'autre';
    return 'autre';
  };
  // Ordre figé : Manuels d'abord (la pièce maîtresse de la rentrée),
  // puis cahiers, fournitures, et enfin un éventuel "Autres".
  // ✅ 2026-05-17 — Filtres MULTI : on affiche les types selon les chips
  // actifs. Les 2 actifs par défaut → tout est visible.
  const types: TypeItem[] = [];
  if (showLivres) types.push('livre');
  if (showFournitures) types.push('cahier', 'fourniture', 'autre');
  // Tri intra-section : on stabilise par titre alphabétique pour qu'un même
  // panier soit affiché identiquement quel que soit l'ordre d'ajout (scan,
  // suggestions, école partenaire).
  const sortItems = (a: PanierItem, b: PanierItem) =>
    (a.titre || '').localeCompare(b.titre || '', undefined, { sensitivity: 'base' });
  const grouped = types
    .map(t => ({ type: t, items: activeItems.filter(it => normalizeType(it.type) === t).sort(sortItems) }))
    .filter(g => g.items.length > 0);

  /* ─── Vue agrégée par rubrique (toutes classes) ───
   *  Règles métier (validées avec le PO) :
   *   • Même libellé + même gamme  → 1 ligne, qty = somme des qty toutes classes,
   *     prix = max des prixNeuf rencontrés (prix de référence le plus à jour).
   *   • Même libellé + gammes différentes → autant de lignes que de gammes.
   *   • Le `choix` (neuf/occasion) sépare aussi les lignes : un livre demandé
   *     en neuf pour une classe et en occasion pour une autre reste en 2 lignes.
   *  La clé d'agrégation : titre normalisé (lower+trim) + type + gamme + choix.
   */
  const aggregatedByRubrique = (() => {
    const buckets = new Map<string, {
      sample: PanierItem;        // un item représentatif (pour titre, prix, etc.)
      totalQuantite: number;
      classes: string[];         // classes contributrices, ex: ["6ème", "5ème"]
      enfantIds: string[];       // pour permettre la suppression depuis cette vue
    }>();
    for (const it of panier) {
      const titreNorm = (it.titre || '').toLowerCase().trim();
      const key = `${it.type}::${titreNorm}::${it.gamme || '-'}::${it.choix || 'neuf'}`;
      const enfant = enfants.find(e => e.id === it.enfantId);
      const classeLabel = enfant?.classe || '';
      const existing = buckets.get(key);
      if (existing) {
        existing.totalQuantite += it.quantite ?? 1;
        if (classeLabel && !existing.classes.includes(classeLabel)) {
          existing.classes.push(classeLabel);
        }
        existing.enfantIds.push(it.enfantId);
        // Conserve le prix le plus élevé (référence) pour ne pas sous-estimer
        if ((it.prixNeuf ?? 0) > (existing.sample.prixNeuf ?? 0)) {
          existing.sample = it;
        }
      } else {
        buckets.set(key, {
          sample: it,
          totalQuantite: it.quantite ?? 1,
          classes: classeLabel ? [classeLabel] : [],
          enfantIds: [it.enfantId],
        });
      }
    }
    // Regrouper par type pour respecter le même ordre de sections que la vue par classe.
    // 'workbook' (livret d'exercices) est un livre → on le ramène à 'livre' pour
    // qu'il s'affiche dans la section "Manuels & workbooks", pas en "Fournitures".
    const byType: Record<TypeItem, Array<typeof buckets extends Map<any, infer V> ? V : never>> = {
      livre: [], cahier: [], fourniture: [], autre: [],
    };
    for (const v of buckets.values()) {
      const safeType = normalizeType(v.sample.type);
      byType[safeType].push(v);
    }
    // Tri intra-section alphabétique pour cohérence avec la vue par classe.
    for (const tk of types) {
      byType[tk].sort((a, b) =>
        (a.sample.titre || '').localeCompare(b.sample.titre || '', undefined, { sensitivity: 'base' }),
      );
    }
    return types
      .map(t => ({ type: t, lignes: byType[t] }))
      .filter(g => g.lignes.length > 0);
  })();

  /* ─── Calcul des bornes [min, max] par item ───
   *  Cohérent avec les ratios backend (RATIO_ETAT_BON = 0.70, ACCEPTABLE = 0.40) :
   *   - choix='neuf'      : min = max = prix_neuf
   *   - choix='occasion'  : min = prix_neuf × 0.40, max = prix_neuf × 0.70
   *     (sauf si prixOccasion est déjà connu après analyse IA → valeur figée)
   */
  const RATIO_OCCASION_MIN = 0.40; // état "acceptable"
  const RATIO_OCCASION_MAX = 0.70; // état "bon"

  const estimateItemRange = (it: PanierItem): { min: number; max: number } => {
    const q = it.quantite ?? 1;
    if (it.choix === 'occasion') {
      // Si l'IA a déjà calculé la valeur (livre photographié au troc) → valeur figée
      if (it.prixOccasion && it.prixOccasion > 0) {
        return { min: it.prixOccasion * q, max: it.prixOccasion * q };
      }
      // Sinon : fourchette estimée d'après le prix neuf
      const base = it.prixNeuf ?? 0;
      return {
        min: Math.round(base * RATIO_OCCASION_MIN) * q,
        max: Math.round(base * RATIO_OCCASION_MAX) * q,
      };
    }
    // Neuf ou indifférent : prix figé
    const v = (it.prixNeuf ?? it.prixOccasion ?? 0) * q;
    return { min: v, max: v };
  };

  const estimateItem = (it: PanierItem): number => estimateItemRange(it).max;

  const totalEnfantRange = activeItems.reduce(
    (s, it) => {
      const r = estimateItemRange(it);
      return { min: s.min + r.min, max: s.max + r.max };
    },
    { min: 0, max: 0 }
  );
  const totalEnfant = totalEnfantRange.max;

  const grandTotalRange = enfants.reduce(
    (s, e) => {
      const items = getItemsForEnfant(e.id);
      const r = items.reduce(
        (ss, it) => {
          const ir = estimateItemRange(it);
          return { min: ss.min + ir.min, max: ss.max + ir.max };
        },
        { min: 0, max: 0 }
      );
      return { min: s.min + r.min, max: s.max + r.max };
    },
    { min: 0, max: 0 }
  );
  const grandTotal = grandTotalRange.max;
  const hasOccasionRange = grandTotalRange.min !== grandTotalRange.max;
  const totalItems = panier.length;

  /* Appel match-all-pending : déclenché quand le total commande change
   * de manière significative. Debouncé pour ne pas spammer le backend. */
  useEffect(() => {
    if (!user || grandTotal <= 0) {
      setPendingCredit({ available: 0, engageable: 0, matchedCount: 0 });
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiPost('/api/troc-livres/match-all-pending', { target_amount: grandTotal });
        const d = await res.json().catch(() => ({}));
        if (d?.success) {
          setPendingCredit({
            available: Number(d.credit_total_disponible) || 0,
            engageable: Number(d.credit_engageable_max) || 0,
            matchedCount: Number(d.match_count) || 0,
          });
        }
      } catch {
        // silencieux : si l'endpoint échoue (rare), on n'affiche pas de crédit
      }
    }, 600);
    return () => clearTimeout(t);
  }, [user?.id, grandTotal]);

  // ✅ 2026-05-11 : frais de livraison forfaitaires globaux (couvre la
  // logistique de tous les articles de toutes les classes + collecte des
  // livres en troc le cas échéant). Côté courrier, ce montant est optimisé
  // selon la distance/zone — mais pour le parent c'est un forfait simple.
  const DELIVERY_FEE_XAF = 1000;
  const fraisLivraison = totalItems > 0 ? DELIVERY_FEE_XAF : 0;

  // Total réellement à payer après application du crédit prévisionnel,
  // ajout des frais de livraison, ET récupération de la dette troc éventuelle.
  // La dette est ajoutée AU total à payer (le user la règle au coursier).
  const grandTotalAvecCredit = Math.max(
    0,
    grandTotal - pendingCredit.engageable + fraisLivraison + bourseDebtXaf,
  );

  if (totalItems === 0) {
    // ✅ 2026-05-16 — Écran "panier vide" repensé : on affiche les MÊMES
    // 4 CTAs que la page d'accueil pour permettre à l'user de démarrer une
    // commande directement sans devoir repasser par la home.
    //
    // DEBUG visible : si le user a un panier dans localStorage MAIS pas
    // d'enfants correspondants (items orphelins), on lui montre + bouton
    // de réinitialisation pour débloquer la situation.
    let rawPanier: any[] = [];
    let rawEnfants: any[] = [];
    try {
      const raw = localStorage.getItem('yukpo_parent_shop_v4');
      if (raw) {
        const parsed = JSON.parse(raw);
        rawPanier = Array.isArray(parsed.panier) ? parsed.panier : [];
        rawEnfants = Array.isArray(parsed.enfants) ? parsed.enfants : [];
      }
    } catch { /* localStorage indispo */ }
    const orphanCount = rawPanier.filter((p) => !rawEnfants.some((e) => e.id === p?.enfantId)).length;
    const purgeAll = () => {
      try {
        localStorage.removeItem('yukpo_parent_shop_v4');
        localStorage.removeItem('yukpo_parent_shop_v3');
        localStorage.removeItem('yukpo_parent_shop_v2');
        window.location.reload();
      } catch { /* */ }
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-amber-600 px-4 pt-10 pb-5 text-white flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-bold text-lg flex-1">{t('bourse.recap.title')}</h1>
          <LanguageSwitcherBourse tone="white" />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* ✅ 2026-05-16 — Debug visible : si on voit cet écran ALORS QUE
              le localStorage contient des items, c'est un bug. On le signale
              à l'user et on propose un bouton de réinitialisation. */}
          {(rawPanier.length > 0 || rawEnfants.length > 0) && (
            <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-900 mb-1">
                ⚠️ Données détectées dans votre navigateur
              </p>
              <p className="text-[11px] text-amber-800 leading-snug mb-2">
                {rawPanier.length} article(s), {rawEnfants.length} classe(s){' '}
                {orphanCount > 0 && (
                  <span className="font-bold">
                    — dont {orphanCount} orphelin(s) (sans classe associée)
                  </span>
                )}
                . Si vous attendiez d'y voir vos articles, vos données peuvent
                avoir été sauvegardées avant la dernière mise à jour. Cliquez
                ci-dessous pour réinitialiser et recommencer proprement.
              </p>
              <button
                onClick={purgeAll}
                className="bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg active:bg-amber-700"
              >
                🔄 Réinitialiser mon panier
              </button>
            </div>
          )}

          {/* ✅ 2026-05-16 — Panier vide : message minimaliste.
              Décision user : pas de boutons d'action ici, juste un message
              clair "aucun article ajouté". Les CTAs d'ajout sont déjà sur la
              page d'accueil, inutile de les dupliquer. */}
          <div className="text-center py-12">
            <ShoppingCart className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 text-base font-semibold mb-1">
              {t('bourse.recap.empty_title', { defaultValue: 'Votre panier est vide' })}
            </p>
            <p className="text-gray-500 text-sm">
              {t('bourse.recap.empty_help', {
                defaultValue: "Aucun article n'a encore été ajouté.",
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showOccasionModal && (
        <OccasionDecisionModal
          occasionCount={occasionItemsInPanier.length}
          onWantTroc={handleWantTroc}
          onSwitchToNeuf={handleSwitchToNeuf}
          onKeepOccasion={handleKeepOccasion}
        />
      )}
      {showDelivery && (
        <DeliveryModal
          // Pré-remplissage du WhatsApp : on privilégie l'onboarding livraison
          // (savedDelivery.phone, le numéro qu'on a confirmé pour les notifs),
          // puis user.phone du JWT, puis le cache local (yukpo_user_phone).
          // L'utilisateur peut toujours éditer si besoin.
          defaultPhone={
            savedDelivery.phone ||
            user?.phone ||
            (typeof localStorage !== 'undefined'
              ? localStorage.getItem('yukpo_user_phone') ?? ''
              : '')
          }
          // ✅ 2026-05-16 — Adresse et GPS pré-remplis depuis l'onboarding.
          // Évite à l'user de tout retaper s'il livre toujours au même endroit.
          defaultAddress={savedDelivery.address}
          defaultGps={savedDelivery.gps}
          onClose={() => setShowDelivery(false)}
          onConfirm={async info => {
            // Construit le payload pour POST /api/librairie-network/commandes
            // Aligné sur la struct backend CreateCommandeMixteRequest.
            setSubmittingOrder(true);
            try {
              const livres_neufs: any[] = [];
              const livres_occasion: { livre_scolaire_id: number; quantite: number }[] = [];

              for (const e of enfants) {
                const items = getItemsForEnfant(e.id);
                for (const it of items) {
                  // Cas livre d'occasion AVEC livre proposé au troc → livres_occasion[]
                  if (it.choix === 'occasion' && it.trocLivreId) {
                    livres_occasion.push({
                      livre_scolaire_id: it.trocLivreId,
                      quantite: it.quantite ?? 1,
                    });
                    continue;
                  }
                  // Tous les autres cas (neuf, indifférent, occasion-sans-troc) → livres_neufs
                  livres_neufs.push({
                    titre: it.titre,
                    auteur: it.auteur ?? null,
                    editeur: it.editeur ?? null,
                    isbn: it.isbn ?? null,
                    classe: e.classe || '',
                    matiere: it.matiere ?? '',
                    niveau: e.niveau ?? null,
                    prix_officiel: it.prixNeuf ?? 0,
                    quantite: it.quantite ?? 1,
                    est_au_programme: true,
                  });
                }
              }

              // Le backend rejette budget_total <= 0. Si tous les articles sont
              // des fournitures sans prix encore, on plancher à 1 pour passer la
              // validation — le total réel est recalculé côté serveur.
              const safeBudget = grandTotal > 0 ? grandTotal : 1;
              // Crédit Bourse engagé sur cette commande (issu des livres de troc).
              // Le backend doit débiter wallet_credit_bourse + engager les livres.
              const credit_used_xaf = pendingCredit.engageable > 0
                ? Math.min(pendingCredit.engageable, safeBudget)
                : 0;
              const payload = {
                budget_total: safeBudget,
                credit_bourse_used_xaf: credit_used_xaf,
                // ✅ 2026-05-11 : frais de livraison forfaitaires côté parent.
                // Le backend les enregistre tels quels ; le couple courrier-coursier
                // optimise sa propre rémunération côté Yukpo.
                frais_livraison_xaf: fraisLivraison,
                devise: 'XAF',
                mode_livraison: 'domicile',
                adresse_livraison: info.adresse,
                gps_livraison: info.gps ? `${info.gps.lat},${info.gps.lon}` : null,
                notes_client: [
                  info.telephone ? `WhatsApp: ${info.telephone}` : '',
                  info.note ? info.note : '',
                ].filter(Boolean).join(' · ') || null,
                livres_neufs,
                livres_occasion,
              };

              const res = await apiPost('/api/librairie-network/commandes', payload);
              const data = await res.json().catch(() => ({}));
              if (!res.ok || data?.success === false) {
                // Loggue le détail brut du serveur pour faciliter le diagnostic
                console.error('[create_commande] HTTP', res.status, data);
                throw new Error(
                  data?.error || data?.message || data?.detail
                    || t('bourse.recap.error_server_status', { status: res.status })
                );
              }

              const commandeId = data?.commande_id || data?.id || data?.data?.commande_id || data?.data?.id;

              // ✅ 2026-05-17 — Validation budget immédiate après création.
              // Sans cet appel, la commande reste au statut 'edition' (brouillon)
              // et AUCUN workflow ne se déclenche : pas de broadcast aux
              // librairies, pas de validation, pas de paiement, pas de
              // notifications, rien dans l'admin. Le bouton "Confirmer la
              // commande" doit donc enchaîner create → valider-budget.
              if (commandeId) {
                try {
                  await apiPost(
                    `/api/librairie-network/commandes/${commandeId}/valider-budget`,
                    {},
                  );
                } catch (e) {
                  // Non bloquant pour l'UX : la commande EST créée. On loggue
                  // pour l'admin et on continue le flow.
                  console.warn('[valider-budget] échec, commande reste en edition', e);
                }
              }

              setShowDelivery(false);
              sessionStorage.removeItem(TROC_DECISION_KEY);
              // Vide le panier — la commande est désormais en base, le suivi se fait via /mes-commandes
              enfants.forEach(e => clearPanierForEnfant(e.id));
              {
                const nbArticles = livres_neufs.length + livres_occasion.length;
                toast({
                  title: t('bourse.recap.toast_order_created'),
                  description: t(nbArticles > 1 ? 'bourse.recap.toast_order_desc_other' : 'bourse.recap.toast_order_desc_one', { count: nbArticles }),
                });
              }
              navigate(commandeId ? `/mes-commandes?focus=${commandeId}` : '/mes-commandes');
            } catch (e: any) {
              toast({
                title: t('bourse.recap.toast_order_error'),
                description: e?.message || t('bourse.recap.toast_order_error_retry'),
                variant: 'destructive',
              });
            } finally {
              setSubmittingOrder(false);
            }
          }}
        />
      )}
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-10 pb-4 text-white">
        <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight">{t('bourse.recap.title_long')}</h1>
            <p className="text-amber-100 text-xs">{t(totalItems > 1 ? 'bourse.recap.items_other' : 'bourse.recap.items_one', { count: totalItems })}</p>
          </div>
          <LanguageSwitcherBourse tone="white" />
          {totalItems > 0 && (
            <button
              onClick={() => {
                if (window.confirm(t('bourse.recap.clear_all_confirm'))) {
                  clearPanier();
                  toast({ title: t('bourse.recap.cart_cleared') });
                }
              }}
              className="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold border border-white/30"
              title={t('bourse.recap.clear_all_title')}
            >
              {t('bourse.recap.clear_all')}
            </button>
          )}
        </div>

        {/* Toggle vue : Par classe ⇄ Par rubrique (cumul cross-classes) */}
        <div className="inline-flex bg-white/15 backdrop-blur-sm rounded-full p-0.5 mb-2.5">
          <button
            onClick={() => setViewMode('classe')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              viewMode === 'classe' ? 'bg-white text-amber-700' : 'text-white/90'
            }`}
          >
            {t('bourse.recap.view_by_class')}
          </button>
          <button
            onClick={() => setViewMode('rubrique')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              viewMode === 'rubrique' ? 'bg-white text-amber-700' : 'text-white/90'
            }`}
          >
            {t('bourse.recap.view_by_category')}
          </button>
        </div>

        {/* Tabs enfants — uniquement en vue 'classe' */}
        {viewMode === 'classe' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {enfants.filter(e => countByEnfant(e.id) > 0).map(enfant => {
              const count = countByEnfant(enfant.id);
              const isActive = enfant.id === activeEnfantId;
              return (
                <button
                  key={enfant.id}
                  onClick={() => setActiveEnfantId(enfant.id)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                    isActive
                      ? 'bg-white text-amber-700 border-white'
                      : 'bg-white/20 text-white border-white/30'
                  }`}
                >
                  {enfant.classe}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-amber-500 text-white' : 'bg-white/30 text-white'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <div className="px-4 pt-4 pb-48 max-w-2xl mx-auto">
        {/* ✅ 2026-05-17 — Filtres MULTI Livres + Fournitures.
            Les 2 chips sont indépendants et tous les deux activés par défaut.
            L'utilisateur voit tout son panier en une liste unique ; il peut
            masquer un type s'il veut focus. Un seul bouton "Commander" en
            bas valide TOUT le panier en un appel.
            Style : chips toggle avec ✓ quand actif, ✕ quand masqué — pour
            bien distinguer ces filtres de simples onglets. */}
        {(countLivres > 0 || countFournitures > 0) && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                {t('bourse.recap.filter_label', { defaultValue: 'Filtrer' })}
              </span>
              <span className="text-[9px] text-gray-400 italic">
                {t('bourse.recap.filter_hint', {
                  defaultValue: 'tous affichés par défaut · cliquer pour masquer',
                })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowLivres(v => !v)}
                disabled={countLivres === 0}
                className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  showLivres && countLivres > 0
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300 line-through'
                }`}
                aria-pressed={showLivres}
                title={showLivres ? 'Cliquer pour masquer les livres' : 'Cliquer pour réafficher'}
              >
                <span className="inline-block w-3 text-center leading-none">
                  {showLivres && countLivres > 0 ? '✓' : '✕'}
                </span>
                📚 {t('bourse.recap.tab_livres', { defaultValue: 'Livres' })}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  showLivres && countLivres > 0
                    ? 'bg-white/30 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {countLivres}
                </span>
              </button>
              <button
                onClick={() => setShowFournitures(v => !v)}
                disabled={countFournitures === 0}
                className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  showFournitures && countFournitures > 0
                    ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300 line-through'
                }`}
                aria-pressed={showFournitures}
                title={showFournitures ? 'Cliquer pour masquer les fournitures' : 'Cliquer pour réafficher'}
              >
                <span className="inline-block w-3 text-center leading-none">
                  {showFournitures && countFournitures > 0 ? '✓' : '✕'}
                </span>
                ✏️ {t('bourse.recap.tab_fournitures', { defaultValue: 'Fournitures' })}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  showFournitures && countFournitures > 0
                    ? 'bg-white/30 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {countFournitures}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* CTA encart si le panier est mono-type (manque l'autre côté) */}
        {countLivres === 0 && countFournitures > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-amber-800 mb-2">
              {t('bourse.recap.empty_livres_hint', {
                defaultValue: 'Ajoutez aussi les manuels scolaires : scan de la liste ou école partenaire.',
              })}
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
            >
              {t('bourse.recap.go_pick_books', { defaultValue: 'Ajouter des livres' })}
            </button>
          </div>
        )}
        {countFournitures === 0 && countLivres > 0 && (
          <div className="mb-4 bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
            <p className="text-xs text-purple-800 mb-2">
              {t('bourse.recap.empty_fourni_hint', {
                defaultValue: 'Ajoutez aussi cahiers et accessoires depuis la page Fournitures.',
              })}
            </p>
            <button
              onClick={() => navigate('/cahiers-accessoires')}
              className="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
            >
              {t('bourse.recap.go_cahiers', { defaultValue: 'Ajouter des fournitures' })}
            </button>
          </div>
        )}

        {/* ✅ 2026-05-10 : bannière "livres à photographier" — la commande
            reste sur "attente" tant que les livres en échange n'ont pas
            tous une photo recto/verso enregistrée. Clic → /rentree?capture-troc=1
            qui ouvre auto la capture pour chaque livre en attente. */}
        {(() => {
          const pendingTrocCount = panier.filter(
            (p: any) => p.choix === 'occasion' && p.troc_intent && !p.trocLivreId
          ).length;
          if (pendingTrocCount === 0) return null;
          return (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-amber-800 text-sm">📷</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-amber-900 leading-tight">
                  {t(pendingTrocCount > 1 ? 'bourse.rentree.troc_pending_summary_other' : 'bourse.rentree.troc_pending_summary_one', { count: pendingTrocCount })}
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Votre commande sera mise en attente tant que les photos ne sont pas faites.
                </p>
                <button
                  onClick={() => navigate('/rentree?capture-troc=1')}
                  className="mt-2 bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-lg active:bg-amber-600"
                >
                  {t('bourse.rentree.troc_pending_cta')}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Infos classe — uniquement en vue 'classe' */}
        {viewMode === 'classe' && activeEnfant && (
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">{activeEnfant.classe}</p>
              <p className="text-xs text-gray-500">
                {activeEnfant.niveau}
                {activeEnfant.etablissementNom && <> · {activeEnfant.etablissementNom}</>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{t('bourse.recap.estimation')}</p>
              <p className="font-bold text-amber-700 text-sm">
                {totalEnfant > 0 ? `${totalEnfant.toLocaleString()} F` : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Items regroupés par rubrique — style aligné avec ScanProgrammePage.
            Sections fixes : Manuels & workbooks → Cahiers → Fournitures & accessoires.
            Deux modes :
              • 'classe'   → items de la classe active, modifiables (ItemCard)
              • 'rubrique' → cumul cross-classes par (libellé, gamme, choix), lecture seule */}
        {(() => {
          const labels: Record<TypeItem, string> = {
            livre: t('bourse.recap.cat_books'),
            cahier: t('bourse.recap.cat_notebooks'),
            fourniture: t('bourse.recap.cat_supplies'),
            autre: t('bourse.recap.cat_supplies'),
          };
          const sectionStyles: Record<TypeItem, { bg: string; border: string; text: string; dot: string }> = {
            livre:      { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',    dot: 'bg-blue-500' },
            cahier:     { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
            fourniture: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   dot: 'bg-amber-500' },
            autre:      { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   dot: 'bg-amber-500' },
          };

          if (viewMode === 'rubrique') {
            return aggregatedByRubrique.map(({ type, lignes }) => {
              const style = sectionStyles[type];
              const typeTotal = lignes.reduce((s, l) => {
                const r = estimateItemRange({ ...l.sample, quantite: l.totalQuantite });
                return s + r.max;
              }, 0);
              return (
                <div key={type} className={`rounded-2xl border ${style.border} overflow-hidden bg-white mb-3`}>
                  <div className={`flex items-center justify-between px-3 py-2 ${style.bg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
                        {labels[type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-semibold">
                        {t(lignes.length > 1 ? 'bourse.recap.lines_other' : 'bourse.recap.lines_one', { count: lignes.length })}
                      </span>
                      {typeTotal > 0 && (
                        <span className={`text-[11px] font-bold ${style.text}`}>
                          {typeTotal.toLocaleString('fr-FR')} F
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {lignes.map((l, idx) => {
                      const r = estimateItemRange({ ...l.sample, quantite: l.totalQuantite });
                      const prixUnit = l.sample.prixNeuf ?? 0;
                      // Pour ajuster la quantité globale d'une ligne agrégée :
                      // on ajuste UNIQUEMENT le 1er item du bucket — les autres restent
                      // en l'état. C'est le compromis le plus simple et compréhensible
                      // pour le parent (il modifie « la quantité de cet article ce qu'il
                      // doit acheter ») sans devoir naviguer classe par classe.
                      const itemsInBucket = panier.filter(p => {
                        const titreNorm = (p.titre || '').toLowerCase().trim();
                        const sampleTitreNorm = (l.sample.titre || '').toLowerCase().trim();
                        return p.type === l.sample.type
                            && titreNorm === sampleTitreNorm
                            && (p.gamme || '-') === (l.sample.gamme || '-')
                            && (p.choix || 'neuf') === (l.sample.choix || 'neuf');
                      });
                      const firstId = itemsInBucket[0]?.id;
                      const adjustQte = (delta: number) => {
                        if (!firstId) return;
                        const first = itemsInBucket[0];
                        const newQ = Math.max(1, (first.quantite ?? 1) + delta);
                        updateQuantite(firstId, newQ);
                      };
                      const removeAll = () => {
                        if (!window.confirm(t('bourse.recap.remove_line_q', { titre: l.sample.titre }))) return;
                        itemsInBucket.forEach(it => removeItem(it.id));
                      };
                      return (
                        <div key={`${l.sample.titre}-${idx}`} className="flex items-center gap-2 px-2.5 py-2 border-t border-gray-100 first:border-t-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900 leading-tight truncate" dir="auto">{l.sample.titre}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {l.sample.gamme && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                                  {l.sample.gamme}
                                </span>
                              )}
                              {l.sample.choix === 'occasion' && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100">
                                  {t('bourse.recap.used')}
                                </span>
                              )}
                              {l.classes.length > 0 && (
                                <span className="text-[10px] text-gray-500 truncate">{l.classes.join(' · ')}</span>
                              )}
                            </div>
                          </div>

                          {/* Stepper quantité (cumul) */}
                          <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-md shrink-0 overflow-hidden">
                            <button
                              onClick={() => adjustQte(-1)}
                              disabled={l.totalQuantite <= 1}
                              className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-base leading-none"
                              aria-label={t('bourse.recap.decrease')}>−</button>
                            <span className="text-xs font-bold text-gray-800 w-5 text-center tabular-nums leading-none">{l.totalQuantite}</span>
                            <button
                              onClick={() => adjustQte(+1)}
                              className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-base leading-none"
                              aria-label={t('bourse.recap.increase')}>+</button>
                          </div>

                          {/* Prix unitaire */}
                          <span
                            className={`text-right text-[11px] font-bold tabular-nums shrink-0 min-w-[44px] ${prixUnit > 0 ? 'text-amber-700' : 'text-gray-300'}`}
                            title={prixUnit > 0 ? undefined : t('bourse.recap.price_unavailable')}
                          >
                            {prixUnit > 0 ? `${prixUnit.toLocaleString('fr-FR')} F` : '—'}
                          </span>

                          {/* Total ligne */}
                          <span className={`text-right text-[12px] font-bold tabular-nums shrink-0 min-w-[64px] ${style.text}`}>
                            {prixUnit > 0
                              ? (r.min === r.max
                                  ? `${r.max.toLocaleString('fr-FR')} F`
                                  : `${r.min.toLocaleString('fr-FR')}–${r.max.toLocaleString('fr-FR')}`)
                              : '—'}
                          </span>

                          {/* Supprimer */}
                          <button
                            onClick={removeAll}
                            className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 shrink-0"
                            title={t('bourse.recap.remove_line_title')} aria-label={t('bourse.recap.remove_aria')}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          }

          return grouped.map(({ type, items: gItems }) => {
            const typeTotal = gItems.reduce((s, it) => s + estimateItem(it), 0);
            const style = sectionStyles[type];
            return (
              <div key={type} className={`rounded-2xl border ${style.border} overflow-hidden bg-white mb-3`}>
                <div className={`flex items-center justify-between px-3 py-2 ${style.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
                      {labels[type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-semibold">
                      {t(gItems.length > 1 ? 'bourse.recap.articles_other' : 'bourse.recap.articles_one', { count: gItems.length })}
                    </span>
                    {typeTotal > 0 && (
                      <span className={`text-[11px] font-bold ${style.text}`}>
                        {typeTotal.toLocaleString('fr-FR')} F
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {gItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onRemove={() => removeItem(item.id)}
                      onUpdateChoix={updateChoix}
                      onUpdateQuantite={updateQuantite}
                      onUpdateGamme={updateGamme}
                      onSetTrocIntent={setTrocIntent}
                    />
                  ))}
                </div>
              </div>
            );
          });
        })()}

        {/* ✅ 2026-05-17 — Ajouter un article manquant. Petit segmented control
            au-dessus pour choisir entre Livres et Fournitures. Visible
            uniquement en vue 'classe' où activeEnfant existe. */}
        {viewMode === 'classe' && activeEnfant && (
          <div className={`rounded-2xl border bg-white mb-3 overflow-hidden ${
            manualAddType === 'livres' ? 'border-amber-200' : 'border-purple-200'
          }`}>
            <div className={`px-3 py-2 flex items-center gap-2 ${
              manualAddType === 'livres' ? 'bg-amber-50' : 'bg-purple-50'
            }`}>
              <div className="inline-flex bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm leading-none">
                <button
                  onClick={() => setManualAddType('livres')}
                  className={`px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                    manualAddType === 'livres' ? 'bg-amber-500 text-white' : 'text-gray-500'
                  }`}
                >
                  📚 {t('bourse.recap.add_kind_livres', { defaultValue: 'Manuel' })}
                </button>
                <button
                  onClick={() => setManualAddType('fournitures')}
                  className={`px-2 py-1 text-[10px] font-bold uppercase transition-colors border-l border-gray-200 ${
                    manualAddType === 'fournitures' ? 'bg-purple-500 text-white' : 'text-gray-500'
                  }`}
                >
                  ✏️ {t('bourse.recap.add_kind_fourni', { defaultValue: 'Fourniture' })}
                </button>
              </div>
              <span className={`text-[10px] ml-auto truncate ${
                manualAddType === 'livres' ? 'text-amber-700' : 'text-purple-700'
              }`}>
                {activeEnfant.classe}
              </span>
            </div>
            <ManualAddInline
              cat={manualAddType === 'livres' ? 'livres' : 'fournitures'}
              pays={(activeEnfant.pays ?? 'CM') as any}
              classe={activeEnfant.classe}
              niveau={activeEnfant.niveau}
              onPick={(it: ManualAddItem) => {
                const typeItem: TypeItem =
                  manualAddType === 'livres'
                    ? 'livre'
                    : (() => {
                        const ta = String(it.type_article ?? '').toLowerCase();
                        if (ta === 'cahier') return 'cahier';
                        if (ta === 'fourniture' || ta === 'accessoire') return 'fourniture';
                        return 'autre';
                      })();
                addItems([
                  {
                    enfantId: activeEnfant.id,
                    titre: it.titre,
                    auteur: it.auteur ?? undefined,
                    matiere: it.matiere ?? undefined,
                    editeur: it.editeur ?? undefined,
                    type: typeItem,
                    prixNeuf: it.prix_officiel ?? undefined,
                    choix: 'neuf',
                    quantite: it.quantite_defaut ?? 1,
                  },
                ]);
                toast({
                  title: t('bourse.recap.toast_added', { defaultValue: 'Ajouté au panier' }),
                  description: t('bourse.recap.toast_added_hint', {
                    defaultValue:
                      '"{{titre}}" — ajustez quantité et état (Neuf / Occasion / Échange) sur la carte.',
                    titre: it.titre,
                  }),
                });
              }}
            />
          </div>
        )}

        {/* ✅ Synthèse par catégories de livraison — 4 catégories distinctes
            pour que le parent voie clairement ce qu'il achète et comment :
            manuels neufs, via troc, occasion, fournitures & accessoires. */}
        {(() => {
          // Classification de chaque item du panier en 1 des 4 catégories
          const cats = {
            manuels_neufs: { count: 0, total: 0 },
            manuels_troc: { count: 0, total: 0 },
            manuels_occasion: { count: 0, total: 0 },
            fournitures: { count: 0, total: 0 },
          };
          for (const it of panier) {
            const q = it.quantite ?? 1;
            const isLivre = ['livre', 'workbook', 'livret', 'manuel', 'textbook', 'book'].includes(
              String(it.type ?? '').toLowerCase(),
            );
            const sub = estimateItem(it);
            if (isLivre) {
              if (it.trocLivreId || it.troc_intent) {
                cats.manuels_troc.count += q;
                cats.manuels_troc.total += sub;
              } else if (it.choix === 'occasion') {
                cats.manuels_occasion.count += q;
                cats.manuels_occasion.total += sub;
              } else {
                cats.manuels_neufs.count += q;
                cats.manuels_neufs.total += sub;
              }
            } else {
              cats.fournitures.count += q;
              cats.fournitures.total += sub;
            }
          }
          const hasAnything =
            cats.manuels_neufs.count + cats.manuels_troc.count +
            cats.manuels_occasion.count + cats.fournitures.count > 0;
          if (!hasAnything) return null;
          const rows: Array<[string, string, { count: number; total: number }, string]> = [
            ['Manuels neufs', '📘', cats.manuels_neufs, 'text-blue-800'],
            ['Manuels via troc', '🔄', cats.manuels_troc, 'text-emerald-800'],
            ["Manuels d'occasion", '📚', cats.manuels_occasion, 'text-orange-800'],
            ['Fournitures & accessoires', '✏️', cats.fournitures, 'text-amber-800'],
          ];
          return (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-2 mb-3 shadow-sm">
              <p className="font-bold text-gray-800 text-sm mb-2.5">Récap par catégorie</p>
              {rows.filter(([, , data]) => data.count > 0).map(([label, icon, data, color]) => (
                <div key={label} className="flex items-center justify-between py-1.5 text-sm border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className={`font-semibold ${color}`}>{label}</span>
                    <span className="text-xs text-gray-500">×{data.count}</span>
                  </div>
                  <span className={`font-bold tabular-nums ${color}`}>{data.total.toLocaleString('fr-FR')} F</span>
                </div>
              ))}
              {/* Troc : rappel crédit / demande / gap clair */}
              {cats.manuels_troc.count > 0 && pendingCredit.available > 0 && (
                <div className="mt-3 pt-2.5 border-t border-emerald-200 bg-emerald-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
                  <p className="font-bold text-emerald-900 text-xs uppercase tracking-wide mb-2">
                    🔄 Détail Troc
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-emerald-800">Votre crédit Yukpo disponible</span>
                      <span className="font-bold text-emerald-700">{pendingCredit.available.toLocaleString()} F</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-800">Crédit utilisable pour cette commande</span>
                      <span className="font-bold text-emerald-700">− {pendingCredit.engageable.toLocaleString()} F</span>
                    </div>
                    {pendingCredit.available - pendingCredit.engageable > 0 && (
                      <div className="flex justify-between text-[11px] text-emerald-600 italic">
                        <span>Crédit restant après commande</span>
                        <span>{(pendingCredit.available - pendingCredit.engageable).toLocaleString()} F</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Synthèse globale tous enfants */}
        {enfants.filter(e => countByEnfant(e.id) > 0).length > 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-2">
            <p className="font-semibold text-amber-800 text-sm mb-3">{t('bourse.recap.synthesis')}</p>
            {enfants.filter(e => countByEnfant(e.id) > 0).map(e => {
              const items = getItemsForEnfant(e.id);
              const total = items.reduce((s, it) => s + estimateItem(it), 0);
              return (
                <div key={e.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-sm font-medium text-amber-900">{e.classe}</span>
                    <span className="text-xs text-amber-600 ml-2">{e.niveau}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-800">
                      {t(items.length > 1 ? 'bourse.recap.articles_other' : 'bourse.recap.articles_one', { count: items.length })}
                    </p>
                    {total > 0 && <p className="text-xs text-amber-600">{total.toLocaleString()} F</p>}
                  </div>
                </div>
              );
            })}
            {/* ✅ 2026-05-16 — Affichage Budget MAX (au lieu d'intervalle).
                Préparation pédagogique : l'user voit le MAXIMUM possible et
                sera content si la facture finale est moins chère. Le hint
                en dessous explique que ça peut baisser selon l'état réel
                des livres d'occasion/échange. */}
            <div className="border-t border-amber-300 mt-2 pt-2 flex items-center justify-between">
              <div>
                <p className="font-bold text-amber-900 text-sm">
                  {hasOccasionRange
                    ? t('bourse.recap.total_max', { defaultValue: 'Budget max' })
                    : t('bourse.recap.total_estimated', { defaultValue: 'Total estimé' })}
                </p>
                {hasOccasionRange && (
                  <p className="text-[10px] text-amber-700 leading-tight mt-0.5">
                    {t('bourse.recap.total_max_hint_short', {
                      defaultValue: 'Maximum possible — peut baisser',
                    })}
                  </p>
                )}
              </div>
              <p className="font-bold text-amber-800 text-base text-right">
                {grandTotal > 0 ? `${grandTotal.toLocaleString()} FCFA` : '—'}
              </p>
            </div>
            {/* Crédit Bourse prévisionnel issu du troc — déduit du total */}
            {pendingCredit.engageable > 0 && (
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-emerald-700 flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5" />
                  Crédit troc ({pendingCredit.matchedCount} livre{pendingCredit.matchedCount > 1 ? 's' : ''} matché{pendingCredit.matchedCount > 1 ? 's' : ''})
                </p>
                <p className="text-xs font-bold text-emerald-700">
                  − {pendingCredit.engageable.toLocaleString()} FCFA
                </p>
              </div>
            )}
            {/* ✅ Frais de livraison forfaitaires — affichés systématiquement
                quand le panier n'est pas vide. Forfait global toutes classes. */}
            {fraisLivraison > 0 && (
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  Frais de livraison
                </p>
                <p className="text-xs font-bold text-amber-700">
                  + {fraisLivraison.toLocaleString()} FCFA
                </p>
              </div>
            )}
            {/* ⚠️ Dette troc — si l'user a une dette suite à un rollback chain
                après usage du crédit, on la récupère ici (ajout au total).
                Visible pour la transparence. */}
            {bourseDebtXaf > 0 && (
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-red-700 flex items-center gap-1">
                  ⚠️ Dette troc à régler (rollback précédent)
                </p>
                <p className="text-xs font-bold text-red-700">
                  + {bourseDebtXaf.toLocaleString()} FCFA
                </p>
              </div>
            )}
            {/* Gap à payer — toujours visible, mis en évidence. */}
            <div className="mt-2 pt-2 border-t-2 border-amber-300 flex items-center justify-between bg-amber-100 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl">
              <div>
                <p className="font-bold text-amber-900 text-sm">
                  💰 {hasOccasionRange
                    ? t('bourse.recap.max_to_pay', { defaultValue: 'Reste à payer (max)' })
                    : t('bourse.recap.to_pay', { defaultValue: 'Reste à payer' })}
                </p>
                {pendingCredit.engageable > 0 && (
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    Après déduction crédit troc {pendingCredit.engageable.toLocaleString()} F
                  </p>
                )}
              </div>
              <p className="font-bold text-amber-900 text-lg tabular-nums">
                {grandTotalAvecCredit.toLocaleString()} FCFA
              </p>
            </div>
            {hasOccasionRange && (
              <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-[11px] text-amber-800 leading-snug">
                  <span className="font-bold">ℹ️ Budget maximum.</span>{' '}
                  {t('bourse.recap.budget_max_help', {
                    defaultValue:
                      "Ce montant est le PIRE cas. Il peut être revu à la baisse une fois que vos livres d'occasion ou en échange seront évalués (selon leur état réel). Vous êtes ainsi préparé(e) au maximum possible — la facture finale sera souvent moins chère.",
                  })}
                </p>
                {/* Note spécifique aux échanges (livres troc) si présents. */}
                {panier.some((p) => p.choix === 'occasion' && p.troc_intent) && (
                  <p className="text-[11px] text-amber-700 leading-snug mt-1.5 pt-1.5 border-t border-amber-200">
                    <span className="font-bold">🔄 Échange :</span>{' '}
                    {t('bourse.recap.exchange_logic_help', {
                      defaultValue:
                        "Vous donnez vos livres de l'année passée et recevez un crédit Yukpo, déduit du prix des manuels de la classe supérieure. Le reste à payer dépend de l'état des deux côtés.",
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modifier les choix occasion / troc — visible si la décision a été prise */}
        {occasionItemsInPanier.length > 0 && (
          <button
            onClick={reopenOccasionModal}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-orange-50 border border-orange-200 rounded-2xl text-orange-700 font-semibold text-xs"
          >
            <Repeat className="w-3.5 h-3.5" />
            {t(occasionItemsInPanier.length > 1 ? 'bourse.recap.modify_occasion_other' : 'bourse.recap.modify_occasion_one', { count: occasionItemsInPanier.length })}
          </button>
        )}

        {/* Ajouter d'autres articles */}
        <button
          onClick={() => navigate('/parent-selection')}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-amber-300 rounded-2xl text-amber-700 font-semibold text-sm"
        >
          {t('bourse.recap.add_more')}
        </button>

        {/* ✅ 2026-05-15 (Phase 2) : CTA Cahiers & Accessoires après la
            sélection des livres. Apparaît juste avant la validation pour
            inviter le parent à compléter sa commande avec les fournitures. */}
        <button
          onClick={() => navigate('/cahiers-accessoires')}
          className="w-full mt-3 flex items-start gap-3 px-4 py-3 bg-purple-50 border-2 border-purple-200 hover:border-purple-300 active:bg-purple-100 rounded-2xl text-left"
        >
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-lg">✏️</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-purple-900 leading-tight">
              {t('bourse.recap.cahiers_cta_title', { defaultValue: 'Compléter avec les cahiers & accessoires' })}
            </p>
            <p className="text-[11px] text-purple-700 leading-snug mt-0.5">
              {t('bourse.recap.cahiers_cta_desc', { defaultValue: 'Liste agrégée par classe, déjà calculée selon vos enfants.' })}
            </p>
          </div>
          <span className="text-purple-600 mt-2 flex-shrink-0">→</span>
        </button>
      </div>

      {/* Bottom bar sticky */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">
                {hasOccasionRange ? t('bourse.recap.range_estimated') : t('bourse.recap.total_estimated')}
              </p>
              <p className="font-bold text-gray-900 text-xl tabular-nums">
                {hasOccasionRange ? (
                  <>
                    {grandTotalRange.min.toLocaleString()}
                    <span className="text-sm font-normal mx-1 text-gray-500">–</span>
                    {grandTotalRange.max.toLocaleString()}
                    <span className="text-sm font-normal text-gray-500 ml-1">F</span>
                  </>
                ) : grandTotal > 0 ? `${grandTotal.toLocaleString()} F` : '—'}
              </p>
            </div>
            <p className="text-xs text-gray-400 text-right">
              {t(totalItems > 1 ? 'bourse.recap.articles_other' : 'bourse.recap.articles_one', { count: totalItems })}<br />
              {(() => { const n = enfants.filter(e => countByEnfant(e.id) > 0).length; return t(n > 1 ? 'bourse.recap.classes_other' : 'bourse.recap.classes_one', { count: n }); })()}
            </p>
          </div>
          {(() => {
            const pendingTrocCount = panier.filter(
              (p: any) => p.choix === 'occasion' && p.troc_intent && !p.trocLivreId
            ).length;
            const blocked = pendingTrocCount > 0;
            return (
              <button
                onClick={() => {
                  if (blocked) {
                    navigate('/rentree?capture-troc=1');
                    return;
                  }
                  setShowDelivery(true);
                }}
                disabled={submittingOrder}
                className={`w-full disabled:bg-gray-300 text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 ${
                  blocked ? 'bg-amber-500 active:bg-amber-600' : 'bg-amber-600'
                }`}
              >
                {submittingOrder ? <Loader2 className="w-5 h-5 animate-spin" /> : blocked ? <Camera className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                {submittingOrder
                  ? t('bourse.recap.sending_order')
                  : blocked
                    ? t('bourse.rentree.troc_pending_cta')
                    : savedDelivery.address
                      ? t('bourse.recap.validate_order', {
                          defaultValue: 'Valider la commande',
                        })
                      : t('bourse.recap.precise_delivery')}
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            );
          })()}
          <p className="text-center text-xs text-gray-400 mt-2">
            {t('bourse.recap.delivery_required')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecapAchatPage;
