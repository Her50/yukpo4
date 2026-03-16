#!/usr/bin/env node
/**
 * Phase 5d: Final aggressive pass for remaining user-visible French strings
 * Targets: JSX text matching frWords (not just accents), string arrays, 
 * remaining ternaries, Error messages, JSX comments are SKIPPED
 */
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

const wordMap = {
    'Commencer': 'Start', 'Suivant': 'Next', 'Précédent': 'Previous',
    'Annuler': 'Cancel', 'Enregistrer': 'Save', 'Confirmer': 'Confirm',
    'Connexion': 'Connection', 'Rechercher': 'Search', 'Créer': 'Create',
    'Fermer': 'Close', 'Retour': 'Back', 'Voir': 'See',
    'Détails': 'Details', 'Modifier': 'Edit', 'Supprimer': 'Delete',
    'Ajouter': 'Add', 'Valider': 'Validate', 'Envoyer': 'Send',
    'Partager': 'Share', 'Copier': 'Copy', 'Télécharger': 'Download',
    'Chargement': 'Loading', 'Erreur': 'Error', 'Succès': 'Success',
    'Impossible': 'Unable', 'Veuillez': 'Please',
    'Disponible': 'Available', 'Indisponible': 'Unavailable',
    'Aucun': 'No', 'Aucune': 'No', 'Nouveau': 'New',
    'Masquer': 'Hide', 'Afficher': 'Show', 'Réduire': 'Collapse',
    'Sélectionner': 'Select', 'Sélectionnez': 'Select',
    'Découvrez': 'Discover', 'Générez': 'Generate', 'Créez': 'Create',
    'Initialisez': 'Initialize', 'Initialisation': 'Initialization',
    'Format': 'Format', 'vertical': 'vertical', 'Transitions': 'Transitions',
    'rapides': 'fast', 'Texte': 'Text', 'dynamique': 'dynamic',
    'Optimisé': 'Optimized', 'Narration': 'Narration', 'douce': 'soft',
    'Superpositions': 'Overlays', 'élégantes': 'elegant',
    'Mise': 'Highlighting', 'avant': 'forward', 'Idéal': 'Ideal',
    'Animations': 'Animations', 'lentes': 'slow', 'Ambiance': 'Atmosphere',
    'immersive': 'immersive', 'Focus': 'Focus', 'détails': 'details',
    'Premium': 'Premium', 'qualité': 'quality',
    'Slides': 'Slides', 'punchy': 'punchy', 'CTA': 'CTA',
    'répétés': 'repeated', 'publicités': 'ads', 'express': 'express',
    'carousel': 'carousel', 'Sélection': 'Selection', 'musicale': 'music',
    'Génération': 'Generation', 'vidéo': 'video', 'vidéos': 'videos',
    'Étape': 'Step', 'étapes': 'steps', 'étape': 'step',
    'progression': 'progress', 'apparaîtront': 'will appear',
    'bientôt': 'soon', 'disponible': 'available',
    'génération': 'generation', 'promotionnelles': 'promotional',
    'générées': 'generated', 'différents': 'different', 'styles': 'styles',
    'transcription': 'transcription', 'vocale': 'voice',
    'saisir': 'enter', 'recherche': 'search',
    'Permissions': 'Permissions', 'caméra': 'camera', 'micro': 'microphone',
    'refusées': 'denied', 'activer': 'enable', 'paramètres': 'settings',
    'Délai': 'Timeout', 'attente': 'wait', 'dépassé': 'exceeded',
    'Vérifiez': 'Check', 'Appels': 'Calls', 'appareil': 'device',
    'initialiser': 'initialize', 'appel': 'call',
    'cours': 'progress', 'en cours': 'in progress',
    'service': 'service', 'quelques': 'a few', 'secondes': 'seconds',
    'les': 'the', 'des': 'of', 'une': 'a', 'un': 'a', 'le': 'the',
    'la': 'the', 'du': 'of the', 'de': 'of', 'et': 'and', 'ou': 'or',
    'en': 'in', 'à': 'to', 'pour': 'for', 'par': 'by', 'avec': 'with',
    'sur': 'on', 'dans': 'in', 'votre': 'your', 'vos': 'your',
    'sont': 'are', 'est': 'is', 'sera': 'will be',
    'non': 'not', 'pas': 'not', 'plus': 'more',
    'Ensoleillé': 'Sunny', 'Nuageux': 'Cloudy', 'Pluvieux': 'Rainy',
    'Orageux': 'Stormy', 'météo': 'weather', 'configurée': 'configured',
    'Clé': 'Key', 'API': 'API', 'timeout': 'timeout', 'après': 'after',
    'GPS': 'GPS', 'obtention': 'obtaining',
    'Récup': 'Pickup', 'Dépôt': 'Drop-off',
    'modèle': 'model', 'modèles': 'models', 'Modèle': 'Model', 'Modèles': 'Models',
    'marque': 'brand', 'ajouté': 'added', 'enregistré': 'saved',
    'localement': 'locally', 'synchronisé': 'synced',
    'base': 'database', 'données': 'data', 'utilisateurs': 'users',
    'trouvé': 'found',
    'Résumé': 'Summary', 'frais': 'fees',
    'paquets': 'packages', 'assignés': 'assigned',
    'coursier': 'courier', 'proche': 'closest',
    'automatiquement': 'automatically',
    'courses': 'runs', 'utilisateur': 'user',
    'constituer': 'constitute', 'Constitué': 'Constituted',
    'Livré': 'Delivered', 'Confirmé': 'Confirmed',
    'marché': 'market',
    'catégories': 'categories', 'catégorie': 'category',
    'colonnes': 'columns', 'lignes': 'rows',
    'Grille': 'Grid', 'Modal': 'Modal', 'afficher': 'show',
    'Aucun service disponible': 'No service available',
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
const frWordsStrict = /\b(Annuler|Enregistrer|Confirmer|Connexion|Rechercher|Créer|Fermer|Retour|Suivant|Précédent|Commencer|Chargement|Erreur|Succès|Impossible|Veuillez|Sélectionner|Sélectionnez|Modifier|Supprimer|Ajouter|Valider|Envoyer|Partager|Copier|Télécharger|Découvrez|Masquer|Afficher|Nouveau)\b/;

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

        // Skip non-code
        if (trimmed.startsWith('import ')) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        if (trimmed.match(/console\.(log|warn|error|info)/)) continue;
        if (trimmed.match(/(prompt|instruction|system_message|ai_context)/i)) continue;
        if (trimmed.match(/keywords\s*:\s*\[/)) continue;
        if (trimmed.match(/^['"`].*,(XAF|EUR),/)) continue;
        // Skip JSX comments {/* */}
        if (trimmed.match(/^\{\/\*/) || trimmed.match(/\*\/\}$/)) continue;
        // Skip already translated
        if (trimmed.match(/t\s*\(\s*['"`]/)) continue;
        // Skip inline comments (French only in comment part)
        const ci = line.indexOf('//');
        if (ci >= 0) {
            const codePart = line.substring(0, ci);
            const commentPart = line.substring(ci);
            if ((frChars.test(commentPart) || frWordsStrict.test(commentPart)) &&
                !frChars.test(codePart) && !frWordsStrict.test(codePart)) continue;
        }
        // Skip type definitions
        if (trimmed.match(/^\s*\w+\??\s*:\s*(string|number|boolean|any|void|null|undefined|React)/)) continue;
        if (trimmed.match(/^\|?\s*'[^']+'\s*(\/\/|$)/)) continue;

        if (!frChars.test(line) && !frWordsStrict.test(line)) continue;

        let m;

        // ===== P1: >French text</Text> with frWords (no accents needed) =====
        m = line.match(/>([^<>{}]+)<\/Text>/);
        if (m && frWordsStrict.test(m[1]) && !m[1].includes('{')) {
            const text = m[1].trim();
            if (text.length < 2 || text.length > 150) continue;
            const key = textToKey(text);
            if (!key) continue;
            addKey(ns, key, text, roughTranslate(text));
            const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const newLine = lines[i].replace(new RegExp(`>${escaped}</Text>`), `>{t('${ns}.${key}')}</Text>`);
            if (newLine !== lines[i]) {
                lines[i] = newLine;
                modified = true;
                totalReplacements++;
            }
            continue;
        }

        // ===== P2: title={cond ? 'French' : 'French'} with frWords =====
        m = line.match(/title=\{[^}]*'([^']{2,})'[^}]*'([^']{2,})'[^}]*\}/);
        if (m && (frWordsStrict.test(m[1]) || frWordsStrict.test(m[2]))) {
            let changed = false;
            if (frWordsStrict.test(m[1]) || frChars.test(m[1])) {
                const text = m[1];
                const key = textToKey(text);
                if (key) {
                    addKey(ns, key, text, roughTranslate(text));
                    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lines[i] = lines[i].replace(new RegExp(`'${escaped}'`), `t('${ns}.${key}')`);
                    changed = true;
                }
            }
            if (frWordsStrict.test(m[2]) || frChars.test(m[2])) {
                const text = m[2];
                const key = textToKey(text);
                if (key) {
                    addKey(ns, key, text, roughTranslate(text));
                    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lines[i] = lines[i].replace(new RegExp(`'${escaped}'`), `t('${ns}.${key}')`);
                    changed = true;
                }
            }
            if (changed) { modified = true; totalReplacements++; }
            continue;
        }

        // ===== P3: String in array: 'French text' (features arrays etc) =====
        const arrayMatches = [...line.matchAll(/'([^']{3,}[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^']*)'/g)];
        if (arrayMatches.length > 0 && line.includes('[')) {
            let changed = false;
            for (const am of arrayMatches) {
                const text = am[1];
                if (text.includes('{') || text.includes('}') || text.includes('(')) continue;
                const key = textToKey(text);
                if (!key) continue;
                addKey(ns, key, text, roughTranslate(text));
                const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const newLine = lines[i].replace(new RegExp(`'${escaped}'`), `t('${ns}.${key}')`);
                if (newLine !== lines[i]) {
                    lines[i] = newLine;
                    changed = true;
                    totalReplacements++;
                }
            }
            if (changed) modified = true;
            continue;
        }

        // ===== P4: Remaining standalone string: 'French text with accent' =====
        m = line.match(/'([^']{3,}[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^']*)'/);
        if (m) {
            const text = m[1];
            if (text.includes('{') || text.includes('}') || text.includes('(') || text.includes('=>')) continue;
            // Skip if in Error() or throw
            if (line.match(/new Error|throw /)) continue;
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

        // ===== P5: Remaining JSX text with accents (broader) =====
        m = line.match(/>([^<>{}]*[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>{}]*)</);
        if (m) {
            const text = m[1].trim();
            if (text.length < 3 || text.length > 200) continue;
            if (text.match(/^\d/) || text.includes('&&') || text.includes('=>')) continue;
            const key = textToKey(text);
            if (!key) continue;
            addKey(ns, key, text, roughTranslate(text));
            const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let newLine = lines[i].replace(new RegExp(`>\\s*${escaped}\\s*<`), `>{t('${ns}.${key}')}<`);
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
    }

    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        totalFiles++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Phase 5d Results ===`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New i18n keys: ${totalKeys}`);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch (e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch (e) { console.log('EN JSON: INVALID ✗', e.message); }
