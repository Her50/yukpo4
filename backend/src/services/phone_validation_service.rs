use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhoneValidationResult {
    pub is_valid: bool,
    pub formatted_number: Option<String>,
    pub country_code: Option<String>,
    pub carrier: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhoneValidationRequest {
    pub phone_number: String,
    pub country: Option<String>, // CM, CI, BF, etc.
}

pub struct PhoneValidationService {
    // Patterns pour différents pays et opérateurs
    patterns: HashMap<String, Vec<PhonePattern>>,
}

#[derive(Debug, Clone)]
struct PhonePattern {
    regex: Regex,
    carrier: String,
    format: String,
}

impl PhoneValidationService {
    pub fn new() -> Self {
        let mut patterns = HashMap::new();
        
        // Patterns pour le Cameroun
        patterns.insert("CM".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+237|237)?(6[0-9]{8}|2[0-9]{8})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+237{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+237|237)?(6[0-9]{8}|2[0-9]{8})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+237{}".to_string(),
            },
        ]);
        
        // Patterns pour la Côte d'Ivoire
        patterns.insert("CI".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+225|225)?(0[0-9]{9}|[0-9]{9})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+225{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+225|225)?(0[0-9]{9}|[0-9]{9})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+225{}".to_string(),
            },
        ]);
        
        // Patterns pour le Burkina Faso
        patterns.insert("BF".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+226|226)?(7[0-9]{7}|6[0-9]{7})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+226{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+226|226)?(7[0-9]{7}|6[0-9]{7})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+226{}".to_string(),
            },
        ]);
        
        // Patterns pour le Mali
        patterns.insert("ML".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+223|223)?(6[0-9]{7}|7[0-9]{7})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+223{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+223|223)?(6[0-9]{7}|7[0-9]{7})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+223{}".to_string(),
            },
        ]);
        
        // Patterns pour le Niger
        patterns.insert("NE".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+227|227)?(9[0-9]{7}|8[0-9]{7})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+227{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+227|227)?(9[0-9]{7}|8[0-9]{7})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+227{}".to_string(),
            },
        ]);
        
        // Patterns pour le Sénégal
        patterns.insert("SN".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+221|221)?(7[0-9]{8}|3[0-9]{8})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+221{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+221|221)?(7[0-9]{8}|3[0-9]{8})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+221{}".to_string(),
            },
        ]);
        
        // Patterns pour le Togo
        patterns.insert("TG".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+228|228)?(9[0-9]{7}|2[0-9]{7})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+228{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+228|228)?(9[0-9]{7}|2[0-9]{7})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+228{}".to_string(),
            },
        ]);
        
        // Patterns pour Madagascar
        patterns.insert("MG".to_string(), vec![
            PhonePattern {
                regex: Regex::new(r"^(\+261|261)?(3[0-9]{8}|2[0-9]{8})$").unwrap(),
                carrier: "Orange".to_string(),
                format: "+261{}".to_string(),
            },
            PhonePattern {
                regex: Regex::new(r"^(\+261|261)?(3[0-9]{8}|2[0-9]{8})$").unwrap(),
                carrier: "MTN".to_string(),
                format: "+261{}".to_string(),
            },
        ]);

        Self { patterns }
    }

    pub fn validate_phone_number(&self, request: PhoneValidationRequest) -> PhoneValidationResult {
        let phone_number = request.phone_number.trim();
        
        // Nettoyer le numéro (supprimer espaces, tirets, etc.)
        let cleaned_number = phone_number
            .chars()
            .filter(|c| c.is_ascii_digit() || *c == '+')
            .collect::<String>();

        if cleaned_number.is_empty() {
            return PhoneValidationResult {
                is_valid: false,
                formatted_number: None,
                country_code: None,
                carrier: None,
                error_message: Some("Numéro de téléphone vide".to_string()),
            };
        }

        // Si un pays est spécifié, valider pour ce pays
        if let Some(country) = request.country {
            if let Some(country_patterns) = self.patterns.get(&country) {
                for pattern in country_patterns {
                    if pattern.regex.is_match(&cleaned_number) {
                        let formatted = self.format_number(&cleaned_number, &pattern.format);
                        return PhoneValidationResult {
                            is_valid: true,
                            formatted_number: Some(formatted),
                            country_code: Some(country),
                            carrier: Some(pattern.carrier.clone()),
                            error_message: None,
                        };
                    }
                }
                
                return PhoneValidationResult {
                    is_valid: false,
                    formatted_number: None,
                    country_code: Some(country.clone()),
                    carrier: None,
                    error_message: Some(format!("Format de numéro invalide pour {}", country)),
                };
            }
        }

        // Si aucun pays spécifié, essayer de détecter automatiquement
        for (country, patterns) in &self.patterns {
            for pattern in patterns {
                if pattern.regex.is_match(&cleaned_number) {
                    let formatted = self.format_number(&cleaned_number, &pattern.format);
                    return PhoneValidationResult {
                        is_valid: true,
                        formatted_number: Some(formatted),
                        country_code: Some(country.clone()),
                        carrier: Some(pattern.carrier.clone()),
                        error_message: None,
                    };
                }
            }
        }

        PhoneValidationResult {
            is_valid: false,
            formatted_number: None,
            country_code: None,
            carrier: None,
            error_message: Some("Format de numéro non reconnu".to_string()),
        }
    }

    fn format_number(&self, number: &str, format: &str) -> String {
        // Extraire les chiffres du numéro
        let digits: String = number.chars().filter(|c| c.is_ascii_digit()).collect();
        
        // Appliquer le format
        if format.contains("{}") {
            format.replace("{}", &digits)
        } else {
            format.to_string()
        }
    }

    pub fn get_supported_countries(&self) -> Vec<String> {
        self.patterns.keys().cloned().collect()
    }

    pub fn get_carriers_for_country(&self, country: &str) -> Vec<String> {
        if let Some(patterns) = self.patterns.get(country) {
            patterns.iter().map(|p| p.carrier.clone()).collect()
        } else {
            vec![]
        }
    }
}

impl Default for PhoneValidationService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cameroon_phone_validation() {
        let service = PhoneValidationService::new();
        
        // Test numéro Orange Cameroun
        let request = PhoneValidationRequest {
            phone_number: "675123456".to_string(),
            country: Some("CM".to_string()),
        };
        
        let result = service.validate_phone_number(request);
        assert!(result.is_valid);
        assert_eq!(result.country_code, Some("CM".to_string()));
        assert!(result.carrier.is_some());
    }

    #[test]
    fn test_invalid_phone_validation() {
        let service = PhoneValidationService::new();
        
        let request = PhoneValidationRequest {
            phone_number: "123".to_string(),
            country: Some("CM".to_string()),
        };
        
        let result = service.validate_phone_number(request);
        assert!(!result.is_valid);
        assert!(result.error_message.is_some());
    }

    #[test]
    fn test_phone_formatting() {
        let service = PhoneValidationService::new();
        
        let request = PhoneValidationRequest {
            phone_number: "675123456".to_string(),
            country: Some("CM".to_string()),
        };
        
        let result = service.validate_phone_number(request);
        assert!(result.is_valid);
        assert!(result.formatted_number.is_some());
        assert!(result.formatted_number.unwrap().starts_with("+237"));
    }
}
