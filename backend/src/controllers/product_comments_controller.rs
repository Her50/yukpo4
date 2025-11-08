use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Row};

use crate::{
    middlewares::jwt::AuthenticatedUser,
    services::notification_service::{create_notification, NotificationType},
    state::AppState,
};

const ALLOWED_REACTIONS: &[&str] = &["like", "love", "insightful", "support", "funny", "angry"];

#[derive(Debug, Serialize, Clone)]
pub struct MentionUser {
    pub id: i32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CommentResponse {
    pub id: i32,
    pub service_id: i32,
    pub user_id: i32,
    pub user_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_avatar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_comment_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<i32>,
    pub content: String,
    #[serde(default)]
    pub mentions: Vec<i32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mention_users: Vec<MentionUser>,
    #[serde(default)]
    pub reaction_counts: Value,
    #[serde(default)]
    pub user_reactions: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<DateTime<Utc>>,
    pub is_deleted: bool,
    pub reply_count: i32,
    pub can_edit: bool,
    pub can_delete: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub replies: Vec<CommentResponse>,
}

#[derive(Debug, Serialize, Clone, Default)]
pub struct CommentStats {
    pub total_comments: i64,
    pub rating_count: i64,
    pub average_rating: f64,
}

#[derive(Debug, Serialize)]
pub struct CommentsPayload {
    pub success: bool,
    pub comments: Vec<CommentResponse>,
    pub stats: CommentStats,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    #[serde(default)]
    pub parent_comment_id: Option<i32>,
    #[serde(default)]
    pub rating: Option<i32>,
    pub content: String,
    #[serde(default)]
    pub mentions: Option<Vec<i32>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentRequest {
    #[serde(default)]
    pub rating: Option<i32>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub mentions: Option<Vec<i32>>,
}

#[derive(Debug, Deserialize)]
pub struct ReactionRequest {
    pub reaction_type: String,
}

pub async fn get_product_comments(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
) -> Result<Json<CommentsPayload>, StatusCode> {
    let current_user_id = maybe_user.as_ref().map(|ext| ext.0.id);

    match load_comments(&state, service_id, current_user_id).await {
        Ok((comments, stats)) => Ok(Json(CommentsPayload {
            success: true,
            comments,
            stats,
        })),
        Err(err) => {
            error!(
                "[ProductComments] ❌ Erreur lors du chargement des commentaires: {}",
                err
            );
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn create_product_comment(
    Path(service_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
    Json(payload): Json<CreateCommentRequest>,
) -> Result<Json<Value>, StatusCode> {
    let auth_user = match maybe_user {
        Some(ext) => ext.0,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let trimmed_content = payload.content.trim();
    if trimmed_content.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if let Some(rating) = payload.rating {
        if rating < 0 || rating > 5 {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let reply_to_info = if let Some(parent_id) = payload.parent_comment_id {
        let row = sqlx::query(
            "SELECT service_id, user_id FROM product_comments WHERE id = $1",
        )
        .bind(parent_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|err| {
            error!(
                "[ProductComments] ❌ Erreur lors de la vérification du parent {}: {}",
                parent_id, err
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        match row {
            Some(parent) => {
                let parent_service_id: i32 = parent.get("service_id");
                if parent_service_id != service_id {
                    return Err(StatusCode::BAD_REQUEST);
                }
                Some((parent_id, parent.get::<i32, _>("user_id")))
            }
            None => return Err(StatusCode::NOT_FOUND),
        }
    } else {
        None
    };

    let filtered_mentions = normalize_mentions(payload.mentions.clone(), auth_user.id);
    let effective_rating = if payload.parent_comment_id.is_some() {
        None
    } else {
        payload.rating
    };

    let row = sqlx::query(
        r#"
        INSERT INTO product_comments (
            service_id, user_id, parent_comment_id, rating, content, mentions, reaction_counts, is_deleted
        )
        VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, FALSE)
        RETURNING id
        "#,
    )
    .bind(service_id)
    .bind(auth_user.id)
    .bind(payload.parent_comment_id)
    .bind(effective_rating)
    .bind(trimmed_content)
    .bind(&filtered_mentions)
    .fetch_one(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[ProductComments] ❌ Erreur lors de la création du commentaire: {}",
            err
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let comment_id: i32 = row.get("id");
    info!(
        "[ProductComments] ✅ Commentaire {} créé sur service {} par user {}",
        comment_id, service_id, auth_user.id
    );

    // Notifications
    if !filtered_mentions.is_empty() || reply_to_info.is_some() {
        if let Ok(author_name) = fetch_display_name(&state.pg, auth_user.id).await {
            if let Ok(service_title) = fetch_service_title(&state.pg, service_id).await {
                for mention_id in filtered_mentions.iter().copied() {
                    if mention_id != auth_user.id {
                        let _ = create_notification(
                            &state.pg,
                            mention_id,
                            NotificationType::CommentMention,
                            format!("💬 {} vous a mentionné", author_name),
                            format!("Dans un commentaire sur « {} »", service_title),
                            Some(json!({
                                "service_id": service_id,
                                "comment_id": comment_id,
                                "author_id": auth_user.id
                            })),
                        )
                        .await;
                    }
                }

                if let Some((_, parent_user_id)) = reply_to_info {
                    if parent_user_id != auth_user.id {
                        let _ = create_notification(
                            &state.pg,
                            parent_user_id,
                            NotificationType::CommentReply,
                            format!("💬 {} a répondu à votre commentaire", author_name),
                            format!("Sur votre service « {} »", service_title),
                            Some(json!({
                                "service_id": service_id,
                                "comment_id": comment_id,
                                "author_id": auth_user.id
                            })),
                        )
                        .await;
                    }
                }
            }
        }
    }

    Ok(Json(json!({
        "success": true,
        "comment_id": comment_id
    })))
}

pub async fn update_product_comment(
    Path(comment_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
    Json(payload): Json<UpdateCommentRequest>,
) -> Result<Json<Value>, StatusCode> {
    let auth_user = match maybe_user {
        Some(ext) => ext.0,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    if let Some(rating) = payload.rating {
        if rating < 0 || rating > 5 {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let content_to_set = payload
        .content
        .as_ref()
        .map(|content| content.trim())
        .filter(|content| !content.is_empty());

    let mentions_to_set = payload.mentions.clone().map(|mentions| {
        let deduped = normalize_mentions(Some(mentions), auth_user.id);
        if deduped.is_empty() {
            None
        } else {
            Some(deduped)
        }
    });

    let mentions_bind: Option<Vec<i32>> = mentions_to_set.flatten();

    let result = sqlx::query(
        r#"
        UPDATE product_comments
        SET
            content = COALESCE($1, content),
            rating = COALESCE($2, rating),
            mentions = COALESCE($3, mentions),
            edited_at = NOW(),
            is_deleted = FALSE
        WHERE id = $4 AND user_id = $5
        "#,
    )
    .bind(content_to_set)
    .bind(payload.rating)
    .bind(mentions_bind.as_ref())
    .bind(comment_id)
    .bind(auth_user.id)
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[ProductComments] ❌ Erreur lors de la mise à jour du commentaire {}: {}",
            comment_id, err
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    info!(
        "[ProductComments] ✏️ Commentaire {} mis à jour par user {}",
        comment_id, auth_user.id
    );

    Ok(Json(json!({ "success": true })))
}

pub async fn delete_product_comment(
    Path(comment_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
) -> Result<Json<Value>, StatusCode> {
    let auth_user = match maybe_user {
        Some(ext) => ext.0,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let result = sqlx::query(
        "UPDATE product_comments SET is_deleted = TRUE, edited_at = NOW() WHERE id = $1 AND user_id = $2",
    )
    .bind(comment_id)
    .bind(auth_user.id)
    .execute(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[ProductComments] ❌ Erreur lors de la suppression du commentaire {}: {}",
            comment_id, err
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    info!(
        "[ProductComments] 🗑️ Commentaire {} marqué comme supprimé par user {}",
        comment_id, auth_user.id
    );

    Ok(Json(json!({ "success": true })))
}

pub async fn toggle_product_comment_reaction(
    Path(comment_id): Path<i32>,
    State(state): State<Arc<AppState>>,
    maybe_user: Option<Extension<AuthenticatedUser>>,
    Json(payload): Json<ReactionRequest>,
) -> Result<Json<Value>, StatusCode> {
    let auth_user = match maybe_user {
        Some(ext) => ext.0,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let reaction = payload.reaction_type.to_lowercase();
    if !ALLOWED_REACTIONS.contains(&reaction.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let comment_row = sqlx::query(
        "SELECT service_id FROM product_comments WHERE id = $1 AND is_deleted = FALSE",
    )
    .bind(comment_id)
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[ProductComments] ❌ Erreur lors de la vérification du commentaire {}: {}",
            comment_id, err
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if comment_row.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    let existing = sqlx::query(
        "SELECT id FROM product_comment_reactions WHERE comment_id = $1 AND user_id = $2 AND reaction_type = $3",
    )
    .bind(comment_id)
    .bind(auth_user.id)
    .bind(&reaction)
    .fetch_optional(&state.pg)
    .await
    .map_err(|err| {
        error!(
            "[ProductComments] ❌ Erreur lors de la consultation des réactions: {}",
            err
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let action = if let Some(row) = existing {
        let reaction_id: i32 = row.get("id");
        sqlx::query("DELETE FROM product_comment_reactions WHERE id = $1")
            .bind(reaction_id)
            .execute(&state.pg)
            .await
            .map_err(|err| {
                error!(
                    "[ProductComments] ❌ Erreur lors de la suppression de la réaction: {}",
                    err
                );
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        "removed"
    } else {
        sqlx::query(
            r#"
            INSERT INTO product_comment_reactions (comment_id, user_id, reaction_type)
            VALUES ($1, $2, $3)
            ON CONFLICT (comment_id, user_id, reaction_type) DO NOTHING
            "#,
        )
        .bind(comment_id)
        .bind(auth_user.id)
        .bind(&reaction)
        .execute(&state.pg)
        .await
        .map_err(|err| {
            error!(
                "[ProductComments] ❌ Erreur lors de l'ajout de la réaction: {}",
                err
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        "added"
    };

    let reaction_counts = refresh_comment_reaction_counts(&state, comment_id)
        .await
        .map_err(|err| {
            error!(
                "[ProductComments] ❌ Erreur lors de l'actualisation des réactions: {}",
                err
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({
        "success": true,
        "action": action,
        "reaction_counts": reaction_counts
    })))
}

// ----------------------------------------------------------------------------- //
// Helpers
// ----------------------------------------------------------------------------- //

async fn load_comments(
    state: &Arc<AppState>,
    service_id: i32,
    current_user_id: Option<i32>,
) -> Result<(Vec<CommentResponse>, CommentStats), sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            pc.id,
            pc.service_id,
            pc.user_id,
            pc.parent_comment_id,
            pc.rating,
            pc.content,
            pc.mentions,
            pc.reaction_counts,
            pc.created_at,
            pc.updated_at,
            pc.edited_at,
            pc.is_deleted,
            COALESCE(u.nom_complet, u.email) AS user_name,
            u.avatar_url AS user_avatar
        FROM product_comments pc
        JOIN users u ON u.id = pc.user_id
        WHERE pc.service_id = $1
        ORDER BY pc.created_at ASC
        "#,
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await?;

    if rows.is_empty() {
        return Ok((
            Vec::new(),
            CommentStats {
                total_comments: 0,
                rating_count: 0,
                average_rating: 0.0,
            },
        ));
    }

    let mut raw_comments = Vec::with_capacity(rows.len());
    let mut comment_ids = Vec::with_capacity(rows.len());
    let mut root_ids = Vec::new();
    let mut children_map: HashMap<i32, Vec<i32>> = HashMap::new();
    let mut mention_ids: HashSet<i32> = HashSet::new();
    let mut created_at_map: HashMap<i32, DateTime<Utc>> = HashMap::new();

    let mut rating_sum: i64 = 0;
    let mut rating_count: i64 = 0;
    let mut total_visible_comments: i64 = 0;

    for row in rows {
        let id: i32 = row.get("id");
        let parent_comment_id: Option<i32> = row.get("parent_comment_id");
        let rating: Option<i32> = row.get("rating");
        let content: String = row.get("content");
        let mentions: Vec<i32> = row.get::<Vec<i32>, _>("mentions");
        let reaction_counts: Option<Value> = row.get("reaction_counts");
        let created_at: DateTime<Utc> = row.get("created_at");
        let updated_at: DateTime<Utc> = row.get("updated_at");
        let edited_at: Option<DateTime<Utc>> = row.get("edited_at");
        let is_deleted: bool = row.get("is_deleted");
        let user_name: String = row.get("user_name");
        let user_avatar: Option<String> = row.get("user_avatar");
        let user_id: i32 = row.get("user_id");

        if !is_deleted {
            total_visible_comments += 1;
        }

        if let Some(r) = rating {
            if r >= 0 && r <= 5 && !is_deleted {
                rating_sum += r as i64;
                rating_count += 1;
            }
        }

        for mention_id in &mentions {
            mention_ids.insert(*mention_id);
        }

        created_at_map.insert(id, created_at);
        comment_ids.push(id);

        if let Some(parent_id) = parent_comment_id {
            children_map.entry(parent_id).or_default().push(id);
        } else {
            root_ids.push(id);
        }

        raw_comments.push((
            id,
            CommentResponse {
                id,
                service_id,
                user_id,
                user_name,
                user_avatar,
                parent_comment_id,
                rating,
                content,
                mentions,
                mention_users: Vec::new(),
                reaction_counts: reaction_counts.unwrap_or_else(|| json!({})),
                user_reactions: Vec::new(),
                created_at,
                updated_at,
                edited_at,
                is_deleted,
                reply_count: 0,
                can_edit: current_user_id.map_or(false, |uid| uid == user_id),
                can_delete: current_user_id.map_or(false, |uid| uid == user_id),
                replies: Vec::new(),
            },
        ));
    }

    let mention_lookup = if mention_ids.is_empty() {
        HashMap::new()
    } else {
        let mention_vec: Vec<i32> = mention_ids.into_iter().collect();
        let rows = sqlx::query(
            "SELECT id, COALESCE(nom_complet, email) AS display_name, avatar_url FROM users WHERE id = ANY($1)",
        )
        .bind(&mention_vec)
        .fetch_all(&state.pg)
        .await?;

        rows.into_iter()
            .map(|row| {
                let id: i32 = row.get("id");
                let name: String = row.get("display_name");
                let avatar_url: Option<String> = row.get("avatar_url");
                (
                    id,
                    MentionUser {
                        id,
                        name,
                        avatar_url,
                    },
                )
            })
            .collect::<HashMap<_, _>>()
    };

    let mut user_reaction_map: HashMap<i32, Vec<String>> = HashMap::new();
    if let Some(current_user_id) = current_user_id {
        if !comment_ids.is_empty() {
            let rows = sqlx::query(
                "SELECT comment_id, reaction_type FROM product_comment_reactions WHERE user_id = $1 AND comment_id = ANY($2)",
            )
            .bind(current_user_id)
            .bind(&comment_ids)
            .fetch_all(&state.pg)
            .await?;

            for row in rows {
                let cid: i32 = row.get("comment_id");
                let reaction: String = row.get("reaction_type");
                user_reaction_map
                    .entry(cid)
                    .or_default()
                    .push(reaction);
            }
        }
    }

    let mut comment_map: HashMap<i32, CommentResponse> = HashMap::new();
    for (id, mut comment) in raw_comments {
        comment.mention_users = comment
            .mentions
            .iter()
            .filter_map(|mention_id| mention_lookup.get(mention_id).cloned())
            .collect();
        if let Some(reactions) = user_reaction_map.remove(&id) {
            comment.user_reactions = reactions;
        }
        comment.content = sanitize_content(&comment.content, comment.is_deleted);
        comment_map.insert(id, comment);
    }

    root_ids.sort_by(|a, b| {
        created_at_map
            .get(a)
            .cmp(&created_at_map.get(b))
    });

    for children in children_map.values_mut() {
        children.sort_by(|a, b| {
            created_at_map
                .get(a)
                .cmp(&created_at_map.get(b))
        });
    }

    let mut comments = Vec::new();
    for root_id in root_ids {
        if let Some(comment) =
            build_comment_tree(root_id, &mut comment_map, &children_map, &created_at_map)
        {
            comments.push(comment);
        }
    }

    let average_rating = if rating_count > 0 {
        (rating_sum as f64 / rating_count as f64 * 100.0).round() / 100.0
    } else {
        0.0
    };

    Ok((
        comments,
        CommentStats {
            total_comments: total_visible_comments,
            rating_count,
            average_rating,
        },
    ))
}

fn build_comment_tree(
    comment_id: i32,
    comment_map: &mut HashMap<i32, CommentResponse>,
    children_map: &HashMap<i32, Vec<i32>>,
    created_at_map: &HashMap<i32, DateTime<Utc>>,
) -> Option<CommentResponse> {
    let mut comment = comment_map.remove(&comment_id)?;
    if let Some(children_ids) = children_map.get(&comment_id) {
        let mut replies = Vec::with_capacity(children_ids.len());
        for child_id in children_ids {
            if let Some(child_comment) =
                build_comment_tree(*child_id, comment_map, children_map, created_at_map)
            {
                replies.push(child_comment);
            } else {
                warn!(
                    "[ProductComments] ⚠️ Réponse {} introuvable pour le commentaire {}",
                    child_id, comment_id
                );
            }
        }
        replies.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        comment.reply_count = replies.len() as i32;
        comment.replies = replies;
    } else {
        comment.reply_count = 0;
    }
    Some(comment)
}

async fn fetch_display_name(pool: &sqlx::PgPool, user_id: i32) -> Result<String, sqlx::Error> {
    let row = sqlx::query("SELECT COALESCE(nom_complet, email) AS display_name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    Ok(row.get("display_name"))
}

async fn fetch_service_title(pool: &sqlx::PgPool, service_id: i32) -> Result<String, sqlx::Error> {
    let row = sqlx::query(
        "SELECT COALESCE(data->>'titre_service', data->>'nom', data->>'titre', 'votre service') AS titre FROM services WHERE id = $1",
    )
    .bind(service_id)
    .fetch_one(pool)
    .await?;
    Ok(row.get("titre"))
}

async fn refresh_comment_reaction_counts(
    state: &Arc<AppState>,
    comment_id: i32,
) -> Result<Value, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT reaction_type, COUNT(*)::INT AS count FROM product_comment_reactions WHERE comment_id = $1 GROUP BY reaction_type",
    )
    .bind(comment_id)
    .fetch_all(&state.pg)
    .await?;

    let mut map = serde_json::Map::new();
    for row in rows {
        let reaction_type: String = row.get("reaction_type");
        let count: i32 = row.get("count");
        map.insert(reaction_type, json!(count));
    }

    let aggregated = Value::Object(map);

    sqlx::query(
        "UPDATE product_comments SET reaction_counts = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(&aggregated)
    .bind(comment_id)
    .execute(&state.pg)
    .await?;

    Ok(aggregated)
}

fn sanitize_content(content: &str, is_deleted: bool) -> String {
    if is_deleted {
        "[Commentaire supprimé]".to_string()
    } else {
        content.to_string()
    }
}

fn normalize_mentions(mentions: Option<Vec<i32>>, exclude_id: i32) -> Vec<i32> {
    let mut set = HashSet::new();
    if let Some(values) = mentions {
        for mention_id in values {
            if mention_id != exclude_id {
                set.insert(mention_id);
            }
        }
    }
    set.into_iter().collect()
}


