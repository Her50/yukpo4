import { apiClient } from './apiClient';

export interface GeospatialSearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  category?: string;
  maxResults?: number;
}

export interface GeospatialService {
  id: number;
  titre_service: string;
  category: string;
  distance_km: number;
  location_type: 'gps_fixe' | 'gps_prestataire' | 'adresse';
  gps_coords: string;
  data: any;
  location_geom?: string;
  location_geog?: string;
}

export interface GeospatialSearchResult {
  services: GeospatialService[];
  total_count: number;
  search_center: {
    latitude: number;
    longitude: number;
  };
  search_radius: number;
  execution_time_ms: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  source: 'gps' | 'browser' | 'manual' | 'ip';
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  city: string;
  country: string;
  confidence: number;
}

class GeospatialServiceAPI {
  private baseUrl = '/api/geospatial';

  /**
   * Recherche de services dans un rayon géographique
   */
  async searchInRadius(params: GeospatialSearchParams): Promise<GeospatialSearchResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/search-radius`, params);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la recherche géospatiale:', error);
      throw error;
    }
  }

  /**
   * Recherche de services par zone géographique
   */
  async searchByZone(zoneName: string, params?: Partial<GeospatialSearchParams>): Promise<GeospatialSearchResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/search-zone`, {
        zone_name: zoneName,
        ...params
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la recherche par zone:', error);
      throw error;
    }
    }

  /**
   * Recherche de services par polygone géographique
   */
  async searchByPolygon(coordinates: Array<[number, number]>, params?: Partial<GeospatialSearchParams>): Promise<GeospatialSearchResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/search-polygon`, {
        coordinates,
        ...params
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la recherche par polygone:', error);
      throw error;
    }
  }

  /**
   * Calcul de distance entre deux points
   */
  async calculateDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): Promise<{ distance_km: number; duration_min?: number }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/calculate-distance`, {
        point1: { latitude: lat1, longitude: lng1 },
        point2: { latitude: lat2, longitude: lng2 }
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors du calcul de distance:', error);
      throw error;
    }
  }

  /**
   * Géocodage d'une adresse en coordonnées
   */
  async geocodeAddress(address: string): Promise<GeocodingResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/geocode`, { address });
      return response.data;
    } catch (error) {
      console.error('Erreur lors du géocodage:', error);
      throw error;
    }
  }

  /**
   * Géocodage inverse (coordonnées vers adresse)
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/reverse-geocode`, {
        latitude,
        longitude
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors du géocodage inverse:', error);
      throw error;
    }
  }

  /**
   * Obtention de la localisation actuelle de l'utilisateur
   */
  async getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée par le navigateur'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            source: 'gps'
          });
        },
        (error) => {
          reject(new Error(`Erreur de géolocalisation: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }

  /**
   * Estimation de la localisation par IP
   */
  async getLocationByIP(): Promise<LocationData> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/location-by-ip`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la localisation par IP:', error);
      throw error;
    }
  }

  /**
   * Recherche de services par itinéraire
   */
  async searchByRoute(
    startPoint: [number, number],
    endPoint: [number, number],
    maxDistanceKm: number = 10
  ): Promise<GeospatialSearchResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/search-route`, {
        start_point: startPoint,
        end_point: endPoint,
        max_distance_km: maxDistanceKm
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la recherche par itinéraire:', error);
      throw error;
    }
  }

  /**
   * Recherche de services par cluster géographique
   */
  async searchByCluster(
    centerPoint: [number, number],
    clusterRadiusKm: number = 5,
    minServicesPerCluster: number = 3
  ): Promise<{
    clusters: Array<{
      center: [number, number];
      services: GeospatialService[];
      service_count: number;
      radius_km: number;
    }>;
    total_services: number;
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/search-clusters`, {
        center_point: centerPoint,
        cluster_radius_km: clusterRadiusKm,
        min_services_per_cluster: minServicesPerCluster
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la recherche par cluster:', error);
      throw error;
    }
  }

  /**
   * Optimisation des paramètres de recherche géospatiale
   */
  async optimizeSearchParams(
    searchQuery: string,
    userLocation?: LocationData
  ): Promise<{
    suggested_radius: number;
    suggested_categories: string[];
    location_boost: number;
    relevance_factors: string[];
  }> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/optimize-params`, {
        search_query: searchQuery,
        user_location: userLocation
      });
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'optimisation des paramètres:', error);
      throw error;
    }
  }

  /**
   * Statistiques géospatiales des services
   */
  async getGeospatialStats(): Promise<{
    total_services: number;
    services_with_location: number;
    services_with_gps_fixe: number;
    services_with_gps_prestataire: number;
    average_search_radius: number;
    most_active_zones: Array<{
      zone_name: string;
      service_count: number;
      coordinates: [number, number];
    }>;
  }> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats`);
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  }
}

export const geospatialService = new GeospatialServiceAPI(); 