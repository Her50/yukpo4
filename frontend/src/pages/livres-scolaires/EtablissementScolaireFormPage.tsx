import { ArrowLeft, Camera, CheckCircle, FileText, Loader2, MapPin, Paperclip, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import { apiPost } from '../../services/apiService';

const NIVEAUX = [
  { id: 'maternelle', label: 'Maternelle' },
  { id: 'primaire', label: 'Primaire' },
  { id: 'college', label: 'Collège' },
  { id: 'lycee', label: 'Lycée / Secondaire' },
];

const CURRENT_YEAR = '2025-2026';
const YEARS = ['2025-2026', '2026-2027', '2024-2025'];

interface AttachedFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'document';
  base64: string;
  preview?: string;
}

const EtablissementScolaireFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const [nomEtab, setNomEtab] = useState('');
  const [pays, setPays] = useState('Cameroun');
  const [ville, setVille] = useState('');
  const [niveauxSel, setNiveauxSel] = useState<Set<string>>(new Set());
  const [anneeScolaire, setAnneeScolaire] = useState(CURRENT_YEAR);
  const [commentaire, setCommentaire] = useState('');
  const [gps, setGps] = useState<{ lat: number; lon: number; address?: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleNiveau = (id: string) => {
    setNiveauxSel(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleGPS = () => {
    if (!navigator.geolocation) { toast({ title: 'GPS non supporté', variant: 'destructive' }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
        toast({ title: 'Position GPS détectée' });
      },
      () => { setLocating(false); toast({ title: 'Position GPS indisponible', variant: 'destructive' }); }
    );
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf' | 'document') => {
    const fileList = Array.from(e.target.files || []);
    const newFiles: AttachedFile[] = await Promise.all(
      fileList.map(async f => {
        const base64 = await readFileAsBase64(f);
        const isImg = f.type.startsWith('image/');
        return {
          id: `${Date.now()}-${Math.random()}`,
          name: f.name,
          type: isImg ? 'image' : (f.type === 'application/pdf' ? 'pdf' : 'document'),
          base64,
          preview: isImg ? URL.createObjectURL(f) : undefined,
        };
      })
    );
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const handleSubmit = async () => {
    if (!nomEtab.trim()) { toast({ title: 'Nom requis', description: 'Saisissez le nom de l\'établissement', variant: 'destructive' }); return; }
    if (niveauxSel.size === 0) { toast({ title: 'Niveau requis', description: 'Sélectionnez au moins un niveau', variant: 'destructive' }); return; }
    if (files.length === 0) { toast({ title: 'Document requis', description: 'Ajoutez au moins un document (photo, PDF ou Excel)', variant: 'destructive' }); return; }
    if (!gps && !ville.trim()) { toast({ title: 'Localisation requise', description: 'Activez le GPS ou saisissez votre ville', variant: 'destructive' }); return; }

    setSubmitting(true);
    try {
      const payload = {
        nom_etablissement: nomEtab.trim(),
        pays: pays.trim() || undefined,
        ville: ville.trim() || undefined,
        niveaux: Array.from(niveauxSel),
        annee_scolaire: anneeScolaire,
        commentaire: commentaire.trim() || undefined,
        gps_coords: gps ? `${gps.lat},${gps.lon}` : undefined,
        fichiers: files.map(f => ({ nom: f.name, type: f.type, base64: f.base64 })),
      };
      const res = await apiPost('/api/bourse-livre/v2/programmes-scolaires/submit', payload);
      const data = await res.json();
      if (data?.success) {
        setSubmitted(true);
      } else {
        toast({ title: 'Erreur', description: data?.error || 'Impossible d\'envoyer', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-5 pb-24">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Manuels envoyés !</h2>
        <p className="text-sm text-gray-500 text-center mb-8 max-w-xs">
          Yukpo extrait vos manuels par IA et les ajoute au référentiel. Les librairies proches en sont informées.
        </p>
        <button
          onClick={() => { setSubmitted(false); setFiles([]); setNiveauxSel(new Set()); setCommentaire(''); }}
          className="w-full max-w-xs bg-amber-600 text-white py-3.5 rounded-xl font-semibold text-sm mb-3"
        >
          Envoyer une autre liste
        </button>
        <button
          onClick={() => navigate('/livres-scolaires')}
          className="w-full max-w-xs border-2 border-gray-200 text-gray-600 py-3.5 rounded-xl font-semibold text-sm"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 active:text-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight">Établissement scolaire</p>
          <p className="text-xs text-gray-400">Partagez vos listes de manuels</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          Envoyez votre liste de manuels scolaires (PDF, photo ou Excel). Yukpo l'analyse et la met à disposition des familles et librairies proches.
        </div>

        {/* Nom */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Nom de l'établissement *</label>
          <input
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            placeholder="Ex: Lycée Général Leclerc, École Publique Biyem-Assi..."
            value={nomEtab}
            onChange={e => setNomEtab(e.target.value)}
          />
        </div>

        {/* Pays + Ville */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Pays</label>
            <input
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              value={pays}
              onChange={e => setPays(e.target.value)}
              placeholder="Cameroun"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Ville *</label>
            <input
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              value={ville}
              onChange={e => setVille(e.target.value)}
              placeholder="Yaoundé..."
            />
          </div>
        </div>

        {/* Niveaux */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Niveaux dispensés *</label>
          <div className="grid grid-cols-2 gap-2">
            {NIVEAUX.map(n => (
              <button
                key={n.id}
                onClick={() => toggleNiveau(n.id)}
                className={`py-3 px-4 rounded-xl text-sm font-medium border-2 transition-colors text-left ${niveauxSel.has(n.id) ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-200 text-gray-600 bg-white'}`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* Année scolaire */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Année scolaire</label>
          <div className="flex gap-2">
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setAnneeScolaire(y)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${anneeScolaire === y ? 'bg-amber-600 text-white border-amber-600' : 'border-gray-200 text-gray-600 bg-white'}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* GPS */}
        <button
          onClick={handleGPS}
          disabled={locating}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 text-sm font-medium transition-colors ${gps ? 'border-green-500 bg-green-50 text-green-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}
        >
          <MapPin className="w-4 h-4" />
          {locating ? 'Localisation...' : gps ? `GPS : ${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}` : 'Utiliser ma position GPS'}
        </button>

        {/* Documents */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Listes de manuels * (photo, PDF, Excel)</label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <label className="flex flex-col items-center gap-1.5 py-4 bg-white border-2 border-dashed border-amber-300 rounded-2xl cursor-pointer active:bg-amber-50 text-center">
              <Camera className="w-5 h-5 text-amber-600" />
              <span className="text-xs text-amber-700 font-medium">Caméra</span>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFiles(e, 'image')} />
            </label>
            <label className="flex flex-col items-center gap-1.5 py-4 bg-white border-2 border-dashed border-blue-300 rounded-2xl cursor-pointer active:bg-blue-50 text-center">
              <Camera className="w-5 h-5 text-blue-600" />
              <span className="text-xs text-blue-700 font-medium">Galerie</span>
              <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e, 'image')} />
            </label>
            <label className="flex flex-col items-center gap-1.5 py-4 bg-white border-2 border-dashed border-purple-300 rounded-2xl cursor-pointer active:bg-purple-50 text-center">
              <Paperclip className="w-5 h-5 text-purple-600" />
              <span className="text-xs text-purple-700 font-medium">PDF/Excel</span>
              <input ref={docRef} type="file" accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple className="hidden" onChange={e => handleFiles(e, 'document')} />
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                  {f.preview ? (
                    <img src={f.preview} alt={f.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <p className="flex-1 text-xs text-gray-700 truncate">{f.name}</p>
                  <button onClick={() => removeFile(f.id)} className="p-1 text-gray-400 active:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commentaire */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Commentaire (optionnel)</label>
          <textarea
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
            rows={3}
            placeholder="Informations complémentaires sur les manuels..."
            value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-amber-600 active:bg-amber-700 text-white py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-200 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {submitting ? 'Envoi en cours...' : 'Envoyer les manuels'}
        </button>
      </div>
    </div>
  );
};

export default EtablissementScolaireFormPage;
