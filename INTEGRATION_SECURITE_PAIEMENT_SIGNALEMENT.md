# 🔒 Guide d'intégration - Sécurité, Paiement & Signalement

## 🎯 Objectif

Ajouter 3 fonctionnalités critiques :
1. **Alertes de sécurité** - Rappeler aux clients de vérifier le prestataire
2. **Système de signalement** - Permettre de signaler un produit/service problématique  
3. **Paiement en ligne** - Payer directement le prestataire via l'app

---

## ✅ FICHIERS CRÉÉS

### Backend
- ✅ `backend/migrations/20251020_add_signalement_system.sql` - Tables signalements + sanctions
- ✅ `backend/src/controllers/signalement_controller.rs` - API signalements
- ✅ `backend/src/routes/signalement_routes.rs` - Routes signalements
- ✅ Intégré dans `mod.rs` et `router_yukpo.rs`

### Mobile
- ✅ `mobile/src/components/AlerteSecurite.tsx` - Composant d'alerte
- ✅ `mobile/src/components/SignalementModal.tsx` - Modal de signalement
- ✅ `mobile/src/components/PaiementEnLigneModal.tsx` - Modal de paiement

---

## 📝 INTÉGRATIONS À FAIRE

### 1. ProductCard.tsx (mobile/src/components/)

#### A. Ajouter les imports
```typescript
import AlerteSecurite from './AlerteSecurite';
import SignalementModal from './SignalementModal';
import PaiementEnLigneModal from './PaiementEnLigneModal';
```

#### B. Ajouter les états (après les useState existants)
```typescript
const [showAlerte, setShowAlerte] = useState(true);
const [showSignalement, setShowSignalement] = useState(false);
const [showPaiement, setShowPaiement] = useState(false);
```

#### C. Insérer l'alerte AVANT le contenu de la carte
Chercher `return ( <TouchableOpacity style={styles.card}` et ajouter JUSTE APRÈS l'ouverture :

```typescript
return (
    <TouchableOpacity style={styles.card} ...>
        {/* ✅ NOUVEAU: Alerte de sécurité */}
        {showAlerte && (
            <AlerteSecurite 
                variant="warning" 
                showDetails={false}
                onDismiss={() => setShowAlerte(false)}
            />
        )}
        
        {/* ... reste du contenu existant ... */}
```

#### D. Ajouter boutons "Signaler" et "Payer en ligne"
Chercher la section des boutons d'action (probablement après le prix), ajouter :

```typescript
{/* ✅ NOUVEAU: Boutons Signaler et Payer */}
<View style={styles.securityActions}>
    <TouchableOpacity
        style={styles.signalButton}
        onPress={() => setShowSignalement(true)}
    >
        <SafeIcon name="flag" size={16} color={modernColors.error} />
        <Text style={styles.signalButtonText}>Signaler</Text>
    </TouchableOpacity>

    {service.data?.mode_paiement && (
        <TouchableOpacity
            style={styles.payOnlineButton}
            onPress={() => setShowPaiement(true)}
        >
            <SafeIcon name="credit-card" size={16} color="#FFFFFF" />
            <Text style={styles.payOnlineButtonText}>Payer en ligne</Text>
        </TouchableOpacity>
    )}
</View>
```

#### E. Ajouter les modals à la fin (avant le dernier `</TouchableOpacity>`)
```typescript
        {/* ✅ NOUVEAU: Modals */}
        <SignalementModal
            visible={showSignalement}
            onClose={() => setShowSignalement(false)}
            serviceId={service.id}
            productId={product.id}
            productName={product.nom}
        />

        <PaiementEnLigneModal
            visible={showPaiement}
            onClose={() => setShowPaiement(false)}
            service={service}
            product={product}
            prestataire={prestataire}
            montant={parseFloat(product.prix)}
            devise={product.devise}
        />
    </TouchableOpacity>
);
```

#### F. Ajouter les styles
```typescript
securityActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
},
signalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
},
signalButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
},
payOnlineButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: modernColors.success,
    paddingVertical: 10,
    borderRadius: 8,
},
payOnlineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
},
```

---

### 2. ChatModalMobile.tsx (mobile/src/components/)

#### A. Ajouter les imports
```typescript
import AlerteSecurite from './AlerteSecurite';
import PaiementEnLigneModal from './PaiementEnLigneModal';
```

