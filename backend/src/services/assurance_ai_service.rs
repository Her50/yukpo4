//! ✅ Service IA pour Assurance
//!
//! Fonctionnalités :
//! - Génération de devis personnalisé (IA)
//! - Comparaison de produits d'assurance (IA)
//! - Recommandations personnalisées (IA)
//! - Estimation de prime (IA)

use crate::core::types::{AppError, AppResult};
use crate::services::app_ia::AppIA;
use log::info;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Profil assuré pour personnalisation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsuranceProfile {
    pub age: Option<i32>,
    pub profession: Option<String>,
    pub ville: Option<String>,
    pub situation_familiale: Option<String>,
    pub nombre_personnes: Option<i32>,
    pub budget_mensuel: Option<f64>,
    pub vehicule_type: Option<String>,
    pub vehicule_valeur: Option<f64>,
    pub bien_immobilier_type: Option<String>,
    pub bien_immobilier_valeur: Option<f64>,
}

/// Devis généré par IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsuranceQuote {
    pub type_assurance: String,
    pub produit: String,
    pub compagnie_suggeree: String,
    pub prime_mensuelle_estimee: f64,
    pub prime_annuelle_estimee: f64,
    pub couvertures_incluses: Vec<String>,
    pub franchises: Vec<FranchiseDetail>,
    pub avantages: Vec<String>,
    pub conditions: Vec<String>,
    pub score_adequation: f64,
    pub justification: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FranchiseDetail {
    pub garantie: String,
    pub montant: String,
}

/// Comparaison de produits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsuranceComparison {
    pub produits: Vec<ComparedProduct>,
    pub recommandation: String,
    pub meilleur_rapport_qualite_prix: String,
    pub meilleure_couverture: String,
    pub criteres_comparaison: Vec<ComparisonCriteria>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparedProduct {
    pub nom: String,
    pub compagnie: String,
    pub prime_annuelle: f64,
    pub couvertures: Vec<String>,
    pub note_globale: f64,
    pub points_forts: Vec<String>,
    pub points_faibles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonCriteria {
    pub critere: String,
    pub poids: f64,
}

/// Recommandation IA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsuranceRecommendation {
    pub type_assurance: String,
    pub produit_recommande: String,
    pub compagnie: String,
    pub prime_estimee: f64,
    pub score: f64,
    pub raison: String,
    pub couvertures_cles: Vec<String>,
}

pub struct AssuranceAIService {
    app_ia: Arc<AppIA>,
}

/// Nettoie la réponse JSON (enlève markdown code blocks) - version publique
pub fn clean_json_response_pub(response: &str) -> String {
    clean_json_response(response)
}

/// Nettoie la réponse JSON (enlève markdown code blocks)
fn clean_json_response(response: &str) -> String {
    let trimmed = response.trim();
    let without_prefix = if trimmed.starts_with("```json") {
        &trimmed[7..]
    } else if trimmed.starts_with("```") {
        &trimmed[3..]
    } else {
        trimmed
    };
    let without_suffix = if without_prefix.trim_end().ends_with("```") {
        &without_prefix.trim_end()[..without_prefix.trim_end().len() - 3]
    } else {
        without_prefix
    };
    without_suffix.trim().to_string()
}

impl AssuranceAIService {
    pub fn new(app_ia: Arc<AppIA>) -> Self {
        Self { app_ia }
    }

    /// Génère un devis d'assurance personnalisé avec IA
    pub async fn generate_quote(
        &self,
        type_assurance: &str,
        profile: &InsuranceProfile,
        couvertures_souhaitees: &[String],
    ) -> AppResult<InsuranceQuote> {
        let couvertures_str = if couvertures_souhaitees.is_empty() {
            "toutes couvertures standards".to_string()
        } else {
            couvertures_souhaitees.join(", ")
        };

        let prompt = format!(
            r#"
Tu es un expert en assurance africaine (spécialité Cameroun et Afrique Centrale).

DEMANDE DE DEVIS :
- Type d'assurance : {}
- Âge : {}
- Profession : {}
- Ville : {}
- Situation familiale : {}
- Nombre de personnes couvertes : {}
- Budget mensuel max : {} FCFA
- Véhicule (si auto) : type={}, valeur={} FCFA
- Bien immobilier (si habitation) : type={}, valeur={} FCFA
- Couvertures souhaitées : {}

Génère un devis réaliste basé sur les tarifs du marché camerounais.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "type_assurance": "{}",
    "produit": "Nom du produit recommandé",
    "compagnie_suggeree": "Nom compagnie",
    "prime_mensuelle_estimee": 15000.0,
    "prime_annuelle_estimee": 170000.0,
    "couvertures_incluses": ["Responsabilité civile", "Vol", ...],
    "franchises": [{{"garantie": "Vol", "montant": "50 000 FCFA"}}],
    "avantages": ["Assistance 24h/24", ...],
    "conditions": ["Âge minimum 18 ans", ...],
    "score_adequation": 0.92,
    "justification": "Ce produit est adapté car..."
}}
"#,
            type_assurance,
            profile.age.map(|a| a.to_string()).unwrap_or("Non précisé".into()),
            profile.profession.as_deref().unwrap_or("Non précisé"),
            profile.ville.as_deref().unwrap_or("Non précisé"),
            profile.situation_familiale.as_deref().unwrap_or("Non précisé"),
            profile.nombre_personnes.unwrap_or(1),
            profile
                .budget_mensuel
                .map(|b| format!("{:.0}", b))
                .unwrap_or("Non précisé".into()),
            profile.vehicule_type.as_deref().unwrap_or("N/A"),
            profile.vehicule_valeur.map(|v| format!("{:.0}", v)).unwrap_or("N/A".into()),
            profile.bien_immobilier_type.as_deref().unwrap_or("N/A"),
            profile
                .bien_immobilier_valeur
                .map(|v| format!("{:.0}", v))
                .unwrap_or("N/A".into()),
            couvertures_str,
            type_assurance,
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        info!(
            "[AssuranceAIService] Devis généré avec {} (tokens: {})",
            model_name, tokens
        );

