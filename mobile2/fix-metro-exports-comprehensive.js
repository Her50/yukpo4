// Script complet pour fixer TOUS les exports Metro avec des patterns qui fonctionnent vraiment
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

console.log('🔧 Fixing Metro packages exports (comprehensive)...\n');

metroPackages.forEach(packageName => {
    const packageJsonPath = path.join(__dirname, 'node_modules', packageName, 'package.json');
    const srcPath = path.join(__dirname, 'node_modules', packageName, 'src');

    if (fs.existsSync(packageJsonPath)) {
        console.log(`Fixing ${packageName}...`);

        let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        // Créer une structure d'exports de base
        if (!packageJson.exports) {
            packageJson.exports = {
                ".": packageJson.main || "./src/index.js",
                "./package.json": "./package.json"
            };
        }

        // Sauvegarder les exports originaux
        const originalExports = { ...packageJson.exports };

        // Scanner récursivement tous les fichiers .js dans src/
        const allJsFiles = [];
        
        function scanDir(dir, relativePath = '') {
            if (!fs.existsSync(dir)) return;
            
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                
                if (entry.isDirectory()) {
                    scanDir(fullPath, relPath);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    allJsFiles.push(relPath.replace(/\\/g, '/'));
                }
            }
        }

        scanDir(srcPath);

        // Créer les exports pour tous les fichiers trouvés
        const newExports = { ...originalExports };
        
        // Ajouter un export pour chaque fichier .js trouvé
        allJsFiles.forEach(jsFile => {
            const withoutExt = jsFile.replace(/\.js$/, '');
            newExports[`./src/${withoutExt}`] = `./src/${jsFile}`;
        });

        // Ajouter les patterns génériques également
        newExports['./private/*'] = './src/*.js';
        newExports['./src/*'] = './src/*';
        newExports['./src/*/*'] = './src/*/*';
        newExports['./src/*/*/*'] = './src/*/*/*';

        packageJson.exports = newExports;

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(`  ✅ ${packageName} - ${allJsFiles.length} exports added`);

        // Patch spécial pour metro-cache-key qui doit exporter default
        if (packageName === 'metro-cache-key') {
            const indexPath = path.join(__dirname, 'node_modules', packageName, 'src', 'index.js');
            if (fs.existsSync(indexPath)) {
                let indexContent = fs.readFileSync(indexPath, 'utf8');
                // Remplacer l'export pour inclure default
                if (indexContent.includes('module.exports = {') && !indexContent.includes('module.exports.default')) {
                    indexContent = indexContent.replace(
                        /module\.exports = \{\s*getCacheKey,?\s*\};?/,
                        `function getCacheKeyWrapper(files) {
  return files
    .reduce(
      (hash, file) => hash.update("\\0", "utf8").update(fs.readFileSync(file)),
      crypto.createHash("md5")
    )
    .digest("hex");
}

// Export par défaut ET nommé pour compatibilité
module.exports = getCacheKeyWrapper;
module.exports.default = getCacheKeyWrapper;
module.exports.getCacheKey = getCacheKeyWrapper;`
                    );
                    fs.writeFileSync(indexPath, indexContent);
                    console.log(`  🔧 Patched metro-cache-key default export`);
                }
            }
        }
    } else {
        console.log(`  ⚠️  ${packageName} not found`);
    }
});

console.log('\n✅ All Metro packages fixed!');
console.log('📝 Note: Every .js file now has an explicit export entry.\n');

