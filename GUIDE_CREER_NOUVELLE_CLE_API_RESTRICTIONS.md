# 🔐 Guide : Créer une Nouvelle Clé API avec Restrictions

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)  
**Objectif** : Remplacer la clé API compromise par une nouvelle clé sécurisée

---

## ⚠️ IMPORTANT

**Selon Andrew (Google Support)** :
- ✅ Supprimer la clé API compromise est **REQUIS** avant l'ajustement de facturation
- ✅ Créer une nouvelle clé avec restrictions d'application
- ⚠️ Prendre le temps pour ne pas bloquer accidentellement les appels API

---

## 📋 Étapes à Suivre

### Étape 1 : Identifier la Clé API Compromise

**Clé compromise** : `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ`

**Où elle est utilisée** :
- `mobile/eas.json` (ligne 22)
- `mobile/src/config/environment.ts` (ligne 7)
- `mobile/app.config.js` (ligne 193)

---

### Étape 2 : Créer une Nouvelle Clé API avec Restrictions

**URL** : https://console.cloud.google.com/apis/credentials?project=738929393617

#### 2.1. Créer la Nouvelle Clé

1. **Aller sur** : APIs & Services → Credentials
2. **Cliquer sur** : "+ CREATE CREDENTIALS" → "API key"
3. **Nommer la clé** : `Places API - Mobile App (Restricted)`
4. **Cliquer sur** : "RESTRICT KEY" (IMPORTANT !)

#### 2.2. Configurer les Restrictions d'Application

**Option A : Restrictions par Application (Recommandé pour Mobile)**

1. **Application restrictions** : Sélectionner "Android apps" ou "iOS apps"
2. **Pour Android** :
   - Cliquer sur "+ ADD AN ITEM" (vous pouvez ajouter plusieurs éléments : un pour debug, un pour production)
   
   **Élément 1 - Debug** :
   - **Package name** : `com.yukpomnang.mobile` ✅
   - **SHA-1 certificate fingerprint** : `E1:9A:BD:DE:56:FB:32:4B:77:E3:48:FE:6E:F6:1E:BB:4D:B5:59:4F` ✅ (déjà obtenu)
   
   **Élément 2 - Production** (à ajouter après) :
   - **Package name** : `com.yukpomnang.mobile` ✅ (même package)
   - **SHA-1 certificate fingerprint** : Obtenir depuis :
     - **Google Play Console** : Release → Setup → App signing → Copier le SHA-1
     - **OU EAS** : `cd mobile && eas credentials` → Android → production
     - **OU** si vous avez le keystore local :
       ```bash
       keytool -list -v -keystore votre-keystore.jks -alias votre-alias
       ```
   
   ⚠️ **IMPORTANT** : Vous devez ajouter les DEUX SHA-1 (debug ET production) pour que la clé fonctionne en développement ET en production !

3. **Pour iOS** :
   - Cliquer sur "+ ADD AN ITEM"
   - **Bundle ID** : `com.yukpomnang.mobile` ✅ (votre bundle ID)
   
   ✅ **Note** : Le Bundle ID fonctionne pour TOUS les utilisateurs qui téléchargent l'app depuis l'App Store. Pas besoin d'ajouter plusieurs Bundle IDs - un seul suffit pour tous les utilisateurs iOS.

**Option B : Restrictions par IP (Pour Backend uniquement)**

Si vous voulez limiter la clé au backend uniquement :
1. **Application restrictions** : Sélectionner "IP addresses"
2. **Ajouter les IPs** :
   - IPs de Cloud Run (si disponibles)
   - OU utiliser "HTTP referrers" pour limiter aux domaines

#### 2.3. Configurer les Restrictions d'API

1. **API restrictions** : Sélectionner "Restrict key"
2. **Sélectionner** : "Places API (New)" uniquement
3. **Désélectionner** : Toutes les autres APIs

#### 2.4. Sauvegarder

1. **Cliquer sur** : "SAVE"
2. **Copier la nouvelle clé API** (elle commence par `AIza...`)
3. **⚠️ IMPORTANT** : Noter la clé dans un endroit sûr

---

### Étape 3 : Mettre à Jour le Code

