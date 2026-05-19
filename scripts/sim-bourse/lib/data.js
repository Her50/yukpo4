// Données de référence pour la simulation.
// GPS = "lat,lng" string (format colonne livres_scolaires.gps TEXT).

// Centres et rayons (en degrés) — Douala, Yaoundé, Bafoussam + quelques villes secondaires.
export const VILLES = {
  douala:     { lat: 4.0511,  lng: 9.7679,  rayon: 0.15, quartiers: ['Akwa', 'Bonanjo', 'Bonapriso', 'Bonamoussadi', 'Makepe', 'Logbessou', 'Bepanda', 'Deido', 'New Bell', 'PK10'] },
  yaounde:    { lat: 3.8480,  lng: 11.5021, rayon: 0.18, quartiers: ['Bastos', 'Mvog-Mbi', 'Mvan', 'Nlongkak', 'Mendong', 'Nkolbisson', 'Emana', 'Essos', 'Mimboman', 'Etoudi'] },
  bafoussam:  { lat: 5.4781,  lng: 10.4179, rayon: 0.08, quartiers: ['Tamdja', 'Banengo', 'Tougang', 'Famla', 'Tyo-Ville', 'Djeleng'] },
  // Villes secondaires (le 10% restant)
  garoua:     { lat: 9.3000,  lng: 13.4000, rayon: 0.06, quartiers: ['Marouare', 'Plateau', 'Roumde-Adjia'] },
  bamenda:    { lat: 5.9597,  lng: 10.1463, rayon: 0.07, quartiers: ['Up Station', 'Ntarinkon', 'Mile 4'] },
  buea:       { lat: 4.1559,  lng: 9.2628,  rayon: 0.05, quartiers: ['Molyko', 'Bonduma', 'Soppo'] },
  ngaoundere: { lat: 7.3270,  lng: 13.5840, rayon: 0.06, quartiers: ['Beka', 'Joli-Soir'] },
  bertoua:    { lat: 4.5774,  lng: 13.6840, rayon: 0.05, quartiers: ['Centre', 'Mokolo'] },
  ebolowa:    { lat: 2.9000,  lng: 11.1500, rayon: 0.04, quartiers: ['Centre', 'Etam-Bafia'] },
  maroua:     { lat: 10.5910, lng: 14.3158, rayon: 0.06, quartiers: ['Domayo', 'Pitoaré'] },
};

// Distribution cible (env override possible)
export function getDistribution() {
  return {
    douala:    parseFloat(process.env.DIST_DOUALA    ?? '0.40'),
    yaounde:   parseFloat(process.env.DIST_YAOUNDE   ?? '0.35'),
    bafoussam: parseFloat(process.env.DIST_BAFOUSSAM ?? '0.15'),
    autres:    parseFloat(process.env.DIST_AUTRES    ?? '0.10'),
  };
}

const SECONDARY_VILLES = ['garoua', 'bamenda', 'buea', 'ngaoundere', 'bertoua', 'ebolowa', 'maroua'];

export function pickVille() {
  const dist = getDistribution();
  const r = Math.random();
  if (r < dist.douala) return 'douala';
  if (r < dist.douala + dist.yaounde) return 'yaounde';
  if (r < dist.douala + dist.yaounde + dist.bafoussam) return 'bafoussam';
  return SECONDARY_VILLES[Math.floor(Math.random() * SECONDARY_VILLES.length)];
}

export function randomGpsForVille(villeKey) {
  const v = VILLES[villeKey];
  const lat = v.lat + (Math.random() - 0.5) * 2 * v.rayon;
  const lng = v.lng + (Math.random() - 0.5) * 2 * v.rayon;
  return { gps: `${lat.toFixed(6)},${lng.toFixed(6)}`, lat, lng, quartier: v.quartiers[Math.floor(Math.random() * v.quartiers.length)] };
}

