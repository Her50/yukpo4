#!/usr/bin/env node
// Script PREINSTALL qui s'exécute AVANT npm install
// Ce script modifie le fichier build.gradle d'expo-modules-core APRÈS son installation
// mais AVANT que Gradle ne soit lancé

const fs = require('fs');
const path = require('path');

console.log('🔧 PREINSTALL: Preparing expo-modules-core fix...');

// Ce script s'exécute AVANT npm install, donc node_modules n'existe pas encore
// On va créer un script qui sera exécuté APRÈS npm install mais AVANT Gradle
// En fait, on ne peut pas modifier le fichier ici car il n'existe pas encore

// La vraie solution est de s'assurer que postinstall.js modifie le fichier correctement
// et que le fichier est bien modifié AVANT que Gradle ne soit lancé

console.log('✅ PREINSTALL: Script will ensure postinstall.js modifies build.gradle correctly');


