// 📁 src/utils/form_constraint_dispatcher.ts
// 🔁 Dispatcher intelligent des contraintes du profil_ia généré par le moteur IA Yukpo

type ChampIA = {
  valeur: any;
  type_donnee: string;

  // ✅ Ajouts pour support IA évolutif
  min?: number;
  max?: number;
  unite?: string;
  regex?: string;
  placeholder?: string;
};

type ProfilIA = {
  contexte_demande: ChampIA;
  [cle: string]: ChampIA;
};

export type ComposantFrontend = {
  nomChamp: string;
  typeDonnee: string;
  composant: string;
  obligatoire: boolean;
  tooltip?: string;
  exemple?: string;
  priorite?: number; // ✅ Ajout pour l'ordre d'affichage

  // ✅ Ajouts pour validation dynamique frontend
  min?: number;
  max?: number;
  unite?: string;
  regex?: string;
  placeholder?: string;

  // 🔄 Autoriser les extensions IA libres
  [key: string]: any;
};

type ServiceDetecte = {
  modele_service: string;
  profil_ia: ProfilIA;
  origine_champs: Record<string, string[]>;
  medias_utilises: {
    images: string[];
    documents: string[];
    audio: boolean;
    texte: boolean;
  };
};

type YukpoIAResponse = {
  services_detectes?: ServiceDetecte[];
  service_refuse?: boolean;
  motif_refus?: string;
  status?: string;
  intention?: string;
  data?: any;
};

const TOOLTIP_PAR_TYPE: Record<string, string> = {
  texte: "Champ texte libre",
  nombre: "Valeur numérique attendue",
  booléen: "Cochez si applicable",
  gps: "Localisez ce champ sur une carte",
  image: "Téléchargez une ou plusieurs images",
  video: "Ajoutez une vidéo explicative",
  audio: "Ajoutez une note audio",
  excel: "Fichier de données Excel (xlsx)",
  document: "Ajoutez un document justificatif",
  email: "Adresse email au format valide",
  téléphone: "Numéro de téléphone au format international",
  whatsapp: "Numéro WhatsApp (obligatoire)",
  url: "Lien web valide",
  website: "Site web de votre service",
  datetime: "Sélectionnez une date et une heure",
  liste: "Choisissez plusieurs options",
  objet: "Structure composée de sous-champs",
};

const EXEMPLES_PAR_TYPE: Record<string, string> = {
  texte: "Ex : Quartier Bonamoussadi",
  nombre: "Ex : 45000",
  gps: "Ex : 4.065, 9.712",
  image: "Ex : photo_de_la_maison.jpg",
  video: "Ex : visite_video.mp4",
  audio: "Ex : commentaire_audio.mp3",
  excel: "Ex : planning.xlsx",
  document: "Ex : devis.pdf",
  email: "Ex : contact@monservice.com",
  téléphone: "Ex : +237690000000",
  whatsapp: "Ex : +237690000000",
  url: "Ex : https://monservice.com",
  website: "Ex : https://monservice.com",
  datetime: "Ex : 2025-06-10 14:00",
};

// ✅ Fonction pour déterminer la priorité d'affichage des champs
const getPrioriteChamp = (nomChamp: string): number => {
  // ✅ Bloc Informations générales
  if (nomChamp === 'titre_service') return 10;
  if (nomChamp === 'category') return 11; // Catégorie avant description
  if (nomChamp === 'description') return 12;
  
  // ✅ Produits juste après les informations générales
  if (nomChamp === 'produits' || nomChamp === 'listeproduit') return 15;
  if (nomChamp.includes('prix') || nomChamp.includes('montant')) return 16;
  if (nomChamp.includes('quantite')) return 17;
  if (nomChamp.includes('unite')) return 18;
  
  // ✅ Champs de contact dans l'ordre souhaité
  if (nomChamp === 'whatsapp') return 100; // Bloc contact
  if (nomChamp === 'telephone') return 101; // Juste après WhatsApp
  if (nomChamp === 'email') return 102;
  if (nomChamp === 'website') return 103;
  
  // ✅ GPS fixe juste après le bloc contact
  if (nomChamp === 'gps_fixe' || nomChamp === 'gps_fixe_coords') return 110;
  if (nomChamp.includes('gps')) return 111;
  if (nomChamp.includes('tarissement')) return 120;
  if (nomChamp.includes('is_')) return 130; // Champs booléens à la fin
  return 50; // Priorité par défaut pour les autres champs
};

// ✅ Fonction pour marquer les champs de contact
const isChampContact = (nomChamp: string): boolean => {
  return ['whatsapp', 'telephone', 'email', 'website'].includes(nomChamp);
};

// ✅ Fonction pour marquer les champs d'informations générales
const isChampInfoGenerale = (nomChamp: string): boolean => {
  return ['titre_service', 'category', 'description'].includes(nomChamp);
};

