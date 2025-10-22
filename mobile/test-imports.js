/**
 * Script pour tester tous les imports critiques
 */

console.log('🧪 Test des imports critiques...\n');

const testImport = (name, importFn) => {
    try {
        importFn();
        console.log(`✅ ${name}`);
        return true;
    } catch (error) {
        console.error(`❌ ${name}`);
        console.error(`   Erreur: ${error.message}`);
        console.error(`   Stack: ${error.stack?.split('\n')[0]}`);
        return false;
    }
};

let successCount = 0;
let totalCount = 0;

// Test des dépendances React Native
console.log('📦 Dépendances de base:');
totalCount++; if (testImport('react', () => require('react'))) successCount++;
totalCount++; if (testImport('react-native', () => require('react-native'))) successCount++;
totalCount++; if (testImport('expo', () => require('expo'))) successCount++;
totalCount++; if (testImport('expo-status-bar', () => require('expo-status-bar'))) successCount++;

// Test des dépendances UI
console.log('\n🎨 UI Libraries:');
totalCount++; if (testImport('react-native-paper', () => require('react-native-paper'))) successCount++;
totalCount++; if (testImport('react-native-safe-area-context', () => require('react-native-safe-area-context'))) successCount++;
totalCount++; if (testImport('react-native-gesture-handler', () => require('react-native-gesture-handler'))) successCount++;

// Test de la navigation
console.log('\n🧭 Navigation:');
totalCount++; if (testImport('@react-navigation/native', () => require('@react-navigation/native'))) successCount++;
totalCount++; if (testImport('@react-navigation/stack', () => require('@react-navigation/stack'))) successCount++;
totalCount++; if (testImport('@react-navigation/bottom-tabs', () => require('@react-navigation/bottom-tabs'))) successCount++;

// Test des contexts
console.log('\n🔗 Contexts:');
totalCount++; if (testImport('AuthContext', () => require('./src/contexts/AuthContext'))) successCount++;
totalCount++; if (testImport('LanguageContext', () => require('./src/contexts/LanguageContext'))) successCount++;
totalCount++; if (testImport('WebSocketContext', () => require('./src/contexts/WebSocketContext'))) successCount++;
totalCount++; if (testImport('LocationContext', () => require('./src/contexts/LocationContext'))) successCount++;

// Test des composants critiques
console.log('\n🧩 Composants critiques:');
totalCount++; if (testImport('ErrorBoundary', () => require('./src/components/ErrorBoundary'))) successCount++;
totalCount++; if (testImport('AppNavigator', () => require('./src/navigation/AppNavigator'))) successCount++;

// Test du theme
console.log('\n🎨 Theme:');
totalCount++; if (testImport('theme', () => require('./src/theme/theme'))) successCount++;

// Test de linking config
console.log('\n🔗 Configuration:');
totalCount++; if (testImport('linking', () => require('./src/config/linking'))) successCount++;

// Résumé
console.log('\n' + '='.repeat(60));
console.log(`📊 RÉSULTAT: ${successCount}/${totalCount} imports réussis`);

if (successCount === totalCount) {
    console.log('🎉 Tous les imports fonctionnent !');
    console.log('\n💡 Le problème de crash est probablement:');
    console.log('   - Dans un useEffect');
    console.log('   - Une erreur runtime (pas d\'import)');
    console.log('   - Un problème de permissions natifs');
} else {
    console.log('\n❌ PROBLÈME DÉTECTÉ !');
    console.log(`   ${totalCount - successCount} import(s) échoué(s)`);
    console.log('\n💡 Solutions:');
    console.log('   1. npm install');
    console.log('   2. Vérifier les fichiers manquants');
    console.log('   3. Corriger les imports cassés');
}

console.log('\n' + '='.repeat(60));

