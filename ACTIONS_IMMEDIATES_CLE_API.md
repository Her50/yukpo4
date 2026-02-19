# 🚨 Actions Immédiates - Créer Nouvelle Clé API

**Date** : 2026-02-19  
**Projet** : yukpo-project (ID: 738929393617)  
**Urgence** : ⚠️ REQUIS avant ajustement de facturation

---

## 📋 Ce Que Demande Andrew

1. ✅ **Supprimer la clé API compromise** (`AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ`)
2. ✅ **Créer une nouvelle clé API avec restrictions d'application**
3. ⚠️ **C'est une condition REQUISE avant l'ajustement de facturation**

---

## 🎯 Informations de Votre Application

**Package Name Android** : `com.yukpomnang.mobile` ✅  
**Bundle ID iOS** : `com.yukpomnang.mobile` ✅

---

## 📋 Étapes à Suivre (Dans l'Ordre)

### Étape 1 : Créer la Nouvelle Clé API ⚠️ FAIRE EN PREMIER

**URL** : https://console.cloud.google.com/apis/credentials?project=738929393617

1. **Cliquer sur** : "+ CREATE CREDENTIALS" → "API key"
2. **Nommer** : `Places API - Mobile App (Restricted)`
3. **Cliquer sur** : "RESTRICT KEY" (IMPORTANT !)
4. **Application restrictions** :
   - Sélectionner "Android apps"
   - Package name : `com.yukpomnang.mobile`
   - SHA-1 : Obtenir avec `keytool` (voir guide)
   - Sélectionner "iOS apps"
   - Bundle ID : `com.yukpomnang.mobile`
5. **API restrictions** :
   - Sélectionner "Restrict key"
   - Cocher UNIQUEMENT "Places API (New)"
6. **SAVE** et **COPIER la nouvelle clé**

---

### Étape 2 : Obtenir le SHA-1 (Pour Android)

**Windows PowerShell** :
```powershell
keytool -list -v -keystore $env:USERPROFILE\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Chercher** : `SHA1: XX:XX:XX:XX:...`

**⚠️ Note** : Vous aurez besoin du SHA-1 de production aussi (si vous avez un keystore de production).

---

### Étape 3 : Mettre à Jour le Code

**Fichier 1** : `mobile/eas.json`

Remplacer :
```json
"EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
```

Par :
```json
"EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "NOUVELLE_CLE_API_ICI"
```

**Fichier 2** : `mobile/src/config/environment.ts`

Ligne 7, remplacer :
```typescript
GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ',
```

Par :
```typescript
GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
```

**Fichier 3** : `mobile/app.config.js`

Ligne 193, remplacer :
```javascript
googleMapsApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', 'AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ'),
```

Par :
```javascript
googleMapsApiKey: getEnvVar('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', ''),
```

---

### Étape 4 : Tester la Nouvelle Clé

```bash
cd mobile
npm start
# Tester l'autocomplete dans l'application
```

**Vérifier** :
- ✅ L'autocomplete fonctionne
- ✅ Pas d'erreurs "API key not valid"
- ✅ Pas d'erreurs "API key restricted"

---

### Étape 5 : Supprimer l'Ancienne Clé ⚠️ SEULEMENT APRÈS TEST

**URL** : https://console.cloud.google.com/apis/credentials?project=738929393617

1. **Trouver** la clé `AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ`
2. **Cliquer sur** l'icône "Delete" (poubelle)
3. **Confirmer** la suppression

**⚠️ IMPORTANT** : Ne supprimer QUE si la nouvelle clé fonctionne !

---

### Étape 6 : Configurer les Quotas

**URL** : https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617

**Configurer** :
- ✅ Quota quotidien : 50,000 requêtes/jour
- ✅ Quota par minute : 100 requêtes/minute
- ✅ Cap quotidien : Activer

---

### Étape 7 : Répondre à Andrew

**Fichier** : `REPONSE_ANDREW_CLE_API_CREEE.txt`

**Action** : Copier-coller le message dans le ticket Google Support

---

## ✅ Checklist

- [ ] Nouvelle clé API créée avec restrictions Android/iOS
- [ ] SHA-1 obtenu et ajouté aux restrictions Android
- [ ] Code mis à jour avec la nouvelle clé
- [ ] Nouvelle clé testée et fonctionnelle
- [ ] Ancienne clé compromise supprimée
- [ ] Quotas et caps configurés
- [ ] Réponse envoyée à Andrew

---

## 📁 Fichiers Créés

- ✅ `GUIDE_CREER_NOUVELLE_CLE_API_RESTRICTIONS.md` - Guide détaillé
- ✅ `REPONSE_ANDREW_CLE_API_CREEE.txt` - Message à envoyer
- ✅ `ACTIONS_IMMEDIATES_CLE_API.md` - Ce fichier

---

## 🎯 Résultat Attendu

Après ces étapes :
- ✅ Nouvelle clé API sécurisée avec restrictions
- ✅ Ancienne clé compromise supprimée
- ✅ Code mis à jour
- ✅ Prêt pour l'ajustement de facturation

---

**⚠️ IMPORTANT** : Prenez le temps de tester la nouvelle clé avant de supprimer l'ancienne !

**Guide complet** : Voir `GUIDE_CREER_NOUVELLE_CLE_API_RESTRICTIONS.md`

