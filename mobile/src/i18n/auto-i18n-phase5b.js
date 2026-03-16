#!/usr/bin/env node
/**
 * Phase 5b: Target remaining user-visible French strings across all files
 * Focus: label= props, placeholder= props, text: in objects, JSX text with accents
 * Skip: keywords arrays, comments, console.log, AI prompts, EXCEL_TEMPLATES
 */
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';

const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

function walk(dir, results = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, results);
        else if (p.endsWith('.tsx') || p.endsWith('.ts')) results.push(p);
    }
    return results;
}

const dirs = ['mobile/src/screens', 'mobile/src/components'];
const files = [];
dirs.forEach(d => walk(d, files));

// ===== Translation helpers =====
const wordMap = {
    'Rechercher': 'Search', 'Sélectionner': 'Select', 'Ajouter': 'Add',
    'Modifier': 'Edit', 'Supprimer': 'Delete', 'Confirmer': 'Confirm',
    'Annuler': 'Cancel', 'Valider': 'Validate', 'Envoyer': 'Send',
    'Enregistrer': 'Save', 'Créer': 'Create', 'Fermer': 'Close',
    'Retour': 'Back', 'Suivant': 'Next', 'Précédent': 'Previous',
    'Télécharger': 'Download', 'Partager': 'Share', 'Copier': 'Copy',
    'Ouvrir': 'Open', 'Voir': 'See', 'Nouveau': 'New',
    'Chargement': 'Loading', 'Connexion': 'Login', 'Déconnexion': 'Logout',
    'Inscription': 'Registration', 'Erreur': 'Error', 'Succès': 'Success',
    'Impossible': 'Unable', 'Veuillez': 'Please', 'Obligatoire': 'Required',
    'Disponible': 'Available', 'Indisponible': 'Unavailable',
    'Gratuit': 'Free', 'Payant': 'Paid', 'Optionnel': 'Optional',
    'Détails': 'Details', 'Profil': 'Profile', 'Accueil': 'Home',
    'Paramètres': 'Settings', 'Réserver': 'Reserve', 'Entrez': 'Enter',
    'Aucun': 'None', 'Mettre': 'Put', 'Rafraîchir': 'Refresh',
    'Actualiser': 'Refresh', 'Photo': 'Photo', 'Galerie': 'Gallery',
    'Caméra': 'Camera', 'Date': 'Date', 'Heure': 'Time', 'Lieu': 'Place',
    'Ville': 'City', 'Quartier': 'Neighborhood', 'Adresse': 'Address',
    'Nom': 'Name', 'Prénom': 'First name', 'Téléphone': 'Phone',
    'Description': 'Description', 'Catégorie': 'Category', 'Prix': 'Price',
    'Quantité': 'Quantity', 'Mot de passe': 'Password',
    'les': 'the', 'des': 'of the', 'une': 'a', 'un': 'a', 'le': 'the',
    'la': 'the', 'du': 'of the', 'de': 'of', 'et': 'and', 'ou': 'or',
    'en': 'in', 'à': 'to', 'au': 'at the', 'pour': 'for', 'par': 'by',
    'avec': 'with', 'sans': 'without', 'sur': 'on', 'dans': 'in',
    'votre': 'your', 'mon': 'my', 'ce': 'this', 'cette': 'this',
    'tous': 'all', 'tout': 'all', 'ici': 'here',
    'résultat': 'result', 'résultats': 'results', 'trouvé': 'found',
    'sélectionné': 'selected', 'ajouté': 'added', 'supprimé': 'deleted',
    'modifié': 'modified', 'envoyé': 'sent', 'reçu': 'received',
    'terminé': 'completed', 'annulé': 'cancelled', 'validé': 'validated',
    'champ': 'field', 'champs': 'fields', 'formulaire': 'form',
    'liste': 'list', 'élément': 'element', 'éléments': 'elements',
    'service': 'service', 'services': 'services', 'produit': 'product',
    'produits': 'products', 'commande': 'order', 'commandes': 'orders',
    'livraison': 'delivery', 'paiement': 'payment', 'compte': 'account',
    'message': 'message', 'messages': 'messages', 'notification': 'notification',
    'recherche': 'search', 'filtre': 'filter', 'filtres': 'filters',
    'trier': 'sort', 'type': 'type', 'statut': 'status',
    'montant': 'amount', 'total': 'total', 'solde': 'balance',
    'kilomètre': 'kilometer', 'kilomètres': 'kilometers',
    'minute': 'minute', 'minutes': 'minutes', 'heure': 'hour',
    'heures': 'hours', 'jour': 'day', 'jours': 'days',
    'semaine': 'week', 'semaines': 'weeks', 'mois': 'month',
    'année': 'year', 'années': 'years',
    'début': 'start', 'fin': 'end', 'durée': 'duration',
    'départ': 'departure', 'arrivée': 'arrival', 'destination': 'destination',
    'itinéraire': 'route', 'trajet': 'trip', 'voyage': 'journey',
    'passager': 'passenger', 'passagers': 'passengers',
    'conducteur': 'driver', 'chauffeur': 'driver',
    'véhicule': 'vehicle', 'voiture': 'car', 'moto': 'motorcycle',
    'bus': 'bus', 'taxi': 'taxi', 'camion': 'truck',
    'place': 'seat', 'places': 'seats', 'siège': 'seat',
    'billet': 'ticket', 'billets': 'tickets', 'réservation': 'reservation',
    'agence': 'agency', 'hôtel': 'hotel', 'chambre': 'room',
    'restaurant': 'restaurant', 'pharmacie': 'pharmacy',
    'hôpital': 'hospital', 'clinique': 'clinic', 'médecin': 'doctor',
    'laboratoire': 'laboratory', 'assurance': 'insurance',
    'sinistre': 'claim', 'déclaration': 'declaration',
    'contrat': 'contract', 'police': 'policy',
    'menu': 'menu', 'plat': 'dish', 'repas': 'meal',
    'semaine': 'week', 'planning': 'planning', 'calendrier': 'calendar',
    'lundi': 'Monday', 'mardi': 'Tuesday', 'mercredi': 'Wednesday',
    'jeudi': 'Thursday', 'vendredi': 'Friday', 'samedi': 'Saturday',
    'dimanche': 'Sunday',
    'matin': 'morning', 'midi': 'noon', 'soir': 'evening',
    'petit-déjeuner': 'breakfast', 'déjeuner': 'lunch', 'dîner': 'dinner',
    'collation': 'snack', 'goûter': 'snack',
    'ingrédient': 'ingredient', 'ingrédients': 'ingredients',
    'recette': 'recipe', 'recettes': 'recipes',
    'calories': 'calories', 'protéines': 'proteins',
    'image': 'image', 'images': 'images', 'vidéo': 'video',
    'vidéos': 'videos', 'fichier': 'file', 'fichiers': 'files',
    'document': 'document', 'documents': 'documents',
    'numéro': 'number', 'email': 'email', 'site': 'website',
    'horaire': 'schedule', 'horaires': 'schedules',
    'ouverture': 'opening', 'fermeture': 'closing',
    'évaluation': 'rating', 'avis': 'review', 'commentaire': 'comment',
    'commentaires': 'comments', 'note': 'rating',
    'favoris': 'favorites', 'récent': 'recent', 'récents': 'recent',
    'populaire': 'popular', 'populaires': 'popular',
    'Entrez': 'Enter', 'Saisissez': 'Enter',
    'saisir': 'enter', 'entrer': 'enter', 'remplir': 'fill',
    'choisir': 'choose', 'sélectionner': 'select',
    'exemple': 'example', 'Ex': 'Ex', 'optionnel': 'optional',
    'requis': 'required', 'minimum': 'minimum', 'maximum': 'maximum',
    'partenaire': 'partner', 'équipe': 'team', 'équipes': 'teams',
    'membre': 'member', 'membres': 'members',
    'rôle': 'role', 'permission': 'permission', 'accès': 'access',
    'administrateur': 'administrator', 'gérant': 'manager',
    'employé': 'employee', 'client': 'client', 'clients': 'clients',
    'fournisseur': 'supplier', 'livreur': 'courier',
    'colis': 'parcel', 'entrepôt': 'warehouse', 'stock': 'stock',
    'inventaire': 'inventory', 'catégorie': 'category',
    'sous-catégorie': 'subcategory', 'marque': 'brand',
    'modèle': 'model', 'couleur': 'color', 'taille': 'size',
    'poids': 'weight', 'dimension': 'dimension', 'dimensions': 'dimensions',
    'état': 'condition', 'neuf': 'new', 'occasion': 'used',
    'garantie': 'warranty', 'livraison': 'delivery',
    'expédition': 'shipping', 'retour': 'return', 'remboursement': 'refund',
    'promotion': 'promotion', 'réduction': 'discount', 'offre': 'offer',
    'coupon': 'coupon', 'code': 'code', 'promo': 'promo',
    'Aucune': 'No', 'aucun': 'no', 'aucune': 'no',
    'Troc': 'Barter', 'échange': 'exchange', 'échanger': 'exchange',
    'proposer': 'propose', 'accepter': 'accept', 'refuser': 'refuse',
    'Accepter': 'Accept', 'Refuser': 'Refuse', 'Proposer': 'Propose',
    'Déclarer': 'Declare', 'Soumettre': 'Submit',
    'immeuble': 'building', 'terrain': 'land', 'appartement': 'apartment',
    'villa': 'villa', 'maison': 'house', 'studio': 'studio',
    'meublé': 'furnished', 'vide': 'empty', 'louer': 'rent',
    'acheter': 'buy', 'vendre': 'sell',
    'garage': 'garage', 'parking': 'parking',
    'étage': 'floor', 'superficie': 'area', 'pièce': 'room',
    'pièces': 'rooms', 'salle': 'room',
    'aujourd\'hui': 'today', 'demain': 'tomorrow', 'hier': 'yesterday',
    'maintenant': 'now', 'bientôt': 'soon', 'plus tard': 'later',
    'en cours': 'in progress', 'terminé': 'completed', 'annulé': 'cancelled',
    'en attente': 'pending', 'confirmé': 'confirmed', 'refusé': 'refused',
    'Démarrer': 'Start', 'Arrêter': 'Stop', 'Reprendre': 'Resume',
    'Réinitialiser': 'Reset', 'Appliquer': 'Apply',
};

