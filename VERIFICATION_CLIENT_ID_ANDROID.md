# ⚠️ Vérification : Client ID pour Android

**Date** : 2026-02-14  
**Question** : Le Client ID actuel est-il valide pour `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` ?

---

## 🎯 RÉPONSE

### ❌ NON - Le Client ID actuel n'est PAS valide pour Android

**Client ID actuel** : `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`

**Type** : **Application Web** (Web Application)  
**Utilisation** : Pour `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (Web/Expo)

**❌ Ne peut PAS être utilisé pour** : `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

---

## 📊 DIFFÉRENCE ENTRE CLIENT ID WEB ET ANDROID

### Client ID Web (Application Web)

**Client ID actuel** : `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`

**Configuration** :
- ✅ **Origines JavaScript autorisées** : URLs web
- ✅ **URI de redirection autorisés** : URLs de callback web
- ❌ **Package Name** : Non requis
- ❌ **SHA-1** : Non requis

**Utilisé pour** :
- Authentification web
- Authentification Expo (développement)
- Backend OAuth callbacks

---

### Client ID Android (Obligatoire pour Android)

**Type requis** : **Android** (pas Web)

**Configuration** :
- ✅ **Package Name** : `com.yukpomnang.mobile` (obligatoire)
- ✅ **SHA-1 Certificate Fingerprint** : Empreinte du certificat (obligatoire)
- ❌ **Origines JavaScript** : Non utilisées
- ❌ **Redirect URIs** : Non utilisées

**Utilisé pour** :
- Authentification native Android
- Vérification du package name
- Vérification du certificat de signature

---

## 🔍 VÉRIFICATION DANS GOOGLE CLOUD CONSOLE

D'après vos clients OAuth existants, vous avez déjà :

### ✅ Client ID Android Existant

**Client ID** : `738929393617-i2ss2ql4nr25hsffr5ri97gnesh0go3t.apps.googleusercontent.com`  
**Type** : **Android**  
**Package Name** : `com.yukpomnang.mobile` ✅  
**SHA-1** : Configuré ✅

**✅ Ce Client ID peut être utilisé pour `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`**

---

### ❌ Client ID Web (Actuel)

**Client ID** : `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com`  
**Type** : **Application Web**  
**Configuration** : Redirect URIs et JavaScript Origins

**❌ Ce Client ID ne peut PAS être utilisé pour Android**

---

## ✅ SOLUTION

### Option 1 : Utiliser le Client ID Android Existant (Recommandé)

Vous avez déjà un Client ID Android configuré dans Google Cloud Console :

```json
{
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-i2ss2ql4nr25hsffr5ri97gnesh0go3t.apps.googleusercontent.com"
}
```

**Avantages** :
- ✅ Déjà configuré
- ✅ Package Name correct : `com.yukpomnang.mobile`
- ✅ SHA-1 déjà configuré
- ✅ Prêt à l'emploi

---

### Option 2 : Créer un Nouveau Client ID Android

Si vous préférez créer un nouveau Client ID Android :

1. Google Cloud Console → APIs & Services → Credentials
2. "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Type : **"Android"**
4. Package Name : `com.yukpomnang.mobile`
5. SHA-1 : Obtenir via `gradlew signingReport`
6. Créer et copier le nouveau Client ID

---

## 📋 CONFIGURATION RECOMMANDÉE

### Dans `mobile/production (7).json`

```json
{
  "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-i2ss2ql4nr25hsffr5ri97gnesh0go3t.apps.googleusercontent.com"
}
```

### Dans `mobile/eas.json`

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-i2ss2ql4nr25hsffr5ri97gnesh0go3t.apps.googleusercontent.com"
      }
    }
  }
}
```

---

## ⚠️ IMPORTANT

### Ne Pas Utiliser le Client ID Web pour Android

**❌ INCORRECT** :
```json
{
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2.apps.googleusercontent.com"
}
```

**Pourquoi** :
- Le Client ID Web n'a pas de Package Name configuré
- Le Client ID Web n'a pas de SHA-1 configuré
- Google OAuth Android nécessite ces informations pour valider l'app
- L'authentification échouera avec une erreur de configuration

---

## ✅ RÉSUMÉ

| Client ID | Type | Utilisation | Valide pour Android ? |
|-----------|------|-------------|----------------------|
| `738929393617-4kt4e9ed1g79j70dng7epskqn7rkqnm2` | **Web** | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | ❌ **NON** |
| `738929393617-i2ss2ql4nr25hsffr5ri97gnesh0go3t` | **Android** | `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | ✅ **OUI** |

---

## 🎯 ACTION REQUISE

**Utilisez le Client ID Android existant** :

```json
{
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-i2ss2ql4nr25hsffr5ri97gnesh0go3t.apps.googleusercontent.com"
}
```

**Ajoutez cette valeur dans** :
- ✅ `mobile/production (7).json`
- ✅ `mobile/eas.json` (section `production.env`)

---

**Date** : 2026-02-14  
**Statut** : ⚠️ **LE CLIENT ID ACTUEL N'EST PAS VALIDE POUR ANDROID**



