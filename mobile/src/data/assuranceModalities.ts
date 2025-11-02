/**
 * Modalités pour la catégorie Assurance
 * Gestion intelligente des produits VIE et NON VIE
 */

export interface AssuranceModalityCategory {
    [key: string]: string[];
}

// ✅ MODALITÉS ASSURANCE COMPLÈTES
export const ASSURANCE_MODALITIES: AssuranceModalityCategory = {
    // ✅ Types d'assurance (VIE / NON VIE) - PREMIER CHAMP OBLIGATOIRE
    types_assurance: [
        'VIE',
        'NON VIE'
    ],

    // ✅ PRODUITS ASSURANCE VIE (affichés si type = VIE)
    produits_vie: [
        'Assurance Vie Entière',
        'Assurance Vie Temporaire',
        'Assurance Décès',
        'Assurance Épargne',
        'Assurance Retraite',
        'Assurance Éducation',
        'Assurance Mixte (Épargne + Décès)',
        'Assurance Prévoyance',
        'Assurance Capital Différé',
        'Assurance Rente',
        '🆕 Autre (ajouter)'
    ],

    // ✅ PRODUITS ASSURANCE NON VIE (affichés si type = NON VIE)
    produits_non_vie: [
        'Assurance Automobile',
        'Assurance Auto Tous Risques',
        'Assurance Auto Au Tiers',
        'Assurance Moto',
        'Assurance Habitation',
        'Assurance Multirisque Habitation',
        'Assurance Santé / Maladie',
        'Assurance Hospitalisation',
        'Assurance Maternité',
        'Assurance Voyage',
        'Assurance Rapatriement',
        'Assurance Responsabilité Civile',
        'Assurance Entreprise',
        'Assurance Marchandises',
        'Assurance Incendie',
        'Assurance Vol',
        'Assurance Tous Risques Chantier',
        'Assurance Flotte Automobile',
        '🆕 Autre (ajouter)'
    ],

    // ✅ COMPAGNIES D'ASSURANCE CAMEROUNAISES + INTERNATIONALES
    compagnies: [
        // Compagnies camerounaises majeures
        'ACTIVA Assurances',
        'AXA Assurances Cameroun',
        'ALLIANZ Cameroun',
        'SAHAM Assurance',
        'NSIA Assurances',
        'SUNU Assurances',
        'CHANAS Assurance',
        'UBA Assurance',
        'ARO Assurance',
        'Beneficial Life',
        'ZENITECH Assurance',
        'ACAC (Assurances Conseils Africaines du Cameroun)',
        // Compagnies internationales présentes
        'Allianz',
        'AXA',
        'Generali',
        'Zurich',
        'Groupama',
        'MAAF',
        'MMA',
        '🆕 Autre (ajouter)'
    ],

    // ✅ COUVERTURES / GARANTIES (multi-select)
    couvertures: [
        // Automobile
        'Tous risques',
        'Responsabilité Civile (Au tiers)',
        'Vol',
        'Incendie',
        'Bris de glace',
        'Dommages tous accidents',
        'Assistance 24h/24',
        'Défense et recours',
        'Protection juridique',
        'Valeur à neuf',
        'Catastrophes naturelles',
        // Santé
        'Hospitalisation',
        'Soins ambulatoires',
        'Maternité',
        'Dentaire',
        'Optique',
        'Pharmacie',
        'Analyses médicales',
        'Évacuation sanitaire',
        // Habitation
        'Incendie et explosion',
        'Dégâts des eaux',
        'Vol et vandalisme',
        'Catastrophes naturelles',
        'Responsabilité civile vie privée',
        'Bris de glace',
        'Dommages électriques',
        // Vie
        'Capital décès',
        'Rente invalidité',
        'Frais d\'obsèques',
        'Capital santé',
        'Rente éducation',
        '🆕 Autre (ajouter)'
    ],

    // ✅ PRINCIPAUX BÉNÉFICES (multi-select)
    benefices: [
        // Vie
        'Capital garanti',
        'Épargne sécurisée',
        'Protection famille',
        'Préparation retraite',
        'Avantages fiscaux',
        'Rente viagère',
        'Valeur de rachat',
        // Non-Vie Général
        'Indemnisation rapide',
        'Assistance 24h/24',
        'Réseau agréé',
        'Franchise modulable',
        'Tiers payant',
        'Garantie valeur à neuf',
        'Remboursement sans franchise',
        // Auto spécifique
        'Véhicule de remplacement',
        'Assistance dépannage',
        'Protection conducteur',
        'Extension géographique',
        // Santé spécifique
        'Tiers payant direct',
        'Téléconsultation',
        'Évacuation sanitaire',
        'Prise en charge à l\'étranger',
        'Couverture famille',
        '🆕 Autre (ajouter)'
    ],

    // ✅ OPTIONS DE CONTRAT (pour tableau options/primes)
    options_contrat: [
        'Formule Basique',
        'Formule Standard',
        'Formule Confort',
        'Formule Premium',
        'Formule Excellence',
        'Option Assistance',
        'Option Protection Juridique',
        'Option Valeur à neuf',
        'Option Conducteur secondaire',
        'Option Bris de glace',
        'Option Tous risques',
        'Extension famille',
        'Extension géographique',
        'Garantie capital décès',
        'Garantie invalidité',
        '🆕 Autre (ajouter)'
    ],

    // Durées de contrat
    durees: [
        '3 mois',
        '6 mois',
        '12 mois',
        '24 mois',
        '36 mois',
        '5 ans',
        '10 ans',
        '15 ans',
        '20 ans',
        'Viagère',
        '🆕 Autre (ajouter)'
    ],

    // Modes de paiement
    modes_paiement: [
        'Mensuel',
        'Trimestriel',
        'Semestriel',
        'Annuel',
        'Paiement unique',
        'Prélèvement automatique',
        '🆕 Autre (ajouter)'
    ],

    // Conditions d'âge
    conditions_age: [
        '18-30 ans',
        '31-40 ans',
        '41-50 ans',
        '51-60 ans',
        '61-70 ans',
        'Plus de 70 ans',
        'Tous âges',
        '🆕 Autre (ajouter)'
    ]
};

/**
 * Retourne les produits d'assurance selon le type (VIE ou NON VIE)
 */
export const getProduitsAssuranceByType = (type: string): string[] => {
    if (type === 'VIE') {
        return ASSURANCE_MODALITIES.produits_vie;
    } else if (type === 'NON VIE') {
        return ASSURANCE_MODALITIES.produits_non_vie;
    }
    // Si pas de type sélectionné, retourner tous les produits
    return [...ASSURANCE_MODALITIES.produits_vie, ...ASSURANCE_MODALITIES.produits_non_vie];
};











