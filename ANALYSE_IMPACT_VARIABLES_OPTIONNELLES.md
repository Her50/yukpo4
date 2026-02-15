# 📊 Analyse : Impact des Variables Optionnelles

**Date** : 2026-02-14  
**Question** : Les variables optionnelles sont-elles impactantes ? Les valeurs par défaut sont-elles valides ?

---

## 🎯 RÉSUMÉ EXÉCUTIF

### ⚠️ Variable IMPACTANTE (Obligatoire sur Android)

- **`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`** : **OBLIGATOIRE sur Android** - Bloque l'authentification si non définie

### ✅ Variables NON IMPACTANTES (Fallbacks valides)

- **`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`** : Optionnel - Utilise `EXPO_PUBLIC_GOOGLE_CLIENT_ID` par défaut
- **`EXPO_PUBLIC_SAGACI_*`** : Optionnel - Désactivé par défaut
- **`EXPO_PUBLIC_SENTRY_DSN`** : Optionnel - Monitoring désactivé par défaut
- **`EXPO_PUBLIC_APP_ENV`** : Optionnel - Fallback automatique
- **`EXPO_PUBLIC_OPENWEATHER_API_KEY`** : Optionnel - Non utilisé si non défini

---

## 📋 ANALYSE DÉTAILLÉE

### 1. ⚠️ EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (IMPACTANTE)

#### Code Source

**Fichier** : `mobile/src/screens/auth/LoginScreen.tsx` (ligne 159-166)  
**Fichier** : `mobile/src/screens/auth/RegisterScreen.tsx` (ligne 169-176)

```typescript
// Vérifier que le Client ID Android est configuré sur Android
if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
  const errorMsg = 'Configuration OAuth Android manquante.\n\n' +
    'Veuillez définir EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID dans vos variables d\'environnement.\n\n' +
    'Consultez: mobile/GUIDE_FIX_GOOGLE_OAUTH_ANDROID.md';
  setError(errorMsg);
  Alert.alert('Configuration requise', errorMsg);
  setFormLoading(false);
  return; // ❌ BLOQUE L'AUTHENTIFICATION
}
```

#### Impact

- **Sur Android** : ❌ **BLOQUE l'authentification Google OAuth**
- **Sur iOS** : ✅ Fonctionne (pas de vérification)
- **Sur Web** : ✅ Fonctionne (utilise `webClientId`)

#### Fallback

- **Aucun fallback automatique** - Le code vérifie explicitement l'absence de la variable
- Si non définie, l'app affiche une erreur et bloque l'authentification

#### Conclusion

**⚠️ OBLIGATOIRE sur Android** - Doit être configurée pour que l'authentification Google fonctionne sur Android.

---

### 2. ✅ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (NON IMPACTANTE)

#### Code Source

**Fichier** : `mobile/src/screens/auth/LoginScreen.tsx` (ligne 50)  
**Fichier** : `mobile/src/screens/auth/RegisterScreen.tsx` (ligne 59)

```typescript
const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, // ✅ Pas de vérification
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com',
});
```

#### Impact

- **Sur iOS** : ✅ **Fonctionne** - Si non défini, utilise `expoClientId` par défaut
- **Sur Android** : ✅ Non utilisé
- **Sur Web** : ✅ Non utilisé

#### Fallback

- **Fallback automatique** : Utilise `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (ou la valeur hardcodée) si non défini
- La bibliothèque `expo-auth-session` gère automatiquement le fallback

#### Conclusion

**✅ OPTIONNEL** - Fonctionne sans cette variable, utilise le Client ID par défaut.

---

### 3. ✅ EXPO_PUBLIC_SAGACI_* (NON IMPACTANTES)

#### Code Source

**Fichier** : `mobile/src/config/environment.ts` (lignes 80-98)

```typescript
SAGACI: {
    API_KEY: process.env.EXPO_PUBLIC_SAGACI_API_KEY || '', // ✅ Fallback vide
    API_URL: process.env.EXPO_PUBLIC_SAGACI_API_URL || 'https://api.sagaciresearch.com/v1', // ✅ Fallback valide
    ENABLED: process.env.EXPO_PUBLIC_SAGACI_ENABLED === 'true', // ✅ Désactivé par défaut
    DEFAULT_COUNTRY: 'CM',
    CACHE_TTL: 3600000,
    DEFAULT_RADIUS_KM: 20,
}
```

#### Impact

- **Si non configuré** : ✅ **Fonctionne** - Sagaci est désactivé (`ENABLED = false`)
- **Si configuré** : Active l'intégration Sagaci Research (base de données produits africains)

#### Fallbacks

- **`API_KEY`** : `''` (vide) - Désactivé
- **`API_URL`** : `'https://api.sagaciresearch.com/v1'` - URL valide par défaut
- **`ENABLED`** : `false` - Désactivé par défaut

#### Conclusion

**✅ OPTIONNEL** - L'app fonctionne sans Sagaci. Les fallbacks sont valides.

---

### 4. ✅ EXPO_PUBLIC_SENTRY_DSN (NON IMPACTANTE)

#### Code Source

**Fichier** : `mobile/src/observability/index.ts` (ligne 178)

```typescript
const dsn = extra.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN; // ✅ Fallback vide
```

**Fichier** : `mobile/app.config.js` (ligne 177)

```javascript
sentryDsn: "", // ✅ Vide par défaut
```

#### Impact

- **Si non configuré** : ✅ **Fonctionne** - Sentry est désactivé (pas de monitoring d'erreurs)
- **Si configuré** : Active le monitoring Sentry (tracking d'erreurs)

#### Fallback

- **Fallback** : `''` (vide) - Sentry désactivé
- L'app fonctionne normalement sans Sentry

#### Conclusion

**✅ OPTIONNEL** - L'app fonctionne sans Sentry. Le fallback est valide.

---

### 5. ✅ EXPO_PUBLIC_APP_ENV (NON IMPACTANTE)

#### Code Source

**Fichier** : `mobile/src/observability/index.ts` (lignes 173-177)

```typescript
const envName =
    extra.environment ||
    extra.eas?.branch ||
    process.env.EXPO_PUBLIC_APP_ENV ||
    (__DEV__ ? 'development' : 'production'); // ✅ Fallback automatique
