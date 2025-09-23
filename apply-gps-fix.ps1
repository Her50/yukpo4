# apply-gps-fix.ps1
# Script pour appliquer la correction GPS automatiquement

Write-Host "🔧 Application de la correction GPS" -ForegroundColor Green

# 1. Créer un fichier de correction pour ResultatBesoin_clean.tsx
Write-Host "`n📝 Création du fichier de correction..." -ForegroundColor Yellow

$correctionContent = @"
// === CORRECTION GPS NIGERIA PAR DÉFAUT ===
// Ajouté automatiquement le $(Get-Date)

// Fonction pour détecter les coordonnées Nigeria par défaut
const isNigeriaDefaultCoords = (lat: number, lng: number): boolean => {
  const nigeriaCoords = [
    { lat: 9.818276, lng: 4.033640 },
    { lat: 9.818119, lng: 4.033687 },
  ];
  
  const tolerance = 0.001;
  
  for (const coord of nigeriaCoords) {
    if (Math.abs(lat - coord.lat) < tolerance && Math.abs(lng - coord.lng) < tolerance) {
      return true;
    }
  }
  
  if (lat >= 9.5 && lat <= 10.5 && lng >= 3.5 && lng <= 4.5) {
    return true;
  }
  
  return false;
};

// Fonction convertGpsToLocation corrigée
const convertGpsToLocationFixed = async (gpsString: string): Promise<string | null> => {
  if (!gpsString || !gpsString.includes(',')) return gpsString;
  
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
    
    // Détecter les coordonnées Nigeria par défaut
    if (isNigeriaDefaultCoords(lat, lng)) {
      console.log('🚫 Coordonnées Nigeria par défaut détectées, ignorées');
      return null;
    }
    
    const locationName = await geocodingService.getLocationFromCoordinates(lat, lng);
    const optimizedName = optimizeLocationName(locationName);
    
    return optimizedName;
    
  } catch (error) {
    console.error('❌ Erreur convertGpsToLocationFixed:', error);
    return gpsString;
  }
};

// Fonction formatLocation corrigée
const formatLocationFixed = async (service: any, prestatairesMap: Map<number, any>, currentUser: any): Promise<string> => {
  console.log('🏠 [formatLocationFixed] Début avec service:', service?.id);
  
  // 1. Priorité: gps_fixe - AVEC DÉTECTION NIGERIA
  if (service?.data?.gps_fixe) {
    const gpsFixe = getServiceFieldValue(service.data.gps_fixe);
    
    if (gpsFixe && gpsFixe !== 'Non spécifié') {
      if (typeof gpsFixe === 'string' && gpsFixe.includes(',')) {
        const location = await convertGpsToLocationFixed(gpsFixe);
        
        if (location === null) {
          console.log('🚫 Coordonnées Nigeria ignorées, passage à l\'adresse');
        } else {
          return location;
        }
      } else {
        return gpsFixe;
      }
    }
  }
  
  // 2. Priorité: adresse textuelle
  if (service?.data?.adresse) {
    const adresse = getServiceFieldValue(service.data.adresse);
    if (adresse && adresse !== 'Non spécifié') {
      console.log(`✅ Utilisation de l'adresse: ${adresse}`);
      return adresse;
    }
  }
  
  // 3. Autres priorités...
  return 'Localisation non disponible';
};

// === FIN CORRECTION ===
"@

$correctionContent | Out-File -FilePath "gps-fix-correction.txt" -Encoding UTF8

Write-Host "✅ Fichier de correction créé: gps-fix-correction.txt" -ForegroundColor Green

# 2. Instructions pour l'application manuelle
Write-Host "`n📋 Instructions pour appliquer la correction:" -ForegroundColor Yellow
Write-Host "1. Ouvrez le fichier: frontend/src/pages/ResultatBesoin_clean.tsx" -ForegroundColor White
Write-Host "2. Ajoutez les fonctions de correction au début du fichier (après les imports)" -ForegroundColor White
Write-Host "3. Remplacez les appels à formatLocation par formatLocationFixed" -ForegroundColor White
Write-Host "4. Remplacez les appels à convertGpsToLocation par convertGpsToLocationFixed" -ForegroundColor White

Write-Host "`n📁 Fichiers à modifier:" -ForegroundColor Cyan
Write-Host "- frontend/src/pages/ResultatBesoin_clean.tsx" -ForegroundColor White
Write-Host "- frontend/src/pages/RechercheBesoin.tsx" -ForegroundColor White
Write-Host "- frontend/src/components/location/LocationDisplay.tsx" -ForegroundColor White

Write-Host "`n🔍 Vérification des fichiers à corriger:" -ForegroundColor Yellow

$filesToCheck = @(
    "frontend/src/pages/ResultatBesoin_clean.tsx",
    "frontend/src/pages/RechercheBesoin.tsx",
    "frontend/src/components/location/LocationDisplay.tsx"
)

foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "✅ $file - Existe" -ForegroundColor Green
    }
    else {
        Write-Host "❌ $file - Non trouvé" -ForegroundColor Red
    }
}

Write-Host "`n🎯 Correction GPS prête à être appliquée !" -ForegroundColor Green
Write-Host "`n💡 Conseil: Testez d'abord sur un fichier pour vérifier que la correction fonctionne." -ForegroundColor Cyan


