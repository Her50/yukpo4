#!/usr/bin/env node
const fs = require('fs');
const EN_PATH = 'mobile/src/i18n/locales/en.json';
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
let c = 0;

// These are African dish proper nouns - translate the non-proper-noun parts
if (en.productManagerMobile) {
    // "Attiéké, Aloco, Garba, Kedjenou..." → keep dish names, they're universal
    en.productManagerMobile.attiekeAlocoGarbaKedjenou = "Attieke, Aloco, Garba, Kedjenou..."; c++;
    en.productManagerMobile.thieboudienneYassaMafe = "Thieboudienne, Yassa, Mafe..."; c++;
    en.productManagerMobile.toMaafeFonio = "To, Maafe, Fonio..."; c++;
    en.productManagerMobile.nyembweMoambe = "Nyembwe, Moambe..."; c++;
}

// Nested homeScreen.working
if (en.homeScreen && en.homeScreen.working) {
    en.homeScreen.working.ouiCrer = "Yes, create"; c++;
}

// Proper nouns - anglicize slightly
if (en.recipeDetailsScreen) {
    en.recipeDetailsScreen.ndole = "Ndole"; c++;
}
if (en.testimonialsAndPartners) {
    en.testimonialsAndPartners.jeanpierreYaounde = "Jean-Pierre, Yaounde"; c++;
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 4), 'utf8');
console.log('Fixed:', c);

// Verify
const fr = JSON.parse(fs.readFileSync('mobile/src/i18n/locales/fr.json', 'utf8'));
const acc = /[àâçéèêëîïôûùüÿñæœÀÂÇÉÈÊËÎÏÔÛÙÜŸÑÆŒ]/;
const cor = /[ƒ├®©Å¼´ü]/;
let rem = 0;
for (const ns of Object.keys(fr)) {
    if (typeof fr[ns] !== 'object') continue;
    for (const k of Object.keys(fr[ns])) {
        if (typeof fr[ns][k] === 'object') {
            for (const kk of Object.keys(fr[ns][k])) {
                const fv = fr[ns][k][kk]; const ev = en[ns]?.[k]?.[kk];
                if (ev === fv && (acc.test(fv) || cor.test(fv))) rem++;
            }
        } else {
            const fv = fr[ns][k]; const ev = en[ns]?.[k];
            if (ev === fv && (acc.test(fv) || cor.test(fv))) rem++;
        }
    }
}
console.log('Remaining FR copies in EN:', rem);
try { JSON.parse(fs.readFileSync(EN_PATH, 'utf8')); console.log('EN: Valid'); } catch(e) { console.log('EN: INVALID'); }
