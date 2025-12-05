/**
 * Utilitaire pour le feedback haptique
 * Utilise l'API native si disponible, sinon fallback silencieux
 */


// Types de feedback haptique
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

let Haptics: any = null;

// Essayer d'importer expo-haptics si disponible
try {
    // @ts-ignore - Peut ne pas être installé
    Haptics = require('expo-haptics');
} catch (error) {
    // expo-haptics n'est pas installé, on utilisera un fallback
    console.log('[hapticFeedback] expo-haptics non disponible, utilisation du fallback');
}

/**
 * Déclenche un feedback haptique
 */
export const triggerHaptic = (type: HapticType = 'medium') => {
    if (!Haptics) {
        // Fallback silencieux si expo-haptics n'est pas disponible
        return;
    }

    try {
        switch (type) {
            case 'light':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
            case 'medium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
            case 'heavy':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                break;
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            case 'error':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                break;
            case 'selection':
                Haptics.selectionAsync();
                break;
            default:
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    } catch (error) {
        // Ignorer les erreurs silencieusement
        console.debug('[hapticFeedback] Erreur haptic:', error);
    }
};

/**
 * Feedback pour les interactions importantes (boutons principaux)
 */
export const hapticPress = () => triggerHaptic('medium');

/**
 * Feedback pour les sélections (filtres, onglets)
 */
export const hapticSelect = () => triggerHaptic('selection');

/**
 * Feedback pour les actions réussies
 */
export const hapticSuccess = () => triggerHaptic('success');

/**
 * Feedback pour les erreurs
 */
export const hapticError = () => triggerHaptic('error');


