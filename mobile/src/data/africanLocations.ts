// ✅ SYSTÈME CENTRALISÉ DE LIEUX - AFRIQUE FRANCOPHONE COMPLÈTE
// Gestion intelligente des villes, quartiers et adresses pour tous les pays francophones d'Afrique

export interface QuartierInfo {
    nom: string;
    ville: string;
    pays: string;
    type?: 'Résidentiel' | 'Commercial' | 'Industriel' | 'Mixte';
}

export interface VilleInfo {
    nom: string;
    pays: string;
    estCapitale?: boolean;
    population?: string; // Pour tri par importance
    quartiers?: string[];
}

export interface PaysInfo {
    code: string; // Code pays ISO (CM, CI, SN, etc.)
    emoji: string; // \uD83C\uDDE8\uD83C\uDDF2, \uD83C\uDDE8\uD83C\uDDEE, etc.
    nom: string;
    nomComplet: string;
    capitale: string;
    villes: VilleInfo[];
}

// ============================================================================
// \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN - Le plus détaillé (pays principal de Yukpo)
// ============================================================================
export const CAMEROUN: PaysInfo = {
    code: 'CM',
    emoji: '\uD83C\uDDE8\uD83C\uDDF2',
    nom: 'Cameroun',
    nomComplet: 'République du Cameroun',
    capitale: 'Yaoundé',
    villes: [
        // Top 10 villes du Cameroun avec quartiers détaillés
        {
            nom: 'Douala',
            pays: 'Cameroun',
            population: '3000000',
            quartiers: [
                // Centre-ville et affaires
                'Akwa', 'Bonanjo', 'Bali', 'Bonapriso', 'Bonamoussadi',
                // Bonabéri (rive gauche)
                'Bonabéri', 'New Bell', 'Deido', 'Bépanda', 'Ndogbong',
                // Nord
                'Makepe', 'Logpom', 'Logbaba', 'Ndogpassi I', 'Ndogpassi II', 'Ndogpassi III',
                // Est
                'Kotto', 'PK8', 'PK10', 'PK11', 'PK12', 'PK14', 'PK17',
                // Zones résidentielles haut standing
                'Bessengue', 'Bonamoussadi Bel Air',
                // Sud
                'Village', 'Japoma', 'Yassa', 'Ndog-Bong', 'Ndogsimbi',
                // Ouest
                'Cité des Palmiers', 'Sonel', 'Camp Yabassi',
                // Autres
                'Bassa Industrial', 'Bonassama', 'Petit Pays', 'Mabanda', 'Mboppi', 'Omnisport'
            ]
        },
        {
            nom: 'Yaoundé',
            pays: 'Cameroun',
            estCapitale: true,
            population: '2500000',
            quartiers: [
                // Centre-ville
                'Centre-ville', 'Poste Centrale', 'Mvog-Ada',
                // Haut standing
                'Bastos', 'Nlongkak', 'Santa Barbara', 'Golf', 'Hippodrome',
                // Nord
                'Elig-Essono', 'Nkolbisson', 'Simbock', 'Odza', 'Nkoldongo',
                // Sud
                'Mfandena', 'Ngoa-Ekelle', 'Mvan', 'Ekounou', 'Elig-Edzoa',
                // Est
                'Nsimeyong', 'Briqueterie', 'Tsinga', 'Messa', 'Mvog-Mbi',
                // Ouest
                'Emana', 'Etoug-Ebe', 'Nkomo', 'Essos',
                // Autres zones résidentielles
                'Mokolo', 'Madagascar', 'Mendong', 'Obili', 'Omnisport', 'Mimboman'
            ]
        },
        {
            nom: 'Garoua',
            pays: 'Cameroun',
            population: '500000',
            quartiers: [
                'Centre-ville', 'Plateau', 'Ouro-Kessoum', 'Djamboutou', 'Balaré',
                'Demsa', 'Kollere', 'Roumdé Adjia', 'Doualaré', 'Mokolo'
            ]
        },
        {
            nom: 'Bafoussam',
            pays: 'Cameroun',
            population: '400000',
            quartiers: [
                'Centre-ville', 'Tamdja', 'Famla', 'Djeleng', 'Ngouache',
                'Tougang', 'Ndiandam', 'Kamkop', 'Université', 'Marché A'
            ]
        },
        {
            nom: 'Bamenda',
            pays: 'Cameroun',
            population: '350000',
            quartiers: [
                'Commercial Avenue', 'Up Station', 'Ntarikon', 'Nkwen', 'Mankon',
                'Mulang', 'Mile 4', 'Cow Street', 'Ntamulung', 'Bambili'
            ]
        },
        {
            nom: 'Maroua',
            pays: 'Cameroun',
            population: '300000',
            quartiers: [
                'Centre-ville', 'Domayo', 'Dougoï', 'Hardé', 'Pitoaré',
                'Dougoy', 'Founangué', 'Zokok', 'Makabaye', 'Djiddéré'
            ]
        },
        {
            nom: 'Ngaoundéré',
            pays: 'Cameroun',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Dang', 'Bamyanga', 'Mabanga', 'Haoussa',
                'Sabongari', 'Plateau', 'Baladji', 'Petit Marché', 'Grand Marché'
            ]
        },
        {
            nom: 'Bertoua',
            pays: 'Cameroun',
            population: '200000',
            quartiers: [
                'Centre-ville', 'Mokolo', 'Ngoyang', 'Mofou', 'Ndjore',
                'Bélabo Road', 'Petit Pol', 'Carrière', 'Somalomo', 'Plateau'
            ]
        },
        {
            nom: 'Ebolowa',
            pays: 'Cameroun',
            population: '150000',
            quartiers: [
                'Centre-ville', 'Angale', 'Efoulan', 'Mbalmayo Road', 'Nkoabang',
                'Nkolandom', 'Nkolemvin', 'Meyo', 'Ongot', 'Nko\'ovos'
            ]
        },
        {
            nom: 'Kribi',
            pays: 'Cameroun',
            population: '100000',
            quartiers: [
                'Centre-ville', 'Mokolo', 'Bord de mer', 'Grand Batanga', 'Mboro',
                'Eboundja', 'Nziou', 'Plateau', 'Londji', 'Mpolongwé'
            ]
        },
        // Autres villes importantes (sans quartiers détaillés)
        { nom: 'Kumba', pays: 'Cameroun', population: '150000' },
        { nom: 'Limbe', pays: 'Cameroun', population: '120000' },
        { nom: 'Buea', pays: 'Cameroun', population: '100000' },
        { nom: 'Nkongsamba', pays: 'Cameroun', population: '100000' },
        { nom: 'Édéa', pays: 'Cameroun', population: '80000' },
        { nom: 'Mbalmayo', pays: 'Cameroun', population: '70000' },
        { nom: 'Sangmélima', pays: 'Cameroun', population: '60000' },
        { nom: 'Abong-Mbang', pays: 'Cameroun', population: '50000' },
        { nom: 'Dschang', pays: 'Cameroun', population: '90000' },
        { nom: 'Foumban', pays: 'Cameroun', population: '80000' },
        { nom: 'Loum', pays: 'Cameroun', population: '50000' },
        { nom: 'Mbanga', pays: 'Cameroun', population: '45000' },
        { nom: 'Obala', pays: 'Cameroun', population: '40000' },
    ]
};

