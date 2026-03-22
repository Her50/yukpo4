#!/usr/bin/env node
/**
 * Copie les clés manquantes d'un namespace depuis une locale source (en ou fr)
 * vers tous les autres fichiers JSON du dossier locales/.
 *
 * Usage (depuis la racine du repo) :
 *   node mobile/src/i18n/merge-namespace-from-source.js --ns=productVideoCreationModal --source=en
 *
 * Options :
 *   --ns=namespace   (obligatoire) ex. productVideoCreationModal
 *   --source=en|fr   (défaut: en) fichier source pour les valeurs des nouvelles clés
 *   --dry            affiche seulement le nombre de clés qui seraient ajoutées par fichier
 */
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');

function parseArgs() {
    const out = { ns: null, source: 'en', dry: false };
    for (const a of process.argv.slice(2)) {
        if (a.startsWith('--ns=')) out.ns = a.slice(5);
        else if (a.startsWith('--source=')) out.source = a.slice(9);
        else if (a === '--dry') out.dry = true;
    }
    return out;
}

function deepMergeMissing(target, source) {
    let added = 0;
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
        return added;
    }
    for (const [k, v] of Object.entries(source)) {
        if (!(k in target)) {
            target[k] = v;
            added++;
        } else if (
            typeof v === 'object' &&
            v !== null &&
            !Array.isArray(v) &&
            typeof target[k] === 'object' &&
            target[k] !== null &&
            !Array.isArray(target[k])
        ) {
            added += deepMergeMissing(target[k], v);
        }
    }
    return added;
}

const { ns, source, dry } = parseArgs();
if (!ns) {
    console.error('Usage: node merge-namespace-from-source.js --ns=productVideoCreationModal [--source=en|fr] [--dry]');
    process.exit(1);
}

const sourceFile = `${source}.json`;
const sourcePath = path.join(localesDir, sourceFile);
if (!fs.existsSync(sourcePath)) {
    console.error(`Fichier source introuvable: ${sourcePath}`);
    process.exit(1);
}

const sourceJson = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const sourceNs = sourceJson[ns];
if (!sourceNs || typeof sourceNs !== 'object') {
    console.error(`Namespace "${ns}" absent ou invalide dans ${sourceFile}`);
    process.exit(1);
}

const files = fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'));
let totalAdded = 0;

for (const f of files) {
    if (f === sourceFile) continue;
    const p = path.join(localesDir, f);
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!json[ns]) {
        json[ns] = {};
    }
    const before = JSON.stringify(json[ns]).length;
    const added = deepMergeMissing(json[ns], sourceNs);
    if (added > 0) {
        totalAdded += added;
        console.log(`${f}: +${added} clé(s) sous "${ns}"`);
        if (!dry) {
            fs.writeFileSync(p, JSON.stringify(json, null, 4) + '\n', 'utf8');
        }
    }
}

console.log(dry ? `[dry-run] Total clés ajoutées (estimation): ${totalAdded}` : `Terminé. Total de clés ajoutées: ${totalAdded}`);
