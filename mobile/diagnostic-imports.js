/**
 * Diagnostic des imports problématiques
 * Ce script identifie les imports qui causent des crashes
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnostic des imports problématiques...');

// Fonction pour analyser un fichier
function analyzeFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        const problematicImports = [];

        lines.forEach((line, index) => {
            // Chercher les imports @/ qui peuvent causer des problèmes
            if (line.includes("import") && line.includes("@/")) {
                problematicImports.push({
                    line: index + 1,
                    content: line.trim(),
                    file: filePath
                });
            }

            // Chercher les imports vers des fichiers qui n'existent pas
            if (line.includes("import") && line.includes("from")) {
                const match = line.match(/from\s+['"]([^'"]+)['"]/);
                if (match) {
                    const importPath = match[1];

                    // Vérifier si c'est un chemin relatif
                    if (importPath.startsWith('./') || importPath.startsWith('../')) {
                        const resolvedPath = path.resolve(path.dirname(filePath), importPath);

                        // Vérifier si le fichier existe
                        if (!fs.existsSync(resolvedPath) && !fs.existsSync(resolvedPath + '.tsx') && !fs.existsSync(resolvedPath + '.ts')) {
                            problematicImports.push({
                                line: index + 1,
                                content: line.trim(),
                                file: filePath,
                                issue: `Fichier non trouvé: ${importPath}`
                            });
                        }
                    }
                }
            }
        });

        return problematicImports;
    } catch (error) {
        console.error(`Erreur analyse ${filePath}:`, error.message);
        return [];
    }
}

// Analyser tous les fichiers TypeScript/JavaScript
function analyzeDirectory(dir) {
    const files = fs.readdirSync(dir);
    const problematicFiles = [];

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            problematicFiles.push(...analyzeDirectory(filePath));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            const problems = analyzeFile(filePath);
            if (problems.length > 0) {
                problematicFiles.push({
                    file: filePath,
                    problems: problems
                });
            }
        }
    });

    return problematicFiles;
}

// Lancer l'analyse
const srcDir = path.join(__dirname, 'src');
const results = analyzeDirectory(srcDir);

console.log(`\n📊 Résultats de l'analyse:`);
console.log(`Fichiers avec problèmes: ${results.length}`);

results.forEach(result => {
    console.log(`\n❌ ${result.file}:`);
    result.problems.forEach(problem => {
        console.log(`  Ligne ${problem.line}: ${problem.content}`);
        if (problem.issue) {
            console.log(`    → ${problem.issue}`);
        }
    });
});

console.log('\n🎯 Diagnostic terminé.');
