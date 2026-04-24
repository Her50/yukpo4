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

/** Lycée général francophone Cameroun — 1ère et Terminale */
const SERIES_LYCEE_CM_FR: Serie[] = [
  { code: 'A', label: 'Lettres & Sciences humaines' },
  { code: 'B', label: 'Lettres bilingues' },
  { code: 'C', label: 'Maths & Sciences physiques' },
  { code: 'D', label: 'Maths & Sciences de la Vie' },
  { code: 'E', label: 'Maths & Technique' },
  { code: 'TI', label: 'Technologie de l\'Information' },
];

/** 2nde au lycée général francophone (orientation — Cameroun, Gabon, Congo) */
const SERIES_SECONDE_FR: Serie[] = [
  { code: 'A', label: 'Lettres (orientation)' },
  { code: 'C', label: 'Sciences (orientation)' },
];

/** Lycée général GA/CG/CD — 1ère et Terminale (séries sans B ni E/TI) */
const SERIES_LYCEE_AOF_GENERAL: Serie[] = [
  { code: 'A', label: 'Lettres & Sciences humaines' },
  { code: 'C', label: 'Maths & Sciences physiques' },
  { code: 'D', label: 'Maths & Sciences de la Vie' },
];

/** Technique industrielle CM — 2nde F (choix de filière dès la 2nde) */
const SERIES_2NDE_F_CM: Serie[] = [
  { code: 'F1', label: 'Mécanique générale' },
  { code: 'F2', label: 'Électronique' },
  { code: 'F3', label: 'Électrotechnique' },
  { code: 'F4', label: 'Génie civil / Bâtiment' },
  { code: 'F5', label: 'Construction aéronautique' },
  { code: 'F6', label: 'Chimie industrielle' },
  { code: 'F7', label: 'Mine & Géologie' },
  { code: 'TI', label: 'Technologie informatique' },
];

/** Technique industrielle CM — 1ère & Terminale F */
const SERIES_TECHNIQUE_INDUSTRIEL_CM: Serie[] = [
  { code: 'F1', label: 'Mécanique générale' },
  { code: 'F2', label: 'Électronique' },
  { code: 'F3', label: 'Électrotechnique' },
  { code: 'F4', label: 'Génie civil / Bâtiment' },
  { code: 'F5', label: 'Construction aéronautique' },
  { code: 'F6', label: 'Chimie industrielle' },
  { code: 'F7', label: 'Mine & Géologie' },
  { code: 'TI', label: 'Technologie informatique' },
];

/** Technique commerciale CM — 2nde G */
const SERIES_2NDE_G_CM: Serie[] = [
  { code: 'G1', label: 'Secrétariat & bureautique' },
  { code: 'G2', label: 'Comptabilité & gestion' },
  { code: 'G3', label: 'Commerce & marketing' },
  { code: 'H', label: 'Informatique de gestion' },
];

/** Technique commerciale CM — 1ère & Terminale G */
const SERIES_TECHNIQUE_COMMERCIAL_CM: Serie[] = [
  { code: 'G1', label: 'Secrétariat & bureautique' },
  { code: 'G2', label: 'Comptabilité & gestion' },
  { code: 'G3', label: 'Commerce & marketing' },
  { code: 'H', label: 'Informatique de gestion' },
];

/** Filières agro-pastorales CM */
const SERIES_AGRO_CM: Serie[] = [
  { code: 'EA', label: 'Agriculture' },
  { code: 'EB', label: 'Élevage & vétérinaire' },
  { code: 'EC', label: 'Agro-industrie' },
];

/** Filières hôtellerie & restauration CM */
const SERIES_HOTELLERIE_CM: Serie[] = [
  { code: 'HA', label: 'Hôtellerie / Hébergement' },
  { code: 'HR', label: 'Restauration / Cuisine' },
  { code: 'HG', label: 'Tourisme & Loisirs' },
];

