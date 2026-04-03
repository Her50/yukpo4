// Service de génération de flux produits
// - Google Shopping XML (RSS 2.0 + Google Base namespace)
// - CSV générique / format Jumia / format Google

use sqlx::PgPool;
use sqlx::Row;

use crate::core::types::{AppError, AppResult};

const YUKPO_BASE: &str = "https://yukpomnang.com";

// ─────────────────────────────────────────────────────────────
// Google Shopping XML Feed
// ─────────────────────────────────────────────────────────────

pub async fn generate_google_shopping_xml(pool: &PgPool, partner_id: i32) -> AppResult<String> {
    // Récupérer les infos du partenaire (service supermarché ou e-commerce)
    let svc = sqlx::query(
        r#"SELECT
               id,
               data->>'nom'      AS nom,
               data->>'name'     AS name_alt,
               data->>'adresse'  AS adresse,
               data->>'description' AS description
           FROM services
           WHERE id = $1
             AND type IN ('supermarche', 'ecommerce', 'boutique', 'pharmacie')
           LIMIT 1"#,
    )
    .bind(partner_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?;

    let svc = svc.ok_or_else(|| AppError::NotFound("Partenaire non trouvé".into()))?;

    let store_name: String = svc
        .try_get::<Option<String>, _>("nom")
        .ok()
        .flatten()
        .or_else(|| svc.try_get::<Option<String>, _>("name_alt").ok().flatten())
        .unwrap_or_else(|| "Boutique Yukpo".to_string());

    let store_description: String = svc
        .try_get::<Option<String>, _>("description")
        .ok()
        .flatten()
        .unwrap_or_else(|| format!("Produits de {}", store_name));

    let store_url = format!("{}/store/{}", YUKPO_BASE, partner_id);

    // Récupérer les produits actifs
    let products = sqlx::query(
        r#"SELECT
               id,
               name,
               description,
               price,
               category,
               image_url,
               stock,
               is_promotion,
               promotional_price
           FROM service_products
           WHERE service_id = $1
             AND is_active = true
           ORDER BY id
           LIMIT 1000"#,
    )
    .bind(partner_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    let mut items = String::new();

    for row in &products {
        let id: i32 = row.try_get("id").unwrap_or(0);
        let name: String = row.try_get("name").unwrap_or_default();
        let description: String = row
            .try_get::<Option<String>, _>("description")
            .ok()
            .flatten()
            .unwrap_or_else(|| name.clone());
        let price: f64 = row.try_get("price").unwrap_or(0.0);
        let is_promo: bool = row.try_get("is_promotion").unwrap_or(false);
        let promo_price: Option<f64> = row.try_get("promotional_price").ok().flatten();
        let category: String = row
            .try_get::<Option<String>, _>("category")
            .ok()
            .flatten()
            .unwrap_or_else(|| "Général".to_string());
        let image_url: Option<String> = row.try_get("image_url").ok().flatten();
        let stock: Option<i32> = row.try_get("stock").ok().flatten();

        let effective_price = if is_promo {
            promo_price.unwrap_or(price)
        } else {
            price
        };

        let availability = if stock.map(|s| s > 0).unwrap_or(true) {
            "in stock"
        } else {
            "out of stock"
        };

        let product_link = format!(
            "{}/product/{}?serviceId={}&utm_source=google_shopping&utm_medium=feed&utm_campaign=yukpo",
            YUKPO_BASE, id, partner_id
        );

        let image_tag = match &image_url {
            Some(url) if !url.is_empty() => {
                format!("\n      <g:image_link>{}</g:image_link>", xml_escape(url))
            }
            _ => String::new(),
        };

        let promo_tag = if is_promo && promo_price.is_some() {
            format!(
                "\n      <g:sale_price>{:.0} XAF</g:sale_price>",
                promo_price.unwrap_or(price)
            )
        } else {
            String::new()
        };

        items.push_str(&format!(
            r#"
    <item>
      <g:id>{id}</g:id>
      <g:title>{title}</g:title>
      <g:description>{desc}</g:description>
      <g:link>{link}</g:link>{image}
      <g:price>{price:.0} XAF</g:price>{promo}
      <g:availability>{availability}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>{brand}</g:brand>
      <g:google_product_category>{cat}</g:google_product_category>
      <g:identifier_exists>no</g:identifier_exists>
    </item>"#,
            id = id,
            title = xml_escape(&name),
            desc = xml_escape(&description),
            link = xml_escape(&product_link),
            image = image_tag,
            price = effective_price,
            promo = promo_tag,
            availability = availability,
            brand = xml_escape(&store_name),
            cat = xml_escape(&category),
        ));
    }

    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>{store_name}</title>
    <link>{store_url}</link>
    <description>{store_description}</description>{items}
  </channel>
</rss>"#,
        store_name = xml_escape(&store_name),
        store_url = xml_escape(&store_url),
        store_description = xml_escape(&store_description),
        items = items,
    );

    Ok(xml)
}

// ─────────────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────────────

pub async fn generate_csv_export(
    pool: &PgPool,
    partner_id: i32,
    format: &str,
) -> AppResult<String> {
    let products = sqlx::query(
        r#"SELECT
               p.id,
               p.name,
               p.description,
               p.price,
               p.category,
               p.image_url,
               p.stock,
               p.is_promotion,
               p.promotional_price,
               s.data->>'nom'     AS store_name,
               s.data->>'adresse' AS store_address
           FROM service_products p
           JOIN services s ON s.id = p.service_id
           WHERE p.service_id = $1
             AND p.is_active = true
           ORDER BY p.id
           LIMIT 2000"#,
    )
    .bind(partner_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    let csv = match format {
        "jumia" => build_jumia_csv(&products, partner_id),
        "google" => build_google_csv(&products, partner_id),
        _ => build_generic_csv(&products, partner_id),
    };

    Ok(csv)
}

fn build_generic_csv(rows: &[sqlx::postgres::PgRow], partner_id: i32) -> String {
    let mut out = String::from(
        "ID,Nom,Description,Prix (XAF),Prix Promo (XAF),Categorie,Stock,Image URL,URL Produit Yukpo\n",
    );
    for row in rows {
        let id: i32 = row.try_get("id").unwrap_or(0);
        let name: String = row.try_get("name").unwrap_or_default();
        let desc: String = row
            .try_get::<Option<String>, _>("description")
            .ok()
            .flatten()
            .unwrap_or_default();
        let price: f64 = row.try_get("price").unwrap_or(0.0);
        let is_promo: bool = row.try_get("is_promotion").unwrap_or(false);
        let promo_price: Option<f64> = row.try_get("promotional_price").ok().flatten();
        let category: String =
            row.try_get::<Option<String>, _>("category").ok().flatten().unwrap_or_default();
        let stock: Option<i32> = row.try_get("stock").ok().flatten();
        let image_url: String =
            row.try_get::<Option<String>, _>("image_url").ok().flatten().unwrap_or_default();
        let product_url = format!(
            "{}/product/{}?serviceId={}&utm_source=csv_export&utm_campaign=yukpo",
            YUKPO_BASE, id, partner_id
        );
        let promo_str = if is_promo {
            promo_price.map(|p| format!("{:.0}", p)).unwrap_or_default()
        } else {
            String::new()
        };
        let stock_str = stock.map(|s| s.to_string()).unwrap_or_else(|| "N/A".to_string());

        out.push_str(&format!(
            "{},{},{},{:.0},{},{},{},{},{}\n",
            id,
            csv_escape(&name),
            csv_escape(&desc),
            price,
            promo_str,
            csv_escape(&category),
            stock_str,
            csv_escape(&image_url),
            product_url,
        ));
    }
    out
}

fn build_jumia_csv(rows: &[sqlx::postgres::PgRow], partner_id: i32) -> String {
    // Format attendu par Jumia Seller Center
    let mut out = String::from(
        "name,model,brand,short_description,long_description,price,special_price,\
         special_from_date,special_to_date,tax_class,quantity,image1,image2,image3,\
         primary_category,categories,color,size\n",
    );
    for row in rows {
        let id: i32 = row.try_get("id").unwrap_or(0);
        let name: String = row.try_get("name").unwrap_or_default();
        let desc: String = row
            .try_get::<Option<String>, _>("description")
            .ok()
            .flatten()
            .unwrap_or_default();
        let price: f64 = row.try_get("price").unwrap_or(0.0);
        let is_promo: bool = row.try_get("is_promotion").unwrap_or(false);
        let promo_price: Option<f64> = row.try_get("promotional_price").ok().flatten();
        let category: String =
            row.try_get::<Option<String>, _>("category").ok().flatten().unwrap_or_default();
        let stock: Option<i32> = row.try_get("stock").ok().flatten();
        let image_url: String =
            row.try_get::<Option<String>, _>("image_url").ok().flatten().unwrap_or_default();
        let store_name: String = row
            .try_get::<Option<String>, _>("store_name")
            .ok()
            .flatten()
            .unwrap_or_default();

        let special_price = if is_promo {
            promo_price.map(|p| format!("{:.0}", p)).unwrap_or_default()
        } else {
            String::new()
        };
        let qty = stock.unwrap_or(999).to_string();

        // Jumia veut un model unique
        let model = format!("YKP-{}-{}", partner_id, id);

        out.push_str(&format!(
            "{},{},{},{},{},{:.0},{},,,Taxable,{},{},,,{},{},{},{}\n",
            csv_escape(&name),
            model,
            csv_escape(&store_name),
            csv_escape(&name), // short_description
            csv_escape(&desc), // long_description
            price,
            special_price,
            qty,
            csv_escape(&image_url),
            csv_escape(&category),
            csv_escape(&category),
            "",
            "",
        ));
    }
    out
}

fn build_google_csv(rows: &[sqlx::postgres::PgRow], partner_id: i32) -> String {
    // Format CSV Google Merchant Center (alternative au XML)
    let mut out = String::from(
        "id,title,description,link,image_link,price,sale_price,availability,\
         condition,brand,google_product_category\n",
    );
    for row in rows {
        let id: i32 = row.try_get("id").unwrap_or(0);
        let name: String = row.try_get("name").unwrap_or_default();
        let desc: String = row
            .try_get::<Option<String>, _>("description")
            .ok()
            .flatten()
            .unwrap_or_else(|| name.clone());
        let price: f64 = row.try_get("price").unwrap_or(0.0);
        let is_promo: bool = row.try_get("is_promotion").unwrap_or(false);
        let promo_price: Option<f64> = row.try_get("promotional_price").ok().flatten();
        let category: String =
            row.try_get::<Option<String>, _>("category").ok().flatten().unwrap_or_default();
        let stock: Option<i32> = row.try_get("stock").ok().flatten();
        let image_url: String =
            row.try_get::<Option<String>, _>("image_url").ok().flatten().unwrap_or_default();
        let store_name: String = row
            .try_get::<Option<String>, _>("store_name")
            .ok()
            .flatten()
            .unwrap_or_default();

        let product_link = format!(
            "{}/product/{}?serviceId={}&utm_source=google_shopping&utm_medium=csv",
            YUKPO_BASE, id, partner_id
        );
        let availability = if stock.map(|s| s > 0).unwrap_or(true) {
            "in stock"
        } else {
            "out of stock"
        };
        let sale_price = if is_promo {
            promo_price.map(|p| format!("{:.0} XAF", p)).unwrap_or_default()
        } else {
            String::new()
        };

        out.push_str(&format!(
            "{},{},{},{},{},{:.0} XAF,{},{},new,{},{}\n",
            id,
            csv_escape(&name),
            csv_escape(&desc),
            product_link,
            csv_escape(&image_url),
            price,
            sale_price,
            availability,
            csv_escape(&store_name),
            csv_escape(&category),
        ));
    }
    out
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
