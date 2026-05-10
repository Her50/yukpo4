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
import { PAYS_PAR_DEFAUT, type PaysCode } from '../../data/schoolSystemsLegacy';
import {
  getSystemesForPays,
  LISTE_PAYS_UNIQUES,
} from '../../data/schoolSystems';
import type { Systeme } from '../../hooks/useParentShop';
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
    addItems, removeItem, updateChoix, updateTrocMatch, clearTrocIntent,
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

  // Nombre global d'items en attente de photo troc (toutes classes confondues).
  // Sert à afficher la bannière "X livres à photographier" en haut.
  const pendingTrocCount = useMemo(
    () => panier.filter(p => p.choix === 'occasion' && p.troc_intent && !p.trocLivreId).length,
    [panier],
  );

  // ─── Modaux ───
  const [showClassForm, setShowClassForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTrocExplainer, setShowTrocExplainer] = useState<{ itemId: string } | null>(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState<{ itemId: string } | null>(null);
  // Modal "Ajouter une autre classe" — si l'enfant courant vient d'une école
  // partenaire, on propose de rester dans la même école (cas frère/sœur).
  const [showAddClassChoice, setShowAddClassChoice] = useState(false);

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

  // ✅ Depuis la page scan : ?capture-troc=1 → ouvre directement la photo
  // capture pour le 1er item marqué troc_intent (sans match déjà fait). Au
  // résultat de chaque capture, on enchaîne sur le suivant. Quand tous sont
  // traités, le param query est nettoyé.
  const pendingTrocItem = useMemo(
    () => panier.find(p => p.choix === 'occasion' && p.troc_intent && !p.trocLivreId),
    [panier],
  );
  const captureTrocActive = searchParams.get('capture-troc') === '1';
  useEffect(() => {
    if (!captureTrocActive) return;
    if (!pendingTrocItem) {
      // Plus rien à capturer → on retire le param et reste sur la page recap.
      const next = new URLSearchParams(searchParams);
      next.delete('capture-troc');
      setSearchParams(next, { replace: true });
      return;
    }
    // Bascule l'item actif sur la classe du livre concerné (sinon
    // l'utilisateur ne verrait pas l'item)
    if (pendingTrocItem.enfantId !== activeId) setActiveId(pendingTrocItem.enfantId);
    // Si pas encore en cours de capture, on lance le flow (explainer puis photo)
    if (!showPhotoCapture && !showTrocExplainer) {
      setShowTrocExplainer({ itemId: pendingTrocItem.id });
    }
  }, [captureTrocActive, pendingTrocItem, activeId, showPhotoCapture, showTrocExplainer, searchParams, setSearchParams]);

  // ─── Session troc (créée à la demande quand on photographie) ───
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const sessionInitRef = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation || gps) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => { /* permission refusée au montage : on retentera au clic */ },
      { timeout: 5000, maximumAge: 60000 },
    );
  }, [gps]);

  /** Demande la position GPS à la demande (au moment du clic "Photographier").
   *  Si la permission a été refusée au montage, ce 2e appel re-déclenchera
   *  le prompt navigateur sur la plupart des plateformes. */
  const requestGpsNow = useCallback((): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (gps) return resolve(gps);
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setGps(coords);
          resolve(coords);
        },
        () => resolve(null),
        { timeout: 8000, maximumAge: 60000 },
      );
    });
  }, [gps]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (sessionCreating || sessionInitRef.current) return null;
    // ✅ Le backend (POST /api/bourse-livre/v2/sessions) exige un
    // gps_recuperation non vide. On le demande JIT — si l'utilisateur
    // refuse, on lui dit clairement pourquoi on ne peut pas continuer.
    let coords = gps;
    if (!coords) coords = await requestGpsNow();
    if (!coords) {
      toast({
        title: 'Localisation requise',
        description: "Yukpo a besoin de votre position pour organiser la récupération du livre. Autorisez la géolocalisation dans votre navigateur puis réessayez.",
        variant: 'destructive',
      });
      return null;
    }
    sessionInitRef.current = true;
    setSessionCreating(true);
    try {
      const payload: Record<string, any> = {
        mode_listing_defaut: 'troc',
        gps_recuperation: `${coords.lat},${coords.lon}`,
      };
      const res = await apiPost('/api/bourse-livre/v2/sessions', payload);
      const data = await res.json().catch(() => ({}));
      const newId = data?.session_id || data?.id || data?.data?.session_id || data?.data?.id || data?.session?.id;
      if (!res.ok || !newId) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      setSessionId(newId);
      return newId;
    } catch (e: any) {
      sessionInitRef.current = false;
      toast({ title: 'Erreur session', description: e?.message || 'Réessayez', variant: 'destructive' });
      return null;
    } finally {
      setSessionCreating(false);
    }
  }, [gps, sessionId, sessionCreating, toast, requestGpsNow]);

  // ─── Suggestions (modal "ajouter manuellement") ───
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [suggGroupe, setSuggGroupe] = useState<GroupeFilter>('livres');
  const [selectedSugg, setSelectedSugg] = useState<Record<string, number>>({}); // titre → qte

  // ✅ Évite les boucles : on ne dépend QUE des paramètres réels (classe, groupe,
  // établissement) — `t`/`toast` ne doivent JAMAIS être dans les deps d'un effect
  // qui déclenche un fetch + un toast en cas d'erreur (sinon : boucle infinie).
  // Une seule erreur → un seul toast. Un changement réel d'input → re-fetch.
  const errorShownRef = useRef(false);
  useEffect(() => {
    if (!showSuggestions || !active) return;
    let cancelled = false;
    setLoadingSugg(true);
    setSuggestions([]);
    errorShownRef.current = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('classe', active.classe);
        params.set('type_groupe', suggGroupe);
        params.set('pays', active.pays || PAYS_PAR_DEFAUT);
        if (active.systeme) params.set('systeme', active.systeme);
        if (active.etablissementId) params.set('etablissement_id', String(active.etablissementId));
        const res = await apiGet(`/api/v2/parent/articles-suggested?${params}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.message || 'load failed');
        setSuggestions((data?.items || []) as SuggestionItem[]);
      } catch (e: any) {
        if (cancelled || errorShownRef.current) return;
        errorShownRef.current = true;
        toast({ title: t('bourse.rentree.error_load_items'), description: e?.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoadingSugg(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuggestions, suggGroupe, active?.classe, active?.systeme, active?.pays, active?.etablissementId]);

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
      // Livre rejeté : on lève l'intention de troc pour éviter une boucle
      // sur ce même item lors d'un éventuel ?capture-troc=1
      clearTrocIntent(itemId);
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
              {/* "Ajouter une classe" — comportement adaptatif :
                  • Si la classe active vient d'une école partenaire, on
                    propose au parent de continuer dans la même école
                    (frère/sœur) ou bien d'aller ailleurs (accueil).
                  • Sinon : navigate('/') direct (les 3 sources de l'accueil). */}
              <button
                onClick={() => {
                  if (active?.etablissementSlug) {
                    setShowAddClassChoice(true);
                  } else {
                    navigate('/');
                  }
                }}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-full text-sm font-semibold bg-white/20 text-white border border-dashed border-white/50 active:bg-white/30"
              >
                <Plus className="w-4 h-4" /> {t('bourse.rentree.add_class')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4">
        {/* Empty state — aucune classe : on renvoie sur l'accueil qui propose
            les 3 sources (école partenaire / photo / suggestions). */}
        {enfants.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <School className="w-10 h-10 text-amber-400 mx-auto mb-2" />
            <h2 className="font-bold text-base text-gray-800">{t('bourse.rentree.no_class_yet')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('bourse.rentree.no_class_help')}</p>
            <button
              onClick={() => navigate('/')}
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

        {/* Bannière "X livres en échange à photographier" — visible dès qu'au
            moins un item du panier global a une intention de troc non encore
            associée à une photo. Permet de reprendre le scan à tout moment. */}
        {pendingTrocCount > 0 && (
          <section className="mt-3">
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
                <Camera className="w-4.5 h-4.5 text-amber-800" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-amber-900 leading-tight">
                  {t(pendingTrocCount > 1 ? 'bourse.rentree.troc_pending_summary_other' : 'bourse.rentree.troc_pending_summary_one', { count: pendingTrocCount })}
                </div>
                <button
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('capture-troc', '1');
                    setSearchParams(next, { replace: true });
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-700 active:text-amber-800"
                >
                  {t('bourse.rentree.troc_pending_cta')} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Liste des articles pour la classe active */}
        {active && itemsForActive.length > 0 && (
          <section className="space-y-2 mt-2">
            <p className="text-[11px] text-gray-500 leading-snug px-1 mb-1">
              {t('bourse.rentree.choices_hint')}
            </p>
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
                  onCancelTrocIntent={() => clearTrocIntent(it.id)}
                  isTrocMatched={!!it.trocLivreId}
                  isTrocPending={!!it.troc_intent && !it.trocLivreId}
                />
              ))}
            </ul>
          </section>
        )}

        {/* CTA "J'ai fini → récap général de toutes mes classes" — visible
            dès qu'au moins un article est dans le panier (toutes classes
            confondues). C'est l'option explicite quand l'utilisateur n'a
            pas envie d'ajouter une autre classe. */}
        {panier.length > 0 && (
          <section className="mt-5">
            <button
              onClick={goRecap}
              className="w-full bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-left active:bg-emerald-100 min-h-[72px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-emerald-800" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-emerald-900">{t('bourse.rentree.go_full_recap_title')}</div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    {t('bourse.rentree.go_full_recap_desc', { count: panier.length })}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-700 mt-2 flex-shrink-0" />
              </div>
            </button>
          </section>
        )}

        {/* Vendre vieux livres SANS troc */}
        {active && (
          <section className="mt-4 pt-4 border-t border-dashed border-gray-300">
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
          onLater={() => {
            // ✅ "Plus tard" : on garde l'intention de troc pour que l'item
            // reste visiblement marqué "à photographier" dans /rentree et
            // /recap, mais on stoppe la boucle capture-troc pour ne pas
            // ré-ouvrir la modale en boucle sur ce même item.
            if (captureTrocActive) {
              const next = new URLSearchParams(searchParams);
              next.delete('capture-troc');
              setSearchParams(next, { replace: true });
            }
            setShowTrocExplainer(null);
          }}
          onContinue={continueToCapture}
          loading={sessionCreating}
        />
      )}

      {/* Modal "Ajouter une autre classe" — choix école courante vs autre */}
      {showAddClassChoice && active?.etablissementSlug && (
        <ModalShell
          onClose={() => setShowAddClassChoice(false)}
          title={t('bourse.rentree.add_class_choice_title')}
        >
          <p className="text-sm text-gray-600 mb-4">
            {t('bourse.rentree.add_class_choice_desc', {
              etab: active.etablissementNom || t('bourse.rentree.add_class_choice_same_school_fallback'),
            })}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setShowAddClassChoice(false);
                navigate(`/ecole/${active.etablissementSlug}/commander`);
              }}
              className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl active:bg-amber-600 min-h-[48px] inline-flex items-center justify-center gap-2"
            >
              <School className="w-4 h-4" />
              {t('bourse.rentree.add_class_choice_same_school', {
                etab: active.etablissementNom || '',
              })}
            </button>
            <button
              onClick={() => {
                setShowAddClassChoice(false);
                navigate('/');
              }}
              className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl active:bg-gray-200 min-h-[48px]"
            >
              {t('bourse.rentree.add_class_choice_other')}
            </button>
          </div>
        </ModalShell>
      )}

      {showPhotoCapture && sessionId && (
        <PhotoCaptureModal
          sessionId={sessionId}
          gps={gps}
          onCancel={() => {
            // Annulation pendant la prise de photo : on garde aussi
            // l'intention pour permettre au parent de revenir plus tard.
            if (captureTrocActive) {
              const next = new URLSearchParams(searchParams);
              next.delete('capture-troc');
              setSearchParams(next, { replace: true });
            }
            setShowPhotoCapture(null);
          }}
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
  onCancelTrocIntent: () => void;
  isTrocMatched: boolean;
  isTrocPending: boolean;
}> = ({ item, onChoix, onTroc, onRemove, onCancelTrocIntent, isTrocMatched, isTrocPending }) => {
  const { t } = useTranslation();
  const isOccasionable = item.type === 'livre' || item.type === 'workbook' as any;

  return (
    <li className={`bg-white rounded-2xl p-3 shadow-sm ${isTrocPending ? 'ring-1 ring-amber-300' : ''}`}>
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
          {/* Badge "Photo à faire" — visible si l'utilisateur a choisi un
              échange mais n'a pas encore fait la photo recto/verso. */}
          {isTrocPending && (
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                <Camera className="w-3 h-3" /> {t('bourse.rentree.troc_pending_badge')}
              </span>
              <button
                onClick={onTroc}
                className="text-[11px] font-bold text-amber-700 active:text-amber-900 underline-offset-2 underline"
              >
                {t('bourse.rentree.troc_pending_action_photo')}
              </button>
              <span className="text-gray-300">·</span>
              <button
                onClick={onCancelTrocIntent}
                className="text-[11px] text-gray-500 active:text-gray-700"
              >
                {t('bourse.rentree.troc_pending_action_cancel')}
              </button>
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

      {/* Choix principal : Neuf vs Occasion (2 boutons larges).
          Quand Occasion est sélectionné, on déroule inline la sous-question
          "voulez-vous troquer ou simplement acheter d'occasion ?" — c'est
          plus clair que 3 pills cote à cote où l'utilisateur ne voit pas
          le lien entre Occasion et Troc. */}
      {isOccasionable && (
        <>
          <div className="mt-2 flex items-center gap-1.5">
            <ChoixPill active={item.choix === 'neuf'} onClick={() => onChoix('neuf')}>
              {t('bourse.rentree.decision_neuf')}
            </ChoixPill>
            <ChoixPill active={item.choix === 'occasion'} onClick={() => onChoix('occasion')}>
              {t('bourse.rentree.decision_occasion')}
            </ChoixPill>
          </div>

          {item.choix === 'occasion' && (
            <div className="mt-2 ml-1 pl-2.5 border-l-2 border-amber-200 space-y-1.5">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {t('bourse.rentree.occasion_sub_question')}
              </div>
              {/* Sous-option 1 : sans troc */}
              <button
                onClick={() => { /* déjà en occasion sans troc */ }}
                className={`w-full text-left p-2.5 rounded-lg border min-h-[48px] ${
                  !isTrocMatched
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  {!isTrocMatched && <Check className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                  <div className="flex-1">
                    <div className="text-xs font-bold">{t('bourse.rentree.occasion_buy_only_title')}</div>
                    <div className="text-[11px] text-gray-500 leading-tight">
                      {t('bourse.rentree.occasion_buy_only_desc')}
                    </div>
                  </div>
                </div>
              </button>

              {/* Sous-option 2 : troc avec crédit */}
              <button
                onClick={onTroc}
                className={`w-full text-left p-2.5 rounded-lg border min-h-[48px] ${
                  isTrocMatched
                    ? 'bg-green-50 border-green-400 text-green-900'
                    : 'bg-white border-green-200 text-green-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isTrocMatched ? (
                    <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  ) : (
                    <Repeat className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="text-xs font-bold">
                      {isTrocMatched
                        ? t('bourse.rentree.occasion_troc_done_title')
                        : t('bourse.rentree.occasion_troc_title')}
                    </div>
                    <div className="text-[11px] text-gray-500 leading-tight">
                      {t('bourse.rentree.occasion_troc_desc')}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
        </>
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
// Aligné sur AddEnfantForm de ParentSelectionPage : Pays → Système → Niveau →
// Classe → Série/Filière. Multi-pays + multi-systèmes.
const ClassFormModal: React.FC<{
  onClose: () => void;
  onSave: (e: Omit<Enfant, 'id'>) => void;
}> = ({ onClose, onSave }) => {
  const { t } = useTranslation();

  const [pays, setPays] = useState<PaysCode>(PAYS_PAR_DEFAUT as PaysCode);
  const systemes = useMemo(() => getSystemesForPays(pays), [pays]);
  const [systemeId, setSystemeId] = useState(systemes[0]?.id ?? `${PAYS_PAR_DEFAUT}-fr`);
  const systemeObj = systemes.find(s => s.id === systemeId) ?? systemes[0];
  const [niveauNom, setNiveauNom] = useState('');
  const niveauObj = systemeObj?.niveaux.find(n => n.nom === niveauNom);
  const [classeNom, setClasseNom] = useState('');
  const classeObj = niveauObj?.classes.find(c => c.nom === classeNom);
  const [serieCode, setSerieCode] = useState('');
  const hasSeries = (classeObj?.series?.length ?? 0) > 0;
  const canSave = !!classeNom && (!hasSeries || !!serieCode);
  const finalClasse = serieCode ? `${classeNom} ${serieCode}` : classeNom;
  const systeme: Systeme = systemeObj?.langue === 'en' ? 'anglophone' : 'francophone';

  const handlePaysChange = (p: PaysCode) => {
    setPays(p);
    const newSystemes = getSystemesForPays(p);
    setSystemeId(newSystemes[0]?.id ?? '');
    setNiveauNom('');
    setClasseNom('');
    setSerieCode('');
  };

  const handleSystemeChange = (id: string) => {
    setSystemeId(id);
    setNiveauNom('');
    setClasseNom('');
    setSerieCode('');
  };

  const handleSave = () => {
    if (!canSave || !systemeObj) return;
    onSave({
      systeme,
      niveau: niveauNom,
      classe: finalClasse,
      pays,
      systemeId,
      serie: serieCode || undefined,
    });
  };

  return (
    <ModalShell onClose={onClose} title={t('bourse.rentree.class_form_title')} fullScreen>
      <div className="space-y-4">
        {/* Pays */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            {t('bourse.rentree.class_form_country')}
          </label>
          <select
            value={pays}
            onChange={(e) => handlePaysChange(e.target.value as PaysCode)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white min-h-[44px]"
          >
            {LISTE_PAYS_UNIQUES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.emoji} {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Système (si plusieurs pour le pays choisi) */}
        {systemes.length > 1 && (
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              {t('bourse.rentree.class_form_system')}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {systemes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSystemeChange(s.id)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border min-h-[44px] ${
                    systemeId === s.id
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {s.systemeLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Niveau */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
            {t('bourse.rentree.class_form_level')}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(systemeObj?.niveaux ?? []).map((n) => (
              <button
                key={n.nom}
                onClick={() => { setNiveauNom(n.nom); setClasseNom(''); setSerieCode(''); }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border min-h-[40px] ${
                  niveauNom === n.nom
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {n.nom}
              </button>
            ))}
          </div>
        </div>

        {/* Classe */}
        {niveauObj && (
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              {t('bourse.rentree.class_form_class')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {niveauObj.classes.map((c) => (
                <button
                  key={c.nom}
                  onClick={() => { setClasseNom(c.nom); setSerieCode(''); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border min-h-[40px] ${
                    classeNom === c.nom
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {c.nom}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Série / Filière (si applicable) */}
        {classeObj && hasSeries && (
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Série / Filière
            </label>
            <div className="flex flex-wrap gap-1.5">
              {classeObj.series!.map((s) => (
                <button
                  key={s.code}
                  onClick={() => setSerieCode(s.code)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-baseline gap-1 min-h-[40px] ${
                    serieCode === s.code
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  <span className="font-bold">{s.code}</span>
                  {s.label && (
                    <span className={`text-[10px] ${serieCode === s.code ? 'text-white/80' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-6 sticky bottom-0 bg-white pt-3 -mx-4 px-4 pb-2 border-t border-gray-100">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl min-h-[48px]"
        >
          {t('bourse.rentree.class_form_cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
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
  onLater: () => void;
  onContinue: () => void;
  loading: boolean;
}> = ({ onLater, onContinue, loading }) => {
  const { t } = useTranslation();
  return (
    <ModalShell onClose={onLater} title={t('bourse.rentree.troc_explainer_title')}>
      <ul className="space-y-3 text-sm text-gray-700">
        <li>{t('bourse.rentree.troc_explainer_step1')}</li>
        <li>{t('bourse.rentree.troc_explainer_step2')}</li>
        <li>{t('bourse.rentree.troc_explainer_step3')}</li>
        <li>{t('bourse.rentree.troc_explainer_step4')}</li>
      </ul>
      <p className="text-xs text-gray-500 mt-3 leading-snug">
        {t('bourse.rentree.troc_explainer_later_hint')}
      </p>
      <div className="mt-4 space-y-2">
        <button
          onClick={onContinue}
          disabled={loading}
          className="w-full bg-green-600 text-white font-bold py-3 rounded-xl active:bg-green-700 disabled:bg-gray-300 min-h-[48px] inline-flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {t('bourse.rentree.troc_explainer_cta')}
        </button>
        <button
          onClick={onLater}
          className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl active:bg-gray-200 min-h-[48px]"
        >
          {t('bourse.rentree.troc_explainer_later')}
        </button>
      </div>
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
