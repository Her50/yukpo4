# Instructions pour supprimer manuellement la table publicite_impressions

## Informations de connexion
- **Host**: 34.79.199.41
- **Port**: 5432
- **Database**: yukpo_db
- **User**: yukpo_user
- **Password**: TempPassword123!
- **SSL**: Requis

## Option 1 : Connexion avec psql (ligne de commande)

### Windows PowerShell
```powershell
# Installer psql si nécessaire (via PostgreSQL ou via Chocolatey)
# choco install postgresql

# Se connecter à la base
$env:PGPASSWORD = "TempPassword123!"
psql -h 34.79.199.41 -p 5432 -U yukpo_user -d yukpo_db -W --set=sslmode=require
```

### Commandes SQL à exécuter une fois connecté :

```sql
-- 1. Vérifier que la table existe et voir son schéma
\d publicite_impressions

-- 2. Vérifier les colonnes de la table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'publicite_impressions';

-- 3. Supprimer toutes les dépendances (fonctions, index, contraintes)
DROP FUNCTION IF EXISTS check_publicite_frequency(INTEGER, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS check_publicite_frequency(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_publicite_frequency CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression CASCADE;

-- 4. Supprimer tous les index
DROP INDEX IF EXISTS idx_publicite_impressions_publicite_user CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_user_date CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_publicite_date CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_placement CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_user_publicite_date CASCADE;

-- 5. Supprimer la table elle-même
DROP TABLE IF EXISTS publicite_impressions CASCADE;

-- 6. Vérifier que la table a bien été supprimée
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'publicite_impressions';
-- Devrait retourner 0 lignes

-- 7. Quitter psql
\q
```

## Option 2 : Connexion avec pgAdmin ou DBeaver

### pgAdmin
1. Ouvrir pgAdmin
2. Clic droit sur "Servers" → "Create" → "Server"
3. Onglet "General" :
   - Name: `Yukpo Production`
4. Onglet "Connection" :
   - Host: `34.79.199.41`
   - Port: `5432`
   - Database: `yukpo_db`
   - Username: `yukpo_user`
   - Password: `TempPassword123!`
   - SSL mode: `Require`
5. Cliquer "Save"
6. Une fois connecté, naviguer vers : `Databases` → `yukpo_db` → `Schemas` → `public` → `Tables`
7. Clic droit sur `publicite_impressions` → "Delete/Drop"
8. Cocher "Cascade" pour supprimer toutes les dépendances
9. Confirmer

### DBeaver
1. Ouvrir DBeaver
2. Nouvelle connexion → PostgreSQL
3. Paramètres :
   - Host: `34.79.199.41`
   - Port: `5432`
   - Database: `yukpo_db`
   - Username: `yukpo_user`
   - Password: `TempPassword123!`
   - SSL: Cocher "Use SSL"
4. Se connecter
5. Naviguer vers : `yukpo_db` → `Schemas` → `public` → `Tables` → `publicite_impressions`
6. Clic droit → "Delete"
7. Cocher "Cascade"
8. Confirmer

## Option 3 : Script SQL complet (à exécuter dans un outil SQL)

```sql
-- Script complet de suppression
BEGIN;

-- Supprimer toutes les fonctions liées
DROP FUNCTION IF EXISTS check_publicite_frequency(INTEGER, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS check_publicite_frequency(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_publicite_frequency CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression CASCADE;

-- Supprimer tous les index
DROP INDEX IF EXISTS idx_publicite_impressions_publicite_user CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_user_date CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_publicite_date CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_placement CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_user_publicite_date CASCADE;

-- Supprimer la table
DROP TABLE IF EXISTS publicite_impressions CASCADE;

-- Vérification
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'publicite_impressions'
        ) 
        THEN 'ERREUR: La table existe encore'
        ELSE 'SUCCESS: La table a été supprimée'
    END AS status;

COMMIT;
```

## Option 4 : Connexion directe avec URL de connexion

### PowerShell (avec psql)
```powershell
$env:PGPASSWORD = "TempPassword123!"
$connectionString = "postgresql://yukpo_user:TempPassword123!@34.79.199.41:5432/yukpo_db?sslmode=require"
psql $connectionString -c "DROP TABLE IF EXISTS publicite_impressions CASCADE;"
```

### Avec psql directement
```bash
PGPASSWORD="TempPassword123!" psql -h 34.79.199.41 -p 5432 -U yukpo_user -d yukpo_db --set=sslmode=require -c "DROP TABLE IF EXISTS publicite_impressions CASCADE;"
```

## Vérification après suppression

```sql
-- Vérifier que la table n'existe plus
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'publicite_impressions';
-- Devrait retourner 0 lignes

-- Vérifier que les fonctions n'existent plus
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('check_publicite_frequency', 'record_publicite_impression');
-- Devrait retourner 0 lignes
```

## Après la suppression

Une fois la table supprimée, vous pouvez relancer les migrations :

```powershell
cd C:\Users\23767\yukpomnang2\backend
$env:DATABASE_URL = "postgresql://yukpo_user:TempPassword123!@34.79.199.41:5432/yukpo_db?sslmode=require"
cargo sqlx migrate run
```

La migration 1027 recréera la table avec le bon schéma.

## ⚠️ ATTENTION

- **Sauvegardez vos données** si la table contient des données importantes
- La suppression avec CASCADE supprimera toutes les dépendances (fonctions, index, contraintes)
- Assurez-vous d'avoir les bonnes permissions sur la base de données

## Sauvegarde avant suppression (recommandé)

```sql
-- Créer une sauvegarde de la table si elle contient des données
CREATE TABLE publicite_impressions_backup AS 
SELECT * FROM publicite_impressions;

-- Vérifier le nombre de lignes sauvegardées
SELECT COUNT(*) FROM publicite_impressions_backup;
```


