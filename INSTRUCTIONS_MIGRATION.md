# Instructions pour Appliquer la Migration

## Migration à appliquer
`backend/migrations/20260113_optimize_vector_matching_vectorial.sql`

Cette migration remplace l'itération séquentielle par un **test vectoriel unique** (équivalent à `%in%` en R).

## Méthode 1 : Script PowerShell (Recommandé)

1. **Définissez DATABASE_URL** :
```powershell
$env:DATABASE_URL = "postgresql://user:password@host:port/database"
```

2. **Exécutez le script** :
```powershell
.\apply_vector_migration.ps1
```

## Méthode 2 : Via psql directement

```powershell
# Définir le mot de passe
$env:PGPASSWORD = "votre_mot_de_passe"

# Appliquer la migration
psql -h localhost -p 5432 -U postgres -d yukpomnang -f backend\migrations\20260113_optimize_vector_matching_vectorial.sql

# Nettoyer
Remove-Item Env:\PGPASSWORD
```

## Méthode 3 : Via un client PostgreSQL

1. Ouvrez votre client PostgreSQL (pgAdmin, DBeaver, etc.)
2. Connectez-vous à votre base de données
3. Ouvrez le fichier `backend/migrations/20260113_optimize_vector_matching_vectorial.sql`
4. Exécutez le script SQL complet

## Vérification

Après l'application, vérifiez que la fonction a été mise à jour :

```sql
-- Vérifier que la fonction existe
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'calculate_vector_match_score_optimized'
);

-- Voir le commentaire de la fonction (devrait mentionner "test vectoriel unique")
SELECT obj_description(oid, 'pg_proc') 
FROM pg_proc 
WHERE proname = 'calculate_vector_match_score_optimized';
```

## Notes

- ✅ La migration est **idempotente** (peut être exécutée plusieurs fois)
- ✅ Utilise `CREATE OR REPLACE FUNCTION` pour éviter les erreurs
- ✅ Améliore les performances avec test vectoriel unique