// ============================================================================
// \uD83C\uDDE8\uD83C\uDDE9 RDC - RÉPUBLIQUE DÉMOCRATIQUE DU CONGO
// ============================================================================
export const RDC: PaysInfo = {
    code: 'CD',
    emoji: '\uD83C\uDDE8\uD83C\uDDE9',
    nom: 'RDC',
    nomComplet: 'République Démocratique du Congo',
    capitale: 'Kinshasa',
    villes: [
        {
            nom: 'Kinshasa',
            pays: 'RDC',
            estCapitale: true,
            population: '15000000',
            quartiers: [
                // Centre-ville et Gombe
                'Gombe', 'Centre-ville', 'Kinshasa', 'Kalamu', 'Barumbu',
                // Nord
                'Ngaliema', 'Binza', 'Mont Ngafula', 'Selembao', 'Lemba',
                // Est
                'Kintambo', 'Lingwala', 'Kinshasa', 'Bandalungwa', 'Bumbu',
                // Sud
                'Makala', 'Kimbanseke', 'Masina', 'Ndjili', 'Nsele',
                // Communes populaires
                'Matete', 'Ngiri-Ngiri', 'Limete', 'Kisenso', 'Makala'
            ]
        },
        {
            nom: 'Lubumbashi',
            pays: 'RDC',
            population: '2500000',
            quartiers: [
                'Centre-ville', 'Kenya', 'Kampemba', 'Katuba', 'Ruashi',
                'Annexe', 'Lubumbashi', 'Kasapa', 'Kamalondo', 'Golf'
            ]
        },
        {
            nom: 'Mbuji-Mayi',
            pays: 'RDC',
            population: '2000000',
            quartiers: [
                'Centre-ville', 'Dibindi', 'Bonzola', 'Bipemba', 'Kanshi',
                'Dikelenge', 'Nzaba', 'Tshilenge', 'Muya', 'Tshiamala'
            ]
        },
        {
            nom: 'Kananga',
            pays: 'RDC',
            population: '1500000',
            quartiers: [
                'Centre-ville', 'Kananga I', 'Kananga II', 'Ndesha', 'Katoka',
                'Lukonga', 'Nganza', 'Kabianga', 'Mikalayi', 'Tshibangu'
            ]
        },
        {
            nom: 'Kisangani',
            pays: 'RDC',
            population: '1200000',
            quartiers: [
                'Centre-ville', 'Makiso', 'Tshopo', 'Kabondo', 'Mangobo',
                'Lubunga', 'Kisangani', 'Plateau', 'Simisini', 'Bangboka'
            ]
        },
        {
            nom: 'Bukavu',
            pays: 'RDC',
            population: '1000000',
            quartiers: [
                'Centre-ville', 'Kadutu', 'Ibanda', 'Bagira', 'Nyalukemba',
                'Panzi', 'Essence', 'Mulengeza', 'Nyamirambo', 'Ciriri'
            ]
        },
        {
            nom: 'Goma',
            pays: 'RDC',
            population: '700000',
            quartiers: [
                'Centre-ville', 'Himbi', 'Murara', 'Ndosho', 'Les Volcans',
                'Kyeshero', 'Majengo', 'Virunga', 'Bujovu', 'Kahembe'
            ]
        },
        {
            nom: 'Kolwezi',
            pays: 'RDC',
            population: '500000',
            quartiers: [
                'Centre-ville', 'Manika', 'Mutoshi', 'Dilala', 'Kasulo',
                'Luilu', 'Kapata', 'Mwangeji', 'Safricas', 'Sociale'
            ]
        },
        {
            nom: 'Matadi',
            pays: 'RDC',
            population: '400000',
            quartiers: [
                'Centre-ville', 'Camp Matadi', 'Nkundi', 'Mvuzi', 'Kinkanda',
                'Plateau', 'Port', 'Matadi-Mayo', 'Nzadi', 'Kinkenge'
            ]
        },
        {
            nom: 'Likasi',
            pays: 'RDC',
            population: '400000',
            quartiers: [
                'Centre-ville', 'Shituru', 'Panda', 'Kafubu', 'Kikula',
                'Kabambankola', 'Kakontwe', 'Golf', 'Carré', 'Luwowoshi'
            ]
        },
        // Autres villes importantes
        { nom: 'Mbandaka', pays: 'RDC', population: '350000' },
        { nom: 'Beni', pays: 'RDC', population: '300000' },
        { nom: 'Butembo', pays: 'RDC', population: '300000' },
        { nom: 'Kikwit', pays: 'RDC', population: '250000' },
        { nom: 'Uvira', pays: 'RDC', population: '200000' },
    ]
};

// ============================================================================
// \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE
// ============================================================================
export const COTE_IVOIRE: PaysInfo = {
    code: 'CI',
    emoji: '\uD83C\uDDE8\uD83C\uDDEE',
    nom: 'Côte d\'Ivoire',
    nomComplet: 'République de Côte d\'Ivoire',
    capitale: 'Yamoussoukro',
    villes: [
        {
            nom: 'Abidjan',
            pays: 'Côte d\'Ivoire',
            population: '5000000',
            quartiers: [
                // Plateau (centre des affaires)
                'Plateau', 'Cocody', 'Marcory', 'Treichville', 'Adjamé',
                // Zones résidentielles
                'Yopougon', 'Abobo', 'Koumassi', 'Port-Bouët', 'Attécoubé',
                // Haut standing
                'Riviera', 'Deux Plateaux', 'Angré', 'Zone 4', 'Vallon',
                // Autres
                'Williamsville', 'Bingerville', 'Songon', 'Anyama', 'Grand-Bassam'
            ]
        },
        {
            nom: 'Yamoussoukro',
            pays: 'Côte d\'Ivoire',
            estCapitale: true,
            population: '300000',
            quartiers: [
                'Centre-ville', 'Habitat', 'Dioulakro', 'N\'Zuessy', 'Morofé',
                'Assabou', 'Kokrenou', 'Nanan', 'Sokourala', 'Terminus'
            ]
        },
        {
            nom: 'Bouaké',
            pays: 'Côte d\'Ivoire',
            population: '700000',
            quartiers: [
                'Centre-ville', 'Commerce', 'Dar-es-Salam', 'Kennedy', 'Koko',
                'Air France', 'Belleville', 'Nimbo', 'Gonfreville', 'Broukro'
            ]
        },
        {
            nom: 'Daloa',
            pays: 'Côte d\'Ivoire',
            population: '300000',
            quartiers: [
                'Centre-ville', 'Lobia', 'Tazibouo', 'Orly', 'Maminigui',
                'Commerce', 'Garage', 'Plateau', 'Kennedy', 'Marché'
            ]
        },
        {
            nom: 'San-Pédro',
            pays: 'Côte d\'Ivoire',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Bardot', 'Balmer', 'Plateau', 'Séwéké',
                'Bardo', 'Cité', 'Port', 'Béago', 'Mono'
            ]
        },
        {
            nom: 'Korhogo',
            pays: 'Côte d\'Ivoire',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Koko', 'Soba', 'Petit Paris', 'Sinistré',
                'Air France', 'Tchengueré', 'Résidentiel', 'Koko', 'Commerce'
            ]
        },
        {
            nom: 'Man',
            pays: 'Côte d\'Ivoire',
            population: '150000',
            quartiers: [
                'Centre-ville', 'Libreville', 'Plateau', 'Dogomet', 'Djironle',
                'Fengolo', 'Commerce', 'Madinani', 'Gbangbegouine', 'Sagbé'
            ]
        },
        {
            nom: 'Gagnoa',
            pays: 'Côte d\'Ivoire',
            population: '150000',
            quartiers: [
                'Centre-ville', 'Commerce', 'Dioulabougou', 'Gnagboya', 'Bayota',
                'Gare', 'Marché', 'Plateau', 'Aviation', 'Kennedy'
            ]
        },
        {
            nom: 'Divo',
            pays: 'Côte d\'Ivoire',
            population: '130000',
            quartiers: [
                'Centre-ville', 'Lobia', 'Commerce', 'Gare', 'Plateau',
                'Socotra', 'Dioulakro', 'Marché', 'Djapadji', 'Kennedy'
            ]
        },
        {
            nom: 'Abengourou',
            pays: 'Côte d\'Ivoire',
            population: '120000',
            quartiers: [
                'Centre-ville', 'Commerce', 'Amanvi', 'Assabou', 'N\'Dendé',
                'Plateau', 'Gare', 'Marché', 'Kennedy', 'Aboudé'
            ]
        },
        // Autres villes
        { nom: 'Soubré', pays: 'Côte d\'Ivoire', population: '100000' },
        { nom: 'Agboville', pays: 'Côte d\'Ivoire', population: '100000' },
        { nom: 'Anyama', pays: 'Côte d\'Ivoire', population: '90000' },
        { nom: 'Dabou', pays: 'Côte d\'Ivoire', population: '80000' },
    ]
};

