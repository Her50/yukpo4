// ✅ WhatsApp Provider Service — Gestion produits/services prestataire via WhatsApp
// Miroir de MesProduitsScreen : lister, activer/désactiver, supprimer, modifier prix

use crate::services::whatsapp_session_service::ProviderProduct;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct WhatsAppProviderService {
    pool: Arc<PgPool>,
}

/// Coût en tokens pour réactiver un produit (miroir de MesProduitsScreen)
pub const REACTIVATION_TOKEN_COST: i32 = 50;

impl WhatsAppProviderService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    // ── Lister les produits de l'utilisateur ──────────────────────────────────
    // Combine service_products (prestations) + products (marketplace)

    pub async fn list_user_products(&self, user_id: i32) -> Vec<ProviderProduct> {
        let mut products = Vec::new();

        // 1. Produits depuis service_products (prestations de service)
        let svc_rows = sqlx::query(
            r#"
            SELECT
                sp.id,
                COALESCE(sp.product_name, 'Produit sans nom') as name,
                COALESCE(sp.product_type, 'service') as product_type,
                COALESCE(sp.product_price::bigint, 0) as price,
                COALESCE(sp.is_active, true) as is_active
            FROM service_products sp
            INNER JOIN services s ON s.id = sp.service_id
            WHERE s.user_id = $1 AND s.is_active = true
            ORDER BY sp.created_at DESC
            LIMIT 10
            "#,
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        for r in &svc_rows {
            let id: i32 = r.try_get("id").unwrap_or(0);
            let name: String = r.try_get("name").unwrap_or_else(|_| "Produit".to_string());
            let product_type: String =
                r.try_get("product_type").unwrap_or_else(|_| "service".to_string());
            let price: i64 = r.try_get("price").unwrap_or(0);
            let is_active: bool = r.try_get("is_active").unwrap_or(true);

            products.push(ProviderProduct {
                product_id: id,
                product_type: "service_product".to_string(),
                name,
                category: product_type,
                price,
                is_active,
                views: 0,
            });
        }

        // 2. Produits depuis la table products (marketplace)
        let mkt_rows = sqlx::query(
            r#"
            SELECT
                id,
                COALESCE(nom, 'Produit sans nom') as name,
                COALESCE(categorie, 'divers') as category,
                COALESCE(prix::bigint, 0) as price,
                COALESCE(actif, true) as actif
            FROM products
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 10
            "#,
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        for r in &mkt_rows {
            let id: i32 = r.try_get("id").unwrap_or(0);
            let name: String = r.try_get("name").unwrap_or_else(|_| "Produit".to_string());
            let category: String = r.try_get("category").unwrap_or_else(|_| "divers".to_string());
            let price: i64 = r.try_get("price").unwrap_or(0);
            let actif: bool = r.try_get("actif").unwrap_or(true);

            products.push(ProviderProduct {
                product_id: id,
                product_type: "marketplace".to_string(),
                name,
                category,
                price,
                is_active: actif,
                views: 0,
            });
        }

        products
    }

    // ── Activer un produit ────────────────────────────────────────────────────

    pub async fn activate_product(
        &self,
        user_id: i32,
        product_id: i32,
        product_type: &str,
    ) -> Result<(), String> {
        match product_type {
            "service_product" => {
                let owned: Option<i32> = sqlx::query(
                    "SELECT sp.id FROM service_products sp JOIN services s ON s.id = sp.service_id WHERE sp.id = $1 AND s.user_id = $2"
                )
                .bind(product_id)
                .bind(user_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| e.to_string())?
                .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query(
                    "UPDATE service_products SET is_active = true, updated_at = NOW() WHERE id = $1"
                )
                .bind(product_id)
                .execute(&*self.pool)
                .await
                .map_err(|e| e.to_string())?;
            }
            "marketplace" => {
                let owned: Option<i32> =
                    sqlx::query("SELECT id FROM products WHERE id = $1 AND user_id = $2")
                        .bind(product_id)
                        .bind(user_id)
                        .fetch_optional(&*self.pool)
                        .await
                        .map_err(|e| e.to_string())?
                        .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query("UPDATE products SET actif = true, updated_at = NOW() WHERE id = $1")
                    .bind(product_id)
                    .execute(&*self.pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            _ => return Err("Type de produit inconnu".to_string()),
        }
        Ok(())
    }

    // ── Désactiver un produit (gratuit) ───────────────────────────────────────

    pub async fn deactivate_product(
        &self,
        user_id: i32,
        product_id: i32,
        product_type: &str,
    ) -> Result<(), String> {
        match product_type {
            "service_product" => {
                let owned: Option<i32> = sqlx::query(
                    "SELECT sp.id FROM service_products sp JOIN services s ON s.id = sp.service_id WHERE sp.id = $1 AND s.user_id = $2"
                )
                .bind(product_id)
                .bind(user_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| e.to_string())?
                .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query(
                    "UPDATE service_products SET is_active = false, updated_at = NOW() WHERE id = $1"
                )
                .bind(product_id)
                .execute(&*self.pool)
                .await
                .map_err(|e| e.to_string())?;
            }
            "marketplace" => {
                let owned: Option<i32> =
                    sqlx::query("SELECT id FROM products WHERE id = $1 AND user_id = $2")
                        .bind(product_id)
                        .bind(user_id)
                        .fetch_optional(&*self.pool)
                        .await
                        .map_err(|e| e.to_string())?
                        .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query("UPDATE products SET actif = false, updated_at = NOW() WHERE id = $1")
                    .bind(product_id)
                    .execute(&*self.pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            _ => return Err("Type de produit inconnu".to_string()),
        }
        Ok(())
    }

    // ── Supprimer un produit ──────────────────────────────────────────────────

    pub async fn delete_product(
        &self,
        user_id: i32,
        product_id: i32,
        product_type: &str,
    ) -> Result<(), String> {
        match product_type {
            "service_product" => {
                let owned: Option<i32> = sqlx::query(
                    "SELECT sp.id FROM service_products sp JOIN services s ON s.id = sp.service_id WHERE sp.id = $1 AND s.user_id = $2"
                )
                .bind(product_id)
                .bind(user_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| e.to_string())?
                .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query("DELETE FROM service_products WHERE id = $1")
                    .bind(product_id)
                    .execute(&*self.pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            "marketplace" => {
                let owned: Option<i32> =
                    sqlx::query("SELECT id FROM products WHERE id = $1 AND user_id = $2")
                        .bind(product_id)
                        .bind(user_id)
                        .fetch_optional(&*self.pool)
                        .await
                        .map_err(|e| e.to_string())?
                        .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query("DELETE FROM products WHERE id = $1")
                    .bind(product_id)
                    .execute(&*self.pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            _ => return Err("Type de produit inconnu".to_string()),
        }
        Ok(())
    }

    // ── Modifier le prix d'un produit ─────────────────────────────────────────

    pub async fn update_product_price(
        &self,
        user_id: i32,
        product_id: i32,
        product_type: &str,
        new_price: i64,
    ) -> Result<(), String> {
        match product_type {
            "service_product" => {
                let owned: Option<i32> = sqlx::query(
                    "SELECT sp.id FROM service_products sp JOIN services s ON s.id = sp.service_id WHERE sp.id = $1 AND s.user_id = $2"
                )
                .bind(product_id)
                .bind(user_id)
                .fetch_optional(&*self.pool)
                .await
                .map_err(|e| e.to_string())?
                .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query(
                    "UPDATE service_products SET product_price = $1, updated_at = NOW() WHERE id = $2"
                )
                .bind(new_price as i32)
                .bind(product_id)
                .execute(&*self.pool)
                .await
                .map_err(|e| e.to_string())?;
            }
            "marketplace" => {
                let owned: Option<i32> =
                    sqlx::query("SELECT id FROM products WHERE id = $1 AND user_id = $2")
                        .bind(product_id)
                        .bind(user_id)
                        .fetch_optional(&*self.pool)
                        .await
                        .map_err(|e| e.to_string())?
                        .and_then(|r| r.try_get::<i32, _>("id").ok());

                if owned.is_none() {
                    return Err("Produit introuvable ou non autorisé".to_string());
                }

                sqlx::query("UPDATE products SET prix = $1, updated_at = NOW() WHERE id = $2")
                    .bind(new_price as i32)
                    .bind(product_id)
                    .execute(&*self.pool)
                    .await
                    .map_err(|e| e.to_string())?;
            }
            _ => return Err("Type de produit inconnu".to_string()),
        }
        Ok(())
    }

    // ── Formatage des messages WhatsApp ───────────────────────────────────────

    pub fn format_products_list(products: &[ProviderProduct]) -> String {
        if products.is_empty() {
            return "📦 Vous n'avez aucun produit ou service publié.\n\n\
                💡 Pour créer un produit, envoyez simplement *une photo* !\n\
                📲 Gérez tout depuis l'app *Yukpo* pour plus d'options."
                .to_string();
        }

        let active = products.iter().filter(|p| p.is_active).count();
        let paused = products.len() - active;

        let mut msg = format!(
            "📦 *Mes produits & services* ({} actifs | {} en pause)\n\n",
            active, paused
        );

        for (i, p) in products.iter().enumerate() {
            let status_icon = if p.is_active { "🟢" } else { "🔴" };
            let type_icon = match p.product_type.as_str() {
                "service_product" => "🔧",
                _ => "🛍️",
            };
            msg.push_str(&format!(
                "{}️⃣ {} {} *{}*\n   💰 {} FCFA — {}\n\n",
                i + 1,
                type_icon,
                status_icon,
                p.name,
                p.price,
                if p.is_active { "Actif" } else { "En pause" }
            ));
        }

        msg.push_str("_Tapez le numéro pour gérer un produit._\n");
        msg.push_str("📲 Gestion complète sur l'app *Yukpo* !");
        msg
    }

    pub fn format_product_actions(product: &ProviderProduct) -> String {
        let status = if product.is_active {
            "🟢 Actif"
        } else {
            "🔴 En pause"
        };
        let type_label = match product.product_type.as_str() {
            "service_product" => "Prestation de service",
            _ => "Produit marketplace",
        };

        let mut msg = format!(
            "🛍️ *{}*\n\n\
            📂 Type : {}\n\
            💰 Prix : {} FCFA\n\
            📊 Statut : {}\n\n\
            Que souhaitez-vous faire ?\n\n",
            product.name, type_label, product.price, status
        );

        if product.is_active {
            msg.push_str("1️⃣ ⏸️ Mettre en pause (gratuit)\n");
        } else {
            msg.push_str(&format!(
                "1️⃣ ▶️ Réactiver ({} tokens)\n",
                REACTIVATION_TOKEN_COST
            ));
        }

        msg.push_str("2️⃣ 💰 Modifier le prix\n");
        msg.push_str("3️⃣ 🗑️ Supprimer\n");
        msg.push_str("4️⃣ ◀️ Retour à la liste\n\n");
        msg.push_str("_Tapez votre choix._");
        msg
    }

    pub fn confirm_delete_message(product_name: &str) -> String {
        format!(
            "⚠️ *Confirmer la suppression*\n\n\
            Êtes-vous sûr de vouloir supprimer *{}* ?\n\n\
            Cette action est *irréversible*.\n\n\
            1️⃣ ✅ Oui, supprimer\n\
            2️⃣ ❌ Non, annuler\n\n\
            _Tapez 1 ou 2._",
            product_name
        )
    }

    pub fn ask_new_price(product_name: &str) -> String {
        format!(
            "💰 *Nouveau prix pour* : *{}*\n\n\
            Tapez le montant en FCFA.\nEx : *5000*",
            product_name
        )
    }

    pub fn product_updated_message(action: &str, product_name: &str) -> String {
        match action {
            "activated" => format!(
                "✅ *{}* est maintenant *actif* et visible par tous les utilisateurs Yukpo !",
                product_name
            ),
            "deactivated" => format!(
                "⏸️ *{}* est maintenant *en pause*. Il n'apparaîtra plus dans les recherches.",
                product_name
            ),
            "deleted" => format!("🗑️ *{}* a été supprimé avec succès.", product_name),
            _ => format!("✅ *{}* mis à jour avec succès.", product_name),
        }
    }

    pub fn price_updated_message(product_name: &str, new_price: i64) -> String {
        format!(
            "✅ Prix mis à jour !\n\n\
            🛍️ *{}*\n\
            💰 Nouveau prix : *{} FCFA*\n\n\
            📲 Visible immédiatement sur Yukpo !",
            product_name, new_price
        )
    }
}
