import { Alert } from 'react-native';
import { logGeneral } from '../config/appConfig';

export interface ApiError {
    message: string;
    status?: number;
    code?: string;
    details?: any;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorLog: ApiError[] = [];

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    // Gérer les erreurs d'API
    handleApiError(error: any, context?: string): ApiError {
        logGeneral(`[ErrorHandler] Erreur API dans ${context || 'contexte inconnu'}`, error);

        let apiError: ApiError = {
            message: 'Une erreur inattendue s\'est produite',
            status: 500,
            code: 'UNKNOWN_ERROR'
        };

        // Erreur de réseau
        if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
            apiError = {
                message: 'Problème de connexion réseau. Vérifiez votre connexion internet.',
                code: 'NETWORK_ERROR',
                status: 0
            };
        }
        // Erreur de timeout
        else if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
            apiError = {
                message: 'La requête a pris trop de temps. Veuillez réessayer.',
                code: 'TIMEOUT',
                status: 408
            };
        }
        // Erreur HTTP
        else if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            switch (status) {
                case 400:
                    apiError = {
                        message: data?.message || 'Requête invalide',
                        status: 400,
                        code: 'BAD_REQUEST',
                        details: data
                    };
                    break;
                case 401:
                    apiError = {
                        message: 'Session expirée. Veuillez vous reconnecter.',
                        status: 401,
                        code: 'UNAUTHORIZED'
                    };
                    break;
                case 403:
                    apiError = {
                        message: 'Accès refusé',
                        status: 403,
                        code: 'FORBIDDEN'
                    };
                    break;
                case 404:
                    apiError = {
                        message: 'Ressource non trouvée',
                        status: 404,
                        code: 'NOT_FOUND'
                    };
                    break;
                case 422:
                    apiError = {
                        message: data?.message || 'Données invalides',
                        status: 422,
                        code: 'VALIDATION_ERROR',
                        details: data
                    };
                    break;
                case 500:
                    apiError = {
                        message: 'Erreur serveur. Veuillez réessayer plus tard.',
                        status: 500,
                        code: 'SERVER_ERROR'
                    };
                    break;
                default:
                    apiError = {
                        message: data?.message || `Erreur serveur (${status})`,
                        status,
                        code: 'HTTP_ERROR',
                        details: data
                    };
            }
        }
        // Erreur de parsing JSON
        else if (error.message?.includes('JSON')) {
            apiError = {
                message: 'Erreur de format de données',
                code: 'JSON_ERROR',
                status: 500
            };
        }
        // Erreur de configuration
        else if (error.message?.includes('API_BASE_URL') || error.message?.includes('configuration')) {
            apiError = {
                message: 'Erreur de configuration de l\'application',
                code: 'CONFIG_ERROR',
                status: 500
            };
        }

        // Ajouter à l'historique des erreurs
        this.errorLog.push({
            ...apiError,
            details: {
                ...apiError.details,
                originalError: error,
                context,
                timestamp: new Date().toISOString()
            }
        });

        // Limiter l'historique à 50 erreurs
        if (this.errorLog.length > 50) {
            this.errorLog = this.errorLog.slice(-50);
        }

        return apiError;
    }

    // Afficher une alerte d'erreur
    showErrorAlert(error: ApiError, onRetry?: () => void) {
        const buttons = [
            { text: 'OK', style: 'default' as const }
        ];

        if (onRetry && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.status === 500)) {
            buttons.unshift({ text: 'Réessayer', style: 'default' as const });
        }

        Alert.alert(
            'Erreur',
            error.message,
            buttons.map(button => ({
                ...button,
                onPress: button.text === 'Réessayer' ? onRetry : undefined
            }))
        );
    }

    // Gérer les erreurs de navigation
    handleNavigationError(error: any, routeName?: string) {
        logGeneral(`[ErrorHandler] Erreur de navigation vers ${routeName || 'route inconnue'}`, error);

        const navigationError: ApiError = {
            message: `Impossible d'accéder à ${routeName || 'cette page'}. Veuillez réessayer.`,
            code: 'NAVIGATION_ERROR',
            status: 500
        };

        this.showErrorAlert(navigationError);
    }

    // Gérer les erreurs d'authentification
    handleAuthError(error: any) {
        logGeneral('[ErrorHandler] Erreur d\'authentification', error);

        const authError: ApiError = {
            message: 'Erreur d\'authentification. Veuillez vous reconnecter.',
            code: 'AUTH_ERROR',
            status: 401
        };

        this.showErrorAlert(authError);
    }

    // Obtenir l'historique des erreurs
    getErrorLog(): ApiError[] {
        return [...this.errorLog];
    }

    // Nettoyer l'historique des erreurs
    clearErrorLog() {
        this.errorLog = [];
    }

    // Vérifier si l'erreur est critique
    isCriticalError(error: ApiError): boolean {
        return error.code === 'CONFIG_ERROR' ||
            error.code === 'SERVER_ERROR' ||
            error.status === 500;
    }

    // Vérifier si l'erreur nécessite une reconnexion
    requiresReauth(error: ApiError): boolean {
        return error.code === 'UNAUTHORIZED' ||
            error.status === 401;
    }
}

// Instance singleton
export const errorHandler = ErrorHandler.getInstance();

// Fonctions utilitaires
export const handleApiError = (error: any, context?: string) => {
    return errorHandler.handleApiError(error, context);
};

export const showErrorAlert = (error: ApiError, onRetry?: () => void) => {
    errorHandler.showErrorAlert(error, onRetry);
};

export const handleNavigationError = (error: any, routeName?: string) => {
    errorHandler.handleNavigationError(error, routeName);
};

export const handleAuthError = (error: any) => {
    errorHandler.handleAuthError(error);
};