/** Anglophone Cameroun — O Level (Form 4 & 5) */
const SERIES_OLEVEL_CM_EN: Serie[] = [
  { code: 'Arts', label: 'Arts & Humanities' },
  { code: 'Science', label: 'Science & Maths' },
  { code: 'Commercial', label: 'Commerce & Economics' },
  { code: 'Technical', label: 'Technical & Industrial' },
];

/** Anglophone Cameroun — A Level (Lower & Upper Sixth) */
const SERIES_ALEVEL_CM_EN: Serie[] = [
  { code: 'Arts', label: 'Arts & Languages' },
  { code: 'Science', label: 'Pure & Applied Science' },
  { code: 'Commercial', label: 'Commerce & Economics' },
];

/** Technical Secondary anglophone CM — Form 4T & 5T */
const SERIES_TECH_SECONDARY_EN: Serie[] = [
  { code: 'Mech', label: 'Mechanical Engineering' },
  { code: 'Elec', label: 'Electrical / Electronics' },
  { code: 'Civil', label: 'Civil Engineering' },
  { code: 'Com', label: 'Commercial / Accounting' },
  { code: 'IT', label: 'Information Technology' },
  { code: 'Agri', label: 'Agricultural Science' },
];

/** Côte d'Ivoire — 2nde (orientation) */
const SERIES_CI_2NDE: Serie[] = [
  { code: 'A', label: 'Lettres (orientation)' },
  { code: 'C', label: 'Sciences (orientation)' },
];

/** Côte d'Ivoire — 1ère & Terminale */
const SERIES_CI_1ERE_TLE: Serie[] = [
  { code: 'A1', label: 'Philosophie, Littérature & Langues' },
  { code: 'A2', label: 'Sciences sociales & Lettres' },
  { code: 'C', label: 'Maths & Sciences physiques' },
  { code: 'D', label: 'Maths & Sciences de la Vie' },
];

/** CI technique industrielle — filières */
const SERIES_CI_TECH_INDUS: Serie[] = [
  { code: 'F1', label: 'Mécanique & Métallurgie' },
  { code: 'F2', label: 'Électronique & Électrotechnique' },
  { code: 'F3', label: 'Génie civil & Bâtiment' },
];

/** CI technique commerciale */
const SERIES_CI_TECH_COMM: Serie[] = [
  { code: 'G1', label: 'Secrétariat & bureautique' },
  { code: 'G2', label: 'Comptabilité & gestion' },
];

/** Sénégal — 2nde */
const SERIES_SN_2NDE: Serie[] = [
  { code: 'L', label: 'Littéraire (orientation)' },
  { code: 'S', label: 'Scientifique (orientation)' },
];

/** Sénégal — 1ère & Terminale */
const SERIES_SN_1ERE_TLE: Serie[] = [
  { code: 'L1', label: 'Philosophie, Lettres & Langues' },
  { code: 'L2', label: 'Histoire-Géographie' },
  { code: 'S1', label: 'Maths & Sciences physiques' },
  { code: 'S2', label: 'Maths & Sciences de la Vie' },
  { code: 'S3', label: 'Sciences & Technologies' },
  { code: 'G', label: 'Commerce & Gestion' },
];

/** Afrique de l'Ouest francophone (BJ, TG, BF) — 2nde */
const SERIES_AOF_2NDE: Serie[] = [
  { code: 'A', label: 'Lettres (orientation)' },
  { code: 'C', label: 'Sciences (orientation)' },
  { code: 'D', label: 'Sciences de la Vie (orientation)' },
];

/** Afrique de l'Ouest francophone (BJ, TG, BF) — 1ère & Terminale */
const SERIES_AOF_1ERE_TLE: Serie[] = [
  { code: 'A1', label: 'Philosophie, Lettres & Langues' },
  { code: 'A2', label: 'Lettres, Langues & Arts' },
  { code: 'A3', label: 'Sciences sociales & Histoire-Géo' },
  { code: 'B', label: 'Économie & Sciences sociales' },
  { code: 'C', label: 'Maths & Sciences physiques' },
  { code: 'D', label: 'Maths & Sciences de la Vie' },
  { code: 'G1', label: 'Secrétariat & bureautique' },
  { code: 'G2', label: 'Comptabilité & gestion' },
];

