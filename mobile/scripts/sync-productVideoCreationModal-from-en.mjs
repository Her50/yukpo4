/**
 * Ajoute les clés manquantes de `productVideoCreationModal` depuis en.json
 * vers toutes les autres locales (sans écraser une traduction déjà présente).
 * Réexécutable après ajout de nouvelles clés dans en.json (guide Studio, voix, sous-titres, etc.).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');
const enPath = path.join(localesDir, 'en.json');

function mergeMissingSection(target, source) {
    if (source === null || typeof source !== 'object' || Array.isArray(source)) {
        return target !== undefined ? target : source;
    }
    const out = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
    for (const key of Object.keys(source)) {
        const sv = source[key];
        const tv = out[key];
        if (tv === undefined) {
            out[key] = sv;
        } else if (
            sv !== null &&
            typeof sv === 'object' &&
            !Array.isArray(sv) &&
            tv !== null &&
            typeof tv === 'object' &&
            !Array.isArray(tv)
        ) {
            out[key] = mergeMissingSection(tv, sv);
        }
    }
    return out;
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const srcBlock = en.productVideoCreationModal;
if (!srcBlock || typeof srcBlock !== 'object') {
    console.error('[sync-pvm] en.json: productVideoCreationModal manquant ou invalide');
    process.exit(1);
}

let updated = 0;
let keysAddedTotal = 0;

for (const name of fs.readdirSync(localesDir)) {
    if (!name.endsWith('.json') || name === 'en.json') continue;
    const p = path.join(localesDir, name);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.warn('[sync-pvm] skip', name, e.message);
        continue;
    }

    const before = JSON.stringify(data.productVideoCreationModal || {});
    const merged = mergeMissingSection(data.productVideoCreationModal || {}, srcBlock);
    const after = JSON.stringify(merged);
    if (after === before) continue;

    const beforeLen = before.length;
    keysAddedTotal += Math.max(0, after.length - beforeLen);
    data.productVideoCreationModal = merged;
    fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n', 'utf8');
    updated += 1;
    console.log('[sync-pvm] updated', name);
}

console.log('[sync-pvm] done. files updated:', updated, '(missing keys filled from en.productVideoCreationModal)');
