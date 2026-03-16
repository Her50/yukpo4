#!/usr/bin/env node
/**
 * Phase 2: Comprehensive i18n automation
 * Handles placeholders, JSX text labels, section titles, button text props
 * Strategy: For each file, derive a namespace from the filename, then replace
 * all hardcoded French strings with t('namespace.key') calls.
 * Generates fr.json and en.json key additions.
 */
const fs = require('fs');
const path = require('path');

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;

function walk(dir, results = []) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).isDirectory()) walk(p, results);
        else if (p.endsWith('.tsx')) results.push(p);
      } catch(e) {}
    }
  } catch(e) {}
  return results;
}

// Convert filename to namespace: DeliveryParcelFlowNew.tsx -> deliveryParcelFlowNew
function fileToNamespace(filePath) {
  const base = path.basename(filePath, '.tsx');
  // Remove Screen/Component suffix for cleaner namespaces
  let ns = base.replace(/Screen$/, '').replace(/Component$/, '').replace(/Modal$/, '');
  // camelCase
  ns = ns.charAt(0).toLowerCase() + ns.slice(1);
  return ns;
}

// Convert French text to a camelCase key
function textToKey(text) {
  // Normalize and simplify
  let key = text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9\s]/g, '') // remove special chars
    .trim()
    .split(/\s+/)
    .slice(0, 5) // max 5 words
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  
  if (key.length > 40) key = key.substring(0, 40);
  if (!key || key.length < 2) key = 'label' + Math.random().toString(36).substring(2, 6);
  return key;
}

// Simple English translation for common French UI patterns
const commonTranslations = {
  'Rechercher': 'Search',
  'Chargement': 'Loading',
  'Aucun résultat': 'No results',
  'Aucun': 'None',
  'Erreur': 'Error',
  'Succès': 'Success',
  'Connexion': 'Login',
  'Inscription': 'Register',
  'Déconnexion': 'Logout',
  'Paramètres': 'Settings',
  'Profil': 'Profile',
  'Accueil': 'Home',
  'Détails': 'Details',
  'Voir tout': 'See all',
  'Voir plus': 'See more',
  'Sélectionner': 'Select',
  'Télécharger': 'Download',
  'Partager': 'Share',
  'Copier': 'Copy',
  'Enregistrer': 'Save',
  'Annuler': 'Cancel',
  'Confirmer': 'Confirm',
  'Supprimer': 'Delete',
  'Modifier': 'Edit',
  'Ajouter': 'Add',
  'Créer': 'Create',
  'Valider': 'Validate',
  'Envoyer': 'Send',
  'Fermer': 'Close',
  'Retour': 'Back',
  'Suivant': 'Next',
  'Précédent': 'Previous',
  'Oui': 'Yes',
  'Non': 'No',
  'Nom': 'Name',
  'Prénom': 'First name',
  'Téléphone': 'Phone',
  'Email': 'Email',
  'Adresse': 'Address',
  'Description': 'Description',
  'Prix': 'Price',
  'Quantité': 'Quantity',
  'Date': 'Date',
  'Heure': 'Time',
  'Ville': 'City',
  'Quartier': 'Neighborhood',
  'Catégorie': 'Category',
  'Photo': 'Photo',
  'Galerie': 'Gallery',
  'Caméra': 'Camera',
  'Disponible': 'Available',
  'Indisponible': 'Unavailable',
  'Obligatoire': 'Required',
  'Optionnel': 'Optional',
  'Gratuit': 'Free',
  'Nouveau': 'New',
  'Tous': 'All',
  'Filtres': 'Filters',
  'Trier': 'Sort',
  'Réinitialiser': 'Reset',
  'Appliquer': 'Apply',
  'Total': 'Total',
  'Montant': 'Amount',
  'Paiement': 'Payment',
  'Livraison': 'Delivery',
  'Commande': 'Order',
  'Panier': 'Cart',
  'Favoris': 'Favorites',
  'Notifications': 'Notifications',
  'Messages': 'Messages',
  'Aide': 'Help',
  'Information': 'Information',
  'Attention': 'Warning',
  'Localisation': 'Location',
  'Résultats': 'Results',
  'Choisir': 'Choose',
  'Sélectionnez': 'Select',
};

