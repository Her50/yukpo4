# 📋 Analyse complète des fichiers utilisant du HTML au lieu de React Native

**Date**: Analyse effectuée le $(date)  
**Objectif**: Identifier tous les fichiers du dossier `mobile/src` qui utilisent des balises HTML ou des attributs HTML au lieu de composants React Native, et déterminer lesquels sont réellement utilisés par l'application mobile.

---

## ✅ Fichiers à IGNORER (non utilisés par l'application mobile)

Ces fichiers contiennent du HTML mais **ne sont PAS importés** dans l'application mobile. Ils peuvent être ignorés dans les corrections.

### 1. **`mobile/src/components/TestimonialsAndPartners.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<section>` au lieu de `<View>`
  - Utilise `<img>` au lieu de `<Image>` de React Native
  - Utilise `style="..."` avec classes Tailwind (py-16, bg-gray-50, etc.)
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 2. **`mobile/src/components/Sidebar.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<aside>` au lieu de `<View>`
  - Utilise `style="..."` avec classes Tailwind
  - Utilise `useLocation` de `@react-navigation/native` (n'existe pas pour React Native)
  - Utilise `Link` avec `to` (syntaxe web)
- ❌ **Imports trouvés**: Aucun (les autres fichiers Sidebar utilisent `ResponsiveSidebar`, `ClientSidebar`, `UserSidebar`)
- 📝 **Action**: Ignorer (fichier non utilisé)

### 3. **`mobile/src/components/ExportShareCard.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<select>` et `<option>` au lieu de `<Picker>` de React Native
  - Utilise `TextInput` avec `type="text"` (attribut HTML)
  - Utilise `<a>` au lieu de `<TouchableOpacity>` + `Linking`
  - Utilise `style="..."` avec classes Tailwind
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 4. **`mobile/src/components/Loader.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `style="..."` avec classes Tailwind (min-h-screen, animate-spin, etc.)
  - Classes CSS web non supportées par React Native
- ❌ **Imports trouvés**: Aucun (l'application utilise `SkeletonLoader`, `EnhancedSkeletonLoader` à la place)
- 📝 **Action**: Ignorer (fichier non utilisé)

### 5. **`mobile/src/components/SchedulerStatusCard.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `style="..."` avec classes Tailwind (p-4, bg-white, text-lg, etc.)
  - Utilise `fetch` avec chemins relatifs (`/api/admin/...`) qui ne fonctionnent pas en React Native
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 6. **`mobile/src/components/RolePlanNotice.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `style="..."` avec classes Tailwind (p-4)
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 7. **`mobile/src/components/MenuAuto.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<nav>` au lieu de `<View>`
  - Utilise `<a>` avec `href` au lieu de navigation React Native
  - Utilise `style="..."` avec classes Tailwind
  - Utilise `@/routes/routes` (probablement web)
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 8. **`mobile/src/components/MainMenu.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<nav>` au lieu de `<View>`
  - Utilise `react-router-dom` (bibliothèque web, pas React Native)
  - Utilise `Link` avec `to` (syntaxe web)
  - Utilise `style="..."` avec classes Tailwind
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 9. **`mobile/src/components/DynamicMenu.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<section>` au lieu de `<View>`
  - Utilise `<a>` avec `href` au lieu de navigation React Native
  - Utilise `style="..."` avec classes Tailwind
  - Utilise `@/routes/routes` (probablement web)
  - ⚠️ Erreur de typage: `Textrops` au lieu de `Props`
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 10. **`mobile/src/components/CardService.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<a>` avec `href` au lieu de navigation React Native
  - Utilise `style="..."` avec classes Tailwind
  - Utilise `@/routes/AppRoutesRegistry` (probablement web)
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 11. **`mobile/src/components/FloatingHelpButton.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<a>` avec `href` au lieu de `Linking` de React Native
  - Utilise `style="..."` avec classes Tailwind (fixed, bottom-6, etc.)
  - Classes CSS web non supportées par React Native
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 12. **`mobile/src/components/CreationSection.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<section>` au lieu de `<View>`
  - Utilise `style="..."` avec classes Tailwind
  - Importe `services.module.css` (inexistant)
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 13. **`mobile/src/components/OutilsSection.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<section>` au lieu de `<View>`
  - Utilise `style="..."` avec classes Tailwind
  - Importe `services.module.css` (inexistant)
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 14. **`mobile/src/components/MatchSection.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<section>` au lieu de `<View>`
  - Utilise `style="..."` avec classes Tailwind
  - Importe `services.module.css` (inexistant)
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

### 15. **`mobile/src/components/DesktopMenu.tsx`**
- ❌ **Problèmes HTML détectés**:
  - Utilise `<nav>`, `<ul>`, `<li>` au lieu de composants React Native
  - Utilise `Link` avec `to` (syntaxe web)
  - Utilise `useLocation` de `@react-navigation/native` (n'existe pas pour React Native)
  - Utilise `classNames` avec classes Tailwind
  - Utilise `style="..."` avec classes Tailwind
- ❌ **Imports trouvés**: Aucun
- 📝 **Action**: Ignorer (fichier non utilisé)

---

## ✅ Fichiers avec HTML ACCEPTABLES (usage légitime)

Ces fichiers utilisent du HTML mais c'est **normal et acceptable** car ils ne sont pas des composants React Native.

### 1. **`mobile/src/utils/busTicketPdfGenerator.ts`**
- ✅ **HTML utilisé**: Oui, mais c'est **normal**
- 📝 **Raison**: Ce fichier génère un PDF à partir de HTML. C'est une fonction utilitaire qui crée du HTML pour `expo-print`, pas un composant React Native.
- ✅ **Action**: Aucune correction nécessaire

### 2. **`mobile/src/services/jumiaScrapingService.ts`**
- ✅ **HTML utilisé**: Oui, mais c'est **normal**
- 📝 **Raison**: Ce fichier parse du HTML avec des regex pour extraire des données. C'est un service de scraping, pas un composant React Native.
- ✅ **Action**: Aucune correction nécessaire

---

## ⚠️ Fichiers Legacy (à vérifier)

Ces fichiers sont dans `mobile/src/legacy/prototypes/` et utilisent `style="auto"` pour `StatusBar`, ce qui est **correct** pour React Native (c'est une prop valide pour `expo-status-bar`).

### Fichiers concernés:
- `App.MINIMAL-CRASH-TEST.tsx`
- `App.ULTRA_MINIMAL.tsx`
- `App.tsx.backup-current`
- `App.tsx.backup`
- `App.complex.tsx.backup`

- ✅ **Action**: Aucune correction nécessaire (ces fichiers sont des backups/prototypes)

---

## 📊 Résumé

### Statistiques
- **Fichiers analysés**: 20+ fichiers
- **Fichiers avec HTML non utilisés**: 15 fichiers
- **Fichiers avec HTML acceptables**: 2 fichiers
- **Fichiers legacy (corrects)**: 5 fichiers
- **Fichiers utilisés nécessitant correction**: **0 fichier** ✅

### Conclusion

🎉 **Aucun fichier utilisé par l'application mobile n'utilise du HTML incorrectement.**

Tous les fichiers qui utilisent du HTML sont soit:
1. **Non utilisés** par l'application (peuvent être ignorés)
2. **Utilisent HTML de manière légitime** (génération PDF, scraping)
3. **Sont des fichiers legacy/prototypes** (backups)

---

## 🎯 Recommandations

### Option 1: Supprimer les fichiers non utilisés
Si vous voulez nettoyer le codebase, vous pouvez supprimer les 15 fichiers non utilisés listés ci-dessus.

### Option 2: Déplacer vers un dossier legacy
Déplacer ces fichiers vers `mobile/src/legacy/web/` pour indiquer qu'ils ne sont pas pour React Native.

### Option 3: Les ignorer
Garder ces fichiers mais les ignorer dans les corrections (recommandé si vous prévoyez de les utiliser plus tard).

---

## ✅ Action finale

**Aucune correction nécessaire** pour les fichiers utilisés par l'application mobile. Tous les composants React Native utilisés par l'application sont corrects.

