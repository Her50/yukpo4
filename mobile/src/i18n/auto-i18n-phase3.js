#!/usr/bin/env node
/**
 * Phase 3: Catch remaining French strings missed by Phase 2
 * - Alert button labels with complex patterns (multi-word, variants)
 * - label={} props with French
 * - Remaining placeholders with non-accented French words
 * - JSX text with common French words (no accents needed)
 */
const fs = require('fs');
const path = require('path');

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
// Common French words WITHOUT accents that are clearly French
const frWordsNoAccent = /\b(Veuillez|Rechercher|Choisir|Entrez|Confirmez|Saisissez|Renseignez|Indiquez|Tapez|Cliquez|Appuyez|Ajoutez|Validez|Chargement|Connexion|Inscription|Actualiser|Sauvegarder|Voir tout|Voir plus|Voir les|Voir le|Voir la|Ajouter un|Ajouter une|Pas de|Aucun |Aucune |Filtre|Trier par|Du plus|Tous les|Toutes les|Mon |Ma |Mes |Nos |Votre |Vos |Le prix|La date|Le nom|La description|Le montant|Le type|Le lieu|La ville|Le quartier|Le pays|Le titre|Le nombre|La quantit|Nombre de|Type de|Liste des|Nouveau |Nouvelle |Nouvel |Nouveau\b|Obligatoire|Optionnel|Gratuit|En cours|Disponible|Non disponible|Indisponible|Mot de passe|Nom complet|Nom de|Code postal|Date de|Heure de|Lieu de|Point de|Adresse de)\b/;

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

function fileToNamespace(filePath) {
  const base = path.basename(filePath, '.tsx');
  let ns = base.replace(/Screen$/, '').replace(/Component$/, '').replace(/Modal$/, '');
  ns = ns.charAt(0).toLowerCase() + ns.slice(1);
  return ns;
}

function textToKey(text) {
  let key = text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  if (key.length > 40) key = key.substring(0, 40);
  if (!key || key.length < 2) key = 'label' + Math.random().toString(36).substring(2, 6);
  return key;
}

