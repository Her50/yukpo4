# Instructions d'intégration - Bloc Paiement Frontend

## Fichiers créés
- ✅ `frontend/src/utils/paymentValidation.ts` - Fonctions de validation
- ✅ `frontend/src/components/ui/PaymentMethodSelector.tsx` - Composant de sélection

## Modifications à apporter dans FormulaireYukpoIntelligentScreen

### 1. Ajouter l'import du composant

```typescript
import PaymentMethodSelector from '@/components/ui/PaymentMethodSelector';
```

### 2. Ajouter l'état paymentMethod

Chercher les `useState` au début et ajouter :

```typescript
const [paymentMethod, setPaymentMethod] = useState<any>(null);
```

### 3. Ajouter le bloc "Paiement" dans l'initialisation des blocs

Chercher la définition des blocs (probablement ligne 100-150) et AJOUTER après le bloc "media" ou "branding" :

```typescript
{
  id: 'payment',
  title: 'Paiement',
  icon: '💳',
  fields: []
},
```

### 4. Ajouter le gestionnaire de rendu

Chercher où sont rendus les custom components (probablement section `renderField`), ajouter :

```typescript
// Gestionnaire de mode de paiement
if (field.name === '_payment_manager') {
  return (
    <div key={field.name}>
      <PaymentMethodSelector
        onPaymentChange={setPaymentMethod}
        readonly={isReadonly}
      />
    </div>
  );
}
```

### 5. S'assurer que le bloc payment a un champ custom

Chercher la section qui ajoute les champs custom aux blocs (comme `_media_manager`, `_products_manager`), ajouter :

```typescript
// S'assurer que le bloc paiement est toujours présent
if (!blocksWithFixedOnes.find(b => b.id === 'payment').fields.length) {
  blocksWithFixedOnes.find(b => b.id === 'payment')!.fields.push({
    name: '_payment_manager',
    type: 'custom',
    label: 'Mode de paiement',
    required: false
  } as any);
}
```

### 6. Ajouter le paymentMethod dans les données envoyées

Chercher où `finalServiceData` est préparé (avant l'appel API), ajouter :

```typescript
// Ajouter le mode de paiement si présent
if (paymentMethod) {
  finalServiceData.mode_paiement = {
    type_donnee: 'object',
    valeur: paymentMethod,
    origine_champs: 'formulaire'
  };
  console.log('Mode de paiement ajouté:', paymentMethod);
}
```

---

## Modifications à apporter dans RechargeTokens (Frontend)

### Fichier à modifier : `frontend/src/pages/RechargeTokens.tsx` ou similaire

Chercher où est rendu le formulaire de paiement et :

1. **Importer les validations** :
```typescript
import { validatePhoneNumber, validateCardNumber, validateCardExpiry } from '@/utils/paymentValidation';
```

2. **Ajouter les états** :
```typescript
const [phoneError, setPhoneError] = useState<string | null>(null);
const [cardNumber, setCardNumber] = useState('');
const [cardExpiry, setCardExpiry] = useState('');
const [cardCVV, setCardCVV] = useState('');
const [cardHolder, setCardHolder] = useState('');
```

3. **Ajouter la validation avant soumission** :
```typescript
// Pour Mobile Money / Orange Money
if (selectedPaymentMethod === 'mtn_money' || selectedPaymentMethod === 'orange_money') {
  const validation = validatePhoneNumber(phoneNumber);
  if (!validation.valid) {
    alert(validation.error || 'Numéro invalide');
    return;
  }
}

// Pour carte bancaire
if (selectedPaymentMethod === 'card') {
  const cardValidation = validateCardNumber(cardNumber);
  const expiryValidation = validateCardExpiry(cardExpiry);
  
  if (!cardValidation.valid) {
    alert(cardValidation.error);
    return;
  }
  if (!expiryValidation.valid) {
    alert(expiryValidation.error);
    return;
  }
  if (cardCVV.length < 3) {
    alert('CVV invalide');
    return;
  }
}
```

4. **Afficher les erreurs en temps réel** :
```tsx
{phoneError && (
  <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
    <AlertCircle className="w-4 h-4" />
    <p>{phoneError}</p>
  </div>
)}
```

---

## ✅ Checklist

### Frontend FormulaireYukpoIntelligentScreen
- [ ] Import PaymentMethodSelector
- [ ] Ajouter état paymentMethod
- [ ] Ajouter bloc payment dans l'initialisation
- [ ] Ajouter renderField pour _payment_manager
- [ ] Ajouter champ custom au bloc payment
- [ ] Inclure paymentMethod dans finalServiceData
- [ ] Tester création service avec paiement

### Frontend RechargeTokens
- [ ] Import validations paymentValidation.ts
- [ ] Ajouter états pour carte bancaire
- [ ] Ajouter validation avant soumission
- [ ] Afficher erreurs en temps réel
- [ ] Tester recharge avec Mobile Money
- [ ] Tester recharge avec carte bancaire

---

## 💡 Notes

- Les validations sont **identiques** au mobile (même logique)
- Les numéros sont validés selon **6 pays d'Afrique Centrale**
- L'indicatif pays est **géré automatiquement**
- Les cartes bancaires utilisent l'**algorithme de Luhn** (standard industrie)
- Tout est **typé TypeScript** pour éviter les erreurs

---

## 📱 Pays supportés

1. **Cameroun** (+237) - 9 chiffres (6XX XX XX XX)
2. **Gabon** (+241) - 8 chiffres (0X XX XX XX)
3. **RCA** (+236) - 8 chiffres (7X XX XX XX)
4. **Congo-Brazzaville** (+242) - 9 chiffres (0X XX XX XX X)
5. **Tchad** (+235) - 8 chiffres (6X XX XX XX)
6. **Guinée Équatoriale** (+240) - 9 chiffres (2XX XX XX XX)

---

## 🔒 Sécurité

- ✅ Validation côté client (UX)
- ✅ Validation côté serveur (à implémenter backend)
- ✅ CVV en mode password
- ✅ Messages d'erreur clairs
- ✅ Format automatique pour meilleure lisibilité

**Tous les composants sont prêts !** Il suffit d'intégrer selon ces instructions. 🚀

