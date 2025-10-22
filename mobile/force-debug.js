/**
 * Script pour forcer l'ouverture du debug même en cas de crash
 * Ce script peut être exécuté pour déclencher manuellement l'écran de debug
 */

const fs = require('fs');

console.log('🔍 FORCE DEBUG - Déclenchement manuel du debug');
console.log('==============================================\n');

// Créer un fichier de signal pour forcer le debug
const debugSignal = {
    timestamp: new Date().toISOString(),
    type: 'FORCE_DEBUG',
    message: '🚨 DEBUG FORCÉ MANUELLEMENT - Application bloquée',
    component: 'ForceDebugScript'
};

// Sauvegarder le signal
try {
    const existingLogs = JSON.parse(fs.readFileSync('src/utils/debug-signal.json', 'utf8') || '[]');
    existingLogs.push(debugSignal);
    fs.writeFileSync('src/utils/debug-signal.json', JSON.stringify(existingLogs, null, 2));
    console.log('✅ Signal de debug forcé créé');
} catch (error) {
    // Créer le fichier s'il n'existe pas
    fs.writeFileSync('src/utils/debug-signal.json', JSON.stringify([debugSignal], null, 2));
    console.log('✅ Fichier de signal créé');
}

// Créer aussi un log de crash pour simuler
const crashLog = {
    timestamp: new Date().toISOString(),
    type: 'CRASH',
    message: '💥 CRASH SIMULÉ - Application ne démarre pas',
    stack: 'Error: Application bloquée au démarrage\n    at App.tsx:42\n    at ReactDOM.render',
    component: 'App'
};

try {
    const existingCrashLogs = JSON.parse(fs.readFileSync('src/utils/crash-logs.json', 'utf8') || '[]');
    existingCrashLogs.push(crashLog);
    fs.writeFileSync('src/utils/crash-logs.json', JSON.stringify(existingCrashLogs, null, 2));
    console.log('✅ Log de crash simulé créé');
} catch (error) {
    fs.writeFileSync('src/utils/crash-logs.json', JSON.stringify([crashLog], null, 2));
    console.log('✅ Fichier de crash créé');
}

console.log('\n🎯 RÉSULTAT:');
console.log('============');
console.log('✅ L\'écran de debug sera affiché automatiquement');
console.log('✅ Vous pourrez copier les logs d\'erreur');
console.log('✅ Les logs seront sauvegardés même en cas de crash');
console.log('\n📱 MAINTENANT:');
console.log('1. Lancez l\'application: npm start');
console.log('2. L\'écran de debug s\'ouvrira automatiquement');
console.log('3. Copiez les logs et envoyez-les moi');