#### B. Ajouter les états
```typescript
const [showAlerteSecurite, setShowAlerteSecurite] = useState(false);
const [showPaiementModal, setShowPaiementModal] = useState(false);
```

#### C. Ajouter l'alerte APRÈS le header (ligne ~660)
```typescript
{/* ✅ NOUVEAU: Alerte sécurité (peut être cachée par l'utilisateur) */}
{showAlerteSecurite && (
    <View style={{ padding: 16 }}>
        <AlerteSecurite 
            variant="info" 
            showDetails={true}
            onDismiss={() => setShowAlerteSecurite(false)}
        />
    </View>
)}
```

#### D. Ajouter bouton "Payer" dans les actions du header
Chercher `headerActions` et ajouter :

```typescript
<TouchableOpacity
    style={styles.actionButton}
    onPress={() => setShowPaiementModal(true)}
>
    <SafeIcon name="credit-card" size={20} color={modernColors.success} />
</TouchableOpacity>
```

#### E. Ajouter le modal à la fin (avant `</Modal>` final)
```typescript
{/* ✅ NOUVEAU: Modal paiement en ligne */}
<PaiementEnLigneModal
    visible={showPaiementModal}
    onClose={() => setShowPaiementModal(false)}
    service={service}
    prestataire={prestataireInfo}
    montant={0} // L'utilisateur saisira le montant
    devise="XAF"
/>
```

---

## 🚀 FICHIERS BACKEND À AJOUTER (si routes payment manquantes)

Créer `backend/src/controllers/payment_transfer_controller.rs` :

```rust
use axum::{extract::State, response::Json, Extension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

use crate::{
    middlewares::jwt::AuthenticatedUser,
    state::AppState,
    core::types::{AppError, AppResult},
};

#[derive(Debug, Deserialize)]
pub struct PaymentTransferRequest {
    pub service_id: i32,
    pub product_id: Option<String>,
    pub amount: f64,
    pub currency: String,
    pub recipient_user_id: i32,
    pub recipient_payment_method: serde_json::Value,
    pub sender_payment: serde_json::Value,
}

pub async fn initiate_payment_transfer(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthenticatedUser>,
    Json(payload): Json<PaymentTransferRequest>,
) -> AppResult<Json<serde_json::Value>> {
    let pool = &state.pg;
    
    // Créer la transaction de paiement
    let result = sqlx::query(
        r#"
        INSERT INTO payment_attempts 
        (user_id, amount_xaf, payment_method, currency, metadata, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id
        "#
    )
    .bind(auth_user.id)
    .bind(payload.amount)
    .bind(payload.recipient_payment_method.get("type").and_then(|t| t.as_str()).unwrap_or("unknown"))
    .bind(&payload.currency)
    .bind(json!({
        "service_id": payload.service_id,
        "product_id": payload.product_id,
        "recipient_user_id": payload.recipient_user_id,
        "recipient_payment": payload.recipient_payment_method,
        "sender_payment": payload.sender_payment
    }))
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to create payment: {}", e)))?;
    
    let payment_id = result.get::<i32, _>("id");
    
    // TODO: Intégrer avec passerelle de paiement réelle (Flutterwave, Stripe, etc.)
    
    Ok(Json(json!({
        "success": true,
        "message": "Paiement initié",
        "data": {
            "transaction_id": format!("PAY-{}-{}", payment_id, chrono::Utc::now().format("%Y%m%d")),
            "payment_id": payment_id,
            "status": "pending"
        }
    })))
}
```

Ajouter route dans `payment_routes.rs` ou créer nouveau fichier routes.

---

## ✅ CHECKLIST D'INTÉGRATION

### Backend
- [ ] Exécuter migration signalements : `psql ... < backend/migrations/20251020_add_signalement_system.sql`
- [ ] Ajouter payment_transfer_controller.rs (si API paiement manquante)
- [ ] cargo build

### Mobile
- [ ] ProductCard.tsx : Ajouter imports, états, alerte, boutons, modals, styles
- [ ] ChatModalMobile.tsx : Ajouter imports, états, alerte, bouton payer, modal
- [ ] Tester signalement
- [ ] Tester paiement en ligne
- [ ] Tester alerte sécurité

