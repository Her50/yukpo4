/**
 * Systèmes scolaires — référentiel unifié web + mobile.
 *
 * Règles :
 * - Un pays peut avoir 1 ou plusieurs systèmes (ex : Cameroun = francophone + anglophone).
 * - Chaque système a des niveaux distincts, chaque niveau contient des classes.
 * - Une classe peut avoir plusieurs séries (ex : 1ère A/B/C/D/E).
 * - La clé finale stockée en DB est toujours la concaténation : `classe[ + ' ' + serie]`.
 */

export type PaysCode =
  | 'CM' | 'CI' | 'SN' | 'GA' | 'CG' | 'CD' | 'BJ' | 'TG' | 'BF' | 'ML' | 'NE'
  | 'NG' | 'GH';

export type Langue = 'fr' | 'en';

export interface Serie {
  code: string;       // "A", "C", "D", "F1", "TI"
  label?: string;     // "Littéraire", "Mathématiques", "Sciences expérimentales"
}

export interface Classe {
  nom: string;        // "1ère", "Tle", "Form 5"
  series?: Serie[];   // vide ou omis = classe sans série
}

export interface Niveau {
  nom: string;        // "Primaire", "Collège", "Lycée général", "Lycée technique"
  classes: Classe[];
}

export interface SystemeScolaire {
  id: string;             // unique, ex : "CM-fr", "CM-en", "CI-fr"
  pays: PaysCode;
  paysLabel: string;      // "Cameroun"
  paysEmoji: string;      // "🇨🇲"
  langue: Langue;
  systemeLabel: string;   // "Francophone", "Anglophone"
  niveaux: Niveau[];
}

/* ─── Séries standard réutilisables ─── */

const SERIES_LYCEE_GENERAL_FR: Serie[] = [
  { code: 'A', label: 'Littéraire' },
  { code: 'B', label: 'Littéraire économique' },
  { code: 'C', label: 'Maths-Sciences physiques' },
  { code: 'D', label: 'Maths-Sciences de la vie' },
  { code: 'E', label: 'Maths-Technique' },
  { code: 'TI', label: 'Technologie informatique' },
];

const SERIES_TECHNIQUE_INDUSTRIEL_CM: Serie[] = [
  { code: 'F1', label: 'Mécanique générale' },
  { code: 'F2', label: 'Électronique' },
  { code: 'F3', label: 'Électrotechnique' },
  { code: 'F4', label: 'Génie civil' },
  { code: 'F5', label: 'Construction aéronautique' },
  { code: 'TI', label: 'Technologie informatique' },
];

const SERIES_TECHNIQUE_COMMERCIAL_CM: Serie[] = [
  { code: 'G1', label: 'Secrétariat & bureautique' },
  { code: 'G2', label: 'Comptabilité & gestion' },
  { code: 'G3', label: 'Commerce' },
  { code: 'H', label: 'Informatique de gestion' },
];

/* ─── Cameroun ─── */

const CM_FRANCOPHONE: SystemeScolaire = {
  id: 'CM-fr',
  pays: 'CM',
  paysLabel: 'Cameroun',
  paysEmoji: '🇨🇲',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    {
      nom: 'Maternelle',
      classes: [
        { nom: 'Petite section' },
        { nom: 'Moyenne section' },
        { nom: 'Grande section' },
      ],
    },
    {
      nom: 'Primaire',
      classes: [
        { nom: 'SIL' }, { nom: 'CP' }, { nom: 'CE1' }, { nom: 'CE2' },
        { nom: 'CM1' }, { nom: 'CM2' },
      ],
    },
    {
      nom: 'Collège',
      classes: [
        { nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' },
      ],
    },
    {
      nom: 'Lycée général',
      classes: [
        { nom: '2nde', series: [{ code: 'A' }, { code: 'C' }] },
        { nom: '1ère', series: SERIES_LYCEE_GENERAL_FR },
        { nom: 'Tle', series: SERIES_LYCEE_GENERAL_FR },
      ],
    },
    {
      nom: 'Lycée technique — Industriel',
      classes: [
        { nom: '6ème TI' }, { nom: '5ème TI' }, { nom: '4ème TI' }, { nom: '3ème TI' },
        { nom: '2nde F' },
        { nom: '1ère', series: SERIES_TECHNIQUE_INDUSTRIEL_CM },
        { nom: 'Tle', series: SERIES_TECHNIQUE_INDUSTRIEL_CM },
      ],
    },
    {
      nom: 'Lycée technique — Commercial',
      classes: [
        { nom: '6ème CG' }, { nom: '5ème CG' }, { nom: '4ème CG' }, { nom: '3ème CG' },
        { nom: '2nde G' },
        { nom: '1ère', series: SERIES_TECHNIQUE_COMMERCIAL_CM },
        { nom: 'Tle', series: SERIES_TECHNIQUE_COMMERCIAL_CM },
      ],
    },
    {
      nom: 'Formation professionnelle',
      classes: [
        { nom: 'CAP 1' }, { nom: 'CAP 2' }, { nom: 'CAP 3' },
        { nom: 'BEP 1' }, { nom: 'BEP 2' },
        { nom: 'BT 1' }, { nom: 'BT 2' }, { nom: 'BT 3' },
      ],
    },
  ],
};

