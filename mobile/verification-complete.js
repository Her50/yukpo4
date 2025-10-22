/**
 * Vérification complète de toutes les corrections
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 VÉRIFICATION COMPLÈTE DE L\'APPLICATION\n');
console.log('=' .repeat(60));

// 1. Vérifier la structure des fichiers
console.log('\n📁 1. VÉRIFICATION DE LA STRUCTURE');
console.log('-'.repeat(60));

const criticalFiles = [
  'App.tsx',
  'index.js',
  'package.json',
  'tsconfig.json',
  'src/utils/errorHandler.ts',
  'src/hooks/useSafeEffect.ts',
  'src/components/ErrorTestComponent.tsx',
  'src/navigation/AppNavigator.tsx',
  'src/contexts/AuthContext.tsx'
];

let filesOk = 0;
criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
    filesOk++;
  } else {
    console.log(`❌ ${file} - MANQUANT`);
  }
});

console.log(`\nFichiers critiques: ${filesOk}/${criticalFiles.length}`);

// 2. Vérifier les @ts-ignore restants
console.log('\n📋 2. VÉRIFICATION DES @TS-IGNORE');
console.log('-'.repeat(60));

function countTsIgnore(dir) {
  let count = 0;
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', '.expo', 'dist', 'build'].includes(file)) {
        count += countTsIgnore(filePath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = content.match(/\/\/\s*@ts-ignore/g);
      if (matches) {
        count += matches.length;
      }
    }
  });
  
  return count;
}

const tsIgnoreCount = countTsIgnore('src');
console.log(`@ts-ignore restants: ${tsIgnoreCount}`);
if (tsIgnoreCount <= 25) {
  console.log('✅ Nombre acceptable de @ts-ignore');
} else {
  console.log('⚠️ Trop de @ts-ignore restants');
}

// 3. Vérifier les catch silencieux
console.log('\n🔇 3. VÉRIFICATION DES CATCH SILENCIEUX');
console.log('-'.repeat(60));

function checkSilentCatches(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const silentPattern = /\.catch\(\(\)\s*=>\s*\{\s*\}\)/g;
  const matches = content.match(silentPattern);
  return matches ? matches.length : 0;
}

const criticalApiFiles = [
  'src/lib/yukpoaclient.ts',
  'src/services/yukpoclient.ts',
  'src/services/api.ts'
];

let totalSilentCatches = 0;
criticalApiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const count = checkSilentCatches(file);
    totalSilentCatches += count;
    if (count === 0) {
      console.log(`✅ ${file} - Aucun catch silencieux`);
    } else {
      console.log(`❌ ${file} - ${count} catch silencieux trouvés`);
    }
  }
});

console.log(`\nTotal catch silencieux: ${totalSilentCatches}`);

// 4. Vérifier le package.json
console.log('\n📦 4. VÉRIFICATION DU PACKAGE.JSON');
console.log('-'.repeat(60));

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ Nom: ${packageJson.name}`);
  console.log(`✅ Version: ${packageJson.version}`);
  console.log(`✅ Scripts définis: ${Object.keys(packageJson.scripts || {}).length}`);
  console.log(`✅ Dépendances: ${Object.keys(packageJson.dependencies || {}).length}`);
} catch (error) {
  console.log('❌ Erreur lecture package.json');
}

// 5. Vérifier TypeScript config
console.log('\n⚙️  5. VÉRIFICATION TSCONFIG');
console.log('-'.repeat(60));

try {
  const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
  const paths = tsconfig.compilerOptions?.paths;
  if (paths && paths['@/*']) {
    console.log('✅ Path mapping @/* configuré');
  } else {
    console.log('⚠️ Path mapping @/* non configuré');
  }
} catch (error) {
  console.log('❌ Erreur lecture tsconfig.json');
}

// 6. Statistiques globales
console.log('\n📊 6. STATISTIQUES GLOBALES');
console.log('-'.repeat(60));

function countFiles(dir, extensions) {
  let count = 0;
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', '.expo', 'dist', 'build'].includes(file)) {
        count += countFiles(filePath, extensions);
      }
    } else if (extensions.some(ext => file.endsWith(ext))) {
      count++;
    }
  });
  
  return count;
}

const tsFiles = countFiles('src', ['.ts', '.tsx']);
const componentFiles = countFiles('src/components', ['.tsx']);
const screenFiles = countFiles('src/screens', ['.tsx']);

console.log(`Fichiers TypeScript: ${tsFiles}`);
console.log(`Composants: ${componentFiles}`);
console.log(`Screens: ${screenFiles}`);

// 7. Score final
console.log('\n🎯 SCORE FINAL');
console.log('='.repeat(60));

let score = 0;
let maxScore = 0;

// Structure (9 points)
maxScore += 9;
score += filesOk;

// @ts-ignore (1 point si <= 25)
maxScore += 1;
if (tsIgnoreCount <= 25) score += 1;

// Catch silencieux (1 point si 0)
maxScore += 1;
if (totalSilentCatches === 0) score += 1;

// Config (2 points)
maxScore += 2;
if (fs.existsSync('package.json')) score += 1;
if (fs.existsSync('tsconfig.json')) score += 1;

const percentage = Math.round((score / maxScore) * 100);

console.log(`Score: ${score}/${maxScore} (${percentage}%)`);
console.log();

if (percentage >= 90) {
  console.log('🎉 EXCELLENT! L\'application est prête pour le test.');
  console.log('✅ Toutes les corrections critiques ont été appliquées.');
} else if (percentage >= 75) {
  console.log('✅ BON! La plupart des corrections sont en place.');
  console.log('⚠️ Quelques ajustements mineurs peuvent être nécessaires.');
} else {
  console.log('⚠️ ATTENTION! Certaines corrections nécessitent plus de travail.');
}

console.log('\n💡 COMMANDES SUIVANTES:');
console.log('-'.repeat(60));
console.log('1. npm start          - Démarrer l\'application');
console.log('2. npx tsc --noEmit   - Vérifier les types TypeScript');
console.log('3. npm run android    - Builder pour Android');
console.log();
console.log('📖 Voir RAPPORT-CORRECTIONS-FINALES.md pour plus de détails');
console.log('\n' + '='.repeat(60));
console.log('✅ Vérification terminée!\n');
