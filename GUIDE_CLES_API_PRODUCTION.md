# Guide Complet des Clés API — Yukpo Production

> Ce document liste **toutes les clés API** nécessaires pour le déploiement en production de Yukpo.
> Chaque section indique : la variable d'environnement, où l'obtenir, et les pays couverts.

---

## 1. PAIEMENT — Agrégateurs (PRIORITÉ MAXIMALE)

### 1.1 CinetPay (Agrégateur Primaire)

**Couverture** : 🇨🇲 🇸🇳 🇨🇮 🇲🇱 🇧🇫 🇹🇬 🇧🇯 🇬🇳 🇬🇦 🇨🇬 🇹🇩 🇨🇫 🇨🇩 🇳🇪 🇲🇬 — **15+ pays africains**
**Opérateurs supportés** : MTN MoMo, Orange Money, Moov Money, Wave, Free Money, Visa, Mastercard
**Site** : https://cinetpay.com

```env
CINETPAY_API_KEY=xxxxxxxxxxxxxxxxxx
CINETPAY_SITE_ID=xxxxxx
CINETPAY_SECRET_KEY=xxxxxxxxxxxxxxxxxx        # Pour vérification des webhooks
CINETPAY_BASE_URL=https://api-checkout.cinetpay.com   # (défaut, ne pas changer)
```

**Comment obtenir** :
1. Créer un compte sur https://app.cinetpay.com/register
2. Compléter la vérification KYB (documents entreprise)
3. Dashboard → Intégration → Récupérer `API Key`, `Site ID`, `Secret Key`
4. Configurer l'URL webhook : `https://api.yukpo.com/api/webhooks/cinetpay`

**Pays et opérateurs CinetPay** :
| Pays | Opérateurs Mobile Money |
|------|------------------------|
| 🇨🇲 Cameroun | MTN MoMo, Orange Money |
| 🇸🇳 Sénégal | Orange Money, Wave, Free Money |
| 🇨🇮 Côte d'Ivoire | MTN, Orange, Moov, Wave |
| 🇲🇱 Mali | Orange Money, Moov |
| 🇧🇫 Burkina Faso | Orange Money, Moov |
| 🇹🇬 Togo | Moov (T-Money) |
| 🇧🇯 Bénin | MTN MoMo, Moov |
| 🇬🇳 Guinée | Orange Money, MTN |
| 🇳🇪 Niger | Orange Money, Moov |
| 🇬🇦 Gabon | Airtel Money |
| 🇨🇬 Congo-Brazzaville | MTN, Airtel |
| 🇹🇩 Tchad | Airtel Money |
| 🇨🇫 RCA | Orange Money |
| 🇨🇩 RD Congo | Vodacom M-Pesa, Airtel, Orange |
| 🇲🇬 Madagascar | MVola, Orange Money |

---

### 1.2 NotchPay (Agrégateur Fallback)

**Couverture** : 🇨🇲 🇸🇳 🇨🇮 🇲🇱 🇧🇫 🇹🇬 🇧🇯 🇬🇭 🇳🇬 🇰🇪 — **10+ pays**
**Opérateurs supportés** : MTN, Orange, Moov, M-Pesa, Visa, Mastercard
**Site** : https://notchpay.co

```env
NOTCHPAY_PUBLIC_KEY=pk_xxxxxxxxxxxxxxxxxx
NOTCHPAY_SECRET_KEY=sk_xxxxxxxxxxxxxxxxxx     # Pour auth API + vérification HMAC webhook
NOTCHPAY_BASE_URL=https://api.notchpay.co     # (défaut, ne pas changer)
```

**Comment obtenir** :
1. Créer un compte sur https://business.notchpay.co/register
2. Vérification KYB (documents entreprise)
3. Dashboard → Settings → API Keys → `Public Key` + `Secret Key`
4. Configurer webhook : `https://api.yukpo.com/api/webhooks/notchpay`

