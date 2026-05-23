// =============================================================================
// fournituresCategory.ts — classification des fournitures par catégorie
// =============================================================================
// Le backend (`accessoires_populaires_par_classe`) ne stocke pas de colonne
// catégorie. On déduit la catégorie côté frontend à partir du nom de l'article
// extrait des PDFs officiels (cahier, écriture, géométrie, etc.).
//
// Convention i18n :
//   - Le NOM de l'article (champ `nom`) reste TOUJOURS dans la langue
//     d'origine (français/anglais selon le PDF), JAMAIS traduit
//     (cf. feedback_i18n_no_translate_data).
//   - La CATÉGORIE est une clé technique ('cahier', 'ecriture', ...) qui est
//     traduite via i18n pour l'affichage (`bourse.cahiers.cat.cahier`).
// =============================================================================

export type FournitureCategory =
  | 'cahier'
  | 'ecriture'
  | 'geometrie'
  | 'ardoise'
  | 'protection'
  | 'dictionnaire'
  | 'papier'
  | 'art'
  | 'rangement'
  | 'autre';

const RULES: Array<{ cat: FournitureCategory; patterns: RegExp[] }> = [
  // Cahiers (FR + EN)
  {
    cat: 'cahier',
    patterns: [
      /\bcahier\b/i,
      /\bcahiers\b/i,
      /\bbook(s)?\b/i,
      /\bledger\b/i,
      /\bworkbook\b/i,
      /\bnotebook\b/i,
      /\bplain lines?\b/i,
      /\bsquare lines?\b/i,
      /\bgraph book\b/i,
      /\bbananier\b/i,
      /\bsyllabaire\b/i,
      /\bdrawing book\b/i,
    ],
  },
  // Écriture (stylos, crayons, gommes, colle, marqueurs, taille-crayon)
  {
    cat: 'ecriture',
    patterns: [
      /\bstylo(s)?\b/i,
      /\bpen(s)?\b/i,
      /\bcrayon(s)?\b/i,
      /\bpencil(s)?\b/i,
      /\bgomme(s)?\b/i,
      /\beraser(s)?\b/i,
      /\bcolle\b/i,
      /\bglue\b/i,
      /\buhu\b/i,
      /\bmarqueur(s)?\b/i,
      /\bmarker(s)?\b/i,
      /\bvelleda\b/i,
      /\btaille-?crayon(s)?\b/i,
      /\bsharpener(s)?\b/i,
      /\brotring\b/i,
      /\bclé usb\b/i,
      /\busb key\b/i,
      /\bpatafix\b/i,
      /\bpatafis\b/i,
      /\bfeutre(s)?\b/i,
    ],
  },
  // Géométrie / Mesure / Calcul
  {
    cat: 'geometrie',
    patterns: [
      /\brègle\b/i,
      /\bruler\b/i,
      /\bcompas\b/i,
      /\brapporteur\b/i,
      /\béquerre\b/i,
      /\bequerre\b/i,
      /\bset square\b/i,
      /\bboîte académique\b/i,
      /\bmathematical set\b/i,
      /\bmathematics set\b/i,
      /\bmaths set\b/i,
      /\bcalculatrice\b/i,
      /\bcalculator\b/i,
    ],
  },
  // Ardoise + accessoires liés
  {
    cat: 'ardoise',
    patterns: [
      /\bardoise\b/i,
      /\bwhite board\b/i,
      /\bwhite tablet\b/i,
      /\bblackboard\b/i,
      /\beffaçoir\b/i,
      /\beffaceur\b/i,
      /\bduster\b/i,
    ],
  },
  // Protection (couvertures, couvre-livres, chemises)
  {
    cat: 'protection',
    patterns: [
      /\bcouverture(s)?\b/i,
      /\bcouvre-?livre(s)?\b/i,
      /\bbook cover(s)?\b/i,
      /\btransparent.*cover/i,
      /\bchemise à rabat\b/i,
      /\bplastic file\b/i,
    ],
  },
  // Dictionnaire
  {
    cat: 'dictionnaire',
    patterns: [
      /\bdictionnaire\b/i,
      /\bdictionary\b/i,
      /\blarousse\b/i,
      /\bmac milan\b/i,
    ],
  },
  // Papier (canson, dessin formats spéciaux)
  {
    cat: 'papier',
    patterns: [
      /\bcanson\b/i,
      /\bpapier.*dessin\b/i,
      /\bpaper a[345]\b/i,
    ],
  },
  // Art / TM (déjà filtré didactique strict mais au cas où)
  {
    cat: 'art',
    patterns: [
      /\bgouache\b/i,
      /\bpeinture\b/i,
      /\btoile.*dessin\b/i,
      /\bcadre.*décoratif\b/i,
    ],
  },
  // Rangement
  {
    cat: 'rangement',
    patterns: [
      /\btrousse\b/i,
      /\bpencil case\b/i,
    ],
  },
];

