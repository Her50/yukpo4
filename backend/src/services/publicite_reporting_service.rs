use log;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};

/// Service pour générer des rapports automatisés
pub struct PubliciteReportingService;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportConfig {
    pub user_id: i32,
    pub frequency: String, // 'daily', 'weekly', 'monthly'
    pub format: String,    // 'csv', 'excel', 'pdf'
    pub email: Option<String>,
    pub metrics: Vec<String>, // ['views', 'clicks', 'conversions', 'roi']
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AutomatedReport {
    pub id: i32,
    pub user_id: i32,
    pub report_type: String,
    pub period_start: String,
    pub period_end: String,
    pub metrics: Value,
    pub file_url: Option<String>,
    pub created_at: String,
}

impl PubliciteReportingService {
    /// Générer un rapport Excel
    pub async fn generate_excel_report(
        pool: &PgPool,
        user_id: i32,
        period_days: i32,
    ) -> Result<Vec<u8>, sqlx::Error> {
        // Récupérer les données
        let campaigns = sqlx::query(
            r#"
            SELECT 
                id,
                titre,
                vues,
                clics,
                cout as budget,
                CASE WHEN vues > 0 THEN (clics::float / vues::float) * 100.0 ELSE 0.0 END as ctr,
                CASE WHEN clics > 0 THEN (cout::float / clics::float) ELSE 0.0 END as cpc,
                CASE WHEN cout > 0 THEN (clics::float / cout::float) * 100.0 ELSE 0.0 END as roi,
                date_debut,
                date_fin,
                status
            FROM publicites
            WHERE user_id = $1
            AND created_at >= NOW() - ($2 || ' days')::interval
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(period_days)
        .fetch_all(pool)
        .await?;

        // Générer Excel (format simple CSV pour l'instant, à améliorer avec une lib Excel)
        let mut csv = String::new();
        csv.push_str(
            "ID,Titre,Vues,Clics,Budget,CTR (%),CPC (FCFA),ROI (%),Date Début,Date Fin,Statut\n",
        );

        for row in campaigns {
            let id: i32 = row.get("id");
            let titre: String = row.get("titre");
            let vues: i32 = row.get("vues");
            let clics: i32 = row.get("clics");
            let budget: i64 = row.get("budget");
            let ctr: f64 = row.get("ctr");
            let cpc: f64 = row.get("cpc");
            let roi: f64 = row.get("roi");
            let date_debut: Option<chrono::NaiveDateTime> = row.get("date_debut");
            let date_fin: Option<chrono::NaiveDateTime> = row.get("date_fin");
            let status: String = row.get("status");

            csv.push_str(&format!(
                "{},{},{},{},{},{:.2},{:.0},{:.2},{},{},{}\n",
                id,
                escape_csv(&titre),
                vues,
                clics,
                budget,
                ctr,
                cpc,
                roi,
                date_debut
                    .map(|d| d.format("%Y-%m-%d").to_string())
                    .unwrap_or_default(),
                date_fin
                    .map(|d| d.format("%Y-%m-%d").to_string())
                    .unwrap_or_default(),
                status
            ));
        }

        // Convertir CSV en bytes (pour Excel, utiliser une vraie lib comme calamine ou rust_xlsxwriter)
        Ok(csv.into_bytes())
    }

    /// Créer une configuration de rapport automatisé
    pub async fn create_automated_report(
        pool: &PgPool,
        config: ReportConfig,
    ) -> Result<i32, sqlx::Error> {
        let report_id: i32 = sqlx::query_scalar(
            r#"
            INSERT INTO automated_reports (
                user_id, frequency, format, email, metrics
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#,
        )
        .bind(config.user_id)
        .bind(config.frequency)
        .bind(config.format)
        .bind(config.email)
        .bind(serde_json::to_value(config.metrics).unwrap_or_else(|_| serde_json::json!([])))
        .fetch_one(pool)
        .await?;

        log::info!("[Reporting] Rapport automatisé créé: {}", report_id);
        Ok(report_id)
    }

    /// Générer et envoyer les rapports automatisés
    pub async fn process_automated_reports(pool: &PgPool) -> Result<usize, sqlx::Error> {
        // Récupérer les rapports à générer
        let reports = sqlx::query(
            r#"
            SELECT id, user_id, frequency, format, email, metrics
            FROM automated_reports
            WHERE is_active = true
            AND (
                (frequency = 'daily' AND last_sent_at < CURRENT_DATE)
                OR (frequency = 'weekly' AND last_sent_at < CURRENT_DATE - INTERVAL '7 days')
                OR (frequency = 'monthly' AND last_sent_at < CURRENT_DATE - INTERVAL '30 days')
            )
            "#,
        )
        .fetch_all(pool)
        .await?;

        let mut processed = 0;
        for row in reports {
            let report_id: i32 = row.get("id");
            let user_id: i32 = row.get("user_id");
            let format: String = row.get("format");
            let email: Option<String> = row.get("email");

            // Générer le rapport
            let report_data = match format.as_str() {
                "excel" => Self::generate_excel_report(pool, user_id, 30).await?,
                _ => continue,
            };

            // TODO: Envoyer par email si email fourni
            if let Some(email_addr) = email {
                log::info!("[Reporting] Envoi rapport {} à {}", report_id, email_addr);
                // Intégrer avec email_service
            }

            // Mettre à jour last_sent_at
            sqlx::query(
                r#"
                UPDATE automated_reports
                SET last_sent_at = NOW()
                WHERE id = $1
                "#,
            )
            .bind(report_id)
            .execute(pool)
            .await?;

            processed += 1;
        }

        Ok(processed)
    }
}

fn escape_csv(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace("\"", "\"\""))
    } else {
        value.to_string()
    }
}
