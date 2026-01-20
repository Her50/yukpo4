# 📱 Guide d'utilisation de KeyboardAwareScreen

## Vue d'ensemble

`KeyboardAwareScreen` est un composant wrapper réutilisable qui résout automatiquement le problème où le clavier virtuel mobile masque les champs de saisie. Il utilise `react-native-keyboard-aware-scroll-view` pour remonter automatiquement le contenu lorsque le clavier s'ouvre.

## ✅ Avantages

- **Solution unique** : Un seul composant pour gérer le clavier sur tous les écrans
- **Configuration optimisée** : Paramètres ajustés pour iOS et Android
- **Réutilisable** : Utilisable dans tous les écrans avec formulaires
- **Maintenance facile** : Un seul endroit à modifier pour améliorer la gestion du clavier

## 📖 Usage de base

```tsx
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';

const MyFormScreen: React.FC = () => {
  return (
    <KeyboardAwareScreen>
      <View>
        <TextInput placeholder="Nom" />
        <TextInput placeholder="Email" />
        <TextInput placeholder="Message" multiline />
        <Button title="Envoyer" />
      </View>
    </KeyboardAwareScreen>
  );
};
```

## 🎛️ Props disponibles

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `children` | `ReactNode` | - | Contenu à afficher |
| `innerRef` | `Ref<KeyboardAwareScrollView>` | - | Référence au ScrollView |
| `disableScroll` | `boolean` | `false` | Désactiver le scroll |
| `extraScrollHeight` | `number` | `100` | Offset vertical supplémentaire (iOS) |
| `keyboardShouldPersistTaps` | `'always' \| 'never' \| 'handled'` | `'handled'` | Comportement des taps sur le clavier |
| `style` | `any` | - | Style personnalisé pour le conteneur |
| `contentContainerStyle` | `any` | - | Style personnalisé pour le contenu |
| `showsVerticalScrollIndicator` | `boolean` | `false` | Afficher l'indicateur de scroll |

## 📝 Exemples d'utilisation

### Exemple 1 : Formulaire simple

```tsx
<KeyboardAwareScreen style={styles.container}>
  <View style={styles.form}>
    <TextInput placeholder="Nom" />
    <TextInput placeholder="Email" />
    <Button title="Soumettre" />
  </View>
</KeyboardAwareScreen>
```

### Exemple 2 : Formulaire avec style personnalisé

```tsx
<KeyboardAwareScreen
  style={styles.container}
  contentContainerStyle={styles.content}
  showsVerticalScrollIndicator={true}
>
  <View style={styles.form}>
    {/* Vos champs ici */}
  </View>
</KeyboardAwareScreen>
```

### Exemple 3 : Formulaire sans scroll (rare)

```tsx
<KeyboardAwareScreen disableScroll={true}>
  <View style={styles.form}>
    {/* Contenu sans scroll */}
  </View>
</KeyboardAwareScreen>
```

## 🔄 Migration depuis KeyboardAvoidingView

### Avant (❌ Ancien code)

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={styles.container}
>
  <ScrollView>
    {/* Contenu */}
  </ScrollView>
</KeyboardAvoidingView>
```

### Après (✅ Nouveau code)

```tsx
import { KeyboardAwareScreen } from '../components/KeyboardAwareScreen';

<KeyboardAwareScreen style={styles.container}>
  {/* Contenu - le scroll est géré automatiquement */}
</KeyboardAwareScreen>
```

## 🎯 Écrans qui devraient utiliser KeyboardAwareScreen

Tous les écrans avec des champs de saisie (`TextInput`) devraient utiliser `KeyboardAwareScreen` :

- ✅ Écrans de connexion/inscription
- ✅ Formulaires de contact
- ✅ Formulaires de création/édition
- ✅ Écrans de recherche avec input
- ✅ Écrans de chat avec input
- ✅ Tous les formulaires dynamiques

## 📋 Checklist de migration

Pour migrer un écran existant vers `KeyboardAwareScreen` :

1. [ ] Importer `KeyboardAwareScreen` depuis `../components/KeyboardAwareScreen`
2. [ ] Remplacer `KeyboardAvoidingView` + `ScrollView` par `KeyboardAwareScreen`
3. [ ] Supprimer les props `behavior`, `keyboardVerticalOffset` (gérées automatiquement)
4. [ ] Tester sur iOS et Android
5. [ ] Vérifier que tous les champs sont visibles quand le clavier est ouvert

## ⚙️ Configuration technique

Le composant utilise :
- `react-native-keyboard-aware-scroll-view` pour la gestion du clavier
- `extraHeight: 150` pour Android
- `extraScrollHeight: 150` minimum pour iOS
- `paddingBottom: 250` (Android) / `200` (iOS) pour éviter que le clavier masque les champs

## 🐛 Dépannage

### Le clavier masque encore des champs

1. Vérifier que `KeyboardAwareScreen` enveloppe bien tout le contenu
2. Augmenter `extraScrollHeight` si nécessaire
3. Vérifier que les styles ne forcent pas une hauteur fixe

### Le scroll ne fonctionne pas

1. Vérifier que `disableScroll` n'est pas à `true`
2. Vérifier que le contenu dépasse la hauteur de l'écran

## 📚 Références

- Composant : `mobile/src/components/KeyboardAwareScreen.tsx`
- Bibliothèque : `react-native-keyboard-aware-scroll-view`
- Documentation : [react-native-keyboard-aware-scroll-view](https://github.com/APSL/react-native-keyboard-aware-scroll-view)






