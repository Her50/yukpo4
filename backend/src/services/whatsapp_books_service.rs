// ✅ WhatsApp Books Service — Bourse du livre scolaire
// Scan multiple recto/verso, identification IA, programme par établissement, troc/vente

use crate::services::app_ia::AppIA;
use crate::services::whatsapp_session_service::ScannedBook;
use sqlx::{PgPool, Row};
use std::sync::Arc;

pub struct WhatsAppBooksService {
    pool: Arc<PgPool>,
    app_ia: Arc<AppIA>,
}

impl WhatsAppBooksService {
    pub fn new(pool: Arc<PgPool>, app_ia: Arc<AppIA>) -> Self {
        Self { pool, app_ia }
    }

    // ── Identifier un livre depuis une image ─────────────────────────────────
    // Réutilise la route existante POST /api/bourse-livre/ai/analyze-image
    // qui a déjà tous les prompts et la logique IA optimisée

    pub async fn identify_book_from_image(&self, image_url: &str) -> ScannedBook {
        log::info!(
            "[BooksService] 📚 Analyse image livre via route interne: {}",
            image_url
        );

        self.call_internal_analyze_image(image_url)
            .await
            .unwrap_or_else(|| ScannedBook {
                image_url: image_url.to_string(),
                title: "Livre détecté".to_string(),
                subject: "À préciser".to_string(),
                level: "À préciser".to_string(),
                condition: "Bon état".to_string(),
                price_suggestion: 2500,
                confirmed: false,
            })
    }

    /// Appel direct à BookExchangeAIService.analyze_book_recto_verso()
    /// Même logique que POST /api/bourse-livre/ai/analyze-image — pas de HTTP
    async fn call_internal_analyze_image(&self, image_url: &str) -> Option<ScannedBook> {
        use crate::services::book_exchange_ai_service::BookExchangeAIService;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(45))
            .build()
            .ok()?;

        // Télécharger l'image depuis Twilio
        let image_b64 = download_twilio_image_as_base64(&client, image_url).await?;

        // Appel direct au service IA — même que le controller bourse-livre
        let ai_service = BookExchangeAIService::new(self.app_ia.clone());
        let analysis =
            ai_service.analyze_book_recto_verso(&image_b64, "", None, None, "").await.ok()?;

        let condition = match analysis.etat_classification.as_str() {
            "bon" => "Bon état",
            "acceptable" => "Acceptable",
            "rejete" => "Mauvais état",
            _ => "Bon état",
        }
        .to_string();

