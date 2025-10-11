// Script intelligent pour enrichir (pas supprimer) les exports Metro
const fs = require('fs');
const path = require('path');

const metroPackages = [
    'metro',
    'metro-cache',
    'metro-transform-worker',
    'metro-config',
    'metro-core',
    'metro-file-map',
    'metro-resolver',
    'metro-runtime',
    'metro-source-map',
    'metro-symbolicate',
    'metro-transform-plugins',
    'metro-babel-transformer',
    'metro-cache-key',
    'metro-minify-terser'
];

console.log('🔧 Fixing Metro packages exports (smart enrichment)...\n');

metroPackages.forEach(packageName => {
    const packageJsonPath = path.join(__dirname, 'node_modules', packageName, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
        console.log(`Fixing ${packageName}...`);

        let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        // Si pas d'exports, créer une structure basique
        if (!packageJson.exports) {
            packageJson.exports = {
                ".": packageJson.main || "./src/index.js",
                "./package.json": "./package.json"
            };
        }

        // Sauvegarder les exports originaux
        const originalExports = JSON.parse(JSON.stringify(packageJson.exports));

        // Enrichir avec des patterns permissifs APRÈS les exports existants
        // L'ordre compte : patterns spécifiques d'abord, wildcards après
        const newExports = {
            ...originalExports,
            // Patterns pour accéder aux modules internes
            "./private/*": "./src/*.js",
            "./src/*": "./src/*",
            "./src/*/*": "./src/*/*",
            "./src/*/*/*": "./src/*/*/*"
        };

        packageJson.exports = newExports;

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`  ✅ ${packageName} exports enriched`);
    } else {
        console.log(`  ⚠️  ${packageName} not found`);
    }
});

console.log('\n✅ All Metro packages fixed!');
console.log('📝 Note: Original exports preserved + internal modules accessible.\n');

