const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ✅ CORRECTION: Forcer axios à utiliser la version browser au lieu de node
// Axios a un export "react-native" qui pointe vers dist/browser/axios.cjs
// Mais Metro ne le détecte pas toujours, donc on force avec un alias
config.resolver.alias = {
    ...config.resolver.alias,
    'axios': path.resolve(__dirname, 'node_modules', 'axios', 'dist', 'browser', 'axios.cjs'),
    // Bloquer aussi les imports directs vers la version node
    'axios/dist/node/axios.cjs': path.resolve(__dirname, 'node_modules', 'axios', 'dist', 'browser', 'axios.cjs'),
};

// ✅ CORRECTION: Configuration simplifiée sans dépendance problématique
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// ✅ CORRECTION: Forcer la résolution de react-native-fs pour @tensorflow/tfjs-react-native
// Ajouter node_modules racine aux chemins de recherche
config.resolver.nodeModulesPaths = [
    path.resolve(__dirname, 'node_modules'),
];

// Surcharger resolveRequest pour forcer la résolution de modules problématiques
const defaultResolver = config.resolver.resolveRequest;
const fs = require('fs');

config.resolver.resolveRequest = (context, moduleName, platform) => {
    // ✅ CORRECTION: Bloquer l'accès à axios/dist/node/axios.cjs et forcer la version browser
    // Intercepter TOUS les imports vers la version node d'axios
    if (moduleName === 'axios/dist/node/axios.cjs' || moduleName.includes('axios/dist/node')) {
        const browserPath = path.resolve(__dirname, 'node_modules', 'axios', 'dist', 'browser', 'axios.cjs');
        if (fs.existsSync(browserPath)) {
            return {
                filePath: browserPath,
                type: 'sourceFile',
            };
        }
    }

    // ✅ CORRECTION: Si on importe axios, forcer la version browser
    if (moduleName === 'axios') {
        const browserPath = path.resolve(__dirname, 'node_modules', 'axios', 'dist', 'browser', 'axios.cjs');
        if (fs.existsSync(browserPath)) {
            return {
                filePath: browserPath,
                type: 'sourceFile',
            };
        }
    }

    // ✅ CORRECTION: Résoudre crypto vers expo-crypto pour React Native
    // Axios utilise require('crypto') qui n'existe pas dans React Native
    if (moduleName === 'crypto') {
        const expoCryptoPath = path.resolve(__dirname, 'node_modules', 'expo-crypto');
        const cryptoJsPath = path.join(expoCryptoPath, 'build', 'Crypto.js');
        if (fs.existsSync(cryptoJsPath)) {
            return {
                filePath: cryptoJsPath,
                type: 'sourceFile',
            };
        }
        // Fallback: créer un stub minimal si expo-crypto n'est pas disponible
        console.warn('⚠️  expo-crypto not found, crypto polyfill may not work');
    }

    // ✅ CORRECTION: Forcer la résolution de expo-modules-core
    if (moduleName === 'expo-modules-core') {
        const searchPaths = [
            path.resolve(__dirname, 'node_modules', 'expo-modules-core'),
            path.resolve(__dirname, 'node_modules', 'expo', 'node_modules', 'expo-modules-core'),
        ];

        for (const searchPath of searchPaths) {
            try {
                const packageJsonPath = path.join(searchPath, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    const packageJson = require(packageJsonPath);
                    const mainFile = packageJson.main || 'index.js';
                    const mainPath = path.join(searchPath, mainFile);
                    if (fs.existsSync(mainPath)) {
                        return {
                            filePath: mainPath,
                            type: 'sourceFile',
                        };
                    }
                }
            } catch (error) {
                // Continuer à chercher
            }
        }
    }

    // ✅ CORRECTION: Forcer la résolution de react-native-fs
    if (moduleName === 'react-native-fs') {
        const searchPaths = [
            path.resolve(__dirname, 'node_modules', 'react-native-fs'),
            path.resolve(__dirname, 'node_modules', '@tensorflow', 'tfjs-react-native', 'node_modules', 'react-native-fs'),
        ];

        for (const searchPath of searchPaths) {
            try {
                const packageJsonPath = path.join(searchPath, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    const packageJson = require(packageJsonPath);
                    const mainFile = packageJson.main || 'index.js';
                    const mainPath = path.join(searchPath, mainFile);
                    if (fs.existsSync(mainPath)) {
                        return {
                            filePath: mainPath,
                            type: 'sourceFile',
                        };
                    }
                }
            } catch (error) {
                // Continuer à chercher
            }
        }
    }

    // Utiliser la résolution par défaut pour tous les autres modules
    if (defaultResolver) {
        return defaultResolver(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;