# 💰 Architecture : Gestion Financière et Verrouillage Livraison

## 📋 SYNTHÈSE DES BESOINS

### **1. Verrouillage de Confirmation Livraison** 🔒

**Règle** : Le déclenchement de la livraison (matching coursier) ne peut se faire que si le solde Yukpo du client est suffisant.

**Coût à vérifier** :
- ✅ Prix du produit affiché
- ✅ Prix estimé du coût de livraison
- ✅ Si livraison offerte : coût livraison débité sur compte prestataire

**Mécanisme insuffisant** :
- Si solde insuffisant → blocage + mécanisme de rechargement immédiat
- Après rechargement → validation et déclenchement matching

---

### **2. Moment du Débit** ⏰

**Question** : À quel moment le compte client est-il débité ?

**Scénarios possibles** :

#### **Option A : Débit au moment de la commande (Avant matching)** 💳
```
Client commande → Vérification solde → Débit immédiat → Matching coursier
```

**Avantages** :
- ✅ Sécurisé : fonds garantis avant matching
- ✅ Évite annulation coursier si solde insuffisant
- ✅ Expérience simple pour le client

**Inconvénients** :
- ❌ Client débité même si coursier refuse
- ❌ Remboursement nécessaire si échec matching

---

#### **Option B : Débit au moment de la validation coursier** 🚚
```
Client commande → Matching coursier → Coursier accepte → Débit client
```

**Avantages** :
- ✅ Client débité seulement si coursier accepte
- ✅ Pas de remboursement nécessaire

**Inconvénients** :
- ❌ Risque : solde insuffisant au moment acceptation coursier
- ❌ Coursier peut avoir accepté mais commande annulée
- ❌ Expérience client dégradée

---

#### **Option C : Réservation au moment de la commande + Débit au moment validation** 🔐
```
Client commande → Vérification solde → Réservation fonds → Matching coursier → Coursier accepte → Débit définitif
```

**Avantages** :
- ✅ Sécurisé : fonds réservés avant matching
- ✅ Débit définitif seulement si coursier accepte
- ✅ Libération automatique si coursier refuse

**Inconvénients** :
- ⚠️ Complexité technique (système de réservation)

---

### **3. Gestion Rejet Produit** ❌

**Règle** : Si le client rejette le produit, le coût de livraison doit être systématiquement prélevé selon qui l'avait pris en charge.

**Scénarios** :

1. **Client payait la livraison + Client rejette produit** (`billing_mode: 'standard'`) :
   - ✅ Prix produit → REMBOURSÉ au client
   - ✅ Coût livraison → NON REMBOURSÉ (reste débité chez le client)
   - ✅ Prestataire → NON CRÉDITÉ (produit rejeté)

2. **Livraison offerte par prestataire + Client rejette** (`billing_mode: 'merchant_inclusive'`) :
   - ✅ Prix produit → REMBOURSÉ au client
   - ✅ Coût livraison → PRÉLEVÉ chez le client (non remboursable)
   - ✅ Prestataire → NON CRÉDITÉ (produit rejeté)
   - ⚠️ **Logique** : Le prestataire avait offert la livraison, donc pas de pénalité pour lui en cas de rejet. Le client doit assumer les frais de transport même si le produit est refusé.

---

### **4. Reversement au Prestataire** 💵

**Règle** : Le prestataire doit être crédité (prix produit - commission Yukpo) seulement après validation livraison par le coursier.

**Commission Yukpo** :
- **Taux** : Variable d'environnement `YUKPO_COMMISSION_RATE` (par défaut : 5%)
- **Configuration** : Facilement modifiable via variable d'environnement
- **Calcul** : `commission = prix_produit * commission_rate`
- **Montant reversé** : `prix_produit - commission_yukpo`
- **Exemple** : `YUKPO_COMMISSION_RATE=0.05` pour 5%, `YUKPO_COMMISSION_RATE=0.10` pour 10%

