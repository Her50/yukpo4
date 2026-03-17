#!/usr/bin/env node
/**
 * sync-locales.js — Synchronise toutes les clés de traduction
 * 
 * Détecte les clés présentes dans fr.json et en.json mais absentes des autres locales,
 * et les ajoute automatiquement (valeur FR par défaut, fallback EN).
 * 
 * Usage: node mobile/src/i18n/sync-locales.js
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, 'locales');
const REF_FR = path.join(LOCALES_DIR, 'fr.json');
const REF_EN = path.join(LOCALES_DIR, 'en.json');

// Flatten nested object to dot-notation keys
function flattenKeys(obj, prefix = '') {
    let keys = {};
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            Object.assign(keys, flattenKeys(v, fullKey));
        } else {
            keys[fullKey] = v;
        }
    }
    return keys;
}

// Set a nested key in an object from dot-notation
function setNestedKey(obj, dotKey, value) {
    const parts = dotKey.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
}

function main() {
    // Load reference files
    const frData = JSON.parse(fs.readFileSync(REF_FR, 'utf-8'));
    const enData = JSON.parse(fs.readFileSync(REF_EN, 'utf-8'));

    const frKeys = flattenKeys(frData);
    const enKeys = flattenKeys(enData);

    // Merge all reference keys (FR values take priority as default for other locales)
    const allRefKeys = { ...enKeys, ...frKeys };

    // Get all locale files
    const localeFiles = fs.readdirSync(LOCALES_DIR)
        .filter(f => f.endsWith('.json') && f !== 'fr.json' && f !== 'en.json');

    let totalAdded = 0;

    for (const file of localeFiles) {
        const filePath = path.join(LOCALES_DIR, file);
        let rawContent = fs.readFileSync(filePath, 'utf-8');
        // Strip UTF-8 BOM if present
        if (rawContent.charCodeAt(0) === 0xFEFF) {
            rawContent = rawContent.slice(1);
        }
        const localeData = JSON.parse(rawContent);
        const localeKeys = flattenKeys(localeData);

        let addedCount = 0;

        for (const [key, value] of Object.entries(allRefKeys)) {
            if (!(key in localeKeys)) {
                // Use FR value as default, fallback to EN
                const defaultValue = frKeys[key] || enKeys[key] || value;
                setNestedKey(localeData, key, defaultValue);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            fs.writeFileSync(filePath, JSON.stringify(localeData, null, 4) + '\n', 'utf-8');
            console.log(`✅ ${file}: +${addedCount} clés ajoutées`);
            totalAdded += addedCount;
        } else {
            console.log(`✓  ${file}: déjà à jour`);
        }
    }

    // Also check en.json for keys only in fr.json
    const enLocaleKeys = flattenKeys(enData);
    let enAdded = 0;
    for (const [key, value] of Object.entries(frKeys)) {
        if (!(key in enLocaleKeys)) {
            setNestedKey(enData, key, value); // FR value as placeholder
            enAdded++;
        }
    }
    if (enAdded > 0) {
        fs.writeFileSync(REF_EN, JSON.stringify(enData, null, 4) + '\n', 'utf-8');
        console.log(`✅ en.json: +${enAdded} clés manquantes ajoutées (depuis fr.json)`);
        totalAdded += enAdded;
    }

    // Check fr.json for keys only in en.json
    const frLocaleKeys = flattenKeys(frData);
    let frAdded = 0;
    for (const [key, value] of Object.entries(enKeys)) {
        if (!(key in frLocaleKeys)) {
            setNestedKey(frData, key, value); // EN value as placeholder
            frAdded++;
        }
    }
    if (frAdded > 0) {
        fs.writeFileSync(REF_FR, JSON.stringify(frData, null, 4) + '\n', 'utf-8');
        console.log(`✅ fr.json: +${frAdded} clés manquantes ajoutées (depuis en.json)`);
        totalAdded += frAdded;
    }

    console.log(`\n📊 Total: ${totalAdded} clés ajoutées dans ${localeFiles.length + 2} fichiers`);
    console.log(`📁 Locales synchronisées: ${localeFiles.length + 2} fichiers`);
}

main();
