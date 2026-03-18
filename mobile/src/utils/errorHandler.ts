/**
 * Gestionnaire d'erreur robuste pour remplacer les fallbacks silencieux
 */

interface ErrorContext {
    component?: string;
    action?: string;
    userId?: string;
    timestamp?: string;
}

class ErrorHandler {
    private static instance: ErrorHandler;
    private errorLog: Array<{ error: Error; context: ErrorContext; timestamp: string }> = [];

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    /**
     * Gère les erreurs avec contexte et logging approprié
     */
    handleError(error: Error | unknown, context: ErrorContext = {}): void {
        const timestamp = new Date().toISOString();
        const errorObj = error instanceof Error ? error : new Error(String(error));

        // Ajouter au log
        this.errorLog.push({
            error: errorObj,
            context: {
                ...context,
                timestamp,
            },
            timestamp,
        });

        // Log détaillé
        console.error(`\uD83D\uDEA8 [ErrorHandler] ${context.component || 'Unknown'} - ${context.action || 'Unknown action'}:`, {
            message: errorObj.message,
            stack: errorObj.stack,
            context,
            timestamp,
        });

        // En production, envoyer à un service de monitoring
        if (__DEV__) {
            // En développement, afficher une alerte
            console.warn('⚠️ Erreur capturée:', errorObj.message);
        }
    }

    /**
     * Wrapper pour les imports dynamiques avec gestion d'erreur
     */
    async safeImport<T>(importFn: () => Promise<T>, fallback?: T, context?: ErrorContext): Promise<T | null> {
        try {
            return await importFn();
        } catch (error) {
            this.handleError(error, {
                ...context,
                action: 'dynamic_import',
            });

            if (fallback !== undefined) {
                console.warn(`\uD83D\uDD04 [ErrorHandler] Utilisation du fallback pour ${context?.component}`);
                return fallback;
            }

            return null;
        }
    }

    /**
     * Wrapper pour les require() avec gestion d'erreur
     */
    safeRequire<T>(requireFn: () => T, fallback?: T, context?: ErrorContext): T | null {
        try {
            return requireFn();
        } catch (error) {
            this.handleError(error, {
                ...context,
                action: 'require',
            });

            if (fallback !== undefined) {
                console.warn(`\uD83D\uDD04 [ErrorHandler] Utilisation du fallback pour ${context?.component}`);
                return fallback;
            }

            return null;
        }
    }

    /**
     * Obtient le log d'erreurs
     */
    getErrorLog(): Array<{ error: Error; context: ErrorContext; timestamp: string }> {
        return [...this.errorLog];
    }

    /**
     * Nettoie le log d'erreurs
     */
    clearErrorLog(): void {
        this.errorLog = [];
    }
}

export const errorHandler = ErrorHandler.getInstance();

// Fonctions utilitaires
export const safeImport = errorHandler.safeImport.bind(errorHandler);
export const safeRequire = errorHandler.safeRequire.bind(errorHandler);
export const handleError = errorHandler.handleError.bind(errorHandler);

export default errorHandler;