function roughTranslate(text) {
    let result = text;
    const sorted = Object.entries(wordMap).sort((a, b) => b[0].length - a[0].length);
    for (const [fr, en] of sorted) {
        result = result.replace(new RegExp(fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), en);
    }
    return result;
}

function textToKey(text) {
    let key = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim()
        .split(/\s+/).slice(0, 6)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    if (key.length > 50) key = key.substring(0, 50);
    return key;
}

function getNamespace(filePath) {
    const rel = filePath.replace(/\\/g, '/');
    const match = rel.match(/\/([^/]+)\.(tsx?|jsx?)$/);
    if (!match) return 'common';
    let name = match[1];
    // camelCase
    name = name.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
    // First letter lowercase
    name = name.charAt(0).toLowerCase() + name.slice(1);
    return name;
}

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const frWords = /\b(Veuillez|Connexion|Erreur|Succès|Impossible|Chargement|Enregistrer|Confirmer|Annuler|Rechercher|Sélectionner|Supprimer|Modifier|Ajouter|Valider|Envoyer|Réserver|Entrez|Aucun|Créer|Mettre|Fermer|Retour|Suivant|Précédent|Télécharger|Partager|Copier|Rafraîchir|Actualiser|Disponible|Indisponible|Obligatoire|Optionnel|Gratuit|Payant|Ouvrir|Nouveau|Voir|Détails|Profil|Accueil|Paramètres|Déconnexion|Inscription|Mot de passe|Téléphone|Adresse|Nom|Prénom|Description|Catégorie|Prix|Quantité|Date|Heure|Lieu|Ville|Quartier|Photo|Galerie|Caméra)\b/;

