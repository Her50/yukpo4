# ✅ Checklist de déploiement - Services IA

## 1. Application des migrations sur Render

### Option A: Via SQLx CLI (Recommandé)

```bash
# Windows PowerShell
.\scripts\apply_migrations_render.ps1

# Linux/Mac
chmod +x scripts/apply_migrations_render.sh
./scripts/apply_migrations_render.sh
```

### Option B: Automatique au démarrage

Les migrations s'appliquent automatiquement via `auto_migrate.rs` au démarrage du serveur.

**Vérification**:
```sql
-- Se connecter à la base Render
psql "postgresql://user:password@host:port/database"

-- Vérifier les tables créées
\dt book_exchanges
\dt book_recommendations
\dt book_price_history
\dt student_profiles
\dt program_recommendations
\dt cv_ai_analyses
\dt salary_predictions
```

## 2. Vérification des endpoints backend

### Tests manuels

```bash
# Tester les endpoints IA
./scripts/test_ai_endpoints.sh http://your-api-url.com

# Avec authentification
./scripts/test_ai_endpoints.sh http://your-api-url.com YOUR_JWT_TOKEN
```

### Endpoints à vérifier

#### Bourse du Livre
- ✅ `GET /api/bourse-livre/search` (publique)
- ✅ `GET /api/bourse-livre/ai/price-suggestions` (publique)
- ✅ `POST /api/bourse-livre/ai/recommendations` (protégé JWT)
- ✅ `POST /api/bourse-livre/ai/matching` (protégé JWT)

#### Orientation Scolaire
- ✅ `POST /api/orientation/ai/analyze-profile` (protégé JWT)
- ✅ `POST /api/orientation/ai/recommendations` (protégé JWT)
- ✅ `POST /api/orientation/ai/compare-programs` (protégé JWT)

#### Offres d'Emploi
- ✅ `GET /api/offres-emploi/ai/salary-prediction` (publique)
- ✅ `POST /api/offres-emploi/ai/analyze-cv` (protégé JWT)
- ✅ `POST /api/offres-emploi/ai/suggest-formations` (protégé JWT)

### Vérification des réponses

Tous les endpoints doivent retourner:
```json
{
  "success": true,
  "data": { ... }
}
```

## 3. Tests des écrans mobiles

### Prérequis
- [ ] Backend accessible
- [ ] Utilisateur connecté
- [ ] Profil étudiant créé (pour Orientation Scolaire)

### Checklist de test

#### Bourse du Livre
- [ ] Recherche fonctionne
- [ ] Filtres appliqués
- [ ] Recommandations IA générées
- [ ] Suggestions prix affichées
- [ ] Matching IA fonctionne

#### Orientation Scolaire
- [ ] Profil étudiant créable/modifiable
- [ ] Analyse profil retourne résultats
- [ ] Recommandations programmes générées
- [ ] Comparaison programmes fonctionne

#### Offres d'Emploi
- [ ] Analyse CV retourne scores
- [ ] Prédiction salaire affiche fourchette
- [ ] Suggestions formations générées

Voir `scripts/test_mobile_screens.md` pour les détails.

## 4. Activation Redis Cache

### Étape 1: Configuration

Ajouter dans les variables d'environnement Render:

```bash
REDIS_URL=redis://your-redis-url:6379/0
```

### Étape 2: Activer dans le code

Modifier `backend/src/services/app_ia.rs` ligne 497-498:

**AVANT** (désactivé):
```rust
log::info!("[AppIA] Redis désactivé - continuation sans cache");
```

**APRÈS** (activé):
```rust
// Vérification du cache Redis
if let Ok(mut conn) = self.redis_client.get_async_connection().await {
    let cache_key = format!("ai:prompt:{}", md5::compute(prompt));
    if let Ok(cached) = redis::cmd("GET")
        .arg(&cache_key)
        .query_async::<_, Option<String>>(&mut conn)
        .await
    {
        if let Some(cached_response) = cached {
            log::info!("[AppIA] ✅ Cache hit Redis");
            return Ok(("cached".to_string(), cached_response, 0));
        }
    }
}
```

### Étape 3: Sauvegarder dans le cache

Ajouter après une prédiction réussie (après ligne ~536):

```rust
// Sauvegarder dans le cache (TTL: 1 heure)
if let Ok(mut conn) = self.redis_client.get_async_connection().await {
    let cache_key = format!("ai:prompt:{}", md5::compute(prompt));
    let _ = redis::cmd("SETEX")
        .arg(&cache_key)
        .arg(3600) // 1 heure
        .arg(&response)
        .query_async::<_, ()>(&mut conn)
        .await;
    log::debug!("[AppIA] ✅ Réponse mise en cache");
}
```

Voir `scripts/enable_redis_cache.md` pour les détails complets.

## 5. Vérifications finales

### Backend
- [ ] `cargo check` passe sans erreurs
- [ ] `cargo test` passe
- [ ] Migrations appliquées
- [ ] Endpoints répondent correctement
- [ ] Logs ne montrent pas d'erreurs critiques

### Mobile
- [ ] Navigation fonctionne
- [ ] Écrans s'affichent correctement
- [ ] Appels API réussis
- [ ] Gestion d'erreurs fonctionne
- [ ] UX fluide

### Base de données
- [ ] Tables créées
- [ ] Index créés
- [ ] Contraintes appliquées
- [ ] Données de test insérées (optionnel)

## 6. Monitoring

### Logs à surveiller

```
✅ Migration auto: bourse livre advanced tables OK
✅ Migration auto: orientation scolaire advanced tables OK
✅ Migration auto: offres emploi advanced tables OK
[AppIA] ✅ Succès avec openai-gpt4o en 1234ms (456 tokens)
```

### Métriques à suivre

- Temps de réponse des endpoints IA
- Taux de succès des prédictions IA
- Utilisation du cache Redis (si activé)
- Erreurs dans les logs

## 7. Rollback (si nécessaire)

Si des problèmes surviennent:

```sql
-- Supprimer les tables avancées (ATTENTION: perte de données)
DROP TABLE IF EXISTS book_analytics CASCADE;
DROP TABLE IF EXISTS book_price_history CASCADE;
DROP TABLE IF EXISTS book_recommendations CASCADE;
DROP TABLE IF EXISTS book_exchanges CASCADE;
DROP TABLE IF EXISTS orientation_analytics CASCADE;
DROP TABLE IF EXISTS program_comparisons CASCADE;
DROP TABLE IF EXISTS program_recommendations CASCADE;
DROP TABLE IF EXISTS student_profiles CASCADE;
DROP TABLE IF EXISTS emploi_analytics_advanced CASCADE;
DROP TABLE IF EXISTS formation_suggestions CASCADE;
DROP TABLE IF EXISTS salary_predictions CASCADE;
DROP TABLE IF EXISTS cv_ai_analyses CASCADE;
```

## Support

En cas de problème:
1. Vérifier les logs backend
2. Vérifier les logs de la base de données
3. Tester les endpoints individuellement
4. Vérifier les variables d'environnement
