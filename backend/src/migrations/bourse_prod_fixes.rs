//! 2026-05-19 — Fixes DB Bourse du Livre garantis au boot.
//!
//! Pourquoi un module séparé ?
//!
//! En prod, `sqlx::migrate!()` peut être bloqué par une migration ancienne
//! en erreur (constatation : logs Fly montrent `pharmacy_order_qr_codes`
//! table absente et `shopping_status` enum 'delivered' manquant, signe que
//! certaines migrations n'ont jamais tourné). Si une migration plante,
//! toutes les suivantes (y compris nos fixes Bourse 2026-05-19) ne sont
//! jamais appliquées non plus.
//!
//! Ce module contourne ce risque : il exécute en idempotent les fixes
//! strictement nécessaires au flux Bourse du Livre, **indépendamment** de
//! `sqlx::migrate!()`. Appelé depuis `main.rs` après l'init du pool DB,
//! avant l'écoute Axum.
//!
//! Tous les statements sont :
//!   1. Idempotents (IF NOT EXISTS, CREATE OR REPLACE, ALTER ... ADD VALUE
//!      IF NOT EXISTS, DO BEGIN ... IF NOT EXISTS).
//!   2. Sans transaction (les ALTER TYPE ADD VALUE l'exigent côté PG).
//!   3. Tolérants aux erreurs (un fix qui plante n'empêche pas les autres).
//!
//! Activable via env `BOURSE_PROD_FIXES_ENABLED` (défaut: true).

use sqlx::PgPool;

