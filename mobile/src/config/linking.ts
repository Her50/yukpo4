import { LinkingOptions } from '@react-navigation/native';

const linking: LinkingOptions<any> = {
  prefixes: ['yukpomnang://', 'https://yukpomnang.com'],
  config: {
    screens: {
      // Auth screens
      Login: 'login',
      Register: 'register',

      // Main tabs
      MainTabs: {
        screens: {
          Home: 'home',
          MonActivite: 'activity',
          MesInteractions: 'interactions',
          MonCompte: 'account',
        },
      },

      // Secondary screens
      Settings: 'settings',
      Contact: 'contact',
      Services: 'services',
      RechargeTokens: 'recharge',
      ResultatBesoin: 'search/:query',
      FormulaireYukpoIntelligent: 'create-service',
      ServiceDetailShared: 'service/:id',
      SoldeDetail: 'balance',
      YukpoService: 'yukpo-service',
      CreatePublicite: 'create-ad',
      PubliciteDashboard: 'ads-dashboard',
    },
  },
};

export { linking };
