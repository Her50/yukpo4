# 🔄 Gestion des Migrations Database sur Render

## Vue d'ensemble

Le système de migrations de Yukpomnang utilise **auto-migration** : toutes les migrations sont appliquées automatiquement au démarrage du backend via `backend/src/migrations/auto_migrate.rs`.

## ✅ Migration Auto pour Bourse du Livre Scolaire

### Migration concernée

**Fichier**: `backend/migrations/20250128_create_livres_scolaires_troc.sql`

**Tables créées**:
- `livres_scolaires` - Catalogue de livres scolaires
- `troc_livres_scolaires` - Troc directs et chaînes
- `chaines_troc_livres` - Métadonnées des chaînes

### Intégration auto-migration

La migration est intégrée dans `backend/src/migrations/auto_migrate.rs` :

```rust
// ✅ 2025-01-28 : Tables pour bourse du livre scolaire et troc intelligent
match ensure_livres_scolaires_tables(pool).await {
    Ok(_) => info!("✅ Migration auto: livres scolaires tables OK"),
    Err(e) => error!("❌ Erreur migration auto livres scolaires: {}", e),
}
```

**Fonction**: `ensure_livres_scolaires_tables()`
- Ligne 10901 dans `auto_migrate.rs`
- Appelée automatiquement dans `run_auto_migrations()` (ligne 6399)

## 🚀 Déploiement sur Render

### Processus automatique

1. **Au démarrage du backend Render**:
   - Le backend Rust démarre
   - `run_auto_migrations()` est appelée
   - Toutes les migrations (y compris livres scolaires) sont exécutées
   - Les logs Render affichent les résultats

2. **Logs à vérifier**:
   ```
   ✅ Migration auto: livres scolaires tables OK
   ```

   Ou en cas d'erreur:
   ```
   ❌ Erreur migration auto livres scolaires: [détails]
   ```

### Vérification manuelle (optionnel)

Si vous voulez vérifier que les migrations ont été appliquées :

1. **Se connecter à la base PostgreSQL Render**:
   ```bash
   psql "postgresql://yukpo_db_user:PASSWORD@your-render-db-host.render.com/yukpo_db"
   ```

2. **Vérifier les tables**:
   ```sql
   \dt livres_scolaires
   \dt troc_livres_scolaires
   \dt chaines_troc_livres
   ```

3. **Vérifier les indexes**:
   ```sql
   \d+ livres_scolaires
   \d+ troc_livres_scolaires
   ```

## ⚠️ Notes importantes

### Sécurité

- Les migrations utilisent `CREATE TABLE IF NOT EXISTS` - idempotentes
- Aucun risque de duplication en cas de redémarrage
- Les migrations sont exécutées à chaque démarrage (mais uniquement si les tables n'existent pas)

### Compatibilité SQLx

- Toutes les migrations sont compatibles avec `SQLX_OFFLINE=true`
- Le fichier `sqlx-data.json` n'a pas besoin d'être mis à jour pour ces tables (utilisé uniquement pour les requêtes typées)

### Rollback

⚠️ **Important**: Les migrations auto ne gèrent **PAS** de rollback automatique. Si vous devez annuler une migration :

1. Créer une migration manuelle avec `DROP TABLE IF EXISTS`
2. Ou modifier manuellement la base via `psql`

## 📋 Checklist de déploiement

- [x] Migration SQL créée (`20250128_create_livres_scolaires_troc.sql`)
- [x] Fonction `ensure_livres_scolaires_tables()` créée dans `auto_migrate.rs`
- [x] Appel ajouté dans `run_auto_migrations()`
- [ ] Backend déployé sur Render
- [ ] Logs Render vérifiés pour confirmation
- [ ] Tables vérifiées dans la base PostgreSQL (optionnel)

## 🔍 Debugging

Si les migrations ne s'appliquent pas :

1. **Vérifier les logs Render**:
   - Dashboard Render → Service Backend → Logs
   - Chercher les messages de migration

2. **Vérifier la connexion DB**:
   - La variable `DATABASE_URL` est-elle correcte ?
   - La base PostgreSQL est-elle accessible ?

3. **Vérifier les permissions**:
   - L'utilisateur DB a-t-il les droits `CREATE TABLE` ?

4. **Vérifier la syntaxe SQL**:
   - Le fichier SQL est-il valide ?
   - `execute_multiple_sql_commands()` gère-t-il correctement les blocs dollar-quoted ?

## 📚 Références

- **Fichier migration**: `backend/migrations/20250128_create_livres_scolaires_troc.sql`
- **Fonction auto-migration**: `backend/src/migrations/auto_migrate.rs` (ligne 10901)
- **Point d'entrée**: `backend/src/migrations/auto_migrate.rs::run_auto_migrations()` (ligne 6399)
- **Fonction utilitaire**: `execute_multiple_sql_commands()` (gère les commandes SQL multiples)

## ✨ Avantages de l'auto-migration

✅ **Pas d'intervention manuelle** - Tout est automatique
✅ **Idempotent** - Pas de risque de duplication
✅ **Logs clairs** - Facile à débugger
✅ **Compatible Render** - Fonctionne out-of-the-box
✅ **Versioning** - Chaque migration a un timestamp unique

