import { API_KEYS } from '@/config/api-keys';

interface GeocodingResult {
  display_name: string;
  address: {
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    state?: string;
    country?: string;
  };
}

interface GoogleGeocodingResult {
  results: Array<{
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
  status: string;
}

interface CachedLocation {
  name: string;
  timestamp: number;
  expiresAt: number;
}

class GeocodingService {
  private cache = new Map<string, CachedLocation>();
  
  // ?? CORRECTION : Cache préchargé supprimé pour éviter la confusion avec les coordonnées par défaut
  // Le cache préchargé causait l'affichage de coordonnées du Nigeria au lieu des vraies coordonnées sélectionnées
  private readonly PRECACHED_LOCATIONS = new Map<string, string>();
  
  // Configuration
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 jours pour un cache ultra-long
  private readonly RATE_LIMIT_DELAY = 0; // ZÉRO délai pour une recherche INSTANTANÉE
  private readonly MAX_RETRIES = 1; // Réduire les retries pour plus de vitesse
  private readonly BATCH_SIZE = 50; // Traiter 50 coordonnées en parallèle
  private lastCallTime = 0;
  
  constructor() {
    // ?? CORRECTION : Supprimé le préchargement qui causait la confusion avec les coordonnées par défaut
    // this.preloadCommonLocations();
  }
  
  // Configuration API depuis le fichier de config
  private readonly USE_GOOGLE_API = API_KEYS.USE_GOOGLE_GEOCODING;
  private readonly GOOGLE_API_KEY = API_KEYS.GOOGLE_MAPS_API_KEY;

  /**
   * Convertit des coordonnées GPS en nom de lieu lisible
   */
  async getLocationFromCoordinates(lat: number, lng: number): Promise<string> {
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    
    // Vérifier le cache préchargé INSTANTANÉ d'abord
    const precached = this.PRECACHED_LOCATIONS.get(cacheKey);
    if (precached) {
      console.log(`⚡ [Geocoding] Cache préchargé INSTANTANÉ pour ${cacheKey}: ${precached}`);
      return precached;
    }
    
    // Vérifier le cache dynamique ensuite
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`🗺️ [Geocoding] Utilisation du cache pour ${cacheKey}: ${cached.name}`);
      return cached.name;
    }

    // Respecter la limite de taux (réduite drastiquement)
    await this.respectRateLimit();

