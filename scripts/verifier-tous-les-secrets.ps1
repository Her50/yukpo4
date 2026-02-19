# Script de vérification complète de tous les secrets GCP
# Vérifie chaque secret pour détecter les placeholders ou valeurs invalides

param(
    [string]$GcpProjectId = "yukpo-project"
)

Write-Host "🔍 Vérification complète de tous les secrets GCP" -ForegroundColor Cyan
Write-Host ""

# Liste des secrets avec leurs critères de validation
$secrets = @(
    @{
        Name = "jwt-secret"
        MinLength = 32
        Description = "Secret JWT (doit être long et aléatoire)"
        ExpectedFormat = "Chaîne aléatoire longue"
    },
    @{
        Name = "database-url"
        MinLength = 20
        MustStartWith = "postgresql://"
        Description = "URL de connexion PostgreSQL"
        ExpectedFormat = "postgresql://user:pass@host:port/db"
    },
    @{
        Name = "redis-url"
        MinLength = 15
        MustStartWith = "redis://"
        Description = "URL de connexion Redis"
        ExpectedFormat = "redis://host:port/0"
    },
    @{
        Name = "mongodb-url"
        MinLength = 20
        MustStartWith = "mongodb://"
        Description = "URL de connexion MongoDB"
        ExpectedFormat = "mongodb://host:port/db"
    },
    @{
        Name = "s3-access-key"
        MinLength = 10
        Description = "Cle d'acces S3/Wasabi"
        ExpectedFormat = "Cle d'acces AWS/Wasabi"
    },
    @{
        Name = "s3-secret-key"
        MinLength = 20
        Description = "Cle secrete S3/Wasabi"
        ExpectedFormat = "Cle secrete AWS/Wasabi"
    },
    @{
        Name = "openai-api-key"
        MinLength = 50
        MustStartWith = "sk-"
        Description = "Cle API OpenAI"
        ExpectedFormat = 'sk-proj-... ou sk-... (minimum 50 caracteres)'
    },
    @{
        Name = "livekit-api-key"
        MinLength = 20
        Description = "Cle API LiveKit"
        ExpectedFormat = "Cle API LiveKit"
    },
    @{
        Name = "livekit-api-secret"
        MinLength = 20
        Description = "Secret API LiveKit"
        ExpectedFormat = "Secret API LiveKit"
    },
    @{
        Name = "auphonic-api-key"
        MinLength = 20
        Description = "Cle API Auphonic"
        ExpectedFormat = "Cle API Auphonic"
    },
    @{
        Name = "pixabay-api-key"
        MinLength = 20
        Description = "Cle API Pixabay"
        ExpectedFormat = "Cle API Pixabay"
    },
    @{
        Name = "pexels-api-key"
        MinLength = 20
        Description = "Cle API Pexels"
        ExpectedFormat = "Cle API Pexels"
    },
    @{
        Name = "unsplash-access-key"
        MinLength = 20
        Description = "Cle d'acces Unsplash"
        ExpectedFormat = "Cle d'acces Unsplash"
    },
    @{
        Name = "google-maps-api-key"
        MinLength = 30
        MustStartWith = "AIza"
        Description = "Cle API Google Maps"
        ExpectedFormat = "AIza... (cle Google Maps)"
    },
    @{
        Name = "youtube-client-secret"
        MinLength = 20
        Description = "Secret client YouTube"
        ExpectedFormat = "Secret client YouTube OAuth"
    },
    @{
        Name = "yukpo-api-key"
        MinLength = 10
        Description = "Cle API interne Yukpo"
        ExpectedFormat = "Cle API interne Yukpo"
    },
    @{
        Name = "embedding-api-key"
        MinLength = 10
        Description = "Cle API Embedding"
        ExpectedFormat = "Cle API Embedding"
    },
    @{
        Name = "video-renderer-rpc-token"
        MinLength = 20
        Description = "Token RPC Video Renderer"
        ExpectedFormat = "Token RPC pour worker vidéo"
    },
    @{
        Name = "google-translate-api-key"
        MinLength = 30
        MustStartWith = "AIza"
        Description = "Cle API Google Translate"
        ExpectedFormat = "AIza... (cle Google Translate)"
    }
)

$results = @()
$totalSecrets = $secrets.Count
$validSecrets = 0
$invalidSecrets = 0
$missingSecrets = 0