**Canaux NotchPay par pays** (format `{pays}.{opérateur}`) :
| Pays | Canaux disponibles |
|------|-------------------|
| 🇨🇲 Cameroun | `cm.mtn`, `cm.orange` |
| 🇸🇳 Sénégal | `sn.orange`, `sn.free`, `sn.wave` |
| 🇨🇮 Côte d'Ivoire | `ci.mtn`, `ci.orange`, `ci.moov` |
| 🇲🇱 Mali | `ml.orange`, `ml.moov` |
| 🇧🇫 Burkina Faso | `bf.orange`, `bf.moov` |
| 🇹🇬 Togo | `tg.moov` |
| 🇧🇯 Bénin | `bj.mtn`, `bj.moov` |
| 🇬🇭 Ghana | `gh.mtn`, `gh.vodafone`, `gh.tigo` |
| 🇳🇬 Nigeria | `ng.bank` (transfers) |
| 🇰🇪 Kenya | `ke.mpesa` |

---

### 1.3 Configuration Générale Paiement

```env
PAYMENT_PRIMARY_PROVIDER=cinetpay              # "cinetpay" ou "notchpay"
WEBHOOK_BASE_URL=https://api.yukpo.com         # URL publique du backend
```

---

## 2. MOBILE MONEY DIRECT (API opérateurs — optionnel si agrégateurs suffisent)

### 2.1 MTN Mobile Money API

**Site** : https://momodeveloper.mtn.com
**Couverture** : CM, CI, BJ, GH, UG, RW, CG, GN, ZA, NG

```env
MTN_MONEY_ENABLED=true
MTN_MONEY_API_KEY=xxxxxxxxxxxxxxxxxx
MTN_MONEY_API_SECRET=xxxxxxxxxxxxxxxxxx
MTN_MONEY_MERCHANT_ID=xxxxxxxxxxxxxxxxxx
MTN_MONEY_ENVIRONMENT=production               # "sandbox" ou "production"
MTN_MONEY_SUBSCRIPTION_KEY=xxxxxxxxxxxxxxxxxx   # Clé d'abonnement API
MTN_MONEY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxx
MTN_MONEY_API_URL=https://proxy.momoapi.mtn.com
MTN_MONEY_TARGET_ENVIRONMENT=production
```

**Comment obtenir** :
1. S'inscrire sur https://momodeveloper.mtn.com
2. Souscrire à un produit : `Collection` (recevoir) + `Disbursement` (envoyer)
3. Créer une application → Récupérer `Subscription Key` (Primary)
4. Générer API User + API Key via l'API provisioning
5. En production, contacter MTN pour obtenir les credentials live

---

### 2.2 Orange Money API

**Site** : https://developer.orange.com/apis/om-webpay
**Couverture** : CM, SN, CI, ML, BF, GN, MG, CD, CG

```env
ORANGE_MONEY_ENABLED=true
ORANGE_MONEY_API_KEY=xxxxxxxxxxxxxxxxxx
ORANGE_MONEY_API_SECRET=xxxxxxxxxxxxxxxxxx
ORANGE_MONEY_MERCHANT_ID=xxxxxxxxxxxxxxxxxx
ORANGE_MONEY_MERCHANT_KEY=xxxxxxxxxxxxxxxxxx
ORANGE_MONEY_ENVIRONMENT=production            # "sandbox" ou "production"
ORANGE_MONEY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxx
ORANGE_MONEY_API_URL=https://api.orange.com/orange-money-webpay/cm/v1
```

**Comment obtenir** :
1. S'inscrire sur https://developer.orange.com
2. Créer une application → Souscrire à "Orange Money Webpay"
3. Dashboard → Credentials → `Consumer Key` (= API Key) + `Consumer Secret`
4. Demander un `Merchant Key` via le support Orange Money du pays cible
5. En production, validation contractuelle avec Orange Money nécessaire

---

## 3. SMS & WHATSAPP (Vérification téléphone + notifications)

### 3.1 Twilio (SMS + WhatsApp Business)

**Site** : https://www.twilio.com

```env
# SMS
SMS_ENABLED=true
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1234567890

# WhatsApp Business
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio
TWILIO_WHATSAPP_NUMBER=+14155238886            # Numéro WhatsApp Business approuvé
WHATSAPP_WEBHOOK_URL=https://api.yukpo.com/api/webhooks/whatsapp
WHATSAPP_DEFAULT_GROUP_ID=xxxxxxxxxx
```

**Comment obtenir** :
1. S'inscrire sur https://www.twilio.com/try-twilio
2. Console → Récupérer `Account SID` + `Auth Token`
3. Acheter un numéro de téléphone (Phone Numbers → Buy a Number)
4. Pour WhatsApp : Messaging → Try it Out → Send a WhatsApp message → demander activation Business Profile
5. Budget estimé : ~$0.0075/SMS (variable par pays)

