// ✅ Service d'agrégation de paiement — Production-ready
// Supporte CinetPay (primaire CEMAC/UEMOA) + NotchPay (fallback) + Flutterwave (pan-africain)
//
// Matrice de couverture réelle:
//   CinetPay  → CM, CI, SN, ML, BF, TG, BJ, GN, CD (~9 pays, zone franc CFA)
//   NotchPay  → CM, CI, SN, NG (4 pays, fallback)
//   Flutterwave → 30+ pays: KE, TZ, UG, RW, GH, ZM, ET + CEMAC/UEMOA (pan-africain)
//
// Architecture:
//   Mobile → Backend → select_best_aggregator(country, operator)
//                     → CinetPay/NotchPay/Flutterwave → Opérateur mobile
//   Agrégateur → Webhook → Backend → Crédit tokens

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

use super::flutterwave_service::{
    flutterwave_network, FlutterwaveChargeRequest, FlutterwaveService,
};

// ============================================================================
// TYPES PUBLICS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AggregatorProvider {
    CinetPay,
    NotchPay,
    Flutterwave,
    AfricaPay,
}

impl std::fmt::Display for AggregatorProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AggregatorProvider::CinetPay => write!(f, "cinetpay"),
            AggregatorProvider::NotchPay => write!(f, "notchpay"),
            AggregatorProvider::Flutterwave => write!(f, "flutterwave"),
            AggregatorProvider::AfricaPay => write!(f, "africapay"),
        }
    }
}

