import { useUser } from '@/hooks/useUser';

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
  private readonly MIN_ACCURACY = 100; // 100 mÃ¨tres

  /**
   * DÃ©marrer le suivi GPS automatique
   */
  startTracking(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    console.log('ðŸš€ DÃ©marrage du suivi GPS automatique');
    
    // PremiÃ¨re mise Ã  jour immÃ©diate
    this.updateLocation();
    
    // Mise Ã  jour pÃ©riodique
    this.trackingInterval = setInterval(() => {
      this.updateLocation();
    }, this.UPDATE_INTERVAL);
    
    // Ã‰couter les changements de position
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (position) => {
          const now = Date.now();
          // Mettre Ã  jour seulement si assez de temps s'est Ã©coulÃ©
          if (now - this.lastUpdateTime > this.UPDATE_INTERVAL) {
            this.handlePositionUpdate(position);
          }
        },
        (error) => {
          console.warn('âš ï¸ Erreur de suivi GPS:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 30000, // AugmentÃ© de 10s Ã  30s
          maximumAge: 60000 // 1 minute
        }
      );
    }
  }

  /**
   * ArrÃªter le suivi GPS
   */
  stopTracking(): void {
    if (!this.isTracking) return;
    
    this.isTracking = false;
    console.log('ðŸ›‘ ArrÃªt du suivi GPS automatique');
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  /**
   * Mettre Ã  jour la position GPS
   */
  private async updateLocation(): Promise<void> {
    if (!navigator.geolocation) {
      console.warn('âš ï¸ GÃ©olocalisation non supportÃ©e');
      return;
    }

    try {
      const position = await this.getCurrentPosition();
      await this.handlePositionUpdate(position);
    } catch (error) {
      console.warn('âš ï¸ Erreur lors de la mise Ã  jour GPS:', error);
    }
  }

  /**
   * Obtenir la position actuelle
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000, // RÃ©duire le timeout Ã  10 secondes
        maximumAge: 300000 // 5 minutes de cache
      };
      
      navigator.geolocation.getCurrentPosition(
        resolve,
        (error: GeolocationPositionError) => {
          // GÃ©rer les erreurs de maniÃ¨re plus intelligente
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Permission de gÃ©olocalisation refusÃ©e'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Position non disponible'));
              break;
            case error.TIMEOUT:
              reject(new Error('DÃ©lai d\'attente dÃ©passÃ©'));
              break;
            default:
              reject(new Error('Erreur de gÃ©olocalisation inconnue'));
          }
        },
        options
      );
    });
  }

  /**
   * Traiter la mise Ã  jour de position
   */
  private async handlePositionUpdate(position: GeolocationPosition): Promise<void> {
    const { latitude, longitude, accuracy } = position.coords;
    
    // VÃ©rifier la prÃ©cision
    if (accuracy && accuracy > this.MIN_ACCURACY) {
      console.warn(`âš ï¸ PrÃ©cision GPS insuffisante: ${accuracy}m`);
      return;
    }

    const location: GPSLocation = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now()
    };

    console.log(`ðŸ“ Position GPS mise Ã  jour: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (prÃ©cision: ${accuracy}m)`);
    
    // Envoyer au backend
    await this.sendLocationToBackend(location);
    
    this.lastUpdateTime = Date.now();
  }

  /**
   * Envoyer la position au backend
   */
  private async sendLocationToBackend(location: GPSLocation): Promise<void> {
    try {
      const response = await fetch(${API_BASE_URL}/api/user/me/gps_location', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        })
      });

      if (response.ok) {
        console.log('âœ… Position GPS envoyÃ©e au backend');
      } else {
        console.warn('âš ï¸ Erreur lors de l\'envoi de la position GPS:', response.status);
      }
    } catch (error) {
      console.error('âŒ Erreur lors de l\'envoi de la position GPS:', error);
    }
  }

  /**
   * Obtenir la position actuelle (sans mise Ã  jour automatique)
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
      console.warn('âš ï¸ Impossible d\'obtenir la position actuelle:', error);
      return null;
    }
  }

  /**
   * VÃ©rifier si le suivi est actif
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
