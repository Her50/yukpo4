#!/usr/bin/env node
/**
 * Script pour corriger kotlinVersion dans expo-modules-core/android/build.gradle
 * Le problème: kotlinVersion n'est pas accessible dans le contexte du projet :android (includeBuild)
 * Solution: Utiliser findProperty('android.kotlinVersion') ou rootProject.ext.kotlinVersion
 */
const fs = require('fs');
const path = require('path');

// ✅ CORRIGÉ: Corriger les deux versions d'expo-modules-core
const expoModulesBuildGradlePaths = [
  path.join(__dirname, 'node_modules', 'expo-modules-core', 'android', 'build.gradle'),
  path.join(__dirname, 'node_modules', 'expo', 'node_modules', 'expo-modules-core', 'android', 'build.gradle')
];

// Fonction pour corriger un fichier build.gradle
function fixBuildGradle(buildGradlePath) {
  if (!fs.existsSync(buildGradlePath)) {
    return false;
  }

  let content = fs.readFileSync(buildGradlePath, 'utf8');
  const originalContent = content;
  let modified = false;

  // ✅ FIX CRITIQUE 0: SUPPRIMER le buildscript dupliqué
  // Le problème: Il y a DEUX buildscript blocks (lignes 16-38 et 50-72)
  // Gradle ne peut avoir qu'UN SEUL buildscript block
  // On garde le premier (déplacé avant apply plugin) et on supprime le deuxième
  if (content.match(/buildscript\s*\{[\s\S]*?\n\}\s*\napply plugin: 'com\.android\.library'[\s\S]*?buildscript\s*\{/)) {
    // Supprimer le deuxième buildscript (celui qui vient APRÈS apply plugin)
    content = content.replace(
      /(\}\s*\n\s*apply plugin: 'com\.android\.library'[\s\S]*?)\s*buildscript\s*\{[\s\S]*?\/\/ ✅ PATCH: Utiliser findProperty\(\) directement car project\.ext\.kotlinVersion n'existe pas encore dans buildscript[\s\S]*?\/\/ Le plugin ExpoModulesCorePlugin définit project\.ext\.kotlinVersion, mais buildscript s'exécute AVANT le plugin[\s\S]*?def kotlinVer = project\.findProperty\('android\.kotlinVersion'\) \?: "1\.9\.25"[\s\S]*?ext\.KOTLIN_MAJOR_VERSION = kotlinVer\.split\("\\\\\."\)\[0\]\.toInteger\(\)[\s\S]*?repositories\s*\{[\s\S]*?google\(\)[\s\S]*?mavenCentral\(\)[\s\S]*?\}[\s\S]*?dependencies\s*\{[\s\S]*?\/\/ ✅ CRITIQUE: Ajouter le plugin Android dans le buildscript pour qu'il soit disponible[\s\S]*?\/\/ Quand ce projet est inclus via includeBuild dans pluginManagement, il a besoin du plugin Android[\s\S]*?classpath\('com\.android\.tools\.build:gradle:8\.6\.0'\)[\s\S]*?classpath\("org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$\{kotlinVer\}"\)[\s\S]*?if \(KOTLIN_MAJOR_VERSION >= 2\) \{[\s\S]*?\/\/ ✅ CORRIGÉ: Utiliser kotlinVer au lieu de kotlinVersion[\s\S]*?classpath\("org\.jetbrains\.kotlin\.plugin\.compose:org\.jetbrains\.kotlin\.plugin\.compose\.gradle\.plugin:\$\{kotlinVer\}"\)[\s\S]*?\}[\s\S]*?\}\s*\n/,
      '$1\n'
    );
    modified = true;
  }
  
  // ✅ FIX CRITIQUE 0.5: DÉPLACER buildscript AVANT apply plugin: 'com.android.library' (si pas déjà fait)
  // LE VRAI PROBLÈME: apply plugin: 'com.android.library' est appelé AVANT le buildscript
  // Dans Gradle, le buildscript DOIT être évalué AVANT d'appliquer les plugins qui nécessitent ses dépendances
  // Quand un projet est inclus via includeBuild dans pluginManagement, Gradle essaie d'appliquer le plugin
  // immédiatement, mais le buildscript n'a pas encore été évalué, donc le plugin Android n'est pas disponible
  if (content.includes('apply plugin: \'com.android.library\'') && 
      content.includes('buildscript {') &&
      !content.includes('// ✅ CRITIQUE: buildscript déplacé AVANT apply plugin')) {
    
    // Extraire le buildscript block
    const buildscriptMatch = content.match(/(buildscript\s*\{[\s\S]*?\n\})/);
    if (buildscriptMatch) {
      const buildscriptBlock = buildscriptMatch[1];
      
      // Extraire tout ce qui est AVANT apply plugin: 'com.android.library'
      const beforeApplyMatch = content.match(/^([\s\S]*?)(apply plugin: 'com\.android\.library')/);
      if (beforeApplyMatch) {
        const beforeApply = beforeApplyMatch[1];
        const afterApply = content.substring(beforeApplyMatch[0].length);
        
        // Retirer le buildscript de sa position originale (après apply plugin)
        const contentWithoutBuildscript = content.replace(/(buildscript\s*\{[\s\S]*?\n\})/, '');
        
        // Reconstruire avec buildscript AVANT apply plugin
        content = beforeApply + `// ✅ CRITIQUE: buildscript déplacé AVANT apply plugin
// Le buildscript DOIT être évalué AVANT d'appliquer com.android.library
// Sinon, le plugin n'est pas disponible dans le classpath quand il est inclus via includeBuild
${buildscriptBlock}

apply plugin: 'com.android.library'
` + afterApply;
        modified = true;
      }
    }
  }
  
  // ✅ FIX CRITIQUE 0.5: Définir compileSdkVersion dans ext AVANT TOUT (après buildscript)
  // Le plugin expo-module-gradle-plugin accède à cette valeur lors de sa résolution
  if (!content.includes('// ✅ CRITIQUE: Définir compileSdkVersion dans ext AVANT TOUT')) {
    // Insérer ext après buildscript mais avant apply plugin
    const match = content.match(/(buildscript\s*\{[\s\S]*?\n\}\s*\n)(apply plugin:)/);
    if (match) {
      const afterBuildscript = match[1];
      const afterMatch = match[2] + content.substring(match[0].length);
      
      if (!afterBuildscript.includes('ext.compileSdkVersion')) {
        content = afterBuildscript + `// ✅ CRITIQUE: Définir compileSdkVersion dans ext AVANT apply plugin
// Le plugin expo-module-gradle-plugin accède à cette valeur lors de sa résolution
ext {
  compileSdkVersion = Integer.parseInt(project.findProperty('android.compileSdkVersion') ?: '35')
  minSdkVersion = Integer.parseInt(project.findProperty('android.minSdkVersion') ?: '24')
  targetSdkVersion = Integer.parseInt(project.findProperty('android.targetSdkVersion') ?: '35')
}

` + afterMatch;
        modified = true;
      }
    }
  }

  // ✅ FIX CRITIQUE 1: Corriger la définition de kotlinVer dans buildscript
  // Le problème: project.ext.kotlinVersion n'existe pas encore dans buildscript (le plugin n'est pas encore appliqué)
  // Solution: Utiliser findProperty() directement
  if (content.includes('def kotlinVer = project.ext.kotlinVersion ? project.ext.kotlinVersion()')) {
    content = content.replace(
      /def kotlinVer = project\.ext\.kotlinVersion \? project\.ext\.kotlinVersion\(\) : "1\.9\.25"/,
      'def kotlinVer = project.findProperty(\'android.kotlinVersion\') ?: "1.9.25"'
    );
    modified = true;
  }

  // ✅ FIX CRITIQUE 2: Ajouter le plugin Android dans le buildscript si manquant
  // Le problème: com.android.library n'est pas disponible quand le projet est inclus via includeBuild
  if (content.includes('apply plugin: \'com.android.library\'') && 
      !content.includes('classpath(\'com.android.tools.build:gradle:') &&
      content.includes('buildscript {')) {
    // Ajouter le plugin Android dans le buildscript
    const buildscriptMatch = content.match(/buildscript\s*\{[\s\S]*?dependencies\s*\{/);
    if (buildscriptMatch) {
      const buildscriptBlock = buildscriptMatch[0];
      if (!buildscriptBlock.includes('classpath(\'com.android.tools.build:gradle:')) {
        // Ajouter repositories et dependencies si manquants
        if (!buildscriptBlock.includes('repositories {')) {
          content = content.replace(
            /(buildscript\s*\{[\s\S]*?)(dependencies\s*\{)/,
            `$1  repositories {
    google()
    mavenCentral()
  }

  $2`
          );
        }
        // Ajouter le plugin Android dans dependencies
        content = content.replace(
          /(dependencies\s*\{)/,
          `$1
    // ✅ CRITIQUE: Ajouter le plugin Android dans le buildscript pour qu'il soit disponible
    // Quand ce projet est inclus via includeBuild dans pluginManagement, il a besoin du plugin Android
    classpath('com.android.tools.build:gradle:8.6.0')
    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\${kotlinVer}")`
        );
        modified = true;
      }
    }
  }

  // ✅ FIX CRITIQUE 3: Corriger ${kotlinVersion} → ${kotlinVer} dans buildscript dependencies
  // Le problème: kotlinVersion n'est pas défini dans le scope du buildscript, seulement kotlinVer
  if (content.includes('${kotlinVersion}') && content.includes('def kotlinVer =')) {
    // Remplacer ${kotlinVersion} par ${kotlinVer} dans le classpath du buildscript
    content = content.replace(
      /classpath\("org\.jetbrains\.kotlin\.plugin\.compose:org\.jetbrains\.kotlin\.plugin\.compose\.gradle\.plugin:\$\{kotlinVersion\}"\)/,
      'classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:${kotlinVer}")'
    );
    modified = true;
  }

  if (content !== originalContent) {
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log(`✅ Fixed kotlinVersion in ${path.relative(__dirname, buildGradlePath)}`);
    return true;
  }
  return false;
}

// Corriger tous les fichiers trouvés
let fixedCount = 0;
for (const buildGradlePath of expoModulesBuildGradlePaths) {
  if (fixBuildGradle(buildGradlePath)) {
    fixedCount++;
  }
}

if (fixedCount === 0) {
  console.log('⚠️  No expo-modules-core/android/build.gradle files found or already fixed');
  process.exit(0);
}

// Continuer avec les autres corrections pour la version principale seulement
const expoModulesBuildGradle = expoModulesBuildGradlePaths[0];

if (!fs.existsSync(expoModulesBuildGradle)) {
  console.log('⚠️  Main expo-modules-core/android/build.gradle not found, skipping additional fixes');
  process.exit(0);
}

let content = fs.readFileSync(expoModulesBuildGradle, 'utf8');
const originalContent = content;

// Fix 0: Définir compileSdkVersion, minSdkVersion et targetSdkVersion AU TOUT DÉBUT du fichier
// Ces valeurs doivent être disponibles AVANT que le plugin expo-module-gradle-plugin ne soit résolu
if (!content.includes('// ✅ CRITIQUE: Définir compileSdkVersion AVANT TOUT')) {
  // Ajouter après les imports mais avant buildscript
  content = content.replace(
    /(import expo\.modules\.plugin\.gradle\.ExpoModuleExtension[^\n]*\n[^\n]*\n\s*buildscript\s*\{)/,
    `import expo.modules.plugin.gradle.ExpoModuleExtension
// Note: KotlinCompile ne peut pas être importé, on utilise le nom complet

// ✅ CRITIQUE: Définir compileSdkVersion, minSdkVersion et targetSdkVersion AVANT TOUT
// Ces valeurs doivent être disponibles AVANT que le plugin expo-module-gradle-plugin ne soit résolu
// Quand ce projet est inclus via includeBuild dans pluginManagement, le plugin a besoin de ces valeurs
// NOTE: Dans ext, on garde l'entier pour compatibilité, mais dans android {} on utilisera "android-35"
def compileSdkInt = Integer.parseInt(project.findProperty('android.compileSdkVersion') ?: '35')
def compileSdkVersionString = "android-\${compileSdkInt}"
def minSdkVersionValue = Integer.parseInt(project.findProperty('android.minSdkVersion') ?: '24')
def targetSdkVersionValue = Integer.parseInt(project.findProperty('android.targetSdkVersion') ?: '35')

// Définir dans project.ext ET rootProject.ext pour que le plugin puisse y accéder
project.ext.compileSdkVersion = compileSdkInt
project.ext.compileSdkVersionString = compileSdkVersionString
project.ext.minSdkVersion = minSdkVersionValue
project.ext.targetSdkVersion = targetSdkVersionValue

// ✅ CRITIQUE: Définir KOTLIN_MAJOR_VERSION pour expo-module-gradle-plugin
// Le plugin utilise cette propriété pour déterminer la version majeure de Kotlin
def kotlinVersionForMajor = project.findProperty('android.kotlinVersion') ?: '1.9.25'
def kotlinMajorVersion = kotlinVersionForMajor.split('\\.')[0]
project.ext.KOTLIN_MAJOR_VERSION = kotlinMajorVersion

// Pour un projet includeBuild, rootProject est le projet lui-même
if (project == project.rootProject) {
  project.rootProject.ext.compileSdkVersion = compileSdkInt
  project.rootProject.ext.compileSdkVersionString = compileSdkVersionString
  project.rootProject.ext.minSdkVersion = minSdkVersionValue
  project.rootProject.ext.targetSdkVersion = targetSdkVersionValue
  project.rootProject.ext.KOTLIN_MAJOR_VERSION = kotlinMajorVersion
}

buildscript {`
  );
  
  // Supprimer les définitions en double si elles existent après expoModule
  // Pattern pour supprimer les définitions dupliquées de compileSdkVersion/minSdkVersion/targetSdkVersion
  content = content.replace(
    /\/\/ ✅ CRITIQUE: Définir compileSdkVersion AVANT le bloc android[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n\s*android\s*\{\s*\n\s*android\s*\{/,
    'android {'
  );
  
  // Supprimer aussi les définitions ext.compileSdkVersion dupliquées après expoModule
  content = content.replace(
    /(expoModule\s*\{[^\}]*canBePublished[^\}]*\}\s*\n)\s*\/\/ ✅ CRITIQUE: Définir compileSdkVersion AVANT le bloc android[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n\s*android\s*\{/,
    '$1android {'
  );
  
  // Fix supplémentaire: S'assurer que KOTLIN_MAJOR_VERSION est défini dans project.ext
  // Le plugin y accède via project.ext.KOTLIN_MAJOR_VERSION
  if (!content.includes('project.ext.KOTLIN_MAJOR_VERSION')) {
    // Chercher la section où on définit project.ext.compileSdkVersion
    const projectExtPattern = /(project\.ext\.targetSdkVersion = targetSdkVersionValue\s*\n)/;
    if (projectExtPattern.test(content)) {
      content = content.replace(
        projectExtPattern,
        `$1
// ✅ CRITIQUE: Définir KOTLIN_MAJOR_VERSION pour expo-module-gradle-plugin
// Le plugin utilise cette propriété pour déterminer la version majeure de Kotlin
def kotlinVersionForMajor = project.findProperty('android.kotlinVersion') ?: '1.9.25'
def kotlinMajorVersion = kotlinVersionForMajor.split('\\.')[0]
project.ext.KOTLIN_MAJOR_VERSION = kotlinMajorVersion

`
      );
    }
  }
}

// Fix 1: Dans buildscript, définir kotlinVersion AVANT son utilisation
// Le buildscript s'exécute AVANT que le plugin ne soit appliqué, donc on ne peut pas utiliser project.ext.kotlinVersion()
if (content.includes('${kotlinVersion}') && !content.includes('// ✅ CORRIGÉ: kotlinVersion dans buildscript')) {
  // Trouver le buildscript block existant et le remplacer proprement
  const buildscriptMatch = content.match(/buildscript\s*\{[\s\S]*?\n\}/);
  if (buildscriptMatch) {
    const oldBuildscript = buildscriptMatch[0];
    const newBuildscript = `buildscript {
  // List of features that are required by linked modules
  def coreFeatures = project.findProperty("coreFeatures") ?: []
  ext.shouldIncludeCompose = coreFeatures.contains("compose")

  // ✅ CORRIGÉ: Définir kotlinVersion directement dans buildscript
  // On ne peut pas utiliser project.ext.kotlinVersion() car le plugin n'est pas encore appliqué
  // On lit depuis gradle.properties (android.kotlinVersion) ou on utilise la valeur par défaut
  def kotlinVersion = '1.9.25'  // Valeur par défaut
  try {
    // Essayer de lire depuis gradle.properties
    if (project.hasProperty('android.kotlinVersion')) {
      kotlinVersion = project.property('android.kotlinVersion')
    } else if (project.rootProject.hasProperty('ext') && project.rootProject.ext.hasProperty('kotlinVersion')) {
      kotlinVersion = project.rootProject.ext.kotlinVersion
    }
  } catch (Exception e) {
    // Si ça échoue, utiliser la valeur par défaut
    kotlinVersion = '1.9.25'
  }

  repositories {
    google()
    mavenCentral()
  }

  dependencies {
    // ✅ CRITIQUE: Ajouter le plugin Android dans le buildscript pour qu'il soit disponible
    // Quand ce projet est inclus via includeBuild dans pluginManagement, il a besoin du plugin Android
    classpath('com.android.tools.build:gradle:8.6.0')
    if (shouldIncludeCompose) {
      classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:\${kotlinVersion}")
    }
  }
}`;
    content = content.replace(oldBuildscript, newBuildscript);
  }

  // Fix dans dependencies - ajouter kotlinVersion avant dependencies {}
  if (content.includes('implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:${kotlinVersion}"') && !content.includes('// ✅ CORRIGÉ: Définir kotlinVersion pour être accessible dans dependencies')) {
    content = content.replace(
      /(\}\s*\n\s*dependencies\s*\{)/,
      `}

// ✅ CORRIGÉ: Définir kotlinVersion pour être accessible dans dependencies
def kotlinVersion = project.findProperty('android.kotlinVersion') 
  ?: (project.rootProject.hasProperty('ext') && project.rootProject.ext.hasProperty('kotlinVersion') 
      ? project.rootProject.ext.kotlinVersion 
      : '1.9.25')

dependencies {`
    );
  }

  // Fix 2: Supprimer l'import KotlinCompile et utiliser le nom complet de la classe
  // Gradle évalue tous les imports au début, donc on ne peut pas importer KotlinCompile
  // On doit utiliser le nom complet org.jetbrains.kotlin.gradle.tasks.KotlinCompile dans le code
  content = content.replace(/^import org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinCompile\s*\n/m, '');
  content = content.replace(/\/\/ Note: KotlinCompile[^\n]*\n/g, '// Note: KotlinCompile ne peut pas être importé, on utilise le nom complet\n');
  
  // S'assurer que kotlin-android est appliqué
  if (content.includes('apply plugin: \'expo-module-gradle-plugin\'')) {
    if (!content.includes('apply plugin: \'kotlin-android\'')) {
      // Ajouter kotlin-android après expo-module-gradle-plugin
      content = content.replace(
        /(apply plugin: 'expo-module-gradle-plugin'\s*\n)/,
        `$1apply plugin: 'kotlin-android'\n\n`
      );
    }
  }
  
  // Remplacer KotlinCompile par le nom complet dans le code
  content = content.replace(
    /tasks\.withType\(KotlinCompile\)/g,
    'tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile)'
  );
  
  // Fix 3: Définir compileSdkVersion, minSdkVersion et targetSdkVersion DANS le bloc android
  // Le plugin Android a besoin de ces valeurs pour configurer le projet
  // On doit les définir dans le bloc android {} en plus de ext pour que le plugin les trouve
  const hasCompileSdkInAndroid = content.includes('compileSdkVersion') && 
                                  (content.includes('project.ext.compileSdkVersion') || 
                                   content.includes('project.ext.compileSdkVersionString') ||
                                   content.includes('compileSdkVersion "android-'));
  const hasMinSdkInDefaultConfig = content.includes('minSdkVersion project.ext.minSdkVersion');
  
  if (content.includes('android {') && !hasCompileSdkInAndroid) {
    // Trouver le bloc android et ajouter compileSdkVersion au début
    // Chercher le pattern "android {" suivi de "if (rootProject.hasProperty" ou directement d'autres propriétés
    const androidBlockPattern = /(android\s*\{[\s\n]*)(\s*if\s*\(rootProject\.hasProperty\("ndkPath"\)\)|\s*namespace|\s*defaultConfig)/;
    if (androidBlockPattern.test(content)) {
      content = content.replace(
        androidBlockPattern,
        `$1  // ✅ CRITIQUE: Définir compileSdkVersion, minSdkVersion et targetSdkVersion dans le bloc android
  // Le plugin Android a besoin de ces valeurs pour configurer le projet
  // FORMAT: compileSdkVersion doit être une chaîne "android-35" pour AGP 8.6.0+
  compileSdkVersion project.ext.compileSdkVersionString ?: "android-35"
  
$2`
      );
    } else {
      // Fallback: insérer juste après "android {"
      content = content.replace(
        /(android\s*\{)/,
        `$1
  // ✅ CRITIQUE: Définir compileSdkVersion, minSdkVersion et targetSdkVersion dans le bloc android
  // Le plugin Android a besoin de ces valeurs pour configurer le projet
  // FORMAT: compileSdkVersion doit être une chaîne "android-35" pour AGP 8.6.0+
  compileSdkVersion project.ext.compileSdkVersionString ?: "android-35"
`
      );
    }
  }
  
  // Ajouter minSdkVersion et targetSdkVersion dans defaultConfig
  if (content.includes('defaultConfig {') && !hasMinSdkInDefaultConfig) {
    content = content.replace(
      /(defaultConfig\s*\{\s*\n)(\s*consumerProguardFiles)/,
      `$1    minSdkVersion project.ext.minSdkVersion ?: 24
    targetSdkVersion project.ext.targetSdkVersion ?: 35
$2`
    );
  }
  
  // Supprimer les duplications de compileSdkVersion après expoModule
  content = content.replace(
    /(expoModule\s*\{[^\}]*canBePublished[^\}]*\}\s*\n)\s*\/\/ ✅ CRITIQUE: Définir compileSdkVersion AVANT le bloc android[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n\s*android\s*\{/,
    '$1android {'
  );
  
  // Supprimer les blocs android {} dupliqués
  content = content.replace(/\n\s*android\s*\{\s*\n\s*android\s*\{/g, '\nandroid {');
  
  // Fix 4: Corriger la syntaxe du try-catch si nécessaire
  // Le catch doit être après le try, pas dans le else if
  content = content.replace(
    /(\s+} else if[^}]+kotlinVersion[^}]+)\s+} catch \(Exception e\) \{/g,
    '$1\n  } catch (Exception e) {'
  );
  
  // Fix 5: S'assurer que toutes les accolades sont correctement fermées
  // Compter les accolades ouvrantes et fermantes dans le bloc buildscript
  const buildscriptStart = content.indexOf('buildscript {');
  if (buildscriptStart !== -1) {
    const buildscriptEnd = content.indexOf('\n}\n', buildscriptStart);
    if (buildscriptEnd !== -1) {
      const buildscriptBlock = content.substring(buildscriptStart, buildscriptEnd + 3);
      const openBraces = (buildscriptBlock.match(/\{/g) || []).length;
      const closeBraces = (buildscriptBlock.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        console.log(`⚠️  Accolades déséquilibrées dans buildscript: ${openBraces} ouvertes, ${closeBraces} fermées`);
      }
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(expoModulesBuildGradle, content, 'utf8');
    console.log('✅ Fixed kotlinVersion and KotlinCompile import in expo-modules-core/android/build.gradle');
  } else {
    console.log('⚠️  Pattern not found or already fixed');
  }
} else {
  console.log('✅ kotlinVersion already fixed or not found');
}

