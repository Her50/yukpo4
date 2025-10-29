/**
 * 🌍 NOMS LOCAUX DES VÉHICULES EN AFRIQUE FRANCOPHONE
 * 
 * Ce fichier contient un mapping intelligent entre les noms populaires/locaux
 * utilisés dans chaque pays francophone et les véhicules réels.
 * 
 * Exemples :
 * - "Tête de cochon" (Cameroun) → Renault 4
 * - "504 bâchée" (Afrique) → Peugeot 504 Pick-up
 * - "Bendskin" (Cameroun) → Moto-taxi
 */

export interface VehicleLocalName {
    nomLocal: string; // Nom populaire (ex: "tête de cochon")
    nomOfficiel: string; // Nom réel (ex: "Renault 4")
    marque?: string; // Marque (ex: "Renault")
    modele?: string; // Modèle (ex: "4" ou "R4")
    type?: string; // Type (ex: "Voiture", "Moto", "Minibus")
    pays: string[]; // Pays où ce nom est utilisé
    description?: string; // Description courte
    synonymes?: string[]; // Autres noms possibles
}

// ════════════════════════════════════════════════════════════
// 🇨🇲 CAMEROUN - NOMS LOCAUX
// ════════════════════════════════════════════════════════════
export const VEHICLE_NAMES_CAMEROUN: VehicleLocalName[] = [
    {
        nomLocal: 'tête de cochon',
        nomOfficiel: 'Toyota Avensis',
        marque: 'Toyota',
        modele: 'Avensis',
        type: 'Voiture',
        pays: ['Cameroun'],
        description: 'Toyota Avensis (génération 2003-2018) - Arrière bombé caractéristique rappelant une tête de cochon, voiture bien stable',
        synonymes: ['tete de cochon', 'tête cochon', 'avensis', 'toyota bombée']
    },
    {
        nomLocal: '504 bâchée',
        nomOfficiel: 'Peugeot 504 Pick-up',
        marque: 'Peugeot',
        modele: '504',
        type: 'Pick-up',
        pays: ['Cameroun', 'Côte d\'Ivoire', 'Sénégal', 'Mali', 'Bénin', 'Togo'],
        description: 'Peugeot 504 Pick-up avec bâche - Transport populaire',
        synonymes: ['504 bachee', 'bâchée', 'bachee', '504 pickup']
    },
    {
        nomLocal: 'bendskin',
        nomOfficiel: 'Moto-taxi',
        type: 'Moto',
        pays: ['Cameroun'],
        description: 'Moto-taxi très populaire au Cameroun',
        synonymes: ['bend skin', 'moto taxi', 'mototaxi']
    },
    {
        nomLocal: 'clandos',
        nomOfficiel: 'Taxi clandestin',
        type: 'Voiture',
        pays: ['Cameroun', 'Gabon', 'Congo'],
        description: 'Taxi clandestin non officiel',
        synonymes: ['clando', 'taxi clando']
    },
    {
        nomLocal: 'hiace',
        nomOfficiel: 'Toyota HiAce',
        marque: 'Toyota',
        modele: 'HiAce',
        type: 'Minibus',
        pays: ['Cameroun', 'Côte d\'Ivoire', 'Sénégal', 'Gabon'],
        description: 'Toyota HiAce - Minibus de transport populaire',
        synonymes: ['hi-ace', 'hiace bus']
    }
];

