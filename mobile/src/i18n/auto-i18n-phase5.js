#!/usr/bin/env node
/**
 * Phase 5: Final sweep — catch ALL remaining French strings WITHOUT accents
 * 
 * Previous phases only caught strings with French accented characters (àâçéèêëîïôûùüÿñæœ).
 * This phase catches:
 * 1. French words WITHOUT accents (Sport & Fitness, Image et Son, etc.)
 * 2. label: 'French' in object literals (PRODUCT_TYPES arrays, etc.)
 * 3. Remaining JSX text, placeholders, Alert args with common French patterns
 * 4. title/description/text props with non-accented French
 */
const fs = require('fs');
const path = require('path');

// ===== EXPANDED FRENCH DETECTION =====
// These are common French words/phrases that do NOT contain accents
const FR_NO_ACCENT_WORDS = [
  // Conjunctions & prepositions (only match when part of longer phrase)
  // Single words matched in multi-word context
  
  // Common French nouns/adjectives without accents
  'Accueil', 'Afficher', 'Aide', 'Annonce', 'Aucun', 'Autre', 'Autres',
  'Bien', 'Bienvenue', 'Bonjour', 'Bon', 'Bonne', 'Boutique',
  'Carte', 'Catalogue', 'Commande', 'Commandes', 'Compte', 'Contact',
  'Contrat', 'Conversation', 'Coupon', 'Cours',
  'Dashboard', 'Demande', 'Depuis', 'Document', 'Documents', 'Dossier',
  'Emploi', 'Envoyer', 'Essai',
  'Favori', 'Favoris', 'Fiche', 'Filtre', 'Filtres', 'Formulaire',
  'Gestion', 'Groupe', 'Guide',
  'Historique', 'Horaire', 'Horaires',
  'Image', 'Images', 'Information', 'Informations',
  'Jour', 'Jours',
  'Liste', 'Livraison', 'Livre', 'Livres', 'Localisation',
  'Magasin', 'Maison', 'Manuel', 'Marque', 'Menu', 'Mode', 'Montant',
  'Navigation', 'Nombre', 'Note', 'Notes', 'Notification', 'Notifications', 'Nouveau', 'Nouvelle',
  'Offre', 'Offres', 'Option', 'Options',
  'Page', 'Panier', 'Partenaire', 'Partenaires', 'Partage', 'Passer',
  'Photo', 'Photos', 'Plat', 'Plats', 'Point', 'Points', 'Position',
  'Produit', 'Produits', 'Promotion', 'Promotions',
  'Rapport', 'Recette', 'Recettes', 'Recherche', 'Remarque', 'Retour', 'Revenu', 'Revenus',
  'Sauvegarder', 'Score', 'Service', 'Services', 'Session', 'Signal', 'Son', 'Solde',
  'Sport', 'Statistique', 'Statistiques', 'Stock', 'Stocks', 'Suite', 'Support', 'Suivi',
  'Table', 'Tableau', 'Ticket', 'Tickets', 'Total', 'Transport', 'Travail', 'Tri', 'Trier', 'Type',
  'Urgent', 'Utilisateur', 'Utilisateurs',
  'Valider', 'Vente', 'Ventes', 'Ville', 'Volume', 'Voyage', 'Voyages', 'Vue',
  'Zone',
];

