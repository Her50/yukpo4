# Guide d'application manuelle de la migration delivery_partners

## Méthode 1: Via psql (recommandé)

Si vous avez `psql` installé :

```powershell
# Définir la variable d'environnement DATABASE_URL si nécessaire
$env:DATABASE_URL = "postgresql://user:password@host:port/database"

# Extraire les informations de connexion
$dbUrl = $env:DATABASE_URL
if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $user = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    # Exporter le mot de passe
    $env:PGPASSWORD = $password
    
    # Appliquer la migration
    psql -h $host -p $port -U $user -d $database -f migrations\20260104_apply_delivery_partners_migrations.sql
    
    # Nettoyer
    Remove-Item Env:\PGPASSWORD
}
```

## Méthode 2: Via sqlx migrate

Si vous avez `sqlx-cli` installé :

```powershell
cd backend
sqlx migrate run
```

## Méthode 3: Via un client PostgreSQL (pgAdmin, DBeaver, etc.)

1. Ouvrez votre client PostgreSQL
2. Connectez-vous à votre base de données
3. Ouvrez le fichier `backend/migrations/20260104_apply_delivery_partners_migrations.sql`
4. Exécutez le script SQL complet

## Méthode 4: Via le script PowerShell automatique

```powershell
cd backend
.\apply_delivery_partners_migration.ps1
```

## Vérification

Après l'application, vérifiez que la table existe :

```sql
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'delivery_partners'
);
```

Et vérifiez la structure :

```sql
\d delivery_partners
```

## Notes importantes

- La migration est idempotente (peut être exécutée plusieurs fois sans problème)
- Elle utilise `IF NOT EXISTS` et `DO $$ ... END $$` pour éviter les erreurs
- La table sera créée avec tous les index et contraintes nécessaires



