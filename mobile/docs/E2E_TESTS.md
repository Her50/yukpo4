# Tests E2E Mobile – Yukpo Delivery

## 1. Outils

- **Detox** : automatisation native Android/iOS pour les tests end-to-end.
- **Maestro** : scénarios légers (smoke) exécutables sur devices réels ou cloud.

Les deux stacks partagent le même jeu d’identifiants d’écran (`text`, `testID`, libellés App).

## 2. Detox

### Scripts npm

```
npm run detox:build:android   # expo prebuild (sans --clean) + assembleDebug/AndroidTest
npm run detox:test:android    # lance les tests sur l’AVD Pixel_6_Pro_API_34

npm run detox:build:ios       # expo prebuild + build Debug simulators
npm run detox:test:ios        # lance les tests sur iPhone 14 simulé
```

> Les commandes `detox:build:*` injectent automatiquement `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_WS_BASE_URL` vers le mock server (`http://10.0.2.2:4000` pour Android, `http://127.0.0.1:4000` pour iOS). Adaptez-les si vous ciblez un backend réel.

### Pré-requis

1. Installer les dépendances : `npm install -g detox-cli` (ou utiliser `npx detox`).
2. Disposer d’un AVD Android nommé `Pixel_6_Pro_API_34` et/ou d’un simulateur iOS `iPhone 14`.
3. Avoir exécuté `expo prebuild` au moins une fois pour générer les dossiers `android/` et `ios/`.
4. Mock server (`e2e/mock-server.js`) : il se lance automatiquement depuis les tests Detox. Pour des scénarios custom, mettez à jour les payloads renvoyés par les routes `/api/deliveries/*`.

### Configuration

- `detox.config.js` : définit les binaires (`android/app/build/outputs/.../app-debug.apk`, `ios/build/.../Yukpomnang.app`) et les devices.
- `e2e/jest.config.js` : runner jest-circus avec timeout 180s.
- Tests : `e2e/delivery.home.e2e.js` – démarre le mock server, vérifie la Home et l’accès à l’écran de tracking.

### Ajouts recommandés

- Étendre le mock server pour couvrir login, panier, chat afin de s’approcher du staging.
- Ajouter des `testID` ciblés sur les composants critiques (`NativeButton`, `DeliveryTrackingMap`) pour fiabiliser les sélecteurs.

## 3. Maestro

### Script npm

```
npm run maestro:test
```

Ce script exécute tous les scénarios présents dans `maestro/flows/`. Exemple livré : `delivery-basic.yaml` (smoke test qui vérifie l’accueil et l’ouverture du flux shopping).

### Pré-requis

- Installer le CLI : `npm install -g @maestro/cli` (ou utiliser `npx maestro`).
- Fournir un device/simulateur déjà démarré et accessible via `adb` ou `xcrun simctl`.

## 4. Intégration CI/CD

1. **Build** : générer les binaires E2E (`detox:build:*`) via pipeline (GitHub Actions, Hetzner, etc.).
2. **Tests** :
   - Android : `detox test -c android.emu.debug --record-logs all`.
   - iOS : exécuter sur runner macOS (même commande).
   - Maestro : `maestro test maestro/flows --format junit --output maestro/results`.
3. **Rapports** : publier les résultats Jest (Detox) + JUnit (Maestro) dans le job CI.

### Gestion des artefacts

- `bin/` : stocker les APK/IPA à télécharger pour exécution locale.
- Logs Detox (`artifacts/`) : utiles pour les investigations (screencasts + logs console).
- Captures Maestro : disponibles via `maestro/results`.

## 5. Scénarios à planifier

- Création course supermarché complète (client) + acceptation coursier.
- Partage localisation destinataire (offline/online).
- Gestion échecs WebSocket + reprise offline (file de mutations).
- Validation ticket de caisse (courier) & mise à jour balance.
- Chat temps réel client ↔ coursier.

## 6. Astuces

- Utiliser `detox devices list` pour trouver le nom exact de l’AVD.
- Pour accélérer les builds Android, remplacer `expo prebuild` par une pipeline Gradle dédiée une fois le projet bare stabilisé.
- Maestro peut être branché sur devices cloud (Sauce Labs, BrowserStack) pour les smoke tests multi-régions.

---

👉 Prochaine étape : intégrer ces commandes dans la CI Hetzner (workflow spécifique Android + job macOS externe pour iOS) puis ajouter un jeu de seeds backend afin de rendre les scénarios déterministes.

