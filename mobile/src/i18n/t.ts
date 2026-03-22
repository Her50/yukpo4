/**
 * Traduction utilisable hors hook (composants classe, constantes, etc.)
 * Préférer `useLanguageSafe().t` dans les composants fonction pour le re-render à changement de langue.
 */
import { translateWithFallback } from './translateShared';

export const t = translateWithFallback;
