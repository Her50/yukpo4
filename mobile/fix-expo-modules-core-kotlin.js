#!/usr/bin/env node
// Script pour ajouter le plugin Kotlin dans le buildscript de expo-modules-core/android/build.gradle
const fs = require('fs');
const path = require('path');

const expoModulesCoreAndroid = path.join(__dirname, 'node_modules', 'expo-modules-core', 'android');
const buildGradlePath = path.join(expoModulesCoreAndroid, 'build.gradle');

if (!fs.existsSync(buildGradlePath)) {
    console.log('⚠️ expo-modules-core/android/build.gradle not found');
    process.exit(0);
}

let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
const originalContent = buildGradleContent;

// Vérifier si le plugin Kotlin est déjà dans le buildscript
if (buildGradleContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin') || 
    buildGradleContent.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin")) {
    console.log('✅ Kotlin plugin already present in buildscript');
    // Vérifier aussi si le buildscript existe et est correctement configuré
    if (!buildGradleContent.includes('buildscript')) {
        console.log('⚠️ No buildscript found, but Kotlin plugin reference exists. This may cause issues.');
    }
    process.exit(0);
}

// Vérifier si le fichier commence par un import KotlinCompile (c'est le problème)
const hasKotlinImport = /^import\s+org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinCompile/m.test(buildGradleContent);

if (hasKotlinImport && !buildGradleContent.includes('buildscript')) {
    console.log('🔧 Found KotlinCompile import but no buildscript. Adding buildscript before imports...');
    
    // Extraire tous les imports au début du fichier
    const importLines = [];
    const lines = buildGradleContent.split('\n');
    let i = 0;
    while (i < lines.length && /^\s*import\s+/.test(lines[i])) {
        importLines.push(lines[i]);
        i++;
    }
    const imports = importLines.length > 0 ? importLines.join('\n') + '\n' : '';
    const restOfFile = lines.slice(i).join('\n');
    
    // Créer le buildscript avec le plugin Kotlin AVANT les imports
    const buildscript = `buildscript {
    ext {
        kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: '1.9.25'
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\$kotlinVersion")
    }
}

`;
    
    buildGradleContent = buildscript + imports + restOfFile;
} else if (buildGradleContent.includes('buildscript')) {
    // Le buildscript existe, ajouter le plugin Kotlin dedans
    console.log('🔧 Adding Kotlin plugin to existing buildscript...');
    
    // Vérifier si le buildscript a un bloc ext pour kotlinVersion
    if (!buildGradleContent.includes('ext {') || !buildGradleContent.match(/ext\s*\{[^}]*kotlinVersion/s)) {
        // Ajouter ext avec kotlinVersion dans le buildscript
        buildGradleContent = buildGradleContent.replace(
            /(buildscript\s*\{)/s,
            `$1
    ext {
        kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: '1.9.25'
    }`
        );
    }
    
    // Vérifier si repositories existe dans buildscript
    if (!buildGradleContent.match(/buildscript\s*\{[^}]*repositories\s*\{/s)) {
        // Ajouter repositories après ext
        buildGradleContent = buildGradleContent.replace(
            /(buildscript\s*\{[^}]*ext\s*\{[^}]*\})/s,
            `$1
    repositories {
        google()
        mavenCentral()
    }`
        );
    }
    
    // Ajouter le plugin Kotlin dans dependencies
    if (buildGradleContent.match(/buildscript\s*\{[^}]*dependencies\s*\{/s)) {
        // dependencies existe déjà
        if (!buildGradleContent.match(/buildscript\s*\{[^}]*dependencies\s*\{[^}]*kotlin-gradle-plugin/s)) {
            buildGradleContent = buildGradleContent.replace(
                /(buildscript\s*\{[^}]*dependencies\s*\{)/s,
                `$1
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\$kotlinVersion")`
            );
        }
    } else {
        // Ajouter dependencies après repositories
        buildGradleContent = buildGradleContent.replace(
            /(buildscript\s*\{[^}]*repositories\s*\{[^}]*\})/s,
            `$1
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\$kotlinVersion")
    }`
        );
    }
} else {
    // Pas de buildscript, pas d'import - ajouter le buildscript au début
    console.log('🔧 No buildscript found. Adding buildscript at the beginning...');
    const buildscript = `buildscript {
    ext {
        kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: '1.9.25'
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\$kotlinVersion")
    }
}

`;
    buildGradleContent = buildscript + buildGradleContent;
}

if (buildGradleContent !== originalContent) {
    fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');
    console.log('✅ Kotlin plugin added to expo-modules-core/android/build.gradle');
    
    // Vérifier que le buildscript est bien avant les imports
    const finalContent = fs.readFileSync(buildGradlePath, 'utf8');
    const buildscriptIndex = finalContent.indexOf('buildscript');
    const importIndex = finalContent.indexOf('import org.jetbrains.kotlin');
    
    if (importIndex !== -1 && buildscriptIndex !== -1 && importIndex < buildscriptIndex) {
        console.log('⚠️ WARNING: Import found before buildscript. This may cause issues.');
        console.log('   Consider moving imports after buildscript or using fully qualified class names.');
    } else if (importIndex !== -1 && buildscriptIndex === -1) {
        console.log('⚠️ WARNING: Import found but no buildscript. This will cause build failures.');
    } else {
        console.log('✅ Buildscript is correctly positioned before imports (if any)');
    }
} else {
    console.log('⚠️ No changes made to build.gradle');
    // Vérifier quand même si le problème persiste
    if (buildGradleContent.includes('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile') && 
        !buildGradleContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin')) {
        console.log('❌ ERROR: KotlinCompile import found but Kotlin plugin not in buildscript!');
        console.log('   This will cause the build to fail.');
        process.exit(1);
    }
}

