# 🔍 Guide : Identifier l'Erreur 500 - Sauvegarde Configuration Livraison

## 🎯 Méthode Rapide : Filtrer les Erreurs 500 Récentes

### 1. Voir les Erreurs 500 des 30 Dernières Minutes

```powershell
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1 --filter-pattern "ERROR 500"
```

### 2. Filtrer Spécifiquement les Erreurs de Sauvegarde Configuration

```powershell
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1 --filter-pattern "save_product_delivery_config"
```

### 3. Voir UNIQUEMENT les Erreurs SQL de Sauvegarde

```powershell
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1 --filter-pattern "Erreur SQL lors de la sauvegarde"
```

## 🎯 Méthode Précise : Filtrer par Timestamp et Erreur

### 1. Voir TOUTES les Erreurs Récentes avec Contexte

```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | 
    Select-String -Pattern "save_product_delivery_config|ERROR|500|❌" -Context 5,5
```

### 2. Exporter les Erreurs dans un Fichier pour Analyse

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 > "erreur_500_$timestamp.txt"

# Puis ouvrir le fichier et chercher "save_product_delivery_config"
```

### 3. Filtrer les Erreurs avec PowerShell (Plus Précis)

```powershell
# Récupérer les logs et filtrer
$logs = aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1

# Filtrer les erreurs de sauvegarde
$logs | Select-String -Pattern "save_product_delivery_config" -Context 10,10 | 
    Out-File -FilePath "erreur_sauvegarde_config.txt" -Encoding UTF8

# Afficher dans la console
$logs | Select-String -Pattern "save_product_delivery_config.*❌|Erreur SQL.*sauvegarde" -Context 3,3
```

## 🎯 Méthode Avancée : Filtrer par Log Stream et Timestamp

### 1. Lister les Log Streams Récents

```powershell
aws logs describe-log-streams `
    --log-group-name /ecs/yukpomnang-backend `
    --order-by LastEventTime `
    --descending `
    --max-items 3 `
    --region us-east-1 `
    --output table
```

### 2. Voir les Logs d'un Stream Spécifique avec Filtre

```powershell
# Remplacer STREAM_NAME par le nom du stream le plus récent
$streamName = "ecs/yukpomnang-backend/STREAM_NAME"

aws logs filter-log-events `
    --log-group-name /ecs/yukpomnang-backend `
    --log-stream-names $streamName `
    --filter-pattern "save_product_delivery_config" `
    --region us-east-1 `
    --start-time $((Get-Date).AddMinutes(-30).ToUniversalTime() | Get-Date -UFormat %s)000
```

## 🎯 Commandes Spécifiques pour Erreur 500

### 1. Voir les Erreurs 500 avec Stack Trace

```powershell
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1 | 
    Select-String -Pattern "500|Internal Server Error|save_product_delivery_config.*❌" -Context 10,10
```

### 2. Filtrer par Type d'Erreur Spécifique

**Erreur SQL :**
```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "Erreur SQL lors de la sauvegarde"
```

**Erreur de Validation :**
```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "BadRequest.*sauvegarde"
```

**Erreur de Service Non Trouvé :**
```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "Service non trouvé"
```

**Erreur de Produit Non Trouvé :**
```powershell
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "Produit.*non trouvé"
```

## 🎯 Via AWS Console (Méthode Visuelle)

### 1. Accéder aux Logs dans AWS Console

