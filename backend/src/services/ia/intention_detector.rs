use std::sync::Arc;
use crate::core::types::AppResult;
use crate::services::app_ia::AppIA;

/// D?tecteur d'intention utilisateur optimis?
pub struct IntentionDetector {
    app_ia: Arc<AppIA>,
}

impl IntentionDetector {
    /// Cr?e un nouveau d?tecteur d'intention
    pub async fn new(app_ia: Arc<AppIA>) -> AppResult<Self> {
        Ok(Self { app_ia })
    }
    
    /// D?tecte l'intention de l'utilisateur ? partir de son texte AVEC MESURES DE TEMPS D?TAILL?ES
    /// Retourne l'intention et les tokens consomm?s
    pub async fn detect_intention(&self, user_text: &str) -> AppResult<(String, u32)> {
        let start_time = std::time::Instant::now();
        
        // 1. V?rifier le cache d'abord
        let step1_start = std::time::Instant::now();
        if let Some(cached_intention) = self.check_intention_cache(user_text).await? {
            let step1_time = step1_start.elapsed();
            log::info!("[IntentionDetector][TIMING] ?tape 1 - Cache intention: {:?} (HIT)", step1_time);
            log::info!("[IntentionDetector] ? Intention trouv?e en cache en {:?}: {}", step1_time, cached_intention);
            return Ok((cached_intention, 0)); // 0 tokens si en cache
        }
        let step1_time = step1_start.elapsed();
        log::info!("[IntentionDetector][TIMING] ?tape 1 - Cache intention: {:?} (MISS)", step1_time);
        
        // 2. Construire le prompt de d?tection
        let step2_start = std::time::Instant::now();
        let prompt = self.build_detection_prompt(user_text);
        let step2_time = step2_start.elapsed();
        log::info!("[IntentionDetector][TIMING] ?tape 2 - Construction prompt: {:?}", step2_time);
        
        // LOG: Afficher le prompt envoy? ? l'IA
        log::info!("[IntentionDetector] Prompt envoy? ? l'IA pour d?tection d'intention:");
        log::info!("[IntentionDetector] {}", prompt);
        
        // 3. Appeler l'IA pour d?tecter l'intention
        let step3_start = std::time::Instant::now();
        let ia_start_time = std::time::Instant::now();
        let (response, model_name, tokens_used) = self.app_ia.predict(&prompt).await?;
        let ia_time = ia_start_time.elapsed();
        let step3_time = step3_start.elapsed();
        log::info!("[IntentionDetector][TIMING] ?tape 3 - Appel IA externe: {:?} (IA pure: {:?})", step3_time, ia_time);
        log::info!("[IntentionDetector] Tokens consomm?s pour d?tection: {} (mod?le: {})", tokens_used, model_name);
        
        // 4. Parser la r?ponse
        let step4_start = std::time::Instant::now();
        let intention = self.parse_intention_response(&response)?;
        let step4_time = step4_start.elapsed();
        log::info!("[IntentionDetector][TIMING] ?tape 4 - Parsing r?ponse: {:?}", step4_time);
        
        // 5. Mettre en cache
        let step5_start = std::time::Instant::now();
        self.cache_intention(user_text, &intention).await?;
        let step5_time = step5_start.elapsed();
        log::info!("[IntentionDetector][TIMING] ?tape 5 - Mise en cache: {:?}", step5_time);
        
        let total_time = start_time.elapsed();
        
        // R?SUM? D?TAILL? DES TEMPS
        log::info!("{}", "=".repeat(50));
        log::info!("[IntentionDetector] ?? R?SUM? D?TAILL? DES TEMPS");
        log::info!("{}", "=".repeat(50));
        log::info!("[IntentionDetector] ?tape 1 - Cache intention: {:?}", step1_time);
        log::info!("[IntentionDetector] ?tape 2 - Construction prompt: {:?}", step2_time);
        log::info!("[IntentionDetector] ?tape 3 - Appel IA externe: {:?} (IA pure: {:?})", step3_time, ia_time);
        log::info!("[IntentionDetector] ?tape 4 - Parsing r?ponse: {:?}", step4_time);
        log::info!("[IntentionDetector] ?tape 5 - Mise en cache: {:?}", step5_time);
        log::info!("{}", "=".repeat(50));
        log::info!("[IntentionDetector] ??  TEMPS TOTAL: {:?}", total_time);
        log::info!("[IntentionDetector] ?? TEMPS IA EXTERNE: {:?}", ia_time);
        log::info!("[IntentionDetector] ?? POURCENTAGE IA: {:.1}%", (ia_time.as_millis() as f64 / total_time.as_millis() as f64) * 100.0);
        log::info!("[IntentionDetector] ?? TOKENS CONSOMM?S: {}", tokens_used);
        log::info!("{}", "=".repeat(50));
        
        log::info!("[IntentionDetector] ? Intention d?tect?e en {:?} (IA: {:?}): {} (tokens: {})", total_time, ia_time, intention, tokens_used);
        Ok((intention, tokens_used))
    }
    
