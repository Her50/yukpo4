# Guide d'intégration de l'API Météo

## ✅ Ce qui a été implémenté

### 1. Endpoint Backend Rust
- **Route ajoutée** : `/api/weather/config`
- **Fichier modifié** : `backend/src/routes/weather_routes.rs`
- **Fonction** : `get_weather_config()` qui expose la clé API OpenWeatherMap

### 2. App Mobile React Native
- **Configuration** : `mobile/src/config/weatherConfig.ts`
- **Fonction** : `getWeatherApiKey()` qui récupère la clé depuis le backend
- **Composants** : `WeatherWidget.tsx` et `WeatherForecastModal.tsx` mis à jour

## 🚀 Comment tester

### 1. Démarrer le backend
```bash
cd backend
cargo run
```

### 2. Tester l'endpoint
```bash
# Dans le dossier backend
.\test_weather_endpoint.ps1
```

### 3. Vérifier la réponse
L'endpoint `/api/weather/config` doit retourner :
```json
{
  "apiKey": "votre_cle_api_openweathermap",
  "status": "success",
  "message": "Configuration météo récupérée avec succès"
}
```

## 🔧 Configuration requise

### Variable d'environnement backend
Assurez-vous que votre fichier `.env` du backend contient :
```bash
OPENWEATHER_API_KEY=votre_cle_api_openweathermap
```

### URL du backend dans le mobile
Vérifiez que `mobile/src/config/weatherConfig.ts` pointe vers le bon backend :
```typescript
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
```

## 📱 Test de l'app mobile

### 1. Démarrer l'app mobile
```bash
cd mobile
npm run dev
```

### 2. Tester la météo
1. Cliquez sur l'icône météo dans le header
2. Vérifiez que les prévisions s'affichent
3. Testez les différentes périodes (5, 7, 10, 16 jours)

## 🐛 Dépannage

### Problème : "API key manquante"
- Vérifiez que `OPENWEATHER_API_KEY` est définie dans le backend
- Redémarrez le backend après modification du `.env`

### Problème : "Erreur de connexion"
- Vérifiez que le backend est démarré sur le bon port
- Vérifiez l'URL dans `weatherConfig.ts`

### Problème : Données mockées
- L'app utilise des données simulées si l'API n'est pas accessible
- C'est normal pour le développement

## 📊 Avantages de cette intégration

✅ **Sécurité** : La clé API reste dans le backend
✅ **Maintenance** : Une seule source de vérité
✅ **Flexibilité** : Support des prévisions 5-16 jours
✅ **Fallback** : Données mockées en cas d'erreur
✅ **Performance** : Cache et optimisations intégrées

## 🔄 Flux de données

```
App Mobile → Backend /api/weather/config → Clé API → OpenWeatherMap → Données météo → App Mobile
```

## 📝 Prochaines étapes

1. **Tester l'endpoint** avec le script PowerShell
2. **Vérifier l'intégration** dans l'app mobile
3. **Lancer le build final** avec la vraie API météo
4. **Déployer** en production

## 🎯 Résultat attendu

Une fois configuré, votre app mobile affichera :
- **Températures réelles** de votre ville
- **Prévisions précises** sur 5-16 jours
- **Données météo détaillées** (humidité, vent, précipitations)
- **Interface moderne** avec sélecteur de période

