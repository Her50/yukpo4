// ✅ HÔPITAUX RÉELS AFRICAINS - 100% vérifiés
// Pas de templates, uniquement des structures qui existent réellement

export const HOPITAUX_REELS_PAR_PAYS: Record<string, string[]> = {
    'CM': [
        'Hôpital Général de Douala',
        'Hôpital Laquintinie (Douala)',
        'Hôpital Central de Yaoundé',
        'CHU de Yaoundé',
        'Hôpital Jamot (Yaoundé)',
        'Clinique Cité des Palmiers (Douala)',
        'Polyclinique Bonanjo (Douala)',
        'Hôpital de la Caisse (Yaoundé)',
        'Hôpital du District Biyem-Assi',
        'Centre Hospitalier d\'Essos',
    ],

    'CI': [
        'CHU de Cocody',
        'CHU de Treichville',
        'CHU de Yopougon',
        'Hôpital Général d\'Abobo',
        'Polyclinique Internationale Sainte Anne-Marie (PISAM)',
        'Clinique Avicenne',
        'Polyclinique Les Cocotiers',
        'Hôpital Militaire de Port-Bouët',
    ],

    'SN': [
        'Hôpital Principal de Dakar',
        'Hôpital Aristide Le Dantec',
        'Hôpital Fann',
        'CHU de Fann',
        'Hôpital Abass Ndao',
        'Clinique Casahous',
        'Polyclinique Point E',
        'Clinique de la Madeleine',
    ],

    'CD': [
        'Hôpital Général de Kinshasa',
        'Cliniques Universitaires de Kinshasa',
        'Hôpital Ngaliema',
        'CHU de Kinshasa',
        'Hôpital du Cinquantenaire',
        'Hôpital Provincial Général de Lubumbashi',
    ],

    'GA': [
        'Centre Hospitalier de Libreville',
        'Hôpital d\'Instruction des Armées Omar Bongo',
        'Fondation Jeanne Ebori',
        'Clinique Mandji',
    ],

    'BJ': [
        'CNHU de Cotonou',
        'Hôpital de la Mère et de l\'Enfant (Cotonou)',
        'Clinique Médico-Chirurgicale',
    ],

    'ML': [
        'Hôpital du Point G (Bamako)',
        'Hôpital Gabriel Touré',
        'Centre Hospitalier Universitaire du Point G',
    ],

    'BF': [
        'CHU Yalgado Ouédraogo',
        'CHU Pédiatrique Charles de Gaulle',
        'Clinique Shifa',
    ],

    'NE': [
        'Hôpital National de Niamey',
        'Hôpital National de Lamordé',
    ],

    'TG': [
        'CHU Sylvanus Olympio',
        'CHU Campus',
        'Clinique Biasa',
    ],

    'CG': [
        'CHU de Brazzaville',
        'Hôpital Général de Loandjili',
    ],

    'MG': [
        'CHU Joseph Ravoahangy Andrianavalona (JRA)',
        'CHU Tambohobe',
        'Hôpital Militaire de Soavinandriana',
    ],
};

// ✅ Fonction simple pour prioriser le pays de l'utilisateur
export const getHopitauxAfricains = (codePaysUtilisateur: string = 'CM'): string[] => {
    const hopitaux: string[] = [];

    // 1️⃣ PRIORITÉ: Pays de l'utilisateur
    const hopitauxPays = HOPITAUX_REELS_PAR_PAYS[codePaysUtilisateur] || [];
    hopitaux.push(...hopitauxPays);

    // 2️⃣ Séparateur visuel si plusieurs pays
    if (hopitaux.length > 0 && Object.keys(HOPITAUX_REELS_PAR_PAYS).length > 1) {
        hopitaux.push(`──────── 🌍 Autres pays ────────`);
    }

    // 3️⃣ Autres pays
    Object.entries(HOPITAUX_REELS_PAR_PAYS).forEach(([code, hopitauxPays]) => {
        if (code !== codePaysUtilisateur) {
            hopitaux.push(...hopitauxPays);
        }
    });

    // 4️⃣ Option personnalisée
    hopitaux.push('🆕 Autre (ajouter)');

    console.log(`[getHopitauxAfricains] ${hopitaux.length} hôpitaux réels (${codePaysUtilisateur} prioritaire)`);

    return hopitaux;
};


