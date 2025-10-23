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

// ✅ MODALITÉS ALIMENTS
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

// ✅ FONCTION POUR OBTENIR LES MODALITÉS PAR TYPE DE PRODUIT
export const getModalitiesByProductType = (productType: string): ModalityCategory => {
  switch (productType) {
    case 'automobile':
      return AUTOMOBILE_MODALITIES;
    case 'immobilier_batiment':
    case 'immobilier_terrain':
      return IMMOBILIER_MODALITIES;
    case 'hotellerie':
      return HOTELLERIE_MODALITIES;
    case 'ticket_voyage':
    case 'covoiturage':
      return VOYAGE_MODALITIES;
    case 'vetement':
      return VETEMENTS_MODALITIES;
    case 'chaussure':
      return CHAUSSURES_MODALITIES;
    case 'electromenager':
      return ELECTROMENAGER_MODALITIES;
    case 'image_son':
      return IMAGE_SON_MODALITIES;
    case 'telephone':
      return TELEPHONES_MODALITIES;
    case 'ordinateur':
      return ORDINATEURS_MODALITIES;
    case 'mobilier':
    case 'decoration':
      return MOBILIER_MODALITIES;
    case 'aliments':
      return ALIMENTS_MODALITIES;
    case 'livres_fournitures':
      return LIVRES_FOURNITURES_MODALITIES;
    case 'quincaillerie':
      return QUINCAILLERIE_MODALITIES;
    case 'prestation_service':
      return PRESTATIONS_SERVICE_MODALITIES;
    case 'pharmacie':
    case 'hopital_clinique':
      return PHARMACIE_MODALITIES;
    case 'cosmetique_parfum':
      return COSMETIQUES_PARFUMS_MODALITIES;
    case 'bijoux':
      return BIJOUX_MODALITIES;
    case 'coiffure_beaute':
      return COIFFURE_BEAUTE_MODALITIES;
    case 'demenagement':
      return DEMENAGEMENT_MODALITIES;
    case 'assurance':
      return ASSURANCE_MODALITIES;
    case 'jouets_enfants':
      return JOUETS_ENFANTS_MODALITIES;
    case 'ustensiles_cuisine':
      return USTENSILES_CUISINE_MODALITIES;
    case 'pieces_auto':
      return PIECES_AUTO_MODALITIES;
    case 'pieces_industrielles':
      return PIECES_INDUSTRIELLES_MODALITIES;
    default:
      return {};
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
  return modalities[fieldName] || [];
};


