/**
 * Deep-merge missing keys from fr.json into every other locale file.
 * Existing translations are never overwritten. New keys get the French string as fallback.
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');
const frPath = path.join(localesDir, 'fr.json');

function deepMergeMissing(target, source) {
    if (source === null || typeof source !== 'object' || Array.isArray(source)) {
        return target !== undefined ? target : source;
    }
    const out = { ...target };
    for (const key of Object.keys(source)) {
        if (out[key] === undefined) {
            out[key] = source[key];
        } else if (
            out[key] !== null &&
            typeof out[key] === 'object' &&
            !Array.isArray(out[key]) &&
            source[key] !== null &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key])
        ) {
            out[key] = deepMergeMissing(out[key], source[key]);
        }
    }
    return out;
}

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json') && f !== 'fr.json');

let totalAdded = 0;
for (const file of files) {
    const p = path.join(localesDir, file);
    const existing = JSON.parse(fs.readFileSync(p, 'utf8'));
    const before = JSON.stringify(existing).length;
    const merged = deepMergeMissing(existing, fr);
    const after = JSON.stringify(merged).length;
    if (after > before) {
        fs.writeFileSync(p, JSON.stringify(merged, null, 4) + '\n', 'utf8');
        totalAdded += after - before;
    }
}

console.log(`Synced ${files.length} locale files (missing keys filled from fr).`);
