/**
 * Script de test simple pour vérifier le démarrage de l'application
 * Ce script teste les composants critiques un par un
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Test de démarrage de l\'application Yukpo...');

// Vérifier les fichiers critiques
const criticalFiles = [
  'App.tsx',
  'index.js',
  'src/navigation/AppNavigator.tsx',
  'src/contexts/AuthContext.tsx',
  'package.json'
];

console.log('📁 Vérification des fichiers critiques...');
criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} - OK`);
  } else {
    console.log(`❌ ${file} - MANQUANT`);
  }
});

// Vérifier les dépendances critiques
console.log('\n📦 Vérification des dépendances...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const criticalDeps = [
    'react',
    'react-native',
    '@react-navigation/native',
    '@react-navigation/bottom-tabs',
    'expo'
  ];
  
  criticalDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep} - OK`);
    } else {
      console.log(`❌ ${dep} - MANQUANT`);
    }
  });
} catch (error) {
  console.log('❌ Erreur lecture package.json:', error.message);
}

console.log('\n🎯 Test terminé. Si tous les fichiers sont OK, l\'application devrait démarrer.');
