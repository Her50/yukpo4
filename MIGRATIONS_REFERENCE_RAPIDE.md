# 🚀 Référence Rapide - Migrations Automatiques

**Pour trouver rapidement ce fichier**: Chercher "MIGRATIONS_REFERENCE_RAPIDE" ou "migrations automatiques"

## 📁 Fichier Principal de Référence

**`backend/GUIDE_MIGRATIONS_AUTOMATIQUES.md`** ← **FICHIER PRINCIPAL**

Ce fichier contient:
- ✅ Tous les détails sur le système de migrations automatiques
- ✅ Liste complète des fichiers de migration
- ✅ Processus Git → Docker → AWS ECS
- ✅ Guide de création de nouvelles migrations
- ✅ Résolution de problèmes

## 🎯 Réponse Rapide

### Où sont les migrations?
- **Dossier**: `backend/migrations/`
- **Fichiers critiques**:
  - `20260207_fix_all_missing_tables_and_functions.sql`
  - `20260207_create_delivery_requests_and_courier_profiles.sql`

### Comment ça marche?
1. **Automatique**: Les migrations s'exécutent au démarrage du backend
2. **Code**: `backend/src/main.rs` ligne ~738 → `sqlx::migrate!("./migrations")`
3. **Idempotent**: Utilise `IF NOT EXISTS`, `CREATE OR REPLACE`, etc.
4. **Sûr**: Les builds futurs ne cassent pas les migrations existantes

### Scripts Utiles
- `backend/scripts/executer_migration_sql.ps1` - Exécuter une migration manuellement
- `backend/scripts/executer_rapport_verification.ps1` - Vérifier l'état de la base

## 📚 Documentation Complète

👉 **Voir `backend/GUIDE_MIGRATIONS_AUTOMATIQUES.md` pour tous les détails**



