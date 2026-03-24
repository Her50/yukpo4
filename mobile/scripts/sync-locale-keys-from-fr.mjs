/**
 * Synchronise les clés « bourse / liste scolaire » depuis fr.json vers les autres locales.
 * Seules les clés listées ci‑dessous sont ajoutées si absentes (undefined) — ne remplace
 * pas une traduction déjà présente. Réexécutable après ajout de nouvelles clés dans fr.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');

/** Clés livreScolaireHome (écran d’accueil bourse + bandeau comparateur) */
const LIVRE_KEYS_FROM_FR = [
    'quickComparatorTitle',
    'quickComparatorSubtitle',
    'acheterLivresSubtitle',
    'acheterLivresTitle',
];

/** Clés programmeBesoins (parcours liste officielle) */
const PROG_KEYS_FROM_FR = [
    'title',
    'lead',
    'stepClasse',
    'stepEtablissement',
    'stepLivres',
    'classesLoadError',
    'retryClasses',
    'fallbackClassesBanner',
    'etablissementHint',
];

const frPath = path.join(localesDir, 'fr.json');
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const frLivre = fr.livreScolaireHome || {};
const frProg = fr.programmeBesoins || {};

let updated = 0;
for (const name of fs.readdirSync(localesDir)) {
    if (!name.endsWith('.json') || name === 'fr.json') continue;
    const p = path.join(localesDir, name);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.warn('[sync-locale] skip', name, e.message);
        continue;
    }
    if (!data.livreScolaireHome) data.livreScolaireHome = {};
    if (!data.programmeBesoins) data.programmeBesoins = {};
    let changed = false;
    for (const k of LIVRE_KEYS_FROM_FR) {
        if (data.livreScolaireHome[k] === undefined && frLivre[k] !== undefined) {
            data.livreScolaireHome[k] = frLivre[k];
            changed = true;
        }
    }
    for (const k of PROG_KEYS_FROM_FR) {
        if (data.programmeBesoins[k] === undefined && frProg[k] !== undefined) {
            data.programmeBesoins[k] = frProg[k];
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(p, JSON.stringify(data, null, 4) + '\n', 'utf8');
        updated += 1;
        console.log('[sync-locale] updated', name);
    }
}
console.log('[sync-locale] done, files updated:', updated);
