// ✅ SYSTÈMES ÉDUCATIFS PAR PAYS FRANCOPHONE D'AFRIQUE
// Adaptation intelligente des niveaux scolaires et matières selon le pays

export interface NiveauScolaire {
    code: string;
    nom: string;
    age?: string;
    type: 'maternelle' | 'primaire' | 'college' | 'lycee' | 'superieur';
    examens?: string[];
}

export interface MatiereParNiveau {
    matiere: string;
    obligatoire: boolean;
    niveaux: string[]; // Codes des niveaux où cette matière est enseignée
}

export interface SystemeEducatif {
    codePays: string;
    nomPays: string;
    emoji: string;
    niveaux: NiveauScolaire[];
    matieres: MatiereParNiveau[];
    examensNationaux: string[];
}

// ============================================================================
// 🇨🇲 SYSTÈME ÉDUCATIF CAMEROUN (Francophone + Anglophone)
// ============================================================================
export const SYSTEME_CAMEROUN: SystemeEducatif = {
    codePays: 'CM',
    nomPays: 'Cameroun',
    emoji: '🇨🇲',
    niveaux: [
        // Maternelle
        { code: 'MAT_PS', nom: 'Petite Section', age: '3-4 ans', type: 'maternelle' },
        { code: 'MAT_MS', nom: 'Moyenne Section', age: '4-5 ans', type: 'maternelle' },
        { code: 'MAT_GS', nom: 'Grande Section', age: '5-6 ans', type: 'maternelle' },

        // Primaire (SIL - Cours Élémentaire - Cours Moyen)
        { code: 'PRI_SIL', nom: 'SIL (Section d\'Initiation au Langage)', age: '6 ans', type: 'primaire' },
        { code: 'PRI_CP', nom: 'CP (Cours Préparatoire)', age: '6-7 ans', type: 'primaire' },
        { code: 'PRI_CE1', nom: 'CE1', age: '7-8 ans', type: 'primaire' },
        { code: 'PRI_CE2', nom: 'CE2', age: '8-9 ans', type: 'primaire' },
        { code: 'PRI_CM1', nom: 'CM1', age: '9-10 ans', type: 'primaire' },
        { code: 'PRI_CM2', nom: 'CM2', age: '10-11 ans', type: 'primaire', examens: ['CEP - Certificat d\'Études Primaires'] },

        // Collège
        { code: 'COL_6', nom: '6ème', age: '11-12 ans', type: 'college' },
        { code: 'COL_5', nom: '5ème', age: '12-13 ans', type: 'college' },
        { code: 'COL_4', nom: '4ème', age: '13-14 ans', type: 'college' },
        { code: 'COL_3', nom: '3ème', age: '14-15 ans', type: 'college', examens: ['BEPC - Brevet d\'Études du Premier Cycle'] },

        // Lycée
        { code: 'LYC_2', nom: 'Seconde', age: '15-16 ans', type: 'lycee' },
        { code: 'LYC_1', nom: 'Première', age: '16-17 ans', type: 'lycee', examens: ['Probatoire'] },
        { code: 'LYC_T', nom: 'Terminale', age: '17-18 ans', type: 'lycee', examens: ['Baccalauréat (Bac A, C, D, etc.)'] },

        // Supérieur
        { code: 'SUP_L1', nom: 'Licence 1 (L1)', type: 'superieur' },
        { code: 'SUP_L2', nom: 'Licence 2 (L2)', type: 'superieur' },
        { code: 'SUP_L3', nom: 'Licence 3 (L3)', type: 'superieur' },
        { code: 'SUP_M1', nom: 'Master 1 (M1)', type: 'superieur' },
        { code: 'SUP_M2', nom: 'Master 2 (M2)', type: 'superieur' },
        { code: 'SUP_BTS', nom: 'BTS 1ère/2ème année', type: 'superieur' },
        { code: 'SUP_DOC', nom: 'Doctorat', type: 'superieur' },
    ],

    matieres: [
        // Matières fondamentales (tous niveaux)
        { matiere: 'Mathématiques', obligatoire: true, niveaux: ['PRI_CP', 'PRI_CE1', 'PRI_CE2', 'PRI_CM1', 'PRI_CM2', 'COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Français', obligatoire: true, niveaux: ['PRI_CP', 'PRI_CE1', 'PRI_CE2', 'PRI_CM1', 'PRI_CM2', 'COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Anglais', obligatoire: true, niveaux: ['PRI_CE2', 'PRI_CM1', 'PRI_CM2', 'COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },

        // Sciences
        { matiere: 'Sciences (SVT)', obligatoire: true, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Physique-Chimie', obligatoire: true, niveaux: ['COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },

        // Humanités
        { matiere: 'Histoire-Géographie', obligatoire: true, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Philosophie', obligatoire: false, niveaux: ['LYC_T'] },

        // Langues vivantes
        { matiere: 'Allemand', obligatoire: false, niveaux: ['COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Espagnol', obligatoire: false, niveaux: ['COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },

        // Autres
        { matiere: 'Informatique', obligatoire: false, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Arts & Culture', obligatoire: false, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3'] },
        { matiere: 'Éducation physique (EPS)', obligatoire: false, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1'] },
    ],

    examensNationaux: ['CEP', 'BEPC', 'Probatoire', 'Baccalauréat']
};

// ============================================================================
// 🇨🇩 SYSTÈME ÉDUCATIF RDC
// ============================================================================
export const SYSTEME_RDC: SystemeEducatif = {
    codePays: 'CD',
    nomPays: 'RDC',
    emoji: '🇨🇩',
    niveaux: [
        // Maternelle
        { code: 'MAT_PS', nom: 'Maternelle Petite Section', age: '3-4 ans', type: 'maternelle' },
        { code: 'MAT_GS', nom: 'Maternelle Grande Section', age: '5-6 ans', type: 'maternelle' },

        // Primaire (6 ans)
        { code: 'PRI_1', nom: '1ère Primaire', age: '6-7 ans', type: 'primaire' },
        { code: 'PRI_2', nom: '2ème Primaire', age: '7-8 ans', type: 'primaire' },
        { code: 'PRI_3', nom: '3ème Primaire', age: '8-9 ans', type: 'primaire' },
        { code: 'PRI_4', nom: '4ème Primaire', age: '9-10 ans', type: 'primaire' },
        { code: 'PRI_5', nom: '5ème Primaire', age: '10-11 ans', type: 'primaire' },
        { code: 'PRI_6', nom: '6ème Primaire', age: '11-12 ans', type: 'primaire', examens: ['TENAFEP - Test National de Fin d\'Études Primaires'] },

        // Secondaire (6 ans) - Cycle d'orientation + Humanités
        { code: 'SEC_1', nom: '1ère Secondaire', age: '12-13 ans', type: 'college' },
        { code: 'SEC_2', nom: '2ème Secondaire', age: '13-14 ans', type: 'college' },
        { code: 'SEC_3', nom: '3ème Secondaire', age: '14-15 ans', type: 'college' },
        { code: 'SEC_4', nom: '4ème Secondaire', age: '15-16 ans', type: 'lycee' },
        { code: 'SEC_5', nom: '5ème Secondaire', age: '16-17 ans', type: 'lycee' },
        { code: 'SEC_6', nom: '6ème Secondaire', age: '17-18 ans', type: 'lycee', examens: ['Exetat - Examen d\'État'] },

        // Supérieur
        { code: 'SUP_G1', nom: 'Graduat 1ère année', type: 'superieur' },
        { code: 'SUP_G2', nom: 'Graduat 2ème année', type: 'superieur' },
        { code: 'SUP_G3', nom: 'Graduat 3ème année', type: 'superieur' },
        { code: 'SUP_L1', nom: 'Licence 1ère année', type: 'superieur' },
        { code: 'SUP_L2', nom: 'Licence 2ème année', type: 'superieur' },
    ],

    matieres: [
        { matiere: 'Mathématiques', obligatoire: true, niveaux: ['PRI_1', 'PRI_2', 'PRI_3', 'PRI_4', 'PRI_5', 'PRI_6', 'SEC_1', 'SEC_2', 'SEC_3', 'SEC_4', 'SEC_5', 'SEC_6'] },
        { matiere: 'Français', obligatoire: true, niveaux: ['PRI_1', 'PRI_2', 'PRI_3', 'PRI_4', 'PRI_5', 'PRI_6', 'SEC_1', 'SEC_2', 'SEC_3', 'SEC_4', 'SEC_5', 'SEC_6'] },
        { matiere: 'Anglais', obligatoire: true, niveaux: ['SEC_1', 'SEC_2', 'SEC_3', 'SEC_4', 'SEC_5', 'SEC_6'] },
        { matiere: 'Lingala', obligatoire: false, niveaux: ['PRI_3', 'PRI_4', 'PRI_5', 'PRI_6'] },
        { matiere: 'Sciences', obligatoire: true, niveaux: ['SEC_1', 'SEC_2', 'SEC_3', 'SEC_4', 'SEC_5', 'SEC_6'] },
        { matiere: 'Histoire-Géographie', obligatoire: true, niveaux: ['SEC_1', 'SEC_2', 'SEC_3', 'SEC_4', 'SEC_5', 'SEC_6'] },
    ],

    examensNationaux: ['TENAFEP', 'Exetat']
};

// ============================================================================
// 🇨🇮 SYSTÈME ÉDUCATIF CÔTE D'IVOIRE
// ============================================================================
export const SYSTEME_COTE_IVOIRE: SystemeEducatif = {
    codePays: 'CI',
    nomPays: 'Côte d\'Ivoire',
    emoji: '🇨🇮',
    niveaux: [
        // Préscolaire
        { code: 'PRE_PS', nom: 'Petite Section', age: '3-4 ans', type: 'maternelle' },
        { code: 'PRE_MS', nom: 'Moyenne Section', age: '4-5 ans', type: 'maternelle' },
        { code: 'PRE_GS', nom: 'Grande Section', age: '5-6 ans', type: 'maternelle' },

        // Primaire (6 ans)
        { code: 'PRI_CP1', nom: 'CP1', age: '6-7 ans', type: 'primaire' },
        { code: 'PRI_CP2', nom: 'CP2', age: '7-8 ans', type: 'primaire' },
        { code: 'PRI_CE1', nom: 'CE1', age: '8-9 ans', type: 'primaire' },
        { code: 'PRI_CE2', nom: 'CE2', age: '9-10 ans', type: 'primaire' },
        { code: 'PRI_CM1', nom: 'CM1', age: '10-11 ans', type: 'primaire' },
        { code: 'PRI_CM2', nom: 'CM2', age: '11-12 ans', type: 'primaire', examens: ['CEPE - Certificat d\'Études Primaires Élémentaires'] },

        // Collège (4 ans)
        { code: 'COL_6', nom: '6ème', age: '12-13 ans', type: 'college' },
        { code: 'COL_5', nom: '5ème', age: '13-14 ans', type: 'college' },
        { code: 'COL_4', nom: '4ème', age: '14-15 ans', type: 'college' },
        { code: 'COL_3', nom: '3ème', age: '15-16 ans', type: 'college', examens: ['BEPC - Brevet d\'Études du Premier Cycle'] },

        // Lycée (3 ans)
        { code: 'LYC_2', nom: 'Seconde', age: '16-17 ans', type: 'lycee' },
        { code: 'LYC_1', nom: 'Première', age: '17-18 ans', type: 'lycee' },
        { code: 'LYC_T', nom: 'Terminale', age: '18-19 ans', type: 'lycee', examens: ['Baccalauréat'] },

        // Supérieur
        { code: 'SUP_BTS', nom: 'BTS', type: 'superieur' },
        { code: 'SUP_L', nom: 'Licence (L1-L3)', type: 'superieur' },
        { code: 'SUP_M', nom: 'Master', type: 'superieur' },
    ],

    matieres: [
        { matiere: 'Mathématiques', obligatoire: true, niveaux: ['PRI_CP1', 'PRI_CP2', 'PRI_CE1', 'PRI_CE2', 'PRI_CM1', 'PRI_CM2', 'COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Français', obligatoire: true, niveaux: ['PRI_CP1', 'PRI_CP2', 'PRI_CE1', 'PRI_CE2', 'PRI_CM1', 'PRI_CM2', 'COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Anglais', obligatoire: true, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'SVT (Sciences)', obligatoire: true, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Physique-Chimie', obligatoire: true, niveaux: ['COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Histoire-Géographie', obligatoire: true, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Philosophie', obligatoire: false, niveaux: ['LYC_T'] },
    ],

    examensNationaux: ['CEPE', 'BEPC', 'Baccalauréat']
};

// ============================================================================
// 🇸🇳 SYSTÈME ÉDUCATIF SÉNÉGAL
// ============================================================================
export const SYSTEME_SENEGAL: SystemeEducatif = {
    codePays: 'SN',
    nomPays: 'Sénégal',
    emoji: '🇸🇳',
    niveaux: [
        // Préscolaire
        { code: 'PRE', nom: 'Préscolaire (3-6 ans)', age: '3-6 ans', type: 'maternelle' },

        // Élémentaire (6 ans)
        { code: 'ELE_CI', nom: 'CI (Cours d\'Initiation)', age: '6-7 ans', type: 'primaire' },
        { code: 'ELE_CP', nom: 'CP (Cours Préparatoire)', age: '7-8 ans', type: 'primaire' },
        { code: 'ELE_CE1', nom: 'CE1', age: '8-9 ans', type: 'primaire' },
        { code: 'ELE_CE2', nom: 'CE2', age: '9-10 ans', type: 'primaire' },
        { code: 'ELE_CM1', nom: 'CM1', age: '10-11 ans', type: 'primaire' },
        { code: 'ELE_CM2', nom: 'CM2', age: '11-12 ans', type: 'primaire', examens: ['CFEE - Certificat de Fin d\'Études Élémentaires'] },

        // Moyen (4 ans)
        { code: 'MOY_6', nom: '6ème', age: '12-13 ans', type: 'college' },
        { code: 'MOY_5', nom: '5ème', age: '13-14 ans', type: 'college' },
        { code: 'MOY_4', nom: '4ème', age: '14-15 ans', type: 'college' },
        { code: 'MOY_3', nom: '3ème', age: '15-16 ans', type: 'college', examens: ['BFEM - Brevet de Fin d\'Études Moyennes'] },

        // Secondaire (3 ans)
        { code: 'SEC_2', nom: 'Seconde', age: '16-17 ans', type: 'lycee' },
        { code: 'SEC_1', nom: 'Première', age: '17-18 ans', type: 'lycee' },
        { code: 'SEC_T', nom: 'Terminale', age: '18-19 ans', type: 'lycee', examens: ['Baccalauréat'] },

        // Supérieur
        { code: 'SUP_L', nom: 'Licence', type: 'superieur' },
        { code: 'SUP_M', nom: 'Master', type: 'superieur' },
    ],

    matieres: [
        { matiere: 'Mathématiques', obligatoire: true, niveaux: ['ELE_CI', 'ELE_CP', 'ELE_CE1', 'ELE_CE2', 'ELE_CM1', 'ELE_CM2', 'MOY_6', 'MOY_5', 'MOY_4', 'MOY_3', 'SEC_2', 'SEC_1', 'SEC_T'] },
        { matiere: 'Français', obligatoire: true, niveaux: ['ELE_CI', 'ELE_CP', 'ELE_CE1', 'ELE_CE2', 'ELE_CM1', 'ELE_CM2', 'MOY_6', 'MOY_5', 'MOY_4', 'MOY_3', 'SEC_2', 'SEC_1', 'SEC_T'] },
        { matiere: 'Wolof', obligatoire: false, niveaux: ['ELE_CE1', 'ELE_CE2', 'ELE_CM1', 'ELE_CM2'] },
        { matiere: 'Anglais', obligatoire: true, niveaux: ['MOY_6', 'MOY_5', 'MOY_4', 'MOY_3', 'SEC_2', 'SEC_1', 'SEC_T'] },
        { matiere: 'Sciences', obligatoire: true, niveaux: ['MOY_6', 'MOY_5', 'MOY_4', 'MOY_3', 'SEC_2', 'SEC_1', 'SEC_T'] },
        { matiere: 'Histoire-Géographie', obligatoire: true, niveaux: ['MOY_6', 'MOY_5', 'MOY_4', 'MOY_3', 'SEC_2', 'SEC_1', 'SEC_T'] },
    ],

    examensNationaux: ['CFEE', 'BFEM', 'Baccalauréat']
};

// ============================================================================
// 🇲🇱 SYSTÈME ÉDUCATIF MALI
// ============================================================================
export const SYSTEME_MALI: SystemeEducatif = {
    codePays: 'ML',
    nomPays: 'Mali',
    emoji: '🇲🇱',
    niveaux: [
        // Préscolaire
        { code: 'PRE', nom: 'Préscolaire', age: '3-6 ans', type: 'maternelle' },

        // Fondamental 1er cycle (6 ans)
        { code: 'FOND1_1', nom: '1ère année', age: '6-7 ans', type: 'primaire' },
        { code: 'FOND1_2', nom: '2ème année', age: '7-8 ans', type: 'primaire' },
        { code: 'FOND1_3', nom: '3ème année', age: '8-9 ans', type: 'primaire' },
        { code: 'FOND1_4', nom: '4ème année', age: '9-10 ans', type: 'primaire' },
        { code: 'FOND1_5', nom: '5ème année', age: '10-11 ans', type: 'primaire' },
        { code: 'FOND1_6', nom: '6ème année', age: '11-12 ans', type: 'primaire', examens: ['CEP'] },

        // Fondamental 2ème cycle (3 ans)
        { code: 'FOND2_7', nom: '7ème année', age: '12-13 ans', type: 'college' },
        { code: 'FOND2_8', nom: '8ème année', age: '13-14 ans', type: 'college' },
        { code: 'FOND2_9', nom: '9ème année', age: '14-15 ans', type: 'college', examens: ['DEF - Diplôme d\'Études Fondamentales'] },

        // Secondaire (3 ans)
        { code: 'SEC_10', nom: '10ème année (Seconde)', age: '15-16 ans', type: 'lycee' },
        { code: 'SEC_11', nom: '11ème année (Première)', age: '16-17 ans', type: 'lycee' },
        { code: 'SEC_12', nom: '12ème année (Terminale)', age: '17-18 ans', type: 'lycee', examens: ['Baccalauréat'] },
    ],

    matieres: [
        { matiere: 'Mathématiques', obligatoire: true, niveaux: ['FOND1_1', 'FOND1_2', 'FOND1_3', 'FOND1_4', 'FOND1_5', 'FOND1_6', 'FOND2_7', 'FOND2_8', 'FOND2_9', 'SEC_10', 'SEC_11', 'SEC_12'] },
        { matiere: 'Français', obligatoire: true, niveaux: ['FOND1_1', 'FOND1_2', 'FOND1_3', 'FOND1_4', 'FOND1_5', 'FOND1_6', 'FOND2_7', 'FOND2_8', 'FOND2_9', 'SEC_10', 'SEC_11', 'SEC_12'] },
        { matiere: 'Bambara', obligatoire: false, niveaux: ['FOND1_3', 'FOND1_4', 'FOND1_5', 'FOND1_6'] },
        { matiere: 'Anglais', obligatoire: true, niveaux: ['FOND2_7', 'FOND2_8', 'FOND2_9', 'SEC_10', 'SEC_11', 'SEC_12'] },
        { matiere: 'Sciences', obligatoire: true, niveaux: ['FOND2_7', 'FOND2_8', 'FOND2_9', 'SEC_10', 'SEC_11', 'SEC_12'] },
    ],

    examensNationaux: ['CEP', 'DEF', 'Baccalauréat']
};

// ============================================================================
// SYSTÈME GÉNÉRIQUE (pour pays sans système spécifique)
// ============================================================================
export const SYSTEME_GENERIQUE: SystemeEducatif = {
    codePays: 'GEN',
    nomPays: 'Générique',
    emoji: '🌍',
    niveaux: [
        { code: 'MAT', nom: 'Maternelle (3-6 ans)', type: 'maternelle' },
        { code: 'PRI_CP', nom: 'CP', type: 'primaire' },
        { code: 'PRI_CE1', nom: 'CE1', type: 'primaire' },
        { code: 'PRI_CE2', nom: 'CE2', type: 'primaire' },
        { code: 'PRI_CM1', nom: 'CM1', type: 'primaire' },
        { code: 'PRI_CM2', nom: 'CM2', type: 'primaire' },
        { code: 'COL_6', nom: '6ème', type: 'college' },
        { code: 'COL_5', nom: '5ème', type: 'college' },
        { code: 'COL_4', nom: '4ème', type: 'college' },
        { code: 'COL_3', nom: '3ème', type: 'college' },
        { code: 'LYC_2', nom: 'Seconde', type: 'lycee' },
        { code: 'LYC_1', nom: 'Première', type: 'lycee' },
        { code: 'LYC_T', nom: 'Terminale', type: 'lycee' },
        { code: 'SUP', nom: 'Supérieur', type: 'superieur' },
    ],

    matieres: [
        { matiere: 'Mathématiques', obligatoire: true, niveaux: ['PRI_CP', 'PRI_CE1', 'PRI_CE2', 'PRI_CM1', 'PRI_CM2', 'COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Français', obligatoire: true, niveaux: ['PRI_CP', 'PRI_CE1', 'PRI_CE2', 'PRI_CM1', 'PRI_CM2', 'COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Anglais', obligatoire: true, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
        { matiere: 'Sciences', obligatoire: true, niveaux: ['COL_6', 'COL_5', 'COL_4', 'COL_3', 'LYC_2', 'LYC_1', 'LYC_T'] },
    ],

    examensNationaux: ['CEP', 'BEPC', 'Baccalauréat']
};

// ============================================================================
// EXPORT TOUS LES SYSTÈMES
// ============================================================================
export const TOUS_LES_SYSTEMES_EDUCATIFS: SystemeEducatif[] = [
    SYSTEME_CAMEROUN,
    SYSTEME_RDC,
    SYSTEME_COTE_IVOIRE,
    SYSTEME_SENEGAL,
    SYSTEME_MALI,
    // Les autres pays utiliseront le système générique
];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupère le système éducatif d'un pays
 */
export const getSystemeEducatif = (codePays: string): SystemeEducatif => {
    return TOUS_LES_SYSTEMES_EDUCATIFS.find(s => s.codePays === codePays) || SYSTEME_GENERIQUE;
};

/**
 * Génère la liste des niveaux scolaires pour un pays
 */
export const genererNiveauxScolaires = (codePays: string = 'CM'): string[] => {
    const systeme = getSystemeEducatif(codePays);

    const niveaux: string[] = [];

    // Grouper par type
    const maternelle = systeme.niveaux.filter(n => n.type === 'maternelle');
    const primaire = systeme.niveaux.filter(n => n.type === 'primaire');
    const college = systeme.niveaux.filter(n => n.type === 'college');
    const lycee = systeme.niveaux.filter(n => n.type === 'lycee');
    const superieur = systeme.niveaux.filter(n => n.type === 'superieur');

    // Maternelle
    if (maternelle.length > 0) {
        niveaux.push(`─── ${systeme.emoji} MATERNELLE ───`);
        maternelle.forEach(n => niveaux.push(`${systeme.emoji} ${n.nom}${n.age ? ' (' + n.age + ')' : ''}`));
    }

    // Primaire
    if (primaire.length > 0) {
        niveaux.push(`─── ${systeme.emoji} PRIMAIRE ───`);
        primaire.forEach(n => niveaux.push(`${systeme.emoji} ${n.nom}${n.age ? ' (' + n.age + ')' : ''}`));
    }

    // Collège
    if (college.length > 0) {
        niveaux.push(`─── ${systeme.emoji} COLLÈGE ───`);
        college.forEach(n => niveaux.push(`${systeme.emoji} ${n.nom}${n.age ? ' (' + n.age + ')' : ''}`));
    }

    // Lycée
    if (lycee.length > 0) {
        niveaux.push(`─── ${systeme.emoji} LYCÉE ───`);
        lycee.forEach(n => niveaux.push(`${systeme.emoji} ${n.nom}${n.age ? ' (' + n.age + ')' : ''}`));
    }

    // Supérieur
    if (superieur.length > 0) {
        niveaux.push(`─── ${systeme.emoji} SUPÉRIEUR ───`);
        superieur.forEach(n => niveaux.push(`${systeme.emoji} ${n.nom}`));
    }

    // Options globales
    niveaux.push('──────────────────');
    niveaux.push('📚 Tous niveaux (Maternelle → Terminale)');
    niveaux.push('🎓 Enseignement supérieur uniquement');
    niveaux.push('👨‍🎓 Formation adultes / Remise à niveau');
    niveaux.push('🆕 Autre (préciser)');

    return niveaux;
};

/**
 * Génère la liste des matières pour un pays
 */
export const genererMatieres = (codePays: string = 'CM'): string[] => {
    const systeme = getSystemeEducatif(codePays);

    const matieres: string[] = [];

    // Matières obligatoires d'abord
    const obligatoires = systeme.matieres.filter(m => m.obligatoire);
    if (obligatoires.length > 0) {
        matieres.push(`─── ${systeme.emoji} MATIÈRES PRINCIPALES ───`);
        obligatoires.forEach(m => matieres.push(m.matiere));
    }

    // Matières optionnelles
    const optionnelles = systeme.matieres.filter(m => !m.obligatoire);
    if (optionnelles.length > 0) {
        matieres.push(`─── ${systeme.emoji} MATIÈRES OPTIONNELLES ───`);
        optionnelles.forEach(m => matieres.push(m.matiere));
    }

    // Matières universelles (tous pays)
    matieres.push('─── 🌍 MATIÈRES UNIVERSELLES ───');
    matieres.push('Informatique / Bureautique');
    matieres.push('Économie / Gestion');
    matieres.push('Comptabilité');
    matieres.push('Arts plastiques / Dessin');
    matieres.push('Musique');
    matieres.push('Éducation physique (Sport)');

    // Options spéciales
    matieres.push('──────────────────');
    matieres.push('📚 Aide aux devoirs (toutes matières)');
    matieres.push('🎯 Méthodologie & organisation');
    matieres.push('📝 Préparation examens nationaux');
    matieres.push('🆕 Autre matière (préciser)');

    return matieres;
};

/**
 * Récupère les examens nationaux d'un pays
 */
export const getExamensNationaux = (codePays: string): string[] => {
    const systeme = getSystemeEducatif(codePays);
    return systeme.examensNationaux;
};


