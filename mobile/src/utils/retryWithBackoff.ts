/**
 * Retry automatique avec backoff exponentiel
 */

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000, // 1 seconde
    maxDelay: 10000, // 10 secondes max
    backoffFactor: 2,
    retryableErrors: ['Network', 'timeout', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'],
};

/**
 * Retry avec backoff exponentiel
 * 
 * @param fn Fonction à exécuter avec retry
 * @param options Options de retry
 * @returns Résultat de la fonction
 */
export const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Si c'est la dernière tentative, on lance l'erreur
            if (attempt === opts.maxRetries) {
                console.error(`[RetryWithBackoff] ❌ Échec après ${opts.maxRetries + 1} tentatives`);
                throw error;
            }

            // Vérifier si l'erreur est retryable
            const errorMessage = error?.message || error?.toString() || '';
            const isRetryable = opts.retryableErrors.some(retryableError =>
                errorMessage.toLowerCase().includes(retryableError.toLowerCase())
            );

            // Si l'erreur n'est pas retryable, on lance immédiatement
            if (!isRetryable && error?.response?.status !== undefined) {
                const status = error.response.status;
                // Erreurs 4xx (sauf 408 timeout) ne sont pas retryables
                if (status >= 400 && status < 500 && status !== 408) {
                    console.log(`[RetryWithBackoff] ⚠️ Erreur ${status} non retryable`);
                    throw error;
                }
            }

            // Calculer le délai avec backoff exponentiel
            const delay = Math.min(
                opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
                opts.maxDelay
            );

            console.log(
                `[RetryWithBackoff] 🔄 Tentative ${attempt + 1}/${opts.maxRetries + 1} échouée, retry dans ${delay}ms`
            );

            // Attendre avant de réessayer
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Ne devrait jamais arriver ici, mais TypeScript le demande
    throw lastError || new Error('Retry failed');
};

/**
 * Wrapper pour les appels API avec retry automatique
 */
export const apiCallWithRetry = async <T>(
    apiCall: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> => {
    return retryWithBackoff(apiCall, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        ...options,
    });
};