// ============================================================================
// \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL
// ============================================================================
export const SENEGAL: PaysInfo = {
    code: 'SN',
    emoji: '\uD83C\uDDF8\uD83C\uDDF3',
    nom: 'Sénégal',
    nomComplet: 'République du Sénégal',
    capitale: 'Dakar',
    villes: [
        {
            nom: 'Dakar',
            pays: 'Sénégal',
            estCapitale: true,
            population: '3000000',
            quartiers: [
                // Centre et Plateau
                'Plateau', 'Médina', 'Gueule Tapée', 'Fass', 'Colobane',
                // Haut standing
                'Almadies', 'Ngor', 'Ouakam', 'Mermoz', 'Sacré-Cœur',
                // Populaires
                'Parcelles Assainies', 'Grand Yoff', 'HLM', 'Liberté', 'Point E',
                // Banlieue
                'Pikine', 'Guédiawaye', 'Rufisque', 'Thiaroye', 'Yeumbeul'
            ]
        },
        {
            nom: 'Thiès',
            pays: 'Sénégal',
            population: '400000',
            quartiers: [
                'Centre-ville', 'Médina Fall', 'Randoulène', 'Cité Lamy', 'Hersent',
                'Nguinth', 'Sampathé', 'Khaly Amar Fall', 'Cité Rail', 'Ballabougou'
            ]
        },
        {
            nom: 'Touba',
            pays: 'Sénégal',
            population: '1000000',
            quartiers: [
                'Centre-ville', 'Darou Marnane', 'Darou Khoudoss', 'Touba Mosquée', 'Ndamatou',
                'Darou Tanzil', 'Darou Nahim', 'Gouye Mbind', 'Keur Niang', 'Belel'
            ]
        },
        {
            nom: 'Kaolack',
            pays: 'Sénégal',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Médina', 'Léona', 'Dialègne', 'Ndorong',
                'Touba Kaolack', 'Sam Notaire', 'Ngané', 'Sibassor', 'Kahone'
            ]
        },
        {
            nom: 'Saint-Louis',
            pays: 'Sénégal',
            population: '250000',
            quartiers: [
                'Île de Saint-Louis', 'Sor', 'Balacoss', 'Ndiolofène', 'Diamaguène',
                'Léona', 'Pikine', 'Diaminar', 'Eaux Claires', 'Darou'
            ]
        },
        {
            nom: 'Mbour',
            pays: 'Sénégal',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Santhie', 'Médina', 'Thiocé', 'Gouye Mouride',
                'Téfess', 'Diamaguène', 'Mbour Sérère', 'Escale', 'Point E'
            ]
        },
        {
            nom: 'Ziguinchor',
            pays: 'Sénégal',
            population: '200000',
            quartiers: [
                'Centre-ville', 'Boucotte', 'Kandé', 'Tilène', 'Lyndiane',
                'Néma', 'Djibélor', 'Santhiaba', 'Kansahoudy', 'Belfort'
            ]
        },
        {
            nom: 'Kolda',
            pays: 'Sénégal',
            population: '80000',
            quartiers: [
                'Centre-ville', 'Saré Kémo', 'Saré Moussa', 'Gadapara', 'Sikilo',
                'Dialambéré', 'Saré Yoba', 'Doumassou', 'Saré Boubou', 'Médina'
            ]
        },
        {
            nom: 'Diourbel',
            pays: 'Sénégal',
            population: '150000',
            quartiers: [
                'Centre-ville', 'Ndame', 'Ndieyène Sirakh', 'Keur Samba Kane', 'Gawane',
                'Nguélème', 'Tocky Gare', 'Sam Notaire', 'Escale', 'Madina'
            ]
        },
        {
            nom: 'Louga',
            pays: 'Sénégal',
            population: '100000',
            quartiers: [
                'Centre-ville', 'Médina', 'Keur Serigne Louga', 'Diamaguène', 'Artillerie',
                'Nguélème', 'Escale', 'Gare', 'Thialy', 'Darou'
            ]
        },
        // Autres villes
        { nom: 'Tambacounda', pays: 'Sénégal', population: '80000' },
        { nom: 'Sédhiou', pays: 'Sénégal', population: '30000' },
        { nom: 'Matam', pays: 'Sénégal', population: '25000' },
        { nom: 'Kédougou', pays: 'Sénégal', population: '20000' },
    ]
};

