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

    // Remplacer par un stub vide car ce plugin est uniquement pour Babel, pas pour le runtime
    // Ce plugin ne doit PAS être inclus dans le bundle React Native
    const fixedContent = `// Stub for react-native-worklets-core plugin (Babel plugin, not runtime)
// This file should not be bundled in the React Native app
module.exports = function() {
  return {
    name: 'react-native-worklets-core',
    visitor: {}
  };
};
`;

    // Écrire le nouveau contenu
    fs.writeFileSync(pluginPath, fixedContent, 'utf8');

    console.log('✅ Replaced plugin.js with empty stub');
    console.log('📝 This prevents Metro from trying to bundle the Babel plugin\n');

} catch (error) {
    console.error('❌ Error fixing plugin.js:', error.message);
    // Ne pas faire échouer le build
    process.exit(0);
}

