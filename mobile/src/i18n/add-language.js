#!/usr/bin/env node
/**
 * add-language.js — Ajoute une nouvelle langue au système i18n
 * 
 * Crée le fichier JSON (copie de en.json), et affiche les instructions
 * pour enregistrer la langue dans index.ts.
 * 
 * Usage: node mobile/src/i18n/add-language.js <code> <name> <flag>
 * Example: node mobile/src/i18n/add-language.js ewo "Ewondo" "🇨🇲"
 * 
 * Batch mode: node mobile/src/i18n/add-language.js --batch
 * (reads LANGUAGES_TO_ADD array below)
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, 'locales');
const INDEX_FILE = path.join(__dirname, 'index.ts');
const REF_EN = path.join(LOCALES_DIR, 'en.json');

// ============================================================================
// BATCH MODE: All languages to add in one go
// Edit this list to add more languages, then run: node add-language.js --batch
// ============================================================================
const LANGUAGES_TO_ADD = [
    // 🇨🇲 Cameroun
    { code: 'ewo', name: 'Ewondo', flag: '🇨🇲', region: 'Cameroun (Centre/Sud)' },
    { code: 'dua', name: 'Duálá', flag: '🇨🇲', region: 'Cameroun (Littoral)' },
    { code: 'bbj', name: "Ghomálá'", flag: '🇨🇲', region: 'Cameroun (Ouest/Bamiléké)' },
    { code: 'bas', name: 'Bassa', flag: '🇨🇲', region: 'Cameroun (Littoral)' },
    { code: 'bum', name: 'Bulu', flag: '🇨🇲', region: 'Cameroun (Sud)' },
    // 🇨🇮 Côte d'Ivoire
    { code: 'bci', name: 'Baoulé', flag: '🇨🇮', region: "Côte d'Ivoire" },
    { code: 'dyu', name: 'Dioula', flag: '🇨🇮', region: "Côte d'Ivoire / Burkina / Mali" },
    { code: 'bet', name: 'Bété', flag: '🇨🇮', region: "Côte d'Ivoire" },
    // 🇳🇬 Nigeria
    { code: 'pcm', name: 'Naijá (Pidgin)', flag: '🇳🇬', region: 'Nigeria' },
    // 🇧🇫 Burkina Faso
    { code: 'mos', name: 'Mooré', flag: '🇧🇫', region: 'Burkina Faso' },
    // 🇲🇱 Mali
    { code: 'bm', name: 'Bamanankan', flag: '🇲🇱', region: 'Mali' },
    // 🇳🇪 Niger
    { code: 'dje', name: 'Zarma', flag: '🇳🇪', region: 'Niger' },
    // 🇹🇬 Togo
    { code: 'ee', name: 'Eʋegbe (Éwé)', flag: '🇹🇬', region: 'Togo / Ghana' },
    { code: 'kbp', name: 'Kabɩyɛ', flag: '🇹🇬', region: 'Togo' },
    // 🇹🇩 Tchad
    { code: 'sar', name: 'Sara', flag: '🇹🇩', region: 'Tchad' },
    // 🇨🇫 RCA
    { code: 'sg', name: 'Sängö', flag: '🇨🇫', region: 'Centrafrique' },
    // 🇨🇩 Congo RDC
    { code: 'kg', name: 'Kikongo', flag: '🇨🇩', region: 'Congo RDC / Congo Brazza' },
    { code: 'lua', name: 'Tshiluba', flag: '🇨🇩', region: 'Congo RDC' },
    // 🇬🇦 Gabon
    { code: 'fan', name: 'Fang', flag: '🇬🇦', region: 'Gabon / Guinée Éq.' },
    // 🇿🇦 Afrique du Sud
    { code: 'xh', name: 'isiXhosa', flag: '🇿🇦', region: 'Afrique du Sud' },
    { code: 'af', name: 'Afrikaans', flag: '🇿🇦', region: 'Afrique du Sud' },
    { code: 'st', name: 'Sesotho', flag: '🇿🇦', region: 'Afrique du Sud / Lesotho' },
    // 🇧🇮 Burundi
    { code: 'rn', name: 'Ikirundi', flag: '🇧🇮', region: 'Burundi' },
    // 🇸🇳 Sénégal (compléments)
    { code: 'srr', name: 'Seereer', flag: '🇸🇳', region: 'Sénégal' },
    // 🌍 Non-Africaines
    { code: 'ko', name: '한국어', flag: '🇰🇷', region: 'Corée du Sud' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷', region: 'Turquie' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', region: 'Indonésie' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', region: 'Vietnam' },
    { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', region: 'Thaïlande' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩', region: 'Bangladesh / Inde' },
    { code: 'tl', name: 'Filipino', flag: '🇵🇭', region: 'Philippines' },
    { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾', region: 'Malaisie' },
    { code: 'uk', name: 'Українська', flag: '🇺🇦', region: 'Ukraine' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱', region: 'Pologne' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹', region: 'Italie' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱', region: 'Pays-Bas / Belgique' },
];

function createLocaleFile(code) {
    const targetFile = path.join(LOCALES_DIR, `${code}.json`);
    if (fs.existsSync(targetFile)) {
        console.log(`⏭  ${code}.json existe déjà, skip`);
        return false;
    }
    const enData = JSON.parse(fs.readFileSync(REF_EN, 'utf-8'));
    fs.writeFileSync(targetFile, JSON.stringify(enData, null, 4) + '\n', 'utf-8');
    console.log(`✅ Créé: locales/${code}.json (${Object.keys(enData).length} sections copiées de en.json)`);
    return true;
}

function updateIndexTs(languages) {
    let indexContent = fs.readFileSync(INDEX_FILE, 'utf-8');
    
    let importsToAdd = [];
    let supportedToAdd = [];
    let resourcesToAdd = [];
    
    for (const lang of languages) {
        const varName = lang.code.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Check if import already exists
        if (indexContent.includes(`from './locales/${lang.code}.json'`)) {
            continue;
        }
        
        importsToAdd.push(`import ${varName} from './locales/${lang.code}.json';`);
        supportedToAdd.push(`    { code: '${lang.code}', name: '${lang.name}', flag: '${lang.flag}' },`);
        resourcesToAdd.push(`    ${varName}: { translation: ${varName} },`);
    }
    
    if (importsToAdd.length === 0) {
        console.log('ℹ  index.ts: toutes les langues sont déjà enregistrées');
        return;
    }
    
    // 1. Add imports before SUPPORTED_LANGUAGES
    const lastImportMatch = indexContent.match(/import \w+ from '\.\/locales\/\w+\.json';/g);
    if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPos = indexContent.indexOf(lastImport) + lastImport.length;
        indexContent = indexContent.slice(0, insertPos) + '\n' + importsToAdd.join('\n') + indexContent.slice(insertPos);
    }
    
    // 2. Add to SUPPORTED_LANGUAGES (before the closing ])
    const closingBracketSL = indexContent.indexOf('] as const;');
    if (closingBracketSL !== -1) {
        const newEntries = '\n    // 🌍 Nouvelles langues (ajoutées automatiquement)\n' + supportedToAdd.join('\n') + '\n';
        indexContent = indexContent.slice(0, closingBracketSL) + newEntries + indexContent.slice(closingBracketSL);
    }
    
    // 3. Add to resources object (before the closing })
    // Find the resources closing brace
    const resourcesStart = indexContent.indexOf('const resources = {');
    if (resourcesStart !== -1) {
        // Find the matching closing brace
        let braceCount = 0;
        let resourcesEnd = -1;
        for (let i = resourcesStart; i < indexContent.length; i++) {
            if (indexContent[i] === '{') braceCount++;
            if (indexContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    resourcesEnd = i;
                    break;
                }
            }
        }
        if (resourcesEnd !== -1) {
            const newResources = '\n' + resourcesToAdd.join('\n') + '\n';
            indexContent = indexContent.slice(0, resourcesEnd) + newResources + indexContent.slice(resourcesEnd);
        }
    }
    
    fs.writeFileSync(INDEX_FILE, indexContent, 'utf-8');
    console.log(`✅ index.ts: +${importsToAdd.length} langues enregistrées`);
}

function main() {
    const args = process.argv.slice(2);
    
    if (args[0] === '--batch') {
        console.log(`\n🌍 Ajout de ${LANGUAGES_TO_ADD.length} langues en batch...\n`);
        
        let created = 0;
        for (const lang of LANGUAGES_TO_ADD) {
            if (createLocaleFile(lang.code)) created++;
        }
        
        console.log(`\n📝 Mise à jour de index.ts...\n`);
        updateIndexTs(LANGUAGES_TO_ADD);
        
        console.log(`\n📊 Résumé: ${created} fichiers créés, ${LANGUAGES_TO_ADD.length} langues total`);
        console.log(`📁 Total locales: ${fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json')).length}`);
        console.log('\n💡 Lancez ensuite: node mobile/src/i18n/sync-locales.js pour synchroniser les clés');
        return;
    }
    
    if (args.length < 3) {
        console.log('Usage: node add-language.js <code> <name> <flag>');
        console.log('       node add-language.js --batch');
        console.log('\nExamples:');
        console.log('  node add-language.js ewo "Ewondo" "🇨🇲"');
        console.log('  node add-language.js --batch  (adds all pre-defined languages)');
        process.exit(1);
    }
    
    const [code, name, flag] = args;
    createLocaleFile(code);
    updateIndexTs([{ code, name, flag }]);
    console.log('\n💡 Lancez ensuite: node mobile/src/i18n/sync-locales.js pour synchroniser les clés');
}

main();