// ============================================================================
// \uD83C\uDDF2\uD83C\uDDF1 MALI
// ============================================================================
export const MALI: PaysInfo = {
    code: 'ML',
    emoji: '\uD83C\uDDF2\uD83C\uDDF1',
    nom: 'Mali',
    nomComplet: 'République du Mali',
    capitale: 'Bamako',
    villes: [
        {
            nom: 'Bamako',
            pays: 'Mali',
            estCapitale: true,
            population: '2500000',
            quartiers: [
                // Centre et Communes
                'Commune I', 'Commune II', 'Commune III', 'Commune IV', 'Commune V', 'Commune VI',
                // Quartiers populaires
                'Badalabougou', 'Hippodrome', 'Hamdallaye', 'Lafiabougou', 'Magnambougou',
                // Quartiers résidentiels
                'ACI 2000', 'Baco-Djicoroni', 'Niamakoro', 'Sabalibougou', 'Kalaban-Coura'
            ]
        },
        {
            nom: 'Sikasso',
            pays: 'Mali',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Lafiabougou', 'Médine', 'Wayerma', 'Lafiabougou',
                'Plateau', 'Lafiabougou I', 'Lafiabougou II', 'Missira', 'Doumanaba'
            ]
        },
        {
            nom: 'Mopti',
            pays: 'Mali',
            population: '150000',
            quartiers: [
                'Centre-ville', 'Komoguel', 'Mossinkoré', 'Toguel', 'Bougoufié',
                'Fangasso', 'Gangal', 'Médine', 'Souaré', 'Wellingara'
            ]
        },
        {
            nom: 'Kayes',
            pays: 'Mali',
            population: '130000',
            quartiers: [
                'Centre-ville', 'Liberté', 'Plateau', 'Khasso', 'Djikoroni',
                'Kayes-Centre', 'Extension', 'Médine', 'Kounima', 'Liberté Extension'
            ]
        },
        {
            nom: 'Ségou',
            pays: 'Mali',
            population: '130000',
            quartiers: [
                'Centre-ville', 'Pelengana', 'Dar Salam', 'Hamdallaye', 'Médine',
                'Missira', 'Sokaladji', 'Bagadadji', 'Angouleme', 'Sonincoura'
            ]
        },
        {
            nom: 'Gao',
            pays: 'Mali',
            population: '90000',
            quartiers: [
                'Centre-ville', 'Château', 'Djemdjella', 'Sosso-Koïra', 'Gourmadji',
                'Boulgoundjé', 'Château-Nord', 'Plateau', 'Extension', 'Médine'
            ]
        },
        {
            nom: 'Koutiala',
            pays: 'Mali',
            population: '140000',
            quartiers: [
                'Centre-ville', 'N\'Tomikorobougou', 'Fougabougou', 'Sogoniko', 'Missiridjè',
                'Sinzani', 'Soninkoura', 'Djoliba', 'Plateau', 'Extension'
            ]
        },
        {
            nom: 'Tombouctou',
            pays: 'Mali',
            population: '60000',
            quartiers: [
                'Centre-ville', 'Abaradjou', 'Bella Farandi', 'Hamabangou', 'Djingareyber',
                'Sankoré', 'Sidi Yahia', 'Badjindé', 'Sareyamou', 'Kabara'
            ]
        },
        {
            nom: 'Kidal',
            pays: 'Mali',
            population: '30000',
            quartiers: [
                'Centre-ville', 'Plateau', 'Extension', 'Médine', 'Quartier Nord',
                'Quartier Sud', 'Quartier Est', 'Quartier Ouest', 'Camp', 'Aéroport'
            ]
        },
        {
            nom: 'Koulikoro',
            pays: 'Mali',
            population: '50000',
            quartiers: [
                'Centre-ville', 'N\'Tji', 'Korofina', 'Somadougou', 'Koumi',
                'Plateau', 'Extension', 'Médine', 'Port', 'Gare'
            ]
        },
        // Autres villes
        { nom: 'San', pays: 'Mali', population: '70000' },
        { nom: 'Kati', pays: 'Mali', population: '60000' },
        { nom: 'Djenné', pays: 'Mali', population: '20000' },
    ]
};

// ============================================================================
// AUTRES PAYS (ajout progressif avec moins de détails)
// ============================================================================

// \uD83C\uDDE7\uD83C\uDDEB BURKINA FASO
export const BURKINA_FASO: PaysInfo = {
    code: 'BF',
    emoji: '\uD83C\uDDE7\uD83C\uDDEB',
    nom: 'Burkina Faso',
    nomComplet: 'Burkina Faso',
    capitale: 'Ouagadougou',
    villes: [
        {
            nom: 'Ouagadougou',
            pays: 'Burkina Faso',
            estCapitale: true,
            population: '2500000',
            quartiers: [
                'Centre-ville', 'Zone 1', 'Zone 4', 'Gounghin', 'Cissin',
                'Paspanga', 'Dapoya', 'Tampui', 'Koulouba', 'Somgandé',
                'Ouaga 2000', 'Hamdalaye', 'Samandin', 'Tanghin', 'Balkuy'
            ]
        },
        {
            nom: 'Bobo-Dioulasso',
            pays: 'Burkina Faso',
            population: '900000',
            quartiers: [
                'Centre-ville', 'Accart-Ville', 'Koko', 'Sarfalao', 'Tounouma',
                'Belleville', 'Nieneta', 'Dioulassoba', 'Lafiabougou', 'Bindougousso'
            ]
        },
        { nom: 'Koudougou', pays: 'Burkina Faso', population: '150000' },
        { nom: 'Banfora', pays: 'Burkina Faso', population: '100000' },
        { nom: 'Ouahigouya', pays: 'Burkina Faso', population: '100000' },
        { nom: 'Kaya', pays: 'Burkina Faso', population: '60000' },
        { nom: 'Tenkodogo', pays: 'Burkina Faso', population: '60000' },
        { nom: 'Fada N\'Gourma', pays: 'Burkina Faso', population: '50000' },
        { nom: 'Dédougou', pays: 'Burkina Faso', population: '50000' },
        { nom: 'Gaoua', pays: 'Burkina Faso', population: '40000' },
    ]
};

// \uD83C\uDDF3\uD83C\uDDEA NIGER
export const NIGER: PaysInfo = {
    code: 'NE',
    emoji: '\uD83C\uDDF3\uD83C\uDDEA',
    nom: 'Niger',
    nomComplet: 'République du Niger',
    capitale: 'Niamey',
    villes: [
        {
            nom: 'Niamey',
            pays: 'Niger',
            estCapitale: true,
            population: '1300000',
            quartiers: [
                'Plateau', 'Yantala', 'Koira Kano', 'Kirkissoye', 'Lazaret',
                'Cite Caisse', 'Talladjé', 'Gamkalley', 'Niamey 2000', 'Goudel',
                'Lamordé', 'Commune I', 'Commune II', 'Commune III', 'Commune IV'
            ]
        },
        {
            nom: 'Zinder',
            pays: 'Niger',
            population: '300000',
            quartiers: [
                'Centre-ville', 'Birni', 'Sabon Gari', 'Zengou', 'Karkada',
                'Garin Malam', 'Zinder-Centre', 'Quartier Administratif', 'Nouveau Carré', 'Haut Plateau'
            ]
        },
        { nom: 'Maradi', pays: 'Niger', population: '250000' },
        { nom: 'Agadez', pays: 'Niger', population: '120000' },
        { nom: 'Tahoua', pays: 'Niger', population: '120000' },
        { nom: 'Diffa', pays: 'Niger', population: '50000' },
        { nom: 'Dosso', pays: 'Niger', population: '50000' },
        { nom: 'Tillabéry', pays: 'Niger', population: '30000' },
        { nom: 'Arlit', pays: 'Niger', population: '100000' },
        { nom: 'Nguigmi', pays: 'Niger', population: '40000' },
    ]
};