    /// Construit le prompt pour la d?tection d'intention
    fn build_detection_prompt(&self, user_text: &str) -> String {
        format!(
            r#"Tu es un assistant sp?cialis? dans la d?tection d'intention utilisateur pour la plateforme Yukpo.

## CONTRAINTE FONDAMENTALE SUR LES INTENTIONS

Le champ intention doit ?tre exactement l'une des valeurs ci-dessous, sans variante, sans majuscule, sans espace, et doit correspondre strictement au sens de la demande.

## Intentions possibles :
- creation_service: Cr?ation d'un service/offre
- recherche_besoin: Recherche d'un service/besoin
- echange: ?change/troc de biens
- assistance_generale: Question g?n?rale/aide
- programme_scolaire: Programme scolaire
- update_programme_scolaire: Mise ? jour de programme scolaire

## R?gles de d?tection STRICTES :
- Si la demande est une recherche (ex : commence par "je cherche", "je voudrais trouver", "je recherche", "je veux trouver", "je voudrais", "je veux", "je souhaite", "je d?sire", "je recherche", "je cherche", "je voudrais trouver", "je veux trouver", "je recherche", "je voudrais", "je veux", "je souhaite", "je d?sire", etc.) ? recherche_besoin
- Si la demande est une cr?ation (ex : "je veux cr?er", "je souhaite ouvrir", "j'ai un", "j'ai une", "je suis un", "je suis une", "je vends", "je propose", "je loue", "je offre", "je fais", "j'ai une boutique", "j'ai un magasin", "j'ai un commerce", "j'ai une entreprise", "je suis commer?ant", "je suis vendeur", "je suis prestataire", "je suis fournisseur", "je suis entrepreneur", "je suis artisan", "je suis professionnel", "je suis expert", "je suis sp?cialiste", "je suis consultant", "je suis formateur", "je suis coach", "je suis mentor", "je suis tuteur", "je suis accompagnateur", "je suis guide", "je suis conseiller", "je suis accompagnateur", "je suis guide", "je suis conseiller", etc.) ? creation_service
- Si la demande concerne un ?change (ex : "j'?change", "je troque", "je propose un ?change", "contre", "en ?change de", "je voudrais ?changer", "je veux ?changer", "je souhaite ?changer", "je d?sire ?changer", etc.) ? echange
- Si la demande est une question g?n?rale ou n'est pas claire ? assistance_generale
- Pour tout ce qui concerne un programme scolaire ? programme_scolaire ou update_programme_scolaire

## Demande utilisateur : "{}"

## ?? INSTRUCTION CRITIQUE - R?PONSE OBLIGATOIRE :
Tu dois r?pondre UNIQUEMENT avec l'intention d?tect?e, sans aucun autre texte, sans explication, sans ponctuation, sans guillemets, sans formatage.

## Exemples de r?ponses correctes :
- Si l'utilisateur dit "je vends des v?tements" ? tu r?ponds : creation_service
- Si l'utilisateur dit "je cherche un plombier" ? tu r?ponds : recherche_besoin
- Si l'utilisateur dit "comment ?a marche ?" ? tu r?ponds : assistance_generale

## R?GLE ABSOLUE : 
NE R?PONDS QUE L'INTENTION, RIEN D'AUTRE.

## Intention :"#,
            user_text
        )
    }
    
