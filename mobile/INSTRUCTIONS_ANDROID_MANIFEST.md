# 📱 Configuration AndroidManifest.xml pour le Clavier

## 📍 Emplacement du fichier

Le fichier `AndroidManifest.xml` se trouve dans :
```
mobile/android/app/src/main/AndroidManifest.xml
```

**Note** : Si vous utilisez Expo, ce fichier est généré automatiquement lors de `expo prebuild`. Vous devrez peut-être d'abord exécuter `expo prebuild` pour créer le dossier `android/`.

## 🔧 Modification à apporter

### Option 1 : Modifier directement AndroidManifest.xml

Ouvrez le fichier et trouvez l'activité `MainActivity` :

```xml
<activity
    android:name=".MainActivity"
    android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"
    android:launchMode="singleTask"
    android:theme="@style/AppTheme"
    ...>
```

Ajoutez ou modifiez la ligne `android:windowSoftInputMode` :

```xml
<activity
    android:name=".MainActivity"
    android:windowSoftInputMode="adjustResize"
    android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"
    android:launchMode="singleTask"
    android:theme="@style/AppTheme"
    ...>
```

### Option 2 : Configuration via app.config.js (Expo)

Si vous utilisez Expo, vous pouvez aussi configurer dans `mobile/app.config.js` :

```javascript
export default {
  expo: {
    // ... autres configurations
    android: {
      // ... autres configurations Android
      softwareKeyboardLayoutMode: "resize" // ou "pan"
    }
  }
};
```

Puis exécutez :
```bash
expo prebuild --clean
```

## 📋 Options disponibles

### `adjustResize` (Recommandé ✅)
- **Comportement** : Redimensionne la fenêtre pour faire de la place au clavier
- **Avantage** : Fonctionne parfaitement avec KeyboardAwareScreen
- **Utilisation** : Recommandé pour la plupart des applications

### `adjustPan` (Alternative)
- **Comportement** : Déplace la fenêtre au lieu de la redimensionner
- **Avantage** : Plus rapide, moins de calculs
- **Inconvénient** : Peut masquer certains éléments en haut de l'écran

### `adjustNothing` (Non recommandé ❌)
- **Comportement** : Ne fait rien
- **Utilisation** : Seulement si vous gérez le clavier manuellement

## ✅ Après modification

1. **Reconstruire l'application** :
   ```bash
   # Pour Expo
   expo prebuild --clean
   
   # Pour React Native CLI
   cd android && ./gradlew clean && cd ..
   ```

2. **Tester** :
   - Ouvrir un écran avec des champs de saisie
   - Appuyer sur un champ en bas de l'écran
   - Vérifier que le contenu remonte automatiquement
   - Le champ doit rester visible au-dessus du clavier

## 🔍 Vérification

Pour vérifier que la configuration est appliquée, vous pouvez :

1. **Vérifier le fichier AndroidManifest.xml** :
   ```bash
   grep -r "windowSoftInputMode" mobile/android/app/src/main/AndroidManifest.xml
   ```

2. **Vérifier app.config.js** :
   ```bash
   grep -r "softwareKeyboardLayoutMode" mobile/app.config.js
   ```

## ⚠️ Notes importantes

- La configuration `adjustResize` est recommandée avec `KeyboardAwareScreen`
- Si vous utilisez Expo, préférez la configuration via `app.config.js` pour éviter que `expo prebuild` écrase vos modifications
- Après modification, reconstruisez toujours l'application

