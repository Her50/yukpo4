/**
 * Utilitaire pour ajouter des timeouts aux appels API
 * Évite les blocages indéfinis si l'API est lente ou bloquée
 */

const DEFAULT_TIMEOUT = 30000; // 30 secondes par défaut

export interface TimeoutOptions {
    timeout?: number;
    errorMessage?: string;
}

/**
 * Ajoute un timeout à une Promise
 * @param promise La Promise à wrapper
 * @param options Options de timeout
 * @returns Promise avec timeout
 */
export function withTimeout<T>(
    promise: Promise<T>,
    options: TimeoutOptions = {}
): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, errorMessage = 'Request timeout' } = options;

    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${errorMessage} (${timeout}ms)`));
            }, timeout);
        }),
    ]);
}

/**
 * Wrapper pour les appels API avec timeout et gestion d'erreur
 * @param apiCall Fonction qui retourne une Promise
 * @param options Options de timeout
 * @returns Promise avec timeout
 */
export async function apiCallWithTimeout<T>(
    apiCall: () => Promise<T>,
    options: TimeoutOptions = {}
): Promise<T> {
    try {
        return await withTimeout(apiCall(), options);
    } catch (error: any) {
        // ✅ Améliorer le message d'erreur pour les timeouts
        if (error?.message?.includes('timeout')) {
            console.warn(`[apiTimeout] ⚠️ Timeout après ${options.timeout || DEFAULT_TIMEOUT}ms`);
            throw new Error(`La requête a pris trop de temps. Veuillez réessayer.`);
        }
        throw error;
    }
}

/**
 * Timeouts spécifiques par type d'opération
 */
export const API_TIMEOUTS = {
    SEARCH: 20000, // 20s pour les recherches (peuvent être longues)
    CREATE_SERVICE: 30000, // 30s pour la création de service
    GPS: 15000, // 15s pour GPS
    NOTIFICATIONS: 10000, // 10s pour les notifications
    CHAT: 15000, // 15s pour le chat
    DEFAULT: DEFAULT_TIMEOUT,
} as const;

