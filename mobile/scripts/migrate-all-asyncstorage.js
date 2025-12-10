/**
 * Script de migration automatique AsyncStorage → SafeStorage
 * Migre tous les fichiers restants de manière systématique
 */

const fs = require('fs');
const path = require('path');

// Liste complète des fichiers à migrer (priorité 2 et 3)
const filesToMigrate = [
    // Services (20 fichiers)
    'mobile/src/services/analyticsService.ts',
    'mobile/src/services/abTestingService.ts',
    'mobile/src/services/cdnService.ts',
    'mobile/src/services/i18n.ts',
    'mobile/src/services/offlineCache.ts',
    'mobile/src/services/languageDetectionService.ts',
    'mobile/src/services/mlRecommendationService.ts',
    'mobile/src/services/loyaltyProgram.ts',
    'mobile/src/services/tripRecommendations.ts',
    'mobile/src/services/ticketNotifications.ts',
    'mobile/src/services/videoPreloadService.ts',
    'mobile/src/services/videoCacheService.ts',
    'mobile/src/services/advancedCacheService.ts',
    'mobile/src/services/push_notifications.ts',
    'mobile/src/services/offline_storage.ts',
    'mobile/src/services/adaptiveVideoService.ts',
    'mobile/src/services/uploadApi.ts',
    'mobile/src/services/externalProductDatabaseService.ts',
    'mobile/src/services/intelligentProductAutocomplete.ts',
    'mobile/src/services/translationService.ts',

    // Hooks (3 fichiers)
    'mobile/src/hooks/useCreatorStudio.ts',
    'mobile/src/hooks/useWebSocketChat.ts',
    'mobile/src/hooks/useNotifications.ts',

    // Composants (13 fichiers)
    'mobile/src/components/MixedContentCarousel.tsx',
    'mobile/src/components/GPSTrackingManager.tsx',
    'mobile/src/components/delivery/ProofMediaUpload.tsx',
    'mobile/src/components/SmartPhoneModelInput.tsx',
    'mobile/src/components/CategoryFilters.tsx',
    'mobile/src/components/BusSeatSelector.tsx',
    'mobile/src/components/SmartApplianceInput.tsx',
    'mobile/src/components/SmartVehicleModelInput.tsx',
    'mobile/src/components/SmartModalityInput.tsx',
    'mobile/src/components/AutocompleteStructure.tsx',
    'mobile/src/components/BusSeatSelectorMulti.tsx',
    'mobile/src/components/HeaderController.tsx',
    'mobile/src/components/GroupeForm.tsx',

    // Écrans (7 fichiers)
    'mobile/src/screens/ServicesInteragisScreen.tsx',
    'mobile/src/screens/HomeScreenNew.tsx',
    'mobile/src/screens/specialized/GestionServicesSpecialisesScreen.tsx',
    'mobile/src/screens/video/VideoCreationIntroScreen.tsx',
    'mobile/src/screens/ProductDetailScreen.tsx',
    'mobile/src/screens/RegisterScreen.tsx',
    'mobile/src/screens/SettingsScreen.tsx',

    // Utils (7 fichiers)
    'mobile/src/utils/cache.ts',
    'mobile/src/utils/videoDraftStorage.ts',
    'mobile/src/utils/userZone.ts',
    'mobile/src/utils/deepLinkHandler.ts',
    'mobile/src/utils/smartFilterSuggestions.ts',
    'mobile/src/utils/metrics.ts',
    'mobile/src/config/gpsConfig.ts',
    'mobile/src/lib/yukpoaclient.ts',
];

const report = {
    total: filesToMigrate.length,
    migrated: 0,
    skipped: 0,
    errors: [],
    details: []
};

