import {
  AlertTriangle, ArrowLeft, BookOpen, Camera, Check, ChevronRight, Gift, Loader2,
  MapPin, Plus, Repeat, ShoppingBag, Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BookPhotoCapture, { AnalyzedBookResult } from '../../components/livres-scolaires/BookPhotoCapture';
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
  troc:  { label: 'Échanger',      desc: 'Échanger contre un autre livre',     color: 'text-amber-900',   bg: 'bg-amber-50',   border: 'border-amber-400' },
  vente: { label: 'Vendre',        desc: 'Mettre en vente d\'occasion',         color: 'text-orange-900',  bg: 'bg-orange-50',  border: 'border-orange-400' },
  don:   { label: 'Donner',        desc: 'Donner gratuitement',                  color: 'text-emerald-900', bg: 'bg-emerald-50', border: 'border-emerald-400' },
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

  const initialMode: ModeListing = (() => {
    const m = searchParams.get('mode');
    return m === 'troc' || m === 'don' ? m : 'vente';
  })();

  const [sessionMode, setSessionMode] = useState<ModeListing>(initialMode);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [sessionError, setSessionError] = useState<string>('');
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsAsked, setGpsAsked] = useState(false);
  const sessionInitRef = useRef(false);

  const [books, setBooks] = useState<AddedBook[]>([]);
  const [showCapture, setShowCapture] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // 1. Capture GPS au montage
  useEffect(() => {
    if (gpsAsked) return;
    setGpsAsked(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { timeout: 5000, maximumAge: 60000 }
    );
  }, [gpsAsked]);

  // 2. Création session (auto après tentative GPS)
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
      const newId = data?.session_id || data?.id || data?.data?.session_id || data?.data?.id;
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

  useEffect(() => {
    if (gpsAsked && !sessionId && !sessionCreating) {
      ensureSession();
    }
  }, [gpsAsked, sessionId, sessionCreating, ensureSession]);

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
      description: `${result.titre} — ${result.valeur_calculee.toLocaleString('fr-FR')} XAF`,
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

  const totalValue = books.filter(b => !b.is_rejected).reduce((s, b) => s + (b.valeur_calculee || 0), 0);
  const validBooksCount = books.filter(b => !b.is_rejected).length;

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
        {/* Sélecteur de mode listing par défaut session */}
        {books.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Type d'annonce par défaut</p>
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
                          {book.etat_classification === 'bon' ? 'Bon (70%)' : 'Acceptable (40%)'}
                        </span>
                        <span className="text-gray-500"> · </span>
                        <span className="text-orange-700 font-bold">
                          {book.valeur_calculee.toLocaleString('fr-FR')} XAF
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
                <span className="text-sm text-orange-800">Valeur totale estimée</span>
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
