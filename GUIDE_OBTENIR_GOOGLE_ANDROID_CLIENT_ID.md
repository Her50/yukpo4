# 📱 Guide : Obtenir EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID

**Date** : 2026-02-14  
**Variable** : `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

---

## 🎯 OBJECTIF

Créer un Client ID Android dans Google Cloud Console et récupérer sa valeur pour l'utiliser dans l'application mobile.

---

## 📋 ÉTAPE 1 : Accéder à Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Connectez-vous avec votre compte Google
3. Sélectionnez le projet : **yukpomnang**

---

## 📋 ÉTAPE 2 : Accéder aux Credentials

1. Dans le menu de gauche, cliquez sur **"APIs & Services"**
2. Cliquez sur **"Credentials"** (ou **"Identifiants"** en français)

Vous verrez la liste de tous vos Client IDs existants.

---

## 📋 ÉTAPE 3 : Créer un Nouveau Client ID Android

### Option A : Créer depuis la page Credentials

1. En haut de la page, cliquez sur **"+ CREATE CREDENTIALS"** (ou **"+ CRÉER DES IDENTIFIANTS"**)
2. Sélectionnez **"OAuth client ID"** (ou **"ID client OAuth"**)

### Option B : Utiliser le bouton "+ CREATE CREDENTIALS" en haut

1. Cliquez sur **"+ CREATE CREDENTIALS"**
2. Sélectionnez **"OAuth client ID"**

---

## 📋 ÉTAPE 4 : Configurer le Client ID Android

### 1. Sélectionner le Type d'Application

Dans la liste déroulante **"Application type"** (ou **"Type d'application"**), sélectionnez :
- **"Android"**

---

### 2. Remplir les Informations

#### Nom du Client (Optionnel mais recommandé)

**Name** (ou **Nom**) :
```
Yukpomnang Android App
```

---

#### Package Name (Obligatoire)

**Package name** (ou **Nom du package**) :
```
com.yukpomnang.mobile
```

**✅ Vérifié dans votre projet** :
- `mobile/app.config.js` : `package: "com.yukpomnang.mobile"`
- `mobile/android/app/build.gradle` : `applicationId 'com.yukpomnang.mobile'`

---

#### SHA-1 Certificate Fingerprint (Obligatoire)

**SHA-1 certificate fingerprint** (ou **Empreinte SHA-1 du certificat**) :

Vous devez obtenir le SHA-1 de votre certificat de signature Android.

##### Pour le Build de Développement (Debug)

**Windows (PowerShell)** :
```powershell
cd mobile/android
.\gradlew signingReport
```

**OU directement** :
```powershell
cd mobile/android/app
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Linux/Mac** :
```bash
cd mobile/android
./gradlew signingReport
```

**OU** :
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Recherchez la ligne** :
```
SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

**Copiez cette valeur** (sans les espaces ou avec les deux-points).

---

##### Pour le Build de Production (Release)

Si vous utilisez EAS Build, le SHA-1 est généré automatiquement. Vous pouvez :

1. **Récupérer depuis EAS** :
   ```bash
   eas credentials
   ```

2. **OU depuis Google Play Console** :
   - Allez sur [Google Play Console](https://play.google.com/console/)
   - Sélectionnez votre app
   - Allez dans **"Release"** → **"Setup"** → **"App signing"**
   - Copiez le **SHA-1 certificate fingerprint**

---

### 3. Exemple de Configuration

```
Application type: Android
Name: Yukpomnang Android App
Package name: com.hernandezlele.yukpo
SHA-1 certificate fingerprint: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

---

## 📋 ÉTAPE 5 : Créer et Récupérer le Client ID

1. Cliquez sur **"CREATE"** (ou **"CRÉER"**)
2. Une popup s'affichera avec le **Client ID** généré

