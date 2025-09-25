#!/usr/bin/env node

/**
 * Script de transformation automatique Frontend → Mobile
 * 
 * ⚠️ IMPORTANT : Ce script NE MODIFIE JAMAIS le frontend
 * Il lit seulement les fichiers frontend pour générer les versions mobiles
 * 
 * Usage: node scripts/auto-transform.js [--pages] [--components] [--all]
 */

const fs = require('fs');
const path = require('path');
const { transformFile, componentMappings, routeMappings } = require('./transform-frontend-to-mobile.js');

// Configuration des chemins
const FRONTEND_PATH = path.join(__dirname, '../../frontend/src');
const MOBILE_PATH = path.join(__dirname, '../src');

console.log('🔄 Transformation automatique Frontend → Mobile');
console.log('📖 Lecture du frontend :', FRONTEND_PATH);
console.log('📱 Génération mobile :', MOBILE_PATH);

/**
 * Créer un dossier s'il n'existe pas
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Dossier créé : ${dirPath}`);
    }
}

/**
 * Transformer un fichier frontend en version mobile
 */
function transformFrontendFile(frontendPath, mobilePath) {
    try {
        if (!fs.existsSync(frontendPath)) {
            console.log(`⚠️  Fichier frontend non trouvé : ${frontendPath}`);
            return false;
        }

        const content = fs.readFileSync(frontendPath, 'utf8');
        const transformedContent = transformFile(frontendPath, content);

        // Créer le dossier de destination
        ensureDir(path.dirname(mobilePath));

        // Écrire le fichier transformé
        fs.writeFileSync(mobilePath, transformedContent);
        console.log(`✅ Transformé : ${path.basename(frontendPath)} → ${path.basename(mobilePath)}`);

        return true;
    } catch (error) {
        console.error(`❌ Erreur transformation ${frontendPath}:`, error.message);
        return false;
    }
}

/**
 * Transformer toutes les pages
 */
function transformPages() {
    console.log('\n🔄 Transformation des pages...');

    const pagesPath = path.join(FRONTEND_PATH, 'pages');
    if (!fs.existsSync(pagesPath)) {
        console.log('⚠️  Dossier pages non trouvé dans le frontend');
        return;
    }

    const pages = fs.readdirSync(pagesPath)
        .filter(file => file.endsWith('.tsx') || file.endsWith('.jsx'));

    pages.forEach(pageFile => {
        const frontendPath = path.join(pagesPath, pageFile);
        const mobileFileName = pageFile.replace('.tsx', 'Screen.tsx').replace('.jsx', 'Screen.jsx');
        const mobilePath = path.join(MOBILE_PATH, 'screens', mobileFileName);

        transformFrontendFile(frontendPath, mobilePath);
    });
}

/**
 * Transformer tous les composants
 */
function transformComponents() {
    console.log('\n🔄 Transformation des composants...');

    const componentsPath = path.join(FRONTEND_PATH, 'components');
    if (!fs.existsSync(componentsPath)) {
        console.log('⚠️  Dossier components non trouvé dans le frontend');
        return;
    }

    // Transformer récursivement tous les composants
    function transformComponentDir(dirPath, relativePath = '') {
        const items = fs.readdirSync(dirPath);

        items.forEach(item => {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                // Créer le dossier dans mobile
                const mobileDir = path.join(MOBILE_PATH, 'components', relativePath, item);
                ensureDir(mobileDir);

                // Transformer récursivement
                transformComponentDir(itemPath, path.join(relativePath, item));
            } else if (item.endsWith('.tsx') || item.endsWith('.jsx')) {
                // Transformer le fichier
                const mobilePath = path.join(MOBILE_PATH, 'components', relativePath, item);
                transformFrontendFile(itemPath, mobilePath);
            }
        });
    }

    transformComponentDir(componentsPath);
}

/**
 * Transformer les hooks
 */