/** Mali / Niger — 1ère & Terminale (système plus simplifié) */
const SERIES_ML_NE_1ERE_TLE: Serie[] = [
  { code: 'A', label: 'Lettres & Sciences humaines' },
  { code: 'B', label: 'Économie & Sciences sociales' },
  { code: 'C', label: 'Maths & Sciences physiques' },
  { code: 'D', label: 'Maths & Sciences de la Vie' },
];

/** Nigeria — Senior Secondary School (3 filières) */
const SERIES_NG_SSS: Serie[] = [
  { code: 'Science', label: 'Science & Technology' },
  { code: 'Arts', label: 'Arts & Humanities' },
  { code: 'Commerce', label: 'Commerce & Social Studies' },
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
        { nom: '2nde', series: SERIES_SECONDE_FR },
        { nom: '1ère', series: SERIES_LYCEE_CM_FR },
        { nom: 'Tle', series: SERIES_LYCEE_CM_FR },
      ],
    },
    {
      nom: 'Lycée technique — Industriel',
      classes: [
        { nom: '6ème TI' }, { nom: '5ème TI' }, { nom: '4ème TI' }, { nom: '3ème TI' },
        { nom: '2nde F', series: SERIES_2NDE_F_CM },
        { nom: '1ère', series: SERIES_TECHNIQUE_INDUSTRIEL_CM },
        { nom: 'Tle', series: SERIES_TECHNIQUE_INDUSTRIEL_CM },
      ],
    },
    {
      nom: 'Lycée technique — Commercial',
      classes: [
        { nom: '6ème CG' }, { nom: '5ème CG' }, { nom: '4ème CG' }, { nom: '3ème CG' },
        { nom: '2nde G', series: SERIES_2NDE_G_CM },
        { nom: '1ère', series: SERIES_TECHNIQUE_COMMERCIAL_CM },
        { nom: 'Tle', series: SERIES_TECHNIQUE_COMMERCIAL_CM },
      ],
    },
    {
      nom: 'Lycée agro-pastoral',
      classes: [
        { nom: '2nde EA' },
        { nom: '1ère', series: SERIES_AGRO_CM },
        { nom: 'Tle', series: SERIES_AGRO_CM },
      ],
    },
    {
      nom: 'Lycée hôtellerie & restauration',
      classes: [
        { nom: '2nde HR' },
        { nom: '1ère', series: SERIES_HOTELLERIE_CM },
        { nom: 'Tle', series: SERIES_HOTELLERIE_CM },
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
      nom: 'Secondary (O Level)',
      classes: [
        { nom: 'Form 1' }, { nom: 'Form 2' }, { nom: 'Form 3' },
        { nom: 'Form 4', series: SERIES_OLEVEL_CM_EN },
        { nom: 'Form 5', series: SERIES_OLEVEL_CM_EN },
      ],
    },
    {
      nom: 'High School (A Level)',
      classes: [
        { nom: 'Lower Sixth', series: SERIES_ALEVEL_CM_EN },
        { nom: 'Upper Sixth', series: SERIES_ALEVEL_CM_EN },
      ],
    },
    {
      nom: 'Technical Secondary',
      classes: [
        { nom: 'Form 1T' }, { nom: 'Form 2T' }, { nom: 'Form 3T' },
        { nom: 'Form 4T', series: SERIES_TECH_SECONDARY_EN },
        { nom: 'Form 5T', series: SERIES_TECH_SECONDARY_EN },
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
        { nom: '2nde', series: SERIES_CI_2NDE },
        { nom: '1ère', series: SERIES_CI_1ERE_TLE },
        { nom: 'Tle', series: SERIES_CI_1ERE_TLE },
      ],
    },
    {
      nom: 'Lycée technique — Industriel',
      classes: [
        { nom: '2nde F' },
        { nom: '1ère', series: SERIES_CI_TECH_INDUS },
        { nom: 'Tle', series: SERIES_CI_TECH_INDUS },
      ],
    },
    {
      nom: 'Lycée technique — Commercial',
      classes: [
        { nom: '2nde G' },
        { nom: '1ère', series: SERIES_CI_TECH_COMM },
        { nom: 'Tle', series: SERIES_CI_TECH_COMM },
      ],
    },
    {
      nom: 'Formation professionnelle',
      classes: [
        { nom: 'CAP 1' }, { nom: 'CAP 2' },
        { nom: 'BT 1' }, { nom: 'BT 2' }, { nom: 'BT 3' },
        { nom: 'BTS 1' }, { nom: 'BTS 2' },
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
        { nom: '2nde', series: SERIES_SN_2NDE },
        { nom: '1ère', series: SERIES_SN_1ERE_TLE },
        { nom: 'Tle', series: SERIES_SN_1ERE_TLE },
      ],
    },
    {
      nom: 'Formation technique & professionnelle',
      classes: [
        { nom: 'CAP 1' }, { nom: 'CAP 2' }, { nom: 'CAP 3' },
        { nom: 'BEP 1' }, { nom: 'BEP 2' },
        { nom: 'BT 1' }, { nom: 'BT 2' }, { nom: 'BT 3' },
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
      nom: 'Lycée général',
      classes: [
        { nom: '2nde', series: SERIES_SECONDE_FR },
        { nom: '1ère', series: SERIES_LYCEE_AOF_GENERAL },
        { nom: 'Tle', series: SERIES_LYCEE_AOF_GENERAL },
      ],
    },
    {
      nom: 'Lycée technique',
      classes: [
        { nom: '2nde F' },
        { nom: '2nde G' },
        { nom: '1ère F', series: [{ code: 'F1', label: 'Mécanique' }, { code: 'F2', label: 'Électronique' }, { code: 'F3', label: 'Génie civil' }] },
        { nom: '1ère G', series: [{ code: 'G1', label: 'Secrétariat' }, { code: 'G2', label: 'Comptabilité' }] },
        { nom: 'Tle F', series: [{ code: 'F1', label: 'Mécanique' }, { code: 'F2', label: 'Électronique' }, { code: 'F3', label: 'Génie civil' }] },
        { nom: 'Tle G', series: [{ code: 'G1', label: 'Secrétariat' }, { code: 'G2', label: 'Comptabilité' }] },
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
      nom: 'Lycée général',
      classes: [
        { nom: '2nde', series: SERIES_SECONDE_FR },
        { nom: '1ère', series: SERIES_LYCEE_AOF_GENERAL },
        { nom: 'Tle', series: SERIES_LYCEE_AOF_GENERAL },
      ],
    },
    {
      nom: 'Lycée technique',
      classes: [
        { nom: '2nde F' },
        { nom: '2nde G' },
        { nom: '1ère F', series: [{ code: 'F1', label: 'Mécanique' }, { code: 'F2', label: 'Électronique' }, { code: 'F3', label: 'Génie civil' }] },
        { nom: '1ère G', series: [{ code: 'G1', label: 'Secrétariat' }, { code: 'G2', label: 'Comptabilité' }] },
        { nom: 'Tle F', series: [{ code: 'F1', label: 'Mécanique' }, { code: 'F2', label: 'Électronique' }, { code: 'F3', label: 'Génie civil' }] },
        { nom: 'Tle G', series: [{ code: 'G1', label: 'Secrétariat' }, { code: 'G2', label: 'Comptabilité' }] },
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
      nom: 'Secondaire — Cycle inférieur',
      classes: [
        { nom: '1ère secondaire' },
        { nom: '2ème secondaire' },
        { nom: '3ème secondaire' },
      ],
    },
    {
      nom: 'Secondaire — Cycle supérieur (Humanités)',
      classes: [
        {
          nom: '4ème',
          series: [
            { code: 'SC', label: 'Sciences (Maths-Physique)' },
            { code: 'SN', label: 'Sciences naturelles' },
            { code: 'LT', label: 'Latin-Philosophie' },
            { code: 'LS', label: 'Latin-Sciences' },
            { code: 'CA', label: 'Commerce & Administration' },
            { code: 'PE', label: 'Pédagogie' },
          ],
        },
        {
          nom: '5ème',
          series: [
            { code: 'SC', label: 'Sciences (Maths-Physique)' },
            { code: 'SN', label: 'Sciences naturelles' },
            { code: 'LT', label: 'Latin-Philosophie' },
            { code: 'LS', label: 'Latin-Sciences' },
            { code: 'CA', label: 'Commerce & Administration' },
            { code: 'PE', label: 'Pédagogie' },
          ],
        },
        {
          nom: '6ème',
          series: [
            { code: 'SC', label: 'Sciences (Maths-Physique)' },
            { code: 'SN', label: 'Sciences naturelles' },
            { code: 'LT', label: 'Latin-Philosophie' },
            { code: 'LS', label: 'Latin-Sciences' },
            { code: 'CA', label: 'Commerce & Administration' },
            { code: 'PE', label: 'Pédagogie' },
          ],
        },
      ],
    },
    {
      nom: 'Secondaire technique',
      classes: [
        { nom: '4ème technique', series: [{ code: 'Elec', label: 'Électricité' }, { code: 'Mec', label: 'Mécanique' }, { code: 'Civ', label: 'Génie civil' }, { code: 'Com', label: 'Commerce-Gestion' }] },
        { nom: '5ème technique', series: [{ code: 'Elec', label: 'Électricité' }, { code: 'Mec', label: 'Mécanique' }, { code: 'Civ', label: 'Génie civil' }, { code: 'Com', label: 'Commerce-Gestion' }] },
        { nom: '6ème technique', series: [{ code: 'Elec', label: 'Électricité' }, { code: 'Mec', label: 'Mécanique' }, { code: 'Civ', label: 'Génie civil' }, { code: 'Com', label: 'Commerce-Gestion' }] },
      ],
    },
  ],
};

/* ─── Bénin — BAC série AOF ─── */

const BJ_FRANCOPHONE: SystemeScolaire = {
  id: 'BJ-fr',
  pays: 'BJ',
  paysLabel: 'Bénin',
  paysEmoji: '🇧🇯',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée général',
      classes: [
        { nom: '2nde', series: SERIES_AOF_2NDE },
        { nom: '1ère', series: SERIES_AOF_1ERE_TLE },
        { nom: 'Tle', series: SERIES_AOF_1ERE_TLE },
      ],
    },
  ],
};

