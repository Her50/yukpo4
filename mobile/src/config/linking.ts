import { LinkingOptions } from '@react-navigation/native';

const linking: LinkingOptions<any> = {
  prefixes: ['yukpomnang://', 'https://yukpomnang.com', 'https://yukpo-backend-376093909298.europe-west1.run.app'],
  config: {
    screens: {
      // ✅ Auth screens (AuthStack - pour utilisateurs non connectés)
      Login: 'login',
      Register: 'register',

      // ✅ Main app (SecondaryStack - pour utilisateurs connectés)
      // Tous ces écrans sont dans SecondaryStack
      Main: {
        screens: {
          // Bottom Tabs (MainStack)
          Home: 'home',
          Services: 'services',
          Dashboard: 'dashboard',
          History: 'history',
          Profile: 'profile',
        },
      },

      // ✅ Secondary screens (dans SecondaryStack, même niveau que Main)
      Contact: 'contact',
      Settings: 'settings',
      RechargeTokens: 'recharge',
      FormulaireYukpoIntelligent: 'create-service',
      ResultatBesoin: {
        path: 'search/:query',
        parse: {
          query: (query: string) => query,
          productId: (productId: string) => productId,
          serviceId: (serviceId: string) => serviceId,
        },
      },
      ProductDetail: {
        // ✅ CORRIGÉ 2026-02-10: Gérer les query params (serviceId) dans le path
        // Format: yukpomnang://product/:productId?serviceId=:serviceId
        path: 'product/:productId',
        parse: {
          productId: (productId: string) => productId,
          // ✅ CORRIGÉ: serviceId est dans les query params, pas dans le path
          // React Navigation extrait automatiquement les query params
          serviceId: (serviceId: string | number | undefined) => {
            if (!serviceId) return undefined;
            const parsed = typeof serviceId === 'number' ? serviceId : parseInt(String(serviceId), 10);
            return isNaN(parsed) ? undefined : parsed;
          },
        },
      },  // ✅ AMÉLIORÉ: Deep link produit avec parsing des paramètres
      ServiceDetailShared: {
        path: 'service/:id',
        parse: {
          id: (id: string | number | undefined) => {
            if (!id) return undefined;
            const parsed = typeof id === 'number' ? id : parseInt(String(id), 10);
            return isNaN(parsed) ? undefined : parsed;
          },
        },
      },
      TrackingDetail: {
        path: 'track/:deliveryId',
        parse: {
          deliveryId: (deliveryId: string) => deliveryId,
        },
      },
      SoldeDetail: 'balance',
      CreatePublicite: 'create-ad',
      PubliciteDashboard: 'ads-dashboard',
      YukpoServicePlaceholder: 'yukpo-service',
      // ✅ NOUVEAU: Deep links pour workflow de livraison
      OrderStatus: {
        path: 'order/:orderId',
        parse: {
          orderId: (orderId: string) => orderId,
        },
      },
      ProviderOrderManagement: 'orders/management',
      // ✅ NOUVEAU: Deep links Flash Sales et Promos
      FlashSale: {
        path: 'flash-sale/:sessionId?',
        parse: {
          sessionId: (sessionId: string) => sessionId || undefined,
        },
      },
      GlobalPromoCatalog: 'promo/black-friday',
      // ✅ NOUVEAU: Deep links Navigation intelligente
      NavigationIntelligente: {
        path: 'navigate',
        parse: {
          dest_lat: (v: string) => v ? parseFloat(v) : undefined,
          dest_lng: (v: string) => v ? parseFloat(v) : undefined,
          dest_name: (v: string) => v ? decodeURIComponent(v) : undefined,
          mode: (v: string) => v || 'driving',
          tab: (v: string) => v || undefined,
        },
      },
    },
  },
};

export { linking };

