#!/usr/bin/env node
/**
 * fix-alerts-v2.js — Fix remaining Alert.alert() with hardcoded French
 * Handles: template literals, string concatenation, partial French fragments,
 * backtick strings, and complex multi-line alerts.
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
        'Permission': 'Permission', 'nécessaire': 'required', 'requise': 'required',
        'Numéro invalide': 'Invalid number', 'Date expirée': 'Expired date',
        'Le paiement a échoué': 'Payment failed', 'Réponse incorrecte': 'Incorrect answer',
        'Aucun produit trouvé': 'No product found', 'Aucun': 'No', 'Aucune': 'No',
        'Impossible': 'Unable', 'Chargement': 'Loading', 'Connexion': 'Connection',
        'Rechercher': 'Search', 'Sélectionner': 'Select', 'Sélectionnez': 'Select',
        'Confirmer': 'Confirm', 'Annuler': 'Cancel', 'Supprimer': 'Delete',
        'Modifier': 'Edit', 'Ajouter': 'Add', 'Créer': 'Create', 'Enregistrer': 'Save',
        'Envoyer': 'Send', 'Valider': 'Validate', 'Fermer': 'Close', 'Ouvrir': 'Open',
        'Réserver': 'Book', 'Partager': 'Share', 'Copier': 'Copy', 'Coller': 'Paste',
        'caméra': 'camera', 'galerie': 'gallery', 'localisation': 'location',
        'microphone': 'microphone', 'téléphone': 'phone', 'numéro': 'number',
        'adresse': 'address', 'produit': 'product', 'service': 'service',
        'commande': 'order', 'livraison': 'delivery', 'prix': 'price',
        'paiement': 'payment', 'réservation': 'reservation', 'équipe': 'team',
        'vidéo': 'video', 'photo': 'photo', 'image': 'image', 'audio': 'audio',
        'médicament': 'medication', 'pharmacie': 'pharmacy', 'hôpital': 'hospital',
        'hôtel': 'hotel', 'meublé': 'furnished', 'taxi': 'taxi', 'bus': 'bus',
        'coursier': 'courier', 'prestataire': 'provider', 'client': 'client',
        'utilisateur': 'user', 'partenaire': 'partner', 'conducteur': 'driver',
        'passager': 'passenger', 'voyageur': 'traveler',
        'le ': 'the ', 'la ': 'the ', 'les ': 'the ', 'un ': 'a ', 'une ': 'a ',
        'de ': 'of ', 'du ': 'of the ', 'des ': 'of the ', 'et ': 'and ', 'ou ': 'or ',
        'est ': 'is ', 'sont ': 'are ', 'a été': 'has been', 'ont été': 'have been',
        'en ': 'in ', 'pour ': 'for ', 'avec ': 'with ', 'sans ': 'without ',
        'sur ': 'on ', 'dans ': 'in ', 'par ': 'by ', 'pas ': 'not ',
        'résultat': 'result', 'résultats': 'results', 'détail': 'detail',
        'message': 'message', 'erreur': 'error', 'succès': 'success',
        'problème': 'problem', 'configur': 'configur', 'mis à jour': 'updated',
        'ajout': 'added', 'supprim': 'delet', 'modifi': 'modifi',
        'enregistr': 'sav', 'envoy': 'sen', 'récupér': 'retriev',
        'charger': 'load', 'télécharger': 'download', 'uploader': 'upload',
        'démarrer': 'start', 'arrêter': 'stop', 'annul': 'cancel',
        'votre ': 'your ', 'vos ': 'your ', 'notre ': 'our ', 'nos ': 'our ',
        'mon ': 'my ', 'ma ': 'my ', 'mes ': 'my ',
        'ce ': 'this ', 'cet ': 'this ', 'cette ': 'this ', 'ces ': 'these ',
    };
    let result = t;
    const sorted = Object.entries(m).sort((a, b) => b[0].length - a[0].length);
    for (const [f, e] of sorted) {
        result = result.split(f).join(e);
        result = result.split(f.charAt(0).toUpperCase() + f.slice(1)).join(e.charAt(0).toUpperCase() + e.slice(1));
    }
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
    // Ensure const { t } = useLanguageSafe() exists
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
    const ns = getNamespace(filePath);
    let modified = false;

    // Pattern 1: Alert.alert('French', 'French') — simple single-quote strings with French chars
    // Already handled by fix-alerts-i18n.js, but catch any that slipped through
    const alertSingleQuote = /Alert\.alert\(\s*'([^']*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^']*)'/g;
    let match;
    while ((match = alertSingleQuote.exec(content)) !== null) {
        const text = match[1];
        if (text.length < 3 || text.length > 120) continue;
        if (content.substring(match.index - 5, match.index).includes('t(')) continue;
        const key = textToKey(text);
        addKey(ns, key, text);
        const old = `Alert.alert('${text}'`;
        const rep = `Alert.alert(t('${ns}.${key}')`;
        if (content.includes(old)) {
            content = content.replace(old, rep);
            modified = true; totalRepairs++;
        }
    }

    // Pattern 2: Alert.alert("French", "French") — double-quote strings
    const alertDoubleQuote = /Alert\.alert\(\s*"([^"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^"]*)"/g;
    while ((match = alertDoubleQuote.exec(content)) !== null) {
        const text = match[1];
        if (text.length < 3 || text.length > 120) continue;
        if (content.substring(match.index - 5, match.index).includes('t(')) continue;
        const key = textToKey(text);
        addKey(ns, key, text);
        const old = `Alert.alert("${text}"`;
        const rep = `Alert.alert(t('${ns}.${key}')`;
        if (content.includes(old)) {
            content = content.replace(old, rep);
            modified = true; totalRepairs++;
        }
    }

    // Pattern 3: , 'French text with accents') in Alert context — second arg
    const alertSecondArg = /,\s*'([^']*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^']*)'\s*[,)]/g;
    while ((match = alertSecondArg.exec(content)) !== null) {
        const text = match[1];
        if (text.length < 3 || text.length > 150) continue;
        // Only if in Alert context (check surrounding 200 chars)
        const before = content.substring(Math.max(0, match.index - 200), match.index);
        if (!before.includes('Alert.alert')) continue;
        if (content.substring(match.index - 5, match.index + 1).includes("t('")) continue;
        const key = textToKey(text);
        addKey(ns, key, text);
        const oldStr = `'${text}'`;
        const newStr = `t('${ns}.${key}')`;
        // Only replace this specific occurrence
        const idx = content.indexOf(oldStr, match.index);
        if (idx >= 0 && idx < match.index + match[0].length + 5) {
            content = content.substring(0, idx) + newStr + content.substring(idx + oldStr.length);
            modified = true; totalRepairs++;
        }
    }

    // Pattern 4: Template literals with French in Alert context: `French text ${var} more french`
    // Replace the whole template literal with t() + interpolation
    const alertBacktick = /Alert\.alert\(\s*`([^`]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^`]*)`/g;
    while ((match = alertBacktick.exec(content)) !== null) {
        const template = match[1];
        if (template.length > 200) continue;
        // Extract static parts for key
        const staticPart = template.replace(/\$\{[^}]+\}/g, '').trim();
        if (staticPart.length < 3) continue;
        const key = textToKey(staticPart);
        // For template literals with ${}, store with {{var}} placeholders
        let frVal = template;
        let hasInterp = false;
        const interpNames = [];
        frVal = frVal.replace(/\$\{([^}]+)\}/g, (m, expr) => {
            hasInterp = true;
            const name = expr.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
            interpNames.push({ name, expr });
            return `{{${name}}}`;
        });
        addKey(ns, key, frVal);
        if (hasInterp) {
            const interpObj = interpNames.map(n => `${n.name}: ${n.expr}`).join(', ');
            const replacement = `Alert.alert(t('${ns}.${key}', { ${interpObj} })`;
            content = content.replace(match[0], replacement);
        } else {
            content = content.replace(match[0], `Alert.alert(t('${ns}.${key}')`);
        }
        modified = true; totalRepairs++;
    }

    // Pattern 5: , `French template` in Alert context (second/third args)
    const alertBacktick2 = /,\s*`([^`]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^`]*)`/g;
    while ((match = alertBacktick2.exec(content)) !== null) {
        const before = content.substring(Math.max(0, match.index - 300), match.index);
        if (!before.includes('Alert.alert')) continue;
        const template = match[1];
        if (template.length > 250) continue;
        const staticPart = template.replace(/\$\{[^}]+\}/g, '').trim();
        if (staticPart.length < 3) continue;
        const key = textToKey(staticPart);
        let frVal = template;
        let hasInterp = false;
        const interpNames = [];
        frVal = frVal.replace(/\$\{([^}]+)\}/g, (m, expr) => {
            hasInterp = true;
            const name = expr.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
            interpNames.push({ name, expr });
            return `{{${name}}}`;
        });
        addKey(ns, key, frVal);
        const backtickStr = '`' + template + '`';
        let replacement;
        if (hasInterp) {
            const interpObj = interpNames.map(n => `${n.name}: ${n.expr}`).join(', ');
            replacement = `t('${ns}.${key}', { ${interpObj} })`;
        } else {
            replacement = `t('${ns}.${key}')`;
        }
        const idx = content.indexOf(backtickStr, match.index);
        if (idx >= 0 && idx < match.index + match[0].length + 5) {
            content = content.substring(0, idx) + replacement + content.substring(idx + backtickStr.length);
            modified = true; totalRepairs++;
        }
    }

    // Pattern 6: showError/showSuccess/showWarning/showInfo('French')
    const showFn = /(show(?:Error|Success|Warning|Info)|showToast)\(\s*['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g;
    while ((match = showFn.exec(content)) !== null) {
        const fnName = match[1];
        const text = match[2];
        if (text.length < 3 || text.length > 120) continue;
        const key = textToKey(text);
        addKey(ns, key, text);
        const oldStr = `${fnName}('${text}'`;
        const altStr = `${fnName}("${text}"`;
        const newStr = `${fnName}(t('${ns}.${key}')`;
        if (content.includes(oldStr)) {
            content = content.replace(oldStr, newStr);
            modified = true; totalRepairs++;
        } else if (content.includes(altStr)) {
            content = content.replace(altStr, newStr);
            modified = true; totalRepairs++;
        }
    }

    // Pattern 7: throw new Error('French')
    const throwErr = /throw new Error\(\s*['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]\s*\)/g;
    while ((match = throwErr.exec(content)) !== null) {
        const text = match[1];
        if (text.length < 3 || text.length > 120) continue;
        const key = textToKey(text);
        addKey(ns, key, text);
        content = content.replace(match[0], `throw new Error(t('${ns}.${key}'))`);
        modified = true; totalRepairs++;
    }

    // Pattern 8: { text: 'French' } in button arrays inside Alert
    const btnText = /\{\s*text:\s*['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g;
    while ((match = btnText.exec(content)) !== null) {
        const text = match[1];
        if (text.length < 2 || text.length > 60) continue;
        if (content.substring(match.index - 5, match.index).includes('t(')) continue;
        const key = textToKey(text);
        addKey(ns, key, text);
        const oldStr = match[0];
        const newStr = `{ text: t('${ns}.${key}')`;
        content = content.replace(oldStr, newStr);
        modified = true; totalRepairs++;
    }

    if (modified) {
        content = ensureImportAndHook(content, filePath);
        fs.writeFileSync(filePath, content, 'utf8');
        filesFixed++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log('\n=== Fix Alerts V2 (Deep) ===');
console.log('Files fixed:', filesFixed);
console.log('Total replacements:', totalRepairs);
try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR: Valid'); } catch(e) { console.log('FR: INVALID', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }
