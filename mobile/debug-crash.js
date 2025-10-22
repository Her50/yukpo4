/**
 * DEBUG FORCÉ - Capture des logs même en cas de crash
 * Ce script force l'affichage des logs pour détecter le problème exact
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DEBUG FORCÉ - Capture des logs de crash');
console.log('==========================================\n');

// Créer un fichier de log pour capturer tout
const logFile = path.join(__dirname, 'crash-logs.txt');
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

// Rediriger console.log vers le fichier ET l'écran
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
    const message = args.join(' ') + '\n';
    logStream.write(`[LOG] ${message}`);
    originalLog(...args);
};

console.error = (...args) => {
    const message = args.join(' ') + '\n';
    logStream.write(`[ERROR] ${message}`);
    originalError(...args);
};

console.warn = (...args) => {
    const message = args.join(' ') + '\n';
    logStream.write(`[WARN] ${message}`);
    originalWarn(...args);
};

// Fonction pour analyser les imports problématiques
function analyzeImports() {
    console.log('🔍 ANALYSE DES IMPORTS CRITIQUES...');
    
    const criticalFiles = [
        'src/navigation/AppNavigator.tsx',
        'src/contexts/LanguageContext.tsx',
        'src/contexts/WebSocketContext.tsx',
        'src/hooks/useGPSTracking.ts'
    ];
    
    criticalFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`\n📁 Analyse de ${file}:`);
            
            try {
                const content = fs.readFileSync(file, 'utf8');
                
                // Détecter les imports problématiques
                const requireMatches = content.match(/require\([^)]+\)/g);
                if (requireMatches) {
                    console.log(`❌ REQUIRE() DÉTECTÉ: ${requireMatches.join(', ')}`);
                }
                
                // Détecter les @ts-ignore
                const tsIgnoreMatches = content.match(/@ts-ignore/g);
                if (tsIgnoreMatches) {
                    console.log(`⚠️ @ts-ignore DÉTECTÉ: ${tsIgnoreMatches.length} occurrences`);
                }
                
                // Détecter les imports manquants
                if (file.includes('LanguageContext') && !content.includes('import * as Location')) {
                    console.log('❌ IMPORT expo-location MANQUANT ou INCORRECT');
                }
                
                if (file.includes('AppNavigator') && !content.includes('phosphor-react-native')) {
                    console.log('❌ IMPORT phosphor-react-native MANQUANT');
                }
                
                // Détecter les erreurs de syntaxe
                const syntaxErrors = [];
                if (content.includes('const * as')) {
                    syntaxErrors.push('const * as (syntaxe invalide)');
                }
                if (content.includes('maximumAge:')) {
                    syntaxErrors.push('maximumAge (paramètre invalide)');
                }
                
                if (syntaxErrors.length > 0) {
                    console.log(`❌ ERREURS DE SYNTAXE: ${syntaxErrors.join(', ')}`);
                } else {
                    console.log('✅ Syntaxe OK');
                }
                
            } catch (error) {
                console.log(`❌ ERREUR LECTURE: ${error.message}`);
            }
        } else {
            console.log(`❌ FICHIER MANQUANT: ${file}`);
        }
    });
}

// Fonction pour tester les dépendances
function testDependencies() {
    console.log('\n🔍 TEST DES DÉPENDANCES...');
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const criticalDeps = [
        'expo-location',
        'phosphor-react-native',
        '@react-native-async-storage/async-storage',
        '@react-navigation/bottom-tabs',
        '@react-navigation/stack'
    ];
    
    criticalDeps.forEach(dep => {
        if (packageJson.dependencies[dep]) {
            console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
        } else {
            console.log(`❌ ${dep}: MANQUANT`);
        }
    });
}

// Fonction pour simuler le démarrage
function simulateStartup() {
    console.log('\n🚀 SIMULATION DU DÉMARRAGE...');
    
    try {
        // Simuler l'import des contextes
        console.log('📱 Simulation import LanguageContext...');
        
        if (fs.existsSync('src/contexts/LanguageContext.tsx')) {
            const content = fs.readFileSync('src/contexts/LanguageContext.tsx', 'utf8');
            
            // Vérifier les imports en haut du fichier
            const importLines = content.split('\n').slice(0, 10);
            console.log('📦 Imports détectés:');
            importLines.forEach((line, i) => {
                if (line.includes('import')) {
                    console.log(`  ${i+1}: ${line.trim()}`);
                }
            });
            
            // Vérifier la fonction de détection GPS
            if (content.includes('detectLanguageFromGPS')) {
                console.log('✅ Fonction detectLanguageFromGPS trouvée');
                
                // Extraire la fonction pour analyse
                const gpsFunctionMatch = content.match(/const detectLanguageFromGPS = async \(\) => \{[\s\S]*?\};/);
                if (gpsFunctionMatch) {
                    const gpsFunction = gpsFunctionMatch[0];
                    
                    if (gpsFunction.includes('require(')) {
                        console.log('❌ CRASH POTENTIEL: require() dans detectLanguageFromGPS');
                    }
                    if (gpsFunction.includes('const * as')) {
                        console.log('❌ CRASH POTENTIEL: syntaxe invalide const * as');
                    }
                    if (gpsFunction.includes('maximumAge:')) {
                        console.log('❌ CRASH POTENTIEL: maximumAge invalide');
                    }
                }
            }
        }
        
        console.log('📱 Simulation import AppNavigator...');
        
        if (fs.existsSync('src/navigation/AppNavigator.tsx')) {
            const content = fs.readFileSync('src/navigation/AppNavigator.tsx', 'utf8');
            
            // Compter les onglets
            const tabCount = (content.match(/Tab\.Screen/g) || []).length;
            console.log(`📊 Onglets détectés: ${tabCount}`);
            
            if (tabCount < 7) {
                console.log('⚠️ Navigation incomplète détectée');
            }
        }
        
    } catch (error) {
        console.log(`❌ ERREUR SIMULATION: ${error.message}`);
        console.log(`📍 Stack trace: ${error.stack}`);
    }
}

// Fonction principale
function runDebug() {
    console.log('🎯 DÉMARRAGE DU DEBUG FORCÉ...\n');
    
    analyzeImports();
    testDependencies();
    simulateStartup();
    
    console.log('\n📋 RÉSUMÉ DU DEBUG:');
    console.log('===================');
    console.log('✅ Tous les logs ont été capturés dans: crash-logs.txt');
    console.log('📁 Chemin complet:', logFile);
    console.log('\n🔧 PROCHAINES ÉTAPES:');
    console.log('1. Copiez le contenu de crash-logs.txt');
    console.log('2. Envoyez-moi les logs pour analyse');
    console.log('3. Je corrigerai les problèmes détectés');
    
    // Fermer le stream
    logStream.end();
    
    console.log('\n📄 CONTENU DU FICHIER DE LOG:');
    console.log('==============================');
    
    // Afficher le contenu du fichier de log
    try {
        const logContent = fs.readFileSync(logFile, 'utf8');
        console.log(logContent);
    } catch (error) {
        console.log('❌ Impossible de lire le fichier de log');
    }
}

// Exécuter le debug
runDebug();

