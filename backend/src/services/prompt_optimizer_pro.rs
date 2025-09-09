// backend/src/services/prompt_optimizer_pro.rs
// Optimiseur de prompts professionnel inspir? de Cursor et GitHub Copilot

use std::collections::HashMap;
use serde_json::{json, Value};
use serde::{Deserialize, Serialize};

use crate::core::types::AppResult;
use crate::models::input_model::MultiModalInput;
use crate::utils::log::log_info;

/// ?? Template de prompt optimis? par domaine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptTemplate {
    pub domain: String,
    pub base_instruction: String,
    pub context_enhancers: Vec<String>,
    pub output_format: String,
    pub quality_indicators: Vec<String>,
    pub performance_hints: Vec<String>,
    pub examples: Vec<PromptExample>,
}

/// ?? Exemple de prompt optimis?
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptExample {
    pub input: String,
    pub optimized_prompt: String,
    pub expected_output: String,
    pub performance_score: f64,
}

/// ?? M?triques de performance des prompts
#[derive(Debug, Default, Clone)]
pub struct PromptMetrics {
    pub total_optimizations: u64,
    pub average_improvement: f64,
    pub best_performing_domain: String,
    pub optimization_time_ms: f64,
}

/// ?? Optimiseur de prompts professionnel
pub struct PromptOptimizerPro {
    domain_templates: HashMap<String, PromptTemplate>,
}

impl PromptOptimizerPro {
    pub fn new() -> Self {
        let mut optimizer = Self {
            domain_templates: HashMap::new(),
        };
        
        optimizer.initialize_professional_templates();
        optimizer
    }

    /// ?? Optimisation de prompt pour GPT-4o (technique Cursor)
    pub async fn optimize_for_gpt4o(&self, input: &MultiModalInput, context: Option<&str>) -> AppResult<String> {
        let start_time = std::time::Instant::now();
        
        // 1. Classification automatique du domaine
        let domain = self.classify_request_domain(input).await?;
        log_info(&format!("[PromptOptimizer] Domain classified: {}", domain));
        
        // 2. S?lection du template optimal
        let template = self.domain_templates.get(&domain)
            .unwrap_or(&self.domain_templates["default"]);
        
        // 3. Analyse contextuelle intelligente
        let smart_context = self.analyze_context_intelligence(input, context).await?;
        
        // 4. Construction du prompt ultra-optimis?
        let optimized_prompt = self.build_ultra_optimized_prompt(template, input, &smart_context).await?;
        
        // 5. Injection des instructions de performance GPT-4o
        let gpt4o_optimized = self.apply_gpt4o_performance_optimizations(&optimized_prompt, &domain);
        
        let optimization_time = start_time.elapsed().as_millis() as f64;
        log_info(&format!("[PromptOptimizer] Optimized in {:.2}ms", optimization_time));
        
        Ok(gpt4o_optimized)
    }

    /// ??? Construction de prompt ultra-optimis?
    async fn build_ultra_optimized_prompt(&self, template: &PromptTemplate, 
                                         input: &MultiModalInput, context: &Value) -> AppResult<String> {
        let mut prompt_parts = Vec::new();
        
        // 1. Instructions syst?me ultra-pr?cises
        prompt_parts.push(self.build_system_instructions(&template.domain));
        
        // 2. Contexte enrichi intelligent
        prompt_parts.push(self.build_enriched_context(input, context));
        
        // 3. Instructions de performance
        prompt_parts.push(template.base_instruction.clone());
        
        // 4. Format de sortie strict
        prompt_parts.push(self.build_output_format_instructions(&template.output_format));
        
        // 5. Exemples de haute qualit? (few-shot learning)
        if !template.examples.is_empty() {
            prompt_parts.push(self.build_few_shot_examples(&template.examples));
        }
        
        // 6. Donn?es utilisateur trait?es
        prompt_parts.push(self.build_user_data_section(input));
        
        // 7. Instructions finales de qualit?
        prompt_parts.push(self.build_quality_enforcement_instructions(&template.quality_indicators));
        
        Ok(prompt_parts.join("\n\n"))
    }