function roughTranslate(frText) {
  // Try exact match first
  if (commonTranslations[frText]) return commonTranslations[frText];
  
  // Try prefix match
  for (const [fr, en] of Object.entries(commonTranslations)) {
    if (frText.startsWith(fr)) {
      return en + frText.substring(fr.length).replace(/[àâ]/g,'a').replace(/[éèêë]/g,'e').replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/[ùûü]/g,'u').replace(/ç/g,'c');
    }
  }
  
  // Basic word-by-word translation for common patterns
  let result = frText;
  const wordMap = {
    'Veuillez': 'Please', 'entrer': 'enter', 'sélectionner': 'select', 'choisir': 'choose',
    'votre': 'your', 'un': 'a', 'une': 'a', 'le': 'the', 'la': 'the', 'les': 'the',
    'de': 'of', 'du': 'of the', 'des': 'of the', 'et': 'and', 'ou': 'or',
    'nom': 'name', 'prénom': 'first name', 'numéro': 'number', 'adresse': 'address',
    'téléphone': 'phone', 'email': 'email', 'mot': 'word', 'passe': 'password',
    'rechercher': 'search', 'produit': 'product', 'service': 'service',
    'commande': 'order', 'livraison': 'delivery', 'prix': 'price',
    'date': 'date', 'heure': 'time', 'lieu': 'place', 'ville': 'city',
    'quartier': 'neighborhood', 'pays': 'country', 'région': 'region',
    'catégorie': 'category', 'type': 'type', 'titre': 'title',
    'description': 'description', 'quantité': 'quantity', 'montant': 'amount',
    'disponible': 'available', 'indisponible': 'unavailable',
    'obligatoire': 'required', 'optionnel': 'optional',
    'nouveau': 'new', 'nouvelle': 'new', 'ancien': 'old',
    'ajouter': 'add', 'modifier': 'edit', 'supprimer': 'delete',
    'créer': 'create', 'mettre': 'update', 'jour': 'update',
    'envoyer': 'send', 'recevoir': 'receive', 'accepter': 'accept', 'refuser': 'refuse',
    'confirmer': 'confirm', 'annuler': 'cancel', 'valider': 'validate',
    'inscription': 'registration', 'connexion': 'login', 'déconnexion': 'logout',
    'paramètres': 'settings', 'profil': 'profile', 'compte': 'account',
    'photo': 'photo', 'image': 'image', 'vidéo': 'video', 'fichier': 'file',
    'télécharger': 'download', 'partager': 'share', 'copier': 'copy',
    'aucun': 'no', 'aucune': 'no', 'pas': 'not', 'résultat': 'result',
    'résultats': 'results', 'trouvé': 'found', 'erreur': 'error',
    'succès': 'success', 'échec': 'failure', 'impossible': 'unable',
    'chargement': 'loading', 'en cours': 'in progress',
    'départ': 'departure', 'arrivée': 'arrival', 'destination': 'destination',
    'itinéraire': 'route', 'trajet': 'trip', 'voyage': 'trip',
    'passager': 'passenger', 'chauffeur': 'driver', 'conducteur': 'driver',
    'véhicule': 'vehicle', 'voiture': 'car', 'moto': 'motorcycle',
    'pharmacie': 'pharmacy', 'hôpital': 'hospital', 'médecin': 'doctor',
    'médicament': 'medication', 'ordonnance': 'prescription',
    'réservation': 'reservation', 'rendez-vous': 'appointment',
    'horaire': 'schedule', 'créneau': 'slot', 'place': 'seat',
    'billet': 'ticket', 'tarif': 'fare', 'réduction': 'discount',
    'promotion': 'promotion', 'offre': 'offer', 'emploi': 'job',
    'candidature': 'application', 'CV': 'resume',
    'école': 'school', 'université': 'university', 'classe': 'class',
    'matière': 'subject', 'livre': 'book', 'cours': 'course',
    'étudiant': 'student', 'enseignant': 'teacher', 'parent': 'parent',
    'famille': 'family', 'enfant': 'child', 'adulte': 'adult',
    'menu': 'menu', 'plat': 'dish', 'recette': 'recipe',
    'ingrédient': 'ingredient', 'cuisine': 'cooking',
    'assurance': 'insurance', 'sinistre': 'claim', 'contrat': 'contract',
    'immobilier': 'real estate', 'logement': 'housing', 'appartement': 'apartment',
    'maison': 'house', 'chambre': 'room', 'loyer': 'rent',
    'agence': 'agency', 'boutique': 'shop', 'magasin': 'store',
    'marché': 'market', 'achat': 'purchase', 'vente': 'sale',
    'paiement': 'payment', 'facture': 'invoice', 'reçu': 'receipt',
    'solde': 'balance', 'devise': 'currency',
    'notification': 'notification', 'message': 'message', 'alerte': 'alert',
    'aide': 'help', 'support': 'support', 'contact': 'contact',
    'information': 'information', 'détails': 'details',
    'historique': 'history', 'favoris': 'favorites',
    'carte': 'map', 'position': 'position', 'GPS': 'GPS',
    'localisation': 'location', 'distance': 'distance',
    'ouvert': 'open', 'fermé': 'closed', 'aujourd\'hui': 'today',
    'demain': 'tomorrow', 'hier': 'yesterday',
    'semaine': 'week', 'mois': 'month', 'année': 'year',
    'lundi': 'Monday', 'mardi': 'Tuesday', 'mercredi': 'Wednesday',
    'jeudi': 'Thursday', 'vendredi': 'Friday', 'samedi': 'Saturday', 'dimanche': 'Sunday',
    'minimum': 'minimum', 'maximum': 'maximum',
    'début': 'start', 'fin': 'end',
    'colis': 'parcel', 'poids': 'weight', 'taille': 'size', 'dimensions': 'dimensions',
    'expéditeur': 'sender', 'destinataire': 'recipient',
    'statut': 'status', 'état': 'condition',
  };
  
  for (const [fr, en] of Object.entries(wordMap)) {
    const regex = new RegExp('\\b' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    result = result.replace(regex, en);
  }
  
  return result;
}

