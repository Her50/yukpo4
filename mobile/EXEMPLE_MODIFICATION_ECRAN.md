# 📝 Exemple de modification d'un écran pour gérer le clavier

## Avant (avec KeyboardAvoidingView)

```tsx
import { KeyboardAvoidingView, ScrollView, Platform } from 'react-native';

export default function MyScreen() {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TextInput placeholder="Nom" />
        <TextInput placeholder="Email" />
        <TextInput placeholder="Téléphone" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

## Après (avec KeyboardAwareScreen) ✅

```tsx
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';
import { View, TextInput } from 'react-native';

export default function MyScreen() {
  return (
    <KeyboardAwareScreen>
      <View style={styles.container}>
        <TextInput placeholder="Nom" />
        <TextInput placeholder="Email" />
        <TextInput placeholder="Téléphone" />
      </View>
    </KeyboardAwareScreen>
  );
}
```

## Avantages

1. ✅ **Plus simple** : Un seul composant au lieu de deux
2. ✅ **Meilleur comportement** : Scroll automatique vers le champ actif
3. ✅ **Fonctionne mieux sur Android** : Configuration optimisée
4. ✅ **Moins de code** : Pas besoin de gérer Platform.OS

## Cas spéciaux

### Si vous avez déjà un ScrollView avec du contenu complexe

**Option 1** : Remplacer le ScrollView par KeyboardAwareScreen
```tsx
// Avant
<ScrollView>
  <Content />
</ScrollView>

// Après
<KeyboardAwareScreen>
  <Content />
</KeyboardAwareScreen>
```

**Option 2** : Utiliser disableScroll si vous n'avez pas besoin de scroll
```tsx
<KeyboardAwareScreen disableScroll={true}>
  <View>
    <Content />
  </View>
</KeyboardAwareScreen>
```

### Si vous avez un formulaire dans une modal

```tsx
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';

export default function MyModal() {
  return (
    <Modal>
      <KeyboardAwareScreen extraScrollHeight={100}>
        <FormContent />
      </KeyboardAwareScreen>
    </Modal>
  );
}
```