function migrateFile(filePath) {
    // Si le chemin commence par 'mobile/', on le retire car on est déjà dans mobile/
    const relativePath = filePath.startsWith('mobile/') ? filePath.substring(7) : filePath;
    const fullPath = path.join(process.cwd(), relativePath);

    if (!fs.existsSync(fullPath)) {
        report.skipped++;
        report.details.push({ file: filePath, status: 'skipped', reason: 'File not found' });
        return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    const changes = [];

    // 1. Remplacer l'import AsyncStorage
    const importPattern = /import\s+AsyncStorage\s+from\s+['"]@react-native-async-storage\/async-storage['"];?/g;
    if (importPattern.test(content)) {
        // Déterminer le chemin relatif vers safeStorage
        const depth = filePath.split('/').length - 2; // -2 pour mobile/src
        const relativePath = '../'.repeat(depth) + 'utils/safeStorage';

        content = content.replace(
            importPattern,
            `// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"\nimport SafeStorage from '${relativePath}';`
        );
        modified = true;
        changes.push('Import replaced');
    }

    // 2. Remplacer les utilisations AsyncStorage.*
    const replacements = [
        { from: /await\s+AsyncStorage\.getItem\(/g, to: 'await SafeStorage.getItem(', name: 'getItem' },
        { from: /await\s+AsyncStorage\.setItem\(/g, to: 'await SafeStorage.setItem(', name: 'setItem' },
        { from: /await\s+AsyncStorage\.removeItem\(/g, to: 'await SafeStorage.removeItem(', name: 'removeItem' },
        { from: /await\s+AsyncStorage\.getAllKeys\(/g, to: 'await SafeStorage.getAllKeys(', name: 'getAllKeys' },
        { from: /await\s+AsyncStorage\.multiRemove\(/g, to: 'await SafeStorage.multiRemove(', name: 'multiRemove' },
        { from: /AsyncStorage\.getItem\(/g, to: 'SafeStorage.getItem(', name: 'getItem (sync)' },
        { from: /AsyncStorage\.setItem\(/g, to: 'SafeStorage.setItem(', name: 'setItem (sync)' },
        { from: /AsyncStorage\.removeItem\(/g, to: 'SafeStorage.removeItem(', name: 'removeItem (sync)' },
    ];

    replacements.forEach(({ from, to, name }) => {
        if (from.test(content)) {
            const matches = content.match(from);
            content = content.replace(from, to);
            modified = true;
            changes.push(`${name}: ${matches.length} replacement(s)`);
        }
    });

    if (modified) {
        try {
            fs.writeFileSync(fullPath, content, 'utf8');
            report.migrated++;
            report.details.push({
                file: filePath,
                status: 'migrated',
                changes: changes.join(', ')
            });
            return true;
        } catch (error) {
            report.errors.push({ file: filePath, error: error.message });
            report.details.push({ file: filePath, status: 'error', reason: error.message });
            return false;
        }
    } else {
        report.skipped++;
        report.details.push({ file: filePath, status: 'skipped', reason: 'No AsyncStorage usage found' });
        return false;
    }
}

// Exécuter la migration
console.log('🔄 Migration AsyncStorage → SafeStorage\n');
console.log(`📋 ${filesToMigrate.length} fichiers à migrer\n`);

filesToMigrate.forEach((file, index) => {
    process.stdout.write(`[${index + 1}/${filesToMigrate.length}] ${file}... `);
    const result = migrateFile(file);
    console.log(result ? '✅' : '⏭️');
});

// Afficher le rapport
console.log('\n' + '='.repeat(60));
console.log('📊 RAPPORT DE MIGRATION');
console.log('='.repeat(60));
console.log(`\n✅ Migrés : ${report.migrated}`);
console.log(`⏭️  Ignorés : ${report.skipped}`);
console.log(`❌ Erreurs : ${report.errors.length}`);

if (report.errors.length > 0) {
    console.log('\n❌ Erreurs :');
    report.errors.forEach(({ file, error }) => {
        console.log(`   - ${file}: ${error}`);
    });
}

// Générer un rapport détaillé
const reportContent = `# Rapport de Migration Automatique

## Statistiques
- Total fichiers : ${report.total}
- Migrés : ${report.migrated}
- Ignorés : ${report.skipped}
- Erreurs : ${report.errors.length}

## Détails

${report.details.map(d => {
    const status = d.status === 'migrated' ? '✅' : d.status === 'skipped' ? '⏭️' : '❌';
    return `${status} ${d.file} - ${d.reason || d.changes || 'N/A'}`;
}).join('\n')}

${report.errors.length > 0 ? `\n## Erreurs\n\n${report.errors.map(e => `- ${e.file}: ${e.error}`).join('\n')}` : ''}
`;

const reportPath = path.join(process.cwd(), 'RAPPORT_MIGRATION_AUTOMATIQUE.md');
fs.writeFileSync(reportPath, reportContent);
console.log('\n✅ Rapport détaillé généré : mobile/RAPPORT_MIGRATION_AUTOMATIQUE.md');

