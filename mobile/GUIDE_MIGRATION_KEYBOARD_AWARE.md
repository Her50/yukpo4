# 🔧 Guide de Migration - KeyboardAwareScreen

## 📋 Écrans à modifier

### Priorité 1 - Écrans d'authentification
- [x] `RegisterScreen.tsx` - ✅ Modifié
- [ ] `LoginScreen.tsx` - Déjà partiellement configuré
- [ ] `PartnerRegisterScreen.tsx` - Déjà partiellement configuré

### Priorité 2 - Écrans FormScreen (11 écrans)
- [ ] `PharmacieFormScreen.tsx`
- [ ] `HopitalFormScreen.tsx`
- [ ] `LaboratoireFormScreen.tsx`
- [ ] `AgenceVoyageFormScreen.tsx`
- [ ] `BanqueSangFormScreen.tsx`
- [ ] `ImmobilierFormScreen.tsx`
- [ ] `LivreScolaireFormScreen.tsx`
- [ ] `OffresEmploiFormScreen.tsx`
- [ ] `TaxiFormScreen.tsx`
- [ ] `CovoiturageFormScreen.tsx`
- [ ] `BusReturnRequestFormScreen.tsx`

### Priorité 3 - Écrans de recherche
- [ ] `ResultatBesoinScreen.tsx`
- [ ] `CovoiturageSearchScreen.tsx`
- [ ] `ImmobilierSearchScreen.tsx`
- [ ] `RecipeSearchScreen.tsx`
- [ ] `OffreSearchScreen.tsx`

## 🔄 Étapes de migration

### Étape 1 : Modifier les imports

**Avant** :
```typescript
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
```

**Après** :
```typescript
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
```

### Étape 2 : Remplacer KeyboardAvoidingView + ScrollView

**Avant** :
```tsx
<KeyboardAvoidingView
  style={styles.container}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {/* Contenu */}
  </ScrollView>
</KeyboardAvoidingView>
```

**Après** :
```tsx
<KeyboardAwareScreen 
  style={styles.container} 
  contentContainerStyle={styles.scrollContent}
>
  {/* Contenu */}
</KeyboardAwareScreen>
```

### Étape 3 : Si seulement ScrollView (sans KeyboardAvoidingView)

**Avant** :
```tsx
<ScrollView contentContainerStyle={styles.scrollContent}>
  {/* Contenu */}
</ScrollView>
```

**Après** :
```tsx
<KeyboardAwareScreen contentContainerStyle={styles.scrollContent}>
  {/* Contenu */}
</KeyboardAwareScreen>
```

## ✅ Exemple complet - RegisterScreen

### Avant
```tsx
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function RegisterScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TextInput label="Nom" />
        <TextInput label="Email" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

### Après
```tsx
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';

export default function RegisterScreen() {
  return (
    <KeyboardAwareScreen 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
    >
      <TextInput label="Nom" />
      <TextInput label="Email" />
    </KeyboardAwareScreen>
  );
}
```

## 🎯 Cas spéciaux

### Si vous avez déjà un ScrollView avec keyboardShouldPersistTaps

**Avant** :
```tsx
<ScrollView 
  contentContainerStyle={styles.scrollContent}
  keyboardShouldPersistTaps="handled"
>
  {/* Contenu */}
</ScrollView>
```

**Après** :
```tsx
<KeyboardAwareScreen 
  contentContainerStyle={styles.scrollContent}
  keyboardShouldPersistTaps="handled"
>
  {/* Contenu */}
</KeyboardAwareScreen>
```

### Si vous avez besoin de désactiver le scroll

```tsx
<KeyboardAwareScreen disableScroll={true}>
  {/* Contenu sans scroll */}
</KeyboardAwareScreen>
```

## 📝 Checklist de migration

Pour chaque écran :
- [ ] Modifier les imports (retirer KeyboardAvoidingView, Platform, ScrollView)
- [ ] Ajouter l'import de KeyboardAwareScreen
- [ ] Remplacer KeyboardAvoidingView + ScrollView par KeyboardAwareScreen
- [ ] Tester que le clavier fonctionne correctement
- [ ] Vérifier que le scroll fonctionne toujours
- [ ] Tester sur iOS et Android

## 🚀 Script de migration automatique

Un script PowerShell est disponible dans `scripts/migrate-keyboard-aware.ps1` pour automatiser la migration.

