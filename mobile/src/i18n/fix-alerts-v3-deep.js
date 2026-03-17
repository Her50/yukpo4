#!/usr/bin/env node
/**
 * fix-alerts-v3-deep.js — Fix remaining hardcoded French in Alert.alert() calls
 * that use template literals, string concatenation, and partial fragments.
 * 
 * Strategy: For each file with remaining French alerts, read multi-line Alert.alert blocks,
 * extract full French strings (including across backtick boundaries), replace with t() calls.
 */
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;

function walk(dir, r = []) {
    try {
        for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f);
            try { if (fs.statSync(p).isDirectory()) walk(p, r); else if (p.endsWith('.tsx') || p.endsWith('.ts')) r.push(p); } catch(e) {}
        }
    } catch(e) {}
    return r;
}

function getNamespace(fp) {
    const base = path.basename(fp, path.extname(fp));
    return base.charAt(0).toLowerCase() + base.slice(1);
}

function textToKey(text) {
    let key = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim()
        .split(/\s+/).slice(0, 6)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    if (key.length > 50) key = key.substring(0, 50);
    if (!key || key.length < 2) key = 'alert' + Math.random().toString(36).substring(2, 6);
    return key;
}

function roughTranslate(t) {
    const m = {
        'Impossible de': 'Unable to', 'Veuillez': 'Please', 'Erreur': 'Error', 'Succès': 'Success',
        'Fonctionnalité': 'Feature', 'à venir': 'coming soon', 'à implémenter': 'to implement',
        'Chargement': 'Loading', 'Aucun': 'No', 'Aucune': 'No', 'Rechercher': 'Search',
        'Sélectionner': 'Select', 'Sélectionnez': 'Select', 'Confirmer': 'Confirm',
        'Annuler': 'Cancel', 'Supprimer': 'Delete', 'Modifier': 'Edit', 'Ajouter': 'Add',
        'Créer': 'Create', 'Enregistrer': 'Save', 'Envoyer': 'Send', 'Valider': 'Validate',
        'Fermer': 'Close', 'Voir': 'View', 'Retour': 'Back', 'Suivant': 'Next',
        'Précédent': 'Previous', 'Réserver': 'Book', 'Connexion': 'Login',
        'Disponible': 'Available', 'Indisponible': 'Unavailable',
        'Permission': 'Permission', 'nécessaire': 'required', 'requise': 'required',
        'Numéro invalide': 'Invalid number', 'Date expirée': 'Expired date',
        'Réponse incorrecte': 'Incorrect answer',
        'Le paiement a échoué': 'Payment failed',
        'Aucun produit trouvé': 'No product found',
        'Participant retiré': 'Participant removed',
        'Proposition annulée': 'Proposal cancelled',
        'Réservation annulée': 'Reservation cancelled', 'Réservation confirmée': 'Reservation confirmed',
        'Variante gagnante appliquée': 'Winning variant applied',
        'Disponibilité mise à jour': 'Availability updated',
        'Paramètres': 'Settings', 'Copier': 'Copy',
        'sélectionner': 'select', 'accéder': 'access', 'accès': 'access',
        'uploader': 'upload', 'démarrer': 'start', 'arrêter': 'stop',
        'enregistrer': 'save', 'envoyer': 'send', 'récupérer': 'retrieve',
        'charger': 'load', 'télécharger': 'download', 'ouvrir': 'open',
        'obtenir': 'get', 'estimer': 'estimate', 'générer': 'generate',
        'analyser': 'analyze', 'vérifier': 'verify', 'configurer': 'configure',
        'impossible': 'unable', 'erreur': 'error',
        'caméra': 'camera', 'galerie': 'gallery', 'localisation': 'location',
        'microphone': 'microphone', 'téléphone': 'phone', 'numéro': 'number',
        'vidéo': 'video', 'photo': 'photo', 'audio': 'audio', 'image': 'image',
        'médicament': 'medication', 'pharmacie': 'pharmacy', 'hôpital': 'hospital',
        'hôtel': 'hotel', 'meublé': 'furnished', 'équipe': 'team',
        'modalité': 'modality', 'storyboard': 'storyboard', 'médias': 'media',
        'réaction': 'reaction', 'commentaire': 'comment', 'avis': 'review',
        'réservation': 'reservation', 'paiement': 'payment', 'produit': 'product',
        'commande': 'order', 'livraison': 'delivery', 'coursier': 'courier',
        'prestataire': 'provider', 'coût': 'cost', 'stockage': 'storage',
        'interaction': 'interaction', 'dosage': 'dosage', 'lieu': 'place',
        'appel': 'call', 'média': 'media', 'brief': 'brief',
        'le ': 'the ', 'la ': 'the ', 'les ': 'the ', 'un ': 'a ', 'une ': 'a ',
        'de ': 'of ', 'du ': 'of the ', 'des ': 'of the ', 'et ': 'and ', 'ou ': 'or ',
        'l\'': 'the ', "d'": 'of ', "n'": 'not ', "s'": '',
        'est ': 'is ', 'sont ': 'are ', 'a été': 'has been',
        'en ': 'in ', 'pour ': 'for ', 'avec ': 'with ', 'sans ': 'without ',
        'sur ': 'on ', 'dans ': 'in ', 'par ': 'by ', 'pas ': 'not ',
        'votre ': 'your ', 'vos ': 'your ', 'notre ': 'our ',
        'ce ': 'this ', 'cet ': 'this ', 'cette ': 'this ', 'ces ': 'these ',
        'mon ': 'my ', 'ma ': 'my ', 'mes ': 'my ',
    };
    let result = t;
    const sorted = Object.entries(m).sort((a, b) => b[0].length - a[0].length);
    for (const [f, e] of sorted) result = result.split(f).join(e);
    return result;
}