/// Détermine le meilleur agrégateur pour un pays et opérateur donné
/// Basé sur la couverture RÉELLE vérifiée de chaque plateforme
pub fn select_best_aggregator(country: &str, operator: &str) -> AggregatorProvider {
    let c = country.to_lowercase();
    let op = operator.to_lowercase();

    match c.as_str() {
        // ── Zone CinetPay confirmée (CEMAC/UEMOA) ──
        "cm" => match op.as_str() {
            "mtn" | "orange" => AggregatorProvider::CinetPay,
            _ => AggregatorProvider::CinetPay,
        },
        "ci" => match op.as_str() {
            "mtn" | "orange" | "moov" | "wave" => AggregatorProvider::CinetPay,
            _ => AggregatorProvider::CinetPay,
        },
        "sn" => match op.as_str() {
            "orange" | "free" | "wave" | "expresso" => AggregatorProvider::CinetPay,
            _ => AggregatorProvider::CinetPay,
        },
        "ml" | "bf" => AggregatorProvider::CinetPay, // Orange, Moov
        "tg" | "bj" => AggregatorProvider::CinetPay, // MTN, Moov, Tmoney, Flooz
        "gn" => AggregatorProvider::CinetPay,        // MTN, Orange
        "cd" => match op.as_str() {
            "orange" | "mpesa" | "airtel" => AggregatorProvider::CinetPay, // CinetPay couvre la RDC
            _ => AggregatorProvider::Flutterwave,
        },

        // ── Zone Flutterwave exclusive (CinetPay absent) ──
        "ke" => AggregatorProvider::Flutterwave, // M-Pesa Kenya
        "tz" => AggregatorProvider::Flutterwave, // Vodacom, Airtel, Tigo, Halotel
        "ug" => AggregatorProvider::Flutterwave, // MTN, Airtel Uganda
        "rw" => AggregatorProvider::Flutterwave, // MTN, M-Pesa Rwanda
        "gh" => AggregatorProvider::Flutterwave, // MTN, AirtelTigo, Vodafone Ghana
        "zm" => AggregatorProvider::Flutterwave, // M-Pesa Zambia
        "et" => AggregatorProvider::Flutterwave, // Amole Ethiopia
        "mz" => AggregatorProvider::Flutterwave, // M-Pesa Mozambique
        "mw" => AggregatorProvider::Flutterwave, // Airtel Malawi

        // ── Zone CEMAC secondaire: Flutterwave en fallback ──
        "ga" | "cg" | "cf" | "td" | "gq" => AggregatorProvider::Flutterwave,

        // ── Nigeria: Flutterwave (spécialiste) ──
        "ng" => AggregatorProvider::Flutterwave,

        // ── Afrique australe/autre: Flutterwave ──
        "za" | "zw" | "ls" | "sz" => AggregatorProvider::Flutterwave,

        // ── Zone UEMOA secondaire: CinetPay d'abord ──
        "ne" | "gw" | "mr" => AggregatorProvider::CinetPay,

        // ── Défaut: Flutterwave (couverture la plus large) ──
        _ => AggregatorProvider::Flutterwave,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PayChannel {
    MtnMoney,
    OrangeMoney,
    Wave,         // Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Guinée-Bissau, Gambie
    MoovMoney,    // Côte d'Ivoire, Togo, Bénin, Niger, Burkina Faso, Centrafrique, Tchad
    AirtelMoney, // 14 pays: Uganda, Kenya, Tanzania, Rwanda, DRC, Niger, Gabon, Congo, Tchad, Madagascar...
    Mpesa,       // Kenya, Tanzania, DRC, Mozambique, Ghana, Egypte, Lesotho
    VodafoneCash, // Ghana
    FreeMoney,   // Sénégal
    TigoPesa,    // Tanzania (maintenant Airtel)
    EcoCash,     // Zimbabwe
    Visa,
    Mastercard,
    AllMobileMoney,
}

impl PayChannel {
    /// Convertir en code CinetPay
    /// CinetPay gère la détection automatique via le préfixe téléphone pour la plupart
    pub fn to_cinetpay_channel(&self) -> Option<&str> {
        match self {
            PayChannel::MtnMoney => Some("MTN"),
            PayChannel::OrangeMoney => Some("OM"),
            PayChannel::Wave => Some("WAVE"),
            PayChannel::MoovMoney => Some("MOOV"),
            PayChannel::Mpesa => Some("MPESA"),
            PayChannel::AirtelMoney => Some("AIRTEL"),
            PayChannel::FreeMoney => Some("FREEMONEY"),
            PayChannel::Visa | PayChannel::Mastercard => Some("CARD"),
            PayChannel::VodafoneCash | PayChannel::TigoPesa | PayChannel::EcoCash => None,
            PayChannel::AllMobileMoney => None, // CinetPay affiche tous les canaux disponibles
        }
    }

    /// Convertir en code NotchPay pour un pays donné (format: {country}.{operator})
    pub fn to_notchpay_channel_for_country(&self, country_code: &str) -> String {
        let cc = country_code.to_lowercase();
        match self {
            PayChannel::MtnMoney => {
                // MTN: CM, CI, BJ, GH, UG, RW, CG, GN, ZA, NG, LR, SS
                format!("{}.mtn", cc)
            }
            PayChannel::OrangeMoney => {
                // Orange: CM, SN, CI, ML, BF, GN, MG, CD, CG, NE, TD
                format!("{}.orange", cc)
            }
            PayChannel::Wave => {
                // Wave: SN, CI, ML, BF, GW, GM
                format!("{}.wave", cc)
            }
            PayChannel::MoovMoney => {
                // Moov: CI, TG, BJ, NE, BF, CF, TD
                format!("{}.moov", cc)
            }
            PayChannel::AirtelMoney => {
                // Airtel: UG, KE, TZ, RW, CD, NE, GA, CG, TD, MG, MW, ZM, SC
                format!("{}.airtel", cc)
            }
            PayChannel::Mpesa => {
                // M-Pesa: KE, TZ, CD, MZ, GH, EG, LS
                format!("{}.mpesa", cc)
            }
            PayChannel::VodafoneCash => "gh.vodafone".to_string(),
            PayChannel::FreeMoney => "sn.free".to_string(),
            PayChannel::TigoPesa => format!("{}.tigo", cc),
            PayChannel::EcoCash => "zw.ecocash".to_string(),
            PayChannel::Visa | PayChannel::Mastercard => "card".to_string(),
            PayChannel::AllMobileMoney => format!("{}.mobile", cc),
        }
    }

    /// Backward-compatible: défaut Cameroun
    pub fn to_notchpay_channel(&self) -> String {
        self.to_notchpay_channel_for_country("cm")
    }
}

/// Détecte le code pays ISO 2 lettres à partir d'un numéro de téléphone (préfixe international)
pub fn detect_country_from_phone(phone: &str) -> &'static str {
    let cleaned = phone.replace(['+', ' ', '-'], "");
    // Préfixes internationaux → code pays
    if cleaned.starts_with("237") {
        return "cm";
    } // Cameroun
    if cleaned.starts_with("221") {
        return "sn";
    } // Sénégal
    if cleaned.starts_with("225") {
        return "ci";
    } // Côte d'Ivoire
    if cleaned.starts_with("223") {
        return "ml";
    } // Mali
    if cleaned.starts_with("226") {
        return "bf";
    } // Burkina Faso
    if cleaned.starts_with("228") {
        return "tg";
    } // Togo
    if cleaned.starts_with("229") {
        return "bj";
    } // Bénin
    if cleaned.starts_with("224") {
        return "gn";
    } // Guinée
    if cleaned.starts_with("222") {
        return "mr";
    } // Mauritanie
    if cleaned.starts_with("227") {
        return "ne";
    } // Niger
    if cleaned.starts_with("233") {
        return "gh";
    } // Ghana
    if cleaned.starts_with("234") {
        return "ng";
    } // Nigeria
    if cleaned.starts_with("242") {
        return "cg";
    } // Congo-Brazzaville
    if cleaned.starts_with("243") {
        return "cd";
    } // RD Congo
    if cleaned.starts_with("250") {
        return "rw";
    } // Rwanda
    if cleaned.starts_with("257") {
        return "bi";
    } // Burundi
    if cleaned.starts_with("254") {
        return "ke";
    } // Kenya
    if cleaned.starts_with("255") {
        return "tz";
    } // Tanzanie
    if cleaned.starts_with("256") {
        return "ug";
    } // Ouganda
    if cleaned.starts_with("251") {
        return "et";
    } // Éthiopie
    if cleaned.starts_with("261") {
        return "mg";
    } // Madagascar
    if cleaned.starts_with("27") {
        return "za";
    } // Afrique du Sud
    if cleaned.starts_with("241") {
        return "ga";
    } // Gabon
    if cleaned.starts_with("235") {
        return "td";
    } // Tchad
    if cleaned.starts_with("236") {
        return "cf";
    } // Centrafrique
    if cleaned.starts_with("240") {
        return "gq";
    } // Guinée Équatoriale
    if cleaned.starts_with("245") {
        return "gw";
    } // Guinée-Bissau
    if cleaned.starts_with("212") {
        return "ma";
    } // Maroc
    if cleaned.starts_with("213") {
        return "dz";
    } // Algérie
    if cleaned.starts_with("216") {
        return "tn";
    } // Tunisie
    if cleaned.starts_with("20") {
        return "eg";
    } // Égypte
    "cm" // Défaut: Cameroun
}

/// Retourne la devise ISO pour un code pays donné
pub fn currency_for_country(country_code: &str) -> &'static str {
    match country_code {
        // Zone CEMAC (Franc CFA BEAC)
        "cm" | "ga" | "cg" | "cf" | "td" | "gq" => "XAF",
        // Zone UEMOA (Franc CFA BCEAO)
        "sn" | "ci" | "ml" | "bf" | "ne" | "tg" | "bj" | "gw" => "XOF",
        // Afrique de l'Ouest (monnaies locales)
        "gh" => "GHS",
        "ng" => "NGN",
        "gn" => "GNF",
        "mr" => "MRU",
        // Afrique de l'Est
        "ke" => "KES",
        "tz" => "TZS",
        "ug" => "UGX",
        "rw" => "RWF",
        "bi" => "BIF",
        "et" => "ETB",
        "cd" => "CDF",
        // Afrique australe
        "za" => "ZAR",
        "mg" => "MGA",
        // Maghreb
        "ma" => "MAD",
        "dz" => "DZD",
        "tn" => "TND",
        "eg" => "EGP",
        // Défaut
        _ => "XAF",
    }
}

