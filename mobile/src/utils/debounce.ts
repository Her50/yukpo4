/**
 * Debounce utility pour optimiser les appels API
 */

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): T & { cancel: () => void } {
    let timeout: NodeJS.Timeout | null = null;

    const debounced = ((...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    }) as T & { cancel: () => void };

    debounced.cancel = () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    };

    return debounced;
}

/**
 * Throttle utility pour limiter la fréquence d'exécution
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): T {
    let lastCall = 0;
    let timeout: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= wait) {
            lastCall = now;
            func(...args);
        } else {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                lastCall = Date.now();
                func(...args);
            }, wait - timeSinceLastCall);
        }
    }) as T;
}

