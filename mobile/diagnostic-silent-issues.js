/**
 * Diagnostic des problèmes silencieux dans le code
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnostic des problèmes silencieux...');

// Fonction pour analyser un fichier
function analyzeFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        const issues = [];

        lines.forEach((line, index) => {
            const lineNumber = index + 1;

            // 1. Détecter les @ts-ignore
            if (line.includes('@ts-ignore')) {
                issues.push({
                    type: 'ts_ignore',
                    line: lineNumber,
                    content: line.trim(),
                    severity: 'warning'
                });
            }

            // 2. Détecter les require() dans des try-catch
            if (line.includes('require(') && line.includes('try')) {
                issues.push({
                    type: 'silent_require',
                    line: lineNumber,
                    content: line.trim(),
                    severity: 'error'
                });
            }

            // 3. Détecter les catch vides ou silencieux
            if (line.includes('catch') && (line.includes('{}') || line.includes('//'))) {
                issues.push({
                    type: 'silent_catch',
                    line: lineNumber,
                    content: line.trim(),
                    severity: 'error'
                });
            }

            // 4. Détecter les useEffect mal formés
            if (line.includes('useEffect') && line.includes('return undefined')) {
                issues.push({
                    type: 'malformed_useeffect',
                    line: lineNumber,
                    content: line.trim(),
                    severity: 'error'
                });
            }

            // 5. Détecter les imports dynamiques problématiques
            if (line.includes('import(') || line.includes('require(')) {
                issues.push({
                    type: 'dynamic_import',
                    line: lineNumber,
                    content: line.trim(),
                    severity: 'warning'
                });
            }

            // 6. Détecter les fallbacks silencieux
            if (line.includes('||') && line.includes('null') && line.includes('//')) {
                issues.push({
                    type: 'silent_fallback',
                    line: lineNumber,
                    content: line.trim(),
                    severity: 'warning'
                });
            }
        });

        return issues;
    } catch (error) {
        console.error(`Erreur analyse ${filePath}:`, error.message);
        return [];
    }
}

// Analyser tous les fichiers TypeScript/JavaScript
function analyzeDirectory(dir) {
    const files = fs.readdirSync(dir);
    const filesWithIssues = [];

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            filesWithIssues.push(...analyzeDirectory(filePath));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            const issues = analyzeFile(filePath);
            if (issues.length > 0) {
                filesWithIssues.push({
                    file: filePath,
                    issues: issues
                });
            }
        }
    });

    return filesWithIssues;
}

// Lancer l'analyse
const srcDir = path.join(__dirname, 'src');
const results = analyzeDirectory(srcDir);

console.log(`\n📊 Résultats de l'analyse des problèmes silencieux:`);
console.log(`Fichiers avec problèmes: ${results.length}`);

// Grouper par type de problème
const issuesByType = {};
let totalIssues = 0;

results.forEach(result => {
    result.issues.forEach(issue => {
        if (!issuesByType[issue.type]) {
            issuesByType[issue.type] = [];
        }
        issuesByType[issue.type].push({
            file: result.file,
            line: issue.line,
            content: issue.content,
            severity: issue.severity
        });
        totalIssues++;
    });
});

console.log(`\nTotal des problèmes: ${totalIssues}`);

// Afficher les résultats par type
Object.entries(issuesByType).forEach(([type, issues]) => {
    console.log(`\n🔍 ${type.toUpperCase()} (${issues.length} occurrences):`);
    issues.forEach(issue => {
        console.log(`  ${issue.file}:${issue.line} - ${issue.severity.toUpperCase()}`);
        console.log(`    ${issue.content}`);
    });
});

// Recommandations
console.log(`\n💡 Recommandations:`);
console.log(`1. Remplacer les @ts-ignore par des corrections appropriées`);
console.log(`2. Utiliser le gestionnaire d'erreur pour les imports dynamiques`);
console.log(`3. Corriger les useEffect mal formés`);
console.log(`4. Ajouter une gestion d'erreur appropriée dans les catch`);
console.log(`5. Utiliser useSafeEffect pour les useEffect complexes`);

console.log('\n🎯 Diagnostic terminé.');
