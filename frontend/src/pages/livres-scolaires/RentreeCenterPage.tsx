import {
  ArrowLeft, BookOpen, Camera, Check, ChevronRight, Loader2,
  Plus, Repeat, Sparkles, ShoppingBag, X, School,
} from 'lucide-react';
// note : i18next plural form `_one|_other` est résolu automatiquement par t() avec count.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiPost, apiGet } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';
import { useParentShop, type Enfant, type PanierItem, type TypeItem, type Choix } from '../../hooks/useParentShop';
import {
  CLASSES_PAR_SYSTEME_NIVEAU_LEGACY as CPSN,
  NIVEAUX_PAR_SYSTEME_LEGACY as NPS,
  PAYS_PAR_DEFAUT,
  type PaysCode,
} from '../../data/schoolSystemsLegacy';
import BookPhotoCapture, { type AnalyzedBookResult } from '../../components/livres-scolaires/BookPhotoCapture';

// ─── Types locaux ───
type SuggestionItem = {
  source: 'etablissement' | 'national' | 'populaire';
  type_article: TypeItem | string;
  titre: string;
  auteur?: string | null;
  editeur?: string | null;
  matiere?: string | null;
  niveau?: string | null;
  prix_officiel?: number | null;
  devise?: string | null;
  quantite_defaut?: number;
  est_obligatoire?: boolean | null;
  frequency_score?: number;
};

type GroupeFilter = 'livres' | 'fournitures';

const RentreeCenterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    enfants, panier, addEnfant,
    addItems, removeItem, updateChoix, updateTrocMatch,
  } = useParentShop();

  // ─── Onglet classe actif (par défaut le 1er) ───
  const [activeId, setActiveId] = useState<string>('');
  useEffect(() => {
    if (!activeId && enfants[0]) setActiveId(enfants[0].id);
    if (activeId && !enfants.find(e => e.id === activeId) && enfants[0]) setActiveId(enfants[0].id);
  }, [enfants, activeId]);
  const active = useMemo(() => enfants.find(e => e.id === activeId), [enfants, activeId]);

  const itemsForActive = useMemo(
    () => (active ? panier.filter(p => p.enfantId === active.id) : []),
    [panier, active]
  );

  // ─── Modaux ───
  const [showClassForm, setShowClassForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTrocExplainer, setShowTrocExplainer] = useState<{ itemId: string } | null>(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState<{ itemId: string } | null>(null);

  // ✅ Lien direct depuis l'accueil : ?suggestions=1 ouvre directement le modal.
  // Si aucune classe → on ouvre le formulaire de classe d'abord.
  useEffect(() => {
    if (searchParams.get('suggestions') === '1') {
      if (enfants.length === 0) setShowClassForm(true);
      else setShowSuggestions(true);
      const next = new URLSearchParams(searchParams);
      next.delete('suggestions');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, enfants.length, setSearchParams]);

  // ─── Session troc (créée à la demande quand on photographie) ───
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const sessionInitRef = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation || gps) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => { /* GPS optionnel */ },
      { timeout: 5000, maximumAge: 60000 },
    );
  }, [gps]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (sessionCreating || sessionInitRef.current) return null;
    sessionInitRef.current = true;
    setSessionCreating(true);
    try {
      const payload: Record<string, any> = { mode_listing_defaut: 'troc' };
      if (gps) payload.gps_recuperation = `${gps.lat},${gps.lon}`;
      const res = await apiPost('/api/bourse-livre/v2/sessions', payload);
      const data = await res.json().catch(() => ({}));
      const newId = data?.session_id || data?.id || data?.data?.session_id || data?.data?.id;
      if (!res.ok || !newId) throw new Error(data?.error || 'session creation failed');
      setSessionId(newId);
      return newId;
    } catch (e: any) {
      sessionInitRef.current = false;
      toast({ title: 'Erreur session', description: e?.message || 'Réessayez', variant: 'destructive' });
      return null;
    } finally {
      setSessionCreating(false);
    }
  }, [gps, sessionId, sessionCreating, toast]);

  // ─── Suggestions (modal "ajouter manuellement") ───
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [suggGroupe, setSuggGroupe] = useState<GroupeFilter>('livres');
  const [selectedSugg, setSelectedSugg] = useState<Record<string, number>>({}); // titre → qte

  const loadSuggestions = useCallback(async () => {
    if (!active) return;
    setLoadingSugg(true);
    setSuggestions([]);
    try {
      const params = new URLSearchParams();
      params.set('classe', active.classe);
      params.set('type_groupe', suggGroupe);
      params.set('pays', active.pays || PAYS_PAR_DEFAUT);
      if (active.systeme) params.set('systeme', active.systeme);
      if (active.etablissementId) params.set('etablissement_id', String(active.etablissementId));
      const res = await apiGet(`/api/v2/parent/articles-suggested?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'load failed');
      setSuggestions((data?.items || []) as SuggestionItem[]);
    } catch (e: any) {
      toast({ title: t('bourse.rentree.error_load_items'), description: e?.message, variant: 'destructive' });
    } finally {
      setLoadingSugg(false);
    }
  }, [active, suggGroupe, toast, t]);

  useEffect(() => {
    if (showSuggestions) loadSuggestions();
  }, [showSuggestions, suggGroupe, loadSuggestions]);

  // ─── Actions ───
  const handleAddSelectedSuggestions = () => {
    if (!active) return;
    const toAdd: Omit<PanierItem, 'id'>[] = suggestions
      .filter(s => (selectedSugg[s.titre] ?? 0) > 0)
      .map(s => ({
        enfantId: active.id,
        titre: s.titre,
        auteur: s.auteur || undefined,
        matiere: s.matiere || undefined,
        editeur: s.editeur || undefined,
        type: ((s.type_article as TypeItem) || 'livre'),
        prixNeuf: s.prix_officiel || undefined,
        choix: 'neuf' as Choix,
        quantite: selectedSugg[s.titre] ?? 1,
      }));
    if (toAdd.length === 0) return;
    addItems(toAdd);
    toast({ title: `${toAdd.length} article(s) ajoutés` });
    setSelectedSugg({});
    setShowSuggestions(false);
  };

  const startTroc = (item: PanierItem) => {
    if (item.choix !== 'occasion') updateChoix(item.id, 'occasion');
    setShowTrocExplainer({ itemId: item.id });
  };

  const continueToCapture = async () => {
    if (!showTrocExplainer) return;
    const sid = await ensureSession();
    if (!sid) return;
    const itemId = showTrocExplainer.itemId;
    setShowTrocExplainer(null);
    setShowPhotoCapture({ itemId });
  };

  const onPhotoAnalyzed = (itemId: string, result: AnalyzedBookResult) => {
    if (result.is_rejected) {
      toast({
        title: 'Livre trop dégradé',
        description: 'Réessayez avec une meilleure photo ou choisissez le neuf.',
        variant: 'destructive',
      });
      setShowPhotoCapture(null);
      return;
    }
    updateTrocMatch(itemId, result.livre_id);
    setShowPhotoCapture(null);
    const credit = Math.round(result.valeur_calculee * 0.6);
    toast({
      title: 'Crédit Yukpo réservé',
      description: `≈ ${credit.toLocaleString('fr-FR')} XAF appliqués à votre commande.`,
    });
  };

  const goRecap = () => navigate('/recap');
  const goVendre = () => navigate('/vendre');
  const goPartner = () => navigate('/recherche-ecole');
  const goScan = () => navigate('/scan-programme');

  // ─── Calcul total prévisionnel pour barre du bas ───
  const totalPrevisionnel = itemsForActive.reduce((acc, it) => {
    const qte = it.quantite ?? 1;
    const px = (it.choix === 'occasion' ? it.prixOccasion ?? it.prixNeuf : it.prixNeuf) ?? 0;
    return acc + px * qte;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-8 pb-4 text-white sticky top-0 z-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full active:bg-white/20" aria-label="Retour">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate">{t('bourse.rentree.title')}</h1>
              <p className="text-amber-100 text-xs truncate">{t('bourse.rentree.subtitle')}</p>
            </div>
          </div>

          {/* Onglets classe (PAS de prénom enfant) */}
          {enfants.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
              {enfants.map(e => (
                <button
                  key={e.id}
                  onClick={() => setActiveId(e.id)}
                  className={`flex-shrink-0 px-3 py-2 min-h-[44px] rounded-full text-sm font-semibold whitespace-nowrap ${
                    e.id === activeId
                      ? 'bg-white text-amber-700 shadow'
                      : 'bg-white/20 text-white border border-white/30'
                  }`}
                >
                  {e.classe}
                </button>
              ))}
              <button
                onClick={() => setShowClassForm(true)}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-full text-sm font-semibold bg-white/20 text-white border border-dashed border-white/50 active:bg-white/30"
              >
                <Plus className="w-4 h-4" /> {t('bourse.rentree.add_class')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4">
        {/* Empty state — aucune classe */}
        {enfants.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <School className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <h2 className="font-bold text-base text-gray-800">{t('bourse.rentree.no_class_yet')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('bourse.rentree.no_class_help')}</p>
            <button
              onClick={() => setShowClassForm(true)}
              className="mt-4 w-full bg-amber-500 text-white font-bold py-3 rounded-xl active:bg-amber-600 min-h-[48px]"
            >
              {t('bourse.rentree.add_class')}
            </button>
          </div>
        )}

        {/* Source picker — visible si la liste de cette classe est vide */}
        {active && itemsForActive.length === 0 && (
          <section className="space-y-3">
            <h2 className="font-bold text-sm text-gray-800 mt-1">{t('bourse.rentree.source_picker_title')}</h2>

            {/* 1. École partenaire (PRIORITÉ) */}
            <button
              onClick={goPartner}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border-2 border-amber-300 text-left active:bg-amber-50 min-h-[80px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <School className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-800">{t('bourse.rentree.source_partner_title')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t('bourse.rentree.source_partner_desc')}</div>
                  <div className="text-xs text-amber-700 font-semibold mt-1.5 inline-flex items-center gap-1">
                    {t('bourse.rentree.source_partner_cta')} <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </button>

            {/* 2. Scan list (FALLBACK) */}
            <button
              onClick={goScan}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-left active:bg-gray-50 min-h-[80px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-800">{t('bourse.rentree.source_scan_title')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t('bourse.rentree.source_scan_desc')}</div>
                  <div className="text-xs text-blue-700 font-semibold mt-1.5 inline-flex items-center gap-1">
                    {t('bourse.rentree.source_scan_cta')} <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </button>

            {/* 3. Manuel (suggestions intelligentes) */}
            <button
              onClick={() => setShowSuggestions(true)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-200 text-left active:bg-gray-50 min-h-[80px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-800">{t('bourse.rentree.source_manual_title')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t('bourse.rentree.source_manual_desc')}</div>
                  <div className="text-xs text-purple-700 font-semibold mt-1.5 inline-flex items-center gap-1">
                    {t('bourse.rentree.source_manual_cta')} <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </button>
          </section>
        )}

        {/* Liste des articles pour la classe active */}
        {active && itemsForActive.length > 0 && (
          <section className="space-y-2 mt-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-bold text-sm text-gray-800">
                {t('bourse.rentree.items_for_class', { classe: active.classe })}
              </h2>
              <button
                onClick={() => setShowSuggestions(true)}
                className="text-xs font-bold text-amber-700 active:text-amber-800 inline-flex items-center gap-1 min-h-[44px] px-2"
              >
                <Plus className="w-3.5 h-3.5" /> {t('bourse.rentree.source_manual_cta')}
              </button>
            </div>

            <ul className="space-y-2">
              {itemsForActive.map(it => (
                <ItemCard
                  key={it.id}
                  item={it}
                  onChoix={(c) => updateChoix(it.id, c)}
                  onTroc={() => startTroc(it)}
                  onRemove={() => removeItem(it.id)}
                  isTrocMatched={!!it.trocLivreId}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Vendre vieux livres SANS troc */}
        {active && (
          <section className="mt-5 pt-4 border-t border-dashed border-gray-300">
            <button
              onClick={goVendre}
              className="w-full bg-white rounded-2xl p-4 text-left active:bg-gray-50 min-h-[64px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4.5 h-4.5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-700">{t('bourse.rentree.sell_old_books_title')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t('bourse.rentree.sell_old_books_desc')}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 mt-2" />
              </div>
            </button>
          </section>
        )}
      </div>

      {/* ─── Sticky bottom bar ─── */}
      {active && itemsForActive.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-30">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">{t('bourse.rentree.total_label')}</div>
              <div className="font-bold text-base text-gray-900">
                {totalPrevisionnel.toLocaleString('fr-FR')} XAF
              </div>
            </div>
            <button
              onClick={goRecap}
              className="bg-amber-500 text-white font-bold px-5 py-3 rounded-xl active:bg-amber-600 min-h-[48px] inline-flex items-center gap-2"
            >
              {t('bourse.rentree.go_recap')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Modaux ─── */}
      {showClassForm && (
        <ClassFormModal
          onClose={() => setShowClassForm(false)}
          onSave={(e) => {
            const created = addEnfant(e);
            setActiveId(created.id);
            setShowClassForm(false);
          }}
        />
      )}

      {showSuggestions && active && (
        <SuggestionsModal
          classe={active.classe}
          loading={loadingSugg}
          suggestions={suggestions}
          groupe={suggGroupe}
          setGroupe={setSuggGroupe}
          selected={selectedSugg}
          setSelected={setSelectedSugg}
          onClose={() => setShowSuggestions(false)}
          onAdd={handleAddSelectedSuggestions}
        />
      )}

      {showTrocExplainer && (
        <TrocExplainerModal
          onClose={() => setShowTrocExplainer(null)}
          onContinue={continueToCapture}
          loading={sessionCreating}
        />
      )}

      {showPhotoCapture && sessionId && (
        <PhotoCaptureModal
          sessionId={sessionId}
          gps={gps}
          onCancel={() => setShowPhotoCapture(null)}
          onAnalyzed={(r) => onPhotoAnalyzed(showPhotoCapture.itemId, r)}
        />
      )}
    </div>
  );
};

export default RentreeCenterPage;

// ============================================================================
// Sous-composants
// ============================================================================

const ItemCard: React.FC<{
  item: PanierItem;
  onChoix: (c: Choix) => void;
  onTroc: () => void;
  onRemove: () => void;
  isTrocMatched: boolean;
}> = ({ item, onChoix, onTroc, onRemove, isTrocMatched }) => {
  const { t } = useTranslation();
  const isOccasionable = item.type === 'livre' || item.type === 'workbook' as any;

  return (
    <li className="bg-white rounded-2xl p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 line-clamp-2">{item.titre}</div>
          {item.matiere && <div className="text-xs text-gray-500">{item.matiere}</div>}
          {item.prixNeuf && (
            <div className="text-xs text-amber-700 font-semibold mt-0.5">
              {item.prixNeuf.toLocaleString('fr-FR')} XAF
            </div>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-2 -m-2 text-gray-400 active:text-gray-600 min-h-[44px] min-w-[44px]"
          aria-label="Retirer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Choix */}
      {isOccasionable && (
        <div className="mt-2 flex items-center gap-1.5">
          <ChoixPill active={item.choix === 'neuf'} onClick={() => onChoix('neuf')}>
            {t('bourse.rentree.decision_neuf')}
          </ChoixPill>
          <ChoixPill active={item.choix === 'occasion' && !isTrocMatched} onClick={() => onChoix('occasion')}>
            {t('bourse.rentree.decision_occasion')}
          </ChoixPill>
          <ChoixPill active={isTrocMatched} onClick={onTroc} highlight>
            <Repeat className="w-3 h-3 inline mr-0.5" />
            {isTrocMatched ? <Check className="w-3 h-3 inline" /> : t('bourse.rentree.decision_troc')}
          </ChoixPill>
        </div>
      )}
    </li>
  );
};

const ChoixPill: React.FC<{
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
  children: React.ReactNode;
}> = ({ active, onClick, highlight, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 text-xs font-semibold px-2 py-2 rounded-lg min-h-[40px] ${
      active
        ? highlight
          ? 'bg-green-600 text-white'
          : 'bg-amber-500 text-white'
        : 'bg-gray-100 text-gray-700 active:bg-gray-200'
    }`}
  >
    {children}
  </button>
);

// ─── Modal ajout d'une classe (sans nom enfant) ───
const ClassFormModal: React.FC<{
  onClose: () => void;
  onSave: (e: Omit<Enfant, 'id'>) => void;
}> = ({ onClose, onSave }) => {
  const { t } = useTranslation();
  const [systeme, setSysteme] = useState<'francophone' | 'anglophone'>('francophone');
  const [niveau, setNiveau] = useState<string>('');
  const [classe, setClasse] = useState<string>('');

  const niveaux = NPS[systeme];
  const classes = niveau
    ? ((CPSN as any)[systeme]?.[niveau] as readonly string[] | undefined) || []
    : [];

  const handleSave = () => {
    if (!niveau || !classe) return;
    onSave({
      systeme,
      niveau,
      classe,
      pays: PAYS_PAR_DEFAUT as PaysCode,
      systemeId: `${PAYS_PAR_DEFAUT}-${systeme === 'anglophone' ? 'en' : 'fr'}`,
    });
  };

  return (
    <ModalShell onClose={onClose} title={t('bourse.rentree.class_form_title')}>
      <div className="space-y-4">
        {/* Système */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">{t('bourse.rentree.class_form_system')}</label>
          <div className="flex gap-2">
            {(['francophone', 'anglophone'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setSysteme(s); setNiveau(''); setClasse(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold min-h-[44px] ${
                  s === systeme ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {s === 'francophone' ? 'Francophone' : 'Anglophone'}
              </button>
            ))}
          </div>
        </div>
        {/* Niveau */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">{t('bourse.rentree.class_form_level')}</label>
          <select
            value={niveau}
            onChange={(e) => { setNiveau(e.target.value); setClasse(''); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
          >
            <option value="">—</option>
            {niveaux.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {/* Classe */}
        {niveau && (
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{t('bourse.rentree.class_form_class')}</label>
            <select
              value={classe}
              onChange={(e) => setClasse(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm min-h-[44px]"
            >
              <option value="">—</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl min-h-[48px]"
        >
          {t('bourse.rentree.class_form_cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!niveau || !classe}
          className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-xl disabled:bg-gray-300 min-h-[48px]"
        >
          {t('bourse.rentree.class_form_save')}
        </button>
      </div>
    </ModalShell>
  );
};

// ─── Modal suggestions intelligentes ───
const SuggestionsModal: React.FC<{
  classe: string;
  loading: boolean;
  suggestions: SuggestionItem[];
  groupe: GroupeFilter;
  setGroupe: (g: GroupeFilter) => void;
  selected: Record<string, number>;
  setSelected: (s: Record<string, number>) => void;
  onClose: () => void;
  onAdd: () => void;
}> = ({ classe, loading, suggestions, groupe, setGroupe, selected, setSelected, onClose, onAdd }) => {
  const { t } = useTranslation();
  const total = Object.values(selected).filter(v => v > 0).length;

  const toggle = (titre: string, qte: number) => {
    const next = { ...selected };
    if (qte <= 0) delete next[titre]; else next[titre] = qte;
    setSelected(next);
  };

  return (
    <ModalShell onClose={onClose} title={t('bourse.rentree.suggestions_title', { classe })} fullScreen>
      <p className="text-xs text-gray-500 mb-3">{t('bourse.rentree.suggestions_subtitle')}</p>

      {/* Filtres */}
      <div className="flex gap-2 mb-3 sticky top-0 bg-white z-10 pb-2">
        {(['livres', 'fournitures'] as GroupeFilter[]).map(g => (
          <button
            key={g}
            onClick={() => setGroupe(g)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold min-h-[40px] ${
              g === groupe ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {g === 'livres' ? t('bourse.rentree.suggestions_filter_books') : t('bourse.rentree.suggestions_filter_supplies')}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
          <p className="text-xs text-gray-500 mt-2">{t('bourse.rentree.suggestions_loading')}</p>
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">
          {t('bourse.rentree.suggestions_empty')}
        </div>
      )}

      <ul className="space-y-2 pb-32">
        {suggestions.map(s => {
          const qte = selected[s.titre] ?? 0;
          const sourceLabel = s.source === 'etablissement'
            ? t('bourse.rentree.suggestions_source_etab')
            : s.source === 'national'
            ? t('bourse.rentree.suggestions_source_national')
            : t('bourse.rentree.suggestions_source_popular');
          return (
            <li key={s.titre} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 mb-0.5">{sourceLabel}</div>
                  <div className="font-semibold text-sm text-gray-900 line-clamp-2">{s.titre}</div>
                  {s.matiere && <div className="text-xs text-gray-500">{s.matiere}</div>}
                  <div className="flex items-center gap-2 mt-1">
                    {s.prix_officiel && (
                      <span className="text-xs text-amber-700 font-semibold">
                        {s.prix_officiel.toLocaleString('fr-FR')} {s.devise || 'XAF'}
                      </span>
                    )}
                    {s.est_obligatoire && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                        {t('bourse.rentree.suggestions_required')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggle(s.titre, Math.max(0, qte - 1))}
                    className="w-9 h-9 rounded-lg bg-gray-100 active:bg-gray-200 text-gray-700 font-bold"
                    disabled={qte === 0}
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-bold">{qte}</span>
                  <button
                    onClick={() => toggle(s.titre, qte + 1)}
                    className="w-9 h-9 rounded-lg bg-amber-500 text-white font-bold active:bg-amber-600"
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sticky add bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl min-h-[48px]"
          >
            {t('bourse.rentree.suggestions_close')}
          </button>
          <button
            onClick={onAdd}
            disabled={total === 0}
            className="flex-1 bg-amber-500 text-white font-bold py-3 rounded-xl disabled:bg-gray-300 min-h-[48px]"
          >
            {t('bourse.rentree.suggestions_add_selected', { count: total })}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

// ─── Modal explainer troc ───
const TrocExplainerModal: React.FC<{
  onClose: () => void;
  onContinue: () => void;
  loading: boolean;
}> = ({ onClose, onContinue, loading }) => {
  const { t } = useTranslation();
  return (
    <ModalShell onClose={onClose} title={t('bourse.rentree.troc_explainer_title')}>
      <ul className="space-y-3 text-sm text-gray-700">
        <li>{t('bourse.rentree.troc_explainer_step1')}</li>
        <li>{t('bourse.rentree.troc_explainer_step2')}</li>
        <li>{t('bourse.rentree.troc_explainer_step3')}</li>
        <li>{t('bourse.rentree.troc_explainer_step4')}</li>
      </ul>
      <button
        onClick={onContinue}
        disabled={loading}
        className="mt-5 w-full bg-green-600 text-white font-bold py-3 rounded-xl active:bg-green-700 disabled:bg-gray-300 min-h-[48px] inline-flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {t('bourse.rentree.troc_explainer_cta')}
      </button>
    </ModalShell>
  );
};

// ─── Modal photo capture ───
const PhotoCaptureModal: React.FC<{
  sessionId: string;
  gps: { lat: number; lon: number } | null;
  onCancel: () => void;
  onAnalyzed: (r: AnalyzedBookResult) => void;
}> = ({ sessionId, gps, onCancel, onAnalyzed }) => {
  return (
    <ModalShell onClose={onCancel} title="Photographier le livre" fullScreen>
      <BookPhotoCapture
        sessionId={sessionId}
        userLat={gps?.lat}
        userLng={gps?.lon}
        modeListing="troc"
        onAnalyzed={onAnalyzed}
        onCancel={onCancel}
      />
    </ModalShell>
  );
};

// ─── Coque modale réutilisable ───
const ModalShell: React.FC<{
  onClose: () => void;
  title: string;
  fullScreen?: boolean;
  children: React.ReactNode;
}> = ({ onClose, title, fullScreen, children }) => (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
    <div className={`bg-white w-full max-w-md ${fullScreen ? 'h-full sm:h-[90vh] sm:rounded-2xl' : 'rounded-t-2xl sm:rounded-2xl'} p-4 overflow-y-auto`}>
      <div className="flex items-center justify-between mb-3 sticky top-0 bg-white z-20 -mt-4 -mx-4 px-4 pt-4 pb-2 border-b border-gray-100">
        <h3 className="font-bold text-base text-gray-900 truncate">{title}</h3>
        <button onClick={onClose} className="p-2 -m-2 text-gray-500 active:text-gray-800 min-h-[44px] min-w-[44px]" aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
