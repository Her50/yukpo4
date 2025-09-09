// Centralise l'exclusion stricte des champs non vectorisables/non matchables pour Pinecone/embedding
// ? utiliser partout o? l'on pr?pare des embeddings ou des requ?tes de matching s?mantique IA

/// Retourne true si le champ doit ?tre exclu de toute vectorisation/matching s?mantique
pub fn is_excluded_semantic_field(field: &str) -> bool {
    matches!(field, "reponse_intelligente" | "suggestions_complementaires")
}
