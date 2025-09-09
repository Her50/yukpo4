# Script simple pour optimiser les performances
# Ajout d'un cache global pour éviter les appels répétés

$content = Get-Content "src/pages/ResultatBesoin.tsx" -Raw

# Ajouter un cache global au début du fichier
$cacheCode = @'
// Cache global pour éviter les appels répétés de géocodage
const globalLocationCache = new Map<string, string>();

// Fonction optimisée pour le géocodage avec cache global
const getCachedLocation = async (gpsString: string): Promise<string> => {
  if (!gpsString || !gpsString.includes(',')) return gpsString;
  
  // Vérifier le cache d'abord
  if (globalLocationCache.has(gpsString)) {
    console.log('🗺️ [Cache] Hit pour:', gpsString);
    return globalLocationCache.get(gpsString)!;
  }
  
  try {
    const coords = gpsString.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length !== 2 || coords.some(isNaN)) return gpsString;
    
    let lat, lng;
    if (coords[0] >= -90 && coords[0] <= 90) {
      lat = coords[0];
      lng = coords[1];
    } else if (coords[1] >= -90 && coords[1] <= 90) {
      lat = coords[1];
      lng = coords[0];
    } else {
      lat = coords[0];
      lng = coords[1];
    }
    
    const locationName = await geocodingService.getLocationFromCoordinates(lat, lng);
    const optimizedName = optimizeLocationName(locationName);
    
    // Mettre en cache
    globalLocationCache.set(gpsString, optimizedName);
    console.log('🗺️ [Cache] Mis en cache:', gpsString, '->', optimizedName);
    
    return optimizedName;
  } catch (error) {
    console.error('❌ [getCachedLocation] Erreur:', error);
    return gpsString;
  }
};

'@

# Ajouter le cache au début du fichier, après les imports
$content = $content -replace 'import { Service, Review } from '@/types/service';', 'import { Service, Review } from '@/types/service';

' + $cacheCode

# Remplacer les appels directs par des appels avec cache
$content = $content -replace 'await geocodingService\.getLocationFromCoordinates\(lat, lng\);', 'await getCachedLocation(gpsString);'

# Sauvegarder le fichier optimisé
$content | Out-File "src/pages/ResultatBesoin.tsx" -Encoding UTF8

Write-Host "✅ Cache global ajouté pour optimiser les performances!" 