        let cleaned = clean_json_response(&response);
        let quote: InsuranceQuote = serde_json::from_str(&cleaned).map_err(|e| {
            log::error!(
                "[AssuranceAIService] Erreur parsing devis: {} - réponse: {}",
                e,
                cleaned
            );
            AppError::Internal(format!("Erreur parsing devis IA: {}", e))
        })?;

        Ok(quote)
    }

    /// Compare plusieurs produits d'assurance avec IA
    pub async fn compare_products(
        &self,
        type_assurance: &str,
        produits: &[String],
        profile: &InsuranceProfile,
    ) -> AppResult<InsuranceComparison> {
        let produits_str = produits.join(", ");

        let prompt = format!(
            r#"
Tu es un expert en assurance africaine (spécialité Cameroun).

COMPARAISON DEMANDÉE :
- Type : {}
- Produits à comparer : {}
- Profil utilisateur : âge={}, ville={}, budget={}

Compare ces produits d'assurance selon : prix, couvertures, franchises, service client, réseau agréé.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "produits": [
        {{
            "nom": "Produit 1",
            "compagnie": "Compagnie",
            "prime_annuelle": 200000.0,
            "couvertures": ["RC", "Vol", ...],
            "note_globale": 8.5,
            "points_forts": ["Bon rapport qualité/prix"],
            "points_faibles": ["Franchise élevée"]
        }}
    ],
    "recommandation": "Nous recommandons le produit X car...",
    "meilleur_rapport_qualite_prix": "Produit 1",
    "meilleure_couverture": "Produit 2",
    "criteres_comparaison": [
        {{"critere": "Prix", "poids": 0.3}},
        {{"critere": "Couvertures", "poids": 0.3}},
        {{"critere": "Service client", "poids": 0.2}},
        {{"critere": "Réseau agréé", "poids": 0.2}}
    ]
}}
"#,
            type_assurance,
            produits_str,
            profile.age.map(|a| a.to_string()).unwrap_or("N/A".into()),
            profile.ville.as_deref().unwrap_or("N/A"),
            profile.budget_mensuel.map(|b| format!("{:.0} FCFA", b)).unwrap_or("N/A".into()),
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        info!(
            "[AssuranceAIService] Comparaison générée avec {} (tokens: {})",
            model_name, tokens
        );

        let cleaned = clean_json_response(&response);
        let comparison: InsuranceComparison = serde_json::from_str(&cleaned).map_err(|e| {
            log::error!(
                "[AssuranceAIService] Erreur parsing comparaison: {} - réponse: {}",
                e,
                cleaned
            );
            AppError::Internal(format!("Erreur parsing comparaison IA: {}", e))
        })?;

        Ok(comparison)
    }

    /// Recommande des assurances personnalisées avec IA
    pub async fn get_recommendations(
        &self,
        profile: &InsuranceProfile,
        limit: usize,
    ) -> AppResult<Vec<InsuranceRecommendation>> {
        let prompt = format!(
            r#"
Tu es un conseiller en assurance africaine expert.

PROFIL CLIENT :
- Âge : {}
- Profession : {}
- Ville : {}
- Situation familiale : {}
- Nombre de personnes : {}
- Budget mensuel : {} FCFA
- Véhicule : {}
- Bien immobilier : {}

Recommande les {} assurances les plus pertinentes pour ce profil, en tenant compte du contexte camerounais.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "recommendations": [
        {{
            "type_assurance": "Auto",
            "produit_recommande": "Tous risques Standard",
            "compagnie": "ACTIVA Assurances",
            "prime_estimee": 180000.0,
            "score": 0.95,
            "raison": "Indispensable pour votre véhicule...",
            "couvertures_cles": ["RC", "Vol", "Incendie", "Bris de glace"]
        }}
    ]
}}
"#,
            profile.age.map(|a| a.to_string()).unwrap_or("Non précisé".into()),
            profile.profession.as_deref().unwrap_or("Non précisé"),
            profile.ville.as_deref().unwrap_or("Non précisé"),
            profile.situation_familiale.as_deref().unwrap_or("Non précisé"),
            profile.nombre_personnes.unwrap_or(1),
            profile
                .budget_mensuel
                .map(|b| format!("{:.0}", b))
                .unwrap_or("Non précisé".into()),
            profile.vehicule_type.as_deref().unwrap_or("Aucun"),
            profile.bien_immobilier_type.as_deref().unwrap_or("Aucun"),
            limit,
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        info!(
            "[AssuranceAIService] Recommandations générées avec {} (tokens: {})",
            model_name, tokens
        );

        let cleaned = clean_json_response(&response);
        let result: serde_json::Value = serde_json::from_str(&cleaned).unwrap_or_default();
        let recommendations: Vec<InsuranceRecommendation> = result
            .get("recommendations")
            .and_then(|r| r.as_array())
            .map(|arr| arr.iter().filter_map(|v| serde_json::from_value(v.clone()).ok()).collect())
            .unwrap_or_default();

        Ok(recommendations)
    }

    /// Estime la prime d'assurance pour un profil donné
    pub async fn estimate_premium(
        &self,
        type_assurance: &str,
        produit: &str,
        profile: &InsuranceProfile,
    ) -> AppResult<PremiumEstimate> {
        let prompt = format!(
            r#"
Tu es un actuaire spécialisé dans le marché africain de l'assurance.

ESTIMATION DE PRIME DEMANDÉE :
- Type : {}
- Produit : {}
- Âge : {}
- Profession : {}
- Ville : {}
- Véhicule : type={}, valeur={} FCFA
- Bien immobilier : type={}, valeur={} FCFA

Estime les primes mensuelles et annuelles réalistes pour le marché camerounais.

RÉPONSE ATTENDUE (JSON strict) :
{{
    "prime_mensuelle_min": 10000.0,
    "prime_mensuelle_max": 25000.0,
    "prime_mensuelle_moyenne": 15000.0,
    "prime_annuelle_min": 110000.0,
    "prime_annuelle_max": 280000.0,
    "prime_annuelle_moyenne": 170000.0,
    "facteurs_prix": ["Âge du conducteur", "Zone géographique", ...],
    "conseils_economie": ["Installer un traceur GPS pour réduction", ...],
    "compagnies_recommandees": ["ACTIVA", "AXA Cameroun", ...]
}}
"#,
            type_assurance,
            produit,
            profile.age.map(|a| a.to_string()).unwrap_or("N/A".into()),
            profile.profession.as_deref().unwrap_or("N/A"),
            profile.ville.as_deref().unwrap_or("N/A"),
            profile.vehicule_type.as_deref().unwrap_or("N/A"),
            profile.vehicule_valeur.map(|v| format!("{:.0}", v)).unwrap_or("N/A".into()),
            profile.bien_immobilier_type.as_deref().unwrap_or("N/A"),
            profile
                .bien_immobilier_valeur
                .map(|v| format!("{:.0}", v))
                .unwrap_or("N/A".into()),
        );

        let (model_name, response, tokens) = self.app_ia.predict(&prompt).await?;
        info!(
            "[AssuranceAIService] Estimation prime avec {} (tokens: {})",
            model_name, tokens
        );

        let cleaned = clean_json_response(&response);
        let estimate: PremiumEstimate = serde_json::from_str(&cleaned).map_err(|e| {
            log::error!(
                "[AssuranceAIService] Erreur parsing estimation: {} - réponse: {}",
                e,
                cleaned
            );
            AppError::Internal(format!("Erreur parsing estimation IA: {}", e))
        })?;

        Ok(estimate)
    }
}

/// Estimation de prime
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PremiumEstimate {
    pub prime_mensuelle_min: f64,
    pub prime_mensuelle_max: f64,
    pub prime_mensuelle_moyenne: f64,
    pub prime_annuelle_min: f64,
    pub prime_annuelle_max: f64,
    pub prime_annuelle_moyenne: f64,
    pub facteurs_prix: Vec<String>,
    pub conseils_economie: Vec<String>,
    pub compagnies_recommandees: Vec<String>,
}