function transformHooks() {
    console.log('\n🔄 Transformation des hooks...');

    const hooksPath = path.join(FRONTEND_PATH, 'hooks');
    if (!fs.existsSync(hooksPath)) {
        console.log('⚠️  Dossier hooks non trouvé dans le frontend');
        return;
    }

    const hooks = fs.readdirSync(hooksPath)
        .filter(file => file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js'));

    hooks.forEach(hookFile => {
        const frontendPath = path.join(hooksPath, hookFile);
        const mobilePath = path.join(MOBILE_PATH, 'hooks', hookFile);

        transformFrontendFile(frontendPath, mobilePath);
    });
}

/**
 * Transformer les services
 */
function transformServices() {
    console.log('\n🔄 Transformation des services...');

    const servicesPath = path.join(FRONTEND_PATH, 'services');
    if (!fs.existsSync(servicesPath)) {
        console.log('⚠️  Dossier services non trouvé dans le frontend');
        return;
    }

    const services = fs.readdirSync(servicesPath)
        .filter(file => file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.js'));

    services.forEach(serviceFile => {
        const frontendPath = path.join(servicesPath, serviceFile);
        const mobilePath = path.join(MOBILE_PATH, 'services', serviceFile);

        transformFrontendFile(frontendPath, mobilePath);
    });
}

/**
 * Créer un fichier de configuration pour les routes
 */
function generateRouteConfig() {
    console.log('\n🔄 Génération de la configuration des routes...');

    const routeConfigPath = path.join(MOBILE_PATH, 'config', 'routes.ts');
    ensureDir(path.dirname(routeConfigPath));

    const routeConfig = `// Configuration des routes mobile générée automatiquement
export const MOBILE_ROUTES = {
${Object.entries(routeMappings).map(([web, mobile]) => `  ${web.toUpperCase().replace(/[^A-Z0-9]/g, '_')}: '${mobile}',`).join('\n')}
};

export default MOBILE_ROUTES;
`;

    fs.writeFileSync(routeConfigPath, routeConfig);
    console.log('✅ Configuration des routes générée');
}

/**
 * Créer un fichier de mapping des composants
 */
function generateComponentMapping() {
    console.log('\n🔄 Génération du mapping des composants...');

    const mappingPath = path.join(MOBILE_PATH, 'config', 'componentMapping.ts');
    ensureDir(path.dirname(mappingPath));

    const mapping = `// Mapping des composants généré automatiquement
export const COMPONENT_MAPPING = {
${Object.entries(componentMappings).map(([web, native]) => `  '${web}': '${native}',`).join('\n')}
};

export default COMPONENT_MAPPING;
`;

    fs.writeFileSync(mappingPath, mapping);
    console.log('✅ Mapping des composants généré');
}

/**
 * Fonction principale
 */
function main() {
    const args = process.argv.slice(2);

    // Vérifier que le frontend existe
    if (!fs.existsSync(FRONTEND_PATH)) {
        console.error('❌ Dossier frontend non trouvé :', FRONTEND_PATH);
        process.exit(1);
    }

    console.log('🚀 Démarrage de la transformation automatique...');

    // Créer les dossiers de base
    ensureDir(path.join(MOBILE_PATH, 'screens'));
    ensureDir(path.join(MOBILE_PATH, 'components'));
    ensureDir(path.join(MOBILE_PATH, 'hooks'));
    ensureDir(path.join(MOBILE_PATH, 'services'));
    ensureDir(path.join(MOBILE_PATH, 'config'));

    // Transformer selon les arguments
    if (args.includes('--all') || args.length === 0) {
        transformPages();
        transformComponents();
        transformHooks();
        transformServices();
        generateRouteConfig();
        generateComponentMapping();
    } else {
        if (args.includes('--pages')) transformPages();
        if (args.includes('--components')) transformComponents();
        if (args.includes('--hooks')) transformHooks();
        if (args.includes('--services')) transformServices();
        if (args.includes('--config')) {
            generateRouteConfig();
            generateComponentMapping();
        }
    }

    console.log('\n✅ Transformation automatique terminée !');
    console.log('📱 Tous les fichiers mobile ont été générés');
    console.log('⚠️  Rappel : Le script NE MODIFIE JAMAIS le frontend, il lit seulement pour générer le mobile');
    console.log('🔧 Vous devrez peut-être ajuster manuellement certains détails spécifiques à React Native');
    console.log('\n📋 Prochaines étapes :');
    console.log('1. Vérifier les imports dans les fichiers générés');
    console.log('2. Ajuster les styles React Native');
    console.log('3. Tester la navigation');
    console.log('4. Corriger les erreurs de compilation');
}

// Exécuter si appelé directement
if (require.main === module) {
    main();
}

module.exports = {
    transformPages,
    transformComponents,
    transformHooks,
    transformServices,
    generateRouteConfig,
    generateComponentMapping
};
