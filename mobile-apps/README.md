# Mobile Apps autonomes (Bourse, Pharmacie, Restaurant)

Chaque sous-dossier est un projet Expo **indépendant** avec son propre `bundleIdentifier` / `package` Android. L'app `mobile/` d'origine (Yukpo monolithique) est intacte et continue de fonctionner.

## Structure partagée

Le code source des écrans (`mobile/src/**`) est **réutilisé** par chaque app via :
- `metro.config.js` → `watchFolders: [../../mobile]` + résolution `node_modules` croisée
- `babel.config.js` → alias `@shared` → `../../mobile/src`
- `tsconfig.json` → `paths["@shared/*"]` → `../../mobile/src/*`

Aucun fichier de `mobile/src/` n'est dupliqué.

## Install & dev

```bash
cd mobile-apps/bourse     # ou pharmacie / restaurant
npm install               # installe UNIQUEMENT les deps listées ici
npx expo start
```

À la première compilation, Metro résout tout module manquant vers `../../mobile/node_modules`.

## Build EAS

```bash
cd mobile-apps/bourse
npx eas init              # crée un projectId EAS dédié pour cette app
npx eas build --platform android
npx eas build --platform ios
```

Chaque app a sa propre identité store :
- Bourse du Livre — `com.yukpomnang.bourse` — thème `#d97706`
- Yukpo Pharmacie — `com.yukpomnang.pharmacie` — thème `#059669`
- Yukpo Restaurant — `com.yukpomnang.restaurant` — thème `#dc2626`

## Écrans embarqués

Chaque App.tsx n'importe QUE les écrans du domaine concerné (≈10 écrans par app), pas les 200+ écrans du monolithe Yukpo. Ajouter un nouvel écran = ajouter une ligne `import` + `Stack.Screen`.