**Scénarios** :

1. **Livraison validée par coursier** :
   - ✅ Prix produit → CRÉDITÉ au prestataire
   - ✅ **Commission Yukpo (5%)** → SYSTÉMATIQUEMENT PRÉLEVÉE
   - ✅ Montant reversé = Prix produit - Commission
   - ✅ Coût livraison → Si livraison offerte, débité sur compte prestataire
   
   **Exemple** (avec commission par défaut 5%) :
   ```
   Prix produit : 10 000 FCFA
   Commission Yukpo (5%) : 500 FCFA
   Montant reversé au prestataire : 9 500 FCFA
   ```
   
   **Configuration** :
   - Variable d'environnement : `YUKPO_COMMISSION_RATE=0.05` (5%)
   - Valeur par défaut : 5% si variable non définie
   - Modifiable facilement sans recompiler le code

2. **Client rejette produit** :
   - ✅ Prix produit → NON CRÉDITÉ au prestataire
   - ✅ Coût livraison :
     * Si client payait : NON REMBOURSÉ (reste débité chez client)
     * Si prestataire avait offert : PRÉLEVÉ chez le client (non remboursable)

---

## 🎯 SOLUTION PROPOSÉE : MODÈLE HYBRIDE

### **Architecture Recommandée : Réservation + Débit Définitif**

```
ÉTAPE 1 : Client commande (commande_delivery)
  → Vérification solde (prix produit + coût livraison estimé)
  → Si insuffisant : Blocage + Mécanisme rechargement
  → Si suffisant : Réservation fonds (solde bloqué)

ÉTAPE 2 : Matching coursier
  → Coursier accepte → Débit définitif (réservation → débit réel)
  → Coursier refuse → Libération réservation (fond débloqué)

ÉTAPE 3 : Livraison
  → Coursier valide livraison → Reversement prestataire (prix produit + commission)
  → Client rejette produit → Remboursement prix produit + Coût livraison NON remboursé
```

---

## 🔧 IMPLÉMENTATION TECHNIQUE

### **1. Nouveau Système de Réservation Fonds**

#### **Table : delivery_payment_reservations**

```sql
CREATE TABLE IF NOT EXISTS delivery_payment_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Montants réservés
    product_price_cents BIGINT NOT NULL,  -- Prix du produit
    delivery_cost_cents BIGINT NOT NULL,  -- Coût estimé livraison
    total_reserved_cents BIGINT NOT NULL,  -- Total réservé
    
    -- Informations facturation
    is_delivery_free BOOLEAN DEFAULT FALSE,  -- Livraison offerte par prestataire
    billing_mode VARCHAR(50) DEFAULT 'standard',  -- 'standard' ou 'merchant_inclusive'
    merchant_pays_delivery_user_id INTEGER REFERENCES users(id),  -- Si livraison offerte
    
    -- Statut réservation
    reservation_status VARCHAR(50) NOT NULL DEFAULT 'reserved',  -- 'reserved', 'debited', 'released', 'cancelled'
    
    -- Débit définitif (si coursier accepte)
    debited_at TIMESTAMPTZ,
    debited_amount_cents BIGINT,
    
    -- Libération (si coursier refuse)
    released_at TIMESTAMPTZ,
    release_reason TEXT,
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(delivery_id)
);

CREATE INDEX idx_delivery_payment_reservations_user ON delivery_payment_reservations(user_id);
CREATE INDEX idx_delivery_payment_reservations_status ON delivery_payment_reservations(reservation_status);
CREATE INDEX idx_delivery_payment_reservations_delivery ON delivery_payment_reservations(delivery_id);
```

---

#### **Modèle Rust : DeliveryPaymentReservation**

