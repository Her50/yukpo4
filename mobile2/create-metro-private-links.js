// Script pour créer des liens symboliques "private" vers "src" dans les packages Metro
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

console.log('🔗 Creating "private" symlinks for Metro packages...\n');

metroPackages.forEach(packageName => {
    const packagePath = path.join(__dirname, 'node_modules', packageName);
    const srcPath = path.join(packagePath, 'src');
    const privatePath = path.join(packagePath, 'private');

    if (fs.existsSync(packagePath) && fs.existsSync(srcPath)) {
        console.log(`Processing ${packageName}...`);
        
        // Supprimer le lien s'il existe déjà
        if (fs.existsSync(privatePath)) {
            try {
                fs.rmSync(privatePath, { recursive: true, force: true });
                console.log(`  ✓ Removed existing private folder`);
            } catch (err) {
                console.log(`  ⚠️  Could not remove existing: ${err.message}`);
            }
        }

        // Créer un lien symbolique (Windows: junction, Unix: symlink)
        try {
            if (process.platform === 'win32') {
                // Windows: utiliser mklink /J (junction)
                execSync(`mklink /J "${privatePath}" "${srcPath}"`, { stdio: 'pipe' });
            } else {
                // Unix: utiliser ln -s
                fs.symlinkSync(srcPath, privatePath, 'dir');
            }
            console.log(`  ✅ Created private → src symlink`);
        } catch (err) {
            // Si le symlink échoue, copier le dossier
            console.log(`  ⚠️  Symlink failed, trying copy...`);
            try {
                fs.cpSync(srcPath, privatePath, { recursive: true });
                console.log(`  ✅ Copied src to private`);
            } catch (copyErr) {
                console.log(`  ❌ Copy failed: ${copyErr.message}`);
            }
        }
    } else {
        console.log(`  ⚠️  ${packageName} or src folder not found`);
    }
});

console.log('\n✅ Metro "private" symlinks created!');
console.log('📝 Note: This allows imports like "metro/private/lib/..." to work.\n');

