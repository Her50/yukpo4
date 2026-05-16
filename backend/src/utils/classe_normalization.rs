//! Variantes de libellés de classe (IA vs UI) pour requêtes SQL `= ANY(...)`.

use std::collections::HashSet;

/// Forme canonique d'un libellé de classe ou de matière pour comparaison.
/// Trim + lowercase + suppression d'accents fréquents + normalisation des
/// suffixes `eme/ème → e` + collapse d'espaces multiples.
///
/// ✅ 2026-05-16 — Utiliser pour stocker un champ `_norm` ou pour comparer
/// au moment du matching, afin d'éviter les faux négatifs sur "6e" vs "6ème"
/// vs "SIXIÈME ". Toujours conserver la chaîne originale pour l'affichage.
pub fn canonical(input: &str) -> String {
    let mut s = input.trim().to_lowercase();
    // Strip accents FR usuels
    s = s
        .replace('é', "e")
        .replace('è', "e")
        .replace('ê', "e")
        .replace('ë', "e")
        .replace('à', "a")
        .replace('â', "a")
        .replace('î', "i")
        .replace('ï', "i")
        .replace('ô', "o")
        .replace('ö', "o")
        .replace('û', "u")
        .replace('ù', "u")
        .replace('ü', "u")
        .replace('ç', "c");
    // Suffixes "Xème"/"Xeme" → "Xe" (6ème, 6eme → 6e)
    s = s.replace("eme", "e");
    // Mots longs courants → forme courte canonique
    for (long, short) in [
        ("sixieme", "6e"),
        ("cinquieme", "5e"),
        ("quatrieme", "4e"),
        ("troisieme", "3e"),
        ("seconde", "2nde"),
        ("premiere", "1ere"),
        ("terminale", "tle"),
    ] {
        if s == long {
            s = short.to_string();
            break;
        }
    }
    // Espaces multiples → 1 seul
    while s.contains("  ") {
        s = s.replace("  ", " ");
    }
    s
}

/// Retourne un ensemble de chaînes à tester en base pour une même classe (ordre stable, dédoublonné).
pub fn classe_match_variants(input: &str) -> Vec<String> {
    let base = input.trim();
    if base.is_empty() {
        return vec![];
    }
    let mut set: HashSet<String> = HashSet::new();
    set.insert(base.to_string());

    let lower = base.to_lowercase();
    set.insert(lower.clone());

    // Chiffre + ème / eme / e (ex. 6ème vs 6eme vs 6e)
    if lower.contains('è') || lower.contains("eme") {
        set.insert(lower.replace('è', "e").replace("ème", "eme"));
    }
    let sans_accent_eme = lower.replace('è', "e");
    if sans_accent_eme != lower {
        set.insert(sans_accent_eme.clone());
    }
    if lower.ends_with("ème") || lower.ends_with("eme") {
        let stem = lower.trim_end_matches("ème").trim_end_matches("eme").trim_end_matches('e');
        if !stem.is_empty() {
            set.insert(format!("{}e", stem));
            set.insert(format!("{}ème", stem));
        }
    }

    // Quelques équivalences fréquentes (primaire / secondaire)
    let pairs: &[(&[&str], &[&str])] = &[
        (
            &["sixième", "sixieme", "6ème", "6eme", "6e", "6 ème"],
            &["6ème", "6eme", "Sixième", "sixième", "6e"],
        ),
        (
            &["cinquième", "cinquieme", "5ème", "5eme", "5e"],
            &["5ème", "5eme", "Cinquième", "cinquième", "5e"],
        ),
        (
            &["quatrième", "quatrieme", "4ème", "4eme", "4e"],
            &["4ème", "4eme", "Quatrième", "quatrième", "4e"],
        ),
        (
            &["troisième", "troisieme", "3ème", "3eme", "3e"],
            &["3ème", "3eme", "Troisième", "troisième", "3e"],
        ),
    ];

    for (keys, alts) in pairs {
        if keys.iter().any(|k| lower == *k || base.eq_ignore_ascii_case(k)) {
            for a in *alts {
                set.insert((*a).to_string());
            }
        }
    }

    let mut v: Vec<String> = set.into_iter().collect();
    v.sort_by(|a, b| a.len().cmp(&b.len()).then_with(|| a.cmp(b)));
    v.dedup();
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sixieme_variants() {
        let v = classe_match_variants("Sixième");
        assert!(v.iter().any(|x| x == "6ème" || x == "6eme"));
    }

    #[test]
    fn keeps_single() {
        let v = classe_match_variants("CP");
        assert!(v.iter().any(|s| s == "CP"));
    }

    #[test]
    fn canonical_variants_collide() {
        assert_eq!(canonical("6e"), canonical("6ème"));
        assert_eq!(canonical("6e"), canonical("6eme"));
        assert_eq!(canonical("6e"), canonical("Sixième"));
        assert_eq!(canonical("6e"), canonical(" 6E "));
        assert_eq!(canonical("CM1"), canonical("cm1"));
        assert_eq!(canonical("Mathématiques"), canonical("mathematiques"));
    }
}