```rust
// backend/src/models/delivery_models.rs

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DeliveryPaymentReservation {
    pub id: Uuid,
    pub delivery_id: Uuid,
    pub user_id: i32,
    
    pub product_price_cents: i64,
    pub delivery_cost_cents: i64,
    pub total_reserved_cents: i64,
    
    pub is_delivery_free: bool,
    pub billing_mode: String,
    pub merchant_pays_delivery_user_id: Option<i32>,
    
    pub reservation_status: String,  // 'reserved', 'debited', 'released', 'cancelled'
    
    pub debited_at: Option<DateTime<Utc>>,
    pub debited_amount_cents: Option<i64>,
    
    pub released_at: Option<DateTime<Utc>>,
    pub release_reason: Option<String>,
    
    pub metadata: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDeliveryPaymentReservation {
    pub delivery_id: Uuid,
    pub user_id: i32,
    
    pub product_price_cents: i64,
    pub delivery_cost_cents: i64,
    
    pub is_delivery_free: bool,
    pub billing_mode: String,
    pub merchant_pays_delivery_user_id: Option<i32>,
    
    pub metadata: Option<Value>,
}
```

---

### **2. Service de Réservation et Débit**

#### **backend/src/services/delivery_payment_service.rs**

```rust
// backend/src/services/delivery_payment_service.rs

use crate::core::types::AppError;
use crate::models::delivery_models::*;
use sqlx::PgPool;

pub struct DeliveryPaymentService {
    pool: PgPool,
}

impl DeliveryPaymentService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// ÉTAPE 1 : Créer réservation de fonds AVANT matching
    pub async fn create_payment_reservation(
        &self,
        params: CreatePaymentReservationParams,
    ) -> AppResult<DeliveryPaymentReservation> {
        // 1. Calculer le coût total
        let delivery_cost = if params.is_delivery_free {
            0  // Livraison offerte, pas de coût pour le client
        } else {
            params.estimated_delivery_cost_cents
        };
        
        let total_required = params.product_price_cents + delivery_cost;
        
        // 2. Vérifier solde utilisateur
        let current_balance = self.get_user_balance(params.user_id).await?;
        
        if current_balance < total_required {
            return Err(AppError::BadRequest(format!(
                "Solde insuffisant. Montant requis: {} FCFA, Solde disponible: {} FCFA",
                total_required, current_balance
            )));
        }
        
        // 3. Bloquer les fonds (réservation)
        // On ne débite PAS encore, on marque juste que les fonds sont réservés
        // Le solde reste inchangé mais avec une réservation enregistrée
        
        // 4. Créer réservation en base
        let reservation = sqlx::query_as!(
            DeliveryPaymentReservation,
            r#"
            INSERT INTO delivery_payment_reservations (
                delivery_id, user_id,
                product_price_cents, delivery_cost_cents, total_reserved_cents,
                is_delivery_free, billing_mode, merchant_pays_delivery_user_id,
                reservation_status, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            "#,
            params.delivery_id,
            params.user_id,
            params.product_price_cents,
            delivery_cost,
            total_required,
            params.is_delivery_free,
            params.billing_mode.unwrap_or_else(|| "standard".to_string()),
            params.merchant_pays_delivery_user_id,
            "reserved",
            params.metadata.unwrap_or_else(|| json!({}))
        )
        .fetch_one(&self.pool)
        .await?;
        
        // 5. Bloquer réellement les fonds (soustraire du solde disponible)
        // Note: On pourrait aussi créer une table "blocked_balance" séparée
        // Pour simplifier, on débite immédiatement mais avec statut "reserved"
        // Si coursier refuse, on rembourse
        
        let new_balance = self
            .apply_wallet_mutation(
                params.user_id,
                params.delivery_id,
                total_required,
                WalletEventDirection::Debit,
                Some("reservation_livraison".to_string()),
                None,
            )
            .await?;
        
        Ok(reservation)
    }

    /// ÉTAPE 2 : Valider réservation → Débit définitif (quand coursier accepte)
    pub async fn confirm_payment_reservation(
        &self,
        delivery_id: Uuid,
        courier_accepted: bool,
    ) -> AppResult<()> {
        let reservation = self.get_reservation_by_delivery(delivery_id).await?;
        
        if reservation.reservation_status != "reserved" {
            return Err(AppError::BadRequest(
                format!("Réservation déjà traitée: {}", reservation.reservation_status)
            ));
        }
        
        if courier_accepted {
            // Coursier accepte → Débit définitif (réservation → débit réel)
            sqlx::query!(
                r#"
                UPDATE delivery_payment_reservations
                SET reservation_status = 'debited',
                    debited_at = NOW(),
                    debited_amount_cents = total_reserved_cents,
                    updated_at = NOW()
                WHERE id = $1
                "#,
                reservation.id
            )
            .execute(&self.pool)
            .await?;
            
            // Si livraison offerte, débiter le prestataire
            if reservation.is_delivery_free {
                if let Some(merchant_id) = reservation.merchant_pays_delivery_user_id {
                    self.apply_wallet_mutation(
                        merchant_id,
                        reservation.delivery_id,
                        reservation.delivery_cost_cents,
                        WalletEventDirection::Debit,
                        Some("livraison_offerte".to_string()),
                        None,
                    )
                    .await?;
                }
            }
        } else {
            // Coursier refuse → Libération réservation (remboursement)
            sqlx::query!(
                r#"
                UPDATE delivery_payment_reservations
                SET reservation_status = 'released',
                    released_at = NOW(),
                    release_reason = 'Coursier a refusé la livraison',
                    updated_at = NOW()
                WHERE id = $1
                "#,
                reservation.id
            )
            .execute(&self.pool)
            .await?;
            
            // Rembourser le client
            self.apply_wallet_mutation(
                reservation.user_id,
                reservation.delivery_id,
                reservation.total_reserved_cents,
                WalletEventDirection::Refund,
                Some("remboursement_coursier_refuse".to_string()),
                None,
            )
            .await?;
        }
        
        Ok(())
    }

    /// ÉTAPE 3 : Traiter livraison validée par coursier
    pub async fn process_delivery_completed(
        &self,
        delivery_id: Uuid,
        product_rejected: bool,
    ) -> AppResult<DeliveryPaymentResult> {
        let reservation = self.get_reservation_by_delivery(delivery_id).await?;
        
        if reservation.reservation_status != "debited" {
            return Err(AppError::BadRequest(
                "Paiement non confirmé pour cette livraison"
            ));
        }
        
        if product_rejected {
            // Client rejette produit
            // Règle : Prix produit remboursé, Coût livraison selon qui l'avait pris en charge
            
            // 1. Rembourser prix produit au client
            self.apply_wallet_mutation(
                reservation.user_id,
                reservation.delivery_id,
                reservation.product_price_cents,
                WalletEventDirection::Refund,
                Some("remboursement_rejet_produit".to_string()),
                None,
            )
            .await?;
            
            // 2. Gestion coût livraison selon billing_mode
            if reservation.billing_mode == "merchant_inclusive" {
                // Livraison offerte par prestataire → Prélever chez le client
                // Le prestataire avait offert, donc pas de pénalité pour lui
                self.apply_wallet_mutation(
                    reservation.user_id,
                    reservation.delivery_id,
                    reservation.delivery_cost_cents,
                    WalletEventDirection::Debit,
                    Some("frais_transport_rejet_produit_offert".to_string()),
                    None,
                )
                .await?;
            } else {
                // Client payait la livraison → Coût reste débité (non remboursable)
                // Rien à faire, le coût est déjà débité
            }
            
            // 3. Pas de reversement au prestataire (produit rejeté)
            
            Ok(DeliveryPaymentResult {
                client_refund_cents: reservation.product_price_cents,
                delivery_cost_cents: reservation.delivery_cost_cents,
                merchant_credit_cents: 0,  // Pas de reversement
                delivery_cost_non_refundable: true,
            })
        } else {
            // Livraison validée → Reversement au prestataire
            // 1. Calculer commission Yukpo (taux configurable via variable d'environnement)
            let commission_rate = std::env::var("YUKPO_COMMISSION_RATE")
                .ok()
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.05);  // Par défaut 5% si variable non définie
            let commission_cents = (reservation.product_price_cents as f64 * commission_rate) as i64;
            let merchant_credit = reservation.product_price_cents - commission_cents;
            
            // Commission toujours prélevée sur chaque reversement (taux configurable)
            
            // 2. Créditer le prestataire
            let merchant_id = self.get_delivery_creator(delivery_id).await?;
            self.apply_wallet_mutation(
                merchant_id,
                reservation.delivery_id,
                merchant_credit,
                WalletEventDirection::Credit,  // Crédit pour le prestataire
                Some("reversement_livraison_validee".to_string()),
                None,
            )
            .await?;
            
            // 3. Coût livraison : Si offerte, déjà débité sur compte prestataire
            // Si pas offerte, déjà débité sur compte client
            
            Ok(DeliveryPaymentResult {
                client_refund_cents: 0,
                delivery_cost_cents: reservation.delivery_cost_cents,
                merchant_credit_cents: merchant_credit,
                delivery_cost_non_refundable: false,
            })
        }
    }

    // Méthodes utilitaires
    async fn get_user_balance(&self, user_id: i32) -> AppResult<i64> {
        let balance = sqlx::query_scalar!(
            r#"SELECT tokens_balance FROM users WHERE id = $1"#,
            user_id
        )
        .fetch_one(&self.pool)
        .await?;
        
        Ok(balance.unwrap_or(0))
    }

    async fn get_reservation_by_delivery(
        &self,
        delivery_id: Uuid,
    ) -> AppResult<DeliveryPaymentReservation> {
        let reservation = sqlx::query_as!(
            DeliveryPaymentReservation,
            r#"SELECT * FROM delivery_payment_reservations WHERE delivery_id = $1"#,
            delivery_id
        )
        .fetch_one(&self.pool)
        .await?;
        
        Ok(reservation)
    }

    async fn get_delivery_creator(&self, delivery_id: Uuid) -> AppResult<i32> {
        let creator_id = sqlx::query_scalar!(
            r#"SELECT creator_id FROM deliveries WHERE id = $1"#,
            delivery_id
        )
        .fetch_one(&self.pool)
        .await?;
        
        Ok(creator_id.unwrap())
    }

    async fn apply_wallet_mutation(
        &self,
        user_id: i32,
        delivery_id: Uuid,
        amount_cents: i64,
        direction: WalletEventDirection,
        reason: Option<String>,
        metadata: Option<Value>,
    ) -> AppResult<i64> {
        // Utiliser le système existant de wallet mutations
        // Voir delivery_repository.rs:apply_wallet_mutation
        // ...
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePaymentReservationParams {
    pub delivery_id: Uuid,
    pub user_id: i32,
    pub product_price_cents: i64,
    pub estimated_delivery_cost_cents: i64,
    pub is_delivery_free: bool,
    pub billing_mode: Option<String>,
    pub merchant_pays_delivery_user_id: Option<i32>,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPaymentResult {
    pub client_refund_cents: i64,
    pub delivery_cost_cents: i64,
    pub merchant_credit_cents: i64,
    pub delivery_cost_non_refundable: bool,
}

enum WalletEventDirection {
    Debit,
    Credit,
    Refund,
}
```

