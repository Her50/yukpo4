# 🏦 ANALYSE APPROFONDIE DU SYSTÈME DE PAIEMENT INTERNE YUKPO
## Rapport d'analyse et architecture fintech proposée

**Date**: 15 mars 2026  
**Objectif**: Évaluer le système de paiement existant et proposer une architecture fintech hyper-sécurisée pour les recharges de tokens via Mobile Money et cartes bancaires.

---

## 📋 TABLE DES MATIÈRES

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Architecture actuelle du système de paiement](#2-architecture-actuelle)
3. [Analyse du système de tokens et solde utilisateur](#3-système-tokens)
4. [Analyse des intégrations de paiement](#4-intégrations-paiement)
5. [Audit de sécurité](#5-audit-sécurité)
6. [Analyse du support multilingue](#6-multilingue)
7. [Architecture fintech proposée](#7-architecture-proposée)
8. [Plan d'implémentation](#8-plan-implémentation)
9. [Estimations et priorités](#9-estimations)

---

## 1. RÉSUMÉ EXÉCUTIF

### État actuel
Le système de paiement Yukpo est **fonctionnellement structuré** mais **partiellement implémenté** :

| Composant | État | Criticité |
|-----------|------|-----------|
| Architecture backend (Rust/Axum) | ✅ Bien structurée | - |
| Gestion tokens/solde utilisateur | ✅ Fonctionnel | - |
| Mobile Money (MTN/Orange) — initiation | ⚠️ Simulé (TODO) | 🔴 Critique |
| Mobile Money — webhooks | ⚠️ Partiellement implémenté | 🔴 Critique |
| Cartes bancaires (Visa/Stripe) | ❌ Désactivé | 🔴 Critique |
| Vérification signature webhooks | ❌ Simulée (body hardcodé) | 🔴 Critique |
| PayPal | ✅ Intégré | - |
| Virement bancaire | ✅ Manuel | - |
| Notifications push post-paiement | ✅ Fonctionnel | - |
| i18n écrans paiement/recharge | ❌ Non traduit (hardcodé FR) | 🟡 Important |
| i18n système global (57 langues) | ✅ Excellent | - |

### Verdict
**OUI, il est tout à fait faisable de créer un système fintech hyper-sécurisé** en s'appuyant sur l'architecture existante. Les fondations sont solides (Rust, PostgreSQL, structure modulaire). Les lacunes sont principalement dans l'implémentation réelle des appels aux APIs de paiement et la sécurisation des webhooks.

---

## 2. ARCHITECTURE ACTUELLE DU SYSTÈME DE PAIEMENT

### 2.1 Vue d'ensemble backend (Rust/Axum)

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE (React Native)                   │
│  RechargeTokensScreen → POST /api/tokens/recharge           │
│  SoldeDetailScreen    → GET  /api/tokens/stats              │
│  TokensBalance        → JWT (tokens_balance dans le token)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    BACKEND (Rust / Axum)                      │
│                                                              │
│  Routes: payment_routes.rs                                   │
│    POST /api/payments/initiate                               │
│    POST /api/payments/confirm                                │
│    GET  /api/payments/history                                │
│    GET  /api/payments/methods                                │
│    POST /api/webhooks/orange-money                           │
│    POST /api/webhooks/mtn-money                              │
│    POST /api/webhooks/generic                                │
│    GET  /api/tokens/stats                                    │
│    GET  /api/token-packs                                     │
│                                                              │
│  Contrôleurs:                                                │
│    payment_controller.rs  → Initiation & confirmation        │
│    webhook_controller.rs  → Réception webhooks MM            │
│    token_pack_controller.rs → Gestion packs de tokens        │
│                                                              │
│  Services:                                                   │
│    payment_service.rs            → Logique métier paiement   │
│    mobile_money_service.rs       → Intégration MTN/Orange    │
│    specialized_payment_service.rs→ Paiements réservations    │
│                                                              │
│  Middlewares:                                                 │
│    check_tokens.rs → Déduction tokens IA + mise à jour JWT  │
│                                                              │
│  Tables DB:                                                  │
│    users (tokens_balance)                                    │
│    payment_transactions                                      │
│    payment_attempts                                          │
│    token_usage_logs                                          │
│    token_packs                                               │
│    token_transactions                                        │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Fichiers clés analysés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `backend/src/services/payment_service.rs` | Logique métier paiement, calcul bonus, crédit tokens | ~500 |
| `backend/src/controllers/payment_controller.rs` | API initiation/confirmation paiement | ~400 |
| `backend/src/services/mobile_money_service.rs` | Intégration MTN/Orange Money | ~461 |
| `backend/src/controllers/webhook_controller.rs` | Réception et traitement webhooks | 496 |
| `backend/src/middlewares/check_tokens.rs` | Déduction tokens pour services IA | 534 |
| `backend/src/routes/token_stats_routes.rs` | Stats consommation tokens | 324 |
| `backend/src/services/specialized_payment_service.rs` | Paiements réservations spécialisées | 129 |
| `backend/src/controllers/token_pack_controller.rs` | CRUD packs de tokens | 90 |
| `mobile/src/screens/RechargeTokensScreen.tsx` | Écran recharge mobile | ~777 |
| `mobile/src/screens/SoldeDetailScreen.tsx` | Historique solde/paiements | ~704 |
| `mobile/src/components/TokensBalance.tsx` | Affichage solde | ~140 |

---

## 3. SYSTÈME DE TOKENS ET SOLDE UTILISATEUR

### 3.1 Modèle économique

```
1 XAF = 1 Token (parité fixe)
```

**Bonus de recharge** (calculés dans `payment_service.rs` ET `RechargeTokensScreen.tsx`) :
| Montant recharge | Bonus |
|-----------------|-------|
| ≥ 2 000 XAF | +5% |
| ≥ 5 000 XAF | +10% |
| ≥ 10 000 XAF | +20% |

**Montant minimum** : 100 XAF (100 tokens)

### 3.2 Flux de crédit de tokens

```
Utilisateur recharge → POST /api/tokens/recharge
    → payment_controller.rs::initiate_payment()
        → payment_service.rs::process_payment()
            → Selon méthode:
                → mobile_money_service.rs (MTN/Orange) [SIMULÉ]
                → process_visa_payment() [DÉSACTIVÉ]
                → PayPal [FONCTIONNEL]
                → Virement [MANUEL]
            → add_tokens_to_user()
                → Calcul bonus
                → UPDATE users SET tokens_balance = tokens_balance + montant + bonus
                → INSERT INTO token_transactions (...)
                → INSERT INTO payment_transactions (...)
```

### 3.3 Flux de débit de tokens (services IA)

```
Requête IA → check_tokens.rs (middleware)
    → Extraction intention depuis headers/body
    → calculer_cout_xaf(intention, tokens_ia_consommés)
    → convertir_cout_xaf_en_tokens(cout_xaf) [1:1]
    → Vérification solde: SELECT tokens_balance FROM users
    → Si suffisant:
        → Exécution requête IA
        → UPDATE users SET tokens_balance = tokens_balance - cout
        → INSERT INTO token_usage_logs (...)
        → Mise à jour JWT avec nouveau solde
    → Si insuffisant:
        → Recherche autorisée mais sans débit
```

### 3.4 Stockage du solde

- **Base de données** : `users.tokens_balance` (type `i64`)
- **Client mobile** : Solde dans le JWT (`tokens_balance`), décodé par `useAuth()`
- **Rafraîchissement** : Le JWT est mis à jour après chaque transaction IA. Pour le mobile, `SoldeDetailScreen` appelle `refreshUser()`, mais `TokensBalance.tsx` a un **TODO non implémenté** pour le rafraîchissement API.

### 3.5 ⚠️ Problèmes identifiés

1. **Duplication du calcul de bonus** : Le calcul existe côté client (`RechargeTokensScreen.tsx`) ET côté serveur (`payment_service.rs`). Risque de désynchronisation.
2. **TokensBalance.tsx** : `refreshTokensBalance()` est un placeholder vide — le solde affiché ne se rafraîchit pas en temps réel.
3. **Deux flux d'initiation** : `payment_controller::initiate_payment` et `payment_service::process_payment` semblent coexister — besoin de clarifier le flux actif.

---

## 4. ANALYSE DES INTÉGRATIONS DE PAIEMENT

### 4.1 Mobile Money (MTN & Orange) — `mobile_money_service.rs`

**État : ⚠️ SIMULÉ**

Configuration lue depuis les variables d'environnement :
```
MTN_MOMO_API_KEY, MTN_MOMO_API_SECRET, MTN_MOMO_SUBSCRIPTION_KEY,
MTN_MOMO_MERCHANT_ID, MTN_MOMO_ENVIRONMENT (sandbox/production)

ORANGE_MONEY_API_KEY, ORANGE_MONEY_API_SECRET,
ORANGE_MONEY_MERCHANT_ID, ORANGE_MONEY_ENVIRONMENT
```

**Ce qui est implémenté :**
- ✅ Structures de données (requêtes, réponses, webhooks)
- ✅ Construction des payloads JSON pour MTN et Orange
- ✅ Logique de fallback avec instructions USSD manuelles
- ✅ Vérification disponibilité provider (`is_provider_available`)

**Ce qui est SIMULÉ (TODO) :**
- ❌ Appels HTTP réels vers les APIs MTN MoMo et Orange Money
- ❌ Gestion des réponses asynchrones
- ❌ Vérification du statut de paiement (`check_payment_status`)
- ❌ Traitement réel des webhooks (`process_webhook` retourne `Ok(true)` systématiquement)

**Instructions USSD de fallback** (en cas d'échec API) :
- MTN : `*126*1*MONTANT#`
- Orange : `#150*1*MONTANT#`

### 4.2 Webhooks — `webhook_controller.rs`

**État : ⚠️ PARTIELLEMENT IMPLÉMENTÉ**

**Ce qui fonctionne :**
- ✅ Endpoints dédiés : `POST /webhooks/orange-money`, `POST /webhooks/mtn-money`, `POST /webhooks/generic`
- ✅ Validation du numéro de téléphone (`PhoneValidationService`)
- ✅ Mapping des statuts provider → statuts internes (SUCCESS → success, FAILED → failed, etc.)
- ✅ Mise à jour `payment_attempts` en base
- ✅ Crédit automatique des tokens via `PaymentService::add_tokens_to_user()` si statut success
- ✅ Envoi notification push après paiement réussi
- ✅ Protection contre le double-traitement (vérification `status != "pending"`)

**Ce qui est CRITIQUE (non implémenté) :**
- ❌ **Vérification signature HMAC** : `verify_webhook_signature()` utilise `body = "webhook_body"` (hardcodé) au lieu du body réel de la requête. Cela signifie que **n'importe qui peut forger un webhook et créditer des tokens frauduleusement**.
- ❌ Pas de validation du montant du webhook vs le montant de la tentative de paiement originale
- ❌ Pas de rate limiting sur les endpoints webhook
- ❌ Pas d'IP whitelisting pour les providers Mobile Money

### 4.3 Cartes bancaires (Visa/Mastercard) — `payment_service.rs`

**État : ❌ DÉSACTIVÉ**

```rust
/// Traiter un paiement Visa/Mastercard via Stripe (temporairement désactivé)
// TODO: Réactiver l'intégration Stripe une fois les dépendances corrigées
// Pour l'instant, on simule un paiement réussi
```

Le code simule un paiement réussi avec une réponse JSON fictive. Aucune dépendance Stripe n'est présente dans `Cargo.toml`.

### 4.4 PayPal — `payment_service.rs`

**État : ✅ INTÉGRÉ** (fonctionnel via configuration environnement)

### 4.5 Token Packs — `token_pack_controller.rs`

**État : ✅ FONCTIONNEL**

Table `token_packs` avec `id`, `name`, `tokens`, `price` (centimes).
- `GET /token-packs` : Liste les packs disponibles
- `POST /token-packs` : Création (admin)

---

## 5. AUDIT DE SÉCURITÉ

### 🔴 Vulnérabilités CRITIQUES

| # | Vulnérabilité | Fichier | Impact |
|---|---------------|---------|--------|
| 1 | **Webhook signature non vérifiée** | `webhook_controller.rs:429` | Un attaquant peut forger des webhooks et créditer des tokens illimités |
| 2 | **APIs Mobile Money simulées** | `mobile_money_service.rs` | Pas de paiement réel, aucune validation côté provider |
| 3 | **Paiement Visa simulé** | `payment_service.rs:388-399` | Retourne toujours `Completed` sans vérification |
| 4 | **Pas de validation montant webhook** | `webhook_controller.rs:286-408` | Le webhook pourrait indiquer un montant différent de l'original |
| 5 | **Endpoint test_webhook en production** | `webhook_controller.rs:450-495` | Permet de créditer des tokens via un simple POST |
| 6 | **Secrets dans variables d'environnement** | `mobile_money_service.rs` | Acceptable mais pas idéal — préférer un vault |

### 🟡 Vulnérabilités MOYENNES

| # | Vulnérabilité | Fichier | Impact |
|---|---------------|---------|--------|
| 7 | **Pas de rate limiting** sur les endpoints paiement | Routes | Attaques par force brute possibles |
| 8 | **Pas d'idempotency key** | `payment_controller.rs` | Double-paiement possible en cas de retry |
| 9 | **Bonus calculé côté client** | `RechargeTokensScreen.tsx` | Affichage potentiellement trompeur si désynchronisé |
| 10 | **TokensBalance ne rafraîchit pas** | `TokensBalance.tsx:28` | Solde obsolète affiché |

### ✅ Points de sécurité POSITIFS

- Architecture Rust (memory safety, pas de vulnérabilités buffer overflow)
- JWT pour l'authentification avec mise à jour du solde
- Validation du numéro de téléphone dans les webhooks
- Protection contre le double-traitement des webhooks
- Séparation des responsabilités (controller/service/middleware)
- HMAC-SHA256 prévu (structure en place, juste le body à corriger)

---

## 6. ANALYSE DU SUPPORT MULTILINGUE

### 6.1 Système i18n existant — EXCELLENT

L'application dispose d'un système i18n **mature et robuste** :

- **Bibliothèque** : `i18next` + `react-i18next` (standard industriel)
- **57 langues supportées** incluant :
  - 10 langues internationales (fr, en, de, es, pt, zh, ja, hi, ar, ru)
  - 27+ langues africaines (sw, ha, yo, am, wo, zu, ig, ln, ff, rw, ewo, dua, bbj, bas, bum, etc.)
  - 2 langues caraïbéennes (ht, pap)
  - 10 langues asiatiques/européennes supplémentaires (ko, tr, id, vi, th, bn, tl, ms, uk, pl, it, nl)
- **Infrastructure** : `LanguageContext.tsx` + `useLanguage()` + `useLanguageSafe()` + `useTranslation()`
- **Persistance** : Langue sauvegardée via `SafeStorage`
- **Détection automatique** : Via `expo-localization`

### 6.2 ❌ Écrans paiement NON TRADUITS

**Problème majeur** : Les écrans liés aux paiements et tokens n'utilisent PAS le système i18n :

| Écran | i18n utilisé ? | Textes hardcodés FR |
|-------|----------------|---------------------|
| `RechargeTokensScreen.tsx` | ❌ NON | ~30+ chaînes hardcodées |
| `SoldeDetailScreen.tsx` | ❌ NON | ~20+ chaînes hardcodées |
| `TokensBalance.tsx` | ❌ NON | ~5 chaînes hardcodées |

**Exemples de textes non traduits :**
```javascript
Alert.alert('Erreur', 'Veuillez sélectionner un montant');
Alert.alert('Erreur', 'Veuillez sélectionner une méthode de paiement');
Alert.alert('✅ Recharge réussie', `Votre compte a été crédité de ...`);
"Entrez le montant en XAF"
"FCFA seront crédités à votre solde"
```

### 6.3 Clés i18n existantes pour le paiement

Il existe déjà un namespace `payment` dans `fr.json` et `en.json` :
```json
"payment": {
    "title": "Paiement",
    "method": "Méthode de paiement",
    "mobile_money": "Mobile Money",
    "orange_money": "Orange Money",
    "visa": "Carte Visa",
    "phone": "Numéro de téléphone",
    "card_number": "Numéro de carte",
    "expiry": "Date d'expiration"
}
```

Et un namespace `tokens` :
```json
"tokens": {
    "recharge": "Recharger Tokens",
    "history": "Historique de Consommation"
}
```

**→ Ces namespaces existent mais sont insuffisants et les écrans ne les utilisent pas.**

### 6.4 Backend — Messages non traduits

Les messages d'erreur et de succès du backend sont tous en français hardcodé :
```rust
"Recharge réussie"
"Solde insuffisant"
"Numéro de téléphone invalide"
"Tentative de paiement non trouvée"
```

**Recommandation** : Le backend devrait retourner des codes d'erreur (`INSUFFICIENT_BALANCE`, `INVALID_PHONE`, etc.) que le mobile traduit, plutôt que des messages en français.

---

## 7. ARCHITECTURE FINTECH PROPOSÉE

### 7.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (React Native)                     │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Recharge     │  │ Solde &      │  │ Paiements services       │  │
│  │ Tokens       │  │ Historique   │  │ (réservations, etc.)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                  │                      │                   │
│         │    ┌─────────────▼────────────────┐    │                   │
│         │    │  SDK Paiement Yukpo (nouveau) │    │                   │
│         │    │  - Sélection méthode          │    │                   │
│         │    │  - UI unifiée & traduite      │    │                   │
│         │    │  - Gestion erreurs i18n       │    │                   │
│         │    └─────────────┬────────────────┘    │                   │
│         └──────────────────┼─────────────────────┘                   │
└────────────────────────────┼─────────────────────────────────────────┘
                             │ HTTPS (TLS 1.3)
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                    PAYMENT GATEWAY SERVICE (Rust)                      │
│                    (Nouveau microservice dédié)                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    API Gateway Layer                              │ │
│  │  - Rate limiting (par IP + par user)                             │ │
│  │  - Idempotency keys                                              │ │
│  │  - Request validation & sanitization                             │ │
│  │  - JWT authentication                                            │ │
│  └───────────────────────────┬─────────────────────────────────────┘ │
│                               │                                       │
│  ┌───────────────────────────▼─────────────────────────────────────┐ │
│  │                 Payment Orchestrator                              │ │
│  │  - Routing vers le bon provider                                  │ │
│  │  - Gestion état machine (FSM) des transactions                   │ │
│  │  - Retry logic avec backoff exponentiel                          │ │
│  │  - Timeout management                                            │ │
│  └───┬──────────┬──────────┬──────────┬────────────────────────────┘ │
│      │          │          │          │                               │
│  ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐                          │
│  │  MTN  │ │Orange │ │Stripe │ │PayPal │                          │
│  │ MoMo  │ │Money  │ │(Visa/ │ │       │                          │
│  │Adapter│ │Adapter│ │Master)│ │Adapter│                          │
│  └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘                          │
│      │         │         │         │                                │
│  ┌───▼─────────▼─────────▼─────────▼──────────────────────────────┐ │
│  │              Webhook Handler (sécurisé)                          │ │
│  │  - Vérification HMAC sur body RÉEL                              │ │
│  │  - IP whitelisting par provider                                  │ │
│  │  - Validation montant vs transaction originale                   │ │
│  │  - Idempotency (protection double-crédit)                       │ │
│  └───────────────────────────┬─────────────────────────────────────┘ │
│                               │                                       │
│  ┌───────────────────────────▼─────────────────────────────────────┐ │
│  │              Token Ledger (Grand livre des tokens)                │ │
│  │  - Double-entry bookkeeping                                      │ │
│  │  - Transactions atomiques (PostgreSQL)                           │ │
│  │  - Audit trail complet                                           │ │
│  │  - Réconciliation automatique                                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              Notification Service                                 │ │
│  │  - Push notifications (existant)                                  │ │
│  │  - SMS confirmation (nouveau)                                     │ │
│  │  - Email receipt (nouveau)                                        │ │
│  │  - Messages traduits via codes i18n                               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### 7.2 Machine à états des transactions (FSM)

```
    ┌──────────┐
    │ CREATED  │ ← Initiation du paiement
    └────┬─────┘
         │
    ┌────▼─────┐
    │ PENDING  │ ← En attente de confirmation provider
    └────┬─────┘
         │
    ┌────▼─────────────┐
    │ PROCESSING       │ ← Provider traite le paiement
    └────┬──────┬──────┘
         │      │
    ┌────▼──┐ ┌▼───────┐
    │SUCCESS│ │ FAILED  │
    └────┬──┘ └────────┘
         │
    ┌────▼─────┐
    │COMPLETED │ ← Tokens crédités, notification envoyée
    └──────────┘
```

### 7.3 Sécurisation des webhooks — Implémentation proposée

```rust
// AVANT (vulnérable) :
fn verify_webhook_signature(_headers: &HeaderMap, signature: &str, provider: &str) -> bool {
    let body = "webhook_body"; // ❌ HARDCODÉ
    // ...
}

// APRÈS (sécurisé) :
async fn verify_webhook_signature(
    headers: &HeaderMap,
    raw_body: &[u8],        // ✅ Body RÉEL de la requête
    provider: &str
) -> bool {
    let secret_key = get_provider_secret(provider);
    if secret_key.is_empty() { return false; }

    // 1. Vérifier IP source (whitelist par provider)
    // 2. Vérifier timestamp (reject si > 5 min)
    // 3. Calculer HMAC-SHA256 sur le body réel
    let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes()).unwrap();
    mac.update(raw_body);
    let expected = hex::encode(mac.finalize().into_bytes());

    // 4. Comparaison constant-time (anti timing attack)
    constant_time_eq(signature.as_bytes(), expected.as_bytes())
}
```

### 7.4 Intégration MTN MoMo API — Implémentation proposée

```rust
/// Appel réel à l'API MTN MoMo Collections
async fn initiate_mtn_payment_real(
    &self,
    request: MobileMoneyPaymentRequest,
) -> AppResult<MobileMoneyPaymentResponse> {
    let config = &self.config;

    // 1. Obtenir un token d'accès OAuth2
    let token = self.get_mtn_access_token().await?;

    // 2. Générer un UUID unique pour la transaction (X-Reference-Id)
    let reference_id = uuid::Uuid::new_v4().to_string();

    // 3. Appel POST /collection/v1_0/requesttopay
    let response = self.client
        .post(&format!("{}/collection/v1_0/requesttopay", config.mtn_base_url))
        .header("Authorization", format!("Bearer {}", token))
        .header("X-Reference-Id", &reference_id)
        .header("X-Target-Environment", &config.mtn_environment)
        .header("Ocp-Apim-Subscription-Key", &config.mtn_subscription_key)
        .json(&serde_json::json!({
            "amount": request.amount.to_string(),
            "currency": "XAF",
            "externalId": request.transaction_id,
            "payer": {
                "partyIdType": "MSISDN",
                "partyId": request.phone_number
            },
            "payerMessage": "Recharge tokens Yukpo",
            "payeeNote": format!("Recharge {} XAF", request.amount)
        }))
        .timeout(Duration::from_secs(30))
        .send()
        .await?;

    // 4. MTN retourne 202 Accepted (async)
    match response.status() {
        StatusCode::ACCEPTED => {
            Ok(MobileMoneyPaymentResponse {
                success: true,
                transaction_id: reference_id,
                status: PaymentStatus::Pending,
                message: "Paiement initié. Confirmez sur votre téléphone.".into(),
                provider_reference: Some(reference_id),
            })
        }
        _ => {
            let error_body = response.text().await.unwrap_or_default();
            Err(AppError::PaymentFailed(format!("MTN MoMo error: {}", error_body)))
        }
    }
}
```

### 7.5 Intégration Stripe (Cartes bancaires) — Implémentation proposée

```rust
/// Créer un PaymentIntent Stripe pour carte bancaire
async fn create_stripe_payment_intent(
    &self,
    user_id: i32,
    amount_xaf: i64,
) -> AppResult<StripePaymentResponse> {
    let stripe_secret = std::env::var("STRIPE_SECRET_KEY")
        .map_err(|_| AppError::Config("STRIPE_SECRET_KEY non configuré".into()))?;

    // Stripe gère les montants en centimes — pour XAF, 1 unité = 1 XAF
    let response = self.client
        .post("https://api.stripe.com/v1/payment_intents")
        .header("Authorization", format!("Bearer {}", stripe_secret))
        .form(&[
            ("amount", amount_xaf.to_string()),
            ("currency", "xaf".to_string()),
            ("payment_method_types[]", "card".to_string()),
            ("metadata[user_id]", user_id.to_string()),
            ("metadata[platform]", "yukpo".to_string()),
        ])
        .send()
        .await?;

    let intent: StripePaymentIntent = response.json().await?;

    Ok(StripePaymentResponse {
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
    })
}
```

### 7.6 Double-Entry Token Ledger

Pour garantir l'intégrité comptable, chaque mouvement de tokens doit être enregistré en double entrée :

```sql
-- Nouvelle table : token_ledger
CREATE TABLE token_ledger (
    id BIGSERIAL PRIMARY KEY,
    transaction_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id),
    entry_type VARCHAR(20) NOT NULL, -- 'credit' ou 'debit'
    amount BIGINT NOT NULL CHECK (amount > 0),
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'recharge_mtn', 'recharge_orange', 'recharge_stripe', 'ai_usage', 'bonus', 'refund'
    reference_id VARCHAR(255), -- ID transaction externe (MTN, Stripe, etc.)
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contrainte d'intégrité
    CONSTRAINT valid_balance CHECK (balance_after >= 0),
    CONSTRAINT valid_entry CHECK (
        (entry_type = 'credit' AND balance_after = balance_before + amount) OR
        (entry_type = 'debit' AND balance_after = balance_before - amount)
    )
);

CREATE INDEX idx_token_ledger_user_id ON token_ledger(user_id);
CREATE INDEX idx_token_ledger_created_at ON token_ledger(created_at);
CREATE INDEX idx_token_ledger_source ON token_ledger(source);
CREATE INDEX idx_token_ledger_reference ON token_ledger(reference_id);
```

### 7.7 Internationalisation des écrans paiement

**Nouvelles clés i18n à ajouter** dans tous les fichiers de langues :

```json
{
    "rechargeScreen": {
        "title": "Recharger mes tokens",
        "selectAmount": "Sélectionnez un montant",
        "customAmount": "Montant personnalisé",
        "enterAmount": "Entrez le montant en XAF",
        "willBeCredited": "{{amount}} FCFA seront crédités à votre solde",
        "popular": "Populaire",
        "bonus": "+{{percent}}% bonus",
        "selectPayment": "Méthode de paiement",
        "phoneNumber": "Numéro de téléphone",
        "phonePlaceholder": "Ex: 6XX XXX XXX",
        "confirm": "Confirmer la recharge",
        "processing": "Traitement en cours...",
        "success": "Recharge réussie !",
        "successMessage": "Votre compte a été crédité de {{total}} tokens ({{amount}} XAF + {{bonus}} bonus)",
        "failedTitle": "Échec du paiement",
        "failedMessage": "Le paiement a échoué. Veuillez réessayer.",
        "receipt": "Reçu de recharge",
        "amount": "Montant",
        "credited": "Montant crédité",
        "method": "Méthode",
        "date": "Date",
        "transactionId": "N° transaction",
        "minimumAmount": "Montant minimum : {{min}} XAF",
        "summary": "Récapitulatif",
        "errorSelectAmount": "Veuillez sélectionner un montant",
        "errorSelectMethod": "Veuillez sélectionner une méthode de paiement"
    },
    "soldeScreen": {
        "title": "Mon solde",
        "currentBalance": "Solde actuel",
        "consumption": "Consommation",
        "payments": "Paiements",
        "period7d": "7 jours",
        "period30d": "30 jours",
        "period90d": "90 jours",
        "periodAll": "Tout",
        "totalConsumed": "Total consommé",
        "totalPaid": "Total payé",
        "tokensAdded": "Tokens ajoutés",
        "noHistory": "Aucun historique disponible",
        "rechargeNow": "Recharger maintenant"
    }
}
```

**Le backend doit retourner des codes d'erreur** au lieu de messages en français :

```json
{
    "success": false,
    "error_code": "INSUFFICIENT_BALANCE",
    "error_params": { "required": 500, "available": 120 }
}
```

Le mobile traduit ensuite : `t('errors.INSUFFICIENT_BALANCE', error_params)`

---

## 8. PLAN D'IMPLÉMENTATION

### Phase 1 : Sécurisation immédiate (1-2 semaines) — PRIORITÉ CRITIQUE

| # | Tâche | Fichier | Effort |
|---|-------|---------|--------|
| 1.1 | Corriger `verify_webhook_signature` pour utiliser le body réel | `webhook_controller.rs` | 2h |
| 1.2 | Ajouter validation montant webhook vs montant original | `webhook_controller.rs` | 1h |
| 1.3 | Supprimer/protéger `test_webhook` endpoint en production | `webhook_controller.rs` | 30min |
| 1.4 | Ajouter rate limiting sur les endpoints paiement | Routes | 4h |
| 1.5 | Ajouter idempotency keys aux transactions | `payment_controller.rs` | 4h |
| 1.6 | Supprimer le calcul bonus côté client (garder uniquement serveur) | `RechargeTokensScreen.tsx` | 1h |
| 1.7 | Implémenter `refreshTokensBalance` avec appel API réel | `TokensBalance.tsx` | 2h |

### Phase 2 : Implémentation Mobile Money réel (2-3 semaines)

| # | Tâche | Effort |
|---|-------|--------|
| 2.1 | Inscription API MTN MoMo (sandbox puis production) | 3j |
| 2.2 | Implémenter `initiate_mtn_payment` avec appel API réel | 2j |
| 2.3 | Implémenter polling du statut MTN (`GET /requesttopay/{ref}`) | 1j |
| 2.4 | Inscription API Orange Money | 3j |
| 2.5 | Implémenter `initiate_orange_payment` avec appel API réel | 2j |
| 2.6 | Tests end-to-end en sandbox MTN et Orange | 2j |
| 2.7 | Passage en production avec monitoring | 1j |

### Phase 3 : Intégration cartes bancaires (2 semaines)

| # | Tâche | Effort |
|---|-------|--------|
| 3.1 | Créer compte Stripe et configurer pour XAF | 1j |
| 3.2 | Ajouter dépendance Stripe SDK au backend | 1h |
| 3.3 | Implémenter `create_stripe_payment_intent` | 1j |
| 3.4 | Intégrer Stripe Elements côté mobile (via WebView ou SDK natif) | 3j |
| 3.5 | Implémenter webhook Stripe pour confirmation | 1j |
| 3.6 | Tests end-to-end Stripe | 2j |

### Phase 4 : Token Ledger & Audit (1 semaine)

| # | Tâche | Effort |
|---|-------|--------|
| 4.1 | Créer table `token_ledger` (migration SQL) | 2h |
| 4.2 | Modifier `add_tokens_to_user` pour écrire dans le ledger | 4h |
| 4.3 | Modifier `check_tokens.rs` pour écrire dans le ledger | 4h |
| 4.4 | Créer endpoint API de réconciliation | 1j |
| 4.5 | Dashboard admin pour suivi des transactions | 2j |

### Phase 5 : Internationalisation complète (1-2 semaines)

| # | Tâche | Effort |
|---|-------|--------|
| 5.1 | Ajouter toutes les clés i18n paiement/recharge dans `fr.json` | 2h |
| 5.2 | Traduire dans les 56 autres fichiers de langues | 2j (avec IA) |
| 5.3 | Migrer `RechargeTokensScreen.tsx` vers i18n (`t()`) | 4h |
| 5.4 | Migrer `SoldeDetailScreen.tsx` vers i18n (`t()`) | 4h |
| 5.5 | Migrer `TokensBalance.tsx` vers i18n (`t()`) | 1h |
| 5.6 | Backend : retourner des codes d'erreur au lieu de messages FR | 1j |
| 5.7 | Tests multilingues (vérifier les écrans en 5 langues minimum) | 1j |

### Phase 6 : Monitoring & Alertes (1 semaine)

| # | Tâche | Effort |
|---|-------|--------|
| 6.1 | Métriques Prometheus pour les transactions | 1j |
| 6.2 | Alertes sur les anomalies (pics de recharge, échecs répétés) | 1j |
| 6.3 | Dashboard Grafana pour le suivi temps réel | 1j |
| 6.4 | Logs structurés pour audit trail | 4h |

---

## 9. ESTIMATIONS ET PRIORITÉS

### Timeline globale

```
Semaine 1-2  : Phase 1 (Sécurisation) ← URGENT
Semaine 3-5  : Phase 2 (Mobile Money réel)
Semaine 5-7  : Phase 3 (Cartes bancaires Stripe)
Semaine 7-8  : Phase 4 (Token Ledger)
Semaine 8-10 : Phase 5 (i18n complet)
Semaine 10-11: Phase 6 (Monitoring)
```

**Durée totale estimée : 10-11 semaines** pour un système fintech complet et hyper-sécurisé.

### Dépendances externes requises

| Service | Coût estimé | Délai inscription |
|---------|-------------|-------------------|
| MTN MoMo API (production) | Commission ~1-2% par transaction | 2-4 semaines |
| Orange Money API (production) | Commission ~1-2% par transaction | 2-4 semaines |
| Stripe (Visa/Mastercard) | 2.9% + 30¢ par transaction | 1-3 jours |
| SMS Gateway (confirmation) | ~5-15 XAF/SMS | 1-2 jours |

### Variables d'environnement à configurer

```bash
# MTN MoMo
MTN_MOMO_API_KEY=
MTN_MOMO_API_SECRET=
MTN_MOMO_SUBSCRIPTION_KEY=
MTN_MOMO_MERCHANT_ID=
MTN_MOMO_ENVIRONMENT=production
MTN_MOMO_CALLBACK_URL=https://api.yukpo.com/webhooks/mtn-money

# Orange Money
ORANGE_MONEY_API_KEY=
ORANGE_MONEY_API_SECRET=
ORANGE_MONEY_MERCHANT_ID=
ORANGE_MONEY_ENVIRONMENT=production
ORANGE_MONEY_CALLBACK_URL=https://api.yukpo.com/webhooks/orange-money

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sécurité Webhooks
ORANGE_MONEY_WEBHOOK_SECRET=
MTN_MONEY_WEBHOOK_SECRET=
WEBHOOK_SECRET=

# Notifications
SMS_GATEWAY_API_KEY=
SMS_GATEWAY_SENDER=YUKPO
```

---

## CONCLUSION

Le système de paiement Yukpo a des **fondations architecturales solides** (Rust, PostgreSQL, structure modulaire, JWT). Les principaux travaux pour atteindre un niveau "fintech hyper-sécurisé" sont :

1. **🔴 URGENT** : Corriger la vérification des signatures webhook (faille critique actuelle)
2. **🔴 CRITIQUE** : Implémenter les appels réels aux APIs MTN MoMo et Orange Money
3. **🟡 IMPORTANT** : Réactiver et sécuriser les paiements par carte via Stripe
4. **🟡 IMPORTANT** : Internationaliser les écrans paiement (57 langues déjà supportées mais non utilisées)
5. **🟢 RECOMMANDÉ** : Token Ledger en double entrée pour audit et réconciliation

**Le système proposé est entièrement faisable** en s'appuyant sur l'existant. L'architecture Rust offre des garanties de performance et de sécurité mémoire idéales pour un service financier.
