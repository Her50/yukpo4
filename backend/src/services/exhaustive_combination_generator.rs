// Service de génération exhaustive de combinaisons
use crate::core::types::AppError;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrictDependency {
    pub id: String,
    pub dimensions: Vec<String>,
    pub explanation: Option<String>,
    pub valid_combinations: Vec<Vec<String>>,
}

#[derive(Debug)]
pub struct ExhaustiveCombinationGenerator {
    pub dimensions: Vec<String>,
    pub modalities: HashMap<String, Vec<String>>,
    pub dependencies: Vec<StrictDependency>,
}

impl ExhaustiveCombinationGenerator {
    /// Créer depuis la réponse IA
    pub fn from_ia_response(ai_data: &serde_json::Value) -> Result<Self, AppError> {
        let produits = &ai_data["data"]["produits"];

        // Extraire l'ordre des dimensions
        let dimensions: Vec<String> = if let Some(ordre) = produits.get("ordre_dimensions") {
            ordre
                .as_array()
                .ok_or_else(|| AppError::BadRequest("ordre_dimensions invalide".to_string()))?
                .iter()
                .filter_map(|v| v.as_str())
                .map(String::from)
                .collect()
        } else {
            // Fallback : extraire depuis sous_caracteristiques
            produits["sous_caracteristiques"]
                .as_object()
                .ok_or_else(|| AppError::BadRequest("sous_caracteristiques manquant".to_string()))?
                .keys()
                .cloned()
                .collect()
        };

        // Extraire modalités
        let sous_caracs = produits["sous_caracteristiques"]
            .as_object()
            .ok_or_else(|| AppError::BadRequest("sous_caracteristiques manquant".to_string()))?;

        let mut modalities = HashMap::new();
        for (dim, values) in sous_caracs {
            let vals: Vec<String> = values
                .as_array()
                .ok_or_else(|| AppError::BadRequest(format!("Modalités invalides pour {}", dim)))?
                .iter()
                .filter_map(|v| v.as_str())
                .map(String::from)
                .collect();

            modalities.insert(dim.clone(), vals);
        }

        // Extraire dépendances
        let mut dependencies = Vec::new();
        if let Some(deps) = produits
            .get("dependencies")
            .and_then(|d| d.get("strict"))
            .and_then(|s| s.as_array())
        {
            for dep in deps {
                let id = dep.get("id").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();

                let dims: Vec<String> = dep["dimensions"]
                    .as_array()
                    .ok_or_else(|| {
                        AppError::BadRequest("dimensions manquant dans dependency".to_string())
                    })?
                    .iter()
                    .filter_map(|v| v.as_str())
                    .map(String::from)
                    .collect();

                let explanation = dep.get("explanation").and_then(|v| v.as_str()).map(String::from);

                let combos: Vec<Vec<String>> = dep["valid_combinations"]
                    .as_array()
                    .ok_or_else(|| AppError::BadRequest("valid_combinations manquant".to_string()))?
                    .iter()
                    .filter_map(|combo| {
                        combo.as_array().map(|arr| {
                            arr.iter().filter_map(|v| v.as_str()).map(String::from).collect()
                        })
                    })
                    .collect();

                dependencies.push(StrictDependency {
                    id,
                    dimensions: dims,
                    explanation,
                    valid_combinations: combos,
                });
            }
        }

        log::info!(
            "[Generator] Initialisé: {} dimensions, {} dépendances",
            dimensions.len(),
            dependencies.len()
        );

        for dep in &dependencies {
            log::info!(
                "[Generator] Dépendance '{}': {:?} → {} combinaisons valides",
                dep.id,
                dep.dimensions,
                dep.valid_combinations.len()
            );
        }

        Ok(Self {
            dimensions,
            modalities,
            dependencies,
        })
    }

    /// Estimer le nombre total de combinaisons
    pub fn estimate_total_combinations(&self) -> usize {
        let dependent_dims: HashSet<String> =
            self.dependencies.iter().flat_map(|d| d.dimensions.clone()).collect();

        // Calculer le produit cartésien des tuples dépendants
        let mut dependent_tuples_count = 1;
        for dep in &self.dependencies {
            dependent_tuples_count *= dep.valid_combinations.len();
        }

        // Calculer le produit des dimensions indépendantes
        let mut independent_product = 1;
        for dim in &self.dimensions {
            if !dependent_dims.contains(dim) {
                if let Some(values) = self.modalities.get(dim) {
                    independent_product *= values.len();
                }
            }
        }

        dependent_tuples_count * independent_product
    }

