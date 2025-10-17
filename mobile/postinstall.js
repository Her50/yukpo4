#!/usr/bin/env node
// Script postinstall qui s'adapte à l'environnement (local vs EAS Build)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Running postinstall script...\n');

// Détecter si on est sur EAS Build
const isEASBuild = process.env.EAS_BUILD === 'true' || process.env.CI === 'true';

if (isEASBuild) {
    console.log('🏗️  Detected EAS Build environment');
} else {
    console.log('💻 Detected local environment');
}

try {
    // Fix @expo/cli module manquant
    if (fs.existsSync(path.join(__dirname, 'fix-expo-cli.js'))) {
        console.log('\n🔧 Fixing @expo/cli missing module...');
        execSync('node fix-expo-cli.js', { stdio: 'inherit' });
    }

    // Fix react-native-worklets-core plugin.js (CRITIQUE pour EAS Build)
    if (fs.existsSync(path.join(__dirname, 'fix-worklets-core-plugin.js'))) {
        console.log('\n🔧 Fixing react-native-worklets-core plugin.js...');
        execSync('node fix-worklets-core-plugin.js', { stdio: 'inherit' });
    }

    // Fix metro-cache-key default export (CRITIQUE - doit être fait AVANT les autres)
    if (fs.existsSync(path.join(__dirname, 'fix-metro-cache-key.js'))) {
        execSync('node fix-metro-cache-key.js', { stdio: 'inherit' });
    }

    // Fix react-native-reanimated worklets dependency
    if (fs.existsSync(path.join(__dirname, 'fix-reanimated-worklets.js'))) {
        execSync('node fix-reanimated-worklets.js', { stdio: 'inherit' });
    }

    // Toujours exécuter le fix Metro
    if (fs.existsSync(path.join(__dirname, 'fix-metro-exports-comprehensive.js'))) {
        console.log('🔧 Fixing Metro exports...');
        execSync('node fix-metro-exports-comprehensive.js', { stdio: 'inherit' });
    } else {
        console.log('⚠️  Metro fix script not found, skipping...');
    }

    // Créer les liens symboliques (uniquement en local, peut échouer sur certains systèmes)
    if (fs.existsSync(path.join(__dirname, 'create-metro-private-links.js'))) {
        console.log('\n🔗 Creating Metro private symlinks...');
        try {
            execSync('node create-metro-private-links.js', { stdio: 'inherit' });
        } catch (err) {
            console.log('⚠️  Symlink creation failed (may not be needed on this environment)');
        }
    }

    console.log('\n✅ Postinstall completed successfully!\n');
    process.exit(0);
} catch (error) {
    console.error('❌ Postinstall error:', error.message);
    // Ne pas faire échouer le build si postinstall échoue
    console.log('⚠️  Continuing despite postinstall errors...\n');
    process.exit(0);
}

