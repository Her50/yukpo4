// Système complet de modalités pour les produits organisées par catégorie
// Permet l'ajout de nouvelles modalités par l'utilisateur

export interface ModalityCategory {
  [key: string]: string[];
}

// ✅ MODALITÉS AUTOMOBILE
export const AUTOMOBILE_MODALITIES: ModalityCategory = {
  // Marques automobiles
  marques: [
    'Toyota', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 'Ford', 'Honda',
    'Nissan', 'Hyundai', 'Kia', 'Peugeot', 'Renault', 'Citroën', 'Mazda',
    'Chevrolet', 'Jeep', 'Land Rover', 'Porsche', 'Ferrari', 'Lamborghini',
    'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Tesla',
    'Volvo', 'Subaru', 'Mitsubishi', 'Suzuki', 'Isuzu', 'Daihatsu', 'Fiat',
    'Alfa Romeo', 'Maserati', 'Jaguar', 'Mini', 'Smart', 'Seat', 'Skoda',
    '🆕 Autre (ajouter)'
  ],

  // Types de transmission
  transmission: [
    'Manuelle', 'Automatique', 'Semi-automatique', 'CVT', 'Hybride', 'Électrique',
    '🆕 Autre (ajouter)'
  ],

  // Types de carburant
  carburant: [
    'Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL', 'Bioéthanol', 'Hydrogène',
    '🆕 Autre (ajouter)'
  ],

  // États du véhicule
  etat: [
    'Neuf', 'Occasion - Excellent état', 'Occasion - Bon état', 'Occasion - État moyen',
    'Occasion - État passable', 'À réparer', 'Épave', '🆕 Autre (ajouter)'
  ],

  // Couleurs
  couleur: [
    'Blanc', 'Noir', 'Gris', 'Argent', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange',
    'Marron', 'Beige', 'Violet', 'Rose', 'Doré', 'Métallisé', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS IMMOBILIER
export const IMMOBILIER_MODALITIES: ModalityCategory = {
  // Types immobiliers
  types: [
    'Appartement', 'Maison individuelle', 'Villa', 'Studio', 'Duplex', 'Triplex',
    'Penthouse', 'Loft', 'Chambre', 'Bureau', 'Local commercial', 'Entrepôt',
    'Terrain nu', 'Terrain viabilisé', 'Immeuble', 'Ferme', 'Château', 'Manoir',
    '🆕 Autre (ajouter)'
  ],

  // Statuts immobiliers
  statuts: [
    'À vendre', 'À louer', 'Location courte durée', 'Colocation', 'Vente en viager',
    'Location-vente', '🆕 Autre (ajouter)'
  ],

  // Niveaux d'ameublement
  ameublement: [
    'Non meublé', 'Semi-meublé', 'Meublé', 'Meublé + équipé', 'Meublé haut de gamme',
    '🆕 Autre (ajouter)'
  ],

  // Types de chauffage
  chauffage: [
    'Électrique', 'Gaz', 'Fioul', 'Bois', 'Pompe à chaleur', 'Solaire', 'Géothermie',
    'Chauffage collectif', '🆕 Autre (ajouter)'
  ],

  // Orientations
  orientation: [
    'Nord', 'Sud', 'Est', 'Ouest', 'Nord-Est', 'Nord-Ouest', 'Sud-Est', 'Sud-Ouest',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS HÔTELLERIE
export const HOTELLERIE_MODALITIES: ModalityCategory = {
  // Types d'hébergement
  types: [
    'Hôtel', 'Hôtel-Boutique', 'Resort', 'Auberge', 'Motel', 'Chambre d\'hôte',
    'Gîte', 'Pension', 'Apart-hôtel', 'Villa de luxe', 'Chalet', 'Camping',
    '🆕 Autre (ajouter)'
  ],

  // Catégories hôtelières
  categories: [
    'Sans étoile', '1 étoile', '2 étoiles', '3 étoiles', '4 étoiles', '5 étoiles',
    'Palace', '🆕 Autre (ajouter)'
  ],

  // Types de chambres
  chambres: [
    'Chambre Simple', 'Chambre Double', 'Chambre Twin', 'Suite Junior', 'Suite',
    'Suite Présidentielle', 'Chambre Familiale', 'Studio', 'Appartement',
    '🆕 Autre (ajouter)'
  ],

  // Équipements hôteliers
  equipements: [
    'Wi-Fi gratuit', 'Climatisation', 'Piscine', 'Restaurant', 'Bar', 'Salle de sport',
    'Spa', 'Parking gratuit', 'Service chambre 24h/24', 'Blanchisserie',
    'Navette aéroport', 'Salle de conférence', 'Coffre-fort', 'Réception 24h/24',
    'Piscine chauffée', 'Tennis', 'Golf', 'Plage privée', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS VOYAGE
export const VOYAGE_MODALITIES: ModalityCategory = {
  // Compagnies de voyage
  compagnies: [
    'Camair-Co', 'Ethiopian Airlines', 'Kenya Airways', 'Air France', 'Turkish Airlines',
    'Brussels Airlines', 'Royal Air Maroc', 'Emirates', 'Qatar Airways', 'Asky Airlines',
    'CEIBA Intercontinental', 'Cronos Airlines', 'Toumai Air Tchad', 'South African Airways',
    'EgyptAir', '🆕 Autre (ajouter)'
  ],

  // Classes de voyage
  classes: [
    'Économique', 'Économique Premium', 'Affaires', 'Première classe', 'Classe affaires',
    '🆕 Autre (ajouter)'
  ],

  // Types de véhicules de transport
  vehicules: [
    'Bus', 'Minibus', 'Van', 'Avion', 'Train', 'Bateau', 'Moto', 'Vélo', 'Taxi',
    '🆕 Autre (ajouter)'
  ],

  // Types de billets
  typesBillets: [
    'Aller simple', 'Aller-retour', 'Multi-destinations', 'Open ticket', 'Groupe',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS VÊTEMENTS
export const VETEMENTS_MODALITIES: ModalityCategory = {
  // Tailles
  tailles: [
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '38',
    '40', '42', '44', '46', '48', '50', '52', '54', '56', '58', '60', '🆕 Autre (ajouter)'
  ],

  // Matières
  matieres: [
    'Coton', 'Polyester', 'Laine', 'Soie', 'Lin', 'Cachemire', 'Cuir', 'Daim',
    'Denim', 'Viscose', 'Acrylique', 'Nylon', 'Spandex', 'Mélange', '🆕 Autre (ajouter)'
  ],

  // Marques vêtements
  marques: [
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'Lacoste', 'Ralph Lauren',
    'Tommy Hilfiger', 'Calvin Klein', 'Levi\'s', 'Zara', 'H&M', 'Uniqlo', 'Gap',
    '🆕 Autre (ajouter)'
  ],

  // Couleurs
  couleurs: [
    'Blanc', 'Noir', 'Gris', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Orange', 'Rose',
    'Violet', 'Marron', 'Beige', 'Multicolore', 'Imprimé', '🆕 Autre (ajouter)'
  ],

  // Types de vêtements
  types: [
    'T-shirt', 'Polo', 'Chemise', 'Pantalon', 'Jean', 'Short', 'Robe', 'Jupe',
    'Veste', 'Manteau', 'Pull', 'Sweat', 'Costume', 'Cravate', 'Cravate', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS CHAUSSURES
export const CHAUSSURES_MODALITIES: ModalityCategory = {
  // Pointures
  pointures: [
    '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47',
    '48', '49', '50', '🆕 Autre (ajouter)'
  ],

  // Types de chaussures
  types: [
    'Baskets', 'Chaussures de ville', 'Bottes', 'Sandales', 'Tongs', 'Mocassins',
    'Derbies', 'Escarpins', 'Tennis', 'Chaussures de sport', 'Chaussures de sécurité',
    '🆕 Autre (ajouter)'
  ],

  // Marques chaussures
  marques: [
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Converse', 'Vans', 'Timberland', 'Dr. Martens',
    'Clarks', 'Geox', 'Ecco', 'Salomon', '🆕 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Cuir', 'Tissu', 'Synthétique', 'Caoutchouc', 'Plastique', 'Mélange', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ÉLECTROMÉNAGER
export const ELECTROMENAGER_MODALITIES: ModalityCategory = {
  // Types d'électroménager
  types: [
    'Réfrigérateur', 'Congélateur', 'Lave-linge', 'Sèche-linge', 'Lave-vaisselle',
    'Cuisinière', 'Four', 'Micro-ondes', 'Aspirateur', 'Fer à repasser', 'Mixer',
    'Blender', 'Grille-pain', 'Bouilloire', 'Cafetière', '🆕 Autre (ajouter)'
  ],

  // Marques électroménager
  marques: [
    'Samsung', 'LG', 'Whirlpool', 'Bosch', 'Siemens', 'Electrolux', 'Panasonic',
    'Sharp', 'Toshiba', 'Haier', 'Tefal', 'Moulinex', 'Krups', 'Philips', '🆕 Autre (ajouter)'
  ],

  // Classes énergétiques
  classesEnergetiques: [
    'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', '🆕 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf', 'Occasion - Excellent état', 'Occasion - Bon état', 'Occasion - État moyen',
    'À réparer', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS IMAGE & SON
export const IMAGE_SON_MODALITIES: ModalityCategory = {
  // Types d'équipements
  types: [
    'TV', 'Home cinéma', 'Enceintes', 'Projecteur', 'Amplificateur', 'Récepteur',
    'Lecteur Blu-ray', 'Lecteur DVD', 'Console de jeu', 'Casque', 'Microphone',
    'Caméra', 'Appareil photo', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Samsung', 'LG', 'Sony', 'Panasonic', 'Toshiba', 'Sharp', 'Philips', 'TCL',
    'Hisense', 'JBL', 'Bose', 'Harman Kardon', 'Yamaha', 'Denon', 'Marantz',
    '🆕 Autre (ajouter)'
  ],

  // Résolutions
  resolutions: [
    'HD (720p)', 'Full HD (1080p)', '4K UHD', '8K UHD', '🆕 Autre (ajouter)'
  ],

  // Tailles d'écran
  taillesEcran: [
    '32"', '40"', '43"', '50"', '55"', '65"', '75"', '85"', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS TÉLÉPHONES
export const TELEPHONES_MODALITIES: ModalityCategory = {
  // Marques
  marques: [
    'Apple', 'Samsung', 'Huawei', 'Xiaomi', 'OnePlus', 'Google', 'Sony', 'LG',
    'Motorola', 'Nokia', 'Realme', 'Oppo', 'Vivo', 'Honor', '🆕 Autre (ajouter)'
  ],

  // Capacités de stockage
  stockage: [
    '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '🆕 Autre (ajouter)'
  ],

  // Mémoire RAM
  ram: [
    '2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB', '🆕 Autre (ajouter)'
  ],

  // Couleurs
  couleurs: [
    'Noir', 'Blanc', 'Gris', 'Argent', 'Or', 'Rose', 'Bleu', 'Rouge', 'Vert',
    'Violet', '🆕 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf', 'Occasion - Excellent état', 'Occasion - Bon état', 'Occasion - État moyen',
    'À réparer', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ORDINATEURS
export const ORDINATEURS_MODALITIES: ModalityCategory = {
  // Types d'ordinateurs
  types: [
    'PC de bureau', 'Laptop', 'MacBook', 'iMac', 'Mac Pro', 'Tablette', 'iPad',
    'Surface', 'Chromebook', 'Serveur', 'Workstation', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Razer', 'Alienware',
    'Microsoft', 'Samsung', '🆕 Autre (ajouter)'
  ],

  // Processeurs
  processeurs: [
    'Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 3',
    'AMD Ryzen 5', 'AMD Ryzen 7', 'AMD Ryzen 9', 'Apple M1', 'Apple M2', 'Apple M3',
    '🆕 Autre (ajouter)'
  ],

  // Mémoire RAM
  ram: [
    '4GB', '8GB', '16GB', '32GB', '64GB', '128GB', '🆕 Autre (ajouter)'
  ],

  // Stockage
  stockage: [
    '128GB SSD', '256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD', '1TB HDD',
    '2TB HDD', '4TB HDD', '🆕 Autre (ajouter)'
  ],

  // Cartes graphiques
  cartesGraphiques: [
    'Intel HD Graphics', 'Intel Iris', 'NVIDIA GeForce GTX', 'NVIDIA GeForce RTX',
    'AMD Radeon', 'Apple GPU', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MOBILIER
export const MOBILIER_MODALITIES: ModalityCategory = {
  // Types de mobilier
  types: [
    'Salon', 'Chambre', 'Bureau', 'Cuisine', 'Salle à manger', 'Salle de bain',
    'Décoration', 'Éclairage', 'Rangement', 'Jardin', '🆕 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Bois massif', 'Bois aggloméré', 'Métal', 'Verre', 'Tissu', 'Cuir', 'Plastique',
    'Rotin', 'Bambou', 'Pierre', 'Marbre', '🆕 Autre (ajouter)'
  ],

  // Styles
  styles: [
    'Moderne', 'Classique', 'Rustique', 'Industriel', 'Scandinave', 'Vintage',
    'Minimaliste', 'Baroque', 'Art déco', '🆕 Autre (ajouter)'
  ],

  // Couleurs
  couleurs: [
    'Blanc', 'Noir', 'Gris', 'Marron', 'Beige', 'Bleu', 'Vert', 'Rouge', 'Jaune',
    'Multicolore', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ALIMENTS FRAIS (fruits, légumes, viandes, poissons)
export const ALIMENTS_MODALITIES: ModalityCategory = {
  // Catégories d'aliments
  categories: [
    'Fruits', 'Légumes', 'Viande', 'Poisson', 'Volaille', 'Produits laitiers',
    'Céréales', 'Épices', 'Boissons', 'Pâtisserie', 'Conserves', 'Surgelés',
    '🆕 Autre (ajouter)'
  ],

  // Origines
  origines: [
    'Locale', 'Importée', 'Bio', 'Équitable', 'Traditionnelle', '🆕 Autre (ajouter)'
  ],

  // Méthodes de conservation
  conservation: [
    'Frais', 'Surgelé', 'Sec', 'Conserve', 'Séché', 'Fumé', 'Salé', '🆕 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Bio', 'Halal', 'Kasher', 'Vegan', 'Sans gluten', 'Équitable', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS AGROALIMENTAIRE (produits transformés, conditionnés)
export const AGROALIMENTAIRE_MODALITIES: ModalityCategory = {
  // Types de produits agroalimentaires
  types: [
    'Riz et céréales', 'Pâtes alimentaires', 'Farine', 'Huile alimentaire', 'Sucre et édulcorants',
    'Sel et épices', 'Sauces et condiments', 'Conserves', 'Produits secs', 'Boissons',
    'Produits laitiers transformés', 'Produits surgelés', 'Snacks et confiseries', 'Biscuits et gâteaux',
    'Chocolat et cacao', 'Café et thé', 'Produits diététiques', 'Aliments pour bébés',
    'Produits biologiques', 'Produits halal', '🆕 Autre (ajouter)'
  ],

  // Catégories principales
  categories: [
    'Céréales et dérivés', 'Huiles et matières grasses', 'Produits sucrés', 'Condiments',
    'Boissons', 'Conserves', 'Produits secs', 'Snacks', 'Produits transformés',
    'Produits laitiers', 'Surgelés', 'Bio et diététique', '🆕 Autre (ajouter)'
  ],

  // Types de riz
  riz: [
    'Riz blanc', 'Riz brun/complet', 'Riz parfumé', 'Riz basmati', 'Riz jasmin',
    'Riz cargo', 'Riz étuvé', 'Riz gluant', 'Riz long grain', 'Riz court grain',
    'Riz sauvage', 'Riz noir', 'Riz rouge', '🆕 Autre (ajouter)'
  ],

  // Types de pâtes
  pates: [
    'Spaghetti', 'Macaroni', 'Penne', 'Fusilli', 'Tagliatelles', 'Lasagnes',
    'Vermicelles', 'Coquillettes', 'Farfalle', 'Rigatoni', 'Nouilles chinoises',
    'Pâtes complètes', 'Pâtes sans gluten', '🆕 Autre (ajouter)'
  ],

  // Types d'huiles
  huiles: [
    'Huile d\'arachide', 'Huile de palme', 'Huile de tournesol', 'Huile d\'olive',
    'Huile de soja', 'Huile de colza', 'Huile de coco', 'Huile de sésame',
    'Huile végétale mélangée', 'Huile de maïs', '🆕 Autre (ajouter)'
  ],

  // Types de farines
  farines: [
    'Farine de blé', 'Farine de maïs', 'Farine de manioc', 'Farine de riz',
    'Farine complète', 'Farine de mil', 'Farine de sorgho', 'Farine de soja',
    'Farine sans gluten', 'Farine d\'avoine', '🆕 Autre (ajouter)'
  ],

  // Condiments et sauces
  condiments: [
    'Ketchup', 'Mayonnaise', 'Moutarde', 'Sauce tomate', 'Sauce soja', 'Vinaigre',
    'Sauce piquante', 'Maggi/Jumbo', 'Bouillon cube', 'Concentré de tomate',
    'Sauce barbecue', 'Harissa', 'Piment', '🆕 Autre (ajouter)'
  ],

  // Épices
  epices: [
    'Poivre', 'Sel', 'Curry', 'Curcuma', 'Gingembre', 'Ail en poudre',
    'Oignon en poudre', 'Paprika', 'Cannelle', 'Muscade', 'Clou de girofle',
    'Thym', 'Laurier', 'Persil', 'Coriandre', 'Piment de Cayenne',
    'Quatre-épices', 'Mélange d\'épices', '🆕 Autre (ajouter)'
  ],

  // Boissons
  boissons: [
    'Eau minérale', 'Eau gazeuse', 'Jus de fruits', 'Sodas', 'Boissons énergisantes',
    'Thé', 'Café', 'Lait en poudre', 'Lait concentré', 'Chocolat en poudre',
    'Sirop', 'Bissap', 'Gingembre', '🆕 Autre (ajouter)'
  ],

  // Conserves
  conserves: [
    'Sardines', 'Thon', 'Maquereau', 'Tomates pelées', 'Haricots', 'Pois chiches',
    'Maïs', 'Champignons', 'Fruits au sirop', 'Légumes en conserve',
    'Plats cuisinés', '🆕 Autre (ajouter)'
  ],

  // Snacks et confiseries
  snacks: [
    'Chips', 'Biscuits', 'Cacahuètes', 'Noix de cajou', 'Bonbons', 'Chocolats',
    'Chewing-gum', 'Pop-corn', 'Biscuits apéritif', 'Barres céréales',
    '🆕 Autre (ajouter)'
  ],

  // Formats/Conditionnements
  formats: [
    '500g', '1kg', '2kg', '5kg', '10kg', '25kg', '50kg',
    '1L', '2L', '5L', '20L',
    'Sachet', 'Boîte', 'Bouteille', 'Bidon', 'Sac',
    'Pack de 6', 'Pack de 12', 'Pack de 24',
    '🆕 Autre (ajouter)'
  ],

  // Marques populaires (exemples camerounais et internationaux)
  marques: [
    'Uncle Ben\'s', 'Tilda', 'Golden Rice', 'Panzani', 'Barilla', 'Nestlé',
    'Maggi', 'Knorr', 'Heinz', 'Coca-Cola', 'Pepsi', 'Sprite', 'Fanta',
    'Lipton', 'Nescafé', 'Nido', 'Peak', 'Danone', 'Président',
    'La Vache qui rit', 'Jumbo', 'Nivea', 'Ferrero', 'Mars', 'Snickers',
    '🆕 Autre (ajouter)'
  ],

  // Origine/Provenance
  origines: [
    'Cameroun', 'Locale', 'Afrique de l\'Ouest', 'Europe', 'Asie',
    'Amérique', 'Thaïlande', 'Inde', 'Pakistan', 'France', 'Italie',
    'Chine', 'Vietnam', '🆕 Autre (ajouter)'
  ],

  // Certifications et labels
  certifications: [
    'Bio', 'Halal', 'Kasher', 'Sans OGM', 'Commerce équitable',
    'Label rouge', 'Agriculture biologique', 'Sans gluten', 'Vegan',
    'Sans lactose', 'Sans sucre ajouté', '🆕 Autre (ajouter)'
  ],

  // Conservation
  conservation: [
    'Température ambiante', 'Au frais', 'Au sec', 'À l\'abri de la lumière',
    'Réfrigéré après ouverture', 'Surgelé', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS LIVRES & FOURNITURES
export const LIVRES_FOURNITURES_MODALITIES: ModalityCategory = {
  // Catégories
  categories: [
    'Livre scolaire', 'Roman', 'Livre technique', 'Cahier', 'Stylo', 'Crayon',
    'Marqueur', 'Gomme', 'Règle', 'Calculatrice', 'Trousse', 'Cartable', '🆕 Autre (ajouter)'
  ],

  // Niveaux scolaires
  niveaux: [
    'Maternelle', 'Primaire', 'Secondaire', 'Université', 'Formation professionnelle',
    '🆕 Autre (ajouter)'
  ],

  // Matières
  matieres: [
    'Mathématiques', 'Français', 'Histoire', 'Géographie', 'Sciences', 'Anglais',
    'Espagnol', 'Allemand', 'Physique', 'Chimie', 'Biologie', 'Philosophie',
    '🆕 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf', 'Bon état', 'Occasion', 'Usagé', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS QUINCAILLERIE
export const QUINCAILLERIE_MODALITIES: ModalityCategory = {
  // Catégories
  categories: [
    'Outils', 'Matériaux', 'Peinture', 'Électricité', 'Plomberie', 'Serrurerie',
    'Jardinage', 'Bricolage', 'Sécurité', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Stanley', 'Bosch', 'Makita', 'DeWalt', 'Black & Decker', 'Dulux', 'Ripolin',
    'Legrand', 'Schneider', 'Hager', '🆕 Autre (ajouter)'
  ],

  // Unités
  unites: [
    'Pièce', 'Sac', 'Litre', 'Kilogramme', 'Mètre', 'Mètre carré', 'Mètre cube',
    'Paquet', 'Boîte', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PRESTATIONS DE SERVICE
export const PRESTATIONS_SERVICE_MODALITIES: ModalityCategory = {
  // Types de prestations
  types: [
    'Consultation', 'Formation', 'Maintenance', 'Installation', 'Réparation',
    'Nettoyage', 'Transport', 'Garde', 'Cuisine', 'Coiffure', 'Massage',
    '🆕 Autre (ajouter)'
  ],

  // Durées
  durees: [
    '1 heure', '2 heures', '4 heures', '1 jour', '1 semaine', '1 mois',
    'Sur devis', '🆕 Autre (ajouter)'
  ],

  // Zones d'intervention
  zones: [
    'Yaoundé', 'Douala', 'Garoua', 'Bafoussam', 'Bamenda', 'Maroua', 'Ngaoundéré',
    'Bertoua', 'Ebolowa', 'Tout le Cameroun', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PHARMACIE
export const PHARMACIE_MODALITIES: ModalityCategory = {
  // Types de pharmacie
  types: [
    'Pharmacie de garde', 'Pharmacie normale', 'Pharmacie hospitalière',
    'Pharmacie vétérinaire', '🆕 Autre (ajouter)'
  ],

  // Services
  services: [
    'Délivrance', 'Conseil', 'Garde', 'Vaccination', 'Mesure tension', 'Analyse rapide',
    'Livraison', '🆕 Autre (ajouter)'
  ],

  // Spécialités
  specialites: [
    'Médecine générale', 'Pédiatrie', 'Gynécologie', 'Cardiologie', 'Dermatologie',
    'Ophtalmologie', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS COSMÉTIQUES & PARFUMS
export const COSMETIQUES_PARFUMS_MODALITIES: ModalityCategory = {
  // Types de produits
  types: [
    'Parfum', 'Eau de toilette', 'Eau de parfum', 'Crème', 'Lotion', 'Shampoing',
    'Savon', 'Déodorant', 'Rouge à lèvres', 'Fond de teint', 'Mascara', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Chanel', 'Dior', 'Lancôme', 'Yves Saint Laurent', 'Guerlain', 'Hermès',
    'Versace', 'Armani', 'Hugo Boss', 'Calvin Klein', '🆕 Autre (ajouter)'
  ],

  // Types de peau
  typesPeau: [
    'Peau normale', 'Peau sèche', 'Peau grasse', 'Peau mixte', 'Peau sensible',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS BIJOUX
export const BIJOUX_MODALITIES: ModalityCategory = {
  // Types de bijoux
  types: [
    'Bague', 'Collier', 'Boucles d\'oreilles', 'Bracelet', 'Montre', 'Broche',
    'Pendentif', 'Chaîne', '🆕 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Or', 'Argent', 'Platine', 'Diamant', 'Émeraude', 'Rubis', 'Saphir',
    'Perle', 'Acier', 'Titane', '🆕 Autre (ajouter)'
  ],

  // Carats (pour l'or)
  carats: [
    '9 carats', '14 carats', '18 carats', '22 carats', '24 carats', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS COIFFURE & BEAUTÉ
export const COIFFURE_BEAUTE_MODALITIES: ModalityCategory = {
  // Types de services
  types: [
    'Coupe', 'Coloration', 'Permanente', 'Lissage', 'Brushing', 'Manucure',
    'Pédicure', 'Maquillage', 'Soin visage', 'Massage', 'Épilation', '🆕 Autre (ajouter)'
  ],

  // Durées
  durees: [
    '30 minutes', '1 heure', '1h30', '2 heures', '3 heures', 'Sur devis',
    '🆕 Autre (ajouter)'
  ],

  // Types de cheveux
  typesCheveux: [
    'Cheveux normaux', 'Cheveux secs', 'Cheveux gras', 'Cheveux colorés',
    'Cheveux frisés', 'Cheveux lisses', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS DÉMÉNAGEMENT
export const DEMENAGEMENT_MODALITIES: ModalityCategory = {
  // Types de déménagement
  types: [
    'Déménagement local', 'Déménagement national', 'Déménagement international',
    'Déménagement bureau', 'Déménagement partiel', '🆕 Autre (ajouter)'
  ],

  // Services
  services: [
    'Emballage', 'Transport', 'Déballage', 'Montage meubles', 'Nettoyage',
    'Assurance', '🆕 Autre (ajouter)'
  ],

  // Types de véhicules
  vehicules: [
    'Camionnette', 'Camion', 'Fourgon', 'Remorque', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ASSURANCE
export const ASSURANCE_MODALITIES: ModalityCategory = {
  // Types d'assurance
  types: [
    'Assurance auto', 'Assurance habitation', 'Assurance santé', 'Assurance vie',
    'Assurance voyage', 'Assurance professionnelle', '🆕 Autre (ajouter)'
  ],

  // Compagnies
  compagnies: [
    'Allianz', 'AXA', 'Groupama', 'Maaf', 'Macif', 'Matmut', 'MMA', 'SMA',
    '🆕 Autre (ajouter)'
  ],

  // Types de couverture
  couvertures: [
    'Tous risques', 'Au tiers', 'Comprehensive', 'Responsabilité civile',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS JOUETS ENFANTS
export const JOUETS_ENFANTS_MODALITIES: ModalityCategory = {
  // Types de jouets
  types: [
    'Éducatif', 'Peluche', 'Jeu de société', 'Puzzle', 'Construction', 'Voiture',
    'Poupée', 'Jeu vidéo', 'Sport', 'Musique', '🆕 Autre (ajouter)'
  ],

  // Âges recommandés
  ages: [
    '0-3 ans', '3-6 ans', '6-10 ans', '10+ ans', 'Tous âges', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'LEGO', 'Hasbro', 'Mattel', 'Ravensburger', 'Jellycat', 'Fisher-Price',
    'VTech', '🆕 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Plastique', 'Bois', 'Tissu', 'Métal', 'Carton', 'Caoutchouc', '🆕 Autre (ajouter)'
  ],

  // Normes de sécurité
  normes: [
    'CE', 'EN71', 'ASTM', 'ISO', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS USTENSILES CUISINE
export const USTENSILES_CUISINE_MODALITIES: ModalityCategory = {
  // Types d'ustensiles
  types: [
    'Casserole', 'Poêle', 'Cocotte', 'Plat', 'Saladier', 'Couteau', 'Fourchette',
    'Cuillère', 'Mixer', 'Blender', 'Grille-pain', 'Bouilloire', '🆕 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Inox', 'Aluminium', 'Fonte', 'Céramique', 'Téflon', 'Silicone', 'Bambou',
    'Bois', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Tefal', 'Moulinex', 'Krups', 'Bosch', 'KitchenAid', 'Le Creuset', 'Staub',
    '🆕 Autre (ajouter)'
  ],

  // Capacités
  capacites: [
    '1L', '2L', '3L', '5L', '10L', '20L', 'N/A', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PIÈCES AUTO
export const PIECES_AUTO_MODALITIES: ModalityCategory = {
  // Types de pièces
  types: [
    'Moteur', 'Transmission', 'Freinage', 'Suspension', 'Échappement', 'Éclairage',
    'Carrosserie', 'Intérieur', 'Électronique', 'Filtres', 'Lubrifiants', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Bosch', 'Valeo', 'Continental', 'ZF', 'Brembo', 'Monroe', 'Bilstein',
    'Mann', 'Mahle', '🆕 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf', 'Occasion - Excellent état', 'Occasion - Bon état', 'Occasion - État moyen',
    'À réparer', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PIÈCES INDUSTRIELLES
export const PIECES_INDUSTRIELLES_MODALITIES: ModalityCategory = {
  // Types de pièces
  types: [
    'Roulement', 'Courroie', 'Moteur', 'Pompe', 'Ventilateur', 'Compresseur',
    'Électrovanne', 'Capteur', 'Actionneur', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'SKF', 'Gates', 'ABB', 'Grundfos', 'Siemens', 'Schneider', 'Danfoss',
    '🆕 Autre (ajouter)'
  ],

  // Applications
  applications: [
    'Machines outils', 'Pompes', 'Ventilateurs', 'Compresseurs', 'Irrigation',
    'Industrie', '🆕 Autre (ajouter)'
  ],

  // Matériaux
  materiaux: [
    'Acier', 'Fonte', 'Inox', 'Cuivre', 'Aluminium', 'Caoutchouc', 'Plastique',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS RESTAURATION
export const RESTAURATION_MODALITIES: ModalityCategory = {
  // Types de cuisine
  types_cuisine: [
    'Africaine', 'Camerounaise', 'Européenne', 'Française', 'Italienne', 'Chinoise',
    'Japonaise', 'Indienne', 'Mexicaine', 'Libanaise', 'Américaine', 'Fast-food',
    'Grillades', 'Poisson', 'Fruits de mer', 'Végétarienne', 'Vegan', 'Halal',
    '🆕 Autre (ajouter)'
  ],

  // Types d'établissement
  types: [
    'Restaurant', 'Bar', 'Café', 'Boulangerie', 'Pâtisserie', 'Snack', 'Maquis',
    'Traiteur', 'Food truck', 'Pizzeria', 'Crêperie', 'Glacier', '🆕 Autre (ajouter)'
  ],

  // Spécialités
  specialites: [
    'Ndolé', 'Eru', 'Koki', 'Poulet DG', 'Poisson braisé', 'Soya', 'Kati-kati',
    'Pizza', 'Burger', 'Sushi', 'Poulet rôti', 'Grillades', 'Poisson fumé',
    'Brochettes', '🆕 Autre (ajouter)'
  ],

  // Services
  services: [
    'Sur place', 'À emporter', 'Livraison', 'Traiteur', 'Buffet', 'Événementiel',
    '🆕 Autre (ajouter)'
  ],

  // Régimes spéciaux
  regimes: [
    'Halal', 'Kasher', 'Végétarien', 'Vegan', 'Sans gluten', 'Sans lactose',
    'Bio', 'Régime méditerranéen', '🆕 Autre (ajouter)'
  ],

  // Gammes de prix
  gammes_prix: [
    'Économique (< 2000 FCFA)', 'Moyen (2000-5000 FCFA)', 'Élevé (5000-10000 FCFA)',
    'Premium (> 10000 FCFA)', '🆕 Autre (ajouter)'
  ],

  // Horaires
  horaires: [
    'Petit-déjeuner (6h-11h)', 'Déjeuner (12h-15h)', 'Dîner (18h-23h)',
    'Service continu', '24h/24', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ÉLECTRONIQUE
export const ELECTRONIQUE_MODALITIES: ModalityCategory = {
  // Types d'appareils
  types: [
    'Smartphone', 'Tablette', 'Ordinateur portable', 'PC de bureau', 'Télévision',
    'Console de jeux', 'Appareil photo', 'Caméra', 'Drone', 'Montre connectée',
    'Écouteurs', 'Casque audio', 'Enceinte', 'Chargeur', 'Batterie externe',
    'Accessoires', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Sony', 'LG', 'Panasonic', 'Canon',
    'Nikon', 'DJI', 'Bose', 'JBL', 'Beats', 'Anker', 'Belkin', '🆕 Autre (ajouter)'
  ],

  // États
  etats: [
    'Neuf sous garantie', 'Neuf sans garantie', 'Reconditionné', 'Occasion - Excellent',
    'Occasion - Bon', 'Occasion - Moyen', 'Pour pièces', '🆕 Autre (ajouter)'
  ],

  // Connectivité
  connectivite: [
    'Wi-Fi', 'Bluetooth', '4G', '5G', 'NFC', 'USB-C', 'Lightning', 'HDMI',
    'Jack 3.5mm', 'USB', 'Ethernet', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS FORMATION & ÉDUCATION
export const FORMATION_EDUCATION_MODALITIES: ModalityCategory = {
  // Domaines de formation
  domaines: [
    'Informatique', 'Programmation', 'Marketing digital', 'Comptabilité', 'Gestion',
    'Langues', 'Design', 'Photographie', 'Vidéo', 'Musique', 'Cuisine', 'Couture',
    'Coiffure', 'Mécanique', 'Électricité', 'Plomberie', 'Agriculture',
    '🆕 Autre (ajouter)'
  ],

  // Niveaux
  niveaux: [
    'Débutant', 'Intermédiaire', 'Avancé', 'Expert', 'Certification professionnelle',
    '🆕 Autre (ajouter)'
  ],

  // Formats
  formats: [
    'Présentiel', 'En ligne', 'Hybride', 'Cours particulier', 'Groupe', 'Atelier',
    'Bootcamp', 'Masterclass', '🆕 Autre (ajouter)'
  ],

  // Durées
  durees: [
    '1 jour', '1 semaine', '2 semaines', '1 mois', '3 mois', '6 mois', '1 an',
    'Formation continue', '🆕 Autre (ajouter)'
  ],

  // Langues d'enseignement
  langues: [
    'Français', 'Anglais', 'Espagnol', 'Allemand', 'Arabe', 'Chinois', 'Bilingue',
    '🆕 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Certificat de formation', 'Diplôme', 'Attestation', 'Certification professionnelle',
    'Certification internationale', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ÉVÉNEMENTIEL
export const EVENEMENTIEL_MODALITIES: ModalityCategory = {
  // Types d'événements
  types: [
    'Mariage', 'Anniversaire', 'Baptême', 'Conférence', 'Séminaire', 'Formation',
    'Concert', 'Festival', 'Exposition', 'Soirée d\'entreprise', 'Lancement de produit',
    'Défilé de mode', 'Gala', 'Cocktail', 'Réception', '🆕 Autre (ajouter)'
  ],

  // Services
  services: [
    'Location de salle', 'Traiteur', 'Décoration', 'Animation', 'DJ', 'Musiciens',
    'Photographe', 'Vidéaste', 'Sonorisation', 'Éclairage', 'Tente et chapiteaux',
    'Location de matériel', 'Sécurité', 'Valet parking', '🆕 Autre (ajouter)'
  ],

  // Capacités
  capacites: [
    '10-50 personnes', '50-100 personnes', '100-200 personnes', '200-500 personnes',
    '500-1000 personnes', '1000+ personnes', '🆕 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Projecteur', 'Écran', 'Micro', 'Sonorisation', 'Éclairage', 'Scène', 'Podium',
    'Tables', 'Chaises', 'Nappes', 'Vaisselle', 'Climatisation', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS AGRICULTURE
export const AGRICULTURE_MODALITIES: ModalityCategory = {
  // Types de produits
  types: [
    'Légumes', 'Fruits', 'Céréales', 'Tubercules', 'Légumineuses', 'Épices',
    'Plantes aromatiques', 'Fleurs', 'Plants', 'Semences', 'Engrais', 'Pesticides',
    'Matériel agricole', 'Bétail', 'Volaille', 'Poisson d\'élevage', '🆕 Autre (ajouter)'
  ],

  // Méthodes de culture
  methodes: [
    'Agriculture biologique', 'Agriculture conventionnelle', 'Agroécologie',
    'Permaculture', 'Hydroponie', 'Serre', 'Plein champ', '🆕 Autre (ajouter)'
  ],

  // Certifications
  certifications: [
    'Bio', 'Commerce équitable', 'Agriculture raisonnée', 'Label rouge',
    'AOP', 'IGP', '🆕 Autre (ajouter)'
  ],

  // Conditionnements
  conditionnements: [
    'Vrac', 'Sac 1kg', 'Sac 5kg', 'Sac 10kg', 'Sac 25kg', 'Sac 50kg',
    'Cageot', 'Panier', 'Boîte', 'Bouquet', '🆕 Autre (ajouter)'
  ],

  // Saisons
  saisons: [
    'Toute l\'année', 'Saison des pluies', 'Saison sèche', 'Mars-Mai', 'Juin-Août',
    'Septembre-Novembre', 'Décembre-Février', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS SPORT & FITNESS
export const SPORT_FITNESS_MODALITIES: ModalityCategory = {
  // Types de sports
  sports: [
    'Football', 'Basketball', 'Tennis', 'Natation', 'Cyclisme', 'Course à pied',
    'Musculation', 'Yoga', 'Pilates', 'Arts martiaux', 'Boxe', 'Danse', 'Golf',
    'Volleyball', 'Handball', '🆕 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Tapis de course', 'Vélo d\'appartement', 'Rameur', 'Haltères', 'Barre',
    'Banc de musculation', 'Tapis de yoga', 'Corde à sauter', 'Ballon',
    'Raquette', 'Vélo', 'Trottinette', '🆕 Autre (ajouter)'
  ],

  // Vêtements sport
  vetements: [
    'Maillot', 'Short', 'Legging', 'Brassière', 'Veste de sport', 'Sweat',
    'Chaussures de sport', 'Baskets', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'Decathlon', 'Asics',
    'New Balance', 'Fila', 'Lotto', '🆕 Autre (ajouter)'
  ],

  // Niveaux
  niveaux: [
    'Débutant', 'Intermédiaire', 'Avancé', 'Compétition', 'Professionnel',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS BIEN-ÊTRE & SPA
export const BIEN_ETRE_SPA_MODALITIES: ModalityCategory = {
  // Types de services
  types: [
    'Massage', 'Sauna', 'Hammam', 'Jacuzzi', 'Soin du visage', 'Soin du corps',
    'Gommage', 'Enveloppement', 'Réflexologie', 'Aromathérapie', 'Balnéothérapie',
    'Thalassothérapie', 'Yoga', 'Méditation', '🆕 Autre (ajouter)'
  ],

  // Types de massage
  massages: [
    'Massage suédois', 'Massage californien', 'Massage thaï', 'Massage ayurvédique',
    'Massage shiatsu', 'Massage deep tissue', 'Massage sportif', 'Massage relaxant',
    'Massage aux pierres chaudes', 'Massage aromathérapie', '🆕 Autre (ajouter)'
  ],

  // Durées
  durees: [
    '30 minutes', '45 minutes', '1 heure', '1h30', '2 heures', '3 heures',
    'Demi-journée', 'Journée complète', 'Forfait', '🆕 Autre (ajouter)'
  ],

  // Forfaits
  forfaits: [
    'Découverte', 'Détente', 'Bien-être', 'Prestige', 'VIP', 'Couple',
    'Enterrement de vie de jeune fille', 'Spa day', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ANIMAUX & VÉTÉRINAIRE
export const ANIMAUX_VETERINAIRE_MODALITIES: ModalityCategory = {
  // Types d'animaux
  animaux: [
    'Chien', 'Chat', 'Oiseau', 'Poisson', 'Rongeur', 'Reptile', 'Bétail',
    'Volaille', 'Cheval', 'Lapin', '🆕 Autre (ajouter)'
  ],

  // Services vétérinaires
  services: [
    'Consultation', 'Vaccination', 'Stérilisation', 'Chirurgie', 'Toilettage',
    'Garde d\'animaux', 'Dressage', 'Pension', 'Soins dentaires', 'Analyses',
    '🆕 Autre (ajouter)'
  ],

  // Produits pour animaux
  produits: [
    'Nourriture sèche', 'Nourriture humide', 'Friandises', 'Jouets', 'Accessoires',
    'Litière', 'Cage', 'Aquarium', 'Collier', 'Laisse', 'Médicaments',
    '🆕 Autre (ajouter)'
  ],

  // Races de chiens (populaires)
  races_chiens: [
    'Berger allemand', 'Labrador', 'Golden retriever', 'Bulldog', 'Caniche',
    'Chihuahua', 'Yorkshire', 'Pitbull', 'Rottweiler', 'Doberman', 'Husky',
    'Croisé', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS NETTOYAGE & ENTRETIEN
export const NETTOYAGE_ENTRETIEN_MODALITIES: ModalityCategory = {
  // Types de nettoyage
  types: [
    'Nettoyage de maison', 'Nettoyage de bureau', 'Nettoyage après chantier',
    'Nettoyage de vitres', 'Nettoyage de tapis', 'Nettoyage de voiture',
    'Jardinage', 'Piscine', 'Pressing', 'Repassage', 'Désinfection', '🆕 Autre (ajouter)'
  ],

  // Fréquences
  frequencies: [
    'Ponctuel', 'Hebdomadaire', 'Bihebdomadaire', 'Mensuel', 'Trimestriel',
    'Semestriel', 'Annuel', '🆕 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Aspirateur', 'Nettoyeur vapeur', 'Karcher', 'Balai', 'Serpillière',
    'Produits de nettoyage inclus', 'Matériel professionnel', '🆕 Autre (ajouter)'
  ],

  // Surfaces
  surfaces: [
    'Studio (< 30m²)', 'Petit appartement (30-50m²)', 'Moyen appartement (50-80m²)',
    'Grand appartement (80-120m²)', 'Maison (> 120m²)', 'Bureau', 'Local commercial',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS JARDINAGE & PAYSAGISME
export const JARDINAGE_PAYSAGISME_MODALITIES: ModalityCategory = {
  // Types de services
  services: [
    'Tonte de pelouse', 'Taille de haies', 'Élagage', 'Désherbage', 'Plantation',
    'Aménagement paysager', 'Création de jardin', 'Entretien de jardin',
    'Arrosage automatique', 'Terrasse et dallage', '🆕 Autre (ajouter)'
  ],

  // Types de plantes
  plantes: [
    'Arbres', 'Arbustes', 'Fleurs', 'Plantes grasses', 'Plantes d\'intérieur',
    'Potager', 'Gazon', 'Haies', 'Palmiers', 'Bambous', '🆕 Autre (ajouter)'
  ],

  // Matériel
  materiel: [
    'Tondeuse', 'Taille-haie', 'Débroussailleuse', 'Tronçonneuse', 'Souffleur',
    'Râteau', 'Bêche', 'Pelle', 'Arrosoir', 'Tuyau d\'arrosage', '🆕 Autre (ajouter)'
  ],

  // Fréquences d'entretien
  frequencies: [
    'Hebdomadaire', 'Bihebdomadaire', 'Mensuel', 'Trimestriel', 'Saisonnier',
    'Ponctuel', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS SÉCURITÉ & SURVEILLANCE
export const SECURITE_SURVEILLANCE_MODALITIES: ModalityCategory = {
  // Types de services
  services: [
    'Gardiennage', 'Surveillance vidéo', 'Alarme', 'Contrôle d\'accès', 'Sécurité événementielle',
    'Transport de fonds', 'Agent de sécurité', 'Maître-chien', 'Sécurité incendie',
    '🆕 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Caméra IP', 'Caméra analogique', 'DVR', 'NVR', 'Alarme sans fil', 'Alarme filaire',
    'Détecteur de mouvement', 'Sirène', 'Badge', 'Lecteur biométrique', 'Barrière',
    '🆕 Autre (ajouter)'
  ],

  // Types de caméras
  cameras: [
    'Dôme', 'Bullet', 'PTZ', '360°', 'Thermique', 'Avec vision nocturne',
    'Avec détection de mouvement', 'Avec audio', '🆕 Autre (ajouter)'
  ],

  // Résolutions
  resolutions: [
    '720p (1MP)', '1080p (2MP)', '4MP', '5MP', '8MP', '4K (8MP)', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS PLOMBERIE
export const PLOMBERIE_MODALITIES: ModalityCategory = {
  // Types de services
  services: [
    'Installation sanitaire', 'Réparation fuite', 'Débouchage', 'Installation chaudière',
    'Installation chauffe-eau', 'Raccordement', 'Entretien', 'Dépannage d\'urgence',
    '🆕 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Robinetterie', 'Lavabo', 'WC', 'Douche', 'Baignoire', 'Évier', 'Chauffe-eau',
    'Chaudière', 'Tuyauterie', 'Siphon', 'Mitigeur', '🆕 Autre (ajouter)'
  ],

  // Urgence
  urgences: [
    'Urgence 24h/24', 'Intervention rapide', 'Rendez-vous planifié',
    'Devis gratuit', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS ÉLECTRICITÉ
export const ELECTRICITE_MODALITIES: ModalityCategory = {
  // Types de services
  services: [
    'Installation électrique', 'Réparation', 'Dépannage', 'Mise aux normes',
    'Installation tableau électrique', 'Installation climatisation', 'Éclairage',
    'Interphone', 'Portail électrique', 'Domotique', '🆕 Autre (ajouter)'
  ],

  // Équipements
  equipements: [
    'Tableau électrique', 'Disjoncteur', 'Interrupteur', 'Prise', 'Luminaire',
    'Néon', 'LED', 'Câbles', 'Gaine', 'Détecteur de fumée', '🆕 Autre (ajouter)'
  ],

  // Urgence
  urgences: [
    'Urgence 24h/24', 'Intervention rapide', 'Rendez-vous planifié',
    'Devis gratuit', '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MENUISERIE
export const MENUISERIE_MODALITIES: ModalityCategory = {
  // Types de services
  services: [
    'Fabrication meubles', 'Réparation meubles', 'Installation porte', 'Installation fenêtre',
    'Parquet', 'Terrasse bois', 'Escalier', 'Placard sur mesure', 'Cuisine aménagée',
    'Pergola', 'Clôture', '🆕 Autre (ajouter)'
  ],

  // Bois
  bois: [
    'Chêne', 'Hêtre', 'Pin', 'Sapin', 'Teck', 'Acajou', 'Wengé', 'Bambou',
    'Contreplaqué', 'MDF', 'Aggloméré', '🆕 Autre (ajouter)'
  ],

  // Finitions
  finitions: [
    'Vernis', 'Peinture', 'Lasure', 'Huile', 'Cire', 'Brut', '🆕 Autre (ajouter)'
  ],

  // Styles
  styles: [
    'Moderne', 'Classique', 'Rustique', 'Industriel', 'Scandinave', 'Colonial',
    '🆕 Autre (ajouter)'
  ]
};

// ✅ MODALITÉS MUSIQUE & INSTRUMENTS
export const MUSIQUE_INSTRUMENTS_MODALITIES: ModalityCategory = {
  // Types d'instruments
  instruments: [
    'Guitare', 'Piano', 'Batterie', 'Basse', 'Violon', 'Saxophone', 'Trompette',
    'Flûte', 'Clavier', 'Djembé', 'Balafon', 'Tam-tam', 'Synthétiseur',
    '🆕 Autre (ajouter)'
  ],

  // Services musicaux
  services: [
    'Cours de musique', 'Location d\'instruments', 'Vente d\'instruments',
    'Réparation', 'Accordage', 'Animation musicale', 'DJ', 'Orchestre',
    'Groupe musical', '🆕 Autre (ajouter)'
  ],

  // Marques
  marques: [
    'Yamaha', 'Fender', 'Gibson', 'Roland', 'Korg', 'Casio', 'Steinway',
    'Pearl', 'Zildjian', '🆕 Autre (ajouter)'
  ],

  // Niveaux
  niveaux: [
    'Débutant', 'Intermédiaire', 'Avancé', 'Professionnel', '🆕 Autre (ajouter)'
  ]
};

// ✅ FONCTION POUR OBTENIR LES MODALITÉS PAR TYPE DE PRODUIT
// Cette fonction fait le mapping entre la catégorie du produit et ses modalités spécifiques
export const getModalitiesByProductType = (productType: string): ModalityCategory => {
  // Normaliser la catégorie (minuscules, suppression des espaces)
  const normalizedType = productType?.toLowerCase().trim() || '';

  console.log('[productModalities] Récupération modalités pour catégorie:', normalizedType);

  switch (normalizedType) {
    // ✅ AUTOMOBILE & TRANSPORT
    case 'automobile':
    case 'voiture':
    case 'vehicule':
    case 'moto':
      return AUTOMOBILE_MODALITIES;

    // ✅ IMMOBILIER
    case 'immobilier':
    case 'immobilier_batiment':
    case 'immobilier_terrain':
    case 'terrain':
    case 'maison':
    case 'appartement':
      return IMMOBILIER_MODALITIES;

    // ✅ HÔTELLERIE & HÉBERGEMENT
    case 'hotellerie':
    case 'hotel':
    case 'hebergement':
    case 'chambre':
      return HOTELLERIE_MODALITIES;

    // ✅ VOYAGE & TRANSPORT
    case 'voyage':
    case 'ticket_voyage':
    case 'covoiturage':
    case 'transport':
    case 'billet':
      return VOYAGE_MODALITIES;

    // ✅ VÊTEMENTS & MODE
    case 'vetement':
    case 'vêtement':
    case 'mode':
    case 'habit':
    case 'textile':
      return VETEMENTS_MODALITIES;

    // ✅ CHAUSSURES
    case 'chaussure':
    case 'soulier':
    case 'basket':
    case 'sandale':
      return CHAUSSURES_MODALITIES;

    // ✅ ÉLECTROMÉNAGER
    case 'electromenager':
    case 'électroménager':
    case 'appareil':
    case 'menager':
      return ELECTROMENAGER_MODALITIES;

    // ✅ IMAGE & SON
    case 'image_son':
    case 'tv':
    case 'television':
    case 'audio':
    case 'video':
    case 'multimedia':
      return IMAGE_SON_MODALITIES;

    // ✅ TÉLÉPHONES & SMARTPHONES
    case 'telephone':
    case 'téléphone':
    case 'smartphone':
    case 'mobile':
    case 'cellulaire':
      return TELEPHONES_MODALITIES;

    // ✅ ORDINATEURS & INFORMATIQUE
    case 'ordinateur':
    case 'pc':
    case 'laptop':
    case 'informatique':
    case 'tablette':
      return ORDINATEURS_MODALITIES;

    // ✅ MOBILIER & DÉCORATION
    case 'mobilier':
    case 'meuble':
    case 'decoration':
    case 'décoration':
    case 'ameublement':
      return MOBILIER_MODALITIES;

    // ✅ ALIMENTS FRAIS
    case 'aliment':
    case 'aliments':
    case 'nourriture':
    case 'frais':
    case 'fruit':
    case 'legume':
    case 'viande':
    case 'poisson':
      return ALIMENTS_MODALITIES;

    // ✅ AGROALIMENTAIRE (produits transformés)
    case 'agroalimentaire':
    case 'agro-alimentaire':
    case 'epicerie':
    case 'alimentaire':
    case 'conserve':
      return AGROALIMENTAIRE_MODALITIES;

    // ✅ LIVRES & FOURNITURES
    case 'livre':
    case 'livres':
    case 'livres_fournitures':
    case 'fourniture':
    case 'scolaire':
    case 'papeterie':
      return LIVRES_FOURNITURES_MODALITIES;

    // ✅ QUINCAILLERIE & BRICOLAGE
    case 'quincaillerie':
    case 'bricolage':
    case 'outil':
    case 'materiel':
    case 'construction':
      return QUINCAILLERIE_MODALITIES;

    // ✅ PRESTATIONS DE SERVICE
    case 'service':
    case 'prestation':
    case 'prestation_service':
    case 'services':
      return PRESTATIONS_SERVICE_MODALITIES;

    // ✅ PHARMACIE & SANTÉ
    case 'pharmacie':
    case 'medicament':
    case 'médicament':
    case 'sante':
    case 'santé':
    case 'hopital':
    case 'hôpital':
    case 'hopital_clinique':
    case 'clinique':
      return PHARMACIE_MODALITIES;

    // ✅ COSMÉTIQUES & PARFUMS
    case 'cosmetique':
    case 'cosmétique':
    case 'cosmetique_parfum':
    case 'parfum':
    case 'beaute':
    case 'beauté':
      return COSMETIQUES_PARFUMS_MODALITIES;

    // ✅ BIJOUX & ACCESSOIRES
    case 'bijou':
    case 'bijoux':
    case 'joaillerie':
    case 'accessoire':
      return BIJOUX_MODALITIES;

    // ✅ COIFFURE & BEAUTÉ
    case 'coiffure':
    case 'coiffure_beaute':
    case 'salon':
    case 'esthetique':
    case 'esthétique':
      return COIFFURE_BEAUTE_MODALITIES;

    // ✅ DÉMÉNAGEMENT
    case 'demenagement':
    case 'déménagement':
    case 'demenageur':
      return DEMENAGEMENT_MODALITIES;

    // ✅ ASSURANCE
    case 'assurance':
    case 'assurances':
      return ASSURANCE_MODALITIES;

    // ✅ JOUETS & ENFANTS
    case 'jouet':
    case 'jouets':
    case 'jouets_enfants':
    case 'enfant':
    case 'bebe':
    case 'bébé':
      return JOUETS_ENFANTS_MODALITIES;

    // ✅ USTENSILES DE CUISINE
    case 'ustensile':
    case 'ustensiles':
    case 'ustensiles_cuisine':
    case 'cuisine':
    case 'vaisselle':
      return USTENSILES_CUISINE_MODALITIES;

    // ✅ PIÈCES AUTO
    case 'piece_auto':
    case 'pieces_auto':
    case 'pièce_auto':
    case 'pièces_auto':
    case 'mecanique':
    case 'mécanique':
    case 'garage':
      return PIECES_AUTO_MODALITIES;

    // ✅ PIÈCES INDUSTRIELLES
    case 'piece_industrielle':
    case 'pieces_industrielles':
    case 'pièce_industrielle':
    case 'pièces_industrielles':
    case 'industriel':
    case 'machine':
      return PIECES_INDUSTRIELLES_MODALITIES;

    // ✅ RESTAURATION
    case 'restauration':
    case 'restaurant':
    case 'maquis':
    case 'bar':
    case 'cafe':
    case 'café':
    case 'boulangerie':
    case 'patisserie':
    case 'pâtisserie':
    case 'traiteur':
      return RESTAURATION_MODALITIES;

    // ✅ ÉLECTRONIQUE
    case 'electronique':
    case 'électronique':
    case 'hi-tech':
    case 'high-tech':
    case 'tech':
      return ELECTRONIQUE_MODALITIES;

    // ✅ FORMATION & ÉDUCATION
    case 'formation':
    case 'education':
    case 'éducation':
    case 'enseignement':
    case 'cours':
    case 'ecole':
    case 'école':
      return FORMATION_EDUCATION_MODALITIES;

    // ✅ ÉVÉNEMENTIEL
    case 'evenementiel':
    case 'événementiel':
    case 'evenement':
    case 'événement':
    case 'mariage':
    case 'fete':
    case 'fête':
    case 'ceremonie':
    case 'cérémonie':
      return EVENEMENTIEL_MODALITIES;

    // ✅ AGRICULTURE
    case 'agriculture':
    case 'agricole':
    case 'ferme':
    case 'elevage':
    case 'élevage':
    case 'peche':
    case 'pêche':
      return AGRICULTURE_MODALITIES;

    // ✅ SPORT & FITNESS
    case 'sport':
    case 'fitness':
    case 'gym':
    case 'gymnastique':
    case 'musculation':
    case 'entrainement':
    case 'entraînement':
      return SPORT_FITNESS_MODALITIES;

    // ✅ BIEN-ÊTRE & SPA
    case 'bien-etre':
    case 'bien-être':
    case 'spa':
    case 'massage':
    case 'relaxation':
    case 'detente':
    case 'détente':
      return BIEN_ETRE_SPA_MODALITIES;

    // ✅ ANIMAUX & VÉTÉRINAIRE
    case 'animaux':
    case 'animal':
    case 'veterinaire':
    case 'vétérinaire':
    case 'animalerie':
    case 'pet':
      return ANIMAUX_VETERINAIRE_MODALITIES;

    // ✅ NETTOYAGE & ENTRETIEN
    case 'nettoyage':
    case 'menage':
    case 'ménage':
    case 'entretien':
    case 'pressing':
    case 'lavage':
      return NETTOYAGE_ENTRETIEN_MODALITIES;

    // ✅ JARDINAGE & PAYSAGISME
    case 'jardinage':
    case 'jardin':
    case 'paysagisme':
    case 'paysage':
    case 'espaces_verts':
      return JARDINAGE_PAYSAGISME_MODALITIES;

    // ✅ SÉCURITÉ & SURVEILLANCE
    case 'securite':
    case 'sécurité':
    case 'surveillance':
    case 'gardiennage':
    case 'alarme':
    case 'camera':
    case 'caméra':
      return SECURITE_SURVEILLANCE_MODALITIES;

    // ✅ PLOMBERIE
    case 'plomberie':
    case 'plombier':
    case 'sanitaire':
      return PLOMBERIE_MODALITIES;

    // ✅ ÉLECTRICITÉ
    case 'electricite':
    case 'électricité':
    case 'electricien':
    case 'électricien':
    case 'installation_electrique':
      return ELECTRICITE_MODALITIES;

    // ✅ MENUISERIE
    case 'menuiserie':
    case 'menuisier':
    case 'bois':
    case 'charpente':
    case 'ebenisterie':
    case 'ébénisterie':
      return MENUISERIE_MODALITIES;

    // ✅ MUSIQUE & INSTRUMENTS
    case 'musique':
    case 'instrument':
    case 'instruments':
    case 'audio':
    case 'concert':
      return MUSIQUE_INSTRUMENTS_MODALITIES;

    // ✅ PAR DÉFAUT - Aucune modalité spécifique
    default:
      console.warn('[productModalities] ⚠️ Catégorie non reconnue:', productType);
      console.log('[productModalities] Utilisation des modalités génériques par défaut');
      // Retourner des modalités de base pour toute catégorie non reconnue
      return {
        types: ['Standard', 'Premium', 'Professionnel', '🆕 Autre (ajouter)'],
        etats: ['Neuf', 'Occasion - Bon état', 'Occasion - Moyen', '🆕 Autre (ajouter)'],
        services: ['Installation', 'Réparation', 'Maintenance', 'Consultation', '🆕 Autre (ajouter)']
      };
  }
};

// ✅ FONCTION POUR AJOUTER UNE NOUVELLE MODALITÉ
export const addCustomModality = (
  productType: string,
  fieldName: string,
  newModality: string
): void => {
  const modalities = getModalitiesByProductType(productType);
  if (modalities[fieldName]) {
    // Ajouter la nouvelle modalité avant "🆕 Autre (ajouter)"
    const index = modalities[fieldName].findIndex(item => item.includes('🆕 Autre'));
    if (index > -1) {
      modalities[fieldName].splice(index, 0, newModality);
    } else {
      modalities[fieldName].push(newModality);
    }
  }
};

// ✅ FONCTION POUR OBTENIR LES OPTIONS D'UN CHAMP SPÉCIFIQUE
export const getFieldOptions = (productType: string, fieldName: string): string[] => {
  const modalities = getModalitiesByProductType(productType);
  const options = modalities[fieldName] || [];

  console.log(`[productModalities] Options pour ${productType} > ${fieldName}:`, options.length);

  // ✅ CORRECTION: Toujours ajouter l'option pour créer une nouvelle modalité
  // si elle n'existe pas déjà
  if (!options.some(opt => opt.includes('🆕'))) {
    return [...options, '🆕 Autre (ajouter)'];
  }

  return options;
};

// ✅ FONCTION POUR OBTENIR TOUTES LES CATÉGORIES DISPONIBLES
export const getAllCategories = (): string[] => {
  return [
    'automobile', 'immobilier', 'hotellerie', 'voyage', 'vetement', 'chaussure',
    'electromenager', 'image_son', 'telephone', 'ordinateur', 'mobilier',
    'aliments', 'agroalimentaire', 'livres_fournitures', 'quincaillerie',
    'prestation_service', 'pharmacie', 'cosmetique_parfum', 'bijoux',
    'coiffure_beaute', 'demenagement', 'assurance', 'jouets_enfants',
    'ustensiles_cuisine', 'pieces_auto', 'pieces_industrielles', 'restauration',
    'electronique', 'formation', 'evenementiel', 'agriculture', 'sport',
    'bien-etre', 'animaux', 'nettoyage', 'jardinage', 'securite', 'plomberie',
    'electricite', 'menuiserie', 'musique'
  ];
};

// ✅ FONCTION POUR OBTENIR LE NOMBRE TOTAL DE CATÉGORIES
export const getCategoriesCount = (): number => {
  return getAllCategories().length;
};

// ✅ FONCTION POUR VÉRIFIER SI UNE CATÉGORIE A DES MODALITÉS
export const hasModalities = (productType: string): boolean => {
  const modalities = getModalitiesByProductType(productType);
  return Object.keys(modalities).length > 0;
};

// ✅ FONCTION POUR OBTENIR LE NOMBRE DE CHAMPS AVEC MODALITÉS POUR UNE CATÉGORIE
export const getModalitiesFieldsCount = (productType: string): number => {
  const modalities = getModalitiesByProductType(productType);
  return Object.keys(modalities).length;
};