    /// ?? Instructions syst?me ultra-pr?cises par domaine
    fn build_system_instructions(&self, domain: &str) -> String {
        let base_system = r#"Tu es un expert IA sp?cialis? avec une pr?cision exceptionnelle. Tes r?ponses doivent ?tre :
- EXACTEMENT conformes au sch?ma JSON demand?
- Bas?es uniquement sur les donn?es fournies
- Optimis?es pour l'utilisation m?tier
- Sans hallucination ou invention
- Structur?es pour une performance maximale"#;

        let domain_specific = match domain {
            "service_creation" => r#"
SP?CIALISATION : Cr?ation de services/annonces
- Extrais TOUS les d?tails pertinents du texte et des fichiers
- Identifie le type de service avec pr?cision
- D?termine le prix de mani?re r?aliste
- Cat?gorise selon les standards m?tier
- Optimise pour la d?couvrabilit?"#,
            
            "need_search" => r#"
SP?CIALISATION : Recherche et matching de besoins
- Identifie l'intention de recherche exacte
- Extrais les crit?res explicites et implicites
- G?n?re des suggestions de recherche pertinentes
- Optimise pour le matching s?mantique"#,
            
            "classification" => r#"
SP?CIALISATION : Classification et cat?gorisation
- Analyse le contenu avec pr?cision
- Applique la taxonomie appropri?e
- D?termine la confiance de classification
- Identifie les ambigu?t?s potentielles"#,
            
            _ => "SP?CIALISATION : Traitement g?n?raliste avec optimisation qualit?"
        };

        format!("{}\n{}", base_system, domain_specific)
    }

    /// ?? Contexte enrichi intelligent
    fn build_enriched_context(&self, input: &MultiModalInput, context: &Value) -> String {
        let mut context_parts = Vec::new();
        
        context_parts.push("=== CONTEXTE ENRICHI ===".to_string());
        
        // Analyse du texte principal
        if let Some(texte) = &input.texte {
            let text_analysis = self.analyze_text_intelligence(texte);
            context_parts.push(format!("TEXTE ANALYS? :\n- Contenu : {}\n- Mots cl?s : {}\n- Intention probable : {}", 
                texte, text_analysis.keywords, text_analysis.intent));
        }
        
        // M?tadonn?es multimodales
        if input.base64_image.is_some() || input.audio_base64.is_some() || input.doc_base64.is_some() {
            context_parts.push("CONTENU MULTIMODAL D?TECT? :".to_string());
            
            if let Some(images) = &input.base64_image {
                context_parts.push(format!("- {} image(s) fournie(s)", images.len()));
            }
            if let Some(audios) = &input.audio_base64 {
                context_parts.push(format!("- {} fichier(s) audio fourni(s)", audios.len()));
            }
            if let Some(docs) = &input.doc_base64 {
                context_parts.push(format!("- {} document(s) fourni(s)", docs.len()));
            }
        }
        
        // Contexte m?tier
        if let Some(intention) = context.get("intention").and_then(|i| i.as_str()) {
            context_parts.push(format!("INTENTION M?TIER : {}", intention));
        }
        
        context_parts.join("\n")
    }

