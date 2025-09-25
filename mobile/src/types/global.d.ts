// Types globaux pour l'application mobile Yukpomnang

// Déclaration pour React Navigation
declare module '@react-navigation/native' {
  export * from '@react-navigation/core';
  export function useNavigation(): any;
  export function useRoute(): any;
  export function useFocusEffect(effect: () => void): void;
  export function useIsFocused(): boolean;
  export class NavigationContainer extends React.Component<any> { }
}

declare module '@react-navigation/stack' {
  export function createStackNavigator(): any;
}

declare module '@react-navigation/bottom-tabs' {
  export function createBottomTabNavigator(): any;
}

declare module 'expo-status-bar' {
  export class StatusBar extends React.Component<{ style?: string }> { }
}

declare module 'expo-location' {
  export interface LocationData {
    coords: {
      latitude: number;
      longitude: number;
      altitude?: number | null;
      accuracy?: number | null;
      altitudeAccuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
    };
    timestamp: number;
  }

  export interface LocationPermissionResponse {
    granted: boolean;
    canAskAgain: boolean;
    status: 'granted' | 'denied' | 'undetermined';
  }

  export const Accuracy: {
    Lowest: number;
    Low: number;
    Balanced: number;
    High: number;
    Highest: number;
    BestForNavigation: number;
  };

  export function requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export function getCurrentPositionAsync(options?: any): Promise<LocationData>;
  export function watchPositionAsync(options: any, callback: (location: LocationData) => void): Promise<{ remove: () => void }>;
  export function openSettingsAsync(): Promise<void>;
  export function reverseGeocodeAsync(location: { latitude: number; longitude: number }): Promise<any>;
}

declare module '@expo/vector-icons' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  export interface IoniconsProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
  }

  export class Ionicons extends Component<IoniconsProps> {
    static glyphMap: Record<string, number>;
  }

  export class MaterialIcons extends Component<IoniconsProps> {
    static glyphMap: Record<string, number>;
  }

  export class MaterialCommunityIcons extends Component<IoniconsProps> {
    static glyphMap: Record<string, number>;
  }
}

// Types pour les réponses API
interface SearchResult {
  id: string;
  titre: string;
  description: string;
  score?: number;
  gps?: string;
  distance?: number;
  proximityScore?: number;
}

interface IAResponse {
  intention: string;
  tokens_consumed: number;
  ia_model_used: string;
  confidence: number;
  data?: any;
  suggestion?: any;
  mediaData?: any;
  gpsData?: any;
  type?: string;
  mode?: string;
  serviceId?: string;
  composants?: any[];
  service_id?: string;
  cout?: number;
  resultats?: SearchResult[];
  [key: string]: any;
}

// Types pour les services
interface Service {
  id: string;
  titre: string;
  description: string;
  prix?: number;
  [key: string]: any;
}

interface ServiceData {
  id: string;
  titre: string;
  description: string;
  prix?: number;
  [key: string]: any;
}

// Types pour les statistiques
interface StatsData {
  totalServices: number;
  totalRevenue: number;
  activeServices: number;
  [key: string]: any;
}

// Types pour les réponses de recherche
interface SearchResponse {
  resultats: SearchResult[];
  total: number;
  [key: string]: any;
}

// Types pour les réponses de transcription
interface TranscriptionResponse {
  text: string;
  confidence?: number;
  [key: string]: any;
}

// Types pour les paramètres de navigation
declare global {
  namespace ReactNavigation {
    interface RootParamList {
      Auth: undefined;
      Main: undefined;
      Login: undefined;
      Register: undefined;
      MainTabs: undefined;
      Home: undefined;
      Search: undefined;
      MyServices: undefined;
      Dashboard: undefined;
      Profile: undefined;
      CreateService: undefined;
      ServiceDetail: { serviceId: string };
      Settings: undefined;
      About: undefined;
      Contact: undefined;
      AIChat: undefined;
      AIHub: undefined;
      RechargeTokens: undefined;
      SoldeDetail: undefined;
      DashboardPrestataire: undefined;
      ServicesInteragis: undefined;
      FormulaireYukpoIntelligent: undefined;
      RechercheBesoin: undefined;
      ResultatBesoin: { searchResults: any };
    }
  }
}