// Multi-word French patterns (no accents needed)
const FR_MULTI_WORD_PATTERNS = [
  /\b(et|ou)\s+(de|du|des|le|la|les|un|une)\b/i,
  /\b(de|du|des)\s+(la|le|les|l')\b/i,
  /\bPas de\b/, /\bPas encore\b/,
  /\bEn cours\b/, /\bEn ligne\b/, /\bEn attente\b/,
  /\bMon\s+\w+/, /\bMa\s+\w+/, /\bMes\s+\w+/,
  /\bVotre\s+\w+/, /\bVos\s+\w+/, /\bNotre\s+\w+/, /\bNos\s+\w+/,
  /\bLe\s+\w+/, /\bLa\s+\w+/, /\bLes\s+\w+/,
  /\bUn\s+\w+/, /\bUne\s+\w+/,
  /\bTous les\b/, /\bToutes les\b/,
  /\bVoir\s+(tout|tous|plus|les|le|la)\b/i,
  /\bAjouter\s+(un|une|au|le|la|des)\b/i,
  /\bAucun\s+\w+/, /\bAucune\s+\w+/,
  /\bNombre de\b/, /\bType de\b/, /\bListe des?\b/,
  /\bMise\s+[aà]\s+jour\b/i,
  /\bEn savoir plus\b/i,
  /\bPour\s+(vous|le|la|les|un|une)\b/i,
  /\bNon\s+(disponible|lu|valid)\b/i,
  /\bOui,\s/,
  /\bImage et Son\b/, /\bSport\s*&\s*\w+/,
  /\bSe connecter\b/, /\bSe\s+d[eé]connecter\b/i,
  /\bDevenir\s+\w+/,
  /\bContacter\s+(le|la|nous)\b/i,
  /\bBesoin\s+d/i,
  /\bPrix\s+(par|de|du|min|max)\b/i,
  /\bNom\s+(de|du|complet)\b/i,
];

// French accented chars (from previous phases)
const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;

// Combined detection
function isFrench(text) {
  if (!text || text.length < 3) return false;
  if (frChars.test(text)) return true;
  
  // Check single French words (must be a significant word, not just "Mode" or "Service" alone)
  const words = text.split(/\s+/);
  let frenchWordCount = 0;
  for (const w of words) {
    if (FR_NO_ACCENT_WORDS.includes(w)) frenchWordCount++;
  }
  // At least 1 French word AND text has multiple words (to avoid false positives on "Sport" alone in English)
  if (frenchWordCount >= 1 && words.length >= 2) return true;
  // Single French word that's clearly French (not ambiguous)
  const clearlyFrench = ['Accueil', 'Afficher', 'Aucun', 'Aucune', 'Bienvenue', 'Bonjour', 'Boutique',
    'Commande', 'Commandes', 'Envoyer', 'Favori', 'Favoris', 'Formulaire', 'Gestion',
    'Historique', 'Horaire', 'Horaires', 'Livraison', 'Localisation', 'Magasin', 'Maison',
    'Panier', 'Partenaire', 'Partenaires', 'Recherche', 'Retour', 'Sauvegarder',
    'Solde', 'Suivi', 'Trier', 'Utilisateur', 'Utilisateurs', 'Valider', 'Ville'];
  if (frenchWordCount >= 1 && clearlyFrench.some(w => text.includes(w))) return true;
  
  // Check multi-word patterns
  for (const pat of FR_MULTI_WORD_PATTERNS) {
    if (pat.test(text)) return true;
  }
  
  return false;
}

function walk(dir, results = []) {
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (fs.statSync(p).isDirectory()) walk(p, results);
        else if (p.endsWith('.tsx') || p.endsWith('.ts')) results.push(p);
      } catch(e) {}
    }
  } catch(e) {}
  return results;
}

function fileToNamespace(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  let ns = base.replace(/Screen$/, '').replace(/Component$/, '').replace(/Modal$/, '');
  return ns.charAt(0).toLowerCase() + ns.slice(1);
}

function textToKey(text) {
  let key = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '').trim()
    .split(/\s+/).slice(0, 5)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  if (key.length > 40) key = key.substring(0, 40);
  if (!key || key.length < 2) key = 'text' + Math.random().toString(36).substring(2, 6);
  return key;
}

