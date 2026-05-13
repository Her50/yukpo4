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
import GpsGate from '../../components/livres-scolaires/GpsGate';

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

  // ─── Groupement par type (livres → cahiers → fournitures → autres) ───
  // Cohérent avec ScanProgrammePage et RecapAchatPage.
  const groupedItems = useMemo(() => {
    const norm = (raw: any): 'livre' | 'cahier' | 'fourniture' | 'autre' => {
      const r = String(raw ?? '').toLowerCase();
      if (['livre', 'workbook', 'livret', 'manuel', 'textbook', 'book'].includes(r)) return 'livre';
      if (r === 'cahier') return 'cahier';
      if (['fourniture', 'accessoire', 'supply'].includes(r)) return 'fourniture';
      return 'autre';
    };
    const order: Array<'livre' | 'cahier' | 'fourniture' | 'autre'> = ['livre', 'cahier', 'fourniture', 'autre'];
    return order
      .map(typ => ({
        type: typ,
        items: itemsForActive
          .filter(it => norm(it.type) === typ)
          .sort((a, b) => (a.titre || '').localeCompare(b.titre || '', undefined, { sensitivity: 'base' })),
      }))
      .filter(g => g.items.length > 0);
  }, [itemsForActive]);

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
  // Confirmation après analyse troc — on ne laisse PAS continuer la boucle
  // capture-troc tant que le parent n'a pas cliqué OK (lecture du crédit
  // estimé). Persistant jusqu'au tap utilisateur.
  const [creditConfirmation, setCreditConfirmation] = useState<{
    titre: string;
    credit: number;
  } | null>(null);

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

  // Y a-t-il au moins un livre en troc en attente (toutes classes confondues) ?
  // On l'utilise pour pré-créer la session backend en arrière-plan dès que la
  // page est chargée, afin que le clic "Photographier" soit instantané.
  const hasAnyPendingTroc = useMemo(
    () => panier.some(p => p.choix === 'occasion' && p.troc_intent && !p.trocLivreId),
    [panier],
  );
  const captureTrocActive = searchParams.get('capture-troc') === '1';
  useEffect(() => {
    if (!captureTrocActive) return;
    // Tant que la modale de confirmation du crédit est affichée, on ne
    // déclenche PAS le livre suivant : on attend l'OK utilisateur.
    if (creditConfirmation) return;
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
  }, [captureTrocActive, pendingTrocItem, activeId, showPhotoCapture, showTrocExplainer, searchParams, setSearchParams, creditConfirmation]);

  // ─── Session troc (pré-créée en arrière-plan dès qu'on a un troc pending) ───
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const sessionInitRef = useRef(false);
  const sessionPrefetchRef = useRef(false);

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
   *  le prompt navigateur sur la plupart des plateformes. Timeout court
   *  (3s) — si pas de GPS, on continue sans (backend accepte). */
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
        { timeout: 3000, maximumAge: 60000 },
      );
    });
  }, [gps]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (sessionCreating || sessionInitRef.current) return null;
    // ✅ Feedback IMMÉDIAT : on flip sessionCreating tout de suite (spinner
    // sur le bouton "Photographier") avant la lecture GPS, sinon le clic
    // semble figé jusqu'à 8s si l'utilisateur n'a pas encore accordé la
    // géoloc. GPS désormais OPTIONNEL côté backend.
    sessionInitRef.current = true;
    setSessionCreating(true);
    let coords = gps;
    if (!coords) coords = await requestGpsNow();
    try {
      const payload: Record<string, any> = {
        mode_listing_defaut: 'troc',
        gps_recuperation: coords ? `${coords.lat},${coords.lon}` : '',
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
      toast({ title: t('bourse.rentree.toast_session_error'), description: e?.message || t('bourse.rentree.toast_session_retry'), variant: 'destructive' });
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
    toast({ title: t('bourse.rentree.toast_articles_added', { count: toAdd.length }) });
    setSelectedSugg({});
    setShowSuggestions(false);
  };

  const startTroc = (item: PanierItem) => {
    if (item.choix !== 'occasion') updateChoix(item.id, 'occasion');
    setShowTrocExplainer({ itemId: item.id });
  };

  /** Retire un livre du troc/vente côté backend. Rollback du crédit
   *  éventuellement avancé (status 'matched'). Confirmation utilisateur
   *  obligatoire car opération irréversible. */
  const withdrawTroc = useCallback(async (item: PanierItem) => {
    if (!item.trocLivreId) return;
    const ok = window.confirm(t('bourse.rentree.withdraw_confirm'));
    if (!ok) return;
    try {
      const res = await apiPost(
        `/api/troc-livres/${item.trocLivreId}/withdraw`,
        {},
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      // Côté panier : on délie le trocLivreId (le livre n'existe plus
      // côté backend) et on réinitialise le choix sur 'neuf' pour éviter
      // que l'utilisateur reste avec un item orphelin.
      updateTrocMatch(item.id, undefined);
      clearTrocIntent(item.id);
      updateChoix(item.id, 'neuf');
      toast({
        title: t('bourse.retraitLivre.toast_removed_title'),
        description: data?.message || t('bourse.retraitLivre.toast_removed_desc'),
      });
    } catch (e: any) {
      toast({
        title: t('bourse.retraitLivre.toast_failed_title'),
        description: e?.message || t('bourse.retraitLivre.toast_failed_desc'),
        variant: 'destructive',
      });
    }
  }, [t, toast, updateTrocMatch, clearTrocIntent, updateChoix]);

  // ✅ 2026-05-11 : avant de créer la session troc, on EXIGE la position
  // GPS via GpsGate (écran d'instructions clair). Si déjà en cache (1h),
  // saute le gate et continue.
  const [showGpsGate, setShowGpsGate] = useState(false);
  const continueToCapture = async () => {
    if (!showTrocExplainer) return;
    if (!gps) {
      // Pas de GPS → on affiche le gate. Quand granted, useEffect ci-dessous
      // relance la suite du flow.
      setShowGpsGate(true);
      return;
    }
    const sid = await ensureSession();
    if (!sid) return;
    const itemId = showTrocExplainer.itemId;
    setShowTrocExplainer(null);
    setShowPhotoCapture({ itemId });
  };

  // Une fois le GPS accordé après gate, on relance continueToCapture
  // automatiquement si l'utilisateur était en train de demander une photo.
  useEffect(() => {
    if (gps && !showGpsGate) return; // état stable, rien à faire
    if (gps && showGpsGate && showTrocExplainer) {
      // gate vient de fermer, on enchaîne
      setShowGpsGate(false);
      (async () => {
        const sid = await ensureSession();
        if (!sid) return;
        const itemId = showTrocExplainer.itemId;
        setShowTrocExplainer(null);
        setShowPhotoCapture({ itemId });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps]);

  // ✅ Pré-création de la session backend en arrière-plan, dès qu'on détecte
  // au moins un livre en troc en attente. Évite l'attente de 1-3s au clic
  // "J'ai compris, photographier mon livre".
  useEffect(() => {
    if (sessionId || sessionCreating || sessionPrefetchRef.current) return;
    if (!hasAnyPendingTroc) return;
    sessionPrefetchRef.current = true;
    // Petite tempo pour laisser l'écran se peindre d'abord
    const t = setTimeout(() => {
      ensureSession();
    }, 300);
    return () => clearTimeout(t);
  }, [hasAnyPendingTroc, sessionId, sessionCreating, ensureSession]);

  const onPhotoAnalyzed = (itemId: string, result: AnalyzedBookResult) => {
    if (result.is_rejected || result.valeur_calculee <= 0) {
      // Livre rejeté : on lève l'intention de troc pour éviter une boucle
      // sur ce même item lors d'un éventuel ?capture-troc=1. On utilise
      // en priorité le message précis renvoyé par le backend (rejection_message)
      // pour distinguer les motifs : pas au programme / Maternelle/Primaire / consommable / dégradé / valeur 0.
      clearTrocIntent(itemId);
      // Mapping rejection_code → titre traduit. Si code inconnu, fallback
      // sur le titre générique. La traduction est synchronisée avec le backend
      // (cf. bourse_livre_v2_controller.rs:rejection_code).
      const knownCodes = [
        'not_in_program', 'niveau_primaire', 'non_reusable_workbook',
        'price_missing', 'isbn_missing', 'duplicate_book', 'value_zero',
        'etat_too_damaged', 'recto_verso_same_side',
        'no_cover_detected', 'invalid_recto_cover', 'invalid_verso_cover',
      ];
      const title = knownCodes.includes(result.rejection_code || '')
        ? t(`bourse.rejectionCodes.${result.rejection_code}`)
        : t('bourse.rentree.toast_rejected_title');
      const desc = result.rejection_message
        ? result.rejection_message
        : t('bourse.rentree.toast_rejected_desc');
      toast({
        title,
        description: desc,
        variant: 'destructive',
      });
      setShowPhotoCapture(null);
      return;
    }
    updateTrocMatch(itemId, result.livre_id);
    setShowPhotoCapture(null);
    const credit = Math.round(result.credit_net_xaf ?? Math.max(0, result.valeur_calculee * 0.75 - 40));
    // Modale de confirmation persistante : l'utilisateur doit cliquer OK
    // pour valider la lecture du crédit avant que la boucle capture-troc
    // n'enchaîne sur le livre suivant.
    setCreditConfirmation({
      titre: result.titre || 'Livre',
      credit,
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

            {/* Groupes : livres → cahiers → fournitures → autres.
                Affichage table-style compact (cohérent avec ScanProgrammePage). */}
            {groupedItems.map(({ type, items }) => (
              <div key={type} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      type === 'livre' ? 'bg-blue-500'
                        : type === 'cahier' ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`} />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-700">
                      {type === 'livre' ? t('bourse.rentree.section_books')
                        : type === 'cahier' ? t('bourse.rentree.section_notebooks')
                        : type === 'fourniture' ? t('bourse.rentree.section_supplies')
                        : t('bourse.rentree.section_other')}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-semibold">
                    {t(items.length > 1 ? 'bourse.rentree.item_count_other' : 'bourse.rentree.item_count_one', { count: items.length })}
                  </span>
                </div>
                <ul>
                  {items.map(it => (
                    <ItemCard
                      key={it.id}
                      item={it}
                      onChoix={(c) => updateChoix(it.id, c)}
                      onTroc={() => startTroc(it)}
                      onRemove={() => removeItem(it.id)}
                      onCancelTrocIntent={() => clearTrocIntent(it.id)}
                      onWithdraw={it.trocLivreId ? () => withdrawTroc(it) : undefined}
                      isTrocMatched={!!it.trocLivreId}
                      isTrocPending={!!it.troc_intent && !it.trocLivreId}
                    />
                  ))}
                </ul>
              </div>
            ))}
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

        {/* Lien dashboard "Mes trocs en cours" — visible si le parent a déjà
            au moins un livre déposé en troc (intent ou matched). Permet de
            suivre l'évolution sans repartir d'un parcours commande. */}
        {pendingTrocCount > 0 && (
          <section className="mt-4">
            <button
              onClick={() => navigate('/trocs/mes-trocs')}
              className="w-full bg-cyan-50 border border-cyan-300 rounded-2xl p-3.5 text-left active:bg-cyan-100 min-h-[64px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Repeat className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-cyan-900">{t('bourse.rentree.dashboard_trocs_title')}</div>
                  <div className="text-xs text-cyan-800 mt-0.5">{t('bourse.rentree.dashboard_trocs_desc')}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-700 mt-2 flex-shrink-0" />
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

      {/* ─── Bottom action — au-dessus du BourseNav (z-40 vs z-50 pour la
            barre nav). On laisse en bas une mini-bar persistante avec total
            + bouton 'Voir le récap' pour qu'elle reste visible quand l'écran
            est rempli. */}
      {active && itemsForActive.length > 0 && (
        <div className="fixed left-0 right-0 bg-white border-t border-amber-200 px-3 py-2 shadow-2xl z-40"
             style={{ bottom: '56px' /* hauteur de BourseNav */ }}>
          <div className="max-w-md mx-auto flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                {t('bourse.rentree.total_label')}
              </div>
              <div className="font-bold text-sm text-gray-900 tabular-nums">
                {totalPrevisionnel > 0
                  ? `${totalPrevisionnel.toLocaleString('fr-FR')} XAF`
                  : '—'}
              </div>
            </div>
            <button
              onClick={goRecap}
              className="bg-amber-500 text-white font-bold px-4 py-2 rounded-lg active:bg-amber-600 min-h-[40px] text-xs inline-flex items-center gap-1"
            >
              {t('bourse.rentree.go_recap')} <ChevronRight className="w-3.5 h-3.5" />
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
      {/* GpsGate — bloque l'écran jusqu'à obtention GPS avant capture troc */}
      {showGpsGate && (
        <div className="fixed inset-0 z-[60]">
          <GpsGate
            title="Où venir chercher votre livre ?"
            reason="Indiquez le point où le coursier passera récupérer votre livre une fois l'échange validé. Vous pouvez utiliser votre position actuelle ou choisir un lieu précis sur la carte."
            onGranted={(coords) => {
              setGps(coords);
              // setShowGpsGate(false) sera fait par l'effect qui voit gps
              // changer et enchaîne ensureSession + showPhotoCapture.
            }}
            onCancel={() => {
              setShowGpsGate(false);
              setShowTrocExplainer(null);
            }}
          />
        </div>
      )}

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

      {/* Confirmation crédit après analyse — persistante jusqu'à OK. */}
      {creditConfirmation && (
        <CreditConfirmationModal
          titre={creditConfirmation.titre}
          credit={creditConfirmation.credit}
          onOk={() => setCreditConfirmation(null)}
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
  onWithdraw?: () => void;
  isTrocMatched: boolean;
  isTrocPending: boolean;
}> = ({ item, onChoix, onTroc, onRemove, onCancelTrocIntent, onWithdraw, isTrocMatched, isTrocPending }) => {
  const { t } = useTranslation();
  const isOccasionable = item.type === 'livre' || item.type === 'workbook' as any;

  return (
    <li className={`px-2 py-1.5 border-b border-gray-100 last:border-b-0 ${isTrocPending ? 'bg-amber-50/50' : 'bg-white'}`}>
      {/* Ligne 1 : titre + prix + supprimer */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px] text-gray-900 leading-tight truncate" title={item.titre}>
            {item.titre}
          </p>
          {item.matiere && item.matiere.toLowerCase() !== 'fournitures' && (
            <p className="text-[10px] text-gray-500 leading-tight truncate">{item.matiere}</p>
          )}
        </div>
        <span
          className={`text-right text-[11px] font-bold tabular-nums shrink-0 min-w-[46px] ${
            item.prixNeuf && item.prixNeuf > 0 ? 'text-amber-700' : 'text-gray-300'
          }`}
          title={item.prixNeuf && item.prixNeuf > 0 ? undefined : t('bourse.rentree.price_unavailable')}
        >
          {item.prixNeuf && item.prixNeuf > 0
            ? `${item.prixNeuf.toLocaleString('fr-FR')} F`
            : '—'}
        </span>
        <button
          onClick={onRemove}
          className="w-7 h-7 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-400 active:text-red-500 shrink-0"
          aria-label="Retirer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ligne 2 : badge "Photo à faire" — si troc en attente */}
      {isTrocPending && (
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
            <Camera className="w-2.5 h-2.5" /> {t('bourse.rentree.troc_pending_badge')}
          </span>
          <button
            onClick={onTroc}
            className="text-[10px] font-bold text-amber-700 active:text-amber-900 underline"
          >
            {t('bourse.rentree.troc_pending_action_photo')}
          </button>
          <span className="text-gray-300 text-[10px]">·</span>
          <button
            onClick={onCancelTrocIntent}
            className="text-[10px] text-gray-500 active:text-gray-700"
          >
            {t('bourse.rentree.troc_pending_action_cancel')}
          </button>
        </div>
      )}

      {/* Choix principal : Neuf vs Occasion (2 boutons larges).
          Quand Occasion est sélectionné, on déroule inline la sous-question
          "voulez-vous troquer ou simplement acheter d'occasion ?" — c'est
          plus clair que 3 pills cote à cote où l'utilisateur ne voit pas
          le lien entre Occasion et Troc. */}
      {isOccasionable && (
        <>
          <div className="mt-1 flex items-center gap-1">
            <ChoixPill active={item.choix === 'neuf'} onClick={() => onChoix('neuf')}>
              {t('bourse.rentree.decision_neuf')}
            </ChoixPill>
            <ChoixPill active={item.choix === 'occasion'} onClick={() => onChoix('occasion')}>
              {t('bourse.rentree.decision_occasion')}
            </ChoixPill>
          </div>

          {item.choix === 'occasion' && (
            <div className="mt-1.5 ml-0.5 pl-2 border-l-2 border-amber-200 space-y-1">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
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

              {/* ✅ Bouton retrait — visible UNIQUEMENT si le livre a été
                  photographié (trocLivreId connu côté backend). Permet
                  d'annuler le troc et de rollback le crédit éventuel. */}
              {isTrocMatched && onWithdraw && (
                <button
                  onClick={onWithdraw}
                  className="w-full text-left text-[11px] text-red-600 active:text-red-800 underline underline-offset-2 px-1 py-1"
                >
                  {t('bourse.rentree.withdraw_book_action')}
                </button>
              )}
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
    className={`flex-1 text-[11px] font-bold px-2 py-1 rounded min-h-[28px] transition-colors ${
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
  const { t } = useTranslation();
  return (
    <ModalShell onClose={onCancel} title={t('bourse.rentree.photo_modal_title')} fullScreen>
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

// ─── Modal de confirmation crédit (persistante) ───
// Affichée après chaque livre photographié avec succès. Reste à l'écran tant
// que l'utilisateur n'a pas cliqué OK — permet de lire tranquillement le
// montant du crédit et son utilisation, sans subir un toast qui disparaît.
const CreditConfirmationModal: React.FC<{
  titre: string;
  credit: number;
  onOk: () => void;
}> = ({ titre, credit, onOk }) => {
  const { t } = useTranslation();
  return (
    <ModalShell onClose={onOk} title={t('bourse.rentree.credit_modal_title')}>
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              {t('bourse.rentree.credit_modal_book_accepted')}
            </span>
          </div>
          <p className="text-sm text-gray-800 line-clamp-2">{titre}</p>
        </div>

        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-center">
          <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
            {t('bourse.rentree.credit_modal_credit_label')}
          </p>
          <p className="text-2xl font-bold text-amber-900 mt-1">
            {credit.toLocaleString('fr-FR')} <span className="text-base">XAF</span>
          </p>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          {t('bourse.rentree.credit_modal_explanation')}
        </p>
      </div>

      <button
        onClick={onOk}
        className="mt-5 w-full bg-amber-500 text-white font-bold py-3 rounded-xl active:bg-amber-600 min-h-[48px] inline-flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        {t('bourse.rentree.credit_modal_ok')}
      </button>
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