// \uD83C\uDDF9\uD83C\uDDE9 TCHAD
export const TCHAD: PaysInfo = {
    code: 'TD',
    emoji: '\uD83C\uDDF9\uD83C\uDDE9',
    nom: 'Tchad',
    nomComplet: 'République du Tchad',
    capitale: 'N\'Djamena',
    villes: [
        {
            nom: 'N\'Djamena',
            pays: 'Tchad',
            estCapitale: true,
            population: '1400000',
            quartiers: [
                'Centre-ville', 'Moursal', 'Chagoua', 'Bololo', 'Ardep Djoumal',
                'Abéché', 'Kabalaye', 'Walia', 'Diguel', 'Ridina',
                'Ngueli', 'Sabangali', 'Amtoukoui', 'Gardolé', 'Farcha'
            ]
        },
        {
            nom: 'Moundou',
            pays: 'Tchad',
            population: '150000',
            quartiers: [
                'Centre-ville', 'Doyaba', 'Quartier Résidentiel', 'Quartier Koza', 'Bebidja',
                'Lamadji', 'Marché', 'Mballé', 'Békan', 'Bekourou'
            ]
        },
        { nom: 'Abéché', pays: 'Tchad', population: '100000' },
        { nom: 'Sarh', pays: 'Tchad', population: '100000' },
        { nom: 'Kélo', pays: 'Tchad', population: '60000' },
        { nom: 'Koumra', pays: 'Tchad', population: '40000' },
        { nom: 'Pala', pays: 'Tchad', population: '40000' },
        { nom: 'Am Timan', pays: 'Tchad', population: '30000' },
        { nom: 'Bongor', pays: 'Tchad', population: '30000' },
        { nom: 'Mongo', pays: 'Tchad', population: '30000' },
    ]
};

// \uD83C\uDDEC\uD83C\uDDF3 GUINÉE
export const GUINEE: PaysInfo = {
    code: 'GN',
    emoji: '\uD83C\uDDEC\uD83C\uDDF3',
    nom: 'Guinée',
    nomComplet: 'République de Guinée',
    capitale: 'Conakry',
    villes: [
        {
            nom: 'Conakry',
            pays: 'Guinée',
            estCapitale: true,
            population: '2000000',
            quartiers: [
                'Kaloum', 'Dixinn', 'Ratoma', 'Matam', 'Matoto',
                'Minière', 'Camayenne', 'Hamdallaye', 'Landreah', 'Lambanyi',
                'Taouyah', 'Coronthie', 'Kipé', 'Cosa', 'Bambeto'
            ]
        },
        {
            nom: 'Nzérékoré',
            pays: 'Guinée',
            population: '200000',
            quartiers: [
                'Centre-ville', 'Sopono', 'Marché', 'Forêt', 'Commune Urbaine',
                'Koidou', 'Gouécké', 'Quartier Rond Point', 'Orémai', 'Petit Bardot'
            ]
        },
        { nom: 'Kankan', pays: 'Guinée', population: '200000' },
        { nom: 'Kindia', pays: 'Guinée', population: '150000' },
        { nom: 'Labé', pays: 'Guinée', population: '100000' },
        { nom: 'Mamou', pays: 'Guinée', population: '100000' },
        { nom: 'Boké', pays: 'Guinée', population: '80000' },
        { nom: 'Siguiri', pays: 'Guinée', population: '50000' },
        { nom: 'Kissidougou', pays: 'Guinée', population: '100000' },
        { nom: 'Dabola', pays: 'Guinée', population: '30000' },
    ]
};

// \uD83C\uDDE7\uD83C\uDDEF BÉNIN
export const BENIN: PaysInfo = {
    code: 'BJ',
    emoji: '\uD83C\uDDE7\uD83C\uDDEF',
    nom: 'Bénin',
    nomComplet: 'République du Bénin',
    capitale: 'Porto-Novo',
    villes: [
        {
            nom: 'Cotonou',
            pays: 'Bénin',
            population: '700000',
            quartiers: [
                'Centre-ville', 'Jonquet', 'Akpakpa', 'Cadjèhoun', 'Vossa',
                'Fidjrossè', 'Godomey', 'Pk3', 'Pk10', 'Pk14',
                'Agla', 'Zogbo', 'Sikècodji', 'Aidjedo', 'Sèmè'
            ]
        },
        {
            nom: 'Porto-Novo',
            pays: 'Bénin',
            estCapitale: true,
            population: '300000',
            quartiers: [
                'Centre-ville', 'Djègan', 'Tokpota', 'Ouando', 'Ahouandjinou',
                'Avassa', 'Houinmè', 'Banigbé', 'Dowa', 'Agbokou'
            ]
        },
        {
            nom: 'Parakou',
            pays: 'Bénin',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Banikanni', 'Guéma', 'Kaboli', 'Titirou',
                'Bonhicon', 'Sounon Sannou', 'Soumarou', 'Soure', 'Daro'
            ]
        },
        { nom: 'Abomey-Calavi', pays: 'Bénin', population: '700000' },
        { nom: 'Djougou', pays: 'Bénin', population: '240000' },
        { nom: 'Bohicon', pays: 'Bénin', population: '170000' },
        { nom: 'Kandi', pays: 'Bénin', population: '170000' },
        { nom: 'Lokossa', pays: 'Bénin', population: '110000' },
        { nom: 'Ouidah', pays: 'Bénin', population: '100000' },
        { nom: 'Abomey', pays: 'Bénin', population: '90000' },
    ]
};

// \uD83C\uDDF9\uD83C\uDDEC TOGO
export const TOGO: PaysInfo = {
    code: 'TG',
    emoji: '\uD83C\uDDF9\uD83C\uDDEC',
    nom: 'Togo',
    nomComplet: 'République Togolaise',
    capitale: 'Lomé',
    villes: [
        {
            nom: 'Lomé',
            pays: 'Togo',
            estCapitale: true,
            population: '2000000',
            quartiers: [
                'Centre-ville', 'Bè', 'Tokoin', 'Nyékonakpoè', 'Adidogomé',
                'Agoè', 'Kégué', 'Amadahomé', 'Cacavéli', 'Hédzranawoé',
                'Gbényédzi', 'Démakpoè', 'Djidjolé', 'Kodjoviakopé', 'Agbalépédogan'
            ]
        },
        {
            nom: 'Sokodé',
            pays: 'Togo',
            population: '120000',
            quartiers: [
                'Centre-ville', 'Komah', 'Katchamba', 'Didaure', 'Kaboli',
                'Tchaoudjo', 'Lassa', 'Kpangalam', 'Kèwè', 'Gbékémé'
            ]
        },
        {
            nom: 'Kara',
            pays: 'Togo',
            population: '100000',
            quartiers: [
                'Centre-ville', 'Tomdè', 'Sarakawa', 'Lassa', 'Pya',
                'Lama-Tessi', 'Kétao', 'Tomdè II', 'Nadoba', 'Kakissi'
            ]
        },
        { nom: 'Kpalimé', pays: 'Togo', population: '100000' },
        { nom: 'Atakpamé', pays: 'Togo', population: '80000' },
        { nom: 'Bassar', pays: 'Togo', population: '70000' },
        { nom: 'Tsévié', pays: 'Togo', population: '60000' },
        { nom: 'Aného', pays: 'Togo', population: '50000' },
        { nom: 'Dapaong', pays: 'Togo', population: '60000' },
        { nom: 'Mango', pays: 'Togo', population: '40000' },
    ]
};

