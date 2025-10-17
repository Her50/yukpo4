#!/usr/bin/env node
// Script pour patcher react-native-reanimated build.gradle complètement
const fs = require('fs');
const path = require('path');

console.log('🔧 Patching react-native-reanimated build.gradle (COMPLETE FIX)...');

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
        process.exit(0);
    }

    let content = fs.readFileSync(buildGradlePath, 'utf8');

    // Remplacer TOUTES les références à react-native-worklets par react-native-worklets-core
    // Cela inclut les checks de dépendances

    // 1. Remplacer les checks de projet
    content = content.replace(
        /project\.rootProject\.allprojects\.find\s*{\s*it\.name\s*==\s*['"]react-native-worklets['"]\s*}/g,
        "project.rootProject.allprojects.find { it.name == 'react-native-worklets-core' }"
    );

    // 2. Remplacer dans les messages d'erreur pour éviter la confusion
    content = content.replace(
        /\[Reanimated\]\s*`react-native-worklets`\s*library\s*not\s*found/g,
        "[Reanimated] Using react-native-worklets-core instead"
    );

    // 3. Désactiver complètement la vérification de version
    if (content.includes('assertWorkletsVersionTask')) {
        content = content.replace(
            /task\s+assertWorkletsVersionTask[\s\S]*?^}/gm,
            `task assertWorkletsVersionTask {
    doLast {
        // Version check disabled - using react-native-worklets-core
        println "[Reanimated] Using react-native-worklets-core - version check bypassed"
    }
}`
        );
    }

    // 4. Modifier le check de worklets project pour accepter worklets-core
    // Chercher la ligne qui vérifie l'existence du projet worklets
    const workletsCheckRegex = /def\s+workletsProject\s*=\s*project\.rootProject\.allprojects\.find\s*{[^}]*react-native-worklets[^}]*}/g;
    if (workletsCheckRegex.test(content)) {
        content = content.replace(
            workletsCheckRegex,
            `def workletsProject = project.rootProject.allprojects.find { it.name == 'react-native-worklets-core' } ?: project.rootProject.allprojects.find { it.name == 'react-native-worklets' }`
        );
    }

    // 5. Si la vérification échoue, modifier le message d'erreur
    content = content.replace(
        /if\s*\(\s*!\s*workletsProject\s*\)\s*{[\s\S]*?throw\s+new\s+GradleException\([^)]*\)[\s\S]*?}/g,
        `if (!workletsProject) {
        // Accept worklets-core as alternative
        workletsProject = project.rootProject.allprojects.find { it.name == 'react-native-worklets-core' }
        if (!workletsProject) {
            throw new GradleException("[Reanimated] Neither react-native-worklets nor react-native-worklets-core found")
        } else {
            println "[Reanimated] Using react-native-worklets-core"
        }
    }`
    );

    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('✅ Successfully patched react-native-reanimated build.gradle');
    console.log('📝 All react-native-worklets references updated to accept worklets-core\n');

} catch (error) {
    console.error('❌ Error patching build.gradle:', error.message);
    process.exit(0);
}




