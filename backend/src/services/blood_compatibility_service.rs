// Service de compatibilité des groupes sanguins
// Définit quels groupes sanguins peuvent donner à quels receveurs

pub struct BloodCompatibilityService;

impl BloodCompatibilityService {
    /// Retourne les groupes compatibles (donneurs) pour un groupe requis (receveur)
    ///
    /// Exemples:
    /// - O+ peut recevoir de O+ et O-
    /// - A+ peut recevoir de A+, A-, O+, O-
    /// - AB+ peut recevoir de tous les groupes (receveur universel)
    pub fn get_compatible_donor_groups(required_group: &str) -> Vec<String> {
        match required_group {
            "O+" => vec!["O+".to_string(), "O-".to_string()],
            "O-" => vec!["O-".to_string()],
            "A+" => vec![
                "A+".to_string(),
                "A-".to_string(),
                "O+".to_string(),
                "O-".to_string(),
            ],
            "A-" => vec!["A-".to_string(), "O-".to_string()],
            "B+" => vec![
                "B+".to_string(),
                "B-".to_string(),
                "O+".to_string(),
                "O-".to_string(),
            ],
            "B-" => vec!["B-".to_string(), "O-".to_string()],
            "AB+" => vec![
                "O+".to_string(),
                "O-".to_string(),
                "A+".to_string(),
                "A-".to_string(),
                "B+".to_string(),
                "B-".to_string(),
                "AB+".to_string(),
                "AB-".to_string(),
            ],
            "AB-" => vec![
                "AB-".to_string(),
                "A-".to_string(),
                "B-".to_string(),
                "O-".to_string(),
            ],
            _ => vec![],
        }
    }

    /// Vérifie si un donneur peut donner à un receveur
    pub fn can_donate(donor_group: &str, receiver_group: &str) -> bool {
        Self::get_compatible_donor_groups(receiver_group).contains(&donor_group.to_string())
    }

    /// Retourne tous les groupes sanguins valides
    pub fn get_all_blood_groups() -> Vec<String> {
        vec![
            "O+".to_string(),
            "O-".to_string(),
            "A+".to_string(),
            "A-".to_string(),
            "B+".to_string(),
            "B-".to_string(),
            "AB+".to_string(),
            "AB-".to_string(),
        ]
    }

    /// Valide qu'un groupe sanguin est valide
    pub fn is_valid_group(group: &str) -> bool {
        Self::get_all_blood_groups().contains(&group.to_string())
    }

    /// Obtient les informations de compatibilité pour un groupe
    pub fn get_compatibility_info(group: &str) -> Option<serde_json::Value> {
        if !Self::is_valid_group(group) {
            return None;
        }

        let compatible_donors = Self::get_compatible_donor_groups(group);

        // Déterminer les receveurs potentiels
        let compatible_receivers: Vec<String> = Self::get_all_blood_groups()
            .into_iter()
            .filter(|g| Self::can_donate(group, g))
            .collect();

        Some(serde_json::json!({
            "blood_group": group,
            "can_receive_from": compatible_donors,
            "can_donate_to": compatible_receivers,
            "is_universal_donor": group == "O-",
            "is_universal_receiver": group == "AB+",
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compatibility_o_plus() {
        let compatible = BloodCompatibilityService::get_compatible_donor_groups("O+");
        assert_eq!(compatible, vec!["O+", "O-"]);
    }

    #[test]
    fn test_compatibility_a_plus() {
        let compatible = BloodCompatibilityService::get_compatible_donor_groups("A+");
        assert_eq!(compatible, vec!["A+", "A-", "O+", "O-"]);
    }

    #[test]
    fn test_compatibility_ab_plus() {
        let compatible = BloodCompatibilityService::get_compatible_donor_groups("AB+");
        assert_eq!(compatible.len(), 8); // Peut recevoir de tous
    }

    #[test]
    fn test_can_donate() {
        assert!(BloodCompatibilityService::can_donate("O-", "O+"));
        assert!(BloodCompatibilityService::can_donate("O-", "AB+"));
        assert!(!BloodCompatibilityService::can_donate("O+", "O-"));
        assert!(!BloodCompatibilityService::can_donate("A+", "B+"));
    }

    #[test]
    fn test_universal_donor() {
        let info = BloodCompatibilityService::get_compatibility_info("O-").unwrap();
        assert_eq!(info["is_universal_donor"], true);
    }

    #[test]
    fn test_universal_receiver() {
        let info = BloodCompatibilityService::get_compatibility_info("AB+").unwrap();
        assert_eq!(info["is_universal_receiver"], true);
    }
}