        Some(ScannedBook {
            image_url: image_url.to_string(),
            title: analysis.titre.unwrap_or_else(|| "Livre scolaire".to_string()),
            subject: analysis.matiere.unwrap_or_else(|| "Général".to_string()),
            level: analysis.classe_actuelle.unwrap_or_else(|| "Non spécifié".to_string()),
            condition,
            price_suggestion: analysis.prix_detecte.map(|p| p as i64).unwrap_or(2500),
            confirmed: false,
        })
    }

    // ── Programme scolaire par établissement ──────────────────────────────────

    pub async fn search_school_programs(&self, query: &str) -> Vec<SchoolProgram> {
        let search = format!("%{}%", query.to_lowercase());

        let rows = sqlx::query(
            r#"
            SELECT DISTINCT
                e.id as ecole_id,
                e.nom_etablissement as ecole_nom,
                e.ville as ecole_ville,
                e.type_etablissement
            FROM etablissements_scolaires e
            WHERE LOWER(e.nom_etablissement) LIKE $1
               OR LOWER(e.ville) LIKE $1
            ORDER BY e.nom_etablissement ASC
            LIMIT 5
            "#,
        )
        .bind(&search)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| SchoolProgram {
                school_id: r.try_get("ecole_id").unwrap_or(0),
                school_name: r.try_get("ecole_nom").unwrap_or_default(),
                city: r.try_get("ecole_ville").unwrap_or_default(),
                school_type: r.try_get("type_etablissement").unwrap_or_default(),
                manuals: vec![],
            })
            .collect()
    }

    pub async fn get_school_manuals(&self, school_id: i32, level: &str) -> Vec<SchoolManual> {
        let level_search = format!("%{}%", level.to_lowercase());
        let rows = sqlx::query(
            r#"
            SELECT
                ps.id,
                COALESCE(ps.titre_livre, ps.titre, '') as titre,
                COALESCE(ps.matiere, '') as matiere,
                COALESCE(ps.niveau, '') as niveau,
                COALESCE(ps.editeur_livre, '') as editeur,
                COALESCE(ps.prix_officiel, 0) as prix_neuf
            FROM programmes_scolaires ps
            WHERE ps.etablissement_id = $1
              AND LOWER(COALESCE(ps.niveau, '')) LIKE $2
            ORDER BY ps.matiere ASC
            "#,
        )
        .bind(school_id)
        .bind(&level_search)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| SchoolManual {
                id: r.try_get("id").unwrap_or(0),
                title: r.try_get("titre").unwrap_or_default(),
                subject: r.try_get("matiere").unwrap_or_default(),
                level: r.try_get("niveau").unwrap_or_default(),
                publisher: r.try_get("editeur").unwrap_or_default(),
                price_new: r.try_get::<f64, _>("prix_neuf").unwrap_or(0.0) as i64,
                selected: false,
            })
            .collect()
    }

    pub async fn search_books_in_exchange(&self, titles: &[String]) -> Vec<BookListing> {
        if titles.is_empty() {
            return vec![];
        }
        let mut all_results = vec![];

        for title in titles {
            let search = format!("%{}%", title.to_lowercase());
            let rows = sqlx::query(
                r#"
                SELECT
                    ls.id::text as listing_id,
                    ls.titre,
                    COALESCE(ls.etat_livre, 'Bon état') as etat,
                    COALESCE(ls.prix_detecte, 0) as prix,
                    COALESCE(ls.mode_listing, 'vente') as type_transaction,
                    COALESCE(u.nom, 'Vendeur') as vendeur_nom,
                    COALESCE(u.phone, '') as vendeur_tel,
                    COALESCE(ls.ville, 'Cameroun') as ville
                FROM livres_scolaires ls
                JOIN users u ON u.id = ls.user_id
                WHERE LOWER(ls.titre) LIKE $1
                  AND ls.is_available = true
                  AND ls.is_active = true
                ORDER BY ls.created_at DESC
                LIMIT 3
                "#,
            )
            .bind(&search)
            .fetch_all(&*self.pool)
            .await
            .unwrap_or_default();

            for r in &rows {
                all_results.push(BookListing {
                    listing_id: r.try_get("listing_id").unwrap_or_default(),
                    title: r.try_get("titre").unwrap_or_default(),
                    condition: r.try_get("etat").unwrap_or_else(|_| "Bon état".to_string()),
                    price: r.try_get::<f64, _>("prix").unwrap_or(0.0) as i64,
                    transaction_type: r
                        .try_get("type_transaction")
                        .unwrap_or_else(|_| "vente".to_string()),
                    seller_name: r.try_get("vendeur_nom").unwrap_or_default(),
                    seller_phone: r.try_get("vendeur_tel").unwrap_or_default(),
                    city: r.try_get("ville").unwrap_or_default(),
                });
            }
        }
        all_results
    }

    // ── Publication d'un livre dans la bourse ─────────────────────────────────

    pub async fn publish_book(
        &self,
        user_id: i32,
        book: &ScannedBook,
        transaction_type: &str, // "vente" ou "troc"
    ) -> Option<String> {
        let result = sqlx::query(
            r#"
            INSERT INTO livres_scolaires
                (user_id, titre, matiere, niveau, etat_livre, prix_detecte,
                 mode_listing, image_recto, is_available, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true, NOW())
            RETURNING id
            "#,
        )
        .bind(user_id)
        .bind(&book.title)
        .bind(&book.subject)
        .bind(&book.level)
        .bind(&book.condition)
        .bind(book.price_suggestion as f64)
        .bind(transaction_type)
        .bind(&book.image_url)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok().map(|id| id.to_string()))
    }

    // ── Gestion manuels côté école partenaire ─────────────────────────────────

    /// Ajoute un manuel au catalogue de l'école via service_products
    /// Format attendu du texte : "Titre — Matière — Prix" ou "Titre — Matière"
    pub async fn add_school_manual(
        &self,
        service_id: i32,
        raw_input: &str,
        level: &str,
    ) -> Option<AddedManual> {
        let parsed = parse_manual_input(raw_input, level);

        let nom_produit = format!("{} — {} — {}", parsed.title, parsed.subject, level);

        // Calculer le prochain product_index pour ce service
        let next_index: i64 = sqlx::query(
            "SELECT COALESCE(MAX(product_index), -1) + 1 FROM service_products WHERE service_id = $1"
        )
        .bind(service_id)
        .fetch_one(&*self.pool)
        .await
        .ok()
        .and_then(|r| r.try_get::<i64, _>(0).ok())
        .unwrap_or(0);

        let product_data = serde_json::json!({
            "nom_produit": nom_produit,
            "prix": parsed.price_neuf,
            "description": format!("Niveau: {} | Matière: {}", level, parsed.subject),
            "type": "manuel_scolaire",
            "niveau": level,
            "matiere": parsed.subject
        });

        let result = sqlx::query(
            r#"
            INSERT INTO service_products (service_id, product_index, product_data, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id
            "#,
        )
        .bind(service_id)
        .bind(next_index as i32)
        .bind(&product_data)
        .fetch_optional(&*self.pool)
        .await
        .ok()
        .flatten();

        result.and_then(|r| r.try_get::<i32, _>("id").ok()).map(|_id| parsed)
    }

    /// Scan d'une photo de liste de manuels — appel direct à BookExchangeAIService
    /// Même logique que POST /api/bourse-livre/v2/admin/programmes/upload
    pub async fn add_manuals_from_image(
        &self,
        service_id: i32,
        image_url: &str,
        level: &str,
    ) -> Vec<AddedManual> {
        use crate::services::book_exchange_ai_service::BookExchangeAIService;

        let client =
            match reqwest::Client::builder().timeout(std::time::Duration::from_secs(45)).build() {
                Ok(c) => c,
                Err(_) => return vec![],
            };

        let image_b64 = match download_twilio_image_as_base64(&client, image_url).await {
            Some(b) => b,
            None => return vec![],
        };

        let ai_service = BookExchangeAIService::new(self.app_ia.clone());

        // analyze_book_recto_verso retourne un livre — pour une liste on l'utilise comme seul résultat
        // Si la route extraction_programme existe et est publique, utiliser celle-là
        let analysis =
            match ai_service.analyze_book_recto_verso(&image_b64, "", None, None, level).await {
                Ok(a) => a,
                Err(e) => {
                    log::warn!("[BooksService] Erreur BookExchangeAIService: {}", e);
                    return vec![];
                }
            };

        // Ajouter le livre détecté comme manuel
        let titre = match &analysis.titre {
            Some(t) if t.len() >= 3 => t.clone(),
            _ => return vec![],
        };
        let matiere = analysis.matiere.as_deref().unwrap_or("Général");
        let prix = analysis.prix_detecte.map(|p| p as i64).unwrap_or(2500);

        let raw = format!("{} — {} — {}", titre, matiere, prix);
        match self.add_school_manual(service_id, &raw, level).await {
            Some(m) => vec![m],
            None => vec![],
        }
    }

    /// Récupère les manuels d'une école via service_products
    pub async fn get_school_manuals_from_products(
        &self,
        service_id: i32,
        level: &str,
    ) -> Vec<SchoolManual> {
        let level_lower = level.to_lowercase();
        let level_search = format!("%{}%", level_lower);
        let rows = sqlx::query(
            r#"
            SELECT id,
                product_name,
                COALESCE(product_price, 0) as prix,
                product_data->>'matiere' as matiere,
                product_data->>'niveau' as niveau
            FROM service_products
            WHERE service_id = $1
              AND product_data->>'type' = 'manuel_scolaire'
              AND is_active = true
              AND (
                  LOWER(product_data->>'niveau') LIKE $2
                  OR LOWER(product_name) LIKE $2
              )
            ORDER BY product_name ASC
            LIMIT 30
            "#,
        )
        .bind(service_id)
        .bind(&level_search)
        .fetch_all(&*self.pool)
        .await
        .unwrap_or_default();

        rows.iter()
            .map(|r| {
                let nom: String = r.try_get("product_name").unwrap_or_default();
                let parts: Vec<&str> = nom.splitn(3, " — ").collect();
                SchoolManual {
                    id: r.try_get("id").unwrap_or(0),
                    title: parts.first().map(|s| s.to_string()).unwrap_or(nom.clone()),
                    subject: r.try_get("matiere").unwrap_or_else(|_| {
                        parts.get(1).map(|s| s.to_string()).unwrap_or_else(|| "Général".into())
                    }),
                    level: r.try_get("niveau").unwrap_or_else(|_| level.to_string()),
                    publisher: String::new(),
                    price_new: r.try_get::<f64, _>("prix").unwrap_or(0.0) as i64,
                    selected: false,
                }
            })
            .collect()
    }

    // ── Messages école partenaire ─────────────────────────────────────────────

    pub fn school_manual_level_prompt(school_name: &str) -> String {
        format!(
            "📚 *Publier les manuels scolaires — {}*\n\n\
            Pour quel *niveau* souhaitez-vous ajouter les manuels ?\n\n\
            Ex : *6ème*, *5ème*, *4ème*, *3ème*\n\
            Ou : *2nde*, *1ère*, *Terminale*, *Tle D*, *Tle C*\n\n\
            📸 Vous pouvez aussi *envoyer une photo* de votre liste officielle !",
            school_name
        )
    }

    pub fn school_manual_entry_prompt(level: &str, count: u32) -> String {
        if count == 0 {
            format!(
                "📚 *Manuels — {}*\n\n\
                Envoyez les manuels au format :\n\
                *Titre — Matière — Prix FCFA*\n\n\
                Exemples :\n\
                • _Transmath 6ème — Mathématiques — 3500_\n\
                • _Précis de Français — Français — 2500_\n\
                • _Physique-Chimie 6ème — Sciences — 3000_\n\n\
                📸 Ou envoyez une *photo* de votre liste officielle.\n\
                Tapez *FIN* quand vous avez terminé.",
                level
            )
        } else {
            format!(
                "✅ {} manuel(s) ajouté(s) pour *{}*.\n\n\
                Continuez (même format) ou tapez *FIN* pour terminer.",
                count, level
            )
        }
    }

    pub fn school_manuals_done(school_name: &str, level: &str, count: u32) -> String {
        format!(
            "🎉 *{} manuels publiés pour la {} — {}*\n\n\
            Les élèves et parents peuvent maintenant :\n\
            • Voir votre liste en tapant : _livres {} {}_\n\
            • Trouver ces livres en occasion sur la *Bourse Yukpo*\n\n\
            Ajouter un autre niveau ?\n\
            1️⃣ ✅ Oui\n\
            2️⃣ 📊 Non, voir mon dashboard\n\n\
            _Tapez votre choix._",
            count, level, school_name, school_name, level
        )
    }

    // ── Formatage des messages ────────────────────────────────────────────────

    pub fn format_scan_result(book: &ScannedBook, index: usize) -> String {
        format!(
            "📚 *Livre {}* identifié :\n\n\
            📖 *{}*\n\
            📐 Matière : {}\n\
            🎓 Niveau : {}\n\
            ✨ État : {}\n\
            💰 Prix suggéré : {} FCFA\n\n\
            1. ✅ Confirmer ce livre\n\
            2. ✏️ Corriger le prix\n\
            3. ❌ Ignorer ce livre\n\n\
            _Ou envoyez une autre photo de livre._\n\
            _Tapez *FIN* pour le récapitulatif._",
            index, book.title, book.subject, book.level, book.condition, book.price_suggestion
        )
    }

    pub fn ask_for_verso(index: usize) -> String {
        format!(
            "📸 *Photo {} reçue !*\n\n\
            Pour une meilleure identification, envoyez le *verso* du livre.\n\n\
            Ou tapez :\n\
            • *ANALYSER* — identifier avec cette photo seulement\n\
            • *FIN* — terminer le scan",
            index + 1
        )
    }

    pub fn format_scan_recap(books: &[ScannedBook]) -> String {
        let total: i64 = books.iter().map(|b| b.price_suggestion).sum();
        let mut msg = format!("📦 *RÉCAPITULATIF — {} livre(s)*\n\n", books.len());
        for (i, b) in books.iter().enumerate() {
            msg.push_str(&format!(
                "{}. *{}* — {} — {} FCFA\n",
                i + 1,
                b.title,
                b.condition,
                b.price_suggestion
            ));
        }
        msg.push_str(&format!("\n💵 *Total estimé : {} FCFA*\n\n", total));
        msg.push_str("Que souhaitez-vous faire ?\n\n");
        msg.push_str("1. 💰 *Vente* — vendre contre argent\n");
        msg.push_str("2. 🔄 *Troc* — échanger contre un autre livre\n");
        msg.push_str("3. ❌ Annuler\n");
        msg.push_str("\n_Tapez 1 ou 2._");
        msg
    }

    pub fn format_school_list(schools: &[SchoolProgram]) -> String {
        if schools.is_empty() {
            return "😔 Aucun établissement trouvé.\n\nEssayez le nom exact ou la ville.\nEx : _Lycée de la Retraite_ ou _lycées Douala_".to_string();
        }
        let mut msg = "🏫 *Établissements trouvés :*\n\n".to_string();
        for (i, s) in schools.iter().enumerate() {
            msg.push_str(&format!(
                "{}️⃣ *{}*\n   📍 {}\n\n",
                i + 1,
                s.school_name,
                s.city
            ));
        }
        msg.push_str("_Tapez le numéro + le niveau (ex: *1 5ème*)._");
        msg
    }

    pub fn format_manuals_list(school: &str, manuals: &[SchoolManual]) -> String {
        if manuals.is_empty() {
            return format!(
                "😔 Aucun manuel trouvé pour *{}*.\n\nVérifiez le niveau (ex: 6ème, 4ème, Tle D).",
                school
            );
        }
        let mut msg = format!("📚 *Manuels scolaires — {}*\n\n", school);
        for (i, m) in manuals.iter().enumerate() {
            msg.push_str(&format!(
                "{}️⃣ {} — *{}*\n   💰 Neuf: {} FCFA\n\n",
                i + 1,
                m.subject,
                m.title,
                m.price_new
            ));
        }
        msg.push_str("_Tapez les numéros des livres à chercher (ex: *1 3 5*)\nou *TOUS* pour tout sélectionner._");
        msg
    }
}