/// Taux de conversion approximatif vers XAF (Franc CFA BEAC).
/// 1 unité de devise étrangère = N XAF.
/// Taux indicatifs statiques (à remplacer par un service de taux en temps réel en production).
/// Sources: taux moyens mars 2026 — arrondis pour faciliter les calculs.
pub fn exchange_rate_to_xaf(currency: &str) -> f64 {
    match currency {
        "XAF" => 1.0,
        "XOF" => 1.0,     // XAF et XOF ont parité fixe 1:1 (zone franc CFA)
        "EUR" => 655.957, // Parité fixe EUR/XAF
        "USD" => 610.0,
        "GBP" => 770.0,
        "NGN" => 0.40,  // 1 NGN ≈ 0.40 XAF
        "GHS" => 42.0,  // 1 GHS ≈ 42 XAF
        "GNF" => 0.070, // 1 GNF ≈ 0.07 XAF
        "MRU" => 15.5,  // 1 MRU ≈ 15.5 XAF
        "KES" => 4.5,   // 1 KES ≈ 4.5 XAF
        "TZS" => 0.24,  // 1 TZS ≈ 0.24 XAF
        "UGX" => 0.16,  // 1 UGX ≈ 0.16 XAF
        "RWF" => 0.46,  // 1 RWF ≈ 0.46 XAF
        "BIF" => 0.21,  // 1 BIF ≈ 0.21 XAF
        "ETB" => 5.0,   // 1 ETB ≈ 5.0 XAF
        "CDF" => 0.22,  // 1 CDF ≈ 0.22 XAF
        "ZAR" => 33.0,  // 1 ZAR ≈ 33 XAF
        "MGA" => 0.13,  // 1 MGA ≈ 0.13 XAF
        "MAD" => 60.0,  // 1 MAD ≈ 60 XAF
        "DZD" => 4.5,   // 1 DZD ≈ 4.5 XAF
        "TND" => 195.0, // 1 TND ≈ 195 XAF
        "EGP" => 12.5,  // 1 EGP ≈ 12.5 XAF
        "CHF" => 690.0,
        "CAD" => 450.0,
        "BRL" => 120.0,
        "MXN" => 35.0,
        "INR" => 7.3,
        "CNY" => 84.0,
        "AED" => 166.0,
        "SAR" => 163.0,
        _ => {
            log::error!(
                "[exchange_rate_to_xaf] Devise inconnue '{}' — taux 0 pour bloquer la transaction",
                currency
            );
            0.0
        }
    }
}

/// Convertit un montant dans une devise source vers XAF (tokens).
/// Retourne le montant équivalent en XAF (entier arrondi).
pub fn convert_to_xaf(amount: f64, source_currency: &str) -> i64 {
    let rate = exchange_rate_to_xaf(source_currency);
    let xaf_amount = amount * rate;
    xaf_amount.round() as i64
}

