# 📱 Documentation : Intégration APIs Mobile Money (MTN Money / Orange Money)

## 📋 Vue d'ensemble

Ce document décrit comment intégrer les APIs MTN Money et Orange Money dans le système de matching intelligent des modes de paiement. Le code est déjà préparé avec des fonctions stub, il suffit de les implémenter.

---

## 🔧 Configuration

### **Variables d'environnement à ajouter**

Ajoutez ces variables dans votre fichier `.env` du backend :

```bash
# MTN Money API
MTN_MONEY_API_URL=https://api.mtn.com/v1
MTN_MONEY_API_KEY=your_mtn_api_key_here
MTN_MONEY_API_SECRET=your_mtn_api_secret_here
MTN_MONEY_ENVIRONMENT=sandbox  # ou 'production'

# Orange Money API
ORANGE_MONEY_API_URL=https://api.orange.com/v1
ORANGE_MONEY_API_KEY=your_orange_api_key_here
ORANGE_MONEY_API_SECRET=your_orange_api_secret_here
ORANGE_MONEY_ENVIRONMENT=sandbox  # ou 'production'
```

### **Ajout dans `env_template/backend.qa.env`**

```bash
# Mobile Money APIs (Phase 5 - Matching Intelligent)
MTN_MONEY_API_URL=
MTN_MONEY_API_KEY=
MTN_MONEY_API_SECRET=
MTN_MONEY_ENVIRONMENT=sandbox

ORANGE_MONEY_API_URL=
ORANGE_MONEY_API_KEY=
ORANGE_MONEY_API_SECRET=
ORANGE_MONEY_ENVIRONMENT=sandbox
```

---

## 🔌 Implémentation MTN Money

### **Fichier : `backend/src/services/payment_matching_service.rs`**

#### **1. Fonction `transfer_mtn_money()`**

Remplacez la fonction stub par cette implémentation :

```rust
/// ✅ Intègre API MTN Money pour transfert direct
async fn transfer_mtn_money(
    &self,
    phone: &str,
    amount_cents: i64,
) -> AppResult<String> {
    let api_url = std::env::var("MTN_MONEY_API_URL")
        .map_err(|_| AppError::Internal("MTN_MONEY_API_URL non configurée".into()))?;
    
    let api_key = std::env::var("MTN_MONEY_API_KEY")
        .map_err(|_| AppError::Internal("MTN_MONEY_API_KEY non configurée".into()))?;
    
    let api_secret = std::env::var("MTN_MONEY_API_SECRET")
        .map_err(|_| AppError::Internal("MTN_MONEY_API_SECRET non configurée".into()))?;
    
    let client = reqwest::Client::new();
    
    // Convertir centimes en FCFA
    let amount_fcfa = amount_cents as f64 / 100.0;
    
    // Préparer le payload selon la documentation MTN Money API
    let payload = json!({
        "amount": amount_fcfa,
        "currency": "XAF",
        "externalId": format!("YUKPO_{}", uuid::Uuid::new_v4()),
        "payer": {
            "partyIdType": "MSISDN",
            "partyId": phone
        },
        "payerMessage": "Reversement Yukpo",
        "payeeNote": format!("Livraison Yukpo - {}", amount_fcfa)
    });
    
    // Appel API MTN Money
    let response = client
        .post(&format!("{}/collection/v1_0/requesttopay", api_url))
        .header("Authorization", format!("Bearer {}", self.get_mtn_access_token().await?))
        .header("X-Target-Environment", std::env::var("MTN_MONEY_ENVIRONMENT").unwrap_or_else(|_| "sandbox".to_string()))
        .header("X-Reference-Id", uuid::Uuid::new_v4().to_string())
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur appel API MTN Money: {}", e)))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());
        log::error!("Erreur API MTN Money: {}", error_text);
        return Err(AppError::Internal(format!("MTN Money API error: {}", error_text)));
    }
    
    let result: Value = response.json().await
        .map_err(|e| AppError::Internal(format!("Erreur parsing réponse MTN Money: {}", e)))?;
    
    let transaction_id = result.get("transactionId")
        .or_else(|| result.get("transaction_id"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("MTN Money API: transactionId manquant".into()))?;
    
    log::info!("✅ Transfert MTN Money réussi: transaction_id={}, phone={}, amount={} FCFA", 
        transaction_id, phone, amount_fcfa);
    
    Ok(transaction_id.to_string())
}

/// ✅ Récupère le token d'accès MTN Money (OAuth2)
async fn get_mtn_access_token(&self) -> AppResult<String> {
    // TODO: Implémenter cache du token (éviter de le récupérer à chaque appel)
    // Pour l'instant, récupération à chaque fois
    
    let api_key = std::env::var("MTN_MONEY_API_KEY")?;
    let api_secret = std::env::var("MTN_MONEY_API_SECRET")?;
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.mtn.com/v1/oauth/access_token")
        .header("Authorization", format!("Basic {}", base64::encode(format!("{}:{}", api_key, api_secret))))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body("grant_type=client_credentials")
        .send()
        .await?;
    
    let result: Value = response.json().await?;
    let access_token = result.get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("MTN Money: access_token manquant".into()))?;
    
    Ok(access_token.to_string())
}
```

