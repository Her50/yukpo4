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

// Vérifier si les plugins Android et Kotlin sont déjà dans le buildscript ET que le buildscript est avant l'import
const hasAndroidPlugin = buildGradleContent.includes('classpath("com.android.tools.build:gradle') || 
    buildGradleContent.includes("classpath('com.android.tools.build:gradle");
const hasKotlinPlugin = buildGradleContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin') || 
    buildGradleContent.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin");
const hasKotlinImport = buildGradleContent.includes('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');
const buildscriptIndex = buildGradleContent.indexOf('buildscript');
const importIndex = buildGradleContent.indexOf('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');

if (hasAndroidPlugin && hasKotlinPlugin && (!hasKotlinImport || (buildscriptIndex !== -1 && importIndex !== -1 && buildscriptIndex < importIndex))) {
    console.log('✅ Android and Kotlin plugins already present in buildscript and correctly positioned');
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
    
    // Créer le buildscript avec le plugin Kotlin et Android AVANT les imports
    // + un bloc ext au niveau du projet pour que les propriétés soient accessibles dans android {}
    const buildscript = `buildscript {
    ext {
        kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: '1.9.25'
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.6.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\$kotlinVersion")
    }
}

ext {
    buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
    minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
    compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
    targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')
}

`;
    
    buildGradleContent = buildscript + imports + restOfFile;
    console.log('✅ Buildscript added before imports');
} else if (buildGradleContent.includes('buildscript') && buildscriptIndex !== -1 && (importIndex === -1 || buildscriptIndex < importIndex)) {
    // Le buildscript existe et est avant l'import (ou pas d'import), ajouter le plugin Kotlin dedans
    console.log('🔧 Adding Kotlin plugin to existing buildscript...');
    
    // Vérifier si le buildscript a un bloc ext avec toutes les propriétés nécessaires
    const buildscriptBlock = buildGradleContent.substring(buildscriptIndex);
    const buildscriptEnd = buildscriptBlock.indexOf('}') + 1; // Trouver la fin du bloc buildscript
    const buildscriptContent = buildGradleContent.substring(buildscriptIndex, buildscriptIndex + buildscriptEnd);
    
    if (!buildscriptContent.includes('kotlinVersion') || !buildscriptContent.includes('compileSdkVersion')) {
        // Ajouter ou mettre à jour ext avec toutes les propriétés nécessaires
        if (buildscriptContent.includes('ext {')) {
            // Mettre à jour le bloc ext existant
            if (!buildscriptContent.includes('kotlinVersion')) {
                buildGradleContent = buildGradleContent.replace(
                    /(buildscript\s*\{[^}]*ext\s*\{)/s,
                    `$1
        kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: '1.9.25'`
                );
            }
            if (!buildscriptContent.includes('compileSdkVersion')) {
                buildGradleContent = buildGradleContent.replace(
                    /(buildscript\s*\{[^}]*ext\s*\{[^}]*kotlinVersion[^}]*)/s,
                    `$1
        buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
        minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
        compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
        targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')`
                );
            }
        } else {
            // Ajouter un nouveau bloc ext dans buildscript (pour kotlinVersion seulement)
            buildGradleContent = buildGradleContent.replace(
                /(buildscript\s*\{)/s,
                `$1
    ext {
        kotlinVersion = findProperty('kotlinVersion') ?: findProperty('android.kotlinVersion') ?: '1.9.25'
    }`
            );
        }
        
        // S'assurer qu'un bloc ext au niveau du projet existe (après buildscript)
        if (!buildGradleContent.match(/buildscript\s*\{[^}]*\}\s*\n\s*ext\s*\{/s)) {
            // Trouver la fin du buildscript et ajouter ext après
            const buildscriptEndMatch = buildGradleContent.match(/buildscript\s*\{[^}]*\}/s);
            if (buildscriptEndMatch) {
                const insertIndex = buildscriptEndMatch.index + buildscriptEndMatch[0].length;
                const extBlock = `

ext {
    buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
    minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
    compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
    targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')
}

`;
                buildGradleContent = buildGradleContent.slice(0, insertIndex) + extBlock + buildGradleContent.slice(insertIndex);
                console.log('✅ Added ext block at project level for Android SDK properties');
            }
        }
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
    
    // Ajouter les plugins Android et Kotlin dans dependencies
    if (buildGradleContent.match(/buildscript\s*\{[^}]*dependencies\s*\{/s)) {
        // dependencies existe déjà
        let depsToAdd = [];
        if (!buildGradleContent.match(/buildscript\s*\{[^}]*dependencies\s*\{[^}]*com\.android\.tools\.build:gradle/s)) {
            depsToAdd.push('        classpath("com.android.tools.build:gradle:8.6.0")');
        }
        if (!buildGradleContent.match(/buildscript\s*\{[^}]*dependencies\s*\{[^}]*kotlin-gradle-plugin/s)) {
            depsToAdd.push('        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")');
        }
        if (depsToAdd.length > 0) {
            buildGradleContent = buildGradleContent.replace(
                /(buildscript\s*\{[^}]*dependencies\s*\{)/s,
                `$1
${depsToAdd.join('\n')}`
            );
        }
    } else {
        // Ajouter dependencies après repositories
        buildGradleContent = buildGradleContent.replace(
            /(buildscript\s*\{[^}]*repositories\s*\{[^}]*\})/s,
            `$1
    dependencies {
        classpath("com.android.tools.build:gradle:8.6.0")
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
        buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
        minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
        compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
        targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.6.0")
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

// S'assurer qu'un bloc ext au niveau du projet existe (après buildscript, avant android)
// Ce bloc doit contenir les propriétés Android SDK accessibles dans android {}
if (!buildGradleContent.match(/buildscript\s*\{[^}]*\}\s*\n\s*ext\s*\{[^}]*compileSdkVersion/s)) {
    // Trouver la fin du buildscript et ajouter ext après
    const buildscriptEndMatch = buildGradleContent.match(/buildscript\s*\{[^}]*\}/s);
    if (buildscriptEndMatch) {
        const insertIndex = buildscriptEndMatch.index + buildscriptEndMatch[0].length;
        // Vérifier s'il y a déjà un ext mais sans compileSdkVersion
        const afterBuildscript = buildGradleContent.substring(insertIndex);
        if (afterBuildscript.match(/^\s*ext\s*\{/)) {
            // Mettre à jour le bloc ext existant
            buildGradleContent = buildGradleContent.replace(
                /(buildscript\s*\{[^}]*\}\s*\n\s*ext\s*\{)/s,
                `$1
    buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
    minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
    compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
    targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')`
            );
        } else {
            // Ajouter un nouveau bloc ext
            const extBlock = `

ext {
    buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
    minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
    compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
    targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')
}

`;
            buildGradleContent = buildGradleContent.slice(0, insertIndex) + extBlock + buildGradleContent.slice(insertIndex);
        }
        console.log('✅ Added/updated ext block at project level for Android SDK properties');
    }
}

// Après avoir ajouté le buildscript, vérifier et ajouter/modifier le bloc android
if (buildGradleContent.includes('android {')) {
    console.log('🔧 Found android block, ensuring compileSdkVersion is set...');
    
    // Vérifier si compileSdkVersion est déjà dans le bloc android
    const androidBlockMatch = buildGradleContent.match(/android\s*\{[^}]*\}/s);
    if (androidBlockMatch) {
        const androidBlock = androidBlockMatch[0];
        if (!androidBlock.includes('compileSdkVersion')) {
            // Ajouter compileSdkVersion dans le bloc android
            // Utiliser directement les valeurs depuis ext (défini au niveau du projet)
            buildGradleContent = buildGradleContent.replace(
                /(android\s*\{)/s,
                `$1
    compileSdkVersion ext.compileSdkVersion
    buildToolsVersion ext.buildToolsVersion
    
    defaultConfig {
        minSdkVersion ext.minSdkVersion
        targetSdkVersion ext.targetSdkVersion
    }`
            );
            console.log('✅ Added compileSdkVersion and defaultConfig to android block');
        } else if (!androidBlock.includes('defaultConfig')) {
            // compileSdkVersion existe mais pas defaultConfig
            buildGradleContent = buildGradleContent.replace(
                /(android\s*\{[^}]*compileSdkVersion[^}]*)/s,
                `$1
    
    defaultConfig {
        minSdkVersion ext.minSdkVersion
        targetSdkVersion ext.targetSdkVersion
    }`
            );
            console.log('✅ Added defaultConfig to android block');
        }
    }
} else if (buildGradleContent.includes('apply plugin') && buildGradleContent.includes('com.android.library')) {
    // Le plugin android est appliqué mais pas de bloc android, l'ajouter
    console.log('🔧 Plugin android found but no android block, adding it...');
    // Trouver où insérer le bloc android (après les apply plugin)
    const applyPluginMatch = buildGradleContent.match(/(apply\s+plugin[^\n]+\n)+/);
    if (applyPluginMatch) {
        const insertIndex = applyPluginMatch.index + applyPluginMatch[0].length;
        const androidBlock = `
android {
    compileSdkVersion ext.compileSdkVersion
    buildToolsVersion ext.buildToolsVersion
    
    defaultConfig {
        minSdkVersion ext.minSdkVersion
        targetSdkVersion ext.targetSdkVersion
    }
}
`;
        buildGradleContent = buildGradleContent.slice(0, insertIndex) + androidBlock + buildGradleContent.slice(insertIndex);
        console.log('✅ Added android block with compileSdkVersion');
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
    const finalAndroidPlugin = finalContent.includes('classpath("com.android.tools.build:gradle') || 
        finalContent.includes("classpath('com.android.tools.build:gradle");
    const finalKotlinPlugin = finalContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin') || 
        finalContent.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin");
    
    console.log(`   Final buildscript index: ${finalBuildscriptIndex}`);
    console.log(`   Final import index: ${finalImportIndex}`);
    console.log(`   Android plugin present: ${finalAndroidPlugin}`);
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
    } else if (!finalAndroidPlugin) {
        console.log('❌ ERROR: Android plugin not found in buildscript after fix!');
        console.log('   This will cause the build to fail.');
        process.exit(1);
    } else if (!finalKotlinPlugin) {
        console.log('❌ ERROR: Kotlin plugin not found in buildscript after fix!');
        console.log('   This will cause the build to fail.');
        process.exit(1);
    } else {
        console.log('✅ Buildscript is correctly positioned before imports');
        console.log('✅ Android plugin is present in buildscript');
        console.log('✅ Kotlin plugin is present in buildscript');
        console.log('✅ Fix applied successfully!');
    }
} else {
    console.log('⚠️ No changes made to build.gradle');
    // Vérifier quand même si le problème persiste
    if (buildGradleContent.includes('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile')) {
        const hasAndroidPlugin = buildGradleContent.includes('classpath("com.android.tools.build:gradle') || 
            buildGradleContent.includes("classpath('com.android.tools.build:gradle");
        const hasKotlinPlugin = buildGradleContent.includes('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin') || 
            buildGradleContent.includes("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin");
        const bsIndex = buildGradleContent.indexOf('buildscript');
        const impIndex = buildGradleContent.indexOf('import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');
        
        if (!hasAndroidPlugin || !hasKotlinPlugin || (bsIndex === -1) || (impIndex !== -1 && impIndex < bsIndex)) {
            console.log('❌ ERROR: KotlinCompile import found but fix not applied!');
            console.log(`   Has Android plugin: ${hasAndroidPlugin}`);
            console.log(`   Has Kotlin plugin: ${hasKotlinPlugin}`);
            console.log(`   Buildscript index: ${bsIndex}`);
            console.log(`   Import index: ${impIndex}`);
            console.log('   This will cause the build to fail.');
            console.log('   First 500 chars of file:');
            console.log(buildGradleContent.substring(0, 500));
            process.exit(1);
        } else {
            console.log('✅ File already correctly configured with both Android and Kotlin plugins');
        }
    } else {
        console.log('✅ No KotlinCompile import found, file should be OK');
    }
}

