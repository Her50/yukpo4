# Script de correction du problème GPS figé
# Problème : Coordonnées GPS figées 'P3J4+RM Tunga Maje, Nigeria'
# Solution : Corriger l'extraction GPS et les fallbacks

# RÉSUMÉ DU PROBLÈME
# ===================
# Les services affichent toujours les coordonnées "P3J4+RM Tunga Maje, Nigeria" 
# au lieu des vraies coordonnées GPS sélectionnées lors de la création

# CAUSES IDENTIFIÉES
# ===================
# 1. Fonction getServiceFieldValue ne parvient pas à extraire les coordonnées GPS correctement
# 2. Coordonnées par défaut du Nigeria (9.818276,4.033640) utilisées comme fallback
# 3. Service de géocodage retourne des résultats incorrects

# CORRECTIONS À APPLIQUER
# ========================

# 1. CORRIGER LA FONCTION getServiceFieldValue
# Cette fonction doit mieux gérer l'extraction des coordonnées GPS des services

function getServiceFieldValueFixed(field) {
  if (!field) return 'Non spécifié';
  
  // Cas 1: String simple
  if (typeof field === 'string') return field;
  
  // Cas 2: Objet avec valeur - CORRECTION IMPORTANTE
  if (field && typeof field === 'object') {
    if (field.valeur !== undefined) {
      const value = field.valeur;
      if (typeof value === 'string') return value;
      if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
      if (typeof value === 'number') return value.toString();
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    }
    
    // Essayer d'autres propriétés communes
    const possibleKeys = ['value', 'content', 'text', 'data', 'info', 'val'];
    for (const key of possibleKeys) {
      if (field[key] !== undefined) {
        const value = field[key];
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        return String(value);
      }
    }
  }
  
  // Cas 3: Autres types
  if (typeof field === 'boolean') return field ? 'Oui' : 'Non';
  if (typeof field === 'number') return field.toString();
  
  return 'Non spécifié';
}

# 2. AMÉLIORER LA LOGIQUE formatLocation
# Cette fonction doit détecter et ignorer les coordonnées Nigeria par défaut

function formatLocationFixed(service, prestatairesMap, currentUser) {
  console.log('🔍 [formatLocationFixed] Début avec service:', service?.id);
  
  // Fonction pour détecter les coordonnées Nigeria par défaut
  function isNigeriaDefaultCoords(lat, lng) {
    return (
      (Math.abs(lat - 9.818276) < 0.001 && Math.abs(lng - 4.033640) < 0.001) ||
      (Math.abs(lat - 9.818119) < 0.001 && Math.abs(lng - 4.033687) < 0.001) ||
      (lat >= 9.0 && lat <= 10.0 && lng >= 4.0 && lng <= 5.0) // Zone Nigeria générale
    );
  }
  
  // 1. Priorité absolue: GPS fixe du service
  if (service?.data?.gps_fixe) {
    const gpsFixe = getServiceFieldValueFixed(service.data.gps_fixe);
    console.log('📍 [formatLocationFixed] GPS fixe trouvé:', gpsFixe);
    
    if (gpsFixe && gpsFixe !== 'Non spécifié') {
      if (typeof gpsFixe === 'string' && gpsFixe.includes(',')) {
        const coords = gpsFixe.split(',').map(coord => parseFloat(coord.trim()));
        if (coords.length === 2 && !coords.some(isNaN)) {
          const [lat, lng] = coords;
          
          if (!isNigeriaDefaultCoords(lat, lng)) {
            console.log('✅ [formatLocationFixed] Utilisation GPS fixe valide:', gpsFixe);
            return convertGpsToLocation(gpsFixe);
          } else {
            console.log('⚠️ [formatLocationFixed] GPS fixe détecté comme Nigeria par défaut, ignoré');
          }
        }
      } else {
        return gpsFixe; // Adresse textuelle
      }
    }
  }
  
  // 2. Priorité: GPS du prestataire (service.gps)
  if (service?.gps && service.gps !== 'Non spécifié') {
    if (typeof service.gps === 'string' && service.gps.includes(',')) {
      const coords = service.gps.split(',').map(coord => parseFloat(coord.trim()));
      if (coords.length === 2 && !coords.some(isNaN)) {
        const [lat, lng] = coords;
        
        if (!isNigeriaDefaultCoords(lat, lng)) {
          console.log('✅ [formatLocationFixed] Utilisation GPS prestataire valide:', service.gps);
          return convertGpsToLocation(service.gps);
        } else {
          console.log('⚠️ [formatLocationFixed] GPS prestataire détecté comme Nigeria par défaut, ignoré');
        }
      }
    }
  }
  
  // 3. Priorité: Adresse textuelle
  if (service?.data?.adresse) {
    const adresse = getServiceFieldValueFixed(service.data.adresse);
    if (adresse && adresse !== 'Non spécifié') {
      console.log('✅ [formatLocationFixed] Utilisation adresse textuelle:', adresse);
      return adresse;
    }
  }
  
  // 4. Fallback final : Localisation non disponible
  console.log('❌ [formatLocationFixed] Aucune localisation valide trouvée');
  return 'Localisation non disponible';
}

# 3. CORRIGER LE SERVICE DE GÉOCODAGE
# Le service doit éviter de retourner des coordonnées Nigeria par défaut

function geocodingServiceFixed() {
  // Supprimer le cache prédéfini qui causait la confusion
  this.PRECACHED_LOCATIONS = new Map();
  
  // Améliorer la fonction getLocationFromCoordinates
  this.getLocationFromCoordinates = async function(lat, lng) {
    // Détecter les coordonnées Nigeria par défaut
    const isNigeriaDefault = (
      (Math.abs(lat - 9.818276) < 0.001 && Math.abs(lng - 4.033640) < 0.001) ||
      (Math.abs(lat - 9.818119) < 0.001 && Math.abs(lng - 4.033687) < 0.001)
    );
    
    if (isNigeriaDefault) {
      console.log('⚠️ [geocodingServiceFixed] Coordonnées Nigeria par défaut détectées, retour fallback');
      return 'Localisation non disponible';
    }
    
    // Continuer avec la logique normale de géocodage
    // ... (reste de la logique existante)
  };
}

console.log('✅ Script de correction GPS créé avec succès');
console.log('📋 ACTIONS À EFFECTUER:');
console.log('1. Remplacer getServiceFieldValue par getServiceFieldValueFixed');
console.log('2. Remplacer formatLocation par formatLocationFixed');
console.log('3. Mettre à jour le service de géocodage');
console.log('4. Corriger les coordonnées par défaut dans la base de données');
