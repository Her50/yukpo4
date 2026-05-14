import {
  AlertTriangle, ArrowLeft, BookOpen, Camera, Check, ChevronRight, Gift, Loader2,
  MapPin, Plus, Repeat, ShoppingBag, Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BookPhotoCapture, { AnalyzedBookResult } from '../../components/livres-scolaires/BookPhotoCapture';
import GpsGate from '../../components/livres-scolaires/GpsGate';
import { apiGet, apiPost } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';

/**
 * Page dédiée à la mise en vente / troc / don d'un livre d'occasion.
 *
 * Workflow ALIGNÉ sur le mobile (BookUploadV2Screen.tsx) :
 *   1. GPS obligatoire
 *   2. Sélecteur du mode listing (troc/vente/don) — par défaut 'vente'
 *   3. Création session via POST /api/bourse-livre/v2/sessions
 *   4. Pour chaque livre : photo recto + verso → analyse IA → ajout à la liste
 *   5. Finalize via POST /sessions/:id/finalize
 *
 * Différence majeure avec LivreScolaireFormPage : ICI le scan est OBLIGATOIRE.
 * Pas de saisie manuelle de champs — l'IA détecte titre, état, valeur, etc.
 */

type ModeListing = 'troc' | 'vente' | 'don';

const MODE_INFO: Record<ModeListing, { label: string; desc: string; color: string; bg: string; border: string; }> = {
  troc:  {
    label: 'Échanger',
    desc: "Vous échangez votre livre de l'an dernier contre le livre de la classe suivante d'un autre parent (crédit Yukpo immédiat).",
    color: 'text-amber-900',   bg: 'bg-amber-50',   border: 'border-amber-400',
  },
  vente: {
    label: 'Vendre',
    desc: "Vous mettez en vente un livre d'occasion déjà utilisé (cash dès qu'un acheteur le prend).",
    color: 'text-orange-900',  bg: 'bg-orange-50',  border: 'border-orange-400',
  },
  don:   {
    label: 'Donner',
    desc: "Vous offrez le livre à la communauté Bourse Yukpo (geste solidaire, sans contrepartie financière).",
    color: 'text-emerald-900', bg: 'bg-emerald-50', border: 'border-emerald-400',
  },
};

interface AddedBook extends AnalyzedBookResult {
  /** ID local pour permettre la suppression avant finalize. */
  localId: string;
  /** Mode listing choisi pour ce livre spécifique. */
  mode: ModeListing;
}

const VendreLivresPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Défaut = 'troc' : c'est le mode de loin le plus utilisé (échange livre
  // contre celui de la classe suivante + crédit). 'vente' et 'don' restent
  // accessibles via le sélecteur ou la query ?mode=vente|don.
  const initialMode: ModeListing = (() => {
    const m = searchParams.get('mode');
    return m === 'vente' || m === 'don' ? m : 'troc';
  })();

  const [sessionMode, setSessionMode] = useState<ModeListing>(initialMode);
  const [eligibilityOpen, setEligibilityOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [sessionError, setSessionError] = useState<string>('');
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsAsked, setGpsAsked] = useState(false);
  const sessionInitRef = useRef(false);

  const [books, setBooks] = useState<AddedBook[]>([]);
  const [showCapture, setShowCapture] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  /** ✅ 2026-05-14 : Quand un livre est rejeté, modale fallback avec :
   *  - Checkbox Don (cumulable) — propose au parent d'offrir le livre à la
   *    communauté, geste solidaire.
   *  - Radio Achat classe supérieure : Neuf / Occasion / Aucun.
   *    Occasion conditionnel : masqué si rejet primaire (et classe sup non-secondaire)
   *    ou si rejet workbook (consommables non réutilisables).
   *  - Bouton Valider exécute Don puis navigue vers /programme-ecole si achat choisi. */
  const [rejectionFallback, setRejectionFallback] = useState<AnalyzedBookResult | null>(null);
  const [donChoice, setDonChoice] = useState<boolean>(true);
  const [buyChoice, setBuyChoice] = useState<'aucun' | 'neuf' | 'occasion'>('aucun');
  const [rejectionProcessing, setRejectionProcessing] = useState<boolean>(false);

  // 1. Capture GPS via GpsGate avant tout — la modale d'instructions
  // s'affiche tant que la position n'a pas été accordée. Si l'utilisateur
  // l'a déjà accordée récemment (cache localStorage 1h), on continue.
  // Le composant appelle onGranted(coords) une fois prête.

  // 2. Création session (auto après tentative GPS).
  // ✅ 2026-05-11 : fix boucle infinie + parsing session_id raté.
  //   • Le backend renvoie { success, session: { id, ... } } — on extrait
  //     id depuis data.session.id en priorité (plus data.session_id/id en
  //     fallback pour rétro-compat).
  //   • GPS désormais OPTIONNEL côté backend → on ne bloque plus si refusé.
  //   • Le useEffect d'auto-création ne dépend PAS de ensureSession (qui
  //     change ref à chaque flip de sessionCreating), seulement de
  //     [gpsAsked, sessionId, sessionError]. Plus de retry infini ; en cas
  //     d'erreur, l'utilisateur peut cliquer manuellement "Réessayer".
  const ensureSession = useCallback(async () => {
    if (sessionId || sessionCreating || sessionInitRef.current) return sessionId;
    sessionInitRef.current = true;
    setSessionCreating(true);
    setSessionError('');
    try {
      const payload: Record<string, any> = { mode_listing_defaut: sessionMode };
      if (gps) payload.gps_recuperation = `${gps.lat},${gps.lon}`;
      const res = await apiPost('/api/bourse-livre/v2/sessions', payload);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      const newId =
        data?.session?.id
        || data?.session_id
        || data?.id
        || data?.data?.session?.id
        || data?.data?.session_id
        || data?.data?.id;
      if (!newId) throw new Error('session_id absent de la réponse');
      setSessionId(newId);
      return newId;
    } catch (e: any) {
      setSessionError(e?.message || 'Impossible de créer la session');
      sessionInitRef.current = false;
      return null;
    } finally {
      setSessionCreating(false);
    }
  }, [gps, sessionId, sessionCreating, sessionMode]);

  // ⚠️ Volontairement PAS de dépendance sur ensureSession (boucle infinie).
  // On déclenche UNE fois quand GPS a été tenté ; en cas d'erreur, le
  // bouton "Réessayer" relance manuellement.
  useEffect(() => {
    if (gpsAsked && !sessionId && !sessionCreating && !sessionError) {
      ensureSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsAsked, sessionId, sessionError]);

  // ✅ 2026-05-12 : RESTAURATION AU MONTAGE.
  // Si l'utilisateur a déjà une session 'en_cours' (a fermé la page, navigué
  // ailleurs, ou refresh) — on récupère ses livres déjà scannés au lieu de
  // tout recommencer. L'utilisateur reprend là où il s'était arrêté.
  const restoreRef = useRef(false);
  useEffect(() => {
    if (restoreRef.current) return;
    restoreRef.current = true;
    (async () => {
      try {
        const res = await apiGet('/api/bourse-livre/v2/sessions/active');
        const data = await res.json().catch(() => ({}));
        if (data?.success && data?.has_active && data?.session?.id) {
          setSessionId(data.session.id);
          sessionInitRef.current = true; // évite ensureSession de créer un doublon
          const livres = (data.livres || []) as Array<{
            id: number;
            titre: string;
            auteur?: string;
            matiere?: string;
            classe_actuelle?: string;
            classe_souhaitee?: string;
            niveau?: string;
            prix_detecte?: string | number;
            valeur_calculee?: string | number;
            etat_classification: string;
            mode_listing?: string;
          }>;
          const restored: AddedBook[] = livres
            .filter((l) => l.etat_classification !== 'rejete')
            .map((l) => ({
              localId: `restored-${l.id}`,
              livre_id: l.id,
              titre: l.titre,
              auteur: l.auteur,
              matiere: l.matiere,
              classe_actuelle: l.classe_actuelle,
              classe_souhaitee: l.classe_souhaitee,
              niveau: l.niveau,
              prix_detecte: Number(l.prix_detecte ?? 0) || undefined,
              valeur_calculee: Number(l.valeur_calculee ?? 0),
              credit_net_xaf: Math.max(0, Number(l.valeur_calculee ?? 0) * 0.75 - 40),
              ratio_etat:
                l.etat_classification === 'bon'
                  ? 0.7
                  : l.etat_classification === 'acceptable'
                  ? 0.45
                  : 0,
              etat_classification: l.etat_classification as 'bon' | 'acceptable' | 'rejete',
              is_rejected: false,
              mode: (l.mode_listing as ModeListing) || sessionMode,
            }));
          if (restored.length > 0) {
            setBooks(restored);
            toast({
              title: t('bourse.vendre.toast_session_reprise_title', { count: restored.length }),
              description: t('bourse.vendre.toast_session_reprise_desc'),
            });
          }
        }
      } catch {
        // Échec silencieux : on continue avec une session vierge
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnalyzed = (result: AnalyzedBookResult) => {
    if (result.is_rejected) {
      // ✅ Codes de rejet liés à un problème de SCAN — pas un défaut du livre.
      // L'utilisateur doit juste reprendre la photo, pas se voir proposer
      // des fallbacks. On affiche un toast et on garde la modale capture ouverte.
      const SCAN_REJECTIONS = new Set([
        'recto_verso_same_side', 'recto_verso_swapped', 'no_cover_detected',
        'invalid_recto_cover', 'invalid_verso_cover', 'price_missing', 'isbn_missing',
      ]);
      if (SCAN_REJECTIONS.has(result.rejection_code ?? '')) {
        toast({
          title: t('bourse.vendre.toast_rejected_title'),
          description: result.rejection_message || t('bourse.vendre.toast_rejected_desc'),
          variant: 'destructive',
        });
        return; // user reprend la photo, BookPhotoCapture gère l'affichage
      }

      // ✅ Fallback multi-options pour les rejets liés au livre lui-même
      // (mauvais état, primaire, hors programme, workbook, duplicate, etc.) :
      // modale avec checkbox Don + radio (Neuf/Occasion/Aucun) de la classe
      // supérieure. Don cumulable avec un achat. Règles conditionnelles :
      //   - Si rejet primaire : Occasion masqué SAUF si classe_sup = 1er
      //     niveau secondaire (6ème/Form 1).
      //   - Si rejet workbook : Occasion masqué (consommables non réutilisables).
      setRejectionFallback(result);
      setDonChoice(true); // par défaut on propose le don
      setBuyChoice('aucun');
      return;
    }
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setBooks(prev => [...prev, { ...result, localId, mode: sessionMode }]);
    setShowCapture(false);
    toast({
      title: t('bourse.vendre.toast_added_title'),
      description: t('bourse.vendre.toast_added_desc', {
        titre: result.titre,
        credit: Math.round(result.credit_net_xaf ?? Math.max(0, result.valeur_calculee * 0.75 - 40)).toLocaleString('fr-FR'),
      }),
    });
  };

  const removeBook = (localId: string) => {
    setBooks(prev => prev.filter(b => b.localId !== localId));
  };

  const updateBookMode = (localId: string, mode: ModeListing) => {
    setBooks(prev => prev.map(b => b.localId === localId ? { ...b, mode } : b));
  };

  const finalize = async () => {
    if (!sessionId || books.length === 0) {
      toast({ title: t('bourse.vendre.toast_no_book_title'), variant: 'destructive' });
      return;
    }
    setFinalizing(true);
    try {
      const livres_modes = books
        .filter(b => b.livre_id && !b.is_rejected)
        .map(b => ({ livre_id: b.livre_id, mode_listing: b.mode }));

      // Tente d'abord la route mobile principale, fallback sur l'autre.
      let res = await apiPost(
        `/api/bourse-livre/v2/sessions/${sessionId}/finalize`,
        { livres_modes }
      );
      let data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        res = await apiPost(
          `/api/bourse-livre/v2/programmes-scolaires/sessions/${sessionId}/finalize`,
          { livres_modes }
        );
        data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || data?.message || 'Finalisation échouée');
        }
      }
      toast({
        title: t('bourse.vendre.toast_published_title'),
        description: t('bourse.vendre.toast_published_desc', { count: livres_modes.length }),
      });
      navigate('/mes-livres');
    } catch (e: any) {
      toast({
        title: t('bourse.vendre.toast_finalize_error_title'),
        description: e?.message || t('bourse.vendre.toast_finalize_error_desc'),
        variant: 'destructive',
      });
    } finally {
      setFinalizing(false);
    }
  };

  // Total = somme des crédits nets (credit_net_xaf du backend = × 0.75 − frais IA).
  const totalValue = books
    .filter(b => !b.is_rejected)
    .reduce((s, b) => s + Math.round(b.credit_net_xaf ?? Math.max(0, (b.valeur_calculee || 0) * 0.75 - 40)), 0);
  const validBooksCount = books.filter(b => !b.is_rejected).length;

  // ✅ 2026-05-11 : GPS gate obligatoire AVANT tout — la page complète
  // ne se rend que quand la position est accordée. Tant que gps est
  // null, on affiche un écran d'instructions clair (composant GpsGate).
  // Une fois accordée, le state `gps` est rempli et le rendu normal
  // de la page démarre. ensureSession utilise alors gps directement.
  if (!gps) {
    return (
      <GpsGate
        title="Où venir chercher vos livres ?"
        reason="Indiquez le point où le coursier viendra récupérer vos livres après matching. Vous pouvez utiliser votre position actuelle ou choisir un lieu précis sur la carte."
        onGranted={(coords) => {
          setGps(coords);
          setGpsAsked(true);
        }}
        onCancel={() => navigate(-1)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-orange-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20" aria-label="Retour">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">YUKPO</span>
              <h1 className="font-bold text-lg leading-tight mt-0.5">
                {sessionMode === 'vente' ? t('bourse.vendre.title_vente')
                  : sessionMode === 'don' ? t('bourse.vendre.title_don')
                  : t('bourse.vendre.title_troc')}
              </h1>
              <p className="text-orange-100 text-xs">
                {t('bourse.vendre.subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-orange-100">
            <MapPin className="w-3 h-3" />
            <span>{gps ? t('bourse.vendre.gps_ok_short') : t('bourse.vendre.gps_unavailable')}</span>
            <span>·</span>
            <span>
              {sessionCreating ? t('bourse.vendre.session_creating')
                : sessionId ? t('bourse.vendre.session_ready')
                : sessionError ? t('bourse.vendre.session_error')
                : t('bourse.vendre.session_waiting')}
            </span>
            {books.length > 0 && (
              <>
                <span>·</span>
                <span>{t(
                  validBooksCount > 1 ? 'bourse.vendre.books_count_other' : 'bourse.vendre.books_count_one',
                  { count: validBooksCount },
                )}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Avertissement éligibilité — dépliable pour ne pas être envahissant.
            Click pour expand → texte complet ; click pour collapse → titre seul. */}
        {books.length === 0 && (
          <button
            type="button"
            onClick={() => setEligibilityOpen((v) => !v)}
            aria-expanded={eligibilityOpen}
            className="w-full mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-snug flex items-start gap-2 active:bg-amber-100 text-left"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <strong>{t('bourse.home.eligibility_warning_title')}</strong>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-amber-700 transition-transform shrink-0 ${eligibilityOpen ? 'rotate-90' : ''}`}
                />
              </div>
              {eligibilityOpen && (
                <p className="mt-1.5">{t('bourse.home.eligibility_warning_desc')}</p>
              )}
            </div>
          </button>
        )}
        {/* Sélecteur de mode listing par défaut session */}
        {books.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">{t('bourse.vendre.mode_default_title')}</p>
            {/* Légende des 3 modes — texte i18n unique avec interpolation
                pour conserver les couleurs sémantiques par mode. */}
            <p className="text-[11px] text-gray-500 leading-snug mb-2">
              {t('bourse.vendre.mode_legend', {
                troc: '__TROC__',
                vente: '__VENTE__',
                don: '__DON__',
              }).split(/(__TROC__|__VENTE__|__DON__)/).map((part, i) => {
                if (part === '__TROC__') return <strong key={i} className="text-amber-700">{MODE_INFO.troc.label}</strong>;
                if (part === '__VENTE__') return <strong key={i} className="text-orange-700">{MODE_INFO.vente.label}</strong>;
                if (part === '__DON__') return <strong key={i} className="text-emerald-700">{MODE_INFO.don.label}</strong>;
                return part;
              })}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['troc', 'vente', 'don'] as ModeListing[]).map(m => {
                const info = MODE_INFO[m];
                const isActive = sessionMode === m;
                const Icon = m === 'troc' ? Repeat : m === 'vente' ? ShoppingBag : Gift;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSessionMode(m)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 ${
                      isActive ? `${info.bg} ${info.border} ${info.color}` : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-bold leading-tight">{info.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">{MODE_INFO[sessionMode].desc}</p>
          </div>
        )}

        {/* Erreur session */}
        {sessionError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-800">{t('bourse.vendre.session_failed')}</p>
              <p className="text-[11px] text-red-700">{sessionError}</p>
              <button onClick={() => ensureSession()} className="mt-1.5 text-[11px] underline text-red-700 font-semibold">
                {t('bourse.vendre.session_retry')}
              </button>
            </div>
          </div>
        )}

        {/* Bouton principal : ajouter un livre via photo IA.
            Le bouton reste cliquable même si la session n'est pas encore prête
            — on déclenche alors ensureSession() à la volée, ce qui évite
            l'effet "bouton grisé sans feedback" si la création de session
            initiale a échoué (réseau, race, 401 résolu après login). */}
        {!showCapture && (
          <button
            onClick={async () => {
              if (!sessionId) {
                const sid = await ensureSession();
                if (!sid) return; // erreur déjà affichée plus haut
              }
              setShowCapture(true);
            }}
            disabled={sessionCreating}
            className="w-full mb-3 flex items-center justify-center gap-2 py-4 px-4 bg-orange-500 disabled:bg-orange-300 text-white rounded-2xl text-sm font-bold shadow-lg"
          >
            {sessionCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            {sessionCreating
              ? t('bourse.vendre.cta_preparing')
              : books.length === 0 ? t('bourse.vendre.cta_photo_first') : t('bourse.vendre.cta_photo_more')}
          </button>
        )}

        {/* BookPhotoCapture inline */}
        {showCapture && sessionId && (
          <div className="mb-3">
            <BookPhotoCapture
              sessionId={sessionId}
              userLat={gps?.lat}
              userLng={gps?.lon}
              modeListing={sessionMode}
              onAnalyzed={handleAnalyzed}
              onCancel={() => setShowCapture(false)}
            />
          </div>
        )}

        {/* Liste des livres ajoutés */}
        {books.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mt-3 mb-1">
              {t('bourse.vendre.books_ready')}
            </p>
            {books.map(book => (
              <div key={book.localId} className={`rounded-2xl border p-3 ${
                book.is_rejected ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    book.is_rejected ? 'bg-red-100' : 'bg-emerald-100'
                  }`}>
                    {book.is_rejected
                      ? <AlertTriangle className="w-4 h-4 text-red-600" />
                      : <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{book.titre}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {[book.classe_actuelle, book.matiere].filter(Boolean).join(' · ')}
                    </p>
                    {!book.is_rejected ? (
                      <p className="text-[11px] mt-1">
                        <span className={
                          book.etat_classification === 'bon' ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }>
                          {book.etat_classification === 'bon' ? t('bourse.vendre.bon_etat') : t('bourse.vendre.acceptable_etat')}
                        </span>
                        <span className="text-gray-500">{t('bourse.vendre.credit_label')}</span>
                        <span className="text-orange-700 font-bold">
                          {Math.round(book.credit_net_xaf ?? Math.max(0, book.valeur_calculee * 0.75 - 40)).toLocaleString('fr-FR')} XAF
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-red-700 font-semibold mt-1">{t('bourse.vendre.book_rejected')}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeBook(book.localId)}
                    className="p-1.5 rounded-full hover:bg-gray-100 shrink-0"
                    aria-label={t('bourse.vendre.remove_book')}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>

                {/* Sélecteur mode par livre */}
                {!book.is_rejected && (
                  <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
                    {(['troc', 'vente', 'don'] as ModeListing[]).map(m => {
                      const info = MODE_INFO[m];
                      const isActive = book.mode === m;
                      const Icon = m === 'troc' ? Repeat : m === 'vente' ? ShoppingBag : Gift;
                      return (
                        <button
                          key={m}
                          onClick={() => updateBookMode(book.localId, m)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-[10px] font-semibold ${
                            isActive ? `${info.bg} ${info.border} ${info.color}` : 'bg-white border-gray-200 text-gray-500'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {info.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Total estimé */}
            {totalValue > 0 && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-2xl p-3 flex items-center justify-between">
                <span className="text-sm text-orange-800">{t('bourse.vendre.total_credit_label')}</span>
                <span className="text-lg font-bold text-orange-700">{totalValue.toLocaleString('fr-FR')} XAF</span>
              </div>
            )}
          </div>
        )}

        {/* Hint si pas de livre encore */}
        {books.length === 0 && !showCapture && sessionId && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center">
            <BookOpen className="w-10 h-10 text-orange-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">{t('bourse.vendre.hint_first_book')}</p>
            <p className="text-[10px] text-gray-400 mt-1">{t('bourse.vendre.hint_ai_detect')}</p>
          </div>
        )}
      </div>

      {/* CTA finaliser */}
      {validBooksCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40 max-w-2xl mx-auto">
          <button
            onClick={finalize}
            disabled={finalizing}
            className="w-full bg-emerald-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            {finalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {finalizing
              ? t('bourse.vendre.cta_publishing')
              : t(
                  validBooksCount > 1 ? 'bourse.vendre.cta_publish_other' : 'bourse.vendre.cta_publish_one',
                  { count: validBooksCount },
                )}
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
      )}

      {/* ✅ 2026-05-14 : Modale fallback rejet — design refactoré pour cumul
          Don + Achat classe supérieure, avec règles conditionnelles selon
          rejection_code (primaire/workbook désactivent Occasion). */}
      {rejectionFallback && (() => {
        const r = rejectionFallback;
        const code = r.rejection_code ?? '';
        const classeSup = r.classe_souhaitee || '';
        // Détection classe primaire : SIL/CP/CE/CM (FR) + Class 1-6 (EN) + Maternelle X année.
        const isClassPrimary = (cls: string): boolean => {
          const c = cls.trim().toLowerCase();
          if (!c) return false;
          // Maternelle (toujours pré-primaire/primaire)
          if (c.includes('maternelle') || c.includes('nursery') || c.includes('petite section') || c.includes('grande section')) return true;
          // Francophone primaire
          if (/^(sil|cp|ce[12]|cm[12])($|\s)/i.test(c)) return true;
          // Anglophone primaire (Class 1-6)
          if (/^class\s*[1-6]($|\s)/i.test(c)) return true;
          return false;
        };
        const isClassFirstSecondary = (cls: string): boolean => {
          const c = cls.trim().toLowerCase();
          // 6ème (FR) ou Form 1 (EN)
          return /^6\s*[èe]me?($|\s)/i.test(c) || /^form\s*1($|\s)/i.test(c);
        };

        // Disponibilité du Don : nécessite livre_id ET pas déjà mode don.
        const canDon = !!r.livre_id && r.livre_id > 0 && sessionMode !== 'don';
        // Disponibilité Occasion : SAUF si rejet primaire/workbook ET classe_sup
        // n'est pas le 1er niveau secondaire.
        const isPrimaryReject = code === 'niveau_primaire';
        const isWorkbookReject = code === 'non_reusable_workbook';
        const supIsFirstSecondary = isClassFirstSecondary(classeSup);
        const supIsPrimary = isClassPrimary(classeSup);
        const occasionAllowed = !!classeSup
          && (
            (!isPrimaryReject && !isWorkbookReject && !supIsPrimary)
            || (isPrimaryReject && supIsFirstSecondary)
            // workbook : jamais d'occasion (workbook consommable de toute classe)
          );
        const neufAllowed = !!classeSup;
        // Au moins une option active pour pouvoir valider.
        const canConfirm = !rejectionProcessing && (
          (canDon && donChoice) || (neufAllowed && buyChoice !== 'aucun')
        );

        const onConfirm = async () => {
          if (!canConfirm) return;
          setRejectionProcessing(true);
          try {
            // 1) Don d'abord si coché
            if (canDon && donChoice) {
              const res = await apiPost(`/api/bourse-livre/${r.livre_id}/mark-as-don`, {});
              const data = await res.json().catch(() => ({}));
              if (!res.ok || data?.success === false) {
                throw new Error(data?.error || data?.message || 'Échec du don');
              }
              toast({
                title: t('bourse.vendre.toast_don_done_title'),
                description: t('bourse.vendre.toast_don_done_desc'),
              });
            }
            // 2) Achat classe supérieure si choisi
            if (buyChoice !== 'aucun' && classeSup) {
              setRejectionFallback(null);
              setShowCapture(false);
              navigate(`/programme-ecole?classe=${encodeURIComponent(classeSup)}&mode=${buyChoice}`);
              return;
            }
            // Sinon (don seul) : ferme la modale
            setRejectionFallback(null);
            setShowCapture(false);
          } catch (e: any) {
            toast({
              title: t('bourse.vendre.toast_rejected_title'),
              description: e?.message || t('bourse.vendre.toast_rejected_desc'),
              variant: 'destructive',
            });
          } finally {
            setRejectionProcessing(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[90dvh] overflow-y-auto">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm">
                    {t('bourse.vendre.rejection_title', { defaultValue: 'Ce livre ne peut pas être listé' })}
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5 leading-snug">
                    {r.rejection_message || t('bourse.vendre.toast_rejected_desc')}
                  </p>
                </div>
              </div>

              {/* ──── Section 1 : Don (checkbox cumulable) ──── */}
              {canDon && (
                <div className="mb-3 border-2 border-emerald-200 rounded-xl bg-emerald-50 overflow-hidden">
                  <label className="flex items-start gap-3 px-3 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={donChoice}
                      onChange={(e) => setDonChoice(e.target.checked)}
                      disabled={rejectionProcessing}
                      className="mt-0.5 w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                        <p className="text-sm font-bold text-emerald-800 leading-tight">
                          {t('bourse.vendre.fallback_don_title', { defaultValue: 'Faire don de ce livre' })}
                        </p>
                      </div>
                      <p className="text-[11px] text-emerald-700 leading-snug mt-0.5">
                        {t('bourse.vendre.fallback_don_desc', { defaultValue: 'Un autre parent en aura l\'usage. Geste solidaire, sans contrepartie.' })}
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* ──── Section 2 : Achat classe supérieure (radio) ──── */}
              {classeSup && (
                <div className="mb-3">
                  <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-2">
                    {t('bourse.vendre.fallback_upper_class', { defaultValue: 'Acheter le livre de la classe supérieure ({{classe}})', classe: classeSup })}
                  </p>
                  <div className="space-y-2">
                    {neufAllowed && (
                      <label className="flex items-start gap-3 px-3 py-3 rounded-xl border-2 cursor-pointer transition-colors ${buyChoice === 'neuf' ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-200'}"
                        style={{ borderColor: buyChoice === 'neuf' ? '#60a5fa' : '#e5e7eb', background: buyChoice === 'neuf' ? '#eff6ff' : 'white' }}
                      >
                        <input
                          type="radio"
                          name="buyChoice"
                          checked={buyChoice === 'neuf'}
                          onChange={() => setBuyChoice('neuf')}
                          disabled={rejectionProcessing}
                          className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <ShoppingBag className="w-4 h-4 text-blue-600 shrink-0" />
                            <p className="text-sm font-bold text-blue-800 leading-tight">
                              {t('bourse.vendre.fallback_buy_new_title', { defaultValue: 'Neuf', classe: '' })}
                            </p>
                          </div>
                          <p className="text-[11px] text-blue-700 leading-snug mt-0.5">
                            {t('bourse.vendre.fallback_buy_new_desc', { defaultValue: 'Plein tarif, livraison rapide, livre flambant neuf.' })}
                          </p>
                        </div>
                      </label>
                    )}
                    {occasionAllowed && (
                      <label className="flex items-start gap-3 px-3 py-3 rounded-xl border-2 cursor-pointer transition-colors"
                        style={{ borderColor: buyChoice === 'occasion' ? '#fb923c' : '#e5e7eb', background: buyChoice === 'occasion' ? '#fff7ed' : 'white' }}
                      >
                        <input
                          type="radio"
                          name="buyChoice"
                          checked={buyChoice === 'occasion'}
                          onChange={() => setBuyChoice('occasion')}
                          disabled={rejectionProcessing}
                          className="mt-0.5 w-4 h-4 text-orange-600 focus:ring-orange-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Repeat className="w-4 h-4 text-orange-600 shrink-0" />
                            <p className="text-sm font-bold text-orange-800 leading-tight">
                              {t('bourse.vendre.fallback_buy_used_title', { defaultValue: 'Occasion', classe: '' })}
                            </p>
                          </div>
                          <p className="text-[11px] text-orange-700 leading-snug mt-0.5">
                            {t('bourse.vendre.fallback_buy_used_desc', { defaultValue: 'Moins cher, mêmes contenus. Disponibilité variable.' })}
                          </p>
                        </div>
                      </label>
                    )}
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="buyChoice"
                        checked={buyChoice === 'aucun'}
                        onChange={() => setBuyChoice('aucun')}
                        disabled={rejectionProcessing}
                        className="w-4 h-4 text-gray-500"
                      />
                      <p className="text-[12px] text-gray-600">
                        {t('bourse.vendre.fallback_buy_none', { defaultValue: 'Pas maintenant' })}
                      </p>
                    </label>
                  </div>
                  {/* Info contextuelle pour rejet primaire avec occasion masqué */}
                  {(isPrimaryReject || isWorkbookReject) && !occasionAllowed && (
                    <p className="text-[10px] text-gray-500 italic mt-1.5 leading-snug">
                      {isPrimaryReject
                        ? t('bourse.vendre.fallback_no_occasion_primary', { defaultValue: '🛈 L\'occasion n\'est pas disponible pour les livres du primaire (consommables).' })
                        : t('bourse.vendre.fallback_no_occasion_workbook', { defaultValue: '🛈 L\'occasion n\'est pas disponible pour les cahiers d\'activité (consommables).' })}
                    </p>
                  )}
                </div>
              )}

              {/* ──── Boutons d'action ──── */}
              <div className="flex gap-2">
                <button
                  disabled={rejectionProcessing}
                  onClick={() => setRejectionFallback(null)}
                  className="flex-1 px-3 py-3 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl disabled:opacity-50"
                >
                  {t('bourse.vendre.fallback_cancel', { defaultValue: 'Annuler' })}
                </button>
                <button
                  disabled={!canConfirm}
                  onClick={onConfirm}
                  className="flex-1 px-3 py-3 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-gray-300 disabled:text-gray-500 rounded-xl inline-flex items-center justify-center gap-2"
                >
                  {rejectionProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('bourse.vendre.fallback_confirm', { defaultValue: 'Valider' })}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default VendreLivresPage;
