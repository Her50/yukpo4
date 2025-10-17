#!/usr/bin/env node
// Script pour créer un alias react-native-worklets -> react-native-worklets-core
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing react-native-reanimated worklets dependency...');

const nodeModulesPath = path.join(__dirname, 'node_modules');
const workletsDir = path.join(nodeModulesPath, 'react-native-worklets');
const workletsCoreDir = path.join(nodeModulesPath, 'react-native-worklets-core');

try {
    // Ne toucher à rien si react-native-worklets-core n'est pas présent
    if (!fs.existsSync(workletsCoreDir)) {
        console.log('ℹ️  react-native-worklets-core not found, keeping react-native-worklets as-is');
        console.log('📝 No changes applied.');
        process.exit(0);
    }

    // Si worklets-core est présent, on remplace proprement react-native-worklets par un alias
    if (fs.existsSync(workletsDir)) {
        fs.rmSync(workletsDir, { recursive: true, force: true });
    }

    try {
        // Essayer de créer un symlink (peut échouer sur Windows sans droits admin)
        fs.symlinkSync(workletsCoreDir, workletsDir, 'junction');
        console.log('✅ Created symlink: react-native-worklets → react-native-worklets-core');
    } catch (symlinkError) {
        // Si le symlink échoue, créer un dossier avec redirection simple
        fs.mkdirSync(workletsDir, { recursive: true });

        // Créer package.json minimal
        const packageJson = {
            name: 'react-native-worklets',
            version: '1.0.0',
            main: '../react-native-worklets-core/lib/commonjs/index.js',
            'react-native': '../react-native-worklets-core/src/index.ts'
        };
        fs.writeFileSync(path.join(workletsDir, 'package.json'), JSON.stringify(packageJson, null, 2));

        // Créer index.js redirection
        fs.writeFileSync(path.join(workletsDir, 'index.js'),
            "module.exports = require('react-native-worklets-core');\n");

        // Créer android/build.gradle vide pour éviter les erreurs de compilation
        const androidDir = path.join(workletsDir, 'android');
        fs.mkdirSync(androidDir, { recursive: true });
        fs.writeFileSync(path.join(androidDir, 'build.gradle'),
            "// Alias package - no Android code\n");

        console.log('✅ Created redirect: react-native-worklets → react-native-worklets-core');
    }

    console.log('📝 Applied alias to ensure the reanimated plugin resolves correctly.\n');

} catch (error) {
    console.error('❌ Error fixing worklets:', error.message);
    // Ne pas faire échouer le build
    process.exit(0);
}