// ════════════════════════════════════════════════════════════
// 🇨🇮 CÔTE D'IVOIRE - NOMS LOCAUX
// ════════════════════════════════════════════════════════════
export const VEHICLE_NAMES_COTE_IVOIRE: VehicleLocalName[] = [
    {
        nomLocal: 'gbaka',
        nomOfficiel: 'Minibus de transport',
        type: 'Minibus',
        pays: ['Côte d\'Ivoire'],
        description: 'Minibus de transport en commun à Abidjan',
        synonymes: ['gbakas']
    },
    {
        nomLocal: 'wôrô-wôrô',
        nomOfficiel: 'Taxi collectif',
        type: 'Voiture',
        pays: ['Côte d\'Ivoire'],
        description: 'Taxi collectif (souvent Peugeot 504 ou vieilles voitures)',
        synonymes: ['woro woro', 'woro-woro', 'wôrô wôrô', 'taxi collectif']
    },
    {
        nomLocal: 'bâchée',
        nomOfficiel: 'Peugeot 504 Pick-up',
        marque: 'Peugeot',
        modele: '504',
        type: 'Pick-up',
        pays: ['Côte d\'Ivoire', 'Cameroun', 'Sénégal'],
        description: 'Peugeot 504 Pick-up avec bâche',
        synonymes: ['bachee', '504 bâchée', '504 bachee']
    },
    {
        nomLocal: 'pinasse',
        nomOfficiel: 'Pirogue motorisée',
        type: 'Bateau',
        pays: ['Côte d\'Ivoire', 'Sénégal', 'Mali'],
        description: 'Pirogue avec moteur pour transport fluvial',
        synonymes: ['pirogue motorisée']
    }
];

// ════════════════════════════════════════════════════════════
// 🇸🇳 SÉNÉGAL - NOMS LOCAUX
// ════════════════════════════════════════════════════════════
export const VEHICLE_NAMES_SENEGAL: VehicleLocalName[] = [
    {
        nomLocal: 'car rapide',
        nomOfficiel: 'Bus coloré de Dakar',
        type: 'Bus',
        pays: ['Sénégal'],
        description: 'Bus artisanaux colorés emblématiques de Dakar',
        synonymes: ['cars rapides']
    },
    {
        nomLocal: 'ndiaga ndiaye',
        nomOfficiel: 'Grand bus de transport',
        type: 'Bus',
        pays: ['Sénégal'],
        description: 'Grand bus de transport en commun',
        synonymes: ['ndiaga-ndiaye']
    },
    {
        nomLocal: 'sept-places',
        nomOfficiel: 'Taxi collectif break',
        type: 'Break',
        pays: ['Sénégal', 'Mali', 'Mauritanie'],
        description: 'Taxi collectif (souvent Peugeot 504 ou 505 break)',
        synonymes: ['7 places', 'sept places', 'taxi brousse']
    },
    {
        nomLocal: 'jakarta',
        nomOfficiel: 'Moto-taxi',
        type: 'Moto',
        pays: ['Sénégal'],
        description: 'Moto-taxi à Dakar et dans les villes',
        synonymes: ['jakarta moto']
    },
    {
        nomLocal: 'clandos',
        nomOfficiel: 'Taxi clandestin',
        type: 'Voiture',
        pays: ['Sénégal', 'Cameroun'],
        description: 'Taxi clandestin non officiel',
        synonymes: ['clando']
    }
];

// ════════════════════════════════════════════════════════════
// 🇨🇩 CONGO RDC/RC - NOMS LOCAUX
// ════════════════════════════════════════════════════════════
export const VEHICLE_NAMES_CONGO: VehicleLocalName[] = [
    {
        nomLocal: 'fula-fula',
        nomOfficiel: 'Minibus de transport',
        type: 'Minibus',
        pays: ['Congo RDC', 'Congo RC'],
        description: 'Minibus de transport populaire à Kinshasa/Brazzaville',
        synonymes: ['fula fula', 'fullah-fullah']
    },
    {
        nomLocal: 'esprit de mort',
        nomOfficiel: 'Moto-taxi dangereuse',
        type: 'Moto',
        pays: ['Congo RDC', 'Congo RC'],
        description: 'Moto-taxi réputée dangereuse (conduite rapide)',
        synonymes: ['esprit-de-mort', 'moto dangereuse']
    },
    {
        nomLocal: '100kg',
        nomOfficiel: 'Moto de livraison',
        type: 'Moto',
        pays: ['Congo RDC', 'Congo RC'],
        description: 'Moto utilitaire pour transport de marchandises',
        synonymes: ['100 kg', 'cent kilo', 'moto livraison']
    },
    {
        nomLocal: 'taxi-bus',
        nomOfficiel: 'Minibus collectif',
        type: 'Minibus',
        pays: ['Congo RDC', 'Congo RC'],
        description: 'Minibus servant de taxi collectif',
        synonymes: ['taxi bus', 'bus taxi']
    }
];

