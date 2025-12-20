# Exécution des migrations directement

Ce document explique comment exécuter les migrations directement sur la base de données, même si elles sont déjà dans `auto_migrate.rs`.

## Méthode 1: Utiliser psql (recommandé)

Si vous avez `psql` installé (client PostgreSQL):

```bash
cd backend
psql "postgresql://user:password@host:port/database" -f run_all_migrations.sql
```

## Méthode 2: Utiliser le script Rust

Compilez et exécutez le script Rust:

```bash
cd backend
$env:DATABASE_URL="postgresql://user:password@host:port/database"
cargo run --bin execute_migrations_direct
```

## Méthode 3: Exécuter chaque migration individuellement

Vous pouvez aussi exécuter chaque fichier SQL individuellement avec psql:

```bash
cd backend
psql "postgresql://user:password@host:port/database" -f migrations/20250128_002_add_pharmacy_products.sql
psql "postgresql://user:password@host:port/database" -f migrations/20250127_create_pharmacy_advanced_tables.sql
# ... etc
```

## Migrations incluses

1. `20250128_002_add_pharmacy_products.sql` - Table pharmacy_products
2. `20250127_create_pharmacy_advanced_tables.sql` - Tables pharmacy avancées
3. `20250128_create_search_history_and_saved_searches.sql` - Tables search_history
4. `20250127_create_bourse_livre_advanced_tables.sql` - Tables bourse livre
5. `20250127_create_orientation_scolaire_advanced_tables.sql` - Tables orientation scolaire
6. `20250127_create_offres_emploi_advanced_tables.sql` - Tables offres emploi

## Notes

- Les erreurs "already exists" sont normales et peuvent être ignorées
- Les migrations sont idempotentes (peuvent être exécutées plusieurs fois)
- Tous les triggers utilisent maintenant `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`

