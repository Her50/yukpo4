/**
 * Script pour corriger automatiquement les erreurs TypeScript les plus courantes
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Correction automatique des erreurs TypeScript...\n');

// Corrections à appliquer
const fixes = [
    {
        name: 'Imports React Native manquants',
        test: (content) => content.includes('from \'react-native\'') && !content.includes('Modal') && content.match(/\bModal\b/),
        fix: (content) => {
            // Ajouter Modal, TextInput, Platform, etc. aux imports React Native
            return content.replace(
                /(import\s+\{)([^}]+)(\}\s+from\s+['"]react-native['"])/g,
                (match, start, imports, end) => {
                    const importList = imports.split(',').map(i => i.trim());
                    const toAdd = [];

                    // Chercher les composants utilisés mais non importés
                    if (content.match(/\bModal\b/) && !imports.includes('Modal')) toAdd.push('Modal');
                    if (content.match(/\bTextInput\b/) && !imports.includes('TextInput')) toAdd.push('TextInput');
                    if (content.match(/\bPlatform\b/) && !imports.includes('Platform')) toAdd.push('Platform');
                    if (content.match(/\bKeyboardAvoidingView\b/) && !imports.includes('KeyboardAvoidingView')) toAdd.push('KeyboardAvoidingView');
                    if (content.match(/\bSwitch\b/) && !imports.includes('Switch')) toAdd.push('Switch');
                    if (content.match(/\bImage\b/) && !imports.includes('Image')) toAdd.push('Image');

                    if (toAdd.length > 0) {
                        return `${start}${imports}, ${toAdd.join(', ')}${end}`;
                    }
                    return match;
                }
            );
        }
    },
    {
        name: 'Typos de composants (Viewider, Textrops)',
        test: (content) => content.match(/\bViewider\b/) || content.match(/\bTextrops\b/),
        fix: (content) => {
            return content
                .replace(/\bViewider\b/g, 'View')
                .replace(/\bTextrops\b/g, 'Text');
        }
    },
    {
        name: 'Import SafeNativeView incorrect',
        test: (content) => content.includes('SafeNativeView') && content.includes('react-native-safe-area-context'),
        fix: (content) => {
            return content.replace(
                /import\s+\{([^}]*SafeAreaView[^}]*)\}\s+from\s+['"]react-native-safe-area-context['"];?/g,
                "import { SafeAreaView } from 'react-native-safe-area-context';"
            );
        }
    }
];

function fixFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        let appliedFixes = [];

        fixes.forEach(fix => {
            if (fix.test(content)) {
                content = fix.fix(content);
                appliedFixes.push(fix.name);
            }
        });

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ ${path.relative(process.cwd(), filePath)}`);
            appliedFixes.forEach(name => console.log(`   - ${name}`));
            return appliedFixes.length;
        }

        return 0;
    } catch (error) {
        console.error(`❌ ${filePath}: ${error.message}`);
        return 0;
    }
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    let totalFixes = 0;

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!['node_modules', '.expo', 'dist', 'build', '.git'].includes(file)) {
                totalFixes += processDirectory(filePath);
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            totalFixes += fixFile(filePath);
        }
    });

    return totalFixes;
}

const srcDir = path.join(__dirname, 'src');
const totalFixes = processDirectory(srcDir);

console.log(`\n📊 Total: ${totalFixes} corrections appliquées`);
console.log('\n💡 Lancez "npx tsc --noEmit" pour vérifier les erreurs restantes');

