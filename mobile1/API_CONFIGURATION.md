# 🔑 Configuration des Clés API - Yukpomnang Mobile

## 📋 Variables d'Environnement Requises

### 1. Configuration Backend (Obligatoire)
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api
EXPO_PUBLIC_API_TIMEOUT=10000
```

### 2. Configuration Application (Obligatoire)
```bash
EXPO_PUBLIC_APP_NAME=Yukpomnang
EXPO_PUBLIC_APP_VERSION=1.0.0
```

### 3. Services Externes (Optionnel)
```bash
# Google Maps (pour la géolocalisation)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Mapbox (alternative à Google Maps)
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
```

### 4. Configuration Développement (Optionnel)
```bash
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_LOG_LEVEL=debug
```

## 🚀 Étapes de Configuration

### Étape 1: Créer le fichier .env
1. Copiez le fichier `config.env` vers `.env` :
   ```bash
   cp config.env .env
   ```

2. Modifiez les valeurs selon votre configuration :
   ```bash
   # Remplacez localhost:3000 par votre URL de production
   EXPO_PUBLIC_API_BASE_URL=https://votre-api.com/api
   
   # Ajoutez vos clés API
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBvOkBwvOkBwvOkBwvOkBwvOkBwvOkBwvOk
   ```

### Étape 2: Configuration Google Maps (Optionnel)
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API "Maps SDK for Android" et "Maps SDK for iOS"
4. Créez des clés API :
   - Une pour Android (avec restriction par package)
   - Une pour iOS (avec restriction par bundle ID)
5. Ajoutez les clés dans votre fichier `.env`

### Étape 3: Configuration Mapbox (Optionnel)
1. Créez un compte sur [Mapbox](https://www.mapbox.com/)
2. Générez un token d'accès
3. Ajoutez le token dans votre fichier `.env`

## 🔒 Sécurité

### ⚠️ Important
- **NE JAMAIS** commiter le fichier `.env` dans Git
- Utilisez des clés API avec des restrictions appropriées
- Pour la production, utilisez des variables d'environnement sécurisées

### Restrictions Recommandées
- **Google Maps** : Restriction par package (Android) et bundle ID (iOS)
- **Mapbox** : Restriction par domaine et usage
- **Backend API** : Authentification JWT et HTTPS obligatoire

## 🧪 Test de Configuration

### Vérifier la Configuration
```bash
# Dans le dossier mobile/
npm run start

# Vérifiez dans les logs que les variables sont chargées
```

### Test des Services
1. **API Backend** : Vérifiez que l'authentification fonctionne
2. **Géolocalisation** : Testez la récupération de position
3. **Maps** : Vérifiez l'affichage des cartes (si configuré)

## 🚀 Configuration Production

### Variables d'Environnement Production
```bash
EXPO_PUBLIC_API_BASE_URL=https://api.yukpomnang.com
EXPO_PUBLIC_DEBUG_MODE=false
EXPO_PUBLIC_LOG_LEVEL=error
```

### Configuration EAS Build
Les variables d'environnement sont automatiquement incluses dans les builds EAS.

## 📱 Configuration par Plateforme

### iOS
- Bundle ID : `com.yukpomnang.mobile`
- Google Maps : Clé avec restriction iOS
- Permissions : Location, Camera, Photo Library

### Android
- Package Name : `com.yukpomnang.mobile`
- Google Maps : Clé avec restriction Android
- Permissions : Location, Camera, Storage

## 🔧 Dépannage

### Problèmes Courants
1. **API non accessible** : Vérifiez l'URL et les CORS
2. **Géolocalisation** : Vérifiez les permissions
3. **Maps** : Vérifiez les clés API et restrictions
4. **Build échoue** : Vérifiez les variables d'environnement

### Logs de Debug
```bash
# Activer les logs détaillés
EXPO_PUBLIC_DEBUG_MODE=true
EXPO_PUBLIC_LOG_LEVEL=debug
```

