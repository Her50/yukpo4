/**
 * Script final pour corriger TOUS les @ts-ignore restants
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Correction FINALE de tous les @ts-ignore...');

// Fonction récursive pour trouver tous les fichiers .ts et .tsx
function findAllTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Ignorer node_modules et autres dossiers inutiles
      if (!['node_modules', '.expo', 'dist', 'build', '.git'].includes(file)) {
        findAllTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Fonction pour corriger un fichier
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let changes = 0;

    // Pattern 1: @ts-ignore avant un import
    const importPattern = /\/\/\s*@ts-ignore[^\n]*\n(\s*)import\s+/g;
    if (importPattern.test(content)) {
      content = content.replace(importPattern, '$1import ');
      changes++;
    }

    // Pattern 2: @ts-ignore avant une déconstruction de ReactNative
    const reactNativePattern = /\/\/\s*@ts-ignore[^\n]*\nconst\s+\{([^}]+)\}\s+=\s+ReactNative;/g;
    if (reactNativePattern.test(content)) {
      content = content.replace(reactNativePattern, 'const {$1} = ReactNative;');
      changes++;
    }

    // Pattern 3: @ts-ignore avant un require
    const requirePattern = /\/\/\s*@ts-ignore[^\n]*\n(\s*)const\s+([^=]+)=\s*require/g;
    if (requirePattern.test(content)) {
      content = content.replace(requirePattern, '$1const $2= require');
      changes++;
    }

    // Pattern 4: @ts-ignore seul sur une ligne (le garder mais le commenter)
    const alonePattern = /\/\/\s*@ts-ignore\s*$/gm;
    if (alonePattern.test(content)) {
      content = content.replace(alonePattern, '// TODO: Fix TypeScript type issue');
      changes++;
    }

    // Pattern 5: @ts-nocheck en début de fichier
    const noCheckPattern = /^\/\/\s*@ts-nocheck\s*\n/;
    if (noCheckPattern.test(content)) {
      content = content.replace(noCheckPattern, '');
      changes++;
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${path.relative(process.cwd(), filePath)} - ${changes} corrections`);
      return changes;
    }

    return 0;
  } catch (error) {
    console.error(`❌ Erreur: ${filePath} - ${error.message}`);
    return 0;
  }
}

// Trouver et corriger tous les fichiers
console.log('\n🔍 Recherche de tous les fichiers TypeScript...');
const srcDir = path.join(__dirname, 'src');
const allFiles = findAllTypeScriptFiles(srcDir);
console.log(`📁 ${allFiles.length} fichiers trouvés`);

console.log('\n🔧 Application des corrections...');
let totalChanges = 0;
let filesChanged = 0;

allFiles.forEach(file => {
  const changes = fixFile(file);
  if (changes > 0) {
    totalChanges += changes;
    filesChanged++;
  }
});

console.log('\n📊 RÉSUMÉ FINAL:');
console.log(`Fichiers corrigés: ${filesChanged}`);
console.log(`Total des corrections: ${totalChanges}`);

if (totalChanges > 0) {
  console.log('\n✅ Corrections appliquées avec succès!');
  console.log('💡 Vérifiez que l\'application compile sans erreurs TypeScript');
} else {
  console.log('\n✨ Aucune correction nécessaire - tous les @ts-ignore ont été traités!');
}

console.log('\n🎯 Script terminé.');
