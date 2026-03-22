import type { TranslateFn } from './contexts/LanguageContext';

/**
 * Initialisé dans index.js via translateWithFallback (i18next).
 * Permet d'utiliser `t` sans import dans les composants (évite des centaines d'imports).
 */
declare global {
    // eslint-disable-next-line no-var
    var t: TranslateFn;
}

export {};
