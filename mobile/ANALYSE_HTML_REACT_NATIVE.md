# Analyse des fichiers utilisant du HTML au lieu de React Native

## 📋 Résumé
Analyse effectuée pour identifier les fichiers dans `mobile/src` qui utilisent des balises HTML ou des attributs de style HTML au lieu de composants React Native.

## 🔍 Fichiers identifiés avec du HTML

### ❌ Fichiers NON UTILISÉS (peuvent être supprimés ou ignorés)

1. **`mobile/src/components/TestimonialsAndPartners.tsx`**
   - ❌ Utilise `<section>`, `<img>`, styles HTML (py-16, bg-gray-50, etc.)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

2. **`mobile/src/components/CreationSection.tsx`**
   - ❌ Utilise `<section>`, styles HTML, importe `services.module.css` (inexistant)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

3. **`mobile/src/components/OutilsSection.tsx`**
   - ❌ Utilise `<section>`, styles HTML, importe `services.module.css` (inexistant)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

4. **`mobile/src/components/MatchSection.tsx`**
   - ❌ Utilise `<section>`, styles HTML, importe `services.module.css` (inexistant)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

5. **`mobile/src/components/Sidebar.tsx`**
   - ❌ Utilise `<aside>`, styles HTML, `@react-navigation/native` mais avec syntaxe web
   - ⚠️ Utilise `useLocation` de `@react-navigation/native` (n'existe pas pour React Native)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

6. **`mobile/src/components/MenuAuto.tsx`**
   - ❌ Utilise `<nav>`, `<a>`, styles HTML
   - ❌ Utilise `@/routes/routes` (probablement web)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

7. **`mobile/src/components/MainMenu.tsx`**
   - ❌ Utilise `<nav>`, styles HTML
   - ❌ Utilise `react-router-dom` (bibliothèque web, pas React Native)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

8. **`mobile/src/components/DesktopMenu.tsx`**
   - ❌ Utilise `<nav>`, styles HTML
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

9. **`mobile/src/components/DynamicMenu.tsx`**
   - ❌ Utilise `<section>`, `<a>`, styles HTML
   - ❌ Utilise `@/routes/routes` (probablement web)
   - ❌ Pas d'imports trouvés dans l'application
   - 📝 **Action**: Ignorer ou supprimer

10. **`mobile/src/components/CardService.tsx`**
    - ❌ Utilise styles HTML, `<a>`, `react-router-dom`
    - ❌ Pas d'imports trouvés dans l'application
    - 📝 **Action**: Ignorer ou supprimer

11. **`mobile/src/components/FloatingHelpButton.tsx`**
    - ❌ Utilise styles HTML (fixed, bottom-6, etc.)
    - ❌ Pas d'imports trouvés dans l'application
    - 📝 **Action**: Ignorer ou supprimer

12. **`mobile/src/components/ExportShareCard.tsx`**
    - ❌ Utilise `<select>`, `<TextInput>` (HTML), styles HTML, `<a>`
    - ❌ Pas d'imports trouvés dans l'application
    - 📝 **Action**: Ignorer ou supprimer

13. **`mobile/src/components/Loader.tsx`**
    - ❌ Utilise styles HTML (min-h-screen, animate-spin, etc.)
    - ❌ Pas d'imports trouvés dans l'application
    - 📝 **Action**: Ignorer ou supprimer

14. **`mobile/src/components/SchedulerStatusCard.tsx`**
    - ❌ Utilise styles HTML (p-4, bg-white, text-lg, etc.)
    - ❌ Utilise `fetch` avec chemins relatifs (`/api/admin/...`)
    - ❌ Pas d'imports trouvés dans l'application
    - 📝 **Action**: Ignorer ou supprimer

15. **`mobile/src/components/RolePlanNotice.tsx`**
    - ⚠️ Utilise styles HTML (p-4)
    - ❌ Pas d'imports trouvés dans l'application
    - 📝 **Action**: Ignorer ou supprimer

## ✅ Fichiers CORRIGÉS (si nécessaire)

Aucun fichier utilisé n'a été trouvé nécessitant des corrections.

## 📝 Notes importantes

1. **Fichiers web dans mobile**: La plupart de ces fichiers semblent être des composants web qui ont été copiés dans le dossier mobile mais ne sont pas utilisés.

2. **Imports web**: Plusieurs fichiers utilisent des bibliothèques web (`react-router-dom`, `@/routes/routes`) qui ne fonctionnent pas avec React Native.

3. **Styles HTML**: Les styles utilisent des classes Tailwind ou des attributs `style="..."` avec des classes CSS qui ne fonctionnent pas dans React Native.

4. **CSS Modules**: Certains fichiers importent `services.module.css` qui n'existe pas dans le projet mobile.

## 🎯 Recommandations

1. **Supprimer** tous les fichiers non utilisés listés ci-dessus, ou
2. **Déplacer** ces fichiers vers un dossier `mobile/src/components/web/` ou `mobile/src/legacy/web/` pour indiquer qu'ils ne sont pas pour React Native, ou
3. **Les ignorer** dans les corrections si vous préférez les garder pour référence.

## 📊 Statistiques

- **Fichiers analysés**: ~15 fichiers
- **Fichiers avec HTML**: 15 fichiers
- **Fichiers utilisés**: 0 fichiers
- **Fichiers à corriger**: 0 fichiers (tous non utilisés)

