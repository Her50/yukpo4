/**
 * Ouvre Yukpo IA (modal IntelligentChat) avec un message utilisateur initial.
 * Exposé globalement depuis AppNavigator : `global.showIntelligentChat`.
 */

export function openYukpoIntelligentChat(initialUserMessage: string): boolean {
    try {
        const g = globalThis as typeof globalThis & { showIntelligentChat?: (msg?: string) => void };
        if (typeof g.showIntelligentChat === 'function') {
            g.showIntelligentChat(initialUserMessage);
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}