---

### **3. Intégration dans DeliveryService**

#### **Modification de `create_delivery_request`**

```rust
// backend/src/services/delivery_service.rs

pub async fn create_delivery_request(
    &self,
    params: CreateDeliveryParams,
) -> AppResult<DeliverySummary> {
    // 1. Calculer coût livraison estimé
    let estimated_delivery_cost = self.estimate_delivery_cost(&params).await?;
    
    // 2. Récupérer prix produit
    let product_price = self.get_product_price(params.product_id).await?;
    
    // 3. Vérifier si livraison offerte
    let is_delivery_free = params.metadata
        .get("delivery")
        .and_then(|v| v.get("is_free"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    let merchant_pays_delivery_user_id = if is_delivery_free {
        Some(params.creator_id)  // Le prestataire paie la livraison
    } else {
        None
    };
    
    // 4. Créer réservation de paiement AVANT matching
    let payment_service = DeliveryPaymentService::new(self.pool.clone());
    let reservation = payment_service.create_payment_reservation(
        CreatePaymentReservationParams {
            delivery_id: params.delivery_id,
            user_id: params.client_id,  // ID du client qui commande
            product_price_cents: product_price,
            estimated_delivery_cost_cents: estimated_delivery_cost,
            is_delivery_free,
            billing_mode: Some("standard".to_string()),
            merchant_pays_delivery_user_id,
            metadata: None,
        }
    ).await?;
    
    // 5. Créer livraison (sans matching encore)
    let delivery_summary = self.repository.create_delivery(params).await?;
    
    // 6. Matching coursier (déclenché seulement si réservation OK)
    // ...
    
    Ok(delivery_summary)
}
```

