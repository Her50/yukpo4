# 🗺️ Guide de Vérification - Configuration Google Maps API

## 📋 Vérification Automatique (Recommandé)

### 1. Endpoint de Santé
Appelez l'endpoint de santé pour vérifier automatiquement la configuration :

```bash
GET /api/health/google-maps
```

**Réponse si OK :**
```json
{
  "google_maps_api_key_configured": true,
  "api_key_present": true,
  "test_result": {
    "distance_meters": 245000.0,
    "duration_seconds": 10800.0,
    "source": "GoogleMaps"
  },
  "status": "available",
  "message": "✅ Google Maps Distance Matrix API est disponible et fonctionne"
}
```

**Réponse si non configuré :**
```json
{
  "google_maps_api_key_configured": false,
  "status": "not_configured",
  "fallback": "Haversine distance calculation",
  "message": "ℹ️ Google Maps API Key non configurée. Utilisation de Haversine pour les calculs de distance."
}
```

---

## 🔧 Configuration dans Google Cloud Console

### Étape 1 : Accéder à Google Cloud Console
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Connectez-vous avec votre compte Google
3. Sélectionnez ou créez un projet

### Étape 2 : Activer les APIs nécessaires
1. Allez dans **APIs & Services** > **Library**
2. Recherchez et activez :
   - ✅ **Distance Matrix API** (obligatoire pour les calculs de distance routière)
   - ✅ **Geocoding API** (déjà utilisé dans le projet)
   - ✅ **Maps JavaScript API** (pour les composants frontend)
   - ✅ **Places API** (pour l'autocomplete de lieux)

### Étape 3 : Créer une Clé API
1. Allez dans **APIs & Services** > **Credentials**
2. Cliquez sur **+ CREATE CREDENTIALS** > **API Key**
3. Copiez la clé générée
4. **IMPORTANT** : Configurez les restrictions :
   - **Application restrictions** : 
     - HTTP referrers (web sites) : Ajoutez vos domaines
     - IP addresses : Ajoutez les IPs de vos serveurs
   - **API restrictions** :
     - Restreignez aux APIs nécessaires uniquement :
       - Distance Matrix API
       - Geocoding API
       - Maps JavaScript API
       - Places API

### Étape 4 : Configurer dans le Projet

#### Backend (.env)
```env
GOOGLE_MAPS_API_KEY=votre_cle_api_ici
```

#### Frontend (.env)
```env
VITE_APP_GOOGLE_MAPS_API_KEY=votre_cle_api_ici
```

#### Mobile (config/environment.ts)
```typescript
GOOGLE_MAPS_API_KEY: 'votre_cle_api_ici'
```

---

## ✅ Vérification Manuelle

### 1. Vérifier la Variable d'Environnement

**Backend :**
```bash
# Windows PowerShell
$env:GOOGLE_MAPS_API_KEY

# Linux/Mac
echo $GOOGLE_MAPS_API_KEY
```

**Ou dans le fichier .env :**
```env
GOOGLE_MAPS_API_KEY=AIzaSy...votre_cle
```

### 2. Tester l'API Directement

```bash
curl "https://maps.googleapis.com/maps/api/distancematrix/json?origins=3.8480,11.5021&destinations=4.0511,9.7679&key=VOTRE_CLE&units=metric&language=fr"
```

**Réponse attendue :**
```json
{
  "destination_addresses": ["Douala, Cameroun"],
  "origin_addresses": ["Yaoundé, Cameroun"],
  "rows": [{
    "elements": [{
      "distance": {"text": "245 km", "value": 245000},
      "duration": {"text": "3 heures", "value": 10800},
      "status": "OK"
    }]
  }],
  "status": "OK"
}
```

### 3. Vérifier les Quotas et Facturation

1. Allez dans **APIs & Services** > **Dashboard**
2. Vérifiez l'utilisation de **Distance Matrix API**
3. Vérifiez les quotas :
   - **Free tier** : 40,000 requêtes/mois
   - **Pay-as-you-go** : $5.00 par 1000 requêtes après le free tier

---

## 🚨 Problèmes Courants

### Erreur : "REQUEST_DENIED"
- **Cause** : Clé API invalide ou restrictions trop strictes
- **Solution** : Vérifiez les restrictions dans Google Cloud Console

### Erreur : "OVER_QUERY_LIMIT"
- **Cause** : Quota dépassé
- **Solution** : Vérifiez l'utilisation dans Google Cloud Console, augmentez les quotas si nécessaire

### Erreur : "API not enabled"
- **Cause** : Distance Matrix API non activée
- **Solution** : Activez l'API dans Google Cloud Console

### Le système utilise toujours Haversine
- **Cause** : Variable d'environnement non configurée ou erreur de connexion
- **Solution** : 
  1. Vérifiez que `GOOGLE_MAPS_API_KEY` est bien définie
  2. Redémarrez le serveur backend
  3. Vérifiez les logs pour les erreurs de connexion

---

## 📊 Monitoring

### Vérifier l'Utilisation
1. Google Cloud Console > **APIs & Services** > **Dashboard**
2. Sélectionnez **Distance Matrix API**
3. Consultez les métriques :
   - Requêtes par jour
   - Erreurs
   - Coûts

### Logs Backend
Le backend log automatiquement :
- ✅ Utilisation de Google Maps : `[GeographicMatching] Distance Google Maps: {}m`
- ⚠️ Fallback Haversine : `[GeographicMatching] Erreur Google Maps, fallback Haversine`

---

## 🎯 Avantages de Google Maps Distance Matrix

1. **Distances Routières Réelles** : Prend en compte les routes, pas seulement la distance à vol d'oiseau
2. **Durée de Trajet** : Fournit aussi le temps de trajet estimé
3. **Trafic en Temps Réel** : Peut inclure le trafic actuel (optionnel)
4. **Précision** : Plus précis que Haversine pour les calculs de livraison

---

## 🔄 Fallback Automatique

Le système utilise automatiquement **Haversine** si :
- Google Maps API Key n'est pas configurée
- Une erreur survient lors de l'appel API
- Le quota est dépassé

**Aucune action requise** - le système fonctionne toujours, mais avec moins de précision.


