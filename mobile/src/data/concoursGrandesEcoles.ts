// ✅ SYSTÈME COMPLET DES CONCOURS ET GRANDES ÉCOLES D'AFRIQUE FRANCOPHONE
// Préparation aux concours : écoles d'ingénieurs, médecine, commerce, administration, etc.

export interface ConcoursInfo {
    code: string;
    nom: string;
    nomComplet: string;
    type: 'ingenieur' | 'medecine' | 'commerce' | 'administration' | 'enseignement' | 'autre';
    niveau: 'bac' | 'bac+2' | 'bac+3' | 'bac+5';
    pays: string;
    emojiPays: string;
    matieres: string[]; // Matières au concours
    dureePreparation: string; // Durée typique de préparation
    difficulte: 'Moyenne' | 'Élevée' | 'Très élevée';
    placesDisponibles?: number;
    tauxReussite?: string;
}

export interface DomaineConcoursInfo {
    domaine: string;
    icon: string;
    concours: ConcoursInfo[];
}

// ============================================================================
// 🇨🇲 CONCOURS CAMEROUN
// ============================================================================

const CONCOURS_CAMEROUN: ConcoursInfo[] = [
    // ÉCOLES D'INGÉNIEURS
    {
        code: 'ENAM_CM',
        nom: 'ENAM',
        nomComplet: 'École Nationale d\'Administration et de Magistrature',
        type: 'administration',
        niveau: 'bac+3',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Culture générale', 'Français', 'Anglais', 'Droit', 'Économie', 'Sciences politiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'POLY_YDE',
        nom: 'Polytechnique Yaoundé',
        nomComplet: 'École Nationale Supérieure Polytechnique de Yaoundé',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Anglais'],
        dureePreparation: '12-24 mois',
        difficulte: 'Très élevée',
        placesDisponibles: 300
    },
    {
        code: 'POLY_DLA',
        nom: 'Polytechnique Douala',
        nomComplet: 'École Nationale Supérieure Polytechnique de Douala',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Anglais'],
        dureePreparation: '12-24 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENS_YDE',
        nom: 'ENS Yaoundé',
        nomComplet: 'École Normale Supérieure de Yaoundé',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'FMSB_CM',
        nom: 'FMSB',
        nomComplet: 'Faculté de Médecine et des Sciences Biomédicales',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ESSEC_CM',
        nom: 'ESSEC Douala/Yaoundé',
        nomComplet: 'École Supérieure des Sciences Économiques et Commerciales',
        type: 'commerce',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Économie', 'Français', 'Anglais', 'Culture générale'],
        dureePreparation: '6-12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'IRIC_CM',
        nom: 'IRIC',
        nomComplet: 'Institut des Relations Internationales du Cameroun',
        type: 'administration',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Culture générale', 'Anglais', 'Français', 'Sciences politiques', 'Relations internationales'],
        dureePreparation: '6-12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'ENSP_CM',
        nom: 'ENSP Yaoundé',
        nomComplet: 'École Nationale Supérieure de Police',
        type: 'administration',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Culture générale', 'Français', 'Anglais', 'Sport', 'Tests psychotechniques'],
        dureePreparation: '6 mois',
        difficulte: 'Élevée'
    },
    // ÉCOLES INFORMATIQUE & TÉLÉCOMMUNICATIONS
    {
        code: 'IIA_CM',
        nom: 'IIA',
        nomComplet: 'Institut d\'Informatique Appliquée',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Informatique', 'Logique', 'Anglais'],
        dureePreparation: '6-12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'IAI_CM',
        nom: 'IAI Cameroun',
        nomComplet: 'Institut Africain d\'Informatique',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Informatique', 'Physique', 'Anglais'],
        dureePreparation: '6-12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'ENIET_CM',
        nom: 'ENIET Douala',
        nomComplet: 'École Nationale d\'Ingénierie d\'Électronique et de Télécommunications',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Électronique', 'Anglais'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    // ÉCOLES ENSEIGNEMENT TECHNIQUE
    {
        code: 'ENSET_DOUALA',
        nom: 'ENSET Douala',
        nomComplet: 'École Normale Supérieure d\'Enseignement Technique de Douala',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Technologie', 'Mécanique', 'Électronique'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'ENSET_BAMENDA',
        nom: 'ENSET Bamenda',
        nomComplet: 'École Normale Supérieure d\'Enseignement Technique de Bamenda',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Technologie', 'Anglais'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // ÉCOLES TRAVAUX PUBLICS & TRANSPORTS
    {
        code: 'ENTP_CM',
        nom: 'ENTP Yaoundé',
        nomComplet: 'École Nationale des Travaux Publics',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Topographie', 'Dessin technique'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'ENPT_CM',
        nom: 'ENPT Ngaoundéré',
        nomComplet: 'École Nationale des Postes et Télécommunications',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Télécommunications', 'Informatique'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // ÉCOLES STATISTIQUES
    {
        code: 'ISSEA_CM',
        nom: 'ISSEA Yaoundé',
        nomComplet: 'Institut Sous-régional de Statistique et d\'Économie Appliquée',
        type: 'autre',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Statistiques', 'Économie', 'Informatique'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // ÉCOLES AÉRONAUTIQUE & MÉTÉO
    {
        code: 'ASECNA_CM',
        nom: 'ASECNA',
        nomComplet: 'École Africaine de la Météorologie et de l\'Aviation Civile',
        type: 'autre',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Météorologie', 'Anglais'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    // IUT (Instituts Universitaires de Technologie)
    {
        code: 'IUT_DOUALA',
        nom: 'IUT Douala',
        nomComplet: 'Institut Universitaire de Technologie de Douala',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Technologie', 'Français'],
        dureePreparation: '6-12 mois',
        difficulte: 'Moyenne'
    },
    {
        code: 'IUT_NGAOUNDERE',
        nom: 'IUT Ngaoundéré',
        nomComplet: 'Institut Universitaire de Technologie de Ngaoundéré',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Technologie'],
        dureePreparation: '6-12 mois',
        difficulte: 'Moyenne'
    },
    {
        code: 'IUT_FOTSO',
        nom: 'IUT-FV Bandjoun',
        nomComplet: 'Institut Universitaire de Technologie Fotso Victor',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Cameroun',
        emojiPays: '🇨🇲',
        matieres: ['Mathématiques', 'Physique', 'Informatique', 'Gestion'],
        dureePreparation: '6-12 mois',
        difficulte: 'Moyenne'
    },
];

// ============================================================================
// 🇨🇩 CONCOURS RDC
// ============================================================================

const CONCOURS_RDC: ConcoursInfo[] = [
    {
        code: 'UNIKIN_MED',
        nom: 'Médecine UNIKIN',
        nomComplet: 'Faculté de Médecine - Université de Kinshasa',
        type: 'medecine',
        niveau: 'bac',
        pays: 'RDC',
        emojiPays: '🇨🇩',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'POLY_UNIKIN',
        nom: 'Polytechnique UNIKIN',
        nomComplet: 'École Polytechnique - Université de Kinshasa',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'RDC',
        emojiPays: '🇨🇩',
        matieres: ['Mathématiques', 'Physique', 'Chimie'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'UNILU_POLY',
        nom: 'Polytechnique UNILU',
        nomComplet: 'École Polytechnique - Université de Lubumbashi',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'RDC',
        emojiPays: '🇨🇩',
        matieres: ['Mathématiques', 'Physique', 'Chimie'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ISC_KINSHASA',
        nom: 'ISC Kinshasa',
        nomComplet: 'Institut Supérieur de Commerce',
        type: 'commerce',
        niveau: 'bac',
        pays: 'RDC',
        emojiPays: '🇨🇩',
        matieres: ['Mathématiques', 'Économie', 'Français', 'Anglais'],
        dureePreparation: '6 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'ENA_RDC',
        nom: 'ENA Kinshasa',
        nomComplet: 'École Nationale d\'Administration',
        type: 'administration',
        niveau: 'bac+2',
        pays: 'RDC',
        emojiPays: '🇨🇩',
        matieres: ['Culture générale', 'Droit', 'Économie', 'Sciences politiques', 'Français'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ISP_BUKAVU',
        nom: 'ISP Bukavu',
        nomComplet: 'Institut Supérieur Pédagogique de Bukavu',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'RDC',
        emojiPays: '🇨🇩',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Pédagogie'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'UPN_RDC',
        nom: 'UPN Kinshasa',
        nomComplet: 'Université Pédagogique Nationale',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'RDC',
        emojiPays: '🇨🇩',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Pédagogie'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
];

// ============================================================================
// 🇨🇮 CONCOURS CÔTE D'IVOIRE
// ============================================================================

const CONCOURS_COTE_IVOIRE: ConcoursInfo[] = [
    {
        code: 'INP_HB',
        nom: 'INP-HB',
        nomComplet: 'Institut National Polytechnique Houphouët-Boigny',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Côte d\'Ivoire',
        emojiPays: '🇨🇮',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'SVT', 'Français'],
        dureePreparation: '12-24 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENS_ABJ',
        nom: 'ENS Abidjan',
        nomComplet: 'École Normale Supérieure d\'Abidjan',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Côte d\'Ivoire',
        emojiPays: '🇨🇮',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Anglais', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'INFAS_CI',
        nom: 'INFAS',
        nomComplet: 'Institut National de Formation des Agents de Santé',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Côte d\'Ivoire',
        emojiPays: '🇨🇮',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Français'],
        dureePreparation: '6 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'ENA_CI',
        nom: 'ENA Abidjan',
        nomComplet: 'École Nationale d\'Administration',
        type: 'administration',
        niveau: 'bac+2',
        pays: 'Côte d\'Ivoire',
        emojiPays: '🇨🇮',
        matieres: ['Culture générale', 'Droit', 'Économie', 'Sciences politiques', 'Français', 'Anglais'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'MED_COCODY',
        nom: 'Médecine Cocody',
        nomComplet: 'UFR Sciences Médicales - Université Félix Houphouët-Boigny',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Côte d\'Ivoire',
        emojiPays: '🇨🇮',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'INPHB_ESMG',
        nom: 'ESMG',
        nomComplet: 'École Supérieure des Mines et de Géologie',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Côte d\'Ivoire',
        emojiPays: '🇨🇮',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Géologie'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ESCAE_CI',
        nom: 'ESCAE Abidjan',
        nomComplet: 'École Supérieure de Commerce et d\'Administration des Entreprises',
        type: 'commerce',
        niveau: 'bac',
        pays: 'Côte d\'Ivoire',
        emojiPays: '🇨🇮',
        matieres: ['Mathématiques', 'Économie', 'Français', 'Anglais', 'Gestion'],
        dureePreparation: '6-12 mois',
        difficulte: 'Élevée'
    },
];

// ============================================================================
// 🇸🇳 CONCOURS SÉNÉGAL
// ============================================================================

const CONCOURS_SENEGAL: ConcoursInfo[] = [
    {
        code: 'ESP_DAKAR',
        nom: 'ESP Dakar',
        nomComplet: 'École Supérieure Polytechnique de Dakar',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Sénégal',
        emojiPays: '🇸🇳',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Sciences', 'Français'],
        dureePreparation: '12-24 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'FASTEF',
        nom: 'FASTEF',
        nomComplet: 'Faculté des Sciences et Technologies de l\'Éducation et de la Formation',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Sénégal',
        emojiPays: '🇸🇳',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Anglais', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'MED_UCAD',
        nom: 'Médecine UCAD',
        nomComplet: 'Faculté de Médecine - Université Cheikh Anta Diop',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Sénégal',
        emojiPays: '🇸🇳',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENA_SN',
        nom: 'ENA Sénégal',
        nomComplet: 'École Nationale d\'Administration',
        type: 'administration',
        niveau: 'bac+2',
        pays: 'Sénégal',
        emojiPays: '🇸🇳',
        matieres: ['Culture générale', 'Droit', 'Économie', 'Sciences politiques', 'Français', 'Anglais'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'EISMV',
        nom: 'EISMV',
        nomComplet: 'École Inter-États des Sciences et Médecine Vétérinaires',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Sénégal',
        emojiPays: '🇸🇳',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques', 'SVT'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// 🇲🇱 CONCOURS MALI
// ============================================================================

const CONCOURS_MALI: ConcoursInfo[] = [
    {
        code: 'ENI_ABT',
        nom: 'ENI-ABT',
        nomComplet: 'École Nationale d\'Ingénieurs Abderhamane Baba Touré',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Mali',
        emojiPays: '🇲🇱',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Sciences'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENSUP_ML',
        nom: 'ENSup Bamako',
        nomComplet: 'École Normale Supérieure de Bamako',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Mali',
        emojiPays: '🇲🇱',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'MED_BAMAKO',
        nom: 'Médecine Bamako',
        nomComplet: 'Faculté de Médecine et d\'Odontostomatologie - USTTB',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Mali',
        emojiPays: '🇲🇱',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// 🇧🇫 CONCOURS BURKINA FASO
// ============================================================================

const CONCOURS_BURKINA_FASO: ConcoursInfo[] = [
    {
        code: 'POLY_BF',
        nom: '2iE',
        nomComplet: 'Institut International d\'Ingénierie de l\'Eau et de l\'Environnement',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Burkina Faso',
        emojiPays: '🇧🇫',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Français', 'Anglais'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENS_OUAGA',
        nom: 'ENS Ouagadougou',
        nomComplet: 'École Normale Supérieure de Ouagadougou',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Burkina Faso',
        emojiPays: '🇧🇫',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'MED_OUAGA',
        nom: 'Médecine Ouagadougou',
        nomComplet: 'UFR Sciences de la Santé - Université de Ouagadougou',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Burkina Faso',
        emojiPays: '🇧🇫',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// 🇧🇯 CONCOURS BÉNIN
// ============================================================================

const CONCOURS_BENIN: ConcoursInfo[] = [
    {
        code: 'EPAC_BENIN',
        nom: 'EPAC',
        nomComplet: 'École Polytechnique d\'Abomey-Calavi',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Bénin',
        emojiPays: '🇧🇯',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Français'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENS_NATITINGOU',
        nom: 'ENS Natitingou',
        nomComplet: 'École Normale Supérieure de Natitingou',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Bénin',
        emojiPays: '🇧🇯',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'MED_COTONOU',
        nom: 'Médecine Cotonou',
        nomComplet: 'Faculté des Sciences de la Santé - UAC',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Bénin',
        emojiPays: '🇧🇯',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// 🇹🇬 CONCOURS TOGO
// ============================================================================

const CONCOURS_TOGO: ConcoursInfo[] = [
    {
        code: 'POLY_LOME',
        nom: 'ENSI Lomé',
        nomComplet: 'École Nationale Supérieure d\'Ingénieurs',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Togo',
        emojiPays: '🇹🇬',
        matieres: ['Mathématiques', 'Physique', 'Chimie'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENS_LOME',
        nom: 'ENS Lomé',
        nomComplet: 'École Normale Supérieure de Lomé',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Togo',
        emojiPays: '🇹🇬',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'MED_LOME',
        nom: 'Médecine Lomé',
        nomComplet: 'Faculté des Sciences de la Santé - Université de Lomé',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Togo',
        emojiPays: '🇹🇬',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// 🇬🇦 CONCOURS GABON
// ============================================================================

const CONCOURS_GABON: ConcoursInfo[] = [
    {
        code: 'POLY_MASUKU',
        nom: 'Polytechnique Masuku',
        nomComplet: 'École Polytechnique de Masuku',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Gabon',
        emojiPays: '🇬🇦',
        matieres: ['Mathématiques', 'Physique', 'Chimie'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENS_LIBREVILLE',
        nom: 'ENS Libreville',
        nomComplet: 'École Normale Supérieure de Libreville',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Gabon',
        emojiPays: '🇬🇦',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'MED_LIBREVILLE',
        nom: 'Médecine Libreville',
        nomComplet: 'Faculté de Médecine - Université des Sciences de la Santé',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Gabon',
        emojiPays: '🇬🇦',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// 🇨🇬 CONCOURS CONGO-BRAZZAVILLE
// ============================================================================

const CONCOURS_CONGO: ConcoursInfo[] = [
    {
        code: 'ENS_BRAZZA',
        nom: 'ENS Brazzaville',
        nomComplet: 'École Normale Supérieure de Brazzaville',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Congo-Brazzaville',
        emojiPays: '🇨🇬',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    {
        code: 'POLY_BRAZZA',
        nom: 'Polytechnique Brazzaville',
        nomComplet: 'École Nationale Supérieure Polytechnique',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Congo-Brazzaville',
        emojiPays: '🇨🇬',
        matieres: ['Mathématiques', 'Physique', 'Chimie'],
        dureePreparation: '12 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'MED_BRAZZA',
        nom: 'Médecine Brazzaville',
        nomComplet: 'Faculté des Sciences de la Santé - UMNG',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Congo-Brazzaville',
        emojiPays: '🇨🇬',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// 🇲🇬 CONCOURS MADAGASCAR
// ============================================================================

const CONCOURS_MADAGASCAR: ConcoursInfo[] = [
    // ÉCOLES D'INGÉNIEURS
    {
        code: 'ESPA_MG',
        nom: 'ESPA',
        nomComplet: 'École Supérieure Polytechnique d\'Antananarivo',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Madagascar',
        emojiPays: '🇲🇬',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Français'],
        dureePreparation: '12-18 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ENI_MG',
        nom: 'ENI',
        nomComplet: 'École Nationale d\'Informatique',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Madagascar',
        emojiPays: '🇲🇬',
        matieres: ['Mathématiques', 'Informatique', 'Physique', 'Français'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // MÉDECINE
    {
        code: 'FM_MG',
        nom: 'Faculté de Médecine',
        nomComplet: 'Faculté de Médecine d\'Antananarivo',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Madagascar',
        emojiPays: '🇲🇬',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    },
    // COMMERCE
    {
        code: 'ISCAM_MG',
        nom: 'ISCAM',
        nomComplet: 'Institut Supérieur de Commerce et d\'Administration des Entreprises',
        type: 'commerce',
        niveau: 'bac',
        pays: 'Madagascar',
        emojiPays: '🇲🇬',
        matieres: ['Mathématiques', 'Économie', 'Français', 'Anglais'],
        dureePreparation: '6-12 mois',
        difficulte: 'Élevée'
    },
    // ENSEIGNEMENT
    {
        code: 'ENS_TANA',
        nom: 'ENS Antananarivo',
        nomComplet: 'École Normale Supérieure d\'Antananarivo',
        type: 'enseignement',
        niveau: 'bac',
        pays: 'Madagascar',
        emojiPays: '🇲🇬',
        matieres: ['Mathématiques', 'Physique', 'SVT', 'Français', 'Histoire-Géo'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    }
];

// 🇨🇫 CONCOURS CENTRAFRIQUE
// ============================================================================

const CONCOURS_CENTRAFRIQUE: ConcoursInfo[] = [
    // ÉCOLES D'INGÉNIEURS
    {
        code: 'ENSTIC_CF',
        nom: 'ENSTIC',
        nomComplet: 'École Nationale Supérieure des Technologies de l\'Information et de la Communication',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Centrafrique',
        emojiPays: '🇨🇫',
        matieres: ['Mathématiques', 'Physique', 'Informatique', 'Français'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // MÉDECINE
    {
        code: 'FM_CF',
        nom: 'Faculté de Médecine',
        nomComplet: 'Faculté de Médecine de Bangui',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Centrafrique',
        emojiPays: '🇨🇫',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    }
];

// 🇹🇩 CONCOURS TCHAD
// ============================================================================

const CONCOURS_TCHAD: ConcoursInfo[] = [
    // ÉCOLES D'INGÉNIEURS
    {
        code: 'ENSTIC_TD',
        nom: 'ENSTIC',
        nomComplet: 'École Nationale Supérieure des Technologies de l\'Information et de la Communication',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Tchad',
        emojiPays: '🇹🇩',
        matieres: ['Mathématiques', 'Physique', 'Informatique', 'Français'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // MÉDECINE
    {
        code: 'FM_TD',
        nom: 'Faculté de Médecine',
        nomComplet: 'Faculté de Médecine de N\'Djamena',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Tchad',
        emojiPays: '🇹🇩',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    }
];

// 🇳🇪 CONCOURS NIGER
// ============================================================================

const CONCOURS_NIGER: ConcoursInfo[] = [
    // ÉCOLES D'INGÉNIEURS
    {
        code: 'ENSTIC_NE',
        nom: 'ENSTIC',
        nomComplet: 'École Nationale Supérieure des Technologies de l\'Information et de la Communication',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Niger',
        emojiPays: '🇳🇪',
        matieres: ['Mathématiques', 'Physique', 'Informatique', 'Français'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // MÉDECINE
    {
        code: 'FM_NE',
        nom: 'Faculté de Médecine',
        nomComplet: 'Faculté de Médecine de Niamey',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Niger',
        emojiPays: '🇳🇪',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    }
];

// 🇬🇼 CONCOURS GUINÉE-BISSAU
// ============================================================================

const CONCOURS_GUINEE_BISSAU: ConcoursInfo[] = [
    // MÉDECINE
    {
        code: 'FM_GW',
        nom: 'Faculté de Médecine',
        nomComplet: 'Faculté de Médecine de Bissau',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Guinée-Bissau',
        emojiPays: '🇬🇼',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    }
];

// 🇲🇷 CONCOURS MAURITANIE
// ============================================================================

const CONCOURS_MAURITANIE: ConcoursInfo[] = [
    // ÉCOLES D'INGÉNIEURS
    {
        code: 'ENSTIC_MR',
        nom: 'ENSTIC',
        nomComplet: 'École Nationale Supérieure des Technologies de l\'Information et de la Communication',
        type: 'ingenieur',
        niveau: 'bac',
        pays: 'Mauritanie',
        emojiPays: '🇲🇷',
        matieres: ['Mathématiques', 'Physique', 'Informatique', 'Français'],
        dureePreparation: '12 mois',
        difficulte: 'Élevée'
    },
    // MÉDECINE
    {
        code: 'FM_MR',
        nom: 'Faculté de Médecine',
        nomComplet: 'Faculté de Médecine de Nouakchott',
        type: 'medecine',
        niveau: 'bac',
        pays: 'Mauritanie',
        emojiPays: '🇲🇷',
        matieres: ['Biologie', 'Chimie', 'Physique', 'Mathématiques'],
        dureePreparation: '6-12 mois',
        difficulte: 'Très élevée'
    }
];

// ============================================================================
// 🌍 CONCOURS INTERNATIONAUX / PANAFRICAINS
// ============================================================================

const CONCOURS_INTERNATIONAUX: ConcoursInfo[] = [
    {
        code: 'X_PARIS',
        nom: 'Polytechnique Paris',
        nomComplet: 'École Polytechnique Paris (France)',
        type: 'ingenieur',
        niveau: 'bac+2',
        pays: 'France',
        emojiPays: '🇫🇷',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Français', 'Anglais', 'SI (Sciences Industrielles)'],
        dureePreparation: '24-36 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'CENTRALE_PARIS',
        nom: 'Centrale Paris',
        nomComplet: 'CentraleSupélec',
        type: 'ingenieur',
        niveau: 'bac+2',
        pays: 'France',
        emojiPays: '🇫🇷',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'Français', 'Anglais'],
        dureePreparation: '24 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'MINES_PARIS',
        nom: 'Mines ParisTech',
        nomComplet: 'École des Mines de Paris',
        type: 'ingenieur',
        niveau: 'bac+2',
        pays: 'France',
        emojiPays: '🇫🇷',
        matieres: ['Mathématiques', 'Physique', 'Chimie', 'SI'],
        dureePreparation: '24 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'HEC_PARIS',
        nom: 'HEC Paris',
        nomComplet: 'HEC Paris (Hautes Études Commerciales)',
        type: 'commerce',
        niveau: 'bac+2',
        pays: 'France',
        emojiPays: '🇫🇷',
        matieres: ['Mathématiques', 'Culture générale', 'Économie', 'Langues', 'Géopolitique'],
        dureePreparation: '24 mois',
        difficulte: 'Très élevée'
    },
    {
        code: 'ESSEC_PARIS',
        nom: 'ESSEC Paris',
        nomComplet: 'ESSEC Business School',
        type: 'commerce',
        niveau: 'bac+2',
        pays: 'France',
        emojiPays: '🇫🇷',
        matieres: ['Mathématiques', 'Culture générale', 'Économie', 'Langues'],
        dureePreparation: '24 mois',
        difficulte: 'Très élevée'
    },
];

// ============================================================================
// TOUS LES CONCOURS PAR PAYS
// ============================================================================

export const TOUS_LES_CONCOURS: ConcoursInfo[] = [
    ...CONCOURS_CAMEROUN,
    ...CONCOURS_RDC,
    ...CONCOURS_COTE_IVOIRE,
    ...CONCOURS_SENEGAL,
    ...CONCOURS_MALI,
    ...CONCOURS_BURKINA_FASO,
    ...CONCOURS_BENIN,
    ...CONCOURS_TOGO,
    ...CONCOURS_GABON,
    ...CONCOURS_CONGO,
    ...CONCOURS_MADAGASCAR,
    ...CONCOURS_CENTRAFRIQUE,
    ...CONCOURS_TCHAD,
    ...CONCOURS_NIGER,
    ...CONCOURS_GUINEE_BISSAU,
    ...CONCOURS_MAURITANIE,
    ...CONCOURS_INTERNATIONAUX,
];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupère les concours d'un pays avec priorité
 */
export const getConcoursByPays = (codePays: string): ConcoursInfo[] => {
    // Concours du pays
    const concoursPays = TOUS_LES_CONCOURS.filter(c => c.pays === codePays || c.emojiPays.includes(codePays));

    // Concours internationaux (toujours accessibles)
    const concoursInternationaux = CONCOURS_INTERNATIONAUX;

    return [...concoursPays, ...concoursInternationaux];
};

/**
 * Récupère les concours par type (ingénieur, médecine, commerce...)
 */
export const getConcoursByType = (type: string): ConcoursInfo[] => {
    return TOUS_LES_CONCOURS.filter(c => c.type === type);
};

/**
 * Génère la liste des concours pour un pays avec organisation
 */
export const genererListeConcours = (codePays: string = 'CM'): string[] => {
    const concours: string[] = [];

    // ════════════════════════════════════════════════════════════
    // 🎯 CONCOURS DU PAYS (PRIORITÉ)
    // ════════════════════════════════════════════════════════════
    const concoursPays = TOUS_LES_CONCOURS.filter(c =>
        c.emojiPays.includes(codePays) ||
        (codePays === 'CM' && c.pays === 'Cameroun') ||
        (codePays === 'CD' && c.pays === 'RDC') ||
        (codePays === 'CI' && c.pays === 'Côte d\'Ivoire') ||
        (codePays === 'SN' && c.pays === 'Sénégal') ||
        (codePays === 'ML' && c.pays === 'Mali') ||
        (codePays === 'BF' && c.pays === 'Burkina Faso') ||
        (codePays === 'BJ' && c.pays === 'Bénin') ||
        (codePays === 'TG' && c.pays === 'Togo') ||
        (codePays === 'GA' && c.pays === 'Gabon') ||
        (codePays === 'CG' && c.pays === 'Congo-Brazzaville')
    );

    if (concoursPays.length > 0) {
        concours.push(`─── ${concoursPays[0].emojiPays} CONCOURS NATIONAUX ───`);

        // Grouper par type
        const parType = {
            ingenieur: concoursPays.filter(c => c.type === 'ingenieur'),
            medecine: concoursPays.filter(c => c.type === 'medecine'),
            enseignement: concoursPays.filter(c => c.type === 'enseignement'),
            administration: concoursPays.filter(c => c.type === 'administration'),
            commerce: concoursPays.filter(c => c.type === 'commerce'),
        };

        if (parType.ingenieur.length > 0) {
            concours.push('─── 🔧 Écoles d\'Ingénieurs ───');
            parType.ingenieur.forEach(c => concours.push(`${c.emojiPays} ${c.nom} - ${c.nomComplet}`));
        }

        if (parType.medecine.length > 0) {
            concours.push('─── 🩺 Médecine & Santé ───');
            parType.medecine.forEach(c => concours.push(`${c.emojiPays} ${c.nom} - ${c.nomComplet}`));
        }

        if (parType.enseignement.length > 0) {
            concours.push('─── 🎓 Écoles Normales (Enseignement) ───');
            parType.enseignement.forEach(c => concours.push(`${c.emojiPays} ${c.nom} - ${c.nomComplet}`));
        }

        if (parType.administration.length > 0) {
            concours.push('─── 🏛️ Administration & Magistrature ───');
            parType.administration.forEach(c => concours.push(`${c.emojiPays} ${c.nom} - ${c.nomComplet}`));
        }

        if (parType.commerce.length > 0) {
            concours.push('─── 💼 Commerce & Gestion ───');
            parType.commerce.forEach(c => concours.push(`${c.emojiPays} ${c.nom} - ${c.nomComplet}`));
        }
    }

    // ════════════════════════════════════════════════════════════
    // 🌍 CONCOURS INTERNATIONAUX (France, Canada...)
    // ════════════════════════════════════════════════════════════
    concours.push('──────────────────────────');
    concours.push('─── 🇫🇷 GRANDES ÉCOLES FRANÇAISES ───');

    CONCOURS_INTERNATIONAUX.forEach(c => {
        concours.push(`${c.emojiPays} ${c.nom} - ${c.nomComplet}`);
    });

    // ════════════════════════════════════════════════════════════
    // OPTIONS SPÉCIALES
    // ════════════════════════════════════════════════════════════
    concours.push('──────────────────────────');
    concours.push('🎯 Préparation concours généraux (toutes écoles)');
    concours.push('📚 Méthodologie concours (toutes filières)');
    concours.push('🆕 Autre concours (préciser)');

    return concours;
};

/**
 * Génère la liste des matières pour préparation concours selon le type et le pays
 */
export const genererMatieresPreparationConcours = (codePays: string = 'CM', typeConcours?: string): string[] => {
    const matieres: string[] = [];

    // ════════════════════════════════════════════════════════════
    // MATIÈRES SCIENTIFIQUES (Ingénieurs, Médecine, Polytechniques)
    // ════════════════════════════════════════════════════════════
    matieres.push('─── 🔬 MATIÈRES SCIENTIFIQUES ───');
    matieres.push('Mathématiques (algèbre, analyse, géométrie)');
    matieres.push('Mathématiques supérieures (prépa)');
    matieres.push('Physique (mécanique, thermodynamique, électricité)');
    matieres.push('Physique avancée (optique, quantique)');
    matieres.push('Chimie (organique, minérale, analytique)');
    matieres.push('Chimie avancée (thermochimie, cinétique)');
    matieres.push('Biologie / SVT');
    matieres.push('Sciences de l\'Ingénieur (SI)');
    matieres.push('Informatique & Algorithmique');

    // ════════════════════════════════════════════════════════════
    // MATIÈRES LITTÉRAIRES & LANGUES
    // ════════════════════════════════════════════════════════════
    matieres.push('─── 📖 MATIÈRES LITTÉRAIRES ───');
    matieres.push('Français (dissertation, résumé, synthèse)');
    matieres.push('Français avancé (commentaire, analyse)');
    matieres.push('Anglais (grammaire, vocabulaire, compréhension)');
    matieres.push('Anglais avancé (TOEFL, IELTS)');
    matieres.push('Culture générale');
    matieres.push('Philosophie');
    matieres.push('Littérature');

    // ════════════════════════════════════════════════════════════
    // SCIENCES HUMAINES & SOCIALES
    // ════════════════════════════════════════════════════════════
    matieres.push('─── 🌍 SCIENCES HUMAINES ───');
    matieres.push('Histoire-Géographie');
    matieres.push('Sciences politiques');
    matieres.push('Géopolitique');
    matieres.push('Droit constitutionnel');
    matieres.push('Droit administratif');
    matieres.push('Économie');
    matieres.push('Économie approfondie (micro, macro)');

    // ════════════════════════════════════════════════════════════
    // MATIÈRES SPÉCIALISÉES CONCOURS
    // ════════════════════════════════════════════════════════════
    matieres.push('─── 🎯 PRÉPARATION SPÉCIALISÉE ───');
    matieres.push('Tests psychotechniques');
    matieres.push('Tests de logique & raisonnement');
    matieres.push('QCM (Questions à Choix Multiples)');
    matieres.push('Dissertation & synthèse');
    matieres.push('Épreuves orales (entretien, exposé)');
    matieres.push('Méthodologie des concours');
    matieres.push('Gestion du stress & timing');
    matieres.push('Annales & sujets types');

    // ════════════════════════════════════════════════════════════
    // OPTIONS SPÉCIALES
    // ════════════════════════════════════════════════════════════
    matieres.push('──────────────────────────');
    matieres.push('📚 Préparation complète (toutes matières)');
    matieres.push('🎯 Méthodologie générale concours');
    matieres.push('🆕 Autre matière (préciser)');

    return matieres;
};

/**
 * Récupère les matières d'un concours spécifique
 */
export const getMatieresConcours = (codeConcours: string): string[] => {
    const concours = TOUS_LES_CONCOURS.find(c => c.code === codeConcours);
    return concours?.matieres || [];
};

/**
 * Récupère tous les types de concours disponibles
 */
export const getTypesConcours = (): string[] => {
    return [
        '🔧 Écoles d\'Ingénieurs (Polytechnique, Mines, etc.)',
        '🩺 Médecine, Pharmacie & Santé',
        '🎓 Écoles Normales Supérieures (ENS - Enseignement)',
        '🏛️ Écoles d\'Administration (ENA, ENAM, Magistrature)',
        '💼 Écoles de Commerce (HEC, ESSEC, etc.)',
        '⚖️ Concours de la Magistrature',
        '👮 Concours Police & Gendarmerie',
        '🌾 Écoles d\'Agronomie & Vétérinaire',
        '🎨 Écoles d\'Arts & Architecture',
        '📰 Écoles de Journalisme & Communication',
        '✈️ Aviation & Aéronautique',
        '⚓ Marine & Naval',
        '🌍 Concours internationaux (France, Canada, Belgique)',
        '🆕 Autre type de concours'
    ];
};

/**
 * Génère la liste des niveaux de préparation
 */
export const getNiveauxPreparationConcours = (): string[] => {
    return [
        '─── 📚 NIVEAU BAC (après Terminale) ───',
        'Préparation intensive (3-6 mois)',
        'Préparation longue (12 mois)',
        'Préparation très longue (18-24 mois)',

        '─── 🎓 NIVEAU BAC+2 (Classes Prépa) ───',
        'Prépa Maths Sup / Maths Spé (MPSI, PCSI)',
        'Prépa Commerciales (ECE, ECS)',
        'Prépa Littéraires (Khâgne, Hypokhâgne)',
        'Prépa Biologie (BCPST)',

        '─── 🏆 NIVEAU BAC+3/+5 ───',
        'Préparation Master / Doctorat',
        'Préparation concours professionnels',

        '─── ⏱️ FORMAT ───',
        'Stage intensif vacances (1-2 semaines)',
        'Cours hebdomadaires (toute l\'année)',
        'Cours particuliers sur mesure',
        'Formation en ligne / à distance',

        '🆕 Autre format'
    ];
};

/**
 * Récupère les concours d'un type spécifique
 */
export const getConcoursParDomaine = (): DomaineConcoursInfo[] => {
    return [
        {
            domaine: 'Écoles d\'Ingénieurs',
            icon: '🔧',
            concours: TOUS_LES_CONCOURS.filter(c => c.type === 'ingenieur')
        },
        {
            domaine: 'Médecine & Santé',
            icon: '🩺',
            concours: TOUS_LES_CONCOURS.filter(c => c.type === 'medecine')
        },
        {
            domaine: 'Écoles Normales (Enseignement)',
            icon: '🎓',
            concours: TOUS_LES_CONCOURS.filter(c => c.type === 'enseignement')
        },
        {
            domaine: 'Administration & ENA',
            icon: '🏛️',
            concours: TOUS_LES_CONCOURS.filter(c => c.type === 'administration')
        },
        {
            domaine: 'Commerce & Gestion',
            icon: '💼',
            concours: TOUS_LES_CONCOURS.filter(c => c.type === 'commerce')
        },
    ];
};

/**
 * Recherche de concours par nom
 */
export const rechercherConcours = (recherche: string): ConcoursInfo[] => {
    const rechercheNormalisee = recherche.toLowerCase().trim();

    return TOUS_LES_CONCOURS.filter(c =>
        c.nom.toLowerCase().includes(rechercheNormalisee) ||
        c.nomComplet.toLowerCase().includes(rechercheNormalisee) ||
        c.pays.toLowerCase().includes(rechercheNormalisee)
    );
};

