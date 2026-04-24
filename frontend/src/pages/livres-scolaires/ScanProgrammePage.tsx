import {
  AlertCircle, ArrowLeft, BookOpen, Camera, CheckSquare,
  ChevronRight, FileText, Image as ImageIcon, Loader2,
  Minus, ShoppingCart, Upload, X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import {
  CLASSES_PAR_SYSTEME_NIVEAU, NIVEAUX_PAR_SYSTEME,
  Systeme, TypeItem, useParentShop,
  Enfant,
} from '../../hooks/useParentShop';
import { apiGet } from '../../services/apiService';

interface ExtractedItem {
  titre: string;
  auteur?: string;
  matiere?: string;
  editeur?: string;
  type: TypeItem;
  quantite?: number;
  selected: boolean;
}

interface ScanDetection {
  etablissement?: string | null;
  ville?: string | null;
  session?: string | null;
  classe?: string | null;
  session_attendue?: string | null;
  session_coherente?: boolean | null;
  classe_coherente?: boolean | null;
}

type Step = 'pick' | 'details' | 'uploading' | 'results' | 'done';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Images only: resize to max 1200px and compress to 70% JPEG to stay under proxy limits
    if (file.type.startsWith('image/')) {
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
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
      };
      img.onerror = reject;
      img.src = url;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}

const ANNEE_SCOLAIRE = '2025-2026';

const ScanProgrammePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { enfants, addItems, addEnfant } = useParentShop();

  const enfantId = searchParams.get('enfantId') || enfants[0]?.id || '';
  const [selectedEnfantId, setSelectedEnfantId] = useState(enfantId);
  const activeEnfant = enfants.find(e => e.id === selectedEnfantId);

  /* ── État ── */
  const [step, setStep] = useState<Step>('pick');
  const [files, setFiles] = useState<File[]>([]);
  const [etablissement, setEtablissement] = useState('');
  const [systeme, setSysteme] = useState<Systeme>(
    activeEnfant?.systeme ?? 'francophone'
  );
  const [niveau, setNiveau] = useState(
    activeEnfant?.niveau ?? 'Collège / Lycée'
  );
  const [classe, setClasse] = useState(activeEnfant?.classe ?? '');
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [detection, setDetection] = useState<ScanDetection | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickClasse, setQuickClasse] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const niveaux = NIVEAUX_PAR_SYSTEME[systeme];
  const classes = CLASSES_PAR_SYSTEME_NIVEAU[systeme][niveau] ?? [];

  const handleSystemeChange = (s: Systeme) => {
    setSysteme(s);
    const def = NIVEAUX_PAR_SYSTEME[s][2] ?? NIVEAUX_PAR_SYSTEME[s][1] ?? NIVEAUX_PAR_SYSTEME[s][0];
    setNiveau(def);
    setClasse('');
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (arr.length === 0) return;
    setFiles(prev => [...prev, ...arr].slice(0, 5));
    setStep('details');
  };

  const removeFile = (i: number) => {
    setFiles(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length === 0) setStep('pick');
      return next;
    });
  };

  const toggleItem = (idx: number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  const selectAll = () => setItems(prev => prev.map(it => ({ ...it, selected: true })));
  const deselectAll = () => setItems(prev => prev.map(it => ({ ...it, selected: false })));
  const allSelected = items.length > 0 && items.every(it => it.selected);
  const selectedCount = items.filter(it => it.selected).length;

  const fetchProgrammesFallback = async (): Promise<ExtractedItem[]> => {
    try {
      const params = new URLSearchParams({ niveau });
      if (classe) params.set('classe', classe);
      const r = await fetch(`/api/bourse-livre/v2/programmes?${params}`);
      const d = await r.json().catch(() => ({}));
      const list: any[] = d?.programmes || [];
      return list.map((m: any) => ({
        titre: m.titre_livre || m.titre || 'Manuel',
        auteur: m.auteur_livre || m.auteur,
        matiere: m.matiere,
        editeur: m.editeur_livre || m.editeur,
        type: 'livre' as TypeItem,
        quantite: 1,
        selected: true,
      }));
    } catch { return []; }
  };

  const pollJobStatus = async (jobId: string, classeQuery: string): Promise<void> => {
    const MAX_POLLS = 40; // 40 × 3s = 2 minutes max
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const r = await fetch(`/api/bourse-livre/v2/programmes-scolaires/status/${jobId}`);
        const d = await r.json().catch(() => ({}));
        if (d?.status === 'done') {
          let raw: any[] = d?.manuels || [];
          // Fallback : si le job ne retourne rien, interroger le référentiel existant
          if (raw.length === 0) {
            const fallback = await fetchProgrammesFallback();
            if (fallback.length > 0) {
              setItems(fallback);
              setStep('results');
              return;
            }
          }
          const fromJob: ExtractedItem[] = raw.map((m: any) => ({
            titre: m.titre_livre || m.titre || 'Manuel',
            auteur: m.auteur_livre || m.auteur,
            matiere: m.matiere,
            editeur: m.editeur_livre || m.editeur,
            type: (m.type as TypeItem) || 'livre',
            quantite: 1,
            selected: true,
          }));
          setItems(fromJob);
          if (d?.detection) setDetection(d.detection as ScanDetection);
          setStep(fromJob.length > 0 ? 'results' : 'done');
          return;
        }
        if (d?.status === 'error') {
          setError(d?.message || "Erreur lors de l'analyse. Réessayez.");
          setStep('details');
          return;
        }
        // status === 'processing' → continue polling
      } catch { /**/ }
    }
    setError("L'analyse a pris trop de temps. Réessayez avec une image plus petite.");
    setStep('details');
  };

  const submit = async () => {
    setStep('uploading');
    setError('');
    try {
      const fichiers = await Promise.all(
        files.map(async f => ({
          nom: f.name,
          type: f.type || 'application/octet-stream',
          base64: await fileToBase64(f),
        }))
      );

      const payload = {
        nom_etablissement: etablissement.trim() || 'Établissement non précisé',
        niveaux: [niveau],
        annee_scolaire: ANNEE_SCOLAIRE,
        pays: 'Cameroun',
        commentaire: classe ? `Classe : ${classe}` : '',
        fichiers,
      };

      const token = localStorage.getItem('token');
      const res = await fetch('/api/bourse-livre/v2/programmes-scolaires/submit', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(30000),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 202 && data?.job_id) {
        // Lancement asynchrone : interroger le statut toutes les 3s
        await pollJobStatus(data.job_id, classe || niveau);
        return;
      }

      if (!res.ok) {
        const msg = data?.message || data?.error || data?.detail;
        setError(msg || `Erreur serveur (${res.status}). Réessayez.`);
        setStep('details');
        return;
      }

      // Réponse synchrone (compatibilité) — utilise les manuels du job directement
      const raw: any[] = data?.manuels || [];
      const fromJob: ExtractedItem[] = raw.map((m: any) => ({
        titre: m.titre || 'Manuel',
        auteur: m.auteur,
        matiere: m.matiere,
        editeur: m.editeur,
        type: (m.type as TypeItem) || 'livre',
        quantite: 1,
        selected: true,
      }));
      setItems(fromJob);
      if (data?.detection) setDetection(data.detection as ScanDetection);
      setStep(fromJob.length > 0 ? 'results' : 'done');
    } catch (e: any) {
      const isTimeout = e?.name === 'AbortError' || e?.name === 'TimeoutError';
      setError(
        isTimeout
          ? "L'analyse a pris trop de temps. Réessayez avec une image plus petite."
          : (e?.message && !e.message.includes('fetch')
              ? e.message
              : 'Impossible de joindre le serveur Yukpo. Vérifiez votre connexion.')
      );
      setStep('details');
    }
  };

  const doAddToCart = (enfantId: string) => {
    const selected = items.filter(it => it.selected);
    if (!selected.length) { toast({ title: 'Sélectionnez au moins un article', variant: 'destructive' }); return; }
    setSaving(true);
    addItems(selected.map(it => ({
      enfantId,
      titre: it.titre,
      auteur: it.auteur,
      matiere: it.matiere,
      type: it.type,
      editeur: it.editeur,
      choix: 'indifferent' as const,
    })));
    setSaving(false);
    toast({ title: `${selected.length} article${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} à votre sélection` });
    navigate('/recap');
  };

  const addToCart = () => {
    if (!selectedEnfantId) { toast({ title: 'Sélectionnez une classe', variant: 'destructive' }); return; }
    doAddToCart(selectedEnfantId);
  };

  const addChildAndCart = () => {
    if (!quickClasse) {
      toast({ title: 'Sélectionnez la classe', variant: 'destructive' });
      return;
    }
    const childNiveau = Object.entries(CLASSES_PAR_SYSTEME_NIVEAU[systeme]).find(([, cls]) =>
      cls.includes(quickClasse)
    )?.[0] ?? niveau;
    const newEnfant: Enfant = addEnfant({ prenom: quickClasse, systeme, niveau: childNiveau, classe: quickClasse });
    setSelectedEnfantId(newEnfant.id);
    doAddToCart(newEnfant.id);
  };

  /* ────────────────────────────────────────────────
     STEP 1 — PICK  (plein écran, upload immédiat)
  ──────────────────────────────────────────────── */
  if (step === 'pick') {
    return (
      <div className="min-h-screen bg-amber-600 flex flex-col">
        {/* inputs cachés */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-10 pb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider text-white">YUKPO</span>
            <h1 className="font-bold text-xl text-white leading-tight mt-1">Scanner une liste de classe</h1>
          </div>
        </div>

        {/* Corps — 3 grands boutons */}
        <div className="flex-1 bg-white rounded-t-3xl px-5 pt-8 pb-12 flex flex-col gap-4">
          <p className="text-sm text-gray-500 text-center mb-2">
            Choisissez comment importer votre liste scolaire
          </p>

          {/* Caméra */}
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-5 bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-5 active:bg-amber-100 text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0">
              <Camera className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base">Prendre une photo</p>
              <p className="text-xs text-gray-500 mt-0.5">Photographiez la liste reçue de l'école</p>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400 shrink-0" />
          </button>

          {/* Galerie */}
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-5 bg-blue-50 border-2 border-blue-200 rounded-2xl px-5 py-5 active:bg-blue-100 text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center shrink-0">
              <ImageIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base">Depuis la galerie</p>
              <p className="text-xs text-gray-500 mt-0.5">Sélectionnez une photo déjà prise</p>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-400 shrink-0" />
          </button>

          {/* PDF / Fichier */}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-5 bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-5 py-5 active:bg-emerald-100 text-left"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base">PDF ou fichier</p>
              <p className="text-xs text-gray-500 mt-0.5">Importez un PDF, Excel ou image</p>
            </div>
            <ChevronRight className="w-5 h-5 text-emerald-400 shrink-0" />
          </button>

          <p className="text-center text-xs text-gray-400 mt-2">
            Yukpo analyse la liste et l'enregistre pour tous les parents de la même classe
          </p>
        </div>
      </div>
    );
  }

  /* ────────────────────────────────────────────────
     STEP 2 — DETAILS  (fichiers sélectionnés + infos)
  ──────────────────────────────────────────────── */
  if (step === 'details') {
    return (
      <div className="min-h-screen bg-gray-50">
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />

        {/* Header */}
        <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('pick')} className="p-2 rounded-full bg-white/20">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">YUKPO</span>
              <h1 className="font-bold text-lg leading-tight mt-0.5">
                {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
              </h1>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 pb-36 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl p-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Analyse impossible</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
                <p className="text-xs text-red-400 mt-1">Astuce : photo bien éclairée et nette</p>
              </div>
            </div>
          )}

          {/* Aperçu fichiers */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                {f.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(f)} alt={f.name}
                    className="w-12 h-12 object-cover rounded-xl shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-red-400" />
                  </div>
                )}
                <p className="flex-1 text-xs text-gray-700 font-medium truncate">{f.name}</p>
                <button onClick={() => removeFile(i)} className="p-1.5 rounded-full bg-gray-100">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            ))}
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-amber-300 rounded-xl text-amber-600 text-xs font-semibold"
            >
              <Camera className="w-4 h-4" /> Ajouter une autre photo
            </button>
          </div>

          {/* Pour quelle classe */}
          {enfants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pour quelle classe ?</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {enfants.map(e => (
                  <button key={e.id} onClick={() => {
                    setSelectedEnfantId(e.id);
                    setSysteme(e.systeme ?? 'francophone');
                    setNiveau(e.niveau);
                    setClasse(e.classe);
                  }}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${
                      selectedEnfantId === e.id
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}>
                    <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-xs">{e.classe[0]}</span>
                    {e.classe} <span className="text-xs opacity-70">{e.niveau}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Système + Niveau + Classe (compacts) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Précisions <span className="font-normal normal-case text-gray-400">(optionnel)</span></p>

            <div>
              <p className="text-xs text-gray-500 mb-1.5">Système</p>
              <div className="flex gap-2">
                {(['francophone', 'anglophone'] as Systeme[]).map(s => (
                  <button key={s} onClick={() => handleSystemeChange(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                      systeme === s ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {s === 'francophone' ? '🇫🇷 Francophone' : '🇬🇧 Anglophone'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1.5">Niveau</p>
              <div className="flex flex-wrap gap-1.5">
                {niveaux.map(n => (
                  <button key={n} onClick={() => { setNiveau(n); setClasse(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      niveau === n ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {classes.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Classe</p>
                <div className="flex flex-wrap gap-1.5">
                  {classes.map(c => (
                    <button key={c} onClick={() => setClasse(prev => prev === c ? '' : c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        classe === c ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              placeholder="Nom de l'établissement (optionnel)"
              value={etablissement}
              onChange={e => setEtablissement(e.target.value)}
            />
          </div>
        </div>

        {/* CTA sticky */}
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40">
          <button onClick={submit}
            className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg">
            <Upload className="w-5 h-5" />
            Analyser avec Yukpo
          </button>
        </div>
      </div>
    );
  }

  /* ── LOADING ── */
  if (step === 'uploading') {
    return (
      <div className="min-h-screen bg-amber-600 flex flex-col items-center justify-center text-white px-6">
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-6">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
        </div>
        <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full tracking-widest mb-3">YUKPO</span>
        <h2 className="text-xl font-bold mb-2 text-center">Analyse en cours…</h2>
        <p className="text-amber-100 text-sm text-center leading-relaxed">
          Yukpo lit votre liste et enregistre les manuels pour tous les parents de la même classe.
        </p>
      </div>
    );
  }

  /* ── DONE ── */
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 text-amber-600" />
        </div>
        <span className="text-xs font-bold text-amber-600 tracking-widest mb-2">YUKPO</span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Liste enregistrée !</h2>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Yukpo a analysé et enregistré votre liste.<br />
          Les autres parents de <strong>{classe || niveau}</strong> en bénéficieront aussi.
        </p>
        <button onClick={() => navigate('/parent-selection')}
          className="bg-amber-500 text-white font-bold px-6 py-3 rounded-2xl text-sm">
          Retour à mes achats
        </button>
      </div>
    );
  }

  /* ── RESULTS ── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setStep('details')} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">YUKPO</span>
            <h1 className="font-bold text-lg leading-tight mt-0.5">
              {items.length} manuel{items.length > 1 ? 'x' : ''} trouvé{items.length > 1 ? 's' : ''}
            </h1>
            <p className="text-amber-100 text-xs">Sélectionnez ce que vous voulez acheter</p>
          </div>
        </div>
        <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
          <span className="text-white text-sm font-medium">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</span>
          <button onClick={allSelected ? deselectAll : selectAll}
            className="flex items-center gap-1 text-amber-100 text-xs font-semibold">
            {allSelected ? <Minus className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-36 max-w-2xl mx-auto">
        {/* Bandeau de vérification post-scan (métadonnées détectées par l'IA) */}
        {detection && (detection.etablissement || detection.ville || detection.session || detection.classe) && (
          <div className="mb-4 bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <p className="text-sm font-semibold text-gray-900">Vérifiez les informations détectées</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {detection.etablissement && (
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">École</p>
                  <p className="font-semibold text-gray-800 truncate">{detection.etablissement}</p>
                </div>
              )}
              {detection.ville && (
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-gray-500">Ville</p>
                  <p className="font-semibold text-gray-800 truncate">{detection.ville}</p>
                </div>
              )}
              {detection.session && (
                <div className={`rounded-lg p-2 ${detection.session_coherente === false ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <p className="text-gray-500">Session</p>
                  <p className={`font-semibold truncate ${detection.session_coherente === false ? 'text-red-700' : 'text-gray-800'}`}>
                    {detection.session}
                    {detection.session_coherente === false && detection.session_attendue && (
                      <span className="block text-[10px] text-red-500 font-normal">Attendue : {detection.session_attendue}</span>
                    )}
                  </p>
                </div>
              )}
              {detection.classe && (
                <div className={`rounded-lg p-2 ${detection.classe_coherente === false ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <p className="text-gray-500">Classe</p>
                  <p className={`font-semibold truncate ${detection.classe_coherente === false ? 'text-red-700' : 'text-gray-800'}`}>
                    {detection.classe}
                    {detection.classe_coherente === false && (
                      <span className="block text-[10px] text-red-500 font-normal">≠ classe sélectionnée ({niveau})</span>
                    )}
                  </p>
                </div>
              )}
            </div>
            {(detection.session_coherente === false || detection.classe_coherente === false) && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
                ⚠️ Une incohérence a été détectée. Vérifiez que la liste correspond bien à la classe choisie.
              </p>
            )}
          </div>
        )}

        {/* Aucune classe enregistrée → sélection de classe inline */}
        {enfants.length === 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Pour quelle classe ?</p>
            <div className="flex flex-wrap gap-1.5">
              {(CLASSES_PAR_SYSTEME_NIVEAU[systeme][niveau] ?? []).map(c => (
                <button key={c} onClick={() => setQuickClasse(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    quickClasse === c ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
        )}

        {enfants.length > 1 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ajouter pour</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {enfants.map(e => (
                <button key={e.id} onClick={() => setSelectedEnfantId(e.id)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${
                    selectedEnfantId === e.id
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}>
                  {e.prenom} <span className="text-xs opacity-70">{e.classe}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {items.map((item, i) => (
            <button key={i} onClick={() => toggleItem(i)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border transition-colors text-left ${
                item.selected ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-100'
              }`}>
              <div className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                item.selected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
              }`}>
                {item.selected && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight ${item.selected ? 'text-amber-900' : 'text-gray-800'}`}>
                  {item.titre}
                </p>
                {item.auteur && <p className="text-xs text-gray-500 mt-0.5">{item.auteur}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {item.matiere && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.matiere}</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    item.type === 'livre' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    item.type === 'cahier' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>{item.type}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40 max-w-2xl mx-auto">
        <button
          disabled={selectedCount === 0 || saving}
          onClick={enfants.length === 0 ? addChildAndCart : addToCart}
          className="w-full bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
          Ajouter {selectedCount > 0 ? `${selectedCount} article${selectedCount > 1 ? 's' : ''}` : ''} à ma sélection
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      </div>
    </div>
  );
};

export default ScanProgrammePage;
