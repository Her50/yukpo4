#!/usr/bin/env node
/**
 * Phase 5c: Target remaining user-visible French strings with more aggressive patterns
 * Focus: JSX text without closing tag on same line, ternaries, object values, template literals
 */
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

const wordMap = {
    'Rechercher': 'Search', 'Sélectionner': 'Select', 'Ajouter': 'Add',
    'Modifier': 'Edit', 'Supprimer': 'Delete', 'Confirmer': 'Confirm',
    'Annuler': 'Cancel', 'Valider': 'Validate', 'Envoyer': 'Send',
    'Enregistrer': 'Save', 'Créer': 'Create', 'Fermer': 'Close',
    'Retour': 'Back', 'Suivant': 'Next', 'Précédent': 'Previous',
    'Chargement': 'Loading', 'Erreur': 'Error', 'Succès': 'Success',
    'Veuillez': 'Please', 'Disponible': 'Available', 'Indisponible': 'Unavailable',
    'Aucun': 'None', 'Aucune': 'No', 'aucun': 'no', 'aucune': 'no',
    'Voir': 'See', 'Masquer': 'Hide', 'Afficher': 'Show',
    'Réduire': 'Collapse', 'Détails': 'Details',
    'Trouvez': 'Find', 'rapidement': 'quickly', 'près': 'near',
    'chez': 'at', 'vous': 'you', 'votre': 'your', 'vos': 'your',
    'les': 'the', 'des': 'of the', 'une': 'a', 'un': 'a', 'le': 'the',
    'la': 'the', 'du': 'of the', 'de': 'of', 'et': 'and', 'ou': 'or',
    'en': 'in', 'à': 'to', 'au': 'at the', 'pour': 'for', 'par': 'by',
    'avec': 'with', 'sans': 'without', 'sur': 'on', 'dans': 'in',
    'qui': 'who', 'que': 'that', 'ce': 'this', 'cette': 'this',
    'pharmacie': 'pharmacy', 'médicament': 'medication', 'médicaments': 'medications',
    'produit': 'product', 'produits': 'products', 'pharmaceutiques': 'pharmaceutical',
    'médecin': 'doctor', 'hôpital': 'hospital', 'clinique': 'clinic',
    'laboratoire': 'laboratory', 'assurance': 'insurance',
    'sinistre': 'claim', 'déclaration': 'declaration', 'déclaré': 'declared',
    'réclamé': 'claimed', 'indemnisé': 'compensated',
    'horaires': 'schedules', 'temps': 'time', 'réel': 'real',
    'constituer': 'constitute', 'constitué': 'constituted',
    'livré': 'delivered', 'confirmé': 'confirmed',
    'récupération': 'pickup', 'dépôt': 'drop-off',
    'expéditeur': 'sender', 'disponibilité': 'availability',
    'créneaux': 'time slots', 'assignés': 'assigned',
    'paquets': 'packages', 'modèle': 'model', 'modèles': 'models',
    'marque': 'brand', 'véhicule': 'vehicle',
    'ajouté': 'added', 'enregistré': 'saved', 'synchronisé': 'synced',
    'trouvé': 'found', 'sélectionnée': 'selected', 'sélectionnez': 'select',
    'commande': 'order', 'marché': 'market',
    'coursier': 'courier', 'automatiquement': 'automatically',
    'courses': 'deliveries', 'utilisateur': 'user',
    'frais': 'fees', 'résumé': 'summary', 'création': 'creation',
    'Récup': 'Pickup', 'Dépôt': 'Drop-off', 'Expéd': 'Ship',
    'dispo': 'avail', 'Déclaré': 'Declared',
    'Nouveau': 'New', 'Entrez': 'Enter',
    'classe': 'class', 'souhaitée': 'desired', 'matière': 'subject',
    'état': 'condition', 'livre': 'book', 'Nom': 'Name',
    'optionnel': 'optional', 'Recherchez': 'Search for',
    'position': 'location', 'proximité': 'nearby',
    'avancés': 'advanced', 'filtres': 'filters',
    'mis': 'updated', 'jour': 'day',
    'type': 'type', 'établissement': 'establishment',
    'spécialité': 'specialty', 'consultation': 'consultation',
    'urgence': 'emergency', 'garde': 'on-call',
    'itinéraire': 'route', 'départ': 'departure', 'arrivée': 'arrival',
    'trajet': 'trip', 'passager': 'passenger', 'conducteur': 'driver',
    'place': 'seat', 'places': 'seats', 'siège': 'seat',
    'billet': 'ticket', 'réservation': 'booking',
    'agence': 'agency', 'voyage': 'trip',
    'semaine': 'week', 'planning': 'planning', 'menu': 'menu',
    'recette': 'recipe', 'ingrédient': 'ingredient',
    'première': 'first', 'dernière': 'last',
    'tous': 'all', 'tout': 'all',
};

