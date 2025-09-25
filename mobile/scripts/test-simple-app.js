#!/usr/bin/env node

/**
 * Script pour tester l'application avec une version simplifiée
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

function log(level, message) {
    const timestamp = new Date().toISOString();
    const color = colors[level] || colors.reset;
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
}

async function testSimpleApp() {
    log('magenta', '🧪 Test de l\'application simplifiée');

    try {
        // Sauvegarder l'App.tsx original
        const originalAppPath = path.join(__dirname, '..', 'App.tsx');
        const backupAppPath = path.join(__dirname, '..', 'App.backup.tsx');
        const simpleAppPath = path.join(__dirname, '..', 'App.simple.tsx');

        if (fs.existsSync(originalAppPath)) {
            fs.copyFileSync(originalAppPath, backupAppPath);
            log('green', '✅ App.tsx original sauvegardé');
        }

        // Remplacer par la version simple
        if (fs.existsSync(simpleAppPath)) {
            fs.copyFileSync(simpleAppPath, originalAppPath);
            log('green', '✅ App.tsx remplacé par la version simple');
        } else {
            log('red', '❌ App.simple.tsx non trouvé');
            return false;
        }

        log('cyan', '📱 L\'application a été simplifiée pour le test');
        log('cyan', '🔧 Prochaines étapes:');
        log('cyan', '1. Relancer le build EAS');
        log('cyan', '2. Installer la nouvelle version');
        log('cyan', '3. Tester si l\'application s\'ouvre');
        log('cyan', '4. Si ça marche, le problème vient de la complexité de l\'app');
        log('cyan', '5. Si ça ne marche pas, le problème est plus profond');

        return true;

    } catch (error) {
        log('red', '❌ Erreur lors du test:', error.message);
        return false;
    }
}

async function restoreOriginalApp() {
    log('magenta', '🔄 Restauration de l\'App.tsx original');

    try {
        const originalAppPath = path.join(__dirname, '..', 'App.tsx');
        const backupAppPath = path.join(__dirname, '..', 'App.backup.tsx');

        if (fs.existsSync(backupAppPath)) {
            fs.copyFileSync(backupAppPath, originalAppPath);
            fs.unlinkSync(backupAppPath);
            log('green', '✅ App.tsx original restauré');
            return true;
        } else {
            log('yellow', '⚠️ Aucune sauvegarde trouvée');
            return false;
        }

    } catch (error) {
        log('red', '❌ Erreur lors de la restauration:', error.message);
        return false;
    }
}

// Gestion des arguments
const args = process.argv.slice(2);

if (args.includes('--restore')) {
    restoreOriginalApp().then(success => {
        process.exit(success ? 0 : 1);
    });
} else {
    testSimpleApp().then(success => {
        process.exit(success ? 0 : 1);
    });
}