const wordMap = {
  'Veuillez': 'Please', 'entrer': 'enter', 'saisir': 'enter', 'indiquer': 'specify',
  'choisir': 'choose', 'sélectionner': 'select', 'rechercher': 'search',
  'votre': 'your', 'vos': 'your', 'notre': 'our', 'nos': 'our',
  'un': 'a', 'une': 'a', 'le': 'the', 'la': 'the', 'les': 'the',
  'de': 'of', 'du': 'of the', 'des': 'of the', 'et': 'and', 'ou': 'or',
  'nom': 'name', 'adresse': 'address', 'produit': 'product', 'service': 'service',
  'commande': 'order', 'livraison': 'delivery', 'prix': 'price',
  'date': 'date', 'heure': 'time', 'lieu': 'place', 'ville': 'city',
  'quartier': 'neighborhood', 'pays': 'country', 'type': 'type',
  'titre': 'title', 'description': 'description', 'montant': 'amount',
  'nouveau': 'new', 'nouvelle': 'new', 'ajouter': 'add', 'modifier': 'edit',
  'supprimer': 'delete', 'valider': 'validate', 'envoyer': 'send',
  'confirmer': 'confirm', 'annuler': 'cancel', 'connexion': 'login',
  'aucun': 'no', 'aucune': 'no', 'disponible': 'available',
  'tous': 'all', 'toutes': 'all', 'filtre': 'filter', 'filtres': 'filters',
  'trier': 'sort', 'total': 'total', 'paiement': 'payment',
  'voir': 'view', 'plus': 'more', 'tout': 'all', 'par': 'by',
  'mon': 'my', 'ma': 'my', 'mes': 'my',
  'point': 'point', 'nombre': 'number', 'liste': 'list',
  'option': 'option', 'formulaire': 'form', 'photo': 'photo',
  'image': 'image', 'sport': 'sport', 'son': 'sound',
  'aide': 'help', 'carte': 'map', 'position': 'position',
  'localisation': 'location', 'distance': 'distance',
  'semaine': 'week', 'mois': 'month', 'jour': 'day',
  'statut': 'status', 'historique': 'history',
  'accueil': 'home', 'bienvenue': 'welcome', 'bonjour': 'hello',
  'recherche': 'search', 'retour': 'back', 'suite': 'next',
  'gestion': 'management', 'compte': 'account',
  'panier': 'cart', 'solde': 'balance', 'offre': 'offer',
  'promotion': 'promotion', 'stock': 'stock',
  'partenaire': 'partner', 'coursier': 'courier',
  'magasin': 'store', 'boutique': 'shop',
  'maison': 'home', 'voyage': 'travel',
  'plat': 'dish', 'recette': 'recipe', 'menu': 'menu',
  'devenir': 'become', 'contacter': 'contact',
  'Inscription': 'Registration', 'Partenaire': 'Partner',
  'Se connecter': 'Log in', 'Continuer avec': 'Continue with',
  'Devenir partenaire': 'Become a partner',
  'Pas encore': 'Not yet', 'En cours': 'In progress',
  'En attente': 'Pending', 'En ligne': 'Online',
  'Voir tout': 'View all', 'Voir plus': 'View more',
};