function roughTranslate(text) {
    let result = text;
    const sorted = Object.entries(wordMap).sort((a, b) => b[0].length - a[0].length);
    for (const [f, e] of sorted) {
        result = result.replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), e);
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
    return key || null;
}

function getNamespace(filePath) {
    const match = filePath.replace(/\\/g, '/').match(/\/([^/]+)\.(tsx?|jsx?)$/);
    if (!match) return 'common';
    let name = match[1].replace(/[-_](.)/g, (_, c) => c.toUpperCase());
    return name.charAt(0).toLowerCase() + name.slice(1);
}

function walk(dir, r = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, r);
        else if (p.endsWith('.tsx') || p.endsWith('.ts')) r.push(p);
    }
    return r;
}

const frChars = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const frWords = /\b(Veuillez|Connexion|Erreur|Succès|Impossible|Chargement|Enregistrer|Confirmer|Annuler|Rechercher|Sélectionner|Supprimer|Modifier|Ajouter|Valider|Envoyer|Réserver|Entrez|Aucun|Créer|Mettre|Fermer|Retour|Suivant|Précédent|Nouveau|Voir|Détails|Masquer|Afficher|Trouvez|Recherchez|Sélectionnez|Chargement)\b/;

const files = [];
['mobile/src/screens', 'mobile/src/components'].forEach(d => walk(d, files));

let totalReplacements = 0;
let totalKeys = 0;
let totalFiles = 0;

