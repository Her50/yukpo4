import {
  AlertTriangle, Camera, Check, ImageIcon, Loader2, RefreshCw, X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';

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
  /** Crédit net final pour le parent (= valeur × 0.75 − frais analyse IA).
   *  Calculé côté backend. À afficher directement, ne pas recalculer. */
  credit_net_xaf?: number;
  /** Frais d'analyse IA déduit du crédit (info, déjà appliqué dans credit_net_xaf). */
  llm_fee_xaf?: number;
  ratio_etat: number;
  etat_classification: 'bon' | 'acceptable' | 'rejete';
  is_rejected: boolean;
  /** Code court envoyé par le backend pour différencier les motifs de rejet :
   *  'not_in_program' | 'niveau_primaire' | 'non_reusable_workbook' |
   *  'price_missing' | 'isbn_missing' | 'duplicate_book' |
   *  'etat_too_damaged' | 'value_zero' | '' (accepté). */
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

/**
 * Calcule une empreinte rapide d'une image base64 pour détecter les doublons.
 * Stratégie : SHA-256 du contenu base64 (déterministe, rapide, gratuit côté CPU).
 * Si recto.hash === verso.hash → c'est exactement la même photo (même fichier
 * uploadé deux fois OU même capture caméra ré-utilisée). On rejette.
 *
 * Cas non-couvert : 2 photos différentes mais qui photographient la MÊME face
 * du livre (recto pris 2× depuis 2 angles légèrement différents). C'est au
 * backend de juger via l'IA (rejection_code 'recto_verso_same_side').
 */
async function imageHash(base64: string): Promise<string> {
  // base64 peut contenir le préfixe "data:image/...". On hash tout pour rester
  // simple — collision artificielle improbable car le préfixe est constant.
  const encoder = new TextEncoder();
  const data = encoder.encode(base64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const BookPhotoCapture: React.FC<BookPhotoCaptureProps> = ({
  sessionId, userLat, userLng, modeListing = 'troc',
  onAnalyzed, onCancel,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState<CaptureStep>('idle');
  const [rectoBase64, setRectoBase64] = useState<string | null>(null);
  const [versoBase64, setVersoBase64] = useState<string | null>(null);
  const [rectoHash, setRectoHash] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<AnalyzedBookResult | null>(null);
  /** Compteur de tentatives verso identiques au recto (pour ne pas spammer le user). */
  const [versoIdenticalTries, setVersoIdenticalTries] = useState(0);
  /** Timestamp du dernier clic re-recto. Si l'user re-clique dans la fenêtre
   *  CONFIRM_MS, on considère que c'est une confirmation explicite et on
   *  écrase. Sinon, premier re-clic = juste un toast d'avertissement (PAS
   *  de changement visuel du bouton — il reste en état "✓ capturé"). */
  const lastRectoReclickRef = useRef<number>(0);
  const CONFIRM_MS = 4000;

  const rectoInputRef = useRef<HTMLInputElement>(null);
  const versoInputRef = useRef<HTMLInputElement>(null);

  /** Click handler du bouton Recto :
   *   - 1er clic (pas encore capturé)        → ouvre la caméra
   *   - clic alors que recto déjà capturé    → toast warning, bouton inchangé
   *   - 2e clic dans les 4s suivantes        → confirme et écrase
   *  L'UX cible : si user clique recto par erreur au lieu de verso, il
   *  voit juste un toast l'informant qu'il a déjà un recto, sans que le
   *  bouton change visuellement. Pour vraiment remplacer il doit reclic. */
  const onRectoButtonClick = () => {
    if (!rectoBase64) {
      // Premier clic : ouvre la caméra directement.
      rectoInputRef.current?.click();
      return;
    }
    const now = Date.now();
    const elapsed = now - lastRectoReclickRef.current;
    if (elapsed > CONFIRM_MS) {
      // Premier re-clic depuis longtemps → on prévient avec un toast
      // SANS modifier l'état du bouton (le bouton reste "Recto ✓").
      lastRectoReclickRef.current = now;
      toast({
        title: t('bourse.bookCapture.toast_recto_already_title'),
        description: t('bourse.bookCapture.toast_recto_already_desc'),
      });
      return;
    }
    // 2e clic en moins de CONFIRM_MS → confirmation : on écrase.
    lastRectoReclickRef.current = 0;
    setRectoBase64(null);
    setRectoHash(null);
    setVersoBase64(null); // on invalide aussi le verso car il dépend du recto
    setVersoIdenticalTries(0);
    setStep('idle');
    setTimeout(() => rectoInputRef.current?.click(), 100);
  };

  /** Click handler du bouton Verso : autorisé seulement si recto présent. */
  const onVersoButtonClick = () => {
    if (!rectoBase64) {
      toast({
        title: t('bourse.bookCapture.toast_recto_first_title'),
        description: t('bourse.bookCapture.toast_recto_first_desc'),
        variant: 'destructive',
      });
      return;
    }
    if (versoBase64) {
      // Verso déjà capturé (avant analyze) → on autorise reprise.
      toast({
        title: t('bourse.bookCapture.toast_verso_already_title'),
        description: t('bourse.bookCapture.toast_verso_already_desc'),
      });
    }
    versoInputRef.current?.click();
  };

  const handleRecto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const b64 = await fileToCompressedBase64(file);
      const h = await imageHash(b64);
      setRectoBase64(b64);
      setRectoHash(h);
      setVersoIdenticalTries(0);
      setStep('recto-taken');
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Erreur capture recto');
      setStep('error');
    }
  };

  // ✅ 2026-05-14 : Plus d'auto-ouverture de l'input verso. La double tentative
  // 400ms+1200ms causait une race condition : si l'user cliquait verso
  // manuellement entre les deux, le 2e auto-click ré-ouvrait la caméra et
  // ANNULAIT la sélection en cours (bug "premier scan ne prend pas, faut
  // refaire"). L'user clique simplement sur le bouton Verso quand il est
  // prêt — c'est plus prévisible.

  const handleVerso = async (file: File | undefined) => {
    if (!file || !rectoBase64) return;
    try {
      const b64 = await fileToCompressedBase64(file);
      // ✅ Détection doublon hash-exact : même fichier uploadé pour recto et verso.
      // Cas typique : le user a re-uploadé la même image depuis la galerie,
      // OU caméra a réutilisé le buffer. On rejette client-side avant d'envoyer
      // au LLM (économie de token IA).
      const h = await imageHash(b64);
      if (rectoHash && h === rectoHash) {
        const nextTry = versoIdenticalTries + 1;
        setVersoIdenticalTries(nextTry);
        toast({
          title: t('bourse.bookCapture.toast_photo_identical_title'),
          description: nextTry >= 2
            ? t('bourse.bookCapture.toast_photo_identical_desc_strong')
            : t('bourse.bookCapture.toast_photo_identical_desc'),
          variant: 'destructive',
        });
        // On reste à 'recto-taken' pour que l'utilisateur reprenne le verso.
        return;
      }
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
        // ✅ Crédit net final calculé par le backend (× 0.75 − frais IA).
        //    Si absent (vieux backend), fallback à l'estimation locale × 0.75 − 40.
        credit_net_xaf: typeof data?.credit_net_xaf === 'number'
          ? data.credit_net_xaf
          : Math.max(0, Math.round((Number(data?.valeur_calculee ?? safeValue) || 0) * 0.75 - 40)),
        llm_fee_xaf: typeof data?.llm_fee_xaf === 'number' ? data.llm_fee_xaf : 40,
        ratio_etat: Number(data?.ratio_etat ?? ETAT_RATIO[normalizedEtat]),
        etat_classification: normalizedEtat,
        is_rejected: effectiveRejected,
        rejection_code: rejection_code || undefined,
        rejection_message: rejection_message || undefined,
      };
      setResult(finalResult);
      setStep('result');
      // ✅ 2026-05-15 : Toast info non bloquant si user a déjà scanné ce livre
      // 1 ou 2 fois (limite tolérée 3 pour fratrie). Le backend renvoie un
      // message info via `data.info_message`. Strictly informatif — le scan
      // est accepté et inclus dans le panier normalement.
      if (data?.info_message) {
        toast({
          title: t('bourse.bookCapture.toast_duplicate_warn_title', { defaultValue: 'Doublon détecté' }),
          description: String(data.info_message),
        });
      }
      // On notifie le parent même si rejeté — le parent décide d'inclure ou non.
      onAnalyzed(finalResult);
    } catch (e: any) {
      setError(e?.message || "Yukpo n'a pas pu analyser ce livre.");
      setStep('error');
    }
  };

  const reset = () => {
    setRectoBase64(null);
    setVersoBase64(null);
    setRectoHash(null);
    setVersoIdenticalTries(0);
    // 2026-06-28 — setter orphelin supprimé (state pendingRectoReplace n'existe
    // plus depuis le refactor flow recto/verso). Causait ReferenceError au
    // runtime quand l'utilisateur cliquait sur "Recommencer".
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
        <p className="text-sm font-semibold text-gray-800">{t('bourse.bookCapture.analyzing_title')}</p>
        <p className="text-xs text-gray-500 mt-1">{t('bourse.bookCapture.analyzing_desc')}</p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">{t('bourse.bookCapture.analysis_failed_title')}</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-2 px-3 bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('bourse.bookCapture.retry_other_photo')}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold"
            >
              {t('bourse.bookCapture.cancel')}
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
        : result.rejection_code === 'price_missing'
        ? 'Prix illisible — rescannez en zoomant sur le prix'
        : result.rejection_code === 'isbn_missing'
        ? 'ISBN illisible — rescannez la 4ème de couverture'
        : result.rejection_code === 'duplicate_book'
        ? 'Livre déjà scanné dans votre session'
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
              {(result.credit_net_xaf ?? 0) > 0
                ? `${Math.round(result.credit_net_xaf ?? 0).toLocaleString('fr-FR')} XAF`
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
          ? t('bourse.bookCapture.prompt_idle')
          : t('bourse.bookCapture.prompt_verso')}
      </p>
      <p className="text-[11px] text-gray-500 mb-3">
        {t('bourse.bookCapture.helper')}
      </p>

      {/* Inputs cachés — déclenchés au clic. value='' reset après chaque
          pick permet de re-sélectionner le MÊME fichier (sinon onChange ne
          se déclenche pas car la value n'a pas changé). Empêche le bug
          "premier scan ne prend pas, faut recommencer". */}
      <input
        ref={rectoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          handleRecto(f);
        }}
      />
      <input
        ref={versoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          handleVerso(f);
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        {/* Recto — toujours cliquable. Re-clic = toast warning (pas de
            changement visuel) ; 2e re-clic dans 4s = écrase et reprend. */}
        <button
          onClick={onRectoButtonClick}
          className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border-2 transition-colors ${
            rectoBase64
              ? 'border-emerald-300 bg-emerald-50 active:bg-emerald-100'
              : 'border-amber-300 bg-amber-50 active:bg-amber-100'
          }`}
        >
          {rectoBase64
            ? <Check className="w-5 h-5 text-emerald-600" />
            : <Camera className="w-5 h-5 text-amber-600" />}
          <span className="text-[11px] font-semibold text-gray-800">{t('bourse.bookCapture.recto_label')}</span>
          {rectoBase64 && (
            <span className="text-[10px] text-emerald-700">{t('bourse.bookCapture.captured_check')}</span>
          )}
        </button>

        {/* Verso — actif uniquement après recto. Re-clic autorise la reprise. */}
        <button
          onClick={onVersoButtonClick}
          className={`flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl border-2 transition-colors ${
            versoBase64
              ? 'border-emerald-300 bg-emerald-50 active:bg-emerald-100'
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
          <span className="text-[11px] font-semibold text-gray-800">{t('bourse.bookCapture.verso_label')}</span>
          {versoBase64 && <span className="text-[10px] text-emerald-700">{t('bourse.bookCapture.captured_check')}</span>}
          {!rectoBase64 && (
            <span className="text-[10px] text-gray-400">{t('bourse.bookCapture.after_recto')}</span>
          )}
        </button>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
        >
          <X className="w-3 h-3" /> {t('bourse.bookCapture.cancel')}
        </button>
      )}
    </div>
  );
};

export default BookPhotoCapture;
