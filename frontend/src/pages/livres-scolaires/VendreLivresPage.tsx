import {
  AlertTriangle, ArrowLeft, BookOpen, Camera, Check, ChevronRight, Gift, Loader2,
  MapPin, Plus, Repeat, ShoppingBag, Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BookPhotoCapture, { AnalyzedBookResult } from '../../components/livres-scolaires/BookPhotoCapture';
import GpsGate from '../../components/livres-scolaires/GpsGate';
import { apiPost } from '../../services/apiService';
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

  const handleAnalyzed = (result: AnalyzedBookResult) => {
    if (result.is_rejected) {
      toast({
        title: 'Livre rejeté',
        description: 'Ce livre est trop dégradé. Réessayez avec une autre photo.',
        variant: 'destructive',
      });
      // Le composant BookPhotoCapture gère déjà l'affichage du rejet ;
      // on ne ferme pas la modale pour permettre un nouvel essai.
      return;
    }
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setBooks(prev => [...prev, { ...result, localId, mode: sessionMode }]);
    setShowCapture(false);
    toast({
      title: 'Livre ajouté',
      description: `${result.titre} — Crédit ${Math.round(result.valeur_calculee * 0.75).toLocaleString('fr-FR')} XAF`,
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
      toast({ title: 'Aucun livre à valider', variant: 'destructive' });
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
        title: 'Annonce(s) publiée(s)',
        description: `${livres_modes.length} livre(s) sont visibles sur Yukpo.`,
      });
      navigate('/mes-livres');
    } catch (e: any) {
      toast({
        title: 'Erreur finalisation',
        description: e?.message || 'Réessayez dans un instant',
        variant: 'destructive',
      });
    } finally {
      setFinalizing(false);
    }
  };

  // Total = somme des crédits nets (× 0.75 pour cohérence avec l'affichage par livre).
  // Avant le fix : on sommait valeur_calculee brute → total surestimé de 33%.
  const totalValue = books
    .filter(b => !b.is_rejected)
    .reduce((s, b) => s + Math.round((b.valeur_calculee || 0) * 0.75), 0);
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
                {sessionMode === 'vente' ? 'Vendre mes livres'
                  : sessionMode === 'don' ? 'Donner mes livres'
                  : 'Mettre au troc'}
              </h1>
              <p className="text-orange-100 text-xs">
                Photo IA → titre, état, valeur détectés automatiquement
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-orange-100">
            <MapPin className="w-3 h-3" />
            <span>{gps ? `GPS ok` : 'GPS non disponible'}</span>
            <span>·</span>
            <span>
              {sessionCreating ? 'Session…'
                : sessionId ? 'Session prête'
                : sessionError ? 'Erreur session'
                : 'En attente'}
            </span>
            {books.length > 0 && (
              <>
                <span>·</span>
                <span>{validBooksCount} livre{validBooksCount > 1 ? 's' : ''}</span>
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
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Type d'annonce par défaut</p>
            {/* ✅ Mini-descriptif soft pour aider le parent à choisir entre
                les 3 modes — orienté pratique réelle (ce qui se passe avec le livre),
                avec un mot sur l'impact financier. */}
            <p className="text-[11px] text-gray-500 leading-snug mb-2">
              <strong className="text-amber-700">Échange</strong> : votre livre de l'an dernier part chez un autre parent, et vous recevez le livre de la classe suivante <span className="text-gray-400">(crédit immédiat)</span> ·{' '}
              <strong className="text-orange-700">Vente</strong> : livre d'occasion remis en circulation <span className="text-gray-400">(cash à la vente)</span> ·{' '}
              <strong className="text-emerald-700">Don</strong> : vous offrez le livre à la communauté <span className="text-gray-400">(sans contrepartie)</span>.
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
              <p className="text-xs font-semibold text-red-800">Impossible de créer la session</p>
              <p className="text-[11px] text-red-700">{sessionError}</p>
              <button onClick={() => ensureSession()} className="mt-1.5 text-[11px] underline text-red-700 font-semibold">
                Réessayer
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
              ? 'Préparation…'
              : books.length === 0 ? 'Photographier mon premier livre' : 'Ajouter un autre livre'}
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
              Livres prêts à publier
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
                          {book.etat_classification === 'bon' ? 'Bon état' : 'État acceptable'}
                        </span>
                        <span className="text-gray-500"> · Crédit </span>
                        <span className="text-orange-700 font-bold">
                          {Math.round(book.valeur_calculee * 0.75).toLocaleString('fr-FR')} XAF
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-red-700 font-semibold mt-1">Livre rejeté</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeBook(book.localId)}
                    className="p-1.5 rounded-full hover:bg-gray-100 shrink-0"
                    aria-label="Retirer"
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
                <span className="text-sm text-orange-800">Crédit total estimé</span>
                <span className="text-lg font-bold text-orange-700">{totalValue.toLocaleString('fr-FR')} XAF</span>
              </div>
            )}
          </div>
        )}

        {/* Hint si pas de livre encore */}
        {books.length === 0 && !showCapture && sessionId && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 text-center">
            <BookOpen className="w-10 h-10 text-orange-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Photographiez votre premier livre pour commencer.</p>
            <p className="text-[10px] text-gray-400 mt-1">L'IA détectera tout : titre, état, valeur.</p>
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
              ? 'Publication…'
              : `Publier ${validBooksCount} livre${validBooksCount > 1 ? 's' : ''}`}
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
      )}
    </div>
  );
};

export default VendreLivresPage;
