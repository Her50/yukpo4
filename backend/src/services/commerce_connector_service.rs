use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::core::types::{AppError, AppResult};

#[derive(Clone)]
pub struct CommerceConnectorService {
    pool: PgPool,
}

impl CommerceConnectorService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn snapshot_by_index(
        &self,
        service_id: i32,
        product_index: i32,
    ) -> AppResult<ProductConnectorSnapshot> {
        let row = sqlx::query!(
            r#"
            SELECT
                pl.id,
                pl.product_nom,
                pl.product_type,
                pl.is_active,
                pl.auto_deactivate_at,
                pl.last_reactivated_at,
                pl.reactivation_cost,
                pl.deactivation_count,
                s.data AS "service_data: serde_json::Value"
            FROM products_lifecycle pl
            JOIN services s ON s.id = pl.service_id
            WHERE pl.service_id = $1
              AND pl.product_index = $2
            "#,
            service_id,
            product_index
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(AppError::from)?;

        let Some(row) = row else {
            return Err(AppError::NotFound(format!(
                "Produit {service_id}:{product_index} introuvable"
            )));
        };

        let product_node = extract_product_node(&row.service_data, product_index as usize)
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Impossible de récupérer le produit index {} dans service {}",
                    product_index, service_id
                ))
            })?;

        let parsed = parse_product_attributes(&product_node);

        let metadata = json!({
            "lifecycle": {
                "id": row.id,
                "is_active": row.is_active,
                "auto_deactivate_at": row.auto_deactivate_at,
                "last_reactivated_at": row.last_reactivated_at,
                "reactivation_cost": row.reactivation_cost,
                "deactivation_count": row.deactivation_count,
            },
            "product_node": product_node,
        });

        Ok(ProductConnectorSnapshot {
            service_id,
            product_index,
            lifecycle_id: row.id,
            product_name: row.product_nom,
            product_type: row.product_type,
            is_active: row.is_active.unwrap_or(true),
            price_cents: parsed.price_cents,
            currency: parsed.currency,
            stock: parsed.stock,
            promotion_active: parsed.promotion_active,
            promotion_label: parsed.promotion_label,
            promotion_value: parsed.promotion_value,
            promotion_expires_at: parsed.promotion_expires_at,
            delivery_eta_minutes: parsed.delivery_eta_minutes,
            delivery_modes: parsed.delivery_modes,
            connectors: parsed.connectors,
            metadata,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProductConnectorSnapshot {
    pub service_id: i32,
    pub product_index: i32,
    pub lifecycle_id: i32,
    pub product_name: String,
    pub product_type: String,
    pub is_active: bool,
    pub price_cents: Option<i64>,
    pub currency: Option<String>,
    pub stock: Option<i32>,
    pub promotion_active: bool,
    pub promotion_label: Option<String>,
    pub promotion_value: Option<String>,
    pub promotion_expires_at: Option<DateTime<Utc>>,
    pub delivery_eta_minutes: Option<i32>,
    pub delivery_modes: Vec<String>,
    pub connectors: Vec<String>,
    pub metadata: Value,
}

#[derive(Debug)]
struct ParsedProductAttributes {
    price_cents: Option<i64>,
    currency: Option<String>,
    stock: Option<i32>,
    promotion_active: bool,
    promotion_label: Option<String>,
    promotion_value: Option<String>,
    promotion_expires_at: Option<DateTime<Utc>>,
    delivery_eta_minutes: Option<i32>,
    delivery_modes: Vec<String>,
    connectors: Vec<String>,
}

fn extract_product_node(service_data: &Value, product_index: usize) -> Option<Value> {
    let produits = service_data.get("produits")?;
    if let Some(obj) = produits.as_object() {
        if let Some(array) = obj.get("valeur").and_then(|v| v.as_array()) {
            return array.get(product_index).cloned();
        }
    }
    if let Some(array) = produits.as_array() {
        return array.get(product_index).cloned();
    }
    None
}

fn parse_product_attributes(product: &Value) -> ParsedProductAttributes {
    let mut connectors = vec!["lifecycle".to_string()];

    let price_cents = extract_price_cents(product).map(|value| {
        connectors.push("pricing:form".to_string());
        value
    });
    let currency = extract_string(product, &["currency", "devise"]).map(|value| {
        connectors.push(format!("currency:{}", value.to_lowercase()));
        value
    });

    let stock = extract_stock(product).map(|value| {
        connectors.push("inventory:form".to_string());
        value
    });

    let mut promotion_active =
        extract_bool(product, &["promotion_active", "en_promotion"]).unwrap_or(false);
    let promotion_label = extract_string(
        product,
        &["promotion_label", "promotionValeur", "promotion"],
    );
    let promotion_value = extract_string(
        product,
        &["promotion_value", "promotionValeur", "promo_value"],
    );

    if !promotion_active && (promotion_label.is_some() || promotion_value.is_some()) {
        promotion_active = true;
    }

    if promotion_active {
        connectors.push("promotion:form".to_string());
    }

    let promotion_expires_at =
        extract_string(product, &["promotion_expire_at", "promotionExpireAt"])
            .and_then(parse_datetime);

    let delivery_eta_minutes = extract_number(
        product,
        &[
            "delivery_eta",
            "delivery_eta_minutes",
            "delai_livraison",
            "delai_livraison_min",
        ],
    )
    .map(|value| value as i32);

    let delivery_modes = extract_array_strings(
        product,
        &["delivery_modes", "livraison_modes", "delivery_options"],
    );

    if delivery_eta_minutes.is_some() || !delivery_modes.is_empty() {
        connectors.push("delivery:form".to_string());
    }

    ParsedProductAttributes {
        price_cents,
        currency,
        stock,
        promotion_active,
        promotion_label,
        promotion_value,
        promotion_expires_at,
        delivery_eta_minutes,
        delivery_modes,
        connectors,
    }
}

fn extract_price_cents(product: &Value) -> Option<i64> {
    if let Some(value) = extract_number(product, &["price_cents", "prix_cents"]) {
        return Some(value.round() as i64);
    }

    if let Some(value) = extract_number(product, &["prix", "price"]) {
        return Some((value * 100.0).round() as i64);
    }

    if let Some(modalites) = extract_modalites(product) {
        let mut min_price = None;
        for modalite in modalites {
            if let Some(price) = extract_number(modalite, &["price_cents", "prix_cents"]) {
                min_price = Some(min_price.map_or(price, |current: f64| current.min(price)));
            } else if let Some(price) = extract_number(modalite, &["prix", "price"]) {
                let cents = price * 100.0;
                min_price = Some(min_price.map_or(cents, |current: f64| current.min(cents)));
            }
        }
        if let Some(value) = min_price {
            return Some(value.round() as i64);
        }
    }

    None
}

fn extract_stock(product: &Value) -> Option<i32> {
    if let Some(value) = extract_number(product, &["stock", "stock_disponible", "quantite"]) {
        return Some(value.round() as i32);
    }

    if let Some(modalites) = extract_modalites(product) {
        let mut total_stock = 0;
        let mut found = false;
        for modalite in modalites {
            if let Some(value) = extract_number(modalite, &["stock", "quantite"]) {
                total_stock += value.round() as i32;
                found = true;
            }
        }
        if found {
            return Some(total_stock);
        }
    }

    None
}

fn extract_modalites<'a>(product: &'a Value) -> Option<Vec<&'a Value>> {
    let keys = [
        "variabilite_prix",
        "variation_prix",
        "variants",
        "variations",
    ];
    for key in keys {
        if let Some(array) = product
            .get(key)
            .and_then(|v| v.get("modalites"))
            .and_then(|v| v.as_array())
        {
            return Some(array.iter().collect());
        }
        if let Some(array) = product.get(key).and_then(|v| v.as_array()) {
            return Some(array.iter().collect());
        }
    }
    None
}

