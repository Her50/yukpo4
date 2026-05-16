import {
  ArrowLeft, BookOpen, CheckSquare, ChevronRight, Copy, Loader2,
  Minus, Plus, School, ShoppingCart, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClasseAutocomplete, { type ClasseSelection } from '../../components/livres-scolaires/ClasseAutocomplete';
import EcolePickerPopover from '../../components/livres-scolaires/EcolePickerPopover';
import GammeSelector, { Gamme, priceForGamme } from '../../components/livres-scolaires/GammeSelector';
import ManualAddInline, { type ManualAddItem } from '../../components/livres-scolaires/ManualAddInline';
import {
  getSystemeById, getSystemesForPays, type PaysCode,
} from '../../data/schoolSystems';
import { apiGet } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';
import {
  Enfant, Systeme, TypeItem, useParentShop,
} from '../../hooks/useParentShop';
import { useUserTrocPool } from '../../hooks/useUserTrocPool';

interface ProgrammeItem {
  titre: string;
  auteur?: string;
  matiere?: string;
  editeur?: string;
  type: TypeItem;
  quantite: number;
  prix?: number;
  source?: 'scan' | 'suggestion' | 'etablissement' | 'national';
  selected: boolean;
  /** Choix d'achat — par défaut 'neuf'. Toggle dispo uniquement pour les livres. */
  choix: 'neuf' | 'occasion';
  /** Si true ET choix='occasion' → l'user veut faire un troc (échange contre
   *  un livre qu'il possède déjà). À distinguer de l'achat d'occasion simple. */
  troc_intent?: boolean;
  /** Gamme choisie pour les fournitures/cahiers/accessoires. */
  gamme?: Gamme;
}

/** Toggle neuf/occasion uniquement pertinent pour les livres et workbooks. */
const isOccasionableType = (t: TypeItem): boolean =>
  t === 'livre' || (t as string) === 'workbook';

const isGammeableType = (t: TypeItem): boolean =>
  t === 'fourniture' || t === 'cahier' || t === 'autre';

const effectivePrice = (it: ProgrammeItem): number => {
  if (!it.prix) return 0;
  return isGammeableType(it.type)
    ? priceForGamme(it.prix, it.gamme || 'standard')
    : it.prix;
};

/**
 * ✅ 2026-05-16 — Affichage prix transparent selon le choix actif.
 * Aligné avec RecapAchatPage:ItemCard pour cohérence visuelle. Ratios
 * tirés de backend/src/models/livre_scolaire.rs (BON=70%, ACCEPTABLE=45%,
 * RATIO_CREDIT=70%, marge app 30%).
 */
const priceTextForItem = (it: ProgrammeItem): { text: string; subtext?: string } => {
  const base = it.prix ?? 0;
  if (isOccasionableType(it.type)) {
    if (base <= 0) return { text: '—' };
    const RATIO_OCC_MIN = 0.45;
    const RATIO_OCC_MAX = 0.70;
    const RATIO_CREDIT = 0.70;
    if (it.choix === 'occasion' && it.troc_intent) {
      // ÉCHANGE : gap à payer (max possible — min clampé à 0)
      const gapMin = Math.max(0, Math.round(base * (RATIO_OCC_MIN - RATIO_OCC_MAX * RATIO_CREDIT)));
      const gapMax = Math.round(base * (RATIO_OCC_MAX - RATIO_OCC_MIN * RATIO_CREDIT));
      return {
        text: gapMin > 0
          ? `${gapMin.toLocaleString('fr-FR')} – ${gapMax.toLocaleString('fr-FR')} F`
          : `≤ ${gapMax.toLocaleString('fr-FR')} F`,
        subtext: 'reste après échange',
      };
    }
    if (it.choix === 'occasion') {
      const min = Math.round(base * RATIO_OCC_MIN);
      const max = Math.round(base * RATIO_OCC_MAX);
      return {
        text: `${min.toLocaleString('fr-FR')} – ${max.toLocaleString('fr-FR')} F`,
        subtext: 'selon état',
      };
    }
    // Neuf
    return { text: `${base.toLocaleString('fr-FR')} F` };
  }
  // Fournitures : prix unique (gamme déjà appliquée)
  const v = effectivePrice(it);
  return { text: v > 0 ? `${v.toLocaleString('fr-FR')} F` : '—' };
};

type CategorieAffichage = 'livres' | 'cahiers' | 'fournitures';

const categorieLabel: Record<CategorieAffichage, string> = {
  livres: 'Manuels & workbooks',
  cahiers: 'Cahiers',
  fournitures: 'Fournitures & accessoires',
};

const categorieStyle: Record<CategorieAffichage, { bg: string; border: string; text: string; dot: string }> = {
  livres:      { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800',    dot: 'bg-blue-500' },
  cahiers:     { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  fournitures: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   dot: 'bg-amber-500' },
};

const categorieDe = (t: TypeItem): CategorieAffichage => {
  const s = String(t).toLowerCase();
  if (s === 'livre' || s === 'workbook') return 'livres';
  if (s === 'cahier') return 'cahiers';
  return 'fournitures';
};

/**
 * Sépare un classe stocké en DB (ex: "1ère année ELME", "2nde C", "2nd cycle TGF",
 * "Tronc commun 1er cycle") en (classeNom, serieCode) en consultant le référentiel.
 * Tente le matching le plus long d'abord pour éviter qu'un classe.nom à un mot
 * mange une partie d'un classe.nom à plusieurs mots.
 */
function parseClasseAndSerie(classeFull: string, systemeId: string, niveauNom: string): { classeNom: string; serieCode: string } {
  if (!classeFull) return { classeNom: '', serieCode: '' };
  const systeme = getSystemeById(systemeId);
  const niveau = systeme?.niveaux.find(n => n.nom === niveauNom);
  const classes = niveau?.classes ?? [];
  // Match exact d'abord (classe sans série)
  const exact = classes.find(c => c.nom === classeFull);
  if (exact) return { classeNom: exact.nom, serieCode: '' };
  // Match "classe.nom + ' ' + serie.code" — préférer le classe.nom le plus long
  const candidats = classes
    .filter(c => classeFull.startsWith(c.nom + ' '))
    .sort((a, b) => b.nom.length - a.nom.length);
  for (const c of candidats) {
    const reste = classeFull.slice(c.nom.length + 1);
    const serieMatch = c.series?.find(s => s.code === reste);
    if (serieMatch) return { classeNom: c.nom, serieCode: serieMatch.code };
  }
  // Fallback legacy : split sur premier espace
  const firstSpace = classeFull.indexOf(' ');
  if (firstSpace > 0) {
    return { classeNom: classeFull.slice(0, firstSpace), serieCode: classeFull.slice(firstSpace + 1) };
  }
  return { classeNom: classeFull, serieCode: '' };
}

const DEVISE_LOCALE_PAR_PAYS: Record<string, string> = {
  CM: 'XAF', CI: 'XOF', SN: 'XOF', GA: 'XAF', CG: 'XAF', CD: 'CDF',
  BJ: 'XOF', TG: 'XOF', BF: 'XOF', ML: 'XOF', NE: 'XOF', NG: 'NGN', GH: 'GHS',
};

function formatPrix(prix: number | undefined, pays: string): string {
  if (!prix || prix <= 0) return '—';
  const devise = DEVISE_LOCALE_PAR_PAYS[pays] ?? 'XAF';
  return `${prix.toLocaleString('fr-FR')} ${devise}`;
}

const BrowseProgrammeByEtablissementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { enfants, addItems, addEnfant } = useParentShop();
  // Pool troc du parent : grise les articles déjà couverts par un troc en cours
  // (ex : 6ème → 5ème déposé en troc → l'article 5ème de la liste est verrouillé).
  const { findMatchInPool } = useUserTrocPool();

  // ✅ 2026-05-13 : Workflow class-only — la couche `enfants[]` reste utilisée
  // comme persistance interne (pas exposée à l'UX). Le seed récupère TOUJOURS
  // la dernière classe utilisée. L'établissement n'est pré-sélectionné QUE
  // si cette même classe avait un etablissementId attaché. Sinon → programme
  // national par défaut (ce qui correspond à l'attente utilisateur).
  // On prend la dernière entrée (la plus récente), pas la première.
  // ✅ 2026-05-14 : ?reset=1 force le démarrage à zéro (CTA Programme national
  // depuis EcoleSearchPage) — sinon l'user voit la classe précédente figée.
  const resetMode = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reset') === '1');
  const seedEnfant: Enfant | undefined = resetMode ? undefined : (enfants[enfants.length - 1] ?? enfants[0]);
  const [etablissement, setEtablissement] = useState<{ id: number; nom: string; ville?: string } | null>(
    seedEnfant?.etablissementId
      ? { id: seedEnfant.etablissementId, nom: seedEnfant.etablissementNom ?? 'École' }
      : null
  );
  const [showPicker, setShowPicker] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}
    );
  }, []);

  // Sélecteurs pays / système / niveau / classe / série.
  // Parsing du classe seedé : si le classe.nom contient un espace (ex: "1ère année"),
  // un split naïf casse la séparation classe/série. On résout en cherchant dans
  // le référentiel le classe.nom qui matche la chaîne stockée.
  const seedClasseRaw = seedEnfant?.classe ?? '';
  const seedSystemeId = seedEnfant?.systemeId ?? 'CM-fr';
  const seedNiveau = seedEnfant?.niveau ?? '';
  const seedParsed = parseClasseAndSerie(seedClasseRaw, seedSystemeId, seedNiveau);
  const [pays, setPays] = useState<PaysCode>(seedEnfant?.pays ?? 'CM');
  const [systemeId, setSystemeId] = useState(seedSystemeId);
  const [niveauNom, setNiveauNom] = useState(seedNiveau);
  const [classeNom, setClasseNom] = useState(seedParsed.classeNom);
  const [serieCode, setSerieCode] = useState(seedEnfant?.serie ?? seedParsed.serieCode);

  const currentSystemeObj = getSystemeById(systemeId) ?? getSystemesForPays(pays)[0];
  const currentNiveaux = currentSystemeObj?.niveaux ?? [];
  const currentNiveauObj = currentNiveaux.find(n => n.nom === niveauNom);
  const currentClasseObj = currentNiveauObj?.classes.find(c => c.nom === classeNom);
  const hasClasseSeries = (currentClasseObj?.series?.length ?? 0) > 0;
  const classe = serieCode ? `${classeNom} ${serieCode}` : classeNom;
  const systeme: Systeme = currentSystemeObj?.langue === 'en' ? 'anglophone' : 'francophone';

  // ✅ 2026-05-14 : Pré-remplissage depuis query string (?classe=&mode=neuf|occasion).
  // Utilisé par le fallback rejet de VendreLivresPage : quand le livre du parent
  // est rejeté, on lui propose d'acheter le neuf/occasion de la classe supérieure
  // via un navigate('/programme-ecole?classe=2nde A&mode=neuf'). On parse la
  // classe ici pour seed niveauNom/classeNom/serieCode.
  useEffect(() => {
    const cParam = searchParams.get('classe');
    if (cParam && !classeNom) {
      // Trouve le niveau qui contient cette classe
      const sys = currentSystemeObj;
      if (sys) {
        for (const n of sys.niveaux) {
          const parsed = parseClasseAndSerie(cParam, sys.id, n.nom);
          if (parsed.classeNom && n.classes.some(c => c.nom === parsed.classeNom)) {
            setNiveauNom(n.nom);
            setClasseNom(parsed.classeNom);
            setSerieCode(parsed.serieCode);
            break;
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // ✅ 2026-05-13 : Classes effectivement présentes dans le programme de
  // l'établissement choisi. Récupéré côté backend. Sert à filtrer le
  // ClasseAutocomplete pour ne proposer que ce que l'école offre vraiment.
  // Si aucun etab choisi → undefined = pas de restriction (toutes les classes).
  const [classesDispo, setClassesDispo] = useState<Array<{ niveau?: string | null; classe: string }> | undefined>(undefined);
  useEffect(() => {
    if (!etablissement?.id) { setClassesDispo(undefined); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet(`/api/bourse-livre/v2/etablissements/${etablissement.id}/classes-disponibles`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.success && Array.isArray(data?.classes)) {
          setClassesDispo(data.classes);
        }
      } catch {
        if (!cancelled) setClassesDispo(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [etablissement?.id]);

  // Items chargés depuis le programme officiel
  const [items, setItems] = useState<ProgrammeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Sélection enfant cible (pour ajout au panier)
  const [selectedEnfantId, setSelectedEnfantId] = useState(enfants[0]?.id ?? '');

  // ✅ 2026-05-13 : Source unifiée avec SuggestionsModal — utilise désormais
  // /api/v2/parent/articles-suggested (livres + fournitures en parallèle) au
  // lieu de /api/bourse-livre/v2/programmes. Garantit l'équivalence avec
  // l'ancien modal Suggestions (qui mergait aussi accessoires_populaires
  // pour les fournitures quand le programme officiel n'en couvrait pas).
  // Si pas d'etab → programme national + accessoires populaires nationaux.
  // Si etab → priorité aux articles de l'etab, fallback national + populaires.
  const loadProgramme = useCallback(async () => {
    if (!classeNom) return;
    setLoading(true);
    setError('');
    setLoaded(false);
    try {
      // ✅ 2026-05-15 (Phase 2) : on ne fetch QUE les livres ici. Les cahiers/
      // fournitures ont été déplacés sur la page dédiée /cahiers-accessoires
      // (accessible depuis la home + Recap après validation commande). Cela
      // évite d'afficher les fournitures à chaque étape de sélection (pour
      // chaque classe) et garde Browse focalisé sur la sélection des livres.
      const fetchGroup = async (groupe: 'livres' | 'fournitures'): Promise<any[]> => {
        const p = new URLSearchParams();
        p.set('classe', classe);
        p.set('type_groupe', groupe);
        p.set('pays', pays);
        if (etablissement?.id) p.set('etablissement_id', String(etablissement.id));
        const res = await apiGet(`/api/v2/parent/articles-suggested?${p}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        return (data?.items || []) as any[];
      };
      const livresRaw = await fetchGroup('livres');
      const all = livresRaw;

      const mapped: ProgrammeItem[] = all.map((m: any): ProgrammeItem => {
        const rawType = String(m.type_article || m.type || 'livre').toLowerCase();
        const type: TypeItem = (
          rawType === 'workbook' ? 'livre'
          : (rawType === 'livre' || rawType === 'cahier' || rawType === 'fourniture' || rawType === 'autre')
            ? (rawType as TypeItem)
            : 'fourniture'
        );
        return {
          titre: m.titre || m.titre_livre || 'Article',
          auteur: m.auteur || m.auteur_livre || undefined,
          matiere: m.matiere || undefined,
          editeur: m.editeur || m.editeur_livre || undefined,
          type,
          quantite: typeof m.quantite_defaut === 'number' ? m.quantite_defaut : 1,
          prix: typeof m.prix_officiel === 'number'
            ? m.prix_officiel
            : (parseFloat(m.prix_officiel ?? m.prix ?? '') || undefined),
          source: m.source === 'etablissement' ? 'etablissement' : 'national',
          // Pré-coche par défaut UNIQUEMENT les livres/workbooks (comme dans
          // SuggestionsModal). Cahiers et fournitures restent décochés —
          // l'user choisit ce qu'il veut commander.
          selected: type === 'livre',
          choix: 'neuf' as const,
        };
      });
      setItems(mapped);
      setLoaded(true);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger le programme. Vérifiez votre connexion.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [etablissement?.id, niveauNom, classe, classeNom, pays]);

  // Auto-chargement quand classe ou établissement changent
  useEffect(() => {
    if (classeNom && (etablissement || niveauNom)) {
      loadProgramme();
    }
  }, [etablissement, classeNom, serieCode, loadProgramme, niveauNom]);

  // Toggle/select helpers
  const toggleItem = (idx: number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  const selectAll = () => setItems(prev => prev.map(it => ({ ...it, selected: true })));
  const deselectAll = () => setItems(prev => prev.map(it => ({ ...it, selected: false })));
  const adjustQuantite = (idx: number, delta: number) =>
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, quantite: Math.max(1, (it.quantite ?? 1) + delta) }
      : it));
  const toggleChoix = (idx: number) =>
    setItems(prev => prev.map((it, i) => i === idx && isOccasionableType(it.type)
      ? { ...it, choix: it.choix === 'neuf' ? 'occasion' : 'neuf' }
      : it));
  const setChoix = (idx: number, choix: 'neuf' | 'occasion') =>
    setItems(prev => prev.map((it, i) => i === idx && isOccasionableType(it.type)
      ? { ...it, choix, troc_intent: undefined }
      : it));
  /** Active explicitement le mode Échange : choix='occasion' + troc_intent=true.
   *  Le user devra photographier son ancien livre après validation panier. */
  const setTrocIntent = (idx: number, intent: boolean) =>
    setItems(prev => prev.map((it, i) => i === idx && isOccasionableType(it.type)
      ? { ...it, choix: 'occasion' as const, troc_intent: intent }
      : it));
  const setGamme = (idx: number, g: Gamme) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, gamme: g } : it));
  const [confirmDupIdx, setConfirmDupIdx] = useState<number | null>(null);
  const duplicateItem = (idx: number) => setConfirmDupIdx(idx);
  const performDuplicate = () => {
    if (confirmDupIdx === null) return;
    const idx = confirmDupIdx;
    const src = items[idx];
    if (!src) { setConfirmDupIdx(null); return; }
    setItems(prev => {
      const s = prev[idx];
      if (!s) return prev;
      const copy: ProgrammeItem = { ...s, quantite: 1, selected: true };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
    toast({ title: 'Article dupliqué', description: src.titre });
    setConfirmDupIdx(null);
  };

  const allSelected = items.length > 0 && items.every(it => it.selected);
  const selectedCount = items.filter(it => it.selected).length;
  const occasionCount = useMemo(() =>
    items.filter(it => it.selected && it.choix === 'occasion').length, [items]);
  const totalEstime = useMemo(() => items
    .filter(it => it.selected && it.prix && it.prix > 0)
    .reduce((sum, it) => sum + effectivePrice(it) * (it.quantite ?? 1), 0),
    [items]);

  // ✅ 2026-05-14 : Champ de recherche/filtre sur les items chargés.
  // Insensible casse+accents. Filtre titre/matière/éditeur/auteur.
  const [filterQuery, setFilterQuery] = useState('');
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /** Items regroupés par rubrique : livres → cahiers → fournitures.
   *  Filtré par filterQuery. */
  const groupedItems = useMemo(() => {
    const q = norm(filterQuery.trim());
    const buckets: Record<CategorieAffichage, { item: ProgrammeItem; idx: number }[]> = {
      livres: [], cahiers: [], fournitures: [],
    };
    items.forEach((item, idx) => {
      // Filtre : si query active, l'item doit matcher dans un des champs textuels
      if (q) {
        const hit = [item.titre, item.matiere, item.editeur, item.auteur]
          .filter(Boolean)
          .some(f => norm(String(f)).includes(q));
        if (!hit) return;
      }
      buckets[categorieDe(item.type)].push({ item, idx });
    });
    return (['livres', 'cahiers', 'fournitures'] as CategorieAffichage[])
      .filter(cat => buckets[cat].length > 0)
      .map(cat => ({ cat, entries: buckets[cat] }));
  }, [items, filterQuery]);

  const doAddToCart = (enfantId: string) => {
    const selected = items.filter(it => it.selected);
    if (!selected.length) {
      toast({ title: 'Sélectionnez au moins un article', variant: 'destructive' });
      return;
    }
    setSaving(true);
    addItems(selected.map(it => ({
      enfantId,
      titre: it.titre,
      auteur: it.auteur,
      matiere: it.matiere,
      type: it.type,
      editeur: it.editeur,
      prixNeuf: effectivePrice(it) || it.prix,
      quantite: it.quantite ?? 1,
      choix: it.choix,
      troc_intent: it.troc_intent || undefined,
      gamme: isGammeableType(it.type) ? (it.gamme || 'standard') : undefined,
    })));
    setSaving(false);
    // Si au moins un item est en mode Échange → bascule sur /troc-prep
    // pour photographier le livre à donner. Sinon flow normal vers /recap.
    const trocCount = selected.filter(it => it.choix === 'occasion' && it.troc_intent).length;
    toast({
      title: `${selected.length} article${selected.length > 1 ? 's' : ''} ajouté${selected.length > 1 ? 's' : ''} à votre sélection`,
      description: trocCount > 0
        ? `${trocCount} en échange — photographiez les livres à donner.`
        : undefined,
    });
    if (trocCount > 0) {
      setTimeout(() => navigate('/troc-prep'), 200);
    } else {
      navigate('/recap');
    }
  };

  const handleAddToCart = () => {
    // Si aucun enfant : créer un enfant minimal rattaché à cet établissement et cette classe
    if (enfants.length === 0) {
      if (!classeNom) {
        toast({ title: 'Sélectionnez une classe', variant: 'destructive' });
        return;
      }
      const newEnfant: Enfant = addEnfant({
        systeme,
        niveau: niveauNom,
        classe: classeNom,
        pays,
        systemeId,
        etablissementId: etablissement?.id,
        etablissementNom: etablissement?.nom,
      });
      doAddToCart(newEnfant.id);
      return;
    }
    if (!selectedEnfantId) {
      toast({ title: 'Sélectionnez un enfant', variant: 'destructive' });
      return;
    }
    doAddToCart(selectedEnfantId);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Modale de confirmation de duplication */}
      {confirmDupIdx !== null && items[confirmDupIdx] && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
             onClick={() => setConfirmDupIdx(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 sm:pb-6"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <Copy className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-base leading-tight">Dupliquer cet article ?</h3>
                <p className="text-sm text-gray-600 mt-0.5 truncate" title={items[confirmDupIdx]?.titre}>
                  {items[confirmDupIdx]?.titre}
                </p>
              </div>
            </div>
            <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
              Une copie sera ajoutée juste après — utile pour acheter le même article pour un autre enfant.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDupIdx(null)}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm">
                Annuler
              </button>
              <button onClick={performDuplicate}
                className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm">
                Dupliquer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20" aria-label="Retour">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">YUKPO</span>
              <h1 className="font-bold text-lg leading-tight mt-0.5">Programme par école</h1>
              <p className="text-amber-100 text-xs">Consultez la liste officielle d'une école et d'une classe</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* ✅ 2026-05-15 : En mode national pur (?reset=1), on cache le sélecteur
            d'école : l'user vient pour le programme national, pas besoin de lui
            re-proposer de choisir une école (retour navigation pour ça). */}
        {!resetMode && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">École</p>
            <button
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl border border-gray-200 hover:border-amber-300 text-left bg-white"
            >
              <div className="flex items-center gap-2 min-w-0">
                <School className="w-4 h-4 text-amber-600 shrink-0" />
                {etablissement ? (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{etablissement.nom}</p>
                    {etablissement.ville && <p className="text-xs text-gray-500 truncate">{etablissement.ville}</p>}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Choisir une école partenaire…</span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>

            {!etablissement ? (
              <div className="mt-2 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <span className="text-emerald-600 mt-0.5">✓</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-emerald-800">Programme national (par défaut)</p>
                  <p className="text-[10px] text-emerald-700 leading-snug">
                    Vous pouvez aussi choisir votre école partenaire ci-dessus pour voir SA liste exacte.
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEtablissement(null)}
                className="mt-2 w-full text-left flex items-center gap-2 text-[11px] text-amber-700 hover:text-amber-800 px-2 py-1.5 rounded-lg hover:bg-amber-50"
              >
                <X className="w-3 h-3" />
                Revenir au programme national
              </button>
            )}
          </div>
        )}

        {/* ✅ 2026-05-13 : Sélecteur de classe unifié — ClasseAutocomplete
            intelligent (fuzzy/alias/accents) au lieu du multi-step manuel
            pays/système/niveau/classe/série. Si un établissement est choisi,
            on restreint les suggestions aux classes effectivement présentes
            dans son programme (allowedClasses). Sinon → toutes les classes
            du pays par défaut. */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-3">
          <p className="text-[10px] text-gray-500 mb-1 leading-snug">
            💡 Tapez le nom de votre classe (ex : « 6ème », « CP », « Tle A », « Petite Section »…). Le programme s'affichera automatiquement.
            {etablissement && classesDispo && (
              <span className="block mt-0.5 text-amber-700 font-medium">
                Suggestions limitées aux {classesDispo.length} classe{classesDispo.length > 1 ? 's' : ''} proposée{classesDispo.length > 1 ? 's' : ''} par {etablissement.nom}.
              </span>
            )}
          </p>
          <ClasseAutocomplete
            initialPays={pays}
            /* ✅ 2026-05-15 : Pays toujours caché — l'app connaît le pays
                de l'user (paramètre initialPays seedé). En mode national
                ou en mode école, on ne demande JAMAIS de choisir le pays. */
            showPaysSelector={false}
            placeholder={classeNom ? `Classe active : ${classe} — tapez pour changer…` : 'Cherchez votre classe…'}
            allowedClasses={classesDispo}
            onSelect={(sel: ClasseSelection) => {
              setPays(sel.pays);
              setSystemeId(sel.systemeId);
              setNiveauNom(sel.niveau);
              // sel.classe peut contenir la série déjà (ex: "2nde A"),
              // on délègue à parseClasseAndSerie pour scinder proprement.
              const parsed = parseClasseAndSerie(sel.classe, sel.systemeId, sel.niveau);
              setClasseNom(parsed.classeNom);
              setSerieCode(parsed.serieCode || sel.serie || '');
            }}
          />
        </div>

        {/* ✅ 2026-05-15 : Bloc "Ajouter pour..." retiré (workflow class-only).
            Le seul enfant interne actif est celui dont la classe correspond ;
            si plusieurs sont stockés, le panier les agrège côté Recap. */}

        {/* États : loading / error / vide */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center justify-center mb-3">
            <Loader2 className="w-6 h-6 text-amber-600 animate-spin mb-2" />
            <p className="text-sm text-gray-500">Chargement du programme…</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && loaded && items.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
            <p className="text-sm text-amber-800 font-semibold mb-1">Aucun programme trouvé</p>
            <p className="text-xs text-amber-700">
              Aucune liste officielle n'a été trouvée pour cette école et cette classe.
              Essayez sans préciser l'école pour voir le programme national, ou scannez la liste.
            </p>
          </div>
        )}

        {/* ✅ 2026-05-15 : Description "Cochez les livres..." DÉPLACÉE
            avant le résumé statistique. Explique le workflow à l'user
            (toggle Neuf/Occasion/Échange) avant qu'il ne voie les chiffres. */}
        {loaded && items.some(it => isOccasionableType(it.type)) && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-[11px] text-amber-900 leading-snug">
              💡 Cochez les livres voulus, puis choisissez par item :
              <strong className="text-emerald-700"> Neuf</strong> (plein tarif),
              <strong className="text-orange-700"> Occasion</strong> (usagé moins cher) ou
              <strong className="text-cyan-700"> Échange</strong> (vous donnez votre ancien livre contre crédit).
            </p>
          </div>
        )}

        {/* Bandeau récap sélection + lien tout désélectionner — contient
            déjà le total estimé, donc plus de ruban sticky séparé. */}
        {loaded && items.length > 0 && (
          <div className="bg-amber-100 border border-amber-200 rounded-2xl p-3 mb-3 flex items-center justify-between">
            <div className="text-amber-900">
              <p className="text-sm font-semibold">
                {items.length} article{items.length > 1 ? 's' : ''} · {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
              </p>
              {occasionCount > 0 && (
                <p className="text-[11px] text-orange-700 font-medium">{occasionCount} en occasion</p>
              )}
              {totalEstime > 0 && (
                <p className="text-xs">Total estimé : <strong>{formatPrix(totalEstime, pays)}</strong></p>
              )}
            </div>
            <button onClick={allSelected ? deselectAll : selectAll}
              className="flex items-center gap-1 text-amber-700 text-xs font-semibold">
              {allSelected ? <Minus className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>
        )}

        {/* ✅ 2026-05-15 : Ruban "TOTAL ESTIMÉ" sticky retiré — l'information
            est déjà dans le résumé statistique au-dessus. Évite la redondance. */}

        {/* ✅ 2026-05-14 : Champ de recherche/filtre sur les items affichés.
            Insensible casse+accents, filtre titre/matière/éditeur/auteur. */}
        {loaded && items.length > 0 && (
          <div className="mb-3 relative">
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Rechercher (titre, matière, éditeur)…"
              className="w-full px-3 py-2 pl-9 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:bg-white"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-1"
                aria-label="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {filterQuery && (
              <p className="mt-1 text-[11px] text-gray-500">
                {groupedItems.reduce((sum, g) => sum + g.entries.length, 0)} résultat(s)
              </p>
            )}
          </div>
        )}

        {/* Tableau regroupé par rubrique avec lignes compactes */}
        {loaded && items.length > 0 && (
          <div className="space-y-3">
            {groupedItems.map(({ cat, entries }) => {
              const style = categorieStyle[cat];
              return (
                <div key={cat} className={`rounded-2xl border ${style.border} overflow-hidden bg-white`}>
                  <div className={`flex items-center justify-between px-3 py-2 ${style.bg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${style.text}`}>
                        {categorieLabel[cat]}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-semibold">
                      {entries.length} article{entries.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {entries.map(({ item, idx: i }) => {
                      // Match cross-flow : ce livre est-il déjà couvert par un troc
                      // en cours du parent ? classeCible = classe affichée ici (= classe
                      // à venir de l'enfant). Le pool est matché sur classe_souhaitee
                      // (next-class), donc un troc 6ème→5ème grise bien le 5ème équivalent.
                      const trocMatch = isOccasionableType(item.type)
                        ? findMatchInPool({
                            titre: item.titre,
                            matiere: item.matiere,
                            classeCible: classe,
                          })
                        : null;
                      const lockedByPool = !!trocMatch;
                      return (
                      <div key={i}
                        className={`px-2.5 py-1.5 transition-colors ${
                          lockedByPool
                            ? 'bg-cyan-50/60 opacity-70'
                            : item.selected ? 'bg-amber-50/60' : 'bg-white hover:bg-gray-50'
                        }`}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => !lockedByPool && toggleItem(i)}
                            disabled={lockedByPool}
                            className="shrink-0"
                            aria-label={lockedByPool ? 'Déjà couvert par votre échange' : 'Sélectionner'}
                            title={lockedByPool ? 'Déjà couvert par votre échange en cours' : undefined}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                              lockedByPool
                                ? 'bg-cyan-100 border-cyan-300 cursor-not-allowed'
                                : item.selected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                            }`}>
                              {lockedByPool
                                ? <span className="text-cyan-700 text-[10px] font-bold leading-none">⇄</span>
                                : item.selected && <span className="text-white text-xs font-bold leading-none">✓</span>}
                            </div>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {(item.type as string) === 'workbook' && (
                                <span className="text-[9px] font-bold bg-teal-100 text-teal-700 px-1 py-0.5 rounded shrink-0 leading-none uppercase">Wb</span>
                              )}
                              {item.type === 'livre' && (
                                <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 py-0.5 rounded shrink-0 leading-none uppercase">Livre</span>
                              )}
                              {lockedByPool && (
                                <span className="text-[9px] font-bold bg-cyan-100 text-cyan-700 px-1 py-0.5 rounded shrink-0 leading-none uppercase">Troc</span>
                              )}
                              <p className={`text-[13px] font-semibold leading-tight truncate ${
                                lockedByPool ? 'text-cyan-800' : item.selected ? 'text-amber-900' : 'text-gray-800'
                              }`} title={item.titre} dir="auto">
                                {item.titre}
                              </p>
                            </div>
                            {lockedByPool && (
                              <p className="text-[10px] text-cyan-700 mt-0.5">
                                Déjà couvert par votre échange en cours
                                {trocMatch?.classe_actuelle && trocMatch?.classe_souhaitee
                                  ? ` (${trocMatch.classe_actuelle} → ${trocMatch.classe_souhaitee})`
                                  : ''}
                              </p>
                            )}
                            {(item.auteur || item.editeur || item.source === 'etablissement') && (
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-gray-500 leading-tight" dir="auto">
                                {item.auteur && (
                                  <span className="truncate max-w-[110px]" title={item.auteur}>{item.auteur}</span>
                                )}
                                {item.auteur && item.editeur && <span className="text-gray-300">·</span>}
                                {item.editeur && (
                                  <span className="truncate max-w-[110px] text-purple-700" title={`Éditeur : ${item.editeur}`}>
                                    {item.editeur}
                                  </span>
                                )}
                                {item.source === 'etablissement' && (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.5 rounded">
                                    École
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-md shrink-0 overflow-hidden">
                            <button onClick={() => adjustQuantite(i, -1)}
                              disabled={(item.quantite ?? 1) <= 1}
                              className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-base leading-none"
                              aria-label="Diminuer">−</button>
                            <span className="text-xs font-bold text-gray-800 w-5 text-center tabular-nums leading-none">
                              {item.quantite ?? 1}
                            </span>
                            <button onClick={() => adjustQuantite(i, 1)}
                              className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-base leading-none"
                              aria-label="Augmenter">+</button>
                          </div>

                          {/* ✅ 2026-05-16 — Affichage prix dynamique selon le
                              choix Neuf/Occasion/Échange. Cohérent avec Recap. */}
                          {(() => {
                            const pd = priceTextForItem(item);
                            if (pd.text === '—') return null;
                            return (
                              <div className="flex flex-col items-end shrink-0 leading-tight">
                                <span className="text-right text-[11px] font-bold text-amber-700 tabular-nums whitespace-nowrap">
                                  {pd.text}
                                </span>
                                {pd.subtext && (
                                  <span className="text-[8px] text-gray-500 italic leading-none mt-0.5">
                                    {pd.subtext}
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          <button onClick={() => duplicateItem(i)}
                            className="w-5 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-700 shrink-0"
                            title="Dupliquer cet article" aria-label="Dupliquer">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>

                        {(isOccasionableType(item.type) || (isGammeableType(item.type) && item.prix && item.prix > 0)) && (
                          <div className="flex items-center gap-2 mt-1 ml-7">
                            {isOccasionableType(item.type) && (
                              <div className="inline-flex bg-gray-100 rounded-md p-0.5 gap-0.5 items-center">
                                <span className="text-[9px] text-gray-400 uppercase font-bold pl-1.5 pr-0.5">État</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setChoix(i, 'neuf'); }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                    item.choix === 'neuf' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                                  }`}
                                  title="Achat neuf — plein tarif, livraison rapide"
                                >Neuf</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setTrocIntent(i, false); }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                    item.choix === 'occasion' && !item.troc_intent ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                                  }`}
                                  title="Achat d'occasion — moins cher, sans rien donner en échange"
                                >Occasion</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setTrocIntent(i, true); }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                    item.choix === 'occasion' && item.troc_intent ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                                  }`}
                                  title="Échange — vous donnez votre ancien livre contre crédit"
                                >Échange</button>
                              </div>
                            )}
                            {/* Mini-descriptif contextuel selon le mode actif */}
                            {isOccasionableType(item.type) && item.selected && (
                              <p className="text-[10px] text-gray-500 leading-snug flex-1 min-w-0">
                                {item.choix === 'neuf' && 'Plein tarif, livraison rapide.'}
                                {item.choix === 'occasion' && !item.troc_intent && "Exemplaire usagé, moins cher. Vous n'avez rien à donner en échange."}
                                {item.choix === 'occasion' && item.troc_intent && 'Vous donnez votre ancien livre contre un crédit Yukpo utilisable sur cet achat.'}
                              </p>
                            )}
                            {isGammeableType(item.type) && item.prix && item.prix > 0 && (
                              <div className="inline-flex items-center gap-1">
                                <span className="text-[9px] text-gray-400 uppercase font-bold">Gamme</span>
                                <GammeSelector
                                  prixOfficiel={item.prix}
                                  gamme={item.gamme || 'standard'}
                                  devise={DEVISE_LOCALE_PAR_PAYS[pays] ?? 'XAF'}
                                  onChange={(g) => setGamme(i, g)}
                                  variant="inline"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                  {/* ✅ 2026-05-14 : Bouton "+ Ajouter manuellement" en footer
                      de chaque section (Manuels/Cahiers/Fournitures), comme
                      dans SuggestionsModal. Recherche cross-classes via le
                      même endpoint /api/v2/parent/articles-search. */}
                  <ManualAddInline
                    cat={cat}
                    pays={pays}
                    onPick={(picked: ManualAddItem) => {
                      const rawType = String(picked.type_article || 'livre').toLowerCase();
                      const itemType: TypeItem = (
                        rawType === 'workbook' ? 'livre'
                        : (rawType === 'livre' || rawType === 'cahier' || rawType === 'fourniture' || rawType === 'autre')
                          ? (rawType as TypeItem)
                          : 'fourniture'
                      );
                      // Évite doublons par titre normalisé.
                      const newTitre = picked.titre.trim().toLowerCase();
                      if (items.some(it => it.titre.trim().toLowerCase() === newTitre)) {
                        toast({ title: 'Déjà dans la liste', description: picked.titre });
                        return;
                      }
                      setItems(prev => [
                        ...prev,
                        {
                          titre: picked.titre,
                          auteur: picked.auteur ?? undefined,
                          matiere: picked.matiere ?? undefined,
                          editeur: picked.editeur ?? undefined,
                          type: itemType,
                          quantite: typeof picked.quantite_defaut === 'number' ? picked.quantite_defaut : 1,
                          prix: typeof picked.prix_officiel === 'number' ? picked.prix_officiel : undefined,
                          source: 'suggestion',
                          selected: true,
                          choix: 'neuf' as const,
                        },
                      ]);
                      toast({ title: 'Article ajouté', description: picked.titre });
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ✅ 2026-05-15 : Le grand bloc "Choisissez votre classe..." a été
            retiré — redondant avec le mini-hint au-dessus du ClasseAutocomplete.
            En mode national, on est minimaliste : hint + champ, c'est tout. */}

        {/* État classe choisie mais programme pas encore chargé (rare, transition) */}
        {!loading && !error && !loaded && classeNom && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin mb-2" />
            <p className="text-sm text-gray-600">Chargement du programme…</p>
          </div>
        )}
      </div>

      {/* ✅ 2026-05-16 — CTA Ajouter à ma sélection.
          Bouton TRÈS visible + bannière d'avertissement orange clignotante
          au-dessus quand l'user a coché des articles. Évite que l'user
          quitte la page sans valider et arrive sur un récap vide. */}
      {loaded && items.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40 max-w-2xl mx-auto">
          {selectedCount > 0 && (
            <div className="mb-1 bg-amber-100 border-2 border-amber-400 rounded-xl px-3 py-2 text-center animate-pulse">
              <p className="text-[11px] font-bold text-amber-900">
                ⚠️ Vous avez {selectedCount} article{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''} —
                cliquez le bouton ci-dessous pour les ajouter à votre commande
              </p>
            </div>
          )}
          <button
            disabled={selectedCount === 0 || saving}
            onClick={handleAddToCart}
            className={`w-full text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg ${
              selectedCount === 0 || saving
                ? 'bg-gray-300 text-gray-500'
                : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 ring-4 ring-amber-300/50'
            }`}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
            {selectedCount === 0
              ? 'Cochez des articles ci-dessus pour les ajouter'
              : `➕ Ajouter ${selectedCount} article${selectedCount > 1 ? 's' : ''} à ma commande`}
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
      )}

      {/* Picker établissement */}
      {showPicker && (
        <EcolePickerPopover
          currentNom={etablissement?.nom}
          gps={gps}
          onSelect={(etab) => setEtablissement({ id: etab.id, nom: etab.nom, ville: etab.ville })}
          onClose={() => setShowPicker(false)}
          onSkipToNational={() => setEtablissement(null)}
          title="École partenaire ou programme national ?"
          placeholder="Nom de l'école partenaire…"
        />
      )}
    </div>
  );
};

export default BrowseProgrammeByEtablissementPage;
