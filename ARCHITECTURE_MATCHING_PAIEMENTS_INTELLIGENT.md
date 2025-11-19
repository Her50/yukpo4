# 💳 Architecture : Matching Intelligent des Modes de Paiement

## 🔍 PROBLÈME IDENTIFIÉ

### **Situation Actuelle**

Le système actuel de reversement au prestataire utilise uniquement le **wallet interne** (`user_wallets`). Il n'y a **PAS** de système de matching intelligent pour :
- Détecter le mode de paiement utilisé par le client (MTN Money, Orange Money, etc.)
- Vérifier le mode de paiement configuré par le prestataire
- Effectuer le transfert vers le bon compte (MTN Money → MTN Money, Orange Money → Orange Money)
- Gérer les cas où les modes de paiement ne correspondent pas

### **Impact**

❌ **Problème** : Si un client paie via MTN Money, mais que le prestataire n'a configuré que Orange Money, le reversement se fait dans le wallet interne, pas directement sur le compte mobile money du prestataire.

---

## ✅ SOLUTION PROPOSÉE

### **1. Stockage des Modes de Paiement**

#### **A. Table `users` - Ajouter colonnes pour modes de paiement prestataire**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{}'::jsonb;
-- Exemple: {"mtn_money": {"phone": "+237699123456", "verified": true}, "orange_money": {"phone": "+237677123456", "verified": false}}
```

#### **B. Table `payment_transactions` - Enrichir avec mode de paiement client**

La table existe déjà avec `payment_method JSONB`, mais il faut s'assurer qu'elle contient :
```json
{
  "type": "mtn_money",  // ou "orange_money", "wallet", "cash"
  "phone": "+237699123456",
  "transaction_id": "MTN_TXN_123456",
  "gateway": "mtn_momo_api"
}
```

#### **C. Table `delivery_payment_reservations` - Ajouter mode de paiement client**

```sql
ALTER TABLE delivery_payment_reservations 
ADD COLUMN IF NOT EXISTS client_payment_method JSONB,
ADD COLUMN IF NOT EXISTS merchant_payment_method JSONB;
```

---

### **2. Matching Intelligent**

#### **Algorithme de Matching**

```
1. Client paie → Enregistrer mode de paiement dans payment_transactions
2. Livraison validée → Récupérer mode de paiement client
3. Récupérer modes de paiement prestataire (users.payment_methods)
4. MATCHING :
   - Si client a payé MTN Money ET prestataire a MTN Money configuré → Transfert direct MTN Money
   - Si client a payé Orange Money ET prestataire a Orange Money configuré → Transfert direct Orange Money
   - Si modes correspondent → Transfert direct vers compte mobile money
   - Si modes NE correspondent PAS → Créditer wallet interne + Notification prestataire
```

#### **Cas de Gestion**

| Client Paie | Prestataire a | Action |
|------------|---------------|--------|
| MTN Money | MTN Money | ✅ Transfert direct MTN Money |
| Orange Money | Orange Money | ✅ Transfert direct Orange Money |
| MTN Money | Orange Money uniquement | ⚠️ Wallet interne + Notification |
| Orange Money | MTN Money uniquement | ⚠️ Wallet interne + Notification |
| MTN Money | Les deux (MTN + Orange) | ✅ Transfert MTN Money (priorité au mode client) |
| Wallet interne | N'importe quel mode | ✅ Wallet interne |

---

### **3. Implémentation Backend**

#### **A. Service de Matching de Paiement**

```rust
// backend/src/services/payment_matching_service.rs

pub struct PaymentMatchingService {
    pool: PgPool,
}

impl PaymentMatchingService {
    /// Détermine le mode de paiement optimal pour le reversement
    pub async fn determine_payout_method(
        &self,
        client_payment_method: &Value,
        merchant_user_id: i32,
    ) -> AppResult<PayoutMethod> {
        // 1. Récupérer modes de paiement prestataire
        let merchant_methods = self.get_merchant_payment_methods(merchant_user_id).await?;
        
        // 2. Extraire type de paiement client
        let client_type = client_payment_method.get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("wallet");
        
        // 3. Matching
        match client_type {
            "mtn_money" => {
                if merchant_methods.mtn_money.is_some() {
                    Ok(PayoutMethod::MtnMoney(merchant_methods.mtn_money.unwrap()))
                } else {
                    Ok(PayoutMethod::WalletInternal) // Fallback
                }
            }
            "orange_money" => {
                if merchant_methods.orange_money.is_some() {
                    Ok(PayoutMethod::OrangeMoney(merchant_methods.orange_money.unwrap()))
                } else {
                    Ok(PayoutMethod::WalletInternal) // Fallback
                }
            }
            _ => Ok(PayoutMethod::WalletInternal), // Wallet interne par défaut
        }
    }
    
