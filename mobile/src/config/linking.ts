/**
 * Configuration du deep linking pour l'application mobile
 * Gère les liens partagés et l'ouverture directe de services
 */

import { LinkingOptions } from '@react-navigation/native';

export const linking: LinkingOptions<any> = {
  prefixes: [
    'yukpo://',
    'yukpomnang://',
    'https://yukpomnang.com',
    'https://www.yukpomnang.com'
  ],
  config: {
    screens: {
      Home: '',
      ServiceDetail: {
        path: 'service/:serviceId',
        parse: {
          serviceId: (serviceId: string) => serviceId,
        },
      },
      Login: 'login',
      Register: 'register',
      MesServices: 'mes-services',
      FormulaireYukpoIntelligent: 'formulaire',
    },
  },
  async getInitialURL() {
    // Gérer l'ouverture via un lien partagé
    const url = await import('expo-linking').then(m => m.default.getInitialURL());
    return url;
  },
  subscribe(listener) {
    // Écouter les événements de deep linking
    const subscription = import('expo-linking').then(m => 
      m.default.addEventListener('url', ({ url }: { url: string }) => {
        listener(url);
      })
    );

    return () => {
      subscription.then(s => s && typeof s === 'object' && 'remove' in s && s.remove());
    };
  },
};

/**
 * Parse une URL de service partagé
 * @param url URL complète (ex: https://yukpomnang.com/service/123)
 * @returns serviceId ou null
 */
export const parseServiceUrl = (url: string): string | null => {
  try {
    const match = url.match(/\/service\/([^\/\?]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('[Linking] Erreur parsing URL:', error);
    return null;
  }
};

/**
 * Génère un lien de partage pour un service
 * @param serviceId ID du service
 * @returns URL complète
 */
export const generateServiceShareUrl = (serviceId: string): string => {
  return `https://yukpomnang.com/service/${serviceId}`;
};

/**
 * Vérifie si l'utilisateur est connecté avant d'ouvrir un service
 * @param serviceId ID du service à ouvrir
 * @param navigation Navigation instance
 * @param isAuthenticated Si l'utilisateur est connecté
 */
export const handleServiceDeepLink = async (
  serviceId: string,
  navigation: any,
  isAuthenticated: boolean
) => {
  if (!isAuthenticated) {
    // Rediriger vers login avec retour vers le service
    navigation.navigate('Login', {
      returnTo: 'ServiceDetail',
      returnParams: { serviceId }
    });
  } else {
    // Ouvrir directement le service
    navigation.navigate('ServiceDetail', { serviceId });
  }
};

