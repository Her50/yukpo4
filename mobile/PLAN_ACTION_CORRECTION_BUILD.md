# 🎯 PLAN D'ACTION - CORRECTION BUILD GRADLE

**Date**: 2025-02-05  
**Objectif**: Corriger les problèmes de build identifiés dans l'audit

---

## 📋 ACTIONS PRIORITAIRES

### ✅ ACTION 1: Retirer les Scripts init.d Complexes

**Fichiers à supprimer**:
1. `android/gradle/init.d/force-compilesdk.gradle`
2. `android/gradle/init.d/force-compilesdk-before-plugin-resolution.gradle`
3. `android/gradle/init.d/android-properties.gradle` (vide)

**Justification**: Ces scripts modifient des fichiers dans `node_modules` et créent de la complexité inutile. Les propriétés doivent être définies dans `gradle.properties` et `settings.gradle`.

**Commande**:
```bash
cd mobile/android/gradle/init.d
rm force-compilesdk.gradle
rm force-compilesdk-before-plugin-resolution.gradle
rm android-properties.gradle
```

---

### ✅ ACTION 2: Retirer les Fichiers .working

**Fichiers à supprimer**:
1. `android/build.gradle.working`
2. `android/gradle.properties.working`
3. `android/settings.gradle.working`

**Justification**: Ces fichiers ne sont pas utilisés par Gradle et peuvent créer de la confusion.

**Commande**:
```bash
cd mobile/android
rm build.gradle.working
rm gradle.properties.working
rm settings.gradle.working
```

---

### ⚠️ ACTION 3: Simplifier le Plugin withExpoModuleGradlePlugin

**Option A: Retirer complètement** (recommandé si `settings.gradle` gère déjà l'inclusion)

**Fichier**: `plugins/withExpoModuleGradlePlugin.js`

**Vérification**: Si `settings.gradle` inclut déjà `expo-modules-core/android` dans `pluginManagement`, ce plugin est redondant.

**Option B: Simplifier** (si nécessaire)

Si le plugin est nécessaire, simplifier pour éviter les résolutions dynamiques complexes.

---

### ✅ ACTION 4: Vérifier la Cohérence des Propriétés

**Vérifier que toutes les propriétés sont définies dans `gradle.properties`**:

```properties
android.kotlinVersion=1.9.25
android.compileSdkVersion=35
android.targetSdkVersion=35
android.minSdkVersion=24
android.buildToolsVersion=35.0.0
```

**Vérifier que `settings.gradle` définit `rootProject.ext.kotlinVersion`**:

```gradle
rootProject.ext.kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'
```

**Vérifier que `app.config.js` est cohérent**:

```javascript
kotlinVersion: "1.9.25"
compileSdkVersion: 35
targetSdkVersion: 35
minSdkVersion: 24
```

---

### ✅ ACTION 5: Nettoyer et Tester

**Étape 1: Nettoyer le cache Gradle**
```bash
cd mobile/android
./gradlew clean
```

**Étape 2: Nettoyer node_modules (optionnel mais recommandé)**
```bash
cd mobile
rm -rf node_modules
npm install
```

**Étape 3: Appliquer les patches**
```bash
cd mobile
npm run postinstall
```

**Étape 4: Tester le build local**
```bash
cd mobile
npm run android
```

**Étape 5: Si succès local, tester EAS Build**
```bash
cd mobile
eas build --platform android --profile preview
```

---

## 🔍 VÉRIFICATIONS POST-CORRECTION

### Vérification 1: Propriétés Gradle
- ✅ `gradle.properties` définit toutes les propriétés nécessaires
- ✅ `settings.gradle` définit `rootProject.ext.kotlinVersion`
- ✅ `app.config.js` est cohérent avec `gradle.properties`

### Vérification 2: Scripts init.d
- ✅ Aucun script `init.d` ne modifie `node_modules`
- ✅ Aucun script `init.d` complexe

### Vérification 3: Plugin Personnalisé
- ✅ `withExpoModuleGradlePlugin.js` simplifié ou retiré
- ✅ `settings.gradle` gère l'inclusion d'`expo-modules-core/android`

### Vérification 4: Build
- ✅ Build local réussit
- ✅ Build EAS réussit

---

## 📊 ORDRE D'EXÉCUTION RECOMMANDÉ

1. **Retirer les scripts init.d** (Action 1)
2. **Retirer les fichiers .working** (Action 2)
3. **Vérifier la cohérence des propriétés** (Action 4)
4. **Simplifier le plugin** (Action 3)
5. **Nettoyer et tester** (Action 5)

---

## 🚨 ROLLBACK PLAN

Si les corrections causent de nouveaux problèmes:

1. **Restaurer les fichiers .working** (si disponibles)
2. **Vérifier les logs Gradle** pour identifier le problème
3. **Réappliquer progressivement** les corrections une par une

---

## 📝 NOTES IMPORTANTES

- **Ne pas modifier les fichiers dans `node_modules`** directement
- **Utiliser `gradle.properties` et `settings.gradle`** pour définir les propriétés
- **Tester après chaque modification** pour identifier rapidement les problèmes
- **Documenter les changements** dans un commit séparé

---

**Date de création**: 2025-02-05  
**Statut**: Prêt à exécuter

