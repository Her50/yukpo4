// ✅ Page admin Yukpo — Import du programme national depuis CSV
// Date : 2026-05-10
//
// Réservée aux comptes role=admin / super_admin.
// Permet à l'admin Yukpo de peupler rapidement les seeds officiels par pays
// (programme MINESEC pour le Cameroun, etc.) sans toucher la DB directement.
//
// Endpoint : POST /api/v2/admin/programme-national/import

import { ArrowLeft, Download, Loader2, ShieldCheck, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { LISTE_PAYS_UNIQUES } from '../../data/schoolSystems';
import { apiPost } from '../../services/apiService';

const ANNEES = (() => {
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return [`${y - 1}-${y}`, `${y}-${y + 1}`, `${y + 1}-${y + 2}`];
})();

const CSV_TEMPLATE_FR = `classe;niveau;matiere;titre_livre;auteur_livre;editeur_livre;type_article;prix_officiel;quantite_defaut;est_obligatoire
6e;Secondaire;Mathématiques;Maths 6e Vogue;Vogue;Vogue Education;livre;5500;1;oui
6e;Secondaire;Anglais;Sun shine 6e;;Diocès Cameroun;livre;4500;1;oui
6e;Secondaire;Général;Cahier 200p grands carreaux;;;cahier;500;6;oui`;

const CSV_TEMPLATE_EN = `classe;niveau;matiere;titre_livre;auteur_livre;editeur_livre;type_article;prix_officiel;quantite_defaut;est_obligatoire
Form 1;Secondary;Mathematics;Mathematics Form 1;;Pearson;livre;5500;1;oui
Form 1;Secondary;English;English Form 1;;Macmillan;livre;4500;1;oui
Form 1;Secondary;General;Notebook 200p large squares;;;cahier;500;6;oui`;

const AdminProgrammeNationalImportPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [pays, setPays] = useState('CM');
  const [annee, setAnnee] = useState(ANNEES[1]);
  const [systeme, setSysteme] = useState<'francophone' | 'anglophone' | ''>('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [csv, setCsv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    etablissement_national_id: number;
    inserted: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin';

  if (!authLoading && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <ShieldCheck className="w-14 h-14 text-amber-500 mb-3" />
        <h2 className="text-base font-bold text-gray-900 mb-2">Accès réservé aux administrateurs Yukpo</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Cette page permet d'importer un programme national officiel par pays.
          Connectez-vous avec un compte admin pour y accéder.
        </p>
        <button
          onClick={() => navigate('/etablissement-portal')}
          className="px-5 py-2 bg-emerald-500 text-white rounded-full text-sm font-semibold"
        >
          Retour
        </button>
      </div>
    );
  }

  const downloadTemplate = () => {
    const text = systeme === 'anglophone' ? CSV_TEMPLATE_EN : CSV_TEMPLATE_FR;
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-programme-national-${pays}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let text = reader.result as string;
      // Strip BOM si présent
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      setCsv(text);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const submit = async () => {
    if (!csv.trim()) {
      toast({ title: 'CSV vide', description: 'Collez ou chargez un CSV', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const body: any = { pays, annee_scolaire: annee, csv, mode };
      if (systeme) body.systeme_educatif = systeme;
      const res = await apiPost('/api/v2/admin/programme-national/import', body);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      setResult(d);
      toast({
        title: 'Import terminé',
        description: `${d.inserted} ajoutés · ${d.skipped} doublons · ${d.errors?.length || 0} erreurs`,
      });
    } catch (e: any) {
      toast({ title: "Erreur d'import", description: e?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const lineCount = csv.split('\n').filter(l => l.trim()).length;
  const dataLineCount = Math.max(0, lineCount - 1);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button
          onClick={() => navigate('/etablissement-portal')}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">Programme national</h1>
          <p className="text-xs text-gray-500 truncate">Import CSV — admin Yukpo</p>
        </div>
        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
          ADMIN
        </span>
      </div>

      <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
            Cible de l'import
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">Pays *</label>
              <select
                value={pays}
                onChange={e => setPays(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                {LISTE_PAYS_UNIQUES.map(p => (
                  <option key={p.code} value={p.code}>{p.emoji} {p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">Année scolaire *</label>
              <select
                value={annee}
                onChange={e => setAnnee(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">
                Système éducatif (optionnel)
              </label>
              <select
                value={systeme}
                onChange={e => setSysteme(e.target.value as any)}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Auto (selon pays)</option>
                <option value="francophone">Francophone</option>
                <option value="anglophone">Anglophone</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as 'merge' | 'replace')}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                <option value="merge">Merge (n'écrase pas l'existant)</option>
                <option value="replace">Replace (désactive l'existant d'abord)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Données CSV
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"
                title="Télécharger un template CSV pré-rempli"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </button>
              <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Charger fichier
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileLoad}
                />
              </label>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">
            Séparateur <code>;</code> ou <code>,</code> (auto-détection). Colonnes :
            <code className="text-gray-700">
              {' '}classe (req), niveau, matiere, titre_livre (req), auteur_livre, editeur_livre,
              isbn_livre, type_article, prix_officiel, devise, quantite_defaut, est_obligatoire
            </code>.
            type_article ∈ <code>livre|workbook|cahier|fourniture|accessoire</code>.
          </p>

          <textarea
            value={csv}
            onChange={e => setCsv(e.target.value)}
            rows={14}
            placeholder={CSV_TEMPLATE_FR}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            {dataLineCount} ligne(s) de données détectées
          </p>
        </div>

        <button
          onClick={submit}
          disabled={submitting || !csv.trim()}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Importer le programme national
        </button>

        {result && (
          <div className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-emerald-800">Import terminé</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{result.inserted}</p>
                <p className="text-[10px] uppercase font-semibold text-emerald-700">Ajoutés</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-[10px] uppercase font-semibold text-amber-700">Doublons</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{result.errors?.length || 0}</p>
                <p className="text-[10px] uppercase font-semibold text-red-700">Erreurs</p>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <details className="bg-red-50 border border-red-200 rounded-xl p-3">
                <summary className="text-xs font-bold text-red-800 cursor-pointer">
                  Voir les {result.errors.length} erreur(s)
                </summary>
                <ul className="mt-2 text-[11px] text-red-700 space-y-1 max-h-60 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="font-mono">{e}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="text-[11px] text-gray-500">
              Établissement national cible : <code>{result.etablissement_national_id}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProgrammeNationalImportPage;