#### **2. Modifier `execute_payout()` pour utiliser MTN Money**

Dans la fonction `execute_payout()`, remplacez le bloc `MtnMoney` :

```rust
PayoutMethod::MtnMoney { phone, verified } => {
    if verified {
        match self.transfer_mtn_money(&phone, amount_cents).await {
            Ok(transaction_id) => {
                log::info!("✅ Transfert MTN Money réussi: transaction_id={}", transaction_id);
                Ok("mtn_money".to_string())
            }
            Err(e) => {
                log::error!("❌ Erreur transfert MTN Money, fallback wallet: {:?}", e);
                // Fallback vers wallet interne en cas d'erreur
                self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, 
                    Some(format!("Reversement (MTN Money échoué: {})", e))).await?;
                Ok("wallet_internal".to_string())
            }
        }
    } else {
        // Numéro non vérifié → wallet interne
        self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, 
            Some("Reversement (MTN Money non vérifié)".to_string())).await?;
        Ok("wallet_internal".to_string())
    }
}
```

---

## 🟠 Implémentation Orange Money

### **Fichier : `backend/src/services/payment_matching_service.rs`**

#### **1. Fonction `transfer_orange_money()`**

Remplacez la fonction stub par cette implémentation :

```rust
/// ✅ Intègre API Orange Money pour transfert direct
async fn transfer_orange_money(
    &self,
    phone: &str,
    amount_cents: i64,
) -> AppResult<String> {
    let api_url = std::env::var("ORANGE_MONEY_API_URL")
        .map_err(|_| AppError::Internal("ORANGE_MONEY_API_URL non configurée".into()))?;
    
    let api_key = std::env::var("ORANGE_MONEY_API_KEY")
        .map_err(|_| AppError::Internal("ORANGE_MONEY_API_KEY non configurée".into()))?;
    
    let api_secret = std::env::var("ORANGE_MONEY_API_SECRET")
        .map_err(|_| AppError::Internal("ORANGE_MONEY_API_SECRET non configurée".into()))?;
    
    let client = reqwest::Client::new();
    
    // Convertir centimes en FCFA
    let amount_fcfa = amount_cents as f64 / 100.0;
    
    // Préparer le payload selon la documentation Orange Money API
    let payload = json!({
        "outboundTransferRequest": {
            "partnerName": "Yukpo",
            "amount": amount_fcfa,
            "currency": "XAF",
            "referenceNumber": format!("YUKPO_{}", uuid::Uuid::new_v4()),
            "receiverPhoneNumber": phone,
            "receiverName": "Prestataire Yukpo",
            "comment": format!("Reversement livraison - {} FCFA", amount_fcfa)
        }
    });
    
    // Appel API Orange Money
    let response = client
        .post(&format!("{}/orange-money-webpay/v1/transfer", api_url))
        .header("Authorization", format!("Bearer {}", self.get_orange_access_token().await?))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Erreur appel API Orange Money: {}", e)))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Erreur inconnue".to_string());
        log::error!("Erreur API Orange Money: {}", error_text);
        return Err(AppError::Internal(format!("Orange Money API error: {}", error_text)));
    }
    
    let result: Value = response.json().await
        .map_err(|e| AppError::Internal(format!("Erreur parsing réponse Orange Money: {}", e)))?;
    
    let transaction_id = result.get("transactionId")
        .or_else(|| result.get("transaction_id"))
        .or_else(|| result.get("referenceNumber"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("Orange Money API: transactionId manquant".into()))?;
    
    log::info!("✅ Transfert Orange Money réussi: transaction_id={}, phone={}, amount={} FCFA", 
        transaction_id, phone, amount_fcfa);
    
    Ok(transaction_id.to_string())
}

/// ✅ Récupère le token d'accès Orange Money (OAuth2)
async fn get_orange_access_token(&self) -> AppResult<String> {
    // TODO: Implémenter cache du token (éviter de le récupérer à chaque appel)
    
    let api_key = std::env::var("ORANGE_MONEY_API_KEY")?;
    let api_secret = std::env::var("ORANGE_MONEY_API_SECRET")?;
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.orange.com/oauth/v2/token")
        .header("Authorization", format!("Basic {}", base64::encode(format!("{}:{}", api_key, api_secret))))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body("grant_type=client_credentials")
        .send()
        .await?;
    
    let result: Value = response.json().await?;
    let access_token = result.get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("Orange Money: access_token manquant".into()))?;
    
    Ok(access_token.to_string())
}
```

