// Configuration du splash screen
export const splashConfig = {
    // Durée minimale du splash screen (en millisecondes)
    minSplashDuration: 2000,

    // Durée maximale du splash screen (en millisecondes)
    maxSplashDuration: 5000,

    // Délai avant de commencer l'initialisation (en millisecondes)
    initializationDelay: 500,

    // Configuration des étapes de chargement
    loadingSteps: {
        initialization: 'Initialisation des composants...',
        dependencies: 'Vérification des dépendances...',
        contexts: 'Test des contextes...',
        finalization: 'Finalisation...'
    },

    // Messages d'erreur
    errorMessages: {
        initialization: 'Erreur d\'initialisation',
        dependencies: 'Dépendances manquantes',
        contexts: 'Erreur dans les contextes',
        critical: 'Erreur critique'
    }
};

export default splashConfig;
