// 🔄 Script de réindexation des services existants dans autocomplete_*
// À exécuter UNE FOIS pour indexer les produits créés avant le système autocomplete

use sqlx::PgPool;
use log::{info, warn, error};
use serde_json::Value;

/// Réindexe tous les services existants dans autocomplete_characteristics et autocomplete_combinations
pub async fn reindex_all_services(pool: &PgPool) -> Result<usize, sqlx::Error> {
    info!("🔄 Début réindexation des services existants...");
    
    // Récupérer tous les services actifs avec leurs produits
    let services = sqlx::query_as::<_, (i32, Value)>(
        "SELECT id, data FROM services WHERE is_active = TRUE AND data->'produits' IS NOT NULL"
    )
    .fetch_all(pool)
    .await?;
    
    info!("📊 {} services à réindexer", services.len());
    
    let mut indexed_count = 0;
    
    for (service_id, data_obj) in services {
        // Extraire vecteur produit
        let produits_field = match data_obj.get("produits") {
            Some(p) => p,
            None => continue,
        };
        
        let product_vector: Vec<String> = if let Some(valeur) = produits_field.get("valeur") {
            if let Some(valeur_array) = valeur.as_array() {
                valeur_array.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            } else {
                continue;
            }
        } else {
            continue;
        };
        
        if product_vector.is_empty() {
            continue;
        }
        
        // Extraire lieu
        let lieu_str = data_obj.get("lieu_produit")
            .or_else(|| data_obj.get("lieu_commercial"))
            .or_else(|| data_obj.get("lieu_commercialisation"))
            .and_then(|l| l.get("valeur"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let location_vector: Vec<String> = if let Some(lieu) = &lieu_str {
            // Simplification : juste mettre le lieu tel quel (pas d'enrichissement GeoNames pour éviter surcharge)
            vec![lieu.clone()]
        } else {
            vec![]
        };
        
        // Vecteur complet
        let mut full_vector = product_vector.clone();
        full_vector.extend(location_vector.clone());
        
        // Extraire labels
        let product_labels: Vec<String> = if let Some(sous_caracs) = produits_field.get("sous_caracteristiques").and_then(|v| v.as_object()) {
            sous_caracs.keys().map(|k| k.to_string()).collect()
        } else {
            vec![]
        };
        
        // Extraire prix
        let prix = produits_field.get("prix")
            .and_then(|p| p.get("valeur"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<f64>().ok());
        
        let product_id = format!("product_{}", service_id);
        
        // Insérer dans autocomplete_characteristics
        let result_char = sqlx::query(
            r#"INSERT INTO autocomplete_characteristics 
               (identifiant_base, service_id, product_id,
                characteristic_vector, product_labels, location_vector, full_vector,
                chosen_location, is_real_product, origine_champs, usage_count,
                sous_caracteristique, valeur)
               VALUES ('produits', $1, $2, $3, $4, $5, $6, $7, TRUE, 'reindex', 1, 'vector', $8)
               ON CONFLICT DO NOTHING"#
        )
        .bind(service_id)
        .bind(&product_id)
        .bind(&product_vector)
        .bind(&product_labels)
        .bind(&location_vector)
        .bind(&full_vector)
        .bind(&lieu_str)
        .bind(product_vector.get(0).unwrap_or(&String::new()))
        .execute(pool)
        .await;
        
        if let Err(e) = result_char {
            error!("❌ Erreur réindexation service {}: {}", service_id, e);
            continue;
        }
        
        // Insérer dans autocomplete_combinations
        let result_comb = sqlx::query(
            r#"INSERT INTO autocomplete_combinations 
               (service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                has_variant, prix, usage_count)
               VALUES ($1, $2, $3, '{}', '{}', $2, false, $4, 1)
               ON CONFLICT (full_vector)
               DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1"#
        )
        .bind(service_id)
        .bind(&product_vector)
        .bind(&product_labels)
        .bind(prix)
        .execute(pool)
        .await;
        
        if let Err(e) = result_comb {
            error!("❌ Erreur autocomplete_combinations service {}: {}", service_id, e);
        }
        
        indexed_count += 1;
        
        if indexed_count % 10 == 0 {
            info!("📊 Progression: {} services réindexés", indexed_count);
        }
    }
    
    info!("✅ Réindexation terminée: {} services indexés", indexed_count);
    Ok(indexed_count)
}

