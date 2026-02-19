# Script de diagnostic pour analyser les problemes de connexion
# Usage: .\scripts\diagnostic-connexion-gcp.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend"
)

Write-Host ""
Write-Host "DIAGNOSTIC COMPLET - PROBLEMES DE CONNEXION" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Region: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
Write-Host ""

gcloud config set project $GcpProjectId | Out-Null

$errors = @()
$warnings = @()
$info = @()

# 1. ANALYSER LES LOGS REDIS
Write-Host "1. ANALYSE DES ERREURS REDIS" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow

$redisLogs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName AND (textPayload=~'Redis' OR jsonPayload.message=~'Redis')" --limit=50 --project=$GcpProjectId --format=json --freshness=1h 2>&1

if ($LASTEXITCODE -eq 0 -and $redisLogs) {
    $redisErrors = $redisLogs | ConvertFrom-Json | Where-Object { 
        $_.textPayload -like '*failed*' -or 
        $_.textPayload -like '*error*' -or 
        $_.textPayload -like '*ERROR*' -or
        $_.jsonPayload.message -like '*failed*' 
    }
    
    if ($redisErrors) {
        $errorCount = ($redisErrors | Measure-Object).Count
        Write-Host "[WARN] $errorCount erreurs Redis trouvees dans la derniere heure" -ForegroundColor Yellow
        $warnings += "Erreurs Redis: $errorCount dans la derniere heure"
        
        # Analyser le type d'erreur
        $dnsErrors = $redisErrors | Where-Object { 
            $_.textPayload -like '*lookup*' -or 
            $_.textPayload -like '*DNS*' -or
            $_.textPayload -like '*Name or service not known*'
        }
        
        if ($dnsErrors) {
            Write-Host "   [ERREUR] Erreurs DNS detectees (resolution d'adresse)" -ForegroundColor Red
            $errors += "Redis: Erreurs DNS - Impossible de resoudre l'adresse"
            Write-Host "   Cause probable: IP Redis inaccessible ou VPC mal configure" -ForegroundColor Gray
        }
    } else {
        Write-Host "[OK] Aucune erreur Redis recente" -ForegroundColor Green
    }
} else {
    Write-Host "[INFO] Impossible de recuperer les logs Redis" -ForegroundColor Gray
}

Write-Host ""

# 2. ANALYSER LES LOGS D'AUTHENTIFICATION
Write-Host "2. ANALYSE DES LOGS D'AUTHENTIFICATION" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

$authLogs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName AND (textPayload=~'login' OR textPayload=~'auth' OR textPayload=~'Unauthorized' OR jsonPayload.message=~'login' OR jsonPayload.message=~'auth')" --limit=100 --project=$GcpProjectId --format=json --freshness=2h 2>&1

if ($LASTEXITCODE -eq 0 -and $authLogs) {
    $authErrors = $authLogs | ConvertFrom-Json | Where-Object { 
        $_.textPayload -like '*401*' -or 
        $_.textPayload -like '*Unauthorized*' -or
        $_.textPayload -like '*failed*' -or
        $_.textPayload -like '*error*' -or
        $_.jsonPayload.message -like '*401*' -or
        $_.jsonPayload.message -like '*Unauthorized*'
    }
    
    if ($authErrors) {
        $authErrorCount = ($authErrors | Measure-Object).Count
        Write-Host "[WARN] $authErrorCount erreurs d'authentification trouvees" -ForegroundColor Yellow
        $warnings += "Erreurs authentification: $authErrorCount"
        
        # Analyser les types d'erreurs
        $loginFailed = $authErrors | Where-Object { 
            $_.textPayload -like '*login*' -and 
            ($_.textPayload -like '*failed*' -or $_.textPayload -like '*incorrect*')
        }
        
        if ($loginFailed) {
            Write-Host "   [INFO] Tentatives de connexion echouees detectees" -ForegroundColor Gray
            $info += "Tentatives de connexion echouees: $(($loginFailed | Measure-Object).Count)"
        }
    } else {
        Write-Host "[OK] Aucune erreur d'authentification recente" -ForegroundColor Green
    }
} else {
    Write-Host "[INFO] Impossible de recuperer les logs d'authentification" -ForegroundColor Gray
}

Write-Host ""