function roughTranslate(frText) {
  const wordMap = {
    'Veuillez': 'Please', 'entrer': 'enter', 'saisir': 'enter', 'indiquer': 'specify',
    'choisir': 'choose', 'renseigner': 'fill in', 'sélectionner': 'select',
    'votre': 'your', 'vos': 'your', 'un': 'a', 'une': 'a', 'le': 'the', 'la': 'the', 'les': 'the',
    'de': 'of', 'du': 'of the', 'des': 'of the', 'et': 'and', 'ou': 'or',
    'nom': 'name', 'prénom': 'first name', 'numéro': 'number', 'adresse': 'address',
    'téléphone': 'phone', 'email': 'email', 'mot': 'word', 'passe': 'password',
    'rechercher': 'search', 'produit': 'product', 'service': 'service',
    'commande': 'order', 'livraison': 'delivery', 'prix': 'price',
    'date': 'date', 'heure': 'time', 'lieu': 'place', 'ville': 'city',
    'quartier': 'neighborhood', 'pays': 'country',
    'catégorie': 'category', 'type': 'type', 'titre': 'title',
    'description': 'description', 'quantité': 'quantity', 'montant': 'amount',
    'nouveau': 'new', 'nouvelle': 'new', 'ajouter': 'add', 'modifier': 'edit',
    'supprimer': 'delete', 'créer': 'create', 'valider': 'validate',
    'envoyer': 'send', 'confirmer': 'confirm', 'annuler': 'cancel',
    'connexion': 'login', 'inscription': 'registration',
    'chargement': 'loading', 'aucun': 'no', 'aucune': 'no',
    'résultat': 'result', 'résultats': 'results', 'erreur': 'error',
    'succès': 'success', 'disponible': 'available', 'indisponible': 'unavailable',
    'obligatoire': 'required', 'optionnel': 'optional', 'gratuit': 'free',
    'tous': 'all', 'toutes': 'all', 'filtres': 'filters', 'trier': 'sort',
    'appliquer': 'apply', 'total': 'total', 'paiement': 'payment',
    'colis': 'parcel', 'poids': 'weight', 'point': 'point',
    'départ': 'departure', 'arrivée': 'arrival', 'destination': 'destination',
    'passager': 'passenger', 'chauffeur': 'driver', 'véhicule': 'vehicle',
    'pharmacie': 'pharmacy', 'hôpital': 'hospital', 'médecin': 'doctor',
    'réservation': 'reservation', 'horaire': 'schedule', 'créneau': 'slot',
    'billet': 'ticket', 'tarif': 'fare', 'offre': 'offer', 'emploi': 'job',
    'école': 'school', 'classe': 'class', 'livre': 'book',
    'famille': 'family', 'enfant': 'child', 'adulte': 'adult',
    'menu': 'menu', 'plat': 'dish', 'recette': 'recipe',
    'assurance': 'insurance', 'sinistre': 'claim', 'contrat': 'contract',
    'immobilier': 'real estate', 'logement': 'housing', 'chambre': 'room',
    'agence': 'agency', 'boutique': 'shop', 'marché': 'market',
    'notification': 'notification', 'message': 'message',
    'voir': 'view', 'plus': 'more', 'tout': 'all', 'par': 'by',
    'mon': 'my', 'ma': 'my', 'mes': 'my', 'nos': 'our',
    'complet': 'full', 'nom complet': 'full name',
    'code postal': 'postal code', 'mot de passe': 'password',
    'en cours': 'in progress', 'pas de': 'no',
  };
  let result = frText;
  for (const [fr, en] of Object.entries(wordMap)) {
    const regex = new RegExp('\\b' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    result = result.replace(regex, en);
  }
  return result;
}

// Additional alert button replacements not caught in Phase 1
const moreButtonReplacements = {
  "text: 'Voir les détails'": "text: t('common.viewDetails')",
  'text: "Voir les détails"': "text: t('common.viewDetails')",
  "text: 'Voir le profil'": "text: t('common.viewProfile')",
  'text: "Voir le profil"': "text: t('common.viewProfile')",
  "text: 'Prendre en photo'": "text: t('common.takePhoto')",
  'text: "Prendre en photo"': "text: t('common.takePhoto')",
  "text: 'Galerie'": "text: t('common.gallery')",
  'text: "Galerie"': "text: t('common.gallery')",
  "text: 'Caméra'": "text: t('common.camera')",
  'text: "Caméra"': "text: t('common.camera')",
  "text: 'Mettre à jour'": "text: t('common.update')",
  'text: "Mettre à jour"': "text: t('common.update')",
  "text: 'Démarrer'": "text: t('common.start')",
  'text: "Démarrer"': "text: t('common.start')",
  "text: 'Terminer'": "text: t('common.finish')",
  'text: "Terminer"': "text: t('common.finish')",
  "text: 'Compris'": "text: t('common.understood')",
  'text: "Compris"': "text: t('common.understood')",
  "text: 'D\\'accord'": "text: t('common.agree')",
  "text: \"D'accord\"": "text: t('common.agree')",
  "text: 'Ignorer'": "text: t('common.ignore')",
  'text: "Ignorer"': "text: t('common.ignore')",
  "text: 'Recharger'": "text: t('common.reload')",
  'text: "Recharger"': "text: t('common.reload')",
  "text: 'Réinitialiser'": "text: t('common.reset')",
  'text: "Réinitialiser"': "text: t('common.reset')",
  "text: 'Sauvegarder'": "text: t('common.save')",
  'text: "Sauvegarder"': "text: t('common.save')",
  "text: 'Publier'": "text: t('common.publish')",
  'text: "Publier"': "text: t('common.publish')",
  "text: 'Scanner'": "text: t('common.scan')",
  'text: "Scanner"': "text: t('common.scan')",
  "text: 'Acheter'": "text: t('common.buy')",
  'text: "Acheter"': "text: t('common.buy')",
  "text: 'Commander'": "text: t('common.order')",
  'text: "Commander"': "text: t('common.order')",
  "text: 'Contacter'": "text: t('common.contact')",
  'text: "Contacter"': "text: t('common.contact')",
  "text: 'Appeler'": "text: t('common.call')",
  'text: "Appeler"': "text: t('common.call')",
  "text: 'Postuler'": "text: t('common.apply')",
  'text: "Postuler"': "text: t('common.apply')",
};

const dirs = ['mobile/src/screens', 'mobile/src/components'];
const allFiles = [];
dirs.forEach(d => walk(d, allFiles));

const newFrKeys = {};
const newEnKeys = {};
let totalFilesModified = 0;
let totalReplacements = 0;

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const ns = fileToNamespace(filePath);
  let replacements = 0;

  // Apply additional button replacements
  for (const [oldStr, newStr] of Object.entries(moreButtonReplacements)) {
    const count = content.split(oldStr).length - 1;
    if (count > 0) {
      content = content.split(oldStr).join(newStr);
      replacements += count;
    }
  }
  
  // Process remaining patterns line by line
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    
    // Skip non-relevant lines
    if (trimmed.startsWith('import ') || trimmed.startsWith('//') || 
        trimmed.startsWith('*') || trimmed.startsWith('/*') ||
        trimmed.match(/console\.(log|warn|error|info)/) ||
        trimmed.includes("t('") || trimmed.includes('t("')) {
      newLines.push(line);
      continue;
    }
    
    // Remaining placeholders with non-accented French words
    line = line.replace(/placeholder\s*=\s*["']([^"']{4,80})["']/g, (match, text) => {
      if (match.includes('t(')) return match;
      if (!frWordsNoAccent.test(text) && !frChars.test(text)) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `placeholder={t('${fullKey}')}`;
    });
    
    // label/title props with non-accented French
    line = line.replace(/(label|title|headerTitle|tabBarLabel|buttonText)\s*=\s*["']([^"']{3,80})["']/g, (match, prop, text) => {
      if (match.includes('t(')) return match;
      if (!frWordsNoAccent.test(text) && !frChars.test(text)) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prop}={t('${fullKey}')}`;
    });
    
    // Remaining >French text< with non-accented French words
    line = line.replace(/>([^<>{]{3,100})</g, (match, text) => {
      const cleanText = text.trim();
      if (!cleanText || cleanText.length < 3) return match;
      if (cleanText.includes('{') || cleanText.includes('}')) return match;
      if (cleanText.startsWith('//')) return match;
      if (match.includes("t('") || match.includes('t("')) return match;
      if (!frWordsNoAccent.test(cleanText) && !frChars.test(cleanText)) return match;
      // Skip if it looks like just a variable reference or emoji
      if (!/[a-z]{3,}/i.test(cleanText)) return match;
      const key = textToKey(cleanText);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = cleanText;
      newEnKeys[ns][key] = roughTranslate(cleanText);
      replacements++;
      return `>{t('${fullKey}')}<`;
    });
    
    newLines.push(line);
  }
  
  if (replacements > 0) {
    content = newLines.join('\n');
    
    // Ensure useLanguageSafe import
    if (!content.includes('useLanguageSafe')) {
      const importLines = content.split('\n');
      let lastImportLine = -1;
      for (let ii = 0; ii < importLines.length; ii++) {
        if (importLines[ii].match(/^import /)) lastImportLine = ii;
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
    
    // Ensure hook
    if (!content.match(/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguageSafe/)) {
      const hookLine = '    const { t } = useLanguageSafe();';
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

// Save new keys
const existingNewFr = JSON.parse(fs.readFileSync('mobile/src/i18n/new-keys-fr.json', 'utf8'));
const existingNewEn = JSON.parse(fs.readFileSync('mobile/src/i18n/new-keys-en.json', 'utf8'));

for (const [ns, keys] of Object.entries(newFrKeys)) {
  if (!existingNewFr[ns]) existingNewFr[ns] = {};
  Object.assign(existingNewFr[ns], keys);
}
for (const [ns, keys] of Object.entries(newEnKeys)) {
  if (!existingNewEn[ns]) existingNewEn[ns] = {};
  Object.assign(existingNewEn[ns], keys);
}

fs.writeFileSync('mobile/src/i18n/new-keys-fr.json', JSON.stringify(existingNewFr, null, 4), 'utf8');
fs.writeFileSync('mobile/src/i18n/new-keys-en.json', JSON.stringify(existingNewEn, null, 4), 'utf8');

// Also add common keys for the new button replacements
const commonFr = {
  'viewDetails': 'Voir les détails', 'viewProfile': 'Voir le profil',
  'gallery': 'Galerie', 'camera': 'Caméra', 'update': 'Mettre à jour',
  'start': 'Démarrer', 'finish': 'Terminer', 'understood': 'Compris',
  'agree': "D'accord", 'ignore': 'Ignorer', 'reload': 'Recharger',
  'reset': 'Réinitialiser', 'publish': 'Publier', 'scan': 'Scanner',
  'buy': 'Acheter', 'order': 'Commander', 'contact': 'Contacter',
  'call': 'Appeler',
};
const commonEn = {
  'viewDetails': 'View details', 'viewProfile': 'View profile',
  'gallery': 'Gallery', 'camera': 'Camera', 'update': 'Update',
  'start': 'Start', 'finish': 'Finish', 'understood': 'Understood',
  'agree': 'Agree', 'ignore': 'Ignore', 'reload': 'Reload',
  'reset': 'Reset', 'publish': 'Publish', 'scan': 'Scan',
  'buy': 'Buy', 'order': 'Order', 'contact': 'Contact',
  'call': 'Call',
};

// Merge common keys into locale files directly
const fr = JSON.parse(fs.readFileSync('mobile/src/i18n/locales/fr.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('mobile/src/i18n/locales/en.json', 'utf8'));

if (!fr.common) fr.common = {};
if (!en.common) en.common = {};
Object.assign(fr.common, commonFr);
Object.assign(en.common, commonEn);

// Also merge new namespace keys
for (const [ns, keys] of Object.entries(newFrKeys)) {
  if (!fr[ns]) fr[ns] = {};
  for (const [k, v] of Object.entries(keys)) {
    if (!fr[ns][k]) fr[ns][k] = v;
  }
}
for (const [ns, keys] of Object.entries(newEnKeys)) {
  if (!en[ns]) en[ns] = {};
  for (const [k, v] of Object.entries(keys)) {
    if (!en[ns][k]) en[ns][k] = v;
  }
}

fs.writeFileSync('mobile/src/i18n/locales/fr.json', JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync('mobile/src/i18n/locales/en.json', JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Auto-i18n Phase 3 Complete ===`);
console.log(`Files modified: ${totalFilesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New translation keys: ${Object.values(newFrKeys).reduce((s,o) => s + Object.keys(o).length, 0)}`);
console.log(`New common keys: ${Object.keys(commonFr).length}`);

// Validate
try { JSON.parse(fs.readFileSync('mobile/src/i18n/locales/fr.json', 'utf8')); console.log('FR JSON: Valid ✓'); } catch(e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync('mobile/src/i18n/locales/en.json', 'utf8')); console.log('EN JSON: Valid ✓'); } catch(e) { console.log('EN JSON: INVALID ✗', e.message); }
