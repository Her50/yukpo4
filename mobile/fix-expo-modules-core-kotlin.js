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

console.log('📄 Reading expo-modules-core/android/build.gradle...');
console.log(`   File size: ${buildGradleContent.length} characters`);
console.log(`   First 200 chars: ${buildGradleContent.substring(0, 200)}`);

// Vérifier si le plugin Kotlin est déjà dans le buildscript ET que le buildscript est avant l'import
const hasKotlinPlugin = buildGradleContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin') || 
    buildGradleContent.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin");
const hasKotlinImport = buildGradleContent.includes('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');
const buildscriptIndex = buildGradleContent.indexOf('buildscript');
const importIndex = buildGradleContent.indexOf('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');

if (hasKotlinPlugin && (!hasKotlinImport || (buildscriptIndex !== -1 && importIndex !== -1 && buildscriptIndex < importIndex))) {
    console.log('✅ Kotlin plugin already present in buildscript and correctly positioned');
    process.exit(0);
}

// Si l'import existe et est avant le buildscript (ou pas de buildscript), on doit corriger
if (hasKotlinImport && (buildscriptIndex === -1 || importIndex < buildscriptIndex)) {
    console.log('🔧 CRITICAL: Found KotlinCompile import before buildscript. Fixing...');
    console.log(`   Import at index: ${importIndex}`);
    console.log(`   Buildscript at index: ${buildscriptIndex}`);
    
    // Extraire tous les imports au début du fichier (peuvent être sur plusieurs lignes)
    const lines = buildGradleContent.split('\n');
    const importLines = [];
    let i = 0;
    // Collecter tous les imports consécutifs au début
    while (i < lines.length && /^\s*import\s+/.test(lines[i])) {
        importLines.push(lines[i]);
        i++;
    }
    // Ignorer les lignes vides après les imports
    while (i < lines.length && /^\s*$/.test(lines[i])) {
        i++;
    }
    
    const imports = importLines.length > 0 ? importLines.join('\n') + '\n\n' : '';
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
    console.log('✅ Buildscript added before imports');
} else if (buildGradleContent.includes('buildscript') && buildscriptIndex !== -1 && (importIndex === -1 || buildscriptIndex < importIndex)) {
    // Le buildscript existe et est avant l'import (ou pas d'import), ajouter le plugin Kotlin dedans
    console.log('🔧 Adding Kotlin plugin to existing buildscript...');
    
    // Vérifier si le buildscript a un bloc ext pour kotlinVersion
    const buildscriptBlock = buildGradleContent.substring(buildscriptIndex);
    const buildscriptEnd = buildscriptBlock.indexOf('}') + 1; // Trouver la fin du bloc buildscript
    const buildscriptContent = buildGradleContent.substring(buildscriptIndex, buildscriptIndex + buildscriptEnd);
    
    if (!buildscriptContent.includes('kotlinVersion')) {
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
        // Ajouter repositories après ext ou au début du buildscript
        if (buildGradleContent.match(/buildscript\s*\{[^}]*ext\s*\{[^}]*\}/s)) {
            buildGradleContent = buildGradleContent.replace(
                /(buildscript\s*\{[^}]*ext\s*\{[^}]*\})/s,
                `$1
    repositories {
        google()
        mavenCentral()
    }`
            );
        } else {
            buildGradleContent = buildGradleContent.replace(
                /(buildscript\s*\{)/s,
                `$1
    repositories {
        google()
        mavenCentral()
    }`
            );
        }
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
    // Pas de buildscript, ou buildscript après l'import - ajouter le buildscript au début
    console.log('🔧 No buildscript found (or buildscript after import). Adding buildscript at the beginning...');
    
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
    
    // Si l'import existe, l'extraire d'abord
    if (hasKotlinImport) {
        const lines = buildGradleContent.split('\n');
        const importLines = [];
        let i = 0;
        while (i < lines.length && /^\s*import\s+/.test(lines[i])) {
            importLines.push(lines[i]);
            i++;
        }
        while (i < lines.length && /^\s*$/.test(lines[i])) {
            i++;
        }
        const imports = importLines.length > 0 ? importLines.join('\n') + '\n\n' : '';
        const restOfFile = lines.slice(i).join('\n');
        buildGradleContent = buildscript + imports + restOfFile;
    } else {
        buildGradleContent = buildscript + buildGradleContent;
    }
}

if (buildGradleContent !== originalContent) {
    fs.writeFileSync(buildGradlePath, buildGradleContent, 'utf8');
    console.log('✅ Kotlin plugin added to expo-modules-core/android/build.gradle');
    console.log(`   File modified: ${buildGradlePath}`);
    
    // Vérifier que le buildscript est bien avant les imports
    const finalContent = fs.readFileSync(buildGradlePath, 'utf8');
    const finalBuildscriptIndex = finalContent.indexOf('buildscript');
    const finalImportIndex = finalContent.indexOf('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');
    const finalKotlinPlugin = finalContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin') || 
        finalContent.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin");
    
    console.log(`   Final buildscript index: ${finalBuildscriptIndex}`);
    console.log(`   Final import index: ${finalImportIndex}`);
    console.log(`   Kotlin plugin present: ${finalKotlinPlugin}`);
    
    if (finalImportIndex !== -1 && finalBuildscriptIndex !== -1 && finalImportIndex < finalBuildscriptIndex) {
        console.log('❌ ERROR: Import still found before buildscript after fix!');
        console.log('   This will cause the build to fail.');
        console.log('   First 500 chars of file:');
        console.log(finalContent.substring(0, 500));
        process.exit(1);
    } else if (finalImportIndex !== -1 && finalBuildscriptIndex === -1) {
        console.log('❌ ERROR: Import found but no buildscript after fix!');
        console.log('   This will cause the build to fail.');
        process.exit(1);
    } else if (!finalKotlinPlugin) {
        console.log('❌ ERROR: Kotlin plugin not found in buildscript after fix!');
        console.log('   This will cause the build to fail.');
        process.exit(1);
    } else {
        console.log('✅ Buildscript is correctly positioned before imports');
        console.log('✅ Kotlin plugin is present in buildscript');
        console.log('✅ Fix applied successfully!');
    }
} else {
    console.log('⚠️ No changes made to build.gradle');
    // Vérifier quand même si le problème persiste
    if (buildGradleContent.includes('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile')) {
        const hasPlugin = buildGradleContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin') || 
            buildGradleContent.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin");
        const bsIndex = buildGradleContent.indexOf('buildscript');
        const impIndex = buildGradleContent.indexOf('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');
        
        if (!hasPlugin || (bsIndex === -1) || (impIndex !== -1 && impIndex < bsIndex)) {
            console.log('❌ ERROR: KotlinCompile import found but fix not applied!');
            console.log(`   Has plugin: ${hasPlugin}`);
            console.log(`   Buildscript index: ${bsIndex}`);
            console.log(`   Import index: ${impIndex}`);
            console.log('   This will cause the build to fail.');
            console.log('   First 500 chars of file:');
            console.log(buildGradleContent.substring(0, 500));
            process.exit(1);
        } else {
            console.log('✅ File already correctly configured');
        }
    } else {
        console.log('✅ No KotlinCompile import found, file should be OK');
    }
}

