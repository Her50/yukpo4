import { useUser } from '@/hooks/useUser';
import { API_BASE_URL } from '@/config/api';
import { apiService } from './apiService';

interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

class GPSTrackingService {
  private isTracking = false;
  private trackingInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime = 0;
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_ACCURACY = 100; // 100 mètres

  /**
   * Démarrer le suivi GPS automatique
   */
  startTracking(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    console.log('🚀 Démarrage du suivi GPS automatique');
    
    // Première mise à jour immédiate
    this.updateLocation();
    
    // Mise à jour périodique
    this.trackingInterval = setInterval(() => {
      this.updateLocation();
    }, this.UPDATE_INTERVAL);
    
    // Écouter les changements de position
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (position) => {
          const now = Date.now();
          // Mettre à jour seulement si assez de temps s'est écoulé
          if (now - this.lastUpdateTime > this.UPDATE_INTERVAL) {
            this.handlePositionUpdate(position);
          }
        },
        (error) => {
          console.warn('⚠️ Erreur de suivi GPS:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000, // Augmenté de 10s à 30s
          maximumAge: 60000 // 1 minute
        }
      );
    }
  }

  /**
   * Arrêter le suivi GPS
   */
  stopTracking(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    console.log('🛑 Arrêt du suivi GPS automatique');
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  /**
   * Mettre à jour la position GPS
   */
  private async updateLocation(): Promise<void> {
    if (!navigator.geolocation) {
      console.warn('⚠️ Géolocalisation non supportée');
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      await this.handlePositionUpdate(position);
    } catch (error) {
      console.warn('⚠️ Erreur lors de la mise à jour GPS:', error);
    }
  }

  /**
   * Obtenir la position actuelle
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000, // Réduire le timeout à 10 secondes
        maximumAge: 300000 // 5 minutes de cache
      };
      
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error: GeolocationPositionError) => {
          // Gérer les erreurs de manière plus intelligente
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Permission de géolocalisation refusée'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Position non disponible'));
              break;
            case error.TIMEOUT:
              reject(new Error('Délai d\'attente dépassé'));
              break;
            default:
              reject(new Error('Erreur de géolocalisation inconnue'));
          }
        },
        options
      );
    });
  }

  /**
   * Traiter la mise à jour de position
   */
  private async handlePositionUpdate(position: GeolocationPosition): Promise<void> {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Vérifier la précision
    if (accuracy && accuracy > this.MIN_ACCURACY) {
      console.warn(`⚠️ Précision GPS insuffisante: ${accuracy}m`);
      return;
    }

    const location: GPSLocation = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now()
    };

    console.log(`📍 Position GPS mise à jour: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (précision: ${accuracy}m)`);
    
    // Envoyer au backend
    await this.sendLocationToBackend(location);
    
    this.lastUpdateTime = Date.now();
  }

  /**
   * Envoyer la position au backend
   */
  private async sendLocationToBackend(location: GPSLocation): Promise<void> {
    try {
      const response = await apiService('/api/user/me/gps_location', {
        method: 'PATCH',
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        })
      });

      console.log('✅ Position GPS envoyée au backend');
    } catch (error) {
      console.warn(`⚠️ Erreur lors de l'envoi de la position GPS:`, error);
    }
  }

  /**
   * Obtenir la position actuelle (sans mise à jour automatique)
   */
  async getCurrentLocation(): Promise<GPSLocation | null> {
    if (!navigator.geolocation) return null;

    try {
      const position = await this.getCurrentPosition();
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('⚠️ Impossible d\'obtenir la position actuelle:', error);
      return null;
    }
  }

  /**
   * Vérifier si le suivi est actif
   */
  isActive(): boolean {
    return this.isTracking;
  }
}

// Instance singleton
export const gpsTrackingService = new GPSTrackingService();

// Hook React pour utiliser le service
export const useGPSTracking = () => {
  const { user } = useUser();

  const startTracking = () => {
    if (user) {
      gpsTrackingService.startTracking();
    }
  };

  const stopTracking = () => {
    gpsTrackingService.stopTracking();
  };

  const getCurrentLocation = () => {
    return gpsTrackingService.getCurrentLocation();
  };

  const isTracking = () => {
    return gpsTrackingService.isActive();
  };

  return {
    startTracking,
    stopTracking,
    getCurrentLocation,
    isTracking
  };
}; 
