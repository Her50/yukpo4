const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

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