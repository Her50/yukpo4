#!/usr/bin/env node
/**
 * Phase 4: Final sweep - catch ALL remaining French strings
 * Targets:
 * 1. label: 'French' in object literals (not JSX props)
 * 2. Alert.alert('French title', 'French message')  
 * 3. Remaining text: 'French' patterns
 * 4. 'Sélectionner...' and similar inline defaults
 * 5. JSX text content between > and < that has French words
 */
const fs = require('fs');
const path = require('path');

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const frWords = /\b(Veuillez|Rechercher|Choisir|Entrez|Confirmez|Saisissez|Renseignez|Indiquez|Chargement|Connexion|Inscription|Sauvegarder|Voir tout|Voir plus|Ajouter|Aucun |Aucune |Filtre|Trier par|Tous les|Toutes les|Nouveau |Nouvelle |Obligatoire|Optionnel|Gratuit|En cours|Disponible|Indisponible|Mot de passe|Nom complet|Nom de|Code postal|Date de|Heure de|Lieu de|Point de|Adresse de|Nombre de|Type de|Liste des|Mon |Ma |Mes |Nos |Votre|Vos |Le prix|La date|Le nom|Le type|Pas de|Prix par|Ville de|Quartier|Sélectionner|Sélectionnez|Tapez|Cliquez|Appuyez|Ajoutez|Validez|Confirmer la|Supprimer le|Modifier le|Envoyer le|Enregistrer le|Fermer la|Retour à|Suivant|Précédent|Réserver|Annuler la|Créer un|Voir les|Voir le|Voir la)\b/;

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

