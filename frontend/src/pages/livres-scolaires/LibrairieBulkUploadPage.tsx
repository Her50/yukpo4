import {
  AlertCircle, ArrowLeft, Check, ChevronRight,
  FileText, Loader2, Package, Upload, X
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiPost } from '../../services/apiService';

interface LigneBulk {
  titre: string;
  auteur?: string;
  editeur?: string;
  isbn?: string;
  classe: string;
  matiere: string;
  prix_indicatif?: number;
  programme_scolaire_id?: number;
  programme_titre?: string;
  programme_prix_officiel?: string;
  match_score: number;
  matched: boolean;
  // contrôle libraire
  prix_vente?: number;
  stock?: number;
  include: boolean;
}

interface BulkResult {
  success: boolean;
  confidence: number;
  stats: { total_lignes: number; lignes_matchees: number; lignes_sans_match: number };
  lignes: LigneBulk[];
  annee_scolaire: string;
}

const ANNEES = ['2025-2026', '2026-2027', '2024-2025'];

const LibrairieBulkUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [annee, setAnnee] = useState(ANNEES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [lignes, setLignes] = useState<LigneBulk[]>([]);

  const toBase64 = (f: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(f);
    });

  const inferType = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'excel';
    return 'image';
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setLignes([]);
    setLoading(true);
    try {
      const b64 = await toBase64(f);
      const res = await apiPost('/api/bourse-livre/v2/libraire/bulk-upload', {
        fichier_base64: b64,
        file_type: inferType(f),
        annee_scolaire: annee,
      });
      const data: BulkResult = await res.json();
      if (!data.success) {
        toast({ title: 'Aucun article détecté', description: 'Essayez un fichier plus lisible.', variant: 'destructive' });
        return;
      }
      setResult(data);
      setLignes(data.lignes.map(l => ({ ...l, include: true, prix_vente: l.prix_indicatif ?? undefined })));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateLigne = (idx: number, patch: Partial<LigneBulk>) => {
    setLignes(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const handlePublish = async () => {
    const toPublish = lignes.filter(l => l.include);
    if (!toPublish.length) {
      toast({ title: 'Aucune ligne sélectionnée', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    try {
      const res = await apiPost('/api/bourse-livre/v2/libraire/publish', {
        livres: toPublish.map(l => ({
          programme_scolaire_id: l.programme_scolaire_id,
          titre: l.titre,
          auteur: l.auteur,
          editeur: l.editeur,
          isbn: l.isbn,
          classe: l.classe,
          matiere: l.matiere,
          niveau: null,
          prix: l.prix_vente ?? 0,
          devise: 'XAF',
          stock: l.stock ?? 1,
        })),
      });
      const data = await res.json();
      toast({
        title: `${data.total_published} article${data.total_published > 1 ? 's' : ''} publiés`,
        description: 'Votre catalogue est en ligne.',
      });
      navigate(-1);
    } catch (e: any) {
      toast({ title: 'Erreur publication', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const included = lignes.filter(l => l.include).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-emerald-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg">Upload catalogue librairie</h1>
            <p className="text-emerald-100 text-xs mt-0.5">
              Importez votre stock — Yukpo le matche avec le référentiel national
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-32 max-w-2xl mx-auto">
        {/* Année scolaire */}
        {!result && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
              Année scolaire
            </label>
            <div className="flex gap-2">
              {ANNEES.map(a => (
                <button
                  key={a}
                  onClick={() => setAnnee(a)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                    annee === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zone de dépôt */}
        {!result && (
          <div
            className="border-2 border-dashed border-emerald-300 rounded-2xl bg-emerald-50 p-8 flex flex-col items-center text-center cursor-pointer mb-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {loading ? (
              <>
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-3" />
                <p className="text-sm font-semibold text-emerald-700">Analyse en cours…</p>
                <p className="text-xs text-emerald-500 mt-1">L'IA identifie les articles et cherche les correspondances</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-emerald-400 mb-3" />
                <p className="font-semibold text-gray-800 text-sm">Déposer ou sélectionner un fichier</p>
                <p className="text-xs text-gray-500 mt-1">CSV, Excel, PDF ou photo · jusqu'à 10 Mo</p>
                {file && <p className="text-xs text-emerald-600 mt-2 font-medium">{file.name}</p>}
              </>
            )}
          </div>
        )}

        {/* Résultat */}
        {result && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Total', value: result.stats.total_lignes, color: 'text-gray-800' },
                { label: 'Matchés', value: result.stats.lignes_matchees, color: 'text-emerald-700' },
                { label: 'Sans match', value: result.stats.lignes_sans_match, color: 'text-orange-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 text-center">
                  <p className={`font-bold text-xl ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Confidence */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl mb-4 text-sm font-medium ${
              result.confidence >= 0.7 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : result.confidence >= 0.4 ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              Confiance IA : {Math.round(result.confidence * 100)}% — Vérifiez les lignes sans correspondance
            </div>

            {/* Table lignes */}
            <div className="space-y-2 mb-4">
              {lignes.map((ligne, idx) => (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl border shadow-sm p-4 ${ligne.include ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => updateLigne(idx, { include: !ligne.include })}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                        ligne.include ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                      }`}
                    >
                      {ligne.include && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{ligne.titre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ligne.classe} · {ligne.matiere}
                        {ligne.auteur && ` · ${ligne.auteur}`}
                      </p>
                      {ligne.matched ? (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                            <Check className="w-3 h-3" /> Matché
                          </span>
                          <span className="text-xs text-gray-400">{ligne.programme_titre}</span>
                          <span className="text-xs text-gray-400 ml-auto">{Math.round(ligne.match_score * 100)}%</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                          <X className="w-3 h-3" /> Sans correspondance
                        </span>
                      )}
                    </div>
                  </div>
                  {ligne.include && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex-1">
                        <label className="text-[11px] text-gray-400 uppercase tracking-wide block mb-1">Prix vente (FCFA)</label>
                        <input
                          type="number"
                          value={ligne.prix_vente ?? ''}
                          onChange={e => updateLigne(idx, { prix_vente: parseFloat(e.target.value) || 0 })}
                          placeholder={ligne.prix_indicatif?.toString() ?? '0'}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-[11px] text-gray-400 uppercase tracking-wide block mb-1">Stock</label>
                        <input
                          type="number"
                          value={ligne.stock ?? 1}
                          onChange={e => updateLigne(idx, { stock: parseInt(e.target.value) || 1 })}
                          min={1}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Relancer */}
            <button
              onClick={() => { setResult(null); setLignes([]); setFile(null); }}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-500 text-sm font-medium mb-2"
            >
              <Upload className="w-4 h-4" /> Importer un autre fichier
            </button>
          </>
        )}
      </div>

      {/* Bottom bar */}
      {result && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-2 z-40 bg-white border-t border-gray-100 shadow-xl">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handlePublish}
              disabled={publishing || included === 0}
              className="w-full bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2"
            >
              {publishing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Publication…</>
              ) : (
                <><Package className="w-5 h-5" /> Publier {included} article{included > 1 ? 's' : ''} <ChevronRight className="w-4 h-4 ml-auto" /></>
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-1.5">
              Seules les lignes cochées seront publiées dans votre catalogue
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibrairieBulkUploadPage;