function roughTranslate(frText) {
  let result = frText;
  // Sort by length desc to replace longer phrases first
  const sorted = Object.entries(wordMap).sort((a, b) => b[0].length - a[0].length);
  for (const [fr, en] of sorted) {
    const regex = new RegExp('\\b' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    result = result.replace(regex, en);
  }
  return result;
}

// ===== MAIN =====
const dirs = ['mobile/src/screens', 'mobile/src/components'];
const allFiles = [];
dirs.forEach(d => walk(d, allFiles));

const newFrKeys = {};
const newEnKeys = {};
let totalFilesModified = 0;
let totalReplacements = 0;

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  const ns = fileToNamespace(filePath);
  let replacements = 0;

  const lines = content.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Skip non-relevant lines
    if (trimmed.startsWith('import ') || trimmed.startsWith('//') ||
        trimmed.startsWith('*') || trimmed.startsWith('/*') ||
        trimmed.match(/console\.(log|warn|error|info)/) ||
        trimmed.match(/(prompt|instruction|system_message|ai_context)/i)) {
      newLines.push(line);
      continue;
    }

    // Skip lines already fully translated
    if (trimmed.match(/t\s*\(\s*['"]/) && !isFrench(trimmed.replace(/t\s*\([^)]*\)/g, ''))) {
      newLines.push(line);
      continue;
    }

    // Pattern 1: label: 'Non-accented French text' in object literals
    line = line.replace(/(\blabel\s*:\s*)['"]([^'"]{3,80})['"]/g, (match, prefix, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
    });

    // Pattern 2: title: 'French text' in objects  
    line = line.replace(/(\btitle\s*:\s*)['"]([^'"]{3,80})['"]/g, (match, prefix, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      // Skip route names, screen names
      if (/^[A-Z][a-zA-Z]+Screen$/.test(text)) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
    });

    // Pattern 3: description: 'French text'
    line = line.replace(/(\bdescription\s*:\s*)['"]([^'"]{3,120})['"]/g, (match, prefix, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
    });

    // Pattern 4: text: 'French' in button/alert objects
    line = line.replace(/(\btext\s*:\s*)['"]([^'"]{2,80})['"]/g, (match, prefix, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
    });

    // Pattern 5: Alert.alert('Title', 'Message') — non-accented French
    line = line.replace(/Alert\.alert\(\s*['"]([^'"]{3,80})['"]/g, (match, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `Alert.alert(t('${fullKey}')`;
    });

    // Pattern 6: Second arg of Alert.alert
    line = line.replace(/(Alert\.alert\([^,]+,\s*)['"]([^'"]{3,200})['"]/g, (match, prefix, text) => {
      if (!isFrench(text)) return match;
      if (match.includes("t('")) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
    });

    // Pattern 7: placeholder="French text" or placeholder={'French text'}
    line = line.replace(/placeholder\s*=\s*["']([^"']{4,80})["']/g, (match, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `placeholder={t('${fullKey}')}`;
    });

    // Pattern 8: label="French" title="French" headerTitle="French" 
    line = line.replace(/(label|headerTitle|tabBarLabel|buttonText)\s*=\s*["']([^"']{3,80})["']/g, (match, prop, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prop}={t('${fullKey}')}`;
    });

    // Pattern 9: >French text between JSX tags<
    line = line.replace(/>([^<>{]*[A-Z][^<>{}]*)</g, (match, text) => {
      const cleanText = text.trim();
      if (!cleanText || cleanText.length > 120 || cleanText.length < 3) return match;
      if (!isFrench(cleanText)) return match;
      if (match.includes("t('") || match.includes('t("')) return match;
      // Skip if it's just a variable or expression
      if (/^\{/.test(cleanText) || /\}$/.test(cleanText)) return match;
      // Skip if it looks like code
      if (cleanText.includes('===') || cleanText.includes('&&') || cleanText.includes('||')) return match;
      const key = textToKey(cleanText);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = cleanText;
      newEnKeys[ns][key] = roughTranslate(cleanText);
      replacements++;
      return `>{t('${fullKey}')}`;
    });

    // Pattern 10: || 'French default' or ?? 'French default'
    line = line.replace(/(\|\||&&|\?\?)\s*['"]([^'"]{3,100})['"]/g, (match, op, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${op} t('${fullKey}')`;
    });

    // Pattern 11: setError('French message') or setMessage('French')
    line = line.replace(/(set(?:Error|Message|Status|Info|Warning)\s*\(\s*)['"]([^'"]{5,120})['"]/g, (match, prefix, text) => {
      if (!isFrench(text)) return match;
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
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
            rel.includes('/components/delivery/') || rel.includes('/components/chat/') ||
            rel.includes('/components/blood/')) {
          prefix = '../../';
        }
        importLines.splice(lastImportLine + 1, 0, `import { useLanguageSafe } from '${prefix}contexts/LanguageContext';`);
        content = importLines.join('\n');
      }
    }

    // Ensure t hook is declared
    if (!content.match(/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguageSafe/)) {
      const hookLine = '    const { t } = useLanguageSafe();';
      const hookPatterns = [
        /(const toaster = useToaster\(\);)/,
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

// Merge into locale files
const frPath = 'mobile/src/i18n/locales/fr.json';
const enPath = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

let newKeysCount = 0;
for (const [ns, keys] of Object.entries(newFrKeys)) {
  if (!fr[ns]) fr[ns] = {};
  for (const [k, v] of Object.entries(keys)) {
    if (!fr[ns][k]) { fr[ns][k] = v; newKeysCount++; }
  }
}
for (const [ns, keys] of Object.entries(newEnKeys)) {
  if (!en[ns]) en[ns] = {};
  for (const [k, v] of Object.entries(keys)) {
    if (!en[ns][k]) en[ns][k] = v;
  }
}

fs.writeFileSync(frPath, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Auto-i18n Phase 5 Complete ===`);
console.log(`Files modified: ${totalFilesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New keys added to locales: ${newKeysCount}`);

try { JSON.parse(fs.readFileSync(frPath, 'utf8')); console.log('FR JSON: Valid ✓'); } catch(e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(enPath, 'utf8')); console.log('EN JSON: Valid ✓'); } catch(e) { console.log('EN JSON: INVALID ✗', e.message); }
