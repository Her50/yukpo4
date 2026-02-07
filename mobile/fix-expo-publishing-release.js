#!/usr/bin/env node
/**
 * Script pour corriger useExpoPublishing dans ExpoModulesCorePlugin.gradle
 * Le problème: components.release n'existe pas si le projet n'a pas de buildType "release"
 * Solution: Utiliser components.default si components.release n'existe pas
 */
const fs = require('fs');
const path = require('path');

const expoModulesCorePlugin = path.join(
  __dirname,
  'node_modules',
  'expo-modules-core',
  'android',
  'ExpoModulesCorePlugin.gradle'
);

if (!fs.existsSync(expoModulesCorePlugin)) {
  console.log('⚠️  ExpoModulesCorePlugin.gradle not found');
  process.exit(0);
}

let content = fs.readFileSync(expoModulesCorePlugin, 'utf8');

// Vérifier si la correction est déjà appliquée
if (content.includes('components.default') || content.includes('components.release')) {
  // Vérifier si c'est la version corrigée
  if (content.includes('components.default') && content.includes('components.release')) {
    console.log('✅ Fix already applied');
    process.exit(0);
  }
}

// Remplacer le bloc useExpoPublishing pour gérer l'absence de variant release
const oldPattern = /project\.afterEvaluate\s*\{\s*publishing\s*\{\s*publications\s*\{\s*release\(MavenPublication\)\s*\{\s*from\s+components\.release\s*\}\s*\}\s*repositories\s*\{\s*maven\s*\{\s*url\s*=\s*mavenLocal\(\)\.url\s*\}\s*\}\s*\}\s*\}/s;

const newCode = `project.afterEvaluate {
    publishing {
      publications {
        // Utiliser le variant "release" s'il existe, sinon utiliser "default"
        if (project.android.hasProperty('components') && project.android.components.hasProperty('release')) {
          release(MavenPublication) {
            from components.release
          }
        } else if (project.android.hasProperty('components') && project.android.components.hasProperty('default')) {
          release(MavenPublication) {
            from components.default
          }
        }
      }
      repositories {
        maven {
          url = mavenLocal().url
        }
      }
    }
  }`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newCode);
  fs.writeFileSync(expoModulesCorePlugin, content, 'utf8');
  console.log('✅ Fixed useExpoPublishing in ExpoModulesCorePlugin.gradle');
} else {
  console.log('⚠️  Pattern not found, fix may already be applied or file structure changed');
}

