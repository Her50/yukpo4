//! Bornes min / max / prix suggéré pour les lignes `commande_livres_neufs` sans prix officiel verrouillé.
//! Agrégation sur `livres_scolaires` (annonces neuf) par classe + matière, avec repli sur des constantes.

use sqlx::PgPool;
use uuid::Uuid;

const MIN_FALLBACK_XAF: f64 = 250.0;
const MAX_FALLBACK_XAF: f64 = 120_000.0;
const SUGGEST_FALLBACK_XAF: f64 = 5_000.0;
const MARGE_MAX_RATIO: f64 = 1.38;
const MARGE_MIN_RATIO: f64 = 0.62;

#[derive(Debug, Clone, serde::Serialize)]
pub struct BornesPrixLigne {
    pub ligne_id: Uuid,
    pub prix_officiel: f64,
    pub prix_final: f64,
    pub quantite: i32,
    pub titre: String,
    pub prix_officiel_verrouille: bool,
    pub prix_plancher: Option<f64>,
    pub prix_plafond: Option<f64>,
    pub prix_suggere: Option<f64>,
    pub bornes_source: Option<String>,
}

pub fn est_prix_officiel_verrouille(prix_officiel: f64) -> bool {
    prix_officiel > 0.01
}

/// Médiane des prix du marché Yukpo pour une classe/matière donnée.
/// Utilise TOUS les modes (neuf, troc, vente, occasion) avec pondération :
/// - livres neufs    : prix_detecte (valeur catalogue → poids 1.0)
/// - livres occasion : prix_detecte / ratio_etat reconstitué (valeur neuf estimée → poids 0.6)
/// La moyenne pondérée donne une médiane de marché représentative même sans stocks neufs.
async fn mediane_prix_neufs_marche(
    pool: &PgPool,
    classe: &str,
    matiere: &str,
) -> Result<Option<f64>, sqlx::Error> {
    let med: Option<f64> = sqlx::query_scalar(
        r#"
        SELECT AVG(sub.p_pondere)
        FROM (
            SELECT
                CASE
                    -- Livre neuf : prix catalogue direct
                    WHEN COALESCE(mode_listing, 'troc') = 'neuf'
                        THEN CAST(NULLIF(TRIM(prix_detecte::text), '') AS DOUBLE PRECISION)
                    -- Livre occasion avec ratio état connu : reconstituer valeur neuf
                    WHEN ratio_etat IS NOT NULL AND ratio_etat > 0
                        THEN CAST(NULLIF(TRIM(prix_detecte::text), '') AS DOUBLE PRECISION)
                             / CAST(NULLIF(TRIM(ratio_etat::text), '') AS DOUBLE PRECISION)
                    -- Occasion sans ratio : utiliser prix_detecte avec facteur correctif 0.60 (état moyen)
                    ELSE CAST(NULLIF(TRIM(prix_detecte::text), '') AS DOUBLE PRECISION) / 0.60
                END AS p_pondere
            FROM livres_scolaires
            WHERE is_active = true
              AND classe_actuelle = $1
              AND matiere = $2
              AND prix_detecte IS NOT NULL
              AND TRIM(prix_detecte::text) <> ''
        ) AS sub
        WHERE sub.p_pondere IS NOT NULL
          AND sub.p_pondere > 0.0
          AND sub.p_pondere < 10000000.0
        "#,
    )
    .bind(classe)
    .bind(matiere)
    .fetch_one(pool)
    .await?;

    Ok(med.filter(|m| m.is_finite() && *m > 0.0))
}

pub async fn calculer_bornes_marche(
    pool: &PgPool,
    classe: &str,
    matiere: &str,
) -> Result<(f64, f64, f64, &'static str), sqlx::Error> {
    let median = mediane_prix_neufs_marche(pool, classe, matiere).await?;

    let (min, max, sug, src) = if let Some(med) = median {
        let min_v = (med * MARGE_MIN_RATIO).max(MIN_FALLBACK_XAF).min(med);
        let max_v = (med * MARGE_MAX_RATIO).min(MAX_FALLBACK_XAF).max(med);
        let sug = med.clamp(min_v, max_v);
        (min_v, max_v, sug, "marche_livres_scolaires")
    } else {
        (
            MIN_FALLBACK_XAF,
            MAX_FALLBACK_XAF,
            SUGGEST_FALLBACK_XAF,
            "defaut",
        )
    };

    Ok((min, max, sug, src))
}