// ✅ Fonction pour obtenir le label français des champs
const getLabelFrancais = (nomChamp: string): string => {
  const labels: Record<string, string> = {
    'titre_service': 'Titre du service',
    'category': 'Catégorie',
    'description': 'Description',
    'whatsapp': 'WhatsApp',
    'telephone': 'Téléphone',
    'email': 'Email',
    'website': 'Site web',
    'produits': 'Produits/Services',
    'gps_fixe': 'Localisation fixe',
    'gps_fixe_coords': 'Coordonnées GPS',
    'zone_intervention': 'Zone d\'intervention',
    'is_tarissable': 'Service tarissable',
    'vitesse_tarissement': 'Vitesse de tarissement',
    'prix': 'Prix',
    'montant': 'Montant',
    'quantite': 'Quantité',
    'unite': 'Unité'
  };
  
  return labels[nomChamp] || nomChamp.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// ✅ Fonction pour ajouter automatiquement les champs de contact
const ajouterChampsContact = (composants: ComposantFrontend[], userContactInfo?: any): ComposantFrontend[] => {
  const champsContact: ComposantFrontend[] = [
    {
      nomChamp: 'whatsapp',
      typeDonnee: 'whatsapp',
      composant: 'input',
      obligatoire: true,
      priorite: getPrioriteChamp('whatsapp'),
      tooltip: 'Numéro WhatsApp pour contact direct (obligatoire)',
      exemple: '+237690000000',
      valeur: userContactInfo?.whatsapp || '',
      isContact: true, // ✅ Marquer comme champ de contact
    },
    {
      nomChamp: 'telephone',
      typeDonnee: 'téléphone',
      composant: 'input',
      obligatoire: false,
      priorite: getPrioriteChamp('telephone'),
      tooltip: 'Numéro de téléphone de contact',
      exemple: '+237690000000',
      valeur: userContactInfo?.telephone || '',
      isContact: true, // ✅ Marquer comme champ de contact
    },
    {
      nomChamp: 'email',
      typeDonnee: 'email',
      composant: 'EmailInput',
      obligatoire: false,
      priorite: getPrioriteChamp('email'),
      tooltip: 'Adresse email de contact',
      exemple: 'contact@monservice.com',
      valeur: userContactInfo?.email || '',
      isContact: true, // ✅ Marquer comme champ de contact
    },
    {
      nomChamp: 'website',
      typeDonnee: 'website',
      composant: 'input',
      obligatoire: false,
      priorite: getPrioriteChamp('website'),
      tooltip: 'Site web de votre service',
      exemple: 'https://monservice.com',
      valeur: userContactInfo?.website || '',
      isContact: true, // ✅ Marquer comme champ de contact
    },
  ];

  // Ajouter les champs de contact s'ils n'existent pas déjà
  champsContact.forEach(champContact => {
    const existe = composants.some(c => c.nomChamp === champContact.nomChamp);
    if (!existe) {
      composants.push(champContact);
    } else {
      // ✅ Marquer les champs existants comme contact et précharger les valeurs
      const champExistant = composants.find(c => c.nomChamp === champContact.nomChamp);
      if (champExistant) {
        champExistant.isContact = true;
        champExistant.priorite = champContact.priorite;
        // Précharger la valeur si elle n'existe pas déjà
        if (!champExistant.valeur && champContact.valeur) {
          champExistant.valeur = champContact.valeur;
        }
      }
    }
  });

  return composants;
};

// ✅ Fonction pour détecter le code pays à partir de la zone géographique
const detecterCodePays = (zoneGeographique?: string): string => {
  if (!zoneGeographique) return '+237'; // Défaut Cameroun
  
  const zone = zoneGeographique.toLowerCase();
  
  // Cameroun
  if (zone.includes('cameroun') || zone.includes('douala') || zone.includes('yaoundé') || 
      zone.includes('yaounde') || zone.includes('bafoussam') || zone.includes('bamenda') || 
      zone.includes('garoua') || zone.includes('maroua') || zone.includes('ngaoundéré') ||
      zone.includes('ngaoundere') || zone.includes('bertoua') || zone.includes('ebolowa') ||
      zone.includes('kribi') || zone.includes('limbe') || zone.includes('buea')) {
    return '+237';
  }
  
  // France
  if (zone.includes('france') || zone.includes('paris') || zone.includes('marseille') || 
      zone.includes('lyon') || zone.includes('toulouse') || zone.includes('nice') ||
      zone.includes('nantes') || zone.includes('montpellier') || zone.includes('strasbourg') ||
      zone.includes('bordeaux') || zone.includes('lille') || zone.includes('rennes')) {
    return '+33';
  }
  
  // Côte d'Ivoire
  if (zone.includes('côte') || zone.includes('cote') || zone.includes('ivoire') || 
      zone.includes('abidjan') || zone.includes('bouaké') || zone.includes('bouake') ||
      zone.includes('yamoussoukro') || zone.includes('korhogo') || zone.includes('daloa')) {
    return '+225';
  }
  
  // Sénégal
  if (zone.includes('sénégal') || zone.includes('senegal') || zone.includes('dakar') || 
      zone.includes('thiès') || zone.includes('thies') || zone.includes('kaolack') ||
      zone.includes('ziguinchor') || zone.includes('saint-louis')) {
    return '+221';
  }
  
  // Mali
  if (zone.includes('mali') || zone.includes('bamako') || zone.includes('sikasso') || 
      zone.includes('mopti') || zone.includes('koutiala') || zone.includes('kayes')) {
    return '+223';
  }
  
  // Burkina Faso
  if (zone.includes('burkina') || zone.includes('faso') || zone.includes('ouagadougou') || 
      zone.includes('bobo-dioulasso') || zone.includes('koudougou') || zone.includes('ouahigouya')) {
    return '+226';
  }
  
  // Niger
  if (zone.includes('niger') && !zone.includes('nigeria') && zone.includes('niamey') || 
      zone.includes('zinder') || zone.includes('maradi') || zone.includes('tahoua')) {
    return '+227';
  }
  
  // Tchad
  if (zone.includes('tchad') || zone.includes('chad') || zone.includes('ndjamena') || 
      zone.includes('moundou') || zone.includes('sarh') || zone.includes('abéché')) {
    return '+235';
  }
  
  // République Centrafricaine
  if (zone.includes('centrafricaine') || zone.includes('bangui') || zone.includes('berbérati') ||
      zone.includes('carnot') || zone.includes('bambari')) {
    return '+236';
  }
  
  // Gabon
  if (zone.includes('gabon') || zone.includes('libreville') || zone.includes('port-gentil') || 
      zone.includes('franceville') || zone.includes('oyem')) {
    return '+241';
  }
  
  // République du Congo
  if (zone.includes('congo') && !zone.includes('démocratique') && !zone.includes('democratique') ||
      zone.includes('brazzaville') || zone.includes('pointe-noire') || zone.includes('dolisie')) {
    return '+242';
  }
  
  // République Démocratique du Congo
  if (zone.includes('démocratique') || zone.includes('democratique') || zone.includes('kinshasa') || 
      zone.includes('lubumbashi') || zone.includes('mbuji-mayi') || zone.includes('kisangani')) {
    return '+243';
  }
  
  // Guinée Équatoriale
  if (zone.includes('équatoriale') || zone.includes('equatoriale') || zone.includes('malabo') || 
      zone.includes('bata')) {
    return '+240';
  }
  
  // Canada
  if (zone.includes('canada') || zone.includes('toronto') || zone.includes('montreal') || 
      zone.includes('vancouver') || zone.includes('calgary') || zone.includes('ottawa') ||
      zone.includes('québec') || zone.includes('quebec') || zone.includes('winnipeg')) {
    return '+1';
  }
  
  // États-Unis
  if (zone.includes('états-unis') || zone.includes('etats-unis') || zone.includes('usa') || 
      zone.includes('new york') || zone.includes('los angeles') || zone.includes('chicago') ||
      zone.includes('houston') || zone.includes('miami') || zone.includes('atlanta') ||
      zone.includes('washington') || zone.includes('boston') || zone.includes('seattle')) {
    return '+1';
  }
  
  // Maroc
  if (zone.includes('maroc') || zone.includes('casablanca') || zone.includes('rabat') || 
      zone.includes('fès') || zone.includes('fez') || zone.includes('marrakech') ||
      zone.includes('agadir') || zone.includes('tanger') || zone.includes('meknès')) {
    return '+212';
  }
  
  // Algérie
  if (zone.includes('algérie') || zone.includes('algerie') || zone.includes('alger') || 
      zone.includes('oran') || zone.includes('constantine') || zone.includes('annaba') ||
      zone.includes('blida') || zone.includes('batna') || zone.includes('sétif')) {
    return '+213';
  }
  
  // Tunisie
  if (zone.includes('tunisie') || zone.includes('tunis') || zone.includes('sfax') || 
      zone.includes('sousse') || zone.includes('kairouan') || zone.includes('bizerte') ||
      zone.includes('gabès') || zone.includes('ariana')) {
    return '+216';
  }
  
  // Défaut : Cameroun (zone la plus probable)
  return '+237';
};

// ✅ Fonction pour préfixer intelligemment les numéros de téléphone
const prefixerNumeroTelephone = (numero: string, zoneGeographique?: string): string => {
  if (!numero) return '';
  
  // Nettoyer le numéro
  const numeroNettoye = numero.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  
  // Si déjà préfixé, retourner tel quel
  if (numeroNettoye.startsWith('+')) return numeroNettoye;
  
  // Détecter le code pays selon la zone géographique
  const codePays = detecterCodePays(zoneGeographique);
  
  // Si commence par 00, remplacer par +
  if (numeroNettoye.startsWith('00')) {
    return '+' + numeroNettoye.substring(2);
  }
  
  // Si commence par 0, remplacer par le code pays
  if (numeroNettoye.startsWith('0')) {
    return codePays + numeroNettoye.substring(1);
  }
  
  // Si c'est juste des chiffres, ajouter le code pays
  if (/^\d+$/.test(numeroNettoye)) {
    return codePays + numeroNettoye;
  }
  
  return numeroNettoye;
};

export function dispatchChampsFormulaireIA(response: YukpoIAResponse, userContactInfo?: any, userGpsInfo?: any): ComposantFrontend[] {
  const composants: ComposantFrontend[] = [];

  if (response.service_refuse) {
    console.warn("⛔ Demande Yukpo refusée :", response.motif_refus);
    return composants;
  }

  if (response.intention && response.data) {
    console.log("[dispatchChampsFormulaireIA] Traitement de la nouvelle structure Yukpo:", response);
    console.log("[dispatchChampsFormulaireIA] Type de response.data:", typeof response.data);
    console.log("[dispatchChampsFormulaireIA] Clés de response.data:", Object.keys(response.data));
    
    const data = response.data;
    
    // ✅ Première passe : collecter tous les champs de base (FILTRER le champ "titre" parasite)
    const champsBase: Record<string, any> = {};
    
    for (const [champ, meta] of Object.entries(data)) {
      console.log(`[dispatchChampsFormulaireIA] Traitement du champ: ${champ}`, meta);
      
      if (!meta || typeof meta !== 'object' || !('type_donnee' in meta)) {
        console.log(`[dispatchChampsFormulaireIA] Champ ${champ} ignoré - pas de type_donnee`);
        continue;
      }
      
      const metaData = meta as any;
      if (!metaData.type_donnee || champ === "contexte_demande") {
        console.log(`[dispatchChampsFormulaireIA] Champ ${champ} ignoré - type_donnee manquant ou contexte_demande`);
        continue;
      }
      
      // ✅ FILTRAGE CRITIQUE: Ignorer le champ "titre" parasite
      if (champ === "titre") {
        console.log("[dispatchChampsFormulaireIA] Filtrage du champ 'titre' parasite");
        continue;
      }
      
      console.log(`[dispatchChampsFormulaireIA] Champ ${champ} ajouté aux champs de base`);
      champsBase[champ] = metaData;
    }
    
    console.log("[dispatchChampsFormulaireIA] Champs de base collectés:", Object.keys(champsBase));
    
    // ✅ Deuxième passe : traiter les champs avec logique conditionnelle (SAUF produits et listeproduit)
    for (const [champ, metaData] of Object.entries(champsBase)) {
      // Skip produits et listeproduit - ils seront traités dans la quatrième passe
      if (champ === 'produits' || champ === 'listeproduit') continue;
      
      let composant = "input";
      let obligatoire = false;

      switch (metaData.type_donnee) {
        case "string":
          composant = metaData.valeur && metaData.valeur.length > 100 ? "textarea" : "input";
          break;
        case "number":
          composant = "number";
          break;
        case "boolean":
          composant = "checkbox";
          break;
        case "gps":
          composant = "MapSelector";
          obligatoire = champ === "gps_fixe" || champ === "gps_fixe_coords" || champ.includes("gps");
          break;
        case "image":
          composant = "ImageUploader";
          break;
        case "video":
          composant = "VideoUploader";
          break;
        case "audio":
          composant = "AudioUploader";
          break;
        case "excel":
          composant = "ExcelUploader";
          break;
        case "document":
          composant = "DocumentUploader";
          break;
        case "liste":
          composant = champ === "etat_bien" ? "EtatBienSelector" : "TagSelector";
          break;
        case "datetime":
          composant = "DateTimePicker";
          break;
        case "email":
          composant = "EmailInput";
          break;
        case "whatsapp":
        case "téléphone":
          composant = "input";
          break;
        case "website":
        case "url":
          composant = "input";
          break;
        case "listeproduit":
          composant = "ProductListManager";
          break;
        case "objet":
          composant = "ObjectViewer";
          break;
        default:
          composant = "input";
      }

      // ✅ Préfixer automatiquement les numéros de téléphone
      let valeurTraitee = metaData.valeur;
      if (metaData.type_donnee === 'whatsapp' || metaData.type_donnee === 'téléphone') {
        valeurTraitee = prefixerNumeroTelephone(metaData.valeur, userGpsInfo?.zoneGeographique);
      }

      composants.push({
        nomChamp: champ,
        typeDonnee: metaData.type_donnee,
        composant,
        obligatoire,
        priorite: getPrioriteChamp(champ),
        tooltip: TOOLTIP_PAR_TYPE[metaData.type_donnee] || "",
        exemple: EXEMPLES_PAR_TYPE[metaData.type_donnee] || undefined,
        valeur: valeurTraitee || "",
        // ✅ Marquer le type de champ
        isContact: isChampContact(champ),
        isInfoGenerale: isChampInfoGenerale(champ),
        labelFrancais: getLabelFrancais(champ),
      });
    }
    
    // ✅ Troisième passe : ajouter les champs conditionnels
    
    // Si is_tarissable = true, ajouter vitesse_tarissable
    if (champsBase.is_tarissable?.valeur === true) {
      console.log("[dispatchChampsFormulaireIA] Ajout du champ conditionnel: vitesse_tarissable");
      composants.push({
        nomChamp: "vitesse_tarissable",
        typeDonnee: "string",
        composant: "input",
        obligatoire: false,
        priorite: getPrioriteChamp("vitesse_tarissable"),
        tooltip: "Vitesse de tarissement du service",
        exemple: "Ex : Immédiat, 24h, 48h",
        valeur: "",
      });
    }
    
    // Si gps_fixe = true, ajouter gps_fixe_coords avec valeur existante
    if (champsBase.gps_fixe?.valeur === true) {
      console.log("[dispatchChampsFormulaireIA] Ajout du champ conditionnel: gps_fixe_coords");
      composants.push({
        nomChamp: "gps_fixe_coords",
        typeDonnee: "gps",
        composant: "MapSelector",
        obligatoire: true,
        priorite: getPrioriteChamp("gps_fixe_coords"),
        tooltip: "Coordonnées GPS fixes du service",
        exemple: "Ex : 4.065, 9.712",
        valeur: userGpsInfo?.gps_fixe || "",
      });
    }
    
    // ✅ Quatrième passe : traiter les produits s'ils existent
    if (champsBase.produits) {
      console.log("[dispatchChampsFormulaireIA] Traitement des produits détectés");
      console.log("[dispatchChampsFormulaireIA] Données produits brutes:", champsBase.produits);
      
      // Convertir la structure IA en format attendu par ProductListManager
      let produitsFormatted: any[] = [];
      
      if (champsBase.produits.valeur && Array.isArray(champsBase.produits.valeur)) {
        produitsFormatted = champsBase.produits.valeur.map((produit: any, index: number) => {
          console.log(`[dispatchChampsFormulaireIA] Formatage produit ${index}:`, produit);
          
          // Gestion flexible de la structure du produit
          const produitFormate = {
            nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || `Produit ${index + 1}`,
            categorie: produit.categorie?.valeur || produit.categorie || produit.category?.valeur || produit.category || "Autre",
            nature_produit: produit.description?.valeur || produit.description || produit.nature_produit?.valeur || produit.nature_produit || "",
            quantite: produit.quantite?.valeur || produit.quantite || produit.quantity?.valeur || produit.quantity || 1,
            unite: produit.unite?.valeur || produit.unite || produit.unit?.valeur || produit.unit || "pièce",
            prix: {
              montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
              devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
            },
            marque: produit.marque?.valeur || produit.marque || produit.brand?.valeur || produit.brand || "",
            origine: produit.origine?.valeur || produit.origine || produit.origin?.valeur || produit.origin || "",
            occasion: produit.occasion?.valeur || produit.occasion || false,
            est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
            vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
          };
          
          console.log(`[dispatchChampsFormulaireIA] Produit formaté ${index}:`, produitFormate);
          return produitFormate;
        });
      } else if (champsBase.produits.valeur && typeof champsBase.produits.valeur === 'object') {
        // Cas où il n'y a qu'un seul produit
        const produit = champsBase.produits.valeur;
        produitsFormatted = [{
          nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || "Produit",
          categorie: produit.categorie?.valeur || produit.categorie || "Autre",
          nature_produit: produit.description?.valeur || produit.description || "",
          quantite: produit.quantite?.valeur || produit.quantite || 1,
          unite: produit.unite?.valeur || produit.unite || "pièce",
          prix: {
            montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
            devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
          },
          marque: produit.marque?.valeur || produit.marque || "",
          origine: produit.origine?.valeur || produit.origine || "",
          occasion: produit.occasion?.valeur || produit.occasion || false,
          est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
          vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
        }];
      }
      
      console.log("[dispatchChampsFormulaireIA] Produits finaux formatés:", produitsFormatted);
      
      composants.push({
        nomChamp: "produits",
        typeDonnee: "listeproduit",
        composant: "ProductListManager",
        obligatoire: false,
        priorite: getPrioriteChamp("produits"),
        tooltip: "Liste des produits/services proposés",
        exemple: "Produits détectés depuis votre demande",
        valeur: produitsFormatted,
      });
    }
    
    // ✅ Quatrième passe bis : traiter les listeproduit s'ils existent
    if (champsBase.listeproduit) {
      console.log("[dispatchChampsFormulaireIA] Traitement des listeproduit détectés");
      console.log("[dispatchChampsFormulaireIA] Données listeproduit brutes:", champsBase.listeproduit);
      
      // Convertir la structure IA en format attendu par ProductListManager
      let produitsFormatted: any[] = [];
      
      if (champsBase.listeproduit.valeur && Array.isArray(champsBase.listeproduit.valeur)) {
        produitsFormatted = champsBase.listeproduit.valeur.map((produit: any, index: number) => {
          const produitFormate = {
            nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || `Produit ${index + 1}`,
            categorie: produit.categorie?.valeur || produit.categorie || produit.category?.valeur || produit.category || "Autre",
            nature_produit: produit.description?.valeur || produit.description || produit.nature_produit?.valeur || produit.nature_produit || "",
            quantite: produit.quantite?.valeur || produit.quantite || produit.quantity?.valeur || produit.quantity || 1,
            unite: produit.unite?.valeur || produit.unite || produit.unit?.valeur || produit.unit || "pièce",
            prix: {
              montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
              devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
            },
            marque: produit.marque?.valeur || produit.marque || produit.brand?.valeur || produit.brand || "",
            origine: produit.origine?.valeur || produit.origine || produit.origin?.valeur || produit.origin || "",
            occasion: produit.occasion?.valeur || produit.occasion || false,
            est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
            vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
          };
          return produitFormate;
        });
      } else if (champsBase.listeproduit.valeur && typeof champsBase.listeproduit.valeur === 'object') {
        // Cas où il n'y a qu'un seul produit
        const produit = champsBase.listeproduit.valeur;
        produitsFormatted = [{
          nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || "Produit",
          categorie: produit.categorie?.valeur || produit.categorie || "Autre",
          nature_produit: produit.description?.valeur || produit.description || "",
          quantite: produit.quantite?.valeur || produit.quantite || 1,
          unite: produit.unite?.valeur || produit.unite || "pièce",
          prix: {
            montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
            devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
          },
          marque: produit.marque?.valeur || produit.marque || "",
          origine: produit.origine?.valeur || produit.origine || "",
          occasion: produit.occasion?.valeur || produit.occasion || false,
          est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
          vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
        }];
      }
      composants.push({
        nomChamp: "listeproduit",
        typeDonnee: "listeproduit",
        composant: "ProductListManager",
        obligatoire: false,
        priorite: getPrioriteChamp("listeproduit"),
        tooltip: "Liste des produits/services proposés",
        exemple: "Produits détectés depuis votre demande",
        valeur: produitsFormatted,
      });
    }
    
    // ✅ CINQUIÈME PASSE : Ajouter automatiquement les champs de contact
    ajouterChampsContact(composants, userContactInfo);
    
    // ✅ SIXIÈME PASSE : Trier les composants par priorité
    composants.sort((a, b) => (a.priorite || 10) - (b.priorite || 10));
    
    console.log("[dispatchChampsFormulaireIA] Composants triés par priorité:", composants.map(c => ({ nom: c.nomChamp, priorite: c.priorite })));
    
    return composants;
  }

  // ✅ NOUVELLE LOGIQUE : Traitement de la structure déballée (données à la racine)
  if (response.intention) {
    console.log("[dispatchChampsFormulaireIA] Traitement de la structure déballée (données à la racine):", response);
    console.log("[dispatchChampsFormulaireIA] Clés de la réponse:", Object.keys(response));
    
    // ✅ Première passe : collecter tous les champs de base (FILTRER les champs système)
    const champsBase: Record<string, any> = {};
    
    for (const [champ, meta] of Object.entries(response)) {
      console.log(`[dispatchChampsFormulaireIA] Traitement du champ racine: ${champ}`, meta);
      
      // Ignorer les champs système
      if (champ === "intention" || champ === "status" || champ === "service_refuse" || 
          champ === "motif_refus" || champ === "tokens_consumed" || champ === "ia_model_used" ||
          champ === "confidence" || champ === "processing_mode" || champ === "interaction_id" ||
          champ === "tokens_breakdown" || champ === "model_used" || champ === "processing_time_ms") {
        console.log(`[dispatchChampsFormulaireIA] Champ système ${champ} ignoré`);
        continue;
      }
      
      if (!meta || typeof meta !== 'object' || !('type_donnee' in meta)) {
        console.log(`[dispatchChampsFormulaireIA] Champ ${champ} ignoré - pas de type_donnee`);
        continue;
      }
      
      const metaData = meta as any;
      if (!metaData.type_donnee || champ === "contexte_demande") {
        console.log(`[dispatchChampsFormulaireIA] Champ ${champ} ignoré - type_donnee manquant ou contexte_demande`);
        continue;
      }
      
      // ✅ FILTRAGE CRITIQUE: Ignorer le champ "titre" parasite
      if (champ === "titre") {
        console.log("[dispatchChampsFormulaireIA] Filtrage du champ 'titre' parasite");
        continue;
      }
      
      console.log(`[dispatchChampsFormulaireIA] Champ ${champ} ajouté aux champs de base`);
      champsBase[champ] = metaData;
    }
    
    console.log("[dispatchChampsFormulaireIA] Champs de base collectés (structure déballée):", Object.keys(champsBase));
    
    // ✅ Deuxième passe : traiter les champs avec logique conditionnelle (SAUF produits et listeproduit)
    for (const [champ, metaData] of Object.entries(champsBase)) {
      // Skip produits et listeproduit - ils seront traités dans la quatrième passe
      if (champ === 'produits' || champ === 'listeproduit') continue;
      
      let composant = "input";
      let obligatoire = false;

      switch (metaData.type_donnee) {
        case "string":
          composant = metaData.valeur && metaData.valeur.length > 100 ? "textarea" : "input";
          break;
        case "number":
          composant = "number";
          break;
        case "boolean":
          composant = "checkbox";
          break;
        case "gps":
          composant = "MapSelector";
          obligatoire = champ === "gps_fixe" || champ === "gps_fixe_coords" || champ.includes("gps");
          break;
        case "image":
          composant = "ImageUploader";
          break;
        case "video":
          composant = "VideoUploader";
          break;
        case "audio":
          composant = "AudioUploader";
          break;
        case "excel":
          composant = "ExcelUploader";
          break;
        case "document":
          composant = "DocumentUploader";
          break;
        case "liste":
          composant = champ === "etat_bien" ? "EtatBienSelector" : "TagSelector";
          break;
        case "datetime":
          composant = "DateTimePicker";
          break;
        case "email":
          composant = "EmailInput";
          break;
        case "whatsapp":
        case "téléphone":
          composant = "input";
          break;
        case "website":
        case "url":
          composant = "input";
          break;
        case "listeproduit":
          composant = "ProductListManager";
          break;
        case "objet":
          composant = "ObjectViewer";
          break;
        default:
          composant = "input";
      }

      // ✅ Préfixer automatiquement les numéros de téléphone
      let valeurTraitee = metaData.valeur;
      if (metaData.type_donnee === 'whatsapp' || metaData.type_donnee === 'téléphone') {
        valeurTraitee = prefixerNumeroTelephone(metaData.valeur, userGpsInfo?.zoneGeographique);
      }

      composants.push({
        nomChamp: champ,
        typeDonnee: metaData.type_donnee,
        composant,
        obligatoire,
        priorite: getPrioriteChamp(champ),
        tooltip: TOOLTIP_PAR_TYPE[metaData.type_donnee] || "",
        exemple: EXEMPLES_PAR_TYPE[metaData.type_donnee] || undefined,
        valeur: valeurTraitee || "",
        // ✅ Marquer le type de champ
        isContact: isChampContact(champ),
        isInfoGenerale: isChampInfoGenerale(champ),
        labelFrancais: getLabelFrancais(champ),
      });
    }
    
    // ✅ Troisième passe : ajouter les champs conditionnels
    
    // Si is_tarissable = true, ajouter vitesse_tarissable
    if (champsBase.is_tarissable?.valeur === true) {
      console.log("[dispatchChampsFormulaireIA] Ajout du champ conditionnel: vitesse_tarissable");
      composants.push({
        nomChamp: "vitesse_tarissable",
        typeDonnee: "string",
        composant: "input",
        obligatoire: false,
        priorite: getPrioriteChamp("vitesse_tarissable"),
        tooltip: "Vitesse de tarissement du service",
        exemple: "Ex : Immédiat, 24h, 48h",
        valeur: "",
      });
    }
    
    // Si gps_fixe = true, ajouter gps_fixe_coords avec valeur existante
    if (champsBase.gps_fixe?.valeur === true) {
      console.log("[dispatchChampsFormulaireIA] Ajout du champ conditionnel: gps_fixe_coords");
      composants.push({
        nomChamp: "gps_fixe_coords",
        typeDonnee: "gps",
        composant: "MapSelector",
        obligatoire: true,
        priorite: getPrioriteChamp("gps_fixe_coords"),
        tooltip: "Coordonnées GPS fixes du service",
        exemple: "Ex : 4.065, 9.712",
        valeur: userGpsInfo?.gps_fixe || "",
      });
    }
    
    // ✅ Quatrième passe : traiter les produits s'ils existent
    if (champsBase.produits) {
      console.log("[dispatchChampsFormulaireIA] Traitement des produits détectés");
      console.log("[dispatchChampsFormulaireIA] Données produits brutes:", champsBase.produits);
      
      // Convertir la structure IA en format attendu par ProductListManager
      let produitsFormatted: any[] = [];
      
      if (champsBase.produits.valeur && Array.isArray(champsBase.produits.valeur)) {
        produitsFormatted = champsBase.produits.valeur.map((produit: any, index: number) => {
          console.log(`[dispatchChampsFormulaireIA] Formatage produit ${index}:`, produit);
          
          // Gestion flexible de la structure du produit
          const produitFormate = {
            nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || `Produit ${index + 1}`,
            categorie: produit.categorie?.valeur || produit.categorie || produit.category?.valeur || produit.category || "Autre",
            nature_produit: produit.description?.valeur || produit.description || produit.nature_produit?.valeur || produit.nature_produit || "",
            quantite: produit.quantite?.valeur || produit.quantite || produit.quantity?.valeur || produit.quantity || 1,
            unite: produit.unite?.valeur || produit.unite || produit.unit?.valeur || produit.unit || "pièce",
            prix: {
              montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
              devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
            },
            marque: produit.marque?.valeur || produit.marque || produit.brand?.valeur || produit.brand || "",
            origine: produit.origine?.valeur || produit.origine || produit.origin?.valeur || produit.origin || "",
            occasion: produit.occasion?.valeur || produit.occasion || false,
            est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
            vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
          };
          
          console.log(`[dispatchChampsFormulaireIA] Produit formaté ${index}:`, produitFormate);
          return produitFormate;
        });
      } else if (champsBase.produits.valeur && typeof champsBase.produits.valeur === 'object') {
        // Cas où il n'y a qu'un seul produit
        const produit = champsBase.produits.valeur;
        produitsFormatted = [{
          nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || "Produit",
          categorie: produit.categorie?.valeur || produit.categorie || "Autre",
          nature_produit: produit.description?.valeur || produit.description || "",
          quantite: produit.quantite?.valeur || produit.quantite || 1,
          unite: produit.unite?.valeur || produit.unite || "pièce",
          prix: {
            montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
            devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
          },
          marque: produit.marque?.valeur || produit.marque || "",
          origine: produit.origine?.valeur || produit.origine || "",
          occasion: produit.occasion?.valeur || produit.occasion || false,
          est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
          vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
        }];
      }
      
      console.log("[dispatchChampsFormulaireIA] Produits finaux formatés:", produitsFormatted);
      
      composants.push({
        nomChamp: "produits",
        typeDonnee: "listeproduit",
        composant: "ProductListManager",
        obligatoire: false,
        priorite: getPrioriteChamp("produits"),
        tooltip: "Liste des produits/services proposés",
        exemple: "Produits détectés depuis votre demande",
        valeur: produitsFormatted,
      });
    }
    
    // ✅ Quatrième passe bis : traiter les listeproduit s'ils existent
    if (champsBase.listeproduit) {
      console.log("[dispatchChampsFormulaireIA] Traitement des listeproduit détectés");
      console.log("[dispatchChampsFormulaireIA] Données listeproduit brutes:", champsBase.listeproduit);
      
      // Convertir la structure IA en format attendu par ProductListManager
      let produitsFormatted: any[] = [];
      
      if (champsBase.listeproduit.valeur && Array.isArray(champsBase.listeproduit.valeur)) {
        produitsFormatted = champsBase.listeproduit.valeur.map((produit: any, index: number) => {
          const produitFormate = {
            nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || `Produit ${index + 1}`,
            categorie: produit.categorie?.valeur || produit.categorie || produit.category?.valeur || produit.category || "Autre",
            nature_produit: produit.description?.valeur || produit.description || produit.nature_produit?.valeur || produit.nature_produit || "",
            quantite: produit.quantite?.valeur || produit.quantite || produit.quantity?.valeur || produit.quantity || 1,
            unite: produit.unite?.valeur || produit.unite || produit.unit?.valeur || produit.unit || "pièce",
            prix: {
              montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
              devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
            },
            marque: produit.marque?.valeur || produit.marque || produit.brand?.valeur || produit.brand || "",
            origine: produit.origine?.valeur || produit.origine || produit.origin?.valeur || produit.origin || "",
            occasion: produit.occasion?.valeur || produit.occasion || false,
            est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
            vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
          };
          return produitFormate;
        });
      } else if (champsBase.listeproduit.valeur && typeof champsBase.listeproduit.valeur === 'object') {
        // Cas où il n'y a qu'un seul produit
        const produit = champsBase.listeproduit.valeur;
        produitsFormatted = [{
          nom: produit.nom?.valeur || produit.nom || produit.titre?.valeur || produit.titre || "Produit",
          categorie: produit.categorie?.valeur || produit.categorie || "Autre",
          nature_produit: produit.description?.valeur || produit.description || "",
          quantite: produit.quantite?.valeur || produit.quantite || 1,
          unite: produit.unite?.valeur || produit.unite || "pièce",
          prix: {
            montant: produit.prix?.valeur?.montant || produit.prix?.montant || produit.prix?.valeur || produit.prix || 0,
            devise: produit.prix?.valeur?.devise || produit.prix?.devise || "XAF"
          },
          marque: produit.marque?.valeur || produit.marque || "",
          origine: produit.origine?.valeur || produit.origine || "",
          occasion: produit.occasion?.valeur || produit.occasion || false,
          est_tarissable: produit.est_tarissable?.valeur || produit.est_tarissable || true,
          vitesse_tarissement: produit.vitesse_tarissement?.valeur || produit.vitesse_tarissement || "moyenne"
        }];
      }
      composants.push({
        nomChamp: "listeproduit",
        typeDonnee: "listeproduit",
        composant: "ProductListManager",
        obligatoire: false,
        priorite: getPrioriteChamp("listeproduit"),
        tooltip: "Liste des produits/services proposés",
        exemple: "Produits détectés depuis votre demande",
        valeur: produitsFormatted,
      });
    }
    
    // ✅ CINQUIÈME PASSE : Ajouter automatiquement les champs de contact
    ajouterChampsContact(composants, userContactInfo);
    
    // ✅ SIXIÈME PASSE : Trier les composants par priorité
    composants.sort((a, b) => (a.priorite || 10) - (b.priorite || 10));
    
    console.log("[dispatchChampsFormulaireIA] Composants triés par priorité (structure déballée):", composants.map(c => ({ nom: c.nomChamp, priorite: c.priorite })));
    
    return composants;
  }

  const service = response.services_detectes?.[0];
  if (!service || !service.profil_ia) return composants;

  const profil = service.profil_ia;

  for (const [champ, meta] of Object.entries(profil)) {
    if (!meta || !meta.type_donnee || champ === "contexte_demande") continue;

    // ✅ FILTRAGE CRITIQUE: Ignorer le champ "titre" parasite
    if (champ === "titre") {
      console.log("[dispatchChampsFormulaireIA] Filtrage du champ 'titre' parasite (ancienne structure)");
      continue;
    }

    let composant = "input";
    let obligatoire = false;

    switch (meta.type_donnee) {
      case "texte":
        composant = meta.valeur && meta.valeur.length > 100 ? "textarea" : "input";
        break;
      case "nombre":
        composant = "number";
        break;
      case "booléen":
        composant = "checkbox";
        break;
      case "gps":
        composant = "MapSelector";
        obligatoire = (champ === "gps_fixe" && profil["gps_fixe_important"]?.valeur === true) || 
                     champ === "gps_fixe_coords" || 
                     champ.includes("gps");
        break;
      case "image":
        composant = "ImageUploader";
        break;
      case "video":
        composant = "VideoUploader";
        break;
      case "audio":
        composant = "AudioUploader";
        break;
      case "excel":
        composant = "ExcelUploader";
        break;
      case "document":
        composant = "DocumentUploader";
        break;
      case "liste":
        composant =
          champ === "etat_bien" ? "EtatBienSelector" : "TagSelector";
        break;
      case "datetime":
        composant = "DateTimePicker";
        break;
      case "email":
        composant = "EmailInput";
        break;
      case "whatsapp":
      case "téléphone":
        composant = "input";
        break;
      case "website":
      case "url":
        composant = "input";
        break;
      case "listeproduit":
        composant = "ProductListManager";
        break;
      case "objet":
        composant = "ObjectViewer";
        break;
      default:
        composant = "input";
    }

    composants.push({
      nomChamp: champ,
      typeDonnee: meta.type_donnee,
      composant,
      obligatoire,
      priorite: getPrioriteChamp(champ),
      tooltip: TOOLTIP_PAR_TYPE[meta.type_donnee] || "",
      exemple: EXEMPLES_PAR_TYPE[meta.type_donnee] || undefined,

      // ✅ Ajout dynamique des contraintes si présentes dans le backend
      ...(meta.min !== undefined && { min: meta.min }),
      ...(meta.max !== undefined && { max: meta.max }),
      ...(meta.unite && { unite: meta.unite }),
      ...(meta.regex && { regex: meta.regex }),
      ...(meta.placeholder && { placeholder: meta.placeholder }),
      
      // ✅ Marquer le type de champ
      isContact: isChampContact(champ),
      isInfoGenerale: isChampInfoGenerale(champ),
      labelFrancais: getLabelFrancais(champ),
    });
  }

  // ✅ Ajouter automatiquement les champs de contact
  ajouterChampsContact(composants, userContactInfo);

  // ✅ Trier les composants par priorité
  composants.sort((a, b) => (a.priorite || 10) - (b.priorite || 10));

  return composants;
}

// ✅ Fonction utilitaire pour préfixer les numéros (exportée)
export { prefixerNumeroTelephone };

// ✅ Fonction utilitaire pour identifier les champs de contact (exportée)
export { isChampContact };

// ✅ Fonction utilitaire pour détecter le code pays (exportée)
export { detecterCodePays };

// ✅ Nouvelles fonctions utilitaires pour les blocs de champs (exportées)
export { isChampInfoGenerale, getLabelFrancais };
