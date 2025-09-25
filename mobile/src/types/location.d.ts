// Types pour la localisation
declare global {
  interface LocationData {
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
}

export {};
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

  export async function requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export async function getCurrentPositionAsync(options?: any): Promise<LocationData>;
  export async function watchPositionAsync(options: any, callback: (location: LocationData) => void): Promise<{ remove: () => void }>;
  export async function openSettingsAsync(): Promise<void>;
  export async function reverseGeocodeAsync(location: { latitude: number; longitude: number }): Promise<any>;
}
