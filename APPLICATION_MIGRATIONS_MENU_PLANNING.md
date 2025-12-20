# 🚀 APPLICATION DES MIGRATIONS - PLANIFICATION MENUS

## 📊 VÉRIFICATION COMPLÈTE

### ✅ Migrations dans auto_migrate.rs
- **Ligne 7000** : Appel `ensure_menu_planning_tables()` dans `run_all_migrations()`
- **Ligne 11864-11877** : Fonction `ensure_menu_planning_tables()` définie

### ✅ Tables dans 0000_create_all_tables.sql
- **Ligne 4793+** : Toutes les 8 tables menu planning ajoutées

### ✅ Migration SQL séparée
- **Fichier** : `backend/migrations/20250127_create_menu_planning_tables.sql`
- **8 tables** avec index et commentaires

## 🔧 MÉTHODES D'APPLICATION

### Option 1: Automatique au démarrage (Recommandé)

Les migrations sont appliquées automatiquement quand le serveur démarre :

```bash
cd backend
cargo run
```

Le serveur va :
1. Vérifier si les tables existent
2. Les créer si elles n'existent pas
3. Créer les index
4. Continuer le démarrage

### Option 2: Via sqlx-cli (Manuel)

```bash
# Installer sqlx-cli si pas déjà fait
cargo install sqlx-cli --features postgres

# Configurer la base de données
$env:DATABASE_URL="postgresql://user:password@host:port/database"

# Appliquer la migration
sqlx migrate run

# Vérifier l'état
sqlx migrate info
```

### Option 3: Via psql (Direct)

Si vous avez psql installé :

```powershell
# Windows PowerShell
$env:PGPASSWORD="YOUR_PASSWORD"
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -f backend/migrations/20250127_create_menu_planning_tables.sql
```

```bash
# Linux/macOS
export PGPASSWORD="YOUR_PASSWORD"
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -f backend/migrations/20250127_create_menu_planning_tables.sql
```

### Option 4: Script PowerShell

```powershell
.\scripts\apply_menu_planning_migration.ps1
```

## ✅ VÉRIFICATION APRÈS APPLICATION

Connectez-vous à la base et vérifiez :

```sql
-- Vérifier les tables créées
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'family_profiles', 
    'recipes', 
    'menu_plans', 
    'planned_meals', 
    'recipe_favorites', 
    'shopping_lists', 
    'shopping_list_items', 
    'nutrition_analytics'
)
ORDER BY table_name;

-- Vérifier les index
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
    'family_profiles', 
    'recipes', 
    'menu_plans', 
    'planned_meals', 
    'recipe_favorites', 
    'shopping_lists', 
    'shopping_list_items', 
    'nutrition_analytics'
);
```

## 🎯 RECOMMANDATION

**Utilisez l'Option 1** (automatique au démarrage) car :
- ✅ Plus sûr (utilise le même code que en production)
- ✅ Gestion d'erreurs intégrée
- ✅ Pas besoin d'outils externes
- ✅ Logs détaillés

Les migrations sont **idempotentes** (utilisent `CREATE TABLE IF NOT EXISTS`), donc vous pouvez les relancer sans risque.

## 📝 PROCHAINES ÉTAPES

1. ✅ Appliquer les migrations
2. ✅ Vérifier que les tables sont créées
3. ✅ Tester le service via l'API :
   - `POST /api/menus/family-profile` - Créer profil
   - `GET /api/menus/family-profile` - Récupérer profil
   - `POST /api/menus/ai/generate-week` - Générer menu
   - `GET /api/menus/my-week` - Récupérer menu

---

**Les migrations sont prêtes à être appliquées !**

