/// Utilitaires pour normaliser les noms d'utilisateurs et éviter les duplications
///
/// Cette fonction nettoie et normalise le nom_complet pour éviter les duplications
/// comme "LELE Hernandez LELE Hernandez" -> "LELE Hernandez"

/// Normalise un nom complet en supprimant les duplications et espaces multiples
///
/// Exemples:
/// - "LELE  Hernandez LELE  Hernandez" -> "LELE Hernandez"
/// - "Jean  Dupont" -> "Jean Dupont"
/// - "Marie  Claire  Marie" -> "Marie Claire"
pub fn normalize_full_name(name: &str) -> String {
    if name.is_empty() {
        return String::new();
    }

    // Diviser en mots, supprimer les espaces multiples
    let words: Vec<&str> = name.split_whitespace().filter(|w| !w.is_empty()).collect();

    if words.is_empty() {
        return String::new();
    }

    // Supprimer les duplications consécutives
    let mut normalized: Vec<&str> = Vec::new();
    for word in words.iter() {
        // Ne pas ajouter si c'est le même mot que le précédent (insensible à la casse)
        if normalized.is_empty() || normalized.last().unwrap().to_lowercase() != word.to_lowercase()
        {
            normalized.push(word);
        }
    }

    // Rejoindre avec un seul espace
    normalized.join(" ").trim().to_string()
}

/// Construit un nom_complet à partir de nom, prenom et name en évitant les duplications
///
/// Priorité:
/// 1. Si `name` est fourni et non vide, l'utiliser (après normalisation)
/// 2. Si `nom` et `prenom` sont fournis, construire "prenom nom" (après normalisation)
/// 3. Si seul `nom` est fourni, l'utiliser
/// 4. Si seul `prenom` est fourni, l'utiliser
/// 5. Sinon None
pub fn build_full_name(
    nom: Option<&str>,
    prenom: Option<&str>,
    name: Option<&str>,
) -> Option<String> {
    // Priorité 1: Utiliser `name` si fourni
    if let Some(n) = name {
        let trimmed = n.trim();
        if !trimmed.is_empty() {
            return Some(normalize_full_name(trimmed));
        }
    }

    // Priorité 2: Construire à partir de nom et prenom
    let nom_trimmed = nom.map(|n| n.trim()).filter(|n| !n.is_empty());
    let prenom_trimmed = prenom.map(|p| p.trim()).filter(|p| !p.is_empty());

    match (nom_trimmed, prenom_trimmed) {
        (Some(n), Some(p)) => {
            // Construire "prenom nom" et normaliser
            let combined = format!("{} {}", p, n);
            Some(normalize_full_name(&combined))
        }
        (Some(n), None) => Some(normalize_full_name(n)),
        (None, Some(p)) => Some(normalize_full_name(p)),
        (None, None) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_full_name() {
        assert_eq!(
            normalize_full_name("LELE  Hernandez LELE  Hernandez"),
            "LELE Hernandez"
        );
        assert_eq!(normalize_full_name("Jean  Dupont"), "Jean Dupont");
        assert_eq!(normalize_full_name("Marie  Claire  Marie"), "Marie Claire");
        assert_eq!(normalize_full_name("  Test  "), "Test");
        assert_eq!(normalize_full_name(""), "");
    }

    #[test]
    fn test_build_full_name() {
        // Test avec name fourni
        assert_eq!(
            build_full_name(Some("Dupont"), Some("Jean"), Some("Jean Dupont")),
            Some("Jean Dupont".to_string())
        );

        // Test avec nom et prenom
        assert_eq!(
            build_full_name(Some("Dupont"), Some("Jean"), None),
            Some("Jean Dupont".to_string())
        );

        // Test avec duplication dans name
        assert_eq!(
            build_full_name(
                Some("Hernandez"),
                Some("LELE"),
                Some("LELE  Hernandez LELE  Hernandez")
            ),
            Some("LELE Hernandez".to_string())
        );

        // Test avec seul nom
        assert_eq!(
            build_full_name(Some("Dupont"), None, None),
            Some("Dupont".to_string())
        );

        // Test avec seul prenom
        assert_eq!(
            build_full_name(None, Some("Jean"), None),
            Some("Jean".to_string())
        );

        // Test avec rien
        assert_eq!(build_full_name(None, None, None), None);
    }
}
