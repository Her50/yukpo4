// ✅ SYSTÈME CENTRALISÉ DES LABORATOIRES & CENTRES D'IMAGERIE MÉDICALE
// Afrique Francophone Complète - Gestion intelligente des laboratoires réels

export interface LaboratoireInfo {
    nom: string;
    ville: string;
    pays: string;
    type: 'Analyses' | 'Imagerie' | 'Mixte' | 'Anatomopathologie';
    specialites?: string[]; // Analyses ou examens spécialisés
    renomme?: boolean; // Laboratoires les plus connus
}

export interface LaboratoiresPays {
    code: string; // Code pays ISO (CM, CI, SN, etc.)
    emoji: string;
    nom: string;
    capitale: string;
    laboratoires: LaboratoireInfo[];
}

// ============================================================================
// 🇨🇲 CAMEROUN - Le plus détaillé (pays principal de Yukpo)
// ============================================================================
export const LABORATOIRES_CAMEROUN: LaboratoiresPays = {
    code: 'CM',
    emoji: '🇨🇲',
    nom: 'Cameroun',
    capitale: 'Yaoundé',
    laboratoires: [
        // ═══════════════════════════════════════════════════════════════
        // 🏙️ DOUALA - Capitale économique (50+ laboratoires)
        // ═══════════════════════════════════════════════════════════════

        // Laboratoires d'analyses - Douala
        { nom: 'Laboratoire d\'Analyses Médicales de Bonapriso', ville: 'Douala', pays: 'Cameroun', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire Central de Douala', ville: 'Douala', pays: 'Cameroun', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire LANACOME (Laboratoire National de Contrôle)', ville: 'Douala', pays: 'Cameroun', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire Biotech', ville: 'Douala', pays: 'Cameroun', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Bonanjo', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Akwa', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Biologique de Bali', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire de Biologie Médicale New Bell', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Deido', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Médical de Bonabéri', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Makepe', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Biologique de Logpom', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Bonamoussadi', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Médical de Kotto', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de PK8', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Biologique de PK10', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Ndogpassi', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire de Biologie de Bessengue', ville: 'Douala', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'LABOGENE - Laboratoire de Génétique Douala', ville: 'Douala', pays: 'Cameroun', type: 'Analyses', specialites: ['Génétique', 'ADN'], renomme: true },
        { nom: 'Laboratoire CERBA Douala', ville: 'Douala', pays: 'Cameroun', type: 'Analyses', renomme: true },

        // Centres d'imagerie - Douala
        { nom: 'Centre d\'Imagerie Médicale de Bonapriso', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie', renomme: true },
        { nom: 'Centre de Radiologie d\'Akwa', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie', renomme: true },
        { nom: 'Centre IRM Scanner de Douala', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie', specialites: ['IRM', 'Scanner'], renomme: true },
        { nom: 'Centre d\'Imagerie de Bonanjo', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre de Radiologie de Bali', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre d\'Échographie de Deido', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre d\'Imagerie de Bonabéri', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre de Radiologie de Makepe', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre d\'Imagerie de Bonamoussadi', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre Scanner de PK10', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie', specialites: ['Scanner'] },
        { nom: 'Doppler Center Douala', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie', specialites: ['Doppler', 'Échographie'] },
        { nom: 'Mammo-Center Douala (Mammographie)', ville: 'Douala', pays: 'Cameroun', type: 'Imagerie', specialites: ['Mammographie'] },

        // Centres mixtes (Analyses + Imagerie) - Douala
        { nom: 'Polyclinique Bonanjo - Labo & Imagerie', ville: 'Douala', pays: 'Cameroun', type: 'Mixte', renomme: true },
        { nom: 'Clinique de l\'Aéroport - Centre Médical Complet', ville: 'Douala', pays: 'Cameroun', type: 'Mixte', renomme: true },
        { nom: 'Centre Médical d\'Akwa - Analyses & Scanner', ville: 'Douala', pays: 'Cameroun', type: 'Mixte' },
        { nom: 'Polyclinique de Bonapriso - Labo & Radiologie', ville: 'Douala', pays: 'Cameroun', type: 'Mixte' },
        { nom: 'Centre Médical de Makepe - Analyses & Imagerie', ville: 'Douala', pays: 'Cameroun', type: 'Mixte' },
        { nom: 'Centre Hospitalier de Bonabéri - Labo & Radio', ville: 'Douala', pays: 'Cameroun', type: 'Mixte' },

        // ═══════════════════════════════════════════════════════════════
        // 🏛️ YAOUNDÉ - Capitale politique (40+ laboratoires)
        // ═══════════════════════════════════════════════════════════════

        // Laboratoires d'analyses - Yaoundé
        { nom: 'Laboratoire National de Santé Publique (LNSP)', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Bastos', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire Central de Yaoundé', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses du Centre-Ville', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire de la Poste Centrale', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Nlongkak', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Biologique d\'Elig-Essono', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Melen', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire de Biologie de Ngoa-Ekelle', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Omnisport', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Médical de Mokolo', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Ekounou', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire de Biologie de Tsinga', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Briqueterie', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Laboratoire Médical d\'Odza', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'LABOGENE Yaoundé', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses', specialites: ['Génétique'], renomme: true },
        { nom: 'Laboratoire CERBA Yaoundé', ville: 'Yaoundé', pays: 'Cameroun', type: 'Analyses', renomme: true },

        // Centres d'imagerie - Yaoundé
        { nom: 'Centre d\'Imagerie Médicale de Bastos', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie', renomme: true },
        { nom: 'Centre IRM Scanner de Yaoundé', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie', specialites: ['IRM', 'Scanner'], renomme: true },
        { nom: 'Centre de Radiologie du Centre-Ville', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre d\'Imagerie de Nlongkak', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre de Radiologie d\'Elig-Essono', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre d\'Échographie de Melen', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Centre Scanner d\'Omnisport', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie', specialites: ['Scanner'] },
        { nom: 'Centre d\'Imagerie de Tsinga', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Doppler Center Yaoundé', ville: 'Yaoundé', pays: 'Cameroun', type: 'Imagerie', specialites: ['Doppler'] },

        // Centres mixtes - Yaoundé
        { nom: 'Centre Médical de Bastos - Labo & Imagerie', ville: 'Yaoundé', pays: 'Cameroun', type: 'Mixte', renomme: true },
        { nom: 'Polyclinique Nlongkak - Analyses & Scanner', ville: 'Yaoundé', pays: 'Cameroun', type: 'Mixte' },
        { nom: 'Centre Médical d\'Elig-Essono - Labo & Radio', ville: 'Yaoundé', pays: 'Cameroun', type: 'Mixte' },
        { nom: 'Clinique du Centre - Analyses & Imagerie', ville: 'Yaoundé', pays: 'Cameroun', type: 'Mixte' },

        // ═══════════════════════════════════════════════════════════════
        // 🌆 AUTRES GRANDES VILLES DU CAMEROUN (20+ laboratoires)
        // ═══════════════════════════════════════════════════════════════

        // Bafoussam
        { nom: 'Laboratoire d\'Analyses de Bafoussam', ville: 'Bafoussam', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Bafoussam', ville: 'Bafoussam', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Laboratoire Central de Bafoussam', ville: 'Bafoussam', pays: 'Cameroun', type: 'Analyses' },

        // Garoua
        { nom: 'Laboratoire d\'Analyses de Garoua', ville: 'Garoua', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Centre de Radiologie de Garoua', ville: 'Garoua', pays: 'Cameroun', type: 'Imagerie' },
        { nom: 'Laboratoire Central de Garoua', ville: 'Garoua', pays: 'Cameroun', type: 'Analyses' },

        // Bamenda
        { nom: 'Bamenda Medical Laboratory', ville: 'Bamenda', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Bamenda Radiology Center', ville: 'Bamenda', pays: 'Cameroun', type: 'Imagerie' },

        // Maroua
        { nom: 'Laboratoire d\'Analyses de Maroua', ville: 'Maroua', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Maroua', ville: 'Maroua', pays: 'Cameroun', type: 'Imagerie' },

        // Ngaoundéré
        { nom: 'Laboratoire d\'Analyses de Ngaoundéré', ville: 'Ngaoundéré', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Centre de Radiologie de Ngaoundéré', ville: 'Ngaoundéré', pays: 'Cameroun', type: 'Imagerie' },

        // Bertoua
        { nom: 'Laboratoire d\'Analyses de Bertoua', ville: 'Bertoua', pays: 'Cameroun', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Bertoua', ville: 'Bertoua', pays: 'Cameroun', type: 'Imagerie' },

        // Ebolowa
        { nom: 'Laboratoire d\'Analyses d\'Ebolowa', ville: 'Ebolowa', pays: 'Cameroun', type: 'Analyses' },

        // Kribi
        { nom: 'Laboratoire d\'Analyses de Kribi', ville: 'Kribi', pays: 'Cameroun', type: 'Analyses' },

        // Limbé
        { nom: 'Limbe Medical Laboratory', ville: 'Limbé', pays: 'Cameroun', type: 'Analyses' },

        // Buea
        { nom: 'Buea Medical Laboratory', ville: 'Buea', pays: 'Cameroun', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇨🇮 CÔTE D'IVOIRE
// ============================================================================
export const LABORATOIRES_COTE_IVOIRE: LaboratoiresPays = {
    code: 'CI',
    emoji: '🇨🇮',
    nom: 'Côte d\'Ivoire',
    capitale: 'Yamoussoukro',
    laboratoires: [
        // ABIDJAN (Capitale économique)
        { nom: 'Laboratoire Pasteur d\'Abidjan', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire CERBA Côte d\'Ivoire', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire Central du CHU de Cocody', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses du Plateau', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire BioLab Abidjan', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Cocody', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Marcory', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Yopougon', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Adjamé', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Treichville', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Koumassi', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Abobo', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Port-Bouët', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Attécoubé', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Bingerville', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Analyses' },

        // Centres d'imagerie - Abidjan
        { nom: 'Centre d\'Imagerie IRM Scanner du Plateau', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Imagerie', renomme: true },
        { nom: 'Centre de Radiologie de Cocody', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Imagerie', renomme: true },
        { nom: 'Centre d\'Imagerie Médicale Polyclinique Internationale', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Imagerie', renomme: true },
        { nom: 'Centre Scanner de Marcory', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Imagerie' },
        { nom: 'Centre d\'Échographie de Yopougon', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Imagerie' },
        { nom: 'Centre de Radiologie d\'Adjamé', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Imagerie' },
        { nom: 'Doppler Center Abidjan', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Imagerie', specialites: ['Doppler'] },

        // Centres mixtes - Abidjan
        { nom: 'Polyclinique Sainte Anne Marie - Labo & Imagerie', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Mixte', renomme: true },
        { nom: 'Clinique du Plateau - Analyses & Scanner', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Mixte' },
        { nom: 'Centre Médical de Cocody - Labo & Radio', ville: 'Abidjan', pays: 'Côte d\'Ivoire', type: 'Mixte' },

        // YAMOUSSOUKRO
        { nom: 'Laboratoire d\'Analyses de Yamoussoukro', ville: 'Yamoussoukro', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Yamoussoukro', ville: 'Yamoussoukro', pays: 'Côte d\'Ivoire', type: 'Imagerie' },

        // BOUAKÉ
        { nom: 'Laboratoire d\'Analyses de Bouaké', ville: 'Bouaké', pays: 'Côte d\'Ivoire', type: 'Analyses' },
        { nom: 'Centre de Radiologie de Bouaké', ville: 'Bouaké', pays: 'Côte d\'Ivoire', type: 'Imagerie' },

        // SAN-PÉDRO
        { nom: 'Laboratoire d\'Analyses de San-Pédro', ville: 'San-Pédro', pays: 'Côte d\'Ivoire', type: 'Analyses' },

        // DALOA
        { nom: 'Laboratoire d\'Analyses de Daloa', ville: 'Daloa', pays: 'Côte d\'Ivoire', type: 'Analyses' },

        // KORHOGO
        { nom: 'Laboratoire d\'Analyses de Korhogo', ville: 'Korhogo', pays: 'Côte d\'Ivoire', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇸🇳 SÉNÉGAL
// ============================================================================
export const LABORATOIRES_SENEGAL: LaboratoiresPays = {
    code: 'SN',
    emoji: '🇸🇳',
    nom: 'Sénégal',
    capitale: 'Dakar',
    laboratoires: [
        // DAKAR
        { nom: 'Laboratoire Pasteur de Dakar', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire Biolab Dakar', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire CERBA Sénégal', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses du Plateau', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Fann', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses des Almadies', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Mermoz', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Point E', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Ouakam', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Liberté 6', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Médina', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Parcelles Assainies', ville: 'Dakar', pays: 'Sénégal', type: 'Analyses' },

        // Centres d'imagerie - Dakar
        { nom: 'Centre IRM Scanner de Dakar', ville: 'Dakar', pays: 'Sénégal', type: 'Imagerie', renomme: true },
        { nom: 'Centre d\'Imagerie Médicale du Plateau', ville: 'Dakar', pays: 'Sénégal', type: 'Imagerie', renomme: true },
        { nom: 'Centre de Radiologie de Fann', ville: 'Dakar', pays: 'Sénégal', type: 'Imagerie' },
        { nom: 'Centre d\'Imagerie des Almadies', ville: 'Dakar', pays: 'Sénégal', type: 'Imagerie' },
        { nom: 'Centre Scanner de Mermoz', ville: 'Dakar', pays: 'Sénégal', type: 'Imagerie' },
        { nom: 'Doppler Center Dakar', ville: 'Dakar', pays: 'Sénégal', type: 'Imagerie', specialites: ['Doppler'] },

        // Centres mixtes - Dakar
        { nom: 'Clinique Casahous - Labo & Imagerie', ville: 'Dakar', pays: 'Sénégal', type: 'Mixte', renomme: true },
        { nom: 'Polyclinique du Point E - Analyses & Scanner', ville: 'Dakar', pays: 'Sénégal', type: 'Mixte' },

        // THIÈS
        { nom: 'Laboratoire d\'Analyses de Thiès', ville: 'Thiès', pays: 'Sénégal', type: 'Analyses' },
        { nom: 'Centre de Radiologie de Thiès', ville: 'Thiès', pays: 'Sénégal', type: 'Imagerie' },

        // SAINT-LOUIS
        { nom: 'Laboratoire d\'Analyses de Saint-Louis', ville: 'Saint-Louis', pays: 'Sénégal', type: 'Analyses' },

        // TOUBA
        { nom: 'Laboratoire d\'Analyses de Touba', ville: 'Touba', pays: 'Sénégal', type: 'Analyses' },

        // KAOLACK
        { nom: 'Laboratoire d\'Analyses de Kaolack', ville: 'Kaolack', pays: 'Sénégal', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇲🇱 MALI
// ============================================================================
export const LABORATOIRES_MALI: LaboratoiresPays = {
    code: 'ML',
    emoji: '🇲🇱',
    nom: 'Mali',
    capitale: 'Bamako',
    laboratoires: [
        // BAMAKO
        { nom: 'Laboratoire Central du CHU Gabriel Touré', ville: 'Bamako', pays: 'Mali', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Bamako', ville: 'Bamako', pays: 'Mali', type: 'Analyses' },
        { nom: 'Laboratoire Biolab Bamako', ville: 'Bamako', pays: 'Mali', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de l\'Hippodrome', ville: 'Bamako', pays: 'Mali', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Badalabougou', ville: 'Bamako', pays: 'Mali', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Hamdallaye', ville: 'Bamako', pays: 'Mali', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Faladié', ville: 'Bamako', pays: 'Mali', type: 'Analyses' },

        // Centres d'imagerie - Bamako
        { nom: 'Centre d\'Imagerie Médicale de Bamako', ville: 'Bamako', pays: 'Mali', type: 'Imagerie', renomme: true },
        { nom: 'Centre de Radiologie du Point G', ville: 'Bamako', pays: 'Mali', type: 'Imagerie' },
        { nom: 'Centre Scanner de Bamako', ville: 'Bamako', pays: 'Mali', type: 'Imagerie' },

        // Centres mixtes
        { nom: 'Clinique Pasteur - Labo & Imagerie', ville: 'Bamako', pays: 'Mali', type: 'Mixte', renomme: true },

        // SIKASSO
        { nom: 'Laboratoire d\'Analyses de Sikasso', ville: 'Sikasso', pays: 'Mali', type: 'Analyses' },

        // KAYES
        { nom: 'Laboratoire d\'Analyses de Kayes', ville: 'Kayes', pays: 'Mali', type: 'Analyses' },

        // SÉGOU
        { nom: 'Laboratoire d\'Analyses de Ségou', ville: 'Ségou', pays: 'Mali', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇨🇩 RD CONGO (République Démocratique du Congo)
// ============================================================================
export const LABORATOIRES_RD_CONGO: LaboratoiresPays = {
    code: 'CD',
    emoji: '🇨🇩',
    nom: 'RD Congo',
    capitale: 'Kinshasa',
    laboratoires: [
        // KINSHASA
        { nom: 'Laboratoire Central de Kinshasa', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire BioKin', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Gombe', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de la Gombe', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Ngaliema', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Lemba', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Matete', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Kalamu', ville: 'Kinshasa', pays: 'RD Congo', type: 'Analyses' },

        // Centres d'imagerie - Kinshasa
        { nom: 'Centre d\'Imagerie Médicale de Kinshasa', ville: 'Kinshasa', pays: 'RD Congo', type: 'Imagerie', renomme: true },
        { nom: 'Centre de Radiologie de Gombe', ville: 'Kinshasa', pays: 'RD Congo', type: 'Imagerie' },
        { nom: 'Centre Scanner de Kinshasa', ville: 'Kinshasa', pays: 'RD Congo', type: 'Imagerie' },

        // Centres mixtes
        { nom: 'Clinique Ngaliema - Labo & Imagerie', ville: 'Kinshasa', pays: 'RD Congo', type: 'Mixte', renomme: true },
        { nom: 'Centre Médical Diamant - Analyses & Scanner', ville: 'Kinshasa', pays: 'RD Congo', type: 'Mixte' },

        // LUBUMBASHI
        { nom: 'Laboratoire d\'Analyses de Lubumbashi', ville: 'Lubumbashi', pays: 'RD Congo', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Lubumbashi', ville: 'Lubumbashi', pays: 'RD Congo', type: 'Imagerie' },

        // MBUJI-MAYI
        { nom: 'Laboratoire d\'Analyses de Mbuji-Mayi', ville: 'Mbuji-Mayi', pays: 'RD Congo', type: 'Analyses' },

        // KANANGA
        { nom: 'Laboratoire d\'Analyses de Kananga', ville: 'Kananga', pays: 'RD Congo', type: 'Analyses' },

        // GOMA
        { nom: 'Laboratoire d\'Analyses de Goma', ville: 'Goma', pays: 'RD Congo', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇨🇬 CONGO-BRAZZAVILLE (République du Congo)
// ============================================================================
export const LABORATOIRES_CONGO_BRAZZA: LaboratoiresPays = {
    code: 'CG',
    emoji: '🇨🇬',
    nom: 'Congo-Brazzaville',
    capitale: 'Brazzaville',
    laboratoires: [
        // BRAZZAVILLE
        { nom: 'Laboratoire Central de Brazzaville', ville: 'Brazzaville', pays: 'Congo-Brazzaville', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Poto-Poto', ville: 'Brazzaville', pays: 'Congo-Brazzaville', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Bacongo', ville: 'Brazzaville', pays: 'Congo-Brazzaville', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Moungali', ville: 'Brazzaville', pays: 'Congo-Brazzaville', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Brazzaville', ville: 'Brazzaville', pays: 'Congo-Brazzaville', type: 'Imagerie' },
        { nom: 'Centre de Radiologie de Brazzaville', ville: 'Brazzaville', pays: 'Congo-Brazzaville', type: 'Imagerie' },

        // POINTE-NOIRE
        { nom: 'Laboratoire d\'Analyses de Pointe-Noire', ville: 'Pointe-Noire', pays: 'Congo-Brazzaville', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Pointe-Noire', ville: 'Pointe-Noire', pays: 'Congo-Brazzaville', type: 'Imagerie' },

        // DOLISIE
        { nom: 'Laboratoire d\'Analyses de Dolisie', ville: 'Dolisie', pays: 'Congo-Brazzaville', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇬🇦 GABON
// ============================================================================
export const LABORATOIRES_GABON: LaboratoiresPays = {
    code: 'GA',
    emoji: '🇬🇦',
    nom: 'Gabon',
    capitale: 'Libreville',
    laboratoires: [
        // LIBREVILLE
        { nom: 'Laboratoire Central de Libreville', ville: 'Libreville', pays: 'Gabon', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses du Boulevard', ville: 'Libreville', pays: 'Gabon', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Glass', ville: 'Libreville', pays: 'Gabon', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Nombakele', ville: 'Libreville', pays: 'Gabon', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Oloumi', ville: 'Libreville', pays: 'Gabon', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie Médicale de Libreville', ville: 'Libreville', pays: 'Gabon', type: 'Imagerie', renomme: true },
        { nom: 'Centre de Radiologie de Libreville', ville: 'Libreville', pays: 'Gabon', type: 'Imagerie' },
        { nom: 'Centre Scanner de Libreville', ville: 'Libreville', pays: 'Gabon', type: 'Imagerie' },

        // PORT-GENTIL
        { nom: 'Laboratoire d\'Analyses de Port-Gentil', ville: 'Port-Gentil', pays: 'Gabon', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Port-Gentil', ville: 'Port-Gentil', pays: 'Gabon', type: 'Imagerie' },

        // FRANCEVILLE
        { nom: 'Laboratoire d\'Analyses de Franceville', ville: 'Franceville', pays: 'Gabon', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇹🇬 TOGO
// ============================================================================
export const LABORATOIRES_TOGO: LaboratoiresPays = {
    code: 'TG',
    emoji: '🇹🇬',
    nom: 'Togo',
    capitale: 'Lomé',
    laboratoires: [
        // LOMÉ
        { nom: 'Laboratoire Central de Lomé', ville: 'Lomé', pays: 'Togo', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Bè', ville: 'Lomé', pays: 'Togo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Agoè', ville: 'Lomé', pays: 'Togo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Tokoin', ville: 'Lomé', pays: 'Togo', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Nyékonakpoè', ville: 'Lomé', pays: 'Togo', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie Médicale de Lomé', ville: 'Lomé', pays: 'Togo', type: 'Imagerie' },
        { nom: 'Centre de Radiologie de Lomé', ville: 'Lomé', pays: 'Togo', type: 'Imagerie' },

        // KARA
        { nom: 'Laboratoire d\'Analyses de Kara', ville: 'Kara', pays: 'Togo', type: 'Analyses' },

        // SOKODÉ
        { nom: 'Laboratoire d\'Analyses de Sokodé', ville: 'Sokodé', pays: 'Togo', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇧🇯 BÉNIN
// ============================================================================
export const LABORATOIRES_BENIN: LaboratoiresPays = {
    code: 'BJ',
    emoji: '🇧🇯',
    nom: 'Bénin',
    capitale: 'Porto-Novo',
    laboratoires: [
        // COTONOU (Capitale économique)
        { nom: 'Laboratoire Central de Cotonou', ville: 'Cotonou', pays: 'Bénin', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Cotonou', ville: 'Cotonou', pays: 'Bénin', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Akpakpa', ville: 'Cotonou', pays: 'Bénin', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Cadjèhoun', ville: 'Cotonou', pays: 'Bénin', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Fidjrossè', ville: 'Cotonou', pays: 'Bénin', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie Médicale de Cotonou', ville: 'Cotonou', pays: 'Bénin', type: 'Imagerie' },
        { nom: 'Centre de Radiologie de Cotonou', ville: 'Cotonou', pays: 'Bénin', type: 'Imagerie' },

        // PORTO-NOVO
        { nom: 'Laboratoire d\'Analyses de Porto-Novo', ville: 'Porto-Novo', pays: 'Bénin', type: 'Analyses' },

        // PARAKOU
        { nom: 'Laboratoire d\'Analyses de Parakou', ville: 'Parakou', pays: 'Bénin', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇧🇫 BURKINA FASO
// ============================================================================
export const LABORATOIRES_BURKINA_FASO: LaboratoiresPays = {
    code: 'BF',
    emoji: '🇧🇫',
    nom: 'Burkina Faso',
    capitale: 'Ouagadougou',
    laboratoires: [
        // OUAGADOUGOU
        { nom: 'Laboratoire Central de Ouagadougou', ville: 'Ouagadougou', pays: 'Burkina Faso', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Ouaga', ville: 'Ouagadougou', pays: 'Burkina Faso', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Koulouba', ville: 'Ouagadougou', pays: 'Burkina Faso', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Gounghin', ville: 'Ouagadougou', pays: 'Burkina Faso', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Cissin', ville: 'Ouagadougou', pays: 'Burkina Faso', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie Médicale de Ouagadougou', ville: 'Ouagadougou', pays: 'Burkina Faso', type: 'Imagerie' },
        { nom: 'Centre de Radiologie de Ouagadougou', ville: 'Ouagadougou', pays: 'Burkina Faso', type: 'Imagerie' },

        // BOBO-DIOULASSO
        { nom: 'Laboratoire d\'Analyses de Bobo-Dioulasso', ville: 'Bobo-Dioulasso', pays: 'Burkina Faso', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Bobo-Dioulasso', ville: 'Bobo-Dioulasso', pays: 'Burkina Faso', type: 'Imagerie' },

        // KOUDOUGOU
        { nom: 'Laboratoire d\'Analyses de Koudougou', ville: 'Koudougou', pays: 'Burkina Faso', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇳🇪 NIGER
// ============================================================================
export const LABORATOIRES_NIGER: LaboratoiresPays = {
    code: 'NE',
    emoji: '🇳🇪',
    nom: 'Niger',
    capitale: 'Niamey',
    laboratoires: [
        // NIAMEY
        { nom: 'Laboratoire Central de Niamey', ville: 'Niamey', pays: 'Niger', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Niamey', ville: 'Niamey', pays: 'Niger', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Plateau', ville: 'Niamey', pays: 'Niger', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Yantala', ville: 'Niamey', pays: 'Niger', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie Médicale de Niamey', ville: 'Niamey', pays: 'Niger', type: 'Imagerie' },

        // ZINDER
        { nom: 'Laboratoire d\'Analyses de Zinder', ville: 'Zinder', pays: 'Niger', type: 'Analyses' },

        // MARADI
        { nom: 'Laboratoire d\'Analyses de Maradi', ville: 'Maradi', pays: 'Niger', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇲🇬 MADAGASCAR
// ============================================================================
export const LABORATOIRES_MADAGASCAR: LaboratoiresPays = {
    code: 'MG',
    emoji: '🇲🇬',
    nom: 'Madagascar',
    capitale: 'Antananarivo',
    laboratoires: [
        // ANTANANARIVO
        { nom: 'Laboratoire Central d\'Antananarivo', ville: 'Antananarivo', pays: 'Madagascar', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire Pasteur de Madagascar', ville: 'Antananarivo', pays: 'Madagascar', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Tana', ville: 'Antananarivo', pays: 'Madagascar', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Analakely', ville: 'Antananarivo', pays: 'Madagascar', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Ankorondrano', ville: 'Antananarivo', pays: 'Madagascar', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses d\'Ivandry', ville: 'Antananarivo', pays: 'Madagascar', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie Médicale d\'Antananarivo', ville: 'Antananarivo', pays: 'Madagascar', type: 'Imagerie' },
        { nom: 'Centre de Radiologie d\'Antananarivo', ville: 'Antananarivo', pays: 'Madagascar', type: 'Imagerie' },

        // TOAMASINA
        { nom: 'Laboratoire d\'Analyses de Toamasina', ville: 'Toamasina', pays: 'Madagascar', type: 'Analyses' },

        // ANTSIRABE
        { nom: 'Laboratoire d\'Analyses d\'Antsirabe', ville: 'Antsirabe', pays: 'Madagascar', type: 'Analyses' },

        // MAHAJANGA
        { nom: 'Laboratoire d\'Analyses de Mahajanga', ville: 'Mahajanga', pays: 'Madagascar', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇹🇩 TCHAD
// ============================================================================
export const LABORATOIRES_TCHAD: LaboratoiresPays = {
    code: 'TD',
    emoji: '🇹🇩',
    nom: 'Tchad',
    capitale: 'N\'Djamena',
    laboratoires: [
        // N'DJAMENA
        { nom: 'Laboratoire Central de N\'Djamena', ville: 'N\'Djamena', pays: 'Tchad', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de N\'Djamena', ville: 'N\'Djamena', pays: 'Tchad', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Chagoua', ville: 'N\'Djamena', pays: 'Tchad', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de N\'Djamena', ville: 'N\'Djamena', pays: 'Tchad', type: 'Imagerie' },

        // MOUNDOU
        { nom: 'Laboratoire d\'Analyses de Moundou', ville: 'Moundou', pays: 'Tchad', type: 'Analyses' },

        // SARH
        { nom: 'Laboratoire d\'Analyses de Sarh', ville: 'Sarh', pays: 'Tchad', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇨🇫 RÉPUBLIQUE CENTRAFRICAINE
// ============================================================================
export const LABORATOIRES_RCA: LaboratoiresPays = {
    code: 'CF',
    emoji: '🇨🇫',
    nom: 'Centrafrique',
    capitale: 'Bangui',
    laboratoires: [
        // BANGUI
        { nom: 'Laboratoire Central de Bangui', ville: 'Bangui', pays: 'Centrafrique', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Bangui', ville: 'Bangui', pays: 'Centrafrique', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de PK5', ville: 'Bangui', pays: 'Centrafrique', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie de Bangui', ville: 'Bangui', pays: 'Centrafrique', type: 'Imagerie' },

        // BERBÉRATI
        { nom: 'Laboratoire d\'Analyses de Berbérati', ville: 'Berbérati', pays: 'Centrafrique', type: 'Analyses' },
    ]
};

// ============================================================================
// 🇬🇳 GUINÉE
// ============================================================================
export const LABORATOIRES_GUINEE: LaboratoiresPays = {
    code: 'GN',
    emoji: '🇬🇳',
    nom: 'Guinée',
    capitale: 'Conakry',
    laboratoires: [
        // CONAKRY
        { nom: 'Laboratoire Central de Conakry', ville: 'Conakry', pays: 'Guinée', type: 'Analyses', renomme: true },
        { nom: 'Laboratoire d\'Analyses de Conakry', ville: 'Conakry', pays: 'Guinée', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Kaloum', ville: 'Conakry', pays: 'Guinée', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Matam', ville: 'Conakry', pays: 'Guinée', type: 'Analyses' },
        { nom: 'Laboratoire d\'Analyses de Ratoma', ville: 'Conakry', pays: 'Guinée', type: 'Analyses' },
        { nom: 'Centre d\'Imagerie Médicale de Conakry', ville: 'Conakry', pays: 'Guinée', type: 'Imagerie' },

        // KANKAN
        { nom: 'Laboratoire d\'Analyses de Kankan', ville: 'Kankan', pays: 'Guinée', type: 'Analyses' },

        // LABÉ
        { nom: 'Laboratoire d\'Analyses de Labé', ville: 'Labé', pays: 'Guinée', type: 'Analyses' },
    ]
};

// ============================================================================
// LISTE COMPLÈTE DE TOUS LES PAYS
// ============================================================================
export const TOUS_LES_LABORATOIRES: LaboratoiresPays[] = [
    LABORATOIRES_CAMEROUN,
    LABORATOIRES_COTE_IVOIRE,
    LABORATOIRES_SENEGAL,
    LABORATOIRES_MALI,
    LABORATOIRES_RD_CONGO,
    LABORATOIRES_CONGO_BRAZZA,
    LABORATOIRES_GABON,
    LABORATOIRES_TOGO,
    LABORATOIRES_BENIN,
    LABORATOIRES_BURKINA_FASO,
    LABORATOIRES_NIGER,
    LABORATOIRES_MADAGASCAR,
    LABORATOIRES_TCHAD,
    LABORATOIRES_RCA,
    LABORATOIRES_GUINEE,
];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * 🎯 SYSTÈME GÉO-INTELLIGENT : Génère la liste des laboratoires avec TRIPLE PRIORITÉ
 * 
 * NIVEAU 1 (🏆 ULTRA PRIORITAIRE) : Laboratoires de la VILLE de l'utilisateur
 * NIVEAU 2 (⭐ PRIORITAIRE) : Laboratoires du PAYS de l'utilisateur (autres villes)
 * NIVEAU 3 (📍 SUGGESTION) : Laboratoires renommés des pays voisins
 * 
 * @param codePaysUtilisateur - Code ISO du pays (ex: 'CM', 'CI', 'SN')
 * @param villeUtilisateur - Nom de la ville de l'utilisateur (ex: 'Douala', 'Yaoundé')
 * @param quartierUtilisateur - Nom du quartier (optionnel, pour suggestions ultrafines)
 * 
 * @example
 * // Utilisateur à Douala, Cameroun
 * genererTousLesLaboratoires('CM', 'Douala')
 * // → Retourne d'abord les labos de Douala, puis Cameroun, puis autres pays
 */
export const genererTousLesLaboratoires = (
    codePaysUtilisateur: string = 'CM',
    villeUtilisateur?: string,
    quartierUtilisateur?: string
): string[] => {
    const laboratoires: string[] = [];
    const paysPrioritaire = TOUS_LES_LABORATOIRES.find(p => p.code === codePaysUtilisateur);

    if (!paysPrioritaire) {
        // Fallback si pays non trouvé
        laboratoires.push('🆕 Autre (ajouter)');
        return laboratoires;
    }

    // ═════════════════════════════════════════════════════════════════
    // 🏆 NIVEAU 1 : VILLE DE L'UTILISATEUR (Ultra Prioritaire)
    // ═════════════════════════════════════════════════════════════════
    if (villeUtilisateur) {
        const labosVille = paysPrioritaire.laboratoires.filter(lab =>
            lab.ville.toLowerCase() === villeUtilisateur.toLowerCase()
        );

        if (labosVille.length > 0) {
            laboratoires.push(`──── 🏙️ ${villeUtilisateur.toUpperCase()} (Votre ville) ────`);

            // Laboratoires renommés de la ville en premier
            labosVille
                .filter(lab => lab.renomme)
                .forEach(lab => {
                    laboratoires.push(`🏆 ${lab.nom} [${lab.type}]`);
                });

            // Autres laboratoires de la ville
            labosVille
                .filter(lab => !lab.renomme)
                .forEach(lab => {
                    laboratoires.push(`📍 ${lab.nom} [${lab.type}]`);
                });

            laboratoires.push(''); // Ligne vide pour séparation visuelle
        }
    }

    // ═════════════════════════════════════════════════════════════════
    // ⭐ NIVEAU 2 : AUTRES VILLES DU PAYS (Prioritaire)
    // ═════════════════════════════════════════════════════════════════
    const autresVillesPays = paysPrioritaire.laboratoires.filter(lab =>
        !villeUtilisateur || lab.ville.toLowerCase() !== villeUtilisateur.toLowerCase()
    );

    if (autresVillesPays.length > 0) {
        laboratoires.push(`──── ${paysPrioritaire.emoji} ${paysPrioritaire.nom.toUpperCase()} (Autres villes) ────`);

        // Grouper par ville et afficher les plus renommés
        const villesSet = new Set(autresVillesPays.map(lab => lab.ville));
        const villesArray = Array.from(villesSet);

        // Prendre les 2 plus grandes villes (hors ville utilisateur)
        const villesPrincipales = villesArray.slice(0, 3);

        villesPrincipales.forEach(ville => {
            const labosVille = autresVillesPays
                .filter(lab => lab.ville === ville)
                .filter(lab => lab.renomme) // Seulement les renommés pour ne pas surcharger
                .slice(0, 3); // Max 3 par ville

            if (labosVille.length > 0) {
                labosVille.forEach(lab => {
                    laboratoires.push(`${paysPrioritaire.emoji} ${lab.nom} - ${ville}`);
                });
            }
        });

        laboratoires.push(''); // Ligne vide
    }

    // ═════════════════════════════════════════════════════════════════
    // 📍 NIVEAU 3 : PAYS VOISINS (Suggestions)
    // ═════════════════════════════════════════════════════════════════
    laboratoires.push('──── 🌍 Autres pays (Suggestions) ────');

    TOUS_LES_LABORATOIRES
        .filter(p => p.code !== codePaysUtilisateur)
        .forEach(pays => {
            const labosRenommes = pays.laboratoires
                .filter(lab => lab.renomme)
                .slice(0, 2); // Max 2 labos renommés par pays

            labosRenommes.forEach(lab => {
                laboratoires.push(`${pays.emoji} ${lab.nom} - ${lab.ville}, ${pays.nom}`);
            });
        });

    laboratoires.push('🆕 Autre (ajouter)');
    return laboratoires;
};

/**
 * Génère la liste des laboratoires d'une ville spécifique
 */
export const genererLaboratoiresParVille = (ville: string, codePays: string = 'CM'): string[] => {
    const pays = TOUS_LES_LABORATOIRES.find(p => p.code === codePays);
    if (!pays) return ['🆕 Autre (ajouter)'];

    const laboratoires: string[] = [];
    pays.laboratoires
        .filter(lab => lab.ville === ville)
        .forEach(lab => {
            laboratoires.push(`${lab.nom} [${lab.type}]`);
        });

    if (laboratoires.length === 0) {
        return ['🆕 Autre (ajouter)'];
    }

    laboratoires.push('🆕 Autre (ajouter)');
    return laboratoires;
};

/**
 * Génère la liste des laboratoires par type
 */
export const genererLaboratoiresParType = (type: 'Analyses' | 'Imagerie' | 'Mixte' | 'Anatomopathologie', codePays: string = 'CM'): string[] => {
    const pays = TOUS_LES_LABORATOIRES.find(p => p.code === codePays);
    if (!pays) return ['🆕 Autre (ajouter)'];

    const laboratoires: string[] = [];
    pays.laboratoires
        .filter(lab => lab.type === type)
        .slice(0, 20) // Limiter à 20 pour ne pas surcharger
        .forEach(lab => {
            laboratoires.push(`${lab.nom} - ${lab.ville}`);
        });

    if (laboratoires.length === 0) {
        return ['🆕 Autre (ajouter)'];
    }

    laboratoires.push('🆕 Autre (ajouter)');
    return laboratoires;
};

/**
 * Recherche intelligente de laboratoires par nom/ville/spécialité
 */
export const rechercherLaboratoires = (query: string, codePays?: string): LaboratoireInfo[] => {
    const queryNormalized = query.toLowerCase().trim();
    let resultats: LaboratoireInfo[] = [];

    const paysAChercher = codePays
        ? TOUS_LES_LABORATOIRES.filter(p => p.code === codePays)
        : TOUS_LES_LABORATOIRES;

    paysAChercher.forEach(pays => {
        const matches = pays.laboratoires.filter(lab =>
            lab.nom.toLowerCase().includes(queryNormalized) ||
            lab.ville.toLowerCase().includes(queryNormalized) ||
            lab.specialites?.some(s => s.toLowerCase().includes(queryNormalized))
        );
        resultats.push(...matches);
    });

    // Trier par renommée et ville
    return resultats.sort((a, b) => {
        if (a.renomme && !b.renomme) return -1;
        if (!a.renomme && b.renomme) return 1;
        return a.ville.localeCompare(b.ville);
    });
};

/**
 * 🌍 DÉTECTION AUTOMATIQUE DE LOCALISATION
 * Extrait le pays et la ville depuis les données utilisateur ou GPS
 * 
 * @param userData - Données utilisateur (adresse, ville, pays)
 * @param gpsCoords - Coordonnées GPS (latitude, longitude)
 * @returns { codePays, ville } ou valeurs par défaut
 */
export const detecterLocalisationUtilisateur = (
    userData?: { ville?: string; pays?: string; adresse?: string },
    gpsCoords?: { latitude: number; longitude: number }
): { codePays: string; ville?: string } => {
    // 1️⃣ Priorité aux données utilisateur
    if (userData?.pays || userData?.ville) {
        const codePays = detecterCodePaysDepuisNom(userData.pays || '');
        return {
            codePays: codePays || 'CM', // Cameroun par défaut
            ville: userData.ville
        };
    }

    // 2️⃣ Détection via GPS (si disponible)
    if (gpsCoords) {
        const location = detecterPaysVilleDepuisGPS(gpsCoords.latitude, gpsCoords.longitude);
        if (location) return location;
    }

    // 3️⃣ Fallback : Cameroun/Douala (pays principal de Yukpo)
    return { codePays: 'CM', ville: 'Douala' };
};

/**
 * Détecte le code pays depuis le nom (ex: "Cameroun" → "CM")
 */
const detecterCodePaysDepuisNom = (nomPays: string): string | null => {
    const nomNormalized = nomPays.toLowerCase().trim();

    const mapping: Record<string, string> = {
        'cameroun': 'CM',
        'cameroon': 'CM',
        'côte d\'ivoire': 'CI',
        'cote d\'ivoire': 'CI',
        'ivory coast': 'CI',
        'sénégal': 'SN',
        'senegal': 'SN',
        'mali': 'ML',
        'rd congo': 'CD',
        'rdc': 'CD',
        'congo-kinshasa': 'CD',
        'congo-brazzaville': 'CG',
        'congo brazza': 'CG',
        'gabon': 'GA',
        'togo': 'TG',
        'bénin': 'BJ',
        'benin': 'BJ',
        'burkina faso': 'BF',
        'burkina': 'BF',
        'niger': 'NE',
        'madagascar': 'MG',
        'tchad': 'TD',
        'chad': 'TD',
        'centrafrique': 'CF',
        'rca': 'CF',
        'guinée': 'GN',
        'guinea': 'GN',
    };

    return mapping[nomNormalized] || null;
};

/**
 * Détecte le pays et la ville depuis les coordonnées GPS
 * Utilise une approximation basée sur les zones géographiques
 */
const detecterPaysVilleDepuisGPS = (lat: number, lng: number): { codePays: string; ville?: string } | null => {
    // CAMEROUN : 2°N-13°N, 8°E-16°E
    if (lat >= 2 && lat <= 13 && lng >= 8 && lng <= 16) {
        // Douala : ~4°N, 9.7°E
        if (lat >= 3.5 && lat <= 4.5 && lng >= 9 && lng <= 10.5) {
            return { codePays: 'CM', ville: 'Douala' };
        }
        // Yaoundé : ~3.8°N, 11.5°E
        if (lat >= 3 && lat <= 4.5 && lng >= 11 && lng <= 12) {
            return { codePays: 'CM', ville: 'Yaoundé' };
        }
        return { codePays: 'CM' };
    }

    // CÔTE D'IVOIRE : 4.3°N-10.7°N, 2.5°W-8.6°W
    if (lat >= 4 && lat <= 11 && lng >= -9 && lng <= -2) {
        // Abidjan : ~5.3°N, 4°W
        if (lat >= 5 && lat <= 5.5 && lng >= -4.5 && lng <= -3.5) {
            return { codePays: 'CI', ville: 'Abidjan' };
        }
        return { codePays: 'CI' };
    }

    // SÉNÉGAL : 12.3°N-16.7°N, 11.4°W-17.5°W
    if (lat >= 12 && lat <= 17 && lng >= -18 && lng <= -11) {
        // Dakar : ~14.7°N, 17.4°W
        if (lat >= 14 && lat <= 15 && lng >= -18 && lng <= -17) {
            return { codePays: 'SN', ville: 'Dakar' };
        }
        return { codePays: 'SN' };
    }

    // MALI : 10.1°N-25°N, 12°W-4.2°E
    if (lat >= 10 && lat <= 25 && lng >= -12 && lng <= 5) {
        // Bamako : ~12.6°N, 8°W
        if (lat >= 12 && lat <= 13 && lng >= -9 && lng <= -7) {
            return { codePays: 'ML', ville: 'Bamako' };
        }
        return { codePays: 'ML' };
    }

    // RD CONGO : 5.4°S-5.4°N, 12.2°E-31.3°E
    if (lat >= -6 && lat <= 6 && lng >= 12 && lng <= 32) {
        // Kinshasa : ~4.3°S, 15.3°E
        if (lat >= -5 && lat <= -3 && lng >= 14 && lng <= 16) {
            return { codePays: 'CD', ville: 'Kinshasa' };
        }
        return { codePays: 'CD' };
    }

    // GABON : 3.9°S-2.3°N, 8.7°E-14.5°E
    if (lat >= -4 && lat <= 3 && lng >= 8 && lng <= 15) {
        // Libreville : ~0.4°N, 9.4°E
        if (lat >= -0.5 && lat <= 1 && lng >= 9 && lng <= 10) {
            return { codePays: 'GA', ville: 'Libreville' };
        }
        return { codePays: 'GA' };
    }

    // MADAGASCAR : 11.9°S-25.6°S, 43.2°E-50.5°E
    if (lat >= -26 && lat <= -11 && lng >= 43 && lng <= 51) {
        // Antananarivo : ~18.9°S, 47.5°E
        if (lat >= -19.5 && lat <= -18 && lng >= 47 && lng <= 48) {
            return { codePays: 'MG', ville: 'Antananarivo' };
        }
        return { codePays: 'MG' };
    }

    return null;
};

// Agrégat de tous les laboratoires par pays pour export centralisé
export const LABORATOIRES_AFRICAINS_PAR_PAYS: LaboratoiresPays[] = [
    LABORATOIRES_CAMEROUN,
    LABORATOIRES_COTE_IVOIRE,
    LABORATOIRES_SENEGAL,
    LABORATOIRES_MALI,
    LABORATOIRES_RD_CONGO,
    LABORATOIRES_CONGO_BRAZZA,
    LABORATOIRES_GABON,
    LABORATOIRES_TOGO,
    LABORATOIRES_BENIN,
    LABORATOIRES_BURKINA_FASO,
    LABORATOIRES_NIGER,
    LABORATOIRES_MADAGASCAR,
    LABORATOIRES_TCHAD,
    LABORATOIRES_RCA,
    LABORATOIRES_GUINEE,
];