    /// Effectue le reversement selon le mode déterminé
    pub async fn execute_payout(
        &self,
        merchant_user_id: i32,
        amount_cents: i64,
        payout_method: PayoutMethod,
    ) -> AppResult<()> {
        match payout_method {
            PayoutMethod::MtnMoney(phone) => {
                // Appel API MTN Money
                self.transfer_mtn_money(phone, amount_cents).await?;
            }
            PayoutMethod::OrangeMoney(phone) => {
                // Appel API Orange Money
                self.transfer_orange_money(phone, amount_cents).await?;
            }
            PayoutMethod::WalletInternal => {
                // Créditer wallet interne (comportement actuel)
                self.credit_wallet(merchant_user_id, amount_cents).await?;
            }
        }
        Ok(())
    }
}
```

#### **B. Modification de `DeliveryPaymentService::payout_merchant`**

```rust
// backend/src/services/delivery_payment_service.rs

pub async fn payout_merchant(
    &self,
    delivery_id: Uuid,
    merchant_user_id: i32,
) -> AppResult<()> {
    // ... calcul commission ...
    
    // ✅ NOUVEAU: Récupérer mode de paiement client
    let client_payment_method = self.get_client_payment_method(delivery_id).await?;
    
    // ✅ NOUVEAU: Matching intelligent
    let matching_service = PaymentMatchingService::new(self.pool.clone());
    let payout_method = matching_service
        .determine_payout_method(&client_payment_method, merchant_user_id)
        .await?;
    
    // ✅ NOUVEAU: Reversement selon mode déterminé
    match payout_method {
        PayoutMethod::MtnMoney(_) | PayoutMethod::OrangeMoney(_) => {
            // Transfert direct mobile money
            matching_service
                .execute_payout(merchant_user_id, merchant_payout_cents, payout_method)
                .await?;
            
            // Noter dans metadata que c'était un transfert direct
            // ...
        }
        PayoutMethod::WalletInternal => {
            // Comportement actuel (wallet interne)
            // ...
        }
    }
    
    Ok(())
}
```

---

### **4. Gestion des Cas Non Correspondants**

#### **A. Notification Prestataire**

Si le mode de paiement ne correspond pas, envoyer une notification :

```
"Votre reversement de 9 500 FCFA a été crédité sur votre wallet Yukpo car votre mode de paiement (Orange Money) ne correspond pas au mode utilisé par le client (MTN Money). Vous pouvez configurer MTN Money dans vos paramètres pour recevoir les futurs reversements directement."
```

#### **B. Option de Retrait**

Le prestataire peut retirer depuis son wallet interne vers son compte mobile money configuré via une page de retrait.

---

### **5. Configuration Prestataire**

#### **A. Formulaire de Configuration**

Dans `FormulaireYukpoIntelligentScreen` ou page de paramètres, ajouter :

```typescript
// Modes de paiement pour recevoir les reversements
paymentMethods: {
  mtn_money: {
    phone: string;
    verified: boolean;
  };
  orange_money: {
    phone: string;
    verified: boolean;
  };
}
```

#### **B. Vérification des Numéros**

- Envoyer un code de vérification par SMS
- Vérifier que le numéro appartient bien au prestataire
- Marquer comme `verified: true` après vérification

---

## 📋 PLAN D'IMPLÉMENTATION

### **Phase 1 : Stockage**
1. ✅ Ajouter colonne `payment_methods` à `users`
2. ✅ Enrichir `delivery_payment_reservations` avec modes de paiement
3. ✅ S'assurer que `payment_transactions` stocke correctement le mode client

### **Phase 2 : Matching**
1. ✅ Créer `PaymentMatchingService`
2. ✅ Implémenter algorithme de matching
3. ✅ Intégrer dans `DeliveryPaymentService::payout_merchant`

### **Phase 3 : Transferts Mobile Money**
1. ⚠️ Intégrer API MTN Money (si disponible)
2. ⚠️ Intégrer API Orange Money (si disponible)
3. ⚠️ Gérer les cas d'erreur (API indisponible → fallback wallet)

### **Phase 4 : UI Prestataire**
1. ✅ Formulaire configuration modes de paiement
2. ✅ Vérification numéros (SMS)
3. ✅ Page retrait wallet → mobile money

### **Phase 5 : Notifications**
1. ✅ Notification si matching impossible
2. ✅ Notification de transfert réussi
3. ✅ Historique des reversements

---

## ⚠️ POINTS D'ATTENTION

1. **APIs Mobile Money** : Nécessite intégration avec les APIs MTN/Orange (peut nécessiter partenariats)
2. **Frais de transfert** : Les APIs mobile money peuvent facturer des frais → À déduire de la commission
3. **Sécurité** : Vérification stricte des numéros de téléphone
4. **Fallback** : Toujours avoir un fallback vers wallet interne si API mobile money échoue

---

## 🎯 RÉSUMÉ

**Actuellement** : Reversement uniquement dans wallet interne

**Avec cette solution** :
- ✅ Matching intelligent client ↔ prestataire
- ✅ Transfert direct mobile money si modes correspondent
- ✅ Fallback wallet interne si modes ne correspondent pas
- ✅ Notifications pour informer le prestataire
- ✅ Configuration flexible des modes de paiement

