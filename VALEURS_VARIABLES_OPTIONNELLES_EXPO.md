# 📋 Valeurs des Variables Optionnelles Expo

**Date** : 2026-02-14  
**Fichier de référence** : `mobile/production (7).json`

---

## 🎯 RÉSUMÉ

**Valeurs recommandées et valeurs par défaut pour les variables optionnelles Expo.**

---

## 📊 VARIABLES OPTIONNELLES

### 1. Google OAuth (iOS/Android Client IDs)

Ces variables sont utilisées pour l'authentification Google OAuth spécifique à chaque plateforme.

#### `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

**Utilisation** : `LoginScreen.tsx`, `RegisterScreen.tsx`  
**Fallback** : `undefined` (utilise `EXPO_PUBLIC_GOOGLE_CLIENT_ID` par défaut)  
**Valeur recommandée** : Client ID iOS depuis Google Cloud Console

```json
{
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "[CLIENT_ID_IOS_GOOGLE_CLOUD_CONSOLE]"
}
```

**Comment obtenir** :
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. APIs & Services → Credentials
4. Créez un OAuth 2.0 Client ID pour iOS
5. Copiez le Client ID

**Exemple** (format) :
```
738929393617-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

---

#### `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

**Utilisation** : `LoginScreen.tsx`, `RegisterScreen.tsx`  
**Fallback** : `undefined` (utilise `EXPO_PUBLIC_GOOGLE_CLIENT_ID` par défaut)  
**Valeur recommandée** : Client ID Android depuis Google Cloud Console

```json
{
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "[CLIENT_ID_ANDROID_GOOGLE_CLOUD_CONSOLE]"
}
```

**Comment obtenir** :
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. APIs & Services → Credentials
4. Créez un OAuth 2.0 Client ID pour Android
5. Copiez le Client ID

**Exemple** (format) :
```
738929393617-yyyyyyyyyyyyyyyyyyyyyyyy.apps.googleusercontent.com
```

**Note** : Si non définie, l'app affichera un message d'erreur sur Android demandant de configurer cette variable.

---

### 2. Analytics Sagaci Research

Ces variables sont utilisées pour l'intégration avec Sagaci Research (base de données produits africains).

#### `EXPO_PUBLIC_SAGACI_API_KEY`

**Utilisation** : `mobile/src/config/environment.ts`  
**Fallback** : `''` (vide - désactivé par défaut)  
**Valeur recommandée** : Clé API Sagaci (obtenue via contact commercial)

```json
{
  "EXPO_PUBLIC_SAGACI_API_KEY": "[SAGACI_API_KEY]"
}
```

**Comment obtenir** :
1. Contactez Sagaci Research : https://sagaciresearch.com
2. Demandez un accès API commercial
3. Obtenez votre clé API

**Exemple** (format) :
```
STRIPE_API_KEY=your_stripe_secret_key_here
```

---

#### `EXPO_PUBLIC_SAGACI_API_URL`

**Utilisation** : `mobile/src/config/environment.ts`  
**Fallback** : `'https://api.sagaciresearch.com/v1'`  
**Valeur recommandée** : URL de l'API Sagaci (déjà configurée par défaut)

```json
{
  "EXPO_PUBLIC_SAGACI_API_URL": "https://api.sagaciresearch.com/v1"
}
```

**Note** : Cette valeur est déjà configurée par défaut, vous n'avez pas besoin de la redéfinir sauf si Sagaci vous fournit une URL différente.

---

#### `EXPO_PUBLIC_SAGACI_ENABLED`

**Utilisation** : `mobile/src/config/environment.ts`  
**Fallback** : `'false'` (désactivé par défaut)  
**Valeur recommandée** : `'true'` pour activer Sagaci

```json
{
  "EXPO_PUBLIC_SAGACI_ENABLED": "true"
}
```

**Valeurs possibles** :
- `"true"` : Active Sagaci Research
- `"false"` : Désactive Sagaci Research (défaut)

---

### 3. Monitoring Sentry

Ces variables sont utilisées pour le monitoring et le tracking d'erreurs avec Sentry.

#### `EXPO_PUBLIC_SENTRY_DSN`

**Utilisation** : `mobile/src/observability/index.ts`  
**Fallback** : `''` (vide - désactivé par défaut)  
**Valeur recommandée** : DSN Sentry depuis votre projet Sentry

```json
{
  "EXPO_PUBLIC_SENTRY_DSN": "https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@xxxxxx.ingest.sentry.io/xxxxxx"
}
```

