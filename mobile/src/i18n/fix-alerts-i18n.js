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
            try {
                if (fs.statSync(p).isDirectory()) walk(p, r);
                else if (p.endsWith('.tsx') || p.endsWith('.ts')) r.push(p);
            } catch(e) {}
        }
    } catch(e) {}
    return r;
}

function getNamespace(filePath) {
    const base = path.basename(filePath, path.extname(filePath));
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

const roughMap = {
    'impossible': 'Unable', 'veuillez': 'Please', 'erreur': 'Error', 'succès': 'Success',
    'réussi': 'Successful', 'échec': 'Failed', 'connexion': 'Connection', 'chargement': 'Loading',
    'permission': 'Permission', 'requise': 'Required', 'autoriser': 'Allow', 'accès': 'Access',
    'caméra': 'Camera', 'galerie': 'Gallery', 'localisation': 'Location', 'nécessaire': 'Required',
    'disponible': 'Available', 'indisponible': 'Unavailable', 'sélectionner': 'Select',
    'confirmer': 'Confirm', 'annuler': 'Cancel', 'supprimer': 'Delete', 'modifier': 'Edit',
    'ajouter': 'Add', 'créer': 'Create', 'enregistrer': 'Save', 'envoyer': 'Send',
    'valider': 'Validate', 'fermer': 'Close', 'ouvrir': 'Open', 'rechercher': 'Search',
    'inscription': 'Registration', 'déconnexion': 'Logout', 'mot de passe': 'Password',
    'téléphone': 'Phone', 'adresse': 'Address', 'réservation': 'Reservation',
    'commande': 'Order', 'livraison': 'Delivery', 'paiement': 'Payment',
    'notification': 'Notification', 'message': 'Message', 'produit': 'Product',
    'service': 'Service', 'pharmacie': 'Pharmacy', 'médicament': 'Medication',
    'médecin': 'Doctor', 'hôpital': 'Hospital', 'transport': 'Transport',
    'véhicule': 'Vehicle', 'passager': 'Passenger', 'billet': 'Ticket',
    'horaire': 'Schedule', 'destination': 'Destination', 'agence': 'Agency',
    'assurance': 'Insurance', 'immobilier': 'Real estate', 'école': 'School',
    'formation': 'Training', 'emploi': 'Job', 'offre': 'Offer',
    'boutique': 'Shop', 'marché': 'Market', 'menu': 'Menu',
    'recette': 'Recipe', 'stock': 'Stock', 'inventaire': 'Inventory',
    'catégorie': 'Category', 'quantité': 'Quantity', 'prix': 'Price',
    'montant': 'Amount', 'total': 'Total', 'gratuit': 'Free',
    'attention': 'Warning', 'information': 'Information', 'confirmation': 'Confirmation',
    'suppression': 'Deletion', 'mise à jour': 'Update', 'succèss': 'Success',
    'félicitations': 'Congratulations', 'bienvenue': 'Welcome',
    'désolé': 'Sorry', 'merci': 'Thank you',
    'le ': 'the ', 'la ': 'the ', 'les ': 'the ', 'un ': 'a ', 'une ': 'a ',
    'de ': 'of ', 'du ': 'of the ', 'des ': 'of the ', 'et ': 'and ', 'ou ': 'or ',
    'est ': 'is ', 'sont ': 'are ', 'a été': 'has been', 'ont été': 'have been',
    'pas ': 'not ', 'ne ': '', 'en ': 'in ', 'pour ': 'for ', 'avec ': 'with ',
    'sans ': 'without ', 'sur ': 'on ', 'dans ': 'in ', 'par ': 'by ',
    'votre ': 'your ', 'vos ': 'your ', 'notre ': 'our ', 'nos ': 'our ',
    'ce ': 'this ', 'cette ': 'this ', 'ces ': 'these ',
    'mon ': 'my ', 'ma ': 'my ', 'mes ': 'my ',
    'être': 'be', 'avoir': 'have', 'faire': 'do', 'aller': 'go',
    'qui ': 'who ', 'que ': 'that ', 'dont ': 'whose ',
    'réessayer': 'try again', 'réessayez': 'try again',
    'contacter': 'contact', 'vérifier': 'verify', 'vérifiez': 'verify',
    'sélectionnez': 'select', 'entrez': 'enter', 'choisissez': 'choose',
    'remplissez': 'fill in', 'indiquez': 'indicate', 'précisez': 'specify',
    'ajoutez': 'add', 'supprimez': 'delete', 'modifiez': 'edit',
    'consultez': 'check', 'téléchargez': 'download', 'partagez': 'share',
    'acceptez': 'accept', 'refusez': 'refuse',
    'compte': 'account', 'profil': 'profile', 'paramètre': 'setting',
    'fonctionnalité': 'feature', 'option': 'option',
    'trajet': 'trip', 'itinéraire': 'itinerary', 'voyage': 'travel',
    'colis': 'parcel', 'expédition': 'shipment',
    'photo': 'photo', 'vidéo': 'video', 'image': 'image', 'fichier': 'file',
    'membre': 'member', 'équipe': 'team', 'client': 'client',
    'prestataire': 'provider', 'utilisateur': 'user',
    'rôle': 'role', 'droits': 'rights', 'accéder': 'access',
    'démarrer': 'start', 'arrêter': 'stop', 'terminer': 'end',
    'récupérer': 'retrieve', 'mettre à jour': 'update',
    'position': 'position', 'carte': 'map', 'zone': 'area',
    'distance': 'distance', 'proximité': 'proximity',
    'jour': 'day', 'semaine': 'week', 'mois': 'month', 'année': 'year',
    'aujourd': 'today', 'demain': 'tomorrow', 'hier': 'yesterday',
    'maintenant': 'now', 'bientôt': 'soon', 'plus tard': 'later',
    'avant': 'before', 'après': 'after', 'pendant': 'during',
    'nombre': 'number', 'minimum': 'minimum', 'maximum': 'maximum',
    'limite': 'limit', 'taille': 'size', 'poids': 'weight',
    'description': 'description', 'titre': 'title', 'nom': 'name',
    'numéro': 'number', 'code': 'code', 'identifiant': 'identifier',
    'statut': 'status', 'état': 'state', 'type': 'type',
    'résultat': 'result', 'détail': 'detail',
    'obligatoire': 'required', 'optionnel': 'optional',
    'actif': 'active', 'inactif': 'inactive',
    'nouveau': 'new', 'ancien': 'old',
};

function roughTranslate(frText) {
    let result = frText;
    for (const [f, e] of Object.entries(roughMap)) {
        result = result.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), e);
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
            if (rel.includes('/screens/specialized/') || rel.includes('/screens/delivery/') ||
                rel.includes('/screens/auth/') || rel.includes('/screens/orientation/') ||
                rel.includes('/screens/service/') || rel.includes('/screens/offres-emploi/') ||
                rel.includes('/screens/promo/') || rel.includes('/screens/video/') ||
                rel.includes('/components/delivery/') || rel.includes('/components/chat/') ||
                rel.includes('/components/specialized/') || rel.includes('/components/troc/') ||
                rel.includes('/components/video/')) {
                prefix = '../../';
            }
            lines.splice(lastImportLine + 1, 0, `import { useLanguageSafe } from '${prefix}contexts/LanguageContext';`);
            content = lines.join('\n');
        }
    }

    if (!content.match(/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguageSafe/)) {
        const hookLine = '    const { t } = useLanguageSafe();';
        const hookPatterns = [
            /(const toaster = useToaster\(\);)/,
            /(const navigation = useNavigation[^;]*;)/,
            /(const \{ callWithFallback \} = useAIWithFallback\(\);)/,
            /(const route = useRoute[^;]*;)/,
            /(const insets = useSafeAreaInsets\(\);)/,
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
        if (!inserted) {
            // Try after component function declaration
            const funcMatch = content.match(/((?:const|function)\s+\w+\s*[:=]\s*(?:React\.FC[^{]*|[^{]*)\{)/);
            if (funcMatch) {
                content = content.replace(funcMatch[0], funcMatch[0] + '\n' + hookLine);
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
    const ns = getNamespace(filePath);
    let modified = false;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('Alert.alert(')) continue;
        
        let newLine = line;
        let lineModified = false;

        // Pattern: Alert.alert('French', ... or Alert.alert(expr, 'French'
        // Match Alert.alert( then find string args that are French
        
        // Replace first string arg if French and not t()
        newLine = newLine.replace(
            /(Alert\.alert\(\s*)(['"])([^'"]{2,120})\2/g,
            (match, prefix, quote, text) => {
                if (!frChars.test(text)) return match;
                // Check if this is already inside a t() call
                const beforeMatch = newLine.substring(0, newLine.indexOf(match));
                if (beforeMatch.endsWith("t(")) return match;
                
                const key = textToKey(text);
                addKey(ns, key, text);
                lineModified = true;
                totalRepairs++;
                return `${prefix}t('${ns}.${key}')`;
            }
        );

        // Replace second string arg (after first comma) if French and not t()
        newLine = newLine.replace(
            /(Alert\.alert\([^,]+,\s*)(['"])([^'"]{2,200})\2/g,
            (match, prefix, quote, text) => {
                if (!frChars.test(text)) return match;
                if (match.includes("t('") && !frChars.test(text.replace(/t\('[^']*'\)/g, ''))) return match;
                
                const key = textToKey(text);
                addKey(ns, key, text);
                lineModified = true;
                totalRepairs++;
                return `${prefix}t('${ns}.${key}')`;
            }
        );

        // Also handle: Alert.alert(t('key'), 'French message')
        newLine = newLine.replace(
            /(Alert\.alert\(t\('[^']+'\)\s*,\s*)(['"])([^'"]{2,200})\2/g,
            (match, prefix, quote, text) => {
                if (!frChars.test(text)) return match;
                
                const key = textToKey(text);
                addKey(ns, key, text);
                lineModified = true;
                totalRepairs++;
                return `${prefix}t('${ns}.${key}')`;
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

console.log('\n=== Fix Alerts i18n Results ===');
console.log('Files fixed:', filesFixed);
console.log('Total alert args replaced:', totalRepairs);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid'); } catch (e) { console.log('FR JSON: INVALID', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid'); } catch (e) { console.log('EN JSON: INVALID', e.message); }