# 3. VERIFIER LA CONFIGURATION REDIS
Write-Host "3. VERIFICATION CONFIGURATION REDIS" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow

$redisSecret = gcloud secrets versions access latest --secret=redis-url --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0 -and $redisSecret) {
    $redisUrl = $redisSecret.Trim()
    Write-Host "[OK] Secret redis-url accessible" -ForegroundColor Green
    
    # Analyser l'URL
    if ($redisUrl -like '*10.128.*') {
        Write-Host "   [INFO] URL Redis: IP privee detectee (Memorystore GCP)" -ForegroundColor Gray
        $info += "Redis: IP privee (Memorystore)"
        
        # Verifier si c'est une IP valide
        if ($redisUrl -match '(\d+\.\d+\.\d+\.\d+):(\d+)') {
            $redisIp = $matches[1]
            $redisPort = $matches[2]
            Write-Host "   [INFO] IP Redis: ${redisIp}:${redisPort}" -ForegroundColor Gray
            
            # Verifier si l'IP est accessible (via VPC)
            Write-Host "   [WARN] Verification de l'accessibilite necessaire via VPC Connector" -ForegroundColor Yellow
            $warnings += "Redis: Verification VPC Connector necessaire"
        }
    } elseif ($redisUrl -like '*upstash*') {
        Write-Host "   [INFO] URL Redis: Upstash detecte" -ForegroundColor Gray
        $info += "Redis: Upstash"
    } else {
        Write-Host "   [WARN] Format d'URL Redis non reconnu" -ForegroundColor Yellow
        $warnings += "Redis: Format d'URL non reconnu"
    }
} else {
    Write-Host "[ERREUR] Impossible d'acceder au secret redis-url" -ForegroundColor Red
    $errors += "Redis: Secret redis-url inaccessible"
}

Write-Host ""

# 4. VERIFIER LA CONFIGURATION DATABASE
Write-Host "4. VERIFICATION CONFIGURATION DATABASE" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

$dbLogs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName AND (textPayload=~'database' OR textPayload=~'PostgreSQL' OR textPayload=~'password authentication' OR jsonPayload.message=~'database')" --limit=50 --project=$GcpProjectId --format=json --freshness=1h 2>&1

if ($LASTEXITCODE -eq 0 -and $dbLogs) {
    $dbErrors = $dbLogs | ConvertFrom-Json | Where-Object { 
        $_.textPayload -like '*failed*' -or 
        $_.textPayload -like '*error*' -or 
        $_.textPayload -like '*authentication failed*'
    }
    
    if ($dbErrors) {
        $dbErrorCount = ($dbErrors | Measure-Object).Count
        Write-Host "[ERREUR] $dbErrorCount erreurs de base de donnees trouvees" -ForegroundColor Red
        $errors += "Database: $dbErrorCount erreurs dans la derniere heure"
        
        $authFailed = $dbErrors | Where-Object { 
            $_.textPayload -like '*password authentication failed*'
        }
        
        if ($authFailed) {
            Write-Host "   [ERREUR CRITIQUE] Erreurs d'authentification PostgreSQL detectees" -ForegroundColor Red
            $errors += "Database: Erreurs d'authentification PostgreSQL"
        }
    } else {
        Write-Host "[OK] Aucune erreur de base de donnees recente" -ForegroundColor Green
    }
} else {
    Write-Host "[INFO] Impossible de recuperer les logs de base de donnees" -ForegroundColor Gray
}

Write-Host ""

# 5. VERIFIER LES REQUETES HTTP RECENTES
Write-Host "5. ANALYSE DES REQUETES HTTP RECENTES" -ForegroundColor Yellow
Write-Host "-------------------------------------" -ForegroundColor Yellow

$httpLogs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName AND httpRequest.requestMethod=~'POST' AND httpRequest.requestUrl=~'/auth/login'" --limit=20 --project=$GcpProjectId --format=json --freshness=2h 2>&1