**Comment obtenir** :
1. Allez sur [Sentry](https://sentry.io/)
2. Créez un projet ou sélectionnez votre projet existant
3. Allez dans Settings → Client Keys (DSN)
4. Copiez le DSN

**Exemple** (format) :
```
https://abc123def456@123456.ingest.sentry.io/789012
```

**Note** : Le DSN est visible dans `app.config.js` avec `sentryDsn: ""` (vide par défaut).

---

#### `EXPO_PUBLIC_APP_ENV`

**Utilisation** : `mobile/src/observability/index.ts`  
**Fallback** : `'production'` (ou `'development'` si `__DEV__` est true)  
**Valeur recommandée** : Environnement de l'application

```json
{
  "EXPO_PUBLIC_APP_ENV": "production"
}
```

**Valeurs possibles** :
- `"production"` : Production (défaut)
- `"development"` : Développement
- `"staging"` : Staging
- `"preview"` : Preview

**Note** : Cette variable est utilisée pour tagger les erreurs Sentry avec l'environnement.

---

### 4. Météo OpenWeather

Cette variable est utilisée pour l'API météo OpenWeather.

#### `EXPO_PUBLIC_OPENWEATHER_API_KEY`

**Utilisation** : `mobile/src/config/README_WEATHER.md`  
**Fallback** : `'YOUR_OPENWEATHER_API_KEY'` (placeholder)  
**Valeur recommandée** : Clé API OpenWeather

```json
{
  "EXPO_PUBLIC_OPENWEATHER_API_KEY": "[OPENWEATHER_API_KEY]"
}
```

**Comment obtenir** :
1. Allez sur [OpenWeather](https://openweathermap.org/api)
2. Créez un compte gratuit
3. Allez dans API Keys
4. Générez une clé API

**Exemple** (format) :
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Note** : Le plan gratuit permet 60 appels/minute et 1,000,000 appels/mois.

---

### 5. Feature Flags

Ces variables sont utilisées pour activer/désactiver des fonctionnalités dynamiquement.

#### `EXPO_PUBLIC_FEATURE_FLAG_*`

**Utilisation** : `mobile/src/contexts/FeatureFlagContext.tsx`  
**Fallback** : Variables dynamiques (non définies par défaut)  
**Valeur recommandée** : `"true"` ou `"false"` selon la fonctionnalité

```json
{
  "EXPO_PUBLIC_FEATURE_FLAG_NEW_FEATURE": "true",
  "EXPO_PUBLIC_FEATURE_FLAG_EXPERIMENTAL_UI": "false"
}
```

**Format** :
- Préfixe : `EXPO_PUBLIC_FEATURE_FLAG_`
- Nom : Nom de la fonctionnalité (en MAJUSCULES avec underscores)
- Valeur : `"true"` ou `"false"`

**Exemples** :
```json
{
  "EXPO_PUBLIC_FEATURE_FLAG_VIDEO_GENERATION": "true",
  "EXPO_PUBLIC_FEATURE_FLAG_AR_FILTERS": "false",
  "EXPO_PUBLIC_FEATURE_FLAG_PAYMENT_STRIPE": "true"
}
```

---

## 📋 EXEMPLE COMPLET : `production (7).json` avec Variables Optionnelles

```json
{
  "EXPO_PUBLIC_API_URL": "https://yukpo-backend-yukpo-project.a.run.app",
  "EXPO_PUBLIC_WS_URL": "wss://yukpo-backend-yukpo-project.a.run.app",
  "EXPO_PUBLIC_SHARE_URL": "https://yukpomnang.com",
  "EXPO_PUBLIC_ENVIRONMENT": "production",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
  "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ",
  "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
  "EXPO_PUBLIC_GCP_STORAGE_DIRECT_URL": "http://34.54.117.97",
  "EXPO_PUBLIC_CDN_GCP_URL": "http://34.54.117.97",
  "EXPO_PUBLIC_UPLOAD_BASE_URL": "http://34.54.117.97",
  "EXPO_PUBLIC_WASABI_DIRECT_URL": "http://34.54.117.97",
  "GRADLE_OPTS": "-Xmx6144m -XX:MaxMetaspaceSize=1024m",
  "EXPO_ANDROID_ARCHITECTURES": "arm64-v8a",
  
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "[CLIENT_ID_IOS]",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "[CLIENT_ID_ANDROID]",
  "EXPO_PUBLIC_SAGACI_API_KEY": "[SAGACI_API_KEY]",
  "EXPO_PUBLIC_SAGACI_API_URL": "https://api.sagaciresearch.com/v1",
  "EXPO_PUBLIC_SAGACI_ENABLED": "false",
  "EXPO_PUBLIC_SENTRY_DSN": "[SENTRY_DSN]",
  "EXPO_PUBLIC_APP_ENV": "production",
  "EXPO_PUBLIC_OPENWEATHER_API_KEY": "[OPENWEATHER_API_KEY]"
}
```

---

## ✅ CHECKLIST : Variables Optionnelles

### Google OAuth
- [ ] `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` - Client ID iOS (optionnel)
- [ ] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` - Client ID Android (optionnel)

### Analytics Sagaci
- [ ] `EXPO_PUBLIC_SAGACI_API_KEY` - Clé API Sagaci (optionnel)
- [ ] `EXPO_PUBLIC_SAGACI_API_URL` - URL API Sagaci (défaut: `https://api.sagaciresearch.com/v1`)
- [ ] `EXPO_PUBLIC_SAGACI_ENABLED` - Activer Sagaci (défaut: `false`)

### Monitoring Sentry
- [ ] `EXPO_PUBLIC_SENTRY_DSN` - DSN Sentry (optionnel)
- [ ] `EXPO_PUBLIC_APP_ENV` - Environnement (défaut: `production`)

### Météo OpenWeather
- [ ] `EXPO_PUBLIC_OPENWEATHER_API_KEY` - Clé API OpenWeather (optionnel)

### Feature Flags
- [ ] `EXPO_PUBLIC_FEATURE_FLAG_*` - Feature flags dynamiques (optionnel)

---

## 📝 NOTES IMPORTANTES

### ⚠️ Variables Non Obligatoires

**Toutes ces variables sont optionnelles** car elles ont des fallbacks dans le code. L'application fonctionnera sans elles.

### 🔐 Sécurité

**Ne commitez jamais les vraies valeurs** dans le repository. Utilisez :
- GitHub Secrets pour EAS Build
- Variables d'environnement locales pour le développement
- `.env` (dans `.gitignore`) pour le développement local

### 📊 Priorité des Valeurs

1. **Variables d'environnement** (`EXPO_PUBLIC_*`)
2. **Fallbacks dans le code** (valeurs par défaut)
3. **Valeurs hardcodées** (dernier recours)

---

**Date** : 2026-02-14  
**Statut** : ✅ **DOCUMENTATION COMPLÈTE DES VARIABLES OPTIONNELLES**


