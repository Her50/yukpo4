# 🔍 AUDIT PROFOND - expo-modules-core/android/build.gradle

## Date
2025-01-XX

## Résumé exécutif

**STATUT** : 🔴 **FICHIER CORROMPU**

Le fichier `node_modules/expo-modules-core/android/build.gradle` est **sévèrement corrompu** avec de multiples duplications et erreurs de syntaxe qui empêchent le build de fonctionner.

---

## 📊 Statistiques du fichier

- **Version installée** : `expo-modules-core@2.2.3`
- **Taille du fichier** : 384 lignes (devrait être ~200-250 lignes)
- **Occurrences de `buildscript`** : **9** (devrait être **1**)
- **Occurrences de `apply plugin:`** : **3** (devrait être **1**)
- **Occurrences de `applyKotlinExpoModulesCorePlugin()`** : **2** (devrait être **1**)
- **Blocs `ext` dupliqués** : **4** (devrait être **0-1**)

---

## 🔴 Problèmes identifiés

### 1. Blocs `buildscript` dupliqués

**Problème** : Le fichier contient **9 occurrences** de `buildscript`, alors qu'il ne devrait y en avoir qu'**UN SEUL**.

**Localisation** :
- Ligne 1 : Premier bloc `buildscript` (correct)
- Ligne 78-87 : Bloc `if (KOTLIN_MAJOR_VERSION >= 2)` orphelin avec `repositories` et `dependencies` (ERREUR)
- Ligne 92 : Deuxième bloc `buildscript` complet (DUPLIQUÉ)
- Ligne 139 : Troisième bloc `buildscript` (DUPLIQUÉ)

**Impact** : Gradle ne peut avoir qu'un seul bloc `buildscript` par fichier. Les duplications causent des erreurs de compilation.

### 2. Blocs `ext` dupliqués (4 fois)

**Problème** : Le bloc `ext` est défini **4 fois** avec le même contenu.

**Localisation** :
- Lignes 39-51 : Premier bloc `ext` (correct)
- Lignes 45-51 : Duplication partielle
- Lignes 55-59 : Duplication
- Lignes 61-67 : Duplication

**Contenu dupliqué** :
```gradle
ext {
  compileSdkVersion = Integer.parseInt(project.findProperty('android.compileSdkVersion') ?: '35')
  minSdkVersion = Integer.parseInt(project.findProperty('android.minSdkVersion') ?: '24')
  targetSdkVersion = Integer.parseInt(project.findProperty('android.targetSdkVersion') ?: '35')
}
```

**Impact** : Redondance, mais pas d'erreur fatale. Cependant, cela indique que le script de correction a été exécuté plusieurs fois.

### 3. `apply plugin: 'com.android.library'` dupliqué

**Problème** : Le plugin Android est appliqué **2 fois**.

**Localisation** :
- Ligne 69 : Première application (correcte)
- Ligne 128 : Deuxième application (DUPLIQUÉE)

**Impact** : Gradle peut gérer cela, mais c'est redondant et indique une corruption.

### 4. `group` et `version` dupliqués

**Problème** : Les déclarations `group` et `version` sont dupliquées.

**Localisation** :
- Lignes 71-72 : Première déclaration (correcte)
- Lignes 132-133 : Deuxième déclaration (DUPLIQUÉE)

**Impact** : Redondance, mais pas d'erreur fatale.

### 5. `applyKotlinExpoModulesCorePlugin()` dupliqué

**Problème** : La fonction est appelée **2 fois**.

**Localisation** :
- Ligne 76 : Premier appel (correct)
- Ligne 137 : Deuxième appel (DUPLIQUÉ)

**Impact** : Peut causer des problèmes si la fonction n'est pas idempotente.

### 6. Bloc `if (KOTLIN_MAJOR_VERSION >= 2)` orphelin

**Problème** : Un bloc conditionnel est présent **AVANT** que `KOTLIN_MAJOR_VERSION` ne soit défini.

**Localisation** : Lignes 78-87

**Code problématique** :
```gradle
if (KOTLIN_MAJOR_VERSION >= 2) {
    repositories {
      mavenCentral()
    }

    dependencies {
      classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:${kotlinVersion}")
    }
  }
}
```

**Problèmes** :
- `KOTLIN_MAJOR_VERSION` n'est pas défini à ce point
- `kotlinVersion` n'est pas défini dans ce contexte
- Ce bloc devrait être **DANS** le `buildscript`, pas après `applyKotlinExpoModulesCorePlugin()`

**Impact** : **ERREUR FATALE** - C'est la cause principale de l'échec du build.

### 7. Bloc `buildscript` supplémentaire avec erreur

**Problème** : Un troisième bloc `buildscript` (ligne 139) utilise `kotlinVersion` directement sans le définir.

**Code problématique** :
```gradle
buildscript {
  ext.KOTLIN_MAJOR_VERSION = kotlinVersion.split("\\.")[0].toInteger()
  // ...
}
```

