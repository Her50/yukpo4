# Script pour mettre a jour automatiquement DATABASE_URL et REDIS_URL depuis Terraform

param(
    [string]$Region = "eu-west-1",
    [string]$Path = "/yukpo/production"
)

Write-Host "Mise a jour des variables AWS depuis Terraform..." -ForegroundColor Cyan
Write-Host ""

# Aller dans le dossier Terraform
Push-Location infra/aws

try {
    # Recuperer les outputs Terraform
    Write-Host "Recuperation des outputs Terraform..." -ForegroundColor Yellow
    
    $database_url = terraform output -raw database_url 2>$null
    $redis_url = terraform output -raw redis_url 2>$null
    
    if ($database_url) {
        Write-Host "DATABASE_URL trouve" -ForegroundColor Green
        aws ssm put-parameter --name "$Path/DATABASE_URL" --value $database_url --type "SecureString" --region $Region --overwrite | Out-Null
        Write-Host "  DATABASE_URL mis a jour dans SSM" -ForegroundColor Green
    } else {
        Write-Host "  ATTENTION: DATABASE_URL non trouve dans Terraform" -ForegroundColor Yellow
    }
    
    if ($redis_url) {
        Write-Host "REDIS_URL trouve" -ForegroundColor Green
        aws ssm put-parameter --name "$Path/REDIS_URL" --value $redis_url --type "SecureString" --region $Region --overwrite | Out-Null
        Write-Host "  REDIS_URL mis a jour dans SSM" -ForegroundColor Green
    } else {
        Write-Host "  ATTENTION: REDIS_URL non trouve dans Terraform" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Mise a jour terminee !" -ForegroundColor Green
    
} catch {
    Write-Host "Erreur: $_" -ForegroundColor Red
} finally {
    Pop-Location
}