const dirs = ['mobile/src/screens', 'mobile/src/components'];
const allFiles = [];
dirs.forEach(d => walk(d, allFiles));

// Collect all new translation keys
const newFrKeys = {}; // namespace -> { key: value }
const newEnKeys = {}; // namespace -> { key: value }

let totalFilesModified = 0;
let totalReplacements = 0;
const usedKeys = new Map(); // Track used keys to avoid duplicates within a namespace

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const ns = fileToNamespace(filePath);
  let replacements = 0;
  
  // Skip if no French chars at all
  if (!frChars.test(content)) continue;
  
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    
    // Skip imports, comments, console.logs
    if (trimmed.startsWith('import ') || trimmed.startsWith('//') || 
        trimmed.startsWith('*') || trimmed.startsWith('/*') ||
        trimmed.match(/console\.(log|warn|error|info)/) ||
        trimmed.match(/^\s*\/\//)) {
      newLines.push(line);
      continue;
    }
    
    // Skip lines already using t()
    // But process lines that have BOTH t() and hardcoded strings
    
    // Pattern 1: placeholder="French text" or placeholder={'French text'}
    line = line.replace(/placeholder\s*=\s*["']([^"']*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^"']*)["']/g, (match, text) => {
      if (match.includes('t(')) return match; // already translated
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `placeholder={t('${fullKey}')}`;
    });
    
    // Pattern 2: placeholder={`French text`} (template literal without variables)
    line = line.replace(/placeholder\s*=\s*\{`([^`]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^`]*)`\}/g, (match, text) => {
      if (text.includes('${')) return match; // has variables, skip
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `placeholder={t('${fullKey}')}`;
    });
    
    // Pattern 3: label="French text" or title="French text" (but not inside t())
    line = line.replace(/(label|title|headerTitle|tabBarLabel|buttonText|accessibilityLabel)\s*=\s*["']([^"']*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^"']*)["']/g, (match, prop, text) => {
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prop}={t('${fullKey}')}`;
    });
    
    // Pattern 4: >French text< (JSX text content) — only for short text (labels, not paragraphs)
    // Match: >Text with French chars</  or  >Text with French chars</ 
    line = line.replace(/>([^<>{]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>{}]*)</g, (match, text) => {
      const cleanText = text.trim();
      if (!cleanText || cleanText.length > 120) return match; // skip very long text
      if (cleanText.includes('{') || cleanText.includes('}')) return match; // has JSX expressions
      if (cleanText.startsWith('//')) return match; // comment
      if (match.includes('t(')) return match;
      // Only translate if it looks like UI text (not just a variable or emoji)
      if (!/[a-zà-ÿ]{3,}/i.test(cleanText)) return match;
      const key = textToKey(cleanText);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = cleanText;
      newEnKeys[ns][key] = roughTranslate(cleanText);
      replacements++;
      return `>{t('${fullKey}')}<`;
    });
    
    // Pattern 5: {'French text'} or {"French text"} inside JSX (not inside t())
    line = line.replace(/\{['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"](\s*\})/g, (match, text, suffix) => {
      if (!text.trim() || text.length > 120) return match;
      // Check if this is already inside a t() call by looking backwards
      const lineBeforeMatch = line.substring(0, line.indexOf(match));
      if (lineBeforeMatch.match(/t\s*\(\s*$/)) return match; // inside t()
      if (lineBeforeMatch.match(/(key|id|name|type|style|color|source|uri|import|require|console)\s*[:=]\s*$/i)) return match; // not UI text
      if (!/[a-zà-ÿ]{3,}/i.test(text)) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `{t('${fullKey}')${suffix}`;
    });
    
    newLines.push(line);
  }
  
  if (replacements > 0) {
    content = newLines.join('\n');
    
    // Ensure useLanguageSafe import exists
    if (!content.includes('useLanguageSafe')) {
      const importLines = content.split('\n');
      let lastImportLine = -1;
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].match(/^import /)) {
          lastImportLine = i;
        }
      }
      if (lastImportLine >= 0) {
        const rel = filePath.replace(/\\/g, '/');
        let prefix = '../';
        if (rel.includes('/screens/specialized/') || rel.includes('/screens/delivery/') || 
            rel.includes('/screens/auth/') || rel.includes('/screens/orientation/') ||
            rel.includes('/screens/service/') || rel.includes('/screens/offres-emploi/') ||
            rel.includes('/screens/promo/') || rel.includes('/screens/video/') ||
            rel.includes('/components/delivery/') || rel.includes('/components/chat/')) {
          prefix = '../../';
        }
        importLines.splice(lastImportLine + 1, 0, `import { useLanguageSafe } from '${prefix}contexts/LanguageContext';`);
        content = importLines.join('\n');
      }
    }
    
    // Ensure const { t } = useLanguageSafe() hook exists
    if (!content.match(/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguageSafe/)) {
      const hookLine = '    const { t } = useLanguageSafe();';
      // Find first useState or other hook after the component declaration
      const hookPatterns = [
        /(const toaster = useToaster\(\);)/,
        /(const \{ location \} = useLocation\(\);)/,
        /(const navigation = useNavigation\(\)[^;]*;)/,
        /(const \{ callWithFallback \} = useAIWithFallback\(\);)/,
      ];
      
      let inserted = false;
      for (const pat of hookPatterns) {
        if (content.match(pat)) {
          content = content.replace(pat, '$1\n' + hookLine);
          inserted = true;
          break;
        }
      }
      
      if (!inserted) {
        // Try inserting after first useState
        const stateMatch = content.match(/(const \[[^\]]+\]\s*=\s*useState[^;]*;)/);
        if (stateMatch) {
          content = content.replace(stateMatch[0], hookLine + '\n' + stateMatch[0]);
          inserted = true;
        }
      }
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    totalFilesModified++;
    totalReplacements += replacements;
  }
}

// Generate the JSON additions
const frOutput = {};
const enOutput = {};
let totalKeys = 0;

for (const ns of Object.keys(newFrKeys).sort()) {
  frOutput[ns] = newFrKeys[ns];
  enOutput[ns] = newEnKeys[ns];
  totalKeys += Object.keys(newFrKeys[ns]).length;
}

// Write to temp files for manual merge
fs.writeFileSync('mobile/src/i18n/new-keys-fr.json', JSON.stringify(frOutput, null, 4), 'utf8');
fs.writeFileSync('mobile/src/i18n/new-keys-en.json', JSON.stringify(enOutput, null, 4), 'utf8');

console.log(`\n=== Auto-i18n Phase 2 Complete ===`);
console.log(`Files modified: ${totalFilesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New translation keys: ${totalKeys}`);
console.log(`Namespaces: ${Object.keys(frOutput).length}`);
console.log(`\nKey files generated:`);
console.log(`  mobile/src/i18n/new-keys-fr.json`);
console.log(`  mobile/src/i18n/new-keys-en.json`);