    /// Générer TOUTES les combinaisons valides
    pub fn generate_all_valid_combinations(&self) -> Vec<Vec<String>> {
        let start = std::time::Instant::now();
        let mut result = Vec::new();

        // Identifier dimensions indépendantes
        let dependent_dims: HashSet<String> =
            self.dependencies.iter().flat_map(|d| d.dimensions.clone()).collect();

        let independent_dims: Vec<String> = self
            .dimensions
            .iter()
            .filter(|d| !dependent_dims.contains(*d))
            .cloned()
            .collect();

        log::info!(
            "[Generator] Dimensions dépendantes: {}",
            dependent_dims.len()
        );
        log::info!(
            "[Generator] Dimensions indépendantes: {}",
            independent_dims.len()
        );

        // Générer produit cartésien des tuples dépendants
        let dependent_tuples = self.generate_dependent_tuples();

        log::info!(
            "[Generator] {} tuples dépendants générés",
            dependent_tuples.len()
        );

        // Pour chaque tuple dépendant, générer toutes les variantes indépendantes
        for (idx, tuple) in dependent_tuples.iter().enumerate() {
            if idx % 100 == 0 && idx > 0 {
                log::info!(
                    "[Generator] Progression: {}/{} tuples ({:.1}%)",
                    idx,
                    dependent_tuples.len(),
                    (idx as f64 / dependent_tuples.len() as f64) * 100.0
                );
            }

            self.generate_with_fixed_dependent(tuple, &independent_dims, &mut result);
        }

        log::info!(
            "[Generator] ✅ {} combinaisons générées en {:?}",
            result.len(),
            start.elapsed()
        );

        result
    }

    /// Générer produit cartésien de tous les groupes de dépendances
    fn generate_dependent_tuples(&self) -> Vec<HashMap<String, String>> {
        if self.dependencies.is_empty() {
            return vec![HashMap::new()];
        }

        let mut current: Vec<HashMap<String, String>> = vec![HashMap::new()];

        for dep in &self.dependencies {
            let mut next = Vec::new();

            for existing_tuple in &current {
                for valid_combo in &dep.valid_combinations {
                    let mut new_tuple = existing_tuple.clone();

                    for (i, dim) in dep.dimensions.iter().enumerate() {
                        new_tuple.insert(dim.clone(), valid_combo[i].clone());
                    }

                    next.push(new_tuple);
                }
            }

            current = next;
        }

        current
    }

    /// Générer toutes les variantes avec tuple dépendant fixé
    fn generate_with_fixed_dependent(
        &self,
        fixed_tuple: &HashMap<String, String>,
        independent_dims: &[String],
        result: &mut Vec<Vec<String>>,
    ) {
        // Extraire valeurs des dimensions indépendantes
        let independent_values: Vec<Vec<String>> = independent_dims
            .iter()
            .filter_map(|dim| self.modalities.get(dim))
            .cloned()
            .collect();

        if independent_values.is_empty() {
            // Aucune dimension indépendante, juste construire la combinaison
            let combo = self.build_combination(fixed_tuple, &[]);
            result.push(combo);
            return;
        }

        // Produit cartésien des dimensions indépendantes
        let cartesian = self.cartesian_product(&independent_values);

        // Construire combinaisons complètes
        for independent_combo in cartesian {
            let combo = self.build_combination(fixed_tuple, &independent_combo);
            result.push(combo);
        }
    }

    /// Construire une combinaison dans l'ordre des dimensions
    fn build_combination(
        &self,
        fixed_tuple: &HashMap<String, String>,
        independent_values: &[String],
    ) -> Vec<String> {
        let mut combo = Vec::new();
        let mut independent_idx = 0;

        for dim in &self.dimensions {
            if let Some(value) = fixed_tuple.get(dim) {
                // Dimension dépendante
                combo.push(value.clone());
            } else {
                // Dimension indépendante
                if independent_idx < independent_values.len() {
                    combo.push(independent_values[independent_idx].clone());
                    independent_idx += 1;
                } else {
                    combo.push(String::new());
                }
            }
        }

        combo
    }

    /// Produit cartésien générique
    fn cartesian_product(&self, sets: &[Vec<String>]) -> Vec<Vec<String>> {
        if sets.is_empty() {
            return vec![vec![]];
        }

        sets.iter().fold(vec![vec![]], |acc, set| {
            acc.into_iter()
                .flat_map(|prefix| {
                    set.iter().map(move |item| {
                        let mut new_prefix = prefix.clone();
                        new_prefix.push(item.clone());
                        new_prefix
                    })
                })
                .collect()
        })
    }
}