// \uD83C\uDDE8\uD83C\uDDEC CONGO-BRAZZAVILLE
export const CONGO_BRAZZAVILLE: PaysInfo = {
    code: 'CG',
    emoji: '\uD83C\uDDE8\uD83C\uDDEC',
    nom: 'Congo-Brazzaville',
    nomComplet: 'République du Congo',
    capitale: 'Brazzaville',
    villes: [
        {
            nom: 'Brazzaville',
            pays: 'Congo-Brazzaville',
            estCapitale: true,
            population: '2000000',
            quartiers: [
                'Centre-ville', 'Poto-Poto', 'Moungali', 'Ouenzé', 'Bacongo',
                'Makélékélé', 'Madibou', 'Mfilou', 'Djiri', 'Talangaï',
                'Plateau des 15 ans', 'M\'Pila', 'Ngamakosso', 'Mpissa', 'Kombo'
            ]
        },
        {
            nom: 'Pointe-Noire',
            pays: 'Congo-Brazzaville',
            population: '1200000',
            quartiers: [
                'Centre-ville', 'Lumumba', 'Loandjili', 'Ngoyo', 'Mvou-Mvou',
                'Tié-Tié', 'Tchimbamba', 'Mongo-Mpoukou', 'Fond Tié-Tié', 'Siafoumou',
                'Mpaka', 'Songolo', 'Mvoumvou', 'Mayanga', 'Vindoulou'
            ]
        },
        { nom: 'Dolisie', pays: 'Congo-Brazzaville', population: '100000' },
        { nom: 'Nkayi', pays: 'Congo-Brazzaville', population: '80000' },
        { nom: 'Impfondo', pays: 'Congo-Brazzaville', population: '30000' },
        { nom: 'Ouesso', pays: 'Congo-Brazzaville', population: '30000' },
        { nom: 'Owando', pays: 'Congo-Brazzaville', population: '25000' },
        { nom: 'Madingou', pays: 'Congo-Brazzaville', population: '20000' },
        { nom: 'Kinkala', pays: 'Congo-Brazzaville', population: '20000' },
        { nom: 'Sibiti', pays: 'Congo-Brazzaville', population: '20000' },
    ]
};

// \uD83C\uDDEC\uD83C\uDDE6 GABON
export const GABON: PaysInfo = {
    code: 'GA',
    emoji: '\uD83C\uDDEC\uD83C\uDDE6',
    nom: 'Gabon',
    nomComplet: 'République Gabonaise',
    capitale: 'Libreville',
    villes: [
        {
            nom: 'Libreville',
            pays: 'Gabon',
            estCapitale: true,
            population: '800000',
            quartiers: [
                'Centre-ville', 'Oloumi', 'Akébé', 'Lalala', 'Nzeng-Ayong',
                'Ondogho', 'Alibandeng', 'Batterie IV', 'PK5', 'PK8',
                'PK9', 'PK12', 'Nkembo', 'Glass', 'Mont-Bouët'
            ]
        },
        {
            nom: 'Port-Gentil',
            pays: 'Gabon',
            population: '140000',
            quartiers: [
                'Centre-ville', 'Cité', 'Normandie', 'Cocotier', 'Moukoundji',
                'Mboukou', 'Grand Village', 'PK4', 'PK8', 'Balise'
            ]
        },
        {
            nom: 'Franceville',
            pays: 'Gabon',
            population: '110000',
            quartiers: [
                'Centre-ville', 'Ondili', 'Potos', 'Bangué', 'Quartier 1',
                'Quartier 2', 'Quartier 3', 'Moundzi', 'Plateau', 'Ambassadeurs'
            ]
        },
        { nom: 'Oyem', pays: 'Gabon', population: '60000' },
        { nom: 'Moanda', pays: 'Gabon', population: '50000' },
        { nom: 'Mouila', pays: 'Gabon', population: '50000' },
        { nom: 'Lambaréné', pays: 'Gabon', population: '40000' },
        { nom: 'Tchibanga', pays: 'Gabon', population: '30000' },
        { nom: 'Koulamoutou', pays: 'Gabon', population: '20000' },
        { nom: 'Makokou', pays: 'Gabon', population: '20000' },
    ]
};

// \uD83C\uDDE8\uD83C\uDDEB CENTRAFRIQUE
export const CENTRAFRIQUE: PaysInfo = {
    code: 'CF',
    emoji: '\uD83C\uDDE8\uD83C\uDDEB',
    nom: 'Centrafrique',
    nomComplet: 'République Centrafricaine',
    capitale: 'Bangui',
    villes: [
        {
            nom: 'Bangui',
            pays: 'Centrafrique',
            estCapitale: true,
            population: '900000',
            quartiers: [
                'Centre-ville', 'PK5', 'Boeing', 'Fatima', 'KM5',
                'Gobongo', 'Lakouanga', 'Boy-Rabe', 'Combattant', 'Ouango',
                'Damala', 'Kokoro', 'Miskine', 'Fouh', 'Kembé'
            ]
        },
        { nom: 'Bimbo', pays: 'Centrafrique', population: '300000' },
        { nom: 'Berbérati', pays: 'Centrafrique', population: '80000' },
        { nom: 'Carnot', pays: 'Centrafrique', population: '50000' },
        { nom: 'Bambari', pays: 'Centrafrique', population: '50000' },
        { nom: 'Bouar', pays: 'Centrafrique', population: '40000' },
        { nom: 'Bossangoa', pays: 'Centrafrique', population: '40000' },
        { nom: 'Bria', pays: 'Centrafrique', population: '35000' },
        { nom: 'Bangassou', pays: 'Centrafrique', population: '30000' },
        { nom: 'Nola', pays: 'Centrafrique', population: '30000' },
    ]
};

