# Script PowerShell pour verifier que tous les services externes sont bien lies a AWS
# Usage: .\verify_external_services_aws.ps1

param(
    [string]$Region = "us-east-1",
    [string]$ParameterPrefix = "/yukpomnang/production"
)

Write-Host "Verification des Services Externes - AWS" -ForegroundColor Green
Write-Host ""

# Verifier que AWS CLI est installe
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "AWS CLI n'est pas installe" -ForegroundColor Red
    exit 1
}

# Verifier les credentials AWS (mode non-bloquant)
$awsCredentialsOk = $false
try {
    $null = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -eq 0) {
        $awsCredentialsOk = $true
        Write-Host "✅ AWS credentials configurées" -ForegroundColor Green
    } else {
        Write-Host "⚠️ AWS credentials non configurées - Mode lecture seule" -ForegroundColor Yellow
        Write-Host "   Certaines vérifications nécessitent des credentials AWS" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ AWS credentials non configurées - Mode lecture seule" -ForegroundColor Yellow
    Write-Host "   Certaines vérifications nécessitent des credentials AWS" -ForegroundColor Yellow
}
Write-Host ""

# Fonction pour recuperer une valeur de parametre SSM
function Get-SSMParameter {
    param(
        [string]$Name
    )
    
    $fullName = "$ParameterPrefix/$Name"
    
    try {
        $value = aws ssm get-parameter `
            --name $fullName `
            --region $Region `
            --with-decryption `
            --query 'Parameter.Value' `
            --output text 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            return $value
        } else {
            return $null
        }
    } catch {
        return $null
    }
}

# Fonction pour verifier si une URL pointe vers Render
function Test-RenderUrl {
    param([string]$Url)
    
    if ([string]::IsNullOrEmpty($Url)) {
        return $false
    }
    
    # Détecter les URLs Render explicites
    if ($Url -match "render\.com|onrender\.com|dpg-.*\.render\.com") {
        return $true
    }
    
    # Détecter les IPs connues de Render (à adapter selon vos besoins)
    # Note: 46.224.14.85 pourrait être un serveur externe, pas forcément Render
    # On ne marque que les URLs explicites comme Render
    
    return $false
}

# Fonction pour verifier si une URL pointe vers AWS
function Test-AwsUrl {
    param([string]$Url)
    
    if ([string]::IsNullOrEmpty($Url)) {
        return $false
    }
    
    return $Url -match "\.amazonaws\.com|\.elb\.amazonaws\.com|\.rds\.amazonaws\.com|\.s3\.amazonaws\.com|cloudfront\.net|\.s3\.[a-z0-9-]+\.amazonaws\.com"
}

# Fonction pour verifier si une URL pointe vers un serveur externe (ni Render ni AWS)
function Test-ExternalUrl {
    param([string]$Url)
    
    if ([string]::IsNullOrEmpty($Url)) {
        return $false
    }
    
    # URLs avec IP directe (pourrait être externe)
    if ($Url -match "^\w+://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}") {
        return $true
    }
    
    # URLs avec domaines personnalisés (cdn.yukpomnang.com, etc.)
    if ($Url -match "cdn\.yukpomnang\.com|yukpomnang\.com") {
        return $true
    }
    
    return $false
}

# Fonction pour masquer les valeurs sensibles
function Hide-SensitiveValue {
    param([string]$Value)
    
    if ([string]::IsNullOrEmpty($Value)) {
        return "(vide)"
    }
    
    # Masquer les URLs avec credentials
    if ($Value -match "postgresql://") {
        return $Value -replace "postgresql://[^:]+:[^@]+@", "postgresql://***:***@"
    }
    
    if ($Value -match "redis://|rediss://") {
        return $Value -replace "(redis|rediss)://[^@]+@", '${1}://***:***@'
    }
    
    if ($Value.Length -gt 50) {
        return $Value.Substring(0, 47) + "..."
    }
    
    return $Value
}

Write-Host "Recherche des parametres SSM..." -ForegroundColor Yellow
Write-Host ""

# Recuperer tous les parametres
try {
    $allParamsJson = aws ssm describe-parameters `
        --region $Region `
        --parameter-filters "Key=Name,Values=$ParameterPrefix/" `
        --query "Parameters[*].Name" `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrEmpty($allParamsJson)) {
        $allParams = $allParamsJson | ConvertFrom-Json
        if ($null -ne $allParams -and $allParams.Count -gt 0) {
            Write-Host "Parametres trouves: $($allParams.Count)" -ForegroundColor Cyan
            Write-Host ""
        } else {
            Write-Host "Aucun parametre trouve avec le prefixe $ParameterPrefix/" -ForegroundColor Yellow
            Write-Host "Les variables n'ont peut-etre pas encore ete creees." -ForegroundColor Yellow
            Write-Host "Executez d'abord: .\scripts\update_all_env_variables_aws.ps1 -DbPassword 'MOT_DE_PASSE'" -ForegroundColor Cyan
            Write-Host ""
        }
    } else {
        Write-Host "Aucun parametre trouve avec le prefixe $ParameterPrefix/" -ForegroundColor Yellow
        Write-Host "Les variables n'ont peut-etre pas encore ete creees." -ForegroundColor Yellow
        Write-Host "Executez d'abord: .\scripts\update_all_env_variables_aws.ps1 -DbPassword 'MOT_DE_PASSE'" -ForegroundColor Cyan
        Write-Host ""
    }
} catch {
    Write-Host "Erreur lors de la recherche des parametres: $_" -ForegroundColor Red
    Write-Host ""
}

# Variables critiques a verifier (selon SERVICES_EXTERNES_A_METTRE_A_JOUR.md)
$criticalVars = @(
    "DATABASE_URL",
    "YOUTUBE_REDIRECT_URI",
    "PUBLIC_BASE_URL",
    "UPLOAD_BASE_URL",
    "LIVEKIT_API_URL",
    "LIVEKIT_WS_URL",
    "LIVEKIT_HLS_URL",
    "VIDEO_RENDERER_RPC_URL",
    "SRS_HLS_URL",
    "SRS_RTMP_URL"
)

# Variables OAuth a verifier
$oauthVars = @(
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "YOUTUBE_CLIENT_ID",
    "YOUTUBE_CLIENT_SECRET"
)

# Variables GPU a verifier
$gpuVars = @(
    "GPU_AVAILABLE",
    "VIDEO_RENDERER_ENABLE_GPU",
    "GPU_TYPE",
    "CUDA_VISIBLE_DEVICES",
    "NVIDIA_VISIBLE_DEVICES"
)

$issues = @()
$warnings = @()
$success = @()

Write-Host "=== VERIFICATION DES VARIABLES CRITIQUES ===" -ForegroundColor Magenta
Write-Host ""

foreach ($varName in $criticalVars) {
    $value = Get-SSMParameter -Name $varName
    
    if ($null -eq $value) {
        $issues += "❌ $varName : MANQUANT"
        Write-Host "❌ $varName : MANQUANT" -ForegroundColor Red
        continue
    }
    
    $displayValue = Hide-SensitiveValue -Value $value
    
    # Vérification spécifique pour DATABASE_URL
    if ($varName -eq "DATABASE_URL") {
        if ($value -match "dpg-.*\.render\.com|frankfurt-postgres\.render\.com") {
            $issues += "❌ $varName : Pointe vers Render PostgreSQL (doit pointer vers AWS RDS)"
            Write-Host "❌ $varName : Pointe vers Render PostgreSQL" -ForegroundColor Red
            Write-Host "   Valeur actuelle: $displayValue" -ForegroundColor Gray
        } elseif ($value -match "\.rds\.amazonaws\.com") {
            $success += "✅ $varName : Pointe vers AWS RDS"
            Write-Host "✅ $varName : Pointe vers AWS RDS" -ForegroundColor Green
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        } else {
            $warnings += "⚠️ $varName : URL non reconnue (ni Render ni AWS RDS)"
            Write-Host "⚠️ $varName : URL non reconnue" -ForegroundColor Yellow
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        }
        continue
    }
    
    # Vérification spécifique pour YOUTUBE_REDIRECT_URI
    if ($varName -eq "YOUTUBE_REDIRECT_URI") {
        if (Test-RenderUrl -Url $value) {
            $issues += "❌ $varName : Pointe vers RENDER (doit pointer vers AWS ALB)"
            Write-Host "❌ $varName : Pointe vers RENDER" -ForegroundColor Red
            Write-Host "   Valeur actuelle: $displayValue" -ForegroundColor Gray
        } elseif (Test-AwsUrl -Url $value) {
            $success += "✅ $varName : Pointe vers AWS"
            Write-Host "✅ $varName : Pointe vers AWS" -ForegroundColor Green
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        } else {
            $warnings += "⚠️ $varName : URL non reconnue (doit utiliser AWS ALB)"
            Write-Host "⚠️ $varName : URL non reconnue" -ForegroundColor Yellow
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        }
        continue
    }
    
    # Vérification spécifique pour PUBLIC_BASE_URL et UPLOAD_BASE_URL
    if ($varName -eq "PUBLIC_BASE_URL" -or $varName -eq "UPLOAD_BASE_URL") {
        if (Test-RenderUrl -Url $value) {
            $issues += "❌ $varName : Pointe vers RENDER (doit pointer vers AWS S3/CloudFront)"
            Write-Host "❌ $varName : Pointe vers RENDER" -ForegroundColor Red
            Write-Host "   Valeur actuelle: $displayValue" -ForegroundColor Gray
        } elseif (Test-AwsUrl -Url $value) {
            $success += "✅ $varName : Pointe vers AWS (S3/CloudFront)"
            Write-Host "✅ $varName : Pointe vers AWS (S3/CloudFront)" -ForegroundColor Green
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        } elseif (Test-ExternalUrl -Url $value) {
            # CDN personnalisé (cdn.yukpomnang.com) - vérifier qu'il pointe vers AWS
            $warnings += "⚠️ $varName : Utilise un CDN personnalisé (vérifier qu'il pointe vers AWS)"
            Write-Host "⚠️ $varName : Utilise un CDN personnalisé" -ForegroundColor Yellow
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
            Write-Host "   → Vérifier dans CloudFront/S3 que le CDN pointe vers AWS" -ForegroundColor Cyan
        } else {
            $warnings += "⚠️ $varName : URL non reconnue"
            Write-Host "⚠️ $varName : URL non reconnue" -ForegroundColor Yellow
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        }
        continue
    }
    
    # Vérification pour LiveKit, Video Renderer, SRS (services externes)
    if ($varName -match "LIVEKIT_|VIDEO_RENDERER_|SRS_") {
        if (Test-RenderUrl -Url $value) {
            $issues += "❌ $varName : Pointe vers RENDER (doit pointer vers serveur externe ou AWS)"
            Write-Host "❌ $varName : Pointe vers RENDER" -ForegroundColor Red
            Write-Host "   Valeur actuelle: $displayValue" -ForegroundColor Gray
        } elseif (Test-AwsUrl -Url $value) {
            $success += "✅ $varName : Pointe vers AWS"
            Write-Host "✅ $varName : Pointe vers AWS" -ForegroundColor Green
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        } elseif (Test-ExternalUrl -Url $value) {
            # Service externe (IP directe ou domaine personnalisé)
            $warnings += "⚠️ $varName : Service externe (vérifier qu'il n'est pas sur Render)"
            Write-Host "⚠️ $varName : Service externe" -ForegroundColor Yellow
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
            Write-Host "   → Si c'est un serveur externe, c'est OK. Sinon, migrer vers AWS." -ForegroundColor Cyan
        } else {
            $warnings += "⚠️ $varName : URL non reconnue"
            Write-Host "⚠️ $varName : URL non reconnue" -ForegroundColor Yellow
            Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
        }
        continue
    }
    
    # Vérification générique
    if (Test-RenderUrl -Url $value) {
        $issues += "❌ $varName : Pointe vers RENDER (doit pointer vers AWS)"
        Write-Host "❌ $varName : Pointe vers RENDER" -ForegroundColor Red
        Write-Host "   Valeur actuelle: $displayValue" -ForegroundColor Gray
    } elseif (Test-AwsUrl -Url $value) {
        $success += "✅ $varName : Pointe vers AWS"
        Write-Host "✅ $varName : Pointe vers AWS" -ForegroundColor Green
        Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
    } else {
        $warnings += "⚠️ $varName : URL non verifiee"
        Write-Host "⚠️ $varName : URL non verifiee" -ForegroundColor Yellow
        Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== VERIFICATION DES VARIABLES OAuth ===" -ForegroundColor Magenta
Write-Host ""

foreach ($varName in $oauthVars) {
    $value = Get-SSMParameter -Name $varName
    
    if ($null -eq $value) {
        $warnings += "⚠️ $varName : MANQUANT (peut etre dans Google Cloud Console seulement)"
        Write-Host "⚠️ $varName : MANQUANT (peut etre dans Google Cloud Console seulement)" -ForegroundColor Yellow
    } else {
        $displayValue = Hide-SensitiveValue -Value $value
        $success += "✅ $varName : Present"
        Write-Host "✅ $varName : Present" -ForegroundColor Green
        Write-Host "   Valeur: $displayValue" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== VERIFICATION DES VARIABLES GPU ===" -ForegroundColor Magenta
Write-Host ""

foreach ($varName in $gpuVars) {
    $value = Get-SSMParameter -Name $varName
    
    if ($null -eq $value) {
        $warnings += "⚠️ $varName : MANQUANT"
        Write-Host "⚠️ $varName : MANQUANT" -ForegroundColor Yellow
    } else {
        $success += "✅ $varName : Present = $value"
        Write-Host "✅ $varName : Present = $value" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== VERIFICATION DE L'URL AWS ALB ===" -ForegroundColor Magenta
Write-Host ""

$albDns = $null

# Trouver l'URL ALB (nécessite credentials AWS)
if ($awsCredentialsOk) {
    try {
        $albDns = aws elbv2 describe-load-balancers `
            --region $Region `
            --query "LoadBalancers[?contains(LoadBalancerName, 'yukpomnang')].DNSName" `
            --output text 2>&1
    
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrEmpty($albDns)) {
        $success += "✅ ALB DNS trouve: $albDns"
        Write-Host "✅ ALB DNS trouve: $albDns" -ForegroundColor Green
        Write-Host ""
        
        # Verifier si YOUTUBE_REDIRECT_URI utilise cette URL
        $youtubeRedirect = Get-SSMParameter -Name "YOUTUBE_REDIRECT_URI"
        if ($null -ne $youtubeRedirect) {
            if ($youtubeRedirect -match [regex]::Escape($albDns)) {
                $success += "✅ YOUTUBE_REDIRECT_URI utilise l'URL ALB AWS"
                Write-Host "✅ YOUTUBE_REDIRECT_URI utilise l'URL ALB AWS" -ForegroundColor Green
            } elseif ($youtubeRedirect -match "render\.com|onrender\.com") {
                $issues += "❌ YOUTUBE_REDIRECT_URI pointe vers Render (doit utiliser ALB AWS)"
                Write-Host "❌ YOUTUBE_REDIRECT_URI pointe vers Render" -ForegroundColor Red
                Write-Host "   Valeur actuelle: $youtubeRedirect" -ForegroundColor Gray
                Write-Host "   Valeur attendue: https://$albDns/api/social/youtube/callback" -ForegroundColor Cyan
                Write-Host "   → Mettre à jour dans Google Cloud Console ET AWS SSM" -ForegroundColor Yellow
            } else {
                $warnings += "⚠️ YOUTUBE_REDIRECT_URI n'utilise pas l'URL ALB AWS"
                Write-Host "⚠️ YOUTUBE_REDIRECT_URI n'utilise pas l'URL ALB AWS" -ForegroundColor Yellow
                Write-Host "   Valeur actuelle: $youtubeRedirect" -ForegroundColor Gray
                Write-Host "   Valeur attendue: https://$albDns/api/social/youtube/callback" -ForegroundColor Cyan
            }
        }
        
        # Vérifier les autres callbacks OAuth
        Write-Host ""
        Write-Host "   Callbacks OAuth attendus:" -ForegroundColor Cyan
        Write-Host "   - Google: https://$albDns/api/auth/google/callback" -ForegroundColor Cyan
        Write-Host "   - YouTube: https://$albDns/api/social/youtube/callback" -ForegroundColor Cyan
        Write-Host "   → Vérifier dans Google Cloud Console que ces URLs sont autorisées" -ForegroundColor Yellow
    } else {
        $warnings += "⚠️ ALB DNS non trouve"
        Write-Host "⚠️ ALB DNS non trouve" -ForegroundColor Yellow
    }
    } catch {
        $warnings += "⚠️ Erreur lors de la recherche de l'ALB: $_"
        Write-Host "⚠️ Erreur lors de la recherche de l'ALB" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Credentials AWS requises pour vérifier l'ALB" -ForegroundColor Yellow
    Write-Host "   Utilisez: aws configure" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== VERIFICATION DE LA BASE DE DONNEES RDS ===" -ForegroundColor Magenta
Write-Host ""

# Trouver l'endpoint RDS (nécessite credentials AWS)
if ($awsCredentialsOk) {
    try {
        $rdsInfo = aws rds describe-db-instances `
            --region $Region `
            --query "DBInstances[?Engine=='postgres'].[DBInstanceIdentifier,Endpoint.Address]" `
            --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -eq 0 -and $null -ne $rdsInfo -and $rdsInfo.Count -gt 0) {
        $rdsEndpoint = $rdsInfo[0][1]
        $success += "✅ RDS Endpoint trouve: $rdsEndpoint"
        Write-Host "✅ RDS Endpoint trouve: $rdsEndpoint" -ForegroundColor Green
        Write-Host ""
        
        # Verifier si DATABASE_URL utilise cet endpoint
        $dbUrl = Get-SSMParameter -Name "DATABASE_URL"
        if ($null -ne $dbUrl) {
            if ($dbUrl -match [regex]::Escape($rdsEndpoint)) {
                $success += "✅ DATABASE_URL utilise l'endpoint RDS AWS"
                Write-Host "✅ DATABASE_URL utilise l'endpoint RDS AWS" -ForegroundColor Green
            } elseif ($dbUrl -match "dpg-.*\.render\.com|frankfurt-postgres\.render\.com") {
                $issues += "❌ DATABASE_URL ne pointe pas vers AWS RDS (pointe vers Render)"
                Write-Host "❌ DATABASE_URL ne pointe pas vers AWS RDS" -ForegroundColor Red
                Write-Host "   Valeur actuelle: $(Hide-SensitiveValue -Value $dbUrl)" -ForegroundColor Gray
                Write-Host "   Endpoint RDS attendu: $rdsEndpoint" -ForegroundColor Cyan
            } else {
                $warnings += "⚠️ DATABASE_URL URL non reconnue"
                Write-Host "⚠️ DATABASE_URL URL non reconnue" -ForegroundColor Yellow
                Write-Host "   Valeur: $(Hide-SensitiveValue -Value $dbUrl)" -ForegroundColor Gray
            }
        }
    } else {
        $warnings += "⚠️ RDS Endpoint non trouve"
        Write-Host "⚠️ RDS Endpoint non trouve" -ForegroundColor Yellow
    }
    } catch {
        $warnings += "⚠️ Erreur lors de la recherche RDS: $_"
        Write-Host "⚠️ Erreur lors de la recherche RDS" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Credentials AWS requises pour vérifier RDS" -ForegroundColor Yellow
    Write-Host "   Utilisez: aws configure" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== VERIFICATION DES SERVICES EXTERNES (LiveKit, Video Renderer, SRS) ===" -ForegroundColor Magenta
Write-Host ""

# Vérifier que les services externes ne pointent pas vers Render
$externalServices = @(
    @{Name="LIVEKIT_API_URL"; Expected="Serveur externe ou AWS"},
    @{Name="LIVEKIT_WS_URL"; Expected="Serveur externe ou AWS"},
    @{Name="LIVEKIT_HLS_URL"; Expected="Serveur externe ou AWS"},
    @{Name="VIDEO_RENDERER_RPC_URL"; Expected="Serveur externe ou AWS"},
    @{Name="SRS_HLS_URL"; Expected="Serveur externe ou AWS"},
    @{Name="SRS_RTMP_URL"; Expected="Serveur externe ou AWS"}
)

foreach ($service in $externalServices) {
    $value = Get-SSMParameter -Name $service.Name
    if ($null -ne $value) {
        if (Test-RenderUrl -Url $value) {
            $issues += "❌ $($service.Name) : Pointe vers RENDER (doit être serveur externe ou AWS)"
            Write-Host "❌ $($service.Name) : Pointe vers RENDER" -ForegroundColor Red
            Write-Host "   Valeur: $(Hide-SensitiveValue -Value $value)" -ForegroundColor Gray
        } else {
            Write-Host "✅ $($service.Name) : Configuré" -ForegroundColor Green
            Write-Host "   Valeur: $(Hide-SensitiveValue -Value $value)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "=== VERIFICATION DES WEBHOOKS ET SERVICES DE PAIEMENT ===" -ForegroundColor Magenta
Write-Host ""

# Vérifier les webhooks
$webhookVars = @("PIPELINE_ALERT_WEBHOOK", "SLA_ALERT_WEBHOOK")
foreach ($varName in $webhookVars) {
    $value = Get-SSMParameter -Name $varName
    if ($null -eq $value) {
        $warnings += "⚠️ $varName : MANQUANT (peut être configuré ailleurs)"
    } else {
        Write-Host "✅ $varName : Présent" -ForegroundColor Green
        Write-Host "   → Vérifier que les notifications pointent vers le backend AWS" -ForegroundColor Cyan
    }
}

# Vérifier les variables de paiement
$paymentVars = @("MTN_MONEY_", "ORANGE_MONEY_")
Write-Host "   → Vérifier dans les dashboards MTN/Orange que les callbacks pointent vers AWS ALB" -ForegroundColor Cyan
Write-Host "   → Callbacks attendus:" -ForegroundColor Cyan
if ($null -ne $albDns) {
    Write-Host "      - MTN: https://$albDns/api/payments/mtn/callback" -ForegroundColor Cyan
    Write-Host "      - Orange: https://$albDns/api/payments/orange/callback" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== VERIFICATION CLOUDFRONT / S3 ===" -ForegroundColor Magenta
Write-Host ""

# Vérifier CloudFront (nécessite credentials AWS)
if ($awsCredentialsOk) {
    try {
        $cloudfrontDists = aws cloudfront list-distributions `
            --region $Region `
            --query "DistributionList.Items[*].[Id,DomainName]" `
            --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -eq 0 -and $null -ne $cloudfrontDists -and $cloudfrontDists.Count -gt 0) {
        Write-Host "✅ Distributions CloudFront trouvées: $($cloudfrontDists.Count)" -ForegroundColor Green
        foreach ($dist in $cloudfrontDists) {
            Write-Host "   - $($dist[0]): $($dist[1])" -ForegroundColor Cyan
        }
        Write-Host "   → Vérifier que PUBLIC_BASE_URL et UPLOAD_BASE_URL utilisent CloudFront" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️ Aucune distribution CloudFront trouvée" -ForegroundColor Yellow
    }
    } catch {
        Write-Host "⚠️ Erreur lors de la recherche CloudFront" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Credentials AWS requises pour vérifier CloudFront" -ForegroundColor Yellow
}

# Vérifier S3 (nécessite credentials AWS)
if ($awsCredentialsOk) {
    try {
        $s3Buckets = aws s3api list-buckets `
            --region $Region `
            --query "Buckets[?contains(Name, 'yukpomnang')].Name" `
            --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -eq 0 -and $null -ne $s3Buckets -and $s3Buckets.Count -gt 0) {
        Write-Host "✅ Buckets S3 trouvés: $($s3Buckets.Count)" -ForegroundColor Green
        foreach ($bucket in $s3Buckets) {
            Write-Host "   - $bucket" -ForegroundColor Cyan
        }
    } else {
        Write-Host "⚠️ Aucun bucket S3 yukpomnang trouvé" -ForegroundColor Yellow
    }
    } catch {
        Write-Host "⚠️ Erreur lors de la recherche S3" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Credentials AWS requises pour vérifier S3" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== RESUMÉ ===" -ForegroundColor Magenta
Write-Host ""

Write-Host "✅ Succès: $($success.Count)" -ForegroundColor Green
Write-Host "⚠️ Avertissements: $($warnings.Count)" -ForegroundColor Yellow
Write-Host "❌ Problèmes: $($issues.Count)" -ForegroundColor Red
Write-Host ""

if ($issues.Count -gt 0) {
    Write-Host "PROBLÈMES À CORRIGER:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  $issue" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "AVERTISSEMENTS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Generer un rapport détaillé
$report = @"
# Rapport de Verification des Services Externes AWS
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Region: $Region

## Resume
- ✅ Succès: $($success.Count)
- ⚠️ Avertissements: $($warnings.Count)
- ❌ Problèmes: $($issues.Count)

## ❌ Problèmes à Corriger (CRITIQUE)

$($issues -join "`n")

## ⚠️ Avertissements

$($warnings -join "`n")

## ✅ Succès

$($success -join "`n")

## 📋 Actions Requises

### Services OAuth (CRITIQUE)
1. **Google Cloud Console** : Mettre à jour les redirect URIs
   - Google OAuth: https://VOTRE_ALB_DNS/api/auth/google/callback
   - YouTube OAuth: https://VOTRE_ALB_DNS/api/social/youtube/callback
   - Lien: https://console.cloud.google.com/apis/credentials

2. **AWS SSM Parameter Store** : Vérifier YOUTUBE_REDIRECT_URI
   - Doit pointer vers: https://VOTRE_ALB_DNS/api/social/youtube/callback

### Services Externes
- **LiveKit** : Vérifier que les URLs ne pointent pas vers Render
- **Video Renderer** : Vérifier que l'URL ne pointe pas vers Render
- **SRS** : Vérifier que les URLs ne pointent pas vers Render

### CDN / Public URLs
- **CloudFront/S3** : Vérifier que PUBLIC_BASE_URL et UPLOAD_BASE_URL pointent vers AWS

### Services de Paiement
- **MTN Money** : Mettre à jour les callbacks vers AWS ALB
- **Orange Money** : Mettre à jour les callbacks vers AWS ALB

## 📝 Référence
Voir SERVICES_EXTERNES_A_METTRE_A_JOUR.md pour les détails complets.
"@

$reportFile = "RAPPORT_VERIFICATION_SERVICES_EXTERNES_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
$report | Out-File -FilePath $reportFile -Encoding UTF8

Write-Host "Rapport sauvegarde dans: $reportFile" -ForegroundColor Cyan
Write-Host ""

if ($issues.Count -eq 0) {
    Write-Host "✅ Tous les services externes sont correctement lies a AWS!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Des corrections sont necessaires. Consultez le rapport ci-dessus." -ForegroundColor Red
    exit 1
}

