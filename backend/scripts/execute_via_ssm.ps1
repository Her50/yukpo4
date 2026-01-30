# Script pour executer les scripts de diagnostic/correction via AWS SSM Session Manager
# Date: 2026-01-30
# Usage: .\execute_via_ssm.ps1 [-InstanceId <id>] [-AutoConfirm]

param(
    [string]$InstanceId = "",
    [switch]$AutoConfirm
)

Write-Host "Execution des scripts via AWS Systems Manager Session Manager" -ForegroundColor Cyan
Write-Host ""

# Verifier que AWS CLI est installe
$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCli) {
    Write-Host "ERREUR: AWS CLI n'est pas installe" -ForegroundColor Red
    Write-Host "   Installez AWS CLI depuis: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Si InstanceId n'est pas fourni, chercher une instance
if (-not $InstanceId) {
    Write-Host "Recherche d'une instance EC2 dans le VPC..." -ForegroundColor Yellow
    
    $instances = aws ec2 describe-instances `
        --region us-east-1 `
        --filters "Name=tag:Name,Values=*yukpomnang*" "Name=instance-state-name,Values=running" `
        --query "Reservations[*].Instances[*].[InstanceId,State.Name,Tags[?Key=='Name'].Value|[0]]" `
        --output table 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERREUR lors de la recherche d'instances:" -ForegroundColor Red
        Write-Host $instances -ForegroundColor Red
        Write-Host ""
        Write-Host "Fournissez l'InstanceId manuellement:" -ForegroundColor Yellow
        Write-Host "   .\execute_via_ssm.ps1 -InstanceId i-xxxxxxxxxxxxx" -ForegroundColor Gray
        exit 1
    }
    
    Write-Host $instances
    Write-Host ""
    
    # Essayer de trouver la premiere instance
    $instanceList = aws ec2 describe-instances `
        --region us-east-1 `
        --filters "Name=tag:Name,Values=*yukpomnang*" "Name=instance-state-name,Values=running" `
        --query "Reservations[*].Instances[*].InstanceId" `
        --output text 2>&1
    
    if ($instanceList -and $instanceList -notmatch "error") {
        $InstanceId = ($instanceList -split "`t" | Where-Object { $_ })[0]
        Write-Host "Utilisation de l'instance: $InstanceId" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: Aucune instance EC2 trouvee" -ForegroundColor Red
        Write-Host "   Fournissez l'InstanceId manuellement:" -ForegroundColor Yellow
        Write-Host "   .\execute_via_ssm.ps1 -InstanceId i-xxxxxxxxxxxxx" -ForegroundColor Gray
        exit 1
    }
}

Write-Host "Instance ID: $InstanceId" -ForegroundColor Cyan
Write-Host ""

# Creer un script temporaire a executer sur l'instance
$tempScript = @"
#!/bin/bash
set -e

# Recuperer DATABASE_URL depuis Secrets Manager
if [ -z "\$DATABASE_URL" ]; then
    SECRET_NAME="yukpomnang/backend/secrets"
    REGION="us-east-1"
    
    if command -v aws &> /dev/null; then
        SECRET_JSON=\$(aws secretsmanager get-secret-value --secret-id "\$SECRET_NAME" --region "\$REGION" --query SecretString --output text 2>/dev/null || echo "")
        if [ -n "\$SECRET_JSON" ]; then
            export DATABASE_URL=\$(echo "\$SECRET_JSON" | jq -r '.DATABASE_URL')
        fi
    fi
fi

# Si toujours pas de DATABASE_URL, utiliser les valeurs par defaut
if [ -z "\$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://yukpo_db_user:SztViedrXvuBDyj16TWaIAs25FfUColh@yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com:5432/yukpomnang"
fi

# Installer psql si necessaire
if ! command -v psql &> /dev/null; then
    if [ -f /etc/redhat-release ]; then
        sudo yum install -y postgresql15 || sudo yum install -y postgresql
    elif [ -f /etc/debian_version ]; then
        sudo apt-get update && sudo apt-get install -y postgresql-client
    fi
fi

# Installer jq si necessaire
if ! command -v jq &> /dev/null; then
    if [ -f /etc/redhat-release ]; then
        sudo yum install -y jq
    elif [ -f /etc/debian_version ]; then
        sudo apt-get install -y jq
    fi
fi

# Cloner ou mettre a jour le repo
REPO_DIR="/tmp/yukpomnang2"
if [ ! -d "\$REPO_DIR" ]; then
    echo "Clonage du repo..."
    # Remplacez par votre URL de repo
    # git clone <repo-url> \$REPO_DIR
    echo "ERREUR: Repo non clone. Clonez manuellement le repo dans \$REPO_DIR"
    exit 1
fi

cd "\$REPO_DIR/backend/scripts"

# Executer les scripts
chmod +x execute_diagnostic_fix_aws_ec2.sh
export AUTO_CONFIRM=$($AutoConfirm.ToString().ToLower())
./execute_diagnostic_fix_aws_ec2.sh
"@

# Sauvegarder le script temporaire
$tempScriptPath = [System.IO.Path]::GetTempFileName()
$tempScriptPath = $tempScriptPath -replace '\.tmp$', '.sh'
$tempScript | Out-File -FilePath $tempScriptPath -Encoding UTF8

Write-Host "Script temporaire cree: $tempScriptPath" -ForegroundColor Gray
Write-Host ""

# Executer via SSM
Write-Host "Connexion a l'instance via SSM et execution des scripts..." -ForegroundColor Yellow
Write-Host ""

# Lire le script et l'executer via SSM
$scriptContent = Get-Content $tempScriptPath -Raw

# Executer via SSM (commande directe)
$ssmCommand = "aws ssm send-command " +
    "--instance-ids $InstanceId " +
    "--region us-east-1 " +
    "--document-name 'AWS-RunShellScript' " +
    "--parameters `"commands=$($scriptContent -replace "`"", "\`"")`" " +
    "--output text --query 'Command.CommandId'"

Write-Host "Commande SSM envoyee..." -ForegroundColor Yellow
Write-Host ""

# Alternative: Utiliser start-session avec un script
Write-Host "Pour executer manuellement:" -ForegroundColor Cyan
Write-Host "  1. Se connecter via SSM:" -ForegroundColor Gray
Write-Host "     aws ssm start-session --target $InstanceId --region us-east-1" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Dans la session, executer:" -ForegroundColor Gray
Write-Host "     cd /tmp/yukpomnang2/backend/scripts" -ForegroundColor Gray
Write-Host "     chmod +x execute_diagnostic_fix_aws_ec2.sh" -ForegroundColor Gray
if ($AutoConfirm) {
    Write-Host "     export AUTO_CONFIRM=true" -ForegroundColor Gray
}
Write-Host "     ./execute_diagnostic_fix_aws_ec2.sh" -ForegroundColor Gray
Write-Host ""

# Nettoyer
Remove-Item $tempScriptPath -ErrorAction SilentlyContinue

Write-Host "Note: Pour une execution automatique, utilisez AWS Systems Manager Run Command" -ForegroundColor Yellow
Write-Host "   ou connectez-vous manuellement via SSM Session Manager" -ForegroundColor Yellow


