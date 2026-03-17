#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const frWords = /\b(Veuillez|Rechercher|Choisir|Entrez|Confirmez|Saisissez|Chargement|Connexion|Inscription|Sauvegarder|Voir tout|Voir plus|Ajouter|Aucun |Aucune |Filtre|Trier par|Tous les|Toutes les|Nouveau |Nouvelle |Obligatoire|Optionnel|Gratuit|En cours|Disponible|Indisponible|Sélectionner|Sélectionnez|Confirmer|Supprimer|Modifier|Envoyer|Enregistrer|Fermer|Retour|Suivant|Précédent|Réserver|Annuler|Créer)\b/;

function walk(dir, r = []) {
    try {
        for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f);
            try { if (fs.statSync(p).isDirectory()) walk(p, r); else if (p.endsWith('.tsx') || p.endsWith('.ts')) r.push(p); } catch (e) { }
        }
    } catch (e) { }
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
    if (!key || key.length < 2) key = 'text' + Math.random().toString(36).substring(2, 6);
    return key;
}

function isFrench(text) { return frChars.test(text) || frWords.test(text); }

function roughTranslate(t) {
    const m = {
        'Impossible de': 'Unable to', 'Veuillez': 'Please', 'Erreur': 'Error', 'Succès': 'Success',
        'Chargement': 'Loading', 'Aucun': 'No', 'Aucune': 'No', 'Rechercher': 'Search',
        'Sélectionner': 'Select', 'Sélectionnez': 'Select', 'Confirmer': 'Confirm',
        'Annuler': 'Cancel', 'Supprimer': 'Delete', 'Modifier': 'Edit', 'Ajouter': 'Add',
        'Créer': 'Create', 'Enregistrer': 'Save', 'Envoyer': 'Send', 'Valider': 'Validate',
        'Fermer': 'Close', 'Voir': 'View', 'Retour': 'Back', 'Suivant': 'Next',
        'Précédent': 'Previous', 'Réserver': 'Book', 'Connexion': 'Login',
        'Disponible': 'Available', 'Indisponible': 'Unavailable', 'Obligatoire': 'Required',
        'Optionnel': 'Optional', 'Gratuit': 'Free', 'En cours': 'In progress',
        'Nouveau': 'New', 'Nouvelle': 'New', 'Tous les': 'All', 'Toutes les': 'All',
        'Mon ': 'My ', 'Ma ': 'My ', 'Mes ': 'My ', 'Nos ': 'Our ',
        'Votre': 'Your', 'Vos': 'Your',
        'le ': 'the ', 'la ': 'the ', 'les ': 'the ', 'un ': 'a ', 'une ': 'a ',
        'de ': 'of ', 'du ': 'of the ', 'des ': 'of the ', 'et ': 'and ', 'ou ': 'or ',
        'est ': 'is ', 'sont ': 'are ', 'a été': 'has been', 'ont été': 'have been',
        'en ': 'in ', 'pour ': 'for ', 'avec ': 'with ', 'sans ': 'without ',
        'sur ': 'on ', 'dans ': 'in ', 'par ': 'by ', 'pas ': 'not ',
        'nom': 'name', 'numéro': 'number', 'adresse': 'address',
        'téléphone': 'phone', 'produit': 'product', 'service': 'service',
        'commande': 'order', 'livraison': 'delivery', 'prix': 'price',
        'catégorie': 'category', 'quantité': 'quantity', 'montant': 'amount',
        'description': 'description', 'titre': 'title', 'type': 'type',
        'photo': 'photo', 'vidéo': 'video', 'profil': 'profile',
        'résultat': 'result', 'détail': 'detail', 'message': 'message',
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
            const subs = ['/screens/specialized/', '/screens/delivery/', '/screens/auth/',
                '/screens/orientation/', '/screens/service/', '/screens/offres-emploi/',
                '/screens/promo/', '/screens/video/', '/components/delivery/',
                '/components/chat/', '/components/specialized/', '/components/troc/',
                '/components/video/'];
            if (subs.some(s => rel.includes(s))) prefix = '../../';
            lines.splice(lastImport + 1, 0, "import { useLanguageSafe } from '" + prefix + "contexts/LanguageContext';");
            content = lines.join('\n');
        }
    }
    if (!content.match(/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguageSafe/)) {
        const hl = '    const { t } = useLanguageSafe();';
        const pats = [
            /(const toaster = useToaster\(\);)/,
            /(const navigation = useNavigation[^;]*;)/,
            /(const route = useRoute[^;]*;)/,
            /(const insets = useSafeAreaInsets\(\);)/,
        ];
        let ins = false;
        for (const p of pats) {
            if (content.match(p)) { content = content.replace(p, '$1\n' + hl); ins = true; break; }
        }
        if (!ins) {
            const st = content.match(/(const \[[^\]]+\]\s*=\s*useState[^;]*;)/);
            if (st) content = content.replace(st[0], hl + '\n' + st[0]);
        }
    }
    return content;
}

