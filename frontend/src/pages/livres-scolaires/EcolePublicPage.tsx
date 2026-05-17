// ✅ Page publique d'un établissement scolaire
// Date : 2026-05-07
//
// 3 vues :
//   /ecole/:slug                    → écran décision (commander OU voir infos)
//   /ecole/:slug/commander          → sélection classe
//   /ecole/:slug/commander/:classe  → liste pré-remplie (manuels + fournitures)
//   /ecole/:slug/infos              → 10 blocs CMS

import {
  ArrowLeft, BookOpen, Bus, Calendar, ChevronRight, Coffee, FileText,
  GraduationCap, Home as HomeIcon, Info, MapPin, Megaphone, Package,
  Phone, ShoppingCart, Shirt, Trophy, Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';
import { useParentShop } from '../../hooks/useParentShop';
import { useUserTrocPool } from '../../hooks/useUserTrocPool';
import { apiGet } from '../../services/apiService';

interface EcolePagePublic {
  id: number;
  nom_etablissement: string;
  slug: string;
  ville: string | null;
  quartier: string | null;
  adresse: string | null;
  logo_url: string | null;
  banniere_url: string | null;
  description: string | null;
  type_etablissement: string | null;
  telephone: string | null;
  email: string | null;
}

interface BlocCMS {
  id: number;
  type_bloc: string;
  titre: string | null;
  contenu_json: any;
  medias_urls: string[] | null;
  position: number;
  is_active: boolean;
}

interface Annonce {
  id: number;
  titre: string;
  contenu: string;
  image_url: string | null;
  is_pinned: boolean;
  published_at: string;
}

interface Evenement {
  id: number;
  titre: string;
  description: string | null;
  type_event: string | null;
  date_debut: string;
  date_fin: string | null;
  classe_concernee: string | null;
}

interface PageData {
  etablissement: EcolePagePublic;
  blocs: BlocCMS[];
  annonces: Annonce[];
  evenements: Evenement[];
  classes_disponibles: string[];
}

const TYPE_BLOC_ICON: Record<string, any> = {
  inscription: FileText,
  transport: Bus,
  cantine: Coffee,
  perisco: Trophy,
  internat: HomeIcon,
  uniforme: Shirt,
  calendrier: Calendar,
  annonces: Megaphone,
  contacts: Phone,
  laureats: GraduationCap,
};

const formatPrix = (prix: number | null | undefined): string => {
  if (!prix || prix <= 0) return '—';
  return `${prix.toLocaleString('fr-FR')} FCFA`;
};

// ============================================================================
// 1. Page Décision : 2 boutons (Commander / Voir infos)
// ============================================================================
export const EcoleDecisionPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet(`/api/v2/ecole/${encodeURIComponent(slug)}`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
        if (!cancelled) setData(d);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Établissement introuvable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-sm text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-amber-50 p-6 text-center">
        <p className="text-base font-semibold text-red-600 mb-2">{error || 'Erreur'}</p>
        <button
          onClick={() => navigate('/recherche-ecole')}
          className="mt-4 px-5 py-2 bg-amber-500 text-white rounded-full text-sm"
        >
          {t('common.back')}
        </button>
      </div>
    );
  }

  const e = data.etablissement;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate('/recherche-ecole')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 truncate flex-1">
            {e.nom_etablissement}
          </h1>
        </div>
      </div>

      {/* Bannière */}
      {e.banniere_url && (
        <div
          className="h-32 sm:h-44 bg-cover bg-center"
          style={{ backgroundImage: `url(${e.banniere_url})` }}
        />
      )}

      {/* Identité */}
      <div className="px-5 py-5 bg-white border-b border-gray-100 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 overflow-hidden">
          {e.logo_url ? (
            <img src={e.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-amber-700">
              {e.nom_etablissement.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900">{e.nom_etablissement}</h2>
          {(e.quartier || e.ville) && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              {[e.quartier, e.ville].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* 2 CTA */}
      <div className="px-5 py-7">
        <p className="text-center text-sm font-semibold text-gray-500 mb-5">
          {t('bourse.decision.question')}
        </p>

        <button
          onClick={() => navigate(`/ecole/${slug}/commander`)}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white p-5 rounded-2xl flex items-center gap-4 shadow-md mb-3"
        >
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-base">{t('bourse.decision.order_books')}</p>
            <p className="text-xs text-amber-50 mt-0.5">
              {t('bourse.decision.order_books_desc')}
            </p>
          </div>
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => navigate(`/ecole/${slug}/infos`)}
          className="w-full bg-white border-2 border-gray-200 text-gray-800 p-5 rounded-2xl flex items-center gap-4 active:bg-gray-50"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <Info className="w-6 h-6 text-emerald-700" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-base">{t('bourse.decision.view_infos')}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('bourse.decision.view_infos_desc')}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 2. Page Sélection Classe
// ============================================================================
export const EcoleSelectClassePage: React.FC = () => {
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const [classes, setClasses] = useState<string[]>([]);
  const [etabNom, setEtabNom] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await apiGet(`/api/v2/ecole/${encodeURIComponent(slug)}`);
        const d = await res.json().catch(() => ({}));
        setClasses(Array.isArray(d?.classes_disponibles) ? d.classes_disponibles : []);
        setEtabNom(d?.etablissement?.nom_etablissement || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Groupage primaire / collège / lycée
  const groupes = useMemo(() => {
    const g = { primaire: [] as string[], college: [] as string[], lycee: [] as string[] };
    for (const c of classes) {
      const lc = c.toLowerCase();
      if (
        lc.startsWith('sil') || lc.startsWith('cp') || lc.startsWith('ce') ||
        lc.startsWith('cm') || lc.startsWith('class ')
      ) {
        g.primaire.push(c);
      } else if (
        lc.startsWith('6') || lc.startsWith('5') || lc.startsWith('4') ||
        lc.startsWith('3') || lc.startsWith('form 1') || lc.startsWith('form 2') ||
        lc.startsWith('form 3') || lc.startsWith('form 4') || lc.startsWith('form 5')
      ) {
        g.college.push(c);
      } else {
        g.lycee.push(c);
      }
    }
    return g;
  }, [classes]);

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => navigate(`/ecole/${slug}`)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">{etabNom}</h1>
          <p className="text-xs text-gray-500">{t('bourse.classe.title')}</p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {loading && (
          <p className="text-center text-sm text-gray-400 py-8">{t('common.loading')}</p>
        )}
        {!loading && classes.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-12">
            {t('bourse.classe.no_class')}
          </p>
        )}

        {groupes.primaire.length > 0 && (
          <ClassesGroupe
            label={t('bourse.classe.primaire')}
            items={groupes.primaire}
            onSelect={c => navigate(`/ecole/${slug}/commander/${encodeURIComponent(c)}`)}
            color="emerald"
          />
        )}
        {groupes.college.length > 0 && (
          <ClassesGroupe
            label={t('bourse.classe.secondaire_1')}
            items={groupes.college}
            onSelect={c => navigate(`/ecole/${slug}/commander/${encodeURIComponent(c)}`)}
            color="amber"
          />
        )}
        {groupes.lycee.length > 0 && (
          <ClassesGroupe
            label={t('bourse.classe.secondaire_2')}
            items={groupes.lycee}
            onSelect={c => navigate(`/ecole/${slug}/commander/${encodeURIComponent(c)}`)}
            color="indigo"
          />
        )}
      </div>
    </div>
  );
};

const ClassesGroupe: React.FC<{
  label: string;
  items: string[];
  onSelect: (c: string) => void;
  color: 'emerald' | 'amber' | 'indigo';
}> = ({ label, items, onSelect, color }) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-800 active:bg-emerald-200',
    amber: 'bg-amber-100 text-amber-800 active:bg-amber-200',
    indigo: 'bg-indigo-100 text-indigo-800 active:bg-indigo-200',
  };
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map(c => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className={`px-3 py-3 ${colors[color]} rounded-2xl text-sm font-semibold`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 3. Page Liste pré-remplie
// ============================================================================
interface ArticleProgramme {
  id: number;
  titre: string;
  auteur: string | null;
  editeur: string | null;
  matiere: string | null;
  classe: string | null;
  type: string | null;
  prix_officiel: number | null;
  devise: string;
  est_obligatoire: boolean;
  quantite_defaut: number;
  source: string;
}

export const EcoleListeScolairePage: React.FC = () => {
  const navigate = useNavigate();
  const { slug = '', classe = '' } = useParams();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { addItems, addEnfant, enfants } = useParentShop();
  // ✅ 2026-05-11 : pool troc du parent pour détecter les livres qu'il
  // a déjà déposés en échange. Permet d'afficher un badge + bloquer
  // la sélection (éviter d'acheter ce qu'on a déjà troqué).
  const { findMatchInPool } = useUserTrocPool();
  const [articles, setArticles] = useState<ArticleProgramme[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  // ✅ 2026-05-10 : choix d'achat par article (cohérent avec ScanProgrammePage
  // et RentreeCenterPage). Trois états visibles inline pour les livres :
  // 'neuf' | 'occasion' (sans échange) | 'occasion+troc' (échange contre crédit).
  const [choix, setChoix] = useState<Record<number, 'neuf' | 'occasion'>>({});
  const [trocIntent, setTrocIntent] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  // Année courante détectée automatiquement par le backend (selon pays + date).
  // Le parent ne sélectionne rien — il voit toujours la rentrée en cours.
  const [annee, setAnnee] = useState<string>('');

  useEffect(() => {
    if (!slug || !classe) return;
    (async () => {
      try {
        const res = await apiGet(
          `/api/v2/ecole/${encodeURIComponent(slug)}/classe/${encodeURIComponent(classe)}/programme`
        );
        const d = await res.json().catch(() => ({}));
        const items: ArticleProgramme[] = Array.isArray(d?.articles) ? d.articles : [];
        setArticles(items);
        if (typeof d?.annee_scolaire === 'string') setAnnee(d.annee_scolaire);
        const initSelected: Record<number, boolean> = {};
        const initChoix: Record<number, 'neuf' | 'occasion'> = {};
        for (const it of items) { initSelected[it.id] = true; initChoix[it.id] = 'neuf'; }
        setSelected(initSelected);
        setChoix(initChoix);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, classe]);

  const isOccasionable = (type?: string) =>
    type === 'livre' || type === 'workbook';
  const allSelected = articles.length > 0 && articles.every(a => selected[a.id]);
  const toggleAllSelection = () => {
    const next: Record<number, boolean> = {};
    const target = !allSelected;
    for (const a of articles) next[a.id] = target;
    setSelected(next);
  };
  const setItemChoix = (id: number, c: 'neuf' | 'occasion') => {
    setChoix(s => ({ ...s, [id]: c }));
    if (c === 'neuf') setTrocIntent(s => ({ ...s, [id]: false }));
  };
  const setItemTrocIntent = (id: number, intent: boolean) => {
    setChoix(s => ({ ...s, [id]: 'occasion' }));
    setTrocIntent(s => ({ ...s, [id]: intent }));
  };

  const total = useMemo(
    () =>
      articles
        .filter(a => selected[a.id])
        .reduce((sum, a) => sum + (a.prix_officiel || 0) * (a.quantite_defaut || 1), 0),
    [articles, selected]
  );

  const toggle = (id: number) =>
    setSelected(s => ({ ...s, [id]: !s[id] }));

  const commander = () => {
    const items = articles.filter(a => selected[a.id]);
    if (items.length === 0) {
      toast({ title: 'Sélectionnez au moins un article', variant: 'destructive' });
      return;
    }
    // ✅ 2026-05-10 : si aucune classe enregistrée, on en crée une à la
    // volée à partir du nom de classe du programme partenaire — pas de
    // détour par /parent-selection. Le parent peut affiner les détails
    // (pays, série…) plus tard depuis le formulaire classe de /rentree.
    let enfantId = enfants.find(e => e.classe === classe)?.id || enfants[0]?.id;
    if (!enfantId) {
      const created = addEnfant({
        systeme: 'francophone',
        niveau: '',
        classe: classe || '',
        // ✅ Mémorise le slug pour pouvoir proposer "ajouter une autre
        // classe dans la même école" sur /rentree.
        etablissementSlug: slug,
      });
      enfantId = created.id;
    }
    addItems(
      items.map(it => {
        const c = choix[it.id] || 'neuf';
        const trocOk = isOccasionable(it.type) && c === 'occasion' && !!trocIntent[it.id];
        return {
          enfantId: enfantId as string,
          titre: it.titre,
          auteur: it.auteur || undefined,
          matiere: it.matiere || undefined,
          editeur: it.editeur || undefined,
          type: (it.type as any) || 'livre',
          prixNeuf: it.prix_officiel || undefined,
          quantite: it.quantite_defaut || 1,
          choix: c,
          troc_intent: trocOk || undefined,
        };
      })
    );
    const trocCount = items.filter(
      it => isOccasionable(it.type) && choix[it.id] === 'occasion' && trocIntent[it.id]
    ).length;
    toast({ title: `${items.length} article(s) ajouté(s)` });
    if (trocCount > 0) {
      navigate('/rentree?capture-troc=1');
    } else {
      // Harmonisé 2026-05-16 : direct au panier (cohérent avec Browse/Cahiers).
      navigate('/recap');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button
          onClick={() => navigate(`/ecole/${slug}/commander`)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">
            {t('bourse.liste.title_prefix')} {classe}
          </h1>
          {/* Année automatiquement détectée par le backend selon le pays de
              l'établissement et la date courante. Le parent n'a pas besoin de
              sélecteur — c'est la rentrée en cours par défaut. */}
          <p className="text-xs text-gray-500">
            {annee ? `Année ${annee}` : t('bourse.liste.annee')}
          </p>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {loading && (
          <p className="text-center text-sm text-gray-400 py-8">{t('common.loading')}</p>
        )}
        {!loading && articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 mb-4">{t('bourse.liste.empty')}</p>
            <button
              onClick={() => navigate('/scan-programme')}
              className="px-5 py-2.5 bg-amber-500 text-white text-sm rounded-full"
            >
              Scanner la liste
            </button>
          </div>
        )}

        {articles.length > 0 && !loading && (
          <>
            <p className="text-[11px] text-gray-500 leading-snug px-1 mb-1">
              {t('bourse.rentree.choices_hint')}
            </p>
            <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-3 py-2 mb-2">
              <span className="text-xs font-semibold text-gray-700">
                {articles.filter(a => selected[a.id]).length} / {articles.length} sélectionnés
              </span>
              <button
                onClick={toggleAllSelection}
                className="text-xs font-bold text-amber-700 active:text-amber-800"
              >
                {allSelected ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </div>
          </>
        )}

        {articles.map(a => {
          const c = choix[a.id] || 'neuf';
          const isLivre = isOccasionable(a.type);
          // ✅ Cross-flow : ce livre est-il déjà dans le pool troc du parent ?
          // Si oui, on désactive la case à cocher et on affiche un badge.
          // classeCible = classe affichée dans cette école (= classe à venir de
          // l'enfant). Le pool est matché sur classe_souhaitee (next-class), donc
          // un troc 6ème→5ème grise bien l'article 5ème de la liste.
          const trocMatch = isLivre
            ? findMatchInPool({ titre: a.titre, matiere: (a as any).matiere, classeCible: classe })
            : null;
          const isAlreadyInPool = !!trocMatch;
          return (
          <div
            key={a.id}
            className={`p-3 bg-white rounded-2xl border transition ${
              isAlreadyInPool
                ? 'border-cyan-300 bg-cyan-50'
                : selected[a.id]
                ? 'border-amber-300 bg-amber-50'
                : 'border-gray-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => !isAlreadyInPool && toggle(a.id)}
                disabled={isAlreadyInPool}
                className={`w-5 h-5 mt-0.5 shrink-0 rounded-md border-2 flex items-center justify-center ${
                  isAlreadyInPool
                    ? 'bg-cyan-500 border-cyan-500 cursor-not-allowed opacity-60'
                    : selected[a.id]
                    ? 'bg-amber-500 border-amber-500'
                    : 'border-gray-300'
                }`}
                title={isAlreadyInPool ? 'Déjà couvert par votre échange' : undefined}
              >
                {(selected[a.id] || isAlreadyInPool) && <span className="text-white text-xs">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">{a.titre}</p>
                {a.auteur && <p className="text-xs text-gray-500 mt-1">{a.auteur}</p>}
                {/* Badge cross-flow : informe le parent que ce livre est
                    déjà en cours d'échange dans son pool. */}
                {isAlreadyInPool && (
                  <p className="text-[11px] text-cyan-800 bg-cyan-100 px-2 py-1 rounded mt-1.5 leading-snug">
                    📦 Déjà dans votre échange en cours ({trocMatch.troc_status}).
                    {trocMatch.valeur ? ` Crédit estimé : ${Math.round(Math.max(0, trocMatch.valeur * 0.75 - 40)).toLocaleString('fr-FR')} XAF.` : ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  {a.matiere && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {a.matiere}
                    </span>
                  )}
                  {a.editeur && (
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                      {a.editeur}
                    </span>
                  )}
                </div>

                {/* 3-state segmented (Neuf / Occasion / Échange) — uniquement
                    pour les livres et workbooks, et seulement si la ligne
                    est sélectionnée. Cohérent avec ScanProgrammePage. */}
                {isLivre && selected[a.id] && (
                  <div className="inline-flex bg-gray-100 rounded-md p-0.5 gap-0.5 items-center mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setItemChoix(a.id, 'neuf'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        c === 'neuf' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'
                      }`}
                    >Neuf</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setItemTrocIntent(a.id, false); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        c === 'occasion' && !trocIntent[a.id] ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500'
                      }`}
                    >Occasion</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setItemTrocIntent(a.id, true); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        c === 'occasion' && trocIntent[a.id] ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-500'
                      }`}
                      title="Troquer mon ancien livre — Yukpo l'évalue et le crédit est appliqué à la commande."
                    >Échange</button>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">×{a.quantite_defaut}</p>
                <p className="text-sm font-bold text-amber-700">
                  {formatPrix(a.prix_officiel)}
                </p>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Bottom bar total + commander */}
      {articles.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-600">
              {t('bourse.liste.total_estime')}
            </span>
            <span className="text-xl font-bold text-amber-700">{formatPrix(total)}</span>
          </div>
          <button
            onClick={commander}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3.5 rounded-2xl font-bold text-base"
          >
            {t('bourse.liste.commander')}
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. Page Infos Établissement (10 blocs CMS)
// ============================================================================
export const EcoleInfosPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await apiGet(`/api/v2/ecole/${encodeURIComponent(slug)}`);
        const d = await res.json().catch(() => ({}));
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <p className="p-8 text-center text-sm text-gray-400">{t('common.loading')}</p>;
  if (!data) return null;

  const blocsByType = new Map(data.blocs.map(b => [b.type_bloc, b]));
  const e = data.etablissement;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={() => navigate(`/ecole/${slug}`)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900 truncate">{e.nom_etablissement}</h1>
      </div>

      <div className="p-4 space-y-3">
        {/* Description courte */}
        {e.description && (
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">{e.description}</p>
          </div>
        )}

        {/* Annonces épinglées */}
        {data.annonces.length > 0 && (
          <BlocAnnonces annonces={data.annonces} />
        )}

        {/* Calendrier */}
        {data.evenements.length > 0 && (
          <BlocCalendrier evenements={data.evenements} />
        )}

        {/* 10 blocs CMS dans l'ordre */}
        {(['inscription', 'transport', 'cantine', 'perisco', 'internat', 'uniforme', 'contacts', 'laureats'] as const).map(typ => {
          const b = blocsByType.get(typ);
          if (!b) return null;
          return <BlocGeneric key={b.id} bloc={b} label={t(`bourse.infos.sections.${typ}`)} />;
        })}

        {/* Raccourci commander */}
        {data.classes_disponibles.length > 0 && (
          <button
            onClick={() => navigate(`/ecole/${slug}/commander`)}
            className="w-full bg-amber-500 text-white p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mt-4"
          >
            <ShoppingCart className="w-5 h-5" />
            {t('bourse.infos.commander_shortcut')}
          </button>
        )}
      </div>
    </div>
  );
};

const BlocAnnonces: React.FC<{ annonces: Annonce[] }> = ({ annonces }) => (
  <details className="bg-white rounded-2xl border border-gray-100 overflow-hidden" open>
    <summary className="p-4 flex items-center gap-3 cursor-pointer">
      <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
        <Megaphone className="w-5 h-5 text-rose-700" />
      </div>
      <p className="font-semibold text-sm flex-1">Annonces ({annonces.length})</p>
      <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90" />
    </summary>
    <div className="px-4 pb-4 space-y-3">
      {annonces.map(a => (
        <div key={a.id} className="border-l-4 border-rose-400 pl-3 py-1">
          {a.is_pinned && (
            <span className="inline-block text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full mb-1">
              Épinglé
            </span>
          )}
          <p className="font-semibold text-sm text-gray-900">{a.titre}</p>
          <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">{a.contenu}</p>
        </div>
      ))}
    </div>
  </details>
);

const BlocCalendrier: React.FC<{ evenements: Evenement[] }> = ({ evenements }) => (
  <details className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <summary className="p-4 flex items-center gap-3 cursor-pointer">
      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
        <Calendar className="w-5 h-5 text-blue-700" />
      </div>
      <p className="font-semibold text-sm flex-1">Calendrier ({evenements.length})</p>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </summary>
    <div className="px-4 pb-4 space-y-2">
      {evenements.slice(0, 20).map(ev => (
        <div key={ev.id} className="flex items-start gap-3 py-1.5">
          <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{ev.titre}</p>
            <p className="text-xs text-gray-500">
              {new Date(ev.date_debut).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
              })}
            </p>
            {ev.classe_concernee && (
              <p className="text-xs text-blue-600 mt-0.5">Classe : {ev.classe_concernee}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  </details>
);

const BlocGeneric: React.FC<{ bloc: BlocCMS; label: string }> = ({ bloc, label }) => {
  const Icon = TYPE_BLOC_ICON[bloc.type_bloc] || Info;
  const c = bloc.contenu_json || {};
  return (
    <details className="bg-white rounded-2xl border border-gray-100 overflow-hidden group">
      <summary className="p-4 flex items-center gap-3 cursor-pointer">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-emerald-700" />
        </div>
        <p className="font-semibold text-sm flex-1">{bloc.titre || label}</p>
        <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
      </summary>
      <div className="px-4 pb-4 space-y-2">
        {/* Affichage générique des champs JSON */}
        {Object.entries(c).map(([key, value]) => {
          if (value === null || value === undefined || value === '') return null;
          if (Array.isArray(value)) {
            return (
              <div key={key}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {key.replace(/_/g, ' ')}
                </p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {value.map((v, i) => (
                    <li key={i} className="pl-2">
                      • {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
          if (typeof value === 'object') {
            return (
              <div key={key}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {key.replace(/_/g, ' ')}
                </p>
                <pre className="text-xs bg-gray-50 p-2 rounded text-gray-700">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            );
          }
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {key.replace(/_/g, ' ')}
              </p>
              <p className="text-sm text-gray-800">
                {typeof value === 'number' && key.toLowerCase().includes('prix')
                  ? formatPrix(value as number)
                  : String(value)}
              </p>
            </div>
          );
        })}
        {bloc.medias_urls && bloc.medias_urls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {bloc.medias_urls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-full h-20 object-cover rounded-lg"
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
};
