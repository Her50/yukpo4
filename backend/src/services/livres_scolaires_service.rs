// ✅ NOUVEAU: Service pour gestion livres scolaires

use crate::core::types::{AppError, AppResult};
use crate::models::livre_scolaire::{
    CreateLivreScolaireRequest, LivreScolaire, LivreScolaireWithDistance,
    SearchLivresScolairesRequest, UpdateLivreScolaireRequest,
};
use chrono::{DateTime, Utc};
use log::info;
use sqlx::PgPool;
use std::sync::Arc;

pub struct LivresScolairesService {
    pool: Arc<PgPool>,
}

impl LivresScolairesService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    /// Créer un livre scolaire
    pub async fn create_livre_scolaire(
        &self,
        user_id: i32,
        request: CreateLivreScolaireRequest,
    ) -> AppResult<LivreScolaire> {
        info!(
            "[LIVRES_SCOLAIRES] Création livre: user_id={}, titre={}",
            user_id, request.titre
        );

        let livre = sqlx::query_as::<_, LivreScolaire>(
            r#"
            INSERT INTO livres_scolaires (
                service_id, user_id, titre, auteur, editeur, isbn,
                classe_actuelle, classe_souhaitee, matiere, niveau,
                etat_livre, description_etat, images_urls, video_url,
                gps, ville, quartier, is_available, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
            "#
        )
        .bind(request.service_id)
        .bind(user_id)
        .bind(request.titre)
        .bind(request.auteur)
        .bind(request.editeur)
        .bind(request.isbn)
        .bind(request.classe_actuelle)
        .bind(request.classe_souhaitee)
        .bind(request.matiere)
        .bind(request.niveau)
        .bind(request.etat_livre)
        .bind(request.description_etat)
        .bind(sqlx::types::Json(request.images_urls.unwrap_or_default()))
        .bind(request.video_url)
        .bind(request.gps)
        .bind(request.ville)
        .bind(request.quartier)
        .bind(true) // is_available
        .bind(true) // is_active
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur création livre scolaire: {}", e)))?;

        info!("[LIVRES_SCOLAIRES] ✅ Livre créé: id={}", livre.id);
        Ok(livre)
    }

    /// Rechercher des livres scolaires avec filtres
    pub async fn search_livres_scolaires(
        &self,
        request: SearchLivresScolairesRequest,
    ) -> AppResult<Vec<LivreScolaireWithDistance>> {
        info!("[LIVRES_SCOLAIRES] Recherche avec filtres: {:?}", request);

        let limit = request.limit.unwrap_or(50);
        let offset = request.offset.unwrap_or(0);
        let _radius_km = request.rayon_km.unwrap_or(10.0);

        // Construire la requête SQL dynamiquement selon les filtres
        let mut conditions = vec![
            "is_active = true".to_string(),
            "is_available = true".to_string(),
        ];
        let params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send>> = Vec::new();
        let mut param_index = 1;

        if let Some(classe_actuelle) = &request.classe_actuelle {
            conditions.push(format!("classe_actuelle = ${}", param_index));
            param_index += 1;
        }

        if let Some(classe_souhaitee) = &request.classe_souhaitee {
            conditions.push(format!("classe_souhaitee = ${}", param_index));
            param_index += 1;
        }

        if let Some(matiere) = &request.matiere {
            conditions.push(format!("matiere = ${}", param_index));
            param_index += 1;
        }

        if let Some(niveau) = &request.niveau {
            conditions.push(format!("niveau = ${}", param_index));
            param_index += 1;
        }

        if let Some(etat_livre) = &request.etat_livre {
            conditions.push(format!("etat_livre = ${}", param_index));
            param_index += 1;
        }

        if let Some(ville) = &request.ville {
            conditions.push(format!("ville = ${}", param_index));
            param_index += 1;
        }

        if let Some(quartier) = &request.quartier {
            conditions.push(format!("quartier = ${}", param_index));
            param_index += 1;
        }

        // Gestion de la distance GPS si coordonnées fournies
        let distance_select = if request.gps_lat.is_some() && request.gps_lon.is_some() {
            // Utiliser la formule Haversine pour calculer la distance
            format!(
                r#"
                6371.0 * acos(
                    cos(radians(${})) * 
                    cos(radians(CAST(SPLIT_PART(gps, ',', 1) AS FLOAT))) *
                    cos(radians(CAST(SPLIT_PART(gps, ',', 2) AS FLOAT)) - radians(${})) +
                    sin(radians(${})) *
                    sin(radians(CAST(SPLIT_PART(gps, ',', 1) AS FLOAT)))
                ) as distance_km
                "#,
                param_index,
                param_index + 1,
                param_index
            )
        } else {
            "NULL::FLOAT as distance_km".to_string()
        };

        let where_clause = conditions.join(" AND ");

        let sql = format!(
            r#"
            SELECT 
                l.*,
                {}
            FROM livres_scolaires l
            WHERE {}
            ORDER BY distance_km ASC NULLS LAST, created_at DESC
            LIMIT ${} OFFSET ${}
            "#,
            distance_select,
            where_clause,
            param_index + 2,
            param_index + 3
        );

        // Exécuter la requête avec les paramètres - utiliser query au lieu de query_as pour gérer images_urls
        let mut query = sqlx::query(&sql);

        // Bind des paramètres de filtres
        if let Some(classe_actuelle) = &request.classe_actuelle {
            query = query.bind(classe_actuelle);
        }
        if let Some(classe_souhaitee) = &request.classe_souhaitee {
            query = query.bind(classe_souhaitee);
        }
        if let Some(matiere) = &request.matiere {
            query = query.bind(matiere);
        }
        if let Some(niveau) = &request.niveau {
            query = query.bind(niveau);
        }
        if let Some(etat_livre) = &request.etat_livre {
            query = query.bind(etat_livre);
        }
        if let Some(ville) = &request.ville {
            query = query.bind(ville);
        }
        if let Some(quartier) = &request.quartier {
            query = query.bind(quartier);
        }

        // Bind des coordonnées GPS si présentes
        if let (Some(lat), Some(lon)) = (request.gps_lat, request.gps_lon) {
            query = query.bind(lat).bind(lon);
            // Filtrer par rayon si spécifié
            // Note: Pour l'instant on récupère tous les résultats, le filtrage par rayon
            // sera fait en post-traitement ou avec un filtre WHERE supplémentaire
        }

        query = query.bind(limit).bind(offset);

        let rows = query
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur recherche livres scolaires: {}", e)))?;

        use sqlx::Row;
        // Convertir en Vec<LivreScolaireWithDistance> - mapper manuellement
        let results: Vec<LivreScolaireWithDistance> = rows
            .into_iter()
            .map(|row| {
                let images_urls_json: Option<sqlx::types::Json<Vec<String>>> = row.get::<Option<sqlx::types::Json<Vec<String>>>, _>("images_urls");
                let images_urls = images_urls_json.map(|j| j.0).unwrap_or_default();
                
                LivreScolaireWithDistance {
                    livre: LivreScolaire {
                        id: row.get::<i32, _>("id"),
                        service_id: row.get::<Option<i32>, _>("service_id"),
                        user_id: row.get::<i32, _>("user_id"),
                        titre: row.get::<String, _>("titre"),
                        auteur: row.get::<Option<String>, _>("auteur"),
                        editeur: row.get::<Option<String>, _>("editeur"),
                        isbn: row.get::<Option<String>, _>("isbn"),
                        classe_actuelle: row.get::<String, _>("classe_actuelle"),
                        classe_souhaitee: row.get::<String, _>("classe_souhaitee"),
                        matiere: row.get::<String, _>("matiere"),
                        niveau: row.get::<Option<String>, _>("niveau"),
                        etat_livre: row.get::<String, _>("etat_livre"),
                        description_etat: row.get::<Option<String>, _>("description_etat"),
                        images_urls,
                        video_url: row.get::<Option<String>, _>("video_url"),
                        gps: row.get::<Option<String>, _>("gps"),
                        ville: row.get::<Option<String>, _>("ville"),
                        quartier: row.get::<Option<String>, _>("quartier"),
                        is_available: row.get::<bool, _>("is_available"),
                        is_active: row.get::<bool, _>("is_active"),
                        created_at: row.get::<DateTime<Utc>, _>("created_at"),
                        updated_at: row.get::<DateTime<Utc>, _>("updated_at"),
                    },
                    distance_km: row.get::<Option<f64>, _>("distance_km"),
                }
            })
            .collect();

        info!(
            "[LIVRES_SCOLAIRES] ✅ Recherche: {} résultats",
            results.len()
        );
        Ok(results)
    }

    /// Obtenir les détails d'un livre scolaire
    pub async fn get_livre_details(&self, livre_id: i32) -> AppResult<LivreScolaire> {
        let livre = sqlx::query_as::<_, LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE id = $1 AND is_active = true",
        )
        .bind(livre_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération livre: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre scolaire non trouvé".to_string()))?;

        Ok(livre)
    }

    /// Mettre à jour un livre scolaire
    pub async fn update_livre_scolaire(
        &self,
        livre_id: i32,
        user_id: i32,
        request: UpdateLivreScolaireRequest,
    ) -> AppResult<LivreScolaire> {
        info!(
            "[LIVRES_SCOLAIRES] Mise à jour livre: id={}, user_id={}",
            livre_id, user_id
        );

        // Vérifier que le livre appartient à l'utilisateur
        let existing = self.get_livre_details(livre_id).await?;
        if existing.user_id != user_id {
            return Err(AppError::Forbidden(
                "Ce livre ne vous appartient pas".to_string(),
            ));
        }

        // Construire la requête UPDATE dynamiquement
        let mut updates = Vec::new();
        let mut param_index = 1;

        if let Some(titre) = &request.titre {
            updates.push(format!("titre = ${}", param_index));
            param_index += 1;
        }
        if let Some(auteur) = &request.auteur {
            updates.push(format!("auteur = ${}", param_index));
            param_index += 1;
        }
        if let Some(editeur) = &request.editeur {
            updates.push(format!("editeur = ${}", param_index));
            param_index += 1;
        }
        if let Some(isbn) = &request.isbn {
            updates.push(format!("isbn = ${}", param_index));
            param_index += 1;
        }
        if let Some(classe_actuelle) = &request.classe_actuelle {
            updates.push(format!("classe_actuelle = ${}", param_index));
            param_index += 1;
        }
        if let Some(classe_souhaitee) = &request.classe_souhaitee {
            updates.push(format!("classe_souhaitee = ${}", param_index));
            param_index += 1;
        }
        if let Some(matiere) = &request.matiere {
            updates.push(format!("matiere = ${}", param_index));
            param_index += 1;
        }
        if let Some(niveau) = &request.niveau {
            updates.push(format!("niveau = ${}", param_index));
            param_index += 1;
        }
        if let Some(etat_livre) = &request.etat_livre {
            updates.push(format!("etat_livre = ${}", param_index));
            param_index += 1;
        }
        if request.description_etat.is_some() {
            updates.push(format!("description_etat = ${}", param_index));
            param_index += 1;
        }
        if request.images_urls.is_some() {
            updates.push(format!("images_urls = ${}", param_index));
            param_index += 1;
        }
        if request.video_url.is_some() {
            updates.push(format!("video_url = ${}", param_index));
            param_index += 1;
        }
        if request.gps.is_some() {
            updates.push(format!("gps = ${}", param_index));
            param_index += 1;
        }
        if request.ville.is_some() {
            updates.push(format!("ville = ${}", param_index));
            param_index += 1;
        }
        if request.quartier.is_some() {
            updates.push(format!("quartier = ${}", param_index));
            param_index += 1;
        }
        if request.is_available.is_some() {
            updates.push(format!("is_available = ${}", param_index));
            param_index += 1;
        }
        if request.is_active.is_some() {
            updates.push(format!("is_active = ${}", param_index));
            param_index += 1;
        }

        if updates.is_empty() {
            return self.get_livre_details(livre_id).await;
        }

        let sql = format!(
            "UPDATE livres_scolaires SET {} WHERE id = ${} AND user_id = ${} RETURNING *",
            updates.join(", "),
            param_index,
            param_index + 1
        );

        let mut query = sqlx::query_as::<_, LivreScolaire>(&sql);

        // Bind des valeurs
        if let Some(titre) = request.titre {
            query = query.bind(titre);
        }
        if let Some(auteur) = request.auteur {
            query = query.bind(auteur);
        }
        if let Some(editeur) = request.editeur {
            query = query.bind(editeur);
        }
        if let Some(isbn) = request.isbn {
            query = query.bind(isbn);
        }
        if let Some(classe_actuelle) = request.classe_actuelle {
            query = query.bind(classe_actuelle);
        }
        if let Some(classe_souhaitee) = request.classe_souhaitee {
            query = query.bind(classe_souhaitee);
        }
        if let Some(matiere) = request.matiere {
            query = query.bind(matiere);
        }
        if let Some(niveau) = request.niveau {
            query = query.bind(niveau);
        }
        if let Some(etat_livre) = request.etat_livre {
            query = query.bind(etat_livre);
        }
        if let Some(description_etat) = request.description_etat {
            query = query.bind(description_etat);
        }
        if let Some(images_urls) = request.images_urls {
            query = query.bind(sqlx::types::Json(images_urls));
        }
        if let Some(video_url) = request.video_url {
            query = query.bind(video_url);
        }
        if let Some(gps) = request.gps {
            query = query.bind(gps);
        }
        if let Some(ville) = request.ville {
            query = query.bind(ville);
        }
        if let Some(quartier) = request.quartier {
            query = query.bind(quartier);
        }
        if let Some(is_available) = request.is_available {
            query = query.bind(is_available);
        }
        if let Some(is_active) = request.is_active {
            query = query.bind(is_active);
        }

        query = query.bind(livre_id).bind(user_id);

        let livre = query
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur mise à jour livre: {}", e)))?
            .ok_or_else(|| AppError::NotFound("Livre scolaire non trouvé".to_string()))?;

        info!("[LIVRES_SCOLAIRES] ✅ Livre mis à jour: id={}", livre.id);
        Ok(livre)
    }

    /// Mettre à jour la disponibilité d'un livre
    pub async fn update_livre_disponibilite(
        &self,
        livre_id: i32,
        user_id: i32,
        is_available: bool,
    ) -> AppResult<LivreScolaire> {
        sqlx::query_as::<_, LivreScolaire>(
            "UPDATE livres_scolaires SET is_available = $1 WHERE id = $2 AND user_id = $3 RETURNING *"
        )
        .bind(is_available)
        .bind(livre_id)
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour disponibilité: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Livre scolaire non trouvé".to_string()))
    }

    /// Supprimer un livre scolaire (soft delete: is_active = false)
    pub async fn delete_livre_scolaire(&self, livre_id: i32, user_id: i32) -> AppResult<()> {
        info!(
            "[LIVRES_SCOLAIRES] Suppression livre: id={}, user_id={}",
            livre_id, user_id
        );

        let result = sqlx::query(
            "UPDATE livres_scolaires SET is_active = false WHERE id = $1 AND user_id = $2",
        )
        .bind(livre_id)
        .bind(user_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur suppression livre: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Livre scolaire non trouvé".to_string()));
        }

        info!("[LIVRES_SCOLAIRES] ✅ Livre supprimé: id={}", livre_id);
        Ok(())
    }

    /// Obtenir les livres d'un utilisateur
    pub async fn get_mes_livres(&self, user_id: i32) -> AppResult<Vec<LivreScolaire>> {
        let livres = sqlx::query_as::<_, LivreScolaire>(
            "SELECT * FROM livres_scolaires WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC"
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération mes livres: {}", e)))?;

        Ok(livres)
    }
}