---

### **4. Mécanisme de Rechargement Immédiat**

#### **Frontend : Composant de Rechargement**

```typescript
// frontend/src/components/DeliveryPaymentModal.tsx

interface DeliveryPaymentModalProps {
  deliveryId: string;
  requiredAmount: number;
  currentBalance: number;
  onPaymentComplete: () => void;
  onCancel: () => void;
}

export const DeliveryPaymentModal: React.FC<DeliveryPaymentModalProps> = ({
  deliveryId,
  requiredAmount,
  currentBalance,
  onPaymentComplete,
  onCancel,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<string>('orange_money');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleTopUp = async () => {
    setIsProcessing(true);
    
    try {
      // 1. Calculer montant à recharger
      const amountToTopUp = requiredAmount - currentBalance;
      
      // 2. Initier paiement
      const paymentResponse = await paymentService.initiatePayment({
        amount_xaf: amountToTopUp,
        payment_method: paymentMethod,
        phone_number: phoneNumber,
        reference: `delivery_${deliveryId}`,
      });
      
      // 3. Rediriger vers page de paiement ou attendre webhook
      if (paymentResponse.payment_url) {
        window.open(paymentResponse.payment_url, '_blank');
      }
      
      // 4. Polling pour vérifier paiement
      await pollPaymentStatus(paymentResponse.payment_id);
      
      // 5. Paiement confirmé → Retry création livraison
      onPaymentComplete();
      
    } catch (error) {
      toast.error('Erreur lors du rechargement');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onCancel}>
      <div className="payment-modal">
        <h2>Solde Insuffisant</h2>
        <p>
          Montant requis : {requiredAmount} FCFA
          <br />
          Solde actuel : {currentBalance} FCFA
          <br />
          <strong>À recharger : {requiredAmount - currentBalance} FCFA</strong>
        </p>
        
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="orange_money">Orange Money</option>
          <option value="mtn_money">MTN Mobile Money</option>
          <option value="visa">Carte Visa</option>
        </select>
        
        <input
          type="tel"
          placeholder="Numéro de téléphone"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        
        <button onClick={handleTopUp} disabled={isProcessing}>
          {isProcessing ? 'Traitement...' : 'Recharger maintenant'}
        </button>
        
        <button onClick={onCancel}>Annuler</button>
      </div>
    </Modal>
  );
};
```