1. Allez sur [AWS Console](https://console.aws.amazon.com) → **CloudWatch** → **Logs** → **Log groups**
2. Cliquez sur `/ecs/yukpomnang-backend`
3. Cliquez sur le **log stream** le plus récent

### 2. Filtrer dans la Console

Dans la barre de recherche des logs, utilisez ces filtres :

**Pour voir l'erreur 500 :**
```
save_product_delivery_config ERROR
```

**Pour voir l'erreur SQL :**
```
Erreur SQL lors de la sauvegarde
```

**Pour voir toutes les erreurs de cette fonction :**
```
[save_product_delivery_config]
```

### 3. Voir le Contexte Complet

1. Cliquez sur une ligne de log avec l'erreur
2. Regardez les lignes **avant** et **après** pour voir le contexte complet
3. Notez le **timestamp** exact de l'erreur

## 🎯 Script PowerShell Complet pour Identifier l'Erreur

Créez un fichier `find-error-500.ps1` :

```powershell
param(
    [int]$Minutes = 30,
    [string]$Region = "us-east-1"
)

Write-Host "🔍 Recherche d'erreur 500 - Sauvegarde Configuration Livraison" -ForegroundColor Cyan
Write-Host "Période: Dernières $Minutes minutes" -ForegroundColor Yellow
Write-Host ""

# Récupérer les logs
Write-Host "📥 Récupération des logs..." -ForegroundColor Yellow
$logs = aws logs tail /ecs/yukpomnang-backend --since "${Minutes}m" --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la récupération des logs" -ForegroundColor Red
    exit 1
}

# Filtrer les erreurs de sauvegarde
Write-Host "🔍 Filtrage des erreurs..." -ForegroundColor Yellow
$errors = $logs | Select-String -Pattern "save_product_delivery_config.*❌|Erreur SQL.*sauvegarde|ERROR.*500.*product-config" -Context 5,10

if ($errors) {
    Write-Host "`n❌ ERREURS TROUVÉES :" -ForegroundColor Red
    Write-Host "=" * 80 -ForegroundColor Red
    $errors | ForEach-Object {
        Write-Host $_.Line -ForegroundColor Red
        if ($_.Context.PreContext) {
            Write-Host "  [CONTEXTE AVANT]" -ForegroundColor Gray
            $_.Context.PreContext | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        }
        if ($_.Context.PostContext) {
            Write-Host "  [CONTEXTE APRÈS]" -ForegroundColor Gray
            $_.Context.PostContext | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        }
        Write-Host ""
    }
    
    # Exporter dans un fichier
    $filename = "erreur_500_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
    $errors | Out-File -FilePath $filename -Encoding UTF8
    Write-Host "✅ Erreurs exportées dans: $filename" -ForegroundColor Green
} else {
    Write-Host "✅ Aucune erreur trouvée dans les $Minutes dernières minutes" -ForegroundColor Green
    Write-Host "💡 Essayez d'augmenter -Minutes (ex: -Minutes 60)" -ForegroundColor Yellow
}
```

**Utilisation :**
```powershell
.\find-error-500.ps1 -Minutes 30
```

## 🎯 Informations à Noter pour le Debug

Quand vous trouvez l'erreur, notez :

1. **Timestamp exact** de l'erreur
2. **Message d'erreur complet** (avec stack trace si disponible)
3. **service_id** et **product_index** mentionnés dans l'erreur
4. **Type d'erreur** :
   - Erreur SQL (contrainte FK, NOT NULL, etc.)
   - Erreur de validation
   - Erreur de service/produit non trouvé
   - Erreur de connexion DB/Redis
5. **Code d'erreur PostgreSQL** (si erreur SQL, ex: 23503, 23502)

## 🎯 Commandes Rapides (Copier-Coller)

```powershell
# Erreur 500 récente (30 min)
aws logs tail /ecs/yukpomnang-backend --since 30m --region us-east-1 --filter-pattern "save_product_delivery_config.*❌"

# Toutes les erreurs de sauvegarde (1h)
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 | Select-String -Pattern "save_product_delivery_config" -Context 5,5

# Erreur SQL spécifique
aws logs tail /ecs/yukpomnang-backend --since 1h --region us-east-1 --filter-pattern "Erreur SQL lors de la sauvegarde"
```

## 📝 Exemple de Log d'Erreur Attendu

Quand vous trouvez l'erreur, vous devriez voir quelque chose comme :

```
[save_product_delivery_config] ❌ Erreur SQL lors de la sauvegarde: <détails erreur> | service_id: 123 | product_index: 0
```

ou

```
ERROR [save_product_delivery_config] Erreur lors de la recherche du slug 'xxx': <détails>
```

ou

```
ERROR 500 Internal Server Error: <message d'erreur>
```

