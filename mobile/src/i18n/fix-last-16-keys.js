#!/usr/bin/env node
const fs = require('fs');
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

let count = 0;

function fix(ns, key, val) {
    if (en[ns] && en[ns][key] !== undefined) {
        en[ns][key] = val;
        count++;
    }
}

function fixNested(ns, sub, key, val) {
    if (en[ns] && en[ns][sub] && en[ns][sub][key] !== undefined) {
        en[ns][sub][key] = val;
        count++;
    }
}

// payment.wallet.* (nested)
fixNested("payment", "wallet", "debits", "Debits");
fixNested("payment", "wallet", "recentTransactions", "Recent transactions");
fixNested("payment", "wallet", "disbursementsCount", "Transfers completed");
fixNested("payment", "wallet", "disbursementsTotal", "Total amount transferred");
fixNested("payment", "wallet", "filterCredits", "Credits");
fixNested("payment", "wallet", "filterDebits", "Debits");
fixNested("payment", "wallet", "noDataForPeriod", "No data for this period");

// homeScreen.working.* (nested)
fixNested("homeScreen", "working", "ouiCrer", "Yes, create");

// Food proper nouns — these are African dish names, keep original but mark as translated
// They're proper nouns in any language
fix("productManagerMobile", "ndoleEruPouletDgKoki", "Ndolé, Eru, Chicken DG, Koki...");
fix("productManagerMobile", "attiekeAlocoGarbaKedjenou", "Attiéké, Aloco, Garba, Kedjenou...");
fix("productManagerMobile", "thieboudienneYassaMafe", "Thiéboudienne, Yassa, Mafé...");
fix("productManagerMobile", "toMaafeFonio", "Tô, Maafé, Fonio...");
fix("productManagerMobile", "nyembweMoambe", "Nyembwé, Moambe...");
fix("productManagerMobile", "oreal", "L'Oréal");

// Proper nouns
fix("recipeDetailsScreen", "ndole", "Ndolé");
fix("testimonialsAndPartners", "jeanpierreYaounde", "Jean-Pierre, Yaoundé");

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');
console.log('Fixed:', count, 'keys');

// Final count
const fr = JSON.parse(fs.readFileSync('mobile/src/i18n/locales/fr.json', 'utf8'));
const acc = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const cor = /[ƒ├®©Å¼´ü]/;
let rem = 0;
for (const ns of Object.keys(fr)) {
    if (typeof fr[ns] !== 'object') continue;
    for (const k of Object.keys(fr[ns])) {
        if (typeof fr[ns][k] === 'object') {
            for (const kk of Object.keys(fr[ns][k])) {
                const fv = fr[ns][k][kk];
                const ev = en[ns] && en[ns][k] && en[ns][k][kk];
                if (ev === fv && (acc.test(fv) || cor.test(fv))) { rem++; console.log('  REMAINING:', ns+'.'+k+'.'+kk, '=', fv.substring(0, 60)); }
            }
        } else {
            const fv = fr[ns][k];
            const ev = en[ns] && en[ns][k];
            if (ev === fv && (acc.test(fv) || cor.test(fv))) { rem++; console.log('  REMAINING:', ns+'.'+k, '=', fv.substring(0, 60)); }
        }
    }
}
console.log('Remaining FR copies in EN (with accents):', rem);
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid JSON'); } catch(e) { console.log('EN: INVALID', e.message); }
