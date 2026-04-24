import {
  AlertCircle, ArrowLeft, BookOpen, Camera, CheckSquare,
  ChevronRight, Copy, FileText, Image as ImageIcon, Loader2,
  Minus, Plus, Search, ShoppingCart, Upload, X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import {
  Systeme, TypeItem, useParentShop,
  Enfant,
} from '../../hooks/useParentShop';
import {
  getSystemesForPays, getSystemeById, LISTE_PAYS_UNIQUES, type PaysCode,
} from '../../data/schoolSystems';
import { apiGet } from '../../services/apiService';

interface ExtractedItem {
  titre: string;
  auteur?: string;
  matiere?: string;
  editeur?: string;
  type: TypeItem;
  quantite: number;
  prix?: number;           // prix unitaire officiel en devise locale
  source?: 'scan' | 'suggestion'; // suggestion = proposition backend par défaut
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

type Step = 'pick' | 'details' | 'uploading' | 'results' | 'next-action' | 'done';

const DEVISE_LOCALE_PAR_PAYS: Record<string, string> = {
  CM: 'XAF', CI: 'XOF', SN: 'XOF', GA: 'XAF', CG: 'XAF', CD: 'CDF',
  BJ: 'XOF', TG: 'XOF', BF: 'XOF', ML: 'XOF', NE: 'XOF', NG: 'NGN', GH: 'GHS',
};

function formatPrix(prix: number | undefined, pays: string): string {
  if (!prix || prix <= 0) return '—';
  const devise = DEVISE_LOCALE_PAR_PAYS[pays] ?? 'XAF';
  return `${prix.toLocaleString('fr-FR')} ${devise}`;
}

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

  // Sélection pays / système / niveau / classe / série
  const [pays, setPays] = useState<PaysCode>(activeEnfant?.pays ?? 'CM');
  const [systemeId, setSystemeId] = useState(activeEnfant?.systemeId ?? 'CM-fr');
  const [niveauNom, setNiveauNom] = useState(activeEnfant?.niveau ?? '');
  const [classeNom, setClasseNom] = useState(activeEnfant?.classe?.split(' ')[0] ?? '');
  const [serieCode, setSerieCode] = useState(activeEnfant?.serie ?? '');

  const currentSystemeObj = getSystemeById(systemeId) ?? getSystemesForPays(pays)[0];
  const currentNiveaux = currentSystemeObj?.niveaux ?? [];
  const currentNiveauObj = currentNiveaux.find(n => n.nom === niveauNom);
  const currentClasseObj = currentNiveauObj?.classes.find(c => c.nom === classeNom);
  const hasClasseSeries = (currentClasseObj?.series?.length ?? 0) > 0;
  const classe = serieCode ? `${classeNom} ${serieCode}` : classeNom;
  const systeme: Systeme = currentSystemeObj?.langue === 'en' ? 'anglophone' : 'francophone';
  const niveau = niveauNom;

  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [detection, setDetection] = useState<ScanDetection | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickClasse, setQuickClasse] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handlePaysChange = (p: PaysCode) => {
    setPays(p);
    const newSystemes = getSystemesForPays(p);
    setSystemeId(newSystemes[0]?.id ?? '');
    const nv = newSystemes[0]?.niveaux ?? [];
    setNiveauNom(nv[2]?.nom ?? nv[0]?.nom ?? '');
    setClasseNom(''); setSerieCode('');
  };

  const handleSystemeIdChange = (id: string) => {
    setSystemeId(id);
    const s = getSystemeById(id);
    const nv = s?.niveaux ?? [];
    setNiveauNom(nv[2]?.nom ?? nv[0]?.nom ?? '');
    setClasseNom(''); setSerieCode('');
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (arr.length === 0) return;
    const merged = [...files, ...arr].slice(0, 5);
    setFiles(merged);
    // Lancer l'analyse immédiatement sans attendre le bouton
    submitWithFiles(merged);
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
  const adjustQuantite = (idx: number, delta: number) =>
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, quantite: Math.max(1, (it.quantite ?? 1) + delta) }
      : it));
  const duplicateItem = (idx: number) =>
    setItems(prev => {
      const src = prev[idx];
      if (!src) return prev;
      const copy: ExtractedItem = { ...src, quantite: 1, selected: true };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  const allSelected = items.length > 0 && items.every(it => it.selected);
  const selectedCount = items.filter(it => it.selected).length;
  const totalEstime = items
    .filter(it => it.selected && it.prix && it.prix > 0)
    .reduce((sum, it) => sum + (it.prix ?? 0) * (it.quantite ?? 1), 0);

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
        type: (m.type as TypeItem) || 'livre',
        quantite: typeof m.quantite_defaut === 'number' ? m.quantite_defaut : 1,
        prix: parseFloat(m.prix_officiel ?? m.prix ?? '') || undefined,
        source: m.source === 'suggestion' ? 'suggestion' : 'scan',
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
            quantite: typeof m.quantite_defaut === 'number' ? m.quantite_defaut : 1,
            prix: typeof m.prix_officiel === 'number' ? m.prix_officiel : parseFloat(m.prix_officiel ?? '') || undefined,
            source: m.source === 'suggestion' ? 'suggestion' : 'scan',
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

  const submitWithFiles = async (filesToUpload: File[]) => {
    setStep('uploading');
    setError('');
    try {
      const fichiers = await Promise.all(
        filesToUpload.map(async f => ({
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
        await pollJobStatus(data.job_id, classe || niveau);
        return;
      }

      if (!res.ok) {
        const msg = data?.message || data?.error || data?.detail;
        setError(msg || `Erreur serveur (${res.status}). Réessayez.`);
        setStep('details');
        return;
      }

      const raw: any[] = data?.manuels || [];
      const fromJob: ExtractedItem[] = raw.map((m: any) => ({
        titre: m.titre || 'Manuel',
        auteur: m.auteur,
        matiere: m.matiere,
        editeur: m.editeur,
        type: (m.type as TypeItem) || 'livre',
        quantite: typeof m.quantite_defaut === 'number' ? m.quantite_defaut : 1,
        prix: typeof m.prix_officiel === 'number' ? m.prix_officiel : parseFloat(m.prix_officiel ?? '') || undefined,
        source: m.source === 'suggestion' ? 'suggestion' : 'scan',
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

  const submit = () => submitWithFiles(files);

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
      prixNeuf: it.prix,
      quantite: it.quantite ?? 1,
      choix: 'indifferent' as const,
    })));
    setSaving(false);
    toast({ title: `${selected.length} article${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} à votre sélection` });
    setStep('next-action');
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
    const newEnfant: Enfant = addEnfant({ prenom: quickClasse, systeme, niveau: niveauNom, classe: quickClasse, pays, systemeId });
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
                    if (e.pays) setPays(e.pays);
                    if (e.systemeId) setSystemeId(e.systemeId);
                    setNiveauNom(e.niveau);
                    setClasseNom(e.classe.split(' ')[0]);
                    setSerieCode(e.serie ?? '');
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

          {/* Pays + Système + Niveau + Classe (compacts) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Précisions <span className="font-normal normal-case text-gray-400">(optionnel)</span></p>

            {/* Pays */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Pays</p>
              <select
                value={pays}
                onChange={e => handlePaysChange(e.target.value as PaysCode)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-amber-400"
              >
                {LISTE_PAYS_UNIQUES.map(p => (
                  <option key={p.code} value={p.code}>{p.emoji} {p.label}</option>
                ))}
              </select>
            </div>

            {/* Système (si plusieurs pour ce pays) */}
            {getSystemesForPays(pays).length > 1 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Système</p>
                <div className="flex gap-2">
                  {getSystemesForPays(pays).map(s => (
                    <button key={s.id} onClick={() => handleSystemeIdChange(s.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                        systemeId === s.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                      }`}>
                      {s.systemeLabel}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Niveau */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Niveau</p>
              <div className="flex flex-wrap gap-1.5">
                {currentNiveaux.map(n => (
                  <button key={n.nom} onClick={() => { setNiveauNom(n.nom); setClasseNom(''); setSerieCode(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      niveauNom === n.nom ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {n.nom}
                  </button>
                ))}
              </div>
            </div>

            {/* Classe */}
            {currentNiveauObj && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Classe</p>
                <div className="flex flex-wrap gap-1.5">
                  {currentNiveauObj.classes.map(c => (
                    <button key={c.nom} onClick={() => { setClasseNom(prev => prev === c.nom ? '' : c.nom); setSerieCode(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        classeNom === c.nom ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                      }`}>
                      {c.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Série / Filière */}
            {currentClasseObj && hasClasseSeries && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Série / Filière</p>
                <div className="flex flex-wrap gap-1.5">
                  {currentClasseObj.series!.map(s => (
                    <button key={s.code} onClick={() => setSerieCode(prev => prev === s.code ? '' : s.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-baseline gap-1 ${
                        serieCode === s.code ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                      }`}>
                      <span className="font-bold">{s.code}</span>
                      {s.label && <span className={`text-[10px] ${serieCode === s.code ? 'text-white/80' : 'text-gray-400'}`}>{s.label}</span>}
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

  /* ── NEXT ACTION — après ajout, proposer scan autre classe ou récap ── */
  if (step === 'next-action') {
    const autresEnfants = enfants.filter(e => e.id !== selectedEnfantId);
    const resetForNewScan = () => {
      setFiles([]);
      setItems([]);
      setDetection(null);
      setEtablissement('');
      setError('');
      setStep('pick');
    };
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-amber-600 px-5 pt-12 pb-8 text-white text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold mb-1">Ajouté à votre sélection</h1>
          <p className="text-amber-100 text-sm">Que souhaitez-vous faire maintenant ?</p>
        </div>

        <div className="flex-1 px-5 pt-6 pb-10 max-w-2xl mx-auto w-full space-y-3">
          <button onClick={resetForNewScan}
            className="w-full flex items-center gap-4 bg-white border-2 border-amber-200 rounded-2xl px-4 py-4 active:bg-amber-50 text-left">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">Scanner une autre liste</p>
              <p className="text-xs text-gray-500">Pour un autre enfant ou une autre classe</p>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400" />
          </button>

          <button onClick={() => { setItems([]); setFiles([]); setStep('details'); }}
            className="w-full flex items-center gap-4 bg-white border-2 border-blue-200 rounded-2xl px-4 py-4 active:bg-blue-50 text-left">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center shrink-0">
              <Search className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">Rechercher le programme d'une autre classe</p>
              <p className="text-xs text-gray-500">Depuis le référentiel national / établissement</p>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-400" />
          </button>

          {autresEnfants.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                Vos autres enfants / classes
              </p>
              <div className="space-y-1.5">
                {autresEnfants.map(e => (
                  <button key={e.id} onClick={() => {
                    setSelectedEnfantId(e.id);
                    setItems([]); setFiles([]); setStep('details');
                  }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 text-left">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{e.prenom}</p>
                      <p className="text-xs text-gray-500">{e.classe}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => navigate('/recap')}
            className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg mt-6">
            <ShoppingCart className="w-5 h-5" />
            Terminer & voir mon récapitulatif
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
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
        {enfants.length === 0 && currentNiveauObj && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">Pour quelle classe ?</p>
            <div className="flex flex-wrap gap-1.5">
              {currentNiveauObj.classes.map(c => (
                <button key={c.nom} onClick={() => setQuickClasse(c.nom)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    quickClasse === c.nom ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}>{c.nom}</button>
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
            <div key={i}
              className={`w-full rounded-2xl border transition-colors ${
                item.selected ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-100'
              }`}>
              <div className="flex items-start gap-3 p-3.5">
                <button onClick={() => toggleItem(i)} className="shrink-0 mt-0.5" aria-label="Sélectionner">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                    item.selected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                  }`}>
                    {item.selected && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${item.selected ? 'text-amber-900' : 'text-gray-800'}`}>
                    {item.titre}
                  </p>
                  {item.auteur && <p className="text-xs text-gray-500 mt-0.5">{item.auteur}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {item.matiere && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.matiere}</span>
                    )}
                    {item.editeur && (
                      <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                        Éditeur : {item.editeur}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      item.type === 'livre' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      item.type === 'cahier' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      (item.type as any) === 'workbook' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>{item.type}</span>
                    {item.source === 'suggestion' && (
                      <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                        Suggéré
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustQuantite(i, -1)}
                        disabled={(item.quantite ?? 1) <= 1}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-40">
                        <Minus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <span className="text-sm font-semibold text-gray-800 w-7 text-center">{item.quantite ?? 1}</span>
                      <button onClick={() => adjustQuantite(i, 1)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button onClick={() => duplicateItem(i)}
                        className="ml-2 px-2 h-7 rounded-full bg-white border border-gray-200 flex items-center gap-1 text-xs text-gray-600"
                        title="Dupliquer (2e enfant, même livre)">
                        <Copy className="w-3 h-3" /> Dupliquer
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Prix unitaire</p>
                      <p className="text-sm font-bold text-amber-700">{formatPrix(item.prix, pays)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalEstime > 0 && (
          <div className="mt-4 bg-white border border-amber-200 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total estimé ({selectedCount} article{selectedCount > 1 ? 's' : ''})</span>
            <span className="text-lg font-bold text-amber-700">{formatPrix(totalEstime, pays)}</span>
          </div>
        )}
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
