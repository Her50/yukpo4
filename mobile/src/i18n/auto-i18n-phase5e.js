#!/usr/bin/env node
/**
 * Phase 5e: Handle mixed JSX patterns "FrenchText: {variable}" and remaining simple props
 */
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

const wordMap = {
    'Récup': 'Pickup', 'Dépôt': 'Drop-off', 'Arrivée': 'Arrival',
    'estimée': 'estimated', 'Quantité': 'Quantity', 'Stock': 'Stock',
    'Aucun': 'No', 'ajouté': 'added', 'trouvé': 'found',
    'Chargement': 'Loading', 'modèles': 'models', 'modèle': 'model',
    'Vidéos': 'Videos', 'Médicament': 'Medication', 'Tél': 'Phone',
    'Créé': 'Created', 'Prochaine': 'Next', 'prévue': 'scheduled',
    'Dernière': 'Last', 'valeur': 'value', 'détectée': 'detected',
    'enregistré': 'recorded', 'Audio': 'Audio', 'Logs': 'Logs',
    'récents': 'recent', 'Sélectionner': 'Select', 'sélectionnée': 'selected',
    'Réserver': 'Reserve', 'place': 'seat', 'places': 'seats',
    'Dommages': 'Damages', 'estimés': 'estimated',
    'Montant': 'Amount', 'réclamé': 'claimed', 'Réclamé': 'Claimed',
    'Déclaré': 'Declared', 'Assurance': 'Insurance',
    'Langue': 'Language', 'Catégorie': 'Category',
    'Coût': 'Cost', 'estimé': 'estimated',
    'Annuler': 'Cancel', 'Départ': 'Departure', 'État': 'Condition',
    'Analyse': 'Analysis', 'médicale': 'medical',
    'Commencez': 'Start', 'créer': 'create', 'premier': 'first',
    'proposer': 'offer', 'prestations': 'services',
    'utilisateurs': 'users',
    'le': 'the', 'les': 'the', 'des': 'of the', 'du': 'of the',
    'de': 'of', 'et': 'and', 'par': 'by', 'pour': 'for',
    'en': 'in', 'à': 'at', 'un': 'a', 'une': 'a',
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
        .split(/\s+/).slice(0, 5)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    if (key.length > 45) key = key.substring(0, 45);
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

// Specific patterns found in audit output
const specificFixes = [
    // Pattern: >FrenchPrefix: {variable}</Text>
    // Replace FrenchPrefix with t() call, keep variable
    {
        // >Récup: {expr}</Text>
        regex: />Récup: \{/g,
        replacement: (ns) => `>{t('${ns}.pickup')}: {`,
        frKey: 'pickup', frVal: 'Récup', enVal: 'Pickup'
    },
    {
        regex: />Dépôt: \{/g,
        replacement: (ns) => `>{t('${ns}.dropoff')}: {`,
        frKey: 'dropoff', frVal: 'Dépôt', enVal: 'Drop-off'
    },
    {
        regex: />Arrivée estimée: ~/g,
        replacement: (ns) => `>{t('${ns}.estimatedArrival')}: ~`,
        frKey: 'estimatedArrival', frVal: 'Arrivée estimée', enVal: 'Estimated arrival'
    },
    {
        regex: />Catégorie: \{/g,
        replacement: (ns) => `>{t('${ns}.category')}: {`,
        frKey: 'category', frVal: 'Catégorie', enVal: 'Category'
    },
    {
        regex: />Stock: <\/Text>/g,
        replacement: (ns) => `>{t('${ns}.stock')}: </Text>`,
        frKey: 'stock', frVal: 'Stock', enVal: 'Stock'
    },
    {
        regex: />Tél: \{/g,
        replacement: (ns) => `>{t('${ns}.phone')}: {`,
        frKey: 'phone', frVal: 'Tél', enVal: 'Phone'
    },
    {
        regex: />Médicament: \{/g,
        replacement: (ns) => `>{t('${ns}.medication')}: {`,
        frKey: 'medication', frVal: 'Médicament', enVal: 'Medication'
    },
    {
        regex: />Prochaine prévue : \{/g,
        replacement: (ns) => `>{t('${ns}.nextScheduled')}: {`,
        frKey: 'nextScheduled', frVal: 'Prochaine prévue', enVal: 'Next scheduled'
    },
    {
        regex: />Dernière valeur : \{/g,
        replacement: (ns) => `>{t('${ns}.lastValue')}: {`,
        frKey: 'lastValue', frVal: 'Dernière valeur', enVal: 'Last value'
    },
    {
        regex: />Langue détectée : \{/g,
        replacement: (ns) => `>{t('${ns}.detectedLanguage')}: {`,
        frKey: 'detectedLanguage', frVal: 'Langue détectée', enVal: 'Detected language'
    },
    {
        regex: />Créé le \{/g,
        replacement: (ns) => `>{t('${ns}.createdOn')} {`,
        frKey: 'createdOn', frVal: 'Créé le', enVal: 'Created on'
    },
    {
        regex: />Déclaré le \{/g,
        replacement: (ns) => `>{t('${ns}.declaredOn')} {`,
        frKey: 'declaredOn', frVal: 'Déclaré le', enVal: 'Declared on'
    },
    {
        regex: />Réclamé: \{/g,
        replacement: (ns) => `>{t('${ns}.claimed')}: {`,
        frKey: 'claimed', frVal: 'Réclamé', enVal: 'Claimed'
    },
    {
        regex: />Assurance \{/g,
        replacement: (ns) => `>{t('${ns}.insurance')} {`,
        frKey: 'insurance', frVal: 'Assurance', enVal: 'Insurance'
    },
    {
        regex: />Quantité × \{/g,
        replacement: (ns) => `>{t('${ns}.quantity')} × {`,
        frKey: 'quantity', frVal: 'Quantité', enVal: 'Quantity'
    },
];

// Regex patterns for remaining simple cases
const simplePatterns = [
    // title="Annuler" → title={t('ns.cancel')}
    { regex: /title="Annuler"/g, key: 'cancel', fr: 'Annuler', en: 'Cancel' },
    { regex: /title="Fermer"/g, key: 'close', fr: 'Fermer', en: 'Close' },
    { regex: /title="Retour"/g, key: 'back', fr: 'Retour', en: 'Back' },
    { regex: /title="Suivant"/g, key: 'next', fr: 'Suivant', en: 'Next' },
    { regex: /title="Confirmer"/g, key: 'confirm', fr: 'Confirmer', en: 'Confirm' },
    { regex: /title="Enregistrer"/g, key: 'save', fr: 'Enregistrer', en: 'Save' },
    { regex: /title="Modifier"/g, key: 'edit', fr: 'Modifier', en: 'Edit' },
    { regex: /title="Supprimer"/g, key: 'delete', fr: 'Supprimer', en: 'Delete' },
    { regex: /title="Créer"/g, key: 'create', fr: 'Créer', en: 'Create' },
    { regex: /title="Rechercher"/g, key: 'search', fr: 'Rechercher', en: 'Search' },
    { regex: /title="Valider"/g, key: 'validate', fr: 'Valider', en: 'Validate' },
    { regex: /title="Envoyer"/g, key: 'send', fr: 'Envoyer', en: 'Send' },
];

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('useLanguageSafe')) continue;

    const ns = getNamespace(filePath);
    let modified = false;

    // Apply specific fixes
    for (const fix of specificFixes) {
        if (fix.regex.test(content)) {
            fix.regex.lastIndex = 0; // Reset regex
            addKey(ns, fix.frKey, fix.frVal, fix.enVal);
            content = content.replace(fix.regex, fix.replacement(ns));
            modified = true;
            totalReplacements++;
        }
    }

    // Apply simple title= patterns
    for (const sp of simplePatterns) {
        if (sp.regex.test(content)) {
            sp.regex.lastIndex = 0;
            addKey(ns, sp.key, sp.fr, sp.en);
            content = content.replace(sp.regex, `title={t('${ns}.${sp.key}')}`);
            modified = true;
            totalReplacements++;
        }
    }

    // Handle remaining mixed JSX: >French text {expr}</Text>
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip if already has t()
        if (trimmed.match(/t\s*\(\s*['"`]/)) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('import ')) continue;
        if (trimmed.match(/console\.(log|warn|error|info)/)) continue;

        // Pattern: >FrenchWord(s) {expr}</Text> where FrenchWord has accents
        const m = line.match(/>([A-ZÀ-ÿa-zà-ÿ][^<>]*?[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ][^<>]*?)\s*\{/);
        if (m) {
            const frenchPart = m[1].trim();
            // Only handle if it's a short prefix (label-like)
            if (frenchPart.length < 2 || frenchPart.length > 60) continue;
            // Skip if it contains JS code patterns
            if (frenchPart.includes('=>') || frenchPart.includes('&&') || frenchPart.includes('||')) continue;
            if (frenchPart.includes('(') || frenchPart.includes(')')) continue;

            const key = textToKey(frenchPart);
            if (!key) continue;
            addKey(ns, key, frenchPart, roughTranslate(frenchPart));

            const escaped = frenchPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const newLine = lines[i].replace(new RegExp(`>${escaped}\\s*\\{`), `>{t('${ns}.${key}')} {`);
            if (newLine !== lines[i]) {
                lines[i] = newLine;
                modified = true;
                totalReplacements++;
            }
        }

        // Pattern: placeholder={`French text ${var}`}
        const pm = line.match(/placeholder=\{`([^`]*[àâçéèêëîïôûùüÿñæœ][^`]*)`\}/);
        if (pm) {
            const text = pm[1];
            const vars = text.match(/\$\{[^}]+\}/g);
            let keyText = text.replace(/\$\{[^}]+\}/g, '').trim();
            const key = textToKey(keyText);
            if (!key) continue;
            let i18nFr = text.replace(/\$\{([^}]+)\}/g, '{{$1}}');
            addKey(ns, key, i18nFr, roughTranslate(i18nFr));
            if (vars && vars.length > 0) {
                const params = vars.map(v => v.replace(/\$\{|\}/g, ''));
                const paramsObj = params.map(p => `${p.replace(/\./g, '_')}: ${p}`).join(', ');
                const escaped = pm[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                lines[i] = lines[i].replace(pm[0], `placeholder={t('${ns}.${key}', { ${paramsObj} })}`);
                modified = true;
                totalReplacements++;
            }
        }

        // Handle >FrenchText</Text> where text matches frWords (no accents)
        const wm = line.match(/>([A-Z][a-zA-Zéèêëàâîïôûùüÿ\s]{2,30})<\/Text>/);
        if (wm) {
            const text = wm[1].trim();
            const frWordsStrict = /^(Annuler|Enregistrer|Confirmer|Connexion|Rechercher|Créer|Fermer|Retour|Suivant|Précédent|Commencer|Chargement|Erreur|Succès|Modifier|Supprimer|Ajouter|Valider|Envoyer|Partager|Copier|Télécharger|Nouveau|Voir|Détails)$/;
            if (frWordsStrict.test(text)) {
                const key = textToKey(text);
                if (key) {
                    addKey(ns, key, text, roughTranslate(text));
                    lines[i] = lines[i].replace(`>${text}</Text>`, `>{t('${ns}.${key}')}</Text>`);
                    modified = true;
                    totalReplacements++;
                }
            }
        }
    }

    if (modified) {
        content = lines.join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Phase 5e Results ===`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`New i18n keys: ${totalKeys}`);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch (e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch (e) { console.log('EN JSON: INVALID ✗', e.message); }