---

## 4. EMAIL

### 4.1 SendGrid

**Site** : https://sendgrid.com

```env
EMAIL_ENABLED=true
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@yukpo.com
SENDGRID_FROM_NAME=Yukpo
```

**Comment obtenir** :
1. S'inscrire sur https://signup.sendgrid.com
2. Settings → API Keys → Create API Key (Full Access)
3. Configurer Sender Authentication (vérifier domaine `yukpo.com`)
4. Plan gratuit : 100 emails/jour

---

## 5. KYC — Vérification d'identité

Le système supporte **5 fournisseurs** KYC au choix. Un seul suffit.

### 5.1 Onfido (recommandé pour l'Afrique)

**Site** : https://onfido.com
**Couverture** : Documents d'identité de 195+ pays

```env
KYC_PROVIDER=onfido
ONFIDO_API_KEY=api_live_xxxxxxxxxxxxxxxxxxxxxxxxxx
ONFIDO_WEBHOOK_TOKEN=xxxxxxxxxxxxxxxxxx
```

### 5.2 Sumsub (alternatif, bon pour l'Afrique)

**Site** : https://sumsub.com

```env
KYC_PROVIDER=sumsub
SUMSUB_APP_TOKEN=sbx:xxxxxxxxxxxxxxxxxxxxxxxxxx
SUMSUB_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5.3 Jumio

**Site** : https://www.jumio.com

```env
KYC_PROVIDER=jumio
JUMIO_API_KEY=xxxxxxxxxxxxxxxxxx
JUMIO_API_SECRET=xxxxxxxxxxxxxxxxxx
JUMIO_WEBHOOK_TOKEN=xxxxxxxxxxxxxxxxxx
```

### 5.4 Veriff

**Site** : https://www.veriff.com

```env
KYC_PROVIDER=veriff
VERIFF_API_KEY=xxxxxxxxxxxxxxxxxx
VERIFF_API_SECRET=xxxxxxxxxxxxxxxxxx
```

### 5.5 Persona

**Site** : https://withpersona.com

```env
KYC_PROVIDER=persona
PERSONA_API_KEY=persona_live_xxxxxxxxxxxxxxxxxx
PERSONA_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxx
```

### 5.6 Mode Manuel (sans fournisseur externe)

```env
KYC_PROVIDER=manual
```

---

## 6. INTELLIGENCE ARTIFICIELLE

### 6.1 OpenAI (GPT-4o — Modèle principal)

**Site** : https://platform.openai.com

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Comment obtenir** :
1. https://platform.openai.com/api-keys → Create new secret key
2. Ajouter un moyen de paiement (pay-as-you-go)
3. Budget recommandé : $50-100/mois pour démarrer

### 6.2 Anthropic Claude (Fallback IA)

**Site** : https://console.anthropic.com

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 6.3 Google Gemini (Fallback IA)

**Site** : https://ai.google.dev

```env
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 6.4 Mistral AI (Fallback IA)

**Site** : https://console.mistral.ai

```env
MISTRAL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 6.5 DeepSeek (Fallback IA low-cost)

**Site** : https://platform.deepseek.com

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

### 6.6 Cohere (Fallback IA)

**Site** : https://dashboard.cohere.com

```env
COHERE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 6.7 Ollama (IA locale — développement/fallback ultime)

```env
OLLAMA_URL=http://localhost:11434
```

---

## 7. GOOGLE CLOUD PLATFORM

### 7.1 Google Maps / Places

**Site** : https://console.cloud.google.com/apis

```env
GOOGLE_MAPS_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**APIs à activer** :
- Maps SDK for Android
- Maps SDK for iOS
- Places API
- Directions API
- Geocoding API
- Distance Matrix API

### 7.2 GCP Cloud SQL (PostgreSQL)

```env
DATABASE_URL=postgresql://yukpo_user:PASSWORD@/yukpo_db?host=/cloudsql/PROJECT:REGION:INSTANCE
```

---

## 8. LIVEKIT (Visioconférence / Streaming)

**Site** : https://livekit.io ou auto-hébergé

```env
LIVEKIT_URL=wss://yukpo-livekit.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Comment obtenir** :
1. https://cloud.livekit.io → Create Project
2. Settings → API Keys → Generate Key Pair

---

## 9. SÉCURITÉ & AUTH