#### **2. Modifier `execute_payout()` pour utiliser Orange Money**

Dans la fonction `execute_payout()`, remplacez le bloc `OrangeMoney` :

```rust
PayoutMethod::OrangeMoney { phone, verified } => {
    if verified {
        match self.transfer_orange_money(&phone, amount_cents).await {
            Ok(transaction_id) => {
                log::info!("✅ Transfert Orange Money réussi: transaction_id={}", transaction_id);
                Ok("orange_money".to_string())
            }
            Err(e) => {
                log::error!("❌ Erreur transfert Orange Money, fallback wallet: {:?}", e);
                // Fallback vers wallet interne en cas d'erreur
                self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, 
                    Some(format!("Reversement (Orange Money échoué: {})", e))).await?;
                Ok("wallet_internal".to_string())
            }
        }
    } else {
        // Numéro non vérifié → wallet interne
        self.credit_wallet_internal(merchant_user_id, amount_cents, delivery_id, 
            Some("Reversement (Orange Money non vérifié)".to_string())).await?;
        Ok("wallet_internal".to_string())
    }
}
```

---

## 📦 Dépendances à ajouter

### **Dans `backend/Cargo.toml`**

```toml
[dependencies]
# ... dépendances existantes ...
base64 = "0.21"  # Pour encodage Basic Auth
uuid = { version = "1.0", features = ["v4"] }  # Si pas déjà présent
```

---

## 🔒 Sécurité

### **1. Gestion des tokens d'accès**

Implémentez un cache pour les tokens d'accès (éviter de les récupérer à chaque appel) :

```rust
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, Instant};

struct TokenCache {
    token: Option<String>,
    expires_at: Option<Instant>,
}

impl PaymentMatchingService {
    async fn get_mtn_access_token_cached(&self) -> AppResult<String> {
        // TODO: Implémenter cache avec expiration
        // Vérifier si token existe et n'est pas expiré
        // Sinon, récupérer nouveau token
        self.get_mtn_access_token().await
    }
}
```

### **2. Validation des numéros de téléphone**

Avant d'effectuer un transfert, valider le format du numéro :