fn extract_bool(value: &Value, keys: &[&str]) -> Option<bool> {
    for key in keys {
        if let Some(result) = value.get(key).and_then(|v| v.as_bool()) {
            return Some(result);
        }
    }
    None
}

fn extract_number(value: &Value, keys: &[&str]) -> Option<f64> {
    for key in keys {
        if let Some(result) = value.get(key) {
            if let Some(num) = result.as_f64() {
                return Some(num);
            }
            if let Some(num) = result.as_i64() {
                return Some(num as f64);
            }
            if let Some(num) = result.as_u64() {
                return Some(num as f64);
            }
            if let Some(text) = result.as_str() {
                if let Ok(parsed) = text.replace('_', "").parse::<f64>() {
                    return Some(parsed);
                }
            }
        }
    }
    None
}

fn extract_string(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(result) = value.get(key) {
            match result {
                Value::String(text) if !text.trim().is_empty() => {
                    return Some(text.trim().to_string())
                }
                Value::Number(num) => return Some(num.to_string()),
                _ => continue,
            }
        }
    }
    None
}

fn extract_array_strings(value: &Value, keys: &[&str]) -> Vec<String> {
    for key in keys {
        if let Some(array) = value.get(key).and_then(|v| v.as_array()) {
            return array
                .iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect();
        }
    }
    vec![]
}

fn parse_datetime(raw: String) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw.trim())
        .map(|dt| dt.with_timezone(&Utc))
        .ok()
}