/// Persiste les bornes si absentes et renvoie l’état courant de la ligne.
pub async fn assurer_bornes_persistees(
    pool: &PgPool,
    ligne_id: Uuid,
    commande_id: Uuid,
    prix_officiel: f64,
    classe: &str,
    matiere: &str,
    titre: &str,
    quantite: i32,
    prix_officiel_verrouille: bool,
) -> Result<BornesPrixLigne, sqlx::Error> {
    let prix_final: f64 = sqlx::query_scalar(
        "SELECT CAST(prix_final AS DOUBLE PRECISION) FROM commande_livres_neufs WHERE id = $1",
    )
    .bind(ligne_id)
    .fetch_one(pool)
    .await?;

    if prix_officiel_verrouille {
        sqlx::query(
            r#"
            UPDATE commande_livres_neufs
            SET prix_plancher = $1,
                prix_plafond = $2,
                prix_suggere = $3,
                bornes_source = 'officiel'
            WHERE id = $4 AND commande_id = $5
              AND (prix_plancher IS NULL OR prix_plafond IS NULL)
            "#,
        )
        .bind(prix_officiel)
        .bind(prix_officiel)
        .bind(prix_officiel)
        .bind(ligne_id)
        .bind(commande_id)
        .execute(pool)
        .await?;

        return Ok(BornesPrixLigne {
            ligne_id,
            prix_officiel,
            prix_final,
            quantite,
            titre: titre.to_string(),
            prix_officiel_verrouille: true,
            prix_plancher: Some(prix_officiel),
            prix_plafond: Some(prix_officiel),
            prix_suggere: Some(prix_officiel),
            bornes_source: Some("officiel".to_string()),
        });
    }

    let (min_v, max_v, sug, src) = calculer_bornes_marche(pool, classe, matiere).await?;

    sqlx::query(
        r#"
        UPDATE commande_livres_neufs
        SET prix_plancher = $1,
            prix_plafond = $2,
            prix_suggere = $3,
            bornes_source = $4
        WHERE id = $5 AND commande_id = $6
          AND (prix_plancher IS NULL OR prix_plafond IS NULL OR prix_suggere IS NULL)
        "#,
    )
    .bind(min_v)
    .bind(max_v)
    .bind(sug)
    .bind(src)
    .bind(ligne_id)
    .bind(commande_id)
    .execute(pool)
    .await?;

    let row: (Option<f64>, Option<f64>, Option<f64>, Option<String>) = sqlx::query_as(
        r#"
        SELECT
            CAST(prix_plancher AS DOUBLE PRECISION),
            CAST(prix_plafond AS DOUBLE PRECISION),
            CAST(prix_suggere AS DOUBLE PRECISION),
            bornes_source
        FROM commande_livres_neufs WHERE id = $1
        "#,
    )
    .bind(ligne_id)
    .fetch_one(pool)
    .await?;

    Ok(BornesPrixLigne {
        ligne_id,
        prix_officiel,
        prix_final,
        quantite,
        titre: titre.to_string(),
        prix_officiel_verrouille: false,
        prix_plancher: row.0.or(Some(min_v)),
        prix_plafond: row.1.or(Some(max_v)),
        prix_suggere: row.2.or(Some(sug)),
        bornes_source: row.3.or(Some(src.to_string())),
    })
}

pub fn valider_prix_final_contre_bornes(
    prix_officiel_verrouille: bool,
    prix_officiel: f64,
    prix_plancher: Option<f64>,
    prix_plafond: Option<f64>,
    nouveau: f64,
) -> Result<(), String> {
    if prix_officiel_verrouille {
        if (nouveau - prix_officiel).abs() > 0.01 {
            return Err(
                "Prix officiel imposé : modification interdite pour la librairie.".to_string(),
            );
        }
        return Ok(());
    }
    let min_v = prix_plancher.unwrap_or(MIN_FALLBACK_XAF);
    let max_v = prix_plafond.unwrap_or(MAX_FALLBACK_XAF);
    if nouveau < min_v - 0.01 || nouveau > max_v + 0.01 {
        return Err(format!(
            "Le prix doit être entre {:.0} et {:.0} XAF (bornes marché).",
            min_v, max_v
        ));
    }
    Ok(())
}