// ════════════════════════════════════════════════════════════
// 🇧🇯🇹🇬 BÉNIN/TOGO - NOMS LOCAUX
// ════════════════════════════════════════════════════════════
export const VEHICLE_NAMES_BENIN_TOGO: VehicleLocalName[] = [
    {
        nomLocal: 'zémidjan',
        nomOfficiel: 'Moto-taxi',
        type: 'Moto',
        pays: ['Bénin', 'Togo'],
        description: 'Moto-taxi très populaire au Bénin et Togo',
        synonymes: ['zemidjan', 'zem']
    },
    {
        nomLocal: 'oléya',
        nomOfficiel: 'Taxi-moto',
        type: 'Moto',
        pays: ['Bénin'],
        description: 'Taxi-moto au Bénin',
        synonymes: ['oleya']
    },
    {
        nomLocal: 'taxi-brousse',
        nomOfficiel: 'Minibus interurbain',
        type: 'Minibus',
        pays: ['Bénin', 'Togo', 'Burkina Faso'],
        description: 'Minibus pour trajets interurbains',
        synonymes: ['taxi brousse']
    }
];

// ════════════════════════════════════════════════════════════
// 🇲🇱 MALI - NOMS LOCAUX
// ════════════════════════════════════════════════════════════
export const VEHICLE_NAMES_MALI: VehicleLocalName[] = [
    {
        nomLocal: 'sotrama',
        nomOfficiel: 'Minibus de transport',
        type: 'Minibus',
        pays: ['Mali'],
        description: 'Minibus de transport en commun à Bamako (SOTRAMA)',
        synonymes: ['sotrama bus']
    },
    {
        nomLocal: 'bâchée',
        nomOfficiel: 'Peugeot 504 Pick-up',
        marque: 'Peugeot',
        modele: '504',
        type: 'Pick-up',
        pays: ['Mali', 'Burkina Faso', 'Niger'],
        description: 'Peugeot 504 Pick-up avec bâche - Transport populaire',
        synonymes: ['bachee', '504 bâchée']
    },
    {
        nomLocal: 'djan-djan',
        nomOfficiel: 'Moto-taxi',
        type: 'Moto',
        pays: ['Mali'],
        description: 'Moto-taxi au Mali',
        synonymes: ['djan djan', 'djandjan']
    }
];

// ════════════════════════════════════════════════════════════
// 🇬🇦 GABON - NOMS LOCAUX
// ════════════════════════════════════════════════════════════
export const VEHICLE_NAMES_GABON: VehicleLocalName[] = [
    {
        nomLocal: 'clandos',
        nomOfficiel: 'Taxi clandestin',
        type: 'Voiture',
        pays: ['Gabon', 'Cameroun', 'Congo'],
        description: 'Taxi clandestin (souvent Toyota ou Nissan)',
        synonymes: ['clando', 'taxi clando']
    },
    {
        nomLocal: 'taxi-brousse',
        nomOfficiel: 'Minibus interurbain',
        type: 'Minibus',
        pays: ['Gabon', 'Congo', 'Cameroun'],
        description: 'Minibus pour trajets entre villes',
        synonymes: ['taxi brousse']
    }
];

