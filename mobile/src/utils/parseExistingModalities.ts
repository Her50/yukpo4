/**
 * \uD83D\uDD27 OUTIL DE PARSING AUTOMATIQUE DE VOTRE BASE EXISTANTE
 * 
 * Ce fichier analyse votre productModalities.ts existant et génère
 * automatiquement les mappings marque → modèles sans refaire tout manuellement !
 */

import {
    AUTOMOBILE_MODALITIES,
    TELEPHONES_MODALITIES
} from '../data/productModalities';

/**
 * Parser automatiquement les modèles par marque depuis une liste plate
 */
export function parseModelesParMarque(
    modeles: string[],
    marques: string[],
    category: 'telephone' | 'automobile' | 'ordinateur' | 'electromenager'
): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    // Initialiser avec toutes les marques
    marques.forEach(marque => {
        if (!marque.includes('\uD83C\uDD95')) {
            result[marque] = [];
        }
    });

    // Parser chaque modèle
    modeles.forEach(modele => {
        if (modele.includes('\uD83C\uDD95')) return; // Ignorer l'option "Autre"

        const marque = extraireMarque(modele, marques, category);
        if (marque && result[marque]) {
            result[marque].push(modele);
        } else {
            console.warn(`[Parser] Marque non trouvée pour: ${modele}`);
        }
    });

    return result;
}

/**
 * Extraire la marque d'un nom de modèle complet
 */
function extraireMarque(
    nomComplet: string,
    marquesConnues: string[],
    category: string
): string | null {
    const normalized = nomComplet.toLowerCase();

    // Règles spécifiques par catégorie
    if (category === 'telephone') {
        // Règles spéciales pour téléphones
        if (normalized.startsWith('iphone')) return 'Apple';
        if (normalized.includes('galaxy')) return 'Samsung';
        if (normalized.startsWith('tecno')) return 'Tecno';
        if (normalized.startsWith('infinix')) return 'Infinix';
        if (normalized.startsWith('redmi')) return 'Xiaomi';
        if (normalized.startsWith('poco')) return 'Xiaomi';
        if (normalized.startsWith('realme')) return 'Realme';
        if (normalized.startsWith('oppo')) return 'Oppo';
        if (normalized.startsWith('vivo')) return 'Vivo';
        if (normalized.startsWith('itel')) return 'Itel';
        if (normalized.startsWith('xiaomi')) return 'Xiaomi';
        if (normalized.startsWith('huawei')) return 'Huawei';
        if (normalized.startsWith('honor')) return 'Honor';
        if (normalized.startsWith('nokia')) return 'Nokia';
    }

    if (category === 'automobile') {
        // Règles spéciales pour automobiles
        if (normalized.startsWith('toyota')) return 'Toyota';
        if (normalized.startsWith('mercedes')) return 'Mercedes-Benz';
        if (normalized.startsWith('nissan')) return 'Nissan';
        if (normalized.startsWith('honda')) return 'Honda';
        if (normalized.startsWith('peugeot')) return 'Peugeot';
        if (normalized.startsWith('renault')) return 'Renault';
        if (normalized.startsWith('hyundai')) return 'Hyundai';
        if (normalized.startsWith('kia')) return 'Kia';
        if (normalized.startsWith('vw') || normalized.startsWith('volkswagen')) return 'Volkswagen';
        if (normalized.startsWith('ford')) return 'Ford';
    }

    // Règle générique : Chercher si le modèle commence par une marque connue
    for (const marque of marquesConnues) {
        if (marque.includes('\uD83C\uDD95')) continue;

        const marqueNormalized = marque.toLowerCase();
        if (normalized.startsWith(marqueNormalized)) {
            return marque;
        }

        // Variantes (ex: "Mercedes-Benz" vs "Mercedes")
        const marqueSimple = marqueNormalized.split('-')[0].split(' ')[0];
        if (normalized.startsWith(marqueSimple)) {
            return marque;
        }
    }

    return null;
}

/**
 * \uD83C\uDFAF GÉNÉRATION AUTOMATIQUE DES MAPPINGS
 * À exécuter une fois pour créer les mappings depuis votre base existante
 */
