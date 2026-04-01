//! Variantes de libellés de classe (IA vs UI) pour requêtes SQL `= ANY(...)`.

use std::collections::HashSet;

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
}
