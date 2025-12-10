/**
 * Script de migration AsyncStorage → SafeStorage
 * 
 * Usage: node scripts/migrate-to-safestorage.js [file_path]
 * 
 * Ce script aide à migrer les fichiers de AsyncStorage vers SafeStorage
 */

const fs = require('fs');
const path = require('path');

const filesToMigrate = [
    'mobile/src/services/offlineService.ts',
    'mobile/src/contexts/LanguageContext.tsx',
    'mobile/src/contexts/ThemeContext.tsx',
    'mobile/src/services/gamificationService.ts',
    'mobile/src/services/userBehaviorService.ts',
    // Ajouter d'autres fichiers ici
];

function migrateFile(filePath) {
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️  Fichier non trouvé: ${filePath}`);
        return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // 1. Remplacer l'import
    if (content.includes("import AsyncStorage from '@react-native-async-storage/async-storage';")) {
        content = content.replace(
            /import AsyncStorage from '@react-native-async-storage\/async-storage';/g,
            "// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs \"Driver not found\"\nimport SafeStorage from '../utils/safeStorage';"
        );
        modified = true;
    }

    // 2. Remplacer les utilisations
    const replacements = [
        { from: /await AsyncStorage\.getItem\(/g, to: 'await SafeStorage.getItem(' },
        { from: /await AsyncStorage\.setItem\(/g, to: 'await SafeStorage.setItem(' },
        { from: /await AsyncStorage\.removeItem\(/g, to: 'await SafeStorage.removeItem(' },
        { from: /await AsyncStorage\.getAllKeys\(/g, to: 'await SafeStorage.getAllKeys(' },
        { from: /await AsyncStorage\.multiRemove\(/g, to: 'await SafeStorage.multiRemove(' },
        { from: /AsyncStorage\.getItem\(/g, to: 'SafeStorage.getItem(' },
        { from: /AsyncStorage\.setItem\(/g, to: 'SafeStorage.setItem(' },
        { from: /AsyncStorage\.removeItem\(/g, to: 'SafeStorage.removeItem(' },
    ];

    replacements.forEach(({ from, to }) => {
        if (from.test(content)) {
            content = content.replace(from, to);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Migré: ${filePath}`);
        return true;
    } else {
        console.log(`ℹ️  Aucun changement: ${filePath}`);
        return false;
    }
}

// Exécution
const targetFile = process.argv[2];

if (targetFile) {
    // Migrer un fichier spécifique
    migrateFile(targetFile);
} else {
    // Migrer tous les fichiers de la liste
    console.log('🔄 Migration AsyncStorage → SafeStorage\n');
    let migrated = 0;
    filesToMigrate.forEach(file => {
        if (migrateFile(file)) {
            migrated++;
        }
    });
    console.log(`\n✅ ${migrated} fichier(s) migré(s) sur ${filesToMigrate.length}`);
}