#### 3.1. Mettre à Jour les Fichiers de Configuration

**Fichier 1** : `mobile/eas.json`

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "NOUVELLE_CLE_API_ICI",
        "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "NOUVELLE_CLE_API_ICI"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "NOUVELLE_CLE_API_ICI",
        "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY": "NOUVELLE_CLE_API_ICI"
      }
    }
  }
}
```

**Fichier 2** : `mobile/src/config/environment.ts`

```typescript
export const ENVIRONMENT = {
    // Clé API Google Maps (Places, Geocoding, etc.)
    GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '', // ✅ Retirer la clé en dur
    
    // ... reste du code
};
```

**Fichier 3** : `mobile/app.config.js`

```javascript
googleMapsApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', ''), // ✅ Retirer la clé en dur
```

#### 3.2. Créer un Fichier .env (Optionnel mais Recommandé)

**Fichier** : `mobile/.env`

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=NOUVELLE_CLE_API_ICI
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=NOUVELLE_CLE_API_ICI
```

**⚠️ IMPORTANT** : Ajouter `.env` à `.gitignore` pour ne pas commiter la clé !

---

### Étape 4 : Tester la Nouvelle Clé

#### 4.1. Tester Localement

```bash
cd mobile
npm start
# Tester l'autocomplete dans l'application
```

#### 4.2. Vérifier les Logs

Vérifier que :
- ✅ L'autocomplete fonctionne
- ✅ Pas d'erreurs "API key not valid"
- ✅ Pas d'erreurs "API key restricted"

---

### Étape 5 : Supprimer l'Ancienne Clé API Compromise

**⚠️ ATTENTION** : Ne supprimer l'ancienne clé QUE APRÈS avoir testé la nouvelle !

**URL** : https://console.cloud.google.com/apis/credentials?project=738929393617

1. **Trouver** la clé `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ`
2. **Cliquer sur** l'icône "Delete" (poubelle)
3. **Confirmer** la suppression

**⚠️ IMPORTANT** : Une fois supprimée, l'ancienne clé ne pourra plus être récupérée !

---

### Étape 6 : Configurer les Quotas et Caps

**URL** : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617

**Configurer** :
- ✅ Quota quotidien : 50,000 requêtes/jour
- ✅ Quota par minute : 100 requêtes/minute
- ✅ Cap quotidien : Activer

---

### Étape 7 : Répondre à Andrew

**Message à envoyer** :

```
Hello Andrew,

Thank you for your guidance. I have completed the following steps:

1. ✅ Created a new API key with Application Restrictions
   - Restricted to Android/iOS app bundle IDs (or IP addresses)
   - Restricted to Places API (New) only

2. ✅ Updated my code to use the new API key
   - Removed hardcoded API key from source code
   - Using environment variables for the new key

3. ✅ Tested the new API key
   - Verified that autocomplete functionality works correctly
   - No errors or restrictions issues

4. ✅ Deleted the compromised API key (AIza***EAWQ)
   - Old key has been permanently deleted

5. ✅ Configured quotas and daily caps
   - Set daily quota: 50,000 requests/day
   - Set per-minute quota: 100 requests/minute
   - Enabled daily usage cap

The new API key is now active and properly secured. I am ready to proceed with the billing adjustment request.

Please let me know if you need any additional information.

Best regards,
[Your name]
```

---

## ✅ Checklist

- [ ] Nouvelle clé API créée avec restrictions d'application
- [ ] Restrictions d'API configurées (Places API uniquement)
- [ ] Code mis à jour avec la nouvelle clé
- [ ] Ancienne clé retirée du code source
- [ ] Nouvelle clé testée et fonctionnelle
- [ ] Ancienne clé compromise supprimée
- [ ] Quotas et caps configurés
- [ ] Réponse envoyée à Andrew

---

## 🎯 Résultat Attendu

Après ces étapes :
- ✅ Nouvelle clé API sécurisée avec restrictions
- ✅ Ancienne clé compromise supprimée
- ✅ Code mis à jour
- ✅ Prêt pour l'ajustement de facturation

---

**⚠️ IMPORTANT** : Prenez le temps de tester la nouvelle clé avant de supprimer l'ancienne pour éviter de bloquer votre application !

