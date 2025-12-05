/**
 * Guards de navigation pour protéger les écrans prestataires
 */

import { NavigationProp } from '@react-navigation/native';
import { Alert } from 'react-native';

export interface User {
    id?: number | string;
    role?: string;
    service_id?: number;
}

/**
 * Vérifier si l'utilisateur est un prestataire
 */
export const isProvider = (user: User | null | undefined): boolean => {
    if (!user) return false;
    // Vérifier le rôle ou l'existence d'un service_id
    return user.role === 'provider' || user.role === 'prestataire' || !!user.service_id;
};

/**
 * Vérifier si l'utilisateur est une agence de voyage
 */
export const isAgency = (user: User | null | undefined): boolean => {
    if (!user) return false;
    return user.role === 'agency' || user.role === 'agence' || !!user.service_id;
};

/**
 * Guard pour protéger un écran prestataire
 */
export const requireProvider = (
    user: User | null | undefined,
    navigation: NavigationProp<any>,
    screenName: string = 'Home'
): boolean => {
    if (!isProvider(user)) {
        Alert.alert(
            'Accès restreint',
            'Cette fonctionnalité est réservée aux prestataires.',
            [
                { text: 'OK', onPress: () => (navigation as any).navigate(screenName) },
            ]
        );
        return false;
    }
    return true;
};

/**
 * Guard pour protéger un écran agence
 */
export const requireAgency = (
    user: User | null | undefined,
    navigation: NavigationProp<any>,
    screenName: string = 'Home'
): boolean => {
    if (!isAgency(user)) {
        Alert.alert(
            'Accès restreint',
            'Cette fonctionnalité est réservée aux agences de voyage.',
            [
                { text: 'OK', onPress: () => (navigation as any).navigate(screenName) },
            ]
        );
        return false;
    }
    return true;
};

