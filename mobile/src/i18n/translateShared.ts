/**
 * Logique de traduction partagée (hook LanguageProvider + import direct `t` hors composant)
 */
import i18n from './index';

export function translateWithFallback(
    key: string,
    paramsOrFallback?: Record<string, string | number> | string,
    /** Si le 2e argument est une chaîne de secours, passer les params i18n ici (ex. interpolation) */
    paramsWhenSecondIsDefault?: Record<string, string | number>,
): string {
    try {
        if (
            typeof paramsOrFallback === 'string' &&
            paramsWhenSecondIsDefault !== undefined
        ) {
            const result = i18n.t(key, {
                ...paramsWhenSecondIsDefault,
                defaultValue: paramsOrFallback,
            } as any);
            const str = typeof result === 'string' ? result : String(result ?? '');
            return str || paramsOrFallback;
        }
        if (typeof paramsOrFallback === 'string') {
            const result = i18n.t(key);
            const str = typeof result === 'string' ? result : String(result ?? '');
            if (!str || str === key) {
                return paramsOrFallback;
            }
            return str;
        }
        const result = i18n.t(key, paramsOrFallback as any);
        return typeof result === 'string' ? result : String(result || key);
    } catch {
        if (typeof paramsOrFallback === 'string' && paramsWhenSecondIsDefault !== undefined) {
            return paramsOrFallback;
        }
        return typeof paramsOrFallback === 'string' ? paramsOrFallback : key;
    }
}
