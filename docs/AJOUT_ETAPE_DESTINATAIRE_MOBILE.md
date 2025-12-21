# Ajout de l'Étape Destinataire dans le Formulaire Mobile

**Date**: 2025-12-21  
**Fichier modifié**: `mobile/src/screens/delivery/DeliveryParcelFlowNew.tsx`

## ✅ Modifications Apportées

### 1. Ajout des États pour le Destinataire

Ajout de 6 nouveaux états pour gérer les informations du destinataire :

```typescript
const [recipientName, setRecipientName] = useState<string>('');
const [recipientPhone, setRecipientPhone] = useState<string>('');
const [recipientCountryCode, setRecipientCountryCode] = useState<string>('+237');
const [recipientConsentGranted, setRecipientConsentGranted] = useState<boolean>(false);
const [recipientInstructions, setRecipientInstructions] = useState<string>('');
const [recipientAllowTracking, setRecipientAllowTracking] = useState<boolean>(false);
```

### 2. Création du Composant `RecipientInfoStep`

Nouvelle étape du formulaire avec les champs suivants :

- **Nom du destinataire** (`contact_name`) - obligatoire
- **Téléphone** (`contact_phone`) - obligatoire avec code pays
- **Instructions de livraison** (`notes`) - optionnel
- **Consentement** (`consent_granted`) - checkbox obligatoire
- **Autoriser le suivi** (`allow_tracking`) - checkbox optionnel

### 3. Ajout de l'Étape dans le Tableau `steps`

Nouvelle étape ajoutée :

```typescript
{
    id: 'recipient',
    label: 'Destinataire',
    icon: 'user',
    component: RecipientInfoStep,
    validation: () => !!recipientName && !!recipientPhone && recipientConsentGranted,
}
```

### 4. Inclusion du Destinataire dans le Payload

Le payload inclut maintenant le destinataire avec les champs au format backend (snake_case) :

```typescript
recipient: {
    contact_name: recipientName,
    contact_phone: recipientPhone,
    country_code: recipientCountryCode || undefined,
    consent_granted: recipientConsentGranted,
    notes: recipientInstructions || undefined,
    allow_tracking: recipientAllowTracking || undefined,
}
```

### 5. Ajout des Styles

Nouveaux styles ajoutés :
- `phoneInputContainer` : Container pour code pays + téléphone
- `countryCodeInput` : Input pour le code pays
- `phoneInput` : Input pour le numéro de téléphone
- `checkboxGroup` : Groupe de checkboxes
- `checkboxRow` : Ligne de checkbox
- `checkbox` / `checkboxChecked` : Styles des checkboxes
- `checkboxLabel` : Label des checkboxes
- `errorText` : Texte d'erreur

## 📊 Structure du Formulaire Après Modification

Le formulaire a maintenant **4 étapes** :

1. **Colis** - Informations du colis (type, poids, volume, valeur, notes, photos)
2. **Collecte** - Adresse de collecte (pickup location)
3. **Livraison** - Adresse de livraison (dropoff location)
4. **🆕 Destinataire** - Informations du destinataire (nom, téléphone, consentement, instructions)

## ✅ Validation

La validation de l'étape destinataire vérifie :
- ✅ Nom du destinataire renseigné
- ✅ Téléphone renseigné
- ✅ Consentement accordé

## 🔄 Impact

**Avant** :
- Les livraisons étaient créées sans destinataire
- Le destinataire devait être assigné plus tard via `assignRecipient`
- Le matching ne se déclenchait pas

**Après** :
- Les livraisons sont créées avec un destinataire
- Le matching se déclenche immédiatement (grâce à la correction précédente)
- Le coursier peut contacter le destinataire directement
- Meilleure expérience utilisateur

## 🧪 Test

Pour tester :
1. Ouvrir le formulaire de création de livraison
2. Remplir les 3 premières étapes (Colis, Collecte, Livraison)
3. Remplir la nouvelle étape "Destinataire"
4. Soumettre le formulaire
5. Vérifier que la livraison est créée avec un destinataire
6. Vérifier que le matching se déclenche (logs backend)

