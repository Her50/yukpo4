/**
 * Service de retry intelligent avec backoff exponentiel
 * Utilisé pour les requêtes réseau et opérations critiques
 */

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000, // 1 seconde
    maxDelay: 10000, // 10 secondes max
    backoffMultiplier: 2,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'ECONNRESET', 'ETIMEDOUT'],
};

/**
 * Retry une fonction avec backoff exponentiel
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Vérifier si l'erreur est retryable
            const errorMessage = error?.message || '';
            const isRetryable = opts.retryableErrors.some(retryableError =>
                errorMessage.toUpperCase().includes(retryableError)
            );

            // Ne pas retry si ce n'est pas une erreur retryable ou si on a atteint le max
            if (!isRetryable || attempt >= opts.maxRetries) {
                throw error;
            }

            // Calculer le délai avec backoff exponentiel
            const delay = Math.min(
                opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
                opts.maxDelay
            );

            // Attendre avant de retry
            await new Promise(resolve => setTimeout(resolve, delay));

            console.log(`[RetryService] Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

/**
 * Retry avec jitter (ajout de randomisation pour éviter thundering herd)
 */
export async function retryWithJitter<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            const errorMessage = error?.message || '';
            const isRetryable = opts.retryableErrors.some(retryableError =>
                errorMessage.toUpperCase().includes(retryableError)
            );

            if (!isRetryable || attempt >= opts.maxRetries) {
                throw error;
            }

            // Calculer le délai avec backoff exponentiel + jitter
            const baseDelay = Math.min(
                opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
                opts.maxDelay
            );
            // Jitter: ±25% de randomisation
            const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
            const delay = Math.max(0, baseDelay + jitter);

            await new Promise(resolve => setTimeout(resolve, delay));

            console.log(`[RetryService] Retry with jitter attempt ${attempt + 1}/${opts.maxRetries} after ${Math.round(delay)}ms`);
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