```env
JWT_SECRET=une-chaine-aleatoire-de-64-caracteres-minimum-xxxxxxxxxxxxxxxxx
MOBILE_MONEY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxx
WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxx
```

**Générer un JWT_SECRET sécurisé** :
```bash
openssl rand -base64 64
```

---

## 10. CONVERSION DE DEVISES

```env
USD_TO_FCFA_RATE=600.0
USD_TO_EUR_RATE=0.92
VIDEO_DEFAULT_USER_CURRENCY=XAF
IA_COST_PER_1K_TOKENS_USD=0.015
```

---

## 11. TEMPLATE .env COMPLET (Production)

```env
# ============================================================
# YUKPO BACKEND — VARIABLES D'ENVIRONNEMENT PRODUCTION
# ============================================================

# --- Base de données ---
DATABASE_URL=postgresql://yukpo_user:PASSWORD@/yukpo_db?host=/cloudsql/PROJECT:REGION:INSTANCE

# --- Sécurité ---
JWT_SECRET=GENERER_AVEC_openssl_rand_base64_64
WEBHOOK_SECRET=GENERER_RANDOM_32_CHARS
MOBILE_MONEY_WEBHOOK_SECRET=GENERER_RANDOM_32_CHARS

# --- Agrégateur Paiement (CinetPay — Primaire) ---
PAYMENT_PRIMARY_PROVIDER=cinetpay
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
CINETPAY_SECRET_KEY=
WEBHOOK_BASE_URL=https://api.yukpo.com

# --- Agrégateur Paiement (NotchPay — Fallback) ---
NOTCHPAY_PUBLIC_KEY=
NOTCHPAY_SECRET_KEY=

# --- MTN Mobile Money Direct (optionnel) ---
MTN_MONEY_ENABLED=false
MTN_MONEY_API_KEY=
MTN_MONEY_API_SECRET=
MTN_MONEY_MERCHANT_ID=
MTN_MONEY_ENVIRONMENT=production
MTN_MONEY_SUBSCRIPTION_KEY=
MTN_MONEY_WEBHOOK_SECRET=

# --- Orange Money Direct (optionnel) ---
ORANGE_MONEY_ENABLED=false
ORANGE_MONEY_API_KEY=
ORANGE_MONEY_API_SECRET=
ORANGE_MONEY_MERCHANT_ID=
ORANGE_MONEY_MERCHANT_KEY=
ORANGE_MONEY_ENVIRONMENT=production
ORANGE_MONEY_WEBHOOK_SECRET=

# --- SMS (Twilio) ---
SMS_ENABLED=true
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# --- WhatsApp Business (Twilio) ---
WHATSAPP_ENABLED=true
WHATSAPP_PROVIDER=twilio
TWILIO_WHATSAPP_NUMBER=
WHATSAPP_WEBHOOK_URL=https://api.yukpo.com/api/webhooks/whatsapp

# --- Email (SendGrid) ---
EMAIL_ENABLED=true
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@yukpo.com
SENDGRID_FROM_NAME=Yukpo

# --- KYC (choisir 1 fournisseur) ---
KYC_PROVIDER=onfido
ONFIDO_API_KEY=
ONFIDO_WEBHOOK_TOKEN=

# --- Intelligence Artificielle ---
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
MISTRAL_API_KEY=
DEEPSEEK_API_KEY=

# --- Google Maps ---
GOOGLE_MAPS_API_KEY=

# --- LiveKit (Visioconférence) ---
LIVEKIT_URL=wss://yukpo-livekit.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# --- Conversion Devises ---
USD_TO_FCFA_RATE=600.0
USD_TO_EUR_RATE=0.92
VIDEO_DEFAULT_USER_CURRENCY=XAF
IA_COST_PER_1K_TOKENS_USD=0.015
```

---

## 12. COUVERTURE MOBILE MONEY PAR PAYS (Après corrections)

Le système Yukpo détecte **automatiquement** le pays de l'utilisateur via son numéro de téléphone et route le paiement vers le bon canal.