const CM_ANGLOPHONE: SystemeScolaire = {
  id: 'CM-en',
  pays: 'CM',
  paysLabel: 'Cameroon',
  paysEmoji: '🇨🇲',
  langue: 'en',
  systemeLabel: 'Anglophone',
  niveaux: [
    { nom: 'Nursery', classes: [{ nom: 'Nursery 1' }, { nom: 'Nursery 2' }] },
    {
      nom: 'Primary',
      classes: [
        { nom: 'Class 1' }, { nom: 'Class 2' }, { nom: 'Class 3' },
        { nom: 'Class 4' }, { nom: 'Class 5' }, { nom: 'Class 6' },
      ],
    },
    {
      nom: 'Secondary',
      classes: [
        { nom: 'Form 1' }, { nom: 'Form 2' }, { nom: 'Form 3' },
        { nom: 'Form 4' }, { nom: 'Form 5' },
      ],
    },
    {
      nom: 'High School',
      classes: [
        {
          nom: 'Lower Sixth',
          series: [
            { code: 'Arts' }, { code: 'Science' }, { code: 'Commercial' },
          ],
        },
        {
          nom: 'Upper Sixth',
          series: [
            { code: 'Arts' }, { code: 'Science' }, { code: 'Commercial' },
          ],
        },
      ],
    },
    {
      nom: 'Technical Secondary',
      classes: [
        { nom: 'Form 1T' }, { nom: 'Form 2T' }, { nom: 'Form 3T' },
        { nom: 'Form 4T' }, { nom: 'Form 5T' },
      ],
    },
  ],
};

/* ─── Côte d'Ivoire ─── */

const CI_FRANCOPHONE: SystemeScolaire = {
  id: 'CI-fr',
  pays: 'CI',
  paysLabel: "Côte d'Ivoire",
  paysEmoji: '🇨🇮',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée général',
      classes: [
        { nom: '2nde', series: [{ code: 'A' }, { code: 'C' }] },
        { nom: '1ère', series: [{ code: 'A1' }, { code: 'A2' }, { code: 'C' }, { code: 'D' }] },
        { nom: 'Tle', series: [{ code: 'A1' }, { code: 'A2' }, { code: 'C' }, { code: 'D' }] },
      ],
    },
  ],
};

/* ─── Sénégal ─── */

const SN_FRANCOPHONE: SystemeScolaire = {
  id: 'SN-fr',
  pays: 'SN',
  paysLabel: 'Sénégal',
  paysEmoji: '🇸🇳',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Élémentaire', classes: [{ nom: 'CI' }, { nom: 'CP' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Moyen', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Secondaire',
      classes: [
        { nom: '2nde', series: [{ code: 'L' }, { code: 'S' }] },
        { nom: '1ère', series: [{ code: 'L1' }, { code: 'L2' }, { code: 'S1' }, { code: 'S2' }] },
        { nom: 'Tle', series: [{ code: 'L1' }, { code: 'L2' }, { code: 'S1' }, { code: 'S2' }] },
      ],
    },
  ],
};

/* ─── Gabon ─── */

const GA_FRANCOPHONE: SystemeScolaire = {
  id: 'GA-fr',
  pays: 'GA',
  paysLabel: 'Gabon',
  paysEmoji: '🇬🇦',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Préprimaire', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée',
      classes: [
        { nom: '2nde', series: [{ code: 'A' }, { code: 'C' }] },
        { nom: '1ère', series: SERIES_LYCEE_GENERAL_FR },
        { nom: 'Tle', series: SERIES_LYCEE_GENERAL_FR },
      ],
    },
  ],
};

/* ─── Congo (Brazzaville) ─── */

const CG_FRANCOPHONE: SystemeScolaire = {
  id: 'CG-fr',
  pays: 'CG',
  paysLabel: 'Congo',
  paysEmoji: '🇨🇬',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée',
      classes: [
        { nom: '2nde', series: [{ code: 'A' }, { code: 'C' }] },
        { nom: '1ère', series: SERIES_LYCEE_GENERAL_FR },
        { nom: 'Tle', series: SERIES_LYCEE_GENERAL_FR },
      ],
    },
  ],
};

/* ─── RDC (Kinshasa) ─── */

const CD_FRANCOPHONE: SystemeScolaire = {
  id: 'CD-fr',
  pays: 'CD',
  paysLabel: 'RD Congo',
  paysEmoji: '🇨🇩',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: '1ère année' }, { nom: '2ème année' }, { nom: '3ème année' }] },
    { nom: 'Primaire', classes: [{ nom: '1ère primaire' }, { nom: '2ème primaire' }, { nom: '3ème primaire' }, { nom: '4ème primaire' }, { nom: '5ème primaire' }, { nom: '6ème primaire' }] },
    {
      nom: 'Secondaire',
      classes: [
        { nom: '7ème CTEB' }, { nom: '8ème CTEB' },
        {
          nom: '1ère humanités',
          series: [
            { code: 'Scientifique' }, { code: 'Littéraire' }, { code: 'Commercial' }, { code: 'Pédagogique' },
          ],
        },
        {
          nom: '2ème humanités',
          series: [
            { code: 'Scientifique' }, { code: 'Littéraire' }, { code: 'Commercial' }, { code: 'Pédagogique' },
          ],
        },
        {
          nom: '3ème humanités',
          series: [
            { code: 'Scientifique' }, { code: 'Littéraire' }, { code: 'Commercial' }, { code: 'Pédagogique' },
          ],
        },
        {
          nom: '4ème humanités',
          series: [
            { code: 'Scientifique' }, { code: 'Littéraire' }, { code: 'Commercial' }, { code: 'Pédagogique' },
          ],
        },
      ],
    },
  ],
};

/* ─── Bénin, Togo, Burkina Faso, Mali, Niger — francophone standard ─── */

const genericFrSchool = (pays: PaysCode, paysLabel: string, paysEmoji: string): SystemeScolaire => ({
  id: `${pays}-fr`,
  pays,
  paysLabel,
  paysEmoji,
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée',
      classes: [
        { nom: '2nde', series: [{ code: 'A' }, { code: 'C' }] },
        { nom: '1ère', series: [{ code: 'A' }, { code: 'C' }, { code: 'D' }] },
        { nom: 'Tle', series: [{ code: 'A' }, { code: 'C' }, { code: 'D' }] },
      ],
    },
  ],
});

/* ─── Nigeria / Ghana — anglophone ─── */

const NG_ANGLOPHONE: SystemeScolaire = {
  id: 'NG-en',
  pays: 'NG',
  paysLabel: 'Nigeria',
  paysEmoji: '🇳🇬',
  langue: 'en',
  systemeLabel: 'Anglophone',
  niveaux: [
    { nom: 'Nursery', classes: [{ nom: 'Nursery 1' }, { nom: 'Nursery 2' }, { nom: 'Nursery 3' }] },
    {
      nom: 'Primary',
      classes: [{ nom: 'Primary 1' }, { nom: 'Primary 2' }, { nom: 'Primary 3' }, { nom: 'Primary 4' }, { nom: 'Primary 5' }, { nom: 'Primary 6' }],
    },
    { nom: 'Junior Secondary', classes: [{ nom: 'JSS 1' }, { nom: 'JSS 2' }, { nom: 'JSS 3' }] },
    {
      nom: 'Senior Secondary',
      classes: [
        { nom: 'SSS 1', series: [{ code: 'Sci' }, { code: 'Art' }, { code: 'Com' }] },
        { nom: 'SSS 2', series: [{ code: 'Sci' }, { code: 'Art' }, { code: 'Com' }] },
        { nom: 'SSS 3', series: [{ code: 'Sci' }, { code: 'Art' }, { code: 'Com' }] },
      ],
    },
  ],
};

