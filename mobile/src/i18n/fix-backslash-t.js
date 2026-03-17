#!/usr/bin/env node
/**
 * Fix backslash-t patterns: 'text l\t('key')  or  'text d\t('key')suffix'
 * 
 * Previous i18n scripts broke strings containing French apostrophes in string literals.
 * Original: 'L\'accès à la localisation est nécessaire'
 * Broken:   'L\t('ns.accesALaLocalisationEstNecessaire'),
 * 
 * The \' was misinterpreted as string end + t() call.
 * 
 * Strategy:
 * Pattern A: 'PREFIX\t('ns.key')  — the t() key's closing ' doubles as string end
 *   → replace with t('ns.newKey')
 * Pattern B: 'PREFIX\t('ns.key')SUFFIX'  — there's still text after
 *   → replace with t('ns.newKey')
 */
const fs = require('fs');
const path = require('path');

const FR_PATH = 'mobile/src/i18n/locales/fr.json';
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

function walk(dir, r = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, r);
        else if (p.endsWith('.tsx') || p.endsWith('.ts')) r.push(p);
    }
    return r;
}

function getNamespace(filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    return base.charAt(0).toLowerCase() + base.slice(1);
}

function textToKey(text) {
    let key = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim()
        .split(/\s+/).slice(0, 8)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    if (key.length > 60) key = key.substring(0, 60);
    return key || null;
}

function addKey(ns, key, frVal) {
    if (!fr[ns]) fr[ns] = {};
    if (!en[ns]) en[ns] = {};
    if (!fr[ns][key]) fr[ns][key] = frVal;
    if (!en[ns][key]) en[ns][key] = frVal; // will need proper EN translation later
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
        if (!line.includes('\\t(')) continue;

        let newLine = line;
        let lineModified = false;

        // === Pattern A: 'PREFIX\t('ns.key')  ===
        // The t() key's closing quote IS the string's closing quote.
        // After ) we see: , or ; or ) or + or } or whitespace
        // Full match: 'PREFIX\t('ns.key')
        // We match: quote PREFIX \t( quote ns.key quote )
        {
            const regex = /'([^']*?)\\t\('([^']+\.[^']+)'\)/g;
            let match;
            while ((match = regex.exec(newLine)) !== null) {
                const fullMatch = match[0];
                const prefix = match[1]; // e.g. "L" or "Impossible d" or "La livraison n"
                const nsKey = match[2];

                const dotIdx = nsKey.indexOf('.');
                if (dotIdx === -1) continue;
                const keyNs = nsKey.substring(0, dotIdx);
                const oldKey = nsKey.substring(dotIdx + 1);

                // Look up the fr value
                const frValue = fr[keyNs] && fr[keyNs][oldKey];

                // Reconstruct full French text: prefix + apostrophe + fr_value
                let fullFrText;
                if (frValue) {
                    fullFrText = prefix + "'" + frValue;
                } else {
                    // Key not found - reconstruct from camelCase key
                    const words = oldKey.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
                    fullFrText = prefix + "'" + words;
                }

                const newKey = textToKey(fullFrText);
                if (!newKey) continue;

                addKey(ns, newKey, fullFrText);

                const replacement = `t('${ns}.${newKey}')`;
                newLine = newLine.replace(fullMatch, replacement);
                lineModified = true;
                totalRepairs++;

                // Reset regex since string changed
                regex.lastIndex = 0;
            }
        }

        // === Pattern B: 'PREFIX\t('ns.key')SUFFIX' ===
        // There's text after the ) before the final closing '
        {
            const regex = /'([^']*?)\\t\('([^']+\.[^']+)'\)([^']+)'/g;
            let match;
            while ((match = regex.exec(newLine)) !== null) {
                const fullMatch = match[0];
                const prefix = match[1];
                const nsKey = match[2];
                const suffix = match[3];

                const dotIdx = nsKey.indexOf('.');
                if (dotIdx === -1) continue;
                const keyNs = nsKey.substring(0, dotIdx);
                const oldKey = nsKey.substring(dotIdx + 1);

                const frValue = fr[keyNs] && fr[keyNs][oldKey];

                let fullFrText;
                if (frValue) {
                    fullFrText = prefix + "'" + frValue + "'" + suffix;
                } else {
                    const words = oldKey.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
                    fullFrText = prefix + "'" + words + "'" + suffix;
                }

                const newKey = textToKey(fullFrText);
                if (!newKey) continue;

                addKey(ns, newKey, fullFrText);

                const replacement = `t('${ns}.${newKey}')`;
                newLine = newLine.replace(fullMatch, replacement);
                lineModified = true;
                totalRepairs++;

                regex.lastIndex = 0;
            }
        }

        if (lineModified) {
            lines[i] = newLine;
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        filesFixed++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Fix Backslash-T Results ===`);
console.log(`Files fixed: ${filesFixed}`);
console.log(`Total repairs: ${totalRepairs}`);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid'); } catch (e) { console.log('FR JSON: INVALID', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid'); } catch (e) { console.log('EN JSON: INVALID', e.message); }
