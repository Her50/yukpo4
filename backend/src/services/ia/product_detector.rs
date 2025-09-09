use regex::Regex;
use serde_json::Value;

/// D?tecteur de produits intelligent pour Yukpo
pub struct ProductDetector;

impl ProductDetector {
    /// D?tecte si le texte contient plusieurs produits
    pub fn detect_multiple_products(text: &str) -> bool {
        let text_lower = text.to_lowercase();
        
        // 1. D?tection par mots-cl?s de produits
        let product_keywords = Self::get_product_keywords();
        let mut product_count = 0;
        
        for keyword in &product_keywords {
            if text_lower.contains(keyword) {
                product_count += 1;
            }
        }
        
        // 2. D?tection par patterns regex
        let patterns = Self::get_product_patterns();
        for pattern in &patterns {
            if let Ok(regex) = Regex::new(pattern) {
                let matches: Vec<_> = regex.find_iter(&text_lower).collect();
                product_count += matches.len();
            }
        }
        
        // 3. D?tection par listes num?rot?es ou avec tirets
        let list_patterns = vec![
            r"\d+\.\s*\w+",           // 1. Produit
            r"-\s*\w+",               // - Produit
            r"\*\s*\w+",              // * Produit
            r"?\s*\w+",               // ? Produit
        ];
        
        for pattern in list_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                let matches: Vec<_> = regex.find_iter(&text_lower).collect();
                if matches.len() >= 2 {
                    product_count += matches.len();
                }
            }
        }
        
        // 4. D?tection par connecteurs de liste
        let list_connectors = vec![
            "et", "aussi", "?galement", "de plus", "en plus",
            "ainsi que", "comme", "notamment", "par exemple",
            "entre autres", "dont", "tels que"
        ];
        
        for connector in &list_connectors {
            if text_lower.contains(connector) {
                product_count += 1;
            }
        }
        
        // 5. D?tection par quantit?s multiples
        let quantity_patterns = vec![
            r"\d+\s*(pi?ces?|unit?s?|articles?)",
            r"plusieurs\s+\w+",
            r"diff?rents?\s+\w+",
            r"various\s+\w+",
            r"multiple\s+\w+"
        ];
        
        for pattern in quantity_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                let matches: Vec<_> = regex.find_iter(&text_lower).collect();
                product_count += matches.len();
            }
        }
        
        // Seuil de d?tection : au moins 2 produits d?tect?s
        product_count >= 2
    }
    
    /// D?tecte les produits dans le contexte multimodal
    pub fn detect_products_in_multimodal(input: &Value) -> bool {
        // V?rifier les champs multimodaux pour des produits
        let mut product_indicators = 0;
        
        // 1. V?rifier le texte principal
        if let Some(texte) = input.get("texte").and_then(|v| v.as_str()) {
            if Self::detect_multiple_products(texte) {
                product_indicators += 1;
            }
        }
        
        // 2. V?rifier les images (OCR potentiel)
        if let Some(images) = input.get("base64_image").and_then(|v| v.as_array()) {
            if images.len() > 1 {
                product_indicators += 1; // Plusieurs images = potentiellement plusieurs produits
            }
        }
        
        // 3. V?rifier les documents (PDF, Excel)
        if let Some(docs) = input.get("doc_base64").and_then(|v| v.as_array()) {
            if !docs.is_empty() {
                product_indicators += 1; // Document = potentiellement une liste de produits
            }
        }
        
        if let Some(excel) = input.get("excel_base64").and_then(|v| v.as_array()) {
            if !excel.is_empty() {
                product_indicators += 2; // Excel = tr?s probablement une liste de produits
            }
        }
        
        // 4. V?rifier le site web
        if let Some(site) = input.get("site_web").and_then(|v| v.as_str()) {
            if !site.is_empty() {
                product_indicators += 1; // Site web = potentiellement un catalogue
            }
        }
        
        // Seuil : au moins 2 indicateurs ou d?tection forte
        product_indicators >= 2
    }
    
    /// Analyse compl?te pour d?terminer s'il faut inclure le champ produits
    pub fn should_include_products_field(text: &str, multimodal_input: &Value) -> bool {
        // 1. D?tection dans le texte
        let text_detection = Self::detect_multiple_products(text);
        
        // 2. D?tection dans le contexte multimodal
        let multimodal_detection = Self::detect_products_in_multimodal(multimodal_input);
        
        // 3. D?tection par mots-cl?s commerciaux
        let commercial_keywords = vec![
            "boutique", "magasin", "commerce", "store", "shop",
            "catalogue", "inventaire", "stock", "produits", "articles",
            "vente", "vendre", "proposer", "offrir", "disponible"
        ];
        
        let has_commercial_context = commercial_keywords.iter()
            .any(|keyword| text.to_lowercase().contains(keyword));
        
        // Logique de d?cision
        text_detection || multimodal_detection || has_commercial_context
    }
    
    /// Extrait les produits d?tect?s du texte
    pub fn extract_products_from_text(text: &str) -> Vec<String> {
        let mut products = Vec::new();
        let text_lower = text.to_lowercase();
        
        // Patterns pour extraire les produits
        let extraction_patterns = vec![
            r"(\w+(?:\s+\w+)*?)\s+(?:?|pour|de)\s+\d+",  // "robe ? 25?"
            r"(\w+(?:\s+\w+)*?)\s+\d+\s*(?:?|euros?|fcf?|xaf)",  // "robe 25?"
            r"(\w+(?:\s+\w+)*?)\s+co?te\s+\d+",  // "robe co?te 25"
            r"(\w+(?:\s+\w+)*?)\s+prix\s+\d+",  // "robe prix 25"
        ];
        
        for pattern in extraction_patterns {
            if let Ok(regex) = Regex::new(pattern) {
                for cap in regex.captures_iter(&text_lower) {
                    if let Some(product) = cap.get(1) {
                        let product_name = product.as_str().trim();
                        if product_name.len() > 2 && !products.contains(&product_name.to_string()) {
                            products.push(product_name.to_string());
                        }
                    }
                }
            }
        }
        
        products
    }
    
    /// G?n?re un prompt enrichi si des produits sont d?tect?s
    pub fn generate_products_prompt(text: &str, multimodal_input: &Value) -> String {
        if Self::should_include_products_field(text, multimodal_input) {
            let products = Self::extract_products_from_text(text);
            
            if !products.is_empty() {
                format!(
                    "\n\n## PRODUITS D?TECT?S :\nL'utilisateur a mentionn? les produits suivants : {}\n\nINCLUS OBLIGATOIREMENT le champ 'produits' avec type_donnee='listeproduit' contenant ces produits d?tect?s.",
                    products.join(", ")
                )
            } else {
                "\n\n## CONTEXTE COMMERCIAL D?TECT? :\nL'utilisateur semble dans un contexte commercial (boutique, magasin, etc.).\n\nINCLUS le champ 'produits' avec type_donnee='listeproduit' si appropri? pour ce type de service.".to_string()
            }
        } else {
            "\n\n## AUCUN PRODUIT D?TECT? :\nL'utilisateur n'a pas mentionn? de produits sp?cifiques.\n\nN'INCLUS PAS le champ 'produits' sauf si le service l'exige vraiment.".to_string()
        }
    }
    
    /// Mots-cl?s de produits courants
    fn get_product_keywords() -> Vec<&'static str> {
        vec![
            // V?tements
            "robe", "pantalon", "chemise", "t-shirt", "pull", "veste", "manteau", "jupe", "short",
            "chaussures", "sneakers", "baskets", "sandales", "bottes", "escarpins",
            "accessoires", "sac", "bagage", "ceinture", "cravate", "chapeau",
            
            // ?lectronique
            "t?l?phone", "smartphone", "ordinateur", "laptop", "tablette", "?cran", "clavier",
            "souris", "casque", "enceintes", "chargeur", "c?ble",
            
            // Maison
            "meuble", "table", "chaise", "canap?", "lit", "armoire", "?tag?re",
            "d?co", "lampadaire", "coussin", "tapis", "rideau",
            
            // Alimentation
            "fruit", "l?gume", "viande", "poisson", "pain", "g?teau", "boisson",
            "jus", "eau", "soda", "vin", "bi?re",
            
            // Services
            "service", "prestation", "consultation", "formation", "cours",
            "r?paration", "maintenance", "installation", "d?m?nagement",
            
            // G?n?rique
            "produit", "article", "objet", "item", "marchandise", "bien"
        ]
    }
    
    /// Patterns regex pour d?tecter les produits
    fn get_product_patterns() -> Vec<&'static str> {
        vec![
            r"\w+\s+\d+\s*(?:?|euros?|fcf?|xaf)",  // Produit avec prix
            r"\w+\s+?\s+\d+",  // Produit ? prix
            r"\w+\s+co?te\s+\d+",  // Produit co?te prix
            r"\w+\s+prix\s+\d+",  // Produit prix montant
            r"\d+\s+\w+",  // Quantit? produit
            r"plusieurs\s+\w+",  // Plusieurs produits
            r"diff?rents?\s+\w+",  // Diff?rents produits
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_detect_multiple_products() {
        // Test avec plusieurs produits
        assert!(ProductDetector::detect_multiple_products(
            "Je vends des robes ? 25? et des chaussures ? 40?"
        ));
        
        // Test avec liste num?rot?e
        assert!(ProductDetector::detect_multiple_products(
            "1. Robe d'?t?\n2. Chaussures de sport\n3. Sac ? main"
        ));
        
        // Test avec un seul produit
        assert!(!ProductDetector::detect_multiple_products(
            "Je vends une robe"
        ));
        
        // Test avec contexte commercial
        assert!(ProductDetector::detect_multiple_products(
            "Boutique de v?tements pour enfants"
        ));
    }
    
    #[test]
    fn test_extract_products() {
        let products = ProductDetector::extract_products_from_text(
            "robe ? 25?, chaussures 40?, sac co?te 15?"
        );
        assert!(products.contains(&"robe".to_string()));
        assert!(products.contains(&"chaussures".to_string()));
        assert!(products.contains(&"sac".to_string()));
    }
} 
