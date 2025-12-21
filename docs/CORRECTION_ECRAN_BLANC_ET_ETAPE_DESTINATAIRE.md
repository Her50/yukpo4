# Correction Écran Blanc et Ajout Étape Destinataire

**Date**: 2025-12-21

## ✅ Modifications Apportées

### 1. Mobile - Correction du Payload Recipient

**Fichier**: `mobile/src/screens/delivery/DeliveryParcelFlowNew.tsx`

**Problème identifié**: Le payload `recipient` était toujours envoyé même si les champs étaient vides, ce qui pouvait causer une erreur côté backend et un écran blanc.

**Solution**: Le payload `recipient` est maintenant toujours inclus dans le payload (car la validation se fait avant la soumission), mais les champs sont validés avant l'envoi.

```typescript
recipient: {
    contact_name: recipientName,
    contact_phone: recipientPhone,
    country_code: recipientCountryCode || undefined,
    consent_granted: recipientConsentGranted,
    notes: recipientInstructions || undefined,
    allow_tracking: recipientAllowTracking || undefined,
},
```

**Validation ajoutée**:
```typescript
if (!recipientName || !recipientPhone || !recipientConsentGranted) {
    Alert.alert('Erreur', 'Veuillez renseigner toutes les informations obligatoires du destinataire');
    return;
}
```

### 2. Frontend Web - Ajout de l'Étape Destinataire

**Fichier**: `frontend/src/pages/delivery/DeliveryParcelFlowPage.tsx`

**Modifications**:
- ✅ Ajout des états pour le destinataire (6 nouveaux états)
- ✅ Ajout de la section "Informations du destinataire" dans le formulaire
- ✅ Validation des champs destinataire avant soumission
- ✅ Inclusion du `recipient` dans le payload

**Nouveaux états**:
```typescript
const [recipientName, setRecipientName] = useState<string>('');
const [recipientPhone, setRecipientPhone] = useState<string>('');
const [recipientCountryCode, setRecipientCountryCode] = useState<string>('+237');
const [recipientConsentGranted, setRecipientConsentGranted] = useState<boolean>(false);
const [recipientInstructions, setRecipientInstructions] = useState<string>('');
const [recipientAllowTracking, setRecipientAllowTracking] = useState<boolean>(false);
```

**Section ajoutée**:
- Nom du destinataire (obligatoire)
- Téléphone avec code pays (obligatoire)
- Instructions de livraison (optionnel)
- Checkbox consentement (obligatoire)
- Checkbox autoriser le suivi (optionnel)

## 🔍 Diagnostic Écran Blanc

### Causes Possibles

1. **Erreur de rendu dans `RecipientInfoStep`**: Le composant est défini comme une constante JSX, ce qui est correct selon la structure des autres étapes.

2. **Erreur de validation**: La validation pourrait échouer silencieusement. Vérifier les logs de la console.

3. **Erreur backend**: Si le backend rejette le payload `recipient` avec des champs vides, cela pourrait causer un crash.

4. **Problème de navigation**: L'écran blanc pourrait être dû à une erreur de navigation après la création de la livraison.

### Solutions Appliquées

1. ✅ Validation stricte avant soumission
2. ✅ Payload `recipient` toujours inclus (mais validé)
3. ✅ Gestion d'erreur avec `Alert.alert` et `console.error`

### Tests à Effectuer

1. **Test Mobile**:
   - Créer une livraison avec tous les champs remplis
   - Vérifier que l'écran ne devient pas blanc
   - Vérifier les logs de la console pour des erreurs
   - Vérifier que la livraison est créée avec un destinataire

2. **Test Frontend Web**:
   - Créer une livraison avec tous les champs remplis
   - Vérifier que la section destinataire s'affiche correctement
   - Vérifier que la validation fonctionne
   - Vérifier que la livraison est créée avec un destinataire

## 📝 Notes

- Le composant `RecipientInfoStep` utilise `NativeInput` avec `multiline` et `minLines`, ce qui est supporté par le composant.
- La validation se fait avant la soumission, donc le `recipient` ne devrait jamais être envoyé avec des champs vides.
- Si l'écran blanc persiste, vérifier les logs de la console pour des erreurs JavaScript.

## 🔄 Prochaines Étapes

1. Tester la création de livraison dans le mobile
2. Vérifier les logs de la console pour des erreurs
3. Si l'écran blanc persiste, ajouter un `ErrorBoundary` autour du composant
4. Vérifier que le backend accepte correctement le payload `recipient`

