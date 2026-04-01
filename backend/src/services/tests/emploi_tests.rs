// Tests pour les services offres d'emploi
// Les tests marqués #[ignore] nécessitent une base de données de test.
// Lancer avec: cargo test emploi -- --include-ignored

#[cfg(test)]
mod tests {
    use crate::models::offres_emploi_model::{
        CreateOffreEmploiRequest, SearchOffresRequest,
    };
    use crate::services::offres_emploi_service::OffresEmploiService;
    use crate::services::alertes_emploi_service::AlertesEmploiService;
    use crate::services::statistiques_emploi_service::StatistiquesEmploiService;

    // Helper: pool de test (nécessite DATABASE_URL dans l'environnement)
    async fn test_pool() -> sqlx::PgPool {
        let url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgresql://yukpo_user:test@localhost/yukpo_db_test".to_string());
        sqlx::PgPool::connect(&url)
            .await
            .expect("Impossible de se connecter à la base de test")
    }

    // ── OffresEmploiService ──────────────────────────────────────────────────

    #[tokio::test]
    #[ignore] // Nécessite DB de test
    async fn test_search_offres_sans_filtres() {
        let pool = test_pool().await;
        let svc = OffresEmploiService::new(pool, None);
        let req = SearchOffresRequest {
            query: None,
            secteur: None,
            type_contrat: None,
            lieu: None,
            lat: None,
            lng: None,
            rayon_km: None,
            salaire_min: None,
            salaire_max: None,
            experience_max: None,
            remote: None,
            niveau_etude: None,
            page: Some(1),
            limit: Some(10),
        };
        let result = svc.search_offres(req).await;
        assert!(result.is_ok(), "search_offres devrait réussir: {:?}", result.err());
        let (offres, total) = result.unwrap();
        assert!(total >= 0);
        assert!(offres.len() <= 10);
    }

    #[tokio::test]
    #[ignore]
    async fn test_search_offres_avec_query() {
        let pool = test_pool().await;
        let svc = OffresEmploiService::new(pool, None);
        let req = SearchOffresRequest {
            query: Some("développeur".to_string()),
            secteur: None,
            type_contrat: None,
            lieu: None,
            lat: None,
            lng: None,
            rayon_km: None,
            salaire_min: None,
            salaire_max: None,
            experience_max: None,
            remote: None,
            niveau_etude: None,
            page: Some(1),
            limit: Some(5),
        };
        let result = svc.search_offres(req).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_offre_inexistante_retourne_erreur() {
        let pool = test_pool().await;
        let svc = OffresEmploiService::new(pool, None);
        let result = svc.get_offre_details(999_999_999).await;
        assert!(result.is_err(), "Offre inexistante devrait retourner une erreur");
    }

    #[tokio::test]
    #[ignore]
    async fn test_create_offre() {
        let pool = test_pool().await;
        let svc = OffresEmploiService::new(pool, None);
        let req = CreateOffreEmploiRequest {
            titre_poste: "Test Développeur Rust".to_string(),
            description: "Poste de test".to_string(),
            type_contrat: "CDI".to_string(),
            duree_contrat: None,
            lieu_travail: "Douala".to_string(),
            adresse: None,
            gps: None,
            remote: false,
            remote_partiel: false,
            salaire_min: None,
            salaire_max: None,
            devise: Some("XAF".to_string()),
            salaire_negociable: Some(true),
            niveau_etude: None,
            experience_min: Some(1),
            competences_requises: Some(vec!["Rust".to_string()]),
            langues_requises: None,
            permis_requis: None,
            secteur: "Informatique".to_string(),
            domaine: None,
            tags: None,
            date_limite_candidature: None,
            date_debut_poste: None,
            nombre_postes: Some(1),
        };
        let result = svc.create_offre(1, req).await;
        assert!(result.is_ok(), "Création offre devrait réussir: {:?}", result.err());
        let offre = result.unwrap();
        assert_eq!(offre.titre_poste, "Test Développeur Rust");
        assert_eq!(offre.type_contrat, "CDI");
    }

    // ── StatistiquesEmploiService ────────────────────────────────────────────

    #[tokio::test]
    #[ignore]
    async fn test_tendances_marche_retourne_donnees() {
        let pool = test_pool().await;
        let svc = StatistiquesEmploiService::new(pool, None);
        let result = svc.get_tendance_marche().await;
        assert!(result.is_ok(), "get_tendance_marche devrait réussir: {:?}", result.err());
    }

    // ── AlertesEmploiService ─────────────────────────────────────────────────

    #[tokio::test]
    #[ignore]
    async fn test_check_alertes_ne_plante_pas() {
        let pool = test_pool().await;
        let svc = AlertesEmploiService::new(pool, None);
        // Doit s'exécuter sans paniquer même si la table est vide
        let result = svc.check_and_send_alertes().await;
        assert!(result.is_ok(), "check_and_send_alertes devrait réussir: {:?}", result.err());
    }
}