if ($LASTEXITCODE -eq 0 -and $httpLogs) {
    $httpRequests = $httpLogs | ConvertFrom-Json
    if ($httpRequests) {
        $requestCount = ($httpRequests | Measure-Object).Count
        Write-Host "[INFO] $requestCount requetes POST /auth/login dans les 2 dernieres heures" -ForegroundColor Gray
        $info += "Requetes login: $requestCount"
        
        # Analyser les codes de statut
        $statusCodes = $httpRequests | ForEach-Object { 
            if ($_.httpRequest.status) { $_.httpRequest.status } 
            else { "unknown" }
        } | Group-Object
        
        foreach ($status in $statusCodes) {
            Write-Host "   [INFO] Status $($status.Name): $($status.Count) requetes" -ForegroundColor Gray
        }
        
        $failedRequests = $httpRequests | Where-Object { 
            $_.httpRequest.status -ge 400 
        }
        
        if ($failedRequests) {
            $failedCount = ($failedRequests | Measure-Object).Count
            Write-Host "   [WARN] $failedCount requetes echouees (status >= 400)" -ForegroundColor Yellow
            $warnings += "Requetes login echouees: $failedCount"
        }
    } else {
        Write-Host "[INFO] Aucune requete POST /auth/login recente" -ForegroundColor Gray
    }
} else {
    Write-Host "[INFO] Impossible de recuperer les logs HTTP" -ForegroundColor Gray
}

Write-Host ""

# 6. VERIFIER LA CONFIGURATION CLOUD RUN
Write-Host "6. VERIFICATION CONFIGURATION CLOUD RUN" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow

$serviceConfig = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format=json 2>&1
if ($LASTEXITCODE -eq 0) {
    $serviceJson = $serviceConfig | ConvertFrom-Json
    $status = $serviceJson.status.conditions | Where-Object { $_.type -eq "Ready" }
    
    if ($status.status -eq "True") {
        Write-Host "[OK] Service Cloud Run est Ready" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Service Cloud Run n'est pas Ready" -ForegroundColor Red
        $errors += "Cloud Run: Service non Ready"
    }
    
    # Verifier le VPC Connector
    $vpcConnector = $serviceJson.spec.template.spec.containers[0].env | Where-Object { $_.name -eq "VPC_CONNECTOR" }
    if (-not $vpcConnector) {
        $vpcAccess = $serviceJson.spec.template.spec.vpcAccess
        if ($vpcAccess) {
            Write-Host "[INFO] VPC Connector configure: $($vpcAccess.connector)" -ForegroundColor Gray
            $info += "VPC Connector: $($vpcAccess.connector)"
        } else {
            Write-Host "[WARN] VPC Connector non configure (necessaire pour Redis Memorystore)" -ForegroundColor Yellow
            $warnings += "VPC Connector non configure"
        }
    }
} else {
    Write-Host "[ERREUR] Impossible de recuperer la configuration Cloud Run" -ForegroundColor Red
    $errors += "Cloud Run: Configuration inaccessible"
}

Write-Host ""

# RESUME FINAL
Write-Host ""
$separator = "=" * 60
Write-Host $separator -ForegroundColor Cyan
Write-Host "RESUME DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

if ($info.Count -gt 0) {
    Write-Host "INFORMATIONS ($($info.Count)):" -ForegroundColor Cyan
    foreach ($item in $info) {
        Write-Host "   i $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "AVERTISSEMENTS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host "   ! $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "ERREURS CRITIQUES ($($errors.Count)):" -ForegroundColor Red
    foreach ($item in $errors) {
        Write-Host "   X $item" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "ACTIONS REQUISES:" -ForegroundColor Yellow
    Write-Host "   1. Corriger les erreurs Redis (DNS/VPC)" -ForegroundColor White
    Write-Host "   2. Verifier la configuration VPC Connector" -ForegroundColor White
    Write-Host "   3. Verifier les erreurs de base de donnees si presentes" -ForegroundColor White
    Write-Host "   4. Tester la connexion apres corrections" -ForegroundColor White
} else {
    Write-Host "[OK] Aucune erreur critique detectee" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si le probleme de connexion persiste:" -ForegroundColor Yellow
    Write-Host "   - Verifier les credentials de connexion" -ForegroundColor White
    Write-Host "   - Verifier les logs en temps reel" -ForegroundColor White
    Write-Host "   - Tester avec un compte different" -ForegroundColor White
}

Write-Host ""
Write-Host "Pour voir les logs en temps reel:" -ForegroundColor Cyan
$logCommand = "gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName`" --project=$GcpProjectId"
Write-Host "   $logCommand" -ForegroundColor Gray
Write-Host ""

