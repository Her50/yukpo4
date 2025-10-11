const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Configuration Metro simplifiée pour éviter les erreurs de bundle
config.resolver = {
    ...config.resolver,
    unstable_enablePackageExports: false,
    unstable_conditionNames: ['require', 'import'],
    // Résolution des modules Node.js - créer des mocks vides pour les modules serveur
    resolveRequest: (context, moduleName, platform) => {
        // Modules Node.js qui ne devraient jamais être dans le bundle React Native
        const nodeModules = ['fs', 'path', 'crypto', 'stream', 'buffer', 'process', 'os', 'http', 'https', 'net', 'tls'];

        if (nodeModules.includes(moduleName)) {
            return {
                type: 'empty',
            };
        }

        // Utiliser la résolution par défaut pour les autres modules
        return context.resolveRequest(context, moduleName, platform);
    },
};

module.exports = config;