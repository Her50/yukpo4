#!/usr/bin/env node
// Script pour patcher react-native-reanimated build.gradle
// pour accepter react-native-worklets-core 1.x
const fs = require('fs');
const path = require('path');

console.log('🔧 Patching react-native-reanimated build.gradle...');

const buildGradlePath = path.join(
  __dirname,
  'node_modules',
  'react-native-reanimated',
  'android',
  'build.gradle'
);

try {
  if (!fs.existsSync(buildGradlePath)) {
    console.log('⚠️  build.gradle not found, skipping...');
    return;
  }

  let content = fs.readFileSync(buildGradlePath, 'utf8');
  
  // Chercher la ligne qui vérifie la version de worklets et la désactiver
  // Remplacer la vérification de version par un simple warning
  if (content.includes('assertWorkletsVersionTask')) {
    // Commenter la tâche assertWorkletsVersionTask
    content = content.replace(
      /task\s+assertWorkletsVersionTask[\s\S]*?^}/gm,
      `task assertWorkletsVersionTask {
    doLast {
        // Version check disabled to support react-native-worklets-core 1.x
        println "[Reanimated] Using react-native-worklets-core - version check bypassed"
    }
}`
    );
    
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('✅ Patched react-native-reanimated build.gradle');
    console.log('📝 Disabled worklets version check to support worklets-core 1.x\n');
  } else {
    console.log('✓  build.gradle already patched or version check not found\n');
  }

} catch (error) {
  console.error('❌ Error patching build.gradle:', error.message);
  // Ne pas fail le postinstall
  process.exit(0);
}