const files = [];
['mobile/src/screens', 'mobile/src/components'].forEach(d => walk(d, files));

let totalRepairs = 0, filesFixed = 0;

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!frChars.test(content) && !frWords.test(content)) continue;
    const ns = getNamespace(filePath);
    const lines = content.split('\n');
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const tr = line.trim();
        if (tr.startsWith('//') || tr.startsWith('*') || tr.startsWith('/*') || tr.startsWith('import ')) continue;
        if (tr.match(/console\.(log|warn|error|info)/)) continue;
        if (tr.match(/t\s*\(/) && !isFrench(tr.replace(/t\s*\([^)]*\)/g, ''))) continue;

        let nl = line, lm = false;

        // 1. >French text<
        nl = nl.replace(/>([^<>{]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>{}]*)</g, (m, text) => {
            const c = text.trim();
            if (!c || c.length > 120 || c.length < 2) return m;
            if (m.includes("t('") || m.includes('t("')) return m;
            if (!/[a-zà-ÿ]{2,}/i.test(c)) return m;
            const key = textToKey(c);
            addKey(ns, key, c);
            lm = true; totalRepairs++;
            return ">{t('" + ns + '.' + key + "')}";
        });

        // 2. placeholder="French"
        nl = nl.replace(/placeholder\s*=\s*["']([^"']{3,100})["']/g, (m, text) => {
            if (!isFrench(text) || m.includes("t(")) return m;
            const key = textToKey(text);
            addKey(ns, key, text);
            lm = true; totalRepairs++;
            return "placeholder={t('" + ns + '.' + key + "')}";
        });

        // 3. label="French" / title="French"
        nl = nl.replace(/(label|title|headerTitle|tabBarLabel|buttonText)\s*=\s*["']([^"']{3,100})["']/g, (m, prop, text) => {
            if (!isFrench(text) || m.includes("t(")) return m;
            const key = textToKey(text);
            addKey(ns, key, text);
            lm = true; totalRepairs++;
            return prop + "={t('" + ns + '.' + key + "')}";
        });

        // 4. label: 'French' in objects
        nl = nl.replace(/(\blabel\s*:\s*)['"]([^'"]{3,100})['"]/g, (m, pre, text) => {
            if (!isFrench(text) || m.includes("t(")) return m;
            const key = textToKey(text);
            addKey(ns, key, text);
            lm = true; totalRepairs++;
            return pre + "t('" + ns + '.' + key + "')";
        });

        // 5. || 'French' or ?? 'French'
        nl = nl.replace(/(\|\||&&|\?\?)\s*['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g, (m, op, text) => {
            if (m.includes("t(") || text.length < 3 || text.length > 100) return m;
            const key = textToKey(text);
            addKey(ns, key, text);
            lm = true; totalRepairs++;
            return op + " t('" + ns + '.' + key + "')";
        });

        // 6. {'French'} in JSX
        nl = nl.replace(/\{['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"](\s*\})/g, (m, text, suf) => {
            if (text.length < 3 || text.length > 120) return m;
            const before = nl.substring(0, nl.indexOf(m));
            if (before.endsWith("t(")) return m;
            if (before.match(/(key|id|name|type|style|color|source|uri|require)\s*[:=]\s*$/i)) return m;
            const key = textToKey(text);
            addKey(ns, key, text);
            lm = true; totalRepairs++;
            return "{t('" + ns + '.' + key + "')" + suf;
        });

        // 7. text: 'French' in objects
        nl = nl.replace(/(\btext\s*:\s*)['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g, (m, pre, text) => {
            if (m.includes("t(")) return m;
            const key = textToKey(text);
            addKey(ns, key, text);
            lm = true; totalRepairs++;
            return pre + "t('" + ns + '.' + key + "')";
        });

        // 8. message: 'French' in objects
        nl = nl.replace(/(\bmessage\s*:\s*)['"]([^'"]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^'"]*)['"]/g, (m, pre, text) => {
            if (m.includes("t(")) return m;
            const key = textToKey(text);
            addKey(ns, key, text);
            lm = true; totalRepairs++;
            return pre + "t('" + ns + '.' + key + "')";
        });

        if (lm) { lines[i] = nl; modified = true; }
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

console.log('\n=== Fix Remaining Screens/Components i18n ===');
console.log('Files fixed:', filesFixed);
console.log('Total replacements:', totalRepairs);
try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR: Valid'); } catch (e) { console.log('FR: INVALID', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch (e) { console.log('EN: INVALID', e.message); }