const GH_ANGLOPHONE: SystemeScolaire = {
  id: 'GH-en',
  pays: 'GH',
  paysLabel: 'Ghana',
  paysEmoji: '🇬🇭',
  langue: 'en',
  systemeLabel: 'Anglophone',
  niveaux: [
    { nom: 'Kindergarten', classes: [{ nom: 'KG 1' }, { nom: 'KG 2' }] },
    {
      nom: 'Primary',
      classes: [{ nom: 'Class 1' }, { nom: 'Class 2' }, { nom: 'Class 3' }, { nom: 'Class 4' }, { nom: 'Class 5' }, { nom: 'Class 6' }],
    },
    { nom: 'Junior High School', classes: [{ nom: 'JHS 1' }, { nom: 'JHS 2' }, { nom: 'JHS 3' }] },
    {
      nom: 'Senior High School',
      classes: [
        { nom: 'SHS 1', series: [{ code: 'General Science' }, { code: 'General Arts' }, { code: 'Business' }, { code: 'Home Economics' }, { code: 'Visual Arts' }, { code: 'Technical' }, { code: 'Agricultural Science' }] },
        { nom: 'SHS 2', series: [{ code: 'General Science' }, { code: 'General Arts' }, { code: 'Business' }, { code: 'Home Economics' }, { code: 'Visual Arts' }, { code: 'Technical' }, { code: 'Agricultural Science' }] },
        { nom: 'SHS 3', series: [{ code: 'General Science' }, { code: 'General Arts' }, { code: 'Business' }, { code: 'Home Economics' }, { code: 'Visual Arts' }, { code: 'Technical' }, { code: 'Agricultural Science' }] },
      ],
    },
  ],
};

/* ─── Export ─── */

export const SYSTEMES_SCOLAIRES: SystemeScolaire[] = [
  CM_FRANCOPHONE,
  CM_ANGLOPHONE,
  CI_FRANCOPHONE,
  SN_FRANCOPHONE,
  GA_FRANCOPHONE,
  CG_FRANCOPHONE,
  CD_FRANCOPHONE,
  genericFrSchool('BJ', 'Bénin', '🇧🇯'),
  genericFrSchool('TG', 'Togo', '🇹🇬'),
  genericFrSchool('BF', 'Burkina Faso', '🇧🇫'),
  genericFrSchool('ML', 'Mali', '🇲🇱'),
  genericFrSchool('NE', 'Niger', '🇳🇪'),
  NG_ANGLOPHONE,
  GH_ANGLOPHONE,
];

export const PAYS_PAR_DEFAUT: PaysCode = 'CM';

export function getSystemesForPays(pays: PaysCode): SystemeScolaire[] {
  return SYSTEMES_SCOLAIRES.filter(s => s.pays === pays);
}

export function getSystemeById(id: string): SystemeScolaire | undefined {
  return SYSTEMES_SCOLAIRES.find(s => s.id === id);
}

export function getClasseFullName(classe: string, serie?: string): string {
  return serie ? `${classe} ${serie}` : classe;
}

/**
 * Parse a stored class string back into {classe, serie}.
 * Best-effort: takes the first token as classe, rest as serie.
 */
export function parseClasseFullName(full: string): { classe: string; serie?: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { classe: parts[0] };
  // Multi-word classes like "1ère primaire", "Lower Sixth"
  const commonMultiWord = ['ère primaire', 'ème primaire', 'Sixth', 'section', 'humanités'];
  if (commonMultiWord.some(w => full.includes(w))) {
    // Try to match the last token as serie
    const maybeSerie = parts[parts.length - 1];
    if (/^[A-Z][a-zA-Z0-9]*$|^[A-Z]\d?$|^F\d$|^G\d$/.test(maybeSerie)) {
      return { classe: parts.slice(0, -1).join(' '), serie: maybeSerie };
    }
    return { classe: full };
  }
  return { classe: parts[0], serie: parts.slice(1).join(' ') };
}

export const LISTE_PAYS_UNIQUES = Array.from(
  new Map(SYSTEMES_SCOLAIRES.map(s => [s.pays, { code: s.pays, label: s.paysLabel, emoji: s.paysEmoji }])).values()
);