---

### **5. Intégration Mobile**

#### **mobile/src/components/DeliveryPaymentScreen.tsx**

```typescript
// mobile/src/components/DeliveryPaymentScreen.tsx

export const DeliveryPaymentScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { deliveryId, requiredAmount, currentBalance } = route.params;
  
  const [paymentMethod, setPaymentMethod] = useState<string>('orange_money');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  
  const handleTopUp = async () => {
    try {
      const amountToTopUp = requiredAmount - currentBalance;
      
      const paymentResponse = await paymentService.initiatePayment({
        amount_xaf: amountToTopUp,
        payment_method: paymentMethod,
        phone_number: phoneNumber,
        reference: `delivery_${deliveryId}`,
      });
      
      // Rediriger vers page de paiement mobile money
      if (paymentMethod === 'orange_money' || paymentMethod === 'mtn_money') {
        // Ouvrir app mobile money via deep link
        const deepLink = getMobileMoneyDeepLink(paymentMethod, paymentResponse.payment_url);
        Linking.openURL(deepLink);
      }
      
      // Attendre confirmation webhook
      await waitForPaymentConfirmation(paymentResponse.payment_id);
      
      // Retourner à la création de livraison
      navigation.goBack();
      
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de recharger le compte');
    }
  };
  
  return (
    <ScrollView>
      <Text style={styles.title}>Solde Insuffisant</Text>
      <Text style={styles.subtitle}>
        Montant requis : {requiredAmount} FCFA{'\n'}
        Solde actuel : {currentBalance} FCFA{'\n'}
        À recharger : {requiredAmount - currentBalance} FCFA
      </Text>
      
      <Picker selectedValue={paymentMethod} onValueChange={setPaymentMethod}>
        <Picker.Item label="Orange Money" value="orange_money" />
        <Picker.Item label="MTN Mobile Money" value="mtn_money" />
        <Picker.Item label="Carte Visa" value="visa" />
      </Picker>
      
      <TextInput
        placeholder="Numéro de téléphone"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
      />
      
      <NativeButton onPress={handleTopUp} variant="primary">
        Recharger maintenant
      </NativeButton>
      
      <NativeButton onPress={() => navigation.goBack()} variant="secondary">
        Annuler
      </NativeButton>
    </ScrollView>
  );
};
```

