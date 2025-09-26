#!/usr/bin/env node

/**
 * Script pour vérifier le statut du build EAS
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

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

function log(level, message) {
    const timestamp = new Date().toISOString();
    const color = colors[level] || colors.reset;
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
}

async function checkBuildStatus() {
    log('magenta', '🔍 Vérification du statut du build EAS');

    try {
        // Vérifier les builds récents
        const { stdout } = await execAsync('npx eas build:list --platform=android --limit=5');

        log('cyan', '📋 Derniers builds Android:');
        console.log(stdout);

        // Extraire les informations importantes
        const lines = stdout.split('\n');
        const builds = [];

        for (const line of lines) {
            if (line.includes('yukpomnang-mobile')) {
                builds.push(line.trim());
            }
        }

        if (builds.length > 0) {
            log('green', `✅ ${builds.length} build(s) trouvé(s)`);

            // Afficher le dernier build
            const lastBuild = builds[0];
            log('cyan', '📱 Dernier build:');
            console.log(lastBuild);

            // Vérifier le statut
            if (lastBuild.includes('FINISHED')) {
                log('green', '✅ Build terminé avec succès');
                log('cyan', '🔗 Lien d\'installation disponible dans la sortie ci-dessus');
            } else if (lastBuild.includes('IN_PROGRESS')) {
                log('yellow', '⏳ Build en cours...');
            } else if (lastBuild.includes('ERRORED')) {
                log('red', '❌ Build échoué');
            } else {
                log('blue', 'ℹ️ Statut du build: ' + lastBuild);
            }
        } else {
            log('yellow', '⚠️ Aucun build trouvé');
        }

    } catch (error) {
        log('red', '❌ Erreur lors de la vérification:', error.message);

        // Fallback: vérifier si EAS CLI est installé
        try {
            await execAsync('npx eas --version');
            log('green', '✅ EAS CLI est installé');
        } catch (easError) {
            log('red', '❌ EAS CLI non installé ou non accessible');
        }
    }
}

// Exécuter la vérification
checkBuildStatus().then(() => {
    log('cyan', '💡 Pour plus d\'informations:');
    log('cyan', '   - Visitez: https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile');
    log('cyan', '   - Ou utilisez: npx eas build:list --platform=android');
}).catch(error => {
    log('red', '❌ Erreur:', error.message);
    process.exit(1);
});

