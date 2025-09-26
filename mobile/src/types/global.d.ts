// Déclarations globales pour résoudre les conflits de types
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_BASE_URL: string;
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: string;
      EXPO_PUBLIC_APP_ENV: string;
      EXPO_PUBLIC_APP_DEBUG: string;
      EXPO_PUBLIC_YUKPO_API_KEY: string;
      EXPO_PUBLIC_AI_SERVICE_URL: string;
      EXPO_PUBLIC_PINECONE_API_KEY: string;
      EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY: string;
      EXPO_PUBLIC_WS_URL: string;
      EXPO_PUBLIC_LOCATION_ACCURACY: string;
      EXPO_PUBLIC_PUSH_NOTIFICATIONS_ENABLED: string;
    }
  }
}

// Types pour la navigation
export interface RootStackParamList {
  MainTabs: undefined;
  CreateService: undefined;
  ServiceDetail: { serviceId: string };
  Settings: undefined;
  About: undefined;
  Contact: undefined;
  AIChat: undefined;
  AIHub: undefined;
  RechargeTokens: undefined;
  SoldeDetail: undefined;
  Dashboard: undefined;
  MyServices: undefined;
  ServicesInteragis: undefined;
  FormulaireYukpoIntelligent: undefined;
  RechercheBesoin: undefined;
  ResultatBesoin: undefined;
}

export interface MainTabParamList {
  Home: undefined;
  QuickMenu: undefined;
  Profile: undefined;
}

export interface AuthStackParamList {
  Login: undefined;
  Register: undefined;
}

// Types pour les utilisateurs
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  credits: number;
  phone?: string;
  photo?: string;
  token?: string;
}

// Types pour les services
export interface Service {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  views: number;
  interactions: number;
}

// Types pour les réponses API
export interface ApiResponse<T = any> {
  data?: T;
  success?: boolean;
  message?: string;
  error?: string;
}

// Types pour les erreurs
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

// Types pour les tests de connectivité
export interface TestResults {
  apiReachable: boolean;
  authWorking: boolean;
  networkStatus: string;
  errors: string[];
}

// Types pour les tokens JWT
export interface DecodedToken {
  sub: string;
  email: string;
  role: string;
  name?: string;
  tokens_balance?: number;
  exp: number;
  iat: number;
}

export {};
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


