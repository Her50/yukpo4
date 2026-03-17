#!/usr/bin/env node
/**
 * sync-missing-keys.js
 * 
 * Synchronise ALL missing keys from fr.json (source of truth) to every other locale file.
 * - Deep-compares key structures recursively
 * - Copies French values for any missing key (preserves existing translations)
 * - Reports stats per file
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, 'locales');
const SOURCE_FILE = 'fr.json';

function deepMerge(source, target) {
    let addedCount = 0;
    const result = { ...target };

    for (const key of Object.keys(source)) {
        if (!(key in result)) {
            result[key] = source[key];
            if (typeof source[key] === 'object' && source[key] !== null) {
                addedCount += countKeys(source[key]);
            } else {
                addedCount += 1;
            }
        } else if (
            typeof source[key] === 'object' &&
            source[key] !== null &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(source[key])
        ) {
            const nested = deepMerge(source[key], result[key]);
            result[key] = nested.result;
            addedCount += nested.addedCount;
        }
    }

    return { result, addedCount };
}

function countKeys(obj) {
    let count = 0;
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            count += countKeys(obj[key]);
        } else {
            count += 1;
        }
    }
    return count;
}

function findMissingSections(source, target) {
    const missing = [];
    for (const key of Object.keys(source)) {
        if (!(key in target)) {
            missing.push(key);
        }
    }
    return missing;
}

const sourceData = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, SOURCE_FILE), 'utf8'));
const sourceTotalKeys = countKeys(sourceData);

console.log(`\n📖 Source: ${SOURCE_FILE} (${sourceTotalKeys} keys)\n`);
console.log('='.repeat(70));

const files = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json') && f !== SOURCE_FILE);
let totalFilesUpdated = 0;
let totalKeysAdded = 0;

for (const file of files.sort()) {
    const filePath = path.join(LOCALES_DIR, file);
    const targetData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const targetKeysBefore = countKeys(targetData);
    const missingSections = findMissingSections(sourceData, targetData);

    const { result, addedCount } = deepMerge(sourceData, targetData);

    if (addedCount > 0) {
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2) + '\n', 'utf8');
        totalFilesUpdated++;
        totalKeysAdded += addedCount;

        const pct = ((targetKeysBefore / sourceTotalKeys) * 100).toFixed(0);
        const newPct = (((targetKeysBefore + addedCount) / sourceTotalKeys) * 100).toFixed(0);
        const sectionsInfo = missingSections.length > 0
            ? ` (sections: ${missingSections.slice(0, 5).join(', ')}${missingSections.length > 5 ? '...' : ''})`
            : '';
        console.log(`✅ ${file.padEnd(12)} +${String(addedCount).padStart(5)} keys  (${pct}% → ${newPct}%)${sectionsInfo}`);
    } else {
        console.log(`✔️  ${file.padEnd(12)} complete (${((targetKeysBefore / sourceTotalKeys) * 100).toFixed(0)}%)`);
    }
}

console.log('='.repeat(70));
console.log(`\n📊 Summary:`);
console.log(`   Files updated: ${totalFilesUpdated}/${files.length}`);
console.log(`   Keys added:    ${totalKeysAdded}`);
console.log(`   Source keys:   ${sourceTotalKeys}`);
console.log(`\n✅ All locale files now have 100% key coverage (French fallback for new keys)\n`);
