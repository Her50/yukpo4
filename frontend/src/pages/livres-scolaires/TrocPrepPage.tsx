import {
  AlertTriangle, ArrowLeft, BookOpen, Camera, Check, ChevronRight, Loader2,
  MapPin, Repeat, ShoppingBag, Sparkles, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BookPhotoCapture, { AnalyzedBookResult } from '../../components/livres-scolaires/BookPhotoCapture';
import { apiPost } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';
import { PanierItem, useParentShop } from '../../hooks/useParentShop';

/**
 * Workflow ALIGNÉ sur le mobile (BookUploadV2Screen.tsx) :
 *   1. Au montage : capture GPS + création session via POST /api/bourse-livre/v2/sessions
 *   2. Pour chaque item du panier marqué "occasion", l'utilisateur peut :
 *      a) Photographier son livre (recto + verso obligatoires) → analyse IA → livre créé
 *      b) Basculer ce livre en neuf (skip troc)
 *      c) Reporter ("plus tard")
 *   3. Au "Continuer vers récap" : POST /sessions/:id/finalize avec tous les livres
 *      proposés et leur mode_listing='troc'.
 *
 * L'analyse IA peut renvoyer etat_classification='rejete' → le livre est marqué
 * rejeté à valeur 0 ; l'utilisateur peut réessayer avec une autre photo.
 */

type ItemStatus = 'pending' | 'matched' | 'rejected' | 'skipped' | 'switched';

interface ItemMatch {
  status: ItemStatus;
  livre_id?: number;
  etat_classification?: 'bon' | 'acceptable' | 'rejete';
  valeur_calculee?: number;
}

const TrocPrepPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { panier, enfants, updateChoix, updateTrocMatch } = useParentShop();

  const occasionItems = useMemo(
    () => panier.filter(p => p.choix === 'occasion'),
    [panier]
  );

  // ─── État session + GPS ───
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreating, setSessionCreating] = useState(false);
  const [sessionError, setSessionError] = useState<string>('');
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsAsked, setGpsAsked] = useState(false);
  const sessionInitRef = useRef(false);

  // ─── État du tracking par item ───
  const [matches, setMatches] = useState<Record<string, ItemMatch>>(() =>
    Object.fromEntries(occasionItems.map(it => [it.id, { status: 'pending' as ItemStatus }]))
  );
  const [openCaptureFor, setOpenCaptureFor] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // ─── 1. Capture GPS au montage ───
  useEffect(() => {
    if (gpsAsked) return;
    setGpsAsked(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {/* GPS refusé : on continue sans, la session sera créée sans coords */},
      { timeout: 5000, maximumAge: 60000 }
    );
  }, [gpsAsked]);

  // ─── 2. Création session quand on a tenté le GPS (avec ou sans) ───
  const ensureSession = useCallback(async () => {
    if (sessionId || sessionCreating || sessionInitRef.current) return sessionId;
    sessionInitRef.current = true;
    setSessionCreating(true);
    setSessionError('');
    try {
      const payload: Record<string, any> = {
        mode_listing_defaut: 'troc',
      };
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
      sessionInitRef.current = false; // permet de réessayer
      return null;
    } finally {
      setSessionCreating(false);
    }
  }, [gps, sessionId, sessionCreating]);

  // Crée la session dès que le GPS a été tenté
  useEffect(() => {
    if (gpsAsked && !sessionId && !sessionCreating) {
      ensureSession();
    }
  }, [gpsAsked, sessionId, sessionCreating, ensureSession]);

  // ─── Empty state — pas d'occasion items ───
  if (occasionItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <Repeat className="w-12 h-12 text-amber-300 mb-3" />
        <p className="text-sm text-gray-700 font-semibold mb-1">Aucun livre en occasion</p>
        <p className="text-xs text-gray-500 mb-5">
          Marquez d'abord vos livres en occasion depuis la page de scan ou de programme.
        </p>
        <button
          onClick={() => navigate('/recap')}
          className="bg-amber-500 text-white font-bold px-5 py-2.5 rounded-2xl text-sm"
        >
          Retour au récap
        </button>
      </div>
    );
  }

  const enfantOf = (item: PanierItem) => enfants.find(e => e.id === item.enfantId);

  const matchedCount = Object.values(matches).filter(m => m.status === 'matched').length;
  const rejectedCount = Object.values(matches).filter(m => m.status === 'rejected').length;
  const remaining = occasionItems.length - Object.values(matches).filter(m => m.status !== 'pending').length;

  // ─── Handlers ───

  const handleAnalyzed = (itemId: string, result: AnalyzedBookResult) => {
    if (result.is_rejected) {
      setMatches(prev => ({
        ...prev,
        [itemId]: {
          status: 'rejected',
          livre_id: result.livre_id || undefined,
          etat_classification: result.etat_classification,
          valeur_calculee: 0,
        },
      }));
      // On ne persiste PAS le trocLivreId pour un livre rejeté.
      updateTrocMatch(itemId, undefined);
      toast({
        title: 'Livre rejeté',
        description: 'Trop dégradé pour le troc. Réessayez avec une autre photo ou choisissez le neuf.',
        variant: 'destructive',
      });
    } else {
      setMatches(prev => ({
        ...prev,
        [itemId]: {
          status: 'matched',
          livre_id: result.livre_id,
          etat_classification: result.etat_classification,
          valeur_calculee: result.valeur_calculee,
        },
      }));
      // Persiste le trocLivreId dans le panier (lu par RecapAchatPage pour
      // construire livres_occasion[] dans la commande mixte).
      if (result.livre_id) updateTrocMatch(itemId, result.livre_id);
      setOpenCaptureFor(null);
      toast({
        title: 'Livre proposé au troc',
        description: `Crédit estimé : ${Math.round(result.credit_net_xaf ?? Math.max(0, result.valeur_calculee * 0.75 - 40)).toLocaleString('fr-FR')} XAF`,
      });
    }
  };

  const switchToNeuf = (item: PanierItem) => {
    updateChoix(item.id, 'neuf');
    updateTrocMatch(item.id, undefined); // efface tout match troc précédent
    setMatches(prev => ({ ...prev, [item.id]: { status: 'switched' } }));
    toast({ title: `« ${item.titre} » basculé en neuf` });
  };

  const skipItem = (item: PanierItem) => {
    setMatches(prev => ({ ...prev, [item.id]: { status: 'skipped' } }));
  };

  const skipAllToNeuf = () => {
    const pending = occasionItems.filter(it => (matches[it.id]?.status || 'pending') === 'pending');
    if (pending.length === 0) {
      toast({ title: 'Aucun item en attente — tous déjà décidés' });
      return;
    }
    pending.forEach(it => updateChoix(it.id, 'neuf'));
    setMatches(prev => {
      const next = { ...prev };
      pending.forEach(it => { next[it.id] = { status: 'switched' }; });
      return next;
    });
    sessionStorage.setItem('yukpo_recap_troc_choice', 'neuf');
    toast({
      title: `${pending.length} article(s) basculé(s) en neuf`,
      description: 'Vous pouvez maintenant valider votre récapitulatif.',
    });
  };

  const goRecap = async () => {
    // Si la session a des livres matchés, on la finalize avec mode_listing='troc'.
    const matchedLivres = Object.values(matches)
      .filter(m => m.status === 'matched' && m.livre_id)
      .map(m => ({ livre_id: m.livre_id as number, mode_listing: 'troc' as const }));

    if (sessionId && matchedLivres.length > 0) {
      setFinalizing(true);
      try {
        const res = await apiPost(
          `/api/bourse-livre/v2/programmes-scolaires/sessions/${sessionId}/finalize`,
          { livres_modes: matchedLivres }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          // Tentative sur l'ancienne route
          const altRes = await apiPost(
            `/api/bourse-livre/v2/sessions/${sessionId}/finalize`,
            { livres_modes: matchedLivres }
          );
          const altData = await altRes.json().catch(() => ({}));
          if (!altRes.ok || altData?.success === false) {
            throw new Error(altData?.error || data?.error || 'Finalize failed');
          }
        }
        toast({
          title: `${matchedLivres.length} livre(s) en troc`,
          description: 'Yukpo va chercher les meilleurs échanges.',
        });
      } catch (e: any) {
        // Non bloquant : on laisse passer au récap, l'utilisateur pourra retenter.
        console.error('[TrocPrep] Finalize error:', e);
        toast({
          title: 'Finalisation partielle',
          description: 'Vos livres ont bien été enregistrés. La finalisation se fera au paiement.',
        });
      } finally {
        setFinalizing(false);
      }
    }
    navigate('/recap');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20" aria-label="Retour">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">YUKPO</span>
              <h1 className="font-bold text-lg leading-tight mt-0.5">Mes livres à échanger</h1>
              <p className="text-amber-100 text-xs">
                {occasionItems.length} livre{occasionItems.length > 1 ? 's' : ''} en occasion
                {matchedCount > 0 && ` · ${matchedCount} mis au troc`}
                {rejectedCount > 0 && ` · ${rejectedCount} rejeté${rejectedCount > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Statut GPS + session */}
          <div className="flex items-center gap-2 text-[11px] text-amber-100">
            <MapPin className="w-3 h-3" />
            <span>{gps ? `GPS ok (${gps.lat.toFixed(2)}, ${gps.lon.toFixed(2)})` : 'GPS non disponible'}</span>
            <span>·</span>
            <span>
              {sessionCreating ? 'Session…'
                : sessionId ? 'Session prête'
                : sessionError ? 'Erreur session'
                : 'En attente'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Bandeau pédagogique */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3 flex gap-3">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-900">Le manuel de l'aîné finance la classe suivante</p>
            <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
              Photographiez recto + verso de votre livre. L'IA détecte automatiquement le titre,
              l'état, et calcule la valeur (Bon&nbsp;: 70%, Acceptable&nbsp;: 40%, trop dégradé&nbsp;: rejeté).
            </p>
          </div>
        </div>

        {/* Erreur session */}
        {sessionError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-800">Impossible de créer la session troc</p>
              <p className="text-[11px] text-red-700">{sessionError}</p>
              <button
                onClick={() => ensureSession()}
                className="mt-1.5 text-[11px] underline text-red-700 font-semibold"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Skip-troc global */}
        {remaining > 0 && (
          <button
            onClick={skipAllToNeuf}
            className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-blue-200 rounded-2xl text-xs font-semibold text-blue-700 active:bg-blue-50"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Je n'ai aucun livre à échanger — tout en neuf
          </button>
        )}

        {/* Liste des items occasion */}
        <div className="space-y-2.5">
          {occasionItems.map(item => {
            const match = matches[item.id] || { status: 'pending' as ItemStatus };
            const enfant = enfantOf(item);
            const isCaptureOpen = openCaptureFor === item.id;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{item.titre}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {[item.matiere, enfant?.classe].filter(Boolean).join(' · ')}
                    </p>
                    {match.status === 'matched' && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Proposé au troc
                        {match.valeur_calculee !== undefined && match.valeur_calculee > 0 &&
                          ` · ${match.valeur_calculee.toLocaleString('fr-FR')} XAF (${match.etat_classification})`}
                      </p>
                    )}
                    {match.status === 'rejected' && (
                      <p className="text-[11px] text-red-700 font-semibold mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Livre rejeté (trop dégradé)
                      </p>
                    )}
                    {match.status === 'switched' && (
                      <p className="text-[11px] text-blue-700 font-semibold mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Basculé en neuf
                      </p>
                    )}
                    {match.status === 'skipped' && (
                      <p className="text-[11px] text-gray-500 mt-1">Acheter d'occasion sans troc</p>
                    )}
                  </div>
                </div>

                {/* Actions par item — visibles tant que pending */}
                {match.status === 'pending' && !isCaptureOpen && (
                  <div className="px-3 pb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setOpenCaptureFor(item.id)}
                      disabled={!sessionId}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-xs font-semibold"
                    >
                      <Camera className="w-3.5 h-3.5" /> Photographier mon livre
                    </button>
                    <button
                      onClick={() => switchToNeuf(item)}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold"
                    >
                      Prendre neuf
                    </button>
                    <button
                      onClick={() => skipItem(item)}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl text-xs font-semibold"
                    >
                      Plus tard
                    </button>
                  </div>
                )}

                {/* Bouton réessayer si rejeté */}
                {match.status === 'rejected' && !isCaptureOpen && (
                  <div className="px-3 pb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setOpenCaptureFor(item.id)}
                      disabled={!sessionId}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-500 disabled:bg-gray-200 text-white rounded-xl text-xs font-semibold"
                    >
                      <Camera className="w-3.5 h-3.5" /> Réessayer avec autre photo
                    </button>
                    <button
                      onClick={() => switchToNeuf(item)}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold"
                    >
                      Prendre neuf
                    </button>
                  </div>
                )}

                {/* Capture photo IA */}
                {isCaptureOpen && sessionId && (
                  <div className="border-t border-gray-100 p-3 bg-amber-50/30">
                    <BookPhotoCapture
                      sessionId={sessionId}
                      userLat={gps?.lat}
                      userLng={gps?.lon}
                      modeListing="troc"
                      onAnalyzed={r => handleAnalyzed(item.id, r)}
                      onCancel={() => setOpenCaptureFor(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {remaining > 0 && (
          <p className="text-center text-[11px] text-gray-500 mt-4">
            {remaining} livre{remaining > 1 ? 's' : ''} en attente de décision
          </p>
        )}
      </div>

      {/* CTA fixe en bas */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40 max-w-2xl mx-auto">
        <button
          onClick={goRecap}
          disabled={finalizing}
          className="w-full bg-emerald-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg"
        >
          {finalizing
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <ShoppingBag className="w-5 h-5" />}
          {finalizing ? 'Finalisation…' : 'Continuer vers le récapitulatif'}
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      </div>
    </div>
  );
};

export default TrocPrepPage;