function addKey(ns, key, frVal) {
    if (!fr[ns]) fr[ns] = {};
    if (!en[ns]) en[ns] = {};
    if (!fr[ns][key]) fr[ns][key] = frVal;
    if (!en[ns][key]) en[ns][key] = roughTranslate(frVal);
}

function ensureImportAndHook(content, filePath) {
    if (!content.includes('useLanguageSafe')) {
        const lines = content.split('\n');
        let lastImport = -1;
        for (let ii = 0; ii < lines.length; ii++) {
            if (lines[ii].match(/^import /)) lastImport = ii;
        }
        if (lastImport >= 0) {
            const rel = filePath.replace(/\\/g, '/');
            let prefix = '../';
            const deep = ['/screens/specialized/', '/screens/delivery/', '/screens/auth/',
                '/screens/orientation/', '/screens/service/', '/screens/offres-emploi/',
                '/screens/promo/', '/screens/video/', '/components/delivery/',
                '/components/chat/', '/components/specialized/', '/components/troc/',
                '/components/video/', '/components/bus/', '/components/blood/',
                '/components/covoiturage/'];
            if (deep.some(s => rel.includes(s))) prefix = '../../';
            lines.splice(lastImport + 1, 0, `import { useLanguageSafe } from '${prefix}contexts/LanguageContext';`);
            content = lines.join('\n');
        }
    }
    if (!content.match(/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguageSafe/)) {
        const hookLine = '    const { t } = useLanguageSafe();';
        const anchors = [
            /(const toaster = useToaster\(\);)/,
            /(const navigation = useNavigation[^;]*;)/,
            /(const route = useRoute[^;]*;)/,
            /(const insets = useSafeAreaInsets\(\);)/,
            /(const theme = useTheme\(\);)/,
        ];
        let inserted = false;
        for (const p of anchors) {
            if (content.match(p)) { content = content.replace(p, '$1\n' + hookLine); inserted = true; break; }
        }
        if (!inserted) {
            const stMatch = content.match(/(const \[[^\]]+\]\s*=\s*useState[^;]*;)/);
            if (stMatch) content = content.replace(stMatch[0], hookLine + '\n' + stMatch[0]);
        }
    }
    return content;
}

const files = [];
['mobile/src/screens', 'mobile/src/components'].forEach(d => walk(d, files));