| # | Pays | Préfixe | Devise | MTN | Orange | Wave | Moov | M-Pesa | Autre |
|---|------|---------|--------|-----|--------|------|------|--------|-------|
| 1 | 🇨🇲 Cameroun | +237 | XAF | ✅ | ✅ | — | — | — | — |
| 2 | 🇸🇳 Sénégal | +221 | XOF | — | ✅ | ✅ | — | — | Free Money |
| 3 | 🇨🇮 Côte d'Ivoire | +225 | XOF | ✅ | ✅ | ✅ | ✅ | — | — |
| 4 | 🇲🇱 Mali | +223 | XOF | — | ✅ | — | ✅ | — | — |
| 5 | 🇧🇫 Burkina Faso | +226 | XOF | — | ✅ | — | ✅ | — | — |
| 6 | 🇹🇬 Togo | +228 | XOF | — | — | — | ✅ | — | T-Money |
| 7 | 🇧🇯 Bénin | +229 | XOF | ✅ | — | — | ✅ | — | — |
| 8 | 🇬🇳 Guinée | +224 | GNF | ✅ | ✅ | — | — | — | — |
| 9 | 🇳🇪 Niger | +227 | XOF | — | ✅ | — | ✅ | — | — |
| 10 | 🇬🇦 Gabon | +241 | XAF | — | — | — | — | — | Airtel Money |
| 11 | 🇨🇬 Congo-Brazza | +242 | XAF | ✅ | — | — | — | — | Airtel |
| 12 | 🇹🇩 Tchad | +235 | XAF | — | — | — | — | — | Airtel Money |
| 13 | 🇨🇫 Centrafrique | +236 | XAF | — | ✅ | — | — | — | — |
| 14 | 🇬🇶 Guinée Éq. | +240 | XAF | — | — | — | — | — | — |
| 15 | 🇨🇩 RD Congo | +243 | CDF | — | ✅ | — | — | ✅ | Airtel, Vodacom |
| 16 | 🇬🇭 Ghana | +233 | GHS | ✅ | — | — | — | — | Vodafone, Tigo |
| 17 | 🇳🇬 Nigeria | +234 | NGN | ✅ | — | — | — | — | Bank Transfer |
| 18 | 🇰🇪 Kenya | +254 | KES | — | — | — | — | ✅ | — |
| 19 | 🇹🇿 Tanzanie | +255 | TZS | — | — | — | — | ✅ | Tigo Pesa |
| 20 | 🇺🇬 Ouganda | +256 | UGX | ✅ | — | — | — | — | Airtel Money |
| 21 | 🇷🇼 Rwanda | +250 | RWF | ✅ | — | — | — | — | Airtel Money |
| 22 | 🇧🇮 Burundi | +257 | BIF | — | — | — | — | — | Ecocash |
| 23 | 🇪🇹 Éthiopie | +251 | ETB | — | — | — | — | ✅ | Telebirr |
| 24 | 🇲🇬 Madagascar | +261 | MGA | — | ✅ | — | — | — | MVola |
| 25 | 🇿🇦 Afrique du Sud | +27 | ZAR | ✅ | — | — | — | — | FNB, Capitec |
| 26 | 🇲🇦 Maroc | +212 | MAD | — | — | — | — | — | CashPlus |
| 27 | 🇩🇿 Algérie | +213 | DZD | — | — | — | — | — | CIB |
| 28 | 🇹🇳 Tunisie | +216 | TND | — | — | — | — | — | D17 |
| 29 | 🇪🇬 Égypte | +20 | EGP | — | ✅ | — | — | — | Fawry |
| 30 | 🇲🇷 Mauritanie | +222 | MRU | — | — | — | — | — | Sedad |

---

## 13. PRIORITÉ DE DÉPLOIEMENT

### Phase 1 — Lancement minimal (3 clés suffisent)
1. **CINETPAY** → Paiements Mobile Money + Cartes (15+ pays)
2. **JWT_SECRET** → Sécurité auth
3. **OPENAI_API_KEY** → IA fonctionnelle

### Phase 2 — Notifications
4. **TWILIO** → SMS + WhatsApp
5. **SENDGRID** → Emails

### Phase 3 — KYC & Compliance
6. **ONFIDO** ou **SUMSUB** → Vérification d'identité

### Phase 4 — Redondance
7. **NOTCHPAY** → Fallback paiement
8. **ANTHROPIC** ou **GEMINI** → Fallback IA

### Phase 5 — Features avancées
9. **LIVEKIT** → Visioconférence
10. **GOOGLE_MAPS** → Géolocalisation avancée
11. **MTN/Orange API directes** → Pour les pays non couverts par CinetPay