// \uD83C\uDDF2\uD83C\uDDEC MADAGASCAR
export const MADAGASCAR: PaysInfo = {
    code: 'MG',
    emoji: '\uD83C\uDDF2\uD83C\uDDEC',
    nom: 'Madagascar',
    nomComplet: 'République de Madagascar',
    capitale: 'Antananarivo',
    villes: [
        {
            nom: 'Antananarivo',
            pays: 'Madagascar',
            estCapitale: true,
            population: '3000000',
            quartiers: [
                'Haute-Ville', 'Analakely', 'Isotry', 'Antaninarenina', 'Tsaralalàna',
                'Behoririka', 'Ambohijatovo', 'Ambatobe', 'Ivato', 'Andohalo',
                'Mahamasina', 'Ankorondrano', 'Ambohimanambola', 'Ambanidia', 'Soavimasoandro'
            ]
        },
        {
            nom: 'Toamasina',
            pays: 'Madagascar',
            population: '300000',
            quartiers: [
                'Centre-ville', 'Tanambao', 'Morarano', 'Bazary Be', 'Analakininina',
                'Antanambao', 'Ambalamanasy', 'Andranomahery', 'Tanamakoa', 'Ampasimbe'
            ]
        },
        {
            nom: 'Antsirabe',
            pays: 'Madagascar',
            population: '250000',
            quartiers: [
                'Centre-ville', 'Andranomanelatra', 'Betsingilo', 'Antsenakely', 'Manandona',
                'Ambohibary', 'Manarintsoa', 'Ambohitsimanova', 'Sabotsy', 'Andranotapahina'
            ]
        },
        { nom: 'Mahajanga', pays: 'Madagascar', population: '250000' },
        { nom: 'Fianarantsoa', pays: 'Madagascar', population: '200000' },
        { nom: 'Toliara', pays: 'Madagascar', population: '160000' },
        { nom: 'Antsiranana', pays: 'Madagascar', population: '120000' },
        { nom: 'Ambovombe', pays: 'Madagascar', population: '50000' },
        { nom: 'Morondava', pays: 'Madagascar', population: '50000' },
        { nom: 'Nosy Be', pays: 'Madagascar', population: '40000' },
    ]
};

// \uD83C\uDDE7\uD83C\uDDEE BURUNDI
export const BURUNDI: PaysInfo = {
    code: 'BI',
    emoji: '\uD83C\uDDE7\uD83C\uDDEE',
    nom: 'Burundi',
    nomComplet: 'République du Burundi',
    capitale: 'Gitega',
    villes: [
        {
            nom: 'Bujumbura',
            pays: 'Burundi',
            population: '1000000',
            quartiers: [
                'Centre-ville', 'Buyenzi', 'Ngagara', 'Kamenge', 'Kinama',
                'Bwiza', 'Nyakabiga', 'Musaga', 'Gihosha', 'Rohero',
                'Kinindo', 'Cibitoke', 'Mutakura', 'Kanyosha', 'Kabondo'
            ]
        },
        {
            nom: 'Gitega',
            pays: 'Burundi',
            estCapitale: true,
            population: '135000',
            quartiers: [
                'Centre-ville', 'Magarama', 'Mushasha', 'Rutovu', 'Giheta',
                'Mutaho', 'Buraza', 'Ryansoro', 'Itaba', 'Makebuko'
            ]
        },
        { nom: 'Muyinga', pays: 'Burundi', population: '70000' },
        { nom: 'Ngozi', pays: 'Burundi', population: '60000' },
        { nom: 'Ruyigi', pays: 'Burundi', population: '40000' },
        { nom: 'Cibitoke', pays: 'Burundi', population: '20000' },
        { nom: 'Bubanza', pays: 'Burundi', population: '20000' },
        { nom: 'Rutana', pays: 'Burundi', population: '20000' },
        { nom: 'Makamba', pays: 'Burundi', population: '20000' },
        { nom: 'Bururi', pays: 'Burundi', population: '20000' },
    ]
};

// \uD83C\uDDF7\uD83C\uDDFC RWANDA (partiellement francophone)
export const RWANDA: PaysInfo = {
    code: 'RW',
    emoji: '\uD83C\uDDF7\uD83C\uDDFC',
    nom: 'Rwanda',
    nomComplet: 'République du Rwanda',
    capitale: 'Kigali',
    villes: [
        {
            nom: 'Kigali',
            pays: 'Rwanda',
            estCapitale: true,
            population: '1300000',
            quartiers: [
                'Kigali Centre', 'Nyarugenge', 'Kicukiro', 'Gasabo', 'Remera',
                'Kimihurura', 'Nyamirambo', 'Gikondo', 'Kimironko', 'Kacyiru',
                'Kibagabaga', 'Gisozi', 'Kanombe', 'Rugando', 'Muhima'
            ]
        },
        { nom: 'Butare (Huye)', pays: 'Rwanda', population: '100000' },
        { nom: 'Gitarama (Muhanga)', pays: 'Rwanda', population: '90000' },
        { nom: 'Musanze (Ruhengeri)', pays: 'Rwanda', population: '80000' },
        { nom: 'Gisenyi (Rubavu)', pays: 'Rwanda', population: '150000' },
        { nom: 'Byumba (Gicumbi)', pays: 'Rwanda', population: '70000' },
        { nom: 'Cyangugu (Rusizi)', pays: 'Rwanda', population: '70000' },
        { nom: 'Kibungo (Ngoma)', pays: 'Rwanda', population: '50000' },
        { nom: 'Nyagatare', pays: 'Rwanda', population: '60000' },
        { nom: 'Karongi', pays: 'Rwanda', population: '40000' },
    ]
};

// \uD83C\uDDE9\uD83C\uDDEF DJIBOUTI
export const DJIBOUTI: PaysInfo = {
    code: 'DJ',
    emoji: '\uD83C\uDDE9\uD83C\uDDEF',
    nom: 'Djibouti',
    nomComplet: 'République de Djibouti',
    capitale: 'Djibouti',
    villes: [
        {
            nom: 'Djibouti',
            pays: 'Djibouti',
            estCapitale: true,
            population: '600000',
            quartiers: [
                'Plateau du Serpent', 'Héron', 'Ambouli', 'Balbala', 'Hayableh',
                'PK12', 'Quartier 1', 'Quartier 2', 'Quartier 3', 'Quartier 4',
                'Quartier 5', 'Quartier 6', 'Quartier 7', 'Arhiba', 'Boulaos'
            ]
        },
        { nom: 'Ali Sabieh', pays: 'Djibouti', population: '40000' },
        { nom: 'Dikhil', pays: 'Djibouti', population: '13000' },
        { nom: 'Tadjourah', pays: 'Djibouti', population: '25000' },
        { nom: 'Obock', pays: 'Djibouti', population: '18000' },
        { nom: 'Arta', pays: 'Djibouti', population: '6000' },
    ]
};

// \uD83C\uDDF0\uD83C\uDDF2 COMORES
export const COMORES: PaysInfo = {
    code: 'KM',
    emoji: '\uD83C\uDDF0\uD83C\uDDF2',
    nom: 'Comores',
    nomComplet: 'Union des Comores',
    capitale: 'Moroni',
    villes: [
        {
            nom: 'Moroni',
            pays: 'Comores',
            estCapitale: true,
            population: '60000',
            quartiers: [
                'Medina', 'Badjanani', 'Magoudou', 'Coulée', 'Foumbouni',
                'Itsandra', 'Hahaya', 'Mitsoudjé', 'Salimani', 'Vouvouni'
            ]
        },
        { nom: 'Mutsamudu', pays: 'Comores', population: '30000' },
        { nom: 'Fomboni', pays: 'Comores', population: '15000' },
        { nom: 'Domoni', pays: 'Comores', population: '15000' },
        { nom: 'Mitsamiouli', pays: 'Comores', population: '7000' },
        { nom: 'Tsinoni', pays: 'Comores', population: '5000' },
    ]
};

