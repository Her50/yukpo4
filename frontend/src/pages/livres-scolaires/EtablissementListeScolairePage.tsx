// ✅ Page admin — Liste scolaire d'un établissement
// Date : 2026-05-10
//
// Permet au directeur d'école de configurer la liste scolaire (livres,
// cahiers, fournitures, accessoires) par classe et par année.
//
// Fonctionnalités clés :
//  - Préchargement intelligent : programme national officiel, année précédente
//    de mon établissement, ou copie depuis un établissement similaire.
//  - Édition par classe (filtrée par les cycles offerts par l'établissement,
//    cf. config systeme_scolaire + cycles_offerts).
//  - Vue tabulée par type d'article (livres / cahiers / fournitures).
//
import {
  ArrowLeft, Book, Copy, CopyPlus, Download, Edit2, ExternalLink, Eye, FileText, GraduationCap, Loader2, NotebookPen,
  Package, Plus, RefreshCw, School, Sparkles, Trash2, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../services/apiService';
import {
  CycleId, SystemeScolaireDB,
  filtrerNiveauxParCycles, getSystemesPourEtablissement,
} from '../../data/etablissementSetup';
import {
  Classe, Niveau, PaysCode, SystemeScolaire,
} from '../../data/schoolSystems';

const TYPES_ARTICLE = [
  { id: 'livre',      labelKey: 'etabAdmin.listeScolaire.type_livre',      Icon: Book },
  { id: 'workbook',   labelKey: 'etabAdmin.listeScolaire.type_workbook',   Icon: NotebookPen },
  { id: 'cahier',     labelKey: 'etabAdmin.listeScolaire.type_cahier',     Icon: FileText },
  { id: 'fourniture', labelKey: 'etabAdmin.listeScolaire.type_fourniture', Icon: Package },
  { id: 'accessoire', labelKey: 'etabAdmin.listeScolaire.type_accessoire', Icon: GraduationCap },
] as const;

type TypeArticle = typeof TYPES_ARTICLE[number]['id'];

interface Article {
  id: number;
  niveau: string;
  classe: string;
  matiere: string;
  titre_livre: string;
  auteur_livre: string | null;
  editeur_livre: string | null;
  isbn_livre: string | null;
  annee_scolaire: string | null;
  est_obligatoire: boolean | null;
  prix_officiel: number | null;
  devise: string | null;
  type_article: TypeArticle;
  quantite_defaut: number;
  systeme_educatif: string;
  pays: string | null;
}

interface EtabConfig {
  id: number;
  nom_etablissement: string;
  nom_abrege: string | null;
  pays: string | null;
  systeme_scolaire: SystemeScolaireDB | null;
  cycles_offerts: string[];
  slug?: string | null;
}

interface PreloadSources {
  previous_years: string[];
  national: { etablissement_id: number; nom_etablissement: string; pays: string; nb_articles: number } | null;
  similar_etabs: Array<{
    id: number; nom_etablissement: string; nom_abrege: string | null;
    ville: string | null; pays: string; systeme_scolaire: string | null; nb_articles: number;
  }>;
}

const ANNEES_DISPO = (() => {
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return [
    `${y - 1}-${y}`,
    `${y}-${y + 1}`,
    `${y + 1}-${y + 2}`,
  ];
})();
const ANNEE_DEFAUT = ANNEES_DISPO[1];

const EtablissementListeScolairePage: React.FC = () => {
  const navigate = useNavigate();
  const { etabId = '' } = useParams();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [etab, setEtab] = useState<EtabConfig | null>(null);
  const [annee, setAnnee] = useState(ANNEE_DEFAUT);
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<PreloadSources | null>(null);
  const [activeClasseFull, setActiveClasseFull] = useState<string | null>(null);
  const [activeBilingue, setActiveBilingue] = useState<'fr' | 'en'>('fr');
  const [loading, setLoading] = useState(true);
  const [showArticleModal, setShowArticleModal] = useState<{
    classe: string; niveau: string; type: TypeArticle; article?: Article;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [etabsRes, progRes, srcRes] = await Promise.all([
        apiGet('/api/v2/admin/etablissement/mes-etablissements'),
        apiGet(`/api/v2/admin/etablissement/${etabId}/programmes?annee=${encodeURIComponent(annee)}`),
        apiGet(`/api/v2/admin/etablissement/${etabId}/programmes/preload-sources?target_annee=${encodeURIComponent(annee)}`),
      ]);
      const etabData = await etabsRes.json().catch(() => ({}));
      const myEtab = (etabData?.etablissements || []).find((e: any) => String(e.id) === etabId);
      setEtab(myEtab || null);

      const progData = await progRes.json().catch(() => ({}));
      setArticles(Array.isArray(progData?.programmes) ? progData.programmes : []);

      const srcData = await srcRes.json().catch(() => ({}));
      setSources(srcData?.previous_years ? srcData : null);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Chargement impossible', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [etabId, annee, toast]);

  useEffect(() => { load(); }, [load]);

  const systemes: SystemeScolaire[] = useMemo(() => {
    if (!etab) return [];
    const pays = (etab.pays || 'CM') as PaysCode;
    const systeme = (etab.systeme_scolaire || 'francophone') as SystemeScolaireDB;
    return getSystemesPourEtablissement(pays, systeme);
  }, [etab]);

  const isBilingue = etab?.systeme_scolaire === 'bilingue' && systemes.length >= 2;

  const systemeActif: SystemeScolaire | null = useMemo(() => {
    if (systemes.length === 0) return null;
    if (!isBilingue) return systemes[0];
    return systemes.find(s => s.langue === activeBilingue) || systemes[0];
  }, [systemes, isBilingue, activeBilingue]);

  const niveauxFiltres: Niveau[] = useMemo(() => {
    if (!systemeActif) return [];
    const cycles = (etab?.cycles_offerts || []) as CycleId[];
    return filtrerNiveauxParCycles(systemeActif, cycles);
  }, [systemeActif, etab?.cycles_offerts]);

  const articlesByClasse = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const a of articles) {
      const key = a.classe;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [articles]);

  const handlePreload = async (
    source: 'national' | 'previous_year' | 'etablissement',
    extra: { source_annee?: string; source_etab_id?: number } = {},
    sourceLabel = 'cette source',
    expectedCount?: number,
  ) => {
    // Confirmation explicite — l'admin doit savoir que des articles vont être
    // ajoutés massivement avant qu'on n'écrive en base.
    const countMsg = expectedCount != null
      ? t('etabAdmin.listeScolaire.preload_confirm_count', { count: expectedCount })
      : '';
    const ok = window.confirm(
      t('etabAdmin.listeScolaire.preload_confirm', { source: sourceLabel, annee }) +
      countMsg +
      t('etabAdmin.listeScolaire.preload_confirm_merge')
    );
    if (!ok) return;
    try {
      // Restreint les niveaux importés aux cycles offerts par l'établissement
      // (sinon on copie p.ex. les classes du lycée alors qu'on n'a que primaire+collège).
      // Exception : le programme national utilise des labels génériques (« Secondaire »)
      // qui ne matchent pas notre référentiel — on copie tout, l'admin filtrera ensuite.
      const niveauxAcceptes = source !== 'national' && niveauxFiltres.length > 0
        ? niveauxFiltres.map(n => n.nom)
        : undefined;
      const body: any = {
        source,
        target_annee: annee,
        mode: 'merge',
        ...(niveauxAcceptes ? { niveaux: niveauxAcceptes } : {}),
        ...extra,
      };
      const res = await apiPost(
        `/api/v2/admin/etablissement/${etabId}/programmes/preload`,
        body,
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      toast({
        title: t('etabAdmin.listeScolaire.preload_done_title'),
        description: t('etabAdmin.listeScolaire.preload_done_desc', {
          copied: d.copied, skipped: d.skipped_existing,
        }),
      });
      load();
    } catch (e: any) {
      toast({ title: t('etabAdmin.listeScolaire.preload_error'), description: e?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('etabAdmin.listeScolaire.article_delete_confirm'))) return;
    try {
      const res = await apiDelete(`/api/v2/admin/etablissement/${etabId}/programmes/${id}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      toast({ title: t('etabAdmin.listeScolaire.article_deleted') });
      load();
    } catch (e: any) {
      toast({ title: t('common.error'), description: e?.message, variant: 'destructive' });
    }
  };

  if (loading && !etab) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!etab) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">Établissement introuvable</p>
        <button
          onClick={() => navigate('/etablissement-portal')}
          className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-full text-sm"
        >
          Retour
        </button>
      </div>
    );
  }

  const showConfigBanner = !etab.systeme_scolaire || (etab.cycles_offerts || []).length === 0;
  const cyclesCount = etab.cycles_offerts?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button
          onClick={() => navigate(`/etablissement-portal/${etabId}`)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">{t('etabAdmin.listeScolaire.title')}</h1>
          <p className="text-xs text-gray-500 truncate">{etab.nom_etablissement}</p>
        </div>
        <select
          value={annee}
          onChange={e => setAnnee(e.target.value)}
          className="text-xs font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5"
        >
          {ANNEES_DISPO.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3">
        {/* Bandeau config requise */}
        {showConfigBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-amber-900 mb-1">
              {t('etabAdmin.listeScolaire.config_required_title')}
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              {t('etabAdmin.listeScolaire.config_required_desc')}
            </p>
            <button
              onClick={() => navigate(`/etablissement-portal/${etabId}?config=open`)}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-full"
            >
              <School className="w-3.5 h-3.5" />
              {t('etabAdmin.listeScolaire.config_button')}
            </button>
          </div>
        )}

        {/* Sources de préchargement */}
        {sources && articles.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              {t('etabAdmin.listeScolaire.preload_title')}
            </p>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              {t('etabAdmin.listeScolaire.preload_desc')}
            </p>
            <div className="space-y-2">
              {sources.previous_years.length > 0 && sources.previous_years.map(y => (
                <PreloadButton
                  key={y}
                  Icon={RefreshCw}
                  title={t('etabAdmin.listeScolaire.preload_previous', { year: y })}
                  desc={t('etabAdmin.listeScolaire.preload_previous_desc')}
                  color="violet"
                  onClick={() => handlePreload(
                    'previous_year',
                    { source_annee: y },
                    t('etabAdmin.listeScolaire.preload_previous', { year: y }),
                  )}
                />
              ))}
              {sources.national && (
                <PreloadButton
                  Icon={Sparkles}
                  title={t('etabAdmin.listeScolaire.preload_national', { pays: sources.national.pays })}
                  desc={t('etabAdmin.listeScolaire.preload_national_desc', { count: sources.national.nb_articles })}
                  color="emerald"
                  onClick={() => handlePreload(
                    'national',
                    {},
                    t('etabAdmin.listeScolaire.preload_national', { pays: sources.national!.pays }),
                    sources.national!.nb_articles,
                  )}
                />
              )}
              {sources.similar_etabs.slice(0, 3).map(s => (
                <PreloadButton
                  key={s.id}
                  Icon={Copy}
                  title={t('etabAdmin.listeScolaire.preload_etablissement', { name: s.nom_etablissement })}
                  desc={t('etabAdmin.listeScolaire.preload_etablissement_desc', {
                    ville: s.ville || s.pays,
                    count: s.nb_articles,
                  })}
                  color="indigo"
                  onClick={() => handlePreload(
                    'etablissement',
                    { source_etab_id: s.id },
                    s.nom_etablissement,
                    s.nb_articles,
                  )}
                />
              ))}
              <button
                onClick={() => navigate(`/etablissement-portal/${etabId}?ia=open`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50 active:bg-fuchsia-100 text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-fuchsia-200 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-fuchsia-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-fuchsia-900">{t('etabAdmin.listeScolaire.preload_ia')}</p>
                  <p className="text-xs text-fuchsia-700">{t('etabAdmin.listeScolaire.preload_ia_desc')}</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Onglets bilingue */}
        {isBilingue && (
          <div className="flex gap-2 bg-white p-1 rounded-2xl border border-gray-100">
            {systemes.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveBilingue(s.langue); setActiveClasseFull(null); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
                  activeBilingue === s.langue
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-600'
                }`}
              >
                {s.systemeLabel}
              </button>
            ))}
          </div>
        )}

        {/* Statistiques rapides — visible dès qu'au moins 1 article est saisi */}
        {!activeClasseFull && articles.length > 0 && (
          <StatsCard
            articles={articles}
            classesConfiguredCount={articlesByClasse.size}
            classesTotalCount={
              niveauxFiltres.reduce((s, n) => s + n.classes.length, 0)
            }
          />
        )}

        {/* Sélecteur de classe */}
        {!activeClasseFull && niveauxFiltres.length > 0 && (
          <div className="space-y-3">
            {cyclesCount > 0 && (
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
                {t('etabAdmin.listeScolaire.choose_class')}
              </p>
            )}
            {niveauxFiltres.map(niveau => (
              <div key={niveau.nom} className="bg-white rounded-2xl border border-gray-100 p-3">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-2">
                  {niveau.nom}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {niveau.classes.map(c => {
                    const fullName = c.nom;
                    const count = articlesByClasse.get(fullName)?.length || 0;
                    return (
                      <button
                        key={fullName}
                        onClick={() => setActiveClasseFull(fullName)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                          count > 0
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                            : 'border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                      >
                        {fullName}
                        {count > 0 && (
                          <span className="ml-1.5 text-[10px] bg-emerald-600 text-white rounded-full px-1.5">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vue d'une classe */}
        {activeClasseFull && (
          <ClasseView
            etabId={etabId}
            classe={activeClasseFull}
            niveau={findNiveauForClasse(systemeActif, activeClasseFull)}
            annee={annee}
            slug={etab.slug || null}
            articles={articlesByClasse.get(activeClasseFull) || []}
            niveauxFiltres={niveauxFiltres}
            onBack={() => setActiveClasseFull(null)}
            onAddArticle={(type) => setShowArticleModal({
              classe: activeClasseFull,
              niveau: findNiveauForClasse(systemeActif, activeClasseFull),
              type,
            })}
            onEditArticle={(article) => setShowArticleModal({
              classe: activeClasseFull,
              niveau: findNiveauForClasse(systemeActif, activeClasseFull),
              type: article.type_article,
              article,
            })}
            onDeleteArticle={handleDelete}
            onDuplicated={() => load()}
          />
        )}
      </div>

      {showArticleModal && (
        <ArticleEditModal
          etabId={etabId}
          init={showArticleModal}
          annee={annee}
          systemeEducatif={systemeActif?.langue === 'en' ? 'anglophone' : 'francophone'}
          pays={(etab.pays || 'CM')}
          onClose={() => setShowArticleModal(null)}
          onSaved={() => { setShowArticleModal(null); load(); }}
        />
      )}
    </div>
  );
};

const findNiveauForClasse = (systeme: SystemeScolaire | null, classeFull: string): string => {
  if (!systeme) return '';
  for (const n of systeme.niveaux) {
    if (n.classes.some(c => c.nom === classeFull)) return n.nom;
  }
  return '';
};

// ============================================================================
// Bouton de préchargement
// ============================================================================
const PreloadButton: React.FC<{
  Icon: React.ComponentType<any>;
  title: string;
  desc: string;
  color: 'violet' | 'emerald' | 'indigo';
  onClick: () => void;
}> = ({ Icon, title, desc, color, onClick }) => {
  const palette = {
    violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  iconBg: 'bg-violet-200',  iconCol: 'text-violet-700',  titleCol: 'text-violet-900', descCol: 'text-violet-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-200', iconCol: 'text-emerald-700', titleCol: 'text-emerald-900', descCol: 'text-emerald-700' },
    indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  iconBg: 'bg-indigo-200',  iconCol: 'text-indigo-700',  titleCol: 'text-indigo-900', descCol: 'text-indigo-700' },
  }[color];
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border ${palette.border} ${palette.bg} active:opacity-80 text-left`}
    >
      <div className={`w-9 h-9 rounded-xl ${palette.iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${palette.iconCol}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${palette.titleCol}`}>{title}</p>
        <p className={`text-xs ${palette.descCol}`}>{desc}</p>
      </div>
    </button>
  );
};

// ============================================================================
// Vue détaillée d'une classe
// ============================================================================
const ClasseView: React.FC<{
  etabId: string;
  classe: string;
  niveau: string;
  annee: string;
  slug: string | null;
  articles: Article[];
  niveauxFiltres: Niveau[];
  onBack: () => void;
  onAddArticle: (type: TypeArticle) => void;
  onEditArticle: (article: Article) => void;
  onDeleteArticle: (id: number) => void;
  onDuplicated: () => void;
}> = ({ etabId, classe, niveau, annee, slug, articles, niveauxFiltres, onBack, onAddArticle, onEditArticle, onDeleteArticle, onDuplicated }) => {
  const { t } = useTranslation();
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const previewUrl = slug
    ? `${window.location.origin}/ecole/${slug}/classe/${encodeURIComponent(classe)}/programme`
    : null;
  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Toutes les classes
      </button>

      <div className="bg-white border border-emerald-100 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{niveau}</p>
            <h2 className="text-lg font-bold text-gray-900">{classe}</h2>
            <p className="text-xs text-gray-500 mt-1">{articles.length} article(s) au total</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowBulkAdd(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold whitespace-nowrap hover:bg-amber-200"
              title="Ajouter plusieurs articles d'un coup"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter en lot
            </button>
            {articles.length > 0 && (
              <button
                onClick={() => exportClasseCSV(classe, annee, articles)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold whitespace-nowrap hover:bg-blue-200"
                title="Exporter cette liste au format CSV"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            )}
            {articles.length > 0 && (
              <button
                onClick={() => setShowDuplicate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold whitespace-nowrap hover:bg-violet-200"
                title="Dupliquer cette liste vers une autre classe"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                Dupliquer
              </button>
            )}
            {previewUrl && articles.length > 0 && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold whitespace-nowrap hover:bg-emerald-200"
                title="Aperçu côté parent"
              >
                <Eye className="w-3.5 h-3.5" />
                Voir comme parent
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {showDuplicate && (
        <DuplicateClasseModal
          etabId={etabId}
          sourceClasse={classe}
          sourceArticles={articles}
          annee={annee}
          niveauxFiltres={niveauxFiltres}
          onClose={() => setShowDuplicate(false)}
          onDone={() => { setShowDuplicate(false); onDuplicated(); }}
        />
      )}

      {showBulkAdd && (
        <BulkAddModal
          etabId={etabId}
          niveau={niveau}
          classe={classe}
          annee={annee}
          onClose={() => setShowBulkAdd(false)}
          onDone={() => { setShowBulkAdd(false); onDuplicated(); }}
        />
      )}

      {TYPES_ARTICLE.map(({ id, labelKey, Icon }) => {
        const label = t(labelKey);
        const items = articles.filter(a => a.type_article === id);
        if (items.length === 0) {
          return (
            <details key={id} className="bg-white border border-gray-100 rounded-2xl">
              <summary className="p-3.5 cursor-pointer flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{t('etabAdmin.listeScolaire.articles_none')}</p>
                </div>
              </summary>
              <div className="px-4 pb-4">
                <button
                  onClick={() => onAddArticle(id)}
                  className="w-full py-2.5 border-2 border-dashed border-emerald-300 text-xs font-semibold text-emerald-700 rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  {label}
                </button>
              </div>
            </details>
          );
        }
        return (
          <details key={id} open className="bg-white border border-emerald-100 rounded-2xl">
            <summary className="p-3.5 cursor-pointer flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-emerald-800">{label}</p>
                <p className="text-xs text-gray-500">{t('etabAdmin.listeScolaire.articles_count', { count: items.length })}</p>
              </div>
            </summary>
            <div className="px-3 pb-3 space-y-2">
              {items.map(a => (
                <div key={a.id} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{a.titre_livre}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-gray-600">
                      {a.matiere && <span>{a.matiere}</span>}
                      {a.auteur_livre && <span>· {a.auteur_livre}</span>}
                      {a.editeur_livre && <span>· {a.editeur_livre}</span>}
                      {a.prix_officiel && (
                        <span className="font-semibold text-emerald-700">
                          {Math.round(a.prix_officiel).toLocaleString('fr-FR')} {a.devise || 'XAF'}
                        </span>
                      )}
                      {a.quantite_defaut > 1 && <span>× {a.quantite_defaut}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => onEditArticle(a)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200"
                    aria-label="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteArticle(a.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => onAddArticle(id)}
                className="w-full py-2 border-2 border-dashed border-emerald-300 text-xs font-semibold text-emerald-700 rounded-xl"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1" />
                Ajouter
              </button>
            </div>
          </details>
        );
      })}
    </div>
  );
};

// ============================================================================
// Modale création / édition d'un article
// ============================================================================
const ArticleEditModal: React.FC<{
  etabId: string;
  init: { classe: string; niveau: string; type: TypeArticle; article?: Article };
  annee: string;
  systemeEducatif: 'francophone' | 'anglophone';
  pays: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ etabId, init, annee, systemeEducatif, pays, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const a = init.article;
  const [titre, setTitre] = useState(a?.titre_livre || '');
  const [matiere, setMatiere] = useState(a?.matiere || '');
  const [auteur, setAuteur] = useState(a?.auteur_livre || '');
  const [editeur, setEditeur] = useState(a?.editeur_livre || '');
  const [isbn, setIsbn] = useState(a?.isbn_livre || '');
  const [prix, setPrix] = useState<string>(a?.prix_officiel?.toString() || '');
  const [quantite, setQuantite] = useState<string>(String(a?.quantite_defaut ?? 1));
  const [obligatoire, setObligatoire] = useState(a?.est_obligatoire ?? true);
  const [type, setType] = useState<TypeArticle>(init.type);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!titre.trim()) {
      toast({ title: 'Titre requis', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        niveau: init.niveau,
        classe: init.classe,
        matiere: matiere.trim() || (type === 'livre' || type === 'workbook' ? '' : 'Général'),
        titre_livre: titre.trim(),
        auteur_livre: auteur.trim() || null,
        editeur_livre: editeur.trim() || null,
        isbn_livre: isbn.trim() || null,
        annee_scolaire: annee,
        est_obligatoire: obligatoire,
        prix_officiel: prix ? Number(prix) : null,
        type_article: type,
        quantite_defaut: Number(quantite) || 1,
        systeme_educatif: systemeEducatif,
        pays,
      };
      const res = a
        ? await apiPatch(`/api/v2/admin/etablissement/${etabId}/programmes/${a.id}`, payload)
        : await apiPost(`/api/v2/admin/etablissement/${etabId}/programmes`, payload);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      toast({ title: a ? 'Article modifié' : 'Article ajouté' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center gap-3">
          <p className="font-bold text-gray-900 flex-1">
            {a ? 'Modifier l\'article' : 'Ajouter un article'}
          </p>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">{init.niveau} · {init.classe}</p>

          {/* Type article */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as TypeArticle)}
              className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            >
              {TYPES_ARTICLE.map(ta => <option key={ta.id} value={ta.id}>{t(ta.labelKey)}</option>)}
            </select>
          </div>

          <Field label="Titre / désignation *" value={titre} onChange={setTitre} placeholder={type === 'cahier' ? 'Cahier 200p grands carreaux' : 'Mathématiques 6ème — Vogue'} />

          {(type === 'livre' || type === 'workbook') && (
            <>
              <Field label="Matière" value={matiere} onChange={setMatiere} placeholder="Mathématiques, Anglais, ..." />
              <Field label="Auteur" value={auteur} onChange={setAuteur} />
              <Field label="Éditeur" value={editeur} onChange={setEditeur} placeholder="Vogue, Hachette, NER..." />
              <Field label="ISBN" value={isbn} onChange={setIsbn} />
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix officiel (XAF)" type="number" value={prix} onChange={setPrix} />
            <Field label="Quantité" type="number" value={quantite} onChange={setQuantite} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={obligatoire}
              onChange={e => setObligatoire(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-sm text-gray-700">Article obligatoire</span>
          </label>
        </div>

        <div className="p-5 sticky bottom-0 bg-white border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving || !titre.trim()}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {a ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: 'text' | 'number';
}> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
    />
  </div>
);

// ============================================================================
// Export CSV — liste scolaire d'une classe
// ============================================================================
// Génère un fichier CSV (séparateur ; pour Excel France/CM) téléchargeable.
// Inclut un BOM UTF-8 pour que les accents s'affichent correctement dans Excel.
// ============================================================================

function exportClasseCSV(classe: string, annee: string, articles: Article[]) {
  const headers = ['Type', 'Matière', 'Titre', 'Auteur', 'Éditeur', 'ISBN', 'Quantité', 'Prix officiel', 'Devise', 'Obligatoire'];
  const escape = (s: string | null | undefined): string => {
    const v = (s ?? '').toString();
    if (v.includes(';') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const rows = articles.map(a => [
    a.type_article,
    a.matiere || '',
    a.titre_livre,
    a.auteur_livre || '',
    a.editeur_livre || '',
    a.isbn_livre || '',
    String(a.quantite_defaut || 1),
    a.prix_officiel != null ? String(Math.round(a.prix_officiel)) : '',
    a.devise || 'XAF',
    a.est_obligatoire === false ? 'non' : 'oui',
  ].map(escape).join(';'));

  const csv = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liste-scolaire-${classe.replace(/\s+/g, '-')}-${annee}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Modale d'ajout en lot d'articles dans une classe
// ============================================================================
//
// L'admin colle/saisit une liste de lignes (1 article = 1 ligne). Format souple :
//   - "Cahier 200p grands carreaux"
//   - "Cahier 100p × 2"        (× ou x suivi d'un nombre = quantité)
//   - "Stylo bleu x4"
// Le type, matière et caractère obligatoire sont fixés en en-tête de la modale.
// ============================================================================

const QUANTITE_REGEX = /\s*[x×]\s*(\d+)\s*$/i;

const BulkAddModal: React.FC<{
  etabId: string;
  niveau: string;
  classe: string;
  annee: string;
  onClose: () => void;
  onDone: () => void;
}> = ({ etabId, niveau, classe, annee, onClose, onDone }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [type, setType] = useState<TypeArticle>('cahier');
  const [matiere, setMatiere] = useState('');
  const [obligatoire, setObligatoire] = useState(true);
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);

  const parsed = (() => {
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const m = line.match(QUANTITE_REGEX);
        if (m) {
          return {
            titre: line.replace(QUANTITE_REGEX, '').trim(),
            quantite: Math.max(1, parseInt(m[1], 10) || 1),
          };
        }
        return { titre: line, quantite: 1 };
      })
      .filter(a => a.titre.length > 0);
  })();

  const submit = async () => {
    if (parsed.length === 0) {
      toast({ title: 'Saisissez au moins un article', variant: 'destructive' });
      return;
    }
    setRunning(true);
    let created = 0;
    let errors = 0;
    for (const a of parsed) {
      try {
        const payload = {
          niveau,
          classe,
          matiere: matiere.trim() || (type === 'livre' || type === 'workbook' ? '' : 'Général'),
          titre_livre: a.titre,
          annee_scolaire: annee,
          est_obligatoire: obligatoire,
          type_article: type,
          quantite_defaut: a.quantite,
        };
        const res = await apiPost(
          `/api/v2/admin/etablissement/${etabId}/programmes`,
          payload
        );
        if (res.ok) created++;
        else errors++;
      } catch {
        errors++;
      }
    }
    setRunning(false);
    toast({
      title: 'Ajout en lot terminé',
      description: `${created} article(s) ajouté(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`,
    });
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center gap-3">
          <Plus className="w-5 h-5 text-amber-700" />
          <p className="font-bold text-gray-900 flex-1">Ajouter en lot — {classe}</p>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed bg-amber-50 border border-amber-200 rounded-xl p-3">
            Une ligne = un article. Ajoutez <code>× 2</code> ou <code>x 4</code> en fin de ligne pour
            la quantité (par défaut 1). Le type, la matière et le caractère
            obligatoire ci-dessous s'appliquent à tous les articles ajoutés.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TypeArticle)}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              >
                {TYPES_ARTICLE.map(ta => <option key={ta.id} value={ta.id}>{t(ta.labelKey)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Matière (optionnel)</label>
              <input
                value={matiere}
                onChange={e => setMatiere(e.target.value)}
                placeholder={type === 'livre' || type === 'workbook' ? 'Mathématiques' : 'Général'}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={obligatoire}
              onChange={e => setObligatoire(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-xs text-gray-700">Obligatoire (s'applique à tous)</span>
          </label>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Articles ({parsed.length} détectés)
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={
                type === 'cahier'
                  ? 'Cahier 200p grands carreaux × 2\nCahier 100p petits carreaux × 4\nCahier de dessin'
                  : type === 'fourniture'
                    ? 'Stylo bleu × 4\nStylo rouge × 2\nCrayon HB × 2\nGomme\nRègle 30cm'
                    : 'Un titre par ligne\nUtilisez "× N" pour la quantité'
              }
              className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono"
            />
          </div>
        </div>

        <div className="p-5 sticky bottom-0 bg-white border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={running || parsed.length === 0}
            className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {running && <Loader2 className="w-4 h-4 animate-spin" />}
            Ajouter {parsed.length > 0 ? `${parsed.length} article(s)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Modale de duplication d'une classe vers une autre
// ============================================================================
const DuplicateClasseModal: React.FC<{
  etabId: string;
  sourceClasse: string;
  sourceArticles: Article[];
  annee: string;
  niveauxFiltres: Niveau[];
  onClose: () => void;
  onDone: () => void;
}> = ({ etabId, sourceClasse, sourceArticles, annee, niveauxFiltres, onClose, onDone }) => {
  const { toast } = useToast();
  const [target, setTarget] = useState<string>('');
  const [running, setRunning] = useState(false);

  // Liste des classes destinations possibles : toutes les classes des cycles
  // offerts SAUF la source elle-même.
  const destinations: Array<{ niveau: string; classe: string }> = [];
  for (const n of niveauxFiltres) {
    for (const c of n.classes) {
      if (c.nom !== sourceClasse) {
        destinations.push({ niveau: n.nom, classe: c.nom });
      }
    }
  }

  const submit = async () => {
    if (!target) {
      toast({ title: 'Sélectionnez une classe cible', variant: 'destructive' });
      return;
    }
    const ok = window.confirm(
      `Dupliquer ${sourceArticles.length} article(s) de « ${sourceClasse} » vers « ${target} » ?\n\n` +
      `Les articles déjà présents en ${target} ne seront pas réécrits.`
    );
    if (!ok) return;
    setRunning(true);
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const targetNiveau = niveauxFiltres.find(n =>
      n.classes.some(c => c.nom === target)
    )?.nom || '';
    for (const a of sourceArticles) {
      try {
        const payload = {
          niveau: targetNiveau || a.niveau,
          classe: target,
          matiere: a.matiere || '',
          titre_livre: a.titre_livre,
          auteur_livre: a.auteur_livre,
          editeur_livre: a.editeur_livre,
          isbn_livre: a.isbn_livre,
          annee_scolaire: annee,
          est_obligatoire: a.est_obligatoire ?? true,
          prix_officiel: a.prix_officiel,
          devise: a.devise || 'XAF',
          type_article: a.type_article,
          quantite_defaut: a.quantite_defaut,
          systeme_educatif: a.systeme_educatif,
          pays: a.pays,
        };
        const res = await apiPost(
          `/api/v2/admin/etablissement/${etabId}/programmes`,
          payload
        );
        if (res.ok) created++;
        else if (res.status === 409 || res.status === 400) skipped++;
        else errors++;
      } catch {
        errors++;
      }
    }
    setRunning(false);
    toast({
      title: 'Duplication terminée',
      description: `${created} ajouté(s), ${skipped} déjà présent(s), ${errors} erreur(s)`,
    });
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center gap-3">
          <CopyPlus className="w-5 h-5 text-violet-600" />
          <p className="font-bold text-gray-900 flex-1">Dupliquer la classe</p>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-600 leading-relaxed bg-violet-50 border border-violet-200 rounded-xl p-3">
            Copie les <strong>{sourceArticles.length} article(s)</strong> de <strong>{sourceClasse}</strong> vers
            la classe choisie. Pratique pour démarrer rapidement la configuration d'une autre classe similaire,
            puis ajuster ce qui change.
          </p>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Classe destination
            </label>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">— Choisir une classe —</option>
              {destinations.map(d => (
                <option key={`${d.niveau}-${d.classe}`} value={d.classe}>
                  {d.niveau} · {d.classe}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-5 sticky bottom-0 bg-white border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={!target || running}
            className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {running && <Loader2 className="w-4 h-4 animate-spin" />}
            Dupliquer
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Carte de statistiques (vue d'ensemble année courante)
// ============================================================================
const StatsCard: React.FC<{
  articles: Article[];
  classesConfiguredCount: number;
  classesTotalCount: number;
}> = ({ articles, classesConfiguredCount, classesTotalCount }) => {
  const counts: Record<TypeArticle, number> = {
    livre: 0, workbook: 0, cahier: 0, fourniture: 0, accessoire: 0,
  };
  let totalPrix = 0;
  let nbPrix = 0;
  for (const a of articles) {
    counts[a.type_article] = (counts[a.type_article] || 0) + 1;
    if (a.prix_officiel != null) {
      totalPrix += a.prix_officiel * (a.quantite_defaut || 1);
      nbPrix++;
    }
  }
  const prixMoyenParArticle = nbPrix > 0 ? Math.round(totalPrix / nbPrix) : null;
  const coutMoyenParClasse = classesConfiguredCount > 0
    ? Math.round(totalPrix / classesConfiguredCount)
    : null;
  const completion = classesTotalCount > 0
    ? Math.round((classesConfiguredCount / classesTotalCount) * 100)
    : null;

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Vue d'ensemble
        </p>
        {completion != null && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
            {classesConfiguredCount}/{classesTotalCount} classes · {completion}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Articles" value={articles.length} color="emerald" />
        <Stat label="Livres" value={counts.livre + counts.workbook} color="indigo" />
        <Stat label="Cahiers/Four." value={counts.cahier + counts.fourniture + counts.accessoire} color="amber" />
      </div>

      {(prixMoyenParArticle || coutMoyenParClasse) && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {coutMoyenParClasse != null && (
            <Stat
              label="Coût moyen / classe"
              value={`${coutMoyenParClasse.toLocaleString('fr-FR')} XAF`}
              color="violet"
              compact
            />
          )}
          {prixMoyenParArticle != null && (
            <Stat
              label="Prix moyen / article"
              value={`${prixMoyenParArticle.toLocaleString('fr-FR')} XAF`}
              color="rose"
              compact
            />
          )}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{
  label: string;
  value: number | string;
  color: 'emerald' | 'indigo' | 'amber' | 'violet' | 'rose';
  compact?: boolean;
}> = ({ label, value, color, compact }) => {
  const palette: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    indigo:  'bg-indigo-50 text-indigo-700',
    amber:   'bg-amber-50 text-amber-700',
    violet:  'bg-violet-50 text-violet-700',
    rose:    'bg-rose-50 text-rose-700',
  };
  return (
    <div className={`${palette[color]} rounded-xl px-3 py-2 text-center`}>
      <p className={compact ? 'text-base font-bold' : 'text-xl font-bold'}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide font-semibold mt-0.5">{label}</p>
    </div>
  );
};

export default EtablissementListeScolairePage;