**Exemple de Client ID Android** :
```
738929393617-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

3. **⚠️ IMPORTANT** : Copiez immédiatement ce Client ID (il ne sera plus visible après)

---

## 📋 ÉTAPE 6 : Utiliser le Client ID dans l'Application

### Ajouter dans `mobile/production (7).json`

```json
{
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
}
```

### Ajouter dans `mobile/eas.json`

Dans la section `production.env` :

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "738929393617-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
      }
    }
  }
}
```

---

## 🔍 Vérifier le Package Name de votre App

### Méthode 1 : Dans `app.config.js`

```bash
cd mobile
cat app.config.js | grep -i package
```

### Méthode 2 : Dans `app.json`

```bash
cd mobile
cat app.json | grep -i package
```

### Méthode 3 : Dans `android/app/build.gradle`

```bash
cd mobile/android/app
cat build.gradle | grep applicationId
```

**✅ Votre Package Name** : `com.yukpomnang.mobile` (déjà vérifié)

---

## 🔍 Obtenir le SHA-1 (Méthodes Alternatives)

### Méthode 1 : Via Gradle (Recommandé)

```bash
cd mobile/android
./gradlew signingReport
```

Cherchez dans la sortie :
```
Variant: debug
Config: debug
Store: ~/.android/debug.keystore
Alias: AndroidDebugKey
SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

---

### Méthode 2 : Via Keytool (Debug Keystore)

**Windows** :
```powershell
keytool -list -v -keystore $env:USERPROFILE\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Linux/Mac** :
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

---

### Méthode 3 : Via EAS Build (Production)

```bash
eas credentials
```

Sélectionnez votre app et plateforme Android, puis récupérez le SHA-1.

---

## ⚠️ NOTES IMPORTANTES

### 1. SHA-1 Différents pour Debug et Release

- **Debug** : Utilise le keystore de debug (`~/.android/debug.keystore`)
- **Release** : Utilise le keystore de production (généré par EAS ou vous-même)

**Vous devrez peut-être créer 2 Client IDs** :
- Un pour Debug (SHA-1 du debug keystore)
- Un pour Release (SHA-1 du release keystore)

**OU** : Utilisez le même Client ID pour les deux en ajoutant les deux SHA-1 dans Google Cloud Console.

---

### 2. Ajouter Plusieurs SHA-1

Si vous avez plusieurs SHA-1 (debug + release), vous pouvez :

1. **Créer un seul Client ID Android**
2. **Modifier le Client ID** après création
3. **Ajouter plusieurs SHA-1** dans le champ "SHA-1 certificate fingerprint"

**Format** : Séparez les SHA-1 par des virgules ou des retours à la ligne.

---

### 3. Package Name Doit Correspondre

Le **Package Name** dans Google Cloud Console doit **exactement correspondre** au `applicationId` dans votre app Android.

**Vérifiez** :
- `mobile/app.config.js` → `android.package`
- `mobile/android/app/build.gradle` → `applicationId`

---

## ✅ CHECKLIST

- [ ] Accéder à Google Cloud Console
- [ ] Aller dans APIs & Services → Credentials
- [ ] Créer un nouveau OAuth Client ID
- [ ] Sélectionner "Android" comme type
- [ ] Remplir le Package Name (`com.hernandezlele.yukpo`)
- [ ] Obtenir le SHA-1 (debug ou release)
- [ ] Remplir le SHA-1 certificate fingerprint
- [ ] Créer le Client ID
- [ ] Copier le Client ID généré
- [ ] Ajouter dans `mobile/production (7).json`
- [ ] Ajouter dans `mobile/eas.json`

---

## 📊 RÉSUMÉ

**Variable** : `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`  
**Valeur** : `738929393617-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`

**Où l'obtenir** :
1. Google Cloud Console → APIs & Services → Credentials
2. Créer un OAuth Client ID de type "Android"
3. Remplir Package Name et SHA-1
4. Copier le Client ID généré

**Où l'utiliser** :
- `mobile/production (7).json`
- `mobile/eas.json` (section `production.env`)

---

**Date** : 2026-02-14  
**Statut** : ✅ **GUIDE COMPLET**