---

## 📊 FLUX COMPLET : RÉSUMÉ

### **Scénario 1 : Client commande avec solde suffisant**

```
1. Client clique "Se faire livrer"
   → Calcul coût total (prix produit + coût livraison)
   → Vérification solde : SUFFISANT ✅
   
2. Réservation fonds créée
   → Fonds bloqués (débité du solde)
   → Statut : "reserved"
   
3. Matching coursier déclenché
   → Coursier accepte ✅
   → Réservation → Débit définitif
   → Statut : "debited"
   
4. Coursier valide livraison
   → Client reçoit produit ✅
   → Reversement prestataire (prix produit - commission)
   → Coût livraison : Débité sur client (ou prestataire si offerte)
```

---

### **Scénario 2 : Client commande avec solde insuffisant**

```
1. Client clique "Se faire livrer"
   → Calcul coût total
   → Vérification solde : INSUFFISANT ❌
   
2. Modal de rechargement affichée
   → Montant à recharger affiché
   → Client choisit méthode paiement
   → Client recharge compte
   
3. Après rechargement
   → Retry création livraison
   → Vérification solde : SUFFISANT ✅
   → Retour scénario 1
```

---

### **Scénario 3 : Coursier refuse la livraison**

```
1. Réservation fonds créée (statut : "reserved")
   → Fonds bloqués

2. Matching coursier
   → Coursier refuse ❌
   
3. Libération réservation
   → Remboursement client (montant total)
   → Statut : "released"
   → Fonds débloqués
```

---

### **Scénario 4 : Client rejette le produit**

