# Configuration des Webhooks de Paiement

## Variables d'environnement requises

Ajoutez ces variables à votre fichier `.env` :

```bash
# Configuration des webhooks de paiement
ORANGE_MONEY_WEBHOOK_SECRET=your_orange_money_webhook_secret
MTN_MONEY_WEBHOOK_SECRET=your_mtn_money_webhook_secret
WEBHOOK_SECRET=your_generic_webhook_secret

# Configuration des providers de paiement
ORANGE_MONEY_API_URL=https://api.orange.com/orange-money-webpay/cm/v1
ORANGE_MONEY_MERCHANT_KEY=your_orange_money_merchant_key
ORANGE_MONEY_MERCHANT_ID=your_orange_money_merchant_id

MTN_MONEY_API_URL=https://sandbox.momodeveloper.mtn.com
MTN_MONEY_SUBSCRIPTION_KEY=your_mtn_money_subscription_key
MTN_MONEY_TARGET_ENVIRONMENT=sandbox

# Configuration des frais de paiement
PAYMENT_FEES_ORANGE_MONEY=0
PAYMENT_FEES_MTN_MONEY=0
PAYMENT_FEES_CREDIT_CARD=2.5
PAYMENT_FEES_BANK_TRANSFER=0

# Configuration des montants minimums et maximums
MIN_PAYMENT_AMOUNT_XAF=100
MAX_PAYMENT_AMOUNT_XAF=1000000
MIN_PAYMENT_AMOUNT_USD=1
MAX_PAYMENT_AMOUNT_USD=10000

# Configuration des bonus de recharge
BONUS_THRESHOLD_1_XAF=2000
BONUS_PERCENTAGE_1=5
BONUS_THRESHOLD_2_XAF=5000
BONUS_PERCENTAGE_2=10
BONUS_THRESHOLD_3_XAF=10000
BONUS_PERCENTAGE_3=20

# Configuration des timeouts
PAYMENT_TIMEOUT_SECONDS=300
WEBHOOK_TIMEOUT_SECONDS=30
```

## Endpoints des Webhooks

### 1. Orange Money Webhook
- **URL**: `POST /webhooks/orange-money`
- **Description**: Reçoit les notifications de paiement d'Orange Money
- **Authentification**: Signature HMAC-SHA256

### 2. MTN Money Webhook
- **URL**: `POST /webhooks/mtn-money`
- **Description**: Reçoit les notifications de paiement de MTN Money
- **Authentification**: Signature HMAC-SHA256

### 3. Webhook Générique
- **URL**: `POST /webhooks/generic`
- **Description**: Reçoit les notifications de paiement d'autres providers
- **Authentification**: Signature HMAC-SHA256 (optionnelle)

### 4. Test Webhook
- **URL**: `POST /webhooks/test`
- **Description**: Endpoint pour tester les webhooks
- **Authentification**: Aucune

### 5. Santé des Webhooks
- **URL**: `GET /webhooks/health`
- **Description**: Vérifie que les webhooks sont opérationnels
- **Authentification**: Aucune

## Validation des Numéros de Téléphone

### Endpoint de Validation
- **URL**: `POST /payments/validate-phone`
- **Description**: Valide un numéro de téléphone pour mobile money
- **Authentification**: JWT requis

### Pays Supportés
- **CM** (Cameroun): Orange Money, MTN Money
- **CI** (Côte d'Ivoire): Orange Money, MTN Money
- **BF** (Burkina Faso): Orange Money, MTN Money
- **ML** (Mali): Orange Money, MTN Money
- **NE** (Niger): Orange Money, MTN Money
- **SN** (Sénégal): Orange Money, MTN Money
- **TG** (Togo): Orange Money, MTN Money
- **MG** (Madagascar): Orange Money, MTN Money

## Format des Webhooks

### Orange Money Webhook
```json
{
  "transaction_id": "string",
  "amount": 1000,
  "currency": "XAF",
  "phone_number": "675123456",
  "status": "SUCCESS",
  "timestamp": "2024-01-01T00:00:00Z",
  "signature": "hmac_signature",
  "reference": "optional_reference"
}
```

### MTN Money Webhook
```json
{
  "transaction_id": "string",
  "amount": 1000,
  "currency": "XAF",
  "phone_number": "675123456",
  "status": "SUCCESS",
  "timestamp": "2024-01-01T00:00:00Z",
  "signature": "hmac_signature",
  "reference": "optional_reference"
}
```

### Webhook Générique
```json
{
  "transaction_id": "string",
  "amount": 1000,
  "currency": "XAF",
  "phone_number": "675123456",
  "status": "SUCCESS",
  "timestamp": "2024-01-01T00:00:00Z",
  "signature": "hmac_signature",
  "reference": "optional_reference",
  "payment_method": "orange_money"
}
```

## Statuts de Paiement

- **SUCCESS**: Paiement réussi
- **FAILED**: Paiement échoué
- **PENDING**: Paiement en cours
- **CANCELLED**: Paiement annulé
- **EXPIRED**: Paiement expiré

## Sécurité

1. **Signature HMAC**: Tous les webhooks sont signés avec HMAC-SHA256
2. **Validation des numéros**: Les numéros de téléphone sont validés avant traitement
3. **Rate Limiting**: Protection contre les attaques par déni de service
4. **Logs**: Tous les webhooks sont loggés pour audit

## Tests

### Test de Webhook
```bash
curl -X POST http://localhost:8080/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "test_txn_123",
    "status": "SUCCESS",
    "amount": 1000,
    "currency": "XAF",
    "phone_number": "675123456",
    "payment_method": "orange_money"
  }'
```

### Test de Validation de Numéro
```bash
curl -X POST http://localhost:8080/payments/validate-phone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "phone_number": "675123456",
    "country": "CM"
  }'
```

## Monitoring

- **Logs**: Tous les webhooks sont loggés avec le niveau `info`
- **Métriques**: Suivi des taux de succès/échec par provider
- **Alertes**: Notifications en cas d'échec de webhook
- **Santé**: Endpoint `/webhooks/health` pour monitoring

## Dépannage

### Problèmes Courants

1. **Signature invalide**: Vérifier la clé secrète du webhook
2. **Numéro invalide**: Vérifier le format du numéro de téléphone
3. **Paiement non trouvé**: Vérifier que la tentative de paiement existe
4. **Timeout**: Vérifier la configuration des timeouts

### Logs Utiles

```bash
# Voir les logs des webhooks
grep "webhook" /var/log/yukpomnang/app.log

# Voir les erreurs de validation
grep "validation" /var/log/yukpomnang/app.log

# Voir les paiements traités
grep "payment" /var/log/yukpomnang/app.log
```