### Frontend (optionnel - même logique)
- [ ] Créer composants équivalents
- [ ] Intégrer dans ProductCard et ChatModal

---

## 🎯 FONCTIONNALITÉS

### Alerte Sécurité 🛡️
- Affichée automatiquement dans ProductCard
- Peut être fermée par l'utilisateur
- Liste 5 points de vérification
- 2 variants : warning (orange) et info (bleu)

### Signalement 🚩
- 9 types prédéfinis (arnaque, spam, contrefaçon, etc.)
- 10 motifs fréquents cochables
- Description libre (500 caractères)
- Backend : priorité automatique selon type
- Notification aux modérateurs
- Historique utilisateur
- Protection anti-spam (1 signalement/24h par service)

### Paiement en Ligne 💳
- Utilise le mode de paiement DU PRESTATAIRE
- 4 étapes :
  1. Alerte sécurité (obligatoire)
  2. Montant (avec recommandation acompte 30-50%)
  3. Saisie coordonnées paiement
  4. Confirmation
- Validation temps réel
- Transaction trackée en DB

---

## 🔒 SÉCURITÉ

- ✅ Alerte systématique avant paiement
- ✅ Validation coordonnées paiement (6 pays)
- ✅ Vérification carte bancaire (algorithme Luhn)
- ✅ Système de signalement avec modération
- ✅ Historique des sanctions prestataires
- ✅ Fonction `check_prestataire_risque()` en SQL

---

## 📊 BASE DE DONNÉES

### Table `signalements`
- Stocke tous les signalements
- Type, motifs prédéfinis, motif libre
- Statut (en_attente, en_cours, resolu, rejete)
- Priorité (basse, normale, haute, urgente)

### Table `sanctions_historique`
- Avertissements, suspensions, suppressions
- Durée configurable
- Traçabilité complète

### Fonction `check_prestataire_risque(user_id)`
Retourne :
```json
{
  "risque": "aucun|faible|moyen|élevé",
  "signalements_actifs": 0,
  "sanctions_actives": 0,
  "recommandation": "Aucun signalement connu"
}
```

---

## 🧪 TESTS RECOMMANDÉS

1. **Alerte sécurité** : Vérifier affichage dans ProductCard
2. **Signalement** : Signaler un produit → vérifier en DB → vérifier notification modérateur
3. **Paiement** : Tester les 3 modes (Mobile Money, Orange Money, Carte)
4. **Validation** : Tester numéros invalides → messages d'erreur clairs
5. **Protection anti-spam** : Signaler 2x le même service → 2ème refusé

---

## 💡 RECOMMANDATIONS

- **ProductCard** : Montrer l'alerte + boutons en bas de carte
- **ChatModal** : Alerte en haut (peut être fermée) + bouton "Payer" dans header
- **Backend paiement** : À connecter avec vraie passerelle (Flutterwave, Stripe, etc.)
- **Modération** : Dashboard admin pour gérer signalements (à créer)

---

## 🎨 UI/UX

### Alerte Sécurité
- Variant warning (orange) : dans ProductCard
- Variant info (bleu) : dans ChatModal
- Checklist visible : 5 points essentiels
- Dismissible : utilisateur peut fermer

### Modal Signalement
- 9 types avec icônes et couleurs
- Grid 3 colonnes responsive
- Motifs cochables (UX rapide)
- Description libre optionnelle
- Compteur caractères (500 max)

### Modal Paiement
- 4 étapes guidées avec progression
- Alerte obligatoire (étape 1)
- Validation temps réel
- Affichage mode paiement prestataire
- Confirmation récapitulative

---

## ⚠️ IMPORTANT

Le **paiement en ligne** nécessite :
1. Intégration passerelle de paiement (Flutterwave, Stripe, PayPal, etc.)
2. Compliance PCI-DSS pour cartes bancaires
3. Gestion des webhooks de confirmation
4. Système d'escrow (optionnel mais recommandé)

Pour le MVP, vous pouvez :
- Simuler le paiement (status = 'pending')
- Notifier le prestataire
- Finaliser manuellement

---

**Tous les composants sont prêts !** Il suffit d'intégrer dans ProductCard et ChatModal selon les instructions ci-dessus. 🚀

**Temps estimé** : 20-30 minutes d'intégration

