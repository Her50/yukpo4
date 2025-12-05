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

// Surcharger resolveRequest pour forcer la résolution de react-native-fs
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'react-native-fs') {
        // Essayer de résoudre depuis plusieurs emplacements
        const searchPaths = [
            path.resolve(__dirname, 'node_modules', 'react-native-fs'),
            path.resolve(__dirname, 'node_modules', '@tensorflow', 'tfjs-react-native', 'node_modules', 'react-native-fs'),
        ];

        for (const searchPath of searchPaths) {
            try {
                const packageJsonPath = path.join(searchPath, 'package.json');
                const fs = require('fs');
                if (fs.existsSync(packageJsonPath)) {
                    // Trouver le point d'entrée principal
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