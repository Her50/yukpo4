#!/usr/bin/env node
/**
 * Repair v2: Fix remaining broken i18n patterns
 * Handles: multi-word stray text, \t() patterns, nested quotes, longer stray text
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

function textToKey(text) {
    let key = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '').trim()
        .split(/\s+/).slice(0, 7)
        .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
    if (key.length > 55) key = key.substring(0, 55);
    return key || null;
}

const files = [];
['mobile/src/screens', 'mobile/src/components'].forEach(d => walk(d, files));

let totalRepairs = 0;
let filesFixed = 0;

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Pattern 1: t('ns.key')strayText' or t('ns.key')strayText"
        // More aggressive: stray text can contain spaces, accents, punctuation
        let m = line.match(/t\('([^']+\.[^']+)'\)([A-Za-zÀ-ÿ\d][^'"`\n]{0,200}?)(['"`])/);
        if (m) {
            const nsKey = m[1];
            const strayText = m[2];
            const closingQuote = m[3];
            const dotIdx = nsKey.indexOf('.');
            if (dotIdx === -1) continue;
            const ns = nsKey.substring(0, dotIdx);
            const oldKey = nsKey.substring(dotIdx + 1);
            const frValue = fr[ns]?.[oldKey];
            if (!frValue) continue;

            const fullFrText = frValue + "'" + strayText;
            const newKey = textToKey(fullFrText);
            if (!newKey) continue;

            if (!fr[ns]) fr[ns] = {};
            if (!en[ns]) en[ns] = {};
            fr[ns][newKey] = fullFrText;
            en[ns][newKey] = en[ns]?.[oldKey] ? en[ns][oldKey] + "'" + strayText : fullFrText;

            const oldPattern = `t('${nsKey}')${strayText}${closingQuote}`;
            const newPattern = `t('${ns}.${newKey}')${closingQuote}`;
            if (lines[i].includes(oldPattern)) {
                lines[i] = lines[i].replace(oldPattern, newPattern);
                modified = true;
                totalRepairs++;
                continue;
            }
        }

        // Pattern 2: \t('ns.key')strayText - backslash before t (from escaped quotes in source)
        m = line.match(/\\t\('([^']+\.[^']+)'\)([A-Za-zÀ-ÿ\d][^'"`\n]{0,200}?)(['"`])/);
        if (m) {
            const nsKey = m[1];
            const strayText = m[2];
            const closingQuote = m[3];
            const dotIdx = nsKey.indexOf('.');
            if (dotIdx === -1) continue;
            const ns = nsKey.substring(0, dotIdx);
            const oldKey = nsKey.substring(dotIdx + 1);
            const frValue = fr[ns]?.[oldKey];
            
            // For \t() patterns, the original was probably a string with escaped quotes
            // like: 'text l\'apostrophe' → became \t('key')text'
            // We need to reconstruct with escaped apostrophe
            if (frValue) {
                const fullFrText = frValue + "'" + strayText;
                const newKey = textToKey(fullFrText);
                if (!newKey) continue;

                if (!fr[ns]) fr[ns] = {};
                if (!en[ns]) en[ns] = {};
                fr[ns][newKey] = fullFrText;
                en[ns][newKey] = en[ns]?.[oldKey] ? en[ns][oldKey] + "'" + strayText : fullFrText;

                const oldPattern = `\\t('${nsKey}')${strayText}${closingQuote}`;
                const newPattern = `' + t('${ns}.${newKey}') + ${closingQuote}`;
                if (lines[i].includes(oldPattern)) {
                    lines[i] = lines[i].replace(oldPattern, newPattern);
                    modified = true;
                    totalRepairs++;
                    continue;
                }
            }
        }

        // Pattern 3: French text before t() that should be part of the string
        // e.g.: "La gestion du stock permet dt('ns.key')expérience"
        // Original: "La gestion du stock permet d'éviter les ventes... et l'expérience"
        m = line.match(/([A-Za-zÀ-ÿ]{2,})\s*t\('([^']+\.[^']+)'\)([A-Za-zÀ-ÿ][^'"`\n]{0,200}?)(['"`])/);
        if (m) {
            const prefixWord = m[1]; // e.g. "dt" or "lt" or "nt"
            const nsKey = m[2];
            const strayText = m[3];
            const closingQuote = m[4];
            const dotIdx = nsKey.indexOf('.');
            if (dotIdx === -1) continue;
            const ns = nsKey.substring(0, dotIdx);
            const oldKey = nsKey.substring(dotIdx + 1);
            const frValue = fr[ns]?.[oldKey];
            if (!frValue) continue;

            // The prefix word's last char + the fr value + apostrophe + stray text = full text
            // But we can't easily reconstruct the prefix... this line is badly broken
            // Best approach: revert to the original French string as a whole
            const fullLine = line;
            // For these complex cases, let's just put the whole visible French as a new t() call
            // Actually, skip these - they need manual review
            continue;
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        filesFixed++;
    }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Repair v2 Results ===`);
console.log(`Files fixed: ${filesFixed}`);
console.log(`Total repairs: ${totalRepairs}`);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch (e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch (e) { console.log('EN JSON: INVALID ✗', e.message); }
