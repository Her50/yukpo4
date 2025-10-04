import { NavigationProp } from '@react-navigation/native';

export type RootStackParamList = {
    MainTabs: undefined;
    Settings: undefined;
    Contact: undefined;
    Services: undefined;
    RechargeTokens: undefined;
    ResultatBesoin: {
        results: any[];
        type: string;
        suggestion?: any;
    };
    FormulaireYukpoIntelligent: {
        suggestion: any;
        type: string;
        mediaData?: any;
        gpsData?: any;
    };
    CreateService: undefined;
    Historique: undefined;
};

export type RootTabParamList = {
    Home: undefined;
    MesServices: undefined;
    Dashboard: undefined;
    Historique: undefined;
    RechargeTokens: undefined;
    MonCompte: undefined;
    Settings: undefined;
};

export type NavigationType = NavigationProp<RootStackParamList & RootTabParamList>;

declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList, RootTabParamList { }
    }
}