    /// Parse la r?ponse de l'IA pour extraire l'intention
    fn parse_intention_response(&self, response: &str) -> AppResult<String> {
        let response_clean = response.trim().to_lowercase();
        
        // Nettoyer la r?ponse de tout formatage possible
        let cleaned_response = response_clean
            .replace("\"", "")
            .replace("'", "")
            .replace(".", "")
            .replace("!", "")
            .replace("?", "")
            .replace("\n", "")
            .replace("\r", "")
            .trim()
            .to_string();
        
        log::info!("[IntentionDetector] R?ponse IA brute: '{}'", response);
        log::info!("[IntentionDetector] R?ponse IA nettoy?e: '{}'", cleaned_response);
        
        // Validation des intentions valides selon les instructions originales
        match cleaned_response.as_str() {
            "creation_service" | "creation" | "creer" | "vendre" | "louer" | "boutique" | "j'ai" | "j'ai un" | "j'ai une" | "je fais" => {
                log::info!("[IntentionDetector] Intention d?tect?e: creation_service");
                Ok("creation_service".to_string())
            },
            "recherche_besoin" | "recherche" | "chercher" | "trouver" => {
                log::info!("[IntentionDetector] Intention d?tect?e: recherche_besoin");
                Ok("recherche_besoin".to_string())
            },
            "echange" | "troc" | "echanger" => {
                log::info!("[IntentionDetector] Intention d?tect?e: echange");
                Ok("echange".to_string())
            },
            "assistance_generale" | "question_generale" | "question" | "info" | "aide" => {
                log::info!("[IntentionDetector] Intention d?tect?e: assistance_generale");
                Ok("assistance_generale".to_string())
            },
            "programme_scolaire" | "scolaire" | "ecole" => {
                log::info!("[IntentionDetector] Intention d?tect?e: programme_scolaire");
                Ok("programme_scolaire".to_string())
            },
            "update_programme_scolaire" | "mise_a_jour_scolaire" => {
                log::info!("[IntentionDetector] Intention d?tect?e: update_programme_scolaire");
                Ok("update_programme_scolaire".to_string())
            },
            _ => {
                log::warn!("[IntentionDetector] Intention non reconnue: '{}', utilisation de 'assistance_generale'", cleaned_response);
                Ok("assistance_generale".to_string())
            }
        }
    }
    
    /// V?rifie le cache pour une intention d?j? d?tect?e
    async fn check_intention_cache(&self, _user_text: &str) -> AppResult<Option<String>> {
        // TODO: Impl?menter le cache Redis
        // Pour l'instant, pas de cache
        Ok(None)
    }
    
    /// Met en cache l'intention d?tect?e
    async fn cache_intention(&self, _user_text: &str, _intention: &str) -> AppResult<()> {
        // TODO: Impl?menter le cache Redis
        // Pour l'instant, pas de cache
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_intention_response() {
        let detector = IntentionDetector { app_ia: Arc::new(AppIA::new(redis::Client::open("redis://localhost").unwrap(), Arc::new(tokio::sync::Mutex::new(crate::controllers::ia_status_controller::IAStats::default())), sqlx::PgPool::connect("postgres://localhost").await.unwrap())) };
        
        assert_eq!(detector.parse_intention_response("creation_service").unwrap(), "creation_service");
        assert_eq!(detector.parse_intention_response("CREATION").unwrap(), "creation_service");
        assert_eq!(detector.parse_intention_response("recherche_service").unwrap(), "recherche_service");
        assert_eq!(detector.parse_intention_response("ECHANGE").unwrap(), "echange");
        assert_eq!(detector.parse_intention_response("question_generale").unwrap(), "question_generale");
        assert_eq!(detector.parse_intention_response("support").unwrap(), "support");
        assert_eq!(detector.parse_intention_response("intention_inconnue").unwrap(), "question_generale");
    }
    
    #[test]
    fn test_build_detection_prompt() {
        let detector = IntentionDetector { app_ia: Arc::new(AppIA::new(redis::Client::open("redis://localhost").unwrap(), Arc::new(tokio::sync::Mutex::new(crate::controllers::ia_status_controller::IAStats::default())), sqlx::PgPool::connect("postgres://localhost").await.unwrap())) };
        
        let prompt = detector.build_detection_prompt("Je vends des v?tements");
        assert!(prompt.contains("Je vends des v?tements"));
        assert!(prompt.contains("creation_service"));
        assert!(prompt.contains("recherche_service"));
    }
} 
