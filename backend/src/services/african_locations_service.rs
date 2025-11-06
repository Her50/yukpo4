// 🗺️ Service de géolocalisation locale pour l'Afrique francophone
// Fournit la hiérarchie DESCENDANTE (enfants) manquante dans Google Places API

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AfricanCity {
    pub nom: String,
    pub pays: String,
    pub quartiers: Vec<String>,
}

/// Service pour récupérer les enfants (quartiers) d'une ville
pub struct AfricanLocationsService {
    cities: HashMap<String, AfricanCity>,
}

impl AfricanLocationsService {
    pub fn new() -> Self {
        let mut cities = HashMap::new();
        
        // ✅ CAMEROUN - Données extraites de africanLocations.ts
        cities.insert("douala".to_string(), AfricanCity {
            nom: "Douala".to_string(),
            pays: "Cameroun".to_string(),
            quartiers: vec![
                "Akwa", "Bonanjo", "Bali", "Bonapriso", "Bonamoussadi",
                "Bonabéri", "New Bell", "Deido", "Bépanda", "Ndogbong",
                "Makepe", "Logpom", "Logbaba", "Ndogpassi I", "Ndogpassi II", "Ndogpassi III",
                "Kotto", "PK8", "PK10", "PK11", "PK12", "PK14", "PK17",
                "Bessengue", "Bonamoussadi Bel Air",
                "Village", "Japoma", "Yassa", "Ndog-Bong", "Ndogsimbi",
                "Cité des Palmiers", "Sonel", "Camp Yabassi",
                "Bassa Industrial", "Bonassama", "Petit Pays", "Mabanda", "Mboppi", "Omnisport"
            ].iter().map(|s| s.to_string()).collect(),
        });
        
        cities.insert("yaoundé".to_string(), AfricanCity {
            nom: "Yaoundé".to_string(),
            pays: "Cameroun".to_string(),
            quartiers: vec![
                "Centre-ville", "Poste Centrale", "Mvog-Ada",
                "Bastos", "Nlongkak", "Santa Barbara", "Golf", "Hippodrome",
                "Elig-Essono", "Nkolbisson", "Simbock", "Odza", "Nkoldongo",
                "Mfandena", "Ngoa-Ekelle", "Mvan", "Ekounou", "Elig-Edzoa",
                "Nsimeyong", "Briqueterie", "Tsinga", "Messa", "Mvog-Mbi",
                "Emana", "Etoug-Ebe", "Nkomo", "Essos",
                "Mokolo", "Madagascar", "Mendong", "Obili", "Omnisport", "Mimboman"
            ].iter().map(|s| s.to_string()).collect(),
        });
        
        cities.insert("garoua".to_string(), AfricanCity {
            nom: "Garoua".to_string(),
            pays: "Cameroun".to_string(),
            quartiers: vec![
                "Centre-ville", "Plateau", "Ouro-Kessoum", "Djamboutou", "Balaré",
                "Demsa", "Kollere", "Roumdé Adjia", "Doualaré", "Mokolo"
            ].iter().map(|s| s.to_string()).collect(),
        });
        
        cities.insert("bafoussam".to_string(), AfricanCity {
            nom: "Bafoussam".to_string(),
            pays: "Cameroun".to_string(),
            quartiers: vec![
                "Centre-ville", "Tamdja", "Famla", "Djeleng", "Ngouache",
                "Tougang", "Ndiandam", "Kamkop", "Université", "Marché A"
            ].iter().map(|s| s.to_string()).collect(),
        });
        
        // ✅ SÉNÉGAL
        cities.insert("dakar".to_string(), AfricanCity {
            nom: "Dakar".to_string(),
            pays: "Sénégal".to_string(),
            quartiers: vec![
                "Plateau", "Médina", "HLM", "Parcelles Assainies", "Grand Yoff",
                "Ouakam", "Ngor", "Almadies", "Point E", "Mermoz",
                "Sacré-Cœur", "Fann", "Liberté", "Sicap"
            ].iter().map(|s| s.to_string()).collect(),
        });
        
        // ✅ CÔTE D'IVOIRE
        cities.insert("abidjan".to_string(), AfricanCity {
            nom: "Abidjan".to_string(),
            pays: "Côte d'Ivoire".to_string(),
            quartiers: vec![
                "Plateau", "Cocody", "Yopougon", "Abobo", "Adjamé",
                "Treichville", "Marcory", "Koumassi", "Port-Bouët", "Attécoubé",
                "Riviera", "Deux Plateaux", "Angré", "Zone 4"
            ].iter().map(|s| s.to_string()).collect(),
        });
        
        Self { cities }
    }
    
    /// Récupère les quartiers d'une ville
    pub fn get_children(&self, place_name: &str, place_type: &str) -> Vec<String> {
        let place_lower = place_name.to_lowercase();
        
        match place_type {
            "city" | "locality" => {
                // Retourner les quartiers de cette ville
                if let Some(city) = self.cities.get(&place_lower) {
                    city.quartiers.clone()
                } else {
                    vec![]
                }
            },
            "country" => {
                // Retourner toutes les villes de ce pays
                let country_lower = place_name.to_lowercase();
                self.cities.values()
                    .filter(|city| city.pays.to_lowercase().contains(&country_lower))
                    .map(|city| city.nom.clone())
                    .collect()
            },
            _ => vec![]
        }
    }
    
    /// Détermine le type de lieu (pays, ville, quartier)
    pub fn get_place_type(&self, place_name: &str) -> &str {
        let place_lower = place_name.to_lowercase();
        
        // Liste des pays
        let countries = vec!["cameroun", "sénégal", "côte d'ivoire", "mali", "burkina faso"];
        if countries.iter().any(|c| place_lower.contains(c)) {
            return "country";
        }
        
        // Vérifier si c'est une ville connue
        if self.cities.contains_key(&place_lower) {
            return "city";
        }
        
        // Vérifier si c'est un quartier
        for city in self.cities.values() {
            if city.quartiers.iter().any(|q| q.to_lowercase() == place_lower) {
                return "neighborhood";
            }
        }
        
        "unknown"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_get_quartiers_douala() {
        let service = AfricanLocationsService::new();
        let quartiers = service.get_children("Douala", "city");
        assert!(quartiers.len() > 30);
        assert!(quartiers.contains(&"Akwa".to_string()));
        assert!(quartiers.contains(&"Makepe".to_string()));
    }
    
    #[test]
    fn test_get_villes_cameroun() {
        let service = AfricanLocationsService::new();
        let villes = service.get_children("Cameroun", "country");
        assert!(villes.contains(&"Douala".to_string()));
        assert!(villes.contains(&"Yaoundé".to_string()));
    }
}