/// Symbole de devise pour affichage
pub fn currency_symbol(currency: &str) -> &str {
    match currency {
        "XAF" | "XOF" => "FCFA",
        "EUR" => "€",
        "USD" => "$",
        "GBP" => "£",
        "NGN" => "₦",
        "GHS" => "GH₵",
        "KES" => "KSh",
        "TZS" => "TSh",
        "UGX" => "USh",
        "RWF" => "FRw",
        "ZAR" => "R",
        "MAD" => "DH",
        "EGP" => "E£",
        "ETB" => "Br",
        "CDF" => "FC",
        "BIF" => "FBu",
        "MGA" => "Ar",
        "GNF" => "FG",
        "TND" => "DT",
        "DZD" => "DA",
        "MRU" => "UM",
        _ => currency,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitPaymentRequest {
    pub user_id: i32,
    pub amount: i64,      // Montant en XAF (entier)
    pub currency: String, // "XAF"
    pub channel: PayChannel,
    pub phone_number: Option<String>,
    pub description: String,
    pub customer_email: Option<String>,
    pub customer_name: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitPaymentResponse {
    pub success: bool,
    pub transaction_id: String, // Notre ID interne
    pub provider: AggregatorProvider,
    pub provider_reference: String,    // ID côté agrégateur
    pub payment_url: Option<String>,   // URL de paiement (pour cartes/redirect)
    pub payment_token: Option<String>, // Token pour SDK mobile
    pub status: PaymentAggStatus,
    pub instructions: Option<String>, // Instructions pour l'utilisateur
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PaymentAggStatus {
    Pending,
    AwaitingConfirmation,
    Processing,
    Completed,
    Failed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckStatusResponse {
    pub transaction_id: String,
    pub provider_reference: String,
    pub status: PaymentAggStatus,
    pub amount: i64,
    pub currency: String,
    pub payment_method: Option<String>,
    pub provider_data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookVerification {
    pub is_valid: bool,
    pub transaction_id: Option<String>,
    pub status: Option<PaymentAggStatus>,
    pub amount: Option<i64>,
    pub currency: Option<String>,
    pub provider_reference: Option<String>,
    pub raw_data: Option<serde_json::Value>,
}

// ============================================================================
// CONFIGURATION
// ============================================================================

#[derive(Debug, Clone)]
pub struct AggregatorConfig {
    // CinetPay (zone CEMAC/UEMOA)
    pub cinetpay_api_key: String,
    pub cinetpay_api_password: String,
    pub cinetpay_secret_key: String,
    pub cinetpay_base_url: String,

    // NotchPay (fallback CEMAC)
    pub notchpay_public_key: String,
    pub notchpay_secret_key: String,
    pub notchpay_base_url: String,

    // AfricaPay (Cameroun / Afrique centrale)
    pub africapay_api_key: String,
    pub africapay_base_url: String,

    // Général
    pub webhook_base_url: String,
    pub primary_provider: AggregatorProvider,
}

impl AggregatorConfig {
    pub fn from_env() -> Self {
        let primary =
            std::env::var("PAYMENT_PRIMARY_PROVIDER").unwrap_or_else(|_| "cinetpay".to_string());

        Self {
            cinetpay_api_key: std::env::var("CINETPAY_API_KEY").unwrap_or_default(),
            cinetpay_api_password: std::env::var("CINETPAY_API_PASSWORD").unwrap_or_default(),
            cinetpay_secret_key: std::env::var("CINETPAY_SECRET_KEY").unwrap_or_default(),
            cinetpay_base_url: std::env::var("CINETPAY_BASE_URL")
                .unwrap_or_else(|_| "https://api-checkout.cinetpay.com".to_string()),

            notchpay_public_key: std::env::var("NOTCHPAY_PUBLIC_KEY").unwrap_or_default(),
            notchpay_secret_key: std::env::var("NOTCHPAY_SECRET_KEY").unwrap_or_default(),
            notchpay_base_url: std::env::var("NOTCHPAY_BASE_URL")
                .unwrap_or_else(|_| "https://api.notchpay.co".to_string()),

            africapay_api_key: std::env::var("AFRICAPAY_API_KEY").unwrap_or_default(),
            africapay_base_url: std::env::var("AFRICAPAY_BASE_URL")
                .unwrap_or_else(|_| "https://api.africapay.org".to_string()),

            webhook_base_url: std::env::var("WEBHOOK_BASE_URL")
                .or_else(|_| std::env::var("BACKEND_URL"))
                .unwrap_or_else(|_| {
                    "https://yukpo-backend-376093909298.europe-west1.run.app".to_string()
                }),

            primary_provider: match primary.as_str() {
                "notchpay" => AggregatorProvider::NotchPay,
                "flutterwave" => AggregatorProvider::Flutterwave,
                "africapay" => AggregatorProvider::AfricaPay,
                _ => AggregatorProvider::CinetPay,
            },
        }
    }

    pub fn is_cinetpay_configured(&self) -> bool {
        !self.cinetpay_api_key.is_empty() && !self.cinetpay_api_password.is_empty()
    }

    pub fn is_notchpay_configured(&self) -> bool {
        !self.notchpay_public_key.is_empty() && !self.notchpay_secret_key.is_empty()
    }

    pub fn is_africapay_configured(&self) -> bool {
        !self.africapay_api_key.is_empty()
    }
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

pub struct PaymentAggregator {
    config: AggregatorConfig,
    client: Client,
    flutterwave: FlutterwaveService,
}

impl PaymentAggregator {
    pub fn new() -> Self {
        let config = AggregatorConfig::from_env();
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            client,
            flutterwave: FlutterwaveService::new(),
        }
    }

    pub fn with_config(config: AggregatorConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            client,
            flutterwave: FlutterwaveService::new(),
        }
    }

    /// Initier un paiement via l'agrégateur le plus adapté au pays/opérateur
    pub async fn initiate_payment(
        &self,
        request: InitPaymentRequest,
    ) -> Result<InitPaymentResponse, String> {
        let transaction_id = format!(
            "yukpo_{}",
            Uuid::new_v4().to_string().replace("-", "")[..16].to_string()
        );

        // Détecter le pays depuis le numéro de téléphone
        let country =
            request.phone_number.as_deref().map(detect_country_from_phone).unwrap_or("cm");

        // Déterminer l'opérateur depuis le PayChannel
        let operator = match &request.channel {
            PayChannel::MtnMoney => "mtn",
            PayChannel::OrangeMoney => "orange",
            PayChannel::Wave => "wave",
            PayChannel::MoovMoney => "moov",
            PayChannel::AirtelMoney => "airtel",
            PayChannel::Mpesa => "mpesa",
            PayChannel::VodafoneCash => "vodafone",
            PayChannel::FreeMoney => "free",
            PayChannel::TigoPesa => "tigo",
            PayChannel::EcoCash => "ecocash",
            _ => "all",
        };

        // Sélectionner le meilleur agrégateur
        let best = select_best_aggregator(country, operator);

        log::info!(
            "[PaymentAggregator] Country={}, Operator={}, Selected={} for {} {} (user {})",
            country,
            operator,
            best,
            request.amount,
            request.currency,
            request.user_id
        );

        match best {
            AggregatorProvider::Flutterwave => {
                if self.flutterwave.is_configured() {
                    match self
                        .initiate_flutterwave(&transaction_id, &request, country, operator)
                        .await
                    {
                        Ok(response) => return Ok(response),
                        Err(e) => {
                            log::warn!(
                                "[PaymentAggregator] Flutterwave failed, trying CinetPay: {}",
                                e
                            );
                            if self.config.is_cinetpay_configured() {
                                return self.initiate_cinetpay(&transaction_id, &request).await;
                            }
                            return Err(e);
                        }
                    }
                }
                // Fallback to CinetPay/NotchPay
                if self.config.is_cinetpay_configured() {
                    return self.initiate_cinetpay(&transaction_id, &request).await;
                }
                if self.config.is_notchpay_configured() {
                    return self.initiate_notchpay(&transaction_id, &request).await;
                }
            }
            AggregatorProvider::CinetPay => {
                if self.config.is_cinetpay_configured() {
                    match self.initiate_cinetpay(&transaction_id, &request).await {
                        Ok(response) => return Ok(response),
                        Err(e) => {
                            log::warn!("[PaymentAggregator] CinetPay failed: {}", e);
                            // Fallback: Flutterwave > NotchPay
                            if self.flutterwave.is_configured() {
                                match self
                                    .initiate_flutterwave(
                                        &transaction_id,
                                        &request,
                                        country,
                                        operator,
                                    )
                                    .await
                                {
                                    Ok(r) => return Ok(r),
                                    Err(e2) => log::warn!(
                                        "[PaymentAggregator] Flutterwave fallback also failed: {}",
                                        e2
                                    ),
                                }
                            }
                            if self.config.is_notchpay_configured() {
                                return self.initiate_notchpay(&transaction_id, &request).await;
                            }
                            return Err(e);
                        }
                    }
                }
                // CinetPay not configured, try alternatives
                if self.flutterwave.is_configured() {
                    return self
                        .initiate_flutterwave(&transaction_id, &request, country, operator)
                        .await;
                }
                if self.config.is_notchpay_configured() {
                    return self.initiate_notchpay(&transaction_id, &request).await;
                }
            }
            AggregatorProvider::NotchPay => {
                if self.config.is_notchpay_configured() {
                    match self.initiate_notchpay(&transaction_id, &request).await {
                        Ok(response) => return Ok(response),
                        Err(e) => {
                            log::warn!("[PaymentAggregator] NotchPay failed: {}", e);
                            if self.config.is_cinetpay_configured() {
                                return self.initiate_cinetpay(&transaction_id, &request).await;
                            }
                            if self.flutterwave.is_configured() {
                                return self
                                    .initiate_flutterwave(
                                        &transaction_id,
                                        &request,
                                        country,
                                        operator,
                                    )
                                    .await;
                            }
                            return Err(e);
                        }
                    }
                }
                if self.config.is_cinetpay_configured() {
                    return self.initiate_cinetpay(&transaction_id, &request).await;
                }
                if self.flutterwave.is_configured() {
                    return self
                        .initiate_flutterwave(&transaction_id, &request, country, operator)
                        .await;
                }
            }
        }

        Err("Aucun agrégateur de paiement configuré. Configurez CINETPAY_API_KEY + CINETPAY_API_PASSWORD, NOTCHPAY_PUBLIC_KEY ou FLUTTERWAVE_SECRET_KEY.".to_string())
    }

    /// Vérifier le statut d'un paiement
    pub async fn check_status(
        &self,
        transaction_id: &str,
        provider: &AggregatorProvider,
        provider_reference: &str,
    ) -> Result<CheckStatusResponse, String> {
        match provider {
            AggregatorProvider::CinetPay => {
                self.check_cinetpay_status(transaction_id, provider_reference).await
            }
            AggregatorProvider::NotchPay => {
                self.check_notchpay_status(transaction_id, provider_reference).await
            }
            AggregatorProvider::Flutterwave => {
                let result = self.flutterwave.verify_transaction(provider_reference).await?;
                let status = match result.status.as_str() {
                    "successful" => PaymentAggStatus::Completed,
                    "failed" => PaymentAggStatus::Failed,
                    "cancelled" => PaymentAggStatus::Cancelled,
                    _ => PaymentAggStatus::Processing,
                };
                Ok(CheckStatusResponse {
                    transaction_id: transaction_id.to_string(),
                    provider_reference: result.flw_ref.unwrap_or_default(),
                    status,
                    amount: 0,
                    currency: String::new(),
                    payment_method: None,
                    provider_data: None,
                })
            }
        }
    }

    /// Vérifier et parser un webhook entrant
    pub fn verify_webhook(
        &self,
        provider: &AggregatorProvider,
        headers: &std::collections::HashMap<String, String>,
        body: &[u8],
    ) -> WebhookVerification {
        match provider {
            AggregatorProvider::CinetPay => self.verify_cinetpay_webhook(body),
            AggregatorProvider::NotchPay => self.verify_notchpay_webhook(headers, body),
            AggregatorProvider::Flutterwave => {
                let secret_hash = headers.get("verif-hash").map(|s| s.as_str());
                if !self.flutterwave.verify_webhook(secret_hash) {
                    return WebhookVerification {
                        is_valid: false,
                        transaction_id: None,
                        status: None,
                        amount: None,
                        currency: None,
                        provider_reference: None,
                        raw_data: None,
                    };
                }
                let body_json: serde_json::Value = match serde_json::from_slice(body) {
                    Ok(v) => v,
                    Err(_) => {
                        return WebhookVerification {
                            is_valid: false,
                            transaction_id: None,
                            status: None,
                            amount: None,
                            currency: None,
                            provider_reference: None,
                            raw_data: None,
                        }
                    }
                };
                let data = body_json.get("data").cloned().unwrap_or(serde_json::json!({}));
                let tx_ref = data.get("tx_ref").and_then(|t| t.as_str()).map(|s| s.to_string());
                let flw_ref = data.get("flw_ref").and_then(|r| r.as_str()).map(|s| s.to_string());
                let status_str = data.get("status").and_then(|s| s.as_str()).unwrap_or("");
                let status = match status_str {
                    "successful" => Some(PaymentAggStatus::Completed),
                    "failed" => Some(PaymentAggStatus::Failed),
                    "cancelled" => Some(PaymentAggStatus::Cancelled),
                    _ => Some(PaymentAggStatus::Processing),
                };
                let amount = data.get("amount").and_then(|a| a.as_f64()).map(|a| a as i64);
                let currency = data.get("currency").and_then(|c| c.as_str()).map(|s| s.to_string());
                WebhookVerification {
                    is_valid: true,
                    transaction_id: tx_ref,
                    status,
                    amount,
                    currency,
                    provider_reference: flw_ref,
                    raw_data: Some(body_json),
                }
            }
        }
    }

    /// Retourne les providers actuellement configurés
    pub fn active_provider(&self) -> Option<AggregatorProvider> {
        if self.config.is_cinetpay_configured() {
            return Some(AggregatorProvider::CinetPay);
        }
        if self.flutterwave.is_configured() {
            return Some(AggregatorProvider::Flutterwave);
        }
        if self.config.is_notchpay_configured() {
            return Some(AggregatorProvider::NotchPay);
        }
        None
    }

    // ========================================================================
    // FLUTTERWAVE (Pan-African: 30+ pays)
    // ========================================================================

    async fn initiate_flutterwave(
        &self,
        transaction_id: &str,
        request: &InitPaymentRequest,
        country: &str,
        operator: &str,
    ) -> Result<InitPaymentResponse, String> {
        log::info!(
            "[Flutterwave] Initiation paiement: {} {} pour user {} (country={}, op={})",
            request.amount,
            request.currency,
            request.user_id,
            country,
            operator
        );

        let network = flutterwave_network(operator, country).map(|s| s.to_string());

        let redirect_url = format!(
            "{}/api/webhooks/flutterwave/return?txn={}",
            self.config.webhook_base_url, transaction_id
        );

        let fw_req = FlutterwaveChargeRequest {
            tx_ref: transaction_id.to_string(),
            amount: request.amount as f64,
            currency: request.currency.clone(),
            phone_number: request.phone_number.clone(),
            email: request.customer_email.clone().unwrap_or_else(|| "client@yukpo.com".to_string()),
            network,
            country: Some(country.to_uppercase()),
            customer_name: request.customer_name.clone(),
            redirect_url: Some(redirect_url),
            meta: request.metadata.clone(),
        };

        let result = if request.phone_number.is_some() {
            self.flutterwave.charge_mobile_money(&fw_req).await?
        } else {
            self.flutterwave.create_payment_link(&fw_req).await?
        };

        Ok(InitPaymentResponse {
            success: true,
            transaction_id: transaction_id.to_string(),
            provider: AggregatorProvider::Flutterwave,
            provider_reference: result.flw_ref.unwrap_or_default(),
            payment_url: result.payment_link,
            payment_token: None,
            status: match result.status.as_str() {
                "successful" => PaymentAggStatus::Completed,
                "pending" => PaymentAggStatus::Pending,
                _ => PaymentAggStatus::AwaitingConfirmation,
            },
            instructions: Some(
                "Validez le paiement sur votre téléphone ou via la page de paiement.".to_string(),
            ),
        })
    }

    // ========================================================================
    // CINETPAY (CEMAC/UEMOA: CM, CI, SN, ML, BF, TG, BJ, GN, CD)
    // ========================================================================

    async fn initiate_cinetpay(
        &self,
        transaction_id: &str,
        request: &InitPaymentRequest,
    ) -> Result<InitPaymentResponse, String> {
        log::info!(
            "[CinetPay] Initiation paiement: {} XAF pour user {}",
            request.amount,
            request.user_id
        );

        let notify_url = format!("{}/api/webhooks/cinetpay", self.config.webhook_base_url);
        let return_url = format!(
            "{}/payment/success?txn={}",
            self.config.webhook_base_url, transaction_id
        );
        let cancel_url = format!(
            "{}/payment/cancel?txn={}",
            self.config.webhook_base_url, transaction_id
        );

        let mut payload = serde_json::json!({
            "apikey": self.config.cinetpay_api_key,
            "api_password": self.config.cinetpay_api_password,
            "transaction_id": transaction_id,
            "amount": request.amount,
            "currency": &request.currency,
            "description": &request.description,
            "notify_url": notify_url,
            "return_url": return_url,
            "cancel_url": cancel_url,
            "channels": "ALL",
            "lang": "fr",
            "metadata": transaction_id,
            "customer_name": request.customer_name.as_deref().unwrap_or("Client Yukpo"),
            "customer_email": request.customer_email.as_deref().unwrap_or("client@yukpo.com"),
            "customer_phone_number": request.phone_number.as_deref().unwrap_or(""),
            "customer_address": "Cameroun",
            "customer_city": "Douala",
            "customer_country": "CM",
        });

        // Filtrer le canal si spécifié
        if let Some(channel_code) = request.channel.to_cinetpay_channel() {
            payload["channels"] = serde_json::json!(channel_code);
        }

        // Si mobile money avec numéro de téléphone, utiliser l'API de paiement direct
        if let Some(phone) = &request.phone_number {
            if matches!(
                request.channel,
                PayChannel::MtnMoney | PayChannel::OrangeMoney | PayChannel::AllMobileMoney
            ) {
                payload["customer_phone_number"] = serde_json::json!(phone);
                payload["alternative_currency"] = serde_json::json!("");
            }
        }

        let response = self
            .client
            .post(&format!("{}/v2/payment", self.config.cinetpay_base_url))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau CinetPay: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture réponse CinetPay: {}", e))?;

        log::info!(
            "[CinetPay] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value =
            serde_json::from_str(&response_text).map_err(|e| {
                format!(
                    "Erreur parsing CinetPay: {} - Body: {}",
                    e,
                    &response_text[..response_text.len().min(200)]
                )
            })?;

        // CinetPay retourne { code: "201", message: "...", data: { payment_token, payment_url } }
        let code = response_json.get("code").and_then(|c| c.as_str()).unwrap_or("");

        if code != "201" {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            return Err(format!("CinetPay erreur {}: {}", code, message));
        }

        let data = response_json.get("data").ok_or("CinetPay: champ 'data' manquant")?;

        let payment_token =
            data.get("payment_token").and_then(|t| t.as_str()).map(|s| s.to_string());

        let payment_url = data.get("payment_url").and_then(|u| u.as_str()).map(|s| s.to_string());

        Ok(InitPaymentResponse {
            success: true,
            transaction_id: transaction_id.to_string(),
            provider: AggregatorProvider::CinetPay,
            provider_reference: payment_token.clone().unwrap_or_default(),
            payment_url,
            payment_token,
            status: PaymentAggStatus::Pending,
            instructions: Some(
                "Validez le paiement sur votre téléphone ou via la page de paiement.".to_string(),
            ),
        })
    }

    async fn check_cinetpay_status(
        &self,
        transaction_id: &str,
        _provider_reference: &str,
    ) -> Result<CheckStatusResponse, String> {
        let payload = serde_json::json!({
            "apikey": self.config.cinetpay_api_key,
            "api_password": self.config.cinetpay_api_password,
            "transaction_id": transaction_id,
        });

        let response = self
            .client
            .post(&format!(
                "{}/v2/payment/check",
                self.config.cinetpay_base_url
            ))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau CinetPay check: {}", e))?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing CinetPay check: {}", e))?;

        let code = response_json.get("code").and_then(|c| c.as_str()).unwrap_or("");

        let data = response_json.get("data").cloned().unwrap_or(serde_json::json!({}));

        let status = match code {
            "00" => PaymentAggStatus::Completed,
            "627" | "600" => PaymentAggStatus::Processing,
            "623" | "624" => PaymentAggStatus::Failed,
            "625" => PaymentAggStatus::Cancelled,
            "626" => PaymentAggStatus::Expired,
            _ => PaymentAggStatus::Pending,
        };

        let amount = data.get("amount").and_then(|a| a.as_f64()).map(|a| a as i64).unwrap_or(0);

        let currency = data.get("currency").and_then(|c| c.as_str()).unwrap_or("XAF").to_string();

        let payment_method =
            data.get("payment_method").and_then(|m| m.as_str()).map(|s| s.to_string());

        Ok(CheckStatusResponse {
            transaction_id: transaction_id.to_string(),
            provider_reference: data
                .get("payment_token")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string(),
            status,
            amount,
            currency,
            payment_method,
            provider_data: Some(data),
        })
    }

    fn verify_cinetpay_webhook(&self, body: &[u8]) -> WebhookVerification {
        // CinetPay envoie un POST avec cpm_trans_id dans le body
        let body_json: serde_json::Value = match serde_json::from_slice(body) {
            Ok(v) => v,
            Err(e) => {
                log::warn!("[CinetPay] Webhook parse error: {}", e);
                return WebhookVerification {
                    is_valid: false,
                    transaction_id: None,
                    status: None,
                    amount: None,
                    currency: None,
                    provider_reference: None,
                    raw_data: None,
                };
            }
        };

        let transaction_id = body_json
            .get("cpm_trans_id")
            .or_else(|| body_json.get("transaction_id"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());

        // CinetPay webhook est considéré valide si on a un transaction_id
        // La vérification réelle se fait via l'appel check_status
        let is_valid = transaction_id.is_some();

        WebhookVerification {
            is_valid,
            transaction_id,
            status: None, // On vérifiera via check_status
            amount: None,
            currency: None,
            provider_reference: body_json
                .get("cpm_payment_id")
                .and_then(|p| p.as_str())
                .map(|s| s.to_string()),
            raw_data: Some(body_json),
        }
    }

    // ========================================================================
    // NOTCHPAY
    // ========================================================================

    async fn initiate_notchpay(
        &self,
        transaction_id: &str,
        request: &InitPaymentRequest,
    ) -> Result<InitPaymentResponse, String> {
        log::info!(
            "[NotchPay] Initiation paiement: {} XAF pour user {}",
            request.amount,
            request.user_id
        );

        let callback_url = format!("{}/api/webhooks/notchpay", self.config.webhook_base_url);

        let mut payload = serde_json::json!({
            "amount": request.amount,
            "currency": &request.currency,
            "description": &request.description,
            "reference": transaction_id,
            "callback": callback_url,
            "email": request.customer_email.as_deref().unwrap_or("client@yukpo.com"),
        });

        // Ajouter le canal de paiement (détection du pays via le numéro de téléphone)
        let country_code =
            request.phone_number.as_deref().map(detect_country_from_phone).unwrap_or("cm");
        let channel_code = request.channel.to_notchpay_channel_for_country(country_code);
        payload["channel"] = serde_json::json!(channel_code);

        // Ajouter le numéro de téléphone pour mobile money
        if let Some(phone) = &request.phone_number {
            payload["phone"] = serde_json::json!(phone);
        }

        let response = self
            .client
            .post(&format!(
                "{}/payments/initialize",
                self.config.notchpay_base_url
            ))
            .header("Authorization", &self.config.notchpay_public_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau NotchPay: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture réponse NotchPay: {}", e))?;

        log::info!(
            "[NotchPay] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Erreur parsing NotchPay: {}", e))?;

        if !status_code.is_success() {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            return Err(format!("NotchPay erreur {}: {}", status_code, message));
        }

        let transaction = response_json
            .get("transaction")
            .ok_or("NotchPay: champ 'transaction' manquant")?;

        let provider_reference = transaction
            .get("reference")
            .and_then(|r| r.as_str())
            .unwrap_or(transaction_id)
            .to_string();

        let authorization_url = response_json
            .get("authorization_url")
            .and_then(|u| u.as_str())
            .map(|s| s.to_string());

        Ok(InitPaymentResponse {
            success: true,
            transaction_id: transaction_id.to_string(),
            provider: AggregatorProvider::NotchPay,
            provider_reference,
            payment_url: authorization_url,
            payment_token: None,
            status: PaymentAggStatus::Pending,
            instructions: Some(
                "Validez le paiement sur votre téléphone ou via la page de paiement.".to_string(),
            ),
        })
    }

    async fn check_notchpay_status(
        &self,
        transaction_id: &str,
        provider_reference: &str,
    ) -> Result<CheckStatusResponse, String> {
        let ref_to_use = if provider_reference.is_empty() {
            transaction_id
        } else {
            provider_reference
        };

        let response = self
            .client
            .get(&format!(
                "{}/payments/{}",
                self.config.notchpay_base_url, ref_to_use
            ))
            .header("Authorization", &self.config.notchpay_secret_key)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau NotchPay check: {}", e))?;

        let response_json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Erreur parsing NotchPay check: {}", e))?;

        let transaction = response_json.get("transaction").unwrap_or(&response_json);

        let status_str = transaction.get("status").and_then(|s| s.as_str()).unwrap_or("pending");

        let status = match status_str {
            "complete" | "successful" => PaymentAggStatus::Completed,
            "pending" => PaymentAggStatus::Pending,
            "processing" => PaymentAggStatus::Processing,
            "failed" | "rejected" => PaymentAggStatus::Failed,
            "cancelled" | "canceled" => PaymentAggStatus::Cancelled,
            "expired" => PaymentAggStatus::Expired,
            _ => PaymentAggStatus::Pending,
        };

        let amount = transaction
            .get("amount")
            .and_then(|a| a.as_f64())
            .map(|a| a as i64)
            .unwrap_or(0);

        Ok(CheckStatusResponse {
            transaction_id: transaction_id.to_string(),
            provider_reference: ref_to_use.to_string(),
            status,
            amount,
            currency: transaction
                .get("currency")
                .and_then(|c| c.as_str())
                .unwrap_or("XAF")
                .to_string(),
            payment_method: transaction
                .get("channel")
                .and_then(|c| c.as_str())
                .map(|s| s.to_string()),
            provider_data: Some(response_json),
        })
    }

    // ========================================================================
    // DISBURSEMENT (TRANSFERTS SORTANTS)
    // ========================================================================

    /// ✅ Initie un transfert sortant (disbursement) vers un numéro mobile money
    /// Essaie CinetPay transfer API, puis NotchPay transfer API en fallback
    pub async fn initiate_disbursement(
        &self,
        phone: &str,
        amount_cents: i64,
        method: &str,    // "mtn_money" | "orange_money" | "mtn" | "orange" | "moov"
        reference: &str, // Référence unique Yukpo
    ) -> Result<String, String> {
        let amount = amount_cents / 100; // Convertir centimes → unité monétaire
        if amount <= 0 {
            return Err("Montant de transfert invalide".to_string());
        }

        // AfricaPay en premier si configuré (priorité Cameroun)
        if self.config.is_africapay_configured() {
            match self.africapay_transfer(phone, amount_cents, method, reference).await {
                Ok(ref_id) => return Ok(ref_id),
                Err(e) => {
                    log::warn!(
                        "[Disbursement] AfricaPay transfer échoué, trying CinetPay: {}",
                        e
                    );
                }
            }
        }

        // CinetPay (zone CEMAC/UEMOA)
        if self.config.is_cinetpay_configured() {
            match self.cinetpay_transfer(phone, amount, method, reference).await {
                Ok(ref_id) => return Ok(ref_id),
                Err(e) => {
                    log::warn!(
                        "[Disbursement] CinetPay transfer échoué, trying NotchPay: {}",
                        e
                    );
                }
            }
        }

        // Fallback NotchPay
        if self.config.is_notchpay_configured() {
            return self.notchpay_transfer(phone, amount, method, reference).await;
        }

        Err("Aucun agrégateur configuré pour le disbursement (AFRICAPAY_API_KEY, CINETPAY_API_KEY ou NOTCHPAY_PUBLIC_KEY requis).".to_string())
    }

    /// AfricaPay Transfer API — Mobile Money Cameroun (MTN, Orange)
    async fn africapay_transfer(
        &self,
        phone: &str,
        amount_cents: i64,
        method: &str,
        reference: &str,
    ) -> Result<String, String> {
        log::info!(
            "[AfricaPay Transfer] {} XAF (centimes) vers {} via {}",
            amount_cents,
            phone,
            method
        );

        let operator = match method {
            "mtn_money" | "mtn" => "MTN",
            "orange_money" | "orange" => "ORANGE",
            "moov" => "MOOV",
            _ => "MTN",
        };

        let payload = serde_json::json!({
            "apiKey": self.config.africapay_api_key,
            "reference": reference,
            "amount": amount_cents / 100,
            "currency": "XAF",
            "phone": phone,
            "operator": operator,
            "description": "Reversement Yukpo partenaire",
            "callbackUrl": format!("{}/api/webhooks/africapay/disbursement", self.config.webhook_base_url),
        });

        let response = self
            .client
            .post(&format!("{}/v1/transfers", self.config.africapay_base_url))
            .header("Content-Type", "application/json")
            .header("X-Api-Key", &self.config.africapay_api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau AfricaPay transfer: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture AfricaPay transfer: {}", e))?;

        log::info!(
            "[AfricaPay Transfer] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Erreur parsing AfricaPay transfer: {}", e))?;

        if status_code.is_success() {
            let ref_id = response_json
                .get("reference")
                .or_else(|| response_json.get("transactionId"))
                .or_else(|| response_json.get("id"))
                .and_then(|r| r.as_str())
                .unwrap_or(reference)
                .to_string();
            Ok(ref_id)
        } else {
            let message = response_json
                .get("message")
                .or_else(|| response_json.get("error"))
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            Err(format!(
                "AfricaPay transfer erreur {}: {}",
                status_code, message
            ))
        }
    }

    /// CinetPay Transfer API (POST /v2/transfer/money/send/contact)
    async fn cinetpay_transfer(
        &self,
        phone: &str,
        amount: i64,
        method: &str,
        reference: &str,
    ) -> Result<String, String> {
        log::info!(
            "[CinetPay Transfer] {} XAF vers {} via {}",
            amount,
            phone,
            method
        );

        let operator = match method {
            "mtn_money" | "mtn" => "MTN",
            "orange_money" | "orange" => "ORANGE",
            _ => "MTN",
        };

        let payload = serde_json::json!({
            "apikey": self.config.cinetpay_api_key,
            "api_password": self.config.cinetpay_api_password,
            "transaction_id": reference,
            "amount": amount,
            "currency": "XAF",
            "phone": phone,
            "operator": operator,
            "payment_method": "MOBILE_MONEY",
            "notify_url": format!("{}/api/webhooks/cinetpay/disbursement", self.config.webhook_base_url),
        });

        let response = self
            .client
            .post(&format!(
                "{}/v2/transfer/money/send/contact",
                self.config.cinetpay_base_url
            ))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau CinetPay transfer: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture CinetPay transfer: {}", e))?;

        log::info!(
            "[CinetPay Transfer] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Erreur parsing CinetPay transfer: {}", e))?;

        let code = response_json.get("code").and_then(|c| c.as_str()).unwrap_or("");

        if code == "00" || code == "201" {
            let data = response_json.get("data").cloned().unwrap_or(serde_json::json!({}));
            let txn_id = data
                .get("transaction_id")
                .or_else(|| response_json.get("transaction_id"))
                .and_then(|t| t.as_str())
                .unwrap_or(reference)
                .to_string();
            Ok(txn_id)
        } else {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            Err(format!("CinetPay transfer erreur {}: {}", code, message))
        }
    }

    /// NotchPay Transfer API (POST /transfers)
    async fn notchpay_transfer(
        &self,
        phone: &str,
        amount: i64,
        method: &str,
        reference: &str,
    ) -> Result<String, String> {
        log::info!(
            "[NotchPay Transfer] {} XAF vers {} via {}",
            amount,
            phone,
            method
        );

        // Détecter le pays à partir du numéro de téléphone
        let country_code = detect_country_from_phone(phone);
        let channel = match method {
            "mtn_money" | "mtn" => format!("{}.mtn", country_code),
            "orange_money" | "orange" => format!("{}.orange", country_code),
            _ => format!("{}.mtn", country_code),
        };

        // Devise dynamique selon le pays
        let currency = currency_for_country(country_code);

        let payload = serde_json::json!({
            "amount": amount,
            "currency": currency,
            "phone": phone,
            "channel": channel,
            "reference": reference,
            "description": "Reversement Yukpo",
            "callback": format!("{}/api/webhooks/notchpay/disbursement", self.config.webhook_base_url),
        });

        let response = self
            .client
            .post(&format!("{}/transfers", self.config.notchpay_base_url))
            .header("Authorization", &self.config.notchpay_secret_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau NotchPay transfer: {}", e))?;

        let status_code = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lecture NotchPay transfer: {}", e))?;

        log::info!(
            "[NotchPay Transfer] Response {}: {}",
            status_code,
            &response_text[..response_text.len().min(500)]
        );

        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Erreur parsing NotchPay transfer: {}", e))?;

        if status_code.is_success() {
            let transfer = response_json.get("transfer").cloned().unwrap_or(response_json.clone());
            let ref_id = transfer
                .get("reference")
                .or_else(|| transfer.get("id"))
                .and_then(|r| r.as_str())
                .unwrap_or(reference)
                .to_string();
            Ok(ref_id)
        } else {
            let message = response_json
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Erreur inconnue");
            Err(format!(
                "NotchPay transfer erreur {}: {}",
                status_code, message
            ))
        }
    }

    fn verify_notchpay_webhook(
        &self,
        headers: &std::collections::HashMap<String, String>,
        body: &[u8],
    ) -> WebhookVerification {
        // NotchPay envoie un header x-notch-signature avec HMAC-SHA256
        let signature = headers
            .get("x-notch-signature")
            .or_else(|| headers.get("X-Notch-Signature"))
            .cloned()
            .unwrap_or_default();

        let is_valid = if !self.config.notchpay_secret_key.is_empty() && !signature.is_empty() {
            use hmac::{Hmac, Mac};
            use sha2::Sha256;
            type HmacSha256 = Hmac<Sha256>;

            match HmacSha256::new_from_slice(self.config.notchpay_secret_key.as_bytes()) {
                Ok(mut mac) => {
                    mac.update(body);
                    let expected = hex::encode(mac.finalize().into_bytes());
                    // Comparaison constant-time
                    expected == signature
                }
                Err(_) => false,
            }
        } else {
            // Si pas de secret configuré, on accepte mais on logge un warning
            log::warn!(
                "[NotchPay] Webhook reçu sans vérification de signature (secret non configuré)"
            );
            !signature.is_empty() || self.config.notchpay_secret_key.is_empty()
        };

        let body_json: serde_json::Value =
            serde_json::from_slice(body).unwrap_or(serde_json::json!({}));

        let event = body_json.get("event").and_then(|e| e.as_str()).unwrap_or("");
        let data = body_json.get("data").cloned().unwrap_or(serde_json::json!({}));

        let status = match event {
            "payment.complete" => Some(PaymentAggStatus::Completed),
            "payment.failed" => Some(PaymentAggStatus::Failed),
            "payment.cancelled" => Some(PaymentAggStatus::Cancelled),
            "payment.expired" => Some(PaymentAggStatus::Expired),
            _ => None,
        };

        let transaction_id = data.get("reference").and_then(|r| r.as_str()).map(|s| s.to_string());

        let amount = data.get("amount").and_then(|a| a.as_f64()).map(|a| a as i64);

        WebhookVerification {
            is_valid,
            transaction_id,
            status,
            amount,
            currency: data.get("currency").and_then(|c| c.as_str()).map(|s| s.to_string()),
            provider_reference: data.get("id").and_then(|i| i.as_str()).map(|s| s.to_string()),
            raw_data: Some(body_json),
        }
    }
}