function roughTranslate(frText) {
  const wordMap = {
    'Veuillez': 'Please', 'entrer': 'enter', 'saisir': 'enter', 'indiquer': 'specify',
    'choisir': 'choose', 'renseigner': 'fill in', 'sélectionner': 'select',
    'votre': 'your', 'vos': 'your', 'un': 'a', 'une': 'a', 'le': 'the', 'la': 'the', 'les': 'the',
    'de': 'of', 'du': 'of the', 'des': 'of the', 'et': 'and', 'ou': 'or',
    'nom': 'name', 'prénom': 'first name', 'numéro': 'number', 'adresse': 'address',
    'téléphone': 'phone', 'rechercher': 'search', 'produit': 'product', 'service': 'service',
    'commande': 'order', 'livraison': 'delivery', 'prix': 'price',
    'date': 'date', 'heure': 'time', 'lieu': 'place', 'ville': 'city',
    'quartier': 'neighborhood', 'pays': 'country', 'catégorie': 'category', 'type': 'type',
    'titre': 'title', 'description': 'description', 'quantité': 'quantity', 'montant': 'amount',
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
    'colis': 'parcel', 'départ': 'departure', 'arrivée': 'arrival', 'destination': 'destination',
    'passager': 'passenger', 'véhicule': 'vehicle', 'pharmacie': 'pharmacy',
    'hôpital': 'hospital', 'médecin': 'doctor', 'médicament': 'medication',
    'réservation': 'reservation', 'horaire': 'schedule', 'créneau': 'slot',
    'billet': 'ticket', 'offre': 'offer', 'emploi': 'job',
    'école': 'school', 'famille': 'family', 'enfant': 'child',
    'menu': 'menu', 'plat': 'dish', 'recette': 'recipe',
    'assurance': 'insurance', 'sinistre': 'claim', 'contrat': 'contract',
    'immobilier': 'real estate', 'logement': 'housing', 'chambre': 'room',
    'agence': 'agency', 'boutique': 'shop', 'marché': 'market',
    'notification': 'notification', 'message': 'message',
    'voir': 'view', 'plus': 'more', 'tout': 'all', 'par': 'by',
    'mon': 'my', 'ma': 'my', 'mes': 'my', 'nos': 'our',
    'point': 'point', 'nombre': 'number', 'liste': 'list',
    'option': 'option', 'champ': 'field', 'formulaire': 'form',
    'étape': 'step', 'photo': 'photo', 'image': 'image', 'vidéo': 'video',
    'galerie': 'gallery', 'caméra': 'camera', 'fichier': 'file',
    'télécharger': 'download', 'partager': 'share', 'copier': 'copy',
    'aide': 'help', 'information': 'information', 'détails': 'details',
    'carte': 'map', 'position': 'position', 'localisation': 'location',
    'distance': 'distance', 'semaine': 'week', 'mois': 'month', 'année': 'year',
    'minimum': 'minimum', 'maximum': 'maximum', 'début': 'start', 'fin': 'end',
    'statut': 'status', 'état': 'condition',
    'Sélectionner': 'Select', 'Sélectionnez': 'Select',
  };
  let result = frText;
  for (const [fr, en] of Object.entries(wordMap)) {
    const regex = new RegExp('\\b' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    result = result.replace(regex, en);
  }
  return result;
}

const dirs = ['mobile/src/screens', 'mobile/src/components'];
const allFiles = [];
dirs.forEach(d => walk(d, allFiles));

const newFrKeys = {};
const newEnKeys = {};
let totalFilesModified = 0;
let totalReplacements = 0;

function isFrench(text) {
  return frChars.test(text) || frWords.test(text);
}

for (const filePath of allFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  const ns = fileToNamespace(filePath);
  let replacements = 0;
  
  // Skip if no French at all
  if (!frChars.test(content) && !frWords.test(content)) continue;
  
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    
    // Skip non-relevant
    if (trimmed.startsWith('import ') || trimmed.startsWith('//') || 
        trimmed.startsWith('*') || trimmed.startsWith('/*') ||
        trimmed.match(/console\.(log|warn|error|info)/)) {
      newLines.push(line);
      continue;
    }
    
    // Skip if entire line already uses t()
    if (trimmed.match(/^\s*.*t\s*\(\s*['"]/) && !isFrench(trimmed.replace(/t\s*\([^)]*\)/g, ''))) {
      newLines.push(line);
      continue;
    }
    
    // Pattern 1: label: 'French text' (object literal, NOT JSX prop)
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
    
    // Pattern 2: Alert.alert('French title', 'French message' - first two string args
    line = line.replace(/Alert\.alert\(\s*['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g, (match, text) => {
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `Alert.alert(t('${fullKey}')`;
    });
    
    // Pattern 3: Second arg of Alert.alert - , 'French message',
    line = line.replace(/(Alert\.alert\([^,]+,\s*)['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g, (match, prefix, text) => {
      if (match.includes("t('") && !isFrench(text)) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
    });
    
    // Pattern 4: remaining placeholder={...} with French inside backticks or complex expressions
    line = line.replace(/placeholder\s*=\s*\{`([^`]*[àâçéèêëîïôûùüÿñæœ][^`]*)`\}/g, (match, text) => {
      if (text.includes('${')) return match; // template with variables
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `placeholder={t('${fullKey}')}`;
    });
    
    // Pattern 5: Remaining label="French" or title="French" (with non-accented French)
    line = line.replace(/(label|title|headerTitle|tabBarLabel|buttonText)\s*=\s*["']([^"']{3,80})["']/g, (match, prop, text) => {
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
    
    // Pattern 6: Inline string defaults like || 'Sélectionner...' or ?? 'French text'
    line = line.replace(/(\|\||&&|\?\?)\s*['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g, (match, op, text) => {
      if (match.includes('t(')) return match;
      if (text.length < 3 || text.length > 100) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${op} t('${fullKey}')`;
    });
    
    // Pattern 7: Remaining >French text< (broader matching)
    line = line.replace(/>([^<>{]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>{}]*)</g, (match, text) => {
      const cleanText = text.trim();
      if (!cleanText || cleanText.length > 120 || cleanText.length < 2) return match;
      if (match.includes("t('") || match.includes('t("')) return match;
      if (!/[a-zà-ÿ]{2,}/i.test(cleanText)) return match;
      const key = textToKey(cleanText);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = cleanText;
      newEnKeys[ns][key] = roughTranslate(cleanText);
      replacements++;
      return `>{t('${fullKey}')}<`;
    });

    // Pattern 8: text: 'French multi-word' in Alert button objects (complex ones missed by Phase 1)
    line = line.replace(/(\btext\s*:\s*)['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g, (match, prefix, text) => {
      if (match.includes('t(')) return match;
      const key = textToKey(text);
      const fullKey = ns + '.' + key;
      if (!newFrKeys[ns]) { newFrKeys[ns] = {}; newEnKeys[ns] = {}; }
      newFrKeys[ns][key] = text;
      newEnKeys[ns][key] = roughTranslate(text);
      replacements++;
      return `${prefix}t('${fullKey}')`;
    });
    
    // Pattern 9: Remaining placeholder="French" with non-accented French words  
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
    
    // Pattern 10: {'French text'} standalone in JSX
    line = line.replace(/\{['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"](\s*\})/g, (match, text, suffix) => {
      if (text.length < 3 || text.length > 120) return match;
      const lineBeforeMatch = line.substring(0, line.indexOf(match));
      if (lineBeforeMatch.match(/t\s*\(\s*$/)) return match;
      if (lineBeforeMatch.match(/(key|id|name|type|style|color|source|uri|import|require|console)\s*[:=]\s*$/i)) return match;
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
const fr = JSON.parse(fs.readFileSync('mobile/src/i18n/locales/fr.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('mobile/src/i18n/locales/en.json', 'utf8'));

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

fs.writeFileSync('mobile/src/i18n/locales/fr.json', JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync('mobile/src/i18n/locales/en.json', JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Auto-i18n Phase 4 Complete ===`);
console.log(`Files modified: ${totalFilesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New keys added to locales: ${newKeysCount}`);

try { JSON.parse(fs.readFileSync('mobile/src/i18n/locales/fr.json', 'utf8')); console.log('FR JSON: Valid ✓'); } catch(e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync('mobile/src/i18n/locales/en.json', 'utf8')); console.log('EN JSON: Valid ✓'); } catch(e) { console.log('EN JSON: INVALID ✗', e.message); }