let totalRepairs = 0, filesFixed = 0;

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!frChars.test(content)) continue;
    const ns = getNamespace(filePath);
    let modified = false;

    // Strategy: Find backtick strings with French chars that are inside or near Alert.alert context
    // Pattern A: Backtick strings as args (not just in Alert, but also in template literals used as messages)
    
    // 1. Simple backtick: `French text without interpolation`
    const simpleBacktick = /`([^`$]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^`$]*)`/g;
    let match;
    while ((match = simpleBacktick.exec(content)) !== null) {
        const text = match[1].trim();
        if (text.length < 3 || text.length > 150) continue;
        // Skip if inside console.log or comment
        const lineStart = content.lastIndexOf('\n', match.index);
        const lineText = content.substring(lineStart + 1, match.index + match[0].length);
        if (lineText.match(/\/\/|console\.|import |require\(|\.log\(|\.warn\(|\.error\(/)) continue;
        // Skip if already wrapped in t()
        if (content.substring(match.index - 3, match.index).includes('t(')) continue;
        
        const key = textToKey(text);
        addKey(ns, key, text);
        const old = '`' + match[1] + '`';
        const rep = "t('" + ns + '.' + key + "')";
        const idx = content.indexOf(old, match.index);
        if (idx === match.index) {
            content = content.substring(0, idx) + rep + content.substring(idx + old.length);
            modified = true; totalRepairs++;
            // Reset regex since content changed
            simpleBacktick.lastIndex = idx + rep.length;
        }
    }

    // 2. Backtick with interpolation: `French ${var} text`
    const interpBacktick = /`([^`]*\$\{[^}]+\}[^`]*)`/g;
    while ((match = interpBacktick.exec(content)) !== null) {
        const template = match[1];
        if (!frChars.test(template)) continue;
        if (template.length > 250) continue;
        const lineStart = content.lastIndexOf('\n', match.index);
        const lineText = content.substring(lineStart + 1, match.index + 20);
        if (lineText.match(/\/\/|console\.|import |require\(/)) continue;
        if (content.substring(match.index - 3, match.index).includes('t(')) continue;
        
        const staticPart = template.replace(/\$\{[^}]+\}/g, '').trim();
        if (staticPart.length < 3) continue;
        const key = textToKey(staticPart);
        
        let frVal = template;
        const interpNames = [];
        let counter = 0;
        frVal = frVal.replace(/\$\{([^}]+)\}/g, (m, expr) => {
            counter++;
            let name = expr.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 25);
            if (!name || name === '_') name = 'val' + counter;
            interpNames.push({ name, expr });
            return `{{${name}}}`;
        });
        addKey(ns, key, frVal);
        
        const old = '`' + template + '`';
        let rep;
        if (interpNames.length > 0) {
            const obj = interpNames.map(n => `${n.name}: ${n.expr}`).join(', ');
            rep = `t('${ns}.${key}', { ${obj} })`;
        } else {
            rep = `t('${ns}.${key}')`;
        }
        const idx = content.indexOf(old, match.index);
        if (idx === match.index) {
            content = content.substring(0, idx) + rep + content.substring(idx + old.length);
            modified = true; totalRepairs++;
            interpBacktick.lastIndex = idx + rep.length;
        }
    }

    // 3. String concatenation: 'French' + var + 'more French'
    // Just handle simple 'French text' that has accented chars and isn't already t()
    const singleQuoteFr = /'([^']*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^']*)'/g;
    while ((match = singleQuoteFr.exec(content)) !== null) {
        const text = match[1];
        if (text.length < 3 || text.length > 120) continue;
        const lineStart = content.lastIndexOf('\n', match.index);
        const lineText = content.substring(lineStart + 1, match.index + match[0].length);
        if (lineText.match(/\/\/|console\.|import |require\(|\.log\(|\.warn\(|\.error\(/)) continue;
        // Skip if preceded by t(
        const before5 = content.substring(Math.max(0, match.index - 5), match.index);
        if (before5.includes("t(") || before5.includes("t('")) continue;
        // Skip property keys like key: 'value'
        const before20 = content.substring(Math.max(0, match.index - 20), match.index).trim();
        if (before20.match(/(key|id|name|type|style|color|source|uri|icon|route|screen|mode|status|format|encoding|method)\s*[:=]\s*$/i)) continue;
        // Skip require and imports
        if (before20.includes('require(') || before20.includes('from ')) continue;
        
        const key = textToKey(text);
        addKey(ns, key, text);
        const old = "'" + text + "'";
        const rep = "t('" + ns + '.' + key + "')";
        const idx = content.indexOf(old, match.index);
        if (idx === match.index) {
            content = content.substring(0, idx) + rep + content.substring(idx + old.length);
            modified = true; totalRepairs++;
            singleQuoteFr.lastIndex = idx + rep.length;
        }
    }

    // 4. Same for double-quoted strings
    const doubleQuoteFr = /"([^"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^"]*)"/g;
    while ((match = doubleQuoteFr.exec(content)) !== null) {
        const text = match[1];
        if (text.length < 3 || text.length > 120) continue;
        const lineStart = content.lastIndexOf('\n', match.index);
        const lineText = content.substring(lineStart + 1, match.index + match[0].length);
        if (lineText.match(/\/\/|console\.|import |require\(|\.log\(|\.warn\(|\.error\(/)) continue;
        const before5 = content.substring(Math.max(0, match.index - 5), match.index);
        if (before5.includes('t(') || before5.includes('t("')) continue;
        const before20 = content.substring(Math.max(0, match.index - 20), match.index).trim();
        if (before20.match(/(key|id|name|type|style|color|source|uri|icon|route|screen|mode|status|format|encoding|method)\s*[:=]\s*$/i)) continue;
        if (before20.includes('require(') || before20.includes('from ')) continue;
        
        const key = textToKey(text);
        addKey(ns, key, text);
        const old = '"' + text + '"';
        const rep = "t('" + ns + '.' + key + "')";
        const idx = content.indexOf(old, match.index);
        if (idx === match.index) {
            content = content.substring(0, idx) + rep + content.substring(idx + old.length);
            modified = true; totalRepairs++;
            doubleQuoteFr.lastIndex = idx + rep.length;
        }
    }

    if (modified) {
        content = ensureImportAndHook(content, filePath);
        fs.writeFileSync(filePath, content, 'utf8');
        filesFixed++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log('\n=== Fix Alerts V3 (Deep Backtick/Concat) ===');
console.log('Files fixed:', filesFixed);
console.log('Total replacements:', totalRepairs);
try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR: Valid'); } catch(e) { console.log('FR: INVALID', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }
