import {
  AlertTriangle, Camera, Check, ImageIcon, Loader2, RefreshCw, X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { apiPost } from '../../services/apiService';

/**
 * Workflow recto + verso harmonisé avec mobile (BookUploadV2Screen.tsx) :
 *   1. Photo recto obligatoire
 *   2. Photo verso obligatoire (déclenchée immédiatement après recto)
 *   3. Analyse IA auto sur les 2 photos via POST /api/bourse-livre/v2/analyze-recto-verso
 *   4. Affichage du résultat : valeur calculée + état (bon / acceptable / rejete)
 *   5. Si etat_classification = 'rejete' → livre marqué rejeté, possibilité de réessayer
 *
 * Le composant attend une session existante ; le parent (TrocPrepPage,
 * LivreScolaireFormPage) crée la session avant et passe le sessionId.
 */

export interface AnalyzedBookResult {
  livre_id: number;
  titre: string;
  auteur?: string;
  matiere?: string;
  classe_actuelle?: string;
  classe_souhaitee?: string;
  niveau?: string;
  prix_detecte?: number;
  valeur_calculee: number;
  ratio_etat: number;
  etat_classification: 'bon' | 'acceptable' | 'rejete';
  is_rejected: boolean;
  /** Code court envoyé par le backend pour différencier les motifs de rejet :
   *  'not_in_program' | 'niveau_primaire' | 'non_reusable_workbook' | 'etat_too_damaged' | 'value_zero' | '' (accepté). */
  rejection_code?: string;
  /** Message FR prêt à afficher (toast / banner). */
  rejection_message?: string;
}

export interface BookPhotoCaptureProps {
  sessionId: string;
  userLat?: number;
  userLng?: number;
  /** Mode d'annonce courant. Sert au backend pour pondérer l'analyse. */
  modeListing?: 'troc' | 'vente' | 'don';
  /** Callback invoqué quand l'analyse réussit (livre accepté ou rejeté). */
  onAnalyzed: (result: AnalyzedBookResult) => void;
  /** Optionnel : annuler la capture en cours. */
  onCancel?: () => void;
}

type CaptureStep = 'idle' | 'recto-taken' | 'verso-taken' | 'analyzing' | 'result' | 'error';

/** Compression image : max 1200px, JPEG qualité 0.7 — identique au pattern de scan. */
async function fileToCompressedBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Type de fichier non supporté (image requise)'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas indisponible')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      // On retourne la data-URL complète (data:image/jpeg;base64,...) car le backend
      // mobile l'attend dans ce format. Voir analyzeRectoVerso() dans bourseLivreV2Api.ts.
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('Lecture image impossible')); };
    img.src = url;
  });
}

const BookPhotoCapture: React.FC<BookPhotoCaptureProps> = ({
  sessionId, userLat, userLng, modeListing = 'troc',
  onAnalyzed, onCancel,
}) => {
  const [step, setStep] = useState<CaptureStep>('idle');
  const [rectoBase64, setRectoBase64] = useState<string | null>(null);
  const [versoBase64, setVersoBase64] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<AnalyzedBookResult | null>(null);

  const rectoInputRef = useRef<HTMLInputElement>(null);
  const versoInputRef = useRef<HTMLInputElement>(null);

  const handleRecto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const b64 = await fileToCompressedBase64(file);
      setRectoBase64(b64);
      setStep('recto-taken');
      setError('');
      // ✅ L'auto-déclenchement du verso est délégué au useEffect ci-dessous
      // qui réessaie à plusieurs délais — fiable y compris pour le 1er livre
      // où la caméra Android peut mettre 500-800ms à se fermer.
    } catch (e: any) {
      setError(e?.message || 'Erreur capture recto');
      setStep('error');
    }
  };

  // Auto-ouverture de l'input verso dès que le recto est capturé.
  // On tente à 400ms puis 1200ms : si l'OS ferme encore la caméra du recto
  // au 1er essai, le 2e essai prend la main quand le focus revient à la page.
  useEffect(() => {
    if (step !== 'recto-taken' || !rectoBase64 || versoBase64) return;
    let cancelled = false;
    const delays = [400, 1200];
    const timers = delays.map(d =>
      setTimeout(() => {
        if (cancelled) return;
        // Si l'utilisateur a déjà capturé le verso entre-temps, on ne re-clique pas.
        if (!versoBase64) versoInputRef.current?.click();
      }, d),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [step, rectoBase64, versoBase64]);

  const handleVerso = async (file: File | undefined) => {
    if (!file || !rectoBase64) return;
    try {
      const b64 = await fileToCompressedBase64(file);
      setVersoBase64(b64);
      setStep('analyzing');
      setError('');
      // Analyse IA immédiate.
      await runAnalyze(rectoBase64, b64);
    } catch (e: any) {
      setError(e?.message || 'Erreur capture verso');
      setStep('error');
    }
  };

  const runAnalyze = async (recto: string, verso: string) => {
    try {
      const res = await apiPost('/api/bourse-livre/v2/analyze-recto-verso', {
        image_recto: recto,
        image_verso: verso,
        session_id: sessionId,
        user_lat: userLat,
        user_lng: userLng,
        mode_listing: modeListing,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `Analyse échouée (HTTP ${res.status})`);
      }
      // Extraction & normalisation — équivalente au mobile bourseLivreV2Api.ts:324-393.
      const livre = data?.livre || data?.data?.livre || {};
      const analysis = data?.analysis || data?.data?.analysis || {};
      const rawEtat = String(
        data?.etat_classification ?? analysis?.etat_classification ?? ''
      ).toLowerCase();
      const normalizedEtat: 'bon' | 'acceptable' | 'rejete' =
        rawEtat.includes('rej') ? 'rejete'
          : rawEtat.includes('bon') ? 'bon'
          : 'acceptable';
      const isRejected = Boolean(data?.is_rejected ?? normalizedEtat === 'rejete');
      const ETAT_RATIO: Record<string, number> = { bon: 0.7, acceptable: 0.4, rejete: 0 };
      const detectedPrice = Number(
        livre?.prix_detecte ?? analysis?.prix_detecte ?? data?.prix_detecte ?? 0
      ) || 0;
      const safeValue = isRejected
        ? 0
        : Math.max(Math.round(detectedPrice * ETAT_RATIO[normalizedEtat]), 0);

      // ✅ Récupère le code + message de rejet enrichis par le backend
      // ('not_in_program', 'etat_too_damaged', 'value_zero'). Permet
      // d'afficher une raison précise plutôt qu'un texte générique.
      const rejection_code: string = String(data?.rejection_code ?? '');
      const rejection_message: string = String(data?.rejection_message ?? '');
      const effectiveRejected = Boolean(
        data?.is_rejected ?? isRejected ?? false,
      );

      const finalResult: AnalyzedBookResult = {
        livre_id: Number(livre?.id ?? data?.livre_id ?? 0),
        titre: String(livre?.titre ?? analysis?.titre ?? 'Livre'),
        auteur: livre?.auteur ?? analysis?.auteur,
        matiere: livre?.matiere ?? analysis?.matiere,
        classe_actuelle: livre?.classe_actuelle ?? analysis?.classe_actuelle,
        classe_souhaitee: livre?.classe_souhaitee ?? analysis?.classe_souhaitee,
        niveau: livre?.niveau ?? analysis?.niveau,
        prix_detecte: detectedPrice || undefined,
        valeur_calculee: Number(data?.valeur_calculee ?? safeValue) || safeValue,
        ratio_etat: Number(data?.ratio_etat ?? ETAT_RATIO[normalizedEtat]),
        etat_classification: normalizedEtat,
        is_rejected: effectiveRejected,
        rejection_code: rejection_code || undefined,
        rejection_message: rejection_message || undefined,
      };
      setResult(finalResult);
      setStep('result');
      // On notifie le parent même si rejeté — le parent décide d'inclure ou non.
      onAnalyzed(finalResult);
    } catch (e: any) {
      setError(e?.message || "L'IA n'a pas pu analyser ce livre.");
      setStep('error');
    }
  };

  const reset = () => {
    setRectoBase64(null);
    setVersoBase64(null);
    setResult(null);
    setError('');
    setStep('idle');
  };

  // ============================================================================
  // Rendu — étapes successives
  // ============================================================================

  if (step === 'analyzing') {
    return (
      <div className="bg-white border border-amber-200 rounded-2xl p-5 text-center">
        <Loader2 className="w-6 h-6 text-amber-600 animate-spin mx-auto mb-2" />
        <p className="text-sm font-semibold text-gray-800">Analyse IA en cours…</p>
        <p className="text-xs text-gray-500 mt-1">Lecture du titre, état, valeur du livre</p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Analyse impossible</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-2 px-3 bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Réessayer
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'result' && result) {
    const isOk = !result.is_rejected;
    // ✅ Titre de rejet dépendant du code
    const rejectTitle =
      result.rejection_code === 'not_in_program'
        ? 'Livre rejeté — pas au programme'
        : result.rejection_code === 'niveau_primaire'
        ? 'Livre rejeté — Maternelle/Primaire'
        : result.rejection_code === 'non_reusable_workbook'
        ? 'Livre rejeté — cahier consommable'
        : result.rejection_code === 'value_zero'
        ? 'Livre rejeté — valeur nulle'
        : 'Livre rejeté — trop dégradé';
    return (
      <div className={`rounded-2xl p-4 border ${isOk ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-start gap-2 mb-2">
          {isOk
            ? <Check className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold leading-tight ${isOk ? 'text-emerald-900' : 'text-red-800'}`}>
              {isOk ? 'Livre accepté' : rejectTitle}
            </p>
            <p className="text-xs text-gray-700 truncate mt-0.5">{result.titre}</p>
            {!isOk && result.rejection_message && (
              <p className="text-[11px] text-red-700 mt-1 leading-snug">
                {result.rejection_message}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
          <div className="bg-white rounded-lg px-2 py-1.5">
            <p className="text-gray-500">État détecté</p>
            <p className={`font-semibold ${
              result.etat_classification === 'bon' ? 'text-emerald-700'
                : result.etat_classification === 'acceptable' ? 'text-amber-700'
                : 'text-red-700'
            }`}>
              {result.etat_classification === 'bon' ? 'Bon état'
                : result.etat_classification === 'acceptable' ? 'État acceptable'
                : 'Rejeté'}
            </p>
          </div>
          <div className="bg-white rounded-lg px-2 py-1.5">
            <p className="text-gray-500">Crédit estimé</p>
            <p className="font-semibold text-amber-700">
              {result.valeur_calculee > 0
                ? `${Math.round(result.valeur_calculee * 0.70).toLocaleString('fr-FR')} XAF`
                : '—'}
            </p>
          </div>
        </div>
        {!isOk && (
          <button
            onClick={reset}
            className="mt-3 w-full py-2 px-3 bg-white border border-red-200 text-red-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Réessayer avec une autre photo
          </button>
        )}
      </div>
    );
  }

  // step === 'idle' ou 'recto-taken' (en attente du verso)
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-4">
      <p className="text-xs font-semibold text-gray-700 mb-1">
        {step === 'idle'
          ? 'Photographiez votre livre — recto puis verso'
          : 'Maintenant le verso (couverture arrière)'}
      </p>
      <p className="text-[11px] text-gray-500 mb-3">
        Yukpo analyse automatiquement le titre, l'état et la valeur de votre livre.
      </p>

      {/* Inputs cachés — déclenchés au clic */}
      <input
        ref={rectoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleRecto(e.target.files?.[0])}
      />
      <input
        ref={versoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleVerso(e.target.files?.[0])}
      />

      <div className="grid grid-cols-2 gap-2">
        {/* Recto */}
        <button
          onClick={() => rectoInputRef.current?.click()}
          disabled={step !== 'idle'}
          className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border-2 ${
            rectoBase64
              ? 'border-emerald-300 bg-emerald-50'
              : step === 'idle'
              ? 'border-amber-300 bg-amber-50 active:bg-amber-100'
              : 'border-gray-200 bg-gray-50 opacity-50'
          }`}
        >
          {rectoBase64
            ? <Check className="w-5 h-5 text-emerald-600" />
            : <Camera className="w-5 h-5 text-amber-600" />}
          <span className="text-[11px] font-semibold text-gray-800">Recto</span>
          {rectoBase64 && <span className="text-[10px] text-emerald-700">Capturé ✓</span>}
        </button>

        {/* Verso */}
        <button
          onClick={() => versoInputRef.current?.click()}
          disabled={!rectoBase64}
          className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border-2 ${
            versoBase64
              ? 'border-emerald-300 bg-emerald-50'
              : rectoBase64
              ? 'border-amber-300 bg-amber-50 active:bg-amber-100'
              : 'border-gray-200 bg-gray-50 opacity-50'
          }`}
        >
          {versoBase64
            ? <Check className="w-5 h-5 text-emerald-600" />
            : rectoBase64
            ? <Camera className="w-5 h-5 text-amber-600" />
            : <ImageIcon className="w-5 h-5 text-gray-300" />}
          <span className="text-[11px] font-semibold text-gray-800">Verso</span>
          {versoBase64 && <span className="text-[10px] text-emerald-700">Capturé ✓</span>}
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
        >
          <X className="w-3 h-3" /> Annuler
        </button>
      )}
    </div>
  );
};

export default BookPhotoCapture;
