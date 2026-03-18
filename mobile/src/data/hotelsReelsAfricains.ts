/**
 * Base de données locale d'hôtels et hébergements réels en Afrique francophone
 * Utilisée comme fallback si l'API Google Maps n'est pas disponible
 * 
 * Pays couverts: Cameroun, Sénégal, Côte d'Ivoire, RDC, Gabon, Mali, Burkina Faso, Niger, Tchad, Togo, Bénin, Guinée, Madagascar, Congo, RCA, Burundi, Rwanda, Mauritanie
 */

export const HOTELS_REELS_PAR_PAYS: { [countryCode: string]: string[] } = {
    // \uD83C\uDDE8\uD83C\uDDF2 CAMEROUN
    CM: [
        // Douala
        'Hôtel Sawa', 'Hôtel Akwa Palace', 'Pullman Douala Rabingha', 'Ibis Douala',
        'La Falaise Akwa', 'Hôtel Prince de Galles', 'Residence Le Phenix',
        'Hôtel Beausejour Mirabel', 'Hôtel La Résidence', 'Hôtel Boulevard',
        'Novotel Douala', 'Hotel Vallée des Princes', 'Hôtel Le Méridien Douala',
        'Manoka Lodge', 'Bonanjo Hotel', 'Hôtel StarLand', 'Hôtel Jessica',
        
        // Yaoundé
        'Hilton Yaoundé', 'Hôtel Mont Fébé', 'Merina Hotel', 'Djeuga Palace',
        'Hôtel Franco', 'Hôtel Azur', 'Hôtel le Diplomate', 'Hôtel La Falaise',
        'Hotel Mansel', 'Hôtel La Bénoué', 'Hôtel Capitole', 'Aurore Hotel',
        'Hotel Palm Club', 'Hôtel Tou\'Ngou', 'Résidence de La Poste',
        
        // Autres villes
        'Hôtel Le Paradis (Kribi)', 'Hôtel Ilomba (Kribi)', 'Auberge du Phare (Kribi)',
        'Hôtel La Bénoué (Garoua)', 'Hôtel du Sahel (Maroua)', 'Hôtel Porte Mayo (Maroua)',
        'Hôtel Faro (Bafoussam)', 'Hotel Altitel (Bafoussam)', 'Hôtel Menoua Palace (Dschang)',
        'Hôtel Ayaba (Bamenda)', 'Hôtel Mondial Palace (Limbe)', 'Hôtel Bay Hotel (Limbe)',
        'Hôtel Miramar (Buea)', 'Mountain Hotel (Buea)', 'Hôtel La Regence (Bertoua)',
    ],

    // \uD83C\uDDF8\uD83C\uDDF3 SÉNÉGAL
    SN: [
        // Dakar
        'Radisson Blu Dakar', 'Pullman Dakar Teranga', 'King Fahd Palace',
        'Hôtel Ngor Diarama', 'Hôtel Djoloff', 'Le Djembe', 'Hôtel Fleur de Lys',
        'Onomo Hotel Dakar', 'Hôtel le Lagon II', 'Hôtel Océanic',
        'Terrou-Bi Resort', 'Hotel Sokhamon', 'Hôtel Farid', 'Hotel Al Afifa',
        
        // Saly
        'Lamantin Beach Resort & Spa', 'Hotel Royal Saly', 'Palm Beach Hotel',
        'Les Bougainvillées Saly', 'Hôtel Espadon', 'La Résidence Saly',
        
        // Autres villes
        'Hôtel La Linguère (Saint-Louis)', 'Résidence Chez Salim (Saint-Louis)',
        'Le Castel (Touba)', 'Hôtel Al Azhar (Touba)', 'Hôtel Le Lodge (Thiès)',
        'Keur Saloum (Fatick)', 'Le Flamboyant (Ziguinchor)', 'Hôtel Kadiandoumagne (Kolda)',
    ],

    // \uD83C\uDDE8\uD83C\uDDEE CÔTE D'IVOIRE
    CI: [
        // Abidjan
        'Sofitel Abidjan Hôtel Ivoire', 'Pullman Abidjan', 'Azalaï Hotel Abidjan',
        'Hôtel Tiama', 'Seen Hotel', 'Hôtel Ivotel', 'Hôtel Ibis Abidjan Plateau',
        'Hotel Palm Club Abidjan', 'Hôtel du District', 'Hôtel le Wafou',
        'Hôtel La Croisette', 'Hôtel La Madrague', 'Hôtel Blawa', 'Hôtel Le Griffon',
        
        // Autres villes
        'Hôtel Les Fromagers (Korhogo)', 'Hôtel Mont Korhogo (Korhogo)',
        'Hôtel Ivoire Residence (Yamoussoukro)', 'Résidence Présidentielle (Yamoussoukro)',
        'Hôtel La Taverne Bassam (Grand-Bassam)', 'Hôtel Etoile du Sud (San Pedro)',
        'Hôtel Assoyam (Boundiali)', 'La Bénoué (Man)', 'Hôtel Les Cascades (Man)',
    ],

    // \uD83C\uDDE8\uD83C\uDDE9 RDC (RÉPUBLIQUE DÉMOCRATIQUE DU CONGO)
    CD: [
        // Kinshasa
        'Pullman Kinshasa Grand Hôtel', 'Memling Hotel', 'Fleuve Congo Hotel',
        'Hôtel Sultani', 'Béatrice Hotel', 'Hôtel Royal', 'Hôtel Venus',
        'Ledya Hotels & Golf', 'Hôtel Invest', 'Hôtel Kempinski',
        'Hotel Kin Plaza Arjaan', 'Hôtel UTEX Africa', 'Hôtel Invest Kinshasa',
        
        // Lubumbashi
        'Karavia Hotel', 'Hotel Pullman Lubumbashi Grand Karavia', 'Hotel Leopold',
        'Hotel Valtir', 'Hotel Park Inn', 'Hotel Beatrice Lubumbashi',
        
        // Autres villes
        'Hotel Kisangani', 'Hotel Wagenia (Kisangani)', 'Hotel Goma Serena (Goma)',
        'Hotel Lac Kivu Lodge (Goma)', 'Hotel Mwanga (Bukavu)', 'Hotel Royal (Matadi)',
    ],

    // \uD83C\uDDEC\uD83C\uDDE6 GABON
    GA: [
        // Libreville
        'Radisson Blu Libreville', 'Hôtel Boulevard', 'Le Meridien Renouveau',
        'Tropicana Hotel', 'Hôtel Hibiscus Louis', 'Hôtel Le Patio',
        'Hotel Le Cristal', 'Hôtel Nomad', 'L\'Intercontinentale Libreville',
        'Résidence Hôtelière Rabi', 'Hôtel du Château', 'Hotel Montagne Verte',
        
        // Port-Gentil
        'Evasion Hotel', 'Hotel Mpolo Residence', 'Hotel Hibiscus Port Gentil',
        
        // Autres villes
        'Hôtel Lopé (Parc National de la Lopé)', 'Hôtel Ivindo (Makokou)',
        'Mission Catholique Guesthouse (Franceville)', 'Hôtel Le Masuku (Franceville)',
    ],

    // \uD83C\uDDF2\uD83C\uDDF1 MALI
    ML: [
        // Bamako
        'Radisson Blu Bamako', 'Azalaï Grand Hotel', 'Hôtel l\'Amitié',
        'Hôtel Tamana', 'Hôtel Olympe', 'Onomo Hotel Bamako',
        'Hôtel Djenne', 'Laïco El Farouk', 'Hôtel La Falaise',
        
        // Autres villes
        'Hôtel Mande (Sikasso)', 'Hôtel Gourma (Gao)', 'Hotel Bouctou (Tombouctou)',
        'Hotel Kanaga (Mopti)', 'Hotel Salam (Mopti)', 'Hôtel La Falaise (Ségou)',
    ],

    // \uD83C\uDDE7\uD83C\uDDEB BURKINA FASO
    BF: [
        // Ouagadougou
        'Hôtel Palm Beach', 'Laïco Ouaga 2000', 'Azalaï Hotel Ouagadougou',
        'Hotel Splendid', 'Hotel Ricardo', 'Hotel Sopatel Silmandé',
        'Hotel le Pavillon Vert', 'Bravia Hotel Ouagadougou',
        
        // Bobo-Dioulasso
        'Auberge Hôtel', 'Hotel Jardin de Koumi', 'Les Rôtisseurs', 'Le Relax Hotel',
        
        // Autres villes
        'Coco Lodge (Banfora)', 'Hôtel Les Cascades (Banfora)', 'Hotel Sindou',
    ],

    // \uD83C\uDDF3\uD83C\uDDEA NIGER
    NE: [
        // Niamey
        'Radisson Blu Niamey', 'Bravia Hotel Niamey', 'Hotel Sahel',
        'Grand Hotel du Niger', 'Hotel Terminus', 'Hotel Gaweye',
        'Hotel Noom', 'Hotel Tenere', 'Hotel La Pilote',
        
        // Autres villes
        'Hôtel Tafadek (Agadez)', 'Auberge Azel (Agadez)', 'Hotel Sojal (Zinder)',
    ],

    // \uD83C\uDDF9\uD83C\uDDE9 TCHAD
    TD: [
        // N\'Djamena
        'Radisson Blu N\'Djamena', 'Hotel Kempinski', 'Ledger Plaza N\'Djamena',
        'Hotel La Tchadienne', 'Hotel le Chari', 'Hotel Central',
        'Hotel le Sahel', 'Hotel Irrisor', 'Hotel Novotel N\'Djamena',
        
        // Autres villes
        'Hotel de Tibesti (Bardaï)', 'Hotel Moundou', 'Hotel Sarh',
    ],

    // \uD83C\uDDF9\uD83C\uDDEC TOGO
    TG: [
        // Lomé
        'Hotel 2 Fevrier', 'Radisson Blu Hotel Lomé', 'Hôtel Sarakawa',
        'Onomo Hotel Lomé', 'Hôtel Ibis Lomé Centre', 'Hotel Palm Beach',
        'Hotel Napoleon Lagune', 'Hotel Chez Alice', 'Hotel du Golfe',
        
        // Autres villes
        'Hotel Baobab (Kara)', 'Auberge Le Campement (Kpalimé)',
        'Hotel Kara Lodge (Kara)', 'Hotel des Plateaux (Atakpamé)',
    ],

    // \uD83C\uDDE7\uD83C\uDDEF BÉNIN
    BJ: [
        // Cotonou
        'Novotel Cotonou Orisha', 'Golden Tulip Le Diplomate', 'Hotel du Port',
        'Hotel Azalaï', 'Benin Marina Hotel', 'Hotel le Méridien Cotonou',
        'Hotel Majestic', 'Hotel du Lac', 'Hotel Jour et Nuit',
        
        // Porto-Novo
        'Hotel Beaurivage', 'Hotel Djegba', 'Hotel Bel Azur',
        
        // Autres villes
        'Hotel Casa del Papa (Ouidah)', 'Auberge de Grand Popo', 'Hotel La Tanière (Parakou)',
    ],

    // \uD83C\uDDEC\uD83C\uDDF3 GUINÉE
    GN: [
        // Conakry
        'Grand Hotel de l\'Indépendance', 'Hotel Palm Camayenne', 'Novotel Conakry',
        'Hotel Mariador Palace', 'Hotel Kaloum', 'Hotel Riviera Royal',
        'Hotel Noom Conakry', 'Petit Bateau Hotel', 'Hotel du Niger',
        
        // Autres villes
        'Hotel Tata (Kankan)', 'Hotel Tambacounda (Labé)', 'Hotel Nimba (N\'Zérékoré)',
    ],

    // \uD83C\uDDF2\uD83C\uDDEC MADAGASCAR
    MG: [
        // Antananarivo
        'Carlton Madagascar', 'Radisson Blu Antananarivo', 'Hotel Colbert',
        'Tana Hotel', 'Novotel Convention & Spa', 'Hotel La Varangue',
        'Le Louvre Hotel & Spa', 'Hotel Restaurant Tana Plaza', 'Palissandre Hotel',
        
        // Autres villes
        'Hotel La Pirogue (Nosy Be)', 'Vanila Hotel & Spa (Nosy Be)',
        'Hotel Libertalia (Nosy Be)', 'Hotel Sunny Beach (Ifaty)', 'Le Paradisier (Antsirabe)',
    ],

    // \uD83C\uDDE8\uD83C\uDDEC CONGO-BRAZZAVILLE
    CG: [
        // Brazzaville
        'Radisson Blu M\'Bamou Palace', 'Hotel Ledger Plaza Maya Maya',
        'Hotel Hippocampe', 'Hotel Olympic Palace', 'Hotel Mikhael\'s',
        'Hotel Residence du Congo', 'Hotel Elaïs Brazzaville',
        
        // Pointe-Noire
        'Radisson Blu Pointe-Noire', 'Hotel Elaïs', 'Atlantic Palace Hotel',
        'Hotel Azur', 'Hotel Pefaco', 'Hotel Residence Bouenza',
    ],

    // \uD83C\uDDE8\uD83C\uDDEB RÉPUBLIQUE CENTRAFRICAINE
    CF: [
        // Bangui
        'Ledger Plaza Bangui', 'Hotel Oubangui', 'Hotel Leon',
        'Hotel Somba', 'Hotel Novotel Bangui', 'Hotel la Residence',
    ],

    // \uD83C\uDDE7\uD83C\uDDEE BURUNDI
    BI: [
        // Bujumbura
        'Hotel Club du Lac Tanganyika', 'Roca Golf Hotel', 'Dolce Vita Resort',
        'Hotel Le Doyen', 'Hotel Novotel Bujumbura', 'Beauséjour Hotel',
        'Hotel Residence', 'Hotel Safari Gate', 'Hotel Burundi Palace',
    ],

    // \uD83C\uDDF7\uD83C\uDDFC RWANDA
    RW: [
        // Kigali
        'Radisson Blu Kigali', 'Kigali Marriott Hotel', 'Hotel des Mille Collines',
        'Lemigo Hotel', 'The Manor Hotel', 'Hotel Chez Lando', 'Heaven Restaurant & Hotel',
        'Step Town Motel', 'Gorillas Golf Hotel', 'Park Inn by Radisson Kigali',
        
        // Autres villes
        'Lake Kivu Serena Hotel (Gisenyi)', 'Hotel Gloria (Butare/Huye)',
        'Centre Bethanie (Gisenyi)', 'Hotel Muhabura (Musanze/Ruhengeri)',
    ],

    // \uD83C\uDDF2\uD83C\uDDF7 MAURITANIE
    MR: [
        // Nouakchott
        'Hotel Azalaï', 'Tfeila Hotel', 'Hotel Monotel', 'Hotel Marhaba',
        'Hotel Wissal', 'Hotel Halima', 'Hotel El Amane',
        
        // Autres villes
        'Auberge Bab Sahara (Atar)', 'Hotel Le Sawadi (Nouadhibou)',
        'Hotel El Medina (Nouadhibou)', 'Hotel Keïta (Rosso)',
    ],
};

/**
 * Obtenir tous les hôtels d'un pays
 */
export const getHotelsByCountry = (countryCode: string): string[] => {
    return HOTELS_REELS_PAR_PAYS[countryCode] || [];
};

/**
 * Obtenir tous les hôtels (tous pays)
 */
export const getAllHotels = (): string[] => {
    return Object.values(HOTELS_REELS_PAR_PAYS).flat();
};

/**
 * Rechercher des hôtels par nom
 */
export const searchHotels = (query: string, countryCode?: string): string[] => {
    const q = query.toLowerCase().trim();
    if (!q) return countryCode ? getHotelsByCountry(countryCode) : [];

    const hotels = countryCode ? getHotelsByCountry(countryCode) : getAllHotels();
    return hotels.filter(hotel => hotel.toLowerCase().includes(q));
};