export function genererMappingsAutomatiques() {
    console.log('═══════════════════════════════════════════════════');
    console.log('\uD83D\uDE80 GÉNÉRATION AUTOMATIQUE DES MAPPINGS');
    console.log('═══════════════════════════════════════════════════');

    // TÉLÉPHONES
    console.log('\n\uD83D\uDCF1 TÉLÉPHONES :');
    const telephonesMapping = parseModelesParMarque(
        TELEPHONES_MODALITIES.modeles_populaires || [],
        TELEPHONES_MODALITIES.marques || [],
        'telephone'
    );

    Object.entries(telephonesMapping).forEach(([marque, modeles]) => {
        if (modeles.length > 0) {
            console.log(`  ${marque}: ${modeles.length} modèles`);
        }
    });

    // AUTOMOBILES
    console.log('\n\uD83D\uDE97 AUTOMOBILES :');
    const automobilesMapping = parseModelesParMarque(
        AUTOMOBILE_MODALITIES.modeles_populaires || [],
        AUTOMOBILE_MODALITIES.marques || [],
        'automobile'
    );

    Object.entries(automobilesMapping).forEach(([marque, modeles]) => {
        if (modeles.length > 0) {
            console.log(`  ${marque}: ${modeles.length} modèles`);
        }
    });

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ MAPPINGS GÉNÉRÉS AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════');

    return {
        telephone: telephonesMapping,
        automobile: automobilesMapping
    };
}

/**
 * \uD83C\uDFAF MAPPING GÉNÉRÉ AUTOMATIQUEMENT
 * (À utiliser dans intelligentProductAutocomplete.ts)
 */
export const MODELES_PAR_MARQUE_AUTO = genererMappingsAutomatiques();

/**
 * \uD83D\uDCCA STATISTIQUES SUR VOTRE BASE
 */
export function analyserBaseExistante() {
    console.log('\n\uD83D\uDCCA ANALYSE DE VOTRE BASE EXISTANTE :');
    console.log('═══════════════════════════════════════════════════');

    // Téléphones
    const nbMarquesTel = (TELEPHONES_MODALITIES.marques || []).filter(m => !m.includes('\uD83C\uDD95')).length;
    const nbModelesTel = (TELEPHONES_MODALITIES.modeles_populaires || []).filter(m => !m.includes('\uD83C\uDD95')).length;
    const nbChampsTel = Object.keys(TELEPHONES_MODALITIES).length;

    console.log(`\n\uD83D\uDCF1 TÉLÉPHONES :`);
    console.log(`  • ${nbMarquesTel} marques`);
    console.log(`  • ${nbModelesTel} modèles populaires`);
    console.log(`  • ${nbChampsTel} types de caractéristiques`);

    // Automobiles
    const nbMarquesAuto = (AUTOMOBILE_MODALITIES.marques || []).filter(m => !m.includes('\uD83C\uDD95')).length;
    const nbModelesAuto = (AUTOMOBILE_MODALITIES.modeles_populaires || [])?.filter(m => !m.includes('\uD83C\uDD95')).length || 0;
    const nbChampsAuto = Object.keys(AUTOMOBILE_MODALITIES).length;

    console.log(`\n\uD83D\uDE97 AUTOMOBILES :`);
    console.log(`  • ${nbMarquesAuto} marques`);
    console.log(`  • ${nbModelesAuto} modèles populaires`);
    console.log(`  • ${nbChampsAuto} types de caractéristiques`);

    // Total estimé
    const totalOptions = nbModelesTel + nbModelesAuto +
        (TELEPHONES_MODALITIES.stockage?.length || 0) +
        (TELEPHONES_MODALITIES.couleurs?.length || 0) +
        (AUTOMOBILE_MODALITIES.couleurs?.length || 0);

    console.log(`\n\uD83D\uDCC8 TOTAL ESTIMÉ :`);
    console.log(`  • ${totalOptions}+ options de modalités`);
    console.log(`  • 48+ catégories couvertes`);
    console.log(`  • ~20 pays d'Afrique francophone`);

    console.log('\n═══════════════════════════════════════════════════');

    return {
        telephones: { marques: nbMarquesTel, modeles: nbModelesTel, champs: nbChampsTel },
        automobiles: { marques: nbMarquesAuto, modeles: nbModelesAuto, champs: nbChampsAuto },
        totalOptions
    };
}

/**
 * \uD83C\uDFAF FONCTION HELPER : Obtenir les modèles d'une marque
 * (Utilise le mapping auto-généré)
 */
export function getModelesByMarque(
    marque: string,
    category: 'telephone' | 'automobile'
): string[] {
    const mapping = MODELES_PAR_MARQUE_AUTO[category];
    return mapping[marque] || [];
}

// Exécuter l'analyse au chargement (en dev seulement)
if (__DEV__) {
    analyserBaseExistante();
}

