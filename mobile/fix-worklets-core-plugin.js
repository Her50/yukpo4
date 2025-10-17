#!/usr/bin/env node
// Script pour corriger le fichier plugin.js de react-native-worklets-core
// qui ne peut pas résoudre ./src/plugin comme un dossier sur EAS Build

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing react-native-worklets-core plugin.js...');

const pluginPath = path.join(__dirname, 'node_modules', 'react-native-worklets-core', 'plugin.js');

if (!fs.existsSync(pluginPath)) {
    console.log('⚠️  plugin.js not found, skipping...');
    process.exit(0);
}

try {
    // Lire le contenu actuel
    const currentContent = fs.readFileSync(pluginPath, 'utf8');
    console.log(`📖 Current content: ${currentContent.trim()}`);

    // Le fixer pour pointer explicitement vers index.js
    const fixedContent = 'module.exports = require("./src/plugin/index.js");\n';

    // Écrire le nouveau contenu
    fs.writeFileSync(pluginPath, fixedContent, 'utf8');

    console.log('✅ Fixed plugin.js to use explicit path: ./src/plugin/index.js');
    console.log('📝 This ensures Metro can resolve the module on EAS Build\n');

} catch (error) {
    console.error('❌ Error fixing plugin.js:', error.message);
    // Ne pas faire échouer le build
    process.exit(0);
}

