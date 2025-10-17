// Script FINAL pour supprimer complètement les exports restrictifs des packages Metro
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

console.log('🔧 Fixing Metro packages exports...\n');

metroPackages.forEach(packageName => {
    const packageJsonPath = path.join(__dirname, 'node_modules', packageName, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
        console.log(`Fixing ${packageName}...`);

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        // ENRICHIR les exports au lieu de les supprimer complètement
        if (packageJson.exports) {
            const originalExports = { ...packageJson.exports };
            
            // Garder les exports existants et ajouter les patterns permissifs
            packageJson.exports = {
                ...originalExports,
                './src/*': './src/*',
                './src/*/*': './src/*/*', 
                './src/*/*/*': './src/*/*/*',
                './src/*/*/*/*': './src/*/*/*/*',
                './private/*': './src/*.js'
            };
            
            console.log(`  ✓ Enriched exports field`);
        }

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`  ✅ ${packageName} fixed!`);
    } else {
        console.log(`  ⚠️  ${packageName} not found`);
    }
});

console.log('\n✅ All Metro packages fixed! Exports restrictions removed.');
console.log('📝 Note: This allows EAS Build to access internal Metro modules.\n');

