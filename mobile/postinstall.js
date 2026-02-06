#!/usr/bin/env node
// Script postinstall simplifié - applique uniquement les fixes essentiels
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Running postinstall script...\n');

// Détecter si on est sur EAS Build
const isEASBuild = 
    process.env.EAS_BUILD === 'true' || 
    process.env.CI === 'true' || 
    process.env.EXPO_CI === 'true' ||
    process.env.EAS_BUILD_RUNNER === 'eas-build' ||
    !!process.env.EAS_BUILD_ID;

try {
    // ✅ ÉTAPE 1: Appliquer patch-package (CRITIQUE pour expo-crypto)
    console.log('🔧 Applying patches...');
    execSync('npx patch-package', { stdio: 'inherit' });
    console.log('✅ Patches applied\n');

    // ✅ ÉTAPE 2: Fix expo-modules-core kotlinVersion (DÉSACTIVÉ - cause des duplications)
    // Le script fix-expo-modules-core-kotlin-version.js cause des duplications dans build.gradle
    // Les patches via patch-package sont suffisants
    // if (fs.existsSync(path.join(__dirname, 'fix-expo-modules-core-kotlin-version.js'))) {
    //     console.log('🔧 Fixing expo-modules-core kotlinVersion...');
    //     try {
    //         execSync('node fix-expo-modules-core-kotlin-version.js', { stdio: 'inherit' });
    //         console.log('✅ expo-modules-core kotlinVersion fixed\n');
    //     } catch (error) {
    //         console.log('⚠️  expo-modules-core kotlinVersion fix failed (non-critical):', error.message);
    //     }
    // }

    // ✅ ÉTAPE 3: Fix expo-publishing release variant
    if (fs.existsSync(path.join(__dirname, 'fix-expo-publishing-release.js'))) {
        console.log('🔧 Fixing expo-publishing release variant...');
        execSync('node fix-expo-publishing-release.js', { stdio: 'inherit' });
        console.log('✅ expo-publishing fixed\n');
    }

    // ✅ ÉTAPE 4: Fix Metro (si nécessaire)
    if (fs.existsSync(path.join(__dirname, 'fix-metro-exports-comprehensive.js'))) {
        console.log('🔧 Fixing Metro exports...');
        try {
            execSync('node fix-metro-exports-comprehensive.js', { 
                stdio: 'inherit',
                env: { ...process.env, NODE_ENV: 'production' }
            });
            console.log('✅ Metro fixed\n');
        } catch (error) {
            console.log('⚠️  Metro fix failed (non-critical):', error.message);
        }
    }

    console.log('✅ Postinstall completed successfully!\n');
    process.exit(0);
} catch (error) {
    console.error('❌ Postinstall error:', error.message);
    // Sur EAS Build, échouer si c'est critique
    if (isEASBuild && error.message.includes('patch-package')) {
        process.exit(1);
    }
    // Sinon, continuer
    console.log('⚠️  Continuing despite postinstall errors...\n');
    process.exit(0);
}
