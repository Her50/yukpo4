# 🔑 Mots-clés pour les 41 Catégories

## Format JavaScript à intégrer

```javascript
const CATEGORY_KEYWORDS = {
    // ✅ DÉJÀ FAIT
    agroalimentaire: ['riz', 'pâtes', 'macaroni', 'spaghetti', 'farine', 'huile', 'arachide', 'palme', 'tournesol', 'olive', 'sucre', 'sel', 'épices', 'conserve', 'sardine', 'thon', 'boisson', 'eau', 'jus', 'soda', 'café', 'thé', 'lait', 'chocolat', 'biscuit', 'chips', 'snack', 'bonbon', 'céréale', 'avoine', 'blé', 'maïs', 'produit alimentaire', 'transformation'],
    
    aliments: ['fruit', 'légume', 'viande', 'poisson', 'bœuf', 'poulet', 'porc', 'mouton', 'chèvre', 'tomate', 'oignon', 'pomme', 'banane', 'orange', 'mangue', 'avocat', 'ananas', 'carotte', 'chou', 'salade', 'frais', 'marché'],
    
    prestation_service: ['plombier', 'électricien', 'mécanicien', 'menuisier', 'peintre', 'maçon', 'serrurier', 'jardinier', 'coiffeur', 'esthéticienne', 'photographe', 'graphiste', 'développeur', 'informaticien', 'technicien', 'réparateur', 'cuisinier', 'traiteur', 'chauffeur', 'livreur', 'coach', 'professeur', 'traducteur', 'architecte', 'ingénieur', 'vétérinaire', 'DJ', 'musicien', 'artisan', 'professionnel'],

    // 🆕 À AJOUTER
    assurance: ['assurance', 'protection', 'garantie', 'prime', 'contrat', 'couverture', 'police', 'assureur', 'sinistre', 'indemnisation', 'franchise', 'souscription', 'assurance auto', 'assurance santé', 'assurance habitation', 'assurance vie', 'mutuelle', 'prévoyance', 'responsabilité civile', 'tous risques'],

    automobile: ['voiture', 'auto', 'véhicule', 'automobile', 'moto', 'motocyclette', 'scooter', 'camion', '4x4', 'SUV', 'berline', 'coupé', 'cabriolet', 'break', 'monospace', 'utilitaire', 'pick-up', 'Toyota', 'Honda', 'Mercedes', 'Peugeot', 'Renault', 'Nissan', 'occasion', 'neuf', 'kilométrage', 'essence', 'diesel', 'hybride', 'électrique', 'automatique', 'manuelle'],

    chaussure: ['chaussure', 'soulier', 'basket', 'sneaker', 'sandale', 'tong', 'claquette', 'botte', 'bottine', 'escarpin', 'talon', 'mocassin', 'derby', 'richelieu', 'ballerine', 'nu-pied', 'sabot', 'chausson', 'pointure', 'semelle', 'cuir', 'sport', 'ville', 'Nike', 'Adidas', 'Puma'],

    covoiturage: ['covoiturage', 'trajet', 'partage', 'carpooling', 'transport', 'passager', 'conducteur', 'départ', 'arrivée', 'itinéraire', 'route', 'place disponible', 'voyage partagé', 'économie', 'écologique'],

    decoration: ['décoration', 'déco', 'tableau', 'toile', 'peinture', 'affiche', 'poster', 'cadre', 'luminaire', 'lampe', 'lustre', 'applique', 'suspension', 'plafonnier', 'tapis', 'carpette', 'descente de lit', 'coussin', 'rideau', 'voilage', 'store', 'vase', 'sculpture', 'statue', 'miroir', 'horloge', 'bougie', 'photophore', 'plante', 'artificielle', 'moderne', 'classique', 'vintage', 'contemporain'],

    electricite: ['électricité', 'électrique', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'tableau électrique', 'lampe', 'ampoule', 'LED', 'néon', 'halogène', 'spot', 'variateur', 'minuterie', 'détecteur', 'sonnette', 'multiprise', 'rallonge', 'domino', 'gaine', 'conduit', '220V', 'installation', 'circuit', 'phase', 'neutre', 'terre'],

    electromenager: ['électroménager', 'frigo', 'réfrigérateur', 'congélateur', 'four', 'cuisinière', 'plaque', 'micro-ondes', 'lave-linge', 'machine à laver', 'lave-vaisselle', 'sèche-linge', 'hotte', 'robot', 'mixer', 'mixeur', 'blender', 'cafetière', 'bouilloire', 'grille-pain', 'fer à repasser', 'aspirateur', 'climatiseur', 'ventilateur', 'radiateur', 'chauffage', 'Samsung', 'LG', 'Bosch', 'Whirlpool'],

    hopital_clinique: ['hôpital', 'clinique', 'centre médical', 'centre de santé', 'établissement', 'hospitalier', 'médecin', 'docteur', 'spécialiste', 'consultation', 'urgence', 'urgences', 'urgentiste', 'soins', 'traitement', 'chirurgie', 'bloc opératoire', 'imagerie', 'radio', 'scanner', 'IRM', 'laboratoire', 'analyses', 'maternité', 'pédiatrie', 'cardiologie', 'dentiste', 'ophtalmologie', 'rendez-vous', 'hospitalisation'],

    hotellerie: ['hôtel', 'hébergement', 'chambre', 'chambre d\'hôtes', 'auberge', 'gîte', 'résidence', 'motel', 'palace', 'réservation', 'booking', 'nuitée', 'séjour', 'étoile', 'luxe', 'économique', 'petit-déjeuner', 'demi-pension', 'pension complète', 'Wi-Fi', 'piscine', 'restaurant', 'bar', 'spa', 'climatisation', 'vue mer', 'centre-ville', 'aéroport'],

    image_son: ['télévision', 'TV', 'téléviseur', 'écran', 'moniteur', 'home cinéma', 'cinéma maison', 'enceinte', 'haut-parleur', 'barre de son', 'soundbar', 'amplificateur', 'ampli', 'projecteur', 'vidéoprojecteur', 'système audio', 'chaîne hi-fi', 'platine', 'vinyle', 'lecteur DVD', 'Blu-ray', 'casque', 'écouteurs', 'micro', 'microphone', '4K', '8K', 'HD', 'Full HD', 'UHD', 'OLED', 'QLED', 'LCD', 'LED', 'Samsung', 'Sony', 'LG'],

    immobilier_batiment: ['immobilier', 'appartement', 'appart', 'F2', 'F3', 'F4', 'villa', 'maison', 'studio', 'duplex', 'triplex', 'loft', 'penthouse', 'vente', 'location', 'louer', 'acheter', 'bail', 'loyer', 'chambre', 'salon', 'cuisine', 'salle de bain', 'WC', 'toilette', 'balcon', 'terrasse', 'jardin', 'garage', 'parking', 'meublé', 'non meublé', 'neuf', 'ancien', 'standing', 'quartier', 'arrondissement'],

    immobilier_terrain: ['terrain', 'parcelle', 'lot', 'terrain constructible', 'constructible', 'viabilisé', 'non viabilisé', 'terrain agricole', 'champ', 'plantation', 'terre', 'titre foncier', 'cadastre', 'superficie', 'hectare', 'mètre carré', 'clôturé', 'bornage', 'lotissement', 'domaine', 'propriété'],

    jouets_enfants: ['jouet', 'jeu', 'enfant', 'bébé', 'peluche', 'poupée', 'poupon', 'figurine', 'voiture miniature', 'puzzle', 'casse-tête', 'lego', 'construction', 'éducatif', 'éveil', 'jeu de société', 'carte', 'ballon', 'vélo', 'trottinette', 'poussette', 'berceau', 'parc', 'transat', 'hochet', 'doudou', 'livre enfant', 'coloriage', 'dessin', '0-3 ans', '3-6 ans', '6-12 ans'],

    livres_fournitures: ['livre', 'manuel', 'manuel scolaire', 'cahier', 'classeur', 'feuille', 'papier', 'stylo', 'crayon', 'gomme', 'règle', 'équerre', 'compas', 'rapporteur', 'trousse', 'cartable', 'sac à dos', 'ardoise', 'marqueur', 'feutre', 'surligneur', 'correcteur', 'taille-crayon', 'calculatrice', 'dictionnaire', 'atlas', 'roman', 'BD', 'bande dessinée', 'maternelle', 'primaire', 'secondaire', 'lycée', 'université', 'mathématiques', 'français', 'anglais', 'histoire', 'géographie', 'sciences'],

    mobilier: ['meuble', 'mobilier', 'ameublement', 'canapé', 'fauteuil', 'chaise', 'table', 'bureau', 'armoire', 'placard', 'commode', 'étagère', 'bibliothèque', 'lit', 'matelas', 'sommier', 'tiroir', 'rangement', 'console', 'buffet', 'vitrine', 'bar', 'tabouret', 'banquette', 'salon', 'chambre', 'salle à manger', 'bois', 'métal', 'cuir', 'tissu', 'moderne', 'ancien', 'vintage', 'design', 'IKEA'],

    ordinateur: ['ordinateur', 'PC', 'computer', 'laptop', 'portable', 'bureau', 'desktop', 'MacBook', 'iMac', 'tablette', 'iPad', 'processeur', 'CPU', 'Intel', 'AMD', 'RAM', 'mémoire', 'disque dur', 'SSD', 'carte graphique', 'GPU', 'écran', 'clavier', 'souris', 'imprimante', 'scanner', 'webcam', 'Windows', 'macOS', 'Linux', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Apple', 'informatique', 'gaming', 'gamer'],

    pharmacie: ['pharmacie', 'pharmacien', 'médicament', 'médoc', 'ordonnance', 'prescription', 'garde', 'pharmacie de garde', 'urgence', 'nuit', 'dimanche', 'férié', 'parapharmacie', 'vitamine', 'complément', 'pansement', 'bandage', 'sirop', 'comprimé', 'gélule', 'crème', 'pommade', 'antiseptique', 'désinfectant', 'thermomètre', 'test', 'générique', 'doliprane', 'paracétamol', 'ibuprofène'],

    demenagement: ['déménagement', 'déménager', 'dém', 'déménageur', 'manutention', 'transport', 'camion', 'camionnette', 'carton', 'emballage', 'caisse', 'meuble', 'piano', 'monte-meuble', 'garde-meuble', 'stockage', 'entreposage', 'local', 'national', 'international', 'express', 'économique', 'standard', 'premium', 'assurance', 'devis', 'tarif', 'forfait'],

    cosmetique_parfum: ['cosmétique', 'parfum', 'maquillage', 'beauté', 'soin', 'crème', 'lotion', 'sérum', 'masque', 'gommage', 'exfoliant', 'hydratant', 'anti-âge', 'fond de teint', 'rouge à lèvres', 'gloss', 'mascara', 'eye-liner', 'ombre à paupières', 'vernis', 'dissolvant', 'eau de toilette', 'eau de parfum', 'déodorant', 'gel douche', 'savon', 'shampoing', 'après-shampoing', 'huile', 'beurre', 'Chanel', 'Dior', 'L\'Oréal', 'Nivea', 'naturel', 'bio'],

    bijoux: ['bijou', 'bijouterie', 'collier', 'pendentif', 'bague', 'alliance', 'bracelet', 'gourmette', 'jonc', 'boucle d\'oreille', 'créole', 'montre', 'chaîne', 'médaille', 'broche', 'épingle', 'or', 'argent', 'platine', 'diamant', 'pierre précieuse', 'pierre fine', 'rubis', 'saphir', 'émeraude', 'perle', 'carat', 'karat', '18k', '14k', 'plaqué or', 'fantaisie', 'artisanal', 'Cartier', 'Tiffany'],

    coiffure_beaute: ['coiffure', 'cheveu', 'mèche', 'extension', 'perruque', 'postiche', 'tissage', 'tresse', 'natte', 'locks', 'défrisage', 'lissage', 'bouclage', 'permanente', 'coloration', 'teinture', 'décoloration', 'balayage', 'mèches', 'highlights', 'coupe', 'brushing', 'séchage', 'lisse', 'bouclé', 'ondulé', 'naturel', 'synthétique', 'brésilienne', 'indienne', 'péruvienne', 'remy hair', 'virgin hair', 'clip', 'pose', 'entretien'],

    pieces_auto: ['pièce auto', 'pièce détachée', 'pièce automobile', 'pièce voiture', 'pièce moto', 'moteur', 'frein', 'disque', 'plaquette', 'carrosserie', 'pare-choc', 'aile', 'capot', 'porte', 'hayon', 'rétroviseur', 'phare', 'feu', 'clignotant', 'filtre', 'huile', 'air', 'habitacle', 'batterie', 'alternateur', 'démarreur', 'bougie', 'courroie', 'distribution', 'embrayage', 'suspension', 'amortisseur', 'rotule', 'vidange', 'entretien', 'réparation', 'garage'],

    pieces_industrielles: ['pièce industrielle', 'pièce machine', 'roulement', 'palier', 'courroie', 'chaîne', 'poulie', 'pignon', 'engrenage', 'moteur', 'électrique', 'hydraulique', 'pneumatique', 'pompe', 'compresseur', 'vanne', 'robinet', 'vérin', 'tuyau', 'raccord', 'joint', 'vis', 'boulon', 'écrou', 'rondelle', 'acier', 'inox', 'aluminium', 'laiton', 'industriel', 'usine', 'machine-outil', 'maintenance'],

    quincaillerie: ['quincaillerie', 'outil', 'outillage', 'marteau', 'tournevis', 'clé', 'pince', 'scie', 'perceuse', 'visseuse', 'meuleuse', 'ponceuse', 'matériaux', 'matériau', 'construction', 'ciment', 'sable', 'gravier', 'brique', 'parpaing', 'fer', 'acier', 'béton', 'mortier', 'plâtre', 'peinture', 'vernis', 'colle', 'mastic', 'sanitaire', 'plomberie', 'robinet', 'tuyau', 'WC', 'lavabo', 'douche', 'baignoire', 'câble', 'fil', 'interrupteur', 'prise', 'disjoncteur', 'lampe', 'ampoule'],

    telephone: ['téléphone', 'smartphone', 'mobile', 'portable', 'cellulaire', 'iPhone', 'Samsung', 'Huawei', 'Xiaomi', 'Oppo', 'Tecno', 'Infinix', 'Nokia', 'Motorola', 'Galaxy', 'Android', 'iOS', 'écran', 'tactile', 'appareil photo', 'caméra', 'selfie', 'double SIM', '4G', '5G', 'Wi-Fi', 'Bluetooth', 'stockage', '64GB', '128GB', '256GB', 'RAM', 'batterie', 'chargeur', 'coque', 'protection', 'écouteurs', 'kit mains libres', 'neuf', 'occasion', 'débloqué'],

    ticket_voyage: ['ticket', 'billet', 'voyage', 'transport', 'bus', 'car', 'autobus', 'train', 'avion', 'vol', 'bateau', 'ferry', 'départ', 'arrivée', 'destination', 'trajet', 'itinéraire', 'place', 'siège', 'réservation', 'aller simple', 'aller-retour', 'économique', 'affaires', 'première classe', 'VIP', 'escale', 'direct', 'agence', 'compagnie', 'horaire'],

    ustensiles_cuisine: ['ustensile', 'cuisine', 'casserole', 'poêle', 'sauteuse', 'faitout', 'marmite', 'cocotte', 'wok', 'grill', 'couteau', 'planche à découper', 'économe', 'râpe', 'fouet', 'louche', 'écumoire', 'spatule', 'cuillère', 'fourchette', 'mixer', 'mixeur', 'blender', 'robot', 'balance', 'verre doseur', 'batterie', 'inox', 'aluminium', 'téflon', 'anti-adhésif', 'set'],

    vetement: ['vêtement', 'habit', 'mode', 'fashion', 'prêt-à-porter', 'textile', 'chemise', 'chemisier', 'polo', 'T-shirt', 'tee-shirt', 'pull', 'sweat', 'gilet', 'veste', 'manteau', 'blouson', 'pantalon', 'jean', 'short', 'bermuda', 'jupe', 'robe', 'costume', 'tailleur', 'ensemble', 'sous-vêtement', 'caleçon', 'slip', 'boxer', 'culotte', 'soutien-gorge', 'chaussette', 'collant', 'écharpe', 'foulard', 'cravate', 'ceinture', 'gant', 'bonnet', 'chapeau', 'casquette', 'homme', 'femme', 'enfant', 'bébé', 'taille', 'coton', 'soie', 'lin', 'laine', 'polyester', 'Zara', 'H&M'],

    // NOUVELLES CATÉGORIES
    restauration: ['restaurant', 'resto', 'restauration', 'cuisine', 'gastronomie', 'chef', 'cuisinier', 'repas', 'menu', 'carte', 'plat', 'entrée', 'dessert', 'spécialité', 'français', 'italien', 'chinois', 'africain', 'camerounais', 'ndolé', 'eru', 'koki', 'poisson braisé', 'poulet DG', 'fast-food', 'maquis', 'snack', 'pizzeria', 'cafétéria', 'brasserie', 'réservation', 'livraison', 'traiteur', 'buffet', 'déjeuner', 'dîner'],

    electronique: ['électronique', 'gadget', 'appareil électronique', 'drone', 'caméra', 'GoPro', 'appareil photo', 'reflex', 'objectif', 'trépied', 'flash', 'console de jeu', 'PlayStation', 'Xbox', 'Nintendo', 'Switch', 'manette', 'jeu vidéo', 'gaming', 'VR', 'réalité virtuelle', 'smartwatch', 'montre connectée', 'bracelet connecté', 'enceinte Bluetooth', 'JBL', 'Bose', 'powerbank', 'batterie externe'],

    musique_instruments: ['musique', 'instrument', 'musical', 'guitare', 'acoustique', 'électrique', 'basse', 'piano', 'clavier', 'synthétiseur', 'batterie', 'percussion', 'djembé', 'tam-tam', 'balafon', 'saxophone', 'trompette', 'flûte', 'violon', 'violoncelle', 'contrebasse', 'micro', 'ampli', 'amplificateur', 'pédale', 'effet', 'sono', 'sonorisation', 'console', 'table de mixage', 'casque', 'studio', 'enregistrement', 'Yamaha', 'Fender', 'Gibson', 'Roland'],

    formation_education: ['formation', 'éducation', 'cours', 'apprentissage', 'enseignement', 'école', 'centre de formation', 'institut', 'académie', 'stage', 'atelier', 'workshop', 'séminaire', 'conférence', 'professeur', 'formateur', 'enseignant', 'tuteur', 'présentiel', 'distanciel', 'en ligne', 'e-learning', 'diplôme', 'certificat', 'attestation', 'qualification', 'compétence', 'skill', 'débutant', 'intermédiaire', 'avancé', 'professionnel', 'langue', 'informatique', 'bureautique', 'commerce', 'gestion', 'marketing'],

    evenementiel: ['événement', 'event', 'évènementiel', 'organisation', 'organisateur', 'mariage', 'noce', 'anniversaire', 'baptême', 'communion', 'réception', 'cérémonie', 'fête', 'soirée', 'gala', 'cocktail', 'séminaire', 'conférence', 'salon', 'exposition', 'concert', 'spectacle', 'salle', 'location', 'décoration', 'traiteur', 'animation', 'DJ', 'musique', 'sono', 'éclairage', 'chaise', 'table', 'nappe', 'vaisselle', 'tente', 'chapiteau'],

    agriculture: ['agriculture', 'agricole', 'ferme', 'fermier', 'agriculteur', 'plantation', 'culture', 'récolte', 'moisson', 'semence', 'graine', 'engrais', 'pesticide', 'traitement', 'irrigation', 'arrosage', 'tracteur', 'charrue', 'houe', 'machette', 'bêche', 'serfouette', 'manioc', 'maïs', 'riz', 'haricot', 'arachide', 'cacao', 'café', 'banane', 'plantain', 'igname', 'patate', 'tomate', 'piment', 'oignon', 'légume', 'fruit', 'bio', 'biologique', 'organique', 'saison', 'saisonnalité'],

    sport_fitness: ['sport', 'fitness', 'gym', 'gymnastique', 'musculation', 'cardio', 'entraînement', 'workout', 'training', 'coach', 'coach sportif', 'personal trainer', 'salle de sport', 'club', 'centre sportif', 'haltère', 'poids', 'barre', 'banc', 'tapis de course', 'vélo', 'elliptique', 'rameur', 'corde à sauter', 'yoga', 'pilates', 'zumba', 'danse', 'boxe', 'karaté', 'judo', 'taekwondo', 'football', 'basket', 'tennis', 'natation', 'piscine', 'course', 'running', 'jogging', 'marathon', 'nutrition', 'diététique', 'perte de poids', 'prise de masse'],

    bien_etre_spa: ['bien-être', 'spa', 'massage', 'masseur', 'masseuse', 'relaxation', 'détente', 'zen', 'thérapie', 'soin', 'hammam', 'sauna', 'jacuzzi', 'bain', 'aromathérapie', 'huile essentielle', 'réflexologie', 'shiatsu', 'ayurvéda', 'thaï', 'suédois', 'californien', 'pierres chaudes', 'gommage', 'enveloppement', 'hydrothérapie', 'thalasso', 'institut', 'beauté', 'esthétique', 'manucure', 'pédicure', 'onglerie', 'épilation', 'soin visage', 'soin corps', 'anti-stress', 'méditation'],

    animaux_veterinaire: ['animal', 'animaux', 'vétérinaire', 'véto', 'clinique vétérinaire', 'cabinet vétérinaire', 'chien', 'chat', 'chiot', 'chaton', 'oiseau', 'perroquet', 'poisson', 'aquarium', 'rongeur', 'lapin', 'hamster', 'cochon d\'Inde', 'reptile', 'serpent', 'tortue', 'vaccination', 'vaccin', 'stérilisation', 'castration', 'vermifuge', 'antiparasitaire', 'puce', 'tique', 'toilettage', 'toiletteur', 'dressage', 'dresseur', 'éducation', 'pension', 'garde', 'nourriture', 'croquette', 'pâtée', 'accessoire', 'collier', 'laisse', 'cage', 'niche', 'litière'],

    nettoyage_entretien: ['nettoyage', 'entretien', 'ménage', 'nettoyeur', 'femme de ménage', 'agent d\'entretien', 'société de nettoyage', 'nettoyage à domicile', 'nettoyage de bureau', 'nettoyage industriel', 'nettoyage après travaux', 'nettoyage de fin de chantier', 'nettoyage vitre', 'lavage', 'aspirateur', 'balai', 'serpillière', 'détergent', 'produit', 'javel', 'désinfectant', 'cire', 'polish', 'repassage', 'pressing', 'blanchisserie', 'laverie', 'tapis', 'moquette', 'canapé', 'matelas', 'rideau', 'récurrent', 'ponctuel', 'hebdomadaire', 'mensuel'],

    jardinage_paysagisme: ['jardinage', 'jardin', 'jardinier', 'paysagiste', 'paysagisme', 'espaces verts', 'parc', 'pelouse', 'gazon', 'tonte', 'tondeuse', 'taille', 'élagage', 'élagueur', 'arbre', 'arbuste', 'haie', 'plante', 'fleur', 'rosier', 'palmier', 'semis', 'plantation', 'arrosage', 'irrigation', 'engrais', 'terreau', 'compost', 'débroussaillage', 'désherbage', 'traitement', 'aménagement', 'conception', 'projet', 'entretien', 'saisonnier', 'outil', 'bêche', 'râteau', 'sécateur', 'scie'],

    securite_surveillance: ['sécurité', 'surveillance', 'vigile', 'gardien', 'agent de sécurité', 'garde', 'protection', 'gardiennage', 'rondes', 'alarme', 'système d\'alarme', 'alarme incendie', 'détecteur', 'caméra', 'vidéosurveillance', 'CCTV', 'contrôle d\'accès', 'badge', 'interphone', 'visiophone', 'portail', 'barrière', 'porte blindée', 'serrure', 'cadenas', 'coffre-fort', 'extincteur', 'sécurité incendie', 'événementiel', 'concert', 'manifestation', 'magasin', 'entreprise', 'résidentiel', 'particulier'],

    plomberie: ['plomberie', 'plombier', 'sanitaire', 'eau', 'robinet', 'robinetterie', 'mitigeur', 'mélangeur', 'lavabo', 'évier', 'douche', 'baignoire', 'WC', 'toilette', 'chasse d\'eau', 'tuyau', 'canalisation', 'tuyauterie', 'raccord', 'coude', 'té', 'vanne', 'soupape', 'clapet', 'chauffe-eau', 'ballon', 'cumulus', 'chaudière', 'chauffage', 'radiateur', 'fuite', 'débouchage', 'dégorgement', 'canalisation bouchée', 'urgence', 'dépannage', 'installation', 'réparation', 'rénovation'],

    electricite_service: ['électricité', 'électricien', 'installation électrique', 'tableau électrique', 'disjoncteur', 'différentiel', 'prise', 'interrupteur', 'va-et-vient', 'télérupteur', 'minuterie', 'détecteur', 'câblage', 'câble', 'fil', 'gaine', 'conduit', 'lampe', 'luminaire', 'applique', 'plafonnier', 'spot', 'LED', 'ampoule', 'variateur', 'sonnette', 'interphone', 'visiophone', 'antenne', 'parabole', 'dépannage', 'urgence', 'panne', 'court-circuit', 'installation', 'rénovation', 'mise aux normes', 'normes', 'certification', 'électrique'],

    menuiserie: ['menuiserie', 'menuisier', 'bois', 'ébéniste', 'ébénisterie', 'charpente', 'charpentier', 'porte', 'fenêtre', 'volet', 'portail', 'portillon', 'escalier', 'rampe', 'garde-corps', 'placard', 'dressing', 'cuisine', 'aménagement', 'meuble', 'sur mesure', 'bois massif', 'contreplaqué', 'MDF', 'aggloméré', 'pin', 'chêne', 'acajou', 'teck', 'iroko', 'sipo', 'vernis', 'lasure', 'peinture', 'ponçage', 'rabotage', 'assemblage', 'collage', 'clouage', 'vissage', 'installation', 'réparation', 'rénovation', 'restauration'],

    autre: ['autre', 'divers', 'varié', 'mixte', 'général', 'non classé', 'catégorie autre', 'produit', 'service', 'article', 'objet', 'chose', 'item']
};
```

## 🎯 **Total** : 41 catégories avec mots-clés distincts





