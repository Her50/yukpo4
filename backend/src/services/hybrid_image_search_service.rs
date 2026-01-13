// 🔍 Service de recherche hybride intelligente par image
// Combine analyse IA + recherche vectorielle + matching multi-critères
// Stocke les analyses pour amélioration continue

use crate::core::types::{AppError, AppResult};
use crate::services::intelligent_image_analysis_service::{AICost, ImageAnalysis, IntelligentImageAnalysisService};
use crate::services::app_ia::AppIA;
use crate::utils::log::{log_error, log_info, log_warn};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridSearchResult {
    pub service_id: i32,
    pub analysis_id: Option<i32>,
    pub media_id: Option<i32>,
    pub product_description: String,
    pub product_tags: Vec<String>,
    pub product_marque: Option<String>,
    pub product_couleurs: Vec<String>,
    pub match_score: f32,
    pub distance_km: Option<f32>,
    pub service_data: Value,
}

pub struct HybridImageSearchService {
    pool: PgPool,
}

impl HybridImageSearchService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// ✅ NOUVEAU: Valider la structure JSON générée par l'IA
    fn validate_ia_json(data_obj: &Value) -> AppResult<()> {
        // Vérifier les 5 champs obligatoires
        let required_fields = ["titre_service", "category", "description", "is_tarissable", "type_offre"];
        let mut missing_fields = Vec::new();
        
        for field in &required_fields {
            if !data_obj.get(field).is_some() {
                missing_fields.push(*field);
            }
        }
        
        if !missing_fields.is_empty() {
            return Err(AppError::Internal(format!(
                "Champs obligatoires manquants dans JSON IA: {}",
                missing_fields.join(", ")
            )));
        }
        
        // Vérifier que type_offre a la bonne structure
        if let Some(type_offre) = data_obj.get("type_offre") {
            let valeur = if let Some(obj) = type_offre.as_object() {
                obj.get("valeur").and_then(|v| v.as_str())
            } else {
                type_offre.as_str()
            };
            
            if let Some(val) = valeur {
                if val != "produit" && val != "prestation" {
                    return Err(AppError::Internal(format!(
                        "type_offre invalide: '{}' (attendu: 'produit' ou 'prestation')",
                        val
                    )));
                }
            }
        }
        
        // Vérifier structure produits si présent
        if let Some(produits) = data_obj.get("produits") {
            if let Some(prod_obj) = produits.as_object() {
                // Vérifier type_donnee
                if let Some(type_donnee) = prod_obj.get("type_donnee").and_then(|t| t.as_str()) {
                    if type_donnee != "autocomplete" {
                        log_warn(&format!(
                            "[HybridImageSearch] ⚠️ produits.type_donnee = '{}' (attendu: 'autocomplete')",
                            type_donnee
                        ));
                    }
                }
                
                // Vérifier sous_caracteristiques
                if let Some(sous_caracs) = prod_obj.get("sous_caracteristiques") {
                    if let Some(obj) = sous_caracs.as_object() {
                        let count = obj.len();
                        if count < 6 {
                            log_warn(&format!(
                                "[HybridImageSearch] ⚠️ sous_caracteristiques a seulement {} caractéristiques (minimum recommandé: 6-8)",
                                count
                            ));
                        }
                    }
                } else {
                    log_warn("[HybridImageSearch] ⚠️ produits.sous_caracteristiques manquant");
                }
            }
        }
        
        Ok(())
    }

    /// Stocker une analyse d'image en base de données
    pub async fn store_image_analysis(
        &self,
        service_id: Option<i32>,
        media_id: Option<i32>,
        user_id: i32,
        analysis: &ImageAnalysis,
        cost: &AICost,
        analysis_type: &str, // "search" ou "cataloging"
    ) -> AppResult<i32> {
        log_info(&format!(
            "[HybridImageSearch] 💾 Stockage analyse {} - Service: {:?}, User: {}",
            analysis_type, service_id, user_id
        ));

        let caracteristiques_json = serde_json::to_value(&analysis.caracteristiques_cles)
            .map_err(|e| AppError::Internal(format!("Erreur conversion JSON: {}", e)))?;

        let result = sqlx::query(
            r#"
            INSERT INTO image_analyses (
                service_id, media_id, user_id,
                description, tags, category_detected, marque, couleurs,
                caracteristiques_cles,
                search_query_exact, search_query_broad, search_query_semantic,
                confiance, model_used, tokens_consumed, cost_usd,
                analysis_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id
            "#
        )
        .bind(service_id)
        .bind(media_id)
        .bind(user_id)
        .bind(&analysis.description)
        .bind(&analysis.tags)
        .bind(&analysis.category_detected)
        .bind(&analysis.marque)
        .bind(&analysis.couleurs)
        .bind(caracteristiques_json)
        .bind(&analysis.search_query)
        .bind(&analysis.search_query)
        .bind(&analysis.search_query)
        .bind(analysis.confiance)
        .bind(&cost.model_used)
        .bind(cost.total_tokens as i32)
        .bind(cost.cost_usd)
        .bind(analysis_type)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            log_error(&format!("[HybridImageSearch] Erreur stockage analyse: {}", e));
            AppError::Internal(format!("Erreur stockage analyse: {}", e))
        })?;

        let analysis_id: i32 = result.get("id");

        log_info(&format!(
            "[HybridImageSearch] ✅ Analyse stockée avec ID: {}",
            analysis_id
        ));

        Ok(analysis_id)
    }

    /// ✅ CORRECTION 2025-11-01: Analyser l'image avec le MÊME prompt que la création pour matching optimal
    async fn analyze_image_like_creation(
        app_ia: &AppIA,
        image_base64: &str,
    ) -> AppResult<(ImageAnalysis, AICost)> {
        use crate::utils::log::log_info;
        
        log_info("[HybridImageSearch] 🔍 Analyse image avec prompt de recherche dédié...");
        
        // ✅ OPTIMISATION 2025-12-23: Utiliser prompt optimisé (100 lignes vs 1178) pour réduire temps traitement IA
        // Le prompt optimisé garde toutes les règles essentielles mais élimine les répétitions
        let search_prompt = match tokio::fs::read_to_string("backend/ia_prompts/recherche_image_prompt_optimized.md").await {
            Ok(content) => {
                log_info("[HybridImageSearch] ✅ Prompt optimisé chargé depuis fichier (~100 lignes)");
                content
            },
            Err(_) => {
                // Fallback vers prompt optimisé embedded
                match include_str!("../../ia_prompts/recherche_image_prompt_optimized.md") {
                    embedded if !embedded.is_empty() => {
                        log_info("[HybridImageSearch] ✅ Prompt optimisé chargé depuis embedded");
                        embedded.to_string()
                    },
                    _ => {
                        log_warn("[HybridImageSearch] ⚠️ Prompt optimisé non trouvé, fallback vers prompt complet");
                        // Dernier fallback vers prompt complet si optimisé non disponible
                        tokio::fs::read_to_string("backend/ia_prompts/recherche_image_prompt.md").await
                            .unwrap_or_else(|_| include_str!("../../ia_prompts/recherche_image_prompt.md").to_string())
                    }
                }
            }
        };

        // ✅ CORRECTION: Préparer l'image exactement comme lors de la création
        // Lors de la création, input.base64_image est un Option<Vec<String>> où chaque string est base64 pur
        // predict_multimodal formate automatiquement avec "data:image/jpeg;base64,{}" dans call_openai_multimodal
        // Donc on passe juste le base64 pur, comme lors de la création
        let image_base64_pure = if image_base64.starts_with("http://") || image_base64.starts_with("https://") {
            // URL directe - passer tel quel (rare cas)
            image_base64.to_string()
        } else if image_base64.starts_with("data:") {
            // Data URI - extraire le base64 pur pour être cohérent avec la création
            image_base64.split("base64,").nth(1).unwrap_or(image_base64).to_string()
        } else {
            // Base64 pur - passer tel quel (format attendu comme lors de la création)
            image_base64.to_string()
        };

        // ✅ Appeler l'IA avec le même format que la création (base64 pur dans Vec)
        // ✅ CORRECTION : L'ordre de retour est (model_name, response, tokens)
        let (model_name, json_response, tokens_used) = app_ia.predict_multimodal(
            &search_prompt,
            Some(vec![image_base64_pure])
        ).await?;

        // Parser le JSON
        let cleaned_json = json_response
            .replace("```json", "")
            .replace("```", "")
            .trim()
            .to_string();
        
        let parsed_json: serde_json::Value = serde_json::from_str(&cleaned_json)
            .map_err(|e| {
                log_error(&format!("[HybridImageSearch] ❌ Erreur parsing JSON brut: {}", e));
                log_error(&format!("[HybridImageSearch] JSON reçu (premiers 500 chars): {}", &cleaned_json.chars().take(500).collect::<String>()));
                crate::core::types::AppError::Internal(format!("Erreur parsing JSON: {}", e))
            })?;

        // ✅ NOUVEAU 2025-11-01: Parser le JSON au format création (avec data ou directement)
        let data_obj = parsed_json.get("data").unwrap_or(&parsed_json);
        
        // ✅ NOUVEAU 2025-12-24: Logs détaillés pour debug pertinence
        log_info(&format!(
            "[HybridImageSearch] 📋 JSON IA reçu (premiers 1000 chars): {}",
            &serde_json::to_string(data_obj).unwrap_or_default().chars().take(1000).collect::<String>()
        ));
        
        // ✅ NOUVEAU 2025-12-23: Valider la structure JSON avant extraction
        if let Err(e) = Self::validate_ia_json(data_obj) {
            log_error(&format!("[HybridImageSearch] ❌ Validation JSON échouée: {}", e));
            // Continue quand même avec des valeurs par défaut, mais log l'erreur
            log_warn("[HybridImageSearch] ⚠️ Continuation avec valeurs par défaut malgré erreur validation");
        } else {
            log_info("[HybridImageSearch] ✅ Validation JSON réussie");
        }
        
        // Extraire category (au niveau service)
        let category_str = data_obj.get("category")
            .and_then(|c| {
                if let Some(obj) = c.as_object() {
                    obj.get("valeur").and_then(|v| v.as_str())
                } else {
                    c.as_str()
                }
            })
            .unwrap_or("autre");

        // ✅ Extraire nom_produit, categorie_produit, description_produit (format création)
        let nom_produit = data_obj.get("nom_produit")
            .and_then(|n| {
                if let Some(obj) = n.as_object() {
                    obj.get("valeur").and_then(|v| v.as_str())
                } else {
                    n.as_str()
                }
            })
            .unwrap_or("");
            
        let description_produit = data_obj.get("description_produit")
            .and_then(|d| {
                if let Some(obj) = d.as_object() {
                    obj.get("valeur").and_then(|v| v.as_str())
                } else {
                    d.as_str()
                }
            })
            .unwrap_or(nom_produit);

        // ✅ NOUVEAU: Extraire depuis autocomplete.valeur (format: ["Logitech,MX Master 3,Sans fil,Noir"])
        let produits_autocomplete = data_obj.get("produits");
        let mut marque: Option<String> = None;
        let mut _modele: Option<String> = None;
        let mut couleurs: Vec<String> = Vec::new();
        let mut tags: Vec<String> = Vec::new();

        // ✅ NOUVEAU: Fonction helper pour normaliser les tags (minuscules, trim, suppression accents partielle)
        fn normalize_tag(tag: &str) -> String {
            tag.trim()
                .to_lowercase()
                .chars()
                .map(|c| match c {
                    'à' | 'á' | 'â' | 'ã' | 'ä' => 'a',
                    'è' | 'é' | 'ê' | 'ë' => 'e',
                    'ì' | 'í' | 'î' | 'ï' => 'i',
                    'ò' | 'ó' | 'ô' | 'õ' | 'ö' => 'o',
                    'ù' | 'ú' | 'û' | 'ü' => 'u',
                    'ç' => 'c',
                    'ñ' => 'n',
                    _ => c,
                })
                .collect::<String>()
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        }

        // Parser l'autocomplete si présent
        if let Some(prod_obj) = produits_autocomplete.and_then(|p| p.as_object()) {
            // Extraire valeur autocomplete
            if let Some(valeur_arr) = prod_obj.get("valeur").and_then(|v| v.as_array()) {
                if let Some(first_val) = valeur_arr.first().and_then(|v| v.as_str()) {
                    // Parser "Logitech,MX Master 3,Sans fil,Noir"
                    let parts: Vec<&str> = first_val.split(',').map(|s| s.trim()).collect();
                    for part in parts {
                        let normalized = normalize_tag(part);
                        if !normalized.is_empty() && !tags.contains(&normalized) {
                            tags.push(normalized);
                        }
                    }
                }
            }
            
            // ✅ CRITIQUE: Extraire depuis sous_caracteristiques
            if let Some(sous_caracs) = prod_obj.get("sous_caracteristiques").and_then(|sc| sc.as_object()) {
                log_info(&format!(
                    "[HybridImageSearch] 📦 sous_caracteristiques trouvé avec {} clés",
                    sous_caracs.len()
                ));
                
                // Marque
                if let Some(marques_arr) = sous_caracs.get("marque").or_else(|| sous_caracs.get("brand")).and_then(|m| m.as_array()) {
                    marque = marques_arr.first().and_then(|v| v.as_str()).map(|s| normalize_tag(s));
                    for val in marques_arr.iter().filter_map(|v| v.as_str()) {
                        let normalized = normalize_tag(val);
                        if !normalized.is_empty() && !tags.contains(&normalized) {
                            tags.push(normalized.clone());
                        }
                    }
                }
                
                // Modèle
                if let Some(modeles_arr) = sous_caracs.get("modele").or_else(|| sous_caracs.get("model")).and_then(|m| m.as_array()) {
                    _modele = modeles_arr.first().and_then(|v| v.as_str()).map(|s| normalize_tag(s));
                    for val in modeles_arr.iter().filter_map(|v| v.as_str()) {
                        let normalized = normalize_tag(val);
                        if !normalized.is_empty() && !tags.contains(&normalized) {
                            tags.push(normalized);
                        }
                    }
                }
                
                // Couleurs
                if let Some(couleurs_arr) = sous_caracs.get("couleur").or_else(|| sous_caracs.get("color")).and_then(|c| c.as_array()) {
                    couleurs = couleurs_arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| normalize_tag(s))
                        .filter(|s| !s.is_empty())
                        .collect();
                    for couleur in &couleurs {
                        if !tags.contains(couleur) {
                            tags.push(couleur.clone());
                        }
                    }
                }
                
                // Ajouter toutes les autres caractéristiques aux tags
                for (_key, value) in sous_caracs.iter() {
                    if let Some(vals) = value.as_array() {
                        for val in vals.iter().filter_map(|v| v.as_str()) {
                            let normalized = normalize_tag(val);
                            if !normalized.is_empty() && !tags.contains(&normalized) {
                                tags.push(normalized);
                            }
                        }
                    }
                }
            } else {
                log_warn("[HybridImageSearch] ⚠️ produits.sous_caracteristiques manquant - extraction depuis autres sources");
                
                // ✅ FALLBACK: Extraire depuis description_produit et nom_produit si sous_caracteristiques manquant
                if !description_produit.is_empty() {
                    // Extraire mots-clés de la description
                    let words: Vec<&str> = description_produit.split_whitespace().collect();
                    for word in words.iter().take(10) { // Limiter à 10 mots pour éviter trop de tags
                        let normalized = normalize_tag(word);
                        if normalized.len() > 2 && !tags.contains(&normalized) { // Ignorer mots trop courts
                            tags.push(normalized);
                        }
                    }
                }
            }
        } else {
            log_warn("[HybridImageSearch] ⚠️ produits manquant dans JSON IA");
        }

        let nom = if !nom_produit.is_empty() { 
            normalize_tag(&nom_produit)
        } else { 
            "produit recherche".to_string() 
        };
        let description = if !description_produit.is_empty() { 
            description_produit.to_string() 
        } else { 
            nom.clone() 
        };
        let categorie = normalize_tag(&category_str);

        // ✅ Tags déjà construits lors du parsing autocomplete ci-dessus
        // Ajouter nom et catégorie si pas déjà présents
        if !tags.contains(&nom) {
            tags.push(nom.clone());
        }
        if !tags.contains(&categorie) {
            tags.push(categorie.clone());
        }
        
        // ✅ NOUVEAU: Logs détaillés des tags extraits
        log_info(&format!(
            "[HybridImageSearch] 🏷️ Tags extraits ({}): {:?}",
            tags.len(),
            &tags.iter().take(15).map(|s| s.as_str()).collect::<Vec<_>>().join(", ")
        ));

        // Construire les requêtes de recherche
        let search_query_exact = format!("{} {} {}", 
            marque.as_ref().unwrap_or(&String::new()),
            nom,
            couleurs.first().unwrap_or(&String::new())
        ).trim().to_string();

        let search_query_broad = format!("{} {} {} {} {}", 
            categorie,
            nom,
            marque.as_ref().unwrap_or(&String::new()),
            couleurs.join(" "),
            description.chars().take(30).collect::<String>()
        ).trim().to_string();

        let search_query_semantic = description.clone();

        // Construire ImageAnalysis compatible
        let analysis = ImageAnalysis {
            description,
            tags: tags.clone(),
            category_detected: categorie.clone(),
            marque: marque.clone(),
            couleurs: couleurs.clone(),
            caracteristiques_cles: std::collections::HashMap::new(),
            confiance: 0.95,
            search_query: search_query_exact.clone(),
        };

        // Calculer le coût
        let cost = AICost {
            cost_usd: (tokens_used as f64) * 0.00001, // Estimation
            total_tokens: tokens_used,
            prompt_tokens: tokens_used / 2,
            completion_tokens: tokens_used / 2,
            model_used: model_name,
        };

        // ✅ NOUVEAU 2025-12-24: Logs détaillés pour debug pertinence
        log_info(&format!(
            "[HybridImageSearch] ✅ Analyse complétée:\n  - Description: '{}'\n  - Catégorie: '{}'\n  - Marque: {:?}\n  - Couleurs: {:?}\n  - Tags ({}): {:?}\n  - Query exact: '{}'\n  - Query broad: '{}'\n  - Query semantic: '{}'",
            &analysis.description[..analysis.description.len().min(100)],
            categorie,
            marque,
            couleurs,
            tags.len(),
            &tags.iter().take(15).map(|s| s.as_str()).collect::<Vec<_>>().join(", "),
            &search_query_exact[..search_query_exact.len().min(60)],
            &search_query_broad[..search_query_broad.len().min(80)],
            &search_query_semantic[..search_query_semantic.len().min(100)]
        ));
        
        // ✅ NOUVEAU: Logs supplémentaires pour debug matching
        if tags.len() < 3 {
            log_warn(&format!(
                "[HybridImageSearch] ⚠️ ATTENTION: Seulement {} tags extraits (minimum recommandé: 3-5 pour bon matching)",
                tags.len()
            ));
        }

        Ok((analysis, cost))
    }

    /// Recherche hybride: Analyse l'image de recherche + Compare avec analyses stockées
    /// ✅ FALLBACK: Utilise signatures vectorielles si l'analyse IA échoue
    pub async fn search_by_image(
        &self,
        app_ia: &AppIA,
        image_base64: &str,
        user_id: i32,
        category_filter: Option<&str>,
        gps_lat: Option<f64>,
        gps_lng: Option<f64>,
        search_radius_km: Option<i32>,
        max_results: i32,
    ) -> AppResult<(Vec<HybridSearchResult>, ImageAnalysis, AICost)> {
        log_info("[HybridImageSearch] 🔍 Recherche hybride par image");

        // ✅ CORRECTION: Utiliser le MÊME système d'analyse que la création
        log_info("[HybridImageSearch] Étape 1/3: Analyse IA avec système création...");
        let analysis_result = Self::analyze_image_like_creation(app_ia, image_base64).await;
        
        // ✅ FALLBACK: Si l'analyse IA échoue, utiliser signatures vectorielles
        let (analysis, cost) = match analysis_result {
            Ok((analysis, cost)) => {
                log_info(&format!(
                    "[HybridImageSearch] ✅ Analyse IA réussie: '{}' (confiance: {:.2})",
                    &analysis.description[..analysis.description.len().min(50)],
                    analysis.confiance
                ));
                (analysis, cost)
            }
            Err(e) => {
                log_warn(&format!(
                    "[HybridImageSearch] ⚠️ Analyse IA échouée: {} - Fallback vers signatures vectorielles",
                    e
                ));
                
                // Fallback: Utiliser signatures vectorielles
                return self.search_by_image_signature_fallback(
                    image_base64,
                    category_filter,
                    gps_lat,
                    gps_lng,
                    search_radius_km,
                    max_results,
                ).await;
            }
        };

        log_info(&format!(
            "[HybridImageSearch] ✅ Analyse complétée: '{}' (confiance: {:.2})",
            &analysis.description[..analysis.description.len().min(50)],
            analysis.confiance
        ));

        // 2️⃣ Stocker l'analyse de recherche pour analytics
        log_info("[HybridImageSearch] Étape 2/3: Stockage analyse recherche...");
        let _analysis_id = self
            .store_image_analysis(None, None, user_id, &analysis, &cost, "search")
            .await
            .map_err(|e| {
                log_warn(&format!("Impossible de stocker analyse recherche: {}", e));
                e
            })
            .ok(); // Ne pas bloquer si erreur de stockage

        // 3️⃣ Rechercher avec la fonction SQL hybride
        log_info("[HybridImageSearch] Étape 3/3: Recherche dans les produits catalogués...");
        let results = self
            .hybrid_sql_search(
                &analysis,
                category_filter,
                gps_lat,
                gps_lng,
                search_radius_km,
                max_results,
                Some(user_id),  // ✅ NOUVEAU: Passer user_id pour récupérer preferred_lang
            )
            .await?;

        // ✅ NOUVEAU 2025-12-24: Logs détaillés des résultats pour debug pertinence
        if !results.is_empty() {
            log_info(&format!(
                "[HybridImageSearch] ✅ Trouvé {} résultats (seuil: 150.0)",
                results.len()
            ));
            for (i, result) in results.iter().take(5).enumerate() {
                log_info(&format!(
                    "[HybridImageSearch]   {}. Service {} - Score: {:.2}, Distance: {:?}km, Description: '{}'",
                    i + 1,
                    result.service_id,
                    result.match_score,
                    result.distance_km,
                    &result.product_description.chars().take(60).collect::<String>()
                ));
            }
        } else {
            log_warn("[HybridImageSearch] ⚠️ Aucun résultat trouvé (seuil: 150.0) - peut-être trop strict ?");
        }

        Ok((results, analysis, cost))
    }

    /// ✅ CORRECTION: Recherche SQL hybride améliorée utilisant la fonction PostgreSQL
    /// Cherche dans image_analyses ET media.ai_* pour matching complet
    /// ✅ AMÉLIORÉ 2025-12-24: Détection automatique de langue (cohérent avec recherche textuelle)
    async fn hybrid_sql_search(
        &self,
        analysis: &ImageAnalysis,
        category_filter: Option<&str>,
        gps_lat: Option<f64>,
        gps_lng: Option<f64>,
        search_radius_km: Option<i32>,
        max_results: i32,
        user_id: Option<i32>,  // ✅ NOUVEAU: Pour récupérer user.preferred_lang
    ) -> AppResult<Vec<HybridSearchResult>> {
        let couleur_principale = analysis.couleurs.first().map(|s| s.as_str());
        
        // ✅ CORRECTION: Utiliser search_query pour meilleur matching
        let search_query = if !analysis.search_query.is_empty() {
            &analysis.search_query
        } else {
            &analysis.description
        };

        // ✅ AMÉLIORÉ 2025-12-24: Détecter la langue (cohérent avec native_search_service)
        use crate::services::creer_service::detect_lang;
        
        // Récupérer user.preferred_lang si user_id fourni
        let user_preferred_lang: Option<String> = if let Some(uid) = user_id {
            match sqlx::query_scalar::<_, Option<String>>(
                "SELECT preferred_lang FROM users WHERE id = $1"
            )
            .bind(uid)
            .fetch_optional(&self.pool)
            .await
            {
                Ok(Some(Some(lang))) if !lang.is_empty() && lang != "auto" => Some(lang),
                Ok(Some(Some(_))) => None,  // Langue vide ou "auto"
                Ok(Some(None)) => None,
                Ok(None) => None,
                Err(_) => None,
            }
        } else {
            None
        };
        
        // Détecter la langue de la requête
        let detected_lang = detect_lang(search_query);
        
        // Combiner: préférence utilisateur > détection automatique > fallback "simple"
        let final_lang = user_preferred_lang
            .as_deref()
            .unwrap_or(&detected_lang);
        
        // Mapper vers configuration PostgreSQL (même logique que native_search_service)
        let pg_lang = match final_lang {
            "fr" | "fra" => "french",
            "en" | "eng" => "english",
            "es" | "spa" => "spanish",
            "de" | "deu" => "german",
            "it" | "ita" => "italian",
            "pt" | "por" => "portuguese",
            _ => "simple",  // Fallback pour langues non supportées
        };
        
        // ✅ NOUVEAU 2025-12-24: Logs détaillés pour debug pertinence
        log_info(&format!(
            "[HybridImageSearch] 🔍 Paramètres recherche:\n  - Tags ({}): {:?}\n  - Catégorie: {:?}\n  - Marque: {:?}\n  - Couleur: {:?}\n  - Query semantic: '{}'\n  - GPS: lat={:?}, lng={:?}, radius={}km\n  - Max résultats: {}",
            analysis.tags.len(),
            &analysis.tags.iter().take(15).map(|s| s.as_str()).collect::<Vec<_>>().join(", "),
            category_filter,
            analysis.marque,
            couleur_principale,
            &search_query.chars().take(80).collect::<String>(),
            gps_lat,
            gps_lng,
            search_radius_km.unwrap_or(50),
            max_results
        ));
        
        // ✅ NOUVEAU: Vérifier que les tags ne sont pas vides et ajouter fallback
        let tags_to_search = if analysis.tags.is_empty() {
            log_error("[HybridImageSearch] ❌ ERREUR CRITIQUE: Aucun tag extrait - la recherche ne pourra pas matcher correctement");
            log_warn("[HybridImageSearch] ⚠️ Fallback: Utilisation de la description comme tag unique");
            // Extraire mots-clés de la description comme fallback
            let fallback_tags: Vec<String> = search_query
                .split_whitespace()
                .take(5)
                .map(|s| s.to_lowercase())
                .collect();
            log_info(&format!(
                "[HybridImageSearch] 🔄 Tags fallback générés: {:?}",
                fallback_tags
            ));
            fallback_tags
        } else {
            analysis.tags.clone()
        };
        
        log_info(&format!(
            "[HybridImageSearch] 🌐 Langue: user_pref={:?}, detected={}, final={} -> PostgreSQL: '{}'",
            user_preferred_lang, detected_lang, final_lang, pg_lang
        ));
        log_info(&format!(
            "[HybridImageSearch] 📤 Envoi à SQL: {} tags, query: '{}'",
            tags_to_search.len(),
            &search_query.chars().take(100).collect::<String>()
        ));

        let rows = sqlx::query(
            r#"
            SELECT * FROM hybrid_image_search(
                $1::TEXT[],
                $2::TEXT,
                $3::TEXT,
                $4::TEXT,
                $5::TEXT,
                $6::FLOAT,
                $7::FLOAT,
                $8::INTEGER,
                $9::INTEGER,
                $10::TEXT
            )
            "#,
        )
        .bind(&tags_to_search)
        .bind(category_filter)
        .bind(&analysis.marque)
        .bind(couleur_principale)
        .bind(search_query)  // ✅ CORRECTION: Utiliser search_query_semantic au lieu de description
        .bind(gps_lat)
        .bind(gps_lng)
        .bind(search_radius_km.unwrap_or(50))
        .bind(max_results)
        .bind(pg_lang)  // ✅ NOUVEAU: Langue détectée pour PostgreSQL
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log_error(&format!("[HybridImageSearch] Erreur recherche SQL: {}", e));
            AppError::Internal(format!("Erreur recherche hybride: {}", e))
        })?;

        let mut results = Vec::new();
        for row in rows {
            let analysis_id: Option<i32> = row.try_get("analysis_id").ok();
            let service_id: i32 = row.try_get("service_id").unwrap_or(0);
            let media_id: Option<i32> = row.try_get("media_id").ok();
            let product_description: String = row.try_get("product_description").unwrap_or_default();
            
            let product_tags: Vec<String> = row
                .try_get::<Vec<String>, _>("product_tags")
                .unwrap_or_default();
            
            let product_marque: Option<String> = row.try_get("product_marque").ok();
            
            let product_couleurs: Vec<String> = row
                .try_get::<Vec<String>, _>("product_couleurs")
                .unwrap_or_default();
            
            let match_score: f64 = row.try_get("match_score").unwrap_or(0.0);
            let distance_km: Option<f64> = row.try_get("distance_km").ok();
            let service_data: Value = row.try_get("service_data").unwrap_or(serde_json::json!({}));

            results.push(HybridSearchResult {
                service_id,
                analysis_id,
                media_id,
                product_description,
                product_tags,
                product_marque,
                product_couleurs,
                match_score: match_score as f32,
                distance_km: distance_km.map(|d| d as f32),
                service_data,
            });
        }

        // ✅ NOUVEAU 2025-12-24: Logs détaillés des résultats pour debug pertinence
        if !results.is_empty() {
            log_info(&format!(
                "[HybridImageSearch] ✅ Trouvé {} résultats (seuil: 150.0)",
                results.len()
            ));
            for (i, result) in results.iter().take(5).enumerate() {
                log_info(&format!(
                    "[HybridImageSearch]   {}. Service {} - Score: {:.2}, Distance: {:?}km, Description: '{}'",
                    i + 1,
                    result.service_id,
                    result.match_score,
                    result.distance_km,
                    &result.product_description.chars().take(60).collect::<String>()
                ));
            }
        } else {
            log_warn("[HybridImageSearch] ⚠️ Aucun résultat trouvé (seuil: 150.0) - peut-être trop strict ?");
        }

        Ok(results)
    }

    /// Cataloguer un produit: analyser et stocker pour recherche future
    pub async fn catalog_product_image(
        &self,
        app_ia: &AppIA,
        service_id: i32,
        media_id: i32,
        user_id: i32,
        image_base64: &str,
        category: Option<&str>,
    ) -> AppResult<(ImageAnalysis, AICost)> {
        log_info(&format!(
            "[HybridImageSearch] 📦 Catalogage produit - Service: {}, Media: {}",
            service_id, media_id
        ));

        // Analyser en mode catalogage
        let (analysis, cost) = IntelligentImageAnalysisService::analyze_image_multimodel(
            app_ia,
            image_base64,
            category,
            false, // Mode catalogage
        )
        .await?;

        // Stocker l'analyse
        self.store_image_analysis(
            Some(service_id),
            Some(media_id),
            user_id,
            &analysis,
            &cost,
            "cataloging",
        )
        .await?;

        log_info(&format!(
            "[HybridImageSearch] ✅ Produit catalogué: '{}' (tokens: {})",
            &analysis.description[..analysis.description.len().min(50)],
            cost.total_tokens
        ));

        Ok((analysis, cost))
    }

    /// Récupérer l'historique de recherche d'un utilisateur
    pub async fn get_user_search_history(
        &self,
        user_id: i32,
        limit: i32,
    ) -> AppResult<Vec<ImageAnalysis>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                description, tags, category_detected, marque, couleurs,
                caracteristiques_cles, confiance,
                search_query_exact, search_query_broad, search_query_semantic,
                created_at
            FROM image_analyses
            WHERE user_id = $1 AND analysis_type = 'search'
            ORDER BY created_at DESC
            LIMIT $2
            "#
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur historique: {}", e)))?;

        let mut history = Vec::new();
        for row in rows {
            let caracteristiques_cles_value: serde_json::Value = row.get("caracteristiques_cles");
            let caracteristiques_cles: std::collections::HashMap<String, String> =
                serde_json::from_value(caracteristiques_cles_value).unwrap_or_default();

            let description: String = row.get("description");
            let tags: Vec<String> = row.get("tags");
            let category_detected: Option<String> = row.get("category_detected");
            let marque: Option<String> = row.get("marque");
            let couleurs: Vec<String> = row.get("couleurs");
            let confiance: Option<f64> = row.get("confiance");
            let search_query_exact: Option<String> = row.get("search_query_exact");
            let _search_query_broad: Option<String> = row.get("search_query_broad");
            let _search_query_semantic: Option<String> = row.get("search_query_semantic");

            history.push(ImageAnalysis {
                description,
                tags,
                category_detected: category_detected.unwrap_or_default(),
                marque,
                couleurs,
                caracteristiques_cles,
                confiance: confiance.unwrap_or(0.0) as f32,
                search_query: search_query_exact.clone().unwrap_or_default(),
            });
        }

        Ok(history)
    }

    /// Statistiques des analyses pour amélioration continue
    pub async fn get_analysis_stats(&self) -> AppResult<Value> {
        let stats = sqlx::query(
            r#"
            SELECT 
                analysis_type,
                COUNT(*) as total,
                AVG(confiance) as avg_confiance,
                AVG(tokens_consumed) as avg_tokens,
                model_used
            FROM image_analyses
            GROUP BY analysis_type, model_used
            ORDER BY total DESC
            "#
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur stats: {}", e)))?;

        let stats_json: Vec<Value> = stats
            .into_iter()
            .map(|row| {
                let analysis_type: String = row.get("analysis_type");
                let total: Option<i64> = row.get("total");
                let avg_confiance: Option<f64> = row.get("avg_confiance");
                let avg_tokens: Option<f64> = row.get("avg_tokens");
                let model_used: Option<String> = row.get("model_used");
                
                serde_json::json!({
                    "analysis_type": analysis_type,
                    "total": total,
                    "avg_confiance": avg_confiance,
                    "avg_tokens": avg_tokens,
                    "model_used": model_used
                })
            })
            .collect();

        Ok(serde_json::json!({ "analyses": stats_json }))
    }

    /// ✅ FALLBACK: Recherche par signatures vectorielles si l'analyse IA échoue
    async fn search_by_image_signature_fallback(
        &self,
        image_base64: &str,
        _category_filter: Option<&str>,
        _gps_lat: Option<f64>,
        _gps_lng: Option<f64>,
        _search_radius_km: Option<i32>,
        max_results: i32,
    ) -> AppResult<(Vec<HybridSearchResult>, ImageAnalysis, AICost)> {
        use crate::services::image_search_service::ImageSearchService;
        use base64::{Engine as _, engine::general_purpose};
        use std::sync::Arc;
        
        log_info("[HybridImageSearch] 🔄 Fallback: Recherche par signatures vectorielles");
        
        // Décoder l'image base64
        let image_base64_clean = if image_base64.contains("base64,") {
            image_base64.split("base64,").nth(1).unwrap_or(image_base64)
        } else {
            image_base64
        };
        
        let image_data = general_purpose::STANDARD.decode(image_base64_clean)
            .map_err(|e| AppError::Internal(format!("Erreur décodage base64 fallback: {}", e)))?;
        
        // Générer la signature vectorielle
        let signature = ImageSearchService::generate_image_signature(&image_data)
            .map_err(|e| AppError::Internal(format!("Erreur génération signature: {}", e)))?;
        
        log_info(&format!(
            "[HybridImageSearch] Signature générée: {} dimensions",
            signature.len()
        ));
        
        // Créer un pool temporaire pour ImageSearchService
        let pool_arc = Arc::new(self.pool.clone());
        let search_service = ImageSearchService::new(pool_arc);
        
        // Rechercher par signature (seuil de similarité plus bas pour fallback)
        let signature_results = search_service
            .search_by_image_signature(&signature, 0.2, max_results) // Seuil plus bas: 0.2
            .await
            .map_err(|e| AppError::Internal(format!("Erreur recherche signature: {}", e)))?;
        
        log_info(&format!(
            "[HybridImageSearch] Fallback: Trouvé {} résultats par signature",
            signature_results.len()
        ));
        
        // Convertir ImageSearchResult en HybridSearchResult
        let hybrid_results: Vec<HybridSearchResult> = signature_results
            .into_iter()
            .map(|sr| {
                // Extraire les métadonnées du service_data
                let product_description = sr.service_data
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                
                let product_tags: Vec<String> = sr.service_data
                    .get("tags")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                    .unwrap_or_default();
                
                let product_marque = sr.service_data
                    .get("marque")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                
                let product_couleurs: Vec<String> = sr.service_data
                    .get("couleurs")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                    .unwrap_or_default();
                
                HybridSearchResult {
                    service_id: sr.service_id,
                    analysis_id: None,
                    media_id: Some(sr.media_id),
                    product_description,
                    product_tags,
                    product_marque,
                    product_couleurs,
                    match_score: sr.similarity_score * 1000.0, // Convertir 0-1 en 0-1000
                    distance_km: None, // Pas de GPS dans fallback
                    service_data: sr.service_data,
                }
            })
            .collect();
        
        // Créer une analyse factice pour compatibilité
        let fallback_analysis = ImageAnalysis {
            description: format!("Recherche par similarité visuelle (fallback - {} résultats)", hybrid_results.len()),
            tags: vec!["similarity_search".to_string(), "fallback".to_string()],
            category_detected: _category_filter.unwrap_or("").to_string(),
            marque: None,
            couleurs: vec![],
            caracteristiques_cles: std::collections::HashMap::new(),
            confiance: 0.5, // Confiance moyenne pour fallback
            search_query: "similarity_search".to_string(),
        };
        
        let fallback_cost = AICost {
            total_tokens: 0,
            prompt_tokens: 0,
            completion_tokens: 0,
            cost_usd: 0.0,
            model_used: "signature_vector".to_string(),
        };
        
        Ok((hybrid_results, fallback_analysis, fallback_cost))
    }
}