/* ─── Togo — BAC série AOF ─── */

const TG_FRANCOPHONE: SystemeScolaire = {
  id: 'TG-fr',
  pays: 'TG',
  paysLabel: 'Togo',
  paysEmoji: '🇹🇬',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée général',
      classes: [
        { nom: '2nde', series: SERIES_AOF_2NDE },
        { nom: '1ère', series: SERIES_AOF_1ERE_TLE },
        { nom: 'Tle', series: SERIES_AOF_1ERE_TLE },
      ],
    },
  ],
};

/* ─── Burkina Faso — BAC série AOF ─── */

const BF_FRANCOPHONE: SystemeScolaire = {
  id: 'BF-fr',
  pays: 'BF',
  paysLabel: 'Burkina Faso',
  paysEmoji: '🇧🇫',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée général',
      classes: [
        { nom: '2nde', series: SERIES_AOF_2NDE },
        { nom: '1ère', series: SERIES_AOF_1ERE_TLE },
        { nom: 'Tle', series: SERIES_AOF_1ERE_TLE },
      ],
    },
  ],
};

/* ─── Mali ─── */

const ML_FRANCOPHONE: SystemeScolaire = {
  id: 'ML-fr',
  pays: 'ML',
  paysLabel: 'Mali',
  paysEmoji: '🇲🇱',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: '1ère année' }, { nom: '2ème année' }, { nom: '3ème année' }, { nom: '4ème année' }, { nom: '5ème année' }, { nom: '6ème année' }] },
    { nom: 'Secondaire 1er cycle', classes: [{ nom: '7ème année' }, { nom: '8ème année' }, { nom: '9ème année' }] },
    {
      nom: 'Secondaire 2ème cycle',
      classes: [
        { nom: '10ème', series: [{ code: 'L', label: 'Lettres (orientation)' }, { code: 'S', label: 'Sciences (orientation)' }] },
        { nom: '11ème', series: SERIES_ML_NE_1ERE_TLE },
        { nom: 'Tle', series: SERIES_ML_NE_1ERE_TLE },
      ],
    },
  ],
};

