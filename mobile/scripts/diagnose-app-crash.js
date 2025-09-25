#!/usr/bin/env node

/**
 * Script de diagnostic pour l'application mobile Yukpo
 * Identifie les problèmes potentiels qui empêchent l'application de s'ouvrir
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour les logs
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const color = colors[level] || colors.reset;
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

// Vérifications de diagnostic
const checks = [
    {
        name: 'Configuration app.json',
        check: () => {
            const appJsonPath = path.join(__dirname, '..', 'app.json');
            if (!fs.existsSync(appJsonPath)) {
                return { status: 'error', message: 'app.json manquant' };
            }

            const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
            const issues = [];

            if (!appJson.expo.name) issues.push('Nom manquant');
            if (!appJson.expo.slug) issues.push('Slug manquant');
            if (!appJson.expo.android?.package) issues.push('Package Android manquant');
            if (!appJson.expo.android?.permissions) issues.push('Permissions Android manquantes');

            return {
                status: issues.length === 0 ? 'ok' : 'warning',
                message: issues.length === 0 ? 'Configuration correcte' : `Problèmes: ${issues.join(', ')}`,
                data: appJson
            };
        }
    },

    {
        name: 'Configuration EAS',
        check: () => {
            const easJsonPath = path.join(__dirname, '..', 'eas.json');
            if (!fs.existsSync(easJsonPath)) {
                return { status: 'error', message: 'eas.json manquant' };
            }

            const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
            const issues = [];

            if (!easJson.build?.preview) issues.push('Configuration preview manquante');
            if (!easJson.build?.preview?.android) issues.push('Configuration Android preview manquante');

            return {
                status: issues.length === 0 ? 'ok' : 'warning',
                message: issues.length === 0 ? 'Configuration EAS correcte' : `Problèmes: ${issues.join(', ')}`,
                data: easJson
            };
        }
    },

    {
        name: 'Fichiers sources critiques',
        check: () => {
            const criticalFiles = [
                'App.tsx',
                'src/navigation/AppNavigator.tsx',
                'src/contexts/AuthContext.tsx',
                'src/theme/theme.ts',
                'src/config/environment.ts'
            ];

            const missing = [];
            const existing = [];

            criticalFiles.forEach(file => {
                const filePath = path.join(__dirname, '..', file);
                if (fs.existsSync(filePath)) {
                    existing.push(file);
                } else {
                    missing.push(file);
                }
            });

            return {
                status: missing.length === 0 ? 'ok' : 'error',
                message: missing.length === 0 ? 'Tous les fichiers critiques présents' : `Fichiers manquants: ${missing.join(', ')}`,
                data: { existing, missing }
            };
        }
    },

    {
        name: 'Dépendances package.json',
        check: () => {
            const packageJsonPath = path.join(__dirname, '..', 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                return { status: 'error', message: 'package.json manquant' };
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const requiredDeps = [
                '@react-navigation/native',
                '@react-navigation/stack',
                '@react-navigation/bottom-tabs',
                'react-native-paper',
                'react-native-safe-area-context',
                'react-native-gesture-handler',
                'expo',
                '@expo/vector-icons'
            ];

            const missing = [];
            const existing = [];

            requiredDeps.forEach(dep => {
                if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
                    existing.push(dep);
                } else {
                    missing.push(dep);
                }
            });

            return {
                status: missing.length === 0 ? 'ok' : 'warning',
                message: missing.length === 0 ? 'Dépendances critiques présentes' : `Dépendances manquantes: ${missing.join(', ')}`,
                data: { existing, missing }
            };
        }
    },

    {
        name: 'Configuration environnement',
        check: () => {
            const envPath = path.join(__dirname, '..', 'src', 'config', 'environment.ts');
            if (!fs.existsSync(envPath)) {
                return { status: 'error', message: 'Fichier de configuration environnement manquant' };
            }

            const envContent = fs.readFileSync(envPath, 'utf8');
            const issues = [];

            if (!envContent.includes('API_BASE_URL')) issues.push('API_BASE_URL non configuré');
            if (!envContent.includes('https://yukpomnang.onrender.com')) issues.push('URL API backend non trouvée');

            return {
                status: issues.length === 0 ? 'ok' : 'warning',
                message: issues.length === 0 ? 'Configuration environnement correcte' : `Problèmes: ${issues.join(', ')}`,
                data: { content: envContent.substring(0, 500) + '...' }
            };
        }
    },

    {
        name: 'Erreurs de syntaxe potentielles',
        check: () => {
            const filesToCheck = [
                'App.tsx',
                'src/navigation/AppNavigator.tsx',
                'src/contexts/AuthContext.tsx'
            ];

            const errors = [];

            filesToCheck.forEach(file => {
                const filePath = path.join(__dirname, '..', file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');

                    // Vérifications basiques
                    if (content.includes('LoadingScreen') && !content.includes('const LoadingScreen')) {
                        errors.push(`${file}: Référence à LoadingScreen non définie`);
                    }

                    if (content.includes('import') && content.includes('from') && content.includes('undefined')) {
                        errors.push(`${file}: Import potentiellement incorrect`);
                    }

                    // Vérifier les accolades non fermées
                    const openBraces = (content.match(/\{/g) || []).length;
                    const closeBraces = (content.match(/\}/g) || []).length;
                    if (openBraces !== closeBraces) {
                        errors.push(`${file}: Accolades non équilibrées (${openBraces} ouvertes, ${closeBraces} fermées)`);
                    }
                }
            });

            return {
                status: errors.length === 0 ? 'ok' : 'error',
                message: errors.length === 0 ? 'Aucune erreur de syntaxe détectée' : `Erreurs: ${errors.join(', ')}`,
                data: errors
            };
        }
    }
];

// Exécuter les vérifications
async function runDiagnostics() {
    log('magenta', '🔍 Diagnostic de l\'application mobile Yukpo');
    log('cyan', 'Vérification des problèmes potentiels...');

    console.log('\n' + '='.repeat(60) + '\n');

    let allOk = true;
    let criticalIssues = 0;

    for (const check of checks) {
        log('blue', `Vérification: ${check.name}`);

        try {
            const result = check.check();

            if (result.status === 'ok') {
                log('green', `✅ ${result.message}`);
            } else if (result.status === 'warning') {
                log('yellow', `⚠️ ${result.message}`);
                allOk = false;
            } else {
                log('red', `❌ ${result.message}`);
                allOk = false;
                criticalIssues++;
            }

            if (result.data) {
                console.log('Détails:', JSON.stringify(result.data, null, 2));
            }

        } catch (error) {
            log('red', `❌ Erreur lors de la vérification: ${error.message}`);
            allOk = false;
            criticalIssues++;
        }

        console.log('\n' + '-'.repeat(40) + '\n');
    }

    // Recommandations
    log('magenta', '💡 Recommandations:');

    if (criticalIssues > 0) {
        log('red', '❌ Problèmes critiques détectés:');
        log('red', '1. Corriger les erreurs de syntaxe dans les fichiers TypeScript');
        log('red', '2. Vérifier que tous les imports sont corrects');
        log('red', '3. S\'assurer que LoadingScreen est défini dans AppNavigator');
        log('red', '4. Relancer le build après corrections');
    } else if (!allOk) {
        log('yellow', '⚠️ Problèmes mineurs détectés:');
        log('yellow', '1. Vérifier la configuration des permissions');
        log('yellow', '2. S\'assurer que toutes les dépendances sont installées');
        log('yellow', '3. Vérifier la configuration de l\'environnement');
    } else {
        log('green', '✅ Aucun problème détecté dans la configuration');
        log('green', 'Le problème pourrait être lié à:');
        log('green', '1. Permissions Android sur l\'appareil');
        log('green', '2. Version Android incompatible');
        log('green', '3. Problème de signature de l\'APK');
        log('green', '4. Cache de l\'application');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Solutions suggérées
    log('cyan', '🔧 Solutions suggérées:');
    log('cyan', '1. Désinstaller complètement l\'ancienne version de l\'app');
    log('cyan', '2. Redémarrer l\'appareil Android');
    log('cyan', '3. Installer l\'APK depuis un navigateur (pas depuis un gestionnaire de fichiers)');
    log('cyan', '4. Vérifier que "Sources inconnues" est activé');
    log('cyan', '5. Essayer sur un autre appareil Android');

    return { allOk, criticalIssues };
}

// Exécuter le diagnostic
runDiagnostics().then(({ allOk, criticalIssues }) => {
    if (criticalIssues > 0) {
        log('red', '❌ Diagnostic terminé avec des problèmes critiques');
        process.exit(1);
    } else if (!allOk) {
        log('yellow', '⚠️ Diagnostic terminé avec des avertissements');
        process.exit(0);
    } else {
        log('green', '✅ Diagnostic terminé sans problème détecté');
        process.exit(0);
    }
}).catch(error => {
    log('red', '❌ Erreur lors du diagnostic:', error.message);
    process.exit(1);
});