```

#### Impact

- **Si non configuré** : ✅ **Fonctionne** - Utilise `'production'` en production, `'development'` en dev
- **Si configuré** : Utilise la valeur spécifiée

#### Fallback

- **Fallback automatique** : `'production'` (ou `'development'` si `__DEV__ = true`)
- Valeur valide pour tous les cas d'usage

#### Conclusion

**✅ OPTIONNEL** - Le fallback est valide et automatique.

---

### 6. ✅ EXPO_PUBLIC_OPENWEATHER_API_KEY (NON IMPACTANTE)

#### Code Source

**Fichier** : `mobile/src/config/README_WEATHER.md`

```typescript
API_KEY: process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || 'YOUR_OPENWEATHER_API_KEY', // ✅ Placeholder
```

#### Impact

- **Si non configuré** : ✅ **Fonctionne** - Les fonctionnalités météo ne fonctionnent pas (mais l'app fonctionne)
- **Si configuré** : Active les fonctionnalités météo

#### Fallback

- **Fallback** : `'YOUR_OPENWEATHER_API_KEY'` (placeholder) - Non fonctionnel mais ne casse pas l'app

#### Conclusion

**✅ OPTIONNEL** - L'app fonctionne sans météo. Le fallback est valide (mais non fonctionnel).

---

## 📊 TABLEAU RÉCAPITULATIF

| Variable | Impact | Fallback | Valide ? | Obligatoire ? |
|----------|--------|----------|----------|---------------|
| **`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`** | ⚠️ **BLOQUE OAuth Android** | ❌ Aucun | ❌ Non | ✅ **OUI (Android)** |
| **`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`** | ✅ Fonctionne | ✅ `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | ✅ Oui | ❌ Non |
| **`EXPO_PUBLIC_SAGACI_API_KEY`** | ✅ Désactivé | ✅ `''` (vide) | ✅ Oui | ❌ Non |
| **`EXPO_PUBLIC_SAGACI_API_URL`** | ✅ Désactivé | ✅ `'https://api.sagaciresearch.com/v1'` | ✅ Oui | ❌ Non |
| **`EXPO_PUBLIC_SAGACI_ENABLED`** | ✅ Désactivé | ✅ `false` | ✅ Oui | ❌ Non |
| **`EXPO_PUBLIC_SENTRY_DSN`** | ✅ Désactivé | ✅ `''` (vide) | ✅ Oui | ❌ Non |
| **`EXPO_PUBLIC_APP_ENV`** | ✅ Auto | ✅ `'production'` / `'development'` | ✅ Oui | ❌ Non |
| **`EXPO_PUBLIC_OPENWEATHER_API_KEY`** | ✅ Désactivé | ✅ `'YOUR_OPENWEATHER_API_KEY'` | ✅ Oui | ❌ Non |

---

## ✅ CONCLUSIONS

### Variables Obligatoires

**1. `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`** ⚠️
- **Obligatoire sur Android** pour l'authentification Google OAuth
- **Doit être configurée** dans `mobile/production (7).json` et `mobile/eas.json`
- **Sans cette variable** : L'authentification Google est bloquée sur Android

### Variables Optionnelles (Fallbacks Valides)

**Toutes les autres variables optionnelles ont des fallbacks valides** :
- ✅ `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` : Utilise le Client ID par défaut
- ✅ `EXPO_PUBLIC_SAGACI_*` : Sagaci désactivé (pas d'impact)
- ✅ `EXPO_PUBLIC_SENTRY_DSN` : Sentry désactivé (pas d'impact)
- ✅ `EXPO_PUBLIC_APP_ENV` : Fallback automatique valide
- ✅ `EXPO_PUBLIC_OPENWEATHER_API_KEY` : Météo désactivée (pas d'impact)

---

## 🎯 RECOMMANDATIONS

### Pour Production

#### Obligatoire

```json
{
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "[CLIENT_ID_ANDROID]"
}
```

#### Optionnel (selon besoins)

```json
{
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "[CLIENT_ID_IOS]",
  "EXPO_PUBLIC_SAGACI_API_KEY": "[SAGACI_KEY]",
  "EXPO_PUBLIC_SAGACI_ENABLED": "true",
  "EXPO_PUBLIC_SENTRY_DSN": "[SENTRY_DSN]",
  "EXPO_PUBLIC_OPENWEATHER_API_KEY": "[OPENWEATHER_KEY]"
}
```

---

## 📝 RÉSUMÉ FINAL

### ⚠️ Variable Impactante

- **`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`** : **OBLIGATOIRE sur Android**

### ✅ Variables Non Impactantes

- **Toutes les autres** : Fallbacks valides, l'app fonctionne sans elles

### ✅ Valeurs par Défaut

- **Toutes les valeurs par défaut sont valides** sauf `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` qui n'a pas de fallback et bloque l'authentification sur Android.

---

**Date** : 2026-02-14  
**Statut** : ✅ **ANALYSE COMPLÈTE**


