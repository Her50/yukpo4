#!/usr/bin/env node

/**
 * Script de nettoyage des dossiers de build Android
 * Supprime les dossiers qui ne doivent pas être inclus dans l'archive EAS Build
 */

const fs = require('fs');
const path = require('path');

const dirsToRemove = [
  path.join(__dirname, '..', 'android', 'app', 'build'),
  path.join(__dirname, '..', 'android', 'build'),
  path.join(__dirname, '..', 'android', '.gradle'),
];

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✅ Supprimé: ${path.relative(process.cwd(), dir)}`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de la suppression de ${dir}:`, error.message);
      return false;
    }
  } else {
    console.log(`ℹ️  N'existe pas: ${path.relative(process.cwd(), dir)}`);
    return true;
  }
}

console.log('🧹 Nettoyage des dossiers de build Android...\n');

let allSuccess = true;
dirsToRemove.forEach(dir => {
  if (!removeDir(dir)) {
    allSuccess = false;
  }
});

console.log('\n✨ Nettoyage terminé!');

if (!allSuccess) {
  process.exit(1);
}