// ════════════════════════════════════════════════════════════
// 🌍 BASE DE DONNÉES COMPLÈTE (Tous les pays)
// ════════════════════════════════════════════════════════════
export const ALL_VEHICLE_LOCAL_NAMES: VehicleLocalName[] = [
    ...VEHICLE_NAMES_CAMEROUN,
    ...VEHICLE_NAMES_COTE_IVOIRE,
    ...VEHICLE_NAMES_SENEGAL,
    ...VEHICLE_NAMES_CONGO,
    ...VEHICLE_NAMES_BENIN_TOGO,
    ...VEHICLE_NAMES_MALI,
    ...VEHICLE_NAMES_GABON
];

// ════════════════════════════════════════════════════════════
// 🔍 FONCTION DE RECHERCHE INTELLIGENTE
// ════════════════════════════════════════════════════════════

/**
 * Normalise un texte pour la recherche (minuscules, sans accents, sans tirets)
 */
function normalizeForSearch(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
        .replace(/[-_]/g, ' ') // Remplace tirets par espaces
        .trim();
}

/**
 * Trouve un véhicule à partir d'un nom local
 * @param searchTerm Le terme recherché (ex: "tête de cochon", "bendskin")
 * @param userCountry Le pays de l'utilisateur (ex: "Cameroun") - optionnel
 * @returns Les véhicules correspondants avec score de pertinence
 */
export function findVehicleByLocalName(
    searchTerm: string,
    userCountry?: string
): Array<VehicleLocalName & { score: number }> {
    const normalizedSearch = normalizeForSearch(searchTerm);
    const results: Array<VehicleLocalName & { score: number }> = [];

    for (const vehicle of ALL_VEHICLE_LOCAL_NAMES) {
        let score = 0;

        // Vérifier le nom local
        if (normalizeForSearch(vehicle.nomLocal).includes(normalizedSearch)) {
            score += 100;
        }

        // Vérifier les synonymes
        if (vehicle.synonymes) {
            for (const synonyme of vehicle.synonymes) {
                if (normalizeForSearch(synonyme).includes(normalizedSearch)) {
                    score += 80;
                    break;
                }
            }
        }

        // Vérifier le nom officiel
        if (normalizeForSearch(vehicle.nomOfficiel).includes(normalizedSearch)) {
            score += 60;
        }

        // Bonus si le pays de l'utilisateur correspond
        if (userCountry && vehicle.pays.includes(userCountry)) {
            score += 20;
        }

        // Si un score a été trouvé, ajouter aux résultats
        if (score > 0) {
            results.push({ ...vehicle, score });
        }
    }

    // Trier par score décroissant
    return results.sort((a, b) => b.score - a.score);
}

/**
 * Extrait les filtres à appliquer pour un nom local
 * @param searchTerm Le terme recherché
 * @param userCountry Le pays de l'utilisateur
 * @returns Les filtres à appliquer (marque, modèle, type)
 */
export function getFiltersFromLocalName(
    searchTerm: string,
    userCountry?: string
): {
    marque?: string;
    modele?: string;
    type?: string;
    description?: string;
} {
    const results = findVehicleByLocalName(searchTerm, userCountry);

    if (results.length === 0) {
        return {};
    }

    // Prendre le premier résultat (meilleur score)
    const bestMatch = results[0];

    return {
        marque: bestMatch.marque,
        modele: bestMatch.modele,
        type: bestMatch.type,
        description: bestMatch.description
    };
}

/**
 * Obtient tous les mots-clés de recherche pour les véhicules
 * (pour alimenter le système de recherche)
 */
export function getAllVehicleSearchKeywords(): string[] {
    const keywords = new Set<string>();

    for (const vehicle of ALL_VEHICLE_LOCAL_NAMES) {
        keywords.add(vehicle.nomLocal);
        keywords.add(vehicle.nomOfficiel);

        if (vehicle.synonymes) {
            vehicle.synonymes.forEach(s => keywords.add(s));
        }
    }

    return Array.from(keywords);
}