pub async fn ensure_bourse_prod_ready(pool: &PgPool) {
    let enabled = std::env::var("BOURSE_PROD_FIXES_ENABLED")
        .map(|v| v != "false" && v != "0")
        .unwrap_or(true);
    if !enabled {
        log::info!("[bourse-prod-fixes] désactivé via BOURSE_PROD_FIXES_ENABLED=false");
        return;
    }

    log::info!("[bourse-prod-fixes] début application fixes idempotents...");

    let fixes: &[(&str, &str)] = &[
        // ─── Migration 20260424_001 partielle : pays + national ────────
        (
            "etablissements_scolaires.pays",
            r#"ALTER TABLE etablissements_scolaires ADD COLUMN IF NOT EXISTS pays VARCHAR(2) DEFAULT 'CM'"#,
        ),
        (
            "etablissements_scolaires.is_national",
            r#"ALTER TABLE etablissements_scolaires ADD COLUMN IF NOT EXISTS is_national BOOLEAN NOT NULL DEFAULT FALSE"#,
        ),
        (
            "programmes_scolaires.pays",
            r#"ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS pays VARCHAR(2) DEFAULT 'CM'"#,
        ),

        // ─── Migration 20260516_002 partielle : audit_logs ─────────────
        (
            "audit_logs table",
            r#"CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                old_value JSONB,
                new_value JSONB,
                ip TEXT,
                user_agent TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )"#,
        ),
        (
            "audit_logs idx user_action",
            r#"CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC)"#,
        ),

        // ─── Migration 20260516_004 : livres_scolaires_demandes ──────────
        // ✅ FIX 2026-05-19 (bug nommage) — le code prod utilise le PLURIEL
        // `livres_scolaires_demandes` (cf. troc_intelligent_service.rs:311
        // et autres). Mon précédent CREATE TABLE en singulier était invisible
        // pour l'algo DAG. + colonnes matched_chaine_id et expires_at
        // requises par find_matching_chaine pour matcher les acheteurs sinks.
        (
            "livres_scolaires_demandes table",
            r#"CREATE TABLE IF NOT EXISTS livres_scolaires_demandes (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                titre TEXT NOT NULL,
                auteur TEXT,
                matiere VARCHAR(100),
                classe_souhaitee VARCHAR(50),
                niveau VARCHAR(100),
                budget_max_xaf INTEGER NOT NULL DEFAULT 0,
                gps VARCHAR(100),
                ville VARCHAR(100),
                quartier VARCHAR(100),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                is_satisfied BOOLEAN NOT NULL DEFAULT FALSE,
                satisfied_at TIMESTAMPTZ,
                matched_chaine_id INTEGER,
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )"#,
        ),
        (
            "livres_scolaires_demandes idx active",
            r#"CREATE INDEX IF NOT EXISTS idx_lssd_active ON livres_scolaires_demandes(is_active, classe_souhaitee) WHERE is_active = TRUE AND is_satisfied = FALSE"#,
        ),

        // ─── Migration 20260521_001 : index composite matching DAG ─────
        // Optimise find_matching_chaine SELECT (cf. troc_intelligent_service.rs:307+)
        // qui filtre is_active+is_available+user_id+etat_classification+mode_listing.
        // Sans cet index, table scan 1000+ rows à chaque /match → pool saturé
        // sous charge 10k req/s. Avec : index seek 0(log N).
        (
            "idx_livres_matching_dag",
            r#"CREATE INDEX IF NOT EXISTS idx_livres_matching_dag
                ON livres_scolaires(classe_actuelle, classe_souhaitee, matiere, mode_listing, user_id)
                WHERE is_active = true
                  AND is_available = true
                  AND COALESCE(etat_classification, 'acceptable') != 'rejete'
                  AND COALESCE(mode_listing, 'troc') IN ('troc', 'vente')"#,
        ),
        (
            "idx_livres_user_active",
            r#"CREATE INDEX IF NOT EXISTS idx_livres_user_active
                ON livres_scolaires(user_id, created_at DESC)
                WHERE is_active = true AND is_available = true"#,
        ),
        (
            "idx_demandes_active_classe_matiere",
            r#"CREATE INDEX IF NOT EXISTS idx_demandes_active_classe_matiere
                ON livres_scolaires_demandes(classe_souhaitee, matiere, user_id)
                WHERE is_active = true
                  AND is_satisfied = false
                  AND matched_chaine_id IS NULL"#,
        ),

        // ─── Migration 20260519_001 (re-affirmation) : is_packaged ─────
        (
            "commande_livres_neufs.is_packaged",
            r#"ALTER TABLE commande_livres_neufs ADD COLUMN IF NOT EXISTS is_packaged BOOLEAN NOT NULL DEFAULT FALSE"#,
        ),
        (
            "idx_commande_livres_neufs_pending_packaging",
            r#"CREATE INDEX IF NOT EXISTS idx_commande_livres_neufs_pending_packaging
                ON commande_livres_neufs(commande_id)
                WHERE statut_validation = 'valide' AND is_packaged = false"#,
        ),

        // ─── Migration 20260519_002 (re-affirmation) ───────────────────
        (
            "commande_validations.articles_libere",
            r#"ALTER TABLE commande_validations
                ADD COLUMN IF NOT EXISTS articles_libere UUID[] DEFAULT '{}',
                ADD COLUMN IF NOT EXISTS timestamp_libere TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ"#,
        ),
        (
            "idx_validations_expire_at",
            r#"CREATE INDEX IF NOT EXISTS idx_validations_expire_at
                ON commande_validations (expire_at)
                WHERE expire_at IS NOT NULL AND statut = 'en_cours'"#,
        ),
        (
            "grossistes table",
            r#"CREATE TABLE IF NOT EXISTS grossistes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nom TEXT NOT NULL,
                ville TEXT,
                telephone TEXT,
                whatsapp TEXT,
                email TEXT,
                specialites TEXT[] DEFAULT '{}',
                mode_integration TEXT NOT NULL DEFAULT 'manuel' CHECK (mode_integration IN ('manuel','api')),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                api_endpoint TEXT,
                api_token_encrypted TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )"#,
        ),
        (
            "commande_livres_neufs.grossiste_assigne_id",
            r#"ALTER TABLE commande_livres_neufs
                ADD COLUMN IF NOT EXISTS grossiste_assigne_id UUID REFERENCES grossistes(id),
                ADD COLUMN IF NOT EXISTS commande_grossiste_envoyee_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS commande_grossiste_confirmee_at TIMESTAMPTZ"#,
        ),

        // ─── Migration 20260519_004 : distance_gps function ────────────
        (
            "distance_gps function",
            r#"CREATE OR REPLACE FUNCTION distance_gps(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
                RETURNS FLOAT AS $$
                DECLARE
                    R FLOAT := 6371;
                    dlat FLOAT; dlon FLOAT; a FLOAT; c FLOAT;
                BEGIN
                    dlat := radians(lat2 - lat1);
                    dlon := radians(lon2 - lon1);
                    a := sin(dlat/2) * sin(dlat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2) * sin(dlon/2);
                    c := 2 * atan2(sqrt(a), sqrt(1-a));
                    RETURN R * c;
                END;
                $$ LANGUAGE plpgsql IMMUTABLE"#,
        ),
    ];

    let mut ok = 0;
    let mut err = 0;
    for (label, sql) in fixes {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {
                log::info!("[bourse-prod-fixes] ✅ {}", label);
                ok += 1;
            }
            Err(e) => {
                log::error!("[bourse-prod-fixes] ❌ {} : {}", label, e);
                err += 1;
            }
        }
    }

    // ─── Enums (ALTER TYPE ADD VALUE refuse d'être dans une tx) ────────
    // On les fait séparément avec gestion d'erreur silencieuse pour
    // "already exists" qui n'est pas une vraie erreur.
    let enum_fixes: &[(&str, &str)] = &[
        (
            "livre_validation_statut += rupture_grossiste",
            "ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'rupture_grossiste'",
        ),
        (
            "livre_validation_statut += libere_libraires",
            "ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'libere_libraires'",
        ),
        (
            "livre_validation_statut += annule_rupture",
            "ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'annule_rupture'",
        ),
        (
            "livre_validation_statut += refuse_coursier",
            "ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'refuse_coursier'",
        ),
        (
            "livre_validation_statut += refuse_parent",
            "ALTER TYPE livre_validation_statut ADD VALUE IF NOT EXISTS 'refuse_parent'",
        ),
        (
            "delivery_courier_status += active",
            "ALTER TYPE delivery_courier_status ADD VALUE IF NOT EXISTS 'active'",
        ),
        (
            "delivery_courier_status += inactive",
            "ALTER TYPE delivery_courier_status ADD VALUE IF NOT EXISTS 'inactive'",
        ),
    ];

    for (label, sql) in enum_fixes {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {
                log::info!("[bourse-prod-fixes] ✅ {}", label);
                ok += 1;
            }
            Err(e) => {
                // ALTER TYPE renvoie souvent "type X already has value Y" qu'on
                // ignore via IF NOT EXISTS, mais selon la version PG ça peut
                // remonter en err. Log debug seulement.
                log::warn!("[bourse-prod-fixes] ⚠ {} : {}", label, e);
                err += 1;
            }
        }
    }

    // ─── Fix bug I : libraire_team_members.librairie_id type UUID ──────
    // Cas spécial : ALTER COLUMN TYPE en passant par TEXT (PG refuse INTEGER → UUID direct).
    // On vérifie le type actuel avant action pour idempotence stricte.
    let type_check_sql = r#"
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'libraire_team_members' AND column_name = 'librairie_id'
    "#;
    match sqlx::query_scalar::<_, String>(type_check_sql)
        .fetch_optional(pool)
        .await
    {
        Ok(Some(t)) if t == "integer" => {
            log::warn!(
                "[bourse-prod-fixes] ⚠ libraire_team_members.librairie_id encore INTEGER, conversion vers UUID nécessaire — laissée à la migration 20260518_001 (DELETE puis ALTER pour éviter cast problématique)"
            );
            // Ne pas tenter le ALTER ici — la migration originale fait
            // DELETE FROM ... avant l'ALTER. Trop risqué côté code Rust.
            err += 1;
        }
        Ok(Some(t)) if t == "uuid" => {
            log::info!("[bourse-prod-fixes] ✅ libraire_team_members.librairie_id type UUID OK");
            ok += 1;
        }
        Ok(Some(t)) => {
            log::warn!(
                "[bourse-prod-fixes] ⚠ libraire_team_members.librairie_id type inattendu : {}",
                t
            );
        }
        Ok(None) => {
            log::info!(
                "[bourse-prod-fixes] ⚠ table libraire_team_members absente, skip vérif UUID"
            );
        }
        Err(e) => {
            log::warn!("[bourse-prod-fixes] check libraire_team_members échec : {}", e);
        }
    }

    log::info!(
        "[bourse-prod-fixes] terminé — {} OK, {} erreurs (warnings inclus)",
        ok,
        err
    );
}