// Helpers random
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function pickWeighted(items) {
  // items = [{value, weight}]
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const i of items) { r -= i.weight; if (r <= 0) return i.value; }
  return items[items.length - 1].value;
}
export function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Rôles & distribution
export const ROLE_DISTRIB = [
  { value: 'user',      weight: 80 }, // parent
  { value: 'partenaire', weight: 10 }, // libraire
  { value: 'partenaire', weight: 5  }, // coursier
  { value: 'admin',     weight: 5  },
];

// État livre : 60% bon / 40% acceptable (le user-demandé)
export function pickEtatLivre() {
  return Math.random() < 0.6 ? 'bon' : 'acceptable';
}

// Mode listing : 70% troc / 25% vente / 5% don
export function pickModeListing() {
  const r = Math.random();
  if (r < 0.70) return 'troc';
  if (r < 0.95) return 'vente';
  return 'don';
}

// Code parrainage 6-8 chars alphanumériques
export function genReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // pas de 0/O/1/I/L pour lisibilité
  let s = '';
  for (let i = 0; i < 7; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ============================================================================
// Mapping classe N → classe N+1 (Cameroun)
// ============================================================================
// Règle métier (validée user 2026-05-18) :
//   - Troc/occasion/échange = SECONDAIRE uniquement (primaire verrouillé)
//   - Pour qu'un troc soit possible, classe_souhaitee = classeSuivante(classe_actuelle)
//
// Retourne null si la classe est primaire OU non reconnue (le seed devra alors
// skip ce livre côté mode_listing=troc/vente).
// ============================================================================

// Liste des classes du PRIMAIRE — pas de troc/vente possibles
const PRIMAIRE = new Set([
  'SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  // anglophone
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
]);

// Mapping ordonné du secondaire francophone (général + technique)
const SECONDAIRE_GENERAL = ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Tle'];
// Variantes courantes : "6e", "Sixième", "Seconde", "Première", "Terminale"
// Le backend `classe_match_variants` normalise ces variantes, donc on peut
// utiliser n'importe laquelle ; on choisit la plus compacte.
const SECONDAIRE_VARIANTES = {
  '6e': '5e', '6ème': '5ème', 'Sixième': 'Cinquième',
  '5e': '4e', '5ème': '4ème', 'Cinquième': 'Quatrième',
  '4e': '3e', '4ème': '3ème', 'Quatrième': 'Troisième',
  '3e': '2nde', '3ème': '2nde', 'Troisième': 'Seconde',
  '2nde': '1ère', 'Seconde': 'Première',
  '1ère': 'Tle', 'Première': 'Terminale',
  // Tle n'a pas de successeur (sortie système)
};
// Anglophone : Form 1 → Form 5 → Lower Sixth → Upper Sixth
const FORM_MAP = {
  'Form 1': 'Form 2', 'Form 2': 'Form 3', 'Form 3': 'Form 4', 'Form 4': 'Form 5',
  'Form 5': 'Lower Sixth', 'Lower Sixth': 'Upper Sixth',
};

export function isPrimaire(classe) {
  if (!classe) return false;
  return PRIMAIRE.has(classe.trim());
}

export function classeSuivante(classe) {
  if (!classe) return null;
  const c = classe.trim();
  if (PRIMAIRE.has(c)) return null;                // verrou primaire
  if (SECONDAIRE_VARIANTES[c]) return SECONDAIRE_VARIANTES[c];
  if (FORM_MAP[c]) return FORM_MAP[c];
  // Secondaire technique : "1ère année <SPEC>" → "2nde année <SPEC>"
  const techMatch = c.match(/^(1ère|2nde|3e|3ème|4e|4ème|1ere)\s+année\s+(.+)$/i);
  if (techMatch) {
    const map = { '1ère': '2nde', '1ere': '2nde', '2nde': '3ème', '3e': '4ème', '3ème': '4ème', '4e': null, '4ème': null };
    const next = map[techMatch[1].toLowerCase()];
    return next ? `${next} année ${techMatch[2]}` : null;
  }
  // Classe non reconnue — retourne null pour que le seed skip troc/vente
  return null;
}
