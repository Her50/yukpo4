# 📸 Instructions - Message Clarification Images Principales

## 🎯 Objectif

Ajouter un message clair pour différencier **images principales** du produit des **images de variantes** dans le formulaire agroalimentaire.

---

## 📍 Où Ajouter le Message

**Si une section images existe** après les champs spécifiques du formulaire, ajouter ce message **AVANT** l'upload d'images.

### Emplacement Supposé

```tsx
{/* Section N: Images du Produit */}
<View style={styles.sectionHeader}>
    <SafeIcon name="camera" size={20} color={modernColors.primary} />
    <Text style={styles.sectionTitle}>Images du Produit</Text>
</View>

{/* ✅ NOUVEAU: Message de clarification */}
<View style={styles.infoBox}>
    <SafeIcon name="info" size={16} color={modernColors.primary} />
    <Text style={styles.infoText}>
        <Text style={styles.infoBold}>💡 Important :</Text> Ces images sont les 
        <Text style={styles.infoBold}> images principales</Text> du produit 
        (affichées par défaut dans les résultats de recherche).
        {'\n\n'}
        Les <Text style={styles.infoBold}>images de chaque variante</Text> (1kg, 5kg, 25kg...) 
        sont ajoutées individuellement dans la section 
        <Text style={styles.infoBold}> "Variantes de Conditionnement"</Text> ci-dessus.
    </Text>
</View>

{/* Upload images principales... */}
<TouchableOpacity 
    style={styles.imagePickerButton}
    onPress={handlePickImages}
>
    <SafeIcon name="image" size={20} color="#FFFFFF" />
    <Text style={styles.imagePickerText}>Ajouter des images principales</Text>
</TouchableOpacity>
```

---

## 🎨 Styles à Ajouter

### Dans StyleSheet.create({ ... })

```tsx
infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF', // Bleu clair
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: modernColors.primary, // #6366F1
    marginBottom: 16,
},
infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E3A8A', // Bleu foncé
    lineHeight: 20,
},
infoBold: {
    fontWeight: '700',
    color: '#1E40AF', // Bleu plus foncé
},
```

---

## 📱 Aperçu Visuel

```
┌────────────────────────────────────────────┐
│ 📸 Images du Produit                       │
├────────────────────────────────────────────┤
│ ℹ️ 💡 Important : Ces images sont les     │
│    images principales du produit           │
│    (affichées par défaut dans les          │
│    résultats de recherche).                │
│                                            │
│    Les images de chaque variante           │
│    (1kg, 5kg, 25kg...) sont ajoutées       │
│    individuellement dans la section        │
│    "Variantes de Conditionnement"          │
│    ci-dessus.                              │
├────────────────────────────────────────────┤
│ [🖼️ Ajouter des images principales]       │
│                                            │
│ [Image 1] [Image 2] [Image 3]              │
└────────────────────────────────────────────┘
```

---

## 🔍 Alternative : Tooltip

Si l'espace est limité, utiliser un tooltip compact :

```tsx
<View style={styles.sectionHeader}>
    <SafeIcon name="camera" size={20} color={modernColors.primary} />
    <Text style={styles.sectionTitle}>Images Principales</Text>
    <TouchableOpacity 
        style={styles.tooltipButton}
        onPress={() => Alert.alert(
            '📸 Images Principales vs Variantes',
            '• Images principales : Affichées par défaut dans la liste\n\n' +
            '• Images variantes : Spécifiques à chaque conditionnement (1kg, 5kg...), ' +
            'ajoutées dans "Variantes de Conditionnement"',
            [{ text: 'Compris', style: 'default' }]
        )}
    >
        <SafeIcon name="help-circle" size={16} color={modernColors.primary} />
    </TouchableOpacity>
</View>
```

**Style tooltip** :
```tsx
tooltipButton: {
    padding: 6,
    marginLeft: 8,
},
```

---

## ✅ Bénéfices

1. **Clarté** : Utilisateur comprend la différence
2. **Guidance** : Sait où ajouter chaque type d'image
3. **UX** : Évite les erreurs de manipulation
4. **Professionnalisme** : Interface bien documentée

---

## 🎯 Checklist

- [ ] Identifier la section images dans ProductManagerMobile
- [ ] Ajouter le message de clarification (infoBox ou tooltip)
- [ ] Ajouter les styles correspondants
- [ ] Tester l'affichage sur mobile
- [ ] Valider la compréhension utilisateur

---

## 📝 Note Technique

**Si la section images n'existe pas** dans ProductManagerMobile :
- Les images sont peut-être gérées au niveau du service parent
- Ou dans un composant séparé (MediaUploader, ImageGallery, etc.)
- Dans ce cas, ajouter le message dans ce composant externe

**Vérifier** :
- `ServiceCreationForm.tsx`
- `ImageUploadComponent.tsx`
- `MediaManager.tsx`
- Ou tout composant gérant l'upload d'images

---

## ✅ Conclusion

Le message est **prêt à être intégré** dès que la section images est identifiée dans le formulaire.

**Deux options** :
1. **InfoBox complète** : Message détaillé avec icône
2. **Tooltip compact** : Icône help-circle avec popup

Les deux solutions sont fonctionnelles et professionnelles ! 🎨










