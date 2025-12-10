/**
 * Script d'analyse de l'utilisation d'AsyncStorage dans le codebase
 * Identifie tous les fichiers utilisant AsyncStorage et leur statut de migration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Analyse de l\'utilisation d\'AsyncStorage...\n');

// Obtenir tous les fichiers utilisant AsyncStorage
const result = execSync(
    'grep -r "AsyncStorage\\.(getItem|setItem|removeItem|getAllKeys|multiRemove)" mobile/src --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l',
    { encoding: 'utf-8', cwd: process.cwd() }
);

const files = result.trim().split('\n').filter(f => f);

console.log(`📊 ${files.length} fichiers trouvés utilisant AsyncStorage\n`);

// Fichiers déjà migrés vers SafeStorage
const migratedFiles = [
    'mobile/src/contexts/AuthContext.tsx',
    'mobile/src/services/yukpoclient.ts',
    'mobile/src/screens/LoginScreen.tsx',
    'mobile/src/navigation/AppNavigator.tsx',
    'mobile/src/services/offlineService.ts',
    'mobile/src/contexts/LanguageContext.tsx',
    'mobile/src/contexts/ThemeContext.tsx',
    'mobile/src/utils/safeStorage.ts', // Exclure le fichier SafeStorage lui-même
];

const report = {
    total: files.length,
    migrated: 0,
    toMigrate: [],
    critical: [],
    services: [],
    contexts: [],
    hooks: [],
    components: [],
    screens: [],
    others: []
};

files.forEach(file => {
    // Ignorer safeStorage.ts lui-même
    if (file.includes('safeStorage.ts')) {
        return;
    }

    const isMigrated = migratedFiles.some(mf => file.includes(mf.split('/').pop()));

    if (isMigrated) {
        report.migrated++;
    } else {
        report.toMigrate.push(file);

        // Catégoriser
        if (file.includes('/services/')) {
            report.services.push(file);
            if (file.includes('offline') || file.includes('auth') || file.includes('api')) {
                report.critical.push(file);
            }
        } else if (file.includes('/contexts/')) {
            report.contexts.push(file);
            report.critical.push(file);
        } else if (file.includes('/hooks/')) {
            report.hooks.push(file);
        } else if (file.includes('/components/')) {
            report.components.push(file);
        } else if (file.includes('/screens/')) {
            report.screens.push(file);
        } else {
            report.others.push(file);
        }
    }
});

// Afficher le rapport
console.log('='.repeat(60));
console.log('📋 RAPPORT D\'ANALYSE');
console.log('='.repeat(60));
console.log(`\n✅ Fichiers migrés : ${report.migrated}`);
console.log(`❌ Fichiers à migrer : ${report.toMigrate.length}`);
console.log(`\n📂 Répartition :`);
console.log(`   - Services : ${report.services.length}`);
console.log(`   - Contexts : ${report.contexts.length}`);
console.log(`   - Hooks : ${report.hooks.length}`);
console.log(`   - Composants : ${report.components.length}`);
console.log(`   - Écrans : ${report.screens.length}`);
console.log(`   - Autres : ${report.others.length}`);

console.log(`\n🚨 Fichiers critiques (${report.critical.length}) :`);
report.critical.forEach(f => console.log(`   - ${f}`));

// Générer un fichier de rapport détaillé
const reportContent = `# Rapport d'Analyse AsyncStorage

## Statistiques
- Total fichiers : ${report.total}
- Migrés : ${report.migrated}
- À migrer : ${report.toMigrate.length}

## Fichiers Critiques à Migrer (${report.critical.length})
${report.critical.map(f => `- ${f}`).join('\n')}

## Services à Migrer (${report.services.length})
${report.services.map(f => `- ${f}`).join('\n')}

## Contexts à Migrer (${report.contexts.length})
${report.contexts.map(f => `- ${f}`).join('\n')}

## Hooks à Migrer (${report.hooks.length})
${report.hooks.map(f => `- ${f}`).join('\n')}

## Composants à Migrer (${report.components.length})
${report.components.map(f => `- ${f}`).join('\n')}

## Écrans à Migrer (${report.screens.length})
${report.screens.map(f => `- ${f}`).join('\n')}

## Autres à Migrer (${report.others.length})
${report.others.map(f => `- ${f}`).join('\n')}
`;

fs.writeFileSync('mobile/ANALYSE_ASYNCSTORAGE_COMPLETE.md', reportContent);
console.log('\n✅ Rapport détaillé généré : mobile/ANALYSE_ASYNCSTORAGE_COMPLETE.md');

