# Analyse de la Vraie Cause des Erreurs de Migration

**Date**: 2026-01-31  
**Question**: Pourquoi les erreurs persistent même avec des migrations "isolées" ?

## Réponse à la Question

### ❌ Ce n'est PAS le problème de plusieurs tables par fichier

Même si vous avez créé des migrations "isolées" (une table par fichier), **le problème persiste** car :

**Chaque fichier de migration contient TOUJOURS plusieurs COMMANDES SQL**, pas seulement une table.

## Exemple Concret : `00000002_create_base_tables.sql`

Ce fichier contient **27+ commandes SQL** :

1. `CREATE TABLE users (...);` (lignes 4-26)
2. `ALTER TABLE users ALTER COLUMN gps_consent SET DEFAULT TRUE;` (ligne 27)
3. `CREATE TABLE user_documents (...);` (lignes 30-47)
4. `CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ...;` (ligne 50)
5. `CREATE INDEX IF NOT EXISTS idx_user_documents_status ...;` (ligne 51)
6. `CREATE INDEX IF NOT EXISTS idx_user_documents_type ...;` (ligne 52)
7. `CREATE INDEX IF NOT EXISTS idx_user_documents_user_status ...;` (ligne 53)
8. `CREATE OR REPLACE FUNCTION update_user_documents_updated_at() ...;` (lignes 56-62)
9. `DROP TRIGGER IF EXISTS trigger_update_user_documents_updated_at ...;` (ligne 65)
10. `CREATE TRIGGER trigger_update_user_documents_updated_at ...;` (lignes 66-69)
11. `COMMENT ON TABLE user_documents IS ...;` (ligne 72)
12. `COMMENT ON COLUMN user_documents.document_type IS ...;` (ligne 73)
13. `COMMENT ON COLUMN user_documents.status IS ...;` (ligne 74)
14. `COMMENT ON COLUMN user_documents.verified_by IS ...;` (ligne 75)
15. `COMMENT ON COLUMN user_documents.metadata IS ...;` (ligne 76)
16. `CREATE TABLE services (...);` (lignes 78-95)
17. `CREATE TABLE media (...);` (lignes 98+)
18. ... et ainsi de suite

## Le Vrai Problème

La fonction `execute_multiple_sql_commands` divise ces commandes sur `;` **sans tenir compte du contexte**.

### Exemple de Division Incorrecte

**Fichier SQL original** :
```sql
CREATE TABLE IF NOT EXISTS user_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Ce que fait `execute_multiple_sql_commands`** :
1. Lit ligne par ligne
2. Quand elle voit `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();` (si la ligne se termine par `;`)
3. Elle crée une commande séparée : `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
4. Cette commande est ensuite exécutée comme une commande SQL complète
5. **ERREUR** : `syntax error at or near "updated_at"`

### Pourquoi ça arrive ?

La fonction divise sur `;` même si :
- On est dans une parenthèse `CREATE TABLE (...)`
- On est dans une définition de colonne
- On est dans une fonction `CREATE FUNCTION ... $$ ... $$`

Le comptage des parenthèses (`paren_depth`) est censé empêcher ça, mais il ne fonctionne pas correctement pour tous les cas.

## Analyse des Erreurs du Log 17

Toutes les erreurs sont des **fragments de colonnes ou de fonctions** :

```
ERROR: syntax error at or near "updated_at" at character 1
STATEMENT: updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ERROR: syntax error at or near "reply_to_review_id" at character 1
STATEMENT: reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE,

ERROR: syntax error at or near "RETURNS" at character 59
STATEMENT: CREATE OR REPLACE FUNCTION deactivate_expired_products();
	RETURNS TABLE("

ERROR: syntax error at or near ";" at character 45
STATEMENT: CREATE FUNCTION get_product_reactions_count(;
```

Ces erreurs montrent que :
1. Des colonnes sont isolées (`updated_at`, `reply_to_review_id`)
2. Des fonctions sont coupées (`CREATE FUNCTION ... (;` puis `RETURNS`)
3. Des vues sont coupées (`CREATE VIEW ... AS;`)

## Conclusion

**Le problème n'est PAS** :
- ❌ Que les migrations contiennent plusieurs tables
- ❌ Que `0000_create_all_tables.sql` est encore utilisé (il ne l'est plus)

**Le problème EST** :
- ✅ Que chaque migration contient plusieurs **commandes SQL**
- ✅ Que `execute_multiple_sql_commands` divise incorrectement ces commandes
- ✅ Que les fragments créés sont exécutés comme des commandes complètes

## Solution

**Il faut corriger `execute_multiple_sql_commands`** pour :
1. Ne PAS diviser à l'intérieur de `CREATE TABLE (...)`
2. Ne PAS diviser à l'intérieur de `CREATE FUNCTION ... $$ ... $$`
3. Ne PAS diviser à l'intérieur de blocs `DO $$ ... END $$`
4. Valider AVANT d'exécuter que la commande commence par un mot-clé SQL valide

**Ce n'est PAS nécessaire de** :
- ❌ Diviser les migrations en fichiers encore plus petits (une commande par fichier)
- ❌ Supprimer les migrations avec plusieurs tables (ce n'est pas le problème)

## Migrations Problématiques Identifiées

D'après l'analyse, les migrations suivantes contiennent beaucoup de commandes SQL et causent probablement le plus d'erreurs :

1. **`00000002_create_base_tables.sql`** : 5 tables + index + fonctions + triggers
2. **`00000034_create_immobilier_tables.sql`** : 24 CREATE TABLE
3. **`00000008_create_delivery_tables.sql`** : 20 CREATE TABLE
4. **`00000033_create_missing_delivery_tables.sql`** : 9 CREATE TABLE
5. **`00000012_create_communication_tables.sql`** : 3 tables + fonctions + triggers

Mais même les migrations avec une seule table causent des erreurs car elles contiennent plusieurs commandes (CREATE TABLE + CREATE INDEX + CREATE FUNCTION + CREATE TRIGGER).

