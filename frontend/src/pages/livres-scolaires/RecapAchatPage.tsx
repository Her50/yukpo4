import {
  AlertTriangle, ArrowLeft, BookOpen, Camera, Check, ChevronRight,
  Loader2, MapPin, Minus, Package, Phone, Plus, Repeat,
  ShoppingCart, ShoppingBag, Trash2, X
} from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcherBourse from '../../components/LanguageSwitcherBourse';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { Choix, PanierItem, TypeItem, useParentShop } from '../../hooks/useParentShop';
import { apiPost } from '../../services/apiService';

// Picker GPS minimaliste (Google Maps + Places) — chargé à la demande pour
// ne pas alourdir le bundle initial.
const DeliveryMapPicker = lazy(() => import('../../components/livres-scolaires/DeliveryMapPicker'));

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

/* ─── Gamme switcher pour accessoires ─── */
type Gamme = 'entree' | 'standard' | 'premium';
const GAMME_LABELS: Record<Gamme, string> = { entree: 'Entrée', standard: 'Standard', premium: 'Premium' };

function GammeSwitcher({ item, onUpdate }: { item: PanierItem; onUpdate: (id: string, g: Gamme) => void }) {
  const current: Gamme = item.gamme ?? 'standard';
  return (
    <div className="flex rounded-full bg-gray-100 p-0.5">
      {(['entree', 'standard', 'premium'] as Gamme[]).map(g => (
        <button
          key={g}
          onClick={() => onUpdate(item.id, g)}
          className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full transition-colors ${
            current === g ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          {GAMME_LABELS[g]}
        </button>
      ))}
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
}: {
  item: PanierItem;
  onRemove: () => void;
  onUpdateChoix: (id: string, choix: Choix) => void;
  onUpdateQuantite: (id: string, q: number) => void;
  onUpdateGamme: (id: string, g: Gamme) => void;
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
  return (
    <div className="px-2 py-1 border-b border-gray-100 last:border-b-0 bg-white text-[12px]">
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-tight truncate text-gray-800" title={item.titre} dir="auto">
            {item.titre}
          </p>
          {(item.auteur || item.editeur) && (
            <p className="text-[10px] text-gray-500 leading-tight truncate" dir="auto">
              {[item.auteur, item.editeur].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Quantité — stepper compact */}
        <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-md shrink-0 overflow-hidden">
          <button
            onClick={() => onUpdateQuantite(item.id, Math.max(1, quantite - 1))}
            disabled={quantite <= 1}
            className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-base leading-none"
            aria-label={t('bourse.recap.decrease')}>−</button>
          <span className="text-xs font-bold text-gray-800 w-5 text-center tabular-nums leading-none">{quantite}</span>
          <button
            onClick={() => onUpdateQuantite(item.id, quantite + 1)}
            className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-base leading-none"
            aria-label={t('bourse.recap.increase')}>+</button>
        </div>

        {/* Prix unitaire — toujours affiché ; "—" si inconnu pour que la
            colonne reste visible et que l'utilisateur sache qu'on ne l'a pas */}
        <span
          className={`text-right text-[12px] font-bold tabular-nums shrink-0 min-w-[50px] ${
            prixEff > 0 ? 'text-amber-700' : 'text-gray-300'
          }`}
          title={prixEff > 0 ? undefined : t('bourse.recap.price_unavailable')}
        >
          {prixEff > 0 ? `${prixEff.toLocaleString('fr-FR')} F` : '—'}
        </span>

        {/* Supprimer */}
        <button onClick={onRemove}
          className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 shrink-0"
          title={t('bourse.recap.remove_item')} aria-label={t('bourse.recap.remove_aria')}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Toggle Neuf/Occasion (livres) ou Gamme (fournitures) sous-ligne — réduit */}
      {(isLivre || (isGammeable && item.prixNeuf && item.prixNeuf > 0)) && (
        <div className="flex items-center gap-2 mt-0.5">
          {isLivre && (
            <div className="inline-flex bg-gray-100 rounded p-[1px] gap-[1px] items-center">
              <button
                onClick={() => onUpdateChoix(item.id, 'neuf')}
                className={`px-1.5 py-px rounded text-[9px] font-bold transition-colors ${
                  item.choix === 'neuf' ? 'bg-emerald-500 text-white' : 'text-gray-500'
                }`}>{t('bourse.recap.new')}</button>
              <button
                onClick={() => onUpdateChoix(item.id, 'occasion')}
                className={`px-1.5 py-px rounded text-[9px] font-bold transition-colors ${
                  item.choix === 'occasion' ? 'bg-orange-500 text-white' : 'text-gray-500'
                }`}>{t('bourse.recap.used')}</button>
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
  onConfirm,
  onClose,
}: {
  defaultPhone?: string;
  onConfirm: (info: DeliveryInfo) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState(defaultPhone ?? '');
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Autocomplete adresse via Nominatim (OSM, gratuit, CORS-friendly).
  type Suggestion = { display_name: string; lat: string; lon: string };
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
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=cm&q=${encodeURIComponent(val)}`;
        const r = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
        const d = await r.json();
        setSuggestions(Array.isArray(d) ? d : []);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 350);
  };

  const pickSuggestion = (s: Suggestion) => {
    setAdresse(s.display_name);
    setCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) });
    setShowSuggestions(false);
    setSuggestions([]);
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

        {/* Adresse de livraison — autocomplete (Nominatim OSM, CORS-friendly) */}
        <div className="mb-4 relative">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('bourse.recap.delivery_address_required')} <span className="text-red-500">*</span>
          </label>
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
                  <span className="leading-tight">{s.display_name}</span>
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
  const { enfants, panier, removeItem, updateChoix, updateQuantite, updateGamme, getItemsForEnfant, countByEnfant, clearPanierForEnfant, clearPanier } = useParentShop();

  const [activeEnfantId, setActiveEnfantId] = useState(
    enfants.find(e => countByEnfant(e.id) > 0)?.id || enfants[0]?.id || ''
  );
  /** 'classe' = vue par enfant (onglets de classes) ; 'rubrique' = vue agrégée
   *  toutes classes confondues (cumul des quantités d'un même article + gamme). */
  const [viewMode, setViewMode] = useState<'classe' | 'rubrique'>('classe');
  const [showDelivery, setShowDelivery] = useState(false);
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

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
  const types: TypeItem[] = ['livre', 'cahier', 'fourniture', 'autre'];
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

  // Total réellement à payer après application du crédit prévisionnel
  // ET ajout des frais de livraison.
  const grandTotalAvecCredit = Math.max(
    0,
    grandTotal - pendingCredit.engageable + fraisLivraison,
  );

  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-amber-600 px-4 pt-10 pb-5 text-white flex items-center gap-3">
          <button onClick={() => navigate('/livres-scolaires')} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-bold text-lg flex-1">{t('bourse.recap.title')}</h1>
          <LanguageSwitcherBourse tone="white" />
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <ShoppingCart className="w-14 h-14 text-gray-200 mb-4" />
          <p className="text-gray-500 text-sm font-medium mb-1">{t('bourse.recap.empty')}</p>
          <p className="text-gray-400 text-xs mb-6">
            {t('bourse.recap.empty_help')}
          </p>
          <button
            onClick={() => navigate('/parent-selection')}
            className="bg-amber-500 text-white font-bold px-6 py-3 rounded-2xl text-sm"
          >
            {t('bourse.recap.empty_cta')}
          </button>
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
          // Pré-remplissage du WhatsApp : on privilégie user.phone (issu du
          // JWT / fetch /api/user/me), puis le cache local rempli à la
          // création du compte (yukpo_user_phone). L'utilisateur peut
          // toujours éditer si besoin.
          defaultPhone={user?.phone || (typeof localStorage !== 'undefined' ? localStorage.getItem('yukpo_user_phone') ?? '' : '')}
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
              const commandeId = data?.commande_id || data?.id || data?.data?.commande_id || data?.data?.id;
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
                    />
                  ))}
                </div>
              </div>
            );
          });
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
            <div className="border-t border-amber-300 mt-2 pt-2 flex items-center justify-between">
              <p className="font-bold text-amber-900 text-sm">{t('bourse.recap.total_estimated')}</p>
              <p className="font-bold text-amber-800 text-base text-right">
                {hasOccasionRange ? (
                  <>
                    {grandTotalRange.min.toLocaleString()} – {grandTotalRange.max.toLocaleString()}
                    <span className="text-xs font-normal text-amber-600 ml-1">FCFA</span>
                  </>
                ) : grandTotal > 0 ? (
                  `${grandTotal.toLocaleString()} FCFA`
                ) : '—'}
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
            {/* À payer : visible dès qu'il y a frais ou crédit en jeu */}
            {(pendingCredit.engageable > 0 || fraisLivraison > 0) && (
              <div className="mt-1.5 pt-1.5 border-t border-amber-200 flex items-center justify-between">
                <p className="font-bold text-amber-900 text-sm">À payer</p>
                <p className="font-bold text-amber-800 text-base">
                  {grandTotalAvecCredit.toLocaleString()} FCFA
                </p>
              </div>
            )}
            {hasOccasionRange && (
              <p className="text-[11px] text-amber-700 mt-1.5 leading-snug">
                {t('bourse.recap.range_help')}
              </p>
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
