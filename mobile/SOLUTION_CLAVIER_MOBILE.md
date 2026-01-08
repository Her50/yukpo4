# 🔧 Solution Globale - Gestion du Clavier Mobile

## 🎯 Problème résolu

Lorsque le clavier virtuel s'ouvre sur mobile, il masque souvent les champs de saisie. Cette solution permet à l'application de remonter automatiquement pour que les champs restent visibles.

## ✅ Solution implémentée

### 1. Composant `KeyboardAwareScreen`

Un composant wrapper qui gère automatiquement le clavier en utilisant `react-native-keyboard-aware-scroll-view`.

**Fichier**: `mobile/src/components/KeyboardAwareScreen.tsx`

**Fonctionnalités**:
- ✅ Scroll automatique vers le champ actif
- ✅ Fonctionne sur iOS et Android
- ✅ Espace supplémentaire au-dessus du clavier
- ✅ Configuration personnalisable

### 2. HOC `withKeyboardAware`

Un Higher Order Component pour envelopper facilement les écrans existants.

**Fichier**: `mobile/src/components/withKeyboardAware.tsx`

## 📖 Guide d'utilisation

### Méthode 1 : Utilisation directe du composant

```tsx
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';

export default function MyScreen() {
  return (
    <KeyboardAwareScreen>
      <View>
        <TextInput placeholder="Nom" />
        <TextInput placeholder="Email" />
        <TextInput placeholder="Téléphone" />
      </View>
    </KeyboardAwareScreen>
  );
}
```

### Méthode 2 : Utilisation du HOC

```tsx
import { withKeyboardAware } from '../components/withKeyboardAware';

function MyScreen() {
  return (
    <View>
      <TextInput placeholder="Nom" />
      <TextInput placeholder="Email" />
    </View>
  );
}

export default withKeyboardAware(MyScreen);
```

### Méthode 3 : Options personnalisées

```tsx
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';

export default function MyScreen() {
  return (
    <KeyboardAwareScreen
      extraScrollHeight={50} // Espace supplémentaire au-dessus du clavier
      keyboardShouldPersistTaps="handled" // Permettre les interactions
      showsVerticalScrollIndicator={true} // Afficher l'indicateur de scroll
    >
      <View>
        <TextInput placeholder="Nom" />
      </View>
    </KeyboardAwareScreen>
  );
}
```

## 🔧 Configuration Android (optionnel)

Pour améliorer encore le comportement sur Android, ajoutez dans `android/app/src/main/AndroidManifest.xml` :

```xml
<activity
    android:name=".MainActivity"
    android:windowSoftInputMode="adjustResize"
    ...>
```

**Options disponibles**:
- `adjustResize` : Redimensionne la fenêtre (recommandé)
- `adjustPan` : Déplace la fenêtre
- `adjustNothing` : Ne fait rien

## 📋 Écrans à modifier (priorité)

### Priorité haute (formulaires avec beaucoup de champs)
1. ✅ `FormulaireYukpoIntelligentScreen` - Déjà partiellement configuré
2. ✅ `AjouterProduitSimpleScreen` - Déjà partiellement configuré
3. ⚠️ `LoginScreen` - Déjà partiellement configuré
4. ⚠️ `RegisterScreen` - À modifier
5. ⚠️ `PartnerRegisterScreen` - Déjà partiellement configuré
6. ⚠️ Tous les écrans `*FormScreen` (PharmacieFormScreen, etc.)

### Priorité moyenne
- Écrans de recherche avec champs de saisie
- Écrans de profil avec édition
- Écrans de commande avec formulaire

## 🎨 Exemple complet

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';

export default function ExampleScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <KeyboardAwareScreen>
      <View style={{ padding: 20 }}>
        <TextInput
          placeholder="Nom"
          value={name}
          onChangeText={setName}
          style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
        />
        <TextInput
          placeholder="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
        />
        <Button title="Valider" onPress={() => console.log('Submit')} />
      </View>
    </KeyboardAwareScreen>
  );
}
```

## ⚠️ Notes importantes

1. **Ne pas utiliser avec ScrollView imbriqué** : Si votre écran a déjà un ScrollView, utilisez `disableScroll={true}` ou remplacez le ScrollView par KeyboardAwareScreen.

2. **Performance** : Le composant est optimisé pour les performances, mais évitez de l'utiliser sur des écrans avec beaucoup d'animations complexes.

3. **iOS vs Android** : Le comportement peut légèrement différer entre iOS et Android. Testez sur les deux plateformes.

## 🔍 Dépannage

### Le clavier masque toujours les champs
- Vérifiez que `KeyboardAwareScreen` enveloppe bien tout le contenu
- Augmentez `extraScrollHeight` si nécessaire
- Vérifiez la configuration AndroidManifest.xml

### Le scroll ne fonctionne pas
- Vérifiez que `disableScroll={false}` (par défaut)
- Vérifiez que le contenu dépasse la hauteur de l'écran

### Performance dégradée
- Évitez d'utiliser KeyboardAwareScreen sur des écrans avec beaucoup d'éléments
- Utilisez `disableScroll={true}` si vous n'avez pas besoin de scroll

## 📚 Références

- [react-native-keyboard-aware-scroll-view](https://github.com/APSL/react-native-keyboard-aware-scroll-view)
- [React Native KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview)

