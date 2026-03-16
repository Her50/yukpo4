#!/usr/bin/env node
/**
 * Repair script: Fix strings broken by previous i18n scripts
 * 
 * Problem: When French text contained apostrophes (l'application, d'aide),
 * the scripts treated the apostrophe as a string delimiter, splitting the
 * string into: t('ns.partialKey')restOfText'
 * 
 * Fix: Reconstruct the full text, create proper key, replace broken pattern
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

const wordMap = {
    'application': 'application', 'aide': 'help', 'appareil': 'device',
    'attention': 'attention', 'ordinateur': 'computer', 'action': 'action',
    'annonce': 'listing', 'avion': 'plane', 'urgence': 'emergency',
    'établissement': 'establishment', 'équipe': 'team', 'images': 'images',
    'intelligence artificielle': 'artificial intelligence',
    'engagement': 'engagement', 'ambiance': 'ambiance', 'estimation': 'estimation',
    'attente': 'wait', 'abord': 'first', 'accès': 'access', 'est': 'is',
    'ouvrir': 'open', 'Emploi': 'Jobs', 'apparence': 'appearance',
    'état': 'state', 'Oréal': 'Oreal',
};

function roughTranslateWord(word) {
    const lower = word.toLowerCase();
    for (const [f, e] of Object.entries(wordMap)) {
        if (lower.includes(f.toLowerCase())) return e;
    }
    return word;
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
let totalKeysFixed = 0;
let filesFixed = 0;
const errors = [];

for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Find all broken patterns: t('ns.key')STRAY_TEXT
    // The pattern: t('namespace.keyName') immediately followed by word characters
    // We need to reconstruct: look up fr[ns][key], append apostrophe + stray text
    
    // Pattern matches: t('ns.key')strayText' or t('ns.key')strayText"
    // The stray text continues until the next unescaped quote that matches the context
    const brokenRegex = /t\('([^']+\.[^']+)'\)([A-Za-zÀ-ÿ\d][^;,\n]*?)(['"`])/g;
    
    let match;
    const replacements = [];
    
    while ((match = brokenRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const nsKey = match[1]; // e.g. 'userAvatarMenu.seDeconnecterDeL'
        const strayText = match[2]; // e.g. 'application'
        const closingQuote = match[3]; // e.g. '
        const matchIndex = match.index;
        
        // Parse namespace and key
        const dotIdx = nsKey.indexOf('.');
        if (dotIdx === -1) continue;
        const ns = nsKey.substring(0, dotIdx);
        const oldKey = nsKey.substring(dotIdx + 1);
        
        // Look up existing fr value
        const frValue = fr[ns]?.[oldKey];
        if (!frValue) {
            // Key not found in fr.json, skip
            continue;
        }
        
        // Clean stray text (remove trailing quotes, whitespace, common suffixes)
        let cleanStray = strayText.trim();
        // Remove trailing punctuation that's not part of the text
        // cleanStray might have trailing: , } ) ; etc but those are captured by the regex boundary
        
        // Reconstruct full French text
        const fullFrText = frValue + "'" + cleanStray;
        
        // Generate new key for the full text
        const newKey = textToKey(fullFrText);
        if (!newKey) continue;
        
        // Check if this new key already exists
        if (!fr[ns]) fr[ns] = {};
        if (!en[ns]) en[ns] = {};
        
        // Add new key with full text
        fr[ns][newKey] = fullFrText;
        
        // Generate rough English translation
        const enValue = en[ns]?.[oldKey];
        if (enValue) {
            en[ns][newKey] = enValue + "'" + roughTranslateWord(cleanStray);
        } else {
            en[ns][newKey] = fullFrText; // fallback to French
        }
        
        // Build replacement: t('ns.newKey') + closingQuote (if the quote was part of the string context)
        // We need to figure out what the replacement should look like
        // Original context: 'text with l'apostrophe' → t('ns.key')apostrophe'
        // Fixed: t('ns.newKey')
        // But we also need to keep the closing quote if it was part of surrounding syntax
        
        // The closing quote was the original string's end delimiter
        // So the fix is: t('ns.newKey')<closingQuote>
        const newReplacement = `t('${ns}.${newKey}')${closingQuote}`;
        
        // Hmm wait - the closing quote might not be needed if the t() is inside {}
        // Let's check context: if preceded by `: ` or `= ` then the closing quote closes the property
        // If inside `{...}` JSX, the quote shouldn't be there
        
        // Actually, let's look at the surrounding context
        const beforeMatch = content.substring(Math.max(0, matchIndex - 30), matchIndex);
        
        // Case 1: Property value: `key: t('ns.key')stray'` → should become `key: t('ns.newKey')`
        // The closing quote was the original string's closing, which is now replaced by t()
        // So we should NOT include the closing quote
        
        // Case 2: String concatenation: `t('ns.key')stray' + ...` → `t('ns.newKey') + ...`
        
        // In most cases, the closing quote should be removed because t() replaces the entire string
        // But we need to check if there was an opening quote that should match
        
        // Look for pattern: the t() was probably meant to replace 'fullText' or "fullText"
        // So the full broken pattern in context is like:
        //   property: t('ns.key')stray',   → should be: property: t('ns.newKey'),
        //   property: t('ns.key')stray",   → should be: property: t('ns.newKey'),
        
        replacements.push({
            original: `t('${nsKey}')${strayText}${closingQuote}`,
            replacement: `t('${ns}.${newKey}')`,
            ns, oldKey, newKey, fullFrText
        });
    }
    
    // Apply replacements (reverse order to maintain indices)
    for (const rep of replacements.reverse()) {
        if (content.includes(rep.original)) {
            content = content.replace(rep.original, rep.replacement);
            modified = true;
            totalRepairs++;
            totalKeysFixed++;
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        filesFixed++;
    }
}

// Clean up orphaned partial keys from fr/en
// (keys that end with partial words like 'seDeconnecterDeL')
// We'll leave them for now - they don't hurt

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');

console.log(`\n=== Repair Results ===`);
console.log(`Files fixed: ${filesFixed}`);
console.log(`Total repairs: ${totalRepairs}`);
console.log(`New corrected keys: ${totalKeysFixed}`);

try { JSON.parse(fs.readFileSync(FR_PATH, 'utf8')); console.log('FR JSON: Valid ✓'); } catch (e) { console.log('FR JSON: INVALID ✗', e.message); }
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN JSON: Valid ✓'); } catch (e) { console.log('EN JSON: INVALID ✗', e.message); }
