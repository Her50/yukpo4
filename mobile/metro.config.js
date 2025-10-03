const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configuration pour résoudre les problèmes de connexion Metro
config.server = {
    port: 8081,
    enhanceMiddleware: (middleware) => {
        return (req, res, next) => {
            // Headers CORS pour les connexions mobiles
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            
            return middleware(req, res, next);
        };
    }
};

// Configuration pour les packages natifs
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configuration pour les assets
config.resolver.assetExts.push(
  'lottie',
  'ttf',
  'otf',
  'woff',
  'woff2'
);

// Configuration pour résoudre les problèmes de bundle
config.transformer = {
    ...config.transformer,
    minifierConfig: {
        keep_fnames: true,
        mangle: {
            keep_fnames: true,
        },
    },
};

// Configuration pour améliorer la stabilité
config.resolver.unstable_enableSymlinks = false;
config.resolver.unstable_enablePackageExports = false;

module.exports = config;