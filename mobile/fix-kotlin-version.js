#!/usr/bin/env node

/**
 * Script pour forcer Kotlin 1.9.20 dans tous les fichiers Gradle
 * Résout l'erreur "Key 1.9.24 is missing in the map"
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Kotlin version to 1.9.20...');

const targetVersion = '1.9.20';

// Fichiers à modifier
const filesToFix = [
  'android/gradle.properties',
  'android/build.gradle',
  'android/app/build.gradle'
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Remplacer toutes les versions de Kotlin par 1.9.20
  const patterns = [
    /kotlinVersion\s*=\s*['"][\d.]+['"]/g,
    /android\.kotlinVersion\s*=\s*[\d.]+/g,
    /kotlin-gradle-plugin:[\d.]+/g,
    /kotlin-stdlib:[\d.]+/g
  ];

  patterns.forEach(pattern => {
    if (pattern.test(content)) {
      if (pattern.toString().includes('kotlinVersion')) {
        content = content.replace(pattern, `kotlinVersion = '${targetVersion}'`);
      } else if (pattern.toString().includes('android.kotlinVersion')) {
        content = content.replace(pattern, `android.kotlinVersion=${targetVersion}`);
      } else if (pattern.toString().includes('gradle-plugin')) {
        content = content.replace(pattern, `kotlin-gradle-plugin:${targetVersion}`);
      } else if (pattern.toString().includes('stdlib')) {
        content = content.replace(pattern, `kotlin-stdlib:${targetVersion}`);
      }
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed Kotlin version in ${filePath}`);
  } else {
    console.log(`✓  ${filePath} already correct or no Kotlin version found`);
  }
});

console.log('✅ Kotlin version fix completed');

