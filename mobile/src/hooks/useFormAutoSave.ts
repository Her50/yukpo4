import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

/**
 * Hook pour sauvegarder automatiquement un formulaire dans AsyncStorage
 * @param storageKey - Clé unique pour le stockage
 * @param formData - Données du formulaire à sauvegarder
 * @param enabled - Activer/désactiver la sauvegarde (défaut: true)
 * @param debounceMs - Délai de debounce en ms (défaut: 1000)
 */
export function useFormAutoSave<T>(
    storageKey: string,
    formData: T,
    enabled: boolean = true,
    debounceMs: number = 1000
) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!enabled) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(async () => {
            try {
                await AsyncStorage.setItem(storageKey, JSON.stringify(formData));
                console.log(`[useFormAutoSave] Saved to ${storageKey}`);
            } catch (error) {
                console.error(`[useFormAutoSave] Error saving to ${storageKey}:`, error);
            }
        }, debounceMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [formData, storageKey, enabled, debounceMs]);
}

/**
 * Charger les données sauvegardées depuis AsyncStorage
 * @param storageKey - Clé unique pour le stockage
 * @returns Les données sauvegardées ou null
 */
export async function loadSavedFormData<T>(storageKey: string): Promise<T | null> {
    try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
            return JSON.parse(saved) as T;
        }
        return null;
    } catch (error) {
        console.error(`[loadSavedFormData] Error loading from ${storageKey}:`, error);
        return null;
    }
}

/**
 * Supprimer les données sauvegardées
 * @param storageKey - Clé unique pour le stockage
 */
export async function clearSavedFormData(storageKey: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(storageKey);
        console.log(`[clearSavedFormData] Cleared ${storageKey}`);
    } catch (error) {
        console.error(`[clearSavedFormData] Error clearing ${storageKey}:`, error);
    }
}