// \uD83C\uDDF2\uD83C\uDDF7 MAURITANIE
export const MAURITANIE: PaysInfo = {
    code: 'MR',
    emoji: '\uD83C\uDDF2\uD83C\uDDF7',
    nom: 'Mauritanie',
    nomComplet: 'République Islamique de Mauritanie',
    capitale: 'Nouakchott',
    villes: [
        {
            nom: 'Nouakchott',
            pays: 'Mauritanie',
            estCapitale: true,
            population: '1300000',
            quartiers: [
                'Tevragh-Zeina', 'Ksar', 'Toujounine', 'Arafat', 'El Mina',
                'Sebkha', 'Dar Naim', 'Teyarett', 'Riyadh', 'Basra',
                'Socogim', 'Capitale', 'Cinquième', 'Sixième', 'Septième'
            ]
        },
        { nom: 'Nouadhibou', pays: 'Mauritanie', population: '120000' },
        { nom: 'Kiffa', pays: 'Mauritanie', population: '60000' },
        { nom: 'Kaédi', pays: 'Mauritanie', population: '60000' },
        { nom: 'Rosso', pays: 'Mauritanie', population: '50000' },
        { nom: 'Zouérate', pays: 'Mauritanie', population: '45000' },
        { nom: 'Atar', pays: 'Mauritanie', population: '40000' },
        { nom: 'Néma', pays: 'Mauritanie', population: '30000' },
        { nom: 'Sélibaby', pays: 'Mauritanie', population: '30000' },
        { nom: 'Aleg', pays: 'Mauritanie', population: '15000' },
    ]
};

// ============================================================================
// EXPORT DE TOUS LES PAYS
// ============================================================================
export const TOUS_LES_PAYS: PaysInfo[] = [
    CAMEROUN,
    RDC,
    COTE_IVOIRE,
    SENEGAL,
    MALI,
    BURKINA_FASO,
    NIGER,
    TCHAD,
    GUINEE,
    BENIN,
    TOGO,
    CONGO_BRAZZAVILLE,
    GABON,
    CENTRAFRIQUE,
    MADAGASCAR,
    BURUNDI,
    RWANDA,
    DJIBOUTI,
    COMORES,
    MAURITANIE,
];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Récupère tous les pays triés par ordre alphabétique
 */
export const getTousLesPays = (): PaysInfo[] => {
    return [...TOUS_LES_PAYS].sort((a, b) => a.nom.localeCompare(b.nom));
};

/**
 * Récupère un pays par son code
 */
export const getPaysByCode = (code: string): PaysInfo | undefined => {
    return TOUS_LES_PAYS.find(p => p.code === code);
};

/**
 * Récupère toutes les villes d'un pays
 */
export const getVillesByPays = (codePays: string): VilleInfo[] => {
    const pays = getPaysByCode(codePays);
    return pays?.villes || [];
};

/**
 * Récupère les quartiers d'une ville
 */
export const getQuartiersByVille = (nomVille: string, codePays?: string): string[] => {
    const pays = codePays ? [getPaysByCode(codePays)] : TOUS_LES_PAYS;

    for (const p of pays) {
        if (!p) continue;
        const ville = p.villes.find(v => v.nom === nomVille);
        if (ville?.quartiers) {
            return ville.quartiers;
        }
    }

    return [];
};

/**
 * Récupère toutes les villes de tous les pays (pour recherche globale)
 */
export const getToutesLesVilles = (): VilleInfo[] => {
    const villes: VilleInfo[] = [];

    TOUS_LES_PAYS.forEach(pays => {
        villes.push(...pays.villes);
    });

    // Trier par population (villes les plus importantes en premier)
    return villes.sort((a, b) => {
        const popA = parseInt(a.population || '0');
        const popB = parseInt(b.population || '0');
        return popB - popA;
    });
};

/**
 * Recherche de villes par nom (recherche partielle)
 */
export const rechercherVilles = (recherche: string): VilleInfo[] => {
    const rechercheNormalisee = recherche.toLowerCase().trim();

    return getToutesLesVilles().filter(ville =>
        ville.nom.toLowerCase().includes(rechercheNormalisee)
    );
};

/**
 * Récupère les villes d'un pays avec priorité (capital en premier, puis par population)
 */
export const getVillesPrioritaires = (codePays: string): VilleInfo[] => {
    const villes = getVillesByPays(codePays);

    return villes.sort((a, b) => {
        // Capitale en premier
        if (a.estCapitale) return -1;
        if (b.estCapitale) return 1;

        // Ensuite par population
        const popA = parseInt(a.population || '0');
        const popB = parseInt(b.population || '0');
        return popB - popA;
    });
};

/**
 * Génère une liste de villes pour un sélecteur avec le pays de l'utilisateur en priorité
 */
export const getVillesPourSelecteur = (codePaysUtilisateur?: string): string[] => {
    const resultat: string[] = [];

    // 1. Villes du pays de l'utilisateur (si spécifié)
    if (codePaysUtilisateur) {
        const pays = getPaysByCode(codePaysUtilisateur);
        if (pays) {
            const villesPrioritaires = getVillesPrioritaires(codePaysUtilisateur);
            villesPrioritaires.forEach(ville => {
                resultat.push(`${pays.emoji} ${ville.nom}`);
            });

            // Séparateur
            resultat.push('─────────────────');
        }
    }

    // 2. Autres grandes villes d'Afrique francophone
    const autresPays = TOUS_LES_PAYS.filter(p => p.code !== codePaysUtilisateur);
    autresPays.forEach(pays => {
        // Prendre seulement les 3 plus grandes villes par pays
        const topVilles = pays.villes
            .sort((a, b) => {
                const popA = parseInt(a.population || '0');
                const popB = parseInt(b.population || '0');
                return popB - popA;
            })
            .slice(0, 3);

        topVilles.forEach(ville => {
            resultat.push(`${pays.emoji} ${ville.nom}`);
        });
    });

    // 3. Option personnalisée
    resultat.push('\uD83C\uDD95 Autre ville (saisir)');

    return resultat;
};

/**
 * Génère une liste de quartiers pour un sélecteur avec recherche intelligente
 */
export const getQuartiersPourSelecteur = (nomVille: string, codePays?: string): string[] => {
    const quartiers = getQuartiersByVille(nomVille, codePays);

    if (quartiers.length === 0) {
        return ['Centre-ville', '\uD83C\uDD95 Autre quartier (saisir)'];
    }

    return [...quartiers, '\uD83C\uDD95 Autre quartier (saisir)'];
};

/**
 * Extrait le nom de ville depuis une chaîne formatée (ex: "\uD83C\uDDE8\uD83C\uDDF2 Douala" => "Douala")
 */
export const extraireNomVille = (villeFormatee: string): string => {
    // Supprimer l'emoji et les espaces
    return villeFormatee.replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, '').trim();
};


