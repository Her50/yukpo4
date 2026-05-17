// ============================================================================
// CahiersAccessoiresPage — Liste agrégée multi-classes
// ============================================================================
// L'utilisateur déclare ses classes + nombre d'enfants par classe. Le backend
// agrège les cahiers/accessoires de `accessoires_populaires_par_classe` sur
// toutes les classes et renvoie la somme + breakdown par classe.
//
// UX :
//   - Pills classes pré-remplies depuis localStorage `enfants` (workflow class-only)
//   - Chaque classe : badge nb_enfants éditable (défaut 1) + bouton X
//   - "+ Ajouter une classe" → ouvre ClasseAutocomplete inline
//   - Table : Titre / Qté agrégée / Prix unitaire / Total / Détail par classe
//   - Modif qté + delete article inline
//   - Total général en bas, CTA ajouter au panier
// ============================================================================

import { ArrowLeft, ChevronRight, Loader2, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ClasseAutocomplete, { type ClasseSelection } from '../../components/livres-scolaires/ClasseAutocomplete';
import { PAYS_PAR_DEFAUT, type PaysCode } from '../../data/schoolSystemsLegacy';
import { useToast } from '../../hooks/use-toast';
import { useParentShop, type Enfant } from '../../hooks/useParentShop';
import { apiPost } from '../../services/apiService';

interface ClasseSelectionEntry {
  classe: string;
  niveau?: string;
  systemeId?: string;
  pays?: PaysCode;
  nb_enfants: number;
}

interface BreakdownClasse {
  classe: string;
  quantite_par_enfant: number;
  nb_enfants: number;
  sous_total: number;
}

interface ItemAgrege {
  nom: string;
  nom_normalise: string;
  gamme_defaut?: string | null;
  /** ✅ 2026-05-15 : prix selon la gamme choisie par l'user.
   *  - prix_standard = prix médian (par défaut)
   *  - prix_premium  = prix max (haut de gamme)
   *  Le frontend bascule entre les deux via un toggle global ou per-item. */
  prix_standard?: number | null;
  prix_premium?: number | null;
  /** Conservé pour rétro-compat — équivalent à prix_standard. */
  prix_median?: number | null;
  devise?: string | null;
  occurrences_total: number;
  quantite_totale: number;
  breakdown: BreakdownClasse[];
}

/** Niveau de gamme sélectionné pour un article. */
type Gamme = 'standard' | 'premium';

const CahiersAccessoiresPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { enfants, addItems, addEnfant } = useParentShop();

  // ──── Pré-remplissage des classes depuis les enfants connus en localStorage.
  // Dédoublonne par (classe, systemeId) — si plusieurs enfants ont la même
  // classe, on les agrège en incrémentant nb_enfants.
  const [classesSelected, setClassesSelected] = useState<ClasseSelectionEntry[]>(() => {
    const map = new Map<string, ClasseSelectionEntry>();
    for (const e of enfants) {
      const key = `${(e.systemeId || '').toLowerCase()}|${e.classe.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.nb_enfants += 1;
      } else {
        map.set(key, {
          classe: e.classe,
          niveau: e.niveau,
          systemeId: e.systemeId,
          pays: e.pays,
          nb_enfants: 1,
        });
      }
    }
    return Array.from(map.values());
  });

  // Pays effectif : on prend celui de la 1ère classe, sinon défaut.
  const paysActif: PaysCode = classesSelected[0]?.pays || PAYS_PAR_DEFAUT;

  // ──── Modificateurs classes ────
  const updateNbEnfants = (idx: number, delta: number) => {
    setClassesSelected(prev =>
      prev.map((c, i) => (i === idx ? { ...c, nb_enfants: Math.max(1, c.nb_enfants + delta) } : c)),
    );
  };
  const removeClasse = (idx: number) => {
    setClassesSelected(prev => prev.filter((_, i) => i !== idx));
  };
  const [showAddClasse, setShowAddClasse] = useState(false);
  const onAddClasse = (sel: ClasseSelection) => {
    setClassesSelected(prev => {
      const key = `${(sel.systemeId || '').toLowerCase()}|${sel.classe.toLowerCase()}`;
      if (prev.some(c => `${(c.systemeId || '').toLowerCase()}|${c.classe.toLowerCase()}` === key)) {
        toast({ title: t('bourse.cahiers.classe_already_added', { defaultValue: 'Classe déjà ajoutée' }) });
        return prev;
      }
      return [
        ...prev,
        { classe: sel.classe, niveau: sel.niveau, systemeId: sel.systemeId, pays: sel.pays, nb_enfants: 1 },
      ];
    });
    setShowAddClasse(false);
  };

  // ──── Fetch agrégation ────
  const [items, setItems] = useState<ItemAgrege[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** Qte modifiée manuellement par l'user. Override la qte agrégée par défaut.
   *  Map nom_normalise → qte. Si absent → on prend item.quantite_totale.
   *  Si 0 → l'item est supprimé visuellement. */
  const [qteOverrides, setQteOverrides] = useState<Record<string, number>>({});
  /** Items explicitement supprimés (icône poubelle). nom_normalise → true. */
  const [deletedItems, setDeletedItems] = useState<Record<string, boolean>>({});
  /** ✅ 2026-05-15 : Gamme globale appliquée par défaut à tous les items.
   *  L'user peut basculer entre 'standard' et 'premium' depuis le header. */
  const [globalGamme, setGlobalGamme] = useState<Gamme>('standard');
  /** Override per-item : si présent, force la gamme de CET item (l'user
   *  veut un haut de gamme spécifique tout en restant en standard pour le
   *  reste). nom_normalise → 'standard' | 'premium'. */
  const [gammeOverrides, setGammeOverrides] = useState<Record<string, Gamme>>({});

  const getGammeFor = (nomNorm: string): Gamme => gammeOverrides[nomNorm] ?? globalGamme;
  const getPriceFor = (it: ItemAgrege): number => {
    const g = getGammeFor(it.nom_normalise);
    if (g === 'premium') {
      return it.prix_premium ?? (it.prix_standard ? it.prix_standard * 1.5 : 0);
    }
    return it.prix_standard ?? it.prix_median ?? 0;
  };

  useEffect(() => {
    if (classesSelected.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await apiPost('/api/v2/parent/fournitures-aggregees', {
          classes: classesSelected.map(c => ({ classe: c.classe, nb_enfants: c.nb_enfants })),
          pays: paysActif,
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
        }
        setItems((data?.items || []) as ItemAgrege[]);
        // Reset overrides quand les classes changent — sinon les overrides
        // d'une session précédente fausseraient les nouvelles agrégations.
        setQteOverrides({});
        setDeletedItems({});
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Impossible de charger les fournitures');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classesSelected, paysActif]);

  // ──── Items affichés (avec overrides + suppressions) ────
  const itemsAffiches = useMemo(() => {
    return items
      .filter(it => !deletedItems[it.nom_normalise])
      .map(it => ({
        ...it,
        quantite_effective: qteOverrides[it.nom_normalise] ?? it.quantite_totale,
      }));
  }, [items, qteOverrides, deletedItems]);

  const totalGeneral = useMemo(() => {
    return itemsAffiches.reduce((sum, it) => {
      const prix = getPriceFor(it);
      return sum + prix * it.quantite_effective;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsAffiches, globalGamme, gammeOverrides]);

  // ──── Actions panier ────
  const onAjouterAuPanier = () => {
    if (itemsAffiches.length === 0) {
      toast({
        title: t('bourse.cahiers.no_items', { defaultValue: 'Aucun article à ajouter.' }),
        variant: 'destructive',
      });
      return;
    }
    // ✅ 2026-05-17 — Si pas encore d'enfant en useParentShop mais qu'on a
    // bien des classes sélectionnées localement (via ClasseAutocomplete),
    // on auto-crée un enfant à la volée à partir de la 1ère classe pour
    // permettre l'ajout au panier. Avant ce fix, l'utilisateur recevait
    // "Ajoutez d'abord une classe via le bouton École ou Scan" alors qu'il
    // avait bien sélectionné une classe sur cette page (états séparés).
    //
    // Important : `addEnfant` retourne directement l'enfant créé (avec son
    // id), ce qui évite le problème de closure stale sur `enfants` (le
    // setState est asynchrone donc `enfants` reste vide dans cette closure
    // même après l'appel à `addEnfant`).
    let targetEnfant: Enfant | undefined = enfants[0];
    if (!targetEnfant) {
      if (classesSelected.length === 0) {
        toast({
          title: t('bourse.cahiers.no_enfant_warning', {
            defaultValue: 'Sélectionnez d\'abord une classe.',
          }),
          variant: 'destructive',
        });
        return;
      }
      const first = classesSelected[0];
      const systeme: 'francophone' | 'anglophone' =
        first.systemeId && first.systemeId.toLowerCase().endsWith('-en')
          ? 'anglophone'
          : 'francophone';
      targetEnfant = addEnfant({
        systeme,
        niveau: first.niveau || '',
        classe: first.classe,
        pays: first.pays,
        systemeId: first.systemeId,
      });
    }
    if (!targetEnfant) {
      toast({
        title: t('bourse.cahiers.no_items', { defaultValue: 'Aucune classe disponible.' }),
        variant: 'destructive',
      });
      return;
    }
    const toAdd = itemsAffiches.map(it => {
      const g = getGammeFor(it.nom_normalise);
      return {
        enfantId: targetEnfant.id,
        titre: it.nom,
        type: 'fourniture' as const,
        // ✅ 2026-05-15 : prix selon la gamme effective choisie par l'user
        prixNeuf: getPriceFor(it) || undefined,
        choix: 'neuf' as const,
        quantite: it.quantite_effective,
        gamme: (g === 'premium' ? 'premium' : 'standard') as any,
      };
    });
    addItems(toAdd);
    toast({
      title: t('bourse.cahiers.added_to_cart', {
        defaultValue: '{{count}} article(s) ajouté(s) au panier',
        count: toAdd.length,
      }),
    });
    navigate('/recap');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20" aria-label="Retour">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">YUKPO</span>
              <h1 className="font-bold text-lg leading-tight mt-0.5">
                {t('bourse.cahiers.page_title', { defaultValue: 'Cahiers & Accessoires' })}
              </h1>
              <p className="text-amber-100 text-xs">
                {t('bourse.cahiers.page_subtitle', {
                  defaultValue: 'Liste agrégée sur toutes vos classes — modifiable',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* ──── Section classes sélectionnées ──── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-3">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
            {t('bourse.cahiers.classes_label', { defaultValue: 'Mes classes' })}
          </p>
          {classesSelected.length === 0 ? (
            <p className="text-xs text-gray-500 mb-3">
              {t('bourse.cahiers.no_classes_yet', {
                defaultValue: 'Ajoutez vos classes pour voir la liste de cahiers/accessoires.',
              })}
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              {classesSelected.map((c, idx) => (
                <div key={`${c.systemeId}-${c.classe}`} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 truncate">{c.classe}</p>
                    {c.niveau && <p className="text-[10px] text-amber-700 truncate">{c.niveau}</p>}
                  </div>
                  {/* Stepper nb_enfants */}
                  <div className="inline-flex items-center bg-white border border-amber-300 rounded-md overflow-hidden">
                    <button
                      onClick={() => updateNbEnfants(idx, -1)}
                      className="w-7 h-7 flex items-center justify-center text-amber-700 hover:bg-amber-100 disabled:opacity-30 text-base"
                      disabled={c.nb_enfants <= 1}
                      aria-label="−"
                    >−</button>
                    <div className="flex flex-col items-center px-2">
                      <span className="text-xs font-bold text-amber-900 tabular-nums leading-none">{c.nb_enfants}</span>
                      <span className="text-[8px] text-amber-700 uppercase font-bold">
                        {t('bourse.cahiers.enfants_unit', { defaultValue: 'enf.' })}
                      </span>
                    </div>
                    <button
                      onClick={() => updateNbEnfants(idx, 1)}
                      className="w-7 h-7 flex items-center justify-center text-amber-700 hover:bg-amber-100 text-base"
                      aria-label="+"
                    >+</button>
                  </div>
                  <button
                    onClick={() => removeClasse(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700"
                    aria-label={t('bourse.cahiers.remove_classe', { defaultValue: 'Retirer cette classe' })}
                    title={t('bourse.cahiers.remove_classe', { defaultValue: 'Retirer cette classe' })}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bouton + Ajouter une classe */}
          {!showAddClasse ? (
            <button
              onClick={() => setShowAddClasse(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-700 border border-dashed border-amber-300 rounded-lg hover:bg-amber-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('bourse.cahiers.add_classe', { defaultValue: 'Ajouter une classe' })}
            </button>
          ) : (
            <div className="border border-amber-300 rounded-lg p-2 bg-amber-50/50">
              <ClasseAutocomplete
                showPaysSelector={classesSelected.length === 0}
                initialPays={paysActif}
                onSelect={onAddClasse}
                placeholder={t('bourse.cahiers.classe_placeholder', {
                  defaultValue: 'Cherchez une classe (6ème, CP, Tle A…)',
                })}
              />
              <button
                onClick={() => setShowAddClasse(false)}
                className="mt-2 w-full px-3 py-1.5 text-[11px] text-gray-600 hover:text-gray-800"
              >
                {t('bourse.cahiers.cancel_add', { defaultValue: 'Annuler' })}
              </button>
            </div>
          )}
        </div>

        {/* ──── Total estimé sticky + toggle gamme globale ──── */}
        {!loading && totalGeneral > 0 && (
          <div className="sticky top-0 z-20 mb-2 bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-2 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wide">
                  {t('bourse.cahiers.total_label', { defaultValue: 'Total estimé' })}
                </span>
                <span className="text-[10px] text-gray-600">
                  {t('bourse.cahiers.items_count', {
                    defaultValue: '{{count}} article(s)',
                    count: itemsAffiches.length,
                  })}
                </span>
              </div>
              <span className="text-base font-bold text-amber-700 tabular-nums">
                {totalGeneral.toLocaleString('fr-FR')} XAF
              </span>
            </div>
            {/* ✅ 2026-05-15 : Toggle Standard / Haut de gamme appliqué à
                TOUS les articles. Cliquer reset aussi les overrides per-item
                pour que la sélection soit cohérente. */}
            <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
              <span className="text-[10px] text-gray-600 font-semibold">
                {t('bourse.cahiers.gamme_label', { defaultValue: 'Gamme :' })}
              </span>
              <div className="inline-flex bg-white rounded-md border border-gray-300 overflow-hidden shadow-sm">
                <button
                  onClick={() => { setGlobalGamme('standard'); setGammeOverrides({}); }}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    globalGamme === 'standard'
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t('bourse.cahiers.gamme_standard', { defaultValue: 'Standard' })}
                </button>
                <button
                  onClick={() => { setGlobalGamme('premium'); setGammeOverrides({}); }}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-colors border-l border-gray-300 ${
                    globalGamme === 'premium'
                      ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ✨ {t('bourse.cahiers.gamme_premium', { defaultValue: 'Haut de gamme' })}
                </button>
              </div>
              <span className="text-[9px] text-gray-400 italic flex-1 text-right truncate">
                {t('bourse.cahiers.gamme_hint', {
                  defaultValue: 'Cliquez sur un article pour le changer individuellement',
                })}
              </span>
            </div>
          </div>
        )}

        {/* ──── États ──── */}
        {loading && (
          <div className="text-center py-10">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-gray-500 mt-2">
              {t('bourse.cahiers.loading', { defaultValue: 'Construction de la liste…' })}
            </p>
          </div>
        )}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {!loading && !error && classesSelected.length > 0 && items.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm text-amber-800 font-semibold mb-1">
              {t('bourse.cahiers.empty_title', { defaultValue: 'Aucun article trouvé' })}
            </p>
            <p className="text-xs text-amber-700">
              {t('bourse.cahiers.empty_desc', {
                defaultValue: 'Aucun cahier/accessoire populaire n\'est référencé pour les classes sélectionnées.',
              })}
            </p>
          </div>
        )}

        {/* ──── Tableau agrégé ──── */}
        {!loading && itemsAffiches.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                {t('bourse.cahiers.section_title', { defaultValue: 'Cahiers & accessoires' })}
              </span>
              <span className="text-[10px] text-gray-500 font-semibold">
                {itemsAffiches.length} {t('bourse.cahiers.articles', { defaultValue: 'articles' })}
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {itemsAffiches.map(it => {
                const itemGamme = getGammeFor(it.nom_normalise);
                const prixCourant = getPriceFor(it);
                const isPremium = itemGamme === 'premium';
                return (
                <li key={it.nom_normalise} className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-[13px] text-gray-900" title={it.nom}>
                          {it.nom}
                        </p>
                        {/* ✅ 2026-05-17 : Toggle 2-boutons côte à côte (Standard | Haut
                            de gamme) au lieu d'un seul tag qui bascule. L'utilisateur
                            voit les 2 options et clique celle qu'il veut. Actif :
                            - Standard → vert (par défaut)
                            - Haut de gamme → doré */}
                        <div className="inline-flex items-center rounded overflow-hidden border border-gray-200 leading-none text-[9px] font-bold uppercase">
                          <button
                            onClick={() => {
                              if (!isPremium) return;
                              setGammeOverrides(prev => {
                                const next = { ...prev };
                                if (globalGamme === 'standard') delete next[it.nom_normalise];
                                else next[it.nom_normalise] = 'standard';
                                return next;
                              });
                            }}
                            className={`px-1.5 py-0.5 transition-colors ${
                              !isPremium
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                            title={t('bourse.cahiers.tag_toggle_standard', {
                              defaultValue: 'Standard (par défaut)',
                            })}
                          >
                            Standard
                          </button>
                          <button
                            onClick={() => {
                              if (isPremium) return;
                              setGammeOverrides(prev => {
                                const next = { ...prev };
                                if (globalGamme === 'premium') delete next[it.nom_normalise];
                                else next[it.nom_normalise] = 'premium';
                                return next;
                              });
                            }}
                            className={`px-1.5 py-0.5 transition-colors border-l border-gray-200 ${
                              isPremium
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                            title={t('bourse.cahiers.tag_toggle_premium', {
                              defaultValue: 'Haut de gamme',
                            })}
                          >
                            ✨ Haut de gamme
                          </button>
                        </div>
                      </div>
                      {/* Détail par classe (transparence) */}
                      <p className="text-[10px] text-gray-500 leading-snug mt-0.5">
                        {it.breakdown.map((b, i) => (
                          <span key={`${b.classe}-${i}`}>
                            {i > 0 ? ', ' : ''}
                            <span className="font-semibold">{b.sous_total}</span> × {b.classe}
                            {b.nb_enfants > 1 && (
                              <span className="text-gray-400"> ({b.nb_enfants} enf.)</span>
                            )}
                          </span>
                        ))}
                      </p>
                      {/* Prix unitaire + sous-total (selon gamme effective) */}
                      {prixCourant > 0 ? (
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className={`text-[10px] ${isPremium ? 'text-amber-600' : 'text-gray-400'}`}>
                            {prixCourant.toLocaleString('fr-FR')} {it.devise || 'XAF'} ×
                          </span>
                          <span className="text-[10px] text-gray-400">{it.quantite_effective}</span>
                          <span className={`text-[11px] font-bold tabular-nums ${isPremium ? 'text-amber-700' : 'text-amber-700'}`}>
                            = {(prixCourant * it.quantite_effective).toLocaleString('fr-FR')} {it.devise || 'XAF'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 mt-1 italic">
                          {t('bourse.cahiers.no_price', { defaultValue: 'Prix non renseigné' })}
                        </p>
                      )}
                    </div>

                    {/* Stepper qté (modifiable) */}
                    <div className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                      <button
                        onClick={() => setQteOverrides(prev => ({
                          ...prev,
                          [it.nom_normalise]: Math.max(0, it.quantite_effective - 1),
                        }))}
                        disabled={it.quantite_effective <= 0}
                        className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-base"
                        aria-label="−"
                      >−</button>
                      <span className="text-xs font-bold text-gray-800 w-7 text-center tabular-nums">
                        {it.quantite_effective}
                      </span>
                      <button
                        onClick={() => setQteOverrides(prev => ({
                          ...prev,
                          [it.nom_normalise]: it.quantite_effective + 1,
                        }))}
                        className="w-7 h-7 flex items-center justify-center text-amber-700 hover:bg-amber-100 text-base"
                        aria-label="+"
                      >+</button>
                    </div>

                    {/* Bouton suppression */}
                    <button
                      onClick={() => setDeletedItems(prev => ({ ...prev, [it.nom_normalise]: true }))}
                      className="p-1.5 text-gray-400 hover:text-red-600 shrink-0"
                      aria-label={t('bourse.cahiers.delete_item', { defaultValue: 'Supprimer cet article' })}
                      title={t('bourse.cahiers.delete_item', { defaultValue: 'Supprimer cet article' })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* CTA Ajouter au panier */}
      {!loading && itemsAffiches.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 z-40 max-w-2xl mx-auto">
          <button
            onClick={onAjouterAuPanier}
            className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <ShoppingCart className="w-5 h-5" />
            {t('bourse.cahiers.cta_add_to_cart', {
              defaultValue: 'Ajouter {{count}} article(s) au panier',
              count: itemsAffiches.length,
            })}
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CahiersAccessoiresPage;
