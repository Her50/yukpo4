# Solution Alternative - Installation uuid-ossp

**Date**: 2026-02-13  
**Problème**: AWS RDS Query Editor ne fonctionne pas avec PostgreSQL standard (seulement Aurora)

---

## 🎯 POURQUOI QUERY EDITOR NE FONCTIONNE PAS

L'éditeur de requêtes AWS RDS ne prend en charge que:
- ✅ **Aurora Serverless** (sans serveur)
- ❌ **PostgreSQL standard** (votre cas)
- ❌ **Aurora provisionné** (sans Data API)

**Votre configuration**: PostgreSQL 15.15 standard sur RDS → Query Editor non disponible

---

## ✅ SOLUTION - Via SSM depuis l'Instance EC2

Vous avez déjà une instance EC2 (`i-0b9ad404f8d738d04`) qui peut se connecter à RDS.

### Option 1: Via AWS Systems Manager Session Manager (RECOMMANDÉ)

1. **Ouvrir AWS Console** → **EC2** → **Instances**
2. **Sélectionner l'instance**: `i-0b9ad404f8d738d04`
3. **Cliquer sur "Connect"** (en haut)
4. **Onglet "Session Manager"**
5. **Cliquer sur "Connect"**

Une fois connecté dans le terminal, exécutez:

```bash
# Définir le mot de passe
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'

# Vérifier si l'extension existe déjà
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';"

# Si l'extension n'existe pas, l'installer
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"

# Vérifier l'installation
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';"
```

**Résultat attendu**:
```
 extname   | extversion
-----------+------------
 uuid-ossp | 1.1
```

---

### Option 2: Via Commande AWS CLI Directe

Si vous préférez utiliser AWS CLI directement:

```powershell
# Créer un fichier temporaire avec la commande SQL
$sqlCommand = "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"
$tempFile = [System.IO.Path]::GetTempFileName()
$sqlCommand | Out-File -FilePath $tempFile -Encoding UTF8

# Envoyer la commande via SSM
aws ssm send-command `
  --instance-ids i-0b9ad404f8d738d04 `
  --document-name "AWS-RunShellScript" `
  --parameters "commands=[\"export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'\", \"psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo -c 'CREATE EXTENSION IF NOT EXISTS uuid-ossp;'\"]" `
  --region eu-west-1

# Attendre 5 secondes
Start-Sleep -Seconds 5

# Récupérer le résultat (remplacer COMMAND_ID par l'ID retourné)
aws ssm get-command-invocation `
  --command-id COMMAND_ID `
  --instance-id i-0b9ad404f8d738d04 `
  --region eu-west-1
```

---

### Option 3: Via Script PowerShell Simplifié

Créer un fichier `install_uuid_ossp.ps1`:

```powershell
$instanceId = "i-0b9ad404f8d738d04"
$region = "eu-west-1"
$dbHost = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$dbUser = "yukpo_admin"
$dbName = "yukpo"
$dbPassword = "PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

# Créer les commandes
$commands = @(
    "export PGPASSWORD='$dbPassword'",
    "psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'CREATE EXTENSION IF NOT EXISTS uuid-ossp;'"
)

# Convertir en JSON
$params = @{ commands = $commands } | ConvertTo-Json -Compress

# Sauvegarder dans un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$params | Out-File -FilePath $tempFile -Encoding UTF8

# Envoyer la commande
$result = aws ssm send-command `
    --instance-ids $instanceId `
    --document-name "AWS-RunShellScript" `
    --parameters "file://$tempFile" `
    --region $region `
    --output json | ConvertFrom-Json

$commandId = $result.Command.CommandId
Write-Host "Commande envoyée: $commandId" -ForegroundColor Green

# Attendre
Start-Sleep -Seconds 5

# Récupérer le résultat
$invocation = aws ssm get-command-invocation `
    --command-id $commandId `
    --instance-id $instanceId `
    --region $region `
    --output json | ConvertFrom-Json

Write-Host "Résultat:" -ForegroundColor Yellow
Write-Host $invocation.StandardOutputContent -ForegroundColor White

if ($invocation.StandardErrorContent) {
    Write-Host "Erreurs:" -ForegroundColor Red
    Write-Host $invocation.StandardErrorContent -ForegroundColor Red
}

# Nettoyer
Remove-Item $tempFile -Force
```

---

## 🔍 VÉRIFICATION

Après l'installation, vérifier que l'extension est bien installée:

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';"
```

**Résultat attendu**:
```
 extname   | extversion
-----------+------------
 uuid-ossp | 1.1
```

Vérifier toutes les extensions:

```bash
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"
```

**Extensions attendues**:
- ✅ plpgsql (1.0)
- ✅ pg_trgm (1.6)
- ✅ pgcrypto (1.3)
- ✅ postgis (3.4.3)
- ✅ unaccent (1.1)
- ✅ vector (0.8.0)
- ✅ **uuid-ossp (1.1)** ← NOUVELLE

---

## 🚀 REDÉMARRAGE DU SERVICE ECS

Une fois l'extension installée:

```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --force-new-deployment \
  --region eu-west-1
```

Attendre 1-2 minutes, puis vérifier les logs.

---

## ⚠️ SI L'INSTALLATION ÉCHOUE

Si vous recevez une erreur de permissions:

```
ERROR: permission denied to create extension "uuid-ossp"
```

**Cause**: L'utilisateur `yukpo_admin` n'a pas les permissions pour créer des extensions.

**Solution**: Utiliser l'utilisateur master de RDS (si disponible) ou demander à AWS de modifier les permissions.

**Alternative**: Modifier les migrations pour utiliser `gen_random_uuid()` de `pgcrypto` au lieu de `uuid_generate_v4()` de `uuid-ossp`.

---

## ✅ CHECKLIST

- [ ] Se connecter à l'instance EC2 via Session Manager
- [ ] Installer l'extension `uuid-ossp`
- [ ] Vérifier que l'extension est installée
- [ ] Redémarrer le service ECS
- [ ] Vérifier les logs pour confirmer que les logs `[MAIN]` apparaissent
- [ ] Vérifier que l'application démarre correctement

---

**Méthode recommandée**: Option 1 (Session Manager) - Plus simple et directe