/**
 * Classe un article par catégorie en se basant sur son nom.
 * Retourne 'autre' si aucun pattern ne match (rare en pratique vu la
 * couverture des règles ci-dessus).
 */
export function classifyArticle(nom: string): FournitureCategory {
  const n = (nom || '').trim();
  for (const rule of RULES) {
    if (rule.patterns.some(p => p.test(n))) {
      return rule.cat;
    }
  }
  return 'autre';
}

/**
 * Ordre d'affichage canonique des catégories. Cahiers d'abord (poste le plus
 * lourd en budget), puis écriture, géométrie, etc., et 'autre' à la fin.
 */
export const CATEGORY_ORDER: FournitureCategory[] = [
  'cahier',
  'ecriture',
  'geometrie',
  'ardoise',
  'protection',
  'papier',
  'dictionnaire',
  'rangement',
  'art',
  'autre',
];

/**
 * Couleur Tailwind pour le badge de catégorie (fond + texte). Aide visuelle
 * dans les listes groupées.
 */
export const CATEGORY_BADGE: Record<FournitureCategory, string> = {
  cahier: 'bg-amber-100 text-amber-800',
  ecriture: 'bg-blue-100 text-blue-800',
  geometrie: 'bg-purple-100 text-purple-800',
  ardoise: 'bg-slate-100 text-slate-800',
  protection: 'bg-emerald-100 text-emerald-800',
  papier: 'bg-cyan-100 text-cyan-800',
  dictionnaire: 'bg-indigo-100 text-indigo-800',
  rangement: 'bg-rose-100 text-rose-800',
  art: 'bg-pink-100 text-pink-800',
  autre: 'bg-gray-100 text-gray-700',
};

/**
 * Icône emoji pour chaque catégorie (header de section).
 * Note : emoji uniquement dans l'UI, jamais dans le nom de l'article.
 */
export const CATEGORY_ICON: Record<FournitureCategory, string> = {
  cahier: '📓',
  ecriture: '✏️',
  geometrie: '📐',
  ardoise: '🔲',
  protection: '🛡️',
  papier: '📄',
  dictionnaire: '📚',
  rangement: '🎒',
  art: '🎨',
  autre: '📦',
};

/**
 * Groupe une liste d'articles par catégorie, dans l'ordre canonique
 * `CATEGORY_ORDER`. Renvoie uniquement les catégories non vides.
 */
export function groupByCategory<T extends { nom: string }>(
  items: T[],
): Array<{ category: FournitureCategory; items: T[] }> {
  const buckets = new Map<FournitureCategory, T[]>();
  for (const item of items) {
    const cat = classifyArticle(item.nom);
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(item);
  }
  return CATEGORY_ORDER.filter(cat => buckets.has(cat)).map(cat => ({
    category: cat,
    items: buckets.get(cat)!,
  }));
}