/* ─── Niger ─── */

const NE_FRANCOPHONE: SystemeScolaire = {
  id: 'NE-fr',
  pays: 'NE',
  paysLabel: 'Niger',
  paysEmoji: '🇳🇪',
  langue: 'fr',
  systemeLabel: 'Francophone',
  niveaux: [
    { nom: 'Maternelle', classes: [{ nom: 'Petite section' }, { nom: 'Moyenne section' }, { nom: 'Grande section' }] },
    { nom: 'Primaire', classes: [{ nom: 'CP1' }, { nom: 'CP2' }, { nom: 'CE1' }, { nom: 'CE2' }, { nom: 'CM1' }, { nom: 'CM2' }] },
    { nom: 'Collège', classes: [{ nom: '6ème' }, { nom: '5ème' }, { nom: '4ème' }, { nom: '3ème' }] },
    {
      nom: 'Lycée',
      classes: [
        { nom: '2nde', series: SERIES_AOF_2NDE },
        { nom: '1ère', series: SERIES_ML_NE_1ERE_TLE },
        { nom: 'Tle', series: SERIES_ML_NE_1ERE_TLE },
      ],
    },
  ],
};

/* ─── Nigeria ─── */

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
        { nom: 'SSS 1', series: SERIES_NG_SSS },
        { nom: 'SSS 2', series: SERIES_NG_SSS },
        { nom: 'SSS 3', series: SERIES_NG_SSS },
      ],
    },
  ],
};