    try {
      console.log(`🗺️ [Geocoding] Appel backend pour ${lat}, ${lng}`);
      
      // Utiliser l'endpoint backend au lieu d'appeler directement Google Maps
      const response = await fetch('/api/geocoding/reverse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.formatted_address) {
        throw new Error('Aucun nom de lieu trouvé');
      }
      
      // Mettre en cache
      this.cache.set(cacheKey, {
        name: data.formatted_address,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      });

      console.log(`🗺️ [Geocoding] Lieu trouvé: ${data.formatted_address}`);
      return data.formatted_address; // Retourner le résultat de l'API

    } catch (error) {
      console.error(`❌ [Geocoding] Erreur pour ${lat}, ${lng}:`, error);
      
      // Fallback: coordonnées formatées
      return this.formatCoordinatesAsFallback(lat, lng);
    }
  }

  /**
   * Formate le nom de lieu de Google Maps de manière intelligente
   */
  private formatGoogleLocationName(result: GoogleGeocodingResult['results'][0]): string {
    const { formatted_address, address_components } = result;
    
    // Extraire les composants d'adresse
    const components = {
      neighbourhood: address_components.find(c => c.types.includes('neighbourhood'))?.long_name,
      locality: address_components.find(c => c.types.includes('locality'))?.long_name,
      sublocality: address_components.find(c => c.types.includes('sublocality'))?.long_name,
      administrative_area_level_1: address_components.find(c => c.types.includes('administrative_area_level_1'))?.long_name,
      country: address_components.find(c => c.types.includes('country'))?.long_name,
    };
    
    // Priorité 1: Quartier/Neighbourhood
    if (components.neighbourhood) {
      if (components.locality) {
        return `${components.neighbourhood}, ${components.locality}`;
      }
      return components.neighbourhood;
    }
    
    // Priorité 2: Sublocalité
    if (components.sublocality) {
      if (components.locality) {
        return `${components.sublocality}, ${components.locality}`;
      }
      return components.sublocality;
    }
    
    // Priorité 3: Localité/Ville
    if (components.locality) {
      if (components.administrative_area_level_1) {
        return `${components.locality}, ${components.administrative_area_level_1}`;
      }
      return components.locality;
    }
    
    // Priorité 4: Région/État
    if (components.administrative_area_level_1) {
      return components.administrative_area_level_1;
    }
    
    // Fallback: adresse formatée (première partie)
    return formatted_address.split(',')[0];
  }

  /**
   * Formate le nom de lieu de manière intelligente (style Facebook) - pour Nominatim
   */
  private formatLocationName(data: GeocodingResult): string {
    const { address, display_name } = data;
    
    // Priorité 1: Quartier/Suburb
    if (address.neighbourhood) {
      if (address.city || address.town) {
        return `${address.neighbourhood}, ${address.city || address.town}`;
      }
      return address.neighbourhood;
    }
    
    // Priorité 2: Suburb
    if (address.suburb) {
      if (address.city || address.town) {
        return `${address.suburb}, ${address.city || address.town}`;
      }
      return address.suburb;
    }
    
    // Priorité 3: Ville
    if (address.city || address.town) {
      if (address.state) {
        return `${address.city || address.town}, ${address.state}`;
      }
      return address.city || address.town || '';
    }
    
    // Priorité 4: État/Région
    if (address.state) {
      return address.state;
    }
    
    // Fallback: nom complet
    return display_name.split(',')[0]; // Premier élément
  }

  /**
   * Fallback: formater les coordonnées de manière lisible
   */
  private formatCoordinatesAsFallback(lat: number, lng: number): string {
    const latFormatted = Math.abs(lat) < 10 ? lat.toFixed(3) : lat.toFixed(2);
    const lngFormatted = Math.abs(lng) < 10 ? lng.toFixed(3) : lng.toFixed(2);
    return `${latFormatted}, ${lngFormatted}`;
  }

  /**
   * Pas de limite de taux - recherche INSTANTANÉE
   */
  private async respectRateLimit(): Promise<void> {
    // ZÉRO délai pour une performance maximale
    this.lastCallTime = Date.now();
  }

  /**
   * Géocodage en lot ultra-optimisé pour des performances maximales
   */
  async batchGeocode(coordinates: Array<{lat: number, lng: number}>): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const uncached = new Array<{lat: number, lng: number, key: string}>();
    
    // Vérifier le cache préchargé et dynamique (ULTRA-RAPIDE)
    for (const coord of coordinates) {
      const cacheKey = `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;
      
      // Cache préchargé INSTANTANÉ
      const precached = this.PRECACHED_LOCATIONS.get(cacheKey);
      if (precached) {
        results.set(cacheKey, precached);
        console.log(`⚡ [Geocoding] Cache préchargé INSTANTANÉ pour ${cacheKey}: ${precached}`);
        continue;
      }
      
      // Cache dynamique
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        results.set(cacheKey, cached.name);
        console.log(`🗺️ [Geocoding] Cache hit pour ${cacheKey}: ${cached.name}`);
      } else {
        uncached.push({...coord, key: cacheKey});
      }
    }
    
    // Traiter les coordonnées non mises en cache par lots parallèles
    if (uncached.length > 0) {
      console.log(`🗺️ [Geocoding] Traitement ultra-rapide de ${uncached.length} coordonnées`);
      
      // Traiter par lots de BATCH_SIZE pour éviter la surcharge
      for (let i = 0; i < uncached.length; i += this.BATCH_SIZE) {
        const batch = uncached.slice(i, i + this.BATCH_SIZE);
        
        const batchPromises = batch.map(async (coord) => {
          try {
            // Pas de limite de taux entre les appels du même lot
            const location = await this.getLocationFromCoordinatesFast(coord.lat, coord.lng);
            results.set(coord.key, location);
            return { key: coord.key, location };
          } catch (error) {
            console.error(`❌ [Geocoding] Erreur pour ${coord.key}:`, error);
            const fallback = this.formatCoordinatesAsFallback(coord.lat, coord.lng);
            results.set(coord.key, fallback);
            return { key: coord.key, location: fallback };
          }
        });
        
        await Promise.all(batchPromises);
        
        // Pas de pause - traitement INSTANTANÉ
      }
    }
    
    return results;
  }

  /**
   * Précharger intelligemment les coordonnées communes
   */
  preloadCommonLocations(): void {
    console.log('🚀 [Geocoding] Préchargement des localisations communes...');
    
    // Précharger dans le cache dynamique pour une accessibilité maximale
    this.PRECACHED_LOCATIONS.forEach((location, coords) => {
      this.cache.set(coords, {
        name: location,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      });
    });
    
    console.log(`⚡ [Geocoding] ${this.PRECACHED_LOCATIONS.size} localisations préchargées !`);
  }

  /**
   * Version ultra-rapide sans limite de taux (pour le traitement en lot)
   */
  private async getLocationFromCoordinatesFast(lat: number, lng: number): Promise<string> {
    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    
    // Cache préchargé INSTANTANÉ
    const precached = this.PRECACHED_LOCATIONS.get(cacheKey);
    if (precached) {
      return precached;
    }
    
    // Cache dynamique
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.name;
    }

    try {
      console.log(`🗺️ [Geocoding] Appel backend rapide pour ${lat}, ${lng}`);
      
      const response = await fetch('/api/geocoding/reverse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.formatted_address) {
        throw new Error('Aucun nom de lieu trouvé');
      }
      
      // Mettre en cache immédiatement
      this.cache.set(cacheKey, {
        name: data.formatted_address,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      });

      return data.formatted_address;

    } catch (error) {
      console.error(`❌ [Geocoding] Erreur pour ${lat}, ${lng}:`, error);
      return this.formatCoordinatesAsFallback(lat, lng);
    }
  }

  /**
   * Vider le cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗺️ [Geocoding] Cache vidé');
  }

  /**
   * Obtenir les statistiques du cache
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).filter(
        entry => Date.now() < entry.expiresAt
      ).length
    };
  }
}

export const geocodingService = new GeocodingService(); 