function addKey(ns, key, frText, enText) {
    if (!fr[ns]) fr[ns] = {};
    if (!en[ns]) en[ns] = {};
    if (!fr[ns][key]) {
        fr[ns][key] = frText;
        en[ns][key] = enText;
        totalKeys++;
    }
}

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('useLanguageSafe')) continue;
    const ns = getNamespace(filePath);
    const lines = content.split('\n');
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!frChars.test(line) && !frWords.test(line)) continue;

        // Skip non-code
        if (trimmed.startsWith('import ')) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        if (trimmed.match(/console\.(log|warn|error|info)/)) continue;
        if (trimmed.match(/(prompt|instruction|system_message|ai_context)/i)) continue;
        if (trimmed.match(/keywords\s*:\s*\[/)) continue;
        if (trimmed.match(/^['"`].*,(XAF|EUR),/)) continue;

        // Skip lines already containing t()
        if (trimmed.match(/t\s*\(\s*['"`]/)) continue;

        // Skip lines that are ONLY an inline comment after code (the French part is in the comment)
        // Detect: code // French comment
        const commentIdx = line.indexOf('//');
        if (commentIdx >= 0) {
            const codePart = line.substring(0, commentIdx);
            const commentPart = line.substring(commentIdx);
            // If French chars/words are ONLY in the comment part, skip
            if ((frChars.test(commentPart) || frWords.test(commentPart)) &&
                !frChars.test(codePart) && !frWords.test(codePart)) {
                continue;
            }
        }

        let m;

        // ===== Pattern 1: Object property values like key: 'French text' =====
        m = line.match(/(\w+)\s*:\s*'([^']{2,})'(?:\s*,|\s*})/);
        if (m && (frChars.test(m[2]) || frWords.test(m[2]))) {
            const prop = m[1];
            const text = m[2];
            // Skip if prop is a technical field
            if (['color', 'icon', 'value', 'code', 'flag', 'type', 'format', 'mode', 'style', 'key', 'name', 'id'].includes(prop)) continue;
            const key = textToKey(text);
            if (!key) continue;
            addKey(ns, key, text, roughTranslate(text));
            const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${prop}\\s*:\\s*)'${escaped}'`);
            const newLine = lines[i].replace(regex, `$1t('${ns}.${key}')`);
            if (newLine !== lines[i]) {
                lines[i] = newLine;
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 2: JSX text - multiline/end-of-line without closing < =====
        // Match: >French text (with accent) at end of line or before {
        m = line.match(/>([^<>{}]{3,}[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>{}]*)\s*$/);
        if (!m) m = line.match(/>([^<>{}]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>{}]*)</);
        if (m) {
            const text = m[1].trim();
            if (text.length < 3 || text.length > 200) continue;
            if (text.match(/^\s*\{/) || text.match(/^\s*[a-z_$]/)) continue;
            // Skip if it's a number + French word (like "2 pour réduire")
            if (text.match(/^\d/)) continue;
            // Skip expressions  
            if (text.includes('&&') || text.includes('||') || text.includes('=>') || text.includes('===')) continue;
            const key = textToKey(text);
            if (!key) continue;
            addKey(ns, key, text, roughTranslate(text));
            const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Try replacing >text< first
            let newLine = lines[i].replace(new RegExp(`>\\s*${escaped}\\s*<`), `>{t('${ns}.${key}')}<`);
            // If no change, try >text at end of line
            if (newLine === lines[i]) {
                newLine = lines[i].replace(new RegExp(`>\\s*${escaped}\\s*$`), `>{t('${ns}.${key}')}`);
            }
            if (newLine !== lines[i]) {
                lines[i] = newLine;
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 3: Ternary with French strings: ? 'French' : 'French' =====
        m = line.match(/\?\s*'([^']{2,}[àâçéèêëîïôûùüÿñæœ][^']*)'\s*:\s*'([^']{2,}[àâçéèêëîïôûùüÿñæœ][^']*)'/);
        if (m) {
            const text1 = m[1]; const text2 = m[2];
            const key1 = textToKey(text1); const key2 = textToKey(text2);
            if (key1 && key2) {
                addKey(ns, key1, text1, roughTranslate(text1));
                addKey(ns, key2, text2, roughTranslate(text2));
                const e1 = text1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const e2 = text2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                lines[i] = lines[i].replace(new RegExp(`'${e1}'`), `t('${ns}.${key1}')`);
                lines[i] = lines[i].replace(new RegExp(`'${e2}'`), `t('${ns}.${key2}')`);
                modified = true;
                totalReplacements += 2;
            }
            continue;
        }
        // Ternary with only one French string
        m = line.match(/\?\s*'([^']{2,}[àâçéèêëîïôûùüÿñæœ][^']*)'/);
        if (!m) m = line.match(/:\s*'([^']{2,}[àâçéèêëîïôûùüÿñæœ][^']*)'/);
        if (m) {
            const text = m[1];
            if (text.includes('{') || text.includes('}')) continue;
            const key = textToKey(text);
            if (!key) continue;
            addKey(ns, key, text, roughTranslate(text));
            const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const newLine = lines[i].replace(new RegExp(`'${escaped}'`), `t('${ns}.${key}')`);
            if (newLine !== lines[i]) {
                lines[i] = newLine;
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 4: Template literal `French text ${var}` =====
        m = line.match(/`([^`]{3,}[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^`]*)`/);
        if (m) {
            const fullText = m[1];
            // Only handle simple cases without complex expressions
            const vars = fullText.match(/\$\{([^}]+)\}/g);
            if (vars && vars.length <= 3) {
                // Extract template as i18n key with placeholders
                let keyText = fullText.replace(/\$\{[^}]+\}/g, '').trim();
                const key = textToKey(keyText);
                if (!key) continue;
                // Convert template to i18n format: `Hello ${name}` → "Hello {{name}}"
                let i18nFr = fullText.replace(/\$\{([^}]+)\}/g, '{{$1}}');
                let i18nEn = roughTranslate(i18nFr);
                addKey(ns, key, i18nFr, i18nEn);
                // Replace in code: `text ${var}` → t('ns.key', { var })
                const params = (vars || []).map(v => v.replace(/\$\{|\}/g, ''));
                const paramsObj = params.map(p => `${p.replace(/\./g, '_')}: ${p}`).join(', ');
                const escaped = fullText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$\\\{[^}]+\\\}/g, '\\$\\{[^}]+\\}');
                const newLine = lines[i].replace(new RegExp('`' + m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`'), 
                    params.length > 0 ? `t('${ns}.${key}', { ${paramsObj} })` : `t('${ns}.${key}')`);
                if (newLine !== lines[i]) {
                    lines[i] = newLine;
                    modified = true;
                    totalReplacements++;
                }
            }
            continue;
        }

        // ===== Pattern 5: Alert.alert with French words (remaining) =====
        m = line.match(/Alert\.alert\s*\(\s*['"]([^'"]*[àâçéèêëîïôûùüÿñæœ][^'"]*)['"]/) ||
            line.match(/Alert\.alert\s*\(\s*['"]([^'"]+)['"]/) && frWords.test(line);
        if (m && m[1]) {
            const text = m[1];
            if (frChars.test(text) || frWords.test(text)) {
                const key = 'alert' + (textToKey(text) || '').charAt(0).toUpperCase() + (textToKey(text) || '').slice(1);
                if (!key || key === 'alert') continue;
                addKey(ns, key, text, roughTranslate(text));
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                lines[i] = lines[i].replace(new RegExp(`Alert\\.alert\\(\\s*['"]${escaped}['"]`), `Alert.alert(t('${ns}.${key}')`);
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== Pattern 6: title={condition ? 'French' : 'French'} =====
        m = line.match(/(title|label|buttonText)\s*=\s*\{[^}]*'([^']{2,}[àâçéèêëîïôûùüÿñæœ][^']*)'[^}]*'([^']{2,})'[^}]*\}/);
        if (m) {
            const text = m[2];
            const key = textToKey(text);
            if (key) {
                addKey(ns, key, text, roughTranslate(text));
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                lines[i] = lines[i].replace(new RegExp(`'${escaped}'`), `t('${ns}.${key}')`);
                modified = true;
                totalReplacements++;
            }
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        totalFiles++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Phase 5c Results ===`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New i18n keys: ${totalKeys}`);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch (e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch (e) { console.log('EN JSON: INVALID ✗', e.message); }