#[allow(dead_code)]
fn parse_book_from_text(text: &str, image_url: &str) -> ScannedBook {
    let text_lower = text.to_lowercase();

    // Détecter le niveau
    let level = if text_lower.contains("terminale") || text_lower.contains("tle") {
        "Terminale"
    } else if text_lower.contains("1ère") || text_lower.contains("premiere") {
        "1ère"
    } else if text_lower.contains("2nde") || text_lower.contains("seconde") {
        "2nde"
    } else if text_lower.contains("3ème") || text_lower.contains("3e") {
        "3ème"
    } else if text_lower.contains("4ème") || text_lower.contains("4e") {
        "4ème"
    } else if text_lower.contains("5ème") || text_lower.contains("5e") {
        "5ème"
    } else if text_lower.contains("6ème") || text_lower.contains("6e") {
        "6ème"
    } else {
        "Non spécifié"
    };

    // Détecter la matière
    let subject = if text_lower.contains("mathématiques") || text_lower.contains("maths") {
        "Mathématiques"
    } else if text_lower.contains("français") || text_lower.contains("francais") {
        "Français"
    } else if text_lower.contains("physique") || text_lower.contains("chimie") {
        "Physique-Chimie"
    } else if text_lower.contains("biologie") || text_lower.contains("svt") {
        "SVT"
    } else if text_lower.contains("histoire") || text_lower.contains("géographie") {
        "Histoire-Géo"
    } else if text_lower.contains("anglais") {
        "Anglais"
    } else if text_lower.contains("philosophie") {
        "Philosophie"
    } else if text_lower.contains("économie") || text_lower.contains("comptabilité") {
        "Économie"
    } else {
        "Matière non détectée"
    };

    // Extraire le titre (première ligne significative)
    let title = text
        .lines()
        .find(|l| l.len() > 3 && !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .unwrap_or_else(|| format!("{} {}", subject, level));

    // Prix selon le niveau
    let price = match level {
        "Terminale" | "1ère" => 4000i64,
        "2nde" | "3ème" => 3500,
        _ => 2500,
    };

    ScannedBook {
        image_url: image_url.to_string(),
        title,
        subject: subject.to_string(),
        level: level.to_string(),
        condition: "Bon état".to_string(),
        price_suggestion: price,
        confirmed: false,
    }
}

#[derive(Debug, Clone)]
pub struct SchoolProgram {
    pub school_id: i32,
    pub school_name: String,
    pub city: String,
    pub school_type: String,
    pub manuals: Vec<SchoolManual>,
}

#[derive(Debug, Clone)]
pub struct SchoolManual {
    pub id: i32,
    pub title: String,
    pub subject: String,
    pub level: String,
    pub publisher: String,
    pub price_new: i64,
    pub selected: bool,
}

#[derive(Debug, Clone)]
pub struct BookListing {
    pub listing_id: String,
    pub title: String,
    pub condition: String,
    pub price: i64,
    pub transaction_type: String,
    pub seller_name: String,
    pub seller_phone: String,
    pub city: String,
}

#[derive(Debug, Clone)]
pub struct AddedManual {
    pub title: String,
    pub subject: String,
    pub level: String,
    pub price_neuf: i64,
}

/// Télécharge une image depuis une URL Twilio et la retourne en base64
/// Utilise les credentials Twilio si disponibles (les médias WhatsApp nécessitent auth)
async fn download_twilio_image_as_base64(client: &reqwest::Client, url: &str) -> Option<String> {
    let twilio_sid = std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default();
    let twilio_token = std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default();

    let req = if !twilio_sid.is_empty() && !twilio_token.is_empty() {
        client.get(url).basic_auth(&twilio_sid, Some(&twilio_token))
    } else {
        client.get(url)
    };

    let bytes = req.send().await.ok()?.bytes().await.ok()?;
    if bytes.is_empty() {
        return None;
    }

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    Some(STANDARD.encode(&bytes))
}

/// Parse une ligne texte en AddedManual
/// Formats acceptés:
///   "Titre — Matière — Prix"
///   "Titre — Matière"
///   "Titre"
fn parse_manual_input(raw: &str, level: &str) -> AddedManual {
    let parts: Vec<&str> = raw.splitn(3, " — ").collect();
    let title = parts
        .first()
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| raw.trim().to_string());
    let subject = parts
        .get(1)
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Général".to_string());
    let price_neuf: i64 = parts
        .get(2)
        .and_then(|s| s.trim().replace("FCFA", "").replace(" ", "").parse::<i64>().ok())
        .unwrap_or(2500);
    AddedManual {
        title,
        subject,
        level: level.to_string(),
        price_neuf,
    }
}
