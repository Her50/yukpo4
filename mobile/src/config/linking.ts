import { LinkingOptions } from '@react-navigation/native';

const linking: LinkingOptions<any> = {
  prefixes: ['yukpomnang://', 'https://yukpomnang.com'],
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
      ProductDetail: 'product/:productId',  // ✅ NOUVEAU: Deep link produit
      ServiceDetailShared: 'service/:id',
      SoldeDetail: 'balance',
      CreatePublicite: 'create-ad',
      PubliciteDashboard: 'ads-dashboard',
      YukpoServicePlaceholder: 'yukpo-service',
    },
  },
};

export { linking };