    /// ?? Format de sortie strict
    fn build_output_format_instructions(&self, format_type: &str) -> String {
        match format_type {
            "service_creation_json" => r#"=== FORMAT DE SORTIE OBLIGATOIRE ===
R?ponds UNIQUEMENT par un objet JSON strictement conforme ? ce sch?ma :

{
  "intention": "creation_service",
  "titre": {
    "type_donnee": "string",
    "valeur": "[titre descriptif optimis?]",
    "origine_champs": "ia_gpt4o"
  },
  "description": {
    "type_donnee": "string", 
    "valeur": "[description d?taill?e et attractive]",
    "origine_champs": "ia_gpt4o"
  },
  "category": {
    "type_donnee": "string",
    "valeur": "[cat?gorie exacte]",
    "origine_champs": "ia_gpt4o"
  },
  "prix": {
    "type_donnee": "number",
    "valeur": [prix num?rique],
    "origine_champs": "ia_gpt4o"
  },
  "is_tarissable": [true/false],
  "vitesse_tarissement": "[lente/moyenne/rapide]",
  "gps": [true/false]
}

CRITIQUES :
- Aucun texte avant ou apr?s le JSON
- Pas de ```json ou balises markdown
- Valeurs r?alistes et coh?rentes
- Tous les champs obligatoires pr?sents"#.to_string(),
            
            "need_search_json" => r#"=== FORMAT DE SORTIE OBLIGATOIRE ===
R?ponds UNIQUEMENT par un objet JSON pour la recherche :

{
  "intention": "recherche_besoin",
  "requete_optimisee": "[requ?te optimis?e pour recherche]",
  "mots_cles": ["mot1", "mot2", "mot3"],
  "filtres": {
    "categorie": "[cat?gorie cibl?e]",
    "prix_min": [prix minimum],
    "prix_max": [prix maximum],
    "localisation": "[zone g?ographique]"
  },
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}"#.to_string(),
            
            _ => "R?ponds au format JSON structur? appropri? au contexte.".to_string()
        }
    }

    /// ?? Few-shot learning avec exemples optimis?s
    fn build_few_shot_examples(&self, examples: &[PromptExample]) -> String {
        let mut examples_section = Vec::new();
        examples_section.push("=== EXEMPLES DE HAUTE QUALIT? ===".to_string());
        
        for (i, example) in examples.iter().take(2).enumerate() { // Limite ? 2 exemples pour ?viter la pollution
            examples_section.push(format!(
                "EXEMPLE {} :\nInput: {}\nOutput attendu: {}\n",
                i + 1, example.input, example.expected_output
            ));
        }
        
        examples_section.join("\n")
    }

    /// ?? Section donn?es utilisateur
    fn build_user_data_section(&self, input: &MultiModalInput) -> String {
        let mut data_section = Vec::new();
        data_section.push("=== DONN?ES UTILISATEUR ? TRAITER ===".to_string());
        
        if let Some(texte) = &input.texte {
            data_section.push(format!("TEXTE PRINCIPAL :\n{}", texte));
        }
        
        // Note: intention field doesn't exist in MultiModalInput, using texte instead
        if let Some(intention) = &input.texte {
            data_section.push(format!("INTENTION D?CLAR?E : {}", intention));
        }
        
        if let Some(gps) = &input.gps_mobile {
            data_section.push(format!("LOCALISATION : {}", gps));
        }
        
        if let Some(site) = &input.site_web {
            data_section.push(format!("SITE WEB R?F?RENCE : {}", site));
        }
        
        data_section.push("=== FIN DONN?ES UTILISATEUR ===".to_string());
        data_section.join("\n")
    }

    /// ? Instructions de qualit? et conformit?
    fn build_quality_enforcement_instructions(&self, quality_indicators: &[String]) -> String {
        let mut quality_section = Vec::new();
        quality_section.push("=== CONTR?LE QUALIT? FINAL ===".to_string());
        quality_section.push("Avant de r?pondre, V?RIFIE :".to_string());
        
        // Instructions g?n?rales de qualit?
        quality_section.push("? JSON valide et bien form?".to_string());
        quality_section.push("? Tous les champs obligatoires pr?sents".to_string());
        quality_section.push("? Valeurs r?alistes et coh?rentes".to_string());
        quality_section.push("? Pas d'hallucination ou d'invention".to_string());
        
        // Indicateurs sp?cifiques au domaine
        for indicator in quality_indicators {
            quality_section.push(format!("? {}", indicator));
        }
        
        quality_section.push("\nNE R?PONDS QUE SI TOUS LES CRIT?RES SONT RESPECT?S.".to_string());
        quality_section.join("\n")
    }

    /// ?? Optimisations sp?cifiques GPT-4o
    fn apply_gpt4o_performance_optimizations(&self, prompt: &str, domain: &str) -> String {
        let mut optimized = prompt.to_string();
        
        // 1. Pr?fixe de performance GPT-4o
        let gpt4o_prefix = match domain {
            "service_creation" => "MODE HAUTE PERFORMANCE : Cr?ation de service optimis?e pour GPT-4o. R?ponse JSON pr?cise et compl?te requise.\n\n",
            "need_search" => "MODE RECHERCHE OPTIMIS?E : Analyse de besoin pour GPT-4o. Extraction intelligente de crit?res requise.\n\n",
            _ => "MODE PERFORMANCE GPT-4o : Traitement optimis? pour r?ponse pr?cise et structur?e.\n\n"
        };
        
        optimized = format!("{}{}", gpt4o_prefix, optimized);
        
        // 2. Suffixe de rappel de format
        let format_reminder = "\n\nRAPPEL CRITIQUE : R?ponds UNIQUEMENT par le JSON demand?, sans aucun texte additionnel.";
        optimized.push_str(format_reminder);
        
        // 3. Optimisation de longueur (GPT-4o performe mieux avec prompts structur?s)
        if optimized.len() > 4000 {
            optimized = self.compress_prompt_intelligently(&optimized);
        }
        
        optimized
    }

    /// ?? Classification automatique du domaine
    async fn classify_request_domain(&self, input: &MultiModalInput) -> AppResult<String> {
        let text = input.texte.as_deref().unwrap_or("");
        let intention = ""; // L'intention sera d?tect?e ? partir du texte
        
        // Classification par mots-cl?s et intention
        if intention.contains("creation") || text.contains("vendre") || text.contains("propose") {
            return Ok("service_creation".to_string());
        }
        
        if intention.contains("recherche") || text.contains("cherche") || text.contains("besoin") {
            return Ok("need_search".to_string());
        }
        
        if text.contains("cat?gorie") || text.contains("classer") {
            return Ok("classification".to_string());
        }
        
        Ok("default".to_string())
    }

    /// ?? Analyse contextuelle intelligente
    async fn analyze_context_intelligence(&self, input: &MultiModalInput, context: Option<&str>) -> AppResult<Value> {
        let mut smart_context = json!({
            "timestamp": chrono::Utc::now().timestamp(),
            "has_multimedia": false,
            "complexity_score": 0.5,
            "confidence": 0.8
        });
        
        // Analyse de complexit?
        if let Some(text) = &input.texte {
            let complexity = self.calculate_text_complexity(text);
            smart_context["complexity_score"] = json!(complexity);
            smart_context["word_count"] = json!(text.split_whitespace().count());
        }
        
        // D?tection multim?dia
        let has_multimedia = input.base64_image.is_some() || 
                           input.audio_base64.is_some() || 
                           input.doc_base64.is_some();
        smart_context["has_multimedia"] = json!(has_multimedia);
        
        // Contexte additionnel
        if let Some(ctx) = context {
            smart_context["additional_context"] = json!(ctx);
        }
        
        Ok(smart_context)
    }

    /// ?? Initialisation des templates professionnels
    fn initialize_professional_templates(&mut self) {
        // Template cr?ation de service (optimis? Cursor-style)
        self.domain_templates.insert("service_creation".to_string(), PromptTemplate {
            domain: "service_creation".to_string(),
            base_instruction: r#"Tu dois cr?er un service/annonce bas? sur les donn?es fournies.
ANALYSE REQUIS :
1. Extrais le titre optimal du contenu
2. G?n?re une description attractive et compl?te  
3. D?termine la cat?gorie exacte
4. Estime un prix r?aliste
5. ?value la tarissabilit? et la vitesse

OPTIMISATION M?TIER :
- Titre : descriptif et optimis? SEO
- Description : d?taill?e, attractive, factuelle
- Cat?gorie : selon taxonomie standard
- Prix : coh?rent avec le march?
- GPS : requis si service localis?"#.to_string(),
            context_enhancers: vec![
                "Analyse du march? local".to_string(),
                "Optimisation SEO".to_string(),
                "Coh?rence cat?gorielle".to_string(),
            ],
            output_format: "service_creation_json".to_string(),
            quality_indicators: vec![
                "Titre attractif et descriptif".to_string(),
                "Description compl?te et factuelle".to_string(),
                "Prix coh?rent avec le contenu".to_string(),
                "Cat?gorie appropri?e".to_string(),
            ],
            performance_hints: vec![
                "Utilise tous les d?tails fournis".to_string(),
                "?vite les g?n?ralisations".to_string(),
                "Optimise pour la recherche".to_string(),
            ],
            examples: vec![
                PromptExample {
                    input: "Je vends mon ordinateur portable gaming".to_string(),
                    optimized_prompt: "Prompt optimis?...".to_string(),
                    expected_output: r#"{"intention":"creation_service","titre":{"type_donnee":"string","valeur":"Ordinateur portable gaming - Excellent ?tat","origine_champs":"ia_gpt4o"}}"#.to_string(),
                    performance_score: 0.95,
                }
            ],
        });

        // Template recherche de besoin
        self.domain_templates.insert("need_search".to_string(), PromptTemplate {
            domain: "need_search".to_string(),
            base_instruction: r#"Tu dois analyser une requ?te de recherche et l'optimiser.
ANALYSE REQUIS :
1. Identifie l'intention exacte de recherche
2. Extrais tous les crit?res explicites et implicites
3. G?n?re des mots-cl?s optimaux
4. D?termine les filtres appropri?s
5. Propose des suggestions alternatives

OPTIMISATION RECHERCHE :
- Mots-cl?s : pertinents et vari?s
- Filtres : prix, cat?gorie, localisation
- Suggestions : alternatives intelligentes"#.to_string(),
            context_enhancers: vec![
                "Analyse s?mantique de la requ?te".to_string(),
                "Extraction de crit?res implicites".to_string(),
            ],
            output_format: "need_search_json".to_string(),
            quality_indicators: vec![
                "Requ?te optimis?e pour matching".to_string(),
                "Crit?res complets extraits".to_string(),
                "Suggestions pertinentes".to_string(),
            ],
            performance_hints: vec![
                "Identifie les besoins non explicites".to_string(),
                "Optimise pour la recherche s?mantique".to_string(),
            ],
            examples: vec![],
        });

        // Template par d?faut
        self.domain_templates.insert("default".to_string(), PromptTemplate {
            domain: "default".to_string(),
            base_instruction: "Traite la requ?te de mani?re structur?e et pr?cise.".to_string(),
            context_enhancers: vec![],
            output_format: "structured_json".to_string(),
            quality_indicators: vec![
                "R?ponse structur?e".to_string(),
                "Information pr?cise".to_string(),
            ],
            performance_hints: vec![],
            examples: vec![],
        });
    }

    // M?thodes utilitaires
    fn analyze_text_intelligence(&self, text: &str) -> TextAnalysisResult {
        let words: Vec<&str> = text.split_whitespace().collect();
        let keywords: Vec<String> = words.iter()
            .filter(|&&word| word.len() > 3)
            .take(5)
            .map(|&s| s.to_string())
            .collect();
        
        let intent = if text.contains("vendre") || text.contains("propose") {
            "creation_service"
        } else if text.contains("cherche") || text.contains("besoin") {
            "recherche_besoin"
        } else {
            "general"
        };
        
        TextAnalysisResult {
            keywords: keywords.join(", "),
            intent: intent.to_string(),
        }
    }

    fn calculate_text_complexity(&self, text: &str) -> f64 {
        let word_count = text.split_whitespace().count();
        let sentence_count = text.split(['.', '!', '?']).count();
        let avg_word_length: f64 = text.split_whitespace()
            .map(|w| w.len())
            .sum::<usize>() as f64 / word_count.max(1) as f64;
        
        // Score de complexit? normalis?
        let complexity = (word_count as f64 / 100.0) + 
                        (avg_word_length / 10.0) + 
                        (word_count as f64 / sentence_count.max(1) as f64 / 20.0);
        
        complexity.min(1.0).max(0.1)
    }

    fn compress_prompt_intelligently(&self, prompt: &str) -> String {
        // Compression intelligente en gardant les parties essentielles
        let lines: Vec<&str> = prompt.lines().collect();
        let mut compressed = Vec::new();
        
        for line in lines {
            if line.contains("===") || line.contains("CRITIQUE") || line.contains("OBLIGATOIRE") {
                compressed.push(line); // Garder les sections importantes
            } else if line.len() > 100 {
                // Raccourcir les lignes tr?s longues
                compressed.push(&line[..100]);
            } else {
                compressed.push(line);
            }
        }
        
        compressed.join("\n")
    }
}

#[derive(Debug)]
struct TextAnalysisResult {
    keywords: String,
    intent: String,
} 
