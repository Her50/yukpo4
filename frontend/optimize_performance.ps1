# Script pour optimiser les performances de recherche
# Optimisation du géocodage et réduction des appels API

$content = Get-Content "src/services/geocodingService.ts" -Raw

# Ajouter un cache pour éviter les appels répétés
$cacheCode = @'
// Cache pour éviter les appels répétés
const geocodingCache = new Map<string, string>();

// Fonction pour nettoyer le cache périodiquement
setInterval(() => {
  if (geocodingCache.size > 1000) {
    geocodingCache.clear();
    console.log('🗺️ [Geocoding] Cache nettoyé');
  }
}, 300000); // 5 minutes

'@

# Remplacer la fonction getLocationFromCoordinates pour utiliser le cache
$content = $content -replace 'export const getLocationFromCoordinates = async \(lat: number, lng: number\): Promise<string> => \{', 'export const getLocationFromCoordinates = async (lat: number, lng: number): Promise<string> => {
  // Vérifier le cache d'abord
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (geocodingCache.has(cacheKey)) {
    console.log("🗺️ [Geocoding] Cache hit pour:", cacheKey);
    return geocodingCache.get(cacheKey)!;
  }'

# Ajouter le cache à la fin de la fonction
$content = $content -replace 'return locationName;', '  // Mettre en cache le résultat
  geocodingCache.set(cacheKey, locationName);
  return locationName;'

# Ajouter le code de cache au début du fichier
$content = $cacheCode + $content

# Sauvegarder le fichier optimisé
$content | Out-File "src/services/geocodingService.ts" -Encoding UTF8

Write-Host "✅ Géocodage optimisé avec cache pour éviter les appels répétés!" 