/* ─── Ghana ─── */

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
        {
          nom: 'SHS 1',
          series: [
            { code: 'General Science', label: 'General Science' },
            { code: 'General Arts', label: 'General Arts' },
            { code: 'Business', label: 'Business Studies' },
            { code: 'Home Economics', label: 'Home Economics' },
            { code: 'Visual Arts', label: 'Visual Arts' },
            { code: 'Technical', label: 'Technical & Vocational' },
            { code: 'Agricultural Science', label: 'Agricultural Science' },
          ],
        },
        {
          nom: 'SHS 2',
          series: [
            { code: 'General Science', label: 'General Science' },
            { code: 'General Arts', label: 'General Arts' },
            { code: 'Business', label: 'Business Studies' },
            { code: 'Home Economics', label: 'Home Economics' },
            { code: 'Visual Arts', label: 'Visual Arts' },
            { code: 'Technical', label: 'Technical & Vocational' },
            { code: 'Agricultural Science', label: 'Agricultural Science' },
          ],
        },
        {
          nom: 'SHS 3',
          series: [
            { code: 'General Science', label: 'General Science' },
            { code: 'General Arts', label: 'General Arts' },
            { code: 'Business', label: 'Business Studies' },
            { code: 'Home Economics', label: 'Home Economics' },
            { code: 'Visual Arts', label: 'Visual Arts' },
            { code: 'Technical', label: 'Technical & Vocational' },
            { code: 'Agricultural Science', label: 'Agricultural Science' },
          ],
        },
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
  BJ_FRANCOPHONE,
  TG_FRANCOPHONE,
  BF_FRANCOPHONE,
  ML_FRANCOPHONE,
  NE_FRANCOPHONE,
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
  // Multi-word classes like "1ère primaire", "Lower Sixth", "4ème humanités"
  const commonMultiWord = ['primaire', 'secondaire', 'technique', 'Sixth', 'section', 'humanités', 'année'];
  if (commonMultiWord.some(w => full.includes(w))) {
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