let totalReplacements = 0;
let totalKeys = 0;
let totalFiles = 0;

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    const ns = getNamespace(filePath);
    const lines = content.split('\n');
    let modified = false;

    // Check if file uses useLanguageSafe
    const hasLanguageHook = content.includes('useLanguageSafe');
    if (!hasLanguageHook) continue; // Skip files without i18n hook

    if (!fr[ns]) fr[ns] = {};
    if (!en[ns]) en[ns] = {};

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!frChars.test(line) && !frWords.test(line)) continue;

        const trimmed = line.trim();

        // Skip non-user-visible
        if (trimmed.startsWith('import ')) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        if (trimmed.match(/console\.(log|warn|error|info)/)) continue;
        if (trimmed.match(/(prompt|instruction|system_message|ai_context)/i)) continue;
        // Skip keywords arrays
        if (trimmed.match(/keywords\s*:\s*\[/)) continue;
        // Skip EXCEL_TEMPLATES or template strings that are data
        if (trimmed.match(/^['"`].*,(XAF|EUR),/)) continue;
        if (trimmed.match(/EXCEL_TEMPLATE/)) continue;
        // Skip lines already translated
        if (trimmed.match(/t\s*\(\s*['"`]/)) continue;
        // Skip type definitions and interfaces
        if (trimmed.match(/^\|?\s*'[^']+'\s*(\/\/|$)/)) continue;
        if (trimmed.match(/^\s*\w+\??\s*:\s*(string|number|boolean|any)/)) continue;

        // ===== Pattern 1: placeholder="French text" or placeholder={'French text'} =====
        let m = line.match(/placeholder\s*=\s*["']([^"']{3,})["']/);
        if (m && (frChars.test(m[1]) || frWords.test(m[1]))) {
            const text = m[1];
            const key = textToKey(text);
            if (key && !fr[ns][key]) {
                fr[ns][key] = text;
                en[ns][key] = roughTranslate(text);
                totalKeys++;
            }
            if (key) {
                const oldStr = m[0];
                const newStr = `placeholder={t('${ns}.${key}')}`;
                lines[i] = lines[i].replace(oldStr, newStr);
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 2: label="French text" =====
        m = line.match(/(label|title|headerTitle|tabBarLabel|buttonText)\s*=\s*["']([^"']{3,})["']/);
        if (m && (frChars.test(m[2]) || frWords.test(m[2]))) {
            const prop = m[1];
            const text = m[2];
            const key = textToKey(text);
            if (key && !fr[ns][key]) {
                fr[ns][key] = text;
                en[ns][key] = roughTranslate(text);
                totalKeys++;
            }
            if (key) {
                const oldStr = m[0];
                const newStr = `${prop}={t('${ns}.${key}')}`;
                lines[i] = lines[i].replace(oldStr, newStr);
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 3: label: 'French text' (object property) =====
        m = line.match(/(label|title|text|buttonText|headerTitle|sectionTitle|name)\s*:\s*['"]([^'"]{3,})['"]/);
        if (m && (frChars.test(m[2]) || frWords.test(m[2]))) {
            const prop = m[1];
            const text = m[2];
            const key = textToKey(text);
            if (key && !fr[ns][key]) {
                fr[ns][key] = text;
                en[ns][key] = roughTranslate(text);
                totalKeys++;
            }
            if (key) {
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${prop}\\s*:\\s*)['"]${escaped}['"]`);
                lines[i] = lines[i].replace(regex, `$1t('${ns}.${key}')`);
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 4: { text: 'French text' } (Alert buttons) =====
        m = line.match(/\{\s*text\s*:\s*['"]([^'"]{2,})['"]/);
        if (m && (frChars.test(m[1]) || frWords.test(m[1]))) {
            const text = m[1];
            const key = textToKey(text);
            if (key && !fr[ns][key]) {
                fr[ns][key] = text;
                en[ns][key] = roughTranslate(text);
                totalKeys++;
            }
            if (key) {
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(\\{\\s*text\\s*:\\s*)['"]${escaped}['"]`);
                lines[i] = lines[i].replace(regex, `$1t('${ns}.${key}')`);
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 5: >French text< (JSX text with accents) =====
        m = line.match(/>([^<>{]+[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>{}]*)</);
        if (m) {
            const text = m[1].trim();
            if (text.length < 2 || text.length > 150) continue;
            // Skip if it's just a variable or expression
            if (text.includes('{') || text.includes('}')) continue;
            // Skip if it looks like code
            if (text.match(/^\s*[a-z_$]/)) continue;

            const key = textToKey(text);
            if (key && !fr[ns][key]) {
                fr[ns][key] = text;
                en[ns][key] = roughTranslate(text);
                totalKeys++;
            }
            if (key) {
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                lines[i] = lines[i].replace(new RegExp(`>${escaped}<`), `>{t('${ns}.${key}')}<`);
                // Also handle case where text is at end of line (no closing tag on same line)
                if (!lines[i].includes(`t('${ns}.${key}')`)) {
                    lines[i] = lines[i].replace(new RegExp(`>\\s*${escaped}\\s*$`), `>{t('${ns}.${key}')}`);
                }
                if (lines[i] !== line) {
                    modified = true;
                    totalReplacements++;
                }
            }
            continue;
        }

        // ===== Pattern 6: Alert.alert('French', 'French') =====
        m = line.match(/Alert\.alert\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
        if (m && (frChars.test(m[1]) || frChars.test(m[2]) || frWords.test(m[1]) || frWords.test(m[2]))) {
            let didReplace = false;
            // Title
            if (frChars.test(m[1]) || frWords.test(m[1])) {
                const titleText = m[1];
                const titleKey = 'alert' + textToKey(titleText).charAt(0).toUpperCase() + textToKey(titleText).slice(1);
                if (titleKey && !fr[ns][titleKey]) {
                    fr[ns][titleKey] = titleText;
                    en[ns][titleKey] = roughTranslate(titleText);
                    totalKeys++;
                }
                if (titleKey) {
                    const escaped = titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lines[i] = lines[i].replace(new RegExp(`Alert\\.alert\\(\\s*['"]${escaped}['"]`), `Alert.alert(t('${ns}.${titleKey}')`);
                    didReplace = true;
                }
            }
            // Body
            if (frChars.test(m[2]) || frWords.test(m[2])) {
                const bodyText = m[2];
                const bodyKey = 'alertMsg' + textToKey(bodyText).charAt(0).toUpperCase() + textToKey(bodyText).slice(1);
                if (bodyKey && !fr[ns][bodyKey]) {
                    fr[ns][bodyKey] = bodyText;
                    en[ns][bodyKey] = roughTranslate(bodyText);
                    totalKeys++;
                }
                if (bodyKey) {
                    const escaped = bodyText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lines[i] = lines[i].replace(new RegExp(`,\\s*['"]${escaped}['"]`), `, t('${ns}.${bodyKey}')`);
                    didReplace = true;
                }
            }
            if (didReplace) {
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 7: setError('French') / setMessage('French') =====
        m = line.match(/(setError|setMessage|setSuccess|setWarning|setInfo|setStatus|setTitle)\s*\(\s*['"]([^'"]{5,})['"]\s*\)/);
        if (m && (frChars.test(m[2]) || frWords.test(m[2]))) {
            const fn = m[1];
            const text = m[2];
            const key = textToKey(text);
            if (key && !fr[ns][key]) {
                fr[ns][key] = text;
                en[ns][key] = roughTranslate(text);
                totalKeys++;
            }
            if (key) {
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                lines[i] = lines[i].replace(new RegExp(`(${fn}\\s*\\(\\s*)['"]${escaped}['"]`), `$1t('${ns}.${key}')`);
                modified = true;
                totalReplacements++;
            }
            continue;
        }
    }

    if (modified) {
        content = lines.join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
    }
}

// Save locale files
fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Phase 5b Results ===`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New i18n keys: ${totalKeys}`);

// Validate JSON
try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch(e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch(e) { console.log('EN JSON: INVALID ✗', e.message); }