```
1. Livraison validée par coursier
   → Réservation → Débit définitif ✅
   
2. Client reçoit produit
   → Client rejette produit ❌
   
3. Traitement rejet
   → Prix produit → REMBOURSÉ au client
   → Coût livraison :
     * Si client payait : NON REMBOURSÉ (reste débité chez client)
     * Si prestataire avait offert : PRÉLEVÉ chez le client (non remboursable)
   → Prestataire → NON CRÉDITÉ (produit rejeté)
   
4. Si livraison offerte
   → Coût livraison reste débité sur compte prestataire
```

---

### **Scénario 5 : Livraison offerte par prestataire**

```
1. Client commande
   → Livraison offerte (is_delivery_free = true)
   → Coût total = Prix produit (coût livraison = 0 pour client)
   
2. Réservation fonds créée
   → Seulement prix produit réservé
   
3. Coursier accepte
   → Débit définitif prix produit sur client
   → Débit coût livraison sur compte prestataire
   
4. Livraison validée
   → Reversement prestataire (prix produit - commission)
   → Coût livraison reste débité sur compte prestataire
```

---

## ✅ MON AVIS SUR CETTE APPROCHE

### **Points Positifs** ✅

1. ✅ **Sécurité** : Fonds garantis avant matching (évite annulations)
2. ✅ **Expérience client** : Rechargement immédiat si solde insuffisant
3. ✅ **Gestion rejet** : Coût livraison non remboursable (logique)
4. ✅ **Livraison offerte** : Débit correct sur compte prestataire
5. ✅ **Flexibilité** : Système de réservation permet gestion fine

---

### **Points d'Attention** ⚠️

1. ⚠️ **Complexité** : Système de réservation ajoute une couche de complexité
2. ⚠️ **Remboursements** : Gestion remboursements en cas de coursier refuse
3. ⚠️ **Temps** : Délai entre réservation et débit définitif
4. ⚠️ **Audit** : Traçabilité complète nécessaire (réservations, débits, remboursements)

---

### **Recommandations** 💡

1. ✅ **Option recommandée** : **Réservation + Débit définitif** (Option C)
   - Meilleur équilibre sécurité/expérience
   - Gestion fine des cas limites

2. ✅ **Alternative simplifiée** : Si complexité trop élevée, utiliser **Débit immédiat** (Option A)
   - Plus simple à implémenter
   - Remboursement si coursier refuse

3. ✅ **Mécanisme rechargement** : Essentiel pour bonne UX
   - Modal de rechargement immédiate
   - Deep links vers mobile money

4. ✅ **Audit complet** : Traçabilité obligatoire
   - Table `delivery_payment_reservations`
   - Logs toutes transactions
   - Historique complet

---

## 📝 INTÉGRATION DANS PLAN D'AMÉLIORATIONS

**Ajouter au `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md`** :

```markdown
## 9. GESTION FINANCIÈRE ET VERROUILLAGE LIVRAISON

### ✅ **Observation : Verrouillage confirmation livraison**

**Règle** :
- Vérification solde AVANT matching coursier
- Coût = Prix produit + Coût livraison (si pas offerte)
- Si livraison offerte : Coût livraison débité sur compte prestataire
- Si solde insuffisant : Mécanisme rechargement immédiat

### ✅ **Moment du débit**

**Architecture** : Réservation + Débit définitif
1. Réservation fonds au moment commande (avant matching)
2. Débit définitif quand coursier accepte
3. Libération si coursier refuse

### ✅ **Gestion rejet produit**

**Règle** :
- Prix produit → REMBOURSÉ au client
- Coût livraison → NON REMBOURSÉ (reste débité)
- Prestataire → NON CRÉDITÉ (produit rejeté)

### ✅ **Reversement prestataire**

**Règle** :
- Reversement seulement après validation livraison par coursier
- Montant = Prix produit - Commission Yukpo
- Commission = 5% (configurable)
```

---

**Cette approche garantit sécurité financière, expérience utilisateur optimale, et gestion correcte de tous les cas limites.** ✅

Souhaites-tu que j'intègre cela dans le `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md` ?

