#!/usr/bin/env node

/**
 * Script pour ajouter Kotlin 1.9.24 dans la map Expo si nécessaire
 * OU forcer l'utilisation de 2.0.0 partout
 * Résout l'erreur "Key 1.9.24 is missing in the map" ou tout autre mismatch
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Expo Kotlin version map...');

// Méthode 1: Chercher et modifier le plugin expo-root-project
const expoPluginPath = path.join(
  __dirname,
  'node_modules',
  'expo',
  'scripts',
  'gradle-plugins'
);

// Méthode 2: Forcer Kotlin 2.0.0 dans React Native
const rnGradleLibsPath = path.join(
  __dirname,
  'node_modules',
  'react-native',
  'gradle',
  'libs.versions.toml'
);

if (fs.existsSync(rnGradleLibsPath)) {
  console.log('📝 Checking React Native libs.versions.toml...');
  let content = fs.readFileSync(rnGradleLibsPath, 'utf8');

  // Remplacer toutes les versions de Kotlin par 2.0.0
  if (content.includes('1.9.24')) {
    console.log('⚠️  Found Kotlin 1.9.24 in React Native libs.versions.toml');
    content = content.replace(/kotlin\s*=\s*"1\.9\.24"/g, 'kotlin = "2.0.0"');
    content = content.replace(/kotlinVersion\s*=\s*"1\.9\.24"/g, 'kotlinVersion = "2.0.0"');
    fs.writeFileSync(rnGradleLibsPath, content, 'utf8');
    console.log('✅ Fixed Kotlin version in React Native libs.versions.toml');
  } else {
    console.log('✓  React Native libs.versions.toml OK');
  }
}

// Méthode 3: Modifier le catalogue de versions Gradle
const catalogPath = path.join(
  __dirname,
  'android',
  'gradle',
  'libs.versions.toml'
);

if (fs.existsSync(catalogPath)) {
  console.log('📝 Checking Gradle catalog...');
  let content = fs.readFileSync(catalogPath, 'utf8');

  if (content.includes('1.9.24')) {
    console.log('⚠️  Found Kotlin 1.9.24 in Gradle catalog');
    content = content.replace(/kotlin\s*=\s*"1\.9\.24"/g, 'kotlin = "2.0.0"');
    content = content.replace(/kotlinVersion\s*=\s*"1\.9\.24"/g, 'kotlinVersion = "2.0.0"');
    fs.writeFileSync(catalogPath, content, 'utf8');
    console.log('✅ Fixed Kotlin version in Gradle catalog');
  } else {
    console.log('✓  Gradle catalog OK');
  }
}

// Méthode 4: Créer un fichier gradle.properties global si nécessaire
const gradlePropsPath = path.join(__dirname, 'android', 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let content = fs.readFileSync(gradlePropsPath, 'utf8');

  // S'assurer que kotlinVersion est bien défini
  if (!content.includes('android.kotlinVersion')) {
    content += '\n# Force Kotlin version\nandroid.kotlinVersion=2.0.0\n';
    fs.writeFileSync(gradlePropsPath, content, 'utf8');
    console.log('✅ Added kotlinVersion to gradle.properties');
  } else if (content.includes('android.kotlinVersion=1.9.24')) {
    content = content.replace('android.kotlinVersion=1.9.24', 'android.kotlinVersion=2.0.0');
    fs.writeFileSync(gradlePropsPath, content, 'utf8');
    console.log('✅ Fixed kotlinVersion in gradle.properties');
  }
}

console.log('✅ Expo Kotlin map fix completed');

