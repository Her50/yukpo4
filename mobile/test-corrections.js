/**
 * Script de test pour vérifier toutes les corrections appliquées
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Test des corrections appliquées...');

// Fonction pour vérifier qu'un fichier existe
function checkFile(filePath, description) {
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${description}: ${filePath}`);
        return true;
    } else {
        console.log(`❌ ${description}: ${filePath} - FICHIER MANQUANT`);
        return false;
    }
}

// Fonction pour vérifier qu'un pattern n'existe plus dans un fichier
function checkPatternRemoved(filePath, pattern, description) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(pattern);
        if (matches) {
            console.log(`⚠️ ${description}: ${matches.length} occurrences restantes dans ${filePath}`);
            return false;
        } else {
            console.log(`✅ ${description}: Aucune occurrence dans ${filePath}`);
            return true;
        }
    } catch (error) {
        console.log(`❌ ${description}: Erreur lecture ${filePath}`);
        return false;
    }
}

console.log('\n📁 Vérification des nouveaux fichiers...');

// Vérifier les nouveaux fichiers créés
const newFiles = [
    { path: 'src/utils/errorHandler.ts', desc: 'Gestionnaire d\'erreur' },
    { path: 'src/hooks/useSafeEffect.ts', desc: 'Hook useSafeEffect' },
    { path: 'src/components/ErrorTestComponent.tsx', desc: 'Composant de test' },
    { path: 'src/routes/AppRoutesRegistry.ts', desc: 'Registre des routes' },
    { path: 'src/hooks/useUser.ts', desc: 'Hook useUser' },
    { path: 'src/components/ui/button.tsx', desc: 'Composant Button' },
    { path: 'src/components/ui/input.tsx', desc: 'Composant Input' },
    { path: 'src/components/ui/card.tsx', desc: 'Composant Card' }
];

let filesOk = 0;
newFiles.forEach(({ path: filePath, desc }) => {
    if (checkFile(filePath, desc)) {
        filesOk++;
    }
});

console.log(`\n📊 Fichiers créés: ${filesOk}/${newFiles.length}`);

console.log('\n🔍 Vérification des corrections appliquées...');

// Vérifier les corrections dans les fichiers modifiés
const corrections = [
    {
        file: 'src/lib/yukpoaclient.ts',
        pattern: /\.catch\(\(\) => \(\{\}\)\)/g,
        desc: 'Catch silencieux dans yukpoaclient.ts'
    },
    {
        file: 'src/services/yukpoclient.ts',
        pattern: /\.catch\(\(\) => \(\{\}\)\)/g,
        desc: 'Catch silencieux dans yukpoclient.ts'
    },
    {
        file: 'src/components/SafeIcon.tsx',
        pattern: /@ts-ignore/g,
        desc: '@ts-ignore dans SafeIcon.tsx'
    },
    {
        file: 'src/utils/jwtDecode.ts',
        pattern: /@ts-ignore/g,
        desc: '@ts-ignore dans jwtDecode.ts'
    }
];

let correctionsOk = 0;
corrections.forEach(({ file, pattern, desc }) => {
    if (checkPatternRemoved(file, pattern, desc)) {
        correctionsOk++;
    }
});

console.log(`\n📊 Corrections appliquées: ${correctionsOk}/${corrections.length}`);

console.log('\n🎯 Vérification des imports sécurisés...');

// Vérifier que les imports dynamiques sont sécurisés
const dynamicImports = [
    {
        file: 'src/components/IncomingCallManager.tsx',
        pattern: /catch\s*\(\s*error\s*\)\s*=>\s*\{\s*console\.error.*\}/g,
        desc: 'Gestion d\'erreur dans IncomingCallManager.tsx'
    },
    {
        file: 'src/components/WebRTCCallModal.tsx',
        pattern: /try\s*\{\s*soundSource\s*=\s*require/g,
        desc: 'Require sécurisé dans WebRTCCallModal.tsx'
    },
    {
        file: 'src/contexts/AuthContext.tsx',
        pattern: /catch\s*\(\s*pushError\s*\)\s*=>\s*\{[^}]*console\.error/g,
        desc: 'Gestion d\'erreur dans AuthContext.tsx'
    }
];

let importsOk = 0;
dynamicImports.forEach(({ file, pattern, desc }) => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        if (pattern.test(content)) {
            console.log(`✅ ${desc}: Correctement sécurisé`);
            importsOk++;
        } else {
            console.log(`⚠️ ${desc}: Pattern non trouvé`);
        }
    } catch (error) {
        console.log(`❌ ${desc}: Erreur lecture fichier`);
    }
});

console.log(`\n📊 Imports sécurisés: ${importsOk}/${dynamicImports.length}`);

// Résumé final
const totalScore = filesOk + correctionsOk + importsOk;
const maxScore = newFiles.length + corrections.length + dynamicImports.length;

console.log('\n🎯 RÉSUMÉ FINAL:');
console.log(`Score total: ${totalScore}/${maxScore}`);

if (totalScore >= maxScore * 0.8) {
    console.log('🎉 Excellent! La plupart des corrections ont été appliquées avec succès.');
} else if (totalScore >= maxScore * 0.6) {
    console.log('✅ Bien! La majorité des corrections ont été appliquées.');
} else {
    console.log('⚠️ Attention! Plusieurs corrections nécessitent encore du travail.');
}

console.log('\n💡 Prochaines étapes:');
console.log('1. Tester l\'application avec: npm start');
console.log('2. Vérifier qu\'il n\'y a pas d\'erreurs TypeScript');
console.log('3. Corriger manuellement les problèmes restants si nécessaire');

console.log('\n🎯 Test terminé.');
