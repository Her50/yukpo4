use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    /// Patterns regex pour détecter et supprimer les mots d'intention
    static ref INTENTION_PATTERNS: Vec<Regex> = vec![
        // Patterns français
        Regex::new(r"^(je\s+)?cherche\s+(?:à\s+)?(?:avoir\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(je\s+)?veux\s+(?:avoir\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(je\s+)?souhaite\s+(?:avoir\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(je\s+)?voudrais\s+(?:avoir\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(je\s+)?ai\s+besoin\s+(?:d'|de\s+)(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(je\s+)?recherche\s+(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(je\s+)?désire\s+(?:avoir\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        
        // Patterns d'aide
        Regex::new(r"^aide\s+(?:pour\s+)?(?:à\s+)?(?:trouver\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^peux\s+(?:tu\s+)?(?:m'|me\s+)?aider\s+(?:à\s+)?(?:trouver\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^pouvez\s+(?:vous\s+)?(?:m'|me\s+)?aider\s+(?:à\s+)?(?:trouver\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        
        // Patterns de localisation
        Regex::new(r"^où\s+(?:puis\s+)?(?:je\s+)?(?:acheter|trouver|obtenir)\s+(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^quel\s+(?:est\s+)?(?:le\s+)?(?:meilleur\s+)?(?:endroit\s+)?(?:pour\s+)?(?:acheter|trouver)\s+(?:un\s+|une\s+|des\s+)?").unwrap(),
        
        // Patterns de question
        Regex::new(r"^(?:pouvez\s+)?(?:vous\s+)?(?:me\s+)?(?:donner|indiquer|suggérer)\s+(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(?:avez\s+)?(?:vous\s+)?(?:des\s+)?(?:suggestions|recommandations)\s+(?:pour\s+)?(?:trouver)\s+(?:un\s+|une\s+|des\s+)?").unwrap(),
        
        // Patterns de demande
        Regex::new(r"^(?:je\s+)?demande\s+(?:à\s+)?(?:avoir\s+)?(?:un\s+|une\s+|des\s+)?").unwrap(),
        Regex::new(r"^(?:je\s+)?sollicite\s+(?:un\s+|une\s+|des\s+)?").unwrap(),
    ];
    
    /// Patterns pour nettoyer les espaces multiples et ponctuation
    static ref CLEANUP_PATTERNS: Vec<Regex> = vec![
        Regex::new(r"\s+").unwrap(),           // Espaces multiples
        Regex::new(r"^\s+|\s+$").unwrap(),     // Espaces début/fin
        Regex::new(r"[^\w\s]").unwrap(),       // Ponctuation (garde lettres et espaces)
    ];
}

/// Structure pour le résultat du prétraitement
#[derive(Debug, Clone)]
pub struct PreprocessedQuery {
    /// Texte original de la requête
    pub original: String,
    /// Texte nettoyé sans mots d'intention
    pub cleaned: String,
    /// Mots d'intention détectés et supprimés
    pub removed_intentions: Vec<String>,
    /// Indique si des mots d'intention ont été détectés
    pub has_intentions: bool,
}

impl PreprocessedQuery {
    /// Crée une nouvelle instance avec le texte original
    pub fn new(original: String) -> Self {
        Self {
            original: original.clone(),
            cleaned: original,
            removed_intentions: Vec::new(),
            has_intentions: false,
        }
    }
    
    /// Prétraite la requête en supprimant les mots d'intention
    pub fn preprocess(mut self) -> Self {
        let mut cleaned_text = self.original.clone();
        let mut removed = Vec::new();
        
        // Appliquer chaque pattern d'intention
        for pattern in INTENTION_PATTERNS.iter() {
            if let Some(matched) = pattern.find(&cleaned_text) {
                let matched_text = matched.as_str().trim();
                if !matched_text.is_empty() {
                    removed.push(matched_text.to_string());
                    // Remplacer par un espace pour éviter la concaténation de mots
                    cleaned_text = pattern.replace(&cleaned_text, " ").to_string();
                }
            }
        }
        
        // Nettoyer les espaces et ponctuation
        for pattern in CLEANUP_PATTERNS.iter() {
            cleaned_text = pattern.replace_all(&cleaned_text, " ").to_string();
        }
        
        // Nettoyer les espaces en début et fin
        cleaned_text = cleaned_text.trim().to_string();
        
        // Si le texte est vide après nettoyage, garder l'original
        if cleaned_text.is_empty() {
            cleaned_text = self.original.clone();
        }
        
        self.cleaned = cleaned_text;
        self.removed_intentions = removed.clone();
        self.has_intentions = !removed.is_empty();
        
        self
    }
    
    /// Obtient le texte à utiliser pour la vectorisation
    pub fn get_vectorization_text(&self) -> &str {
        &self.cleaned
    }
    
    /// Affiche un résumé du prétraitement
    pub fn print_summary(&self) {
        println!("🔍 PRÉTRAITEMENT DE LA REQUÊTE:");
        println!("   Original: '{}'", self.original);
        println!("   Nettoyé: '{}'", self.cleaned);
        
        if self.has_intentions {
            println!("   Mots d'intention supprimés: {:?}", self.removed_intentions);
        } else {
            println!("   Aucun mot d'intention détecté");
        }
    }
}

/// Fonction utilitaire pour prétraiter rapidement une requête
pub fn preprocess_query(query: &str) -> PreprocessedQuery {
    PreprocessedQuery::new(query.to_string()).preprocess()
}

/// Tests unitaires
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_intention_removal() {
        let test_cases = vec![
            ("je cherche un vehicule", "vehicule"),
            ("je veux une voiture", "voiture"),
            ("aide pour trouver une voiture", "trouver voiture"),
            ("où acheter une voiture", "acheter voiture"),
            ("je souhaite avoir un service", "service"),
            ("pouvez vous me donner un conseil", "conseil"),
        ];
        
        for (input, expected) in test_cases {
            let preprocessed = preprocess_query(input);
            println!("Input: '{}' -> Output: '{}'", input, preprocessed.cleaned);
            assert!(preprocessed.cleaned.contains(expected), 
                "Expected '{}' to contain '{}', got '{}'", input, expected, preprocessed.cleaned);
        }
    }
    
    #[test]
    fn test_no_intention() {
        let query = "Vente de véhicules";
        let preprocessed = preprocess_query(query);
        assert_eq!(preprocessed.cleaned, query);
        assert!(!preprocessed.has_intentions);
    }
    
    #[test]
    fn test_preprocessing_integration() {
        println!("🧪 TEST D'INTÉGRATION DU PRÉTRAITEMENT");
        println!("{}", "=".repeat(50));
        
        let test_queries = vec![
            "je cherche un vehicule",
            "je veux une voiture",
            "aide pour trouver une voiture",
            "où acheter une voiture",
            "Vente de véhicules",
            "Concessionnaire automobile",
        ];
        
        for query in test_queries {
            let preprocessed = preprocess_query(query);
            println!("🔍 '{}' -> '{}' (intentions: {})", 
                    query, preprocessed.cleaned, preprocessed.has_intentions);
            
            if preprocessed.has_intentions {
                println!("   🗑️ Mots supprimés: {:?}", preprocessed.removed_intentions);
            }
        }
        
        println!("✅ Test d'intégration terminé !");
    }
} 

/// Fonction de test simple pour vérifier le prétraitement
pub fn test_preprocessing_demo() {
    println!("🧪 DÉMONSTRATION DU PRÉTRAITEMENT");
    println!("{}", "=".repeat(50));
    
    let test_queries = vec![
        "je cherche un vehicule",
        "je veux une voiture",
        "aide pour trouver une voiture",
        "où acheter une voiture",
        "Vente de véhicules",
        "Concessionnaire automobile",
    ];
    
    for query in test_queries {
        println!("\n🔍 Test avec: '{}'", query);
        
        let preprocessed = preprocess_query(query);
        preprocessed.print_summary();
        
        if preprocessed.has_intentions {
            println!("   🎯 Mots d'intention supprimés: {:?}", preprocessed.removed_intentions);
            println!("   🎯 Texte nettoyé: '{}'", preprocessed.cleaned);
        }
    }
    
    println!("\n✅ Démonstration terminée !");
} 