/** Legacy — conservé pour compat avec les pages qui n'ont pas migré vers schoolSystems.ts multi-pays. */
export { PAYS_PAR_DEFAUT, getSystemeById } from './schoolSystems';
export type { PaysCode } from './schoolSystems';

export const NIVEAUX_PAR_SYSTEME_LEGACY = {
  francophone: ['Maternelle', 'Primaire', 'Collège / Lycée', 'Technique'],
  anglophone: ['Nursery', 'Primary', 'Secondary / High School'],
} as const;

export const CLASSES_PAR_SYSTEME_NIVEAU_LEGACY = {
  francophone: {
    'Maternelle': ['Petite section', 'Moyenne section', 'Grande section'],
    'Primaire': ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'],
    'Collège / Lycée': [
      '6ème', '5ème', '4ème', '3ème',
      '2nde', '1ère A', '1ère C', '1ère D',
      'Tle A', 'Tle C', 'Tle D',
    ],
    'Technique': [
      'CAP1', 'CAP2', 'CAP3',
      'BT1', 'BT2', 'BT3',
      '1ère F', '1ère TI', 'Tle F', 'Tle TI',
    ],
  },
  anglophone: {
    'Nursery': ['Nursery 1', 'Nursery 2'],
    'Primary': ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6'],
    'Secondary / High School': [
      'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5',
      'Lower Sixth', 'Upper Sixth',
    ],
  },
} as const;
