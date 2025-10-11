#!/usr/bin/env node
// Script pour créer des patches Metro avec patch-package

const { execSync } = require('child_process');
const fs = require('path');

console.log('🔧 Creating Metro patches with patch-package...\n');

const metroPackages = [
    'metro',
    'metro-cache',
    'metro-cache-key'
];

try {
    // 1. Appliquer les corrections Metro
    console.log('📦 Step 1: Applying Metro fixes...');
    execSync('node fix-metro-exports-comprehensive.js', { stdio: 'inherit' });
    execSync('node create-metro-private-links.js', { stdio: 'inherit' });
    
    // 2. Créer les patches pour chaque package
    console.log('\n📦 Step 2: Creating patches...');
    metroPackages.forEach(pkg => {
        console.log(`Creating patch for ${pkg}...`);
        try {
            execSync(`npx patch-package ${pkg}`, { stdio: 'inherit' });
        } catch (err) {
            console.log(`⚠️ Failed to create patch for ${pkg}`);
        }
    });
    
    console.log('\n✅ Patches created successfully!');
    console.log('📝 Patches are in the patches/ directory');
    console.log('📝 They will be automatically applied on npm install');
    
} catch (error) {
    console.error('❌ Error creating patches:', error.message);
    process.exit(1);
}