```rust
fn validate_phone_number(phone: &str) -> AppResult<()> {
    // Format attendu: +237699123456 (avec indicatif pays)
    if !phone.starts_with("+") {
        return Err(AppError::BadRequest("Numéro de téléphone doit commencer par +".into()));
    }
    
    if phone.len() < 10 || phone.len() > 15 {
        return Err(AppError::BadRequest("Format de numéro invalide".into()));
    }
    
    Ok(())
}
```

### **3. Rate Limiting**

Implémentez un rate limiting pour éviter les abus :

```rust
// Limiter à 10 transferts par minute par prestataire
// Utiliser Redis ou in-memory cache
```

---

## 🧪 Tests

### **1. Tests unitaires**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_determine_payout_method_mtn_match() {
        // Test matching MTN Money
    }
    
    #[tokio::test]
    async fn test_determine_payout_method_no_match() {
        // Test fallback wallet
    }
}
```

### **2. Tests d'intégration (Sandbox)**

1. Configurer `MTN_MONEY_ENVIRONMENT=sandbox`
2. Utiliser des numéros de test fournis par MTN/Orange
3. Vérifier que les transferts fonctionnent
4. Tester les cas d'erreur (solde insuffisant, numéro invalide, etc.)

---

## 📊 Monitoring

### **Métriques à suivre**

1. **Taux de succès des transferts** :
   - MTN Money : `mtn_money_transfer_success_rate`
   - Orange Money : `orange_money_transfer_success_rate`

2. **Temps de réponse** :
   - `mtn_money_transfer_duration_ms`
   - `orange_money_transfer_duration_ms`

3. **Taux de fallback** :
   - `payout_fallback_to_wallet_count`

### **Logs à surveiller**

- ✅ Transferts réussis
- ❌ Erreurs API
- ⚠️ Fallbacks vers wallet interne
- 🔒 Problèmes d'authentification

---

## 🚨 Gestion d'erreurs

### **Cas d'erreur à gérer**

1. **API indisponible** → Fallback wallet + Notification
2. **Solde insuffisant** → Fallback wallet + Notification
3. **Numéro invalide** → Fallback wallet + Notification
4. **Token expiré** → Récupérer nouveau token + Retry
5. **Rate limit** → Retry avec backoff exponentiel

### **Stratégie de retry**

```rust
async fn transfer_with_retry(
    &self,
    phone: &str,
    amount_cents: i64,
    max_retries: u32,
) -> AppResult<String> {
    for attempt in 0..max_retries {
        match self.transfer_mtn_money(phone, amount_cents).await {
            Ok(transaction_id) => return Ok(transaction_id),
            Err(e) => {
                if attempt < max_retries - 1 {
                    let delay = Duration::from_secs(2_u64.pow(attempt));
                    tokio::time::sleep(delay).await;
                    continue;
                }
                return Err(e);
            }
        }
    }
    Err(AppError::Internal("Max retries atteint".into()))
}
```

---

## 📝 Checklist d'intégration

- [ ] Variables d'environnement configurées
- [ ] Fonction `transfer_mtn_money()` implémentée
- [ ] Fonction `transfer_orange_money()` implémentée
- [ ] Fonctions `get_mtn_access_token()` et `get_orange_access_token()` implémentées
- [ ] Cache des tokens implémenté
- [ ] Validation des numéros de téléphone
- [ ] Gestion d'erreurs et fallback
- [ ] Tests unitaires
- [ ] Tests d'intégration (sandbox)
- [ ] Monitoring configuré
- [ ] Documentation API mise à jour
- [ ] Notification prestataire en cas de fallback

---

## 🔗 Ressources

- **MTN Money API** : https://momodeveloper.mtn.com/
- **Orange Money API** : https://developer.orange.com/
- **Documentation OAuth2** : https://oauth.net/2/

---

## 📞 Support

En cas de problème lors de l'intégration :
1. Vérifier les logs backend
2. Tester avec l'environnement sandbox
3. Contacter le support MTN/Orange si nécessaire
4. Consulter la documentation officielle des APIs

