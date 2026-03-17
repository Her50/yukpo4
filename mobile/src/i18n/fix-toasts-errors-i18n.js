#!/usr/bin/env node
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
    if (!key || key.length < 2) key = 'msg' + Math.random().toString(36).substring(2, 6);
    return key;
}

function roughTranslate(frText) {
    const map = {
        'Impossible': 'Unable', 'impossible': 'unable', 'Veuillez': 'Please', 'veuillez': 'please',
        'Erreur': 'Error', 'erreur': 'error', 'Ajout': 'Added', 'ajout': 'added',
        'au panier': 'to cart', 'panier': 'cart', 'produit': 'product',
        'Sélectionnez': 'Select', 'sélectionner': 'select', 'au moins': 'at least',
        'pour comparer': 'to compare', 'créée': 'created', 'créé': 'created',
        'pas pu être': 'could not be', 'Ce livre': 'This book', 'est rejeté': 'is rejected',
        'trop dégradé': 'too degraded', 'Valeur': 'Value',
        'copié': 'Copied', 'presse-papiers': 'clipboard', 'lien': 'link',
        'Le lien a été copié dans votre': 'The link has been copied to your',
        'Votre avis a été enregistré': 'Your review has been saved',
        'Vous devez garder': 'You must keep', 'au moins une scène': 'at least one scene',
        'Lieu de stockage créé avec succès': 'Storage location created successfully',
        'Impossible de créer le lieu de stockage': 'Unable to create storage location',
        'les médias': 'media', 'uploader': 'upload', 'Veuillez réessayer': 'Please try again',
        'Sample importé': 'Sample imported', 'Associez-le': 'Associate it',
        'Sélectionnez un service avant': 'Select a service before',
        "d'importer": 'importing', 'sample audio': 'audio sample',
        'à votre profil': 'to your profile',
        'La connexion a été perdue': 'The connection was lost',
        'appel': 'call', 'Membre retiré': 'Member removed',
        "de l'": 'from the ', 'Rôle mis à jour avec succès': 'Role updated successfully',
        'mettre à jour le rôle': 'update the role', 'données invalides': 'invalid data',
        'Impossible de mettre à jour le rôle': 'Unable to update the role',
        'type de signalement': 'report type', 'motif de signalement': 'report reason',
        'Veuillez préciser': 'Please specify', 'Veuillez sélectionner': 'Please select',
        'une note': 'a rating', 'un type': 'a type',
        'GPS': 'GPS', 'démarrer': 'start', 'récupérer': 'retrieve', 'la position': 'the position',
        'Impossible de démarrer le GPS': 'Unable to start GPS',
        'Impossible de récupérer la position': 'Unable to retrieve position',
        'Impossible de créer les réservations': 'Unable to create reservations',
        'Une erreur est survenue lors de la réservation': 'An error occurred during reservation',
        'enregistrer la vidéo': 'record the video', "arrêter l'": 'stop the ',
        'Coordonnées GPS invalides': 'Invalid GPS coordinates',
        "Veuillez sélectionner un produit d'": "Please select a product of ",
        'Tickets vendus': 'Tickets sold',
    };
    let result = frText;
    const sorted = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
    for (const [f, e] of sorted) {
        result = result.split(f).join(e);
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
        let lastImportLine = -1;
        for (let ii = 0; ii < lines.length; ii++) {
            if (lines[ii].match(/^import /)) lastImportLine = ii;
        }
        if (lastImportLine >= 0) {
            const rel = filePath.replace(/\\/g, '/');
            let prefix = '../';
            const subdirs = ['/screens/specialized/', '/screens/delivery/', '/screens/auth/',
                '/screens/orientation/', '/screens/service/', '/screens/offres-emploi/',
                '/screens/promo/', '/screens/video/', '/components/delivery/',
                '/components/chat/', '/components/specialized/', '/components/troc/',
                '/components/video/'];
            if (subdirs.some(s => rel.includes(s))) prefix = '../../';
            lines.splice(lastImportLine + 1, 0, "import { useLanguageSafe } from '" + prefix + "contexts/LanguageContext';");
            content = lines.join('\n');
        }
    }
    if (!content.match(/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguageSafe/)) {
        const hookLine = '    const { t } = useLanguageSafe();';
        const pats = [
            /(const toaster = useToaster\(\);)/,
            /(const navigation = useNavigation[^;]*;)/,
            /(const route = useRoute[^;]*;)/,
            /(const insets = useSafeAreaInsets\(\);)/,
        ];
        let inserted = false;
        for (const pat of pats) {
            if (content.match(pat)) {
                content = content.replace(pat, '$1\n' + hookLine);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            const st = content.match(/(const \[[^\]]+\]\s*=\s*useState[^;]*;)/);
            if (st) {
                content = content.replace(st[0], hookLine + '\n' + st[0]);
            }
        }
    }
    return content;
}

const files = [];
['mobile/src/screens', 'mobile/src/components'].forEach(d => walk(d, files));

let totalRepairs = 0;
let filesFixed = 0;

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!frChars.test(content)) continue;
    const ns = getNamespace(filePath);
    const lines = content.split('\n');
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('import ')) continue;
        if (trimmed.match(/console\.(log|warn|error|info)/)) continue;

        let newLine = line;
        let lineModified = false;

        // Toast: toaster.show('French') or toaster.success('French')
        newLine = newLine.replace(
            /(toaster\.\w+\(\s*)(['"])([^'"]{3,150})\2/g,
            (match, prefix, q, text) => {
                if (!frChars.test(text)) return match;
                if (match.includes("t(")) return match;
                const key = textToKey(text);
                addKey(ns, key, text);
                lineModified = true;
                totalRepairs++;
                return prefix + "t('" + ns + '.' + key + "')";
            }
        );

        // throw new Error('French')
        newLine = newLine.replace(
            /(throw new Error\(\s*)(['"])([^'"]{3,150})\2/g,
            (match, prefix, q, text) => {
                if (!frChars.test(text)) return match;
                if (match.includes("t(")) return match;
                const key = textToKey(text);
                addKey(ns, key, text);
                lineModified = true;
                totalRepairs++;
                return prefix + "t('" + ns + '.' + key + "')";
            }
        );

        // Also catch: {text: 'French'} in Alert button arrays
        newLine = newLine.replace(
            /(\btext\s*:\s*)(['"])([^'"]{2,100})\2/g,
            (match, prefix, q, text) => {
                if (!frChars.test(text)) return match;
                if (match.includes("t(")) return match;
                const key = textToKey(text);
                addKey(ns, key, text);
                lineModified = true;
                totalRepairs++;
                return prefix + "t('" + ns + '.' + key + "')";
            }
        );

        if (lineModified) {
            lines[i] = newLine;
            modified = true;
        }
    }

    if (modified) {
        content = lines.join('\n');
        content = ensureImportAndHook(content, filePath);
        fs.writeFileSync(filePath, content, 'utf8');
        filesFixed++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log('\n=== Fix Toasts/Errors/Buttons i18n ===');
console.log('Files fixed:', filesFixed);
console.log('Total replacements:', totalRepairs);
try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR: Valid'); } catch(e) { console.log('FR: INVALID', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID', e.message); }
