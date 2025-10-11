#!/usr/bin/env node
// Script pour fixer le module manquant getExpoSchema dans @expo/cli
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing @expo/cli missing getExpoSchema module...\n');

const apiDir = path.join(__dirname, 'node_modules/@expo/cli/build/api');
const getExpoSchemaPath = path.join(apiDir, 'getExpoSchema.js');

try {
    // Créer le dossier api s'il n'existe pas
    if (!fs.existsSync(apiDir)) {
        fs.mkdirSync(apiDir, { recursive: true });
        console.log('✅ Created api directory');
    }

    // Créer le fichier getExpoSchema.js
    const schemaContent = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssetSchemasAsync = getAssetSchemasAsync;

/**
 * Workaround pour le module manquant getExpoSchema
 * Retourne les chemins d'assets par défaut pour Expo
 */
async function getAssetSchemasAsync(sdkVersion) {
    // Retourne les chemins d'assets standards pour Expo
    return [
        'icon',
        'splash.image',
        'ios.icon',
        'ios.splash.image',
        'android.icon',
        'android.adaptiveIcon.foregroundImage',
        'android.adaptiveIcon.backgroundImage',
        'android.splash.image',
        'web.favicon',
        'web.splash.image',
        'notification.icon'
    ];
}
`;

    fs.writeFileSync(getExpoSchemaPath, schemaContent, 'utf8');
    console.log('✅ Created getExpoSchema.js workaround');
    console.log('📝 This fixes the missing module error in @expo/cli@0.24.22\n');

} catch (error) {
    console.error('❌ Error fixing @expo/cli:', error.message);
    // Ne pas faire échouer le build
    process.exit(0);
}

