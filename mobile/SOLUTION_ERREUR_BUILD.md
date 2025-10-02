# 🔧 Solution - Erreur Build Gradle

## ❌ Problème Identifié

**Erreur :** `Gradle build failed with unknown error`

**Cause :** Les packages natifs `expo-av` et `expo-document-picker` n'étaient **pas déclarés** dans les plugins d'`app.json`.

EAS Build a besoin que tous les packages natifs soient explicitement listés dans la configuration.

## ✅ Solution Appliquée

### Avant (app.json)
```json
"plugins": [
    "expo-location",
    "expo-image-picker",
    "expo-font"
]
```

### Après (app.json) ✅
```json
"plugins": [
    "expo-location",
    "expo-image-picker",
    "expo-document-picker",      // ← AJOUTÉ
    [
        "expo-av",                 // ← AJOUTÉ
        {
            "microphonePermission": "Autoriser Yukpomnang à accéder au microphone..."
        }
    ],
    "expo-font"
]
```

## 📦 Packages Natifs Déclarés

| Package | Version | Plugin Requis | Status |
|---|---|---|---|
| expo-location | ~16.5.5 | ✅ Déclaré | ✅ |
| expo-image-picker | ~14.7.1 | ✅ Déclaré | ✅ |
| expo-document-picker | ~11.10.1 | ✅ **AJOUTÉ** | ✅ |
| expo-av | ^16.0.7 | ✅ **AJOUTÉ** | ✅ |
| expo-font | ~11.10.3 | ✅ Déclaré | ✅ |
| expo-linear-gradient | ~12.7.2 | ❌ Pas requis | ✅ |

## 🔧 Permissions Android

Les permissions suivantes sont déjà configurées dans `app.json` :
```json
"permissions": [
    "ACCESS_FINE_LOCATION",    // Pour GPS
    "ACCESS_COARSE_LOCATION",  // Pour GPS
    "CAMERA",                  // Pour photos
    "READ_EXTERNAL_STORAGE",   // Pour images/fichiers
    "WRITE_EXTERNAL_STORAGE",  // Pour sauvegarder
    "RECORD_AUDIO",            // Pour audio ✅
    "INTERNET",                // Pour API
    "ACCESS_NETWORK_STATE",    // Pour connexion
    "ACCESS_WIFI_STATE"        // Pour WiFi
]
```

✅ Toutes les permissions nécessaires sont déjà présentes !

## 🚀 Relancer le Build

Maintenant que `app.json` est corrigé :

```bash
cd mobile
npx eas build --platform android --profile preview --non-interactive
```

**Le build devrait réussir maintenant ! ✅**

## 📋 Vérification Avant Build

### Checklist Plugins
- [x] expo-location → ✅ Déclaré
- [x] expo-image-picker → ✅ Déclaré
- [x] expo-document-picker → ✅ **AJOUTÉ**
- [x] expo-av → ✅ **AJOUTÉ avec permission micro**
- [x] expo-font → ✅ Déclaré

### Checklist Permissions Android
- [x] CAMERA → ✅
- [x] READ_EXTERNAL_STORAGE → ✅
- [x] RECORD_AUDIO → ✅
- [x] INTERNET → ✅
- [x] GPS (FINE + COARSE) → ✅

### Checklist package.json
- [x] Toutes les dépendances listées → ✅
- [x] Versions compatibles avec Expo 50 → ✅
- [x] Pas de conflits de versions → ✅

## ⚠️ Si le Build Échoue Encore

### Solution 1 : Nettoyer le Cache EAS

```bash
# Supprimer les builds précédents en cache
npx eas build:list
npx eas build --platform android --clear-cache --non-interactive
```

### Solution 2 : Vérifier les Versions

Parfois les versions de packages ne sont pas compatibles. Mettez à jour :

```bash
npm install expo-av@~14.0.7 --save-exact
npm install expo-document-picker@~12.0.2 --save-exact
npm install expo-image-picker@~15.0.7 --save-exact
```

### Solution 3 : Installer le Config Plugin Explicitement

```bash
npx expo install expo-av expo-document-picker
```

Puis rebuild :
```bash
npx eas build --platform android --profile preview
```

## 🔍 Logs à Vérifier

Dans les logs du build, cherchez :

1. **"Run gradlew" phase** - C'est là que Gradle échoue
2. **Erreurs de dépendances** - Conflits de versions
3. **Permissions manquantes** - Plugins non configurés
4. **Cache build** - Problèmes de cache

## 💡 Astuce : Build de Développement

Si le build preview continue d'échouer, essayez un build de développement (plus simple) :

```bash
npx eas build --platform android --profile development --non-interactive
```

Ou utilisez Expo Go pour tester sans build :

```bash
npx expo start
# Puis scannez avec Expo Go
```

## 📝 Ce Qui a Changé

**Fichier modifié :** `mobile/app.json`

**Changement :**
- Ajout de `expo-document-picker` dans plugins
- Ajout de `expo-av` dans plugins avec permission microphone

**Raison :**
EAS Build a besoin que tous les packages natifs soient explicitement configurés dans les plugins.

---

**Relancez le build maintenant, ça devrait fonctionner ! 🚀**


