#!/usr/bin/env node
/**
 * Merge new translation keys into existing fr.json and en.json
 * Handles duplicate namespace merging (adds new keys to existing namespaces)
 */
const fs = require('fs');
const path = require('path');

const frPath = 'mobile/src/i18n/locales/fr.json';
const enPath = 'mobile/src/i18n/locales/en.json';
const newFrPath = 'mobile/src/i18n/new-keys-fr.json';
const newEnPath = 'mobile/src/i18n/new-keys-en.json';

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const newFr = JSON.parse(fs.readFileSync(newFrPath, 'utf8'));
const newEn = JSON.parse(fs.readFileSync(newEnPath, 'utf8'));

let mergedCount = 0;
let newNsCount = 0;

// Merge FR
for (const [ns, keys] of Object.entries(newFr)) {
  if (fr[ns]) {
    // Merge into existing namespace
    for (const [k, v] of Object.entries(keys)) {
      if (!fr[ns][k]) {
        fr[ns][k] = v;
        mergedCount++;
      }
    }
  } else {
    fr[ns] = keys;
    newNsCount++;
    mergedCount += Object.keys(keys).length;
  }
}

let mergedCountEn = 0;
let newNsCountEn = 0;

// Merge EN
for (const [ns, keys] of Object.entries(newEn)) {
  if (en[ns]) {
    for (const [k, v] of Object.entries(keys)) {
      if (!en[ns][k]) {
        en[ns][k] = v;
        mergedCountEn++;
      }
    }
  } else {
    en[ns] = keys;
    newNsCountEn++;
    mergedCountEn += Object.keys(keys).length;
  }
}

fs.writeFileSync(frPath, JSON.stringify(fr, null, 4), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 4), 'utf8');

console.log('=== Merge Complete ===');
console.log(`FR: ${mergedCount} keys added (${newNsCount} new namespaces)`);
console.log(`EN: ${mergedCountEn} keys added (${newNsCountEn} new namespaces)`);
console.log(`FR total namespaces: ${Object.keys(fr).length}`);
console.log(`EN total namespaces: ${Object.keys(en).length}`);

// Validate JSON
try {
  JSON.parse(fs.readFileSync(frPath, 'utf8'));
  console.log('FR JSON: Valid ✓');
} catch(e) {
  console.log('FR JSON: INVALID ✗', e.message);
}
try {
  JSON.parse(fs.readFileSync(enPath, 'utf8'));
  console.log('EN JSON: Valid ✓');
} catch(e) {
  console.log('EN JSON: INVALID ✗', e.message);
}