foreach ($secret in $secrets) {
    Write-Host "🔍 Vérification: $($secret.Name)..." -ForegroundColor Yellow
    
    # Vérifier si le secret existe
    $secretExists = gcloud secrets describe $secret.Name --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Secret '$($secret.Name)' n'existe pas" -ForegroundColor Red
        $results += @{
            Name = $secret.Name
            Status = "MISSING"
            Message = "Secret n'existe pas"
            Description = $secret.Description
        }
        $missingSecrets++
        Write-Host ""
        continue
    }
    
    # Récupérer la valeur du secret
    $secretValue = gcloud secrets versions access latest --secret=$secret.Name --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Impossible de récupérer le secret" -ForegroundColor Red
        $results += @{
            Name = $secret.Name
            Status = "ERROR"
            Message = "Impossible de récupérer"
            Description = $secret.Description
        }
        $invalidSecrets++
        Write-Host ""
        continue
    }
    
    $secretValue = $secretValue.Trim()
    $secretLength = $secretValue.Length
    
    # Vérifier les placeholders
    $isPlaceholder = $false
    $placeholderPatterns = @("PLACEHOLDER", "REMPLACER", "VRAIE", "placeholder", "remplacer", "vraie", "TODO", "CHANGER", "REMPLACEZ", "VOTRE", "YOUR", "EXAMPLE", "EXEMPLE")
    foreach ($pattern in $placeholderPatterns) {
        if ($secretValue -like "*$pattern*") {
            $isPlaceholder = $true
            break
        }
    }
    
    # Vérifier la longueur
    $isTooShort = $secretLength -lt $secret.MinLength
    
    # Vérifier le format (si spécifié)
    $hasWrongFormat = $false
    if ($secret.MustStartWith) {
        if (-not $secretValue.StartsWith($secret.MustStartWith)) {
            $hasWrongFormat = $true
        }
    }
    
    # Déterminer le statut
    $status = "VALID"
    $message = "✅ Secret valide"
    
    if ($isPlaceholder) {
        $status = "PLACEHOLDER"
        $message = "❌ Contient un placeholder (PLACEHOLDER/REMPLACER/etc.)"
        $invalidSecrets++
    } elseif ($isTooShort) {
        $status = "TOO_SHORT"
        $message = "❌ Trop court ($secretLength caractères < $($secret.MinLength) requis)"
        $invalidSecrets++
    } elseif ($hasWrongFormat) {
        $status = "WRONG_FORMAT"
        $message = "❌ Format incorrect (devrait commencer par '$($secret.MustStartWith)')"
        $invalidSecrets++
    } else {
        $validSecrets++
    }
    
    # Afficher le résultat
    if ($status -eq "VALID") {
        Write-Host "   ✅ Secret valide (longueur: $secretLength caractères)" -ForegroundColor Green
    } else {
        Write-Host "   $message" -ForegroundColor Red
        Write-Host "   Longueur: $secretLength caractères" -ForegroundColor Yellow
        Write-Host "   Format attendu: $($secret.ExpectedFormat)" -ForegroundColor Yellow
    }
    
    $results += @{
        Name = $secret.Name
        Status = $status
        Message = $message
        Length = $secretLength
        Description = $secret.Description
        ExpectedFormat = $secret.ExpectedFormat
    }
    
    Write-Host ""
}

# Résumé
Write-Host "📊 Résumé de la vérification:" -ForegroundColor Cyan
Write-Host "   Total secrets: $totalSecrets" -ForegroundColor White
Write-Host "   ✅ Secrets valides: $validSecrets" -ForegroundColor Green
Write-Host "   ❌ Secrets invalides: $invalidSecrets" -ForegroundColor Red
Write-Host "   ⚠️ Secrets manquants: $missingSecrets" -ForegroundColor Yellow
Write-Host ""

# Afficher les secrets invalides
if ($invalidSecrets -gt 0 -or $missingSecrets -gt 0) {
    Write-Host "🔴 Secrets nécessitant une action:" -ForegroundColor Red
    Write-Host ""
    
    foreach ($result in $results) {
        if ($result.Status -ne "VALID") {
            Write-Host "   ❌ $($result.Name)" -ForegroundColor Red
            Write-Host "      Description: $($result.Description)" -ForegroundColor Yellow
            Write-Host "      Problème: $($result.Message)" -ForegroundColor Yellow
            if ($result.Length) {
                Write-Host "      Longueur actuelle: $($result.Length) caractères" -ForegroundColor Yellow
            }
            Write-Host "      Format attendu: $($result.ExpectedFormat)" -ForegroundColor Yellow
            Write-Host ""
        }
    }
    
    Write-Host "💡 Actions recommandées:" -ForegroundColor Yellow
    Write-Host "   1. Mettre à jour chaque secret invalide avec une vraie valeur" -ForegroundColor Yellow
    Write-Host "   2. Utiliser: gcloud secrets versions add <secret-name> --data-file=- --project=$GcpProjectId" -ForegroundColor Yellow
    Write-Host "   3. Redéployer Cloud Run après mise à jour des secrets" -ForegroundColor Yellow
} else {
    Write-Host "✅ Tous les secrets sont valides!" -ForegroundColor Green
}

# Exporter les résultats en JSON
$results | ConvertTo-Json -Depth 3 | Out-File -FilePath "verification-secrets-resultats.json" -Encoding UTF8
Write-Host ""
Write-Host "📄 Résultats détaillés exportés dans: verification-secrets-resultats.json" -ForegroundColor Cyan

