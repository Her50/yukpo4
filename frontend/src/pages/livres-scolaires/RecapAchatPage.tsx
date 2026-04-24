import {
  AlertTriangle, ArrowLeft, BookOpen, Check, ChevronRight,
  Loader2, MapPin, Minus, Package, Phone, Plus,
  ShoppingCart, Trash2, X
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { Choix, PanierItem, TypeItem, useParentShop } from '../../hooks/useParentShop';

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

/* ─── Carte article ─── */
function ItemCard({
  item,
  onRemove,
  onUpdateChoix,
  onUpdateQuantite,
  onUpdateGamme,
  onDuplicate,
}: {
  item: PanierItem;
  onRemove: () => void;
  onUpdateChoix: (id: string, choix: Choix) => void;
  onUpdateQuantite: (id: string, q: number) => void;
  onUpdateGamme: (id: string, g: Gamme) => void;
  onDuplicate: (newQ: number) => void;
}) {
  const isAccessoire = item.type !== 'livre';
  const quantite = item.quantite ?? 1;
  const showQuantite = true; // accessoires + livres (duplication si plusieurs dans la même classe)
  return (
    <div className="flex items-start gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
      <div className={`w-8 h-8 rounded-xl ${TYPE_COLORS[item.type].bg} flex items-center justify-center shrink-0`}>
        <span className={TYPE_COLORS[item.type].text}>{TYPE_ICONS[item.type]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{item.titre}</p>
        {item.auteur && <p className="text-xs text-gray-500 mt-0.5">{item.auteur}</p>}
        {item.matiere && (
          <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1">
            {item.matiere}
          </span>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {!isAccessoire && <ChoixBadge item={item} onUpdate={onUpdateChoix} />}
          {isAccessoire && (item.type === 'cahier' || item.type === 'fourniture') && (
            <GammeSwitcher item={item} onUpdate={onUpdateGamme} />
          )}
          {item.prixNeuf && item.choix !== 'occasion' && (
            <span className="text-xs text-green-700 font-semibold">{item.prixNeuf.toLocaleString()} F</span>
          )}
          {item.prixOccasion && item.choix !== 'neuf' && (
            <span className="text-xs text-orange-600 font-semibold">{item.prixOccasion.toLocaleString()} F</span>
          )}
        </div>
        {showQuantite && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-wide">
              {isAccessoire ? 'Quantité' : 'Exemplaires'}
            </span>
            {quantite > 1 && !isAccessoire && (
              <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> ×{quantite} — plusieurs élèves
              </span>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQuantite(item.id, Math.max(1, quantite - 1))}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
                aria-label="Diminuer"
              >
                <Minus className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <span className="min-w-[24px] text-center text-sm font-bold text-gray-900">{quantite}</span>
              <button
                onClick={() => {
                  const newQ = quantite + 1;
                  onUpdateQuantite(item.id, newQ);
                  if (!isAccessoire) onDuplicate(newQ);
                }}
                className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center active:bg-amber-200"
                aria-label="Augmenter"
              >
                <Plus className="w-3.5 h-3.5 text-amber-700" />
              </button>
            </div>
          </div>
        )}
      </div>
      <button onClick={onRemove} className="p-1.5 rounded-full bg-gray-100 shrink-0">
        <Trash2 className="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
  );
}

/* ─── Modale de livraison ─── */
interface DeliveryInfo {
  adresse: string;
  telephone: string;
  note: string;
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
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState(defaultPhone ?? '');
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const locateMe = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoords({ lat, lon });
        // Reverse geocoding léger via OSM Nominatim (gratuit, sans clé)
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const d = await r.json();
          const addr = [d.address?.road, d.address?.suburb, d.address?.city || d.address?.town]
            .filter(Boolean).join(', ');
          if (addr) setAdresse(addr);
        } catch { /* adresse restée manuelle */ }
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 pb-10 sm:pb-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-base">Infos de livraison</h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Adresse GPS */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Adresse de livraison</label>
          <div className="flex gap-2">
            <input
              value={adresse}
              onChange={e => setAdresse(e.target.value)}
              placeholder="Quartier, rue, point de repère…"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-amber-400"
            />
            <button
              onClick={locateMe}
              disabled={locating}
              className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 shrink-0"
              title="Utiliser ma position GPS"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            </button>
          </div>
          {coords && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Position GPS enregistrée ({coords.lat.toFixed(4)}, {coords.lon.toFixed(4)})
            </p>
          )}
        </div>

        {/* Téléphone */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Numéro de téléphone
          </label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              value={telephone}
              onChange={e => setTelephone(e.target.value)}
              placeholder="+237 6XX XXX XXX"
              type="tel"
              className="flex-1 text-sm outline-none"
            />
          </div>
        </div>

        {/* Note */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Note (optionnel)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Horaire préféré, code portail…"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-amber-400 resize-none"
          />
        </div>

        <button
          disabled={!adresse.trim() || !telephone.trim()}
          onClick={() => onConfirm({ adresse, telephone, note })}
          className="w-full bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-2xl text-sm"
        >
          Confirmer la commande
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">
          {!adresse.trim() || !telephone.trim() ? 'Adresse et téléphone requis' : 'En appuyant, votre sélection est transmise aux librairies partenaires'}
        </p>
      </div>
    </div>
  );
}

/* ─── Page principale ─── */
const RecapAchatPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { enfants, panier, removeItem, updateChoix, updateQuantite, updateGamme, getItemsForEnfant, countByEnfant } = useParentShop();

  const [activeEnfantId, setActiveEnfantId] = useState(
    enfants.find(e => countByEnfant(e.id) > 0)?.id || enfants[0]?.id || ''
  );
  const [showDelivery, setShowDelivery] = useState(false);

  const activeEnfant = enfants.find(e => e.id === activeEnfantId);
  const activeItems = activeEnfant ? getItemsForEnfant(activeEnfant.id) : [];

  /* Grouper par type */
  const types: TypeItem[] = ['livre', 'cahier', 'fourniture', 'autre'];
  const grouped = types
    .map(t => ({ type: t, items: activeItems.filter(it => it.type === t) }))
    .filter(g => g.items.length > 0);

  /* Totaux — accessoires multiplient par quantité */
  const estimateItem = (it: PanierItem): number => {
    const unit = it.choix === 'neuf'
      ? (it.prixNeuf ?? 0)
      : it.choix === 'occasion'
      ? (it.prixOccasion ?? 0)
      : (it.prixOccasion ?? it.prixNeuf ?? 0);
    const q = it.quantite ?? 1;
    return unit * q;
  };

  const totalEnfant = activeItems.reduce((s, it) => s + estimateItem(it), 0);
  const grandTotal = enfants.reduce((s, e) => {
    return s + getItemsForEnfant(e.id).reduce((ss, it) => ss + estimateItem(it), 0);
  }, 0);
  const totalItems = panier.length;

  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-amber-600 px-4 pt-10 pb-5 text-white flex items-center gap-3">
          <button onClick={() => navigate('/livres-scolaires')} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-bold text-lg">Récapitulatif</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <ShoppingCart className="w-14 h-14 text-gray-200 mb-4" />
          <p className="text-gray-500 text-sm font-medium mb-1">Aucun article sélectionné</p>
          <p className="text-gray-400 text-xs mb-6">
            Ajoutez une classe et sélectionnez les manuels à acheter.
          </p>
          <button
            onClick={() => navigate('/parent-selection')}
            className="bg-amber-500 text-white font-bold px-6 py-3 rounded-2xl text-sm"
          >
            Gérer mes achats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showDelivery && (
        <DeliveryModal
          defaultPhone={user?.phone ?? ''}
          onClose={() => setShowDelivery(false)}
          onConfirm={info => {
            setShowDelivery(false);
            toast({
              title: 'Commande transmise',
              description: `Livraison à : ${info.adresse}`,
            });
            navigate('/search');
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
            <h1 className="font-bold text-lg leading-tight">Récapitulatif des achats</h1>
            <p className="text-amber-100 text-xs">{totalItems} article{totalItems > 1 ? 's' : ''} sélectionné{totalItems > 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Tabs enfants — uniquement ceux avec des articles */}
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
        </div>
      </div>

      <div className="px-4 pt-4 pb-48 max-w-2xl mx-auto">
        {/* Infos classe */}
        {activeEnfant && (
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
              <p className="text-xs text-gray-400">Estimation</p>
              <p className="font-bold text-amber-700 text-sm">
                {totalEnfant > 0 ? `${totalEnfant.toLocaleString()} F` : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Items groupés par type */}
        {grouped.map(({ type, items: gItems }) => {
          const typeTotal = gItems.reduce((s, it) => s + estimateItem(it), 0);
          const colors = TYPE_COLORS[type];
          return (
            <div key={type} className="mb-5">
              {/* Section header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${colors.bg} border ${colors.border} mb-2`}>
                <div className={`flex items-center gap-2 font-semibold text-sm ${colors.text}`}>
                  {TYPE_ICONS[type]}
                  {TYPE_LABELS[type]}
                  <span className="text-xs font-normal opacity-70">({gItems.length})</span>
                </div>
                {typeTotal > 0 && (
                  <span className={`text-xs font-bold ${colors.text}`}>{typeTotal.toLocaleString()} F</span>
                )}
              </div>
              <div className="space-y-2">
                {gItems.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                    onUpdateChoix={updateChoix}
                    onUpdateQuantite={updateQuantite}
                    onUpdateGamme={updateGamme}
                    onDuplicate={(newQ) => {
                      toast({
                        title: `×${newQ} exemplaires`,
                        description: `"${item.titre.slice(0, 40)}${item.titre.length > 40 ? '…' : ''}" — pour ${newQ} élèves dans la même classe. Vérifiez que c'est intentionnel.`,
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Synthèse globale tous enfants */}
        {enfants.filter(e => countByEnfant(e.id) > 0).length > 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-2">
            <p className="font-semibold text-amber-800 text-sm mb-3">Synthèse globale</p>
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
                      {items.length} article{items.length > 1 ? 's' : ''}
                    </p>
                    {total > 0 && <p className="text-xs text-amber-600">{total.toLocaleString()} F</p>}
                  </div>
                </div>
              );
            })}
            <div className="border-t border-amber-300 mt-2 pt-2 flex items-center justify-between">
              <p className="font-bold text-amber-900 text-sm">Total estimé</p>
              <p className="font-bold text-amber-800 text-base">
                {grandTotal > 0 ? `${grandTotal.toLocaleString()} FCFA` : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Ajouter d'autres articles */}
        <button
          onClick={() => navigate('/parent-selection')}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-amber-300 rounded-2xl text-amber-700 font-semibold text-sm"
        >
          + Ajouter des articles
        </button>
      </div>

      {/* Bottom bar sticky */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">Total estimé</p>
              <p className="font-bold text-gray-900 text-xl">
                {grandTotal > 0 ? `${grandTotal.toLocaleString()} FCFA` : '—'}
              </p>
            </div>
            <p className="text-xs text-gray-400 text-right">
              {totalItems} article{totalItems > 1 ? 's' : ''}<br />
              {enfants.filter(e => countByEnfant(e.id) > 0).length} classe{enfants.filter(e => countByEnfant(e.id) > 0).length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowDelivery(true)}
            className="w-full bg-amber-600 text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2"
          >
            <MapPin className="w-5 h-5" />
            Préciser la livraison
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            Adresse + téléphone requis avant validation de la commande
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecapAchatPage;
