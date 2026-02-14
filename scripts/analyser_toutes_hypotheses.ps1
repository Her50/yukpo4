# Script PowerShell pour analyser TOUTES les hypothèses du crash
# Vérifie systématiquement chaque cause possible

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ANALYSE COMPLETE DE TOUTES LES HYPOTHESES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$region = "eu-west-1"
$clusterName = "yukpo-cluster"
$serviceName = "yukpo-backend-service"
$logGroupName = "/ecs/yukpo-backend"

# ============================================
# HYPOTHÈSE 1: Panic Rust non capturée (stderr)
# ============================================
Write-Host "HYPOTHESE 1: Panic Rust non capturee (stderr)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "Recherche des logs stderr dans CloudWatch..." -ForegroundColor Cyan

# Récupérer une tâche récente
$stoppedTasks = aws ecs list-tasks `
    --cluster $clusterName `
    --desired-status STOPPED `
    --region $region `
    --max-items 1 `
    --output json | ConvertFrom-Json

if ($stoppedTasks.taskArns) {
    $taskArn = $stoppedTasks.taskArns[0]
    $taskId = $taskArn.Split('/')[-1]
    
    # Chercher tous les streams (stdout et stderr)
    $allStreams = aws logs describe-log-streams `
        --log-group-name $logGroupName `
        --log-stream-name-prefix "backend/backend/$taskId" `
        --region $region `
        --max-items 10 `
        --output json | ConvertFrom-Json
    
    if ($allStreams.logStreams) {
        Write-Host "  Streams trouves: $($allStreams.logStreams.Count)" -ForegroundColor White
        foreach ($stream in $allStreams.logStreams) {
            Write-Host "    - $($stream.logStreamName)" -ForegroundColor Gray
        }
        
        # Récupérer les logs de chaque stream
        foreach ($stream in $allStreams.logStreams) {
            $events = aws logs get-log-events `
                --log-group-name $logGroupName `
                --log-stream-name $stream.logStreamName `
                --region $region `
                --limit 100 `
                --output json | ConvertFrom-Json
            
            if ($events.events) {
                $panicLines = $events.events | Where-Object { 
                    $_.message -match "panic|Panic|PANIC|thread.*panicked|fatal runtime error"
                }
                
                if ($panicLines) {
                    Write-Host "  ❌ PANIC RUST TROUVEE!" -ForegroundColor Red
                    foreach ($line in $panicLines) {
                        Write-Host "    $($line.message)" -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "  ✅ Aucune panic Rust trouvee dans $($stream.logStreamName)" -ForegroundColor Green
                }
            }
        }
    }
} else {
    Write-Host "  ⚠️ Aucune tache arretee trouvee" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# HYPOTHÈSE 2: Variables d'environnement manquantes
# ============================================
Write-Host "HYPOTHESE 2: Variables d'environnement manquantes" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "Recuperation de la task definition..." -ForegroundColor Cyan

$taskDef = aws ecs describe-task-definition `
    --task-definition yukpo-backend `
    --region $region `
    --output json | ConvertFrom-Json

$taskDefContainer = $taskDef.taskDefinition.containerDefinitions[0]

Write-Host "  Variables d'environnement dans la task definition:" -ForegroundColor White
Write-Host "    Total: $($taskDefContainer.environment.Count + $taskDefContainer.secrets.Count)" -ForegroundColor Gray

# Variables critiques à vérifier
$criticalVars = @(
    "DATABASE_URL",
    "REDIS_URL",
    "MONGODB_URL",
    "JWT_SECRET",
    "PORT",
    "HOST"
)

Write-Host ""
Write-Host "  Verification des variables critiques:" -ForegroundColor Cyan

$allVars = @{}
foreach ($env in $taskDefContainer.environment) {
    $allVars[$env.name] = $env.value
}

foreach ($secret in $taskDefContainer.secrets) {
    $varName = $secret.name
    $secretArn = $secret.valueFrom
    
    # Récupérer la valeur depuis Secrets Manager
    try {
        $secretValue = aws secretsmanager get-secret-value `
            --secret-id $secretArn `
            --region $region `
            --query 'SecretString' `
            --output text | ConvertFrom-Json
        
        # Si c'est un JSON, chercher la variable
        if ($secretValue -is [PSCustomObject]) {
            if ($secretValue.$varName) {
                $allVars[$varName] = "***SECRET***"
            }
        }
    } catch {
        # Ignorer les erreurs
    }
}

$missingVars = @()
foreach ($var in $criticalVars) {
    if ($allVars.ContainsKey($var)) {
        Write-Host "    ✅ $var : Presente" -ForegroundColor Green
    } else {
        Write-Host "    ❌ $var : MANQUANTE" -ForegroundColor Red
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host ""
    Write-Host "  ❌ Variables manquantes: $($missingVars -join ', ')" -ForegroundColor Red
} else {
    Write-Host ""
    Write-Host "  ✅ Toutes les variables critiques sont presentes" -ForegroundColor Green
}

Write-Host ""

# ============================================
# HYPOTHÈSE 3: Erreur de connexion PostgreSQL
# ============================================
Write-Host "HYPOTHESE 3: Erreur de connexion PostgreSQL" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "Recuperation de DATABASE_URL depuis Secrets Manager..." -ForegroundColor Cyan

try {
    $secret = aws secretsmanager get-secret-value `
        --secret-id "yukpo/backend/secrets" `
        --region $region `
        --query 'SecretString' `
        --output text | ConvertFrom-Json
    
    if ($secret.DATABASE_URL) {
        $dbUrl = $secret.DATABASE_URL
        
        Write-Host "  DATABASE_URL trouvee" -ForegroundColor Green
        
        # Analyser l'URL
        if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $dbUser = $Matches[1]
            $dbPass = $Matches[2]
            $dbHost = $Matches[3]
            $dbPort = $Matches[4]
            $dbName = $Matches[5]
            
            Write-Host "  Analyse de l'URL:" -ForegroundColor White
            Write-Host "    User: $dbUser" -ForegroundColor Gray
            Write-Host "    Host: $dbHost" -ForegroundColor Gray
            Write-Host "    Port: $dbPort" -ForegroundColor Gray
            Write-Host "    Database: $dbName" -ForegroundColor $(if ($dbName -eq "yukpo") { "Green" } else { "Red" })
            
            if ($dbName -ne "yukpo") {
                Write-Host "  ❌ Database incorrecte: $dbName (devrait etre 'yukpo')" -ForegroundColor Red
            } else {
                Write-Host "  ✅ Database correcte: yukpo" -ForegroundColor Green
            }
            
            # Vérifier la connectivité depuis l'instance EC2
            Write-Host ""
            Write-Host "  Test de connexion depuis EC2..." -ForegroundColor Cyan
            
            $instanceId = "i-0b9ad404f8d738d04"
            $testCommand = @"
export PGPASSWORD='$dbPass'
psql -h '$dbHost' -U '$dbUser' -d '$dbName' -c 'SELECT current_database(), current_user, version();' 2>&1
"@
            
            $testResult = aws ssm send-command `
                --instance-ids $instanceId `
                --document-name "AWS-RunShellScript" `
                --parameters "commands=$testCommand" `
                --region $region `
                --output json | ConvertFrom-Json
            
            $commandId = $testResult.Command.CommandId
            Write-Host "    Commande envoyee: $commandId" -ForegroundColor Gray
            
            Start-Sleep -Seconds 5
            
            $commandResult = aws ssm get-command-invocation `
                --command-id $commandId `
                --instance-id $instanceId `
                --region $region `
                --output json | ConvertFrom-Json
            
            if ($commandResult.Status -eq "Success") {
                Write-Host "  ✅ Connexion PostgreSQL reussie depuis EC2" -ForegroundColor Green
                Write-Host "    Output: $($commandResult.StandardOutputContent.Substring(0, [Math]::Min(100, $commandResult.StandardOutputContent.Length)))" -ForegroundColor Gray
            } else {
                Write-Host "  ❌ Connexion PostgreSQL echouee depuis EC2" -ForegroundColor Red
                Write-Host "    Error: $($commandResult.StandardErrorContent)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  ⚠️ Format URL non reconnu" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ DATABASE_URL non trouvee dans les secrets" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Erreur lors de la recuperation: $_" -ForegroundColor Red
}

Write-Host ""

# ============================================
# HYPOTHÈSE 4: Erreur lors du bind (port 8080)
# ============================================
Write-Host "HYPOTHESE 4: Erreur lors du bind (port 8080)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "Verification de la configuration du port..." -ForegroundColor Cyan

# Vérifier le port dans la task definition
$portMapping = $taskDefContainer.portMappings | Where-Object { $_.containerPort -eq 8080 }
if ($portMapping) {
    Write-Host "  ✅ Port 8080 configure dans la task definition" -ForegroundColor Green
    Write-Host "    Container Port: $($portMapping.containerPort)" -ForegroundColor Gray
    Write-Host "    Host Port: $($portMapping.hostPort)" -ForegroundColor Gray
    Write-Host "    Protocol: $($portMapping.protocol)" -ForegroundColor Gray
} else {
    Write-Host "  ⚠️ Port 8080 non trouve dans portMappings" -ForegroundColor Yellow
}

# Vérifier la variable PORT
if ($allVars.ContainsKey("PORT")) {
    $portValue = $allVars["PORT"]
    Write-Host "  ✅ Variable PORT: $portValue" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Variable PORT non definie (utilisera 8080 par defaut)" -ForegroundColor Yellow
}

# Vérifier le health check
$healthCheck = $taskDefContainer.healthCheck
if ($healthCheck) {
    Write-Host "  ✅ Health check configure" -ForegroundColor Green
    Write-Host "    Command: $($healthCheck.command -join ' ')" -ForegroundColor Gray
    Write-Host "    Interval: $($healthCheck.interval)s" -ForegroundColor Gray
    Write-Host "    Timeout: $($healthCheck.timeout)s" -ForegroundColor Gray
    Write-Host "    Start Period: $($healthCheck.startPeriod)s" -ForegroundColor Gray
    Write-Host "    Retries: $($healthCheck.retries)" -ForegroundColor Gray
} else {
    Write-Host "  ⚠️ Health check non configure" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# RÉSUMÉ
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUME DE L'ANALYSE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "HYPOTHESE 1 (Panic Rust):" -ForegroundColor Yellow
Write-Host "  - Logs stderr verifies" -ForegroundColor White
Write-Host "  - Action: Verifier manuellement les logs CloudWatch" -ForegroundColor Gray
Write-Host ""

Write-Host "HYPOTHESE 2 (Variables manquantes):" -ForegroundColor Yellow
if ($missingVars.Count -gt 0) {
    Write-Host "  ❌ Variables manquantes: $($missingVars -join ', ')" -ForegroundColor Red
} else {
    Write-Host "  ✅ Toutes les variables critiques presentes" -ForegroundColor Green
}
Write-Host ""

Write-Host "HYPOTHESE 3 (Connexion PostgreSQL):" -ForegroundColor Yellow
Write-Host "  - DATABASE_URL verifiee" -ForegroundColor White
Write-Host "  - Test de connexion depuis EC2 effectue" -ForegroundColor White
Write-Host ""

Write-Host "HYPOTHESE 4 (Bind port 8080):" -ForegroundColor Yellow
Write-Host "  - Configuration du port verifiee" -ForegroundColor White
Write-Host "  - Health check verifie" -ForegroundColor White
Write-Host ""

Write-Host "PROCHAINES ETAPES:" -ForegroundColor Cyan
Write-Host "  1. Examiner les logs stderr dans CloudWatch manuellement" -ForegroundColor White
Write-Host "  2. Verifier les variables d'environnement dans ECS Task Definition" -ForegroundColor White
Write-Host "  3. Tester la connexion PostgreSQL depuis un container ECS" -ForegroundColor White
Write-Host "  4. Ajouter des logs de debogage au debut de main.rs" -ForegroundColor White