**Problème** : `kotlinVersion` n'est pas défini dans ce contexte. Il devrait utiliser `project.ext.kotlinVersion()` ou `findProperty('android.kotlinVersion')`.

**Impact** : **ERREUR FATALE** - C'est une autre cause de l'échec du build.

---

## 🔍 Cause racine

### Script de correction défaillant

Le script `fix-expo-modules-core-kotlin-version.js` est **trop complexe** et a été exécuté **plusieurs fois**, causant des duplications à chaque exécution.

**Problèmes du script** :
1. **Pas de vérification d'état** : Le script ne vérifie pas si les corrections ont déjà été appliquées
2. **Remplacements multiples** : Le script fait plusieurs remplacements qui se chevauchent
3. **Pas de nettoyage** : Le script n'enlève pas les duplications existantes
4. **Logique complexe** : Plus de 400 lignes de code avec de nombreux patterns regex

### Processus de corruption

1. **Première exécution** : Le script ajoute du code au début du fichier
2. **Deuxième exécution** : Le script détecte que le code n'est pas présent (à cause d'un pattern différent) et ajoute à nouveau
3. **Troisième exécution** : Répétition du processus
4. **Résultat** : Fichier avec 9 blocs `buildscript` et de multiples duplications

---

## ✅ Solution recommandée

### Option 1 : Restaurer depuis le patch (RECOMMANDÉ)

1. **Supprimer le fichier corrompu** :
   ```powershell
   Remove-Item mobile/node_modules/expo-modules-core/android/build.gradle
   ```

2. **Réinstaller expo-modules-core** :
   ```powershell
   cd mobile
   npm install expo-modules-core@2.2.3 --force
   ```

3. **Appliquer uniquement le patch** :
   ```powershell
   npx patch-package expo-modules-core
   ```

4. **Désactiver le script de correction** :
   - Commenter l'appel à `fix-expo-modules-core-kotlin-version.js` dans `postinstall.js`

### Option 2 : Nettoyer le fichier manuellement

Créer un script de nettoyage qui :
1. Supprime tous les blocs `buildscript` sauf le premier
2. Supprime les blocs `ext` dupliqués
3. Supprime les `apply plugin:` dupliqués
4. Corrige le bloc `if (KOTLIN_MAJOR_VERSION >= 2)` orphelin

### Option 3 : Utiliser un patch propre

Créer un nouveau patch `expo-modules-core+2.2.3.patch` qui :
1. Applique uniquement les corrections nécessaires
2. Ne cause pas de duplications
3. Est idempotent (peut être appliqué plusieurs fois sans problème)

---

## 📋 Plan d'action immédiat

### Étape 1 : Sauvegarder l'état actuel
```powershell
Copy-Item mobile/node_modules/expo-modules-core/android/build.gradle mobile/node_modules/expo-modules-core/android/build.gradle.backup
```

### Étape 2 : Analyser le fichier original
```powershell
# Vérifier ce que devrait être le fichier original
npm view expo-modules-core@2.2.3 dist.tarball
```

### Étape 3 : Restaurer le fichier
```powershell
cd mobile
Remove-Item node_modules/expo-modules-core/android/build.gradle
npm install expo-modules-core@2.2.3 --force
```

### Étape 4 : Appliquer uniquement le patch
```powershell
npx patch-package expo-modules-core
```

### Étape 5 : Désactiver le script problématique
Modifier `postinstall.js` pour ne plus appeler `fix-expo-modules-core-kotlin-version.js`

### Étape 6 : Tester le build
```powershell
cd mobile/android
.\gradlew clean --no-daemon
```

---

## 🔧 Corrections nécessaires dans le script

Si on veut garder le script `fix-expo-modules-core-kotlin-version.js`, il faut :

1. **Ajouter des vérifications d'état** :
   ```javascript
   if (content.includes('// ✅ CORRIGÉ: kotlinVersion dans buildscript')) {
     console.log('✅ Already fixed, skipping');
     return false;
   }
   ```

2. **Nettoyer les duplications avant d'ajouter** :
   ```javascript
   // Supprimer les blocs buildscript dupliqués
   content = content.replace(/buildscript\s*\{[\s\S]*?\n\}\s*(?=buildscript)/g, '');
   ```

3. **Rendre le script idempotent** :
   - Vérifier l'état avant chaque modification
   - Ne pas ajouter si déjà présent

---

## 📊 Comparaison avec le commit de référence

**Conclusion** : Le problème n'est **PAS** lié aux changements dans le code du projet, mais à la **corruption du fichier `expo-modules-core/android/build.gradle`** causée par le script de correction.

Les deux builds (référence et actuel) échouent avec la même erreur car ils utilisent le même fichier corrompu dans `node_modules`.

---

## ✅ Recommandation finale

**Action immédiate** : Restaurer le fichier `expo-modules-core/android/build.gradle` depuis une source propre (npm ou patch) et désactiver le script de correction automatique qui cause les duplications.

