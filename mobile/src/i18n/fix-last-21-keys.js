#!/usr/bin/env node
/**
 * fix-last-21-keys.js — Fix the final 21 EN keys that are still copies of FR.
 */
const fs = require('fs');

const EN_PATH = 'mobile/src/i18n/locales/en.json';
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

const fixes = [
    // [namespace, key, english_value]
    ["productCard_restored", "locationOiLocationnnt", '}${location ? `📍 ${location}\\n\\nt('],
    ["productManagerMobile", "ndoleEruPouletDgKoki", "Ndolé, Eru, Poulet DG, Koki..."],
    ["productManagerMobile", "attiekeAlocoGarbaKedjenou", "Attiéké, Aloco, Garba, Kedjenou..."],
    ["productManagerMobile", "thieboudienneYassaMafe", "Thiéboudienne, Yassa, Mafé..."],
    ["productManagerMobile", "toMaafeFonio", "Tô, Maafé, Fonio..."],
    ["productManagerMobile", "nyembweMoambe", "Nyembwé, Moambe..."],
    ["productManagerMobile", "oreal", "Oréal"],
    ["productManagerMobile", "uvre", "structural work"],
    ["savedAddressSelector", "bat", "Bldg. {{address_building_number}}"],
    ["searchHistory", "aL", "At the"],
    ["checkpointCommentsSection", "aL", "at the"],
    ["homeScreen.working", "ouiCrer", "Yes, create"],
    ["livesListScreen", "hote", "Host #{{item_host_user_id}}"],
    ["navigationScreen", "caloriesBruleesn", "🔥 {{cal}} calories burned\n"],
    ["recipeDetailsScreen", "ndole", "Ndolé"],
    ["productCardRestored", "cc", "🧿🧲"],
    ["productCardRestored", "cca", "🧽🧀"],
    ["productVideoCreationModal", "integrez", "Include: {{mainCharacteristics[0]}}"],
    ["productVideoCreationModal", "scenesCreees", "{{result_scenes_length}} scenes created."],
    ["productVideoCreationModal", "ndetailN", "\nDetail:\n"],
    ["testimonialsAndPartners", "jeanpierreYaounde", "Jean-Pierre, Yaoundé"],
];

let count = 0;
for (const [ns, key, val] of fixes) {
    // Handle nested namespace like "homeScreen.working"
    if (ns.includes('.')) {
        const parts = ns.split('.');
        let obj = en;
        let found = true;
        for (const p of parts) {
            if (obj[p]) obj = obj[p];
            else { found = false; break; }
        }
        if (found && obj[key] !== undefined) {
            obj[key] = val;
            count++;
        }
    } else if (en[ns] && en[ns][key] !== undefined) {
        en[ns][key] = val;
        count++;
    }
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');
console.log('Fixed:', count, 'keys');

// Verify remaining
const fr = JSON.parse(fs.readFileSync('mobile/src/i18n/locales/fr.json', 'utf8'));
const acc = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const cor = /[ƒ├®©Å¼´ü]/;
let rem = 0;
for (const ns of Object.keys(fr)) {
    if (typeof fr[ns] !== 'object') continue;
    for (const k of Object.keys(fr[ns])) {
        if (typeof fr[ns][k] === 'object') {
            // nested
            for (const kk of Object.keys(fr[ns][k])) {
                const fv = fr[ns][k][kk];
                const ev = en[ns]?.[k]?.[kk];
                if (ev === fv && (acc.test(fv) || cor.test(fv))) rem++;
            }
        } else {
            const fv = fr[ns][k];
            const ev = en[ns]?.[k];
            if (ev === fv && (acc.test(fv) || cor.test(fv))) rem++;
        }
    }
}
console.log('Remaining FR copies in EN (with accents):', rem);
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid JSON'); } catch(e) { console.log('EN: INVALID', e.message); }
