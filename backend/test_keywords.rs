use crate::services::orchestration_ia::extract_keywords_from_text;

fn main() {
    // Tests d'extraction de mots-clés
    let test_cases = vec![
        "je cherche un salon de coiffure",
        "je voudrais trouver un mécanicien",
        "je recherche un plombier pour réparer ma salle de bain",
        "je veux un électricien",
        "je souhaite un jardinier pour mon jardin",
        "je cherche un service de nettoyage",
        "je voudrais un cours de français",
        "je recherche un traducteur anglais français",
        "je veux acheter une voiture",
        "je cherche à louer un appartement"
    ];

    println!("=== TEST EXTRACTION AUTOMATIQUE DE MOTS-CLÉS ===\n");

    for (i, test_case) in test_cases.iter().enumerate() {
        let keywords = extract_keywords_from_text(test_case);
        println!("Test {}: '{}'", i + 1, test_case);
        println!("Mots-clés extraits: {:?}", keywords);
        println!("---");
    }
} 