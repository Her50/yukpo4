# 🔧 Configuration Android pour le Clavier

## Configuration dans AndroidManifest.xml

Pour améliorer le comportement du clavier sur Android, modifiez le fichier :

`android/app/src/main/AndroidManifest.xml`

### Option recommandée : `adjustResize`

```xml
<activity
    android:name=".MainActivity"
    android:windowSoftInputMode="adjustResize"
    android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"
    android:launchMode="singleTask"
    android:theme="@style/AppTheme">
    <!-- ... autres configurations ... -->
</activity>
```

### Autres options disponibles

#### `adjustPan` (alternative)
```xml
android:windowSoftInputMode="adjustPan"
```
- **Comportement** : Déplace la fenêtre au lieu de la redimensionner
- **Avantage** : Plus rapide
- **Inconvénient** : Peut masquer certains éléments en haut

#### `adjustNothing` (non recommandé)
```xml
android:windowSoftInputMode="adjustNothing"
```
- **Comportement** : Ne fait rien
- **Utilisation** : Seulement si vous gérez le clavier manuellement

## Configuration dans app.json (Expo)

Si vous utilisez Expo, vous pouvez aussi configurer dans `app.json` :

```json
{
  "expo": {
    "android": {
      "softwareKeyboardLayoutMode": "pan"
    }
  }
}
```

**Options**:
- `"pan"` : Déplace la fenêtre (équivalent à adjustPan)
- `"resize"` : Redimensionne la fenêtre (équivalent à adjustResize)

## Note importante

⚠️ **Avec KeyboardAwareScreen, la configuration `adjustResize` est recommandée** car elle fonctionne mieux avec le scroll automatique.

## Vérification

Après modification, reconstruisez l'application :

```bash
# Pour Expo
expo prebuild --clean

# Pour React Native CLI
cd android && ./gradlew clean && cd ..
```

## Test

1. Ouvrez un écran avec des champs de saisie
2. Appuyez sur un champ en bas de l'écran
3. Vérifiez que le contenu remonte automatiquement
4. Le champ doit rester visible au-dessus du clavier

