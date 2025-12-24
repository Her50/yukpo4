/**
 * Script pour remplacer automatiquement les NativeInput ville/quartier par LocationSelector
 * Usage: node scripts/replace-location-inputs.js
 */

const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, '../src/screens/specialized');
const orientationDir = path.join(__dirname, '../src/screens/orientation');

const files = [
    'LaboratoireSearchScreen.tsx',
    'TaxiSearchScreen.tsx',
    'CovoiturageSearchScreen.tsx',
    'BusTicketSearchScreen.tsx',
    'AgenceVoyageSearchScreen.tsx',
    'ImmobilierSearchScreen.tsx',
    'LivreScolaireSearchScreen.tsx',
    'BayamSelamSearchScreen.tsx',
    'AutoServicesSearchScreen.tsx',
    'InsuranceServicesSearchScreen.tsx',
];

const orientationFiles = [
    'EtablissementSearchScreen.tsx',
];

console.log('📝 Script de remplacement des LocationInputs');
console.log('⚠️  Ce script doit être exécuté manuellement pour chaque fichier');
console.log('📋 Fichiers à modifier:');
files.forEach(f => console.log(`  - ${f}`));
orientationFiles.forEach(f => console.log(`  - orientation/${f}`));








